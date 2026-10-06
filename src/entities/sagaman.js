// How the stories' own people behave on the ground (round 52; see
// sim/saga). Two kinds:
//   - fighters (the 'warband' state, a warband of kind 'saga'): killers
//     sent after someone (by name: they find you, and some have orders to
//     take you alive), an ambush sprung, a posse of the watch and
//     adventurers out after outlaws, a champion who's called you out;
//   - those you can talk to (the 'saga' state): a messenger with a letter
//     for you, an outlaw chief waiting at a meeting, a captive in a cage,
//     a lost child, someone to lead home. Some follow you once you've
//     spoken to them.
import { playerOf } from '../sim/saga/refs.js';

const far = (n, x, z) => Math.max(Math.abs(n.x - x), Math.abs(n.z - z));

function goTo(n, x, z, near = 1) {
  x = Math.round(x);
  z = Math.round(z);
  const box = { x0: Math.min(n.x, x) - 14, z0: Math.min(n.z, z) - 14, x1: Math.max(n.x, x) + 14, z1: Math.max(n.z, z) + 14 };
  return n.followPath({ x, y: n.y, z }, near, box);
}

// Caught up out of sight (a long way to come, or no path).
function catchUp(n, p, dt, d) {
  const g = n.game;
  n.sagaStuck = (n.sagaStuck || 0) + dt;
  if (d < 26 && n.sagaStuck < 6) return false;
  if (g.inSight(n.x, n.z, -4)) return false;
  const ang = Math.atan2(n.z - p.z, n.x - p.x);
  for (const r of [16, 14, 12]) {
    const x = Math.round(p.x + Math.cos(ang) * r);
    const z = Math.round(p.z + Math.sin(ang) * r);
    if (!g.world.regionAt(x, z)) continue;
    const y = g.world.findStandY(x, z, p.y);
    if (y <= 0 || g.world.isWaterAt(x, y, z)) continue;
    const spot = g.findFreeSpot(x, z, y);
    if (!spot) continue;
    n.teleport(spot.x, spot.y, spot.z);
    n.path = null;
    n.sagaStuck = 0;
    return true;
  }
  return false;
}

function strike(n, t, dt) {
  // (How long at this fight, kept apart from how long they've been out:
  // see NPC.fight.)
  if (n.threat !== t) n.warFightT = 0;
  n.warFightT = (n.warFightT || 0) + dt;
  n.threat = t;
  n.fight(dt);
  if (n.state !== 'warband' && n.state !== 'fight') n.state = 'warband';
}

function nearestFoe(n, list, r) {
  let best = null;
  let bd = r + 1;
  for (const t of list) {
    if (!t || t.dead || t.down || t === n) continue;
    const d = n.distTo(t);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

function leave(n, wb, dt) {
  const g = n.game;
  wb.leaveT = (wb.leaveT || 0) + dt;
  const p = g.closestPlayer(n.x, n.z).p;
  if (!wb.away || far(n, wb.away.x, wb.away.z) <= 2) wb.away = { x: Math.round(n.x + (Math.sign(n.x - p.x) || 1) * 18), z: Math.round(n.z + (Math.sign(n.z - p.z) || 1) * 18) };
  if ((!g.inSight(n.x, n.z, 2) && wb.leaveT > 3) || wb.leaveT > 60) {
    g.despawnNpc(n);
    return;
  }
  goTo(n, wb.away.x, wb.away.z, 1);
}

// ------------------------------------------------------------ fighters
export function sagaFight(n, dt) {
  const wb = n.warband;
  const g = n.game;
  if (wb.phase === 'flee' || wb.phase === 'done') return leave(n, wb, dt);
  // A champion in single combat yields, beaten (and keeps their word).
  if (wb.role === 'champion' && n.hp < n.maxHp * 0.25) {
    n.say(n.rng.pick(['Enough! I yield!', 'Hold! You have me. I yield.', 'Stop... I yield.']), 3, '#ffe070');
    wb.phase = 'done';
    n.threat = null;
    g.sim.saga?.emit('duel_won', { actor: n.sagaKey, target: wb.target });
    return;
  }
  if (n.hp < n.maxHp * (wb.brave ? 0.15 : 0.3) && wb.role !== 'champion') {
    wb.phase = 'flee';
    n.say(n.rng.pick(wb.fleeLines || ['Enough! I\'m off!', 'Not worth dying for!', 'Fall back!']), 2, '#ffb080');
    return;
  }
  switch (wb.role) {
    case 'hunter':
    case 'ambush':
    case 'champion':
      return hunter(n, wb, dt);
    case 'posse':
      return posse(n, wb, dt);
    case 'sentry':
      return sentry(n, wb, dt);
    default:
      return sentry(n, wb, dt);
  }
}

// After someone by name.
function hunter(n, wb, dt) {
  const g = n.game;
  const p = playerOf(g, wb.target);
  if (!p || p.dead || p.limbo) {
    wb.lostT = (wb.lostT || 0) + dt;
    if (wb.lostT > 20) wb.phase = 'done';
    if (wb.home) goTo(n, wb.home.x, wb.home.z, 2);
    return;
  }
  // (Taken already: their work's done.)
  if (p.sagaHeld) {
    wb.phase = 'done';
    return;
  }
  const d = n.distTo(p);
  if (!wb.spotted && d <= 14) {
    wb.spotted = true;
    n.face(p.x, p.z);
    n.say(wb.cry || n.rng.pick(['There you are!', 'That\'s the one!', 'Get them!']), 3, '#ff9080');
  }
  if (d <= (wb.role === 'champion' ? 8 : 6) || n.threat === p) {
    n.sagaStuck = 0;
    return strike(n, p, dt);
  }
  if (d > 40 && catchUp(n, p, dt, d)) return;
  goTo(n, p.x, p.z, 1);
}

// The watch and adventurers, out after a band (or a beast).
function posse(n, wb, dt) {
  const g = n.game;
  const foes = g.npcs.filter((q) => !q.dead && !q.down && q.warband && q.warband.foe && q !== n && (q.warband.kind === 'bandit' || q.warband.kind === 'saga'));
  for (const c of g.creatures) if (!c.dead && c.hostileNow) foes.push(c);
  const t = nearestFoe(n, foes, 9);
  if (t) return strike(n, t, dt);
  const goal = wb.goal;
  if (!goal) return leave(n, wb, dt);
  if (far(n, goal.x, goal.z) > 3) {
    if (!goTo(n, goal.x, goal.z, 2)) return;
  }
  // There, and nobody to fight: done.
  wb.idleT = (wb.idleT || 0) + dt;
  if (wb.idleT > 8) {
    if (!wb.cheered) {
      wb.cheered = true;
      n.say(n.rng.pick(['That\'s the lot of them.', 'Done here.', 'Back to town, then.']), 3);
    }
    wb.phase = 'done';
  }
}

// Standing guard over somewhere (a cage, a meeting place): anyone who
// comes too near, or strikes them, is set on.
function sentry(n, wb, dt) {
  const g = n.game;
  const h = wb.home || { x: n.x, z: n.z };
  let t = n.threat && !n.threat.dead ? n.threat : null;
  if (!t) {
    for (const q of g.everyone()) {
      if (q.dead || q.limbo || q.sagaHeld) continue;
      if (wb.spare && wb.spare.includes(q.seat ? (q.seat.host ? 'host' : String(q.seat.id)) : 'host')) continue;
      if (n.distTo(q) <= (wb.reach || 6)) t = q;
    }
  }
  if (t) {
    if (!wb.warned) {
      wb.warned = true;
      n.say(n.rng.pick(['Back off!', 'Nobody gets near the cage.', 'You want to join them in there?']), 2.5, '#ff9080');
    }
    return strike(n, t, dt);
  }
  if (far(n, h.x, h.z) > 2) return void goTo(n, h.x, h.z, 1);
  if (!n.moving && n.rng.chance(dt * 0.02)) n.say(n.rng.pick(wb.idle || ['Quiet out here.', 'Who\'s next on watch?', 'Cold tonight.']), 2.5);
}

// ------------------------------------------------------------ those you talk to
export function sagaTalk(n, dt) {
  const s = n.saga;
  const g = n.game;
  if (!s) {
    n.state = 'routine';
    return;
  }
  if (s.leaving) return leave(n, s, dt);
  if (s.homeward) return homeward(n, s, dt);
  if (s.follow) return follow(n, s, dt);
  if (s.seek) return seek(n, s, dt);
  // Standing where they are (or where they're told to).
  const h = s.home;
  if (h && far(n, h.x, h.z) > (s.roam || 1)) {
    goTo(n, h.x, h.z, 1);
    return;
  }
  s.lineT = (s.lineT ?? 3) - dt;
  const p = g.closestPlayer(n.x, n.z);
  if (s.lineT <= 0 && p.d < 10 && s.lines && s.lines.length) {
    s.lineT = n.rng.float(9, 18);
    n.say(n.rng.pick(s.lines), 3, s.lineColor || undefined);
  }
  if (p.d < 7 && !n.moving && n.rng.chance(dt * 0.6)) n.face(p.p.x, p.p.z);
}

// On home alone (a captive led back to their own people: see captive.js),
// out of the world once there, or once out of sight a while.
function homeward(n, s, dt) {
  const g = n.game;
  s.walkT = (s.walkT || 0) + dt;
  const there = far(n, s.homeward.x, s.homeward.z) <= 3;
  if (there || (s.walkT > 4 && !g.inSight(n.x, n.z, 2)) || s.walkT > 120) {
    g.despawnNpc(n);
    return;
  }
  goTo(n, s.homeward.x, s.homeward.z, 2);
}

// Off to find someone by name, to have a word with them.
function seek(n, s, dt) {
  const g = n.game;
  const p = playerOf(g, s.seek);
  if (!p || p.dead || p.limbo) {
    s.lostT = (s.lostT || 0) + dt;
    if (s.lostT > 30) s.leaving = true;
    return;
  }
  const d = n.distTo(p);
  if (d <= 2.5) {
    n.path = null;
    n.face(p.x, p.z);
    if (!s.hailed) {
      s.hailed = true;
      n.say(s.hail || 'A word with you.', 3.5, '#e8d0a0');
    }
    s.waitT = (s.waitT || 0) + dt;
    // (Ignored long enough: they leave it.)
    if (s.waitT > (s.patience || 90)) {
      s.leaving = true;
      s.ignored = true;
      n.say(s.ignoredLine || 'Suit yourself.', 2.5);
    }
    return;
  }
  if (d > 40 && catchUp(n, p, dt, d)) return;
  goTo(n, p.x, p.z, 2);
}

// Keeping close behind someone (led home, led to safety).
function follow(n, s, dt) {
  const g = n.game;
  const p = playerOf(g, s.follow);
  if (!p || p.dead) {
    s.follow = null;
    s.home = { x: Math.round(n.x), z: Math.round(n.z) };
    return;
  }
  const d = Math.max(Math.abs(p.x - n.x), Math.abs(p.z - n.z));
  if (d > 22 || Math.abs(p.y - n.y) > 6 || (n.pathFails > 2 && d > 5)) {
    const spot = g.findFreeSpot(p.x - (p.dir === 3 ? 1 : p.dir === 1 ? -1 : 0), p.z - (p.dir === 0 ? 1 : p.dir === 2 ? -1 : 0), p.y);
    if (spot) {
      n.teleport(spot.x, spot.y, spot.z);
      n.path = null;
      n.pathFails = 0;
    }
    return;
  }
  s.lineT = (s.lineT ?? 20) - dt;
  if (d <= 2) {
    n.path = null;
    if (s.lineT <= 0 && s.lines && s.lines.length) {
      s.lineT = n.rng.float(25, 60);
      n.say(n.rng.pick(s.lines), 3);
    }
    return;
  }
  if (!n.fgoal || Math.abs(n.fgoal.x - p.x) + Math.abs(n.fgoal.z - p.z) > 1) {
    n.fgoal = { x: p.x, y: p.y, z: p.z };
    n.path = null;
  }
  const box = { x0: Math.min(n.x, p.x) - 12, z0: Math.min(n.z, p.z) - 12, x1: Math.max(n.x, p.x) + 12, z1: Math.max(n.z, p.z) + 12 };
  n.followPath(n.fgoal, 1, box);
}

// ------------------------------------------------------------ a mod's story's orders
// (Round 68) Someone of a town a mod's story has told what to do (see
// mod/storyrun2.js): follow a player in it (`follow`: their pid), go to a
// place and stay there (`home`), or stand where they are. Talked to as
// themselves all the while (their story's words with them).
export function storyTick(n, dt) {
  const s = n.storyOrder;
  if (!s) {
    n.state = 'routine';
    return;
  }
  if (s.follow) {
    follow(n, s, dt);
    if (!s.follow) s.home = { x: Math.round(n.x), z: Math.round(n.z) };
    return;
  }
  const h = s.home;
  if (h && far(n, h.x, h.z) > (s.roam ?? 1)) {
    s.there = false;
    goTo(n, h.x, h.z, 1);
    return;
  }
  s.there = true;
  const p = n.game.closestPlayer(n.x, n.z);
  if (p && p.d < 7 && !n.moving && n.rng.chance(dt * 0.6)) n.face(p.p.x, p.p.z);
}
