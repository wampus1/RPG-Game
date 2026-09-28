// The player's working life: an official profession granted by a mayor
// (town guard, trapper, fisher, farmer), a job at someone's shop (chores and
// customers to serve), customers who seek you out, guards hired to travel
// along as escorts, and friends who come along as companions.
import { JOBS } from '../entities/npcgen.js';
import { alive, ledger, setOverride, invAdd, st, STOCK } from './econ.js';
import { countItem, removeItem } from '../game/inventory.js';
import { ITEMS } from '../world/items.js';
import { BLOCKS } from '../world/blocks.js';

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
    title: 'Farmer', fee: 6, minOp: -10, kit: [['hoe', 1], ['seeds', 8], ['bucket', 1]], goods: ['wheat', 'carrot', 'cabbage', 'pumpkin'],
    pitch: 'You may work and harvest the town fields as your own, and our traders pay a premium for your crops. Fill a bucket at the well on dry days: wet soil grows crops twice as fast.',
  },
};

// What townsfolk come to buy from someone in each trade.
const CUSTOMER_WANTS = {
  guard: ['arrow', 'bread', 'raw_meat', 'leather'],
  trapper: ['raw_meat', 'leather', 'feather'],
  fisher: ['fish', 'cooked_fish'],
  farmer: ['wheat', 'carrot', 'cabbage'],
};

// Goods a shop asks its helper to bring in.
const SUPPLIES = {
  smithy: ['iron_ore', 'coal'], tavern: ['raw_meat', 'fish', 'cabbage', 'carrot'], bakery: ['wheat', 'berries'], shop: ['leather', 'string', 'torch'],
  tailor: ['leather', 'string', 'cloth'], workshop: ['log_oak', 'planks'], herbalist: ['herb', 'mushroom'], library: ['feather', 'book'],
};

const CONTAINERS = new Set(['chest', 'barrel', 'crate']);

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
    this.customer = null; // someone on their way to buy from you
    this.nextCustomer = null;
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
    const base = p.baseLook || p.look;
    if (this.isGuard()) {
      if (!this.oldLook) this.oldLook = { outfit: base.outfit, hat: base.hat };
      p.look = { ...base, outfit: 'guard', hat: 'helmet' };
    } else if (this.oldLook) {
      p.look = { ...base, ...this.oldLook };
      this.oldLook = null;
    }
  }

  // Short status lines for the HUD.
  hudLines() {
    const g = this.game;
    const p = g.player;
    const out = [];
    if (this.escort && this.ent && !this.ent.dead) out.push({ text: this.escort.companion ? `Companion: ${this.ent.rec.name.first}` : `Escort ${this.ent.rec.name.first} · ${Math.ceil(this.hoursLeft())}h left`, color: '#80e0ff' });
    const c = this.customer;
    if (c && c.arrived) out.push({ text: `${c.name} wants to buy!`, color: '#ffe070' });
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
      const left = (j.chores || []).filter((q) => !q.done).length;
      if (b && b.id === j.building) out.push({ text: `At work · ${j.tasks || 0} done${left ? `, ${left} chores` : ''}`, color: '#80e070' });
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
    const out = [
      `Working for ${j.employerName} at the ${j.bname}, ${this.townName(j.sid)}.`,
      `Shift ${clock(j.shift[0])}-${clock(j.shift[1])} · ¤${j.wage} per task (chores and customers), paid at closing. You may use the shop's chests while on shift.`,
      `Done today: ${j.tasks || 0} tasks. Earned so far: ¤${j.earned}. Staff discount at the shop.`,
    ];
    for (const c of j.chores || []) out.push(`${c.done ? '[x]' : '[ ]'} ${c.label}`);
    return out;
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
    this.job.kit = given;
    this.applyLook();
    const title = PROFESSIONS[job].title;
    ledger(L, g.day, `${g.playerName} was sworn in as ${/^[AEIOU]/.test(title) ? 'an' : 'a'} ${title.toLowerCase()} of ${s.name}.`);
    this.sim.changeRep(mayor, 3);
    return { ok: true, fee: t.fee, given };
  }

  resign(reason, quiet = false) {
    const j = this.job;
    if (!j) return;
    this.dismissCustomer(null);
    const L = this.sim.layoutOf(j.sid);
    if (L) {
      if (j.kind === 'profession' && j.job === 'guard' && j.duty > 0) this.payDuty(L, j);
      if (j.kind === 'employee' && j.tasks > 0) this.payWages(L, j);
    }
    this.job = null;
    const what = j.kind === 'profession' ? `your post as ${PROFESSIONS[j.job].title.toLowerCase()} of ${this.townName(j.sid)}` : `your job at the ${j.bname}`;
    if (!quiet) this.game.ui.msg(reason ? `You lost ${what} (${reason}).` : `You left ${what}.`, reason ? '#ff9060' : '#e8e0a0');
    if (L) ledger(L, this.game.day, `${this.game.playerName} ${reason ? 'was dismissed from' : 'left'} ${j.kind === 'profession' ? `the post of ${PROFESSIONS[j.job].title.toLowerCase()}` : `work at the ${j.bname}`}.`);
    this.applyLook();
  }

  // Thrown off the watch: the badge and the kit you were issued go back,
  // wherever they are (your pack, or the jail's evidence chest).
  stripGuard(reason) {
    if (!this.isGuard()) return null;
    const j = this.job;
    const p = this.game.player;
    const kit = [...(j.kit && j.kit.length ? j.kit : []), { item: 'guard_badge', count: 1 }];
    const held = this.sim.justice.held;
    const taken = [];
    const seen = new Set();
    for (const { item, count } of kit) {
      if (seen.has(item)) continue;
      seen.add(item);
      let n = count;
      const inv = Math.min(n, countItem(p.inv, item));
      if (inv) {
        removeItem(p.inv, item, inv);
        n -= inv;
      }
      if (n > 0 && held && held.items) {
        for (const h of held.items) {
          if (h.item !== item || n <= 0) continue;
          const k = Math.min(h.count, n);
          h.count -= k;
          n -= k;
        }
        held.items = held.items.filter((h) => h.count > 0);
      }
      if (count - n > 0) taken.push({ item, count: count - n });
    }
    this.resign(reason, true);
    this.game.ui.msg(`You are dismissed from the watch of ${this.townName(j.sid)} (${reason})${taken.length ? ' and must hand back your badge and kit' : ''}.`, '#ff9060');
    return taken;
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
    this.sim.addRenown(j.sid, 1, 'keeping the beasts at bay');
    this.game.ui.msg(`Bounty: ¤${pay} from ${L.settlement.name} for the ${(c.name || 'beast').toLowerCase()}.`, '#ffe070');
    return pay;
  }

  pay(n) {
    // Earnings in your home town are taxed there.
    const c = this.sim.citizen;
    if (c) c.earned = (c.earned || 0) + n;
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
    const wage = Math.max(3, Math.min(8, Math.round(3 + biz.till / 50))) + (op >= 35 ? 1 : 0);
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
      tasks: 0, served: 0, chores: null, choreDay: -1, shop: JOBS[npc.rec.job]?.trader || 'general',
    };
    ledger(L, g.day, `${npc.rec.name.first} took on ${g.playerName} at the ${t.bname}.`);
    this.sim.changeRep(npc, 2);
    return t;
  }

  // Paid at closing for the work actually done: chores and customers served.
  payWages(L, j) {
    const tasks = j.tasks || 0;
    j.tasks = 0;
    j.worked = 0;
    j.paidDay = this.game.day;
    const biz = L.econ.biz[j.building];
    if (!biz) return 0;
    if (!tasks) {
      if (j.lastDay === this.game.day) this.game.ui.msg(`No wages from the ${j.bname} today: you didn't get anything done.`, '#ffb080');
      return 0;
    }
    const owed = tasks * j.wage;
    const paid = Math.max(0, Math.min(owed, Math.floor(biz.till)));
    biz.till -= paid;
    j.earned += paid;
    if (paid) this.pay(paid);
    this.game.ui.msg(`Wages from the ${j.bname}: ¤${paid} for ${tasks} task${tasks > 1 ? 's' : ''}.${paid < owed ? ' The till was short.' : ''}`, '#ffe070');
    const emp = L.npcs[j.employer];
    if (emp && tasks >= 3) this.sim.changeRep(emp.ent && !emp.ent.dead ? emp.ent : { rec: emp, settlement: L.settlement }, 1);
    return paid;
  }

  // On shift in the shop: you may use its chests and barrels.
  onShift(sid, bid) {
    const j = this.job;
    const m = this.game.minute;
    return !!j && j.kind === 'employee' && j.sid === sid && j.building === bid && m >= j.shift[0] - 30 && m < j.shift[1] + 30;
  }

  // Today's chores: take stock in the shop's containers, bring in supplies.
  assignChores(L, j) {
    const b = L.buildings[j.building];
    const w = this.game.world;
    const chores = [];
    const boxes = [];
    for (let z = b.z0; z <= b.z1; z++) {
      for (let x = b.x0; x <= b.x1; x++) {
        for (let y = 5; y <= 8; y++) {
          const bl = BLOCKS[w.getBlock(x, y, z)];
          if (bl && CONTAINERS.has(bl.name)) boxes.push({ x, y, z, name: bl.label.toLowerCase() });
        }
      }
    }
    const day = this.game.day;
    for (let i = 0; i < Math.min(2, boxes.length); i++) {
      const c = boxes[(day + i * 3 + j.building) % boxes.length];
      if (chores.some((q) => q.x === c.x && q.z === c.z)) continue;
      chores.push({ kind: 'stock', x: c.x, y: c.y, z: c.z, label: `Take stock of the ${c.name}`, done: false });
    }
    const wants = SUPPLIES[b.type];
    if (wants) {
      const item = wants[day % wants.length];
      const n = 2 + (day % 3);
      if (ITEMS[item]) chores.push({ kind: 'supply', item, count: n, got: 0, label: `Bring ${n} ${ITEMS[item].name.toLowerCase()} and put them in the shop's chests`, done: false });
    }
    j.chores = chores;
    j.choreDay = day;
  }

  task(j, what) {
    j.tasks = (j.tasks || 0) + 1;
    j.lastDay = this.game.day;
    this.game.ui.msg(`Work done: ${what}.`, '#a0e0a0');
    this.game.audio?.play('select');
  }

  // Hooks from the container window.
  onOpenContainer(pos) {
    const j = this.job;
    if (!j || j.kind !== 'employee' || !j.chores || !pos.owner || pos.owner.kind !== 'work') return;
    const c = j.chores.find((q) => q.kind === 'stock' && !q.done && q.x === pos.x && q.y === pos.y && q.z === pos.z);
    if (c) {
      c.done = true;
      this.task(j, c.label.toLowerCase());
    }
  }

  onContainerPut(pos, added) {
    const j = this.job;
    if (!j || j.kind !== 'employee' || !j.chores || !pos.owner || pos.owner.kind !== 'work') return;
    const c = j.chores.find((q) => q.kind === 'supply' && !q.done);
    if (!c) return;
    const a = added.find((q) => q.item === c.item);
    if (!a) return;
    c.got = Math.min(c.count, c.got + a.count);
    // Supplies go onto the shop's shelves.
    const slots = this.game.world.getContainer(pos.x, pos.y, pos.z);
    const L = this.sim.layoutOf(j.sid);
    let n = a.count;
    for (let i = 0; i < slots.length && n > 0; i++) {
      const sl = slots[i];
      if (!sl || sl.item !== c.item) continue;
      const k = Math.min(sl.count, n);
      sl.count -= k;
      n -= k;
      if (sl.count <= 0) slots[i] = null;
    }
    st.add(L.econ.biz[j.building].store, c.item, a.count - n);
    if (c.got >= c.count) {
      c.done = true;
      this.task(j, c.label.split(' and ')[0].toLowerCase());
    } else this.game.ui.msg(`Supplies: ${c.got}/${c.count} ${ITEMS[c.item].name.toLowerCase()}.`, '#c8e0a0');
    return true;
  }

  fire(L, j, why) {
    this.job = null;
    this.dismissCustomer(null);
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

  // ------------------------------------------------------------ companions
  // Good friends will come along for a while, free of charge.
  companionTerms(npc) {
    const rec = npc.rec;
    const s = npc.settlement;
    const sim = this.sim;
    if (npc.visit || npc.hired || rec.visitor) return { ok: false, reason: 'none' };
    if (this.escort) return { ok: false, reason: 'busy' };
    if (sim.justice.exiled.has(s.id) || sim.justice.pendingIn(s.id).length || this.game.isWanted(s.id)) return { ok: false, reason: 'crimes' };
    if (rec.age === 'child') return { ok: false, reason: 'child' };
    if (rec.age === 'elder') return { ok: false, reason: 'elder' };
    if (rec.job === 'mayor' || rec.job === 'guard') return { ok: false, reason: 'duty' };
    if ((rec.grief || []).some((g) => g.rel !== 'acquaintance')) return { ok: false, reason: 'grief' };
    if (sim.opinion(npc) < 60) return { ok: false, reason: 'distrust' };
    return { ok: true };
  }

  recruit(npc) {
    const t = this.companionTerms(npc);
    if (!t.ok) return t;
    const L = npc.layout;
    this.escort = { sid: L.settlement.id, idx: npc.rec.idx, name: npc.name, until: 1e12, fee: 0, companion: true };
    this.attach(npc);
    ledger(L, this.game.day, `${npc.rec.name.first} set off travelling with ${this.game.playerName}.`);
    return { ok: true };
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
    if (g.isWanted(e.sid) || j.exiled.has(e.sid) || j.pendingIn(e.sid).length) this.endEscort(e.companion ? 'I can\'t be part of this. I\'m going home.' : 'I won\'t guard an outlaw. Our deal is off.');
    else if (e.companion && this.sim.opinion(n) < 35) this.endEscort('I don\'t think I want to travel with you any more.');
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

  // ------------------------------------------------------------ customers
  // Now and then someone seeks you out to buy: townsfolk who know your trade,
  // or shoppers who come in while you mind the shop.
  updateCustomers() {
    const j = this.job;
    const g = this.game;
    const p = g.player;
    const abs = this.sim.abs;
    const c = this.customer;
    if (c) {
      const L = this.sim.layoutOf(c.sid);
      const rec = L && L.npcs[c.idx];
      const n = rec && rec.ent;
      if (!n || n.dead || abs > c.until || !j) this.dismissCustomer(abs > c.until ? 'Never mind, then.' : null);
      return;
    }
    if (!j || (j.kind === 'profession' && !CUSTOMER_WANTS[j.job])) return;
    if (this.nextCustomer === null) this.nextCustomer = abs + (j.kind === 'employee' ? 40 : 240) + Math.random() * 120;
    if (abs < this.nextCustomer) return;
    const min = g.minute;
    const a = g.active.get(j.sid);
    const busy = !a || p.dead || p.sleeping || p.restrained || g.sleep || this.sim.justice.jail || g.isWanted(j.sid) || min < 480 || min > 1140;
    const L = a && a.layout;
    const here = L && (j.kind === 'employee' ? buildingAt(L, p.x, p.z)?.id === j.building && min >= j.shift[0] && min < j.shift[1] : within(L.bounds, p.x, p.z, 6));
    if (busy || !here) {
      this.nextCustomer = abs + 20;
      return;
    }
    const cands = a.npcs.filter((n) => !n.dead && n.state === 'routine' && !n.sleeping && !n.hired && !n.visit && !n.rec.visitor && n.rec.age !== 'child'
      && n.rec.idx !== j.employer && n.rec.job !== 'guard' && !n.rec.override && n.distTo(p) >= 5 && n.distTo(p) <= 40);
    if (!cands.length) {
      this.nextCustomer = abs + 30;
      return;
    }
    const n = cands[Math.floor(Math.random() * cands.length)];
    let req;
    if (j.kind === 'employee') {
      const biz = L.econ.biz[j.building];
      const have = Object.keys(biz.store).filter((k) => biz.store[k] > 0 && ITEMS[k] && k !== 'coin');
      const list = have.length ? have : STOCK[j.shop] || ['bread'];
      const item = list[Math.floor(Math.random() * list.length)];
      const count = 1 + Math.floor(Math.random() * 3);
      req = { kind: 'shop', item, count, price: Math.max(1, Math.round(ITEMS[item].value * 1.3)) * count };
    } else {
      const goods = CUSTOMER_WANTS[j.job];
      const mine = goods.filter((k) => countItem(p.inv, k) > 0);
      const item = (mine.length ? mine : goods)[Math.floor(Math.random() * (mine.length || goods.length))];
      const count = 1 + Math.floor(Math.random() * 3);
      req = { kind: 'buy', item, count, price: Math.max(1, Math.round(ITEMS[item].value)) * count };
    }
    this.customer = { sid: j.sid, idx: n.rec.idx, name: n.rec.name.first, ...req, until: abs + 90, arrived: false };
    setOverride(n.rec, abs, abs + 90, 'customer', { place: 'player' });
    n.activity = null;
    this.nextCustomer = abs + (j.kind === 'employee' ? 60 + Math.random() * 90 : 360 + Math.random() * 360);
  }

  customerArrived(n) {
    const c = this.customer;
    if (!c || c.arrived) return;
    c.arrived = true;
    const what = `${c.count} ${ITEMS[c.item].name.toLowerCase()}`;
    const j = this.job;
    const line = c.kind === 'shop'
      ? n.rng.pick([`Hello! I'd like ${what}, please.`, `Good day! Have you got ${what}?`, `${what}, please. Is that ¤${c.price}?`])
      : n.rng.pick([`You're the ${PROFESSIONS[j.job].title.toLowerCase()}, aren't you? I'd buy ${what} for ¤${c.price}.`, `Selling ${what}? I'll give you ¤${c.price}.`]);
    n.say(line, 5, '#ffe070');
    n.emoteShow('¤', '#ffe070', 3);
    this.game.ui.msg(`${n.rec.name.first} wants to buy ${what} (¤${c.price}). Talk to them to trade.`, '#ffe070');
  }

  isCustomer(npc) {
    const c = this.customer;
    return !!c && c.arrived && !npc.visit && c.sid === npc.settlement.id && c.idx === npc.rec.idx;
  }

  // Hand over the goods.
  serveCustomer(npc) {
    const c = this.customer;
    if (!this.isCustomer(npc)) return { ok: false, reason: 'none' };
    const j = this.job;
    const p = this.game.player;
    const L = npc.layout;
    const rec = npc.rec;
    if (c.kind === 'shop') {
      const biz = L.econ.biz[j.building];
      if ((biz.store[c.item] || 0) < c.count) {
        this.dismissCustomer('Out of stock? Pity.');
        return { ok: false, reason: 'stock' };
      }
      st.take(biz.store, c.item, c.count);
      biz.till += c.price;
      biz.earned = (biz.earned || 0) + c.price;
      invAdd(rec.inv, c.item, c.count);
      j.served = (j.served || 0) + 1;
      this.task(j, `served ${rec.name.first} (¤${c.price} in the till)`);
    } else {
      if (countItem(p.inv, c.item) < c.count) return { ok: false, reason: 'missing' };
      const price = Math.min(c.price, Math.max(0, rec.coins || 0));
      removeItem(p.inv, c.item, c.count);
      invAdd(rec.inv, c.item, c.count);
      rec.coins -= price;
      this.pay(price);
      c.paid = price;
    }
    this.sim.changeRep(npc, 2);
    const done = { ok: true, ...c };
    this.dismissCustomer(null);
    return done;
  }

  dismissCustomer(line) {
    const c = this.customer;
    this.customer = null;
    if (!c) return;
    const L = this.sim.layoutOf(c.sid);
    const rec = L && L.npcs[c.idx];
    if (!rec) return;
    if (rec.override && rec.override.act === 'customer') rec.override = null;
    const n = rec.ent;
    if (n && !n.dead) {
      n.activity = null;
      if (line) n.say(line, 2.5);
    }
  }

  // ------------------------------------------------------------ time
  update() {
    const abs = this.sim.abs;
    if (this.lastAbs === null) this.lastAbs = abs;
    const dm = Math.max(0, Math.min(180, abs - this.lastAbs));
    this.lastAbs = abs;
    if (this.job) this.updateJob(dm);
    this.updateCustomers();
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
      if (j.tasks > 0) this.payWages(L, j);
      j.workDay = day;
      j.worked = 0;
      j.tasks = 0;
    }
    if (awake && min >= s0 && min < e0) {
      const b = buildingAt(L, p.x, p.z);
      if (b && b.id === j.building) {
        j.worked += dm;
        if (j.worked >= 30) j.lastDay = day;
        if (j.choreDay !== day) {
          this.assignChores(L, j);
          const emp2 = emp.ent && !emp.ent.dead ? emp.ent : null;
          if (emp2 && j.chores.length) emp2.say(`Today: ${j.chores.map((q) => q.label.toLowerCase()).join('; ')}. And see to the customers!`, 6);
          this.game.ui.msg(`Chores at the ${j.bname}: ${j.chores.map((q) => q.label.toLowerCase()).join('; ')}.`, '#c8e0a0');
        }
      }
    }
    if (min >= e0 && j.paidDay !== day) {
      this.payWages(L, j);
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

