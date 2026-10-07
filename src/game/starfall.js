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
// roll when you've no breath for it (combat.js), and townsfolk who
// aren't sure what to make of you (some of them are wary: starWary).
import { VIEW_W, VIEW_H, CHAR_W, GROUND } from '../config.js';
import { B, BLOCKS } from '../world/blocks.js';
import { RNG, hash4, hashf } from '../util/rng.js';
import { drawText } from '../render/font.js';
import { wrap } from '../ui/ascii.js';
import { paintStarfall, villagers, drawVillage } from '../render/art_star.js';

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

// Who knows you fell? Only the village that saw it come down and its near
// neighbours (Round 73): anywhere else, they just see someone with a very
// strange wing. (`hero.starSid`: the village, kept on the hero; for older
// characters, the first village the fall would have picked.)
const KNOWN_RANGE = 170;
export function starHomeSid(game) {
  const h = game && game.hero;
  if (!h) return null;
  if (h.starSid != null) return h.starSid;
  const ow = game.world && game.world.ow;
  if (!ow) return null;
  const thessa = ow.islands[0];
  const villages = ow.settlements.filter((s) => s.type === 'village' && s.condition !== 'abandoned' && !s.deserted && s.island === thessa.key);
  if (!villages.length) return null;
  const rng = new RNG(hash4(game.seed >>> 0, 0, 0x57a2));
  h.starSid = rng.shuffle(villages.slice())[0].id;
  return h.starSid;
}
export function knowsFall(game, sid) {
  const home = starHomeSid(game);
  if (home == null || sid == null) return false;
  if (home === sid) return true;
  const ow = game.world.ow;
  const a = ow.settlements.find((s) => s.id === home);
  const b = ow.settlements.find((s) => s.id === sid);
  if (!a || !b || a.island !== b.island) return false;
  return Math.hypot(a.cx + a.cw / 2 - (b.cx + b.cw / 2), a.cz + a.cd / 2 - (b.cz + b.cd / 2)) < KNOWN_RANGE;
}

// What they say when you walk up (now and then: see dialogue.js). Those
// near where you fell know what you are; everyone else sees only the wing.
const GREET = {
  knownChild: [
    'Is that a real wing? Can you fly? Show me!',
    'Mum says you fell out of the sky. Did it hurt?',
    'You\'re the star! I saw you come down! Well, I saw the light.',
    'My brother says you\'re a ghost. You\'re not a ghost, are you?',
    'Did you see the moon up close? What\'s it made of?',
    'Everybody hid under the table when you landed. Not me.',
  ],
  knownWary: [
    'Keep that wing away from me.',
    'You\'re the one that came down out of the sky. I want no part of whatever you are.',
    'Half my roof came off the night you fell. I haven\'t forgotten.',
    'Stay where I can see you, star-thing.',
    'The crops in the low field still won\'t take. Where you landed. Just saying.',
    'My dog won\'t stop barking when you\'re about. Dogs know things.',
    'Whatever you are, I hope you\'re not staying long.',
  ],
  knownWarm: [
    'The one who fell from the sky! I saw the light of it from my window.',
    'You came down like the sun rising. Are you well?',
    'Folk say you\'re a star that fell. I\'m glad you landed softly, at least.',
    'Still here, then? Some of us had bets you\'d float back up.',
    'The whole lane talks about the night you came down. It was like noon at midnight.',
    'I went out to the crater the next morning. The ground was still warm.',
    'You look more like one of us every day. Except for the wing, of course.',
    'My grandmother says a fallen star brings a good harvest. No pressure.',
  ],
  child: [
    'Whoa! What happened to your arm? Is that a wing?',
    'Can I touch it? Does it bite?',
    'Why have you only got one? Did you lose the other one?',
    'That\'s the weirdest thing I ever saw. Can you fly?',
    'Is that a costume? It looks real.',
    'My friend won\'t believe me. Don\'t go anywhere!',
  ],
  wary: [
    'What in the world is that on your back?',
    'Is that... growing out of you? Keep your distance.',
    'I don\'t know what you are and I\'m not sure I want to.',
    'That thing on your back moved. I saw it move.',
    'Some kind of curse, is it? Don\'t pass it on.',
    'You\'ll not bring that thing into my house.',
  ],
  curious: [
    'Forgive me staring. That\'s a... wing? Just the one?',
    'I\'ve seen plenty of odd folk on the road, but never one with a wing.',
    'Is that some new fashion from the cities? It looks almost alive.',
    'A wing! Were you born with that, or is there a story?',
    'Strange thing you\'ve got there. It shines, a little. Is it meant to?',
    'Huh. One wing. Like a bat\'s, but blue. Never seen the like.',
    'You must get asked about that a lot. I\'ll try not to.',
  ],
};
export function starGreeting(rec, sid, rng, game = null) {
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const known = game ? knowsFall(game, sid) : true;
  if (rec.age === 'child') return pick(known ? GREET.knownChild : GREET.child);
  if (starWary(rec, sid)) return pick(known ? GREET.knownWary : GREET.wary);
  return pick(known ? GREET.knownWarm : GREET.curious);
}

// Asked about your wing.
const WING = {
  knownChild: [
    ['It\'s so blue! It glows a bit in the dark, did you know?', 'If I find a star, will I get a wing too?'],
    ['When you landed the whole sky went white. I want to do that.', 'Can you take me up there one day?'],
    ['Does it get cold? It looks cold.', 'I\'d keep it under a blanket.'],
  ],
  knownWary: [
    ['I\'d rather not talk about it.', 'My grandmother said things that fall from the sky bring trouble with them. I hope she was wrong.'],
    ['I saw what came down that night. A wing doesn\'t make it any less strange.'],
    ['The priest says to leave it be. I\'m leaving it be.'],
  ],
  knownWarm: [
    ['It shines a little, even in daylight. Like it remembers where it came from.', 'They say the old priests wrote of stars that walked. I never thought I\'d meet one.'],
    ['When you came down, there was a long tail of light behind you. I think the wing is all that\'s left of it.'],
    ['It suits you, honestly. Whatever you were up there, you\'re one of us down here.'],
    ['Folk from the next valley came to look at the crater. Nobody\'s been able to grow a thing in it.', 'I think it\'s the most beautiful thing that ever happened here.'],
  ],
  child: [
    ['It\'s really blue! Is it a dragon\'s? Did you fight one?'],
    ['If I had a wing I\'d use it to get away from my chores.'],
    ['It moved again! It does that when you\'re talking.'],
  ],
  wary: [
    ['I\'ll not pretend I like the look of it.', 'Folk round here don\'t trust what they can\'t explain.'],
    ['Whatever it is, it isn\'t natural. That\'s all I\'ll say.'],
    ['Did a witch do that to you? I\'ve heard of such things, out east.'],
  ],
  curious: [
    ['A wing, and only the one. Can it carry you at all?', 'I suppose it\'d have to be a strange bird that lost the other.'],
    ['I\'ve heard sailors\' tales of winged folk past the storm. Are you from out there?'],
    ['It looks like a dragon\'s, almost. The scholars would pay to have a look at that.'],
    ['It glows a little. Is it warm? I won\'t touch it. Unless you\'d let me.'],
  ],
};
export function wingTalk(rec, sid, game = null) {
  const known = game ? knowsFall(game, sid) : true;
  const set = rec.age === 'child' ? (known ? WING.knownChild : WING.child) : starWary(rec, sid) ? (known ? WING.knownWary : WING.wary) : known ? WING.knownWarm : WING.curious;
  return set[Math.floor(Math.random() * set.length)];
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

// What doesn't move, painted once (see render/art_star.js), and the
// villagers out in the square.
function paintBackdrop(seed) {
  const rng = new RNG(seed);
  const art = paintStarfall(seed, LAND);
  art.folk = villagers(rng);
  // (Stars that twinkle, over the painted ones.)
  art.stars = Array.from({ length: 40 }, (_, i) => ({ x: rng.int(0, PW - 1), y: rng.int(12, HORIZON - 14), b: rng.float(0.4, 1), ph: rng.float(0, 6.28), i }));
  return art;
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
  // The hills, the village and its people round their fire, the lights,
  // the dust when it comes (see render/art_star.js).
  drawVillage(g, art, { t, pre, after, glow, star: pre ? starAt(fall) : LAND, folk: art.folk, horizon: HORIZON });
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
