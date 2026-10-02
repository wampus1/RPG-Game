// Portals (see tech.js). Every town of a realm that knows the art raises a
// stone arch on its square, its middle alight. Step up to one and you can
// go through to any other portal of the same realm (free for its citizens,
// ¤10 for anyone else); its merchants go through them too, and so do its
// armies, mustering at the portal nearest the fighting. A town taken by
// another realm is cut off from its old realm's portals: its arch goes
// dark (unless its new realm knows the art, when it joins theirs).
import { ledger } from './econ.js';
import { deserted } from './civic.js';
import { GROUND } from '../config.js';
import { B } from '../world/blocks.js';
import { M } from '../world/settlement.js';

export const PORTAL_COST = 200;
export const PORTAL_FARE = 10;

export class Portals {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.list = {}; // town id -> { sid, x, z, front, built, lit, project }
  }

  of(sid) {
    return this.list[sid] || null;
  }

  // Alight: built, and its town's realm knows the art.
  open(sid) {
    const q = this.list[sid];
    const s = this.game.world.ow.settlements[sid];
    return !!(q && q.built && s && s.civ && !deserted(s) && this.sim.tech.has(s, 'portals'));
  }

  // Where a portal of `sid` can take you: every other open portal of the
  // same realm.
  network(sid) {
    if (!this.open(sid)) return [];
    const ow = this.game.world.ow;
    const civ = ow.settlements[sid].civ;
    return Object.values(this.list).filter((q) => q.sid !== sid && this.open(q.sid) && ow.settlements[q.sid].civ === civ);
  }

  // Can someone go from one town to the other through the portals?
  linked(a, b) {
    return !!(a && b && a.id !== b.id && this.open(a.id) && this.open(b.id) && a.civ === b.civ);
  }

  // A spot on the square for the arch (clear of the statues and the stalls),
  // and the paving in front of it where you step out.
  site(L) {
    const p = L.plaza;
    if (!p) return null;
    const w = this.game.world;
    const taken = new Set((L.econ.statues || []).map((q) => `${q.x},${q.z}`));
    for (let r = 3; r <= 8; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = p.cx + dx;
          const z = p.cz + dz;
          if (L.maskAt(x, z) !== M.PLAZA || taken.has(`${x},${z}`)) continue;
          if (L.spots && L.spots.some && L.spots.some((q) => q.x === x && q.z === z)) continue;
          if (w.regionAt(x, z) && (w.getBlock(x, GROUND, z) !== B.air || w.getBlock(x, GROUND + 1, z) !== B.air || this.game.entityAt?.(x, GROUND, z))) continue;
          // (Facing the middle of the square, with room to step out.)
          const fx = x - Math.sign(dx) * (Math.abs(dx) >= Math.abs(dz) ? 1 : 0);
          const fz = z - Math.sign(dz) * (Math.abs(dz) > Math.abs(dx) ? 1 : 0);
          if (L.maskAt(fx, fz) !== M.PLAZA) continue;
          return { x, z, front: { x: fx, z: fz } };
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------ daily
  daily(L, day) {
    const s = L.settlement;
    const q = this.list[s.id];
    if (q && q.built) return this.relight(q);
    if (deserted(s) || s.condition === 'abandoned' || !s.civ || !this.sim.tech.has(s, 'portals')) return null;
    // Raised by the builders: done?
    if (q && q.project !== undefined) {
      const p = this.sim.works.projects.find((x) => x.id === q.project);
      if (p && !p.done) return null;
      q.built = true;
      q.lit = null;
      this.relight(q);
      const n = this.network(s.id).length;
      ledger(L, day, `The portal on ${s.name}'s square is finished and alight${n ? `: from it, ${n === 1 ? 'one other town of the realm is' : `${n} other towns of the realm are`} a step away` : ''}.`);
      return { built: q };
    }
    // The capital's first; then the others, as they can afford it.
    if (L.econ.treasury < PORTAL_COST + 30) return null;
    const cap = this.sim.realms.capitalOf(s.civ);
    if (cap && cap.id !== s.id && !(this.list[cap.id] && this.list[cap.id].built)) return null;
    const at = this.site(L);
    if (!at) return null;
    L.econ.treasury -= PORTAL_COST;
    L.setMask(at.x, at.z, M.DECOR);
    const p = this.sim.works.add({ sid: s.id, kind: 'portal', blocks: [[at.x, GROUND, at.z, B.portal_dark, 0]], bounds: { x0: at.x, z0: at.z, x1: at.x, z1: at.z }, bid: L.buildings.length - 0.1, label: 'raising a portal on the square' });
    this.list[s.id] = { sid: s.id, x: at.x, z: at.z, front: at.front, built: false, lit: false, project: p.id, day };
    ledger(L, day, `${s.name} has paid ¤${PORTAL_COST} to raise a portal on its square, like the others of the realm.`);
    return { started: p };
  }

  // Alight, or dark: as its realm (and the art) allow.
  relight(q) {
    const lit = this.open(q.sid);
    if (q.lit === lit) return null;
    q.lit = lit;
    this.sim.setBlocks([[q.x, GROUND, q.z, lit ? B.portal : B.portal_dark, 0]]);
    if (this.game.active.has(q.sid)) {
      this.game.renderer?.emit(q.x + 0.5, GROUND + 1, q.z + 0.5, { n: 16, color: lit ? ['#c080ff', '#80c0ff', '#ffffff'] : ['#3a3448', '#5a5068'], up: 30, speed: 30, life: 0.9, gravity: lit ? -10 : 20 });
    }
    return lit;
  }

  // A town under a new banner: its portal joins the new realm's (if it knows
  // the art), and is cut off from the old one's.
  changeHands(s, old, day) {
    const q = this.list[s.id];
    if (!q || !q.built) return null;
    const lit = this.relight(q);
    const L = this.sim.layoutOf(s.id);
    if (L && L.econ && lit === false) ledger(L, day, `The portal on ${s.name}'s square has gone dark: its other ends belong to the ${old ? old.name.replace(/^The /, '') : 'old realm'}.`);
    if (old) {
      for (const o of Object.values(this.list)) {
        if (o.sid === s.id || !this.open(o.sid) || this.game.world.ow.settlements[o.sid].civ !== old) continue;
        const OL = this.sim.layoutOf(o.sid);
        if (OL && OL.econ) ledger(OL, day, `The portal to ${s.name} is closed: the town is in other hands now.`);
      }
    }
    return lit;
  }

  // Through a portal (you): out in front of the other one, a fare paid if
  // you're not of the realm.
  fareFor(sid) {
    const c = this.sim.citizen;
    const home = c ? this.game.world.ow.settlements[c.sid] : null;
    const s = this.game.world.ow.settlements[sid];
    return home && s && home.civ && home.civ === s.civ ? 0 : PORTAL_FARE;
  }

  // ------------------------------------------------------------ save
  serialize() {
    return { list: this.list };
  }

  load(d) {
    this.list = (d && d.list) || {};
  }
}

