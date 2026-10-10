// (Round 80) The town builder's own thread (see laywork.js): the world as
// its seed makes it (made once, kept for the next town), brought up to how
// the game has it now, and the town laid out whole and sent back.
import { World } from './world.js';
import { syncWorld, layHere } from './laywork.js';

let world = null;
let key = null;
// (The worker's own global.)
const me = globalThis;

me.onmessage = (e) => {
  const m = e.data;
  if (!m || m.t !== 'lay') return;
  try {
    const k = `${m.seed}|${m.wg}`;
    if (key !== k) {
      world = new World(m.seed, { wg: m.wg });
      key = k;
    }
    syncWorld(world, m.state);
    const s = world.ow.settlements[m.sid];
    const { data, transfer, delta } = layHere(world, s);
    me.postMessage({ t: 'laid', job: m.job, sid: m.sid, data, delta }, transfer);
  } catch (err) {
    me.postMessage({ t: 'failed', job: m.job, sid: m.sid, why: String((err && err.stack) || err) });
  }
};
