// Stables: a town's horses and wagons. An animal handler tames wild horses
// (one now and then, up to what the town can keep); a carpenter builds
// wagons when there's timber and coin. The town's merchants and anyone
// travelling take them out on the road (a horse to ride, or a wagon and a
// horse to pull it) and bring them home again. At home the horses stand
// tied to a hitching post by the road in, with the wagons beside them.
import { alive, ledger, stockOf } from './econ.js';
import { retrain } from '../entities/npcgen.js';
import { GROUND } from '../config.js';
import { B } from '../world/blocks.js';
import { RNG, hash4 } from '../util/rng.js';

const CAP = { village: { horses: 2, wagons: 1 }, town: { horses: 4, wagons: 2 }, city: { horses: 6, wagons: 3 } };
// Who can be spared to mind the horses: a labourer, or one of several in
// the same line of work.
const SPARE = { laborer: 1, farmer: 3, fisher: 3, trapper: 3, lumberjack: 3, merchant: 2 };

export class Stables {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
  }

  // The town's stable (set up the first time it's asked for).
  of(L) {
    const e = L.econ;
    if (!e.stable) {
      const s = L.settlement;
      const h = hash4(s.seed, 0x5ab1e);
      e.stable = {
        horses: s.type === 'city' ? 2 : s.type === 'town' ? 1 : h % 3 === 0 ? 1 : 0,
        wagons: s.type === 'city' ? 1 : 0,
        horsesOut: 0,
        wagonsOut: 0,
      };
    }
    return e.stable;
  }

  cap(L) {
    return CAP[L.settlement.type] || CAP.village;
  }

  // Daily: the handler brings in a horse; the carpenter builds a wagon; a
  // town keeping horses without anyone to mind them takes someone on.
  daily(L, day, rng) {
    const s = L.settlement;
    if (s.deserted || s.condition === 'abandoned') return null;
    const st = this.of(L);
    const people = L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor);
    const handler = people.find((r) => r.job === 'handler');
    const cap = this.cap(L);
    if (!handler) {
      if (s.type === 'village' && !st.horses) return null;
      const many = (job) => people.filter((q) => q.job === job && q.age === 'adult').length;
      const pick = people.filter((r) => r.age === 'adult' && SPARE[r.job] && many(r.job) >= SPARE[r.job] && !r.trip?.phase?.startsWith('away'))[0];
      if (!pick || !rng.chance(0.3)) return null;
      retrain(L, pick, 'handler', new RNG(hash4(pick.idx, day, 0x4a4d)));
      if (pick.ent && !pick.ent.dead) {
        pick.ent.look = pick.look;
        pick.ent.activity = null;
      }
      ledger(L, day, `${pick.name.first} ${pick.name.last} took on the town's horses as its animal handler.`);
      return { hired: pick };
    }
    let out = null;
    if (st.horses < cap.horses && rng.chance(0.25)) {
      st.horses++;
      ledger(L, day, `${handler.name.first} ${handler.name.last} caught and broke in a wild horse. ${s.name} keeps ${st.horses} now.`);
      out = { horse: true };
    }
    const carp = people.find((r) => r.job === 'carpenter');
    const k = stockOf(L);
    if (carp && st.wagons < Math.min(cap.wagons, Math.ceil(st.horses / 2)) && k.wood >= 10 && L.econ.treasury >= 40 && rng.chance(0.2)) {
      st.wagons++;
      k.wood -= 10;
      L.econ.treasury -= 25;
      ledger(L, day, `${carp.name.first} ${carp.name.last} built a wagon for the town.`);
      out = { ...(out || {}), wagon: true };
    }
    return out;
  }

  // Take what's free for a trip: a wagon and a horse to pull it (for
  // someone carrying goods, when there's one), or a horse to ride.
  take(L, want = 'wagon') {
    const st = this.of(L);
    const horses = st.horses - st.horsesOut;
    const wagons = st.wagons - st.wagonsOut;
    if (horses <= 0) return null;
    const coat = hash4(L.settlement.seed, st.horsesOut, 0xc0a7) % 6;
    if (want === 'wagon' && wagons > 0) {
      st.horsesOut++;
      st.wagonsOut++;
      return { kind: 'wagon', coat, from: L.settlement.id };
    }
    st.horsesOut++;
    return { kind: 'horse', coat, from: L.settlement.id };
  }

  giveBack(mount) {
    if (!mount || mount.from === undefined) return;
    const L = this.game.world.layouts.get(mount.from);
    if (!L || !L.econ) return;
    const st = this.of(L);
    st.horsesOut = Math.max(0, st.horsesOut - 1);
    if (mount.kind === 'wagon') st.wagonsOut = Math.max(0, st.wagonsOut - 1);
  }

  // Where the town's horses stand: a hitching post by the road in, just
  // inside the town (put up the first time it's needed).
  hitch(L) {
    const e = L.econ;
    if (e.hitch) return e.hitch;
    const w = this.game.world;
    const ents = L.entrances && L.entrances.length ? L.entrances : [{ x: L.plaza.cx, z: L.plaza.cz }];
    const clear = (x, z) => !L.isRoadTile(x, z) && L.inside(x, z, 1) && (!w.regionAt(x, z) || (w.getBlock(x, GROUND, z) === B.air && w.getBlock(x, GROUND + 1, z) === B.air));
    for (const en of ents) {
      for (let r = 2; r <= 6; r++) {
        for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, 2], [-r, 2], [2, r], [2, -r]]) {
          const x = en.x + dx;
          const z = en.z + dz;
          if (!clear(x, z) || !clear(x + 1, z) || !clear(x, z + 1)) continue;
          if (L.buildings.some((b) => x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1)) continue;
          e.hitch = { x, y: GROUND, z };
          this.sim.setBlocks([[x, GROUND, z, B.fence, 0]]);
          return e.hitch;
        }
      }
    }
    return null;
  }

  // What stands at the hitching post now: horses (tied) and wagons.
  standing(L) {
    const st = this.of(L);
    const horses = Math.max(0, st.horses - st.horsesOut);
    const wagons = Math.max(0, st.wagons - st.wagonsOut);
    if (!horses && !wagons) return null;
    const post = this.hitch(L);
    if (!post) return null;
    const out = { horses: [], wagons: [] };
    const around = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < Math.min(horses, 4); i++) {
      const [dx, dz] = around[i];
      out.horses.push({ key: `town:${L.settlement.id}:h${i}`, x: post.x + dx, z: post.z + dz, coat: hash4(L.settlement.seed, i, 0xc0a7) % 6, post });
    }
    for (let i = 0; i < Math.min(wagons, 2); i++) out.wagons.push({ key: `town:${L.settlement.id}:w${i}`, x: post.x + 2 + i * 2, z: post.z + 2, face: 1 });
    return out;
  }
}
