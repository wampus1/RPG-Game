// Entry point: sets up the canvases, CRT pass, UI and the main loop.
import { VIEW_W, VIEW_H } from './config.js';
import { CRT } from './render/crt.js';
import { Renderer } from './render/renderer.js';
import { Input } from './game/input.js';
import { Audio } from './game/audio.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { TitleWindow, HelpWindow, SaveSlotsWindow, SettingsWindow } from './ui/windows.js';
import { loadSettings, saveSettings, applySettings } from './game/settings.js';
import { hashString } from './util/rng.js';
import { SaveStore } from './game/saves.js';
import { CharacterWindow } from './ui/create.js';
import { randomHero } from './game/hero.js';
import { Music, musicMood } from './game/music.js';

// Deep links like ?autostart&seed=123&time=1320 are handy for testing.
const params = new URLSearchParams(location.search);

const screen = document.getElementById('screen');
const view = document.createElement('canvas');
view.width = VIEW_W;
view.height = VIEW_H;
const crt = new CRT(screen, view);
const renderer = new Renderer(view);
const audio = new Audio();
const music = new Music(audio);
window.__music = music;
const ui = new UI(audio);
const input = new Input(screen, crt);
let game = null;

function resize() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const w = Math.floor(VIEW_W * s);
  const h = Math.floor(VIEW_H * s);
  screen.style.width = `${w}px`;
  screen.style.height = `${h}px`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  screen.width = Math.floor(w * dpr);
  screen.height = Math.floor(h * dpr);
}
window.addEventListener('resize', resize);
resize();

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const store = new SaveStore(browserStorage());
// Volumes and visuals, as the player left them.
const settings = loadSettings(browserStorage());
const applyAll = () => applySettings(settings, { audio, music, crt, renderer, ui });
applyAll();

// Save into a slot; says so (or why it couldn't).
function saveTo(id, note) {
  if (!game) return false;
  try {
    store.save(id, game);
    if (id !== 'auto') game.slot = id;
    ui.msg(note, '#80e070');
    audio.play('save');
    return true;
  } catch (e) {
    const full = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
    ui.msg(full ? 'Not enough room to save: delete an old save first.' : `Save failed: ${e.message}`, '#ff5a50');
    return false;
  }
}

function loadFrom(id) {
  try {
    const data = store.load(id);
    if (!data) {
      ui.msg('That save is empty.', '#ff5a50');
      return;
    }
    startGame(null, data, id);
  } catch (e) {
    ui.msg('Load failed: ' + e.message, '#ff5a50');
  }
}

function startGame(seed, save = null, slot = null, hero = null) {
  const s = save ? save.seed : seed ?? (Math.random() * 2 ** 32) >>> 0;
  ui.closeAll();
  ui.messages = [];
  showLoading(`Generating world ${s}...`);
  // Let the loading text paint before the heavy generation work.
  setTimeout(() => {
    const t0 = performance.now();
    game = new Game({ seed: s, renderer, audio, ui, save, hero });
    game.crt = crt;
    game.slot = slot && slot !== 'auto' ? slot : null;
    game.autosave = () => saveTo('auto', `Autosaved (day ${game.day}, 7:00).`);
    if (params.has('time') && !save) game.minute = parseInt(params.get('time'), 10);
    renderer.camInit = false;
    ui.showHud = true;
    ui.hudP = 0;
    ui.lastSettlement = undefined;
    hideLoading();
    if (!save && !hero) ui.msg(`Welcome to the world of seed ${s}.`, '#ffe070');
    ui.msg('Press H for help.', '#a0c8ff');
    console.log(`world ready in ${(performance.now() - t0).toFixed(0)}ms`);
    window.__game = game;
    if (params.has('goto')) window.__goto(params.get('goto'));
    if (params.has('reveal')) game.revealMap = true;
  }, 30);
}

let loadingEl = null;
function showLoading(text) {
  loadingEl = loadingEl || document.getElementById('loading');
  if (loadingEl) {
    loadingEl.textContent = text;
    loadingEl.style.display = 'block';
  }
}
function hideLoading() {
  if (loadingEl) loadingEl.style.display = 'none';
}

// A new game: make your character first.
function newGame(seed) {
  const s = seed ?? (Math.random() * 2 ** 32) >>> 0;
  ui.open(new CharacterWindow(ui, s, (hero) => startGame(s, null, null, hero)));
}

ui.hooks = {
  start: (seed) => newGame(seed),
  askSeed: () => {
    const v = window.prompt('World seed (number or text):', '');
    if (v === null) return;
    const n = /^\d+$/.test(v.trim()) ? parseInt(v.trim(), 10) >>> 0 : hashString(v.trim());
    newGame(n);
  },
  save: () => {
    if (!game) return;
    ui.open(new SaveSlotsWindow(ui, 'save', store));
  },
  load: () => ui.open(new SaveSlotsWindow(ui, 'load', store)),
  saveSlot: (id) => {
    const ok = saveTo(id, `Game saved to slot ${id}.`);
    if (ok) ui.closeAll();
    return ok;
  },
  loadSlot: (id) => loadFrom(id),
  continue: () => {
    const last = store.latest();
    if (last) loadFrom(last.id);
  },
  // Quick save: back into the slot this game was last saved to or loaded from.
  quickSave: () => {
    if (!game) return;
    if (game.slot) saveTo(game.slot, `Game saved to slot ${game.slot}.`);
    else ui.open(new SaveSlotsWindow(ui, 'save', store));
  },
  newWorld: () => {
    game = null;
    ui.showHud = false;
    ui.closeAll();
    newGame(null);
  },
  title: () => {
    game = null;
    ui.showHud = false;
    ui.closeAll();
    ui.open(new TitleWindow(ui, store));
  },
  settings: () => ui.open(new SettingsWindow(ui, settings)),
  settingsChanged: (s) => {
    applyAll();
    saveSettings(browserStorage(), s);
  },
  toggleCrt: () => {
    settings.crt = !settings.crt;
    applyAll();
    saveSettings(browserStorage(), settings);
    ui.msg(`CRT effect ${crt.enabled ? 'on' : 'off'}`, '#a0c8ff');
  },
};

// ?autostart skips the title (and ?origin=crash|native makes a random
// character with that origin).
if (params.has('autostart')) {
  const seed = params.has('seed') ? parseInt(params.get('seed'), 10) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
  const origin = params.get('origin');
  startGame(seed, null, null, origin ? { ...randomHero(seed), origin } : null);
}
else ui.open(new TitleWindow(ui, store));
if (params.has('nocrt')) crt.enabled = false;
if (params.has('nomusic')) music.setVolume(0);

const perf = (window.__perf = {});
// Debug helper: teleport to a settlement by name, type or style.
window.__goto = (q) => {
  if (!game) return null;
  const ow = game.world.ow;
  const s = ow.settlements.find((o) => o.name.toLowerCase() === String(q).toLowerCase()) ||
    ow.settlements.find((o) => o.type === q && o.condition !== 'abandoned') ||
    ow.settlements.find((o) => o.style === q) || ow.settlements.find((o) => o.condition === q) || ow.settlements.find((o) => o.biome === q);
  if (!s) return null;
  const L = game.world.getLayout(s);
  game.loadAround(L.plaza.cx, L.plaza.cz, true);
  const p = game.findFreeSpot(L.plaza.cx + 1, L.plaza.cz + 3, 6);
  game.player.teleport(p.x, p.y, p.z);
  game.player.spawn = { ...p };
  renderer.camInit = false;
  game.updateSettlements(true);
  game.world.ow.markExplored(p.x, p.z, 1);
  return `${s.name} (${s.type}, ${s.style}, ${s.biome}, ${s.condition})`;
};

let last = performance.now();
let fps = 60;
const ctx = view.getContext('2d');
function frame(now) {
  // Keep the loop alive even if a frame throws; log the error once per second.
  requestAnimationFrame(frame);
  try {
    step(now);
  } catch (e) {
    if (!frame.lastErr || now - frame.lastErr > 1000) console.error(e);
    frame.lastErr = now;
  }
}
function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fps = fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
  // (Going back to the title mid-frame drops `game`; finish this frame
  // with the one we started.)
  const g = game;
  if (g) {
    const t0 = performance.now();
    g.update(dt, input);
    ui.update(dt, game);
    const t1 = performance.now();
    if (game === g) renderer.render(g, dt);
    const t2 = performance.now();
    ui.render(ctx, game, fps);
    const t3 = performance.now();
    const pf = (perf.frames = (perf.frames || 0) + 1);
    const k = pf < 30 ? 1 / pf : 0.05;
    perf.update = (perf.update || 0) * (1 - k) + (t1 - t0) * k;
    perf.world = (perf.world || 0) * (1 - k) + (t2 - t1) * k;
    perf.ui = (perf.ui || 0) * (1 - k) + (t3 - t2) * k;
  } else {
    const ev = input.consume();
    ui.handle(ev, input, null);
    ui.update(dt, null);
    ctx.fillStyle = '#07060b';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ui.render(ctx, null, fps);
  }
  // The music follows where you are and what you're doing.
  try {
    music.update(dt, game ? musicMood(game) : 'title');
  } catch (e) {
    if (!step.musicErr) console.error(e);
    step.musicErr = true;
  }
  const t4 = performance.now();
  crt.present(now / 1000);
  perf.crt = (perf.crt || 0) * 0.95 + (performance.now() - t4) * 0.05;
}
requestAnimationFrame(frame);

export { HelpWindow };
