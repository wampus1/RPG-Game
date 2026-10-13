// (Round 105) What's written in a Leviathan's Gut, and what's left there,
// made from what the world knows of it. Everyone on Corrow knows the
// story: a hunting party went into the bones of the whale (its `who`: the
// Great Whale, the Leviathan, Old Bones, the Whale-Mother, the Drowned
// King) after ambergris, and found the way went on down, into the whale,
// and the whale was not as dead as it looked; the town above won't fish
// the bay now. Underneath: the whaling ship that went in (her name, her
// captain, her crew by name and by trade) and what they took before;
// what went wrong (the whale woke under their knives, the captain went
// deeper for more, the ship was swallowed whole, the worms came, they put
// a harpoon in the heart); the captain's log (where they cut their cache
// into the wall, and the scar they left to find it by); a harpooner's
// tally; a letter home; the manifest; the try-master's notes; the cook's
// complaint; a prayer; farewells scratched in the bone; and the master's
// hall. Every gut tells its own; the same one always tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const FAULTS = {
  woke: {
    say: 'the whale woke under their knives',
    why: 'They were flensing the inside of it, cutting the ambergris out, when the walls moved. The way they came in closed behind them.',
  },
  greed: {
    say: 'the captain would go deeper for more',
    why: 'They had enough to make every one of them rich. The captain said there was more further in. There was.',
  },
  swallowed: {
    say: 'the whale swallowed the ship whole',
    why: 'The ship lay in the bay with her boats in the whale. The whale opened its mouth, and the bay went in, and the ship with it.',
  },
  worms: {
    say: 'the worms came out of the walls',
    why: 'There was something already living in the whale. It did not mind the whale. It minded them.',
  },
  heart: {
    say: 'they put a harpoon in its heart',
    why: 'They found the heart, as big as a cart, beating, and the harpooner put an iron in it to kill the beast for good. It did not die. It started beating faster.',
  },
};
const SHIPS = ['the Patience', 'the Ambergris Queen', 'the Fortunate Widow', 'the Grey Gull', 'the Northern Hope', 'the Good Intent', 'the Salt Mary', 'the Long Chance'];
const SURNAME = ['Hask', 'Morrow', 'Teague', 'Blane', 'Corrigan', 'Whitlock', 'Penhallow', 'Quill', 'Rudd', 'Starling', 'Tolley', 'Vane', 'Ashby', 'Dunmore'];
const GIVEN = ['Eli', 'Nathan', 'Abel', 'Jonah', 'Silas', 'Tobias', 'Ezra', 'Gideon', 'Josiah', 'Caleb', 'Hosea', 'Amos', 'Micah', 'Asa'];
const JOBS = ['the harpooner', 'the cooper', 'the try-master', 'the cook', 'the mate', 'the boatsteerer', 'the ship\'s boy', 'the carpenter'];
const name = (rng) => `${rng.pick(GIVEN)} ${rng.pick(SURNAME)}`;
const MASTER = {
  leviathan_heart: ['the Leviathan\'s Heart', 'The whale\'s own heart, as big as a cart, cut loose of it and still beating. While it beats the whale is not dead, and nothing inside it can die properly either.'],
  gut_wyrm: ['the Gut Wyrm', 'Something that came in with something the whale swallowed, a hundred years ago, and has been eating its way through it ever since. The whale\'s guts are its tunnels.'],
};
const MASTER_ANY = ['the Master of the Gut', 'Whatever keeps the whale alive is at the bottom of it.'];

export function gutLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x6a01));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x6a02));
  const who = rec.origin?.who || 'the Great Whale';
  const town = rec.townName || 'the town above';
  const fault = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[fault];
  const ship = fixed.pick(SHIPS);
  const captain = `Captain ${fixed.pick(SURNAME)}`;
  const crew = fixed.shuffle(JOBS.slice()).slice(0, 5).map((job) => ({ job, name: name(fixed) }));
  const taken = fixed.int(3, 14);
  const [mName, mWhy] = (boss && MASTER[boss]) || MASTER_ANY;
  const one = () => rng.pick(crew);
  return {
    who, town, fault, ship, captain, crew, master: mName,
    // The captain's log, a page of it: the descent, and the cache.
    log() {
      const day = rng.int(2, 9);
      return {
        title: 'The Captain\'s Log',
        lines: [
          `${ship}, out of ${town}, ${captain}. Day ${day} inside ${who}.`,
          rng.pick([
            `Took ${taken} hundredweight of ambergris out of the first chamber. The men are singing.`,
            'The walls are warm. The cook says they were not warm yesterday.',
            'Lost two to the holes in the walls. Something in them takes a man by the arm and will not let go.',
            'The floor moves us along when we are not walking. The boatsteerer has stopped laughing about it.',
          ]),
          `We have cut our cache into the wall where the ambergris lies, behind a cross, and stitched it shut. ${rng.pick(['If we do not come back for it, whoever reads this may have it.', 'The cross is chalked either side.', 'Look for the stitches.'])}`,
        ],
      };
    },
    // A harpooner's tally, cut into a rib.
    tally() {
      const c = crew.find((q) => q.job === 'the harpooner') || one();
      return {
        title: 'Cut in the Bone',
        lines: [`Notches in the rib, in fives: ${rng.int(20, 90)} of them. Over them, ${c.name}, ${c.job}, has cut: "WORMS". ${rng.pick(['The last few are scratched, not cut.', 'Then a mark like a heart, crossed out.', 'Then the word "ENOUGH".'])}`],
      };
    },
    // A letter home, never sent.
    letter() {
      const c = one();
      return {
        title: 'A Letter Home',
        lines: [
          `"To ${rng.pick(['my wife', 'my mother', 'my brother', 'Ma'])}, at ${town}. We are inside the whale. I know how that sounds.`,
          rng.pick(['There is ambergris enough to buy the bay. Tell the Harbourmaster he can keep his boats.', 'It is warm in here, and dark, and it never stops beating. You can feel it in your teeth.', 'If the captain says we go further in, I am not going.']),
          `Your ${c.name.split(' ')[0]}, ${c.job}."`,
        ],
      };
    },
    // The ship's manifest, on the swallowed ship.
    manifest() {
      return {
        title: 'The Manifest',
        lines: [
          `${cap(ship)}, out of ${town}. Master: ${captain}.`,
          `Crew: ${crew.map((c) => `${c.name}, ${c.job}`).join('; ')}.`,
          `Stores: casks ${rng.int(40, 120)}, irons ${rng.int(12, 30)}, line ${rng.int(400, 900)} fathoms. Ambergris: ${taken} hundredweight, and more to come.`,
        ],
      };
    },
    // The try-master's notes, by the try-pot.
    tryworks() {
      return {
        title: 'The Try-Master\'s Notes',
        lines: [rng.pick([
          'Blubber cut in horse-pieces, minced thin, into the pot. Skim the scrap and burn it under for fuel: the whale cooks itself.',
          'The oil from in here burns green. I have never seen oil burn green.',
          'Do not let the oil boil over into the gut. It does not like it.',
        ])],
      };
    },
    // The cook's complaint.
    complaint() {
      return {
        title: 'Scratched on a Cask',
        lines: [rng.pick([
          '"Salt pork, hard tack, salt pork. Inside a whale and still salt pork." The cook.',
          '"Do not eat anything that grows in here. It is not food. It is the whale\'s." The cook.',
          `"Rations for ${crew.length + rng.int(1, 6)}. Rations for ${crew.length}. Rations for ${rng.int(1, 3)}." The cook.`,
        ])],
      };
    },
    // A prayer to the sea, cut on a rib.
    prayer() {
      return {
        title: 'A Prayer',
        lines: [rng.pick([
          'Sea, give us back. We took only what you did not need.',
          'Mother of the deep, we did not know it was yours. Let us out and we will not come back.',
          'Lord of whales, we are very small. Pass us through.',
        ])],
      };
    },
    // Scratched farewells, by the dead.
    farewell() {
      const c = one();
      return {
        title: 'Scratched in the Bone',
        lines: [rng.pick([`${c.name} was here. ${c.name} is still here.`, 'Follow the beat down. Do not follow the beat down.', 'The soft places in the floor move you. Do not stand on them by the bile.', `${captain} took the boat and the ambergris. Curse him.`])],
      };
    },
    // The dead it's digesting.
    dead() {
      const c = one();
      return {
        title: 'A Whaler',
        lines: [`What's left of ${c.name}, ${c.job} of ${ship}: his oilskin coat whole, everything in it half gone. ${rng.pick(['His knife is still in his hand.', 'There is ambergris in his pocket.', 'He had not been here long.'])}`],
      };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the bottom of ${who}.`, `Since ${F.say}, nobody from ${ship} has gone home.`, mWhy],
      };
    },
    // (One line, as you come down.)
    arrive() {
      return rng.pick([
        'Under your feet, slow and enormous, a heartbeat.',
        'It is warm down here, and wet, and the walls are moving.',
        'Somewhere ahead, a smell like rendering oil, and something sweet under it.',
        'The floor shifts under you, as if it were swallowing.',
      ]);
    },
  };
}
