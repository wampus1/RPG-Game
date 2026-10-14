// (Round 100) What's written in a Wildwood Hollow, and what's left there,
// made from what the world knows of it. Everyone above knows the story:
// the hollow under the old wood belongs to someone (its `who`: the Green
// Lady, the Oak-Father, the Antlered One, the Briar Maid, Old Hob of the
// Wood), and in the year it happened the town stopped going in, because
// what goes in is kept. Underneath: the Keepers, who tended it for its
// owner long ago, and cut their rules in stone at the way in; the Kept,
// townsfolk who broke a rule and were grown into the walls; the rag-root
// where the town's people still tie their wishes; the woodcutter who came
// for the old timber and notched the days into a stump; the master's hall.
// Every hollow tells its own; the same hollow always tells the same.
import { RNG, hash4 } from '../../util/rng.js';
import { personName, CULTURES } from '../names.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// The Keepers' rules: each hollow keeps three or four of them, and the
// broken one (what went wrong, there) among them.
export const RULES = {
  milk: 'Leave the milk at the stone.',
  ring: 'Do not step in the ring.',
  wood: 'Take no wood from a living root.',
  name: 'If it calls you by your name, do not answer.',
  light: 'Bring no fire past the first root.',
  back: 'Do not look back on the way out.',
};
// What went wrong (which rule was broken, and what came of it).
const FAULTS = {
  milk: { say: 'the milk stopped being left', kept: 'came down to see why the milk was never taken, and was taken' },
  ring: { say: 'a child stepped in the ring', kept: 'stepped in the ring for a dare' },
  wood: { say: 'a woodcutter\'s axe bit a living root', kept: 'came for the old wood with an axe' },
  name: { say: 'someone answered when it called them', kept: 'heard their name called from under the roots, and answered' },
  light: { say: 'someone brought fire in', kept: 'brought a torch past the first root' },
};
// Why the people of the town went in, the ones who were kept.
const WHY = ['for firewood', 'after a lost goat', 'after a lost child', 'for a dare', 'to meet a sweetheart', 'for honey', 'for the mushrooms', 'to hide from the watch', 'to see if the stories were true'];
// What the people of the town still wish for, on the rag-root.
const WISH = [
  'Let my boy come home.', 'Rain, before the barley burns.', 'Let her look my way at the harvest dance.', 'Keep the fever off our house.',
  'Bring back our Ada.', 'A good lambing.', 'Let my father\'s leg mend.', 'Forgive us the milk.', 'Make him stop drinking.',
  'Let the baby come safe.', 'Keep the soldiers away this year.', 'Let me leave this town.', 'For the one in the ring. We\'re sorry.',
];
// The master's hall: what it is, and why it's here.
const MASTER = {
  thorn_queen: ['the Thorn Queen', 'She was a girl from the town once, they say, who stepped in the ring. The garden grew round her, and she grew into its queen. She still wears the ribbon she went in with.'],
  elder_stag: ['the Elder Stag', 'The wood\'s own king, older than the town, older than the road. When the hunt runs above, on the long nights, it is he who leads it.'],
  hollow_oak: ['the Hollow Oak', 'The oldest tree. The hollow is its root-cellar, and everything in it its own. The seasons turn round it, down here, whatever they do above.'],
};
const MASTER_ANY = ['the Owner', 'Whoever the hollow belongs to is at the bottom of it. Nobody has come back up to say more.'];

export function groveLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0xa71));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0xa72));
  const style = rec.style && CULTURES[rec.style] ? rec.style : 'vale';
  const full = (p) => `${p.first}${p.last ? ` ${p.last}` : ''}`;
  const town = rec.townName || 'the town';
  const who = (rec.origin && rec.origin.who) || 'the Green Lady';
  const year = (rec.origin && rec.origin.y) || null;
  const faultKey = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[faultKey];
  // (The broken rule always among the ones cut in the stone.)
  const others = fixed.shuffle(Object.keys(RULES).filter((k) => k !== faultKey)).slice(0, fixed.int(2, 3));
  const rules = fixed.shuffle([faultKey, ...others]);
  const [mName, mWhy] = MASTER[boss] || MASTER_ANY;
  // The first of the Kept: the one the town remembers.
  const firstKept = full(personName(fixed, style));
  const keptYear = () => (year ? year + rng.int(0, 60) : null);
  return {
    who,
    fault: faultKey,
    town,
    rules,
    master: mName,
    // The Keepers' rules, cut in the stone at the way in.
    rulestone() {
      return {
        title: 'The Rule-Stone',
        lines: [`Cut deep, in the old hand, and moss in every letter: the rules of the Keepers of ${who}.`, ...rules.map((k, i) => `${i + 1}. ${RULES[k]}`), 'Under them, newer, scratched with a knife: "WE KEPT THEM. IT KEPT US ANYWAY."'],
      };
    },
    // One of the Kept: someone from the town, grown into the wall.
    kept() {
      const p = full(personName(rng, style));
      const y = keptYear();
      return {
        title: 'One of the Kept',
        lines: [
          `A face in the bark, eyes shut. The roots have grown over a pack, a belt, a hand. Cut in the root over its head, by someone who knew them: ${p.toUpperCase()}.`,
          `${y ? `Went in ${y}, ` : 'Went in '}${rng.pick(WHY)}.`,
          rng.chance(0.4) ? 'Its lips are moving. You can\'t hear what it says. You don\'t lean closer.' : 'It is breathing. Slowly. Like a tree breathes.',
        ],
      };
    },
    // The first of them, the one the town remembers (in the hall of the Kept).
    first() {
      return {
        title: 'The First of the Kept',
        lines: [
          `${firstKept} of ${town}, who ${F.kept}${year ? ` in ${year}` : ''}.`,
          `That was when ${F.say}, and when ${town} stopped going in.`,
          'The roots have their arms round them, the way a mother holds a child.',
        ],
      };
    },
    // The rag-root: the town's wishes, tied on it.
    rags() {
      const ws = rng.shuffle([...WISH]).slice(0, 3);
      return {
        title: 'The Rag-Root',
        lines: ['A dead root hung with rags, hundreds of them, some rotted to threads, some new this year. Words on the newer ones, in ink and charcoal and thread:', ...ws.map((w) => `"${w}"`), `Folk from ${town} still come to the edge of the wood to tie them. Somebody brings them down here.`],
      };
    },
    // The Green Man, cut in a root by the Keepers.
    greenman() {
      return {
        title: 'The Green Man',
        lines: [`A face cut in the root, leaves for its hair, leaves spilling from its mouth: ${who}, as the Keepers saw them.`, rng.pick(['The cuts are old and soft with moss. Someone has rubbed its nose bright.', 'There is milk dried in the grooves of its mouth.', 'Its eyes have been cut again, recently, deeper.'])],
      };
    },
    // The woodcutter's stump: the days notched, and the last of them.
    stump() {
      const p = full(personName(rng, style));
      const days = rng.int(9, 61);
      return {
        title: 'The Notched Stump',
        lines: [
          `Cut clean, the axe still bitten into it. ${days} notches down its side, in rows of seven.`,
          `On the cut face, burned in with a hot nail: "${p} of ${town}. Came for the old oak. The way out is not where I left it."`,
          rng.pick(['The last notches are shallow, like the hand was weak.', 'After the last notch: "It calls me by my name now."', 'After the last notch, a little drawing of a ring of toadstools.']),
        ],
      };
    },
    // A last camp beside it.
    camp() {
      return {
        title: 'A Last Camp',
        lines: ['A bedroll, rotted through. A pack, its strap grown into the moss. A fire that went out a long time ago and was never lit again.', rng.pick(['In the pack: a whetstone, a heel of bread gone to stone, a child\'s carved horse.', 'In the pack: a coil of rope, a tinderbox, a letter never sent ("Tell mother I\'m well").', 'In the pack: nothing. Somebody has emptied it, and folded the bag neatly.'])],
      };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the heart of the hollow of ${who}.`, `Since ${F.say}, nothing has gone out of it that came in.`, mWhy],
      };
    },
    // What's said on coming in.
    arrive() {
      return n === 0 ? `The hollow of ${who}. The air is warm, and smells of moss and milk.` : rng.pick(['Deeper, the roots are older.', 'Something is singing, a long way off, under the ground.', 'The pollen hangs in the air like gold dust.']);
    },
  };
}
