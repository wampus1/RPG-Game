// (Round 123) The openings of the three newer origins (see origins.js):
// who's told what, when, what's heard, and the shots cut between. (Round
// 124) Painted like the others (see intros.js and starfall.js), each shot
// a backdrop painted once a pixel at a time at half the screen's size and
// what moves drawn over it each frame: see render/art_leader.js,
// art_brigand.js and art_outworld.js. The one being played as is in each,
// as they look (their own sprite: an outworlder's mutations and all).
//
// A leader: the square before the great hall at the golden hour, packed,
// you walking up it; the great door, close, you kneeling, the crown (or
// the chain of office) coming down; the square at dusk, fireworks.
//
// A brigand: an hour before dawn on a moonlit sea, your sloop running down
// a fat merchantman, a shot across her bow, and she strikes her colours;
// the cove at sunrise, the haven, the boat in to the jetty; the jetty,
// close, the brethren cheering you home.
//
// An outworlder: high over Thessa, your ship breaking apart, your pod
// flung clear; night over a lake, the pod coming down beyond the hills;
// the crater, the hatch blown, and you, climbing out into the air of a
// strange world.
import { VIEW_W, VIEW_H, CHAR_W } from '../config.js';
import { RNG, hash4 } from '../util/rng.js';
import { drawText } from '../render/font.js';
import { humanoidSheet, SHEET_H } from '../render/sprites.js';
import { present, caption, bigText, darkWords } from './intros.js';
import { paintLeader, drawSquare, drawDoorway } from '../render/art_leader.js';
import { paintBrigand, drawChase, drawCove, drawJetty } from '../render/art_brigand.js';
import { paintOutworld, drawOrbit, drawFall, drawCrater } from '../render/art_outworld.js';

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

// (Round 142) How fast an opening plays: slower than the clock, so there's
// time to read what's said (the shots, the words in the dark, all of it).
export const PACE = 0.62;

// The scene object every opening is (see cutscene.js).
function scene(kind, info, { dur, words, mood, update, draw, intro = true }) {
  return {
    kind, intro, t: 0, dur, lock: true, info, words, speed: PACE,
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

// The shots: high over Thessa, the ship breaking up (to ENTRY); night
// over a lake, the pod coming down (to CRATER); the crater (to BLACK).
const OUT = { ALARM: 2.4, BLAST: 4.0, POD: 4.3, ENTRY: 8.0, CRASH: 12.4, CRATER: 14.4, OPEN: 15.8, CLIMB: 16.4, STAND: 18.2, BLACK: 23 };

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
    [OUT.ALARM, 'Ship\'s voice', 'HULL BREACH. HULL BREACH. ALL HANDS TO THE PODS.'],
    [OUT.POD + 0.4, null, 'Your ship comes apart around you. Your pod is flung clear.'],
    [OUT.ENTRY + 0.4, null, 'Night over Thessa. Something is falling that is not a star.'],
    [OUT.CRATER + 0.4, null, 'The pod lies hissing in a crater of its own making.'],
    [OUT.CLIMB + 0.4, null, 'You haul yourself out into the air of a strange world.'],
    [OUT.STAND + 2.4, null, 'High overhead, the last of your ship is still falling.'],
  ];
  let art = null;
  return scene('outworld_intro', info, {
    dur: OUT.BLACK + words.length * LINE + 2, words,
    mood: (t) => (t < OUT.CRASH ? 'cs_spire' : 'cs_starfall_dark'),
    update(g) {
      if (this.t > OUT.ALARM && !this.alarm) {
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
      }
      if (this.t > OUT.OPEN && !this.open) {
        this.open = true;
        g.audio?.play('door');
      }
    },
    draw(ctx) {
      if (!art) art = paintOutworld(info);
      drawOut(ctx, this, art, lines);
    },
  });
}

function drawOut(ctx, sc, art, lines) {
  const info = sc.info;
  const t = sc.t;
  const c = bufOf('outworld');
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, PW, PH);
  const since = (at) => (t >= at ? t - at : -1);
  let zoom = 1;
  let fx = PW / 2;
  let fy = PH / 2;
  let shake = 0;
  if (t < OUT.ENTRY) {
    drawOrbit(g, art, { t, alarm: clamp01((t - OUT.ALARM) / 1.2), blast: since(OUT.BLAST), pod: since(OUT.POD) });
    shake = t > OUT.BLAST && t < OUT.BLAST + 0.8 ? 1 - (t - OUT.BLAST) / 0.8 : 0;
    zoom = 1 + 0.08 * ease(clamp01((t - OUT.BLAST) / 3));
    fx = lerp(PW / 2, 170, ease(clamp01((t - OUT.POD) / 3.5)));
    fy = lerp(PH / 2, 92, ease(clamp01((t - OUT.POD) / 3.5)));
  } else if (t < OUT.CRATER) {
    drawFall(g, art, { t: t - OUT.ENTRY, fall: clamp01((t - OUT.ENTRY) / (OUT.CRASH - OUT.ENTRY)), hit: since(OUT.CRASH) });
    shake = t > OUT.CRASH && t < OUT.CRASH + 1.2 ? 1.2 - (t - OUT.CRASH) : 0;
  } else {
    const k = t - OUT.CRATER;
    drawCrater(g, art, { t: k, cool: clamp01(k / 8), open: since(OUT.OPEN), climb: clamp01((t - OUT.CLIMB) / 1.6), stand: since(OUT.STAND), look: info.look }, sprite);
    shake = t > OUT.OPEN && t < OUT.OPEN + 0.3 ? 0.4 : 0;
    zoom = 1.06 - 0.06 * ease(clamp01(k / 7));
    fy = PH / 2 + 10;
  }
  let fade = clamp01(t / 1.2) * (t > OUT.BLACK - 1.5 ? clamp01((OUT.BLACK - t) / 1.5) : 1);
  for (const cu of [OUT.ENTRY, OUT.CRATER]) if (Math.abs(t - cu) < 0.6) fade *= Math.abs(t - cu) / 0.6;
  present(ctx, c, { alpha: fade, zoom, fx, fy, shake });
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
