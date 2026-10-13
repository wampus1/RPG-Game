// (Round 101) What's written in a Kiln-Deep, and what's left there, made
// from what the world knows of it. Everyone on Kharos knows the story: the
// Kiln-Kings dug their great forge into the mountain, and at the last one
// of them (its `who`: the Kiln-King Azkar, the Smith-Queen Pyrrha, Old
// Tephros the Founder, the Bellows-Lord Kharn) sealed it with the smiths
// still inside, so no lesser hand would ever work its fires; and the town
// above still hears the hammers. Underneath: the forge-song the anvils were
// rung to at every firing; the guild and its roll; the tally of the days
// the sealed smiths kept; the Great Work they were set to and never
// finished; the quench-law; a smith's last letter home; and the master's
// hall. Every deep tells its own; the same deep always tells the same.
import { RNG, hash4 } from '../../util/rng.js';
import { personName, CULTURES } from '../names.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// The three notes of the forge-song, by the strokes cut in each singing
// anvil's band (see render/art/forge_tex: one, two or three).
export const NOTES = ['one stroke', 'two strokes', 'three strokes'];
// What went wrong (seeded): how the sealing went, and what came after.
const FAULTS = {
  sealing: { say: 'the doors were sealed on the smiths', why: 'They were sealed in so no lesser hand would work these fires. They kept working.' },
  revolt: { say: 'the smiths rose against the sealing', why: 'They rose against the sealing, and broke their hammers on the doors. Then they went back to the anvils, because there was nothing else.' },
  melt: { say: 'the great melt ran wild', why: 'The last great melt ran out of the channels and through the halls, and the forge has burned ever since.' },
  heart: { say: 'the mountain\'s heart was chained to the fires', why: 'They chained the mountain\'s own heart under the forge to fire it, and it has never stopped beating.' },
  work: { say: 'the Great Work was cursed', why: 'The Great Work would not finish. Every night it was undone, and every day they began again.' },
};
// The Great Work: what they were set to make, and never finished.
const WORKS = {
  crown: { name: 'a crown for the Kiln-King', piece: 'its circlet, gold, the fire-stone still unset' },
  blade: { name: 'a blade to cut the mountain', piece: 'its blade, long as a man, never ground' },
  bell: { name: 'a bell to be heard in every town of Kharos', piece: 'its bell, cast twice and cracked twice' },
  gate: { name: 'a gate no army could break', piece: 'one of its hinges, the size of a cart' },
  man: { name: 'a man of iron to rule after the king', piece: 'its hand, an iron gauntlet as big as a child' },
};
const RANKS = ['apprentice', 'journeyman', 'master', 'forgemaster'];
// The quench-law, on the quench hall's wall: four of these to a deep.
const LAWS = [
  'Quench in oil for the blade, in brine for the axe, in water for nothing that matters.',
  'Never quench a hot piece near cold iron. It remembers.',
  'Speak to the steel while it cools. It listens then and only then.',
  'The steam is the metal\'s breath. Do not stand in it.',
  'Iron is soft hot and brittle cold-shocked. So are men.',
  'No hand but the master\'s on the master\'s tongs.',
];
// Who the sealed smiths wrote to, above.
const KIN = ['my wife', 'my husband', 'my mother', 'my daughter', 'my brother', 'my sweetheart', 'the baker\'s girl', 'my old master'];
// The master's hall: what it is, and why it's here.
const MASTER = {
  kiln_king: ['the Kiln-King', 'The king who sealed the forge came down himself at the last, to finish the Great Work with his own hands. He is still at his anvil.'],
  slag_titan: ['the Slag Titan', 'Poured out of the slag of the last great melt: everything the forge ever threw away, risen up and walking.'],
  molten_heart: ['the Molten Heart', 'The mountain\'s own heart, chained in the deepest hall to fire the forge. It beats, and the whole Kiln-Deep shakes with it.'],
};
const MASTER_ANY = ['the Master of the Forge', 'Whatever keeps the fires lit is at the bottom of it. Nobody has come back up to say what.'];

export function forgeLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0xf01));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0xf02));
  const style = rec.style && CULTURES[rec.style] ? rec.style : 'ember';
  const name = (r) => {
    const p = personName(r, CULTURES[style] ? style : undefined);
    return `${p.first}${p.last ? ` ${p.last}` : ''}`;
  };
  const town = rec.townName || 'the town';
  const who = (rec.origin && rec.origin.who) || 'the Kiln-King Azkar';
  const year = (rec.origin && rec.origin.y) || null;
  const faultKey = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[faultKey];
  const workKey = fixed.pick(Object.keys(WORKS));
  const W = WORKS[workKey];
  // The forge-song: its three notes, in their order (the same on every
  // floor of the deep: it's the forge's own).
  const song = fixed.shuffle([0, 1, 2]);
  // The guild: a dozen smiths by name and rank (the same on every floor).
  const guild = [];
  for (let i = 0; i < 12; i++) guild.push({ name: name(fixed), rank: RANKS[Math.min(3, Math.floor(fixed.float(0, 1) ** 1.6 * 4))] });
  const days = fixed.int(800, 4200);
  const [mName, mWhy] = MASTER[boss] || MASTER_ANY;
  return {
    who,
    fault: faultKey,
    workKey,
    town,
    song,
    master: mName,
    // A Kiln-King in stone at the way in: the sealing.
    sealing() {
      return {
        title: 'The Sealing',
        lines: [
          `Cut in the plinth under the king's feet: BY THE WORD OF ${who.toUpperCase()}${year ? `, IN ${year}` : ''}, THIS FORGE IS SEALED, AND ITS FIRES WITH IT. NO LESSER HAND.`,
          `Under it, smaller, a later hand: "and us with them".`,
          `${town} still hears the hammers on still nights.`,
        ],
      };
    },
    // The forge-song, on a plaque by the singing anvils.
    songPlaque() {
      return {
        title: 'The Forge-Song',
        lines: [
          'At every firing the forge was sung awake on its three great anvils, the same three notes in the same order since the founding.',
          `Sing it as we sang it: ${song.map((k) => `the anvil of ${NOTES[k]}`).join(', then ')}.`,
          'The guild-door opens to the song and to no other.',
        ],
      };
    },
    // The tally: the days since the sealing.
    tally() {
      return {
        title: 'The Tally',
        lines: [
          `Scratched in fives across the stone, by many hands, wall after wall: ${days.toLocaleString('en')} days since ${F.say}.`,
          rng.pick(['The last rows are shallow and crooked, like the hand could hardly hold the nail.', 'The last mark is only half made.', 'After the last five, someone has scratched: "WHY DO WE STILL COUNT".', 'The marks go on long after any of them could have been alive to make them.']),
        ],
      };
    },
    // The guild-roll: the smiths by name and rank, some struck out.
    roll() {
      const shown = rng.shuffle(guild.slice()).slice(0, 5);
      return {
        title: 'The Guild-Roll',
        lines: [
          `A bronze plate, green at its edges: the Guild of ${who}'s Forge, its smiths by name.`,
          ...shown.map((g, i) => `${cap(g.rank)} ${g.name}${i === 1 ? ' (struck through)' : i === 3 && rng.chance(0.5) ? ' (a hammer scratched beside the name)' : ''}`),
        ],
      };
    },
    // The quench-law, on the quench hall's wall.
    quench() {
      return { title: 'The Quench-Law', lines: ['Cut in bronze over the troughs:', ...rng.shuffle(LAWS.slice()).slice(0, 4)] };
    },
    // A smith's last letter home, never sent.
    letter() {
      const g = rng.pick(guild);
      return {
        title: 'A Letter Never Sent',
        lines: [
          `To ${rng.pick(KIN)}, in ${town}. From ${g.name}, ${g.rank} of the forge.`,
          rng.pick([
            'They have shut the doors. They say it is an honour. The fires are hotter than they have ever been and nobody will say why.',
            'We are still working. I do not know what else to do. The work is all there is down here.',
            'If you hear the hammers, that is me. I am still here. Leave the lamp in the window.',
            'The Great Work will not finish. Every morning it is undone. Some of the others have stopped eating. I have not stopped working.',
          ]),
          rng.pick(['It is signed, and under the name, a little drawing of an anvil.', 'The last line is smudged with ash, as if a thumb pressed it.', 'It was never folded. It has been read many times.']),
        ],
      };
    },
    // The Great Work, its pieces on their plinths in the king's gallery.
    work() {
      return {
        title: 'The Great Work',
        lines: [
          `The last commission of ${who}: ${W.name}.`,
          `On the plinth, ${W.piece}.`,
          F.why,
        ],
      };
    },
    // A masterwork on a plinth: one of the guild's, before the sealing.
    masterwork() {
      const g = rng.pick(guild);
      return {
        title: 'A Masterwork',
        lines: [`The piece that made ${g.name} a master, kept here in the king's gallery.`, rng.pick(['Not a mark on it. Not a flaw.', 'The maker\'s mark on it is a little hammer and a star.', 'Somebody has polished it, recently.'])],
      };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the heart of the forge of ${who}.`, `Since ${F.say}, the fires here have never gone out.`, mWhy],
      };
    },
    // What's said on coming in.
    arrive() {
      return n === 0 ? `The Kiln-Deep of ${who}. The heat comes up the stair to meet you, and somewhere below, a hammer is ringing.` : rng.pick(['Deeper, the heat is a weight on you.', 'The ringing of the hammers is louder here.', 'The air shakes over the floor like water.']);
    },
  };
}
