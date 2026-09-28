// The player's working life: an official profession granted by a mayor
// (town guard, trapper, fisher, farmer), a paid job at someone's shop, and
// guards hired to travel along as escorts.
import { JOBS } from '../entities/npcgen.js';
import { alive, ledger } from './econ.js';
import { countItem, removeItem } from '../game/inventory.js';

export const PROFESSIONS = {
  guard: {
    title: 'Town Guard', citizen: true, minOp: 10,
    kit: [['iron_sword', 1], ['bow', 1], ['arrow', 20], ['guard_badge', 1]],
    pitch: 'Guards keep the peace from dawn to dusk. You\'d be paid for every hour on duty in town, plus a bounty for each beast put down near our walls.',
  },
  trapper: {
    title: 'Trapper', fee: 8, minOp: -10, kit: [['bow', 1], ['arrow', 12], ['snare', 2]], goods: ['raw_meat', 'leather', 'feather'],
    pitch: 'A licensed trapper may empty the town\'s snares and hunt our woods, and the kitchen pays a premium for meat and hides.',
  },
  fisher: {
    title: 'Fisher', fee: 6, minOp: -10, kit: [['fishing_rod', 1]], goods: ['fish', 'cooked_fish'],
    pitch: 'Licensed fishers sell their catch to our kitchens and traders at a premium.',
  },
  farmer: {
    title: 'Farmer', fee: 6, minOp: -10, kit: [['hoe', 1], ['seeds', 8]], goods: ['wheat', 'carrot', 'cabbage', 'pumpkin'],
    pitch: 'You may work and harvest the town fields as your own, and our traders pay a premium for your crops.',
  },
};

const ROLES = {
  smithy: 'Smith\'s Helper', tavern: 'Tavern Hand', shop: 'Shop Hand', bakery: 'Baker\'s Helper', library: 'Library Clerk',
  tailor: 'Tailor\'s Apprentice', workshop: 'Carpenter\'s Apprentice', herbalist: 'Herbalist\'s Assistant',
};

export const PREMIUM = 1.3;
const GUARD_ARMOR = 0.25;
const DUTY_START = 360;
const DUTY_END = 1200;
const HIRE_HOURS = [4, 12, 24, 72];

function buildingAt(L, x, z) {
  for (const b of L.buildings) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b;
  return null;
}

function within(b, x, z, pad = 0) {
  return x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad;
}

// Building names without a leading article ("the Sleeping Dragon").
export function bare(name) {
  return name.replace(/^The /, '');
}

export function clock(m) {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.floor(m % 60);
  return `${h}:${String(mm).padStart(2, '0')}`;
}

export class Careers {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.job = null;
    this.kits = new Set(); // `${sid}:${job}`: starter kits already handed out
    this.escort = null; // { sid, idx, name, until, fee }
    this.returning = []; // escorts walking home: { sid, idx, at }
    this.oldLook = null;
    this.ent = null;
    this.lastAbs = null;
    this.lastStep = -1e9;
  }

  // Guards on duty have to actually walk their beat.
  onStep() {
    this.lastStep = this.sim.abs;
  }

  // ------------------------------------------------------------ profile
  townName(sid) {
    const s = this.game.world.ow.settlements[sid];
    return s ? s.name : '?';
  }

  title() {
    const j = this.job;
    if (!j) return null;
    if (j.kind === 'profession') return `${PROFESSIONS[j.job].title} of ${this.townName(j.sid)}`;
    return `${j.role}, ${j.bname}`;
  }

  isGuard(sid) {
    const j = this.job;
    return !!j && j.kind === 'profession' && j.job === 'guard' && (sid === undefined || j.sid === sid);
  }

  licensed(job, sid) {
    const j = this.job;
    return !!j && j.kind === 'profession' && j.job === job && j.sid === sid;
  }

  armor() {
    return this.isGuard() ? GUARD_ARMOR : 0;
  }

  // Licensed trappers, fishers and farmers get a better price for their goods.
  sellFactor(npc, item) {
    const j = this.job;
    if (!j || j.kind !== 'profession' || npc.visit || npc.settlement.id !== j.sid) return 1;
    const goods = PROFESSIONS[j.job].goods;
    return goods && goods.includes(item) ? PREMIUM : 1;
  }

  // Staff discount at the shop you work for.
  discount(npc) {
    const j = this.job;
    if (!j || j.kind !== 'employee' || npc.visit || npc.settlement.id !== j.sid) return 1;
    return npc.rec.work && npc.rec.work.building === j.building ? 0.85 : 1;
  }

  applyLook() {
    const p = this.game.player;
    if (!p) return;
    if (this.isGuard()) {
      if (!this.oldLook) this.oldLook = { outfit: p.look.outfit, hat: p.look.hat };
      p.look = { ...p.look, outfit: 'guard', hat: 'helmet' };
    } else if (this.oldLook) {
      p.look = { ...p.look, ...this.oldLook };
      this.oldLook = null;
    }
  }

  // Short status lines for the HUD.
  hudLines() {
    const g = this.game;
    const p = g.player;
    const out = [];
    if (this.escort && this.ent && !this.ent.dead) out.push({ text: `Escort ${this.ent.rec.name.first} · ${Math.ceil(this.hoursLeft())}h left`, color: '#80e0ff' });
    const j = this.job;
    if (!j || !p || p.restrained || this.sim.justice.jail) return out;
    const min = g.minute;
    const here = g.currentSettlement && g.currentSettlement.id === j.sid;
    if (j.kind === 'profession' && j.job === 'guard' && here && min >= DUTY_START && min < DUTY_END) {
      const walking = this.sim.abs - this.lastStep < 20;
      out.push({ text: walking ? `On patrol · ${(j.duty / 60).toFixed(1)}h today` : 'On duty · walk your beat', color: walking ? '#80e070' : '#ffb060' });
    }
    if (j.kind === 'employee' && min >= j.shift[0] && min < j.shift[1]) {
      const L = this.sim.layoutOf(j.sid);
      const b = L && buildingAt(L, p.x, p.z);
      if (b && b.id === j.building) out.push({ text: `At work · ${(j.worked / 60).toFixed(1)}h today`, color: '#80e070' });
      else out.push({ text: `Shift at the ${j.bname}!`, color: '#ffb060' });
    }
    return out;
  }

  // Lines describing the current job for the journal.
  jobDetails() {
    const j = this.job;
    if (!j) return [];
    if (j.kind === 'profession') {
      const out = [PROFESSIONS[j.job].pitch];
      if (j.job === 'guard') out.push(`Patrol the town between ${clock(DUTY_START)} and ${clock(DUTY_END)}: time spent walking your beat is paid at ${clock(DUTY_END)}. On duty today: ${(j.duty / 60).toFixed(1)}h. Beasts slain: ${j.bounties}.`);
      out.push(`Sworn in on day ${j.since}. Earned so far: ¤${j.earned}.`);
      return out;
    }
    return [
      `Working for ${j.employerName} at the ${j.bname}, ${this.townName(j.sid)}.`,
      `Shift ${clock(j.shift[0])}-${clock(j.shift[1])} inside the shop · ¤${j.wage}/hour, paid at closing.`,
      `Worked today: ${(j.worked / 60).toFixed(1)}h. Earned so far: ¤${j.earned}. Staff discount at the shop.`,
    ];
  }

  // ------------------------------------------------------------ professions
  professionTerms(mayor, job) {
    const L = mayor.layout;
    const s = L.settlement;
    const P = PROFESSIONS[job];
    const sim = this.sim;
    if (!P) return { ok: false, reason: 'unknown' };
    if (sim.justice.exiled.has(s.id)) return { ok: false, reason: 'exiled' };
    if (sim.justice.pendingIn(s.id).length || this.game.isWanted(s.id)) return { ok: false, reason: 'crimes' };
    if (P.citizen && !sim.isCitizen(s.id)) return { ok: false, reason: 'citizen' };
    if (P.citizen && sim.justice.recordOf(s.id).convictions) return { ok: false, reason: 'record' };
    if (sim.opinion(mayor) < P.minOp) return { ok: false, reason: 'distrust' };
    if (this.licensed(job, s.id)) return { ok: false, reason: 'already' };
    const fee = P.citizen || sim.isCitizen(s.id) ? 0 : P.fee * (s.type === 'city' ? 2 : 1);
    return { ok: true, fee, kit: !this.kits.has(`${s.id}:${job}`) };
  }

  takeProfession(mayor, job) {
    const t = this.professionTerms(mayor, job);
    if (!t.ok) return t;
    const g = this.game;
    const p = g.player;
    const L = mayor.layout;
    const s = L.settlement;
    if (countItem(p.inv, 'coin') < t.fee) return { ok: false, reason: 'money', fee: t.fee };
    if (t.fee) {
      removeItem(p.inv, 'coin', t.fee);
      L.econ.treasury += t.fee;
    }
    if (this.job) this.resign(null, true);
    this.job = { kind: 'profession', job, sid: s.id, since: g.day, duty: 0, dutyDay: g.day, paidDay: -1, earned: 0, bounties: 0 };
    const given = [];
    if (t.kit) {
      this.kits.add(`${s.id}:${job}`);
      for (const [item, n] of PROFESSIONS[job].kit) {
        const left = p.give(item, n);
        if (left) g.spawnDrop(item, left, p.x, p.y, p.z, true);
        given.push({ item, count: n });
      }
    }
    this.applyLook();
    const title = PROFESSIONS[job].title;
    ledger(L, g.day, `${g.playerName} was sworn in as ${/^[AEIOU]/.test(title) ? 'an' : 'a'} ${title.toLowerCase()} of ${s.name}.`);
    this.sim.changeRep(mayor, 3);
    return { ok: true, fee: t.fee, given };
  }

  resign(reason, quiet = false) {
    const j = this.job;
    if (!j) return;
    const L = this.sim.layoutOf(j.sid);
    if (L) {
      if (j.kind === 'profession' && j.job === 'guard' && j.duty > 0) this.payDuty(L, j);
      if (j.kind === 'employee' && j.worked > 0) this.payWages(L, j);
    }
    this.job = null;
    const what = j.kind === 'profession' ? `your post as ${PROFESSIONS[j.job].title.toLowerCase()} of ${this.townName(j.sid)}` : `your job at the ${j.bname}`;
    if (!quiet) this.game.ui.msg(reason ? `You lost ${what} (${reason}).` : `You left ${what}.`, reason ? '#ff9060' : '#e8e0a0');
    if (L) ledger(L, this.game.day, `${this.game.playerName} ${reason ? 'was dismissed from' : 'left'} ${j.kind === 'profession' ? `the post of ${PROFESSIONS[j.job].title.toLowerCase()}` : `work at the ${j.bname}`}.`);
    this.applyLook();
  }

  // A conviction or losing citizenship costs you your post in that town.
  onConviction(sid) {
    if (this.job && this.job.sid === sid) this.resign('convicted of a crime');
  }

  onRevoke(sid) {
    if (this.isGuard(sid)) this.resign('no longer a citizen');
  }

  // Guards earn a bounty for beasts slain near town.
  onKill(c) {
    const j = this.job;
    if (!this.isGuard() || !c.hostileNow) return 0;
    const L = this.sim.layoutOf(j.sid);
    if (!L || !within(L.bounds, c.x, c.z, 16)) return 0;
    const pay = Math.min(3, Math.floor(L.econ.treasury));
    if (pay <= 0) return 0;
    L.econ.treasury -= pay;
    this.pay(pay);
    j.bounties++;
    j.earned += pay;
    this.game.ui.msg(`Bounty: ¤${pay} from ${L.settlement.name} for the ${(c.name || 'beast').toLowerCase()}.`, '#ffe070');
    return pay;
  }

  pay(n) {
    const p = this.game.player;
    const left = p.give('coin', n);
    if (left) this.game.spawnDrop('coin', left, p.x, p.y, p.z, true);
    this.game.audio?.play('coin');
  }

  payDuty(L, j) {
    const hours = Math.min(10, j.duty / 60);
    const cond = L.settlement.condition;
    const rate = cond === 'prosperous' ? 3 : cond === 'poor' ? 1.5 : 2;
    const owed = Math.round(hours * rate);
    j.duty = 0;
    j.paidDay = this.game.day;
    if (owed <= 0) return 0;
    const paid = Math.max(0, Math.min(owed, Math.floor(L.econ.treasury)));
    L.econ.treasury -= paid;
    if (paid) this.pay(paid);
    j.earned += paid;
    this.game.ui.msg(`Guard pay from ${L.settlement.name}: ¤${paid} for ${hours.toFixed(1)}h on duty.${paid < owed ? ' The treasury is short.' : ''}`, '#ffe070');
    return paid;
  }

  // ------------------------------------------------------------ shop work
  canEmploy(npc) {
    const rec = npc.rec;
    if (npc.visit || npc.hired || rec.age !== 'adult') return false;
    if (!JOBS[rec.job]?.trader && rec.job !== 'barkeep') return false;
    const bid = rec.work && rec.work.building;
    return bid !== null && bid !== undefined && !!npc.layout.econ.biz[bid] && !!npc.layout.buildings[bid];
  }

  employs(npc) {
    const j = this.job;
    return !!j && j.kind === 'employee' && j.sid === npc.settlement.id && !npc.visit && j.employer === npc.rec.idx;
  }

  employTerms(npc) {
    const L = npc.layout;
    const s = L.settlement;
    const rec = npc.rec;
    const sim = this.sim;
    if (!this.canEmploy(npc)) return { ok: false, reason: 'none' };
    if (sim.justice.exiled.has(s.id) || sim.justice.pendingIn(s.id).length || this.game.isWanted(s.id)) return { ok: false, reason: 'crimes' };
    const op = sim.opinion(npc);
    if (op < 5) return { ok: false, reason: 'distrust' };
    const bid = rec.work.building;
    const b = L.buildings[bid];
    const biz = L.econ.biz[bid];
    const j = this.job;
    if (j && j.kind === 'employee' && j.sid === s.id && j.building === bid) return { ok: false, reason: 'already' };
    if (biz.till < 20) return { ok: false, reason: 'poor' };
    const wage = Math.max(2, Math.min(6, Math.round(2 + biz.till / 60))) + (op >= 35 ? 1 : 0);
    const J = JOBS[rec.job] || { start: 480, end: 1080 };
    const shift = [J.start, Math.min(J.end, J.start + 600)];
    return { ok: true, wage, shift, bid, role: ROLES[b.type] || 'Hired Hand', bname: bare(b.name) };
  }

  employ(npc) {
    const t = this.employTerms(npc);
    if (!t.ok) return t;
    const g = this.game;
    const L = npc.layout;
    if (this.job) this.resign(null, true);
    this.job = {
      kind: 'employee', sid: L.settlement.id, building: t.bid, bname: t.bname, role: t.role, employer: npc.rec.idx,
      employerName: npc.rec.name.first, wage: t.wage, shift: t.shift, worked: 0, workDay: g.day, paidDay: -1, lastDay: g.day, since: g.day, earned: 0,
    };
    ledger(L, g.day, `${npc.rec.name.first} took on ${g.playerName} at the ${t.bname}.`);
    this.sim.changeRep(npc, 2);
    return t;
  }

  payWages(L, j) {
    const hours = j.worked / 60;
    j.worked = 0;
    j.paidDay = this.game.day;
    const biz = L.econ.biz[j.building];
    if (!biz || hours <= 0) return 0;
    // An extra pair of hands brings in extra trade.
    const extra = Math.round(hours * j.wage * 0.6);
    biz.till += extra;
    biz.earned = (biz.earned || 0) + extra;
    const owed = Math.round(hours * j.wage);
    const paid = Math.max(0, Math.min(owed, Math.floor(biz.till)));
    biz.till -= paid;
    j.earned += paid;
    if (paid) this.pay(paid);
    this.game.ui.msg(`Wages from the ${j.bname}: ¤${paid} for ${hours.toFixed(1)}h of work.`, '#ffe070');
    const emp = L.npcs[j.employer];
    if (emp && paid >= 3 && hours >= 3) this.sim.changeRep(emp.ent && !emp.ent.dead ? emp.ent : { rec: emp, settlement: L.settlement }, 1);
    return paid;
  }

  fire(L, j, why) {
    this.job = null;
    const emp = L.npcs[j.employer];
    this.game.ui.msg(`${j.employerName}: "${why}" You were let go from the ${j.bname}.`, '#ff9060');
    ledger(L, this.game.day, `${j.employerName} let ${this.game.playerName} go from the ${j.bname}.`);
    if (emp) this.sim.changeRep(emp.ent && !emp.ent.dead ? emp.ent : { rec: emp, settlement: L.settlement }, -4);
  }

  // ------------------------------------------------------------ escorts
  hireTerms(guard) {
    const L = guard.layout;
    const s = L.settlement;
    const sim = this.sim;
    if (guard.rec.job !== 'guard' || guard.visit) return { ok: false, reason: 'none' };
    if (this.escort) return { ok: false, reason: this.ent === guard ? 'already' : 'busy' };
    if (sim.justice.exiled.has(s.id) || sim.justice.pendingIn(s.id).length || this.game.isWanted(s.id)) return { ok: false, reason: 'crimes' };
    const op = sim.opinion(guard);
    if (op < -10) return { ok: false, reason: 'distrust' };
    const others = L.npcs.filter((r) => r !== guard.rec && r.job === 'guard' && alive(r) && !r.away).length;
    if (!others) return { ok: false, reason: 'alone' };
    const rate = (s.condition === 'prosperous' ? 2 : 1.5) * (op >= 35 ? 0.8 : 1) * (sim.isCitizen(s.id) ? 0.9 : 1);
    const options = HIRE_HOURS.map((h) => ({ hours: h, fee: Math.max(3, Math.round(h * rate * (h >= 24 ? 0.75 : 1))) }));
    return { ok: true, options };
  }

  hire(guard, hours) {
    const t = this.hireTerms(guard);
    if (!t.ok) return t;
    const o = t.options.find((q) => q.hours === hours) || t.options[0];
    const g = this.game;
    const p = g.player;
    if (countItem(p.inv, 'coin') < o.fee) return { ok: false, reason: 'money', fee: o.fee };
    removeItem(p.inv, 'coin', o.fee);
    const L = guard.layout;
    const cut = Math.ceil(o.fee * 0.6);
    guard.rec.coins = (guard.rec.coins || 0) + cut;
    L.econ.treasury += o.fee - cut;
    this.escort = { sid: L.settlement.id, idx: guard.rec.idx, name: guard.name, until: this.sim.abs + o.hours * 60, fee: o.fee, hours: o.hours };
    this.attach(guard);
    ledger(L, g.day, `${guard.rec.name.first} was hired as an escort by ${g.playerName}.`);
    g.audio?.play('coin');
    return { ok: true, ...o };
  }

  attach(n) {
    n.hired = this.escort;
    n.state = 'hired';
    n.stateT = 0;
    n.path = null;
    n.threat = null;
    n.sleeping = false;
    n.releaseSpot();
    n.rec.away = true;
    n.rec.override = null;
    const a = this.game.active.get(this.escort.sid);
    if (a) a.npcs = a.npcs.filter((q) => q !== n);
    this.ent = n;
  }

  hoursLeft() {
    return this.escort ? Math.max(0, (this.escort.until - this.sim.abs) / 60) : 0;
  }

  // Beasts close to the player or the escort.
  escortThreat(n) {
    const p = this.game.player;
    let best = null;
    let bd = 99;
    for (const c of this.game.creatures) {
      if (c.dead || !c.hostileNow) continue;
      const d = Math.min(c.distTo(p), c.distTo(n) + 2);
      if (d <= 7 && d < bd) {
        best = c;
        bd = d;
      }
    }
    return best;
  }

  endEscort(line) {
    const n = this.ent;
    const e = this.escort;
    this.escort = null;
    this.ent = null;
    if (!e) return;
    const g = this.game;
    if (!n || n.dead) return;
    n.hired = null;
    if (line) n.say(line, 4);
    const L = n.layout;
    const a = g.active.get(L.settlement.id);
    if (a && within(L.bounds, n.x, n.z, 4)) {
      n.rec.away = false;
      if (!a.npcs.includes(n)) a.npcs.push(n);
      n.calmDown(true);
      return;
    }
    // Far from home: walk off down the road, back in town some hours later.
    const d = n.headHome();
    this.returning.push({ sid: L.settlement.id, idx: e.idx, at: this.sim.abs + Math.round(d * 0.4) + 30 });
  }

  updateEscort() {
    const e = this.escort;
    if (!e) return;
    const g = this.game;
    const n = this.ent;
    if (n && n.dead) {
      this.escort = null;
      this.ent = null;
      g.ui.msg(`Your escort ${e.name} has fallen.`, '#ff7060');
      return;
    }
    if (!n) {
      // Coming back from a save: the escort appears beside you.
      this.ent = g.spawnEscort ? g.spawnEscort(e) : null;
      if (!this.ent) this.escort = null;
      return;
    }
    const j = this.sim.justice;
    if (g.isWanted(e.sid) || j.exiled.has(e.sid) || j.pendingIn(e.sid).length) this.endEscort('I won\'t guard an outlaw. Our deal is off.');
    else if (j.jail || j.escort) this.endEscort('That\'s a matter for the law. I\'m off.');
    else if (this.sim.abs >= e.until) this.endEscort(n.rng.pick([`That's our time up. Safe travels, ${g.playerName}!`, 'Contract\'s done. Stay out of trouble!', 'Well, that\'s me finished. Take care out there.']));
  }

  updateReturning(abs) {
    if (!this.returning.length) return;
    this.returning = this.returning.filter((r) => {
      if (abs < r.at) return true;
      const L = this.sim.layoutOf(r.sid);
      const rec = L && L.npcs[r.idx];
      if (rec && alive(rec) && !(rec.ent && !rec.ent.dead)) rec.away = false;
      return !!(rec && rec.ent && !rec.ent.dead && rec.ent.state === 'leaving');
    });
  }

  // ------------------------------------------------------------ time
  update() {
    const abs = this.sim.abs;
    if (this.lastAbs === null) this.lastAbs = abs;
    const dm = Math.max(0, Math.min(180, abs - this.lastAbs));
    this.lastAbs = abs;
    if (this.job) this.updateJob(dm);
    this.updateEscort();
    this.updateReturning(abs);
  }

  updateJob(dm) {
    const j = this.job;
    const g = this.game;
    const p = g.player;
    const day = g.day;
    const min = g.minute;
    const L = this.sim.layoutOf(j.sid);
    if (!L || !p) return;
    const awake = !p.sleeping && !p.dead && !p.restrained && !g.sleep;
    if (j.kind === 'profession') {
      if (j.job !== 'guard') return;
      if (j.dutyDay !== day) {
        if (j.duty > 0) this.payDuty(L, j);
        j.dutyDay = day;
        j.duty = 0;
      }
      if (awake && min >= DUTY_START && min < DUTY_END && within(L.bounds, p.x, p.z, 4) && this.sim.abs - this.lastStep < 20) j.duty += dm;
      if (min >= DUTY_END && j.duty > 0 && j.paidDay !== day) this.payDuty(L, j);
      return;
    }
    const emp = L.npcs[j.employer];
    if (!emp || !alive(emp)) {
      this.resign(`${j.employerName} is gone`);
      return;
    }
    const [s0, e0] = j.shift;
    if (j.workDay !== day) {
      if (j.worked > 0) this.payWages(L, j);
      j.workDay = day;
      j.worked = 0;
    }
    if (awake && min >= s0 && min < e0) {
      const b = buildingAt(L, p.x, p.z);
      if (b && b.id === j.building) {
        j.worked += dm;
        j.lastDay = day;
      }
    }
    if (min >= e0 && j.paidDay !== day) {
      if (j.worked > 0) this.payWages(L, j);
      else j.paidDay = day;
      if (day - j.lastDay >= 3) return this.fire(L, j, 'You haven\'t shown up for work in days.');
      const op = this.sim.opinion(emp.ent && !emp.ent.dead ? emp.ent : { rec: emp, settlement: L.settlement });
      if (op < -20) return this.fire(L, j, 'I can\'t have someone like you working for me.');
    }
  }

  // ------------------------------------------------------------ save
  serialize() {
    return { job: this.job, kits: [...this.kits], escort: this.escort, returning: this.returning, oldLook: this.oldLook };
  }

  load(d) {
    if (!d) return;
    this.job = d.job || null;
    this.kits = new Set(d.kits || []);
    this.escort = d.escort || null;
    this.returning = d.returning || [];
    this.oldLook = d.oldLook || null;
    this.ent = null;
    this.lastAbs = null;
  }
}

