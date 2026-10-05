// A great city's Academy (round 54): the building (see Layout.furnishCollege),
// founded in each city that hasn't one, and what's taught there. A term
// runs a few days; each day a class or two, each in its own room at its
// own hour: cookery in the kitchen, swordplay in the practice hall, study
// in the lecture room, gem-setting in the workshop. Whoever's enrolled and
// sits through a class (most of it, in the room) comes out the better for
// it: a rank's worth of practice in it (see game/mastery.js), and
// something of the master's besides. The term itself, its people and what
// happens to them, is a story: see saga/motifs/academy.js.
import { alive, ledger } from './econ.js';
import { RNG, hash4 } from '../util/rng.js';
import { DAY } from './econ.js';

// What's taught, where, by whom, and what it's practice in.
export const SUBJECTS = {
  cooking: { room: 'kitchen', title: 'Cookery', craft: 'cooking', master: 'cook', verb: 'cook', skill: 'cooking', jobs: ['cook', 'baker', 'innkeeper'] },
  dueling: { room: 'yard', title: 'Swordplay', craft: 'dueling', master: 'champion', verb: 'fence', skill: 'fighting', jobs: ['guard'] },
  research: { room: 'lecture', title: 'Natural Philosophy', craft: 'study', master: 'scholar', verb: 'study', skill: 'learning', jobs: ['researcher', 'scholar'] },
  gemcraft: { room: 'gems', title: 'Gem-setting', craft: 'setting', master: 'scholar', verb: 'set stones', skill: 'crafting', jobs: ['glassblower', 'blacksmith', 'tailor'] },
};
export const SUBJECT_KEYS = Object.keys(SUBJECTS);
// A class's hours (from, to) and how much of one you must be there for
// (minutes).
export const SLOTS = [[9 * 60, 11 * 60], [14 * 60, 16 * 60], [18 * 60, 20 * 60]];
export const ATTEND = 60;

export function academyOf(L) {
  return (L && L.buildings.find((b) => b.type === 'college' && !b.underConstruction && b.rooms)) || null;
}

// The room of the Academy at (x, z), if any.
export function roomAt(b, x, z) {
  if (!b || !b.rooms) return null;
  for (const [name, r] of Object.entries(b.rooms)) if (r.tiles.some((t) => t.x === x && t.z === z)) return name;
  return null;
}

// The middle of a room (for a master to stand in, and students about).
export function roomMid(b, name) {
  const r = b && b.rooms && b.rooms[name];
  if (!r || !r.tiles.length) return null;
  const x = r.tiles.reduce((a, t) => a + t.x, 0) / r.tiles.length;
  const z = r.tiles.reduce((a, t) => a + t.z, 0) / r.tiles.length;
  return r.tiles.slice().sort((a, c) => Math.hypot(a.x - x, a.z - z) - Math.hypot(c.x - x, c.z - z))[0];
}

// A city with no Academy gets one: the realm sends the timber and stone,
// and its masons raise it on a lot out at the city's edge (at once). The
// building, or null.
export function foundAcademy(sim, L) {
  const s = L.settlement;
  if (!s || s.type !== 'city' || s.deserted || s.condition === 'abandoned') return null;
  if (L.buildings.some((b) => b.type === 'college')) return null;
  const works = sim.works;
  if (works.projects.some((p) => !p.done && p.sid === s.id && p.type === 'college')) return null;
  // (A city already tried and found no room: not every day.)
  const e = L.econ;
  if (e.noAcademy && sim.today() - e.noAcademy < 10) return null;
  // (As big a lot as there's room for out there, 13 across down to 11.)
  let plot = null;
  for (const [side, reach] of [[13, 18], [13, 30], [12, 30], [11, 30]]) {
    plot = L.fringePlot(false, reach, 0, true, true, side);
    if (plot) break;
  }
  if (!plot) {
    e.noAcademy = sim.today();
    return null;
  }
  plot.type = 'college';
  works.registerPlot(L, plot, true);
  // (The realm's own timber and stone, and its masons: none of the city's,
  // and raised at once.)
  plot.taken = true;
  const bid = L.buildings.length;
  const road = L.roadTo(plot);
  const plan0 = L.typedBlueprint(plot, 'college', bid);
  plan0.bld.underConstruction = true;
  L.buildings.push(plan0.bld);
  L.claimFootprint(plan0.bld);
  const p = { sid: s.id, kind: 'build', bid, plot: plot.id, type: 'college', road, label: `the ${s.name} Academy`, quiet: true };
  const plan = works.withRoad(L, p, plan0);
  p.id = works.next;
  works.plans.set(p.id, plan);
  works.add(p);
  works.finishNow(L, p);
  ledger(L, sim.today(), `The ${s.name} Academy opens its doors to anyone who'd learn: cookery, swordplay, natural philosophy and gem-setting, taught by masters.`);
  return L.buildings[bid] || null;
}

// A term's classes: `n` days from `day0`, a class or two each day, each
// subject taught as often as the others (near enough). [{ day, from, to,
// subject }]
export function termSchedule(rng, day0, n = 4, focus = null) {
  const out = [];
  const subjects = rng.shuffle(SUBJECT_KEYS.slice());
  // (A term with a leaning: its subject comes round more.)
  if (focus) subjects.push(focus);
  let k = 0;
  for (let d = 0; d < n; d++) {
    const slots = rng.shuffle(SLOTS.slice()).slice(0, rng.chance(0.4) ? 1 : 2).sort((a, b) => a[0] - b[0]);
    for (const [from, to] of slots) out.push({ day: day0 + d, from, to, subject: subjects[k++ % subjects.length] });
  }
  return out;
}

// The class going on just now (and its index), if any.
export function classNow(sched, now) {
  const day = Math.floor(now / DAY);
  const m = now % DAY;
  const i = sched.findIndex((c) => c.day === day && m >= c.from && m < c.to);
  return i >= 0 ? { c: sched[i], i } : null;
}

// The next class to come (index), if any.
export function nextClass(sched, now) {
  const day = Math.floor(now / DAY);
  const m = now % DAY;
  return sched.findIndex((c) => c.day > day || (c.day === day && c.to > m));
}

export function clock(m) {
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

// A townsperson taught: the better at it (and more likely to take up the
// trade after).
export function teachRec(rec, subject) {
  const S = SUBJECTS[subject];
  rec.skills ||= {};
  rec.skills[S.skill] = Math.min(1, (rec.skills[S.skill] || 0.2) + 0.06);
  rec.lessons = (rec.lessons || 0) + 1;
}

// Who'd go, of a town's people: the curious, the bookish, the young and
// keen (and those whose family can spare them).
export function keenness(rec) {
  const p = rec.personality || {};
  const t = rec.traits || [];
  return (p.diligence ?? 0.5) * 0.6 + (t.includes('curious') ? 0.3 : 0) + (t.includes('bookish') ? 0.4 : 0) + (t.includes('proud') ? 0.1 : 0) + (rec.age === 'adult' ? 0 : -0.5) + (rec.job === 'laborer' || rec.job === 'farmer' ? 0.05 : 0);
}

export function rngFor(sid, day, salt) {
  return new RNG(hash4(sid | 0, day | 0, salt | 0));
}

export { alive };
