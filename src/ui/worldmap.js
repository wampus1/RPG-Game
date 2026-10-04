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
import { COLS, ROWS, MAP_W, MAP_H, REGION_W, REGION_D, CHAR_W, CHAR_H } from '../config.js';
import { Window, cap } from './window.js';
import { C } from './ascii.js';
import { BIOMES } from '../world/biomes.js';
import { dtypeOf } from '../world/dungeongen.js';
import { STORM, ARCHIPELAGO } from '../world/geography.js';
import { drawGlyph, drawText, glyphBitmap } from '../render/font.js';
import { teleportTo } from '../game/commands.js';
import { settlementIcons, roadCellLinks } from './windows.js';

// Pixels across a map square at each step of the zoom (a square is two
// thirds as tall as it is wide, like two characters side by side).
export const ZOOMS = [1.4, 3, 4.5, 6, 9, 12, 24];
const HOME_ZOOM = 5; // 12: the old map's scale
const GLYPHS_FROM = 12; // close enough to draw the glyphs
const TILES_FROM = 6; // ...or condensed tiles of them

// How a square is shown at a zoom (pixels a square): 'glyphs' close up
// (the map's own characters), 'tiles' a little further out (each glyph
// squeezed into its square), 'dots' furthest (a dot of its colour).
export function mapMode(z) {
  return z >= GLYPHS_FROM ? 'glyphs' : z >= TILES_FROM ? 'tiles' : 'dots';
}
const OLD_PLACE_GLYPH = { barrow: '∩', mine: '¥', crypt: '▼', holdout: 'Ω', kavorent: '║', grove: '♣', forge: '♨', grotto: 'Ψ' };
const LAKE = '#2a5a9a';

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
  if (M.fogN === n && M.fogReveal === reveal && M.fogRow === M.row) return;
  M.fogN = n;
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
  }

  // The map's area on screen, in pixels.
  area() {
    return { x0: (this.x + 1) * CHAR_W, y0: (this.y + 1) * CHAR_H, x1: (this.x + this.w - 1) * CHAR_W, y1: (this.y + this.h - 4) * CHAR_H };
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
    const e = Math.min(1, dt * 12);
    this.cam.x += (this.goal.x - this.cam.x) * e;
    this.cam.z += (this.goal.z - this.cam.z) * e;
    this.clampCam();
  }

  onClick(ck) {
    const a = this.area();
    if (ck.button === 0 && ck.x >= a.x0 && ck.x < a.x1 && ck.y >= a.y0 && ck.y < a.y1) this.drag = { x: ck.x, y: ck.y, cx: this.cam.x, cz: this.cam.z, moved: 0 };
    return true;
  }

  onWheel(d) {
    const m = this.ui.mouse;
    this.zoomTo(this.zi + (d > 0 ? -1 : 1), m ? m.x : null, m ? m.y : null);
  }

  onKey(k) {
    const game = this.ui.game;
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
      if (onLand && L.kind !== 'dagoni') return { line: `${cap(L.name)}: ${L.about}. Beyond the storm: only on the old charts.`, color: '#c8a878' };
      if (storm > 0) return { line: 'The storm: a wall of wind and wild water round the islands. No raft gets through it.', color: '#a0b8d0' };
      return { line: ow.insideStorm(x, z) ? 'Unexplored' : 'The open sea beyond the storm, never sailed.', color: C.dim };
    }
    const cell = ow.cell(cx, cz);
    const here = hf !== null && cell.halves ? cell.halves[hf] : cell.biome;
    let info = BIOMES[here]?.name || cap(here);
    if (onLand) info = `${cap(L.name)} · ${info}`;
    else if (storm > 0) info = 'The storm · wild water no raft gets through';
    else if (cell.biome === 'ocean') info = ow.insideStorm(x, z) ? `The sea between ${ARCHIPELAGO}` : 'The open sea';
    if (cell.river && hf !== 0) info += ' · river';
    if (cell.lake) info += ' · lake';
    const V = ow.volcano;
    if (V && cx === V.cx && cz === V.cz) info += ' · the Sleeper (the mountain of fire)';
    return { line: info, color: C.hi, cell };
  }

  draw(g, game) {
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: `WORLD MAP · ${ARCHIPELAGO.toUpperCase()}` });
    // (The map itself is drawn in pixels over this: see drawPixels.)
    for (let y = 1; y < this.h - 4; y++) g.text(1, y, ' '.repeat(this.w - 2), '#000000', '#08080e');
    if (!game) return;
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
        let info = `${s.name} · ${cap(s.type)} · ${s.condition} · ${BIOMES[s.biome]?.name || s.biome}${s.island ? ` · ${cap(ow.island(s.island)?.name || s.island)}` : ''}`;
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
      put(y0, `Zoom ${Math.round((this.z / 12) * 100)}% · each square = 2x2 screens · point at anything for details.`, C.dim);
      put(y0 + 1, '', C.dim);
    }
    put(y0 + 2, '⌂ village ■ town ╔╗ city † ruin X battle ! raid ▲ bandits ∩¥▼Ω old place ║ spire • told of', C.faint);
    const t = ` ${game.cheats?.mapTeleport ? '[CLICK] teleport  ' : ''}[WHEEL/+-] zoom [DRAG/WASD] move [SPACE] you [V] ${this.civView ? 'biomes' : 'realms'} [M] close `;
    g.text(Math.max(1, this.w - t.length - 1), this.h - 1, t.slice(0, this.w - 2), game.cheats?.mapTeleport ? C.hi : C.dim);
  }

  // A battle, a raid, a camp or an old place at a square (for the words
  // under the map), from what was drawn last.
  markAt(game, cx, cz) {
    for (const m of this.marks || []) if (m.cx === cx && m.cz === cz) return m;
    return null;
  }

  drawPixels(ctx, game) {
    if (!game) return;
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
    const cx0 = Math.max(0, Math.floor((a.x0 - o.x) / w));
    const cz0 = Math.max(0, Math.floor((a.y0 - o.y) / h));
    const cx1 = Math.min(MAP_W - 1, Math.floor((a.x1 - o.x) / w));
    const cz1 = Math.min(MAP_H - 1, Math.floor((a.y1 - o.y) / h));
    const M = worldCache(ow);
    const icons = settlementIcons(game);
    this.icons = icons;
    if (mapMode(this.z) === 'dots') {
      // Far out: the world a dot a square, under its fog.
      refreshFog(ow, reveal);
      if (M.base) {
        ctx.drawImage(M.base, 0, 0, MAP_W, MAP_H, o.x, o.y, MAP_W * w, MAP_H * h);
        ctx.drawImage(M.fog, 0, 0, MAP_W, MAP_H, o.x, o.y, MAP_W * w, MAP_H * h);
      }
      if (this.civView) {
        for (const c of ow.liveCells) {
          if (c.civ === null || !ow.civs[c.civ] || !known(c.cx, c.cz)) continue;
          ctx.fillStyle = ow.civs[c.civ].color.hex;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(o.x + c.cx * w, o.y + c.cz * h, Math.ceil(w), Math.ceil(h));
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
                ch = (cx + cz + Math.floor(time * 4)) % 3 ? '≈' : '~';
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
    if (!ow.wallDown) this.drawStorm(ctx, game, o, w, h, time);
    this.drawRoads(ctx, game, o, w, h, icons, known);
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
        ctx.fillStyle = shadeHex(s.civ ? s.civ.color.hex : '#e8e8e8', icon.shade);
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
        const col = s.civ ? s.civ.color.hex : '#d8d8d8';
        if (this.z >= TILES_FROM) {
          ctx.fillStyle = shadeHex(col, 0.7);
          ctx.fillRect(o.x + cx * w, o.y + cz * h, w, h);
          ctx.fillStyle = s.condition === 'abandoned' || s.deserted ? '#8a8478' : '#fff4d0';
          ctx.fillRect(o.x + cx * w + w / 2 - 1, o.y + cz * h + h / 2 - 1, 2, 2);
        } else if (!seen.has(s.id)) {
          seen.add(s.id);
          const q = this.at((s.cx + s.cw / 2) * REGION_W, (s.cz + s.cd / 2) * REGION_D);
          const r = s.type === 'city' ? 2 : s.type === 'town' ? 1.5 : 1;
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
      if (m.kind === 'raid') {
        if (blink) put(m.x, m.z, '!', '#ffffff', '#c03020', m.label);
        else marks.push({ cx: Math.floor(m.x / REGION_W), cz: Math.floor(m.z / REGION_D), label: m.label });
      } else put(m.x, m.z, 'X', m.kind === 'battle' ? '#ffffff' : '#ff9080', m.kind === 'battle' ? (blink ? '#c02020' : '#801818') : '#3a1a1a', m.label);
    }
    // Bandit camps you've heard of (or seen the smoke of).
    for (const c of game.sim.bandits ? game.sim.bandits.knownCamps() : []) {
      put(c.x, c.z, '▲', c.hired ? '#ffd080' : '#f0a060', '#3a1a10', `Camp of ${c.name} (${c.n} of them${c.hired ? ', hired swords' : ''})${c.from ? `: heard of from ${c.from}` : ''}`, null, true);
    }
    // Old places, found or heard of. (Grey once beaten.)
    for (const d of game.sim.dungeons ? game.sim.dungeons.all : []) {
      if (!(d.known || d.seen || game.revealMap) || d.x === undefined) continue;
      const kav = d.type === 'kavorent';
      const fg = d.cleared ? '#8a8478' : kav ? (blink ? '#c8fbff' : '#5ad8f0') : '#f0d8a0';
      const what = d.cleared ? `beaten${d.clearedBy ? ` by ${d.clearedBy}` : ''}` : d.entered ? `${d.depth} floors deep` : kav ? (d.spire && d.spire.open !== null && d.spire.open !== undefined ? 'its door stands open' : 'sealed; it wants a cut stone') : 'never entered';
      put(d.x, d.z, OLD_PLACE_GLYPH[d.type] || '∩', fg, d.cleared ? '#26221e' : kav ? '#0e2430' : '#3a2a16', `${cap(d.name)} (${dtypeOf(d).name}) · ${what}`, kav ? '#7ae0ff' : '#f0d8a0', true);
    }
    // What people have told you of: a lake, a river, the coast.
    for (const q of game.world.ow.pins || []) put(q.x, q.z, q.glyph || '•', '#bfe8ff', '#14304a', `${q.label} (told of)`, '#bfe8ff', true);
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
    if (this.z <= 4.5) label(ARCHIPELAGO.toUpperCase().replace(/^THE /, 'THE '), (STORM.cx + 0.5) * REGION_W, (STORM.cz - STORM.rz - STORM.band - 2) * REGION_D, '#e8e0c8');
    if (this.z <= 6 && !ow.wallDown) label('the storm', (STORM.cx + 0.5) * REGION_W, (STORM.cz + STORM.rz + STORM.band / 2) * REGION_D, '#b8c8d8');
  }
}
