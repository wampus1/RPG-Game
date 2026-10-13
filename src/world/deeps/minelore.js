// (Round 96) What's written down in a mine, made from what the world knows
// of it: what was dug there and for whom, the town that sent its sons and
// daughters down, the year it fell in and how many it kept, the names on
// the tally board, the foreman's ledger, a letter never sent, the
// company's notice nailed up after, the surveyor's notes (where the rich
// seam was hidden; how the points are thrown for the old drift), and what
// the miners broke into at the bottom, as they wrote it. Every mine tells
// its own; the same mine always tells the same.
import { RNG, hash4 } from '../../util/rng.js';
import { personName, CULTURES } from '../names.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// What the mine was dug for (from its name, if the record doesn't say).
const ORES = ['iron', 'copper', 'tin', 'silver', 'gold', 'lead', 'coal', 'salt', 'glass', 'turquoise', 'jade', 'amber'];
export function oreOf(rec) {
  if (rec.origin && rec.origin.ore) return rec.origin.ore;
  const m = /\b(\w+) (?:Mine|Workings)\b/i.exec(rec.name || '');
  const w = m && m[1].toLowerCase();
  return ORES.includes(w) ? w : 'ore';
}
// How many it kept (from its story, if the record doesn't say).
export function lostOf(rec) {
  if (rec.origin && rec.origin.lost) return rec.origin.lost;
  const m = /(\d+) miners were lost/.exec((rec.origin && rec.origin.text) || '');
  return m ? +m[1] : 23;
}

// Who owned it: a name, and how they styled the concern.
const CONCERNS = ['& Sons', 'and Company', 'Brothers', '& Daughters', 'Holdings', 'Deep Works'];
// What they broke into at the bottom, as the last entries have it, by what
// waits there (see deeps/mine.js: the master's chosen from the mine's own
// seed, so every floor's papers speak of the same one).
const BROKE = {
  worm: ['The face moved. Not fell: moved, like something breathing under the rock.', 'Holes in the deep drift a man could stand up in, round as a well, and warm.'],
  foreman: ['The foreman won\'t come up. Says he won\'t leave the deep shift behind.', 'The foreman stood at the shaft foot with his lamp and sent us up, and stayed.'],
  brood_mother: ['Broke into a cave below the deep drift. Eggs in it, rows of them, the size of a man\'s head. Some are warm.', 'The crawlers come up out of the new cave now. Big ones. One bigger than any.'],
  glass_wyrm: ['The seam ran into black glass, and the glass was hot, and something in it turned to look at us.'],
  magma_tender: ['Fire in the deep drift that nobody lit. Something walks in it, tending it.'],
  bellows_golem: ['Heard bellows below the lowest level, working, where no forge was ever built.'],
  spore_colossus: ['The new cutting is all white with mould. It grows over a man if he stands still.'],
  lamprey_queen: ['Water came up through the sump with things in it, long, round-mouthed. They bite and they hold on.'],
  gas_bloat: ['Firedamp in the deep drift, more than any I\'ve seen, and it moves against the draught.'],
};
const BROKE_ANY = ['We broke through into something that was there before the mountain was.', 'Something knocks back when we knock on the rock. Not the knockers. Lower.', 'The deep drift went through into a cave nobody dug. We heard it before we saw it.'];
const LETTER_TO = ['Dear Mother', 'My love', 'Little sister', 'Dear Father', 'My dear wife', 'My dear husband', 'Dear Gran', 'Old friend'];
const LETTER = [
  'The pay is good and the work is filthy and I am well, mostly.',
  'They have us on double shifts now the company wants the deep seam.',
  'Do not worry about the knocking. The old men say it is only the knockers, and that they are friends.',
  'I have put by enough for the roof. Two more months.',
  'The foreman says the deep drift is safe. The foreman says a lot of things.',
];
const LETTER_END = [
  'I will be up at the end of the month, God willing.',
  'Tell the little ones I found them a crystal. I will bring it up.',
  'If I do not come up, the money is under the hearth-stone.',
  'Burn this. I do not want you worrying.',
];

export function mineLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x3e1));
  const town = rec.townName || null;
  const style = rec.style && CULTURES[rec.style] ? rec.style : 'vale';
  const y = rec.origin && rec.origin.y ? rec.origin.y : null;
  const ore = oreOf(rec);
  const lost = lostOf(rec);
  const name = () => personName(rng, style);
  const full = (p) => `${p.first}${p.last ? ` ${p.last}` : ''}`;
  // (The owner and the foreman are the same on every floor.)
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x3e2));
  const ownerP = personName(fixed, style);
  const owner = `${ownerP.last || ownerP.first} ${fixed.pick(CONCERNS)}`;
  const foremanP = personName(fixed, style);
  const foreman = full(foremanP);
  const opened = y ? y - fixed.int(12, 60) : null;
  const broke = () => rng.pick(BROKE[boss] || BROKE_ANY);
  return {
    owner,
    foreman,
    // The board at the pithead: a brass tag on a nail for each one down;
    // the ones that came up took theirs back.
    tally: () => {
      const names = [];
      for (let i = 0; i < 5 + rng.int(0, 2); i++) names.push(name().first);
      const stay = names.filter(() => rng.chance(0.55));
      return {
        title: 'THE TALLY BOARD',
        lines: [
          `Each that goes down hangs their tag. Each that comes up takes it back. ${owner}.`,
          `Still on the nails: ${(stay.length ? stay : names.slice(0, 2)).join(', ')}.`,
          `${lost} tags in all were never taken back${y ? `, from the year ${y}` : ''}.`,
        ],
      };
    },
    // The plate on the headframe.
    headframe: () => ({
      title: 'A PLATE ON THE HEADFRAME',
      lines: [`${cap(owner)}. No. ${fixed.int(1, 4)} Shaft.`, opened ? `Sunk in the year ${opened} for ${ore}.` : `Sunk for ${ore}.`, town ? `"Down for ${town}, up for supper."` : '"Down for the vale, up for supper."'],
    }),
    // The foreman's ledger, its last pages.
    ledger: () => {
      const tons = rng.int(8, 40);
      return {
        title: 'THE FOREMAN\'S LEDGER',
        lines: [
          `${foreman}, foreman. ${tons} tons of ${ore} up this month; the company wants twice that.`,
          `Orders from ${owner}: open the deep drift. I told them the props would not hold. Open it anyway.`,
          broke(),
          rng.pick(['Last entry, in another hand: "He went back down for them."', 'The last page is torn out.', 'The ink of the last line runs, as if it got wet.']),
        ],
      };
    },
    // A letter in a miner's box, never sent.
    letter: () => {
      const me = name().first;
      return {
        title: 'A LETTER NEVER SENT',
        lines: [`${rng.pick(LETTER_TO)}${town ? `, at ${town}` : ''},`, rng.pick(LETTER), rng.pick(LETTER), `${rng.pick(LETTER_END)} Your ${me}.`],
      };
    },
    // The company's notice, nailed up after.
    notice: () => ({
      title: 'A COMPANY NOTICE',
      lines: [
        `By order of ${owner}:`,
        'the lower levels are closed and are not to be entered.',
        `Wages owing to the ${lost} men and women lost below will not be paid, the contract being broken by their absence.`,
        rng.pick(['Someone has scratched under it: "THEY ARE STILL WORKING"', 'Someone has scratched under it: "liars"', 'Someone has scratched under it a row of tally marks, then given up.']),
      ],
    }),
    // The surveyor's notes: where the rich seam was sealed up, and how to
    // send a cart down the old drift (see deeps/mine.js: the chalk cross,
    // the points).
    survey: (chalk, points) => ({
      title: 'THE SURVEYOR\'S NOTES',
      lines: [
        `Survey of the ${ore} workings for ${owner}.`,
        chalk ? 'The richest pocket on this level was never booked. The men sealed it behind a thin face and chalked a cross on it, against the day.' : `The ${ore} thins below this level. Not worth the props.`,
        points ? `The old drift's choked with fall. A loaded cart sent down the rails will clear it, if the points are thrown ${points}.` : 'Rails sound throughout.',
        rng.pick(['Lamps to be kept LOW where there is firedamp.', 'Mind the props marked with a cross. They are talking.', 'Leave the knockers a crust. Everybody does.']),
      ],
    }),
    // The last note of one of the lost shift, under a fall.
    trapped: () => {
      const me = name().first;
      const days = rng.int(2, 6);
      return {
        title: 'SCRATCHED ON A LAMP-TIN',
        lines: [`${me}. The roof came down behind us. Day ${days}.`, 'We can hear them digging on the other side. They do not answer when we shout.', 'The digging is getting closer. Why don\'t they answer.'],
      };
    },
    breakthrough: () => ({
      title: 'CHALKED ON THE ROCK',
      lines: [broke(), rng.pick(['DO NOT DIG DEEPER', 'IT HEARS THE PICKS', 'TELL THEM WE TRIED']), `— the ${y ? `${y}` : 'last'} deep shift`],
    }),
  };
}
