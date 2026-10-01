// How raiders, soldiers and riders behave on the ground (an NPC in the
// 'warband' state). Raiders make for the town square, fight whoever stands
// in their way, grab what they can and run; soldiers keep to their
// captain's plan (a line advancing, a wing swinging wide round the flank,
// both wings closing in a pincer, holding their ground or a log wall, a
// feigned retreat that turns on the chasers) until the fighting reaches
// them, and fall back when badly hurt; the watch rides out on horseback to
// meet raiders in the fields.

import { B } from '../world/blocks.js';

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
  if (wb.kind === 'raid') return raider(n, wb, dt);
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

// Off home: out of sight, out of the world.
function leave(n, wb, dt) {
  const g = n.game;
  const h = wb.home;
  wb.leaveT = (wb.leaveT || 0) + dt;
  if (!h || far(n, h.x, h.z) <= 2 || n.distTo(g.player) > 34 || wb.leaveT > (wb.kind === 'escape' ? 120 : 60)) {
    // (An escaping prisoner out of sight has got away.)
    if (wb.kind === 'escape') n.escaped = true;
    g.despawnNpc(n);
    return;
  }
  goTo(n, h.x, h.z, 1);
}

// ------------------------------------------------------------ raiders
function raider(n, wb, dt) {
  const g = n.game;
  const L = g.sim.war.live;
  if (wb.torch && n.rng.chance(0.3)) g.renderer.emit(n.x, n.y + 1.6, n.z, { n: 1, color: ['#ffb040', '#ff7020', '#ffe080'], up: 14, speed: 4, life: 0.35, gravity: -30, oy: -14 });
  if (wb.phase === 'flee') return leave(n, wb, dt);
  if (!L || L.kind !== 'raid' || L.raid.id !== wb.raid) {
    wb.phase = 'flee';
    return;
  }
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
  if (!t) {
    if (!n.moving && n.rng.chance(dt)) n.face(c.x - ax.x * s * 10, c.z - ax.z * s * 10);
    return;
  }
  const d = n.distTo(t);
  const enemy = {
    x: foes.reduce((m, q) => m + q.x, 0) / foes.length,
    z: foes.reduce((m, q) => m + q.z, 0) / foes.length,
  };
  // Drawn up: a breath before it starts.
  if (wb.phase === 'form') {
    if (L.t < 3) {
      n.face(t.x, t.z);
      if (n.rng.chance(dt * 0.4)) n.say(n.rng.pick(['Steady...', 'Hold the line!', 'Shields up!', 'For the realm!', 'Here they come!']), 1.8, '#ffe070');
      return;
    }
    wb.phase = 'move';
  }
  const tac = side.tactic;
  const dug = tac === 'hold' || tac === 'works';
  // Bows out at a distance (on foot), blades up close.
  const bow = n.rec.equipment.items.some((i) => i.item === 'bow') && (n.rec.inv || []).some((q) => q && q.item === 'arrow' && q.count > 0);
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
  if (night !== !!n.sleeping) {
    n.sleeping = night;
    if (night && c.bed) n.teleport(c.bed.x, c.y, c.bed.z);
    else if (!night) n.teleport(c.stand.x, c.y, c.stand.z);
  }
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
