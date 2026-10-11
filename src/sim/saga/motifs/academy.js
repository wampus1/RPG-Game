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
import { motif, R, nameOf, HOOKS } from '../core.js';
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
import { ITEMS, GEMS } from '../../../world/items.js';
import { B, BLOCKS } from '../../../world/blocks.js';
import { playerOf } from '../refs.js';
import { GROUND } from '../../../config.js';
import { TEMPERS, LESSONS, masterNature, shuffleQuestion } from '../../lessons.js';

const tid = (th) => `t${th.id}`;
const ROOM_WORD = { kitchen: 'the kitchen', yard: 'the practice hall', lecture: 'the lecture room', gems: 'the gem workshop' };
const TERMS = ['the Lantern Term', 'the Harvest Term', 'the Frost Term', 'the Ember Term', 'the Thaw Term', 'the Bell Term', 'the Long Term', 'the Short Term', 'the Midsummer Term', 'the Ink Term'];
// What each master is like, and says as they teach.
const MASTER_KIND = { cooking: 'elder', dueling: 'champion', research: 'scholar', gemcraft: 'scholar' };
const MASTER_TITLE = { cooking: 'Master of Cookery', dueling: 'Swordmaster', research: 'Master of Philosophy', gemcraft: 'Master Setter' };
// (Round 83: what the masters say, and do, is each master's own, and each
// subject's: see sim/lessons.js.)

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
  // (Round 83) Each master their own person (kept with them; given to
  // those from before).
  for (const k of SUBJECT_KEYS) A.masters[k].nature ||= masterNature(hash4(S.game.seed | 0, L.settlement.id, A.terms), k, A.terms);
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
      // (Round 83: not if a stone was lent you to set in the class.)
      const lent = th.vars.les && th.vars.les.i === c.i && th.vars.les.lent[pid];
      if (!lent) {
        const left = p.give('gem', 1);
        if (left) g.spawnDrop('gem', left, p.x, p.y, p.z, true);
        got.push('a stone you cut yourself');
      }
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

// The way in and out of the Academy: the hall just inside the front door,
// and the street just outside it.
function entryOf(b) {
  return b.inside ? { x: b.inside.x, z: b.inside.z } : { x: b.door.x, z: b.door.z };
}
function exitOf(b) {
  return b.outside ? { x: b.outside.x, z: b.outside.z } : { x: b.door.x, z: b.door.z };
}

// Where the class sit or stand in a room: its chairs first (sat on, pulled
// out from the tables), then free floor.
function classSpots(S, b, room) {
  const r = b.rooms[room];
  const set = new Set(r.tiles.map((t) => `${t.x},${t.z}`));
  const w = S.game.world;
  const out = [];
  for (const t of r.tiles) if (w.getBlock(t.x, GROUND, t.z) === B.chair) out.push({ x: t.x, z: t.z, seat: true });
  for (const t of r.tiles) {
    const id = w.getBlock(t.x, GROUND, t.z);
    if (id !== B.chair && set.has(`${t.x},${t.z}`) && open(id)) out.push({ x: t.x, z: t.z, seat: false });
  }
  return out;
}

// Floor that can be stood on (bare, or a rug).
const open = (id) => id === B.air || !BLOCKS[id] || !BLOCKS[id].solid;

// The room's own stations for the subject (its ovens, dummies, desks or
// benches), each with somewhere to stand at it.
const STATION_IDS = {
  cooking: () => [B.oven, B.furnace, B.table],
  dueling: () => [B.training_dummy],
  research: () => [B.writing_desk, B.alembic],
  gemcraft: () => [B.jeweler_bench],
};
function stationsIn(S, b, room, subject) {
  const r = b.rooms[room];
  const ids = new Set(STATION_IDS[subject]().filter((q) => q !== undefined));
  const w = S.game.world;
  const set = new Set(r.tiles.map((t) => `${t.x},${t.z}`));
  const out = [];
  for (const t of r.tiles) {
    if (!ids.has(w.getBlock(t.x, GROUND, t.z))) continue;
    for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const x = t.x + dx;
      const z = t.z + dz;
      if (!set.has(`${x},${z}`)) continue;
      if (!open(w.getBlock(x, GROUND, z))) continue;
      out.push({ x: t.x, z: t.z, sx: x, sz: z });
      break;
    }
  }
  return out;
}

// The term's masters and students in the room, while a class is on: they
// come in through the front door and walk to their places, and (Round 83)
// walk out again after, rather than being there, and then not.
function stageClass(th, S, cur) {
  const L = layoutOf(S, th.sid);
  const b = L && L.buildings[th.vars.bid];
  const A = L && L.econ.academy;
  if (!b || !A || th.vars.staged === cur.i) return;
  // (Last class's people go.)
  sendOff(th, S, b);
  th.vars.staged = cur.i;
  th.vars.les = null;
  if (th.vars.cancelled && th.vars.cancelled.includes(cur.i)) return;
  const room = SUBJECTS[cur.c.subject].room;
  const mid = roomMid(b, room);
  if (!mid) return;
  const m = A.masters[cur.c.subject];
  // (A class well begun when you come by: they're in their places
  // already.)
  const late = (S.now % DAY) - cur.c.from > 12;
  const entry = entryOf(b);
  // (Its master ill, and someone playing taking it instead.)
  const sub = th.vars.sub && th.vars.sub.done && th.vars.sub.i === cur.i;
  if (!sub) S.actor(th, {
    key: `master:${cur.c.subject}`, kind: 'npc', role: 'master', talk: true, at: late ? mid : entry, stay: true, subject: cur.c.subject,
    person: { ...m, age: m.age || 'adult', maxHp: m.maxHp || 20 },
    orders: { home: { x: mid.x, z: mid.z }, roam: 0, lines: null, mark: null },
  });
  // The students boarding there who've come to it (more of them than
  // there was room for before).
  const spots = classSpots(S, b, room);
  const rng = new RNG(hash4(th.seed, cur.i, 0x57d));
  let k = 0;
  for (const n of th.vars.npcs || []) {
    const r = recOf(S, n.ref);
    if (!r || !alive(r)) continue;
    n.att ||= {};
    if (n.att[cur.i] === undefined) n.att[cur.i] = rng.chance(0.55 + (r.personality?.diligence ?? 0.5) * 0.4);
    if (!n.att[cur.i] || k >= 6 || !spots.length) continue;
    const at = spots[k++ % spots.length];
    S.actor(th, {
      key: `stu:${n.ref.sid}:${n.ref.idx}`, kind: 'npc', role: 'student', talk: true, at: late ? at : entry, stay: true,
      person: { name: r.name, look: r.look, personality: r.personality, traits: r.traits, age: r.age, job: r.job, maxHp: r.maxHp || 18, title: 'Student' },
      orders: { home: { x: at.x, z: at.z }, roam: 0, lines: null, sitHome: at.seat, skill: (r.skills && r.skills[SUBJECTS[cur.c.subject].skill]) || 0.2 },
    });
  }
}

// The masters and students of the class just over: out through the door.
function sendOff(th, S, b) {
  const out = exitOf(b);
  for (const a of th.actors) if (!a.gone && (a.key.startsWith('master:') || a.key.startsWith('stu:'))) S.walkOff(th, a.key, out);
}

// ------------------------------------------------------------ a class
// (Round 83) A class as it goes, in parts of its hours: the class come in
// and the master greets them; the master shows them something, at the
// room's own oven, dummies, desk or bench; a question to the room
// (answered by whoever's quickest: those playing, from the window that
// comes up or by going and saying it, or one of the students, right or
// wrong); work set, and done the way it's really done, at the room's own
// stations (those playing, by doing it: see the `on` handlers below; the
// students at theirs); another question, put to one of you by name; and
// the master's word to end, with something for each of you for your part.
// Kept in th.vars.les, a class at a time.
const PHASES = [['gather', 0], ['show', 0.06], ['ask', 0.28], ['work', 0.46], ['ask2', 0.78], ['close', 0.93]];

function phaseAt(f) {
  let p = 'gather';
  for (const [k, t] of PHASES) if (f >= t) p = k;
  return p;
}

function natureOf(A, k) {
  return (A.masters[k] && A.masters[k].nature) || masterNature(0, k);
}

// Those playing who are in the room just now (enrolled or not).
function inRoom(th, S, b, room) {
  return S.players().filter(({ p }) => roomAt(b, Math.round(p.x), Math.round(p.z)) === room);
}

function lessonOf(th, cur) {
  const v = th.vars;
  if (!v.les || v.les.i !== cur.i) v.les = { i: cur.i, phase: null, said: {}, q: null, shown: [], next: 0, done: {}, merit: {}, hits: {}, lent: {}, busy: {} };
  return v.les;
}

function runLesson(th, S, cur) {
  const L = layoutOf(S, th.sid);
  const b = L && L.buildings[th.vars.bid];
  const A = L && L.econ.academy;
  if (!b || !A || !b.rooms) return;
  const c = cur.c;
  const subj = c.subject;
  const room = SUBJECTS[subj].room;
  const les = lessonOf(th, cur);
  const master = S.actorEnt(th, `master:${subj}`);
  if (!master) return;
  const T = TEMPERS[natureOf(A, subj).temper] || TEMPERS.plain;
  const Ls = LESSONS[subj];
  const rng = new RNG(hash4(th.seed, cur.i, Math.floor(S.now * 2), 0x1e5));
  const m = S.now % DAY;
  const f = Math.max(0, Math.min(1, (m - c.from) / Math.max(1, c.to - c.from)));
  const ph = phaseAt(f);
  const here = inRoom(th, S, b, room);
  const studs = th.actors.filter((a) => !a.gone && a.key.startsWith('stu:')).map((a) => S.actorEnt(th, a.key)).filter(Boolean);
  les.stations ||= stationsIn(S, b, room, subj);
  const mid = roomMid(b, room);
  const talk = (e, text, t = 4, col) => e && !e.dead && e.say(text, t, col);
  const mname = masterName(A, subj);
  // A new part of the class.
  if (ph !== les.phase) {
    const was = les.phase;
    les.phase = ph;
    master.saga.roam = 0;
    if ((was === 'ask' || was === 'ask2') && les.q && !les.q.by) {
      talk(master, `${T.wrong === TEMPERS.quiet.wrong ? '' : 'No one? '}${les.q.why}`, 5);
      les.q = null;
    }
    if (ph === 'show') les.next = S.now;
    if (ph === 'ask' || ph === 'ask2') askQuestion(th, S, cur, les, master, here, ph === 'ask2', mname, rng);
    if (ph === 'work') {
      master.saga.home = { x: mid.x, z: mid.z };
      master.saga.busyAt = null;
      talk(master, Ls.work.ask, 5);
      for (const { pid } of here) {
        if (!enrolled(th, pid)) continue;
        S.tell(pid, `${mname}: "${Ls.work.ask}" (${Ls.work.how})`, '#a0e0ff');
        // (No stone to set: one lent, to set in something of yours.)
        if (subj === 'gemcraft' && !les.lent[pid]) {
          const has = S.asPid(pid, (p) => p.inv.some((q) => q && GEMS[q.item]));
          if (!has) {
            les.lent[pid] = true;
            S.give(pid, rng.pick(['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst']), 1);
            S.tell(pid, `${mname} presses a cut stone into your hand. "Yours, if you set it well."`, '#a0e0ff');
          }
        }
      }
      // The students to the stations.
      studs.forEach((e, i) => {
        const st = les.stations.length ? les.stations[i % les.stations.length] : null;
        if (!st) return;
        e.saga.home = { x: st.sx, z: st.sz };
        e.saga.busyAt = { x: st.x, z: st.z };
        e.saga.seated = false;
        e.saga.sitHomeWas = e.saga.sitHome;
        e.saga.sitHome = false;
      });
    }
    if (ph === 'ask2' || ph === 'close') {
      // (Back to their places.)
      for (const e of studs) {
        if (e.saga.sitHomeWas !== undefined) e.saga.sitHome = e.saga.sitHomeWas;
        const a = th.actors.find((q) => q.key === e.saga.key);
        if (a && a.orders && a.orders.home) e.saga.home = { ...a.orders.home };
        e.saga.busyAt = null;
      }
    }
    if (ph === 'close') closeLesson(th, S, cur, les, master, T, here, mname);
  }
  // Greeted, once the master's in the room.
  if (!les.said.open && roomAt(b, Math.round(master.x), Math.round(master.z)) === room) {
    les.said.open = true;
    const nat = natureOf(A, subj);
    talk(master, pick(rng, T.open), 4);
    if (here.length && rng.chance(0.5)) les.quirkAt = S.now + 6;
    les.nat = nat.quirk;
  }
  if (les.quirkAt && S.now >= les.quirkAt) {
    les.quirkAt = null;
    for (const { pid } of here) S.tell(pid, `(${mname} ${les.nat}.)`, '#9ab0c8');
  }
  // What the master shows: a thing or two, at the room's own stations.
  if (ph === 'show' && S.now >= les.next && les.shown.length < 2) {
    const left = Ls.show.map((_, i) => i).filter((i) => !les.shown.includes(i) && !(th.vars.shownAll || []).includes(`${subj}:${i}`));
    const pool = left.length ? left : Ls.show.map((_, i) => i).filter((i) => !les.shown.includes(i));
    const i = pick(rng, pool);
    les.shown.push(i);
    (th.vars.shownAll ||= []).push(`${subj}:${i}`);
    const st = les.stations.length ? pick(rng, les.stations) : null;
    if (st) {
      master.saga.home = { x: st.sx, z: st.sz };
      master.saga.busyAt = { x: st.x, z: st.z };
      les.act = { at: S.now + 4, x: st.x, z: st.z };
    }
    talk(master, Ls.show[i], 6);
    for (const { pid } of here) S.tell(pid, `${mname}: "${Ls.show[i]}"`, '#c8dcf0');
    les.next = S.now + Math.max(12, (c.to - c.from) * 0.1);
  }
  // Doing it, as they say it.
  if (les.act && S.now >= les.act.at && Math.max(Math.abs(master.x - master.saga.home.x), Math.abs(master.z - master.saga.home.z)) <= 1) {
    workAt(S, master, les.act, subj);
    les.act.at = S.now + 3;
    les.act.n = (les.act.n || 0) + 1;
    if (les.act.n >= 3) les.act = null;
  }
  // A question waiting on an answer.
  if ((ph === 'ask' || ph === 'ask2') && les.q && !les.q.by) {
    const q = les.q;
    if (q.react && S.now >= q.react.at) {
      const rr = q.react;
      q.react = null;
      talk(master, rr.right ? `${pick(rng, T.right)} ${q.why}` : pick(rng, T.wrong), 4);
      if (rr.right) q.by = rr.by;
    } else if (!q.react && S.now >= q.npcAt && studs.length && (!q.to || S.now >= q.at + 18)) {
      // One of the students puts a hand up.
      const tried = q.npcTried || [];
      const e = studs.find((s0) => !tried.includes(s0.saga.key));
      if (e) {
        tried.push(e.saga.key);
        q.npcTried = tried;
        const right = rng.chance(0.3 + (e.saga.skill || 0.2) * 0.6);
        const wrong = [0, 1, 2].filter((k) => k !== q.right && !(q.out || []).includes(k));
        const pickI = right || !wrong.length ? q.right : pick(rng, wrong);
        if (!right) (q.out ||= []).push(pickI);
        e.emoteShow?.('!', '#ffe070', 1.5);
        e.face(master.x, master.z);
        talk(e, `${q.opts[pickI]}?`, 3);
        q.react = { at: S.now + 3, right: pickI === q.right, by: 'npc' };
        q.npcAt = S.now + 12;
        if (pickI === q.right) {
          const n = (th.vars.npcs || []).find((nn) => `stu:${nn.ref.sid}:${nn.ref.idx}` === e.saga.key);
          const r = n && recOf(S, n.ref);
          if (r) teachRec(r, subj);
        }
      }
    } else if (!q.nudged && S.now >= q.at + 10 && !studs.length) {
      q.nudged = true;
      talk(master, pick(rng, T.nudge), 3);
    }
  }
  // The work: the students at it, the master going round.
  if (ph === 'work') {
    for (const e of studs) {
      const bz = e.saga.busyAt;
      if (!bz || e.moving || Math.max(Math.abs(e.x - e.saga.home.x), Math.abs(e.z - e.saga.home.z)) > 0) continue;
      const k = e.saga.key;
      les.busy[k] = (les.busy[k] ?? rng.float(0, 3)) - 0.5;
      if (les.busy[k] > 0) continue;
      les.busy[k] = rng.float(2.5, 5);
      workAt(S, e, bz, subj);
      if (rng.chance(0.18)) talk(e, pick(rng, Ls.npc), 2.5);
    }
    les.roundT = (les.roundT ?? 6) - 0.5;
    if (les.roundT <= 0) {
      les.roundT = rng.float(10, 16);
      // To one of them (someone playing, mostly), and a word.
      const who = here.filter(({ pid }) => enrolled(th, pid));
      const tgt = who.length && rng.chance(0.6) ? pick(rng, who) : null;
      const e = tgt ? tgt.p : studs.length ? pick(rng, studs) : null;
      if (e) {
        master.saga.home = { x: Math.round(e.x), z: Math.round(e.z) };
        master.saga.roam = 1;
        master.saga.busyAt = { x: Math.round(e.x), z: Math.round(e.z) };
        const line = tgt ? (les.done[tgt.pid] ? pick(rng, T.praise) : `${pick(rng, T.nudge)} ${Ls.work.how}`) : pick(rng, rng.chance(0.5) ? T.praise : T.nudge);
        talk(master, line, 4);
      }
    }
  }
}

// At the station: hands busy, and what comes of it.
function workAt(S, e, at, subject) {
  e.face(at.x, at.z);
  e.doAction?.(0.4);
  const r = S.game.renderer;
  const g = S.game;
  if (!r || !g.nearPlayer?.(e, 20)) return;
  if (subject === 'cooking') {
    r.emit(at.x, GROUND + 1, at.z, { n: 3, color: ['#f0f0f0', '#d8d8d8'], up: 14, speed: 5, gravity: -10, life: 0.9, oy: 2 });
    if (Math.random() < 0.3) g.audio?.play('sizzle', { x: at.x, y: GROUND, z: at.z }, null, { vol: 0.4 });
  } else if (subject === 'dueling') {
    r.wobble?.(at.x, GROUND, at.z, 1);
    r.emit(at.x, GROUND + 1, at.z, { n: 4, color: ['#e8cc70', '#d0b050'], up: 22, speed: 36, gravity: 120, life: 0.5, oy: -10 });
    g.audio?.play('hit', { x: at.x, y: GROUND, z: at.z }, null, { vol: 0.5 });
  } else if (subject === 'research') {
    r.emit(at.x, GROUND + 1, at.z, { n: 2, color: ['#c8d8ff', '#ffffff'], up: 8, speed: 4, gravity: -6, life: 0.8, oy: 0 });
    if (Math.random() < 0.3) g.audio?.play('page', { x: at.x, y: GROUND, z: at.z }, null, { vol: 0.4 });
  } else {
    r.emit(at.x, GROUND + 1, at.z, { n: 3, color: ['#fff4b0', '#ffd040', '#ffffff'], up: 10, speed: 12, gravity: 40, life: 0.5, oy: 0 });
    if (Math.random() < 0.4) g.audio?.play('clang', { x: at.x, y: GROUND, z: at.z }, null, { vol: 0.35 });
  }
}

// A question to the room (or, the second time, to one of you by name).
function askQuestion(th, S, cur, les, master, here, named, mname, rng) {
  const subj = cur.c.subject;
  const Q = LESSONS[subj].questions;
  const used = (th.vars.qUsed ||= []);
  const left = Q.map((_, i) => i).filter((i) => !used.includes(`${subj}:${i}`));
  const k = left.length ? pick(rng, left) : pick(rng, Q.map((_, i) => i));
  used.push(`${subj}:${k}`);
  const q = shuffleQuestion(Q[k], rng);
  const them = here.filter(({ pid }) => enrolled(th, pid));
  const to = named && them.length ? pick(rng, them).pid : null;
  les.q = { ...q, k, at: S.now, by: null, tries: {}, npcAt: S.now + (to ? 18 : 12), to };
  const toName = to ? nameOf(S, R.pl(to)).split(' ')[0] : null;
  master.saga.home = { ...(roomMid(layoutOf(S, th.sid).buildings[th.vars.bid], SUBJECTS[subj].room)) };
  master.saga.busyAt = null;
  master.say(`${toName ? `${toName}: ` : ''}${q.q}`, 6, '#e8f0ff');
  for (const { pid } of them) {
    const mine = pid === to;
    S.tell(pid, `${mname} asks ${mine ? 'you' : toName || 'the room'}: "${q.q}" ${q.opts.map((o, i) => `[${i + 1}] ${o}`).join(' ')}`, '#a0e0ff');
    S.asPid(pid, () => S.game.ui.openQuestion?.({ tid: th.id, who: mname, q: q.q, opts: q.opts, mine, time: 25 }));
  }
}

// An answer from someone playing (the window, or the master's talk).
function answerQ(th, S, pid, i) {
  const les = th.vars.les;
  const q = les && les.q;
  const L = layoutOf(S, th.sid);
  const A = L && L.econ.academy;
  const cur = classNow(th.vars.sched, S.now);
  if (!q || !cur || cur.i !== les.i || !A) return { lines: ['We\'ve moved on from that one.'] };
  const T = TEMPERS[natureOf(A, cur.c.subject).temper] || TEMPERS.plain;
  const master = S.actorEnt(th, `master:${cur.c.subject}`);
  const rng = new RNG(hash4(th.seed, cur.i, Math.floor(S.now * 2), 0xa45));
  const who = nameOf(S, R.pl(pid)).split(' ')[0];
  if (!enrolled(th, pid)) return { lines: ['Enrolled students only, I\'m afraid. You\'re welcome to listen.'] };
  if (q.tries[pid] !== undefined) return { lines: ['You\'ve had your go at this one. Let someone else try.'] };
  if (q.to && q.to !== pid && !q.by && S.now < q.at + 18) return { lines: [`Let ${nameOf(S, R.pl(q.to)).split(' ')[0]} have a go first.`] };
  q.tries[pid] = i;
  const right = i === q.right;
  const say0 = (t) => master && !master.dead && master.say(t, 4);
  const pp = playerOf(S.game, pid);
  if (master && !master.dead && pp) master.face(pp.x, pp.z);
  if (right && !q.by) {
    q.by = pid;
    q.react = null;
    les.merit[pid] = (les.merit[pid] || 0) + (q.to === pid ? 3 : 2);
    const line = `${pick(rng, T.right)} ${q.why}`;
    say0(line);
    for (const { pid: o } of S.players()) if (o !== pid && enrolled(th, o)) S.tell(o, `${who} answered: "${q.opts[i]}". Right.`, '#a0e0ff');
    S.tell(pid, `Right! (+practice for your part)`, '#a0ffa0');
    return { lines: [line], close: true };
  }
  if (right) {
    les.merit[pid] = (les.merit[pid] || 0) + 1;
    return { lines: [`Yes: as was said. ${q.why}`], close: true };
  }
  const line = pick(rng, T.wrong);
  say0(line);
  (q.out ||= []).push(i);
  return { lines: [line], close: true };
}

// The end of a class: the master's word, and something for each of you
// for your part (an answer got right, the work done).
function closeLesson(th, S, cur, les, master, T, here, mname) {
  const rng = new RNG(hash4(th.seed, cur.i, 0xc105));
  master.say(pick(rng, T.close), 4);
  const craft = SUBJECTS[cur.c.subject].craft;
  for (const { pid } of here) {
    if (!enrolled(th, pid)) continue;
    const st = th.vars.players[pid];
    const merit = (les.merit[pid] || 0) + (les.done[pid] ? 3 : 0);
    st.merit = (st.merit || 0) + merit;
    if (!merit) {
      S.tell(pid, `${mname}: "Have a go next time. Answer something, do the work: that's how it sticks."`, '#c8c8c8');
      continue;
    }
    S.asPid(pid, () => gainMastery(S.game, craft, Math.min(4, merit * 0.5)));
    const did = [les.done[pid] ? 'did the work' : null, les.merit[pid] ? 'answered well' : null].filter(Boolean).join(' and ');
    S.tell(pid, `${mname}: "Good. You ${did || 'took part'}." (Practice for it, and it counts at the term's end.)`, '#a0ffa0');
  }
}

// One of you playing did the work set, the way it's done.
function workDone(th, S, pid, what) {
  const les = th.vars.les;
  const cur = classNow(th.vars.sched, S.now);
  if (!les || !cur || cur.i !== les.i || les.phase !== 'work' || les.done[pid] || !enrolled(th, pid)) return;
  les.done[pid] = true;
  const L = layoutOf(S, th.sid);
  const A = L && L.econ.academy;
  const master = S.actorEnt(th, `master:${cur.c.subject}`);
  const T = TEMPERS[natureOf(A, cur.c.subject).temper] || TEMPERS.plain;
  const rng = new RNG(hash4(th.seed, cur.i, 0xd0e, pid.length));
  const line = pick(rng, T.praise);
  if (master && !master.dead) master.say(line, 3.5);
  S.tell(pid, `${masterName(A, cur.c.subject)}: "${line}" (You ${what}.)`, '#a0ffa0');
}

// (Round 83) The registrar: at the desk by day; off to eat at noon and in
// the evening (at the bench nearest the desk); to bed at night, in their
// room at the back of the hall (or, in an Academy built before there was
// one, home through the front door, and back in the morning).
function registrarSpec(b, A) {
  const reg = b.registrar || roomMid(b, 'lecture');
  const q = b.quarters || null;
  let meal = b.registrarMeal || null;
  if (!meal) {
    const benches = (b.seats || []).filter((t) => t.tags && t.tags.includes('social'));
    benches.sort((a, c) => Math.abs(a.x - reg.x) + Math.abs(a.z - reg.z) - (Math.abs(c.x - reg.x) + Math.abs(c.z - reg.z)));
    meal = benches[0] ? { x: benches[0].x, z: benches[0].z, face: { x: reg.x, z: reg.z } } : null;
  }
  return {
    key: 'registrar', kind: 'npc', role: 'registrar', talk: true, at: { x: reg.x, z: reg.z }, stay: true,
    away: q ? null : [21 * 60 + 30, 6 * 60 + 30],
    person: { ...A.registrar, age: 'adult', maxHp: 16 },
    orders: {
      home: { x: reg.x, z: reg.z }, roam: 0, mark: 'talk',
      lines: ['Enrolment\'s open. Desk\'s here.', 'Fees in advance, if you please.', 'Next!', '*stamps a paper*', 'Has anyone seen my good pen?', 'Schedules on request.'],
      staff: { bed: q ? q.bed : null, bedSide: q ? q.side : null, meal: meal ? { x: meal.x, z: meal.z } : null, mealFace: meal ? meal.face || null : null, door: exitOf(b) },
    },
  };
}

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
    // (Round 74: one city a day gets its Academy raised at most, the one
    // you're in first; finding room for one, in every city at once, made
    // the first night stall.)
    let raise = 1;
    const here = S.game.currentSettlement && S.game.currentSettlement.id;
    const towns = laidTowns(S).filter((L) => L.settlement.type === 'city').sort((a, c) => (c.settlement.id === here) - (a.settlement.id === here));
    for (const L of towns) {
      let b = academyOf(L);
      if (!b && raise > 0 && !(L.econ.noAcademy && S.sim.today() - L.econ.noAcademy < 10)) {
        raise--;
        b = foundAcademy(S.sim, L);
      }
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
        // The registrar at the desk (who keeps hours: see registrarSpec).
        S.actor(th, registrarSpec(b, A));
        th.vars.staffed = 2;
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
        const L = layoutOf(S, th.sid);
        const b = L && L.buildings[th.vars.bid];
        // (Round 83: a registrar from before keeps hours now.)
        if (th.vars.staffed !== 2 && b && L.econ.academy) {
          th.vars.staffed = 2;
          const spec = registrarSpec(b, L.econ.academy);
          S.actor(th, spec);
          const e = S.actorEnt(th, 'registrar');
          if (e && e.saga) Object.assign(e.saga, spec.orders);
        }
        const cur = classNow(th.vars.sched, S.now);
        if (!cur) {
          if (th.vars.staged !== undefined && th.vars.staged !== null) {
            if (b) sendOff(th, S, b);
            else for (const a of th.actors) if (!a.gone && (a.key.startsWith('master:') || a.key.startsWith('stu:'))) S.dismissActor(th, a.key);
            th.vars.staged = null;
          }
          return;
        }
        stageClass(th, S, cur);
        if (th.vars.cancelled && th.vars.cancelled.includes(cur.i)) return;
        runLesson(th, S, cur);
        // Who's sitting through it.
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
      // (Round 83) The work set the class, done the way it's done: a dish
      // cooked in the kitchen, blows on the practice hall's dummies, a
      // problem worked at the lecture room's desk, a stone set at the
      // workshop's bench.
      on: {
        practised(th, ev, S) {
          const cur = classNow(th.vars.sched, S.now);
          if (!cur || SUBJECTS[cur.c.subject].craft !== ev.craft) return;
          const L = layoutOf(S, th.sid);
          const b = L && L.buildings[th.vars.bid];
          if (roomAt(b, ev.x, ev.z) !== SUBJECTS[cur.c.subject].room) return;
          workDone(th, S, ev.pid, LESSONS[cur.c.subject].work.done);
        },
        dummy_hit(th, ev, S) {
          const cur = classNow(th.vars.sched, S.now);
          const les = th.vars.les;
          if (!cur || cur.c.subject !== 'dueling' || !les || les.i !== cur.i || les.phase !== 'work' || les.done[ev.pid]) return;
          const L = layoutOf(S, th.sid);
          const b = L && L.buildings[th.vars.bid];
          if (roomAt(b, ev.x, ev.z) !== 'yard') return;
          const h = (les.hits[ev.pid] ||= { n: 0, heavy: 0 });
          h.n++;
          if (ev.heavy) h.heavy++;
          if (h.n >= (LESSONS.dueling.work.hits || 4) && h.heavy >= 1) workDone(th, S, ev.pid, LESSONS.dueling.work.done);
          else if (h.n === (LESSONS.dueling.work.hits || 4) && !h.heavy) S.tell(ev.pid, 'Now a heavy one: hold the strike before you let it go.', '#a0e0ff');
        },
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
          const went = Object.values(n.att).filter(Boolean).length / Math.max(1, total);
          const roll = went * 0.7 + (r.personality?.diligence ?? 0.5) * 0.3 + rng.float(-0.2, 0.2);
          const result = roll > 0.8 ? 'honours' : roll > 0.45 ? 'pass' : 'fail';
          th.vars.results.push({ ref: n.ref, result, from: n.from || null });
          if (result !== 'fail' && A) A.alumni.push({ name: fullName(r), sid: n.ref.sid, day: S.day });
          // (Some take up a trade they learnt there.)
          const fav = Object.keys(n.att).filter((i) => n.att[i]).map((i) => th.vars.sched[+i].subject);
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
          // (Round 83: and what you put into the classes counts.)
          const went = st.credited.length / Math.max(1, total) + Math.min(0.2, (st.merit || 0) * 0.015);
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
            S.actor(th, { key: `gm:${k}`, kind: 'npc', role: 'master', talk: true, at: entryOf(b), stay: true, subject: k, person: { ...A.masters[k], age: 'adult', maxHp: 20 }, orders: { home: at, roam: 0, lines: pick(rng, [['Well done.', 'I expected no less.', 'Don\'t forget what you learnt.'], ['Go and be useful.', 'Proud of you. Some of you.', 'Write to us.']]) } });
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
      how: (th, t, S) => `Pay ¤${th.vars.fee} for ${th.names.hopeful}'s place at ${th.vars.name}: talk to them in ${townName(S, th.sid)}, or to the registrar at the Academy's desk.`,
    },
    attend: {
      // (Round 85) The Academy's door, and the next class.
      where: (th, t, S) => {
        const b = academyOf(layoutOf(S, th.sid));
        return b && b.door ? { x: b.door.x, z: b.door.z } : null;
      },
      how: (th, t, S) => {
        const nc = th.vars.sched[nextClass(th.vars.sched, S.now)];
        const when = nc ? ` Next: ${SUBJECTS[nc.subject].title}, ${nc.day === S.day ? 'today' : `day ${nc.day + 1}`} at ${clock(nc.from)}, in ${ROOM_WORD[SUBJECTS[nc.subject].room]}.` : '';
        return `Go to ${th.vars.name} in ${townName(S, th.sid)} and stay in the right room for an hour of each class.${when}`;
      },
      status: (th, t, pid) => {
        const st = th.vars.players[pid];
        if (!st) return ['You\'re not enrolled.'];
        return [`You've sat ${st.credited.length} of ${th.vars.sched.length} classes.`];
      },
    },
  },
  hello(th, a, npc, pid, S) {
    if (a.role === 'registrar') {
      if (npc.saga && npc.saga.seated) return pick(npc.rng, ['*chewing* Mm. One moment. Go on.', 'I\'m on my lunch, but go on.']);
      return enrolled(th, pid) ? 'Back again? The schedule\'s on the board. Well, it\'s in my head. Ask.' : pick(npc.rng, ['Enrolment? Name, and the fee.', 'Here to study, or here to look?', 'Welcome to the Academy. Mind the step.']);
    }
    if (a.role === 'master') {
      // (Round 83) Each master in their own way.
      const L = S && layoutOf(S, th.sid);
      const A = L && L.econ.academy;
      const nat = A && a.subject ? natureOf(A, a.subject) : null;
      const T = (nat && TEMPERS[nat.temper]) || TEMPERS.plain;
      const q = th.vars.les && th.vars.les.q && !th.vars.les.q.by ? th.vars.les.q : null;
      if (q && enrolled(th, pid)) return `${pick(npc.rng, T.nudge)} "${q.q}"`;
      if (!enrolled(th, pid)) return pick(npc.rng, [`${pick(npc.rng, T.open)} (You're not enrolled: you're welcome to watch.)`, 'Visitors at the back, please. Enrolled students up front.', 'Thinking of enrolling? The registrar\'s at the back of the hall.']);
      return pick(npc.rng, T.open);
    }
    if (a.role === 'student') {
      const phase = th.vars.les && th.vars.les.phase;
      if (phase === 'work') return pick(npc.rng, ['Can\'t talk, I\'m nearly there.', 'Have you done yours yet?', 'Watch this. ...Oh. Don\'t watch this.']);
      if (phase === 'ask' || phase === 'ask2') return pick(npc.rng, ['I think I know this one!', 'Do you know the answer? I won\'t tell.', 'Shh, I\'m thinking.']);
      return pick(npc.rng, ['Is this your first term too?', 'I came all this way. I\'m not missing a word.', 'Our master\'s nothing like I expected.']);
    }
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
      // (Round 83) A question put to the class: answered here too.
      const les = th.vars.les;
      const q = les && les.q && !les.q.by && enrolled(th, pid) && les.q.tries[pid] === undefined ? les.q : null;
      if (q) q.opts.forEach((o, i) => out.push({ id: 'sga_ans', arg: `${tid(th)}:${i}`, label: `"${o}."` }));
      if (les && les.phase === 'work' && enrolled(th, pid) && !les.done[pid]) out.push({ id: 'sga_how', arg: `${tid(th)}:${a.subject}`, label: 'What should I be doing?' });
      out.push({ id: 'sga_advice', arg: `${tid(th)}:${a.subject}`, label: 'Could you show me something useful?' });
      out.push({ id: 'sga_past', arg: `${tid(th)}:${a.subject}`, label: `How did you come to ${SUBJECTS[a.subject].verb}?` });
      out.push({ id: 'sga_life', arg: `${tid(th)}:${a.subject}`, label: 'What do you do when you\'re not teaching?' });
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
        // (Round 83) Something you can use: how a thing's really done.
        const k = String(arg).split(':')[1];
        const Ls = LESSONS[k];
        if (!Ls) return { lines: ['Practise.'] };
        const i = rng.int(0, Ls.show.length - 1);
        return { lines: [Ls.show[i], Ls.show[(i + 1) % Ls.show.length]] };
      }
      case 'sga_ans':
        return answerQ(th, S, pid, +String(arg).split(':')[1]);
      case 'sga_how': {
        const k = String(arg).split(':')[1];
        return { lines: [LESSONS[k] ? LESSONS[k].work.how : 'Watch, for now.'] };
      }
      case 'sga_past':
      case 'sga_life': {
        const k = String(arg).split(':')[1];
        const nat = A ? natureOf(A, k) : null;
        if (!nat) return { lines: ['Oh, this and that.'] };
        const T = TEMPERS[nat.temper] || TEMPERS.plain;
        if (id === 'sga_past') {
          return { lines: [pick(rng, [`Me? I ${nat.past}.`, `Long story. Short version: I ${nat.past}.`, `I ${nat.past}. Nobody expects that.`]), pick(rng, [...T.praise, 'Funny how things go.', 'And here I am.'])] };
        }
        return { lines: [pick(rng, [`I ${nat.pastime}.`, `When I'm not here? I ${nat.pastime}.`]), pick(rng, ['Don\'t tell the students. Oh. You are one.', 'Everyone needs something that isn\'t work.', 'Come and see some time.', 'It keeps me sane.'])] };
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
      n.att ||= {};
      // (Round 83: decided as the class began, if anyone was there to see.)
      if (n.att[i] === undefined) n.att[i] = rng.chance(0.55 + (r.personality?.diligence ?? 0.5) * 0.4);
      if (n.att[i]) teachRec(r, c.subject);
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
      how: (th, t, S) => `Give ${th.names.student || 'them'} ¤${th.vars.need}: talk to them in ${townName(S, th.sid)}.`,
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


// (Round 83) An answer from a class's question window (see ui/windows.js
// QuestionWindow).
HOOKS.answer.push((S, tid0, pid, i) => {
  const th = S.thread(+tid0);
  if (!th || th.m !== 'academy' || th.done) return false;
  const r = answerQ(th, S, pid, i);
  if (r && r.lines && r.lines.length) S.tell(pid, r.lines.join(' '), '#c8dcf0');
  return true;
});

// (Round 83) The room's own desk or bench, for those enrolled in a class
// that's working at it (no licence wanted, for the lesson).
HOOKS.bench.push((S, st, x, z, pid) => {
  const want = { scribe: 'research', jeweller: 'gemcraft' };
  if (!want[st]) return false;
  for (const th of S.live()) {
    if (th.m !== 'academy' || th.node !== 'term' || !enrolled(th, pid)) continue;
    const cur = classNow(th.vars.sched, S.now);
    if (!cur || cur.c.subject !== want[st]) continue;
    const L = layoutOf(S, th.sid);
    const b = L && L.buildings[th.vars.bid];
    if (roomAt(b, x, z) !== SUBJECTS[cur.c.subject].room && roomAt(b, x + 1, z) !== SUBJECTS[cur.c.subject].room && roomAt(b, x - 1, z) !== SUBJECTS[cur.c.subject].room && roomAt(b, x, z + 1) !== SUBJECTS[cur.c.subject].room && roomAt(b, x, z - 1) !== SUBJECTS[cur.c.subject].room) continue;
    return true;
  }
  return false;
});
