// The Ancient Technology Tree: what a realm can learn from the Kavorent's
// cores. Each core given to a mayor goes into the realm's store (a free
// town keeps its own); the arts themselves cost cores, more for the
// greater, and each changes the realm's towns in ways you can see:
//
//   Growth Lattice    fields under light lattices grow twice as fast
//   Coldfire Lamps    cold lamps light the streets all night; nothing of the
//                     night is born within a wide ring of the town
//   Glyph Archive     the scholars read the Kavorent's records: ordinary
//                     study goes twice as fast
//   Alloy Forge       guards' blades take alloy edges, smiths sell them;
//                     armies are a fifth stronger
//   Mending Spring    a basin of mending light by the town's well (wounds
//                     close beside it; the sick get better)
//   Ward Pylons       pylons round the town strike down whatever hostile
//                     thing comes near with an arc of light
//   Kavorent Panoply  every guard of the realm in Kavorent carapace and
//                     visor (and the watch nearly unbreakable)
//   Storm Engine      battles fought by the realm open with lightning
//                     falling on the enemy line; armies a third stronger
//   Skyward Beacon    a pillar of light from the capital into the sky:
//                     trade, settlers and coin flock to the realm
//
// The realm's rulers choose for themselves when they have the cores; or
// you can put the matter to a mayor (see the Ancient Technology view of
// the tree, ui/ancient.js).
import { B } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { ITEMS, canEnhance, enhanced } from '../world/items.js';
import { ledger } from './econ.js';

// pos: where it sits in the tree's ring (angle in degrees, ring 1-3).
export const ANCIENT = {
  lattice: { name: 'Growth Lattice', cost: 1, req: [], ring: 1, ang: 200, glyph: 0, desc: 'Lattices of alloy rise over every field, shedding a faint warm light: crops in the realm\'s towns grow twice as fast.' },
  lamps: { name: 'Coldfire Lamps', cost: 1, req: [], ring: 1, ang: 290, glyph: 1, desc: 'Cold lamps that never go out stand along the streets of every town. Nothing of the night is born within a wide ring of a lit town.' },
  archive: { name: 'Glyph Archive', cost: 1, req: [], ring: 1, ang: 20, glyph: 2, desc: 'A glyph console in each town hall: the scholars read the Kavorent\'s own records. The realm\'s ordinary learning goes twice as fast.' },
  forge: { name: 'Alloy Forge', cost: 2, req: [], ring: 1, ang: 110, glyph: 3, desc: 'The smiths learn to work Kavorent alloy. Every guard\'s blade takes an alloy edge (+3 to each blow), smiths sell edged swords, and the realm\'s armies are a fifth stronger.' },
  spring: { name: 'Mending Spring', cost: 2, req: ['lattice'], ring: 2, ang: 200, glyph: 4, desc: 'A basin of mending light by each town\'s well. Stand beside it and your wounds close; townsfolk who fall sick are soon well.' },
  wards: { name: 'Ward Pylons', cost: 2, req: ['lamps'], ring: 2, ang: 290, glyph: 5, desc: 'Pylons stand round each town. Whatever hostile thing comes near (beasts, the dead, raiders) is struck by an arc of light.' },
  panoply: { name: 'Kavorent Panoply', cost: 3, req: ['forge'], ring: 2, ang: 110, glyph: 0, desc: 'Every guard of the realm goes in Kavorent carapace and visor: their armour turns nearly half of every blow.' },
  storm: { name: 'Storm Engine', cost: 3, req: ['panoply'], ring: 3, ang: 110, glyph: 2, desc: 'A Kavorent engine that calls the lightning. The realm\'s battles open with bolts falling on the enemy line, and its armies are a third stronger.' },
  beacon: { name: 'Skyward Beacon', cost: 4, req: ['wards', 'archive'], ring: 3, ang: 330, glyph: 1, desc: 'A pillar of light from the capital to the sky, seen for days around. Merchants and settlers flock to the realm: its towns\' takings rise by a fifth, and its people are prouder.' },
};
export const ANCIENT_IDS = Object.keys(ANCIENT);

export class Ancient {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.state = {};
    // Where the springs and pylons stand in each town (by settlement id).
    this.places = {};
  }

  placesOf(L) {
    return (this.places[L.settlement.id] ||= { springs: [], pylons: [] });
  }

  key(s) {
    return this.sim.tech.keyOf(s);
  }

  stateOf(s) {
    const k = this.key(s);
    if (!k) return null;
    if (!this.state[k]) this.state[k] = { cores: 0, given: 0, done: [], log: [] };
    return this.state[k];
  }

  has(s, id) {
    const st = s && this.state[this.key(s)];
    return !!st && st.done.includes(id);
  }

  ready(st, id) {
    return !st.done.includes(id) && ANCIENT[id].req.every((r) => st.done.includes(r));
  }

  // Cores brought to a town (by you, or by adventurers): into the realm's
  // store.
  addCores(L, n, by = null) {
    const st = this.stateOf(L.settlement);
    if (!st) return;
    st.cores += n;
    st.given += n;
    if (by === 'you') st.byYou = (st.byYou || 0) + n;
    if (by) ledger(L, this.game.day, `${by === 'you' ? this.game.playerName : by} brought ${n === 1 ? 'a Kavorent core' : `${n} Kavorent cores`} to ${L.settlement.name}. The realm has ${st.cores} to study now.`);
  }

  // Commission one (if there are the cores for it). `who`: who asked.
  buy(s, id, who = null) {
    const st = this.stateOf(s);
    const A = ANCIENT[id];
    if (!st || !A || !this.ready(st, id) || st.cores < A.cost) return false;
    st.cores -= A.cost;
    st.done.push(id);
    st.log.push({ id, day: this.game.day, who });
    const towns = this.townsOf(s);
    const realm = s.civ ? s.civ.name : s.name;
    const text = `${realm} has mastered the Kavorent's ${A.name.toLowerCase()}${who ? `, at the urging of ${who}` : ''}. ${A.desc.split('.')[0]}.`;
    for (const t of towns) {
      const L = this.sim.layoutOf(t.id);
      if (!L || !L.econ) continue;
      ledger(L, this.game.day, text);
      this.apply(L, id);
    }
    const here = this.game.currentSettlement;
    if (here && towns.includes(here)) {
      this.game.ui.msg(text, '#7ae0ff');
      this.game.audio?.play('rune');
      this.game.renderer.flashScreen?.('#c8fbff', 0.25);
    }
    return true;
  }

  townsOf(s) {
    if (s.civ) return this.sim.realms.members(s.civ);
    return [s];
  }

  // What learning it puts up in a town (or changes in its people).
  apply(L, id) {
    const ops = [];
    const put = (x, z, block) => {
      if (L.maskAt(x, z) !== M.FREE && L.maskAt(x, z) !== M.DECOR && L.maskAt(x, z) !== M.YARD) return false;
      if (L.buildings.some((b) => x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1)) return false;
      ops.push([x, 6, z, block, 0]);
      return true;
    };
    if (id === 'lattice') {
      for (const f of L.fields || []) for (const [x, z] of [[f.x0 - 1, f.z0 - 1], [f.x1 + 1, f.z1 + 1]]) ops.push([x, 6, z, B.kav_lamp, 0, 'air']);
    } else if (id === 'lamps') {
      // Along the streets at the roadside, six paces or so apart.
      const lit = [];
      const b = L.bounds;
      for (let z = b.z0 + 1; z <= b.z1 - 1 && lit.length < 24; z++) {
        for (let x = b.x0 + 1; x <= b.x1 - 1 && lit.length < 24; x++) {
          if (L.isRoadTile(x, z) || lit.some((q) => Math.max(Math.abs(q.x - x), Math.abs(q.z - z)) < 6)) continue;
          if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => L.isRoadTile(x + dx, z + dz))) continue;
          if (put(x, z, B.kav_lamp)) lit.push({ x, z });
        }
      }
    } else if (id === 'archive') {
      const hall = L.buildings.find((q) => q.type === 'townhall');
      if (hall && hall.inside) ops.push([hall.inside.x, 6, hall.inside.z - 1, B.kav_console, 0, true]);
    } else if (id === 'spring') {
      for (const w of (L.wells || []).slice(0, 2)) {
        for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
          if (L.isRoadTile(w.x + dx, w.z + dz) && L.maskAt(w.x + dx, w.z + dz) !== M.PLAZA) continue;
          ops.push([w.x + dx, 6, w.z + dz, B.kav_basin, 0, 'air']);
          this.placesOf(L).springs.push({ x: w.x + dx, z: w.z + dz });
          break;
        }
      }
      if (!this.placesOf(L).springs.length && L.plaza) {
        ops.push([L.plaza.x0, 6, L.plaza.z0, B.kav_basin, 0, 'air']);
        this.placesOf(L).springs.push({ x: L.plaza.x0, z: L.plaza.z0 });
      }
    } else if (id === 'wards') {
      // At the corners and the middles of the town's edge.
      const b = L.bounds;
      const mx = Math.round((b.x0 + b.x1) / 2);
      const mz = Math.round((b.z0 + b.z1) / 2);
      const pl = this.placesOf(L);
      pl.pylons = [];
      for (const [x, z] of [[b.x0 + 1, b.z0 + 1], [b.x1 - 1, b.z0 + 1], [b.x0 + 1, b.z1 - 1], [b.x1 - 1, b.z1 - 1], [mx + 3, b.z0 + 1], [mx + 3, b.z1 - 1], [b.x0 + 1, mz + 3], [b.x1 - 1, mz + 3]]) {
        for (let k = 0; k < 4; k++) {
          const xx = x + (k % 2) * (x < mx ? 1 : -1);
          const zz = z + Math.floor(k / 2) * (z < mz ? 1 : -1);
          if (put(xx, zz, B.kav_pylon)) {
            pl.pylons.push({ x: xx, z: zz });
            break;
          }
        }
      }
    } else if (id === 'forge' || id === 'panoply') {
      this.equipGuards(L);
    }
    if (ops.length) this.sim.setBlocks(ops);
  }

  // The watch kitted out as the realm's learning allows.
  equipGuards(L) {
    const s = L.settlement;
    for (const r of L.npcs) {
      if (r.job !== 'guard' || r.alive === false) continue;
      const eq = r.equipment;
      if (this.has(s, 'forge') && eq.tool && canEnhance(eq.tool, 'edge')) {
        const k = enhanced(eq.tool, 'edge');
        if (ITEMS[k]) {
          for (const it of eq.items || []) if (it.item === eq.tool) it.item = k;
          eq.tool = k;
        }
      }
      if (this.has(s, 'panoply')) {
        eq.armor = Math.max(eq.armor || 0, 0.45);
        r.look = { ...r.look, gear: { ...(r.look.gear || {}), body: 'kav', head: 'kav' }, hat: 'kav' };
      }
    }
  }

  // How much stronger the realm's soldiers are.
  power(s) {
    let p = 1;
    if (this.has(s, 'forge')) p *= 1.2;
    if (this.has(s, 'storm')) p *= 1.33;
    return p;
  }

  // A town's takings, with the Beacon over its realm.
  income(s) {
    return this.has(s, 'beacon') ? 1.2 : 1;
  }

  // Once a day in each town: the realm's rulers (at its capital, or a free
  // town's own council) choose an art if they have the cores; new guards
  // are kitted out; the sick by a mending spring get well; and under the
  // Beacon, merchants come with coin.
  townDay(L, day, rng) {
    const s = L.settlement;
    const st = this.state[this.key(s)];
    if (!st) return;
    if (st.cores > 0 && (!s.civ || this.sim.realms.isCapital(s))) {
      const open = ANCIENT_IDS.filter((id) => this.ready(st, id) && ANCIENT[id].cost <= st.cores);
      if (open.length && rng.chance(0.35)) this.buy(s, rng.pick(open));
    }
    if (this.has(s, 'forge') || this.has(s, 'panoply')) this.equipGuards(L);
    if (this.has(s, 'spring')) for (const r of L.npcs) if (r.sick) r.sick = 0;
    if (this.has(s, 'beacon')) L.econ.treasury += Math.round(4 + L.npcs.length * 0.25);
  }

  ownerOf(k) {
    const ow = this.game.world.ow;
    if (k.startsWith('c')) {
      const id = +k.slice(1);
      const civ = ow.civs.find((c) => c.id === id);
      if (civ) return this.sim.realms.members(civ)[0] || null;
      return ow.settlements[id] || null;
    }
    return ow.settlements[+k.slice(1)] || null;
  }

  // ------------------------------------------------------------ in sight
  // Each frame in an active town: pylons strike, springs mend.
  update(dt) {
    const game = this.game;
    this.t = (this.t || 0) - dt;
    if (this.t > 0) return;
    this.t = 0.5;
    const p = game.player;
    for (const { layout: L } of game.active.values()) {
      const s = L.settlement;
      if (this.has(s, 'spring') && p && !p.dead) {
        for (const q of this.placesOf(L).springs) {
          if (Math.abs(p.x - q.x) > 2 || Math.abs(p.z - q.z) > 2) continue;
          L.springAcc = (L.springAcc || 0) + 0.5;
          if (L.springAcc >= 2 && p.hp < p.maxHp) {
            L.springAcc = 0;
            p.hp = Math.min(p.maxHp, p.hp + 1);
            game.renderer.floatText(p.x, p.y + 2, p.z, '+1', '#7ae0ff');
            game.renderer.emit(p.x, p.y + 0.8, p.z, { n: 5, color: ['#a8f4ff', '#ffffff'], up: 18, speed: 8, gravity: -10, life: 0.8, glow: true });
          }
        }
      }
      if (this.has(s, 'wards')) {
        L.wardT = (L.wardT || 0) - 0.5;
        if (L.wardT > 0) continue;
        for (const py of this.placesOf(L).pylons) {
          const hostile = (e) => (e.kind === 'creature' || e.kind === 'monster' ? e.S.mode === 'hostile' && !e.tame : !!(e.hostileNow && (e.bandit || (e.warband && e.rec && e.rec.sid !== s.id))));
          const foe = [...game.creatures, ...game.npcs].find((e) => !e.dead && !e.down && Math.abs(e.x - py.x) <= 7 && Math.abs(e.z - py.z) <= 7 && hostile(e));
          if (!foe) continue;
          L.wardT = 1.5;
          game.dotHit = true;
          game.damage(foe, 6, null);
          game.dotHit = false;
          game.renderer.effect?.({ type: 'beam', wx: py.x, wy: 8, wz: py.z, tx: foe.x, ty: foe.y + 1, tz: foe.z, life: 0.3, oy: -8, color: '#c8fbff', halo: '#5ad8f0', width: 2 });
          game.renderer.emit(foe.x, foe.y + 1, foe.z, { n: 8, color: ['#c8fbff', '#5ad8f0', '#ffffff'], up: 24, speed: 40, life: 0.4, glow: true });
          game.audio?.play('beam', foe);
        }
      }
    }
  }

  // Where the Beacons stand (each realm's capital that has one).
  beacons() {
    const out = [];
    for (const [k, st] of Object.entries(this.state)) {
      if (!st.done.includes('beacon')) continue;
      const s = this.ownerOf(k);
      const cap = s && s.civ ? this.sim.realms.capitalOf(s.civ) : s;
      const L = cap && this.game.world.layouts.get(cap.id);
      if (L && L.plaza) out.push({ x: L.plaza.cx, z: L.plaza.cz, s: cap });
    }
    return out;
  }

  serialize() {
    return { state: this.state, places: this.places };
  }

  load(d) {
    this.state = (d && d.state) || {};
    this.places = (d && d.places) || {};
  }
}
