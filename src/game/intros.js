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
import { drawPerson, drawHouse, drawTree, drawCloud, shade, mix, fillPoly, line } from '../render/scenekit.js';

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
    const gap = Math.round(8 * R.k) + 2;
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
  // (On the front row if it can be, where nothing's in front of it.)
  const front = houses.filter((h) => h.kind === 'house' && h.row >= 2).sort((a, b) => b.row - a.row || Math.abs(a.x - cx) - Math.abs(b.x - cx));
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
    skin: rng.pick(['#f4d0b0', '#d8a47c', '#b07a4a', '#8a5a34', '#e8b48c']),
  }));
  const clouds = Array.from({ length: 5 }, () => ({ x: rng.float(0, PW), y: rng.int(20, 44), w: rng.int(22, 46), v: rng.float(2, 5) }));
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
  if (my < H_HORIZON + 4 && S.dayK < 0.75) {
    g.globalAlpha = clamp01((0.75 - S.dayK) * 4);
    g.fillStyle = '#e8ecf4';
    g.beginPath();
    g.arc(mx, my, 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mix(S.top, S.low, 0.3);
    g.fillRect(Math.round(mx), Math.round(my) - 2, 2, 2);
    g.globalAlpha = 1;
  }
  // Clouds drifting over: heaped, lit along their tops (by the low sun,
  // warm), their bellies shaded.
  const cLit = mix(mix('#4a4a6a', '#ffffff', S.dayK), '#ffd0a0', clamp01(1 - Math.abs(S.h) * 3) * 0.6);
  const cBody = mix('#30304c', '#e4e2ec', S.dayK);
  const cDark = mix('#24243a', '#b4b8cc', S.dayK);
  for (const c of art.clouds) {
    const x = ((c.x + t * c.v * (racing ? 4 : 1)) % (PW + 60)) - 40;
    g.globalAlpha = 0.92;
    drawCloud(px, Math.round(x), c.y, c.w, cLit, cBody, cDark);
    g.globalAlpha = 1;
  }
  // The land.
  g.drawImage(art.land, 0, 0);
  // The fields, tilled as it grows: furrows, a hedge round them.
  for (const f of art.fields) {
    if (prog < f.t) continue;
    for (let y = f.y; y < f.y + f.h; y++) {
      for (let x = f.x; x < f.x + f.w; x++) {
        const edge = y === f.y || y === f.y + f.h - 1 || x === f.x || x === f.x + f.w - 1;
        px(x, y, edge ? art.P.leafDark : (y - f.y) % 3 === 0 ? shade(f.crop, -46) : (y - f.y) % 3 === 1 ? shade(f.crop, 16) : (x + y) % 5 ? f.crop : shade(f.crop, -20));
      }
    }
  }
  // The lanes, laid as the rows fill: the road up from the front to the
  // hall, and a street along the front of each row (its edges worn, the
  // grass coming up at its ends).
  const road = art.look.shape === 'flat' ? '#c8b48a' : '#8a7454';
  const lane = (x0, x1, y, w) => {
    for (let x = Math.floor(x0); x < x1; x++) {
      const end = Math.min(x - x0, x1 - x);
      for (let k = -1; k <= w; k++) {
        const n = hashf(x, y + k, 4);
        // (Its edges ragged, the grass growing in over them; its ends
        // fading out into the grass.)
        if (k === -1 || k === w) {
          if (n < 0.4) px(x, y + k, k === -1 ? shade(road, -8) : shade(road, -16));
          continue;
        }
        if (end < 4 && hashf(x, y + k, 6) < 0.6 - end * 0.15) continue;
        px(x, y + k, n < 0.14 ? shade(road, -12) : n > 0.88 ? shade(road, 12) : (x + k * 3) % 9 === 0 ? shade(road, 6) : road);
      }
    }
  };
  if (prog > 0.03) {
    for (let y = ROWS[1].yb + 1; y < PH; y++) {
      const half = 2 + (y - ROWS[1].yb) * 0.1;
      for (let x = Math.round(PW / 2 - half); x < Math.round(PW / 2 + half); x++) {
        const edge = x === Math.round(PW / 2 - half) || x === Math.round(PW / 2 + half) - 1;
        px(x, y, edge ? shade(road, -18) : hashf(x, y, 4) < 0.2 ? shade(road, -12) : road);
      }
    }
  }
  ROWS.forEach((R, ri) => {
    const built = art.houses.filter((h) => h.row === ri && prog >= h.t);
    if (!built.length) return;
    const x0 = Math.min(...built.map((h) => h.x)) - 6;
    const x1 = Math.max(...built.map((h) => h.x + h.w + Math.round(h.w * 0.28))) + 6;
    lane(x0, x1, R.yb + 2, Math.max(2, Math.round(4 * R.k)));
  });
  // Night: everything dimmed, the windows lit.
  const night = 1 - S.dayK;
  // Back to front: the trees still standing, the houses (rising), the
  // folk, row by row.
  const items = [];
  const lit = [];
  for (const tr of art.trees) if (prog < tr.cut) items.push({ y: tr.y, x: tr.x, draw: () => drawTree(g, px, tr.x, tr.y, tr.k, art.P) });
  const homeNow = t > T1 + 5;
  let homeRidge = null;
  for (const h of art.houses) {
    const rise = clamp01((prog - h.t) / 0.07);
    if (rise <= 0) continue;
    const R = ROWS[h.row];
    items.push({
      y: R.yb - 0.5, x: h.x,
      draw: () => {
        const mine = h === art.home && homeNow;
        if (mine) {
          // Your family's: drawn on its own, a warm light round its edge.
          const a = clamp01((t - T1 - 5.5) * 2);
          const hc = drawHome.hc || (drawHome.hc = makeCanvas(PW, PH));
          const hg = hc.getContext('2d');
          hg.clearRect(0, 0, PW, PH);
          hg.globalAlpha = 1;
          const hpx = (x, y, col) => {
            hg.fillStyle = col;
            hg.fillRect(Math.round(x), Math.round(y), 1, 1);
          };
          const o = buildingOf(hg, hpx, h, R, art.look, rise, night, t, true);
          homeRidge = o.ridge;
          lit.push(...(h.lit ? o.wins || [] : []));
          const oc = drawHome.oc || (drawHome.oc = makeCanvas(PW, PH));
          const og = oc.getContext('2d');
          og.globalCompositeOperation = 'source-over';
          og.clearRect(0, 0, PW, PH);
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2]]) og.drawImage(hc, dx, dy);
          og.globalCompositeOperation = 'source-in';
          og.fillStyle = '#ffe090';
          og.fillRect(0, 0, PW, PH);
          og.globalCompositeOperation = 'source-over';
          g.globalAlpha = a * (0.7 + 0.3 * Math.sin(t * 3));
          g.drawImage(oc, 0, 0);
          g.globalAlpha = 1;
          g.drawImage(hc, 0, 0);
          return;
        }
        const o = buildingOf(g, px, h, R, art.look, rise, night, t, false);
        if (h.lit && rise >= 1) lit.push(...(o.wins || []));
      },
    });
  }
  if (t > T1 - 1) {
    for (const f of art.folk) {
      const R = ROWS[f.row];
      let x = (f.x + (t - T1) * f.v) % (PW + 20);
      if (x < -10) x += PW + 20;
      const y = R.yb + 1 + Math.max(1, Math.round(2 * R.k));
      items.push({ y: R.yb + 1 + f.row * 0.01, x, draw: () => drawPerson(px, x, y + 1, { size: f.row >= 3 ? 'small' : 'tiny', pose: 'walk', frame: Math.floor(t * 5 + f.x), dir: f.v > 0 ? 1 : -1, shirt: f.shirt, hair: f.hair, skin: f.skin, lit: -1 }) });
    }
  }
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const it of items) it.draw();
  // The walls, last of all (a walled town's), across the front.
  if (info.walled) {
    const rise = clamp01((prog - 0.88) / 0.1);
    if (rise > 0) drawWall(px, rise, art.look);
  }
  // Night over the land (the lit windows drawn bright after, a little of
  // their light on the wall round them).
  if (night > 0.05) {
    g.fillStyle = `rgba(8,12,40,${(night * 0.5).toFixed(3)})`;
    g.fillRect(0, H_HORIZON - 30, PW, PH);
    const glow = art.look.glow || '#ffcc6a';
    for (const w of lit) {
      g.globalAlpha = night * 0.25;
      g.fillStyle = glow;
      g.fillRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2);
      g.globalAlpha = night;
      g.fillRect(w.x, w.y, w.w, w.h);
      g.fillStyle = shade(glow, 40);
      g.fillRect(w.x, w.y, 1, 1);
    }
    g.globalAlpha = 1;
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
  // Your family's door, today: the picture drawn in to it, and a mark
  // over it.
  let zoom = 1;
  let fx = PW / 2;
  let fy = PH / 2;
  if (homeNow) {
    const h = art.home;
    const R = ROWS[h.row];
    const k = ease(clamp01((t - T1 - 5) / 4));
    zoom = 1 + 0.6 * k;
    fx = lerp(PW / 2, h.x + h.w / 2, k);
    fy = lerp(PH / 2, R.yb - h.h / 2, k);
    const bob = Math.round(Math.sin(t * 4) * 1.5);
    const ax = Math.round(homeRidge ? (homeRidge.x0 + homeRidge.x1) / 2 : h.x + h.w / 2);
    const ay = (homeRidge ? homeRidge.y : R.yb - h.h - 8) - 4 + bob;
    g.globalAlpha = clamp01((t - T1 - 5.5) * 2);
    // (An arrow, outlined, pointing down at it.)
    for (let i = -1; i < 5; i++) for (let k2 = -4 + Math.max(0, i); k2 <= 4 - Math.max(0, i); k2++) px(ax + k2, ay + i, '#3a2408');
    for (let y = ay - 5; y < ay; y++) for (let k2 = -2; k2 <= 2; k2++) px(ax + k2, y, '#3a2408');
    for (let i = 0; i < 4; i++) for (let k2 = -3 + i; k2 <= 3 - i; k2++) px(ax + k2, ay + i, i === 0 ? '#fff4b0' : '#ffe070');
    for (let y = ay - 4; y < ay; y++) {
      px(ax - 1, y, '#fff4b0');
      px(ax, y, '#ffe070');
      px(ax + 1, y, '#e0b040');
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

// One of the town's buildings, `rise` of the way up (its frame first, the
// walls filling in, the roof going on last), seen three-quarters on: a
// house, the hall (its bell tower on the ridge, a flag on it), a temple
// (a spire; a dome, in the sun). Returns what it was drawn with (its
// windows, its ridge).
function buildingOf(g, px, h, R, look, rise, night, t, mine) {
  const hall = h.kind === 'hall';
  const temple = h.kind === 'temple';
  const shape = look.shape === 'hut' && (hall || temple) ? 'steep' : look.shape;
  const wall = hall ? shade(look.wall, -10) : temple ? shade(look.wall, 14) : look.wall;
  const tall = temple ? h.h + 4 : h.h;
  // (On stilts over the shallows.)
  if (look.stilts && h.row >= 2) for (let x = h.x + 1; x < h.x + h.w + 4; x += 4) for (let y = R.yb; y < R.yb + 4; y++) px(x, y, y === R.yb ? shade(look.timber, 16) : look.timber);
  const o = {
    shape, wall, roof: h.roof, timber: look.shape === 'flat' || look.shape === 'hut' ? null : look.timber,
    up: rise, night, lit: h.lit, glow: look.glow, chimney: h.chimney, smoke: t, mine,
    windows: hall ? 4 : temple ? 2 : undefined,
  };
  drawHouse(g, px, h.x, R.yb, h.w, tall, o);
  if (rise < 1) return o;
  const r = o.ridge;
  if (!r) return o;
  const cx = Math.round((r.x0 + r.x1) / 2);
  if (hall) {
    // A bell tower over the ridge: its front and its shaded side, the bell
    // in its arch, a pointed cap, the flag.
    const tw = 5;
    const ty = r.y - 8;
    for (let y = ty; y <= r.y + 2; y++) {
      for (let x = cx - 2; x < cx - 2 + tw; x++) px(x, y, x === cx - 2 ? shade(wall, 8) : shade(wall, -8));
      px(cx + 3, y - 1, shade(wall, -40));
      px(cx + 4, y - 1, shade(wall, -46));
    }
    for (let y = ty + 2; y < ty + 5; y++) for (let x = cx - 1; x < cx + 2; x++) px(x, y, '#2a2026');
    px(cx, ty + 4, '#c8a040');
    px(cx - 1, ty + 4, '#a88030');
    for (let i = 0; i < 4; i++) for (let x = cx - 3 + i; x <= cx + 4 - i; x++) px(x, ty - 1 - i, x > cx ? shade(h.roof, -24) : i % 2 ? shade(h.roof, 10) : h.roof);
    for (let y = ty - 11; y < ty - 4; y++) px(cx, y, '#3a3030');
    const wave = Math.round(Math.sin(t * 5));
    for (let y = ty - 11; y < ty - 8; y++) for (let x = cx + 1; x < cx + 6; x++) px(x, y + (x > cx + 3 ? wave : 0), y === ty - 10 ? '#d84a4a' : '#a83030');
  } else if (temple) {
    if (look.shape === 'flat') {
      // A dome on a drum.
      for (let dy = 0; dy < 6; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          if (dx * dx + dy * dy * 2 >= 30) continue;
          px(cx + dx, r.y - 1 - dy, dx < -2 ? '#f0e0b0' : dx > 2 ? '#b89858' : '#d8c088');
        }
      }
      px(cx, r.y - 8, '#ffe070');
      px(cx, r.y - 7, '#c8a040');
    } else {
      // A spire: its lit face and its shaded one, a gold point.
      for (let i = 0; i < 12; i++) {
        const half = Math.round((12 - i) / 4);
        for (let d = -half; d <= half; d++) px(cx + d, r.y - i, d > 0 ? shade(h.roof, -28) : shade(h.roof, i % 3 === 0 ? 4 : -6));
      }
      px(cx, r.y - 13, '#ffe070');
      px(cx, r.y - 12, '#c8a040');
    }
  }
  return o;
}

// A walled town's wall: stone, its top a walk behind the battlements, a
// tower at each end and either side of the gate.
function drawWall(px, rise, look) {
  const yb = 136;
  const hgt = Math.round(8 * rise);
  const stone = look.shape === 'flat' ? '#c8b488' : '#8a8a86';
  for (let x = 6; x < PW - 6; x++) {
    if (Math.abs(x - PW / 2) < 6) continue;
    for (let y = yb - hgt; y < yb; y++) {
      const course = (yb - y) % 3 === 0;
      const joint = (x + Math.floor((yb - y) / 3) * 2) % 5 === 0;
      px(x, y, course || joint ? shade(stone, -22) : y === yb - 1 ? shade(stone, -30) : stone);
    }
    if (rise >= 1) {
      px(x, yb - hgt - 1, shade(stone, 26));
      px(x, yb - hgt - 2, shade(stone, 12));
      if (x % 4 < 2) {
        px(x, yb - hgt - 3, shade(stone, 6));
        px(x, yb - hgt - 4, shade(stone, 20));
      }
    }
  }
  if (rise < 1) return;
  for (const tx of [6, PW - 16, PW / 2 - 14, PW / 2 + 6]) {
    for (let y = yb - 15; y < yb; y++) {
      for (let x = tx; x < tx + 8; x++) px(x, y, x === tx ? shade(stone, 14) : (x + y) % 4 === 0 ? shade(stone, -22) : shade(stone, -4));
      for (let x = tx + 8; x < tx + 10; x++) px(x, y - (x - tx - 7), shade(stone, -40));
    }
    for (let x = tx; x < tx + 8; x++) px(x, yb - 16, shade(stone, 24));
    for (let x = tx; x < tx + 8; x += 2) {
      px(x, yb - 17, shade(stone, 10));
      px(x, yb - 18, shade(stone, 20));
    }
    for (let y = yb - 11; y < yb - 8; y++) px(tx + 3, y, '#1a1a20');
  }
  // (The gate: an arch, its doors open.)
  for (let y = yb - 6; y < yb; y++) {
    px(PW / 2 - 6, y, '#4a3020');
    px(PW / 2 + 5, y, '#4a3020');
  }
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
// The ship's picture: `w` by `h`, her waterline `water` down it.
const SHIP = { w: 112, h: 84, water: 66 };
const WL = SHIP.water;
// Where her masts stand, how high their heads are (the main's, split by
// the bolt, lower), and the yards across them.
const MASTS = { fore: 42, main: 66, mizzen: 93 };

// The top of her side at x (her sheer: lowest amidships, rising to the bow
// and, less, to the stern; the stern castle above that).
function sheer(x) {
  if (x >= 86) return WL - 20;
  if (x < 62) {
    const u = (62 - x) / 42;
    return WL - 11 - Math.round(5 * u * u);
  }
  const u = (x - 62) / 44;
  return WL - 11 - Math.round(3 * u * u);
}

// The ship, side on, heading left (toward the Wall), lit from behind by
// the sunset: her hull (in two: what's behind her people on deck, and her
// side, in front of them), three masts, square sails bent to their yards,
// the jibs on the forestay, the spanker aft, the rigging, her colours.
// Whole, and after the bolt (the main topmast split off, its sail gone,
// the yard hanging).
function paintShip(broken) {
  const back = makeCanvas(SHIP.w, SHIP.h);
  const front = makeCanvas(SHIP.w, SHIP.h);
  const pen = (c) => {
    const g = c.getContext('2d');
    return (x, y, col) => {
      g.fillStyle = col;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    };
  };
  const px = pen(back);
  const fpx = pen(front);
  const bg = back.getContext('2d');
  const rope = '#2a1a10';
  const cloth = '#ece2c8';
  const { fore, main, mizzen } = MASTS;
  const rig = (x0, y0, x1, y1, a = 1) => {
    bg.globalAlpha = a;
    line(px, x0, y0, x1, y1, rope);
    bg.globalAlpha = 1;
  };
  // The stays and backstays (in the middle of her: behind the sails).
  rig(fore, 10, 2, 38);
  if (!broken) rig(main, 4, fore + 1, 34);
  else rig(fore + 1, 34, fore + 9, 27);
  rig(mizzen, 22, main + 1, 30);
  rig(fore + 1, 11, 56, sheer(56));
  if (!broken) rig(main + 1, 5, 84, sheer(84));
  rig(mizzen + 1, 23, 108, WL - 21);
  // The bowsprit and its boom, out over the bow.
  line(px, 21, 49, 1, 38, '#5a3a20');
  line(px, 22, 50, 3, 40, '#3a2414');
  // Masts: the lower mast up to its top (a platform), the topmast above.
  const mast = (x, foot, top, head) => {
    for (let y = top; y < foot; y++) {
      px(x, y, '#5a3a20');
      px(x + 1, y, '#a87a4a');
    }
    for (let x2 = x - 3; x2 <= x + 4; x2++) px(x2, top, '#2a1a10');
    for (let y = head; y < top; y++) px(x, y, y % 4 === 0 ? '#3a2414' : '#6a4628');
    px(x, head - 1, '#2a1a10');
  };
  mast(fore, sheer(fore) + 2, 34, 9);
  if (!broken) mast(main, sheer(main) + 2, 30, 3);
  else {
    // (Split: the stump of the topmast, its end jagged.)
    mast(main, sheer(main) + 2, 30, 27);
    for (const [dx, dy] of [[0, -1], [0, -2], [1, -1], [-1, -3]]) px(main + dx, 27 + dy, '#3a2414');
  }
  for (let y = 22; y < WL - 20; y++) {
    px(mizzen, y, '#5a3a20');
    px(mizzen + 1, y, y < 26 ? '#5a3a20' : '#a87a4a');
  }
  // The shrouds, up from her rail to each top (rungs across them): behind
  // the sails, showing under them and between.
  for (const [m, top] of [[fore, 34], [main, 30], [mizzen, 26]]) {
    const foot = sheer(m) + 1;
    bg.globalAlpha = 0.7;
    for (const d of [-6, -3, 3, 6]) line(px, m + Math.sign(d), top + 1, m + d, foot, rope);
    bg.globalAlpha = 0.35;
    for (let y = top + 4; y < foot - 1; y += 3) {
      const k = (y - top) / (foot - top);
      line(px, m - 1 - Math.round(5 * k), y, m + 1 + Math.round(5 * k), y, rope);
    }
    bg.globalAlpha = 1;
  }
  // A square sail: bent to its yard at y0 along all its head, its foot at
  // y1 (sheeted to the yard below), bellied forward by the wind, seams
  // down it, a row of reef points, lit through from behind on the right.
  const yard = (cx, y, half) => {
    for (let x = cx - half - 1; x <= cx + half + 2; x++) px(x, y, x === cx - half - 1 || x === cx + half + 2 ? '#1e140c' : '#3a2414');
  };
  const sail = (cx, y0, y1, h0, h1, torn) => {
    for (let y = y0 + 1; y <= y1; y++) {
      const k = (y - y0 - 1) / Math.max(1, y1 - y0 - 1);
      const half = h0 + (h1 - h0) * k;
      const belly = Math.round(Math.sin(k * Math.PI) * 1.6);
      const xl = Math.round(cx - half) - belly;
      const xr = Math.round(cx + half + 1) - Math.round(belly * 0.5);
      for (let x = xl; x <= xr; x++) {
        const u = (x - xl) / Math.max(1, xr - xl);
        // (Its foot curved up between the corners.)
        if (y > y1 - Math.round(Math.sin(u * Math.PI) * 1.6)) continue;
        if (torn && k > 0.35 && hashf(x, y, 7) < 0.2 + k * 0.25) continue;
        let c = cloth;
        if (x === xl || x === xr || y === y1 - Math.round(Math.sin(u * Math.PI) * 1.6)) c = '#a89878';
        else if ((x - cx) % 4 === 0) c = '#d6cab0';
        else if (u < 0.2) c = '#c8bc9c';
        else if (u > 0.72) c = mix(cloth, '#ffd8a8', (u - 0.72) * 2.2);
        else if (k > 0.75) c = '#ddd2b6';
        if (y === y0 + 3 && x % 2 === 0 && x > xl && x < xr) c = '#b4a684';
        px(x, y, torn ? shade(c, -40 - Math.round(k * 40)) : c);
      }
    }
  };
  sail(fore, 19, 35, 10, 13);
  sail(fore, 36, 50, 13, 14);
  yard(fore, 19, 10);
  yard(fore, 36, 13);
  if (!broken) {
    sail(main, 13, 31, 11, 15);
    yard(main, 13, 11);
  }
  sail(main, 32, 50, 15, 16, broken);
  if (!broken) yard(main, 32, 15);
  else line(px, main - 16, 30, main + 14, 37, '#3a2414');
  // The jibs, along the forestay (their luffs on it), out to the bowsprit;
  // the spanker, aft of the mizzen between its gaff and boom.
  const tri = (pts, edge) => {
    fillPoly(px, pts, (x, y) => (hashf(x, y, 3) < 0.08 ? '#d6cab0' : (x + y) % 5 === 0 ? '#e0d6bc' : cloth));
    for (let i = 0; i < pts.length; i++) line(px, ...pts[i], ...pts[(i + 1) % pts.length], edge);
  };
  tri([[34, 16], [19, 48], [37, 49]], '#a89878');
  tri([[40, 11], [4, 37], [33, 44]], '#a89878');
  line(px, mizzen, 26, 106, 31, '#3a2414');
  line(px, mizzen, 48, 110, 48, '#3a2414');
  fillPoly(px, [[mizzen + 1, 27], [105, 31], [109, 47], [mizzen + 1, 47]], (x, y) => ((x - mizzen) % 4 === 0 ? '#d6cab0' : x > 103 ? mix(cloth, '#ffd8a8', 0.5) : y > 44 ? '#ddd2b6' : cloth));
  // Her colours: a long pennant off the main (gone after the bolt), the
  // flag at the mizzen's head; streaming forward, the wind behind her.
  if (!broken) for (let i = 0; i < 13; i++) px(main - 1 - i, 3 + Math.round(Math.sin(i * 0.7) * 0.8), i < 5 ? '#c83a3a' : '#a82a2a');
  for (let y = 22; y < 26; y++) for (let x = mizzen - 7; x < mizzen; x++) px(x, y + (x < mizzen - 4 ? 1 : 0), y === 23 ? '#e8dcc0' : '#8a2a3a');
  // The hull, her side toward you: the rail and bulwark, the wales and a
  // painted band, her planking, darker under the water; the stern castle,
  // its cabin windows lit; the stem, a gilt figure at its head; the rudder.
  for (let x = 20; x <= 106; x++) {
    const top = sheer(x);
    let bottom = WL + 5;
    if (x < 34) bottom = Math.min(bottom, top + (x - 20) * 1.5);
    if (x > 94) bottom = Math.round(WL + 5 - (x - 94) * 1.3);
    const end = x < 30 || x > 100 ? -14 : 0;
    for (let y = top; y <= bottom; y++) {
      const r = y - top;
      let c;
      if (r === 0) c = '#c89a62';
      else if (x >= 86 && y < WL - 13) c = r === 1 ? '#6a4628' : (y + x) % 7 === 0 ? '#4e321c' : '#5a3a20';
      else if (r <= 2) c = r === 1 ? '#6a4628' : '#5e3c22';
      else if (y === WL - 11 + 3 || y === WL - 4) c = '#24160c';
      else if (y === WL - 11 + 4) c = '#9a6a32';
      else if (y >= WL) c = '#24302a';
      else c = (y - top) % 3 === 0 ? '#3e2816' : '#4e321c';
      fpx(x, y, shade(c, end));
    }
  }
  for (const wx of [90, 95, 100]) {
    for (let y = WL - 18; y < WL - 14; y++) for (let x = wx - 1; x < wx + 2; x++) fpx(x, y, '#24160c');
    fpx(wx, WL - 17, '#ffcc6a');
    fpx(wx, WL - 16, '#e0a040');
  }
  for (let y = WL - 23; y < WL - 20; y++) fpx(107, y, '#3a2414');
  fpx(107, WL - 24, '#ffe090');
  fpx(108, WL - 24, '#ffcc6a');
  fpx(19, 49, '#e0b040');
  fpx(18, 48, '#c89030');
  fpx(25, WL - 12, '#1a100a');
  for (let y = WL - 4; y < WL + 3; y++) {
    fpx(104, y, '#2a1a10');
    fpx(105, y, '#3a2414');
  }
  return { back, front };
}

// The Wall: the storm round the islands, a cliff of cloud from the sea to
// the top of the sky. Painted once, as a bank of heaped billows (each lit
// along its upper edge, shaded under), its face toward you heaped highest,
// the anvil spreading out over the top; under it the rain hanging to the
// sea. Two of it: in the sunset's light (its edges warm), and in the
// storm's (cold).
const WALL_W = PW + 300;
const WALL_FACE = WALL_W - 70;
function paintWall(seed, warm) {
  const W = WALL_W;
  const H = W_HORIZON + 1;
  const img = new ImageData(W, H);
  const d = img.data;
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    d[o] = c[0];
    d[o + 1] = c[1];
    d[o + 2] = c[2];
    d[o + 3] = 255;
  };
  const C = warm
    ? { deep: [24, 22, 36], shadow: [22, 20, 33], inner: [29, 26, 41], innerLit: [35, 31, 48], body: [40, 34, 54], light: [70, 52, 74], rim: [142, 92, 108], rain: [36, 34, 52], streak: [52, 46, 66] }
    : { deep: [16, 19, 29], shadow: [14, 16, 25], inner: [20, 23, 35], innerLit: [25, 29, 43], body: [30, 34, 50], light: [44, 50, 70], rim: [72, 82, 108], rain: [26, 30, 44], streak: [38, 44, 60] };
  const rng = new RNG(hash4(seed, 0x3a11));
  const BASE = H - 15;
  // Where its face stands at each height (bulging, the anvil out over).
  const face = (y) => WALL_FACE + Math.round(8 * Math.sin(y * 0.09) + 4 * Math.sin(y * 0.23)) + (y < 22 ? Math.round((22 - y) * (22 - y) * 0.12) : 0);
  // (Behind it all: the storm's dark, and the rain under it.)
  for (let y = 0; y < H; y++) {
    const fx = face(Math.min(y, BASE));
    for (let x = 0; x < fx - 6; x++) {
      if (y >= BASE) set(x, y, (x + Math.floor(y * 0.4)) % 4 === 0 ? C.streak : C.rain);
      else set(x, y, C.deep);
    }
  }
  // A billow: round (flattened up in the anvil), lit from the upper right.
  const puff = (cx, cy, r, ry, bright) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      if (y >= BASE + 1) continue;
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = (x - cx) / r;
        const dy = (y - cy) / ry;
        const e = dx * dx + dy * dy;
        if (e > 1) continue;
        // (Cel-shaded: its lit side, its belly in shadow; the face's lit
        // edges catching the light most.)
        const n = dx * 0.55 - dy * 0.83;
        let c = bright ? C.body : C.inner;
        if (bright && n > 0.62 && e > 0.55) c = C.rim;
        else if (n > 0.25) c = bright ? C.light : C.innerLit;
        else if (dy > 0.55) c = C.shadow;
        set(x, y, c);
      }
    }
  };
  // Its body: billows heaped all through it (faint), then its face.
  for (let i = 0; i < 90; i++) {
    const y = rng.float(-6, BASE - 4);
    const x = rng.float(0, face(Math.max(0, y)) - 12);
    const r = rng.float(10, 22);
    puff(x, y, r, r * rng.float(0.55, 0.75) * (y < 22 ? 0.7 : 1), false);
  }
  for (let y = BASE - 2; y > -12; y -= rng.float(3.5, 6)) {
    const fx = face(Math.max(0, y));
    const r = y < 22 ? rng.float(9, 15) : rng.float(6, 11);
    puff(fx - r * 0.7 + rng.float(-2, 2), y, r, r * (y < 22 ? 0.55 : 0.85), true);
    puff(fx - r * 1.9 + rng.float(-3, 3), y + rng.float(-2, 2), r * 0.8, r * 0.7, false);
  }
  // (Its base: a shelf, darker, a pale lip along it where the rain starts.)
  for (let x = 0; x < face(BASE) + 2; x++) {
    set(x, BASE, C.shadow);
    if (hashf(x, 1, 3) < 0.6) set(x, BASE + 1, C.light);
  }
  // The rain's ragged front, under the face.
  for (let y = BASE; y < H; y++) {
    const fx = face(BASE) - 6 + Math.round(Math.sin(y * 0.7) * 2);
    for (let x = fx - 4; x < fx + 2; x++) if (hashf(x, y, 9) < 0.55) set(x, y, C.rain);
  }
  const c = makeCanvas(W, H);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

function paintWreck(info) {
  const rng = new RNG(hash4(info.seed >>> 0, 0x5e2));
  // Her people on deck: where they stand (along her, from the bow), what
  // they wear; the captain at the wheel aft.
  const crew = [
    { x: 30, s: '#8a2a3a' }, { x: 48, s: '#2a4a7a' }, { x: 56, s: '#5a5a5a' }, { x: 74, s: '#c89030' }, { x: 80, s: '#3a6a3a' },
    { x: 96, s: '#2a2a3a', captain: true },
  ].map((c) => ({ ...c, hair: rng.pick(['#1e1612', '#6e4424', '#c87a3a', '#c8c8c8', '#3a2418']), skin: rng.pick(['#f4d0b0', '#d8a47c', '#b07a4a', '#8a5a34', '#e8b48c']) }));
  const ship = paintShip(false);
  const broken = paintShip(true);
  const dark = (p) => ({ back: darken(p.back), front: darken(p.front) });
  // The sea's rows, far to near (where each one's foot is).
  const rows = [];
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const y = Math.round(W_HORIZON + 1 + (PH - W_HORIZON) * Math.pow(i / N, 1.45));
    if (!rows.length || y > rows[rows.length - 1].y) rows.push({ y, ph: rng.float(0, 6.28), f: rng.float(0.9, 1.1) });
  }
  return {
    ship, broken, shipDark: dark(ship), brokenDark: dark(broken),
    wallWarm: paintWall(info.seed >>> 0, true), wallCold: paintWall(info.seed >>> 0, false),
    crew, rows,
    drops: Array.from({ length: 160 }, () => ({ x: rng.float(0, PW), y: rng.float(0, PH), v: rng.float(0.8, 1.4) })),
  };
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
  g.globalCompositeOperation = 'source-over';
  const px = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  // How far into the storm: 0 the calm evening, 1 the worst of it.
  const storm = clamp01((t - WRECK.GATHER) / (WRECK.STORM - WRECK.GATHER + 2));
  const struck = t >= WRECK.STRIKE;
  const since = t - WRECK.STRIKE;
  // Lightning: a flash now and then in the storm (the strike, the brightest).
  const flashAt = Math.floor(t * 1.3);
  const flash = (t > WRECK.STORM && hashf(flashAt, 3, 7) < 0.35 ? clamp01(1 - (t * 1.3 - flashAt) * 4) * 0.6 : 0) + (struck ? clamp01(1 - since * 1.6) * 0.9 : 0);
  // The sky: a sunset going over to storm-dark.
  const top = mix(mix('#2a2a5a', '#14161e', storm), '#b8c4e8', flash * 0.5);
  const mid = mix(mix('#b85a6a', '#20242c', storm), '#c8d0f0', flash * 0.5);
  const low = mix(mix('#f0a868', '#343a42', storm), '#e0e8ff', flash * 0.5);
  for (let i = 0; i < 12; i++) {
    const y0 = Math.floor((i / 12) * W_HORIZON);
    const y1 = Math.floor(((i + 1) / 12) * W_HORIZON);
    const k = i / 11;
    g.fillStyle = k < 0.5 ? mix(top, mid, k * 2) : mix(mid, low, (k - 0.5) * 2);
    g.fillRect(0, y0, PW, y1 - y0 + 1);
  }
  // The sun, going down behind you.
  const sunX = 214;
  if (storm < 0.9) {
    const sy = W_HORIZON - 4 + t * 0.35;
    g.globalAlpha = 1 - storm;
    g.fillStyle = 'rgba(255,200,140,0.3)';
    g.beginPath();
    g.arc(sunX, sy, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffe0a0';
    g.beginPath();
    g.arc(sunX, sy, 7, 0, Math.PI, true);
    g.fill();
    g.globalAlpha = 1;
  }
  // The Wall, ahead (left): its face coming on as you go in, till it fills
  // the sky; its billows rolling slowly; warm at first, cold in the storm.
  const reach = 112 + ease(storm) * 210;
  const wx = Math.round(reach - WALL_FACE + Math.sin(t * 0.2) * 2);
  g.drawImage(art.wallCold, wx, 0);
  if (storm < 1) {
    g.globalAlpha = 1 - storm;
    g.drawImage(art.wallWarm, wx, 0);
    g.globalAlpha = 1;
  }
  if (flash > 0.05) {
    // (Lit up from inside by the flash.)
    g.globalAlpha = flash * 0.35;
    g.globalCompositeOperation = 'lighter';
    g.drawImage(art.wallCold, wx, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
  // Silent lightning walking inside it.
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.7 + i * 0.37) % 1;
    if (k > 0.14) continue;
    const lx = hashf(i, Math.floor(t * 0.7 + i * 0.37), 5) * Math.max(30, reach - 30);
    const ly = 16 + hashf(i, Math.floor(t), 9) * (W_HORIZON - 40);
    const a = 0.45 * (1 - k / 0.14);
    const lg = g.createRadialGradient(lx, ly, 0, lx, ly, 14);
    lg.addColorStop(0, `rgba(170,160,255,${a.toFixed(3)})`);
    lg.addColorStop(1, 'rgba(120,110,200,0)');
    g.fillStyle = lg;
    g.fillRect(lx - 14, ly - 14, 28, 28);
  }
  g.globalCompositeOperation = 'source-over';
  // The ship, pitching and rolling, more as the storm grows; heeling over
  // after the strike.
  const heel = struck ? Math.min(0.3, since * 0.11) : 0;
  const ang = Math.sin(t * 1.1) * (0.025 + storm * 0.08) + heel;
  const bob = Math.sin(t * 0.9) * (1 + storm * 2.5) + (struck ? since * 1.6 : 0);
  const sx = 72;
  const sy = 106 + bob;
  // The sea, in rows from the horizon toward you (each row's waves over
  // the one behind it), the swell growing in the storm, white caps on it;
  // the sun's path on the crests. Those behind her first.
  const seaRows = (front) => {
    const R = art.rows;
    for (let i = 0; i < R.length - 1; i++) {
      const row = R[i];
      const isFront = row.y >= sy - 1;
      if (isFront !== front) continue;
      const nextY = R[i + 1].y;
      const dz = (row.y - W_HORIZON) / (PH - W_HORIZON);
      const body = mix(mix(mix('#3a4a7a', '#1a2430', storm), '#16203a', dz * 0.7), '#90a0c0', flash * 0.35);
      const deep = shade(body, -14);
      const crest = mix(mix('#6a7ab0', '#3a4a5c', storm), '#c8d4f0', flash * 0.4);
      const lip = mix(crest, '#ffffff', 0.35);
      const glint = '#ffd8a0';
      const amp = (0.8 + dz * 3.4) * (0.5 + storm * 1.5);
      const fr = (0.11 - dz * 0.06) * row.f;
      const sp = 1.2 + storm * 1.8;
      const dark = front && row.y < sy + 12 ? mix(body, '#080a14', 0.35 * (1 - (row.y - sy) / 12)) : null;
      for (let x = 0; x < PW; x++) {
        const w = 0.5 + 0.5 * Math.sin(x * fr + row.ph + t * sp) * 0.75 + 0.5 * 0.25 * Math.sin(x * fr * 2.3 - t * sp * 0.7 + row.ph);
        const peak = Math.pow(w, 1 + storm * 1.5);
        const cy = Math.round(row.y - amp * peak);
        const under = dark && x > sx + 18 && x < sx + 108;
        g.fillStyle = under ? dark : body;
        g.fillRect(x, cy, 1, nextY - cy + 1);
        // (The lit face of the wave, the crest, foam on the tallest.)
        px(x, cy, peak > 0.82 && storm > 0.35 ? '#dfe8f4' : peak > 0.6 ? lip : crest);
        if (nextY - cy > 2) px(x, nextY, deep);
        if (storm < 0.85 && Math.abs(x - sunX - Math.sin(row.y * 1.7 + t * 2) * (1 + dz * 6)) < 1 + dz * 5 && peak > 0.4) {
          g.globalAlpha = (1 - storm) * 0.9;
          px(x, cy, glint);
          g.globalAlpha = 1;
        }
      }
    }
  };
  seaRows(false);
  g.save();
  g.translate(sx + SHIP.w / 2, sy);
  g.rotate(ang);
  // (Darkening as the storm closes in; lit up by the lightning.)
  const lit = clamp01(1 - storm * 0.85 + flash);
  const S0 = struck ? art.brokenDark : art.shipDark;
  const S1 = struck ? art.broken : art.ship;
  const ox = -SHIP.w / 2;
  const oy = -SHIP.water;
  g.drawImage(S0.back, ox, oy);
  g.globalAlpha = lit;
  g.drawImage(S1.back, ox, oy);
  g.globalAlpha = 1;
  // Her people on deck, behind her rail: at their work in the calm, running
  // in the storm, the captain at the wheel.
  const spx = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  for (const c of art.crew) {
    const run = c.captain ? 0 : storm > 0.3 ? Math.sin(t * 2.4 + c.x) * 9 * storm : Math.sin(t * 0.4 + c.x) * 2;
    const x = Math.max(24, Math.min(c.captain ? 104 : 84, c.x + run));
    const moving = !c.captain && storm > 0.3;
    drawPerson(spx, ox + x, oy + sheer(Math.round(x)) + 3, { size: 'tiny', pose: moving ? 'run' : 'stand', frame: Math.floor(t * 8 + c.x), shirt: lit < 0.5 ? shade(c.s, -40) : c.s, hair: c.hair, skin: lit < 0.5 ? shade(c.skin, -60) : c.skin });
  }
  g.drawImage(S0.front, ox, oy);
  g.globalAlpha = lit;
  g.drawImage(S1.front, ox, oy);
  g.globalAlpha = 1;
  // The main course burning (after the strike): flames up the canvas,
  // sparks, smoke torn off it.
  if (struck) {
    const mainX = ox + MASTS.main;
    for (let i = 0; i < 30; i++) {
      const fx = mainX - 14 + ((i * 7) % 29);
      const fy0 = oy + 36 + ((i * 5) % 15);
      const hgt = 3 + Math.abs(Math.sin(t * 9 + i)) * 7 * Math.min(1, since * 1.5);
      for (let k = 0; k < hgt; k++) {
        const f = k / hgt;
        g.fillStyle = f < 0.25 ? '#fff0a0' : f < 0.6 ? '#ffa030' : '#e84a14';
        g.globalAlpha = 0.95 - f * 0.3;
        g.fillRect(Math.round(fx + Math.sin(t * 12 + i + k) * 0.7 - k * 0.15), Math.round(fy0 - k), 1, 1);
      }
    }
    for (let i = 0; i < 8; i++) {
      const k = (since * 0.8 + i / 8) % 1;
      g.globalAlpha = 1 - k;
      g.fillStyle = i % 2 ? '#ffd070' : '#ff8030';
      g.fillRect(Math.round(mainX + Math.sin(i * 3.1 + t * 2) * 10 - k * 16), Math.round(oy + 34 - k * 26), 1, 1);
    }
    for (let i = 0; i < 7; i++) {
      const k = (since * 0.4 + i / 7) % 1;
      g.globalAlpha = 0.55 * (1 - k);
      g.fillStyle = k < 0.3 ? '#4a4240' : '#2e2a2a';
      const r = 2 + Math.round(k * 3);
      g.fillRect(Math.round(mainX + Math.sin(i * 2 + t) * 4 - k * 26), Math.round(oy + 30 - k * 30), r, r);
    }
    g.globalAlpha = 1;
  }
  g.restore();
  // The sea in front of her (over her hull below the water), and the foam
  // along her side where the waves meet it.
  seaRows(true);
  g.globalAlpha = 0.5 + storm * 0.4;
  const hullX0 = sx + SHIP.w / 2 + (20 - SHIP.w / 2) * Math.cos(ang);
  const hullX1 = sx + SHIP.w / 2 + (104 - SHIP.w / 2) * Math.cos(ang);
  for (let x = Math.round(hullX0); x < hullX1; x++) if (hashf(x, Math.floor(t * 6), 2) < 0.55) px(x, Math.round(sy) - 1 + (hashf(x, 3, Math.floor(t * 4)) < 0.3 ? -1 : 0), '#e8f0ff');
  g.globalAlpha = 1;
  // Her bow wave, and spray off it in heavy seas.
  for (let i = 0; i < 4 + Math.round(storm * 10); i++) {
    const k = (t * (1.2 + storm) + i / (4 + storm * 10)) % 1;
    g.globalAlpha = (1 - k) * (0.5 + storm * 0.5);
    px(sx + 22 - k * (6 + storm * 10) + Math.sin(i * 1.7) * 2, sy - 2 - Math.sin(k * Math.PI) * (2 + storm * 12), '#e8f0ff');
  }
  g.globalAlpha = 1;
  // A bolt: down out of the cloud, forking, a white core, a blue glow
  // round it.
  const boltTo = (x0, x1, y1, alpha, seed) => {
    const pts = [];
    let x = x0;
    for (let y = BAR / 2; y < y1; y++) {
      x += (hashf(y, seed, 3) - 0.5) * 2.4 + (x1 - x) * 0.07;
      pts.push([x, y]);
    }
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = alpha * 0.35;
    g.fillStyle = '#8090ff';
    for (const [bx, by] of pts) g.fillRect(Math.round(bx) - 1, by, 3, 1);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = alpha;
    g.fillStyle = '#ffffff';
    for (const [bx, by] of pts) g.fillRect(Math.round(bx), by, 1, 1);
    // (A fork or two off it.)
    for (const at of [0.35, 0.6]) {
      const [fx0, fy0] = pts[Math.floor(pts.length * at)] || pts[0];
      let fx = fx0;
      for (let k = 0; k < 10; k++) {
        fx += (hashf(k, seed + at * 10, 5) - 0.3) * 2;
        g.globalAlpha = alpha * (1 - k / 10);
        g.fillRect(Math.round(fx), Math.round(fy0 + k), 1, 1);
      }
    }
    g.globalAlpha = 1;
  };
  if (struck && since < 0.5) boltTo(sx + MASTS.main - 6, sx + MASTS.main, sy - SHIP.water + 27, 1 - since * 1.8, Math.floor(t * 12));
  // Others out over the sea, in the storm.
  if (t > WRECK.STORM && t < WRECK.BLACK && flash > 0.2 && !struck) boltTo(20 + hashf(flashAt, 1, 2) * 200, 20 + hashf(flashAt, 4, 2) * 200, W_HORIZON, flash, flashAt);
  // The rain: slanting, thicker as it worsens.
  if (t > WRECK.GATHER) {
    const n = Math.round(art.drops.length * storm);
    g.fillStyle = 'rgba(200,214,240,0.5)';
    for (let i = 0; i < n; i++) {
      const d = art.drops[i];
      const y = (d.y + t * 160 * d.v) % PH;
      const x = (d.x - t * 60 * d.v + 400) % PW;
      g.fillRect(Math.round(x), Math.round(y), 1, 2);
      g.fillRect(Math.round(x) - 1, Math.round(y) + 2, 1, 2);
    }
  }
  // (The strike: everything lit blue-white for a moment.)
  if (struck && since < 0.3) {
    g.globalAlpha = 0.45 * (1 - since / 0.3);
    g.fillStyle = '#e8eeff';
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
