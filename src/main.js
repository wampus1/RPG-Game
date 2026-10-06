// Entry point: sets up the canvases, CRT pass, UI and the main loop.
import { VIEW_W, VIEW_H, REGION_W, REGION_D } from './config.js';
import { migrateSave } from './game/migrate.js';
import { CRT } from './render/crt.js';
import { Renderer } from './render/renderer.js';
import { Input } from './game/input.js';
import { Audio } from './game/audio.js';
import { Game, SAVE_VERSION } from './game/game.js';
import { UI } from './ui/ui.js';
import { TitleWindow, HelpWindow, SaveSlotsWindow, SettingsWindow, ConfirmWindow, ConsoleWindow } from './ui/windows.js';
import { GAME_VERSION, versionText, sameVersion, canUpgrade } from './version.js';
import { loadSettings, saveSettings, applySettings } from './game/settings.js';
import { hashString } from './util/rng.js';
import { SaveStore, openSaveDB } from './game/saves.js';
import { MachineSync } from './net/machine.js';
import { CharacterWindow } from './ui/create.js';
import { randomHero } from './game/hero.js';
import { Music, musicMood, moodUrgent } from './game/music.js';
import { Accounts, profileOf } from './net/account.js';
import { challengeBout } from './game/bout.js';
import { HostNet, PERMS } from './net/host.js';
import { GuestNet, refusal } from './net/guest.js';
import { NET_PATH, LAN_PATH, NET_VERSION, toRelay } from './net/protocol.js';
import { windowPixels } from './net/uiwire.js';
import { AccountWindow, MultiplayerWindow, HostWindow, PartyWindow, ProfileWindow, GuestPauseWindow, InviteWindow, GuildNameWindow, PermsWindow } from './ui/multiplayer.js';
import { MapWindow } from './ui/worldmap.js';
import { FeatsWindow } from './ui/feats.js';
import { FeatBook, FEAT } from './game/achievements.js';
import { avatarFromKey } from './render/avatar.js';
// (Round 62) Mods: kept here, put into the game for a world, drawn.
import { ModLibrary } from './mod/library.js';
import { installMods, uninstallMods, remapRegion, MODS } from './mod/registry.js';
import { exportMod } from './mod/format.js';
import { ModPickWindow } from './ui/modpick.js';
import './mod/render.js';
import { ITEMS } from './world/items.js';

// Deep links like ?autostart&seed=123&time=1320 are handy for testing.
const params = new URLSearchParams(location.search);

const screen = document.getElementById('screen');
const view = document.createElement('canvas');
view.width = VIEW_W;
view.height = VIEW_H;
const crt = new CRT(screen, view);
const renderer = new Renderer(view);
// (What people say is drawn with the UI, over a place's name: see UI.render.)
renderer.deferBubbles = true;
const audio = new Audio();
const music = new Music(audio);
window.__music = music;
const ui = new UI(audio);
ui.music = music;
window.__ui = ui;
const input = new Input(screen, crt);
window.__input = input;
let game = null;
// (Hosting or playing in someone else's world: see below. Declared up here,
// as the settings applied at start-up already ask after it.)
let session = null;

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
// (Closing the tab on play not yet saved: the browser asks. See unsaved.)
window.addEventListener('beforeunload', (e) => {
  if (!params.has('autostart') && unsaved()) e.preventDefault();
});
resize();

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const store = new SaveStore(browserStorage());
// (Round 62) The mods on this computer (see mod/library.js).
const modLib = new ModLibrary(browserStorage());
window.__mods = modLib;
// Games are kept in IndexedDB once it's open (it has room for many more
// than browser storage's few megabytes); ask for it to be kept for good.
const dbReady = openSaveDB().then((db) => {
  store.db = db;
  modLib.db = db;
});
try {
  window.navigator.storage?.persist?.();
} catch {
  // Not offered here.
}
// Volumes and visuals, as the player left them.
const settings = loadSettings(browserStorage());
const applyAll = () => applySettings(settings, { audio, music, crt, renderer, ui, net: session && session.role === 'guest' ? session.net : null });
applyAll();

// Save into a slot; says so (or why it couldn't).
function saveTo(id, note, quiet = false) {
  if (!game) return false;
  const g = game;
  // (Not in the middle of the opening scene: there's nothing to keep yet.)
  if (g.cutscene || (g.scene && g.scene.intro)) {
    ui.msg('The story hasn\'t begun yet: you can save once it has.', '#ffb080');
    return false;
  }
  const fail = (e) => {
    const full = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
    ui.msg(full ? 'Not enough room to save: delete an old save first.' : `Save failed: ${e && e.message ? e.message : e}`, '#ff5a50');
    return false;
  };
  try {
    return store.save(id, g).then(() => {
      if (id !== 'auto') g.slot = id;
      if (id !== 'auto' || (g.partyWorld && g.slot)) g.savedClock = clockOf(g);
      if (note) ui.msg(note, '#80e070');
      if (!quiet) audio.play('save');
      return true;
    }, fail);
  } catch (e) {
    return fail(e);
  }
}

// The game's clock, to the minute (to tell if it's been played on since).
function clockOf(g) {
  return g.day * 1440 + Math.floor(g.minute);
}

// Play since this game was last saved to a slot (or loaded): what'd be lost
// leaving it now. (Not a world you host, kept as it's closed; not someone
// else's; not before the story's begun.)
function unsaved() {
  const g = game;
  if (!g || ui.guest || session || (g.partyWorld && g.slot)) return false;
  if (g.cutscene || (g.scene && g.scene.intro)) return false;
  return g.savedClock !== clockOf(g);
}

// Leaving this game (for the title, another world, another save): with play
// not yet saved, asked first. Save (to its own slot, or one picked), go
// without, or back.
function leaving(go) {
  if (!unsaved()) return go();
  const g = game;
  ui.open(new ConfirmWindow(ui, 'SAVE FIRST?', `You've played on since this game was last saved${g.savedClock === undefined ? ' (it never has been)' : ''}. Save it before you go?`, () => {
    if (!g.slot) return ui.open(new SaveSlotsWindow(ui, 'save', store, go));
    Promise.resolve(saveTo(g.slot, `Game saved to slot ${g.slot}.`)).then((ok) => ok && go());
  }, { yes: g.slot ? `Save (slot ${g.slot})` : 'Save', no: 'Don\'t save', onNo: go, cancel: 'Back' }));
  return null;
}

function loadFrom(id) {
  store.load(id).then((data) => {
    if (!data) {
      ui.msg('That save is empty.', '#ff5a50');
      return;
    }
    // (From before the Dagoni Islands: a world of one island, made a
    // different way; it can't be put into this one.)
    if (!(data.v >= SAVE_VERSION)) {
      ui.msg('That save is from an older world (before the Dagoni Islands) and can\'t be loaded into this one.', '#ff5a50');
      return;
    }
    versionCheck(data, () => worldMods(data, (mods) => startGame(null, data, id, null, { mods })));
  }).catch((e) => ui.msg('Load failed: ' + e.message, '#ff5a50'));
}

// A world made in another version of the game: asked first (it may not
// play right), then `go`.
function versionCheck(data, go) {
  if (sameVersion(data.gv)) return go();
  // (An older one is brought up to this version as it loads: see
  // game/migrate.js.)
  const older = canUpgrade(data.gv);
  ui.open(new ConfirmWindow(ui, 'ANOTHER VERSION', older ? `This world was made in ${versionText(data.gv)} of the game. You are playing ${versionText(GAME_VERSION)}. Loading it brings it up to this version (what's new is brought into it as far as it can be), and once it's saved it can't go back. Some things in it may still not work quite as they should. Load it?` : `This world was made in ${versionText(data.gv)} of the game, newer than this one (${versionText(GAME_VERSION)}). Some things in it may not work as they should. Load it anyway?`, go, { yes: 'Load it', no: 'Back' }));
  return null;
}

// A world made in an older version of the game, brought up to this one:
// warned first (it's converted, one version at a time, and what's new is
// brought into it as far as it can be: see game/migrate.js; and it can't
// be taken back), then `done`.
function upgradeSave(id, meta, done = null) {
  if (!meta || !canUpgrade(meta.gv)) return;
  const what = meta.world ? `"${meta.world}"` : `${meta.name || 'This'}'s world`;
  ui.open(new ConfirmWindow(ui, 'UPDATE THIS WORLD?', `${what} was made in ${versionText(meta.gv)} of the game. Updating it to ${versionText(GAME_VERSION)} converts it, a version at a time, bringing in what's new as far as it can (cooks with full kitchens, the watch with salves, recipe books...). It loads without asking after, and others on ${versionText(GAME_VERSION)} can join it. A world from an older version may still not work quite as it should (some things are only made with a new world), and this can't be undone: an updated world can't be taken back to the older version. Update it?`, () => {
    store.upgrade(id, (data) => migrateSave(data)).then((res) => {
      ui.notify(`${what} is now ${versionText(GAME_VERSION)}.${res && res.log && res.log.length ? ` ${res.log.join(' ')}` : ''}`, null, '#80e070');
      done?.();
    }, (e) => ui.notify(`Couldn't update it: ${e && e.message ? e.message : e}`, null, '#ff8070'));
  }, { yes: 'Update it', no: 'Leave it' }));
}

// `opts.host`: { name } to host the world for others on the network.
function startGame(seed, save = null, slot = null, hero = null, opts = {}) {
  const s = save ? save.seed : seed ?? (Math.random() * 2 ** 32) >>> 0;
  endSession();
  ui.closeAll();
  ui.messages = [];
  showLoading(`Generating world ${s}...`);
  // Let the loading text paint before the heavy generation work.
  setTimeout(() => {
    const t0 = performance.now();
    // (A new character's story opens with a scene of where they're from;
    // ?nointro goes straight in. In a world for others too: they're kept
    // out of it till it's done, see intros.js.)
    // (Saved in an older version: brought up to this one as it loads. See
    // game/migrate.js.)
    if (save && canUpgrade(save.gv)) migrateSave(save);
    // (Round 62) The world's mods put into the game before it's made (their
    // blocks at the numbers the world keeps them by).
    const modded = setMods(opts.mods || [], save);
    // (The very versions it's made with, kept for it.)
    for (const m of opts.mods || []) modLib.putPack(m).catch(() => {});
    game = new Game({ seed: s, renderer, audio, ui, save, hero, intro: !!hero && !params.has('nointro') && !opts.playtest });
    if (modded) game.modReport = modded.report;
    game.crt = crt;
    // (What you do here, worth an achievement: kept with you.)
    game.featBook = feats;
    game.onFeat = (id) => featNote(id);
    game.slot = slot && slot !== 'auto' ? slot : null;
    // (Loaded, it's as saved: see unsaved.)
    if (save) game.savedClock = clockOf(game);
    game.autosave = () => saveTo(game.partyWorld && game.slot ? game.slot : 'auto', `Autosaved (day ${game.day}, 7:00).`);
    if (params.has('time') && !save) game.minute = parseInt(params.get('time'), 10);
    renderer.camInit = false;
    ui.showHud = !game.cutscene;
    ui.hudP = 0;
    ui.lastSettlement = undefined;
    hideLoading();
    if (!save && !hero) ui.msg(`Welcome to the world of seed ${s}.`, '#ffe070');
    if (!game.cutscene && !game.scene) ui.msg('Press H for help.', '#a0c8ff');
    console.log(`world ready in ${(performance.now() - t0).toFixed(0)}ms`);
    window.__game = game;
    if (params.has('goto')) window.__goto(params.get('goto'));
    if (params.has('reveal')) game.revealMap = true;
    if (opts.host) beginHosting(game, opts.host.name);
    if (opts.playtest) beginPlaytest(game, opts.playtest);
    else if (modded && modded.report.length) for (const r of modded.report.slice(0, 3)) ui.msg(r.text, r.level === 'error' ? '#ff8070' : '#ffb080');
    // (Round 63) What a mod's world map couldn't have as it says.
    for (const r of ((game.world && game.world.ow.planReport) || []).slice(0, 3)) ui.msg(r.text, '#ffb080');
  }, 30);
}

// (Round 62) A world's mods into the game (none: the game as it is). Its
// save's blocks moved if any had to be (see remapRegion).
function setMods(mods, save = null) {
  if (!mods.length) {
    uninstallMods();
    return null;
  }
  const res = installMods(mods, { blockIds: save && save.mods ? save.mods.blockIds : {} });
  if (save && Object.keys(res.remap).length) remapSave(save, res.remap);
  return res;
}
function remapSave(save, remap) {
  const walk = (v, d = 0) => {
    if (!v || typeof v !== 'object' || d > 8) return;
    if (Array.isArray(v)) {
      for (const q of v) walk(q, d + 1);
      return;
    }
    if (Array.isArray(v.rle) && v.rx !== undefined) {
      remapRegion(v, remap);
      return;
    }
    for (const q of Object.values(v)) if (q && typeof q === 'object') walk(q, d + 1);
  };
  walk(save.regions);
  walk(save.sim);
  walk(save.dungeon);
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

// A new game: its mods (if you have any), then your character.
function newGame(seed) {
  const s = seed ?? (Math.random() * 2 ** 32) >>> 0;
  pickMods('MODS FOR THIS WORLD', (mods) => ui.open(new CharacterWindow(ui, s, (hero) => startGame(s, null, null, hero, { mods }))));
}

// (Round 62) Which of your mods go into a new world (asked only if you
// have any): `go(mods)` with them, as they are now (each world keeps the
// versions it was made with).
function pickMods(title, go, back = null) {
  const list = modLib.list();
  if (!list.length) return go([]);
  let last = [];
  try {
    last = JSON.parse(localStorage.getItem('mods-last-picked') || '[]');
  } catch {
    last = [];
  }
  ui.open(new ModPickWindow(ui, {
    title,
    list: list.map((e) => ({ id: e.id, name: e.name, version: e.version, author: e.author, color: e.color, things: +e.things || 0, mine: e.mine })),
    chosen: last.filter((id) => modLib.has(id)),
    go: 'Next',
    onDone: async (ids) => {
      try {
        localStorage.setItem('mods-last-picked', JSON.stringify(ids));
      } catch {
        // Fine.
      }
      const mods = [];
      for (const id of ids) {
        const m = await modLib.get(id);
        if (m) mods.push(JSON.parse(exportMod(m)));
      }
      go(mods);
    },
    onBack: back,
    onWorkshop: () => openWorkshopApp({}),
  }));
  return null;
}

// (Round 62) A saved world's mods, found here: the very versions it was
// made with (or, if you'd rather, your newer ones). A world whose mods
// aren't here can't be opened (you're told which). Then `go(mods)`.
async function worldMods(data, go) {
  const refs = (data && data.mods && data.mods.refs) || [];
  if (!refs.length) return go([]);
  const res = await modLib.resolve(refs);
  const missing = res.filter((r) => r.missing);
  if (missing.length) {
    ui.open(new ConfirmWindow(ui, 'MODS MISSING', `This world was made with ${missing.length > 1 ? 'mods' : 'a mod'} you haven't got: ${missing.map((r) => `"${r.ref.name}" (v${r.ref.version}${r.ref.author ? `, by ${r.ref.author}` : ''})`).join(', ')}. Import ${missing.length > 1 ? 'them' : 'it'} in the Workshop (from whoever made ${missing.length > 1 ? 'them' : 'it'}), then load the world again.`, null, { yes: 'OK', only: true }));
    return null;
  }
  const own = res.map((r) => r.mod || r.newer);
  const changed = res.filter((r) => r.mod && r.newer);
  if (!changed.length) return go(own);
  ui.open(new ConfirmWindow(ui, 'NEWER MODS', `You've changed ${changed.map((r) => `"${r.ref.name}"`).join(', ')} since this world was made. Play it with the versions it was made with (it plays as it always has), or with your newer ones (what's new comes into it; what's gone may leave gaps)?`, () => go(own), { yes: 'Its own versions', no: 'My newer ones', onNo: () => go(res.map((r) => r.newer || r.mod)) }));
  return null;
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
    // (A world you host is kept in its own place.)
    if (game.partyWorld && game.slot) {
      saveTo(game.slot, `"${game.partyWorld.name}" saved.`);
      ui.closeAll();
      return;
    }
    ui.open(new SaveSlotsWindow(ui, 'save', store));
  },
  load: () => ui.open(new SaveSlotsWindow(ui, 'load', store)),
  // (`then`: what's next once it's saved: see leaving.)
  saveSlot: (id, then = null) => {
    const ok = saveTo(id, `Game saved to slot ${id}.`);
    if (ok) ui.closeAll();
    if (ok && then) Promise.resolve(ok).then((y) => y && then());
    return !!ok;
  },
  loadSlot: (id) => leaving(() => loadFrom(id)),
  upgradeSlot: (id, meta) => upgradeSave(id, meta),
  continue: () => {
    const last = store.latest();
    if (last) loadFrom(last.id);
  },
  // Quick save: back into the slot this game was last saved to or loaded from.
  quickSave: () => {
    if (!game || ui.guest) return;
    if (game.partyWorld && game.slot) saveTo(game.slot, `"${game.partyWorld.name}" saved.`);
    else if (game.slot) saveTo(game.slot, `Game saved to slot ${game.slot}.`);
    else ui.open(new SaveSlotsWindow(ui, 'save', store));
  },
  newWorld: () => leaving(() => {
    endSession();
    game = null;
    ui.showHud = false;
    ui.closeAll();
    newGame(null);
  }),
  title: () => leaving(() => {
    // (Closing a world you host: kept as it is, everyone's character in it.)
    if (game && game.partyWorld && game.slot && !ui.guest) saveTo(game.slot, null, true);
    endSession();
    game = null;
    uninstallMods();
    ui.showHud = false;
    ui.closeAll();
    ui.open(new TitleWindow(ui, store));
  }),
  multiplayer: () => openMultiplayer(),
  // (Round 62) Where mods are made (`back`: from a playtest).
  workshop: (o = {}) => openWorkshopApp(o),
  party: () => openParty(),
  profile: (p) => openProfile(p),
  settings: () => ui.open(new SettingsWindow(ui, settings)),
  feats: () => openFeats(),
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

// ------------------------------------------------------------ playing together
// Your account (kept in this browser), the game's own server on your
// network (tools/serve.mjs: where it is, and whether anyone's hosting a
// world there), and the world you're hosting or playing in (see net/).
const accounts = new Accounts(browserStorage());
window.__accounts = accounts;
// Your achievements (and the titles they unlock): kept in this browser and
// with your account (see game/achievements.js).
const feats = new FeatBook(browserStorage(), accounts);
accounts.localFeats = () => feats.local;
feats.merge();
window.__feats = feats;

// Something done, worth an achievement: said so.
function featNote(id) {
  const f = FEAT[id];
  if (!f) return;
  audio.play('fanfare');
  ui.notify(`Achievement: ${f.name}. You can now go by the title "${f.title}" (press L).`, null, '#ffe070');
}

// Your achievements, and a title to go by.
function openFeats() {
  if (ui.find('feats')) return;
  ui.open(new FeatsWindow(ui, {
    got: () => feats.got,
    title: () => (accounts.account ? accounts.account.title || '' : ''),
    setTitle: (t) => {
      if (!accounts.account) return false;
      feats.merge();
      accounts.update({ title: t });
      profileChanged(accounts.profile);
      return true;
    },
  }));
}
// Your account and worlds kept with the game's own server too, so they're
// the same whatever address the game is opened at (see net/machine.js).
const machine = new MachineSync({ storage: browserStorage(), accounts, store });
window.__machine = machine;
dbReady.then(() => machine.start()).catch(() => {});
let lan = null;
let lobbyWs = null;
let partyNote = null;
let netT = 0;
let hostSaveT = 0;
const pxCanvas = document.createElement('canvas');

// (`at`: a world hosted elsewhere on the network, { addr, port }, found by
// this copy's own server: see tools/lan.mjs.)
const wsUrl = (at = null) => (at ? `ws://${at.addr}:${at.port}${NET_PATH}` : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${NET_PATH}`);
// Where friends open the game: this machine's best address (and the name
// it answers to, where their computer or phone knows such names).
const addrText = () => (lan && lan.addrs && lan.addrs.length ? `http://${lan.addrs[0]}:${lan.port}` : `http://${location.host}`);
const nameText = () => (lan && lan.mdns ? `http://${lan.mdns}:${lan.port}` : null);
const joinText = () => (nameText() ? `${addrText()} (or ${nameText()})` : addrText());

// What the server says about the network (null: not started with npm start).
function refreshLan() {
  return window.fetch(LAN_PATH, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      lan = j && j.v ? j : null;
      return lan;
    })
    .catch(() => {
      lan = null;
      return null;
    });
}
// (Opened from a friend's machine while they're hosting: straight to the
// world to join.)
refreshLan().then((l) => {
  const visiting = !['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname);
  if (visiting && l && l.host && !game && !session && !params.has('autostart')) openMultiplayer();
});

function relayRefusal(why) {
  return {
    busy: 'Someone else is already hosting a world from this machine.',
    'not this machine': 'Only the computer running the game\'s server can host on it.',
    version: 'The game\'s server is a different version: restart it with "npm start".',
  }[why] || `Couldn't open the world to your network (${why || 'no reason given'}).`;
}

// At the title screen, with an account: told when a world's hosted here,
// and found by a friend's invitation.
function syncLobby() {
  const want = !game && !session && !!accounts.profile && !!lan;
  if (want && !lobbyWs) {
    let ws;
    try {
      ws = new window.WebSocket(wsUrl());
    } catch {
      return;
    }
    lobbyWs = ws;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', v: NET_VERSION, role: 'lobby', account: accounts.profile }));
    ws.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (m.t === 'host' && lan) lan.host = m.host;
      else if (m.t === 'invite' && !ui.find('invite')) {
        ui.open(new InviteWindow(ui, m, (yes) => {
          if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'answer', yes }));
          if (yes) joinWorld();
        }));
      }
    };
    ws.onclose = () => {
      if (lobbyWs === ws) lobbyWs = null;
    };
  } else if (!want && lobbyWs) {
    const ws = lobbyWs;
    lobbyWs = null;
    try {
      ws.close();
    } catch {
      // Gone already.
    }
  }
}

// Each frame: the lobby kept as it should be; a world you host saved now
// and then (everyone's characters in it).
function netTick(dt) {
  netT -= dt;
  if (netT <= 0) {
    netT = 1;
    syncLobby();
  }
  if (session && session.role === 'host' && game && game.slot && game.isParty()) {
    hostSaveT += dt;
    if (hostSaveT > 300) {
      hostSaveT = 0;
      saveTo(game.slot, null, true);
    }
  }
}

// Finished with the world you were hosting or in.
function endSession() {
  const s = session;
  session = null;
  ui.guest = false;
  partyNote = null;
  if (!s) return;
  if (s.role === 'host' && s.net) s.net.close();
  try {
    s.ws.close();
  } catch {
    // Gone already.
  }
}

// ------------------------------------------------------------ your account
function openAccount(onDone = null) {
  if (ui.find('account')) return;
  feats.merge();
  ui.open(new AccountWindow(ui, accounts, { onDone, onChange: (p) => profileChanged(p), titles: () => feats.titles(), onFeats: () => openFeats() }));
}

function needAccount(then) {
  if (accounts.profile) then();
  else openAccount(() => then());
}

// A new picture or new words: everyone you're playing with sees them.
function profileChanged(p) {
  if (!session || !session.net) return;
  if (session.role === 'guest') session.net.setProfile(p);
  else {
    Object.assign(session.net.profile, { icon: p.icon, desc: p.desc, title: p.title || '' });
    session.net.partyChanged();
  }
}

// ------------------------------------------------------------ the title menu
const mpCtx = {
  accounts,
  get lan() {
    return lan;
  },
  get saves() {
    return store.worlds();
  },
  hooks: {
    account: () => openAccount(),
    newWorld: () => newHosted(null),
    seedWorld: () => {
      const v = window.prompt('World seed (number or text):', '');
      if (v === null) return;
      newHosted(/^\d+$/.test(v.trim()) ? parseInt(v.trim(), 10) >>> 0 : hashString(v.trim()));
    },
    continueWorld: (id) => continueHosted(id),
    upgradeWorld: (id, meta) => upgradeSave(id, meta),
    join: (at = null) => joinWorld(at),
    // (Hosted in another version of the game: you can't join it.)
    otherVersion: (w) => ui.open(new ConfirmWindow(ui, 'ANOTHER VERSION', refusal('gameversion', { host: w.gv || null }), null, { yes: 'OK', only: true })),
    deleteWorld: (id) => store.remove(id),
  },
};

function openMultiplayer() {
  refreshLan();
  if (!ui.find('multiplayer')) ui.open(new MultiplayerWindow(ui, mpCtx));
}

// ------------------------------------------------------------ hosting
// A new world to host: what it's called and how it's shared, then your
// character.
function newHosted(seed) {
  needAccount(() => {
    const slot = store.freeWorld();
    if (!slot) {
      ui.notify('You keep three worlds to host: delete one first.');
      return;
    }
    refreshLan().then(() => ui.open(new HostWindow(ui, {
      name: `${accounts.profile.name}'s world`,
      lan,
      onStart: (name) => {
        const s = seed ?? (Math.random() * 2 ** 32) >>> 0;
        pickMods('MODS FOR THIS WORLD', (mods) => ui.open(new CharacterWindow(ui, s, (hero) => startGame(s, null, slot, hero, { host: { name }, mods }))));
      },
    })));
  });
}

// One you've hosted before: everyone's characters as they left them.
function continueHosted(id) {
  needAccount(() => {
    store.load(id).then((data) => {
      if (!data) return ui.notify('That world\'s save is empty.');
      if (!(data.v >= SAVE_VERSION)) return ui.notify('That world is from an older version of the game and can\'t be loaded.');
      const name = (data.party && data.party.world && data.party.world.name) || 'My world';
      return versionCheck(data, () => worldMods(data, (mods) => refreshLan().then(() => ui.open(new HostWindow(ui, { name, lan, onStart: (nm) => startGame(null, data, id, null, { host: { name: nm }, mods }) })))));
    }).catch((e) => ui.notify('Load failed: ' + e.message));
  });
}

// Open the world to the network (through the game's own server).
function beginHosting(g, name) {
  g.partyWorld = { name };
  hostSaveT = 0;
  let ws;
  try {
    ws = new window.WebSocket(wsUrl());
  } catch {
    ui.notify('Couldn\'t reach the game\'s server: playing alone.');
    return;
  }
  const sess = { role: 'host', ws, net: null, world: name, game: g };
  session = sess;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', v: NET_VERSION, role: 'host', account: accounts.profile, world: { name, gv: GAME_VERSION, mods: worldModRefs() }, bans: { ids: g.partyBans && g.partyBans.ids ? g.partyBans.ids : [] } }));
  ws.onmessage = (ev) => {
    if (session !== sess) return;
    const text = String(ev.data);
    if (!sess.net) {
      let m;
      try {
        m = JSON.parse(text);
      } catch {
        return;
      }
      if (m.t === 'hosting') {
        lan = { ...(lan || {}), ...m };
        sess.net = makeHostNet(g, sess);
        ui.notify(`"${name}" is open on your network. Friends on your Wi-Fi join at ${joinText()}`, accounts.profile, '#a0e0ff');
      } else if (m.t === 'refused') {
        ui.notify(relayRefusal(m.why), null, '#ff8070');
        session = null;
        ws.close();
      }
      return;
    }
    sess.net.receive(text);
  };
  ws.onclose = () => {
    if (session !== sess) return;
    session = null;
    if (sess.net) {
      sess.net.close();
      ui.notify('Lost touch with the game\'s server: the others were sent home. Your world goes on.', null, '#ffb080');
    } else ui.notify('Couldn\'t open the world to your network: is the game running from "npm start"?', null, '#ffb080');
  };
}

// (Round 62) The mods of the world in play: what a joining player needs.
function worldModRefs() {
  return MODS.active.map((m) => ({ id: m.id, hash: m.hash, name: m.name, version: m.version, author: m.author || '', color: m.color || null }));
}

function makeHostNet(g, sess) {
  const send = (text) => {
    if (sess.ws.readyState === 1) sess.ws.send(text);
  };
  const net = new HostNet(g, {
    send,
    profile: accounts.profile,
    world: { name: sess.world, mods: worldModRefs() },
    bans: g.partyBans,
    // (A mod of the world's, for someone joining without it.)
    packText: (hash) => modLib.packText(hash),
    makeUI: (guest) => guestUI(guest),
    notify: (text, profile) => ui.notify(text, profile),
    onParty: (list) => {
      for (const p of list || []) if (accounts.isFriend(p.id)) accounts.refreshFriend(p);
    },
  });
  net.setPixels((w) => windowPixels(w, g, pxCanvas, performance.now()));
  net.hostFriend = (msg) => friendWord(msg);
  send(toRelay({ t: 'lobby?' }));
  return net;
}

// A player's own windows, kept here: their sounds and words go to them.
function guestUI(guest) {
  const gu = new UI({
    ctx: null,
    play: (name) => {
      if (guest.fx && guest.fx.length < 400) guest.fx.push(['sound', [name, null]]);
    },
  });
  gu.showHud = true;
  gu.hudP = 1;
  gu.remoteSeat = true;
  gu.hooks = {};
  gu.msg = (text, color, merge) => (guest.msgs ||= []).push([text, color, merge ? 1 : 0]);
  return gu;
}

// ------------------------------------------------------------ joining
// The world hosted at this address: in you go (a character first, if it's
// your first time there).
function joinWorld(at = null) {
  needAccount(() => {
    endSession();
    let ws;
    try {
      ws = new window.WebSocket(wsUrl(at));
    } catch {
      ui.notify('Couldn\'t reach the game\'s server.');
      return;
    }
    const sess = { role: 'guest', ws, net: null };
    session = sess;
    showLoading('Joining...');
    const net = new GuestNet({
      send: (text) => {
        if (ws.readyState === 1) ws.send(text);
      },
      profile: accounts.profile,
      build: (save) => buildGuestGame(save, sess),
      onNeedHero: (m) => {
        hideLoading();
        let done = false;
        ui.notify(`Make your character for "${m.world}", hosted by ${m.host ? m.host.name : 'someone'}.`, m.host || null);
        const s = (Math.random() * 2 ** 32) >>> 0;
        const cw = new CharacterWindow(ui, s, (hero) => {
          done = true;
          net.sendHero(hero);
          showLoading(`Joining "${m.world}"...`);
        });
        // (Backed out: not joining after all.)
        cw.onClose = () => setTimeout(() => {
          if (!done && session === sess) leaveWorld(null);
        }, 0);
        ui.open(cw);
      },
      onNote: (text, profile) => ui.notify(text, profile),
      onParty: (list) => {
        for (const p of list || []) if (accounts.isFriend(p.id)) accounts.refreshFriend(p);
      },
      onFriend: (msg) => friendWord(msg),
      onEnd: (why, title) => leaveWorld(why, title),
    });
    // (Round 62) The world's mods: had (on we go), or offered, got from the
    // host, kept, and on we go.
    net.onMods = (m) => guestMods(net, sess, m);
    // (Something you did in their world, worth an achievement: yours.)
    net.onFeat = (id) => {
      if (feats.unlock(id)) featNote(id);
    };
    sess.net = net;
    // (How often the host's to send word: see the settings.)
    net.rate = settings.netRate === 1 ? 10 : 20;
    net.openPause = () => openGuestPause();
    net.onLocalKey = (k) => guestKey(k);
    net.onProfile = (p) => openProfile(p);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', v: NET_VERSION, gv: GAME_VERSION, role: 'guest', account: accounts.profile }));
    ws.onmessage = (ev) => {
      if (session === sess) net.receive(String(ev.data));
    };
    ws.onclose = () => {
      if (session === sess) leaveWorld('Lost the connection to the host.');
    };
  });
}

// (Round 62) Joining a world with mods: those you have, used; those you
// haven't, asked about, then sent by the host and kept in your library.
async function guestMods(net, sess, m) {
  const refs = m.mods || [];
  const want = refs.filter((r) => !modLib.hasPack(r.hash));
  const ready = async () => {
    const mods = [];
    for (const r of refs) {
      const mod = await modLib.getPack(r.hash);
      if (!mod) return leaveWorld(`Couldn't get the mod "${r.name}" from the host.`);
      mods.push(mod);
    }
    sess.mods = mods;
    net.modsReady();
    return null;
  };
  if (!want.length) return ready();
  hideLoading();
  const by = m.host ? m.host.name : 'its host';
  const list = want.map((r) => `"${r.name}" (v${r.version}${r.author ? `, by ${r.author}` : ''})`).join(', ');
  const them = want.length > 1 ? 'them' : 'it';
  ui.open(new ConfirmWindow(ui, 'THIS WORLD HAS MODS', `"${m.world}" is played with ${refs.length > 1 ? `${refs.length} mods` : 'a mod'}. You haven't got ${want.length > 1 ? 'these' : 'this one'}: ${list}. Install ${them} from ${by} and join? (Kept in your Workshop library after.)`, async () => {
    showLoading('Installing mods...');
    for (const r of want) {
      const text = await net.requestPack(r.hash);
      if (session !== sess) return;
      if (!text) {
        leaveWorld(`The host couldn't send the mod "${r.name}".`);
        return;
      }
      try {
        await modLib.addPack(text, { from: by });
      } catch (e) {
        leaveWorld(`The mod "${r.name}" couldn't be installed: ${e.message || e}`);
        return;
      }
    }
    ui.notify(`Installed ${want.length > 1 ? `${want.length} mods` : `"${want[0].name}"`}: they're in your Workshop library now.`, null, '#80e070');
    showLoading(`Joining "${m.world}"...`);
    ready();
  }, { yes: 'Install mods & join', no: 'Not now', onNo: () => leaveWorld(null) }));
  return null;
}

// The copy of the host's world on your screen (see net/guest.js).
function buildGuestGame(save, sess) {
  ui.closeAll();
  ui.messages = [];
  // (Round 62) The world's mods in first, their blocks numbered as the
  // host's are.
  setMods(sess.mods || [], save);
  const g = new Game({ seed: save.seed, renderer, audio, ui, save, hero: null, intro: false, remote: true });
  g.crt = crt;
  g.slot = null;
  g.autosave = () => {};
  game = g;
  window.__game = g;
  renderer.camInit = false;
  ui.showHud = true;
  ui.hudP = 0;
  ui.lastSettlement = undefined;
  ui.guest = true;
  ui.imageFor = avatarFromKey;
  hideLoading();
  setTimeout(() => {
    if (session !== sess || !sess.net) return;
    const n = sess.net;
    ui.notify(`Welcome to "${(n.worldInfo && n.worldInfo.name) || 'the world'}", hosted by ${n.hostProfile ? n.hostProfile.name : 'someone'}.`, n.hostProfile || null, '#a0e0ff');
  }, 0);
  return g;
}

// (`title`: said in a window of its own, to be read and dismissed, rather
// than a notice at the side: see GuestNet's refusals.)
function leaveWorld(why, title = null) {
  const sess = session;
  session = null;
  ui.guest = false;
  if (sess) {
    try {
      sess.ws.close();
    } catch {
      // Gone already.
    }
  }
  hideLoading();
  game = null;
  uninstallMods();
  ui.showHud = false;
  ui.closeAll();
  ui.messages = [];
  ui.open(new TitleWindow(ui, store));
  if (why && title) ui.open(new ConfirmWindow(ui, title, why, null, { yes: 'OK', only: true }));
  else if (why) ui.notify(why, null, '#ffb080');
}

// In someone else's world, your own pause (the world goes on).
function openGuestPause() {
  if (ui.find('pause')) return;
  ui.open(new GuestPauseWindow(ui, {
    party: () => openParty(),
    account: () => openAccount(),
    settings: () => ui.open(new SettingsWindow(ui, settings)),
    help: () => ui.open(new HelpWindow(ui)),
    leave: () => leaveWorld(null),
  }));
}

// Keys that are your own screen's business in someone else's world.
function guestKey(k) {
  if (k.code === 'KeyH' || k.code === 'F1') ui.toggle('help', () => new HelpWindow(ui));
  else if (k.code === 'KeyM') ui.toggle('map', () => new MapWindow(ui));
  else if (k.code === 'KeyP') openParty();
  else if (k.code === 'KeyL') {
    const w = ui.find('feats');
    if (w) ui.close(w);
    else openFeats();
  } else if (k.code === 'F2') ui.hooks.toggleCrt();
  else if (k.code === 'F3') ui.debug = !ui.debug;
  // The command console: if the host has let you (see the Multiplayer
  // window's Permissions).
  else if (k.code === 'Backquote' || k.code === 'Slash') {
    const net = session && session.net;
    if (net && net.canCommand && net.canCommand()) ui.toggle('console', () => new ConsoleWindow(ui));
    else ui.msg('The host hasn\'t let you use commands in this world.', '#ffb080');
  }
}

// ------------------------------------------------------------ the party
function partyList() {
  if (!session || !session.net) return [];
  return session.role === 'host' ? session.net.partyList() : session.net.party || [];
}

function partyCtx() {
  const a = accounts.account || { id: null, friends: [], incoming: [] };
  const host = !!session && session.role === 'host';
  const net = session && session.net;
  return {
    me: a.id,
    host,
    world: host ? session.world : net && net.worldInfo ? net.worldInfo.name : 'this world',
    hostName: net && net.hostProfile ? net.hostProfile.name : null,
    addrs: lan && lan.addrs ? lan.addrs.map((x) => `${x}:${lan.port}`) : [],
    mdns: lan && lan.mdns ? `${lan.mdns}:${lan.port}` : null,
    party: partyList(),
    bans: host && net ? net.bannedList() : [],
    friends: a.friends,
    requests: a.incoming,
    lobby: host && net ? net.lobby : [],
    note: partyNote,
    // (Whether players may hurt each other: the host's to say.)
    pvp: host ? !!(game && game.pvp) : !!(net && net.pvp),
    // The world's guilds (see game/guilds.js).
    guilds: host ? (game && game.guilds ? game.guilds.summary() : []) : (net && net.guilds) || [],
    hooks: {
      guild: (op, args = {}) => guildOp(op, args),
      foundGuild: () => ui.open(new GuildNameWindow(ui, (name) => guildOp('create', { name }))),
      pvp: () => host && net && net.setPvp(!game.pvp),
      profile: (p) => openProfile(p),
      kick: (p) => net && net.kick(p.cid),
      // What a player may do beyond playing (the host's to say).
      perms: (p) => host && net && openPerms(p),
      ban: (p) => net && net.ban(p.cid),
      unban: (id) => net && net.unban(id),
      invite: (f) => {
        if (!net) return;
        if (net.lobby.some((q) => q.id === f.id)) {
          net.invite(f);
          partyNote = `Invitation sent to ${f.name}.`;
        } else partyNote = `${f.name} isn't at the title screen here: ask them to open ${joinText()} and choose Multiplayer.`;
      },
      answer: (id, yes) => answerFriend(id, yes),
      account: () => openAccount(),
      leave: () => leaveWorld(null),
    },
  };
}

// A player's permissions, for the host to change (see HostNet.setPerm).
function openPerms(p) {
  const old = ui.find('perms');
  if (old) ui.close(old);
  const net = session && session.net;
  if (!net || session.role !== 'host') return;
  ui.open(new PermsWindow(ui, p, PERMS, () => net.permsOf(p.id), (key, on) => net.setPerm(p.id, key, on)));
}

// A guild's doings: the host does them; a player asks the host.
function guildOp(op, args = {}) {
  if (!session || !session.net) return;
  if (session.role === 'host') session.net.guildOp(accounts.profile, { op, ...args });
  else session.net.guild(op, args);
}

function openParty() {
  if (!session || !session.net || ui.find('party')) return;
  partyNote = null;
  ui.open(new PartyWindow(ui, partyCtx));
  if (session.role === 'host') session.net.send(toRelay({ t: 'lobby?' }));
}

// Someone's profile (as they are now), and a friend request.
function openProfile(p) {
  if (!p || !p.id) return;
  const live = partyList().find((q) => q.id === p.id) || profileOf(p);
  const old = ui.find('profile');
  if (old) ui.close(old);
  ui.open(new ProfileWindow(ui, live, () => ({
    me: accounts.profile ? accounts.profile.id : null,
    friend: accounts.isFriend(live.id),
    sent: accounts.hasSent(live.id),
    asked: !!(accounts.account && accounts.account.incoming.some((r) => r.id === live.id)),
    // (A bout: with someone else in this world.)
    bout: !!session && !!session.net && !!game && partyList().some((q) => q.id === live.id),
    hooks: {
      request: (q) => sendFriendRequest(q),
      accept: (q) => answerFriend(q.id, true),
      edit: () => openAccount(),
      bout: (q, wager) => {
        if (!session || !session.net) return;
        if (session.role === 'host') challengeBout(game, game.seat, q.id, wager);
        else session.net.bout(q.id, wager);
      },
    },
  })));
}

// ------------------------------------------------------------ friends
function friendSend(to, yes) {
  if (!session || !session.net) return;
  if (session.role === 'host') session.net.sendFriend(to, yes);
  else session.net.friend(to, yes);
}

function sendFriendRequest(q) {
  if (!accounts.sentRequest(q)) return;
  friendSend(q.id, undefined);
  ui.notify(`Friend request sent to ${q.name}.`, q);
}

function answerFriend(id, yes) {
  const r = accounts.answer(id, yes);
  if (!r) return;
  friendSend(id, !!yes);
  if (yes) ui.notify(`You and ${r.name} are now friends.`, r, '#80e070');
}

// A friend request, or the answer to yours.
function friendWord(msg) {
  const from = profileOf(msg.from);
  if (!from || !from.id) return;
  if (msg.yes === undefined || msg.yes === null) {
    const mine = accounts.hasSent(from.id);
    if (accounts.gotRequest(from)) ui.notify(`${from.name} sent you a friend request. Right-click them, or press P, to answer.`, from, '#a0e0ff');
    else if (mine && accounts.isFriend(from.id)) ui.notify(`You and ${from.name} are now friends.`, from, '#80e070');
  } else if (accounts.hasSent(from.id)) {
    if (msg.yes) {
      accounts.befriend(from);
      ui.notify(`${from.name} accepted your friend request.`, from, '#80e070');
    } else {
      accounts.dropSent(from.id);
      ui.notify(`${from.name} declined your friend request.`, from);
    }
  }
}

// ------------------------------------------------------------ the Workshop
// (Round 62) Where mods are made: opened over the game (see workshop/).
let workshop = null;
let playReturn = null;
async function openWorkshopApp(o = {}) {
  if (workshop) return;
  // (From a playtest: that world's let go, and you're back where you were.)
  if (o.back && game && game.playtest) {
    playReturn = game.playtest;
    endSession();
    game = null;
    uninstallMods();
    ui.showHud = false;
  }
  ui.closeAll();
  showLoading('Opening the Workshop...');
  await dbReady.catch(() => {});
  const { openWorkshop } = await import('./workshop/app.js');
  hideLoading();
  input.paused = true;
  screen.style.display = 'none';
  workshop = openWorkshop({
    library: modLib,
    author: accounts.profile ? accounts.profile.name : 'Someone',
    audio,
    openMod: playReturn ? playReturn.modId : null,
    openTool: playReturn ? playReturn.tool : null,
    openSel: playReturn ? playReturn.sel : null,
    onExit: () => closeWorkshop(),
    onPlaytest: (mod, where) => {
      workshop = null;
      input.paused = false;
      screen.style.display = '';
      playtest(mod, where);
    },
  });
  window.__workshop = workshop;
  playReturn = null;
}
function closeWorkshop() {
  workshop = null;
  input.paused = false;
  screen.style.display = '';
  resize();
  ui.closeAll();
  ui.open(new TitleWindow(ui, store));
}

// A mod tried out: a world of its own (the same one each time, for that
// mod), everything the mod adds in your pack.
function playtest(mod, where = {}) {
  let seed = (Math.random() * 2 ** 32) >>> 0;
  try {
    const k = `ws-test-seed-${mod.id}`;
    const had = +localStorage.getItem(k);
    if (had > 0) seed = had >>> 0;
    else localStorage.setItem(k, String(seed));
  } catch {
    // A new one each time, then.
  }
  const hero = { ...randomHero(seed), origin: 'native', name: 'Tester' };
  startGame(seed, null, null, hero, { mods: [mod], playtest: { modId: mod.id, name: mod.name, tool: where.tool || null, sel: where.sel || null } });
}

// A flat bit of open country near you, out of any town, for a structure
// being playtested (its middle, at its ground).
function playtestSpot(g, st) {
  const p = g.player;
  const w = g.world;
  const hw = Math.ceil(st.w / 2) + 1;
  const hd = Math.ceil(st.d / 2) + 1;
  for (let r = 10; r <= 60; r += 6) for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const x = Math.round(p.x + Math.cos(a) * r);
    const z = Math.round(p.z + Math.sin(a) * r * 0.7);
    const pts = [[x, z], [x - hw, z - hd], [x + hw, z - hd], [x - hw, z + hd], [x + hw, z + hd], [x, z + hd + 2]];
    let lo = 99;
    let hi = -1;
    let ok = true;
    for (const [qx, qz] of pts) {
      if (!w.topAt(qx, qz) || w.ow.settlementAt(qx, qz)) {
        ok = false;
        break;
      }
      const y = w.findStandY(qx, qz, Math.floor(p.y));
      if (y < 1 || w.isWaterAt(qx, y, qz) || w.isWaterAt(qx, y - 1, qz)) {
        ok = false;
        break;
      }
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    if (ok && hi - lo <= 2) return { x, y: lo, z };
  }
  return null;
}

function beginPlaytest(g, pt) {
  g.playtest = pt;
  g.cheats = { ...(g.cheats || {}), console: true };
  const p = g.player;
  // What the mod adds, in your pack (a stack of each block, the rest one
  // each).
  const keys = Object.keys(ITEMS).filter((k) => k.startsWith(`m:${pt.modId}:`));
  let n = 0;
  for (const k of keys) {
    const it = ITEMS[k];
    const left = p.give(k, it.kind === 'block' ? 16 : it.kind === 'food' || it.kind === 'material' ? 4 : 1);
    if (!left) n++;
  }
  ui.notify(`Playtesting "${pt.name}". ${n ? `Its ${n} item${n > 1 ? 's are' : ' is'} in your pack.` : 'It adds no items.'} Press ESC, then W, to go back to the Workshop. The console (\` or /) has "mod" commands: try "mod help".`, null, '#80e070');
  const ev = MODS.events.length;
  if (ev) ui.msg(`(${ev} world event${ev > 1 ? 's' : ''} of the mod's at work.)`, '#a0c8ff');
  // What was open in the Workshop, right here: a structure built in front
  // of you, a dungeon gone straight down into, a creature beside you.
  const sel = pt.sel;
  const mod = MODS.byId.get(pt.modId);
  if (!sel || !mod) return;
  if (sel.kind === 'structures' && mod.structures[sel.id]) {
    const st = mod.structures[sel.id];
    const at = playtestSpot(g, st) || { x: Math.round(p.x), y: Math.floor(p.y), z: Math.round(p.z) + 3 + Math.floor(st.d / 2) };
    const put = MODS.placeStructure(g, mod, sel.id, at, { level: true, marks: true });
    // (You, at its front, looking at it.)
    const fz = put.z0 + st.d + 1;
    const fy = g.world.findStandY(at.x, fz, at.y);
    if (fy > 0) p.teleport(at.x, fy, fz);
    ui.msg(`"${st.name}" is built here, in front of you.`, '#80e070');
  } else if (sel.kind === 'dungeons') {
    const rec = g.sim && g.sim.dungeons.all.find((d) => d.mod === pt.modId && d.thing === sel.id);
    if (rec) {
      rec.known = true;
      g.runFor(rec).enter();
    } else ui.msg('That dungeon found no place in this world (is "How many" 0, or its biomes ones this island hasn\'t?).', '#ffb080');
  } else if (sel.kind === 'stories') {
    const th = MODS.startStory?.(g, mod, sel.id, { player: p, pos: { x: p.x, z: p.z } });
    ui.msg(th ? `"${th.title}" has begun (see your journal, and the notice board in ${g.world.ow.settlements[th.sid]?.name || 'town'}).` : 'The story couldn\'t begin here: is there a town near with the people it needs?', th ? '#80e070' : '#ffb080');
  } else if (sel.kind === 'entities') {
    const sp = `m:${pt.modId}:${sel.id}`;
    if (MODS.species && MODS.species(sp)) {
      const s = g.findFreeSpot(Math.round(p.x) + 3, Math.round(p.z), Math.floor(p.y));
      g.spawnMonster(sp, s.x, s.y, s.z);
      ui.msg('It\'s here, just east of you.', '#80e070');
    }
  } else if (sel.kind === 'biomes' && mod.biomes[sel.id]) {
    // (Round 63) The nearest of it: you, in the middle of it.
    const b = mod.biomes[sel.id];
    const key = b.change || `m:${pt.modId}:${sel.id}`;
    const ow = g.world.ow;
    const pcx = Math.floor(p.x / REGION_W);
    const pcz = Math.floor(p.z / REGION_D);
    let best = null;
    for (const c of ow.liveCells) {
      if (c.biome !== key || c.settlement !== null) continue;
      // (Well into it: its neighbours it too.)
      const deep = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => ow.cell(c.cx + dx, c.cz + dz)?.biome === key).length;
      const d = Math.hypot(c.cx - pcx, (c.cz - pcz) * 1.5) - deep * 2;
      if (!best || d < best.d) best = { c, d };
    }
    if (!best) ui.msg(`"${b.title || b.name}" grows nowhere in this world${b.place && b.place.how === 'painted' ? ' (it only grows where it\'s painted on a world map)' : ' (is its climate one this island has?)'}.`, '#ffb080');
    else {
      const x = Math.floor((best.c.cx + 0.5) * REGION_W);
      const z = Math.floor((best.c.cz + 0.5) * REGION_D);
      g.loadAround(x, z, true);
      const s = g.findFreeSpot(x, z, 6);
      p.teleport(s.x, s.y, s.z);
      p.spawn = { ...s };
      renderer.camInit = false;
      ow.markExplored(s.x, s.z, 1);
      ui.msg(`In the ${b.title || b.name}.`, '#80e070');
    }
  }
}

// (For testing from the console.)
window.__mp = { accounts, joinWorld, newHosted, openParty, session: () => session, lan: () => lan, refreshLan };

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
  // (Capped at 30 a second, in the settings: every other frame let go.)
  if (settings.frameCap && now - last < 1000 / 30 - 4) return;
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
  // (Round 62) The Workshop open over the game: nothing to draw here.
  if (workshop) {
    input.consume();
    try {
      music.update(dt, 'title', false);
    } catch {
      // Not now.
    }
    return;
  }
  netTick(dt);
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
    // (Something on the HUD gone wrong mustn't leave the screen standing
    // still: the world's still drawn, and the rest of the frame goes on.)
    try {
      ui.render(ctx, game, fps);
    } catch (e) {
      if (!step.uiErr || now - step.uiErr > 1000) console.error(e);
      step.uiErr = now;
    }
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
    music.update(dt, game ? musicMood(game) : 'title', moodUrgent(game));
  } catch (e) {
    if (!step.musicErr) console.error(e);
    step.musicErr = true;
  }
  const t4 = performance.now();
  // (The camera drawn back: the world goes to the screen on its own, finer.)
  crt.world = game ? renderer.layer || null : null;
  crt.present(now / 1000);
  perf.crt = (perf.crt || 0) * 0.95 + (performance.now() - t4) * 0.05;
}
requestAnimationFrame(frame);

// Hosting with the game's tab in the background: the browser stops drawing
// it, but the others are still playing, so the world's kept going by a
// timer (in steps, catching up), without being drawn.
window.setInterval(() => {
  if (!document.hidden || !session || session.role !== 'host' || !game) return;
  const now = performance.now();
  try {
    for (let n = 0; n < 40 && now - last > 50; n++) {
      last += 50;
      netTick(0.05);
      game.update(0.05, input);
      ui.update(0.05, game);
    }
  } catch (e) {
    console.error(e);
  }
  last = Math.max(last, now - 50);
}, 200);

export { HelpWindow };
