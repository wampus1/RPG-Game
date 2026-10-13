// (Round 99) What's written in a Kavorent ruin, made from what the world
// knows of it. The Kavorent meant to leave their bodies: they lay down in
// pods in the cradle halls, and their minds went up the conduits into the
// Choir, to wait out the long count together. Every ruin is one Cadence of
// them (its own name, its founder, how many lie sleeping in it), and every
// one of them has gone wrong its own way (the count stalled, a sleeper
// woke, the blight got into the conduits, someone from above dug in, the
// Choir went quiet). The towns above remember it as something else. Its
// papers: the sleepers' plates, the wall of their names, the orrery's
// rings, the constructs' work logs, the warnings, a surface digger's
// scrawl, the one who woke, the well's glyphs, and the master's hall.
// Every ruin tells its own; the same ruin always tells the same.
import { RNG, hash4 } from '../../util/rng.js';
import { personName, placeName, CULTURES } from '../names.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const SYL = ['ith', 'vael', 'kor', 'ash', 'eth', 'ren', 'tal', 'or', 'syn', 'kav', 'ar', 'is', 'an', 'ul', 'om', 'ere', 'sa', 'thi', 'lu', 'ven', 'qa', 'dre'];
function kavName(rng, n = rng.int(2, 3)) {
  let s = '';
  for (let i = 0; i < n; i++) s += rng.pick(SYL);
  return cap(s);
}
const ORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Ninth', 'Eleventh', 'Last'];
// The four glyphs of the well (see deeps/kavorent.js: a glyph pillar's
// turn), and what they mean.
export const GLYPHS = ['the Spire', 'the Ring', 'the Sleeper', 'the Count'];
// What went wrong with it.
const FAULTS = {
  stalled: {
    say: 'the count has stalled',
    warn: 'THE COUNT HAS NOT MOVED IN [many] CYCLES. THE CHOIR IS WAITING. THE CHOIR IS WAITING.',
    log: 'Count checked. Count unchanged. Count checked. Count unchanged.',
  },
  woke: {
    say: 'one of the sleepers woke',
    warn: 'A SLEEPER HAS LEFT THE CHOIR. RETURN THE SLEEPER TO THE CRADLE. RETURN THE SLEEPER TO THE CRADLE.',
    log: 'Pod [pod]: open. Pod [pod]: open. Sleeper not found. Searching.',
  },
  blight: {
    say: 'the blight has got into the conduits',
    warn: 'FOREIGN GROWTH IN CONDUIT [pod]. THE SONG IS CHANGING. DO NOT LISTEN.',
    log: 'Conduit [pod] cleared of growth. Conduit [pod] cleared of growth. It grows back.',
  },
  dug: {
    say: 'people from above dug into it',
    warn: 'BREACH IN THE OUTER SHELL. UNKNOWN BODIES IN THE HALLS. THEY ARE SMALL. THEY ARE LOUD.',
    log: 'Breach sealed. Breach sealed. Unknown body removed to the reclaimers.',
  },
  quiet: {
    say: 'the Choir has gone quiet',
    warn: 'THE CHOIR IS SILENT. KEEP THE HALLS. KEEP THE HALLS. KEEP THE HALLS.',
    log: 'Listened for the Choir. Nothing. Kept the halls.',
  },
};
// What each master is, and why it's down there.
const MASTER = {
  overseer: ['the Overseer', 'The Overseer watches the Choir from the lowest hall, and counts. Each of its records is a little shorter than the one before.'],
  crucible: ['the Crucible', 'The Crucible was the furnace that made the constructs. It has run out of metal, and goes on making.'],
  condenser: ['the Condenser', 'The Condenser keeps the sleepers cold. It has kept them so cold for so long that it has forgotten there is anything else.'],
  prime: ['the Prime', 'The Prime, first and last of the guardians, was made to stand in the foundry till the count ends.'],
};
const MASTER_ANY = ['the Keeper', 'Something at the bottom keeps the count. Nothing has come back up to say what.'];
// What the towns above call it.
const CALLED = ['the humming hill', 'the singing stone', 'the cold mound', 'the Lantern Rock', 'the old spire', 'the bell under the ground'];
const HEARD = [
  'On still nights you can hear it humming through the ground.',
  'The dogs won\'t go near it. The children dare each other to.',
  'In hard winters the snow never lies on it.',
  'Shepherds say the stones are warm to sit on.',
  'Lights are seen there some nights, low down, moving in rings.',
];

export function kavLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x9a1));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x9a2));
  const style = rec.style && CULTURES[rec.style] ? rec.style : 'vale';
  const full = (p) => `${p.first}${p.last ? ` ${p.last}` : ''}`;
  const town = rec.townName || placeName(fixed, style);
  const cadence = `the ${fixed.pick(ORD)} Cadence of ${kavName(fixed)}`;
  const founder = kavName(fixed, 3);
  const sleepers = fixed.int(900, 9800);
  const faultKey = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[faultKey];
  const called = fixed.pick(CALLED);
  const [mName, mWhy] = MASTER[boss] || MASTER_ANY;
  const pod = () => rng.int(1, sleepers).toLocaleString('en');
  const fill = (s) => s.replace(/\[pod\]/g, pod).replace(/\[many\]/g, () => rng.int(400, 90000).toLocaleString('en'));
  const sleeper = () => kavName(rng, rng.int(2, 3));
  return {
    cadence,
    fault: faultKey,
    town,
    called,
    master: mName,
    // A sleeper's plate, on the foot of their pod.
    plate() {
      const who = sleeper();
      return {
        title: 'A Sleeper\'s Plate',
        lines: [
          `${who}, of ${cadence}. Sleeper ${pod()} of ${sleepers.toLocaleString('en')}.`,
          rng.pick([`Lay down in the ${rng.int(2, 40)}th year of the count.`, 'Lay down on the first night, with the founder.', 'Lay down last of their house.']),
          rng.pick(['"We go up together."', '"Wake me when it is sung."', '"I will hear you in the Choir."', '"Keep my place."']),
          rng.chance(0.3) ? '(Behind the frost, the face is calm. The lips are moving.)' : '(Behind the frost, the face is calm.)',
        ],
      };
    },
    // The one that woke: cracked from inside.
    woke() {
      return {
        title: 'A Broken Pod',
        lines: [
          'The glass is cracked from the inside. Scratched into the frost on it, over and over:',
          rng.pick(['"IT IS NOT A SONG"', '"THERE IS NO ONE IN THE CHOIR"', '"LET ME DOWN"', '"THE COUNT IS GOING UP"']),
          `The plate says ${sleeper()}. The pod is empty.`,
        ],
      };
    },
    // The wall of the names.
    names() {
      const ns = Array.from({ length: 6 }, sleeper);
      return {
        title: 'The Names',
        lines: [`${ns.join(', ')}...`, `...and on, and on: ${sleepers.toLocaleString('en')} names, in rows of light.`, `Above them, larger: ${founder}, who led ${cadence} up. "We go up together."`],
      };
    },
    // The orrery's rings.
    orrery() {
      return {
        title: 'The Orrery',
        lines: [
          'Rings within rings round a model of the spire: the inmost is marked with sleepers, the next with the count, the outmost with something like stars.',
          rng.pick(['The inmost ring has stopped. The others go on round it.', 'One of the worlds on the outer ring is missing. Its arm swings empty.', 'The rings turn backwards, now and then, and then go on.']),
          `A plaque: "${cadence}. When the rings align, the count is done."`,
        ],
      };
    },
    // A construct's work log, on a repair bay's console.
    worklog() {
      const unit = `${rng.pick(['Mender', 'Warden', 'Reclaimer', 'Archivist'])}-unit ${rng.int(2, 999)}`;
      return { title: 'A Work Log', lines: [`${unit}, cycle ${pod()}:`, fill(F.log), fill(F.log), rng.pick(['Awaiting instruction.', 'No instruction received.', 'Continuing.'])] };
    },
    // A warning glyph, translated (badly) by whoever reads it.
    warning() {
      return { title: 'A Warning', lines: ['The screen pulses red, and the glyphs on it come out something like:', fill(F.warn)] };
    },
    // A digger from above, who got this far.
    visitor() {
      const who = full(personName(rng, style));
      return {
        title: 'Scratched in the Alloy',
        lines: [
          `${who} of ${town} was here. They call this place ${called} up top. ${rng.pick(HEARD)}`,
          rng.pick(['We dug in to find the sound. We found it.', 'Took what we could carry. The metal men took it back.', 'Jory went on alone. Jory has not come back.']),
          rng.pick(['Don\'t go down.', 'Don\'t listen to it.', 'If you find Jory tell him we waited.']),
        ],
      };
    },
    // The memory well's console: which glyph each pillar must show (lit by
    // the archivist, or by its passing).
    well(want) {
      return {
        title: 'The Memory Well',
        lines: [
          'Three glyphs, glowing in a row, the way the pillars stand from left to right:',
          want.map((g) => cap(GLYPHS[g])).join(', then '),
          '"Sing the three, and the well will give back what it keeps."',
        ],
      };
    },
    // The master's hall.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here ${cadence} went up into the Choir, ${sleepers.toLocaleString('en')} of them, led by ${founder}.`, `Since then ${F.say}.`, mWhy],
      };
    },
    // What the ruin's floors are said to have been for, said on arrival.
    arrive() {
      return `${cap(cadence)}. ${cap(F.say)}.`;
    },
  };
}
