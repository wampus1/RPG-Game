// Horses and wagons of your own. A wild horse (out on the plains and the
// savanna) comes round with a few handfuls of something it likes to eat,
// and is yours; put a saddle on it and you can ride it (quicker than on
// foot). A wagon you've built stands where you set it; hitch a horse of
// yours to it and you can drive it, the horse pulling. Anyone's wagon you
// can climb up into the back of, to sit a while. The town's horses and the
// traders' are theirs, not yours.
import { ITEMS } from '../world/items.js';
import { B, BLOCKS } from '../world/blocks.js';
import { removeItem, countItem, addItem } from './inventory.js';
import { letGo } from './leads.js';
import { has as heroHas } from './hero.js';
import { dirOf } from '../entities/raft.js';
import { dirAngle } from '../render/steeds.js';
import { pidOf } from '../sim/saga/refs.js';

// What a horse will come to you for.
export const HORSE_FOOD = new Set(['apple', 'carrot', 'wheat', 'berries', 'cabbage', 'hay_bale']);

export class Riding {
  constructor(game) {
    this.game = game;
    this.horses = []; // { id, x, y, z, coat, saddled, trust }
    this.wagons = []; // { id, x, y, z, face, horse (id) | null }
    this.next = 1;
  }

  horse(id) {
    return this.horses.find((h) => h.id === id) || null;
  }

  wagon(id) {
    return this.wagons.find((w) => w.id === id) || null;
  }

  // What stands still near you of yours (see game.syncStanding): your
  // horses (loose, grazing), and your wagons (with a horse in the shafts).
  standing() {
    const out = [];
    const hitched = new Set(this.wagons.map((w) => w.horse).filter((h) => h !== null && h !== undefined));
    // (Round 90: whoever's up on it, in a world with others in it: not
    // only you.)
    const mounts = this.everyone().map((q) => q.mount).filter(Boolean);
    const busy = (id) => mounts.some((m) => m.horseId === id);
    const driven = (id) => mounts.some((m) => m.kind === 'wagon' && m.wagonId === id);
    // (Round 78: not one aboard a ship, or on the ferry: see stalls.js.)
    const away = (q) => (q.aboard !== undefined && q.aboard !== null) || q.ferried;
    for (const h of this.horses) if (!hitched.has(h.id) && !busy(h.id) && !away(h)) out.push({ key: `own:h${h.id}`, type: 'horse', x: h.x, y: h.y, z: h.z, coat: h.coat, own: h, saddled: h.saddled });
    for (const w of this.wagons) {
      if (driven(w.id) || away(w)) continue;
      const h = w.horse ? this.horse(w.horse) : null;
      out.push({ key: `own:w${w.id}`, type: 'wagon', x: w.x, y: w.y, z: w.z, face: w.face ?? 1, ang: w.ang, own: w, hood: false, horse: h ? { coat: h.coat, saddle: h.saddled } : null });
    }
    return out;
  }

  // ------------------------------------------------------------ horses
  // Right-clicking a horse.
  useHorse(c) {
    const g = this.game;
    const p = g.player;
    const held = p.heldItem();
    const say = (t, col = '#c8c8c8') => g.ui.msg(t, col, true);
    if (c.distTo(p) > 3) return say('Get a little closer.');
    // Someone else's (though a citizen may take one of the town's out).
    if ((c.tie || c.loose) && !c.own && !c.leadBy) {
      if (c.town && g.sim.isCitizen(c.town.sid)) return this.borrow(c);
      if (c.loose) return say(c.town ? 'One of the town\'s horses, loose from its post. Not yours.' : 'Someone\'s horse, loose from its post. Not yours.');
      return say(c.banner ? 'A trader\'s horse, tied up by their camp. Not yours.' : c.town ? 'One of the town\'s horses. Only its citizens may take one out.' : 'Not yours to take.');
    }
    if (!c.own) {
      // Wild: tempt it with food.
      if (!held || !HORSE_FOOD.has(held)) {
        c.face(p.x, p.z);
        return say('The horse eyes you warily. Something to eat might win it over.');
      }
      removeItem(p.inv, held, 1);
      c.trust = (c.trust || 0) + 1;
      c.need ||= 2 + Math.floor(Math.random() * 3);
      c.face(p.x, p.z);
      c.calm = 6;
      g.renderer.emit(c.x, c.y + 1, c.z, { n: 3, color: ['#ff8098', '#ffc0d0'], up: 18, life: 0.8, gravity: -12, shape: 'plus' });
      if (c.trust < c.need) return say(c.trust === 1 ? 'The horse takes it from your hand, and stays put.' : 'It nuzzles you for more.', '#e8e0a0');
      this.tame(c);
      return true;
    }
    // Yours.
    if (held === 'saddle' && !c.own.saddled) {
      removeItem(p.inv, 'saddle', 1);
      c.own.saddled = true;
      c.saddled = true;
      g.audio?.play('equip');
      return say('You buckle the saddle on. Right-click to ride.', '#a0e0a0');
    }
    if (HORSE_FOOD.has(held)) {
      removeItem(p.inv, held, 1);
      g.renderer.emit(c.x, c.y + 1, c.z, { n: 3, color: ['#ff8098', '#ffc0d0'], up: 18, life: 0.8, gravity: -12, shape: 'plus' });
      return say('Your horse munches happily.', '#e8e0a0');
    }
    // One of the town's, brought back with no saddle on: in it goes.
    if (c.own.town && !c.own.saddled && this.giveBack(c.own)) return true;
    // Hitch it to a wagon of yours close by.
    const w = this.wagons.find((q) => !q.horse && Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) <= 4);
    if (w && !c.own.saddled) return this.hitch(w, c.own, c);
    if (!c.own.saddled) return say(w ? 'Take the saddle off first? (Ride it over to the wagon.)' : 'It needs a saddle before you can ride it. (Hitch it to your wagon to pull it.)');
    return this.mountHorse(c);
  }

  tame(c) {
    const g = this.game;
    const h = { id: this.next++, x: c.x, y: c.y, z: c.z, coat: c.variant || 0, saddled: false };
    this.horses.push(h);
    c.own = h;
    c.standKey = `own:h${h.id}`;
    g.tied.set(c.standKey, c);
    g.renderer.emit(c.x, c.y + 1, c.z, { n: 10, color: ['#ff8098', '#ffe070', '#ffffff'], up: 30, life: 1, gravity: -10, shape: 'plus' });
    g.ui.msg('The horse trusts you now: it\'s yours. A saddle (made at a workbench) lets you ride it.', '#a0ffa0');
    g.audio?.play('select');
    return true;
  }

  // One of the town's horses, untied and taken out by a citizen. It's
  // yours to ride till you bring it back to the stables (or the post).
  borrow(c) {
    const g = this.game;
    const L = g.sim.layoutOf(c.town.sid);
    if (!L) return false;
    g.sim.stables.lend(L, c.town.idx);
    const h = { id: this.next++, x: c.x, y: c.y, z: c.z, coat: c.variant || 0, saddled: !!c.saddled, town: { ...c.town, saddled: !!c.saddled } };
    this.horses.push(h);
    if (c.standKey) g.tied.delete(c.standKey);
    if (c.standKey && g.looseKeys) g.looseKeys.delete(c.standKey);
    c.loose = false;
    c.own = h;
    c.tie = null;
    c.tieR = undefined;
    c.standKey = `own:h${h.id}`;
    g.tied.set(c.standKey, c);
    g.audio?.play('equip');
    g.ui.msg(h.saddled ? 'You untie one of the town\'s horses. Right-click to ride it; bring it back to the stables when you\'re done.' : 'You untie one of the town\'s horses. It has no saddle yet (put one of yours on to ride it).', '#a0e0a0');
    return true;
  }

  // Where a town's horses are kept: its stables' door, or the post.
  homeOf(h) {
    const g = this.game;
    const L = h.town ? g.sim.layoutOf(h.town.sid) : null;
    if (!L) return null;
    const sb = g.sim.stables.stablesOf(L);
    return { L, at: sb ? sb.outside || sb.door : L.econ.hitch };
  }

  // Back home with one of the town's: the handler takes it in.
  giveBack(h) {
    const g = this.game;
    const home = this.homeOf(h);
    if (!home || !home.at) return false;
    const p = g.player;
    if (Math.max(Math.abs(p.x - home.at.x), Math.abs(p.z - home.at.z)) > 10) return false;
    g.sim.stables.giveBackLent(home.L, h.town.idx);
    this.horses = this.horses.filter((q) => q !== h);
    for (const c of g.creatures) if (c.own === h) this.remove(c);
    // (Your own saddle comes off again.)
    if (h.saddled && !h.town.saddled) {
      addItem(p.inv, 'saddle', 1);
      g.ui.msg('You take your saddle off and hand the horse back to the stables.', '#c8e0ff');
    } else g.ui.msg('You hand the horse back to the stables.', '#c8e0ff');
    return true;
  }

  mountHorse(c) {
    const g = this.game;
    const p = g.player;
    const h = c.own;
    p.sitting = null;
    // (Round 82: facing the way the horse was.)
    p.mount = { kind: 'horse', coat: h.coat, saddle: true, horseId: h.id, town: !!h.town, ang: dirAngle(c.dir ?? 0) };
    p.teleport(c.x, c.y, c.z);
    p.tankOff = null;
    p.tankTo = null;
    this.remove(c);
    g.ui.msg('You swing up into the saddle. (F to get down.)', '#a0e0a0');
    g.audio?.play('step_grass');
    return true;
  }

  remove(c) {
    const g = this.game;
    // (Up in the saddle: the lead comes off and back to your pack.)
    if (c.leadBy === g.player || c.leadTied) letGo(g, c, true);
    c.dead = true;
    g.removeOcc?.(c);
    if (c.standKey) g.tied.delete(c.standKey);
  }

  // ------------------------------------------------------------ wagons
  // Set a wagon you've built down on the ground.
  placeWagon(x, y, z) {
    const g = this.game;
    const p = g.player;
    if (!ITEMS.wagon || countItem(p.inv, 'wagon') <= 0) return false;
    const w0 = g.world;
    if (w0.getBlock(x, y, z) !== B.air || !BLOCKS[w0.getBlock(x, y - 1, z)].solid) {
      g.ui.msg('There\'s no room for a wagon there.', '#c8c8c8', true);
      return false;
    }
    removeItem(p.inv, 'wagon', 1);
    // (Round 90: whose it is, so only they take up its reins.)
    this.wagons.push({ id: this.next++, x, y, z, face: p.dir === 3 ? 3 : 1, horse: null, owner: pidOf(p) });
    g.ui.msg('Your wagon stands ready. Hitch a horse of yours to it to drive it.', '#a0e0a0');
    g.audio?.play('place');
    return true;
  }

  hitch(w, h, c = null) {
    const g = this.game;
    w.horse = h.id;
    if (c) this.remove(c);
    g.ui.msg('You back the horse into the shafts and buckle the harness. Right-click the wagon to drive.', '#a0e0a0');
    g.audio?.play('equip');
    return true;
  }

  // Right-clicking a wagon that's standing still: where on it you clicked
  // (`part`: its bench at the front, or the bed at the back) is where you
  // go. Yours, with a horse in the shafts: the bench is the driver's seat.
  useWagon(prop, part = 'back') {
    const g = this.game;
    const p = g.player;
    const say = (t, col = '#c8c8c8') => g.ui.msg(t, col, true);
    if (Math.max(Math.abs(prop.x - p.x), Math.abs(prop.z - p.z)) > 3) return say('Get a little closer.');
    const w = prop.own || null;
    // (Round 90) Someone else's (another player's): up beside them on the
    // bench, or in the back, but not at the reins.
    const theirs = w && w.owner !== undefined && w.owner !== null && w.owner !== pidOf(p);
    if (w && this.everyone().some((q) => q !== p && q.mount && q.mount.kind === 'wagon' && q.mount.wagonId === w.id)) return say('Someone\'s driving it.');
    if (w && part === 'bench' && !theirs) {
      // Riding up on a horse of yours: into the shafts with it.
      if (p.mount && p.mount.kind === 'horse' && !w.horse) {
        const h = this.horse(p.mount.horseId);
        p.mount = null;
        this.hitch(w, h);
        return this.drive(w);
      }
      if (!w.horse) {
        const loose = g.creatures.find((q) => q.own && !q.dead && Math.max(Math.abs(q.x - w.x), Math.abs(q.z - w.z)) <= 5);
        if (loose) return this.hitch(w, loose.own, loose);
        return say('It needs a horse in the shafts. (Bring one of yours close and right-click it.)');
      }
      return this.drive(w);
    }
    // Anyone's wagon (or the back of yours): up onto the bench, or into the
    // back, and sit a while.
    p.mount = null;
    p.inWagon = prop;
    // (Round 90: one of a player's own, by its own id: carried along with
    // it when it's driven, wherever it goes.)
    p.inWagonId = w ? w.id : null;
    p.wagonSeat = part === 'bench' && !(theirs && this.everyone().some((q) => q !== p && q.inWagonId === w.id && q.wagonSeat === 'bench')) ? 'bench' : 'back';
    p.sitting = null;
    p.teleport(prop.x, prop.y, prop.z);
    this.seatShown(prop);
    say(p.wagonSeat === 'bench' ? 'You climb up onto the bench. (Move to climb down.)' : 'You climb up into the back of the wagon. (Move to climb down.)', '#c8e0ff');
    return true;
  }

  // Who's shown sat on a standing wagon: you, on its bench or in its back.
  seatShown(prop) {
    // (Round 78) A coach or ferry carrying someone: them, and its driver.
    if (prop.ride) {
      prop.bench = prop.driver || null;
      prop.riders = prop.rideOwner && prop.rideOwner.look ? [prop.rideOwner.look] : [];
      return;
    }
    // (Round 90: everyone sat in it, not only you.)
    const inIt = this.everyone().filter((q) => q.inWagon === prop || (prop.own && q.inWagonId === prop.own.id));
    const bench = inIt.find((q) => q.wagonSeat === 'bench');
    prop.bench = bench ? bench.look : null;
    prop.riders = inIt.filter((q) => q !== bench).map((q) => q.look);
  }

  // Everyone playing (or just you).
  everyone() {
    const g = this.game;
    return (g.everyone ? g.everyone() : [g.player]).filter((q) => q && !q.dead);
  }

  // (Round 90) Each frame: whoever's sat in a player's wagon, carried along
  // with it while it's driven (and shown sat in it, on the driver's
  // wagon); put back in it where it stands when it's stopped; and out of
  // it if it's gone.
  carry() {
    const g = this.game;
    const all = this.everyone();
    const drivers = new Map();
    for (const q of all) if (q.mount && q.mount.kind === 'wagon') drivers.set(q.mount.wagonId, q);
    for (const d of drivers.values()) {
      const inIt = all.filter((q) => q.inWagonId === d.mount.wagonId);
      const bench = inIt.find((q) => q.wagonSeat === 'bench');
      d.mount.riders = inIt.filter((q) => q !== bench).map((q) => q.look);
      d.mount.benchMate = bench ? bench.look : null;
    }
    for (const q of all) {
      if (q.inWagonId === null || q.inWagonId === undefined) continue;
      const d = drivers.get(q.inWagonId);
      if (d) {
        if (q.x !== d.x || q.z !== d.z || q.y !== d.y) {
          if (Math.abs(q.x - d.x) + Math.abs(q.z - d.z) > 2 || q.moving) q.teleport(d.x, d.y, d.z);
          else q.startMove(d.x, d.y, d.z, 0.12);
        }
        continue;
      }
      // (Stopped: the one standing there now.)
      const prop = [...g.props.values()].find((o) => o.own && o.own.id === q.inWagonId);
      if (prop) {
        q.inWagon = prop;
        if (q.x !== prop.x || q.z !== prop.z) q.teleport(prop.x, prop.y, prop.z);
      } else if (!this.wagons.some((w) => w.id === q.inWagonId)) {
        q.inWagon = null;
        q.inWagonId = null;
        q.wagonSeat = null;
      }
    }
  }

  drive(w) {
    const g = this.game;
    const p = g.player;
    const h = this.horse(w.horse);
    p.inWagon = null;
    p.sitting = null;
    p.mount = { kind: 'wagon', coat: h ? h.coat : 0, saddle: !!(h && h.saddled), hood: false, wagonId: w.id, horseId: w.horse, ang: typeof w.ang === 'number' ? w.ang : dirAngle(w.face ?? 1), look: w.wagonLook };
    p.teleport(w.x, w.y, w.z);
    p.tankOff = null;
    p.tankTo = null;
    g.ui.msg('You take up the reins. (F to get down.)', '#a0e0a0');
    return true;
  }

  // Down off the horse (it stays where you leave it), or down off the
  // wagon's bench (horse and wagon wait there).
  dismount() {
    const g = this.game;
    const p = g.player;
    const m = p.mount;
    if (!m) return false;
    p.mount = null;
    if (m.kind === 'horse') {
      const h = this.horse(m.horseId);
      if (h) Object.assign(h, { x: p.x, y: p.y, z: p.z, dir: dirOf(m.ang ?? 0) });
      // Ridden back to the stables: it goes back in.
      if (h && h.town) this.giveBack(h);
    } else {
      const w = this.wagon(m.wagonId);
      // (Round 82: left standing the way it was heading.)
      if (w) Object.assign(w, { x: p.x, y: p.y, z: p.z, face: dirOf(m.ang ?? 0), ang: m.ang ?? dirAngle(1) });
    }
    p.tankOff = null;
    p.tankTo = null;
    // Step down beside it.
    const spot = g.findFreeSpot(p.x + 1, p.z, p.y);
    if (spot) p.teleport(spot.x, spot.y, spot.z);
    g.standT = 0;
    g.audio?.play('step_grass');
    g.ui.msg(m.kind === 'horse' ? 'You slide down from the saddle.' : 'You climb down from the bench.', '#c8c8c8', true);
    return true;
  }

  // Out of the back of someone's wagon.
  climbOut() {
    const g = this.game;
    const p = g.player;
    if (!p.inWagon) return false;
    const prop = p.inWagon;
    p.inWagon = null;
    p.inWagonId = null;
    p.wagonSeat = null;
    this.seatShown(prop);
    const spot = g.findFreeSpot(p.x, p.z + 1, p.y);
    if (spot) p.teleport(spot.x, spot.y, spot.z);
    return true;
  }

  // How much quicker you go (step time multiplier).
  pace() {
    const m = this.game.player.mount;
    return (!m ? 1 : m.kind === 'horse' ? 0.55 : 0.7) * (m && heroHas(this.game.hero, 'rider') ? 0.82 : 1) * (m && heroHas(this.game.hero, 'saddle_sore') ? 1.25 : 1);
  }

  // Your horses wander a little: keep track of where they are.
  update() {
    for (const c of this.game.creatures) {
      if (!c.own || c.dead) continue;
      c.own.x = c.x;
      c.own.y = c.y;
      c.own.z = c.z;
    }
  }

  serialize() {
    return { horses: this.horses, wagons: this.wagons, next: this.next };
  }

  load(d) {
    this.horses = (d && d.horses) || [];
    this.wagons = (d && d.wagons) || [];
    this.next = (d && d.next) || 1;
  }
}


// ------------------------------------------------------------ tank controls
// (Round 82) In the saddle, or on a wagon's bench, you steer it as it is:
// A and D turn it (to its own left and right, whichever way the camera's
// turned), W drives it on the way it's heading, S backs it up (slower).
// It goes square by square still, but along the line it's heading (a
// slant a step across now and then, as a line drawn on squares does), and
// it's drawn going smoothly along that line, turned to it (see
// Player.renderPos, render/steeds.js).
const TAU = Math.PI * 2;
// (How quickly each turns, a second: a horse on the spot, a wagon wider.)
const TURN = { horse: 3.4, wagon: 2.1 };
const keyDown = (input, ...ks) => ks.some((k) => input.isDown(k));

export function turnMount(p, dt, input) {
  const m = p.mount;
  if (!m) return;
  if (typeof m.ang !== 'number') m.ang = dirAngle(p.dir ?? 0);
  const left = keyDown(input, 'KeyA', 'ArrowLeft');
  const right = keyDown(input, 'KeyD', 'ArrowRight');
  if (left === right) return;
  const rate = (TURN[m.kind] || 2.6) * (p.moving ? 1 : 0.75) * (heroHas(p.game.hero, 'rider') ? 1.15 : 1);
  m.ang += (left ? 1 : -1) * rate * dt;
  m.ang = ((m.ang % TAU) + TAU) % TAU;
  if (!p.bowDraw) p.dir = dirOf(m.ang);
}

// The next square along the heading (W on, S back), or null if neither's
// held: { dx, dz, mul (how much longer the step takes), from, to (where
// it's drawn, start and end), off }. Never a slant across a corner: only
// where both ways round it are clear (else straight on, along the wall).
export function mountStep(p, input) {
  const m = p.mount;
  if (!m) return null;
  const fwd = keyDown(input, 'KeyW', 'ArrowUp');
  const back = !fwd && keyDown(input, 'KeyS', 'ArrowDown');
  if (!fwd && !back) return null;
  if (typeof m.ang !== 'number') m.ang = dirAngle(p.dir ?? 0);
  const sg = fwd ? 1 : -1;
  const o = p.tankOff;
  const off = o && p.tankTo && Math.abs(p.tankTo.x - o.x - p.x) < 0.01 && Math.abs(p.tankTo.z - o.z - p.z) < 0.01 ? o : { x: 0, z: 0 };
  const ax = off.x + Math.sin(m.ang) * sg;
  const az = off.z + Math.cos(m.ang) * sg;
  let dx = Math.round(ax);
  let dz = Math.round(az);
  if (!dx && !dz) {
    if (Math.abs(ax) > Math.abs(az)) dx = Math.sign(ax);
    else dz = Math.sign(az) || 1;
  }
  if (dx && dz) {
    const w = p.game.world;
    const ok = (x, z) => {
      const y = w.stepTarget(p.x, p.y, p.z, x, z, false, false);
      return y >= 0 && !p.game.occupiedBySolid(x, y, z, p);
    };
    const okX = ok(p.x + dx, p.z);
    const okZ = ok(p.x, p.z + dz);
    if (!okX || !okZ) {
      if (okX && !okZ) dz = 0;
      else if (okZ && !okX) dx = 0;
      else if (Math.abs(ax) >= Math.abs(az)) dz = 0;
      else dx = 0;
    }
  }
  const cl = (v) => Math.max(-0.5, Math.min(0.5, v));
  const nOff = { x: cl(ax - dx), z: cl(az - dz) };
  return {
    dx,
    dz,
    mul: Math.hypot(dx, dz) * (back ? 1.7 : 1),
    from: { x: p.x + off.x, z: p.z + off.z },
    to: { x: p.x + dx + nOff.x, z: p.z + dz + nOff.z },
    off: nOff,
  };
}
