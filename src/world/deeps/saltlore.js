// (Round 106) What's written in a Salt Cathedral, and what's left there,
// made from what the world knows of it. Everyone on Saltmere knows the
// story: the old workings were dug so deep in the service of the Salt
// Mother (its `who`: the Salt Mother, the First Rakers, Doge Kostas, the
// Brine-Keeper, the White Sisters) that they became a church, and the brine
// came up through the floor of it, and the salt of the town above has
// tasted of tears ever since. Underneath: the brotherhood that worked it
// (its rake-master, its miners by name and by trade, the chapel they
// carved and the saint it's for), the Doge's Salt Office and its quota,
// and what went wrong (they dug through into the old sea; the rake-master
// heard her singing and would not stop; the Salt Office doubled the quota
// and they cut out the pillars; they walled up the sick in a chapel; the
// salt sang, and they followed it down). Its papers: the miners' hymn on
// the altar, the tally-book (where the bricked chapel is), the Salt
// Office's decree, the brine-reeve's notes (the treadwheel and the
// sluice), a votive, a letter, the words cut under the Mother, a prayer,
// the dead, and the master's hall. Every cathedral tells its own; the same
// one always tells the same.
import { RNG, hash4 } from '../../util/rng.js';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const FAULTS = {
  brine: {
    say: 'they dug through into the old sea',
    why: 'Under the last chapel the pick went through into nothing, and the nothing was brine, under a weight of rock, and it came up.',
  },
  devotion: {
    say: 'the rake-master heard her singing',
    why: 'He said the Mother was in the salt below, singing, and that she wanted out. He dug toward her for nine years. The rest of them dug with him.',
  },
  quota: {
    say: 'the Salt Office doubled the quota',
    why: 'There was no more salt to cut but the pillars that held the roof. The Salt Office did not care where it came from.',
  },
  walled: {
    say: 'they walled up the sick in a chapel',
    why: 'The thirst-sickness went through the workings. They bricked the sick into a chapel with water for a week, and went back to work. When they opened it the water was brine.',
  },
  singing: {
    say: 'the salt began to sing',
    why: 'One shift the walls began to ring like glass, softly, and the men put down their picks to listen. They followed the sound down. Not all of them came back up.',
  },
};
const SAINTS = ['Saint Kinga', 'the Mother of the Pans', 'Saint Theodora of the Brine', 'Our Lady of Salt', 'Saint Barbara of the Deep', 'the White Mother'];
const SURNAME = ['Venier', 'Zane', 'Kalafatis', 'Mavros', 'Spanos', 'Lascaris', 'Bembo', 'Grimani', 'Calergi', 'Doukas', 'Foscolo', 'Rallis', 'Querini', 'Vlachos'];
const GIVEN = ['Kostas', 'Nikos', 'Andrea', 'Zorzi', 'Marin', 'Bastian', 'Piero', 'Iakovos', 'Stamatis', 'Elena', 'Theodora', 'Dimitra', 'Anzolo', 'Lena'];
const JOBS = ['the hewer', 'the raker', 'the carter', 'the lamp-keeper', 'the brine-reeve', 'the carver', 'the boy who led the horse', 'the timberman'];
const name = (rng) => `${rng.pick(GIVEN)} ${rng.pick(SURNAME)}`;
const MASTER = {
  salt_mother: ['the Salt Mother', 'The statue they carved at the bottom of everything, to be their saint; and the salt round her listened to their prayers so long that it began to answer.'],
  mirage_lion: ['the Mirage Lion', 'The Doge\'s winged lion, carved over the brine well to guard the Republic\'s salt. The salt sang to it until it moved; now it is everywhere down here, and nowhere.'],
};
const MASTER_ANY = ['the Master of the Salt', 'Whatever the miners dug toward is at the bottom of it.'];

export function saltLore(rec, n, boss = null) {
  const rng = new RNG(hash4(rec.seed >>> 0, n, 0x6b01));
  const fixed = new RNG(hash4(rec.seed >>> 0, 0, 0x6b02));
  const who = rec.origin?.who || 'the Salt Mother';
  const town = rec.townName || 'the town above';
  const year = rec.origin?.y || 1200;
  const fault = fixed.pick(Object.keys(FAULTS));
  const F = FAULTS[fault];
  const saint = fixed.pick(SAINTS);
  const master = `Rake-Master ${fixed.pick(SURNAME)}`;
  const crew = fixed.shuffle(JOBS.slice()).slice(0, 5).map((job) => ({ job, name: name(fixed) }));
  const quota = fixed.int(4, 9) * 100;
  const [mName, mWhy] = (boss && MASTER[boss]) || MASTER_ANY;
  const one = () => rng.pick(crew);
  const reeve = crew.find((q) => q.job === 'the brine-reeve') || crew[0];
  return {
    who, town, fault, saint, rakeMaster: master, crew, year, master: mName,
    // The miners' hymn, cut along the altar's edge.
    hymn() {
      return {
        title: 'The Miners\' Hymn',
        lines: [
          rng.pick([
            `Mother under the mountain, white as the morning, keep us from the dark and the water.`,
            `${cap(saint)}, who turned to salt for love, look down on us who cut you.`,
            'We take you a cart at a time, Mother, and you let us. Do not stop letting us.',
          ]),
          rng.pick(['Light the lamps for the men below.', 'Keep the brine in its bed.', 'Bring us up at the end of the shift.']),
          `(Cut here by the brotherhood of ${town}, in the year ${year - fixed.int(20, 60)}.)`,
        ],
      };
    },
    // The tally-book: loads by shift, the quota, and the bricked chapel.
    tally() {
      const c = one();
      return {
        title: 'The Tally-Book',
        lines: [
          `Loads to the shaft, ${master}'s gang. Quota for the Salt Office: ${quota} a month.`,
          `${c.name}, ${c.job}: ${rng.int(18, 40)} loads. ${rng.pick(['Short again.', 'Over.', 'Docked for the lamp oil.'])}`,
          rng.pick([
            'The chapel by the crystals is bricked up now. New bricks, not the rock: anyone can see where. God forgive us.',
            'Do not open the bricked chapel in the crystal hall. Whatever is in there we put there.',
            `Paid ${rng.int(2, 9)} soldi to the carver to wall up the old chapel by the singing stones.`,
          ]),
        ],
      };
    },
    // The Salt Office's decree, nailed up by the shaft.
    decree() {
      return {
        title: 'Decree of the Salt Office',
        lines: [
          `By order of the Most Serene Republic and its Office of Salt: the workings of ${town} shall send up ${quota * 2} loads in the month.`,
          rng.pick(['Any miner found taking salt for himself shall pay its weight in silver.', 'The chapels are the brotherhood\'s affair. The salt is the Republic\'s.', 'Where the rock gives no more, the pillars shall be cut thinner.']),
        ],
      };
    },
    // The brine-reeve's notes, by the lake: the treadwheel and the sluice.
    reeve() {
      return {
        title: 'The Brine-Reeve\'s Notes',
        lines: [
          `${reeve.name}. The lake is up ${rng.int(2, 9)} spans since the feast.`,
          'Walk the treadwheel and the sluice opens; the lake goes down into the old sump, and the arch at its end comes clear. The lower chapel is through there.',
          rng.pick(['Do not wade it. The salt grows on you.', 'The ones who drowned in it are still lying on its bed. When it goes down, they get up.', 'Walk the wheel, then step back from the edge.']),
        ],
      };
    },
    // An ex-voto under a niche: thanks for one brought up alive.
    votive() {
      const c = one();
      return {
        title: 'A Votive',
        lines: [rng.pick([
          `For ${c.name}, ${c.job}, brought up alive from the fall. His mother lit this.`,
          `To ${saint}, for the water you sent us when the shaft was shut.`,
          `For the ${rng.int(3, 12)} of the night shift. Their lamps went out together.`,
        ])],
      };
    },
    // A letter home, never sent.
    letter() {
      const c = one();
      return {
        title: 'A Letter',
        lines: [
          `"To ${rng.pick(['my wife', 'my mother', 'my sister', 'Papa'])}, at ${town}.`,
          rng.pick([
            'They have carved a whole church down here. You would not believe the chandeliers. Everything is salt, even the light.',
            'The Office wants twice the loads. The rake-master says we will cut the pillars. I said nothing. I should have said something.',
            'The walls sing at night. Soft, like a finger round a glass. Nobody sleeps.',
          ]),
          `Your ${c.name.split(' ')[0]}, ${c.job}."`,
        ],
      };
    },
    // The words cut under the Mother's statue.
    carving() {
      return {
        title: 'Cut in the Plinth',
        lines: [`${cap(saint)}. Carved from the living salt by the brotherhood of ${town}.`, rng.pick(['She weeps for the men below.', 'Who cuts her, feeds his children.', 'Mind the brine at her feet.'])],
      };
    },
    // A prayer, scratched by the dead.
    prayer() {
      return {
        title: 'A Prayer',
        lines: [rng.pick([
          'Mother, I am thirsty. Everything here is salt.',
          `${cap(saint)}, let the brine go down. Let it go down.`,
          'If we have taken too much, take it back from me, not from the boy.',
        ])],
      };
    },
    // The dead, white with salt.
    dead() {
      const c = one();
      return {
        title: 'A Miner',
        lines: [`${c.name}, ${c.job}, sat down here and the salt grew over him: he is white from his hood to his boots, his pick across his knees. ${rng.pick(['His lamp is empty.', 'His tally is in his pocket: short.', 'His face is turned to the wall, toward the singing.'])}`],
      };
    },
    // The hall of the master.
    last() {
      return {
        title: `${cap(mName)}'s Hall`,
        lines: [`Here is the bottom of the workings ${who === 'the Salt Mother' ? 'of the Salt Mother' : `of ${who}`}.`, `Since ${F.say}, nobody of ${master}'s gang has come up.`, mWhy],
      };
    },
    // (What went wrong, told.)
    story() {
      return { title: 'Scratched by the Shaft', lines: [`The year ${F.say}.`, F.why] };
    },
    // (One line, as you come down.)
    arrive() {
      return rng.pick([
        'Everything is white, and it glitters, and it is utterly silent.',
        'Somewhere below, very softly, the salt is ringing.',
        'The air is dry enough to crack your lips, and it tastes of tears.',
        'Candlelight, far down: someone is still keeping the lamps.',
      ]);
    },
  };
}
