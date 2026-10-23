// The world map (M): the whole world, from the Dagoni Islands inside their
// storm out to the continents beyond it. The wheel (or + and -) zooms in
// and out; drag it, or hold W, A, S and D (or the arrows), to move about;
// Space brings it back to you.
//   Close in, every map square is two of the old glyphs (forest, hills,
//   rivers...) with the towns, roads and old places on them. Further out
//   the squares condense to little tiles of their land, and further still
//   to a single dot of colour each, so the whole world fits: the islands,
//   the ring of the storm round them, and the far lands no one from the
//   islands has seen (only their outlines, from the old charts).
import { shapeWords } from '../world/shapes.js';
import { COLS, ROWS, MAP_W, MAP_H, REGION_W, REGION_D, CHAR_W, CHAR_H } from '../config.js';
import { Window, cap } from './window.js';
import { C } from './ascii.js';
import { BIOMES } from '../world/biomes.js';
import { dtypeOf } from '../world/dungeongen.js';
import { STORM, ARCHIPELAGO } from '../world/geography.js';
import { drawGlyph, drawText, glyphBitmap } from '../render/font.js';
import { GUILD_NAMES, HAVEN_MAP } from '../world/havenkit.js';
import { voyagesNow } from '../game/shipfleets.js';
import { teleportTo } from '../game/commands.js';
import { settlementIcons, roadCellLinks } from './windows.js';
import { planFor, seenOf, cellSeen, GROUND_COLOR, buildingLook, kindOf, CELL } from '../game/townmap.js';
import { lookOf, kindLook, paintTile, shade } from './townlook.js';

// Pixels across a map square at each step of the zoom (a square is two
// thirds as tall as it is wide, like two characters side by side).
export const ZOOMS = [1.4, 3, 4.5, 6, 9, 12, 24];
const HOME_ZOOM = 5; // 12: the old map's scale
const GLYPHS_FROM = 12; // close enough to draw the glyphs
const TIER_FROM = 6; // (Round 128) close enough for an old place's tier to show
const TILES_FROM = 6; // ...or condensed tiles of them

// How a square is shown at a zoom (pixels a square): 'glyphs' close up
// (the map's own characters), 'tiles' a little further out (each glyph
// squeezed into its square), 'dots' furthest (a dot of its colour).
export function mapMode(z) {
  return z >= GLYPHS_FROM ? 'glyphs' : z >= TILES_FROM ? 'tiles' : 'dots';
}
const OLD_PLACE_GLYPH = { barrow: '∩', mine: '¥', crypt: '▼', holdout: 'Ω', kavorent: '║', grove: '♣', forge: '♨', grotto: 'Ψ', catacomb: '†', vault: '⌂', gut: '§', saltworks: '◊', warren: '◎', mound: '∆', broch: '♜', athanor: '✦', champion: '‖', rift: '∴', gullet: '●' };
const LAKE = '#2a5a9a';
// (Round 143) The town map's zoom steps (pixels a tile), and how its ground
// plan's kinds of ground look where there's nothing better to go on (a
// plan from before 1.43).
const TOWN_ZOOMS = [1, 2, 3, 4, 6, 8, 12, 16];
const MASK_KIND = { 0: 'ground', 1: 'pave', 2: 'roof', 3: 'water', 4: 'field', 5: 'pave', 6: 'ground', 7: 'wall', 8: 'pave', 9: 'tree' };

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRgb(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t));
}
function shadeHex(hex, f) {
  const [r, g, b] = hexRgb(hex);
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

// One dot's colour for a square of each kind of land.
const DOT = {};
function dotColour(biome) {
  if (DOT[biome]) return DOT[biome];
  if (biome === 'lake') return (DOT[biome] = hexRgb(LAKE));
  const B = BIOMES[biome] || BIOMES.ocean;
  return (DOT[biome] = mixRgb(hexRgb(B.bg), hexRgb(B.fg), biome === 'ocean' ? 0.12 : 0.32));
}

// ------------------------------------------------------------ the whole world
// The world a pixel a square (worked out a few rows a frame the first time
// the map is opened, then kept), and over it the fog of what you haven't
// seen: dark inside the storm, and outside it the old charts' outlines of
// the far lands.
function worldCache(ow) {
  // (Made again once the storm's gone: its grey water with it.)
  if (ow._mapCache && ow._mapCache.wallDown === !!ow.wallDown) return ow._mapCache;
  const make = (w, h) => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };
  const base = make(MAP_W, MAP_H);
  const fog = make(MAP_W, MAP_H);
  ow._mapCache = {
    base, fog, row: 0, biome: new Array(MAP_W * MAP_H),
    img: base ? base.getContext('2d').createImageData(MAP_W, MAP_H) : null,
    fogN: -1, fogReveal: null, wallDown: !!ow.wallDown,
  };
  return ow._mapCache;
}

// Work out more of it (up to `rows` rows). True once it's all done.
function fillWorld(ow, rows = 12) {
  const M = worldCache(ow);
  if (M.row >= MAP_H) return true;
  const end = Math.min(MAP_H, M.row + rows);
  for (let cz = M.row; cz < end; cz++) {
    for (let cx = 0; cx < MAP_W; cx++) {
      const b = ow.mapBiome(cx, cz);
      const i = cz * MAP_W + cx;
      M.biome[i] = b;
      if (!M.img) continue;
      let c = dotColour(b);
      // (Rivers show as a bluer square; the storm's own water churns grey.)
      const cell = ow.cells[i];
      if (cell && cell.river && b !== 'ocean') c = mixRgb(c, hexRgb('#5fa8e8'), 0.35);
      if (b === 'ocean' && cell && cell.storm > 0 && !ow.wallDown) c = mixRgb(c, [120, 130, 150], cell.storm * 0.5);
      M.img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
  }
  M.row = end;
  if (M.base) M.base.getContext('2d').putImageData(M.img, 0, 0);
  M.fogN = -1;
  return M.row >= MAP_H;
}

function refreshFog(ow, reveal) {
  const M = worldCache(ow);
  if (!M.fog) return;
  const n = ow.exploredN || 0;
  // (Another's map, drawn here: see game/party.js.)
  if (M.fogN === n && M.fogReveal === reveal && M.fogRow === M.row && M.fogOf === ow.explored) return;
  M.fogN = n;
  M.fogOf = ow.explored;
  M.fogReveal = reveal;
  M.fogRow = M.row;
  const ctx = M.fog.getContext('2d');
  const img = ctx.createImageData(MAP_W, MAP_H);
  const d = img.data;
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    if (reveal || ow.explored[i]) continue;
    const cx = i % MAP_W;
    const cz = Math.floor(i / MAP_W);
    const b = M.biome[i];
    const inside = ow.insideStorm((cx + 0.5) * REGION_W, (cz + 0.5) * REGION_D);
    let c;
    if (inside) c = [22, 20, 30];
    else if (b && b !== 'ocean') c = [58, 49, 40]; // (the old charts' far lands)
    else c = [12, 12, 20];
    d.set([c[0], c[1], c[2], 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
}

// A condensed tile of a biome's glyph (`w` by `h` pixels): its ground, and
// its glyph squeezed down onto it.
const TILE_CACHE = new Map();
function biomeTile(biome, w, h) {
  const key = `${biome}:${w}:${h}`;
  let t = TILE_CACHE.get(key);
  if (t) return t;
  if (typeof document === 'undefined') return null;
  t = document.createElement('canvas');
  t.width = w;
  t.height = h;
  const ctx = t.getContext('2d');
  const B = biome === 'lake' ? { char: '≈', fg: '#80c8ff', bg: '#1a4a8a' } : BIOMES[biome] || BIOMES.ocean;
  ctx.fillStyle = B.bg;
  ctx.fillRect(0, 0, w, h);
  const bm = glyphBitmap(B.char);
  ctx.fillStyle = B.fg;
  // (The glyph's 6x8 pixels sampled down to the tile.)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = Math.floor((x / w) * CHAR_W);
      const gy = Math.floor((y / h) * CHAR_H);
      if (bm[gy * CHAR_W + gx]) ctx.fillRect(x, y, 1, 1);
    }
  }
  TILE_CACHE.set(key, t);
  return t;
}

// The storm's clouds: puffs scattered round the ring in three layers (dark
// below, greyer above, a few pale tops), each drifting at its own pace.
let PUFFS = null;
function stormPuffs() {
  if (PUFFS) return PUFFS;
  let seed = 9173;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  PUFFS = [0, 1, 2].map((layer) => {
    const n = [190, 150, 70][layer];
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        a: rnd() * Math.PI * 2,
        off: layer === 0 ? -0.4 + rnd() * 1.8 : layer === 1 ? -0.2 + rnd() * 1.4 : 0.1 + rnd() * 0.8,
        size: [2.6, 1.9, 1.2][layer] * (0.7 + rnd() * 0.7),
        spin: (layer % 2 ? 1 : -1) * (0.002 + rnd() * 0.004),
        alpha: [0.92, 0.75, 0.5][layer] * (0.7 + rnd() * 0.3),
        ph: rnd() * 6,
      });
    }
    return out;
  });
  return PUFFS;
}

// A soft round puff of cloud (or, 3, of light), drawn once.
const PUFF_IMG = [];
function puffImage(kind) {
  if (PUFF_IMG[kind]) return PUFF_IMG[kind];
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(24, 22, 2, 24, 24, 24);
  const [r, gg, b] = [[22, 24, 32], [44, 48, 60], [96, 102, 118], [200, 215, 255]][kind];
  grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grd.addColorStop(0.55, `rgba(${r},${gg},${b},0.75)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 48, 48);
  PUFF_IMG[kind] = c;
  return c;
}

// (Round 73) A quest's marker (from the quest log), and an arrowhead.
export const isQuestPin = (q) => !!(q && (q.quest || q.glyph === '!'));
function arrowHead(ctx, x, y, ux, uy, r, col) {
  const px = -uy;
  const py = ux;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x + ux * r, y + uy * r);
  ctx.lineTo(x - ux * r * 0.6 + px * r * 0.7, y - uy * r * 0.6 + py * r * 0.7);
  ctx.lineTo(x - ux * r * 0.2, y - uy * r * 0.2);
  ctx.lineTo(x - ux * r * 0.6 - px * r * 0.7, y - uy * r * 0.6 - py * r * 0.7);
  ctx.closePath();
  ctx.fill();
}
const LIST_W = 22;
const MARK_FG = '#80ffc0';
const LANDMARK_WORD = { tree: 'a giant fallen tree', bones: 'old bones', crater: 'a crater', arch: 'a stone arch', spring: 'a hot spring' };

// (Round 79) A marker of your own put down at (x, z), named in turn.
export function addMark(game, x, z, label = null) {
  const marks = (game.mapMarks ||= []);
  const m = { x: Math.round(x), z: Math.round(z), label: label || `Marker ${marks.length + 1}`, named: !!label };
  marks.push(m);
  if (marks.length > 60) marks.shift();
  return m;
}

// (Round 117) Each tier's badge on the map: bronze, silver, gold.
export const TIER_BADGE = ['', '#c8844a', '#d8e0ec', '#ffd040'];

export class MapWindow extends Window {
  constructor(ui) {
    super(ui, COLS - 2, ROWS - 2, { kind: 'map' });
    this.civView = false;
    this.zi = HOME_ZOOM;
    this.z = ZOOMS[this.zi];
    const game = ui.game;
    const p = game ? (game.mapPos ? game.mapPos() : game.player) : null;
    this.cam = p ? { x: p.x / REGION_W, z: p.z / REGION_D } : { x: STORM.cx, z: STORM.cz };
    this.goal = { ...this.cam };
    this.drag = null;
    this.hoverSq = null;
    // (Round 73) The list down the right: open, what's searched for, how
    // far it's scrolled.
    this.listOpen = true;
    // (Round 74: how far out it's slid, in columns, easing toward open or
    // shut.)
    this.listW = LIST_W;
    this.search = '';
    this.searching = false;
    this.listScroll = 0;
    // (Round 79) A marker of your own being named (typed into).
    this.naming = null;
    // (Round 142) Which page: the world, or the town you're in (its own
    // map, of the parts you've been near: see game/townmap.js); and that
    // map's view (where it's centred, in the town's tiles; how close in).
    this.tab = 'world';
    this.tcam = null;
    this.tz = 0;
    this.townHover = null;
    this.townPick = null;
  }

  // (Round 142) The town you're in, if any (its map's tab is only there
  // while you are).
  townHere(game) {
    return game && !game.dungeon && game.currentSettlement ? game.currentSettlement : null;
  }

  goTab(tab) {
    if (this.tab === tab) return;
    this.tab = tab;
    this.drag = null;
    this.searching = false;
    this.listScroll = 0;
    this.ui.audio?.play('page');
  }

  // The map's area on screen, in pixels.
  area() {
    return { x0: (this.x + 1) * CHAR_W, y0: (this.y + 1) * CHAR_H, x1: (this.x + this.w - 1 - this.listCols()) * CHAR_W, y1: (this.y + this.h - 4) * CHAR_H };
  }

  // How many columns the list (or its tab, shut) takes up just now.
  listCols() {
    return Math.max(2, Math.round(this.listW ?? (this.listOpen ? LIST_W : 0)));
  }

  // Pixels per square, across and down.
  sq() {
    return { w: this.z, h: (this.z * 2) / 3 };
  }

  // Where the map's top-left corner (square 0, 0) is on screen (snapped to
  // whole pixels, so the squares line up).
  origin() {
    const a = this.area();
    const { w, h } = this.sq();
    return { x: Math.round((a.x0 + a.x1) / 2 - this.cam.x * w), y: Math.round((a.y0 + a.y1) / 2 - this.cam.z * h) };
  }

  // A world position (tiles) on screen.
  at(x, z) {
    const o = this.origin();
    const { w, h } = this.sq();
    return { x: o.x + (x / REGION_W) * w, y: o.y + (z / REGION_D) * h };
  }

  // The square under a screen pixel.
  squareAt(px, py) {
    const a = this.area();
    if (px < a.x0 || px >= a.x1 || py < a.y0 || py >= a.y1) return null;
    const o = this.origin();
    const { w, h } = this.sq();
    const cx = Math.floor((px - o.x) / w);
    const cz = Math.floor((py - o.y) / h);
    if (cx < 0 || cz < 0 || cx >= MAP_W || cz >= MAP_H) return null;
    // (Close in, a square shows as two glyphs, its west half and its east:
    // the one under the pointer.)
    const hf = mapMode(this.z) === 'glyphs' ? ((px - o.x) / w - cx >= 0.5 ? 1 : 0) : null;
    return { cx, cz, hf };
  }

  zoomTo(zi, mx = null, my = null) {
    zi = Math.max(0, Math.min(ZOOMS.length - 1, zi));
    if (zi === this.zi) return;
    // (Toward the mouse: what's under it stays under it.)
    const a = this.area();
    const before = mx !== null ? { x: this.cam.x + (mx - (a.x0 + a.x1) / 2) / this.z, z: this.cam.z + (my - (a.y0 + a.y1) / 2) / ((this.z * 2) / 3) } : null;
    this.zi = zi;
    this.z = ZOOMS[zi];
    if (before) {
      this.cam.x = before.x - (mx - (a.x0 + a.x1) / 2) / this.z;
      this.cam.z = before.z - (my - (a.y0 + a.y1) / 2) / ((this.z * 2) / 3);
      this.goal = { ...this.cam };
    }
    this.clampCam();
  }

  // Keep the world in the window: no panning off past its edges, and far
  // enough out to see all of it, it sits in the middle.
  clampCam() {
    const a = this.area();
    const { w, h } = this.sq();
    const hw = (a.x1 - a.x0) / 2 / w;
    const hh = (a.y1 - a.y0) / 2 / h;
    const fit = (v, half, size) => (size <= half * 2 ? size / 2 : Math.max(half, Math.min(size - half, v)));
    for (const c of [this.cam, this.goal]) {
      c.x = fit(c.x, hw, MAP_W);
      c.z = fit(c.z, hh, MAP_H);
    }
  }

  update(dt) {
    const game = this.ui.game;
    if (game) fillWorld(game.world.ow, 16);
    // Held keys move the map (a screen's half a second, whatever the zoom).
    const inp = this.ui.input;
    if (inp && inp.isDown) {
      const a = this.area();
      const sp = (((a.x1 - a.x0) * 0.9) / this.z) * dt;
      const k = (...c) => c.some((q) => inp.isDown(q));
      if (k('KeyA', 'ArrowLeft')) this.goal.x -= sp;
      if (k('KeyD', 'ArrowRight')) this.goal.x += sp;
      if (k('KeyW', 'ArrowUp')) this.goal.z -= sp * 1.5;
      if (k('KeyS', 'ArrowDown')) this.goal.z += sp * 1.5;
    }
    // (Round 142) The town's map: dragged and moved about on its own.
    if (this.tab === 'civ') {
      this.updateTown(dt, inp);
      return;
    }
    const m = this.ui.mouse;
    if (m && m.down && this.drag) {
      const dx = m.x - this.drag.x;
      const dy = m.y - this.drag.y;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(dx) + Math.abs(dy));
      this.goal.x = this.drag.cx - dx / this.z;
      this.goal.z = this.drag.cz - dy / ((this.z * 2) / 3);
      this.cam.x = this.goal.x;
      this.cam.z = this.goal.z;
    } else if (m && !m.down && this.drag) {
      if (this.drag.moved < 4) this.clicked(m.x, m.y);
      this.drag = null;
    }
    // (The list sliding out or in.)
    const want = this.listOpen ? LIST_W : 0;
    this.listW += (want - this.listW) * Math.min(1, dt * 14);
    if (Math.abs(want - this.listW) < 0.3) this.listW = want;
    const e = Math.min(1, dt * 12);
    this.cam.x += (this.goal.x - this.cam.x) * e;
    this.cam.z += (this.goal.z - this.cam.z) * e;
    this.clampCam();
  }

  onClick(ck, cx, cy, game) {
    // (The list's own buttons first: its entries, its search, its tab.)
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (cx >= h.x && cy >= h.y && cx < h.x + h.w && cy < h.y + h.h) {
        h.fn(ck, game, cx, cy);
        return true;
      }
    }
    this.searching = false;
    this.naming = null;
    const a = this.area();
    const inMap = ck.x >= a.x0 && ck.x < a.x1 && ck.y >= a.y0 && ck.y < a.y1;
    if (this.tab === 'civ') {
      if (ck.button === 0 && inMap && this.tcam) this.drag = { x: ck.x, y: ck.y, cx: this.tcam.x, cz: this.tcam.z, moved: 0 };
      return true;
    }
    if (ck.button === 0 && inMap) this.drag = { x: ck.x, y: ck.y, cx: this.cam.x, cz: this.cam.z, moved: 0 };
    // (Round 79) Right-click: a marker of your own put down there (or the
    // one there taken up).
    else if (ck.button === 2 && inMap && game) this.toggleMark(game, ck.x, ck.y);
    return true;
  }

  // (Round 79) Your own markers: put one down at a spot on the map (and
  // name it, typing), or take up the one in that square.
  toggleMark(game, px, py) {
    const q = this.squareAt(px, py);
    if (!q) return null;
    const marks = (game.mapMarks ||= []);
    const i = marks.findIndex((m) => Math.floor(m.x / REGION_W) === q.cx && Math.floor(m.z / REGION_D) === q.cz);
    if (i >= 0) {
      const [gone] = marks.splice(i, 1);
      this.ui.msg(`Marker "${gone.label}" taken off the map.`, '#c8c8c8');
      this.ui.audio?.play('page');
      return null;
    }
    const o = this.origin();
    const half = q.hf !== null ? q.hf === 1 : (px - o.x) / this.z - q.cx >= 0.5;
    const m = addMark(game, q.cx * REGION_W + (half ? REGION_W * 0.75 : REGION_W * 0.25), q.cz * REGION_D + REGION_D / 2);
    this.naming = m;
    this.listOpen = true;
    this.ui.audio?.play('select');
    return m;
  }

  onWheel(d) {
    const m = this.ui.mouse;
    if (this.listOpen && m && m.x >= (this.x + this.w - 1 - this.listCols()) * CHAR_W) {
      this.listScroll = Math.max(0, this.listScroll + (d > 0 ? 3 : -3));
      return;
    }
    if (this.tab === 'civ') {
      this.zoomTown(d > 0 ? -1 : 1);
      return;
    }
    this.zoomTo(this.zi + (d > 0 ? -1 : 1), m ? m.x : null, m ? m.y : null);
  }

  onKey(k) {
    const game = this.ui.game;
    // (Round 79) Naming a marker just put down.
    if (this.naming) {
      const m = this.naming;
      if (k.code === 'Escape' || k.code === 'Enter') {
        if (!m.label.trim()) m.label = `Marker ${(game.mapMarks || []).indexOf(m) + 1}`;
        this.naming = null;
      } else if (k.code === 'Backspace') m.label = m.named ? m.label.slice(0, -1) : '';
      else if (k.key && k.key.length === 1 && (m.named ? m.label.length : 0) < 20) {
        m.label = m.named ? m.label + k.key : k.key;
        m.named = true;
      }
      if (k.code === 'Backspace') m.named = true;
      return true;
    }
    // (Typing into the list's search.)
    if (this.searching) {
      if (k.code === 'Escape' || k.code === 'Enter') this.searching = false;
      else if (k.code === 'Backspace') this.search = this.search.slice(0, -1);
      else if (k.key && k.key.length === 1 && this.search.length < 22) this.search += k.key;
      this.listScroll = 0;
      return true;
    }
    if (k.code === 'Tab') {
      this.listOpen = !this.listOpen;
      return true;
    }
    if (k.code === 'Slash' && this.listOpen) {
      this.searching = true;
      return true;
    }
    // (Round 142) The pages: 1 the world, 2 the town you're in. (Only the
    // world map's own: not the coach's, which is drawn on it.)
    if (k.code === 'Digit1' && this.kind === 'map') {
      this.goTab('world');
      return true;
    }
    if (k.code === 'Digit2' && this.kind === 'map' && this.townHere(game)) {
      this.goTab('civ');
      return true;
    }
    if (this.tab === 'civ') {
      if (k.code === 'Equal' || k.code === 'NumpadAdd') this.zoomTown(1);
      else if (k.code === 'Minus' || k.code === 'NumpadSubtract') this.zoomTown(-1);
      else if (k.code === 'Space' || k.code === 'Home') this.tcam = null;
      else if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k.code)) return false;
      return true;
    }
    if (k.code === 'KeyV') this.civView = !this.civView;
    else if (k.code === 'Equal' || k.code === 'NumpadAdd') this.zoomTo(this.zi + 1);
    else if (k.code === 'Minus' || k.code === 'NumpadSubtract') this.zoomTo(this.zi - 1);
    else if (k.code === 'Space' || k.code === 'Home') {
      const p = game ? (game.mapPos ? game.mapPos() : game.player) : null;
      if (p) this.goal = { x: p.x / REGION_W, z: p.z / REGION_D };
    } else if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k.code)) return true;
    else return false;
    return true;
  }

  // A click that didn't drag: with map teleport on (the command console),
  // it takes you there.
  clicked(px, py) {
    const game = this.ui.game;
    if (!game || !game.cheats?.mapTeleport) return;
    const q = this.squareAt(px, py);
    if (!q) return;
    const ow = game.world.ow;
    if (!ow.explored[q.cz * MAP_W + q.cx] && !game.revealMap) {
      this.ui.msg('You can only teleport to places you have seen (or "reveal" the map).', '#ff9060');
      return;
    }
    const cell = ow.cell(q.cx, q.cz);
    if (cell && cell.biome === 'ocean') {
      this.ui.msg('That\'s the open sea.', '#ff9060');
      return;
    }
    const icon = settlementIcons(game).get(q.cz * 10000 + q.cx);
    const s = icon ? icon.s : null;
    const L = s ? game.sim.layoutOf(s.id) : null;
    const o = this.origin();
    const half = q.hf !== null ? q.hf === 1 : (px - o.x) / this.z - q.cx >= 0.5;
    const x = L && L.plaza ? L.plaza.cx : q.cx * REGION_W + (half ? REGION_W * 0.75 : REGION_W * 0.25);
    const z = L && L.plaza ? L.plaza.cz + 3 : q.cz * REGION_D + REGION_D / 2;
    // (In someone else's world: the host moves you, as a command.)
    if (game.remote && game.remote.command) {
      game.remote.command(`tp ${Math.round(x)} ${Math.round(z)}`);
      this.ui.msg(s ? `Off to ${s.name}...` : 'Off you go...', '#c8d8ff');
      this.close();
      return;
    }
    teleportTo(game, x, z);
    this.ui.msg(s ? `Teleported to ${s.name}.` : 'Teleported.', '#c8d8ff');
    this.close();
  }

  // What's at a square, in words.
  describe(game, cx, cz, hf = null) {
    const ow = game.world.ow;
    const known = ow.explored[cz * MAP_W + cx] || game.revealMap;
    const x = (cx + (hf === null ? 0.5 : hf ? 0.75 : 0.25)) * REGION_W;
    const z = (cz + 0.5) * REGION_D;
    const L = ow.landAt(x, z);
    const onLand = L && ow.continentAt(x, z) >= 0;
    const storm = ow.stormAt(x, z);
    if (!known) {
      if (onLand && L.kind !== 'dagoni') return { line: `${cap(L.name)}: ${L.about}${shapeWords(L) ? `, ${shapeWords(L)}` : ''}. Beyond the storm: only on the old charts.`, color: '#c8a878' };
      if (storm > 0) return { line: 'The storm: a wall of wind and wild water round the islands. No raft gets through it.', color: '#a0b8d0' };
      return { line: ow.insideStorm(x, z) ? 'Unexplored' : 'The open sea beyond the storm, never sailed.', color: C.dim };
    }
    const cell = ow.cell(cx, cz);
    const here = hf !== null && cell.halves ? cell.halves[hf] : cell.biome;
    let info = BIOMES[here]?.name || cap(here);
    if (onLand) {
      // (Round 84) And which of a great continent's provinces.
      const pv = ow.provinceAt ? ow.provinceAt(x, z) : null;
      info = `${cap(L.name)}${pv ? ` · ${cap(pv.p.name)}` : ''} · ${info}`;
    }
    else if (storm > 0) info = 'The storm · wild water no raft gets through';
    else if (cell.biome === 'ocean') info = ow.insideStorm(x, z) ? `The sea between ${ARCHIPELAGO}` : 'The open sea';
    if (cell.river && hf !== 0) info += ' · river';
    if (cell.lake) info += ' · lake';
    if (cell.bridge) info += ' · a bridge across the strait';
    const V = ow.volcano;
    if (V && cx === V.cx && cz === V.cz) info += ' · the Sleeper (the mountain of fire)';
    return { line: info, color: C.hi, cell };
  }

  draw(g, game) {
    const town = this.townHere(game);
    if (this.tab === 'civ' && !town) this.tab = 'world';
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true });
    // (Round 142) Its pages, as tabs along the top: the world, and the town
    // you're in (only while you're in one).
    this.drawTabs(g, town);
    // (The map itself is drawn in pixels over this: see drawPixels.)
    for (let y = 1; y < this.h - 4; y++) g.text(1, y, ' '.repeat(this.w - 2), '#000000', '#08080e');
    if (!game) return;
    if (this.tab === 'civ') {
      this.drawTownWords(g, game, town);
      this.drawList(g, game);
      return;
    }
    const ow = game.world.ow;
    const m = this.ui.mouse;
    const q = m ? this.squareAt(m.x, m.y) : null;
    this.hoverSq = q;
    const y0 = this.h - 4;
    const W = this.w - 3; // (to the border)
    const put = (y, text, color) => g.text(2, y, text.slice(0, W).padEnd(W), color);
    if (q) {
      const d = this.describe(game, q.cx, q.cz, q.hf);
      const icon = (this.icons || new Map()).get(q.cz * 10000 + q.cx);
      const mark = this.markAt(game, q.cx, q.cz);
      if (icon && (ow.explored[q.cz * MAP_W + q.cx] || game.revealMap)) {
        const s = icon.s;
        let info = `${s.name} · ${icon.haven ? (s.haven.razed ? 'A pirates\' haven, burned out' : `A pirates' haven of ${GUILD_NAMES[s.haven.guild] || 'the brethren'}`) : s.empire ? 'Imperial capital' : cap(s.type)} · ${s.condition} · ${BIOMES[s.biome]?.name || s.biome}${s.island ? ` · ${cap(ow.island(s.island)?.name || s.island)}` : ''}`;
        const L = game.world.layouts.get(s.id);
        const rd = L && L.econ && L.econ.raidedDay;
        if (rd !== undefined && rd !== null && game.day - rd <= 3) info += game.day === rd ? ' · raided today' : ` · raided ${game.day - rd} day${game.day - rd === 1 ? '' : 's'} ago`;
        put(y0, info, C.hi);
        put(y0 + 1, mark ? mark.label : s.civ ? `${s.civ.name} (${s.civ.people}; ${s.civ.values.join(', ')})` : 'Independent', mark ? mark.color || '#ff9080' : s.civ ? s.civ.color.hex : C.dim);
      } else {
        put(y0, d.line, d.color);
        if (mark) put(y0 + 1, mark.label, mark.color || '#ff9080');
        else if (d.cell && d.cell.civ !== null && ow.civs[d.cell.civ]) put(y0 + 1, `Territory of the ${ow.civs[d.cell.civ].name}`, ow.civs[d.cell.civ].color.hex);
        else put(y0 + 1, '', C.dim);
      }
    } else {
      put(y0, `Zoom ${Math.round((this.z / 12) * 100)}%`, C.dim);
      put(y0 + 1, 'Right-click the map to put down a marker of your own (again to take it up).', C.faint);
    }
    this.drawList(g, game);
    // (Round 77: no key, no legend; a button to switch between the land and
    // its realms.)
    const vt = ` ${this.civView ? 'Show the land' : 'Show the realms'} `;
    const vx = Math.max(1, this.w - vt.length - 2);
    const vh = this.hovering(vx, this.h - 1, vt.length, 1);
    g.text(vx, this.h - 1, vt, vh ? C.white : C.dim, vh ? '#3a2e1e' : undefined);
    this.hit(vx, this.h - 1, vt.length, 1, () => {
      this.civView = !this.civView;
      this.ui.audio?.play('select');
    });
  }

  // (Round 73) What's in the list: quest markers first, then the places
  // and old places you know, each marked if a quest's there.
  listEntries(game) {
    const ow = game.world.ow;
    const known = (x, z) => game.revealMap || ow.explored[Math.floor(z / REGION_D) * MAP_W + Math.floor(x / REGION_W)];
    const sq = (x, z) => `${Math.floor(x / REGION_W)},${Math.floor(z / REGION_D)}`;
    const quests = (ow.pins || []).filter(isQuestPin);
    const qsq = new Set(quests.map((q) => sq(q.x, q.z)));
    const out = [];
    for (const q of quests) out.push({ kind: 'quest', label: q.label, x: q.x, z: q.z, quest: true, color: '#ffd060' });
    // (Round 79) Your own markers.
    for (const m of game.mapMarks || []) out.push({ kind: 'mark', label: m.label, x: m.x, z: m.z, quest: false, color: MARK_FG, sub: 'marker', mark: m });
    const seen = new Set();
    for (const icon of settlementIcons(game).values()) {
      const s = icon.s;
      if (seen.has(s.id)) continue;
      const x = (s.cx + s.cw / 2) * REGION_W;
      const z = (s.cz + s.cd / 2) * REGION_D;
      if (!known(x, z)) continue;
      seen.add(s.id);
      out.push({ kind: 'place', label: s.name, x, z, quest: qsq.has(sq(x, z)), color: icon.haven ? '#e07060' : s.civ ? s.civ.color.hex : C.fg, sub: icon.haven ? 'pirates\' haven' : s.empire ? 'capital' : s.type });
    }
    // (Round 79) Landmarks found or told of.
    for (const q of ow.pins || []) if (q.landmark) out.push({ kind: 'landmark', label: q.label, x: q.x, z: q.z, quest: qsq.has(sq(q.x, q.z)), color: '#ffe8a0', sub: LANDMARK_WORD[q.kind] || 'landmark' });
    for (const d of game.sim.dungeons ? game.sim.dungeons.all : []) {
      if (!(d.known || d.seen || game.revealMap) || d.x === undefined) continue;
      out.push({ kind: 'old', label: cap(d.name), x: d.x, z: d.z, quest: qsq.has(sq(d.x, d.z)), color: d.cleared ? '#8a8478' : '#f0d8a0', sub: dtypeOf(d).name });
    }
    const f = this.search.trim().toLowerCase();
    const list = f ? out.filter((e) => e.label.toLowerCase().includes(f) || (e.sub || '').toLowerCase().includes(f)) : out;
    // (Quest-bound first within each kind.)
    const rank = { quest: 0, mark: 1, place: 2, landmark: 3, old: 4 };
    return list.sort((a, b) => rank[a.kind] - rank[b.kind] || b.quest - a.quest || (a.kind === 'mark' ? 0 : a.label.localeCompare(b.label)));
  }

  drawList(g, game) {
    const cols = this.listCols();
    const bx = this.w - 1 - cols;
    // The tab to open or close it (a book drawn on it: see drawListTab).
    const hovTab = this.hovering(bx, 1, 2, 3);
    this.tabHov = hovTab;
    for (let y = 1; y <= 3; y++) g.text(bx, y, '  ', C.hi, hovTab ? '#5a4628' : '#2a2016');
    this.tabAt = { x: bx, y: 1 };
    this.hit(bx, 1, 2, 3, () => {
      this.listOpen = !this.listOpen;
      if (!this.listOpen) this.searching = false;
      this.ui.audio?.play('page');
    });
    if (cols <= 3) return;
    const x = bx + 2;
    const W = cols - 2;
    const bottom = this.h - 5;
    for (let y = 1; y <= bottom; y++) g.text(x, y, ' '.repeat(W), C.fg, '#100c14');
    if (this.tab === 'civ') {
      this.drawTownList(g, game, x, W, bottom);
      return;
    }
    // The search.
    const sHov = this.hovering(x, 1, W, 1);
    const cur = this.searching && Math.floor((this.ui.time || 0) * 2) % 2 ? '_' : '';
    g.text(x, 1, ` ${this.search || (this.searching ? '' : 'search... (/)')}${cur}`.padEnd(W).slice(0, W), this.search || this.searching ? C.white : C.faint, this.searching ? '#3a2e1e' : sHov ? '#2a2418' : '#1c1620');
    this.hit(x, 1, W, 1, () => {
      this.searching = true;
    });
    const entries = this.listEntries(game);
    const rows = bottom - 2;
    this.listScroll = Math.max(0, Math.min(this.listScroll, Math.max(0, entries.length - rows)));
    let y = 3;
    let lastKind = null;
    for (let i = this.listScroll; i < entries.length && y <= bottom; i++) {
      const e = entries[i];
      if (e.kind !== lastKind) {
        lastKind = e.kind;
        g.text(x, y++, { quest: 'QUESTS', mark: 'MARKERS', place: 'PLACES', landmark: 'LANDMARKS', old: 'OLD PLACES', dest: 'THE COACH GOES TO' }[e.kind], C.dim);
        if (y > bottom) break;
      }
      const hov = this.hovering(x, y, W, 1);
      // (Round 79) A marker: ◆, the name (being typed, a cursor), and an x
      // to take it off the map; right-click it to name it again.
      const naming = e.mark && this.naming === e.mark;
      const cur = naming && Math.floor((this.ui.time || 0) * 2) % 2 ? '_' : '';
      const label = `${e.quest ? '! ' : e.mark ? '◆ ' : '  '}${e.label}${cur}`;
      g.text(x, y, label.padEnd(W).slice(0, W), hov || naming ? C.white : e.color, naming ? '#1e3a2e' : hov ? '#3a2e1e' : undefined);
      if (e.quest && Math.floor((this.ui.time || 0) * 3) % 2) g.text(x, y, '!', '#ffd040');
      this.hit(x, y, W, 1, (ck) => {
        if (e.mark && ck && ck.button === 2) {
          this.naming = e.mark;
          e.mark.named = false;
        } else this.goTo(e);
      });
      if (e.mark) {
        const xh = this.hovering(x + W - 2, y, 2, 1);
        g.text(x + W - 2, y, ' x', xh ? '#ff9080' : C.faint, xh ? '#3a1e1e' : undefined);
        this.hit(x + W - 2, y, 2, 1, (ck, game2) => {
          const list = (game2 || game).mapMarks || [];
          const i = list.indexOf(e.mark);
          if (i >= 0) list.splice(i, 1);
          if (this.naming === e.mark) this.naming = null;
          this.ui.audio?.play('page');
        });
      }
      y++;
    }
    if (!entries.length) g.text(x, 3, this.search ? '  nothing by that name' : '  nothing known yet', C.faint);
  }

  // Off to an entry in the list: the map moved there, and close in on it.
  goTo(e) {
    if (this.zi < 4) this.zoomTo(4);
    this.goal = { x: e.x / REGION_W, z: e.z / REGION_D };
    this.searching = false;
    this.ui.audio?.play('select');
  }

  // A battle, a raid, a camp or an old place at a square (for the words
  // under the map), from what was drawn last.
  markAt(game, cx, cz) {
    for (const m of this.marks || []) if (m.cx === cx && m.cz === cz) return m;
    return null;
  }

  drawPixels(ctx, game) {
    if (!game) return;
    if (this.tab === 'civ') {
      this.drawTown(ctx, game);
      this.drawListTab(ctx);
      return;
    }
    const ow = game.world.ow;
    const a = this.area();
    const o = this.origin();
    const { w, h } = this.sq();
    const time = this.ui.time;
    const blink = Math.floor(time * 3) % 2;
    const reveal = !!game.revealMap;
    const known = (cx, cz) => cx >= 0 && cz >= 0 && cx < MAP_W && cz < MAP_H && (reveal || ow.explored[cz * MAP_W + cx]);
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c0b12';
    ctx.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    // The squares in view.
    const M = worldCache(ow);
    const icons = settlementIcons(game);
    this.icons = icons;
    // (Round 80) The map's still parts (the land's squares, roads and
    // bridges) from a picture kept of them, redrawn only when what they
    // show changes or the view's gone past its edge: panning just moves it.
    // See stillLayer.
    const still = this.stillLayer(game, a, o, w, h, icons, known, reveal, M);
    if (still) {
      ctx.drawImage(still.canvas, o.x + still.px0, o.y + still.py0);
      this.stormGlyphs(ctx, ow, a, o, w, h, time);
    } else this.drawStill(ctx, game, a, o, w, h, icons, known, reveal, M, time);
    if (!ow.wallDown) this.drawStorm(ctx, game, o, w, h, time);
    this.drawVolcano(ctx, game, w, h, time);
    this.drawPlaces(ctx, game, o, w, h, icons, known, blink);
    this.drawMoving(ctx, game, w, h, icons, known, time);
    this.drawLabels(ctx, game, w, h);
    // You.
    const p = game.mapPos ? game.mapPos() : game.player;
    const q = this.at(p.x, p.z);
    if (this.z >= GLYPHS_FROM) {
      if (blink) {
        ctx.fillStyle = '#c02020';
        const sc = this.z / GLYPHS_FROM;
        const hx = o.x + Math.floor(p.x / REGION_W) * w + ((p.x % REGION_W) >= REGION_W / 2 ? w / 2 : 0);
        const hy = o.y + Math.floor(p.z / REGION_D) * h;
        ctx.fillRect(hx, hy, w / 2, h);
        drawGlyph(ctx, '@', hx, hy, '#ffffff', sc);
      }
    } else {
      ctx.fillStyle = blink ? '#ffffff' : '#ff3030';
      ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 3, 2, 6);
      ctx.fillRect(Math.round(q.x) - 3, Math.round(q.y) - 1, 6, 2);
    }
    // (Round 73) A faint arrow from you toward each quest marker (at the
    // map's edge, if it's off it).
    this.drawQuestArrows(ctx, game, q, a, time);
    // The others in your guild, wherever they are (down an old place: at its
    // way in), each in their own colour.
    this.drawMates(ctx, game, o, w, h, blink);
    // The square pointed at.
    if (this.hoverSq && this.z >= TILES_FROM) {
      ctx.strokeStyle = 'rgba(255,240,200,0.8)';
      ctx.lineWidth = 1;
      const hq = this.hoverSq;
      if (hq.hf !== null && hq.hf !== undefined) ctx.strokeRect(o.x + hq.cx * w + (hq.hf * w) / 2 + 0.5, o.y + hq.cz * h + 0.5, w / 2 - 1, h - 1);
      else ctx.strokeRect(o.x + hq.cx * w + 0.5, o.y + hq.cz * h + 0.5, w - 1, h - 1);
    }
    // Still working out the far reaches of the world.
    if (M.row < MAP_H && this.z < TILES_FROM) drawText(ctx, 'charting the world...', a.x0 + 4, a.y1 - 10, '#c8b890', '#000');
    ctx.restore();
    this.drawListTab(ctx);
  }

  // (Round 80) The picture of the map's still parts, made again if what it
  // shows has changed (the zoom, the realms view, what you've seen, the
  // roads, the world still being charted, the storm) or the view's moved
  // past it. It covers the view and as much again round it, in the map's
  // own pixels from its corner (px0, py0 on); null where there's no
  // drawing apart (the tests).
  stillLayer(game, a, o, w, h, icons, known, reveal, M) {
    if (typeof document === 'undefined') return null;
    const ow = game.world.ow;
    const roads = game.sim.diplomacy.roads;
    let rk = roads.length;
    for (const r of roads) rk = (rk * 31 + (r.fromA ?? r.built ?? 0) * 7 + (r.fromB || 0) * 3 + (r.done ? 1 : 0)) % 1000000007;
    // (The realms' borders move with their wars: looked at again now and
    // then, with them showing.)
    const civT = this.civView ? Math.floor(this.ui.time / 2) : 0;
    const key = `${this.z}|${this.civView ? 1 : 0}|${civT}|${reveal ? 1 : 0}|${ow.exploredN || 0}|${M.row}|${ow.wallDown ? 1 : 0}|${rk}|${(ow.bridges || []).length}|${icons.size}`;
    const S = this.still;
    const vx0 = a.x0 - o.x;
    const vy0 = a.y0 - o.y;
    const vx1 = a.x1 - o.x;
    const vy1 = a.y1 - o.y;
    if (S && S.key === key && S.of === ow.explored && vx0 >= S.px0 && vy0 >= S.py0 && vx1 <= S.px1 && vy1 <= S.py1) return S;
    const mw = Math.ceil((vx1 - vx0) / 2);
    const mh = Math.ceil((vy1 - vy0) / 2);
    const px0 = Math.floor(vx0 - mw);
    const py0 = Math.floor(vy0 - mh);
    const px1 = Math.ceil(vx1 + mw);
    const py1 = Math.ceil(vy1 + mh);
    const canvas = (S && S.canvas) || document.createElement('canvas');
    if (canvas.width !== px1 - px0 || canvas.height !== py1 - py0) {
      canvas.width = px1 - px0;
      canvas.height = py1 - py0;
    }
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = false;
    // (Drawn as the map would be, its corner moved to the picture's.)
    const o2 = { x: -px0, y: -py0 };
    const a2 = { x0: 0, y0: 0, x1: canvas.width, y1: canvas.height };
    this.stormSq = [];
    this.drawStill(c, game, a2, o2, w, h, icons, known, reveal, M, null);
    this.still = { canvas, key, of: ow.explored, px0, py0, px1, py1 };
    return this.still;
  }

  // The map's still parts, drawn: the land's squares (dots far out, its
  // tiles closer, its glyphs close in), under the fog of what you haven't
  // seen; the roads; the bridges. (`time` null: into the kept picture, the
  // storm's churning water left to stormGlyphs.)
  drawStill(ctx, game, a, o, w, h, icons, known, reveal, M, time) {
    const ow = game.world.ow;
    const cx0 = Math.max(0, Math.floor((a.x0 - o.x) / w));
    const cz0 = Math.max(0, Math.floor((a.y0 - o.y) / h));
    const cx1 = Math.min(MAP_W - 1, Math.floor((a.x1 - o.x) / w));
    const cz1 = Math.min(MAP_H - 1, Math.floor((a.y1 - o.y) / h));
    if (mapMode(this.z) === 'dots') {
      // Far out: the world a dot a square, under its fog.
      refreshFog(ow, reveal);
      if (M.base) {
        ctx.drawImage(M.base, 0, 0, MAP_W, MAP_H, o.x, o.y, MAP_W * w, MAP_H * h);
        ctx.drawImage(M.fog, 0, 0, MAP_W, MAP_H, o.x, o.y, MAP_W * w, MAP_H * h);
      }
      if (this.civView) {
        const paint = (c) => {
          if (c.civ === null || !ow.civs[c.civ]) return;
          ctx.fillStyle = ow.civs[c.civ].color.hex;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(o.x + c.cx * w, o.y + c.cz * h, Math.ceil(w), Math.ceil(h));
        };
        for (const c of ow.liveCells) if (known(c.cx, c.cz)) paint(c);
        // (Round 68) The far lands' realms, over what's known of them.
        for (const L of ow.lands) {
          if (L.kind === 'dagoni' || !ow.civs.some((q) => q.island === L.key)) continue;
          for (let cz = Math.max(0, Math.floor(L.z0 / REGION_D)); cz <= Math.min(MAP_H - 1, Math.floor(L.z1 / REGION_D)); cz++) {
            for (let cx = Math.max(0, Math.floor(L.x0 / REGION_W)); cx <= Math.min(MAP_W - 1, Math.floor(L.x1 / REGION_W)); cx++) {
              if (!known(cx, cz) || (M.biome[cz * MAP_W + cx] || ow.mapBiome(cx, cz)) === 'ocean') continue;
              const c = ow.cell(cx, cz);
              if (c && c.island === L.key) paint(c);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
    } else {
      const glyphs = mapMode(this.z) === 'glyphs';
      const sc = this.z / GLYPHS_FROM;
      for (let cz = cz0; cz <= cz1; cz++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const x = o.x + cx * w;
          const y = o.y + cz * h;
          if (!known(cx, cz)) {
            // (Unseen: dark inside the storm; the old charts' far lands.)
            const b = M.biome[cz * MAP_W + cx] || ow.mapBiome(cx, cz);
            const inside = ow.insideStorm((cx + 0.5) * REGION_W, (cz + 0.5) * REGION_D);
            ctx.fillStyle = inside ? '#16141e' : b !== 'ocean' ? '#3a3128' : '#0c0c14';
            ctx.fillRect(x, y, w, h);
            if (glyphs && inside) {
              drawGlyph(ctx, '░', x, y, '#2a2632', sc);
              drawGlyph(ctx, '░', x + w / 2, y, '#2a2632', sc);
            }
            continue;
          }
          const cell = ow.cell(cx, cz);
          const civBg = this.civView && cell.civ !== null && ow.civs[cell.civ] ? shadeHex(ow.civs[cell.civ].color.hex, 0.45) : null;
          if (glyphs) {
            for (let hf = 0; hf < 2; hf++) {
              const B = BIOMES[cell.halves[hf]] || BIOMES.ocean;
              let ch = B.char;
              let fg = B.fg;
              let bg = B.bg;
              if (cell.river && hf === 1 && cell.biome !== 'ocean') {
                ch = '~';
                fg = '#80d0ff';
              }
              if (cell.lake) {
                ch = '≈';
                fg = '#80c8ff';
                bg = '#1a4a8a';
              }
              if (cell.biome === 'ocean' && cell.storm > 0 && !ow.wallDown) {
                bg = shadeHex('#3a4a60', 0.6 + cell.storm * 0.4);
                fg = '#c8d8e8';
                ch = time === null ? '≈' : (cx + cz + Math.floor(time * 4)) % 3 ? '≈' : '~';
                if (time === null && hf === 0) this.stormSq.push(cx, cz);
              }
              ctx.fillStyle = civBg || bg;
              ctx.fillRect(x + (hf * w) / 2, y, w / 2, h);
              drawGlyph(ctx, ch, x + (hf * w) / 2, y, fg, sc);
            }
          } else {
            // Close-ish: each square a condensed tile of its land.
            const b = cell.lake ? 'lake' : cell.biome;
            const t = biomeTile(b, w, h);
            if (t) ctx.drawImage(t, x, y);
            if (cell.biome === 'ocean' && cell.storm > 0 && !ow.wallDown) {
              ctx.fillStyle = `rgba(150,165,190,${0.25 + cell.storm * 0.35})`;
              ctx.fillRect(x, y, w, h);
            }
            if (cell.river && cell.biome !== 'ocean' && !cell.lake) {
              ctx.fillStyle = '#5fa8e8';
              ctx.fillRect(x + Math.floor(w / 2), y, 1, h);
            }
            if (civBg) {
              ctx.fillStyle = civBg;
              ctx.globalAlpha = 0.55;
              ctx.fillRect(x, y, w, h);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    }
    this.drawRoads(ctx, game, o, w, h, icons, known);
    this.drawBridges(ctx, game, known, o, w, h);
  }

  // (Round 80) The storm's own water, churning (close in, over the kept
  // picture): its squares in view, drawn again.
  stormGlyphs(ctx, ow, a, o, w, h, time) {
    if (mapMode(this.z) !== 'glyphs' || ow.wallDown || !this.stormSq) return;
    const sc = this.z / GLYPHS_FROM;
    const L = this.stormSq;
    for (let i = 0; i < L.length; i += 2) {
      const cx = L[i];
      const cz = L[i + 1];
      const x = o.x + cx * w;
      const y = o.y + cz * h;
      if (x + w < a.x0 || x > a.x1 || y + h < a.y0 || y > a.y1) continue;
      const cell = ow.cell(cx, cz);
      if (!cell) continue;
      const bg = this.civView && cell.civ !== null && ow.civs[cell.civ] ? shadeHex(ow.civs[cell.civ].color.hex, 0.45) : shadeHex('#3a4a60', 0.6 + cell.storm * 0.4);
      const ch = (cx + cz + Math.floor(time * 4)) % 3 ? '≈' : '~';
      for (let hf = 0; hf < 2; hf++) {
        ctx.fillStyle = bg;
        ctx.fillRect(x + (hf * w) / 2, y, w / 2, h);
        drawGlyph(ctx, ch, x + (hf * w) / 2, y, '#c8d8e8', sc);
      }
    }
  }

  drawQuestArrows(ctx, game, me, a, time) {
    const pins = (game.world.ow.pins || []).filter(isQuestPin);
    if (!pins.length) return;
    const pulse = 0.35 + 0.2 * Math.sin(time * 4);
    for (const pin of pins.slice(-4)) {
      const t = this.at(pin.x, pin.z);
      const dx = t.x - me.x;
      const dy = t.y - me.y;
      const d = Math.hypot(dx, dy);
      if (d < 18) continue;
      const ux = dx / d;
      const uy = dy / d;
      // Near you, pointing its way.
      const ax = me.x + ux * 14;
      const ay = me.y + uy * 14;
      arrowHead(ctx, ax, ay, ux, uy, 6, `rgba(255,220,96,${pulse})`);
      // And at the edge, if it's off the map's window.
      const inside = t.x >= a.x0 && t.x < a.x1 && t.y >= a.y0 && t.y < a.y1;
      if (!inside) {
        const k = Math.min(...[ux > 0 ? (a.x1 - 8 - me.x) / ux : ux < 0 ? (a.x0 + 8 - me.x) / ux : Infinity, uy > 0 ? (a.y1 - 8 - me.y) / uy : uy < 0 ? (a.y0 + 8 - me.y) / uy : Infinity].filter((v) => v > 0));
        if (Number.isFinite(k)) arrowHead(ctx, me.x + ux * k, me.y + uy * k, ux, uy, 7, `rgba(255,200,80,${pulse + 0.25})`);
      } else {
        // (A faint line of dots between.)
        ctx.fillStyle = `rgba(255,220,96,${pulse * 0.5})`;
        for (let s = 22; s < d - 6; s += 6) ctx.fillRect(Math.round(me.x + ux * s), Math.round(me.y + uy * s), 1, 1);
      }
    }
  }

  // Guildmates on the map (see game/guilds.js).
  drawMates(ctx, game, o, w, h, blink) {
    const mates = game.guildMates ? game.guildMates() : [];
    for (const m of mates) {
      const cx = Math.floor(m.mx / REGION_W);
      const cz = Math.floor(m.mz / REGION_D);
      (this.marks ||= []).push({ cx, cz, label: `${m.name} (your guild)${m.dead ? ', fallen' : ''}${m.below ? `: down ${m.below}` : ''} · ${m.hp}/${m.maxHp} health`, color: m.color });
      if (this.z >= GLYPHS_FROM) {
        const sc = this.z / GLYPHS_FROM;
        const hx = o.x + cx * w + ((m.mx % REGION_W) >= REGION_W / 2 ? w / 2 : 0);
        const hy = o.y + cz * h;
        ctx.fillStyle = blink ? m.guild || '#202020' : '#101010';
        ctx.fillRect(hx, hy, w / 2, h);
        drawGlyph(ctx, m.below ? '▼' : '@', hx, hy, m.dead ? '#909090' : m.color, sc);
      } else {
        const q = this.at(m.mx, m.mz);
        const x = Math.round(q.x);
        const y = Math.round(q.y);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = m.dead ? '#909090' : m.color;
        ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = m.guild || '#ffffff';
        if (blink) ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }

  // The storm round the islands: a ring of churning grey cloud, lit now
  // and then from within.
  drawStorm(ctx, game, o, w, h, time) {
    const cx = o.x + STORM.cx * w + w / 2;
    const cy = o.y + STORM.cz * h + h / 2;
    const rx = STORM.rx * w;
    const ry = STORM.rz * h;
    const bw = (STORM.band / STORM.rx) * rx;
    const bh = (STORM.band / STORM.rx) * ry;
    const a = this.area();
    const dt = Math.min(0.1, Math.max(0, time - (this.stormT ?? time)));
    this.stormT = time;
    ctx.save();
    // Where along the ring, and how far out across the band (0 its inner
    // edge, 1 its outer), on screen.
    const at = (ang, off) => ({ x: cx + Math.cos(ang) * (rx + bw * off), y: cy + Math.sin(ang) * (ry + bh * off) });
    // Banks of black cloud, drifting slowly round (the layers against each
    // other), heaped up over the band and spilling a little past it.
    const P = stormPuffs();
    for (const layer of [0, 1, 2]) {
      const img = puffImage(layer);
      if (!img) break;
      for (const q of P[layer]) {
        const ang = q.a + time * q.spin;
        const c = at(ang, q.off);
        const r = q.size * w * (1 + 0.08 * Math.sin(time * 0.6 + q.ph));
        if (c.x + r < a.x0 || c.x - r > a.x1 || c.y + r < a.y0 || c.y - r > a.y1) continue;
        ctx.globalAlpha = q.alpha;
        ctx.drawImage(img, c.x - r, c.y - r * 0.8, r * 2, r * 1.6);
      }
    }
    ctx.globalAlpha = 1;
    // Lightning: now and then a bolt forks through the cloud, lighting it
    // from within.
    this.bolts = (this.bolts || []).filter((b) => (b.t -= dt) > 0);
    this.boltT = (this.boltT ?? 0.4) - dt;
    if (this.boltT <= 0) {
      this.boltT = 0.25 + Math.random() * 1.1;
      const ang = Math.random() * Math.PI * 2;
      const pts = [];
      let off = -0.3 + Math.random() * 0.3;
      let side = 0;
      for (let k = 0; k < 7; k++) {
        pts.push({ ang: ang + side, off });
        off += 0.18 + Math.random() * 0.12;
        side += (Math.random() - 0.5) * 0.035;
      }
      const fork = 1 + Math.floor(Math.random() * 4);
      const branch = [pts[fork], { ang: pts[fork].ang + (Math.random() < 0.5 ? -1 : 1) * 0.03, off: pts[fork].off + 0.3 }];
      this.bolts.push({ pts, branch, t: 0.22 + Math.random() * 0.12, life: 0.34, ang });
    }
    const glow = puffImage(3);
    for (const b of this.bolts) {
      const k = b.t / b.life;
      const mid = at(b.ang, 0.5);
      if (mid.x < a.x0 - 200 || mid.x > a.x1 + 200 || mid.y < a.y0 - 200 || mid.y > a.y1 + 200) continue;
      ctx.globalCompositeOperation = 'lighter';
      if (glow) {
        const r = Math.max(14, bw * 2.2);
        ctx.globalAlpha = 0.65 * k;
        ctx.drawImage(glow, mid.x - r, mid.y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, k * 1.6);
      for (const [line, width, col] of [[b.pts, Math.max(1, w / 6), '#d8e4ff'], [b.pts, 1, '#ffffff'], [b.branch, 1, '#c8d8ff']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = width;
        ctx.beginPath();
        line.forEach((pt, i) => {
          const c = at(pt.ang, pt.off);
          if (i) ctx.lineTo(c.x, c.y);
          else ctx.moveTo(c.x, c.y);
        });
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  // (Round 74) A little book on the list's tab: shut when the list is
  // put away, open when it's out.
  // ------------------------------------------------------------ (Round 142) the town
  drawTabs(g, town) {
    let x = 2;
    const tabs = [['world', ` 1·WORLD · ${ARCHIPELAGO.toUpperCase()} `]];
    if (town) tabs.push(['civ', ` 2·CIVILIZATION · ${town.name.toUpperCase()} `]);
    for (const [id, label] of tabs) {
      const on = this.tab === id;
      const hov = !on && this.hovering(x, 0, label.length, 1);
      g.text(x, 0, label, on ? '#1a1420' : hov ? C.white : C.dim, on ? '#c8a868' : hov ? '#3a2e1e' : '#1c1620');
      this.hit(x, 0, label.length, 1, () => this.goTab(id));
      x += label.length + 1;
    }
  }

  // Pixels a tile of the town takes, at the zoom: first as big as fits
  // the whole town, then a step at a time closer in (or further out), as
  // far as a picture of the town that size can be kept (Round 143). Out
  // to 2 a tile it's a dot of its colour; to 6, a little stamp of it; from
  // 8 on, a glyph on its ground, as the world map's squares are drawn.
  townSteps(plan) {
    const a = this.area();
    const fit = Math.max(1, Math.floor(Math.min((a.x1 - a.x0) / plan.W, (a.y1 - a.y0) / plan.D)));
    const steps = TOWN_ZOOMS.filter((k) => plan.W * plan.D * k * k <= 4e6);
    let base = 0;
    for (let i = 0; i < steps.length; i++) if (steps[i] <= fit) base = i;
    return { steps, base };
  }

  townScale(plan) {
    const { steps, base } = this.townSteps(plan);
    return steps[Math.max(0, Math.min(steps.length - 1, base + this.tz))];
  }

  zoomTown(d) {
    const game = this.ui.game;
    const town = this.townHere(game);
    const plan = town ? planFor(game, town.id) : null;
    if (!plan) return;
    const { steps, base } = this.townSteps(plan);
    this.tz = Math.max(-base, Math.min(steps.length - 1 - base, this.tz + d));
  }

  // Where the town's tile (local) is on screen, and back.
  townOrigin(plan, k) {
    const a = this.area();
    return { x: Math.round((a.x0 + a.x1) / 2 - this.tcam.x * k), y: Math.round((a.y0 + a.y1) / 2 - this.tcam.z * k) };
  }

  updateTown(dt, inp) {
    const game = this.ui.game;
    const town = this.townHere(game);
    const plan = town ? planFor(game, town.id) : null;
    const want = this.listOpen ? LIST_W : 0;
    this.listW += (want - this.listW) * Math.min(1, dt * 14);
    if (Math.abs(want - this.listW) < 0.3) this.listW = want;
    if (!plan) return;
    // (First looked at, or asked for again: centred on you.)
    if (!this.tcam || this.tcam.sid !== town.id) {
      const p = game.mapPos ? game.mapPos() : game.player;
      this.tcam = { sid: town.id, x: Math.max(0, Math.min(plan.W, p.x - plan.x0)), z: Math.max(0, Math.min(plan.D, p.z - plan.z0)) };
    }
    const k = this.townScale(plan);
    if (inp && inp.isDown) {
      const sp = (160 / k) * dt;
      const key = (...c) => c.some((q) => inp.isDown(q));
      if (key('KeyA', 'ArrowLeft')) this.tcam.x -= sp;
      if (key('KeyD', 'ArrowRight')) this.tcam.x += sp;
      if (key('KeyW', 'ArrowUp')) this.tcam.z -= sp;
      if (key('KeyS', 'ArrowDown')) this.tcam.z += sp;
    }
    const m = this.ui.mouse;
    if (m && m.down && this.drag) {
      const dx = m.x - this.drag.x;
      const dy = m.y - this.drag.y;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(dx) + Math.abs(dy));
      this.tcam.x = this.drag.cx - dx / k;
      this.tcam.z = this.drag.cz - dy / k;
    } else if (m && !m.down && this.drag) {
      // (A click, not a drag: the place under it picked out.)
      if (this.drag.moved < 4) this.townPick = this.townAt(game, plan, m.x, m.y);
      this.drag = null;
    }
    this.tcam.x = Math.max(0, Math.min(plan.W, this.tcam.x));
    this.tcam.z = Math.max(0, Math.min(plan.D, this.tcam.z));
  }

  // The place of the town (one you've been near) under a screen pixel.
  townAt(game, plan, px, py) {
    if (!this.tcam) return null;
    const a = this.area();
    if (px < a.x0 || px >= a.x1 || py < a.y0 || py >= a.y1) return null;
    const S = seenOf(game, plan.sid);
    if (!S) return null;
    const k = this.townScale(plan);
    const o = this.townOrigin(plan, k);
    const x = plan.x0 + (px - o.x) / k;
    const z = plan.z0 + (py - o.y) / k;
    const inside = (q) => x >= q.x0 && x < q.x1 + 1 && z >= q.z0 && z < q.z1 + 1;
    const b = plan.b.find((q) => S.b[q.id] && inside(q));
    if (b) return { ...b, kind: kindOf(b.type) };
    const lm = plan.lm.find((q) => S.lm[q.id] && inside(q));
    return lm ? { ...lm, landmark: true, kind: 'landmark' } : null;
  }

  // The words under the town's map: what's pointed at, or how much of the
  // town you know.
  drawTownWords(g, game, town) {
    const y0 = this.h - 4;
    const W = this.w - 3;
    const put = (y, text, color) => g.text(2, y, text.slice(0, W).padEnd(W), color);
    const plan = planFor(game, town.id);
    if (!plan) {
      put(y0, `${town.name}: unrolling the town's plan...`, C.dim);
      put(y0 + 1, '', C.dim);
      return;
    }
    const m = this.ui.mouse;
    const q = (m && this.townAt(game, plan, m.x, m.y)) || this.townPick;
    this.townHover = q;
    const S = seenOf(game, town.id, plan);
    const nb = plan.b.filter((b) => S.b[b.id]).length;
    if (q) {
      const what = q.landmark ? 'landmark' : { home: 'a home', trade: 'trade', food: 'food and drink', civic: 'the town\'s hall', faith: 'faith', craft: 'a craft', learn: 'learning', guard: 'the watch' }[q.kind] || q.type;
      put(y0, `${q.name}${q.up ? ' (going up)' : ''} · ${what}`, C.hi);
    } else put(y0, `${town.name}: ${nb} of its ${plan.b.length} buildings known to you.`, C.hi);
    put(y0 + 1, 'Only where you\'ve walked is drawn · drag or WASD · wheel: zoom · Space: you', C.faint);
  }

  // The places you know in the town, down the side (homes counted, not
  // listed); a click finds one on the map.
  drawTownList(g, game, x, W, bottom) {
    const town = this.townHere(game);
    const plan = town ? planFor(game, town.id) : null;
    const S = plan ? seenOf(game, town.id, plan) : null;
    if (!plan || !S) {
      g.text(x, 1, '  ...', C.faint);
      return;
    }
    const RANK = { landmark: 0, civic: 1, faith: 2, food: 3, trade: 4, craft: 5, learn: 6, guard: 7, home: 8 };
    const known = [
      ...plan.lm.filter((q) => S.lm[q.id]).map((q) => ({ ...q, kind: 'landmark', landmark: true })),
      ...plan.b.filter((b) => S.b[b.id]).map((b) => ({ ...b, kind: kindOf(b.type) })),
    ];
    const homes = known.filter((q) => q.kind === 'home').length;
    const list = known.filter((q) => q.kind !== 'home').sort((p, q) => RANK[p.kind] - RANK[q.kind] || p.name.localeCompare(q.name));
    g.text(x, 1, ` ${town.name}`.padEnd(W).slice(0, W), C.white, '#1c1620');
    const rows = bottom - 2;
    this.listScroll = Math.max(0, Math.min(this.listScroll, Math.max(0, list.length + 1 - rows)));
    let y = 3;
    for (let i = this.listScroll; i < list.length && y <= bottom; i++) {
      const e = list[i];
      const hov = this.hovering(x, y, W, 1);
      const picked = this.townPick && this.townPick.id === e.id && !!this.townPick.landmark === !!e.landmark;
      const look = e.landmark ? { c: '#ffe8a0', g: '◆' } : buildingLook(e.type);
      g.text(x, y, `${look.g || '•'} ${e.name}`.padEnd(W).slice(0, W), hov || picked ? C.white : look.c, picked ? '#2a3a2e' : hov ? '#3a2e1e' : undefined);
      this.hit(x, y, W, 1, () => {
        this.townPick = e;
        if (this.tcam) {
          this.tcam.x = (e.x0 + e.x1) / 2 + 0.5 - plan.x0;
          this.tcam.z = (e.z0 + e.z1) / 2 + 0.5 - plan.z0;
        }
        this.ui.audio?.play('select');
      });
      y++;
    }
    if (y <= bottom && homes) g.text(x, y, `  and ${homes} home${homes === 1 ? '' : 's'}`.slice(0, W), C.faint);
    if (!known.length) g.text(x, 3, '  nowhere yet: walk about', C.faint);
  }

  // (Round 143) The town as it's seen from above, at the zoom (`k` pixels
  // a tile): the roofs, the trees, the crops and the lanterns, the paving,
  // the water; lit by how high each stands, a shadow below what's taller,
  // each building's edge drawn darker; and what you've not been near, as
  // the world map's unknown. Made again only when you've seen more, the
  // town has changed or the zoom has (see townlook.js).
  townPic(plan, S, k) {
    if (typeof document === 'undefined') return null;
    const mode = k <= 2 ? 'dots' : k < 8 ? 'tiles' : 'glyphs';
    const key = `${plan.sid}|${plan.v}|${S.v}|${k}`;
    if (this.tpic && this.tpic.key === key) return this.tpic.canvas;
    // (Only more of it seen, a moment ago: the picture as it was, a little
    // longer, so walking with the map open doesn't make it over and over.)
    const now = this.ui.time || 0;
    if (this.tpic && this.tpic.base === `${plan.sid}|${plan.v}|${k}` && now - this.tpic.at < 0.75) return this.tpic.canvas;
    const IW = plan.W * k;
    const IH = plan.D * k;
    const c = this.tpic && this.tpic.canvas.width === IW && this.tpic.canvas.height === IH ? this.tpic.canvas : document.createElement('canvas');
    c.width = IW;
    c.height = IH;
    const g = c.getContext('2d');
    const img = g.createImageData(IW, IH);
    const data = img.data;
    const px32 = new Uint32Array(data.buffer);
    const { W, D } = plan;
    const seen = (x, z) => cellSeen(S, Math.floor(x / CELL), Math.floor(z / CELL));
    const fromMask = (v) => kindLook(MASK_KIND[v] || 'ground', hexRgb(GROUND_COLOR[v] || GROUND_COLOR[0]));
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const i = z * W + x;
        const fog = !seen(x, z);
        const ht = plan.ht ? plan.ht[i] : plan.mask[i] === 2 ? 4 : 0;
        const L = plan.top ? lookOf(plan.top[i], ht >= 2, plan.mask[i] === 2) : fromMask(plan.mask[i]);
        let f = 0.8 + Math.min(ht, 8) * 0.045;
        // (In the shadow of what stands taller just above it.)
        if (z > 0 && plan.ht && plan.ht[i - W] >= ht + 2) f *= 0.7;
        paintTile(px32, IW, x * k, z * k, k, mode, L, f, x + plan.x0, z + plan.z0, fog);
      }
    }
    // Each building's edge, darker (where you've seen it).
    if (k >= 3) {
      for (const b of plan.b) {
        const bx0 = b.x0 - plan.x0;
        const bz0 = b.z0 - plan.z0;
        const bx1 = b.x1 - plan.x0;
        const bz1 = b.z1 - plan.z0;
        for (let z = bz0; z <= bz1; z++) {
          for (let x = bx0; x <= bx1; x++) {
            if (x < 0 || z < 0 || x >= W || z >= D || !seen(x, z)) continue;
            if (x !== bx0 && x !== bx1 && z !== bz0 && z !== bz1) continue;
            const L = plan.top ? lookOf(plan.top[z * W + x], true, true) : fromMask(2);
            const col = shade(L.c, 0.42);
            const line = (u, v) => {
              const j = ((z * k + v) * IW + x * k + u) * 4;
              data[j] = col[0];
              data[j + 1] = col[1];
              data[j + 2] = col[2];
            };
            for (let t = 0; t < k; t++) {
              if (x === bx0) line(0, t);
              if (x === bx1) line(k - 1, t);
              if (z === bz0) line(t, 0);
              if (z === bz1) line(t, k - 1);
            }
          }
        }
      }
    }
    // Its door, on the side it opens onto (Round 143).
    if (k >= 3) {
      const DX = [0, -1, 0, 1];
      const DZ = [1, 0, -1, 0];
      const dw = Math.max(1, Math.round(k / 3));
      const dd = Math.max(1, Math.round(k / 4));
      for (const b of plan.b) {
        const d = b.door;
        if (!d) continue;
        const x = d.x - plan.x0;
        const z = d.z - plan.z0;
        if (x < 0 || z < 0 || x >= W || z >= D || !seen(x, z)) continue;
        const ox = DX[d.rot & 3];
        const oz = DZ[d.rot & 3];
        const m = Math.floor((k - dw) / 2);
        for (let a = 0; a < dw; a++) {
          for (let t = 0; t < dd; t++) {
            const u = ox ? (ox > 0 ? k - 1 - t : t) : m + a;
            const v = oz ? (oz > 0 ? k - 1 - t : t) : m + a;
            const j = ((z * k + v) * IW + x * k + u) * 4;
            data[j] = 96;
            data[j + 1] = 62;
            data[j + 2] = 34;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
    this.tpic = { key, base: `${plan.sid}|${plan.v}|${k}`, at: now, canvas: c };
    return c;
  }

  drawTown(ctx, game) {
    const town = this.townHere(game);
    const a = this.area();
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c0b12';
    ctx.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    const plan = town ? planFor(game, town.id) : null;
    if (!plan || !this.tcam) {
      drawText(ctx, 'unrolling the town\'s plan...', a.x0 + 4, a.y1 - 10, '#c8b890', '#000');
      ctx.restore();
      return;
    }
    const S = seenOf(game, town.id, plan);
    const k = this.townScale(plan);
    const o = this.townOrigin(plan, k);
    const time = this.ui.time || 0;
    const blink = Math.floor(time * 3) % 2;
    // The town as you've seen it.
    const pic = this.townPic(plan, S, k);
    if (pic) ctx.drawImage(pic, o.x, o.y);
    const rect = (q) => ({ x: o.x + (q.x0 - plan.x0) * k, y: o.y + (q.z0 - plan.z0) * k, w: (q.x1 - q.x0 + 1) * k, h: (q.z1 - q.z0 + 1) * k });
    const outline = (r, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(r.x, r.y, r.w, 1);
      ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
      ctx.fillRect(r.x, r.y, 1, r.h);
      ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    };
    // The landmarks (an empire city's arena, its gardens...), outlined.
    for (const q of plan.lm) if (S.lm[q.id]) outline(rect(q), '#ffe8a0');
    // The places you've been near: a sign on the ones folk look for (a dot
    // of its colour, far out), and its name over it close in.
    const hov = this.townHover;
    const labels = [];
    for (const b of plan.b) {
      if (!S.b[b.id]) continue;
      const r = rect(b);
      const look = buildingLook(b.type);
      if (hov && !hov.landmark && hov.id === b.id && blink) outline(r, '#ffffff');
      if (!look.g) continue;
      const cx = Math.round(r.x + r.w / 2);
      const cy = Math.round(r.y + r.h / 2);
      if (k <= 2) {
        ctx.fillStyle = look.c;
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
        continue;
      }
      // (As a town's icon on the world map: the sign on a dark square.)
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(cx - 4, cy - 5, 8, 10);
      drawGlyph(ctx, look.g, cx - 3, cy - 4, look.c);
      if (k >= 8) labels.push({ text: b.name, x: cx, y: r.y - 9, c: look.c });
    }
    // (Names, close in, where they don't run into one another.)
    const put = [];
    for (const L of labels) {
      const w = L.text.length * CHAR_W;
      const box = { x0: L.x - w / 2 - 1, x1: L.x + w / 2 + 1, y0: L.y - 1, y1: L.y + 9 };
      if (put.some((q) => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0)) continue;
      put.push(box);
      drawText(ctx, L.text, Math.round(L.x - w / 2), L.y, L.c, '#000');
    }
    // You (blinking).
    const p = game.mapPos ? game.mapPos() : game.player;
    const px = o.x + (p.x - plan.x0) * k;
    const py = o.y + (p.z - plan.z0) * k;
    if (k >= 8) {
      // (Close in, as on the world map: the @ on red.)
      if (blink) {
        ctx.fillStyle = '#c02020';
        ctx.fillRect(Math.round(px - 4), Math.round(py - 5), 8, 10);
        drawGlyph(ctx, '@', Math.round(px - 3), Math.round(py - 4), '#ffffff');
      }
    } else {
      const sz = Math.max(3, k);
      ctx.fillStyle = blink ? '#ffffff' : '#ff3030';
      ctx.fillRect(Math.round(px - sz / 2), Math.round(py) - 1, sz, 2);
      ctx.fillRect(Math.round(px) - 1, Math.round(py - sz / 2), 2, sz);
    }
    // (How close in, in the corner.)
    drawText(ctx, k <= 2 ? 'far' : k < 8 ? 'near' : 'close', a.x1 - 34, a.y1 - 10, '#5a5040', '#000');
    ctx.restore();
  }

  drawListTab(ctx) {
    const t = this.tabAt;
    if (!t) return;
    const x = Math.round((this.x + t.x) * CHAR_W + 1);
    const y = Math.round((this.y + t.y + 1) * CHAR_H - 1);
    const hov = this.tabHov;
    const cover = hov ? '#d07a40' : '#a0522d';
    const dark = '#5a2a14';
    const page = '#f0e2c0';
    ctx.save();
    if (this.listOpen) {
      // Open: two pages and a spine down the middle.
      ctx.fillStyle = cover;
      ctx.fillRect(x, y + 1, 10, 8);
      ctx.fillStyle = page;
      ctx.fillRect(x + 1, y, 4, 8);
      ctx.fillRect(x + 6, y, 4, 8);
      ctx.fillStyle = dark;
      ctx.fillRect(x + 5, y, 1, 9);
      ctx.fillStyle = '#9a8a6a';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 2, y + 2 + i * 2, 2, 1);
        ctx.fillRect(x + 7, y + 2 + i * 2, 2, 1);
      }
    } else {
      // Shut: a cover, its spine and the edge of its pages.
      ctx.fillStyle = dark;
      ctx.fillRect(x + 1, y, 8, 10);
      ctx.fillStyle = cover;
      ctx.fillRect(x + 2, y, 7, 9);
      ctx.fillStyle = page;
      ctx.fillRect(x + 2, y + 9, 7, 1);
      ctx.fillStyle = '#e8c060';
      ctx.fillRect(x + 4, y + 3, 3, 1);
      ctx.fillRect(x + 4, y + 5, 3, 1);
    }
    ctx.restore();
  }

  // The roads between towns: a line through each square they pass (only
  // what's built, and only where you've been).
  drawRoads(ctx, game, o, w, h, icons, known) {
    if (this.z < 4) return;
    const links = roadCellLinks(game.sim.diplomacy.roads);
    const big = this.z >= GLYPHS_FROM;
    for (const [k, dirs] of links) {
      const cx = k % 10000;
      const cz = Math.floor(k / 10000);
      if (!known(cx, cz) || icons.has(k)) continue;
      const mx = Math.round(o.x + cx * w + w / 2);
      const my = Math.round(o.y + cz * h + h / 2);
      for (const [col, t0] of [['rgba(40,28,16,0.55)', big ? 4 : 2], ['rgba(238,212,160,0.9)', big ? 2 : 1]]) {
        const t = t0 * (this.z >= 24 ? 2 : 1);
        ctx.fillStyle = col;
        for (const d of dirs) {
          if (d === 'E') ctx.fillRect(mx - t / 2, my - t / 2, w / 2 + t / 2, t);
          else if (d === 'W') ctx.fillRect(mx - w / 2, my - t / 2, w / 2 + t / 2, t);
          else if (d === 'S') ctx.fillRect(mx - t / 2, my - t / 2, t, h / 2 + t / 2);
          else ctx.fillRect(mx - t / 2, my - h / 2, t, h / 2 + t / 2);
        }
        if (dirs.size === 1) ctx.fillRect(mx - t / 2, my - t / 2, t, t);
      }
    }
  }

  // The mountain on Kharos: smoking, and aglow when it's lately gone up.
  drawVolcano(ctx, game, w, h, time) {
    const V = game.world.ow.volcano;
    if (!V) return;
    const ow = game.world.ow;
    if (!(game.revealMap || ow.explored[V.cz * MAP_W + V.cx] || ow.explored[V.cz * MAP_W + V.cx - 1])) return;
    const q = this.at(V.x, V.z);
    const s = Math.max(2, Math.round(this.z / 3));
    const hot = game.sim.volcano ? game.sim.volcano.ashLevel() : 0;
    ctx.fillStyle = '#2a1410';
    ctx.beginPath();
    ctx.moveTo(q.x, q.y - s * 1.6);
    ctx.lineTo(q.x + s * 1.6, q.y + s * 0.8);
    ctx.lineTo(q.x - s * 1.6, q.y + s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hot > 0 ? (Math.floor(time * 6) % 2 ? '#ffb040' : '#ff5020') : '#c83a1a';
    ctx.fillRect(Math.round(q.x - s * 0.4), Math.round(q.y - s * 1.6), Math.max(1, Math.round(s * 0.8)), Math.max(1, Math.round(s * 0.5)));
    for (let i = 0; i < 3; i++) {
      const ph = (time * 0.35 + i / 3) % 1;
      ctx.fillStyle = `rgba(${hot > 0 ? '70,60,56' : '150,145,140'},${(1 - ph) * 0.6})`;
      ctx.beginPath();
      ctx.arc(q.x + Math.sin(ph * 4 + i) * s * 0.6 + ph * s, q.y - s * 1.8 - ph * s * 4, Math.max(1, s * (0.3 + ph * (hot > 0 ? 1.4 : 0.7))), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Towns, camps, battles, raids and old places.
  drawPlaces(ctx, game, o, w, h, icons, known, blink) {
    const glyphs = this.z >= GLYPHS_FROM;
    const sc = this.z / GLYPHS_FROM;
    const marks = [];
    this.marks = marks;
    // Towns.
    if (glyphs) {
      for (const [k, icon] of icons) {
        const cx = k % 10000;
        const cz = Math.floor(k / 10000);
        if (!known(cx, cz)) continue;
        const s = icon.s;
        const x = o.x + cx * w;
        const y = o.y + cz * h;
        ctx.fillStyle = shadeHex(icon.haven ? HAVEN_MAP : s.civ ? s.civ.color.hex : '#e8e8e8', icon.shade);
        ctx.fillRect(x, y, w, h);
        drawGlyph(ctx, icon.glyph[0], x, y, '#fff4d0', sc);
        drawGlyph(ctx, icon.glyph[1], x + w / 2, y, '#fff4d0', sc);
        if (s.condition === 'abandoned' || s.deserted) drawGlyph(ctx, '†', x + w / 2, y, '#a0a0a0', sc);
      }
    } else {
      const seen = new Set();
      for (const [k, icon] of icons) {
        const cx = k % 10000;
        const cz = Math.floor(k / 10000);
        if (!known(cx, cz)) continue;
        const s = icon.s;
        const col = icon.haven ? HAVEN_MAP : s.civ ? s.civ.color.hex : '#d8d8d8';
        if (this.z >= TILES_FROM) {
          ctx.fillStyle = shadeHex(col, 0.7);
          ctx.fillRect(o.x + cx * w, o.y + cz * h, w, h);
          ctx.fillStyle = s.condition === 'abandoned' || s.deserted ? '#8a8478' : '#fff4d0';
          ctx.fillRect(o.x + cx * w + w / 2 - 1, o.y + cz * h + h / 2 - 1, 2, 2);
        } else if (!seen.has(s.id)) {
          seen.add(s.id);
          const q = this.at((s.cx + s.cw / 2) * REGION_W, (s.cz + s.cd / 2) * REGION_D);
          const r = s.empire ? 3 : s.type === 'city' ? 2 : s.type === 'town' ? 1.5 : 1;
          // (An empire's capital: a gold crown of a border round it.)
          if (s.empire) {
            ctx.fillStyle = '#e0b040';
            ctx.fillRect(Math.round(q.x - r - 2), Math.round(q.y - r - 2), Math.round(r * 2 + 4), Math.round(r * 2 + 4));
          }
          ctx.fillStyle = '#1a1410';
          ctx.fillRect(Math.round(q.x - r - 1), Math.round(q.y - r - 1), Math.round(r * 2 + 2), Math.round(r * 2 + 2));
          ctx.fillStyle = s.condition === 'abandoned' || s.deserted ? '#8a8478' : col;
          ctx.fillRect(Math.round(q.x - r), Math.round(q.y - r), Math.round(r * 2), Math.round(r * 2));
        }
      }
    }
    // (Told of counts: a place you've only heard of shows through the fog.)
    const put = (x, z, ch, fg, bg, label, color, told = false) => {
      const cx = Math.floor(x / REGION_W);
      const cz = Math.floor(z / REGION_D);
      if (!told && !known(cx, cz)) return;
      marks.push({ cx, cz, label, color });
      if (icons.has(cz * 10000 + cx) && glyphs) return;
      if (glyphs) {
        const px = o.x + cx * w + ((x % REGION_W) >= REGION_W / 2 ? w / 2 : 0);
        const py = o.y + cz * h;
        if (bg) {
          ctx.fillStyle = bg;
          ctx.fillRect(px, py, w / 2, h);
        }
        drawGlyph(ctx, ch, px, py, fg, sc);
      } else if (this.z >= 3) {
        const q = this.at(x, z);
        ctx.fillStyle = bg || '#000';
        ctx.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 4);
        ctx.fillStyle = fg;
        ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2);
      }
    };
    // Wars and raids: tomorrow's battlefield, the fields fought over
    // lately, and towns expecting raiders.
    this.armies = [];
    for (const m of game.sim.war.markers()) {
      if (m.kind === 'army') {
        this.armies.push(m);
        marks.push({ cx: Math.floor(m.x / REGION_W), cz: Math.floor(m.z / REGION_D), label: m.label, color: m.color });
        continue;
      }
      if (m.kind === 'siege') {
        // (Round 144) A siege: the besiegers' lines round the town, a ring
        // of their colours marching round it, and their camp.
        const t = game.world.ow.settlements[m.sid];
        if (t && (known(t.cx, t.cz) || game.revealMap)) {
          const a = this.at(t.cx * REGION_W, t.cz * REGION_D);
          const b = this.at((t.cx + t.cw) * REGION_W, (t.cz + t.cd) * REGION_D);
          const pad = Math.max(2, Math.round((b.x - a.x) * 0.12));
          ctx.save();
          ctx.lineWidth = Math.max(1, Math.round(sc));
          ctx.strokeStyle = '#1a1410';
          ctx.strokeRect(Math.round(a.x - pad) + 0.5, Math.round(a.y - pad) + 0.5, Math.round(b.x - a.x + pad * 2), Math.round(b.y - a.y + pad * 2));
          ctx.setLineDash([3, 3]);
          ctx.lineDashOffset = -Math.floor(performance.now() / 160) % 6;
          ctx.strokeStyle = m.color || '#ff7060';
          ctx.strokeRect(Math.round(a.x - pad) + 0.5, Math.round(a.y - pad) + 0.5, Math.round(b.x - a.x + pad * 2), Math.round(b.y - a.y + pad * 2));
          ctx.restore();
        }
        put(m.x, m.z, '#', '#ffffff', blink ? m.color || '#c02020' : '#3a1a1a', m.label, m.color);
        continue;
      }
      if (m.kind === 'raid') {
        if (blink) put(m.x, m.z, '!', '#ffffff', '#c03020', m.label);
        else marks.push({ cx: Math.floor(m.x / REGION_W), cz: Math.floor(m.z / REGION_D), label: m.label });
      } else put(m.x, m.z, 'X', m.kind === 'battle' ? '#ffffff' : '#ff9080', m.kind === 'battle' ? (blink ? '#c02020' : '#801818') : '#3a1a1a', m.label);
    }
    // Bandit camps you've heard of (or seen the smoke of).
    for (const c of game.sim.bandits ? game.sim.bandits.knownCamps() : []) {
      put(c.x, c.z, '▲', c.hired ? '#ffd080' : '#f0a060', '#3a1a10', `Camp of ${c.name} (${c.n} of them${c.hired ? ', hired swords' : ''})${c.from ? `: heard of from ${c.from}` : ''}`, null, true);
    }
    // (Round 117) An old place's tier: a coloured badge beside it, its pips
    // the tier (bronze I, silver II, gold III), and a tier III place
    // alight on the map: a slow golden pulse round it and sparks circling.
    const now = performance.now() / 1000;
    const tierBadge = (d) => {
      const tier = Math.max(1, Math.min(3, d.tier || 1));
      const cx = Math.floor(d.x / REGION_W);
      const cz = Math.floor(d.z / REGION_D);
      if (!(d.known || d.seen || game.revealMap) && !known(cx, cz)) return;
      const col = TIER_BADGE[tier];
      if (glyphs) {
        const right = (d.x % REGION_W) >= REGION_W / 2;
        const gx = o.x + cx * w + (right ? w / 2 : 0);
        const gy = o.y + cz * h;
        const bw = w / 2;
        if (tier >= 3) {
          // (Its glow: a gold ring breathing out round it, and three sparks.)
          const k = (now * 0.8) % 1;
          ctx.save();
          ctx.globalAlpha = 0.55 * (1 - k);
          ctx.strokeStyle = '#ffd040';
          ctx.lineWidth = 1;
          const g = 1 + k * Math.max(w, h) * 0.5;
          ctx.strokeRect(Math.round(gx - g) + 0.5, Math.round(gy - g) + 0.5, Math.round(bw + g * 2), Math.round(h + g * 2));
          ctx.globalAlpha = 0.18 + 0.12 * Math.sin(now * 3);
          ctx.fillStyle = '#ffd040';
          ctx.fillRect(Math.round(gx - 1), Math.round(gy - 1), Math.round(bw + 2), Math.round(h + 2));
          ctx.globalAlpha = 1;
          const rr = Math.max(w, h) * 0.75;
          for (let i = 0; i < 3; i++) {
            const a = now * 2.2 + (i * Math.PI * 2) / 3;
            ctx.fillStyle = i % 2 ? '#fff4c0' : '#ffd040';
            ctx.fillRect(Math.round(gx + bw / 2 + Math.cos(a) * rr), Math.round(gy + h / 2 + Math.sin(a) * rr * 0.8), 2, 2);
          }
          ctx.restore();
        }
        // (Round 120) The badge: its tier as a numeral, I, II or III, in
        // the tier's colour, small on the top corner of its icon (the
        // outer one, away from the next square), on a dark ground.
        // (Round 139: it sat in the corner only when a square was 16 pixels
        // or more, and no zoom made one that big: it never showed. Now it
        // straddles the square's top edge, at its outer corner, clear of
        // the place's own mark, at every zoom close enough for glyphs.)
        const u = 1;
        const nw = (tier * 2 + 1) * u;
        const nh = 5 * u;
        const nx = Math.round(right ? gx + bw - nw + u : gx - u);
        const ny = Math.round(gy - Math.ceil(nh / 2));
        ctx.fillStyle = '#140e08';
        ctx.fillRect(nx - u, ny - u, nw + 2 * u, nh + 2 * u);
        ctx.fillStyle = col;
        // (Its strokes, joined top and bottom by serifs.)
        for (let i = 0; i < tier; i++) ctx.fillRect(nx + (1 + i * 2) * u, ny, u, nh);
        ctx.fillRect(nx, ny, nw, u);
        ctx.fillRect(nx, ny + nh - u, nw, u);
      } else if (this.z >= TIER_FROM) {
        // (Round 128: only once the map's zoomed in far enough for it to
        // sit beside the place's mark, not over it.)
        const q = this.at(d.x, d.z);
        if (tier >= 3) {
          const k = (now * 0.8) % 1;
          ctx.save();
          ctx.globalAlpha = 0.6 * (1 - k);
          ctx.strokeStyle = '#ffd040';
          ctx.strokeRect(Math.round(q.x - 3 - k * 4) + 0.5, Math.round(q.y - 3 - k * 4) + 0.5, Math.round(6 + k * 8), Math.round(6 + k * 8));
          ctx.restore();
        }
        // (Round 139: its tier in pips, one to three, over its mark: a lone
        // dot was too small to see.)
        const px0 = Math.round(q.x) - tier;
        const py0 = Math.round(q.y) - 6;
        ctx.fillStyle = '#140e08';
        ctx.fillRect(px0 - 1, py0 - 1, tier * 2 + 1, 4);
        ctx.fillStyle = col;
        for (let i = 0; i < tier; i++) ctx.fillRect(px0 + i * 2, py0, 1, 2);
      }
    };
    // Old places, found or heard of. (Grey once beaten.) (Round 139: their
    // tier badges after them all, so the next place's mark can't cover one.)
    const badged = [];
    for (const d of game.sim.dungeons ? game.sim.dungeons.all : []) {
      if (!(d.known || d.seen || game.revealMap) || d.x === undefined) continue;
      const kav = d.type === 'kavorent';
      // (Round 71: an ancient place, in the colour of old blood.)
      const anc = !!dtypeOf(d).ancient;
      const fg = d.cleared ? '#8a8478' : kav ? (blink ? '#c8fbff' : '#5ad8f0') : anc ? (blink ? '#ffd0c0' : '#ff6a50') : '#f0d8a0';
      const what = d.cleared ? `beaten${d.clearedBy ? ` by ${d.clearedBy}` : ''}` : d.entered ? `${d.depth} floors deep` : kav ? (d.spire && d.spire.open !== null && d.spire.open !== undefined ? 'its door stands open' : 'sealed; it wants a cut stone') : 'never entered';
      // (Turned back with a time crystal: its tier. Round 61.)
      const tierTxt = ` · tier ${['', 'I', 'II', 'III'][Math.max(1, Math.min(3, d.tier || 1))]}`;
      put(d.x, d.z, OLD_PLACE_GLYPH[d.type] || '∩', fg, d.cleared ? '#26221e' : kav ? '#0e2430' : anc ? '#3a0a10' : '#3a2a16', `${cap(d.name)} (${dtypeOf(d).name}${anc ? ', an ancient place' : ''}) · ${what}${tierTxt}`, kav ? '#7ae0ff' : anc ? '#ff9080' : '#f0d8a0', true);
      badged.push(d);
    }
    for (const d of badged) tierBadge(d);
    // What people have told you of: a lake, a river, the coast.
    for (const q of game.world.ow.pins || []) {
      // (Round 73: a quest's marker blinks.)
      if (isQuestPin(q)) put(q.x, q.z, q.glyph || '!', blink ? '#1a1000' : '#fff4c0', blink ? '#ffd040' : '#c06010', `${q.label} (quest)`, '#ffd060', true);
      // (Round 79) A landmark, found or told of.
      else if (q.landmark) put(q.x, q.z, '♦', '#ffe8a0', '#3a2a10', `${q.label} (${LANDMARK_WORD[q.kind] || 'a landmark'})`, '#ffe8a0', true);
      else put(q.x, q.z, q.glyph || '•', '#bfe8ff', '#14304a', `${q.label} (told of)`, '#bfe8ff', true);
    }
    // (Round 79) Your own markers, wherever they are.
    for (const m of game.mapMarks || []) put(m.x, m.z, '◆', MARK_FG, '#0e3a2a', `${m.label} (your marker)`, MARK_FG, true);
    // (Round 68) The realms' ships at sea, where you know the water.
    const civs = game.world.ow.civs || [];
    for (const v of voyagesNow(game)) {
      const civ = civs.find((c) => c.id === v.civ);
      const col = civ ? civ.color.hex : '#e8e8e8';
      const what = { trade: 'a merchantman', settlers: 'a settler ship', war: 'a man-of-war', cargo: 'a cargo hulk' }[v.kind] || 'a ship';
      put(v.x, v.z, '⛵', v.kind === 'war' && blink ? '#ff8060' : '#f4f0e0', col, `The ${v.name}: ${what} of the ${civ ? civ.name.replace(/^The /, '') : 'sea'}`, col, !!game.revealMap);
    }
  }

  // (Round 68) The bridges across the straits of a land split in pieces:
  // a pale span with its piers, once either end's been seen.
  drawBridges(ctx, game, known, o, w, h) {
    const at = (x, z) => ({ x: o.x + (x / REGION_W) * w, y: o.y + (z / REGION_D) * h });
    for (const b of game.world.ow.bridges || []) {
      const k0 = known(Math.floor(b.x0 / REGION_W), Math.floor(b.z0 / REGION_D));
      const k1 = known(Math.floor(b.x1 / REGION_W), Math.floor(b.z1 / REGION_D));
      if (!k0 && !k1) continue;
      const a = at(b.x0, b.z0);
      const c = at(b.x1, b.z1);
      const wide = Math.max(1, Math.min(4, Math.round(this.z * (b.kind === 'causeway' ? 0.5 : 0.32))));
      ctx.strokeStyle = 'rgba(30,20,10,0.75)';
      ctx.lineWidth = wide + 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.strokeStyle = b.kind === 'plank' ? '#c8a064' : '#d8d4c8';
      ctx.lineWidth = wide;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      // (Its piers, at a closer look.)
      if (this.z >= 3 && b.kind !== 'plank') {
        const n = Math.max(2, Math.round(b.len / 16));
        ctx.fillStyle = '#6a6458';
        for (let i = 1; i < n; i++) {
          const q = at(b.x0 + ((b.x1 - b.x0) * i) / n, b.z0 + ((b.z1 - b.z0) * i) / n);
          ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2);
        }
      }
    }
    ctx.lineWidth = 1;
  }

  // Merchants on the roads, armies on the march, smoke over towns raided.
  drawMoving(ctx, game, w, h, icons, known, time) {
    if (this.z < 3) return;
    for (const s of game.world.ow.settlements) {
      const L = game.world.layouts.get(s.id);
      const rd = L && L.econ ? L.econ.raidedDay : undefined;
      if (rd === undefined || rd === null || game.day - rd > 3 || !known(s.cx, s.cz)) continue;
      const fresh = 1 - (game.day - rd) / 4;
      const q = this.at((s.cx + 1) * REGION_W, s.cz * REGION_D + 4);
      for (let i = 0; i < 4; i++) {
        const ph = (time * 0.45 + i / 4 + s.id * 0.13) % 1;
        ctx.fillStyle = `rgba(${game.day === rd ? '70,66,62' : '130,126,120'},${(1 - ph) * 0.55 * fresh})`;
        ctx.beginPath();
        ctx.arc(q.x + Math.sin(ph * 5 + i) * 2 + ph * 3, q.y - ph * 16, 1.5 + ph * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Goods on the move (a few, refreshed now and then).
    this.tradeT = (this.tradeT || 0) - 1;
    if (this.tradeT <= 0 || !this.trade) {
      this.tradeT = 20;
      const ents = game.caravans || new Map();
      const marks = new Map();
      const add = (k, x, z, live) => {
        const m = marks.get(k);
        if (!m || (live && !m.live)) marks.set(k, { x, z, live });
      };
      for (const tr of game.sim.travellers()) {
        if (!tr.pos || !(tr.company || (tr.rec && (tr.rec.traveler || tr.rec.job === 'merchant')))) continue;
        const n = ents.get(tr.key);
        const live = n && !n.dead;
        add(tr.company ? `g${tr.company.id}` : tr.key, live ? n.x : tr.pos.x, live ? n.z : tr.pos.z, live);
      }
      for (const [k, n] of ents) {
        if (n.dead || !n.tr || !(n.tr.company || n.tr.rec.traveler || n.tr.rec.job === 'merchant')) continue;
        add(n.tr.company ? `g${n.tr.company.id}` : k, n.x, n.z, true);
      }
      this.trade = [...marks.values()].sort((a, b) => b.live - a.live).slice(0, 14);
    }
    for (const t of this.trade) {
      const cx = Math.floor(t.x / REGION_W);
      const cz = Math.floor(t.z / REGION_D);
      if (!known(cx, cz) || icons.has(cz * 10000 + cx)) continue;
      const q = this.at(t.x, t.z);
      ctx.fillStyle = 'rgba(40,24,8,0.8)';
      ctx.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 2, 4, 4);
      ctx.fillStyle = Math.floor(time * 2 + t.x) % 2 ? '#ffe080' : '#f0c040';
      ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2);
    }
    for (const m of this.armies || []) {
      const q = this.at(m.x, m.z);
      const bx = Math.round(q.x);
      const by = Math.round(q.y);
      ctx.fillStyle = 'rgba(30,20,20,0.85)';
      for (let i = 1; i <= 3; i++) ctx.fillRect(bx - i * 3, by + 1, 2, 2);
      ctx.fillRect(bx, by - 8, 1, 10);
      ctx.fillStyle = m.color || '#c03030';
      ctx.fillRect(bx + 1, by - 8 + Math.round(Math.sin(time * 6) * 0.6), 5, 3);
    }
  }

  // The names of the lands, further out (and of the islands all together,
  // furthest out).
  drawLabels(ctx, game, w, h) {
    if (this.z > 9) return;
    const ow = game.world.ow;
    const label = (text, x, z, color) => {
      const q = this.at(x, z);
      drawText(ctx, text, Math.round(q.x - (text.length * CHAR_W) / 2), Math.round(q.y - CHAR_H / 2), color, '#000000');
    };
    for (const L of ow.lands) {
      const seen = game.revealMap || L.kind !== 'dagoni' || ow.islandCells(L.key).some((c) => ow.explored[c.cz * MAP_W + c.cx]);
      if (!seen) continue;
      const big = L.kind === 'continent';
      if (!big && this.z <= 1.5 && L.kind === 'isle') continue;
      label(big ? L.name.toUpperCase() : L.name, L.x, L.z - (L.kind === 'dagoni' && this.z > 4.5 ? L.trz * 0.6 : 0), L.kind === 'dagoni' ? '#fff0c8' : '#c8a878');
    }
    // (Round 84) A great continent's provinces, nearer in, once seen.
    if (this.z >= 2.5) {
      for (const P of ow.provinces || []) {
        const k = Math.floor(P.z / REGION_D) * MAP_W + Math.floor(P.x / REGION_W);
        if (game.revealMap || ow.explored[k]) label(P.name, P.x, P.z, '#a8b890');
      }
    }
    if (this.z <= 4.5) label(ARCHIPELAGO.toUpperCase().replace(/^THE /, 'THE '), (STORM.cx + 0.5) * REGION_W, (STORM.cz - STORM.rz - STORM.band - 2) * REGION_D, '#e8e0c8');
    if (this.z <= 6 && !ow.wallDown) label('the storm', (STORM.cx + 0.5) * REGION_W, (STORM.cz + STORM.rz + STORM.band / 2) * REGION_D, '#b8c8d8');
  }
}
