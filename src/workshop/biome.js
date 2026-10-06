// The Biome tool (round 63): new biomes, and changes to the game's own.
// Its land, made as the game makes it, seen as the game draws it (turn
// it, zoom in, day or night, with what comes out in it about), and a
// wider stretch of it from above, with its square on the world map; on the
// right, all it is: its ground and the patches in it, its hills, water and
// banks, its trees (the game's, or anything built in the Builder), its
// plants and rocks, what comes out in it by day and by night, its weather,
// the music, the people who'd build there, and where in a new world it
// grows (a climate dragged out on a chart of the game's own, or instead of
// one of the game's, or only where it's painted on a world map).
import { h, ic, clear, button, group, field, slider, check, seg, select, panel, toast, canvas, textInput, chips, popover, closePopover, menu, colorButton, dropTarget } from './kit.js';
import { titleBar, menuButton, vanillaIcon, creatureName, pickRef, glyphCanvas } from './common.js';
import { blockField, blockLabel, weightList, pickBlock } from './pickers.js';
import { biomeLand, biomeVox, biomeAbove, biomeWhole, treeCells } from './biomeview.js';
import { renderVox, frameOf, toView, cellY, T, voxPicture } from './voxview.js';
import { blockIcon } from './blockart.js';
import { BIOMES } from '../world/biomes.js';
import { TREE_BUILDERS } from '../world/trees.js';
import { LANDMASSES } from '../world/geography.js';
import { CULTURES } from '../world/names.js';
import { CHARSET } from '../render/font.js';
import { SPR_H } from '../render/textures.js';
import { GAME_BIOMES, biomeFields, STYLES } from '../mod/biomes.js';
import { mulberry32 } from '../util/rng.js';

const TREE_NAMES = {
  oak: 'Oak', birch: 'Birch', pine: 'Pine', snowpine: 'Snowy pine', palm: 'Palm', jungle: 'Jungle tree', acacia: 'Acacia', willow: 'Willow', dead: 'Dead tree', cactus: 'Cactus',
  bushtree: 'Bushy tree', cinder: 'Cinder tree', charred: 'Charred snag', mangrove: 'Mangrove', mushroom: 'Giant mushroom', glowshroom: 'Glowing mushroom', toadstool: 'Toadstool',
};
const GAME_TREES = Object.keys(TREE_NAMES).filter((k) => TREE_BUILDERS[k]);
// What comes out by day in each of the game's biomes (as the game has it),
// and at night: for the preview of one that keeps the game's.
const DAY = {
  plains: ['rabbit', 'deer', 'boar', 'horse', 'sheep', 'cow'], forest: ['deer', 'boar', 'rabbit', 'wolf', 'pig'], taiga: ['deer', 'wolf', 'rabbit', 'sheep'], tundra: ['rabbit', 'wolf'],
  savanna: ['deer', 'boar', 'rabbit', 'horse', 'cow'], jungle: ['boar', 'slime', 'deer', 'pig'], swamp: ['slime', 'boar'], desert: ['rabbit'], mountain: ['boar', 'rabbit', 'sheep'],
};
const NIGHT = ['slime', 'skeleton', 'ghoul', 'wisp'];
const ISLES = LANDMASSES.map((L) => [L.key, L.name.replace(/^the /, '')]);
const HILLS = ['flat', 'rolling', 'hilly', 'rugged'];
// The letters a biome's square on the map can be (the game's font's).
const GLYPHS = CHARSET.filter((c) => c !== ' ' && !/[─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬╤╧╪]/.test(c));

// What the game picks for a splotch on an island, by its warmth and
// wetness (as worldgen.pickBiome, but for the odd mountain).
export function gamePick(isle, temp, moist) {
  if (isle === 'kharos') return moist > 0.62 ? 'geyser' : moist > 0.36 ? 'cinderwood' : 'ashland';
  if (isle === 'myrrow') return moist > 0.66 ? 'fungal' : moist > 0.34 ? 'moor' : temp > 0.55 ? 'swamp' : 'forest';
  if (temp < 0.2) return moist < 0.45 ? 'tundra' : 'taiga';
  if (temp < 0.36) return moist > 0.48 ? 'taiga' : moist < 0.24 ? 'plains' : 'forest';
  if (temp < 0.64) return moist < 0.46 ? 'plains' : moist > 0.8 ? 'swamp' : 'forest';
  return moist < 0.42 ? 'desert' : moist < 0.64 ? 'savanna' : moist > 0.88 ? 'swamp' : 'jungle';
}

export default class BiomeTool {
  constructor(app) {
    this.app = app;
    this.id = null;
    this.seed = 7;
    this.rot = 0;
    this.zoom = 0;
    this.night = false;
    this.pan = { x: 0, y: 0 };
    this.treePics = new Map();
  }

  get b() {
    return this.id ? this.app.mod.biomes[this.id] : null;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.onResize = () => this.paint();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    if (this.id && this.b) this.open('biomes', this.id);
  }

  unmount() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
    window.clearTimeout(this.redrawT);
  }

  current() {
    return this.b ? { kind: 'biomes', id: this.id } : null;
  }

  hintText() {
    if (!this.b) return 'Pick a biome in the explorer, or make one.';
    return 'Drag the view to look about; the wheel zooms. R: another stretch of it. N: night. Q/E: turn. Drag structures in from the explorer to grow them as trees, creatures to have them come out here.';
  }

  keyHelp() {
    return [['R', 'Another stretch of it'], ['N', 'Day / night'], ['Q E', 'Turn the view'], ['+ - 0', 'Zoom']];
  }

  onKey(e) {
    if (!this.b || e.ctrlKey || e.metaKey) return false;
    if (e.code === 'KeyR') {
      this.reroll();
      return true;
    }
    if (e.code === 'KeyN') {
      this.night = !this.night;
      this.drawPreview();
      this.drawToolbarState();
      return true;
    }
    if (e.code === 'KeyQ' || e.code === 'KeyE') {
      this.rot = (this.rot + (e.code === 'KeyQ' ? 3 : 1)) & 3;
      this.drawPreview();
      return true;
    }
    const z = { '+': 1, '=': 1, '-': -1 }[e.key];
    if (z) {
      this.zoom = Math.max(1, Math.min(5, (this.zoom || this.fitZoom()) + z));
      this.paint();
      return true;
    }
    if (e.key === '0') {
      this.zoom = 0;
      this.pan = { x: 0, y: 0 };
      this.paint();
      return true;
    }
    return false;
  }

  open(kind, id) {
    if (!id || !this.app.mod.biomes[id]) {
      this.id = null;
      return this.empty();
    }
    if (this.id !== id) {
      this.pan = { x: 0, y: 0 };
      this.zoom = 0;
    }
    this.id = id;
    this.build();
  }

  reload() {
    if (this.b) this.open('biomes', this.id);
    else this.empty();
  }

  removed(kind, id) {
    if (kind === 'biomes' && id === this.id) {
      this.id = null;
      this.empty();
    } else if (this.b && (kind === 'structures' || kind === 'entities')) this.drawPreview();
  }

  renamed() {
    if (this.nameEl && this.b) this.nameEl.value = this.b.name;
  }

  // Something else in the mod changed (a structure grown as a tree, a
  // block's art): the preview again.
  otherChanged() {
    if (this.b) this.drawPreview();
  }

  // ------------------------------------------------------------ nothing open
  empty() {
    clear(this.stage);
    clear(this.insp);
    const wrap = h('div', { class: 'home scroll' });
    wrap.append(h('h1', null, 'Biomes'), h('div', { class: 'sub' }, 'New kinds of land for new worlds: their ground, hills and water, their trees (the game\'s, or anything you build in the Builder), plants and rocks, what comes out in them by day and night, their weather and music, and where they grow. Or change one of the game\'s own: every world made with the mod has it as you make it.'));
    wrap.append(h('h2', null, 'A new biome, starting from'));
    const cards = h('div', { class: 'cards' });
    for (const k of GAME_BIOMES) {
      const g = BIOMES[k];
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, h('span', { class: 'mapglyph' }, glyphCanvas(g.char, g.fg, g.bg, 3)), g.name), h('div', { class: 'd' }, `Its ground, trees and plants to start with; then make it your own.`));
      c.addEventListener('click', () => this.newBiome(k));
      cards.append(c);
    }
    wrap.append(cards, h('h2', null, 'Or change one of the game\'s'));
    const ch = h('div', { class: 'cards' });
    for (const k of GAME_BIOMES) {
      const g = BIOMES[k];
      const done = Object.values(this.app.mod.biomes).find((b) => b.change === k);
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, h('span', { class: 'mapglyph' }, glyphCanvas(g.char, g.fg, g.bg, 3)), g.name), h('div', { class: 'd' }, done ? `Changed already ("${done.name}"): open it.` : `Change the game's ${g.name.toLowerCase()} in every world made with this mod.`));
      c.addEventListener('click', () => (done ? this.app.open('biomes', done.id) : this.changeBiome(k)));
      ch.append(c);
    }
    wrap.append(ch);
    this.stage.append(wrap);
    this.insp.append(h('div', { class: 'insp-head' }, ic('tree'), 'Biomes'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open.')));
  }

  newBiome(base = 'plains', name = null) {
    const g = BIOMES[base];
    const nm = name || `${g.name} anew`;
    return this.app.create('biomes', { name: nm, base, ...biomeFields(base), creatures: { day: [], night: [], mode: 'add' }, place: { how: 'climate', isles: ['thessa'], temp: [40, 70], moist: [30, 60], replaces: base, share: 35 } });
  }

  changeBiome(k) {
    const done = Object.values(this.app.mod.biomes).find((b) => b.change === k);
    if (done) return this.app.open('biomes', done.id);
    return this.app.create('biomes', { name: `${BIOMES[k].name} (changed)`, change: k, base: k, ...biomeFields(k), creatures: { day: [], night: [], mode: 'add' } });
  }

  // ------------------------------------------------------------ changing it
  // `o.side`: draw the panels again (a change that alters what they show).
  set(fn, o = {}) {
    const b = this.b;
    if (!b) return;
    this.app.checkpoint('biomes', this.id);
    fn(b);
    this.app.touch('biomes', this.id);
    window.clearTimeout(this.redrawT);
    this.redrawT = setTimeout(() => this.drawPreview(), 60);
    if (o.side) this.drawSide();
    if (o.glyph !== false) this.drawGlyphs();
  }

  reroll() {
    this.seed = (this.seed * 1103515245 + 12345) >>> 0;
    this.drawPreview();
  }

  resetToGame() {
    const b = this.b;
    const k = b.change || b.base;
    this.set((x) => Object.assign(x, biomeFields(k)), { side: true });
    toast(`Set back to the game's ${BIOMES[k].name.toLowerCase()}'s own.`, 'good');
  }

  // ------------------------------------------------------------ the stage
  build() {
    const app = this.app;
    const b = this.b;
    clear(this.stage);
    clear(this.insp);
    const g = BIOMES[b.change || b.base] || BIOMES.plains;
    const tb = titleBar(app, 'biomes', this.id);
    this.nameEl = tb.querySelector('.title input');
    tb.append(h('span', { class: 'note' }, b.change ? `Changes the game's ${g.name}` : `Started from ${g.name}`));
    this.nightBtn = button(null, { icon: 'moon', small: true, title: 'Day or night (N): what comes out at night', onClick: () => {
      this.night = !this.night;
      this.drawPreview();
      this.drawToolbarState();
    } });
    tb.append(h('span', { class: 'sep' }),
      button('Another stretch', { icon: 'dice', small: true, title: 'A different stretch of it (R)', onClick: () => this.reroll() }),
      this.nightBtn,
      group(button(null, { icon: 'rotate', small: true, title: 'Turn the view (Q)', onClick: () => this.onKey({ code: 'KeyQ' }) }), button(null, { icon: 'flipH', small: true, title: 'Turn it the other way (E)', onClick: () => this.onKey({ code: 'KeyE' }) })),
      group(button(null, { icon: 'minus', small: true, title: 'Zoom out (-)', onClick: () => this.onKey({ key: '-' }) }), button(null, { icon: 'zoom', small: true, title: 'Fit (0)', onClick: () => this.onKey({ key: '0' }) }), button(null, { icon: 'plus', small: true, title: 'Zoom in (+)', onClick: () => this.onKey({ key: '+' }) })),
      h('span', { class: 'spacer' }));
    if (b.change) tb.append(button('As the game has it', { icon: 'undo', small: true, title: 'Set everything back to the game\'s own (Undo brings yours back)', onClick: () => this.resetToGame() }));
    tb.append(menuButton('Use it', () => this.useMenu(), { small: true, icon: 'star', kind: 'primary' }));
    this.stage.append(tb);
    // The land, as the game draws it.
    this.wrap = h('div', { class: 'canvas-wrap' });
    this.cv = h('canvas');
    this.hud = h('div', { class: 'hud' });
    this.hudR = h('div', { class: 'hud r' });
    this.wrap.append(this.cv, this.hud, this.hudR);
    this.stage.append(this.wrap);
    this.panView();
    dropTarget(this.wrap, (p) => p.kind === 'structures' || (p.kind === 'entities' && ['tpl.animal', 'tpl.hostile', 'tpl.npc', 'tpl.block'].includes(p.tpl)), (p) => this.dropped(p));
    // A wider stretch of it from above, and its square on the map.
    this.strip = h('div', { class: 'hotbar', style: { gap: '12px', alignItems: 'flex-start', padding: '8px 10px' } });
    this.stage.append(this.strip);
    this.drawToolbarState();
    this.drawPreview();
    this.drawSide();
  }

  drawToolbarState() {
    if (this.nightBtn) this.nightBtn.classList.toggle('on', this.night);
  }

  // Dragging the view about; the wheel zooms.
  panView() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      e.preventDefault();
      const x0 = e.clientX;
      const y0 = e.clientY;
      const p0 = { ...this.pan };
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = 'grabbing';
      const move = (ev) => {
        this.pan = { x: p0.x + ev.clientX - x0, y: p0.y + ev.clientY - y0 };
        this.paint();
      };
      const up = () => {
        cv.removeEventListener('pointermove', move);
        cv.removeEventListener('pointerup', up);
        cv.style.cursor = 'grab';
      };
      cv.addEventListener('pointermove', move);
      cv.addEventListener('pointerup', up);
    });
    cv.style.cursor = 'grab';
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(1, Math.min(5, (this.zoom || this.fitZoom()) + (e.deltaY < 0 ? 1 : -1)));
      this.paint();
    }, { passive: false });
  }

  dropped(p) {
    if (p.kind === 'structures') {
      this.set((b) => (b.trees ||= []).push({ structure: p.id, w: 2 }), { side: true });
      toast(`"${p.name}" grows here as a tree now (its middle the trunk; within 4 blocks of it).`, 'good');
    } else if (p.tpl === 'tpl.block') {
      this.set((b) => (b.plants ||= []).push({ block: `@${p.id}`, w: 3 }), { side: true });
      toast(`"${p.name}" grows here now, among its plants.`, 'good');
    } else {
      const night = p.tpl === 'tpl.hostile' || this.night;
      this.set((b) => {
        b.creatures ||= { day: [], night: [], mode: 'add' };
        b.creatures[night ? 'night' : 'day'].push({ species: `@${p.id}`, w: 3 });
      }, { side: true });
      toast(`"${p.name}" comes out here ${night ? 'at night' : 'by day'} now.`, 'good');
    }
  }

  // Who's about in the preview: its own list, or (keeping the game's) the
  // game's own for the biome it's like.
  beasts() {
    const b = this.b;
    const C = b.creatures || { day: [], night: [], mode: 'add' };
    const own = (this.night ? C.night : C.day) || [];
    if (C.mode === 'only' || own.length) return own;
    const like = b.change || b.base || 'plains';
    return (this.night ? NIGHT : DAY[like] || ['rabbit', 'deer']).map((species) => ({ species, w: 1 }));
  }

  fitZoom() {
    if (!this.F || !this.wrap) return 2;
    const r = this.wrap.getBoundingClientRect();
    return Math.max(1, Math.min(4, Math.floor(Math.min((r.width - 20) / this.F.pw, (r.height - 20) / this.F.ph))));
  }

  // The land made again (a change, another stretch, day or night).
  drawPreview() {
    const b = this.b;
    if (!b || !this.cv) return;
    const app = this.app;
    const land = biomeLand(app.mod, b, this.seed, 34, 26, { beasts: this.beasts(), many: 5 });
    const vox = biomeVox(app, app.mod, land);
    const F = frameOf(vox, this.rot);
    const pic = canvas(F.pw, F.ph);
    const x = pic.getContext('2d');
    renderVox(x, app, vox, { rot: this.rot });
    // Those about, on their feet.
    for (const q of land.beasts) {
      const c = land.cols[q.z * land.W + q.x];
      const img = this.beastPic(q.species);
      if (!img) continue;
      const [u, v] = toView(q.x, q.z, vox.w, vox.d, this.rot);
      const y = cellY(F, vox, v, vox.ground + c.h + 1) + SPR_H;
      x.drawImage(img, u * T + Math.floor((T - img.width) / 2), y - img.height);
    }
    if (this.night) {
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = 'rgba(8,14,48,0.55)';
      x.fillRect(0, 0, F.pw, F.ph);
      x.globalCompositeOperation = 'source-over';
    }
    this.pic = pic;
    this.F = F;
    this.land = land;
    this.paint();
    // The wider stretch, from above.
    const wide = biomeLand(app.mod, b, this.seed, 150, 52, { beasts: [] });
    this.above = biomeAbove(app, app.mod, wide, 3);
    this.drawStrip();
    const f = land.f;
    this.hud.textContent = `${this.night ? 'Night' : 'Day'} · ${HILLS[Math.max(0, Math.min(3, f.hills | 0))]} · ${f.climate}`;
    this.hudR.textContent = `${land.trees.length} trees · ${land.plants.length} plants · ${land.beasts.length} about`;
  }

  // The picture, where it's been dragged to, as big as it's zoomed.
  paint() {
    const cv = this.cv;
    if (!cv || !this.pic) return;
    const r = this.wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.imageSmoothingEnabled = false;
    // (Sky over the land, darker at night.)
    const sky = x.createLinearGradient(0, 0, 0, r.height);
    sky.addColorStop(0, this.night ? '#05081c' : '#2a4a7a');
    sky.addColorStop(1, this.night ? '#0e1430' : '#7aa8d0');
    x.fillStyle = sky;
    x.fillRect(0, 0, r.width, r.height);
    const z = this.zoom || this.fitZoom();
    const w = this.pic.width * z;
    const hh = this.pic.height * z;
    x.drawImage(this.pic, Math.round((r.width - w) / 2 + this.pan.x), Math.round((r.height - hh) / 2 + this.pan.y), w, hh);
  }

  beastPic(k) {
    if (!k) return null;
    if (k[0] === '@') {
      const e = this.app.mod.entities[k.slice(1)];
      return e ? this.app.thumb('entities', k.slice(1)) : null;
    }
    return vanillaIcon('creature', k);
  }

  drawStrip() {
    const s = this.strip;
    if (!s) return;
    clear(s);
    const b = this.b;
    const w = biomeWhole(b);
    const above = h('div', null, h('div', { class: 'note', style: { marginBottom: '3px' } }, 'From above (a wider stretch)'), h('div', { class: 'well', style: { display: 'inline-block', lineHeight: 0 } }, this.above));
    // Its square on the world map, among the game's.
    const mp = canvas(9 * 12, 5 * 16);
    const x = mp.getContext('2d');
    const around = ['plains', 'forest', 'plains', 'ocean'];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) {
      const mine = Math.hypot((i - 4) / 3.2, (j - 2) / 1.8) < 1 + ((i * 7 + j * 3) % 5) * 0.05;
      const k = around[(i + j * 3) % around.length];
      const g = mine ? w : BIOMES[k];
      x.drawImage(glyphCanvas(mine ? w.char : g.char, mine ? w.fg : g.fg, mine ? w.bg : g.bg, 2), i * 12, j * 16);
    }
    const map = h('div', null, h('div', { class: 'note', style: { marginBottom: '3px' } }, 'On the world map'), h('div', { class: 'well', style: { display: 'inline-block', lineHeight: 0 } }, mp));
    s.append(above, map);
  }

  drawGlyphs() {
    if (this.glyphEl) {
      clear(this.glyphEl);
      const w = biomeWhole(this.b);
      this.glyphEl.append(glyphCanvas(w.char, w.fg, w.bg, 3));
    }
    this.app.refreshThumb?.('biomes', this.id);
  }

  // ------------------------------------------------------------ what can be done with it
  useMenu() {
    const app = this.app;
    const b = this.b;
    const ref = b.change || `@${this.id}`;
    const items = [
      { label: 'Paint it on a world map', icon: 'globe', onClick: () => app.useTool('world').then(() => app.tools.world?.paintBiome?.(ref)) },
      { label: 'A beast that wanders it', icon: 'paw', onClick: () => app.newEntity('tpl.animal', { biomes: [ref], spawnTime: 'day' }, `${b.title || b.name} beast`) },
      { label: 'A monster of its nights', icon: 'skull', onClick: () => app.newEntity('tpl.hostile', { biomes: [ref], spawnTime: 'night' }, `${b.title || b.name} horror`) },
      { label: 'A structure found in it', icon: 'house', onClick: () => app.builder(async () => {
        const id = await app.create('structures', { name: `${b.title || b.name} ruin`, place: { where: 'wild', biomes: [ref], count: 2, isle: 'any', clear: true } });
        return id;
      }) },
      { sep: true },
      { label: 'Try it out (Playtest)', icon: 'play', onClick: () => app.playtest() },
    ];
    return items;
  }

  // ------------------------------------------------------------ the panels
  drawSide() {
    const app = this.app;
    const b = this.b;
    if (!b) return;
    const keep = this.sideBody ? this.sideBody.scrollTop : 0;
    clear(this.insp);
    const w = biomeWhole(b);
    this.insp.append(h('div', { class: 'insp-head' }, ic('tree'), b.change ? `${BIOMES[b.change].name}, changed` : 'Biome'));
    const body = h('div', { class: 'insp-body scroll' });
    this.sideBody = body;
    const set = (fn, side = false) => this.set(fn, { side });
    // ---- the biome itself
    const id = h('div');
    this.glyphEl = h('span', { class: 'mapglyph', style: { width: '36px', height: '42px', cursor: 'pointer' }, 'data-tip': 'Its letter on the world map (click to choose another)' });
    this.drawGlyphs();
    this.glyphEl.addEventListener('click', () => this.glyphPicker(this.glyphEl));
    id.append(
      field('Name in game', textInput({ value: b.title || (b.change ? BIOMES[b.change].name : b.name), max: 32, onChange: (v) => set((x) => (x.title = v.trim() || undefined)) }), { tip: 'What the game calls it (on the map, where you are).' }),
      field('On the map', h('div', { class: 'row' }, this.glyphEl, colorButton(w.fg, (v) => set((x) => (x.fg = v.slice(0, 7))), { tip: 'Its letter\'s colour' }), colorButton(w.bg, (v) => set((x) => (x.bg = v.slice(0, 7))), { tip: 'Its square\'s colour' }))));
    if (!b.change) {
      id.append(field('Started from', h('div', { class: 'row' }, h('div', { class: 'grow' }, select(GAME_BIOMES.map((k) => [k, BIOMES[k].name]), b.base || 'plains', (v) => set((x) => (x.base = v), true))), button(null, { icon: 'import', small: true, title: 'Take all its settings (your own are replaced; Undo brings them back)', onClick: () => {
        this.set((x) => Object.assign(x, biomeFields(x.base || 'plains')), { side: true });
      } })), { tip: 'What it\'s taken for where the game asks by name (its beasts, if it keeps the game\'s), and what it\'s like where you haven\'t said.' }));
    }
    id.append(
      field('Music', select(GAME_BIOMES.map((k) => [k, `${BIOMES[k].name}'s`]), w.music || b.base || 'plains', (v) => set((x) => (x.music = v))), { tip: 'The game\'s music for one of its biomes.' }),
      field('Who\'d build', select(STYLES.map((k) => [k, CULTURES[k] ? CULTURES[k].label : k]), w.style || 'vale', (v) => set((x) => (x.style = v))), { tip: 'The people whose towns are built here (their houses, their names).' }),
      field('Towns here', slider({ value: w.settle ?? 0, min: -100, max: 100, step: 5, onChange: (v) => set((x) => (x.settle = v)) }), { tip: 'How much towns like it: 100 best of all, 0 as likely as not, -100 never.' }));
    body.append(panel('The biome', id, { key: 'bi-id' }));
    // ---- the ground
    const gr = h('div');
    gr.append(
      field('Ground', blockField(app, w.surface, (v) => set((x) => (x.surface = v || 'grass')), { tab: 'Ground' }), { tip: 'Its top: what you walk on.' }),
      field('Under it', blockField(app, w.sub, (v) => set((x) => (x.sub = v || 'dirt')), { tab: 'Ground' }), { tip: 'The few blocks below the top (stone below that).' }),
      field('Hills', slider({ value: w.hills ?? 1, min: 0, max: 3, int: true, tip: HILLS.join(', '), onChange: (v) => set((x) => (x.hills = v)) }), { tip: '0 flat, 1 rolling, 2 hilly, 3 rugged (ridges, as the mountains have).' }),
      field('Climate', seg([['mild', 'Mild'], ['warm', 'Warm', 'Sandy banks'], ['cold', 'Cold', 'Snow on the heights sooner'], ['hot', 'Hot', 'Never snow; dark beds under its water']], w.climate || 'mild', (v) => set((x) => (x.climate = v)))),
      field('Water', seg([['none', 'None'], ['ponds', 'Ponds', 'Now and then, in the low places'], ['pools', 'Pools', 'Many, shallow (as marshes have)']], w.water || 'none', (v) => set((x) => (x.water = v)))),
      ...((w.water || 'none') !== 'none' ? [field('Filled with', seg([['water', 'Water'], ['lava', 'Lava', 'Glowing, in beds of basalt'], ['ice', 'Ice', 'Frozen over, water under it'], ['mud', 'Mud', 'A bog']], w.liquid || 'water', (v) => set((x) => (x.liquid = v))), { tip: 'What its ponds and pools hold (rivers and lakes stay water).' })] : []),
      field('Banks', blockField(app, w.bank, (v) => set((x) => (x.bank = v)), { none: 'its own ground', tab: 'Ground' }), { tip: 'Along its water.' }),
      h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px 14px' } },
        check('Reeds by the water', w.reeds !== false, (v) => set((x) => (x.reeds = v))),
        check('Lily pads', !!w.lilies, (v) => set((x) => (x.lilies = v))),
        check('Muddy beds', w.bed === 'mud', (v) => set((x) => (x.bed = v ? 'mud' : null)))),
      h('div', { class: 'note', style: { marginTop: '4px' } }, h('b', null, 'Patches'), ' in its ground: each its size, and how much of the ground it takes (the first wins where two would be).'),
      // (Worked on as a copy: each change set for Undo as a whole.)
      weightList((b.patches || w.patches || []).map((p) => ({ ...p, w: p.amount ?? 30 })), {
        icon: (p) => blockIcon(app, p.block, 20), label: (p) => blockLabel(app, p.block), max: 100, order: true, bars: false, empty: 'No patches: all of it its ground.', addLabel: 'Patch',
        edit: (p, el, done) => pickBlock(app, el, p.block, (r) => {
          if (r) p.block = r;
          done();
        }, { tab: 'Ground' }),
        extra: (p, done) => field('Size', slider({ value: p.size ?? 8, min: 2, max: 30, int: true, onChange: (v) => {
          p.size = v;
          done();
        } })),
        add: (anchor, put) => pickBlock(app, anchor, null, (r) => r && put({ block: r, size: 8, amount: 30, w: 30 }), { tab: 'Ground' }),
        onChange: (list) => set((x) => (x.patches = list.map((p) => ({ block: p.block, size: p.size ?? 8, amount: Math.round(p.w ?? 30) })))),
        drop: { accept: (p) => p.kind === 'entities' && p.tpl === 'tpl.block', make: (p) => ({ block: `@${p.id}`, size: 8, amount: 30, w: 30 }) },
      }));
    body.append(panel('Ground', gr, { key: 'bi-ground' }));
    // ---- trees
    const tr = h('div');
    tr.append(weightList((b.trees || w.trees || []).map((t) => ({ ...t })), {
      icon: (t) => this.treePic(t), label: (t) => (t.structure ? `${app.mod.structures[t.structure] ? app.mod.structures[t.structure].name : '(deleted)'} (built)` : TREE_NAMES[t.tree] || t.tree),
      empty: 'No trees.', addLabel: 'Tree', note: 'or drag a structure in',
      add: (anchor, put) => menu([
        { head: 'The game\'s' }, ...GAME_TREES.map((k) => ({ label: TREE_NAMES[k], onClick: () => put({ tree: k, w: 3 }) })),
        { sep: true }, { head: 'Built in the Builder' },
        ...Object.values(app.mod.structures).map((st) => ({ label: st.name, icon: 'house', onClick: () => put({ structure: st.id, w: 2 }) })),
        Object.keys(app.mod.structures).length ? null : { label: 'Build one first (Builder)', off: true },
      ], anchor.getBoundingClientRect().left, anchor.getBoundingClientRect().bottom + 4),
      onChange: (list) => set((x) => (x.trees = list.map((t) => ({ ...t })))),
      drop: { accept: (p) => p.kind === 'structures', make: (p) => ({ structure: p.id, w: 2 }) },
    }));
    tr.append(
      field('How many', slider({ value: w.treeChance ?? 10, min: 0, max: 100, int: true, onChange: (v) => set((x) => (x.treeChance = v)) }), { tip: 'The chance a spot on its grid has a tree (percent).' }),
      field('Spacing', slider({ value: w.treeSpacing ?? 7, min: 3, max: 16, int: true, onChange: (v) => set((x) => (x.treeSpacing = v)) }), { tip: 'How far apart trees can be, at the closest (blocks).' }),
      field('Clumping', slider({ value: w.clump ?? 30, min: 0, max: 100, int: true, onChange: (v) => set((x) => (x.clump = v)) }), { tip: 'Thick in groves, thin between (0: even all over).' }),
      check('Grow in the shallows (as mangroves do)', !!w.wetTrees, (v) => set((x) => (x.wetTrees = v))),
      h('div', { class: 'note' }, 'A structure grown as a tree: its middle is the trunk, its ground layer under the ground; only what\'s within 4 blocks of the trunk grows. It\'s turned a different way each time.'));
    body.append(panel('Trees', tr, { key: 'bi-trees' }));
    // ---- plants and rocks
    const pl = h('div');
    pl.append(weightList((b.plants || w.plants || []).map((p) => ({ ...p })), {
      icon: (p) => blockIcon(app, p.block, 20), label: (p) => blockLabel(app, p.block), empty: 'No plants.', addLabel: 'Plant',
      edit: (p, el, done) => pickBlock(app, el, p.block, (r) => {
        if (r) p.block = r;
        done();
      }, { tab: 'Plants' }),
      add: (anchor, put) => pickBlock(app, anchor, null, (r) => r && put({ block: r, w: 3 }), { tab: 'Plants' }),
      onChange: (list) => set((x) => (x.plants = list.map((p) => ({ ...p })))),
      drop: { accept: (p) => p.kind === 'entities' && p.tpl === 'tpl.block', make: (p) => ({ block: `@${p.id}`, w: 3 }) },
    }));
    pl.append(
      field('How thick', slider({ value: w.plantDensity ?? 20, min: 0, max: 80, int: true, onChange: (v) => set((x) => (x.plantDensity = v)) }), { tip: 'Of every hundred spots, how many have a plant.' }),
      field('Rocks', slider({ value: w.rocks ?? 3, min: 0, max: 40, step: 0.5, onChange: (v) => set((x) => (x.rocks = v)) }), { tip: 'Rocks lying about: so many in every thousand spots.' }));
    body.append(panel('Plants & rocks', pl, { key: 'bi-plants' }));
    // ---- creatures
    const cr = h('div');
    const C = b.creatures || { day: [], night: [], mode: 'add' };
    const creatureList = (when) => weightList((C[when] || []).map((q) => ({ ...q })), {
      icon: (q) => this.beastPic(q.species), label: (q) => (q.species && q.species[0] === '@' ? (app.mod.entities[q.species.slice(1)] || { name: '(deleted)' }).name : creatureName(q.species)),
      empty: C.mode === 'only' ? 'Nothing comes out.' : 'The game\'s own only.', addLabel: when === 'day' ? 'By day' : 'At night',
      add: (anchor, put) => pickRef(app, 'creature', anchor, (v) => v && put({ species: v, w: 3 })),
      onChange: (list) => set((x) => {
        x.creatures ||= { day: [], night: [], mode: 'add' };
        x.creatures[when] = list.map((q) => ({ ...q }));
      }),
      drop: { accept: (p) => p.kind === 'entities' && ['tpl.animal', 'tpl.hostile', 'tpl.npc'].includes(p.tpl), make: (p) => ({ species: `@${p.id}`, w: 3 }) },
    });
    cr.append(field('With', seg([['add', 'The game\'s', 'These among the game\'s own (as common as their weights, against the game\'s ten)'], ['only', 'Only these', 'Only these come out here']], C.mode || 'add', (v) => set((x) => {
      x.creatures ||= { day: [], night: [], mode: 'add' };
      x.creatures.mode = v;
    }, true))),
      h('div', { class: 'note' }, h('b', null, 'By day')), creatureList('day'),
      h('div', { class: 'note', style: { marginTop: '6px' } }, h('b', null, 'At night')), creatureList('night'));
    body.append(panel('What comes out', cr, { key: 'bi-creatures' }));
    // ---- weather
    const we = h('div');
    we.append(field('Rain', slider({ value: w.rain ?? 100, min: 0, max: 200, step: 5, onChange: (v) => set((x) => (x.rain = v)) }), { tip: 'How often it rains, against most places (100). Under 70: no fog either.' }),
      check('It snows instead of rains', !!w.snowy, (v) => set((x) => (x.snowy = v))));
    body.append(panel('Weather', we, { key: 'bi-weather' }));
    // ---- where it grows
    if (!b.change) body.append(panel('Where it grows', this.placeBody(), { key: 'bi-place' }));
    else body.append(panel('Where it grows', h('div', { class: 'note' }, `Wherever the game's ${BIOMES[b.change].name.toLowerCase()} grows: this is it, changed.`), { key: 'bi-place' }));
    this.insp.append(body);
    body.scrollTop = keep;
  }

  // Where a new one grows: a climate on the chart, instead of one of the
  // game's, or only where it's painted.
  placeBody() {
    const b = this.b;
    b.place ||= { how: 'climate', isles: ['thessa'], temp: [40, 70], moist: [30, 60], replaces: b.base || 'plains', share: 35 };
    const P = b.place;
    const set = (fn, side = false) => this.set((x) => fn(x.place), { side });
    const el = h('div');
    el.append(seg([['climate', 'A climate', 'Where it\'s as warm and as wet as you say (drag it out on the chart)'], ['replace', 'Instead of', 'In place of some of one of the game\'s biomes'], ['painted', 'Painted', 'Only where it\'s painted on a world map (World tool)']], P.how || 'climate', (v) => set((p) => (p.how = v), true)));
    if (P.how === 'painted') {
      el.append(h('div', { class: 'note', style: { marginTop: '6px' } }, 'It grows only where you paint it on a world map.'), button('Paint it in the World tool', { icon: 'globe', small: true, onClick: () => this.app.useTool('world').then(() => this.app.tools.world?.paintBiome?.(`@${this.id}`)) }));
      return el;
    }
    el.append(field('On', chips(ISLES, P.isles || [], (v) => set((p) => (p.isles = v), true)), { wide: true, tip: 'Which lands (none chosen: any).' }));
    if (P.how === 'replace') {
      el.append(field('Instead of', select(GAME_BIOMES.map((k) => [k, BIOMES[k].name]), P.replaces || 'plains', (v) => set((p) => (p.replaces = v), true))));
    }
    el.append(field('How much', slider({ value: P.share ?? 35, min: 1, max: 100, int: true, onChange: (v) => set((p) => (p.share = v)) }), { tip: P.how === 'replace' ? 'Of that biome\'s splotches, how many (percent) are this instead.' : 'Of the land in its climate, how much it takes (percent).' }));
    el.append(this.climateChart());
    return el;
  }

  // The game's biomes by warmth (down) and wetness (across), on the first
  // land it's on; this one's climate a box on it to drag about and size.
  climateChart() {
    const b = this.b;
    const P = b.place;
    const W = 264;
    const H = 168;
    const cv = canvas(W, H);
    cv.style.cursor = 'crosshair';
    cv.style.width = `${W}px`;
    const isle = (P.isles || [])[0] || 'thessa';
    const rectOf = (p) => ({ x0: (p.moist?.[0] ?? 0) / 100, x1: (p.moist?.[1] ?? 100) / 100, y0: (p.temp?.[0] ?? 0) / 100, y1: (p.temp?.[1] ?? 100) / 100 });
    const draw = () => {
      const x = cv.getContext('2d');
      for (let j = 0; j < H; j += 4) for (let i = 0; i < W; i += 4) {
        const k = gamePick(isle, j / H, i / W);
        const g = BIOMES[k];
        const mine = P.how === 'replace' && k === P.replaces;
        x.fillStyle = g.bg;
        x.fillRect(i, j, 4, 4);
        if (mine && ((i + j) / 4) % 2 === 0) {
          x.fillStyle = 'rgba(255,216,74,0.45)';
          x.fillRect(i, j, 4, 4);
        }
      }
      // (Each region's name, at its middle.)
      const sums = new Map();
      for (let j = 2; j < H; j += 8) for (let i = 2; i < W; i += 8) {
        const k = gamePick(isle, j / H, i / W);
        const s = sums.get(k) || [0, 0, 0];
        sums.set(k, [s[0] + i, s[1] + j, s[2] + 1]);
      }
      x.font = '10px monospace';
      x.textAlign = 'center';
      for (const [k, [sx, sy, n]] of sums) {
        if (n < 6) continue;
        x.fillStyle = 'rgba(0,0,0,0.55)';
        x.fillText(BIOMES[k].name, sx / n + 1, sy / n + 4);
        x.fillStyle = '#fff';
        x.fillText(BIOMES[k].name, sx / n, sy / n + 3);
      }
      // Other mods' biomes' climates (this mod's), faint; then this one.
      for (const o of Object.values(this.app.mod.biomes)) {
        if (o.id === b.id || !o.place || o.place.how !== 'climate') continue;
        const r = rectOf(o.place);
        x.strokeStyle = 'rgba(255,255,255,0.45)';
        x.setLineDash([2, 2]);
        x.strokeRect(r.x0 * W + 0.5, r.y0 * H + 0.5, (r.x1 - r.x0) * W, (r.y1 - r.y0) * H);
        x.setLineDash([]);
      }
      if (P.how === 'climate') {
        const r = rectOf(P);
        const w = biomeWhole(b);
        x.fillStyle = w.bg;
        x.globalAlpha = 0.8;
        x.fillRect(r.x0 * W, r.y0 * H, (r.x1 - r.x0) * W, (r.y1 - r.y0) * H);
        x.globalAlpha = 1;
        x.strokeStyle = '#ffd84a';
        x.lineWidth = 2;
        x.strokeRect(r.x0 * W + 1, r.y0 * H + 1, (r.x1 - r.x0) * W - 2, (r.y1 - r.y0) * H - 2);
        x.lineWidth = 1;
        x.fillStyle = '#fff';
        x.fillText(b.title || b.name, ((r.x0 + r.x1) / 2) * W, ((r.y0 + r.y1) / 2) * H + 4);
      }
    };
    draw();
    if (P.how === 'climate') {
      cv.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const rc = cv.getBoundingClientRect();
        const at = (ev) => [Math.max(0, Math.min(1, (ev.clientX - rc.left) / rc.width)), Math.max(0, Math.min(1, (ev.clientY - rc.top) / rc.height))];
        const [px, py] = at(e);
        const r0 = rectOf(P);
        const ex = 6 / rc.width;
        const ey = 6 / rc.height;
        const inside = px > r0.x0 - ex && px < r0.x1 + ex && py > r0.y0 - ey && py < r0.y1 + ey;
        const edges = inside ? { l: Math.abs(px - r0.x0) < ex, r: Math.abs(px - r0.x1) < ex, t: Math.abs(py - r0.y0) < ey, b: Math.abs(py - r0.y1) < ey } : null;
        const moving = inside && !edges.l && !edges.r && !edges.t && !edges.b;
        cv.setPointerCapture(e.pointerId);
        const r = { ...r0 };
        const move = (ev) => {
          const [qx, qy] = at(ev);
          if (!inside) {
            r.x0 = Math.min(px, qx);
            r.x1 = Math.max(px, qx);
            r.y0 = Math.min(py, qy);
            r.y1 = Math.max(py, qy);
          } else if (moving) {
            const dx = Math.max(-r0.x0, Math.min(1 - r0.x1, qx - px));
            const dy = Math.max(-r0.y0, Math.min(1 - r0.y1, qy - py));
            r.x0 = r0.x0 + dx;
            r.x1 = r0.x1 + dx;
            r.y0 = r0.y0 + dy;
            r.y1 = r0.y1 + dy;
          } else {
            if (edges.l) r.x0 = Math.min(qx, r.x1 - 0.04);
            if (edges.r) r.x1 = Math.max(qx, r.x0 + 0.04);
            if (edges.t) r.y0 = Math.min(qy, r.y1 - 0.04);
            if (edges.b) r.y1 = Math.max(qy, r.y0 + 0.04);
          }
          P.moist = [Math.round(r.x0 * 100), Math.round(r.x1 * 100)];
          P.temp = [Math.round(r.y0 * 100), Math.round(r.y1 * 100)];
          draw();
        };
        const up = () => {
          cv.removeEventListener('pointermove', move);
          cv.removeEventListener('pointerup', up);
          if (P.moist[1] - P.moist[0] < 4) P.moist[1] = Math.min(100, P.moist[0] + 4);
          if (P.temp[1] - P.temp[0] < 4) P.temp[1] = Math.min(100, P.temp[0] + 4);
          const now = { temp: P.temp.slice(), moist: P.moist.slice() };
          // (Put back, then set for Undo.)
          P.temp = [Math.round(r0.y0 * 100), Math.round(r0.y1 * 100)];
          P.moist = [Math.round(r0.x0 * 100), Math.round(r0.x1 * 100)];
          this.set((x) => Object.assign(x.place, now));
          draw();
        };
        cv.addEventListener('pointermove', move);
        cv.addEventListener('pointerup', up);
      });
    }
    const R = P.how === 'climate' ? rectOf(P) : null;
    return h('div', { style: { marginTop: '8px' } },
      h('div', { class: 'well', style: { display: 'inline-block', lineHeight: 0 } }, cv),
      h('div', { class: 'row note', style: { justifyContent: 'space-between', width: `${W}px` } }, h('span', null, 'dry'), h('span', null, `wetness across, warmth down (${(LANDMASSES.find((L) => L.key === isle) || { name: isle }).name})`), h('span', null, 'wet')),
      R ? h('div', { class: 'note' }, `Warmth ${P.temp[0]}-${P.temp[1]}, wetness ${P.moist[0]}-${P.moist[1]}: drag the box about, or its edges; drag elsewhere to draw a new one.`) : h('div', { class: 'note' }, 'The striped part is what it takes some of.'));
  }

  // A picture of a tree, as it'd grow.
  treePic(t) {
    const k = t.structure ? `s:${t.structure}:${JSON.stringify(this.app.mod.structures[t.structure] ? this.app.mod.structures[t.structure].cells : '').length}` : t.tree;
    if (this.treePics.has(k)) return this.treePics.get(k);
    const cells = treeCells(this.app, this.app.mod, t, mulberry32(11));
    if (!cells.length) return ic('warn');
    let x0 = 0;
    let x1 = 0;
    let z0 = 0;
    let z1 = 0;
    let y1 = 0;
    for (const [dx, dy, dz] of cells) {
      x0 = Math.min(x0, dx);
      x1 = Math.max(x1, dx);
      z0 = Math.min(z0, dz);
      z1 = Math.max(z1, dz);
      y1 = Math.max(y1, dy);
    }
    const m = new Map(cells.map(([dx, dy, dz, r]) => [`${dx - x0},${dy},${dz - z0}`, r]));
    const vox = { w: x1 - x0 + 1, d: z1 - z0 + 1, h: y1 + 1, ground: 0, get: (x, y, z) => (m.has(`${x},${y},${z}`) ? [m.get(`${x},${y},${z}`), 0] : null) };
    const pic = voxPicture(this.app, vox, 20) || ic('tree');
    this.treePics.set(k, pic);
    const c = canvas(pic.width || 20, pic.height || 20);
    if (pic.getContext) c.getContext('2d').drawImage(pic, 0, 0);
    return pic.getContext ? c : pic;
  }

  // Its letter on the map: the game's font's, to choose from.
  glyphPicker(anchor) {
    const b = this.b;
    const w = biomeWhole(b);
    const grid = h('div', { class: 'glyphs scroll', style: { maxHeight: '260px', overflow: 'auto' } });
    for (const ch of GLYPHS) {
      const c = glyphCanvas(ch, w.fg, w.bg, 2);
      const s = h('span', { class: ch === w.char ? 'on' : '', 'data-tip': ch }, c);
      s.addEventListener('click', () => {
        closePopover();
        this.set((x) => (x.char = ch));
      });
      grid.append(s);
    }
    popover(anchor, h('div', null, h('div', { class: 'note', style: { marginBottom: '6px' } }, 'Its letter on the world map'), grid));
  }
}
