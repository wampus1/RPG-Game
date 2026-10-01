// Stables: a town's horses and wagons. An animal handler tames wild horses
// (one now and then, up to what the town can keep); a carpenter builds
// wagons when there's timber and coin. The town's merchants and anyone
// travelling take them out on the road (a horse to ride, or a wagon and a
// horse to pull it) and bring them home again. At home the horses stand in
// their stalls in the town's stables (tied to a hitching post by the road
// in, till it has some), with the wagons out front.
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
    // Horses enough to want a proper roof over them: the town builds stables.
    if (st.horses >= 2 && !this.stablesOf(L, true) && L.econ.treasury >= 200 && rng.chance(0.2) && !this.sim.works.projects.some((p) => !p.done && p.sid === s.id && p.type === 'stables')) {
      const p = this.sim.works.startBuilding(L, 'stables', ', for the town\'s horses', false, 140);
      if (p) {
        L.econ.treasury -= 140;
        out = { stables: p };
      }
    }
    if (st.horses < cap.horses && rng.chance(0.25)) {
      st.horses++;
      ledger(L, day, `${handler.name.first} ${handler.name.last} caught and broke in a wild horse. ${s.name} keeps ${st.horses} now.`);
      out = { horse: true };
    }
    // A saddle for a horse that hasn't one (leather from the stores, or
    // bought in).
    if ((st.saddled || 0) < st.horses && rng.chance(0.5)) {
      const k0 = stockOf(L);
      if ((k0.leather || 0) >= 2) k0.leather -= 2;
      else if (L.econ.treasury >= 20) L.econ.treasury -= 12;
      else return out;
      st.saddled = (st.saddled || 0) + 1;
      ledger(L, day, `${handler.name.first} ${handler.name.last} saddled one of the town's horses.`);
      out = { ...(out || {}), saddled: true };
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
    const saddle = (st.saddled || 0) > st.horsesOut;
    if (want === 'wagon' && wagons > 0) {
      st.horsesOut++;
      st.wagonsOut++;
      return { kind: 'wagon', coat, from: L.settlement.id, saddle };
    }
    st.horsesOut++;
    return { kind: 'horse', coat, from: L.settlement.id, saddle };
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

  // The town's stables (built and finished), if it has them.
  stablesOf(L, any = false) {
    return L.buildings.find((b) => b.type === 'stables' && (any || (!b.underConstruction && b.stalls && b.stalls.length))) || null;
  }

  // What stands where now: horses in their stalls (or tied at the hitching
  // post) and the wagons.
  standing(L) {
    const st = this.of(L);
    const horses = Math.max(0, st.horses - st.horsesOut);
    const wagons = Math.max(0, st.wagons - st.wagonsOut);
    if (!horses && !wagons) return null;
    // Each horse keeps its own place (a stall, or a spot at the post), so
    // one taken out by a townsperson leaves a gap rather than everyone
    // shuffling along.
    const lent = new Set(st.lent || []);
    const idx = [];
    for (let i = 0; idx.length < horses && i < st.horses + lent.size + 2; i++) if (!lent.has(i)) idx.push(i);
    const sb = this.stablesOf(L);
    const stalls = sb ? sb.stalls.length : 0;
    const post = idx.some((i) => i >= stalls) || (!sb && wagons) ? this.hitch(L) : null;
    const out = { horses: [], wagons: [] };
    const around = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]];
    const saddled = st.saddled || 0;
    for (const i of idx) {
      const base = { key: `town:${L.settlement.id}:h${i}`, coat: hash4(L.settlement.seed, i, 0xc0a7) % 6, idx: i, town: L.settlement.id, saddled: i < saddled };
      if (i < stalls) {
        const q = sb.stalls[i];
        out.horses.push({ ...base, x: q.x, z: q.z, post: { x: q.x, y: GROUND, z: q.z }, stall: true });
      } else if (post && i - stalls < around.length) {
        const [dx, dz] = around[i - stalls];
        out.horses.push({ ...base, x: post.x + dx, z: post.z + dz, post });
      }
    }
    if (sb) {
      const o = sb.outside;
      const DX = [0, -1, 0, 1];
      const DZ = [1, 0, -1, 0];
      const side = [DZ[sb.door.rot], DX[sb.door.rot]];
      for (let i = 0; i < Math.min(wagons, 2); i++) out.wagons.push({ key: `town:${L.settlement.id}:w${i}`, x: o.x + side[0] * (3 + i * 3), z: o.z + side[1] * (3 + i * 3), face: 1 });
    } else if (post) for (let i = 0; i < Math.min(wagons, 2); i++) out.wagons.push({ key: `town:${L.settlement.id}:w${i}`, x: post.x + 2 + i * 2, z: post.z + 2, face: 1 });
    return out.horses.length || out.wagons.length ? out : null;
  }

  // A citizen takes one of the town's horses out (and brings it back).
  lend(L, i) {
    const st = this.of(L);
    st.lent = [...new Set([...(st.lent || []), i])];
    st.horsesOut++;
  }

  giveBackLent(L, i) {
    const st = this.of(L);
    if (!(st.lent || []).includes(i)) return;
    st.lent = st.lent.filter((q) => q !== i);
    st.horsesOut = Math.max(0, st.horsesOut - 1);
  }
}
