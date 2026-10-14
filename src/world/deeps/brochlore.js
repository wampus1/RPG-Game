// (Round 109) What's written in a Drowned Broch, and what's left there,
// made from what the world knows of it. Everyone on the Skerries knows the
// story: the great storm broke the broch where its keeper kept the beacon
// (its `who`: the Beacon-Keeper Erling, the Storm Giant, the Wreckers, Old
// Finnman, the Selkie Mother), and the sea came into its stair; and there's
// a light in it still, on wild nights, with nobody to light it.
// Underneath: the keeper himself (his name, his log), the wreckers' captain
// and their tally, a ship that broke on the rocks below (her name, her
// master), the town, and what went wrong (the keeper let the light go out;
// the wreckers showed a false one; the keeper took the wreckers' silver; the
// trows came up out of the walls; the sea took the stair in the great
// storm). Its papers: the keeper's log (where the oil's kept, and that the
// beacon must be lit), the wreckers' tally, a sailor's letter, the ballad,
// the symbol stones, a note in a kist, the wall-cells, what's scratched by
// the bar of the strongroom, and the master's hall. Every broch tells its
// own; the same one always tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const FAULTS = {
  dark: {
    say: 'the keeper let the light go out',
    why: 'One night in the back-end of the year the keeper slept at his post, and the light went out, and a ship came in out of the dark onto the skerry. He heard them screaming. He has not slept since.',
  },
  false: {
    say: 'the wreckers showed a false light',
    why: 'The wreckers hung their lanterns on the rocks where the harbour isn\'t, and the ships came in to them and broke. The keeper\'s light was true, so they put it out, and him with it.',
  },
  silver: {
    say: 'the keeper took the wreckers\' silver',
    why: 'They paid him to dark the beacon on the nights they wanted, and he took their silver. Every ship that broke here, he had a share of.',
  },
  trows: {
    say: 'the trows came up out of the walls',
    why: 'The broch was built over a trow-hole, everyone knew it, and the keepers left them their bowl of milk on the cell sill. Then a keeper forgot. They came up out of the walls in the night, and they have not gone back.',
  },
  storm: {
    say: 'the sea took the stair in the great storm',
    why: 'Three days the storm blew. On the third night the sea came up the stair and took the lower floors and everyone sheltering in them, and the beacon went out for the first time in a hundred years.',
  },
};
const FIRST = ['Erling', 'Magnus', 'Thorvald', 'Ingrid', 'Sigrid', 'Ragna', 'Arne', 'Olaf', 'Hakon', 'Brynja', 'Sven', 'Gunn', 'Torfinn', 'Asa', 'Kol', 'Helga', 'Ottar', 'Ivar', 'Freya', 'Leif'];
const LAST = ['Sinclair', 'Isbister', 'Tulloch', 'Flett', 'Rendall', 'Halcrow', 'Mowat', 'Twatt', 'Linklater', 'Spence', 'Garriock', 'Leask'];
const SHIPS = ['the Brave Margaret', 'the Kittiwake', 'the Hope of Leith', 'the Grace Darling', 'the Seven Sisters', 'the Merry Widow', 'the Northern Star', 'the Bonny Ellen'];
const name = (rng) => `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
const MASTER = {
  beacon_keeper: ['the Beacon-Keeper', 'He kept the light a hundred years and would not let it go. He keeps it still, drowned; and now his light calls the ships onto the rocks.'],
  sea_trow: ['the Sea Trow', 'Up out of the flooded stair, where it hoards what the sea brings it. It wants the broch for its own, and everyone in it.'],
};
const MASTER_ANY = ['the Master of the Broch', 'Whatever keeps the broch now is at the top of it, where the light was.'];

export function brochLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x6201));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x6202));
  const who = rec.origin?.who || 'the Beacon-Keeper Erling';
  const town = rec.townName || 'the town on the voe';
  const year = rec.origin?.y || 1200;
  const fault = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[fault];
  const keeper = name(fixed);
  const captain = name(fixed);
  const ship = fixed.pick(SHIPS);
  const master = name(fixed);
  const [mName, mWhy] = (boss && MASTER[boss]) || MASTER_ANY;
  return {
    who, town, year, fault, keeper, captain, ship, shipMaster: master, master: mName,
    // The keeper's log: the beacon, and where the oil's kept.
    log() {
      return {
        title: `${keeper}'s Log`,
        lines: [
          `Wind north-west, rising. Lit the beacon at dusk as always. ${rng.pick(['Oil low.', 'The last of the oil in the basket.', 'Oil enough for three nights.'])}`,
          rng.pick(['The fish-oil is kept below with the boats, in the casks, and in the store the wreckers took off me. Bring a jar up and pour it on the peat, and put a light to it.', 'If you are reading this the light is out. Fetch oil up from the casks below, a jar of it, and feed the basket. Whatever happens, light it.']),
          `(${keeper}, keeper, the year ${year}.)`,
        ],
      };
    },
    // The rules on the way in: a keeper's notice.
    rules() {
      return {
        title: 'Notice, by the Door',
        lines: [
          'Keep the lamps lit. Keep out of the gallery when the wind\'s in the slits. Leave the trows their milk on the cell sills, and don\'t put your hand in a cell.',
          `(By order of ${keeper}, keeper of the light, for the town of ${town}.)`,
        ],
      };
    },
    // The wreckers' tally.
    tally() {
      return {
        title: 'A Tally, in Charcoal',
        lines: [
          `${cap(ship)}: 40 casks wine, 2 chests plate, the bell. ${rng.pick(['Crew: none come ashore.', 'Crew: 3 come ashore, seen to.', 'Crew: the master, kept for the ransom.'])}`,
          rng.pick(['The Lass of Hoy: tea, rope, 9 barrels tar.', 'A Dutchman, name gone: cheese, gin, the figurehead.', 'The Swan: nothing but timber. Burnt her.']),
          `(${captain}'s mark. The key's on ${rng.pick(['Bjorn', 'the lame one', 'whoever holds the door'])}, nobody else's.)`,
        ],
      };
    },
    // A sailor's letter, never sent.
    letter() {
      return {
        title: 'A Letter, Never Sent',
        lines: [
          `"Dear Mother. We sail on ${ship} tomorrow under ${master}. There's a light on the skerries I'm told to watch for: steer by it and you can't go wrong."`,
          rng.pick(['"Kiss Annie for me."', '"Don\'t fret. I\'ll be home by Martinmas."', '"I\'ll bring you a shawl from Bergen."']),
        ],
      };
    },
    // The ballad they sing of it in the town.
    ballad() {
      return {
        title: 'The Ballad of the Broch',
        lines: [
          `O the light upon the skerry it was ${rng.pick(['bonny', 'steady', 'golden'])} and was true,`,
          'and the ships that sailed the Sound by it came home to me and you;',
          `till the night ${F.say},`,
          rng.pick(['and the sea came up the stair.', 'and the light was lit no more.', 'and the drowned walk on the shore.']),
        ],
      };
    },
    // The symbol stone: what the builders cut.
    symbol(kind) {
      return {
        title: 'A Symbol Stone',
        lines: [kind === 1
          ? 'A salmon, cut in the stone by the broch\'s builders, over two discs joined. Nobody knows what it meant. The keepers said it meant "the sea gives".'
          : 'A crescent, cut in the stone by the broch\'s builders, a broken arrow through it. Nobody knows what it meant. The keepers said it meant "the light holds".'],
      };
    },
    // A note in a sea-kist.
    kist() {
      return {
        title: 'In a Sea-Kist',
        lines: [rng.pick([
          'A spare shirt, a knife, a Bible with a name in it written over and over, and a lock of red hair in a paper.',
          `Nothing but a dry biscuit and a paper: "Property of ${master}, master of ${ship}."`,
          'Empty, but for sand. Someone was in a hurry.',
        ])],
      };
    },
    // On the keeper's box-bed.
    bunk() {
      return {
        title: 'Scratched in the Box-Bed',
        lines: [`Tally marks, hundreds of them, in rows: one a night. And at the end: "${rng.pick(['I can hear them in the walls.', 'The light must not go out.', 'Forgive me.'])}"`],
      };
    },
    // A drowned sailor.
    drowned() {
      return {
        title: 'A Drowned Sailor',
        lines: [rng.pick([
          `A sailor off ${ship}, by his jacket. His pockets turned out.`,
          'A boy, by the size of the boots. The crabs have had the rest.',
          `${master}'s ring on a finger bone: the master of ${ship}.`,
        ])],
      };
    },
    // The figurehead.
    figurehead() {
      return {
        title: 'A Figurehead',
        lines: [`The figurehead off ${ship}: a woman, her paint worn to the wood, her arms crossed. ${rng.pick(['Her eyes have been gouged out.', 'Someone has hung a string of shells round her neck.', 'Her gilt hair still shines.'])}`],
      };
    },
    // What went wrong (told on the strongroom's door).
    story() {
      return { title: 'Scratched by the Strongroom\'s Bar', lines: [`The night ${F.say}.`, F.why, fault === 'false' || fault === 'silver' ? `(${captain}.)` : `(${keeper}.)`] };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the top of the broch above ${town}, where the light was.`, `Since ${F.say}, the light has been wrong.`, mWhy],
      };
    },
    // (One line, as you come down.)
    arrive() {
      return rng.pick([
        'The wind howls in the slits. Somewhere below, the sea booms in the stair.',
        'It stinks of fish-oil and wrack.',
        'A lamp gutters in its niche, and something in the wall goes quiet.',
        'Water drips from every stone.',
      ]);
    },
  };
}
