// (Round 110) What works in the Athanor beside its homunculi, golems and
// imps (laid out by world/deeps/athanor.js, drawn in
// render/art/athanor_mobs.js; the speculum, the table, the great furnace,
// the vats and the quicksilver are game/athanorwork.js's), each made to
// work with the others:
//   the adept: one of the Work's own, still at it after a thousand
//     years, robed and hooded, a flask at the belt. It keeps its
//     distance and calls quicksilver up out of the floor under you: it
//     drags at your feet and chills you, and the homunculi are mended
//     standing in it. (But an imp's fire on it turns it to a choking fume
//     that takes anyone in it, the adepts too.)
//   the leaden sentinel: a statue of lead, slow and heavy and hard to
//     hurt. Beaten to half, it gilds: its lead goes to gold, and it's
//     quicker and hits the harder for it (and there's gold to be had off
//     it when it falls).
//   the vat-tender: a stooped thing in a leather apron and glass goggles
//     that never fights, going among the vats; but it mends whatever of
//     the Work is hurt near it, your enemies too. Kill it and every vat in
//     its hall breaks, and what's in them climbs out.
// And the old ones made to work with these: the homunculi go to the
// quicksilver when they're hurt; the imps go for the athanor's fire.
import { BRAINS } from './monsters.js';
import { ANCIENT_SPECIES } from './ancientmobs.js';
import { FY } from '../world/dungeongen.js';
import { findPath } from './pathfind.js';
import { runOf, anT, quicken, onQuick, tenderDies, WORK } from '../game/athanorwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);
const SILVER = ['#e8e8f0', '#a8a8b8', '#ffffff'];
const GOLD = ['#ffe070', '#ffb030', '#fff8d0'];

// Half-beaten, a sentinel gilds.
function gild(game, c) {
  c.gilded = true;
  c.altLook = 'gilt';
  c.hasteT = 9999;
  c.dmgMult = (c.dmgMult || 1) * 1.4;
  c.carries ||= 'gold_ingot';
  game.renderer.emit(c.x, c.y + 1.2, c.z, { n: 30, color: GOLD, up: 24, speed: 24, life: 1, glow: true });
  game.renderer.floatText(c.x, c.y + 2.6, c.z, 'its lead turns to gold!', '#ffe070');
  game.audio?.play('chime', c);
  const run = runAt(c);
  if (run && !anT(run).told.gild) {
    anT(run).told.gild = true;
    game.ui.msg('The sentinel\'s lead goes bright and soft and yellow from the wound outward: gold. It comes on quicker for it, and hits the harder. (There\'ll be gold off it, when it falls.)', '#ffe070', true);
  }
}

export const ATHANOR_SPECIES = {
  adept: {
    name: 'Adept', hp: 16, dmg: 3, step: 0.36, mode: 'hostile', aggro: 11, under: true, ancient: true, brain: 'adept', isle: 'velmarch', light: 3,
    drops: [['old_coin', 1, 3, 0.6], ['sulfur', 1, 2, 0.35], ['glass', 1, 1, 0.3], ['gold_ingot', 1, 1, 0.05]],
  },
  leaden_sentinel: {
    name: 'Leaden Sentinel', hp: 44, dmg: 6, step: 0.62, mode: 'hostile', aggro: 8, under: true, ancient: true, construct: true, armoured: true, style: 'slam', isle: 'velmarch',
    drops: [['lead', 1, 3, 0.8], ['old_coin', 1, 3, 0.4]],
    ward(game, c, src, amt) {
      if (!c.gilded && c.hp - amt <= c.maxHp / 2 && c.hp - amt > 0) gild(game, c);
      return amt;
    },
  },
  vat_tender: {
    name: 'Vat-Tender', hp: 14, dmg: 0, step: 0.4, mode: 'passive', aggro: 0, under: true, ancient: true, calm: 'vatTender', isle: 'velmarch',
    drops: [['glass', 1, 2, 0.7], ['gem', 1, 1, 0.12], ['old_coin', 1, 2, 0.5]],
    onDeath(game, c) {
      const run = runAt(c);
      if (run) tenderDies(run, c);
    },
  },
  // (The old ones, with somewhere to go: see ancientmobs.js.)
  quicksilver_homunculus: { ...ANCIENT_SPECIES.quicksilver_homunculus, brain: 'homunculus' },
  sulphur_imp: { ...ANCIENT_SPECIES.sulphur_imp, brain: 'sulphurImp' },
};

// A step toward (or along a path to) a spot.
function walkTo(c, goal) {
  if (c.moving) return true;
  const game = c.game;
  if (!c.wpath || c.wi >= c.wpath.length || c.wgoal !== goal) {
    c.wpath = findPath(game.world, c.x, c.y, c.z, goal.x, FY, goal.z, { maxNodes: 1500, near: 1, partial: true, blocked: (x, z) => game.occupiedBySolid(x, c.y, z, c) });
    c.wi = 0;
    c.wgoal = goal;
    if (!c.wpath || !c.wpath.length) return false;
  }
  const [nx, , nz] = c.wpath[c.wi];
  if (c.tryStep(nx, nz, c.S.step)) {
    c.wi++;
    return true;
  }
  c.wpath = null;
  return false;
}
// Away from `t`, if there's a way.
function backOff(c, t) {
  const sx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
  const sz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
  for (const [ox, oz] of [[sx, 0], [0, sz], [sx, sz], [sz, sx], [-sz, -sx]]) if (c.tryStep(c.x + ox, c.z + oz, c.S.step)) return true;
  return false;
}

export const ATHANOR_BRAINS = {
  // At a distance, calling quicksilver up under you.
  adept(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    const run = runAt(c);
    if (c.chant) {
      c.chant.t -= dt;
      c.face(t.x, t.z);
      if (Math.random() < dt * 20) {
        const q = c.chant.tiles[Math.floor(Math.random() * c.chant.tiles.length)];
        game.renderer.emit(q.x, FY + 0.1, q.z, { n: 1, color: SILVER, up: 6, speed: 4, life: 0.5, glow: true });
      }
      if (c.chant.t <= 0) {
        if (run) quicken(run, c.chant.tiles, c);
        c.chant = null;
        c.castCd = 6 + Math.random() * 2.5;
      }
      return true;
    }
    if (c.moving) return true;
    c.castCd = (c.castCd ?? 1.5 + Math.random() * 2) - dt;
    const d = dist(c, t);
    if (c.castCd <= 0 && d >= 2 && d <= 7 && run) {
      const tiles = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], ...(run.floor >= 1 ? [[1, 1], [-1, -1], [1, -1], [-1, 1]] : [])].map(([ox, oz]) => ({ x: t.x + ox, z: t.z + oz }));
      c.chant = { t: 0.9, tiles };
      game.renderer.floatText(c.x, c.y + 2.2, c.z, 'the adept chants', '#d8d8e8');
      return true;
    }
    if (d <= 1) return backOff(c, t);
    if (d <= 2) {
      backOff(c, t);
      return true;
    }
    if (d > 7) return false;
    if (Math.random() < dt * 1.2) c.tryStep(c.x + Math.round(Math.random() * 2 - 1), c.z + Math.round(Math.random() * 2 - 1), c.S.step);
    return true;
  },

  // Among the vats, mending whatever of the Work is hurt near it.
  vatTender(c, dt) {
    if (c.fleeT > 0) return false;
    const run = runAt(c);
    if (!run) return false;
    if (c.moving) return true;
    // (To whatever of the Work is hurt, first.)
    let hurt = null;
    for (const o of run.creatures()) {
      if (o.dead || o === c || !WORK.has(o.species) || o.hp >= o.maxHp || dist(o, c) > 8) continue;
      if (!hurt || dist(o, c) < dist(hurt, c)) hurt = o;
    }
    if (hurt) {
      if (dist(hurt, c) > 2) walkTo(c, { x: hurt.x, z: hurt.z });
      return true;
    }
    // (From vat to vat, peering in.)
    c.peerT = (c.peerT ?? 0) - dt;
    if (c.peerT > 0) return true;
    const vats = (run.data.vats || []).flatMap((g) => g.vats).filter((q) => dist(q, c) <= 10);
    if (!vats.length) return true;
    if (!c.vatGoal || dist(c, c.vatGoal) <= 1) {
      c.vatGoal = vats[Math.floor(Math.random() * vats.length)];
      c.peerT = 1.5 + Math.random() * 2;
      c.face(c.vatGoal.x, c.vatGoal.z);
      return true;
    }
    if (!walkTo(c, c.vatGoal)) c.vatGoal = null;
    return true;
  },

  // Hurt, off to the quicksilver to mend.
  homunculus(c) {
    if (c.moving) return true;
    const run = runAt(c);
    if (!run || c.hp >= c.maxHp * 0.5 || onQuick(run, c)) return false;
    const pools = [];
    for (const z of c.game.zones || []) if (z.kind === 'quick' && !z.done) for (const t of z.tiles) if (dist(t, c) <= 5) pools.push(t);
    if (!pools.length) return false;
    pools.sort((a, b) => dist(a, c) - dist(b, c));
    const goal = pools[0];
    const sx = Math.sign(goal.x - c.x);
    const sz = Math.sign(goal.z - c.z);
    return (sx && c.tryStep(c.x + sx, c.z, c.S.step)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step)) || false;
  },

  // Called by the athanor's fire: to it, to eat it, unless you're on it.
  sulphurImp(c) {
    const q = c.toFire;
    if (!q || c.moving) return !!c.moving;
    const run = runAt(c);
    if (!run || !anT(run).fires.has(`${q.x},${q.z}`)) {
      c.toFire = null;
      return false;
    }
    const t = c.target;
    if (t && !t.dead && dist(t, c) <= 1) return false;
    if (dist(c, q) <= 1) return true;
    return walkTo(c, { x: q.x, z: q.z });
  },
};
Object.assign(BRAINS, ATHANOR_BRAINS);
// (Of the ancient places' own, as the old ones are: see ancientmobs.js.)
for (const k of ['adept', 'leaden_sentinel', 'vat_tender']) ANCIENT_SPECIES[k] = ATHANOR_SPECIES[k];
