// Small talk, made up as it's said: a word-by-word Markov chain trained
// on a few dozen sample lines, so nobody says quite the same thing twice.
//
// A speaker's chain is a blend of styles:
//   - the common talk everyone shares;
//   - their people's (each culture has its own sayings, things it cares
//     about and words it uses, and a dialect that swaps words over);
//   - their register (formal, plain, rough, chirpy, terse, gruff: see
//     voice.js), which shapes how they put things;
//   - their quirks (pious, gloomy, cheerful, superstitious, romantic, ...).
// The blend is weighted, so a pious northern fisher sounds like all three.
//
// Adding a style is just adding lines: put a list under STYLES.culture,
// STYLES.register or STYLES.flavor (and a `lexicon` of word swaps, for a
// dialect). {town}, {god}, {dish}, {drink}, {feast}, {realm} and {weather}
// in a line are filled in from where it's said.
import { RNG, hash4 } from '../util/rng.js';
import { voiceOf } from './voice.js';

export const STYLES = {
  base: [
    'The well water tastes sweeter after the rain.',
    'I could do with a quiet day for once.',
    'My back aches from all that lifting.',
    'The prices at the market keep going up and up.',
    'Have you seen how fast the children are growing?',
    'I should mend that fence before the winter comes.',
    'The roads are busier than they used to be.',
    'Nobody tells me anything around here.',
    'I heard the mayor was in a foul mood again.',
    'A good meal and a warm bed, that is all I want.',
    'The days go by so quickly now.',
    'There is always something that needs doing.',
    'Some days I think I should have been a merchant.',
    'The {weather} has everyone in a strange mood.',
    'They say the {dish} at the tavern is better than ever.',
    'I could murder a cup of {drink} right now.',
    'Not long now until {feast}.',
    'I keep meaning to visit my cousin in the next town.',
    'The guards have been walking the streets more often.',
    'Old folk say the winters were colder when they were young.',
    'I found a coin in the road this morning.',
    'My neighbour snores so loudly I can hear it through the wall.',
    'You can tell a lot about a town by its bread.',
    'The roof leaks again and I have no time to fix it.',
    'Everyone in {town} knows everyone else\'s business.',
    'I would not trade {town} for any city.',
    'The cat keeps bringing mice to my door.',
    'I swear the chickens are plotting something.',
    'A merchant told me strange tales of the east.',
    'I should write a letter to my sister.',
    'The tavern was so loud last night I could not sleep.',
    'Work hard, eat well, sleep sound. That is the way of it.',
    'Somebody keeps taking the good bucket from the well.',
    'The {realm} could do more for little towns like ours.',
    'My grandmother always said the river remembers.',
    'I dreamt of the sea last night, and I have never seen it.',
    'The smith has been hammering since dawn.',
    'A traveller paid me twice what the job was worth.',
    'If the harvest holds, it will be a fine year.',
    'There is nothing like the smell of fresh bread in the morning.',
  ],
  culture: {
    vale: {
      lines: [
        'The orchard is heavy with apples this year.',
        'Nothing beats a slice of apple tart by the fire.',
        'We give thanks to {god} at every harvest.',
        'The sheep wandered off again, the silly things.',
        'A good hedge makes a good neighbour, my father said.',
        'The meadow flowers are out early this spring.',
        'Come {feast}, the whole valley dances till dawn.',
        'A bowl of {dish} and a mug of {drink}, and all is well.',
        'The mill wheel has been creaking all week.',
        'They say the old oak on the hill is older than {town}.',
        'My hens laid twice as many eggs this week.',
        'We are simple folk in the vale, and proud of it.',
      ],
      lexicon: [[/\bfriend\b/g, 'neighbour']],
    },
    north: {
      lines: [
        'The fjord froze early this year, and the boats sat idle.',
        'A northerner fears nothing but a cold hearth.',
        'We drink {drink} to the memory of those lost at sea.',
        '{god} watches the waves, and the brave are not forgotten.',
        'My father sailed further than any man in {town}.',
        'The herring run will be good, if the ice breaks soon.',
        'At {feast} we light fires on every hill.',
        'A warm bowl of {dish} is worth more than gold in winter.',
        'The wolves came close to the village again last night.',
        'Strong arms and a sharp axe, that is all a body needs.',
        'The nights are long, but the stories are longer.',
        'My grandmother could smell a storm a day away.',
      ],
      lexicon: [[/\byes\b/g, 'aye'], [/\bYes\b/g, 'Aye'], [/\blittle\b/g, 'wee'], [/\bchildren\b/g, 'bairns']],
    },
    sun: {
      lines: [
        'The heat today would bake bread on the doorstep.',
        'We drink {drink} in the shade and wait for evening.',
        'Under the stars, the desert is the most beautiful place in the world.',
        'Praise to {god}, the well has not run dry.',
        'My uncle crossed the dunes with forty camels once.',
        'A fresh plate of {dish} with flatbread, and I am content.',
        'At {feast} the lanterns turn the whole town to gold.',
        'The wind brought sand into everything again.',
        'Hospitality is the first law of our people.',
        'A guest at the door is a gift from {god}.',
        'The spice merchants are late this season.',
        'Even the palms look tired in this heat.',
      ],
      lexicon: [[/\bfriend\b/g, 'cousin'], [/\bFriend\b/g, 'Cousin']],
    },
    wild: {
      lines: [
        'The rains came early, and the maize drank deep.',
        'The jungle hums all night, you get used to it.',
        'We leave an offering to {god} before the hunt.',
        'A cup of hot {drink} and the day is good.',
        'The jaguar has been seen near the river again.',
        'At {feast} the drums do not stop till sunrise.',
        'My grandmother wove this cloth when she was a girl.',
        'The forest gives, and the forest takes back.',
        'Nobody cooks {dish} like my mother.',
        'The parrots woke me before the sun again.',
        'The old stones in the forest are older than any kingdom.',
        'Walk softly in the deep green, and it will let you pass.',
      ],
      lexicon: [[/\bfriend\b/g, 'brother-in-spirit']],
    },
    high: {
      lines: [
        'The deep seams sing when the ore is good.',
        'A hammer in the hand is worth two in the forge.',
        'We swear by {god} and the stone beneath our feet.',
        'Nothing warms you like a pot of {dish} after a day in the mines.',
        'My clan has worked these tunnels for twelve generations.',
        'At {feast} the forges burn all night long.',
        'The mountain does not forgive a careless step.',
        'A mug of {drink} and a good song, that is the way.',
        'Some say there is gold deeper than anyone has dug.',
        'Stone is honest. People, less so.',
        'The lanterns in the hall have never once gone out.',
        'My beard is my pride, and my axe is my honour.',
      ],
      lexicon: [[/\bHello\b/g, 'Well met'], [/\bfriend\b/g, 'stonefriend']],
    },
  },
  register: {
    formal: [
      'I must confess, the affairs of the council weigh upon me.',
      'One must keep up appearances, whatever the season.',
      'It would be most improper to say more.',
      'I trust the harvest will prove sufficient.',
      'Indeed, there is much to be said for patience.',
      'The library holds answers for those who look.',
      'Good order is the foundation of a good town.',
      'I have written to the council on the matter twice now.',
      'A measured word is worth more than a hasty deed.',
      'One hears all manner of rumours in the square.',
    ],
    plain: [
      'Well, you do what you can, don\'t you?',
      'It\'s been one of those weeks.',
      'Can\'t complain, though I do anyway.',
      'Just trying to get through the day.',
      'Somebody\'s got to do it, I suppose.',
      'It all works out in the end, mostly.',
      'There\'s no use crying over spilt milk.',
      'I\'ll believe it when I see it.',
    ],
    rough: [
      'Me hands are raw from all that work, I tell you.',
      'Ain\'t no rest for folk like us.',
      'Give me an honest day\'s graft over talk any time.',
      'The boss can shout all he likes, I ain\'t moving faster.',
      'A pint and a pie, that\'s all I\'m after.',
      'Them up at the hall don\'t know what real work is.',
      'Broke me best shovel this morning, didn\'t I.',
      'Bloody weather. Bloody prices. Bloody everything.',
    ],
    chirpy: [
      'I saw a really big beetle by the well!',
      'Do you wanna see my secret hiding place?',
      'When I grow up I am going to have a horse!',
      'My friend says the ruins are full of ghosts!',
      'I can run faster than anybody in {town}!',
      'I found a shiny stone, it might be treasure!',
      'Can you do a cartwheel? I can do three!',
      'Mum says I ask too many questions.',
    ],
    terse: [
      'Busy.',
      'Work to do.',
      'Not much to say.',
      'Weather\'s turning.',
      'Fine day.',
      'Same as ever.',
    ],
    gruff: [
      'Everyone wants something from me today.',
      'Bah, the young ones never listen.',
      'If it isn\'t one thing, it\'s another.',
      'I have no time for idle chatter.',
      'Things were better done in my day.',
      'Don\'t get me started on the taxes.',
      'Hmph. Strangers everywhere these days.',
      'Leave a man to his work, will you.',
    ],
  },
  flavor: {
    pious: [
      'I light a candle for {god} every morning.',
      'The temple roof needs mending, and I pray someone sees to it.',
      'Faith keeps a town together, more than walls.',
      'I give a tenth of what I earn to the temple.',
      '{god} sees all we do, kind or unkind.',
      'The priest says the old ways are the true ways.',
    ],
    gloomy: [
      'It will rain, it always rains.',
      'Nothing good lasts, does it?',
      'I expect the worst and I am rarely disappointed.',
      'The crows have been gathering. That is never good.',
      'We all end up in the graveyard sooner or later.',
    ],
    cheerful: [
      'What a lovely day to be alive!',
      'Every cloud has a silver lining, I always say.',
      'I just love the sound of the market in the morning.',
      'Smile, it might never happen!',
      'There is always something to be happy about.',
    ],
    superstitious: [
      'Never whistle near the graveyard after dark.',
      'A black cat crossed my path this morning. Bad omen.',
      'I put salt on the doorstep to keep the spirits out.',
      'The moon was red last night. Something is coming.',
      'Do not count the stars, or you will lose your luck.',
    ],
    romantic: [
      'Have you ever been in love? Truly in love?',
      'There is someone I cannot stop thinking about.',
      'The sunset over {town} is the most beautiful thing.',
      'I wrote a poem, but I am too shy to read it to anyone.',
      'Spring makes everyone a little foolish, I think.',
    ],
    gossipy: [
      'You did not hear this from me, but the baker has a secret.',
      'Someone has been sneaking out at night, I know who.',
      'I heard the most shocking thing at the well this morning.',
      'Between you and me, the mayor is not as clever as people think.',
    ],
    stingy: [
      'Coins do not grow on trees, you know.',
      'I paid far too much for this, and I shall not forget it.',
      'A penny saved is a penny earned.',
      'Everyone wants a loan, nobody wants to pay it back.',
    ],
    curious: [
      'I wonder what lies beyond the mountains.',
      'Do you know how they make glass? I have always wanted to know.',
      'Every traveller has a story, if you ask the right questions.',
      'I counted the stones in the square once. Did you know there are hundreds?',
    ],
  },
};

const QUIRKS = new Set(Object.keys(STYLES.flavor));

// ------------------------------------------------------------ the chain
const START = '^';
const END = '$';

function tokens(line) {
  return line.split(/\s+/).filter(Boolean);
}
// (Matching ignores case and a trailing comma: "That is," joins "that is".)
const norm = (w) => (w === START ? w : w.toLowerCase().replace(/,$/, ''));

// (Three words of context: a line only turns into another where they share
// a whole phrase, which keeps it grammatical more often than not.)
const ORDER = 3;
function train(chain, line, w) {
  const t = [...new Array(ORDER).fill(START), ...tokens(line), END];
  for (let i = ORDER; i < t.length; i++) {
    const k = t.slice(i - ORDER, i).map(norm).join(' ');
    let m = chain.get(k);
    if (!m) chain.set(k, (m = new Map()));
    m.set(t[i], (m.get(t[i]) || 0) + w);
  }
}

function next(m, rng) {
  let total = 0;
  for (const n of m.values()) total += n;
  let r = rng.next() * total;
  for (const [k, n] of m) {
    r -= n;
    if (r <= 0) return k;
  }
  return END;
}

const cache = new Map();
// The blended chain for a culture, a register and some quirks.
export function chainFor(culture, register, flavors = []) {
  const fl = flavors.filter((f) => QUIRKS.has(f)).sort();
  const key = `${culture}|${register}|${fl.join(',')}`;
  let c = cache.get(key);
  if (c) return c;
  const chain = new Map();
  const seen = new Set();
  const add = (lines, w) => {
    for (const l of lines || []) {
      train(chain, l, w);
      seen.add(l);
    }
  };
  add(STYLES.base, 1);
  add(STYLES.culture[culture]?.lines, 2);
  add(STYLES.register[register], 2);
  for (const f of fl) add(STYLES.flavor[f], 2);
  c = { chain, seen, lexicon: STYLES.culture[culture]?.lexicon || [] };
  if (cache.size > 200) cache.clear();
  cache.set(key, c);
  return c;
}

// One line from the chain: new where it can be (not just a line it learned
// from), not too short, not rambling.
export function babble(c, rng, { min = 5, max = 20, tries = 10 } = {}) {
  let best = null;
  for (let i = 0; i < tries; i++) {
    const out = [];
    const ctx = new Array(ORDER).fill(START);
    for (let n = 0; n < max + 4; n++) {
      const m = c.chain.get(ctx.map(norm).join(' '));
      if (!m) break;
      const w = next(m, rng);
      if (w === END) break;
      out.push(w);
      ctx.shift();
      ctx.push(w);
    }
    if (out.length < (/^[A-Z][a-z']*[.!?]$/.test(out[0] || '') ? 1 : min) || out.length > max) continue;
    let s = out.join(' ');
    if (!/[.!?]$/.test(s)) s += '.';
    best = best || s;
    if (!c.seen.has(s)) return s;
  }
  return best || 'Hm.';
}

// Fill in the blanks from where it's said.
export function fill(text, ctx = {}) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] !== undefined && ctx[k] !== null ? ctx[k] : { town: 'this town', god: 'the gods', dish: 'stew', drink: 'ale', feast: 'the feast', realm: 'the realm', weather: 'weather' }[k] || m));
}

// Something to say, in this person's own way of talking (`ctx` says where).
export function smallTalk(rec, rng, ctx = {}) {
  const v = voiceOf(rec);
  const culture = ctx.culture || 'vale';
  const traits = rec.traits || [];
  const flavors = traits.filter((t) => QUIRKS.has(t));
  if ((rec.personality?.piety ?? 0) > 0.7 || rec.job === 'priest') flavors.push('pious');
  const c = chainFor(culture, v.reg, flavors);
  let s = fill(babble(c, rng, { min: v.reg === 'terse' ? 1 : 5, max: v.reg === 'terse' ? 6 : 20 }), ctx);
  for (const [a, b] of c.lexicon) s = s.replace(a, b);
  return s;
}

// A seeded generator for a line (the same moment gives the same line).
export function talkRng(rec, salt = 0) {
  return new RNG(hash4(rec.idx || 0, salt, 0x6a7c));
}
