// (Round 97) What's written down in a crypt, made from what the world knows
// of it: the god its temple was raised to (the one the town near it keeps,
// or kept), the saint whose bones it was built over, the order that kept
// the vigil there and its prior, the year the water came up through the
// floor, the names of the town's dead in the Register, a keeper's letter
// never sent, the paupers' grave-boards in the light well, and what waits
// at the bottom, as the last of them wrote it. And the riddles' answers,
// put where they'd be: which tomb the chalice lies in (the Register says
// how its dead lies), how many lights the vigil chapel keeps. Every crypt
// tells its own; the same crypt always tells the same.
import { RNG, hash4 } from '../../util/rng.js';
import { personName, CULTURES } from '../names.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The god the temple was raised to (from its story, or its name).
export function godOf(rec) {
  if (rec.origin && rec.origin.god) return rec.origin.god;
  const m = /temple of ((?:the )?[A-Z][\w'-]*(?: [A-Z][\w'-]*)?)/.exec((rec.origin && rec.origin.text) || '');
  if (m) return m[1];
  const n = /^(?:the )?(.+?)'s Crypt$/i.exec(rec.name || '');
  return n && !/drowned/i.test(n[1]) ? n[1] : 'the Lamp-Bearer';
}

// How the dead are laid on a tomb's lid (its effigy: see deeps/crypt.js).
export const POSES = ['with a sword laid down the body', 'with a book held to the breast', 'with the hands joined in prayer', 'with a crozier at the side'];
const ORDERS = ['the Keepers of the Lamp', 'the Sisters of the Vigil', 'the Brothers of the Still Flame', 'the Wardens of the Long Night', 'the Order of the Last Candle', 'the Quiet Brethren'];
const TRADES = ['cooper', 'miller', 'weaver', 'alderman', 'smith', 'midwife', 'carter', 'fuller', 'tanner', 'chandler', 'reeve', 'brewer', 'baker', 'fisher', 'mason', 'glover'];
const DIED = ['of the sweating sickness', 'in the hard winter', 'in childbed', 'old, and in their sleep', 'of a fall', 'at sea, and brought home', 'of the cough', 'in the fire at the mill', 'young', 'full of years'];
// What waits at the bottom, as the last of the keepers wrote it (the
// master's chosen from the crypt's own seed, so every floor's papers speak
// of the same one: see deeps/crypt.js).
const BELOW = {
  priest: ['The Prior has gone down to the reliquary with the books from the locked press. He says the saint can be made to wake, and that the saint will stop the water.', 'The Prior reads aloud in the undercroft at night, from a book none of us was let read. The water is to his knees and he does not stop.'],
  horror: ['Something came up with the water. It is in the lowest chapel. It does not drown.', 'We heard it under the floor before the water came: something turning over, the way a sleeper does.'],
  hollow_saint: ['The saint\'s casket was open this morning, and nobody had opened it.', 'The saint walks. I have seen it, in the undercroft, with the water round it, and its face is not the face on the window.'],
  obsidian_abbess: ['Mother Abbess went down into the black glass and has not come up, and the glass rings when you walk on it.'],
  kiln_priest: ['The kiln under the lowest chapel is lit again. Nobody has carried wood down there in forty years.'],
  vitrified_horror: ['The heat below has made glass of the dead in their niches, and the glass moves.'],
  lantern_lord: ['There is a light in the deepest chapel that does not flicker, and something under it, holding it up.'],
  hollow_king: ['The old king they laid in the lowest vault has got up out of the mist, and the mist with him.'],
  drowned_choir: ['They sing in the flooded chapel. The brothers we lost to the water sing there, at the office hours, and not well.'],
  pale_vestal: ['The vestal\'s flame below went white and cold, and she has not let it go out, and she will not let anyone near it.'],
  marble_colossus: ['The great figure from the tomb of the founders has stepped down off its plinth.'],
  nine_tailed_fox: ['Something with many tails has made its den in the shrine of the ancestors. The offerings are eaten, and it laughs.'],
  hungry_ghost: ['The offerings are not enough. Every night it wants more, and it is thinner, and taller.'],
  whale_priest: ['The old whale-priest has come back to the bone chapel. He calls the sea, and the sea comes up the stair.'],
  kraken_spawn: ['There are arms in the flooded vault. Long ones, pale, feeling along the walls.'],
  salt_bride: ['The salt bride in the lowest niche has her veil off. She is looking for someone.'],
  flamingo_seraph: ['Something pink and very tall stands in the brine of the lowest chapel, on one leg, and watches.'],
  moth_queen: ['The moths have taken the lowest chapel. They have put out every candle there, and something bigger than any moth is among them.'],
  lamplighter: ['The old lamplighter still goes round below, though he died the winter before last.'],
  rune_witch: ['The runes cut on the lowest doors are new. Somebody cut them from the inside.'],
  banshee: ['A keening at night from below, and each time it keens, one of us is not at prayer in the morning.'],
  selkie_widow: ['A woman in a sealskin sits on the steps of the flooded vault and weeps, and the water rises when she weeps.'],
  drowned_bell: ['The bell that fell through the floor with the water still rings, under the water, at the hours.'],
};
const BELOW_ANY = ['Something is awake below the lowest chapel, and the candles there will not stay lit.', 'We have sealed the lowest door. Do not open it, whoever reads this.'];
const LETTER_TO = ['Dear Mother', 'My sister', 'Brother', 'Dear heart', 'Old friend', 'To whoever finds this'];
const LETTER = [
  'The water is in the undercroft again, and higher. We carry the candles up a step every day.',
  'Three of us keep the vigil now, where there were thirty. We sleep in turns, and badly.',
  'The candles go out in the lower chapels, though there is no draught, and when they go out we hear the lids move.',
  'The Prior says we are not to leave while one candle burns. I have stopped asking how long that is.',
  'I relit the candles in the long gallery tonight and the knocking stopped. It stops when the candles are lit. Remember that.',
];
const LETTER_END = [
  'Keep a light in the window for me.',
  'If I do not come up, light a candle for me in the town chapel. Only one. I have had enough of candles.',
  'Pray for us. Not for the dead. For us.',
  'Burn this. I would not have you afraid.',
];
const PRAYER = [
  'While one light burns, they sleep. Keep the light.',
  'Lamp of the dead, burn low, burn long; let them lie, let them lie.',
  'We keep the lamp that they may keep their rest.',
];

export function cryptLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x7c1));
  const town = rec.townName || null;
  const style = rec.style && CULTURES[rec.style] ? rec.style : 'vale';
  const y = rec.origin && rec.origin.y ? rec.origin.y : null;
  const god = godOf(rec);
  const name = () => personName(rng, style);
  const full = (p) => `${p.first}${p.last ? ` ${p.last}` : ''}`;
  // (The saint, the order, its prior, the founder: the same on every floor.)
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x7c2));
  const saint = `Saint ${personName(fixed, style).first}`;
  const order = fixed.pick(ORDERS);
  const prior = full(personName(fixed, style));
  const founderP = personName(fixed, style);
  const founder = full(founderP);
  const founded = y ? y - fixed.int(90, 320) : null;
  const yr = (k) => (y ? y - k : null);
  const below = () => rng.pick(BELOW[boss] || BELOW_ANY);
  const of = town ? ` of ${town}` : '';
  const entry = (k) => {
    const p = name();
    const t = rng.pick(TRADES);
    const when = yr(rng.int(k, k + 60));
    return `${full(p)}, ${t}${of}, died ${rng.pick(DIED)}${when ? ` in ${when}` : ''}.`;
  };
  return {
    god,
    saint,
    order,
    prior,
    // The altar's dedication, cut in its front.
    altar() {
      return { title: 'The Altar', lines: [`Raised to ${god} by ${founder}${founded ? ` in ${founded}` : ''}, over the bones of ${saint}. ${rng.pick(PRAYER)}`] };
    },
    // The saint in stone, a plate on the plinth.
    saintPlate() {
      return { title: saint, lines: [`${saint}, who kept the lamp lit in the dark${town ? ` for the people of ${town}` : ''}, and keeps it still. ${rng.pick(['Pray for us.', 'Let them lie.', 'Keep the light.'])}`] };
    },
    // The Register of the dead: a page of the town's dead, and in it, if
    // this floor has them, the answers: how the one who took the chalice
    // with them lies on their tomb; how many lights the vigil chapel keeps.
    register(effigy = null, lights = null) {
      const lines = [`The Register of the Dead${of}, kept by ${order}.`];
      for (let i = 0; i < 3; i++) lines.push(entry(20 + i * 30));
      if (effigy !== null) {
        const p = name();
        lines.push(`${full(p)}, benefactor, laid in the donors' chapel ${POSES[effigy]}. At their asking, the chalice they gave the altar was laid with them.`);
      }
      if (lights) lines.push(`The vigil chapel keeps ${['', 'one light', 'two lights', 'three lights', 'four lights', 'five lights', 'six lights', 'seven lights', 'eight lights'][lights]}, one for each of our founders. Let none be dark, or the grille stays shut.`);
      return { title: 'The Register', lines };
    },
    // A keeper's letter, left on their cot.
    letter() {
      const by = name();
      const lines = rng.shuffle([...LETTER]).slice(0, 2);
      return { title: 'A Letter', lines: [`${rng.pick(LETTER_TO)},`, ...lines, rng.pick(LETTER_END), `${by.first}, of ${order}.`] };
    },
    // The rota of the vigil, pinned up in the cells.
    rota() {
      const ks = [name(), name(), name()];
      return { title: 'The Vigil Rota', lines: [`Matins: ${ks[0].first}. Lauds: ${ks[1].first}. Compline: ${ks[2].first}. ${y ? `(After the water of ${y}: ` : '('}all hours, all of us, and the Prior's hours too, until he comes up.)`] };
    },
    // A pauper's grave-board in the light well.
    board() {
      const p = name();
      const age = rng.int(2, 80);
      return { title: 'A Grave-Board', lines: [`${full(p)}. ${age} ${age === 1 ? 'year' : 'years'}. ${rng.pick(['Asked for nothing.', 'Loved.', 'Paid for by the parish.', 'Under the sky, as they wished.', 'Rest.'])}`] };
    },
    // The last page: what's below, in the hand of whoever wrote last.
    last() {
      return { title: 'The Last Page', lines: [`${y ? `The ${['first', 'second', 'third', 'ninth', 'last'][rng.int(0, 4)]} day after the water, ${y}. ` : ''}${below()} ${rng.chance(0.5) ? `- ${prior}'s clerk` : '- the last of the keepers'}`] };
    },
    // The reliquary's plate.
    relic() {
      return { title: 'The Reliquary', lines: [`Here are kept the bones of ${saint}. Whoever takes them from this place takes the vigil with them, and the dead will know.`] };
    },
    // What the penitent says, going from chapel to chapel.
    murmur() {
      return rng.pick([`Forgive us, ${saint}.`, 'We let the lights go out.', 'I was at the door when the water came. I ran.', 'Down, and to the left, and kneel.', `${prior} said it would be well.`, 'Keep the light. Keep the light.']);
    },
    cap,
  };
}
