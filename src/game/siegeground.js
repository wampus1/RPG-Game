// (Round 144) A siege on the ground, where you are (see sim/siege.js for the
// siege itself, day by day):
//   - the besiegers' camp outside the town: tents in rows, cookfires, a
//     fence thrown up toward the walls, their engines standing ready, a few
//     of them about the fires and on watch;
//   - the town shut up: its gates barred (nobody lifts the bar, whatever the
//     hour), a timber walk thrown up behind the wall on the side facing the
//     camp, with steps up to it, and the watch posted along it; an unwalled
//     town's streets barricaded where they run out;
//   - by day, the catapults at work: stones arcing over to crack the wall,
//     stretch by stretch, till one comes down;
//   - and the assault, when it comes (see sim/siege.js scheduleAssault):
//     fought out by bands (see sim/bands.js), the besiegers at the gate with
//     the ram, up ladders at the walls (the defenders pushing them down),
//     through a breach, over the barricades; on the walls, down into the
//     streets, and for the square. Taken, the town's dealt with as its
//     takers would (see sim/conduct.js): held in good order, picked clean,
//     burned and bloodied; held, the besiegers go back to their camp.
// Whatever it put up is taken down again when it's over (or kept in the
// siege's state, and taken down after a reload: see cleanup).
import { GROUND } from '../config.js';
import { B } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { RNG, hash4, clamp } from '../util/rng.js';
import { alive, DAY } from '../sim/econ.js';
import { Engine } from './engines.js';
import { ignite, roofTarget } from './fire.js';
import { slotAt, orderBand, standing, bandUp, buildGrid } from '../sim/bands.js';
import { onRoof } from '../entities/pathfind.js';
import { resolveAssault, sackTown, endSiege } from '../sim/siege.js';
import { sackOf } from '../sim/conduct.js';
import { assignCommand, afterCommand } from '../sim/command.js';

const Y0 = GROUND;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'free folk');
const residents = (L) => L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
// Which way is in, from a stretch of wall on each side (see stretchesOf).
const INWARD = [[0, 1], [0, -1], [1, 0], [-1, 0]];
// A ladder's meta, by the way to the wall from its foot.
const LADDER_META = (dx, dz) => (dz === 1 ? 0 : dx === -1 ? 1 : dz === -1 ? 2 : 3);

export class SiegeGround {
  constructor(war) {
    this.war = war;
    this.sites = new Map(); // siege id -> what's been put up, who's about
    this.t = 0;
  }

  get game() {
    return this.war.game;
  }

  // ------------------------------------------------------------ the sites
  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    const war = this.war;
    const want = new Set();
    for (const w of war.wars) {
      const S = w.siege;
      if (!S || S.phase === 'over') continue;
      if (!this.near(S)) continue;
      want.add(S.id);
      let site = this.sites.get(S.id);
      if (!site) {
        site = this.open(w, S);
        if (!site) continue;
      }
      this.tickSite(site, 0.5);
    }
    for (const [id, site] of this.sites) if (!want.has(id) && !(war.live && war.live.siege === site.S)) this.close(site);
  }

  // Near enough to be there: in the town, or within sight of the camp.
  near(S) {
    const g = this.game;
    const L = g.world.layouts.get(S.sid);
    if (!L || !g.world.regionAt(S.camp.x, S.camp.z) && !g.active.has(S.sid)) return false;
    if (g.active.has(S.sid)) return true;
    return this.war.nearPlayer(S.camp, 70);
  }

  canLive(w, S) {
    return this.near(S) && !!this.game.world.layouts.get(S.sid);
  }

  open(w, S) {
    const g = this.game;
    const L = g.world.layouts.get(S.sid);
    if (!L || !L.econ) return null;
    const site = { S, w, L, ents: [], watch: [], engines: [], bombT: 6 + (S.id % 7) * 2, ladders: [], posts: [], steps: [], bars: [], built: false };
    this.sites.set(S.id, site);
    S.placed ||= [];
    const ops = [...this.planCamp(S, L), ...(S.small ? this.planBarricades(S, L, site) : this.planWalk(S, L, site))];
    this.place(site, ops);
    this.barGates(site, true);
    this.campEngines(site);
    return site;
  }

  close(site, over = false) {
    const g = this.game;
    this.sites.delete(site.S.id);
    for (const n of [...site.ents, ...site.watch]) {
      if (n.dead || !g.npcs.includes(n)) continue;
      if (n.warband && n.warband.kind === 'wallwatch') {
        n.warband = null;
        n.state = 'routine';
        n.path = null;
        continue;
      }
      if (!g.inSight(n.x, n.z, 2)) g.despawnNpc(n);
      else if (n.warband) {
        n.warband.kind = 'battle';
        n.warband.phase = 'flee';
        n.warband.home ||= { x: site.S.camp.x + site.S.dir.x * 30, z: site.S.camp.z + site.S.dir.z * 30 };
      }
    }
    for (const e of site.engines) e.done = true;
    if (over) {
      this.barGates(site, false);
      this.cleanup(site.S);
    }
  }

  // A siege over (or found over after a reload): what it put up comes down.
  cleanup(S) {
    const war = this.war;
    const g = this.game;
    const site = this.sites.get(S.id);
    if (site) {
      this.sites.delete(S.id);
      this.close(site, false);
      this.barGates(site, false);
    }
    const ops = [];
    for (const [x, y, z, id] of S.placed || []) {
      if (g.world.regionAt(x, z) && g.world.getBlock(x, y, z) !== id) continue;
      ops.push([x, y, z, B.air, 0]);
      if (g.world.regionAt(x, z) && g.inSight(x, z, 2)) g.renderer.emit(x + 0.5, y + 0.5, z + 0.5, { n: 3, color: ['#8a6a3a', '#5a4022', '#c8b89a'], up: 14, speed: 18, life: 0.4 });
    }
    war.sim.setBlocks(ops);
    S.placed = [];
  }

  // Put up (where you can see it, a bit at a time, with dust).
  place(site, ops) {
    const g = this.game;
    const w = g.world;
    for (const op of ops) {
      const [x, y, z, id, meta = 0] = op;
      if (!w.regionAt(x, z) || w.getBlock(x, y, z) !== B.air) continue;
      w.setBlock(x, y, z, id, meta);
      site.S.placed.push([x, y, z, id]);
      if (g.inSight(x, z, 2) && Math.random() < 0.3) g.renderer.emit(x + 0.5, y + 0.4, z + 0.5, { n: 3, color: ['#8a6a3a', '#5a4022'], up: 14, speed: 16, life: 0.35 });
    }
  }

  // ------------------------------------------------------------ the camp
  planCamp(S, L) {
    const g = this.game;
    const w = g.world;
    const c = S.camp;
    // (Facing the town: `f` toward it, `p` across.)
    const f = { x: -S.dir.x, z: -S.dir.z };
    const p = { x: -f.z, z: f.x };
    const at = (a, b) => ({ x: Math.round(c.x + f.x * a + p.x * b), z: Math.round(c.z + f.z * a + p.z * b) });
    const ok = (q) => {
      if (!w.regionAt(q.x, q.z) || g.world.ow.settlementAt(q.x, q.z)) return false;
      const y = w.findStandY(q.x, q.z, GROUND);
      return y === GROUND && !w.isWaterAt(q.x, y, q.z) && w.getBlock(q.x, GROUND, q.z) === B.air;
    };
    const ops = [];
    const rot = Math.abs(f.x) > Math.abs(f.z) ? (f.x > 0 ? 1 : 3) : (f.z > 0 ? 0 : 2);
    // Tents, in two rows behind the fires.
    for (const [a, b] of [[-3, -6], [-3, -3], [-3, 3], [-3, 6], [-7, -4], [-7, 0], [-7, 4], [-11, -6], [-11, 6]]) {
      const q = at(a, b);
      if (ok(q)) ops.push([q.x, GROUND, q.z, B.tent, rot]);
    }
    for (const [a, b] of [[0, -4], [0, 4], [-5, 0]]) {
      const q = at(a, b);
      if (ok(q)) ops.push([q.x, GROUND, q.z, B.campfire, 0]);
    }
    // A fence across the front, a gap in the middle.
    for (let b = -9; b <= 9; b++) {
      if (Math.abs(b) <= 1) continue;
      const q = at(4, b);
      if (ok(q)) ops.push([q.x, GROUND, q.z, B.fence, 0]);
    }
    // The banner by the commander's tent.
    const q = at(-5, 2);
    if (ok(q) && B.festival_banner) ops.push([q.x, GROUND, q.z, B.festival_banner, 0]);
    return ops;
  }

  // The catapults and the ram, standing in the camp till they're wanted.
  campEngines(site) {
    const g = this.game;
    const S = site.S;
    g.engines ||= [];
    const civ = this.war.civ(S.civA);
    const banner = civ ? civ.color.hex : null;
    const f = { x: -S.dir.x, z: -S.dir.z };
    const p = { x: -f.z, z: f.x };
    const put = (type, a, b) => {
      const x = Math.round(S.camp.x + f.x * a + p.x * b);
      const z = Math.round(S.camp.z + f.z * a + p.z * b);
      const y = g.world.regionAt(x, z) ? g.world.findStandY(x, z, GROUND) : -1;
      if (y <= 0 || Math.abs(y - GROUND) > 1) return null;
      const e = new Engine(g, type, x, y, z, { side: S.atk, banner, phase: 'ready', hp: type === 'ram' ? 60 : 40, cd: 5 + Math.random() * 4 });
      e.dir = Math.abs(f.x) > Math.abs(f.z) ? (f.x > 0 ? 1 : 3) : (f.z > 0 ? 2 : 0);
      e.face = { x: x + f.x * 20, z: z + f.z * 20 };
      e.siege = S.id;
      g.engines.push(e);
      site.engines.push(e);
      return e;
    };
    for (let i = 0; i < Math.min(3, S.engines.catapults || 0); i++) put('catapult', 2, [-6, 6, 0][i]);
    // (The ram out in front of the fence, its way to the walls clear.)
    if (S.engines.rams) put('ram', 6, 0);
  }

  // ------------------------------------------------------------ the walls
  // The stretches facing the camp: a timber walk behind them, at the top
  // of the wall, and steps up to it; the posts along it (on the wall top,
  // in the gaps between the merlons; and on the walk behind).
  planWalk(S, L, site) {
    const g = this.game;
    const w = g.world;
    const b = L.bounds;
    const near = S.walls.slice().sort((p, q) => cheb(p.mid, S.camp) - cheb(q.mid, S.camp)).slice(0, 3);
    const ops = [];
    const free = (x, z, h) => {
      const m = L.maskAt(x, z);
      if (m === M.BUILD || m === M.WALL || m === M.WATER) return false;
      if (!w.regionAt(x, z)) return false;
      for (let y = Y0; y < Y0 + h; y++) if (w.getBlock(x, y, z) !== B.air) return false;
      return w.findStandY(x, z, GROUND) === GROUND;
    };
    const taken = new Set();
    for (const st of near) {
      const [ix, iz] = INWARD[st.side];
      const tiles = tilesOf(L, st);
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          // Steps at each end of the run, going in from the walk.
          for (const end of [run[0], run[run.length - 1]]) {
            const s2 = { x: end.x + ix * 2, z: end.z + iz * 2 };
            const s1 = { x: end.x + ix * 3, z: end.z + iz * 3 };
            if (free(s2.x, s2.z, 3) && free(s1.x, s1.z, 2)) {
              ops.push([s2.x, Y0, s2.z, B.planks, 0], [s2.x, Y0 + 1, s2.z, B.planks, 0], [s1.x, Y0, s1.z, B.planks, 0]);
              site.steps.push({ top: { x: end.x + ix, z: end.z + iz }, mid: s2, low: s1, foot: { x: end.x + ix * 4, z: end.z + iz * 4 } });
            }
          }
        }
        run = [];
      };
      for (const t of tiles) {
        const inner = { x: t.x + ix, z: t.z + iz };
        const k = inner.x * 65536 + inner.z;
        if (taken.has(k) || !free(inner.x, inner.z, 3)) {
          flush();
          continue;
        }
        taken.add(k);
        ops.push([inner.x, Y0 + 2, inner.z, B.planks, 0]);
        run.push(t);
        site.posts.push({ x: inner.x, y: Y0 + 3, z: inner.z, kind: 'walk', wall: { x: t.x, z: t.z }, st: st.k });
        // (The gap between merlons on the wall top, over it: a post to
        // fight from, and where a ladder can come up.)
        if (w.getBlock(t.x, Y0 + 3, t.z) === B.air && w.getBlock(t.x, Y0 + 2, t.z) !== B.air) {
          const out = { x: t.x - ix, z: t.z - iz };
          site.posts.push({ x: t.x, y: Y0 + 3, z: t.z, kind: 'crenel', wall: { x: t.x, z: t.z }, out, st: st.k });
        }
      }
      flush();
    }
    void b;
    return ops;
  }

  // An unwalled town's streets barricaded where they run out: carts,
  // fences, logs across the road, two high.
  planBarricades(S, L, site) {
    const w = this.game.world;
    const ops = [];
    for (const q of S.barricades) {
      const along = q.dx ? [0, 1] : [1, 0];
      const tiles = [];
      for (let k = -1; k <= 1; k++) {
        const x = q.x + along[0] * k;
        const z = q.z + along[1] * k;
        if (!w.regionAt(x, z) || w.findStandY(x, z, GROUND) !== GROUND) continue;
        if (w.getBlock(x, Y0, z) !== B.air || w.getBlock(x, Y0 + 1, z) !== B.air) continue;
        const k2 = (x + z) % 3;
        ops.push([x, Y0, z, k2 === 0 ? B.hay_bale : B.log_wall, 0]);
        if (k2 !== 0) ops.push([x, Y0 + 1, z, B.fence, 0]);
        tiles.push({ x, z });
      }
      site.bars.push({ ...q, tiles });
    }
    return ops;
  }

  // Barred (or the bar lifted again): every gate of the town.
  barGates(site, shut) {
    const g = this.game;
    const L = site.L;
    L.barred = shut ? site.S.id : null;
    for (const q of L.gates || []) {
      if (!g.world.regionAt(q.x, q.z) || g.world.getBlock(q.x, GROUND, q.z) !== B.city_gate) continue;
      if (shut && g.world.getState(q.x, GROUND, q.z)) g.setGate(q.x, q.z, false);
    }
  }

  // A gate tile barred against a siege?
  barred(x, z) {
    const s = this.game.world.ow.settlementAt(x, z);
    const L = s ? this.game.world.layouts.get(s.id) : null;
    return !!(L && L.barred);
  }

  // ------------------------------------------------------------ while it lasts
  tickSite(site, dt) {
    const g = this.game;
    const S = site.S;
    // (The gates: kept barred, whatever the watch's habit.)
    if ((site.gateT = (site.gateT || 0) - dt) <= 0) {
      site.gateT = 3;
      this.barGates(site, true);
    }
    if (!site.built) {
      site.built = true;
      if (!S.small) this.postWatch(site);
      this.campFolk(site);
    }
    // The stones, by day (not while an assault's on: that has its own).
    const day = g.minute >= 6 * 60 && g.minute < 20 * 60;
    if (day && !(this.war.live && this.war.live.siege === S) && site.engines.some((e) => e.type === 'catapult' && !e.broken)) {
      site.bombT -= dt;
      if (site.bombT <= 0) {
        site.bombT = 18 + Math.random() * 22;
        this.loose(site);
      }
    }
    // Cracks in the wall as it's knocked at (as many as it's taken).
    if ((site.crackT = (site.crackT || 0) - dt) <= 0) {
      site.crackT = 4;
      this.showCracks(site);
    }
    // The watch on the walls, and the camp folk: kept.
    site.watch = site.watch.filter((n) => !n.dead && g.npcs.includes(n) && n.warband && n.warband.kind === 'wallwatch');
    site.ents = site.ents.filter((n) => !n.dead && g.npcs.includes(n));
  }

  // The watch posted along the walk (a few of the town's guards, awake).
  postWatch(site) {
    const g = this.game;
    const a = g.active.get(site.S.sid);
    if (!a) return;
    const posts = site.posts.filter((q) => q.kind === 'crenel');
    const guards = a.npcs.filter((n) => !n.dead && n.rec.job === 'guard' && !n.sleeping && n.state === 'routine' && !n.warband);
    for (let i = 0; i < Math.min(4, guards.length, posts.length); i++) {
      const n = guards[i];
      const post = posts[Math.floor((i * posts.length) / Math.min(4, guards.length, posts.length))];
      n.state = 'warband';
      n.warband = { kind: 'wallwatch', side: 'town', foe: false, post, phase: 'post' };
      n.path = null;
      // (Out of your sight: up there already.)
      if (!g.inSight(n.x, n.z, 2) && !g.inSight(post.x, post.z, 2)) n.teleport(post.x, post.y, post.z);
      site.watch.push(n);
    }
  }

  // A few of the besiegers about the camp: at the fires, on watch.
  campFolk(site) {
    const g = this.game;
    const war = this.war;
    const S = site.S;
    const w = site.w;
    const P = war.pool(w, S.atk, { def: S.sid, atk: S.sid, attacker: S.atk, ca: w.lead.a, cb: w.lead.b });
    const f = { x: -S.dir.x, z: -S.dir.z };
    const p = { x: -f.z, z: f.x };
    const n0 = Math.min(10, P.recs.length, S.host);
    const me = war.playerCiv();
    const foe = !!(me && war.civ(S.civD) === me);
    for (let i = 0; i < n0; i++) {
      const { r, L } = P.recs[i];
      if (r.ent && !r.ent.dead) continue;
      const a = -2 - (i % 4) * 2;
      const b = ((i % 2) ? 1 : -1) * (2 + Math.floor(i / 2));
      const x = Math.round(S.camp.x + f.x * a + p.x * b);
      const z = Math.round(S.camp.z + f.z * a + p.z * b);
      if (g.inSight(x, z, 1)) continue;
      const e = war.spawn(r, L, x, z, S.atk, 'camp', { war: w.id, siege: S.id, foe, phase: 'idle', home: { x, z } });
      if (!e) continue;
      e.hostileNow = foe;
      site.ents.push(e);
    }
  }

  // A stone from one of the camp's catapults at the wall.
  loose(site) {
    const g = this.game;
    const S = site.S;
    const e = site.engines.filter((q) => q.type === 'catapult' && !q.broken)[0];
    if (!e) return;
    const st = S.walls.filter((q) => !q.down).sort((p, q) => cheb(p.mid, S.camp) - cheb(q.mid, S.camp))[0];
    if (!st) return;
    const tiles = tilesOf(site.L, st);
    const t = tiles[Math.floor(Math.random() * tiles.length)] || st.mid;
    e.fireT = 0.7;
    g.lob(e, t.x, Y0 + 2, t.z, 6);
    const pr = g.projectiles[g.projectiles.length - 1];
    if (pr) pr.onLand = (game, x, z) => this.stoneLands(site, st, x, z);
  }

  // A stone on the wall: dust and chips, a crack; the town's nerve.
  stoneLands(site, st, x, z) {
    const g = this.game;
    g.renderer.emit(x + 0.5, Y0 + 2.5, z + 0.5, { n: 16, color: ['#8a8a8a', '#6a625a', '#b8b0a0', '#c8c0b0'], up: 30, speed: 40, life: 0.9, gravity: 40 });
    g.audio?.play('impact', { x, y: Y0 + 2, z });
    if (g.inSight(x, z, 0)) g.shake = Math.min(1.3, (g.shake || 0) + 0.2);
    // (Anyone on the walk there knocked about.)
    for (const n of g.npcs) if (!n.dead && cheb(n, { x, z }) <= 1 && n.y >= Y0 + 2) g.damage(n, 3, null);
    void site;
    void st;
  }

  // The wall cracked as it's been knocked at: as many of its stones as
  // it's taken.
  showCracks(site) {
    const g = this.game;
    const w = g.world;
    for (const st of site.S.walls) {
      if (st.down || st.hp >= st.max) continue;
      const tiles = tilesOf(site.L, st);
      const want = Math.round((1 - st.hp / st.max) * tiles.length * 1.5);
      let have = 0;
      const cand = [];
      for (const t of tiles) {
        if (!w.regionAt(t.x, t.z)) continue;
        for (let y = Y0; y < Y0 + 3; y++) {
          const id = w.getBlock(t.x, y, t.z);
          if (id === B.cracked_bricks) have++;
          else if (id !== B.air && id !== B.city_gate) cand.push([t.x, y, t.z]);
        }
      }
      for (let i = 0; i < want - have && cand.length; i++) {
        const [x, y, z] = cand.splice(Math.floor(Math.random() * cand.length), 1)[0];
        w.setBlock(x, y, z, B.cracked_bricks, 0);
      }
    }
  }

  // ------------------------------------------------------------ the assault
  // The assault, fought out on the ground: two sides of bands (the storming
  // parties at each point, a reserve, the bowmen; the defenders on the
  // walls, at the gate, in the breach, a reserve on the square).
  startAssault(w, S) {
    const war = this.war;
    const g = this.game;
    const L = g.world.layouts.get(S.sid);
    if (!L || !L.econ || war.live) return false;
    let site = this.sites.get(S.id);
    if (!site) site = this.open(w, S);
    if (!site) return false;
    const s = L.settlement;
    const where = S.next.where;
    const cap = war.fieldCap(S.next.plan);
    const civA = war.civ(S.civA);
    const civD = war.civ(S.civD) || s.civ;
    const centre = { x: L.plaza ? L.plaza.cx : Math.round((s.bounds.x0 + s.bounds.x1) / 2), z: L.plaza ? L.plaza.cz : Math.round((s.bounds.z0 + s.bounds.z1) / 2) };
    // (The field's axis, as a battle's: from b's side to a's.)
    const toCamp = { x: S.dir.x, z: S.dir.z };
    const ax = S.atk === 'a' ? toCamp : { x: -toCamp.x, z: -toCamp.z };
    const perp = { x: -ax.z, z: ax.x };
    const plan = Object.assign(S.next.plan || {}, { at: war.sim.abs, site: { ...S.camp }, biome: war.biomeAt(S.camp), river: false, name: `the storming of ${s.name}`, attacker: S.atk, atk: S.sid, def: S.sid, ca: w.lead.a, cb: w.lead.b, siege: S.id });
    const live = { kind: 'battle', siege: S, site, w, plan, A: { recs: [], extra: 0 }, B: { recs: [], extra: 0 }, t: 0, axis: ax, perp, centre, sides: {}, walls: [], done: false, go: false, cap, pside: new Map(), points: [], inside: 0, holdT: 0 };
    S.next.live = true;
    // ---- the besiegers.
    const P = war.pool(w, S.atk, plan);
    const recs = P.recs.filter((q) => alive(q.r) && !q.r.captive).slice(0, Math.min(cap, S.host));
    const sideA = S.atk;
    const sideD = S.def;
    const signA = sideA === 'a' ? 1 : -1;
    const atkEnts = [];
    const f = { x: -S.dir.x, z: -S.dir.z };
    const pp = { x: -f.z, z: f.x };
    recs.forEach(({ r, L: HL, kit }, i) => {
      const a = -1 - Math.floor(i / 10) * 2;
      const b = ((i % 10) - 4.5) * 1.6;
      const x = Math.round(S.camp.x + f.x * a + pp.x * b);
      const z = Math.round(S.camp.z + f.z * a + pp.z * b);
      let e = null;
      const camp = site.ents.find((q) => q.rec === r && !q.dead);
      if (camp) {
        e = camp;
        e.warband = { ...e.warband, kind: 'battle', side: sideA, phase: 'move', war: w.id, form: { x, z }, levy: r.job !== 'guard', kit: kit || null, home: { x: S.camp.x + S.dir.x * 30, z: S.camp.z + S.dir.z * 30 } };
        e.hostileNow = true;
      } else {
        const q = g.inSight(x, z, 2) ? war.offstage(x, z, ax, perp, signA) : { x, z };
        if (!q) return;
        e = war.spawn(r, HL, q.x, q.z, sideA, 'battle', { war: w.id, role: 'centre', levy: r.job !== 'guard', kit: kit || null, home: { x: S.camp.x + S.dir.x * 30, z: S.camp.z + S.dir.z * 30 }, form: { x, z }, phase: q.x === x && q.z === z ? 'form' : 'march' });
      }
      if (!e) return;
      r.soldier = w.id;
      r.away = true;
      atkEnts.push(e);
    });
    site.ents = [];
    // ---- the defenders: the watch, and as many of the townsfolk as will
    // take up a spear.
    const a = g.active.get(S.sid);
    const pool = (a ? a.npcs : []).filter((n) => !n.dead && !n.warband && n.rec && n.rec.age === 'adult' && n.rec.ruler === undefined && (n.rec.job === 'guard' || ((n.rec.personality?.bravery ?? 0.5) > 0.22 && n.rec.job !== 'mayor' && n.rec.job !== 'priest')));
    pool.sort((p, q) => (q.rec.job === 'guard' ? 1 : 0) - (p.rec.job === 'guard' ? 1 : 0) || (q.rec.personality?.bravery ?? 0.5) - (p.rec.personality?.bravery ?? 0.5));
    for (const n of site.watch) if (!pool.includes(n) && !n.dead) pool.unshift(n);
    const defEnts = [];
    const want = Math.min(cap, Math.max(6, S.garrison));
    // (Round 145) The town's armoury goes round as far as it will; the rest
    // take up whatever they have.
    let arms = war.armoury(L);
    const kitOf = (r) => (r.job === 'guard' || arms-- > 0 ? null : 'poor');
    for (const n of pool.slice(0, want)) {
      n.sleeping = false;
      war.enlist(n, sideD, 'battle', { war: w.id, role: 'centre', levy: n.rec.job !== 'guard', kit: kitOf(n.rec), home: { ...centre }, form: { x: n.x, z: n.z }, phase: 'move' });
      n.rec.soldier = w.id;
      defEnts.push(n);
    }
    // (Too few about: more of the town's own come out of their houses.)
    if (defEnts.length < want) {
      // (Out of their own doors: nobody appears in the street from nowhere.)
      const more = residents(L).filter((r) => r.age === 'adult' && (!r.ent || r.ent.dead) && r.ruler === undefined && r.soldier === undefined && r.home !== undefined && r.home !== null).slice(0, want - defEnts.length);
      for (const r of more) {
        const b = L.buildings[r.home];
        if (!b || !b.door) continue;
        const at = b.door;
        const e = war.spawn(r, L, at.x, at.z, sideD, 'battle', { war: w.id, role: 'centre', levy: r.job !== 'guard', kit: kitOf(r), home: { ...centre }, form: { x: at.x, z: at.z }, phase: 'move' });
        if (!e) continue;
        r.soldier = w.id;
        defEnts.push(e);
      }
    }
    site.watch = [];
    if (!atkEnts.length || !defEnts.length) {
      for (const n of atkEnts) if (!g.inSight(n.x, n.z, 2)) g.despawnNpc(n);
      S.next.live = false;
      return false;
    }
    live.sides[sideA] = { civ: civA, tactic: 'siege', ents: atkEnts, start: atkEnts.length, broken: false, hates: false, sign: signA, reserve: P.recs.slice(recs.length), fwd: { x: f.x, z: f.z } };
    live.sides[sideD] = { civ: civD, tactic: 'walls', ents: defEnts, start: defEnts.length, broken: false, hates: false, sign: -signA, reserve: [], fwd: { x: S.dir.x, z: S.dir.z } };
    this.formAssault(live, site, where);
    // ---- the engines: the ram for the gate, the catapults for the walls.
    live.engines = [];
    for (const e of site.engines) {
      if (e.broken) continue;
      e.done = false;
      e.side = sideA;
      e.crew = [];
      if (e.type === 'ram') {
        const gp = live.points.find((q) => q.kind === 'gate');
        if (!gp) continue;
        e.wall = { x: gp.wall.x, z: gp.wall.z };
        e.gateOf = S.id;
        e.town = S.sid;
        e.phase = 'wait';
      } else e.phase = 'ready';
      const crewFrom = live.sides[sideA].bands.find((b) => b.role === (e.type === 'ram' ? 'gate' : 'reserve')) || live.sides[sideA].bands[0];
      for (const n of crewFrom.ents.filter((q) => !q.mount).slice(-(e.type === 'ram' ? 2 : 1))) {
        n.warband.role = 'crew';
        n.warband.engine = e.id;
        e.crew.push(n);
      }
      live.engines.push(e);
    }
    // (Who of you is on which side.)
    const me = war.playerCiv();
    live.mine = (p) => live.pside.get(p) ?? null;
    live.leaderNear = (Sd, at) => {
      for (const q of g.everyone ? g.everyone() : [g.player]) {
        const sd = live.pside.get(q);
        if (sd && live.sides[sd] === Sd && !q.dead && !q.down && cheb(q, at) <= 6) return true;
      }
      return false;
    };
    war.eachCalled(plan, (d, q) => live.pside.set(q, d.side), true);
    for (const q of g.everyone ? g.everyone() : [g.player]) {
      if (live.pside.has(q)) continue;
      const civ = me;
      if (civ && civA && civ.id === civA.id) live.pside.set(q, sideA);
      else if (civ && civD && civ.id === civD.id) live.pside.set(q, sideD);
    }
    for (const [q, sd] of live.pside) {
      live.sides[sd === 'a' ? 'b' : 'a'].hates = true;
      void q;
    }
    war.live = live;
    S.next.live = true;
    assignCommand(war, live);
    g.ui.msg(`Horns from the camp! The ${plain(civA)} are storming ${s.name}: ${where.map((q) => ({ gate: 'the gate', breach: 'the breach', walls: 'the walls', barricade: 'the barricades' }[q])).join(' and ')}!`, '#ff9060');
    g.ui.showCard?.(`The Storming of ${s.name}`, `the ${plain(civA)}, ${S.host} strong, against ${S.garrison} on the ${S.small ? 'barricades' : 'walls'}`, 4.5, civA ? civA.color.hex : '#f0d890');
    g.audio?.play('war_horn', { x: S.camp.x, y: GROUND, z: S.camp.z });
    g.audio?.play('war_drums', { x: S.camp.x, y: GROUND, z: S.camp.z });
    g.audio?.play('alarm');
    g.disturb?.('Horns and drums: the assault! You stop waiting.');
    return true;
  }

  // The bands of an assault, and where each goes (or stands).
  formAssault(live, site, where) {
    const S = site.S;
    const g = this.game;
    const sideA = S.atk;
    const sideD = S.def;
    const A = live.sides[sideA];
    const D = live.sides[sideD];
    const civA = A.civ;
    const civD = D.civ;
    // The points: where each storming party goes.
    const points = [];
    if (where.includes('gate') && S.gate && !S.gate.broken) {
      const gt = S.gate;
      const out = { x: gt.x + Math.round(S.dir.x * 3), z: gt.z + Math.round(S.dir.z * 3) };
      points.push({ kind: 'gate', wall: { x: gt.x, z: gt.z }, out, inside: { x: gt.x - Math.round(S.dir.x * 3), z: gt.z - Math.round(S.dir.z * 3) } });
    }
    if (where.includes('breach')) {
      const st = S.walls.find((q) => q.down);
      if (st) points.push({ kind: 'breach', wall: st.mid, out: { x: st.mid.x + Math.round(S.dir.x * 3), z: st.mid.z + Math.round(S.dir.z * 3) }, inside: { x: st.mid.x - Math.round(S.dir.x * 3), z: st.mid.z - Math.round(S.dir.z * 3) } });
    }
    if (where.includes('walls')) {
      // (Up to three ladders, at gaps in the merlons with steps down
      // behind, along the stretches facing the camp.)
      const cren = site.posts.filter((q) => q.kind === 'crenel' && site.steps.some((s0) => cheb(s0.top, { x: q.x, z: q.z }) <= 6));
      cren.sort((p, q) => cheb(p, S.camp) - cheb(q, S.camp));
      const picked = [];
      for (const q of cren) {
        if (picked.length >= Math.min(3, Math.max(1, Math.floor((S.engines.ladders || 2) / 2)))) break;
        if (picked.some((o) => cheb(o, q) < 4)) continue;
        const base = q.out;
        const y = g.world.findStandY(base.x, base.z, GROUND);
        if (y !== GROUND || g.world.getBlock(base.x, Y0, base.z) !== B.air) continue;
        picked.push(q);
      }
      for (const q of picked) {
        const step = site.steps.slice().sort((p, o) => cheb(p.top, q) - cheb(o.top, q))[0];
        const ladder = { base: { x: q.out.x, z: q.out.z }, wall: { x: q.x, z: q.z }, top: { x: q.x, y: Y0 + 3, z: q.z }, up: false, broken: false, raiseT: 0, meta: LADDER_META(q.x - q.out.x, q.z - q.out.z) };
        site.ladders.push(ladder);
        points.push({ kind: 'walls', wall: { x: q.x, z: q.z }, out: { x: q.out.x + Math.sign(q.out.x - q.x) * 3, z: q.out.z + Math.sign(q.out.z - q.z) * 3 }, ladder, inside: step ? step.foot : { x: q.x - Math.sign(q.out.x - q.x) * 4, z: q.z - Math.sign(q.out.z - q.z) * 4 }, post: q });
      }
    }
    if (where.includes('barricade')) for (const bar of site.bars) points.push({ kind: 'barricade', wall: { x: bar.x, z: bar.z }, bar, out: { x: bar.x + (bar.dx || 0) * 3, z: bar.z + (bar.dz || 0) * 3 }, inside: { x: bar.x - (bar.dx || 0) * 3, z: bar.z - (bar.dz || 0) * 3 } });
    if (!points.length) {
      // (Nowhere they meant to go is there to go at: the nearest stretch
      // by ladder, or straight at the gate.)
      const gt = S.gate || { x: S.camp.x, z: S.camp.z };
      points.push({ kind: 'gate', wall: { x: gt.x, z: gt.z }, out: { x: gt.x + Math.round(S.dir.x * 3), z: gt.z + Math.round(S.dir.z * 3) }, inside: { x: gt.x - Math.round(S.dir.x * 3), z: gt.z - Math.round(S.dir.z * 3) } });
    }
    live.points = points;
    // The besiegers' bands: a storming party for each point, the bowmen,
    // a reserve.
    const ents = A.ents.slice();
    const bows = ents.filter((n) => hasBowOf(n)).slice(0, Math.round(ents.length * 0.2));
    const foot = ents.filter((n) => !bows.includes(n));
    const resN = foot.length >= 12 ? Math.round(foot.length * 0.2) : 0;
    const reserve = foot.splice(foot.length - resN, resN);
    const share = points.map(() => []);
    foot.forEach((n, i) => share[i % points.length].push(n));
    A.bands = [];
    const mk = (side, role, list, extra) => {
      if (!list.length) return null;
      const S0 = live.sides[side];
      const b = {
        id: `${side}${S0.bands.length}`, side, role, name: extra.name, ents: list.slice(), start: list.length, lost: 0, captain: null, bearer: null, color: S0.civ ? S0.civ.color.hex : '#a09080',
        anchor: { ...(extra.anchor || { x: list[0].x, z: list[0].z }) }, face: { ...S0.fwd }, order: { kind: extra.order || 'hold', at: null, t0: 0, by: 'ai' }, morale: 60, base: 60, state: 'ok', stateT: 0,
        width: Math.max(1, Math.min(6, Math.ceil(Math.sqrt(list.length * 2)))), spacing: 1, engaged: 0, contactT: null, volleyT: 0, ...extra,
      };
      b.home = { ...b.anchor };
      S0.bands.push(b);
      for (const n of list) {
        n.warband.band = b.id;
        n.warband.role = 'centre';
      }
      return b;
    };
    points.forEach((pt, i) => {
      const nm = { gate: 'the storming party at the gate', breach: 'the storming party at the breach', walls: 'the ladder party', barricade: 'the storming party' }[pt.kind];
      const b = mk(sideA, pt.kind === 'walls' ? 'ladders' : 'storm', share[i], { name: nm, anchor: pt.out, order: 'hold', point: pt });
      if (b && pt.ladder) {
        // (Two of them carry the ladder.)
        b.ents.slice(0, 2).forEach((n) => {
          n.warband.carry = pt.ladder;
        });
        pt.ladder.band = b.id;
      }
    });
    const ba = mk(sideA, 'bows', bows, { name: 'the bowmen', anchor: { x: S.camp.x - S.dir.x * 6, z: S.camp.z - S.dir.z * 6 }, order: 'loose', width: 6 });
    void ba;
    mk(sideA, 'reserve', reserve, { name: 'the reserve', anchor: { x: S.camp.x - S.dir.x * 2, z: S.camp.z - S.dir.z * 2 }, order: 'hold' });
    // The defenders' bands: on the walls by each point (their posts the
    // gaps and the walk), at the gate, in the breach, behind the
    // barricades; a reserve on the square.
    const dents = D.ents.slice();
    D.bands = [];
    const guards = dents.filter((n) => n.rec.job === 'guard');
    const folk = dents.filter((n) => n.rec.job !== 'guard');
    const dres = folk.length >= 6 ? folk.splice(0, Math.round(folk.length * 0.3)) : [];
    const order = [...guards, ...folk];
    const dshare = points.map(() => []);
    order.forEach((n, i) => dshare[i % points.length].push(n));
    points.forEach((pt, i) => {
      let posts = null;
      if (pt.kind === 'walls') {
        const near = site.posts.filter((q) => cheb(q, pt.wall) <= 5).sort((p, q) => cheb(p, pt.wall) - cheb(q, pt.wall) || (p.kind === 'crenel' ? -1 : 1));
        posts = near.map((q) => ({ x: q.x, y: q.y, z: q.z }));
      } else if (pt.kind === 'gate' || pt.kind === 'breach' || pt.kind === 'barricade') {
        const c = pt.inside;
        posts = [];
        const px = -S.dir.z;
        const pz = S.dir.x;
        const rows = pt.kind === 'barricade' ? 1 : 2;
        for (let r = 0; r < rows; r++) for (let k = -3; k <= 3; k++) {
          const x = Math.round(c.x + px * k - S.dir.x * r + S.dir.x * (pt.kind === 'barricade' ? 2 : 1));
          const z = Math.round(c.z + pz * k - S.dir.z * r + S.dir.z * (pt.kind === 'barricade' ? 2 : 1));
          const y = g.world.findStandY(x, z, GROUND);
          if (y > 0 && Math.abs(y - GROUND) <= 1) posts.push({ x, y, z });
        }
      }
      const nm = { gate: 'the gate\'s defenders', breach: 'the defenders of the breach', walls: 'the walls\' defenders', barricade: 'the barricades\' defenders' }[pt.kind];
      mk(sideD, pt.kind === 'walls' ? 'wall' : pt.kind === 'barricade' ? 'gate' : pt.kind, dshare[i], { name: nm, anchor: pt.inside, order: 'man', posts, point: pt });
    });
    mk(sideD, 'square', dres, { name: 'the townsfolk on the square', anchor: { ...live.centre }, order: 'hold' });
    // Each to their place: posts, or their band's ranks; anyone out of your
    // sight put straight there.
    for (const s0 of [sideA, sideD]) {
      for (const b of live.sides[s0].bands) {
        b.ents.forEach((n, i) => {
          const q = slotAt(b, i);
          n.warband.form = q;
          if (g.inSight(n.x, n.z, 2) || g.inSight(q.x, q.z, 2)) return;
          const y = q.y ?? g.world.findStandY(q.x, q.z, n.y);
          if (y > 0 && (q.y !== undefined || !onRoof(g.world, q.x, y, q.z))) n.teleport(q.x, y, q.z);
        });
        b.captain = null;
        b.base = b.morale = 58 + (s0 === sideD ? 8 + (S.morale.def - 50) * 0.3 : (S.morale.atk - 50) * 0.3) - (s0 === sideD && S.hungry ? Math.min(18, S.hungry * 6) : 0);
        b.morale = clamp(b.morale, 20, 92);
        b.base = b.morale;
      }
      live.sides[s0].prog = { stage: 0, t: 0 };
      live.sides[s0].thinkT = 1;
      live.sides[s0].marshal = { ent: null, name: null, style: 'steady', player: null, lost: false };
    }
    void civA;
    void civD;
  }

  // A quarter-second of an assault.
  assaultTick(live) {
    const war = this.war;
    const g = this.game;
    const S = live.siege;
    const site = live.site;
    // (The bands as in any battle: their nerve, their captains, the
    // commanders; and the sound of it.)
    if (!live.done) war.bandsTickFor(live);
    else buildGrid(live, g);
    war.battleDin(live);
    const sideA = S.atk;
    const sideD = S.def;
    const A = live.sides[sideA];
    const D = live.sides[sideD];
    // It begins once the storming parties are drawn up (or soon anyway).
    if (!live.go) {
      const formed = A.ents.filter((n) => standing(n) && n.warband.phase !== 'march').length >= A.ents.length * 0.7;
      if (formed || live.t > 18) {
        live.go = true;
        live.goT = live.t;
        g.audio?.play('alarm');
        for (const b of A.bands) if (b.point) orderBand(live, b, 'storm', b.point.out, 'ai');
        for (const b of D.bands) if (b.posts) orderBand(live, b, 'man', null, 'ai');
      }
    }
    // The ladders: up against the wall (pushed down, put up again).
    for (const ld of site.ladders) this.ladderTick(live, ld);
    // The barricades: battered down.
    // (The engines: the ram at the gate, the catapults at the walls. A ram
    // whose crew have fallen is taken up by others of its party.)
    for (const e of live.engines || []) {
      if (e.broken || e.done) continue;
      e.crew = e.crew.filter((n) => !n.dead && !n.down);
      const want = e.type === 'ram' ? 2 : 1;
      if (e.crew.length >= want || live.done) continue;
      const from = A.bands.find((b) => b.point && (e.type === 'ram' ? b.point.kind === 'gate' : true)) || A.bands[0];
      const more = (from ? from.ents : []).filter((n) => standing(n) && n.warband.role !== 'crew' && !n.warband.carry).sort((p, q) => cheb(p, e) - cheb(q, e)).slice(0, want - e.crew.length);
      for (const n of more) {
        n.warband.role = 'crew';
        n.warband.engine = e.id;
        e.crew.push(n);
      }
    }
    this.war.workEnginesFor(live);
    // Who's in: the besiegers inside the walls (or on them).
    const L = site.L;
    const b0 = L.bounds;
    const inside = (n) => n.x > b0.x0 && n.x < b0.x1 && n.z > b0.z0 && n.z < b0.z1;
    live.inside = A.ents.filter((n) => standing(n) && inside(n)).length;
    if (live.inside && !live.by) {
      // (The way they first got in.)
      const first = A.ents.find((n) => standing(n) && inside(n));
      const bp = first && first.warband ? A.bands.find((q) => q.id === first.warband.band) : null;
      live.by = bp && bp.point ? bp.point.kind : 'walls';
    }
    if (live.inside && !live.inAt) {
      live.inAt = live.t;
      g.ui.msg(`The ${plain(A.civ)} are in ${L.settlement.name}! Fighting in the streets!`, '#ff9060');
      // (Off the walls and to the square, to meet them.)
      for (const b of D.bands) if (b.state !== 'rout' && b.order.kind === 'man' && b.role !== 'wall') orderBand(live, b, 'charge', null, 'ai');
    }
    // The square: held by the besiegers, with none of its defenders near.
    const c = live.centre;
    const onSq = A.ents.filter((n) => standing(n) && cheb(n, c) <= 5).length;
    const defSq = D.ents.filter((n) => standing(n) && cheb(n, c) <= 6).length;
    if (onSq >= 3 && !defSq) live.holdT += 0.25;
    else live.holdT = Math.max(0, live.holdT - 0.5);
    const upA = A.ents.filter(standing).length + (A.reserve ? A.reserve.length : 0);
    const upD = D.ents.filter(standing).length;
    const routedD = D.bands.every((b) => b.state === 'rout' || !bandUp(b));
    const routedA = A.bands.every((b) => b.state === 'rout' || !bandUp(b));
    if (!live.done) {
      const won = live.holdT >= 12 || !!(live.go && (routedD || upD <= Math.max(1, D.start * 0.15)) && (live.inside || (S.gate && S.gate.broken) || S.walls.some((q) => q.down) || S.small));
      const lost = live.go && (routedA || upA <= Math.max(2, A.start * 0.3) || live.t - (live.goT || 0) > 300);
      if (won || lost) this.endAssault(live, won);
    } else this.afterTick(live);
  }

  // A ladder: carried up and raised against the wall; climbed; pushed down
  // by whoever's up top, if nobody's on it.
  ladderTick(live, ld) {
    const g = this.game;
    const w = g.world;
    if (ld.broken) return;
    if (!ld.up) {
      if (live.done) return;
      const carriers = (live.sides[live.siege.atk].ents || []).filter((n) => standing(n) && n.warband.carry === ld && cheb(n, ld.base) <= 1);
      if (carriers.length) {
        ld.raiseT += 0.25 * carriers.length;
        if (ld.raiseT >= 2) {
          ld.raiseT = 0;
          let ok = true;
          for (let y = Y0; y <= Y0 + 2; y++) if (w.getBlock(ld.base.x, y, ld.base.z) !== B.air) ok = false;
          if (!ok) {
            ld.broken = true;
            return;
          }
          for (let y = Y0; y <= Y0 + 2; y++) w.setBlock(ld.base.x, y, ld.base.z, B.ladder, ld.meta);
          ld.up = true;
          ld.upT = live.t;
          live.siege.placed.push(...[0, 1, 2].map((k) => [ld.base.x, Y0 + k, ld.base.z, B.ladder]));
          g.audio?.play('place', { x: ld.base.x, y: Y0, z: ld.base.z });
          const c = carriers[0];
          c.say(c.rng.pick(['Ladder up! Climb!', 'Up! Up!', 'It\'s up! Go!']), 2, '#ffb080');
        }
      }
      return;
    }
    // Pushed down: a defender at the top, nobody halfway up.
    const top = (live.sides[live.siege.def].ents || []).find((n) => standing(n) && n.x === ld.wall.x && n.z === ld.wall.z && n.y >= Y0 + 3 && !n.windup);
    const climbing = g.npcs.some((n) => !n.dead && n.x === ld.base.x && n.z === ld.base.z && n.y >= Y0 + 1);
    if (top && !climbing && live.t - (ld.upT || 0) > 2 && Math.random() < 0.06) this.pushLadder(live, ld, top);
  }

  // Down it goes (and anyone on it), broken or to be raised again.
  pushLadder(live, ld, by = null) {
    const g = this.game;
    const w = g.world;
    if (!ld.up) return false;
    for (let y = Y0; y <= Y0 + 2; y++) if (w.getBlock(ld.base.x, y, ld.base.z) === B.ladder) w.setBlock(ld.base.x, y, ld.base.z, B.air, 0);
    ld.up = false;
    ld.raiseT = 0;
    ld.broken = Math.random() < 0.4;
    for (const n of g.npcs) {
      if (n.dead || n.x !== ld.base.x || n.z !== ld.base.z || n.y <= Y0) continue;
      const h = n.y - Y0;
      n.teleport(ld.base.x, Y0, ld.base.z);
      g.damage(n, 2 + h * 2, null);
      n.stunT = Math.max(n.stunT || 0, 1);
      if (n.warband) n.warband.climb = null;
    }
    g.renderer.emit(ld.base.x + 0.5, Y0 + 1.5, ld.base.z + 0.5, { n: 10, color: ['#8a6a3a', '#a07a4a', '#5a4022'], up: 24, speed: 30, life: 0.6, gravity: 40 });
    g.audio?.play('break', { x: ld.base.x, y: Y0, z: ld.base.z });
    if (by) by.say(by.rng.pick(['Over she goes!', 'Push! Push it off!', 'Down you go!', 'Ha! Back down!']), 2, '#a0e0a0');
    if (by && by.kind === 'player') g.ui.msg(ld.broken ? 'You heave the ladder off the wall: it splinters on the ground below.' : 'You heave the ladder off the wall!', '#a0e0a0');
    return true;
  }

  // You on the wall, by a ladder: push it off (true if there was one).
  pushAt(x, y, z) {
    const live = this.war.live;
    if (!live || !live.siege || !live.site) return false;
    const p = this.game.player;
    const ld = live.site.ladders.find((q) => q.up && ((q.base.x === x && q.base.z === z) || cheb(q.base, p) <= 1) && p.y >= Y0 + 3 && cheb(q.base, { x, z }) <= 1);
    return ld ? this.pushLadder(live, ld, p) : false;
  }

  // The ram through the gate: its leaves smashed, and the way open.
  breakGate(S, L) {
    const g = this.game;
    const gt = S.gate;
    if (!gt || gt.broken) return;
    gt.broken = true;
    gt.hp = 0;
    const tiles = g.gateway(gt.x, gt.z);
    const ops = [];
    for (const t of tiles.length ? tiles : [{ x: gt.x, z: gt.z }]) {
      for (const y of [GROUND, GROUND + 1]) if (g.world.getBlock(t.x, y, t.z) === B.city_gate || g.world.getBlock(t.x, y, t.z) === B.city_gate_top) ops.push([t.x, y, t.z, B.air, 0]);
      g.renderer.emit(t.x + 0.5, GROUND + 1, t.z + 0.5, { n: 18, color: ['#7a5430', '#a07a4a', '#5a3a20', '#8a8a8a'], up: 34, speed: 44, life: 1, gravity: 40 });
    }
    this.war.sim.setBlocks(ops);
    // (Rebuilt by the town's carpenters, in time.)
    const back = [];
    for (const t of tiles) back.push([t.x, GROUND, t.z, B.city_gate, gt.rot || 0], [t.x, GROUND + 1, t.z, B.city_gate_top, gt.rot || 0]);
    if (back.length) this.war.sim.works.add({ sid: S.sid, kind: 'mend', blocks: back, bounds: { x0: Math.min(...tiles.map((t) => t.x)), z0: Math.min(...tiles.map((t) => t.z)), x1: Math.max(...tiles.map((t) => t.x)), z1: Math.max(...tiles.map((t) => t.z)) }, bid: L.buildings.length - 0.2, label: 'hanging a new gate' });
    g.audio?.play('break', { x: gt.x, y: GROUND, z: gt.z });
    g.shake = Math.min(1.3, (g.shake || 0) + 0.6);
    g.ui.msg(`The gate of ${L.settlement.name} gives way under the ram!`, '#ff9060');
  }

  // The assault over: reckoned up (see siege.resolveAssault); the town
  // taken (and the sack, as hard as its takers are), or held.
  endAssault(live, won) {
    const war = this.war;
    const g = this.game;
    const S = live.siege;
    const site = live.site;
    live.done = true;
    live.won = won;
    const sideA = S.atk;
    const sideD = S.def;
    const lost = (side) => live.sides[side].ents.filter((n) => n.dead || n.down).length;
    const spawnedA = live.sides[sideA].ents.length;
    const spawnedD = live.sides[sideD].ents.length;
    // (Those who fought here, and the rest of each side by the same share.)
    const lossA = Math.round(lost(sideA) * Math.max(1, S.host / Math.max(1, spawnedA)));
    const lossD = Math.round(lost(sideD) * Math.max(1, S.garrison / Math.max(1, spawnedD)));
    const day = Math.floor(war.sim.abs / DAY);
    const rng = new RNG(hash4(S.id, Math.floor(war.sim.abs), 0xa55));
    // The beaten's wounded taken off the field.
    const winner = won ? sideA : sideD;
    const victor = live.sides[winner].civ;
    for (const s0 of [sideA, sideD]) for (const n of live.sides[s0].ents) {
      if (n.dead || !n.down) continue;
      if (s0 !== winner && victor && won !== null && rng.chance(0.6) && war.takePrisoner(n.rec, n.layout, victor, day, `the storming of ${site.L.settlement.name}`, null, true)) {
        n.down = false;
        n.sleeping = false;
        n.hp = Math.max(n.hp, 2);
        n.warband = { ...n.warband, kind: 'led', phase: 'flee', foe: false, home: { x: S.camp.x, z: S.camp.z } };
        n.hostileNow = false;
        n.restrained = true;
      } else war.wake(n);
    }
    // (Commanded by one of you: the sack's yours to answer for.)
    const lead = live.cmd && live.cmd[sideA] ? live.cmd[sideA].pk : null;
    if (lead) S.leader = lead;
    S.word = live.word ?? S.word ?? null;
    const sack = won ? brutalityPreview(war, S) : null;
    resolveAssault(war, live.w, S, site.L, rng, { won, lossA, lossD, by: live.by, word: live.word });
    // Did each of you do your part?
    war.reckonDraft(live, winner);
    war.afterDown(live, winner);
    afterCommand(war, live, winner);
    for (const s0 of [sideA, sideD]) for (const n of live.sides[s0].ents) {
      if (n.rec.soldier !== undefined) delete n.rec.soldier;
      if (!n.rec.captive) n.rec.away = false;
    }
    if (won) {
      g.ui.msg(`${site.L.settlement.name} has fallen to the ${plain(live.sides[sideA].civ)}!`, '#ff7060');
      this.startSack(live, sack);
    } else {
      g.ui.msg(`The assault on ${site.L.settlement.name} is thrown back!`, '#a0e0a0');
      for (const n of live.sides[sideA].ents) if (!n.dead && n.warband && !n.down) n.warband.phase = 'flee';
      for (const n of live.sides[sideD].ents) if (!n.dead && n.warband && !n.down && n.rng.chance(0.5)) n.say(n.rng.pick(['They run!', 'Back to your camp!', 'The walls hold!', 'Huzzah!']), 2.4, '#a0e0a0');
    }
    live.after = 0;
  }

  // The sack, on the ground: the takers through the streets, as hard as
  // they are (see conduct.js): standing guard over the square; at the
  // chests; torches to the roofs; the townsfolk cut down.
  startSack(live, b) {
    const g = this.game;
    const S = live.siege;
    const L = live.site.L;
    const level = (S.sack && S.sack.level) || (b && b.level) || 'plunder';
    live.sack = { level, t: 0, fires: (S.sack && S.sack.fires) || 0, burned: 0, victims: [] };
    const A = live.sides[S.atk];
    const pop = residents(L).length;
    const k = sackOf(b || { c: 0.4, g: 0.5, level }, pop);
    // (Those to die, from those about.)
    if (k.killed) {
      const a = g.active.get(S.sid);
      const folk = (a ? a.npcs : []).filter((n) => !n.dead && !n.warband && n.rec && n.rec.ruler === undefined && (n.rec.age !== 'child' || level === 'massacre'));
      live.sack.victims = folk.slice(0, k.killed);
    }
    for (const n of A.ents) {
      if (n.dead || n.down || !n.warband) continue;
      n.warband.phase = level === 'orderly' ? 'won' : 'sack';
      n.warband.town = S.sid;
      n.warband.robbed = 0;
    }
    const lines = { orderly: 'The captains keep their soldiers in hand: the gates are held, and nobody\'s harmed.', plunder: 'The soldiers go from house to house, carrying off whatever they can lift.', sack: 'The town is given over to the soldiers: doors kicked in, torches to the roofs.', massacre: 'No quarter: the soldiers cut down whoever they find in the streets.' };
    g.ui.msg(lines[level], level === 'orderly' ? '#e8e0a0' : '#ff7060');
    // The townsfolk run for their houses.
    const a = g.active.get(S.sid);
    for (const n of a ? a.npcs : []) if (!n.dead && !n.warband && n.state === 'routine' && n.rng.chance(level === 'orderly' ? 0.2 : 0.8)) n.startFlee?.(A.ents.find((q) => !q.dead) || g.player, n.rng.pick(['Run!', 'Hide! Hide!', 'They\'re in the town!', 'Mercy!']));
  }

  afterTick(live) {
    const g = this.game;
    const war = this.war;
    live.after = (live.after || 0) + 0.25;
    const sk = live.sack;
    const S = live.siege;
    if (sk) {
      sk.t += 0.25;
      const A = live.sides[S.atk];
      const soldiers = A.ents.filter((n) => !n.dead && !n.down && n.warband);
      // Fires, a few at a time.
      if (sk.burned < sk.fires && sk.t > 3 && Math.random() < 0.08) {
        const L = live.site.L;
        const bs = L.buildings.filter((q) => q && q.x0 !== undefined && !q.underConstruction);
        const n = soldiers[Math.floor(Math.random() * soldiers.length)];
        const bq = bs.length && n ? bs.sort((p, q) => cheb({ x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 }, n) - cheb({ x: (q.x0 + q.x1) / 2, z: (q.z0 + q.z1) / 2 }, n))[Math.floor(Math.random() * 3)] : null;
        const t = bq ? roofTarget(g, bq, n.x, n.z) : null;
        if (t && ignite(g, t.x, t.y, t.z, 'sack')) {
          sk.burned++;
          n.say(n.rng.pick(['Burn it!', 'Torch it!', 'Let it burn!']), 1.8, '#ff9060');
        }
      }
      // The killing.
      if (sk.victims.length && sk.t > 2) {
        for (const v of sk.victims) {
          if (v.dead) continue;
          const by = soldiers.filter((n) => !n.threat || n.threat.dead).sort((p, q) => cheb(p, v) - cheb(q, v))[0];
          if (by && cheb(by, v) <= 12 && by.warband.phase === 'sack') {
            by.warband.victim = v;
            v.hostileNow = false;
          }
        }
        sk.victims = sk.victims.filter((v) => !v.dead);
      }
    }
    // Done: everyone off (the takers stay a while, then back to the camp
    // and gone; the defenders home).
    if (live.after > (sk ? 70 : 30)) {
      for (const s0 of ['a', 'b']) for (const n of live.sides[s0].ents) {
        if (n.dead) continue;
        if (n.warband && n.warband.kind === 'battle' && n.layout && n.layout.settlement.id === S.sid && !live.won) {
          // (The town's own: home again.)
          n.warband = null;
          n.state = 'routine';
          n.hostileNow = false;
          n.path = null;
          continue;
        }
        if (!g.inSight(n.x, n.z, 2)) g.despawnNpc(n);
        else if (n.warband) n.warband.phase = 'flee';
      }
      for (const e of live.engines || []) e.done = true;
      war.live = null;
      // (The siege goes on, or it's over: the camp comes down then.)
      if (!live.w.siege || live.w.siege !== S || S.phase === 'over') this.close(live.site, true);
    }
  }
}

// (The tiles of a stretch of a town's wall: see siege.stretchesOf.)
export function tilesOf(L, st) {
  const b = L.bounds;
  const out = [];
  const gateAt = new Set((L.gates || []).map((q) => q.x * 65536 + q.z));
  for (let z = b.z0; z <= b.z1; z++) {
    for (let x = b.x0; x <= b.x1; x++) {
      if (L.maskAt(x, z) !== M.WALL || gateAt.has(x * 65536 + z)) continue;
      const dN = z - b.z0;
      const dS = b.z1 - z;
      const dW = x - b.x0;
      const dE = b.x1 - x;
      const m = Math.min(dN, dS, dW, dE);
      const side = m === dN ? 0 : m === dS ? 1 : m === dW ? 2 : 3;
      const along = side < 2 ? x - b.x0 : z - b.z0;
      if (side * 1000 + Math.floor(along / 8) === st.k) out.push({ x, z });
    }
  }
  return out;
}

function hasBowOf(n) {
  const items = (n.rec && n.rec.equipment && n.rec.equipment.items) || [];
  return items.some((i) => i && /bow/.test(i.item || '')) && (n.rec.inv || []).some((q) => q && (q.item === 'arrow' || q.item === 'bolt') && q.count > 0);
}

// What the sack would be (before the siege's own reckoning makes it so).
function brutalityPreview(war, S) {
  void war;
  return S.sack || null;
}

export { sackTown, endSiege };
