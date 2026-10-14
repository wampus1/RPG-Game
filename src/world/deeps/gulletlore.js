// (Round 113) What's written in the Gullet of the World, and what's left
// there, made from what the world knows of it. Everyone in Ostria knows the
// story: in the beginning there was a kingdom on the river, the first of
// them, and the World-Worm (its `who`: the Alinelidan, the Mother of
// Leeches, the Mouth Under the Mountain) came up under it and ate it whole,
// its cities and fields and river, and went down into the earth to sleep it
// off. Underneath: the kingdom's name in the old tongue, its city, its last
// king, the river and its god, a scribe of the temple, a household that
// bricked itself in (see game/gulletwork.js), and the Swallowed (their
// children's children, still down there in the dark, keeping the rites);
// and the stage the floor is at (the Bore, the Swallowed City, the Belly).
// Every Gullet tells its own; the same one always tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const nth = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
// The floors: what each is.
export const STAGES = [
  { key: 'bore', name: 'the Bore', what: 'where the worm went down through the earth, and the city with it, a piece at a time' },
  { key: 'city', name: 'the Swallowed City', what: 'its streets and its temple and its canal, whole, or nearly, in the dark' },
  { key: 'belly', name: 'the Belly', what: 'where it lies, and what it ate goes soft, and it lays its eggs' },
];
const SYL = ['ur', 'ish', 'nan', 'ki', 'lag', 'ash', 'er', 'shu', 'tum', 'bal', 'mar', 'zu', 'du', 'en', 'gal', 'ku'];
const GODS = ['Idurra', 'Enmar', 'Ninsu', 'Abzuel', 'Nammaru'];
const HOUSES = ['the house of the brewer', 'the house of the reed-cutter', 'the house of the scribe', 'the house of the boatman', 'the house of the potter'];
const KIN = ['Ninda', 'Lumma', 'Adda', 'Kubu', 'Geme', 'Urnig'];

export function gulletLore(rec, n) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x8131));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x8132));
  const who = rec.origin?.who || 'the Alinelidan';
  const town = rec.townName || 'the red country';
  const year = rec.origin?.y || 400;
  const word = (k) => {
    let s = '';
    for (let i = 0; i < k; i++) s += fixed.pick(SYL);
    return cap(s);
  };
  const kingdom = word(2);
  const city = `${word(2)}-${word(1)}`;
  const king = `${word(2)} ${fixed.pick(['the Builder', 'the Just', 'Who-Dug-the-Canals', 'the Last'])}`;
  const god = fixed.pick(GODS);
  const scribe = word(2);
  const house = fixed.pick(HOUSES);
  const kin = fixed.pick(KIN);
  // (Which year of his it was, when it came.)
  const reign = fixed.int(9, 31);
  const stage = STAGES[Math.min(n, STAGES.length - 1)];
  return {
    who, town, year, kingdom, city, king, god, scribe, house, kin, reign, stage: stage.key,
    // The king's annals, as the temple kept them: the last of them.
    annals() {
      return {
        title: `The Annals of ${king}`,
        lines: [
          `In the ${nth(reign - 2)} year of ${king}, king of ${kingdom}, the canals were dug to the edge of the desert, and ${god} was given a new house.`,
          `In the ${nth(reign - 1)} year the river did not rise. The wells tasted of iron. The dogs would not go into the fields.`,
          `In the ${nth(reign)} year the ground ${rng.pick(['breathed', 'sang', 'opened its mouth'])}, and ${rng.pick(['the scribe has not written what followed', 'the rest of the tablet is blank', 'the wedges after that run off the edge of the clay'])}.`,
        ],
      };
    },
    // A tablet of a household's: what was owed, a lesson, a letter.
    tablet() {
      return rng.pick([
        { title: 'A Tablet of Accounts', lines: [`To the temple of ${god}: ${rng.int(3, 20)} measures of barley, ${rng.int(1, 6)} jars of date wine, one goat.`, `Received, ${scribe}, scribe of the temple. The goat was thin.`] },
        { title: 'A School Tablet', lines: [`The same sign copied out forty times in a child's hand, badly. At the bottom: "${scribe} hit me again."`] },
        { title: 'A Letter Never Sent', lines: [`To my brother in the river towns: come home. The ground here is warm at night, and the wells are going dry, and the priests are afraid. ${kin}.`] },
      ]);
    },
    // Under the god in relief.
    relief() {
      return { title: `${god} of the River`, lines: [`${god}, who holds the river in his arms and pours it out over ${kingdom}. ${rng.pick(['Someone has scratched the eyes out.', 'The blue of his waters is still bright.', 'Fresh soot on the plaster: a lamp burned here, not long ago.'])}`] };
    },
    // On his statue's base.
    statue() {
      return { title: `${god}, Lord of the Waters`, lines: [`Set up by ${king} in the ${nth(reign - 2)} year, that the river should never fail.`, '(Bring him something to eat, the Swallowed say, and the waters will not burn you.)'] };
    },
    // Behind the bricked-up door.
    letter() {
      return {
        title: 'Scratched on the Inside of the Door',
        lines: [
          `We are ${house}. We have bricked ourselves in with the bread and the water jars and the lamp, the way the priests said, until it passes.`,
          `It does not pass. It is all around us. The walls are warm. ${kin} says it is breathing.`,
          `Whoever finds this: we were ${kingdom}. Remember the name.`,
        ],
      };
    },
    // At the sluice wheel.
    sluice() {
      return { title: 'Cut in the Wheel\'s Post', lines: [`The gate of the canal of ${king}. Open at the low water, close at the flood. ${rng.pick(['Turn it, and the river comes.', 'There is still water behind it. You can hear it.'])}`] };
    },
    // On the king's chair.
    throne() {
      return { title: `The Chair of ${king}`, lines: [`Inlaid with lapis and gold, its feet a lion's. It is lying on its back. ${rng.pick(['The cushion has been eaten away.', 'Something has been sleeping in it.', 'Someone has polished the gold, lately.'])}`] };
    },
    // What the Swallowed say, in what's left of the old tongue.
    swallowed() {
      return rng.pick([
        `"${kingdom}," it whispers, touching its chest. "${kingdom}." Then it beckons.`,
        `"The god is hungry," it says, slow, as if the words were heavy. "Feed the god and the water is kind."`,
        `"Hush. Hush. She is sleeping." It points down, and down, and puts a finger to its lips.`,
        `"Our fathers' fathers lived up there." It points at the roof. "In the light. We keep the lamps for them."`,
      ]);
    },
    // Where it lies.
    last() {
      return {
        title: 'Where the Kingdom Went',
        lines: [`Here ${who} lies, full of ${kingdom}: its city of ${city}, its river, its king.`, `In ${year} the ground near ${town} opened like a mouth. It is turning over in its sleep.`],
      };
    },
    // The stage this floor is at.
    hall() {
      return { title: cap(stage.name), lines: [`${cap(stage.name)}: ${stage.what}.`] };
    },
    // (One line, as you come down.)
    arrive() {
      return rng.pick([
        `${cap(stage.name)}. The ground is warm under your hand, and it moves, very slowly.`,
        'Somewhere far down, something enormous swallows.',
        `A lamp is burning in the dark ahead. Someone in ${city} still keeps them lit.`,
        'Grit trickles from the roof, and stops, and trickles again.',
      ]);
    },
  };
}
