// A fallen star (the "Fallen Star" origin: see hero.js).
//
// Where you come down: a crater of scorched earth in the hills a little
// way out from one of Thessa's villages.
//
// How the story opens: a painted scene, seen from that village on a clear
// night. Its people are out in the lane, looking up at a new star that
// isn't where any star should be. It grows, slowly at first; it comes down
// behind the hills; the light of it turns night to day; and the shockwave
// comes rolling across the fields and the roofs and knocks them flat. Then
// black, and what you remember. (A scene like any other, see scenes.js: on
// a player's own screen in a world with others, as the host plays it.)
//
// And when it strikes, in a world with others already playing, they feel
// it: everyone on Thessa sees the flash and is shaken by the blast (see
// starShockwave).
//
// What it means after: a single wing at your back, blue and faintly lit,
// like a dragon's (see render/wing.js), which can carry you through a
// second roll when you've no breath for it (combat.js), and townsfolk who
// aren't sure what to make of you (some of them are wary: starWary).
import { VIEW_W, VIEW_H, CHAR_W, GROUND } from '../config.js';
import { B, BLOCKS } from '../world/blocks.js';
import { RNG, hash4, hashf } from '../util/rng.js';
import { drawText } from '../render/font.js';
import { wrap } from '../ui/ascii.js';
import { drawPerson, drawHouse, drawTree, shade } from '../render/scenekit.js';

export const STAR_IMPACT = 15;
const STAR_BLACK = 20.5;
const LINE_T = 2.5;

// ------------------------------------------------------------ where
// A spot out in the country near one of Thessa's villages (`salt`: whose
// fall it is, so two players' don't land on each other): { x, z, sid,
// village }, or null if there's nowhere.
export function starSpot(game, salt = 0) {
  const ow = game.world.ow;
  const thessa = ow.islands[0];
  const villages = ow.settlements.filter((s) => s.type === 'village' && s.condition !== 'abandoned' && !s.deserted && s.island === thessa.key);
  const towns = villages.length ? villages : ow.settlements.filter((s) => s.condition !== 'abandoned' && !s.deserted && s.island === thessa.key && s.type !== 'camp');
  if (!towns.length) return null;
  const rng = new RNG(hash4(game.seed >>> 0, salt >>> 0, 0x57a2));
  const order = rng.shuffle(towns.slice());
  for (const s of order.slice(0, 6)) {
    const L = game.world.getLayout(s);
    const cx = L ? L.plaza.cx : Math.floor(s.cx + s.cw / 2);
    const cz = L ? L.plaza.cz : Math.floor(s.cz + s.cd / 2);
    const a0 = rng.float(0, Math.PI * 2);
    for (let i = 0; i < 12; i++) {
      const a = a0 + (i / 12) * Math.PI * 2;
      const d = 26 + rng.int(0, 10);
      const x = Math.round(cx + Math.cos(a) * d);
      const z = Math.round(cz + Math.sin(a) * d * 0.8);
      game.loadAround(x, z, true);
      if (ow.settlementAt(x, z)) continue;
      if (ow.islandAt && ow.islandAt(x, z) !== thessa.key) continue;
      const y = game.world.findStandY(x, z, GROUND);
      if (y <= 0 || game.world.isWaterAt(x, y, z) || game.world.isWaterAt(x, y - 1, z)) continue;
      // (Open ground: no water close about it.)
      let wet = false;
      for (const [ox, oz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (game.world.isWaterAt(x + ox, game.world.findStandY(x + ox, z + oz, y) - 1, z + oz)) wet = true;
      if (wet) continue;
      return { x, z, sid: s.id, village: s.name };
    }
  }
  return null;
}

// The crater: the ground scorched black round where you lay, ash at the
// heart of it, the grass and bushes burned off.
export function makeCrater(game, x, z) {
  const w = game.world;
  const ash = B.ash ?? B.gravel;
  const scorched = B.scorched ?? B.dirt;
  for (let dz = -4; dz <= 4; dz++) {
    for (let dx = -4; dx <= 4; dx++) {
      const r = Math.hypot(dx, dz * 1.1);
      if (r > 4.2) continue;
      const ux = x + dx;
      const uz = z + dz;
      const y = w.findStandY(ux, uz, GROUND);
      if (y <= 0) continue;
      const under = w.getBlock(ux, y - 1, uz);
      const b = BLOCKS[under];
      if (!b || !b.solid || b.interact || w.isWaterAt(ux, y - 1, uz)) continue;
      // (Whatever grew there, burned away.)
      const top = BLOCKS[w.getBlock(ux, y, uz)];
      if (top && top.render === 'plant') w.setBlock(ux, y, uz, B.air);
      if (r < 1.5) w.setBlock(ux, y - 1, uz, ash);
      else if (r < 3.2 || hashf(ux, uz, 0x5c0) < 0.5) w.setBlock(ux, y - 1, uz, scorched);
    }
  }
}

// ------------------------------------------------------------ who's wary
// Some folk don't trust a thing that fell out of the sky: the superstitious
// and the gloomy always, and about one in three of the rest. (Always the
// same ones.)
export function starWary(rec, sid) {
  const q = (rec && rec.traits) || [];
  if (q.includes('superstitious') || q.includes('gloomy')) return true;
  if (q.includes('curious') || q.includes('romantic')) return false;
  return hashf(rec ? rec.idx | 0 : 0, sid | 0, 0x5a9) < 0.34;
}

export const isStar = (hero) => !!hero && hero.origin === 'star';

// What they say when you walk up (now and then: see dialogue.js).
export function starGreeting(rec, sid, rng) {
  const pick = (list) => list[Math.floor(rng() * list.length)];
  if (rec.age === 'child') return pick(['Is that a real wing? Can you fly? Show me!', 'Mum says you fell out of the sky. Did it hurt?', 'Is that a dragon\'s wing? Can I touch it?']);
  if (starWary(rec, sid)) return pick(['Keep that wing away from me.', 'You\'re the one that came down out of the sky. I want no part of whatever you are.', 'A wing on a person isn\'t natural. What do you want?', 'Stay where I can see you, star-thing.']);
  return pick(['The one who fell from the sky! I saw the light of it from my window.', 'That wing... so the stories are true. Hello.', 'You came down like the sun rising. Are you well?', 'Folk say you\'re a star that fell. I\'m glad you landed softly, at least.']);
}

// Asked about your wing.
export function wingTalk(rec, sid) {
  if (rec.age === 'child') return ['It\'s so blue! It glows a bit in the dark, did you know?', 'If I find a star, will I get a wing too?'];
  if (starWary(rec, sid)) return ['I\'d rather not talk about it.', 'My grandmother said things that fall from the sky bring trouble with them. I hope she was wrong.'];
  return ['It shines a little, even in daylight. Like it remembers where it came from.', 'They say the old priests wrote of stars that walked. I never thought I\'d meet one.'];
}

// ------------------------------------------------------------ the shock
// The star strikes Thessa: everyone on the island (but the one falling)
// sees the flash and feels the shockwave, the harder the nearer; those
// near enough see the blast itself, and the village nearby is up in arms.
export function starShockwave(game, at) {
  const ow = game.world.ow;
  const isle = ow.islandAt ? ow.islandAt(at.x, at.z) : null;
  const r = game.renderer;
  // The blast, where it lands (seen by whoever's near).
  r.effect?.({ type: 'ring', wx: at.x, wy: at.y ?? GROUND, wz: at.z, r0: 4, r1: 150, color: ['#fff4d0', '#ffe7a0', '#ffffff'], life: 1.4, oy: 2, flat: 0.5, thick: 3 });
  r.effect?.({ type: 'ring', wx: at.x, wy: at.y ?? GROUND, wz: at.z, r0: 2, r1: 90, color: ['#ffffff', '#c8e0ff'], life: 1.0, oy: 2, flat: 0.5, thick: 2 });
  r.emit(at.x, (at.y ?? GROUND) + 0.5, at.z, { n: 40, color: ['#fffaf0', '#ffe7a0', '#ffb060', '#ffffff'], up: 60, speed: 80, life: 1.2, gravity: 40, glow: true });
  r.emit(at.x, (at.y ?? GROUND) + 0.5, at.z, { n: 20, color: ['#6a5a48', '#4a3e32', '#8a7a64'], up: 30, speed: 60, life: 1.6, gravity: 30, shape: 'puff', grow: 2 });
  for (const q of game.everyone()) {
    if (!q || q.dead || q.limbo || q === at.who) continue;
    if (game.world.inInstance && game.world.inInstance(q.x)) continue;
    if (isle && ow.islandAt && ow.islandAt(q.x, q.z) !== isle) continue;
    game.asPlayer(q, () => {
      const d = Math.hypot(q.x - at.x, q.z - at.z);
      const k = Math.max(0.25, Math.min(1, 1 - d / 500));
      game.shake = Math.max(game.shake || 0, 0.5 + 1.1 * k);
      game.renderer.flashScreen?.('#fff4d8', 0.2 + 0.4 * k);
      game.audio?.play('boom');
      game.audio?.play('thunder');
      game.ui.msg(d < 30
        ? 'A star falls out of the sky and strikes the ground right beside you! The blast of it throws you off your feet.'
        : `A falling star streaks over the sky and strikes the ground ${compass(at.x - q.x, at.z - q.z)} of you. A moment later the shockwave rolls over you.`, '#ffe7a0');
    });
  }
  // The village it came down by: everyone out, pointing.
  for (const n of game.npcs || []) {
    if (n.dead || n.sleeping || Math.abs(n.x - at.x) > 60 || Math.abs(n.z - at.z) > 60) continue;
    n.emoteShow?.('!', '#ffe070', 2.5);
    if (Math.random() < 0.35) n.say?.(['What was that?!', 'Something fell from the sky!', 'Did you see that light?', 'The ground shook!'][Math.floor(Math.random() * 4)], 3, '#ffffff');
  }
}

// Which way (dx, dz) points, in words.
function compass(dx, dz) {
  const a = Math.atan2(-dz, dx);
  const names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  return `to the ${names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]}`;
}

// ------------------------------------------------------------ the scene
// The opening scene. `info`: { village, first, at } (`at`: where it lands,
// for the shockwave others feel). `act(game)` is called as it strikes
// (the host's: see Game.starShock).
export function starfallScene(game, info = {}) {
  const village = info.village || 'the village';
  const first = info.first || String(game.playerName || '').split(' ')[0] || 'Wanderer';
  const words = [
    'You remember the cold up there, and the long quiet between the stars.',
    'Then the falling: the air catching fire around you, the ground rushing up.',
    'When the light faded you were lying in a crater of scorched earth, with one wing at your back: blue, and thin as a dragon\'s, and faintly shining.',
    `You don't know why you fell, or what you were before. The people of ${village} saw you come down.`,
    `${first}. That is the name you remember. It will have to do.`,
  ];
  const dur = STAR_BLACK + words.length * LINE_T + 3;
  // (Painted the first time it's drawn: never, on a host that only runs it.)
  const seed = hash4(game.seed >>> 0, first.length, 0x57a);
  let art = null;
  return {
    kind: 'starfall', intro: true, t: 0, dur, lock: true, village, first, at: info.at || null, words,
    get mood() {
      // (Its own music: a celesta and a choir as it falls; the blow, and a
      // music box alone in the dark. See music.js.)
      return this.t < STAR_IMPACT ? 'cs_starfall' : 'cs_starfall_dark';
    },
    act: info.act || null,
    update(g, dt, pressed) {
      // ENTER: on to waking (the star still lands first).
      if (pressed && pressed.some((k) => k.code === 'Enter' || k.code === 'NumpadEnter')) {
        if (!this.struck) this.strike(g);
        this.t = this.dur;
        return;
      }
      if (!this.started) {
        this.started = true;
        g.audio?.play('drone');
      }
      if (this.t > 9 && !this.rumble) {
        this.rumble = true;
        g.audio?.play('wind');
      }
      if (this.t >= STAR_IMPACT && !this.struck) this.strike(g);
    },
    strike(g) {
      this.struck = true;
      g.audio?.play('boom');
      g.audio?.play('thunder');
      g.audio?.play('crumble');
      g.shake = 1.4;
      if (this.act) this.act(g);
    },
    end(g) {
      g.ui.fade = Math.max(g.ui.fade || 0, 1.6);
      if (g.introduceStar) g.introduceStar(this.village);
    },
    draw(ctx) {
      if (!art) art = paintBackdrop(seed);
      drawScene(ctx, this, art);
    },
  };
}

// ------------------------------------------------------------ painting
// The picture is painted at half size (each of its pixels two on the
// screen): the sky, its stars, the hills, the village and its people.
const PW = VIEW_W / 2;
const PH = VIEW_H / 2;
const HORIZON = 82;
// Where it comes from and where it lands (behind the far hills).
const FROM = { x: 30, y: 6 };
const LAND = { x: 196, y: 76 };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// What doesn't move, painted once, in layers (so what happens behind the
// hills stays behind them): the sky; the far hills; and the land before
// them (the nearer slope, the fields, the lane and the village along it).
function paintBackdrop(seed) {
  const rng = new RNG(seed);
  const layer = () => {
    const c = makeCanvas(PW, PH);
    const g = c.getContext('2d');
    return [c, g, (x, y, col) => {
      g.fillStyle = col;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }];
  };
  const [sky, , spx] = layer();
  const [far, , fpx] = layer();
  const [land, g, px] = layer();
  // The night sky, in bands, dithered where they meet.
  const bands = ['#060818', '#0a0d24', '#0f1430', '#151a3c', '#1d2148', '#272653', '#33295a'];
  for (let y = 0; y < PH; y++) {
    const f = Math.min(1, y / (HORIZON + 10)) * (bands.length - 1);
    const i = Math.min(bands.length - 1, Math.floor(f));
    const fr = f - i;
    for (let x = 0; x < PW; x++) spx(x, y, (x + y) % 2 === 0 && fr > 0.5 ? bands[Math.min(bands.length - 1, i + 1)] : bands[i]);
  }
  // A ridge of hills: its crest lit faintly by the sky, a few dark trees
  // along it.
  const ridge = (p, base, amp, f1, f2, col, edge, trees) => {
    for (let x = 0; x < PW; x++) {
      const h = Math.round(base - amp * (0.6 * Math.sin(x * f1 + seed) + 0.4 * Math.sin(x * f2 + seed * 1.7)));
      for (let y = h; y < PH; y++) p(x, y, y > h + 1 && hashf(x, y, seed & 255) < 0.06 ? shade(col, -6) : col);
      p(x, h, edge);
      if (trees && hashf(x, 0, seed & 511) < 0.07) for (let k = 1; k < 4; k++) for (let d = -1; d <= 1; d++) if (Math.abs(d) < 4 - k) p(x + d, h - k, shade(col, 4));
    }
  };
  ridge(fpx, HORIZON, 7, 0.031, 0.083, '#141a2c', '#222c48', true);
  ridge(px, HORIZON + 14, 5, 0.045, 0.11, '#16231e', '#24382c', true);
  // The near ground: dark grass.
  for (let y = HORIZON + 24; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const n = hashf(x, y, seed & 1023);
      px(x, y, n < 0.12 ? '#1e3a24' : n < 0.2 ? '#14281a' : '#183020');
    }
  }
  // (The lane, toward you: its edges ragged, ruts down it.)
  for (let y = HORIZON + 22; y < PH; y++) {
    const w = 5 + Math.round((y - HORIZON - 22) * 0.62);
    for (let x = 124 - w - 1; x <= 124 + w; x++) {
      const edge = x === 124 - w - 1 || x === 124 + w;
      if (edge && hashf(x, y, 76) < 0.5) continue;
      const rut = Math.abs(x - 124 + w * 0.4) < 1 || Math.abs(x - 124 - w * 0.4) < 1;
      px(x, y, rut ? '#3a3226' : hashf(x, y, 77) < 0.2 ? '#3e3628' : '#4a4030');
    }
  }
  // The houses of the village along the lane, three-quarters on: timber
  // and thatch, their windows lit, a little of their light out on the
  // ground before them. The back ones first, smaller.
  const house = (x0, yb, w, h, roof, wall, lit) => {
    if (lit) {
      const lg = g.createRadialGradient(x0 + w / 2, yb + 2, 0, x0 + w / 2, yb + 2, w * 0.8);
      lg.addColorStop(0, 'rgba(255,190,100,0.22)');
      lg.addColorStop(1, 'rgba(255,190,100,0)');
      g.fillStyle = lg;
      g.fillRect(x0 - w, yb - 6, w * 3, 16);
    }
    drawHouse(g, px, x0, yb, w, h, { wall, roof, timber: '#2e2016', shape: 'steep', night: 1, lit, glow: '#ffcc6a', chimney: true, door: '#2a1c12', rh: Math.round(w * 0.42) });
  };
  const back = [[40, HORIZON + 20, 16, 8], [64, HORIZON + 19, 13, 7], [150, HORIZON + 20, 15, 8], [174, HORIZON + 21, 18, 9], [210, HORIZON + 20, 14, 8]];
  for (const [x, y, w, h] of back) house(x, y, w, h, '#4a3c28', '#3a3024', rng.chance(0.6));
  const front = [[14, HORIZON + 44, 28, 15, '#7a6438', '#6a5038'], [68, HORIZON + 40, 24, 13, '#6e5a32', '#5e4630'], [154, HORIZON + 41, 26, 14, '#7a6438', '#6a5038'], [196, HORIZON + 46, 30, 16, '#6e5a32', '#5e4630']];
  for (const [x, y, w, h, roof, wall] of front) house(x, y, w, h, roof, wall, true);
  // A well by the lane: its stone ring, the roof over it on two posts.
  const wx = 166;
  const wy = HORIZON + 48;
  for (let y = wy - 5; y < wy; y++) for (let x = wx; x < wx + 8; x++) px(x, y, y === wy - 5 ? '#6a6a70' : (x + y) % 3 === 0 ? '#3e3e44' : x < wx + 2 ? '#5a5a60' : '#4a4a50');
  for (let x = wx + 1; x < wx + 7; x++) px(x, wy - 5, '#1a1a20');
  for (let y = wy - 12; y < wy - 4; y++) {
    px(wx, y, '#4a3a22');
    px(wx + 7, y, '#3a2a18');
  }
  for (let i = 0; i < 3; i++) for (let x = wx - 2 + i; x < wx + 10 - i; x++) px(x, wy - 12 - i, i === 2 ? '#5a4a2e' : '#4a3c24');
  px(wx + 3, wy - 9, '#2a1e14');
  // A fence along the right, and a tree at the left edge.
  for (let x = 236; x < PW; x++) {
    if (x % 6 === 0) for (let y = HORIZON + 48; y < HORIZON + 55; y++) px(x, y, x % 12 === 0 ? '#4a3a22' : '#3a2c1a');
    px(x, HORIZON + 50, '#5a4a2e');
    px(x, HORIZON + 53, '#4a3a22');
  }
  drawTree(g, px, 6, HORIZON + 30, 2.6, { leaf: '#1e3e24', leafDark: '#122a18', trunk: '#2a1e14', tree: 'round' });
  return {
    sky, far, land,
    stars: Array.from({ length: 110 }, (_, i) => ({ x: rng.int(0, PW - 1), y: rng.int(0, HORIZON - 4), b: rng.float(0.3, 1), ph: rng.float(0, 6.28), i })),
    folk: villagers(rng),
  };
}

// The villagers out in the lane, looking up: where they stand, what they
// wear, and which of them points.
function villagers(rng) {
  const out = [];
  // (Clear of the letterbox along the bottom.)
  const spots = [[96, 118], [104, 123], [116, 114], [132, 120], [142, 115], [150, 124], [88, 126], [126, 127], [160, 119]];
  for (const [x, y] of spots) {
    out.push({
      x, y,
      shirt: rng.pick(['#8f2f3a', '#2f6f8f', '#3a7a3a', '#7a5a2a', '#5a3a7a', '#c8a030', '#e0dccc']),
      skin: rng.pick(['#f4d0b0', '#d8a47c', '#b07a4a', '#8a5a34', '#e8b48c']),
      hair: rng.pick(['#1e1612', '#6e4424', '#c87a3a', '#c8c8c8', '#3a2418']),
      small: rng.chance(0.25),
      points: rng.chance(0.35),
      look: rng.float(0, 0.8),
    });
  }
  return out;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Where the star is at time t (0..1 of its fall: slow, then faster).
function starAt(k) {
  const e = k * k;
  return { x: FROM.x + (LAND.x - FROM.x) * e, y: FROM.y + (LAND.y - FROM.y) * e - Math.sin(e * Math.PI) * 6 };
}

function drawScene(ctx, sc, art) {
  const t = sc.t;
  const c = drawScene.buf || (drawScene.buf = makeCanvas(PW, PH));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.drawImage(art.sky, 0, 0);
  const fall = clamp01((t - 2.5) / (STAR_IMPACT - 2.5));
  const after = t - STAR_IMPACT;
  const pre = t < STAR_IMPACT;
  // The star's light on everything as it comes (brighter and brighter),
  // and then the blast: day for a moment, fading.
  const glow = pre ? fall * fall * 0.5 : Math.max(0, 0.9 - after * 0.25);
  // The stars, twinkling (washed out by the light).
  for (const s of art.stars) {
    const a = s.b * (0.6 + 0.4 * Math.sin(t * 2 + s.ph)) * (1 - glow);
    if (a < 0.08) continue;
    g.globalAlpha = a;
    g.fillStyle = s.i % 9 === 0 ? '#c8d8ff' : '#ffffff';
    g.fillRect(s.x, s.y, 1, 1);
  }
  g.globalAlpha = 1;
  // The star itself and its tail.
  if (pre && t > 2.5) {
    const p = starAt(fall);
    const tail = 6 + fall * 40;
    const back = starAt(Math.max(0, fall - 0.08 - fall * 0.1));
    const dx = p.x - back.x;
    const dy = p.y - back.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    for (let i = 0; i < tail; i++) {
      const f = i / tail;
      const x = p.x - (dx / len) * i * 0.9 + Math.sin(i * 0.9 + t * 8) * f * 0.8;
      const y = p.y - (dy / len) * i * 0.9;
      g.globalAlpha = (1 - f) * 0.85;
      g.fillStyle = f < 0.2 ? '#ffffff' : f < 0.5 ? '#fff0b8' : '#ffb060';
      g.fillRect(Math.round(x), Math.round(y), 1 + (f < 0.3 && fall > 0.5 ? 1 : 0), 1);
    }
    // Its halo.
    const r = 3 + fall * 14;
    const hg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    hg.addColorStop(0, 'rgba(255,255,255,0.95)');
    hg.addColorStop(0.3, 'rgba(255,240,190,0.55)');
    hg.addColorStop(1, 'rgba(255,200,120,0)');
    g.globalAlpha = 1;
    g.fillStyle = hg;
    g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    g.fillStyle = '#ffffff';
    g.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1);
    g.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
    // (Sparks shed off it.)
    for (let i = 0; i < 6; i++) {
      const k = ((t * 1.7 + i / 6) % 1);
      g.globalAlpha = (1 - k) * fall;
      g.fillStyle = i % 2 ? '#ffd070' : '#ffffff';
      g.fillRect(Math.round(p.x - dx / len * k * 20 + Math.sin(i * 3 + t) * 4 * k), Math.round(p.y - dy / len * k * 20 + k * 6), 1, 1);
    }
    g.globalAlpha = 1;
  }
  // The shockwave: a dome of light swelling up out of the hills behind
  // them (the hills in front of its foot), its edge bright.
  if (!pre && after < 3.6) {
    const R = after * 120;
    g.globalAlpha = Math.max(0, 0.9 - after * 0.25);
    const dg = g.createRadialGradient(LAND.x, LAND.y, Math.max(0, R * 0.6), LAND.x, LAND.y, R + 1);
    dg.addColorStop(0, 'rgba(255,250,230,0)');
    dg.addColorStop(0.85, 'rgba(255,240,200,0.6)');
    dg.addColorStop(1, 'rgba(255,255,255,0.95)');
    g.fillStyle = dg;
    g.beginPath();
    g.ellipse(LAND.x, LAND.y, R, R * 0.55, 0, 0, Math.PI * 2);
    g.fill();
    // (Its edge: a white line, racing outward.)
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(LAND.x, LAND.y, R, R * 0.55, 0, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
  }
  // The hills, and the land and the village before them.
  g.drawImage(art.far, 0, 0);
  g.drawImage(art.land, 0, 0);
  // The light it throws over the land: warm, from where it is.
  if (glow > 0.01) {
    const p = pre ? starAt(fall) : LAND;
    const lg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, pre ? 220 : 300);
    lg.addColorStop(0, `rgba(255,236,190,${(glow * 0.8).toFixed(3)})`);
    lg.addColorStop(1, `rgba(255,200,150,${(glow * 0.15).toFixed(3)})`);
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = lg;
    g.fillRect(0, 0, PW, PH);
    g.globalCompositeOperation = 'source-over';
  }
  if (!pre) {
    // Then the dust wave, rolling over the village (from the far hills to
    // the front of the picture).
    const front = HORIZON + after * 30;
    if (after < 5) {
      for (let x = 0; x < PW; x++) {
        const top = Math.round(front - 6 - 4 * Math.abs(Math.sin(x * 0.11 + after * 3)));
        const thick = 8 + Math.round(4 * Math.sin(x * 0.07 + after));
        for (let y = top; y < top + thick; y++) {
          if (y < 0 || y >= PH) continue;
          g.globalAlpha = 0.85 * (1 - (y - top) / thick) * Math.max(0, 1 - after / 5);
          g.fillStyle = hashf(x, y, Math.floor(after * 10)) < 0.5 ? '#c8b08a' : '#a89070';
          g.fillRect(x, y, 1, 1);
        }
      }
      g.globalAlpha = 1;
    }
  }
  // The people in the lane: looking up at it (their heads turned toward
  // it), some pointing; knocked flat as the wave passes them.
  const fp = pre ? starAt(fall) : LAND;
  for (const f of art.folk) {
    const hitAt = (f.y - HORIZON) / 30;
    const down = !pre && after > hitAt;
    drawFolk(g, f, fp, down, t, glow);
  }
  // A child's voice: what they shout.
  if (t > 9.5 && t < 13.5) {
    const f = art.folk[2];
    g.globalAlpha = Math.min(1, (t - 9.5) * 3, (13.5 - t) * 3);
    drawText(g, "It's coming down!", f.x - 30, f.y - 22, '#ffffff', '#000');
    g.globalAlpha = 1;
  }
  // (Day, for a moment.)
  if (!pre && after < 1.2) {
    g.globalAlpha = Math.max(0, 1 - after / 1.2);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, PW, PH);
    g.globalAlpha = 1;
  }
  // To the screen, twice the size, shaken by the blast.
  const shakeK = !pre ? Math.max(0, 1 - after / 2.2) : fall > 0.85 ? (fall - 0.85) * 2 : 0;
  const ox = Math.round((Math.random() - 0.5) * 8 * shakeK);
  const oy = Math.round((Math.random() - 0.5) * 6 * shakeK);
  const fadeIn = clamp01(t / 1.2);
  const black = clamp01((t - (STAR_BLACK - 1.5)) / 1.5);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (black < 1) {
    ctx.globalAlpha = fadeIn * (1 - black);
    ctx.drawImage(c, 0, 0, PW, PH, ox - 4, oy - 4, VIEW_W + 8, VIEW_H + 8);
  }
  ctx.globalAlpha = 1;
  // The letterbox, and what's told.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, 22);
  ctx.fillRect(0, VIEW_H - 22, VIEW_W, 22);
  const cap = t > 1.5 && t < 6.5 ? `Night over ${sc.village}, on Thessa.` : t > 6.5 && t < 12.5 ? 'A new star is falling. The whole village has come out to watch it.' : t > STAR_IMPACT + 1.4 && t < STAR_BLACK - 1 ? 'It strikes the hills beyond the village. The ground shakes for miles around.' : null;
  if (cap && black < 1) {
    ctx.globalAlpha = 1 - black;
    drawText(ctx, cap, Math.round(VIEW_W / 2 - (cap.length * CHAR_W) / 2), VIEW_H - 15, '#f4ecd8', '#000');
    ctx.globalAlpha = 1;
  }
  drawText(ctx, 'ENTER skip', VIEW_W - 10 * CHAR_W - 6, 8, '#5a5040');
  // In the dark, what you remember.
  if (t > STAR_BLACK) {
    const s = t - STAR_BLACK;
    let y = VIEW_H / 2 - sc.words.length * 11;
    sc.words.forEach((txt, i) => {
      const a = clamp01((s - i * LINE_T) / 1.0);
      const ls = wrap(txt, 74);
      if (a > 0) {
        ctx.globalAlpha = a;
        for (const l of ls) drawText(ctx, l, Math.round(VIEW_W / 2 - (l.length * CHAR_W) / 2), Math.round(y + ls.indexOf(l) * 10), i === sc.words.length - 1 ? '#ffe7a0' : '#e8d8b0');
      }
      y += ls.length * 10 + 6;
    });
    ctx.globalAlpha = 1;
    // (A single blue spark of it, drifting down past the words.)
    const fk = (s * 0.12) % 1;
    const fx = Math.round(VIEW_W * 0.8 + Math.sin(s) * 10);
    const fy = Math.round(fk * VIEW_H);
    ctx.globalAlpha = 0.5 * Math.sin(fk * Math.PI);
    ctx.fillStyle = '#5fa2f2';
    ctx.fillRect(fx - 2, fy, 5, 1);
    ctx.fillRect(fx, fy - 2, 1, 5);
    ctx.fillStyle = '#d0f0ff';
    ctx.fillRect(fx, fy, 1, 1);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// One of the villagers, seen from behind, looking up at the star (their
// head turned toward it), some pointing at it; crouched with their arms
// over their heads as it comes down on them; flat on the ground after the
// wave, thrown away from it.
function drawFolk(g, f, star, down, t, glow) {
  const px = (x, y, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const side = star.x > f.x ? 1 : -1;
  const turn = Math.abs(star.x - f.x) > 20 ? side : 0;
  const lit = glow > 0.2 ? side : 0;
  const pose = down ? 'down' : glow > 0.85 ? 'cower' : f.points ? 'point' : 'stand';
  drawPerson(px, f.x, f.y + 1, {
    size: f.small ? 'small' : 'normal', face: 'back', pose, dir: down ? -side : side, turn, lit,
    shirt: f.shirt, skin: f.skin, hair: f.hair, t: t + f.look,
  });
}
