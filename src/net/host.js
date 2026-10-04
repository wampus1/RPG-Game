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
import { asSeat } from '../game/party.js';
import { enc, diffFields, packEntity } from './wire.js';
import { uiFrame } from './uiwire.js';
import { profileOf, cleanIcon, cleanDesc, cleanTitle } from './account.js';
import { BLOCKS } from '../world/blocks.js';
import { REGION_W, REGION_D } from '../config.js';
import { inReach } from '../entities/footprint.js';
import { challengeBout } from '../game/bout.js';

// How often each player is sent what's changed (a second's worth), and how
// far about them (in paces) the things they're sent are.
const RATE = 20;
const VIEW = 30;
// (Effects further off than this aren't worth sending.)
const FX_NEAR = 34;

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
  constructor(game, { send, profile, world = {}, makeUI, bans = null, notify = null, onParty = null }) {
    this.game = game;
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
    // Been here before: back as they were. Else, a character first.
    if (this.game.partyChars && this.game.partyChars.has(p.id)) this.admit(g, null);
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
    return (this.game.seats || []).map((s) => ({ ...s.profile, host: !!s.host, cid: s.cid, ent: (s === this.game.seat ? this.game.player : s.ent)?.id }));
  }

  partyChanged() {
    const list = this.partyList();
    const pvp = !!this.game.pvp;
    for (const g of this.guests.values()) if (g.state === 'in') this.to(g, { t: 'party', list, pvp });
    this.tellRelay();
    this.onParty(list);
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
    else if (m.t === 'profile') {
      if (m.icon) seat.profile.icon = cleanIcon(m.icon);
      if (m.desc !== undefined) seat.profile.desc = cleanDesc(m.desc);
      if (m.title !== undefined) seat.profile.title = cleanTitle(m.title);
      g.profile = seat.profile;
      this.partyChanged();
    } else if (m.t === 'friend') this.friendWord(g.profile, m.to, m.yes);
    else if (m.t === 'bout') challengeBout(this.game, seat, m.to, m.wager);
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
    // Sounds: where they happen (heard by whoever's near), or a player's own.
    const audio = game.audio;
    if (audio && !audio.netWrapped) {
      const real = audio;
      const proxy = Object.create(real);
      proxy.netWrapped = true;
      proxy.play = (name, where) => {
        const w = where && typeof where === 'object' && where.x !== undefined ? at(where.x, where.z) : null;
        this.fx('sound', [name, w ? { x: w.x, z: w.z, y: where.y } : null], w);
        if (!w && !this.hostTurn()) return undefined;
        return real.play(name, where);
      };
      game.audio = proxy;
    }
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
      if (inst ? g.sent.inst === w.inst : g.sent.regions.has(key)) g.blocks.push(ch);
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
      if (g.sent.inst !== w.inst && w.inst) {
        g.sent.inst = w.inst;
        const regions = [...w.inst.regions.values()].map((r) => r.serialize());
        g.instMsg = { regions, floor: w.inst.floor ?? null, maxY: w.inst.maxY ?? null, voyage: !!w.inst.voyage };
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
    for (const g of this.guests.values()) if (g.state === 'in') this.sendTo(g, step);
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
    for (const q of game.everyone()) add(q);
    for (const n of game.npcs) add(n);
    for (const c of game.creatures) add(c);
    for (const d of game.drops) add(d);
    for (const q of game.props.values()) add(q);
    for (const q of game.engines) add(q);
    const gone = [];
    for (const id of [...g.sent.ents.keys()]) {
      if (seen.has(id)) continue;
      g.sent.ents.delete(id);
      gone.push(id);
    }
    if (ents.length) msg.e = ents;
    if (gone.length) msg.gone = gone;
    // What's in the air and on the ground near them.
    const lists = this.listsNear(p);
    for (const k of Object.keys(lists)) {
      const j = JSON.stringify(lists[k]);
      if (g.sent.lists[k] === j) continue;
      g.sent.lists[k] = j;
      (msg.l ||= {})[k] = lists[k];
    }
    // The world's time, weather, and the old place you're in.
    const glob = this.globals();
    const gj = JSON.stringify(glob);
    if (gj !== g.sent.glob) {
      g.sent.glob = gj;
      msg.w = glob;
    }
    // Slower things, a couple of times a second.
    g.sent.slow -= step;
    if (g.sent.slow <= 0) {
      g.sent.slow = 0.5;
      const slow = { placed: [...game.placed], relics: game.relics ? [...game.relics].map(([k, v]) => [k, enc(v, 3)]) : [], signs: game.signIcons ? [...game.signIcons] : [] };
      const sj = JSON.stringify(slow);
      if (sj !== g.sent.slowLast) {
        g.sent.slowLast = sj;
        msg.slow = slow;
      }
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
      for (const n of game.npcs) if (!n.dead && Math.abs(n.x - p.x) < 20 && Math.abs(n.z - p.z) < 20) g.ops.push([n.id, sim.opinion(n)]);
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
