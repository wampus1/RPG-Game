// (Round 103) What's written in an Imperial Catacomb, and what's left there,
// made from what the world knows of it. Everyone in Velmarch knows the
// story: the emperor (its `who`: Aurelian, the Ninth Legion, Livia, Varro,
// the Praetorians) was laid under the hills with the legions ranked round
// about, sworn to guard him past death; and the town above still hears the
// march on the eve of the Triumph. Underneath: the legion itself (its
// number, its name, its eagle) and its victories, one of them won near the
// town above; what went wrong (the oath, the plague, the mutiny, the
// Triumph never held, the usurper's cup); the epitaphs of the dead (their
// names, their trades, their ages to the day, who set the stone up); the
// fossors' ledger, and where it stops; the family's tree, painted in the
// tablinum, and the busts of the ancestors in their order; a tomb-robber's
// warning scratched on a wall; the emperor's decree at the tribunal; and
// the master's hall. Every catacomb tells its own; the same one always
// tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const ORD = ['Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Fourteenth', 'Twentieth', 'Twenty-Second'];
const EPITHET = ['the Ironclad', 'the Victorious', 'the Fortunate', 'the Twin', 'the Thunderbolt', 'the Faithful', 'the Firstborn', 'the Unconquered', 'the Lark'];
// What went wrong (seeded): the oath they swore, and what came of it.
export const FAULTS = {
  oath: {
    say: 'the legion was sealed in alive with him',
    why: 'When the emperor was laid here, the legion swore to guard him past death; and the gates were shut on them while they were still saying it.',
    decree: 'Let no man of the legion leave his post while the emperor sleeps: not for hunger, not for thirst, not for death.',
  },
  plague: {
    say: 'they were laid here in haste, and the rites were never done',
    why: 'The plague came in the emperor\'s last year and took him and half the legion with him. They were carried down in a hurry and the rites were never said. The unburied do not rest.',
    decree: 'Let the dead be laid in their ranks, and let the rites be said over them before the gate is shut.',
  },
  mutiny: {
    say: 'the legion turned on him, and he cursed them',
    why: 'In the end the legion turned on him. With his last breath he cursed them to serve him forever, and they do.',
    decree: 'Let the man who breaks his oath to the eagle serve it all the longer.',
  },
  triumph: {
    say: 'he died the night before his Triumph',
    why: 'He died the night before his Triumph, with the city decked in laurel for him. The legion was laid down here with him in its parade armour. It is waiting still for the trumpets.',
    decree: 'Let the legion stand ready in its ranks for the Triumph, and march when the trumpets sound.',
  },
  usurper: {
    say: 'his heir poisoned him at his own table',
    why: 'His heir poisoned him at his own table and buried him with honours. An emperor who is murdered does not rest. He is waiting for his heir.',
    decree: 'Let my heir come down to me, when his time comes. I will be waiting.',
  },
};
const PRAE = ['Gaius', 'Lucius', 'Marcus', 'Quintus', 'Titus', 'Publius', 'Aulus', 'Decimus', 'Gnaeus', 'Sextus', 'Servius', 'Spurius'];
const NOMEN = ['Aurelius', 'Valerius', 'Cornelius', 'Julius', 'Claudius', 'Flavius', 'Fabius', 'Junius', 'Sulpicius', 'Licinius', 'Caecilius', 'Octavius', 'Varius', 'Annius', 'Petronius', 'Vettius'];
const COG_M = ['Rufus', 'Felix', 'Maximus', 'Severus', 'Crispus', 'Niger', 'Longinus', 'Paullus', 'Celer', 'Verus', 'Priscus', 'Vitalis', 'Lupus', 'Cotta', 'Sabinus', 'Fronto'];
const COG_F = ['Prisca', 'Secunda', 'Tertulla', 'Faustina', 'Lucilla', 'Marcella', 'Vitalis', 'Severa', 'Iusta', 'Procula'];
const fem = (nomen) => nomen.replace(/us$/, 'a');
const roman = (rng, f = false, nomen = null) => {
  const n = nomen || rng.pick(NOMEN);
  return f ? `${fem(n)} ${rng.pick(COG_F)}` : `${rng.pick(PRAE)} ${n} ${rng.pick(COG_M)}`;
};
// The trades of the dead, and who set up their stones.
const TRADES_M = ['a soldier of the legion', 'a centurion of the legion', 'a stonecutter', 'a baker', 'a physician', 'a lamp-maker', 'a freedman of the emperor\'s house', 'a scribe', 'a fossor, who dug these galleries'];
const TRADES_F = ['a freedwoman', 'a weaver', 'a midwife', 'a priestess of the hearth', 'a seller of purple'];
const BY = ['his wife set this up', 'her husband set this up', 'their children set this up', 'his comrades of the century set this up', 'her sister set this up', 'the guild of fossors set this up', 'nobody set this up; the fossors cut it themselves'];
const LINES = [
  'I was not; I was; I am not; I do not mind.',
  'Here I lie. You, who pass, may your earth lie light on you.',
  'Traveller, I was what you are. You will be what I am.',
  'She never gave me a moment\'s sorrow, but this one.',
  'The lamp is lit for you every year on the day you died.',
  'Do not grieve. It is done, and there is no more to fear.',
];
// Places the legion won its victories (and one near the town above).
const PLACES = ['the Frozen Ford', 'the Salt Marshes', 'the Nine Hills', 'the River Ostra', 'the Pass of Ravens', 'the White Cliffs', 'the Burning Fields', 'the Black Forest', 'the Shore of Ships'];
const FOES = ['the Hill-Clans', 'the Sea-Kings', 'the Ostrian host', 'the Horse-People', 'the Rebels of the Coast', 'the Wolf-Tribes'];
// What the busts look like (by their kind, as painted: see render/art/
// catacomb_tex.js), told as the stemma tells them.
export const BUST_LOOKS = [
  'old and bald and deep-lined, in marble',
  'cropped like a legionary, in his cuirass, in bronze',
  'with her hair piled high in rows of curls, in marble',
  'a boy with his curls all round his head, in bronze',
];
// The master's hall: what it is, and why it's here.
const MASTER = {
  last_emperor: ['the Last Emperor', 'He is still the emperor down here. He has never stopped being the emperor.'],
  bronze_wolf: ['the Bronze Wolf', 'The she-wolf of the founding, cast in bronze for his tomb, to suckle him in death as she suckled the first of his line. She has been given something to guard, and she guards it.'],
};
const MASTER_ANY = ['the Master of the Catacomb', 'Whatever keeps the legion in its ranks is at the bottom of it.'];

export function cataLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x6801));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x6802));
  const who = rec.origin?.who || 'the Emperor Aurelian';
  const town = rec.townName || 'the town above';
  const year = rec.origin?.y || 1100;
  const fault = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[fault];
  const legion = `the ${fixed.pick(ORD)} Legion, ${fixed.pick(EPITHET)}`;
  // Its victories, in order: one near the town above, the rest abroad.
  const places = fixed.shuffle(PLACES.slice()).slice(0, 3);
  places.splice(fixed.int(0, 2), 0, `the fields below ${town}`);
  const victories = places.map((p, i) => ({ where: p, foe: FOES[(i + fixed.int(0, FOES.length - 1)) % FOES.length], y: year - 30 + i * fixed.int(3, 7) }));
  // The house: four generations, each a bust (its kind: its look), in the
  // order of descent; the busts are set out in another.
  const nomen = fixed.pick(NOMEN);
  const order = fixed.shuffle([0, 1, 2, 3]);
  const house = order.map((kind, i) => ({
    kind,
    name: kind === 2 ? roman(fixed, true, nomen) : `${fixed.pick(PRAE)} ${nomen} ${fixed.pick(COG_M)}`,
    gen: i,
    look: BUST_LOOKS[kind],
  }));
  const [mName, mWhy] = (boss && MASTER[boss]) || MASTER_ANY;
  return {
    who, town, fault, legion, victories, house, master: mName,
    // The dedication over the gate: the emperor, the legion, the year.
    dedication() {
      return {
        title: 'The Dedication',
        lines: [
          'Cut over the gate in letters a hand high:',
          `TO THE SPIRITS OF THE DEAD. HERE LIES ${who.toUpperCase()}, IN THE ${year}TH YEAR, AND ROUND ABOUT HIM ${legion.toUpperCase()}, WHO SWORE TO KEEP HIM.`,
          `Below it, smaller, newer, scratched: "${cap(F.say)}."`,
        ],
      };
    },
    // An epitaph on a shelf-grave's slab: a name, a trade, an age to the
    // day, who set it up, and a line.
    epitaph() {
      const f = rng.chance(0.35);
      const age = f || rng.chance(0.7) ? rng.int(14, 70) : rng.int(2, 11);
      const trade = age < 12 ? 'a child' : f ? rng.pick(TRADES_F) : rng.pick(TRADES_M);
      return {
        title: 'An Epitaph',
        lines: [
          `D. M. To the spirits of the dead, and of ${roman(rng, f)}, ${trade}, who lived ${age} years, ${rng.int(0, 11)} months and ${rng.int(1, 29)} days. ${cap(rng.pick(BY))}.`,
          rng.pick(LINES),
        ],
      };
    },
    // The fossors' ledger: the guild's count of the dead laid down here,
    // year by year; and where it stops.
    ledger() {
      const yrs = [0, 1, 2, 3].map((k) => year - 3 + k);
      const counts = yrs.map((y, k) => (k === 2 ? rng.int(180, 600) : rng.int(12, 60)));
      return {
        title: 'The Fossors\' Ledger',
        lines: [
          'The gravediggers\' guild kept count of all it laid down here, year by year:',
          yrs.map((y, k) => `${y}: ${counts[k]}`).join('; ') + '.',
          `The last entry is the emperor's own, in a shaking hand: "Laid him down. ${cap(F.say)}. The guild will not come down again."`,
        ],
      };
    },
    // The relief of the Triumph: the victories, one by one.
    relief() {
      return {
        title: 'The Triumph',
        lines: [
          `The Triumph of ${who}, carved in marble: the legion with its eagle, the captives, the spoils, and the emperor in his chariot. Under each panel, a victory:`,
          victories.map((v) => `over ${v.foe} at ${v.where} (${v.y})`).join('; ') + '.',
          fault === 'triumph' ? 'The last panel is only roughed out. The sculptor stopped when the news came.' : 'The legion\'s eagle is picked out in gold leaf in every panel.',
        ],
      };
    },
    // The stemma: the house's tree painted on the wall, generation by
    // generation, each with the look of their bust.
    stemma() {
      return {
        title: `The House of ${nomen}`,
        lines: [
          `The family tree of the house of ${nomen}, painted on the plaster, each generation under the last:`,
          ...house.map((h, i) => `${['First', 'Then', 'Then', 'Last'][i]}, ${h.name}, ${h.look}.`),
          'Under it: HONOUR THEM IN THEIR ORDER, AND THE HOUSE WILL OPEN TO YOU.',
        ],
      };
    },
    // A tomb-robber's warning, scratched in the plaster by a broken grave.
    graffiti() {
      return {
        title: 'Scratched on the Wall',
        lines: [rng.pick([
          'Do not open the graves. Marcus opened the graves. Marcus is still here.',
          'The little lamps. Keep the little lamps lit. In the dark they go through you.',
          'The diggers do not mind you. Until you rob the graves. Then they mind.',
          'Three of us came down. I am writing this for the other two.',
          'Do not stand by the broken graves. Something reaches out.',
        ])],
      };
    },
    // The emperor's decree, cut at the foot of the tribunal.
    decree() {
      return {
        title: 'The Emperor\'s Decree',
        lines: [`Cut in the porphyry at the foot of the tribunal, under the eagle of ${legion}:`, `"${F.decree}"`, `Signed with the seal of ${who}.`],
      };
    },
    // A sarcophagus: who's in it.
    sarcophagus() {
      const f = rng.chance(0.4);
      return {
        title: 'A Sarcophagus',
        lines: [`Carved on its front between the rippling flutes, in a roundel, the face of ${roman(rng, f, nomen)}, ${f ? 'a lady' : 'a man'} of the emperor's house. ${rng.pick(['The face has been chiselled off.', 'The lid has been pushed aside a hand\'s width, from the inside.', 'Fresh flowers lie on it, and nobody has been down here in a hundred years.', 'Someone has scratched a name into the marble: the emperor\'s.'])}`],
      };
    },
    // The fossor's tools, left where he stopped.
    tools() {
      return {
        title: 'A Fossor\'s Tools',
        lines: [`A pick, a lamp, and a slab half cut: "${roman(rng)}, ${rng.pick(TRADES_M)}, who lived..." The digger stopped there. ${rng.pick(['The lamp is still warm.', 'The pick is worn to a stub.', 'His own name is scratched on the handle.'])}`],
      };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the bottom of the catacomb of ${who}.`, `Since ${F.say}, ${legion} has kept its post.`, mWhy],
      };
    },
    // (One line, as you come down a floor.)
    arrive() {
      return rng.pick([
        'Somewhere below, many feet step together, and stop.',
        'The lamps down here have been lit, and not long ago.',
        'Dust turns in the air, gold where the lamplight catches it.',
        'A trumpet sounds, very far off, and then nothing.',
      ]);
    },
  };
}
