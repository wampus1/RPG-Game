// Standing at a portal: where it can take you (every other portal of the
// same realm, nearest first), and what it costs if you're not of the realm.
// Pick one and step through.
import { Window } from './window.js';
import { C } from './ascii.js';
import { teleportTo } from '../game/commands.js';
import { GROUND } from '../config.js';
import { removeItem } from '../game/inventory.js';

export class PortalWindow extends Window {
  constructor(ui, game, sid) {
    const P = game.sim.portals;
    const here = game.world.ow.settlements[sid];
    const dests = P.network(sid).map((q) => ({ q, s: game.world.ow.settlements[q.sid] }))
      .sort((a, b) => Math.hypot(a.s.cx - here.cx, a.s.cz - here.cz) - Math.hypot(b.s.cx - here.cx, b.s.cz - here.cz));
    // (Wide enough for the realm's name and the furthest town's.)
    const realm = here.civ ? here.civ.name.replace(/^The /, '') : '';
    const wide = Math.max(`Through to another town of the ${realm}`.length + 6, ...dests.map(({ s }) => s.name.length + 30));
    super(ui, Math.min(72, Math.max(46, wide)), Math.max(9, 9 + dests.length), { kind: 'portal' });
    this.game = game;
    this.sid = sid;
    this.dests = dests;
    this.sel = 0;
  }

  draw(g, game) {
    const here = game.world.ow.settlements[this.sid];
    const P = game.sim.portals;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, '#100c1c');
    g.box(0, 0, this.w, this.h, { bg: '#100c1c', double: true, title: 'THE PORTAL' });
    if (!P.open(this.sid)) {
      g.center(2, 'The arch is dark.', C.dim);
      g.center(4, here.civ ? `The ${here.civ.name.replace(/^The /, '')} doesn't know the art:` : 'It answers to no realm now:', C.fg);
      g.center(5, 'its other ends are closed to it.', C.fg);
      g.center(this.h - 2, '[ESC] step back', C.faint);
      return;
    }
    if (!this.dests.length) {
      g.center(2, 'The light swirls, but goes nowhere yet:', C.fg);
      g.center(3, 'no other town of the realm has a portal.', C.dim);
      g.center(this.h - 2, '[ESC] step back', C.faint);
      return;
    }
    const fare = P.fareFor(this.sid);
    g.center(2, `Through to another town of the ${here.civ.name.replace(/^The /, '')}`, C.fg);
    g.center(3, fare ? `¤${fare} to the keeper (free to the realm's own folk)` : 'Free to the realm\'s own folk', C.dim);
    this.dests.forEach(({ s }, i) => {
      const y = 5 + i;
      const on = i === this.sel || this.hovering(2, y, this.w - 4, 1);
      if (this.hovering(2, y, this.w - 4, 1)) this.sel = i;
      g.fill(2, y, this.w - 4, 1, ' ', C.fg, on ? C.bgHi : '#100c1c');
      const d = Math.round(Math.hypot(s.cx - here.cx, s.cz - here.cz) * 10) / 10;
      g.text(3, y, `${i + 1}. ${s.name}`, on ? C.white : C.hi);
      const what = `${s.type}, ${d} leagues`;
      g.text(this.w - 3 - what.length, y, what, C.dim);
      this.hit(2, y, this.w - 4, 1, () => this.go(i));
    });
    g.center(this.h - 2, '↑↓ choose · [ENTER] step through · [ESC] stay', C.faint);
  }

  // Through: the fare, a flash of violet, and out by the other arch.
  go(i) {
    const d = this.dests[i];
    if (!d) return;
    const game = this.game;
    const fare = game.sim.portals.fareFor(this.sid);
    const p = game.player;
    if (p.mount || p.raft || p.inWagon) {
      this.ui.msg('You can\'t take a horse, a cart or a raft through.', '#ffb080');
      return;
    }
    if (fare) {
      const have = p.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
      if (have < fare) {
        this.ui.msg(`The keeper wants ¤${fare} from anyone not of the realm.`, '#ffb080');
        this.ui.audio?.play('error');
        return;
      }
      removeItem(p.inv, 'coin', fare);
      const L = game.sim.layoutOf(this.sid);
      if (L && L.econ) L.econ.treasury += fare;
    }
    this.close();
    const r = game.renderer;
    r.emit(p.x + 0.5, p.y + 1, p.z + 0.5, { n: 24, color: ['#c080ff', '#80c0ff', '#ffffff'], up: 40, speed: 40, life: 0.8, gravity: -20 });
    game.audio?.play('portal');
    const f = d.q.front;
    const spot = teleportTo(game, f.x, f.z);
    if (spot) {
      p.face(d.q.x, d.q.z);
      p.dir = (p.dir + 2) % 4;
      r.emit(spot.x + 0.5, (spot.y ?? GROUND) + 1, spot.z + 0.5, { n: 24, color: ['#c080ff', '#80c0ff', '#ffffff'], up: 40, speed: 40, life: 0.8, gravity: -20 });
      game.ui.flash?.('#c080ff');
      this.ui.msg(`You step through the light, and out onto the square of ${d.s.name}.`, '#c8a0ff');
    }
  }

  onKey(k) {
    if (k.code === 'Escape') this.close();
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.sel = (this.sel + this.dests.length - 1) % Math.max(1, this.dests.length);
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.sel = (this.sel + 1) % Math.max(1, this.dests.length);
    else if (k.code === 'Enter' || k.code === 'Space') this.go(this.sel);
    else {
      const m = /^Digit([1-9])$/.exec(k.code);
      if (m) this.go(Number(m[1]) - 1);
    }
    return true;
  }
}
