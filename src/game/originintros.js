// (Round 123) The openings of the three newer origins (see origins.js),
// painted like the others (see intros.js and starfall.js): a backdrop
// painted once, a pixel at a time, at half the screen's size, and what
// moves drawn over it each frame; what's said along the bottom; and in
// the dark at the end, what you're left with. The one being played as is
// in each, as they look (their own sprite: an outworlder's mutations and
// all).
//
// A leader: the great hall, full to the doors, evening light slanting in
// through its windows; you walk the carpet to the dais between the
// crowds, and the crown (or the chain of office) comes down; the hall
// erupts, and the petals fall.
//
// A brigand: an hour before dawn on a moonlit sea, your sloop running down
// a fat merchantman; a shot across her bow, and she strikes her colours;
// then the cove at sunrise, the brethren on the beach round their fire,
// the black flag snapping on its pole, as you come home.
//
// An outworlder: high over a world you've never seen, your ship breaking
// apart; a pod thrown clear and falling, a green-violet fire across the
// night sky of Thessa; the crater, the hatch blown off, and you, climbing
// out into the air of a strange world.
import { VIEW_W, VIEW_H, CHAR_W } from '../config.js';
import { RNG, hash4 } from '../util/rng.js';
import { drawText } from '../render/font.js';
import { drawPerson } from '../render/scenekit.js';
import { Bmp, sky as skyBands, stars as paintStars, mountains, hills, palm, bush, pine, fbm, hash2, mixC, rgb as rgbOf } from '../render/brush.js';
import { humanoidSheet, SHEET_H } from '../render/sprites.js';
import { present, caption, bigText, darkWords } from './intros.js';
import { paintLeader, drawSquare, drawDoorway } from '../render/art_leader.js';
import { paintBrigand, drawChase, drawCove, drawJetty } from '../render/art_brigand.js';

const PW = VIEW_W / 2;
const PH = VIEW_H / 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a, b, k) => a + (b - a) * k;
const enter = (pressed) => !!(pressed && pressed.some((k) => k.code === 'Enter' || k.code === 'NumpadEnter'));
const LINE = 3.4;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function bufOf(key) {
  const k = `_buf_${key}`;
  return bufOf[k] || (bufOf[k] = makeCanvas(PW, PH));
}

// The one being played as: their own sprite (`dir`: 0 front, 1 side, 2
// back, 3 the other side), `scale` times, their feet at (x, yb).
function sprite(g, look, dir, frame, x, yb, scale = 1, alpha = 1) {
  if (!look) return;
  let sheet = null;
  try {
    sheet = humanoidSheet(look);
  } catch {
    return;
  }
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha = alpha;
  g.drawImage(sheet, frame * 16, dir * SHEET_H, 16, SHEET_H, Math.round(x - 8 * scale), Math.round(yb - SHEET_H * scale), Math.round(16 * scale), Math.round(SHEET_H * scale));
  g.restore();
}

// A soft round glow.
function glow(g, x, y, r, col, a) {
  if (a <= 0 || r <= 0) return;
  const [cr, cg, cb] = rgbOf(col);
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
  gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function px(g, x, y, col, a = 1) {
  g.globalAlpha = a;
  g.fillStyle = col;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
  g.globalAlpha = 1;
}

// The bottom line, said by whoever's speaking now (`lines`: [t, who,
// text]), and the words in the dark after `black`.
function talk(ctx, sc, lines, black, fade) {
  let cur = null;
  for (let i = 0; i < lines.length; i++) if (sc.t >= lines[i][0]) cur = i;
  if (cur !== null && sc.t < black) {
    const [at, who, text] = lines[cur];
    const next = cur + 1 < lines.length ? lines[cur + 1][0] : black;
    const parts = who ? [[`${who}: `, '#ffd890'], [text, '#f4ecd8']] : [[text, '#c8d8ff']];
    caption(ctx, parts, sc.t - at, clamp01((next - sc.t) * 2.5) * fade);
  }
  drawText(ctx, 'ENTER skip', VIEW_W - 10 * CHAR_W - 6, 7, '#5a5040');
  if (sc.t > black) darkWords(ctx, sc.words, sc.t - black, LINE, sc.words.length - 1);
}

// The scene object every opening is (see cutscene.js).
function scene(kind, info, { dur, words, mood, update, draw, intro = true }) {
  return {
    kind, intro, t: 0, dur, lock: true, info, words,
    get mood() {
      return mood(this.t);
    },
    update(g, dt, pressed) {
      if (enter(pressed)) {
        this.t = this.dur;
        return;
      }
      if (update) update.call(this, g, dt);
    },
    end(g) {
      g.ui.fade = Math.max(g.ui.fade || 0, 1.8);
      g.introduce();
    },
    draw(ctx) {
      draw.call(this, ctx);
    },
  };
}

// ============================================================ a leader
// What's told: who, where, how it's governed, the words said.
export function leaderInfo(game) {
  const h = game.hero || {};
  const at = game.originAt || {};
  const sim = game.sim;
  const first = String(game.playerName || '').split(' ')[0] || 'you';
  const L = at.sid !== undefined && at.sid !== null ? sim.layoutOf(at.sid) : null;
  const place = L ? L.settlement.name : 'the town';
  const civ = at.scope === 'realm' && at.civ !== null && at.civ !== undefined ? game.world.ow.civs[at.civ] : null;
  let title;
  let color;
  let glyph;
  let formName;
  let rule;
  let style;
  let n = 1;
  if (civ) {
    const R = sim.realms.realm(civ);
    style = R.form || 'monarchy';
    title = R.headStyle || ({ monarchy: 'Monarch', republic: 'Speaker', elder: 'High Elder', theocracy: 'Hierarch', league: 'Doge' }[style] || 'Monarch');
    color = { monarchy: '#ffd070', republic: '#a0c8ff', elder: '#c8a0ff', theocracy: '#f0e8ff', league: '#ffd070' }[style] || '#ffd070';
    glyph = { monarchy: '★', republic: '◆', elder: 'Ω', theocracy: '✦', league: '¤' }[style] || '★';
    formName = { monarchy: 'monarchy', republic: 'republic', elder: 'clan moot', theocracy: 'holy realm', league: 'merchant league' }[style] || 'monarchy';
    rule = { monarchy: 'You decree, and it is done.', republic: 'The council votes; you decide a tie.', elder: 'The heads of its towns vote with you.', theocracy: 'You decree; the high priest may veto.', league: 'The towns vote, each by the weight of its gold.' }[style];
    n = sim.realms.members(civ).length;
  } else {
    const T = sim.office.of(at.sid);
    style = T ? T.charter : 'council';
    const ch = { council: ['Mayor', '#e8c070', '♦', 'a mayor and council'], assembly: ['Moot-speaker', '#a0e0a0', '☺', 'a town moot'], guild: ['Guildmaster', '#ffd070', '¤', 'a guild town'], theocracy: ['Hierarch', '#f0e8ff', '✦', 'the temple'], autocracy: ['Protector', '#ff8a70', '♜', 'a protectorate'], lordship: ['Liege', '#d8b0ff', '♠', 'a lordship'], commune: ['First Speaker', '#ff9a7a', '•', 'a commune'] }[style] || ['Mayor', '#e8c070', '♦', 'a mayor and council'];
    [title, color, glyph, formName] = ch;
    if (T && T.holder && T.holder.style) title = T.holder.style;
    rule = { council: 'Four councillors vote with you.', assembly: 'Every grown townsperson votes.', guild: 'The guild masters vote, by their purses.', theocracy: 'The temple sits with you; the priest may veto.', autocracy: 'You decide everything by decree.', lordship: 'You rule by right, by decree.', commune: 'Each faction has one voice.' }[style];
  }
  const officiant = civ ? (style === 'theocracy' ? 'The high priest' : style === 'republic' ? 'The eldest councillor' : style === 'league' ? 'The guild-warden' : style === 'elder' ? 'The eldest of the clans' : 'The chancellor') : style === 'theocracy' ? 'The priest' : 'The steward';
  const oath = civ
    ? { monarchy: `By the old law of the ${civ.name.replace(/^The /, '')}, I crown you ${title}.`, republic: `The council of the ${civ.name.replace(/^The /, '')} has chosen. I name you its Speaker.`, elder: 'The clans have spoken. Lead us, High Elder.', theocracy: `In the light of the temple, I anoint you Hierarch.`, league: 'The guilds have weighed their gold, and chosen you: Doge.' }[style]
    : { council: `By the charter of ${place}, I name you its ${title}.`, assembly: `The moot has spoken: you speak for ${place} now.`, guild: `The guild masters have chosen you: Guildmaster of ${place}.`, autocracy: `${place} is yours to protect, Protector.`, lordship: `${place} is yours by right, my liege.`, commune: `Every voice in ${place} is yours to carry now.`, theocracy: `The temple gives ${place} into your keeping, Hierarch.` }[style];
  return {
    first, look: game.player && game.player.baseLook ? game.player.baseLook : h.look || null, place, realm: civ ? civ.name.replace(/^The /, '') : null, n,
    title, color, glyph, formName, rule, style, officiant, oath: oath || `I name you ${title}.`, crown: !!civ && (style === 'monarchy' || style === 'theocracy'),
    seed: hash4(game.seed >>> 0, first.length, 0x1ead) >>> 0,
  };
}

// The shots: the square at the golden hour, you walking up it (to CUT1);
// the doorway, close, the crown coming down (to CUT2); the square at dusk,
// fireworks over the hall (to BLACK).
const LEAD = { WALK0: 2.0, WALK1: 10.0, CUT1: 10.6, CROWN0: 12.4, CROWN1: 14.0, RISE: 15.0, CHEER: 15.6, CUT2: 17.6, BLACK: 23.5 };

export function leaderScene(game, info) {
  const words = info.realm
    ? [
      `The ${info.realm} is yours now: ${info.n} town${info.n === 1 ? '' : 's'}, their decrees, their quarrels, their loyalty.`,
      `It is governed as a ${info.formName}. ${info.rule}`,
      'Every morning the court sits, and its matters come to you. What you leave, your chancellor decides.',
      'Rule well, and they will love you for it. Rule badly, and they will find a way to be rid of you.',
      `${info.first}. ${info.title}.`,
    ]
    : [
      `${info.place} is yours to govern now, as ${info.formName}. ${info.rule}`,
      'Every morning at ten the council sits, and the town\'s troubles come to you: its money, its laws, its people.',
      'Your steward keeps the hall when you are away.',
      'Serve it well, and it will keep you. Fail it, and it will find someone who won\'t.',
      `${info.first}. ${info.title} of ${info.place}.`,
    ];
  const lines = [
    [1.0, null, `${info.realm ? `The seat of the ${info.realm}` : info.place}. The square, full to the walls.`],
    [3.4, 'The herald', `Make way! Make way for ${info.first}!`],
    [6.6, null, info.realm ? `Every town of the ${info.realm} has sent someone to see this.` : `Half of ${info.place} has squeezed in to see this.`],
    [LEAD.CUT1 + 0.8, info.officiant, info.oath],
    [LEAD.CHEER, 'The crowd', `Long live ${info.title} ${info.first}!`],
    [LEAD.CUT2 + 0.6, null, 'Night falls, and the square is still singing.'],
  ];
  let art = null;
  return scene('leader_intro', info, {
    dur: LEAD.BLACK + words.length * LINE + 2, words,
    mood: (t) => (t < LEAD.BLACK ? 'cs_victory' : 'cs_home'),
    update(g) {
      if (this.t > LEAD.CROWN1 && !this.crowned) {
        this.crowned = true;
        g.audio?.play('fanfare');
      }
      if (this.t > LEAD.CHEER && !this.cheered) {
        this.cheered = true;
        g.audio?.play('chime');
      }
      if (this.t > LEAD.CUT2 + 1 && !this.bang) {
        this.bang = true;
        g.audio?.play('boom');
      }
    },
    draw(ctx) {
      if (!art) {
        art = paintLeader(info);
        art.robe = ROBE;
      }
      drawLeader(ctx, this, art, lines);
    },
  });
}

// The officiant: robed, bearded, the colours at the hem.
const ROBE = { skin: '#e0b090', hair: '#c8c8c8', hairStyle: 'bald', shirt: '#e0dccc', pants: '#3a3a4a', shoes: '#2a1a10', outfit: 'robe_white', accent: '#c8a030', hat: null, beard: true, beardStyle: 'long', eyeColor: '#3a5a9a' };

function drawLeader(ctx, sc, art, lines) {
  const info = sc.info;
  const t = sc.t;
  const c = bufOf('leader');
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, PW, PH);
  let zoom = 1;
  let fx = PW / 2;
  let fy = PH / 2;
  if (t < LEAD.CUT1) {
    const walk = ease(clamp01((t - LEAD.WALK0) / (LEAD.WALK1 - LEAD.WALK0)));
    drawSquare(g, art, { t, dusk: 0, walk, cheer: 0, look: info.look, fireworks: 0 });
    // (Drawn slowly in toward the hall as you go.)
    zoom = 1 + 0.07 * ease(clamp01(t / LEAD.CUT1));
    fy = 74;
  } else if (t < LEAD.CUT2) {
    const crown = clamp01((t - LEAD.CROWN0) / (LEAD.CROWN1 - LEAD.CROWN0));
    const cheer = clamp01((t - LEAD.CHEER) / 0.8);
    drawDoorway(g, art, { t, crown, since: t - LEAD.CROWN1, risen: clamp01((t - LEAD.RISE) / 0.4), raise: t > LEAD.CHEER - 0.2, cheer }, sprite, info);
    zoom = 1 + 0.05 * ease(clamp01((t - LEAD.CUT1) / (LEAD.CUT2 - LEAD.CUT1)));
    fx = PW / 2 - 12;
    fy = PH / 2 + 8;
  } else {
    const k = t - LEAD.CUT2;
    drawSquare(g, art, { t, dusk: lerp(0.75, 1, clamp01(k / 3)), walk: 1, cheer: 1, look: info.look, fireworks: clamp01((k - 0.6) / 0.6) });
    zoom = 1.1 - 0.08 * ease(clamp01(k / 5));
    fy = lerp(74, 64, ease(clamp01(k / 5)));
  }
  let fade = clamp01(t / 1.2) * (t > LEAD.BLACK - 1.5 ? clamp01((LEAD.BLACK - t) / 1.5) : 1);
  for (const cu of [LEAD.CUT1, LEAD.CUT2]) if (Math.abs(t - cu) < 0.6) fade *= Math.abs(t - cu) / 0.6;
  present(ctx, c, { alpha: fade, zoom, fx, fy });
  if (t < 6) {
    ctx.globalAlpha = fade * clamp01((6 - t) / 1.2);
    bigText(ctx, `~ ${(info.realm || info.place).toUpperCase()} ~`, 30, info.color);
    ctx.globalAlpha = 1;
  }
  talk(ctx, sc, lines, LEAD.BLACK, fade);
}

// ============================================================ a brigand
export function brigandInfo(game) {
  const at = game.originAt || {};
  const first = String(game.playerName || '').split(' ')[0] || 'you';
  const rng = new RNG(hash4(game.seed >>> 0, first.length, 0xb1a));
  const names = ['Mags', 'Jory', 'Silas', 'Wren', 'Bess', 'Corwin', 'Nell', 'Tam'];
  return {
    first, look: game.player && game.player.baseLook ? game.player.baseLook : (game.hero || {}).look || null,
    ship: at.ship || 'The Black Wager', cove: (at.cove && at.cove.name) || 'the cove', hands: at.hands && at.hands.length ? at.hands : [rng.pick(names)],
    chief: rng.pick(names), realms: at.realms || [], flag: '#121212',
    seed: hash4(game.seed >>> 0, first.length, 0xb1b) >>> 0,
  };
}

// The shots: the chase by moonlight (to ACT2); the cove at sunrise (to
// CUT3); the jetty, close (to BLACK).
const BRIG = { SHOT1: 6.2, SPLASH1: 6.9, SHOT2: 8.0, STRIKE: 9.2, ACT2: 11.5, ANCHOR: 15.0, BOAT: 15.8, CUT3: 18.6, BLACK: 25 };

export function brigandScene(game, info) {
  const mate = info.hands[0];
  const words = [
    `${info.cove} has been your home for years, and the Black Gull Brethren your only family.`,
    `${info.ship} is yours: a sloop, quick and low, with ${info.hands.join(' and ')} to sail her.`,
    info.realms.length ? `${info.realms.join(' and ')} know your name, and have nailed it to their posts.` : 'The realms know your name, and have nailed it to their posts.',
    'Plunder, glory, or a noose at a harbour mouth: the sea will decide which.',
    `Hoist the black, Captain ${info.first}.`,
  ];
  const lines = [
    [1.2, null, 'An hour before dawn, off a lonely coast.'],
    [3.4, mate, 'Merchantman, dead ahead! Fat and low in the water. She hasn\'t seen us.'],
    [5.2, `Captain ${info.first}`, 'Run out the gun. Put one across her bow.'],
    [BRIG.SHOT2 + 0.2, mate, 'And one more, to be sure of her!'],
    [BRIG.STRIKE + 0.4, null, 'She strikes her colours without a fight.'],
    [BRIG.ACT2 + 0.6, null, `Sunrise over ${info.cove}, the haven of the Black Gull Brethren.`],
    [BRIG.BOAT + 0.4, info.chief, `There's ${info.first}! And a hold full of somebody else's silver!`],
    [BRIG.CUT3 + 0.6, 'The brethren', 'Ha-harrr! The captain\'s home!'],
    [BRIG.CUT3 + 3.6, info.chief, `Welcome back, Captain. The haven's missed you.`],
  ];
  let art = null;
  return scene('brigand_intro', info, {
    dur: BRIG.BLACK + words.length * LINE + 2, words,
    mood: () => 'cs_voyage',
    update(g) {
      if (this.t > BRIG.SHOT1 && !this.s1) {
        this.s1 = true;
        g.audio?.play('boom');
      }
      if (this.t > BRIG.SHOT2 && !this.s2) {
        this.s2 = true;
        g.audio?.play('boom');
      }
      if (this.t > BRIG.SPLASH1 && !this.sp) {
        this.sp = true;
        g.audio?.play('splash');
      }
      if (this.t > BRIG.ANCHOR && !this.an) {
        this.an = true;
        g.audio?.play('chain');
      }
      if (this.t > BRIG.CUT3 + 1.5 && !this.bang) {
        this.bang = true;
        g.audio?.play('boom');
      }
    },
    draw(ctx) {
      if (!art) art = paintBrigand(info);
      drawBrig(ctx, this, art, lines);
    },
  });
}

function drawBrig(ctx, sc, art, lines) {
  const info = sc.info;
  const t = sc.t;
  const c = bufOf('brigand');
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, PW, PH);
  let zoom = 1;
  let fx = PW / 2;
  let fy = PH / 2;
  const since = (at) => (t >= at ? t - at : -1);
  if (t < BRIG.ACT2) {
    drawChase(g, art, { t, gain: ease(clamp01(t / 10.5)), shot1: since(BRIG.SHOT1), shot2: since(BRIG.SHOT2), struck: since(BRIG.STRIKE), look: info.look });
    zoom = 1 + 0.06 * ease(clamp01((t - 5) / 5));
    fx = lerp(PW / 2, 150, ease(clamp01((t - 5) / 5)));
    fy = 92;
  } else if (t < BRIG.CUT3) {
    const k = t - BRIG.ACT2;
    drawCove(g, art, { t: k, come: clamp01(k / (BRIG.ANCHOR - BRIG.ACT2)), furled: t > BRIG.ANCHOR - 0.3, anchor: since(BRIG.ANCHOR), boat: t > BRIG.BOAT ? (t - BRIG.BOAT) / 2.4 : 0, cheer: clamp01((t - BRIG.BOAT - 1.4) / 0.6), look: info.look });
    zoom = 1 + 0.12 * ease(clamp01((t - BRIG.BOAT) / 2.6));
    fx = lerp(PW / 2, 150, ease(clamp01((t - BRIG.BOAT) / 2.6)));
    fy = lerp(PH / 2, 104, ease(clamp01((t - BRIG.BOAT) / 2.6)));
  } else {
    const k = t - BRIG.CUT3;
    drawJetty(g, art, { t: k, walk: clamp01(k / 3.2), chief: clamp01((k - 2.6) / 1.1), cheer: clamp01(k / 0.6), look: info.look }, sprite, info);
  }
  let fade = clamp01(t / 1.2) * (t > BRIG.BLACK - 1.5 ? clamp01((BRIG.BLACK - t) / 1.5) : 1);
  for (const cu of [BRIG.ACT2, BRIG.CUT3]) if (Math.abs(t - cu) < 0.6) fade *= Math.abs(t - cu) / 0.6;
  const shake = t > BRIG.SHOT1 && t < BRIG.SHOT1 + 0.3 ? 0.4 : t > BRIG.SHOT2 && t < BRIG.SHOT2 + 0.3 ? 0.4 : 0;
  present(ctx, c, { alpha: fade, zoom, fx, fy, shake });
  if (t < 6) {
    ctx.globalAlpha = fade * clamp01((6 - t) / 1.2);
    bigText(ctx, `~ ${info.ship.toUpperCase()} ~`, 30, '#e8e4d8');
    ctx.globalAlpha = 1;
  }
  talk(ctx, sc, lines, BRIG.BLACK, fade);
}

// ============================================================ an outworlder
export function outworldInfo(game) {
  const h = game.hero || {};
  const first = String(game.playerName || '').split(' ')[0] || 'you';
  const muts = (h.mutations || []).map((k) => ({ third_eye: 'a third eye', glow: 'skin that glows in the dark', chitin: 'plates of chitin', gills: 'gills', antennae: 'antennae', dense: 'a frame built for a heavier world', twin_hearts: 'two hearts' }[k])).filter(Boolean);
  return {
    first, look: game.player && game.player.baseLook ? game.player.baseLook : h.look || null, muts,
    near: (game.originAt && game.originAt.near) || null, seed: hash4(game.seed >>> 0, first.length, 0x0d7) >>> 0,
  };
}

const OUT = { BLAST: 4.0, POD: 4.3, ENTRY: 8.0, CRASH: 12.6, CRATER: 14.6, OPEN: 15.8, CLIMB: 16.4, STAND: 18.0, BLACK: 22 };

export function outworldScene(game, info) {
  const words = [
    'Your ship is gone. Your crew is gone. As far as you know, you are the only one of your kind on this world.',
    info.muts.length ? `Your body is not like theirs: ${info.muts.length > 1 ? `${info.muts.slice(0, -1).join(', ')} and ${info.muts[info.muts.length - 1]}` : info.muts[0]}.` : 'One look at you, and they will know you are not one of them.',
    'The people here will be slow to trust you, and slower still to follow you.',
    'But you are alive, and the air is breathable, and somewhere out there is a town.',
    `${info.first}. On this world, the name means nothing yet.`,
  ];
  const lines = [
    [0.8, null, 'Far above a world you have never seen.'],
    [2.4, 'Ship\'s voice', 'HULL BREACH. HULL BREACH. ALL HANDS TO THE PODS.'],
    [OUT.POD + 0.4, null, 'Your ship comes apart around you. Your pod is flung clear.'],
    [OUT.ENTRY + 0.4, null, 'Night over Thessa. Something is falling that is not a star.'],
    [OUT.CRATER + 0.4, null, 'The pod lies hissing in a crater of its own making.'],
    [OUT.CLIMB + 0.6, null, 'You haul yourself out into the air of a strange world.'],
  ];
  let art = null;
  return scene('outworld_intro', info, {
    dur: OUT.BLACK + words.length * LINE + 2, words,
    mood: (t) => (t < OUT.CRASH ? 'cs_spire' : 'cs_starfall_dark'),
    update(g) {
      if (this.t > 2.4 && !this.alarm) {
        this.alarm = true;
        g.audio?.play('error');
      }
      if (this.t > OUT.BLAST && !this.blast) {
        this.blast = true;
        g.audio?.play('boom');
      }
      if (this.t > OUT.CRASH && !this.crash) {
        this.crash = true;
        g.audio?.play('boom');
        g.audio?.play('crumble');
        g.shake = 1.2;
      }
      if (this.t > OUT.OPEN && !this.open) {
        this.open = true;
        g.audio?.play('door');
      }
    },
    draw(ctx) {
      if (!art) art = paintWorlds(info);
      drawOutworld(ctx, this, art, lines);
    },
  });
}

function paintWorlds(info) {
  const seed = info.seed;
  // Space, a nebula across it, and the curve of the world below.
  const S = new Bmp(PW, PH);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const n = fbm(x * 0.02, y * 0.03, seed);
    const m = fbm(x * 0.035 + 7, y * 0.02, seed + 1);
    let c = [6, 4, 14];
    if (n > 0.5) c = mixC(c, [80, 30, 110], (n - 0.5) * 1.6);
    if (m > 0.55) c = mixC(c, [20, 90, 110], (m - 0.55) * 1.4);
    S.set(x, y, c);
  }
  paintStars(S, PH, seed + 2, { band: false, n: 260 });
  const PX = 128;
  const PY = 330;
  const PR = 236;
  for (let y = 70; y < PH; y++) for (let x = 0; x < PW; x++) {
    const d = Math.hypot(x - PX, y - PY);
    if (d > PR + 4) continue;
    if (d > PR) {
      S.set(x, y, [120, 190, 255], 0.5 * (1 - (d - PR) / 4));
      continue;
    }
    const land = fbm(x * 0.03, y * 0.06, seed + 3);
    const cloudN = fbm(x * 0.05 + 3, y * 0.09, seed + 4);
    let c = land > 0.55 ? mixC([60, 110, 50], [120, 100, 60], (land - 0.55) * 3) : mixC([20, 60, 130], [30, 90, 160], land);
    if (cloudN > 0.6) c = mixC(c, [240, 244, 250], (cloudN - 0.6) * 2.5);
    // (Lit from the left; night creeping in from the right.)
    const lit = clamp01(1 - (x - 40) / 260);
    c = mixC([4, 6, 18], c, 0.25 + lit * 0.75);
    // (The air at the rim.)
    c = mixC(c, [140, 200, 255], clamp01((d - (PR - 12)) / 12) * 0.5);
    S.set(x, y, c);
  }
  // Thessa by night: hills, a far village's lights, the dark of the woods.
  const N = new Bmp(PW, PH);
  const HZ = 96;
  skyBands(N, [[0, [6, 8, 22]], [50, [16, 24, 50]], [HZ, [36, 50, 76]]], 0, PW);
  paintStars(N, HZ - 10, seed + 5, { band: true, n: 150 });
  mountains(N, { seed: seed + 6, base: HZ, top: HZ - 34, peaks: 5, pal: [[14, 16, 30], [20, 24, 40], [28, 32, 52], [38, 44, 66], [50, 58, 84]], air: [40, 52, 80], airK: 0.45 });
  hills(N, (x) => HZ - 2 + Math.sin(x * 0.03 + 1) * 4, PH, [[10, 14, 18], [14, 20, 22], [18, 26, 26], [24, 34, 30]], { seed: seed + 7, texture: 0.3 });
  const dark = [[8, 14, 14], [12, 20, 18], [16, 26, 22], [22, 34, 28], [30, 44, 34]];
  for (let x = -4; x < PW; x += 7) pine(N, x + (hash2(x, 1, seed) * 4 | 0), PH - 2 - (hash2(x, 2, seed) * 8 | 0), 18 + (hash2(x, 3, seed) * 14 | 0), dark, [[20, 16, 14], [30, 24, 20], [40, 30, 24]], seed + x);
  for (let i = 0; i < 7; i++) N.set(40 + i * 3 + (i % 2), HZ + 9 - (i % 3), [255, 200, 110]);
  // The crater, close: scorched earth, its rim, the trees behind.
  const C = new Bmp(PW, PH);
  skyBands(C, [[0, [6, 8, 20]], [70, [20, 28, 46]]], 0, PW);
  paintStars(C, 60, seed + 8, { band: false, n: 90 });
  for (let x = -6; x < PW; x += 9) pine(C, x, 74 + (hash2(x, 5, seed) * 6 | 0), 26 + (hash2(x, 6, seed) * 16 | 0), dark, [[20, 16, 14], [30, 24, 20], [40, 30, 24]], seed + x * 3);
  for (let y = 70; y < PH; y++) for (let x = 0; x < PW; x++) {
    const d = Math.hypot((x - 128) / 1.9, (y - 112) * 1.0);
    const n = fbm(x * 0.08, y * 0.12, seed + 9);
    let c = mixC([30, 34, 24], [44, 46, 30], n);
    if (d < 40) c = mixC([22, 18, 18], [52, 40, 32], clamp01((d - 22) / 18) * 0.7 + n * 0.3);
    if (d > 36 && d < 42) c = mixC(c, [72, 60, 46], 0.6);
    C.set(x, y, c);
  }
  return { space: S.canvas(), night: N.canvas(), crater: C.canvas() };
}

// The pod, close: a capsule half buried, its seams glowing, its hatch.
function pod(g, x, y, t, open) {
  const pulse = 0.6 + 0.4 * Math.sin(t * 3);
  g.save();
  g.translate(x, y);
  g.rotate(-0.18);
  g.fillStyle = '#4a4458';
  g.beginPath();
  g.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6a6480';
  g.beginPath();
  g.ellipse(-4, -5, 24, 8, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = '#8a84a0';
  g.fillRect(-18, -11, 20, 1);
  // Its seams, glowing.
  g.globalAlpha = pulse;
  g.fillStyle = '#7af0d0';
  for (const sx of [-16, -2, 12]) g.fillRect(sx, -12, 1, 22);
  g.fillRect(-24, 2, 48, 1);
  g.globalAlpha = 1;
  // Burn marks.
  g.fillStyle = 'rgba(10,6,4,0.55)';
  g.beginPath();
  g.ellipse(14, 4, 14, 8, 0.3, 0, Math.PI * 2);
  g.fill();
  // The hatch: shut; or blown up and back.
  if (!open) {
    g.fillStyle = '#5a5470';
    g.beginPath();
    g.ellipse(-4, -12, 9, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#7af0d0';
    g.globalAlpha = pulse;
    g.fillRect(-5, -13, 3, 1);
    g.globalAlpha = 1;
  } else {
    g.fillStyle = '#0a0812';
    g.beginPath();
    g.ellipse(-4, -12, 9, 4, 0, 0, Math.PI * 2);
    g.fill();
    glow(g, -4, -14, 12, '#7af0d0', 0.35 * pulse);
    g.fillStyle = '#5a5470';
    g.beginPath();
    g.ellipse(-20, -22, 8, 3, -0.9, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawOutworld(ctx, sc, art, lines) {
  const info = sc.info;
  const t = sc.t;
  const c = bufOf('out');
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  let shake = 0;
  if (t < OUT.ENTRY) {
    g.drawImage(art.space, 0, 0);
    // Your ship, drifting; burning; breaking apart.
    const sx = 70 + t * 5;
    const sy = 40 + Math.sin(t * 0.8) * 2;
    if (t < OUT.BLAST) {
      g.fillStyle = '#5a5070';
      g.beginPath();
      g.moveTo(sx - 26, sy + 2);
      g.lineTo(sx - 8, sy - 7);
      g.lineTo(sx + 22, sy - 3);
      g.lineTo(sx + 30, sy + 1);
      g.lineTo(sx + 18, sy + 6);
      g.lineTo(sx - 18, sy + 7);
      g.closePath();
      g.fill();
      g.fillStyle = '#8a80a8';
      g.fillRect(Math.round(sx - 8), Math.round(sy - 5), 26, 1);
      for (let i = 0; i < 5; i++) px(g, sx - 12 + i * 8, sy + 1, '#7af0d0', 0.6 + 0.4 * Math.sin(t * 6 + i));
      glow(g, sx - 28, sy + 2, 8, '#a080ff', 0.7);
      // Fire breaking out along her.
      if (t > 2.2) for (let i = 0; i < 5; i++) {
        const k = (t * 3 + i * 0.37) % 1;
        glow(g, sx - 10 + i * 9 + Math.sin(i * 5) * 3, sy + Math.cos(i * 3) * 3, 3 + k * 4, i % 2 ? '#ffb060' : '#ffffff', 0.8 * (1 - k));
      }
    } else {
      // The blast, and what's left of her flying apart.
      const s = t - OUT.BLAST;
      if (s < 0.4) {
        g.fillStyle = `rgba(255,255,255,${0.9 * (1 - s / 0.4)})`;
        g.fillRect(0, 0, PW, PH);
      }
      glow(g, sx, sy, 10 + s * 30, '#ffe0a0', Math.max(0, 0.9 - s * 0.3));
      g.strokeStyle = `rgba(200,220,255,${Math.max(0, 0.8 - s * 0.35)})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(sx, sy, 6 + s * 40, 0, Math.PI * 2);
      g.stroke();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + i;
        const r = 4 + s * (12 + (i % 5) * 6);
        const fx = sx + Math.cos(a) * r;
        const fy = sy + Math.sin(a) * r * 0.8;
        g.save();
        g.translate(fx, fy);
        g.rotate(s * (i % 2 ? 2 : -3) + i);
        g.fillStyle = i % 3 ? '#5a5070' : '#8a80a8';
        g.fillRect(-2, -1, 4 + (i % 3), 2);
        g.restore();
        if (i % 3 === 0) px(g, fx, fy, '#ffb060', Math.max(0, 1 - s * 0.4));
      }
      shake = Math.max(0, 0.8 - s);
    }
    // The pod, flung clear, falling toward the world.
    if (t > OUT.POD) {
      const k = clamp01((t - OUT.POD) / (OUT.ENTRY - OUT.POD));
      const ppx = lerp(sx + 4, 150, k);
      const ppy = lerp(sy + 4, 128, k * k);
      for (let i = 0; i < 14; i++) px(g, ppx - i * 1.4, ppy - i * 1.6 * (0.3 + k), i < 3 ? '#ffffff' : k > 0.7 ? '#a0ffd0' : '#c8b0ff', (1 - i / 14) * 0.8);
      glow(g, ppx, ppy, 4 + k * 6, k > 0.7 ? '#7af0c0' : '#c0a0ff', 0.7);
      g.fillStyle = '#e0e0f0';
      g.fillRect(Math.round(ppx) - 1, Math.round(ppy) - 1, 2, 2);
    }
  } else if (t < OUT.CRATER) {
    g.drawImage(art.night, 0, 0);
    // A fire across the sky: green and violet, its tail long, sparks shed.
    const k = clamp01((t - OUT.ENTRY) / (OUT.CRASH - OUT.ENTRY));
    const e = k * k;
    const fx = lerp(12, 186, e);
    const fy = lerp(6, 100, e);
    const pre = t < OUT.CRASH;
    if (pre) {
      // (Its light on the land.)
      g.fillStyle = `rgba(120,255,200,${0.12 * k})`;
      g.fillRect(0, 96, PW, PH);
      for (let i = 0; i < 50; i++) {
        const f = i / 50;
        const x = fx - (fx - 12) * f * 0.35 * (0.4 + k) + Math.sin(i + t * 9) * f;
        const y = fy - (fy - 6) * f * 0.35 * (0.4 + k);
        px(g, x, y, f < 0.15 ? '#ffffff' : f < 0.45 ? '#a0ffd8' : '#b080ff', (1 - f) * 0.9);
      }
      glow(g, fx, fy, 6 + k * 12, '#9affd8', 0.8);
      for (let i = 0; i < 6; i++) {
        const s = (t * 1.5 + i / 6) % 1;
        px(g, fx - s * 18 + Math.sin(i * 4) * 4 * s, fy - s * 12 + s * s * 10, i % 2 ? '#e0c0ff' : '#ffffff', 1 - s);
      }
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 3, 3);
    } else {
      // The strike behind the near hills: the dome of light, the dust.
      const s = t - OUT.CRASH;
      if (s < 0.6) {
        g.fillStyle = `rgba(220,255,240,${0.85 * (1 - s / 0.6)})`;
        g.fillRect(0, 0, PW, PH);
      }
      g.globalAlpha = Math.max(0, 0.8 - s * 0.4);
      g.strokeStyle = '#d0ffee';
      g.beginPath();
      g.ellipse(186, 100, 6 + s * 80, 3 + s * 40, 0, Math.PI, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
      for (let i = 0; i < 10; i++) {
        g.globalAlpha = Math.max(0, 0.4 - s * 0.15);
        g.fillStyle = '#5a5a60';
        g.beginPath();
        g.arc(186 + Math.sin(i * 2.1) * 10 * (1 + s), 100 - s * 10 - i * 2, 3 + s * 4, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      // (Birds, startled up out of the woods.)
      for (let i = 0; i < 6; i++) px(g, 150 + i * 9 + s * 20, 90 - s * 18 - (i % 3) * 3, '#0a0a10', Math.min(1, s * 3));
      shake = Math.max(0, 1 - s / 1.4);
    }
  } else {
    g.drawImage(art.crater, 0, 0);
    const open = t > OUT.OPEN;
    pod(g, 128, 106, t, open);
    // Smoke, rising and drifting.
    for (let i = 0; i < 10; i++) {
      const k = ((t * 0.18 + i / 10) % 1);
      g.globalAlpha = 0.25 * (1 - k);
      g.fillStyle = '#8a8890';
      g.beginPath();
      g.arc(150 + Math.sin(k * 5 + i) * 6 + k * 14, 100 - k * 70, 3 + k * 9, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // Embers in the scorched earth.
    for (let i = 0; i < 16; i++) px(g, 90 + ((i * 37) % 80), 110 + ((i * 13) % 26), Math.sin(t * 3 + i) > 0.3 ? '#ff8040' : '#7a2a10', 0.8);
    // The hatch blown: a burst of steam.
    if (open && t - OUT.OPEN < 1.6) {
      const s = t - OUT.OPEN;
      for (let i = 0; i < 8; i++) {
        g.globalAlpha = Math.max(0, 0.5 - s * 0.3);
        g.fillStyle = '#e8f0f0';
        g.beginPath();
        g.arc(124 + Math.sin(i * 1.3) * (4 + s * 10), 92 - s * 20 - i * 2, 2 + s * 5, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    // You, climbing out: rising out of the hatch, then standing, looking
    // round at a world you've never seen.
    if (t > OUT.CLIMB) {
      const k = ease(clamp01((t - OUT.CLIMB) / (OUT.STAND - OUT.CLIMB)));
      const hatchY = 95;
      const yb = lerp(hatchY + 46, hatchY + 2, k);
      glow(g, 124, yb - 30, 26, '#9affd8', 0.18);
      g.save();
      g.beginPath();
      g.rect(0, 0, PW, hatchY + 2);
      g.clip();
      const look = t > OUT.STAND ? ((Math.floor((t - OUT.STAND) * 0.9) % 3) === 1 ? 1 : (Math.floor((t - OUT.STAND) * 0.9) % 3) === 2 ? 3 : 0) : 0;
      sprite(g, info.look, look, 0, 124, yb, 1.6);
      g.restore();
    }
  }
  const cuts = [OUT.ENTRY, OUT.CRATER];
  let fade = clamp01(t / 1.2) * (t > OUT.BLACK - 1.5 ? clamp01((OUT.BLACK - t) / 1.5) : 1);
  for (const cu of cuts) if (Math.abs(t - cu) < 0.7) fade *= Math.abs(t - cu) / 0.7;
  present(ctx, c, { alpha: fade, shake });
  talk(ctx, sc, lines, OUT.BLACK, fade);
}

// ============================================================ which
export function originScene(game) {
  const h = game.hero;
  if (!h || !game.originAt) return null;
  if (h.origin === 'leader') return leaderScene(game, leaderInfo(game));
  if (h.origin === 'brigand') return brigandScene(game, brigandInfo(game));
  if (h.origin === 'outworlder') return outworldScene(game, outworldInfo(game));
  return null;
}

// Made again on a player's own screen, from what's told (see net/guest.js).
export function originSceneFrom(game, s) {
  if (!s || !s.info) return null;
  if (s.kind === 'leader_intro') return leaderScene(game, s.info);
  if (s.kind === 'brigand_intro') return brigandScene(game, s.info);
  if (s.kind === 'outworld_intro') return outworldScene(game, s.info);
  return null;
}
