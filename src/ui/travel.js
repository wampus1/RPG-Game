// (Round 77) A coach or a ferry: where it goes, how long it takes and
// what it costs; a place clicked, and you're off (see sim/coaches.js and
// Game.journey). (Round 82: the coach's on a map: the towns it goes to
// ringed on it, one picked, and asked whether you're sure.)
import { Window } from './window.js';
import { C } from './ascii.js';
import { MapWindow, ZOOMS } from './worldmap.js';
import { REGION_W, REGION_D, CHAR_W, CHAR_H } from '../config.js';
import { drawText } from '../render/font.js';
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

// (Round 82) The coach: a map, the towns it runs to ringed in gold on it
// (and down the side), whichever you've not been to as well (the driver
// knows the way). Click one (on the map, or in the list) and you're asked
// whether that's where you want to go: what it takes, what it costs. Yes,
// and you climb in.
export class CoachMapWindow extends MapWindow {
  constructor(ui, stop) {
    super(ui);
    this.kind = 'travel';
    this.stop = stop;
    this.choice = null;
    this.fitted = false;
  }

  links(game) {
    const s = game && game.world.ow.settlements[this.stop.sid];
    return s ? coachLinks(game, s) : [];
  }

  // Where a link's town is (its middle, in tiles).
  spot(l) {
    const s = l.s;
    return { x: (s.cx + s.cw / 2) * REGION_W, z: (s.cz + s.cd / 2) * REGION_D };
  }

  nameOf(l, short = false) {
    return l.known ? l.s.name : short ? `an unknown ${l.s.type}` : `a ${l.s.type} you've not been to`;
  }

  // (First time round: the map closed in as far as it can go with all the
  // coach's towns, and its own, in view.)
  fit(game) {
    this.fitted = true;
    const from = game.world.ow.settlements[this.stop.sid];
    if (!from) return;
    const pts = [{ x: (from.cx + from.cw / 2) * REGION_W, z: (from.cz + from.cd / 2) * REGION_D }, ...this.links(game).map((l) => this.spot(l))];
    const xs = pts.map((q) => q.x / REGION_W);
    const zs = pts.map((q) => q.z / REGION_D);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const a = this.area();
    const spanX = Math.max(...xs) - Math.min(...xs) + 3;
    const spanZ = Math.max(...zs) - Math.min(...zs) + 3;
    let zi = 0;
    for (let i = ZOOMS.length - 1; i >= 0; i--) {
      if (spanX * ZOOMS[i] <= a.x1 - a.x0 && spanZ * ((ZOOMS[i] * 2) / 3) <= a.y1 - a.y0) {
        zi = i;
        break;
      }
    }
    this.zi = zi;
    this.z = ZOOMS[zi];
    this.cam = { x: cx, z: cz };
    this.goal = { x: cx, z: cz };
    this.clampCam();
  }

  update(dt) {
    const game = this.ui.game;
    if (game && !this.fitted) this.fit(game);
    super.update(dt);
  }

  listEntries(game) {
    const f = this.search.trim().toLowerCase();
    return this.links(game)
      .map((l) => ({ kind: 'dest', label: this.nameOf(l, true), x: this.spot(l).x, z: this.spot(l).z, quest: false, color: l === this.choice || (this.choice && this.choice.s === l.s) ? C.white : l.known ? '#ffd060' : '#c8b080', link: l }))
      .filter((e) => !f || e.label.toLowerCase().includes(f));
  }

  // A town in the list clicked: chosen (and the map moved to it).
  goTo(e) {
    super.goTo(e);
    if (e.link) this.choose(e.link);
  }

  choose(l) {
    this.choice = l;
    this.ui.audio?.play('select');
  }

  // The coach's town under a point on the map (or the nearest of them to
  // it, close by), or null.
  linkAt(game, px, py) {
    let best = null;
    let bd = Infinity;
    for (const l of this.links(game)) {
      const q = this.at(this.spot(l).x, this.spot(l).z);
      const s = l.s;
      const r = Math.max(6, (Math.max(s.cw, s.cd) * this.z) / 2 + 3);
      const d = Math.hypot(px - q.x, py - q.y);
      if (d <= r && d < bd) {
        best = l;
        bd = d;
      }
    }
    return best;
  }

  // A click that didn't drag: a town of the coach's chosen.
  clicked(px, py) {
    const game = this.ui.game;
    if (!game) return;
    const l = this.linkAt(game, px, py);
    if (l) {
      this.choose(l);
      return;
    }
    const q = this.squareAt(px, py);
    const icon = q && (this.icons || new Map()).get(q.cz * 10000 + q.cx);
    if (icon && icon.s && icon.s.id !== this.stop.sid) this.ui.msg(`The coach doesn't run to ${icon.s.name} from here.`, '#c8c8c8', true);
    this.choice = null;
  }

  // Yes: the fare paid, and off.
  go(game) {
    const l = this.choice;
    if (!l || !game) return;
    if (countItem(game.player.inv, 'coin') < l.fare) {
      this.ui.audio?.play('error');
      this.ui.msg(`The fare to ${l.s.name} is ¤${l.fare}: you haven't enough.`, '#ff9060');
      return;
    }
    this.close();
    game.journey(l);
  }

  draw(g, game) {
    const s = game && game.world.ow.settlements[this.stop.sid];
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: s ? `THE COACH FROM ${s.name.toUpperCase()} · WHERE TO?` : 'THE COACH · WHERE TO?' });
    for (let y = 1; y < this.h - 4; y++) g.text(1, y, ' '.repeat(this.w - 2), '#000000', '#08080e');
    if (!game || !s) return;
    const coins = countItem(game.player.inv, 'coin');
    const ls = this.links(game);
    // (Still the one chosen? The coach's towns can change: a road shut.)
    if (this.choice && !ls.some((l) => l.s === this.choice.s)) this.choice = null;
    if (this.choice) this.choice = ls.find((l) => l.s === this.choice.s);
    const y0 = this.h - 4;
    const W = this.w - 3;
    const put = (y, text, color) => g.text(2, y, text.slice(0, W).padEnd(W), color);
    const m = this.ui.mouse;
    const hov = m && this.linkAt(game, m.x, m.y);
    this.hoverSq = m ? this.squareAt(m.x, m.y) : null;
    if (!ls.length) put(y0, 'No coach runs from here just now.', C.faint);
    else if (hov) put(y0, `${this.nameOf(hov)} · ${wayTime(hov.mins)} on the road${hov.road ? ' (by the road)' : ''} · ¤${hov.fare}${hov === this.choice ? '' : ' · click to choose'}`, hov.known ? C.hi : '#c8b080');
    else if (this.hoverSq) {
      const d = this.describe(game, this.hoverSq.cx, this.hoverSq.cz, this.hoverSq.hf);
      put(y0, d.line, d.color);
    } else put(y0, `${ls.length} place${ls.length === 1 ? '' : 's'} the coach runs to, ringed in gold. You have ¤${coins}.`, C.dim);
    const l = this.choice;
    if (l) {
      const can = coins >= l.fare;
      put(y0 + 1, `Take the coach to ${this.nameOf(l, true)}? ${wayTime(l.mins)} on the road, ¤${l.fare}.`, can ? C.white : C.red);
      const yes = ' Yes, climb in ';
      const no = ' No ';
      const yh = this.hovering(2, y0 + 2, yes.length, 1);
      const nh = this.hovering(4 + yes.length, y0 + 2, no.length, 1);
      g.text(2, y0 + 2, yes, can ? (yh ? C.white : C.green) : C.faint, yh && can ? '#1e3a24' : '#18241a');
      g.text(4 + yes.length, y0 + 2, no, nh ? C.white : C.dim, nh ? '#3a2020' : '#241818');
      g.text(6 + yes.length + no.length, y0 + 2, '(Enter / Esc)', C.faint);
      this.hit(2, y0 + 2, yes.length, 1, (ck, gm) => this.go(gm || game));
      this.hit(4 + yes.length, y0 + 2, no.length, 1, () => {
        this.choice = null;
        this.ui.audio?.play('page');
      });
    } else {
      put(y0 + 1, 'Click a town ringed in gold on the map (or in the list) to go there.', C.dim);
      put(y0 + 2, 'Drag or WASD to look about; the wheel zooms.', C.faint);
    }
    this.drawList(g, game);
  }

  drawPixels(ctx, game) {
    super.drawPixels(ctx, game);
    if (!game) return;
    const a = this.area();
    const from = game.world.ow.settlements[this.stop.sid];
    const t = this.ui.time || 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    ctx.clip();
    const f = from ? this.at((from.cx + from.cw / 2) * REGION_W, (from.cz + from.cd / 2) * REGION_D) : null;
    const coins = countItem(game.player.inv, 'coin');
    for (const l of this.links(game)) {
      const sp = this.spot(l);
      const q = this.at(sp.x, sp.z);
      const chosen = this.choice && this.choice.s === l.s;
      const r = Math.max(4, (Math.max(l.s.cw, l.s.cd) * this.z) / 2 + 2) + (chosen ? Math.sin(t * 6) * 1.2 : 0);
      // The way there (the chosen one's, brighter), and the ring.
      if (f) {
        ctx.strokeStyle = chosen ? 'rgba(255,240,180,0.9)' : 'rgba(255,208,96,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash(chosen ? [4, 3] : [2, 4]);
        ctx.lineDashOffset = chosen ? -t * 12 : 0;
        ctx.beginPath();
        ctx.moveTo(Math.round(f.x) + 0.5, Math.round(f.y) + 0.5);
        ctx.lineTo(Math.round(q.x) + 0.5, Math.round(q.y) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = chosen ? '#ffffff' : coins >= l.fare ? '#ffd060' : '#c07050';
      ctx.lineWidth = chosen ? 2 : 1;
      ctx.beginPath();
      ctx.arc(Math.round(q.x) + 0.5, Math.round(q.y) + 0.5, r, 0, Math.PI * 2);
      ctx.stroke();
      // Its name over it (or what you know of it).
      const label = l.known ? l.s.name : '?';
      drawText(ctx, label, Math.round(q.x - (label.length * CHAR_W) / 2), Math.round(q.y - r - CHAR_H - 1), chosen ? '#ffffff' : '#ffe8a0', '#000');
    }
    ctx.restore();
  }

  onKey(k) {
    if (k.code === 'Escape' && this.choice) {
      this.choice = null;
      return true;
    }
    if ((k.code === 'Enter' || k.code === 'NumpadEnter') && this.choice) {
      this.go(this.ui.game);
      return true;
    }
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    return super.onKey(k);
  }
}
