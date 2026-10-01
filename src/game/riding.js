// Horses and wagons of your own. A wild horse (out on the plains and the
// savanna) comes round with a few handfuls of something it likes to eat,
// and is yours; put a saddle on it and you can ride it (quicker than on
// foot). A wagon you've built stands where you set it; hitch a horse of
// yours to it and you can drive it, the horse pulling. Anyone's wagon you
// can climb up into the back of, to sit a while. The town's horses and the
// traders' are theirs, not yours.
import { ITEMS } from '../world/items.js';
import { B, BLOCKS } from '../world/blocks.js';
import { removeItem, countItem } from './inventory.js';

// What a horse will come to you for.
export const HORSE_FOOD = new Set(['apple', 'carrot', 'wheat', 'berries', 'cabbage']);

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
    const riding = this.game.player.mount;
    const busy = (id) => riding && (riding.horseId === id);
    for (const h of this.horses) if (!hitched.has(h.id) && !busy(h.id)) out.push({ key: `own:h${h.id}`, type: 'horse', x: h.x, y: h.y, z: h.z, coat: h.coat, own: h, saddled: h.saddled });
    for (const w of this.wagons) {
      if (riding && riding.wagonId === w.id) continue;
      const h = w.horse ? this.horse(w.horse) : null;
      out.push({ key: `own:w${w.id}`, type: 'wagon', x: w.x, y: w.y, z: w.z, face: w.face ?? 1, own: w, hood: false, horse: h ? { coat: h.coat, saddle: h.saddled } : null });
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
    // Someone else's.
    if (c.tie && !c.own) return say(c.banner ? 'A trader\'s horse, tied up by their camp. Not yours.' : 'One of the town\'s horses. Not yours to take.');
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

  mountHorse(c) {
    const g = this.game;
    const p = g.player;
    const h = c.own;
    p.sitting = null;
    p.mount = { kind: 'horse', coat: h.coat, saddle: true, horseId: h.id };
    p.teleport(c.x, c.y, c.z);
    this.remove(c);
    g.ui.msg('You swing up into the saddle. (F to get down.)', '#a0e0a0');
    g.audio?.play('step_grass');
    return true;
  }

  remove(c) {
    const g = this.game;
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
    this.wagons.push({ id: this.next++, x, y, z, face: p.dir === 3 ? 3 : 1, horse: null });
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

  // Right-clicking a wagon that's standing still.
  useWagon(prop) {
    const g = this.game;
    const p = g.player;
    const say = (t, col = '#c8c8c8') => g.ui.msg(t, col, true);
    if (Math.max(Math.abs(prop.x - p.x), Math.abs(prop.z - p.z)) > 3) return say('Get a little closer.');
    const w = prop.own || null;
    if (w) {
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
    // Anyone's wagon: climb up into the back and sit a while.
    p.mount = null;
    p.inWagon = prop;
    p.sitting = null;
    p.teleport(prop.x, prop.y, prop.z);
    say('You climb up into the back of the wagon. (Move to climb down.)', '#c8e0ff');
    return true;
  }

  drive(w) {
    const g = this.game;
    const p = g.player;
    const h = this.horse(w.horse);
    p.inWagon = null;
    p.sitting = null;
    p.mount = { kind: 'wagon', coat: h ? h.coat : 0, saddle: !!(h && h.saddled), hood: false, wagonId: w.id, horseId: w.horse };
    p.teleport(w.x, w.y, w.z);
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
      if (h) Object.assign(h, { x: p.x, y: p.y, z: p.z });
    } else {
      const w = this.wagon(m.wagonId);
      if (w) Object.assign(w, { x: p.x, y: p.y, z: p.z, face: p.dir === 3 || p.sideLeft === false ? 3 : 1 });
    }
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
    p.inWagon = null;
    const spot = g.findFreeSpot(p.x, p.z + 1, p.y);
    if (spot) p.teleport(spot.x, spot.y, spot.z);
    return true;
  }

  // How much quicker you go (step time multiplier).
  pace() {
    const m = this.game.player.mount;
    return !m ? 1 : m.kind === 'horse' ? 0.55 : 0.7;
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

