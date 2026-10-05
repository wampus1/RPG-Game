// Matters of the heart (round 54).
//
//   - A courtship: two people who've caught each other's eye. Each has
//     their own heart in it, and it warms or cools day by day, as they
//     are (the romantic and the cheerful warm fast; the proud and the
//     gloomy slowly). It can run smooth, or into trouble: one too shy to
//     say it, a rival for the same heart, a parent who won't hear of it,
//     doubts that want a token to settle, a secret come out, two families
//     at war. You can carry word, put in a good word, talk a parent round,
//     find a gift; or warn one off the other. It can end at the altar
//     (with you among the guests), in an elopement, at a broken
//     engagement, or with one heart broken and another story begun.
//   - A child on the way: a couple expecting; the cradle to be made, the
//     birth to come. Most come easy, and some hard (a midwife wanted, and
//     the herbs for it, quickly), and some are twins.
//   - Making it up: two of a family who haven't spoken in years (a word
//     said at a funeral, a debt, an elopement). Carry a letter, bring them
//     to the same table; it may mend, or tear for good.
//   - An elder's last wish: to see the sea once more, to taste the dish
//     their mother made, to hear a song, to have the old family sword back
//     from wherever it went. Granted, or not in time.
//   - Home again: someone long gone (to war, to sea, to an Academy, to the
//     outlaws) comes home. Welcomed with a feast, or not welcome at all, or
//     come back a stranger with a secret.
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, townMid, living, adults, fullName, kinOf, recOf, purse, has, nat, single, blood, persuade, repWith, isRec } from './lib.js';
import { alive, DAY, ledger } from '../../econ.js';
import { relocate, bear, newcomer } from '../../civic.js';
import { makePerson } from '../actors.js';
import { marry } from '../../events.js';
import { ITEMS } from '../../../world/items.js';
import { removeItem } from '../../../game/inventory.js';

const tid = (th) => `t${th.id}`;
const first = (r) => (r ? r.name.first : 'someone');
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ------------------------------------------------------------ a courtship
const MET = [
  'at the harvest dance', 'over a spilt basket at the market', 'sheltering from the rain under the same eave', 'arguing over the last loaf at the bakery',
  'at a funeral, of all places', 'at the well', 'when one fished the other out of the millpond', 'over a game of dice at the tavern', 'on the temple steps',
  'mending the same fence', 'when a runaway goat brought them together', 'at the smithy, both waiting on a mended pot', 'on the long road home from market',
];
// How they talk of the other, warm to cold.
const FOND = [
  [0.85, ['{o}? I think of nothing else. Is that foolish?', 'I\'m going to marry {o}. They don\'t know it yet.', 'Have you ever seen anyone laugh like {o}?']],
  [0.6, ['{o} is... well. {o} is lovely. Don\'t tell anyone I said so.', 'I walked {o} home yesterday. The long way.', 'I made {o} a little something. Do you think they\'ll like it?']],
  [0.35, ['{o}? We\'re friends. I think. I don\'t know what we are.', '{o} is kind. Maybe kind is enough?', 'I like {o}. I just don\'t know if I like them that way.']],
  [0, ['{o}? I\'d rather not talk about {o}.', 'I thought there was something there. I was wrong.', '{o} and I are done. I think. I hope.']],
];
const fondLine = (rng, v, o) => say(rng, FOND.find(([t]) => v >= t)[1], { o });
const WHY_NOT = [
  'they\'re not good enough for one of ours', 'there\'s bad blood between our families, going back years', 'I\'d meant them for someone with money',
  'they\'re too young to know their own minds', 'their trade\'s no trade at all', 'I don\'t trust them, and I can\'t say why',
];
const GIFTS = [['flower_red', 3], ['flower_yellow', 3], ['flower_blue', 3], ['flower_white', 3], ['pie', 1], ['apple_tart', 1], ['gem', 1], ['pearl_necklace', 1], ['ale', 2], ['honey', 1]];
const SECRETS = ['debt', 'promised', 'past'];

// Each heart, warming or cooling, as they are.
function drift(S, th, rng, who, other, v, d) {
  let n = (d - 0.3) * 0.05 + rng.float(-0.06, 0.08);
  if (has(who, 'romantic')) n += 0.04;
  if (has(who, 'cheerful')) n += 0.02;
  if (has(who, 'gloomy') || has(who, 'proud')) n -= 0.02;
  if (has(who, 'stubborn')) n *= 0.6;
  // (Warmth answered warms; coldness cools.)
  n += (nat(who, 'sociability') - 0.5) * 0.03 + (d > 0.6 ? 0.02 : d < 0.25 ? -0.03 : 0);
  void S;
  void th;
  void other;
  return clamp01(v + n);
}

function lovers(S, th) {
  return [recOf(S, th.cast.a), recOf(S, th.cast.b)];
}

function free(S, th) {
  for (const k of ['a', 'b']) {
    const r = recOf(S, th.cast[k]);
    if (r && r.courting === th.id) r.courting = null;
  }
}

motif({
  id: 'courtship',
  family: 'hearts',
  max: 8,
  key: (o) => [`${o.cast.a.sid}:${o.cast.a.idx}`, `${o.cast.b.sid}:${o.cast.b.idx}`].sort().join('&'),
  title: (th) => `${th.names.a} and ${th.names.b}`,
  // Now and then two people find each other (most matches come of a town's
  // own goings-on: see life.js weddings).
  scan(S, rng) {
    if (!rng.chance(0.12)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const singles = adults(L).filter((r) => single(L, r) && !r.courting && r.job !== 'merchant');
      if (singles.length < 2) continue;
      const a = rng.pick(singles);
      const b = rng.shuffle(singles.slice()).find((q) => q !== a && q.household !== a.household && !blood(a, q));
      if (!b) continue;
      return { cast: { a: R.rec(L.settlement.id, a.idx), b: R.rec(L.settlement.id, b.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id };
    }
    return null;
  },
  // Lovers from two families at war: star-crossed.
  meets: [
    {
      m: 'feud',
      when: (a, b, S) => {
        const [x, y] = lovers(S, a);
        if (!x || !y) return false;
        const fam = [b.vars.fa, b.vars.fb];
        return x.name.last !== y.name.last && fam.includes(x.name.last) && fam.includes(y.name.last);
      },
      then(a, b, S) {
        a.vars.feud = b.id;
        S.retitle(a, `${a.names.a} and ${a.names.b}, Across the Feud`);
        S.note(a, `Their families are at war: the ${b.vars.fa}s and the ${b.vars.fb}s. They meet in secret now.`);
        S.note(b, `${a.names.a} and ${a.names.b}, one of each house, have been seen together. Neither family knows what to do about it.`);
        if (!a.vars.trouble) a.vars.trouble = { kind: 'feud', since: S.now };
      },
    },
  ],
  nodes: {
    spark: {
      enter(th, S) {
        const [a, b] = lovers(S, th);
        if (!a || !b) return S.end(th, 'faded');
        const rng = S.rng(th, 0xc0a);
        a.courting = th.id;
        b.courting = th.id;
        // (Each heart its own: the one who noticed first, and the other.)
        th.vars.ha = th.vars.ha ?? rng.float(0.45, 0.7) + (has(a, 'romantic') ? 0.1 : 0);
        th.vars.hb = th.vars.hb ?? rng.float(0.2, 0.6) + (has(b, 'romantic') ? 0.1 : 0);
        th.vars.met ||= pick(rng, MET);
        th.vars.ready ||= false;
        S.note(th, say(rng, [
          '{a} and {b} met {m}, and haven\'t stopped finding reasons to meet since.',
          'Ever since they met {m}, {a} has been going out of their way to pass {b}\'s door.',
          '{a} and {b} met {m}. {a} hasn\'t been the same since. {b} may not have noticed.',
          'They met {m}: {a} and {b}. Half the town has noticed. The other half is about to.',
        ], { a: th.names.a, b: th.names.b, m: th.vars.met }), { news: rng.chance(0.4) ? [th.sid] : [] });
      },
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY >= rng.int(1, 3)) S.go(th, 'courting');
      },
      fade: 8,
    },
    courting: {
      enter(th, S) {
        if (th.vars.trouble !== undefined) return;
        // What stands in the way, if anything (or nothing at all).
        const [a, b] = lovers(S, th);
        const L = layoutOf(S, th.sid);
        if (!a || !b || !L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x7b1);
        const shy = [a, b].sort((x, y) => nat(x, 'bravery') - nat(y, 'bravery'))[0];
        const rivals = adults(L).filter((r) => single(L, r) && !r.courting && r !== a && r !== b && r.household !== b.household && !blood(r, b));
        const kinA = kinOf(L, a).filter((k) => (a.parents || []).includes(k.idx));
        const kinB = kinOf(L, b).filter((k) => (b.parents || []).includes(k.idx));
        const kin = [...kinA, ...kinB].filter((k) => nat(k, 'temper') > 0.35 || has(k, 'stubborn') || has(k, 'proud'));
        const t = S.choose(th, [
          { to: 'none', w: th.vars.ready ? 2.2 : 1.1 },
          { to: 'shy', w: (has(shy, 'timid') || has(shy, 'reserved') ? 1.4 : 0.4) * (1 - nat(shy, 'bravery')) + 0.1 },
          { to: 'rival', w: rivals.length ? 0.8 : 0 },
          { to: 'kin', w: kin.length ? 0.9 : 0 },
          { to: 'doubt', w: has(b, 'proud') || has(b, 'gloomy') || has(b, 'shrewd') ? 0.9 : 0.35 },
          { to: 'secret', w: 0.35 },
        ], rng).to;
        th.vars.trouble = null;
        if (t === 'none') return;
        const tr = { kind: t, since: S.now };
        th.vars.trouble = tr;
        if (t === 'shy') {
          tr.who = shy === a ? 'a' : 'b';
          const o = tr.who === 'a' ? 'b' : 'a';
          S.note(th, say(rng, [
            '{s} goes red and tongue-tied whenever {o} is near. They\'ve not said a word of it.',
            '{s} has written {o} three letters and burnt every one.',
            '{s} would sooner fight a bear than tell {o} how they feel.',
          ], { s: th.names[tr.who], o: th.names[o] }));
          const tk = S.post(th, {
            role: 'word', kind: 'deliver', title: `Carry ${first(shy)}'s letter to ${th.names[o]}`, sid: th.sid, giver: th.cast[tr.who], target: th.cast[o],
            pitch: say(rng, [
              'Could you... would you take this to {o}? Don\'t read it. Don\'t say it\'s from me. No: do say it\'s from me. Oh, I don\'t know.',
              'I can\'t give it to {o} myself. My legs won\'t carry me there. Would yours?',
              'It\'s a letter. For {o}. If they laugh, don\'t tell me. If they don\'t... tell me everything.',
            ], { o: th.names[o] }),
            reward: { coins: 0, rep: 12, fame: 0.5 },
          });
          tk.offerLabel = pick(rng, ['You look like you\'ve swallowed a bee.', 'Is something on your mind?', 'You keep looking at the door.']);
          tk.item = S.writeNote(th, 'letter', `To ${th.names[o]}`, [pick(rng, [
            `I don't know how to say this, so I'll just write it. Every time you're near I forget my own name. If you'd walk with me one evening, I'd remember it again. - ${th.names[tr.who]}`,
            `You won't remember, but you laughed at something I said ${th.vars.met}. I've been trying to make you laugh again ever since. - ${th.names[tr.who]}`,
            `I'm no good with words. But I'd like to be good to you, if you'd let me. - ${th.names[tr.who]}`,
          ])]);
          tk.n = 1;
          th.vars.letter = tk.item;
        } else if (t === 'rival') {
          const c = pick(rng, rivals);
          th.cast.rival = R.rec(c.sid, c.idx);
          th.names.rival = fullName(c);
          c.courting = th.id;
          tr.hc = rng.float(0.35, 0.65);
          S.note(th, say(rng, [
            '{c} has started bringing {b} flowers too. {a} is not pleased.',
            '{c} has asked {b} to the dance. So has {a}. {b} hasn\'t answered either.',
            'There\'s a rival: {c}, who\'s been sweet on {b} for years, and says so now, loudly.',
          ], { a: th.names.a, b: th.names.b, c: th.names.rival }), { news: [th.sid] });
          const tk = S.post(th, {
            role: 'win', kind: 'talk', title: `Help ${first(a)} win ${th.names.b}'s heart from ${th.names.rival}`, sid: th.sid, giver: th.cast.a,
            pitch: say(rng, [
              '{c} is courting {b} too. {c}! With their fine words. Would you put in a word for me? {b} listens to people like you.',
              'I\'ll not stand by while {c} sweeps {b} off their feet. But I\'m no talker. You are. Speak for me?',
            ], { b: th.names.b, c: th.names.rival }),
            reward: { coins: 0, rep: 10, fame: 0.5 },
          });
          tk.offerLabel = 'You look like someone who\'s lost a fight.';
        } else if (t === 'kin') {
          const k = pick(rng, kin);
          const side = kinA.includes(k) ? 'a' : 'b';
          th.cast.kin = R.rec(k.sid, k.idx);
          th.names.kin = fullName(k);
          tr.side = side;
          tr.why = pick(rng, WHY_NOT);
          tr.set = 0.4 + nat(k, 'temper') * 0.3 + (has(k, 'stubborn') ? 0.25 : 0) + (has(k, 'proud') ? 0.15 : 0) - nat(k, 'kindness') * 0.3;
          S.note(th, `${th.names.kin} won't hear of it: ${tr.why}.`, { news: rng.chance(0.5) ? [th.sid] : [] });
          const tk = S.post(th, {
            role: 'blessing', kind: 'talk', title: `Win ${th.names.kin}'s blessing for ${first(a)} and ${first(b)}`, sid: th.sid, giver: th.cast[side],
            pitch: say(rng, [
              '{k} won\'t give us their blessing. Says {w}. I can\'t marry without it. I can\'t live without them. Talk to {k}? Please?',
              'It\'s {k}. You know what they\'re like. They\'ll listen to an outsider before they\'ll listen to me.',
            ], { k: th.names.kin, w: tr.why }),
            reward: { coins: 0, rep: 15, renown: th.sid, renownPts: 2, renownWhy: 'bringing a family round', fame: 1 },
          });
          tk.offerLabel = pick(rng, ['Your eyes are red. What\'s happened?', 'You look like you\'ve been arguing.']);
        } else if (t === 'doubt') {
          const [gift, n] = pick(rng, GIFTS.filter(([k]) => ITEMS[k]));
          tr.gift = gift;
          S.note(th, say(rng, [
            '{b} isn\'t sure. {a} wants to show them they mean it, with a gift worth giving.',
            '{b} has cooled, a little. {a} has a plan: a gift, the right gift.',
          ], { a: th.names.a, b: th.names.b }));
          const tk = S.post(th, {
            role: 'gift', kind: 'fetch', title: `Bring ${first(a)} ${n > 1 ? `${n} ` : ''}${ITEMS[gift].name.toLowerCase()} for ${th.names.b}`, sid: th.sid, giver: th.cast.a, item: gift, n,
            pitch: say(rng, [
              '{b} once said they loved {g}. I\'ve no way to get any. Could you? I\'d pay you back somehow.',
              'I want to give {b} something. Something that says I listen. {g}: that\'s what they\'d want.',
            ], { b: th.names.b, g: ITEMS[gift].name.toLowerCase() }),
            reward: { coins: 6, rep: 10, fame: 0.5 },
          });
          tk.offerLabel = 'You look like you\'re planning something.';
        } else if (t === 'secret') {
          tr.what = pick(rng, SECRETS);
          if (tr.what === 'debt') {
            tr.sum = 20 + rng.int(0, 40);
            S.note(th, `It\'s come out that ${th.names.b} owes ¤${tr.sum} they can\'t pay, and has been hiding it. ${th.names.a} doesn\'t know what to think.`);
          } else if (tr.what === 'promised') {
            S.note(th, `It\'s come out that ${th.names.b} was promised to someone in another town, years ago, by their family. ${th.names.b} says the promise means nothing. Their family says otherwise.`);
            tr.set = 0.5;
          } else {
            S.note(th, `Someone from ${th.names.b}\'s past has written: an old love, asking to be let back in. ${th.names.b} hasn\'t answered.`);
          }
        }
      },
      day(th, S, rng) {
        const [a, b] = lovers(S, th);
        const L = layoutOf(S, th.sid);
        if (!a || !b || !alive(a) || !alive(b) || !L) {
          const gone = !a || !alive(a) ? th.names.a : th.names.b;
          return S.end(th, 'grief', `${gone} is gone. ${pick(rng, ['The other wears black, and won\'t talk about it.', 'There was so much they never got to say.', 'Their flowers are still on the sill.'])}`);
        }
        const tr = th.vars.trouble;
        th.vars.ha = drift(S, th, rng, a, b, th.vars.ha, th.vars.hb);
        th.vars.hb = drift(S, th, rng, b, a, th.vars.hb, th.vars.ha);
        // The trouble, if there is one: time, or the people in it, settle it
        // (or it settles them).
        if (tr) troubleDay(th, S, rng, a, b, L, tr);
        if (th.done || th.node !== 'courting') return;
        const tr2 = th.vars.trouble;
        if (th.vars.ha >= 0.85 && th.vars.hb >= 0.8 && (!tr2 || tr2.kind === 'feud')) return S.go(th, 'proposal');
        if (th.vars.ha <= 0.12 || th.vars.hb <= 0.08) return S.go(th, 'parted');
        if ((S.now - th.nodeAt) / DAY > 26) S.end(th, 'cooled', `${th.names.a} and ${th.names.b} drifted apart, the way people do. ${pick(rng, ['They still nod in the street.', 'No harm done, they say.', 'Neither of them will say why.'])}`);
      },
      fade: 30,
    },
    proposal: {
      enter(th, S) {
        const [a, b] = lovers(S, th);
        if (!a || !b) return S.end(th, 'faded');
        const rng = S.rng(th, 0x9e0);
        // The bolder asks.
        const ask = nat(a, 'bravery') + (has(a, 'romantic') ? 0.2 : 0) >= nat(b, 'bravery') + (has(b, 'romantic') ? 0.2 : 0) - rng.float(0, 0.3) ? 'a' : 'b';
        const ans = ask === 'a' ? 'b' : 'a';
        const where = pick(rng, ['by the well at dusk', 'in front of the whole tavern', 'on the walk home from market', 'at the top of the hill above town', 'in the rain, because they couldn\'t wait', 'with a ring hidden in a pie']);
        const heart = th.vars[`h${ans}`];
        const tr = th.vars.trouble;
        // A parent still against it, and two hearts set on it: they may run.
        if (tr && tr.kind === 'feud' && rng.chance(0.35 + (has(a, 'romantic') || has(b, 'romantic') ? 0.25 : 0))) return S.go(th, 'eloped', `${th.names[ask]} asked ${th.names[ans]} ${where}. Their families would never allow it. So they didn't ask their families.`);
        if (heart > 0.85 || rng.chance(heart)) {
          S.note(th, `${th.names[ask]} asked ${th.names[ans]} to marry them, ${where}. ${pick(rng, ['The answer was yes before the question was done.', 'They said yes, and then cried, and then said yes again.', 'They said yes. The whole street cheered.', `"Took you long enough," said ${first(ans === 'a' ? a : b)}. That's a yes.`])}`, { news: [th.sid] });
          return S.go(th, 'engaged');
        }
        if (rng.chance(0.5)) {
          th.vars[`h${ask}`] = clamp01(th.vars[`h${ask}`] - 0.2);
          S.note(th, `${th.names[ask]} asked ${th.names[ans]} to marry them, ${where}. "Not yet," said ${th.names[ans]}. "Ask me again." ${th.names[ask]} is trying to take that as hope.`);
          return S.go(th, 'courting');
        }
        S.go(th, 'parted', `${th.names[ask]} asked ${th.names[ans]} to marry them, ${where}. The answer was no.`);
      },
    },
    engaged: {
      enter(th, S) {
        let [a, b] = lovers(S, th);
        if (!a || !b) return S.end(th, 'faded');
        const rng = S.rng(th, 0xe9a);
        let L = layoutOf(S, a.sid);
        // (Two towns: one goes to live in the other's, the one with fewer
        // kin to leave.)
        if (a.sid !== b.sid) {
          const La = layoutOf(S, a.sid);
          const Lb = layoutOf(S, b.sid);
          if (!La || !Lb) return S.end(th, 'faded');
          const moveA = kinOf(La, a).length <= kinOf(Lb, b).length;
          const [mover, ML, T] = moveA ? [a, La, Lb] : [b, Lb, La];
          const moved = relocate(S.sim, ML, [mover], T, `to marry ${fullName(moveA ? b : a)}`)[0];
          if (!moved) return S.end(th, 'faded');
          const k = moveA ? 'a' : 'b';
          th.cast[k] = R.rec(T.settlement.id, moved.idx);
          moved.courting = th.id;
          th.sid = T.settlement.id;
          th.cast.town = R.town(th.sid);
          S.note(th, `${th.names[k]} is leaving ${ML.settlement.name} for ${T.settlement.name}, to be married there.`, { news: [ML.settlement.id] });
          [a, b] = lovers(S, th);
          L = T;
        }
        if (!L || !a || !b) return S.end(th, 'faded');
        const ev = S.sim.events.wedding(L, a, b, S.day);
        th.vars.ev = ev.id;
        th.vars.wedDay = ev.day;
        // A twist on the day, now and then.
        th.vars.twist = S.choose(th, [
          { to: null, w: 3 },
          { to: 'feet', w: 0.4 + (has(b, 'timid') ? 0.3 : 0) + (th.vars.hb < 0.85 ? 0.4 : 0) },
          { to: 'objection', w: th.cast.rival || th.cast.kin ? 0.7 : 0.1 },
          { to: 'storm', w: 0.25 },
          { to: 'gift', w: 0.3 },
        ], rng).to;
        // Those who had a hand in it are asked.
        for (const pid of Object.keys(th.touched)) {
          S.post(th, {
            role: 'guest', kind: 'meet', title: `Come to ${first(a)} and ${first(b)}'s wedding (day ${ev.day + 1})`, sid: L.settlement.id, giver: null, only: [pid], npc: false, board: false, hand: 'auto',
            at: townMid(L.settlement), r: 14, pitch: `${th.names.a} and ${th.names.b} would like you there: you had a hand in it.`,
            reward: { coins: 0, rep: 10, fame: 1, items: [[ITEMS.pie ? 'pie' : 'bread', 1]] },
          });
          S.tell(pid, `${th.names.a} and ${th.names.b} are to be married, on day ${ev.day + 1} in ${L.settlement.name}. They'd like you there.`, '#ffd0e8');
        }
      },
      live(th, S) {
        // (The guests' task: where the do is, once it's set up.)
        const L = layoutOf(S, th.sid);
        const ev = L && (L.econ.events || []).find((q) => q.id === th.vars.ev);
        if (!ev) return;
        for (const t of S.tasksOf(th, 'guest')) if (ev.site) t.at = { x: Math.round((ev.site.x0 + ev.site.x1) / 2), z: Math.round((ev.site.z0 + ev.site.z1) / 2) };
      },
      hour(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const ev = L && (L.econ.events || []).find((q) => q.id === th.vars.ev);
        if (!ev || th.vars.twisted || !th.vars.twist || S.day !== ev.day || S.now < ev.s - 120) return;
        weddingTwist(th, S, rng, L, ev);
      },
      day(th, S, rng) {
        const [a, b] = lovers(S, th);
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        if (a && b && a.partner === b.idx && b.partner === a.idx) return wedded(th, S, rng, L);
        const ev = (L.econ.events || []).find((q) => q.id === th.vars.ev);
        if (!ev || ev.state === 'off') {
          if (th.vars.jilted) return;
          if (!a || !b || !alive(a) || !alive(b)) return S.end(th, 'grief', `The wedding never came. ${(!a || !alive(a)) ? th.names.a : th.names.b} died before the day. ${pick(rng, ['The flowers went on a grave instead.', 'The whole town mourned them.'])}`, { news: [th.sid] });
          if (!ev && th.vars.wedDay !== undefined && S.day > th.vars.wedDay + 1) S.end(th, 'faded');
        }
      },
      fade: 12,
    },
    eloped: {
      enter(th, S) {
        const [a, b] = lovers(S, th);
        const rng = S.rng(th, 0xe10);
        const L = layoutOf(S, th.sid);
        if (!a || !b || !L) return S.end(th, 'faded');
        // Somewhere far enough that nobody comes after them.
        const s = L.settlement;
        const far = laidTowns(S).filter((T) => T !== L && T.settlement.id !== b.sid && !T.settlement.deserted).sort((x, y) => Math.hypot(y.settlement.cx - s.cx, y.settlement.cz - s.cz) - Math.hypot(x.settlement.cx - s.cx, x.settlement.cz - s.cz));
        const T = far.length ? pick(rng, far.slice(0, 3)) : null;
        free(S, th);
        if (T) {
          const Lb = layoutOf(S, b.sid) || L;
          const [na] = relocate(S.sim, layoutOf(S, a.sid) || L, [a], T, 'eloped');
          const [nb] = relocate(S.sim, Lb, [b], T, 'eloped');
          if (na && nb) marry(T, na, nb);
          ledger(T, S.day, `Two strangers came in on the road, newly married and very much in love: ${fullName(na)} and ${fullName(nb)}.`);
        } else {
          for (const r of [a, b]) r.away = true;
        }
        const kin = recOf(S, th.cast.kin);
        const how = kin ? S.choose(th, [
          { to: 'rage', w: nat(kin, 'temper') + (has(kin, 'proud') ? 0.4 : 0) },
          { to: 'grief', w: nat(kin, 'kindness') },
          { to: 'glad', w: has(kin, 'romantic') ? 0.6 : 0.15 },
        ], rng).to : null;
        const line = !kin ? 'Nobody knows where they went.' : how === 'rage' ? `${th.names.kin} has sworn they're no child of theirs now.` : how === 'grief' ? `${th.names.kin} sits by the window every evening, watching the road.` : `${th.names.kin}, of all people, was seen smiling about it.`;
        S.note(th, `${th.names.a} and ${th.names.b} ran away together in the night${T ? `, to ${T.settlement.name}, where they were married` : ''}. ${line}`, { news: [th.sid] });
        // (One day, maybe, the family will want to make it up.)
        if (kin && how !== 'glad' && rng.chance(0.6)) {
          const child = th.vars.trouble && th.vars.trouble.side === 'b' ? 'b' : 'a';
          th.vars.split = true;
          S.end(th, 'eloped');
          S.split(th, 'reconcile', { cast: { x: th.cast.kin, y: R.town(T ? T.settlement.id : th.sid), town: R.town(th.sid) }, sid: th.sid, vars: { why: 'eloped', who: th.names[child], whereSid: T ? T.settlement.id : null, cool: rng.int(4, 9) } });
          return;
        }
        S.end(th, 'eloped');
      },
    },
    parted: {
      enter(th, S) {
        const [a, b] = lovers(S, th);
        const rng = S.rng(th, 0x9a7);
        free(S, th);
        const c = recOf(S, th.cast.rival);
        if (c && c.courting === th.id) c.courting = null;
        // Whose heart broke (the one who cared more).
        const hurt = th.vars.ha >= th.vars.hb ? a : b;
        if (hurt) hurt.mood = Math.max(0, (hurt.mood ?? 0.5) - 0.35);
        const won = th.vars.trouble && th.vars.trouble.kind === 'rival' && th.vars.trouble.won === 'rival';
        S.end(th, won ? 'lost' : 'parted', won
          ? `${th.names.b} chose ${th.names.rival}. ${th.names.a} ${pick(rng, ['took it well, in public.', 'hasn\'t been seen at the tavern since.', 'wished them happy, and meant it, almost.'])}`
          : `${th.names.a} and ${th.names.b} are not to be. ${hurt ? `${first(hurt)} ${pick(rng, ['took it hard.', 'has been walking alone in the evenings.', 'says they\'re fine. They\'re not fine.', 'threw themselves into their work.'])}` : ''}`, { news: rng.chance(0.4) ? [th.sid] : [] });
        // A rival who won courts in earnest now; a jilted temper may not let it lie.
        if (won && c && b && !c.courting && !b.courting) {
          const kid = S.split(th, 'courtship', { cast: { a: th.cast.rival, b: th.cast.b, town: R.town(th.sid) }, sid: th.sid, vars: { ha: Math.max(0.6, th.vars.trouble.hc || 0.6), hb: 0.65, met: 'while ' + th.names.a + ' was courting them' } });
          void kid;
        }
        if (won && a && c && nat(a, 'temper') > 0.6 && a.name.last !== c.name.last && rng.chance(0.5)) {
          S.split(th, 'feud', { cast: { a: th.cast.a, b: th.cast.rival, town: R.town(th.sid) }, sid: th.sid, vars: { why: `${th.names.b}'s heart`, fa: a.name.last, fb: c.name.last, step: 0 } });
        }
      },
    },
  },
  ended(th, S) {
    free(S, th);
    const c = recOf(S, th.cast.rival);
    if (c && c.courting === th.id) c.courting = null;
  },
  tasks: {
    word: {
      // (The letter: given at the start, and delivered: see talk.js.)
      accepted(th, t, who, S) {
        if (who.t === 'pl' && th.vars.letter) S.give(who.pid, th.vars.letter, 1);
      },
      done(th, t, by, S) {
        const tr = th.vars.trouble;
        if (!tr || tr.kind !== 'shy') return;
        const o = tr.who === 'a' ? 'b' : 'a';
        const rng = S.rng(th, 0x1e7);
        const v = th.vars[`h${o}`];
        th.vars[`h${o}`] = clamp01(v + (v > 0.3 ? 0.3 : 0.12));
        th.vars[`h${tr.who}`] = clamp01(th.vars[`h${tr.who}`] + 0.1);
        th.vars.trouble = null;
        S.note(th, v > 0.3 ? `${th.names[o]} read ${th.names[tr.who]}'s letter, and went straight round to their door.` : `${th.names[o]} read ${th.names[tr.who]}'s letter, and didn't know what to say. ${pick(rng, ['But they kept it.', 'They read it again that night.', 'They\'re thinking about it.'])}`, { by: by && by.t === 'pl' ? by.pid : null });
      },
      thanks: (th) => [`They read it? What did they... no, don't tell me. I'll go and find out myself.`, `(${th.names.b} has the letter now.)`],
    },
    win: {},
    blessing: {},
    gift: {
      done(th, t, by, S) {
        const rng = S.rng(th, 0x61f);
        const b = recOf(S, th.cast.b);
        const tr = th.vars.trouble;
        // (Not everyone wants a fuss made.)
        const flash = tr && (tr.gift === 'gem' || tr.gift === 'pearl_necklace');
        if (b && flash && (has(b, 'honest') || has(b, 'stingy')) && rng.chance(0.5)) {
          th.vars.hb = clamp01(th.vars.hb - 0.1);
          S.note(th, `${th.names.a} gave ${th.names.b} the gift. ${th.names.b} thought it far too much, and said so. It didn't go as planned.`);
        } else {
          th.vars.hb = clamp01(th.vars.hb + 0.35);
          S.note(th, `${th.names.a} gave ${th.names.b} the gift. ${pick(rng, [`${th.names.b} hasn't stopped smiling since.`, `${th.names.b} kissed them, right there in the street.`, `${th.names.b} said nobody had ever listened to them like that.`])}`);
        }
        th.vars.trouble = null;
      },
      thanks: () => ['Perfect. It\'s perfect. Wish me luck.'],
    },
    guest: {
      reach(th, t, pid, S) {
        const L = layoutOf(S, th.sid);
        const ev = L && (L.econ.events || []).find((q) => q.id === th.vars.ev);
        if (!ev || ev.state !== 'on') return;
        S.complete(t, R.pl(pid));
        S.tell(pid, `${th.names.a} and ${th.names.b} spot you among the guests, and wave you over: "You came! Here: have some of the wedding pie."`, '#ffd0e8');
      },
    },
  },
  townTalk(th, npc, pid, S) {
    const out = [];
    if (!npc.rec || th.node === 'eloped' || th.node === 'parted') return out;
    const tr = th.vars.trouble;
    for (const k of ['a', 'b']) {
      if (!isRec(npc, th.cast[k])) continue;
      const o = k === 'a' ? 'b' : 'a';
      out.push({ id: 'sgl_how', arg: `${tid(th)}:${k}`, label: `How are things with ${first(recOf(S, th.cast[o]))}?` });
      if (th.node === 'courting') {
        out.push({ id: 'sgl_good', arg: `${tid(th)}:${k}`, label: `${first(recOf(S, th.cast[o]))} talks of you a lot, you know.` });
        out.push({ id: 'sgl_warn', arg: `${tid(th)}:${k}`, label: `Be careful with ${first(recOf(S, th.cast[o]))}.` });
        if (tr && tr.kind === 'rival' && k === 'b') out.push({ id: 'sgl_for', arg: `${tid(th)}:rival`, label: `${th.names.rival} would make you happier.` });
        if (tr && tr.kind === 'secret' && tr.what === 'debt' && k === 'b' && !tr.paid) out.push({ id: 'sgl_debt', arg: tid(th), label: `I'll pay what you owe. (¤${tr.sum})` });
      }
    }
    if (tr && tr.kind === 'rival' && isRec(npc, th.cast.rival) && th.node === 'courting') out.push({ id: 'sgl_off', arg: tid(th), label: `Leave ${first(recOf(S, th.cast.b))} be. Their heart's spoken for.` });
    if (tr && (tr.kind === 'kin' || tr.kind === 'feud') && isRec(npc, th.cast.kin) && th.node === 'courting') out.push({ id: 'sgl_bless', arg: tid(th), label: `Give ${first(recOf(S, th.cast.a))} and ${first(recOf(S, th.cast.b))} your blessing.` });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const k = String(arg).split(':')[1];
    const rng = S.rng(th, 0x1a7 + (npc.id | 0));
    const tr = th.vars.trouble;
    const L = layoutOf(S, th.sid);
    switch (id) {
      case 'sgl_how': {
        const o = k === 'a' ? 'b' : 'a';
        return { lines: [fondLine(rng, th.vars[`h${k}`], first(recOf(S, th.cast[o])))] };
      }
      case 'sgl_good': {
        const o = k === 'a' ? 'b' : 'a';
        if (th.vars[`said${k}`] === pid) return { lines: ['You said. I\'ve thought of little else.'] };
        th.vars[`said${k}`] = pid;
        S.touch(th, pid);
        // (True or not: it helps, if they're fond already.)
        const v = th.vars[`h${k}`];
        th.vars[`h${k}`] = clamp01(v + (v > 0.3 ? 0.15 : 0.05));
        if (tr && tr.kind === 'shy' && tr.who === k && rng.chance(0.5 + nat(npc.rec, 'bravery') * 0.3)) {
          th.vars.trouble = null;
          for (const t of S.tasksOf(th, 'word')) S.closeTask(t, 'void');
          S.note(th, `${th.names[k]} found their courage, and told ${th.names[o]} how they felt. ${nameOf(S, R.pl(pid))} gave them the nudge.`);
          return { lines: ['They... do they? Really? Then I\'m going. Now. Before I lose my nerve.'] };
        }
        return { lines: [pick(rng, ['Do they? Do they really?', 'You\'re not just saying that?', 'Oh. Oh! Well. Well, well.'])] };
      }
      case 'sgl_warn': {
        const o = k === 'a' ? 'b' : 'a';
        S.touch(th, pid);
        if (persuade(S, npc, rng, 0.2, th.vars[`h${k}`] * 0.5)) {
          th.vars[`h${k}`] = clamp01(th.vars[`h${k}`] - 0.25);
          S.note(th, `Someone warned ${th.names[k]} off ${th.names[o]}. It's given them pause.`, { hidden: true, by: pid });
          return { lines: [pick(rng, ['...Do you know something I don\'t?', 'I\'d wondered. I didn\'t want to wonder.', 'Why would you say that? ...No. Tell me.'])] };
        }
        repWith(S, L, npc.rec, -6);
        return { lines: [pick(rng, ['Mind your own business.', 'You don\'t know them like I do.', 'Who asked you?'])] };
      }
      case 'sgl_for': {
        S.touch(th, pid);
        if (!tr || tr.kind !== 'rival') return { lines: ['Hm?'] };
        if (persuade(S, npc, rng, 0.25, th.vars.hb * 0.4)) {
          tr.hc = clamp01((tr.hc || 0.4) + 0.2);
          th.vars.hb = clamp01(th.vars.hb - 0.1);
          return { lines: [pick(rng, [`${th.names.rival}? I hadn't thought... maybe.`, 'You think so? They do make me laugh.'])] };
        }
        return { lines: ['I\'ll be the judge of that, thank you.'] };
      }
      case 'sgl_debt': {
        if (!tr || tr.kind !== 'secret' || tr.paid) return { lines: ['That\'s been seen to.'] };
        if (purse(S, pid) < tr.sum) return { lines: [`That's kind, but it's ¤${tr.sum}, and you haven't got it.`] };
        S.asPid(pid, (p) => removeItem(p.inv, 'coin', tr.sum));
        tr.paid = pid;
        th.vars.trouble = null;
        th.vars.hb = clamp01(th.vars.hb + 0.1);
        th.vars.ha = clamp01(th.vars.ha + 0.1);
        S.touch(th, pid);
        repWith(S, L, npc.rec, 20);
        S.person(pid).fame += 1;
        S.note(th, `${nameOf(S, R.pl(pid))} paid ${th.names.b}'s debt. There's nothing hidden between them now.`, { by: pid });
        return { lines: ['You... why would you do that? I don\'t know how I\'ll ever...', 'Thank you. There\'s nothing hidden now. That\'s worth more than the money.'] };
      }
      case 'sgl_off': {
        S.touch(th, pid);
        if (!tr || tr.kind !== 'rival') return { lines: ['Hm?'] };
        const c = npc.rec;
        if (persuade(S, npc, rng, 0.25, nat(c, 'temper') * 0.4 + (has(c, 'stubborn') ? 0.2 : 0))) {
          tr.gaveUp = true;
          S.note(th, `${th.names.rival} stepped aside. ${pick(rng, ['Gracefully, mostly.', 'With a sigh you could hear across town.', 'And bought ' + th.names.a + ' a drink, which nobody expected.'])}`, { by: pid });
          return { lines: [pick(rng, ['...Fine. If it\'s them they want. Fine.', 'I know. I knew. I just hoped.'])] };
        }
        repWith(S, L, c, -10);
        if (nat(c, 'temper') > 0.65) {
          tr.hc = clamp01((tr.hc || 0.4) + 0.1);
          return { lines: ['And who are you to tell me? Get out of my way.'] };
        }
        return { lines: ['I\'ll court whoever I please.'] };
      }
      case 'sgl_bless': {
        S.touch(th, pid);
        if (!tr || !tr.set) return { lines: ['Hm?'] };
        if (persuade(S, npc, rng, 0.2, tr.set * 0.5)) {
          th.vars.trouble = null;
          for (const t of S.tasksOf(th, 'blessing')) S.complete(t, R.pl(pid));
          S.note(th, `${nameOf(S, R.pl(pid))} talked ${th.names.kin} round. They've given ${th.names.a} and ${th.names.b} their blessing.`, { by: pid, news: [th.sid] });
          return { lines: [pick(rng, ['...They do love each other. Anyone can see it. Fine. FINE. They have my blessing. Don\'t tell them I cried.', 'Maybe I\'ve been a fool. Maybe I was afraid of losing them. Go on, tell them yes.'])] };
        }
        tr.set = Math.min(1, tr.set + 0.05);
        return { lines: [pick(rng, ['No. And that\'s the end of it.', 'You don\'t know this family. Stay out of it.', 'I said no. I meant no.'])] };
      }
      default:
        return null;
    }
  },
});

// A courtship's trouble, a day on.
function troubleDay(th, S, rng, a, b, L, tr) {
  const days = (S.now - tr.since) / DAY;
  switch (tr.kind) {
    case 'shy': {
      // (Courage comes, or a friend nudges, or nobody does.)
      const s = tr.who === 'a' ? a : b;
      if (days > 2 && rng.chance(0.08 + nat(s, 'bravery') * 0.15)) {
        th.vars.trouble = null;
        for (const t of S.tasksOf(th, 'word')) S.closeTask(t, 'void');
        S.note(th, pick(rng, [`${th.names[tr.who]} finally said it, out loud, in the middle of the market.`, `A friend of ${th.names[tr.who]}'s told on them. It worked out.`, `${th.names[tr.who]} left a flower on a doorstep every morning for a week, until they were caught at it.`]));
      }
      if (days > 12) th.vars[`h${tr.who === 'a' ? 'b' : 'a'}`] -= 0.03;
      break;
    }
    case 'rival': {
      const c = recOf(S, th.cast.rival);
      if (!c || !alive(c)) {
        th.vars.trouble = null;
        return;
      }
      tr.hc = clamp01((tr.hc || 0.4) + rng.float(-0.05, 0.07) + (has(c, 'romantic') ? 0.02 : 0));
      if (tr.gaveUp) {
        c.courting = null;
        th.vars.trouble = null;
        th.vars.hb = clamp01(th.vars.hb + 0.1);
        return;
      }
      // (A few days of it, and the one they both want chooses.)
      if (days > 4 && rng.chance(0.3)) {
        if (tr.hc > th.vars.hb + 0.1) {
          tr.won = 'rival';
          return S.go(th, 'parted');
        }
        c.courting = null;
        th.vars.trouble = null;
        S.note(th, `${th.names.b} chose ${th.names.a}. ${th.names.rival} ${pick(rng, ['wished them well, through their teeth.', 'left town for a while.', 'got roaring drunk and sang under ' + th.names.b + '\'s window. Then went home.'])}`);
      }
      break;
    }
    case 'kin':
    case 'feud': {
      const k = recOf(S, th.cast.kin);
      if (tr.kind === 'feud') {
        const f = S.thread(th.vars.feud);
        // (The feud over, one way or the other.)
        if (!f || f.done) {
          if (f && f.outcome === 'blood') {
            th.vars.ha -= 0.3;
            th.vars.hb -= 0.3;
            S.note(th, 'Blood has been spilt between their families. Whatever was between them may not survive it.');
          } else S.note(th, 'With the feud over, they needn\'t meet in secret.');
          th.vars.trouble = null;
        }
        return;
      }
      if (!k || !alive(k)) {
        th.vars.trouble = null;
        S.note(th, `With ${th.names.kin} gone, there's nobody to stand in their way. It's a sad sort of freedom.`);
        return;
      }
      // (Kind hearts soften; hard ones harden; and two lovers kept apart
      // long enough may not wait.)
      tr.set = Math.max(0, tr.set - nat(k, 'kindness') * 0.04 + (has(k, 'stubborn') ? 0.01 : 0) + rng.float(-0.03, 0.02));
      if (tr.set <= 0.15) {
        th.vars.trouble = null;
        for (const t of S.tasksOf(th, 'blessing')) S.closeTask(t, 'void');
        S.note(th, pick(rng, [`${th.names.kin} came round on their own, in the end: "I was young once."`, `${th.names.kin} saw them together at the well, and something in their face changed.`]));
        return;
      }
      if (days > 6 && th.vars.ha > 0.75 && th.vars.hb > 0.75 && (has(a, 'romantic') || has(b, 'romantic') || nat(a, 'bravery') > 0.65) && rng.chance(0.12)) S.go(th, 'eloped');
      break;
    }
    case 'doubt': {
      // (Time does it too, sometimes; or the doubt wins.)
      if (days > 5 && rng.chance(0.08)) {
        th.vars.trouble = null;
        for (const t of S.tasksOf(th, 'gift')) S.closeTask(t, 'void');
        S.note(th, `${th.names.b}'s doubts went the way doubts go. No gift was needed in the end.`);
      } else th.vars.hb -= 0.015;
      break;
    }
    case 'secret': {
      if (tr.what === 'past') {
        // (The old love: answered, or not.)
        if (days > 3 && rng.chance(0.25)) {
          th.vars.trouble = null;
          if (th.vars.hb > 0.5 || rng.chance(0.5)) S.note(th, `${th.names.b} wrote back to their old love: "No." Then showed ${th.names.a} the letter.`);
          else {
            th.vars.hb -= 0.4;
            S.note(th, `${th.names.b} has been writing to their old love. ${th.names.a} found the letters.`);
          }
        }
      } else if (tr.what === 'promised') {
        tr.set = Math.max(0, (tr.set || 0.5) - 0.05);
        if (tr.set <= 0.2) {
          th.vars.trouble = null;
          S.note(th, `The old promise was let go. ${pick(rng, ['A letter came saying the other party had married someone else years ago.', 'Their family gave in.', 'Nobody could find the paper it was written on.'])}`);
        }
      } else if (tr.what === 'debt' && days > 6 && rng.chance(0.15)) {
        th.vars.trouble = null;
        if (rng.chance(0.5)) S.note(th, `${th.names.a} and ${th.names.b} paid off the debt together, coin by coin. It brought them closer.`);
        else {
          th.vars.ha -= 0.2;
          S.note(th, `The debt's been paid, by ${th.names.a}. They're still sore that they weren't told.`);
        }
      }
      break;
    }
    default:
  }
  void L;
}

// The day of the wedding: a twist, now and then.
function weddingTwist(th, S, rng, L, ev) {
  th.vars.twisted = true;
  switch (th.vars.twist) {
    case 'feet': {
      // Cold feet: they come back, or they don't.
      if (th.vars.hb > 0.85 || rng.chance(0.55)) {
        S.note(th, `On the morning of the wedding ${th.names.b} went missing. They were found at the edge of town, staring at the road. They came back. "I just needed to be sure," they said. They are.`);
        return;
      }
      th.vars.jilted = true;
      S.sim.events.cancel(L, ev, S.now);
      const a = recOf(S, th.cast.a);
      if (a) a.mood = Math.max(0, (a.mood ?? 0.5) - 0.5);
      S.end(th, 'jilted', `${th.names.b} didn't come to their own wedding. They'd left town at dawn, with a note: "I'm sorry. I'm so sorry." ${th.names.a} waited by the square until dark.`, { news: [th.sid] });
      return;
    }
    case 'objection': {
      const who = th.names.rival || th.names.kin || 'someone at the back';
      if (rng.chance(0.75)) S.note(th, `When the priest asked if anyone objected, ${who} stood up. ${pick(rng, ['And then sat down again, and said "No. Sorry. Carry on."', 'Everyone turned to look. They walked out, and the wedding went on.', `${th.names.a} said "Sit DOWN." They sat down.`])}`);
      else {
        th.vars.jilted = true;
        S.sim.events.cancel(L, ev, S.now);
        S.end(th, 'broken', `When the priest asked if anyone objected, ${who} stood and told the whole square something nobody had known. The wedding was called off.`, { news: [th.sid] });
      }
      return;
    }
    case 'storm':
      S.note(th, `It poured on the wedding day. ${pick(rng, ['They were married soaked to the skin, laughing.', 'Everyone crowded under the tavern eaves, and the priest shouted the vows over the rain.', 'A rainbow came out just as they kissed. People will talk of it for years.'])}`);
      return;
    case 'gift':
      S.note(th, `On the wedding morning, a gift came from nobody knew where: ${pick(rng, ['a cradle, carved with flowers', 'a goat, with a ribbon on', 'a purse of silver and no name', 'a song, sung under the window by a stranger who then left'])}.`);
      return;
    default:
  }
}

function wedded(th, S, rng, L) {
  free(S, th);
  // (Two families at war, joined: the feud may end here.)
  const f = th.vars.feud ? S.thread(th.vars.feud) : null;
  if (f && !f.done && rng.chance(0.6)) {
    S.join(th, f, `The wedding of ${th.names.a} and ${th.names.b} ended the feud: the two families drank together, warily, and then less warily.`);
  }
  S.end(th, 'wed', pick(rng, [
    `${th.names.a} and ${th.names.b} were married. ${pick(rng, ['They danced until the lanterns burnt out.', 'The whole town came.', 'They looked at each other the whole time as if nobody else was there.'])}`,
    `${th.names.a} and ${th.names.b} are married now. ${pick(rng, ['Somebody cried. Several people cried.', 'The pie was very good.', 'They\'ve set up home together.'])}`,
  ]), { news: [th.sid] });
  void L;
}

// ------------------------------------------------------------ a child on the way
const CRADLE_WOOD = ['oak_planks', 'birch_planks', 'pine_planks', 'planks'];

motif({
  id: 'newborn',
  family: 'hearts',
  max: 6,
  key: (o) => `newborn:${o.cast.a.sid}:${o.cast.a.idx}`,
  title: (th) => `A Child for ${th.names.a.split(' ')[0]} and ${th.names.b.split(' ')[0]}`,
  nodes: {
    expecting: {
      enter(th, S) {
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        const L = layoutOf(S, th.sid);
        if (!a || !b || !L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xbab);
        a.expecting = th.id;
        b.expecting = th.id;
        th.vars.due = S.day + rng.int(5, 9);
        th.vars.twins = rng.chance(0.12);
        th.vars.hard = S.choose(th, [{ to: false, w: 4 }, { to: true, w: 1 + (S.thread && S.live().some((t) => t.m === 'fever' && t.sid === th.sid) ? 2 : 0) }], rng).to;
        const kids = (a.children || []).filter((i) => L.npcs[i] && alive(L.npcs[i])).length;
        S.note(th, say(rng, kids ? [
          '{a} and {b} are expecting again. Their little ones are beside themselves.',
          'Another on the way for {a} and {b}. "We\'ll need a bigger table," says {a}.',
        ] : [
          '{a} and {b} are expecting their first child. {b} has been telling everyone, twice.',
          '{a} and {b} are going to be parents! {a} has started building things. Badly.',
          'There\'s to be a baby for {a} and {b}. Their families are already arguing about names.',
        ], { a: fullName(a), b: fullName(b) }), { news: [th.sid] });
        // The cradle: the carpenter's to make, if someone brings the wood.
        const carp = L.npcs.find((r) => alive(r) && !r.away && r.job === 'carpenter');
        const wood = CRADLE_WOOD.find((k) => ITEMS[k]) || 'stick';
        if (carp || rng.chance(0.6)) {
          const giver = carp ? R.rec(th.sid, carp.idx) : th.cast.a;
          const t = S.post(th, {
            role: 'cradle', kind: 'fetch', title: `Bring ${carp ? first(carp) : first(a)} 6 ${ITEMS[wood].name.toLowerCase()} for a cradle`, sid: th.sid, giver, item: wood, n: 6,
            pitch: carp ? `${first(a)} and ${first(b)} want a cradle, and I've no seasoned wood left. Six of ${ITEMS[wood].name.toLowerCase()}, and I'll make one fit for a prince.` : `I'm making the cradle myself. Don't laugh. I need six of ${ITEMS[wood].name.toLowerCase()}, and I can't leave ${first(b)} long enough to fetch them.`,
            reward: { coins: 8, rep: 12, fame: 0.5 },
          });
          t.offerLabel = carp ? 'Busy? What are you making?' : 'You look like a worried parent.';
        }
        th.vars.who = rng.chance(0.5) ? 'a' : 'b';
      },
      day(th, S, rng) {
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        if (!a || !b || !alive(a) || !alive(b)) return S.end(th, 'grief', `${(!a || !alive(a)) ? th.names.a : th.names.b} died before the child came. ${pick(rng, ['The family carries on, somehow.', 'The whole street helps where it can.'])}`);
        if (S.day >= th.vars.due) S.go(th, th.vars.hard ? 'labour' : 'born');
      },
      fade: 14,
    },
    // A hard birth: the midwife (the herbalist, or the priest) needs herbs,
    // quickly.
    labour: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const rng = S.rng(th, 0x1ab);
        const heal = L && (L.npcs.find((r) => alive(r) && !r.away && r.job === 'herbalist') || L.npcs.find((r) => alive(r) && !r.away && r.job === 'priest'));
        th.vars.healer = heal ? fullName(heal) : null;
        S.note(th, `The baby's coming, and it's not coming easily. ${heal ? `${fullName(heal)} is with them, and sent for herbs.` : 'There\'s no healer in town.'}`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'herbs', kind: 'fetch', title: `Bring herbs to ${heal ? first(heal) : th.names.a}, quickly`, sid: th.sid, giver: heal ? R.rec(th.sid, heal.idx) : th.cast.a, item: 'herb', n: 3, days: 1,
          pitch: say(rng, ['Herbs! Three, the bitter kind. NOW, if you love anyone in this town.', 'It\'s going badly. I need herbs, three at least, before nightfall.'], {}),
          reward: { coins: 10, rep: 20, renown: th.sid, renownPts: 3, renownWhy: 'helping bring a child into the world', fame: 1 },
        });
        t.offerLabel = 'What\'s wrong? Is it the baby?';
      },
      day(th, S, rng) {
        // (A day without the herbs: it goes as it goes.)
        if ((S.now - th.nodeAt) / DAY < 1) return;
        th.vars.risk = true;
        S.go(th, 'born');
        void rng;
      },
    },
    born: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const a = recOf(S, th.cast.a);
        const b = recOf(S, th.cast.b);
        const rng = S.rng(th, 0xb04);
        if (!L || !a || !b) return S.end(th, 'faded');
        a.expecting = null;
        b.expecting = null;
        // (A hard birth nobody helped with: it may end in sorrow.)
        if (th.vars.risk && rng.chance(0.35)) {
          a.mood = Math.max(0, (a.mood ?? 0.5) - 0.5);
          b.mood = Math.max(0, (b.mood ?? 0.5) - 0.5);
          return S.end(th, 'lost', `The child didn't live. ${th.names.a} and ${th.names.b} ${pick(rng, ['have closed their shutters.', 'buried them under the apple tree.', 'have had the whole town at their door with food.'])}`, { news: [th.sid] });
        }
        const born = [bear(S.sim, L, a, b, S.day, rng.int(0, 1e9))];
        if (th.vars.twins) born.push(bear(S.sim, L, a, b, S.day, rng.int(0, 1e9)));
        const names = born.filter(Boolean).map((r) => r.name.first);
        // Named for someone who helped, now and then.
        const helper = Object.keys(th.touched)[0];
        if (helper && born[0] && rng.chance(0.3)) {
          const nm = nameOf(S, R.pl(helper)).split(' ')[0];
          if (nm && nm.length < 14) {
            born[0].name.first = nm;
            names[0] = nm;
            S.tell(helper, `${th.names.a} and ${th.names.b} have named their child ${nm}, after you.`, '#ffd0e8');
          }
        }
        S.end(th, 'born', `${names.length > 1 ? `Twins! ${names.join(' and ')}` : `A baby, ${names[0]}`}, born to ${th.names.a} and ${th.names.b}. ${pick(rng, ['Mother, father and child are well.', 'The whole street came round with soup.', 'Loud, healthy, and already the centre of the world.', th.vars.risk ? 'It was close. Very close.' : 'It came easy, in the end.'])}`, { news: [th.sid] });
      },
    },
  },
  tasks: {
    cradle: {
      done(th, t, by, S) {
        S.note(th, `${nameOf(S, by)} brought the wood. The cradle is ${pick(S.rng(th, 4), ['carved with little birds', 'painted blue', 'too big, but nobody minds', 'rocking already, empty, in the corner'])}.`);
        const a = recOf(S, th.cast.a);
        if (a) a.mood = Math.min(1, (a.mood ?? 0.5) + 0.15);
      },
      thanks: () => ['There. Now I can make something worth sleeping in.'],
    },
    herbs: {
      done(th, t, by, S) {
        th.vars.hard = false;
        th.vars.risk = false;
        S.note(th, `${nameOf(S, by)} ran the herbs in. It was close, but it's turned.`);
        S.go(th, 'born');
      },
      thanks: () => ['Just in time. Just in time. Go and sit down, you look worse than they do.'],
    },
  },
  meets: [
    // (Fever in the town: a hard birth is likelier.)
    { m: 'fever', when: (a, b) => a.node === 'expecting' && b.sid === a.sid, then(a, b, S) { a.vars.hard = true; S.note(a, 'With the fever about, the midwife is worried.'); } },
  ],
  ended(th, S) {
    for (const k of ['a', 'b']) {
      const r = recOf(S, th.cast[k]);
      if (r && r.expecting === th.id) r.expecting = null;
    }
  },
});

// ------------------------------------------------------------ making it up
const RIFTS = [
  ['a word said at a funeral', 'what was said at the funeral'], ['a debt never paid back', 'the money'], ['a will that left one of them everything', 'the will'],
  ['a marriage one of them wouldn\'t bless', 'the wedding'], ['a farm sold without asking', 'the farm'], ['a lie told years ago', 'the lie'], ['nobody remembers what, any more', 'whatever it was'],
];

motif({
  id: 'reconcile',
  family: 'hearts',
  max: 4,
  key: (o) => `reconcile:${o.cast.x.sid}:${o.cast.x.idx}`,
  title: (th) => `${th.names.x}'s Silence`,
  scan(S, rng) {
    if (!rng.chance(0.07)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      // Two of a family (brother and sister, parent and child) not speaking.
      const ppl = adults(L);
      const x = rng.pick(ppl.filter((r) => nat(r, 'temper') > 0.4 || has(r, 'proud') || has(r, 'stubborn')));
      if (!x) continue;
      const y = ppl.find((r) => r !== x && blood(r, x) && r.household !== x.household);
      if (!y) continue;
      const [why, short] = rng.pick(RIFTS);
      return { cast: { x: R.rec(L.settlement.id, x.idx), y: R.rec(L.settlement.id, y.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { why, short, years: rng.int(2, 15) } };
    }
    return null;
  },
  nodes: {
    silence: {
      enter(th, S) {
        const rng = S.rng(th, 0x5e1);
        if (th.vars.why === 'eloped') {
          // (Come of an elopement: the one left behind, and the one who ran.)
          th.vars.short = 'the night they left';
          S.note(th, `${th.names.x} hasn't said ${th.vars.who}'s name since the night they ran off. ${pick(rng, ['But they keep the letters, unopened.', 'But they set a place at the table, every feast day.', 'Not once.'])}`);
          th.vars.cool = th.vars.cool || 5;
          return;
        }
        S.note(th, say(rng, [
          '{x} and {y} haven\'t spoken in {n} years, not since {w}.',
          '{x} crosses the street when {y} comes. It\'s been {n} years: {w}.',
          'Ask {x} about {y} and you\'ll get a cold look. {n} years, over {w}.',
        ], { x: th.names.x, y: th.names.y, n: th.vars.years, w: th.vars.why }));
        // Who wants it mended: one of them, or someone who loves them both.
        const L = layoutOf(S, th.sid);
        const x = recOf(S, th.cast.x);
        const y = recOf(S, th.cast.y);
        if (!L || !x || !y) return S.end(th, 'faded');
        const softer = nat(x, 'kindness') > nat(y, 'kindness') ? 'x' : 'y';
        const mid = kinOf(L, x).find((k) => kinOf(L, y).includes(k) && k !== x && k !== y);
        const giver = mid && rng.chance(0.6) ? R.rec(th.sid, mid.idx) : th.cast[softer];
        th.vars.asker = mid && giver.idx === mid.idx ? 'mid' : softer;
        if (th.vars.asker === 'mid') {
          th.cast.mid = giver;
          th.names.mid = fullName(mid);
        }
        const hard = softer === 'x' ? 'y' : 'x';
        th.vars.hard = hard;
        const tk = S.post(th, {
          role: 'mend', kind: 'deliver', title: `Carry a letter to ${th.names[hard]}, to mend things with ${th.vars.asker === 'mid' ? `${th.names[softer]}` : `${first(recOf(S, th.cast[softer]))}`}`, sid: th.sid, giver, target: th.cast[hard],
          pitch: th.vars.asker === 'mid'
            ? say(rng, ['{x} and {y} are both too proud to go first. I\'ve written as if it came from {s}. Don\'t tell them. Just take it to {h}.', 'I\'m tired of two family dinners. Take this to {h}, would you? It might help. It might not.'], { x: th.names.x, y: th.names.y, s: th.names[softer], h: th.names[hard] })
            : say(rng, ['I\'ve written to {h}. It took me {n} years. I can\'t take it to them myself: I\'d turn round at the door.', 'This letter is {n} years late. Would you carry it to {h}? If they tear it up, at least I tried.'], { h: th.names[hard], n: th.vars.years }),
          reward: { coins: 0, rep: 15, renown: th.sid, renownPts: 2, renownWhy: 'mending a family', fame: 1 },
        });
        tk.offerLabel = pick(rng, ['You look like you\'re carrying something heavy.', 'Is something wrong at home?']);
        tk.item = S.writeNote(th, 'letter', `To ${th.names[hard]}`, [pick(rng, [
          `I was wrong about ${th.vars.short}. Or I was right, and it doesn't matter any more. Either way, I miss you. - ${th.names[softer]}`,
          `It's been ${th.vars.years} years. I don't want it to be ${th.vars.years + 1}. Come to supper. - ${th.names[softer]}`,
          `I still have the knife you gave me when we were small. I've been meaning to tell you that for ${th.vars.years} years. - ${th.names[softer]}`,
        ])]);
        tk.n = 1;
        th.vars.letter = tk.item;
      },
      day(th, S, rng) {
        const x = recOf(S, th.cast.x);
        if (!x || !alive(x)) return S.end(th, 'too late', `${th.names.x} died before it was mended. ${pick(rng, ['At the funeral, the other wept harder than anyone.', 'There was a letter in their things, half written.'])}`);
        if (th.vars.why === 'eloped') {
          // (Time softens the one left behind, or it doesn't.)
          th.vars.cool -= nat(x, 'kindness') * 0.6 + rng.float(0, 0.4);
          if (th.vars.cool <= 0) {
            if (rng.chance(0.6 + nat(x, 'kindness') * 0.3)) {
              x.mood = Math.min(1, (x.mood ?? 0.5) + 0.3);
              return S.end(th, 'mended', `${th.names.x} has written to ${th.vars.who}, at last. ${pick(rng, ['They\'re going to visit in the spring.', 'There was a reply within the week, and a drawing of a grandchild.', 'Three words: "Come home sometime."'])}`, { news: [th.sid] });
            }
            return S.end(th, 'hardened', `${th.names.x} burnt ${th.vars.who}'s letters, all of them, unread.`);
          }
          return;
        }
        const y = recOf(S, th.cast.y);
        if (!y || !alive(y)) return S.end(th, 'too late', `${th.names.y} died before it was mended. ${th.names.x} ${pick(rng, ['didn\'t go to the funeral, and regrets it.', 'went to the funeral, and stood at the back.'])}`);
        if ((S.now - th.nodeAt) / DAY > 18) S.end(th, 'unmended', `${th.names.x} and ${th.names.y} still aren't speaking. Some things don't mend.`);
      },
      fade: 24,
    },
    // The letter's been read: a meeting, or not.
    meeting: {
      enter(th, S) {
        const rng = S.rng(th, 0x3e7);
        const hard = recOf(S, th.cast[th.vars.hard]);
        const go = !hard ? 'no' : S.choose(th, [
          { to: 'yes', w: 1 + nat(hard, 'kindness') + (th.vars.nudged || 0) },
          { to: 'no', w: nat(hard, 'temper') + (has(hard, 'proud') ? 0.5 : 0) + (has(hard, 'stubborn') ? 0.5 : 0) },
          { to: 'worse', w: nat(hard, 'temper') * 0.3 },
        ], rng).to;
        if (go === 'yes') {
          for (const k of ['x', 'y']) {
            const r = recOf(S, th.cast[k]);
            if (r) r.mood = Math.min(1, (r.mood ?? 0.5) + 0.3);
          }
          return S.end(th, 'mended', say(rng, [
            '{x} and {y} met at the tavern. Nobody heard what was said. They left together, an arm round each other\'s shoulders.',
            '{h} read the letter twice, then walked straight to {s}\'s door. They talked till dawn.',
            'They had supper together, {x} and {y}, for the first time in {n} years. It was awkward. Then it wasn\'t.',
          ], { x: th.names.x, y: th.names.y, h: th.names[th.vars.hard], s: th.names[th.vars.hard === 'x' ? 'y' : 'x'], n: th.vars.years }), { news: [th.sid] });
        }
        if (go === 'worse') {
          // (Torn for good: and maybe more than words.)
          S.end(th, 'torn', `${th.names[th.vars.hard]} tore the letter up in the street. Things are worse between them than ever.`, { news: [th.sid] });
          const a = recOf(S, th.cast.x);
          const b = recOf(S, th.cast.y);
          if (a && b && a.name.last !== b.name.last && rng.chance(0.4)) S.split(th, 'feud', { cast: { a: th.cast.x, b: th.cast.y, town: R.town(th.sid) }, sid: th.sid, vars: { why: th.vars.why, fa: a.name.last, fb: b.name.last, step: 1 } });
          return;
        }
        S.note(th, `${th.names[th.vars.hard]} read the letter, and put it in a drawer. ${pick(rng, ['Not yet, they said.', 'They haven\'t said no.', 'Maybe one day.'])}`);
        th.vars.waits = (th.vars.waits || 0) + 1;
        if (th.vars.waits > 2) return S.end(th, 'unmended', 'Some things don\'t mend.');
        S.go(th, 'pause');
      },
    },
    pause: {
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY > 3 && rng.chance(0.4)) S.go(th, 'meeting');
      },
      fade: 12,
    },
  },
  tasks: {
    mend: {
      accepted(th, t, who, S) {
        if (who.t === 'pl' && th.vars.letter) S.give(who.pid, th.vars.letter, 1);
      },
      done(th, t, by, S) {
        S.go(th, 'meeting');
      },
      thanks: (th) => [`From ${th.vars.asker === 'mid' ? th.names[th.vars.hard === 'x' ? 'y' : 'x'] : 'them'}? ...After all this time.`],
    },
  },
  townTalk(th, npc, pid, S) {
    if (th.node !== 'silence' || !isRec(npc, th.cast[th.vars.hard || 'x']) || th.vars.nudgedBy === pid) return [];
    return [{ id: 'sgr_nudge', arg: tid(th), label: `Life's short. Talk to ${first(recOf(S, th.cast[th.vars.hard === 'x' ? 'y' : 'x']))}.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgr_nudge') return null;
    const rng = S.rng(th, 0x2d9);
    th.vars.nudgedBy = pid;
    S.touch(th, pid);
    if (persuade(S, npc, rng, 0.25, nat(npc.rec, 'temper') * 0.4)) {
      th.vars.nudged = (th.vars.nudged || 0) + 1;
      return { lines: [pick(rng, ['...I know. I know it is.', 'Maybe. Maybe I will.', 'You sound like my mother.'])] };
    }
    return { lines: [pick(rng, ['Not one more word about it.', 'You don\'t know what they did.'])] };
  },
});

// ------------------------------------------------------------ an elder's last wish
const WISHES = [
  { k: 'sea', text: 'to see the sea once more, before the end', title: 'See the Sea', task: 'escort' },
  { k: 'dish', text: 'to taste {dish} again, the way their mother made it', title: 'A Taste of Home', task: 'fetch' },
  { k: 'song', text: 'to hear music played for them, just once more', title: 'One More Song', task: 'play' },
  { k: 'sword', text: 'to hold the old family {thing} again, lost years ago', title: 'The Old {Thing}', task: 'find' },
  { k: 'letter', text: 'to send word to {friend} in {town}, an old friend they haven\'t seen in forty years', title: 'A Letter to {friend}', task: 'deliver' },
];
const DISHES = [['stew', 'stew'], ['apple_tart', 'apple tart'], ['pie', 'pie'], ['chowder', 'chowder'], ['oatcakes', 'oatcakes'], ['goulash', 'goulash'], ['smoked_fish', 'smoked fish']];

motif({
  id: 'last_wish',
  family: 'hearts',
  max: 3,
  ended(th, S) {
    const e = recOf(S, th.cast.elder);
    if (e && th.vars.walking && alive(e)) e.away = false;
    if (e && e.wish === th.id) e.wish = null;
  },
  key: (o) => `wish:${o.cast.elder.sid}:${o.cast.elder.idx}`,
  title: (th) => `${th.names.elder}'s Last Wish: ${th.vars.title}`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const old = living(L).filter((r) => r.age === 'elder' && !r.wish);
      if (!old.length) continue;
      const e = rng.pick(old);
      const w = rng.pick(WISHES);
      const vars = { wish: w.k, task: w.task, years: rng.int(20, 60), left: rng.int(6, 14) };
      if (w.k === 'dish') {
        const d = rng.pick(DISHES.filter(([k]) => ITEMS[k]));
        vars.dish = d ? d[0] : 'stew';
        vars.dishName = d ? d[1] : 'stew';
      }
      if (w.k === 'sword') vars.thing = rng.pick(['sword', 'ring', 'locket', 'pipe', 'fiddle']);
      if (w.k === 'letter') {
        const far = laidTowns(S).filter((T) => T !== L);
        if (!far.length) continue;
        const T = rng.pick(far);
        const f = adults(T).find((r) => r.age === 'elder') || adults(T)[0];
        if (!f) continue;
        vars.friendRef = R.rec(T.settlement.id, f.idx);
        vars.friend = fullName(f);
        vars.town = T.settlement.name;
      }
      vars.title = w.title.replace('{Thing}', vars.thing ? vars.thing[0].toUpperCase() + vars.thing.slice(1) : '').replace('{friend}', vars.friend || '');
      vars.text = w.text.replace('{dish}', vars.dishName || '').replace('{thing}', vars.thing || '').replace('{friend}', vars.friend || '').replace('{town}', vars.town || '');
      return { cast: { elder: R.rec(L.settlement.id, e.idx), town: R.town(L.settlement.id), friend: vars.friendRef || null }, sid: L.settlement.id, vars };
    }
    return null;
  },
  nodes: {
    wishing: {
      enter(th, S) {
        const e = recOf(S, th.cast.elder);
        const L = layoutOf(S, th.sid);
        if (!e || !L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x11e);
        e.wish = th.id;
        // (Who asks: the elder, or a grandchild on their behalf.)
        const kid = kinOf(L, e).find((k) => (k.parents || []).some((p) => (e.children || []).includes(p))) || kinOf(L, e).find((k) => (e.children || []).includes(k.idx));
        const giver = kid && rng.chance(0.5) ? R.rec(th.sid, kid.idx) : th.cast.elder;
        th.vars.byKin = giver !== th.cast.elder;
        S.note(th, `${th.names.elder} is very old now, and has one wish left: ${th.vars.text}.`);
        const w = th.vars.wish;
        const o = { sid: th.sid, giver, reward: { coins: 5, rep: 20, renown: th.sid, renownPts: 3, renownWhy: `granting ${first(e)}'s last wish`, fame: 1.5 } };
        const asker = th.vars.byKin ? `${first(kid)}, for ${first(e)}` : first(e);
        let t;
        if (w === 'dish') t = S.post(th, { ...o, role: 'wish', kind: 'fetch', item: th.vars.dish, n: 1, title: `Bring ${asker} ${ITEMS[th.vars.dish] ? ITEMS[th.vars.dish].name.toLowerCase() : 'a dish'}`, pitch: th.vars.byKin ? `Grandmother keeps talking about ${th.vars.dishName}, the way her mother made it. I can't cook. Can you? Or find some? It would mean the world.` : `${th.vars.dishName[0].toUpperCase() + th.vars.dishName.slice(1)}. My mother made it every winter. I'd like to taste it once more. Is that silly?` });
        else if (w === 'song') t = S.post(th, { ...o, role: 'wish', kind: 'talk', title: `Play music for ${first(e)}`, pitch: th.vars.byKin ? `${first(e)} used to dance every night. Now they can't. But they'd love to hear someone play. Do you have an instrument?` : 'Do you play? Anything. I used to dance, you know. Long ago. I\'d like to hear music played for me, once more.' });
        else if (w === 'sword') {
          th.vars.spot = null;
          t = S.post(th, { ...o, role: 'wish', kind: 'fetch', item: 'heirloom', n: 1, title: `Find ${first(e)}'s lost ${th.vars.thing}`, pitch: `The family ${th.vars.thing}. ${rng.pick(['Lost in a flood when I was a girl.', 'My brother sold it for drink, forty years ago.', 'Taken by outlaws, the year the barn burnt.'])} Someone has it somewhere. A trader, maybe. I'd like to hold it, once.` });
          t.data.hint = rng.pick(['a merchant on the road', 'an old outlaw camp', 'the ruins out past the hills']);
        } else if (w === 'letter') t = S.post(th, { ...o, role: 'wish', kind: 'deliver', target: th.cast.friend, title: `Carry ${first(e)}'s letter to ${th.vars.friend} in ${th.vars.town}`, pitch: `I've written to ${th.vars.friend}. We were inseparable, once. Forty years... Would you take it? I'd like to know they read it.` });
        else t = S.post(th, { ...o, role: 'wish', kind: 'talk', title: `Take ${first(e)} to see the sea`, pitch: th.vars.byKin ? `${first(e)} grew up by the sea. They talk about it all the time now. They can't go alone. Would you take them?` : 'I was born by the sea. I\'d like to see it once more. My legs are bad, but they\'ll go if someone walks with me.' });
        t.offerLabel = pick(rng, ['You look like you\'re far away, grandmother.', 'Is there anything I can do for you?', 'You seem sad today.']);
        if (w === 'letter') {
          t.item = S.writeNote(th, 'letter', `To ${th.vars.friend}`, [`Do you remember the summer we stole the miller's boat? I think of it every day now. I'm old, and I don't have long, and I wanted you to know: you were the best friend I ever had. - ${th.names.elder}`]);
          t.n = 1;
          th.vars.letter = t.item;
        }
      },
      live(th, S) {
        if (th.vars.wish === 'sea' && th.vars.walking) seaCheck(th, S);
      },
      day(th, S, rng) {
        const e = recOf(S, th.cast.elder);
        if (!e || !alive(e)) return S.end(th, 'too late', `${th.names.elder} died before their wish was granted.`);
        th.vars.left--;
        if (th.vars.left === 3) S.note(th, `${th.names.elder} is weaker. ${pick(rng, ['They don\'t leave their bed now.', 'They sleep most of the day.', 'They ask every morning if there\'s news.'])}`);
        if (th.vars.left <= 0) {
          const L = layoutOf(S, th.sid);
          if (L && rng.chance(0.7)) S.sim.recordDeath(L, e, 'old age', null);
          else {
            e.wish = null;
            return S.end(th, 'faded', `${th.names.elder} rallied, against all odds, and stopped talking about wishes. "I'll make a new one next year," they say.`);
          }
          S.end(th, 'too late', `${th.names.elder} died with their wish ungranted. ${pick(rng, ['They didn\'t seem to mind, at the end.', 'Their family wish they\'d tried harder.', 'They said it was enough to have wished it.'])}`, { news: [th.sid] });
        }
      },
      fade: 20,
    },
  },
  tasks: {
    wish: {
      accepted(th, t, who, S) {
        if (who.t === 'pl' && th.vars.letter) S.give(who.pid, th.vars.letter, 1);
        // (The sea: the elder walks with you.)
        if (who.t === 'pl' && th.vars.wish === 'sea') {
          const e = recOf(S, th.cast.elder);
          if (e && e.ent && !e.ent.dead) {
            th.vars.walker = who.pid;
            S.tell(who.pid, `${th.names.elder} takes your arm. (Walk them to the shore: deep water, anywhere. They'll follow you.)`, '#a0e0ff');
          }
        }
      },
      done(th, t, by, S) {
        granted(th, S, by && by.t === 'pl' ? by.pid : null);
      },
      thanks: (th) => (th.vars.wish === 'dish' ? ['...Oh. Oh, that\'s it. That\'s exactly it. I\'m six years old again.'] : th.vars.wish === 'letter' ? ['They read it? ...Then that\'s all I needed.'] : ['Thank you, child. Thank you.']),
    },
  },
  townTalk(th, npc, pid, S) {
    if (!isRec(npc, th.cast.elder) || th.node !== 'wishing') return [];
    const out = [];
    const t = S.tasksOf(th, 'wish')[0];
    if (!t || !S.claimedBy(t, pid)) return out;
    if (th.vars.wish === 'song') {
      const has1 = S.game.player.inv.some((q) => q && ITEMS[q.item] && ITEMS[q.item].instrument);
      if (has1) out.push({ id: 'sgw_play', arg: tid(th), label: 'Sit back. I\'ll play for you.' });
    }
    if (th.vars.wish === 'sea') out.push({ id: 'sgw_walk', arg: tid(th), label: 'Take my arm. Let\'s go and see the sea.' });
    if (th.vars.wish === 'sword') out.push({ id: 'sgw_hint', arg: tid(th), label: `Where might the ${th.vars.thing} be?` });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x77a);
    const t = S.tasksOf(th, 'wish')[0];
    if (id === 'sgw_play') {
      if (!t) return { lines: ['...'] };
      S.complete(t, R.pl(pid));
      if (t.status === 'won') S.turnIn(t, pid);
      return { lines: [pick(rng, ['(They close their eyes, and their fingers tap the blanket in time.)', '(They hum along, cracked and out of tune and very happy.)']), 'That was my wedding song. Did you know? No, how could you. Thank you.'] };
    }
    if (id === 'sgw_walk') {
      // (They come with you: on your arm, till the water's edge.)
      const r = npc.rec;
      th.vars.walker = pid;
      th.vars.walking = true;
      if (!S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
      const at = { x: Math.round(npc.x), z: Math.round(npc.z) };
      r.away = true;
      S.game.despawnNpc(npc);
      S.actor(th, {
        key: 'elder', kind: 'npc', role: 'elder', talk: true, at, stay: true,
        person: { name: r.name, look: r.look, personality: r.personality, traits: r.traits, age: r.age, job: r.job, maxHp: r.maxHp || 12 },
        orders: { home: at, follow: pid, mark: null, lines: ['Slowly, now.', 'Is that gulls I hear?', 'My legs aren\'t what they were. My eyes are, though.', 'Nearly there?'] },
      });
      return { lines: ['Slowly, now. My legs aren\'t what they were.', '(They\'ll follow you. Walk them to the water\'s edge: the sea, or any deep water.)'], close: true };
    }
    if (id === 'sgw_hint') {
      const h = t && t.data.hint;
      return { lines: [h ? `Last anyone saw it, it was with ${h}. And it'd look like... well, you'd know it: it has our mark on it.` : 'I don\'t know. Somewhere.', '(Old heirlooms turn up in ruins, outlaw camps and traders\' packs: an heirloom brought here would do.)'] };
    }
    return null;
  },
});

function granted(th, S, pid) {
  const e = recOf(S, th.cast.elder);
  const rng = S.rng(th, 0x6a7);
  if (e) {
    e.wish = null;
    e.mood = 1;
    if (th.vars.walking) e.away = false;
  }
  S.end(th, 'granted', `${th.names.elder}'s wish was granted${pid ? `, by ${nameOf(S, R.pl(pid))}` : ''}. ${pick(rng, [
    'They smiled all that evening.', 'They said they could go happy now. They didn\'t go, though: they seemed ten years younger, the next morning.', 'They told everyone about it, three times each.',
  ])}`, { news: [th.sid] });
}

// (The sea: an elder walked to the water's edge.)
function seaCheck(th, S) {
  const n = S.actorEnt(th, 'elder');
  if (!n) return;
  const w = S.game.world;
  const x = Math.round(n.x);
  const z = Math.round(n.z);
  let wet = false;
  for (let dx = -2; dx <= 2 && !wet; dx++) for (let dz = -2; dz <= 2 && !wet; dz++) for (const dy of [-1, 0]) if (w.isWaterAt(x + dx, Math.round(n.y) + dy, z + dz)) wet = true;
  if (!wet) return;
  n.say(pick(S.rng(th, 5), ['The sea... it hasn\'t changed at all.', 'Listen to it. Just listen.', 'I can go home now. Thank you.']), 4, '#a0e0ff');
  const pid = th.vars.walker;
  const t = S.tasksOf(th, 'wish')[0];
  if (t && pid) {
    if (!S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
    S.complete(t, R.pl(pid));
    if (t.status === 'won') S.turnIn(t, pid);
  }
}

// ------------------------------------------------------------ home again
const AWAY = [
  { k: 'war', text: 'went to war {n} years ago and was given up for dead', back: 'came walking up the road, thin and scarred and alive' },
  { k: 'sea', text: 'went to sea {n} years ago and never wrote', back: 'came home with a sea-chest, a parrot, and a lot of stories' },
  { k: 'outlaw', text: 'ran off to the outlaws {n} years ago', back: 'came back, hood down, asking for their mother' },
  { k: 'fortune', text: 'left {n} years ago to make their fortune', back: 'came home in a fine coat, or a borrowed one' },
  { k: 'lost', text: 'vanished one winter {n} years ago', back: 'walked in out of the snow, and can\'t say where they\'ve been' },
];

motif({
  id: 'homecoming',
  family: 'hearts',
  max: 3,
  key: (o) => `home:${o.sid}:${o.vars.name}`,
  title: (th) => `${th.vars.name} Comes Home`,
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      // Someone with family here: a son, a daughter, a brother.
      const fam = adults(L).filter((r) => (r.children || []).length || (r.parents || []).length);
      if (!fam.length) continue;
      const kin = rng.pick(fam);
      const a = rng.pick(AWAY);
      const style = L.settlement.style || 'vale';
      return { cast: { kin: R.rec(L.settlement.id, kin.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { away: a.k, text: a.text.replace('{n}', rng.int(3, 20)), back: a.back, style, name: null, seed: rng.int(0, 1e9) } };
    }
    return null;
  },
  nodes: {
    road: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const kin = recOf(S, th.cast.kin);
        if (!L || !kin) return S.end(th, 'faded');
        const rng = S.rng(th, 0x40b);
        // Who they are: kin's child or sibling, with the family name.
        const p = makeReturner(rng, th.vars.style, kin);
        th.vars.person = p;
        th.vars.name = `${p.name.first} ${p.name.last}`;
        S.retitle(th, `${th.vars.name} Comes Home`);
        // What they've come back as.
        th.vars.truth = S.choose(th, [
          { to: 'changed', w: 1.5 },
          { to: 'rich', w: th.vars.away === 'fortune' || th.vars.away === 'sea' ? 1.2 : 0.3 },
          { to: 'hunted', w: th.vars.away === 'outlaw' ? 1.4 : 0.3 },
          { to: 'broken', w: th.vars.away === 'war' ? 1.2 : 0.4 },
          { to: 'impostor', w: th.vars.away === 'lost' ? 1 : 0.25 },
        ], rng).to;
        S.note(th, `${th.vars.name}, who ${th.vars.text}, ${th.vars.back}.`, { news: [th.sid] });
        const at = townMid(L.settlement);
        S.actor(th, {
          key: 'back', kind: 'npc', role: 'returner', talk: true, at, stay: true,
          person: { ...p, title: null },
          orders: { home: at, roam: 6, lines: LINES[th.vars.truth] },
        });
        th.vars.welcome = null;
      },
      day(th, S, rng) {
        const kin = recOf(S, th.cast.kin);
        if (!kin || !alive(kin)) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        if (th.vars.welcome === null && days >= 1) {
          // The family: overjoyed, or not.
          th.vars.welcome = S.choose(th, [
            { to: 'joy', w: 1 + nat(kin, 'kindness') },
            { to: 'cold', w: nat(kin, 'temper') + (th.vars.away === 'outlaw' ? 0.6 : 0) + (has(kin, 'proud') ? 0.3 : 0) },
            { to: 'doubt', w: th.vars.truth === 'impostor' ? 1.5 : 0.2 },
          ], rng).to;
          const w = th.vars.welcome;
          S.note(th, w === 'joy' ? `${th.names.kin} wept, and held on, and wouldn't let go. There was a feast that night.` : w === 'cold' ? `${th.names.kin} looked at ${th.vars.name} a long while, and shut the door.` : `${th.names.kin} isn't sure it's really them. "They had a scar on the left hand," they say. "Not the right."`, { news: [th.sid] });
          if (w === 'doubt') {
            const t = S.post(th, {
              role: 'truth', kind: 'talk', title: `Find out if ${th.vars.name} is who they say`, sid: th.sid, giver: th.cast.kin,
              pitch: `They know things only my ${relWordOf(kin, th)} would know. And they don't know things my ${relWordOf(kin, th)} would never forget. Ask them. Ask them about the summer of the flood.`,
              reward: { coins: 15, rep: 15, fame: 1 },
            });
            t.offerLabel = 'Is everything all right at home?';
          }
          if (w === 'cold' && th.vars.truth !== 'impostor') {
            const t = S.post(th, {
              role: 'welcome', kind: 'talk', title: `Talk ${th.names.kin} round to taking ${th.vars.name} back`, sid: th.sid, giver: null,
              pitch: `${th.vars.name} sleeps in the stable. Their own family won't have them.`,
              reward: { coins: 0, rep: 12, renown: th.sid, renownPts: 2, renownWhy: 'bringing a family back together', fame: 1 },
            });
            t.rumour = `${th.vars.name}'s come home, and their family won't have them`;
          }
        }
        // What they came back as comes out, in time.
        if (days >= 2 && !th.vars.out) {
          th.vars.out = true;
          const truth = th.vars.truth;
          if (truth === 'hunted') {
            S.note(th, `${th.vars.name} didn't just come home: they ran. The band they rode with wants them back, or dead.`);
            const bands = S.sim.bandits.live().filter((b) => b.camp);
            if (bands.length) th.cast.band = R.band(rng.pick(bands).id);
            // (They come by night, a night or two from now.)
            th.vars.huntAt = (S.day + rng.int(1, 2)) * DAY + 22 * 60;
            const t = S.post(th, {
              role: 'guard', kind: 'defend', title: `Stand by ${th.vars.name} when the outlaws come for them`, sid: th.sid, giver: th.cast.kin,
              pitch: `They're coming for ${th.vars.name}, by night, soon. Whatever they did out there, they're ours. Be here when they come? Be near the middle of town after dark.`,
              reward: { coins: 25, from: th.cast.kin, rep: 20, fame: 1 },
            });
            t.offerLabel = 'You look like you haven\'t slept.';
          } else if (truth === 'rich') {
            S.note(th, `${th.vars.name} has money, it turns out: real money. They've paid off the family's debts and bought a round for the whole tavern.`, { news: [th.sid] });
            const L = layoutOf(S, th.sid);
            if (L) L.econ.treasury += 40;
          } else if (truth === 'broken') {
            S.note(th, `${th.vars.name} wakes screaming in the night. Whatever happened to them out there hasn't let go.`);
          } else if (truth === 'impostor' && th.vars.welcome !== 'doubt') {
            S.note(th, `Something about ${th.vars.name}'s stories doesn't add up. Small things. A name wrong here, a date there.`, { hidden: true });
          }
        }
        if (th.vars.huntAt && !th.vars.hunt && S.now >= th.vars.huntAt) hunters(th, S, rng);
        if (days > 8 && th.vars.hunt !== 'on') settle(th, S, rng);
      },
      // (The hunters, come by night: met, if you're there.)
      hour(th, S, rng) {
        if (th.vars.huntAt && !th.vars.hunt && S.now >= th.vars.huntAt) hunters(th, S, rng);
        if (th.vars.hunt === 'on' && S.now > th.vars.huntAt + 8 * 60) {
          // (Dawn: those still standing slink off.)
          th.vars.hunt = 'over';
          for (const a of th.actors) if (a.role === 'hunter' && !a.gone) S.dismissActor(th, a.key);
          S.note(th, `The outlaws who came for ${th.vars.name} melted away at dawn. They may not be back.`);
        }
      },
      fade: 14,
    },
  },
  actorDown(th, a, by, S) {
    if (a.role !== 'hunter') return;
    const left = th.actors.filter((q) => q.role === 'hunter' && !q.gone && !q.dead);
    if (left.length) return;
    th.vars.hunt = 'beaten';
    const t = S.tasksOf(th, 'guard')[0];
    const pid = by && by.t === 'pl' ? by.pid : Object.keys(th.touched)[0];
    if (t && pid) {
      if (!S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
      S.complete(t, R.pl(pid));
    }
    S.note(th, `The outlaws who came for ${th.vars.name} in the night were beaten off${pid ? `, ${nameOf(S, R.pl(pid))} standing in the door` : ''}.`, { news: [th.sid] });
  },
  tasks: {
    truth: {},
    welcome: {},
    guard: {},
  },
  hello(th, a, npc) {
    return pick(npc.rng, LINES[th.vars.truth] || ['Home. I\'m home.']);
  },
  talk(th, a, npc, pid) {
    const out = [{ id: 'sgh_where', arg: tid(th), label: 'Where have you been all this time?' }];
    if (th.vars.welcome === 'doubt' && !th.vars.tested) out.push({ id: 'sgh_flood', arg: tid(th), label: 'Tell me about the summer of the flood.' });
    void pid;
    return out;
  },
  townTalk(th, npc, pid, S) {
    if (th.vars.welcome !== 'cold' || !isRec(npc, th.cast.kin) || th.vars.welcomed) return [];
    return [{ id: 'sgh_back', arg: tid(th), label: `${th.vars.name} is still your family. Take them back.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x4a1);
    if (id === 'sgh_where') {
      return { lines: [pick(rng, STORIES[th.vars.away] || STORIES.lost), th.vars.truth === 'impostor' && rng.chance(0.4) ? '(They pause a moment too long before each answer.)' : pick(rng, ['Anyway. I\'m back now.', 'I don\'t like to talk about it much.', 'It\'s good to be home. Mostly.'])] };
    }
    if (id === 'sgh_flood') {
      th.vars.tested = true;
      S.touch(th, pid);
      const t = S.tasksOf(th, 'truth')[0];
      if (th.vars.truth === 'impostor') {
        // (Caught out: they run, or they confess.)
        const run = rng.chance(0.5);
        if (t) {
          if (!S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
          S.complete(t, R.pl(pid));
        }
        S.end(th, 'impostor', run ? `${th.vars.name} wasn't who they said. Caught out, they ran in the night, with the family's silver.` : `${th.vars.name} wasn't who they said. They confessed: a soldier who'd served with the real one, and watched them die, and needed a home. ${th.names.kin} ${pick(rng, ['let them stay anyway.', 'sent them on their way, with bread for the road.'])}`, { news: [th.sid] });
        return { lines: run ? ['The... flood. Yes. It was very wet.', '(Their eyes go to the door.)'] : ['...I don\'t know. I wasn\'t there.', 'I knew them, out there. They told me everything. They didn\'t make it. I\'m sorry. I\'m so sorry.'], close: true };
      }
      if (t) {
        if (!S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
        S.complete(t, R.pl(pid));
      }
      th.vars.welcome = 'joy';
      S.note(th, `${th.vars.name} told the story of the flood, the goat on the roof and all. ${th.names.kin} believes them now.`, { by: pid });
      return { lines: ['The flood? The goat on the roof! And mother rowing round the yard in the washtub. How could I forget?'] };
    }
    if (id === 'sgh_back') {
      S.touch(th, pid);
      if (persuade(S, npc, rng, 0.3, nat(npc.rec, 'temper') * 0.4)) {
        th.vars.welcomed = true;
        th.vars.welcome = 'joy';
        const t = S.tasksOf(th, 'welcome')[0];
        if (t) S.complete(t, R.pl(pid));
        S.note(th, `${nameOf(S, R.pl(pid))} talked ${th.names.kin} round. ${th.vars.name} sleeps under their own roof again.`, { by: pid, news: [th.sid] });
        return { lines: ['...They are. Whatever they did. Go on, then. Tell them to come home.'] };
      }
      return { lines: ['You don\'t know what they did. You don\'t know what it did to us.'] };
    }
    return null;
  },
});

const LINES = {
  changed: ['It all looks smaller than I remember.', 'The old oak\'s gone. When did that go?', 'Home.'],
  rich: ['Drinks are on me!', 'Did you know there are cities with streets of glass?', 'Home, and with something to show for it.'],
  hunted: ['*keeps glancing at the road*', 'Have you seen riders? Hooded ones?', 'I just want to be left alone.'],
  broken: ['...', 'Don\'t come up behind me. Please.', 'It\'s quiet here. Good. Quiet is good.'],
  impostor: ['It\'s all just as I remember. Every bit.', 'Oh, yes, I remember YOU.', 'Home sweet home.'],
};
const STORIES = {
  war: ['At the front. Then in a prison camp. Then walking. A long time walking.', 'Everywhere the war went. I don\'t recommend it.'],
  sea: ['Across the water, and the water beyond that. I\'ve seen a fish as big as a church.', 'At sea. Then shipwrecked. Then at sea again. I\'m bad at learning.'],
  outlaw: ['With the wrong sort. I did things. I\'m done with all that.', 'In the hills. You don\'t want to know.'],
  fortune: ['Making my fortune! Losing it. Making it again. You know how it is.', 'In the cities. They\'re loud. I missed the quiet.'],
  lost: ['I don\'t remember. I was in the snow, and then I was walking in, and it was years later.', 'Somewhere. I\'m not sure where.'],
};

function relWordOf(kin, th) {
  return th.vars.person && th.vars.person.rel === 'child' ? 'child' : 'brother';
}

function makeReturner(rng, style, kin) {
  const rel = (kin.children || []).length && rng.chance(0.6) ? 'child' : 'sibling';
  const p = {
    name: { first: rng.pick(['Tobin', 'Mara', 'Edric', 'Sela', 'Jory', 'Wren', 'Hal', 'Isolde', 'Corin', 'Bree', 'Aldo', 'Nell', 'Fen', 'Rosalind', 'Garrick', 'Tamsin']), last: kin.name.last },
    look: { ...kin.look, outfit: rng.pick(['hunter', 'vest', 'rags', 'plain']), hat: rng.pick([null, 'hood', null]) },
    personality: { bravery: rng.float(0.3, 0.9), sociability: rng.float(0.2, 0.8), diligence: 0.5, kindness: rng.float(0.3, 0.8), temper: rng.float(0.2, 0.7) },
    traits: [], age: 'adult', job: 'traveller', maxHp: 22, rel, weapon: null,
  };
  void style;
  return p;
}

// The night the outlaws come: met by whoever's standing by (if anyone is),
// or not.
function hunters(th, S, rng) {
  const L = layoutOf(S, th.sid);
  if (!L) return;
  const mid = townMid(L.settlement);
  const t = S.tasksOf(th, 'guard')[0];
  const by = t ? t.claims.map((c) => c.who).filter((w) => w.t === 'pl').map((w) => w.pid).find((pid) => {
    const q = S.players().find((x) => x.pid === pid);
    return q && Math.max(Math.abs(q.p.x - mid.x), Math.abs(q.p.z - mid.z)) < 70;
  }) : null;
  if (by) {
    th.vars.hunt = 'on';
    const style = L.settlement.style || 'vale';
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.float(0, 1);
      const p = makePersonOutlaw(rng, style);
      S.actor(th, { key: `hunt${i}`, kind: 'npc', role: 'hunter', hostile: true, at: { x: Math.round(mid.x + Math.cos(a) * 16), z: Math.round(mid.z + Math.sin(a) * 16) }, person: p, orders: { target: by, brave: true, cry: pick(rng, [`Where's ${th.vars.name}?`, 'Stand aside!', 'Nobody leaves the band!']) } });
    }
    S.tell(by, `They're here: outlaws, come for ${th.vars.name}.`, '#ff9080');
    return;
  }
  // (Nobody there: it goes as it goes.)
  th.vars.hunt = 'off';
  if (t) S.closeTask(t, 'lapsed');
  const how = S.choose(th, [
    { to: 'guards', w: L.npcs.filter((r) => alive(r) && r.job === 'guard').length * 0.4 },
    { to: 'taken', w: 0.7 },
    { to: 'fled', w: 0.6 },
  ], rng).to;
  if (how === 'guards') return S.note(th, `Outlaws came for ${th.vars.name} in the night. The town's guards drove them off. Mostly.`, { news: [th.sid] });
  if (how === 'taken') return S.end(th, 'taken', `Outlaws came for ${th.vars.name} in the night, and took them. Nobody stood in their way.`, { news: [th.sid] });
  S.end(th, 'gone again', `Outlaws came for ${th.vars.name} in the night. ${th.vars.name} was out of the window and away before they reached the door. Nobody's seen them since.`, { news: [th.sid] });
}

function makePersonOutlaw(rng, style) {
  return makePerson(rng, style, 'outlaw');
}

function settle(th, S, rng) {
  const w = th.vars.welcome;
  if (th.vars.truth === 'impostor' && !th.vars.tested) {
    return S.end(th, 'impostor', `${th.vars.name} left one morning without a word. The family\'s savings went with them. It wasn\'t them at all, it seems, and nobody asked the right questions.`, { news: [th.sid] });
  }
  if (w === 'cold') return S.end(th, 'gone again', `${th.vars.name} left again. ${pick(rng, ['Nobody waved them off.', `${th.names.kin} watched from the window, and didn't come out.`, 'This time they said they wouldn\'t be back.'])}`);
  // (Theirs again: one of the town's own, under the family roof.)
  const L = layoutOf(S, th.sid);
  const kin = recOf(S, th.cast.kin);
  const p = th.vars.person;
  if (L && kin && p) newcomer(S.sim, L, { name: p.name, look: p.look, personality: p.personality, kin, rel: p.rel, why: 'came home' });
  S.end(th, 'home', `${th.vars.name} is home for good. ${pick(rng, ['They\'ve taken up the old trade.', 'They tell their stories at the tavern, for anyone who\'ll buy a drink.', 'You\'d think they\'d never left.'])}`, { news: [th.sid] });
}
