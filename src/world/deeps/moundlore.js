// (Round 108) What's written in a Hollow Hill, and what's left there, made
// from what the world knows of it. Everyone on the Wyrd Isle knows the
// story: a piper of the town followed music into the hill, the court of
// the fair folk (its `who`: the Fair King, the Antlered One, the Raven
// Queen, the Sleeper Under the Hill, the Fey Court), and came out the next
// morning, he said; but it was a hundred years later. Underneath: the
// piper himself (asleep in there still), the seer who knew the stones'
// order, the Wyrdfolk's rules for the hill, and what went wrong between
// the town and the hill (the piper went in; the town stopped leaving the
// bread and milk; the fair folk took a child and left one of theirs; a
// smith brought iron in; a night in the hill was a hundred years outside).
// Its papers: the seer's verse (the order of the stones), the rules, the
// offering, the piper, the bones of one who danced, the doors, a mother's
// note on her changeling, the throne's word, what's cut in the cairn,
// and the master's hall. Every hill tells its own; the same one always
// tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const FAULTS = {
  piper: {
    say: 'the piper followed the music in',
    why: 'He heard the pipes under the hill on Midsummer Eve and went in to play against them. The town came looking for him. Not all of the town came back.',
  },
  bargain: {
    say: 'the town stopped leaving the bread and milk',
    why: 'For a hundred years the town left bread and milk at the stone, and the harvests were good. Then a new priest said it was heathen nonsense. The harvests failed, and then the children began to go missing.',
  },
  changeling: {
    say: 'the fair folk took a child and left one of theirs',
    why: 'A child was taken from her cradle and a changeling left in her place, old-eyed and hungry. Her father went into the hill after her with a lamp and a loaf.',
  },
  iron: {
    say: 'a smith brought iron into the hill',
    why: 'The smith went in with cold iron in his pocket and a hammer in his hand, to take back what the hill had taken. The court has been at war with the town ever since.',
  },
  hundred: {
    say: 'one night in the hill was a hundred years outside',
    why: 'They danced one night in the hill, and came out at dawn to find their town gone to grass, and strangers in its place who had never heard their names.',
  },
};
// The order of the stones: the ogham's first five, its trees.
export const TREES = ['birch', 'rowan', 'alder', 'willow', 'ash'];
const FIRST = ['Aoife', 'Bran', 'Caoimhe', 'Dara', 'Eithne', 'Fionn', 'Grainne', 'Maeve', 'Niamh', 'Oisin', 'Riona', 'Tadhg', 'Brigid', 'Cathal', 'Emer', 'Ronan', 'Sorcha', 'Aengus', 'Etain', 'Nuala'];
const LAST = ['O\'Fiann', 'Mac Dubh', 'Ni Rua', 'O\'Ciar', 'Mac Bran', 'Ni Lir', 'O\'Morna', 'Mac Conn', 'O\'Neill', 'Ni Briain'];
const name = (rng) => `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
const MASTER = {
  fair_king: ['the Fair King', 'Lord of the Hollow Hills, and of every mortal who ever ate at his table. He is very beautiful, and very old, and he does not let anything go that he has once called his.'],
  hill_sleeper: ['the Hill Sleeper', 'The hill itself, which got up. The court lives in it as mice live in a sleeping giant; when it wakes, the court is very quiet.'],
};
const MASTER_ANY = ['the Master of the Hill', 'Whoever keeps the court is at the bottom of it.'];

export function moundLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x6d01));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x6d02));
  const who = rec.origin?.who || 'the Fair King';
  const town = rec.townName || 'the town below the hill';
  const year = rec.origin?.y || 1200;
  const fault = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[fault];
  const piper = name(fixed);
  const seer = name(fixed);
  const smith = name(fixed);
  const [mName, mWhy] = (boss && MASTER[boss]) || MASTER_ANY;
  return {
    who, town, year, fault, piperName: piper, seer, master: mName,
    // The seer's verse: the stones' order (birch, rowan, alder, willow,
    // ash), told as the Wyrdfolk tell it.
    verse() {
      return {
        title: `${seer}'s Verse`,
        lines: [
          'To open the cairn, wake the stones as the trees came:',
          'first the birch, the white lady; then the rowan, the witch\'s bane;',
          'the alder by the water; the willow, weeping;',
          'and last the ash, that holds the world up. Touch them so, and no other way.',
        ],
      };
    },
    // The Wyrdfolk's rules for going under the hill.
    rules() {
      return {
        title: 'Under the Hill',
        lines: [
          'Eat nothing they set before you, however it smells. Step in no ring. Dance with no one.',
          rng.pick(['Turn your coat inside out, and they will not know you.', 'Keep bread in your pocket, and a nail of cold iron.', 'Every door in the hill has a twin; go in at one and you come out of the other.']),
          `(Cut on the stone by ${seer}, seer of ${town}.)`,
        ],
      };
    },
    // The offering at the stone.
    offering() {
      return {
        title: 'An Offering',
        lines: [rng.pick([
          'A bowl of milk gone to cheese, and a heel of bread gone to stone, for the good neighbours. Someone still remembers.',
          `Bread and milk, and a scrap of paper under the bowl: "For ${who}. Let the children be."`,
          'The bowl is licked clean.',
        ])],
      };
    },
    // The piper, asleep a hundred years.
    piper() {
      return {
        title: 'A Piper, Asleep',
        lines: [`${piper}, piper of ${town}, asleep against the stones with his whistle in his hand, his beard grown to his knees. ${rng.pick(['He is smiling.', 'His fingers still move on the stops.', 'Cobweb has grown over him.'])} The town gave him up in the year ${year}.`],
      };
    },
    // The bones of one who danced.
    taken() {
      return {
        title: 'Bones, Garlanded',
        lines: [rng.pick([
          'Bones in a dancer\'s shoes, the soles worn through, a garland of flowers still fresh on the skull.',
          'Someone who stepped into the ring and was never let out. The flowers on the skull are new.',
          'A girl of the town, by the ribbon. She danced a hundred years.',
        ])],
      };
    },
    // On a basin by a hill-door: how the doors go.
    doors() {
      return {
        title: 'Cut on the Basin',
        lines: [rng.pick([
          'Every door in the hill has a twin. Go in at one and you come out of the other.',
          'The queen\'s bower has no door of its own. Its door is its twin\'s.',
          'The doors are not where they go. Walk them until you know them.',
        ])],
      };
    },
    // A mother's note, about her changeling.
    changeling() {
      return {
        title: 'A Mother\'s Note',
        lines: [
          rng.pick(['"It is not my daughter. It looks like her. It cries like her. But it takes things, and runs, and it laughs when I weep."', '"It ate everything in the house in a night. Then it went to the hill, and I followed it."']),
          `"${name(rng)}, of ${town}."`,
        ],
      };
    },
    // The throne's word.
    throne() {
      return {
        title: 'Carved in the Throne',
        lines: [`Here sits ${mName}. ${rng.pick(['Kneel.', 'All that is eaten here is his.', 'Who sits here keeps the hill.'])}`],
      };
    },
    // (What went wrong, told: cut in the cairn.)
    story() {
      return { title: 'Cut in the Cairn', lines: [`The night ${F.say}.`, F.why, fault === 'iron' ? `(${smith}.)` : `(${seer}, who saw it.)`] };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the heart of the hill above ${town}.`, `Since ${F.say}, the hill has not let go.`, mWhy],
      };
    },
    // (One line, as you come down.)
    arrive() {
      return rng.pick([
        'It is twilight in here, and the light comes from nowhere.',
        'Somewhere ahead, very faint, someone is playing the pipes.',
        'You smell bread, warm, and honey. Don\'t.',
        'The way you came in is not quite where you left it.',
      ]);
    },
  };
}
