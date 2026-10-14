// (Round 110) What's written in the Athanor, and what's left there, made
// from what the world knows of it. Everyone in Velmarch knows the story:
// before the emperors, its master (its `who`: the Divine Alchemist, the
// First Transmuter, the Gilded Eye, the Twelve-Handed One) built a furnace
// under the hills to make gold of lead and gods of men, and one year the
// hills glowed for a night and a day and the shepherds found their flocks
// turned to salt. Underneath: its adepts (the master-adept, a brother, a
// sister, by their names in the art), the mirror-maker, the town, and
// what the Work was doing (an ingredient it wanted; the stage the floor
// is at: nigredo, albedo, rubedo). Its papers: an adept's diary, the
// recipe for a homunculus, the Emerald Tablet, the speculum's teaching,
// what went into the Work, a shepherd's name on his salt, the operations,
// the athanor's rule, a letter never sent, and the master's hall. Every
// Athanor tells its own; the same one always tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// The stages of the Work, a floor each.
export const STAGES = [
  { key: 'nigredo', name: 'Nigredo', word: 'the blackening', what: 'the first matter is killed, and rots, and goes black, and stinks: so it must be, for nothing is made new that is not first undone' },
  { key: 'albedo', name: 'Albedo', word: 'the whitening', what: 'the black is washed, seven times, in the water that is not wet, till it is white as salt and cold as the moon' },
  { key: 'rubedo', name: 'Rubedo', word: 'the reddening', what: 'the white is given to the fire, and the fire to the white, till it reddens like a coal and is the stone, and the stone is the Work, and the Work is god' },
];
// What the Work wanted, at the end.
export const WANTS = {
  philosopher: { say: 'the Work wanted a living philosopher', why: 'Every ingredient was weighed and found wanting, until the master-adept understood: the last ingredient must know what it is becoming. A philosopher, alive. We drew lots.' },
  town: { say: 'the Work wanted the town', why: 'Not a man, but men: a whole town of them, their lives poured in together like seven metals into the one crucible. The hills glowed for a night and a day.' },
  master: { say: 'the Work wanted its master', why: 'The master-adept climbed into the athanor on the last night, singing. The eye opened in the morning.' },
  sun: { say: 'the Work wanted the sun', why: 'The mirrors were to catch the sun itself and pour it in. They caught it. Something looked back down the beam.' },
};
const ADEPT_NAMES = { m: ['Lucius', 'Hermes', 'Valerius', 'Theodric', 'Octavian', 'Septimus', 'Quintus', 'Cassian', 'Decimus'], f: ['Aurelia', 'Sabina', 'Calpurnia', 'Marcella', 'Livilla', 'Flavia', 'Severina', 'Domitia'] };
const ART_NAMES = ['of the Green Lion', 'of the Black Crow', 'of the White Swan', 'of the Pelican', 'of the Peacock\'s Tail', 'of the Red King', 'of the Salamander', 'of the Ouroboros'];
// (A brother's name for a Frater, a sister's for a Soror; a Magister's
// either.)
const adept = (rng, title) => `${title} ${rng.pick(title === 'Soror' ? ADEPT_NAMES.f : title === 'Frater' ? ADEPT_NAMES.m : [...ADEPT_NAMES.m, ...ADEPT_NAMES.f])} ${rng.pick(ART_NAMES)}`;
const MASTER = {
  divine_alchemist: ['the Divine Alchemist', 'The eye of the Work, opened. Everything here serves it, and everything here is it, or will be.'],
};
const MASTER_ANY = ['the Master of the Work', 'Whatever the Work became waits at the bottom of it.'];

export function athanorLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x6301));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x6302));
  const who = rec.origin?.who || 'the Divine Alchemist';
  const town = rec.townName || 'the shepherds\' villages';
  const year = rec.origin?.y || 400;
  const want = fixed.pick(Object.keys(WANTS));
  const W = WANTS[want];
  const masterAdept = adept(fixed, 'Magister');
  const brother = adept(fixed, 'Frater');
  const sister = adept(fixed, 'Soror');
  const mirrorer = adept(fixed, 'Frater');
  const stage = STAGES[Math.min(n, STAGES.length - 1)];
  const [mName, mWhy] = (boss && MASTER[boss]) || MASTER_ANY;
  return {
    who, town, year, want, masterAdept, brother, sister, mirrorer, stage: stage.key, master: mName,
    // An adept's diary: the Work, and what it wanted.
    diary() {
      return {
        title: `The Diary of ${brother}`,
        lines: [
          `The ${rng.pick(['three hundredth', 'nine hundredth', 'thousandth'])} day of the ${stage.name}. ${rng.pick(['The matter will not change.', 'The vessel sweats.', 'The egg has darkened again.'])}`,
          `${masterAdept} says ${W.say.replace('the Work wanted', 'the Work wants')}. ${rng.pick(['I pray it is not so.', 'I believe it. God help me.', 'Soror says we should run.'])}`,
        ],
      };
    },
    // How to make a homunculus.
    recipe() {
      return {
        title: 'To Make the Little Man',
        lines: [
          'Take of the seed, and seal it in a glass, and bury the glass in horse-dung forty days, and it will begin to move.',
          rng.pick(['Feed it on the arcanum of blood, and it will grow, and keep it warm as a mother\'s belly.', 'It must never be let out of the glass. It does not know it is small.', 'Feed it quicksilver. It will come to love you.']),
          `(${sister}, keeper of the vats.)`,
        ],
      };
    },
    // The Emerald Tablet.
    tablet() {
      return {
        title: 'The Emerald Tablet',
        lines: [
          'That which is below is like that which is above, and that which is above is like that which is below, to do the miracle of the one thing.',
          'Its father is the sun, its mother the moon; the wind carried it in its belly; its nurse is the earth.',
          rng.pick(['Separate the earth from the fire, the subtle from the gross, gently, with great skill.', 'It ascends from the earth to heaven and descends again, and receives the power of both.']),
        ],
      };
    },
    // The speculum: how the mirrors go.
    speculum() {
      return {
        title: 'On the Speculum',
        lines: [
          'The sun is caught in the lamp, and thrown, and turned by the mirrors, and laid upon the seal; and the seal, knowing the sun, opens.',
          rng.pick(['A mirror turned so (/) throws the beam that comes from the left up toward the north; turned the other way, down.', 'Each mirror turns but two ways. Follow the beam with your eye before you turn anything.']),
          `(${mirrorer}, grinder of the mirrors.)`,
        ],
      };
    },
    // What went into the Work.
    inventory() {
      return {
        title: 'Ingredients Received',
        lines: [
          `Lead, ${rng.int(40, 90)} talents. Quicksilver, ${rng.int(9, 30)} flasks. Salt of the earth. Sulphur of the philosophers. ${rng.pick(['Twelve white doves.', 'A virgin\'s tears.', 'The heart of a lion.'])}`,
          `From the villages of ${town}: ${rng.pick(['the shepherds', 'the children', 'everyone'])}, ${rng.pick(['sixty', 'a hundred and twelve', 'four hundred'])} in all.`,
          `(Received ${year}, ${masterAdept}.)`,
        ],
      };
    },
    // A shepherd's name, cut in the floor at his feet.
    shepherd() {
      return {
        title: 'Cut at the Salt Man\'s Feet',
        lines: [`${rng.pick(['Mago', 'Turi', 'Bassus', 'Cotta', 'Ennio', 'Varro'])}, shepherd, of ${town}. ${rng.pick(['He came looking for his flock.', 'He came with a lamp to see why the hill was glowing.', 'He was the first.'])} He is of the Work now.`],
      };
    },
    // The operations, and the stage this floor is at.
    operations() {
      return {
        title: `The ${stage.name}`,
        lines: [`${cap(stage.word)}: ${stage.what}.`, `(The ${['first', 'second', 'third'][Math.min(n, 2)]} of the operations: this is its hall.)`],
      };
    },
    // The athanor's rule.
    furnace() {
      return {
        title: 'The Rule of the Furnace',
        lines: [
          'Feed the athanor coal or sulphur, and let it burn, and do not leave it: the egg ripens in the heat, and ripe, it gives up the Red Tincture.',
          rng.pick(['The imps love its fire. They will come to it. Do not let them in.', 'While it burns, the little fire-folk come to warm themselves. Keep them off the egg.']),
        ],
      };
    },
    // A letter never sent.
    letter() {
      return {
        title: 'A Letter, Never Sent',
        lines: [
          `"Mother. I have found the master I prayed for. ${rng.pick(['I will be home when the Work is done.', 'I will bring you gold enough for the farm.', 'I cannot tell you what we do here.'])}"`,
          `"Your son, ${adept(rng, 'Frater').split(' of ')[0].replace('Frater ', '')}, now ${brother}."`,
        ],
      };
    },
    // On the transmutation table.
    table() {
      return {
        title: 'Cut in the Table\'s Rim',
        lines: ['Lay the base metal in the circle, and the Work will lift it up. But the Work sees all that is done in its name.'],
      };
    },
    // (What went wrong, told: in the sanctum.)
    story() {
      return { title: 'The Last Page of the Book of the Work', lines: [`In the end ${W.say}.`, W.why, `(${masterAdept}.)`] };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here the Work ends, under the hills by ${town}.`, `Since ${W.say}, it has not stopped.`, mWhy],
      };
    },
    // (One line, as you come down.)
    arrive() {
      return rng.pick([
        `The ${stage.name}: ${stage.word}. The air tastes of metal.`,
        'Everything hums, very faintly, the way glass hums before it breaks.',
        'Somewhere below, something enormous is looking at you.',
        'The marble is warm underfoot.',
      ]);
    },
  };
}
