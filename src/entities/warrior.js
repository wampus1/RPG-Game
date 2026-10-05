// How raiders, soldiers and riders behave on the ground (an NPC in the
// 'warband' state). Raiders make for the town square, fight whoever stands
// in their way, grab what they can and run; soldiers keep to their
// captain's plan (a line advancing, a wing swinging wide round the flank,
// both wings closing in a pincer, holding their ground or a log wall, a
// feigned retreat that turns on the chasers) until the fighting reaches
// them, and fall back when badly hurt; the watch rides out on horseback to
// meet raiders in the fields.

import { GROUND } from '../config.js';
import { ITEMS, ammoOf } from '../world/items.js';
import { B } from '../world/blocks.js';
import { FIRESIDE } from '../sim/bandits.js';
import { ignite, roofTarget, nearestBurnable } from '../game/fire.js';
import { sagaFight } from './sagaman.js';

const far = (n, x, z) => Math.max(Math.abs(n.x - x), Math.abs(n.z - z));


export function warTick(n, dt) {
  const wb = n.warband;
  if (!wb) {
    n.state = 'routine';
    return;
  }
  if (wb.phase === 'down') return;
  if (wb.kind === 'sortie') return ride(n, wb);
  if (wb.kind === 'escape') return leave(n, wb, dt);
  // (A prisoner being led off the field.)
  if (wb.kind === 'led') return leave(n, wb, dt);
  if (wb.kind === 'march') return march(n, wb, dt);
  if (wb.kind === 'raid') return raider(n, wb, dt);
  if (wb.kind === 'bandit') return bandit(n, wb, dt);
  // (The stories' own fighters: see sagaman.js.)
  if (wb.kind === 'saga') return sagaFight(n, dt);
  return soldier(n, wb, dt);
}

// Along to (x, z), pathing within a box round the two.
function goTo(n, x, z, near = 1) {
  x = Math.round(x);
  z = Math.round(z);
  const box = { x0: Math.min(n.x, x) - 12, z0: Math.min(n.z, z) - 12, x1: Math.max(n.x, x) + 12, z1: Math.max(n.z, z) + 12 };
  const done = n.followPath({ x, y: n.y, z }, near, box);
  // Hooves (and boots) kick up dust.
  if (n.moving && n.mount && n.rng.chance(0.25)) n.game.renderer.emit(n.x, n.y, n.z, { n: 2, color: ['#a89878', '#8a7a5a'], up: 6, speed: 10, life: 0.45, oy: 6, shape: 'puff' });
  return done;
}

// Held up on the way somewhere (no path, or one too long to find) and out
// of your sight: on along the way all the same, a stretch at a time, never
// where you could see it happen. True if it moved them.
function hopOn(n, wb, x, z, dt) {
  const g = n.game;
  const d = far(n, x, z);
  if (d <= 2) return false;
  if (wb.bestD === undefined || d < wb.bestD - 0.5) {
    wb.bestD = d;
    wb.heldT = 0;
    return false;
  }
  wb.heldT = (wb.heldT || 0) + dt;
  if (wb.heldT < 5 || g.inSight(n.x, n.z, 2)) return false;
  const len = Math.hypot(x - n.x, z - n.z) || 1;
  const ux = (x - n.x) / len;
  const uz = (z - n.z) / len;
  for (let k = Math.min(12, Math.floor(len) - 1); k >= 3; k--) {
    const sx = Math.round(n.x + ux * k);
    const sz = Math.round(n.z + uz * k);
    if (g.inSight(sx, sz, 2) || !g.world.regionAt(sx, sz)) continue;
    const y = g.world.findStandY(sx, sz, n.y);
    if (y <= 0 || Math.abs(y - n.y) > 3 || g.world.isWaterAt(sx, y, sz)) continue;
    const spot = g.findFreeSpot(sx, sz, y);
    if (!spot || g.inSight(spot.x, spot.z, 2)) continue;
    n.teleport(spot.x, spot.y, spot.z);
    n.path = null;
    wb.heldT = 0;
    wb.bestD = far(n, x, z);
    return true;
  }
  return false;
}

function nearest(n, list, r = 99) {
  let best = null;
  let bd = r + 1;
  for (const t of list) {
    if (!t || t.dead || t.down) continue;
    const d = n.distTo(t);
    if (d < bd) {
      best = t;
      bd = d;
    }
  }
  return best;
}

function strike(n, t, dt) {
  n.threat = t;
  n.fight(dt);
  // (fight() may have called it off: back to the plan next tick.)
  if (n.state !== 'warband' && n.state !== 'fight') n.state = 'warband';
}

// Off home: out of sight, out of the world (never in front of you: home,
// but still in view, they keep walking on, away from you).
function leave(n, wb, dt) {
  const g = n.game;
  const h = wb.home;
  wb.leaveT = (wb.leaveT || 0) + dt;
  const done = !h || far(n, h.x, h.z) <= 2 || n.distTo(g.player) > 34 || wb.leaveT > (wb.kind === 'escape' ? 120 : 60);
  if (done && !g.inSight(n.x, n.z, 2)) {
    // (An escaping prisoner out of sight has got away.)
    if (wb.kind === 'escape') n.escaped = true;
    g.despawnNpc(n);
    return;
  }
  if (done) {
    const p = g.player;
    if (!wb.away || far(n, wb.away.x, wb.away.z) <= 2) wb.away = { x: Math.round(n.x + (Math.sign(n.x - p.x) || 1) * 14), z: Math.round(n.z + (Math.sign(n.z - p.z) || 1) * 14) };
    goTo(n, wb.away.x, wb.away.z, 1);
    return;
  }
  goTo(n, h.x, h.z, 1);
}

// The one playing a bandit at its fire minds most (the nearest, but for a
// captive in their cage and anyone who's joined them, unless they've
// turned on them).
function campMark(g, n, wb) {
  let best = null;
  let bd = Infinity;
  const S = g.sim.saga;
  for (const q of g.everyone()) {
    if (q.dead || q.limbo || q.sagaHeld) continue;
    if (S && S.friendOfBand && S.friendOfBand(wb.band, q) && n.threat !== q) continue;
    const d = Math.max(Math.abs(q.x - n.x), Math.abs(q.z - n.z));
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  // (Nobody to mind: someone far off, so nothing's near enough to matter.)
  return best || { x: n.x + 999, y: n.y, z: n.z + 999, dead: true };
}

// ------------------------------------------------------------ raiders
function raider(n, wb, dt) {
  const g = n.game;
  const L = g.sim.war.live;
  if (wb.torch && n.rng.chance(0.3)) g.renderer.emit(n.x, n.y + 1.6, n.z, { n: 1, color: ['#ffb040', '#ff7020', '#ffe080'], up: 14, speed: 4, life: 0.35, gravity: -30, oy: -14 });
  if (wb.phase === 'flee') return leave(n, wb, dt);
  if (!L || L.kind !== 'raid' || L.raid.id !== wb.raid) {
    wb.phase = 'flee';
    wb.land = null;
    n.raft = null;
    return;
  }
  // Still out on the water: paddling in.
  if (wb.land) return paddleIn(n, wb, dt);
  if (n.hp < n.maxHp * 0.35) {
    wb.phase = 'flee';
    n.stateT = 0;
    n.say(n.rng.pick(['I\'m hit! Away!', 'Not worth dying for!', 'Run!']), 2, '#ffb080');
    return;
  }
  // Whoever stands in the way (the watch, anyone with a blade out, you).
  const town = L.TL.settlement.id;
  const foes = g.npcs.filter((q) => !q.dead && q !== n && !(q.warband && q.warband.kind === 'raid') && q.settlement && q.settlement.id === town && (q.rec.job === 'guard' || q.state === 'fight'));
  // You, if you've gone for them, or you're one of the town's own (or
  // standing in their way with a blade out); otherwise they push past.
  const pl = g.player;
  const armed = pl.heldDef && pl.heldDef()?.damage > 2;
  if (!pl.dead && (n.threat === pl || (n.distTo(pl) <= 3 && (g.sim.isCitizen(town) || g.sim.playerGuard(town))) || (n.distTo(pl) <= 1 && armed))) foes.push(pl);
  const t = nearest(n, foes, 5);
  if (t) return strike(n, t, dt);
  // Townsfolk who see them coming scatter and shout for the watch.
  const a = g.active.get(town);
  if (a) {
    wb.seen ||= new Set();
    for (const q of a.npcs) {
      if (q.dead || q.state !== 'routine' || wb.seen.has(q) || q.distTo(n) > 6) continue;
      wb.seen.add(q);
      q.react(n, false);
    }
  }
  if (wb.phase === 'advance') {
    if (goTo(n, wb.goal.x, wb.goal.z, 3)) {
      wb.phase = 'loot';
      wb.lootT = 0;
      n.say(n.rng.pick(['Grab what you can!', 'The strongbox! Quick!', 'Take it all!']), 2.5, '#ffb080');
    }
    return;
  }
  if (wb.phase === 'loot') {
    wb.lootT += dt;
    if (!n.moving && n.rng.chance(dt * 2)) {
      n.doAction(0.3);
      g.renderer.emit(n.x, n.y + 1, n.z, { n: 2, color: ['#ffe070', '#e8c060'], up: 18, speed: 14, life: 0.4, gravity: 120 });
      if (n.rng.chance(0.5)) L.loot = Math.min((L.loot || 0) + 3, 30 + L.start * 18);
    }
    if (wb.lootT > 14) {
      wb.phase = 'flee';
      n.stateT = 0;
      n.say(n.rng.pick(['We have it! Away!', 'Back to the horses!', 'Go, go!']), 2.5, '#ffb080');
    }
  }
}

// In off the water on a raft, a tile at a time, and out onto the shore.
function paddleIn(n, wb, dt) {
  const ld = wb.land;
  if (ld.wait > 0) {
    ld.wait -= dt;
    return;
  }
  if (n.moving) return;
  const t = ld.tiles[ld.i];
  if (!t) {
    wb.land = null;
    n.raft = null;
    n.inWater = false;
    if (n.rng.chance(0.5)) n.say(n.rng.pick(['Ashore! Go, go!', 'Up the bank!', 'Leave the rafts!']), 2, '#ffb080');
    return;
  }
  // (Someone in the way: wait for them.)
  if (n.game.occupiedBySolid(t.x, t.y, t.z, n)) return;
  ld.i++;
  n.face(t.x, t.z);
  n.startMove(t.x, t.y, t.z, n.step * (t.water ? 1.6 : 1));
  if (t.water) {
    const ang = [0, -Math.PI / 2, Math.PI, Math.PI / 2][n.dir] ?? 0;
    n.raft = n.raft || { ang };
    n.raft.ang = ang;
    n.inWater = true;
  } else {
    n.raft = null;
    n.inWater = false;
  }
}

// ------------------------------------------------------------ bandits
// Round the fire at their camp out in the wilds (anyone who comes too
// close is told to hand over their purse, and cut down if they won't), or
// in over the fields on a raid: for the square and the strongbox, past the
// watch, and away with what they can carry.
function bandit(n, wb, dt) {
  const g = n.game;
  // (Whoever's nearest of those playing: not one held in their cage, nor
  // one who rides with them; see sim/saga.)
  const pl = campMark(g, n, wb);
  if (wb.torch && wb.phase !== 'camp' && n.rng.chance(0.3)) g.renderer.emit(n.x, n.y + 1.6, n.z, { n: 1, color: ['#ffb040', '#ff7020', '#ffe080'], up: 14, speed: 4, life: 0.35, gravity: -30, oy: -14 });
  if (wb.phase === 'flee') return leave(n, wb, dt);
  if (n.hp < n.maxHp * 0.3) {
    // (Away from you, out of sight, to lick their wounds.)
    if (wb.phase === 'camp') wb.home = { x: Math.round(n.x + (Math.sign(n.x - pl.x) || 1) * 30), z: Math.round(n.z + (Math.sign(n.z - pl.z) || 1) * 30) };
    wb.phase = 'flee';
    n.stateT = 0;
    g.sim.bandits?.fled(n);
    n.say(n.rng.pick(['Enough! I\'m off!', 'Not worth dying for!', 'Scatter!']), 2, '#ffb080');
    return;
  }
  const d = pl.dead || pl.down || Math.abs(pl.y - n.y) > 2 ? 99 : n.distTo(pl);
  const close = d <= 6;
  if (wb.phase === 'camp') {
    const h = wb.home;
    // (Someone in their cage: whoever comes may be come to pay for them,
    // so they're watched, not set on, unless they start something.)
    const band = g.sim.bandits && g.sim.bandits.get(wb.band);
    const holding = !!(band && band.holding);
    // Come too near the fire: warned off first, then set on (a few
    // moments to think better of it).
    if (d <= 10 && n.threat !== pl) {
      wb.warnT = (wb.warnT || 0) + dt;
      if (!wb.warned) {
        wb.warned = true;
        n.face(pl.x, pl.z);
        n.say(n.rng.pick(holding ? ['Come to pay, have you? See the jailer.', 'Keep your hands where I can see them.', 'Slowly. The jailer\'s by the cage.'] : ['Your purse or your life!', 'Wrong road, friend.', 'Nobody comes to our fire uninvited.', 'Keep walking, stranger.']), 3, '#ff9080');
      }
    } else if (d > 14) {
      wb.warnT = 0;
      wb.warned = false;
    }
    if (n.threat === pl || (!holding && (d <= 3 || (wb.warnT || 0) > 5)) || (holding && d <= 1)) {
      if (n.threat !== pl && n.rng.chance(0.5)) n.say(n.rng.pick(['Get them!', 'You were warned!', 'Take everything they\'ve got!']), 2, '#ff9080');
      n.threat = pl;
      return strike(n, pl, dt);
    }
    // Idling round the fire.
    const [ox, oz] = FIRESIDE[n.rec.idx % FIRESIDE.length];
    if (far(n, h.x, h.z) > 4) return void goTo(n, h.x + ox, h.z + oz, 1);
    if (!n.moving && n.rng.chance(dt * 0.15)) n.face(h.x, h.z);
    if (!n.moving && n.rng.chance(dt * 0.02) && n.distTo(pl) <= 14) n.say(n.rng.pick(['Pass the meat.', 'Quiet night.', 'Merchant comes by tomorrow, they say.', 'I miss home.', 'Who\'s on watch?']), 2.5);
    return;
  }
  // On a raid: whoever stands in the way (the watch, anyone with a blade
  // out, you if you're close).
  const town = wb.town;
  const foes = g.npcs.filter((q) => !q.dead && !q.down && q !== n && !(q.warband && q.warband.kind === 'bandit') && q.settlement && q.settlement.id === town && (q.rec.job === 'guard' || (q.state === 'fight' && q.threat === n)));
  if (!pl.dead && (n.threat === pl || close)) foes.push(pl);
  const t = nearest(n, foes, 5);
  if (t) return strike(n, t, dt);
  const a = g.active.get(town);
  if (a) {
    wb.seen ||= new Set();
    for (const q of a.npcs) {
      if (q.dead || q.state !== 'routine' || wb.seen.has(q) || q.distTo(n) > 6) continue;
      wb.seen.add(q);
      q.react(n, false);
    }
  }
  if (wb.phase === 'raid') {
    // (Close enough: the middle of the square is often the well.)
    if (goTo(n, wb.goal.x, wb.goal.z, 3) || Math.max(Math.abs(n.x - wb.goal.x), Math.abs(n.z - wb.goal.z)) <= 4 || n.stateT > 90) {
      wb.phase = 'loot';
      wb.lootT = 0;
      n.say(n.rng.pick(['Grab what you can!', 'The strongbox! Quick!', 'Fill your sacks!']), 2.5, '#ffb080');
    }
    return;
  }
  if (wb.phase === 'loot') {
    wb.lootT += dt;
    // Each has a job: the torch-bearers set roofs alight, the rest go
    // through the houses for what's in the chests, and between times
    // they're at the strongbox.
    if (wb.job === undefined) wb.job = wb.torch ? 'burn' : n.rng.chance(0.6) ? 'chest' : 'box';
    if (wb.job === 'burn' && raidBurn(n, wb, dt)) return;
    if (wb.job === 'chest' && raidChest(n, wb, dt)) return;
    if (!n.moving && n.rng.chance(dt * 2)) {
      n.doAction(0.3);
      g.renderer.emit(n.x, n.y + 1, n.z, { n: 2, color: ['#ffe070', '#e8c060'], up: 18, speed: 14, life: 0.4, gravity: 120 });
      if (n.rng.chance(0.5)) g.sim.bandits?.grab(n, 3);
    }
    if (wb.lootT > 18) {
      wb.phase = 'flee';
      n.stateT = 0;
      n.say(n.rng.pick(['We have it! Away!', 'Back to the hills!', 'Go, go!']), 2.5, '#ffb080');
    }
  }
}

// A torch onto the nearest roof that'll burn (thrown from a few paces).
function raidBurn(n, wb, dt) {
  const g = n.game;
  const L = g.sim.layoutOf(wb.town);
  if (!L || (wb.burned || 0) >= 2) return false;
  if (!wb.burnAt) {
    const bs = L.buildings.filter((b) => !b.underConstruction && b.x0 !== undefined && b.type !== 'temple' && Math.max(Math.abs(b.door.x - n.x), Math.abs(b.door.z - n.z)) < 16);
    bs.sort((a, b) => Math.hypot(a.door.x - n.x, a.door.z - n.z) - Math.hypot(b.door.x - n.x, b.door.z - n.z));
    for (const b of bs.slice(0, 4)) {
      const t = roofTarget(g, b, n.x, n.z);
      if (t) {
        wb.burnAt = t;
        wb.burnT = 0;
        break;
      }
    }
    // (Stone and slate won't take: a haystack or a fence will do.)
    if (!wb.burnAt) wb.burnAt = nearestBurnable(g, n.x, n.y, n.z, 10);
    if (!wb.burnAt) {
      wb.burned = 9;
      return false;
    }
    wb.burnT = 0;
  }
  const t = wb.burnAt;
  wb.burnT += dt;
  if (Math.max(Math.abs(t.x - n.x), Math.abs(t.z - n.z)) > 3 && wb.burnT < 10) {
    goTo(n, t.x, t.z, 3);
    return true;
  }
  // Up it goes.
  n.face(t.x, t.z);
  n.doAction(0.35);
  for (let i = 1; i <= 5; i++) {
    const f = i / 6;
    g.renderer.emit(n.x + (t.x - n.x) * f, n.y + 1.5 + Math.sin(f * Math.PI) * 1.5 + (t.y - n.y) * f * 0.6, n.z + (t.z - n.z) * f, { n: 1, color: ['#ffb040', '#ffe080'], up: 4, speed: 4, life: 0.3, gravity: 0, glow: true });
  }
  if (ignite(g, t.x, t.y, t.z, 'bandits')) {
    const R = g.sim.bandits && g.sim.bandits.raiding;
    if (R) R.fires = (R.fires || 0) + 1;
    if (n.rng.chance(0.6)) n.say(n.rng.pick(['Burn it!', 'Let it burn!', 'Light \'em up!']), 2, '#ff9060');
    // Townsfolk who see it cry out.
    const by = g.npcs.find((q) => !q.dead && !q.warband && q.state === 'routine' && q.distTo(n) < 12);
    if (by) by.say(by.rng.pick(['Fire! FIRE!', 'They\'re burning the houses!', 'Water! Get water!']), 2.5, '#ffb080');
  }
  wb.burned = (wb.burned || 0) + 1;
  wb.burnAt = null;
  return true;
}

// Into a house for whatever's in the chests.
function raidChest(n, wb, dt) {
  const g = n.game;
  const L = g.sim.layoutOf(wb.town);
  if (!L || (wb.robbed || 0) >= 2) return false;
  const w = g.world;
  if (!wb.chestAt) {
    const homes = L.buildings.filter((b) => !b.underConstruction && b.x0 !== undefined && (b.residential || b.type === 'shop' || b.type === 'warehouse') && Math.hypot(b.door.x - n.x, b.door.z - n.z) < 20);
    homes.sort((a, b) => Math.hypot(a.door.x - n.x, a.door.z - n.z) - Math.hypot(b.door.x - n.x, b.door.z - n.z));
    for (const b of homes.slice(0, 5)) {
      for (let z = b.z0 + 1; z < b.z1 && !wb.chestAt; z++) {
        for (let x = b.x0 + 1; x < b.x1; x++) {
          if (w.regionAt(x, z) && w.getBlock(x, GROUND, z) === B.chest) {
            wb.chestAt = { x, z, b: b.id };
            break;
          }
        }
      }
      if (wb.chestAt) break;
    }
    wb.chestT = 0;
    if (!wb.chestAt) {
      wb.robbed = 9;
      return false;
    }
  }
  const c = wb.chestAt;
  wb.chestT += dt;
  if (Math.max(Math.abs(c.x - n.x), Math.abs(c.z - n.z)) > 1 && wb.chestT < 15) {
    goTo(n, c.x, c.z, 1);
    return true;
  }
  if (wb.chestT < 15) {
    n.face(c.x, c.z);
    n.doAction(0.4);
    const took = g.sim.bandits?.lootChest(n, c.x, GROUND, c.z, L) || 0;
    if (took && n.rng.chance(0.6)) n.say(n.rng.pick(['Mine now!', 'Look at this lot!', 'Into the sack!']), 2, '#ffb080');
  }
  wb.robbed = (wb.robbed || 0) + 1;
  wb.chestAt = null;
  return true;
}

// ------------------------------------------------------------ the march
// On the way to a battle: in file behind the head of the column, at its
// pace (see war.marchPos), toward the field.
function march(n, wb, dt) {
  const g = n.game;
  const W = g.sim.war;
  const w = W.wars.find((q) => q.id === wb.war);
  const plan = w && w.plan;
  if (wb.phase === 'flee' || !plan) {
    wb.phase = 'flee';
    return leave(n, wb, dt);
  }
  // (The battle's begun: war.startLiveBattle puts them in the line.)
  if (plan.live) return;
  const m = W.marchPos(plan);
  if (!m) return;
  const back = 2 + (wb.slot || 0) * 1.6;
  const wide = (wb.slot || 0) % 2 ? 1 : -1;
  const tx = m.x - m.dx * back - m.dz * wide;
  const tz = m.z - m.dz * back + m.dx * wide;
  if (far(n, tx, tz) > 1) {
    if (!hopOn(n, wb, tx, tz, dt)) goTo(n, tx, tz, 1);
  } else if (!n.moving && n.rng.chance(dt * 0.5)) n.face(Math.round(n.x + m.dx * 3), Math.round(n.z + m.dz * 3));
  if (!wb.slot && n.rng.chance(dt * 0.04)) n.say(n.rng.pick(['Keep in step!', 'Close up there!', 'March!', 'Not far now.', 'Eyes front!']), 2, '#ffe070');
}

// ------------------------------------------------------------ riders
function ride(n, wb) {
  goTo(n, wb.goal.x, wb.goal.z, 2);
}

// ------------------------------------------------------------ soldiers
function soldier(n, wb, dt) {
  const g = n.game;
  const L = g.sim.war.live;
  if (!L || L.kind !== 'battle' || L.w.id !== wb.war) {
    if (wb.phase !== 'flee' && wb.phase !== 'won') wb.phase = 'flee';
  }
  if (wb.phase === 'won') {
    // A moment to cheer, then off home.
    wb.cheer = (wb.cheer || 0) + dt;
    if (wb.cheer < 4) {
      if (!n.moving && n.rng.chance(dt * 1.5)) n.doAction(0.25);
      return;
    }
    return leave(n, wb, dt);
  }
  if (wb.phase === 'flee') return leave(n, wb, dt);
  const side = L.sides[wb.side];
  const other = L.sides[wb.side === 'a' ? 'b' : 'a'];
  const s = side.sign;
  // Hired swords: in it for the coin. If their side's being cut down
  // faster than the other, or they've taken a beating, they're off (a
  // whole band at once, more often than not).
  if (wb.merc && L.t > 12) {
    const up = (S) => S.ents.filter((q) => !q.dead && !q.down && q.warband && q.warband.phase !== 'flee').length / Math.max(1, S.start);
    const losing = up(side) < up(other) * 0.8 || up(side) < 0.55 || n.hp < n.maxHp * 0.45;
    if (losing && n.rng.chance(dt * 0.35)) {
      for (const q of side.ents) {
        if (q === n || !q.warband || q.warband.merc !== wb.merc || q.dead || q.down || q.warband.phase === 'flee' || !n.rng.chance(0.7)) continue;
        q.warband.phase = 'flee';
      }
      wb.phase = 'flee';
      n.say(n.rng.pick(['This isn\'t worth the coin!', 'We\'re not dying for you lot!', 'Pay\'s not enough for this! Away!', 'Every man for himself!']), 2.5, '#ffb080');
      const band = g.sim.bandits?.get(wb.merc);
      if (band && !band.deserted) {
        band.deserted = true;
        const civ = side.civ;
        if (civ) g.sim.realms.proclaim?.(civ, g.day, `${band.name} took the realm's coin and ran from the field.`);
      }
      return leave(n, wb, dt);
    }
  }
  const ax = L.axis;
  const perp = L.perp;
  const c = L.centre;
  // Badly hurt: back behind the line for a breather (and off for good if
  // it doesn't pass).
  if (n.hp < n.maxHp * 0.3 && !wb.fell) {
    wb.fell = true;
    wb.phase = 'fallback';
    wb.fallT = 0;
    n.say(n.rng.pick(['I\'m hit!', 'Cover me!', 'Back... back...']), 1.8, '#ffb080');
  }
  if (wb.phase === 'fallback') {
    wb.fallT += dt;
    goTo(n, c.x + ax.x * 18 * s, c.z + ax.z * 18 * s, 1);
    if (wb.fallT > 9) {
      wb.phase = n.hp >= n.maxHp * 0.3 ? 'fight' : 'flee';
      n.stateT = 0;
    }
    return;
  }
  const foes = other.ents.filter((q) => !q.dead && g.npcs.includes(q) && q.warband && q.warband.phase !== 'flee');
  if (side.hates && !g.player.dead && !g.player.down) foes.push(g.player);
  const t = nearest(n, foes);
  // Working a siege engine: beside a catapult, behind a ram pushing it,
  // till it's wrecked or done with (a foe right on them gets a fight).
  if (wb.role === 'crew') {
    const e = (L.engines || []).find((q) => q.id === wb.engine);
    if (!e || e.broken || e.done || e.phase === 'stuck' || e.phase === 'breached') {
      wb.role = 'centre';
      // (The field won and the ram's work done: off home with the rest.)
      if (L.done) {
        wb.phase = 'won';
        return;
      }
    } else {
      if (t && n.distTo(t) <= 1) {
        wb.phase = 'fight';
        return strike(n, t, dt);
      }
      const k = Math.max(0, e.crew.indexOf(n));
      let fx;
      let fz;
      if (e.type === 'ram' && e.wall) {
        const dx = Math.sign(e.wall.x - e.x);
        const dz = Math.sign(e.wall.z - e.z);
        const alongX = Math.abs(e.wall.x - e.x) >= Math.abs(e.wall.z - e.z);
        fx = e.x - (alongX ? dx || 1 : 0) + (alongX ? 0 : k % 2 ? 1 : -1);
        fz = e.z - (alongX ? 0 : dz || 1) + (alongX ? (k % 2 ? 1 : -1) : 0);
      } else {
        fx = Math.round(e.x + ax.x * s + perp.x * (1 + k));
        fz = Math.round(e.z + ax.z * s + perp.z * (1 + k));
      }
      if (far(n, fx, fz) > 0) goTo(n, fx, fz, 0);
      else if (!n.moving && e.face) n.face(e.face.x, e.face.z);
      if (wb.phase === 'march' || wb.phase === 'form' || wb.phase === 'move') wb.phase = 'crew';
      return;
    }
  }
  // Coming up to take their place in the line (from the town, the march,
  // or from behind the lines): walking, not appearing there.
  if (wb.phase === 'march') {
    wb.marchT = (wb.marchT || 0) + dt;
    if (t && n.distTo(t) <= 2) {
      wb.phase = 'fight';
      return strike(n, t, dt);
    }
    if (far(n, wb.form.x, wb.form.z) > 1 && wb.marchT < 45) {
      if (!hopOn(n, wb, wb.form.x, wb.form.z, dt)) goTo(n, wb.form.x, wb.form.z, 1);
      return;
    }
    wb.phase = 'form';
  }
  if (!t) {
    if (!n.moving && n.rng.chance(dt)) n.face(c.x - ax.x * s * 10, c.z - ax.z * s * 10);
    return;
  }
  const d = n.distTo(t);
  const enemy = {
    x: foes.reduce((m, q) => m + q.x, 0) / foes.length,
    z: foes.reduce((m, q) => m + q.z, 0) / foes.length,
  };
  // Drawn up: waiting for both lines to form, then a breath before it
  // starts.
  if (wb.phase === 'form') {
    if (!L.go || L.t - (L.goT || 0) < 1.5) {
      if (!n.moving) n.face(t.x, t.z);
      if (n.rng.chance(dt * 0.3)) n.say(n.rng.pick(['Steady...', 'Hold the line!', 'Shields up!', 'For the realm!', 'Here they come!']), 1.8, '#ffe070');
      return;
    }
    wb.phase = 'move';
  }
  const tac = side.tactic;
  const dug = tac === 'hold' || tac === 'works';
  // Bows out at a distance (on foot), blades up close.
  const bw = n.rec.equipment.items.find((i) => ITEMS[i.item]?.ranged);
  const bow = !!bw && (n.rec.inv || []).some((q) => q && q.item === ammoOf(bw.item) && q.count > 0);
  n.drawnBow = !!(bow && d >= 3 && !n.mount);
  // Close enough: fight it out, whatever the plan (bows at range).
  if (wb.phase === 'fight' || d <= (dug ? 3 : 2) || (n.canShoot() && d <= 6 && d >= 2)) {
    if (d <= 2) wb.phase = 'fight';
    return strike(n, t, dt);
  }
  switch (tac) {
    case 'hold':
    case 'works':
    case 'retreat': {
      // Stand at their place in the line (a retreat stands further back).
      const back = tac === 'retreat' ? 8 + Math.min(10, L.t * 0.4) : 0;
      const fx = wb.form.x + ax.x * back * s;
      const fz = wb.form.z + ax.z * back * s;
      if (far(n, fx, fz) > 1) goTo(n, fx, fz, 0);
      else if (!n.moving) n.face(t.x, t.z);
      return;
    }
    case 'flank':
    case 'pincer': {
      const wing = wb.role === 'wing' ? (wb.slotSide ||= n.rec.idx % 2 ? 1 : -1) : wb.role === 'left' ? 1 : wb.role === 'right' ? -1 : 0;
      if (wing && !wb.round) {
        // Out wide round the side of them first.
        const wx = enemy.x + perp.x * 9 * wing + ax.x * 3 * s;
        const wz = enemy.z + perp.z * 9 * wing + ax.z * 3 * s;
        if (goTo(n, wx, wz, 2) || n.stateT > 25) {
          wb.round = true;
          n.say(n.rng.pick(['Now! Hit them from the side!', 'Charge!', 'Into them!']), 2, '#ffb080');
        }
        return;
      }
      // The middle holds until the wings are round (or long enough).
      const wings = side.ents.filter((q) => !q.dead && q.warband && q.warband.role !== 'centre');
      const ready = wings.every((q) => q.warband.round) || L.t > 14;
      if (!wing && !ready) {
        if (!n.moving) n.face(t.x, t.z);
        return;
      }
      goTo(n, t.x, t.z, 1);
      return;
    }
    case 'feint': {
      if (!wb.feigned && d <= 6) {
        wb.feigned = L.t;
        n.say(n.rng.pick(['Fall back!', 'Back! Back!']), 1.8, '#ffe070');
      }
      if (wb.feigned !== undefined && L.t - wb.feigned < 4) {
        goTo(n, wb.form.x + ax.x * 6 * s, wb.form.z + ax.z * 6 * s, 1);
        return;
      }
      if (wb.feigned !== undefined && !wb.turned) {
        wb.turned = true;
        wb.ambush = L.t + 6;
        n.say(n.rng.pick(['Now turn! At them!', 'Turn and fight!', 'They\'ve fallen for it!']), 2, '#ffb080');
      }
      goTo(n, t.x, t.z, 1);
      return;
    }
    default:
      goTo(n, t.x, t.z, 1);
  }
}

// How hard a warrior's blow lands: soldiers in a battle are shielded and
// armoured (it's a slower, longer fight than a brawl in the street), and
// strike harder in the first moments after a feint turns.
export function warBonus(n) {
  const wb = n.warband;
  const L = n.game.sim.war && n.game.sim.war.live;
  if (!wb || !L) return 1;
  const base = wb.kind === 'battle' ? 0.6 : 1;
  return wb.ambush !== undefined && L.t < wb.ambush ? base * 1.35 : base;
}


// ------------------------------------------------------------ prisoners
// A prisoner of war in a cell: standing at the bars by day, lying on the
// cot by night, calling out now and then. Very rarely, in the dark, one
// forces the cell door and runs for it (the watch goes after them).
export function captiveTick(n, dt) {
  const c = n.captive;
  const g = n.game;
  if (!c) return;
  const m = g.minute;
  const night = m < 360 || m >= 1260;
  // Over to the cot at night, up to the bars by day: a step or two (only
  // moved in a blink when you can't see the cell).
  const to = night ? c.bed : c.stand;
  if (to && (n.x !== to.x || n.z !== to.z)) {
    if (n.sleeping) n.sleeping = false;
    if (!n.moving) {
      if (!g.inSight(n.x, n.z, 2)) n.teleport(to.x, c.y, to.z);
      else n.startMove(to.x, c.y, to.z, 0.55 * Math.max(1, Math.abs(to.x - n.x) + Math.abs(to.z - n.z)));
    }
    return;
  }
  if (night !== !!n.sleeping) n.sleeping = night;
  if (!night) {
    if (!n.moving && n.rng.chance(dt * 0.3)) n.face(c.front.x, c.front.z);
    if (n.distTo(g.player) <= 6 && n.rng.chance(dt * 0.04)) {
      const civ = n.rec && n.settlement.civ ? n.settlement.civ.name.replace(/^The /, '') : null;
      n.say(n.rng.pick(['Let me out of here!', 'When are they trading us back?', 'Water... please.', 'My people will come for me.', civ ? `The ${civ} won't forget this.` : 'You can\'t keep me here forever.']), 2.5);
    }
    return;
  }
  // A break for it.
  if (!n.rng.chance(dt * 0.0006)) return;
  const w = g.world;
  if (c.door && w.getBlock(c.door.x, c.y, c.door.z) === B.cell_door) w.setBlock(c.door.x, c.y, c.door.z, B.cell_door_open, 0);
  g.renderer.emit(c.door.x, c.y + 1, c.door.z, { n: 8, color: ['#8a8a98', '#5a5a68'], up: 20, speed: 30, life: 0.5 });
  g.audio?.play('break', n);
  const town = c.p ? g.world.ow.settlements[c.p.at] : null;
  const b = town ? town.bounds : null;
  const home = b ? { x: n.x < (b.x0 + b.x1) / 2 ? b.x0 - 20 : b.x1 + 20, z: Math.round((b.z0 + b.z1) / 2) } : { x: n.x + 40, z: n.z };
  n.sleeping = false;
  n.state = 'warband';
  n.warband = { kind: 'escape', foe: true, phase: 'flee', home, civ: n.settlement.civ ? n.settlement.civ.id : null, prisoner: c.p ? c.p.id : null };
  n.hostileNow = true;
  n.captive = null;
  n.say('Now! Run!', 2, '#ffb080');
  if (town && g.currentSettlement === town) g.ui.msg(`A prisoner has broken out of the cells!`, '#ffb080');
}
