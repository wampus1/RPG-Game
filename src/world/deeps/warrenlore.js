// (Round 107) What's written in a Deep Warren, and what's left there, made
// from what the world knows of it. Everyone on Hollowmark knows the story:
// the folk of the town dug into a burrow far older than any of theirs, dug
// by something (its `who`: the First Digger, the Old Mole, the Root-King,
// the Deep Sleeper, the Lantern Mother), and stopped it up again in a
// hurry. Underneath: the delve that did the digging (the family of it,
// their delve-master and their children, their lamplighter), the Moot that
// sent them down, and what went wrong (they broke through into the round
// tunnels; the lamps went out one by one; the floor of the Moot gave way;
// the Moot voted to dig on for the glow-seeds; they heard digging under
// them and dug toward it). Its papers: the family's diary (and where the
// good jam is kept), the moot-book, the larder tally, the lamplighter's
// rounds, a recipe, a child's drawing, a letter, a prayer, the dead, the
// old bones, what's scratched in the stopped-up cell, and the master's
// hall. Every warren tells its own; the same one always tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const FAULTS = {
  broke: {
    say: 'they broke through into the round tunnels',
    why: 'The spade went through the back of the new larder into nothing. The hole was perfectly round, and it went down, and something had kept it swept.',
  },
  dark: {
    say: 'the lamps went out, one by one',
    why: 'The moths came up out of the old tunnels, great dun things, and settled on the pods, and the pods went dark under them. In the dark, the diggers came.',
  },
  floor: {
    say: 'the floor of the Moot gave way',
    why: 'In the middle of the Lantern Night the floor of the Moot-hall went out from under the speaking-stone. Underneath was another hall, much older, and it was not empty.',
  },
  deeper: {
    say: 'the Moot voted to dig on for the glow-seeds',
    why: 'The lantern trees up top were failing. The old diggers had glow-seeds, the stories said, down deep. The Moot voted to go and get them. It was a close vote.',
  },
  digging: {
    say: 'they heard digging under them, and dug toward it',
    why: 'Night after night, under the floors, something digging. The delve-master said it was only water, then only roots. Then he took a spade and went down to see.',
  },
};
const FIRST = ['Bramble', 'Clover', 'Dimble', 'Fennel', 'Glimmer', 'Hazel', 'Juniper', 'Lumpkin', 'Nettle', 'Pip', 'Rootle', 'Sorrel', 'Thistle', 'Wick', 'Acorn', 'Burdock', 'Dewberry', 'Fidget', 'Hob', 'Mallow', 'Puddle', 'Tansy', 'Cobble', 'Kettle', 'Loam', 'Marigold'];
const LAST_PRE = ['Under', 'Deep', 'Dim', 'Glow', 'Moss', 'Root', 'Lamp', 'Mud', 'Burrow', 'Fern'];
const LAST_SUF = ['hill', 'bottom', 'foot', 'warren', 'dig', 'lamp', 'wick', 'den', 'root'];
const JOBS = ['the delve-master', 'the lamplighter', 'the root-tender', 'the cook', 'the eldest', 'the youngest', 'the moth-keeper', 'the spade-hand'];
const MASTER = {
  first_digger: ['the First Digger', 'The tunnelers\' first mother, older than the island\'s trees. It dug the round tunnels when there was nothing on Hollowmark to dig them for, and it has been digging them ever since.'],
  thing_below: ['the Thing Below', 'What everything down here was digging away from. The lantern trees up top are its children: their pods are its lures, grown tame. It has been calling them home.'],
};
const MASTER_ANY = ['the Master of the Warren', 'Whatever dug the round tunnels is at the bottom of them.'];

export function warrenLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x6c01));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x6c02));
  const who = rec.origin?.who || 'the First Digger';
  const town = rec.townName || 'the town above';
  const year = rec.origin?.y || 1200;
  const fault = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[fault];
  const family = `${fixed.pick(LAST_PRE)}${fixed.pick(LAST_SUF)}`;
  const kin = fixed.shuffle(JOBS.slice()).slice(0, 5).map((job) => ({ job, name: `${fixed.pick(FIRST)} ${family}` }));
  const head = kin.find((q) => q.job === 'the delve-master') || kin[0];
  const lamp = kin.find((q) => q.job === 'the lamplighter') || kin[1];
  const [mName, mWhy] = (boss && MASTER[boss]) || MASTER_ANY;
  const one = () => rng.pick(kin);
  return {
    who, town, year, fault, family, kin, master: mName,
    // The family's diary, on its stand in the delve: the days, and where
    // the good jam's kept.
    diary() {
      const day = rng.int(2, 30);
      return {
        title: `The ${family}s' Diary`,
        lines: [
          `Day ${day} of the new delve under ${town}. ${rng.pick(['Dug the new larder. Lovely dry loam.', 'The little ones have found a tunnel too round to be ours.', 'Lamps keep going out. Moths.', `${head.name.split(' ')[0]} says the knocking under the floor is only water.`])}`,
          rng.pick([
            'The good jam is behind the dresser, in the little cupboard, where the children can\'t get at it. (Push the dresser along.)',
            'Moved the dresser across the pantry door again. Nobody is to touch the bramble jam till the Lantern Night.',
            'If anyone wants the best of the larder, it\'s in the hidey-hole behind the dresser, same as always.',
          ]),
        ],
      };
    },
    // The moot-book: the minutes of the Warren-Moot.
    moot() {
      const ayes = rng.int(9, 20);
      return {
        title: 'The Moot-Book',
        lines: [
          `Moot of ${town}, the year ${year - fixed.int(1, 9)}. In the chair: ${head.name}.`,
          `Moved: ${rng.pick(['that the delve be dug on, down, for the glow-seeds', 'that the old round tunnel be stopped up, and quickly', 'that no one dig below the larder floor', 'that the lamplighter be given more oil'])}. Ayes ${ayes}, noes ${ayes + rng.int(-3, 3)}.`,
          rng.pick(['Carried.', 'Carried, narrowly. Words were had.', 'The chair\'s vote carried it.']),
        ],
      };
    },
    // Scratched on a cask in the larder.
    larder() {
      return {
        title: 'Scratched on a Cask',
        lines: [rng.pick([
          'Ale: 9 casks. Hams: 12. Turnips: all eaten. Grubs in the turnips again.',
          'Don\'t leave the grubs in the bins. The diggers come for them. (They come for the grubs and then they stay.)',
          `This cask is ${rng.pick(['Fennel', 'Hob', 'Puddle'])}'s and no one else's.`,
        ])],
      };
    },
    // The lamplighter's rounds.
    rounds() {
      return {
        title: 'The Lamplighter\'s Rounds',
        lines: [
          `${lamp.name}. Pods to see to: ${rng.int(14, 40)}.`,
          rng.pick([
            'A pod that\'s gone dark isn\'t dead: rub it, gently, and it\'ll glow again.',
            'Moths on the pods by the old tunnel again. Brushed them off. They came back.',
            'Do not let the pods go dark near the round tunnel. The diggers can\'t see, and they don\'t need to.',
          ]),
        ],
      };
    },
    // A recipe, in the larder.
    recipe() {
      return {
        title: 'Cave-Root Stew',
        lines: ['Three roots, a turnip, a handful of glowcaps (not the blue ones). Mushroom ale to cover. Simmer till the lamps want trimming.', rng.pick(['Feeds a delve.', 'Better the next day.', `${cap(rng.pick(FIRST))} likes it with a crust on.`])],
      };
    },
    // A child's drawing, by the bed.
    drawing() {
      const c = kin.find((q) => q.job === 'the youngest') || one();
      return {
        title: 'A Drawing',
        lines: [`Drawn in charcoal by ${c.name.split(' ')[0]}: ${rng.pick(['a mole, huge, with a star of fingers on its nose, and the delve tiny under it', 'a door with eyes behind it', 'the whole family in a row, and under the floor, something round and smiling'])}. Underneath: "${rng.pick(['THE BIG ONE', 'IT LISSENS', 'GOODNIGHT'])}".`],
      };
    },
    // A letter home, never sent.
    letter() {
      const c = one();
      return {
        title: 'A Letter',
        lines: [
          `"To ${rng.pick(['Gran', 'my brother', 'the Lantern Council'])}, at ${town}.`,
          rng.pick([
            'The new delve is lovely, dry as a nut, but we\'ve found a tunnel that isn\'t anybody\'s. It\'s round as a pipe and the walls are scraped in rings.',
            'Walk soft on the boards. That\'s what we say down here now. Walk soft.',
            'Don\'t send the little ones down for the Lantern Night after all.',
          ]),
          `${c.name.split(' ')[0]}, ${c.job}."`,
        ],
      };
    },
    // A prayer to the Lantern Mother, scratched by the dead.
    prayer() {
      return {
        title: 'A Prayer',
        lines: [rng.pick([
          'Lantern Mother, keep the pods lit. Keep the pods lit. Keep the pods lit.',
          'Old Mole, we only borrowed the earth. Let us give it back.',
          'Glow in the Dark, show us the way up.',
        ])],
      };
    },
    // One of the delvers, dead.
    dead() {
      const c = one();
      return {
        title: 'A Delver',
        lines: [`${c.name}, ${c.job}, sat down against the earth here, a dead lantern in their lap. ${rng.pick(['Their feet are bare: they took their boots off to walk soft.', 'There is earth under every fingernail.', 'Their spade is broken in two.'])}`],
      };
    },
    // The old bones.
    bones() {
      return {
        title: 'Old Bones',
        lines: [`A claw, as long as a ${rng.pick(['Hollowfolk is tall', 'spade', 'door is high'])}, and a rib that would make a roof-beam. Whatever it was, it dug these tunnels; ${who === 'the First Digger' ? 'and there were bigger.' : `the old stories call it ${who}.`}`],
      };
    },
    // (What went wrong, told: scratched in the stopped-up cell.)
    story() {
      return { title: 'Scratched in the Old Cell', lines: [`The year ${F.say}.`, F.why, `We stopped it up behind us. ${head.name}.`] };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the bottom of the round tunnels ${who === 'the First Digger' ? '' : `of ${who} `}under ${town}.`.replace('  ', ' '), `Since ${F.say}, none of the ${family}s has come up.`, mWhy],
      };
    },
    // (One line, as you come down.)
    arrive() {
      return rng.pick([
        'Warm lamplight, and the smell of supper long gone cold.',
        'Somewhere under your feet, very slowly, something is digging.',
        'The tunnels here are round as pipes, and someone swept them.',
        'Walk soft. The boards creak.',
      ]);
    },
  };
}
