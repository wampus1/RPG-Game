// (Round 98) What's written down in a holdout, made from what the world
// knows of it: the band that took the caves (its founder's name, the year
// the town's watch drove them out of the hills), the gang it is now and its
// chief (the master below), the town that wants them hanged and the road
// they rob, the merchants they've robbed, the captives they hold, the
// ledger of their takings (and which crate the strongbox money went into),
// the letters home they never sent, the watch rota, the gang's articles,
// the raid map, and the chief's last word. Every holdout tells its own; the
// same holdout always tells the same.
import { RNG, hash4 } from '../../util/rng.js';
import { personName, placeName, CULTURES } from '../names.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const ADJ = ['Red', 'Black', 'Grey', 'Iron', 'Broken', 'Gallows', 'Night', 'Blind', 'Rusty', 'Laughing', 'Hollow', 'Crooked'];
const NOUN = ['Hands', 'Crows', 'Dogs', 'Wolves', 'Spurs', 'Knives', 'Ravens', 'Jacks', 'Rats', 'Boots', 'Hounds', 'Hats'];
// The brands burnt on the plunder crates (see deeps/holdout.js), and the
// merchant houses whose marks they are.
export const BRANDS = ['star', 'wheel', 'fish', 'tree'];
const HOUSE = { star: 'the Starling house', wheel: 'the wheelwrights\' guild', fish: 'the fish-wives\' company', tree: 'the Ashgrove traders' };
const GOODS = ['bolts of dyed cloth', 'casks of wine', 'salt', 'iron in bars', 'grain', 'a strongbox of coin', 'candles and tallow', 'leather', 'pepper and cloves', 'the mail', 'a lady\'s trunk', 'wool', 'horses'];
const MONTHS = ['Thaw', 'Seedtime', 'Greening', 'High Sun', 'Haying', 'Harvest', 'Leaf-fall', 'Frost', 'Deep Winter'];
// What the gang's chief is, by the master waiting at the bottom (the wanted
// bill's description; why they're down there).
const CHIEF = {
  warlord: ['a big man, black-bearded, under a spiked helm, a red tabard over stolen plate', 'He keeps to the lowest hall with the best of the take, and comes up only to choose who rides out.'],
  twins: ['two of them: brothers, alike as two coins, one with a hammer and one with knives', 'The twins have the lowest cave between them, and nobody goes down without being sent for.'],
  poisoner: ['a thin woman, pale, gloved to the elbow, a satchel of phials', 'She brews in the deepest cave, where the fumes can\'t reach the rest of us. Mostly can\'t.'],
  ash_reaver: ['a raider out of the ash, scarred, a red sash, a flail of three heads', 'He went berserk at the last raid and they had to chain him in the lowest cave till it passed. It has not passed.'],
  bombard_queen: ['a woman with a cannon\'s worth of powder on her and a match always lit', 'She keeps the big gun down below, and the big powder, and will blow the whole hill if they ever come for us.'],
  chained_drake: ['nobody: the gang\'s beast, a drake they caught as a hatchling and keep chained in the deepest cave', 'The chief feeds the drake from the take. It\'s grown. The chain hasn\'t.'],
  sharktooth: ['a big man gone to salt, a sea-blue coat, sharks\' teeth round his neck, a barbed harpoon', 'He came ashore with his crew when their ship went down, and took these caves for a hold.'],
  pearl_queen: ['a proud woman, a crown that\'s a great fanned shell, ropes of pearls, a sabre', 'She keeps the pearls below, and what she does to those who touch them is talked of in whispers.'],
  smugglers_kraken: ['nobody: the thing in the sea-cave the smugglers feed', 'What the smugglers feed in the water below is bigger every year, and now it feeds itself.'],
  deserter_general: ['the general who left his legion to die, in dented plate, the red of his rank gone brown', 'He holds the lowest cave like a fort, and drills us there still.'],
  war_eagle: ['nobody: the legion\'s eagle, alive, the size of a horse', 'The general\'s eagle nests below. It was a standard once. Now it is hungry.'],
  bandit_khan: ['a khan of the steppe riders, a fur hat, a curved bow, a horse-tail standard', 'The khan rides out from the lowest cave and back into it, and nobody sees him do it.'],
  thunderbird: ['nobody: the storm bird the riders keep below, lightning in its feathers', 'The riders feed the bird below, and when it beats its wings the caves thunder.'],
  harpoon_queen: ['the whalers\' queen, a coat of oiled hide, a harpoon on a long line', 'She hunts in the drowned caves below, and drags back what she takes.'],
  bull_walrus: ['nobody: the old bull walrus in the sea-cave, its tusks long as spears', 'The bull walrus came in with a tide and would not go out, and the gang lets it be.'],
  salt_doge: ['the doge of the salt pans, a robe of office white with salt, a gilt horn of a cap', 'He rules the lowest cave as he ruled the pans, with a ledger and a knife.'],
  lagoon_hydra: ['nobody: three heads out of the lagoon in the lowest cave', 'The hydra in the lagoon below takes a share of every catch, and more besides.'],
  burrow_baron: ['a baron of the burrows, broad, a fur-trimmed coat, rings on every finger', 'The baron dug himself a hall below and lives in it like a lord, and lords it over us.'],
  cave_bear: ['nobody: the cave bear in the deepest den', 'There\'s a bear below. A big one. We leave it the bones.'],
  fey_reaver: ['a reaver of the fair folk, beautiful and wrong, a blade of cold iron', 'She came out of the hill one night and the old chief was gone by morning.'],
  white_hart: ['nobody: the white hart that walks in the lowest cave', 'The hart in the deepest cave can\'t be caught, and those who go after it don\'t come back.'],
  the_wrecker: ['the wrecker who lights false lamps on the rocks, a lantern on a pole, a hook', 'He keeps his lamps below, and goes up on stormy nights to light them.'],
  storm_petrel: ['nobody: the storm petrel that roosts in the sea-cave below', 'The bird below brings the storms, and the storms bring the wrecks, and the wrecks bring the take.'],
};
const CHIEF_ANY = ['a big one, scarred, with a voice to wake the dead', 'The chief keeps the lowest cave and the best of the take.'];
const WHY = ['were driven out of the hills by the watch', 'robbed a tax wagon and could never go home', 'were outlawed by the lord for poaching his deer', 'deserted when the war went bad', 'were burned out of the old quarter', 'took the road when the mill closed'];
const LETTER_TO = ['Mam', 'Dear sister', 'Da', 'My love', 'Little brother', 'Gran'];
const LETTER = [
  'I\'m doing all right. There\'s meat most nights and nobody to tell me when to sleep.',
  'Don\'t believe what they say in town about us. We only take from them that have.',
  'The chief\'s took against me since the last job. I keep to the bunks and keep my head down.',
  'They\'ve a new dog-man, and the dogs are worse than the man. I give them my bones to stay friends.',
  'I\'ve put by a share. When it\'s enough I\'m coming home, and nobody need know where it came from.',
  'The lookouts say there\'s riders on the road asking after us. I\'d tell you not to worry but you will.',
];
const LETTER_END = ['Burn this. Your loving son.', 'Don\'t tell Da where I am.', 'Kiss the little ones for me.', 'I\'ll be home by harvest. I swear it.', 'Pray for me. Somebody should.'];
const ARTICLES = [
  'Every share alike, the chief two, the lookout one and a half.',
  'No fire in the powder hole. No pipe, no candle, no lantern. Not ever.',
  'Who rats, hangs.',
  'The dogs are fed before the men.',
  'Nobody touches the take till the chief says.',
  'No knives drawn in the mess. Take it outside.',
  'A captive\'s worth more alive. Remember it.',
  'Who sleeps on watch goes in the pit.',
];

export function holdLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x8a1));
  const style = rec.style && CULTURES[rec.style] ? rec.style : 'vale';
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x8a2));
  const full = (p) => `${p.first}${p.last ? ` ${p.last}` : ''}`;
  const town = rec.townName || placeName(fixed, style);
  const town2 = placeName(fixed, style);
  const y = rec.origin && rec.origin.y ? rec.origin.y : null;
  const founder = (rec.origin && rec.origin.who) || full(personName(fixed, style));
  const gang = `the ${fixed.pick(ADJ)} ${fixed.pick(NOUN)}`;
  const chiefName = full(personName(fixed, style));
  const [desc, below] = CHIEF[boss] || CHIEF_ANY;
  const man = !/^nobody/.test(desc);
  const why = fixed.pick(WHY);
  const reward = 50 * fixed.int(4, 30);
  const merchants = Object.fromEntries(BRANDS.map((b) => [b, `${HOUSE[b]} of ${fixed.chance(0.5) ? town : town2}`]));
  const name = () => full(personName(rng, style));
  return {
    gang,
    town,
    town2,
    chief: man ? chiefName : founder,
    // The WANTED bill (the gang keeps it nailed up, for the laugh).
    wanted() {
      return {
        title: 'WANTED',
        lines: [
          man ? `${chiefName}, chief of ${gang}: ${desc}.` : `The ${gang}, the band of the late ${founder}. Their chief keeps ${desc.replace(/^nobody: /, '')}.`,
          `For robbery on the road between ${town} and ${town2}, and for murder, and for the taking of hostages.`,
          `REWARD: ${reward} crowns, paid at the reeve's house in ${town}. Alive or otherwise.`,
          rng.pick(['(Someone has drawn a moustache on it, and written underneath: "NOT ENUF".)', '(Pinned up with a knife. Darts have been thrown at it.)', '(Someone\'s added a nought to the reward, in charcoal.)']),
        ],
      };
    },
    // The quartermaster's ledger of the takings: and where the strongbox
    // money went (the crate with that brand on it).
    ledger(answer) {
      const lines = [];
      for (let i = 0; i < 3; i++) {
        const b = rng.pick(BRANDS);
        lines.push(`${rng.pick(MONTHS)}: ${merchants[b]}, ${rng.int(2, 6)} wagons on the ${town} road. ${cap(rng.pick(GOODS))}, ${rng.pick(GOODS)}. ${rng.pick(['No trouble.', 'One driver fought. One driver less.', 'Their guards ran.', 'Took the horses too.'])}`);
      }
      if (answer !== null && answer !== undefined) {
        const b = BRANDS[answer];
        lines.push(`The strongbox money off ${merchants[b]} put by in the crate with the ${b} burnt on it, under the straw. Nobody touches it till the chief says.`);
      }
      lines.push(`Owed: ${name()}, two shares; ${name()}, one (less the dice).`);
      return { title: 'The Plunder Ledger', lines };
    },
    // A letter home in a footlocker, never sent.
    letter() {
      return { title: 'A Letter, Never Sent', lines: [`${rng.pick(LETTER_TO)}, at ${town},`, rng.pick(LETTER), rng.pick(LETTER), `${rng.pick(LETTER_END)} ${name().split(' ')[0]}`] };
    },
    // The watch rota, the dogs' feeding.
    rota() {
      return {
        title: 'The Watch',
        lines: [`First watch: ${name()}, ${name()}. Second: ${name()} (and NOT asleep this time).`, `Dogs fed at dusk by ${name()}. Not before the men, whatever the articles say.`, `Bells on the wires checked every morning. Who walks into one buys the ale.`],
      };
    },
    // The gang's articles, nailed up in the mess.
    articles() {
      const a = rng.shuffle([...ARTICLES]).slice(0, 4);
      return { title: `The Articles of ${cap(gang)}`, lines: a.map((t, i) => `${i + 1}. ${t}`).concat([`Signed with ${rng.int(9, 31)} marks.`]) };
    },
    // A captive: who they are, what they say freed, what they know.
    captive(stashWhere) {
      const who = name();
      const home = rng.chance(0.6) ? town : town2;
      const trade = rng.pick(['a carter', 'a merchant\'s clerk', 'a tinker', 'a drover', 'a priest\'s boy', 'a midwife', 'a wool-buyer', 'a fiddler']);
      return {
        name: who,
        home,
        ransom: {
          title: 'A Ransom Letter',
          lines: [`To the family of ${who}, ${trade} of ${home}:`, `We have them. ${rng.int(40, 300)} crowns, left at the ${rng.pick(['old ford', 'hanging oak', 'third milestone', 'broken bridge'])} by the new moon, or you'll have them back a piece at a time.`, `(Not sent. Under it, in another hand: "the family's poor, chief. what now".)`],
        },
        thanks: rng.pick([`You're not one of them? Get me out, please. I'm ${who}, from ${home}.`, `Please! I've a family in ${home}. Get me out of here.`, `Quick, before they come back. I'm ${who}, ${trade} of ${home}.`]),
        farewell: rng.pick([`I'll tell ${home} what you did.`, 'Bless you. I won\'t forget this.', 'I can find my own way from here. Thank you. Thank you.']),
        stashHint: stashWhere ? `I heard them talk. The take's behind a false wall ${stashWhere}: painted canvas over a frame. Feel for the draught.` : null,
      };
    },
    // The raid map: the road between the towns, the ambush marked.
    raidMap() {
      return {
        title: 'The Raid Map',
        lines: [
          `The road from ${town} to ${town2}, drawn in charcoal: the ${rng.pick(['ford', 'cut through the hill', 'bridge', 'bend by the wood'])} marked with a cross and "HERE".`,
          `"The patrol out of ${town} rides on ${rng.pick(['market days', 'the first of the month', 'feast days'])}. The caravans don't."`,
          `"${merchants[rng.pick(BRANDS)]} sends its wagons in ${rng.pick(MONTHS)}. Be ready."`,
        ],
      };
    },
    // The chief's last word, in the master's hall.
    last() {
      return {
        title: 'The Chief\'s Word',
        lines: [
          y ? `${cap(gang)}, that was ${founder}'s band, holed up here in ${y}, when they ${why}.` : `${cap(gang)}, that was ${founder}'s band, holed up here when they ${why}.`,
          below,
          rng.pick(['"Let them come. Let them all come."', '"Nobody leaves the band. Nobody."', `"${town} will pay. They always pay."`]),
        ],
      };
    },
  };
}
