// Hosting a world (on the LAN: see tools/relay.mjs). The host's browser
// keeps the one true world and runs all of it, as ever, with a seat in it
// for each player who joins (see game/party.js). Each player sends what
// they press, click and point at; this does it for them, as them, and
// sends back what they'd see: the things about them (who's where, doing
// what), the ground (whole, then every block that changes), what flashes
// and sounds, their own windows, their own state. So there's one world,
// and everyone sees the same one: the same wolf in the same place,
// going for one of you; the same block where someone set it.
import { openEnvelope, toPlayer, toRelay, MAX_PLAYERS } from './protocol.js';
import { asSeat, seatMap } from '../game/party.js';
import { enc, diffFields, packEntity } from './wire.js';
import { uiFrame } from './uiwire.js';
import { profileOf, cleanIcon, cleanDesc, cleanTitle } from './account.js';
import { BLOCKS } from '../world/blocks.js';
import { REGION_W, REGION_D } from '../config.js';
import { inReach } from '../entities/footprint.js';
import { challengeBout } from '../game/bout.js';
import { guildMates } from '../game/guilds.js';
import { runCommand } from '../game/commands.js';
import { packShip, shipById } from '../game/ships3d.js';
import { REACH } from '../config.js';

// How often each player is sent what's changed (a second's worth), and how
// far about them (in paces) the things they're sent are.
const RATE = 20;
const VIEW = 30;
// (Effects further off than this aren't worth sending.)
const FX_NEAR = 34;

// What a host can let a player do (round 57: the Permissions button in
// the Multiplayer window). `told`: how the player's told of it.
export const PERMS = [
  { key: 'commands', label: 'Use commands', about: 'The command console (the ` or / key): teleporting, items, the time of day, skipping days... as the host can.', told: 'use commands (the ` key)' },
];

// What a player has pressed, clicked and pointed at, as last sent.
export class RemoteInput {
  constructor() {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, rdown: false, inside: false };
    this.pressed = [];
    this.clicks = [];
    this.wheel = 0;
    this.wheelShift = false;
    this.lastMoveKey = null;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  consume() {
    const out = { pressed: this.pressed, clicks: this.clicks, wheel: this.wheel, wheelShift: this.wheelShift };
    this.pressed = [];
    this.clicks = [];
    this.wheel = 0;
    return out;
  }

  apply(m) {
    // (The camera and the like are each screen's own: never done here.)
    if (m.p) m.p = m.p.filter((k) => k && !HOST_IGNORES.has(k.code));
    if (m.k) this.keys = new Set(m.k);
    if (m.m) Object.assign(this.mouse, m.m);
    if (m.p) this.pressed.push(...m.p.slice(0, 32));
    if (m.c) this.clicks.push(...m.c.slice(0, 32));
    if (m.w) this.wheel += Math.max(-10, Math.min(10, m.w));
    if (m.ws !== undefined) this.wheelShift = !!m.ws;
    if (m.lk) this.lastMoveKey = m.lk;
  }
}

// (Each screen's own picture, and the console: never for a player.)
const HOST_IGNORES = new Set(['F2', 'F3', 'Backquote', 'Slash']);

const regionKeyOf = (x, z) => `${Math.floor(x / REGION_W)},${Math.floor(z / REGION_D)}`;

export class HostNet {
  // `send`: words to the relay; `profile`: the host's account; `world`:
  // what the world's called; `makeUI(guest)`: a player's own windows (kept
  // here); `notify(text, profile)`: tell the host something.
  // (Round 62) `packText(hash)`: one of the world's mods, as a file's text
  // (for a player joining without it), promised.
  constructor(game, { send, profile, world = {}, makeUI, bans = null, notify = null, onParty = null, packText = null }) {
    this.game = game;
    this.packText = packText;
    this.send = send;
    this.profile = profileOf(profile);
    this.world = world;
    this.makeUI = makeUI;
    this.notify = notify || (() => {});
    this.onParty = onParty || (() => {});
    this.guests = new Map(); // cid -> guest
    this.bans = { ids: new Set(bans && bans.ids ? bans.ids : []), names: new Map((bans && bans.names) || []) };
    this.lobby = [];
    this.acc = 0;
    this.mute = 0;
    this.inst = null;
    game.net = this;
    game.startParty(this.profile);
    this.hook();
    this.tellRelay();
  }

  // ------------------------------------------------------------ the relay
  receive(text) {
    const m = openEnvelope(text);
    if (m.ctl) return this.control(m.ctl);
    const g = this.guests.get(m.cid);
    if (!g) return;
    let msg;
    try {
      msg = JSON.parse(m.body);
    } catch {
      return;
    }
    this.fromGuest(g, msg);
  }

  control(c) {
    if (c.t === 'join') this.join(c);
    else if (c.t === 'left') this.left(c.cid);
    else if (c.t === 'lobby') this.lobby = c.list || [];
    else if (c.t === 'answer') this.notify(`${c.from.name} ${c.yes ? 'is on the way' : 'can\'t come just now'}.`, c.from);
  }

  // Someone at the door.
  join({ cid, account, ip }) {
    const p = profileOf(account);
    const refuse = (why) => this.send(toRelay({ t: 'refuse', cid, why }));
    if (!p || !p.id) return refuse('no account');
    if (this.bans.ids.has(p.id)) return refuse('banned');
    if (p.id === this.profile.id || [...this.guests.values()].some((g) => g.profile.id === p.id)) return refuse('already here');
    if ((this.game.seats || []).length >= MAX_PLAYERS) return refuse('full');
    const g = { cid, profile: p, ip, seat: null, state: 'door', sent: null };
    this.guests.set(cid, g);
    // (Round 62) A world with mods: they must have them first (offered,
    // and sent from here, if they haven't).
    if (this.world.mods && this.world.mods.length) {
      g.state = 'mods';
      this.to(g, { t: 'mods?', mods: this.world.mods, world: this.world.name || 'this world', host: this.profile });
      return;
    }
    this.door(g);
  }

  // Been here before: back as they were. Else, a character first.
  door(g) {
    g.state = 'door';
    if (this.game.partyChars && this.game.partyChars.has(g.profile.id)) this.admit(g, null);
    else this.to(g, { t: 'needHero', world: this.world.name || 'this world', host: this.profile });
  }

  admit(g, hero) {
    const game = this.game;
    const input = new RemoteInput();
    const ui = this.makeUI(g);
    g.seat = game.addSeat(g.profile, { ui, input, hero });
    g.seat.cid = g.cid;
    g.ui = ui;
    g.input = input;
    g.state = 'in';
    g.sent = { ents: new Map(), lists: {}, ui: {}, regions: new Set(), own: '', glob: '', inst: null, slow: 0 };
    g.blocks = [];
    g.fx = [];
    // (Their map as they have it: see mapNews.)
    const om = seatMap(game, g.seat);
    g.sent.ex = new Uint8Array(om.explored);
    g.sent.exN = om.exploredN;
    g.sent.pinsN = (om.pins || []).length;
    // The world as it is, as they'll start with it (theirs: their own
    // character, their own standing with everyone).
    const save = asSeat(game, g.seat, () => game.serialize());
    // (The ground comes whole, as they need it: see regionsFor. The others'
    // characters are the host's to keep, not theirs to see.)
    save.regions = [];
    save.party = null;
    this.to(g, { t: 'welcome', save, me: g.seat.ent.id, host: this.profile, world: this.world, party: this.partyList() });
    const name = g.profile.name;
    this.notify(`${name} has joined the world.`, g.profile);
    for (const o of this.guests.values()) if (o !== g && o.state === 'in') this.to(o, { t: 'note', text: `${name} has joined the world.`, profile: g.profile });
    this.partyChanged();
  }

  // Gone (left, or the connection dropped): their character kept.
  left(cid, why = null) {
    const g = this.guests.get(cid);
    if (!g) return;
    this.guests.delete(cid);
    if (g.seat) this.game.removeSeat(g.seat);
    if (g.state === 'in') {
      const text = `${g.profile.name} ${why === 'kick' ? 'was removed from' : why === 'ban' ? 'was banned from' : 'has left'} the world.`;
      this.notify(text, g.profile);
      for (const o of this.guests.values()) if (o.state === 'in') this.to(o, { t: 'note', text, profile: g.profile });
    }
    this.partyChanged();
  }

  kick(cid, why = 'kick') {
    const g = this.guests.get(cid);
    if (!g) return;
    this.send(toRelay({ t: 'kick', cid, why: why === 'ban' ? 'You have been banned from this world.' : 'The host removed you from the world.' }));
    this.left(cid, why);
  }

  ban(cid) {
    const g = this.guests.get(cid);
    if (!g) return;
    this.bans.ids.add(g.profile.id);
    this.bans.names.set(g.profile.id, g.profile);
    this.tellBans();
    this.kick(cid, 'ban');
  }

  unban(id) {
    this.bans.ids.delete(id);
    this.bans.names.delete(id);
    this.tellBans();
  }

  bannedList() {
    return [...this.bans.ids].map((id) => this.bans.names.get(id) || { id, name: 'Someone' });
  }

  tellBans() {
    this.send(toRelay({ t: 'bans', ids: [...this.bans.ids] }));
    this.onParty();
  }

  // Ask a friend at the title screen (on this machine's address) to come.
  invite(friend) {
    this.send(toRelay({ t: 'invite', to: friend.id, invite: { from: this.profile, world: this.world.name || 'a world' } }));
  }

  tellRelay() {
    this.send(toRelay({ t: 'world', world: { name: this.world.name || 'A world', players: (this.game.seats || []).length } }));
    this.send(toRelay({ t: 'bans', ids: [...this.bans.ids] }));
  }

  partyList() {
    return (this.game.seats || []).map((s) => ({ ...s.profile, host: !!s.host, cid: s.cid, ent: (s === this.game.seat ? this.game.player : s.ent)?.id, perm: s.host ? { commands: true } : this.permsOf(s.profile && s.profile.id) }));
  }

  // ------------------------------------------------------------ permissions
  // What the host lets each player do beyond playing (round 57): kept with
  // the world, by account. Just now: the command console.
  permsOf(id) {
    const P = this.game.perms || {};
    return { ...(id && P[id] ? P[id] : {}) };
  }

  setPerm(id, key, on) {
    if (!id || !PERMS.some((q) => q.key === key)) return;
    const P = (this.game.perms ||= {});
    P[id] = { ...(P[id] || {}), [key]: !!on };
    const g = [...this.guests.values()].find((q) => q.profile && q.profile.id === id);
    const what = PERMS.find((q) => q.key === key).told;
    if (g && g.state === 'in') this.to(g, { t: 'note', text: on ? `The host has let you ${what}.` : `The host no longer lets you ${what}.`, profile: this.profile });
    this.partyChanged();
  }

  partyChanged() {
    const list = this.partyList();
    const pvp = !!this.game.pvp;
    const guilds = this.game.guilds ? this.game.guilds.summary() : [];
    for (const g of this.guests.values()) if (g.state === 'in') this.to(g, { t: 'party', list, pvp, guilds });
    this.tellRelay();
    this.onParty(list);
  }

  // A player's command (see commands.js), run as them in the world, and
  // what it said sent back to their console.
  command(g, text) {
    if (!this.permsOf(g.profile && g.profile.id).commands) {
      this.to(g, { t: 'cmdOut', lines: [{ text: 'The host hasn\'t let you use commands in this world.', c: '#ffb080' }] });
      return;
    }
    let lines;
    let flags = null;
    try {
      lines = asSeat(this.game, g.seat, () => {
        const out = runCommand(this.game, text);
        // (What their own screen needs to know of it: the map shown whole,
        // a click on it to go there. See GuestNet.commandOut.)
        flags = { reveal: !!this.game.revealMap, mapTeleport: !!(this.game.cheats && this.game.cheats.mapTeleport) };
        return out;
      });
    } catch (err) {
      lines = [{ text: `That went wrong: ${err.message}`, c: '#ffb080' }];
    }
    this.to(g, { t: 'cmdOut', flags, lines: (lines || []).slice(0, 80).map((l) => (typeof l === 'string' ? l : { text: String(l.text ?? ''), c: l.c || null })) });
  }

  // Whether players may hurt each other (the host's to say), and everyone
  // told.
  setPvp(on) {
    this.game.pvp = !!on;
    const text = on ? 'The host has let players fight each other.' : 'The host has stopped players hurting each other.';
    this.notify(text, this.profile);
    for (const g of this.guests.values()) if (g.state === 'in') this.to(g, { t: 'note', text, profile: this.profile });
    this.partyChanged();
  }

  to(g, msg) {
    this.send(toPlayer(g.cid, JSON.stringify(msg)));
  }

  // ------------------------------------------------------------ from a player
  fromGuest(g, m) {
    if (m.t === 'hero' && g.state === 'door') return this.admit(g, m.hero || null);
    // (Round 62) Their mods: all there now (in, then), or one wanted.
    if (g.state === 'mods') {
      if (m.t === 'mods' && m.ok) this.door(g);
      else if (m.t === 'modpack?' && this.packText && (this.world.mods || []).some((q) => q.hash === m.hash)) {
        Promise.resolve(this.packText(m.hash)).then((text) => {
          if (this.guests.get(g.cid) === g) this.to(g, { t: 'modpack', hash: m.hash, text: text || null });
        }, () => this.to(g, { t: 'modpack', hash: m.hash, text: null }));
      }
      return;
    }
    if (g.state !== 'in') return;
    const seat = g.seat;
    if (m.t === 'in') {
      g.input.apply(m);
      seat.netCursor = m.cur || null;
      seat.store.g.aimFixed = m.aim ?? null;
      if (Number.isInteger(m.view)) seat.store.v.view = m.view & 3;
      seat.away = !!m.away;
    } else if (m.t === 'drop') g.sent.regions.delete(`${m.rx},${m.rz}`);
    else if (m.t === 'need') this.sendRegion(g, m.rx, m.rz);
    // A command typed in their console: run as them, if the host allows it.
    else if (m.t === 'cmd') this.command(g, String(m.text || '').slice(0, 200));
    // (Word less often, asked for: see GuestNet.setRate.)
    else if (m.t === 'rate') g.every = Number(m.hz) > 0 && Number(m.hz) <= 10 ? 2 : 1;
    else if (m.t === 'profile') {
      if (m.icon) seat.profile.icon = cleanIcon(m.icon);
      if (m.desc !== undefined) seat.profile.desc = cleanDesc(m.desc);
      if (m.title !== undefined) seat.profile.title = cleanTitle(m.title);
      g.profile = seat.profile;
      this.partyChanged();
    } else if (m.t === 'friend') this.friendWord(g.profile, m.to, m.yes);
    else if (m.t === 'guild') this.guildOp(g.profile, m);
    else if (m.t === 'bout') challengeBout(this.game, seat, m.to, m.wager);
  }

  // A guild's doings (see game/guilds.js), by player `by` (their profile:
  // the host's own, or a player's word): done, and whoever it concerns
  // told, and everyone's list of guilds brought up to date.
  guildOp(by, m) {
    const game = this.game;
    if (!game.guilds || !by) return null;
    const r = game.guilds.act(by.id, m.op, { name: m.name, to: m.to, gid: m.gid });
    if (!r.ok) r.told.push([by.id, r.why]);
    for (const [pid, text] of r.told) this.tell(pid, text);
    if (r.ok) this.partyChanged();
    return r;
  }

  // An achievement a player here has earned (see game/achievements.js):
  // their screen keeps it, with their own account.
  feat(seat, id) {
    for (const g of this.guests.values()) if (g.state === 'in' && g.seat === seat) this.to(g, { t: 'feat', id });
  }

  // A word for one player here (by account id): a notice on their screen.
  tell(pid, text, profile = null) {
    if (pid === this.profile.id) return this.notify(text, profile);
    for (const g of this.guests.values()) if (g.state === 'in' && g.profile.id === pid) this.to(g, { t: 'note', text, profile });
  }

  // A friend request (yes undefined), or the answer to one, from `from` to
  // the player with account id `to`.
  friendWord(from, to, yes) {
    const msg = { t: 'friend', from, yes };
    if (to === this.profile.id) return this.hostFriend && this.hostFriend(msg);
    for (const g of this.guests.values()) if (g.state === 'in' && g.profile.id === to) this.to(g, msg);
  }

  // The host's own friend request or answer, to a player here.
  sendFriend(toId, yes) {
    this.friendWord(this.profile, toId, yes);
  }

  // Where to aim a player's blow or arrow, what they're pointing at: as
  // they sent it, checked against the world as it is here.
  cursorFor(seat) {
    const c = seat.netCursor;
    if (!c) return null;
    const game = this.game;
    const out = { mx: c.mx, my: c.my };
    if (c.ent !== undefined && c.ent !== null) {
      const e = this.findEnt(c.ent);
      if (e && !e.dead) {
        out.entity = e;
        out.entUp = c.entUp ?? 0.5;
        if (c.part) out.part = c.part;
        out.inReach = inReach(game.player, e, game.attackReach());
      }
    }
    // (A ship's plank they pointed at, on their own screen.)
    if (c.ship && !out.entity) {
      const S = shipById(game, c.ship.s);
      const m = S && S.m;
      if (m && c.ship.vi >= 0 && c.ship.vi < m.N) {
        const x = c.ship.vi % m.W;
        const z = Math.floor(c.ship.vi / m.W) % m.L;
        const y = Math.floor(c.ship.vi / (m.W * m.L));
        const [wx, wz] = S.toWorld(x + 0.5, z + 0.5);
        const p = game.player;
        out.ship = { s: S.id, vi: c.ship.vi, face: c.ship.face };
        out.inReach = Math.hypot(wx - p.x, wz - p.z) <= REACH + 1 && Math.abs(S.layerY(y) - p.y) <= 5;
        return out;
      }
    }
    if (c.x !== undefined) {
      const p = game.player;
      const id = game.world.getBlock(c.x, c.y, c.z);
      out.x = c.x;
      out.y = c.y;
      out.z = c.z;
      out.face = c.face;
      out.block = id ? BLOCKS[id] : null;
      out.empty = !id;
      out.plan = !!c.plan;
      const reach = (x, y, z) => Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= 5 && Math.abs(y - p.y) <= 4;
      if (!out.inReach) out.inReach = reach(c.x, c.y, c.z);
      if (c.place) {
        const t = c.place;
        const held = p.heldDef();
        const placeId = held ? (held.kind === 'block' ? held.block : held.plant ?? null) : null;
        if (placeId !== null && placeId !== undefined) {
          const why = !reach(t.x, t.y, t.z) ? 'too far' : game.placeProblem(placeId, t.x, t.y, t.z);
          out.place = { x: t.x, y: t.y, z: t.z, id: placeId, rot: p.rot, ok: !why, why };
        }
      }
    }
    return out;
  }

  findEnt(id) {
    const game = this.game;
    for (const q of game.everyone()) if (q.id === id) return q;
    for (const list of [game.npcs, game.creatures, game.drops]) for (const e of list) if (e.id === id) return e;
    for (const e of game.props.values()) if (e.id === id) return e;
    for (const e of game.engines) if (e.id === id) return e;
    return null;
  }

  // ------------------------------------------------------------ what happens
  // The world's own goings-on, caught on their way to the screen and sound,
  // so each player hears and sees what's near them.
  hook() {
    const game = this.game;
    const r = game.renderer;
    const at = (x, z) => ({ x, z });
    const wrap = (k, where, scoped = false) => {
      const f = r[k];
      if (typeof f !== 'function') return;
      r[k] = (...a) => {
        const w = where(a);
        this.fx(k, a, w);
        // (Only to a player: not the host's screen.)
        if (scoped && !this.hostTurn()) return undefined;
        return f.apply(r, a);
      };
    };
    wrap('emit', (a) => at(a[0], a[2]));
    wrap('floatText', (a) => at(a[0], a[2]));
    wrap('wobble', (a) => at(a[0], a[2]));
    wrap('effect', (a) => (a[0] ? at(a[0].wx, a[0].wz) : null));
    wrap('flashScreen', () => null, true);
    // (Round 66) A mod's music, for the player it's put on for.
    wrap('modMusic', () => null, true);
    // (Round 62) A mod's effects, and their stopping.
    wrap('modVfx', (a) => at(a[2], a[4]));
    wrap('modVfxStop', () => null);
    wrap('modShot', (a) => at(a[3], a[5]));
    // Sounds: where they happen (heard by whoever's near), or a player's own.
    const audio = game.audio;
    if (audio && !audio.netWrapped) {
      const real = audio;
      const proxy = Object.create(real);
      proxy.netWrapped = true;
      proxy.play = (name, where, g, o) => {
        const w = where && typeof where === 'object' && where.x !== undefined ? at(where.x, where.z) : null;
        // (Round 66: how loud and how high, for a mod's sound.)
        const args = [name, w ? { x: w.x, z: w.z, y: where.y } : null];
        if (o && (o.vol !== undefined || o.pitch !== undefined)) args.push({ vol: o.vol, pitch: o.pitch });
        this.fx('sound', args, w);
        if (!w && !this.hostTurn()) return undefined;
        return real.play(name, where, g, o);
      };
      game.audio = proxy;
    }
    // An old place changed (fallen in, a spire opened): every player's copy
    // of it too, so ground they make for themselves comes out the same.
    game.world.onSiteChange = (s) => {
      for (const g of this.guests.values()) if (g.state === 'in') this.to(g, { t: 'site', id: s.id, state: s.state || {} });
    };
    // Every block that changes, for whoever has that ground.
    const onBlock = game.onBlockChange.bind(game);
    game.onBlockChange = (x, y, z, o, n) => {
      onBlock(x, y, z, o, n);
      this.blockChanged(x, y, z);
    };
  }

  // Is it the host's own turn (not a player's being done here as them)?
  hostTurn() {
    const g = this.game;
    return !g.seat || g.seat === g.seats?.[0];
  }

  fx(kind, args, where) {
    if (this.mute > 0 || !this.guests.size) return;
    const game = this.game;
    const mine = !this.hostTurn() ? game.seat : null;
    const ev = [kind, enc(args, 5)];
    for (const g of this.guests.values()) {
      if (g.state !== 'in') continue;
      if (where) {
        const p = g.seat === game.seat ? game.player : g.seat.ent;
        if (!p || Math.abs(p.x - where.x) > FX_NEAR || Math.abs(p.z - where.z) > FX_NEAR) continue;
      } else if (g.seat !== mine) continue;
      if (g.fx.length < 400) g.fx.push(ev);
    }
  }

  blockChanged(x, y, z) {
    if (!this.guests.size) return;
    const w = this.game.world;
    const ch = [x, y, z, w.getBlock(x, y, z), w.getMeta(x, y, z)];
    const inst = w.inInstance(x);
    const key = regionKeyOf(x, z);
    for (const g of this.guests.values()) {
      if (g.state !== 'in') continue;
      if (inst ? g.sent.inst && g.sent.inst === w.instAt(x) : g.sent.regions.has(key)) g.blocks.push(ch);
    }
  }

  // ------------------------------------------------------------ the ground
  sendRegion(g, rx, rz) {
    const w = this.game.world;
    if (!w.inBounds(rx, rz)) return;
    const r = w.isLoaded(rx, rz) ? w.regionAt(rx * REGION_W, rz * REGION_D) : w.loadRegion(rx, rz);
    if (!r) return;
    g.sent.regions.add(`${rx},${rz}`);
    g.pendingRegions = g.pendingRegions || [];
    g.pendingRegions.push(r.serialize());
  }

  // The ground about a player: anything they don't have yet, sent.
  regionsFor(g, p) {
    const w = this.game.world;
    if (w.inInstance(p.x)) {
      // (The place apart they're in: theirs, whoever else's is open.)
      const inst = w.instAt(p.x);
      if (g.sent.inst !== inst && inst) {
        g.sent.inst = inst;
        const regions = [...inst.regions.values()].map((r) => r.serialize());
        g.instMsg = { regions, floor: inst.floor ?? null, maxY: inst.maxY ?? null, voyage: !!inst.voyage };
      }
      return;
    }
    if (g.sent.inst) {
      g.sent.inst = null;
      g.instMsg = { none: true };
    }
    const rx = Math.floor(p.x / REGION_W);
    const rz = Math.floor(p.z / REGION_D);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!g.sent.regions.has(`${rx + dx},${rz + dz}`)) this.sendRegion(g, rx + dx, rz + dz);
  }

  // ------------------------------------------------------------ each frame
  afterUpdate(dt) {
    this.acc += dt;
    if (this.acc < 1 / RATE) return;
    const step = this.acc;
    this.acc = 0;
    for (const g of this.guests.values()) {
      if (g.state !== 'in') continue;
      // (Asked for word less often: every other time, the time between
      // carried over.)
      g.owed = (g.owed || 0) + step;
      g.beat = (g.beat || 0) + 1;
      if ((g.every || 1) > 1 && g.beat % g.every) continue;
      const s = g.owed;
      g.owed = 0;
      this.sendTo(g, s);
    }
  }

  sendTo(g, step) {
    const game = this.game;
    const seat = g.seat;
    const p = seat.ent;
    if (!p) return;
    this.regionsFor(g, p);
    const msg = { t: 's' };
    // Their windows, and their own state, as them.
    asSeat(game, seat, () => {
      const f = uiFrame(seat.ui, game, g.sent.ui, this.pixels || null);
      const fj = JSON.stringify(f);
      if (fj !== g.sent.uiLast) {
        g.sent.uiLast = fj;
        msg.ui = f;
      }
      const own = this.ownState(g, step);
      const oj = JSON.stringify(own);
      if (oj !== g.sent.own) {
        g.sent.own = oj;
        msg.own = own;
      }
      // The others in their guild: where they are, how they are (a few
      // times a second: see game/guilds.js).
      g.sent.mateT = (g.sent.mateT || 0) - step;
      if (g.sent.mateT <= 0) {
        g.sent.mateT = 0.25;
        const mates = guildMates(game);
        const mj = JSON.stringify(mates);
        if (mj !== g.sent.mates) {
          g.sent.mates = mj;
          msg.gm = mates;
        }
      }
      // The world's time, the weather over them, and the old place they're
      // in (theirs).
      const glob = this.globals();
      const gj = JSON.stringify(glob);
      if (gj !== g.sent.glob) {
        g.sent.glob = gj;
        msg.w = glob;
      }
    });
    // Everything about them.
    const near = (e) => Math.abs(e.x - p.x) <= VIEW && Math.abs(e.z - p.z) <= VIEW;
    const seen = new Set();
    const ents = [];
    const add = (e) => {
      if (!e || seen.has(e.id) || (e.dead && e.kind !== 'player') || !near(e)) return;
      seen.add(e.id);
      let last = g.sent.ents.get(e.id);
      if (!last) g.sent.ents.set(e.id, (last = {}));
      const ch = diffFields(e, last);
      if (ch) ents.push(packEntity(e, ch));
    };
    // (Not anyone still watching their opening: not in the world yet.)
    for (const q of game.everyone()) if (!q.limbo) add(q);
    for (const n of game.npcs) add(n);
    for (const c of game.creatures) add(c);
    for (const d of game.drops) add(d);
    for (const q of game.props.values()) add(q);
    for (const q of game.engines) add(q);
    for (const q of game.sailors || []) add(q);
    const gone = [];
    for (const id of [...g.sent.ents.keys()]) {
      if (seen.has(id)) continue;
      g.sent.ents.delete(id);
      gone.push(id);
    }
    if (ents.length) msg.e = ents;
    if (gone.length) msg.gone = gone;
    // (Round 68) The great ships about them: how each is going, and her
    // planks when they've changed since.
    const ships = [];
    g.sent.shipVer ||= new Map();
    for (const S of game.ships3d || []) {
      const mine = p.deck && p.deck.s === S.id;
      const below = S.hold && S.hold.has(p);
      if (!mine && !below && Math.hypot(S.x - p.x, S.z - p.z) > VIEW + S.m.L + 40) continue;
      const cells = g.sent.shipVer.get(S.id) !== S.ver;
      if (cells) g.sent.shipVer.set(S.id, S.ver);
      ships.push(packShip(S, cells));
    }
    for (const id of [...g.sent.shipVer.keys()]) if (!ships.some((q) => q.id === id)) g.sent.shipVer.delete(id);
    if (ships.length || g.sent.hadShips) msg.sh = ships;
    g.sent.hadShips = ships.length > 0;
    // What's in the air and on the ground near them.
    const lists = this.listsNear(p);
    for (const k of Object.keys(lists)) {
      const j = JSON.stringify(lists[k]);
      if (g.sent.lists[k] === j) continue;
      g.sent.lists[k] = j;
      (msg.l ||= {})[k] = lists[k];
    }
    // Slower things, a couple of times a second.
    g.sent.slow -= step;
    if (g.sent.slow <= 0) {
      g.sent.slow = 0.5;
      const slow = { placed: [...game.placed], relics: game.relics ? [...game.relics].map(([k, v]) => [k, enc(v, 3)]) : [], signs: game.signIcons ? [...game.signIcons] : [], wallDown: !!game.world.ow.wallDown };
      const sj = JSON.stringify(slow);
      if (sj !== g.sent.slowLast) {
        g.sent.slowLast = sj;
        msg.slow = slow;
      }
      this.mapNews(g, msg);
    }
    if (g.instMsg) {
      msg.inst = g.instMsg;
      g.instMsg = null;
    }
    if (g.pendingRegions && g.pendingRegions.length) {
      msg.r = g.pendingRegions;
      g.pendingRegions = [];
    }
    if (g.blocks.length) {
      msg.b = g.blocks;
      g.blocks = [];
    }
    if (g.fx.length) {
      msg.fx = g.fx;
      g.fx = [];
    }
    if (g.msgs && g.msgs.length) {
      msg.m = g.msgs;
      g.msgs = [];
    }
    this.to(g, msg);
  }

  // What's new on a player's own map (the squares they've been to or been
  // told of since, and the places they've been told of).
  mapNews(g, msg) {
    const om = seatMap(this.game, g.seat);
    if (om.exploredN !== g.sent.exN) {
      g.sent.exN = om.exploredN;
      const e = om.explored;
      const had = g.sent.ex;
      const fresh = [];
      for (let i = 0; i < e.length; i++) {
        if (!e[i] || had[i]) continue;
        had[i] = 1;
        fresh.push(i);
      }
      if (fresh.length) msg.ex = fresh;
    }
    const pins = om.pins || [];
    if (pins.length !== g.sent.pinsN) {
      g.sent.pinsN = pins.length;
      msg.pins = pins;
    }
    // (Round 56) The old places and outlaws' camps known of, as they come
    // to be (told of in a tavern, come upon, beaten): theirs only had what
    // was known when they came.
    const game = this.game;
    const ds = (game.sim.dungeons ? game.sim.dungeons.all : []).filter((d) => d.known || d.seen).map((d) => [d.id, d.seen ? 1 : 0, d.cleared ? 1 : 0, d.entered ? 1 : 0, d.depth || 0, d.clearedBy || null, d.spire && d.spire.open !== null && d.spire.open !== undefined ? 1 : 0]);
    const camps = game.sim.bandits ? game.sim.bandits.knownCamps() : [];
    const sig = JSON.stringify([ds, camps]);
    if (sig !== g.sent.places) {
      g.sent.places = sig;
      msg.places = { ds, camps };
    }
  }

  // A player's own: their sleep, their digging, their line in the water,
  // the scene they're in, how they feel, where they are and how the law
  // and the town see them.
  ownState(g, step) {
    const game = this.game;
    const sim = game.sim;
    const p = game.player;
    const sc = game.scene;
    // (What the people about think of them, now and then.)
    g.opT = (g.opT || 0) - step;
    if (g.opT <= 0) {
      g.opT = 1;
      g.ops = [];
      g.qms = [];
      for (const n of game.npcs) {
        if (n.dead || Math.abs(n.x - p.x) >= 20 || Math.abs(n.z - p.z) >= 20) continue;
        g.ops.push([n.id, sim.opinion(n)]);
        // (What's over their head for this player: see sim/saga.)
        const mk = game.questMark ? game.questMark(n) : null;
        if (mk) g.qms.push([n.id, mk]);
      }
    }
    let hud = [];
    try {
      hud = sim.careers.hudLines();
    } catch {
      hud = [];
    }
    return {
      sleep: game.sleep ? { phase: game.sleep.phase, t: game.sleep.t, early: !!game.sleep.early, jail: !!game.sleep.jail } : null,
      fast: game.timeRate(),
      waiting: !!game.waiting,
      mining: game.mining ? enc(game.mining, 2) : null,
      fishing: game.fishing ? enc(game.fishing, 3) : null,
      scene: sc ? this.sceneOf(sc) : null,
      shake: game.shake || 0,
      hurt: game.hurtFlash || 0,
      heal: game.healFlash || 0,
      combat: game.combatT || 0,
      with: game.combatWith || null,
      cs: game.currentSettlement ? game.currentSettlement.id : null,
      wanted: [...game.wanted],
      jail: enc(sim.justice.jail, 3),
      escort: !!sim.justice.escort,
      exiled: [...sim.justice.exiled],
      citizen: enc(sim.citizen, 3),
      hud,
      ops: g.ops,
      qm: g.qms || [],
      storm: game.stormSea ? enc(game.stormSea, 2) : null,
      charging: game.charging ? enc(game.charging, 2) : null,
    };
  }

  // A scene of theirs, as their screen plays it (see GuestNet.scene): the
  // master waking (or falling: the one it was, as its ghost) by id.
  sceneOf(sc) {
    const who = sc.boss || sc.ghost || null;
    return {
      kind: sc.kind,
      t: Math.round(sc.t * 100) / 100,
      cause: sc.cause,
      below: sc.below,
      dir: sc.dir,
      label: sc.label,
      boss: who ? (Array.isArray(who) ? who.map((b) => b.id) : who.id) : null,
      side: sc.side,
      gemColor: sc.gemColor,
      rec: sc.rec ? sc.rec.id : null,
      // (A bout's end: who with, and which way it went.)
      foe: sc.kind === 'yield' && sc.npc ? sc.npc.id : undefined,
      won: sc.kind === 'yield' ? !!sc.won : undefined,
      name: sc.kind === 'yield' ? sc.foeName : undefined,
      // (The mountain going up: under it, or from over the sea.)
      here: sc.kind === 'erupt' ? !!sc.here : undefined,
      // (A fallen star: the village it came down by, and whose fall.)
      village: sc.kind === 'starfall' ? sc.village : undefined,
      first: sc.kind === 'starfall' ? sc.first : undefined,
      // (A painted opening: what's told in it, for their screen to paint.
      // See game/intros.js.)
      info: sc.kind === 'home_intro' || sc.kind === 'wreck_intro' ? sc.info : undefined,
    };
  }

  // The world's own: the time, the weather, the old place you're all in.
  globals() {
    const game = this.game;
    const d = game.dungeon;
    return {
      minute: Math.round(game.minute * 10) / 10,
      day: game.day,
      weather: enc(game.weather, 3),
      dungeon: d ? {
        id: d.rec.id,
        floor: d.floor,
        fight: enc(d.fight, 3),
        fallen: enc(d.fallen, 2),
        bossRoom: d.data && d.data.bossRoom ? enc(d.data.bossRoom, 2) : null,
        up: d.data ? enc(d.data.up, 1) : null,
        upAt: d.data ? enc(d.data.upAt, 1) : null,
        down: d.data ? enc(d.data.down, 1) : null,
        // (The packs fallen on this floor, and whose.)
        packs: (d.rec.packs || []).filter((q) => q.floor === d.floor),
      } : null,
    };
  }

  // What's in the air and on the ground near `p` (blows on their way,
  // bad ground, arrows, beams, flames...).
  listsNear(p) {
    const game = this.game;
    const close = (x, z) => x === undefined || (Math.abs(x - p.x) <= VIEW + 8 && Math.abs(z - p.z) <= VIEW + 8);
    const pick = (list, where) => (list || []).filter((q) => q && !q.done && close(...where(q))).slice(0, 120).map((q) => enc(q, 4));
    return {
      hazards: pick(game.hazards, (h) => (h.tiles && h.tiles[0] ? [h.tiles[0].x, h.tiles[0].z] : [undefined])),
      zones: pick(game.zones, (z) => (z.tiles && z.tiles[0] ? [z.tiles[0].x, z.tiles[0].z] : [undefined])),
      orbs: pick(game.orbs, (o) => [o.x, o.z]),
      projectiles: pick(game.projectiles, (a) => [a.x0, a.z0]),
      lasers: pick(game.lasers, (L) => [L.by && L.by.x, L.by && L.by.z]),
      flames: pick(game.flames, (f) => [f.x, f.z]),
      kavSpikes: pick(game.kavSpikes, (s) => [s.x, s.z]),
      cannonballs: pick(game.cannonballs, (b) => [b.x, b.z]),
      // (Round 71) Rifts in the air, and what bounces about the evolved
      // masters' halls: what's needed to draw them.
      rifts: (game.rifts || []).filter((R) => !R.done && close(R.a.x, R.a.z)).slice(0, 40).map((R) => ({ a: R.a, b: R.b, t: Math.round(R.t * 100) / 100, life: R.life === Infinity ? 1e9 : R.life, open: Math.round(R.open * 100) / 100, y: R.y })),
      bouncers: (game.bouncers || []).filter((b) => !b.done && close(b.x, b.z)).slice(0, 60).map((b) => ({ x: Math.round(b.x * 100) / 100, z: Math.round(b.z * 100) / 100, y: b.y, kind: b.kind })),
    };
  }

  // A player's windows' own pictures (a lock, a map), as an image; set by
  // main.js where there's a screen to draw them on.
  setPixels(fn) {
    this.pixels = fn;
  }

  // Tell one player something (their own windows' messages: see main.js).
  message(seat, text, color, merge = false) {
    const g = [...this.guests.values()].find((q) => q.seat === seat);
    if (!g) return;
    (g.msgs ||= []).push([text, color, merge ? 1 : 0]);
  }

  // Finished: everyone told, everyone's character kept in the world.
  close() {
    for (const g of [...this.guests.values()]) {
      if (g.state === 'in') this.to(g, { t: 'closing' });
      this.left(g.cid);
    }
    this.game.net = null;
  }
}
