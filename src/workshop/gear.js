// The Workshop's Gear tab (round 66): how a piece of the mod's (or one of
// the game's) looks on someone, wearing it or holding it (see mod/gear.js).
// Worn: one of the game's looks under it, tinted, and art of its own laid
// over the person, from the front, the side and the back. Held: art of
// its own in the hand, gripped where it's clicked, as big and as slanted
// as it's set. Seen on a person, any way round, standing, walking or
// swinging it.
import { h, ic, clear, button, field, slider, seg, select, panel, toast, canvas, colorButton, check } from './kit.js';
import { titleBar, menuButton, refPicker, quantize, vanillaIcon } from './common.js';
import { WORN_LOOKS, OVER_W, OVER_H, wornLook } from '../mod/gear.js';
import { newAsset, encodeCel, freeId, LIMITS } from '../mod/format.js';
import { NODES } from '../mod/graph.js';
import { drawHumanoid, SPR_PAD } from '../render/people.js';
import { JOBS, makeLook } from '../entities/npcgen.js';
import { RNG } from '../util/rng.js';
import { ITEMS } from '../world/items.js';
import { itemIcon } from '../render/sprites.js';

const PEOPLE = ['guard', 'farmer', 'noble', 'merchant', 'blacksmith', 'miner', 'hunter', 'priest', 'fisher', 'scholar'];
const SLOTS = { head: 'its head', body: 'its body', legs: 'its legs', feet: 'its feet', shield: 'the off hand (a shield)' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default class GearTool {
  constructor(app) {
    this.app = app;
    this.id = null;
    this.person = 'guard';
    this.anim = 'walk';
    this.t = 0;
  }

  get g() {
    return this.id && this.app.mod.gear && this.app.mod.gear[this.id] ? this.app.mod.gear[this.id] : null;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
  }

  unmount() {
    window.cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  current() {
    return this.g ? { kind: 'gear', id: this.id } : null;
  }

  hintText() {
    return this.g ? 'Choose the piece it\'s the look of; then how it\'s worn (a look of the game\'s under it, a tint, art over it) and how it\'s held (art, grip, size, slant). Click the art in the hand to say where it\'s gripped.' : 'A look for a piece of gear: how it looks worn, and held.';
  }

  open(kind, id) {
    if (!id || !this.app.mod.gear || !this.app.mod.gear[id]) {
      this.id = null;
      return this.empty();
    }
    this.id = id;
    this.build();
    return null;
  }

  reload() {
    if (this.g) this.build();
    else this.empty();
  }

  removed(kind, id) {
    if (kind === 'gear' && id === this.id) {
      this.id = null;
      this.empty();
    } else if (this.g && (kind === 'assets' || kind === 'entities')) this.drawSide();
  }

  renamed() {
    if (this.nameEl && this.g) this.nameEl.value = this.g.name;
  }

  empty() {
    window.cancelAnimationFrame(this.raf);
    clear(this.stage);
    clear(this.insp);
    const items = this.modItems();
    const card = (icon, t, d, fn) => {
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, ic(icon), t), h('div', { class: 'd' }, d));
      c.addEventListener('click', fn);
      return c;
    };
    this.stage.append(h('div', { class: 'home scroll', style: { overflow: 'auto' } },
      h('h1', null, 'Gear'),
      h('div', { class: 'sub' }, 'How a piece looks on someone, worn or held: your own armour drawn over the person wearing it (front, side and back), your own weapon\'s picture in the hand, gripped where you say, as big and slanted as you like. On players and people alike.'),
      h('div', { class: 'cards' },
        card('plus', 'A new look', 'For any piece: yours, or one of the game\'s.', () => this.app.create('gear', { name: 'Gear look' })),
        ...items.slice(0, 12).map((e) => card('helm', `For ${e.name}`, 'A look for this piece of yours.', () => this.app.create('gear', { name: `${e.name} look`, item: `@${e.id}` }))))));
    this.insp.append(h('div', { class: 'insp-head' }, ic('helm'), 'Gear'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open.')));
  }

  // The mod's items that are worn or held.
  modItems() {
    return Object.values(this.app.mod.entities || {}).filter((e) => {
      const r = rootOf(e);
      return r && ['tpl.weapon', 'tpl.tool', 'tpl.armor', 'tpl.material', 'tpl.food'].includes(r.type);
    });
  }

  // ------------------------------------------------------------ the piece
  // What the piece is: { slot (where it's worn, or null), icon (canvas),
  // name }.
  piece() {
    const g = this.g;
    const ref = g && g.item;
    if (!ref) return { slot: null, icon: null, name: null };
    if (ref[0] === '@') {
      const e = this.app.mod.entities[ref.slice(1)];
      const r = rootOf(e);
      if (!e || !r) return { slot: null, icon: null, name: '(deleted)' };
      const v = r.v || {};
      const slot = r.type === 'tpl.armor' ? v.slot || 'body' : null;
      const a = v.icon && this.app.mod.assets[v.icon];
      return { slot, icon: a ? this.app.assetCanvas(a, 0) : null, name: e.name };
    }
    const it = ITEMS[ref];
    let icon = null;
    try {
      icon = it ? itemIcon(ref) : null;
    } catch {
      icon = null;
    }
    return { slot: it && it.slot ? it.slot : null, icon, name: it ? it.name : ref };
  }

  set(fn, o = {}) {
    const now = performance.now();
    if (now - (this.lastCk || 0) > 700) this.app.checkpoint('gear', this.id);
    this.lastCk = now;
    fn(this.g);
    this.app.touch('gear', this.id);
    this.cache = null;
    if (o.side) this.drawSide();
  }

  // ------------------------------------------------------------ the screen
  build() {
    const app = this.app;
    clear(this.stage);
    clear(this.insp);
    const bar = titleBar(app, 'gear', this.id,
      select(PEOPLE.map((k) => [k, JOBS[k] ? JOBS[k].title : k]), this.person, (v) => {
        this.person = v;
        this.cache = null;
      }),
      seg([['stand', 'Standing'], ['walk', 'Walking'], ['swing', 'Swinging']], this.anim, (v) => (this.anim = v)),
      h('span', { class: 'spacer' }),
      menuButton('Draw', () => [
        { label: 'Its look worn (art over the person)', icon: 'pencil', onClick: () => this.drawWorn() },
        { label: 'Its look in the hand', icon: 'pencil', onClick: () => this.drawHeldArt() },
      ], { small: true, icon: 'pencil' }));
    this.nameEl = bar.querySelector('.title input');
    this.cv = h('canvas', { class: 'gr-view' });
    this.wrap = h('div', { class: 'gr-wrap' }, this.cv);
    this.stage.append(bar, this.wrap);
    this.insp.append(h('div', { class: 'insp-head' }, ic('helm'), this.g.name));
    this.side = h('div', { class: 'insp-body scroll' });
    this.insp.append(this.side);
    this.drawSide();
    let last = performance.now();
    const loop = (now) => {
      this.raf = window.requestAnimationFrame(loop);
      this.t += Math.min(0.1, (now - last) / 1000);
      last = now;
      this.draw();
    };
    window.cancelAnimationFrame(this.raf);
    this.raf = window.requestAnimationFrame(loop);
    app.hint(this.hintText());
  }

  look() {
    const job = this.person;
    return makeLook(new RNG(11 + job.length * 97), 'vale', 'adult', job, null);
  }

  // The person drawn (cached while nothing changes): [dir][frame] canvases.
  sheets() {
    if (this.cache) return this.cache;
    const g = this.g;
    const P = this.piece();
    const look = { ...this.look() };
    delete look.gear;
    const extra = { overlays: [] };
    if (g.worn && P.slot) {
      const W = wornLook(this.app.mod, g, P.slot);
      const base = W.base && W.base !== 'none' ? W.base + (W.tint ? `:${W.tint}` : '') : null;
      if (P.slot === 'head') look.hat = base;
      else if (base) look.gear = { [P.slot]: base };
      if (W.frames) extra.overlays.push({ frames: W.frames, slot: P.slot });
    }
    const out = [];
    for (let d = 0; d < 4; d++) {
      out[d] = [];
      for (let f = 0; f < 4; f++) {
        const px = drawHumanoid(look, d, f, extra);
        const c = canvas(px.w, px.h);
        c.getContext('2d').putImageData(px.toImageData(), 0, 0);
        out[d][f] = c;
      }
    }
    // The held art, and its grip.
    const hd = g.held || null;
    let img = null;
    if (hd && hd.art && this.app.mod.assets[hd.art]) img = this.app.assetCanvas(this.app.mod.assets[hd.art], 0);
    else if (hd || !P.slot) img = P.icon;
    this.cache = { out, img, held: hd };
    return this.cache;
  }

  draw() {
    const cv = this.cv;
    if (!cv || !cv.isConnected || !this.g) return;
    const W = Math.max(200, this.wrap.clientWidth - 2);
    const H = Math.max(200, this.wrap.clientHeight - 2);
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#121a3e';
    x.fillRect(0, 0, W, H);
    const S = this.sheets();
    const z = clamp(Math.floor(Math.min(W / 4 / 26, H / 40)), 2, 10);
    const names = ['Front', 'Side', 'Back', 'Other side'];
    const walking = this.anim === 'walk';
    const frame = walking ? 1 + (Math.floor(this.t * 5) % 2) : this.anim === 'swing' ? 3 : 0;
    const act = this.anim === 'swing' ? 1 - ((this.t * 1.3) % 1) : 0;
    for (let d = 0; d < 4; d++) {
      const ox = Math.floor((W / 4) * d + (W / 4 - 16 * z) / 2);
      const oy = Math.floor((H - 30 * z) / 2);
      // (The ground under them.)
      x.fillStyle = '#1b2452';
      x.fillRect(ox - z * 3, oy + 30 * z, 22 * z, z * 2);
      x.save();
      x.translate(ox, oy);
      x.scale(z, z);
      const top = SPR_PAD;
      const bob = walking && frame === 1 ? -1 : 0;
      const sheet = S.out[d][Math.min(3, frame)];
      // (Facing away, what's in the hand is behind them.)
      if (S.img && d === 2) this.drawHeld(x, S, d, top, bob, act);
      x.drawImage(sheet, 0, 0);
      if (S.img && d !== 2) this.drawHeld(x, S, d, top, bob, act);
      x.restore();
      x.fillStyle = '#a4addb';
      x.font = '12px monospace';
      x.textAlign = 'center';
      x.fillText(names[d], ox + 8 * z, oy + 30 * z + 22);
    }
  }

  // The piece in the hand, as the game holds it (see renderer.drawHeld).
  drawHeld(x, S, dir, top, bob, act) {
    const hd = S.held || {};
    const img = S.img;
    const hy = top + 8 + 6 - 1 + bob;
    const hx = dir === 0 ? 12 : dir === 1 ? 7 : dir === 3 ? 8 : 3;
    const mir = dir === 1;
    const gx = -(hd.x ?? 3);
    const gy = -(hd.y ?? 13);
    const sc = hd.scale ?? 0.8;
    const extra = ((hd.angle || 0) * Math.PI) / 180;
    let ang = 0;
    if (act > 0) {
      const sign = dir === 1 ? -1 : 1;
      ang = sign * (1 - act) * 2.2 - sign * 1.1;
    }
    x.save();
    x.translate(hx, hy);
    x.rotate(ang + (mir ? -extra : extra));
    x.scale(mir ? -sc : sc, sc);
    x.drawImage(img, gx, gy);
    x.restore();
  }

  // ------------------------------------------------------------ the panel
  drawSide() {
    const g = this.g;
    const side = this.side;
    if (!side || !g) return;
    clear(side);
    this.cache = null;
    const app = this.app;
    const P = this.piece();
    const what = h('div');
    what.append(field('The look of', refPicker(app, 'item', g.item || null, (v) => this.set((x) => (x.item = v || null), { side: true })), { tip: 'The piece it\'s the look of: one of yours, or one of the game\'s.' }),
      h('div', { class: 'note' }, !g.item ? 'Choose the piece first.' : P.slot ? `Worn on ${SLOTS[P.slot] || P.slot}; held when it\'s in the hand.` : 'Held (it isn\'t worn).'));
    side.append(panel('The piece', what, { key: 'gr-piece' }));
    // Worn.
    if (P.slot) {
      const w = g.worn || null;
      const worn = h('div');
      worn.append(check('Its own look when worn', !!w, (v) => this.set((x) => (x.worn = v ? { base: (WORN_LOOKS[P.slot] || ['none'])[0], tint: null, art: null } : undefined), { side: true })));
      if (w) {
        const looks = [['none', 'nothing of the game\'s'], ...(WORN_LOOKS[P.slot] || []).map((k) => [k, k])];
        worn.append(
          field('Under it', select(looks, w.base || 'none', (v) => this.set((x) => (x.worn.base = v))), { tip: 'One of the game\'s looks for the place it\'s worn (its colours on the person), under your art.' }),
          field('Tint', h('div', { class: 'row', style: { gap: '6px' } }, colorButton(w.tint || '#a8aab8', (v) => this.set((x) => (x.worn.tint = v.slice(0, 7)))), button('None', { small: true, kind: 'ghost', onClick: () => this.set((x) => (x.worn.tint = null)) })), { tip: 'The colour the game\'s look is worn in.' }),
          field('Art over it', h('div', { class: 'row', style: { gap: '6px' } }, refPicker(app, 'asset', w.art || null, (v) => this.set((x) => (x.worn.art = v || null), { side: true })), button('Draw it', { icon: 'pencil', small: true, onClick: () => this.drawWorn() })), { tip: `Art ${OVER_W} by ${OVER_H} (a person's size), its frames the front, the side and the back. Layers named "Guide" aren't shown in the game.` }));
      }
      side.append(panel('Worn', worn, { key: 'gr-worn' }));
    }
    // Held.
    const hd = g.held || null;
    const held = h('div');
    held.append(check('Its own look in the hand', !!hd, (v) => this.set((x) => (x.held = v ? { art: null, x: 3, y: 13, scale: 0.8, angle: 0 } : undefined), { side: true })));
    if (hd) {
      const a = hd.art && app.mod.assets[hd.art];
      const aw = a ? a.w : 16;
      const ah = a ? a.h : 16;
      held.append(field('Art', h('div', { class: 'row', style: { gap: '6px' } }, refPicker(app, 'asset', hd.art || null, (v) => this.set((x) => (x.held.art = v || null), { side: true })), button('Draw it', { icon: 'pencil', small: true, onClick: () => this.drawHeldArt() })), { tip: 'Its picture in the hand (none: its icon).' }));
      // (The art, big: click where the hand grips it.)
      const src = a ? app.assetCanvas(a, 0) : P.icon;
      if (src) {
        const k = Math.max(4, Math.floor(160 / Math.max(aw, ah)));
        const gc = canvas(aw * k, ah * k);
        gc.classList.add('gr-grip');
        const gx = gc.getContext('2d');
        gx.imageSmoothingEnabled = false;
        gx.fillStyle = '#0b102e';
        gx.fillRect(0, 0, gc.width, gc.height);
        gx.drawImage(src, 0, 0, aw * k, ah * k);
        gx.strokeStyle = '#ffd84a';
        gx.lineWidth = 2;
        const px = (hd.x ?? 3) * k;
        const py = (hd.y ?? 13) * k;
        gx.beginPath();
        gx.arc(px, py, k * 0.9, 0, Math.PI * 2);
        gx.stroke();
        gx.fillStyle = '#ffd84a';
        gx.fillRect(px - 1, py - 1, 2, 2);
        gc.addEventListener('click', (e) => {
          const r = gc.getBoundingClientRect();
          const nx = Math.round(((e.clientX - r.left) / r.width) * aw * 2) / 2;
          const ny = Math.round(((e.clientY - r.top) / r.height) * ah * 2) / 2;
          this.set((x) => {
            x.held.x = clamp(nx, 0, aw);
            x.held.y = clamp(ny, 0, ah);
          }, { side: true });
        });
        held.append(h('div', { class: 'note' }, 'Click where the hand grips it:'), gc);
      }
      held.append(
        field('Gripped at', h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } },
          button('Its hilt', { small: true, title: 'Near the bottom left (a blade, a tool)', onClick: () => this.set((x) => Object.assign(x.held, { x: 3, y: ah - 3 }), { side: true }) }),
          button('Its foot', { small: true, title: 'The middle of its bottom (a torch, a staff)', onClick: () => this.set((x) => Object.assign(x.held, { x: aw / 2, y: ah - 4 }), { side: true }) }),
          button('Its middle', { small: true, onClick: () => this.set((x) => Object.assign(x.held, { x: aw / 2, y: ah / 2 }), { side: true }) }))),
        field('Size', slider({ value: Math.round((hd.scale ?? 0.8) * 100), min: 30, max: 200, int: true, onChange: (v) => this.set((x) => (x.held.scale = v / 100)) }), { tip: 'Against the game\'s (80: as big as anything held).' }),
        field('Slant', slider({ value: hd.angle || 0, min: -180, max: 180, int: true, onChange: (v) => this.set((x) => (x.held.angle = v)) }), { tip: 'Turned in the hand (degrees).' }));
    }
    side.append(panel('Held', held, { key: 'gr-held' }));
  }

  // ------------------------------------------------------------ drawing it
  // New art for its look worn: a person to draw over (a guide, not shown
  // in the game), front, side and back.
  async drawWorn() {
    const app = this.app;
    const g = this.g;
    const P = this.piece();
    if (!P.slot) {
      toast('Choose a piece that\'s worn first (armour or clothes).', 'bad');
      return;
    }
    const a = newAsset({ name: `${g.name} worn`, w: OVER_W, h: OVER_H, use: 'gear' });
    a.id = freeId(app.mod, 'assets', `${g.name} worn`);
    a.layers = [{ id: 'g', name: 'Guide (not in the game)', visible: true, opacity: 0.45, blend: 'normal' }, { id: 'l1', name: 'Gear', visible: true, opacity: 1, blend: 'normal' }];
    const look = this.look();
    let pal = null;
    a.frames = [0, 1, 2].map((d) => {
      const px = drawHumanoid(look, d, 0);
      const q = quantize(px.d, px.w, px.h, 64, pal);
      if (!pal) {
        pal = q.palette;
        a.palette = [...q.palette, ...a.palette.filter((p) => !q.palette.includes(p))].slice(0, LIMITS.palette);
      }
      return { dur: 250, cels: { g: encodeCel(q.idx), l1: encodeCel(new Uint8Array(OVER_W * OVER_H)) } };
    });
    a.tags = [{ name: 'front', from: 0, to: 0, color: '#80e070' }, { name: 'side', from: 1, to: 1, color: '#70c0ff' }, { name: 'back', from: 2, to: 2, color: '#ffb070' }];
    app.mod.assets[a.id] = a;
    app.touch('assets', a.id, { quiet: true });
    this.set((x) => {
      x.worn ||= { base: 'none', tint: null, art: null };
      x.worn.art = a.id;
    });
    app.drawExplorer();
    toast('Draw on the "Gear" layer over the person (frames: front, side, back), then come back here.', 'good', 5000);
    await app.open('assets', a.id);
  }

  // New art for it in the hand: its icon to start from.
  async drawHeldArt() {
    const app = this.app;
    const g = this.g;
    const P = this.piece();
    const a = newAsset({ name: `${g.name} held`, w: 16, h: 16, use: 'item' });
    a.id = freeId(app.mod, 'assets', `${g.name} held`);
    const src = P.icon || (g.item && g.item[0] !== '@' ? vanillaIcon('item', g.item) : null);
    if (src) {
      const c = canvas(16, 16);
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(src, 0, 0, 16, 16);
      const q = quantize(x.getImageData(0, 0, 16, 16).data, 16, 16, 64);
      a.palette = [...q.palette, ...a.palette.filter((p) => !q.palette.includes(p))].slice(0, LIMITS.palette);
      a.frames[0].cels.l1 = encodeCel(q.idx);
    }
    app.mod.assets[a.id] = a;
    app.touch('assets', a.id, { quiet: true });
    this.set((x) => {
      x.held ||= { art: null, x: 3, y: 13, scale: 0.8, angle: 0 };
      x.held.art = a.id;
    });
    app.drawExplorer();
    await app.open('assets', a.id);
  }
}

const rootOf = (e) => (e && e.graph && e.graph.nodes || []).find((n) => NODES[n.type] && NODES[n.type].root) || null;
