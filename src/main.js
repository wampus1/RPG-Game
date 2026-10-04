// Entry point: sets up the canvases, CRT pass, UI and the main loop.
import { VIEW_W, VIEW_H } from './config.js';
import { CRT } from './render/crt.js';
import { Renderer } from './render/renderer.js';
import { Input } from './game/input.js';
import { Audio } from './game/audio.js';
import { Game, SAVE_VERSION } from './game/game.js';
import { UI } from './ui/ui.js';
import { TitleWindow, HelpWindow, SaveSlotsWindow, SettingsWindow } from './ui/windows.js';
import { loadSettings, saveSettings, applySettings } from './game/settings.js';
import { hashString } from './util/rng.js';
import { SaveStore, openSaveDB } from './game/saves.js';
import { CharacterWindow } from './ui/create.js';
import { randomHero } from './game/hero.js';
import { Music, musicMood, moodUrgent } from './game/music.js';
import { Accounts, profileOf } from './net/account.js';
import { HostNet } from './net/host.js';
import { GuestNet } from './net/guest.js';
import { NET_PATH, LAN_PATH, NET_VERSION, toRelay } from './net/protocol.js';
import { windowPixels } from './net/uiwire.js';
import { AccountWindow, MultiplayerWindow, HostWindow, PartyWindow, ProfileWindow, GuestPauseWindow, InviteWindow } from './ui/multiplayer.js';
import { MapWindow } from './ui/worldmap.js';
import { avatarFromKey } from './render/avatar.js';

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
ui.music = music;
const input = new Input(screen, crt);
window.__input = input;
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
// Games are kept in IndexedDB once it's open (it has room for many more
// than browser storage's few megabytes); ask for it to be kept for good.
openSaveDB().then((db) => {
  store.db = db;
});
try {
  window.navigator.storage?.persist?.();
} catch {
  // Not offered here.
}
// Volumes and visuals, as the player left them.
const settings = loadSettings(browserStorage());
const applyAll = () => applySettings(settings, { audio, music, crt, renderer, ui });
applyAll();

// Save into a slot; says so (or why it couldn't).
function saveTo(id, note, quiet = false) {
  if (!game) return false;
  const g = game;
  // (Not in the middle of the opening scene: there's nothing to keep yet.)
  if (g.cutscene) {
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
      if (note) ui.msg(note, '#80e070');
      if (!quiet) audio.play('save');
      return true;
    }, fail);
  } catch (e) {
    return fail(e);
  }
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
    startGame(null, data, id);
  }).catch((e) => ui.msg('Load failed: ' + e.message, '#ff5a50'));
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
    // ?nointro goes straight in.)
    // (A world for others starts with everyone on the island: no opening
    // scene.)
    game = new Game({ seed: s, renderer, audio, ui, save, hero, intro: !!hero && !params.has('nointro') && !opts.host });
    game.crt = crt;
    game.slot = slot && slot !== 'auto' ? slot : null;
    game.autosave = () => saveTo(game.partyWorld && game.slot ? game.slot : 'auto', `Autosaved (day ${game.day}, 7:00).`);
    if (params.has('time') && !save) game.minute = parseInt(params.get('time'), 10);
    renderer.camInit = false;
    ui.showHud = !game.cutscene;
    ui.hudP = 0;
    ui.lastSettlement = undefined;
    hideLoading();
    if (!save && !hero) ui.msg(`Welcome to the world of seed ${s}.`, '#ffe070');
    if (!game.cutscene) ui.msg('Press H for help.', '#a0c8ff');
    console.log(`world ready in ${(performance.now() - t0).toFixed(0)}ms`);
    window.__game = game;
    if (params.has('goto')) window.__goto(params.get('goto'));
    if (params.has('reveal')) game.revealMap = true;
    if (opts.host) beginHosting(game, opts.host.name);
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
    // (A world you host is kept in its own place.)
    if (game.partyWorld && game.slot) {
      saveTo(game.slot, `"${game.partyWorld.name}" saved.`);
      ui.closeAll();
      return;
    }
    ui.open(new SaveSlotsWindow(ui, 'save', store));
  },
  load: () => ui.open(new SaveSlotsWindow(ui, 'load', store)),
  saveSlot: (id) => {
    const ok = saveTo(id, `Game saved to slot ${id}.`);
    if (ok) ui.closeAll();
    return !!ok;
  },
  loadSlot: (id) => loadFrom(id),
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
  newWorld: () => {
    endSession();
    game = null;
    ui.showHud = false;
    ui.closeAll();
    newGame(null);
  },
  title: () => {
    // (Closing a world you host: kept as it is, everyone's character in it.)
    if (game && game.partyWorld && game.slot && !ui.guest) saveTo(game.slot, null, true);
    endSession();
    game = null;
    ui.showHud = false;
    ui.closeAll();
    ui.open(new TitleWindow(ui, store));
  },
  multiplayer: () => openMultiplayer(),
  party: () => openParty(),
  profile: (p) => openProfile(p),
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

// ------------------------------------------------------------ playing together
// Your account (kept in this browser), the game's own server on your
// network (tools/serve.mjs: where it is, and whether anyone's hosting a
// world there), and the world you're hosting or playing in (see net/).
const accounts = new Accounts(browserStorage());
window.__accounts = accounts;
let lan = null;
let lobbyWs = null;
let session = null;
let partyNote = null;
let netT = 0;
let hostSaveT = 0;
const pxCanvas = document.createElement('canvas');

const wsUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${NET_PATH}`;
const addrText = () => (lan && lan.addrs && lan.addrs.length ? `http://${lan.addrs[0]}:${lan.port}` : `http://${location.host}`);

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
refreshLan();

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
  ui.open(new AccountWindow(ui, accounts, { onDone, onChange: (p) => profileChanged(p) }));
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
    Object.assign(session.net.profile, { icon: p.icon, desc: p.desc });
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
    join: () => joinWorld(),
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
        ui.open(new CharacterWindow(ui, s, (hero) => startGame(s, null, slot, hero, { host: { name } })));
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
      return refreshLan().then(() => ui.open(new HostWindow(ui, { name, lan, onStart: (nm) => startGame(null, data, id, null, { host: { name: nm } }) })));
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
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', v: NET_VERSION, role: 'host', account: accounts.profile, world: { name }, bans: { ids: g.partyBans && g.partyBans.ids ? g.partyBans.ids : [] } }));
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
        ui.notify(`"${name}" is open on your network. Friends on your Wi-Fi join at ${addrText()}`, accounts.profile, '#a0e0ff');
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

function makeHostNet(g, sess) {
  const send = (text) => {
    if (sess.ws.readyState === 1) sess.ws.send(text);
  };
  const net = new HostNet(g, {
    send,
    profile: accounts.profile,
    world: { name: sess.world },
    bans: g.partyBans,
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
function joinWorld() {
  needAccount(() => {
    endSession();
    let ws;
    try {
      ws = new window.WebSocket(wsUrl());
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
      onEnd: (why) => leaveWorld(why),
    });
    sess.net = net;
    net.openPause = () => openGuestPause();
    net.onLocalKey = (k) => guestKey(k);
    net.onProfile = (p) => openProfile(p);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', v: NET_VERSION, role: 'guest', account: accounts.profile }));
    ws.onmessage = (ev) => {
      if (session === sess) net.receive(String(ev.data));
    };
    ws.onclose = () => {
      if (session === sess) leaveWorld('Lost the connection to the host.');
    };
  });
}

// The copy of the host's world on your screen (see net/guest.js).
function buildGuestGame(save, sess) {
  ui.closeAll();
  ui.messages = [];
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

function leaveWorld(why) {
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
  ui.showHud = false;
  ui.closeAll();
  ui.messages = [];
  ui.open(new TitleWindow(ui, store));
  if (why) ui.notify(why, null, '#ffb080');
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
  else if (k.code === 'F2') ui.hooks.toggleCrt();
  else if (k.code === 'F3') ui.debug = !ui.debug;
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
    party: partyList(),
    bans: host && net ? net.bannedList() : [],
    friends: a.friends,
    requests: a.incoming,
    lobby: host && net ? net.lobby : [],
    note: partyNote,
    hooks: {
      profile: (p) => openProfile(p),
      kick: (p) => net && net.kick(p.cid),
      ban: (p) => net && net.ban(p.cid),
      unban: (id) => net && net.unban(id),
      invite: (f) => {
        if (!net) return;
        if (net.lobby.some((q) => q.id === f.id)) {
          net.invite(f);
          partyNote = `Invitation sent to ${f.name}.`;
        } else partyNote = `${f.name} isn't at the title screen here: ask them to open ${addrText()} and choose Multiplayer.`;
      },
      answer: (id, yes) => answerFriend(id, yes),
      account: () => openAccount(),
      leave: () => leaveWorld(null),
    },
  };
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
    hooks: {
      request: (q) => sendFriendRequest(q),
      accept: (q) => answerFriend(q.id, true),
      edit: () => openAccount(),
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
