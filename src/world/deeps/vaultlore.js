// (Round 104) What's written in a Terracotta Vault, and what's left there,
// made from what the world knows of it. Everyone in Ostria knows the story:
// its emperor (its `who`: the First Emperor, General Bai Qi, the Jade
// Empress, the Dragon-Born Prince, the Eternal Court) was sealed into the
// hill with an army of clay to guard the tomb, eight thousand strong and
// every face different, and the scholars of the town above say the
// statues' crossbows are still drawn. Underneath: the army (its general,
// its count, its order of battle); the artisans who made it, every soldier
// signed by the potter who made him, and how they were sealed in with the
// work so its secrets would die with them (their tally of the days, their
// last letter); what went wrong (the artisans sealed alive, the elixir of
// quicksilver the emperor drank to live forever, the pearl taken, the
// quicksilver rising, the rebel who broke in and burned the pits); the map
// of the empire in quicksilver; the four beasts of the directions and
// their colours (which open the shrine's chamber: see deeps/vault.js); the
// inscription in a cauldron; a crossbowman's verse; the decree of sealing;
// and the master's hall. Every vault tells its own; the same one always
// tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// What went wrong (seeded).
export const FAULTS = {
  sealed: {
    say: 'the artisans were sealed in alive with the work',
    why: 'When the work was done, the doors were shut on the artisans who had made it, so that none would ever tell how the tomb was built. They did not stop working.',
    decree: 'Let no hand that built this place go out of it. What they know is the emperor\'s, and goes with him.',
  },
  elixir: {
    say: 'the emperor drank quicksilver to live forever',
    why: 'His alchemists gave him an elixir of quicksilver and cinnabar to make him live forever. It killed him. He did not accept it.',
    decree: 'Let the rivers of the empire flow here in quicksilver forever, as I shall live forever.',
  },
  pearl: {
    say: 'the dragon\'s pearl was taken from his hand',
    why: 'He was laid down with the dragon\'s pearl in his hand, and a eunuch of the court took it from him in the dark. Something has been looking for it ever since.',
    decree: 'Let the pearl lie in the emperor\'s hand while the stars turn, and let the hand that takes it be taken.',
  },
  rising: {
    say: 'the quicksilver rose in the rivers and did not go down',
    why: 'The quicksilver in the rivers of the empire rose one night, by itself, and has not gone down. It moves. It is looking for something.',
    decree: 'Let the rivers flow, and let no living thing cross them but on the bronze.',
  },
  rebel: {
    say: 'a rebel general broke in and burned the pits',
    why: 'A rebel general broke in with torches, burned the roof-beams over the army, and smashed the soldiers where they stood. The army got up out of the ashes and came after him.',
    decree: 'Let the army stand in its ranks forever, and let it break whoever breaks in upon it.',
  },
};
const SURNAME = ['Wang', 'Li', 'Zhang', 'Zhao', 'Chen', 'Liu', 'Yang', 'Huang', 'Zhou', 'Wu', 'Xu', 'Sun', 'Ma', 'Zhu', 'Hu', 'Guo', 'He', 'Lin', 'Gao', 'Luo', 'Tang', 'Han', 'Feng', 'Deng'];
const GIVEN = ['Bo', 'Yi', 'Jian', 'Ping', 'Shou', 'Gu', 'Cheng', 'Lu', 'Qiang', 'De', 'Mao', 'Heng', 'Rong', 'Kang', 'Tian', 'Yuan', 'Sheng', 'Wen', 'Xin', 'Fu'];
const name = (rng) => `${rng.pick(SURNAME)} ${rng.pick(GIVEN)}`;
// The workshops the potters came from (one of them the town above).
const SHOPS = ['the Palace Workshop', 'the Eastern Kilns', 'the Workshop of the River Gate', 'the Kilns of the Yellow Earth', 'the Rope-Makers\' Ward'];
// The beasts of the directions, and their colours: what opens the shrine.
export const DIRECTIONS = [
  { dir: 'east', beast: 'the Azure Dragon', colour: 'green', season: 'spring', block: 'tv_dragon' },
  { dir: 'south', beast: 'the Vermilion Bird', colour: 'red', season: 'summer', block: 'tv_bird' },
  { dir: 'west', beast: 'the White Tiger', colour: 'white', season: 'autumn', block: 'tv_tiger' },
  { dir: 'north', beast: 'the Black Tortoise', colour: 'black', season: 'winter', block: 'tv_tortoise' },
  { dir: 'centre', beast: 'the Emperor', colour: 'yellow', season: 'the turn of every season', block: null },
];
// The master's hall: what it is, and why it's here.
const MASTER = {
  terracotta_general: ['the Terracotta General', 'The emperor\'s own general, made in clay a head taller than any man, with the eight thousand at his back. He was given his orders once, and nobody has ever given him others.'],
  jade_dragon: ['the Jade Dragon', 'Carved from one stone of jade, coiled in the quicksilver at the heart of the empire, to keep the emperor\'s pearl. Its eyes follow the pearl wherever it goes.'],
};
const MASTER_ANY = ['the Master of the Vault', 'Whatever commands the army of clay is at the bottom of it.'];

export function vaultLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x6901));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x6902));
  const who = rec.origin?.who || 'the First Emperor';
  const town = rec.townName || 'the town above';
  const year = rec.origin?.y || 1100;
  const fault = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[fault];
  const general = `General ${name(fixed)}`;
  const count = fixed.pick([6000, 7000, 8000, 8000, 8000, 9000]);
  // The master potter and his crew, and how long they worked down here.
  const potter = name(fixed);
  const crew = [0, 1, 2].map(() => name(fixed));
  const days = fixed.int(380, 1460);
  const shops = [`the Kilns of ${town}`, ...fixed.shuffle(SHOPS.slice()).slice(0, 2)];
  const [mName, mWhy] = (boss && MASTER[boss]) || MASTER_ANY;
  // (Said a different way each time, but always the same colours.)
  const beastLine = (d) => rng.pick([
    `${cap(d.beast)}, lord of the ${d.dir}. Its colour is ${d.colour}, its season ${d.season}.`,
    `In the ${d.dir}, ${d.beast}, and ${d.colour} for it, as ${d.season} is.`,
    `${cap(d.beast)} keeps the ${d.dir} in ${d.colour}.`,
  ]);
  return {
    who, town, fault, general, count, potter, crew, days, master: mName,
    // The stele at the way in: the emperor, the army, the year.
    stele() {
      return {
        title: 'The Stele',
        lines: [
          'A stone tablet on the back of a stone tortoise, cut in columns:',
          `${who.toUpperCase()} WAS SEALED HERE IN THE ${year}TH YEAR, AND ${count} OF CLAY STAND GUARD, UNDER ${general.toUpperCase()}. LET NONE ENTER.`,
          `Lower down, newer, scratched with a nail: "${cap(F.say)}."`,
        ],
      };
    },
    // The artisans' tally of their days, scratched in the earth.
    tally() {
      const shown = Math.min(days, rng.int(days - 30, days));
      return {
        title: 'Scratched Tally',
        lines: [
          `Strokes in fives, row on row, in the rammed earth: ${shown} days, if you count them all.`,
          rng.pick([
            `Under them, a name: ${potter}, master potter, and the names of his crew: ${crew.join(', ')}.`,
            `The last row is not finished. The strokes get shallower, and then they stop.`,
            `By the last of them, in a different hand: "The crack. Follow the crack."`,
          ]),
        ],
      };
    },
    // A potter's mark on a broken soldier, inside the clay.
    mark() {
      const who2 = rng.chance(0.3) ? potter : rng.chance(0.5) ? rng.pick(crew) : name(rng);
      return {
        title: 'A Potter\'s Mark',
        lines: [
          `Broken open, the soldier shows the inside of the clay. Stamped in it: "Made by ${who2}, of ${rng.pick(shops)}."`,
          rng.pick(['Every one of them is signed. If a soldier cracked in the kiln, the man who made him was punished.', 'The thumbprint of the man who made him is still in the clay.', 'The face was not made from a mould. Somebody sat for it.']),
        ],
      };
    },
    // The muster of the army, on a stele in the pits.
    muster() {
      return {
        title: 'The Muster',
        lines: [
          `The army of ${who}, ${count} strong, under ${general}:`,
          `the crossbowmen in front, kneeling and standing by turns; behind them the infantry in their files, ${rng.int(30, 40)} files of ${rng.int(120, 200)}; the chariots among them; the officers by the drums.`,
          'At the drum, advance. At the bell, halt. There is no order to retreat.',
        ],
      };
    },
    // The map of the empire in quicksilver.
    map() {
      return {
        title: 'The Empire in Little',
        lines: [
          `The whole empire of ${who}, its mountains cast in bronze, its hundred rivers running in quicksilver to a sea of it.`,
          rng.pick(['The rivers still run. Something keeps them running.', `There is a little bronze town by one of the rivers, and its name is ${town}.`, 'The air over the rivers tastes of metal. Do not breathe it long, and do not wade.']),
        ],
      };
    },
    // The four beasts, each on its silk (one of them by its `k`).
    beast(k) {
      const d = DIRECTIONS[k % 4];
      return { title: cap(d.beast), lines: [beastLine(d)] };
    },
    // The stele of the directions, in the shrine: the centre's colour, and
    // what's to be done.
    directions() {
      const c = DIRECTIONS[4];
      return {
        title: 'The Five Directions',
        lines: [
          'Cut in the stone of the shrine:',
          `"The four beasts keep the four quarters, each in its colour. The centre is the emperor's, and its colour is ${c.colour}."`,
          'Under it: SET EACH QUARTER IN ITS COLOUR, AND THE CENTRE IN THE EMPEROR\'S, AND HEAVEN WILL OPEN.',
        ],
      };
    },
    // The inscription inside a bronze cauldron.
    ding() {
      return {
        title: 'Inside the Cauldron',
        lines: [rng.pick([
          `Cast inside it: "${who} made this vessel. May sons and grandsons treasure it ten thousand years."`,
          'Cast inside it: "For the rites of the ancestors. Let them eat, and be content."',
          `Cast inside it: "Given by ${general}, for the victory. May it be used forever."`,
        ])],
      };
    },
    // A crossbowman's verse, scratched on a wall of the gallery.
    verse() {
      return {
        title: 'Scratched on the Wall',
        lines: [rng.pick([
          'Do not walk where the bricks lie square. The walls are watching.',
          'Kneel, draw, loose. Stand, draw, loose. Kneel. They taught us that, and the clay ones learned it.',
          'The drum, and they come on. The bell, and they stand like stone, and you cannot hurt them. Strike when they march.',
          'The potter mends them. Every one I break, he mends.',
          'Silver balls rolling in the dark. Where they go, the statues wake.',
        ])],
      };
    },
    // The artisans' last letter, in the tunnel they dug.
    letter() {
      return {
        title: 'The Artisans\' Letter',
        lines: [
          `We are the potters of ${shops[0]} and the rest, under ${potter}. We made the army, ${count} men, every face a man we knew.`,
          `On the ${days}th day they shut the doors on us. We have been digging this with our hands.`,
          rng.pick(['If you are reading this, it goes nowhere. We tried.', `If you get out, tell ${town} our names.`, 'The others say we should go back and finish the last soldiers. I think they are already back there.']),
        ],
      };
    },
    // The decree of sealing, on the stele in the palace.
    decree() {
      return {
        title: 'The Decree of Sealing',
        lines: ['On a stele of black stone before the palace:', `"${F.decree}"`, `With the seal of ${who}.`],
      };
    },
    // The throne.
    throne() {
      return {
        title: 'The Throne',
        lines: [rng.pick([
          'Black lacquer and gold, the dragon on its back. There is no dust on the seat.',
          'The cushion is worn through where someone sat on it for a very long time.',
          `A tablet lies on the seat: "${who}, who will return."`,
        ])],
      };
    },
    // The bones of one of them.
    bones() {
      return {
        title: 'Bones',
        lines: [rng.pick([
          'The bones of a man, curled up by the wall, a potter\'s scraper still in his hand.',
          `The bones of a man, and a clay tag on a cord: "${rng.pick(crew)}, of the crew of ${potter}."`,
          'The bones of a man who was sealed in. His fingers are worn to the knuckle.',
        ])],
      };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the heart of the vault of ${who}.`, `Since ${F.say}, the army has stood its guard.`, mWhy],
      };
    },
    // (One line, as you come down a floor.)
    arrive() {
      return rng.pick([
        'Far off, a drum: one beat, and then silence.',
        'The air smells of old earth, and faintly of metal.',
        'Rank on rank of clay faces, and every one of them turned toward you.',
        'Somewhere, something silver rolls across the brick.',
      ]);
    },
  };
}
