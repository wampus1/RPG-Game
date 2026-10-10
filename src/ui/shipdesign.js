// (Round 78) The shipwright's bench (see game/shipdesign.js): a ship of
// your own drawn up. On the left what she's to be: her name (type it),
// her length and beam and decks, her rooms, her masts and how each is
// rigged, her guns, her hold and stalls, her paint, colours and sails. On
// the right, her drawn from the side as she'd be built, what she'd do,
// and what she'd take to build; and the button that builds her (a ship in
// a bottle of her, to launch on open water). Designs drawn up before can
// be taken up again, to build another or to start a new one from.
import { Window } from './window.js';
import { C } from './ascii.js';
import { B } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { previewModel } from '../world/shipmodels.js';
import { FLAG_COLORS, EMBLEMS, HULL_PAINTS } from './blueprint.js';
import { blankDesign, tidy, typeOf, costOf, stallRoom, registerDesign, RIGS, RIG_NAMES, LIMITS } from '../game/shipdesign.js';
import { craftSources, countFrom, takeFrom } from '../game/invtools.js';
import { addItem } from '../game/inventory.js';

const TRIMS = ['#1a1a20', '#e8e0d0', '#a07820', '#5a1a14', '#1a3a5a', '#2a4a2a'];
const SAILS = ['#f0ead8', '#e8d8b0', '#c8b8a0', '#a83a30', '#3a3a40', '#d8c070'];
const W = 80;
const H = 35;

export class ShipDesignWindow extends Window {
  constructor(ui, game) {
    super(ui, W, H, { kind: 'shipdesign' });
    this.d = tidy(blankDesign());
    this.pick = -1;
    this.dirty = true;
  }

  set(k, v) {
    this.d[k] = v;
    tidy(this.d);
    this.dirty = true;
    this.ui.audio?.play('select');
  }

  draw(g, game) {
    const d = this.d;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, C.bg);
    g.box(0, 0, this.w, this.h, { bg: 'rgba(16,24,38,0.97)', double: true, title: 'SHIPWRIGHT\'S BENCH · A SHIP OF YOUR OWN', fg: '#7ab0e0' });
    const lab = (x, y, t) => g.text(x, y, t, '#a8c8e8');
    // A number to step up and down.
    const step = (x, y, label, k, by, lo, hi, show = (v) => `${v}`) => {
      lab(x, y, label);
      const v = d[k];
      const xx = x + label.length + 1;
      const t = show(v).padStart(3);
      const can0 = v - by >= lo;
      const can1 = v + by <= hi;
      g.text(xx, y, '◄', can0 ? (this.hovering(xx, y, 1, 1) ? C.white : C.hi) : C.faint);
      g.text(xx + 1, y, t, C.white);
      g.text(xx + 1 + t.length, y, '►', can1 ? (this.hovering(xx + 1 + t.length, y, 1, 1) ? C.white : C.hi) : C.faint);
      if (can0) this.hit(xx, y, 1, 1, () => this.set(k, v - by));
      if (can1) this.hit(xx + 1 + t.length, y, 1, 1, () => this.set(k, v + by));
      return xx + t.length + 3;
    };
    // One of a few.
    const choose = (x, y, label, k, opts) => {
      lab(x, y, label);
      let xx = x + label.length + 1;
      for (const [v, t] of opts) {
        const on = d[k] === v;
        const hov = this.hovering(xx, y, t.length + 2, 1);
        g.text(xx, y, `${on ? '[' : ' '}${t}${on ? ']' : ' '}`, on ? C.hi : hov ? C.white : C.fg);
        this.hit(xx, y, t.length + 2, 1, () => this.set(k, v));
        xx += t.length + 2;
      }
    };
    const swatches = (x, y, label, k, cols) => {
      lab(x, y, label);
      cols.forEach((c, i) => {
        const xx = x + 8 + i * 4;
        const on = d[k] === c;
        g.text(xx, y, on ? '[' : ' ', C.hi);
        g.text(xx + 1, y, '██', c);
        g.text(xx + 3, y, on ? ']' : ' ', C.hi);
        this.hit(xx, y, 4, 1, () => this.set(k, c));
      });
    };
    // ---- her name
    const cur = Math.floor(Date.now() / 450) % 2 ? '_' : ' ';
    lab(2, 2, 'Name');
    g.fill(7, 2, 30, 1, ' ', C.fg, 'rgba(232,224,200,0.12)');
    g.text(8, 2, `${d.name}${cur}`, '#fff0c0', undefined, 28);
    // ---- her hull
    g.text(2, 4, 'HULL', C.dim);
    let x = step(2, 5, 'Length', 'L', 2, ...LIMITS.L);
    x = step(x + 1, 5, 'Beam', 'W', 2, ...LIMITS.W);
    step(2, 6, 'Decks below', 'decks', 1, 1, 2);
    step(22, 6, 'Hold', 'hold', 1, ...LIMITS.hold);
    // ---- her rooms
    g.text(2, 8, 'ROOMS', C.dim);
    choose(2, 9, 'Aft', 'quarter', [['none', 'flush'], ['raised', 'quarterdeck'], ['cabin', 'cabin under it']]);
    if (d.quarter === 'cabin' && d.L >= 24) choose(2, 10, 'Over the cabin', 'poop', [[false, 'no'], [true, 'a great cabin']]);
    else g.text(2, 10, d.quarter === 'cabin' ? 'Over the cabin: (24 long, for a great cabin)' : 'Over the cabin: (a cabin aft first)', C.faint);
    choose(2, 11, 'Forward', 'fore', [['none', 'flush'], ['raised', 'forecastle'], ['galley', 'galley under it']]);
    // ---- her masts
    g.text(2, 13, 'MASTS', C.dim);
    const maxMasts = d.L >= 26 ? 3 : d.L >= 20 ? 2 : 1;
    d.masts.forEach((rig, i) => {
      const y = 14 + i;
      const nm = d.masts.length === 1 ? 'Main' : ['Fore', 'Main', 'Mizzen'][i];
      lab(2, y, `${nm}:`.padEnd(8));
      const t = RIG_NAMES[rig];
      g.text(10, y, '◄', this.hovering(10, y, 1, 1) ? C.white : C.hi);
      g.text(11, y, t.padEnd(18), C.white);
      g.text(29, y, '►', this.hovering(29, y, 1, 1) ? C.white : C.hi);
      const turn = (by) => () => {
        const j = (RIGS.indexOf(rig) + by + RIGS.length) % RIGS.length;
        const m = [...d.masts];
        m[i] = RIGS[j];
        this.set('masts', m);
      };
      this.hit(10, y, 1, 1, turn(-1));
      this.hit(29, y, 1, 1, turn(1));
    });
    {
      const y = 14 + d.masts.length;
      const canAdd = d.masts.length < maxMasts;
      const canDrop = d.masts.length > 1;
      g.text(2, y, '+ a mast', canAdd ? (this.hovering(2, y, 8, 1) ? C.white : C.hi) : C.faint);
      if (canAdd) this.hit(2, y, 8, 1, () => this.set('masts', [...d.masts, d.masts.length === 1 ? 'gaff' : 'lateen']));
      g.text(12, y, '− the last', canDrop ? (this.hovering(12, y, 10, 1) ? C.white : C.hi) : C.faint);
      if (canDrop) this.hit(12, y, 10, 1, () => this.set('masts', d.masts.slice(0, -1)));
      if (!canAdd && maxMasts < 3) g.text(24, y, `(${maxMasts === 1 ? 20 : 26} long for more)`, C.faint);
    }
    // ---- her guns, her stalls
    g.text(2, 19, 'GUNS · STALLS', C.dim);
    step(2, 20, 'Deck guns a side', 'deckGuns', 1, 0, Math.min(LIMITS.deckGuns[1], Math.floor((d.L - 8) / 3)));
    if (d.decks === 2) choose(26, 20, 'Gun deck', 'gunDeck', [[false, 'no'], [true, 'yes']]);
    else g.text(26, 20, 'Gun deck: (two decks)', C.faint);
    const room = stallRoom(d);
    x = step(2, 21, 'Horses', 'horses', 1, 0, room.horses);
    step(x + 1, 21, 'Wagons', 'wagons', 1, 0, room.wagons);
    if (!room.wagons) g.text(x + 15, 21, '(2 decks, 9 wide)', C.faint);
    // ---- her looks
    g.text(2, 23, 'HER LOOKS', C.dim);
    swatches(2, 24, 'Paint', 'paint', HULL_PAINTS);
    swatches(2, 25, 'Trim', 'paint2', TRIMS);
    swatches(2, 26, 'Colours', 'flag', FLAG_COLORS.slice(0, 8));
    swatches(2, 27, 'Sails', 'sail', SAILS);
    lab(2, 28, 'Mark');
    let ex = 10;
    for (const em of EMBLEMS) {
      const t = em || 'none';
      const on = em === d.emblem;
      if (ex + t.length + 2 > 44) break;
      g.text(ex, 28, `${on ? '[' : ' '}${t}${on ? ']' : ' '}`, on ? C.hi : this.hovering(ex, 28, t.length + 2, 1) ? C.white : C.fg);
      this.hit(ex, 28, t.length + 2, 1, () => this.set('emblem', em));
      ex += t.length + 2;
    }
    // ---- her, drawn
    this.drawSide(g, 45, 2, 33, 17);
    // ---- what she'd do, what she'd take
    const T = typeOf(d);
    const sx = 45;
    g.text(sx, 20, 'SHE\'D DO', C.dim);
    g.text(sx, 21, `Speed ${T.speed}  Turning ${Math.round(T.turn * 10)}/10  Crew ${T.crew}`, C.fg);
    g.text(sx, 22, `Guns ${T.guns}  Hold ${T.hold}  Stalls ${d.horses}h ${d.wagons}w`, C.fg);
    g.text(sx, 24, 'SHE\'D TAKE', C.dim);
    const src = craftSources(game);
    const cnt = (k) => countFrom(src, k);
    const c = costOf(d);
    const coins = cnt('coin');
    g.text(sx, 25, `¤${c.coin}`, coins >= c.coin ? C.green : C.red);
    g.text(sx + 8, 25, `(you have ¤${coins})`, C.faint);
    c.items.forEach(([k, n], i) => {
      const have = cnt(k);
      g.text(sx + (i % 2) * 17, 26 + Math.floor(i / 2), `${n} ${(ITEMS[k] && ITEMS[k].name) || k}`.slice(0, 16), have >= n ? C.green : C.red);
    });
    const ok = coins >= c.coin && c.items.every(([k, n]) => cnt(k) >= n);
    // ---- your designs
    const mine = game.shipDesigns ? [...game.shipDesigns.values()] : [];
    g.text(2, 30, 'YOUR DESIGNS', C.dim);
    if (!mine.length) g.text(16, 30, 'none yet: build one and it\'s kept here', C.faint);
    else {
      let dx = 16;
      for (const q of mine.slice(-5)) {
        const t = q.name.slice(0, 12);
        const hov = this.hovering(dx, 30, t.length + 2, 1);
        g.text(dx, 30, ` ${t} `, hov ? C.white : '#a0d0f0', hov ? C.bgSel : undefined);
        this.hit(dx, 30, t.length + 2, 1, () => {
          this.d = tidy({ ...q });
          delete this.d.id;
          this.ui.audio?.play('select');
        });
        dx += t.length + 3;
        if (dx > W - 14) break;
      }
    }
    // ---- build her
    const by = H - 3;
    const lb = ' Build her  ENTER ';
    const hov = this.hovering(2, by, lb.length, 1);
    g.text(2, by, lb, ok ? (hov ? C.white : '#c8e8c8') : C.faint, ok ? (hov ? C.bgHi : 'rgba(40,70,50,0.9)') : undefined);
    if (ok) this.hit(2, by, lb.length, 1, (ck, gm) => this.build(gm || game));
    const lc = ' Start afresh ';
    g.text(24, by, lc, this.hovering(24, by, lc.length, 1) ? C.white : C.fg, this.hovering(24, by, lc.length, 1) ? C.bgHi : undefined);
    this.hit(24, by, lc.length, 1, () => {
      this.d = tidy(blankDesign());
      this.ui.audio?.play('select');
    });
    g.text(41, by, ok ? 'From your pack and your chests about the bench.' : 'Short of something: see what she\'d take.', C.faint);
    g.text(2, H - 2, 'Type to name her · ESC to leave the bench', C.faint);
  }

  // Her drawn from the side (bow to the right): her hull, her decks and
  // castles, her guns and her masts (a little shorter than they are).
  drawSide(g, x0, y0, w, h) {
    if (this.dirty || !this.side) {
      this.dirty = false;
      this.side = previewModel(typeOf(this.d));
    }
    const m = this.side;
    g.text(x0, y0, `${this.d.name}`.slice(0, w), '#fff0c0');
    const scale = m.L > w - 4 ? (w - 4) / m.L : 1;
    const top = y0 + 1;
    const mastH = Math.max(...m.masts.map((q) => q.h)) * 0.5;
    const rows = Math.min(h - 1, Math.ceil(m.H + mastH));
    const base = top + rows - 1;
    const ox = x0 + Math.floor((w - m.L * scale) / 2);
    // (The sea.)
    g.text(x0, base - m.wl + 1, '≈'.repeat(w), 'rgba(80,140,200,0.55)');
    const mid = Math.floor((m.W - 1) / 2);
    const colOf = (id, y) => {
      if (id === B.copper_sheath) return ['█', '#b87333'];
      if (id === B.hull_planks) return ['█', y === m.deck ? this.d.paint2 : this.d.paint];
      if (id === B.deck_planks) return ['▀', '#c8a070'];
      if (id === B.ship_rail) return ['▄', '#8a6a40'];
      if (id === B.ship_cannon) return ['▪', '#202020'];
      if (id === B.gunport) return ['▪', '#101010'];
      if (id === B.stern_window) return ['▒', '#f0d070'];
      if (id === B.gilt_trim) return ['▀', '#e0c040'];
      if (id === B.ship_mast) return ['│', '#6a4a2a'];
      if (id === B.helm) return ['*', '#a07040'];
      return null;
    };
    for (let z = 0; z < m.L; z++) {
      const cx = ox + Math.floor(z * scale);
      for (let y = 0; y < m.H; y++) {
        const ry = base - y;
        if (ry < top) continue;
        // (The nearest of her to you, looking from her side.)
        let got = null;
        for (let xx = 0; xx <= mid && !got; xx++) {
          const id = m.vox[(y * m.L + z) * m.W + xx];
          if (id) got = colOf(id, y);
        }
        if (got) g.text(cx, ry, got[0], got[1]);
      }
    }
    // The masts and their sails, the bowsprit.
    for (const q of m.masts) {
      const cx = ox + Math.floor(q.z * scale);
      const hh = Math.round(q.h * 0.5);
      for (let k = 0; k < hh; k++) {
        const ry = base - q.base - k;
        if (ry < top) break;
        g.text(cx, ry, '│', '#6a4a2a');
      }
      const sailTop = base - q.base - hh + 1;
      const sq = q.rig.startsWith('square') || q.rig === 'mizzen';
      for (let ry = Math.max(top, sailTop + 1); ry < base - q.base - 1; ry++) {
        if (sq) {
          for (const dx of [-1, 1]) g.text(cx + dx, ry, '▌', this.d.sail);
        } else {
          const span = Math.max(1, Math.round(((ry - sailTop) / Math.max(1, hh)) * (q.rig === 'lateen' ? 3 : 4)));
          for (let dx = 1; dx <= span; dx++) g.text(cx - dx, ry, '▐', this.d.sail);
        }
      }
      g.text(cx, Math.max(top, sailTop - 1), '▸', this.d.flag);
    }
    const bx = ox + Math.floor(m.L * scale);
    const by = base - (m.bowsprit.y - 1);
    for (let k = 0; k < Math.min(4, Math.round(m.bowsprit.len * scale * 0.4)); k++) if (bx + k < x0 + w) g.text(bx + k, by - (k > 1 ? 1 : 0), k > 1 ? '╱' : '─', '#6a4a2a');
  }

  build(game) {
    const d = this.d;
    const src = craftSources(game);
    const c = costOf(d);
    if (countFrom(src, 'coin') < c.coin || !c.items.every(([k, n]) => countFrom(src, k) >= n)) {
      this.ui.msg('Short of something she\'d take.', '#ffb080', true);
      return;
    }
    takeFrom(src, 'coin', c.coin);
    for (const [k, n] of c.items) takeFrom(src, k, n);
    // (The same design built again is the same kind of ship.)
    const same = game.shipDesigns && [...game.shipDesigns.values()].find((q) => JSON.stringify({ ...q, id: 0 }) === JSON.stringify({ ...tidy({ ...d }), id: 0 }));
    const D = same || registerDesign(game, d);
    const key = `shipd~${D.id}`;
    const p = game.player;
    const left = addItem(p.inv, key, 1);
    if (left) game.spawnDrop(key, 1, p.x, p.y, p.z, true);
    game.audio?.play('craft');
    this.ui.msg(`The bench turns out ${D.name}, in miniature, in her bottle: take her to open water and uncork her.`, '#a0d8ff');
    this.dirty = true;
  }

  onKey(k, game) {
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    if (k.code === 'Enter' || k.code === 'NumpadEnter') {
      this.build(game || this.ui.game);
      return true;
    }
    if (k.code === 'Backspace') this.d.name = this.d.name.slice(0, -1);
    else if (k.key && k.key.length === 1 && !k.ctrl && this.d.name.length < 24) this.d.name += k.key;
    else return true;
    this.dirty = true;
    return true;
  }
}
