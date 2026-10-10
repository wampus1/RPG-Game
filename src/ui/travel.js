// (Round 77) A coach or a ferry: where it goes, how long it takes and
// what it costs; a place clicked, and you're off (see sim/coaches.js and
// Game.journey).
import { Window } from './window.js';
import { C } from './ascii.js';
import { coachLinks, ferryLinks, wayTime } from '../sim/coaches.js';
import { countItem, makeSlots } from '../game/inventory.js';
import { shippable, FERRY_FEES, HOLD_SLOTS } from '../game/stalls.js';

export class TravelWindow extends Window {
  constructor(ui, stop) {
    super(ui, 54, stop.kind === 'ferry' ? 21 : 18, { kind: 'travel' });
    this.stop = stop;
    this.closeOnOutside = true;
    // (Round 78) On the ferry: your horse, your wagon, a hold for goods.
    this.extras = { horse: false, wagon: false, hold: false };
  }
  extraFee() {
    const e = this.extras;
    return (e.horse ? FERRY_FEES.horse : 0) + (e.wagon ? FERRY_FEES.wagon : 0) + (e.hold ? FERRY_FEES.hold : 0);
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
      const fee = ferry ? this.extraFee() : 0;
      const can = coins >= l.fare + fee;
      const hov = this.hovering(2, y, this.w - 4, 1);
      if (hov) g.fill(2, y, this.w - 4, 1, ' ', C.fg, can ? C.bgHi : '#3a2020');
      g.text(3, y, name.slice(0, 26), hov ? C.white : l.known ? C.fg : C.dim);
      g.text(30, y, wayTime(l.mins), C.cyan);
      g.text(40, y, `¤${l.fare + fee}`, can ? C.hi : C.red);
      if (l.road) g.text(47, y, 'road', C.faint);
      this.hit(2, y, this.w - 4, 1, (ck, gm) => {
        const G = gm || game;
        const total = l.fare + (ferry ? this.extraFee() : 0);
        if (countItem(G.player.inv, 'coin') < total) {
          this.ui.audio?.play('error');
          this.ui.msg(`The fare to ${l.s.name} is ¤${total}: you haven't enough.`, '#ff9060');
          return;
        }
        this.close();
        G.journey(ferry ? { ...l, fare: total, extras: { ...this.extras } } : l);
      });
    });
    if (ferry) this.drawExtras(g, game);
    g.center(this.h - 2, `You have ¤${coins}`, C.dim);
  }

  // (Round 78) What else goes aboard with you (see game/stalls.js).
  drawExtras(g, game) {
    const p = game.player;
    const have = shippable(game, p);
    const y = this.h - 5;
    g.text(3, y, 'Ship with you:', C.dim);
    const opts = [
      ['horse', `your horse ¤${FERRY_FEES.horse}`, have.horses.length > 0],
      ['wagon', `your wagon ¤${FERRY_FEES.wagon}`, have.wagons.length > 0],
      ['hold', `hold for goods ¤${FERRY_FEES.hold}`, true],
    ];
    let x = 3;
    let yy = y + 1;
    for (const [k, label, ok] of opts) {
      if (!ok) this.extras[k] = false;
      const on = this.extras[k];
      const text = `[${on ? 'x' : ' '}] ${label}`;
      if (x + text.length > this.w - 2) {
        x = 3;
        yy++;
      }
      const hov = ok && this.hovering(x, yy, text.length, 1);
      g.text(x, yy, text, !ok ? C.faint : on ? C.green : hov ? C.white : C.fg);
      if (ok) this.hit(x, yy, text.length, 1, (ck, gm) => {
        const G = gm || game;
        this.extras[k] = !this.extras[k];
        this.ui.audio?.play('select');
        // (The hold: what's to go in it, put in now, at the pier.)
        if (k === 'hold' && this.extras.hold) {
          const P = G.player;
          P._ferryHold ||= makeSlots(HOLD_SLOTS);
          this.ui.openContainer('Ferry hold · to go across with you', P._ferryHold, { x: P.x, y: P.y, z: P.z, owner: null });
        }
      });
      x += text.length + 2;
    }
  }
  onKey(k) {
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    return false;
  }
}
