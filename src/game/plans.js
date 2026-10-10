// (Round 78) Blueprints. A blank one (drawn up at a workbench from paper
// and ink), held in the off hand, makes whatever blocks you set down not
// real: each goes onto the plan instead, a see-through block where it'd
// stand. The plan's kept in the blueprint (`plans~<n>`: what's on it kept
// with the world, game.plans), to be folded up and laid out again
// elsewhere, turned, cleared, named; or filled by copying what's already
// built (a box dragged out round it, its sides pulled out or in, and all
// that's in it taken onto the plan). Shown to a town's builder, it's
// priced (by the block, the rarer the dearer, and some they simply can't
// get) and, paid for, put in their queue: they build it, a block at a
// time, where it's laid out. See ui/plans.js and render/planfx.js.
import { ITEMS, itemForBlock } from '../world/items.js';
import { B, BLOCKS } from '../world/blocks.js';

export const PLAN_PREFIX = 'plans~';
export const MAX_CELLS = 4000;
// The builders' reach from their town (paces past its edge).
const BUILD_REACH = 80;

export const isPlanKey = (k) => typeof k === 'string' && k.startsWith(PLAN_PREFIX);
export const isBlueprint = (k) => k === 'blueprint' || isPlanKey(k);

function store(game) {
  return (game.plans ||= new Map());
}

// The plan a blueprint holds (null for a blank one).
export function planOf(game, key) {
  if (!isPlanKey(key)) return null;
  return store(game).get(+key.slice(PLAN_PREFIX.length)) || null;
}

function newPlan(game, name = null) {
  const S = store(game);
  game.planSeq = Math.max(game.planSeq || 0, ...[...S.keys(), 0]) + 1;
  const id = game.planSeq;
  const plan = { id, name: name || `Plan ${id}`, cells: [], at: null, ver: 1 };
  S.set(id, plan);
  return plan;
}

// The blueprint you're drawing on: the one in your off hand (a blank one
// made a plan of its own the first time it's drawn on).
export function draftOf(game, p, make = false) {
  const k = p && p.equip && p.equip.shield;
  if (!isBlueprint(k)) return null;
  if (k === 'blueprint') {
    if (!make) return { blank: true };
    const plan = newPlan(game);
    p.equip.shield = `${PLAN_PREFIX}${plan.id}`;
    return plan;
  }
  return planOf(game, k);
}

// Is there a planned block at (x, y, z) (on any plan laid out)? The plan
// and the cell's index, or null.
export function ghostAt(game, x, y, z) {
  for (const plan of store(game).values()) {
    if (!plan.at) continue;
    const i = plan.cells.findIndex((c) => plan.at.x + c[0] === x && plan.at.y + c[1] === y && plan.at.z + c[2] === z);
    if (i >= 0) return { plan, i };
  }
  return null;
}

// Why a planned block can't go at (x, y, z), or null.
export function ghostProblem(game, x, y, z) {
  const w = game.world;
  const cur = BLOCKS[w.getBlock(x, y, z)];
  if (!(cur && (cur.replaceable || cur.id === B.air))) return 'something is there';
  if (ghostAt(game, x, y, z)) return 'already on the plan';
  return null;
}

// A block set down with a blueprint in your off hand: onto the plan.
export function placeGhost(game, p, t, id, rot = 0) {
  const plan = draftOf(game, p, true);
  if (!plan || plan.blank) return false;
  if (plan.cells.length >= MAX_CELLS) {
    game.ui.msg('That blueprint is full: no more will fit on it.', '#ffb080', true);
    return false;
  }
  if (!plan.at) plan.at = { x: t.x, y: t.y, z: t.z };
  if (ghostProblem(game, t.x, t.y, t.z)) return false;
  plan.cells.push([t.x - plan.at.x, t.y - plan.at.y, t.z - plan.at.z, id, rot & 3]);
  plan.ver++;
  game.audio?.play('select');
  return true;
}

export function removeGhost(game, x, y, z) {
  const g = ghostAt(game, x, y, z);
  if (!g) return false;
  g.plan.cells.splice(g.i, 1);
  g.plan.ver++;
  game.audio?.play('select');
  return true;
}

// Laid out with its first corner at `at` (to be built on, or by), or
// folded up (null).
export function layOut(plan, at) {
  plan.at = at ? { x: at.x, y: at.y, z: at.z } : null;
  plan.ver++;
}

// Turned a quarter round (about its first corner).
export function turnPlan(plan) {
  for (const c of plan.cells) {
    const [dx, , dz] = c;
    c[0] = -dz;
    c[2] = dx;
    if (BLOCKS[c[3]] && BLOCKS[c[3]].rotatable) c[4] = (c[4] + 1) & 3;
  }
  plan.ver++;
}

export function clearPlan(plan) {
  plan.cells = [];
  plan.ver++;
}

// ------------------------------------------------------------ copying
// The box: its corners, in the world (inclusive). Everything inside that
// isn't air (nor water, nor anything growing wild) taken onto the plan,
// measured from the box's low corner; the plan laid away (folded up).
export function copyBox(game, plan, box) {
  const w = game.world;
  const x0 = Math.min(box.x0, box.x1);
  const x1 = Math.max(box.x0, box.x1);
  const y0 = Math.min(box.y0, box.y1);
  const y1 = Math.max(box.y0, box.y1);
  const z0 = Math.min(box.z0, box.z1);
  const z1 = Math.max(box.z0, box.z1);
  const cells = [];
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const id = w.getBlock(x, y, z);
        const b = BLOCKS[id];
        if (!b || id === B.air || b.liquid || b.render === 'plant' || b.name === 'door_top' || b.name === 'placed_item') continue;
        cells.push([x - x0, y - y0, z - z0, id, w.getMeta(x, y, z) & 7]);
        if (cells.length >= MAX_CELLS) break;
      }
    }
  }
  plan.cells = cells;
  plan.at = null;
  plan.ver++;
  return cells.length;
}

// ------------------------------------------------------------ the builders
// What the builders can't get, whatever's paid: what no one can make or
// dig (the old places' own works, the storm wall's, a mod's), liquids,
// and whatever has no block of its own to carry.
export function obtainable(id) {
  const b = BLOCKS[id];
  if (!b || b.mod || b.liquid || !Number.isFinite(b.hardness)) return false;
  if (/^(kav_|ancient|evolved|rift|void|portal|spire|starfall|boss|altar|bedrock|barrier|storm)/.test(b.name)) return false;
  const it = itemForBlock(id);
  return !!(it && ITEMS[it]);
}

// What a block costs the builders to get and set: a couple of coins, and
// more the rarer it is (its worth).
export function blockPrice(id) {
  const it = itemForBlock(id);
  const v = it && ITEMS[it] ? ITEMS[it].value || 1 : 1;
  return Math.max(2, Math.round(2 + v * 1.4 + (v > 20 ? v * 0.6 : 0)));
}

// A builder's word on a plan: { total, n, missing: [names], byBlock, ok,
// why }.
export function quote(game, plan, s) {
  const byBlock = new Map();
  const missing = new Set();
  let total = 0;
  for (const c of plan.cells) {
    const id = c[3];
    if (!obtainable(id)) {
      missing.add(BLOCKS[id] ? BLOCKS[id].label || BLOCKS[id].name : '?');
      continue;
    }
    byBlock.set(id, (byBlock.get(id) || 0) + 1);
    total += blockPrice(id);
  }
  // (Their wages on top: a little for each block, and the work itself.)
  total = Math.round(total + plan.cells.length * 0.5 + 20);
  let why = null;
  if (!plan.cells.length) why = 'There\'s nothing on it to build.';
  else if (!plan.at) why = 'Lay it out where you want it first, so we can see where it goes.';
  else if (s && s.bounds) {
    const b = s.bounds;
    const far = Math.max(b.x0 - plan.at.x, plan.at.x - b.x1, b.z0 - plan.at.z, plan.at.z - b.z1);
    if (far > BUILD_REACH) why = `That's too far from ${s.name} for us to go and build.`;
  }
  if (!why && missing.size) why = `We can't get hold of ${[...missing].slice(0, 3).join(', ')}${missing.size > 3 ? ' and more' : ''}, not for any money.`;
  return { total, n: plan.cells.length, missing: [...missing], byBlock, ok: !why, why };
}

// Paid for: into the town's builders' queue (see sim/works.js: a block at
// a time, in order, where it's laid out).
export function commission(game, plan, L, label = null) {
  const at = plan.at;
  if (!at || !L) return null;
  const blocks = plan.cells.filter((c) => obtainable(c[3])).map(([dx, dy, dz, id, meta]) => [at.x + dx, at.y + dy, at.z + dz, id, meta || 0]);
  // (Bottom up, so walls stand on what's under them.)
  blocks.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  const xs = blocks.map((q) => q[0]);
  const zs = blocks.map((q) => q[2]);
  const p = game.sim.works.add({ sid: L.settlement.id, kind: 'plans', blocks, bounds: { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) }, label: label || `${game.playerName}'s ${plan.name}`, plan: plan.id, forPlayer: true });
  return p;
}

// (Saved with the world.)
export function plansSave(game) {
  return game.plans ? { seq: game.planSeq || 0, list: [...game.plans.values()] } : null;
}
export function plansLoad(game, d) {
  game.plans = new Map();
  game.planSeq = (d && d.seq) || 0;
  for (const p of (d && d.list) || []) game.plans.set(p.id, { ...p, ver: (p.ver || 0) + 1 });
}
