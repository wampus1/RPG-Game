// (Round 102) What's written in a Tide Grotto, and what's left there, made
// from what the world knows of it. Everyone on Myrrow knows the story: the
// stilt folk dived the sea caves for pearls, and one of them (its `who`:
// the Pearl-Queen Kailani, Makoa Sharktooth, the Tide-Chief Nalu, Old Reva
// Netmender, the Drowned Fleet) went in after the great pearl beds and the
// tide came in behind them; and the stilt town above won't dive there now.
// Underneath: the tide-law the divers kept (and the one they broke); the
// dive-count kept at their camp, and where it stops; the tide-pole and its
// great tides; a diver's last words scratched in a shell; the wreck's log;
// the shrine's prayer (three pearls for the sea, and the sea-door opens);
// the carving of the Tide-Mother; and the master's hall. Every grotto tells
// its own; the same grotto always tells the same.
import { RNG, hash4 } from '../../util/rng.js';
import { personName, CULTURES } from '../names.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// What went wrong (seeded): the rule of the tide they broke, and what came
// of it.
const FAULTS = {
  bell: { law: 'No one dives after the third bell.', say: 'they dived after the third bell', why: 'The bell rang three times and they went down again anyway, for one more basket. The tide does not wait for baskets.' },
  mother: { law: 'Never take from the Mother\'s bed.', say: 'they took the Mother\'s pearl', why: 'They took the great pearl from the Mother\'s own bed. The sea came in to take it back, and took them with it.' },
  storm: { law: 'When the swell comes in grey, go home.', say: 'a storm tide came in on them', why: 'A storm tide came in grey and high, higher than any mark on the pole, and the way out was under it.' },
  greed: { law: 'Leave the first pearl of every dive for the sea.', say: 'they kept the sea\'s pearls', why: 'They stopped leaving the first pearl for the sea. The sea keeps its own count.' },
  door: { law: 'Never shut the sea-door behind you.', say: 'the sea-door was shut on them', why: 'Someone shut the sea-door on them from the other side. Nobody has ever said who.' },
};
// The tide-law, at the divers' camp: four of these to a grotto (the one
// they broke always among them).
const LAWS = [
  'Count your breaths going down. Count them coming up. If the numbers differ, tell no one.',
  'Mark the high water every great tide.',
  'Dive in twos. Come up in twos.',
  'Do not answer the drowned when they call your name from the water.',
  'Tie your stone with a knot you can slip.',
  'The jellies drift in with the tide. Do not be in the water when they do.',
];
// Who the divers left above.
const KIN = ['my wife', 'my husband', 'my mother', 'my little ones', 'my brother', 'my sweetheart', 'the net-mender', 'whoever finds this'];
// What a diver scratched in a shell, last.
const LAST = [
  'The water is at my chest. It is very beautiful down here. Tell them I said so.',
  'Third bell. We should have gone up. We should have gone up.',
  'I can hear them singing in the water. They are using our names.',
  'Found the great bed. More pearls than stars. It does not matter now.',
  'The tide went out and did not take us with it. Then it came back.',
];
// The master's hall: what it is, and why it's here.
const MASTER = {
  tide_mother: ['the Tide-Mother', 'The stilt folk prayed to her for the tide\'s mercy, and left her the first pearl of every dive. She brings the sea in, and she remembers who stopped leaving pearls.'],
  abyssal_clam: ['the Abyssal Clam', 'The bed of the greatest pearl, the one every diver came for. It has had a great many divers since.'],
  coral_colossus: ['the Coral Colossus', 'The reef grew over the drowned and their boats, layer on layer, until one day it stood up.'],
};
const MASTER_ANY = ['the Master of the Grotto', 'Whatever brings the tide in lives at the bottom of it.'];

export function grottoLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x6701));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x6702));
  const style = rec.style && CULTURES[rec.style] ? rec.style : 'tide';
  const name = (r) => {
    const p = personName(r, CULTURES[style] ? style : undefined);
    return `${p.first}${p.last ? ` ${p.last}` : ''}`;
  };
  const town = rec.townName || 'the stilt town';
  const who = (rec.origin && rec.origin.who) || 'the Pearl-Queen Kailani';
  const year = (rec.origin && rec.origin.y) || null;
  const faultKey = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[faultKey];
  // The divers: a dozen by name, each their dives and pearls (the same on
  // every floor).
  const divers = [];
  for (let i = 0; i < 12; i++) divers.push({ name: name(fixed), dives: fixed.int(40, 900), pearls: fixed.int(0, 60) });
  // The great tides, by year: the highest the last.
  const y0 = year || 400;
  const tides = [];
  let y = y0 - fixed.int(60, 120);
  for (let i = 0; i < 4; i++) {
    tides.push(y);
    y += fixed.int(8, 30);
  }
  tides.push(y0);
  // The tide-law: the broken one, and three more.
  const laws = fixed.shuffle([F.law, ...fixed.shuffle(LAWS.slice()).slice(0, 3)]);
  const [mName, mWhy] = MASTER[boss] || MASTER_ANY;
  return {
    who,
    fault: faultKey,
    town,
    master: mName,
    // The stilt folk's carving of the Tide-Mother, at the way in.
    carving() {
      return {
        title: 'The Tide-Mother, Carved',
        lines: [
          'Cut in the rock by the stilt folk: a great turtle, her shell a dome of plates, the waves under her flippers.',
          `Under her, worn nearly smooth: THE FIRST PEARL FOR THE MOTHER, AND SHE WILL BRING YOU HOME.`,
          `${who}${year ? ` went down here in ${year}` : ' went down here'}, after the great beds. ${cap(F.say)}. ${town} won't dive here now.`,
        ],
      };
    },
    // The tide-law, at the divers' camp.
    law() {
      return { title: 'The Tide-Law', lines: ['Burned into a driftwood board at the divers\' camp:', ...laws] };
    },
    // The dive-count: the camp's tally of dives and pearls, by name.
    count() {
      const shown = rng.shuffle(divers.slice()).slice(0, 5);
      return {
        title: 'The Dive-Count',
        lines: [
          `Scratched into the rock by the camp, name by name, the dives each made and the pearls each brought up for ${who}:`,
          ...shown.map((d, i) => `${d.name}: ${d.dives} dives, ${d.pearls} pearls${i === 2 ? ' (and after it, a line, and nothing more)' : ''}`),
          rng.pick(['The last name has no number after it at all.', 'Someone has added, much later: "all of them".', 'The marks stop on a day the tide-pole calls a great tide.']),
        ],
      };
    },
    // The tide-pole: the great tides, by year.
    pole() {
      return {
        title: 'The Tide-Pole',
        lines: [
          'A notch for every great tide, the year cut beside it, each higher up the pole than the last:',
          tides.map((t) => `${t}`).join(', ') + '.',
          `The highest notch is cut deep, and beside it: "${F.say.toUpperCase()}".`,
        ],
      };
    },
    // A diver's last words, scratched inside a shell, by their bones.
    shell() {
      const d = rng.pick(divers);
      return {
        title: 'Scratched in a Shell',
        lines: [`By the bones, a shell held tight in what was a hand. Scratched inside it, for ${rng.pick(KIN)}, signed ${d.name}:`, rng.pick(LAST)],
      };
    },
    // The wreck's log: the boat that came in after them.
    log() {
      const capn = name(rng);
      return {
        title: 'A Wreck\'s Log',
        lines: [
          `The log of the ${rng.pick(['Gull', 'Second Chance', 'Pearl of ' + town, 'Netmaker', 'Low Water', 'Kailani\'s Hope'])}, ${capn} master, swollen with water:`,
          rng.pick([
            `Came in on the ebb to find ${who}'s people. Found their camp. Found their boats. Will look further at first light.`,
            'The tide came in faster than the tables said. Have run her up on the sand. We will go on foot.',
            'Heard the bell from inside the grotto. There is nobody to ring it.',
          ]),
          'The last page is only water stains.',
        ],
      };
    },
    // The shrine's prayer, spiralled in shells: three pearls for the sea.
    prayer() {
      return {
        title: 'The Spiral of Shells',
        lines: [
          'Set in shells round the spiral, the stilt folk\'s prayer to the sea:',
          'THREE FOR THE SEA: ONE FOR THE TIDE THAT TAKES, ONE FOR THE TIDE THAT BRINGS, ONE FOR THE MOTHER.',
          'Lay a pearl in each shell, and the sea will open its door to you.',
        ],
      };
    },
    // A cairn of shells, the divers' offering.
    cairn() {
      return {
        title: 'A Cairn of Shells',
        lines: [`Shells piled for the sea, one for every diver of ${town} who did not come up. ${rng.pick(['There are a great many.', 'The newest are at the top.', 'Someone has set a pearl on the very top.'])}`],
      };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the bottom of the grotto of ${who}.`, `Since ${F.say}, the tide has never stopped coming in.`, mWhy],
      };
    },
    // (One line, as you come down a floor.)
    arrive() {
      return rng.pick([
        'Somewhere below, the swell sucks and booms in the rock.',
        'The air tastes of salt. The floor is wet, and the wet is moving.',
        'Far off, a bell rings once, though there is no one to ring it.',
        'The light down here is the light of living things.',
      ]);
    },
  };
}
