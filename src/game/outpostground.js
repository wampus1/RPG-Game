// (Round 145) The outposts on the ground, near you (see sim/outposts.js).
//   - A watchtower: four log posts carrying a plank platform with a rail
//     round it, a ladder up the back; one of the garrison up top looking
//     out, the rest by the fire and the tent at its foot; the realm's
//     banner on the platform.
//   - A stockade: a square of log walls, its gate toward the enemy (where
//     it's to be held), stakes out in front either side of the way in;
//     tents and a fire inside, the garrison at the gate and the walls.
// Put up when you first come near one (and left standing); taken down,
// in smoke, when it's burned.
import { B } from '../world/blocks.js';
import { GROUND } from '../config.js';
import { garrisonRecs } from '../sim/outposts.js';

const LADDER_META = (dx, dz) => (dz === 1 ? 0 : dx === -1 ? 1 : dz === -1 ? 2 : 3);
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

export class OutpostGround {
  constructor(war) {
    this.war = war;
    this.t = 0;
    this.posts = new Map(); // outpost id -> its posts (where the garrison stand)
    this.tried = new Map(); // outpost id -> when it was last tried
    this.near = new Set(); // outposts you were near, last look
  }

  get game() {
    return this.war.game;
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    const war = this.war;
    for (const O of war.outposts || []) {
      if (O.state === 'burned' || O.state === 'gone') {
        if (O.placed && O.placed.length) this.raze(O);
        this.dismiss(O, true);
        continue;
      }
      if (!war.nearPlayer(O, 64)) {
        this.near.delete(O.id);
        this.dismiss(O);
        continue;
      }
      // (Come on it all at once, over the hill or out of a coach: its
      // garrison's there already.)
      const fresh = !this.near.has(O.id);
      this.near.add(O.id);
      if (!O.placed || !O.placed.length) {
        const now = war.sim.abs;
        if ((this.tried.get(O.id) ?? -99) > now - 10) continue;
        this.tried.set(O.id, now);
        this.build(O);
      }
      if (O.state === 'manned') this.man(O, fresh);
      else this.dismiss(O);
    }
  }

  // Its frame: `f` the way it faces (toward the enemy), `p` across.
  frame(O) {
    const fx = Math.abs(O.face.x) >= Math.abs(O.face.z) ? Math.sign(O.face.x) || 1 : 0;
    const fz = fx ? 0 : Math.sign(O.face.z) || 1;
    return { f: { x: fx, z: fz }, p: { x: -fz, z: fx } };
  }

  // The blocks, and the posts, of an outpost (by its kind).
  plan(O) {
    const w = this.game.world;
    const { f, p } = this.frame(O);
    const at = (a, b) => ({ x: Math.round(O.x + f.x * a + p.x * b), z: Math.round(O.z + f.z * a + p.z * b) });
    const y0 = w.regionAt(O.x, O.z) ? w.findStandY(O.x, O.z, GROUND) : -1;
    if (y0 <= 0) return null;
    const ground = (q) => {
      if (!w.regionAt(q.x, q.z)) return -1;
      const y = w.findStandY(q.x, q.z, y0);
      return y > 0 && Math.abs(y - y0) <= 2 ? y : -1;
    };
    const ops = [];
    const posts = [];
    const out = at(30, 0);
    if (O.kind === 'tower') {
      // Four posts, four high; the platform on them; a rail round it.
      for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0]]) {
        const q = at(a, b);
        const gy = ground(q);
        if (gy < 0) continue;
        for (let y = gy; y < y0 + 4; y++) ops.push([q.x, y, q.z, B.log_wall, 0]);
      }
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const q = at(a, b);
        ops.push([q.x, y0 + 4, q.z, B.planks, 0]);
        const edge = Math.abs(a) === 1 || Math.abs(b) === 1;
        if (!edge || (a === -1 && b === 0)) continue;
        ops.push([q.x, y0 + 5, q.z, a === 1 && b === 1 && B.festival_banner ? B.festival_banner : B.fence, 0]);
      }
      // The ladder up the back.
      const lq = at(-2, 0);
      const ly = ground(lq);
      if (ly > 0) for (let y = ly; y <= y0 + 5; y++) ops.push([lq.x, y, lq.z, B.ladder, LADDER_META(f.x, f.z)]);
      // At its foot: a fire, a tent.
      const fire = at(-4, 2);
      const tent = at(-4, -2);
      if (ground(fire) > 0) ops.push([fire.x, ground(fire), fire.z, B.campfire, 0]);
      if (ground(tent) > 0) ops.push([tent.x, ground(tent), tent.z, B.tent, 0]);
      posts.push({ x: at(0, 0).x, y: y0 + 5, z: at(0, 0).z, out, up: true });
      for (const [a, b] of [[-3, 1], [-3, -1], [-5, 0]]) {
        const q = at(a, b);
        const gy = ground(q);
        if (gy > 0) posts.push({ x: q.x, y: gy, z: q.z, out });
      }
    } else {
      // A square of log walls, its gate toward the enemy; stakes out in
      // front, either side of the way in.
      for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== 4 || (a === 4 && b === 0)) continue;
        const q = at(a, b);
        const gy = ground(q);
        if (gy < 0) continue;
        ops.push([q.x, gy, q.z, B.log_wall, 0], [q.x, gy + 1, q.z, B.log_wall, 0]);
      }
      for (const b of [-6, -4, -2, 2, 4, 6]) {
        const q = at(6 + (Math.abs(b) % 4 === 2 ? 1 : 0), b);
        const gy = ground(q);
        if (gy > 0) ops.push([q.x, gy, q.z, B.fence, 0]);
      }
      for (const [a, b, id] of [[-2, -2, B.tent], [-2, 2, B.tent], [-1, 0, B.campfire], [2, 3, B.festival_banner]]) {
        if (!id) continue;
        const q = at(a, b);
        const gy = ground(q);
        if (gy > 0) ops.push([q.x, gy, q.z, id, 0]);
      }
      for (const [a, b] of [[3, 0], [3, -1], [3, 1], [2, -3], [2, 3]]) {
        const q = at(a, b);
        const gy = ground(q);
        if (gy > 0) posts.push({ x: q.x, y: gy, z: q.z, out });
      }
    }
    return { ops, posts };
  }

  // Where, near where it was meant to go, it best stands: on dry, level,
  // open ground (not in the trees, not in the water). Settled the first
  // time it's put up.
  site(O) {
    const g = this.game;
    const w = g.world;
    const rad = O.kind === 'tower' ? 3 : 5;
    const fit = (c) => {
      if (!w.regionAt(c.x, c.z) || g.world.ow.settlementAt(c.x, c.z)) return -999;
      const y0 = w.findStandY(c.x, c.z, GROUND);
      if (y0 <= 0) return -999;
      let sc = 0;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        const x = c.x + dx;
        const z = c.z + dz;
        if (!w.regionAt(x, z)) {
          sc -= 2;
          continue;
        }
        const y = w.findStandY(x, z, y0);
        if (y <= 0 || w.isWaterAt(x, y, z) || w.isWaterAt(x, y - 1, z)) {
          sc -= 3;
          continue;
        }
        if (Math.abs(y - y0) > 1) {
          sc -= 1;
          continue;
        }
        let open = true;
        for (let k = 0; k < 3; k++) if (w.getBlock(x, y + k, z) !== B.air) open = false;
        sc += open ? 1 : -1;
      }
      return sc;
    };
    let best = { c: { x: O.x, z: O.z }, sc: fit(O) };
    const full = (rad * 2 + 1) ** 2;
    for (let r = 2; r <= 12 && best.sc < full * 0.9; r += 2) {
      for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const c = { x: O.x + dx, z: O.z + dz };
        const sc = fit(c);
        if (sc > best.sc) best = { c, sc };
      }
    }
    O.x = best.c.x;
    O.z = best.c.z;
    O.sited = true;
  }

  // Put up (where it isn't standing already).
  build(O) {
    const g = this.game;
    const w = g.world;
    if (!O.sited) this.site(O);
    const P = this.plan(O);
    if (!P) return;
    this.posts.set(O.id, P.posts);
    O.placed ||= [];
    for (const [x, y, z, id, meta = 0] of P.ops) {
      if (!w.regionAt(x, z) || g.world.ow.settlementAt(x, z) || w.getBlock(x, y, z) !== B.air) continue;
      w.setBlock(x, y, z, id, meta);
      O.placed.push([x, y, z, id]);
      if (g.inSight(x, z, 2) && Math.random() < 0.25) g.renderer.emit(x + 0.5, y + 0.4, z + 0.5, { n: 3, color: ['#8a6a3a', '#5a4022'], up: 14, speed: 16, life: 0.35 });
    }
  }

  // Its garrison at their posts (those of them not already about, put
  // there out of your sight; any back from a fight, to their posts again).
  man(O, fresh = false) {
    const war = this.war;
    const g = this.game;
    let posts = this.posts.get(O.id);
    if (!posts) {
      const P = this.plan(O);
      posts = P ? P.posts : [];
      this.posts.set(O.id, posts);
    }
    if (!posts.length) return;
    const fighting = war.live && war.live.kind === 'battle' && !war.live.done;
    const w = war.wars.find((q) => q.id === O.war);
    const side = w ? (w.a.includes(O.civ) ? 'a' : 'b') : 'a';
    garrisonRecs(war, O).forEach(({ r, L }, i) => {
      const post = posts[i % posts.length];
      const e = r.ent;
      if (e && !e.dead) {
        if (fighting && e.warband && e.warband.kind === 'battle') return;
        if (!e.down && (!e.warband || e.warband.kind !== 'outpost')) {
          e.releaseSpot?.();
          e.state = 'warband';
          e.activity = null;
          e.path = null;
          e.warband = { kind: 'outpost', outpost: O.id, side, civ: O.civ, foe: false, post };
          e.hostileNow = false;
        }
        return;
      }
      if ((!fresh && g.inSight(post.x, post.z, 2)) || !g.world.regionAt(post.x, post.z)) return;
      const n = war.spawnAt(r, L, { x: post.x, y: post.y, z: post.z }, side, 'outpost', { outpost: O.id, post, foe: false });
      if (n) n.hostileNow = false;
    });
  }

  // Its garrison out of sight: gone till you come back (or, `all`, the
  // post gone: off home).
  dismiss(O, all = false) {
    const g = this.game;
    for (const n of g.npcs.slice()) {
      if (!n.warband || n.warband.kind !== 'outpost' || n.warband.outpost !== O.id || n.dead) continue;
      if (!g.inSight(n.x, n.z, 2)) g.despawnNpc(n);
      else if (all) n.warband = { ...n.warband, kind: 'battle', phase: 'flee', home: { x: n.x + 30, z: n.z + 30 } };
    }
  }

  // Burned: down, in smoke and sparks.
  raze(O) {
    const g = this.game;
    const war = this.war;
    const ops = [];
    for (const [x, y, z, id] of O.placed || []) {
      if (g.world.regionAt(x, z) && g.world.getBlock(x, y, z) !== id) continue;
      ops.push([x, y, z, B.air, 0]);
      if (g.world.regionAt(x, z) && g.inSight(x, z, 2) && Math.random() < 0.5) g.renderer.emit(x + 0.5, y + 0.5, z + 0.5, { n: 5, color: ['#ff9030', '#ffd060', '#4a4440', '#2a2624'], up: 22, speed: 18, life: 0.9 });
    }
    war.sim.setBlocks(ops);
    O.placed = [];
    this.posts.delete(O.id);
    if (cheb(O, g.player) <= 40) g.audio?.play('thud', { x: O.x, y: GROUND, z: O.z });
  }
}
