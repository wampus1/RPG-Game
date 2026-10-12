// (Round 95) What's written down in the old places, made from what the
// world knows of each one: who lies there and when, the town nearest it
// (and its people's own names for the dead), who went down after them and
// never came up, and what's been left for them since. Every barrow tells
// its own; the same barrow always tells the same.
//
// Each piece is a title and a few lines (read on a slab, a bowl's rim, a
// ship's stem, a robber's last page: see game/deeps.js).
import { RNG, hash4 } from '../../util/rng.js';
import { personName, CULTURES } from '../names.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const bare = (who) => String(who || 'the chief').replace(/^the /i, '');

// What the chief was called for, and what they did, as the slabs have it.
const EPITHETS = [
  'Ring-Giver', 'the Grey-Cloaked', 'Wolf-Friend', 'the Unbowed', 'Oath-Keeper', 'Iron-Hand', 'the Long-Remembered', 'Bridge-Breaker',
  'the Hall-Warden', 'Storm-Born', 'the Silent', 'Gold-Generous', 'Spear-Splitter', 'the Last of the Old Line', 'Hearth-Mother', 'Crow-Feeder',
];
const DEEDS = [
  'held the ford against three armies and lost not a hand of their own',
  'gave rings of gold to every one who stood at their side',
  'drove the sea-raiders back into the grey water',
  'built the long hall whose posts still stand above',
  'made peace with the hill-folk, and kept it all their days',
  'went alone into the dark under the mountain, and came out again',
  'buried four of their children, and wept for none of them in the hall',
  'swore never to lie down while an enemy lived, and kept the oath',
  'feasted the whole of the vale for a winter when the harvest failed',
  'broke the wolf-king\'s bridge with an axe of their own forging',
];
const VOWS = [
  'Let no one open this door while the hall stands.',
  'Who wakes them answers to them.',
  'They keep the door. They will always keep the door.',
  'Go back up into the light. There is nothing here for the living.',
  'What was given to the dead is the dead\'s.',
];
const GUARD_DEEDS = [
  'who stood at the chief\'s left hand for thirty winters',
  'who carried the chief\'s banner at the ford, and fell under it',
  'who would not leave the chief\'s side, and lay down beside them living',
  'who held the hall door alone the night it burned',
  'whose shield was never broken',
  'who sang at the feasts, and keeps the songs still',
  'who killed the bear that came for the chief\'s children',
  'who swore the oath first, and would swear it again',
];
const SHIPS = ['Sea-Steed', 'Wave-Cleaver', 'the Long Serpent', 'Grey Gull', 'Storm-Wing', 'Whale-Road', 'the Black Swan', 'Night-Rower'];

export function barrowLore(rec, n) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x10e));
  const who = rec.origin && rec.origin.who ? rec.origin.who : rec.name;
  const chief = bare(who);
  const y = rec.origin && rec.origin.y ? rec.origin.y : null;
  const town = rec.townName || null;
  const style = rec.style && CULTURES[rec.style] ? rec.style : 'vale';
  const name = () => personName(rng, style).first;
  const epithet = rng.pick(EPITHETS);
  const deed = rng.pick(DEEDS);
  const fallen = (rec.fallen || []).map((f) => (typeof f === 'string' ? f : f && f.name)).filter(Boolean);
  return {
    door: () => ({
      title: 'THE DOOR STONE',
      lines: [
        `Here lies ${chief}, ${epithet},`,
        `who ${deed}.`,
        y ? `Laid in the mound in the year ${y}${town ? `, mourned by ${town}` : ''}.` : `${town ? `Mourned by ${town}.` : 'Mourned by all the vale.'}`,
        rng.pick(VOWS),
      ],
    }),
    hearthguard: () => {
      const nm = name();
      return {
        title: 'A RUNE SLAB',
        lines: [`${nm}, of ${chief}'s hearth-guard,`, `${rng.pick(GUARD_DEEDS)}.`, rng.chance(0.5) ? `${nm} keeps the hall still.` : 'The oath outlasts the oath-taker.'],
      };
    },
    feast: () => ({
      title: 'THE HEARTH',
      lines: [
        'Cut in the hearthstone, round and round:',
        `"At ${chief}'s board the cup is never empty and the fire never out."`,
        'The fire is out. Something sits in every seat that isn\'t empty.',
      ],
    }),
    ship: () => {
      const ship = rng.pick(SHIPS);
      return {
        title: 'THE SHIP\'S STEM',
        lines: [`${ship}, that carried ${chief} over the whale-road,`, 'carries them now over the dark water.', `Her crew row still. ${rng.chance(0.5) ? 'Listen.' : 'Their oars are bone.'}`],
      };
    },
    offering: () => {
      const later = y ? y + rng.int(40, 200) : null;
      return {
        title: 'A TABLET BY THE PIT',
        lines: [
          `Left by the folk of ${town || 'the vale'}${later ? ` in the year ${later}` : ''},`,
          `that ${chief} sleep, and the hall stay shut,`,
          'and the dead not come up for what was promised them.',
          'Take nothing from the pit.',
        ],
      };
    },
    robber: () => {
      const me = name();
      const mate = fallen.length ? fallen[rng.int(0, fallen.length - 1)] : name();
      const days = rng.int(3, 9);
      return {
        title: 'A ROBBER\'S LAST PAGE',
        lines: [
          `${me} and ${mate}, out of ${town || 'the vale'}, digging for ${chief}'s gold.`,
          `Day ${days}: the way back's fallen in. ${mate} ate something in the dark and won't say what.`,
          `Day ${days + 2}: so hungry. The bones in the next room smell like bread.`,
          'Day ?: they move when the blue light comes. we eat what we can',
        ],
      };
    },
    // The name-stone: the order the kerb ring's stones are to be turned
    // to (see deeps/barrow.js, the kerb ring).
    clue: (want) => ({
      title: 'THE NAME-STONE',
      lines: [
        `Marks cut round a ring, worn almost smooth: ${chief}'s name in the old signs.`,
        `${want.map((q) => `${cap(QUARTERS[q.dir])}, ${SIGILS[q.k]}`).join('; ')}.`,
        rng.pick(['Spoken in that order, the ring opens to the one who speaks it.', 'Turn the stones of the ring so, and the hoard-door knows its master.', 'Whoever has the name has the hoard.']),
      ],
    }),
    // The chief's own slab, at the foot of their dais: their saga, and, if
    // there's a ring of spiral stones on this floor, the order of their
    // name in sigils.
    chief: (clue) => ({
      title: `${chief.toUpperCase()}`,
      lines: [
        `${cap(chief)}, ${epithet}, who ${deed}.`,
        rng.pick([
          'The hearth-guard swore to keep them, and keep them still.',
          'Seven winters they ruled the vale; seven hundred they have kept this hall.',
          'Their bride was laid beside them, living, to bind them to the mound.',
          'They did not want to lie down. They were not asked.',
        ]),
        ...(clue ? [`Their name in stone, round the ring: ${clue.map((q) => `${QUARTERS[q.dir]}, ${SIGILS[q.k]}`).join('; ')}.`] : []),
        rng.pick(VOWS),
      ],
    }),
  };
}

// The four sigils the spiral stones turn to (see the kerb ring).
export const SIGILS = ['the spiral', 'the sun-wheel', 'the serpent', 'the eye'];
// (And the quarters of the ring they stand at.)
export const QUARTERS = ['north', 'east', 'south', 'west'];
