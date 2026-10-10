// (Round 79) The stories of the landmarks (see world/landmarks.js):
//   - A tale: someone in a town knows of one not far off that you haven't
//     found, and tells of it if asked (it's on your map from then); of one
//     that hides something, an old saying of where.
//   - When one's found, someone in the nearest town wants something of
//     it: wood from the fallen giant for a carpenter's best work, a bone
//     from the old beast for a scholar, star-stone from a crater for a
//     smith; or to go and stand under the arch at dusk, or bathe in the
//     hot spring and say if the tales are true. Done, they tell what they
//     know (and of any cache, where it's buried).
import { motif, R, nameOf } from '../core.js';
import { pick, laidTowns, adults, isRec, townMid, directions } from './lib.js';
import { landmarksIn } from '../../../world/landmarks.js';
import { knowLandmark } from '../../../game/landmarkfind.js';
import { REGION_W } from '../../../config.js';

const tid = (th) => `t${th.id}`;
const NEAR_TOWN = 12 * REGION_W;

// The landmark a story's about, again (from its id: they're the world's).
function lmOf(S, v) {
  const ow = S.game.world.ow;
  const list = landmarksIn(ow, v.x - 4, v.z - 4, v.x + 4, v.z + 4);
  return list.find((q) => q.id === v.id) || null;
}

// Where its cache is, in words from the landmark (and the spot).
function secretWords(lm) {
  if (!lm || !lm.secret) return null;
  const x = lm.x + lm.secret.dx * 2;
  const z = lm.z + lm.secret.dz * 2;
  const ns = z < lm.z - 1 ? 'north' : z > lm.z + 1 ? 'south' : '';
  const ew = x < lm.x - 1 ? 'west' : x > lm.x + 1 ? 'east' : '';
  return { x, z, dir: `${ns}${ns && ew ? '-' : ''}${ew}` || 'right by it', paces: Math.round(Math.hypot(x - lm.x, z - lm.z)) };
}

function tellSecret(S, pid, lm, who) {
  const s = secretWords(lm);
  if (!s) return null;
  S.game.world.ow.pin(s.x, s.z, `Buried by ${lm.name}?`, 'x');
  S.tell(pid, `${who} says there's something buried at ${lm.name}: ${s.paces} paces ${s.dir} of it, a little way down. (Marked on your map.)`, '#ffe8a0');
  return s;
}

function nearestTown(S, x, z) {
  let best = null;
  let bd = NEAR_TOWN;
  for (const L of laidTowns(S)) {
    const m = townMid(L.settlement);
    const d = Math.hypot(m.x - x, m.z - z);
    if (d < bd) [best, bd] = [L, d];
  }
  return best;
}

// ------------------------------------------------------------ a tale told
motif({
  id: 'landmark_tale',
  family: 'landmarks',
  tone: 'calm',
  max: 3,
  key: (o) => `tale|${o.vars && o.vars.lm && o.vars.lm.id}`,
  title: (th) => `The Tale of ${th.vars.lm.name}`,
  scan(S, rng) {
    if (!S.game.world.terrain || !S.game.world.terrain.forms || !rng.chance(0.25)) return null;
    const L = pick(rng, laidTowns(S));
    if (!L) return null;
    const m = townMid(L.settlement);
    const found = S.game.landmarksFound || {};
    const lms = landmarksIn(S.game.world.ow, m.x - NEAR_TOWN, m.z - NEAR_TOWN, m.x + NEAR_TOWN, m.z + NEAR_TOWN).filter((q) => !found[q.id]);
    const lm = lms.length ? pick(rng, lms) : null;
    const teller = lm ? pick(rng, adults(L).filter((r) => r.age === 'elder' || ['hunter', 'farmer', 'innkeeper', 'scholar', 'priest', 'fisher'].includes(r.job))) || pick(rng, adults(L)) : null;
    if (!teller) return null;
    return { sid: L.settlement.id, cast: { teller: R.rec(L.settlement.id, teller.idx), town: R.town(L.settlement.id) }, vars: { lm: { id: lm.id, x: lm.x, z: lm.z, name: lm.name, kind: lm.kind } } };
  },
  nodes: {
    known: { fade: 30 },
  },
  townTalk(th, npc, pid) {
    if (!isRec(npc, th.cast.teller)) return [];
    return [{ id: 'sglt_tell', arg: tid(th), label: 'Any old tales of the country round here?' }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sglt_tell') return null;
    const lm = lmOf(S, th.vars.lm);
    if (!lm) return { lines: ['Tales? Not that I can think of.'] };
    const where = directions(S.game.world.ow.settlements[th.sid], lm.x, lm.z);
    knowLandmark(S.game, lm, 'told', pid);
    const lines = [
      ({ tree: `Out ${where} there's a tree that fell before my grandmother was born: ${lm.name}, they call it. You could build a ship from it.`,
        bones: `${lm.name}, ${where}. Bones of something bigger than a house. Nobody knows what it was.`,
        crater: `A star fell ${where}, long ago. ${lm.name}, they call the hole it made. The stone's still in it, black as night.`,
        arch: `There's an arch of stone ${where}: ${lm.name}. Lovers meet under it, and the wind sings through it.`,
        spring: `${lm.name}, ${where}: a pool that steams in winter. Bathe in it and your aches are gone, they say.` })[lm.kind],
      '(It\'s on your map now.)',
    ];
    if (lm.secret) {
      const s = tellSecret(S, pid, lm, th.names.teller);
      if (s) lines.push(`And they say something's buried there: ${s.paces} paces ${s.dir} of it.`);
    }
    S.end(th, 'told', `${th.names.teller} told ${nameOf(S, R.pl(pid))} of ${lm.name}.`);
    return { lines };
  },
});

// ------------------------------------------------------------ one found
const ASK = {
  tree: { job: ['carpenter', 'shipwright', 'woodcutter', 'builder'], item: 'log_oak', n: 12, title: 'Wood from {lm} for {who}', pitch: 'Wood from {lm}? Seasoned a hundred years where it lay. Twelve logs of it, and I\'ll make the finest thing I ever made.' },
  bones: { job: ['scholar', 'priest', 'healer', 'scribe'], item: 'whale_rib', n: 1, title: 'A bone from {lm} for {who}', pitch: 'The bones at {lm}... I must know what it was. Bring me one, would you? Just one.' },
  crater: { job: ['blacksmith', 'smith', 'jeweller', 'miner'], item: 'obsidian', n: 4, title: 'Star-stone from {lm} for {who}', pitch: 'Star-stone, from {lm}! Four pieces, and I\'ll forge something the like of which this town\'s never seen.' },
  arch: { job: null, visit: 6, title: 'Stand under {lm} at dusk', pitch: 'They say if you stand under {lm} at dusk, you hear the wind say the name of the one you\'ll love. Go and listen, and tell me what it said.' },
  spring: { job: ['healer', 'priest'], visit: 5, title: 'Bathe in {lm}', pitch: 'The waters of {lm} heal, they say. Go and bathe, and tell me if it\'s true: I\'ve sick folk here who can\'t walk that far on a maybe.' },
};

motif({
  id: 'landmark_quest',
  family: 'landmarks',
  tone: 'calm',
  max: 4,
  key: (o) => `lmq|${o.vars && o.vars.lm && o.vars.lm.id}`,
  title: (th) => th.vars.title,
  seeds: [{
    on: 'landmark_found',
    make(ev, S) {
      const lm = ev.lm;
      const A = ASK[lm.kind];
      const L = A ? nearestTown(S, lm.x, lm.z) : null;
      if (!L) return null;
      const rng = S.rng({ seed: lm.x * 31 + lm.z, steps: 0 }, 0x1ad);
      const folk = adults(L).filter((r) => r.job !== 'guard' && r.job !== 'mayor');
      const giver = (A.job && folk.find((r) => A.job.includes(r.job))) || pick(rng, folk);
      if (!giver) return null;
      const who = `${giver.name.first} ${giver.name.last}`;
      return {
        sid: L.settlement.id, cast: { giver: R.rec(L.settlement.id, giver.idx), town: R.town(L.settlement.id) }, touched: [ev.pid],
        vars: { lm, pid: ev.pid, title: A.title.replace('{lm}', lm.name).replace('{who}', giver.name.first), pitch: A.pitch.replace('{lm}', lm.name), who },
      };
    },
  }],
  nodes: {
    asked: {
      enter(th, S) {
        if (th.vars.posted) return;
        th.vars.posted = true;
        const A = ASK[th.vars.lm.kind];
        const giver = th.cast.giver;
        const lm = th.vars.lm;
        const t = A.visit
          ? S.post(th, { role: 'visit', kind: 'visit', title: th.vars.title, sid: th.sid, giver, at: { x: lm.x, z: lm.z }, r: A.visit, pitch: th.vars.pitch, days: 10, reward: { coins: 30, from: giver, rep: 10, fame: 1 } })
          : S.post(th, { role: 'bring', kind: 'fetch', item: A.item, n: A.n, title: th.vars.title, sid: th.sid, giver, pitch: th.vars.pitch, days: 12, reward: { coins: 45, from: giver, rep: 12, fame: 1 } });
        t.rumour = `${th.vars.who} of ${S.game.world.ow.settlements[th.sid]?.name || 'a town'} wants something from ${lm.name}`;
        S.tell(th.vars.pid, `Word of ${lm.name} reaches ${S.game.world.ow.settlements[th.sid]?.name || 'the nearest town'}: ${th.vars.who} there would like a word with whoever found it.`, '#e8d8a8');
      },
      fade: 16,
    },
  },
  tasks: {
    visit: {
      reach(th, t, pid, S) {
        const k = th.vars.lm.kind;
        S.complete(t, R.pl(pid));
        if (k === 'spring') {
          S.asPid(pid, (p) => {
            p.hp = p.maxHp ?? p.hp;
            p.addBlue?.(2, `spring:${th.vars.lm.id}`);
          });
          S.tell(pid, 'The water\'s hot enough to make you gasp, and every ache goes out of you. (Healed, and hardier for the day.)', '#a0ffc0');
        } else S.tell(pid, `The wind moans through ${th.vars.lm.name} as the sun goes down... and for a moment it sounds like a name.`, '#e8d8ff');
      },
      thanks(th) {
        return th.vars.lm.kind === 'spring' ? ['It\'s true, then! I\'ll take the sick there myself, in the spring.'] : ['It said a name? Whose? ...No, don\'t tell me. I\'ll go and hear it myself.'];
      },
      paid(th, t, pid, S) {
        const lm = lmOf(S, th.vars.lm);
        if (lm) tellSecret(S, pid, lm, th.vars.who);
        S.end(th, 'done', `${nameOf(S, R.pl(pid))} did as ${th.vars.who} asked at ${th.vars.lm.name}.`);
      },
    },
    bring: {
      thanks(th) {
        return [({ tree: 'Look at the grain on it! A hundred years, at least.', bones: 'Extraordinary. This will keep me busy for a year.', crater: 'It\'s warm still, can you feel it? Star-stone. Truly.' })[th.vars.lm.kind] || 'Thank you.'];
      },
      done(th, t, by, S) {
        const lm = lmOf(S, th.vars.lm);
        if (lm && by && by.t === 'pl') tellSecret(S, by.pid, lm, th.vars.who);
        S.end(th, 'done', `${nameOf(S, by)} brought ${th.vars.who} what they wanted from ${th.vars.lm.name}.`);
      },
    },
  },
});
