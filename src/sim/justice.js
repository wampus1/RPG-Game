// Crime and punishment. Crimes only count when someone sees them. Guards
// try to arrest (or subdue) the culprit instead of killing them; the town's
// leader then hears the guard and the witnesses at the jail and decides what
// can be proven, the fine or jail time, or, for repeat offenders, exile or
// execution.
import { GROUND } from '../config.js';
import { B } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { clamp } from '../util/rng.js';
import { jobTitle } from '../entities/npcgen.js';
import { DAY, ledger, mayorOf, alive, st, setOverride, invAdd } from './econ.js';
import { removeItem, countItem } from '../game/inventory.js';
import { findPath } from '../entities/pathfind.js';
import { lawOn } from './laws.js';

export const CRIMES = {
  theft: { label: 'Theft', sev: 'minor', fine: 10 },
  vandalism: { label: 'Vandalism', sev: 'minor', fine: 15 },
  trespass: { label: 'Trespassing', sev: 'minor', fine: 10 },
  brandishing: { label: 'Brandishing a weapon', sev: 'minor', fine: 10 },
  curfew: { label: 'Breaking the curfew', sev: 'minor', fine: 6 },
  poaching: { label: 'Poaching', sev: 'minor', fine: 12 },
  felling: { label: 'Felling a tree in town', sev: 'minor', fine: 10 },
  assault: { label: 'Assault', sev: 'moderate', fine: 40 },
  assault_guard: { label: 'Assaulting a guard', sev: 'moderate', fine: 60 },
  resisting: { label: 'Resisting arrest', sev: 'moderate', fine: 30 },
  jailbreak: { label: 'Escaping jail', sev: 'moderate', fine: 60 },
  murder: { label: 'Murder', sev: 'severe', fine: 250 },
  desertion: { label: 'Desertion', sev: 'severe', fine: 120 },
};
export const SEV_RANK = { minor: 1, moderate: 2, severe: 3 };
const HOURLY_RATE = 5; // coins of fine worked off per hour in a cell

const SHOUTS = {
  theft: ['THIEF! Stop, thief!', 'Guards! A thief!', 'Put that back, thief!'],
  vandalism: ['Stop wrecking our town! GUARDS!', 'Vandal! Guards!'],
  trespass: ['Intruder! GUARDS!', 'Get out of our house! Guards!'],
  brandishing: ['Halt! You were warned!'],
  curfew: ['Curfew! You were told to get indoors!'],
  poaching: ['Poacher! That game belongs to the town!', 'Guards! A poacher!'],
  felling: ['Hey! You can\'t cut those down! Guards!', 'Leave our trees alone!'],
  assault: ['Leave them alone! GUARDS!', 'Help! Someone\'s being attacked!', 'GUARDS! Murder!'],
  assault_guard: ['They attacked a guard!', 'Guard down! Help!'],
  resisting: ['They\'re resisting!', 'Get them!'],
  jailbreak: ['The prisoner\'s escaping!', 'Jailbreak! Stop them!'],
  murder: ['MURDER! Murder in the streets!', 'They killed them! GUARDS!'],
  desertion: ['Deserter! Seize them!', 'There\'s the one who ran from the war!'],
};

export class Justice {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.pending = new Map(); // sid -> [crime]
    this.record = new Map(); // sid -> {minor, moderate, severe, convictions}
    this.exiled = new Set();
    this.jail = null;
    this.resisted = new Set();
    this.haltCd = 0;
    this.checkT = 0;
    this.trespass = null;
    this.brandish = null;
    this.exileWarn = -1;
    this.sightings = new Map(); // sid -> [{t, x, z, who: [idx]}]
    this.repairs = []; // jails to patch up after a breakout
    this.unsolved = []; // crimes nobody saw, waiting to be discovered
  }

  pendingIn(sid) {
    return this.pending.get(sid) || [];
  }

  recordOf(sid) {
    let r = this.record.get(sid);
    if (!r) {
      r = { minor: 0, moderate: 0, severe: 0, convictions: 0 };
      this.record.set(sid, r);
    }
    return r;
  }

  notoriety(sid) {
    const r = this.record.get(sid);
    return this.pendingIn(sid).length + (r ? r.convictions * 0.5 + r.severe : 0);
  }

  // ------------------------------------------------------------ crimes
  commit(sid, type, info = {}) {
    const game = this.game;
    const def = CRIMES[type];
    const wits = (info.witnesses || []).filter((n) => n && !n.dead && !n.sleeping);
    const L = this.sim.layoutOf(sid);
    // Circumstantial: people who saw you near the scene around the time.
    const seen = (info.circumstantial || []).filter((i) => L.npcs[i] && alive(L.npcs[i]));
    if (!wits.length && !seen.length && !info.known) return null;
    const s = L.settlement;
    // Taking several things from the same place in one go is one theft.
    if (type === 'theft') {
      const prev = this.sameTheft(this.pending.get(sid) || [], info, game.day * DAY + game.minute, (c) => c.day * DAY + c.minute);
      if (prev) return this.addToTheft(prev, info, wits, L, sid);
    }
    let sev = info.sev || def.sev;
    if (type === 'theft' && (info.value || 0) >= 25) sev = 'moderate';
    const crime = {
      type, sev, desc: info.desc || def.label, victim: info.victim || null, value: info.value || 0, items: info.items || null, owner: info.owner || null,
      witnesses: wits.filter((n) => !n.visit && !n.rec.visitor).map((n) => n.rec.idx), guardSaw: wits.some((n) => n.rec.job === 'guard') || !!info.known, day: game.day, minute: Math.floor(game.minute),
      seen, at: info.at || null, when: info.when ?? null, suspected: !wits.length && !info.known, bid: info.bid ?? undefined,
    };
    const list = this.pending.get(sid) || [];
    list.push(crime);
    this.pending.set(sid, list);
    const r = L.econ.recent;
    if (type === 'theft' || type === 'vandalism' || type === 'trespass') r.thefts++;
    else if (type === 'poaching') r.poached = (r.poached || 0) + 1;
    else if (type === 'felling') r.felled = (r.felled || 0) + 1;
    else if (type !== 'curfew') r.violence++;
    const hm = game.minute;
    if (hm >= 1320 || hm < 300) r.night = (r.night || 0) + 1;
    r.calm = 0;
    const hit = { minor: 6, moderate: 12, severe: 25 }[sev];
    for (const w of wits) this.sim.changeRep(w, -hit);
    for (const i of seen) this.sim.changeRep({ rec: L.npcs[i], settlement: s }, -Math.ceil(hit / 3));
    if (info.victimNpc && !info.victimNpc.dead) this.sim.changeRep(info.victimNpc, -hit * 2);
    const was = game.isWanted(sid);
    game.wanted.set(sid, Math.max(game.wanted.get(sid) || 0, sev === 'minor' ? 240 : 1e9));
    const shouter = wits.find((n) => n.state === 'routine' || n.rec.job === 'guard') || wits[0];
    if (!info.quiet && shouter) shouter.say(shouter.rng.pick(SHOUTS[type] || SHOUTS.assault), 3.2, '#ff9080');
    if (!was && !info.silent) {
      game.ui.msg(wits.length ? `${def.label} witnessed! You are wanted in ${s.name}.` : info.known ? `${def.label}: you are wanted in ${s.name}.` : `You are suspected of ${lcFirst(describe(crime))} in ${s.name}!`, '#ff5050');
      game.audio?.play('alarm');
    }
    if (wits.length || !info.known) game.alertGuards(sid, game.player, shouter || game.player, true);
    this.sim.areaCache.delete(sid);
    return crime;
  }

  // A crime nobody saw: it will be discovered later, and then the town asks
  // who was seen nearby around that time.
  unseen(sid, info) {
    const now = this.sim.abs;
    if (info.type === 'theft') {
      const prev = this.sameTheft(this.unsolved.filter((u) => u.sid === sid), info, now, (u) => u.t);
      if (prev) {
        prev.value += info.value || 0;
        prev.items = mergeItems(prev.items, info.items);
        prev.desc = theftDesc(prev.desc, prev.items);
        prev.discoverAt = Math.max(prev.discoverAt, now + 10);
        return;
      }
    }
    const delay = info.type === 'murder' ? 8 + Math.random() * 30 : 20 + Math.random() * 70;
    this.unsolved.push({ sid, ...info, t: now, discoverAt: now + delay });
  }

  // A theft from the same owner (or building) within the hour or so.
  sameTheft(list, info, now, when) {
    const key = (o) => (o ? `${o.kind}:${o.id}` : null);
    const k = key(info.owner);
    return list.find((c) => c.type === 'theft' && now - when(c) <= 90 && ((k && key(c.owner) === k) || (info.bid !== undefined && info.bid !== null && c.bid === info.bid))) || null;
  }

  // One more thing taken: added to the same theft (anyone new who saw it
  // counts as a witness to the whole thing).
  addToTheft(c, info, wits, L, sid) {
    const game = this.game;
    c.value += info.value || 0;
    c.items = mergeItems(c.items, info.items);
    c.desc = theftDesc(c.desc, c.items);
    if (c.value >= 25 && c.sev === 'minor') c.sev = 'moderate';
    if (info.bid !== undefined && c.bid === undefined) c.bid = info.bid;
    const fresh = wits.filter((n) => !n.visit && !n.rec.visitor && !c.witnesses.includes(n.rec.idx));
    const hit = { minor: 6, moderate: 12, severe: 25 }[c.sev];
    for (const n of fresh) {
      c.witnesses.push(n.rec.idx);
      this.sim.changeRep(n, -hit);
    }
    if (wits.some((n) => n.rec.job === 'guard')) c.guardSaw = true;
    if (wits.length) c.suspected = false;
    if (fresh.length && !info.quiet) fresh[0].say(fresh[0].rng.pick(['And again!', 'Stop, thief!', 'Put that back!']), 3, '#ff9080');
    game.wanted.set(sid, Math.max(game.wanted.get(sid) || 0, c.sev === 'minor' ? 240 : 1e9));
    if (fresh.length) game.alertGuards(sid, game.player, fresh[0], true);
    this.sim.areaCache.delete(sid);
    void L;
    return c;
  }

  // Remember who saw the player where (checked about once a second).
  recordSightings() {
    const game = this.game;
    const p = game.player;
    if (p.dead) return;
    const now = Math.floor(this.sim.abs);
    for (const [sid, a] of game.active) {
      const b = a.layout.bounds;
      if (p.x < b.x0 - 24 || p.x > b.x1 + 24 || p.z < b.z0 - 20 || p.z > b.z1 + 20) continue;
      const who = this.sim.witnesses(sid, p.x, p.z, 10).filter((n) => !n.visit && !n.hired).map((n) => n.rec.idx);
      if (!who.length) continue;
      const list = this.sightings.get(sid) || [];
      const last = list[list.length - 1];
      if (last && last.t === now && last.x === p.x && last.z === p.z) continue;
      list.push({ t: now, x: p.x, z: p.z, who });
      if (list.length > 300) list.splice(0, list.length - 300);
      this.sightings.set(sid, list);
    }
  }

  // Who saw the player within 12 tiles of (x, z) between t-25 and t+20 minutes.
  suspectsNear(sid, x, z, t, exclude = null) {
    const L = this.sim.layoutOf(sid);
    const seen = new Map();
    for (const s of this.sightings.get(sid) || []) {
      if (s.t < t - 25 || s.t > t + 20) continue;
      if (Math.max(Math.abs(s.x - x), Math.abs(s.z - z)) > 12) continue;
      for (const i of s.who) if (i !== exclude && L.npcs[i] && alive(L.npcs[i]) && !seen.has(i)) seen.set(i, s.t);
    }
    return seen;
  }

  investigate() {
    const now = this.sim.abs;
    for (const u of [...this.unsolved]) {
      if (now < u.discoverAt) continue;
      this.unsolved.splice(this.unsolved.indexOf(u), 1);
      this.solve(u);
    }
  }

  solve(u) {
    const game = this.game;
    const L = this.sim.layoutOf(u.sid);
    const day = game.day;
    const seen = this.suspectsNear(u.sid, u.x, u.z, u.t, u.victimIdx ?? null);
    const what = u.type === 'murder' ? `${u.victim} was found dead` : `The ${u.ownerName || 'owners'} found things missing`;
    if (!seen.size) {
      ledger(L, day, `${what}. Nobody knows who did it.`);
      if (game.active.has(u.sid)) game.ui.msg(`${what} in ${L.settlement.name}. No one suspects you.`, '#c8c8c8');
      return null;
    }
    const names = [...seen.keys()].map((i) => L.npcs[i].name.first);
    const hh = Math.floor((u.t % DAY) / 60);
    const mm = Math.floor(u.t % 60);
    const crime = this.commit(u.sid, u.type, {
      witnesses: [], circumstantial: [...seen.keys()], victim: u.victim, value: u.value, items: u.items, owner: u.owner, desc: u.desc,
      at: u.place || null, when: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    });
    ledger(L, day, `${what}. ${names.slice(0, 2).join(' and ')} saw ${game.playerName} nearby around then.`);
    if (game.active.has(u.sid)) game.ui.msg(`${what}! ${names.slice(0, 2).join(' and ')} saw you near the scene. The guards want a word.`, '#ff7060');
    return crime;
  }

  // A victim who was the only one to see an attack takes it to the grave.
  forgetVictim(sid, idx) {
    const list = this.pendingIn(sid).filter((c) => !(c.witnesses.length === 1 && c.witnesses[0] === idx && !c.guardSaw && !(c.seen || []).length));
    if (list.length) this.pending.set(sid, list);
    else {
      this.pending.delete(sid);
      this.game.wanted.delete(sid);
    }
  }

  // Crimes lapse for the petty stuff when the guards lose interest.
  forgetMinor(sid) {
    const list = this.pendingIn(sid).filter((c) => SEV_RANK[c.sev] >= 2);
    if (list.length) this.pending.set(sid, list);
    else this.pending.delete(sid);
    this.resisted.delete(sid);
  }

  // ------------------------------------------------------------ arrests
  canHalt(sid) {
    // Murderers caught in the act get no warning; suspects are asked to come along.
    const caught = this.pendingIn(sid).some((c) => c.sev === 'severe' && !c.suspected);
    return this.haltCd <= 0 && !this.jail && !this.escort && !this.resisted.has(sid) && !caught && !this.game.ui.modal && !this.game.player.dead && !this.game.player.restrained;
  }

  halt(guard) {
    const sid = guard.settlement.id;
    this.haltCd = 30;
    for (const g of this.game.guardsOf(sid)) g.haltT = 12;
    this.game.ui.openHalt?.(guard, this.pendingIn(sid));
  }

  // Coming quietly: a guard takes your weapons, ties your hands and leads
  // you to the cell on a rope.
  surrender(sid, guard = null) {
    const game = this.game;
    const L = this.sim.layoutOf(sid);
    const p = game.player;
    const guards = game.guardsOf(sid).filter((g) => !g.sleeping && g.distTo(p) <= 40);
    if (!guard || guard.dead || guard.rec.job !== 'guard') guard = guards.sort((a, b) => a.distTo(p) - b.distTo(p))[0] || null;
    if (!guard || !L.jail || p.dead) return this.imprison(sid, 'surrender');
    for (const n of game.npcs) if (n !== guard && n.threat === p && (n.state === 'fight' || n.state === 'alert' || n.state === 'flee')) n.calmDown(true);
    game.wanted.delete(sid);
    game.stopPlayerActions?.();
    p.sitting = null;
    const returned = this.confiscateStolen(L, sid);
    const weapons = this.confiscateWeapons(sid);
    const spot = this.trialSpots(L, 1)[0];
    this.escort = { sid, guard, goal: { x: spot.x, y: L.jail.y, z: spot.z }, phase: 'walk', t: 0, wait: 0, stepT: 0 };
    p.restrained = true;
    guard.wake?.();
    guard.state = 'escort';
    guard.threat = null;
    guard.path = null;
    guard.releaseSpot();
    // Sat down (or across the room): up, and over to your side first.
    this.guardBeside(guard);
    guard.face(p.x, p.z);
    guard.say(weapons.length ? 'I\'ll take those. Hands out.' : 'Hands out. Come along.', 3);
    game.ui.msg(`${guard.name} ${weapons.length ? `takes your ${listItems(weapons)}, ` : ''}ties your hands and leads you to the jail.`, '#ffb080');
    if (returned) game.ui.msg('Stolen goods were confiscated.', '#ffb080');
    game.audio?.play('select');
  }

  // Weapons (and arrows) are held by the guards until you're released.
  confiscateWeapons(sid) {
    const p = this.game.player;
    const taken = [];
    for (let i = 0; i < p.inv.length; i++) {
      const s = p.inv[i];
      if (!s) continue;
      const d = ITEMS[s.item];
      if (d && (d.kind === 'weapon' || s.item === 'arrow' || s.item === 'bolt')) {
        taken.push({ item: s.item, count: s.count });
        p.inv[i] = null;
      }
    }
    // (And the blade in your off hand.)
    const off = p.equip && p.equip.shield;
    if (off && ITEMS[off] && ITEMS[off].kind === 'weapon') {
      taken.push({ item: off, count: 1, slot: 'shield' });
      p.equip.shield = null;
    }
    const prev = this.held && this.held.sid === sid ? this.held.items : this.held ? (this.stashWeapons(this.sim.layoutOf(this.held.sid)), []) : [];
    if (taken.length || prev.length) this.held = { sid, items: [...prev, ...taken] };
    return taken;
  }

  // Released: the guards hand your weapons back, unless you killed someone.
  returnWeapons(forfeit) {
    const h = this.held;
    if (!h || !h.items.length) {
      this.held = null;
      return;
    }
    const game = this.game;
    const p = game.player;
    this.held = null;
    if (forfeit) {
      game.ui.msg('Your weapons are forfeit: murderers don\'t get them back.', '#ff9060');
      return;
    }
    for (const it of h.items) {
      // (The off-hand blade back where it was, if that hand's still free.)
      if (it.slot === 'shield' && p.equip && !p.equip.shield) {
        p.equip.shield = it.item;
        continue;
      }
      const left = p.give(it.item, it.count);
      if (left) game.spawnDrop(it.item, left, p.x, p.y, p.z, true);
    }
    game.ui.msg(`The guard hands back your ${h.items.map((i) => ITEMS[i.item].name.toLowerCase()).slice(0, 3).join(', ')}.`, '#a0e0a0');
  }

  // Escaped: your weapons stay locked in the jail building's chest.
  stashWeapons(L) {
    const h = this.held;
    this.held = null;
    if (!h || !h.items.length || !L || !L.jail) return;
    const w = this.game.world;
    const b = L.buildings[L.jail.building];
    let slots = null;
    for (let z = b.z0; z <= b.z1 && !slots; z++) {
      for (let x = b.x0; x <= b.x1 && !slots; x++) {
        const id = w.getBlock(x, L.jail.y, z);
        if (id === B.chest || id === B.barrel || id === B.crate) slots = w.getContainer(x, L.jail.y, z);
      }
    }
    for (const it of h.items) {
      if (!slots) break;
      const i = slots.findIndex((s) => !s);
      if (i >= 0) slots[i] = { item: it.item, count: it.count };
    }
    if (slots) this.game.ui.msg(`Your weapons are locked in a chest in the ${b.name}.`, '#ffb080');
  }

  confiscateStolen(L, sid) {
    const p = this.game.player;
    let returned = 0;
    for (const c of this.pendingIn(sid)) {
      if (c.type !== 'theft' || !c.items) continue;
      for (const it of c.items) {
        const n = Math.min(countItem(p.inv, it.item), it.count);
        if (n <= 0) continue;
        removeItem(p.inv, it.item, n);
        returned += n;
        c.found = true;
        this.returnGoods(L, c.owner, it.item, n);
      }
    }
    return returned;
  }

  // The guard steps up beside you (getting up off a bench, or round a
  // table), so the walk to the cells can start.
  guardBeside(g) {
    const game = this.game;
    const p = game.player;
    g.spot = null;
    g.atGoal = false;
    if (g.distTo(p) <= 1 && Math.abs(g.y - p.y) <= 1 && !g.moving) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = p.x + dx;
      const z = p.z + dz;
      const y = game.world.findStandY(x, z, p.y);
      if (y < 0 || Math.abs(y - p.y) > 1 || game.occupiedBySolid(x, y, z, g)) continue;
      g.teleport(x, y, z);
      g.face(p.x, p.z);
      return true;
    }
    return false;
  }

  // Each frame of an escort: the guard walks, the prisoner is pulled along.
  updateEscort(dt) {
    const e = this.escort;
    const game = this.game;
    const p = game.player;
    const g = e.guard;
    const L = this.sim.layoutOf(e.sid);
    e.t += dt;
    if (!g || g.dead || g.state !== 'escort' || p.dead) {
      // The guard is gone: the rope goes slack and you're free (and wanted).
      this.escort = null;
      p.restrained = false;
      if (g && !g.dead) g.calmDown(true);
      game.ui.msg('The rope goes slack. You are free... for now.', '#ffe070');
      game.wanted.set(e.sid, Math.max(game.wanted.get(e.sid) || 0, 1e9));
      return;
    }
    // Nobody getting anywhere (the guard boxed in, or the way blocked):
    // the guard comes round to you and tries again; failing that, it's
    // straight to the cells.
    const key = `${g.x},${g.z},${p.x},${p.z}`;
    if (key !== e.lastKey) {
      e.lastKey = key;
      e.still = 0;
    } else e.still = (e.still || 0) + dt;
    if (e.phase === 'walk' && e.still > 5) {
      e.still = 0;
      e.unstuck = (e.unstuck || 0) + 1;
      g.path = null;
      this.guardBeside(g);
      if (e.unstuck >= 3) e.t = 999;
    }
    if (e.t > 90) {
      // Taking too long (stuck somewhere): march straight to the cell.
      g.calmDown(true);
      this.escort = null;
      p.restrained = false;
      this.imprison(e.sid, 'surrender', true);
      return;
    }
    if (p.moving) return;
    if (e.phase === 'walk') {
      if (Math.abs(g.x - p.x) + Math.abs(g.z - p.z) > 1 && !g.moving) this.pullToward(g.x, g.y, g.z, 1);
      else if (g.moving && Math.abs(g.fx - p.x) + Math.abs(g.fz - p.z) >= 1 && Math.abs(g.x - p.x) + Math.abs(g.z - p.z) > 1) this.pullToward(g.fx, g.fy, g.fz, 0);
    } else if (e.phase === 'enter') {
      const st = L.jail.stand;
      if (p.x === st.x && p.z === st.z) {
        this.escort = null;
        p.restrained = false;
        this.setCellDoor(L, false);
        g.say('In you go. The hearing will be soon.', 3);
        g.calmDown(true);
        this.jail = { sid: e.sid, phase: 'gather', t: 0, how: 'surrender', party: [], lines: [], li: 0, lt: 0, release: null, cellless: false, floor: this.floorOf(L) };
        this.beginTrial(L);
        game.audio?.play('door');
        return;
      }
      if (!this.pullToward(st.x, L.jail.y, st.z, 0)) {
        e.stuck = (e.stuck || 0) + dt;
        if (e.stuck > 3) game.teleportPlayer(st.x, L.jail.y, st.z);
      }
    }
  }

  // Take one step of the prisoner toward (x, z); false if no way.
  pullToward(x, y, z, near) {
    const game = this.game;
    const p = game.player;
    if (Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) <= near && Math.abs(x - p.x) + Math.abs(z - p.z) <= Math.max(1, near)) return true;
    const path = findPath(game.world, p.x, p.y, p.z, x, y, z, { maxNodes: 400, near, partial: true });
    if (!path || !path.length) return false;
    const [nx, ny, nz] = path[0];
    // (Anyone in the way is pushed aside by the guard's rope.)
    const blocker = game.occupiedBySolid(nx, ny, nz, p);
    if (blocker && !(blocker.kind === 'npc' && (!this.escort || blocker !== this.escort.guard) && game.shove(blocker, p, this.escort ? { x: this.escort.guard.x, z: this.escort.guard.z } : null))) return false;
    const w = game.world;
    if (w.getBlock(nx, ny, nz) === B.door && !w.getState(nx, ny, nz)) game.setDoor(nx, ny, nz, true);
    p.face(nx, nz);
    p.startMove(nx, ny, nz, 0.26);
    game.onPlayerStep(nx, ny, nz, w.isWaterAt(nx, ny, nz));
    return true;
  }

  // The guard reached the jail: open the cell and put the prisoner in.
  escortArrived() {
    const e = this.escort;
    if (!e || e.phase !== 'walk') return;
    const L = this.sim.layoutOf(e.sid);
    e.phase = 'enter';
    e.t = Math.min(e.t, 100);
    this.setCellDoor(L, true);
    this.game.audio?.play('door');
  }

  resist(sid, guard) {
    this.resisted.add(sid);
    for (const g of this.game.guardsOf(sid)) g.haltT = 0;
    this.commit(sid, 'resisting', { witnesses: this.game.guardsOf(sid).filter((g) => g.distTo(this.game.player) <= 10), quiet: true });
    if (guard) guard.say('Then we do this the hard way!', 3, '#ff9080');
  }

  // The player dropped to 0 HP at the hands of the town: they wake up in jail.
  knockout(sid) {
    const p = this.game.player;
    p.hp = 1;
    this.imprison(sid, 'knockout');
  }

  imprison(sid, how, quick = false) {
    const game = this.game;
    const L = this.sim.layoutOf(sid);
    const p = game.player;
    for (const n of game.npcs) if (n.threat === p && (n.state === 'fight' || n.state === 'alert' || n.state === 'flee')) n.calmDown(true);
    game.wanted.delete(sid);
    game.stopPlayerActions?.();
    p.restrained = false;
    // Stolen goods are returned; weapons are held until release.
    const returned = this.confiscateStolen(L, sid);
    const weapons = this.confiscateWeapons(sid);
    if (!quick) game.advanceTime(how === 'knockout' ? 90 : 20);
    const jail = L.jail;
    if (jail) {
      game.teleportPlayer(jail.stand.x, jail.y, jail.stand.z);
      this.setCellDoor(L, false);
    } else {
      const pl = L.plaza;
      game.teleportPlayer(pl.cx + 1, GROUND, pl.cz + 1);
    }
    if (how === 'knockout') p.hp = Math.max(p.hp, 6);
    this.jail = { sid, phase: 'gather', t: 0, how, party: [], lines: [], li: 0, lt: 0, release: null, cellless: !jail, floor: jail ? this.floorOf(L) : null };
    if (!quick) game.ui.showKnockout?.(how, L.settlement.name, returned, weapons.length);
    this.beginTrial(L);
  }

  // Open or shut the cell. (The bars above the door let you walk under.)
  setCellDoor(L, open) {
    const j = L.jail;
    if (!j) return;
    const w = this.game.world;
    const ops = [[j.door.x, j.y, j.door.z, open ? B.cell_door_open : B.cell_door, 0]];
    if (!w.regionAt(j.door.x, j.door.z) || w.getBlock(j.door.x, j.y + 1, j.door.z) === B.iron_bars) ops.push([j.door.x, j.y + 1, j.door.z, B.cell_door_top, 0]);
    this.sim.setBlocks(ops);
  }

  // Where the hearing's party stands: separate tiles near the cell door,
  // leaving the way out of the cell clear.
  trialSpots(L, n) {
    const jail = L.jail;
    const w = this.game.world;
    if (!jail) return [...Array(n)].map((_, i) => ({ x: L.plaza.cx - 2 + i * 2, z: L.plaza.cz + 3 }));
    const b = L.buildings[jail.building];
    const key = (x, z) => x * 100000 + z;
    const skip = new Set([...jail.cell, jail.door, jail.front].map((t) => key(t.x, t.z)));
    const seen = new Set([key(jail.front.x, jail.front.z)]);
    const q = [jail.front];
    const out = [];
    while (q.length && out.length < n && seen.size < 300) {
      const t = q.shift();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = t.x + dx;
        const z = t.z + dz;
        const k = key(x, z);
        if (seen.has(k)) continue;
        seen.add(k);
        const inside = x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
        const nearDoor = Math.abs(x - b.door.x) + Math.abs(z - b.door.z) <= 3;
        if (!inside && !nearDoor) continue;
        if (!w.canStand(x, jail.y, z, true)) continue;
        q.push({ x, z });
        const id = w.getBlock(x, jail.y, z);
        if (!skip.has(k) && id !== B.door && !(x === b.door.x && z === b.door.z)) out.push({ x, z });
      }
    }
    while (out.length < n) out.push({ x: b.outside.x + out.length, z: b.outside.z });
    return out;
  }

  returnGoods(L, owner, item, n) {
    const e = L.econ;
    if (owner && owner.kind === 'house' && e.pantry[owner.id]) st.add(e.pantry[owner.id], item, n);
    else if (owner && owner.kind === 'biz' && item === 'coin' && L.treasury && L.treasury.some((t) => t.building === owner.id)) e.treasury += n;
    else if (owner && owner.kind === 'biz' && e.biz[owner.id]) st.add(e.biz[owner.id].store, item, n);
    else if (owner && owner.kind === 'rec' && L.npcs[owner.id]) invAdd(L.npcs[owner.id].inv, item, n);
  }

  // The hearing waits for daylight, and for everyone who has to be there
  // to be up; until then the prisoner stays in the cell.
  beginTrial(L) {
    if (this.trialReady(L)) {
      this.jail.phase = 'gather';
      this.jail.t = 0;
      this.summon(L);
      return;
    }
    this.jail.phase = 'night';
    this.jail.t = 0;
    this.game.ui.msg('You are locked in the cell for the night. The hearing will be held in the morning.', '#e8c080');
  }

  trialReady(L) {
    const m = this.game.minute;
    if (m < 420 || m >= 1260) return false;
    // Past mid-morning nobody lies in any longer.
    if (m >= 600) return true;
    return this.partyOf(L).party.every((r) => !r.ent || r.ent.dead || !r.ent.sleeping);
  }

  partyOf(L) {
    const sid = L.settlement.id;
    const ok = (r) => r && alive(r) && !r.away && !r.visitor;
    const judge = mayorOf(L) && !mayorOf(L).away ? mayorOf(L) : L.npcs.find((r) => ok(r) && r.job === 'guard') || [...L.npcs].filter((r) => ok(r) && r.age !== 'child').sort((a, b) => (b.age === 'elder') - (a.age === 'elder'))[0];
    const guard = L.npcs.find((r) => ok(r) && r.job === 'guard' && r !== judge);
    const wit = [];
    for (const c of this.pendingIn(sid)) {
      for (const i of [...c.witnesses, ...(c.seen || [])]) {
        const r = L.npcs[i];
        if (ok(r) && r !== judge && r !== guard && !wit.includes(r) && r.job !== 'guard') wit.push(r);
      }
    }
    const party = [judge, guard, ...wit.slice(0, 3)].filter(Boolean);
    return { judge, guard, wit, party };
  }

  // Leader, a guard and the witnesses come to the jail.
  summon(L) {
    const j = this.jail;
    const { judge, guard, wit, party } = this.partyOf(L);
    j.judge = judge ? judge.idx : null;
    j.guard = guard ? guard.idx : null;
    j.witnesses = wit.slice(0, 3).map((r) => r.idx);
    j.party = party.map((r) => r.idx);
    const now = this.sim.abs;
    const spots = this.trialSpots(L, party.length);
    party.forEach((r, i) => {
      setOverride(r, now, now + 300, 'trial', { target: spots[i], place: 'jail' });
      if (r.ent && !r.ent.dead) {
        r.ent.wake();
        r.ent.activity = null;
      }
    });
  }

  script(L) {
    const j = this.jail;
    const sid = L.settlement.id;
    const npc = (i) => (i === null || i === undefined ? null : L.npcs[i]);
    const judge = npc(j.judge);
    const guard = npc(j.guard);
    const crimes = this.pendingIn(sid);
    const worst = [...crimes].sort((a, b) => SEV_RANK[b.sev] - SEV_RANK[a.sev])[0];
    const lines = [];
    const say = (r, text) => lines.push({ idx: r ? r.idx : null, text });
    say(judge, j.how === 'surrender' ? 'You gave yourself up. That counts for something.' : 'Well now. What have we here?');
    if (guard) say(guard, worst ? `We brought them in for ${lcFirst(describe(worst))}.` : 'Caught them causing trouble.');
    for (const i of j.witnesses) {
      const w = npc(i);
      const c = crimes.find((q) => q.witnesses.includes(i));
      if (!w || !c) continue;
      say(judge, `${w.name.first}, you saw what happened?`);
      say(w, testimony(c));
    }
    // Nobody saw the deed itself: put together who was where, and when.
    for (const c of crimes.filter((q) => q.suspected)) {
      const seen = (c.seen || []).map((i) => npc(i)).filter((r) => r && alive(r));
      say(judge, `No one saw ${c.type === 'murder' ? 'the killing' : 'the theft'} itself. So who was near when ${c.type === 'murder' ? `${(c.victim || 'the victim').split(' ')[0]} died` : 'the goods went missing'}?`);
      for (const r of seen.slice(0, 2)) {
        say(judge, `${r.name.first}?`);
        say(r, `I saw them right near there, ${c.when ? `around ${c.when}` : 'about that time'}.`);
      }
      if (c.found && guard) say(guard, `And the stolen goods were in their pack when we took them in.`);
      const score = seen.length + (c.found ? 2 : 0);
      say(judge, score >= 2 ? 'Put together, that is hard to explain away.' : 'One sighting alone proves nothing.');
    }
    say(judge, 'I have heard enough.');
    return lines;
  }

  update(dt) {
    this.haltCd -= dt;
    if (this.pendingEscort !== null && this.pendingEscort !== undefined && this.game.active.has(this.pendingEscort)) {
      const sid = this.pendingEscort;
      this.pendingEscort = null;
      this.imprison(sid, 'surrender', true);
    }
    if (this.escort) this.updateEscort(dt);
    if (this.jail) this.updateJail(dt);
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 1;
      this.recordSightings();
      this.investigate();
      this.updateRepairs();
      this.patrol();
    }
  }

  updateJail(dt) {
    const j = this.jail;
    const game = this.game;
    const L = this.sim.layoutOf(j.sid);
    j.t += dt;
    if (j.phase === 'night') {
      if (j.t > 2) {
        j.t = 0;
        if (this.trialReady(L)) {
          game.ui.msg('Morning. The hearing is being called.', '#e8c080');
          this.beginTrial(L);
        }
      }
    } else if (j.phase === 'gather') {
      const target = L.jail ? L.jail.front : { x: L.plaza.cx, z: L.plaza.cz + 2 };
      const ents = j.party.map((i) => L.npcs[i]?.ent).filter((e) => e && !e.dead);
      const here = ents.filter((e) => e.atGoal || Math.max(Math.abs(e.x - target.x), Math.abs(e.z - target.z)) <= 2);
      if ((j.t > 2 && here.length === ents.length) || j.t > 50) {
        j.phase = 'hearing';
        j.lines = this.script(L);
        j.li = 0;
        j.lt = 0.5;
      }
    } else if (j.phase === 'hearing') {
      j.lt -= dt;
      if (j.lt <= 0) {
        const line = j.lines[j.li++];
        if (!line) {
          j.phase = 'verdict';
          this.verdictData = this.verdict();
          game.ui.openTrial?.(this.verdictData);
          return;
        }
        const r = line.idx !== null ? L.npcs[line.idx] : null;
        if (r && r.ent && !r.ent.dead) {
          r.ent.say(line.text, 3.2);
          r.ent.face(game.player.x, game.player.z);
        } else game.ui.msg(`${r ? r.name.first : 'Someone'}: "${line.text}"`, '#e8e0c0');
        j.lt = Math.min(4, 1.6 + line.text.length * 0.045);
      }
    } else if (j.phase === 'verdict') {
      if (!game.ui.find?.('trial') && game.ui.openTrial) game.ui.openTrial(this.verdictData);
    } else if (j.phase === 'serving') {
      if (this.sim.abs >= j.release) this.release('served');
    }
    // Leaving the cell without being released is an escape.
    if (j && this.jail === j && !j.cellless && L.jail && j.phase !== 'free') {
      const p = game.player;
      const inCell = L.jail.cell.some((c) => c.x === p.x && c.z === p.z);
      if (!inCell && !p.moving) this.escape(L);
    }
  }

  verdict() {
    const j = this.jail;
    const L = this.sim.layoutOf(j.sid);
    const s = L.settlement;
    const judge = j.judge !== null ? L.npcs[j.judge] : null;
    const crimes = this.pendingIn(j.sid);
    const charges = crimes.map((c) => {
      const names = c.witnesses.map((i) => L.npcs[i]).filter((r) => r && alive(r)).map((r) => `${r.name.first} ${r.name.last}`);
      const seenNames = (c.seen || []).map((i) => L.npcs[i]).filter((r) => r && alive(r)).map((r) => `${r.name.first} ${r.name.last}`);
      const direct = c.guardSaw || names.length > 0;
      const score = seenNames.length + (c.found ? 2 : 0);
      const proven = direct || score >= 2;
      return { ...c, text: describe(c), names, seenNames, proven, circumstantial: !direct && seenNames.length > 0 };
    });
    const proven = charges.filter((c) => c.proven);
    // A guard on trial is a disgrace to the watch, whatever the verdict.
    const stripped = this.sim.careers.isGuard(j.sid) ? this.sim.careers.stripGuard('held on trial') : null;
    const rec = this.recordOf(j.sid);
    const prior = rec.moderate + rec.severe;
    const seriousNow = proven.filter((c) => SEV_RANK[c.sev] >= 2).length;
    const severeNow = proven.some((c) => c.sev === 'severe');
    const harsh = (s.civ && s.civ.values.includes('martial')) || (judge && judge.personality.temper > 0.55);
    let sentence = 'fine';
    if (seriousNow && prior + seriousNow >= 3) sentence = severeNow && (harsh || rec.severe >= 1) ? 'death' : 'exile';
    else if (severeNow && rec.severe >= 1) sentence = 'death';
    const e = L.econ;
    let fine = 0;
    for (const c of proven) fine += CRIMES[c.type].fine + (c.type === 'theft' ? c.value * 2 : 0);
    const mercy = judge ? 1.15 - judge.personality.kindness * 0.3 : 1;
    // (Iron law: dearer fines; clemency: shorter terms.)
    const T = this.sim.tech;
    fine = Math.round(fine * e.fineScale * mercy * (this.sim.isCitizen(j.sid) ? 0.9 : 1) * (j.how === 'surrender' ? 0.85 : 1) * (T && T.has(s, 'ironlaw') ? 1.5 : 1));
    const coins = countItem(this.game.player.inv, 'coin');
    const hours = clamp(Math.ceil((fine / HOURLY_RATE) * (T && T.has(s, 'clemency') ? 0.5 : 1)), 2, 72);
    return {
      sid: j.sid, town: s.name, judgeName: judge ? `${judge.name.first} ${judge.name.last}` : 'The council', judgeTitle: judge ? jobTitle(judge, s) : 'Council',
      charges, proven, fine, hours, coins, canPay: coins >= fine, sentence, citizen: this.sim.isCitizen(j.sid), pleaded: false, prior,
      fineScale: e.fineScale, weapons: this.held && this.held.items.length ? (proven.some((c) => c.type === 'murder') ? 'forfeit' : 'returned') : null,
      stripped,
    };
  }

  // Player's choice in the trial window: 'pay' | 'serve' | 'plead' | 'accept' | 'free'.
  resolve(choice) {
    const v = this.verdictData;
    const j = this.jail;
    if (!v || !j) return null;
    const game = this.game;
    const L = this.sim.layoutOf(v.sid);
    const judge = j.judge !== null ? L.npcs[j.judge] : null;
    if (choice === 'plead') {
      if (v.pleaded) return v;
      v.pleaded = true;
      const op = judge && judge.ent ? this.sim.opinion(judge.ent) : 0;
      const chance = 0.25 + (judge ? judge.personality.kindness * 0.4 : 0.2) + op / 200;
      if (Math.random() < chance) {
        v.fine = Math.round(v.fine * 0.7);
        v.hours = clamp(Math.ceil(v.fine / HOURLY_RATE), 1, 72);
        v.canPay = v.coins >= v.fine;
        v.mercy = true;
        if (v.sentence === 'death') v.sentence = 'exile';
      } else {
        v.mercy = false;
        if (judge && judge.ent) this.sim.changeRep(judge.ent, -4);
      }
      return v;
    }
    this.convict(L, v);
    if (!v.proven.length || choice === 'free') return this.release('acquitted');
    if (v.sentence === 'exile') return this.exile(L, v);
    if (v.sentence === 'death') return this.execute(L, v);
    if (choice === 'pay' && v.canPay) {
      removeItem(game.player.inv, 'coin', v.fine);
      L.econ.treasury += v.fine;
      ledger(L, game.day, `${game.playerName} paid a fine of ¤${v.fine} (${v.proven.map((c) => CRIMES[c.type].label.toLowerCase()).join(', ')}).`);
      return this.release('paid');
    }
    j.phase = 'serving';
    j.release = this.sim.abs + v.hours * 60;
    ledger(L, game.day, `${game.playerName} was jailed for ${v.hours} hours (${v.proven.map((c) => CRIMES[c.type].label.toLowerCase()).join(', ')}).`);
    game.ui.msg(`Sentenced to ${v.hours} hours in the cell. Sleep on the cot to pass the time.`, '#ffb080');
    this.dismissParty(L);
    return v;
  }

  convict(L, v) {
    this.forfeit = v.proven.some((c) => c.type === 'murder');
    const rec = this.recordOf(v.sid);
    for (const c of v.proven) {
      rec[c.sev]++;
      rec.convictions++;
    }
    this.pending.delete(v.sid);
    this.resisted.delete(v.sid);
    if (v.proven.length && this.sim.isCitizen(v.sid)) this.sim.revoke('convicted of a crime');
    // Answered for desertion here: the charge is dropped across the realm.
    if (v.proven.some((c) => c.type === 'desertion')) this.sim.war.pardonDesertion(L.settlement.civ);
    if (v.proven.length) this.sim.careers.onConviction(v.sid);
    for (const c of v.proven) {
      // Victims and witnesses feel a little better once justice is done.
      for (const i of c.witnesses) if (L.npcs[i] && L.npcs[i].ent) this.sim.changeRep(L.npcs[i].ent, 2);
    }
  }

  dismissParty(L) {
    const j = this.jail;
    for (const i of j.party) {
      const r = L.npcs[i];
      if (r && r.override && r.override.act === 'trial') r.override = null;
    }
  }

  release(why) {
    const j = this.jail;
    if (!j) return null;
    const game = this.game;
    const L = this.sim.layoutOf(j.sid);
    this.dismissParty(L);
    this.setCellDoor(L, true);
    const guard = j.guard !== null && j.guard !== undefined ? L.npcs[j.guard] : null;
    if (guard && guard.ent && !guard.ent.dead) guard.ent.say(why === 'acquitted' ? 'Off you go, then.' : 'You\'re free to go. Behave yourself.', 3);
    this.returnWeapons(this.forfeit);
    this.forfeit = false;
    // A prisoner of war: let go, traded back, or freed by the peace.
    if (j.pow) {
      game.ui.msg(why === 'peace' ? 'Peace is made, and the prisoners are let go: you are free.' : why === 'exchanged' ? 'You\'re traded back for one of theirs. You are free.' : 'They\'ve no more use for you: the cell door opens. You are free.', '#80e070');
      this.jail = null;
      return { released: true };
    }
    game.ui.msg(why === 'acquitted' ? 'Nothing could be proven. You are free to go.' : why === 'paid' ? 'Fine paid. You are free to go.' : 'Your time is served. You are free.', '#80e070');
    this.jail = null;
    return { released: true };
  }

  // Breaking out: an empty cell doesn't lie, so the town knows. Guards who
  // spot you will try to arrest you, and the jail gets patched up.
  escape(L) {
    const j = this.jail;
    const p = this.game.player;
    this.dismissParty(L);
    this.jail = null;
    this.stashWeapons(L);
    this.game.ui.msg('You broke out of jail! The guards will be looking for you.', '#ffb080');
    const wits = this.sim.witnesses(j.sid, p.x, p.z, 9);
    this.commit(j.sid, 'jailbreak', { witnesses: wits, known: true });
    this.repairs.push({ sid: j.sid, at: this.sim.abs + 20, floor: j.floor || null });
    ledger(L, this.game.day, `${this.game.playerName} broke out of the jail.`);
  }

  // The blocks that make up a jail cell, and which are missing.
  jailDamage(L, rep) {
    const jl = L.jail;
    if (!jl || !jl.blocks) return [];
    const w = this.game.world;
    const want = [...jl.blocks, ...(rep && rep.floor ? rep.floor : [])];
    return want.filter(([x, y, z, id]) => w.regionAt(x, z) && w.getBlock(x, y, z) !== id);
  }

  // A guard goes to fix the jail after a breakout.
  updateRepairs() {
    if (!this.repairs.length) return;
    const game = this.game;
    const now = this.sim.abs;
    this.repairs = this.repairs.filter((r) => {
      if (now < r.at) return true;
      const L = this.sim.layoutOf(r.sid);
      if (!L || !L.jail) return false;
      const a = game.active.get(r.sid);
      const missing = this.jailDamage(L, r);
      if (!a) {
        // Nobody to watch: the town just fixes it.
        this.sim.setBlocks(L.jail.blocks.map((b) => [...b]));
        return false;
      }
      if (!missing.length) return false;
      if (r.guard && L.npcs[r.guard] && L.npcs[r.guard].override && L.npcs[r.guard].override.act === 'repair') return true;
      const guards = game.guardsOf(r.sid).filter((g) => g.state === 'routine' && !g.sleeping && !g.hired);
      if (!guards.length) return now < r.at + 600;
      const f = L.jail.front;
      guards.sort((p, q) => Math.hypot(p.x - f.x, p.z - f.z) - Math.hypot(q.x - f.x, q.z - f.z));
      const g = guards[0];
      setOverride(g.rec, now, now + 180, 'repair', { target: { x: f.x, z: f.z }, place: 'jail', sid: r.sid });
      g.activity = null;
      r.guard = g.rec.idx;
      return true;
    });
  }

  exile(L, v) {
    const game = this.game;
    const s = L.settlement;
    this.exiled.add(s.id);
    ledger(L, game.day, `${game.playerName} was banished from ${s.name} by ${v.judgeName}.`);
    this.dismissParty(L);
    this.jail = null;
    // Escorted out of town.
    const b = s.bounds;
    const e = L.entrances[0] || { x: b.x0, z: (b.z0 + b.z1) >> 1 };
    const dx = e.x <= b.x0 + 2 ? -8 : e.x >= b.x1 - 2 ? 8 : 0;
    const dz = e.z <= b.z0 + 2 ? -8 : e.z >= b.z1 - 2 ? 8 : dx === 0 ? 8 : 0;
    game.advanceTime(30);
    game.teleportPlayer(e.x + dx, GROUND, e.z + dz);
    this.returnWeapons(v.proven.some((c) => c.type === 'murder'));
    game.ui.msg(`You have been EXILED from ${s.name}. Its guards will attack you on sight.`, '#ff5050');
    game.ui.showKnockout?.('exile', s.name, 0);
    return { exiled: true };
  }

  execute(L, v) {
    const game = this.game;
    this.dismissParty(L);
    this.jail = null;
    this.held = null;
    ledger(L, game.day, `${game.playerName} was executed by order of ${v.judgeName}.`);
    game.executePlayer(`the executioner of ${L.settlement.name}`);
    return { executed: true };
  }

  // ------------------------------------------------------------ patrols
  // Laws that are checked as you walk around: trespassing in homes at night,
  // weapons bans, and exile.
  patrol() {
    const game = this.game;
    const p = game.player;
    const s = game.currentSettlement;
    if (!s || !game.active.has(s.id) || p.dead || this.jail) return;
    const a = game.active.get(s.id);
    const L = a.layout;
    if (this.exiled.has(s.id)) {
      if (this.exileWarn !== s.id) {
        this.exileWarn = s.id;
        game.ui.msg(`You are exiled from ${s.name}! The guards will attack.`, '#ff5050');
      }
      for (const g of game.guardsOf(s.id)) if (!g.sleeping && g.distTo(p) <= 16 && g.state !== 'fight') g.engage(p);
      return;
    }
    this.exileWarn = -1;
    const m = game.minute;
    const night = m >= 1320 || m < 330;
    const b = this.game.buildingAtPlayer?.();
    const c = this.sim.citizen;
    const mine = b && c && c.sid === s.id && (b.id === c.home || b.id === c.host);
    if (night && b && b.residential && !mine) {
      const residents = a.npcs.filter((n) => n.rec.home === b.id && !n.sleeping && !n.dead && n.x >= b.x0 && n.x <= b.x1 && n.z >= b.z0 && n.z <= b.z1);
      if (residents.length) {
        if (!this.trespass || this.trespass.b !== b.id) {
          this.trespass = { b: b.id, t: 0 };
          residents[0].say('Hey! What are you doing in our house? Get out!', 3.5, '#ffb080');
          this.sim.changeRep(residents[0], -5);
        } else if ((this.trespass.t += 1) >= 10 && !this.trespass.done) {
          this.trespass.done = true;
          this.commit(s.id, 'trespass', { witnesses: residents, desc: `Trespassing in the ${b.homeName || 'house'}` });
        }
      }
    } else this.trespass = null;
    const held = p.heldDef();
    // Guards of the town may carry arms where others may not.
    if (lawOn(L, 'armsBan') && held && held.kind === 'weapon' && !game.isWanted(s.id) && !this.sim.careers.isGuard(s.id)) {
      const guard = a.npcs.find((n) => n.rec.job === 'guard' && !n.sleeping && n.state === 'routine' && n.distTo(p) <= 5);
      if (guard) {
        if (!this.brandish) {
          this.brandish = { t: 0 };
          guard.say(`Put that weapon away! It's the law in ${s.name}.`, 3.5, '#ffe070');
        } else if ((this.brandish.t += 1) >= 12 && !this.brandish.done) {
          this.brandish.done = true;
          this.commit(s.id, 'brandishing', { witnesses: [guard] });
        }
      }
    } else if (!held || held.kind !== 'weapon') this.brandish = null;
    // Out in the streets after curfew (guards on duty and people heading
    // into their own house excepted): a guard on watch who sees you comes
    // over, tells you to get indoors, and fines you if you don't.
    const late = m >= 1320 || m < 300;
    if (lawOn(L, 'curfew') && late) this.curfewWatch(a, L, p, b);
    else this.curfewT = null;
  }

  curfewWatch(a, L, p, b) {
    const game = this.game;
    const s = L.settlement;
    const now = this.sim.abs;
    const onWatch = (n) => n.rec.job === 'guard' && !n.dead && !n.sleeping && (n.state === 'routine' || n.state === 'curfew');
    // The player.
    if (!b && !this.sim.careers.isGuard(s.id) && !game.isWanted(s.id)) {
      const c = this.curfewT;
      let guard = c && c.guard && onWatch(c.guard) ? c.guard : null;
      if (!guard) guard = this.sim.witnesses(s.id, p.x, p.z, 12).find(onWatch) || null;
      if (guard) {
        const d = guard.distTo(p);
        if (!this.curfewT || this.curfewT.guard !== guard) this.curfewT = { t: 0, guard, warned: false, done: false };
        const ct = this.curfewT;
        // Over to you first (and, once they've warned you, they stay and
        // keep an eye on you till you're indoors).
        if (!ct.done && (d > 3 || ct.warned)) {
          setOverride(guard.rec, now, now + 15, 'watch', { target: { x: p.x, z: p.z }, curfew: true });
          if (guard.activity && guard.activity.entry.act !== 'watch') guard.activity = null;
          else if (guard.goal && Math.abs(guard.goal.x - p.x) + Math.abs(guard.goal.z - p.z) > 2) guard.activity = null;
        }
        if (d <= 4 && !ct.warned) {
          ct.warned = true;
          guard.face(p.x, p.z);
          guard.say(guard.rng.pick(['It\'s past curfew! Get indoors, or I\'ll have to fine you.', 'Curfew! Off the streets, now.', 'You there! Home with you. It\'s past ten.']), 3.5, '#ffe070');
        } else if (ct.warned && !ct.done && (ct.t += 1) >= 20 && d <= 8) {
          ct.done = true;
          guard.say('I warned you.', 2.5, '#ffb080');
          this.commit(s.id, 'curfew', { witnesses: [guard] });
          if (guard.rec.override && guard.rec.override.curfew) guard.rec.override = null;
        }
      }
    } else if (b && this.curfewT) {
      // Indoors: that's all they wanted (and next time is a new warning).
      const g = this.curfewT.guard;
      if (g && g.rec.override && g.rec.override.curfew) {
        g.rec.override = null;
        g.activity = null;
      }
      this.curfewT = null;
    }
    // Townsfolk still out: sent home.
    this.curfewSent ||= new Map();
    for (const g of a.npcs) {
      if (!onWatch(g)) continue;
      for (const n of a.npcs) {
        if (n === g || n.dead || n.sleeping || n.rec.job === 'guard' || n.state !== 'routine' || n.hired) continue;
        if (Math.max(Math.abs(n.x - g.x), Math.abs(n.z - g.z)) > 6 || L.buildings.some((q) => n.x >= q.x0 && n.x <= q.x1 && n.z >= q.z0 && n.z <= q.z1)) continue;
        if ((this.curfewSent.get(n) || -1e9) > now - 60) continue;
        if (!this.sim.canSee(g, n.x, n.z)) continue;
        this.curfewSent.set(n, now);
        g.say(g.rng.pick([`${n.rec.name.first}! Curfew. Home with you.`, 'Off the streets, you. It\'s late.', 'Curfew! Indoors, please.']), 3, '#ffe070');
        n.sayLater?.(n.rng.pick(['Yes, yes, I\'m going.', 'Just on my way home!', 'Sorry, officer.']), 1.4, 2.5);
        n.face(g.x, g.z);
        if (!n.visit && !n.nomad && !n.adventurer && !n.company) {
          setOverride(n.rec, now, now + 120, 'home', {});
          n.activity = null;
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------ save
  serialize() {
    const j = this.jail ? { ...this.jail, lines: [], phase: this.jail.phase === 'serving' || this.jail.phase === 'night' ? this.jail.phase : 'gather', t: 0 } : null;
    return { pending: [...this.pending], record: [...this.record], exiled: [...this.exiled], jail: j, held: this.held, escortSid: this.escort ? this.escort.sid : null, unsolved: this.unsolved, sightings: [...this.sightings], repairs: this.repairs.map((r) => ({ sid: r.sid, at: r.at, floor: r.floor })) };
  }

  load(d) {
    if (!d) return;
    this.pending = new Map(d.pending || []);
    this.record = new Map(d.record || []);
    this.exiled = new Set(d.exiled || []);
    this.jail = d.jail || null;
    this.held = d.held || null;
    this.unsolved = d.unsolved || [];
    this.sightings = new Map(d.sightings || []);
    this.pendingEscort = d.escortSid ?? null;
    this.repairs = d.repairs || [];
  }

  // The cell floor as it was when you were locked in (for repairs).
  floorOf(L) {
    const w = this.game.world;
    if (!L || !L.jail) return null;
    return L.jail.cell.filter((t) => w.regionAt(t.x, t.z)).map((t) => [t.x, L.jail.y - 1, t.z, w.getBlock(t.x, L.jail.y - 1, t.z), 0]);
  }
}

// "a wood sword, a hunting bow and 20 arrows"
export function listItems(items) {
  const parts = items.map((w) => `${w.count > 1 ? `${w.count} ` : ''}${ITEMS[w.item].name.toLowerCase()}${w.count > 1 && !/s$/.test(ITEMS[w.item].name) ? 's' : ''}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || '';
}

export function lcFirst(s) {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

export function describe(c) {
  switch (c.type) {
    case 'theft': return c.desc && c.desc !== 'Theft' ? c.desc : `Theft worth ¤${c.value}`;
    case 'assault': return c.victim ? `Assaulting ${c.victim}` : 'Assault';
    case 'assault_guard': return c.victim ? `Assaulting guard ${c.victim}` : 'Assaulting a guard';
    case 'murder': return c.victim ? `The murder of ${c.victim}` : 'Murder';
    default: return c.desc || CRIMES[c.type].label;
  }
}

function testimony(c) {
  switch (c.type) {
    case 'theft': return c.items && c.items.length ? `I saw them take ${c.items.map((i) => `${i.count} ${ITEMS[i.item]?.name || i.item}`).slice(0, 2).join(' and ')}!` : 'I saw them stealing, plain as day!';
    case 'assault': case 'assault_guard': return c.victim ? `They attacked ${c.victim.split(' ')[0]}! Just like that!` : 'They started a fight!';
    case 'murder': return c.victim ? `They killed ${c.victim.split(' ')[0]}! I saw it all...` : 'I saw them kill someone!';
    case 'vandalism': return 'They were smashing up the town!';
    case 'trespass': return 'They crept into a house in the middle of the night!';
    case 'jailbreak': return 'They broke out of this very cell!';
    case 'brandishing': return 'Waving a weapon about after being told not to.';
    case 'curfew': return 'Out in the streets in the dead of night, after curfew, and wouldn\'t go home.';
    case 'poaching': return 'Hunting the town\'s game with no licence!';
    case 'felling': return 'Chopping down the trees right here in town!';
    default: return 'I saw the whole thing.';
  }
}

export { DAY };

// Items taken, with the same things added together.
function mergeItems(a, b) {
  const out = (a || []).map((q) => ({ ...q }));
  for (const q of b || []) {
    const had = out.find((o) => o.item === q.item);
    if (had) had.count += q.count;
    else out.push({ ...q });
  }
  return out;
}

// "Stealing 3 Bread, 2 Apple and more from the Golden Crust".
function theftDesc(desc, items) {
  const from = (desc || '').match(/ from .*$/);
  const what = items.map((t) => `${t.count} ${ITEMS[t.item]?.name || t.item}`);
  return `Stealing ${what.slice(0, 2).join(', ')}${what.length > 2 ? ' and more' : ''}${from ? from[0] : ''}`;
}
