// The World tool (round 63): the world's map, made as a new world would be
// made with the mod (every change shown a moment later, towns and realms
// and rivers and all). Move, size and reshape the landmasses (the game's,
// and new ones), paint land and sea, paint biomes (the game's or the
// mod's) where they're wanted, paint where towns may and mayn't be
// founded, say which biomes each land takes and how its climate runs, set
// structures, layouts and dungeons where they're wanted, found realms
// where they're wanted, set people about the world or in a realm, and say
// where new characters begin.
import { h, ic, clear, button, group, field, slider, check, seg, select, panel, toast, canvas, textInput, chips, menu, dropTarget, confirm } from './kit.js';
import { titleBar, pickRef, glyphCanvas, biomeOptions } from './common.js';
import { biomeLook } from './biomeview.js';
import { iconBits } from './icons.js';
import { Overworld, CIV_COLORS } from '../world/worldgen.js';
import { BIOMES } from '../world/biomes.js';
import { STORM, LANDMASSES } from '../world/geography.js';
import { CULTURES } from '../world/names.js';
import { MAP_W, MAP_H, REGION_W, REGION_D } from '../config.js';
import { compilePlan, gameLands, grids, packGrid, WN, CLIMATES, VALUES } from '../mod/worldplan.js';
import { biomeRulesOf, withBiomes, STYLES } from '../mod/biomes.js';
import { rid } from '../mod/format.js';
import { hash4 } from '../util/rng.js';

const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16];
const TOOLS = [
  ['select', 'move', 'V', 'Choose and move: click a land to choose it (drag it to move it, its edge handles to size it), or a pin'],
  ['hand', 'hand', 'H', 'Look about (or drag with the right button anywhere)'],
  null,
  ['land', 'island', 'B', 'Paint land (it joins the land it touches)'],
  ['sea', 'wave', 'O', 'Paint sea (cut bays, channels, holes)'],
  ['biome', 'tree', 'U', 'Paint a biome'],
  ['town', 'zone', 'T', 'Paint where towns may (or mayn\'t) be founded'],
  ['erase', 'eraser', 'E', 'Wipe off paint (of the layer you choose)'],
  null,
  ['island', 'plus', 'N', 'A new landmass: click where'],
  ['place', 'house', 'P', 'Set a structure, layout or dungeon of the mod\'s down: click where'],
  ['person', 'person', 'C', 'Set someone down: click where'],
  ['realm', 'banner', 'R', 'Found a realm: click where its capital is'],
  ['start', 'flag', 'S', 'Where new characters begin: click'],
];
const KIND_NAMES = { dagoni: 'Lived in (realms, towns, the sim)', continent: 'A wild continent', isle: 'A wild isle' };
const LAYERS = [['land', 'Land & sea'], ['biome', 'Biomes'], ['town', 'Town zones']];
const OCEAN = '#123a6a';
const DEEP = '#0c2a50';

export default class WorldTool {
  constructor(app) {
    this.app = app;
    this.id = null;
    this.tool = 'select';
    this.brush = 2;
    this.biome = 'forest';
    this.townMode = 1;
    this.eraseLayer = 'land';
    this.seed = 20240;
    this.zoom = 0;
    this.cam = { x: 70, z: 170 };
    this.sel = null;
    this.show = { towns: true, realms: false, rivers: true, paint: true, outlines: true, names: true, sites: false };
    this.mapCv = null;
    this.ow = null;
  }

  get w() {
    return this.id ? this.app.mod.worlds[this.id] : null;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.onResize = () => {
      this.rect = null;
      this.paint();
    };
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    if (this.id && this.w) this.open('worlds', this.id);
  }

  unmount() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
    window.clearTimeout(this.regenT);
  }

  current() {
    return this.w ? { kind: 'worlds', id: this.id } : null;
  }

  hintText() {
    if (!this.w) return 'Pick a world map in the explorer, or make one.';
    const t = TOOLS.find((q) => q && q[0] === this.tool);
    return `${t ? t[3] : ''}. The wheel zooms; drag with the right button to look about. Drag structures, dungeons, people and biomes in from the explorer.`;
  }

  keyHelp() {
    return [...TOOLS.filter(Boolean).map((t) => [t[2], t[3]]), ['[ ]', 'Brush size'], ['Delete', 'The chosen land or pin'], ['+ - 0', 'Zoom (0: all of it)']];
  }

  onKey(e) {
    if (!this.w || e.ctrlKey || e.metaKey || e.altKey) return false;
    const t = TOOLS.find((q) => q && q[2] === e.key.toUpperCase());
    if (t) {
      this.setTool(t[0]);
      return true;
    }
    if (e.key === '[' || e.key === ']') {
      this.brush = Math.max(0, Math.min(12, this.brush + (e.key === ']' ? 1 : -1)));
      this.drawSide();
      return true;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.deleteSel();
      return true;
    }
    const z = { '+': 1, '=': 1, '-': -1 }[e.key];
    if (z) {
      this.zoomBy(z, null);
      return true;
    }
    if (e.key === '0') {
      this.zoom = 0;
      this.cam = { x: MAP_W / 2, z: MAP_H / 2 };
      this.paint();
      return true;
    }
    return false;
  }

  open(kind, id) {
    if (!id || !this.app.mod.worlds[id]) {
      this.id = null;
      return this.empty();
    }
    if (this.id !== id) {
      this.sel = null;
      this.ow = null;
      this.mapCv = null;
    }
    this.id = id;
    this.normalize();
    this.build();
    this.regen(true);
  }

  reload() {
    if (this.w) {
      this.normalize();
      this.build();
      this.regen(true);
    } else this.empty();
  }

  removed(kind, id) {
    if (kind === 'worlds' && id === this.id) {
      this.id = null;
      this.empty();
    } else if (this.w) this.regen();
  }

  renamed() {
    if (this.nameEl && this.w) this.nameEl.value = this.w.name;
  }

  otherChanged() {
    if (this.w) this.regen();
  }

  // (Anything missing, filled in: an older map, or one from a file.)
  normalize() {
    const w = this.w;
    if (!Array.isArray(w.lands) || !w.lands.length) w.lands = gameLands(w.base);
    w.paint ||= { land: '', biome: '', legend: [], town: '' };
    w.places ||= [];
    w.people ||= [];
    w.realms ||= [];
    if (w.spawn === undefined) w.spawn = null;
  }

  // ------------------------------------------------------------ nothing open
  empty() {
    clear(this.stage);
    clear(this.insp);
    const card = (icon, t, d, fn) => {
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, ic(icon), t), h('div', { class: 'd' }, d));
      c.addEventListener('click', fn);
      return c;
    };
    this.stage.append(h('div', { class: 'home scroll' },
      h('h1', null, 'World maps'),
      h('div', { class: 'sub' }, 'The world a new game is played in: move, reshape and resize its lands (or add new ones), paint land and sea, paint biomes where you want them, say where towns may be founded, which biomes each land takes and how its climate runs; set your structures and dungeons where you want them, found realms, and set people about the world or in a realm. What you see is made just as a new world would be, towns and rivers and all.'),
      h('div', { class: 'cards' },
        card('globe', 'The game\'s world, changed', 'Start from the world as the game makes it, and change what you like.', () => this.newWorld('game')),
        card('wave', 'Open sea', 'Only the three islands (the game\'s stories need them; reshape them as you like): paint the rest yourself.', () => this.newWorld('sea')))));
    this.insp.append(h('div', { class: 'insp-head' }, ic('globe'), 'World'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open. A mod uses one world map (the first, if it has more).')));
  }

  newWorld(base = 'game') {
    return this.app.create('worlds', { name: base === 'sea' ? 'Open seas' : 'My world', base, lands: gameLands(base), paint: { land: '', biome: '', legend: [], town: '' }, places: [], people: [], realms: [], spawn: null });
  }

  // From the Biome tool: paint this biome.
  async paintBiome(ref) {
    if (!this.w) {
      const any = Object.keys(this.app.mod.worlds)[0];
      if (any) await this.app.open('worlds', any);
      else await this.newWorld('game');
    }
    this.biome = ref;
    this.setTool('biome');
    toast(`Paint "${biomeLook(this.app.mod, ref).name}" where you want it (the size: [ and ]).`, 'good');
  }

  // ------------------------------------------------------------ changing it
  set(fn, o = {}) {
    const w = this.w;
    if (!w) return;
    this.app.checkpoint('worlds', this.id);
    fn(w);
    this.app.touch('worlds', this.id);
    if (o.side !== false) this.drawSide();
    if (o.regen !== false) this.regen();
    else this.paint();
  }

  // The world made again, a moment after the last change.
  regen(now = false) {
    window.clearTimeout(this.regenT);
    if (!now) {
      this.regenT = setTimeout(() => this.regen(true), 140);
      return;
    }
    const w = this.w;
    if (!w) return;
    const mod = this.app.mod;
    const t0 = performance.now();
    try {
      withBiomes(mod, () => {
        this.plan = compilePlan(mod, w);
        this.ow = new Overworld(this.seed, { plan: this.plan, rules: biomeRulesOf(mod) });
        this.drawMap();
      });
    } catch (e) {
      console.error(e);
      toast(`The map couldn't be made: ${e.message || e}`, 'bad');
    }
    this.ms = Math.round(performance.now() - t0);
    this.paint();
    this.drawStats();
    // (What's chosen may say what came of it: drawn again, unless it's
    // being typed in.)
    if (this.sel && this.insp && !this.insp.contains(document.activeElement)) this.drawSide();
    // (Its picture in the explorer.)
    if (this.mapCv) {
      const th = canvas(40, 30);
      const x = th.getContext('2d');
      x.imageSmoothingEnabled = true;
      x.drawImage(this.mapCv, 0, 0, MAP_W, MAP_H, 0, 0, 40, 30);
      this.app.thumbs.set(`worlds:${this.id}`, th);
      this.app.refreshThumb('worlds', this.id);
    }
  }

  // Every square's colour (one pixel a square).
  drawMap() {
    const ow = this.ow;
    const c = this.mapCv || (this.mapCv = canvas(MAP_W, MAP_H));
    const x = c.getContext('2d');
    const img = x.createImageData(MAP_W, MAP_H);
    const d = img.data;
    const rgb = new Map();
    const col = (hex) => {
      if (!rgb.has(hex)) {
        const s = hex.replace('#', '');
        rgb.set(hex, [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]);
      }
      return rgb.get(hex);
    };
    // (Each square's biome kept: the letters close up, and what's under
    // the pointer, read from here rather than worked out again.)
    const keys = (this.biomeKeys = new Array(MAP_W * MAP_H));
    this.mapSerial = (this.mapSerial || 0) + 1;
    for (let cz = 0; cz < MAP_H; cz++) for (let cx = 0; cx < MAP_W; cx++) {
      const b = ow.mapBiome(cx, cz);
      keys[cz * MAP_W + cx] = b;
      const i = (cz * MAP_W + cx) * 4;
      let k;
      if (b === 'ocean') {
        const v = ow.continentAt((cx + 0.5) * REGION_W, (cz + 0.5) * REGION_D);
        k = col(v < -0.45 ? DEEP : OCEAN);
      } else if (b === 'lake') k = col('#2a6ab0');
      else k = col((BIOMES[b] || BIOMES.plains).bg);
      // (A little grain, as the land has.)
      const g = (hash4(cx, cz, 77, 3) % 9) - 4;
      d[i] = Math.max(0, Math.min(255, k[0] + g));
      d[i + 1] = Math.max(0, Math.min(255, k[1] + g));
      d[i + 2] = Math.max(0, Math.min(255, k[2] + g));
      d[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }

  // ------------------------------------------------------------ the stage
  build() {
    const app = this.app;
    clear(this.stage);
    this.rect = null;
    const tb = titleBar(app, 'worlds', this.id);
    this.nameEl = tb.querySelector('.title input');
    this.seedIn = textInput({ value: String(this.seed), max: 10, onChange: (v) => {
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) {
        this.seed = n >>> 0;
        this.regen(true);
      }
    } });
    this.seedIn.style.width = '86px';
    tb.append(h('span', { class: 'note' }, 'As made from seed'), this.seedIn,
      button(null, { icon: 'dice', small: true, title: 'Another seed: the same map, made another way (its coasts, its biomes\' splotches, its towns)', onClick: () => {
        this.seed = (Math.random() * 1e9) >>> 0;
        this.seedIn.value = String(this.seed);
        this.regen(true);
      } }),
      h('span', { class: 'sep' }),
      group(button(null, { icon: 'minus', small: true, title: 'Zoom out (-)', onClick: () => this.zoomBy(-1, null) }), button(null, { icon: 'zoom', small: true, title: 'All of it (0)', onClick: () => this.onKey({ key: '0' }) }), button(null, { icon: 'plus', small: true, title: 'Zoom in (+)', onClick: () => this.zoomBy(1, null) })),
      button('The islands', { icon: 'island', small: true, title: 'Go to the lived-in islands', onClick: () => {
        this.cam = { x: STORM.cx, z: STORM.cz };
        this.zoom = 4;
        this.paint();
      } }),
      h('span', { class: 'spacer' }),
      button('Try it out', { icon: 'play', small: true, kind: 'go', title: 'Playtest: a new world made with it', onClick: () => app.playtest() }));
    this.stage.append(tb);
    const row = h('div', { style: { display: 'flex', flex: '1', minHeight: '0' } });
    this.vt = h('div', { class: 'vtools' });
    this.wrap = h('div', { class: 'canvas-wrap' });
    this.cv = h('canvas');
    this.hud = h('div', { class: 'hud' });
    this.hudR = h('div', { class: 'hud r t' });
    this.wrap.append(this.cv, this.hud, this.hudR);
    row.append(this.vt, this.wrap);
    this.stage.append(row);
    this.drawTools();
    this.input();
    dropTarget(this.wrap, (p) => ['structures', 'layouts', 'dungeons', 'biomes'].includes(p.kind) || (p.kind === 'entities' && ['tpl.npc', 'tpl.animal', 'tpl.hostile', 'tpl.boss'].includes(p.tpl)), (p, e) => this.dropped(p, e));
    this.drawSide();
  }

  drawTools() {
    clear(this.vt);
    for (const t of TOOLS) {
      if (!t) {
        this.vt.append(h('div', { class: 'gap' }));
        continue;
      }
      this.vt.append(button(null, { icon: t[1], on: this.tool === t[0], title: t[3], key: t[2], onClick: () => this.setTool(t[0]) }));
    }
  }

  setTool(t) {
    this.tool = t;
    this.drawTools();
    this.drawSide();
    this.app.drawStatus();
    this.cv.style.cursor = t === 'hand' ? 'grab' : t === 'select' ? 'default' : 'crosshair';
    this.paint();
  }

  // ------------------------------------------------------------ the view
  get k() {
    return this.zoom || this.fitK();
  }

  fitK() {
    const r = this.wrap ? this.view() : { width: 960, height: 720 };
    return Math.max(1, Math.min((r.width - 16) / MAP_W, (r.height - 16) / MAP_H));
  }

  // Map squares (fractional) <-> the canvas's own pixels.
  // (The view's size, as it was when last drawn: asking the page for it
  // each time, thousands of times a frame, was what made it crawl.)
  view() {
    return this.rect || (this.rect = this.wrap.getBoundingClientRect());
  }

  toScreen(cx, cz) {
    const r = this.view();
    const k = this.k;
    return [r.width / 2 + (cx - this.cam.x) * k, r.height / 2 + (cz - this.cam.z) * k];
  }

  toMap(px, py) {
    const r = this.view();
    const k = this.k;
    return [this.cam.x + (px - r.width / 2) / k, this.cam.z + (py - r.height / 2) / k];
  }

  zoomBy(d, at) {
    const k0 = this.k;
    let i = ZOOMS.findIndex((z) => z >= k0 - 0.01);
    if (i < 0) i = ZOOMS.length - 1;
    i = Math.max(0, Math.min(ZOOMS.length - 1, i + d));
    const k1 = ZOOMS[i];
    if (at) {
      // (Keeping what's under the pointer where it is.)
      const [mx, mz] = this.toMap(at[0], at[1]);
      this.zoom = k1;
      const [sx, sz] = this.toScreen(mx, mz);
      this.cam.x += (sx - at[0]) / k1;
      this.cam.z += (sz - at[1]) / k1;
    } else this.zoom = k1;
    this.paint();
  }

  // Drawn again, once, in the next frame (however many times it's asked).
  paint() {
    if (this.paintQ) return;
    this.paintQ = window.requestAnimationFrame(() => {
      this.paintQ = 0;
      this.paintNow();
    });
  }

  paintNow() {
    const cv = this.cv;
    if (!cv || !this.wrap || !this.wrap.isConnected) return;
    const r = (this.rect = this.wrap.getBoundingClientRect());
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(r.width * dpr));
    const H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.imageSmoothingEnabled = false;
    x.fillStyle = '#081830';
    x.fillRect(0, 0, r.width, r.height);
    const k = this.k;
    const [ox, oy] = this.toScreen(0, 0);
    if (this.mapCv) x.drawImage(this.mapCv, ox, oy, MAP_W * k, MAP_H * k);
    // The map's own letters, close up.
    if (k >= 12 && this.ow) this.drawGlyphs(x, r);
    const ow = this.ow;
    // The storm round the lived-in seas.
    x.strokeStyle = 'rgba(200,220,255,0.35)';
    x.setLineDash([6, 6]);
    x.beginPath();
    x.ellipse(...this.toScreen(STORM.cx + 0.5, STORM.cz + 0.5), STORM.rx * k, STORM.rz * k, 0, 0, Math.PI * 2);
    x.stroke();
    x.beginPath();
    x.ellipse(...this.toScreen(STORM.cx + 0.5, STORM.cz + 0.5), (STORM.rx + STORM.band) * k, (STORM.rz + STORM.band) * k, 0, 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([]);
    if (ow && this.show.realms) this.drawRealms(x);
    if (ow && this.show.rivers) this.drawRivers(x);
    if (this.show.paint) this.drawPaint(x);
    if (this.show.outlines) this.drawLands(x);
    if (ow && this.show.sites) this.drawSites(x);
    if (ow && this.show.towns) this.drawTowns(x);
    this.drawPins(x);
    this.drawCursor(x);
  }

  // The map's own letters, close up: drawn a block of squares at a time
  // into pictures kept for this zoom (so looking about, or a brush moved
  // over them, only stamps a few of those).
  drawGlyphs(x, r) {
    const k = this.k;
    const s = Math.floor(k / 8);
    if (s < 1) return;
    const T = 16;
    const G = this.glyphTiles && this.glyphTiles.k === k && this.glyphTiles.serial === this.mapSerial ? this.glyphTiles : (this.glyphTiles = { k, serial: this.mapSerial, map: new Map(), pics: new Map() });
    const tiles = G.map;
    // (A few new blocks a frame, so zooming in never stalls: the rest in
    // the frames after.)
    let fresh = 0;
    let more = false;
    const [a, b] = this.toMap(0, 0);
    const [c, d] = this.toMap(r.width, r.height);
    for (let tz = Math.max(0, Math.floor(b / T)); tz <= Math.min(Math.floor((MAP_H - 1) / T), Math.floor(d / T)); tz++) {
      for (let tx = Math.max(0, Math.floor(a / T)); tx <= Math.min(Math.floor((MAP_W - 1) / T), Math.floor(c / T)); tx++) {
        const key = tz * 1000 + tx;
        let cv = tiles.get(key);
        if (cv) tiles.delete(key);
        else if (fresh >= 6) {
          more = true;
          continue;
        } else {
          cv = this.glyphTile(G, tx, tz, T, k, s);
          fresh++;
        }
        // (The ones used last kept; the oldest let go.)
        tiles.set(key, cv);
        if (tiles.size > 140) tiles.delete(tiles.keys().next().value);
        const [sx, sy] = this.toScreen(tx * T, tz * T);
        x.drawImage(cv, Math.round(sx), Math.round(sy));
      }
    }
    if (more) this.paint();
  }

  glyphTile(G, tx, tz, T, k, s) {
    const cv = canvas(T * k, T * k);
    const g = cv.getContext('2d');
    const mine = `m:${this.app.mod.id}:`;
    const keys = this.biomeKeys;
    const gw = 6 * s;
    const gh = 8 * s;
    for (let cz = tz * T; cz < Math.min(MAP_H, tz * T + T); cz++) {
      for (let cx = tx * T; cx < Math.min(MAP_W, tx * T + T); cx++) {
        const bk = keys ? keys[cz * MAP_W + cx] : this.ow.mapBiome(cx, cz);
        let pic = G.pics.get(bk);
        if (!pic) {
          const q = bk === 'ocean' ? BIOMES.ocean : bk === 'lake' ? { char: '≈', fg: '#80c8ff', bg: '#2a6ab0' } : bk.startsWith(mine) ? biomeLook(this.app.mod, `@${bk.slice(mine.length)}`) : BIOMES[bk] || BIOMES.plains;
          pic = glyphCanvas(q.char, q.fg, q.bg, s);
          G.pics.set(bk, pic);
        }
        g.drawImage(pic, (cx - tx * T) * k + Math.round((k - gw) / 2), (cz - tz * T) * k + Math.round((k - gh) / 2));
      }
    }
    return cv;
  }

  drawRealms(x) {
    const ow = this.ow;
    const k = this.k;
    const r = this.view();
    x.globalAlpha = 0.32;
    for (const c of ow.liveCells) {
      if (c.civ === null || c.civ === undefined || c.biome === 'ocean') continue;
      const civ = ow.civs[c.civ];
      if (!civ) continue;
      const [sx, sy] = this.toScreen(c.cx, c.cz);
      if (sx + k < 0 || sy + k < 0 || sx > r.width || sy > r.height) continue;
      x.fillStyle = civ.color.hex;
      x.fillRect(sx, sy, Math.ceil(k), Math.ceil(k));
    }
    x.globalAlpha = 1;
  }

  drawRivers(x) {
    const ow = this.ow;
    x.strokeStyle = '#4a9ae8';
    x.lineWidth = Math.max(1, this.k / 6);
    for (const rv of ow.rivers) {
      x.beginPath();
      rv.pts.forEach((p, i) => {
        const [sx, sy] = this.toScreen(p.x / REGION_W, p.z / REGION_D);
        if (i) x.lineTo(sx, sy);
        else x.moveTo(sx, sy);
      });
      x.stroke();
    }
    x.lineWidth = 1;
  }

  // What's painted (on top of the map as it's made, while a stroke's
  // going on: its squares as they'll be).
  drawPaint(x) {
    const k = this.k;
    const g = this.work || (this.gridsCache && this.sameGrids() ? this.gridsCache.g : null) || this.grids();
    const r = this.view();
    const [a, b] = this.toMap(0, 0);
    const [c, d] = this.toMap(r.width, r.height);
    const x0 = Math.max(0, Math.floor(a));
    const x1 = Math.min(MAP_W - 1, Math.ceil(c));
    const z0 = Math.max(0, Math.floor(b));
    const z1 = Math.min(MAP_H - 1, Math.ceil(d));
    const live = !!this.work;
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const i = cz * MAP_W + cx;
      const L = g.land[i];
      const B = g.biome[i];
      const T = g.town[i];
      if (!L && !B && !T) continue;
      const [sx, sy] = this.toScreen(cx, cz);
      if (live && L) {
        x.fillStyle = L === 1 ? 'rgba(90,160,70,0.85)' : 'rgba(18,58,106,0.9)';
        x.fillRect(sx, sy, k, k);
      }
      if (live && B) {
        const look = biomeLook(this.app.mod, g.legend[B - 1]);
        x.fillStyle = look.bg;
        x.globalAlpha = 0.85;
        x.fillRect(sx, sy, k, k);
        x.globalAlpha = 1;
      }
      // (Marked, so what's painted shows from what's made.)
      if (k >= 3) {
        if (L) {
          x.fillStyle = L === 1 ? 'rgba(200,255,170,0.7)' : 'rgba(150,200,255,0.7)';
          x.fillRect(sx + k / 2 - 0.5, sy + k / 2 - 0.5, Math.max(1, k / 6), Math.max(1, k / 6));
        }
        if (B) {
          x.strokeStyle = 'rgba(255,255,255,0.35)';
          x.strokeRect(sx + 0.5, sy + 0.5, k - 1, k - 1);
        }
      }
      if (T) {
        x.strokeStyle = T === 1 ? 'rgba(120,255,140,0.75)' : 'rgba(255,90,110,0.75)';
        x.beginPath();
        x.moveTo(sx, sy + k);
        x.lineTo(sx + k, sy);
        if (k >= 6) {
          x.moveTo(sx, sy + k / 2);
          x.lineTo(sx + k / 2, sy);
          x.moveTo(sx + k / 2, sy + k);
          x.lineTo(sx + k, sy + k / 2);
        }
        x.stroke();
      }
    }
  }

  // The landmasses: their own shapes' outlines, their names; the one
  // chosen with its handles.
  drawLands(x) {
    const w = this.w;
    if (!w) return;
    const k = this.k;
    x.font = '12px monospace';
    x.textAlign = 'center';
    for (const L of w.lands) {
      const on = this.sel && this.sel.type === 'land' && this.sel.key === L.key;
      const [cx, cy] = this.toScreen(L.cx + 0.5, L.cz + 0.5);
      if (L.blob !== false) {
        x.strokeStyle = on ? '#ffd84a' : L.kind === 'dagoni' ? 'rgba(255,230,140,0.5)' : 'rgba(255,255,255,0.28)';
        x.setLineDash(on ? [] : [3, 4]);
        x.lineWidth = on ? 2 : 1;
        x.beginPath();
        // (Its shape: a rounded square, as geography's superellipse.)
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const c = Math.cos(a);
          const s = Math.sin(a);
          const rr = 0.88 / Math.cbrt(Math.abs(c) ** 3 + Math.abs(s) ** 3);
          const px = cx + c * rr * L.rx * k;
          const py = cy + s * rr * L.rz * k;
          if (i) x.lineTo(px, py);
          else x.moveTo(px, py);
        }
        x.stroke();
        x.setLineDash([]);
        x.lineWidth = 1;
      }
      if (this.show.names && k >= 1.5) {
        x.fillStyle = 'rgba(0,0,0,0.6)';
        x.fillText(L.name, cx + 1, cy + 1 - Math.min(12, L.rz * k * 0.2));
        x.fillStyle = on ? '#ffd84a' : L.kind === 'dagoni' ? '#ffe9a0' : '#e8ecff';
        x.fillText(L.name, cx, cy - Math.min(12, L.rz * k * 0.2));
      }
      if (on) {
        for (const [hx, hy] of this.handles(L)) {
          x.fillStyle = '#ffd84a';
          x.fillRect(hx - 4, hy - 4, 8, 8);
          x.strokeStyle = '#000';
          x.strokeRect(hx - 3.5, hy - 3.5, 7, 7);
        }
      }
    }
  }

  // A land's handles on screen: its middle, its east edge, its south edge.
  handles(L) {
    const k = this.k;
    const [cx, cy] = this.toScreen(L.cx + 0.5, L.cz + 0.5);
    return [[cx, cy], [cx + L.rx * 0.88 * k, cy], [cx, cy + L.rz * 0.88 * k]];
  }

  drawTowns(x) {
    const ow = this.ow;
    const k = this.k;
    x.font = '11px monospace';
    x.textAlign = 'left';
    for (const s of ow.settlements) {
      const [sx, sy] = this.toScreen(s.cx, s.cz);
      const w = s.cw * k;
      const hh = s.cd * k;
      const civ = s.civ;
      x.fillStyle = civ ? civ.color.hex : '#c8c8c8';
      const m = s.type === 'city' ? 0 : s.type === 'town' ? k * 0.15 : k * 0.3;
      x.fillRect(sx + m, sy + m, Math.max(2, w - m * 2), Math.max(2, hh - m * 2));
      x.strokeStyle = '#000';
      x.strokeRect(sx + m + 0.5, sy + m + 0.5, Math.max(2, w - m * 2) - 1, Math.max(2, hh - m * 2) - 1);
      if (k >= 5 || (k >= 2.5 && s.type === 'city')) {
        x.fillStyle = 'rgba(0,0,0,0.65)';
        x.fillText(s.name, sx + w + 3, sy + hh / 2 + 4);
        x.fillStyle = s.type === 'city' ? '#ffe9a0' : '#f4f0e0';
        x.fillText(s.name, sx + w + 2, sy + hh / 2 + 3);
      }
    }
  }

  drawSites(x) {
    for (const s of this.ow.sites || []) {
      const [sx, sy] = this.toScreen(s.cx + 0.5, s.cz + 0.5);
      this.icon(x, s.mod ? 'house' : s.type === 'spire' ? 'pillar' : 'skull', sx, sy, s.mod ? '#c890ff' : '#d0b080', 1);
    }
  }

  // A pixel icon at (sx, sy), on a dark plate.
  icon(x, name, sx, sy, color, scale = 2, on = false) {
    const bits = iconBits(name);
    const s = scale;
    const w = 12 * s;
    x.fillStyle = on ? '#ffd84a' : 'rgba(6,10,28,0.85)';
    x.fillRect(Math.round(sx - w / 2 - 2), Math.round(sy - w / 2 - 2), w + 4, w + 4);
    x.fillStyle = on ? '#1e1504' : color;
    for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) if (bits[j][i] === '#') x.fillRect(Math.round(sx - w / 2 + i * s), Math.round(sy - w / 2 + j * s), s, s);
  }

  drawPins(x) {
    const w = this.w;
    if (!w) return;
    const mod = this.app.mod;
    const on = (type, id) => !!this.sel && this.sel.type === type && this.sel.id === id;
    x.font = '11px monospace';
    x.textAlign = 'center';
    const label = (t, sx, sy) => {
      if (this.k < 2) return;
      x.fillStyle = 'rgba(0,0,0,0.7)';
      x.fillText(t, sx + 1, sy + 19);
      x.fillStyle = '#fff';
      x.fillText(t, sx, sy + 18);
    };
    for (const p of w.places) {
      const [sx, sy] = this.toScreen(p.cx + 0.5, p.cz + 0.5);
      const t = mod[p.kind] && mod[p.kind][p.ref];
      this.icon(x, p.kind === 'dungeons' ? 'stairs' : p.kind === 'layouts' ? 'grid' : 'house', sx, sy, '#c890ff', 1, on('place', p.id));
      label(t ? t.name : '(gone)', sx, sy);
    }
    for (const R of w.realms) {
      const [sx, sy] = this.toScreen(R.cx + 0.5, R.cz + 0.5);
      this.icon(x, 'banner', sx, sy, CIV_COLORS[R.color % CIV_COLORS.length].hex, 1, on('realm', R.id));
      label(R.name, sx, sy);
    }
    for (const p of w.people) {
      if (p.realm) continue;
      const [sx, sy] = this.toScreen(p.cx + 0.5, p.cz + 0.5);
      const e = mod.entities[String(p.ent).slice(1)];
      this.icon(x, 'person', sx, sy, '#80e0ff', 1, on('person', p.id));
      label(e ? e.name : '(gone)', sx, sy);
    }
    if (w.spawn) {
      const [sx, sy] = this.toScreen(w.spawn.cx + 0.5, w.spawn.cz + 0.5);
      this.icon(x, 'flag', sx, sy, '#ffe070', 1, on('spawn', 'spawn'));
      label('Start', sx, sy);
    }
  }

  drawCursor(x) {
    if (!this.hover || !['land', 'sea', 'biome', 'town', 'erase'].includes(this.tool)) return;
    const k = this.k;
    const [hx, hz] = this.hover;
    const [sx, sy] = this.toScreen(Math.floor(hx) + 0.5, Math.floor(hz) + 0.5);
    x.strokeStyle = '#ffd84a';
    x.setLineDash([3, 3]);
    x.beginPath();
    x.arc(sx, sy, Math.max(k / 2, (this.brush + 0.5) * k), 0, Math.PI * 2);
    x.stroke();
    x.setLineDash([]);
  }

  // ------------------------------------------------------------ the grids
  grids() {
    const g = grids(this.w);
    const P = this.w.paint || {};
    this.gridsCache = { id: this.id, land: P.land, biome: P.biome, town: P.town, legend: (P.legend || []).join(','), g };
    return g;
  }

  // (Still the paint the kept grids were made from?)
  sameGrids() {
    const c = this.gridsCache;
    const P = this.w.paint || {};
    return c.id === this.id && c.land === P.land && c.biome === P.biome && c.town === P.town && c.legend === (P.legend || []).join(',');
  }

  // The squares a brush at (fx, fz) covers.
  brushSquares(fx, fz) {
    const out = [];
    const r = this.brush;
    const cx = Math.floor(fx);
    const cz = Math.floor(fz);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r + r * 0.6) continue;
      const x = cx + dx;
      const z = cz + dz;
      if (x >= 0 && z >= 0 && x < MAP_W && z < MAP_H) out.push(z * MAP_W + x);
    }
    return out;
  }

  // A brush stroke onto the working copy of the grids.
  dab(fx, fz) {
    const g = this.work;
    let v = 0;
    let layer = 'land';
    if (this.tool === 'land') v = 1;
    else if (this.tool === 'sea') v = 2;
    else if (this.tool === 'town') {
      layer = 'town';
      v = this.townMode;
    } else if (this.tool === 'biome') {
      layer = 'biome';
      let i = g.legend.indexOf(this.biome);
      if (i < 0) {
        if (g.legend.length >= 250) return;
        g.legend.push(this.biome);
        i = g.legend.length - 1;
      }
      v = i + 1;
    } else if (this.tool === 'erase') layer = this.eraseLayer;
    for (const i of this.brushSquares(fx, fz)) g[layer][i] = v;
  }

  // The stroke done: the grids kept (legend tidied: biomes no longer
  // painted anywhere let go).
  endStroke() {
    const g = this.work;
    this.work = null;
    const used = new Set(g.biome);
    const keep = g.legend.map((r, i) => (used.has(i + 1) ? r : null));
    const remap = new Map();
    const legend = [];
    keep.forEach((r, i) => {
      if (r === null) return;
      remap.set(i + 1, legend.length + 1);
      legend.push(r);
    });
    for (let i = 0; i < WN; i++) if (g.biome[i]) g.biome[i] = remap.get(g.biome[i]) || 0;
    this.set((w) => {
      w.paint = { land: packGrid(g.land), biome: packGrid(g.biome), legend, town: packGrid(g.town) };
    }, { side: false });
  }

  // ------------------------------------------------------------ the pointer
  input() {
    const cv = this.cv;
    const at = (e) => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1 : -1, at(e));
    }, { passive: false });
    cv.addEventListener('pointermove', (e) => {
      if (this.drag) return;
      const [px, py] = at(e);
      this.hover = this.toMap(px, py);
      this.drawHud();
      if (['land', 'sea', 'biome', 'town', 'erase'].includes(this.tool)) this.paint();
    });
    cv.addEventListener('pointerleave', () => {
      this.hover = null;
      this.paint();
    });
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      const [px, py] = at(e);
      const [mx, mz] = this.toMap(px, py);
      const pan = e.button === 2 || e.button === 1 || this.tool === 'hand';
      if (pan) return this.startPan(e, px, py);
      if (this.tool === 'select') return this.startSelect(e, px, py, mx, mz);
      if (['land', 'sea', 'biome', 'town', 'erase'].includes(this.tool)) return this.startPaint(e, mx, mz);
      this.clickTool(mx, mz, e);
      return null;
    });
  }

  startPan(e, px, py) {
    const c0 = { ...this.cam };
    const k = this.k;
    this.drag = 'pan';
    this.cv.style.cursor = 'grabbing';
    const move = (ev) => {
      const r = this.cv.getBoundingClientRect();
      this.cam = { x: c0.x - (ev.clientX - r.left - px) / k, z: c0.z - (ev.clientY - r.top - py) / k };
      this.paint();
    };
    const up = () => {
      this.drag = null;
      this.cv.style.cursor = this.tool === 'hand' ? 'grab' : this.tool === 'select' ? 'default' : 'crosshair';
      this.cv.removeEventListener('pointermove', move);
      this.cv.removeEventListener('pointerup', up);
    };
    this.cv.addEventListener('pointermove', move);
    this.cv.addEventListener('pointerup', up);
  }

  startPaint(e, mx, mz) {
    this.work = this.grids();
    this.work = { land: this.work.land.slice(), biome: this.work.biome.slice(), town: this.work.town.slice(), legend: this.work.legend.slice() };
    this.drag = 'paint';
    let last = [mx, mz];
    this.dab(mx, mz);
    this.paint();
    const move = (ev) => {
      const r = this.cv.getBoundingClientRect();
      const [nx, nz] = this.toMap(ev.clientX - r.left, ev.clientY - r.top);
      // (Every square between, so a quick stroke leaves no gaps.)
      const n = Math.ceil(Math.hypot(nx - last[0], nz - last[1]) * 2);
      for (let i = 1; i <= n; i++) this.dab(last[0] + ((nx - last[0]) * i) / n, last[1] + ((nz - last[1]) * i) / n);
      last = [nx, nz];
      this.hover = [nx, nz];
      this.paint();
    };
    const up = () => {
      this.drag = null;
      this.cv.removeEventListener('pointermove', move);
      this.cv.removeEventListener('pointerup', up);
      this.endStroke();
    };
    this.cv.addEventListener('pointermove', move);
    this.cv.addEventListener('pointerup', up);
  }

  // Choosing: a pin, a land's handle, a land; then dragging it.
  startSelect(e, px, py, mx, mz) {
    const w = this.w;
    const near = (cx, cz) => {
      const [sx, sy] = this.toScreen(cx + 0.5, cz + 0.5);
      return Math.hypot(sx - px, sy - py) < 12;
    };
    let hit = null;
    if (w.spawn && near(w.spawn.cx, w.spawn.cz)) hit = { type: 'spawn', id: 'spawn', obj: w.spawn };
    for (const p of w.places) if (!hit && near(p.cx, p.cz)) hit = { type: 'place', id: p.id, obj: p };
    for (const p of w.people) if (!hit && !p.realm && near(p.cx, p.cz)) hit = { type: 'person', id: p.id, obj: p };
    for (const R of w.realms) if (!hit && near(R.cx, R.cz)) hit = { type: 'realm', id: R.id, obj: R };
    // (The chosen land's handles first.)
    if (!hit && this.sel && this.sel.type === 'land') {
      const L = w.lands.find((q) => q.key === this.sel.key);
      if (L) {
        const hs = this.handles(L);
        for (let i = 0; i < 3 && !hit; i++) if (Math.hypot(hs[i][0] - px, hs[i][1] - py) < 8) hit = { type: 'land', key: L.key, obj: L, handle: i };
      }
    }
    if (!hit) {
      // (The land that's there: by what's made, or the nearest's middle.)
      const L = this.landUnder(mx, mz);
      if (L) hit = { type: 'land', key: L.key, obj: L, handle: 0 };
    }
    this.sel = hit ? { type: hit.type, id: hit.id, key: hit.key } : null;
    this.drawSide();
    this.paint();
    if (!hit) return;
    // Dragging it.
    const o = hit.obj;
    const c0 = { cx: o.cx, cz: o.cz, rx: o.rx, rz: o.rz };
    let moved = false;
    this.drag = 'move';
    const move = (ev) => {
      const r = this.cv.getBoundingClientRect();
      const [nx, nz] = this.toMap(ev.clientX - r.left, ev.clientY - r.top);
      if (!moved && Math.hypot(nx - mx, nz - mz) * this.k < 3) return;
      moved = true;
      if (hit.type === 'land' && hit.handle === 1) o.rx = Math.max(0.5, Math.round((Math.abs(nx - (o.cx + 0.5)) / 0.88) * 2) / 2);
      else if (hit.type === 'land' && hit.handle === 2) o.rz = Math.max(0.5, Math.round((Math.abs(nz - (o.cz + 0.5)) / 0.88) * 2) / 2);
      else {
        o.cx = Math.max(1, Math.min(MAP_W - 2, Math.round(c0.cx + nx - mx)));
        o.cz = Math.max(1, Math.min(MAP_H - 2, Math.round(c0.cz + nz - mz)));
      }
      this.paint();
    };
    const up = () => {
      this.drag = null;
      this.cv.removeEventListener('pointermove', move);
      this.cv.removeEventListener('pointerup', up);
      if (!moved) return;
      const now = { cx: o.cx, cz: o.cz, rx: o.rx, rz: o.rz };
      Object.assign(o, c0);
      // (A land moved takes what's painted as its with it.)
      const dx = now.cx - c0.cx;
      const dz = now.cz - c0.cz;
      this.set((ww) => {
        Object.assign(o, now);
        if (hit.type === 'land' && hit.handle === 0 && (dx || dz)) this.shiftPaint(ww, hit.key, dx, dz);
      });
    };
    this.cv.addEventListener('pointermove', move);
    this.cv.addEventListener('pointerup', up);
  }

  // The land under a point of the map (as made), or whose shape it's in.
  landUnder(mx, mz) {
    const w = this.w;
    const ow = this.ow;
    if (ow) {
      const L = ow.landAt((mx) * REGION_W, (mz) * REGION_D);
      if (L && ow.continentAt(mx * REGION_W, mz * REGION_D) > -0.05) return w.lands.find((q) => q.key === L.key) || null;
    }
    let best = null;
    for (const L of w.lands) {
      const d = Math.hypot((mx - L.cx - 0.5) / Math.max(1, L.rx), (mz - L.cz - 0.5) / Math.max(1, L.rz));
      if (d < 1 && (!best || d < best.d)) best = { L, d };
    }
    return best ? best.L : null;
  }

  // What's painted as a land's own (land joined to it, and the biomes and
  // town zones on that), moved with it.
  shiftPaint(w, key, dx, dz) {
    const ow = this.ow;
    if (!ow) return;
    const L = ow.lands.find((q) => q.key === key);
    if (!L || !L.paint) return;
    const own = L.paint.owner;
    const g = grids(w);
    const moved = [];
    for (let i = 0; i < WN; i++) {
      if (own[i] !== L.i + 1) continue;
      moved.push([i, g.land[i], g.biome[i], g.town[i]]);
      g.land[i] = 0;
      g.biome[i] = 0;
      g.town[i] = 0;
    }
    for (const [i, a, b, c] of moved) {
      const cx = (i % MAP_W) + dx;
      const cz = Math.floor(i / MAP_W) + dz;
      if (cx < 0 || cz < 0 || cx >= MAP_W || cz >= MAP_H) continue;
      const j = cz * MAP_W + cx;
      g.land[j] = a;
      if (b) g.biome[j] = b;
      if (c) g.town[j] = c;
    }
    w.paint = { land: packGrid(g.land), biome: packGrid(g.biome), legend: g.legend, town: packGrid(g.town) };
  }

  clickTool(mx, mz, e) {
    const cx = Math.max(0, Math.min(MAP_W - 1, Math.floor(mx)));
    const cz = Math.max(0, Math.min(MAP_H - 1, Math.floor(mz)));
    const app = this.app;
    if (this.tool === 'island') {
      const inside = ((cx - STORM.cx) / STORM.rx) ** 2 + ((cz - STORM.cz) / STORM.rz) ** 2 < 1;
      const key = `w${rid(5)}`;
      this.set((ww) => ww.lands.push({ key, name: inside ? 'New Isle' : 'Far Isle', kind: inside ? 'dagoni' : 'isle', cx, cz, rx: 6, rz: 4.5, rough: 0.3, blob: true, civs: 1, towns: 1, villages: 2, rivers: 1, lakes: 1, dungeons: 2, spires: 0, about: 'an island of the mod\'s' }));
      this.sel = { type: 'land', key };
      this.drawSide();
      toast(inside ? 'A new island, lived in (inside the storm: realms and towns will come to it).' : 'A new wild isle (outside the storm: land and biomes, no towns).', 'good');
      return;
    }
    if (this.tool === 'start') {
      this.set((ww) => (ww.spawn = { cx, cz }));
      this.sel = { type: 'spawn', id: 'spawn' };
      this.drawSide();
      return;
    }
    if (this.tool === 'realm') {
      const id = rid(6);
      const ow = this.ow;
      const L = ow ? ow.landAt((cx + 0.5) * REGION_W, (cz + 0.5) * REGION_D) : null;
      const style = L && L.kind === 'dagoni' ? (BIOMES[ow.mapBiome(cx, cz)] ? styleFor(ow.mapBiome(cx, cz)) : 'vale') : 'vale';
      this.set((ww) => ww.realms.push({ id, name: 'A New Realm', style, color: ww.realms.length % CIV_COLORS.length, values: [], cx, cz }));
      this.sel = { type: 'realm', id };
      this.drawSide();
      if (!L || L.kind !== 'dagoni') toast('Realms are founded only on lived-in islands (inside the storm): move it onto one.', 'bad');
      return;
    }
    if (this.tool === 'place') {
      const opts = [];
      for (const [k, label, icon] of [['structures', 'Structures', 'house'], ['layouts', 'Layouts', 'grid'], ['dungeons', 'Dungeons', 'stairs']]) {
        const list = Object.values(app.mod[k] || {});
        if (!list.length) continue;
        opts.push({ head: label }, ...list.map((t) => ({ label: t.name, icon, onClick: () => this.addPlace(k, t.id, cx, cz) })));
      }
      if (!opts.length) opts.push({ label: 'Build something in the Builder first', off: true });
      menu(opts, e.clientX, e.clientY);
      return;
    }
    if (this.tool === 'person') {
      const anchor = { getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 }) };
      pickRef(app, 'creature', anchor, (v) => v && this.addPerson(v, cx, cz));
    }
  }

  addPlace(kind, ref, cx, cz) {
    const id = rid(6);
    this.set((w) => w.places.push({ id, kind, ref, cx, cz }));
    this.sel = { type: 'place', id };
    this.drawSide();
  }

  addPerson(ent, cx, cz, realm = null) {
    const id = rid(6);
    this.set((w) => w.people.push({ id, ent, cx, cz, realm, home: 'capital' }));
    this.sel = { type: 'person', id };
    this.drawSide();
  }

  dropped(p, e) {
    const r = this.cv.getBoundingClientRect();
    const [mx, mz] = this.toMap(e.clientX - r.left, e.clientY - r.top);
    const cx = Math.max(0, Math.min(MAP_W - 1, Math.floor(mx)));
    const cz = Math.max(0, Math.min(MAP_H - 1, Math.floor(mz)));
    if (p.kind === 'biomes') {
      const b = this.app.mod.biomes[p.id];
      this.biome = b && b.change ? b.change : `@${p.id}`;
      this.setTool('biome');
      toast(`Paint "${p.name}" where you want it.`, 'good');
    } else if (p.kind === 'entities') {
      // (Dropped on a realm's flag: someone of that realm.)
      const R = this.w.realms.find((q) => Math.abs(q.cx - cx) <= 1 && Math.abs(q.cz - cz) <= 1);
      this.addPerson(`@${p.id}`, cx, cz, R ? R.id : null);
      if (R) toast(`"${p.name}" lives in ${R.name}'s capital.`, 'good');
    } else this.addPlace(p.kind, p.id, cx, cz);
  }

  deleteSel() {
    const s = this.sel;
    if (!s) return;
    if (s.type === 'land') {
      if (['thessa', 'kharos', 'myrrow'].includes(s.key)) return toast('The three islands stay (the game\'s stories need them): make them small, or move them, instead.', 'bad');
      this.set((w) => (w.lands = w.lands.filter((L) => L.key !== s.key)));
    } else if (s.type === 'place') this.set((w) => (w.places = w.places.filter((p) => p.id !== s.id)));
    else if (s.type === 'person') this.set((w) => (w.people = w.people.filter((p) => p.id !== s.id)));
    else if (s.type === 'realm') this.set((w) => {
      w.realms = w.realms.filter((p) => p.id !== s.id);
      for (const p of w.people) if (p.realm === s.id) p.realm = null;
    });
    else if (s.type === 'spawn') this.set((w) => (w.spawn = null));
    this.sel = null;
    this.drawSide();
  }

  drawHud() {
    if (!this.hud) return;
    const ow = this.ow;
    const hv = this.hover;
    if (!hv || !ow) {
      this.hud.textContent = '';
      return;
    }
    const cx = Math.floor(hv[0]);
    const cz = Math.floor(hv[1]);
    if (cx < 0 || cz < 0 || cx >= MAP_W || cz >= MAP_H) {
      this.hud.textContent = '';
      return;
    }
    const b = this.biomeKeys ? this.biomeKeys[cz * MAP_W + cx] : ow.mapBiome(cx, cz);
    const L = ow.landAt((cx + 0.5) * REGION_W, (cz + 0.5) * REGION_D);
    const s = ow.settlementAt((cx + 0.5) * REGION_W, (cz + 0.5) * REGION_D);
    const name = b === 'ocean' ? 'sea' : b === 'lake' ? 'a lake' : biomeLook(this.app.mod, b.startsWith(`m:${this.app.mod.id}:`) ? `@${b.split(':')[2]}` : b).name;
    this.hud.textContent = `${cx}, ${cz} · ${name}${b !== 'ocean' && L ? ` · ${L.name}` : ''}${s ? ` · ${s.name} (${s.type})` : ''}`;
  }

  drawStats() {
    if (!this.hudR || !this.ow) return;
    const ow = this.ow;
    this.hudR.textContent = `${ow.islands.length} lived-in islands · ${ow.civs.length} realms · ${ow.settlements.length} towns · made in ${this.ms} ms`;
  }

  // ------------------------------------------------------------ the panels
  drawSide() {
    const app = this.app;
    const w = this.w;
    if (!w) return;
    const keep = this.sideBody ? this.sideBody.scrollTop : 0;
    clear(this.insp);
    this.insp.append(h('div', { class: 'insp-head' }, ic('globe'), 'World map'));
    const body = h('div', { class: 'insp-body scroll' });
    this.sideBody = body;
    // The tool in hand.
    const tb = h('div');
    const tool = TOOLS.find((q) => q && q[0] === this.tool);
    tb.append(h('div', { class: 'note' }, tool ? tool[3] : ''));
    if (['land', 'sea', 'biome', 'town', 'erase'].includes(this.tool)) {
      tb.append(field('Brush', slider({ value: this.brush, min: 0, max: 12, int: true, onChange: (v) => (this.brush = v) }), { tip: 'Its size, in map squares ([ and ])' }));
    }
    if (this.tool === 'biome') {
      const list = h('div', { class: 'chips' });
      for (const [k, label] of [...biomeOptions(app, { all: false })]) {
        const look = biomeLook(app.mod, k);
        const c = h('span', { class: `chip${k === this.biome ? ' on' : ''}`, style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } }, glyphCanvas(look.char, look.fg, look.bg, 1), label);
        c.addEventListener('click', () => {
          this.biome = k;
          this.drawSide();
        });
        list.append(c);
      }
      tb.append(field('Biome', list, { wide: true, tip: 'Or drag one of the mod\'s biomes onto the map.' }));
    }
    if (this.tool === 'town') tb.append(field('Paint', seg([[1, 'Towns may be here', 'Where it\'s painted on an island, towns go only there'], [2, 'No towns here']], this.townMode, (v) => (this.townMode = v))));
    if (this.tool === 'erase') tb.append(field('Wipe off', seg(LAYERS, this.eraseLayer, (v) => (this.eraseLayer = v))));
    if (this.tool === 'land') tb.append(h('div', { class: 'note' }, 'Painted land joins the land it touches (or runs on from): its biomes, its realms. Painted far from any, it\'s a wild land of its own.'));
    body.append(panel('Tool', tb, { key: 'wo-tool' }));
    // What's chosen.
    const s = this.sel;
    if (s && s.type === 'land') {
      const L = w.lands.find((q) => q.key === s.key);
      if (L) body.append(panel(`Land: ${L.name}`, this.landBody(L), { key: 'wo-land' }));
    } else if (s && s.type === 'place') {
      const p = w.places.find((q) => q.id === s.id);
      if (p) body.append(panel('Set place', this.placeBody(p), { key: 'wo-place' }));
    } else if (s && s.type === 'person') {
      const p = w.people.find((q) => q.id === s.id);
      if (p) body.append(panel('Someone set down', this.personBody(p), { key: 'wo-person' }));
    } else if (s && s.type === 'realm') {
      const R = w.realms.find((q) => q.id === s.id);
      if (R) body.append(panel(`Realm: ${R.name}`, this.realmBody(R), { key: 'wo-realm' }));
    } else if (s && s.type === 'spawn' && w.spawn) {
      body.append(panel('Where characters begin', h('div', null, h('div', { class: 'note' }, `Map square ${w.spawn.cx}, ${w.spawn.cz}. New characters begin here (those born in a town, at home; a fallen star's crater is here). Drag the flag to move it.`), button('Take it away', { icon: 'trash', small: true, kind: 'ghost', onClick: () => this.deleteSel() })), { key: 'wo-spawn' }));
    }
    // The lands.
    const lands = h('div', { class: 'list' });
    for (const L of w.lands) {
      const li = h('div', { class: `li${s && s.type === 'land' && s.key === L.key ? ' on' : ''}` }, ic(L.kind === 'dagoni' ? 'island' : 'mountain', 11), h('span', { style: { flex: 1 } }, L.name), h('span', { class: 'note' }, L.kind === 'dagoni' ? 'lived in' : L.kind));
      li.addEventListener('click', () => {
        this.sel = { type: 'land', key: L.key };
        this.cam = { x: L.cx + 0.5, z: L.cz + 0.5 };
        if (!this.zoom || this.zoom < 3) this.zoom = 3;
        this.drawSide();
        this.paint();
      });
      lands.append(li);
    }
    lands.append(h('div', { class: 'row', style: { marginTop: '4px' } }, button('New land', { icon: 'plus', small: true, onClick: () => this.setTool('island') })));
    body.append(panel('Lands', lands, { key: 'wo-lands', open: false }));
    // Set down: places, realms, people.
    const set = h('div', { class: 'list' });
    const line = (icon, t, sub, sel, fn) => {
      const li = h('div', { class: `li${sel ? ' on' : ''}` }, ic(icon, 11), h('span', { style: { flex: 1 } }, t), h('span', { class: 'note' }, sub));
      li.addEventListener('click', fn);
      set.append(li);
    };
    const go = (o, sel) => {
      this.sel = sel;
      this.cam = { x: o.cx + 0.5, z: o.cz + 0.5 };
      if (!this.zoom || this.zoom < 4) this.zoom = 4;
      this.drawSide();
      this.paint();
    };
    for (const R of w.realms) line('banner', R.name, 'realm', s && s.id === R.id, () => go(R, { type: 'realm', id: R.id }));
    for (const p of w.places) {
      const t = app.mod[p.kind] && app.mod[p.kind][p.ref];
      line(p.kind === 'dungeons' ? 'stairs' : 'house', t ? t.name : '(gone)', p.kind.slice(0, -1), s && s.id === p.id, () => go(p, { type: 'place', id: p.id }));
    }
    for (const p of w.people) {
      const e = app.mod.entities[String(p.ent).slice(1)];
      const R = p.realm && w.realms.find((q) => q.id === p.realm);
      line('person', e ? e.name : '(gone)', R ? `in ${R.name}` : 'person', s && s.id === p.id, () => go(R || p, { type: 'person', id: p.id }));
    }
    if (w.spawn) line('flag', 'Where characters begin', '', s && s.type === 'spawn', () => go(w.spawn, { type: 'spawn', id: 'spawn' }));
    if (!set.children.length) set.append(h('div', { class: 'note' }, 'Nothing set down yet: use the tools on the left, or drag structures, dungeons and people from the explorer onto the map.'));
    body.append(panel('Set down', set, { key: 'wo-set' }));
    // What's shown.
    const sh = h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px 12px' } });
    for (const [k, label] of [['towns', 'Towns'], ['realms', 'Realms\' lands'], ['rivers', 'Rivers'], ['paint', 'What\'s painted'], ['outlines', 'Lands\' shapes'], ['names', 'Names'], ['sites', 'Old places']]) {
      sh.append(check(label, this.show[k], (v) => {
        this.show[k] = v;
        this.paint();
      }));
    }
    body.append(panel('Show', sh, { key: 'wo-show' }));
    // The map itself.
    const me = h('div');
    if (Object.keys(app.mod.worlds).length > 1) {
      me.append(check('New worlds begin on this map', !!w.use, (v) => this.set((ww) => {
        for (const o of Object.values(app.mod.worlds)) o.use = false;
        ww.use = v;
      }, { regen: false })));
      // (Round 65) The others: worlds to cross into.
      me.append(h('div', { class: 'note' }, 'Your other maps are worlds of their own, to cross into with the "Cross to another world" node: each made the first time someone goes there, and kept.'));
    }
    me.append(h('div', { class: 'note' }, `Started from ${w.base === 'sea' ? 'open sea (the three islands only)' : 'the game\'s world'}. The dashed rings are the storm: inside it are the lived-in seas (realms, towns and stories only come to land in there).`),
      h('div', { class: 'row', style: { marginTop: '6px', flexWrap: 'wrap' } },
        button('Wipe all paint', { icon: 'eraser', small: true, kind: 'ghost', onClick: async () => {
          if (await confirm('Wipe all paint?', 'All land, sea, biomes and town zones painted on this map go (Undo brings them back).', { yes: 'Wipe it' })) this.set((ww) => (ww.paint = { land: '', biome: '', legend: [], town: '' }));
        } }),
        button('Lands back as the game has them', { icon: 'undo', small: true, kind: 'ghost', onClick: () => this.set((ww) => (ww.lands = gameLands(ww.base))) })));
    body.append(panel('The map', me, { key: 'wo-map' }));
    this.insp.append(body);
    body.scrollTop = keep;
  }

  landBody(L) {
    const app = this.app;
    const keep3 = ['thessa', 'kharos', 'myrrow'].includes(L.key);
    const game = LANDMASSES.find((q) => q.key === L.key);
    const el = h('div');
    const set = (fn, side = false) => this.set((w) => fn(w.lands.find((q) => q.key === L.key)), { side });
    el.append(
      field('Name', textInput({ value: L.name, max: 32, onChange: (v) => set((q) => (q.name = v.trim() || q.name), true) })),
      keep3 ? h('div', { class: 'note' }, 'One of the three islands: lived in, always there (the game\'s stories need it).') : field('Is', select(Object.entries(KIND_NAMES), L.kind || 'isle', (v) => set((q) => (q.kind = v), true)), { tip: 'Lived in: realms, towns and the like come to it (only inside the storm). Wild: land and biomes.' }),
      check('Its own round shape', L.blob !== false, (v) => set((q) => (q.blob = v)), { tip: 'Off: it\'s only what\'s painted as its.' }),
      field('Across', slider({ value: L.rx, min: 0.5, max: 120, step: 0.5, onChange: (v) => set((q) => (q.rx = v)) }), { tip: 'Half its width, in map squares (or drag its east handle).' }),
      field('Down', slider({ value: L.rz, min: 0.5, max: 90, step: 0.5, onChange: (v) => set((q) => (q.rz = v)) }), { tip: 'Half its height, in map squares (or drag its south handle).' }),
      field('Ragged coast', slider({ value: Math.round((L.rough ?? 0.3) * 100), min: 0, max: 90, int: true, onChange: (v) => set((q) => (q.rough = v / 100)) })),
      field('Climate', select(Object.entries(CLIMATES), L.climate || '', (v) => set((q) => {
        if (v) q.climate = v;
        else delete q.climate;
      }))),
      field('Biomes it takes', chips(biomeOptions(app), L.allow || [], (v) => set((q) => {
        if (v.length) q.allow = v;
        else delete q.allow;
      })), { wide: true, tip: 'None chosen: what the game would put there (and the mod\'s biomes, where they grow). Chosen: only these; elsewhere the nearest of them in climate.' }));
    if (L.kind === 'dagoni') {
      const nums = [['civs', 'Realms', 8], ['towns', 'Towns', 12], ['villages', 'Villages', 24], ['rivers', 'Rivers', 16], ['lakes', 'Lakes', 12], ['dungeons', 'Old places', 24]];
      for (const [k, label, max] of nums) el.append(field(label, slider({ value: L[k] ?? (game ? game[k] : 1) ?? 1, min: 0, max, int: true, onChange: (v) => set((q) => (q[k] = v)) })));
    }
    el.append(h('div', { class: 'row', style: { marginTop: '6px' } }, button('Go to it', { icon: 'target', small: true, onClick: () => {
      this.cam = { x: L.cx + 0.5, z: L.cz + 0.5 };
      this.paint();
    } }), keep3 ? null : button('Delete it', { icon: 'trash', small: true, kind: 'ghost', onClick: () => this.deleteSel() })));
    return el;
  }

  placeBody(p) {
    const app = this.app;
    const t = app.mod[p.kind] && app.mod[p.kind][p.ref];
    const el = h('div');
    el.append(h('div', { class: 'row' }, h('span', { class: 'thumb', style: { width: '24px' } }, t ? app.thumb(p.kind, p.ref) : ic('warn')), h('b', { class: 'grow' }, t ? t.name : '(gone)'), t ? button('Open', { icon: 'next', small: true, onClick: () => app.open(p.kind, p.ref) }) : null),
      h('div', { class: 'note', style: { margin: '6px 0' } }, `At map square ${p.cx}, ${p.cz}: built there in every world made with the mod (as well as wherever its own settings put it). Drag it to move it.`),
      h('div', { class: 'row', style: { flexWrap: 'wrap' } },
        button('Begin here (an origin)', { icon: 'bust', small: true, title: 'An origin on the character screen: new characters who choose it begin by this place', onClick: () => app.tool3('chargen', (cg) => cg.addOriginAt(p.id, t ? t.name : 'the place')) }),
        button('Take it away', { icon: 'trash', small: true, kind: 'ghost', onClick: () => this.deleteSel() })));
    return el;
  }

  personBody(p) {
    const app = this.app;
    const w = this.w;
    const e = app.mod.entities[String(p.ent).slice(1)];
    const set = (fn, side = true) => this.set((ww) => fn(ww.people.find((q) => q.id === p.id)), { side });
    const el = h('div');
    el.append(h('div', { class: 'row' }, h('span', { class: 'thumb', style: { width: '24px' } }, e ? app.thumb('entities', String(p.ent).slice(1)) : ic('warn')), h('b', { class: 'grow' }, e ? e.name : '(gone)'), e ? button('Open', { icon: 'next', small: true, onClick: () => app.open('entities', String(p.ent).slice(1)) }) : null),
      field('Lives', select([['', 'Where it\'s set on the map'], ...w.realms.map((R) => [R.id, `In ${R.name}`])], p.realm || '', (v) => set((q) => (q.realm = v || null)))));
    if (p.realm) el.append(field('Where', seg([['capital', 'Its capital'], ['any', 'One of its towns']], p.home || 'capital', (v) => set((q) => (q.home = v)))));
    el.append(h('div', { class: 'note', style: { margin: '6px 0' } }, p.realm ? 'They\'re about the place when someone comes near (and back each time, unless killed).' : `At map square ${p.cx}, ${p.cz}; about the place when someone comes near. Drag them to move them.`),
      button('Take them away', { icon: 'trash', small: true, kind: 'ghost', onClick: () => this.deleteSel() }));
    return el;
  }

  realmBody(R) {
    const app = this.app;
    const w = this.w;
    const set = (fn, side = false) => this.set((ww) => fn(ww.realms.find((q) => q.id === R.id)), { side });
    const el = h('div');
    const civ = this.ow && this.ow.civs.find((c) => c.planRealm === R.id);
    el.append(
      field('Name', textInput({ value: R.name, max: 40, onChange: (v) => set((q) => (q.name = v.trim() || q.name), true) })),
      field('People', select(STYLES.map((k) => [k, CULTURES[k] ? CULTURES[k].label : k]), R.style || 'vale', (v) => set((q) => (q.style = v))), { tip: 'Whose realm it is: their buildings, their names, their ways.' }),
      field('Colour', h('div', { class: 'row', style: { gap: '3px' } }, ...CIV_COLORS.map((c, i) => {
        const b = h('span', { class: 'swatch-btn', style: { background: c.hex, width: '22px', height: '22px', outline: i === R.color ? '2px solid #ffd84a' : 'none' }, 'data-tip': c.name });
        b.addEventListener('click', () => set((q) => (q.color = i), true));
        return b;
      }))),
      field('It values', chips(VALUES.map((v) => [v, v]), R.values || [], (v) => set((q) => (q.values = v.slice(-2)), true)), { wide: true, tip: 'Two at most (none chosen: as its people do).' }),
      h('div', { class: 'note', style: { margin: '6px 0' } }, civ ? `Founded: its capital is ${this.ow.settlements[civ.capital].name}${this.ow.settlements.filter((s) => s.civ === civ).length > 1 ? `, with ${this.ow.settlements.filter((s) => s.civ === civ).length - 1} more towns` : ''}.` : 'Not founded in this world: is it on a lived-in island, with room for a city?'),
      h('div', { class: 'note' }, h('b', null, 'Its people: '), 'drag someone from the explorer onto its flag, or set someone down and choose it under "Lives".'));
    const folk = w.people.filter((p) => p.realm === R.id);
    for (const p of folk) {
      const e = app.mod.entities[String(p.ent).slice(1)];
      el.append(h('div', { class: 'row' }, ic('person', 11), h('span', { class: 'grow' }, e ? e.name : '(gone)'), h('span', { class: 'note' }, p.home === 'any' ? 'a town' : 'capital')));
    }
    el.append(h('div', { class: 'row', style: { marginTop: '6px' } }, button('Someone of it', { icon: 'person', small: true, onClick: (ev) => pickRef(app, 'creature', ev.currentTarget, (v) => v && this.addPerson(v, R.cx, R.cz, R.id)) }), button('Take it away', { icon: 'trash', small: true, kind: 'ghost', onClick: () => this.deleteSel() })));
    return el;
  }
}

// Whose buildings a realm founded on a biome has (as the game's would).
function styleFor(b) {
  const m = { plains: 'vale', forest: 'vale', beach: 'vale', taiga: 'north', tundra: 'north', desert: 'sun', savanna: 'sun', jungle: 'wild', swamp: 'wild', mountain: 'high', ashland: 'ember', cinderwood: 'ember', geyser: 'ember', mangrove: 'tide', fungal: 'mist', moor: 'mist' };
  return m[b] || 'vale';
}
