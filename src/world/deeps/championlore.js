// (Round 111) What's written in the Hall of the Last Champion, and what's
// left there, made from what the world knows of it. Everyone in Velmarch
// knows the story: its Champion (its `who`: the Last Champion, the Hero of
// the Nine Wars, the Unbroken, the Saviour of Velmarch) saved the world
// three times, and the fourth time the thing he fought cursed him as it
// died; his companions sealed him in his own barrow while he could still
// beg them to, and the town still lays flowers at the door. Underneath:
// his name, the thing he killed, his companions (the huntress, the priest,
// the shield-bearer, the squire), the battles of his wars (named for the
// country round about), the order of his oath (the kneeling-stones open
// the oath-door to it: see game/championwork.js), and the stage the floor
// is at (the Hall of Honours, the Hall of Trials, the Sealed Barrow).
// Every Hall tells its own; the same one always tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// His virtues, as the kneeling-stones have them (their turn: see
// render/art/champion_tex.js).
export const VIRTUES = [
  { key: 'valour', name: 'Valour', sign: 'a sword', line: 'that I will stand where others run' },
  { key: 'mercy', name: 'Mercy', sign: 'an open hand', line: 'that I will spare whoever asks it of me, even my enemy' },
  { key: 'faith', name: 'Faith', sign: 'the sun', line: 'that I will keep faith with those who keep it with me' },
  { key: 'honour', name: 'Honour', sign: 'a laurel', line: 'that I will take no glory that is not mine' },
];
// The floors: what each was.
export const STAGES = [
  { key: 'honours', name: 'the Hall of Honours', what: 'where the folk came to remember him, before they were afraid to' },
  { key: 'trials', name: 'the Hall of Trials', what: 'where his companions made their last stand, to hold him in' },
  { key: 'barrow', name: 'the Sealed Barrow', what: 'where they sealed him, and where the curse is' },
];
// What he killed, the fourth time; and what it left in him.
const BANES = [
  { name: 'the Wyrm of the Ashen Fells', did: 'its blood ran into his wounds', mark: 'wings' },
  { name: 'the Hollow King', did: 'it spoke a word, and he heard it', mark: 'a mouth' },
  { name: 'the Many-Eyed Thing under the hills', did: 'it looked at him with all its eyes', mark: 'eyes' },
  { name: 'the Mother of the Deep', did: 'it took hold of him, and would not let go', mark: 'arms that are not arms' },
];
const HERO_NAMES = ['Aldric', 'Corvan', 'Edrin', 'Halvard', 'Osric', 'Theodred', 'Varel', 'Brandt'];
const HUNTRESS = ['Isolde', 'Wren', 'Maelis', 'Keira', 'Ysolt', 'Brannagh'];
const PRIEST = ['Brother Anselm', 'Brother Odo', 'Mother Hesk', 'Sister Ailith', 'Father Gerent'];
const SHIELD = ['Big Torvald', 'Old Cuthred', 'Hroth the Wall', 'Gunnhild Ironside', 'Ottmar'];
const SQUIRE = ['Pip', 'young Tobin', 'Hal', 'Merrin', 'little Ned'];
const FIELDS = ['the Fords of', 'the Siege of', 'the Burning of', 'the Field of', 'the Bridge at', 'the Long Night at'];
const PLACES = ['Ashmoor', 'Calden Hill', 'the Greymarch', 'Dunholt', 'Saltgate', 'Red Ness', 'Wyrmsby', 'the Coldwater'];

export function championLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x7101));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x7102));
  const who = rec.origin?.who || 'the Last Champion';
  const town = rec.townName || 'the villages';
  const year = rec.origin?.y || 600;
  const hero = fixed.pick(HERO_NAMES);
  const bane = fixed.pick(BANES);
  const huntress = fixed.pick(HUNTRESS);
  const priest = fixed.pick(PRIEST);
  const shield = fixed.pick(SHIELD);
  const squire = fixed.pick(SQUIRE);
  // (The order of his oath: the kneeling-stones, knelt at in it, open the
  // oath-door. The same through the whole Hall.)
  const oath = fixed.shuffle([0, 1, 2, 3]);
  const battles = fixed.shuffle([...PLACES]).slice(0, 5).map((p, i) => `${FIELDS[(i + fixed.int(0, 5)) % FIELDS.length]} ${i === 0 ? town : p}`);
  const stage = STAGES[Math.min(n, STAGES.length - 1)];
  return {
    who, town, year, hero, bane: bane.name, huntress, priest, shield, squire, oath, battles, stage: stage.key,
    // His oath, in its order, in the book.
    oathBook() {
      return {
        title: `The Oath of ${hero}`,
        lines: [
          ...oath.map((v, i) => `${['First', 'Then', 'Then', 'And last'][i]}, ${VIRTUES[v].name}: ${VIRTUES[v].line}.`),
          `(Kneel to them as he swore them, and the door of his oath will know you.)`,
        ],
      };
    },
    // The names of the fallen, on a plaque.
    plaque() {
      const b = rng.pick(battles);
      return {
        title: `The Fallen of ${b}`,
        lines: [`${rng.pick(['Aelric', 'Bryn', 'Cade', 'Dunstan', 'Elfa', 'Garm'])}, ${rng.pick(['Ivo', 'Jory', 'Kenrick', 'Leof'])}, ${rng.pick(['Mab', 'Noll', 'Osgar', 'Penda'])}, and ${rng.int(12, 90)} more.`, `${rng.pick(['They held.', 'He carried the wounded out himself, two at a time.', 'He wept for every one.'])}`],
      };
    },
    // The squire's diary.
    diary() {
      return {
        title: `The Diary of ${cap(squire)}, His Squire`,
        lines: [
          rng.pick([`He let me hold the sword today. It is heavier than me.`, `He knows every one of our names. Even the cook's boy.`, `He laughed when I fell in the river, and then he jumped in after me.`]),
          rng.pick([`He has not slept since ${bane.name}. He says it is nothing.`, `Something moved under his skin tonight. I saw it. He saw me see it.`, `He asked me to promise something. I said yes before I knew what.`]),
        ],
      };
    },
    // A companion's last letter.
    letter() {
      const [nm, role] = rng.pick([[huntress, 'his huntress'], [priest, 'his priest'], [shield, 'his shield-bearer']]);
      return {
        title: 'A Letter, Left in the Hall',
        lines: [
          `"${rng.pick(['We did what he asked.', 'He begged us. He was still himself enough to beg.', 'He held the door from the inside while we sealed it.'])} ${rng.pick(['May the gods forgive us, because he did.', 'He thanked us. He THANKED us.', 'I will come back. I will find a way.'])}"`,
          `"${nm}, ${role}."`,
        ],
      };
    },
    // Carved in the long table.
    toast() {
      return {
        title: 'Cut in the Long Table',
        lines: [rng.pick([`To ${hero}, who never once paid for his own ale!`, `${huntress} won this table off ${shield} at dice. Fairly. Mostly.`, `Here the Company sat after ${rng.pick(battles)}, and sang till dawn.`])],
      };
    },
    // The priest's account of the curse.
    curse() {
      return {
        title: `${cap(priest)}'s Account`,
        lines: [
          `As ${bane.name} died, ${bane.did}. On the third day it showed in him: ${bane.mark}, where there should be none, gone again by morning.`,
          rng.pick(['It came more often. It stayed longer. He prayed with me every night, and every night it was harder for him to remember the words.', 'He made us swear to seal him in while he was still himself enough to want it.']),
        ],
      };
    },
    // A note on a fallen man-at-arms of the last stand.
    fallen() {
      return {
        title: 'Clutched in a Dead Man\'s Hand',
        lines: [rng.pick([
          `"Hold the line. Whatever comes through that door, it isn't him any more."`,
          `"Tell my wife I stood with the Company to the end."`,
          `"${shield} says the wards will hold. ${shield} has never once been wrong about a wall."`,
          `"He came to the barricade and asked us, so politely, to let him through. Then his face changed."`,
          `"${huntress} is up on the gallery with the last of the arrows. If she falls back, we all fall back."`,
          `"Three days. No sleep. I can hear him singing the old marching songs behind the door, the way he used to."`,
          `"If anyone reads this: ${squire} got out. The boy got out. Good."`,
        ])],
      };
    },
    // The rite of the wards.
    wards() {
      return {
        title: 'The Rite of the Wards',
        lines: [`Where a ward cracks, the curse comes through. Kneel at it and hold it, and say the words, and it will close again; but what's come through will not want it closed.`, `(${cap(priest)}.)`],
      };
    },
    // On a memorial stone: a name, and what they did.
    memorial() {
      return {
        title: 'Cut in the Memorial',
        lines: [`${rng.pick(['Aelfric', 'Bertha', 'Cenric', 'Dagny', 'Eadwin', 'Frida', 'Godric', 'Hild'])} of ${rng.pick([town, 'Dunholt', 'Calden'])}, who fell at ${rng.pick(battles)}.`, rng.pick(['Remembered.', 'Laid here by the Champion\'s own hands.', 'The folk leave flowers still.'])],
      };
    },
    // The battles of his wars, on the frieze's plaque.
    wars() {
      return { title: 'The Nine Wars', lines: [`${battles.slice(0, 4).map(cap).join('. ')}.`, `And last, ${bane.name}, in ${year}.`] };
    },
    // (What went wrong, told: by the oath-door's cache.)
    story() {
      return {
        title: 'The Last Page of the Company\'s Book',
        lines: [`In ${year} ${hero} killed ${bane.name}, and as it died, ${bane.did}.`, `We sealed him in, ${huntress} and ${priest} and ${shield} and ${squire}. He asked us to. Gods forgive us, we said yes.`],
      };
    },
    // The hall of the master.
    last() {
      return {
        title: `The Barrow of ${hero}`,
        lines: [`Here lies ${hero}, ${who}, who saved the world three times.`, `The fourth time, ${bane.name} won.`, 'If you can, end it for him. He asked.'],
      };
    },
    // The stage this floor is at.
    hall() {
      return { title: cap(stage.name), lines: [`${cap(stage.name)}: ${stage.what}.`] };
    },
    // (One line, as you come down.)
    arrive() {
      return rng.pick([
        `${cap(stage.name)}. The air smells of old candles and something underneath.`,
        'Somewhere below, something that was a man is weeping.',
        `Flowers at the door, fresh: someone from ${town} still comes.`,
        'The banners stir, though there is no wind.',
      ]);
    },
  };
}
