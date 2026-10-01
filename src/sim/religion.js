// Faith on the move. A town keeps its faith (see culture.js), but faiths
// travel: along the roads with the merchants, a little with every caravan,
// till one day most of a free town keeps the god its traders keep; with a
// zealot's missionaries, preaching in the square; and with conquest. A
// conquered town keeps its old gods, unless its new masters force their
// own on it (a zealot or a pious realm may): then it resents the new
// taboos for a long while, and a realm that shares the old faith has a
// cause for a holy war. The devout go on pilgrimage to the holy city of
// their faith (its capital, or the oldest temple of the folk ways).
import { alive, ledger } from './econ.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { religionOf, realmFaith, TABOOS } from './culture.js';

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'free folk');

export class Religion {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.lastDay = null;
  }

  ow() {
    return this.game.world.ow;
  }

  keyOf(s) {
    const r = religionOf(s);
    return r ? r.key : null;
  }

  // ------------------------------------------------------------ the days
  update() {
    const day = this.game.day;
    if (this.lastDay === null) this.lastDay = day;
    if (day <= this.lastDay) return;
    for (let d = Math.max(this.lastDay + 1, day - 3); d <= day; d++) this.daily(d, new RNG(hash4(this.game.seed, d, 0x4e11)));
    this.lastDay = day;
  }

  daily(day, rng) {
    const towns = [...this.game.world.layouts.values()].filter((L) => L.econ && !L.settlement.deserted && L.settlement.condition !== 'abandoned');
    // Along the roads: a town takes in a little of the faith of the towns
    // its merchants trade with.
    for (const road of this.sim.diplomacy.roads) {
      if (!road.done) continue;
      const A = this.game.world.layouts.get(road.a);
      const Bl = this.game.world.layouts.get(road.b);
      if (!A || !Bl || !A.econ || !Bl.econ) continue;
      for (const [from, to] of [[A, Bl], [Bl, A]]) this.pull(from, to, 0.012 * (this.sim.realms.ambition && from.settlement.civ && this.sim.realms.ambition(from.settlement.civ, day) === 'zealot' ? 2 : 1));
    }
    for (const L of towns) {
      this.convertIfWon(L, day);
      this.resentment(L, day, rng);
      if ((day + L.settlement.id) % 6 === 0) this.pilgrimage(L, day, rng);
    }
  }

  // The faith of `from` creeps into `to`.
  pull(from, to, n) {
    this.pullKey(to, this.keyOf(from.settlement), n);
  }

  pullKey(to, kf, n) {
    const kt = this.keyOf(to.settlement);
    if (!kf || kf === kt) return;
    // (A realm's own towns hold to its faith more stubbornly.)
    const loyal = to.settlement.civ && kt === `c${to.settlement.civ.id}` ? 0.4 : 1;
    const e = to.econ;
    e.faithPull ||= {};
    e.faithPull[kf] = clamp((e.faithPull[kf] || 0) + n * loyal, 0, 2);
  }

  // Enough of them keep the newer faith now: the town turns.
  convertIfWon(L, day) {
    const e = L.econ;
    if (!e.faithPull) return;
    const s = L.settlement;
    const [k, v] = Object.entries(e.faithPull).sort((a, b) => b[1] - a[1])[0] || [];
    if (!k || v < 1) return;
    // (A realm's capital never gives up its own gods.)
    if (s.civ && this.sim.realms.isCapital && this.sim.realms.isCapital(s)) return;
    const was = religionOf(s);
    this.adopt(s, k);
    e.faithPull = {};
    const now = religionOf(s);
    if (!now || now.key === was.key) return;
    ledger(L, day, `Over the years, the traders' faith has taken hold in ${s.name}: most folk here now keep ${now.faith}, and pray to ${now.god}.`);
  }

  // The town keeps faith `key` from now on.
  adopt(s, key) {
    if (key.startsWith('c')) {
      const civ = this.ow().civs[Number(key.slice(1))];
      if (civ) s.faithCiv = civ === s.civ ? undefined : civ;
    } else s.faithCiv = null;
  }

  // ------------------------------------------------------------ conquest
  // A town has a new master (see realms.join): it keeps its old gods (the
  // conquerors may not let it, if their ruler's a zealot or the realm a
  // pious one).
  onConquest(s, oldCiv, newCiv, day) {
    if (!oldCiv || oldCiv === newCiv) return;
    const before = religionOf({ ...s, civ: oldCiv, faithCiv: s.faithCiv });
    if (s.faithCiv === undefined) s.faithCiv = oldCiv;
    const theirs = realmFaith(newCiv);
    if (!before || !theirs || before.key === theirs.key) {
      s.faithCiv = undefined;
      return;
    }
    const zealot = this.sim.realms.ambition && this.sim.realms.ambition(newCiv, day) === 'zealot';
    const pious = (newCiv.values || []).includes('pious');
    const L = this.game.world.layouts.get(s.id);
    if (zealot || (pious && hash4(s.id, newCiv.id, day) % 2 === 0)) {
      // Their gods, by order.
      s.faithCiv = undefined;
      if (L && L.econ) {
        const newTaboos = theirs.taboos.filter((t) => !before.taboos.includes(t)).map((t) => TABOOS[t].rule);
        L.econ.resent = { from: before.key, god: before.god, day, faith: before.faith };
        L.econ.unrest = (L.econ.unrest || 0) + 1;
        ledger(L, day, `The ${plain(newCiv)} have closed the temple of ${before.god} and put their own priests in it.${newTaboos.length ? ` Now the townsfolk must ${newTaboos.join(', and ')}.` : ''} ${s.name} is bitter about it.`);
      }
    } else if (L && L.econ) ledger(L, day, `${s.name} has new masters in the ${plain(newCiv)}, but its people still keep ${before.faith}.`);
  }

  // A forced faith rankles: folk grumble, now and then the old rites are
  // held in secret (and a guard breaks it up), and in time it fades.
  resentment(L, day, rng) {
    const R = L.econ.resent;
    if (!R) return;
    if (day - R.day > 45) {
      L.econ.resent = null;
      ledger(L, day, `Few in ${L.settlement.name} speak of ${R.god} any more; the new faith has settled in.`);
      return;
    }
    if ((day - R.day) % 7 === 3) {
      L.econ.unrest = clamp((L.econ.unrest || 0) + 0.2, 0, 3);
      for (const r of residents(L)) if ((r.traits || []).includes('devout')) r.mood = clamp((r.mood ?? 0.5) - 0.05, 0, 1);
      if (rng.chance(0.35)) ledger(L, day, rng.pick([
        `Some of ${L.settlement.name} still meet in secret to pray to ${R.god}.`,
        `A shrine to ${R.god} was found in a cellar in ${L.settlement.name}, and broken up by the watch.`,
        `Folk in ${L.settlement.name} grumble at the new taboos. "It was never like this before," they say.`,
      ]));
    }
  }

  // ------------------------------------------------------------ missions
  // A zealot's missionaries go over the border, to the nearest town of
  // another faith, to preach in its square.
  mission(civ, day, rng) {
    const R = this.sim.realms;
    const mine = realmFaith(civ);
    const caps = R.members(civ);
    if (!mine || !caps.length) return null;
    const near = [...this.game.world.layouts.values()].filter((L) => L.econ && !L.settlement.deserted && L.settlement.condition !== 'abandoned' && this.keyOf(L.settlement) !== mine.key
      && caps.some((c) => Math.hypot(c.cx - L.settlement.cx, c.cz - L.settlement.cz) <= 9));
    const T = near.length ? rng.pick(near) : null;
    if (!T) return null;
    this.pullKey(T, mine.key, 0.35);
    const theirs = religionOf(T.settlement);
    ledger(T, day, `Missionaries of ${mine.god} came from the ${plain(civ)} to preach in the square of ${T.settlement.name}. ${rng.pick(['Some listened.', 'Most turned their backs.', 'A few were taken with it.', `The ${theirs.clergy} was not pleased.`])}`);
    // (A realm that holds to its own gods takes it ill.)
    const other = T.settlement.civ;
    if (other && other !== civ && R.shift) R.shift(other, civ, -4, day);
    return T;
  }

  // ------------------------------------------------------------ holy war
  // Cause for a holy war: the faithful under a foreign ruler who forced
  // other gods on them, or (to a zealot) any town of the faith in a rival's
  // hands.
  holyCause(a, b, amb, day) {
    const mine = realmFaith(a);
    if (!mine) return null;
    const theirs = realmFaith(b);
    if (theirs && theirs.key === mine.key) return null;
    for (const s of this.sim.realms.members(b)) {
      const L = this.game.world.layouts.get(s.id);
      const forced = L && L.econ && L.econ.resent && L.econ.resent.from === mine.key && day - L.econ.resent.day <= 60;
      const kin = amb === 'zealot' && this.keyOf(s) === mine.key;
      if (forced || kin) return { k: 'faith', text: `the faithful of ${mine.god} in ${s.name}, under the ${plain(b)}` };
    }
    return null;
  }

  // ------------------------------------------------------------ pilgrims
  // The holy city of a faith: its realm's capital (the folk ways: the
  // oldest town of that people with a temple).
  holyCity(key) {
    const ow = this.ow();
    if (key.startsWith('c')) {
      const civ = ow.civs[Number(key.slice(1))];
      const R = civ && this.sim.realms.realm ? this.sim.realms.realm(civ) : null;
      return R && R.capital !== undefined ? ow.settlements[R.capital] : null;
    }
    const style = key.slice(1);
    return ow.settlements.find((s) => !s.civ && s.style === style && !s.deserted && s.condition !== 'abandoned') || null;
  }

  // One of the devout sets out to pray at the holy city (with a friend or
  // two), and comes home blessed.
  pilgrimage(L, day, rng) {
    if (!this.sim.outings || !rng.chance(0.3)) return null;
    const s = L.settlement;
    const r = religionOf(s);
    const dest = r ? this.holyCity(r.key) : null;
    if (!dest || dest.id === s.id || dest.deserted || Math.hypot(dest.cx - s.cx, dest.cz - s.cz) > 14) return null;
    const lead = residents(L).find((q) => q.age === 'adult' && (q.traits || []).includes('devout') && !q.outing && q.job !== 'mayor' && q.job !== 'guard' && q.ruler === undefined);
    if (!lead) return null;
    const t = this.sim.outings.plan(L, dest, null, day, rng, null, { lead, why: `on pilgrimage to the temple of ${r.god} in ${dest.name}` });
    if (t) t.pilgrim = true;
    return t;
  }

  serialize() {
    const faith = {};
    for (const s of this.ow().settlements) if (s.faithCiv !== undefined) faith[s.id] = s.faithCiv ? s.faithCiv.id : null;
    return { faith, lastDay: this.lastDay };
  }

  load(d) {
    this.lastDay = d && d.lastDay !== undefined ? d.lastDay : null;
    const ow = this.ow();
    for (const [sid, cid] of Object.entries((d && d.faith) || {})) {
      const s = ow.settlements[sid];
      if (s) s.faithCiv = cid === null ? null : ow.civs[cid] || undefined;
    }
  }
}
