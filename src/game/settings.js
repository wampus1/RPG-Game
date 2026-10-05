// Player settings: volumes and visuals, kept in the browser between games.
export const SETTINGS_KEY = 'tessera-settings';

export const DEFAULTS = {
  music: 5, // 0-10
  sound: 7, // 0-10
  crt: true,
  curve: 8, // 0-10: how far the screen bends
  glow: 10, // 0-10: phosphor glow
  shake: true,
  damageNumbers: true,
  windowAnim: true,
  // (Round 57) For a slow machine, or playing in someone else's world over
  // a slow line: a lower frame rate, lighting worked out less often, fewer
  // sparks and puffs, no rain or snow falling, the host's word less often.
  frameCap: 0, // 0 full, 1 at most 30 a second
  lighting: 0, // 0 full, 1 fast
  particles: 0, // 0 all, 1 fewer, 2 none
  weatherFx: true,
  netRate: 0, // 0 smooth (20 a second), 1 light (10)
};

// What each setting is called and how it changes.
export const SETTING_ROWS = [
  { key: 'music', label: 'Music volume', kind: 'range', max: 10 },
  { key: 'sound', label: 'Sound effects', kind: 'range', max: 10 },
  { key: 'crt', label: 'CRT screen effect', kind: 'bool' },
  { key: 'curve', label: 'Screen curvature', kind: 'range', max: 10 },
  { key: 'glow', label: 'Screen glow', kind: 'range', max: 10 },
  { key: 'shake', label: 'Screen shake', kind: 'bool' },
  { key: 'damageNumbers', label: 'Damage numbers', kind: 'bool' },
  { key: 'windowAnim', label: 'Window animations', kind: 'bool' },
  { section: 'PERFORMANCE (if it lags)' },
  { key: 'frameCap', label: 'Frame rate', kind: 'choice', opts: ['Full', '30 a second'] },
  { key: 'lighting', label: 'Lighting', kind: 'choice', opts: ['Full', 'Fast'] },
  { key: 'particles', label: 'Particles', kind: 'choice', opts: ['All', 'Fewer', 'None'] },
  { key: 'weatherFx', label: 'Falling rain/snow', kind: 'bool' },
  { key: 'netRate', label: 'Online (as a guest)', kind: 'choice', opts: ['Smooth', 'Light'] },
];

// (The rows that are settings, not section headings.)
export const SETTING_KEYS = SETTING_ROWS.filter((r) => r.key);

export function loadSettings(storage) {
  try {
    return { ...DEFAULTS, ...(JSON.parse(storage && storage.getItem(SETTINGS_KEY)) || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(storage, s) {
  try {
    storage && storage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Not saved: they still apply for this session.
  }
}

// Push the settings out to everything they affect.
export function applySettings(s, { audio, music, crt, renderer, ui, net }) {
  if (audio) audio.setVolume?.((s.sound / 10) * 0.5);
  if (music) music.setVolume?.(s.music / 10);
  if (crt) {
    crt.enabled = !!s.crt;
    crt.curve = (s.curve / 10) * 1;
    crt.glow = (s.glow / 10) * 1.2;
  }
  if (renderer) {
    renderer.noShake = !s.shake;
    renderer.noDamageNumbers = !s.damageNumbers;
    renderer.particleK = [1, 0.4, 0][s.particles] ?? 1;
    renderer.noWeatherFx = !s.weatherFx;
    if (renderer.lighting) renderer.lighting.fast = s.lighting === 1;
  }
  // (Playing in someone else's world: how often the host sends word.)
  if (net && net.setRate) net.setRate(s.netRate === 1 ? 10 : 20);
  if (ui) ui.instantWindows = !s.windowAnim;
}

export function changeSetting(s, key, d) {
  const row = SETTING_ROWS.find((r) => r.key === key);
  if (!row) return s;
  if (row.kind === 'bool') s[key] = !s[key];
  else if (row.kind === 'choice') s[key] = (((s[key] || 0) + (d || 1)) % row.opts.length + row.opts.length) % row.opts.length;
  else s[key] = Math.max(0, Math.min(row.max, s[key] + d));
  return s;
}
