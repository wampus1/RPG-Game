// How a new story opens (round 49): painted scenes, like the fallen star's
// (see starfall.js), in place of the old ones played out in the world
// itself. Each is a scene like any other (see scenes.js): on a player's
// own screen, as the host plays it, in a world with others. While it plays
// the player is kept out of the world (see Game.holdOut), and set down in
// it when it ends (Game.placeIn).
//
// An island native: their home town on its hillside, growing up out of
// the bare land year by year as its history is told (houses rising frame
// by frame, the lanes laid between them, the woods cut back, the walls
// last of all), the days racing over it; then the town as it is today,
// its people about the lanes, and the picture drawn in to your family's
// door.
//
// A castaway: the ship that brought you, at sunset on the Grey Sea, the
// Wall black on the sea ahead and lightning walking silent inside it; her
// people's last words on deck; then the gap, the rain, the seas rising,
// the bolt that splits the mainmast and sets the canvas alight; and black,
// and what you remember.
//
// Each has its own music (see music.js: cs_home, cs_voyage, cs_gale, and
// the wreck's after).
import { VIEW_W, VIEW_H, CHAR_W } from '../config.js';
import { RNG, hash4, hashf } from '../util/rng.js';
import { drawText } from '../render/font.js';
import { wrap } from '../ui/ascii.js';
import { personName, CULTURES } from '../world/names.js';
import { yearOf } from '../sim/history.js';
import { alive } from '../sim/econ.js';

// The pictures are painted at half size (each pixel two on the screen).
const PW = VIEW_W / 2;
const PH = VIEW_H / 2;
const BAR = 22;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a, b, k) => a + (b - a) * k;
const enter = (pressed) => !!(pressed && pressed.some((k) => k.code === 'Enter' || k.code === 'NumpadEnter'));

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
// A colour lightened (d > 0) or darkened.
function shade(h, d) {
  const [r, g, b] = rgb(h);
  return hex([r + d, g + d, b + d]);
}
// Between two colours.
function mix(a, b, k) {
  const x = rgb(a);
  const y = rgb(b);
  return hex([lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]);
}

// ------------------------------------------------------------ framing
// The picture to the screen, twice the size (drawn in toward (fx, fy) by
// `zoom`, and shaken by `shake`), the letterbox over it.
function present(ctx, buf, { zoom = 1, fx = PW / 2, fy = PH / 2, shake = 0, alpha = 1 } = {}) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (alpha > 0) {
    const w = PW / zoom;
    const h = PH / zoom;
    const sx = Math.max(0, Math.min(PW - w, fx - w / 2));
    const sy = Math.max(0, Math.min(PH - h, fy - h / 2));
    const ox = Math.round((Math.random() - 0.5) * 8 * shake);
    const oy = Math.round((Math.random() - 0.5) * 6 * shake);
    ctx.globalAlpha = alpha;
    ctx.drawImage(buf, sx, sy, w, h, ox - 4, oy - 4, VIEW_W + 8, VIEW_H + 8);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, BAR);
  ctx.fillRect(0, VIEW_H - BAR, VIEW_W, BAR);
  ctx.restore();
}

// Words in the bottom bar (two lines at most), typed out as they come.
// `parts`: [[text, colour], ...] run together (a speaker's name, then what
// they say).
function caption(ctx, parts, age, alpha = 1) {
  if (!parts || alpha <= 0) return;
  const whole = parts.map((p) => p[0]).join('');
  const lines = wrap(whole, 80).slice(0, 2);
  const shown = Math.floor(age * 60);
  ctx.globalAlpha = clamp01(age * 3) * alpha;
  let n = 0;
  lines.forEach((l, i) => {
    const y = lines.length > 1 ? VIEW_H - 20 + i * 10 : VIEW_H - 15;
    let x = Math.round(VIEW_W / 2 - (l.length * CHAR_W) / 2);
    // (Each piece in its own colour.)
    let at = whole.indexOf(l, n);
    if (at < 0) at = n;
    for (let k = 0; k < l.length; k++) {
      const gi = at + k;
      if (gi >= shown) break;
      let col = '#f4ecd8';
      let acc = 0;
      for (const [t, c] of parts) {
        if (gi < acc + t.length) {
          col = c;
          break;
        }
        acc += t.length;
      }
      drawText(ctx, l[k], x, y, col, '#000');
      x += CHAR_W;
    }
    n = at + l.length;
  });
  ctx.globalAlpha = 1;
}

// Text twice the size, centred.
function bigText(ctx, text, y, color) {
  const w = text.length * CHAR_W;
  const c = bigText.canvas || (bigText.canvas = makeCanvas(VIEW_W, 10));
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  drawText(g, text, 0, 1, color, '#000');
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, w + 1, 10, Math.round(VIEW_W / 2 - w), y, (w + 1) * 2, 20);
  ctx.restore();
}

// What's told in the dark at the end, a line at a time (`hi`: the one in
// another colour).
function darkWords(ctx, words, s, lineT, hi = -1) {
  let y = VIEW_H / 2 - words.length * 11;
  words.forEach((txt, i) => {
    const a = clamp01((s - i * lineT) / 1.0);
    const ls = wrap(txt, 74);
    if (a > 0) {
      ctx.globalAlpha = a;
      ls.forEach((l, k) => drawText(ctx, l, Math.round(VIEW_W / 2 - (l.length * CHAR_W) / 2), Math.round(y + k * 10), i === hi ? '#a0c8ff' : i === words.length - 1 ? '#ffe7a0' : '#e8d8b0'));
    }
    y += ls.length * 10 + 6;
  });
  ctx.globalAlpha = 1;
}

// ============================================================ at home
// What's told: the town, its history (its founding and a few things after,
// in order), how it is today, and whose child you are. Plain data, so a
// player's screen can paint it as the host plays it (see net/host.js).
export function homeInfo(game) {
  const c = game.sim.citizen;
  const L = game.sim.layoutOf(c.sid);
  const s = L.settlement;
  const hist = game.sim.history.of(L);
  const now = yearOf(game.day);
  const ents = hist.entries.filter((q) => q.y <= now);
  const first = ents.find((q) => q.kind === 'founded');
  const rest = ents.filter((q) => q !== first);
  const keep = rest.length > 5 ? [0, 1, 2, 3, 4].map((k) => rest[Math.round((k * (rest.length - 1)) / 4)]) : rest;
  const beats = [{ y: hist.founded, text: first ? first.text : `${s.name} was founded by ${hist.founder}.` }, ...keep.map((q) => ({ y: q.y, text: q.text }))].sort((a, b) => a.y - b.y);
  const parents = (c.family?.parents || []).map((i) => L.npcs[i]).filter(Boolean).map((r) => r.name.first);
  let biome = 'plains';
  try {
    const cx = L.plaza ? L.plaza.cx : Math.floor(s.cx + s.cw / 2);
    const cz = L.plaza ? L.plaza.cz : Math.floor(s.cz + s.cd / 2);
    biome = game.world.ow.biomeAt(cx, cz).biome || 'plains';
  } catch {
    biome = 'plains';
  }
  return {
    town: s.name,
    tier: s.type === 'city' ? 'city' : s.type === 'town' ? 'town' : 'village',
    walled: !!L.walled,
    style: (s.civ ? s.civ.style : s.style) || 'vale',
    biome,
    seed: (s.seed >>> 0) || s.id || 1,
    beats,
    founded: hist.founded,
    now,
    folk: L.npcs.filter((r) => alive(r)).length,
    realm: s.civ ? s.civ.name.replace(/^The /, '') : null,
    famous: hist.famous,
    parents,
    first: String(game.playerName || '').split(' ')[0] || 'you',
    temple: L.buildings.some((b) => b.type === 'temple'),
  };
}

// How long each part of it is.
export const HOME_BEAT = 4.6;
export function homeTimes(info) {
  const T0 = 2.5;
  const build = Math.max(20, info.beats.length * HOME_BEAT);
  const T1 = T0 + build;
  const T2 = T1 + 11;
  return { T0, T1, T2, T3: T2 + 5.5 };
}

export function homeScene(game, info) {
  const { T0, T1, T2, T3 } = homeTimes(info);
  let art = null;
  return {
    kind: 'home_intro', intro: true, t: 0, dur: T3, lock: true, info, T0, T1, T2,
    mood: 'cs_home',
    update(g, dt, pressed) {
      if (enter(pressed)) this.t = this.dur;
    },
    end(g) {
      g.ui.fade = Math.max(g.ui.fade || 0, 1.2);
      g.introduce();
      g.ui.msg('Press H for help.', '#a0c8ff');
    },
    // How much of the town is up (0 bare land, 1 as it is today): from its
    // founding on, steadily.
    prog() {
      const fi = Math.max(0, info.beats.findIndex((q) => q.y >= info.founded));
      const tf = T0 + fi * HOME_BEAT;
      return this.t >= T1 ? 1 : ease(clamp01((this.t - tf) / Math.max(1, T1 - tf)));
    },
    // The year the story's reached.
    year() {
      const t = this.t - T0;
      const B = info.beats;
      if (t <= 0) return B[0].y;
      const i = Math.min(B.length - 1, Math.floor(t / HOME_BEAT));
      const y1 = i + 1 < B.length ? B[i + 1].y : info.now;
      return lerp(B[i].y, y1, clamp01((t - i * HOME_BEAT) / HOME_BEAT));
    },
    draw(ctx) {
      if (!art) art = paintHome(info);
      drawHome(ctx, this, art);
    },
  };
}

// The land about a town, by its biome: the far hills, the ground, its
// trees.
const LANDS = {
  plains: { far: '#5a6a8a', near: '#4a6a4a', ground: '#5e8a3e', dark: '#4a7032', light: '#76a04a', leaf: '#3e7a34', leafDark: '#2a5a26', trunk: '#5a3e24', tree: 'round' },
  forest: { far: '#4a5a7a', near: '#2e5a3a', ground: '#4a7a36', dark: '#3a6228', light: '#5e9040', leaf: '#2e6a2e', leafDark: '#1e4a20', trunk: '#4a321e', tree: 'round', many: true },
  taiga: { far: '#6a7a9a', near: '#3a5a5a', ground: '#6a8a6a', dark: '#4e6e52', light: '#d8e4ec', leaf: '#2a4a3a', leafDark: '#1a3428', trunk: '#3a2a1e', tree: 'pine', snow: true, many: true },
  tundra: { far: '#8a9ab8', near: '#9aaabc', ground: '#c8d4dc', dark: '#a8b8c4', light: '#eef4f8', leaf: '#3a5048', leafDark: '#26382e', trunk: '#3a2a1e', tree: 'pine', snow: true },
  desert: { far: '#b88a5a', near: '#c89a62', ground: '#dcb878', dark: '#c8a064', light: '#ecd09a', leaf: '#4a7a3a', leafDark: '#345a2a', trunk: '#6a4a2a', tree: 'cactus' },
  savanna: { far: '#8a7a6a', near: '#8a8a4a', ground: '#b0a052', dark: '#988a44', light: '#c8b866', leaf: '#5a7a34', leafDark: '#3e5a24', trunk: '#5a3e24', tree: 'flat' },
  jungle: { far: '#3a5a5a', near: '#1e5a32', ground: '#3a7a30', dark: '#2a6224', light: '#4e9a3a', leaf: '#1e6a2a', leafDark: '#124a1c', trunk: '#4a321e', tree: 'round', many: true },
  swamp: { far: '#4a5a5a', near: '#3a4a3a', ground: '#4a5e3a', dark: '#3a4a2e', light: '#5e7048', leaf: '#3a5a32', leafDark: '#26402a', trunk: '#3a2e22', tree: 'round' },
  mountain: { far: '#7a7a9a', near: '#6a6a72', ground: '#6a8a52', dark: '#56724a', light: '#a8aaa8', leaf: '#2e5a3a', leafDark: '#1e4028', trunk: '#3a2a1e', tree: 'pine', snow: true },
  beach: { far: '#6a8aaa', near: '#5a8a6a', ground: '#7aa04e', dark: '#62883e', light: '#e8d8a0', leaf: '#3a7a34', leafDark: '#2a5a26', trunk: '#6a4a2a', tree: 'palm' },
};

// What a people's houses look like: roof colours, walls, timbers, and the
// shape of them (pitched, steep, flat, round huts; on stilts).
const LOOKS = {
  vale: { roofs: ['#8a3a2a', '#a8803a', '#7a3424', '#94442e'], wall: '#d8c8a0', timber: '#5a4030', shape: 'gable' },
  north: { roofs: ['#3a3a44', '#4a3428', '#44444e'], wall: '#7a5434', timber: '#4a3020', shape: 'steep' },
  sun: { roofs: ['#c8a868', '#d8b878'], wall: '#e8d0a0', timber: '#b89060', shape: 'flat' },
  wild: { roofs: ['#6a7a3a', '#7a6a32', '#5e6e34'], wall: '#7a5a3a', timber: '#5a3e24', shape: 'hut' },
  high: { roofs: ['#3a4a6a', '#4a4a5a', '#34405e'], wall: '#b0aca0', timber: '#7a7a74', shape: 'gable' },
  ember: { roofs: ['#2a2224', '#3a2a28'], wall: '#5a3a34', timber: '#2a1a18', shape: 'flat', glow: '#ff8040' },
  mist: { roofs: ['#4a5a56', '#56645a'], wall: '#8a8a78', timber: '#4a4a3e', shape: 'steep' },
  tide: { roofs: ['#c8b070', '#b89a5a'], wall: '#8a6a4a', timber: '#5a4430', shape: 'gable', stilts: true },
};

const H_HORIZON = 66;
// The town's rows, back to front: where their feet are, how big.
const ROWS = [
  { yb: 88, k: 0.55 },
  { yb: 98, k: 0.7 },
  { yb: 110, k: 0.85 },
  { yb: 123, k: 1 },
];

// What doesn't change as it grows, painted once: the hills and the ground;
// and where everything will stand (houses, the hall, a temple, trees,
// fields, lanes, the walls).
function paintHome(info) {
  const rng = new RNG(hash4(info.seed >>> 0, 0x40e));
  const P = LANDS[info.biome] || LANDS.plains;
  const look = LOOKS[info.style] || LOOKS.vale;
  const land = makeCanvas(PW, PH);
  const g = land.getContext('2d');
  const px = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  const seed = info.seed % 997;
  // The far hills (snow on them in the cold), then the nearer ridge.
  const ridge = (base, amp, f1, f2, col, edge, snowy) => {
    for (let x = 0; x < PW; x++) {
      const h = Math.round(base - amp * (0.6 * Math.sin(x * f1 + seed) + 0.4 * Math.sin(x * f2 + seed * 1.7)));
      for (let y = h; y < PH; y++) px(x, y, col);
      px(x, h, edge);
      if (snowy) for (let y = h; y < h + 3; y++) if (hashf(x, y, 9) < 0.7 - (y - h) * 0.2) px(x, y, '#e8eef4');
    }
  };
  ridge(H_HORIZON - 4, 14, 0.021, 0.067, P.far, shade(P.far, 14), !!P.snow);
  ridge(H_HORIZON + 6, 6, 0.04, 0.1, P.near, shade(P.near, 12), false);
  // The ground the town stands on: rolling, speckled.
  for (let y = H_HORIZON + 10; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const n = hashf(x, y, seed + 3);
      px(x, y, n < 0.1 ? P.dark : n > 0.94 ? P.light : P.ground);
    }
  }
  // Darker toward the front (the near slope).
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, PH - 18, PW, 18);
  // (By the sea, for the stilt folk: water along the front.)
  const water = !!look.stilts;
  if (water) {
    for (let y = 126; y < PH; y++) for (let x = 0; x < PW; x++) px(x, y, hashf(x, y, 5) < 0.15 ? '#5a8ab8' : '#3a6a98');
  }
  // Where the houses go: rows from the back, filling out from the middle.
  const count = info.tier === 'city' ? 24 : info.tier === 'town' ? 15 : 9;
  const houses = [];
  const cx = PW / 2;
  // The hall first, at the heart; a temple near it.
  houses.push({ kind: 'hall', row: 1, x: Math.round(cx - 15), w: 30, h: 14, t: 0.02 });
  if (info.temple) houses.push({ kind: 'temple', row: 0, x: Math.round(cx + 24), w: 16, h: 12, t: 0.12 });
  const slots = [];
  ROWS.forEach((R, ri) => {
    const w = Math.round(22 * R.k);
    const gap = Math.round(5 * R.k) + 2;
    const span = 200 + ri * 14;
    for (let x = Math.round(cx - span / 2); x + w < cx + span / 2; x += w + gap) slots.push({ row: ri, x, w });
  });
  // (Nearest the heart first.)
  slots.sort((a, b) => Math.abs(a.x + a.w / 2 - cx) * (1 + a.row * 0.15) - Math.abs(b.x + b.w / 2 - cx) * (1 + b.row * 0.15));
  const taken = (q) => houses.some((h) => h.row === q.row && q.x < h.x + h.w + 2 && h.x < q.x + q.w + 2);
  for (const q of slots) {
    if (houses.filter((h) => h.kind === 'house').length >= count) break;
    if (taken(q)) continue;
    const d = Math.abs(q.x + q.w / 2 - cx) / 120;
    const k = ROWS[q.row].k;
    houses.push({ kind: 'house', row: q.row, x: q.x + rng.int(-1, 1), w: q.w + rng.int(-2, 2), h: Math.round((12 + rng.int(-2, 3)) * k), t: 0.08 + 0.74 * Math.min(1, d + rng.float(-0.06, 0.06) + q.row * 0.04), roof: rng.pick(look.roofs) });
  }
  for (const h of houses) {
    h.t = Math.max(0.02, Math.min(0.88, h.t));
    h.roof ||= look.roofs[0];
    h.lit = rng.chance(0.7);
    h.chimney = h.kind === 'house' && look.shape !== 'hut' && rng.chance(0.6);
  }
  // Your family's: a house on the front rows, near the middle.
  const front = houses.filter((h) => h.kind === 'house' && h.row >= 2).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx));
  const home = front[rng.int(0, Math.min(2, front.length - 1))] || houses[houses.length - 1];
  // Trees: the woods round about (the ones where the town will go are cut
  // down as it comes).
  const trees = [];
  const nTrees = P.many ? 46 : 28;
  for (let i = 0; i < nTrees; i++) {
    const row = rng.int(0, 3);
    const x = rng.int(4, PW - 4);
    const R = ROWS[row];
    const y = R.yb + rng.int(-3, 3);
    const near = houses.find((h) => h.row === row && x > h.x - 6 && x < h.x + h.w + 6);
    trees.push({ x, y, k: R.k * rng.float(0.8, 1.2), cut: near ? near.t - 0.02 : 2 });
  }
  trees.sort((a, b) => a.y - b.y);
  // Fields out at the edges (a village's, a town's), tilled as it grows.
  const fields = [];
  if (info.tier !== 'city' && !water) {
    for (const side of [-1, 1]) fields.push({ x: side < 0 ? 6 : PW - 56, y: 104 + rng.int(0, 8), w: 50, h: 12, t: 0.25 + rng.float(0, 0.3), crop: rng.pick(['#c8b050', '#7aa040', '#a8783a']) });
  }
  // The folk about the lanes, today.
  const folk = Array.from({ length: info.tier === 'city' ? 16 : info.tier === 'town' ? 11 : 7 }, () => ({
    row: rng.int(1, 3), x: rng.float(20, PW - 20), v: rng.float(3, 7) * (rng.chance(0.5) ? -1 : 1),
    shirt: rng.pick(['#8f2f3a', '#2f6f8f', '#3a7a3a', '#7a5a2a', '#5a3a7a', '#c8a030', '#e0dccc']),
    hair: rng.pick(['#1e1612', '#6e4424', '#c87a3a', '#c8c8c8', '#3a2418']),
  }));
  const clouds = Array.from({ length: 6 }, () => ({ x: rng.float(0, PW), y: rng.int(8, 40), w: rng.int(14, 34), v: rng.float(2, 5) }));
  const stars = Array.from({ length: 70 }, () => ({ x: rng.int(0, PW - 1), y: rng.int(BAR / 2, H_HORIZON - 6), b: rng.float(0.3, 1) }));
  return { land, P, look, houses, home, trees, fields, folk, clouds, stars, water };
}

// The sky at a time of day (`day`: 0 midnight, 0.5 noon), in bands.
function skyAt(day) {
  const h = Math.sin((day - 0.25) * Math.PI * 2);
  const dayK = clamp01(h * 1.6 + 0.35);
  const glowK = clamp01(1 - Math.abs(h) * 3.2);
  const top = mix('#070a1c', '#3a74c0', dayK);
  const low = mix(mix('#1a2048', '#9ccaf0', dayK), '#f09868', glowK * 0.75);
  return { top, low, dayK, h };
}

function drawHome(ctx, sc, art) {
  const t = sc.t;
  const info = sc.info;
  const buf = drawHome.buf || (drawHome.buf = makeCanvas(PW, PH));
  const g = buf.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  const px = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const prog = sc.prog();
  // The days racing by as it grows (a day every couple of seconds); today,
  // a bright morning.
  const T1 = sc.T1;
  const racing = t < T1;
  const day = racing ? (0.3 + (t - sc.T0) / 2.4) % 1 : 0.36 + (t - T1) * 0.004;
  const S = skyAt(t < sc.T0 ? 0.3 : day);
  // The sky.
  const bands = 9;
  for (let i = 0; i < bands; i++) {
    const y0 = Math.floor((i / bands) * H_HORIZON);
    const y1 = Math.floor(((i + 1) / bands) * H_HORIZON);
    g.fillStyle = mix(S.top, S.low, i / (bands - 1));
    g.fillRect(0, y0, PW, y1 - y0 + 1);
  }
  // (And on down behind the hills, wherever they dip.)
  g.fillStyle = S.low;
  g.fillRect(0, H_HORIZON, PW, PH - H_HORIZON);
  // The stars by night; the sun (and the moon) crossing.
  if (S.dayK < 0.6) {
    for (const s of art.stars) {
      g.globalAlpha = s.b * (1 - S.dayK / 0.6);
      px(s.x, s.y, '#ffffff');
    }
    g.globalAlpha = 1;
  }
  const sunA = (t < sc.T0 ? 0.3 : day) * Math.PI * 2 - Math.PI / 2;
  const sx = PW / 2 + Math.cos(sunA + Math.PI) * 120;
  const sy = H_HORIZON + 6 - Math.sin(sunA + Math.PI) * 58;
  if (sy < H_HORIZON + 4) {
    g.fillStyle = 'rgba(255,230,160,0.25)';
    g.beginPath();
    g.arc(sx, sy, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff4c8';
    g.beginPath();
    g.arc(sx, sy, 4, 0, Math.PI * 2);
    g.fill();
  }
  const mx = PW / 2 - Math.cos(sunA + Math.PI) * 120;
  const my = H_HORIZON + 6 + Math.sin(sunA + Math.PI) * 58;
  if (my < H_HORIZON + 4) {
    g.fillStyle = '#e8ecf4';
    g.beginPath();
    g.arc(mx, my, 3, 0, Math.PI * 2);
    g.fill();
  }
  // Clouds drifting over.
  for (const c of art.clouds) {
    const x = ((c.x + t * c.v * (racing ? 4 : 1)) % (PW + 60)) - 40;
    g.fillStyle = mix('#3a3a5a', '#f4f0e8', S.dayK);
    g.globalAlpha = 0.75;
    for (let i = 0; i < c.w; i += 3) g.fillRect(Math.round(x + i), Math.round(c.y - Math.sin((i / c.w) * Math.PI) * 3), 4, 3);
    g.globalAlpha = 1;
  }
  // The land.
  g.drawImage(art.land, 0, 0);
  // The fields, tilled as it grows.
  for (const f of art.fields) {
    if (prog < f.t) continue;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) px(x, y, (y - f.y) % 3 === 0 ? '#5a4630' : (x + y) % 4 ? f.crop : shade(f.crop, -20));
  }
  // The lanes, laid as the rows fill: the road up from the front to the
  // hall, and one along each row.
  const road = art.look.shape === 'flat' ? '#c8b48a' : '#8a7454';
  if (prog > 0.03) for (let y = ROWS[1].yb; y < PH; y++) for (let x = PW / 2 - 3 - (y - 98) * 0.08; x < PW / 2 + 3 + (y - 98) * 0.08; x++) px(x, y, hashf(Math.round(x), y, 4) < 0.2 ? shade(road, -14) : road);
  ROWS.forEach((R, ri) => {
    const built = art.houses.filter((h) => h.row === ri && prog >= h.t);
    if (!built.length) return;
    const x0 = Math.min(...built.map((h) => h.x)) - 4;
    const x1 = Math.max(...built.map((h) => h.x + h.w)) + 4;
    for (let x = x0; x < x1; x++) {
      px(x, R.yb + 1, road);
      if (R.k > 0.8) px(x, R.yb + 2, shade(road, -10));
    }
  });
  // Night: everything dimmed, the windows lit.
  const night = 1 - S.dayK;
  // Back to front: the trees still standing, the houses (rising), the
  // folk, row by row.
  const items = [];
  for (const tr of art.trees) if (prog < tr.cut) items.push({ y: tr.y, draw: () => drawTree(px, tr, art.P) });
  for (const h of art.houses) {
    const rise = clamp01((prog - h.t) / 0.07);
    if (rise <= 0) continue;
    const R = ROWS[h.row];
    items.push({ y: R.yb - 0.5, draw: () => drawHouse(g, px, h, R, art.look, rise, night, t, h === art.home && t > T1 + 5) });
  }
  if (t > T1 - 1) {
    for (const f of art.folk) {
      const R = ROWS[f.row];
      let x = (f.x + (t - T1) * f.v) % (PW + 20);
      if (x < -10) x += PW + 20;
      items.push({ y: R.yb + 0.5, draw: () => drawWalker(px, x, R.yb + 1, R.k, f, t) });
    }
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
  // The walls, last of all (a walled town's), across the front.
  if (info.walled) {
    const rise = clamp01((prog - 0.88) / 0.1);
    if (rise > 0) drawWall(px, rise, art.look);
  }
  // Night over the land (the lit windows drawn bright after).
  if (night > 0.05) {
    g.fillStyle = `rgba(8,12,40,${(night * 0.5).toFixed(3)})`;
    g.fillRect(0, H_HORIZON - 30, PW, PH);
    for (const h of art.houses) {
      if (prog < h.t + 0.07 || !h.lit) continue;
      const R = ROWS[h.row];
      g.globalAlpha = night;
      for (const w of windowsOf(h, R)) {
        g.fillStyle = art.look.glow || '#ffcc6a';
        g.fillRect(w.x, w.y, w.w, w.h);
      }
      g.globalAlpha = 1;
    }
  }
  // Dust where one's just gone up.
  for (const h of art.houses) {
    const k = (prog - h.t - 0.07) / 0.05;
    if (k <= 0 || k >= 1) continue;
    const R = ROWS[h.row];
    for (let i = 0; i < 8; i++) {
      const a = i * 0.8 + h.x;
      g.globalAlpha = 0.6 * (1 - k);
      px(h.x + h.w / 2 + Math.cos(a) * (4 + k * 10), R.yb - 2 - Math.abs(Math.sin(a)) * k * 6, '#c8b898');
    }
    g.globalAlpha = 1;
  }
  // Your family's door, today: a light about it, and a mark over it.
  let zoom = 1;
  let fx = PW / 2;
  let fy = PH / 2;
  if (t > T1 + 5) {
    const h = art.home;
    const R = ROWS[h.row];
    const k = ease(clamp01((t - T1 - 5) / 4));
    zoom = 1 + 0.6 * k;
    fx = lerp(PW / 2, h.x + h.w / 2, k);
    fy = lerp(PH / 2, R.yb - h.h / 2, k);
    const bob = Math.round(Math.sin(t * 4) * 1.5);
    const ax = Math.round(h.x + h.w / 2);
    const ay = R.yb - h.h - Math.round(h.w * 0.45) - 6 + bob;
    const a = clamp01((t - T1 - 5.5) * 2);
    // (A warm light about the house, and an arrow over it.)
    g.globalAlpha = a * (0.25 + 0.1 * Math.sin(t * 3));
    g.fillStyle = '#ffd890';
    g.fillRect(h.x - 2, R.yb - h.h - Math.round(h.w * 0.45) - 1, h.w + 4, h.h + Math.round(h.w * 0.45) + 2);
    g.globalAlpha = a;
    for (let i = -1; i < 5; i++) for (let k2 = -4 + Math.max(0, i); k2 <= 4 - Math.max(0, i); k2++) px(ax + k2, ay + i, '#3a2408');
    for (let i = 0; i < 4; i++) for (let k2 = -3 + i; k2 <= 3 - i; k2++) px(ax + k2, ay + i, '#ffe070');
    for (let y = ay - 4; y < ay; y++) {
      px(ax - 1, y, '#3a2408');
      px(ax, y, '#ffe070');
      px(ax + 1, y, '#3a2408');
    }
    g.globalAlpha = 1;
  }
  // To the screen: in from black, out to black at the end.
  const fade = t < 1.5 ? t / 1.5 : t > sc.T2 ? 1 - clamp01((t - sc.T2) / 1.2) : 1;
  present(ctx, buf, { zoom, fx, fy, alpha: fade });
  // The town's name over it, the year, and what's told.
  ctx.globalAlpha = fade;
  bigText(ctx, `~ ${info.town.toUpperCase()} ~`, 1, '#ffe070');
  const yr = t < T1 ? Math.round(sc.year()) : info.now;
  drawText(ctx, `The year ${yr}`, 6, 7, '#a89878');
  drawText(ctx, 'ENTER skip', VIEW_W - 10 * CHAR_W - 6, 7, '#5a5040');
  ctx.globalAlpha = 1;
  if (t >= sc.T0 && t < T1) {
    const i = Math.min(info.beats.length - 1, Math.floor((t - sc.T0) / HOME_BEAT));
    const age = t - sc.T0 - i * HOME_BEAT;
    caption(ctx, [[info.beats[i].text, '#f4ecd8']], age, clamp01((HOME_BEAT - age) * 2));
  } else if (t >= T1 && t < T1 + 5.5) {
    const realm = info.realm ? `, sworn to the ${info.realm}` : '';
    caption(ctx, [[`${info.town} today: ${info.folk} souls${realm}, known far and wide for ${info.famous}.`, '#ffe070']], t - T1, clamp01((T1 + 5.5 - t) * 2));
  } else if (t >= T1 + 5.5 && t < sc.T2 + 0.6) {
    const par = info.parents.length ? `: the child of ${info.parents.join(' and ')}` : '';
    caption(ctx, [[`And this is where you were born, ${info.first}${par}. ${info.town} is the only home you have ever known.`, '#a0c8ff']], t - T1 - 5.5, clamp01((sc.T2 + 0.6 - t) * 2));
  }
  // The last words, in the dark.
  if (t > sc.T2 + 0.8) {
    ctx.globalAlpha = clamp01((t - sc.T2 - 0.8) * 1.5) * clamp01((sc.dur - t) * 1.5);
    const lines = wrap(`Everyone in ${info.town} knows your face. Today, like any other day, starts at home.`, 60);
    lines.forEach((l, i) => drawText(ctx, l, Math.round(VIEW_W / 2 - (l.length * CHAR_W) / 2), VIEW_H / 2 - 8 + i * 11, '#e8d8b0'));
    ctx.globalAlpha = 1;
  }
}

// A tree of the land's kind.
function drawTree(px, tr, P) {
  const k = tr.k;
  const x = Math.round(tr.x);
  const y = tr.y;
  const hgt = Math.round(9 * k);
  if (P.tree === 'cactus') {
    for (let i = 0; i < hgt; i++) px(x, y - i, i % 3 ? P.leaf : P.leafDark);
    for (let i = 0; i < 3; i++) {
      px(x - 2, y - 4 - i, P.leaf);
      px(x + 2, y - 5 - i, P.leaf);
    }
    px(x - 1, y - 4, P.leaf);
    px(x + 1, y - 5, P.leaf);
    return;
  }
  for (let i = 0; i < Math.round(3 * k) + 1; i++) px(x, y - i, P.trunk);
  if (P.tree === 'pine') {
    for (let i = 0; i < hgt; i++) {
      const w = Math.round(((hgt - i) / hgt) * 4 * k);
      for (let d = -w; d <= w; d++) px(x + d, y - 2 - i, (d + i) % 3 ? P.leaf : P.leafDark);
      if (P.snow && i % 3 === 0) px(x - w, y - 2 - i, '#e8eef4');
    }
    return;
  }
  if (P.tree === 'palm') {
    for (let i = 0; i < hgt; i++) px(x + Math.round(i * 0.15), y - i, P.trunk);
    const top = y - hgt;
    for (let d = -5; d <= 5; d++) px(x + 1 + d, top + Math.round(Math.abs(d) * 0.5), P.leaf);
    return;
  }
  if (P.tree === 'flat') {
    for (let i = 0; i < hgt - 2; i++) px(x, y - i, P.trunk);
    for (let d = -6; d <= 6; d++) {
      px(x + d, y - hgt + 1, P.leaf);
      if (Math.abs(d) < 5) px(x + d, y - hgt, P.leafDark);
    }
    return;
  }
  const r = Math.round(4 * k);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 1) px(x + dx, y - 3 - r + dy, dy > 0 || (dx + dy) % 3 === 0 ? P.leafDark : P.leaf);
}

// The windows of a house (where they'd be lit).
function windowsOf(h, R) {
  const out = [];
  const wy = R.yb - Math.round(h.h * 0.65);
  const ww = Math.max(1, Math.round(2 * R.k));
  for (let x = h.x + 2; x < h.x + h.w - 3; x += Math.max(4, Math.round(6 * R.k))) {
    if (Math.abs(x - (h.x + h.w / 2)) < 2) continue;
    out.push({ x, y: wy, w: ww, h: Math.max(2, Math.round(3 * R.k)) });
  }
  return out;
}

// One building, `rise` of the way up: its frame first, the walls filling
// in, the roof going on last.
function drawHouse(g, px, h, R, look, rise, night, t, mine) {
  const x0 = h.x;
  const yb = R.yb;
  const wall = h.kind === 'hall' ? shade(look.wall, -10) : look.wall;
  const tall = h.kind === 'temple' ? h.h + 6 : h.h;
  const up = Math.round(tall * Math.min(1, rise * 1.3));
  // (On stilts over the shallows.)
  if (look.stilts && h.row >= 2) for (let x = x0 + 1; x < x0 + h.w; x += 5) for (let y = yb; y < yb + 4; y++) px(x, y, look.timber);
  // The frame, standing ahead of the walls.
  if (rise < 0.85) {
    for (let y = yb - tall; y < yb; y++) {
      px(x0, y, look.timber);
      px(x0 + h.w - 1, y, look.timber);
    }
    for (let x = x0; x < x0 + h.w; x++) px(x, yb - tall, look.timber);
  }
  // The walls, from the ground up.
  if (look.shape === 'hut' && h.kind === 'house') {
    for (let y = yb - up; y < yb; y++) {
      const k = (yb - y) / tall;
      const half = Math.round((h.w / 2) * (1 - k * k * 0.3));
      for (let x = x0 + h.w / 2 - half; x < x0 + h.w / 2 + half; x++) px(x, y, (x + y) % 4 === 0 ? shade(wall, -16) : wall);
    }
  } else {
    for (let y = yb - up; y < yb; y++) for (let x = x0; x < x0 + h.w; x++) px(x, y, (x - x0) % 6 === 0 && look.shape !== 'flat' ? look.timber : wall);
  }
  if (rise < 0.85) return;
  const k = clamp01((rise - 0.85) / 0.15);
  // Windows (dark by day) and the door.
  for (const w of windowsOf(h, R)) {
    g.fillStyle = '#2a2026';
    g.fillRect(w.x, w.y, w.w, w.h);
  }
  const dw = Math.max(2, Math.round(3 * R.k));
  const dh = Math.max(3, Math.round(5 * R.k));
  for (let y = yb - dh; y < yb; y++) for (let x = Math.round(x0 + h.w / 2 - dw / 2); x < Math.round(x0 + h.w / 2 + dw / 2); x++) px(x, y, mine ? '#ffcc6a' : '#3a2416');
  // The roof.
  const top = yb - tall;
  const roofH = look.shape === 'flat' ? 2 : look.shape === 'steep' ? Math.round(h.w * 0.6) : Math.round(h.w * 0.42);
  const rows = Math.round(roofH * k);
  if (look.shape === 'flat') {
    for (let x = x0 - 1; x <= x0 + h.w; x++) {
      px(x, top - 1, shade(h.roof, -18));
      if (x % 3 === 0) px(x, top - 2, h.roof);
    }
  } else if (look.shape === 'hut' && h.kind === 'house') {
    for (let i = 0; i < rows; i++) {
      const half = Math.round((h.w / 2 + 2) * (1 - i / roofH));
      for (let x = x0 + h.w / 2 - half; x < x0 + h.w / 2 + half; x++) px(x, top - i, (x + i) % 3 === 0 ? shade(h.roof, -14) : h.roof);
    }
  } else {
    for (let i = 0; i < rows; i++) {
      const y = top - i - 1;
      const inset = Math.round((i / roofH) * (h.w / 2 + 1));
      for (let x = x0 - 2 + inset; x < x0 + h.w + 2 - inset; x++) px(x, y, (x + i) % 3 === 0 ? shade(h.roof, -14) : h.roof);
    }
  }
  if (k < 1) return;
  const peak = top - roofH;
  // The hall's tower and its flag; a temple's spire (a dome, in the sun).
  if (h.kind === 'hall') {
    // A bell tower over the ridge: its walls, the bell in its window, a
    // pointed cap, the flag.
    const tx = Math.round(x0 + h.w / 2 - 3);
    const ty = peak - 7;
    for (let y = ty; y < peak + 3; y++) for (let x = tx; x < tx + 6; x++) px(x, y, x === tx || x === tx + 5 ? shade(wall, -26) : shade(wall, -12));
    for (let y = ty + 2; y < ty + 5; y++) for (let x = tx + 2; x < tx + 4; x++) px(x, y, '#2a2026');
    px(tx + 2, ty + 4, '#c8a040');
    px(tx + 3, ty + 4, '#c8a040');
    for (let i = 0; i < 4; i++) for (let x = tx - 1 + i; x < tx + 7 - i; x++) px(x, ty - 1 - i, i % 2 ? shade(h.roof, -14) : h.roof);
    for (let y = ty - 10; y < ty - 4; y++) px(tx + 3, y, '#3a3030');
    const wave = Math.round(Math.sin(t * 5) * 1);
    for (let y = ty - 10; y < ty - 7; y++) for (let x = tx + 4; x < tx + 9; x++) px(x, y + (x > tx + 6 ? wave : 0), '#b83a3a');
  } else if (h.kind === 'temple') {
    const tx = Math.round(x0 + h.w / 2);
    if (look.shape === 'flat') {
      for (let dy = 0; dy < 6; dy++) for (let dx = -5; dx <= 5; dx++) if (dx * dx + dy * dy * 2 < 30) px(tx + dx, top - 1 - dy, dy > 3 ? '#e8d8a8' : '#c8a868');
    } else {
      for (let i = 0; i < 12; i++) for (let d = -Math.round((12 - i) / 4); d <= Math.round((12 - i) / 4); d++) px(tx + d, peak - i, shade(h.roof, -10));
      px(tx, peak - 13, '#ffe070');
    }
  }
  // A chimney, and its smoke.
  if (h.chimney) {
    const cx = Math.round(x0 + h.w * 0.72);
    const cy = top - Math.round(roofH * 0.55);
    for (let y = cy - 3; y < cy + 1; y++) px(cx, y, '#3a3434');
    for (let i = 0; i < 4; i++) {
      const s = (t * 0.6 + i / 4 + h.x * 0.01) % 1;
      g.globalAlpha = 0.5 * (1 - s);
      px(cx + Math.round(Math.sin(s * 6 + h.x) * 2 + s * 4), cy - 4 - s * 10, night > 0.5 ? '#5a5a6a' : '#c8c8c8');
    }
    g.globalAlpha = 1;
  }
}

// A walled town's wall: stone, battlemented, a tower at each end and the
// gate in the middle.
function drawWall(px, rise, look) {
  const yb = 136;
  const hgt = Math.round(8 * rise);
  const stone = look.shape === 'flat' ? '#c8b488' : '#8a8a86';
  for (let x = 6; x < PW - 6; x++) {
    if (Math.abs(x - PW / 2) < 6) continue;
    for (let y = yb - hgt; y < yb; y++) px(x, y, (x + y) % 5 === 0 ? shade(stone, -18) : stone);
    if (rise >= 1 && x % 4 < 2) px(x, yb - hgt - 1, stone);
  }
  if (rise < 1) return;
  for (const tx of [6, PW - 14, PW / 2 - 12, PW / 2 + 6]) {
    for (let y = yb - 14; y < yb; y++) for (let x = tx; x < tx + 8; x++) px(x, y, (x + y) % 4 === 0 ? shade(stone, -22) : shade(stone, -6));
    for (let x = tx; x < tx + 8; x += 2) px(x, yb - 15, stone);
  }
}

// Someone walking along a lane.
function drawWalker(px, x, yb, k, f, t) {
  const step = Math.floor(t * 6 + x) % 2;
  const hh = Math.max(4, Math.round(6 * k));
  px(x, yb - 1, step ? '#2a2a32' : '#20202a');
  px(x + 1, yb - 1, step ? '#20202a' : '#2a2a32');
  for (let i = 2; i < hh - 1; i++) {
    px(x, yb - i, f.shirt);
    px(x + 1, yb - i, f.shirt);
  }
  px(x, yb - hh + 1, '#e0b090');
  px(x + 1, yb - hh + 1, '#e0b090');
  px(x, yb - hh, f.hair);
  px(x + 1, yb - hh, f.hair);
}

// ============================================================ at sea
const SHIP_NAMES = ['Grey Heron', 'Morning Star', 'Saltmarsh Maid', 'Constant', 'Gannet', 'Fair Promise', 'Lantern', 'Brightwater', 'Old Faithful', 'Windlass', 'Swift Return', 'Cormorant'];
const HOME_PORTS = ['Harrowmouth', 'Kell Haven', 'Saltreach', 'Dunmere', 'Aldport', 'Varrow', 'Eastwick', 'Brannoch'];
// Where you were bound: inside the Wall, the storm round the Dagoni
// Islands that no ship has come through in living memory. Once in a long
// while a gap opens in it, and this captain meant to run it.
const GAPS = ['the Needle', 'the Eye of the Wall', 'the Narrows', 'the Gate of Grey Water', 'the Thinning'];
// Why you were aboard (by what you brought).
export const REASONS = {
  wanderer: 'You had signed on with nowhere in particular to be. Nobody had been inside the Wall in a lifetime: that was reason enough.',
  soldier: 'You were bound for the Dagoni Islands with a sword and a rumour: that their realms have been at each other\'s throats for generations, and pay well for blades.',
  fisher: 'Fishermen back home swore the waters inside the Wall teem with fish no net outside it has ever seen. You meant to find out.',
  farmer: 'You carried a sack of seed and a story: that on Thessa, inside the storm, there is good land nobody has yet put a plough to.',
  builder: 'The island towns had been cut off for generations, they said: when the Wall opened, they would want builders who knew new ways.',
  merchant: 'You were bound for markets nobody outside had traded with in a lifetime, with a fat purse and a hold full of hopes.',
  hunter: 'Hunters at home spoke of the beasts of the Dagoni Islands as if they were a story told to children: lizards that bask on fire, moths lit like lamps. You wanted to see them.',
  miner: 'A man in a tavern swore the islands are veined with iron, gems and black glass, and old mines nobody remembers digging.',
  scholar: 'You were going to see the Kavorent spires with your own eyes: towers older than any kingdom, standing inside the storm they may have raised.',
  noble: 'A small title, a thin purse and a family that wanted you out of sight: the far side of the Wall was as far as any ship could take you.',
  castaway: 'You had stowed away with nothing at all. The cook found you on the first morning, and said nothing to anyone.',
};

// Who was aboard and what's told (plain data, as homeInfo's).
export function wreckInfo(game) {
  const h = game.hero || {};
  let k = 0;
  for (const ch of String(h.name || game.playerName || '')) k = (k * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = new RNG(hash4(game.seed >>> 0, k, 0x5e1));
  const styles = Object.keys(CULTURES);
  const home = rng.pick(styles);
  const person = () => personName(rng, rng.chance(0.7) ? home : rng.pick(styles), null);
  const captain = person();
  return {
    ship: rng.pick(SHIP_NAMES),
    port: rng.pick(HOME_PORTS),
    gap: rng.pick(GAPS),
    captain: `${captain.first} ${captain.last}`,
    mate: person().first,
    scholar: person().first,
    child: person().first,
    lookout: person().first,
    reason: REASONS[h.kit] || REASONS.wanderer,
    first: String(game.playerName || '').split(' ')[0] || 'you',
    seed: (game.seed ^ k) >>> 0,
  };
}

// When each part of it comes: evening, the storm gathering, the storm, the
// strike, the dark.
export const WRECK = { GATHER: 16, STORM: 25, STRIKE: 29, BLACK: 32.5, LINE: 3.4 };

export function wreckScene(game, info) {
  const words = [
    'The Wall took the ship that night, halfway through the gap.',
    `The ${info.ship} went down with ${info.captain} at the wheel and most of her crew.`,
    'You remember the cold. The black water closing over you. A spar under your hands, and the current carrying you in...',
    '...and then nothing at all. The gap closed behind you.',
    info.reason,
    `Now you have only what the sea gave back, ${info.first}.`,
  ];
  // What's said on deck, and when.
  const lines = [
    [3, null, 'The sun is going down over the Grey Sea. Ahead, inside the storm that rings them, lie the Dagoni Islands.'],
    [7, `Captain ${info.captain}`, `Fair wind, and the ${info.ship} running before it. Tonight we run ${info.gap}.`],
    [10.5, info.scholar, 'The Kavorent spires, at last... They say their makers still guard the halls.'],
    [13.5, info.child, 'Is that the Wall? It\'s so black. Is it meant to be that black?'],
    [WRECK.GATHER, null, `The ship turns into ${info.gap}. The Wall closes over half the sky, and the wind comes from everywhere at once.`],
    [19.5, info.mate, 'Reef the main! Lash everything down! MOVE!'],
    [22.5, info.lookout, 'Wave! Big one, starboard! I can\'t see a thing!'],
    [WRECK.STRIKE, null, 'Lightning strikes the mainmast!'],
    [30.4, null, 'The deck tilts under you. Somebody is screaming your name.'],
  ];
  let art = null;
  return {
    kind: 'wreck_intro', intro: true, t: 0, dur: WRECK.BLACK + words.length * WRECK.LINE + 2, lock: true, info, words, lines,
    get mood() {
      return this.t < WRECK.GATHER ? 'cs_voyage' : this.t < WRECK.BLACK ? 'cs_gale' : 'wreck';
    },
    update(g, dt, pressed) {
      if (enter(pressed)) {
        this.t = this.dur;
        return;
      }
      if (this.t > WRECK.GATHER && !this.gathered) {
        this.gathered = true;
        g.audio?.play('wind');
        g.audio?.play('thunder');
      }
      if (this.t > WRECK.STORM) {
        this.boltT = (this.boltT ?? 0) - dt;
        if (this.boltT <= 0 && this.t < WRECK.BLACK - 1) {
          this.boltT = 1.2 + Math.random() * 1.6;
          g.audio?.play('thunder');
        }
      }
      if (this.t > WRECK.STRIKE && !this.struck) {
        this.struck = true;
        g.audio?.play('boom');
        g.audio?.play('crumble');
        g.shake = 1.2;
      }
    },
    end(g) {
      g.ui.fade = Math.max(g.ui.fade || 0, 2);
      g.introduce();
      g.ui.msg('Press H for help.', '#a0c8ff');
    },
    draw(ctx) {
      if (!art) art = paintWreck(info);
      drawWreck(ctx, this, art);
    },
  };
}

const W_HORIZON = 84;
const SHIP = { w: 96, h: 74, water: 60 };

// The ship, side on, heading left (toward the Wall): her hull, two masts
// and their canvas, the rail, the flag. Two of her: whole, and after the
// bolt (the mainmast's head split off).
function paintShip(broken) {
  const c = makeCanvas(SHIP.w, SHIP.h);
  const g = c.getContext('2d');
  const px = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const wl = SHIP.water;
  // The hull: a long curve, darker below the wales.
  for (let x = 6; x < 90; x++) {
    const f = (x - 6) / 84;
    const deck = wl - 9 + Math.round(Math.pow(Math.abs(f - 0.55) * 1.8, 2) * 2) - (x > 80 ? x - 80 : 0) * 0.3;
    const keel = wl + 4 - Math.round(Math.pow(Math.abs(f - 0.5) * 2, 3) * 5);
    for (let y = Math.round(deck); y <= keel; y++) {
      const band = y - deck;
      px(x, y, band < 1 ? '#c8a070' : band < 3 ? '#6a4428' : band % 3 === 0 ? '#3a2416' : y > wl ? '#2a1a12' : '#553620');
    }
    // The rail.
    if (x % 3 === 0) px(x, Math.round(deck) - 1, '#6a4428');
    px(x, Math.round(deck) - 2, '#8a6038');
  }
  // The stern castle (right), the bowsprit (left).
  for (let y = wl - 15; y < wl - 9; y++) for (let x = 74; x < 89; x++) px(x, y, x === 74 || y === wl - 15 ? '#8a6038' : '#553620');
  for (let x = 79; x < 87; x += 3) px(x, wl - 12, '#ffcc6a');
  for (let i = 0; i < 14; i++) px(6 - i * 0.4, wl - 10 - i * 0.55, '#6a4428');
  // Masts.
  const fore = 30;
  const main = 54;
  const mastTop = (m) => (m === main && broken ? 22 : m === main ? 4 : 12);
  for (const m of [fore, main]) for (let y = mastTop(m); y < wl - 9; y++) {
    px(m, y, '#4a3020');
    px(m + 1, y, '#3a2416');
  }
  // The canvas: square sails on yards, bellied, shaded.
  const sail = (m, top, bottom, half) => {
    for (let y = top; y < bottom; y++) {
      const k = (y - top) / (bottom - top);
      const belly = Math.round(Math.sin(k * Math.PI) * 2);
      for (let x = m - half - belly; x <= m + half + 1 - belly; x++) {
        const edge = x === m - half - belly || x === m + half + 1 - belly;
        px(x, y, edge ? '#c8bca0' : (x - m) % 7 === 0 ? '#ddd2b8' : k > 0.7 ? '#d8ccb0' : '#ece4d0');
      }
    }
    for (let x = m - half - 2; x <= m + half + 3; x++) px(x, top - 1, '#4a3020');
  };
  sail(fore, 16, 30, 9);
  sail(fore, 32, wl - 13, 11);
  if (!broken) sail(main, 8, 24, 11);
  sail(main, 26, wl - 12, 13);
  // The flag at the main's head.
  if (!broken) for (let y = 1; y < 5; y++) for (let x = main + 2; x < main + 9; x++) px(x, y, y === 2 ? '#e8dcc0' : '#8a2a3a');
  else for (let i = 0; i < 4; i++) px(main + (i % 2), 22 - i, '#2a1a12');
  // The jib, from the foremast to the bowsprit.
  for (let y = 14; y < wl - 12; y++) {
    const x1 = fore - 1;
    const x0 = Math.round(fore - 1 - (y - 14) * 0.62);
    for (let x = x0; x < x1; x++) px(x, y, '#e4dac4');
  }
  return c;
}

function paintWreck(info) {
  const rng = new RNG(hash4(info.seed >>> 0, 0x5e2));
  // The Wall's face along the sea ahead: how high it stands at each column.
  const wall = Array.from({ length: PW }, (_, x) => 30 + Math.round(10 * Math.sin(x * 0.05 + 1) + 6 * Math.sin(x * 0.13) + rng.float(0, 3)));
  const crew = [{ x: 40, s: '#8a2a3a' }, { x: 60, s: '#2a4a7a' }, { x: 70, s: '#5a5a5a' }, { x: 24, s: '#c89030' }, { x: 80, s: '#2a2a3a' }];
  const ship = paintShip(false);
  const broken = paintShip(true);
  return { ship, broken, shipDark: darken(ship), brokenDark: darken(broken), wall, crew, drops: Array.from({ length: 140 }, () => ({ x: rng.float(0, PW), y: rng.float(0, PH), v: rng.float(0.8, 1.4) })) };
}

// A picture as it looks in the storm's dark.
function darken(src) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(12,16,32,0.62)';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function drawWreck(ctx, sc, art) {
  const t = sc.t;
  const buf = drawWreck.buf || (drawWreck.buf = makeCanvas(PW, PH));
  const g = buf.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  const px = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  // How far into the storm: 0 the calm evening, 1 the worst of it.
  const storm = clamp01((t - WRECK.GATHER) / (WRECK.STORM - WRECK.GATHER + 2));
  const struck = t >= WRECK.STRIKE;
  // Lightning: a flash now and then in the storm (the strike, the brightest).
  const flashAt = Math.floor(t * 1.3);
  const flash = (t > WRECK.STORM && hashf(flashAt, 3, 7) < 0.35 ? clamp01(1 - (t * 1.3 - flashAt) * 4) * 0.7 : 0) + (struck ? clamp01(1 - (t - WRECK.STRIKE) * 1.5) : 0);
  // The sky: a sunset going over to storm-dark.
  const top = mix(mix('#2a2a5a', '#14161e', storm), '#c8d4f0', flash * 0.6);
  const mid = mix(mix('#b85a6a', '#20242c', storm), '#e0e8ff', flash * 0.6);
  const low = mix(mix('#f0a868', '#343a42', storm), '#f0f4ff', flash * 0.6);
  for (let i = 0; i < 12; i++) {
    const y0 = Math.floor((i / 12) * W_HORIZON);
    const y1 = Math.floor(((i + 1) / 12) * W_HORIZON);
    const k = i / 11;
    g.fillStyle = k < 0.5 ? mix(top, mid, k * 2) : mix(mid, low, (k - 0.5) * 2);
    g.fillRect(0, y0, PW, y1 - y0 + 1);
  }
  // The sun, going down behind you.
  if (storm < 0.9) {
    const sy = W_HORIZON - 4 + t * 0.35;
    g.globalAlpha = 1 - storm;
    g.fillStyle = 'rgba(255,200,140,0.35)';
    g.beginPath();
    g.arc(214, sy, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffe0a0';
    g.beginPath();
    g.arc(214, sy, 7, 0, Math.PI, true);
    g.fill();
    g.globalAlpha = 1;
  }
  // The Wall: black cloud from the sea to the top of the sky, ahead
  // (left), its face heaped in great rolls, rain hanging under it; it
  // fills the sky as you go in.
  const reachX = 130 + storm * 170;
  for (let x = 0; x < PW; x++) {
    const reach = clamp01((reachX - x) / 70);
    if (reach <= 0) continue;
    const roll = 8 * Math.sin(x * 0.045 + t * 0.15) + 5 * Math.sin(x * 0.11 - t * 0.2) + 3 * Math.sin(x * 0.23);
    const topY = Math.round(lerp(W_HORIZON, BAR / 2 + 4 - storm * 20, ease(reach)) + roll * reach);
    for (let y = Math.max(0, topY); y < W_HORIZON; y++) {
      const d = y - topY;
      // (Its billows: bands that curl, lit faintly along their tops.)
      const b2 = Math.sin(x * 0.06 + y * 0.18 + t * 0.4) + Math.sin(x * 0.021 - y * 0.09 - t * 0.25) * 1.3;
      let col = d < 2 ? '#3c4258' : b2 > 1.3 ? '#262b3c' : b2 > 0.2 ? '#1c2030' : '#151824';
      // (Rain hanging under it, near the sea.)
      if (y > W_HORIZON - 14 && (x + Math.floor(y * 0.5 + t * 6)) % 5 === 0) col = '#2c3244';
      px(x, y, col);
    }
  }
  // Silent lightning walking inside it.
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.7 + i * 0.37) % 1;
    if (k > 0.12) continue;
    const lx = (hashf(i, Math.floor(t * 0.7 + i * 0.37), 5) * (90 + storm * 140)) | 0;
    const ly = W_HORIZON - 18 - ((hashf(i, Math.floor(t), 9) * 20) | 0);
    g.fillStyle = `rgba(200,180,255,${(0.5 * (1 - k / 0.12)).toFixed(3)})`;
    g.beginPath();
    g.arc(lx, ly, 9, 0, Math.PI * 2);
    g.fill();
  }
  // Rain, from the storm's start: slanting, thicker as it worsens.
  // (Drawn after the sea and ship, below.)
  // The sea: bands of swell, crests moving, higher in the storm.
  for (let y = W_HORIZON; y < PH; y++) {
    const d = (y - W_HORIZON) / (PH - W_HORIZON);
    const base = mix(mix('#3a4a7a', '#1a2430', storm), '#203048', d);
    g.fillStyle = mix(base, '#a8b8d0', flash * 0.3);
    g.fillRect(0, y, PW, 1);
    const amp = 0.4 + storm * 1.2;
    for (let x = 0; x < PW; x++) {
      const w = Math.sin(x * (0.08 - d * 0.04) + t * (1.4 + storm * 1.6) + y * 0.9);
      if (w > 1 - 0.08 * amp * (1 + d)) px(x, y, storm > 0.5 ? '#c8d4e0' : '#7a8ab8');
    }
  }
  // (The sun's path on the water.)
  if (storm < 0.8) {
    for (let y = W_HORIZON + 1; y < PH; y += 2) {
      const x = 214 + Math.round(Math.sin(y * 1.7 + t * 3) * (2 + (y - W_HORIZON) * 0.08));
      g.globalAlpha = (1 - storm) * 0.8;
      px(x, y, '#ffd8a0');
      px(x + 1, y, '#ffc080');
    }
    g.globalAlpha = 1;
  }
  // The ship, pitching and rolling, more as the storm grows; heeling over
  // after the strike.
  const heel = struck ? Math.min(0.32, (t - WRECK.STRIKE) * 0.12) : 0;
  const ang = Math.sin(t * 1.1) * (0.03 + storm * 0.1) + heel;
  const bob = Math.sin(t * 0.9) * (1.2 + storm * 3) + (struck ? (t - WRECK.STRIKE) * 2 : 0);
  const sx = 82;
  const sy = 108 + bob;
  g.save();
  g.translate(sx + SHIP.w / 2, sy);
  g.rotate(ang);
  // (Darkening as the storm closes in; lit up by the lightning.)
  const lit = clamp01(1 - storm * 0.85 + flash);
  g.drawImage(struck ? art.brokenDark : art.shipDark, -SHIP.w / 2, -SHIP.water);
  g.globalAlpha = lit;
  g.drawImage(struck ? art.broken : art.ship, -SHIP.w / 2, -SHIP.water);
  g.globalAlpha = 1;
  // Her people on deck (running, in the storm).
  for (const c of art.crew) {
    const run = storm > 0.3 ? Math.sin(t * 2.4 + c.x) * 10 * storm : Math.sin(t * 0.4 + c.x) * 2;
    const x = -SHIP.w / 2 + c.x + run;
    const y = -9 - 1;
    g.fillStyle = c.s;
    g.fillRect(Math.round(x), y - 3, 2, 3);
    g.fillStyle = '#e0b090';
    g.fillRect(Math.round(x), y - 4, 2, 1);
  }
  // The mainsail burning (after the strike): flames up the canvas, smoke.
  if (struck) {
    const s = t - WRECK.STRIKE;
    const mainX = -SHIP.w / 2 + 54;
    for (let i = 0; i < 26; i++) {
      const fx = mainX - 12 + ((i * 7) % 26);
      const fy0 = -SHIP.water + 26 + ((i * 5) % 20);
      const hgt = 4 + Math.abs(Math.sin(t * 9 + i)) * 6 * Math.min(1, s);
      for (let k = 0; k < hgt; k++) {
        const f = k / hgt;
        g.fillStyle = f < 0.3 ? '#ffe890' : f < 0.65 ? '#ffa030' : '#ff5014';
        g.globalAlpha = 0.9;
        g.fillRect(Math.round(fx + Math.sin(t * 12 + i + k) * 0.6), Math.round(fy0 - k), 1, 1);
      }
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) {
      const k = (s * 0.4 + i / 6) % 1;
      g.globalAlpha = 0.5 * (1 - k);
      g.fillStyle = '#3a3634';
      g.fillRect(Math.round(mainX + Math.sin(i * 2 + t) * 4 - k * 18), Math.round(-SHIP.water + 20 - k * 30), 3, 3);
    }
    g.globalAlpha = 1;
  }
  g.restore();
  // Spray off her bow, in heavy seas.
  if (storm > 0.4) {
    for (let i = 0; i < 10; i++) {
      const k = (t * 1.6 + i / 10) % 1;
      g.globalAlpha = (1 - k) * storm;
      px(sx + 4 - k * 14 + Math.sin(i) * 3, sy - 6 - Math.sin(k * Math.PI) * 14, '#e8f0ff');
    }
    g.globalAlpha = 1;
  }
  // The bolt: down out of the sky onto the mainmast.
  const boltTo = (x0, x1, y1, alpha) => {
    g.globalAlpha = alpha;
    g.fillStyle = '#ffffff';
    let x = x0;
    for (let y = BAR / 2; y < y1; y++) {
      x += (hashf(y, Math.floor(t * 10), 3) - 0.5) * 2.6 + (x1 - x) * 0.06;
      g.fillRect(Math.round(x), y, y % 7 === 0 ? 2 : 1, 1);
    }
    g.globalAlpha = 1;
  };
  if (struck && t - WRECK.STRIKE < 0.45) boltTo(sx + 50, sx + 54, sy - SHIP.water + 22, 1 - (t - WRECK.STRIKE) * 2);
  // Others out over the sea, in the storm.
  if (t > WRECK.STORM && t < WRECK.BLACK && flash > 0.2 && !struck) boltTo(20 + hashf(flashAt, 1, 2) * 200, 20 + hashf(flashAt, 4, 2) * 200, W_HORIZON, flash);
  // The rain.
  if (t > WRECK.GATHER) {
    const n = Math.round(art.drops.length * storm);
    g.fillStyle = 'rgba(200,214,240,0.55)';
    for (let i = 0; i < n; i++) {
      const d = art.drops[i];
      const y = (d.y + t * 160 * d.v) % PH;
      const x = (d.x - t * 60 * d.v + 400) % PW;
      g.fillRect(Math.round(x), Math.round(y), 1, 3);
      g.fillRect(Math.round(x) - 1, Math.round(y) + 3, 1, 1);
    }
  }
  // (The strike: white, for a moment.)
  if (struck && t - WRECK.STRIKE < 0.6) {
    g.globalAlpha = 0.85 * (1 - (t - WRECK.STRIKE) / 0.6);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, PW, PH);
    g.globalAlpha = 1;
  }
  // To the screen: in from black, to black at the end.
  const fade = t < 1.5 ? t / 1.5 : t > WRECK.BLACK - 2 ? 1 - clamp01((t - (WRECK.BLACK - 2)) / 2) : 1;
  const shake = struck ? Math.max(0, 1 - (t - WRECK.STRIKE) / 2.5) : storm > 0.6 ? 0.15 : 0;
  present(ctx, buf, { alpha: fade, shake });
  // The ship's name over it, and where she was bound; what's said.
  if (t < WRECK.BLACK) {
    ctx.globalAlpha = fade * (t < 8 ? 1 : clamp01(1 - (t - 8) / 1.5));
    bigText(ctx, `~ THE ${sc.info.ship.toUpperCase()} ~`, 1, '#ffe070');
    ctx.globalAlpha = 1;
    drawText(ctx, 'ENTER skip', VIEW_W - 10 * CHAR_W - 6, 7, '#5a5040');
    if (t < 3) {
      const sub = `Twelve days out from ${sc.info.port}, bound for the Dagoni Islands`;
      ctx.globalAlpha = clamp01(t) * clamp01((3 - t) * 2);
      drawText(ctx, sub, Math.round(VIEW_W / 2 - (sub.length * CHAR_W) / 2), VIEW_H - 15, '#a89878');
      ctx.globalAlpha = 1;
    }
    // (The line being said now.)
    let cur = null;
    for (let i = 0; i < sc.lines.length; i++) if (t >= sc.lines[i][0]) cur = i;
    if (cur !== null) {
      const [at, who, text] = sc.lines[cur];
      const next = cur + 1 < sc.lines.length ? sc.lines[cur + 1][0] : WRECK.BLACK;
      const parts = who ? [[`${who}: `, '#ffd890'], [text, '#f4ecd8']] : [[text, '#c8d8ff']];
      caption(ctx, parts, t - at, clamp01((next - t) * 2.5) * fade);
    }
  }
  // In the dark, what you remember.
  if (t > WRECK.BLACK) darkWords(ctx, sc.words, t - WRECK.BLACK, WRECK.LINE, 4);
}

// ============================================================ which
// The opening for whoever's being played as (their origin's), or null for
// none. (A fallen star's is its own: see starfall.js and Game.starScene.)
export function introScene(game) {
  const h = game.hero;
  if (!h) return null;
  if (h.origin === 'star') {
    const sc = game.starScene(game.starAt || null);
    sc.intro = true;
    return sc;
  }
  if (h.origin === 'native' && game.sim.citizen) return homeScene(game, homeInfo(game));
  return wreckScene(game, wreckInfo(game));
}

// A scene from the host, made again on a player's own screen (see
// net/guest.js): the painted openings, from what's told in them.
export function introFrom(game, s) {
  if (s.kind === 'home_intro' && s.info) return homeScene(game, s.info);
  if (s.kind === 'wreck_intro' && s.info) return wreckScene(game, s.info);
  return null;
}
