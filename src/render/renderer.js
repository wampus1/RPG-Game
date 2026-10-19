// World renderer: draws the voxel grid in an oblique 3/4 projection using
// the painter's algorithm (rows north->south, layers bottom->top), with
// entities interleaved, roof cut-aways, occlusion fading and lighting.
import { LOOKED, LOOK_OF } from './lookart.js';
import { drawSpyRing } from '../game/spyglass.js';
import { InstrumentVoice } from '../game/instruments.js';
import { drawAmbience } from './ambience.js';
import { planDecos, drawCopyBox } from './planfx.js';
import { drawGrapples } from './seafx.js';
import { TILE, LH, VIEW_W, VIEW_H, WORLD_Y, REGION_W, REGION_D, GROUND, SURFACE, DAY_MINUTES } from '../config.js';
import { BLOCKS, B, META_ROT, META_STATE, CROPS, cropStage, CANOPY_SHIFT, CANOPY_STYLE_SHIFT, NATURAL, ORE_GLINT, LEAVES, LOGS } from '../world/blocks.js';
import { TEX, SPR_H, VARIANTS, WATER_FRAMES, buildTextures, CRAFTS, CRAFTED } from './textures.js';
import { pieceFrame, PIECE_NAMES, PIECE_W, PIECE_FRAMES, PIECE_FPS, drawWards } from './pieces.js';
import './farpieces.js';
import { humanoidSheet, humanoidPose, creatureSheet, lookFrame, itemIcon, bittenIcon, drawJewelled, frameGlow, CHAR_W, CHAR_H, SPR_PAD, SHEET_H, headSprite, WAGON_SEAT, catapultSprite, CATAPULT_W, CATAPULT_H, ramSprite, RAM_W, RAM_H, shipSprite, SHIP_W, SHIP_H, SHIP_DECK, tentSprite } from './sprites.js';
import { drawText, textWidth } from './font.js';
import { hash4 } from '../util/rng.js';
import { ITEMS, GEMS } from '../world/items.js';
import { Lighting, skyLight } from './lighting.js';
import { addEffect, drawEffects, drawBurning, drawStatus, drawLasers, drawKavSpikes, drawShields } from './fx.js';
import { throwDice, stepDice, drawDie } from './dice.js';
import { drawOldPlaces } from './oldplaces.js';
import { drawStormSea, drawStormCover } from './stormfx.js';
import { drawWing, wingInFront, drawWingBurst } from './wing.js';
import { drawOrbs } from './orbfx.js';
import { drawBossUnder, drawBossBody, bossScale, bossTint, drawnAsMaster, BOSS_SCALE } from './bossart.js';
import { drawBossArt } from './bossbody.js';
import { watchBoss } from './bossanim.js';
import { shipDecos, drawShipGhost } from './shipvox.js';
import { evolvedDecos } from './evolvedfx.js';
import { drawCannonballs, drawShipHud } from './shiphud.js';

// A camera turn takes this long; the pictures swung round are big enough to
// cover the screen at any angle (two screens across and two down, stitched).
const SPIN_TIME = 0.38;
const SNAP_W = Math.ceil(Math.hypot(VIEW_W, VIEW_H)) + 4;
const SNAP_H = VIEW_H * 2;
import { raftSprite, RAFT_BOX } from '../entities/raft.js';
import { MODS } from '../mod/state.js';
import { FX_CAPS } from '../game/settings.js';
import { TUNNEL_DIG } from '../game/evolvedgear.js';
import { displayItems, paintingSubject, wallDirOf } from '../game/displays.js';
import { paintingArt } from './paintings.js';
import { GroundFx } from './groundfx.js';
import { steedSprite, dirAngle, easeAngle, steedSlices, steedRows } from './steeds.js';
import { chairTable } from '../game/chairs.js';
import { pixelsIn } from './pixels.js';

// (Round 114) Which floors fray into their neighbours (see
// Renderer.blendEdges): earth, stone, sand, moss and the like; not what's
// laid in squares on purpose (rugs, decks, planks, bridges, tiles, trims,
// grates, stairs), nor liquids.
// (Round 114) Which of a block's four drawings a tile wears: the first,
// most often (it's the plain one), the last, least (the one with a pebble
// in it, a bone, a flower): half, a quarter, and the rest between the two.
const VAR_PICK = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3];
export const variantAt = (x, y, z) => VAR_PICK[hash4(x, y, z) % VAR_PICK.length] % VARIANTS;
const NO_FRAY = /rug|carpet|plank|board|deck|bridge|lid|trim|tile|glazed|inlay|mosaic|sectile|runner|grate|stair|abyss|door|seal|gilt|marble|rubedo|albedo|nigredo/;
const FRAYS = new Map();
function floorBlends(id) {
  let f = FRAYS.get(id);
  if (f !== undefined) return f;
  const b = BLOCKS[id];
  f = !!(b && b.render === 'cube' && b.opaque && !b.liquid && !b.sprite && !NO_FRAY.test(b.name));
  FRAYS.set(id, f);
  return f;
}

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// (Round 82) Iron bars, and the cell doors hung in them: drawn as a grille
// (see Renderer.drawBars), not a box.
let BAR_IDS = null;
const barIds = () => (BAR_IDS ||= new Set([B.iron_bars, B.cell_door, B.cell_door_top, B.cell_door_open]));

// (Round 82) Where passengers sit in a wagon's bed, back from the bench.
const BED_F = [-0.75, -1.25, -1.75];

const CULL_SAME = new Set();
// (Round 80) Rows' layers of ground drawn again into their pictures (see
// groundStrip) at most this many a frame; past that, a layer's drawn the
// old way, square by square, till its turn comes.
const STRIP_BUDGET = 6;
// How far past the view (columns, each side) a picture of a row reaches,
// so walking on doesn't call for a new one every step.
const STRIP_REACH = 14;
// (Rows' pictures not used this many frames are let go.)
const STRIP_KEEP = 240;

// Lights carried in the hand: where the flame sits in the item's picture,
// its glow, and how often an ember flies off it.
const HELD_FLAMES = {
  torch: { x: 8, y: 3, r: 7, glow: 'rgba(255,190,90,0.9)', ember: 0.18, colors: ['#ffd070', '#ff9a40', '#fff0b0'] },
  lantern: { x: 8, y: 8, r: 6, glow: 'rgba(255,210,120,0.8)', ember: 0.04, colors: ['#ffe0a0'] },
  kav_everlight: { x: 8, y: 7, r: 8, glow: 'rgba(140,240,255,0.9)', ember: 0.1, colors: ['#a8f4ff', '#ffffff'] },
};

// A held thing's picture points up and to the right from its grip; turned
// this far it points straight down, or straight up.
const THRUST_DOWN = Math.PI * 0.75;
const THRUST_UP = -Math.PI * 0.25;

// Which blocks are the Kavorent's own (recoloured floor by floor).
let KAV_TINTED = null;
// The great things in a square (see pieces.js), by id.
const PIECE_IDS = new Uint8Array(BLOCKS.length);
for (const n of PIECE_NAMES) PIECE_IDS[B[n]] = 1;
// Which blocks are made in a people's craft (see textures.CRAFTED).
let craftedIds = null;
// (Round 79) A line two pixels thick from (x0, y0) to (x1, y1): a pixel
// wider across the way it runs.
function thickLine(ctx, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const steep = Math.abs(dy) > Math.abs(dx);
  for (let i = 0; i < steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    ctx.fillRect(x, y, steep ? 2 : 1, steep ? 1 : 2);
  }
}

// (Round 79) Which sides of a rug run on into the same rug (1 up, 2
// right, 4 down, 8 left).
// (Round 82) Which of a rug's sides, as it's seen (up, right, down, left
// on the screen, the camera turned however it is), run on into more of the
// same; and its fringe kept at the same ends of it (its north and south)
// whichever way you look: across the screen's top and bottom, or (turned a
// quarter) down its sides (+16).
const RUG_SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function rugJoin(world, x, y, z, id, view = 0) {
  let m = 0;
  for (let i = 0; i < 4; i++) {
    const [u, v] = RUG_SIDES[i];
    const dx = view === 1 ? v : view === 2 ? -u : view === 3 ? -v : u;
    const dz = view === 1 ? -u : view === 2 ? -v : view === 3 ? u : v;
    if (world.getBlock(x + dx, y, z + dz) === id) m |= 1 << i;
  }
  return m | (view & 1 ? 16 : 0);
}

// (Round 84) What's drawn in its people's own look (see lookart.js).
let lookedIds = null;
function lookedId() {
  if (!lookedIds) {
    lookedIds = new Uint8Array(BLOCKS.length);
    for (const b of BLOCKS) if (LOOKED.has(b.name)) lookedIds[b.id] = 1;
  }
  return lookedIds;
}

function craftedId() {
  if (!craftedIds) {
    craftedIds = new Uint8Array(BLOCKS.length);
    for (const b of BLOCKS) if (CRAFTED.has(b.name)) craftedIds[b.id] = 1;
  }
  return craftedIds;
}

function kavTinted() {
  if (!KAV_TINTED) {
    KAV_TINTED = new Uint8Array(BLOCKS.length);
    for (let id = 0; id < BLOCKS.length; id++) if (BLOCKS[id].name.startsWith('kav_')) KAV_TINTED[id] = 1;
  }
  return KAV_TINTED;
}

// Turn the colours in some pixels: the bright ones' hue by `turn` degrees,
// the dull ones (the alloy) to a dark of the ruin's light's new hue, and
// how much colour there is by `sat`.
const KAV_HUE = 191;
function recolour(d, turn, sat) {
  const hp = (p, q, t) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i] / 255;
    const g = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const dd = mx - mn;
    if (dd < 0.02) continue;
    const l = (mx + mn) / 2;
    let s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    let h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
    h *= 60;
    if (dd < 0.2) {
      h = KAV_HUE + turn;
      s *= 0.8;
    } else h += turn;
    h = (((h % 360) + 360) % 360) / 360;
    s = Math.min(1, s * sat);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    d[i] = Math.round(hp(p, q, h + 1 / 3) * 255);
    d[i + 1] = Math.round(hp(p, q, h) * 255);
    d[i + 2] = Math.round(hp(p, q, h - 1 / 3) * 255);
  }
}

// (Round 82) What's said, in lines short enough for a bubble: words kept
// whole where they can be, at most three lines (the last cut short).
const BUBBLE_CHARS = 30;
// (How long a broom takes to come out, or go away: see drawBroom.)
const SWEEP_STOW = 0.45;
// (Round 82) How long a door takes to swing, and a chest's lid to lift.
export const SWING_S = 0.24;
export const LID_S = 0.3;
const bubbleWrap = new Map();
export function bubbleLines(text) {
  let got = bubbleWrap.get(text);
  if (got) return got;
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let wd = word;
    while (wd.length > BUBBLE_CHARS) {
      if (line) out.push(line);
      line = '';
      out.push(wd.slice(0, BUBBLE_CHARS));
      wd = wd.slice(BUBBLE_CHARS);
    }
    if (!line) line = wd;
    else if (line.length + 1 + wd.length <= BUBBLE_CHARS) line += ` ${wd}`;
    else {
      out.push(line);
      line = wd;
    }
  }
  if (line || !out.length) out.push(line);
  got = out.length > 3 ? [...out.slice(0, 2), `${out[2].slice(0, BUBBLE_CHARS - 1)}…`] : out;
  if (bubbleWrap.size > 400) bubbleWrap.clear();
  bubbleWrap.set(text, got);
  return got;
}

// (Round 88) How far off an instrument's still heard, in paces.
const NOTE_EARSHOT = 24;

// (Round 117) A picture's drawing state put back as it starts: every save
// let go of, no turn or shift, nothing see-through, drawn plainly.
// (Round 118: `keep`, what's drawn kept: for the screen the HUD went
// wrong on, the world already drawn on it.)
export function cleanCtx(ctx, keep = false) {
  if (!ctx) return;
  if (ctx.reset && !keep) {
    // (Clears the picture too: it's drawn afresh next frame anyway.)
    ctx.reset();
  } else {
    for (let i = 0; i < 64; i++) ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if ('filter' in ctx) ctx.filter = 'none';
    ctx.shadowBlur = 0;
  }
  ctx.imageSmoothingEnabled = false;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.mainCtx = this.ctx;
    // The size of the world's picture (the view, or bigger when the camera's
    // drawn back: see render).
    this.vw = VIEW_W;
    this.vh = VIEW_H;
    this.zoom = 1;
    this.zoomGoal = 1;
    this.zoomK = 1;
    buildTextures();
    this.atlas = TEX.atlas;
    this.camX = 0;
    this.camY = 0;
    this.time = 0;
    this.wobbles = new Map();
    // (Round 82) Doors swinging, chests' lids lifted (see swing, lidOpen).
    this.swings = new Map();
    // (Round 83) Chairs being pushed in or pulled out: key -> { t, from, k }.
    this.chairs = new Map();
    this.lids = new Map();
    this.lidHeld = new Map();
    this.particles = [];
    // (Round 77) Rain, snow and water on the ground (see groundfx.js).
    this.gfx = new GroundFx(this);
    this.fx = [];
    this.floaters = [];
    this.lighting = new Lighting();
    this.dropIcons = new Map();
    this.heads = new Map();
    for (const b of BLOCKS) if (b.name.startsWith('leaves') || b.name === 'glass' || b.name === 'water' || b.name === 'ice') CULL_SAME.add(b.id);
    this.hidden = null;
    this.hiddenLevel = 99;
    // Which way the camera looks, in quarter turns (Q and E turn it). The
    // world is drawn in "view" coordinates (u across, v down the screen).
    this.view = 0;
    // A camera turn in progress: pictures of the scene before and after,
    // spun about the player from one to the other.
    this.spin = null;
    // The mouse pointer, and whatever was drawn last under it.
    this.mouse = null;
    this.pick = null;
    this.pickEnt = null;
  }

  // World (x, z) to view (u, v), and back.
  // (0 - a rather than -a, so there's never a negative zero.)
  toView(x, z) {
    switch (this.view) {
      case 1: return [0 - z, x];
      case 2: return [0 - x, 0 - z];
      case 3: return [z, 0 - x];
      default: return [x, z];
    }
  }

  // A direction in the world, as it points on screen.
  toViewDir(dx, dz) {
    return this.toView(dx, dz);
  }

  toWorld(u, v) {
    switch (this.view) {
      case 1: return [v, 0 - u];
      case 2: return [0 - u, 0 - v];
      case 3: return [0 - v, u];
      default: return [u, v];
    }
  }

  // A facing (0 down the screen, 1 left, 2 up, 3 right) as it looks now.
  viewDir(d) {
    return (d + this.view) & 3;
  }

  // Turn the camera a quarter turn (+1 or -1). What you saw is kept, to be
  // swung round into the new view over the next few frames.
  turn(d) {
    const game = this.game;
    const from = game && this.ctx ? this.snapshot(game) : null;
    this.view = (this.view + d + 4) & 3;
    this.camInit = false;
    this.particles.length = 0;
    this.floaters.length = 0;
    this.lighting.samples = null;
    this.spin = from ? { from, to: null, d, t: 0, dur: SPIN_TIME } : null;
  }

  // Where the player's feet are on screen.
  playerPoint(game) {
    const rp = game.player.renderPos();
    const [u, v] = this.toView(rp.x, rp.z);
    return { x: u * TILE + 8 - this.camX, y: v * TILE - rp.y * LH + 8 - this.camY };
  }

  // A picture of the scene round the camera, larger than the screen so it
  // can be turned without showing its edges: four views stitched together.
  snapshot(game) {
    // (As big as the view needs, drawn back or not: wide enough to turn
    // a quarter without its corners showing.)
    const z = (this.vw || VIEW_W) / VIEW_W;
    const SW = Math.min(2 * this.vw, Math.round(SNAP_W * z));
    const SH = Math.min(2 * this.vh, Math.round(SNAP_H * z));
    const c = document.createElement('canvas');
    c.width = SW;
    c.height = SH;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const camX = this.camX;
    const camY = this.camY;
    // (Drawn back, the world's drawn on its own bigger canvas: see render.)
    const prevCtx = this.ctx;
    if (this.zoomK !== 1 && this.zcanvas) this.ctx = this.zcanvas.getContext('2d');
    const x0 = Math.round((this.vw - SW) / 2);
    const y0 = Math.round((this.vh - SH) / 2);
    // (Speech and falling rain or snow aren't part of the picture: they're
    // drawn upright over the turn, see drawSpin.)
    const bubbles = new Map();
    for (const ox of [x0, x0 + SW - this.vw]) {
      for (const oy of [y0, y0 + SH - this.vh]) {
        this.camX = camX + ox;
        this.camY = camY + oy;
        this.drawScene(game, 0, true);
        cx.drawImage(this.ctx.canvas, 0, 0, this.vw, this.vh, ox - x0, oy - y0, this.vw, this.vh);
        for (const b of this.bubbles) {
          const q = { ...b, x: b.x + ox - x0, y: b.y + oy - y0 };
          bubbles.set(`${b.text}|${Math.round(q.x)}|${Math.round(q.y)}`, q);
        }
      }
    }
    this.camX = camX;
    this.camY = camY;
    this.ctx = prevCtx;
    const p = this.playerPoint(game);
    return { canvas: c, px: p.x - x0, py: p.y - y0, bubbles: [...bubbles.values()] };
  }

  // The turn itself: the old view swings away as the new one swings in.
  drawSpin(game, dt) {
    const sp = this.spin;
    if (!sp.to) {
      sp.to = this.snapshot(game);
      // (Its speech is drawn turning with it, not upright over the view.)
      this.bubbles = [];
    }
    sp.t += dt;
    const k = Math.min(1, sp.t / sp.dur);
    const e = k * k * (3 - 2 * k);
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, this.vw, this.vh);
    const at = this.playerPoint(game);
    const q = (Math.PI / 2) * sp.d;
    const draw = (shot, ang, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(at.x, at.y);
      ctx.rotate(ang);
      ctx.drawImage(shot.canvas, -shot.px, -shot.py);
      ctx.restore();
    };
    draw(sp.from, q * e, 1);
    draw(sp.to, -q * (1 - e), e);
    // The falling rain and snow, and what people are saying, stay upright:
    // the words travel round with whoever's speaking. (The fog and the grey
    // of a wet day are in the pictures, under the night like always, so the
    // turn doesn't wash the dark out.)
    this.drawWeather(game, dt, 'drops');
    // (The storm's clouds and its red, and its last white and black, are
    // the view's own, upright: see drawStormSea.)
    drawStormSea(this, game, 'sky');
    drawStormCover(this, game);
    const words = (shot, ang, alpha) => {
      if (alpha <= 0.02) return;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      ctx.globalAlpha = alpha;
      for (const b of shot.bubbles || []) {
        const dx = b.x - shot.px;
        const dy = b.y - shot.py;
        const x = Math.round(at.x + dx * c - dy * s);
        const y = Math.round(at.y + dx * s + dy * c);
        if (b.emote) drawText(ctx, b.text, x, y, b.color, '#000');
        else this.drawBubble(ctx, b.text, x, y, b.color);
      }
      ctx.globalAlpha = 1;
    };
    words(sp.from, q * e, 1 - e);
    words(sp.to, -q * (1 - e), e);
    if (k >= 1) this.spin = null;
  }

  // Everything in the world (not the pointer's highlights): the ground,
  // buildings, people, light and speech.
  drawScene(game, dt, snap = false) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (game.cutscene && game.cutscene.noCutaway) this.hidden = null;
    else this.computeCutaway(game.world, game.player, game.buildingAtPlayer ? game.buildingAtPlayer() : null);
    this.bubbles = [];
    this.tags = [];
    this.wingsLit = [];
    this.pick = null;
    this.pickEnt = null;
    this.shipPick = null;
    this.pickSeq = 0;
    this.playerBehind = false;
    this.drawWorld(game);
    // (Round 87) Behind a building: a ghost of you over it.
    if (this.playerBehind) this.drawPlayerGhost(ctx, game);
    this.drawProjectiles(game);
    drawCannonballs(this, game);
    // (Round 78) A pirate's grapnels (see render/seafx.js).
    drawGrapples(this, game);
    this.drawWeather(game, dt, snap ? 'tint' : 'all');
    this.drawAshfall(game, dt);
    // (Round 79) Valley fog, ridge wind (see ambience.js).
    if (!snap) drawAmbience(this, game, dt, 'under');
    this.lighting.draw(this, game);
    // (And the heat's shimmer, over all of it.)
    if (!snap) drawAmbience(this, game, dt, 'over');
    // (Round 78) A copy box out (see render/planfx.js), over the light.
    drawCopyBox(this, game);
    if (this.underground && this.hidden) this.drawDigView(game);
    drawStormSea(this, game, snap ? 'world' : 'all');
    drawOldPlaces(this, game, dt);
    drawEffects(this, this.ctx, dt);
    // (Round 62) The world's mods' effects and shots.
    if (MODS.active.length) MODS.draw?.(this, this.ctx, game, dt);
    drawKavSpikes(this, this.ctx, game);
    drawLasers(this, this.ctx, game);
    drawOrbs(this, this.ctx, game);
    drawShields(this, this.ctx, game);
    drawWards(this, this.ctx, game);
    this.drawParticles(dt);
    this.drawInk(game);
    this.drawAim(game);
    if (!snap) drawStormCover(this, game);
    if (snap || this.zoomK !== 1) return;
    // The names of those you're playing with, and how they are.
    for (const t of this.tags) {
      drawText(ctx, t.name, t.x, t.y, t.color, '#000');
      if (t.f === null) continue;
      ctx.fillStyle = '#1a1018';
      ctx.fillRect(t.sx + 2, t.y + 7, 14, 3);
      ctx.fillStyle = t.f > 0.5 ? '#58c048' : t.f > 0.25 ? '#e8c030' : '#e04040';
      ctx.fillRect(t.sx + 3, t.y + 8, Math.round(12 * t.f), 1);
    }
    // Speech bubbles and emotes go on top of everything, roofs included
    // (or later, over a place's name and the notices: see drawBubbles).
    this.bubbleK = 1;
    if (!this.deferBubbles) this.drawBubbles(ctx);
  }

  // What's being said, on the screen's own picture (`bubbleK`: how far the
  // camera's drawn back). The UI calls it over its banner and notices,
  // under its windows, when `deferBubbles` is set.
  drawBubbles(ctx) {
    const z = this.bubbleK || 1;
    for (const b of this.bubbles || []) {
      if (b.emote) drawText(ctx, b.text, Math.round(b.x / z), Math.round(b.y / z), b.color, '#000');
      else this.drawBubble(ctx, b.text, b.x / z, b.y / z, b.color);
    }
  }

  worldToScreen(fx, fy, fz) {
    const [u, v] = this.toView(fx, fz);
    return { x: u * TILE - this.camX, y: v * TILE - fy * LH - this.camY };
  }

  // Screen pixel -> world (x,z) at a given layer y (top-face plane of that layer).
  screenToTile(sx, sy, y) {
    const u = Math.floor((sx + this.camX) / TILE);
    const v = Math.floor((sy + this.camY + y * LH) / TILE);
    const [x, z] = this.toWorld(u, v);
    return { x, z };
  }

  // The world rectangle the screen can show (with a margin, in tiles).
  visibleBox(margin = 2) {
    const u0 = Math.floor(this.camX / TILE) - margin;
    const u1 = Math.floor((this.camX + this.vw) / TILE) + margin;
    const v0 = Math.floor((this.camY - SPR_H - LH) / TILE) - margin;
    const v1 = Math.floor((this.camY + this.vh + (WORLD_Y - 1) * LH) / TILE) + margin;
    const a = this.toWorld(u0, v0);
    const b = this.toWorld(u1, v1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
  }

  // Is the mouse over an atlas image drawn at (dx, dy)? (Solid pixels only
  // when `alphaTest`.)
  // Asleep in a tent: Zs drifting up off its ridge, swaying, growing and
  // fading as they rise, one after another.
  drawSnores(ctx, x, y, seed) {
    const a0 = ctx.globalAlpha;
    for (let i = 0; i < 3; i++) {
      const k = (this.time * 0.45 + i / 3 + (seed % 7) * 0.13) % 1;
      const zx = Math.round(x + 2 + k * 8 + Math.sin(k * 6 + i) * 2);
      const zy = Math.round(y - k * 18);
      ctx.globalAlpha = a0 * Math.min(1, k * 4) * (1 - k) * 0.95;
      drawText(ctx, k > 0.5 ? 'Z' : 'z', zx, zy, '#e8f0ff', '#283048');
    }
    ctx.globalAlpha = a0;
  }

  under(s, dx, dy, w = s.w, h = s.h, alphaTest = true) {
    const m = this.mouse;
    if (!m) return false;
    const px = m.x - dx;
    const py = m.y - dy;
    if (px < 0 || py < 0 || px >= w || py >= h) return false;
    if (!alphaTest || !TEX.alpha) return true;
    const sx = Math.floor(px * (s.w / w));
    const sy = Math.floor(py * (s.h / h));
    return TEX.alpha.data[(s.y + sy) * TEX.alpha.w + s.x + sx] > 40;
  }

  // ------------------------------------------------------------------ frame
  // The camera drawn back (near a Kavorent spire, say, or in a scene): the
  // world drawn on a bigger picture of its own, which goes to the screen
  // apart from the view (see CRT.present), every one of its pixels sharp;
  // the view keeps only what's over it (speech, the UI). The camera eases
  // in and out like a spring, without overshooting; a scene's own zoom is
  // taken as it comes. A turn of the camera swings round drawn back too.
  render(game, dt) {
    const goal = this.zoomGoal || 1;
    if (this.zoomSnap) {
      this.zoom = goal;
      this.zoomV = 0;
    } else {
      const w = 2.4;
      this.zoomV = (this.zoomV || 0) + ((goal - this.zoom) * w * w - 2 * w * (this.zoomV || 0)) * dt;
      this.zoom += this.zoomV * dt;
      if (Math.abs(this.zoom - goal) < 0.0015 && Math.abs(this.zoomV) < 0.002) {
        this.zoom = goal;
        this.zoomV = 0;
      }
    }
    const main = this.mainCtx;
    const vw = Math.round(VIEW_W * this.zoom);
    const vh = Math.round(VIEW_H * this.zoom);
    const pw = this.vw || VIEW_W;
    const ph = this.vh || VIEW_H;
    if (vw !== VIEW_W || vh !== VIEW_H) {
      if (!this.zcanvas) this.zcanvas = document.createElement('canvas');
      if (this.zcanvas.width !== vw || this.zcanvas.height !== vh) {
        this.zcanvas.width = vw;
        this.zcanvas.height = vh;
      }
      this.ctx = this.zcanvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.vw = vw;
      this.vh = vh;
    } else {
      this.ctx = main;
      this.vw = VIEW_W;
      this.vh = VIEW_H;
    }
    // (Re-centred on the same spot as the picture grows.)
    if (this.camInit && (this.vw !== pw || this.vh !== ph)) {
      this.cx -= (this.vw - pw) / 2;
      this.cy -= (this.vh - ph) / 2;
    }
    const z = this.vw / VIEW_W;
    this.zoomK = this.vw === VIEW_W && this.vh === VIEW_H ? 1 : z;
    // (Round 117) Something gone wrong mid-drawing (a thing turned or moved
    // to be drawn, and never put back) mustn't leave the picture turned and
    // moved for every frame after, more each time: drawn from a clean
    // slate, both pictures, whatever happened.
    try {
      this.renderFrame(game, dt);
    } catch (e) {
      cleanCtx(this.ctx);
      if (main !== this.ctx) cleanCtx(main);
      throw e;
    }
    this.layer = null;
    if (this.zoomK !== 1) {
      this.layer = this.zcanvas;
      // (Round 80: a new drawing of it, for the screen to take: see
      // CRT.present.)
      this.layerV = (this.layerV || 0) + 1;
      main.clearRect(0, 0, VIEW_W, VIEW_H);
      this.bubbleK = z;
      if (!this.deferBubbles) this.drawBubbles(main);
      this.ctx = main;
      // (Round 69: the ship's gauges on the screen, not the drawn-back
      // world: see renderFrame.)
      if (!this.spin) drawShipHud(this, game);
    }
  }

  renderFrame(game, dt) {
    this.frameDt = dt;
    // (Round 80) This frame's share of new particles and effects (see room
    // and fx.addEffect).
    const cap = this.fxCap || FX_CAPS[0];
    this.partLeft = cap.parts;
    this.fxLeft = cap.fx;
    this.game = game;
    this.time += dt;
    this.tickHinges(game, dt);
    // (Round 62) The atlas grown (or cut back) for a world's mods.
    if (this.atlas !== TEX.atlas && TEX.atlas) {
      this.atlas = TEX.atlas;
      this.kavAt = null;
    }
    if (this.wobbles.size) {
      for (const [k, w] of this.wobbles) {
        w.t += dt;
        if (w.t >= w.dur) this.wobbles.delete(k);
      }
    }
    const player = game.player;
    // (An opening scene moves the camera its own way: see cutscene.js.)
    // (Round 69: at a ship's wheel, her middle: see shipgame.js helmView.)
    // (Round 86: through a spyglass, where it's looking: see spyglass.js.)
    const rp = game.cutscene && game.cutscene.focus ? game.cutscene.focus() : game.scene && game.scene.focus ? game.scene.focus() : game.helmFocus || game.spyFocus || (game.ringFocus && game.ringFocus.run === game.dungeon ? game.ringFocus : null) || player.renderPos();
    const [pu, pv] = this.toView(rp.x, rp.z);
    // Camera follows the player's feet (smoothed, pixel snapped).
    const tx = pu * TILE + 8 - this.vw / 2;
    const ty = pv * TILE - rp.y * LH + LH + 8 - this.vh / 2 - 10;
    if (!this.camInit) {
      this.cx = tx;
      this.cy = ty;
      this.camInit = true;
    }
    const k = 1 - Math.pow(0.0005, dt);
    this.cx += (tx - this.cx) * k;
    this.cy += (ty - this.cy) * k;
    if (game.shake > 0 && !this.noShake) {
      this.cx += (Math.random() - 0.5) * game.shake * 4;
      this.cy += (Math.random() - 0.5) * game.shake * 4;
    }
    this.camX = Math.round(this.cx);
    this.camY = Math.round(this.cy);
    if (this.spin) {
      this.drawSpin(game, dt);
      return;
    }
    this.gfx.tick(game, dt);
    this.drawScene(game, dt);
    this.drawOverlays(game);
    if (game.spyFocus) drawSpyRing(this.ctx, this.vw || VIEW_W, this.vh || VIEW_H, this.time);
    if (this.zoomK === 1) drawShipHud(this, game);
    this.drawFlashes(game, dt);
    // (Round 77) Brightness, from Settings: lighter by a soft wash, darker
    // by a dim one.
    const br = this.brightness ?? 1;
    if (Math.abs(br - 1) > 0.01) {
      const ctx = this.ctx;
      ctx.save();
      if (br > 1) {
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(255,248,230,${Math.min(0.35, (br - 1) * 0.35)})`;
      } else ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, (1 - br) * 0.6)})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.restore();
    }
  }

  // (Round 77) How far someone leaning on a wall tips (radians), as you
  // see them: toward the wall's side.
  leanOf(ia) {
    const DXw = [0, -1, 0, 1];
    const DZw = [1, 0, -1, 0];
    const [du, dv] = this.toView(DXw[ia.wall], DZw[ia.wall]);
    const k = Math.min(1, ia.t / 0.6);
    return (du !== 0 ? du * 0.13 : dv < 0 ? 0.05 : -0.05) * k;
  }

  // (Round 128) The pose an idle moment puts someone in, if any, as they
  // face: both arms up at the height of a stretch; one hand up while they
  // talk (the side they gesture with, as you see them).
  poseOf(ia, dir) {
    if (ia.kind === 'stretch') {
      const k = Math.min(1, ia.t / 0.4) * Math.min(1, Math.max(0, (ia.dur - ia.t) / 0.4));
      return k > 0.45 ? 'stretch' : null;
    }
    if (ia.kind === 'gesture') {
      const since = ia.t - (ia.hand ?? -9);
      if (since < 0.08 || since > 0.62) return null;
      if (dir === 1 || dir === 3) return 'waveR';
      return (ia.side || 1) > 0 ? 'waveR' : 'waveL';
    }
    return null;
  }

  // (Round 79) Hands: one raised a moment while they talk, both up over
  // their head for a stretch.
  drawIdleHands(ctx, e, ia, sx, top, dir) {
    const skin = (e.look && e.look.skin) || '#d8a880';
    ctx.fillStyle = skin;
    if (ia.kind === 'stretch') {
      const k = Math.min(1, ia.t / 0.4) * Math.min(1, Math.max(0, (ia.dur - ia.t) / 0.4));
      const up = Math.round(k * 5);
      for (const hx of [sx + 3, sx + 11]) {
        ctx.fillRect(hx, top + 9 - up, 2, 2);
        ctx.fillStyle = (e.look && e.look.shirt) || '#806040';
        ctx.fillRect(hx, top + 11 - up, 2, up);
        ctx.fillStyle = skin;
      }
      return;
    }
    const since = ia.t - (ia.hand ?? -9);
    if (since < 0 || since > 0.7) return;
    const lift = Math.round(Math.sin((since / 0.7) * Math.PI) * 4);
    const side = dir === 1 ? -1 : dir === 3 ? 1 : ia.side || 1;
    const hx = sx + 7 + side * 6;
    ctx.fillRect(hx, top + 12 - lift, 2, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(hx, top + 14 - lift, 2, 1);
  }

  // (Round 77) A broom in someone's hands, going side to side.
  drawBroom(ctx, sx, top, feetY, dir) {
    const sw = Math.round(Math.sin(this.time * 7) * 3);
    const hx = sx + (dir === 1 ? 4 : dir === 3 ? 12 : 10);
    const hy = top + 10;
    const bx = hx + sw + (dir === 1 ? -3 : 3);
    const by = feetY - 1;
    ctx.fillStyle = '#8a6036';
    const steps = Math.max(1, by - hy);
    for (let i = 0; i <= steps; i++) ctx.fillRect(Math.round(hx + ((bx - hx) * i) / steps), hy + i, 1, 1);
    ctx.fillStyle = '#d8b860';
    ctx.fillRect(bx - 2, by - 1, 5, 2);
    ctx.fillStyle = '#b09040';
    ctx.fillRect(bx - 2, by + 1, 5, 1);
  }

  // (Round 77) A wall cut away indoors, a storey up: its top and front
  // drawn faint over the room (see drawWorld).
  drawWallHint(ctx, id, wx, y, wz, sx, sy, above, front, frontCut) {
    const tops = TEX.top[id * 4];
    const fronts = TEX.front[id * 4];
    if (!tops || !fronts) return;
    const v = variantAt(wx, y, wz);
    ctx.globalAlpha = 0.2;
    const ab = BLOCKS[above];
    if (!(ab && ab.opaque && ab.render === 'cube')) {
      const s = tops[v % tops.length];
      ctx.drawImage(this.atlas, s.x, s.y, 16, 16, sx, sy, 16, 16);
    }
    const fb = BLOCKS[front];
    if (frontCut || !(fb && fb.opaque && fb.render === 'cube')) {
      const s = fronts[v % fronts.length];
      ctx.drawImage(this.atlas, s.x, s.y, 16, LH, sx, sy + 16, 16, LH);
    }
    ctx.globalAlpha = 1;
    // (Its edge, picked out.)
    ctx.fillStyle = 'rgba(255,240,210,0.16)';
    ctx.fillRect(sx, sy, 16, 1);
  }

  // (Round 73) What's set out on a rack, a stand or a hook (see
  // game/displays.js): weapons upright in a rack's pegs, a piece on a stand
  // turning a little in the light, a blade hung on the wall.
  drawDisplay(ctx, game, wx, y, wz, id, sx, top) {
    const shown = game.displayShown && game.displayShown.get(`${wx},${y},${wz}`);
    const items = shown || (displayItems(game.world, wx, y, wz) || []).map((q) => (q ? q.item : null));
    if (!items.some(Boolean)) return;
    if (id === B.weapon_rack) {
      items.forEach((key, i) => {
        if (!key) return;
        ctx.save();
        ctx.translate(sx + 4 + i * 4, top + 16);
        ctx.rotate(-Math.PI / 4);
        ctx.scale(0.8, 0.8);
        ctx.drawImage(itemIcon(key), -8, -8);
        ctx.restore();
      });
      return;
    }
    const key = items[0];
    if (!key) return;
    if (id === B.display_stand) {
      const bob = Math.round(Math.sin(this.time * 1.6 + wx * 0.7 + wz) * 1);
      drawJewelled(ctx, itemIcon(key), key, sx, top - 2 + bob, this.time, true);
      // (Now and then a glint off it.)
      if (((this.time * 0.6 + wx * 0.13 + wz * 0.29) % 3) < 0.12) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + 10, top + 1 + bob, 1, 3);
        ctx.fillRect(sx + 9, top + 2 + bob, 3, 1);
      }
      return;
    }
    // A hook on the wall: hung a little aslant.
    ctx.save();
    ctx.translate(sx + 8, top + 13);
    ctx.rotate(0.35 + Math.sin(this.time * 0.8 + wx) * 0.03);
    ctx.drawImage(itemIcon(key), -8, -6);
    ctx.restore();
  }

  // (Round 75) A stair: its high step and its low one, each a piece of
  // its floor's top and front, laid out by the way it climbs on screen
  // (0 toward you, 1 to the left, 2 away, 3 to the right). A step is half
  // a layer (6px) high and half a pace deep.
  drawStair(ctx, atl, T, id, v, sd, sx, sy) {
    const tops = T.top[id * 4];
    const fronts = T.front[id * 4];
    if (!tops || !fronts) return;
    const t = tops[v % tops.length];
    const f = fronts[v % fronts.length];
    const H = LH / 2;
    const top = (x0, y0, w, h, dx, dy) => ctx.drawImage(atl, t.x + x0, t.y + y0, w, h, sx + dx, sy + dy, w, h);
    const front = (x0, y0, w, h, dx, dy) => ctx.drawImage(atl, f.x + x0, f.y + y0, w, h, sx + dx, sy + dy, w, h);
    const shade = (dx, dy, w, h, a) => {
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(sx + dx, sy + dy, w, h);
    };
    // (Round 79) The nosing of a step: a bright edge, and the shadow it
    // casts on the riser under it, so a stair stands out from the floor
    // it's made of.
    const edge = (dx, dy, w) => {
      ctx.fillStyle = 'rgba(255,245,220,0.5)';
      ctx.fillRect(sx + dx, sy + dy, w, 1);
    };
    const under = (dx, dy, w) => {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(sx + dx, sy + dy, w, 1);
    };
    // (A warm wash over the whole of it: worn by feet, and oiled.)
    const wash = (dx, dy, w, h) => {
      ctx.fillStyle = 'rgba(70,40,10,0.12)';
      ctx.fillRect(sx + dx, sy + dy, w, h);
    };
    if (sd === 2) {
      // Climbing away: the high step behind, its riser, the low step in front.
      top(0, 0, 16, 8, 0, 0);
      front(0, 0, 16, H, 0, 8);
      shade(0, 8, 16, H, 0.26);
      under(0, 8, 16);
      top(0, 8, 16, 8, 0, 8 + H);
      shade(0, 8 + H, 16, 8, 0.1);
      edge(0, 8 + H, 16);
      front(0, H, 16, H, 0, 16 + H);
      shade(0, 16 + H, 16, H, 0.22);
      under(0, 16 + H, 16);
      edge(0, 0, 16);
      wash(0, 0, 16, 16 + LH);
    } else if (sd === 0) {
      // Climbing toward you: the low step behind, the high one in front,
      // its face the full height.
      top(0, 0, 16, 8, 0, H);
      shade(0, H, 16, 8, 0.24);
      top(0, 8, 16, 8, 0, 8);
      edge(0, 8, 16);
      front(0, 0, 16, LH, 0, 16);
      shade(0, 16, 16, LH, 0.14);
      under(0, 16, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(sx, sy + 16 + H, 16, 1);
      wash(0, 0, 16, 16 + LH);
    } else {
      // Climbing to one side: the high half that side, the low half the
      // other, a step down between.
      const hx = sd === 1 ? 0 : 8;
      const lx = 8 - hx;
      top(hx, 0, 8, 16, hx, 0);
      front(hx, 0, 8, LH, hx, 16);
      top(lx, 0, 8, 16, lx, H);
      front(lx, H, 8, H, lx, 16 + H);
      shade(lx, H, 8, 16 + H, 0.22);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(sx + (sd === 1 ? 8 : 7), sy + H, 1, 16);
      ctx.fillStyle = 'rgba(255,245,220,0.4)';
      ctx.fillRect(sx + (sd === 1 ? 7 : 8), sy, 1, 16);
      edge(hx, 0, 8);
      wash(0, 0, 16, 16 + LH);
    }
  }

  // (Round 74) A painting on its wall. The wall behind it as you look:
  // flat on the wall's face, at the height it hangs. A wall to the left or
  // the right: seen edge on, only the side of its frame. The wall in front:
  // hidden behind it. (A large one fills the faces of two layers of wall,
  // and a little of the paces either side.)
  drawWallPainting(ctx, game, wx, y, wz, size, meta, sx, sy, pickable, id) {
    const world = game.world;
    const d = wallDirOf(world, wx, y, wz, meta & 3);
    const sd = d < 0 ? 2 : this.viewDir(d);
    const large = size === 'large';
    if (sd === 2) {
      const art = paintingArt(paintingSubject(wx, y, wz, game.seed), size, game.seed >>> 0);
      const ax = large ? sx + 8 - 16 : sx + 2;
      const ay = large ? sy - 10 : sy + 1;
      // (A shadow on the wall under its lower edge.)
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(ax + 1, ay + art.height, art.width - 1, 1);
      ctx.drawImage(art, ax, ay);
      if (pickable && this.under(null, ax, ay, art.width, art.height, false)) this.pick = { x: wx, y, z: wz, face: 'front', id, seq: ++this.pickSeq, prop: true };
      return;
    }
    if (sd === 0) return;
    // Edge on: the frame's side, down the wall's length.
    const ex = sd === 1 ? sx : sx + 14;
    const y0 = large ? sy - 16 : sy + 4;
    const h = large ? 50 : 18;
    ctx.fillStyle = '#3a2614';
    ctx.fillRect(ex, y0, 2, h);
    ctx.fillStyle = '#8a6438';
    ctx.fillRect(sd === 1 ? ex + 1 : ex, y0 + 1, 1, h - 2);
    if (pickable && this.under(null, ex - 2, y0, 6, h, false)) this.pick = { x: wx, y, z: wz, face: 'front', id, seq: ++this.pickSeq, prop: true };
  }

  drawPainting(ctx, game, wx, y, wz, size, sx, top) {
    const art = paintingArt(paintingSubject(wx, y, wz, game.seed), size, game.seed >>> 0);
    if (size === 'large') ctx.drawImage(art, sx + 8 - 16, top - 3);
    else ctx.drawImage(art, sx + 2, top + 3);
  }

  // A dodge roll: curled up and spinning over the ground (the way you're
  // rolling), ghosts of you trailing behind, dust kicked up.
  drawTumble(ctx, e, sheet, dir, sx, top) {
    const prog = Math.max(0, Math.min(1, 1 - e.rollT / Math.max(0.05, e.rollDur || 0.36)));
    const [vx] = e.rollDir && this.toViewDir ? this.toViewDir(e.rollDir[0], e.rollDir[1]) : [1, 0];
    const sign = vx < 0 ? -1 : 1;
    const trail = (e.rollTrail ||= []);
    trail.push({ x: sx, y: top });
    while (trail.length > (e.wingDash > 0 && e.wing ? 9 : 5)) trail.shift();
    const cy = SHEET_H * 0.62;
    const draw = (x, y, ang, alpha, sc) => {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.translate(x + CHAR_W / 2, y - SPR_PAD + cy + 2);
      ctx.rotate(ang);
      ctx.scale(sc, sc);
      ctx.drawImage(sheet, 4 * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, -CHAR_W / 2, -cy, CHAR_W, SHEET_H);
      ctx.restore();
    };
    // (Spun fast at first, settling as it slows.)
    const spin = sign * (1 - Math.pow(1 - prog, 2)) * Math.PI * 2;
    // A fallen star's roll on the wing (see combat.js): longer ghosts, lit
    // blue, the wing spread wide over the tumble beating once, and stars
    // shed along the way.
    const dash = e.wingDash > 0 && e.wing;
    if (dash) {
      const a0 = ctx.globalAlpha;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < trail.length - 1; i++) {
        const k = (i + 1) / trail.length;
        ctx.globalAlpha = a0 * k * 0.55;
        ctx.drawImage(frameGlow(sheet, 4 * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, i % 2 ? '#78b8ff' : '#a8dcff'), trail[i].x - 1, trail[i].y - SPR_PAD - 1);
      }
      ctx.restore();
      ctx.globalAlpha = a0;
      drawWingBurst(ctx, sx + CHAR_W / 2, top + 6, Math.min(1, e.wingDash / 0.55) * 0.7, 1.3);
      if (!this.spin) {
        const rp = e.renderPos();
        this.emit(rp.x + (Math.random() - 0.5) * 0.6, rp.y + 0.6 + Math.random(), rp.z, { n: 2, color: ['#e0f4ff', '#a8dcff', '#ffffff'], up: 4, speed: 10, life: 0.6, gravity: -6, glow: true });
      }
    }
    for (let i = 0; i < trail.length - 1; i++) draw(trail[i].x, trail[i].y, spin - sign * (trail.length - 1 - i) * 0.7, 0.12 + i * 0.07, 0.82);
    draw(sx, top, spin, 1, 0.86);
    if (Math.random() < 0.5 && !this.spin) {
      const rp = e.renderPos();
      this.emit(rp.x, rp.y, rp.z, { n: 1, color: ['#a89878', '#8a7a5a'], up: 6, speed: 12, life: 0.35, oy: 7, shape: 'puff', grow: 1 });
    }
  }

  // The whole view lit for an instant (a parry's crack of light).
  flashScreen(color = '#ffffff', dur = 0.2) {
    // (Round 77: unless flashes are turned off in Settings.)
    if (this.noFlash) return;
    this.flash = { color, t: dur, dur };
  }

  // (Round 66) A mod's music put on for whoever sees this screen ('song:..'
  // or a theme's key): for `secs` (0: till it's stopped); null stops it.
  // (Here, so a multiplayer host can send it to the player it's for.)
  modMusic(key, secs = 0) {
    this.modMusicOn = key ? { key: String(key), until: secs > 0 ? performance.now() / 1000 + secs : 0 } : null;
  }

  // Hurt: the screen reddens at the edges, and fades back. A flash of
  // light over everything.
  drawFlashes(game, dt) {
    const ctx = this.ctx;
    const hl = game.healFlash || 0;
    if (hl > 0.01) {
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.32, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.62);
      g.addColorStop(0, 'rgba(80,220,90,0)');
      g.addColorStop(1, `rgba(90,230,110,${Math.min(0.42, hl * 0.6)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    const h = game.hurtFlash || 0;
    if (h > 0.01) {
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, Math.min(this.vw, this.vh) * 0.25, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.62);
      g.addColorStop(0, 'rgba(200,0,0,0)');
      g.addColorStop(1, `rgba(210,10,10,${Math.min(0.7, h * 0.65)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.fillStyle = `rgba(255,30,30,${Math.min(0.22, h * 0.18)})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
    const f = this.flash;
    if (f) {
      f.t -= dt;
      if (f.t <= 0) this.flash = null;
      else {
        ctx.globalAlpha = Math.min(0.75, (f.t / f.dur) * 0.75);
        ctx.fillStyle = f.color;
        ctx.fillRect(0, 0, this.vw, this.vh);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ------------------------------------------------------------------ cutaway
  computeCutaway(world, player, bld = null) {
    const px = player.x;
    const pz = player.z;
    const py = player.y;
    // Indoors if something solid is overhead (tall halls have high ridges).
    const covered = (x, z) => {
      for (let y = py + 2; y < Math.min(WORLD_Y, py + 16); y++) {
        const id = world.getBlock(x, y, z);
        if (id !== B.air && BLOCKS[id].render === 'cube' && !BLOCKS[id].name.startsWith('leaves')) return true;
      }
      return false;
    };
    this.hidden = null;
    this.underground = false;
    // Inside a building's walls counts even under a hole in the roof.
    const inside = bld && !bld.underConstruction && px >= bld.x0 && px <= bld.x1 && pz >= bld.z0 && pz <= bld.z1 && py < (bld.roofBase ?? WORLD_Y);
    if (!inside && !covered(px, pz)) return;
    // Down in the ground itself (rock or earth over your head, not a roof):
    // the whole view's cut away at your feet, a plan of the workings (see
    // drawDigView).
    if (!inside) {
      for (let y = py + 2; y < Math.min(WORLD_Y, py + 16); y++) {
        const id = world.getBlock(px, y, pz);
        if (id === B.air || BLOCKS[id].render !== 'cube') continue;
        this.underground = NATURAL.has(id);
        break;
      }
    }
    const cap = this.underground ? 2800 : 700;
    const rx = this.underground ? 34 : 24;
    const rz = this.underground ? 26 : 20;
    // Flood-fill the covered area (the roof footprint).
    const set = new Set();
    const q = [[px, pz]];
    set.add(px * 65536 + pz);
    if (inside) {
      for (let z = bld.z0; z <= bld.z1; z++) {
        for (let x = bld.x0; x <= bld.x1; x++) {
          const k = x * 65536 + z;
          if (set.has(k)) continue;
          set.add(k);
          q.push([x, z]);
        }
      }
    }
    while (q.length && set.size < cap) {
      const [x, z] = q.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        const k = nx * 65536 + nz;
        if (set.has(k) || Math.abs(nx - px) > rx || Math.abs(nz - pz) > rz) continue;
        if (!covered(nx, nz)) continue;
        set.add(k);
        q.push([nx, nz]);
      }
    }
    this.hidden = set;
    this.hiddenLevel = py + 1;
  }

  isHidden(x, y, z) {
    if (this.veil && this.game && this.veil.veiled(x, y, z, this.game.world.getBlock(x, y, z))) return true;
    if (this.hidden === null || !this.hidden.has(x * 65536 + z)) return false;
    if (y >= this.hiddenLevel) return true;
    // (Down in the ground: the rock at your feet, cut flat.)
    if (this.underground && y === this.hiddenLevel - 1 && this.game) {
      const b = BLOCKS[this.game.world.getBlock(x, y, z)];
      return b.render === 'cube' && b.opaque;
    }
    return false;
  }

  // The atlas with a Kavorent floor's blocks turned to its colour (the
  // ruin's cyan light turned amber, violet, crimson..., the dark alloy
  // tinged with it). Made when a floor's first seen; the last one kept.
  kavAtlasFor(pal) {
    if (this.kavAt && this.kavAt.name === pal.name) return this.kavAt.canvas;
    const src = this.atlas;
    const c = this.kavAt ? this.kavAt.canvas : document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);
    const done = new Set();
    const tinted = kavTinted();
    for (let id = 0; id < BLOCKS.length; id++) {
      if (tinted[id] !== 1) continue;
      for (let rot = 0; rot < 4; rot++) {
        for (const list of [TEX.top[id * 4 + rot], TEX.front[id * 4 + rot], TEX.sprite[id * 4 + rot]]) {
          for (const s of list || []) {
            const key = s.x * 65536 + s.y;
            if (done.has(key)) continue;
            done.add(key);
            const w = s.w || 16;
            const h = s.h || 16;
            const img = g.getImageData(s.x, s.y, w, h);
            recolour(img.data, pal.hue, pal.sat ?? 1);
            g.putImageData(img, s.x, s.y);
          }
        }
      }
    }
    this.kavAt = { name: pal.name, canvas: c };
    return c;
  }

  // ------------------------------------------------------------------ world
  drawWorld(game) {
    const ctx = this.ctx;
    const world = game.world;
    // (Round 84) A storm's wind in the plants and the trees (see windSway).
    const wt = game.weather;
    this.blendFloors = !!game.dungeon;
    // (Round 128: and a breeze in any weather out of doors, more in the
    // rain or the snow: the grass and the flowers never stand quite still.)
    const breeze = wt ? (wt.kind === 'rain' ? 0.9 : wt.kind === 'snow' ? 0.7 : wt.kind === 'fog' ? 0.25 : 0.55) * Math.min(1, 0.4 + (wt.level ?? 1) * 0.6) : 0;
    this.swayAmp = wt && !game.dungeon && !this.noEnvFx ? Math.min(2.6, breeze + ((wt.blow || 0) * 1.7 + (wt.storm > 0.2 ? wt.storm : 0)) * (0.65 + 0.35 * (wt.gust || 0))) : 0;
    // (The trees' leaves stir only once it's more than a breeze.)
    this.leafAmp = this.swayAmp > 0.8 ? this.swayAmp : 0;
    this.swayLean = wt ? wt.gust || 0 : 0;
    const atlas = this.atlas;
    const camX = this.camX;
    const camY = this.camY;
    const x0 = Math.floor(camX / TILE) - 1;
    const x1 = Math.floor((camX + this.vw) / TILE) + 1;
    const zMin = Math.floor((camY - SPR_H - LH) / TILE) - 1;
    const zMax = Math.floor((camY + this.vh + (WORLD_Y - 1) * LH) / TILE) + 1;
    const W = x1 - x0 + 1;
    const nRows = zMax - zMin + 2;
    // Column cache: region + base index for every visible column. Columns
    // are laid out in view space (u across, v down); each maps to one world
    // column however the camera is turned.
    const colR = new Array(W * nRows);
    const colB = new Int32Array(W * nRows);
    const colTop = new Int8Array(W * nRows);
    const colWX = new Int32Array(W * nRows);
    const colWZ = new Int32Array(W * nRows);
    const view = this.view;
    for (let r = 0; r < nRows; r++) {
      const v = zMin + r;
      for (let i = 0; i < W; i++) {
        const [wx, wz] = this.toWorld(x0 + i, v);
        const reg = world.regionAt(wx, wz);
        const ci = r * W + i;
        colR[ci] = reg;
        colWX[ci] = wx;
        colWZ[ci] = wz;
        if (reg) {
          const lx = wx - reg.x0;
          const lz = wz - reg.z0;
          colB[ci] = (lz * REGION_W + lx) * WORLD_Y;
          colTop[ci] = reg.top[lz * REGION_W + lx];
        } else colTop[ci] = -1;
      }
    }
    const getAt = (ci, y) => {
      const reg = colR[ci];
      if (!reg || y < 0 || y >= WORLD_Y) return y < 0 ? B.bedrock : B.air;
      return reg.blocks[colB[ci] + y];
    };
    const metaAt = (ci, y) => colR[ci].meta[colB[ci] + y];

    // Bucket entities by row.
    const buckets = new Map();
    const cut = game.cutscene;
    // (A master coming apart is still seen, a moment: see scenes.js.)
    const ghost = game.scene && game.scene.ghost && game.scene.ghost.dead ? [game.scene.ghost] : [];
    // (Down in the ground: anyone up on the surface over the workings isn't
    // drawn walking about on the plan of them.)
    const deep = this.underground && this.hidden;
    // (Round 119) Indoors, the storeys over you cut away: anyone up on one
    // (another player, the folk upstairs) isn't drawn standing on the air
    // where its floor was; nor anyone a storey under you, below the floor
    // you're on. They used to be, at their own height, over your room.
    const level = this.hidden ? this.hiddenLevel : null;
    const below = (e) => {
      if (level === null || e.y > level - 4 || !this.hidden.has(Math.round(e.x) * 65536 + Math.round(e.z))) return false;
      const x = Math.round(e.x);
      const z = Math.round(e.z);
      for (let y = Math.round(e.y) + 2; y < level - 1; y++) {
        const b = BLOCKS[world.getBlock(x, y, z)];
        if (b && b.render === 'cube' && b.opaque) return true;
      }
      return false;
    };
    for (const e of ghost.length ? [...game.visibleEntities, ...ghost] : game.visibleEntities) {
      if (cut && cut.hides(e)) continue;
      if (deep && e !== game.player && e.y >= this.hiddenLevel && this.hidden.has(e.x * 65536 + e.z)) continue;
      if (level !== null && e !== game.player && e !== game.player.mount && e.kind !== 'prop' && !e.deck) {
        if (Math.round(e.y) >= level && this.hidden.has(Math.round(e.x) * 65536 + Math.round(e.z))) continue;
        if (below(e)) continue;
      }
      // (Asleep inside a tent: out of sight; the tent snores for them.)
      if (e.sleeping && e.bedTile && e.bedTile.tent) continue;
      // (Fallen: drawn by the rite that raises you, over the dark.)
      if (e === game.player && game.scene && game.scene.kind === 'death' && !game.scene.reborn) continue;
      // (Aboard one of the great ships: drawn with her, see shipvox.js.)
      if (e.deck) continue;
      const wp = e.renderPos();
      const [u, v] = this.toView(wp.x, wp.z);
      const rp = { x: u, y: wp.y, z: v };
      let row = Math.ceil(rp.z - 0.001);
      // (Round 83) A windmill's sails turn in the row out from its wall:
      // drawn with that row (over a sign hung there), when that's the row
      // nearer you.
      if (e.kind === 'prop' && e.type === 'sails' && this.toViewDir(e.nx || 0, e.nz || 0)[1] > 0) row++;
      // (Round 87) A horse or a wagon, longer than a pace: drawn a row at a
      // time, each part with the row of the world it stands over (see
      // steeds.steedSlices), so what's in front of each part hides it and
      // it hides only what's behind. Whoever's on it, with the row its seat
      // is in.
      const sp = this.steedSpan(e);
      if (sp) {
        const base = Math.floor(rp.z);
        const q = Math.round((rp.z - base) * 16) / 16;
        const [k0, k1] = steedRows(sp.kind, sp.horse, sp.a, q);
        const anchor = Math.ceil(q - 0.001);
        for (let k = Math.min(k0, anchor); k <= Math.max(k1, anchor); k++) {
          const rr = base + k;
          if (rr < zMin || rr > zMax) continue;
          let arr = buckets.get(rr);
          if (!arr) buckets.set(rr, (arr = []));
          arr.push({ e, rp, layer: Math.ceil(rp.y - 0.001) + 1, slice: { k, q, anchor: k === anchor } });
        }
        continue;
      }
      if (row < zMin || row > zMax) continue;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      arr.push({ e, rp, layer: Math.ceil(rp.y - 0.001) + 1 });
    }
    // Tents with someone asleep inside (see drawSnores).
    this.tentSleep = null;
    for (const n of game.npcs || []) {
      if (!n.sleeping || !n.bedTile || !n.bedTile.tent || n.dead) continue;
      (this.tentSleep ||= new Set()).add(n.bedTile.x * 65536 + n.bedTile.z);
    }
    this.fishingDecos(game, buckets, zMin, zMax);
    this.leadDecos(game, buckets, zMin, zMax);
    this.diceDecos(buckets, zMin, zMax);
    game.wildlife?.decos(this, buckets, zMin, zMax);
    shipDecos(this, game, buckets, zMin, zMax);
    // (Round 78) Blueprints laid out: their blocks, see-through.
    planDecos(this, game, buckets, zMin, zMax);
    // (Round 71) The evolved masters' arms, the worm's body, rifts in the
    // air and what bounces about (see evolvedfx.js).
    evolvedDecos(this, game, buckets, zMin, zMax);

    const player = game.player;
    const prp = player.renderPos();
    const [ppu, ppv] = this.toView(prp.x, prp.z);
    const psx = ppu * TILE - camX;
    const psy = ppv * TILE - prp.y * LH + LH - camY;
    const pRect = { x0: psx - 6, x1: psx + 22, y0: psy - 20, y1: psy + 20 };
    const pz = this.toView(player.x, player.z)[1];
    const mouse = this.mouse;
    const cur = game.cursor;
    const pLayer = player.y;
    const waterFrame = Math.floor(this.time * 3) % WATER_FRAMES;
    const animFrame = Math.floor(this.time * 8);
    // (A Kavorent floor's own blocks, in its own colour.)
    const kpal = game.dungeon && game.dungeon.kav ? game.dungeon.pal : null;
    const kAt = kpal && (kpal.hue || kpal.sat !== 1) ? this.kavAtlasFor(kpal) : null;
    const hidden = this.hidden;
    const hLevel = this.hiddenLevel;
    // (A town not yet built, in the native's opening: see cutscene.js.)
    const veil = cut && cut.veiled ? cut : null;
    this.veil = veil;
    // (Down in the ground, the cut's at your feet: the rock there is drawn
    // flat, as a plan (see drawDigView); what's set on the floor still
    // shows.)
    const dig = this.underground ? hLevel - 1 : null;
    const cutAway = (x, y, z) => {
      if (hidden === null || !hidden.has(x * 65536 + z)) return false;
      if (dig === null || y > dig) return y >= hLevel;
      if (y < dig) return false;
      const b = BLOCKS[world.getBlock(x, y, z)];
      return b.render === 'cube' && b.opaque;
    };
    const hid = veil ? (x, y, z) => cutAway(x, y, z) || veil.veiled(x, y, z, world.getBlock(x, y, z)) : cutAway;
    this.cursorDrawList = null;
    const gfx = this.gfx;
    const gfxOn = !!gfx;
    // (Round 77) Indoors, the walls cut away a storey up shown as a faint
    // ghost of themselves, so the room's height still reads.
    const hint = this.wallHint !== false && hidden !== null && !this.underground;

    // (Round 80) The ground below your level comes from pictures kept of
    // each row's layers of it (see groundStrip): drawn again only when what
    // they show changes, not every frame. What moves or changes on it
    // (water, plants, things set down, ruts, the pointer) is
    // drawn over in its place, as ever. Not under a scene's veil; down in
    // the ground, not the layer at your feet (cut flat as a plan).
    const Lc = this.groundCache !== false && veil === null ? (this.underground ? pLayer - 1 : pLayer) : 0;
    this.stripBudget = STRIP_BUDGET;
    this.stripFrame = (this.stripFrame || 0) + 1;
    // (Where the drawing's got to: the row, its layer, where that is on
    // screen, whether it fades for you.)
    let z = 0;
    let y = 0;
    let sy = 0;
    let rowBase = 0;
    let frontBase = 0;
    let fadeRow = false;
    let fadeLayer = false;
    // One square of the row at this layer, drawn (column i of the view).
    const drawAt = (i) => {
      const ci = rowBase + i;
      if (y >= colTop[ci]) return;
      let id = getAt(ci, y);
      if (id === 0) return;
      const x = x0 + i;
      const wx = colWX[ci];
      const wz = colWZ[ci];
      if (veil !== null && y === SURFACE) id = veil.groundAt(wx, y, wz, id);
      // (Something set down belongs with what it's set on: it shows
      // whenever that does, a cut-away roof or not.)
      if (hid(wx, id === B.placed_item ? y - 1 : y, wz)) {
        // (Round 74) A painting hung a pace up, its wall cut away as
        // you stand inside: shown on the wall's face below, as the
        // room's plan is drawn.
        if (BLOCKS[id].painting && !hid(wx, y - 1, wz)) this.drawWallPainting(ctx, game, wx, y, wz, BLOCKS[id].painting, metaAt(ci, y), x0 * TILE + i * TILE - camX, sy + LH, false, id);
        else if (hint && y === hLevel && BLOCKS[id].render === 'cube' && BLOCKS[id].opaque) this.drawWallHint(ctx, id, wx, y, wz, x * TILE - camX, sy, getAt(ci, y + 1), getAt(frontBase + i, y), hid(colWX[frontBase + i], y, colWZ[frontBase + i]));
        return;
      }
      const b = BLOCKS[id];
      const atl = kAt !== null && kavTinted()[id] === 1 ? kAt : atlas;
      // (Furniture, doors and windows in the craft of the people whose
      // town they're in: see textures.CRAFTS.)
      // (Round 84: and what's put up about town in their own look.)
      const lk = lookedId()[id] === 1 ? this.lookAt(game, wx, wz) : 0;
      const T = lk ? TEX.look[lk] || TEX : craftedId()[id] === 1 ? TEX.craft[this.craftAt(game, wx, wz)] || TEX : TEX;
      const sx = x * TILE - camX;
      let alpha = 1;
      // (Round 83: never the water, which hides nothing of you: it went
      // thin under you as you swam up the screen.)
      if (fadeLayer && !b.liquid && sx + TILE > pRect.x0 && sx < pRect.x1 && sy + SPR_H > pRect.y0 && sy < pRect.y1) {
        alpha = this.fadeFor(sx, sy, psx, psy);
        // (Round 87) Something built (a house's roof, its wall) isn't
        // faded to show you behind it: that showed what's inside it. It's
        // drawn whole, and you a ghost over it (see drawScene).
        if (alpha < 1 && !NATURAL.has(id) && !LEAVES.has(id) && !LOGS.has(id)) {
          alpha = 1;
          this.playerBehind = true;
        }
      }
      if (alpha < 1) ctx.globalAlpha = alpha;
      // Blocks faded out because they hide the player can be clicked through.
      const pickable = mouse && alpha >= 0.6 && mouse.x >= sx - 2 && mouse.x < sx + 18 && mouse.y >= sy - 16 && mouse.y < sy + SPR_H + 2;
      const v = variantAt(wx, y, wz);
      const render = b.render;
      // (Round 82) A door mid-swing: drawn turning (see drawSwing).
      const swing = render === 'door' && this.swings.size ? this.swings.get(`${wx},${y},${wz}`) : null;
      if (barIds().has(id)) {
        // (Round 82) Iron bars: a grille joined up to its neighbours (see
        // drawBars).
        this.drawBars(ctx, world, wx, y, wz, sx, sy, id);
        if (pickable && mouse.x >= sx && mouse.x < sx + 16 && mouse.y >= sy && mouse.y < sy + SPR_H) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq };
      } else if (render === 'cube' || render === 'liquid' || (render === 'door' && !swing && !(metaAt(ci, y) & META_STATE))) {
        const rot = b.rotatable ? ((metaAt(ci, y) & META_ROT) + view) & 3 : 0;
        // Top face.
        const above = getAt(ci, y + 1);
        const ab = BLOCKS[above];
        const aboveHidden = hid(wx, y + 1, wz);
        const showTop = aboveHidden || !(ab.opaque && ab.render === 'cube') && !(CULL_SAME.has(id) && above === id) && !(render === 'liquid' && ab.liquid);
        const liquid = render === 'liquid';
        if (showTop) {
          const tops = T.top[id * 4 + rot];
          const s = liquid ? tops[waterFrame] : tops[v % tops.length];
          const oy = liquid ? 3 : 0;
          // (Round 84: a tree's leaves rustling in a storm's wind.)
          if (this.leafAmp && LEAVES.has(id)) this.drawRustle(ctx, atl, s.x, s.y, 16, 16, sx, sy, wx, y, wz);
          else ctx.drawImage(atl, s.x, s.y, 16, 16, sx, sy + oy, 16, 16);
          if (pickable && this.under(s, sx, sy + oy, 16, 16, false)) this.pick = { x: wx, y, z: wz, face: 'top', id, seq: ++this.pickSeq };
          if (!liquid && !aboveHidden && !(veil !== null && veil.inside(wx, wz))) this.edgeShade(ctx, getAt, ci, W, y, sx, sy, id);
          // Higher ground is a touch brighter so terraces read as height.
          if (y > 6 && !liquid && b.opaque) {
            ctx.fillStyle = `rgba(255,250,235,${Math.min(0.16, (y - 6) * 0.028)})`;
            ctx.fillRect(sx, sy, 16, 16);
          }
          if (aboveHidden && b.opaque && (veil === null || cutAway(wx, y + 1, wz))) {
            // Cut-away wall tops read like a floor-plan section.
            ctx.fillStyle = 'rgba(16,12,24,0.62)';
            ctx.fillRect(sx, sy, 16, 16);
            ctx.fillStyle = 'rgba(255,240,200,0.18)';
            ctx.fillRect(sx, sy, 16, 1);
          }
        }
        // Front face.
        const fr = getAt(frontBase + i, y);
        const fb = BLOCKS[fr];
        const frontHidden = hid(colWX[frontBase + i], y, colWZ[frontBase + i]);
        const showFront = frontHidden || !(fb.opaque && fb.render === 'cube') && !(CULL_SAME.has(id) && fr === id) && !(liquid && fb.liquid);
        if (showFront && !(liquid && fb.solid)) {
          const fronts = T.front[id * 4 + rot];
          const s = liquid ? fronts[waterFrame] : fronts[v % fronts.length];
          if (this.leafAmp && LEAVES.has(id)) this.drawRustle(ctx, atl, s.x, s.y, 16, LH, sx, sy + 16, wx, y + 0.5, wz);
          else ctx.drawImage(atl, s.x, s.y, 16, LH, sx, sy + 16 + (liquid ? 3 : 0), 16, liquid ? LH - 3 : LH);
          if (pickable && this.under(s, sx, sy + 16 + (liquid ? 3 : 0), 16, liquid ? LH - 3 : LH, false)) this.pick = { x: wx, y, z: wz, face: 'front', id, seq: ++this.pickSeq };
        }
        // (Round 77) Snow lying, tracks, ruts; foam and rings on water.
        if (showTop && gfxOn && !aboveHidden) gfx.drawTop(ctx, world, wx, y, wz, id, liquid, sx, sy, this.time);
      } else if (render === 'stair') {
        // (Round 75) A stair, in its floor's stone or wood, cut into
        // two steps the way it climbs as you look at it.
        const sd = ((metaAt(ci, y) & META_ROT) + view) & 3;
        this.drawStair(ctx, atl, T, id, v, sd, sx, sy);
        if (pickable && mouse.x >= sx && mouse.x < sx + 16 && mouse.y >= sy && mouse.y < sy + SPR_H) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq };
      } else if (render === 'door') {
        const rot = ((metaAt(ci, y) & META_ROT) + view) & 3;
        const s = T.sprite[id * 4 + rot][0];
        if (swing) {
          this.drawSwing(ctx, atl, T, id, rot, v, sx, sy, swing);
          if (pickable && mouse.x >= sx && mouse.x < sx + 16 && mouse.y >= sy && mouse.y < sy + SPR_H) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq, prop: true };
        } else {
          ctx.drawImage(atl, s.x, s.y, s.w, s.h, sx, sy, s.w, s.h);
          if (pickable && this.under(s, sx, sy)) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq, prop: true };
        }
      } else if (PIECE_IDS[id] === 1) {
        // A great thing on its square: drawn whole from the plinth
        // nearest you (below), or from here if it stands alone.
        const [fx, fz] = this.toWorld(0, 1);
        if (world.getBlock(wx + fx, y, wz + fz) !== B.plinth) this.drawPiece(game, ctx, wx, y, wz, id, metaAt(ci, y), sx, sy, z, fadeRow && y >= pLayer, pRect, pz);
      } else if (id === B.plinth) {
        const [fx, fz] = this.toWorld(0, 1);
        const cid = world.getBlock(wx - fx, y, wz - fz);
        if (PIECE_IDS[cid] === 1) this.drawPiece(game, ctx, wx - fx, y, wz - fz, cid, world.getMeta(wx - fx, y, wz - fz), sx, sy, z, fadeRow && y >= pLayer, pRect, pz);
      } else if (id === B.tent) {
        // A tent: bigger than its pace (see sprites.tentSprite), and
        // whoever's asleep in it snoring away over it.
        const meta = metaAt(ci, y);
        const rot = ((meta & META_ROT) + view) & 3;
        const img = tentSprite(rot, (meta >> CANOPY_SHIFT) & 3, !!(meta & META_STATE));
        const tx = sx + 8 - (img.width >> 1);
        const ty = sy + SPR_H + 2 - img.height;
        ctx.drawImage(img, tx, ty);
        if (pickable && this.under(null, sx - 6, ty + 4, 28, img.height - 4, false)) this.pick = { x: wx, y, z: wz, face: 'front', id, seq: ++this.pickSeq, prop: true };
        if (this.tentSleep && this.tentSleep.has(wx * 65536 + wz)) this.drawSnores(ctx, sx + 8, ty + 2, wx * 7 + wz);
      } else if (b.painting) {
        // (Round 74) Hung flat on its wall, as the wall is seen.
        this.drawWallPainting(ctx, game, wx, y, wz, b.painting, metaAt(ci, y), sx, sy, pickable, id);
      } else if (render === 'sprite' || render === 'plant') {
        const meta = metaAt(ci, y);
        // (Round 104: one whose turn says which of its kind it is, not
        // which way it faces (a bust's ancestor, a soldier's face), stays
        // that one however the view's turned.)
        const rot = b.rotatable ? (b.kinds ? meta & META_ROT : ((meta & META_ROT) + view) & 3) : 0;
        const arr = T.sprite[id * 4 + rot];
        const st = meta & META_STATE ? 1 : 0;
        let idx;
        if (render === 'plant') idx = CROPS[id] ? cropStage(meta) : v;
        else if (id === B.rock || id === B.bed) idx = st * 4 + (id === B.bed ? hash4(wx, wz, 5) % 4 : v);
        else if (id === B.canopy) idx = ((meta >> CANOPY_STYLE_SHIFT) & 7) * 8 + st * 4 + ((meta >> CANOPY_SHIFT) & 3);
        else if (id === B.tent || id === B.bunting || id === B.festival_banner) idx = st * 4 + ((meta >> CANOPY_SHIFT) & 3);
        else if (id === B.chair) idx = (animFrame + wx + wz) % 4;
        else idx = st * 4 + (animFrame + wx + wz) % 4;
        const s = arr[idx] || arr[0];
        // (Round 83) A chair at a table: pushed in under it (unless it's
        // been pulled out), slid there as it's moved.
        let csx = sx;
        let csy = sy;
        // (Round 87/88: right in under it. Toward you, its table's drawn over
        // it; beside it, only what sticks out past the table's edge shows;
        // away from you, its back stands at the table's near edge.)
        let clip = null;
        if (id === B.chair) {
          const tb = chairTable(world, wx, y, wz);
          if (tb) {
            const k = this.chairTuck(wx, y, wz, !(meta & META_STATE));
            const [du, dv] = this.toViewDir(tb.dx, tb.dz);
            csx += Math.round(du * 11 * k);
            csy += Math.round(dv * (dv > 0 ? 11 : 7) * k);
            if (du && k > 0) clip = du > 0 ? { x0: -1e4, x1: sx + TILE } : { x0: sx, x1: 1e4 };
          }
        }
        // (A training dummy just struck rocks on its post.)
        const wob = id === B.training_dummy && this.wobbles.size ? this.wobbles.get(`${wx},${y},${wz}`) : null;
        if (wob) {
          const k = wob.t / wob.dur;
          const a = Math.sin(wob.t * 34) * 0.2 * wob.amp * (1 - k) * (1 - k);
          ctx.save();
          ctx.translate(sx + 8, sy + SPR_H - 1);
          ctx.rotate(a);
          ctx.drawImage(atl, s.x, s.y, s.w, s.h, -8, 1 - s.h, s.w, s.h);
          ctx.restore();
        } else if (render === 'plant' && this.swayAmp) this.drawSwaying(ctx, atl, s, csx, csy + SPR_H - s.h, this.windSway(wx, wz));
        else if (clip) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(clip.x0, -1e4, clip.x1 - clip.x0, 2e4);
          ctx.clip();
          ctx.drawImage(atl, s.x, s.y, s.w, s.h, csx, csy + SPR_H - s.h, s.w, s.h);
          ctx.restore();
        } else ctx.drawImage(atl, s.x, s.y, s.w, s.h, csx, csy + SPR_H - s.h, s.w, s.h);
        // (Round 82) A chest open (or opening, or shutting): its lid up.
        if (id === B.chest && this.lids.size) {
          const lk = this.lids.get(`${wx},${y},${wz}`);
          if (lk) this.drawLid(ctx, atl, s, sx, sy + SPR_H - s.h, lk);
        }
        // (Round 88: a chair, by anywhere on its square or on it where it's
        // drawn, tucked in or not: easy to get hold of to pull out.)
        const chairHit = id === B.chair && pickable && (this.under(s, csx, csy + SPR_H - s.h) || (mouse.x >= sx && mouse.x < sx + TILE && mouse.y >= sy && mouse.y < sy + SPR_H));
        // (Its table, drawn over the near part of it, doesn't take the pointer
        // from a chair already under it.)
        if (chairHit || (pickable && this.under(s, sx, sy + SPR_H - s.h) && !(id === B.table && this.pick && this.pick.chair))) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq, prop: true, chair: id === B.chair };
        // (Round 73) What's on a rack or a stand, and what a painting shows.
        if (b.display) this.drawDisplay(ctx, game, wx, y, wz, id, sx, sy + SPR_H - s.h);
        // Hanging signs show what the building is.
        if (id === B.hanging_sign) {
          const ic = game.signIcons && game.signIcons.get(`${wx},${y},${wz}`);
          if (ic) ctx.drawImage(this.dropIcon(ic), sx + 3, sy + SPR_H - s.h + 4);
        }
      } else if (render === 'placed') {
        // Something set down: lying on the ground, a little shadow under it.
        const got = game.placed && game.placed.get(`${wx},${y},${wz}`);
        if (got) {
          const sh = TEX.misc.shadow;
          ctx.globalAlpha = 0.6 * (alpha < 1 ? alpha : 1);
          ctx.drawImage(atl, sh.x, sh.y, 16, 8, sx + 1, sy + SPR_H - 6, 14, 6);
          ctx.globalAlpha = alpha < 1 ? alpha : 1;
          const icon = got.bites ? bittenIcon(got.item, got.bites) : itemIcon(got.item);
          drawJewelled(ctx, icon, got.item, sx, sy + SPR_H - 14, this.time, true);
          if (got.count > 1) drawText(ctx, String(got.count), sx + 10, sy + SPR_H - 6, '#ffffff', '#000');
          if (pickable && this.under(null, sx, sy + SPR_H - 16, 16, 14, false)) this.pick = { x: wx, y, z: wz, face: 'front', id, seq: ++this.pickSeq, prop: true };
        }
      } else if (render === 'flat') {
        const arr = TEX.sprite[id * 4];
        // (A glyph plate shows its own glyph.)
        // (Round 79: rugs side by side, one carpet.)
        const s = arr[id === B.kav_plate ? metaAt(ci, y) & 3 : BLOCKS[id].rug ? rugJoin(world, wx, y, wz, id, this.view) : v % arr.length];
        const below = getAt(ci, y - 1);
        const oy = BLOCKS[below].liquid ? 3 : 0;
        ctx.drawImage(atl, s.x, s.y, 16, 16, sx, sy + LH + oy, 16, 16);
        if (pickable && this.under(s, sx, sy + LH + oy, 16, 16)) this.pick = { x: wx, y, z: wz, face: 'top', id, seq: ++this.pickSeq, prop: true, flat: true };
      } else if (render === 'fence') {
        if (this.drawFence(ctx, world, wx, y, wz, sx, sy, pickable, this.craftAt(game, wx, wz)) && pickable) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq, prop: true };
      } else if (render === 'wall') {
        if (this.drawFence(ctx, world, wx, y, wz, sx, sy, pickable, 0, TEX.wall && TEX.wall[id]) && pickable) this.pick = { x: wx, y, z: wz, face: mouse.y - sy < 16 ? 'top' : 'front', id, seq: ++this.pickSeq, prop: true };
      }
      if (alpha < 1) ctx.globalAlpha = 1;
      if (cur && cur.x === wx && cur.y === y && cur.z === wz) {
        this.cursorDrawList = { sx, sy, b };
      }
    };
    for (let r = 0; r < nRows - 1; r++) {
      z = zMin + r;
      const ents = buckets.get(z);
      if (ents) ents.sort((a, b) => a.layer - b.layer || a.rp.y - b.rp.y);
      let ei = 0;
      rowBase = r * W;
      frontBase = (r + 1) * W;
      fadeRow = z >= pz && z <= pz + 7;
      for (y = 0; y < WORLD_Y; y++) {
        sy = z * TILE - y * LH - camY;
        // (Down past the bottom of the screen a little, at the ground, so
        // the great things in a square, taller than a pace, don't vanish
        // while their tops still show: see pieces.js.)
        if (sy < this.vh + 4 + (y === GROUND ? 68 : 0) && sy + SPR_H + LH > -4) {
          fadeLayer = fadeRow && y >= pLayer && (z > pz || y > pLayer + 1);
          const st = y < Lc ? this.groundStrip(game, z, y, x0, x1, kAt) : null;
          if (st) this.drawStrip(ctx, game, st, z, y, x0, x1, sy, drawAt, gfxOn);
          else for (let i = 0; i < W; i++) drawAt(i);
        }
        // Entities standing in this row whose body occupies up to this layer.
        if (ents) {
          while (ei < ents.length && ents[ei].layer <= y) {
            const q = ents[ei++];
            if (q.deco) q.deco();
            else this.drawQueued(ctx, q, game);
          }
        }
      }
      if (ents) {
        while (ei < ents.length) {
          const q = ents[ei++];
          if (q.deco) q.deco();
          else this.drawQueued(ctx, q, game);
        }
      }
    }
  }

  // ------------------------------------------------------------ ground strips
  // (Round 80) The ground below your level, a row's layer at a time: the
  // solid blocks of row `v` (the view's row, the camera as it's turned) at
  // layer `y`, drawn once into a picture of their own (just as they'd be
  // drawn here), and taken from it while nothing they show has changed (a
  // block changed in the row or either side of it: see noteBlock; the
  // ground under it loaded, or swapped for another floor; the camera
  // turned). What else is on the layer (water, plants, doors open, things
  // set down) is listed, to be drawn square by square over it, in order.
  // Null if it's not to be had this frame (too many made already): the
  // layer's drawn the old way.
  groundStrip(game, v, y, x0, x1, kAt) {
    const world = game.world;
    const cache = (this.strips ||= new Map());
    if (this.stripView !== this.view || this.stripAtlas !== this.atlas || this.stripWorld !== world || this.stripDungeon !== !!game.dungeon) {
      cache.clear();
      this.rowVer = new Map();
      this.stripView = this.view;
      this.stripAtlas = this.atlas;
      this.stripWorld = world;
      this.stripDungeon = !!game.dungeon;
    }
    const key = v * 32 + y;
    let st = cache.get(key);
    const ver = this.rowVer.get(v) || 0;
    if (st && st.ver === ver && st.kAt === kAt && st.u0 <= x0 && st.u1 >= x1 && this.stripRegions(world, st)) {
      st.used = this.stripFrame;
      return st;
    }
    if (this.stripBudget <= 0) return null;
    this.stripBudget--;
    st = this.buildStrip(game, v, y, x0 - STRIP_REACH, x1 + STRIP_REACH, kAt, st);
    st.ver = ver;
    st.used = this.stripFrame;
    cache.set(key, st);
    // (Now and then, the pictures of rows long out of sight let go.)
    if (cache.size > 400 && this.stripFrame % 60 === 0) for (const [k, q] of cache) if (this.stripFrame - q.used > STRIP_KEEP) cache.delete(k);
    return st;
  }

  // Is the ground a strip was drawn from still the same ground (each
  // stretch of it the same, loaded or not)?
  stripRegions(world, st) {
    const R = st.regs;
    for (let k = 0; k < R.length; k += 3) if (world.regionAt(R[k], R[k + 1]) !== R[k + 2]) return false;
    return true;
  }

  // Draw row `v`'s layer `y`, from view column u0 to u1, into its picture
  // (`old`'s, if it's big enough). The picture holds the solid blocks
  // (closed doors among them) from the first column one's shown on to the
  // last; and with it, where each top and front shown is (for the
  // pointer), the tops (for ruts in the mud), the blocks (for the pointer's
  // own outline), and the columns of what's left to draw over it.
  buildStrip(game, v, y, u0, u1, kAt, old = null) {
    const world = game.world;
    const view = this.view;
    const atlas = this.atlas;
    const Wp = u1 - u0 + 3;
    // The columns of rows v - 1, v and v + 1 (one more each side), as
    // drawWorld has them: where each is in the world, and its ground.
    const n = Wp * 3;
    const lr = new Array(n);
    const lb = new Int32Array(n);
    const lwx = new Int32Array(n);
    const lwz = new Int32Array(n);
    const regs = [];
    const seen = new Set();
    for (let rr = 0; rr < 3; rr++) {
      for (let k = 0; k < Wp; k++) {
        const [wx, wz] = this.toWorld(u0 - 1 + k, v - 1 + rr);
        const reg = world.regionAt(wx, wz);
        const ci = rr * Wp + k;
        lr[ci] = reg;
        lwx[ci] = wx;
        lwz[ci] = wz;
        if (reg) lb[ci] = ((wz - reg.z0) * REGION_W + (wx - reg.x0)) * WORLD_Y;
        const rk = reg ? reg : `${Math.floor(wx / REGION_W)},${Math.floor(wz / REGION_D)}`;
        if (!seen.has(rk)) {
          seen.add(rk);
          regs.push(wx, wz, reg);
        }
      }
    }
    const getAt = (ci, yy) => {
      const reg = lr[ci];
      if (!reg || yy < 0 || yy >= WORLD_Y) return yy < 0 ? B.bedrock : B.air;
      return reg.blocks[lb[ci] + yy];
    };
    // What each column of the row is at this layer: drawn here (and which
    // faces), drawn over it, or nothing.
    const plan = [];
    const dyn = [];
    let cu0 = Infinity;
    let cu1 = -Infinity;
    for (let u = u0; u <= u1; u++) {
      const ci = Wp + (u - u0 + 1);
      const reg = lr[ci];
      if (!reg) continue;
      const ti = (lwz[ci] - reg.z0) * REGION_W + (lwx[ci] - reg.x0);
      if (y >= reg.top[ti]) continue;
      const id = reg.blocks[lb[ci] + y];
      if (id === 0) continue;
      const b = BLOCKS[id];
      const meta = reg.meta[lb[ci] + y];
      // (Round 116: an urchin bed, its urchins drawn over it each frame.)
      if (!(b.render === 'cube' || (b.render === 'door' && !(meta & META_STATE))) || barIds().has(id) || id === B.gt_urchins) {
        dyn.push(u);
        continue;
      }
      const above = getAt(ci, y + 1);
      const ab = BLOCKS[above];
      const showTop = !(ab.opaque && ab.render === 'cube') && !(CULL_SAME.has(id) && above === id);
      const fr = getAt(ci + Wp, y);
      const fb = BLOCKS[fr];
      const showFront = !(fb.opaque && fb.render === 'cube') && !(CULL_SAME.has(id) && fr === id);
      plan.push(u, ci, id, meta, (showTop ? 1 : 0) | (showFront ? 2 : 0));
      if (showTop || showFront) {
        if (u < cu0) cu0 = u;
        if (u > cu1) cu1 = u;
      }
    }
    const st = old || {};
    st.u0 = u0;
    st.u1 = u1;
    st.kAt = kAt;
    st.regs = regs;
    st.dyn = dyn;
    st.faces = [];
    st.tops = [];
    st.cubes = new Map();
    st.cu0 = cu0;
    if (cu1 < cu0) {
      st.canvas = null;
      for (let k = 0; k < plan.length; k += 5) st.cubes.set(plan[k], plan[k + 2]);
      return st;
    }
    const w = (cu1 - cu0 + 1) * TILE;
    let c = st.canvas;
    if (!c || c.width < w || c.width > w * 2) {
      c = document.createElement('canvas');
      c.width = w;
      c.height = SPR_H;
    }
    st.canvas = c;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    for (let k = 0; k < plan.length; k += 5) {
      const u = plan[k];
      const ci = plan[k + 1];
      const id = plan[k + 2];
      const meta = plan[k + 3];
      const show = plan[k + 4];
      st.cubes.set(u, id);
      if (!show) continue;
      const wx = lwx[ci];
      const wz = lwz[ci];
      const b = BLOCKS[id];
      const atl = kAt !== null && kavTinted()[id] === 1 ? kAt : atlas;
      const lk = lookedId()[id] === 1 ? this.lookAt(game, wx, wz) : 0;
      const T = lk ? TEX.look[lk] || TEX : craftedId()[id] === 1 ? TEX.craft[this.craftAt(game, wx, wz)] || TEX : TEX;
      const sx = (u - cu0) * TILE;
      const vr = variantAt(wx, y, wz);
      const rot = b.rotatable ? ((meta & META_ROT) + view) & 3 : 0;
      if (show & 1) {
        const tops = T.top[id * 4 + rot];
        const s = tops[vr % tops.length];
        g.drawImage(atl, s.x, s.y, 16, 16, sx, 0, 16, 16);
        st.faces.push(u, 0, wx, wz, id);
        this.edgeShade(g, getAt, ci, Wp, y, sx, 0, id);
        if (y > 6 && b.opaque) {
          g.fillStyle = `rgba(255,250,235,${Math.min(0.16, (y - 6) * 0.028)})`;
          g.fillRect(sx, 0, 16, 16);
        }
        st.tops.push(u, wx, wz, id);
      }
      if (show & 2) {
        const fronts = T.front[id * 4 + rot];
        const s = fronts[vr % fronts.length];
        g.drawImage(atl, s.x, s.y, 16, LH, sx, 16, 16, LH);
        st.faces.push(u, 1, wx, wz, id);
      }
    }
    return st;
  }

  // A row's layer from its picture, and over it what's drawn square by
  // square (in the order drawWorld would have): ruts in the mud on its
  // tops, then the rest of the layer; the pointer, as if each block had
  // been drawn here.
  drawStrip(ctx, game, st, v, y, x0, x1, sy, drawAt, gfxOn) {
    const camX = this.camX;
    if (st.canvas) ctx.drawImage(st.canvas, st.cu0 * TILE - camX, sy);
    const gfx = this.gfx;
    if (gfxOn && gfx && (gfx.marks.size > 0 || gfx.splashes.size > 0 || gfx.wet > 0.25)) {
      const T = st.tops;
      for (let k = 0; k < T.length; k += 4) {
        const u = T[k];
        if (u < x0 || u > x1) continue;
        gfx.drawTop(ctx, game.world, T[k + 1], y, T[k + 2], T[k + 3], false, u * TILE - camX, sy, this.time);
      }
    }
    const m = this.mouse;
    if (m && st.faces.length && m.y >= sy && m.y < sy + SPR_H) {
      const F = st.faces;
      for (let k = 0; k < F.length; k += 5) {
        const sx = F[k] * TILE - camX;
        if (m.x < sx || m.x >= sx + 16) continue;
        const front = F[k + 1] === 1;
        const fy = front ? sy + 16 : sy;
        if (m.y < fy || m.y >= fy + (front ? LH : 16)) continue;
        this.pick = { x: F[k + 2], y, z: F[k + 3], face: front ? 'front' : 'top', id: F[k + 4], seq: ++this.pickSeq };
      }
    }
    const cur = game.cursor;
    if (cur && cur.y === y) {
      const [cu, cv] = this.toView(cur.x, cur.z);
      const id = cv === v ? st.cubes.get(cu) : undefined;
      if (id !== undefined) this.cursorDrawList = { sx: cu * TILE - camX, sy, b: BLOCKS[id] };
    }
    for (const u of st.dyn) if (u >= x0 && u <= x1) drawAt(u - x0);
  }

  // (Round 80) A block changed at (x, y, z): the pictures of its row, and
  // of the rows either side (whose faces and edges it touches), are drawn
  // again when next wanted.
  // (Round 82) A door at (x, y, z) set swinging open (or shut): whoever
  // did it, you or anyone (see Game.onBlockChange).
  swing(x, y, z, open) {
    this.swings.set(`${x},${y},${z}`, { t: 0, open, x, y, z });
    this.noteBlock(x, y, z);
  }

  // (Round 83) A chair pushed in or pulled out at (x, y, z): slid there
  // over a moment (see chairTuck).
  chairMove(x, y, z) {
    const k = `${x},${y},${z}`;
    const was = this.chairs.get(k);
    this.chairs.set(k, { t: 0, from: was ? was.k : null });
  }

  // How far in under its table a chair is drawn (1 all the way, 0 out),
  // easing to where it's set.
  chairTuck(x, y, z, inUnder) {
    const want = inUnder ? 1 : 0;
    if (!this.chairs.size) return want;
    const key = `${x},${y},${z}`;
    const c = this.chairs.get(key);
    if (!c) return want;
    if (c.from === null) c.from = 1 - want;
    c.t += this.frameDt || 0.016;
    const f = Math.min(1, c.t / 0.3);
    c.k = c.from + (want - c.from) * (1 - (1 - f) * (1 - f));
    if (f >= 1) this.chairs.delete(key);
    return c.k;
  }

  // A chest's lid held up a while by someone at it (yours stays up while
  // its window's open).
  lidOpen(x, y, z, secs = 2.5) {
    this.lidHeld.set(`${x},${y},${z}`, this.time + secs);
  }

  // How open a chest's lid is (0 shut, 1 up), or 0.
  lidAt(x, y, z) {
    return this.lids.size ? this.lids.get(`${x},${y},${z}`) || 0 : 0;
  }

  tickHinges(game, dt) {
    for (const [k, sw] of this.swings) {
      sw.t += dt;
      if (sw.t >= SWING_S) {
        this.swings.delete(k);
        this.noteBlock(sw.x, sw.y, sw.z);
      }
    }
    const want = new Set();
    const cw = game && game.ui && game.ui.find ? game.ui.find('container') : null;
    if (cw && cw.pos) want.add(`${cw.pos.x},${cw.pos.y},${cw.pos.z}`);
    for (const [k, until] of this.lidHeld) {
      if (until > this.time) want.add(k);
      else this.lidHeld.delete(k);
    }
    for (const k of want) if (!this.lids.has(k)) this.lids.set(k, 0);
    for (const [k, v] of this.lids) {
      const to = want.has(k) ? 1 : 0;
      const nv = v + Math.sign(to - v) * Math.min(Math.abs(to - v), dt / LID_S);
      if (nv <= 0 && !to) this.lids.delete(k);
      else this.lids.set(k, nv);
    }
  }

  // A door part-way through its swing: the shut leaf turning on its hinge
  // (narrower as it turns edge-on to you, darker), the open one coming in.
  drawSwing(ctx, atl, T, id, rot, v, sx, sy, sw) {
    const k0 = Math.min(1, sw.t / SWING_S);
    const k = sw.open ? k0 : 1 - k0;
    const e = k * k * (3 - 2 * k);
    const tops = T.top[id * 4 + rot];
    const fronts = T.front[id * 4 + rot];
    const st = tops[v % tops.length];
    const sf = fronts[v % fronts.length];
    const a0 = ctx.globalAlpha;
    if (rot === 0 || rot === 2) {
      const w = Math.max(3, Math.round(16 * (1 - e * 0.82)));
      ctx.drawImage(atl, st.x, st.y, 16, 16, sx, sy, w, 16);
      ctx.drawImage(atl, sf.x, sf.y, 16, LH, sx, sy + 16, w, LH);
      ctx.fillStyle = `rgba(10,6,4,${0.4 * e})`;
      ctx.fillRect(sx, sy, w, 16 + LH);
    } else {
      const h = Math.max(3, Math.round(16 * (1 - e * 0.82)));
      const hf = Math.round(LH * (1 - e));
      ctx.drawImage(atl, st.x, st.y, 16, 16, sx, sy, 16, h);
      if (hf > 0) ctx.drawImage(atl, sf.x, sf.y, 16, LH, sx, sy + h, 16, hf);
      ctx.fillStyle = `rgba(10,6,4,${0.4 * e})`;
      ctx.fillRect(sx, sy, 16, h + hf);
    }
    if (e > 0.6) {
      const s = T.sprite[id * 4 + rot][0];
      ctx.globalAlpha = a0 * ((e - 0.6) / 0.4);
      ctx.drawImage(atl, s.x, s.y, s.w, s.h, sx, sy, s.w, s.h);
      ctx.globalAlpha = a0;
    }
  }

  // A chest's lid lifted `k` of the way (0..1) on its hinge at the back:
  // the inside dark under it, the lid itself (its own picture, rows 11-16
  // of the chest's) standing up behind as it opens.
  drawLid(ctx, atl, s, sx, sy, k) {
    const e = k * k * (3 - 2 * k);
    if (e <= 0.02) return;
    const inside = Math.round(5 * e);
    ctx.fillStyle = '#140d07';
    ctx.fillRect(sx + 2, sy + 17 - inside, 12, inside);
    ctx.fillStyle = '#3a2614';
    if (inside > 1) ctx.fillRect(sx + 2, sy + 16, 12, 1);
    const lh = 6 + Math.round(2 * e);
    const ly = sy + 11 - Math.round(7 * e);
    ctx.drawImage(atl, s.x, s.y + 11, s.w, 6, sx, ly, s.w, lh);
    if (e > 0.5) {
      ctx.fillStyle = `rgba(30,18,8,${(e - 0.5) * 0.6})`;
      ctx.fillRect(sx + 2, ly + 1, 12, lh - 2);
    }
  }

  noteBlock(x, y, z) {
    if (!this.rowVer) return;
    const v = this.toView(x, z)[1];
    for (let k = v - 1; k <= v + 1; k++) this.rowVer.set(k, (this.rowVer.get(k) || 0) + 1);
  }

  // How see-through a block drawn at (sx, sy) is because it hides the
  // player, drawn standing at (psx, psy) (the top of the floor they stand
  // on): by how much of them it covers. (Round 64: it went by how near the
  // block was, so blocks beside them and a step down, that hid nothing of
  // them, were drawn half there, and looked darker than they are.)
  fadeFor(sx, sy, psx, psy) {
    const px0 = psx + 3;
    const px1 = psx + 13;
    const py0 = psy - 18;
    const py1 = psy + 10;
    const ox = Math.min(px1, sx + TILE) - Math.max(px0, sx);
    const oy = Math.min(py1, sy + SPR_H) - Math.max(py0, sy);
    if (ox <= 0 || oy <= 0) return 1;
    const cover = (ox * oy) / ((px1 - px0) * (py1 - py0));
    if (cover < 0.22) return 1;
    return Math.max(0.3, 1 - (cover - 0.1) * 1.1);
  }

  // Alpha a block is drawn with because it hides the player (1 = opaque).
  occlusionAlpha(x, y, z, player) {
    const rp = player.renderPos();
    const [u, v] = this.toView(x, z);
    const pv = this.toView(player.x, player.z)[1];
    if (!(v >= pv && v <= pv + 7 && y >= player.y && (v > pv || y > player.y + 1))) return 1;
    const [pu, pvv] = this.toView(rp.x, rp.z);
    const psx = pu * TILE - this.camX;
    const psy = pvv * TILE - rp.y * LH + LH - this.camY;
    const sx = u * TILE - this.camX;
    const sy = v * TILE - y * LH - this.camY;
    if (!(sx + TILE > psx - 6 && sx < psx + 22 && sy + SPR_H > psy - 20 && sy < psy + 20)) return 1;
    return this.fadeFor(sx, sy, psx, psy);
  }

  // Soft edge shading on top faces next to taller neighbours / drops.
  edgeShade(ctx, getAt, ci, W, y, sx, sy, id) {
    const up = BLOCKS[getAt(ci, y + 1)];
    if (up.solid) return;
    const lft = BLOCKS[getAt(ci - 1, y + 1)];
    const rgt = BLOCKS[getAt(ci + 1, y + 1)];
    const nth = BLOCKS[getAt(ci - W, y + 1)];
    ctx.fillStyle = 'rgba(10,6,20,0.28)';
    if (lft.opaque && lft.render === 'cube') ctx.fillRect(sx, sy, 2, 16);
    if (rgt.opaque && rgt.render === 'cube') ctx.fillRect(sx + 14, sy, 2, 16);
    if (nth.opaque && nth.render === 'cube') ctx.fillRect(sx, sy, 16, 3);
    // Ledge lines where the neighbour is lower.
    const lSame = BLOCKS[getAt(ci - 1, y)];
    const rSame = BLOCKS[getAt(ci + 1, y)];
    ctx.fillStyle = 'rgba(10,6,20,0.35)';
    if (!lSame.solid) ctx.fillRect(sx, sy, 1, 16);
    if (!rSame.solid) ctx.fillRect(sx + 15, sy, 1, 16);
    const nSame = BLOCKS[getAt(ci - W, y)];
    if (!nSame.solid) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(sx, sy, 16, 1);
    }
    // (Round 114) Below ground, where one floor meets another, the one
    // frays a little into the other, so they lie together rather than in
    // squares: see blendEdges.
    if (this.blendFloors) this.blendEdges(ctx, getAt, ci, W, y, sx, sy, id);
  }

  // (Round 114) Two different floors side by side: the one with the lower
  // id let into this tile along their shared edge in a ragged, dithered
  // band of its own texture (each edge done once, by the tile with the
  // higher id). Not where either is a made thing laid in squares (a rug,
  // a deck, a bridge, tiles): those keep their edges.
  blendEdges(ctx, getAt, ci, W, y, sx, sy, id) {
    if (!floorBlends(id)) return;
    for (let side = 0; side < 4; side++) {
      const off = side === 0 ? -1 : side === 1 ? 1 : side === 2 ? -W : W;
      const n = getAt(ci + off, y);
      if (n >= id || !floorBlends(n)) continue;
      const up = BLOCKS[getAt(ci + off, y + 1)];
      if (up && up.solid) continue;
      const img = this.fringeOf(n, side, (ci * 7 + y * 3 + side) & 3);
      if (img) ctx.drawImage(img, sx, sy);
    }
  }

  // A floor's top cut to a ragged band along one side (0 left, 1 right,
  // 2 top, 3 bottom), its edge dithered; kept.
  fringeOf(id, side, k) {
    if (this.fringeAtlas !== this.atlas) {
      this.fringes = new Map();
      this.fringeAtlas = this.atlas;
    }
    const key = (id * 4 + side) * 4 + k;
    let c = this.fringes.get(key);
    if (c !== undefined) return c;
    c = null;
    const tops = TEX.top[id * 4];
    const s = tops && tops[k % tops.length];
    if (s && typeof document !== 'undefined') {
      c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const g = c.getContext('2d');
      // (Only the pixels kept copied over: never read back off a canvas,
      // which stalls the frame.)
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          const along = side < 2 ? py : px;
          const into = side === 0 ? px : side === 1 ? 15 - px : side === 2 ? py : 15 - py;
          if (into > 3) continue;
          // (How far in it reaches here: one to three pixels, wavering.)
          const h = hash4(along, side, k, id);
          const d = 1 + ((h >>> 3) % 3);
          const keep = into < d - 1 || (into === d - 1 && (h & 1)) || (into === d && ((h >>> 1) & 3) === 0);
          if (keep) g.drawImage(this.atlas, s.x + px, s.y + py, 1, 1, px, py, 1, 1);
        }
      }
    }
    this.fringes.set(key, c);
    return c;
  }

  // Which way something seen side-on faces on screen (left, or right):
  // going up or down the screen, it keeps the way it last faced.
  sideOf(e) {
    const d = this.viewDir(e.dir);
    if (d === 1) e.sideLeft = true;
    else if (d === 3) e.sideLeft = false;
    return e.sideLeft !== false;
  }

  drawSide(ctx, img, x, y, left) {
    if (left) {
      ctx.drawImage(img, Math.round(x), Math.round(y));
      return;
    }
    ctx.save();
    ctx.translate(Math.round(x) + img.width, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  // (Round 82) Which way a horse or a wagon is heading in the world (see
  // steeds.js): the rider's own, driven with tank controls (see
  // riding.js); else eased round toward the way it's going (or facing),
  // a turn at a time rather than all at once.
  steedAngle(e, m = null) {
    if (m && typeof m.ang === 'number') return m.ang;
    if (e._angAt === this.time && e._ang !== undefined) return e._ang;
    let target;
    if (typeof e.ang === 'number') target = e.ang;
    else if (e.moving && e.fx !== undefined && (e.x !== e.fx || e.z !== e.fz)) target = Math.atan2(e.x - e.fx, e.z - e.fz);
    else if (e.kind === 'prop') target = dirAngle(e.face ?? 1);
    else target = e._ang ?? dirAngle(e.dir ?? 0);
    e._ang = e._ang === undefined ? target : easeAngle(e._ang, target, e.kind === 'prop' ? 2.4 : 5, Math.min(0.1, this.frameDt || 0.016));
    e._angAt = this.time;
    return e._ang;
  }

  // The way a rider (or someone sat in a wagon) faces on screen, from the
  // heading on screen `a`: mostly side on.
  seatDir(a) {
    const u = Math.sin(a);
    const v = Math.cos(a);
    return Math.abs(u) > Math.abs(v) * 0.7 ? (u < 0 ? 1 : 3) : v < 0 ? 2 : 0;
  }

  // Under a rider: a horse; under a driver: the wagon, its horse out in
  // front, turned in the round to the way it's heading. Returns how far
  // up the rider sits.
  drawMount(ctx, e, m, sx, feetY) {
    const a = this.steedAngle(e, m) - (this.view * Math.PI) / 2;
    e._seat = this.seatDir(a);
    const legs = e.moving ? 1 + (Math.floor(this.time * 6) % 2) : 0;
    if (m.kind === 'horse') {
      const S = steedSprite('horse', { coat: m.coat || 0, banner: m.banner || null, saddle: !!m.saddle, frame: legs }, a, makeCanvas);
      this.steedImg(ctx, S, Math.round(sx + 8 - S.ox), Math.round(feetY - S.oy));
      return 12;
    }
    this.drawWagonAt(ctx, sx + 8, feetY, a, m, e.moving ? Math.floor(this.time * 5) : 0, { coat: m.coat || 0, saddle: !!m.saddle }, legs);
    return WAGON_SEAT.lift;
  }

  // A wagon with its bench at screen x `cx` (so a driver sat there is
  // centred on it), heading `a` on screen, its horse in the shafts (if
  // `horse`), and passengers: sat in the bed, seen from the waist up over
  // its sides; someone up on the bench. (Heading away, they're drawn
  // first, so the wagon's nearer parts hide what they should.) Returns
  // the picture drawn.
  drawWagonAt(ctx, cx, feetY, a, m, frame = 0, horse = null, legs = 0) {
    const riders = m.riders || [];
    const hood = m.hood !== false ? (riders.length ? 'open' : true) : false;
    const S = steedSprite('wagon', { banner: m.banner || null, hood, frame: frame % 4, horse, legs, look: m.look || 0 }, a, makeCanvas);
    const dir = this.seatDir(a);
    const people = () => {
      const seats = riders.map((look, i) => ({ look, p: S.at(BED_F[i % BED_F.length], 0, 0.55), crop: true }));
      if (m.bench) seats.push({ look: m.bench, p: S.at(0.05, 0, 0.75), crop: false });
      // (Round 90) Another player up on the bench beside whoever's driving.
      if (m.benchMate) seats.push({ look: m.benchMate, p: S.at(0.05, 0.38, 0.75), crop: false });
      seats.sort((q, r) => q.p.y - r.p.y);
      for (const q of seats) {
        const sheet = humanoidSheet(q.look);
        const x = Math.round(cx + q.p.x);
        const y = Math.round(feetY + q.p.y);
        // (Sitting, the seat's 18 rows down the sprite, under its padding.)
        const hgt = q.crop ? SPR_PAD + 17 : SHEET_H;
        ctx.drawImage(sheet, 4 * CHAR_W, dir * SHEET_H, CHAR_W, hgt, x - 8, y - 18 - SPR_PAD, CHAR_W, hgt);
      }
    };
    const away = Math.cos(a) < -0.2;
    // (Round 87: those in it, with the part of it their seats are over.)
    const seated = !this.slice || this.slice.anchor;
    if (away && seated) people();
    this.steedImg(ctx, S, Math.round(cx - S.ox), Math.round(feetY - S.oy));
    if (!away && seated) people();
    return { S, x: Math.round(cx - S.ox), y: Math.round(feetY - S.oy) };
  }

  // Which part of a standing wagon the mouse is over: its bench at the
  // front, or the bed at the back (whichever's nearer, as it's turned).
  wagonPart(e, cx, feetY, S) {
    const m = this.mouse;
    if (!m || !S) return 'back';
    const b = S.at(0, 0, 0.7);
    const k = S.at(-1.1, 0, 0.7);
    return Math.hypot(m.x - (cx + b.x), m.y - (feetY + b.y)) < Math.hypot(m.x - (cx + k.x), m.y - (feetY + k.y)) ? 'bench' : 'back';
  }

  // A windmill's sails, turning on their hub. They turn in the plane of the
  // wall they're on (along x or z), drawn as that plane looks from where the
  // camera is: full on, the four sails sweeping round; side on, edge-on,
  // rising and falling past the hub.
  drawSails(ctx, e, sx, feetY) {
    // (Round 83) Not while you're inside the mill (its roof and walls up
    // there cut away), nor where its hub is cut away.
    const inside = this.game && this.game.buildingAtPlayer ? this.game.buildingAtPlayer() : null;
    if (inside && inside.sails && inside.sails.x === e.x && inside.sails.y === e.y && inside.sails.z === e.z) return;
    if (this.hidden !== null && this.isHidden(e.x, e.y, e.z)) return;
    const [du, dv] = this.toViewDir(e.along ? 1 : 0, e.along ? 0 : 1);
    // The hub's middle, moved out to its outer face (the way it faces, as
    // the camera has it: its face toward you, away, or to a side), and a
    // little off it: where the sails turn, whichever way you look.
    const [nu, nv] = this.toViewDir(e.nx ?? 0, e.nz ?? (e.along ? 1 : 0));
    const cx = sx + 8 + nu * 9;
    const cy = feetY - 8 + nv * 9;
    // (Wind in the weather turns them quicker.)
    const spin = e.spin || 0.7;
    const a0 = (this.time * spin + (e.seed || 0) * 1.7) % (Math.PI * 2);
    // In-plane coords (p along the wall, q up) to screen.
    const P = (pa, pb) => [cx + pa * du * TILE, cy + pa * dv * TILE - pb * LH];
    const side = du === 0;
    const R = 3.5;
    const W = 0.95;
    const poly = (pts, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    };
    ctx.save();
    for (let k = 0; k < 4; k++) {
      const th = a0 + (k * Math.PI) / 2;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const at = (r, w) => P(r * c - w * sn, r * sn + w * c);
      // The spar, hub to tip.
      const [x0, y0] = at(0, 0);
      const [x1, y1] = at(R + 0.2, 0);
      ctx.strokeStyle = '#4a3420';
      ctx.lineWidth = side ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (side) {
        // Edge on: the cloth a pale strip down the spar.
        ctx.strokeStyle = '#e8dfc8';
        ctx.lineWidth = 1;
        const [a1, b1] = at(0.7, 0);
        ctx.beginPath();
        ctx.moveTo(a1 + 1, b1);
        ctx.lineTo(x1 + 1, y1);
        ctx.stroke();
        continue;
      }
      // The cloth on its lattice, on the trailing side of the spar, lit a
      // little differently as it comes round.
      const lit = 0.5 + 0.5 * Math.sin(th + 0.8);
      const cloth = `rgb(${Math.round(206 + 34 * lit)},${Math.round(196 + 32 * lit)},${Math.round(172 + 30 * lit)})`;
      poly([at(0.7, 0), at(R, 0), at(R, W), at(0.7, W * 0.85)], cloth);
      ctx.strokeStyle = 'rgba(90,64,40,0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let r = 0.7; r <= R + 0.01; r += (R - 0.7) / 4) {
        const [ax, ay] = at(r, 0);
        const [bx, by] = at(r, W * (r <= 0.71 ? 0.85 : 1));
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      const [ex, ey] = at(0.7, W * 0.85);
      const [fx, fy] = at(R, W);
      ctx.moveTo(ex, ey);
      ctx.lineTo(fx, fy);
      ctx.stroke();
    }
    // The hub's cap.
    ctx.fillStyle = '#3a2814';
    ctx.fillRect(Math.round(cx - 3), Math.round(cy - 3), 6, 6);
    ctx.fillStyle = '#8a6438';
    ctx.fillRect(Math.round(cx - 2), Math.round(cy - 2), 3, 3);
    ctx.restore();
  }

  // A wagon standing still: its hood, wheels and banner (and whoever's
  // sitting in it).
  drawProp(ctx, e, sx, feetY) {
    if (e.type === 'catapult' || e.type === 'ram') return this.drawEngine(ctx, e, sx, feetY);
    if (e.type === 'ship') return this.drawShip(ctx, e, sx, feetY);
    if (e.type === 'sails') return this.drawSails(ctx, e, sx, feetY);
    if (e.type !== 'wagon') return;
    // (Round 82: in the round, turned the way it's heading; its own shadow
    // under it.)
    const a = this.steedAngle(e) - (this.view * Math.PI) / 2;
    const going = !!(e.moving && e.ride);
    const legs = going ? 1 + (Math.floor(this.time * 6) % 2) : 0;
    // (Round 84) In the look of the people it was made among (the town it
    // was first seen in, or is still kept by).
    if (e.wagonLook === undefined) e.wagonLook = this.lookAt(this.game, Math.round(e.x), Math.round(e.z));
    const D = this.drawWagonAt(ctx, sx + 8, feetY, a, { banner: e.banner, riders: e.riders || [], bench: e.bench || null, hood: e.hood, look: e.wagonLook }, going ? Math.floor(this.time * 5) : 0, e.horse ? { coat: e.horse.coat || 0, saddle: !!e.horse.saddle } : null, legs);
    // Under the mouse? (To climb in: on the bench, or into the back.)
    const m = this.mouse;
    const S = D.S;
    if (m && m.x >= D.x && m.x < D.x + S.img.width && m.y >= D.y && m.y < D.y + S.img.height) {
      // (Round 115: off the pixels it was made from, never read back off
      // the canvas each frame the mouse is over it.)
      // (Round 128: the pointer's whole pixel; it's rarely on a whole one,
      // and a fractional index finds nothing at all.)
      const ix = Math.floor(m.x - D.x);
      const iy = Math.floor(m.y - D.y);
      const a = S.px ? (S.px[iy * S.w + ix] >>> 24) : pixelsIn(S.img, ix, iy, 1, 1)[3];
      if (a > 120) this.pickEnt = { e, seq: ++this.pickSeq, part: this.wagonPart(e, sx + 8, feetY, S) };
    }
  }

  // A siege engine, side on, turned toward the enemy: a catapult's arm
  // cocked, swinging up, thrown; a ram's log swung back and driven in.
  // Wrecked, it lies dark and still.
  drawEngine(ctx, e, sx, feetY) {
    const left = this.sideOf(e);
    const sh = TEX.misc.shadow;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this.atlas, sh.x, sh.y, 16, 8, sx - 12, feetY - 4, 40, 9);
    ctx.globalAlpha = 1;
    let img;
    let w;
    let h;
    if (e.type === 'catapult') {
      const f = e.broken ? 2 : e.fireT > 0.45 ? 2 : e.fireT > 0 ? 1 : 0;
      img = catapultSprite(f, e.banner);
      w = CATAPULT_W;
      h = CATAPULT_H;
    } else {
      // (Back, then in hard: the log's swing over half a second.)
      const t = e.fireT;
      const off = e.broken ? 0 : t > 0.3 ? 3 : t > 0 ? -3 : e.moving ? Math.round(Math.sin(this.time * 6)) : 0;
      img = ramSprite(off, e.banner);
      w = RAM_W;
      h = RAM_H;
    }
    const x = sx + 8 - Math.round(w / 2);
    const y = feetY - h + 3;
    if (e.broken) ctx.filter = 'brightness(0.45) saturate(0.4)';
    else if (e.flash > 0) ctx.filter = 'brightness(2.2)';
    this.drawSide(ctx, img, x, y, left);
    ctx.filter = 'none';
    // Under the mouse? (To hack at it.)
    const m = this.mouse;
    if (m && m.x >= x && m.x < x + w && m.y >= y && m.y < feetY + 2) this.pickEnt = { e, seq: ++this.pickSeq };
  }

  // A trade ship on the water, side on, bobbing: her sail furled at the
  // pier and set under way; whoever's aboard along the rail; foam at her
  // bow when she's moving.
  drawShip(ctx, e, sx, feetY) {
    const left = this.sideOf(e);
    const bob = Math.round(Math.sin(this.time * 1.4 + e.id) * 1.2);
    const x = sx + 8 - Math.round(SHIP_W / 2);
    const y = feetY - SHIP_H + 12 + bob;
    // Her shadow on the water.
    ctx.fillStyle = 'rgba(10,30,60,0.35)';
    ctx.fillRect(x + 6, feetY + 3, SHIP_W - 12, 3);
    this.drawSide(ctx, shipSprite(e.banner, !!e.sail), x, y, left);
    // Those aboard: heads and shoulders above the rail.
    (e.riders || []).forEach((look, i) => {
      const sheet = humanoidSheet(look);
      const px = x + (left ? 24 + i * 7 : SHIP_W - 24 - i * 7);
      const top = y + SHIP_DECK - 9;
      ctx.drawImage(sheet, 4 * CHAR_W, (left ? 1 : 3) * SHEET_H, CHAR_W, 12, px - 8, top - SPR_PAD, CHAR_W, 12);
    });
    if (e.moving) {
      ctx.fillStyle = 'rgba(240,248,255,0.8)';
      const bow = left ? x + 3 : x + SHIP_W - 4;
      const stern = left ? x + SHIP_W - 6 : x + 5;
      for (let k = 0; k < 4; k++) {
        ctx.fillRect(bow + (left ? -k : k), feetY + 1 + ((k + Math.floor(this.time * 8)) % 3), 1, 1);
        ctx.fillRect(stern + (left ? k * 2 : -k * 2), feetY + 2 + (k % 2), 2, 1);
      }
    }
    const m = this.mouse;
    if (m && m.x >= x && m.x < x + SHIP_W && m.y >= y && m.y < feetY + 4) this.pickEnt = { e, seq: ++this.pickSeq };
  }

  // One of the great things in a square (see pieces.js), its foot on the
  // front edge of the pace at (sx, sy) (row `row` on screen): see-through
  // while it stands between you and the camera, and picked as itself.
  drawPiece(game, ctx, x, y, z, id, meta, sx, sy, row, fadeable, pRect, prow) {
    const name = BLOCKS[id].name;
    const f = (Math.floor(this.time * PIECE_FPS) + x * 7 + z * 3) % PIECE_FRAMES;
    const img = pieceFrame(name, (f + PIECE_FRAMES) % PIECE_FRAMES, meta & META_STATE);
    const dx = sx + 8 - (PIECE_W >> 1);
    const dy = sy + SPR_H - img.height;
    let a = 1;
    if (fadeable && prow < row && pRect.x1 > dx + 4 && pRect.x0 < dx + PIECE_W - 4 && pRect.y1 > dy && pRect.y0 < sy + SPR_H - 12) a = 0.45;
    if (this.veil && this.veil.veiled(x, y, z, id)) return;
    if (a < 1) ctx.globalAlpha = a;
    ctx.drawImage(img, dx, dy);
    if (a < 1) ctx.globalAlpha = 1;
    const m = this.mouse;
    if (m && a === 1 && m.x >= dx + 3 && m.x < dx + PIECE_W - 3 && m.y >= dy + 6 && m.y < sy + SPR_H - 2) this.pick = { x, y, z, face: 'front', id, seq: ++this.pickSeq, prop: true };
  }

  // A fence post with rails to its neighbours (in view directions). Returns
  // whether any drawn part is under the mouse, when asked.
  // (Round 84) Whose look what's put up at (x, z) is in (see lookart.js):
  // the people of the town it's in (0, the Valeborn's, out of town). Kept
  // by four-pace patches, like the craft.
  lookAt(game, x, z) {
    const ow = game && game.world && game.world.ow;
    if (!ow || game.dungeon) return 0;
    const hour = Math.floor((game.minute || 0) / 60);
    if (this.lookOw !== ow || this.lookHour !== hour) {
      this.lookOw = ow;
      this.lookHour = hour;
      this.lookCache = new Map();
    }
    const k = (x >> 2) * 65536 + (z >> 2);
    let c = this.lookCache.get(k);
    if (c === undefined) {
      const s = ow.settlementAt((x >> 2) * 4 + 2, (z >> 2) * 4 + 2) || ow.settlementAt(x, z);
      c = s ? LOOK_OF[s.style] ?? LOOK_OF[s.culture] ?? 0 : 0;
      if (this.lookCache.size > 20000) this.lookCache.clear();
      this.lookCache.set(k, c);
    }
    return c;
  }

  // Whose craft the furniture at (x, z) is made in (see textures.CRAFTS):
  // the people of the town it stands in, or, out of town, the island's
  // own (0, the old oak, on Thessa and beyond). Kept by four-pace patches,
  // looked at afresh each hour (towns grow).
  craftAt(game, x, z) {
    const ow = game && game.world && game.world.ow;
    if (!ow || game.dungeon) return 0;
    const hour = Math.floor((game.minute || 0) / 60);
    if (this.craftOw !== ow || this.craftHour !== hour) {
      this.craftOw = ow;
      this.craftHour = hour;
      this.craftCache = new Map();
    }
    const k = (x >> 2) * 65536 + (z >> 2);
    let c = this.craftCache.get(k);
    if (c === undefined) {
      const cx = (x >> 2) * 4 + 2;
      const cz = (z >> 2) * 4 + 2;
      const s = ow.settlementAt(cx, cz) || ow.settlementAt(x, z);
      if (s) c = CRAFTS[s.style] || 0;
      else {
        const isle = ow.islandAt ? ow.islandAt(cx, cz) : null;
        c = isle === 'kharos' ? CRAFTS.ember : isle === 'myrrow' ? CRAFTS.mist : 0;
      }
      if (this.craftCache.size > 20000) this.craftCache.clear();
      this.craftCache.set(k, c);
    }
    return c;
  }

  // (Round 70: a thin wall too, its own parts in `parts`, joining walls,
  // fences and solid blocks the same way.)
  drawFence(ctx, world, x, y, z, sx, sy, pickTest = false, craft = 0, parts = null) {
    const f = parts || (craft ? TEX.craft[craft].fence : TEX.misc.fence);
    const atlas = this.atlas;
    const conn = (du, dv) => {
      const [dx, dz] = this.toWorld(du, dv);
      const b = BLOCKS[world.getBlock(x + dx, y, z + dz)];
      return b.render === 'fence' || b.render === 'wall' || (b.opaque && b.render === 'cube') || b.render === 'door';
    };
    let hit = false;
    const d = (s) => {
      ctx.drawImage(atlas, s.x, s.y, s.w, s.h, sx, sy, s.w, s.h);
      if (pickTest && !hit && this.under(s, sx, sy)) hit = true;
    };
    if (conn(0, -1)) d(f.north);
    if (conn(-1, 0)) d(f.west);
    d(f.post);
    if (conn(1, 0)) d(f.east);
    if (conn(0, 1)) d(f.south);
    return hit;
  }

  // (Round 82) Iron bars: a thin grille down the middle of the square, run
  // on into the bars beside it (or the wall or door it meets), whichever
  // way that is as you look; a post where it turns a corner, or ends. Its
  // rail along the top only where there's nothing more of it above, its
  // foot rail only where it stands on something else; a cell's door in it
  // with its lock. (Rows 0-15 are the square's top; a face d pixels down
  // it runs from row d to row d + 12.)
  drawBars(ctx, world, x, y, z, sx, sy, id) {
    const bar = (q) => q === B.iron_bars || q === B.cell_door || q === B.cell_door_top || q === B.cell_door_open;
    const conn = (du, dv) => {
      const [dx, dz] = this.toWorld(du, dv);
      const q = world.getBlock(x + dx, y, z + dz);
      const b = BLOCKS[q];
      return bar(q) || (b.opaque && b.render === 'cube') || b.render === 'wall' || b.render === 'door';
    };
    const up = bar(world.getBlock(x, y + 1, z));
    const down = bar(world.getBlock(x, y - 1, z));
    const W = conn(-1, 0);
    const E = conn(1, 0);
    const N = conn(0, -1);
    const S = conn(0, 1);
    const LIT = '#b4b4c4';
    const MID = '#6a6a78';
    const DARK = '#3a3a46';
    const TOP = '#9a9aa8';
    const f = (x0, y0, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(sx + x0, sy + y0, w, h);
    };
    // (Round 128) A cell door standing open: the gap in the bars, its hinge
    // post at the side, and the door swung back against the wall, seen end
    // on, its cross-bars one behind another.
    if (id === B.cell_door_open) {
      const hingeW = W || !E;
      const hx = hingeW ? 0 : 13;
      const back = N && !S;
      if (back) {
        f(hx + 1, 0, 2, 20, MID);
        f(hx + 1, 0, 1, 20, LIT);
        for (let r = 9; r < 19; r += 3) f(hx, r, 3, 1, DARK);
      }
      f(hx, 6, 3, 14, MID);
      f(hx, 6, 1, 14, LIT);
      f(hx + 2, 6, 1, 14, DARK);
      if (!back) {
        f(hx + 1, 10, 2, 18, MID);
        f(hx + 1, 10, 1, 18, LIT);
        for (let r = 13; r < 27; r += 3) f(hx, r, 3, 1, DARK);
      }
      f(hingeW ? 13 : 0, 6, 3, 14, MID);
      f(hingeW ? 13 : 0, 6, 1, 14, LIT);
      return;
    }
    // Away up the screen, end on: a strip down the middle (its top, then
    // the bars one behind another).
    const endOn = (r0, r1) => {
      f(7, r0, 2, r1 - r0, MID);
      f(7, r0, 1, r1 - r0, LIT);
      f(9, r0, 1, r1 - r0, DARK);
      if (!up) f(7, r0, 2, Math.min(8, r1 - r0 - 12), TOP);
    };
    if (N) endOn(0, 20);
    // Across the screen: bars every four pixels (on from one square to the
    // next), a rail at the top and foot and one across the middle.
    const across = (x0, x1) => {
      for (let bx = x0 === 0 ? 3 : 11; bx < x1; bx += 4) {
        f(bx, 8, 1, 12, LIT);
        if (bx + 1 < 16) f(bx + 1, 8, 1, 12, DARK);
      }
      if (!up) {
        f(x0, 7, x1 - x0, 1, TOP);
        f(x0, 8, x1 - x0, 1, DARK);
      }
      f(x0, 14, x1 - x0, 1, DARK);
      if (!down) f(x0, 19, x1 - x0, 1, DARK);
    };
    if (W) across(0, 7);
    if (E) across(9, 16);
    // The post (a corner, or an end).
    f(6, 8, 3, 12, MID);
    f(6, 8, 1, 12, LIT);
    f(8, 8, 1, 12, DARK);
    if (!up) f(6, 6, 3, 2, TOP);
    if (id === B.cell_door && (W || E || !(N || S))) {
      f(10, 11, 4, 4, '#2a2a34');
      f(10, 11, 4, 1, '#8a8a98');
      f(11, 12, 1, 2, '#e0c040');
    }
    // Toward you, end on: in front of the post.
    if (S) endOn(8, 28);
  }

  // ------------------------------------------------------------------ entities
  // Blinded by a kraken's ink: black all round, but for a little way about
  // you (thinning out as it wears off).
  drawInk(game) {
    const p = game.player;
    if (!p || !(p.inkT > 0)) return;
    const ctx = this.ctx;
    const rp = p.renderPos();
    const cx = rp.x * TILE - this.camX + 8;
    const cy = rp.z * TILE - rp.y * LH + LH - this.camY;
    const k = Math.min(1, p.inkT / 1.2);
    const r0 = 26 + (1 - k) * 80;
    const g = ctx.createRadialGradient(cx, cy, r0 * 0.55, cx, cy, r0 * 1.35);
    g.addColorStop(0, 'rgba(6,2,10,0)');
    g.addColorStop(1, `rgba(6,2,10,${0.96 * k})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.vw, this.vh);
    // (Wisps of the ink, curling.)
    ctx.globalAlpha = 0.25 * k;
    ctx.fillStyle = '#2a1830';
    for (let i = 0; i < 14; i++) {
      const a = this.time * 0.6 + i * 0.45;
      const rr = r0 * (1.05 + 0.25 * Math.sin(this.time * 1.3 + i));
      ctx.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.6), 3, 2);
    }
    ctx.restore();
  }

  // (Round 88) A note played on an instrument at (x, y, z), heard on this
  // screen: fainter the further off, not at all past earshot. (In a world
  // with others in it, sent to every screen near it as it's played: see
  // net/host.js hook; so you hear your own playing as a guest, and theirs.)
  instrumentNote(x, y, z, key, i) {
    const g = this.game;
    if (!g || !g.ui || !g.ui.music) return;
    const L = (g.audio && g.audio.listener) || g.player;
    const d = L ? Math.hypot(L.x - x, L.z - z) : 0;
    if (d > NOTE_EARSHOT) return;
    this.noteVoice ||= new InstrumentVoice(g.ui.music);
    this.noteVoice.play(key, i, Math.max(0.12, 1 - d / NOTE_EARSHOT));
  }

  // (Round 87) You, faint, over whatever's built in front of you (see
  // drawWorld): no speech, name or pointer of you twice.
  drawPlayerGhost(ctx, game) {
    const p = game.player;
    if (!p || p.dead || p.deck) return;
    const wp = p.renderPos();
    const [u, v] = this.toView(wp.x, wp.z);
    const nb = this.bubbles.length;
    const nt = this.tags.length;
    const pe = this.pickEnt;
    ctx.save();
    ctx.globalAlpha = 0.42;
    try {
      this.drawEntity(ctx, p, { x: u, y: wp.y, z: v }, game);
    } finally {
      ctx.restore();
      this.bubbles.length = nb;
      this.tags.length = nt;
      this.pickEnt = pe;
    }
  }

  // (Round 87) One queued in a row: the whole of it, or (a horse or a
  // wagon) the part of it over that row.
  drawQueued(ctx, q, game) {
    this.slice = q.slice || null;
    try {
      this.drawEntity(ctx, q.e, q.rp, game);
    } finally {
      this.slice = null;
    }
  }

  // A horse, a wagon, or someone on one: what to cut it by (its kind,
  // whether there's a horse in the shafts, its heading on screen); else
  // null.
  steedSpan(e) {
    if (e.kind === 'prop') return e.type === 'wagon' ? { kind: 'wagon', horse: !!e.horse, a: this.steedAngle(e) - (this.view * Math.PI) / 2 } : null;
    const m = e.mount;
    if (m && !e.sleeping && (m.kind === 'horse' || m.kind === 'wagon')) return { kind: m.kind, horse: true, a: this.steedAngle(e, m) - (this.view * Math.PI) / 2 };
    if (e.kind === 'creature' && e.species === 'horse' && !drawnAsMaster(e)) return { kind: 'horse', horse: true, a: this.steedAngle(e) - (this.view * Math.PI) / 2 };
    return null;
  }

  // A horse's or wagon's picture: all of it, or the row's part of it.
  steedImg(ctx, S, x, y) {
    const s = this.slice;
    if (!s) return ctx.drawImage(S.img, x, y);
    const img = steedSlices(S, s.q, makeCanvas).get(s.k);
    if (img) ctx.drawImage(img, x, y);
  }

  drawEntity(ctx, e, rp, game) {
    // (Swallowed: out of sight, inside it.)
    if (e.kind === 'player' && e.swallowed) return;
    // (Round 73) Gone down into the ground with the Tooth: sinking into it
    // (what's below the floor cut away), then out of sight (see
    // evolvedgear.tooth).
    if (e.tunnel) {
      if (e.tunnel.phase !== 'dig') return;
      if (!e.sinking) {
        const k = Math.min(1, e.tunnel.t / TUNNEL_DIG);
        const feet = Math.round(rp.z * TILE - rp.y * LH + LH - this.camY) + 10;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-2000, -2000, 6000, feet + 2001);
        ctx.clip();
        ctx.translate(0, Math.round(k * 22));
        e.sinking = true;
        try {
          this.drawEntity(ctx, e, rp, game);
        } finally {
          e.sinking = false;
          ctx.restore();
        }
        return;
      }
    }
    // (Round 71: drawn by its master, as part of it: see evolvedfx.js.)
    if (e.S && e.S.unseen) return;
    let sx = Math.round(rp.x * TILE - this.camX);
    const floorY = Math.round(rp.z * TILE - rp.y * LH + LH - this.camY); // top of floor face
    const feetY = floorY + 10 - (e.hop || 0);
    const cull = this.slice ? 72 : 32;
    if (sx < -cull || sx > this.vw + cull || feetY < -40 || feetY > this.vh + 40) return;
    const sh = TEX.misc.shadow;
    const inWater = e.inWater;
    // Sat in the back of a wagon: drawn with it (see drawProp).
    if (e.inWagon) return;
    // (Round 87) A part of a horse or wagon over a row of its own: that
    // part alone (the rest, and whoever's on it, with its seat's row).
    if (this.slice && !this.slice.anchor) {
      if (e.kind === 'prop') this.drawProp(ctx, e, sx, feetY);
      else if (e.mount) this.drawMount(ctx, e, e.mount, sx, feetY);
      else {
        const a = this.steedAngle(e) - (this.view * Math.PI) / 2;
        const f = e.moving ? 1 + (Math.floor(this.time * 6) % 2) : 0;
        const S = steedSprite('horse', { coat: e.variant || 0, banner: e.banner || null, saddle: !!e.saddled, frame: f }, a, makeCanvas);
        this.steedImg(ctx, S, Math.round(sx + 8 - S.ox), Math.round(feetY - S.oy));
      }
      return;
    }
    if (e.kind === 'item') {
      const bob = Math.sin(this.time * 4 + e.id) * 1.5;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(this.atlas, sh.x, sh.y, 16, 8, sx + 2, feetY - 3, 12, 5);
      ctx.globalAlpha = 1;
      const icon = this.dropIcon(e.item);
      const air = e.air || 0;
      drawJewelled(ctx, icon, e.item, sx + 4, Math.round(feetY - 9 + bob - air * LH), this.time, true);
      return;
    }
    // A wagon standing still (at a camp or outside town).
    if (e.kind === 'prop') {
      this.drawProp(ctx, e, sx, feetY);
      return;
    }
    let bob = 0;
    // A master of an old place: drawn bigger, and grander (see bossart.js).
    const master = drawnAsMaster(e);
    if (e.raft) {
      // The raft, turned to its heading pixel by pixel, bobbing on the water.
      bob = Math.round(Math.sin(this.time * 2.2 + e.id) * 0.8);
      const img = raftSprite(e.raft.ang - this.view * Math.PI / 2, makeCanvas);
      ctx.drawImage(img, sx + 8 - RAFT_BOX / 2, floorY + 8 - RAFT_BOX / 2 + bob);
    } else if (master) {
      if (!e.burrowed) drawBossUnder(this, ctx, e, sx, feetY);
    } else if (!e.sleeping && !inWater && !(e.mount && !e.mount.creature) && !(e.kind === 'creature' && e.species === 'horse')) ctx.drawImage(this.atlas, sh.x, sh.y, 16, 8, sx, feetY - 4, 16, 8);
    // (A master coming apart: see scenes.js, bossDefeat. Round 71: one
    // drawn from its texture staggers, falls and comes apart into motes of
    // itself: see bossanim.js. Only its light rises in it here.)
    const a00 = ctx.globalAlpha;
    if (master) watchBoss(this, e);
    if (e.dying !== undefined) {
      const k = e.dying;
      if (master) ctx.filter = `brightness(${1 + Math.min(k, 0.6) * 2 + (Math.floor(this.time * 20) % 2) * Math.min(k, 0.5)})`;
      else {
        ctx.globalAlpha = a00 * Math.max(0, 1 - k * k);
        ctx.filter = `brightness(${1 + k * 2.5 + (Math.floor(this.time * 20) % 2) * k})`;
        sx += Math.round((Math.random() - 0.5) * 3 * k);
      }
    }
    if (e.flash > 0) ctx.filter = 'brightness(3)';
    // Rolling: a tumble, head over heels, with a blur of afterimages.
    const rolling = (e.kind === 'player' || e.kind === 'creature' || (e.kind === 'npc' && e.wing)) && e.rollT > 0 && !e.mount && !e.raft;
    if (!rolling && e.rollTrail) e.rollTrail = null;
    if (e.kind === 'creature' && e.species === 'horse') {
      // A horse, bigger than the rest: in the round (Round 82), turning
      // the way it's going.
      const a = this.steedAngle(e) - (this.view * Math.PI) / 2;
      const f = e.moving ? 1 + (Math.floor(this.time * 6) % 2) : 0;
      const S = steedSprite('horse', { coat: e.variant || 0, banner: e.banner || null, saddle: !!e.saddled, frame: f }, a, makeCanvas);
      this.steedImg(ctx, S, Math.round(sx + 8 - S.ox), Math.round(feetY - S.oy));
    } else if (master && drawBossArt(this, ctx, e, sx, feetY)) {
      // (Painted, one to one, moving: see bossbody.js.)
    } else if (master && e.kind === 'creature' && drawBossBody(this, ctx, e, sx, feetY, game, (q) => creatureSheet(q.species, q.variant || 0))) {
      // (Drawn: see bossart.js.)
    } else if (e.kind === 'player' && e.sheepT > 0) {
      // (Round 53) Turned into a sheep by a dish: a sheep, till it wears
      // off (see game/dishacts.js).
      const sheet = creatureSheet('sheep', 0);
      const sz = sheet.height;
      const frames = sheet.width / (sz * 2);
      const f = e.moving ? Math.floor(this.time * 6) % frames : 0;
      const flip = e.dir === 3 ? frames : 0;
      ctx.drawImage(sheet, (f + flip) * sz, 0, sz, sz, sx + 8 - sz / 2, Math.round(feetY - sz + 1), sz, sz);
    } else if (e.kind === 'creature') {
      const sheet = creatureSheet(e.species, e.variant || 0);
      // (Square frames: 16 across, or 32 for something great.)
      const sz = sheet.height;
      const frames = sheet.width / (sz * 2);
      // (Floating things bob through their frames whether moving or not.)
      const f = lookFrame(e.species, e, this.time) ?? (e.moving || (e.S && (e.S.floats || e.S.anim)) ? Math.floor(this.time * 6) % frames : 0);
      const flip = e.dir === 3 ? frames : 0;
      const hop = e.species === 'slime' ? Math.abs(Math.sin(this.time * 6 + e.id)) * 3 : 0;
      const lu = this.bodyLunge(e, this.viewDir(e.dir));
      const cx = sx + 8 - sz / 2 + lu.x;
      const cy = Math.round(feetY - sz + 1 - hop + lu.y - (e.burrowed ? sz : 0) + (e.rise || 0));
      // (Burrowed: only the churned earth shows, moving.)
      if (!e.burrowed) {
        // (Faded: an ash wraith, all but unseen; a puffer gone limp.)
        const fa = ctx.globalAlpha;
        if (e.fade !== undefined && e.fade < 1) ctx.globalAlpha = fa * Math.max(0.05, e.fade);
        ctx.drawImage(sheet, (f + flip) * sz, 0, sz, sz, cx, cy, sz, sz);
        ctx.globalAlpha = fa;
        // The blight in it: a faint violet edge, breathing.
        if (e.infected) {
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * (0.35 + 0.2 * Math.sin(this.time * 3 + (e.id || 0)));
          ctx.drawImage(frameGlow(sheet, (f + flip) * sz, 0, sz, sz, '#c070ff'), cx - 1, cy - 1);
          ctx.globalAlpha = a;
        }
        // (Round 111) Risen again with the curse in it: a sick green edge,
        // crawling.
        if (e.cursed) {
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * (0.45 + 0.25 * Math.sin(this.time * 5 + (e.id || 0)));
          ctx.drawImage(frameGlow(sheet, (f + flip) * sz, 0, sz, sz, '#8ad040'), cx - 1, cy - 1);
          ctx.globalAlpha = a;
        }
        // Its shield up (a warden's cover, a golem's plates): a pale rim of
        // light. (One of the Overseer's sentinels, holding up its shield:
        // bright, and pulsing.)
        // (Round 116) Winding up to strike (a lantern jelly gathering its
        // sting, a moray drawing back): a bright edge, quickening.
        if (e.tellT > 0) {
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(this.time * 30));
          ctx.drawImage(frameGlow(sheet, (f + flip) * sz, 0, sz, sz, e.species === 'lantern_jelly' ? '#e0ffff' : '#ffe0a0'), cx - 1, cy - 1);
          ctx.globalAlpha = a;
        }
        if (e.armourT > 0 || e.shieldUp || e.sentinel) {
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * (e.sentinel ? 0.7 + 0.3 * Math.sin(this.time * 6) : 0.45 + 0.25 * Math.sin(this.time * 10));
          ctx.drawImage(frameGlow(sheet, (f + flip) * sz, 0, sz, sz, e.sentinel ? '#c8fbff' : '#5ad8f0'), cx - 1, cy - 1);
          ctx.globalAlpha = a;
        }
      }
      // Just fed on someone's breath (a ghoul): it glows with it a while.
      if (e.fedT > 0) {
        e.fedT -= this.frameDt || 0.016;
        const a = ctx.globalAlpha;
        ctx.globalAlpha = a * Math.min(1, e.fedT) * (0.55 + 0.35 * Math.sin(this.time * 18));
        ctx.drawImage(frameGlow(sheet, (f + flip) * sz, 0, sz, sz, '#9cf0b0'), cx - 1, cy - 1);
        ctx.globalAlpha = a;
      }
    } else {
      if (e.sleeping) {
        const head = this.headFor(e);
        ctx.drawImage(head, sx + 2, floorY - 1);
        if (!e.down && Math.floor(this.time * 1.5 + e.id) % 3 === 0) drawText(ctx, 'z', sx + 12, floorY - 8 - (this.time * 4 % 4), '#c8d8ff');
      } else {
        // (A master stands half as tall again, breathing.)
        const bk = master ? bossScale(e, this.time) : null;
        if (bk) {
          ctx.save();
          ctx.translate(sx + 8, feetY);
          ctx.scale(bk.x, bk.y);
          ctx.translate(-(sx + 8), -feetY);
        }
        // On horseback, or up on a wagon's bench: the beast (and the wagon)
        // first, the rider sitting up on top.
        const mount = e.mount && !e.sleeping ? e.mount : null;
        let lift = 0;
        if (mount) lift = this.drawMount(ctx, e, mount, sx, feetY);
        // (Down on one knee, a bout lost: low, as if sitting on nothing.)
        const kneel = e.kneelT > 0 && !mount && !e.moving;
        const frame = e.actionTimer > 0 && !mount && !kneel && !e.sitting ? 3 : e.raft || mount || kneel ? 4 : e.moving ? 1 + (Math.floor(this.time * 7) % 2) : e.sitting ? 4 : 0;
        const dir = mount ? (e._seat ?? 1) : this.viewDir(e.dir);
        // Guard up: the shield comes off the arm and up in front of them
        // (see drawRaisedShield); the blade's held across instead.
        if (e.guardT > 0) e.guardT -= this.frameDt || 0.016;
        const guard = !rolling && !mount && !inWater && this.guarding(e);
        const raised = guard && dir !== 2 ? this.raisedShield(e) : null;
        const sheet = humanoidSheet(raised ? this.unshielded(e.look) : e.look);
        // Thrown into a blow: leaning back to wind up, lunging into it.
        const lu = mount || e.sitting || kneel ? { x: 0, y: 0 } : this.bodyLunge(e, dir);
        const sx0 = sx;
        sx += lu.x;
        const top = feetY - CHAR_H + 1 + (e.raft ? 1 + bob : 0) - lift + lu.y + (kneel ? 3 : 0);
        // (A second blade, on the far side of them, goes behind.)
        const offKey = e.offhandItem ? e.offhandItem() : null;
        if (offKey && (dir === 1 || dir === 3) && !rolling) this.drawHeld(ctx, offKey, e, sx, top, true, this.guarding(e));
        // (Facing away, what's in the hand is in front of them: behind
        // them, as we see it, so it's drawn first.)
        const held = e.heldItem && !rolling ? e.heldItem() : null;
        const heldBehind = dir === 2 && !raised;
        if (held && heldBehind) this.drawHeld(ctx, held, e, sx, top, false, guard);
        // Jewelled armour: a faint glow of its stone's colour round them.
        const worn = e.kind === 'player' ? Object.values(e.equip || {}) : e.rec ? Object.values(e.rec.wear || {}) : [];
        const stone = worn.map((k) => k && ITEMS[k] && ITEMS[k].socket).find(Boolean);
        if (stone && !inWater) {
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * (0.3 + 0.25 * (0.5 + 0.5 * Math.sin(this.time * 2.4 + e.id)));
          ctx.drawImage(frameGlow(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, GEMS[stone].color), sx - 1, top - SPR_PAD - 1);
          ctx.globalAlpha = a;
        }
        // (Round 73) A parry coming: their blade up, flashing yellow.
        if (e.parryUpT > 0 && !inWater) {
          const a = ctx.globalAlpha;
          ctx.globalAlpha = a * (Math.floor(this.time * 12) % 2 ? 0.95 : 0.45);
          ctx.drawImage(frameGlow(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, '#ffe040'), sx - 1, top - SPR_PAD - 1);
          ctx.globalAlpha = a;
        }
        // Gone into shadow (onyx): you're half there, dusk-violet.
        const shade = e.shadeT > 0;
        const a0 = ctx.globalAlpha;
        if (shade) {
          ctx.globalAlpha = a0 * 0.4;
          ctx.filter = 'brightness(0.4) sepia(1) hue-rotate(220deg) saturate(2)';
        }
        // Wounded in bloodstone armour: a red pulse round you, the deeper
        // the wounds, the stronger.
        const rage = e.kind === 'player' && !shade && e.hp < e.maxHp * 0.6 && worn.some((k) => k && ITEMS[k] && ITEMS[k].socket === 'bloodstone');
        if (rage) {
          ctx.globalAlpha = a0 * (0.35 + 0.4 * (1 - e.hp / e.maxHp)) * (0.6 + 0.4 * Math.sin(this.time * 7));
          ctx.drawImage(frameGlow(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, '#ff3040'), sx - 1, top - SPR_PAD - 1);
          ctx.globalAlpha = a0;
        }
        // A fallen star's wing (see wing.js): behind them, unless they've
        // their back to you.
        const wing = e.wing && !inWater && !e.submerged && !rolling && !mount ? e.wing : null;
        if (wing && !wingInFront(dir)) drawWing(ctx, dir, sx, top, wing.k, this.time + (e.id || 0));
        // (Kept: it sheds a little light of its own, so the dark doesn't
        // dim it: see Lighting.draw. Not drawn again over everything: round
        // 50, it showed through whatever stood in front of it.)
        if (e.wing && this.wingsLit && e.wing.k >= 0.999 && !inWater && !e.submerged) this.wingsLit.push({ x: e.x, y: e.y, z: e.z });
        if (e.submerged) {
          // Under black water: rings spreading, two pale eyes.
          const k = (this.time * 0.8 + e.id * 0.37) % 1;
          ctx.strokeStyle = `rgba(200,230,240,${0.45 * (1 - k)})`;
          ctx.beginPath();
          ctx.ellipse(sx + 8, feetY - 3, 3 + k * 6, 1 + k * 2, 0, 0, Math.PI * 2);
          ctx.stroke();
          if (Math.floor(this.time * 0.7 + e.id) % 3 === 0) {
            ctx.fillStyle = '#c8ffd0';
            ctx.fillRect(sx + 6, feetY - 4, 1, 1);
            ctx.fillRect(sx + 9, feetY - 4, 1, 1);
          }
        } else if (inWater && e.swimming && !mount) {
          // (Round 77) Swimming: in to the shoulders, bobbing, the water
          // breaking white round them.
          const bob = Math.round(Math.sin(this.time * 4 + (e.id || 0)) * 1);
          ctx.drawImage(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H - 11, sx, top + 8 + bob - SPR_PAD, CHAR_W, SHEET_H - 11);
          ctx.fillStyle = 'rgba(70,140,210,0.6)';
          ctx.fillRect(sx + 1, top + CHAR_H - 4 + bob, 14, 2);
          ctx.fillStyle = 'rgba(235,245,255,0.85)';
          const k = Math.floor(this.time * 6 + (e.id || 0)) % 2;
          ctx.fillRect(sx + 2 + k, top + CHAR_H - 4 + bob, 3, 1);
          ctx.fillRect(sx + 10 - k, top + CHAR_H - 4 + bob, 3, 1);
        } else if (inWater) {
          ctx.drawImage(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H - 6, sx, top + 3 - SPR_PAD, CHAR_W, SHEET_H - 6);
          ctx.fillStyle = 'rgba(80,150,220,0.55)';
          ctx.fillRect(sx + 2, top + CHAR_H - 5, 12, 2);
        } else if (e.wading && !rolling && !e.S?.floats) {
          // (Round 73) Down in acid or quicksilver to the shins: the liquid's
          // own colour lapping round them, rippling.
          ctx.drawImage(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H - 3, sx, top + 2 - SPR_PAD, CHAR_W, SHEET_H - 3);
          const acid = e.wading === 'acid_pool';
          const k = Math.sin(this.time * 6 + e.id) > 0 ? 1 : 0;
          ctx.fillStyle = acid ? 'rgba(130,210,60,0.75)' : 'rgba(200,208,224,0.85)';
          ctx.fillRect(sx + 1 + k, top + CHAR_H - 3, 14 - k, 2);
          ctx.fillStyle = acid ? 'rgba(220,255,140,0.8)' : 'rgba(255,255,255,0.9)';
          ctx.fillRect(sx + 3 + k * 2, top + CHAR_H - 3, 2, 1);
          ctx.fillRect(sx + 10 - k, top + CHAR_H - 3, 2, 1);
        } else if (rolling) this.drawTumble(ctx, e, sheet, dir, sx, top);
        else {
          // (Round 77) Leaning on a wall: tipped back against it.
          const ia = e.idleAnim && !e.moving ? e.idleAnim : null;
          // (Round 84: only where they leant, still about their day.)
          const lean = ia && ia.kind === 'lean' && (ia.x === undefined || (ia.x === e.x && ia.z === e.z && ia.y === e.y)) && (!e.state || e.state === 'routine') ? this.leanOf(ia) : 0;
          if (lean) {
            ctx.save();
            ctx.translate(sx + 8, feetY);
            ctx.rotate(lean);
            ctx.translate(-(sx + 8), -feetY);
          }
          // (Round 128) A stretch, or a hand raised as they talk: their own
          // figure with its arms so, not a hand painted on over it.
          const pose = ia && !mount && e.look ? this.poseOf(ia, dir) : null;
          if (pose) ctx.drawImage(humanoidPose(e.look, pose), 0, dir * SHEET_H, CHAR_W, SHEET_H, sx, top - SPR_PAD, CHAR_W, SHEET_H);
          else ctx.drawImage(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, sx, top - SPR_PAD, CHAR_W, SHEET_H);
          if (lean) ctx.restore();
          // (Round 82) The broom only once what was in the hand's away, and
          // away again a moment before it's taken back out: see
          // NPC.sweeping.)
          if (ia && ia.kind === 'sweep' && !mount && ia.t > SWEEP_STOW && ia.t < ia.dur - SWEEP_STOW) this.drawBroom(ctx, sx, top, feetY, dir);
          if (ia && (ia.kind === 'gesture' || ia.kind === 'stretch') && !mount && !e.look) this.drawIdleHands(ctx, e, ia, sx, top, dir);
        }
        if (wing && wingInFront(dir)) drawWing(ctx, dir, sx, top, wing.k, this.time + (e.id || 0));
        // ...and now and then a mote of its light drifting off it.
        if (wing && wing.k >= 0.999 && !this.spin) {
          e._wingT = (e._wingT || 0) - (this.frameDt || 0.016);
          if (e._wingT <= 0) {
            e._wingT = 0.35 + Math.random() * 0.5;
            const rp = e.renderPos();
            this.emit(rp.x + (Math.random() - 0.5) * 0.8, rp.y + 1 + Math.random() * 0.8, rp.z, { n: 1, color: ['#a8dcff', '#e0f4ff', '#78b8ff'], up: 6, speed: 4, life: 0.9, gravity: -4, glow: true });
          }
        }
        // (The blight in it: a faint violet edge.)
        if (e.infected && !rolling && !inWater) {
          ctx.globalAlpha = a0 * (0.35 + 0.2 * Math.sin(this.time * 3 + (e.id || 0)));
          ctx.drawImage(frameGlow(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, '#c070ff'), sx - 1, top - SPR_PAD - 1);
          ctx.globalAlpha = a0;
        }
        // (Round 111: risen again with the curse in it, a sick green edge.)
        if (e.cursed && !rolling && !inWater) {
          ctx.globalAlpha = a0 * (0.45 + 0.25 * Math.sin(this.time * 5 + (e.id || 0)));
          ctx.drawImage(frameGlow(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, '#8ad040'), sx - 1, top - SPR_PAD - 1);
          ctx.globalAlpha = a0;
        }
        // (A master's edge lit in its colour; white as a blow comes.)
        if (bk && !rolling && !inWater) {
          const wind = e.windup ? Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur)) : 0;
          ctx.globalAlpha = a0 * Math.min(1, 0.35 + 0.2 * Math.sin(this.time * 3 + (e.id || 0)) + wind * 0.5);
          ctx.drawImage(frameGlow(sheet, frame * CHAR_W, dir * SHEET_H, CHAR_W, SHEET_H, wind > 0.6 && Math.floor(this.time * 12) % 2 ? '#ffffff' : bossTint(e)[0]), sx - 1, top - SPR_PAD - 1);
          ctx.globalAlpha = a0;
        }
        if (shade) ctx.filter = 'none';
        // A ward of moonlight round you: a pale ring, turning.
        if (e.moonWard) {
          ctx.globalAlpha = a0 * (0.5 + 0.3 * Math.sin(this.time * 6));
          ctx.strokeStyle = '#e8f0ff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(sx + 8, top + 12, 11, 14, 0, this.time * 2, this.time * 2 + Math.PI * 1.6);
          ctx.stroke();
          ctx.globalAlpha = a0;
        }
        // (Side on, a raised shield is in front of the blade; face on, the
        // blade's held over it, ready.)
        if (raised && dir !== 0) this.drawHeld(ctx, held, e, sx, top, false, guard);
        if (raised) this.drawRaisedShield(ctx, e, raised, dir, sx, top);
        if (held && !(raised && dir !== 0) && !heldBehind) this.drawHeld(ctx, held, e, sx, top, false, guard);
        if (offKey && dir === 0 && !rolling) this.drawHeld(ctx, offKey, e, sx, top, true, guard);
        if (shade) ctx.globalAlpha = a0;
        sx = sx0;
        // ...and a glint of it now and then.
        if (stone && !this.spin) {
          e.shimmerT = (e.shimmerT || 0) - (this.frameDt || 0.016);
          if (e.shimmerT <= 0) {
            e.shimmerT = 0.6 + Math.random() * 0.6;
            const rp = e.renderPos();
            this.emit(rp.x + (Math.random() - 0.5) * 0.6, rp.y + 0.6 + Math.random() * 0.8, rp.z, { n: 1, color: [GEMS[stone].color, '#ffffff'], up: 8, speed: 6, life: 0.7, gravity: -6 });
          }
        }
        if (bk) ctx.restore();
      }
    }
    if (e.flash > 0) ctx.filter = 'none';
    if (e.dying !== undefined) {
      ctx.filter = 'none';
      ctx.globalAlpha = a00;
    }
    // On fire, dazed, chilled.
    if (!e.dead && !this.spin && e.kind !== 'item') {
      const tall = e.kind !== 'creature' || e.species === 'horse';
      if (e.burnT > 0) drawBurning(this, ctx, e, sx, feetY, tall, this.frameDt || 0.016);
      if (e.stunT > 0 || e.slowT > 0 || e.frozenT > 0 || e.bleedT > 0 || e.markT > 0) drawStatus(this, ctx, e, sx, feetY, tall, this.frameDt || 0.016);
    }
    // Under the mouse? (The last thing drawn there is what you point at.)
    const m = this.mouse;
    // (Another player, too: right-click them for their profile.)
    const other = e.kind === 'player' && !!e.account && !!game && e !== game.player;
    if (m && (e.kind !== 'player' || other) && e.kind !== 'item' && !e.dead && !e.burrowed) {
      const big = e.kind === 'creature' && e.S && e.S.big;
      // (A master's a little more than it's drawn: easier to put a blow on.)
      // (And some, broader, more again: see footprint.padOf.)
      const pad = master && e.S && e.S.pad ? Math.round((e.S.pad - 0.85) * 16) : 0;
      const h = (big ? 28 : e.kind === 'creature' ? 14 : e.sleeping ? 8 : 24) * (master ? BOSS_SCALE : 1) + (master && !big ? 6 : 0) + pad;
      const w = (big ? 12 : 0) + (master ? (big ? 6 : 10) : 0) + pad;
      if (m.x >= sx + 2 - w && m.x < sx + 14 + w && m.y >= feetY - h && m.y < feetY + 2) this.pickEnt = { e, seq: ++this.pickSeq, up: (feetY - m.y) / h };
    }
    // Straining at a lead: how near it is to breaking free.
    if (e.strain > 0 && (e.leadBy || e.leadTied) && !e.dead) {
      const w = 12;
      const f = Math.min(1, e.strain);
      const big = e.kind !== 'creature' || e.species === 'horse';
      const by = feetY - (big ? (e.hp < e.maxHp ? 33 : 29) : 17);
      ctx.fillStyle = '#2a1e14';
      ctx.fillRect(sx + 2, by, w + 2, 3);
      ctx.fillStyle = f > 0.75 && Math.floor(this.time * 8) % 2 ? '#ff5040' : f > 0.5 ? '#f08a30' : '#e8c060';
      ctx.fillRect(sx + 3, by + 1, Math.max(1, Math.round(w * f)), 1);
    }
    // (Round 52) Someone with something to ask of you (a gold "!"), done
    // what they asked (a green "?"), or still waiting on you (a grey "?");
    // one of the stories' own who wants a word with you (a blue "!"). See
    // sim/saga.
    if (e.kind === 'npc' && !e.dead && !e.sleeping && game && !(e.windup && !e.windup.dash)) {
      const mk = this.noQuestMarks ? null : game.remote ? e.netMark : game.questMark ? game.questMark(e) : null;
      if (mk) {
        const ch = mk === 'ready' || mk === 'busy' ? '?' : '!';
        const col = mk === 'ready' ? '#80f070' : mk === 'busy' ? '#a8a090' : mk === 'talk' ? '#80c8ff' : '#ffd040';
        const bob = Math.round(Math.sin(this.time * 4 + (e.id || 0)) * 1.2);
        drawText(ctx, ch, sx + 6, feetY - 36 + bob, col, '#000');
      }
    }
    // Winding up to strike: a red "!" over them, louder as it comes.
    if (e.windup && !e.dead && !e.windup.dash) {
      const f = Math.min(1, e.windup.t / Math.max(0.05, e.windup.dur));
      const big = e.kind !== 'creature' || e.species === 'horse';
      const col = f > 0.7 ? (Math.floor(this.time * 14) % 2 ? '#ffffff' : '#ff3030') : '#ff6040';
      drawText(ctx, '!', sx + 6, feetY - Math.round((big ? 40 : 26) * (master ? BOSS_SCALE : 1)) - Math.round(f * 2), col, '#000');
    }
    // Your guard up: a pale arc on the side you face (gold while a blow
    // met now would be parried).
    if (e.kind === 'player' && e.blocking) {
      const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][e.dir] || [0, 1];
      const [vx, vz] = this.toViewDir ? this.toViewDir(fx, fz) : [fx, fz];
      const parryT = game && game.parryWindow ? game.parryWindow() : 0.2;
      ctx.fillStyle = e.blockT < parryT ? 'rgba(255,240,160,0.85)' : 'rgba(160,200,255,0.45)';
      const cx = sx + 8 + vx * 9;
      const cy = feetY - 12 + vz * 6;
      if (vx) ctx.fillRect(cx - 1, cy - 7, 1, 12);
      else ctx.fillRect(cx - 6, cy, 12, 1);
    }
    // A heavy blow ready to let fly.
    if (e.kind === 'player' && game && game.charging && game.charging.ready && Math.floor(this.time * 10) % 2) {
      ctx.fillStyle = 'rgba(255,220,120,0.7)';
      ctx.fillRect(sx + 3, feetY - 30, 10, 1);
    }
    // Health bar when hurt.
    if (e.hp !== undefined && e.hp < e.maxHp && e.kind !== 'player' && !e.sleeping) {
      const w = 12;
      const f = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = '#1a1018';
      ctx.fillRect(sx + 2, feetY - 29, w + 2, 3);
      ctx.fillStyle = f > 0.5 ? '#58c048' : f > 0.25 ? '#e8c030' : '#e04040';
      ctx.fillRect(sx + 3, feetY - 28, Math.round(w * f), 1);
    }
    // Someone you're playing with: their name over them, and how they are.
    if (other && !this.spin) {
      const name = e.account.name || 'Player';
      const ty = feetY - (e.mount ? 46 : 38);
      // (Drawn last, over everyone: see render.)
      (this.tags ||= []).push({ name, x: Math.round(sx + 8 - textWidth(name) / 2), y: ty, sx, color: e.dead ? '#8a8098' : '#a0e0ff', f: !e.dead && e.hp < e.maxHp ? Math.max(0, e.hp / e.maxHp) : null });
    }
    const bubbles = this.bubbles || [];
    // Voices behind closed doors stay there.
    if ((e.bubble && e.bubble.t > 0) || (e.emote && e.emote.t > 0)) {
      if (game && game.speechAudible && !game.speechAudible(e)) return;
    }
    if (e.bubble && e.bubble.t > 0) bubbles.push({ text: e.bubble.text, x: sx + 8, y: feetY - (e.kind === 'creature' ? 20 : 28), color: e.bubble.color });
    if (e.emote && e.emote.t > 0) bubbles.push({ emote: true, text: e.emote.ch, x: sx + 5, y: feetY - 34 + Math.sin(this.time * 5) * 1.5, color: e.emote.color || '#ffe070' });
  }

  // Is their guard up? (Yours while you hold it; theirs a moment after a
  // blow's taken on it.)
  guarding(e) {
    return e.kind === 'player' ? !!e.blocking : e.guardT > 0;
  }

  // The shield on their arm, if it can be raised (none with a two-handed
  // weapon out: it's slung on their back).
  raisedShield(e) {
    const k = e.kind === 'player' ? e.equip && e.equip.shield : e.rec && e.rec.equipment && e.rec.equipment.shield;
    const it = k && ITEMS[k];
    if (!it || !it.block || it.kind !== 'armor') return null;
    const main = e.heldItem ? e.heldItem() : e.rec && e.rec.equipment && e.rec.equipment.weapon;
    const m = main && ITEMS[main];
    if (m && m.hands === 2) return null;
    return k;
  }

  // Their look without the shield on the arm (it's up in front instead).
  unshielded(look) {
    const c = (this._unshielded ||= new WeakMap());
    let v = c.get(look);
    if (!v) {
      v = look.gear ? { ...look, gear: { ...look.gear, shield: undefined } } : look;
      c.set(look, v);
    }
    return v;
  }

  // A shield up: face on, square in front of the chest; side on, edge on
  // out in front. It jolts back when a blow lands on it, and its rim
  // shines while a blow met now would be parried.
  drawRaisedShield(ctx, e, key, dir, sx, top) {
    const icon = itemIcon(key);
    const jolt = e.shieldJolt > 0 ? Math.round(e.shieldJolt * 10) : 0;
    if (e.shieldJolt > 0) e.shieldJolt -= this.frameDt || 0.016;
    const small = e.look && e.look.small ? 5 : 0;
    const y = top + 7 + small;
    const parryT = e.kind === 'player' && this.game && this.game.parryWindow ? this.game.parryWindow() : 0;
    const shine = e.kind === 'player' && e.blockT < parryT;
    const draw = (x, w, h) => {
      ctx.drawImage(icon, 0, 0, 16, 16, x, y + (dir === 0 ? jolt : 0), w, h);
      if (shine) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 40);
        ctx.drawImage(frameGlow(icon, 0, 0, 16, 16, '#fff4b0'), x - 1, y - 1 + (dir === 0 ? jolt : 0), w + 2, h + 2);
        ctx.globalAlpha = 1;
      }
    };
    if (dir === 0) {
      draw(sx + 1, 14, 14);
      return;
    }
    // Side on: the shield's edge, its face showing a sliver, the boss
    // standing out from it.
    const it = ITEMS[key];
    const lk = String((it && it.look) || 'wood').split(':')[0];
    const rim = lk === 'iron' ? '#c8c8d4' : '#5a3a1a';
    const face = lk === 'round' ? '#b83a32' : lk === 'iron' ? '#9a9aa8' : '#8a5a2a';
    const x = dir === 3 ? sx + 11 - jolt : sx + 2 + jolt;
    const out = dir === 3 ? 1 : -1;
    ctx.fillStyle = '#1c1622';
    ctx.fillRect(x - 1, y - 1, 5, 15);
    ctx.fillStyle = rim;
    ctx.fillRect(x, y, 3, 13);
    ctx.fillStyle = face;
    ctx.fillRect(x + (out > 0 ? 1 : 0), y + 1, 2, 11);
    ctx.fillStyle = lk === 'iron' ? '#ffffff' : '#c8a070';
    ctx.fillRect(x + (out > 0 ? 3 : -1), y + 5, 1, 3);
    if (shine) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.time * 40);
      ctx.fillStyle = '#fff4b0';
      ctx.fillRect(x - 1, y - 1, 5, 1);
      ctx.fillRect(x - 1, y + 13, 5, 1);
      ctx.fillRect(x + (out > 0 ? 3 : -1), y - 1, 1, 15);
      ctx.globalAlpha = 1;
    }
    // (Its set stone glints on the boss.)
    if (it && it.socket && GEMS[it.socket]) {
      ctx.fillStyle = GEMS[it.socket].color;
      ctx.fillRect(x + 1, y + 6, 1, 1);
    }
  }

  // The item sits in the hand: its handle (near the icon's bottom-left)
  // on the hand pixel of the sprite for the way they're facing.
  // What someone holds, at full size (the item's own picture, not the
  // little one dropped items use), its grip in their hand.
  drawHeld(ctx, key, e, sx, top, off = false, guard = false) {
    if (!key) return;
    // (Round 66: a mod's piece held its own way: see mod/gear.js.)
    const hl = MODS.heldLook ? MODS.heldLook(key) : null;
    // (Round 78) A rod with its line out: the rod alone, the line and the
    // bobber off its tip drawn out to the water (see fishingDecos).
    const rod = key === 'fishing_rod' && !off;
    const rodOut = rod && (e.rodFrame === this.frameNo || (e.cast && !e.cast.reel));
    const icon = hl && hl.img ? hl.img : itemIcon(rodOut ? 'fishing_rod_out' : key);
    const dir = this.viewDir(e.dir);
    const act = e.actionTimer > 0 ? e.actionTimer / e.actionDur : 0;
    const look = e.look || {};
    const small = look.small;
    const bob = e.moving ? (Math.floor(this.time * 7) % 2 ? -1 : 0) : 0;
    const hy = top + (small ? 6 : 0) + (look.stoop ? 1 : 0) + (e.sitting || e.raft ? 4 : 0) + 8 + (small ? 4 : 6) - 1 + bob;
    // The off hand is the other side of them (the far side, side on).
    const hx = sx + (off ? (dir === 0 ? 3 : dir === 1 ? 9 : dir === 3 ? 6 : 12) : dir === 0 ? 12 : dir === 1 ? 7 : dir === 3 ? 8 : 3);
    // (The grip is the bottom-left of the picture; held things are drawn at
    // four fifths size, in proportion to the hand holding them. A light is
    // held upright by the foot of its stem, which is the middle of the
    // picture, so it sits in the hand rather than beside it.)
    const upright = !!HELD_FLAMES[key];
    const gx = hl ? -hl.x : upright ? -7.5 : -3;
    const gy = hl ? -hl.y : upright ? -12 : -13;
    const S = hl ? hl.scale : 0.8;
    const mir = off && dir === 0 ? true : dir === 1;
    const pose = this.swingPose(e, dir, off, mir) || (guard ? this.guardPose(e, dir, off, mir) : null) || (rod ? this.rodPose(e, mir, rodOut) : null);
    if (!pose && act <= 0 && dir === 2) return; // behind them
    if (off && !pose && dir === 2) return;
    ctx.save();
    ctx.translate(hx + (pose ? pose.dx : 0), hy + (pose ? pose.dy : 0));
    let ang = 0;
    if (pose) ang = pose.ang;
    else if (act > 0 && !off) {
      const sign = dir === 1 ? -1 : 1;
      ang = sign * (1 - act) * 2.2 - sign * 1.1;
    }
    // A smear of light behind the edge as it comes round.
    if (pose && pose.smear > 0) {
      const base = mir ? -Math.PI * 0.75 : -Math.PI * 0.25;
      const a0 = base + pose.a0;
      const a1 = base + ang;
      const R = pose.heavy ? 13 : 11;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,255,255,${0.35 * pose.smear})`;
      ctx.lineWidth = pose.heavy ? 5 : 4;
      ctx.beginPath();
      ctx.arc(0, 0, R - 2, Math.min(a0, a1), Math.max(a0, a1));
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,248,210,${0.8 * pose.smear})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, R, Math.min(a0, a1), Math.max(a0, a1));
      ctx.stroke();
    }
    ctx.rotate(ang + (hl ? (mir ? -hl.ang : hl.ang) : 0));
    ctx.scale(mir ? -S : S, S);
    drawJewelled(ctx, icon, key, gx, gy, this.time, true);
    // (Where the rod's tip is, on the world's picture, for the line.)
    if (rod) {
      const m = ctx.getTransform();
      const px = gx + 13.5;
      const py = gy + 2.5;
      e.rodTip = { x: m.a * px + m.c * py + m.e + this.camX, y: m.b * px + m.d * py + m.f + this.camY, f: this.frameNo };
    }
    // A flame carried: embers off its head now and then, and a flicker of
    // brightness round it (the Everlight a steady cold shimmer).
    if (HELD_FLAMES[key] && !(e.snuffT > 0)) {
      const fl = HELD_FLAMES[key];
      const m = ctx.getTransform();
      const tip = { x: m.a * (gx + fl.x) + m.c * (gy + fl.y) + m.e, y: m.b * (gx + fl.x) + m.d * (gy + fl.y) + m.f };
      const k = 0.75 + 0.25 * Math.sin(this.time * 17 + (e.x || 0) * 3) * Math.sin(this.time * 7.3);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, fl.r);
      g.addColorStop(0, fl.glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35 * k;
      ctx.fillStyle = g;
      ctx.fillRect(tip.x - fl.r, tip.y - fl.r, fl.r * 2, fl.r * 2);
      ctx.globalAlpha = 1;
      if (Math.random() < fl.ember * (this.frameDt || 0.016) * 60 && this.particles.length < 800 && this.room(1)) {
        this.particles.push({ x: tip.x + this.camX + (Math.random() - 0.5) * 2, y: tip.y + this.camY, vx: (Math.random() - 0.5) * 8, vy: -10 - Math.random() * 14, g: -6, life: 0.5 + Math.random() * 0.5, max: 0.8, color: fl.colors[Math.floor(Math.random() * fl.colors.length)], size: 1, glow: true, grow: 0, chunk: null });
      }
    }
    ctx.restore();
    if (!off && e.bowDraw && (dir === 1 || dir === 3)) this.drawNocked(ctx, e, dir, hx, hy);
  }

  // (Round 78) A rod: drawn back over the shoulder and whipped out as it's
  // cast, pulled up and back on a strike, and held out low over the water
  // while the line's in. Null: just carried.
  rodPose(e, mir, out) {
    const sg = mir ? -1 : 1;
    const c = e.cast;
    if (c) {
      const f = Math.min(1, c.t / c.dur);
      if (c.reel) {
        // (A sharp pull up and back, easing to upright.)
        const k = f < 0.3 ? f / 0.3 : 1 - (f - 0.3) / 0.7;
        return { ang: sg * (0.45 - 1.45 * k), dx: -sg * 2 * k, dy: -2 * k, smear: 0 };
      }
      if (f < 0.45) {
        // Wound back over the shoulder, a tremble at the top.
        const k = f / 0.45;
        const e2 = 1 - (1 - k) * (1 - k);
        const shake = k > 0.8 ? Math.sin(this.time * 60) * 0.04 : 0;
        return { ang: -sg * (1.35 * e2 + shake), dx: -sg * 2 * e2, dy: -2 * e2, smear: 0 };
      }
      // Whipped forward, past where it'll be held, and settling there.
      const k = (f - 0.45) / 0.55;
      const fw = k < 0.4 ? -1.35 + (0.85 + 1.35) * (k / 0.4) : 0.85 - 0.4 * ((k - 0.4) / 0.6);
      return { ang: sg * fw, dx: sg * (k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6), dy: 0, smear: k < 0.4 ? 0.6 * (1 - k / 0.4) : 0 };
    }
    return out ? { ang: sg * 0.45, dx: 0, dy: 0, smear: 0 } : null;
  }

  // A blade held up to take a blow: across the chest face on (two blades
  // crossed), upright in front side on; with a shield up, held back, ready.
  guardPose(e, dir, off, mir) {
    const sg = mir ? -1 : 1;
    const it = ITEMS[(e.heldItem && e.heldItem()) || ''];
    if (it && it.kind !== 'weapon' && !(it.kind === 'tool' && it.damage >= 3)) return null;
    const jolt = e.shieldJolt > 0 ? e.shieldJolt * 6 : 0;
    if (this.raisedShield(e)) return off ? null : { ang: -sg * 0.9, dx: -sg * 1, dy: -3, smear: 0 };
    if (dir === 0) return { ang: -sg * 1.42, dx: -sg * 3, dy: jolt, smear: 0 };
    if (dir === 2) return null;
    return { ang: -sg * 0.5, dx: sg * 2 - sg * jolt, dy: -4, smear: 0 };
  }

  // How a weapon's held through a blow: drawn far back and trembling as
  // it's wound up, then whipped round in a wide arc (or jabbed straight
  // out, for a thrust), the body thrown in after it. Null: just held.
  swingPose(e, dir, off, mir) {
    const sg = mir ? -1 : 1;
    const w = e.windup && !e.windup.dash ? e.windup : e.swing || null;
    if (w && !off && w.st) {
      const f = Math.min(1, w.t / Math.max(0.05, w.dur));
      const k = 1 - (1 - f) * (1 - f);
      const st = w.st;
      // (A thrust drawn back along the line it'll go: down at you face on,
      // up and away from you facing off.)
      if (st.thrust || st.lunge) {
        if (dir === 0) return { ang: THRUST_DOWN, dx: 0, dy: -2 * k, smear: 0 };
        if (dir === 2) return { ang: THRUST_UP, dx: 0, dy: 2 * k, smear: 0 };
        return { ang: sg * (0.55 + 0.25 * k), dx: -sg * 3 * k, dy: -k, smear: 0 };
      }
      const back = st.heavy ? 2.7 : 2.1;
      let ang = -sg * (0.3 + back * k);
      if (f > 0.65) ang += (Math.random() - 0.5) * 0.22;
      return { ang, dx: -sg * k, dy: -2 * k, smear: 0 };
    }
    const s = e.strike;
    if (!s || !!s.off !== !!off) return null;
    const prog = Math.min(1, s.t / s.dur);
    const st = s.st || {};
    if (st.thrust || st.flurry || st.lunge) {
      const k = prog < 0.3 ? prog / 0.3 : Math.max(0, 1 - (prog - 0.3) / 0.7);
      // (Jabbed straight out the way they face: down, up, or to the side.)
      if (dir === 0) return { ang: THRUST_DOWN, dx: 0, dy: 6 * k, smear: 0 };
      if (dir === 2) return { ang: THRUST_UP, dx: 0, dy: -6 * k, smear: 0 };
      return { ang: sg * 0.75, dx: sg * 7 * k, dy: 0, smear: 0 };
    }
    const back = st.heavy ? 2.7 : 2.1;
    const fwd = st.heavy ? 2.3 : 1.8;
    const k = 1 - Math.pow(1 - Math.min(1, prog / 0.28), 3);
    const a0 = -sg * (0.3 + back);
    const ang = a0 + sg * (0.3 + back + fwd) * k;
    return { ang, a0, dx: sg * 2 * (prog < 0.28 ? k : Math.max(0, 1 - (prog - 0.28) / 0.72)), dy: 0, smear: prog < 0.6 ? 1 - prog / 0.6 : 0, heavy: !!st.heavy };
  }

  // The body behind a blow: leaning back to wind up (trembling at the
  // last), lunging forward into it. Also keeps the blow's clock.
  bodyLunge(e, dir) {
    const side = dir === 1 ? -1 : dir === 3 ? 1 : 0;
    const vert = dir === 0 ? 1 : dir === 2 ? -1 : 0;
    const s = e.strike;
    if (s) {
      s.t += this.frameDt || 0.016;
      if (s.t >= s.dur) e.strike = null;
    }
    const w = e.windup && !e.windup.dash ? e.windup : e.swing || null;
    if (w && w.dur > 0) {
      const f = Math.min(1, w.t / Math.max(0.05, w.dur));
      const shiver = f > 0.75 && Math.floor(this.time * 30) % 2 ? 1 : 0;
      return { x: -side * Math.round(f * (w.st && w.st.heavy ? 2 : 1)) + (side ? 0 : shiver), y: -vert * Math.round(f) };
    }
    if (e.strike && !e.strike.off) {
      const prog = Math.min(1, e.strike.t / e.strike.dur);
      const k = prog < 0.25 ? prog / 0.25 : Math.max(0, 1 - (prog - 0.25) / 0.75);
      const n = e.strike.st && e.strike.st.heavy ? 4 : 3;
      return { x: Math.round(side * n * k), y: Math.round(vert * 2 * k) };
    }
    return { x: 0, y: 0 };
  }

  // (Round 82) A long line said wraps, three lines at most (cut short with
  // "…" past that), and the bubble's kept on the screen, its tail still at
  // whoever's saying it.
  drawBubble(ctx, text, cx, by, color = '#f4ecd8') {
    color ||= '#f4ecd8';
    const lines = bubbleLines(String(text));
    const w = Math.max(...lines.map((l) => textWidth(l))) + 4;
    const h = lines.length * 8 + 2;
    const vw = this.vw || ctx.canvas.width;
    const tx = Math.round(cx);
    const x = Math.max(2, Math.min(vw - w - 2, Math.round(cx - w / 2)));
    const y = Math.max(2, Math.round(by - h));
    ctx.fillStyle = '#12101a';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#12101a';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    const t = Math.max(x + 1, Math.min(x + w - 2, tx));
    ctx.fillRect(t - 1, y + h, 3, 2);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(t, y + h + 1, 1, 2);
    lines.forEach((l, i) => drawText(ctx, l, x + 2, y + 1 + i * 8, color));
  }

  headFor(e) {
    let h = this.heads.get(e.id);
    if (!h) {
      h = headSprite(e.look);
      this.heads.set(e.id, h);
    }
    return h;
  }

  dropIcon(key) {
    let c = this.dropIcons.get(key);
    if (c) return c;
    const src = itemIcon(key);
    const d = pixelsIn(src, 0, 0, 16, 16);
    c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    const out = c.getContext('2d');
    const img = out.createImageData(8, 8);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        // Pick the most saturated opaque pixel of each 2x2 block.
        let best = -1;
        let bi = -1;
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const i = ((y * 2 + oy) * 16 + x * 2 + ox) * 4;
          if (d[i + 3] < 50) continue;
          const lum = d[i] + d[i + 1] + d[i + 2];
          const score = lum < 90 ? 1 : 2 + lum / 1000;
          if (score > best) {
            best = score;
            bi = i;
          }
        }
        if (bi >= 0) {
          const o = (y * 8 + x) * 4;
          img.data[o] = d[bi];
          img.data[o + 1] = d[bi + 1];
          img.data[o + 2] = d[bi + 2];
          img.data[o + 3] = 255;
        }
      }
    }
    out.putImageData(img, 0, 0);
    // Outline for readability.
    const o2 = document.createElement('canvas');
    o2.width = 10;
    o2.height = 10;
    const c2 = o2.getContext('2d');
    c2.filter = 'none';
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) c2.drawImage(c, dx, dy);
    c2.globalCompositeOperation = 'source-in';
    c2.fillStyle = '#1c1622';
    c2.fillRect(0, 0, 10, 10);
    c2.globalCompositeOperation = 'source-over';
    c2.drawImage(c, 1, 1);
    this.dropIcons.set(key, o2);
    return o2;
  }

  // The rope from a guard's hand to a restrained prisoner.
  // Rod, line and bobber: yours, and every fisher's at work.
  // Fishing rods, lines and bobbers are drawn in depth order with the world:
  // each piece goes into the row it's over, so a wall or a person in front
  // of the line hides it like anything else.
  fishingDecos(game, buckets, zMin, zMax) {
    const ctx = this.ctx;
    const lines = [];
    this.frameNo = (this.frameNo || 0) + 1;
    const f = game.fishing;
    if (f) lines.push({ e: game.player, t: f, dip: f.dip || 0, reel: f.phase === 'reel' ? f.fish - 0.5 : 0 });
    for (const n of game.visibleEntities || []) {
      if (n.kind !== 'npc' || !n.fishSpot) continue;
      const t = n.fishSpot();
      // (Pulled up after a catch: the line's out of the water a moment.)
      if (t && !(n.recastT > 0) && !(n.cast && n.cast.reel)) lines.push({ e: n, t, dip: n.fishDip || 0, reel: 0 });
    }
    // (Round 78) A grappling hook's rope, up to where it bit.
    for (const q of game.everyone ? game.everyone() : [game.player]) if (q && q.grappleAt) lines.push({ e: q, t: { x: q.grappleAt.x, y: q.grappleAt.y - 1, z: q.grappleAt.z }, dip: 0, reel: 0, rope: q.grappleAt.k ?? 1 });
    const add = (row, layer, order, deco) => {
      if (row < zMin || row > zMax) return;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      arr.push({ deco, layer, rp: { y: order } });
    };
    const tv0 = (x, z) => (this.toView ? this.toView(x, z) : [x, z]);
    for (const L of lines) {
      const wp = L.e.renderPos();
      const [ru, rv] = tv0(wp.x, wp.z);
      const rp = { x: ru, y: wp.y, z: rv };
      const [tu, tv] = tv0(L.t.x, L.t.z);
      const T = { x: tu, y: L.t.y, z: tv };
      const layer = Math.ceil(rp.y - 0.001) + 1;
      const hx = rp.x * TILE + 8 - this.camX;
      const hy = rp.z * TILE - rp.y * LH + LH + 10 - this.camY - 12;
      let bx = T.x * TILE + 8 - this.camX + Math.round(L.reel * 6);
      const bob = Math.sin(this.time * 3 + L.t.x) * 0.8;
      let by = T.z * TILE - T.y * LH - this.camY + 10 + bob + L.dip * 2;
      // (Round 78) The line runs from the tip of the rod in their hand (as
      // it was drawn: see drawHeld), no stick of its own beside it.
      if (L.rope === undefined) L.e.rodFrame = this.frameNo;
      const tip = L.rope === undefined && L.e.rodTip && this.frameNo - L.e.rodTip.f <= 2 ? L.e.rodTip : null;
      const dx = Math.sign(bx - hx) || 1;
      const tx = tip ? tip.x - this.camX : L.rope !== undefined ? hx + dx * 2 : hx + dx * 7;
      const ty = tip ? tip.y - this.camY : L.rope !== undefined ? hy - 6 : hy - 9;
      // (Cast: the bobber at the rod's tip as it's drawn back, then flying
      // out in an arc to the water.)
      const c = L.e.cast;
      let fly = 1;
      if (L.rope !== undefined) {
        // (A rope: from the hands, straight up to the hook (flying, then
        // bitten), taut.)
        fly = L.rope;
        const k = 1 - (1 - fly) * (1 - fly);
        bx = tx + (bx - tx) * k;
        by = ty + (by - 4 - ty) * k - Math.sin(k * Math.PI) * 8;
      } else if (c && !c.reel) {
        const cf = Math.min(1, c.t / c.dur);
        fly = cf < 0.5 ? 0 : (cf - 0.5) / 0.5;
        const k = 1 - (1 - fly) * (1 - fly);
        bx = tx + (bx - tx) * k;
        by = ty + 6 + (by - ty - 6) * k - Math.sin(k * Math.PI) * 14;
      }
      // The line sags between rod tip and bobber, a row at a time.
      const n = 14;
      const bLayer = fly < 1 ? layer : L.t.y + 2;
      const bRow = fly < 1 ? Math.round(rp.z + (T.z - rp.z) * fly) : T.z;
      // (Round 79) Drawn whole, two pixels thick (not dots a pixel wide),
      // each stretch with the row it crosses.
      const pieces = new Map();
      let lx = Math.round(tx);
      let ly = Math.round(ty);
      for (let i = 1; i <= n; i++) {
        const k = i / n;
        const r = Math.round(rp.z + (bRow - rp.z) * k);
        const px = Math.round(tx + (bx - tx) * k);
        const py = Math.round(ty + (by - ty) * k + Math.sin(k * Math.PI) * (fly < 1 || L.rope !== undefined ? 0 : L.dip > 0.6 ? 1 : 4));
        let pc = pieces.get(r);
        if (!pc) pieces.set(r, (pc = { segs: [], layer: Math.round(layer + (bLayer - layer) * k) }));
        pc.segs.push(lx, ly, px, py);
        lx = px;
        ly = py;
      }
      const rope = L.rope !== undefined;
      for (const [r, pc] of pieces) {
        add(r, pc.layer, 99, () => {
          ctx.fillStyle = rope ? '#b89a6a' : 'rgba(232,232,240,0.85)';
          for (let i = 0; i < pc.segs.length; i += 4) thickLine(ctx, pc.segs[i], pc.segs[i + 1], pc.segs[i + 2], pc.segs[i + 3]);
        });
      }
      // Bobber (half under when something bites), floating on the water.
      add(bRow, bLayer, 99, () => {
        if (rope) {
          // The hook: three iron prongs over the edge.
          ctx.fillStyle = '#9a9aa4';
          ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 1);
          ctx.fillRect(Math.round(bx), Math.round(by) - 3, 1, 3);
          ctx.fillStyle = '#d0d0d8';
          ctx.fillRect(Math.round(bx) - 2, Math.round(by) - 2, 1, 1);
          ctx.fillRect(Math.round(bx) + 2, Math.round(by) - 2, 1, 1);
          return;
        }
        if (fly < 1) {
          ctx.fillStyle = '#d02a2a';
          ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
          return;
        }
        const under = L.dip > 0.6;
        ctx.fillStyle = '#d02a2a';
        ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 2 + (under ? 2 : 0), 3, under ? 1 : 2);
        ctx.fillStyle = '#f0f0f0';
        if (!under) ctx.fillRect(Math.round(bx) - 1, Math.round(by), 3, 1);
        ctx.fillStyle = 'rgba(224,244,255,0.6)';
        ctx.fillRect(Math.round(bx) - 2 - (under ? 1 : 0), Math.round(by) + 1, 5 + (under ? 2 : 0), 1);
      });
    }
  }

  // Leads and ropes (a guard's rope to a prisoner's wrists, a horse tied
  // to a fence): drawn with the world in depth order like a fishing line,
  // a row at a time, so whatever stands in front of them hides them.
  leadDecos(game, buckets, zMin, zMax) {
    const ctx = this.ctx;
    const leads = [];
    const esc = game.sim && game.sim.justice.escort;
    if (esc && esc.guard && !esc.guard.dead) leads.push({ a: esc.guard, b: game.player, ah: 11, bh: 10, wrists: true });
    // (A horse's lead from its head; a smaller beast's from its neck.)
    const neck = (c) => (c.species === 'horse' ? 14 : c.species === 'skeleton' ? 11 : 5);
    for (const c of game.visibleEntities || []) {
      if ((c.kind !== 'creature' && c.kind !== 'monster') || c.dead) continue;
      if (c.tie && c.tieR !== 0) leads.push({ a: c, b: c.tie, ah: neck(c), bh: 13, head: c.species === 'horse' });
      else if (c.leadBy && !c.leadBy.dead) leads.push({ a: c, b: c.leadBy, ah: neck(c), bh: 9, head: c.species === 'horse' });
    }
    const add = (row, layer, order, deco) => {
      if (row < zMin || row > zMax) return;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      arr.push({ deco, layer, rp: { y: order } });
    };
    const end = (q, h, head) => {
      const rp = q.renderPos ? q.renderPos() : q;
      const [u, v] = this.toView(rp.x, rp.z);
      let x = u * TILE + 8 - this.camX;
      // (A horse's lead runs from its head.)
      if (head) x += q.sideLeft === false ? 12 : -12;
      return { x, y: v * TILE - rp.y * LH + LH + 10 - this.camY - h, row: Math.ceil(v - 0.001), layer: Math.ceil(rp.y - 0.001) + 1 };
    };
    for (const L of leads) {
      const A = end(L.a, L.ah, L.head);
      const B = end(L.b, L.bh, false);
      const n = 14;
      const sag = 4 + Math.sin(this.time * 3) * 0.8;
      const pieces = new Map();
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const r = Math.round(A.row + (B.row - A.row) * k);
        const px = Math.round(A.x + (B.x - A.x) * k);
        const py = Math.round(A.y + (B.y - A.y) * k + Math.sin(k * Math.PI) * sag);
        let pc = pieces.get(r);
        if (!pc) pieces.set(r, (pc = { pts: [], layer: Math.round(A.layer + (B.layer - A.layer) * k) }));
        pc.pts.push(px, py);
      }
      for (const [r, pc] of pieces) {
        add(r, pc.layer, 99, () => {
          for (let i = 0; i < pc.pts.length; i += 2) {
            ctx.fillStyle = '#3a2a18';
            ctx.fillRect(pc.pts[i], pc.pts[i + 1] + 1, 1, 1);
            ctx.fillStyle = '#c8a064';
            ctx.fillRect(pc.pts[i], pc.pts[i + 1], 1, 1);
            if (i >= 2 && Math.abs(pc.pts[i] - pc.pts[i - 2]) > 1) ctx.fillRect(Math.round((pc.pts[i] + pc.pts[i - 2]) / 2), Math.round((pc.pts[i + 1] + pc.pts[i - 1]) / 2), 1, 1);
          }
        });
      }
      if (L.wrists) {
        add(B.row, B.layer, 99.5, () => {
          ctx.fillStyle = '#c8a064';
          ctx.fillRect(Math.round(B.x) - 2, Math.round(B.y) - 1, 5, 2);
        });
      }
    }
  }

  // Drawing a bow: a line of dots the way you're aiming, as far as the
  // arrow would carry at this draw, a mark at the end once it's fully
  // drawn.
  drawAim(game) {
    const p = game.player;
    const d = p && p.bowDraw;
    if (!d || !d.aim || this.spin) return;
    const ctx = this.ctx;
    const rp = p.renderPos();
    let dx = d.aim.x - p.x;
    let dz = d.aim.z - p.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const full = d.power >= 1;
    const at = (k) => {
      const [u, v] = this.toView(rp.x + dx * k, rp.z + dz * k);
      return [Math.round(u * TILE + 8 - this.camX), Math.round(v * TILE - (rp.y + 1) * LH + LH - this.camY)];
    };
    const steps = Math.max(1, Math.floor((d.range || 4) * 2));
    for (let i = 2; i <= steps; i++) {
      const [sx, sy] = at(i / 2);
      const a = (full ? 0.95 : 0.5 + 0.35 * d.power) * (1 - (i / steps) * 0.45);
      ctx.fillStyle = `rgba(16,12,20,${a * 0.7})`;
      ctx.fillRect(sx - 1, sy + 1, 3, 1);
      ctx.fillStyle = full ? `rgba(255,228,140,${a})` : `rgba(240,240,240,${a})`;
      ctx.fillRect(sx - 1, sy, 3, 1);
    }
    if (full) {
      const [ex, ey] = at(d.range || 4);
      ctx.fillStyle = 'rgba(255,232,160,0.9)';
      ctx.fillRect(ex - 2, ey, 5, 1);
      ctx.fillRect(ex, ey - 2, 1, 5);
    }
  }

  // An arrow on the string, drawn back as far as the bow is (trembling if
  // a full draw's held too long). Side on only.
  drawNocked(ctx, e, dir, hx, hy) {
    const d = e.bowDraw;
    const s = dir === 1 ? -1 : 1;
    const pull = Math.round(4 * d.power);
    const y = hy - 5 + (d.power >= 1 && d.t - d.full > 1.2 && Math.random() < 0.5 ? 1 : 0);
    ctx.fillStyle = '#8a6038';
    for (let i = -pull; i < 6 - pull; i++) ctx.fillRect(hx + s * i, y, 1, 1);
    ctx.fillStyle = '#e0e0e8';
    ctx.fillRect(hx + s * (6 - pull), y, 1, 1);
    ctx.fillStyle = 'rgba(240,240,230,0.85)';
    ctx.fillRect(hx - s * pull, y - 2, 1, 5);
  }

  // Arrows in flight.
  drawProjectiles(game) {
    const ctx = this.ctx;
    for (const a of game.projectiles || []) {
      const f = Math.min(1, a.t / a.dur);
      const [wx, wz] = this.toView(a.x0 + (a.tx - a.x0) * f, a.z0 + (a.tz - a.z0) * f);
      const wy = a.y0 + (a.ty - a.y0) * f + Math.sin(f * Math.PI) * 0.4;
      const sx = Math.round(wx * TILE + 8 - this.camX);
      const sy = Math.round(wz * TILE - wy * LH + LH - this.camY);
      const [dx, dz] = this.toView(a.tx - a.x0, a.tz - a.z0);
      const l = Math.hypot(dx, dz) || 1;
      const ux = dx / l;
      const uy = dz / l;
      // A catapult's stone: high in the air, its shadow on the ground
      // racing to where it'll land.
      if (a.kind === 'boulder') {
        const gy = a.y0 + (a.ty - a.y0) * f;
        const gsy = Math.round(wz * TILE - gy * LH + LH - this.camY);
        const lift = Math.round(Math.sin(f * Math.PI) * a.arc * LH);
        ctx.fillStyle = `rgba(0,0,0,${0.15 + f * 0.25})`;
        const r = 2 + Math.round(f * 2);
        ctx.fillRect(sx - r, gsy - 1, r * 2, 2);
        ctx.fillStyle = '#6a6a72';
        ctx.fillRect(sx - 2, gsy - lift - 3, 4, 4);
        ctx.fillStyle = '#9a9aa4';
        ctx.fillRect(sx - 2, gsy - lift - 3, 2, 2);
        ctx.fillStyle = '#3a3a42';
        ctx.fillRect(sx + 1, gsy - lift, 1, 1);
        continue;
      }
      // A wisp's ball of cold fire: lobbed in a glowing arc, a pale ring on
      // the ground where it'll burst.
      if (a.kind === 'orb' && a.stick) {
        // A stick of dynamite: end over end through the air, its fuse
        // spitting sparks; the ground it'll land on marked.
        const gy = a.y0 + (a.ty - a.y0) * f;
        const [lx, lz] = this.toView(a.tx, a.tz);
        const ex = Math.round(lx * TILE + 8 - this.camX);
        const ey = Math.round(lz * TILE - a.ty * LH + LH - this.camY);
        ctx.fillStyle = `rgba(255,140,60,${0.2 + f * 0.35})`;
        ctx.fillRect(ex - 5, ey - 1, 10, 1);
        ctx.fillRect(ex - 1, ey - 3, 2, 5);
        const gsy = Math.round(wz * TILE - gy * LH + LH - this.camY);
        const lift = Math.round(Math.sin(f * Math.PI) * a.arc * LH);
        const cx = sx;
        const cy = gsy - lift - 1;
        const ang = f * Math.PI * 4;
        const ux2 = Math.cos(ang);
        const uy2 = Math.sin(ang);
        for (let i = -3; i <= 3; i++) {
          ctx.fillStyle = i === -1 || i === 1 ? '#e8d8a0' : i > 0 ? '#e85a3a' : '#c83a2a';
          ctx.fillRect(Math.round(cx + ux2 * i) - 1, Math.round(cy + uy2 * i) - 1, 2, 2);
        }
        const fx = Math.round(cx + ux2 * 4.5);
        const fy = Math.round(cy + uy2 * 4.5);
        ctx.fillStyle = '#fff4a0';
        ctx.fillRect(fx, fy, 1, 1);
        if (Math.random() < 0.7 && this.room(1)) this.particles.push({ x: fx + this.camX, y: fy + this.camY, vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 30, g: 60, life: 0.3, max: 0.3, color: Math.random() < 0.5 ? '#ffe070' : '#ff9030', size: 1, glow: true, grow: 0, chunk: null });
        continue;
      }
      if (a.kind === 'orb') {
        const gy = a.y0 + (a.ty - a.y0) * f;
        const [lx, lz] = this.toView(a.tx, a.tz);
        const ex = Math.round(lx * TILE + 8 - this.camX);
        const ey = Math.round(lz * TILE - a.ty * LH + LH - this.camY);
        // (Tinted, for a flask or a charge or grave-light.)
        const [tr, tg, tb] = a.tint || [128, 208, 255];
        ctx.fillStyle = `rgba(${tr},${tg},${tb},${0.25 + f * 0.35})`;
        ctx.fillRect(ex - 5, ey - 1, 10, 1);
        ctx.fillRect(ex - 3, ey - 2, 6, 3);
        const gsy = Math.round(wz * TILE - gy * LH + LH - this.camY);
        const lift = Math.round(Math.sin(f * Math.PI) * a.arc * LH);
        ctx.fillStyle = `rgba(${tr},${tg},${tb},0.35)`;
        ctx.fillRect(sx - 3, gsy - lift - 4, 6, 6);
        ctx.fillStyle = a.tint ? `rgb(${Math.min(255, tr + 60)},${Math.min(255, tg + 60)},${Math.min(255, tb + 60)})` : '#c0ecff';
        ctx.fillRect(sx - 2, gsy - lift - 3, 4, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 1, gsy - lift - 2, 2, 2);
        continue;
      }
      // A Kavorent pulse: a bolt of cold light, a long fading tail, sparks
      // shed as it goes.
      if (a.kind === 'pulse') {
        const fl = 0.85 + Math.random() * 0.15;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i < 16; i++) {
          const k = 1 - i / 16;
          ctx.fillStyle = `rgba(90,216,240,${0.55 * k * fl})`;
          const w = i < 6 ? 3 : 2;
          ctx.fillRect(Math.round(sx - ux * i * 1.7) - (w >> 1), Math.round(sy - uy * i * 1.25) - (w >> 1), w, w);
        }
        const glow = ctx.createRadialGradient(sx + 0.5, sy + 0.5, 0, sx + 0.5, sy + 0.5, 10);
        glow.addColorStop(0, `rgba(168,244,255,${0.7 * fl})`);
        glow.addColorStop(1, 'rgba(90,216,240,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(sx - 10, sy - 10, 21, 21);
        ctx.restore();
        ctx.fillStyle = '#c8fbff';
        ctx.fillRect(sx - 2, sy - 2, 5, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 1, sy - 1, 3, 3);
        if (Math.random() < 0.5 && this.room(1)) this.particles.push({ x: sx + this.camX, y: sy + this.camY, vx: (Math.random() - 0.5) * 24, vy: (Math.random() - 0.5) * 24, g: 0, life: 0.35, max: 0.35, color: '#a8f4ff', size: 1, glow: true, grow: 0, chunk: null });
        continue;
      }
      // A sling stone: a grey pellet, a streak behind it.
      if (a.kind === 'stone') {
        ctx.fillStyle = 'rgba(200,200,200,0.4)';
        for (let i = 1; i < 4; i++) ctx.fillRect(Math.round(sx - ux * i * 1.5), Math.round(sy - uy * i * 1.1), 1, 1);
        ctx.fillStyle = '#8a8a90';
        ctx.fillRect(sx, sy, 2, 2);
        continue;
      }
      // A javelin: long, and arcing high.
      const len = a.kind === 'javelin' ? 9 : a.kind === 'bolt' ? 4 : 5;
      const lift = a.kind === 'javelin' ? Math.round(Math.sin(f * Math.PI) * 6) : 0;
      // (A shade's arrow, split off an onyx bow, is dusk-violet; one a
      // moonstone shield sent back trails moonlight.)
      if (a.shadow || a.reflected) {
        ctx.fillStyle = a.shadow ? 'rgba(154,106,216,0.45)' : 'rgba(232,240,255,0.5)';
        for (let i = 2; i < len + 4; i++) ctx.fillRect(Math.round(sx - ux * i), Math.round(sy - lift - uy * i * 0.75), 1, 1);
      }
      ctx.fillStyle = a.shadow ? '#5a3a88' : a.kind === 'javelin' ? '#b08a54' : a.kind === 'bolt' ? '#5e3a1c' : '#8a6038';
      for (let i = 0; i < len; i++) ctx.fillRect(Math.round(sx - ux * i), Math.round(sy - lift - uy * i * 0.75), 1, 1);
      ctx.fillStyle = '#e0e0e8';
      ctx.fillRect(Math.round(sx + ux), Math.round(sy - lift + uy * 0.75), 1, 1);
      if (a.kind !== 'javelin') {
        ctx.fillStyle = a.kind === 'bolt' ? '#c8b890' : '#f0f0f0';
        ctx.fillRect(Math.round(sx - ux * len), Math.round(sy - uy * (len - 1) * 0.75), 1, 1);
      }
    }
  }

  // ------------------------------------------------------------------ weather
  // part: 'tint' (the fog, the grey of an overcast day), 'drops' (rain or
  // snow falling) or 'all'. Normally it all goes under the light, so the night
  // darkens it; over a camera turn the drops are drawn on top of the lit
  // pictures, so they're shaded by the sky by hand.
  drawWeather(game, dt, part = 'all') {
    const w = game.weather;
    if (!w || w.level <= 0.01) return;
    const ctx = this.ctx;
    // (Round 84: or below a ship's decks.)
    const indoor = this.hidden !== null || !!game.player?.deck?.below;
    // (A storm at sea drives twice the rain, slanting with the wind.)
    if (!this.weatherDrops) this.weatherDrops = Array.from({ length: 440 }, () => ({ x: Math.random() * this.vw, y: Math.random() * this.vh, s: 0.6 + Math.random() * 0.8 }));
    const n = Math.min(this.weatherDrops.length, Math.floor(220 * w.level * (indoor ? 0.25 : 1)));
    const wind = w.wind || 1;
    // (Round 84) A storm: what's in the air, and how hard it blows.
    const sv = w.severe || null;
    const blow = w.blow || 0;
    // (Round 83) What's falling, as it eases off: the rain (or snow) that
    // was, never snow because the sky's cleared. (Fog doesn't fall.)
    if (w.kind === 'rain' || w.kind === 'snow' || w.kind === 'fog') this.lastFall = w.kind;
    const dry = (sv === 'sandstorm' || sv === 'gale') && w.kind === 'clear';
    const kind = dry ? sv : w.kind === 'rain' || w.kind === 'snow' || w.kind === 'fog' ? w.kind : this.lastFall || 'rain';
    const rain = kind === 'rain';
    if (part !== 'drops') {
      ctx.fillStyle = kind === 'fog' ? `rgba(190,200,210,${0.28 * w.level})` : rain ? `rgba(40,50,70,${Math.min(sv === 'thunder' ? 0.42 : 0.34, 0.18 * w.level)})` : kind === 'snow' ? `rgba(200,210,230,${0.1 * w.level})` : 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, this.vw, this.vh);
      // (A blizzard whites the world out; a sandstorm browns it, thick.)
      if (blow > 0 && !indoor) {
        if (sv === 'blizzard') {
          ctx.fillStyle = `rgba(228,234,244,${0.26 * blow})`;
          ctx.fillRect(0, 0, this.vw, this.vh);
        } else if (sv === 'sandstorm') {
          ctx.fillStyle = `rgba(178,128,70,${0.34 * blow})`;
          ctx.fillRect(0, 0, this.vw, this.vh);
          // (Bands of it, rolling through.)
          for (let k = 0; k < 4; k++) {
            const y = ((this.time * 30 + k * 97) % (this.vh + 60)) - 30;
            ctx.fillStyle = `rgba(200,150,90,${0.1 * blow})`;
            ctx.fillRect(0, Math.round(y), this.vw, 18 + k * 6);
          }
        }
      }
    }
    if (part === 'tint' || kind === 'fog') return;
    const lit = part === 'drops' ? skyLight(game.minute) : [1, 1, 1];
    const tone = (r, g, b, a) => `rgba(${Math.round(r * Math.max(0.25, lit[0]))},${Math.round(g * Math.max(0.25, lit[1]))},${Math.round(b * Math.max(0.3, lit[2]))},${a})`;
    if (dry) {
      // Sand (or, in a gale, dust and leaves) driven across.
      if (indoor) return;
      const m = Math.floor((kind === 'sandstorm' ? 300 : 70) * blow);
      for (let i = 0; i < Math.min(m, this.weatherDrops.length); i++) {
        const d = this.weatherDrops[i];
        d.x += dt * (kind === 'sandstorm' ? 320 : 220) * d.s * (0.6 + (w.gust || 0) * 0.6);
        d.y += dt * (Math.sin(this.time * 2 + i) * 18 + 10) * d.s;
        if (kind === 'sandstorm') {
          ctx.fillStyle = tone(i % 3 ? 214 : 186, i % 3 ? 170 : 136, i % 3 ? 112 : 84, 0.75);
          ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s > 1 ? 3 : 2, 1);
        } else {
          ctx.fillStyle = i % 4 === 0 ? tone(120, 150, 60, 0.9) : i % 4 === 1 ? tone(170, 130, 60, 0.9) : tone(200, 196, 180, 0.5);
          const lf = i % 4 < 2;
          ctx.fillRect(Math.round(d.x), Math.round(d.y + (lf ? Math.sin(this.time * 9 + i) * 1.5 : 0)), lf ? 2 : 1, 1);
        }
        if (d.x > this.vw + 4) {
          d.x = -4;
          d.y = Math.random() * this.vh;
        }
        if (d.y > this.vh) d.y = -2;
      }
      return;
    }
    // (Round 83: the rain a little brighter, a little longer: it was hard
    // to see at all.)
    ctx.fillStyle = rain ? tone(190, 208, 242, 0.72) : tone(245, 248, 255, 0.9);
    const hail = sv === 'hail' && rain;
    const blizz = sv === 'blizzard' && !rain;
    for (let i = 0; i < n; i++) {
      const d = this.weatherDrops[i];
      if (hail && i % 3 === 0) {
        // Hailstones: white, quick, bouncing where they land.
        d.y += dt * 300 * d.s;
        d.x -= dt * 40 * d.s * wind;
        ctx.fillStyle = tone(240, 246, 255, 0.95);
        ctx.fillRect(Math.round(d.x), Math.round(d.y), 2, 2);
        if (d.y > this.vh * (0.3 + d.s * 0.5) && Math.random() < 0.1) {
          ctx.fillRect(Math.round(d.x) - 2, Math.round(d.y) - 2, 1, 1);
          ctx.fillRect(Math.round(d.x) + 3, Math.round(d.y) - 1, 1, 1);
          d.y = -4;
        }
        ctx.fillStyle = tone(190, 208, 242, 0.72);
      } else if (rain) {
        d.y += dt * 260 * d.s;
        d.x -= dt * 60 * d.s * wind;
        if (wind > 1.5) {
          // (Driven slantwise.)
          const k = Math.round(wind - 1);
          for (let q = 0; q < 4; q++) ctx.fillRect(Math.round(d.x + ((3 - q) * k) / 3), Math.round(d.y) + q, 1, 1);
        } else ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 5);
        if (d.y > this.vh * (0.3 + d.s * 0.5) && Math.random() < 0.08) {
          ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y) + 4, 3, 1);
          d.y = -4;
        }
      } else if (blizz) {
        // (Driven near level, in swirls.)
        d.y += dt * 50 * d.s;
        d.x -= dt * (140 + 90 * (w.gust || 0)) * d.s * blow + Math.sin(this.time * 3 + i) * dt * 20;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s > 1.1 ? 2 : 1, d.s > 1.1 ? 2 : 1);
      } else {
        d.y += dt * 30 * d.s;
        d.x += Math.sin(this.time * 1.5 + i) * dt * 12;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s > 1.1 ? 2 : 1, d.s > 1.1 ? 2 : 1);
      }
      if (d.y > this.vh) {
        d.y = -4;
        d.x = Math.random() * this.vw;
      }
      if (d.x < -4) d.x += this.vw + 4;
      if (d.x > this.vw + 4) d.x -= this.vw + 4;
    }
  }

  // (Round 84) A plant blown over by `off` pixels at its top, bending
  // from its root (drawn in bands, each over a little more than the one
  // under it).
  drawSwaying(ctx, atl, s, x, y, off) {
    // (Round 128: under half a pixel's bend, drawn as it stands.)
    if (!off || Math.abs(off) < 0.5) {
      ctx.drawImage(atl, s.x, s.y, s.w, s.h, x, y, s.w, s.h);
      return;
    }
    const h = s.h;
    for (let r = 0; r < h; r += 3) {
      const bh = Math.min(3, h - r);
      const k = (h - r - bh / 2) / h;
      ctx.drawImage(atl, s.x, s.y + r, s.w, bh, x + Math.round(off * k * k), y + r, s.w, bh);
    }
  }

  // (Round 84; Round 128 redone) A face of leaves stirring in the wind:
  // not the whole face slid to and fro, but its leaves in bands of a few
  // rows each, every band on a gust of its own (the wind going through it
  // from the side it comes from), and now and then a leaf turned up
  // pale, catching the light.
  drawRustle(ctx, atl, ax, ay, w, h, x, y, wx, wy, wz) {
    const a = this.leafAmp || 0;
    const t = this.time;
    const ph = wx * 0.61 + wz * 0.37 + wy * 0.23;
    const BAND = 4;
    for (let r = 0; r < h; r += BAND) {
      const bh = Math.min(BAND, h - r);
      const wave = Math.sin(t * 4.6 + ph + r * 0.55) * 0.65 + Math.sin(t * 9.1 + ph * 1.9 - r * 0.8) * 0.35;
      const off = Math.round((wave + 0.35 * this.swayLean) * a * 0.75);
      const o = ((off % w) + w) % w;
      if (!o) ctx.drawImage(atl, ax, ay + r, w, bh, x, y + r, w, bh);
      else {
        ctx.drawImage(atl, ax, ay + r, w - o, bh, x + o, y + r, w - o, bh);
        ctx.drawImage(atl, ax + w - o, ay + r, o, bh, x, y + r, o, bh);
      }
    }
    // (A leaf flipped over by a gust: a pale fleck, gone again.)
    const g = Math.sin(t * 2.3 + ph * 3.1);
    if (g > 0.86 && a > 1) {
      const fx = Math.floor((Math.sin(ph * 7.7) * 0.5 + 0.5) * (w - 2));
      const fy = Math.floor((Math.cos(ph * 5.3) * 0.5 + 0.5) * (h - 2));
      ctx.fillStyle = 'rgba(220,240,190,0.55)';
      ctx.fillRect(x + fx, y + fy, 2, 1);
    }
  }

  // (Round 84) How far a plant (or a tree's leaves) at (wx, wz) is blown
  // over just now, in pixels across the screen: nothing, out of a storm.
  windSway(wx, wz, k = 1) {
    const a = this.swayAmp;
    if (!a) return 0;
    const t = this.time;
    const ph = wx * 0.61 + wz * 0.37;
    // (Round 128: a breath of a bend kept, not rounded away to nothing.)
    return (Math.sin(t * 3.1 + ph) * 0.6 + Math.sin(t * 7.3 + ph * 1.7) * 0.25 + 0.5 * this.swayLean) * a * k;
  }

  // Ash from the mountain on Kharos coming down after it's gone up: a
  // brown haze, and grey flakes drifting down slow (and the odd ember).
  drawAshfall(game, dt) {
    const a = game.ashLevel ? game.ashLevel() : 0;
    if (a <= 0.01) return;
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(70,56,48,${0.22 * a})`;
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (!this.ashFlakes) this.ashFlakes = Array.from({ length: 260 }, () => ({ x: Math.random() * this.vw, y: Math.random() * this.vh, s: 0.5 + Math.random(), e: Math.random() < 0.04 }));
    const n = Math.floor(this.ashFlakes.length * a * (this.hidden !== null ? 0.25 : 1));
    for (let i = 0; i < n; i++) {
      const d = this.ashFlakes[i];
      d.y += dt * 14 * d.s;
      d.x += Math.sin(this.time * 0.8 + i) * dt * 8 - dt * 4;
      ctx.fillStyle = d.e ? `rgba(255,${120 + Math.floor(Math.sin(this.time * 6 + i) * 40)},40,0.9)` : `rgba(${150 + (i % 3) * 20},${145 + (i % 3) * 18},${140 + (i % 3) * 16},0.8)`;
      ctx.fillRect(Math.round(d.x), Math.round(d.y), d.s > 1.2 ? 2 : 1, 1);
      if (d.y > this.vh) {
        d.y = -2;
        d.x = Math.random() * this.vw;
      }
      if (d.x < -2) d.x += this.vw + 2;
    }
  }

  // ------------------------------------------------------------------ fx
  // Under a roof you can see (not one cut away because you're inside):
  // anything going on in there is out of sight.
  roofed(wx, y, wz) {
    const world = this.game && this.game.world;
    if (!world) return false;
    const x = Math.round(wx);
    const z = Math.round(wz);
    const y0 = Math.floor(y) + 1;
    for (let yy = y0; yy < Math.min(WORLD_Y, y0 + 14); yy++) {
      const id = world.getBlock(x, yy, z);
      if (id === B.air || BLOCKS[id].render !== 'cube' || BLOCKS[id].name.startsWith('leaves')) continue;
      return !this.isHidden(x, yy, z);
    }
    return false;
  }

  emit(wx, y, wz, opts) {
    // (Smoke, sparks and crumbs indoors stay indoors.)
    if (this.roofed(wx, y, wz)) return;
    const [x, z] = this.toView(wx, wz);
    // (Fewer, or none, in the settings: round 57.)
    const k = this.particleK ?? 1;
    const want = (opts.n || 6) * k;
    // (Round 80: and no more a frame than the settings allow, from
    // anything: see room.)
    const n0 = Math.floor(want) + (Math.random() < want % 1 ? 1 : 0);
    const n = typeof this.room === 'function' ? this.room(n0) : n0;
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x * TILE + (opts.spreadX ?? 8) * (Math.random() - 0.5) * 2 + 8,
        y: z * TILE - y * LH + LH + (opts.oy ?? 0) + (Math.random() - 0.5) * (opts.spreadY ?? 6),
        vx: opts.vx !== undefined ? opts.vx * (0.9 + Math.random() * 0.2) : (Math.random() - 0.5) * (opts.speed ?? 40),
        vy: opts.vy !== undefined ? opts.vy * (0.9 + Math.random() * 0.2) : -(opts.up ?? 30) * (0.5 + Math.random()),
        g: opts.gravity ?? 90,
        life: (opts.life ?? 0.6) * (0.6 + Math.random() * 0.6),
        max: opts.life ?? 0.6,
        color: Array.isArray(opts.color) ? opts.color[Math.floor(Math.random() * opts.color.length)] : opts.color,
        size: opts.size ?? 1,
        glow: !!opts.glow,
        shape: opts.shape,
        grow: opts.grow || 0,
        // A crumb of an item's own picture (food being eaten, and so on).
        chunk: opts.chunk ? this.chunkOf(opts.chunk) : null,
      });
    }
    const most = this.fxCap ? this.fxCap.alive : 900;
    if (this.particles.length > most) this.particles.splice(0, this.particles.length - most);
  }

  // (Round 80) How many of `n` new sparks, puffs and motes there's room
  // for this frame (each frame's share, in the settings: see fxCap), and
  // that many taken from it.
  room(n) {
    const left = this.partLeft ?? Infinity;
    const got = Math.max(0, Math.min(n, left));
    if (left !== Infinity) this.partLeft = left - got;
    return got;
  }

  // A crumb's worth of an item's picture: a few pixels from somewhere solid
  // in it (for food being eaten, wood chips off a log...).
  chunkOf(key) {
    const img = itemIcon(key);
    this.opaque ||= new Map();
    let pts = this.opaque.get(key);
    if (!pts) {
      pts = [];
      const d = pixelsIn(img, 0, 0, 16, 16);
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) if (d[(y * 16 + x) * 4 + 3] > 200 && d[((y + 1) * 16 + x + 1) * 4 + 3] > 200) pts.push([x, y]);
      this.opaque.set(key, pts);
    }
    if (!pts.length) return null;
    const [x, y] = pts[Math.floor(Math.random() * pts.length)];
    return { img, x, y, w: Math.random() < 0.4 ? 1 : 2 };
  }

  // Something thrown that lands and lies a moment (dice on a table).
  toss(o) {
    if (this.roofed(o.from.x, o.from.y, o.from.z) && this.roofed(o.to.x, o.to.y, o.to.z)) return;
    const [x0, z0] = this.toView(o.from.x, o.from.z);
    const [x1, z1] = this.toView(o.to.x, o.to.z);
    (this.tosses ||= []).push({
      ax: x0 * TILE + 8, ay: z0 * TILE - o.from.y * LH + LH + (o.from.oy ?? -10),
      bx: x1 * TILE + 8 + (o.dx || 0), by: z1 * TILE - o.to.y * LH + LH + (o.to.oy ?? 2),
      t: 0, dur: o.dur || 0.55, rest: o.rest ?? 3, kind: o.kind || 'dice', face: o.face || 1, spin: Math.random() * 6, item: o.item || null, h: o.h ?? 14,
    });
    if (this.tosses.length > 40) this.tosses.shift();
  }

  // Dice thrown onto a table: real little cubes (see dice.js).
  rollDice(o) {
    this.dice = (this.dice || []).concat(throwDice(o.from, o.to, o.faces || [o.face || 1]));
    if (this.dice.length > 24) this.dice.splice(0, this.dice.length - 24);
  }

  // Each die goes into the row it's over and is drawn there, in depth order
  // with the world (like someone standing there).
  diceDecos(buckets, zMin, zMax) {
    const list = this.dice;
    if (!list || !list.length) return;
    stepDice(list, this.frameDt || 0.016);
    this.dice = list.filter((d) => d.fade > 0);
    const ctx = this.ctx;
    const tv = (x, z) => this.toView(x, z);
    for (const d of this.dice) {
      const [u, v] = this.toView(d.x, d.z);
      const row = Math.ceil(v - 0.001);
      if (row < zMin || row > zMax) continue;
      let arr = buckets.get(row);
      if (!arr) buckets.set(row, (arr = []));
      arr.push({ deco: () => drawDie(ctx, d, u, v, this.camX, this.camY, tv), layer: Math.ceil(d.base - 0.001) + 1, rp: { y: d.base } });
    }
  }

  drawTosses(dt) {
    const ctx = this.ctx;
    const list = this.tosses || [];
    const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]] };
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      d.t += dt;
      if (d.t > d.dur + d.rest) {
        list.splice(i, 1);
        continue;
      }
      const k = Math.min(1, d.t / d.dur);
      // An arc, and a bounce at the end.
      const bounce = k < 1 ? Math.sin(k * Math.PI) * d.h : Math.max(0, Math.sin((d.t - d.dur) * 18) * 2 * Math.exp(-(d.t - d.dur) * 8));
      const x = Math.round(d.ax + (d.bx - d.ax) * k - this.camX);
      const y = Math.round(d.ay + (d.by - d.ay) * k - bounce - this.camY);
      const fade = d.t > d.dur + d.rest - 0.4 ? (d.dur + d.rest - d.t) / 0.4 : 1;
      ctx.globalAlpha = Math.max(0, fade);
      if (d.kind === 'coin') {
        // A coin flipped across: gold, catching the light as it turns.
        const edge = Math.floor(d.t * 16) % 2;
        ctx.fillStyle = '#a07818';
        ctx.fillRect(x - 1, y, edge ? 1 : 3, 2);
        ctx.fillStyle = '#ffe070';
        ctx.fillRect(x - 1, y - 1, edge ? 1 : 3, 2);
        if (!edge) {
          ctx.fillStyle = '#fff8d0';
          ctx.fillRect(x, y - 1, 1, 1);
        }
        continue;
      }
      if (d.kind === 'item' && d.item) {
        ctx.drawImage(this.dropIcon(d.item), x - 4, y - 6);
        continue;
      }
      // Tumbling: a face at random each frame until it lands.
      const face = k < 1 ? 1 + (Math.floor(d.t * 20 + d.spin) % 6) : d.face;
      ctx.fillStyle = '#2a1e14';
      ctx.fillRect(x - 1, y - 1, 5, 5);
      ctx.fillStyle = '#f4ecd8';
      ctx.fillRect(x - 1, y - 1, 4, 4);
      ctx.fillStyle = '#b02a2a';
      for (const [px, py] of PIPS[face]) ctx.fillRect(x - 1 + Math.min(3, px * 1.5) | 0, y - 1 + Math.min(3, py * 1.5) | 0, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // A gem's work, a burst of fire, a bolt of lightning (see fx.js).
  effect(o) {
    return addEffect(this, o);
  }

  // Something struck that rocks where it stands (a training dummy).
  wobble(x, y, z, amp = 1) {
    this.wobbles.set(`${x},${y},${z}`, { t: 0, dur: 0.6 + 0.15 * amp, amp });
  }

  floatText(wx, y, wz, text, color = '#ff6060') {
    color ||= '#ff6060';
    if (this.noDamageNumbers && /^[-!]\d/.test(text)) return;
    const [x, z] = this.toView(wx, wz);
    this.floaters.push({ x: x * TILE + 8, y: z * TILE - y * LH - 4, text, color, t: 0.9 });
  }

  drawParticles(dt) {
    const ctx = this.ctx;
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const sx = Math.round(p.x - this.camX);
      const sy = Math.round(p.y - this.camY);
      if (sx < -4 || sy < -4 || sx > this.vw || sy > this.vh) continue;
      ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.5));
      ctx.fillStyle = p.color;
      if (p.chunk) {
        const c = p.chunk;
        ctx.drawImage(c.img, c.x, c.y, c.w, c.w, sx, sy, c.w, c.w);
      } else if (p.shape === 'note') {
        // ♪ in three pixels' width.
        ctx.fillRect(sx + 2, sy - 4, 1, 5);
        ctx.fillRect(sx, sy, 2, 2);
        ctx.fillRect(sx + 3, sy - 4, 1, 1);
        ctx.fillRect(sx + 4, sy - 3, 1, 1);
      } else if (p.shape === 'puff') {
        // A soft round puff that spreads as it rises and fades.
        const r = Math.max(1, Math.round(p.size + p.grow * (1 - p.life / p.max)));
        ctx.globalAlpha *= 0.55;
        ctx.fillRect(sx - r + 1, sy - r, r * 2 - 1, r * 2 + 1);
        ctx.fillRect(sx - r, sy - r + 1, r * 2 + 1, r * 2 - 1);
      } else if (p.shape === 'drop') {
        ctx.fillRect(sx, sy, 1, 2);
      } else if (p.shape === 'plus') {
        ctx.fillRect(sx, sy - 1, 1, 3);
        ctx.fillRect(sx - 1, sy, 3, 1);
      } else if (p.shape === 'shard') {
        // A sliver of something broken (a shield of light), tumbling.
        const k = Math.floor((p.life * 12 + p.x) % 3);
        if (k === 0) ctx.fillRect(sx, sy - 1, 1, 3);
        else if (k === 1) ctx.fillRect(sx - 1, sy, 3, 1);
        else {
          ctx.fillRect(sx, sy, 1, 1);
          ctx.fillRect(sx + 1, sy - 1, 1, 1);
          ctx.fillRect(sx - 1, sy + 1, 1, 1);
        }
      } else if (p.shape === 'star') {
        ctx.fillRect(sx, sy, 1, 1);
        ctx.globalAlpha *= 0.6;
        ctx.fillRect(sx - 1, sy, 1, 1);
        ctx.fillRect(sx + 1, sy, 1, 1);
        ctx.fillRect(sx, sy - 1, 1, 1);
        ctx.fillRect(sx, sy + 1, 1, 1);
      } else ctx.fillRect(sx, sy, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.drawTosses(dt);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t -= dt;
      f.y -= dt * 18;
      if (f.t <= 0) {
        this.floaters.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, f.t * 2);
      drawText(ctx, f.text, Math.round(f.x - this.camX - textWidth(f.text) / 2), Math.round(f.y - this.camY), f.color, '#000');
    }
    ctx.globalAlpha = 1;
  }

  // Cursor highlight, placement ghost and mining cracks.
  // Blows coming: the ground they'll land on, reddening as the swing
  // comes round; a bow's line of aim.
  drawTelegraphs(game) {
    const ctx = this.ctx;
    const p = game.player;
    const near = (e) => Math.abs(e.x - p.x) < 24 && Math.abs(e.z - p.z) < 18;
    // Ground that stays bad (see monsters.addZone): tinted while it lasts,
    // each kind marked its own way, fading as it goes.
    for (const z of game.zones || []) {
      const [cr, cg, cb] = z.color || [200, 200, 200];
      const fade = Math.min(1, (z.life - z.t) / 1.2) * Math.min(1, z.t / 0.3);
      for (const t of z.tiles) {
        if (!near(t)) continue;
        const { x: sx, y: sy } = this.worldToScreen(t.x, (z.y ?? p.y) - 1, t.z);
        const wob = 0.05 * Math.sin(this.time * 3 + t.x * 1.3 + t.z * 0.7);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.2 + wob) * fade})`;
        ctx.fillRect(sx + 1, sy + 1, 14, 14);
        ctx.fillStyle = `rgba(${Math.min(255, cr + 60)},${Math.min(255, cg + 60)},${Math.min(255, cb + 60)},${0.65 * fade})`;
        if (z.kind === 'web') {
          for (let i = 0; i < 14; i += 2) {
            ctx.fillRect(sx + 1 + i, sy + 1 + i, 1, 1);
            ctx.fillRect(sx + 14 - i, sy + 1 + i, 1, 1);
          }
          ctx.fillRect(sx + 1, sy + 8, 14, 1);
          ctx.fillRect(sx + 8, sy + 1, 1, 14);
        } else if (z.kind === 'snare') {
          // A pair of iron jaws, open.
          ctx.fillStyle = `rgba(150,150,160,${0.9 * fade})`;
          ctx.fillRect(sx + 4, sy + 6, 8, 1);
          ctx.fillRect(sx + 4, sy + 10, 8, 1);
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(sx + 4 + i * 2, sy + 7, 1, 1);
            ctx.fillRect(sx + 5 + i * 2, sy + 9, 1, 1);
          }
        } else if (z.kind === 'reef') {
          // Coral grown up through the floor: little branching fans.
          for (let i = 0; i < 3; i++) {
            const fx = sx + 3 + ((i * 5 + t.x * 7 + t.z * 3) % 10);
            const h = 4 + ((t.x + t.z + i) % 3);
            ctx.fillStyle = `rgba(232,120,104,${0.95 * fade})`;
            ctx.fillRect(fx, sy + 13 - h, 1, h);
            ctx.fillRect(fx - 1, sy + 13 - h + 1, 1, 2);
            ctx.fillRect(fx + 1, sy + 13 - h + 2, 1, 2);
            ctx.fillStyle = `rgba(255,190,150,${0.95 * fade})`;
            ctx.fillRect(fx, sy + 13 - h, 1, 1);
          }
        } else if (z.kind === 'caltrops') {
          for (let i = 0; i < 4; i++) ctx.fillRect(sx + 3 + ((i * 5 + t.x * 3) % 10), sy + 3 + ((i * 7 + t.z * 5) % 10), 2, 1);
        } else if (z.kind === 'fire') {
          // Flames licking up off the floor.
          for (let i = 0; i < 3; i++) {
            const k = (this.time * 3 + i * 0.37 + t.x * 0.31 + t.z * 0.17) % 1;
            const fx = sx + 3 + ((i * 5 + t.x * 7 + t.z) % 10);
            const h = Math.round(2 + 4 * Math.sin(k * Math.PI));
            ctx.fillStyle = `rgba(255,${120 + Math.round(k * 100)},40,${0.85 * fade})`;
            ctx.fillRect(fx, sy + 12 - h, 2, h);
            ctx.fillStyle = `rgba(255,240,160,${0.8 * fade})`;
            ctx.fillRect(fx, sy + 12 - Math.max(1, h - 2), 1, Math.max(1, h - 2));
          }
        } else if (z.kind === 'spores') {
          // Spores drifting up off it.
          for (let i = 0; i < 3; i++) {
            const k = (this.time * 0.6 + i / 3 + (t.x * 7 + t.z * 3) * 0.13) % 1;
            ctx.fillRect(sx + 2 + ((i * 5 + t.x * 3) % 12), sy + 13 - Math.floor(k * 12), 1, 1);
          }
        } else if (z.kind === 'poison' || z.kind === 'acid') {
          const k = Math.floor(this.time * 3 + t.x + t.z) % 4;
          ctx.fillRect(sx + 3 + k * 2, sy + 4 + ((k * 3) % 7), 2, 2);
          ctx.fillRect(sx + 10 - k, sy + 10 - k, 1, 1);
        } else if (z.kind === 'whirl' && z.pull) {
          const a = this.time * 4 + (t.x - z.pull.x) + (t.z - z.pull.z);
          ctx.fillRect(sx + 7 + Math.round(Math.cos(a) * 5), sy + 7 + Math.round(Math.sin(a) * 5), 2, 1);
        } else if (z.kind === 'quick') {
          // (Round 110) Quicksilver welled up: a heavy bright pool, its
          // shine sliding over it.
          ctx.fillStyle = `rgba(150,154,168,${0.75 * fade})`;
          ctx.fillRect(sx + 3, sy + 2, 10, 12);
          ctx.fillRect(sx + 2, sy + 4, 12, 8);
          ctx.fillStyle = `rgba(214,218,230,${0.8 * fade})`;
          ctx.fillRect(sx + 4, sy + 3, 7, 4);
          ctx.fillRect(sx + 3, sy + 5, 3, 4);
          const k = (this.time * 0.8 + (t.x * 3 + t.z * 5) * 0.11) % 1;
          ctx.fillStyle = `rgba(255,255,255,${0.9 * fade})`;
          ctx.fillRect(sx + 4 + Math.floor(k * 7), sy + 4, 2, 1);
          ctx.fillRect(sx + 10 - Math.floor(k * 5), sy + 10, 1, 1);
        } else if (z.kind === 'fume') {
          const k = Math.floor(this.time * 4 + t.x * 2 + t.z) % 5;
          ctx.fillRect(sx + 2 + k * 2, sy + 3 + ((k * 4) % 9), 3, 2);
          ctx.fillRect(sx + 12 - k * 2, sy + 11 - ((k * 3) % 7), 2, 2);
        }
      }
    }
    // (Round 110) Light thrown across a floor in a beam (the Athanor's
    // speculum): from tile to tile, its glow, then its white core,
    // shimmering.
    for (const L of game.lightBeams || []) {
      if (!L.tiles.length || !near(L.tiles[0])) continue;
      const pts = L.tiles.map((t) => this.worldToScreen(t.x, L.y, t.z));
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const n = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
        for (let j = 0; j < n; j++) {
          const x = Math.round(a.x + 7 + ((b.x - a.x) * j) / n);
          const y = Math.round(a.y + 7 + ((b.y - a.y) * j) / n);
          const sh = 0.75 + 0.25 * Math.sin(this.time * 9 + (i * 16 + j) * 0.4);
          ctx.fillStyle = `rgba(255,216,96,${0.35 * sh})`;
          ctx.fillRect(x - 1, y - 1, 4, 4);
          ctx.fillStyle = `rgba(255,250,220,${0.9 * sh})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
    // Hazards coming (a slam, a beam, a dart, rocks from the roof): the
    // ground they'll strike, in their colour, brighter and flashing as the
    // moment comes.
    for (const h of game.hazards || []) {
      const f = Math.min(1, h.t / Math.max(0.05, h.dur));
      const [cr, cg, cb] = h.color || [255, 70, 50];
      const flash = f > 0.7 && Math.floor(this.time * 16) % 2;
      for (const t of h.tiles) {
        if (!near(t)) continue;
        const { x: sx, y: sy } = this.worldToScreen(t.x, (h.y ?? p.y) - 1, t.z);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.1 + f * 0.32})`;
        ctx.fillRect(sx + 1, sy + 1, 14, 14);
        if (flash) {
          ctx.fillStyle = 'rgba(255,248,220,0.55)';
          ctx.fillRect(sx + 1, sy + 1, 14, 1);
          ctx.fillRect(sx + 1, sy + 14, 14, 1);
          ctx.fillRect(sx + 1, sy + 1, 1, 14);
          ctx.fillRect(sx + 14, sy + 1, 1, 14);
        }
      }
      // (A beam's line, thin and growing as it gathers.)
      if (h.kind === 'beam' && h.from && h.to && f < 1) {
        const a = this.worldToScreen(h.from.x, h.y ?? p.y, h.from.z);
        const b = this.worldToScreen(h.to.x, h.y ?? p.y, h.to.z);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.3 + f * 0.5})`;
        const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 3));
        for (let i = 0; i <= n * f; i++) ctx.fillRect(Math.round(a.x + 8 + ((b.x - a.x) * i) / n), Math.round(a.y + 2 + ((b.y - a.y) * i) / n), 1, 1);
      }
    }
    for (const e of [...game.npcs, ...game.creatures]) {
      if (e.dead || !near(e)) continue;
      const w = e.windup;
      if (w && !w.dash) {
        const f = Math.min(1, w.t / Math.max(0.05, w.dur));
        for (const t of w.tiles) {
          const { x: sx, y: sy } = this.worldToScreen(t.x, (w.y ?? e.y) - 1, t.z);
          ctx.fillStyle = `rgba(255,${Math.round(90 - f * 60)},${Math.round(60 - f * 40)},${0.12 + f * 0.33})`;
          ctx.fillRect(sx + 1, sy + 1, 14, 14);
          if (f > 0.75 && Math.floor(this.time * 16) % 2) {
            ctx.fillStyle = 'rgba(255,240,200,0.5)';
            ctx.fillRect(sx + 1, sy + 1, 14, 1);
            ctx.fillRect(sx + 1, sy + 14, 14, 1);
          }
        }
      }
      const a = e.aim;
      if (a && a.target) {
        const f = Math.min(1, a.t / a.dur);
        const s0 = this.worldToScreen(e.x, e.y, e.z);
        const s1 = this.worldToScreen(a.tx, a.target.y ?? e.y, a.tz);
        ctx.fillStyle = `rgba(255,120,80,${0.25 + f * 0.5})`;
        const n = 12;
        for (let i = 1; i < n; i++) {
          if (i % 2) continue;
          const k = i / n;
          ctx.fillRect(Math.round(s0.x + 8 + (s1.x - s0.x) * k), Math.round(s0.y - 2 + (s1.y - s0.y) * k), 2, 2);
        }
      }
    }
  }

  drawOverlays(game) {
    const ctx = this.ctx;
    this.drawTelegraphs(game);
    // (Round 69) A ship in a bottle in hand: where she'd go.
    if (game.shipGhost) drawShipGhost(this, game);
    const c = game.cursor;
    if (!c) return;
    const pulse = 0.55 + Math.sin(this.time * 6) * 0.25;
    // (Down in the ground, the view's a plan at your feet: see planCursor.)
    if (c.plan && this.underground && this.hidden) {
      this.planCursor(game, c, pulse);
      return;
    }
    const { x: sx, y: sy } = this.worldToScreen(c.x, c.y, c.z);
    // Placement ghost.
    if (c.place) {
      const p = c.place;
      const { x: gx, y: gy } = this.worldToScreen(p.x, p.y, p.z);
      const b = BLOCKS[p.id];
      ctx.globalAlpha = 0.5;
      if (b.render === 'cube' || b.render === 'door') {
        const t = TEX.top[p.id * 4 + (b.rotatable ? p.rot : 0)][0];
        const f = TEX.front[p.id * 4 + (b.rotatable ? p.rot : 0)][0];
        ctx.drawImage(this.atlas, t.x, t.y, 16, 16, gx, gy, 16, 16);
        ctx.drawImage(this.atlas, f.x, f.y, 16, LH, gx, gy + 16, 16, LH);
      } else {
        const arr = TEX.sprite[p.id * 4 + (b.rotatable ? p.rot : 0)] || TEX.sprite[p.id * 4];
        if (arr) {
          const s = arr[0];
          ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, gx, gy + SPR_H - s.h, s.w, s.h);
        }
      }
      ctx.globalAlpha = 1;
      // How high it'll go: a line dropped from it to the ground it stands
      // over (that ground outlined), and its height against your feet.
      this.heightCue(game, p.x, p.y, p.z, gx, gy, p.ok ? '#a0ffc0' : '#ff9a9a', true);
      this.cubeOutline(gx, gy, p.ok ? `rgba(120,255,160,${pulse})` : `rgba(255,90,90,${pulse})`);
      if (b.rotatable) {
        const arrow = ['↓', '←', '↑', '→'][p.rot];
        drawText(ctx, arrow, gx + 5, gy - 9, '#a0ffc0', '#000');
      }
    }
    if (c.block) {
      const m = game.mining;
      if (m && m.progress > 0) {
        const stage = Math.min(3, Math.floor(m.progress * 4));
        const s = TEX.crack[stage];
        ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, sx, sy, s.w, s.h);
      }
      // (Digging a passage: the block over it goes too, outlined over it;
      // cutting a step up, the blocks over the step and over your head,
      // and the step itself green: it stays. See game.digPlan.)
      const plan = game.digPlan ? game.digPlan(c) : null;
      for (const e of plan ? plan.extra : []) {
        const q = this.worldToScreen(e.x, e.y, e.z);
        if (m && m.progress > 0) {
          const s = TEX.crack[Math.min(3, Math.floor(m.progress * 4))];
          ctx.globalAlpha = 0.7;
          ctx.drawImage(this.atlas, s.x, s.y, s.w, s.h, q.x, q.y, s.w, s.h);
          ctx.globalAlpha = 1;
        }
        this.cubeOutline(q.x, q.y, `rgba(255,200,120,${pulse * 0.7})`, true);
      }
      if (plan && plan.keep) {
        this.cubeOutline(sx, sy, `rgba(120,255,160,${pulse})`);
        drawText(ctx, '▲', sx + 5, sy - 9, '#a0ffc0', '#000');
      } else this.cubeOutline(sx, sy, c.inReach ? `rgba(255,240,160,${pulse})` : `rgba(160,160,160,${pulse * 0.6})`);
      // (Its height against your feet, when it isn't just in front of you.)
      const rel = c.y - game.player.y;
      if (rel !== 0 && (this.underground || rel < -1 || rel > 1 || game.player.layerMode !== null)) this.levelTag(sx, sy, rel, c.inReach ? '#ffe8a0' : '#a8a8a8');
    } else if (c.empty) {
      this.cubeOutline(sx, sy, `rgba(160,200,255,${pulse * 0.6})`);
    }
  }

  // The pointer down in the ground (see game.pickPlan): everything at your
  // feet's drawn flat on the floor's plane, so what it's on is outlined
  // flat there too. Rock: the square you'd dig (and, when the rock over it
  // goes with it, a second dashed square inside: a passage you can walk
  // into). The floor: dug, it's a hole down (-1). What you'd set: its top
  // laid flat there, the square around it green, or red if it can't go.
  planCursor(game, c, pulse) {
    const ctx = this.ctx;
    const L = this.hiddenLevel - 1;
    const flat = (x, z, color, inset = 0, dashed = false) => {
      const q = this.worldToScreen(x, L - 1, z);
      const a = q.x + inset;
      const b = q.y + inset;
      const n = 16 - inset * 2;
      ctx.fillStyle = color;
      if (!dashed) {
        ctx.fillRect(a, b, n, 1);
        ctx.fillRect(a, b + n - 1, n, 1);
        ctx.fillRect(a, b, 1, n);
        ctx.fillRect(a + n - 1, b, 1, n);
        return q;
      }
      for (let i = 0; i < n; i += 3) {
        ctx.fillRect(a + i, b, 2, 1);
        ctx.fillRect(a + i, b + n - 1, 2, 1);
        ctx.fillRect(a, b + i, 1, 2);
        ctx.fillRect(a + n - 1, b + i, 1, 2);
      }
      return q;
    };
    if (c.place) {
      const p = c.place;
      const b = BLOCKS[p.id];
      const q = this.worldToScreen(p.x, L - 1, p.z);
      const lift = (L - p.y) * LH;
      ctx.globalAlpha = 0.55;
      const arr = b.render === 'cube' || b.render === 'door' ? TEX.top[p.id * 4 + (b.rotatable ? p.rot : 0)] : TEX.sprite[p.id * 4 + (b.rotatable ? p.rot : 0)] || TEX.sprite[p.id * 4];
      if (arr) {
        const s = arr[0];
        const sw = Math.min(16, s.w);
        const sh = Math.min(16, s.h);
        ctx.drawImage(this.atlas, s.x, s.y, sw, sh, q.x + ((16 - sw) >> 1), q.y + lift + ((16 - sh) >> 1), sw, sh);
      }
      ctx.globalAlpha = 1;
      flat(p.x, p.z, p.ok ? `rgba(120,255,160,${pulse})` : `rgba(255,90,90,${pulse})`);
      this.levelTag(q.x, q.y + lift, p.y - game.player.y, p.ok ? '#a0ffc0' : '#ff9a9a');
      if (b.rotatable) drawText(ctx, ['↓', '←', '↑', '→'][p.rot], q.x + 5, q.y - 9, '#a0ffc0', '#000');
      return;
    }
    if (!c.block && !c.empty) return;
    const q = flat(c.x, c.z, c.block ? (c.inReach ? `rgba(255,240,160,${pulse})` : `rgba(160,160,160,${pulse * 0.6})`) : `rgba(160,200,255,${pulse * 0.6})`);
    if (!c.block) return;
    const m = game.mining;
    const plan = game.digPlan ? game.digPlan(c) : null;
    if (m && m.progress > 0 && !(plan && plan.keep)) {
      const s = TEX.crack[Math.min(3, Math.floor(m.progress * 4))];
      ctx.drawImage(this.atlas, s.x, s.y, 16, 16, q.x, q.y, 16, 16);
    }
    if (plan && plan.keep) {
      // (A step cut up into the wall: the step green, ▲ on it, and what
      // goes over it and over your head dashed.)
      flat(c.x, c.z, `rgba(120,255,160,${pulse})`);
      drawText(ctx, '▲', q.x + 5, q.y + 4, '#a0ffc0', '#000');
      const p = game.player;
      if (plan.extra.some((e) => e.x === p.x && e.z === p.z)) flat(p.x, p.z, `rgba(255,200,120,${pulse * 0.8})`, 3, true);
    } else if (plan) flat(c.x, c.z, `rgba(255,200,120,${pulse * 0.8})`, 3, true);
    const rel = c.y - game.player.y;
    if (rel !== 0) this.levelTag(q.x, q.y, rel, c.inReach ? '#ffe8a0' : '#a8a8a8');
  }

  // A height against your feet, small, beside a block's outline: +1 above,
  // -2 below, 0 level with them.
  // (Only with a block in hand, to build with: digging or fighting, the
  // numbers are only clutter.)
  levelTag(sx, sy, rel, color) {
    const h = this.game && this.game.player && this.game.player.heldDef ? this.game.player.heldDef() : null;
    if (!h || h.kind !== 'block') return;
    const t = rel > 0 ? `+${rel}` : rel < 0 ? `${rel}` : '0';
    const ctx = this.ctx;
    const w = textWidth(t) + 3;
    ctx.fillStyle = 'rgba(8,6,14,0.75)';
    ctx.fillRect(sx + 17, sy - 1, w, 9);
    drawText(ctx, t, sx + 19, sy, color, null);
  }

  // Where a block set at (x, y, z) would stand: a dotted line down from it
  // to the ground beneath (that ground's top outlined), and its height
  // against your feet.
  heightCue(game, x, y, z, gx, gy, color, tag) {
    const ctx = this.ctx;
    const w = game.world;
    let gyLevel = null;
    for (let yy = y - 1; yy >= Math.max(0, y - 12); yy--) {
      const b = BLOCKS[w.getBlock(x, yy, z)];
      if (b.solid || b.liquid) {
        gyLevel = yy;
        break;
      }
    }
    if (gyLevel !== null && gyLevel < y - 1) {
      const g = this.worldToScreen(x, gyLevel, z);
      const bottom = gy + 16 + LH;
      ctx.fillStyle = color;
      for (let py = bottom + 1; py < g.y + 8; py += 3) {
        ctx.globalAlpha = 0.75;
        ctx.fillRect(gx + 7, py, 2, 1);
      }
      // (The ground under it: its top outlined, a cross in the middle.)
      ctx.globalAlpha = 0.85;
      ctx.fillRect(g.x + 2, g.y + 2, 12, 1);
      ctx.fillRect(g.x + 2, g.y + 13, 12, 1);
      ctx.fillRect(g.x + 2, g.y + 2, 1, 12);
      ctx.fillRect(g.x + 13, g.y + 2, 1, 12);
      ctx.fillRect(g.x + 6, g.y + 8, 4, 1);
      ctx.fillRect(g.x + 8, g.y + 6, 1, 4);
      ctx.globalAlpha = 1;
    }
    if (tag) this.levelTag(gx, gy, y - game.player.y, color);
  }

  // Down in the ground (see computeCutaway): a plan of the workings at your
  // feet, drawn over the dark so it can always be read. Rock you'd dig
  // through, dark and hatched; the edges of every passage traced in light;
  // ore glinting in the walls near you; and anywhere the roof's too low to
  // stand, hatched in amber.
  drawDigView(game) {
    const ctx = this.ctx;
    const w = game.world;
    const p = game.player;
    const L = this.hiddenLevel - 1;
    const solid = (x, y, z) => {
      const b = BLOCKS[w.getBlock(x, y, z)];
      return b.solid && b.render === 'cube';
    };
    const t = this.time;
    const hatch = (this.hatches ||= digHatches());
    const x0 = this.camX - 24;
    const x1 = this.camX + this.vw + 8;
    const y0 = this.camY - 24;
    const y1 = this.camY + this.vh + 24;
    for (const k of this.hidden) {
      const x = Math.floor(k / 65536);
      const z = k - x * 65536;
      // (Drawn on the plane of the floor at your feet.)
      const { x: sx, y: sy } = this.worldToScreen(x, L - 1, z);
      if (sx + this.camX < x0 || sx + this.camX > x1 || sy + this.camY < y0 || sy + this.camY > y1) continue;
      const id = w.getBlock(x, L, z);
      const b = BLOCKS[id];
      if (b.solid && b.render === 'cube' && !solid(x, L + 1, z) && !solid(x, L + 2, z)) {
        // A step up (the floor a pace higher there): lighter, an arrow up.
        ctx.fillStyle = 'rgba(200,190,170,0.16)';
        ctx.fillRect(sx, sy, 16, 16);
        ctx.fillStyle = 'rgba(255,226,170,0.7)';
        ctx.fillRect(sx + 7, sy + 5, 2, 1);
        ctx.fillRect(sx + 6, sy + 6, 4, 1);
        ctx.fillRect(sx + 5, sy + 7, 6, 1);
        ctx.fillRect(sx + 7, sy + 8, 2, 4);
      } else if (b.solid && b.render === 'cube') {
        // Rock: darker, hatched.
        ctx.drawImage(hatch.rock, sx, sy);
        // Its edges onto open ground, traced in light.
        ctx.fillStyle = 'rgba(255,226,170,0.78)';
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (solid(x + dx, L, z + dz)) continue;
          const n = this.worldToScreen(x + dx, L - 1, z + dz);
          if (n.x > sx) ctx.fillRect(sx + 15, sy, 1, 16);
          else if (n.x < sx) ctx.fillRect(sx, sy, 1, 16);
          else if (n.y > sy) ctx.fillRect(sx, sy + 15, 16, 1);
          else ctx.fillRect(sx, sy, 16, 1);
        }
        // Ore near you, glinting in the cut.
        const ore = ORE_GLINT.get(id);
        if (ore && Math.abs(x - p.x) <= 9 && Math.abs(z - p.z) <= 7) {
          for (let i = 0; i < 3; i++) {
            const ox = (hash4(x, z, i, 3) % 12) + 2;
            const oz = (hash4(x, z, i, 7) % 12) + 2;
            const tw = 0.55 + 0.45 * Math.sin(t * 3 + i * 2.1 + x + z);
            ctx.globalAlpha = tw;
            ctx.fillStyle = ore;
            ctx.fillRect(sx + ox, sy + oz, 2, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx + ox, sy + oz, 1, 1);
          }
          ctx.globalAlpha = 1;
        }
      } else if (!b.solid && !solid(x, L - 1, z)) {
        // A drop (the floor lower there): darker, an arrow down.
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(sx, sy, 16, 16);
        ctx.fillStyle = 'rgba(160,200,255,0.65)';
        ctx.fillRect(sx + 7, sy + 4, 2, 4);
        ctx.fillRect(sx + 5, sy + 8, 6, 1);
        ctx.fillRect(sx + 6, sy + 9, 4, 1);
        ctx.fillRect(sx + 7, sy + 10, 2, 1);
      } else if (!b.solid && solid(x, L + 1, z) && NATURAL.has(w.getBlock(x, L + 1, z))) {
        // Open at your feet, but the roof's down at your head: too low to
        // stand. Hatched amber, on the floor.
        const f = this.worldToScreen(x, L - 1, z);
        ctx.drawImage(hatch.low, f.x, f.y);
        ctx.fillStyle = 'rgba(255,170,80,0.6)';
        ctx.fillRect(f.x, f.y, 16, 1);
        ctx.fillRect(f.x, f.y + 15, 16, 1);
      }
    }
  }

  cubeOutline(sx, sy, color, dashed = false) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    if (dashed) {
      for (let i = 0; i < 16; i += 3) {
        ctx.fillRect(sx + i, sy, 2, 1);
        ctx.fillRect(sx + i, sy + 16, 2, 1);
        ctx.fillRect(sx + i, sy + 16 + LH - 1, 2, 1);
      }
      for (let i = 0; i < 16 + LH; i += 3) {
        ctx.fillRect(sx, sy + i, 1, 2);
        ctx.fillRect(sx + 15, sy + i, 1, 2);
      }
      return;
    }
    ctx.fillRect(sx, sy, 16, 1);
    ctx.fillRect(sx, sy + 16, 16, 1);
    ctx.fillRect(sx, sy + 16 + LH - 1, 16, 1);
    ctx.fillRect(sx, sy, 1, 16 + LH);
    ctx.fillRect(sx + 15, sy, 1, 16 + LH);
  }

  // Ambient light level [0..1] for a time of day.
  static daylight(minute) {
    const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    const h = m / 60;
    if (h >= 7 && h <= 18) return 1;
    if (h > 18 && h < 21) return 1 - (h - 18) / 3 * 0.78;
    if (h >= 5 && h < 7) return 0.22 + (h - 5) / 2 * 0.78;
    return 0.22;
  }
}

// The dig view's patterns (see drawDigView): cut rock, dark and hatched
// one way; a roof too low to stand under, hatched amber the other.
function digHatches() {
  const make = (fill, line, step, flip) => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const g = c.getContext('2d');
    if (fill) {
      g.fillStyle = fill;
      g.fillRect(0, 0, 16, 16);
    }
    g.fillStyle = line;
    for (let i = -16; i < 16; i += step) {
      for (let j = 0; j < 16; j++) {
        const hx = i + j;
        if (hx >= 0 && hx < 16) g.fillRect(hx, flip ? 15 - j : j, 1, 1);
      }
    }
    return c;
  };
  return { rock: make('rgba(6,4,12,0.42)', 'rgba(190,175,150,0.14)', 4, true), low: make(null, 'rgba(255,170,80,0.34)', 3, false) };
}

export { GROUND };
