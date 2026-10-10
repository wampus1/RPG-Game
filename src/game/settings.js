// Player settings: volumes and visuals, kept in the browser between games.
export const SETTINGS_KEY = 'tessera-settings';

// (Round 80) Particles and effects a frame, by the setting (fxCap): new
// particles, new effects, and how many of each can be about at once (see
// Renderer.room and fx.addEffect).
export const FX_CAPS = [
  { parts: 300, fx: 24, alive: 900, fxAlive: 60 },
  { parts: 150, fx: 12, alive: 600, fxAlive: 40 },
  { parts: 60, fx: 6, alive: 300, fxAlive: 24 },
];

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
  // (Round 80) New particles and effects a frame, from everything at once:
  // 0 many (300), 1 some (150), 2 few (60).
  fxCap: 0,
  weatherFx: true,
  netRate: 0, // 0 smooth (20 a second), 1 light (10)
  // (Round 77)
  autosave: true,
  questMarkers: true,
  tooltips: true,
  brightness: 5, // 0-10, 5 as drawn
  flashes: true,
  lightStyle: 0, // 0 smooth, 1 tiled
  wallHint: true,
  weatherGround: true, // ripples, splashes, snow lying, tracks and ruts
  waterFx: true, // foam on the shore, rings where you wade
  sndCreatures: 10,
  sndBlocks: 10,
  sndItems: 10,
  sndBosses: 10,
  sndWorld: 10,
  sndUi: 10,
  privateProfile: false,
  joinNotes: true,
};

// (Round 77) The settings' tabs, in order.
export const SETTING_TABS = ['General', 'Visuals', 'Sound', 'Controls', 'Multiplayer'];

// What each setting is called, which tab it's on and how it changes.
// (The most used first in each tab.)
export const SETTING_ROWS = [
  { key: 'autosave', tab: 'General', label: 'Autosave each morning', kind: 'bool' },
  { key: 'frameCap', tab: 'General', label: 'Frame rate', kind: 'choice', opts: ['Full', '30 a second'] },
  { key: 'damageNumbers', tab: 'General', label: 'Damage numbers', kind: 'bool' },
  { key: 'questMarkers', tab: 'General', label: 'Quest markers', kind: 'bool' },
  { key: 'tooltips', tab: 'General', label: 'Pointer tooltips', kind: 'bool' },

  { key: 'brightness', tab: 'Visuals', label: 'Brightness', kind: 'range', max: 10 },
  { key: 'lightStyle', tab: 'Visuals', label: 'Lighting style', kind: 'choice', opts: ['Smooth', 'Tiled'] },
  { key: 'lighting', tab: 'Visuals', label: 'Lighting quality', kind: 'choice', opts: ['Full', 'Fast'] },
  { key: 'particles', tab: 'Visuals', label: 'Particles', kind: 'choice', opts: ['All', 'Fewer', 'None'] },
  { key: 'fxCap', tab: 'Visuals', label: 'Particles and effects a frame', kind: 'choice', opts: ['Many (300)', 'Some (150)', 'Few (60)'] },
  { key: 'weatherFx', tab: 'Visuals', label: 'Falling rain and snow', kind: 'bool' },
  { key: 'weatherGround', tab: 'Visuals', label: 'Splashes, snow and tracks', kind: 'bool' },
  { key: 'waterFx', tab: 'Visuals', label: 'Shore foam and ripples', kind: 'bool' },
  { key: 'wallHint', tab: 'Visuals', label: 'Wall outlines indoors', kind: 'bool' },
  { key: 'shake', tab: 'Visuals', label: 'Screen shake', kind: 'bool' },
  { key: 'flashes', tab: 'Visuals', label: 'Screen flashes', kind: 'bool' },
  { key: 'windowAnim', tab: 'Visuals', label: 'Window animations', kind: 'bool' },
  { key: 'crt', tab: 'Visuals', label: 'CRT screen effect', kind: 'bool' },
  { key: 'curve', tab: 'Visuals', label: 'Screen curvature', kind: 'range', max: 10 },
  { key: 'glow', tab: 'Visuals', label: 'Screen glow', kind: 'range', max: 10 },

  { key: 'music', tab: 'Sound', label: 'Music', kind: 'range', max: 10 },
  { key: 'sound', tab: 'Sound', label: 'Sound effects (all)', kind: 'range', max: 10 },
  { key: 'sndCreatures', tab: 'Sound', label: 'Creatures and people', kind: 'range', max: 10 },
  { key: 'sndBlocks', tab: 'Sound', label: 'Blocks', kind: 'range', max: 10 },
  { key: 'sndItems', tab: 'Sound', label: 'Items and fighting', kind: 'range', max: 10 },
  { key: 'sndBosses', tab: 'Sound', label: 'Masters (bosses)', kind: 'range', max: 10 },
  { key: 'sndWorld', tab: 'Sound', label: 'Weather and nature', kind: 'range', max: 10 },
  { key: 'sndUi', tab: 'Sound', label: 'Menus', kind: 'range', max: 10 },

  { key: 'netRate', tab: 'Multiplayer', label: 'Connection (as a guest)', kind: 'choice', opts: ['Smooth', 'Light'] },
  { key: 'privateProfile', tab: 'Multiplayer', label: 'Private profile', kind: 'bool' },
  { key: 'joinNotes', tab: 'Multiplayer', label: 'Notices when others join', kind: 'bool' },
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
  if (audio) audio.setGroups?.({ creatures: s.sndCreatures / 10, blocks: s.sndBlocks / 10, items: s.sndItems / 10, bosses: s.sndBosses / 10, world: s.sndWorld / 10, ui: s.sndUi / 10 });
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
    renderer.fxCap = FX_CAPS[s.fxCap] || FX_CAPS[0];
    renderer.noWeatherFx = !s.weatherFx;
    if (renderer.lighting) renderer.lighting.fast = s.lighting === 1;
    // (Round 77)
    if (renderer.lighting) renderer.lighting.tiled = s.lightStyle === 1;
    renderer.brightness = (s.brightness ?? 5) / 5;
    renderer.noFlash = !s.flashes;
    renderer.wallHint = s.wallHint !== false;
    renderer.noWeatherGround = !s.weatherGround;
    renderer.noWaterFx = !s.waterFx;
    renderer.noQuestMarks = !s.questMarkers;
  }
  // (Playing in someone else's world: how often the host sends word.)
  if (net && net.setRate) net.setRate(s.netRate === 1 ? 10 : 20);
  if (ui) {
    ui.instantWindows = !s.windowAnim;
    ui.noTooltips = !s.tooltips;
    ui.noJoinNotes = !s.joinNotes;
    ui.noAutosave = s.autosave === false;
  }
}

export function changeSetting(s, key, d) {
  const row = SETTING_ROWS.find((r) => r.key === key);
  if (!row) return s;
  if (row.kind === 'bool') s[key] = !s[key];
  else if (row.kind === 'choice') s[key] = (((s[key] || 0) + (d || 1)) % row.opts.length + row.opts.length) % row.opts.length;
  else s[key] = Math.max(0, Math.min(row.max, s[key] + d));
  return s;
}
