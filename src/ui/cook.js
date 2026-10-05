// Cooking something of your own (round 50): at a campfire (a skewer), a
// cooking pot on a furnace (a stew or a soup), an oven (a pie, a tart, a
// loaf) or a table (a platter or a salad). Pick one to three things from
// your pack (anything at all: see world/dishes.js for what comes of it),
// then cook it, each place its own way:
//   - a campfire: turn the skewer as the heat's just right, three times
//     over (SPACE as the marker crosses the glow);
//   - a pot: keep it at a simmer (↑ stokes the fire, ↓ lets it settle)
//     while it cooks;
//   - an oven: crimp the crust (the arrows as they're shown), then take it
//     out when it's golden (SPACE);
//   - a table: chop as each mark comes under the knife (SPACE).
// How well you do decides how much of what's in it does you good, and
// how much harm (see cookDish). A dish worth making again can be written
// down as a recipe: made from one, it comes out the same, no cooking
// skill wanted, if you've what goes in it (and you're at the right place).
import { CHAR_W, CHAR_H } from '../config.js';
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS } from '../world/items.js';
import { COOK_STATIONS, TYPES, cookDish, dishName, dishForm, dishLines, ingredientTypes, baseOf } from '../world/dishes.js';
import { learnKinds, canMake, learnRecipe, writeRecipe } from '../game/cooking.js';
import { removeItem } from '../game/inventory.js';
import { itemIcon } from '../render/sprites.js';

const BG = '#120e0a';
const TITLES = { c: 'COOK AT THE CAMPFIRE', p: 'COOK IN THE FURNACE POT', o: 'BAKE IN THE OVEN', t: 'PREPARE AT THE TABLE' };
// (Round 51) What comes out, by how well it was done: what it's called,
// how many stars, the colours of its light, and its sound.
const TIERS = [
  { min: 0.85, word: 'PERFECT!', col: '#ffe070', rays: ['#fff0a0', '#ffc840'], spark: ['#ffffff', '#ffe070', '#ffb040', '#fff8d0'], sound: 'reveal_great' },
  { min: 0.6, word: 'Well cooked', col: '#a8f0a0', rays: ['#e8f4ff', '#a8d8ff'], spark: ['#ffffff', '#c8e8ff', '#a8f0a0'], sound: 'reveal_good' },
  { min: 0.35, word: 'Edible', col: '#e8d8b0', rays: ['#f0e0c0', '#c8b088'], spark: ['#f0e0c0', '#d8c8a0'], sound: 'reveal_poor' },
  { min: -1, word: 'Burnt...', col: '#f08070', rays: null, spark: ['#4a4040', '#2a2424', '#6a5a50'], sound: 'reveal_bad', smoke: true },
];
const tierOf = (score) => TIERS.find((q) => score >= q.min);
// How long the build-up, and the whole reveal.
const BUILD = 1.5;
const REVEAL = 2.9;
// (Overshooting, then settling: a pop.)
const back = (k) => {
  if (k >= 1) return 1;
  const c = 2.2;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
const HOW = {
  c: 'Turn the skewer as the marker crosses the glow: SPACE, three times.',
  p: 'Keep it at a simmer: ↑ stokes the fire, ↓ lets it settle.',
  o: 'Crimp the crust (the arrows as shown), then SPACE when it\'s golden.',
  t: 'Chop as each mark comes under the knife: SPACE.',
};
const ARROWS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };

// The things in a pack, each once, with how many (but what's already been
// cooked: a dish doesn't go into another; nor does a recipe for one).
function packList(inv) {
  const m = new Map();
  for (const s of inv) if (s && s.item && ITEMS[s.item] && !/^(dish|recipe)~/.test(String(s.item))) m.set(s.item, (m.get(s.item) || 0) + s.count);
  return [...m].map(([item, count]) => ({ item, count })).sort((a, b) => (ITEMS[a.item].name < ITEMS[b.item].name ? -1 : 1));
}
// One of `base` (or anything made from it) out of the pack.
function takeOne(inv, base) {
  const s = inv.find((q) => q && (q.item === base || baseOf(q.item) === base));
  if (!s) return false;
  removeItem(inv, s.item, 1);
  return true;
}

export class CookWindow extends Window {
  // `o`: { st (c, p, o, t), at: {x, y, z} (where it's being cooked), lit
  // (for a campfire: is it burning?), onFire(on) (lights or puts it out) }
  constructor(ui, game, o) {
    super(ui, 62, 28, { kind: 'cook' });
    this.game = game;
    this.o = o;
    this.st = o.st;
    this.closeOnOutside = false;
    this.phase = 'pick';
    this.sel = 0;
    this.scroll = 0;
    this.picked = [];
    this.tab = 'pack';
    this.msg = null;
    this.t = 0;
  }

  get me() {
    return this.game.player;
  }
  recipes() {
    return (this.me.recipes || []).filter((r) => r.st === this.st);
  }

  // ------------------------------------------------------------ drawing
  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, title: TITLES[this.st] });
    if (this.phase === 'pick') this.drawPick(g);
    else if (this.phase === 'cook') this.drawCook(g);
    else if (this.phase === 'reveal') this.drawReveal(g);
    else this.drawDone(g);
  }

  drawPick(g) {
    const S = COOK_STATIONS[this.st];
    const off = this.st === 'c' && !this.o.lit;
    // Tabs: your pack, or your recipes for here.
    const tab = (x, label, id) => {
      const on = this.tab === id;
      const hov = this.hovering(x, 1, label.length + 2, 1);
      g.text(x, 1, ` ${label} `, on ? C.white : hov ? C.hi : C.dim, on ? '#3a2a1a' : BG);
      this.hit(x, 1, label.length + 2, 1, () => {
        this.tab = id;
        this.sel = 0;
        this.scroll = 0;
      });
    };
    tab(2, 'Your pack', 'pack');
    tab(15, `Recipes (${this.recipes().length})`, 'recipes');
    if (this.tab === 'pack') this.drawPack(g);
    else this.drawRecipes(g);
    // What you'd make.
    const x0 = 34;
    g.text(x0, 3, 'In it:', C.border);
    for (let i = 0; i < 3; i++) {
      const k = this.picked[i];
      const y = 4 + i * 2;
      if (!k) {
        g.text(x0, y, `${i + 1}. -`, C.faint);
        continue;
      }
      g.text(x0, y, `${i + 1}. ${ITEMS[k].name}`.slice(0, this.w - x0 - 6), C.white);
      const known = (this.me.kinds || []).includes(baseOf(k));
      g.text(x0 + 3, y + 1, (known ? ingredientTypes(k).join(', ') : '(cook it to find out)').slice(0, this.w - x0 - 5), known ? '#d8b880' : C.faint);
    }
    if (this.picked.length) {
      g.text(x0, 11, 'Comes out as:', C.border);
      wrap(dishName(this.st, this.picked), this.w - x0 - 2).slice(0, 4).forEach((l, i) => g.text(x0, 12 + i, l, C.hi));
    } else {
      g.text(x0, 11, `At the ${S.name.toLowerCase()}: a ${dishForm(this.st, ['bread']).toLowerCase()}`, C.dim);
      g.text(x0, 12, 'or the like, of anything.', C.dim);
    }
    wrap(HOW[this.st], this.w - x0 - 2).slice(0, 4).forEach((l, i) => g.text(x0, 17 + i, l, C.faint));
    if (this.msg) g.center(this.h - 4, this.msg.text, this.msg.color);
    const btn = (x, w, label, fn, col, dis = false) => {
      const y = this.h - 3;
      const hov = !dis && this.hovering(x, y, w, 1);
      g.fill(x, y, w, 1, ' ', C.fg, hov ? C.bgHi : '#2a2016');
      g.text(x + 1, y, label, dis ? C.faint : hov ? C.white : col);
      if (!dis) this.hit(x, y, w, 1, fn);
    };
    if (off) btn(2, 18, '[L] Light the fire', () => this.toggleFire(), C.orange);
    else btn(2, 18, this.tab === 'recipes' ? '[ENTER] Make it' : '[C] Cook it', () => (this.tab === 'recipes' ? this.fromRecipe() : this.start()), C.hi, this.tab === 'pack' && !this.picked.length);
    if (this.st === 'c' && this.o.lit) btn(21, 18, '[P] Put the fire out', () => this.toggleFire(), C.dim);
    btn(this.w - 11, 9, '[ESC]', () => this.close(), C.fg);
    g.center(this.h - 2, this.tab === 'pack' ? '↑↓ choose · SPACE put in / take out · TAB recipes' : '↑↓ · ENTER make it · S copy onto a scroll · TAB pack', C.faint);
  }

  drawPack(g) {
    const list = packList(this.me.inv);
    this.list = list;
    const rows = this.h - 9;
    if (this.sel >= list.length) this.sel = Math.max(0, list.length - 1);
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + rows) this.scroll = this.sel - rows + 1;
    if (!list.length) g.text(3, 4, 'Nothing in your pack to cook with.', C.dim);
    list.slice(this.scroll, this.scroll + rows).forEach((q, i) => {
      const k = this.scroll + i;
      const y = 3 + i;
      const on = this.picked.includes(q.item);
      const cur = k === this.sel;
      const hov = this.hovering(2, y, 30, 1);
      g.fill(2, y, 30, 1, ' ', C.fg, cur ? '#3a2a1a' : hov ? '#2a2016' : BG);
      g.text(3, y, on ? '[x]' : '[ ]', on ? C.hi : C.faint);
      g.text(7, y, `${ITEMS[q.item].name}`.slice(0, 20), on ? C.white : C.fg);
      g.text(28, y, `${q.count}`.padStart(3), C.dim);
      this.hit(2, y, 30, 1, () => {
        this.sel = k;
        this.togglePick();
      });
    });
    if (list.length > rows) g.text(2, 3 + rows, `${this.scroll + 1}-${Math.min(list.length, this.scroll + rows)} of ${list.length}`, C.faint);
  }

  drawRecipes(g) {
    const list = this.recipes();
    this.list = list;
    if (!list.length) {
      wrap('No recipes for here yet. Cook something good, and write it down when it\'s done.', 28).forEach((l, i) => g.text(3, 4 + i, l, C.dim));
      return;
    }
    if (this.sel >= list.length) this.sel = list.length - 1;
    list.slice(0, 9).forEach((r, i) => {
      const y = 3 + i * 2;
      const cur = i === this.sel;
      const can = canMake(this.me.inv, r);
      g.fill(2, y, 30, 2, ' ', C.fg, cur ? '#3a2a1a' : BG);
      g.text(3, y, (ITEMS[r.key] ? ITEMS[r.key].name : r.name).slice(0, 28), can ? C.white : C.dim);
      g.text(4, y + 1, r.ings.map((k) => (ITEMS[k] ? ITEMS[k].name : k)).join(', ').slice(0, 27), can ? C.green : C.red);
      this.hit(2, y, 30, 2, () => {
        this.sel = i;
        this.fromRecipe();
      });
    });
  }

  drawCook(g) {
    const m = this.mini;
    g.center(1, dishName(this.st, this.picked), C.hi);
    const said = wrap(m.say || HOW[this.st], this.w - 4).slice(0, 2);
    said.forEach((l, i) => g.center(this.h - 4 - said.length + i, l, m.sayColor || C.dim));
    if (this.st === 'c') g.center(this.h - 4, `Turn ${Math.min(3, m.round + 1)} of 3`, C.faint);
    if (this.st === 'p') g.center(this.h - 4, `Simmering: ${Math.max(0, Math.ceil(m.dur - m.t))}s`, C.faint);
    if (this.st === 'o') g.center(this.h - 4, m.stage === 'crimp' ? `Crimp ${m.k + 1} of ${m.seq.length}: ${ARROWS[m.seq[m.k]] || ''}` : 'Baking...', m.stage === 'crimp' ? C.hi : C.faint);
    if (this.st === 't') g.center(this.h - 4, `Cuts ${m.cuts.length} of ${m.marks.length}`, C.faint);
    g.center(this.h - 2, 'ESC: give up (what\'s in it is kept)', C.faint);
  }

  // The top of the reveal and of what it came out as: its name (on two
  // lines if it must), how well it went and its stars, one by one.
  drawHead(g, stars) {
    const r = this.result;
    const def = ITEMS[r.key];
    const T = this.tier;
    wrap(def.name, this.w - 6).slice(0, 2).forEach((l, i) => g.center(2 + i, l, C.hi));
    const n = Math.max(1, Math.round(r.score * 5));
    const shown = Math.max(0, Math.min(n, stars));
    const word = r.fromRecipe ? 'Made from your recipe' : T.word;
    const line = `${word}  ${'★'.repeat(shown)}${'☆'.repeat(5 - shown)}`;
    g.center(4, line, r.fromRecipe ? C.dim : T.col);
  }

  // The build-up: what went in, going round and in, faster and faster;
  // then out it comes.
  drawReveal(g) {
    const R = this.reveal;
    if (R.t < R.build) {
      const dots = '.'.repeat(1 + (Math.floor(R.t * 4) % 3));
      g.center(2, `Something's cooking${dots}`, C.hi);
      wrap(this.picked.map((k) => (ITEMS[k] ? ITEMS[k].name : k)).join(' + '), this.w - 6).slice(0, 2).forEach((l, i) => g.center(3 + i, l, C.dim));
    } else this.drawHead(g, Math.floor((R.t - R.build - 0.35) / 0.13) + 1);
    g.center(this.h - 2, 'SPACE: skip', C.faint);
  }

  drawDone(g) {
    const r = this.result;
    const def = ITEMS[r.key];
    this.drawHead(g, 5);
    // What it does: kept clear of the buttons (cut short, if there's more).
    const lines = [{ text: `Heals ${def.now} now${def.regen ? ` and ${def.regen} more over ${def.regenT}s` : ''} · made ${r.n}`, color: C.green }];
    for (const l of dishLines(def)) {
      for (const [i, t] of wrap(l.text, this.w - 10).entries()) lines.push({ text: i ? `  ${t}` : l.dur ? t : `${l.cond ? '◆' : l.act ? '►' : l.good ? '+' : '-'} ${t}`, color: l.cond ? '#e8d070' : l.dur ? C.dim : l.act ? (l.good ? '#90d8ff' : '#ff9070') : l.good ? '#90e890' : '#f08070' });
    }
    const kinds = def.dish.ings.map((k) => `${ITEMS[k] ? ITEMS[k].name : k}: ${ingredientTypes(k).join(', ')}`).join(' · ');
    lines.push({ text: '', color: C.fg });
    wrap(`You know now: ${kinds}`, this.w - 8).forEach((t) => lines.push({ text: t, color: '#d8b880' }));
    const y0 = 12;
    const room = this.h - 7 - y0;
    lines.slice(0, room).forEach((l, i) => g.text(4, y0 + i, l.text.slice(0, this.w - 6), l.color));
    if (lines.length > room) g.text(this.w - 6, y0 + room - 1, '…', C.dim);
    const known = (this.me.recipes || []).some((q) => q.key === r.key);
    const scrolls = this.me.inv.some((q) => q && q.item === 'scroll');
    const btn = (x, yy, w, label, fn, col, dis = false) => {
      const hov = !dis && this.hovering(x, yy, w, 1);
      g.fill(x, yy, w, 1, ' ', C.fg, hov ? C.bgHi : '#2a2016');
      g.text(x + 1, yy, label.slice(0, w - 1), dis ? C.faint : hov ? C.white : col);
      if (!dis) this.hit(x, yy, w, 1, fn);
    };
    const y1 = this.h - 4;
    btn(2, y1, 28, known ? 'In your recipes' : '[W] Write down the recipe', () => this.writeDown(), C.hi, known);
    btn(31, y1, 29, scrolls ? '[S] Copy it onto a scroll' : 'No blank scroll to copy to', () => this.toScroll(r.key), C.hi, !scrolls);
    btn(2, y1 + 1, 28, '[C] Cook another', () => this.again(), C.fg);
    btn(31, y1 + 1, 29, '[ENTER] Done', () => this.close(), C.fg);
    if (this.msg) g.center(this.h - 5, this.msg.text.slice(0, this.w - 4), this.msg.color);
  }

  // ------------------------------------------------------------ pictures
  drawPixels(ctx) {
    const ox = this.x * CHAR_W;
    const oy = this.y * CHAR_H;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // (Nothing drawn outside the window's frame.)
    ctx.beginPath();
    ctx.rect(ox + CHAR_W, oy + CHAR_H, (this.w - 2) * CHAR_W, (this.h - 2) * CHAR_H);
    ctx.clip();
    if (this.phase === 'pick') this.pixPick(ctx, ox, oy);
    else if (this.phase === 'cook') {
      if (this.st === 'c') this.pixCampfire(ctx, ox, oy);
      else if (this.st === 'p') this.pixPot(ctx, ox, oy);
      else if (this.st === 'o') this.pixOven(ctx, ox, oy);
      else this.pixTable(ctx, ox, oy);
    } else if (this.phase === 'reveal') this.pixReveal(ctx, ox, oy);
    else this.pixDone(ctx, ox, oy);
    this.pixParts(ctx, ox, oy);
    ctx.restore();
  }

  pixPick(ctx, ox, oy) {
    // What's going in: each one's picture beside its line.
    const x = ox + (this.w - 4) * CHAR_W;
    this.picked.forEach((k, i) => ctx.drawImage(itemIcon(k), x, oy + (4 + i * 2) * CHAR_H));
  }

  // Where the dish shows, in the middle under its name.
  center(ox, oy) {
    return { cx: Math.round(ox + (this.w * CHAR_W) / 2), cy: oy + 8 * CHAR_H };
  }

  // Light from behind it, turning: a tier's own colours (none for a burnt
  // one: smoke instead).
  rays(ctx, cx, cy, len, a, spin) {
    const T = this.tier;
    if (!T.rays || a <= 0) return;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const ang = spin + (i / n) * Math.PI * 2;
      ctx.globalAlpha = a * (i % 2 ? 0.55 : 1);
      ctx.fillStyle = T.rays[i % 2];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang - 0.11) * len, cy + Math.sin(ang - 0.11) * len);
      ctx.lineTo(cx + Math.cos(ang + 0.11) * len, cy + Math.sin(ang + 0.11) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  pixReveal(ctx, ox, oy) {
    const R = this.reveal;
    const { cx, cy } = this.center(ox, oy);
    const t = R.t;
    if (t < R.build) {
      // What went in, round and round and in toward the middle, faster;
      // the heat glowing up under it; the window trembling.
      const k = t / R.build;
      const sh = k * k * 2.2;
      ctx.translate(Math.round((Math.random() - 0.5) * sh), Math.round((Math.random() - 0.5) * sh));
      const heat = this.st === 'c' || this.st === 'p' ? '255,150,60' : this.st === 'o' ? '255,190,90' : '220,230,255';
      const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14 + 46 * k);
      gl.addColorStop(0, `rgba(${heat},${(0.25 + 0.65 * k).toFixed(3)})`);
      gl.addColorStop(1, `rgba(${heat},0)`);
      ctx.fillStyle = gl;
      ctx.fillRect(cx - 70, cy - 70, 140, 140);
      const n = this.picked.length || 1;
      const spin = t * (2.2 + 9 * k * k);
      const rad = 66 * Math.pow(1 - k, 1.3) + 3;
      this.picked.forEach((key, i) => {
        const a = spin + (i / n) * Math.PI * 2;
        const s = Math.round(16 * (1 - k * 0.45));
        ctx.globalAlpha = 1 - Math.max(0, k - 0.85) * 5;
        ctx.drawImage(itemIcon(key), Math.round(cx + Math.cos(a) * rad - s / 2), Math.round(cy + Math.sin(a) * rad * 0.7 - s / 2), s, s);
      });
      ctx.globalAlpha = 1;
      // (A ring closing in at the end.)
      if (k > 0.6) {
        ctx.strokeStyle = `rgba(255,255,255,${((k - 0.6) * 1.6).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 40 * (1 - k) + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }
    // Out it comes: a flash, the light behind it, the dish popping up.
    const e = t - R.build;
    this.rays(ctx, cx, cy, 64 + Math.min(1, e * 3) * 30, Math.min(1, e * 4) * 0.32, t * 0.6);
    const pop = back(Math.min(1, e / 0.45));
    const s = Math.round(48 * pop);
    if (s > 0) ctx.drawImage(itemIcon(this.result.key), cx - Math.round(s / 2), cy - Math.round(s / 2), s, s);
    if (e < 0.35) {
      const a = 1 - e / 0.35;
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 10 + e * 360, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,250,230,${(a * 0.35).toFixed(3)})`;
      ctx.fillRect(ox, oy, this.w * CHAR_W, this.h * CHAR_H);
    }
  }

  pixDone(ctx, ox, oy) {
    const { cx, cy } = this.center(ox, oy);
    this.rays(ctx, cx, cy, 70, 0.14, this.t * 0.25);
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 34);
    glow.addColorStop(0, 'rgba(255,220,150,0.35)');
    glow.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 34, cy - 34, 68, 68);
    const bob = Math.round(Math.sin(this.t * 2.4) * 1.5);
    ctx.drawImage(itemIcon(this.result.key), cx - 24, cy - 24 + bob, 48, 48);
  }

  // Sparks drawn in, the burst out (and the smoke off a burnt one).
  pixParts(ctx, ox, oy) {
    for (const q of this.parts || []) {
      ctx.globalAlpha = Math.max(0, Math.min(1, q.life / q.max)) * (q.a ?? 1);
      ctx.fillStyle = q.col;
      ctx.fillRect(Math.round(ox + q.x - q.s / 2), Math.round(oy + q.y - q.s / 2), q.s, q.s);
    }
    ctx.globalAlpha = 1;
  }

  // The fire under it all (campfire and pot): logs, and flames that move.
  fire(ctx, cx, by, w, heat = 1) {
    const t = this.t;
    ctx.fillStyle = '#4a2e18';
    ctx.fillRect(cx - w / 2, by - 4, w, 4);
    ctx.fillStyle = '#6a4424';
    ctx.fillRect(cx - w / 2 + 2, by - 7, w - 4, 3);
    ctx.fillStyle = '#2a1a0e';
    for (let x = cx - w / 2; x < cx + w / 2; x += 6) ctx.fillRect(x, by - 4, 1, 4);
    const n = Math.round(w / 4);
    for (let i = 0; i < n; i++) {
      const fx = cx - w / 2 + 3 + (i / (n - 1 || 1)) * (w - 6);
      const h = (6 + 10 * heat) * (0.6 + 0.4 * Math.abs(Math.sin(t * 7 + i * 1.7)));
      ctx.fillStyle = '#c8281a';
      ctx.fillRect(Math.round(fx - 2), Math.round(by - 7 - h), 4, Math.round(h));
      ctx.fillStyle = '#f07a1c';
      ctx.fillRect(Math.round(fx - 1), Math.round(by - 7 - h * 0.8), 3, Math.round(h * 0.8));
      ctx.fillStyle = '#ffd860';
      ctx.fillRect(Math.round(fx), Math.round(by - 7 - h * 0.45), 1, Math.round(h * 0.45));
    }
  }

  pixCampfire(ctx, ox, oy) {
    const m = this.mini;
    const cx = ox + (this.w * CHAR_W) / 2;
    const by = oy + 130;
    // Warm light about it.
    const glow = ctx.createRadialGradient(cx, by - 20, 4, cx, by - 20, 90);
    glow.addColorStop(0, 'rgba(255,150,60,0.28)');
    glow.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 90, by - 110, 180, 120);
    // Stones round the pit.
    ctx.fillStyle = '#5a5650';
    for (let i = 0; i < 7; i++) ctx.fillRect(cx - 42 + i * 12, by - 2, 9, 5);
    this.fire(ctx, cx, by, 70, 1);
    // The skewer on its two forked sticks, turned as you turn it.
    ctx.fillStyle = '#6a4424';
    ctx.fillRect(cx - 60, by - 52, 3, 52);
    ctx.fillRect(cx + 57, by - 52, 3, 52);
    ctx.fillStyle = '#c8b090';
    ctx.fillRect(cx - 64, by - 50, 128, 2);
    const done = m.scores.length / 3;
    this.picked.forEach((k, i) => {
      const x = cx - 26 + i * 18 - (this.picked.length - 1) * 0;
      const spin = Math.sin(m.spin + i) * 1.5;
      ctx.save();
      ctx.filter = `brightness(${1 - done * 0.35}) sepia(${done * 0.5})`;
      ctx.drawImage(itemIcon(k), Math.round(x), Math.round(by - 58 + spin), 16, 16);
      ctx.restore();
    });
    // The heat bar: the glow to turn it in, and where it is now.
    const bx = cx - 100;
    const bw = 200;
    const yb = oy + 150;
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(bx - 1, yb - 1, bw + 2, 10);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#3a2010');
    grad.addColorStop(0.5, '#6a3416');
    grad.addColorStop(1, '#3a2010');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, yb, bw, 8);
    if (m.zone) {
      ctx.fillStyle = '#e8a030';
      ctx.fillRect(bx + (m.zone.c - m.zone.w) * bw, yb, m.zone.w * 2 * bw, 8);
      ctx.fillStyle = '#fff0a0';
      ctx.fillRect(bx + m.zone.c * bw - 1, yb, 2, 8);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(bx + m.pos * bw) - 1, yb - 3, 3, 14);
  }

  pixPot(ctx, ox, oy) {
    const m = this.mini;
    const cx = ox + (this.w * CHAR_W) / 2 - 20;
    const by = oy + 150;
    this.fire(ctx, cx, by, 60, 0.4 + m.heat);
    // The pot: iron, its rim catching the light; the stew in it.
    const pw = 64;
    ctx.fillStyle = '#22201e';
    ctx.beginPath();
    ctx.ellipse(cx, by - 38, pw / 2, 26, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(cx - pw / 2, by - 50, pw, 12);
    ctx.fillStyle = '#3a3634';
    ctx.fillRect(cx - pw / 2 - 2, by - 52, pw + 4, 4);
    ctx.fillStyle = '#5a5652';
    ctx.fillRect(cx - pw / 2 - 2, by - 52, pw + 4, 1);
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.ellipse(cx, by - 48, pw / 2 - 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bubbles, as hot as it is; steam.
    for (const b of m.bubbles) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(Math.round(cx + b.x), Math.round(by - 49 - b.r), 2, 2);
    }
    for (const s of m.steam) {
      ctx.fillStyle = `rgba(230,230,240,${(0.35 * (1 - s.t / s.life)).toFixed(3)})`;
      ctx.fillRect(Math.round(cx + s.x), Math.round(by - 56 - s.t * 30), 3, 3);
    }
    // The heat gauge, with the simmer to keep it in.
    const gx = cx + 70;
    const gy = by - 100;
    const gh = 96;
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(gx - 1, gy - 1, 12, gh + 2);
    const grd = ctx.createLinearGradient(0, gy + gh, 0, gy);
    grd.addColorStop(0, '#2848a0');
    grd.addColorStop(0.5, '#c88028');
    grd.addColorStop(1, '#e02818');
    ctx.fillStyle = grd;
    ctx.fillRect(gx, gy, 10, gh);
    ctx.fillStyle = 'rgba(120,240,120,0.55)';
    ctx.fillRect(gx - 3, gy + gh * (1 - m.zone[1]), 16, gh * (m.zone[1] - m.zone[0]));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx - 4, Math.round(gy + gh * (1 - m.heat)) - 1, 18, 3);
  }

  pixOven(ctx, ox, oy) {
    const m = this.mini;
    const cx = ox + (this.w * CHAR_W) / 2;
    const by = oy + 150;
    // The oven: a brick dome, the fire's glow in its mouth.
    ctx.fillStyle = '#7a3a26';
    ctx.beginPath();
    ctx.ellipse(cx, by - 40, 80, 70, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - 80, by - 40, 160, 40);
    ctx.fillStyle = '#5a2a1a';
    for (let y = by - 100; y < by; y += 8) for (let x = cx - 80 + ((y / 8) % 2) * 8; x < cx + 80; x += 16) ctx.fillRect(x, y, 1, 8);
    for (let y = by - 100; y < by; y += 8) ctx.fillRect(cx - 80, y, 160, 1);
    const glow = ctx.createRadialGradient(cx, by - 30, 4, cx, by - 30, 60);
    glow.addColorStop(0, 'rgba(255,170,60,0.9)');
    glow.addColorStop(1, 'rgba(120,40,10,0.95)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(cx, by - 26, 50, 36, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - 50, by - 26, 100, 22);
    // The pie, browning: pale, golden, then too far.
    const d = m.stage === 'bake' ? m.done : 0;
    const col = d < 0.78 ? mix('#f0e0b0', '#e0a040', d / 0.78) : mix('#e0a040', '#4a2010', Math.min(1, (d - 0.78) / 0.35));
    ctx.fillStyle = '#8a8a90';
    ctx.fillRect(cx - 30, by - 12, 60, 4);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx, by - 14, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // The crimped edge, as far as it's done; the topping in the middle.
    const crimped = m.stage === 'crimp' ? m.k / m.seq.length : 1;
    ctx.fillStyle = mix(col, '#ffffff', 0.18);
    for (let i = 0; i < 24 * crimped; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * 25) - 1, Math.round(by - 14 + Math.sin(a) * 6.5) - 1, 2, 2);
    }
    this.picked.forEach((k, i) => {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.filter = `brightness(${1 - d * 0.4})`;
      ctx.drawImage(itemIcon(k), Math.round(cx - 18 + i * 12), by - 22, 12, 12);
      ctx.restore();
    });
    // How done it is.
    if (m.stage === 'bake') {
      const bx = cx - 80;
      const yb = oy + 170;
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(bx - 1, yb - 1, 162, 8);
      ctx.fillStyle = 'rgba(240,200,80,0.6)';
      ctx.fillRect(bx + 0.7 * 160, yb, 0.16 * 160, 6);
      ctx.fillStyle = col;
      ctx.fillRect(bx, yb, Math.min(1.1, d) / 1.1 * 160, 6);
    }
  }

  pixTable(ctx, ox, oy) {
    const m = this.mini;
    const cx = ox + (this.w * CHAR_W) / 2;
    const by = oy + 140;
    // The board on the table.
    ctx.fillStyle = '#6a4424';
    ctx.fillRect(cx - 120, by, 240, 24);
    ctx.fillStyle = '#c89a60';
    ctx.fillRect(cx - 100, by - 14, 200, 14);
    ctx.fillStyle = '#a87a44';
    ctx.fillRect(cx - 100, by - 2, 200, 2);
    // What's being cut, sliding under the knife, its marks.
    const span = 200;
    const left = cx - 100;
    this.picked.forEach((k, i) => {
      const x = left + span - ((m.slide * span + i * 60) % (span + 40));
      if (x > left - 8 && x < left + span - 8) ctx.drawImage(itemIcon(k), Math.round(x), by - 30, 16, 16);
    });
    for (const mk of m.marks) {
      if (mk.cut !== undefined) continue;
      const x = left + (mk.at - m.slide) * span;
      if (x < left || x > left + span) continue;
      ctx.fillStyle = '#ffffff';
      for (let y = by - 30; y < by - 2; y += 4) ctx.fillRect(Math.round(x), y, 1, 2);
    }
    // The knife, in the middle.
    const kx = cx;
    const down = m.chop > 0 ? 8 : 0;
    ctx.fillStyle = '#d8dce4';
    ctx.fillRect(kx - 1, by - 46 + down, 3, 26);
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(kx - 2, by - 56 + down, 5, 10);
  }

  // ------------------------------------------------------------ choosing
  togglePick() {
    const q = this.list && this.list[this.sel];
    if (!q) return;
    const i = this.picked.indexOf(q.item);
    if (i >= 0) this.picked.splice(i, 1);
    else if (this.picked.length >= 3) this.msg = { text: 'Three things at most.', color: C.orange };
    else this.picked.push(q.item);
    this.ui.audio?.play('select');
  }

  toggleFire() {
    this.o.lit = !this.o.lit;
    this.o.onFire?.(this.o.lit);
  }

  start() {
    if (this.st === 'c' && !this.o.lit) {
      this.msg = { text: 'The fire\'s out: light it first.', color: C.orange };
      return;
    }
    // (Still there, all of it?)
    this.picked = this.picked.filter((k) => this.me.inv.some((s) => s && s.item === k));
    if (!this.picked.length) return;
    this.msg = null;
    this.phase = 'cook';
    const colors = this.picked.flatMap((k) => ingredientTypes(k)).map((t) => TYPES[t].color);
    const m = { t: 0, preview: true, say: null };
    if (this.st === 'c') Object.assign(m, { round: 0, pos: 0, dir: 1, speed: 0.75, scores: [], spin: 0, roundT: 0 }, { zone: zoneFor(0) });
    if (this.st === 'p') Object.assign(m, { heat: 0.3, vel: 0, dur: 9, inZone: 0, zone: [0.45, 0.68], bubbles: [], steam: [], color: avgColor(colors) });
    if (this.st === 'o') Object.assign(m, { stage: 'crimp', seq: Array.from({ length: 5 }, () => Object.keys(ARROWS)[Math.floor(Math.random() * 4)]), k: 0, kT: 0, crimp: [], done: 0, rate: 0.1 + Math.random() * 0.04 });
    if (this.st === 't') Object.assign(m, { slide: 0, speed: 0.16, marks: Array.from({ length: 6 }, (_, i) => ({ at: 0.78 + i * 0.22 + (Math.random() - 0.5) * 0.06 })), cuts: [], chop: 0 });
    this.mini = m;
    this.ui.audio?.play(this.st === 'p' ? 'pour' : 'torch');
  }

  // ------------------------------------------------------------ cooking
  update(dt) {
    this.t += dt;
    this.tickParts(dt);
    if (this.phase === 'reveal') {
      this.tickReveal(dt);
      return;
    }
    if (this.phase !== 'cook') return;
    const m = this.mini;
    m.t += dt;
    if (this.st === 'c') {
      m.pos += m.dir * m.speed * dt;
      if (m.pos > 1) {
        m.pos = 2 - m.pos;
        m.dir = -1;
      } else if (m.pos < 0) {
        m.pos = -m.pos;
        m.dir = 1;
      }
      m.spin += dt * 2;
      m.roundT += dt;
      // (Left too long: that side's burnt.)
      if (m.roundT > 7) this.turn(true);
    } else if (this.st === 'p') {
      // The fire's own way: it wanders, and dies down if left.
      m.vel += (Math.random() - 0.5) * 1.6 * dt - 0.06 * dt;
      m.vel *= Math.pow(0.4, dt);
      m.heat = Math.max(0, Math.min(1, m.heat + m.vel * dt * 2.2));
      if (m.heat >= m.zone[0] && m.heat <= m.zone[1]) m.inZone += dt;
      m.say = m.heat > m.zone[1] ? 'Boiling over!' : m.heat < m.zone[0] ? 'Barely warm...' : 'A good simmer.';
      m.sayColor = m.heat > m.zone[1] ? C.red : m.heat < m.zone[0] ? '#80a8e0' : C.green;
      if (Math.random() < dt * (2 + m.heat * 18)) m.bubbles.push({ x: (Math.random() - 0.5) * 50, r: 0, life: 0.3 + Math.random() * 0.3 });
      for (const b of m.bubbles) b.r += dt * 6;
      m.bubbles = m.bubbles.filter((b) => b.r < b.life * 6);
      if (Math.random() < dt * 4) m.steam.push({ x: (Math.random() - 0.5) * 40, t: 0, life: 1.4 });
      for (const s of m.steam) s.t += dt;
      m.steam = m.steam.filter((s) => s.t < s.life);
      if (m.t >= m.dur) this.finish(Math.min(1, m.inZone / (m.dur * 0.85)));
    } else if (this.st === 'o') {
      if (m.stage === 'crimp') {
        m.kT += dt;
        if (m.kT > 1.4) this.crimp(null);
      } else {
        m.done += m.rate * dt;
        if (m.done >= 1.15) this.takeOut();
      }
    } else if (this.st === 't') {
      m.slide += m.speed * dt;
      m.speed += dt * 0.02;
      if (m.chop > 0) m.chop -= dt;
      // (A mark gone past the knife: missed.)
      for (const mk of m.marks) if (mk.cut === undefined && mk.at - m.slide < 0.5 - 0.12) {
        mk.cut = 0;
        m.cuts.push(0);
      }
      if (m.cuts.length >= m.marks.length) this.finish(m.cuts.reduce((a, b) => a + b, 0) / m.cuts.length);
    }
  }

  // (Round 51) Out it comes: sparks drawn in as it builds, then the burst
  // (or the smoke), its sound, and the stars ringing in one by one.
  tickReveal(dt) {
    const R = this.reveal;
    const was = R.t;
    R.t += dt;
    const cx = (this.w * CHAR_W) / 2;
    const cy = 8 * CHAR_H;
    if (R.t < R.build) {
      const k = R.t / R.build;
      const warm = this.st === 't' ? ['#e8f0ff', '#ffffff'] : ['#ffd070', '#ffb040', '#fff0c0'];
      for (let i = 0; i < 3; i++) {
        if (Math.random() > dt * (14 + 50 * k)) continue;
        const a = Math.random() * Math.PI * 2;
        const r = 70 + Math.random() * 30;
        const v = 70 + Math.random() * 90 + 80 * k;
        this.part({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.7, vx: -Math.cos(a) * v, vy: -Math.sin(a) * v * 0.7, life: r / v * 0.9, col: warm[i % warm.length], s: 1 + (Math.random() < 0.3 ? 1 : 0) });
      }
    }
    if (was < R.build && R.t >= R.build) this.burst();
    // (Each star in, with a ding.)
    const n = Math.max(1, Math.round(this.result.score * 5));
    for (let i = 0; i < n; i++) {
      const at = R.build + 0.35 + i * 0.13;
      if (was < at && R.t >= at && !this.result.fromRecipe) this.ui.audio?.play('star_ding');
    }
    if (R.t >= R.dur) this.phase = 'done';
  }

  burst() {
    const T = this.tier;
    const cx = (this.w * CHAR_W) / 2;
    const cy = 8 * CHAR_H;
    this.ui.audio?.play(T.sound);
    if (T.smoke) {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        this.part({ x: cx + Math.cos(a) * 6, y: cy + Math.sin(a) * 6, vx: Math.cos(a) * 20, vy: -20 - Math.random() * 30, life: 1 + Math.random(), col: T.spark[i % T.spark.length], s: 3 + Math.floor(Math.random() * 3), a: 0.8 });
      }
      return;
    }
    const many = T === TIERS[0] ? 70 : 42;
    for (let i = 0; i < many; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 50 + Math.random() * 130;
      this.part({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, g: 120, life: 0.7 + Math.random() * 0.8, col: T.spark[i % T.spark.length], s: 1 + Math.floor(Math.random() * 2.4) });
    }
  }

  part(q) {
    q.max = q.life;
    (this.parts ||= []).push(q);
    if (this.parts.length > 260) this.parts.shift();
  }

  tickParts(dt) {
    if (!this.parts) return;
    for (const q of this.parts) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += (q.g || 0) * dt;
      q.life -= dt;
    }
    this.parts = this.parts.filter((q) => q.life > 0);
    // (A good one still twinkles, done.)
    if (this.phase === 'done' && this.tier && !this.tier.smoke && Math.random() < dt * 4) {
      const a = Math.random() * Math.PI * 2;
      this.part({ x: (this.w * CHAR_W) / 2 + Math.cos(a) * 28, y: 8 * CHAR_H + Math.sin(a) * 22, vx: 0, vy: -6, life: 0.6, col: this.tier.spark[0], s: 1 });
    }
  }

  skipReveal() {
    const R = this.reveal;
    if (R.t < R.build) this.burst();
    R.t = R.dur;
    this.phase = 'done';
  }

  // Campfire: a turn of the skewer, as close to the glow's heart as may be.
  turn(late = false) {
    const m = this.mini;
    const s = late ? 0 : Math.max(0, 1 - Math.abs(m.pos - m.zone.c) / (m.zone.w * 1.6));
    m.scores.push(s);
    m.say = late ? 'Burnt on that side!' : s > 0.85 ? 'Just right!' : s > 0.5 ? 'Not bad.' : s > 0 ? 'Hmm, a bit off.' : 'Charred!';
    m.sayColor = s > 0.85 ? C.green : s > 0.5 ? C.fg : C.orange;
    this.ui.audio?.play(s > 0.5 ? 'crackle' : 'hiss');
    m.round++;
    m.roundT = 0;
    if (m.round >= 3) return this.finish(m.scores.reduce((a, b) => a + b, 0) / 3);
    m.zone = zoneFor(m.round);
    m.speed += 0.3;
  }

  // Oven: a crimp of the crust (the arrow asked for, quick).
  crimp(code) {
    const m = this.mini;
    const ok = code === m.seq[m.k];
    m.crimp.push(ok ? Math.max(0.4, 1 - m.kT / 1.4) : 0);
    m.say = ok ? 'Neatly done.' : code ? 'Oops, a wonky edge.' : 'Too slow!';
    m.sayColor = ok ? C.green : C.orange;
    m.k++;
    m.kT = 0;
    if (m.k >= m.seq.length) {
      m.stage = 'bake';
      m.say = 'In it goes. SPACE when it\'s golden.';
      m.sayColor = C.hi;
    }
  }

  // Oven: out it comes.
  takeOut() {
    const m = this.mini;
    const bake = m.done >= 1.15 ? 0 : Math.max(0, 1 - Math.abs(m.done - 0.78) / 0.32);
    const crimp = m.crimp.reduce((a, b) => a + b, 0) / m.crimp.length;
    this.finish(crimp * 0.35 + bake * 0.65);
  }

  // Table: a cut, on the mark nearest the knife.
  chop() {
    const m = this.mini;
    m.chop = 0.12;
    const mk = m.marks.filter((q) => q.cut === undefined).sort((a, b) => Math.abs(a.at - m.slide - 0.5) - Math.abs(b.at - m.slide - 0.5))[0];
    if (!mk) return;
    const off = Math.abs(mk.at - m.slide - 0.5);
    if (off > 0.1) {
      m.say = 'Missed the mark.';
      m.sayColor = C.orange;
      return;
    }
    mk.cut = Math.max(0, 1 - off / 0.09);
    m.cuts.push(mk.cut);
    m.say = mk.cut > 0.8 ? 'Clean cut!' : 'Ragged.';
    m.sayColor = mk.cut > 0.8 ? C.green : C.fg;
    this.ui.audio?.play('chop');
    if (m.cuts.length >= m.marks.length) this.finish(m.cuts.reduce((a, b) => a + b, 0) / m.cuts.length);
  }

  // Done: what it came out as.
  finish(score) {
    const p = this.me;
    const inv = p.inv;
    // (Each thing that went in, used up.)
    const ings = this.picked.filter((k) => takeOne(inv, baseOf(k)) || takeOne(inv, k));
    if (!ings.length) {
      this.phase = 'pick';
      return;
    }
    const key = cookDish(ings, this.st, score);
    this.give(key, score, false, ings);
  }

  give(key, score, fromRecipe, ings) {
    const p = this.me;
    const n = this.st === 'p' ? 2 : 1;
    const left = p.give(key, n);
    if (left) this.game.spawnDrop(key, left, p.x, p.y, p.z, true);
    learnKinds(p, ings);
    this.result = { key, score, n, fromRecipe };
    // (Round 51) Not straight out: it builds, and then out it comes.
    this.tier = fromRecipe ? TIERS[1] : tierOf(score);
    this.phase = 'reveal';
    this.reveal = { t: 0, build: fromRecipe ? 0.8 : BUILD, dur: fromRecipe ? 1.9 : REVEAL };
    this.parts = [];
    this.msg = null;
    this.game.stats && (this.game.stats.cooked = (this.game.stats.cooked || 0) + 1);
    this.ui.audio?.play('cook_build');
    this.game.renderer.emit(p.x, p.y + 1, p.z, { n: 8, color: ['#e8e8f0', '#c8c8d8'], up: 18, speed: 8, life: 1.2, gravity: -10, shape: 'puff' });
  }

  // Made from a recipe: what goes in it taken, and the same dish again.
  fromRecipe() {
    const r = this.recipes()[this.sel];
    if (!r) return;
    if (this.st === 'c' && !this.o.lit) {
      this.msg = { text: 'The fire\'s out: light it first.', color: C.orange };
      return;
    }
    if (!canMake(this.me.inv, r)) {
      this.msg = { text: `You need: ${r.ings.map((k) => (ITEMS[k] ? ITEMS[k].name : k)).join(', ')}.`, color: C.orange };
      return;
    }
    for (const k of r.ings) takeOne(this.me.inv, k);
    this.picked = r.ings.slice();
    this.give(r.key, 1, true, r.ings);
  }

  writeDown() {
    if (learnRecipe(this.me, this.result.key) !== 'new') return;
    this.msg = { text: 'Written down: you can make it again from your recipes.', color: C.green };
    this.ui.audio?.play('etch');
  }

  // (Round 51) A recipe copied onto one of your blank scrolls, to sell to
  // a cook or give away (you keep it in your own recipes too).
  toScroll(key) {
    if (!key) return;
    if (!this.me.inv.some((q) => q && q.item === 'scroll')) {
      this.msg = { text: 'You need a blank scroll to copy it onto.', color: C.orange };
      return;
    }
    if (!writeRecipe(this.me.inv, key)) {
      this.msg = { text: 'No room in your pack for it.', color: C.orange };
      return;
    }
    learnRecipe(this.me, key);
    this.msg = { text: `Copied onto a scroll: ${ITEMS[`recipe~${key}`].name}.`, color: C.green };
    this.ui.audio?.play('etch');
  }

  again() {
    this.phase = 'pick';
    this.tab = 'pack';
    this.picked = this.picked.filter((k) => this.me.inv.some((s) => s && (s.item === k || baseOf(s.item) === k)));
    this.result = null;
    this.msg = null;
  }

  onKey(k) {
    const code = k.code;
    if (code === 'Escape') {
      if (this.phase === 'cook') {
        this.phase = 'pick';
        this.msg = { text: 'You leave it be. (Nothing used up.)', color: C.dim };
      } else this.close();
      return true;
    }
    if (this.phase === 'reveal') {
      if (['Space', 'Enter', 'Escape', 'NumpadEnter'].includes(code)) this.skipReveal();
      return true;
    }
    if (this.phase === 'pick') {
      const n = (this.list || []).length;
      if (code === 'Tab') {
        this.tab = this.tab === 'pack' ? 'recipes' : 'pack';
        this.sel = 0;
        this.scroll = 0;
      } else if (code === 'ArrowUp' || code === 'KeyW') this.sel = Math.max(0, this.sel - 1);
      else if (code === 'ArrowDown' || code === 'KeyS') this.sel = Math.min(Math.max(0, n - 1), this.sel + 1);
      else if (code === 'Space' && this.tab === 'pack') this.togglePick();
      else if (code === 'Enter' && this.tab === 'recipes') this.fromRecipe();
      else if (code === 'KeyS' && this.tab === 'recipes') this.toScroll(this.recipes()[this.sel]?.key);
      else if ((code === 'KeyC' || code === 'Enter') && this.tab === 'pack') this.start();
      else if (code === 'KeyL' && this.st === 'c' && !this.o.lit) this.toggleFire();
      else if (code === 'KeyP' && this.st === 'c' && this.o.lit) this.toggleFire();
      return true;
    }
    if (this.phase === 'cook') {
      const m = this.mini;
      if (this.st === 'c' && code === 'Space') this.turn();
      else if (this.st === 'p' && (code === 'ArrowUp' || code === 'KeyW')) m.vel += 0.32;
      else if (this.st === 'p' && (code === 'ArrowDown' || code === 'KeyS')) m.vel -= 0.32;
      else if (this.st === 'o' && m.stage === 'crimp' && ARROWS[code]) this.crimp(code);
      else if (this.st === 'o' && m.stage === 'bake' && code === 'Space') this.takeOut();
      else if (this.st === 't' && code === 'Space') this.chop();
      return true;
    }
    if (code === 'KeyW') this.writeDown();
    else if (code === 'KeyS') this.toScroll(this.result && this.result.key);
    else if (code === 'KeyC') this.again();
    else if (code === 'Enter' || code === 'Space') this.close();
    return true;
  }
}

// The glow to turn the skewer in: narrower each turn.
function zoneFor(round) {
  return { c: 0.25 + Math.random() * 0.5, w: 0.12 - round * 0.025 };
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
function mix(a, b, k) {
  const x = hex(a);
  const y = hex(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * Math.max(0, Math.min(1, k))));
}
function avgColor(list) {
  if (!list.length) return '#a86a3a';
  const s = list.map(hex).reduce((a, c) => a.map((v, i) => v + c[i]), [0, 0, 0]);
  // (A stew's darker than what's in it.)
  return toHex(s.map((v) => (v / list.length) * 0.75));
}

// (Round 51) A blank scroll used: the recipes you know (from any of the
// places), to copy one onto it.
export class RecipeScrollWindow extends Window {
  constructor(ui, game) {
    super(ui, 52, 22, { kind: 'recipescroll' });
    this.game = game;
    this.sel = 0;
    this.scroll = 0;
    this.msg = null;
  }

  list() {
    return (this.game.player.recipes || []).filter((r) => ITEMS[r.key]);
  }

  draw(g) {
    const list = this.list();
    g.fill(0, 0, this.w, this.h, ' ', C.fg, BG);
    g.box(0, 0, this.w, this.h, { bg: BG, double: true, title: 'COPY A RECIPE ONTO A SCROLL' });
    const blanks = this.game.player.inv.reduce((n, s) => n + (s && s.item === 'scroll' ? s.count : 0), 0);
    g.text(2, 1, `Blank scrolls: ${blanks}`, blanks ? C.dim : C.red);
    const rows = 7;
    if (this.sel >= list.length) this.sel = Math.max(0, list.length - 1);
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + rows) this.scroll = this.sel - rows + 1;
    if (!list.length) wrap('You don\'t know any recipes yet. Cook something good, and write it down when it\'s done (W).', this.w - 6).forEach((l, i) => g.text(3, 4 + i, l, C.dim));
    list.slice(this.scroll, this.scroll + rows).forEach((r, i) => {
      const k = this.scroll + i;
      const y = 3 + i * 2;
      const cur = k === this.sel;
      const hov = this.hovering(2, y, this.w - 4, 2);
      g.fill(2, y, this.w - 4, 2, ' ', C.fg, cur ? '#3a2a1a' : hov ? '#2a2016' : BG);
      g.icon(3, y, r.key, 0);
      g.text(7, y, ITEMS[r.key].name.slice(0, this.w - 10), cur ? C.white : C.fg);
      const where = { c: 'campfire', p: 'furnace pot', o: 'oven', t: 'table' }[r.st];
      g.text(7, y + 1, `${where}: ${r.ings.map((q) => (ITEMS[q] ? ITEMS[q].name : q)).join(', ')}`.slice(0, this.w - 10), C.dim);
      this.hit(2, y, this.w - 4, 2, () => {
        this.sel = k;
        this.write();
      });
    });
    if (this.msg) g.center(this.h - 4, this.msg.text.slice(0, this.w - 4), this.msg.color);
    g.center(this.h - 2, '↑↓ choose · ENTER copy it onto a scroll · ESC', C.faint);
  }

  write() {
    const r = this.list()[this.sel];
    if (!r) return;
    const inv = this.game.player.inv;
    if (!inv.some((q) => q && q.item === 'scroll')) {
      this.msg = { text: 'You\'ve no blank scroll left.', color: C.orange };
      return;
    }
    if (!writeRecipe(inv, r.key)) {
      this.msg = { text: 'No room in your pack for it.', color: C.orange };
      return;
    }
    this.msg = { text: `Copied: ${ITEMS[`recipe~${r.key}`].name}.`, color: C.green };
    this.ui.audio?.play('etch');
  }

  onKey(k) {
    const n = this.list().length;
    if (k.code === 'Escape') this.close();
    else if (k.code === 'ArrowUp' || k.code === 'KeyW') this.sel = Math.max(0, this.sel - 1);
    else if (k.code === 'ArrowDown' || k.code === 'KeyS') this.sel = Math.min(Math.max(0, n - 1), this.sel + 1);
    else if (k.code === 'Enter' || k.code === 'Space') this.write();
    return true;
  }
}
