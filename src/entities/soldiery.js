// (Round 144) A soldier in a band (see sim/bands.js), moment to moment:
// in their place in the ranks, facing the enemy, until their band's order
// takes them on or back; whoever comes within reach of their place, they
// fight (the weak and the already-wounded first, one already beset by two
// of their own left to them; round the side of one locked with a friend,
// rather than queueing behind); bows loosed at the band their captain
// points at, a step back from anyone who gets close; badly hurt, back
// through the ranks to bind the wound, and in again (or off the field, if
// it won't stop). On the move they walk the straight way there, a step at
// a time, round whoever's in the way, and only ask the long way round
// when the straight way's barred: so a hundred of them can be about at
// once.
import { ITEMS, ammoOf } from '../world/items.js';
import { inReach, styleOf } from '../game/combat.js';
import { ORDERS, slotAt, foesNear, standing, bandOf } from '../sim/bands.js';
import { strike, leave, goTo } from './warrior.js';

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const tileKey = (x, z) => ((x & 0xffff) << 16) | (z & 0xffff);

// The tile someone's on, or stepping onto, claimed: no two of a battle on
// one tile (they'd stand in each other).
function claim(L, n, x, z) {
  const m = (L.claims ||= new Map());
  if (n.claimK !== undefined && m.get(n.claimK) === n) m.delete(n.claimK);
  const k = tileKey(x, z);
  m.set(k, n);
  n.claimK = k;
}
function taken(L, n, x, z) {
  const e = L.claims && L.claims.get(tileKey(x, z));
  return !!e && e !== n && !e.dead && !e.down && e.claimK === tileKey(x, z) && (e.x === x && e.z === z);
}
export function unclaim(L, n) {
  if (L.claims && n.claimK !== undefined && L.claims.get(n.claimK) === n) L.claims.delete(n.claimK);
  n.claimK = undefined;
}

// A step toward (gx, gz): the straight way if it can, else round whoever
// or whatever's in it; held up long enough, the long way round. True once
// there. `pace`: how long a step takes, as a share of their walk.
export function stepToward(n, L, gx, gz, pace = 1, near = 0) {
  if (n.moving) return false;
  const d = cheb(n, { x: gx, z: gz });
  if (d <= near) return true;
  const g = n.game;
  const w = g.world;
  const wb = n.warband;
  // (Following a found way round: on along it.)
  if (n.path && n.pathI < n.path.length && wb.detour && wb.detour.x === gx && wb.detour.z === gz) {
    n.followPath({ x: gx, y: n.y, z: gz }, near, { x0: Math.min(n.x, gx) - 10, z0: Math.min(n.z, gz) - 10, x1: Math.max(n.x, gx) + 10, z1: Math.max(n.z, gz) + 10, nodes: 900 });
    return false;
  }
  const dx = Math.sign(gx - n.x);
  const dz = Math.sign(gz - n.z);
  const ax = Math.abs(gx - n.x);
  const az = Math.abs(gz - n.z);
  // (The longer way first, the other when it's no further: a slant made
  // of steps.)
  const tries = [];
  if (ax >= az) {
    if (dx) tries.push([dx, 0]);
    if (dz) tries.push([0, dz]);
  } else {
    if (dz) tries.push([0, dz]);
    if (dx) tries.push([dx, 0]);
  }
  // (And sideways round something in the way, if it gets no further off.)
  if (!dx) tries.push([1, 0], [-1, 0]);
  else if (!dz) tries.push([0, 1], [0, -1]);
  const ride = n.mount ? 0.65 : 1;
  for (const [ox, oz] of tries) {
    const nx = n.x + ox;
    const nz = n.z + oz;
    if (taken(L, n, nx, nz)) continue;
    const ty = w.stepTarget(n.x, n.y, n.z, nx, nz, true);
    if (ty < 0 || Math.abs(ty - n.y) > 1) continue;
    if (w.isWaterAt(nx, ty, nz) && w.isWaterAt(nx, ty - 1, nz)) continue;
    if (g.occupiedBySolid(nx, ty, nz, n, true)) continue;
    // (Sideways only if it's no further from where they're going.)
    if (cheb({ x: nx, z: nz }, { x: gx, z: gz }) > d) continue;
    n.face(nx, nz);
    claim(L, n, nx, nz);
    n.startMove(nx, ty, nz, n.step * pace * ride * (w.isWaterAt(nx, ty, nz) ? 1.8 : 1));
    wb.held = 0;
    return false;
  }
  // Barred: a moment, then the long way round.
  wb.held = (wb.held || 0) + (g.dt || 0.016);
  if (wb.held > 0.9 && d > 1) {
    wb.held = 0;
    wb.detour = { x: gx, z: gz };
    n.path = null;
    n.followPath({ x: gx, y: n.y, z: gz }, near, { x0: Math.min(n.x, gx) - 10, z0: Math.min(n.z, gz) - 10, x1: Math.max(n.x, gx) + 10, z1: Math.max(n.z, gz) + 10, nodes: 900 });
  }
  return false;
}

// Has a bow and something to loose from it?
function bowOf(n) {
  const bw = n.rec.equipment.items.find((i) => ITEMS[i.item]?.ranged);
  return bw && (n.rec.inv || []).some((q) => q && q.item === ammoOf(bw.item) && q.count > 0) ? bw.item : null;
}

// Who of the enemy to go for, and where to stand to strike them.
function think(n, wb, L, b) {
  const kind = b.order.kind;
  const O = ORDERS[kind] || ORDERS.hold;
  const i = b.slots ? b.slots.get(n) ?? 0 : 0;
  const slot = slotAt(b, i);
  wb.slotAt = slot;
  wb.form = slot;
  let leash = O.leash;
  if (b.state === 'waver') leash = Math.min(leash, 2);
  if (b.role === 'horse' && kind === 'charge') leash = 40;
  const charge = kind === 'charge';
  const bow = wb.bow === undefined ? (wb.bow = bowOf(n)) : wb.bow;
  const from = charge ? n : slot;
  const R = charge ? 16 : bow && (kind === 'loose' || kind === 'hold') ? 10 : leash + 3;
  const near = foesNear(L, wb.side, from.x, from.z, R, 10);
  let best = null;
  let bs = Infinity;
  const tb = b.order.target ? bandOf(L, b.order.target) : null;
  for (const { n: q } of near) {
    if (q.warband && q.warband.phase === 'flee' && !charge) continue;
    let s = cheb(n, q);
    // (Already beset by three of theirs: leave them to it.)
    const on = L.attackers ? L.attackers.get(q) || 0 : 0;
    if (on >= 3 && s > 1) s += 2.5;
    // (The wounded, and whoever's at a friend.)
    if (q.hp / Math.max(1, q.maxHp) < 0.35) s -= 1.2;
    if (q.threat && q.threat.warband && q.threat.warband.side === wb.side) s -= 0.6;
    if (tb && q.warband && q.warband.band === tb.id) s -= 1.5;
    // (Never far from their place, but in a charge.)
    if (!charge && cheb(slot, q) > leash + (bow ? 8 : 1)) continue;
    if (s < bs) {
      bs = s;
      best = q;
    }
  }
  wb.tgt = best;
  // Where to stand: within reach of them, round the side of one already
  // locked with a friend; else their place in the band.
  if (best && !bow) wb.goal = approach(n, L, best);
  else if (best && bow && cheb(n, best) < 3) {
    // (Too close for the bow: a step back, toward their own lines.)
    const S = L.sides[wb.side];
    wb.goal = { x: Math.round(n.x - S.fwd.x * 2), z: Math.round(n.z - S.fwd.z * 2) };
  } else wb.goal = slot;
}

// A free tile next to a foe to strike from: the nearest, but not in front
// of them if they're already at someone (round the side, or behind).
function approach(n, L, t) {
  if (cheb(n, t) <= 1) return { x: n.x, z: n.z };
  const w = n.game.world;
  let best = null;
  let bs = Infinity;
  const busy = t.threat && t.threat !== n && cheb(t, t.threat) <= 1;
  const fx = busy ? Math.sign(t.threat.x - t.x) : 0;
  const fz = busy ? Math.sign(t.threat.z - t.z) : 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const x = t.x + dx;
      const z = t.z + dz;
      if (taken(L, n, x, z)) continue;
      const y = w.findStandY(x, z, t.y);
      if (y < 0 || Math.abs(y - t.y) > 1) continue;
      let s = cheb(n, { x, z });
      if (busy && dx * fx + dz * fz > 0) s += 1.5;
      if (busy && dx * fx + dz * fz < 0) s -= 0.8;
      if (s < bs) {
        bs = s;
        best = { x, z };
      }
    }
  }
  return best || { x: t.x, z: t.z };
}

// A frame of a soldier in a band.
export function bandSoldier(n, wb, dt, L, b) {
  const g = n.game;
  // Mid-blow, or taking aim: that first.
  if ((n.windup || n.aim) && n.threat && !n.threat.dead && !n.threat.down) return strike(n, n.threat, dt);
  // (Round 144) At a siege: the walls, the gate, the ladders.
  if (L.siege && wb.phase !== 'fallback' && siegeAct(n, wb, dt, L, b)) return;
  // Badly hurt: back through the ranks to bind it (they get a little back),
  // and in again; or off the field, if it won't stop.
  if (n.hp < n.maxHp * 0.3 && !wb.fell && b.order.kind !== 'charge') {
    wb.fell = true;
    wb.phase = 'fallback';
    wb.fallT = 0;
    n.say(n.rng.pick(['I\'m hit!', 'Cover me!', 'Back... back...', 'Take my place!']), 1.8, '#ffb080');
  }
  if (wb.phase === 'fallback') {
    wb.fallT += dt;
    const S = L.sides[wb.side];
    const c = b.cen || b.anchor;
    const rx = Math.round(c.x - S.fwd.x * 6);
    const rz = Math.round(c.z - S.fwd.z * 6);
    if (stepToward(n, L, rx, rz, 1, 1) && wb.fallT > 2) {
      // (A rag round it: a little back.)
      wb.bindT = (wb.bindT || 0) + dt;
      if (wb.bindT > 2 && n.hp < n.maxHp * 0.5) {
        wb.bindT = 0;
        n.hp = Math.min(n.maxHp, n.hp + 1);
        if (n.rng.chance(0.15)) n.say('*binds the wound*', 1.5, '#c8c8c8');
      }
    }
    if (wb.fallT > 10) {
      wb.phase = n.hp >= n.maxHp * 0.3 ? 'move' : 'flee';
      wb.bindT = 0;
      if (wb.phase === 'flee') return leave(n, wb, dt);
    }
    return;
  }
  // Decide now and then (staggered: not everyone in the same frame).
  wb.thinkT = (wb.thinkT ?? (n.id % 7) * 0.05) - dt;
  if (wb.thinkT <= 0 || (wb.tgt && (wb.tgt.dead || wb.tgt.down))) {
    wb.thinkT = 0.28 + (n.id % 5) * 0.04;
    think(n, wb, L, b);
  }
  if (n.moving) return;
  let t = wb.tgt && !wb.tgt.dead && !wb.tgt.down ? wb.tgt : null;
  // (Drawn up and waiting for it to begin: only whoever's on them.)
  if (!L.go && t && cheb(n, t) > 1) t = null;
  if (!L.go && !t && n.rng.chance(dt * 0.05)) n.say(n.rng.pick(['Steady...', 'Hold the line!', 'Shields up!', 'For the realm!', 'Here they come!', 'Wait for it...']), 1.8, '#ffe070');
  const kind = b.order.kind;
  // Shields locked: up whenever they're not striking.
  wb.shieldwall = kind === 'shieldwall';
  if (wb.shieldwall && !n.windup) n.guardT = 0.3;
  // Within reach: at them.
  if (t && inReach(n, t, styleOf(n, true))) {
    n.drawnBow = false;
    return strike(n, t, dt);
  }
  // A bow, and a mark within range: loose (the band's volley, when it
  // comes round).
  const bow = wb.bow;
  if (t && bow && !n.mount) {
    const d = cheb(n, t);
    if (d >= 3 && d <= 10 && Math.abs(t.y - n.y) <= 3) {
      n.drawnBow = true;
      n.face(t.x, t.z);
      if (n.attackCd > 0) return;
      // (Together: when the band's volley is called.)
      if (kind === 'loose' && b.volleyAt && L.t < b.volleyAt) return;
      n.threat = t;
      n.aimShot(t, dt, 2.2 + (n.id % 3) * 0.2);
      return;
    }
  }
  n.drawnBow = false;
  const goal = wb.goal || wb.slotAt;
  if (!goal) return;
  // (Running at them in a charge; a steady step otherwise; back slower.)
  const pace = kind === 'charge' ? 0.78 : kind === 'fallback' ? 1.15 : kind === 'shieldwall' ? 1.6 : kind === 'wheel' ? 0.85 : t ? 0.85 : 1.05;
  if (n.x === goal.x && n.z === goal.z) {
    // In place: facing the enemy.
    if (t) n.face(t.x, t.z);
    else if (n.rng.chance(dt * 2)) n.face(Math.round(n.x + b.face.x * 4), Math.round(n.z + b.face.z * 4));
    claim(L, n, n.x, n.z);
    return;
  }
  stepToward(n, L, goal.x, goal.z, pace, 0);
  void g;
}

// (Kept for anyone walking in from the rear: to their place in the band.)
export function marchToBand(n, wb, dt, L, b) {
  const i = b.slots ? b.slots.get(n) ?? b.ents.length : b.ents.length;
  const q = slotAt(b, i);
  wb.form = q;
  wb.marchT = (wb.marchT || 0) + dt;
  if (cheb(n, q) <= 2 || wb.marchT > 45) {
    wb.phase = 'move';
    return;
  }
  if (cheb(n, q) > 14) goTo(n, q.x, q.z, 1);
  else stepToward(n, L, q.x, q.z, 0.9, 1);
}

export { standing };

// ------------------------------------------------------------ a siege
// (Round 144) A soldier in an assault on a town (see game/siegeground.js):
// the storming parties to their point (behind the ram at the gate; the
// ladder carried up and raised, and up it one at a time, fighting whoever's
// at the top; through the breach; at the barricades with axe and spear);
// over the wall or through, then for the square. The defenders at their
// posts on the walls (striking at whoever comes up, pushing the ladders
// off), at the gate, behind the barricades; once the enemy's in the
// streets, after them. True if it's handled.
const Y0 = 6;
export function siegeAct(n, wb, dt, L, b) {
  const S = L.siege;
  if (!S || !L.go) return false;
  const g = n.game;
  const pt = b.point;
  const atk = wb.side === S.atk;
  const site = L.site;
  const bd = site.L.bounds;
  const inside = n.x > bd.x0 && n.x < bd.x1 && n.z > bd.z0 && n.z < bd.z1;
  const onWall = n.y >= Y0 + 3;
  if (atk) {
    if (b.order.kind !== 'storm' && !inside && !onWall) return false;
    // In the streets: for the square, cutting down whoever's in the way.
    if (inside && !onWall) {
      const f = foesNear(L, wb.side, n.x, n.z, 5, 4);
      if (f.length) {
        wb.tgt = f[0].n;
        if (inReach(n, f[0].n, styleOf(n, true))) return strike(n, f[0].n, dt), true;
        if (!n.moving) stepToward(n, L, f[0].n.x, f[0].n.z, 0.85, 1);
        return true;
      }
      if (!n.moving) n.followPath({ x: L.centre.x, y: g.world.findStandY(L.centre.x, L.centre.z, Y0), z: L.centre.z }, 2, { x0: bd.x0 - 2, z0: bd.z0 - 2, x1: bd.x1 + 2, z1: bd.z1 + 2, nodes: 4000 });
      return true;
    }
    // Up on the wall: whoever's there, then down the steps into the town.
    if (onWall) {
      const f = foesNear(L, wb.side, n.x, n.z, 2, 3).filter((q) => Math.abs(q.n.y - n.y) <= 1);
      if (f.length) {
        wb.tgt = f[0].n;
        if (inReach(n, f[0].n, styleOf(n, true))) return strike(n, f[0].n, dt), true;
      }
      if (!n.moving && pt) n.followPath({ x: pt.inside.x, y: g.world.findStandY(pt.inside.x, pt.inside.z, Y0), z: pt.inside.z }, 1, { x0: bd.x0 - 4, z0: bd.z0 - 4, x1: bd.x1 + 4, z1: bd.z1 + 4, nodes: 1500 });
      return true;
    }
    if (!pt) return false;
    // Whoever comes at them outside the walls: fought.
    const near = foesNear(L, wb.side, n.x, n.z, 1, 2).filter((q) => Math.abs(q.n.y - n.y) <= 1);
    if (near.length && !wb.climb) {
      wb.tgt = near[0].n;
      return strike(n, near[0].n, dt), true;
    }
    if (pt.kind === 'walls') return ladderMan(n, wb, dt, L, b, pt);
    if (pt.kind === 'gate') {
      const gt = S.gate;
      if (gt && !gt.broken) {
        // (Behind the ram, shields up against what comes off the wall; the
        // ram gone, at the gate with axes.)
        const ram = (L.engines || []).find((e) => e.type === 'ram' && e.gateOf === S.id && !e.broken && !e.done && e.phase !== 'stuck' && e.crew.length);
        n.guardT = 0.3;
        if (ram) {
          if (!n.moving) stepToward(n, L, pt.out.x, pt.out.z, 1, 2);
          return true;
        }
        const ax = Math.round(gt.x + S.dir.x);
        const az = Math.round(gt.z + S.dir.z);
        if (cheb(n, { x: ax, z: az }) > 1) {
          if (!n.moving) stepToward(n, L, ax, az, 0.9, 1);
          return true;
        }
        if (!n.moving && n.attackCd <= 0) {
          n.face(gt.x, gt.z);
          n.doAction(0.35);
          n.attackCd = 1.3;
          gt.hp = Math.max(0, gt.hp - 1.5);
          if (n.rng.chance(0.3)) g.renderer.emit(gt.x + 0.5, Y0 + 1, gt.z + 0.5, { n: 4, color: ['#7a5430', '#a07a4a'], up: 18, speed: 24, life: 0.4, gravity: 40 });
          if (gt.hp <= 0) g.sim.war.sieges.breakGate(S, site.L);
        }
        return true;
      }
    }
    if (pt.kind === 'barricade' && pt.bar) {
      const left = pt.bar.tiles.filter((t) => g.world.getBlock(t.x, Y0, t.z) !== 0);
      if (left.length) {
        const t = left.sort((p, q) => cheb(p, n) - cheb(q, n))[0];
        if (cheb(n, t) > 1) {
          if (!n.moving) stepToward(n, L, t.x + (pt.bar.dx || 0), t.z + (pt.bar.dz || 0), 0.9, 1);
          return true;
        }
        if (!n.moving && n.attackCd <= 0) {
          n.face(t.x, t.z);
          n.doAction(0.35);
          n.attackCd = 1.2;
          t.hits = (t.hits || 0) + 1;
          g.renderer.emit(t.x + 0.5, Y0 + 1, t.z + 0.5, { n: 4, color: ['#8a6a3a', '#5a4022', '#c8b070'], up: 16, speed: 22, life: 0.4, gravity: 40 });
          g.audio?.play('chop', { x: t.x, y: Y0, z: t.z });
          if (t.hits >= 6) for (const y of [Y0, Y0 + 1]) if (g.world.getBlock(t.x, y, t.z) !== 0) g.world.setBlock(t.x, y, t.z, 0, 0);
        }
        return true;
      }
    }
    // Through (the gate, the breach, the barricades): inside.
    if (!n.moving) n.followPath({ x: pt.inside.x, y: g.world.findStandY(pt.inside.x, pt.inside.z, Y0), z: pt.inside.z }, 1, { x0: bd.x0 - 12, z0: bd.z0 - 12, x1: bd.x1 + 12, z1: bd.z1 + 12, nodes: 2000 });
    return true;
  }
  // The defenders.
  const foesIn = L.inside > 0;
  // (The enemy in the streets: after them, whoever's near.)
  if (foesIn && !onWall) {
    const f = foesNear(L, wb.side, n.x, n.z, 8, 4).filter((q) => q.n.y <= Y0 + 1);
    if (f.length) {
      wb.tgt = f[0].n;
      if (inReach(n, f[0].n, styleOf(n, true))) return strike(n, f[0].n, dt), true;
      if (!n.moving) stepToward(n, L, f[0].n.x, f[0].n.z, 0.85, 1);
      return true;
    }
  }
  if (b.order.kind !== 'man' || !b.posts) return false;
  const i = b.slots ? b.slots.get(n) ?? 0 : 0;
  const post = b.posts[i % b.posts.length];
  wb.form = post;
  // Anyone in reach of the post (the one at the top of a ladder, below).
  const f = foesNear(L, wb.side, n.x, n.z, 2, 3).filter((q) => Math.abs(q.n.y - n.y) <= 1);
  if (f.length && inReach(n, f[0].n, styleOf(n, true))) {
    wb.tgt = f[0].n;
    n.drawnBow = false;
    return strike(n, f[0].n, dt), true;
  }
  // A bow, and someone below in range: loose.
  if (wb.bow === undefined) wb.bow = bowOf(n);
  if (wb.bow && onWall && n.attackCd <= 0) {
    const far0 = foesNear(L, wb.side, n.x, n.z, 11, 6).filter((q) => q.d >= 2);
    if (far0.length) {
      const t = far0[Math.floor(Math.random() * Math.min(3, far0.length))].n;
      n.drawnBow = true;
      n.face(t.x, t.z);
      n.threat = t;
      n.aimShot(t, dt, 2);
      return true;
    }
  }
  n.drawnBow = false;
  if (n.x !== post.x || n.z !== post.z || Math.abs(n.y - (post.y ?? n.y)) > 0) {
    if (!n.moving) {
      // (Out of your sight: up on the walls already.)
      if (!g.inSight(n.x, n.z, 2) && !g.inSight(post.x, post.z, 2) && cheb(n, post) > 3) n.teleport(post.x, post.y ?? n.y, post.z);
      else n.followPath({ x: post.x, y: post.y ?? Y0, z: post.z }, 0, { x0: bd.x0 - 4, z0: bd.z0 - 4, x1: bd.x1 + 4, z1: bd.z1 + 4, nodes: 1500 });
    }
    return true;
  }
  if (!n.moving && n.rng.chance(dt)) n.face(Math.round(n.x + S.dir.x * 5), Math.round(n.z + S.dir.z * 5));
  if (n.rng.chance(dt * 0.03)) n.say(n.rng.pick(['Here they come!', 'Push them off!', 'Stones! Throw anything!', 'Hold! Hold the wall!', 'Not one of them gets over!']), 1.8, '#ffe070');
  return true;
}

// One of a ladder party: carry it up, raise it, up it in turn.
function ladderMan(n, wb, dt, L, b, pt) {
  const g = n.game;
  const ld = pt.ladder;
  if (!ld || ld.broken) {
    // (Their ladder gone: back to the others, out of bowshot.)
    if (!n.moving) stepToward(n, L, pt.out.x, pt.out.z, 1, 2);
    return true;
  }
  const base = ld.base;
  n.guardT = 0.3;
  // Climbing.
  if (wb.climb) {
    if (!ld.up) {
      wb.climb = null;
      return true;
    }
    if (n.moving) return true;
    if (n.x !== base.x || n.z !== base.z) {
      wb.climb = null;
      return true;
    }
    if (n.y < Y0 + 2) {
      if (g.npcs.some((q) => q !== n && !q.dead && q.x === base.x && q.z === base.z && q.y === n.y + 1)) return true;
      n.face(ld.wall.x, ld.wall.z);
      n.startMove(base.x, n.y + 1, base.z, 0.5);
      return true;
    }
    // At the top: whoever's on the wall there, then over.
    const top = ld.top;
    const foe = foesNear(L, wb.side, top.x, top.z, 0, 1).filter((q) => q.n.y >= Y0 + 3)[0];
    if (foe) {
      wb.tgt = foe.n;
      return strike(n, foe.n, dt), true;
    }
    if (g.world.getBlock(top.x, top.y, top.z) !== 0) {
      wb.climb = null;
      return true;
    }
    n.startMove(top.x, top.y, top.z, 0.45);
    wb.climb = null;
    n.say(n.rng.pick(['I\'m up!', 'On the wall! Follow me!', 'Over! Over!']), 1.8, '#ffb080');
    return true;
  }
  // The carriers: to the foot of the wall with it.
  if (!ld.up) {
    if (wb.carry === ld) {
      if (n.x !== base.x || n.z !== base.z) {
        if (!n.moving) stepToward(n, L, base.x, base.z, 0.9, 0);
      }
      return true;
    }
    // (The rest: close behind.)
    if (!n.moving) stepToward(n, L, base.x + Math.sign(pt.out.x - base.x) * 2, base.z + Math.sign(pt.out.z - base.z) * 2, 1, 1);
    return true;
  }
  // Up: at the foot, and the first rung free, up it.
  if (n.x === base.x && n.z === base.z && n.y === Y0) {
    if (!g.npcs.some((q) => q !== n && !q.dead && q.x === base.x && q.z === base.z && q.y === Y0 + 1)) wb.climb = true;
    return true;
  }
  const atFoot = g.npcs.some((q) => q !== n && !q.dead && q.x === base.x && q.z === base.z && q.y <= Y0 + 1);
  if (!n.moving) {
    if (atFoot) stepToward(n, L, base.x + Math.sign(pt.out.x - base.x), base.z + Math.sign(pt.out.z - base.z), 1, 1);
    else {
      const ty = g.world.stepTarget(n.x, n.y, n.z, base.x, base.z, true);
      if (cheb(n, base) === 1 && Math.abs(n.x - base.x) + Math.abs(n.z - base.z) === 1 && ty === Y0) {
        n.startMove(base.x, Y0, base.z, n.step);
      } else stepToward(n, L, base.x, base.z, 0.9, 0);
    }
  }
  return true;
}
