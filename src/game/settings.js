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
];

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
export function applySettings(s, { audio, music, crt, renderer, ui }) {
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
  }
  if (ui) ui.instantWindows = !s.windowAnim;
}

export function changeSetting(s, key, d) {
  const row = SETTING_ROWS.find((r) => r.key === key);
  if (!row) return s;
  if (row.kind === 'bool') s[key] = !s[key];
  else s[key] = Math.max(0, Math.min(row.max, s[key] + d));
  return s;
}
