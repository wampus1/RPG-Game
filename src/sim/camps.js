// Camps: nomads and visiting merchants don't sleep in the square. They pitch
// small tents on open ground just outside town, by one of the roads in, and
// strike them again when they move on. Where you can see it, the tents go up
// a piece at a time with someone from the party there; elsewhere they're
// simply up.
import { B, META_STATE, CANOPY_SHIFT } from '../world/blocks.js';
import { GROUND } from '../config.js';
import { hash4 } from '../util/rng.js';
import { SOFT } from './diplomacy.js';

const DX = [0, -1, 0, 1];
const DZ = [1, 0, -1, 0];
// Seconds between pieces going up, with someone there.
const PITCH_EVERY = 1.2;

export class Camps {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.list = [];
    this.t = 0;
  }

  get(key) {
    return this.list.find((c) => c.key === key) || null;
  }

  // Open, flat, dry ground outside the town (and anyone else's), off the
  // roads, near the road in at `entrance`.
  site(L, entrance, w, d, salt) {
    const world = this.game.world;
    const ow = world.ow;
    const b = L.bounds;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    // Out from the town along the way that road leaves it.
    const ex = entrance.x - cx;
    const ez = entrance.z - cz;
    const out = Math.abs(ex) / (b.x1 - b.x0 + 1) > Math.abs(ez) / (b.z1 - b.z0 + 1) ? [Math.sign(ex), 0] : [0, Math.sign(ez) || 1];
    const lat = [out[1], out[0]];
    const taken = new Set(this.list.flatMap((c) => c.ops.map((o) => `${o[0]},${o[2]}`)));
    const okTile = (x, z) => {
      if (ow.settlementAt(x, z) || taken.has(`${x},${z}`)) return false;
      if (L.isRoadTile(x, z) || (L.outRoads && L.outRoads.has && L.outRoads.has(x * 65536 + z))) return false;
      const c = L.col(x, z);
      if (!c || c.water >= 0 || c.h !== GROUND - 1) return false;
      if (world.regionAt(x, z)) {
        const top = world.getBlock(x, GROUND, z);
        const below = world.getBlock(x, GROUND - 1, z);
        if (below === B.path || below === B.planks) return false;
        if (top !== B.air && !SOFT.has(top)) return false;
      }
      return true;
    };
    // Beside the road as it leaves town, a few paces out and to one side.
    const flip = salt & 1 ? 1 : -1;
    for (let dist = 3; dist <= 12; dist++) {
      for (const side of [1, 2, 3, 4, -1, -2, -3, -4].map((k) => k * flip)) {
        const off = side > 0 ? side * 2 : side * 2 - w + 1;
        const ox = entrance.x + out[0] * dist + lat[0] * off;
        const oz = entrance.z + out[1] * dist + lat[1] * off;
        let ok = true;
        for (let i = 0; i < w && ok; i++) for (let j = 0; j < d && ok; j++) if (!okTile(ox + lat[0] * i + out[0] * j, oz + lat[1] * i + out[1] * j)) ok = false;
        if (ok) return { x: ox, z: oz, lat, out };
      }
    }
    return null;
  }

  // Set up camp: `tents` tents in a row facing town, and a fire (nomads,
  // adventurers) or a crate and a barrel of stock (a merchant; a trading
  // company has a crate and a fire).
  // `extra.mounts`: wagons and horses that came with them ({ kind: 'wagon'
  // or 'horse', coat, banner }): the wagons stand beside the tents, the
  // horses tied to a hitching post.
  pitch(L, key, kind, tents, until, salt = 0, extra = {}) {
    if (this.get(key)) return this.get(key);
    const ents = L.entrances && L.entrances.length ? L.entrances : [{ x: L.plaza.cx, z: L.plaza.cz }];
    const entrance = ents[salt % ents.length];
    const mounts = extra.mounts || [];
    const nWagons = mounts.filter((m) => m.kind === 'wagon').length;
    const base = Math.max(3, tents * 2 - 1);
    const w = base + (mounts.length ? 2 + nWagons * 2 : 0);
    const at = this.site(L, entrance, w, mounts.length ? 3 : 2, salt);
    if (!at) return null;
    // Opening toward town.
    const face = DX.findIndex((dx, r) => dx === -at.out[0] && DZ[r] === -at.out[1]);
    // Traders (a visiting merchant, a trading company) have striped canvas.
    const merchant = kind === 'merchant' || kind === 'caravan';
    const colour = merchant ? hash4(salt, 7) % 3 + 1 : hash4(salt, 3) % 2 === 0 ? 0 : 3;
    const meta = (face & 3) | (merchant ? META_STATE : 0) | (colour << CANOPY_SHIFT);
    const pos = (i, j) => [at.x + at.lat[0] * i + at.out[0] * j, at.z + at.lat[1] * i + at.out[1] * j];
    const ops = [];
    for (let t = 0; t < tents; t++) {
      const [x, z] = pos(t * 2, 1);
      ops.push([x, GROUND, z, B.tent, meta]);
    }
    if (merchant) {
      const [cx, cz] = pos(1, 0);
      ops.push([cx, GROUND, cz, B.crate, 0]);
      const [bx, bz] = pos(2, 1);
      if (tents < 2) ops.push([bx, GROUND, bz, B.barrel, 0]);
      // A company on the road keeps a fire going, too.
      if (kind === 'caravan') {
        const [fx, fz] = pos(0, 0);
        ops.push([fx, GROUND, fz, B.campfire, META_STATE]);
      }
    } else {
      const [fx, fz] = pos(Math.max(0, tents - 1), 0);
      ops.push([fx, GROUND, fz, B.campfire, META_STATE]);
    }
    const [sx, sz] = pos(Math.max(0, tents - 1), -1);
    const camp = { key, sid: L.settlement.id, kind, ops, placed: 0, until, stand: { x: sx, z: sz }, out: at.out, struck: false, horses: [], wagons: [] };
    if (mounts.length) {
      // A hitching post, the horses round it, the wagons beyond.
      const [px, pz] = pos(base + 1, 1);
      ops.push([px, GROUND, pz, B.fence, 0]);
      const post = { x: px, y: GROUND, z: pz };
      const spots = [pos(base + 1, 0), pos(base + 1, 2), pos(base, 2), pos(base + 2, 2)];
      let h = 0;
      let wi = 0;
      for (const m of mounts) {
        const [hx, hz] = spots[h % spots.length];
        camp.horses.push({ key: `${key}:h${h}`, x: hx, z: hz, coat: m.coat || 0, banner: m.banner || null, post });
        h++;
        if (m.kind === 'wagon') {
          const [wx, wz] = pos(base + 3 + wi * 2, 1);
          camp.wagons.push({ key: `${key}:w${wi}`, x: wx, z: wz, face: 1, banner: m.banner || null });
          wi++;
        }
      }
    }
    this.list.push(camp);
    // Out of sight: it's simply up.
    if (!this.game.active.has(camp.sid)) this.raise(camp, camp.ops.length);
    return camp;
  }

  raise(camp, n) {
    const w = this.game.world;
    const ops = [];
    while (n-- > 0 && camp.placed < camp.ops.length) {
      const op = camp.ops[camp.placed++];
      // (Clear the grass and flowers off first.)
      if (w.regionAt(op[0], op[2]) && this.game.occupiedBySolid?.(op[0], op[1], op[2], null)) {
        camp.placed--;
        break;
      }
      ops.push(op);
    }
    if (ops.length) this.sim.setBlocks(ops);
  }

  // Down it comes (only what's still standing where they left it).
  strike(key) {
    const camp = this.get(key);
    if (!camp || camp.struck) return;
    camp.struck = true;
    const w = this.game.world;
    const ops = camp.ops.slice(0, camp.placed).filter(([x, y, z, id]) => !w.regionAt(x, z) || w.getBlock(x, y, z) === id).map(([x, y, z]) => [x, y, z, B.air, 0]);
    if (ops.length) this.sim.setBlocks(ops);
    this.list = this.list.filter((c) => c !== camp);
  }

  // Tents go up a piece at a time while one of the party is there; camps
  // whose people have gone come down.
  update(dt, members) {
    this.t -= dt;
    const step = this.t <= 0;
    if (step) this.t = PITCH_EVERY;
    const now = this.sim.abs;
    for (const camp of [...this.list]) {
      if (now >= camp.until) {
        this.strike(camp.key);
        continue;
      }
      if (camp.placed >= camp.ops.length || !step) continue;
      if (!this.game.active.has(camp.sid)) {
        this.raise(camp, camp.ops.length);
        continue;
      }
      const who = members ? members(camp) : [];
      const near = who.some((e) => e && !e.dead && Math.max(Math.abs(e.x - camp.stand.x), Math.abs(e.z - camp.stand.z)) <= 4);
      if (near) {
        const op = camp.ops[camp.placed];
        this.raise(camp, 1);
        const e = who.find((q) => q && !q.dead);
        if (e) {
          e.face(op[0], op[2]);
          e.doAction?.(0.3);
        }
        this.game.renderer.emit?.(op[0], GROUND, op[2], { n: 4, color: ['#c8b890', '#8a6a48'], up: 20, life: 0.4, oy: -6 });
      }
    }
  }

  serialize() {
    return this.list;
  }

  load(d) {
    this.list = Array.isArray(d) ? d : [];
  }
}

