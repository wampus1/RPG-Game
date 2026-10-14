// (Round 112) What's written in the Sundered Reach, and what's left there,
// made from what the world knows of it. Everyone in Ostria knows the
// story: one year the sky over the red mesas split like a seam and
// something climbed down out of it on long legs (its `who`: the Rift
// Crawler, the Thing Between, the Long-Legged Dark, the Sunderer), and cut
// a way under the earth. Underneath: the mesa it came down on (its name
// in the old tongue), the people who lived on it (the Sky-Watchers, who
// read the stars from its top: their elder, their potter, their weaver, a
// child), how the sky stood the night it split (the four sighting-stones'
// signs: see game/riftwork.js), and the stage the floor is at (the Mesa,
// the Fault, the Between). Every Reach tells its own; the same one always
// tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// The four signs, as the sighting-stones have them (their turn: see
// render/art/rift_tex.js).
export const SIGNS = [
  { key: 'hunter', name: 'the Hunter', shape: 'a bow drawn' },
  { key: 'serpent', name: 'the Serpent', shape: 'a wave' },
  { key: 'eye', name: 'the Eye', shape: 'an eye' },
  { key: 'split', name: 'the Split', shape: 'a broken diamond' },
];
// The quarters the stones stand at.
export const QUARTERS = ['north', 'east', 'south', 'west'];
// The floors: what each was.
export const STAGES = [
  { key: 'mesa', name: 'the Mesa', what: 'the Watchers\' dwellings, cut into the red stone, the void only in the cracks' },
  { key: 'fault', name: 'the Fault', what: 'where the mesa broke, and the nothing shows through' },
  { key: 'between', name: 'the Between', what: 'where there is more of the void than of the stone' },
];
const SYL = ['ke', 'sha', 'ta', 'wa', 'no', 'hu', 'mi', 'ya', 'tse', 'lo', 'ka', 'ra'];
const NAMES = ['Long-Eyes', 'Two-Owls', 'Grinds-Fine', 'Walks-Late', 'Morning-Wren', 'Counts-Stars', 'Quiet-Water', 'Red-Thread', 'Little-Fox', 'Sings-Low'];
const BLOOD = ['the elder', 'the potter', 'the weaver', 'a child'];

export function riftLore(rec, n) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x8101));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x8102));
  const who = rec.origin?.who || 'the Rift Crawler';
  const town = rec.townName || 'the red country';
  const year = rec.origin?.y || 700;
  const mesa = cap(fixed.pick(SYL) + fixed.pick(SYL) + '-' + fixed.pick(SYL) + fixed.pick(SYL));
  const names = fixed.shuffle([...NAMES]);
  const [elder, potter, weaver, child] = names;
  // (How the sky stood that night: a sign at each quarter. The same on
  // every floor.)
  const sky = fixed.shuffle([0, 1, 2, 3]);
  const stage = STAGES[Math.min(n, STAGES.length - 1)];
  const skyLine = () => sky.map((s, i) => `${SIGNS[s].name} in the ${QUARTERS[i]}`).join(', ');
  return {
    who, town, year, mesa, elder, potter, weaver, child, sky, stage: stage.key,
    // The elder's sky-journal: how the sky stood that night.
    journal() {
      return {
        title: `${elder}'s Sky-Journal`,
        lines: [
          `${rng.pick(['The last night of the dry moon', 'The night of the long cold', 'The third night after the rains'])}. Clear. ${cap(skyLine())}.`,
          rng.pick(['There is a line across the sky I have not seen before. A thin one, like a hair on the lens.', 'The stars near the Split are wrong. They are too bright, and they are moving.', 'The children say the sky is humming. I hear it too.']),
          '(Set the sighting-stones as the sky stood, and the kiva will open to you.)',
        ],
      };
    },
    // On the star chart.
    chart() {
      return { title: 'The Watchers\' Chart', lines: [`The four signs round the year: the Hunter, the Serpent, the Eye, the Split.`, `Painted fresh over the old: ${skyLine()}. And a crack, in black, across the Split.`] };
    },
    // On a mural.
    mural() {
      return {
        title: 'Painted on the Wall',
        lines: [rng.pick([
          'The sky-disc, and the people with their arms up to it. Under it, in a child\'s hand: a spider, very big.',
          'The Split, the sign of endings, painted over and over in black until the plaster is wet through.',
          `The mesa of ${mesa}, and on top of it the Watchers, small, looking up.`,
        ])],
      };
    },
    // One moment of their last evening, as a watcher's echo lives it.
    memory() {
      const [nm, role] = rng.pick([[elder, BLOOD[0]], [potter, BLOOD[1]], [weaver, BLOOD[2]], [child, BLOOD[3]]]);
      return `${nm}, ${role}: "${rng.pick([
        'Bring the blankets in, the wind is wrong tonight.',
        'Look, look, the sky is opening like a seed-pod!',
        'Someone light the hearth. It is so cold. Why is it so cold?',
        'Keep grinding. If we stop, we will have to look up.',
        'The kiva. Everyone into the kiva. Pull the ladder up.',
        'I can hear it walking on the roof.',
      ])}"`;
    },
    // The potter's mark on what's kept in a niche.
    mark() {
      return { title: 'In a Niche', lines: [`Made by ${potter}, for ${rng.pick([elder, child, weaver])}, in the year the rains came twice.`] };
    },
    // On a spirit figure.
    spirit() {
      return {
        title: 'A Spirit Figure',
        lines: [`${rng.pick(['The Star-Keeper, who holds the sky up.', 'The Long-Legged Walker, who is not to be painted.', 'Grandmother Ladder, who leads down into the earth.'])} ${rng.pick(['Its paint is fresh.', 'Someone has turned it to face the wall.', 'Its eyes have been scratched out.'])}`],
      };
    },
    // (What went wrong, told: in the kiva, by the cache.)
    story() {
      return {
        title: 'Scratched on the Kiva Wall',
        lines: [
          `We came down into the kiva as the sky came down onto ${mesa}. ${cap(elder)} pulled the ladder up after.`,
          `We can hear ${who} on the roof. It is very patient. If anyone finds this: we were the Watchers, and we watched. (${year})`,
        ],
      };
    },
    // The hall of the master.
    last() {
      return {
        title: 'Where the Sky Came Down',
        lines: [`Here ${who} climbed down out of the split sky onto the mesa of ${mesa}.`, `The town of ${town} saw the light for a night and a day.`, 'It is still here. So is the split.'],
      };
    },
    // The stage this floor is at.
    hall() {
      return { title: cap(stage.name), lines: [`${cap(stage.name)}: ${stage.what}.`] };
    },
    // (One line, as you come down.)
    arrive() {
      return rng.pick([
        `${cap(stage.name)}. The air hums, very low, like a held breath.`,
        'Somewhere, a woman is calling the children in. There are no children.',
        'Your shadow points the wrong way.',
        `The red stone of ${mesa} is warm, and the black glass in it is cold.`,
      ]);
    },
  };
}
