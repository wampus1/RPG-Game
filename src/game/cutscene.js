// How a new story opens, by where you come from.
//
// An island native: the camera drifts over your home town while it builds
// itself up out of the bare ground, year by year (the houses rising floor
// by floor, the streets laid between them), as its history is told: who
// founded it and how, the fires and floods and good years; then the town
// as it is today, its people about their day, and the camera comes down at
// your family's door.
//
// A castaway: you're on the deck of the ship that brought you, an evening
// out on open water. Walk about, talk to her crew (the captain at the
// wheel, the mate, the navigator, the cook, the deckhands, the lookout, a
// scholar bound for the Kavorent spires, the cabin child). Then the wind
// rises: cloud comes over, the rain starts, then it pours; lightning walks
// over the sea and the crew run to reef the canvas, shouting; until a bolt
// strikes the mainmast and sets the sails alight, the deck heaves, and
// everything goes black. Some lines about what happened, and why you were
// aboard; and you wake on the beach.
//
// ENTER skips either. While one plays, the world is held (see Game.update,
// the renderer's camera and veil, and the UI's overlay).
import { GROUND, SURFACE, VIEW_W, VIEW_H, CHAR_W } from '../config.js';
import { B } from '../world/blocks.js';
import { Entity } from '../entities/entity.js';
import { RNG, hash4 } from '../util/rng.js';
import { personName, CULTURES } from '../world/names.js';
import { makeTraveller } from '../entities/npcgen.js';
import { buildVoyage, deckSpots, DECK_Y } from '../world/voyage.js';
import { drawText } from '../render/font.js';
import { wrap } from '../ui/ascii.js';
import { yearOf } from '../sim/history.js';
import { alive } from '../sim/econ.js';
import { CrewWindow } from '../ui/crewtalk.js';

// Start the opening for a new character (the game's just been made).
export function startIntro(game) {
  const h = game.hero;
  if (!h) return null;
  let cs = null;
  try {
    if (h.origin === 'native' && game.sim.citizen) cs = new HomeIntro(game);
    else if (h.origin !== 'native') cs = new ShipIntro(game);
  } catch (e) {
    console.error(e);
    cs = null;
  }
  if (!cs) {
    game.introduce();
    return null;
  }
  game.cutscene = cs;
  game.ui.showHud = false;
  cs.begin();
  return cs;
}

const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a, b, k) => a + (b - a) * k;

// The base: captions, the letterbox, fades and skipping.
class Cutscene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.caption = null; // { text, t0, color }
    this.fade = 1; // black over everything (0 clear, 1 black)
    this.bars = 0;
    this.done = false;
    this.title = '';
    this.sub = '';
    this.hint = 'ENTER skip';
  }

  say(text, color = '#f4ecd8') {
    this.caption = { text, t0: this.t, color };
  }

  // Keys the UI keeps for itself while this plays.
  allowUi(code) {
    return code === 'Escape' || code === 'F2' || code === 'F3' || code === 'Backquote';
  }

  allowKey() {
    return false;
  }

  hides() {
    return false;
  }

  // The letterbox, the titles, the caption, and the fade.
  draw(ctx) {
    this.drawUnder(ctx);
    const bh = Math.round(26 * ease(this.bars));
    if (bh > 0) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, VIEW_W, bh);
      ctx.fillRect(0, VIEW_H - bh, VIEW_W, bh);
    }
    if (this.bars > 0.8) {
      const a = Math.min(1, (this.bars - 0.8) * 5);
      ctx.globalAlpha = a;
      if (this.title) bigText(ctx, this.title, VIEW_W / 2, 5, '#ffe070', 2);
      if (this.sub) drawText(ctx, this.sub, Math.round(VIEW_W / 2 - (this.sub.length * CHAR_W) / 2), VIEW_H - 21, '#a89878');
      if (this.hint) drawText(ctx, this.hint, VIEW_W - this.hint.length * CHAR_W - 6, VIEW_H - 10, '#5a5040');
      ctx.globalAlpha = 1;
    }
    this.drawCaption(ctx, VIEW_H - Math.max(bh, 14) - 8);
    if (this.fade > 0.001) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.fade)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    this.drawOver(ctx);
  }

  drawCaption(ctx, bottom) {
    const c = this.caption;
    if (!c) return;
    const age = this.t - c.t0;
    const lines = wrap(c.text, 72);
    const shown = Math.floor(age * 55);
    const a = Math.min(1, age * 3) * (c.until !== undefined ? Math.max(0, Math.min(1, (c.until - this.t) * 2)) : 1);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    let n = 0;
    lines.forEach((l, i) => {
      const y = bottom - (lines.length - i) * 10;
      const part = l.slice(0, Math.max(0, shown - n));
      n += l.length + 1;
      const x = Math.round(VIEW_W / 2 - (l.length * CHAR_W) / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      if (part.length) ctx.fillRect(x - 3, y - 1, part.length * CHAR_W + 6, 10);
      drawText(ctx, part, x, y, c.color, '#000');
    });
    ctx.globalAlpha = 1;
  }

  // (Anything drawn over the world, before the bars and the fade.)
  drawUnder() {}

  // (Anything drawn over the fade: the castaway's words in the dark.)
  drawOver() {}
}

// Text twice the size (or more), centred on `cx`.
function bigText(ctx, text, cx, y, color, k = 2) {
  const w = text.length * CHAR_W;
  const c = bigText.canvas || (bigText.canvas = makeCanvas(VIEW_W, 10));
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  drawText(g, text, 0, 1, color, '#000');
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, 0, 0, w + 1, 10, Math.round(cx - (w * k) / 2), y, (w + 1) * k, 10 * k);
  ctx.restore();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ------------------------------------------------------------ at home
// What grows up out of the ground (anything else at or above ground level
// in town is something people built), and the ground it grows out of.
const WILD = new Set(['leaves_oak', 'leaves_birch', 'leaves_pine', 'leaves_palm', 'leaves_jungle', 'leaves_acacia', 'leaves_willow', 'leaves_snowy',
  'log_oak', 'log_birch', 'log_pine', 'log_palm', 'log_jungle', 'log_acacia', 'log_willow', 'tall_grass', 'fern', 'flower_red', 'flower_yellow',
  'flower_blue', 'flower_white', 'flower_purple', 'bush', 'berry_bush', 'dead_bush', 'reeds', 'mushroom_red', 'mushroom_brown', 'herb', 'sapling',
  'lily_pad', 'rock', 'cactus', 'water', 'ice', 'snow'].map((k) => B[k]).filter((v) => v !== undefined));
const EARTH = new Set(['grass', 'grass_lush', 'grass_dry', 'grass_jungle', 'grass_taiga', 'sand', 'snow', 'dirt', 'mud', 'gravel', 'clay', 'stone',
  'sandstone', 'water', 'ice'].map((k) => B[k]).filter((v) => v !== undefined));

export class HomeIntro extends Cutscene {
  constructor(game) {
    super(game);
    this.kind = 'home';
    this.live = true;
    this.noCutaway = true;
    const c = game.sim.citizen;
    const L = (this.L = game.sim.layoutOf(c.sid));
    const s = (this.s = L.settlement);
    this.hist = game.sim.history.of(L);
    this.now = yearOf(game.day);
    this.title = `~ ${s.name.toUpperCase()} ~`;
    this.mood = 'history';
    // The story, in order: its founding, then what came after.
    const ents = this.hist.entries.filter((q) => q.y <= this.now);
    const first = ents.find((q) => q.kind === 'founded');
    const rest = ents.filter((q) => q !== first);
    const keep = rest.length > 5 ? [0, 1, 2, 3, 4].map((k) => rest[Math.round((k * (rest.length - 1)) / 4)]) : rest;
    // (In the order they happened: some old places nearby are older than
    // the town, and the land's bare while they're told.)
    this.beats = [{ y: this.hist.founded, text: first ? first.text : `${s.name} was founded by ${this.hist.founder}.` }, ...keep.map((q) => ({ y: q.y, text: q.text }))].sort((a, b) => a.y - b.y);
    this.beatT = 4.6;
    this.build = Math.max(20, this.beats.length * this.beatT);
    this.t0 = 2.5; // (the title first, over the bare ground)
    this.t1 = this.t0 + this.build; // built
    this.t2 = this.t1 + 11; // today, and the camera comes home
    this.t3 = this.t2 + 5.5; // the last words, in the dark
    this.prog = 0;
    this.prepare();
  }

  begin() {
    const g = this.game;
    this.fade = 1;
    g.renderer.camInit = false;
    g.lightDirty = true;
    this.say('');
  }

  // When each part of the town goes up: the hall and the square first,
  // then outward street by street; each house rising floor by floor; the
  // walls (if it has them) last of all.
  prepare() {
    const L = this.L;
    const w = this.game.world;
    const b = L.bounds;
    const x0 = (this.x0 = b.x0 - 2);
    const z0 = (this.z0 = b.z0 - 2);
    const W = (this.W = b.x1 - b.x0 + 5);
    const D = (this.D = b.z1 - b.z0 + 5);
    const cx = L.plaza ? L.plaza.cx : (b.x0 + b.x1) / 2;
    const cz = L.plaza ? L.plaza.cz : (b.z0 + b.z1) / 2;
    const far = Math.max(1, ...[[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].map(([x, z]) => Math.hypot(x - cx, (z - cz) * 1.3)));
    const rng = new RNG(hash4(L.settlement.seed >>> 0, 0xb17d));
    this.colT = new Float32Array(W * D);
    this.rise = new Uint8Array(W * D);
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x0 + x - cx, (z0 + z - cz) * 1.3) / far;
        let t = 0.04 + 0.82 * Math.pow(d, 0.85) + (((hash4(x0 + x, z0 + z, 7) % 100) / 100) - 0.5) * 0.06;
        // (A town's walls come when it's grown enough to need them.)
        if (L.walled && (x < 5 || z < 5 || x >= W - 5 || z >= D - 5)) t = Math.max(t, 0.86);
        this.colT[z * W + x] = Math.max(0.02, Math.min(0.94, t));
      }
    }
    this.raised = [];
    for (const q of L.buildings) {
      if (q.x0 === undefined) continue;
      const bx = (q.x0 + q.x1) / 2;
      const bz = (q.z0 + q.z1) / 2;
      const d = Math.hypot(bx - cx, (bz - cz) * 1.3) / far;
      let t = q.type === 'townhall' ? 0.05 : q.type === 'temple' ? 0.14 : 0.07 + 0.78 * Math.pow(d, 0.9) + rng.float(-0.05, 0.05);
      t = Math.max(0.03, Math.min(0.9, t));
      for (let z = q.z0 - 1; z <= q.z1 + 1; z++) {
        for (let x = q.x0 - 1; x <= q.x1 + 1; x++) {
          const i = (z - z0) * W + (x - x0);
          if (i < 0 || x - x0 >= W || z - z0 >= D || i >= W * D) continue;
          this.colT[i] = t;
          this.rise[i] = 1;
        }
      }
      this.raised.push({ x: Math.round(bx), z: Math.round(bz), t, up: false });
    }
    // The bare ground the town was built on: under each street and floor,
    // whatever the nearest open ground is (or what's commonest round it).
    const count = new Map();
    for (let z = b.z0 - 6; z <= b.z1 + 6; z += 2) {
      for (let x = b.x0 - 6; x <= b.x1 + 6; x += 2) {
        if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) continue;
        const id = w.getBlock(x, SURFACE, z);
        if (EARTH.has(id) && id !== B.water) count.set(id, (count.get(id) || 0) + 1);
      }
    }
    const common = [...count.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] ?? B.grass;
    this.soil = new Uint8Array(W * D);
    const bare = (id) => EARTH.has(id) && id !== B.water && id !== B.ice;
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        let id = 0;
        for (let r = 1; r <= 4 && !id; r++) {
          for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
            const q = w.getBlock(x0 + x + dx, SURFACE, z0 + z + dz);
            if (bare(q)) {
              id = q;
              break;
            }
          }
        }
        this.soil[z * W + x] = id || common;
      }
    }
    // The camera's way: in from the far side, over the square, across, and
    // down to your family's door.
    const p = this.game.player;
    const corners = [[b.x0 + 8, b.z0 + 5], [b.x1 - 8, b.z0 + 5], [b.x0 + 8, b.z1 - 5], [b.x1 - 8, b.z1 - 5]];
    corners.sort((a, c) => Math.hypot(c[0] - p.x, c[1] - p.z) - Math.hypot(a[0] - p.x, a[1] - p.z));
    const start = corners[0];
    const across = corners[1];
    this.path = [
      { x: start[0], z: start[1], at: 0 },
      { x: cx, z: cz, at: this.t0 + this.build * 0.55 },
      { x: across[0], z: across[1], at: this.t1 + 2 },
      { x: p.x, z: p.z, at: this.t2 - 2 },
    ];
  }

  inside(x, z) {
    return x >= this.x0 && z >= this.z0 && x < this.x0 + this.W && z < this.z0 + this.D;
  }

  // Not built yet (as of this moment of the story)? (Trees and flowers out
  // in the open were there first; anything on a house's plot comes with it.)
  veiled(x, y, z, id) {
    if (y < GROUND || !this.inside(x, z)) return false;
    const i = (z - this.z0) * this.W + (x - this.x0);
    if (WILD.has(id) && !this.rise[i]) return false;
    const t = this.colT[i] + (this.rise[i] ? (y - GROUND) * 0.011 : 0);
    return t > this.prog;
  }

  // The ground under what's not built yet: bare earth, no road.
  groundAt(x, y, z, id) {
    if (y !== SURFACE || EARTH.has(id) || !this.inside(x, z)) return id;
    const i = (z - this.z0) * this.W + (x - this.x0);
    return this.colT[i] - 0.03 > this.prog ? this.soil[i] : id;
  }

  // Nobody about till the town's here (and you stay indoors throughout).
  hides(e) {
    if (e.kind === 'player') return true;
    return this.t < this.t1 + 0.5;
  }

  focus() {
    const P = this.path;
    const t = this.t;
    let a = P[0];
    let b = P[0];
    for (let i = 0; i < P.length - 1; i++) {
      if (t >= P[i].at) {
        a = P[i];
        b = P[i + 1];
      }
    }
    if (t >= P[P.length - 1].at) a = b = P[P.length - 1];
    const k = a === b ? 1 : ease((t - a.at) / Math.max(0.01, b.at - a.at));
    return { x: lerp(a.x, b.x, k), y: GROUND, z: lerp(a.z, b.z, k) };
  }

  // The year the story's reached (and so how much of the town is built).
  year() {
    const t = this.t - this.t0;
    if (t <= 0) return this.beats[0].y;
    const n = this.beats.length;
    const i = Math.min(n - 1, Math.floor(t / this.beatT));
    const y0 = this.beats[i].y;
    const y1 = i + 1 < n ? this.beats[i + 1].y : this.now;
    const span = i + 1 < n ? this.beatT : Math.max(this.beatT, this.build - i * this.beatT);
    return lerp(y0, y1, Math.min(1, (t - i * this.beatT) / span));
  }

  update(dt, pressed) {
    const g = this.game;
    if (pressed.some((k) => k.code === 'Enter' || k.code === 'NumpadEnter')) return this.finish();
    this.t += dt;
    const t = this.t;
    this.bars = Math.min(1, this.bars + dt / 0.8);
    // In from black; out to black at the end.
    this.fade = t < 1.5 ? 1 - t / 1.5 : t > this.t2 ? Math.min(1, (t - this.t2) / 1.2) : 0;
    // (It grows steadily from its founding on; before that, bare land.)
    const fi = Math.max(0, this.beats.findIndex((q) => q.y >= this.hist.founded));
    const tf = this.t0 + fi * this.beatT;
    this.prog = t >= this.t1 ? 1 : ease(Math.max(0, Math.min(1, (t - tf) / Math.max(1, this.t1 - tf))));
    // A house going up: a puff of dust and a knock of timber.
    for (const q of this.raised) {
      if (q.up || this.prog < q.t) continue;
      q.up = true;
      const f = this.focus();
      if (Math.abs(q.x - f.x) < 20 && Math.abs(q.z - f.z) < 14) {
        g.renderer.emit(q.x, GROUND + 0.2, q.z, { n: 10, color: ['#a89878', '#8a7a62', '#c8b898'], up: 16, speed: 30, life: 0.9, gravity: 10, shape: 'puff', grow: 1.2 });
        if (Math.random() < 0.5) g.audio?.play('place', { x: q.x, y: GROUND, z: q.z });
      }
    }
    // The story so far.
    if (t >= this.t0 && t < this.t1) {
      const i = Math.min(this.beats.length - 1, Math.floor((t - this.t0) / this.beatT));
      if (this.beatShown !== i) {
        this.beatShown = i;
        this.say(this.beats[i].text);
      }
      this.sub = `The year ${Math.round(this.year())}`;
    } else if (t >= this.t1 && !this.todaySaid) {
      this.todaySaid = true;
      const L = this.L;
      const s = this.s;
      const folk = L.npcs.filter((r) => alive(r)).length;
      const realm = s.civ ? `, sworn to the ${s.civ.name.replace(/^The /, '')}` : '';
      this.sub = `The year ${this.now}`;
      this.say(`${s.name} today: ${folk} souls${realm}, known far and wide for ${this.hist.famous}.`, '#ffe070');
    } else if (t >= this.t1 + 5.5 && !this.homeSaid) {
      this.homeSaid = true;
      const c = g.sim.citizen;
      const par = (c.family?.parents || []).map((i) => this.L.npcs[i]).filter(Boolean).map((r) => r.name.first);
      const first = String(g.playerName).split(' ')[0];
      this.say(`And this is where you were born, ${first}${par.length ? `: the child of ${par.join(' and ')}` : ''}. ${this.s.name} is the only home you have ever known.`, '#a0c8ff');
    }
    if (t >= this.t2 && this.caption && this.caption.until === undefined) this.caption.until = this.t2 + 0.6;
    if (t >= this.t3) this.finish();
  }

  drawOver(ctx) {
    // The last words, in the dark.
    if (this.t < this.t2 + 0.8) return;
    const a = Math.min(1, (this.t - this.t2 - 0.8) * 1.5) * Math.min(1, (this.t3 - this.t) * 1.5);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const lines = wrap(`Everyone in ${this.s.name} knows your face. Today, like any other day, starts at home.`, 60);
    lines.forEach((l, i) => drawText(ctx, l, Math.round(VIEW_W / 2 - (l.length * CHAR_W) / 2), VIEW_H / 2 - 8 + i * 11, '#e8d8b0'));
    ctx.globalAlpha = 1;
  }

  finish() {
    if (this.done) return;
    this.done = true;
    const g = this.game;
    g.cutscene = null;
    g.ui.showHud = true;
    g.ui.hudP = 0;
    g.ui.lastSettlement = undefined;
    g.renderer.camInit = false;
    g.lightDirty = true;
    g.ui.fade = 1.2;
    g.introduce();
    g.ui.msg('Press H for help.', '#a0c8ff');
  }
}

// ------------------------------------------------------------ at sea
const SHIP_NAMES = ['Grey Heron', 'Morning Star', 'Saltmarsh Maid', 'Constant', 'Gannet', 'Fair Promise', 'Lantern', 'Brightwater', 'Old Faithful', 'Windlass', 'Swift Return', 'Cormorant'];
const HOME_PORTS = ['Harrowmouth', 'Kell Haven', 'Saltreach', 'Dunmere', 'Aldport', 'Varrow', 'Eastwick', 'Brannoch'];
// Where you were bound: inside the Wall, the storm round the Dagoni
// Islands that no ship has come through in living memory. Once in a long
// while a gap opens in it, and this captain meant to run it.
const GAPS = ['the Needle', 'the Eye of the Wall', 'the Narrows', 'the Gate of Grey Water', 'the Thinning'];

// Why you were aboard (by what you brought).
const REASONS = {
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

// Someone aboard: they walk the deck between their stations, work, talk.
class Crew extends Entity {
  constructor(game, def, spot) {
    super(game, spot.x, spot.y, spot.z);
    this.kind = 'crew';
    this.name = def.name;
    this.role = def.role;
    this.look = def.look;
    this.held = def.held || null;
    this.stations = def.stations;
    this.still = !!def.still;
    this.pace = def.pace || 0.32;
    this.talk = def.talk;
    this.shouts = def.shouts || [];
    this.goal = null;
    this.waitT = 1 + Math.random() * 3;
    this.stuck = 0;
    this.dir = def.dir ?? 0;
    this.rest = def.dir;
    this.hp = this.maxHp = 10;
  }

  heldItem() {
    return this.held;
  }

  offhandItem() {
    return null;
  }

  // Each frame, on deck: to the next station (or anywhere, in a panic).
  tick(dt, scene) {
    this.updateBase(dt);
    if (this.moving) return;
    const g = this.game;
    const p = g.player;
    if (scene.talkingTo === this) {
      this.face(p.x, p.z);
      return;
    }
    const panic = scene.panic;
    if (this.waitT > 0) {
      this.waitT -= dt * (panic ? 3 : 1);
      // At their work: hauling, swabbing, turning the wheel.
      if (!panic && Math.random() < dt * 0.6) this.doAction(0.35);
      return;
    }
    if (!this.goal) {
      if (this.still && !panic) {
        this.waitT = 2 + Math.random() * 3;
        return;
      }
      const list = panic && !this.still ? scene.anywhere : this.stations;
      this.goal = list[Math.floor(Math.random() * list.length)];
    }
    if (this.x === this.goal.x && this.z === this.goal.z) {
      this.goal = null;
      this.waitT = panic ? 0.2 + Math.random() * 0.6 : 3 + Math.random() * 5;
      if (this.still) this.dir = this.rest ?? this.dir;
      return;
    }
    if (!this.step(this.goal.x, this.goal.z, panic ? this.pace * 0.6 : this.pace)) {
      if (++this.stuck > 4) {
        this.goal = null;
        this.stuck = 0;
        this.waitT = 0.5;
      }
    } else this.stuck = 0;
  }

  step(tx, tz, dur) {
    const g = this.game;
    const w = g.world;
    const dx = Math.sign(tx - this.x);
    const dz = Math.sign(tz - this.z);
    const tries = [];
    if (dx && dz) tries.push(...(Math.random() < 0.5 ? [[dx, 0], [0, dz]] : [[0, dz], [dx, 0]]));
    else if (dx) tries.push([dx, 0], [0, Math.random() < 0.5 ? 1 : -1]);
    else if (dz) tries.push([0, dz], [Math.random() < 0.5 ? 1 : -1, 0]);
    for (const [ax, az] of tries) {
      const nx = this.x + ax;
      const nz = this.z + az;
      const ny = w.stepTarget(this.x, this.y, this.z, nx, nz, false);
      if (ny < 0 || g.occupiedBySolid(nx, ny, nz, this) || w.isWaterAt(nx, ny, nz)) continue;
      this.face(nx, nz);
      this.startMove(nx, ny, nz, dur);
      return true;
    }
    return false;
  }
}

export class ShipIntro extends Cutscene {
  constructor(game) {
    super(game);
    this.kind = 'ship';
    this.playable = true;
    this.live = true;
    const h = game.hero;
    let k = 0;
    for (const ch of String(h.name)) k = (k * 31 + ch.charCodeAt(0)) >>> 0;
    this.rng = new RNG(hash4(game.seed >>> 0, k, 0x5e1));
    const rng = this.rng;
    this.shipName = rng.pick(SHIP_NAMES);
    this.port = rng.pick(HOME_PORTS);
    this.isle = 'the Dagoni Islands';
    this.gap = rng.pick(GAPS);
    this.title = `~ THE ${this.shipName.toUpperCase()} ~`;
    this.sub = `Twelve days out from ${this.port}, bound for ${this.isle}`;
    this.hint = 'WASD walk · F talk · ENTER skip';
    this.mood = 'voyage';
    this.phase = 'calm';
    this.talked = new Set();
    this.panic = false;
    this.talkingTo = null;
    this.stormAt = 95;
  }

  begin() {
    const g = this.game;
    const p = g.player;
    // (Where you'll wake: the beach, already made.)
    this.beach = { x: p.x, y: p.y, z: p.z };
    this.clock = { minute: g.minute, day: g.day };
    this.voyage = buildVoyage();
    // What's about you up there waits.
    this.stash = { creatures: g.creatures, drops: g.drops };
    for (const c of g.creatures) g.removeOcc(c);
    g.creatures = [];
    g.drops = [];
    g.projectiles = [];
    g.wildlife?.clear();
    g.world.setInstance({ regions: this.voyage.regions, voyage: true });
    const spots = (this.spots = deckSpots(this.voyage));
    this.anywhere = [...spots.waist, ...spots.rail, ...spots.bow, ...spots.stern];
    p.teleport(spots.start.x, spots.start.y, spots.start.z);
    p.dir = 3;
    g.minute = 17 * 60 + 35;
    this.weather = { kind: 'clear', level: 0, t: 999, seen: true, wind: 1 };
    g.weather = this.weather;
    g.renderer.camInit = false;
    g.lightDirty = true;
    this.crew = this.makeCrew();
    this.fade = 1;
  }

  makeCrew() {
    const g = this.game;
    const rng = this.rng;
    const S = this.spots;
    const styles = Object.keys(CULTURES);
    const homeStyle = rng.pick(styles);
    const person = (role, o = {}) => {
      const style = rng.chance(0.7) ? homeStyle : rng.pick(styles);
      const t = makeTraveller(rng, style, o.guard ? 'guard' : 'driver');
      const look = { ...t.look, ...(o.look || {}) };
      const nm = personName(rng, style, null);
      return { name: `${nm.first} ${nm.last}`, first: nm.first, role, look };
    };
    const captain = person('Captain', { look: { outfit: 'noble', hat: 'feather', hatColor: '#2a2a3a', beard: true } });
    const mate = person('First Mate', { look: { outfit: 'vest', hat: 'bandana', hatColor: '#8a2a3a' } });
    const nav = person('Navigator', { look: { outfit: 'robe_blue', hat: null, acc: 'glasses' } });
    const cook = person('Ship\'s Cook', { look: { outfit: 'apron', hat: 'chef' } });
    const hand1 = person('Deckhand', { look: { outfit: 'plain', hat: 'bandana', hatColor: '#2a4a7a' } });
    const hand2 = person('Deckhand', { look: { outfit: 'fisher', hat: 'cap' } });
    const look = person('Lookout', { look: { outfit: 'vest', hat: 'cap' } });
    const scholar = person('Passenger', { look: { outfit: 'robe_green', hat: 'hood', acc: 'glasses' } });
    const kid = person('Cabin Child', { look: { small: true, outfit: 'plain', hat: 'bandana', hatColor: '#c89030', beard: false } });
    this.captain = captain;
    const isle = this.isle;
    const ship = this.shipName;
    const you = String(g.playerName).split(' ')[0];
    const reason = REASONS[g.hero.kit] || REASONS.wanderer;
    const storm = () => this.phase !== 'calm';
    const defs = [
      { ...captain, held: null, stations: [S.helm], still: true, dir: 1, talk: {
        hello: () => (storm() ? `Hold on to something, ${you}! I'll not lose a soul tonight, not one!` : `Evening, ${you}. Fair wind, and the ${ship} running before it. I could stand here all night.`),
        topics: [
          { id: 'where', label: 'Where are we bound?', say: () => [`${isle}. Three of them: Thessa, Kharos and Myrrow, inside the Wall.`, 'The Wall is a storm that never ends, all the way round them. No ship\'s come out of it in a lifetime, and none that went in came back.'] },
          { id: 'gap', label: 'How do we get through?', say: () => [`There's a gap. ${this.gap}, the old charts call it. It opens once in thirty years or so, for a few days.`, 'The signs are right. We run it tonight, straight for Thessa, and we\'re the first in a generation.'] },
          { id: 'ship', label: 'Tell me about the ship.', say: () => [`The ${ship}. Thirty years on the Grey Sea and she has never lost a hand.`, 'I mean to keep it that way. She knows it, too.'] },
          { id: 'sky', label: 'How does the sky look?', say: () => (storm() ? ['Like the end of the world! The gap\'s closing on us! Hold on!'] : ['That black ahead is the Wall. It looks still from here, doesn\'t it?', 'It isn\'t. When we go in, you stay off the rail. Understood?']) },
        ] } },
      { ...mate, held: null, stations: [...S.waist.slice(0, 6), S.mainmast], talk: {
        hello: () => (storm() ? 'Reef the main! REEF IT, I said! You, keep out from underfoot!' : 'Don\'t mind me. Somebody has to keep this lot awake on watch.'),
        topics: [
          { id: 'island', label: 'Have you seen the islands?', say: () => ['Never. Nobody living has. But on a dark night, from outside the Wall, you can see a red glow through it.', 'That\'s Kharos, they say: an island with a mountain of fire. Thessa\'s the green one, and Myrrow\'s always in fog.'] },
          { id: 'help', label: 'Anything I can do?', say: () => ['Stay out from under the boom, and don\'t whistle on deck.', 'Whistling calls up the wind. Ask anyone.'] },
          { id: 'crew', label: 'What are the crew like?', say: () => [`Good hands, mostly. ${cook.first} can't cook and ${hand1.first} can't sing, but they both try anyway.`] },
        ] } },
      { ...nav, held: 'scroll', stations: S.stern, talk: {
        hello: () => (storm() ? 'No stars, no coast, no anything! We are blind out here!' : 'Mind the chart, it is the only one of its kind. Most of it is guesswork, I am afraid.'),
        topics: [
          { id: 'chart', label: 'What does the chart show?', say: () => ['A ring of storm drawn round three islands, from before the Wall closed. Thessa to the west, Kharos north-east, Myrrow south-east.', 'And inland, marks I cannot read: barrows, mines, things sunk in the marshes. Old places, from before the towns.'] },
          { id: 'beyond', label: 'What else is out there?', say: () => ['Outside the Wall? Two great continents, Velmarch in the north and Ostria to the east, and isles scattered between.', 'Inside it, the islanders will know nothing of any of that. They\'ve been alone a long time.'] },
          { id: 'stars', label: 'How do you steer at night?', say: () => ['By the stars, when there are any.', `Inside the Wall there are none. We steer by ${this.gap}, and by luck.`] },
        ] } },
      { ...cook, held: 'cooked_fish', stations: [S.rail[0], S.rail[2], S.waist[8]], talk: {
        hello: () => (storm() ? 'My pots! There go my pots! Oh, I can\'t look...' : `Hungry, ${you}? It's fish. It's always fish.`),
        topics: [
          { id: 'supper', label: 'What\'s for supper?', say: () => ['Fish. Yesterday it was fish. Tomorrow, you\'ll never guess.', 'Fish.'] },
          { id: 'news', label: 'Any gossip aboard?', say: () => [`${look.first} swears they saw a sea serpent last night. It was a log.`, `And ${scholar.first} hasn't been sick once, which is more than you can say for the rest of us.`] },
        ] } },
      { ...hand1, held: 'bucket', stations: [...S.waist.slice(2, 9), ...S.rail.slice(1, 4)], talk: {
        hello: () => (storm() ? 'We\'re taking water over the side! Bail, bail!' : 'Swab, haul, swab again. Beats the mines back home.'),
        topics: [
          { id: 'work', label: 'Hard work?', say: () => ['Hard enough. But the sea pays, and nobody asks where you came from.'] },
          { id: 'sing', label: 'Sing something?', say: () => ['Oh the wind blows west and the wind blows free...', '...and that\'s all I know of it. The rest is rude.'] },
        ] } },
      { ...hand2, held: null, stations: [...S.rail, S.foremast], talk: {
        hello: () => (storm() ? 'The lines! Help me with the lines!' : 'Mind your feet, that line is not for tripping over.'),
        topics: [
          { id: 'home', label: 'Where are you from?', say: () => [`${this.port}, same as the ship. Three years aboard her now.`, 'My grandmother was born on Thessa, before the Wall closed. She used to sing me the songs. I want to hear them sung there.'] },
        ] } },
      { ...look, held: null, stations: S.bow, talk: {
        hello: () => (storm() ? 'I can\'t see a thing! Not a THING!' : 'Gulls, all afternoon. That means land is not far off.'),
        topics: [
          { id: 'see', label: 'Seen anything out there?', say: () => (storm() ? ['Only lightning, and the sea standing up like a wall!'] : ['The Wall, all day, getting bigger. Black from the sea to the top of the sky.', 'And lightning inside it, all the time, without a sound. That\'s the worst of it.']) },
        ] } },
      { ...scholar, held: 'book', stations: [...S.stern.slice(1), S.rail[4], S.rail[5]], talk: {
        hello: () => (storm() ? 'The old stories say the Wall is the Kavorent\'s doing. I never believed... I don\'t believe...' : 'Ah, a fellow traveller! Going to see the spires as well?'),
        topics: [
          { id: 'kav', label: 'Who were the Kavorent?', say: () => ['Nobody knows! They weren\'t human, that much is plain. They built in an alloy that never rusts.', 'Their spires still stand on all three islands. Offer one a cut gem, the stories say, and a door opens all the way down.'] },
          { id: 'wall', label: 'What is the Wall?', say: () => ['A storm that has stood round the Dagoni Islands for a hundred years, perhaps more. It doesn\'t move with the seasons; it doesn\'t blow itself out.', 'Some say the Kavorent raised it, to keep something in. Or out. A raft couldn\'t live in it an hour; only a real ship, in the gap, has a chance.'] },
          { id: 'why', label: 'Why are you going?', say: () => ['To see what is below the spires, of course. They say their makers still guard the halls: golems that have never slept.', 'I intend to be very polite to them.'] },
          { id: 'me', label: 'Why am I going?', say: () => [`You told me yourself, the first night out. ${reason}`] },
        ] } },
      { ...kid, held: null, stations: [...S.waist, ...S.rail], pace: 0.22, talk: {
        hello: () => (storm() ? 'I want to go home! I want to go HOME!' : 'Are you a pirate? Cook says I will be a pirate if I don\'t eat my fish.'),
        topics: [
          { id: 'name', label: 'What\'s your name?', say: () => [`${kid.first}. I'm the cabin child. That means I do everything nobody else wants to.`] },
          { id: 'fish', label: 'Eat your fish.', say: () => ['NO.'] },
        ] } },
    ];
    const spots = [S.helm, S.waist[1], S.stern[0], S.rail[0], S.waist[4], S.rail[3], S.bow[0], S.stern[2], S.waist[7]];
    const shouts = {
      Captain: ['Hold her steady! STEADY!', 'All hands! All hands on deck!', 'Bring her into the wind!'],
      'First Mate': ['Reef the main!', 'Lash it down! Lash everything down!', 'Move, move!'],
      Navigator: ['We\'re off the chart!', 'Where\'s the coast? WHERE?'],
      'Ship\'s Cook': ['Gods preserve us!', 'My pots!'],
      Deckhand: ['We\'re taking water!', 'Hold on!', 'The line\'s gone!'],
      Lookout: ['Wave! Big one, starboard!', 'I can\'t see!', 'The gap\'s closing!'],
      Passenger: ['The Wall... the Kavorent\'s Wall...!', 'This was a mistake!'],
      'Cabin Child': ['MAMA!', 'I\'m scared!'],
    };
    // What they say to nobody in particular, about their work.
    const idle = {
      Captain: ['Steady as she goes.', 'Wind\'s backing west. Hm.', 'Fine evening for it.'],
      'First Mate': ['Look lively!', 'Coil that line properly!', 'Who left this bucket here?'],
      Navigator: ['The gap opens at dusk, if the old charts are right.', 'Where did I put my dividers...'],
      'Ship\'s Cook': ['Fish again tonight!', 'Who\'s been at the biscuits?'],
      Deckhand: ['Heave!', 'Oh the wind blows west...', 'My back...'],
      Lookout: ['Gulls off the bow!', 'The Wall, dead ahead!'],
      Passenger: ['The spires... at last.', 'Fascinating. Simply fascinating.'],
      'Cabin Child': ['Race you to the bow!', 'I saw a fish! A BIG one!'],
    };
    this.idle = idle;
    const out = [];
    defs.forEach((d, i) => {
      const at = spots[i];
      if (g.occupiedBySolid(at.x, at.y, at.z, null)) return;
      const c = new Crew(g, { ...d, shouts: shouts[d.role] || [] }, at);
      g.moveEntity(c, c.x, c.y, c.z);
      out.push(c);
    });
    return out;
  }

  get actors() {
    return this.crew || [];
  }

  allowUi(code) {
    return super.allowUi(code) || code === 'Tab' || code === 'KeyI' || code === 'KeyH' || code === 'F1';
  }

  allowKey(code) {
    return code === 'KeyF' || code === 'KeyQ' || code === 'KeyE' || code === 'Space' || code.startsWith('Digit');
  }

  hides(e) {
    return this.phase === 'black' && e.kind !== 'item';
  }

  // The camera rides with you, and with the ship as she pitches and rolls.
  focus() {
    const p = this.game.player.renderPos();
    const k = this.phase === 'storm' || this.phase === 'strike' ? 1 : this.phase === 'gather' ? 0.45 : 0.12;
    return { x: p.x + Math.sin(this.t * 0.7) * 0.12 * k, y: p.y + Math.sin(this.t * 1.1) * 0.35 * k, z: p.z + Math.sin(this.t * 0.9) * 0.25 * k };
  }

  // Someone spoken to (from Game.interactFront).
  talk(c) {
    const g = this.game;
    const p = g.player;
    if (this.phase === 'strike' || this.phase === 'black') return;
    c.face(p.x, p.z);
    p.face(c.x, c.z);
    if (this.phase === 'storm') {
      c.say(c.shouts.length ? c.shouts[Math.floor(Math.random() * c.shouts.length)] : 'Not now!', 2.2, '#ffb080');
      return;
    }
    this.talked.add(c.role + c.name);
    g.ui.open(new CrewWindow(g.ui, c, this));
  }

  update(dt, pressed) {
    const g = this.game;
    if (pressed.some((k) => k.code === 'Enter' || k.code === 'NumpadEnter')) return this.finish();
    this.t += dt;
    const t = this.t;
    this.bars = Math.min(1, this.bars + dt / 0.8);
    const top = g.ui.top && g.ui.top();
    this.talkingTo = top && top.kind === 'crew' ? top.crew : null;
    if (this.phase !== 'black') for (const c of this.crew) c.tick(dt, this);
    const w = this.weather;
    // The sea going by: spray off the bow, a wake astern.
    const h = this.voyage.hull;
    this.sprayT = (this.sprayT || 0) - dt;
    if (this.sprayT <= 0 && this.phase !== 'black') {
      this.sprayT = this.phase === 'calm' ? 0.35 : 0.12;
      const side = Math.random() < 0.5 ? -1 : 1;
      g.renderer.emit(h.x1 + 1 + Math.random(), 5.6, h.cz + side * (1 + Math.random() * 2), { n: 3, color: ['#ffffff', '#cfe4f4', '#a8c8e0'], up: 14, speed: 16, life: 0.6, gravity: 30 });
      g.renderer.emit(h.x0 - 1 - Math.random() * 3, 5.5, h.cz + (Math.random() - 0.5) * 4, { n: 1, color: ['#e8f4ff', '#bcd8ec'], up: 4, speed: 6, life: 1.2, gravity: 2 });
    }
    if (this.phase === 'calm') {
      this.fade = Math.max(0, 1 - t / 2);
      // The crew at their work, talking.
      this.chatT = (this.chatT ?? 5) - dt;
      if (this.chatT <= 0) {
        this.chatT = 4 + Math.random() * 4;
        const p = g.player;
        const near = this.crew.filter((c) => !c.bubble && c !== this.talkingTo && c.distTo(p) <= 9);
        const c = near[Math.floor(Math.random() * near.length)];
        const lines = c && this.idle[c.role];
        if (lines) c.say(lines[Math.floor(Math.random() * lines.length)], 2.8);
      }
      if (t > 60 && !this.warned) {
        this.warned = true;
        this.say(`The Wall fills the sky ahead: black cloud from the sea to the stars, lit from inside. Somewhere in it is ${this.gap}.`, '#c8d8ff');
        this.caption.until = t + 6;
      }
      // Evening comes on slowly.
      g.minute = Math.min(19 * 60 + 10, g.minute + dt * 0.6);
      if (t > 4 && !this.helloed) {
        this.helloed = true;
        this.say(`The sun is going down over the Grey Sea. Ahead, inside the storm that rings them, lie ${this.isle}.`);
      }
      if (t > 14 && this.caption && this.caption.until === undefined) this.caption.until = t + 0.5;
      // The storm comes when you've met them (or soon enough regardless).
      const met = this.talked.size;
      if ((met >= 4 && t > 40) || t > this.stormAt) {
        if (!top || top.kind !== 'crew') this.toPhase('gather');
      }
    } else if (this.phase === 'gather') {
      const k = Math.min(1, (t - this.pt) / 12);
      g.minute = lerp(this.gm, 20 * 60 + 30, k);
      w.kind = 'rain';
      w.level = 0.15 + k * 0.6;
      w.wind = 1 + k * 1.5;
      if (Math.random() < dt * 0.35) this.lightning(false);
      if (Math.random() < dt * 0.6) this.shout();
      if (t - this.pt > 12) this.toPhase('storm');
    } else if (this.phase === 'storm') {
      const k = Math.min(1, (t - this.pt) / 4);
      w.level = 0.75 + k * 0.95;
      w.wind = 2.5 + k;
      this.panic = true;
      if (Math.random() < dt * 0.55) this.lightning(Math.random() < 0.3);
      if (Math.random() < dt * 1.4) this.shout();
      // Seas coming over the rail.
      if (Math.random() < dt * 2.5) {
        const x = h.x0 + 4 + Math.floor(Math.random() * (h.x1 - h.x0 - 6));
        const side = Math.random() < 0.5 ? -1 : 1;
        g.renderer.emit(x, DECK_Y + 0.5, h.cz + side * 3.5, { n: 10, color: ['#ffffff', '#a8c8f0', '#7aa0d0'], up: 34, speed: 40, life: 0.8, gravity: 50 });
        if (Math.random() < 0.3) g.audio?.play('wave');
      }
      if (Math.random() < dt * 0.4) g.shake = Math.min(0.8, (g.shake || 0) + 0.3);
      if (t - this.pt > 16) this.toPhase('strike');
    } else if (this.phase === 'strike') {
      const s = t - this.pt;
      if (s > 1.6) this.playable = false;
      this.burn(dt);
      if (s > 1.6 && !this.lurched) {
        this.lurched = true;
        g.shake = 1.5;
        g.audio?.play('crumble');
        g.audio?.play('creak');
        this.say('The deck tilts under you. Somebody is screaming your name.', '#ffb080');
      }
      this.fade = Math.max(0, Math.min(1, (s - 2.4) / 2));
      if (s > 4.6) this.toPhase('black');
    } else if (this.phase === 'black') {
      this.fade = 1;
      const s = t - this.pt;
      if (s > this.words.length * 3.6 + 1.5) this.finish();
    }
  }

  toPhase(ph) {
    const g = this.game;
    this.phase = ph;
    this.pt = this.t;
    if (ph === 'gather') {
      this.gm = g.minute;
      this.mood = 'storm';
      g.ui.closeAll?.();
      this.say(`The ship turns into ${this.gap}. The Wall closes over half the sky, and the wind comes from everywhere at once.`, '#c8d8ff');
      g.audio?.play('wind');
      g.audio?.play('thunder');
      g.audio?.play('bell');
      const cap = this.crew.find((c) => c.role === 'Captain');
      if (cap) cap.say('All hands! We\'re going in! Reef the canvas!', 3, '#ffd0a0');
    } else if (ph === 'storm') {
      g.ui.closeAll?.();
      this.say('The gap is closing. The Wall breaks over the ship.', '#c8d8ff');
      for (const c of this.crew) c.goal = null;
    } else if (ph === 'strike') {
      this.strike();
    } else if (ph === 'black') {
      this.mood = 'wreck';
      this.caption = null;
      const g2 = this.game;
      const first = String(g2.playerName).split(' ')[0];
      this.words = [
        'The Wall took the ship that night, halfway through the gap.',
        `The ${this.shipName} went down with ${this.captain.name} at the wheel and most of her crew.`,
        'You remember the cold. The black water closing over you. A spar under your hands, and the current carrying you in...',
        '...and then nothing at all. The gap closed behind you.',
        REASONS[g2.hero.kit] || REASONS.wanderer,
        `Now you have only what the sea gave back, ${first}.`,
      ];
    }
  }

  // A bolt somewhere out over the sea (or, `near`, close by): the flash,
  // and the thunder after.
  lightning(near) {
    const g = this.game;
    const r = g.renderer;
    const p = g.player;
    // (Down into the sea beyond the ship, from the top of the sky.)
    const h = this.voyage.hull;
    const ox = (Math.random() - 0.5) * (near ? 14 : 28);
    const oz = h.cz - 6 - Math.random() * (near ? 1 : 3) - p.z;
    const sx = p.x + ox + (Math.random() - 0.5) * 4;
    r.effect?.({ type: 'bolt', wx: sx, wy: 30, wz: p.z + oz - 4, tx: p.x + ox, ty: 5, tz: p.z + oz, life: near ? 0.4 : 0.3, oy: 0 });
    r.emit(p.x + ox, 5.6, p.z + oz, { n: 12, color: ['#ffffff', '#d8e8ff', '#a8c8f0'], up: 30, speed: 40, life: 0.6, gravity: 40, glow: true });
    r.flashScreen?.(near ? '#f0f4ff' : '#c8d4f0', near ? 0.2 : 0.1);
    g.audio?.play('thunder');
  }

  // The bolt that ends it: down on the mainmast, the canvas alight.
  strike() {
    const g = this.game;
    const r = g.renderer;
    const h = this.voyage.hull;
    r.effect?.({ type: 'bolt', wx: h.main - 2, wy: 34, wz: h.cz - 4, tx: h.main, ty: 15, tz: h.cz, life: 0.7, oy: 0 });
    r.effect?.({ type: 'bolt', wx: h.main + 3, wy: 32, wz: h.cz - 5, tx: h.main, ty: 13, tz: h.cz, life: 0.5, oy: 0 });
    r.effect?.({ type: 'bolt', wx: h.main, wy: 13, wz: h.cz, tx: h.main, ty: 8, tz: h.cz, life: 0.45, oy: 0 });
    r.flashScreen?.('#ffffff', 0.7);
    g.shake = 1.6;
    g.audio?.play('boom');
    g.audio?.play('thunder');
    g.audio?.play('scream');
    const w = g.world;
    // The head of the mainsail catches first; it spreads from there.
    this.burning = [];
    for (let y = 15; y >= 12 && !this.burning.length; y--) {
      for (let dx = -3; dx <= 3; dx++) if (w.getBlock(h.main + dx, y, h.cz) === B.sail) this.burning.push({ x: h.main + dx, y, t: Math.random() * 0.4 });
    }
    // The masthead, split and gone.
    for (const y of [15, 14]) if (w.getBlock(h.main, y, h.cz) === B.log_oak) w.setBlock(h.main, y, h.cz, B.air);
    r.emit(h.main, 14, h.cz + 0.55, { n: 30, color: ['#ffe080', '#ffb040', '#ff7020', '#ffffff'], up: 40, speed: 60, life: 0.9, gravity: 40, glow: true });
    r.emit(h.main, 13, h.cz + 0.55, { n: 14, color: ['#6a4a2a', '#50361e', '#3a2a1a'], up: 30, speed: 50, life: 1.2, gravity: 60 });
    for (const c of this.crew) {
      c.emoteShow('!', '#ff5040', 2);
      if (Math.random() < 0.5) c.say(c.shouts[0] || 'No!', 2, '#ff8060');
    }
    this.say('Lightning strikes the mainmast!', '#ffe070');
  }

  // The mainsail burning: the fire running down and across the canvas,
  // smoke and sparks off it, and each piece burned through falling away.
  burn(dt) {
    const g = this.game;
    const w = g.world;
    const h = this.voyage.hull;
    const list = this.burning || [];
    for (const b of list) {
      b.t += dt;
      if (Math.random() < dt * 6) g.renderer.emit(b.x, b.y + 0.6, h.cz + 0.55, { n: 2, color: ['#ffe080', '#ffb040', '#ff7020'], up: 34, speed: 12, life: 0.5, gravity: -50, glow: true });
      if (Math.random() < dt * 2) g.renderer.emit(b.x, b.y + 1.2, h.cz + 0.55, { n: 1, color: ['#4a4440', '#2a2624', '#6a6460'], up: 18, speed: 8, life: 1.8, gravity: -14, shape: 'puff', grow: 1.8 });
    }
    this.spreadT = (this.spreadT || 0) - dt;
    if (this.spreadT <= 0 && list.length) {
      this.spreadT = 0.07;
      const b = list[Math.floor(Math.random() * list.length)];
      const [dx, dy] = [[1, 0], [-1, 0], [0, -1], [0, -1], [0, 1]][Math.floor(Math.random() * 5)];
      const x = b.x + dx;
      const y = b.y + dy;
      if (w.getBlock(x, y, h.cz) === B.sail && !list.some((q) => q.x === x && q.y === y)) list.push({ x, y, t: 0 });
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (b.t < 1.7) continue;
      list.splice(i, 1);
      if (w.getBlock(b.x, b.y, h.cz) === B.sail) w.setBlock(b.x, b.y, h.cz, B.air);
      g.renderer.emit(b.x, b.y, h.cz + 0.55, { n: 8, color: ['#ff7020', '#ffb040', '#3a3634'], up: 8, speed: 24, life: 0.9, gravity: 40, glow: true });
    }
  }

  // Flames over the burning canvas (drawn over the world, under the bars).
  drawFlames(ctx) {
    const list = this.burning;
    if (!list || !list.length || this.fade >= 1) return;
    const r = this.game.renderer;
    const h = this.voyage.hull;
    const time = this.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of list) {
      const s = r.worldToScreen(b.x, b.y, h.cz);
      const cx = Math.round(s.x + 8);
      const base = Math.round(s.y + 22);
      const k = Math.min(1, b.t * 3) * (b.t > 1.3 ? Math.max(0, (1.7 - b.t) / 0.4) : 1);
      if (k <= 0) continue;
      const glow = ctx.createRadialGradient(cx, base - 6, 0, cx, base - 6, 18);
      glow.addColorStop(0, `rgba(255,140,40,${0.35 * k})`);
      glow.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 18, base - 24, 36, 36);
      for (let j = 0; j < 3; j++) {
        const hgt = Math.round((9 + 7 * Math.abs(Math.sin(time * 9 + b.x * 3.1 + j * 2.3 + b.y))) * k);
        const ox = (j - 1) * 4 + Math.round(Math.sin(time * 13 + j + b.y) * 1.5);
        for (let q = 0; q < hgt; q++) {
          const f = q / Math.max(1, hgt);
          const wd = Math.max(1, Math.round((j === 1 ? 5 : 3) * (1 - f)));
          ctx.fillStyle = f < 0.3 ? '#ffe890' : f < 0.65 ? '#ffa030' : '#ff5014';
          ctx.globalAlpha = 0.85 * k;
          ctx.fillRect(cx + ox - (wd >> 1), base - q, wd, 1);
        }
      }
    }
    ctx.restore();
  }

  shout() {
    const c = this.crew[Math.floor(Math.random() * this.crew.length)];
    if (!c || c.bubble) return;
    c.say(c.shouts[Math.floor(Math.random() * c.shouts.length)] || '!', 2.4, '#ffd0a0');
    if (Math.random() < 0.4) c.emoteShow('!', '#ff8060', 1.5);
  }

  drawUnder(ctx) {
    if (this.phase === 'strike') this.drawFlames(ctx);
  }

  drawOver(ctx) {
    if (this.phase === 'strike') {
      const k = Math.min(1, (this.t - this.pt) * 2) * (0.75 + Math.random() * 0.25);
      ctx.fillStyle = `rgba(255,110,30,${0.1 * k * (1 - this.fade)})`;
      ctx.fillRect(0, 26, VIEW_W, VIEW_H - 52);
    }
    if (this.phase !== 'black') return;
    const s = this.t - this.pt;
    const lines = [];
    this.words.forEach((txt, i) => {
      const a = Math.max(0, Math.min(1, (s - i * 3.6) / 1.2));
      if (a > 0) lines.push({ txt, a, i });
    });
    let y = VIEW_H / 2 - this.words.length * 10;
    for (const q of lines) {
      const ls = wrap(q.txt, 74);
      ctx.globalAlpha = q.a;
      for (const l of ls) {
        drawText(ctx, l, Math.round(VIEW_W / 2 - (l.length * CHAR_W) / 2), Math.round(y), q.i === 4 ? '#a0c8ff' : '#e8d8b0');
        y += 10;
      }
      y += 6;
    }
    ctx.globalAlpha = 1;
  }

  // Ashore: the place apart's gone, the world's as it was (and it's still
  // the morning you began on), and you're waking on wet sand.
  finish() {
    if (this.done) return;
    this.done = true;
    const g = this.game;
    g.ui.closeAll?.();
    for (const c of this.crew || []) {
      g.removeOcc(c);
      c.dead = true;
    }
    this.crew = [];
    g.fires = [];
    g.world.setInstance(null);
    g.cutscene = null;
    g.minute = this.clock.minute;
    g.day = this.clock.day;
    g.weather = null;
    g.shake = 0;
    if (this.stash) {
      g.creatures = this.stash.creatures.filter((c) => !c.dead);
      g.drops = this.stash.drops.filter((d) => !d.dead);
      this.stash = null;
    }
    const at = this.beach;
    g.loadAround(at.x, at.z, true);
    for (const c of g.creatures) if (!c.dead) g.moveEntity(c, c.x, c.y, c.z);
    g.player.teleport(at.x, at.y, at.z);
    g.player.dir = 0;
    g.renderer.camInit = false;
    g.lightDirty = true;
    g.updateSettlements(true);
    g.ui.showHud = true;
    g.ui.hudP = 0;
    g.ui.fade = 2.2;
    g.introduce();
    g.ui.msg('Press H for help.', '#a0c8ff');
  }
}
