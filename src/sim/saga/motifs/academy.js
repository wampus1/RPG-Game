// Learning (round 54).
//
//   - A term at a city's Academy (see sim/college.js): its masters, its
//     classes day by day (cookery in the kitchen, swordplay in the practice
//     hall, natural philosophy in the lecture room, gem-setting in the
//     workshop), and whoever's enrolled: you (pay the registrar at the desk
//     at the back of the hall), others playing, and the keen of the city
//     and the towns about. Sit through a class and you come out the better
//     at it (practice in it, and something of the master's: a recipe, a
//     cut stone, a problem for the realm's scholars, a bout with the
//     swordmaster). A term has its own turns: a master falls ill (and one
//     of you who knows the subject could take the class), two students
//     can't stand each other, or can't keep away from each other, one
//     can't pay their board, one turns out brilliant. It ends with the
//     masters' judgement, and those who pass graduate in the hall.
//   - A student's journey: someone in a town who's set their heart on the
//     Academy. Their family may help or stand in the way, the money may be
//     found or not, the road may be kind or not; they may study, graduate
//     and come home with a new trade, or come home ashamed, or never come
//     home at all.
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, town, townName, living, adults, fullName, kinOf, recOf, purse, bandsNear } from './lib.js';
import { makePerson } from '../actors.js';
import { alive, DAY, ledger } from '../../econ.js';
import { SUBJECTS, SUBJECT_KEYS, academyOf, foundAcademy, roomAt, roomMid, termSchedule, classNow, nextClass, clock, teachRec, keenness, ATTEND } from '../../college.js';
import { gainMastery, mastery } from '../../../game/mastery.js';
import { cookDish } from '../../../world/dishes.js';
import { learnRecipe } from '../../../game/cooking.js';
import { removeItem } from '../../../game/inventory.js';
import { retrain } from '../../../entities/npcgen.js';
import { RNG, hash4 } from '../../../util/rng.js';
import { ITEMS } from '../../../world/items.js';

const tid = (th) => `t${th.id}`;
const ROOM_WORD = { kitchen: 'the kitchen', yard: 'the practice hall', lecture: 'the lecture room', gems: 'the gem workshop' };
const TERMS = ['the Lantern Term', 'the Harvest Term', 'the Frost Term', 'the Ember Term', 'the Thaw Term', 'the Bell Term', 'the Long Term', 'the Short Term', 'the Midsummer Term', 'the Ink Term'];
// What each master is like, and says as they teach.
const MASTER_KIND = { cooking: 'elder', dueling: 'champion', research: 'scholar', gemcraft: 'scholar' };
const MASTER_TITLE = { cooking: 'Master of Cookery', dueling: 'Swordmaster', research: 'Master of Philosophy', gemcraft: 'Master Setter' };
const LESSON = {
  cooking: [
    'Heat first, then patience. Most cooks have only one of them.',
    'Taste it. Now taste it again. Now tell me what it needs.',
    'Salt early for a stew, late for a roast. Write it down.',
    'A burnt pot teaches more than a good one. Look at it.',
    'No, no: you\'re drowning it. Let it speak for itself.',
    'Who brought onions to a sweet tart? ...Oh. It works. Carry on.',
    'Again! And this time stir as though you mean it.',
  ],
  dueling: [
    'Feet first. A blade is only as good as the feet under it.',
    'Watch the shoulder, not the sword. The shoulder never lies.',
    'Parry late. Later. LATER. There!',
    'You swing like you\'re chopping wood. They\'re not wood.',
    'Breathe out as you strike. Out, I said.',
    'Again. And this time, don\'t look at where you mean to hit.',
    'A good duellist is a patient one. A dead one is usually not.',
  ],
  research: [
    'A question well asked is half answered. Most of you ask badly.',
    'Write down what you see, not what you expected to see.',
    'Why does the ash on Kharos fall grey and not black? Anyone? Anyone?',
    'The Kavorent built those spires for a reason. Find it.',
    'Wrong. Interestingly wrong, though. Go on.',
    'Measure it twice. No: three times. Scholars are not carpenters.',
    'If the numbers agree with you too readily, check the numbers.',
  ],
  gemcraft: [
    'Gently. The stone has waited a thousand years: it can wait for you.',
    'See the line in it? Follow that. Never fight the grain.',
    'A setting holds a stone. It doesn\'t strangle it.',
    'Turn it to the light. Now. That\'s where it wants to be cut.',
    'Steady hands come from a steady breath. And no ale at lunch.',
    'Ruby for fire, sapphire for speed: but the setting decides how much.',
    'You\'ve chipped it. Never mind. Everyone chips their first hundred.',
  ],
};
const ADVICE = {
  cooking: ['Never cook angry. The food knows.', 'Cook what\'s good in the market, not what\'s in the book.', 'A pinch of something unexpected. Then stop.'],
  dueling: ['Make them come to you.', 'Your guard\'s too high when you\'re tired. Everyone\'s is. Watch theirs.', 'A parry at the last instant leaves them wide open. Practise it till you dream of it.'],
  research: ['Read the old histories. They lie, but in useful ways.', 'Keep a notebook. Then keep another, for the notebook.', 'Talk to the miners: they know the rock better than any book.'],
  gemcraft: ['A setter\'s hands should be warm. Hold a cup of tea before you start.', 'Start with the cheap stones. Everyone ruins a few.', 'The best settings are the ones you don\'t notice.'],
};

// The Academy's own: its masters and registrar (kept with the city).
function bookOf(S, L, rng) {
  const e = L.econ;
  const A = (e.academy ||= { masters: {}, terms: 0, alumni: [], registrar: null });
  const style = L.settlement.style || 'vale';
  for (const k of SUBJECT_KEYS) {
    if (A.masters[k]) continue;
    const p = makePerson(rng, style, MASTER_KIND[k]);
    p.title = MASTER_TITLE[k];
    p.job = k === 'cooking' ? 'cook' : k === 'dueling' ? 'champion' : k === 'gemcraft' ? 'jeweller' : 'scholar';
    if (k !== 'dueling') p.weapon = null;
    A.masters[k] = p;
  }
  if (!A.registrar) {
    const p = makePerson(rng, style, 'scholar');
    p.title = 'Registrar';
    A.registrar = p;
  }
  return A;
}

const masterName = (A, k) => `${A.masters[k].name.first} ${A.masters[k].name.last}`;

function enrolled(th, pid) {
  return !!(th.vars.players && th.vars.players[pid]);
}

// A class sat through: what you take from it.
function teachPlayer(th, S, pid, c) {
  const Sb = SUBJECTS[c.subject];
  const L = layoutOf(S, th.sid);
  const A = L && L.econ.academy;
  const st = th.vars.players[pid];
  st.credited.push(c.i);
  const rng = S.rng(th, 0x7ea + c.i);
  const got = [];
  S.asPid(pid, (p) => {
    const g = S.game;
    gainMastery(g, Sb.craft, 3);
    if (c.subject === 'cooking') {
      // (The master's own dish, written out for you.)
      const ings = rng.shuffle(['raw_meat', 'fish', 'carrot', 'cabbage', 'mushroom', 'apple', 'honey', 'herb', 'egg', 'bread', 'berries', 'ember_pod'].filter((k) => ITEMS[k])).slice(0, 2 + rng.int(0, 1));
      const key = cookDish(ings, rng.pick(['p', 'o', 'c', 't']), 0.9 + rng.float(0, 0.1), () => rng.next());
      if (learnRecipe(p, key) === 'new') got.push(`the recipe for ${ITEMS[key].name}`);
      const left = p.give(key, 1);
      if (left) g.spawnDrop(key, left, p.x, p.y, p.z, true);
    } else if (c.subject === 'gemcraft') {
      const left = p.give('gem', 1);
      if (left) g.spawnDrop('gem', left, p.x, p.y, p.z, true);
      got.push('a stone you cut yourself');
    } else if (c.subject === 'research') {
      const s = town(S, th.sid);
      if (s && S.sim.tech && S.sim.tech.addPoints) S.sim.tech.addPoints(s, 3, S.day);
      got.push('your answers, for the realm\'s scholars');
    } else if (c.subject === 'dueling') {
      got.push('bruises, and a better guard');
    }
    g.ui.msg(`${Sb.title} with ${A ? masterName(A, c.subject) : 'the master'}: done.${got.length ? ` (You come away with ${got.join(' and ')}.)` : ''}`, '#a0e0ff');
    g.audio?.play('chime');
  });
  S.person(pid).fame += 0.3;
}

// The term's masters and students in the room, while a class is on (and
// gone after).
function stageClass(th, S, cur) {
  const L = layoutOf(S, th.sid);
  const b = L && L.buildings[th.vars.bid];
  const A = L && L.econ.academy;
  if (!b || !A) return;
  const key = `master:${cur.c.subject}`;
  if (th.vars.staged !== cur.i) {
    // (Last class's people go.)
    for (const a of th.actors) if (!a.gone && (a.key.startsWith('master:') || a.key.startsWith('stu:'))) S.dismissActor(th, a.key);
    th.vars.staged = cur.i;
    if (th.vars.cancelled && th.vars.cancelled.includes(cur.i)) return;
    const mid = roomMid(b, SUBJECTS[cur.c.subject].room);
    if (!mid) return;
    const m = A.masters[cur.c.subject];
    // (Its master ill, and someone playing taking it instead.)
    const sub = th.vars.sub && th.vars.sub.done && th.vars.sub.i === cur.i;
    if (!sub) S.actor(th, {
      key, kind: 'npc', role: 'master', talk: true, at: mid, stay: true, subject: cur.c.subject,
      person: { ...m, age: m.age || 'adult', maxHp: m.maxHp || 20 },
      orders: { home: mid, roam: 1, lines: LESSON[cur.c.subject], mark: null },
    });
    // A few of the students (those boarding: their town lets them go).
    const tiles = b.rooms[SUBJECTS[cur.c.subject].room].tiles;
    (th.vars.npcs || []).filter((n) => n.att && n.att[cur.i]).slice(0, 3).forEach((n, i) => {
      const r = recOf(S, n.ref);
      if (!r) return;
      const at = tiles[(i * 4 + 2) % tiles.length];
      S.actor(th, {
        key: `stu:${n.ref.sid}:${n.ref.idx}`, kind: 'npc', role: 'student', talk: true, at, stay: true,
        person: { name: r.name, look: r.look, personality: r.personality, traits: r.traits, age: r.age, job: r.job, maxHp: r.maxHp || 18, title: 'Student' },
        orders: { home: at, roam: 1, lines: STUDENT_LINES[cur.c.subject] },
      });
    });
  }
}

const STUDENT_LINES = {
  cooking: ['Is it meant to smell like that?', 'Mine\'s curdled again.', 'I think I\'ve got it!', '*chop chop chop*'],
  dueling: ['Ow.', 'Again!', 'My arms...', 'I nearly had that.'],
  research: ['*scribble*', 'Could you say that again, Master?', 'I don\'t follow.', 'Oh! Oh, I see!'],
  gemcraft: ['Steady... steady...', 'It cracked. It cracked!', 'Look how it catches the light.', 'Hmm.'],
};

motif({
  id: 'academy',
  family: 'learning',
  max: 4,
  key: (o) => `academy:${o.sid}`,
  title: (th, S) => `${th.vars.termName[0].toUpperCase()}${th.vars.termName.slice(1)} at ${th.vars.name}`,
  // Each great city's Academy (raised if there's none yet), and a term
  // opening at one now and then.
  scan(S, rng, d) {
    const out = [];
    for (const L of laidTowns(S)) {
      if (L.settlement.type !== 'city') continue;
      const b = academyOf(L) || foundAcademy(S.sim, L);
      if (!b || S.live().some((t) => t.m === 'academy' && t.sid === L.settlement.id)) continue;
      const last = L.econ.academyTerm ?? -99;
      if (d - last < 2 || !rng.chance(0.5)) continue;
      out.push({ cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { bid: b.id, name: b.name, termName: rng.pick(TERMS) } });
    }
    return out;
  },
  anchors: (th, S) => {
    const L = layoutOf(S, th.sid);
    const b = L && L.buildings[th.vars.bid];
    return b ? [{ x: b.inside.x, z: b.inside.z }] : [];
  },
  // (A student set on it, waiting for a term to open: taken in.)
  meets: [
    {
      m: 'student',
      when: (a, b) => a.node === 'enrolling' && b.node === 'waiting' && b.vars.city === a.sid,
      then(a, b, S) {
        a.vars.npcs ||= [];
        if (!a.vars.npcs.some((n) => n.ref.idx === b.cast.student.idx && n.ref.sid === b.cast.student.sid)) a.vars.npcs.push({ ref: b.cast.student, att: {}, from: b.id });
        b.vars.term = a.id;
        S.note(a, `${b.names.student}, from ${townName(S, b.cast.student.sid)}, enrolled.`);
        S.go(b, 'studying', `${b.names.student} enrolled at ${a.vars.name} for ${a.vars.termName}.`, { news: [b.cast.student.sid] });
      },
    },
  ],
  nodes: {
    enrolling: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const b = L && L.buildings[th.vars.bid];
        if (!L || !b || !b.rooms) return S.end(th, 'faded');
        const rng = S.rng(th, 0xac0);
        const A = bookOf(S, L, rng);
        A.terms++;
        L.econ.academyTerm = S.day;
        // (Now and then a master moves on, and another comes.)
        if (A.terms > 1 && rng.chance(0.15)) {
          const k = rng.pick(SUBJECT_KEYS);
          const was = masterName(A, k);
          delete A.masters[k];
          bookOf(S, L, rng);
          th.vars.newMaster = { subject: k, was, now: masterName(A, k) };
        }
        const focus = rng.chance(0.5) ? rng.pick(SUBJECT_KEYS) : null;
        th.vars.focus = focus;
        th.vars.sched = termSchedule(rng, S.day + 1, rng.int(3, 5), focus);
        th.vars.fee = Math.round((L.settlement.condition === 'prosperous' ? 40 : L.settlement.condition === 'poor' ? 20 : 30) * rng.float(0.85, 1.2));
        th.vars.players = {};
        th.vars.npcs ||= [];
        th.vars.events = [];
        // The keen of the city, and of the towns about, who can pay.
        const keen = adults(L).filter((r) => keenness(r) > 0.55 && !['mayor', 'guard', 'priest'].includes(r.job));
        for (const r of rng.shuffle(keen).slice(0, rng.int(1, 4))) th.vars.npcs.push({ ref: R.rec(L.settlement.id, r.idx), att: {} });
        // One who'd come, and is good enough, but can't pay.
        const poor = adults(L).filter((r) => keenness(r) > 0.6 && (r.coins || 0) < th.vars.fee && !th.vars.npcs.some((n) => n.ref.idx === r.idx));
        if (poor.length && rng.chance(0.55)) {
          const r = rng.pick(poor);
          th.cast.hopeful = R.rec(L.settlement.id, r.idx);
          th.names.hopeful = fullName(r);
          const t = S.post(th, {
            role: 'sponsor', kind: 'pay', title: `Pay for ${r.name.first}'s place at ${th.vars.name} (¤${th.vars.fee})`, sid: th.sid, giver: th.cast.hopeful,
            pitch: say(rng, [
              'Every term I watch them walk in, and every term I can\'t pay. ¤{fee}. That\'s all it is. That\'s all it ever is.',
              'The masters say I\'ve a head for it. The purse says otherwise. If someone paid my place, I\'d make it worth their while. I swear it.',
              'I\'ve saved for two years and I\'m still short. I don\'t suppose... no. Forget I asked. (Though if you did, I\'d never forget it.)',
            ], { fee: th.vars.fee }),
            reward: { coins: 0, rep: 25, renown: th.sid, renownPts: 3, renownWhy: `paying for ${r.name.first}'s studies`, fame: 1 },
          });
          t.offerLabel = 'You look like you\'ve something on your mind.';
        }
        // The registrar at the desk.
        const reg = b.registrar || roomMid(b, 'lecture');
        S.actor(th, {
          key: 'registrar', kind: 'npc', role: 'registrar', talk: true, at: reg, stay: true,
          person: { ...A.registrar, age: 'adult', maxHp: 16 },
          orders: { home: reg, roam: 0, lines: ['Enrolment\'s open. Desk\'s here.', 'Fees in advance, if you please.', 'Next!', '*stamps a paper*'], mark: 'talk' },
        });
        const first = th.vars.sched[0];
        S.note(th, `${th.vars.name} opened ${th.vars.termName}${focus ? `, with ${SUBJECTS[focus].title.toLowerCase()} taught more than most` : ''}. Classes from day ${first.day + 1}; ¤${th.vars.fee} to enrol (ask the registrar at the back of the hall).${th.vars.newMaster ? ` ${th.vars.newMaster.was} has gone, and ${th.vars.newMaster.now} teaches ${SUBJECTS[th.vars.newMaster.subject].title.toLowerCase()} now.` : ''}`, { news: [th.sid] });
        for (const n of th.vars.npcs) {
          const r = recOf(S, n.ref);
          if (r) r.academy = th.id;
        }
      },
      // (Classes begin: the term's under way.)
      hour(th, S) {
        if (S.day >= th.vars.sched[0].day) S.go(th, 'term');
      },
      day(th, S) {
        if (S.day >= th.vars.sched[0].day) S.go(th, 'term');
      },
    },
    term: {
      enter(th, S) {
        // The students board at the Academy for the term.
        for (const n of th.vars.npcs || []) {
          const r = recOf(S, n.ref);
          if (r && alive(r)) {
            r.away = true;
            if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
          }
        }
        const t = S.tasksOf(th, 'sponsor')[0];
        if (t) {
          S.closeTask(t, 'lapsed');
          S.note(th, `Nobody paid for ${th.names.hopeful}'s place. ${pick(S.rng(th, 3), ['They watched the others go in.', 'They went back to work.', 'They said there\'d be another term.'])}`);
        }
      },
      live(th, S) {
        const cur = classNow(th.vars.sched, S.now);
        if (!cur) {
          if (th.vars.staged !== undefined && th.vars.staged !== null) {
            for (const a of th.actors) if (!a.gone && (a.key.startsWith('master:') || a.key.startsWith('stu:'))) S.dismissActor(th, a.key);
            th.vars.staged = null;
          }
          return;
        }
        stageClass(th, S, cur);
        if (th.vars.cancelled && th.vars.cancelled.includes(cur.i)) return;
        // Who's sitting through it.
        const L = layoutOf(S, th.sid);
        const b = L && L.buildings[th.vars.bid];
        for (const { p, pid } of S.players()) {
          if (!enrolled(th, pid)) continue;
          const st = th.vars.players[pid];
          if (st.credited.includes(cur.i) || roomAt(b, Math.round(p.x), Math.round(p.z)) !== SUBJECTS[cur.c.subject].room) {
            st.last = null;
            continue;
          }
          // (Minutes in the room, as the clock goes: a sleep or a wait
          // doesn't count, only being there.)
          if (st.last !== null && st.last !== undefined) st.att[cur.i] = (st.att[cur.i] || 0) + Math.max(0, Math.min(3, S.now - st.last));
          st.last = S.now;
          if (st.told !== cur.i) {
            st.told = cur.i;
            S.tell(pid, `${SUBJECTS[cur.c.subject].title}: stay for the lesson (an hour of it, in this room) to have it count.`, '#a0e0ff');
          }
          if (st.att[cur.i] >= ATTEND) teachPlayer(th, S, pid, { ...cur.c, i: cur.i });
        }
      },
      hour(th, S, rng) {
        // Told when a class is about to begin.
        const ni = nextClass(th.vars.sched, S.now);
        const nc = ni >= 0 ? th.vars.sched[ni] : null;
        const m = S.now % DAY;
        if (nc && nc.day === S.day && nc.from - m > 0 && nc.from - m <= 60 && th.vars.warned !== ni) {
          th.vars.warned = ni;
          for (const pid of Object.keys(th.vars.players || {})) S.tell(pid, `${SUBJECTS[nc.subject].title} begins at ${clock(nc.from)} in ${ROOM_WORD[SUBJECTS[nc.subject].room]} of ${th.vars.name}.`, '#a0e0ff');
        }
        npcClasses(th, S, rng);
        // (The term's own turns: a few, at most one an hour, none twice.)
        if (rng.chance(0.06)) termTurn(th, S, rng);
      },
      day(th, S, rng) {
        npcClasses(th, S, rng);
        // A student who couldn't pay their board, and nobody paid it.
        const d = th.vars.debt;
        if (d && !d.paid && !d.gone && S.now >= d.until) {
          d.gone = true;
          th.vars.npcs = (th.vars.npcs || []).filter((n) => !(n.ref.idx === d.idx && n.ref.sid === d.sid));
          const r = layoutOf(S, d.sid)?.npcs[d.idx];
          if (r && alive(r)) {
            r.away = false;
            r.academy = null;
            r.mood = Math.max(0, (r.mood ?? 0.5) - 0.3);
          }
          S.note(th, `Nobody paid ${d.name}'s board. ${pick(rng, ['They packed their books and went home.', 'They left before dawn, without a word to anyone.', 'They begged the masters to let them stay. The masters were sorry, but no.'])}`, { news: [d.sid] });
          S.emit('academy_result', { th: th.id, who: R.rec(d.sid, d.idx), result: 'fail', from: null, sid: th.sid, why: 'debt' });
        }
        const lastClass = th.vars.sched[th.vars.sched.length - 1];
        if (S.day > lastClass.day) S.go(th, 'judged');
      },
      fade: 10,
    },
    judged: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const rng = S.rng(th, 0x9ad);
        npcClasses(th, S, rng);
        const total = th.vars.sched.length - (th.vars.cancelled || []).length;
        const A = L && L.econ.academy;
        th.vars.results = [];
        // The townsfolk who studied.
        for (const n of th.vars.npcs || []) {
          const r = recOf(S, n.ref);
          if (!r || !alive(r)) continue;
          r.away = false;
          r.academy = null;
          const went = Object.keys(n.att).length / Math.max(1, total);
          const roll = went * 0.7 + (r.personality?.diligence ?? 0.5) * 0.3 + rng.float(-0.2, 0.2);
          const result = roll > 0.8 ? 'honours' : roll > 0.45 ? 'pass' : 'fail';
          th.vars.results.push({ ref: n.ref, result, from: n.from || null });
          if (result !== 'fail' && A) A.alumni.push({ name: fullName(r), sid: n.ref.sid, day: S.day });
          // (Some take up a trade they learnt there.)
          const fav = Object.keys(n.att).map((i) => th.vars.sched[+i].subject);
          const k = fav.length ? fav.sort((a, b) => fav.filter((q) => q === b).length - fav.filter((q) => q === a).length)[0] : null;
          const HL = layoutOf(S, n.ref.sid);
          if (k && result !== 'fail' && HL && rng.chance(result === 'honours' ? 0.6 : 0.3) && !['mayor', 'guard', 'priest'].includes(r.job) && !SUBJECTS[k].jobs.includes(r.job)) {
            const job = SUBJECTS[k].jobs.find((j) => HL.hasWorkplaceFor(j) && !living(HL).some((q) => q.job === j)) || null;
            if (job) {
              const was = r.job;
              retrain(HL, r, job, new RNG(hash4(r.idx, S.day, 0xac1)));
              ledger(HL, S.day, `${fullName(r)}, once a ${was}, came back from ${th.vars.name} a ${job} now.`);
            }
          }
          S.emit('academy_result', { th: th.id, who: n.ref, result, from: n.from || null, sid: th.sid });
        }
        // Those playing who enrolled.
        for (const [pid, st] of Object.entries(th.vars.players || {})) {
          const went = st.credited.length / Math.max(1, total);
          const result = went >= 0.85 ? 'honours' : went >= 0.5 ? 'pass' : 'fail';
          st.result = result;
          if (result === 'fail') {
            S.tell(pid, `The masters of ${th.vars.name} have judged ${th.vars.termName}: you sat ${st.credited.length} of ${total} classes. Not enough to pass. (Enrol again another term.)`, '#c8b080');
            continue;
          }
          const k = S.person(pid);
          const title = result === 'honours' ? `Honoured Graduate of ${th.vars.name}` : `Graduate of ${th.vars.name}`;
          if (!k.titles.includes(title)) k.titles.push(title);
          k.fame += result === 'honours' ? 3 : 2;
          S.asPid(pid, (p) => {
            const left = p.give('diploma', 1);
            if (left) S.game.spawnDrop('diploma', left, p.x, p.y, p.z, true);
          });
          if (A) A.alumni.push({ name: nameOf(S, R.pl(pid)), pid, sid: th.sid, day: S.day });
          S.tell(pid, `The masters of ${th.vars.name} have judged ${th.vars.termName}: you pass${result === 'honours' ? ', with honours' : ''}! (A diploma; and you may go by "${title}".) The graduation is in the hall tomorrow afternoon.`, '#ffe070');
          for (const t of th.tasks) if (t.role === 'attend' && t.status === 'open' && t.only && t.only.includes(pid)) S.complete(t, R.pl(pid));
        }
        for (const t of S.tasksOf(th, 'attend')) S.closeTask(t, 'lapsed');
        const passed = th.vars.results.filter((q) => q.result !== 'fail').length + Object.values(th.vars.players || {}).filter((q) => q.result && q.result !== 'fail').length;
        S.note(th, passed ? `${passed} passed at the end of ${th.vars.termName}. The graduation is to be in the hall.` : `Nobody passed at the end of ${th.vars.termName}. The masters were not pleased.`, { news: [th.sid] });
        th.vars.ceremony = (S.day + 1) * DAY + 15 * 60;
        if (!passed) S.end(th, 'closed');
      },
      // The graduation, in the hall: the masters, and those who passed.
      live(th, S) {
        const L = layoutOf(S, th.sid);
        const b = L && L.buildings[th.vars.bid];
        const A = L && L.econ.academy;
        if (!b || !A) return;
        if (S.now >= th.vars.ceremony && S.now < th.vars.ceremony + 90 && !th.vars.staged2) {
          th.vars.staged2 = true;
          const rng = S.rng(th, 0xce1);
          const hall = [];
          for (let i = 0; i < 6; i++) hall.push({ x: b.inside.x + (b.registrar ? Math.sign(b.registrar.x - b.inside.x) * (2 + i) : i), z: b.inside.z + (b.registrar ? Math.sign(b.registrar.z - b.inside.z) * (2 + i) : 0) });
          SUBJECT_KEYS.forEach((k, i) => {
            const at = hall[Math.min(hall.length - 1, i + 1)];
            S.actor(th, { key: `gm:${k}`, kind: 'npc', role: 'master', talk: true, at, stay: true, subject: k, person: { ...A.masters[k], age: 'adult', maxHp: 20 }, orders: { home: at, roam: 0, lines: pick(rng, [['Well done.', 'I expected no less.', 'Don\'t forget what you learnt.'], ['Go and be useful.', 'Proud of you. Some of you.', 'Write to us.']]) } });
          });
        }
        if (S.now >= th.vars.ceremony + 90) S.end(th, 'graduated', `The graduates of ${th.vars.termName} took their diplomas in the hall of ${th.vars.name}.`, { news: [th.sid] });
      },
      day(th, S) {
        if (S.now >= (th.vars.ceremony || 0) + 90) S.end(th, 'graduated', `The graduates of ${th.vars.termName} took their diplomas in the hall of ${th.vars.name}.`, { news: [th.sid] });
      },
      fade: 4,
    },
  },
  tasks: {
    sponsor: {
      // (Paid at the desk, or to them: see respond.)
      thanks: () => ['I won\'t let you down. I won\'t!'],
    },
    attend: {
      status: (th, t, pid) => {
        const st = th.vars.players[pid];
        if (!st) return ['You\'re not enrolled.'];
        return [`You've sat ${st.credited.length} of ${th.vars.sched.length} classes.`];
      },
    },
  },
  hello(th, a, npc, pid) {
    if (a.role === 'registrar') return enrolled(th, pid) ? 'Back again? The schedule\'s on the board. Well, it\'s in my head. Ask.' : pick(npc.rng, ['Enrolment? Name, and the fee.', 'Here to study, or here to look?', 'Welcome to the Academy. Mind the step.']);
    if (a.role === 'master') return enrolled(th, pid) ? pick(npc.rng, ['Ah. Late, but here.', 'Sit. Watch. Learn.', 'You. Good. We\'re starting.']) : pick(npc.rng, ['This class is for the enrolled. You may watch from the door.', 'Enrolled? No? Then hush.']);
    if (a.role === 'student') return pick(npc.rng, ['Shh, I\'m trying to listen.', 'Is this your first term too?', 'The masters are terrifying. I love it.']);
    return '...';
  },
  talk(th, a, npc, pid, S) {
    const out = [];
    const L = layoutOf(S, th.sid);
    if (a.role === 'registrar') {
      const left = th.vars.sched.filter((c) => c.day * DAY + c.to > S.now).length;
      if (!enrolled(th, pid) && left >= Math.ceil(th.vars.sched.length / 2) && th.node !== 'judged') out.push({ id: 'sga_enrol', arg: tid(th), label: `I'd like to enrol for ${th.vars.termName}. (¤${th.vars.fee})` });
      out.push({ id: 'sga_sched', arg: tid(th), label: 'What\'s being taught, and when?' });
      const sp = S.tasksOf(th, 'sponsor')[0];
      if (sp && S.visibleTo(sp, pid)) out.push({ id: 'sga_sponsor', arg: tid(th), label: `I'll pay for ${th.names.hopeful}'s place. (¤${th.vars.fee})` });
      if (th.vars.debt && !th.vars.debt.paid) out.push({ id: 'sga_debt', arg: tid(th), label: `I'll pay ${th.vars.debt.name}'s board. (¤${th.vars.debt.sum})` });
      if (enrolled(th, pid) && th.node !== 'judged') out.push({ id: 'sga_quit', arg: tid(th), label: 'I want to leave the Academy.' });
    }
    if (a.role === 'master' && th.node === 'term') {
      out.push({ id: 'sga_advice', arg: `${tid(th)}:${a.subject}`, label: 'Any advice, Master?' });
      if (a.subject === 'dueling' && enrolled(th, pid)) out.push({ id: 'sga_spar', arg: tid(th), label: 'Spar with me?' });
    }
    if (th.vars.sub && th.vars.sub.subject && a.role === 'registrar' && !th.vars.sub.done && S.game && L) {
      const rank = S.asPid(pid, () => mastery(S.game, SUBJECTS[th.vars.sub.subject].craft).rank) || 1;
      if (rank >= 4) out.push({ id: 'sga_teach', arg: tid(th), label: `I could take ${SUBJECTS[th.vars.sub.subject].title.toLowerCase()} myself, if the master's ill.` });
    }
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const L = layoutOf(S, th.sid);
    const A = L && L.econ.academy;
    const rng = S.rng(th, 0x5e9);
    switch (id) {
      case 'sga_enrol': {
        if (enrolled(th, pid)) return { lines: ['You\'re already on my list.'] };
        if (purse(S, pid) < th.vars.fee) return { lines: [`¤${th.vars.fee}. In advance. Come back when you have it.`] };
        S.asPid(pid, (p) => removeItem(p.inv, 'coin', th.vars.fee));
        if (L) L.econ.treasury += Math.round(th.vars.fee * 0.5);
        th.vars.players[pid] = { at: S.now, credited: [], att: {} };
        S.touch(th, pid, `${nameOf(S, R.pl(pid))} enrolled for ${th.vars.termName}.`);
        const at = S.post(th, {
          role: 'attend', kind: 'meet', title: `Attend your classes at ${th.vars.name}`, sid: th.sid, giver: null, only: [pid], npc: false, board: false, hand: 'auto',
          pitch: 'Be in the right room for an hour of each class to have it count. Pass the term (half your classes) to graduate.',
          reward: { coins: 0, fame: 1 },
        });
        S.accept(at, R.pl(pid));
        const nc = th.vars.sched[Math.max(0, nextClass(th.vars.sched, S.now))];
        return { lines: [pick(rng, ['Name... there. You\'re enrolled. Don\'t make me regret it.', 'Welcome to the Academy. Your first lesson is to be on time.', 'There. You\'re one of us now, for a term at least.']), nc ? `Your first class: ${SUBJECTS[nc.subject].title}, day ${nc.day + 1} at ${clock(nc.from)}, in ${ROOM_WORD[SUBJECTS[nc.subject].room]}.` : 'Ask me for the schedule.'] };
      }
      case 'sga_sched': {
        const ni = nextClass(th.vars.sched, S.now);
        const up = ni >= 0 ? th.vars.sched.slice(ni, ni + 4) : [];
        if (!up.length) return { lines: ['The classes are done for this term. There\'ll be another.'] };
        const lines = up.map((c) => `${c.day === S.day ? 'Today' : c.day === S.day + 1 ? 'Tomorrow' : `Day ${c.day + 1}`}, ${clock(c.from)}: ${SUBJECTS[c.subject].title} with ${A ? masterName(A, c.subject) : 'the master'}, in ${ROOM_WORD[SUBJECTS[c.subject].room]}.`);
        return { lines: [lines.slice(0, 2).join(' '), lines.slice(2).join(' ') || 'That\'s what\'s next.'] };
      }
      case 'sga_sponsor': {
        const t = S.tasksOf(th, 'sponsor')[0];
        if (!t) return { lines: ['That\'s been seen to.'] };
        if (purse(S, pid) < th.vars.fee) return { lines: [`¤${th.vars.fee}, and you haven't got it.`] };
        S.asPid(pid, (p) => removeItem(p.inv, 'coin', th.vars.fee));
        S.accept(t, R.pl(pid));
        S.complete(t, R.pl(pid));
        if (t.status === 'won') S.turnIn(t, pid);
        th.vars.npcs.push({ ref: th.cast.hopeful, att: {}, sponsor: pid });
        const r = recOf(S, th.cast.hopeful);
        if (r) {
          r.academy = th.id;
          r.mood = Math.min(1, (r.mood ?? 0.5) + 0.4);
        }
        S.note(th, `${nameOf(S, R.pl(pid))} paid for ${th.names.hopeful}'s place.`, { news: [th.sid] });
        return { lines: [`For ${th.names.hopeful}? ...How generous. I'll tell them myself.`, '(Word will reach them by nightfall. They\'ll be in class tomorrow.)'] };
      }
      case 'sga_debt': {
        const d = th.vars.debt;
        if (!d || d.paid) return { lines: ['That\'s been seen to.'] };
        if (purse(S, pid) < d.sum) return { lines: [`¤${d.sum}, and you haven't got it.`] };
        S.asPid(pid, (p) => removeItem(p.inv, 'coin', d.sum));
        d.paid = pid;
        S.touch(th, pid);
        S.note(th, `${nameOf(S, R.pl(pid))} paid ${d.name}'s board, and they stayed on.`, { news: [th.sid] });
        return { lines: ['Well! They can stay, then. They\'ll be glad. Grateful, I hope.'] };
      }
      case 'sga_quit': {
        delete th.vars.players[pid];
        for (const t of th.tasks) if (t.role === 'attend' && t.status === 'open' && t.only && t.only.includes(pid)) S.closeTask(t, 'void');
        return { lines: ['Leaving? The fee\'s not returned. Good luck to you.'], close: true };
      }
      case 'sga_heard': {
        const r = npc.rec;
        const keen = r && keenness(r) > 0.55;
        const ni = nextClass(th.vars.sched, S.now);
        const c = ni >= 0 ? th.vars.sched[ni] : null;
        const lines = [say(rng, keen ? [
          'A new term! {t}. I\'d go myself if I could. ¤{fee} to enrol, at the desk at the back of the hall.',
          'They\'ve opened {t} at the Academy. ¤{fee}, and you sit with the masters. Imagine.',
        ] : [
          '{t}, they\'re calling it. Students everywhere, asking directions. ¤{fee} to enrol, I hear.',
          'Another term at the Academy. More young folk with their noses in the air. ¤{fee}, if you\'re interested.',
          'Oh, the Academy. My cousin went. Came back talking like a book. ¤{fee} at the registrar\'s desk.',
        ], { t: th.vars.termName[0].toUpperCase() + th.vars.termName.slice(1), fee: th.vars.fee })];
        if (c) lines.push(`The next class is ${SUBJECTS[c.subject].title.toLowerCase()}, ${c.day === S.day ? 'today' : c.day === S.day + 1 ? 'tomorrow' : `on day ${c.day + 1}`} at ${clock(c.from)}.`);
        return { lines };
      }
      case 'sga_advice': {
        const k = String(arg).split(':')[1];
        return { lines: [pick(rng, ADVICE[k] || ['Practise.'])] };
      }
      case 'sga_spar': {
        if (S.game.duel) return { lines: ['One bout at a time.'] };
        if (npc && !npc.dead && S.game.startDuel) {
          S.game.startDuel(npc, 0);
          return { lines: ['Ha! Good. Show me what I\'ve taught you.'], close: true };
        }
        return { lines: ['Not now.'] };
      }
      case 'sga_teach': {
        const sub = th.vars.sub;
        if (!sub || sub.done) return { lines: ['That\'s been seen to.'] };
        sub.done = pid;
        th.vars.cancelled = (th.vars.cancelled || []).filter((i) => i !== sub.i);
        S.touch(th, pid);
        S.person(pid).fame += 2;
        S.note(th, `${nameOf(S, R.pl(pid))} took ${SUBJECTS[sub.subject].title.toLowerCase()} while its master was ill.`, { news: [th.sid] });
        return { lines: ['You? ...Well. The students will be amazed. Or appalled. Day ' + (th.vars.sched[sub.i].day + 1) + ', ' + clock(th.vars.sched[sub.i].from) + '.', '(The class goes ahead, with you at the front of it.)'] };
      }
      default:
        return null;
    }
  },
  // Anyone in the city about the term.
  townTalk(th, npc, pid, S) {
    if (!npc.rec || npc.rec.sid !== th.sid || npc.rec.age === 'child' || enrolled(th, pid) || th.node === 'judged') return [];
    // (Not everyone: about one in three has heard, and cares.)
    if ((npc.id * 7 + th.id) % 3) return [];
    return [{ id: 'sga_heard', arg: tid(th), label: 'What\'s this about the Academy?' }];
  },
});

// The students who boarded, at each class that's been (if they were keen
// enough to go): caught up whenever the story looks, however much time has
// passed.
function npcClasses(th, S, rng) {
  const sched = th.vars.sched;
  let i = th.vars.npcUpTo || 0;
  for (; i < sched.length; i++) {
    const c = sched[i];
    if (c.day * DAY + c.to > S.now) break;
    if ((th.vars.cancelled || []).includes(i)) continue;
    for (const n of th.vars.npcs || []) {
      const r = recOf(S, n.ref);
      if (!r || !alive(r)) continue;
      if (rng.chance(0.55 + (r.personality?.diligence ?? 0.5) * 0.4)) {
        n.att[i] = true;
        teachRec(r, c.subject);
      }
    }
  }
  th.vars.npcUpTo = i;
}

// A term's turns: what happens, now and then, while it's on (each once).
function termTurn(th, S, rng) {
  const L = layoutOf(S, th.sid);
  const A = L && L.econ.academy;
  if (!L || !A) return;
  const done = th.vars.events;
  const studs = (th.vars.npcs || []).map((n) => recOf(S, n.ref)).filter((r) => r && alive(r));
  const pick2 = () => {
    const s = rng.shuffle(studs.slice());
    return s.length >= 2 ? [s[0], s[1]] : null;
  };
  const turn = S.choose(th, [
    { to: 'ill', w: 1, when: () => !done.includes('ill') },
    { to: 'rivals', w: 1.2, when: () => !done.includes('rivals') && studs.length >= 2 },
    { to: 'smitten', w: 1, when: () => !done.includes('smitten') && studs.length >= 2 },
    { to: 'debt', w: 0.8, when: () => !done.includes('debt') && studs.length >= 1 },
    { to: 'brilliant', w: 0.9, when: () => !done.includes('brilliant') && studs.length >= 1 },
    { to: 'prank', w: 0.7, when: () => !done.includes('prank') },
    { to: 'visit', w: 0.5, when: () => !done.includes('visit') },
  ], rng);
  if (!turn) return;
  done.push(turn.to);
  switch (turn.to) {
    case 'ill': {
      const ni = nextClass(th.vars.sched, S.now);
      if (ni < 0) return;
      const c = th.vars.sched[ni];
      const who = masterName(A, c.subject);
      (th.vars.cancelled ||= []).push(ni);
      th.vars.sub = { subject: c.subject, i: ni, done: null };
      S.note(th, `${who} has taken ill. ${SUBJECTS[c.subject].title} on day ${c.day + 1} is cancelled, unless someone else can take it.`, { news: [th.sid] });
      break;
    }
    case 'rivals': {
      const [a, b] = pick2() || [];
      if (!a) return;
      th.vars.rivals = [a.idx, b.idx];
      S.note(th, say(rng, [
        '{a} and {b} can\'t stand each other. Each is sure they\'re the best of the term, and says so.',
        '{a} has decided {b} is their rival, and {b} has noticed. The masters are delighted: it\'s good for the work.',
        'A quarrel in the kitchen: {a} says {b} ruined their sauce on purpose.',
      ], { a: fullName(a), b: fullName(b) }));
      if (rng.chance(0.4)) S.split(th, 'rivalry', { cast: { a: R.rec(a.sid, a.idx), b: R.rec(b.sid, b.idx), town: R.town(th.sid) }, sid: th.sid, vars: { craft: 'study', where: th.vars.name } });
      break;
    }
    case 'smitten': {
      const [a, b] = pick2() || [];
      if (!a || a.partner !== null && a.partner !== undefined || b.partner !== null && b.partner !== undefined) return;
      S.note(th, say(rng, [
        '{a} and {b} have started sitting together in every class. Nobody is fooled.',
        '{a} keeps finding reasons to help {b} with their work. {b} keeps letting them.',
        'The masters have noticed {a} and {b} walking out together after lessons.',
      ], { a: fullName(a), b: fullName(b) }));
      S.split(th, 'courtship', { cast: { a: R.rec(a.sid, a.idx), b: R.rec(b.sid, b.idx), town: R.town(a.sid) }, sid: a.sid, vars: { met: 'at the Academy' } });
      break;
    }
    case 'debt': {
      const r = rng.pick(studs);
      const sum = 10 + rng.int(0, 15);
      th.vars.debt = { idx: r.idx, sid: r.sid, name: fullName(r), sum, paid: null, until: S.now + DAY };
      S.note(th, `${fullName(r)} can't pay their board (¤${sum}). Unless someone pays it at the desk by tomorrow, they're out.`, { news: [th.sid] });
      break;
    }
    case 'brilliant': {
      const r = rng.pick(studs);
      const k = rng.pick(SUBJECT_KEYS);
      teachRec(r, k);
      teachRec(r, k);
      S.note(th, say(rng, [
        '{m} says {a} is the best student of {s} in ten years. {a} went red to the ears.',
        '{a} solved something in {s} that had {m} stumped. The whole Academy is talking of it.',
        '{m} has asked {a} to stay on after the term, to help with {s}.',
      ], { a: fullName(r), m: masterName(A, k), s: SUBJECTS[k].title.toLowerCase() }), { news: [th.sid] });
      break;
    }
    case 'prank': {
      S.note(th, pick(rng, [
        'Someone put a goat in the lecture room in the night. Nobody will say who. The goat isn\'t talking either.',
        'The practice dummies were found dressed in the masters\' robes. The masters were not amused. The students were.',
        'Every pot in the kitchen was found full of frogs this morning.',
      ]));
      break;
    }
    case 'visit': {
      S.note(th, pick(rng, [
        'The mayor came to watch a lesson, and stayed for three.',
        'A scholar from across the water visited, and asked the students hard questions.',
        'A famous duellist stopped by the practice hall, and knocked down every student in turn. They loved it.',
      ]), { news: [th.sid] });
      break;
    }
    default:
  }
}

// ------------------------------------------------------------ a student's journey
motif({
  id: 'student',
  family: 'learning',
  max: 4,
  key: (o) => `student:${o.cast.student.sid}:${o.cast.student.idx}`,
  title: (th, S) => `${th.names.student}'s Dream of the Academy`,
  scan(S, rng) {
    if (!rng.chance(0.08)) return null;
    const cities = laidTowns(S).filter((L) => L.settlement.type === 'city' && academyOf(L));
    if (!cities.length) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      if (L.settlement.type === 'city' && rng.chance(0.6)) continue;
      const keen = adults(L).filter((r) => keenness(r) > 0.7 && !r.academy && !['mayor', 'guard', 'priest', 'merchant'].includes(r.job));
      if (!keen.length) continue;
      const r = rng.pick(keen);
      const s = L.settlement;
      const city = cities.sort((a, b) => Math.hypot(a.settlement.cx - s.cx, a.settlement.cz - s.cz) - Math.hypot(b.settlement.cx - s.cx, b.settlement.cz - s.cz))[0];
      return { cast: { student: R.rec(s.id, r.idx), town: R.town(s.id), city: R.town(city.settlement.id) }, sid: s.id, vars: { city: city.settlement.id, love: rng.pick(SUBJECT_KEYS) } };
    }
    return null;
  },
  nodes: {
    dream: {
      enter(th, S) {
        const r = recOf(S, th.cast.student);
        const L = layoutOf(S, th.sid);
        if (!r || !L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x5d1);
        const fee = 30;
        th.vars.need = Math.max(0, fee + 10 - Math.floor(r.coins || 0));
        // What the family make of it.
        const kin = kinOf(L, r).filter((q) => q.idx !== r.partner || rng.chance(0.5));
        const k = kin[0] || null;
        th.vars.family = !k ? 'none' : S.choose(th, [
          { to: 'proud', w: (k.personality?.kindness ?? 0.5) + 0.3 },
          { to: 'against', w: (k.personality?.temper ?? 0.4) + ((k.traits || []).includes('stubborn') ? 0.6 : 0) },
          { to: 'poor', w: (k.coins || 0) < 30 ? 1 : 0.2 },
        ], rng).to;
        if (k) {
          th.cast.kin = R.rec(th.sid, k.idx);
          th.names.kin = fullName(k);
        }
        S.note(th, say(rng, [
          '{a} has set their heart on studying {s} at the Academy in {c}. They talk of nothing else.',
          'Ever since a scholar passed through, {a} has wanted to go to the Academy in {c}. To study {s}, they say, properly.',
          '{a} has been saving for the Academy in {c}. They want to learn {s} from the masters.',
        ], { a: fullName(r), s: SUBJECTS[th.vars.love].title.toLowerCase(), c: townName(S, th.vars.city) }));
        if (th.vars.family === 'against') S.note(th, `${th.names.kin} won't hear of it: "Books won't plough a field."`);
        if (th.vars.family === 'proud') S.note(th, `${th.names.kin} is proud fit to burst, and tells everyone.`);
        if (th.vars.need > 0) {
          const t = S.post(th, {
            role: 'fund', kind: 'pay', title: `Help ${r.name.first} pay for the Academy (¤${th.vars.need})`, sid: th.sid, giver: th.cast.student,
            pitch: say(rng, [
              'I\'m ¤{n} short. ¤{n}! It might as well be a mountain. I don\'t suppose you could... no, I couldn\'t ask.',
              'If I had ¤{n} more I could be on the road tomorrow. I\'d pay you back. Every coin, I swear.',
            ], { n: th.vars.need }),
            reward: { coins: 0, rep: 20, renown: th.sid, renownPts: 2, renownWhy: `sending ${r.name.first} to the Academy`, fame: 1 },
          });
          t.offerLabel = 'You seem far away today.';
        }
      },
      day(th, S, rng) {
        const r = recOf(S, th.cast.student);
        if (!r || !alive(r)) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        // A family against it may come round (or not).
        if (th.vars.family === 'against' && rng.chance(0.15)) {
          th.vars.family = 'proud';
          S.note(th, `${th.names.kin} came round in the end: "Go, then. And come back cleverer than me."`);
        }
        // The money found: their own saving, the town passing a hat, or never.
        if (th.vars.need > 0 && days > 2 && rng.chance(0.18)) {
          th.vars.need = 0;
          const t = S.tasksOf(th, 'fund')[0];
          if (t) S.closeTask(t, 'done');
          S.note(th, pick(rng, [`The neighbours passed a hat for ${th.names.student}. Enough for the fee, and a little over.`, `${th.names.student} sold their best things to make up the fee.`, `${th.names.student} worked double days at the harvest, and made the fee.`]), { news: [th.sid] });
        }
        if (th.vars.need <= 0 && th.vars.family !== 'against') return S.go(th, 'journey');
        if (days > 12) S.end(th, 'faded', `${th.names.student} stopped talking about the Academy. ${pick(rng, ['Maybe next year.', 'Their books went in a chest.', 'They seem quieter now.'])}`);
      },
      fade: 16,
    },
    journey: {
      enter(th, S) {
        const r = recOf(S, th.cast.student);
        if (!r) return S.end(th, 'faded');
        r.away = true;
        if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
        S.note(th, `${th.names.student} set off for ${townName(S, th.vars.city)} with a pack of books.`, { news: [th.sid] });
      },
      day(th, S, rng) {
        // The road: kind, mostly.
        const bands = bandsNear(S, th.sid, 10);
        if (bands.length && !th.vars.robbed && rng.chance(0.2)) {
          th.vars.robbed = true;
          S.note(th, `${th.names.student} was robbed on the road by ${bands[0].name}: the fee, the books, everything.`, { news: [th.sid] });
          const r = recOf(S, th.cast.student);
          if (r) r.away = false;
          th.vars.need = 30;
          return S.go(th, 'dream');
        }
        S.go(th, 'waiting', `${th.names.student} reached ${townName(S, th.vars.city)} safely.`);
      },
    },
    // In the city, for a term to open (see the Academy's `meets`).
    waiting: {
      day(th, S) {
        if (S.now - th.nodeAt > 8 * DAY) {
          const r = recOf(S, th.cast.student);
          if (r) r.away = false;
          S.end(th, 'faded', `${th.names.student} came home: no term opened all the time they waited.`);
        }
      },
    },
    studying: {
      on: {
        academy_result(th, ev, S) {
          if (!ev.who || ev.who.idx !== th.cast.student.idx || ev.who.sid !== th.cast.student.sid) return;
          th.vars.result = ev.result;
          S.go(th, 'home');
        },
      },
      fade: 14,
    },
    home: {
      enter(th, S) {
        const r = recOf(S, th.cast.student);
        const rng = S.rng(th, 0x40e);
        if (!r) return S.end(th, 'faded');
        r.away = false;
        const res = th.vars.result;
        if (res === 'fail') {
          const how = S.choose(th, [
            { to: 'again', w: (r.personality?.diligence ?? 0.5) + ((r.traits || []).includes('stubborn') ? 0.5 : 0) },
            { to: 'ashamed', w: 0.8 },
            { to: 'drift', w: (r.personality?.temper ?? 0.4) * 0.6 },
          ], rng).to;
          if (how === 'again') {
            th.vars.result = null;
            return S.go(th, 'waiting', `${th.names.student} failed the term, and swore to sit it again.`);
          }
          if (how === 'drift') {
            r.away = true;
            return S.end(th, 'lost', `${th.names.student} failed at the Academy, and didn't come home. Someone saw them in ${townName(S, th.vars.city)}'s taverns, spending what was left.`, { news: [th.sid] });
          }
          r.mood = Math.max(0, (r.mood ?? 0.5) - 0.3);
          return S.end(th, 'home', `${th.names.student} came home from the Academy without a diploma, and doesn't want to talk about it.`, { news: [th.sid] });
        }
        // (Honours: a post in the city, now and then; they stay.)
        if (res === 'honours' && rng.chance(0.25)) {
          r.away = true;
          r.migrated = `s${th.vars.city}`;
          return S.end(th, 'graduated', `${th.names.student} graduated from the Academy with honours, and the masters kept them on in ${townName(S, th.vars.city)}. Their family weep for pride, and a little for missing them.`, { news: [th.sid] });
        }
        r.mood = Math.min(1, (r.mood ?? 0.5) + 0.4);
        S.end(th, 'graduated', `${th.names.student} came home a graduate of the Academy${res === 'honours' ? ', with honours' : ''}. ${pick(rng, ['There was a party.', 'Their family have hung the diploma by the door.', 'Half the town turned out to meet them.'])}`, { news: [th.sid] });
      },
    },
  },
  tasks: {
    fund: {
      // (Given: see respond.)
      thanks: () => ['You... you\'d do that? I\'ll make you proud. I\'ll make everyone proud.'],
    },
  },
  townTalk(th, npc, pid, S) {
    const t = S.tasksOf(th, 'fund')[0];
    if (!t || !npc.rec || npc.rec.sid !== th.cast.student.sid || npc.rec.idx !== th.cast.student.idx || !S.claimedBy(t, pid)) return [];
    return [{ id: 'sgs_give', arg: tid(th), label: `Here: ¤${th.vars.need} for the Academy.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgs_give') return null;
    if (purse(S, pid) < th.vars.need) return { lines: ['That\'s... kind, but you haven\'t got it either.'] };
    S.asPid(pid, (p) => removeItem(p.inv, 'coin', th.vars.need));
    const r = recOf(S, th.cast.student);
    if (r) r.coins = (r.coins || 0) + th.vars.need;
    const t = S.tasksOf(th, 'fund')[0];
    if (t) {
      S.complete(t, R.pl(pid));
      if (t.status === 'won') S.turnIn(t, pid);
    }
    th.vars.need = 0;
    S.note(th, `${nameOf(S, R.pl(pid))} gave ${th.names.student} what they were short for the Academy.`, { news: [th.sid] });
    return { lines: ['I don\'t know what to say.', 'I\'ll write to you. From the Academy! Oh, I have to pack.'] };
  },
});

