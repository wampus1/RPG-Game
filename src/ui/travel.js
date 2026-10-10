// (Round 77) A coach or a ferry: where it goes, how long it takes and
// what it costs; a place clicked, and you're off (see sim/coaches.js and
// Game.journey).
import { Window } from './window.js';
import { C } from './ascii.js';
import { coachLinks, ferryLinks, wayTime } from '../sim/coaches.js';
import { countItem } from '../game/inventory.js';

export class TravelWindow extends Window {
  constructor(ui, stop) {
    super(ui, 54, 18, { kind: 'travel' });
    this.stop = stop;
    this.closeOnOutside = true;
  }
  links(game) {
    const s = game && game.world.ow.settlements[this.stop.sid];
    if (!s) return [];
    return this.stop.kind === 'ferry' ? ferryLinks(game, s) : coachLinks(game, s);
  }
  draw(g, game = this.ui.game) {
    const ferry = this.stop.kind === 'ferry';
    const s = game && game.world.ow.settlements[this.stop.sid];
    g.fill(0, 0, this.w, this.h, ' ', C.fg, C.bg);
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: ferry ? 'THE FERRY' : 'THE COACH' });
    if (!game || !s) return;
    g.center(2, ferry ? `From ${s.name}'s pier, across the sea` : `From ${s.name}, along the roads`, C.dim);
    const coins = countItem(game.player.inv, 'coin');
    const ls = this.links(game);
    if (!ls.length) g.center(6, ferry ? 'No ferry sails from here to anywhere you could go.' : 'No coach runs from here just now.', C.faint);
    ls.slice(0, 10).forEach((l, i) => {
      const y = 4 + i;
      const name = l.known ? l.s.name : `a ${l.s.type} you've not been to`;
      if (l.pending) {
        g.text(3, y, name.slice(0, 26), C.faint);
        g.text(30, y, 'asking after the tides...', C.faint);
        return;
      }
      const can = coins >= l.fare;
      const hov = this.hovering(2, y, this.w - 4, 1);
      if (hov) g.fill(2, y, this.w - 4, 1, ' ', C.fg, can ? C.bgHi : '#3a2020');
      g.text(3, y, name.slice(0, 26), hov ? C.white : l.known ? C.fg : C.dim);
      g.text(30, y, wayTime(l.mins), C.cyan);
      g.text(40, y, `¤${l.fare}`, can ? C.hi : C.red);
      if (l.road) g.text(47, y, 'road', C.faint);
      this.hit(2, y, this.w - 4, 1, (ck, gm) => {
        const G = gm || game;
        if (countItem(G.player.inv, 'coin') < l.fare) {
          this.ui.audio?.play('error');
          this.ui.msg(`The fare to ${l.s.name} is ¤${l.fare}: you haven't enough.`, '#ff9060');
          return;
        }
        this.close();
        G.journey(l);
      });
    });
    g.center(this.h - 2, `You have ¤${coins}`, C.dim);
  }
  onKey(k) {
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    return false;
  }
}
