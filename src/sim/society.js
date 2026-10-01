// The lives townsfolk lead, beyond the daily round.
//
// A few have a vice: light fingers, a short temper, or a grudge against the
// laws. Now and then they act on it: lift a purse, start a brawl, stir up
// the square. Whoever sees it shouts; the watch comes, takes them in, and
// walks them to the cells; the mayor hears it the next morning and fines
// them, locks them up a day or two, or (third time, or for something bad)
// sends them away. An exile takes to the road as an adventurer, starts
// again in another realm, joins a band of nomads, or joins the bandits.
//
// Careers move on: a guard made captain, a labourer who takes up a trade, a
// well-off soul who opens a shop, a shop that can't pay its way and shuts,
// a young one who leaves to seek their fortune (and turns up again, years
// on, as a merchant). Hearts do too: affairs, partings, families feuding,
// shopkeepers who can't stand each other. And people move: for work, for
// love, for a better mayor than the one they've got.
import { alive, ledger, setOverride, DAY, st } from './econ.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { retrain, workplaceTypeFor } from '../entities/npcgen.js';

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor && !(r.life && r.life.exiled));
export const lifeOf = (r) => (r.life ||= {});
const fullName = (r) => `${r.name.first} ${r.name.last}`;
const busy = (r) => r.ruler !== undefined || r.councillor !== undefined || r.raid !== undefined || r.soldier !== undefined || r.captive || r.trip?.phase === 'away' || r.roadwork || r.walkHome;

export const VICES = {
  thief: { crime: 'theft', label: 'light fingers', rate: 0.05 },
  brawler: { crime: 'brawl', label: 'a short temper', rate: 0.04 },
  rioter: { crime: 'riot', label: 'no love for the laws', rate: 0.03 },
};
const CRIME_TEXT = { theft: 'picking pockets', brawl: 'brawling in the street', riot: 'stirring up a riot' };
const SEVERITY = { theft: 1, riot: 1, brawl: 2 };
const FINES = { theft: 18, riot: 15, brawl: 30 };
const SLOGANS = ['Down with the taxes!', 'The mayor\'s robbing us blind!', 'We won\'t stand for it!', 'Who are these laws for? Not us!', 'Enough is enough!', 'Hear me, all of you!'];

export class Society {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.talkT = 0;
    this.planT = 0;
  }

  // ------------------------------------------------------------ daily
  // (A town caught up from afar lives its own days, not today.)
  now() {
    return this.sim.simNow ?? this.sim.abs;
  }

  daily(L, day) {
    const s = L.settlement;
    if (!L.econ || s.deserted || s.condition === 'abandoned') return;
    const rng = new RNG(hash4(s.seed >>> 0, day, 0x50c1));
    this.assignVices(L);
    this.releases(L);
    this.trials(L, day, rng);
    this.crimes(L, day, rng);
    this.careers(L, day, rng);
    this.hearts(L, day, rng);
    this.moves(L, day, rng);
    this.fortunes(L, day, rng);
    L.econ.socSeen = true;
  }

  // Those who went off to seek their fortune: what became of them, once
  // it's had time to (the merchants are seen to on the roads; see sim.js).
  fortunes(L, day, rng) {
    for (const r of L.npcs) {
      const f = r.life && r.life.fortune;
      if (!f || f.done || !f.fate || f.fate === 'merchant' || !alive(r) || r.migrated || day < (f.at ?? 1e9)) continue;
      f.done = day;
      const home = this.sim.layoutOf(f.home);
      const hs = home && home.settlement;
      const here = L.settlement.name;
      const nm = fullName(r);
      if (f.fate === 'settled') {
        if (home && home.econ) ledger(home, day, `A letter from ${nm}: they've made a life for themselves in ${here}, and won't be coming home.`);
        ledger(L, day, `${nm} has settled in ${here} for good.`);
      } else if (f.fate === 'lost') {
        r.migrated = true;
        r.away = true;
        if (home && home.econ) ledger(home, day, `No word from ${nm} since they left to seek their fortune. Folk in ${hs.name} have begun to fear the worst.`);
      } else if (home && home.econ && !hs.deserted) {
        const rich = f.fate === 'rich';
        r.coins = rich ? (r.coins || 0) + rng.int(140, 320) : Math.min(r.coins || 0, rng.int(0, 4));
        const back = this.sim.sendPeople(L, [r], home, rich ? 'home again, and rich' : 'home again, with nothing');
        for (const m of back) {
          m.traveler = false;
          if (rich) lifeOf(m).wealth = 'made';
          else if (m.job !== 'beggar' && rng.chance(0.4)) retrain(home, m, 'beggar', rng);
        }
        ledger(home, day, rich
          ? `${nm} has come home to ${hs.name} from ${here}, rich! There's talk of them buying a business.`
          : `${nm} has come home to ${hs.name}, thinner and poorer, with nothing to show for their travels.`);
      }
    }
  }

  // A rare few have a vice (the same ones, always: it's who they are).
  assignVices(L) {
    for (const r of residents(L)) {
      if (r.age !== 'adult') continue;
      const lf = lifeOf(r);
      if (lf.viceRolled) continue;
      lf.viceRolled = true;
      if (r.job === 'mayor' || r.job === 'guard' || r.ruler !== undefined || r.job === 'priest') continue;
      const p = r.personality || {};
      const roll = (hash4(L.settlement.seed >>> 0, r.idx, 0x71ce) % 1000) / 1000;
      if ((p.temper ?? 0.5) > 0.62 && (p.kindness ?? 0.5) < 0.45 && roll < 0.22) lf.vice = 'brawler';
      else if ((p.kindness ?? 0.5) < 0.35 && (p.diligence ?? 0.5) < 0.45 && roll < 0.25) lf.vice = 'thief';
      else if ((p.temper ?? 0.5) > 0.55 && roll < 0.05) lf.vice = 'rioter';
    }
  }

  // Grievances that stir a rioter up.
  grievance(L) {
    const e = L.econ;
    const laws = e.laws || {};
    const people = residents(L);
    const mood = people.length ? people.reduce((a, r) => a + (r.mood ?? 0.5), 0) / people.length : 0.5;
    return (e.tax || 0) >= 0.14 || laws.curfew || laws.weaponBan || mood < 0.38;
  }

  crimes(L, day, rng) {
    const sid = L.settlement.id;
    const active = this.game.active.has(sid);
    for (const r of residents(L)) {
      const lf = r.life;
      if (!lf || !lf.vice || lf.held || lf.plan || busy(r) || (lf.jailUntil && lf.jailUntil > this.now()) || (lf.lowUntil || 0) > day) continue;
      const v = VICES[lf.vice];
      let rate = v.rate;
      if (lf.vice === 'rioter') rate = this.grievance(L) ? 0.08 : 0.005;
      if ((r.mood ?? 0.5) < 0.3) rate *= 1.5;
      if (!rng.chance(rate)) continue;
      // Where you can see it: it happens in front of you, some time today.
      if (active && r.ent && !r.ent.dead) lf.plan = { type: v.crime, at: day * DAY + rng.int(9 * 60, 19 * 60) };
      else this.offscreenCrime(L, r, v.crime, day, rng);
    }
  }

  // Out of sight: reckoned up. The watch catches them, or doesn't.
  offscreenCrime(L, r, type, day, rng) {
    const s = L.settlement;
    const guards = residents(L).filter((q) => q.job === 'guard').length;
    const victim = rng.pick(residents(L).filter((q) => q !== r && q.age !== 'child')) || null;
    if (type === 'theft' && victim) {
      const amt = Math.min(victim.coins || 0, rng.int(4, 14));
      victim.coins -= amt;
      r.coins = (r.coins || 0) + amt;
    }
    if (rng.chance(clamp(0.3 + guards * 0.08, 0.3, 0.85))) {
      lifeOf(r).held = { crime: type, day, victim: victim ? victim.idx : null };
      ledger(L, day, `${fullName(r)} was taken in by the watch for ${CRIME_TEXT[type]}${victim && type !== 'riot' ? ` (${victim.name.first} ${victim.name.last} was the one wronged)` : ''}.`);
      if (victim && type !== 'riot') this.feud(L, r, victim, CRIME_TEXT[type], day);
    } else if (type === 'theft' && victim) ledger(L, day, `${victim.name.first} ${victim.name.last}'s purse went missing. Nobody saw who took it.`);
    else if (type === 'riot') ledger(L, day, `There was shouting on the square about the ${(s.econ?.tax || 0) >= 0.14 ? 'taxes' : 'laws'}. It came to nothing.`);
  }

  // The mayor hears the case of anyone held overnight.
  trials(L, day, rng) {
    const e = L.econ;
    for (const r of L.npcs) {
      const lf = r.life;
      if (!lf || !lf.held || !alive(r) || lf.held.day >= day) continue;
      const { crime } = lf.held;
      lf.held = null;
      const prior = lf.convictions || 0;
      lf.convictions = prior + 1;
      // (Keeping their head down for a while after.)
      lf.lowUntil = day + 6 + rng.int(0, 6);
      const sev = SEVERITY[crime] || 1;
      const what = CRIME_TEXT[crime];
      if (prior >= 2 || (sev >= 2 && prior >= 1 && rng.chance(0.5))) {
        ledger(L, day, `${fullName(r)} was exiled from ${L.settlement.name} for ${what}${prior ? ', and not for the first time' : ''}.`);
        this.release(L, r);
        this.exile(L, r, day, rng, what);
        continue;
      }
      const fine = Math.round(FINES[crime] * (e.fineScale || 1));
      if ((r.coins || 0) >= fine) {
        r.coins -= fine;
        e.treasury += fine;
        ledger(L, day, `${fullName(r)} was fined ¤${fine} for ${what}.`);
        this.release(L, r);
      } else {
        const days = sev;
        lf.jailUntil = (day + days) * DAY + 8 * 60;
        ledger(L, day, `${fullName(r)} couldn't pay, and will spend ${days} day${days > 1 ? 's' : ''} in the cells for ${what}.`);
        const n = r.ent;
        if (n && !n.dead && n.state !== 'jailed') this.lockUp(n);
      }
    }
  }

  // Time served (or the fine paid): out of the cell.
  releases(L) {
    const now = this.now();
    for (const r of L.npcs) {
      const lf = r.life;
      if (!lf || !lf.jailUntil || lf.jailUntil > now || lf.held) continue;
      lf.jailUntil = null;
      this.release(L, r);
    }
  }

  release(L, r) {
    const lf = lifeOf(r);
    lf.jailUntil = null;
    const n = r.ent;
    if (n && !n.dead && (n.state === 'jailed' || n.state === 'arrested' || n.state === 'toCell')) {
      const you = this.sim.justice.jail && this.sim.justice.jail.sid === L.settlement.id;
      if (L.jail && !you) this.sim.justice.setCellDoor(L, true);
      n.state = 'routine';
      n.sleeping = false;
      n.activity = null;
      n.path = null;
      n.say(n.rng.pick(['Free at last.', 'I\'ve learned my lesson. Probably.', 'Never again.']), 3);
    }
  }

  // Sent away: what becomes of them.
  exile(L, r, day, rng, why) {
    const lf = lifeOf(r);
    lf.exiled = { from: L.settlement.id, day, why };
    const p = r.personality || {};
    const sim = this.sim;
    // (A family man or woman leaves alone: their partner and children stay.)
    if (r.partner !== null && r.partner !== undefined && L.npcs[r.partner]) L.npcs[r.partner].partner = null;
    r.partner = null;
    let path;
    if ((p.temper ?? 0.5) > 0.5 && (p.kindness ?? 0.5) < 0.5 && sim.bandits) path = 'bandits';
    else if ((p.bravery ?? 0.5) > 0.6) path = 'adventurer';
    else if ((p.sociability ?? 0.5) > 0.55) path = 'nomads';
    else path = 'realm';
    lf.exilePath = path;
    this.gone(L, r, 'exile', null, day);
    // Out of town on foot, if you're there to see it.
    const n = r.ent;
    if (n && !n.dead) {
      r.leaving = true;
      setOverride(r, sim.abs, sim.abs + 600, 'travel', { place: 'road' });
      n.state = 'routine';
      n.activity = null;
      n.say(n.rng.pick(['You\'ll regret this!', 'I\'m going. Don\'t follow me.', 'This town was never good enough for me.']), 3);
    } else r.away = true;
    const name = fullName(r);
    const s = L.settlement;
    if (path === 'bandits') {
      const band = sim.bandits.recruit(r, L, day, rng);
      ledger(L, day, `They say ${name} has gone to the ${band ? band.name : 'bandits'} in the wilds.`);
    } else if (path === 'adventurer' && sim.adventurers) {
      const a = sim.adventurers.create(rng);
      a.name = r.name;
      a.look = { ...r.look, hat: 'hood' };
      a.personality = r.personality;
      a.traits = [...(r.traits || []).filter((t) => t !== 'timid'), 'exiled'].slice(0, 4);
      a.dest = this.elsewhere(L, rng)?.id ?? s.id;
      a.state = 'road';
      a.arrive = sim.abs + rng.int(6, 30) * 60;
      a.exile = s.id;
      sim.adventurers.list.push(a);
      ledger(L, day, `${name} has taken to the road as an adventurer.`);
    } else if (path === 'nomads' && sim.nomads) {
      const { ent, ...data } = r;
      void ent;
      const person = { ...JSON.parse(JSON.stringify(data)), nomad: true, job: 'laborer', home: null, partner: null, children: [], parents: [], friends: [], life: null };
      const band = sim.nomads.bands.find((b) => !b.done && b.sid !== s.id);
      if (band) band.people.push(person);
      else {
        const to = this.elsewhere(L, rng);
        if (to) sim.nomads.bands.push({ id: sim.nomads.next++, sid: to.id, arrive: (day + 2) * DAY + 600, decide: (day + 2) * DAY + 960, family: r.name.last, style: s.style, people: [person], done: false, vouched: 0 });
      }
      ledger(L, day, `${name} has gone off with the nomads.`);
    } else {
      // Another realm (or a free town) will take them in.
      const T = this.foreign(L, rng);
      if (T) {
        const moved = sim.sendPeople(L, [r], T, `cast out of ${s.name}, looking to start again`);
        for (const m of moved) {
          m.life = { ...(m.life || {}), exiled: null, from: s.id, viceRolled: true, vice: m.life?.vice || null };
        }
        ledger(L, day, `${name} has gone to start again in ${T.settlement.name}.`);
      }
    }
    if (n && !n.dead && path !== 'realm') {
      // (They walk out; the town forgets them.)
      r.migrated = r.migrated ?? 'exile';
    } else if (path !== 'realm') r.migrated = r.migrated ?? 'exile';
    return path;
  }

  // Somewhere else to go, not too far.
  elsewhere(L, rng) {
    const s = L.settlement;
    const list = this.game.world.ow.settlements.filter((o) => o !== s && !o.deserted && o.condition !== 'abandoned' && Math.hypot(o.cx - s.cx, o.cz - s.cz) < 14);
    return list.length ? rng.pick(list) : null;
  }

  // A town of another realm (or a free town), laid out, to take an exile in.
  foreign(L, rng) {
    const s = L.settlement;
    const cands = this.game.world.ow.settlements.filter((o) => o !== s && o.civ !== s.civ && !o.deserted && o.condition !== 'abandoned' && Math.hypot(o.cx - s.cx, o.cz - s.cz) < 18);
    const o = cands.length ? rng.pick(cands) : this.elsewhere(L, rng);
    return o ? this.sim.layoutOf(o.id) : null;
  }

  // Who's gone, and why (for talk).
  gone(L, r, why, to, day) {
    const list = (L.econ.departed ||= []);
    list.push({ name: fullName(r), first: r.name.first, why, to: to || null, day });
    if (list.length > 6) list.shift();
  }

  // Two households fall out.
  feud(L, a, b, why, day) {
    const e = L.econ;
    if (!a || !b || a.household === b.household) return null;
    e.feuds ||= [];
    const k = [a.household, b.household].sort().join('|');
    if (e.feuds.some((f) => f.k === k)) return null;
    const f = { k, a: a.household, b: b.household, an: a.name.last, bn: b.name.last, why, day };
    e.feuds.push(f);
    if (e.feuds.length > 4) e.feuds.shift();
    return f;
  }

  feudBetween(L, a, b) {
    const k = [a.household, b.household].sort().join('|');
    return (L.econ.feuds || []).find((f) => f.k === k) || null;
  }

  // ------------------------------------------------------------ careers
  careers(L, day, rng) {
    const e = L.econ;
    const people = residents(L);
    const adults = people.filter((r) => r.age === 'adult' && !busy(r));
    // The watch gets a captain once it's big enough.
    const guards = people.filter((r) => r.job === 'guard');
    if (guards.length >= 3 && !guards.some((r) => r.life && r.life.rank)) {
      const best = guards.slice().sort((x, y) => ((y.personality?.bravery ?? 0) + (y.personality?.diligence ?? 0)) - ((x.personality?.bravery ?? 0) + (x.personality?.diligence ?? 0)))[0];
      lifeOf(best).rank = 'Captain';
      // (The first captain was already there when you came.)
      if (e.socSeen) ledger(L, day, `${fullName(best)} was made Captain of the Watch.`);
    }
    // Someone takes up a trade the town has a place for and nobody in.
    if (rng.chance(0.05)) {
      const want = ['tailor', 'carpenter', 'herbalist', 'baker', 'scholar', 'merchant'].find((j) => L.hasWorkplaceFor(j) && !people.some((r) => r.job === j));
      const who = want && rng.pick(adults.filter((r) => ['laborer', 'farmer', 'beggar', 'fisher', 'trapper', 'lumberjack'].includes(r.job)));
      if (who) {
        const was = who.job;
        retrain(L, who, want, rng);
        ledger(L, day, `${fullName(who)} gave up ${was === 'beggar' ? 'begging' : `work as a ${was}`} to become a ${want}.`);
      }
    }
    // A well-off soul opens a business of their own.
    if (rng.chance(0.03) && e.treasury >= 0) {
      const who = adults.filter((r) => (r.coins || 0) >= 140).sort((x, y) => (y.coins || 0) - (x.coins || 0))[0];
      const trade = who && (['tailor', 'carpenter', 'herbalist', 'baker'].includes(who.job) ? who.job : rng.pick(['tailor', 'carpenter', 'baker']));
      const type = trade && workplaceTypeFor(trade);
      if (who && type && L.buildings.filter((b) => b.type === type).length < 2 && !this.sim.works.projects.some((p) => !p.done && p.sid === L.settlement.id && p.kind === 'build')) {
        const p = this.sim.works.startBuilding(L, type, `, for ${fullName(who)}'s new business`, false, 100);
        if (p) {
          who.coins -= 100;
          lifeOf(who).opening = type;
          ledger(L, day, `${fullName(who)} is opening a ${type} of their own.`);
        }
      }
    }
    // A business that can't pay its way shuts its doors.
    for (const b of L.buildings) {
      const biz = e.biz && e.biz[b.id];
      if (!biz || !['shop', 'tailor', 'herbalist', 'workshop', 'bakery', 'jeweller'].includes(b.type)) continue;
      biz.slow = (biz.earnedY || 0) < 3 && (biz.till || 0) < 12 ? (biz.slow || 0) + 1 : 0;
      if (biz.slow >= 12 && !biz.closed) {
        biz.closed = true;
        const staff = people.filter((r) => r.work && r.work.building === b.id);
        for (const r of staff) retrain(L, r, 'laborer', rng);
        ledger(L, day, `The ${b.name.replace(/^The /, '')} has shut its doors. ${staff.length ? `${staff[0].name.first} couldn't make it pay.` : 'Nobody could make it pay.'}`);
      } else if (biz.closed && (biz.till || 0) > 60) {
        biz.closed = false;
        ledger(L, day, `The ${b.name.replace(/^The /, '')} has opened again.`);
      }
    }
    // A young one leaves to seek their fortune.
    if (rng.chance(0.03)) {
      const who = adults.find((r) => r.partner === null && !(r.children || []).length && (r.personality?.bravery ?? 0) > 0.55 && ['laborer', 'farmer', 'fisher', 'beggar'].includes(r.job) && !(r.life && r.life.fortune));
      const far = who && this.game.world.ow.settlements.filter((o) => o !== L.settlement && !o.deserted && o.condition !== 'abandoned' && Math.hypot(o.cx - L.settlement.cx, o.cz - L.settlement.cz) >= 5 && Math.hypot(o.cx - L.settlement.cx, o.cz - L.settlement.cz) < 14);
      if (who && far.length) {
        const T = this.sim.layoutOf(rng.pick(far).id);
        const moved = this.sim.sendPeople(L, [who], T, 'to seek their fortune');
        // How it turns out is anyone's guess: a merchant on the roads
        // (who visits home in time), a life made out there, home again
        // with empty pockets (or full ones), or never heard of again.
        const fate = rng.weighted([['merchant', 3], ['settled', 2], ['poor', 2], ['rich', 1], ['lost', 1.2]]);
        for (const m of moved) {
          if (fate === 'merchant') {
            m.traveler = true;
            m.tier = 'peddler';
          }
          m.coins = (m.coins || 0) + 30;
          m.life = { ...(m.life || {}), fortune: { home: L.settlement.id, since: day, fate, at: day + rng.int(10, 30) } };
        }
        ledger(L, day, `${fullName(who)} has left ${L.settlement.name} to seek their fortune.`);
        this.gone(L, who, 'fortune', T.settlement.name, day);
      }
    }
  }

  // ------------------------------------------------------------ hearts
  hearts(L, day, rng) {
    const e = L.econ;
    const people = residents(L);
    const adults = people.filter((r) => r.age === 'adult');
    // Found out.
    for (const r of adults) {
      const a = r.life && r.life.affair;
      if (!a) continue;
      const other = L.npcs[a.with];
      if (!other || !alive(other)) {
        r.life.affair = null;
        continue;
      }
      if (day - a.since >= 2 && rng.chance(0.2)) {
        r.life.affair = null;
        const spouse = r.partner !== null && r.partner !== undefined ? L.npcs[r.partner] : null;
        if (spouse) {
          spouse.partner = null;
          r.partner = null;
          spouse.mood = clamp((spouse.mood ?? 0.5) - 0.3, 0, 1);
          lifeOf(spouse).scorned = { by: r.idx, day };
          ledger(L, day, `${fullName(r)} and ${fullName(spouse)} have parted ways. The whole of ${L.settlement.name} is talking about ${other.name.first} ${other.name.last}.`);
          this.feud(L, spouse, other, 'the affair', day);
        }
      }
    }
    // A wandering eye.
    if (rng.chance(0.03)) {
      const r = rng.pick(adults.filter((q) => q.partner !== null && q.partner !== undefined && !(q.life && q.life.affair) && ((q.traits || []).includes('romantic') || (q.personality?.kindness ?? 0.5) < 0.35)));
      const o = r && rng.pick(adults.filter((q) => q !== r && q.idx !== r.partner && q.household !== r.household));
      if (r && o) lifeOf(r).affair = { with: o.idx, since: day };
    }
    // Two in the same trade, at each other's throats.
    if (rng.chance(0.04)) {
      e.grudges ||= [];
      for (const job of ['merchant', 'tailor', 'baker', 'blacksmith', 'carpenter', 'cook', 'fisher']) {
        const two = adults.filter((r) => r.job === job);
        if (two.length < 2) continue;
        const [a, b] = rng.shuffle(two.slice()).slice(0, 2);
        if (e.grudges.some((g) => (g.a === a.idx && g.b === b.idx) || (g.a === b.idx && g.b === a.idx))) continue;
        e.grudges.push({ a: a.idx, b: b.idx, job, day, why: rng.pick(['stealing customers', 'undercutting prices', 'an old debt', 'a sign hung in the wrong place']) });
        if (e.grudges.length > 3) e.grudges.shift();
        break;
      }
    }
    // Old feuds cool off, in time.
    if (e.feuds) e.feuds = e.feuds.filter((f) => day - f.day < 40 || !rng.chance(0.05));
  }

  // ------------------------------------------------------------ moving
  moves(L, day, rng) {
    if (!rng.chance(0.05)) return;
    const s = L.settlement;
    const people = residents(L);
    const near = this.game.world.ow.settlements.filter((o) => o !== s && !o.deserted && o.condition !== 'abandoned' && Math.hypot(o.cx - s.cx, o.cz - s.cz) < 10)
      .map((o) => this.sim.layoutOf(o.id)).filter((T) => T && T.econ);
    if (!near.length) return;
    const mood = (T) => {
      const ps = residents(T);
      return ps.length ? ps.reduce((a, r) => a + (r.mood ?? 0.5), 0) / ps.length : 0.5;
    };
    const mayor = (T) => T.npcs.find((r) => r.job === 'mayor' && alive(r));
    const score = (T) => mood(T) - (T.econ.tax || 0) * 2 + ((mayor(T)?.personality?.kindness ?? 0.5) - 0.5) * 0.4;
    const here = score(L);
    const kind = rng.pick(['work', 'love', 'mayor']);
    const single = (r) => r.age === 'adult' && (r.partner === null || r.partner === undefined) && !(r.children || []).length && !busy(r) && r.job !== 'mayor' && r.job !== 'guard';
    if (kind === 'work') {
      // Out of work here; hands wanted there.
      const T = near.find((q) => q.econ.hands);
      const who = T && rng.pick(people.filter((r) => single(r) && ['laborer', 'beggar'].includes(r.job)));
      if (who) {
        this.sim.sendPeople(L, [who], T, 'for work');
        ledger(L, day, `${fullName(who)} has gone to ${T.settlement.name}, where there's work to be had.`);
        this.gone(L, who, 'work', T.settlement.name, day);
      }
    } else if (kind === 'love') {
      const who = rng.pick(people.filter((r) => single(r) && (r.personality?.sociability ?? 0.5) > 0.5));
      const T = who && rng.pick(near);
      if (who && T) {
        this.sim.sendPeople(L, [who], T, 'for love');
        ledger(L, day, `${fullName(who)} has moved to ${T.settlement.name}, to be near someone they met there.`);
        this.gone(L, who, 'love', T.settlement.name, day);
      }
    } else {
      // A town that's had enough of its mayor: a family goes where things
      // are run better.
      const best = near.slice().sort((a, b) => score(b) - score(a))[0];
      if (best && score(best) - here > 0.25 && mood(L) < 0.45) {
        const head = rng.pick(people.filter((r) => r.age === 'adult' && !busy(r) && r.job !== 'mayor' && r.job !== 'guard'));
        const fam = head ? people.filter((r) => r.household === head.household && !busy(r)) : [];
        if (fam.length) {
          this.sim.sendPeople(L, fam, best, `for a better mayor than ${L.settlement.name}'s`);
          this.gone(L, head, 'mayor', best.settlement.name, day);
          ledger(L, day, `The ${head.name.last} family packed up for ${best.settlement.name}. "A town that's run properly," they said.`);
        }
      }
    }
  }

  // ------------------------------------------------------------ in front of you
  // Every half second or so, in the towns you're in.
  tick(dt) {
    const g = this.game;
    const now = this.sim.abs;
    this.talkT -= dt;
    for (const [sid, a] of g.active) {
      for (const n of a.npcs) {
        if (n.dead) continue;
        const lf = n.rec.life;
        if (!lf) continue;
        // Their moment comes.
        if (lf.plan && now >= lf.plan.at) {
          const type = lf.plan.type;
          lf.plan = null;
          if (n.state === 'routine' && !n.sleeping && !n.sitting) this.startCrime(n, type);
        }
        // A fight that's been broken up (or a deed done): back to it.
        if (n.crime && n.state !== 'crime' && n.state !== 'fight') this.endCrime(n);
        // Still wanted, and nobody's come for them: a guard is sent (or
        // they're called up in the morning).
        if (lf.wanted && !lf.held && n.state === 'routine' && !g.npcs.some((q) => q.arrestOf === n && q.state === 'arresting')) {
          if (!this.sendGuard(n)) this.summon(n);
        }
        // In the cells (spawned in, or the day's sentence).
        if ((lf.held || (lf.jailUntil && lf.jailUntil > now)) && n.state === 'routine' && a.layout.jail) this.lockUp(n);
      }
      // Feuding neighbours have words, when they pass (not too often).
      if (this.talkT <= 0) this.bickering(a.layout, a.npcs);
      void sid;
    }
  }

  bickering(L, ents) {
    const feuds = L.econ.feuds || [];
    const grudges = L.econ.grudges || [];
    if (!feuds.length && !grudges.length) return;
    const p = this.game.player;
    for (const n of ents) {
      if (n.dead || n.state !== 'routine' || n.sleeping || Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) > 14) continue;
      for (const o of ents) {
        if (o === n || o.dead || o.sleeping || Math.max(Math.abs(n.x - o.x), Math.abs(n.z - o.z)) > 4) continue;
        const f = feuds.find((q) => (q.a === n.rec.household && q.b === o.rec.household));
        const gr = grudges.find((q) => q.a === n.rec.idx && q.b === o.rec.idx);
        if (!f && !gr) continue;
        this.talkT = 50;
        n.face(o.x, o.z);
        n.say(n.rng.pick(f ? [`Well, if it isn't a ${o.rec.name.last}.`, 'Don\'t you look at me like that.', `Your lot have some nerve, after ${f.why}.`, 'Hmph.'] : ['Selling rubbish again, I see.', 'Stealing my customers, are we?', 'You\'ll be out of business by spring.']), 3, '#e8b080');
        o.sayLater?.(o.rng.pick(['Mind your own business.', 'Same to you!', 'Not worth my breath.']), 1.2, 2.5);
        return;
      }
    }
  }

  // ------------------------------------------------------------ crimes, live
  startCrime(n, type) {
    const g = this.game;
    const near = g.active.get(n.settlement.id)?.npcs || [];
    const others = near.filter((o) => o !== n && !o.dead && o.state === 'routine' && o.rec.age !== 'child' && o.rec.job !== 'guard' && Math.max(Math.abs(o.x - n.x), Math.abs(o.z - n.z)) <= 14);
    let target = null;
    if (type === 'riot') {
      const p = n.layout.plaza;
      target = { x: p.cx + n.rng.int(-2, 2), z: p.cz + 2 };
    } else {
      // (Someone they've a quarrel with, if they're about.)
      target = others.find((o) => this.feudBetween(n.layout, n.rec, o.rec)) || others.sort((x, y) => n.distTo(x) - n.distTo(y))[0] || null;
      if (!target) return false;
    }
    n.state = 'crime';
    n.crime = { type, target, phase: 'go', t: 0, said: 0 };
    n.activity = null;
    n.path = null;
    n.releaseSpot?.();
    return true;
  }

  // The deed itself (see npc.js: state 'crime').
  crimeTick(n, dt) {
    const c = n.crime;
    if (!c) {
      n.state = 'routine';
      return;
    }
    c.t += dt;
    const g = this.game;
    const tgt = c.target;
    if (c.phase === 'go') {
      const at = tgt.kind === 'npc' ? { x: tgt.x, y: tgt.y, z: tgt.z } : { x: tgt.x, y: n.y, z: tgt.z };
      if (c.t > 40 || (tgt.kind === 'npc' && tgt.dead)) return this.endCrime(n);
      if (!n.followPath(at, 1)) return;
      c.phase = 'act';
      c.t = 0;
    }
    if (c.phase === 'act') {
      if (c.type === 'theft') {
        const amt = Math.min(tgt.rec.coins || 0, n.rng.int(4, 14));
        tgt.rec.coins -= amt;
        n.rec.coins = (n.rec.coins || 0) + amt;
        n.doAction?.(0.3);
        const wits = this.sim.witnesses(n.settlement.id, n.x, n.z, 8).filter((w) => w !== n && (w !== tgt || n.rng.chance(0.5)));
        if (wits.length) this.report(n, 'theft', wits, tgt);
        else {
          c.phase = 'away';
          c.t = 0;
        }
        return;
      }
      if (c.type === 'brawl') {
        n.say(n.rng.pick(['What are YOU looking at?', 'You want some of this?', `I've had it with you, ${tgt.rec.name.first}!`]), 2.5, '#ff9080');
        n.brawl = true;
        tgt.brawl = true;
        n.engage(tgt);
        if ((tgt.rec.personality?.bravery ?? 0.5) > 0.5) tgt.engage(n);
        else tgt.startFlee?.(n, 'Help! Guards!');
        n.crime = { ...c, phase: 'fighting', t: 0 };
        this.report(n, 'brawl', this.sim.witnesses(n.settlement.id, n.x, n.z, 12).filter((w) => w !== n), tgt);
        return;
      }
      if (c.type === 'riot') {
        // On the square, shouting the place down.
        if (c.t >= c.said * 5) {
          c.said++;
          n.say(n.rng.pick(SLOGANS), 3.5, '#ffb080');
          n.doAction?.(0.3);
        }
        if (c.said >= 4) {
          g.renderer.emit?.(n.x, n.y + 1, n.z, { n: 6, color: ['#8a8a8a', '#6a6a6a'], up: 30, speed: 40, life: 0.5 });
          const wits = this.sim.witnesses(n.settlement.id, n.x, n.z, 16).filter((w) => w !== n);
          if (wits.length) this.report(n, 'riot', wits, null);
          else this.endCrime(n);
        }
      }
      return;
    }
    if (c.phase === 'fighting') {
      if (c.t > 25 || tgt.dead) this.endCrime(n);
      return;
    }
    if (c.phase === 'away') {
      // Off they stroll, as if nothing happened.
      if (c.t > 10) this.endCrime(n);
    }
  }

  endCrime(n) {
    n.crime = null;
    n.brawl = false;
    if (n.state === 'crime' || n.state === 'fight') n.calmDown(true);
  }

  // Seen: someone shouts, and the watch comes.
  report(n, type, wits, victim) {
    const g = this.game;
    const shouter = wits.find((w) => w.state === 'routine') || wits[0];
    if (shouter) shouter.say(shouter.rng.pick(type === 'theft' ? ['Thief! Stop, thief!', 'My purse! Guards!'] : type === 'brawl' ? ['A fight! Guards!', 'Break it up! Someone get the watch!'] : ['Guards! They\'re stirring up trouble!', 'Somebody fetch the watch!']), 3, '#ff9080');
    lifeOf(n.rec).wanted = { type, day: g.day, victim: victim ? victim.rec.idx : null };
    if (victim && type !== 'riot') this.feud(n.layout, n.rec, victim.rec, CRIME_TEXT[type], g.day);
    if (!this.sendGuard(n)) this.summon(n);
    if (n.crime) n.crime.phase = type === 'brawl' ? 'fighting' : 'away';
  }

  // The nearest guard free to go and take them in.
  sendGuard(n) {
    const g = this.game;
    const guard = g.guardsOf(n.settlement.id).filter((q) => !q.dead && (q.state === 'routine' || (q.state === 'fight' && q.threat === n)) && !q.hired && !q.sleeping)
      .sort((x, y) => x.distTo(n) - y.distTo(n))[0];
    if (!guard || guard.distTo(n) >= 60) return false;
    guard.threat = null;
    guard.state = 'arresting';
    guard.arrestOf = n;
    guard.stateT = 0;
    guard.activity = null;
    guard.path = null;
    guard.releaseSpot?.();
    guard.say(guard.rng.pick(['Stop right there!', 'In the name of the law!', 'Hold it!']), 2.5, '#ffe070');
    return true;
  }

  // Nobody on hand to take them in: they're called before the mayor in the
  // morning all the same.
  summon(n) {
    const lf = lifeOf(n.rec);
    const w = lf.wanted || { type: 'theft', victim: null };
    lf.held = { crime: w.type, day: this.game.day, victim: w.victim };
    lf.wanted = null;
    ledger(n.layout, this.game.day, `${fullName(n.rec)} was seen ${CRIME_TEXT[w.type]}, and is called before the mayor in the morning.`);
  }

  // A guard going to take someone in (see npc.js: state 'arresting').
  arrestTick(g0, dt) {
    const n = g0.arrestOf;
    const L = g0.layout;
    g0.stateT = (g0.stateT || 0) + dt;
    if (!n || n.dead || n.layout !== L || g0.stateT > 60) {
      g0.arrestOf = null;
      g0.calmDown(true);
      return;
    }
    if (g0.phase === 'escort') {
      // Walking them to the cells.
      const J = L.jail;
      if (!J) return this.lockUp(n, g0);
      if (g0.followPath({ x: J.front.x, y: J.y, z: J.front.z }, 1)) {
        this.lockUp(n, g0);
        g0.phase = null;
        g0.arrestOf = null;
        g0.calmDown(true);
      }
      return;
    }
    if (!g0.followPath({ x: n.x, y: n.y, z: n.z }, 1)) return;
    // Got them.
    g0.say(g0.rng.pick(['You\'re coming with me.', 'That\'s enough of that.', 'Off to the cells with you.']), 2.5, '#ffe070');
    if (n.crime && n.crime.target && n.crime.target.kind === 'npc' && n.crime.target.state === 'fight') n.crime.target.calmDown(true);
    n.crime = null;
    n.brawl = false;
    n.state = 'arrested';
    n.ledBy = g0;
    n.threat = null;
    n.say(n.rng.pick(['It wasn\'t me!', 'All right, all right...', 'Get your hands off me!']), 2.5);
    const lf = lifeOf(n.rec);
    lf.held = { crime: lf.wanted ? lf.wanted.type : 'theft', day: this.game.day, victim: lf.wanted ? lf.wanted.victim : null };
    lf.wanted = null;
    ledger(L, this.game.day, `${fullName(n.rec)} was taken in by the watch for ${CRIME_TEXT[lf.held.crime]}.`);
    g0.phase = 'escort';
    g0.stateT = 0;
  }

  // Led along by the guard.
  arrestedTick(n) {
    const g0 = n.ledBy;
    if (!g0 || g0.dead || g0.state !== 'arresting') {
      // (Lost their guard on the way: they turn themselves in.)
      if (n.layout.jail) this.lockUp(n);
      else {
        n.state = 'routine';
        n.ledBy = null;
      }
      return;
    }
    if (n.distTo(g0) > 2) n.followPath({ x: g0.x, y: g0.y, z: g0.z }, 1);
  }

  // Into the cell (walking in, door shut behind them), till the hearing.
  lockUp(n, guard = null) {
    const L = n.layout;
    const J = L.jail;
    n.ledBy = null;
    n.crime = null;
    n.activity = null;
    n.path = null;
    if (!J || (this.sim.justice.jail && this.sim.justice.jail.sid === L.settlement.id)) {
      n.state = 'routine';
      return;
    }
    this.sim.justice.setCellDoor(L, true);
    n.state = 'toCell';
    n.cellT = 0;
    void guard;
  }

  toCellTick(n, dt) {
    const J = n.layout.jail;
    n.cellT = (n.cellT || 0) + dt;
    if (!J) {
      n.state = 'routine';
      return;
    }
    if (n.followPath({ x: J.stand.x, y: J.y, z: J.stand.z }, 0) || n.cellT > 40) {
      this.sim.justice.setCellDoor(n.layout, false);
      n.state = 'jailed';
      n.face(J.front.x, J.front.z);
    }
  }

  jailedTick(n, dt = 0.1) {
    const lf = n.rec.life || {};
    const now = this.sim.abs;
    if (!lf.held && !(lf.jailUntil && lf.jailUntil > now)) {
      this.release(n.layout, n.rec);
      return;
    }
    // On the cot by night, at the bars by day.
    const m = this.game.minute;
    const night = m >= 22 * 60 || m < 6 * 60;
    const J = n.layout.jail;
    if (J && night !== !!n.sleeping) {
      n.sleeping = night;
      if (night && J.bed) n.teleport(J.bed.x, J.y, J.bed.z);
      else if (!night) n.teleport(J.stand.x, J.y, J.stand.z);
    }
    n.cellT = (n.cellT || 0) + dt;
    if (!n.sleeping && n.cellT > 30 && n.rng.chance(0.004)) {
      n.cellT = 0;
      n.say(n.rng.pick(['I want to see the mayor!', 'It wasn\'t me, I swear.', 'Got any bread?', 'They can\'t keep me in here forever.']), 3);
    }
  }
}

// What the gossips say about who's fallen out with whom (for talk).
export function gossipLines(L) {
  const out = [];
  for (const f of L.econ.feuds || []) out.push(`The ${f.an}s and the ${f.bn}s aren't speaking, not since ${f.why}.`);
  for (const gr of L.econ.grudges || []) {
    const a = L.npcs[gr.a];
    const b = L.npcs[gr.b];
    if (a && b && alive(a) && alive(b)) out.push(`${a.name.first} and ${b.name.first} can't stand each other. Something about ${gr.why}.`);
  }
  for (const r of L.npcs) {
    const lf = r.life;
    if (lf && lf.affair && alive(r) && r.partner !== null && r.partner !== undefined) {
      const o = L.npcs[lf.affair.with];
      if (o && alive(o)) out.push(`${r.name.first}'s been seen with ${o.name.first} ${o.name.last} an awful lot lately. And ${r.name.first} a married ${r.age === 'elder' ? 'old soul' : 'one'}, too.`);
    }
    if (lf && lf.owns !== undefined && alive(r) && L.buildings[lf.owns]) out.push(`${r.name.first} ${r.name.last} put every coin they had into the ${L.buildings[lf.owns].name.replace(/^The /, '').toLowerCase()}. Good for them.`);
    if (lf && lf.scorned && alive(r)) out.push(`Poor ${r.name.first}. Left for someone else, and everyone knew before they did.`);
    if (lf && lf.rank && alive(r)) out.push(`${r.name.first} ${r.name.last} is Captain of the Watch now. Walks a bit taller for it.`);
  }
  for (const d of L.econ.departed || []) {
    const t = {
      fortune: `${d.first} went off to seek their fortune${d.to ? ` in ${d.to}` : ''}. Wonder what became of them.`,
      love: `${d.first} upped and moved to ${d.to}, for love. Romantic, or daft, I can't decide.`,
      work: `${d.first} went to ${d.to} for the work. Can't blame them.`,
      mayor: `The ${d.name.split(' ').slice(-1)[0]}s packed up for ${d.to}. Said they wanted a mayor who listens.`,
      exile: `${d.name} was sent away by the council. Good riddance, some say.`,
    }[d.why];
    if (t) out.push(t);
  }
  for (const b of L.buildings) {
    const biz = L.econ.biz && L.econ.biz[b.id];
    if (biz && biz.closed) out.push(`The ${b.name.replace(/^The /, '').toLowerCase()} shut its doors. Couldn't make it pay.`);
  }
  return out;
}

void st;
