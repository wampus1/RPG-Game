// (Round 135) The townsfolk's inner lives: what they feel about what
// happens (to them, their own, their town, their realm), what they learn,
// what they remember and pass on, and what it moves them to do.
//
// Appraisal. Whatever happens is weighed person by person, by what they
// are to it: a death by who the dead were to them (a child, a friend, a
// stranger), and how it came (old age, a blade, the one playing); a raid,
// a war, a famine by how brave or timid they are, and whose side they're
// on; a kindness or a slight by how much they get of either. See hear and
// the hooks below.
//
// Each day, in every town (see Sim.civicSteps): the children learn at their
// parents' sides and from the town's teachings; grown-ups keep up what
// they do; hunger weighs on the hungry; a few pass on what's on their minds
// to friends and neighbours; old opinions mellow; and how they feel decides
// some of their evening: the frightened stay in, the grieving go to pray,
// the glad and the angry and the worn-down go to the tavern, the ashamed
// keep out of sight.
//
// Every working hour, each worker gets a little better at their trade (the
// faster beside a better hand); and grief, fear and strain take the heart
// out of the work (see canWork).
//
// All of it from the town's own seed and the day (never the dice the rest
// of the town's day is thrown with), and none of it held by a guest: the
// world's one host works it all (multiplayer).
import { RNG, hash4, clamp } from '../../util/rng.js';
import { residents, P, nameOf, firstOf, bond, CLOSE, pkey } from './common.js';
import { DAY, alive, setOverride, freeSlot, ledger, mayorOf } from '../econ.js';
import { isHaven } from '../havenref.js';
import { asSeat } from '../../game/party.js';
import { seatOfPid } from '../saga/refs.js';
import { socialDay, seeksFor } from './social.js';
import { AMBITIONS, AMB_KINDS } from './ambition.js';
import { groupsDay, groupsOf, granted, refused, CAUSES } from './groups.js';
import { nk } from './common.js';
import { feelings, feel, stir, dominant, workMul, focus, valence } from './emotion.js';
import { remember, recall, prune, warm, mellow, gossip, opinionOf } from './memory.js';
import { JOB_SKILLS, ensureSkills, practise, childDay, adultDay, skillOf, skillWord, talentOf } from './talent.js';

export { bond, pkey };

export class Mind {
  constructor(sim) {
    this.sim = sim;
    this.game = sim.game;
    // (Round 136) What each player has been told, by key (see game/social.js:
    // passed on, or not): [{ k, w, n, x, v, s, d, sid, from }].
    this.heard = {};
  }

  serialize() {
    return { heard: this.heard };
  }

  load(d) {
    this.heard = (d && d.heard) || {};
  }

  // Whether `npc`'s town has turned its back on the one playing (`pk`): a
  // grudge against them that `npc` is part of.
  shunning(npc, pk) {
    const L = npc && (npc.homeLayout || npc.layout);
    if (!L || !L.econ || !L.econ.groups) return false;
    return L.econ.groups.some((g) => !g.out && g.k === 'player' && g.x === pk && g.mem.includes(npc.rec.idx));
  }

  now() {
    return this.sim.now ? this.sim.now() : this.sim.abs;
  }

  day() {
    return Math.floor(this.now() / DAY);
  }

  layout(sid) {
    return sid === null || sid === undefined ? null : this.game.world.layouts.get(sid) || null;
  }

  // Someone, from a story's reference to them ({ t: 'rec', sid, idx }).
  recOf(ref) {
    if (!ref || ref.t !== 'rec') return null;
    const L = this.layout(ref.sid);
    return L ? L.npcs[ref.idx] || null : null;
  }

  // ------------------------------------------------------------ appraisal
  // Something that happened, as the stories hear of it (see Saga.handle).
  hear(ev) {
    if (this.game.remote) return;
    const now = this.now();
    const day = Math.floor(now / DAY);
    switch (ev.type) {
      case 'npc_died': return this.death(ev, now, day);
      case 'raid': return this.raid(ev, now, day);
      case 'robbery': {
        const r = this.recOf(ev.victim);
        if (!r) return null;
        const p = P(r);
        stir(r, 'anger', 0.25 + p.temper * 0.35, now);
        stir(r, 'fear', 0.35 * (1 - p.bravery), now);
        remember(r, { k: 'robbed', v: -0.7, s: 0.6, x: ev.coins ? `¤${ev.coins}` : null }, day);
        return r;
      }
      case 'war_declared': return this.war(ev, now, day);
      case 'war_over': return this.peace(ev, now, day);
      case 'famine':
      case 'riot': {
        const L = this.layout(ev.sid);
        if (!L) return null;
        for (const r of residents(L)) {
          const p = P(r);
          if (ev.type === 'famine') {
            stir(r, 'strain', 0.3, now);
            stir(r, 'fear', 0.2 * (1 - p.bravery), now);
          } else {
            stir(r, p.temper > 0.55 ? 'anger' : 'fear', 0.25, now);
          }
          remember(r, { k: ev.type, v: -0.5, s: 0.45 }, day);
        }
        return L;
      }
      case 'eruption': {
        for (const L of this.game.world.layouts.values()) {
          if (!L.econ || L.settlement.island !== 'kharos') continue;
          for (const r of residents(L)) {
            stir(r, 'fear', 0.45 * (1.1 - P(r).bravery), now);
            remember(r, { k: 'eruption', v: -0.6, s: 0.6 }, day);
          }
        }
        return null;
      }
      case 'crowned': {
        const L = this.layout(ev.sid);
        const r = L ? L.npcs[ev.idx] : null;
        if (r) {
          stir(r, 'pride', 0.8, now);
          remember(r, { k: 'crowned', v: 0.9, s: 0.95 }, day);
        }
        if (L) for (const q of residents(L)) if (q !== r) stir(q, 'joy', 0.15, now);
        return r;
      }
      case 'exiled': {
        const r = this.recOf(ev.who);
        if (!r) return null;
        stir(r, 'shame', 0.55, now);
        stir(r, 'anger', 0.35 + P(r).temper * 0.3, now);
        remember(r, { k: 'exiled', v: -0.9, s: 0.9 }, day);
        const L = this.layout(ev.who.sid);
        if (L) for (const q of residents(L)) if (bond(q, r) && CLOSE[bond(q, r)] >= 0.6) stir(q, 'grief', 0.35, now);
        return r;
      }
      case 'player_died': {
        // (Those who liked you mourn you, a little, until you're back.)
        const L = this.layout(ev.sid);
        if (!L) return null;
        for (const r of residents(L)) {
          const v = this.sim.repEntry ? this.sim.repEntry(L.settlement.id, r.idx).v : 0;
          if (v >= 35) stir(r, 'grief', Math.min(0.5, v / 160), now);
        }
        return L;
      }
      case 'crime': {
        // Someone done wrong by the one playing, and seen to be.
        const L = this.layout(ev.sid);
        if (!L) return null;
        const who = `p:${ev.pid || 'host'}`;
        const victim = ev.victim && typeof ev.victim === 'object' ? this.recOf(ev.victim) : null;
        if (victim) {
          stir(victim, 'anger', 0.3 + (ev.sev || 1) * 0.1, now);
          stir(victim, 'fear', 0.2 * (1 - P(victim).bravery), now);
          remember(victim, { k: 'wronged', w: who, v: -0.8, s: 0.7, x: ev.type }, day);
        }
        return victim;
      }
      default:
        return null;
    }
  }

  death(ev, now, day) {
    const dead = this.recOf(ev.who);
    const L = this.layout(ev.who && ev.who.sid);
    if (!dead || !L) return null;
    const cause = ev.cause || '';
    const violent = /slain|killed|murder|blade|raid/.test(cause) || !!ev.byPlayer;
    const pk = ev.byPlayer ? pkey(this.game) : null;
    let n = 0;
    for (const r of residents(L)) {
      if (r === dead) continue;
      const b = bond(r, dead);
      const p = P(r);
      if (b) {
        const c = CLOSE[b];
        stir(r, 'grief', c * (0.75 + p.kindness * 0.3), now);
        if (b === 'partner') stir(r, 'love', 0.35, now);
        if (violent) stir(r, 'anger', c * (0.35 + p.temper * 0.5), now);
        remember(r, { k: 'loss', n: firstOf(dead), w: `n:${dead.idx}`, v: -0.9 * c, s: Math.min(1, 0.5 + c * 0.5), x: b }, day);
        if (pk) {
          remember(r, { k: 'killed', w: pk, n: firstOf(dead), v: -1, s: 0.95, x: b }, day);
          warm(r, pk, -0.8 * c);
        }
        n++;
      } else if (violent) {
        // (A killing in town frightens those it didn't touch.)
        stir(r, 'fear', 0.18 * (1 - p.bravery), now);
        if (pk) remember(r, { k: 'killed', w: pk, n: firstOf(dead), v: -0.6, s: 0.5, h: 1 }, day);
      } else if (cause === 'old age' && p.kindness > 0.6 && dead.age === 'elder') stir(r, 'grief', 0.05, now);
    }
    return n;
  }

  raid(ev, now, day) {
    const L = this.layout(ev.sid);
    if (!L) return null;
    for (const r of residents(L)) {
      const p = P(r);
      if (ev.won) {
        stir(r, 'fear', 0.4 * (1.1 - p.bravery), now);
        stir(r, 'anger', 0.3 * p.bravery + 0.1 * p.temper, now);
        if (r.job === 'guard') stir(r, 'shame', 0.3, now);
        remember(r, { k: 'raid', v: -0.7, s: 0.6, x: ev.take ? 'lost' : 'hit' }, day);
      } else {
        stir(r, 'fear', 0.15 * (1 - p.bravery), now);
        stir(r, r.job === 'guard' ? 'pride' : 'joy', r.job === 'guard' ? 0.45 : 0.2, now);
        remember(r, { k: 'raid_beaten', v: 0.4, s: 0.45 }, day);
      }
    }
    return L;
  }

  war(ev, now, day) {
    const civs = new Set([ev.a, ev.b].map((c) => (c && typeof c === 'object' ? c.id : c)));
    for (const L of this.game.world.layouts.values()) {
      const civ = L.settlement && L.settlement.civ;
      if (!L.econ || !civ || !civs.has(civ.id)) continue;
      const martial = (civ.values || []).includes('martial');
      for (const r of residents(L)) {
        const p = P(r);
        if (martial || p.bravery > 0.65) {
          stir(r, 'pride', 0.25, now);
          stir(r, 'anger', 0.2, now);
        } else stir(r, 'fear', 0.35 * (1.1 - p.bravery), now);
        stir(r, 'strain', 0.15, now);
        remember(r, { k: 'war', v: martial ? -0.2 : -0.6, s: 0.6 }, day);
      }
    }
    return null;
  }

  peace(ev, now, day) {
    const id = (c) => (c && typeof c === 'object' ? c.id : c);
    const victor = id(ev.victor);
    const sides = new Set([id(ev.a), id(ev.b)]);
    for (const L of this.game.world.layouts.values()) {
      const civ = L.settlement && L.settlement.civ;
      if (!L.econ || !civ || !sides.has(civ.id)) continue;
      const won = victor !== null && victor !== undefined && civ.id === victor;
      for (const r of residents(L)) {
        stir(r, 'fear', -0.6, now);
        if (won) stir(r, 'pride', 0.4, now);
        else if (victor !== null && victor !== undefined) stir(r, 'shame', 0.25, now);
        stir(r, 'joy', won ? 0.35 : 0.15, now);
        remember(r, { k: won ? 'won_war' : 'peace', v: won ? 0.7 : 0.3, s: 0.6 }, day);
      }
    }
    return null;
  }

  // ------------------------------------------------------------ the one playing
  // A gift from the one playing (see Sim.giveGift): `reaction` as it was
  // taken ('hungry', 'hobby', 'love', 'junk', 'coin', 'fine').
  gift(npc, item, reaction, score) {
    const r = npc && npc.rec;
    if (!r) return;
    const now = this.now();
    const day = Math.floor(now / DAY);
    const pk = pkey(this.game);
    if (reaction === 'junk') {
      stir(r, 'anger', 0.12 + P(r).temper * 0.15, now);
      remember(r, { k: 'junk_gift', w: pk, v: -0.3, s: 0.3, x: item }, day);
      warm(r, pk, -0.05);
      return;
    }
    const k = clamp(0.12 + score * 0.025, 0.1, 0.55);
    stir(r, 'joy', k, now);
    if (reaction === 'love') stir(r, 'love', 0.2, now);
    if (reaction === 'hungry') stir(r, 'strain', -0.4, now);
    remember(r, { k: 'gift', w: pk, v: Math.min(0.9, 0.3 + score * 0.04), s: clamp(0.25 + score * 0.03, 0.25, 0.7), x: item }, day);
    warm(r, pk, k * 0.3);
  }

  // A kind word, or a rude one (see Sim.chat).
  words(npc, kind) {
    const r = npc && npc.rec;
    if (!r) return;
    const now = this.now();
    const day = Math.floor(now / DAY);
    const p = P(r);
    const pk = pkey(this.game);
    if (kind === 'kind') {
      // (The lonely and the low take it to heart more.)
      const low = Math.max(0, -valence(r, now));
      stir(r, 'joy', 0.08 + (1 - p.sociability) * 0.08 + low * 0.15, now);
      if (feel(r, 'grief', now) > 0.3) stir(r, 'grief', -0.12, now);
      warm(r, pk, 0.04);
      if (low > 0.3) remember(r, { k: 'comforted', w: pk, v: 0.6, s: 0.45 }, day);
    } else if (kind === 'rude') {
      stir(r, 'anger', 0.2 + p.temper * 0.4, now);
      stir(r, 'shame', 0.18 * (1 - p.temper) * (1 - p.bravery), now);
      remember(r, { k: 'insult', w: pk, v: -0.5, s: 0.4 + p.temper * 0.25 }, day);
      warm(r, pk, -0.12);
    } else if (kind === 'jest') {
      // A joke lands with the cheerful and the sociable; falls flat with
      // the grieving (and worse).
      if (feel(r, 'grief', now) > 0.4) {
        stir(r, 'anger', 0.15, now);
        remember(r, { k: 'tactless', w: pk, v: -0.4, s: 0.35 }, day);
        return false;
      }
      const lands = p.sociability * 0.6 + (1 - p.temper) * 0.3 + Math.max(0, valence(r, now)) * 0.3 > 0.45;
      if (lands) {
        stir(r, 'joy', 0.18, now);
        stir(r, 'strain', -0.15, now);
        warm(r, pk, 0.03);
      }
      return lands;
    }
    return true;
  }

  // Hurt by the one playing (see Game.damage).
  hurt(rec, byPlayer = true) {
    if (!rec) return;
    const now = this.now();
    const p = P(rec);
    stir(rec, 'fear', 0.3 * (1.1 - p.bravery), now);
    stir(rec, 'anger', 0.25 + p.temper * 0.35 + p.bravery * 0.15, now);
    if (byPlayer) {
      const pk = pkey(this.game);
      remember(rec, { k: 'hurt', w: pk, v: -0.8, s: 0.7 }, Math.floor(now / DAY));
      warm(rec, pk, -0.25);
    }
  }

  // Saved from harm by the one playing.
  saved(rec) {
    if (!rec) return;
    const now = this.now();
    const pk = pkey(this.game);
    stir(rec, 'fear', -0.6, now);
    stir(rec, 'joy', 0.45, now);
    stir(rec, 'love', 0.2, now);
    remember(rec, { k: 'saved', w: pk, v: 1, s: 0.9 }, Math.floor(now / DAY));
    warm(rec, pk, 0.5);
  }

  // ------------------------------------------------------------ life's events
  wedding(L, a, b) {
    const now = this.now();
    const day = Math.floor(now / DAY);
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!x) continue;
      stir(x, 'joy', 0.8, now);
      stir(x, 'love', 0.7, now);
      remember(x, { k: 'wed', w: `n:${y.idx}`, n: firstOf(y), v: 1, s: 0.95 }, day);
      warm(x, `n:${y.idx}`, 0.6);
    }
    for (const r of residents(L)) {
      if (r === a || r === b) continue;
      const ba = bond(r, a);
      const bb = bond(r, b);
      const c = Math.max(CLOSE[ba] || 0, CLOSE[bb] || 0);
      if (c > 0.2) {
        stir(r, 'joy', c * 0.5, now);
        if (c >= 0.6) remember(r, { k: 'wedding', n: `${firstOf(a)} and ${firstOf(b)}`, v: 0.7, s: 0.5 }, day);
      }
    }
  }

  birth(L, child, a, b) {
    const now = this.now();
    const day = Math.floor(now / DAY);
    for (const x of [a, b]) {
      if (!x) continue;
      stir(x, 'joy', 0.8, now);
      stir(x, 'love', 0.55, now);
      stir(x, 'strain', 0.12, now);
      remember(x, { k: 'born', w: `n:${child.idx}`, n: firstOf(child), v: 1, s: 0.95 }, day);
      warm(x, `n:${child.idx}`, 0.8);
      // (Grandparents too.)
      for (const gi of x.parents || []) {
        const g = L.npcs[gi];
        if (g && alive(g)) {
          stir(g, 'joy', 0.5, now);
          remember(g, { k: 'grandchild', n: firstOf(child), v: 0.8, s: 0.6 }, day);
        }
      }
    }
  }

  grownUp(L, r, job) {
    const now = this.now();
    const day = Math.floor(now / DAY);
    stir(r, 'pride', 0.4, now);
    stir(r, 'strain', 0.1, now);
    remember(r, { k: 'grown', v: 0.6, s: 0.6, x: job }, day);
    for (const pi of r.parents || []) {
      const p = L.npcs[pi];
      if (p && alive(p)) stir(p, p.job === job ? 'pride' : 'joy', 0.35, now);
    }
  }

  chosen(L, r) {
    const now = this.now();
    stir(r, 'pride', 0.6, now);
    stir(r, 'strain', 0.15, now);
    remember(r, { k: 'chosen', v: 0.8, s: 0.8, x: 'mayor' }, Math.floor(now / DAY));
  }

  // A festival over: how it went (0..1).
  festival(L, quality = 0.6) {
    const now = this.now();
    const day = Math.floor(now / DAY);
    for (const r of residents(L)) {
      stir(r, 'joy', 0.15 + quality * 0.35, now);
      stir(r, 'strain', -0.3, now);
      if (quality >= 0.75 && r.age !== 'child') remember(r, { k: 'feast', v: 0.6, s: 0.4 }, day);
    }
  }

  // ------------------------------------------------------------ work
  // Can they put their heart into the work this hour? Grief, fear and
  // strain take some hours from them (decided by the hour, not the dice).
  canWork(rec, h) {
    // (Round 136: tools down, with the others: see groups.js.)
    if (rec.strike !== undefined && rec.strike >= this.day()) return false;
    if (!rec.emo) return true;
    const w = workMul(rec, this.now());
    if (w >= 1) return true;
    return (hash4(rec.idx | 0, h | 0, 0x30b) % 1000) / 1000 < w;
  }

  // An hour at their trade: a little better at it.
  worked(L, rec) {
    const jobs = JOB_SKILLS[rec.job];
    if (!jobs) return;
    const now = this.now();
    const f = focus(rec, now);
    const best = L._mentor && rec.work && rec.work.building !== undefined ? L._mentor.get(rec.work.building) : null;
    const before = skillOf(rec, jobs[0]);
    const after = practise(L, rec, jobs[0], 0.0016, best ? best[jobs[0]] || 0 : 0, f);
    if (jobs[1]) practise(L, rec, jobs[1], 0.0007, best ? best[jobs[1]] || 0 : 0, f);
    // (A threshold crossed: a step up in the trade, and they know it.)
    for (const th of [0.55, 0.72, 0.88]) {
      if (before < th && after >= th) {
        stir(rec, 'pride', th >= 0.88 ? 0.7 : 0.35, now);
        remember(rec, { k: 'mastery', v: 0.7, s: th >= 0.88 ? 0.8 : 0.45, x: jobs[0] }, Math.floor(now / DAY));
        if (th >= 0.88 && L.econ) ledger(L, Math.floor(now / DAY), `${nameOf(rec)} is now counted a master ${rec.job === 'cook' ? 'cook' : `of ${jobs[0]}`}, ${skillWord(after)} at it, folk say.`);
      }
    }
  }

  // ------------------------------------------------------------ the day
  // A town's day, for its people's inner lives (see Sim.civicSteps).
  townDay(L, day) {
    if (this.game.remote || !L.econ) return;
    const now = day * DAY + 600;
    const rng = new RNG(hash4(L.settlement.seed | 0, day, 0x3e7d));
    const ppl = residents(L);
    // The town's teachers: its priest(s), and its books.
    let priest = 0;
    for (const r of ppl) if (r.job === 'priest') priest = Math.max(priest, skillOf(r, 'lore'));
    const books = L.buildings.some((b) => (b.type === 'academy' || b.type === 'college') && !b.underConstruction) ? 1
      : L.buildings.some((b) => b.type === 'library' && !b.underConstruction) ? 0.6 : L.buildings.some((b) => b.type === 'study' && !b.underConstruction) ? 0.3 : 0;
    const teach = { priest, books };
    // The best hand at each workplace, at each skill (the others learn from them).
    const mentor = new Map();
    for (const r of ppl) {
      const b = r.work && r.work.building;
      if (b === undefined || b === null || r.age === 'child') continue;
      ensureSkills(L, r);
      const m = mentor.get(b) || {};
      for (const k of JOB_SKILLS[r.job] || []) m[k] = Math.max(m[k] || 0, r.skills[k] || 0);
      mentor.set(b, m);
    }
    L._mentor = mentor;
    const tavern = L.buildings.find((b) => b.type === 'tavern' && !b.underConstruction) || null;
    const temple = L.buildings.find((b) => b.type === 'temple' && !b.underConstruction) || null;
    for (const r of ppl) {
      if (r.age === 'child') childDay(L, r, day, teach);
      else adultDay(L, r, day);
      // Hunger weighs.
      if (r.hungry >= 2) stir(r, 'strain', 0.25, now);
      else if (r.hungry >= 1) stir(r, 'strain', 0.1, now);
      mellow(r);
      if (day % 5 === r.idx % 5) prune(r, day);
      if (r.age !== 'child') this.evening(L, r, day, now, rng, tavern, temple);
    }
    // Word gets about: a few pairs who see each other pass on what's on
    // their minds.
    const talk = Math.min(8, Math.ceil(ppl.length / 12));
    for (let i = 0; i < talk && ppl.length > 1; i++) {
      const a = ppl[rng.int(0, ppl.length - 1)];
      if (a.age === 'child') continue;
      const close = ppl.filter((q) => q !== a && q.age !== 'child' && bond(a, q));
      const b = close.length ? close[rng.int(0, close.length - 1)] : ppl[rng.int(0, ppl.length - 1)];
      if (b === a) continue;
      this.passOn(L, a, b, day);
    }
    // (Round 136) Their dealings with each other, what they're after, and
    // what they do together: each with dice of its own.
    socialDay(L, ppl, day, now, new RNG(hash4(L.settlement.seed | 0, day, 0x50c1a)), this.sim.society);
    const c = this.ctx(L, day, new RNG(hash4(L.settlement.seed | 0, day, 0xa3b1)), ppl, now);
    this.ambitionsDay(c);
    c.ppl = residents(L);
    c.adults = c.ppl.filter((r) => r.age !== 'child');
    groupsDay(c);
    // Who'll come looking for whom (thanks, advice, an invitation, a
    // warning): see npc.seekTick.
    seeksFor(L, c.ppl, day, c.rng, this.playerKeys());
    for (const r of c.ppl) {
      if (r.seek && day - r.seek.d > 10) r.seek = null;
      if (r.strike !== undefined && r.strike < day) delete r.strike;
      // (A thief from want, fed again, gives it up.)
      if (r.life && r.life.desperate !== undefined && !(r.hungry >= 1) && day - r.life.desperate > 3) {
        if (r.life.vice === 'thief') r.life.vice = null;
        delete r.life.desperate;
      }
    }
  }

  // ------------------------------------------------------------ (Round 136)
  // How a town stands today, for its people's ambitions and its groups.
  ctx(L, day, rng = new RNG(hash4(L.settlement.seed | 0, day, 0xa3b1)), ppl = residents(L), now = day * DAY + 600) {
    const adults = ppl.filter((r) => r.age !== 'child');
    let mood = 0;
    let guards = 0;
    for (const r of adults) {
      mood += r.mood ?? 0.5;
      if (r.job === 'guard') guards++;
    }
    mood = adults.length ? mood / adults.length : 0.5;
    const books = L.buildings.some((b) => (b.type === 'academy' || b.type === 'college') && !b.underConstruction) ? 1 : L.buildings.some((b) => b.type === 'library' && !b.underConstruction) ? 0.6 : 0;
    const open = groupsOf(L).find((g) => !g.out && CAUSES[g.k] && CAUSES[g.k].complaint);
    const c = {
      M: this, sim: this.sim, L, sid: L.settlement.id, day, now, rng, ppl, adults, S: this.sim.saga || null, mayor: mayorOf(L),
      governed: !!(this.sim.office && this.sim.office.governs(L)), mood, guards, books, grievance: open ? open.k : null, society: this.sim.society || null,
    };
    c.end = (r, how, m = null) => this.endAmb(c, r, how, m);
    c.threadDone = (r, a, good, test = null) => {
      const th = c.S && a.th !== undefined ? c.S.thread(a.th) : null;
      if (!th) return c.end(r, test && test() ? 'done' : 'let_go');
      if (!th.done) return null;
      const ok = test ? test() : good.includes(th.outcome);
      return c.end(r, ok ? 'done' : th.outcome === 'faded' ? 'let_go' : 'lost');
    };
    return c;
  }

  // Each ambition held, a day further on; and a few new ones taken up.
  ambitionsDay(c) {
    let held = 0;
    for (const r of c.adults) {
      const a = r.amb;
      if (!a) continue;
      held++;
      const A = AMBITIONS[a.k];
      if (!A || r.migrated || r.away) {
        if (!A) r.amb = null;
        continue;
      }
      try {
        A.day(c, r, a);
      } catch (e) {
        r.amb = null;
        if (this.sim.saga) this.sim.saga.trace?.('mind', `${nameOf(r)}'s ambition failed: ${e && e.message}`);
      }
    }
    if (held >= Math.ceil(c.adults.length * 0.4)) return;
    const n = Math.max(1, Math.ceil(c.adults.length / 10));
    for (let i = 0; i < n; i++) {
      const r = c.adults[c.rng.int(0, c.adults.length - 1)];
      if (!r || r.amb || (r.ambCd || 0) > c.day || r.migrated || r.away) continue;
      // (Of what they might want, one: the stronger the likelier.)
      const opts = [];
      let tot = 0;
      for (const k of AMB_KINDS) {
        const w = AMBITIONS[k].want(c, r);
        if (w && w.s > 0.15) {
          opts.push({ k, ...w });
          tot += w.s;
        }
      }
      let best = null;
      let roll = c.rng.next() * tot;
      for (const o of opts) {
        roll -= o.s;
        if (roll <= 0) {
          best = o;
          break;
        }
      }
      if (!best && opts.length) best = opts[opts.length - 1];
      if (!best || !c.rng.chance(Math.min(0.9, best.s + 0.25))) {
        r.ambCd = c.day + 3;
        continue;
      }
      r.amb = { k: best.k, d: c.day, p: 0, st: 0 };
      if (best.t) r.amb.t = best.t;
      if (best.n) r.amb.n = best.n;
      if (best.x) r.amb.x = best.x;
      stir(r, best.k === 'revenge' ? 'anger' : best.k === 'leave' ? 'strain' : 'joy', 0.1, c.now);
    }
    // Rivals: two after the same heart, or the same office.
    for (const r of c.adults) {
      const a = r.amb;
      if (!a || (a.k !== 'wed' && a.k !== 'office') || a.riv) continue;
      const q = c.adults.find((o) => o !== r && o.amb && o.amb.k === a.k && (a.k === 'office' || (a.t && o.amb.t === a.t)));
      if (!q) continue;
      a.riv = q.idx;
      q.amb.riv = r.idx;
      warm(r, nk(q), -0.15);
      warm(q, nk(r), -0.15);
      remember(r, { k: 'rival', w: nk(q), n: q.name.first, x: a.k, v: -0.4, s: 0.4 }, c.day);
      remember(q, { k: 'rival', w: nk(r), n: r.name.first, x: a.k, v: -0.4, s: 0.4 }, c.day);
    }
  }

  // An ambition over: done, lost, or let go of.
  endAmb(c, r, how, m = null) {
    const a = r.amb;
    if (!a) return how;
    r.amb = null;
    r.ambCd = c.day + 5 + c.rng.int(0, 6);
    if (a.k === 'revenge' && r.seek && r.seek.k === 'confront') r.seek = null;
    const k = m && m.k ? m.k : how === 'done' ? 'dream_done' : how === 'lost' ? 'dream_lost' : 'gave_up';
    const w = m && m.w !== undefined ? m.w : a.t && !a.t.startsWith('p:') ? a.t : undefined;
    remember(r, { k, x: m && m.x !== undefined ? m.x : a.k, w, n: m && m.n !== undefined ? m.n : a.n, v: how === 'done' ? 0.8 : how === 'lost' ? -0.6 : 0.1, s: how === 'done' ? 0.65 : how === 'lost' ? 0.55 : 0.25 }, c.day);
    if (how === 'done') {
      stir(r, 'joy', 0.45, c.now);
      if (a.k !== 'revenge') stir(r, 'pride', 0.4, c.now);
    } else if (how === 'lost') {
      stir(r, 'grief', 0.25, c.now);
      stir(r, 'shame', 0.2, c.now);
    } else stir(r, 'strain', -0.2, c.now);
    // (Those close to them glad, or sorry, for them.)
    for (const q of c.adults) {
      const b = q !== r ? bond(q, r) : null;
      if (!b || (CLOSE[b] || 0) < 0.5) continue;
      if (how === 'done') stir(q, b === 'child' ? 'pride' : 'joy', 0.15, c.now);
      else if (how === 'lost') stir(q, 'grief', 0.08, c.now);
    }
    return how;
  }

  // A laid-out town near `L` that `ok` accepts, nearest first.
  townWith(L, ok, far = 12) {
    const s = L.settlement;
    let best = null;
    let bd = far;
    for (const T of this.game.world.layouts.values()) {
      const o = T.settlement;
      if (!T.econ || T === L || o.deserted || o.condition === 'abandoned' || o.founding || isHaven(o)) continue;
      const d = Math.hypot(o.cx - s.cx, o.cz - s.cz);
      if (d < bd && ok(T)) {
        bd = d;
        best = T;
      }
    }
    return best;
  }

  // Somewhere better than `L` to live, if there is (towns already laid
  // out: nobody moves somewhere nobody's heard of).
  betterTown(L) {
    const score = (T) => {
      const ppl = residents(T);
      const mood = ppl.length ? ppl.reduce((n, r) => n + (r.mood ?? 0.5), 0) / ppl.length : 0.5;
      const cond = T.settlement.condition === 'prosperous' ? 0.1 : T.settlement.condition === 'poor' ? -0.1 : 0;
      return mood - (T.econ.tax || 0) * 2 + cond - ((T.econ.recent && T.econ.recent.raids) || 0) * 0.05 - (T.econ.famineDays || 0) * 0.03;
    };
    const here = score(L);
    let best = null;
    let bv = here + 0.05;
    for (const T of this.game.world.layouts.values()) {
      if (!T.econ || T === L || T.settlement.deserted || T.settlement.condition === 'abandoned' || isHaven(T.settlement)) continue;
      if (Math.hypot(T.settlement.cx - L.settlement.cx, T.settlement.cz - L.settlement.cz) > 12) continue;
      if (T.settlement.island && L.settlement.island && T.settlement.island !== L.settlement.island) continue;
      const v = score(T);
      if (v > bv) {
        bv = v;
        best = T;
      }
    }
    return best;
  }

  // Off to another town: what they were after and who they were sizing up
  // stays behind (see civic.relocate).
  move(L, recs, T, why) {
    for (const r of recs) {
      r.amb = null;
      r.seek = null;
    }
    const moved = this.sim.sendPeople(L, recs, T, why);
    const head = recs.find((r) => r.age !== 'child') || recs[0];
    if (head && this.sim.society) this.sim.society.gone(L, head, 'better', T.settlement.name, this.day());
    return moved;
  }

  // Someone's grudge told about (`a`: their ambition for revenge).
  badMouth(L, r, a, day, rng, n = 1) {
    const ppl = residents(L).filter((q) => q !== r && q.age !== 'child' && nk(q) !== a.t);
    if (!ppl.length) return 0;
    const friends = ppl.filter((q) => (r.friends || []).includes(q.idx) || bond(r, q));
    let told = 0;
    for (let i = 0; i < n; i++) {
      const pool = friends.length && rng.chance(0.6) ? friends : ppl;
      const q = pool[rng.int(0, pool.length - 1)];
      const o = `bw:${r.idx}:${a.t}`;
      if ((q.mem || []).some((m) => m.o === o)) continue;
      // (Believed by those who like the teller.)
      const trust = opinionOf(q, nk(r));
      remember(q, { k: 'bad_word', w: a.t, n: a.n, x: r.name.first, v: -0.5, s: 0.35 + Math.max(0, trust) * 0.2, h: 1, o }, day);
      if (a.t.startsWith('p:')) {
        this.asPk(a.t, () => {
          const e = this.sim.repEntry(L.settlement.id, q.idx);
          e.v = clamp(e.v - (trust > 0 ? 3 : 1), -100, 100);
          if (this.sim.areaCache) this.sim.areaCache.delete(L.settlement.id);
        });
        warm(q, a.t, -0.04 - Math.max(0, trust) * 0.06);
      } else warm(q, a.t, -0.03 - Math.max(0, trust) * 0.05);
      told++;
    }
    return told;
  }

  // The nearest city with an Academy to `L`, laid out.
  academyCity(L) {
    return this.townWith(L, (T) => T.settlement.type === 'city' && T.buildings.some((b) => b.type === 'academy' && !b.underConstruction), 40);
  }

  // Everyone playing, as memories have them.
  playerKeys() {
    const g = this.game;
    if (!g.seats || !g.seats.length) return ['p:host'];
    return g.seats.map((q) => `p:${q.host ? 'host' : q.id}`);
  }

  // Run `fn` as the one playing whose key is `pk` (their standing with
  // the town, theirs: multiplayer).
  asPk(pk, fn) {
    const g = this.game;
    const id = String(pk).slice(2);
    if (!g.seats || !g.seats.length) return id === 'host' ? fn() : undefined;
    const seat = seatOfPid(g, id);
    return seat ? asSeat(g, seat, fn) : undefined;
  }

  // A group's petition answered by someone playing who governs the town
  // (see agenda.js, office.js ACTS.mind_group).
  groupAnswer(L, id, yes, who = 'The council') {
    const g = groupsOf(L).find((q) => q.id === id && !q.out);
    if (!g) return null;
    const c = this.ctx(L, this.day(), new RNG(hash4(L.settlement.seed | 0, this.day(), id, 0x6a2)), residents(L), this.now());
    const mem = c.adults.filter((r) => g.mem.includes(r.idx));
    if (yes) {
      // (Granted: the tax or the bread, if any, done by the council's own
      // reckoning; the rest here.)
      if (g.k === 'tax' || g.k === 'hunger') {
        for (const r of mem) {
          stir(r, 'joy', 0.3, c.now);
          stir(r, 'anger', -0.4, c.now);
          remember(r, { k: 'petition_won', x: g.k, v: 0.7, s: 0.5 }, c.day);
        }
        g.out = { how: 'won', day: c.day };
        return 'won';
      }
      return granted(c, g, mem, who);
    }
    return refused(c, g, mem);
  }

  // `a` tells `b` something; what's told of the one playing colours what
  // `b` thinks of them, a little.
  passOn(L, a, b, day) {
    const m = gossip(a, b, day);
    if (!m) return null;
    if (m.w && m.w.startsWith('p:') && this.sim.repEntry) {
      // (As the one it's about: each player their own standing.)
      this.asPk(m.w, () => {
        const e = this.sim.repEntry(L.settlement.id, b.idx);
        const d = Math.round(m.v * 4);
        if (d) e.v = clamp(e.v + d, -100, 100);
        if (this.sim.areaCache) this.sim.areaCache.delete(L.settlement.id);
      });
      warm(b, m.w, m.v * 0.08);
    }
    // (Round 136) A lie told about someone, found out by the one it was
    // about: whoever told it is remembered for it.
    if (m.o && m.o.startsWith('rum:') && m.w === nk(b)) {
      // ('rum:<who told it>:<about>:<day>', the teller a key of its own.)
      const liar = m.o.split(':').slice(1, -2).join(':');
      remember(b, { k: 'slander', w: liar, v: -0.8, s: 0.6, x: m.k }, day);
      warm(b, liar, -0.3);
      stir(b, 'anger', 0.35, this.now());
    }
    if (m.w && m.w.startsWith('n:')) warm(b, m.w, m.v * 0.1);
    return m;
  }

  // How they feel decides some of their evening.
  evening(L, r, day, now, rng, tavern, temple) {
    if (!r.emo || r.override || r.hired || r.trip || (r.job === 'guard' && r.shift === 'night')) return null;
    const d = dominant(r, now, 0.4);
    if (!d || !rng.chance(0.35 + d.v * 0.5)) return null;
    const slot = freeSlot(r, day, 17 * 60, 150);
    if (!slot) return null;
    const p = P(r);
    const at = (place, act = 'social', extra = {}) => setOverride(r, slot.s, slot.e, act, { place, feel: d.kind, ...extra });
    switch (d.kind) {
      case 'fear':
      case 'shame':
        return at('home', 'home');
      case 'grief':
        if (temple && rng.chance(0.6)) return setOverride(r, slot.s, Math.min(slot.e, slot.s + 90), 'pray', { place: 'temple', target: temple.inside, feel: 'grief' });
        return at('home', 'home');
      case 'anger':
        return tavern && p.temper > 0.45 ? at('tavern') : at('home', 'home');
      case 'joy':
      case 'pride':
      case 'love':
        return tavern ? at('tavern') : null;
      default:
        return null;
    }
  }

  // What's on someone's mind, for talk (see dialogue): their uppermost
  // memory, optionally only of some kind.
  onMind(rec, fn = null) {
    const ms = recall(rec, this.day(), fn);
    return ms[0] || null;
  }

  opinion(rec, who) {
    return opinionOf(rec, who);
  }

  talent(L, rec, key) {
    return talentOf(L, rec, key);
  }

  feelings(rec) {
    return feelings(rec, this.now());
  }
}
