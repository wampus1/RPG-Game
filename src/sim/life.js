// Town life that goes on whether you're there or not: a new mayor chosen
// when the old one dies, weddings, children growing up and taking up a
// trade, grown-ups growing old, and beasts at the edge of town in the
// night. Come back after a while and the place has moved on.
import { alive, ledger, CHILDHOOD, ADULTHOOD } from './econ.js';
import { retrain, growUp, growOld } from '../entities/npcgen.js';
import { RNG, hash4 } from '../util/rng.js';

const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);

function syncEnt(r, was = r.age) {
  const e = r.ent;
  if (e && !e.dead) {
    e.look = r.look;
    e.activity = null;
    // A child's quick step lengthens; an elder's slows.
    const pace = (a) => (a === 'elder' ? 1.35 : a === 'child' ? 0.85 : 1);
    if (e.step) e.step *= pace(r.age) / pace(was);
    e.maxHp = r.maxHp;
    e.hp = Math.min(e.hp ?? r.maxHp, r.maxHp);
  }
}

// A town without a mayor chooses one after a couple of days: someone
// respected, kind and sensible (an old hand or a noble, often).
export function electMayor(sim, L, day) {
  const e = L.econ;
  const s = L.settlement;
  if (s.deserted || L.npcs.some((r) => r.job === 'mayor' && alive(r) && !r.migrated)) {
    e.mayorless = null;
    return null;
  }
  if (e.mayorless === null || e.mayorless === undefined) {
    e.mayorless = day;
    return null;
  }
  if (day - e.mayorless < 2) return null;
  const cands = residents(L).filter((r) => r.age !== 'child' && r.job !== 'guard' && !(r.hired));
  if (!cands.length) return null;
  const score = (r) => r.personality.kindness + r.personality.sociability * 0.6 + (r.skills?.trading || 0) + (r.age === 'elder' ? 0.5 : 0) + (r.job === 'noble' ? 0.8 : r.job === 'priest' ? 0.3 : 0);
  const best = cands.sort((a, b) => score(b) - score(a))[0];
  const old = best.job;
  retrain(L, best, 'mayor', new RNG(hash4(best.idx, day, 0xe1ec)));
  syncEnt(best);
  e.mayorless = null;
  ledger(L, day, `${best.name.first} ${best.name.last}${old && old !== 'retired' ? `, once a ${old},` : ''} was chosen as the new ${s.type === 'village' ? 'elder' : 'mayor'} of ${s.name}.`);
  return best;
}

function related(L, a, b) {
  if (a.parents.includes(b.idx) || b.parents.includes(a.idx)) return true;
  return a.parents.some((p) => b.parents.includes(p));
}

// Two single grown-ups from different families decide to marry now and
// then: the wedding is two days later (see events.js), and then they set up
// home together (in the roomier of their two houses).
export function weddings(sim, L, day, rng) {
  if (L.settlement.deserted) return null;
  const single = (r) => r.partner === null || r.partner === undefined || !alive(L.npcs[r.partner]);
  const taken = sim.events.engaged(L);
  const singles = residents(L).filter((r) => r.age === 'adult' && single(r) && r.job !== 'merchant' && !taken.has(r.idx));
  // (The more single grown-ups about, the sooner two of them hit it off.)
  if (!rng.chance(Math.min(0.3, 0.04 + 0.01 * singles.length))) return null;
  rng.shuffle(singles);
  for (const a of singles) {
    const b = singles.find((q) => q !== a && q.household !== a.household && !related(L, a, q) && ((a.friends || []).includes(q.idx) || rng.chance(0.25)));
    if (!b) continue;
    sim.events.wedding(L, a, b, day);
    return [a, b];
  }
  return null;
}

// Children grow up: one of them takes up a trade the town is short of.
export function comingOfAge(sim, L, day) {
  const s = L.settlement;
  if (s.deserted) return null;
  const people = residents(L);
  for (const r of people) {
    if (r.age !== 'child') continue;
    const due = birthday(L, r, day) + CHILDHOOD;
    if (day < due) continue;
    const has = (j) => people.some((q) => q.job === j);
    const trades = ['farmer', 'builder', 'fisher', 'trapper', 'lumberjack', 'miner', 'laborer'].filter((j) => L.hasWorkplaceFor(j));
    // A trade the town lacks, or the family trade (as an apprentice), or
    // whatever work there is in the fields.
    const family = r.parents.map((i) => L.npcs[i]).filter((p) => p && alive(p)).map((p) => p.job)
      .filter((j) => !['mayor', 'guard', 'noble', 'retired', 'merchant', 'child', 'beggar', 'priest'].includes(j) && L.hasWorkplaceFor(j));
    const pickHash = hash4(s.seed, r.idx, 0x7ade) % 10;
    const job = trades.find((j) => !has(j)) || (L.econ.hands && L.hasWorkplaceFor(L.econ.hands) ? L.econ.hands : null)
      || (family.length && pickHash < 7 ? family[pickHash % family.length] : null)
      || (['farmer', 'lumberjack', 'fisher', 'laborer'].filter((j) => L.hasWorkplaceFor(j))[pickHash % 4] ?? null) || 'laborer';
    growUp(L, r, job, new RNG(hash4(r.idx, day, 0x9a0)));
    syncEnt(r, 'child');
    ledger(L, day, `${r.name.first} ${r.name.last} has come of age and started work as a ${job}.`);
    return r;
  }
  return null;
}

// Everyone gets older (much faster than they would in the real world).
// Records made before anyone kept count get a birthday that fits their
// age: children part-way through childhood, grown-ups part-way through
// their working years, elders already some while old. Grown-ups whose
// years are up grow old (the hard trades are given up); old age itself is
// what carries elders off in the end (see mortality in econ.js).
export function birthday(L, r, day) {
  const s = L.settlement;
  const hh = hash4(s.seed, r.idx, 0xa9e);
  // Some have longer working lives than others.
  r.span ??= Math.round(ADULTHOOD * (0.75 + (hash4(s.seed, r.idx, 0x5ba) % 1000) / 2000));
  if (r.born === undefined) {
    r.born = r.age === 'child' ? day - (hh % CHILDHOOD) : r.age === 'adult' ? day - CHILDHOOD - (hh % r.span) : day - CHILDHOOD - r.span - (hh % 16);
  }
  if (r.age === 'elder' && r.elderSince === undefined) r.elderSince = Math.min(day, r.born + CHILDHOOD + r.span);
  return r.born;
}

export function aging(sim, L, day) {
  const out = [];
  for (const r of residents(L)) {
    birthday(L, r, day);
    if (r.age !== 'adult' || day < r.born + CHILDHOOD + r.span) continue;
    // Not while away, or out with you as an escort (they'll feel it later).
    if (r.hired || (r.ent && r.ent.hired) || r.visit || (r.trip && r.trip.phase !== 'home')) continue;
    const old = r.job;
    const retired = growOld(L, r, new RNG(hash4(r.idx, day, 0x01d)));
    r.elderSince = day;
    syncEnt(r, 'adult');
    ledger(L, day, retired ? `${r.name.first} ${r.name.last} is getting on in years and has given up work as a ${old}.` : `${r.name.first} ${r.name.last} is getting on in years, but still works as a ${old}.`);
    out.push(r);
  }
  return out;
}

const BEASTS = { forest: 'wolves', taiga: 'wolves', tundra: 'wolves', mountain: 'wolves', jungle: 'a jaguar', swamp: 'boars', savanna: 'a lion', desert: 'jackals', plains: 'wolves' };

// Now and then beasts come to the edge of town at night. The watch drives
// them off; a town with no guards pays for it. (In a town you're in, the
// beasts are real and you'll see them.)
export function raids(sim, L, day, rng) {
  const s = L.settlement;
  if (s.deserted || sim.game.active.has(s.id)) return null;
  if (!rng.chance(['forest', 'taiga', 'jungle', 'mountain', 'swamp'].includes(s.biome) ? 0.05 : 0.03)) return null;
  const beast = BEASTS[s.biome] || 'wolves';
  const people = residents(L);
  if (!people.length) return null;
  const guards = people.filter((r) => r.job === 'guard' && r.age === 'adult');
  const e = L.econ;
  if (guards.length && (guards.length >= 2 || rng.chance(0.6))) {
    const g = rng.pick(guards);
    if (rng.chance(0.3)) g.hp = Math.max(4, (g.hp ?? 24) - rng.int(4, 10));
    ledger(L, day, `${beast[0].toUpperCase()}${beast.slice(1)} came to the edge of town in the night; ${g.name.first} ${g.name.last} and the watch drove ${beast.startsWith('a ') ? 'it' : 'them'} off.`);
    return { driven: true };
  }
  e.recent.violence = (e.recent.violence || 0) + 1;
  e.recent.raids = (e.recent.raids || 0) + 1;
  const victim = rng.chance(0.25) ? rng.pick(people.filter((r) => r.age !== 'child')) : null;
  if (victim && rng.chance(0.4)) {
    sim.recordDeath(L, victim, `an attack by ${beast}`, null, day);
    return { death: victim };
  }
  if (victim) victim.hp = Math.max(2, (victim.hp ?? 12) - 6);
  ledger(L, day, `${beast[0].toUpperCase()}${beast.slice(1)} raided the outskirts in the night${victim ? ` and mauled ${victim.name.first} ${victim.name.last}` : ''}. There was no watch to stop ${beast.startsWith('a ') ? 'it' : 'them'}.`);
  return { raided: true };
}
