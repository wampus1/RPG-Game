// (Round 78) Town questions. Now and then a town is split on something,
// and it's put to the vote a few days on:
//   - a law the town is divided over (see laws.js): to pass it, or throw
//     it out;
//   - who should be mayor: the mayor, or someone standing against them.
// Each side has someone speaking for it (their champion), and everyone
// grown up leans one way or the other, by their own lights (what they
// think of the law; whether the challenger's the kind of person they'd
// follow). You can ask anyone what they make of it, and try to talk them
// round (once each); stand with one side (its champion, and those of
// their mind, think the better of you; the other side, a little less);
// put money into a side's campaign (it sways the undecided). When the day
// comes, the votes are counted, the result is cried in the town's ledger,
// and it's so: the law passed or thrown out, a new mayor. Whoever backed
// the winners is remembered for it.
import { alive, ledger, mayorOf, DAY } from './econ.js';
import { LAWS, LAW_IDS, lawFits, lawOn, byDecree, stance } from './laws.js';
import { retrain } from '../entities/npcgen.js';
import { RNG, hash4, clamp } from '../util/rng.js';

const LENGTH = [3, 6]; // days a question runs
const GAP = 5; // days at least between one and the next in a town
const FUND_PER_VOTE = 25; // coin that sways one undecided voter

const voters = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor && r.age !== 'child');
const first = (r) => (r && r.name ? (typeof r.name === 'string' ? r.name.split(' ')[0] : r.name.first) : 'someone');
const full = (r) => (r && r.name ? (typeof r.name === 'string' ? r.name : `${r.name.first} ${r.name.last}`) : 'someone');

export class Causes {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.list = {}; // sid -> question
    this.last = {}; // sid -> day the last one ended
    this.seq = 1;
  }

  of(sid) {
    const q = this.list[sid];
    return q && !q.done ? q : null;
  }

  // ------------------------------------------------------------ each day
  daily(L, day) {
    const s = L.settlement;
    if (!L.econ || s.deserted || s.condition === 'abandoned') return;
    const q = this.list[s.id];
    if (q && !q.done) {
      if (day >= q.end) this.resolve(L, q, day);
      else this.campaign(L, q, day);
      return;
    }
    if (day - (this.last[s.id] ?? -GAP) < GAP) return;
    const rng = new RNG(hash4(s.id, day, 0xc4a5e));
    if (!rng.chance(0.22)) return;
    this.begin(L, day, rng);
  }

  // A question put to the town: a divided law, or the mayor challenged.
  begin(L, day, rng) {
    const s = L.settlement;
    const people = voters(L);
    if (people.length < 5) return null;
    const opts = [];
    for (const id of LAW_IDS) {
      if (!lawFits(s, id) || byDecree(L, id)) continue;
      const on = lawOn(L, id);
      const leans = people.map((r) => stance(r, id) * (on ? -1 : 1));
      const yes = leans.filter((v) => v > 0).length;
      // (Split near enough down the middle: a real question.)
      const split = Math.min(yes, people.length - yes) / people.length;
      if (split >= 0.28) opts.push({ kind: 'law', law: id, enact: !on, w: split });
    }
    const mayor = mayorOf(L);
    if (mayor && s.type !== 'village' && people.length >= 8) opts.push({ kind: 'mayor', w: 0.3 });
    if (!opts.length) return null;
    let t = rng.float(0, opts.reduce((a, o) => a + o.w, 0));
    const o = opts.find((q) => (t -= q.w) < 0) || opts[0];
    const q = { id: this.seq++, sid: s.id, kind: o.kind, start: day, end: day + rng.int(LENGTH[0], LENGTH[1]), funds: [0, 0], swayed: {}, asked: {}, side: null, done: false };
    if (o.kind === 'law') {
      q.law = o.law;
      q.enact = o.enact;
      const leanOf = (r) => stance(r, o.law) * (o.enact ? 1 : -1);
      const sorted = [...people].sort((a, b) => leanOf(b) - leanOf(a));
      q.champ = [sorted[0].idx, sorted[sorted.length - 1].idx];
      const law = LAWS[o.law];
      q.title = o.enact ? `Should ${s.name} pass a ${law.name.toLowerCase()}?` : `Should ${s.name} throw out its ${law.name.toLowerCase()}?`;
      q.sides = [o.enact ? `For the ${law.short}` : `Throw it out`, o.enact ? 'Against it' : `Keep the ${law.short}`];
      ledger(L, day, `${first(sorted[0])} has called for the town to ${o.enact ? `pass a ${law.name.toLowerCase()}` : `throw out the ${law.name.toLowerCase()}`}; ${first(sorted[sorted.length - 1])} speaks against it. The town votes on day ${q.end + 1}.`);
    } else {
      // Someone well thought of, who'd stand against the mayor.
      const cands = people.filter((r) => r !== mayor && r.age === 'adult' && !['guard'].includes(r.job));
      cands.sort((a, b) => (b.personality.sociability || 0) + (b.personality.bravery || 0) - (a.personality.sociability || 0) - (a.personality.bravery || 0));
      const ch = cands[rng.int(0, Math.min(2, cands.length - 1))];
      if (!ch) return null;
      q.champ = [mayor.idx, ch.idx];
      q.title = `Who should be mayor of ${s.name}: ${full(mayor)}, or ${full(ch)}?`;
      q.sides = [`${first(mayor)} (the mayor)`, `${first(ch)} (standing against)`];
      ledger(L, day, `${full(ch)} is standing against ${full(mayor)} to be mayor. The town votes on day ${q.end + 1}.`);
    }
    this.list[s.id] = q;
    this.tellPlayer(L, `${s.name} is divided: ${q.title} (Ask anyone in town what they make of it.)`);
    return q;
  }

  // Which way someone leans, and how hard (-1 for the first side ... +1 for
  // the second), before anyone's swayed them.
  lean(L, q, r) {
    if (q.kind === 'law') return -stance(r, q.law) * (q.enact ? 1 : -1);
    const [a, b] = q.champ.map((i) => L.npcs.find((x) => x.idx === i));
    if (!a || !b) return 0;
    if (r === a) return -1;
    if (r === b) return 1;
    // (Like follows like: kindness, boldness; and the mayor's sitting
    // comfortably, unless times are hard.)
    const P = r.personality || {};
    const near = (x) => -Math.abs((P.kindness ?? 0.5) - (x.personality.kindness ?? 0.5)) - Math.abs((P.bravery ?? 0.5) - (x.personality.bravery ?? 0.5));
    const hard = (L.econ.treasury || 0) < voters(L).length * 10 ? 0.25 : -0.1;
    const noise = ((hash4(r.idx, q.id, 0x5e1) % 1000) / 1000 - 0.5) * 0.6;
    return clamp((near(b) - near(a)) * 1.2 + hard + noise, -1, 1);
  }

  // How each votes: 0 or 1, by idx.
  votes(L, q) {
    const out = new Map();
    for (const r of voters(L)) out.set(r.idx, q.swayed[r.idx] ?? (this.lean(L, q, r) > 0 ? 1 : 0));
    return out;
  }

  tally(L, q) {
    const t = [0, 0];
    for (const v of this.votes(L, q).values()) t[v]++;
    // The undecided swayed by money spent, and you yourself, out canvassing.
    for (let i = 0; i < 2; i++) t[i] += Math.floor(q.funds[i] / FUND_PER_VOTE);
    if (q.side !== null) t[q.side] += 2;
    return t;
  }

  // The days before: the champions out canvassing (a word now and then,
  // near you), and a few minds changing of themselves.
  campaign(L, q, day) {
    const rng = new RNG(hash4(q.id, day, 0xca3));
    const people = voters(L);
    for (let k = 0; k < 2 && people.length; k++) {
      const r = people[rng.int(0, people.length - 1)];
      if (q.swayed[r.idx] !== undefined || q.champ.includes(r.idx)) continue;
      const lean = this.lean(L, q, r);
      if (Math.abs(lean) < 0.25) q.swayed[r.idx] = rng.chance(0.5 + (q.funds[1] - q.funds[0]) / 400) ? 1 : 0;
    }
  }

  // ------------------------------------------------------------ the vote
  resolve(L, q, day) {
    const s = L.settlement;
    const t = this.tally(L, q);
    const win = t[1] > t[0] ? 1 : t[0] > t[1] ? 0 : (hash4(q.id, day) & 1);
    q.done = true;
    q.won = win;
    q.result = t;
    this.last[s.id] = day;
    let what;
    if (q.kind === 'law') {
      const law = LAWS[q.law];
      // (Side 0 is whoever called for the change.)
      const change = win === 0;
      if (change) {
        L.econ.laws ||= {};
        L.econ.laws[q.law] = q.enact;
      }
      what = change ? (q.enact ? `the ${law.name.toLowerCase()} is passed (${law.desc.replace(/\.$/, '').toLowerCase()})` : `the ${law.name.toLowerCase()} is thrown out`) : (q.enact ? `there'll be no ${law.name.toLowerCase()}` : `the ${law.name.toLowerCase()} stands`);
    } else {
      const [m, ch] = q.champ.map((i) => L.npcs.find((x) => x.idx === i));
      if (win === 1 && m && ch && alive(ch)) {
        const was = ch.job;
        const rng = new RNG(hash4(q.id, 0xe1ec7));
        retrain(L, ch, 'mayor', rng);
        if (alive(m)) retrain(L, m, was === 'mayor' ? 'noble' : was, rng);
        what = `${full(ch)} is the new mayor; ${full(m)} steps down`;
      } else what = `${m ? full(m) : 'the mayor'} stays on as mayor`;
    }
    ledger(L, day, `The town has voted, ${t[0]} to ${t[1]}: ${what}.`);
    // Whoever you stood with, and what came of it.
    if (q.side !== null) {
      const won = q.side === win;
      for (const r of voters(L)) {
        const v = this.votes(L, q).get(r.idx);
        if (v === q.side) this.sim.changeRep?.(r.ent || r, won ? 4 : 1, { why: 'cause' });
      }
      this.tellPlayer(L, `${s.name} has voted (${t[0]} to ${t[1]}): ${what}. ${won ? 'Your side won.' : 'Your side lost.'}`, won ? '#a0e8a0' : '#ffb080', true);
    } else this.tellPlayer(L, `${s.name} has voted (${t[0]} to ${t[1]}): ${what}.`);
    return win;
  }

  tellPlayer(L, text, color = '#e8d8a0', always = false) {
    const g = this.game;
    if (!g || !g.ui || !g.ui.msg) return;
    const here = g.world.ow.settlementAt(g.player.x, g.player.z);
    if (always || (here && here.id === L.settlement.id)) g.ui.msg(text, color);
  }

  // ------------------------------------------------------------ you
  // What `npc` makes of it: { side, lean, text }.
  view(L, q, npc) {
    const r = npc.rec;
    const swayed = q.swayed[r.idx];
    const lean = this.lean(L, q, r);
    const side = swayed ?? (lean > 0 ? 1 : 0);
    return { side, lean, swayed: swayed !== undefined };
  }

  // Try to talk `npc` round to your side (or the other side, if you've not
  // picked one): once each. { ok, text }.
  sway(L, q, npc, toSide) {
    const r = npc.rec;
    if (q.asked[r.idx]) return { ok: false, text: 'You\'ve had your say. I\'ve heard you.' };
    q.asked[r.idx] = true;
    if (q.champ.includes(r.idx)) return { ok: false, text: 'You\'ll not talk me out of my own cause.' };
    const v = this.view(L, q, npc);
    if (v.side === toSide) return { ok: true, text: 'You\'re preaching to the choir.' };
    const op = this.sim.opinion ? this.sim.opinion(npc) : 0;
    const chance = clamp(0.55 - Math.abs(v.lean) * 0.6 + op / 200, 0.05, 0.9);
    const rng = new RNG(hash4(r.idx, q.id, 0x5a7));
    if (rng.chance(chance)) {
      q.swayed[r.idx] = toSide;
      return { ok: true, text: 'Hm. When you put it like that... all right, you\'ve changed my mind.' };
    }
    return { ok: false, text: Math.abs(v.lean) > 0.5 ? 'No. My mind\'s made up, and that\'s that.' : 'I hear you, but I\'m not persuaded.' };
  }

  join(L, q, side) {
    if (q.side === side) return false;
    const was = q.side;
    q.side = side;
    const champ = L.npcs.find((x) => x.idx === q.champ[side]);
    const other = L.npcs.find((x) => x.idx === q.champ[1 - side]);
    if (champ) this.sim.changeRep?.(champ.ent || champ, 6, { why: 'cause' });
    if (other && was !== null) this.sim.changeRep?.(other.ent || other, -4, { why: 'cause' });
    else if (other) this.sim.changeRep?.(other.ent || other, -2, { why: 'cause' });
    return true;
  }

  fund(L, q, side, coins) {
    q.funds[side] += coins;
    const champ = L.npcs.find((x) => x.idx === q.champ[side]);
    if (champ) this.sim.changeRep?.(champ.ent || champ, Math.min(8, Math.round(coins / 20)), { why: 'cause' });
  }

  // ------------------------------------------------------------ kept
  serialize() {
    return { list: this.list, last: this.last, seq: this.seq };
  }

  load(d) {
    if (!d) return;
    this.list = d.list || {};
    this.last = d.last || {};
    this.seq = d.seq || 1;
  }
}

export { DAY };
