// (Round 80) Towns laid out off the game's own thread. A town's plan (its
// roads, every lot tried for every building, the blocks of each, its
// people) can take a good part of a second for a city; laid out on the
// game's thread, a few milliseconds a frame, one step of it (trying every
// lot for one building) could still run long past that. So in the
// background a town is laid out in a worker (layworker.js), which has the
// world as its seed makes it, brought up to how it is now (the
// settlements as they are, a lava flow, the storm wall): the same town as
// would be laid out here, sent back finished and taken in at once (see
// World.layOut and settlement.adoptLayout).
//
// A town wanted now (someone walking into it) is still laid out here, as
// ever; and with mods in play, all of them are (a mod's blocks, biomes and
// rules are the game's, not the worker's).
import { layoutJob } from './settlement.js';
import { REGION_W, REGION_D } from '../config.js';

// What of a layout isn't sent back: the world and settlement (this side
// has its own), its dice (thrown again as far: see adoptLayout), and the
// ground under it, worked out again as it's looked at.
const SKIP = new Set(['world', 'settlement', 'rng', 'ctx', 'cols', 'outCols', 'local', 'sums']);

// What's sent of the world with each town to lay out: the settlements as
// they are now (grown, founded since, spread out), and what else of the
// land can change (a lava flow, the storm wall).
export function worldState(world) {
  const ow = world.ow;
  return {
    setts: ow.settlements.map((s) => ({ ...s, layout: null })),
    flows: ow.volcano ? ow.volcano.flows : null,
    wallDown: !!ow.wallDown,
    today: ow.today ?? null,
  };
}

// Bring `world` (the worker's) up to `st` (the game's, as worldState sent
// it). The settlement `sid` of it, to lay out.
export function syncWorld(world, st) {
  const ow = world.ow;
  for (const c of st.setts) {
    const civ = c.civ && ow.civs ? ow.civs.find((q) => q && q.id === c.civ.id) : null;
    if (civ) Object.assign(civ, c.civ);
    let s = ow.settlements[c.id];
    const fresh = !s;
    const moved = s && (JSON.stringify(s.bounds) !== JSON.stringify(c.bounds) || JSON.stringify(s.suburbs || null) !== JSON.stringify(c.suburbs || null));
    if (fresh) s = ow.settlements[c.id] = {};
    for (const k of Object.keys(s)) if (!(k in c)) delete s[k];
    Object.assign(s, c, { civ: civ || c.civ || null });
    if (fresh || moved) register(ow, s);
  }
  if (ow.volcano) ow.volcano.flows = st.flows || [];
  ow.wallDown = st.wallDown;
  if (st.today !== null) ow.today = st.today;
}

// A settlement on the map's squares (as founding.register puts one).
function register(ow, s) {
  for (let cz = s.cz; cz < s.cz + s.cd; cz++) {
    for (let cx = s.cx; cx < s.cx + s.cw; cx++) {
      const cell = ow.cell(cx, cz);
      if (cell) {
        cell.settlement = s.id;
        cell.civ = s.civ ? s.civ.id : cell.civ;
      }
    }
  }
  const b = s.bounds;
  const m = 14;
  for (let cz = Math.floor((b.z0 - m) / REGION_D); cz <= Math.floor((b.z1 + m) / REGION_D); cz++) {
    for (let cx = Math.floor((b.x0 - m) / REGION_W); cx <= Math.floor((b.x1 + m) / REGION_W); cx++) {
      const cell = ow.cell(cx, cz);
      if (cell && !cell.near.includes(s.id)) cell.near.push(s.id);
    }
  }
}

// Lay out settlement `s` of `world` here and now, whole: what goes back
// (`data`, for adoptLayout), what of it can be handed over rather than
// copied (`transfer`), and what laying it out changed of the settlement
// itself (`delta`: whether it's near the mountains, the lots it spread
// onto past its bounds).
export function layHere(world, s) {
  const before = {};
  for (const k of Object.keys(s)) if (k !== 'civ' && k !== 'layout') before[k] = JSON.stringify(s[k]);
  // (Laid out as it was founded: how it's grown since is put back on top.
  // See World.layOut.)
  const now = s.type;
  if (s.baseType) s.type = s.baseType;
  let L;
  let draws = 0;
  try {
    const job = layoutJob(world, s);
    const rng = job.L.rng;
    const next = rng._next;
    rng._next = () => {
      draws++;
      return next();
    };
    while (!job.steps.next().done);
    rng._next = next;
    L = job.L;
  } finally {
    s.type = now;
  }
  const delta = {};
  for (const k of Object.keys(s)) if (k !== 'civ' && k !== 'layout' && JSON.stringify(s[k]) !== before[k]) delta[k] = s[k];
  const data = { rngDraws: draws };
  for (const k of Object.keys(L)) if (!SKIP.has(k)) data[k] = L[k];
  return { data, transfer: [L.mask.buffer], delta };
}

// ------------------------------------------------------------ the worker
// One for the page, kept for every world after (it makes each world from
// its seed once, and keeps the last).
let worker = null;
let broken = false;
let nextJob = 1;
const jobs = new Map();

function theWorker() {
  if (worker || broken) return worker;
  if (typeof window === 'undefined' || typeof window.Worker === 'undefined') {
    broken = true;
    return null;
  }
  try {
    worker = new window.Worker(new URL('./layworker.js', import.meta.url), { type: 'module' });
  } catch {
    broken = true;
    return null;
  }
  worker.onmessage = (e) => {
    const m = e.data;
    const job = m && jobs.get(m.job);
    if (!job) return;
    jobs.delete(m.job);
    job.done(m);
  };
  // (Something gone wrong over there: every town's laid out here again,
  // as it always was.)
  worker.onerror = () => {
    broken = true;
    for (const job of jobs.values()) job.done({ t: 'failed' });
    jobs.clear();
  };
  return worker;
}

// For `world`: the town of settlement `s` laid out on the worker, if it
// can be. 'wait' while it's being laid out; its data once it's back (for
// adoptLayout, once); null if it can't be (no worker, a mod in play, it
// failed there): lay it out here.
export function layAway(world, s) {
  const st = (world.layAway ||= { done: new Map(), busy: new Set(), failed: new Set() });
  const got = st.done.get(s.id);
  if (got) {
    st.done.delete(s.id);
    return got;
  }
  if (st.failed.has(s.id)) return null;
  if (st.busy.has(s.id)) return 'wait';
  const w = theWorker();
  if (!w) return null;
  const id = nextJob++;
  st.busy.add(s.id);
  jobs.set(id, {
    done: (m) => {
      st.busy.delete(s.id);
      if (m.t !== 'laid') {
        st.failed.add(s.id);
        if (m.why) console.warn(`Town ${s.name} couldn't be laid out off the game's thread; laying it out here.`, m.why);
        return;
      }
      // (Laid out here meanwhile, wanted at once: this one's not needed.)
      if (world.layouts.has(s.id)) return;
      st.done.set(s.id, m);
    },
  });
  try {
    w.postMessage({ t: 'lay', job: id, seed: world.seed, wg: world.ow.wg || 1, sid: s.id, state: worldState(world) });
  } catch {
    // (Something of the world that can't be sent: here, then.)
    jobs.delete(id);
    st.busy.delete(s.id);
    st.failed.add(s.id);
    return null;
  }
  return 'wait';
}
