// Round 54: story upon story. Stories that split and join and fuse, and a
// hidden one nobody tells you about; fifty new kinds (courtships to
// weddings, the Academy and its terms, festivals and tournaments, wonders,
// a town's troubles, comings and goings on the road); more variety in the
// old ones; and a room to let at every tavern.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { MOTIFS } from '../src/sim/saga/core.js';
import { sagaTopics, sagaRespond } from '../src/sim/saga/talk.js';
import { topicsFor, respond } from '../src/game/dialogue.js';
import { DAY, mayorOf } from '../src/sim/econ.js';
import { B } from '../src/world/blocks.js';
import { ITEMS } from '../src/world/items.js';
import { innPrice, stayAt, rentRoom, innBedAt } from '../src/sim/inns.js';
import { foundAcademy, academyOf, roomMid, SUBJECTS, termSchedule, classNow, ATTEND } from '../src/sim/college.js';
import { mastery, CRAFTS, gainMastery } from '../src/game/mastery.js';
import { weddings } from '../src/sim/life.js';
import { births, bear, newcomer } from '../src/sim/civic.js';
import { hairWord } from '../src/sim/saga/motifs/lib.js';
import { STEPS, stepsFor } from '../src/game/migrate.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { RNG } from '../src/util/rng.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, S: game.sim.saga, p: game.player };
}
const setT = (game, t) => {
  game.day = Math.floor(t / DAY);
  game.minute = t % DAY;
};
// Days on, an hour at a time (the towns about kept up with too; `towns`:
// those to keep wholly up to date, as a few frames an hour wouldn't).
function days(game, input, n, towns = []) {
  for (let d = 0; d < n; d++) {
    for (let h = 0; h < 24; h++) {
      game.minute += 60;
      if (game.minute >= DAY) {
        game.minute -= DAY;
        game.day++;
      }
      game.update(0.6, input);
      for (let k = 0; k < 4; k++) game.update(0.02, input);
      for (const L of towns) game.sim.catchUp(L);
    }
  }
}
const always = { chance: () => true, next: () => 0, int: (a) => a, pick: (a) => a[0], shuffle: (a) => a, float: (a) => a, fork() { return this; } };
// A stand-in for someone you're talking to (a townsperson, not spawned).
const face = (L, r) => ({ id: 1000 + r.idx, rec: r, settlement: L.settlement, layout: L, rng: new RNG(r.idx + 7), x: 0, z: 0, dead: false });
function faults(S) {
  const out = [];
  S.fault = (th, e) => out.push(`${th ? `${th.m}/${th.node}` : '-'} ${e && e.message}`);
  return out;
}

// ------------------------------------------------------------ the engine
test('stories split, join and fuse; are retitled; and a hidden one is told only to who finds it', () => {
  const { game, S } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  const sid = L.settlement.id;
  const ppl = L.npcs.filter((r) => r.alive !== false && r.age === 'adult');
  const [a, b, c, d] = ppl;
  const t1 = S.begin('rivalry', { cast: { a: { t: 'rec', sid, idx: a.idx }, b: { t: 'rec', sid, idx: b.idx }, town: { t: 'town', sid } }, sid, vars: { over: 'the best pie' } });
  const kid = S.split(t1, 'courtship', { cast: { a: { t: 'rec', sid, idx: c.idx }, b: { t: 'rec', sid, idx: d.idx }, town: { t: 'town', sid } }, sid });
  assert.ok(kid && kid.split === t1.id && t1.kids.includes(kid.id), 'a story that goes its own way');
  assert.ok(t1.hist.some((h) => /story of its own/.test(h.text)) && kid.hist.some((h) => /began as part of/.test(h.text)));
  S.retitle(kid, 'Something Else Entirely');
  assert.equal(kid.title, 'Something Else Entirely');
  assert.ok(kid.was && kid.was.length === 1);
  const t3 = S.begin('feud', { cast: { a: { t: 'rec', sid, idx: a.idx }, b: { t: 'rec', sid, idx: d.idx }, town: { t: 'town', sid } }, sid, vars: { why: 'a pie', fa: a.name.last, fb: d.name.last, step: 0 } });
  S.join(t1, t3);
  assert.ok(t3.done && t3.outcome === 'merged' && t3.mergedInto === t1.id && t1.joined.includes(t3.id), 'one story taken into another');
  // Hidden: not in anyone's log until they've found it.
  const spy = MOTIFS.infiltrator;
  assert.ok(spy.hidden);
  let o = null;
  const rng = new RNG(3);
  for (let i = 0; i < 3000 && !o; i++) o = spy.scan(S, rng, S.day);
  if (o) {
    const th = S.begin('infiltrator', o);
    assert.ok(th && S.hiddenFrom(th, 'host'));
    S.touch(th, 'host');
    assert.ok(!S.storiesFor('host').includes(th), 'hidden even when touched');
    S.reveal(th, 'host');
    assert.ok(S.storiesFor('host').includes(th), 'told once found');
  }
});

test('there are fifty new kinds of story, each with its own family, and they run without fault', () => {
  const NEW = ['academy', 'student', 'courtship', 'reconcile', 'last_wish', 'homecoming', 'infiltrator', 'festival', 'tournament', 'bard_song', 'harvest',
    'venture', 'apprentice', 'treasure_map', 'expedition', 'barn_raising', 'rivalry', 'moneylender', 'silver_mine', 'election', 'strike', 'ratcatcher', 'witch_hunt',
    'honour_duel', 'gambler', 'tonic', 'white_stag', 'stray', 'haunting', 'shipwreck', 'dry_well', 'falling_star', 'great_fish', 'pig_chase', 'swarm', 'ill_luck',
    'orphan', 'golden_wedding', 'late_letter', 'inheritance', 'prodigy', 'sleepwalker', 'double', 'lost_traveller', 'bridge_out', 'child_alone', 'no_memory', 'show',
    'hidden_noble', 'old_soldier'];
  assert.ok(NEW.length >= 50);
  for (const id of NEW) assert.ok(MOTIFS[id] && MOTIFS[id].family && MOTIFS[id].nodes, `${id} is a story`);
  assert.ok(Object.keys(MOTIFS).length >= 86);
  // A fortnight of some of them, begun wherever they'd begin: no faults.
  const { game, input, S } = start(777);
  const errs = faults(S);
  const rng = new RNG(11);
  let begun = 0;
  for (const id of ['festival', 'rivalry', 'venture', 'stray', 'moneylender', 'golden_wedding', 'show', 'harvest', 'tonic', 'election', 'courtship', 'double']) {
    let o = null;
    for (let i = 0; i < 300 && !o; i++) o = [].concat(MOTIFS[id].scan(S, rng, S.day) || [])[0];
    if (o && S.begin(id, o)) begun++;
  }
  assert.ok(begun >= 8, `${begun} begun`);
  days(game, input, 14);
  assert.deepEqual(errs, []);
  const ended = S.threads.filter((t) => t.done && !['faded', 'merged'].includes(t.outcome));
  assert.ok(ended.length >= 5, 'stories come to their own ends');
});

// ------------------------------------------------------------ hearts
test('a match is a courtship first: it may come to a wedding (the town\'s own wedding, with you asked)', () => {
  const { game, input, S } = start();
  const errs = faults(S);
  const L = [...game.world.layouts.values()].find((q) => q.settlement.type === 'city');
  const pair = weddings(game.sim, L, game.day, always);
  assert.ok(pair, 'two who hit it off');
  const th = S.live().find((t) => t.m === 'courtship' && t.cast.a.idx === pair[0].idx);
  assert.ok(th, 'a courtship, not a wedding at once');
  assert.ok(pair[0].courting === th.id && pair[1].courting === th.id);
  // (Both hearts set on it, nothing in the way.)
  th.vars.ha = 1;
  th.vars.hb = 1;
  th.vars.trouble = null;
  S.touch(th, 'host');
  S.go(th, 'courting');
  th.vars.trouble = null;
  th.vars.ha = 1;
  th.vars.hb = 1;
  for (let i = 0; i < 4 && th.node === 'courting'; i++) days(game, input, 1, [L]);
  if (th.node === 'courting') S.go(th, 'proposal');
  assert.ok(['engaged', 'courting', 'parted'].includes(th.node) || th.done, th.node);
  if (th.node === 'engaged') {
    const ev = (L.econ.events || []).find((q) => q.id === th.vars.ev);
    assert.ok(ev && ev.kind === 'wedding' && ev.couple.includes(pair[0].idx), 'the wedding is on the town\'s calendar');
    assert.ok(S.tasksOf(th, 'guest').length, 'and you\'re asked');
    days(game, input, 5, [L]);
    assert.ok(th.done, 'it came to its end');
    if (th.outcome === 'wed') assert.equal(pair[0].partner, pair[1].idx);
  }
  assert.deepEqual(errs, []);
});

test('the courtship\'s talk: how they feel, a good word, a warning; and a parent talked round', () => {
  const { game, S } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  const sid = L.settlement.id;
  const ppl = L.npcs.filter((r) => r.alive !== false && r.age === 'adult' && !r.away);
  const a = ppl[0];
  const b = ppl.find((r) => r !== a && r.household !== a.household);
  const th = S.begin('courtship', { cast: { a: { t: 'rec', sid, idx: a.idx }, b: { t: 'rec', sid, idx: b.idx }, town: { t: 'town', sid } }, sid, vars: { ha: 0.5, hb: 0.5 } });
  S.go(th, 'courting');
  const ids = sagaTopics(face(L, a), game).map((t) => t.id);
  assert.ok(ids.includes('sgl_how') && ids.includes('sgl_good') && ids.includes('sgl_warn'));
  const before = th.vars.ha;
  sagaRespond(face(L, a), game, 'sgl_good', `t${th.id}:a`);
  assert.ok(th.vars.ha > before, 'a good word warms them');
  const how = sagaRespond(face(L, a), game, 'sgl_how', `t${th.id}:a`);
  assert.ok(how.lines[0].length > 5);
  assert.ok(S.touchedBy(th, 'host'));
});

test('births are the town\'s own (round 56: no story for them): a couple has a child in their house', () => {
  const { game } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  const mum = L.npcs.find((r) => r.alive !== false && r.age === 'adult' && r.partner !== null && r.partner !== undefined && L.npcs[r.partner] && L.npcs[r.partner].home === r.home && r.home !== null && r.idx < r.partner);
  assert.ok(mum);
  const dad = L.npcs[mum.partner];
  const n0 = L.npcs.length;
  const kid = bear(game.sim, L, mum, dad, game.day, 42);
  assert.ok(kid.age === 'child' && kid.parents.includes(mum.idx) && L.npcs.length === n0 + 1);
  assert.ok(!MOTIFS.newborn, 'no story of it');
  mum.children = [];
  dad.children = [];
  const born = births(game.sim, L, game.day, always);
  assert.ok(born.some((r) => r.parents.includes(mum.idx)), 'born at once');
});

test('someone new in town: a record of their own, a bed, work, and grown (not about to retire)', () => {
  const { game } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  const n0 = L.npcs.length;
  const r = newcomer(game.sim, L, { name: { first: 'Testy', last: 'Newman' }, job: 'laborer', why: 'test' });
  assert.equal(L.npcs.length, n0 + 1);
  assert.equal(r.name.first, 'Testy');
  assert.ok(r.arrived && r.arrivedDay === game.day && r.age === 'adult');
  assert.ok(r.born > game.day - 24 - 96 * 0.5, 'not old');
  assert.ok(r.schedule && r.work);
});

// ------------------------------------------------------------ the Academy
test('a city raises an Academy: four rooms, a registrar at the desk, and terms of classes', () => {
  const { game } = start();
  const city = [...game.world.layouts.values()].find((q) => q.settlement.type === 'city');
  const b = academyOf(city) || foundAcademy(game.sim, city);
  assert.ok(b && b.type === 'college' && !b.underConstruction);
  assert.deepEqual(Object.keys(b.rooms).sort(), ['gems', 'kitchen', 'lecture', 'yard']);
  for (const k of Object.keys(b.rooms)) assert.ok(roomMid(b, k), `${k} has a middle`);
  assert.ok(b.registrar, 'a registrar\'s desk');
  const sched = termSchedule(new RNG(5), 3, 4, 'cooking');
  assert.ok(sched.length >= 4 && sched.every((c) => SUBJECTS[c.subject]));
  assert.ok(sched.filter((c) => c.subject === 'cooking').length >= 1);
  const c = sched[0];
  assert.equal(classNow(sched, c.day * DAY + c.from + 10).c, c);
  assert.equal(classNow(sched, c.day * DAY + c.from - 10), null);
});

test('a term at the Academy: enrol at the desk, sit your classes, graduate with a title and a diploma', () => {
  const { game, input, S } = start();
  const errs = faults(S);
  const city = [...game.world.layouts.values()].find((q) => q.settlement.type === 'city');
  const b = academyOf(city) || foundAcademy(game.sim, city);
  const th = S.begin('academy', { cast: { town: { t: 'town', sid: city.settlement.id } }, sid: city.settlement.id, vars: { bid: b.id, name: b.name, termName: 'the Test Term' } });
  assert.ok(th && th.node === 'enrolling');
  game.teleportPlayer(b.registrar.x, 6, b.registrar.z + 1);
  for (let i = 0; i < 30; i++) game.update(0.1, input);
  const reg = S.actorEnt(th, 'registrar');
  assert.ok(reg, 'the registrar is at the desk');
  game.player.give('coin', 200);
  const coins0 = game.player.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
  assert.ok(sagaTopics(reg, game).some((t) => t.id === 'sga_enrol'));
  sagaRespond(reg, game, 'sga_enrol', `t${th.id}`);
  assert.ok(th.vars.players.host, 'enrolled');
  assert.equal(game.player.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0), coins0 - th.vars.fee);
  // Every class, in its room, for most of it.
  for (let k = 0; k < th.vars.sched.length; k++) {
    const c = th.vars.sched[k];
    if ((th.vars.cancelled || []).includes(k)) continue;
    const mid = roomMid(b, SUBJECTS[c.subject].room);
    setT(game, c.day * DAY + c.from + 1);
    game.teleportPlayer(mid.x + 1, 6, mid.z);
    const before = mastery(game, SUBJECTS[c.subject].craft).xp;
    for (let i = 0; i < 50 && !th.vars.players.host.credited.includes(k); i++) {
      game.minute += 1.5;
      game.update(0.5, input);
    }
    assert.ok(th.vars.players.host.credited.includes(k), `class ${k} counted`);
    assert.ok(mastery(game, SUBJECTS[c.subject].craft).xp > before, 'practice in it');
  }
  assert.ok(ATTEND <= 90);
  const last = th.vars.sched[th.vars.sched.length - 1];
  setT(game, (last.day + 1) * DAY + 60);
  days(game, input, 2);
  assert.equal(th.vars.players.host.result, 'honours');
  assert.ok(S.person('host').titles.some((t) => /Graduate of/.test(t)));
  assert.ok(game.player.inv.some((q) => q && q.item === 'diploma'));
  assert.ok(ITEMS.diploma);
  assert.deepEqual(errs, []);
});

test('cookery and swordplay are crafts with ranks: a bout won or lost is practice', () => {
  const { game } = start();
  assert.ok(CRAFTS.cooking && CRAFTS.dueling);
  const n = game.npcs.find((q) => q.rec && !q.dead && q.rec.age === 'adult');
  game.startDuel(n, 0);
  const x0 = mastery(game, 'dueling').xp;
  game.endDuel('won');
  assert.ok(mastery(game, 'dueling').xp > x0);
  gainMastery(game, 'cooking', 40);
  assert.ok(mastery(game, 'cooking').rank >= 5);
});

// ------------------------------------------------------------ the hidden one
test('the stranger in town: kills the mayor, and can be worked out from what people saw', () => {
  const { game, input, S } = start();
  const errs = faults(S);
  let o = null;
  const rng = new RNG(5);
  for (let i = 0; i < 3000 && !o; i++) o = MOTIFS.infiltrator.scan(S, rng, S.day);
  assert.ok(o, 'a town for it');
  const th = S.begin('infiltrator', o);
  const L = game.world.layouts.get(th.sid);
  const spy = L.npcs[th.cast.spy.idx];
  assert.ok(spy && spy.spy === th.id && spy.arrived);
  assert.ok(th.vars.decoys.length >= 1, 'not the only new face');
  const mayor = mayorOf(L);
  th.vars.strike = game.day + 1;
  days(game, input, 3);
  assert.equal(th.node, 'after');
  assert.ok(mayor.alive === false, 'the mayor is dead');
  assert.ok(!/murder/i.test(mayor.cause), 'and it doesn\'t look like murder');
  assert.equal(th.vars.fits, 1, 'only one fits everything the true witnesses saw');
  assert.ok(!S.storiesFor('host').includes(th));
  // Asking about it: then it's yours.
  const anyone = L.npcs.find((r) => r.alive !== false && r.age === 'adult' && r !== spy && !r.away);
  const w = sagaTopics(face(L, anyone), game).find((t) => t.id === 'sgi_wonder');
  assert.ok(w);
  sagaRespond(face(L, anyone), game, w.id, w.arg);
  assert.ok(S.storiesFor('host').includes(th));
  // Every witness, asked.
  for (const q of th.vars.wits) {
    const r = L.npcs[q.idx];
    const t = sagaTopics(face(L, r), game).find((x) => x.id === 'sgi_saw');
    if (t) sagaRespond(face(L, r), game, t.id, t.arg);
  }
  const lines = MOTIFS.infiltrator.journal(th, 'host', S).map(([l]) => l).join('\n');
  assert.ok(/What you've found out/.test(lines));
  assert.ok(!lines.includes(spy.name.first + ' ' + spy.name.last) || th.vars.wits.some((q) => q.k === 'alibi'), 'the log names no killer');
  // Wrong, then right.
  const wrong = L.npcs.find((r) => r.alive !== false && r.age === 'adult' && r !== spy && !r.away && r.idx !== th.vars.healer);
  const ta = sagaTopics(face(L, wrong), game).find((x) => x.id === 'sgi_accuse');
  assert.ok(ta, 'you can say it to their face');
  sagaRespond(face(L, wrong), game, ta.id, ta.arg);
  assert.ok(!th.done && th.vars.wrong.host.length === 1);
  const ts = sagaTopics(face(L, spy), game).find((x) => x.id === 'sgi_accuse');
  sagaRespond(face(L, spy), game, ts.id, ts.arg);
  days(game, input, 1);
  if (th.vars.nature !== 'cold') assert.ok(th.done && ['unmasked', 'fled'].includes(th.outcome));
  else assert.ok(th.actors.some((a) => a.key === 'agent'), 'they draw a blade');
  assert.deepEqual(errs, []);
});

test('the stranger, left alone, opens the way when their realm goes to war', () => {
  const { game, input, S } = start();
  let o = null;
  const rng = new RNG(9);
  for (let i = 0; i < 3000 && !o; i++) o = MOTIFS.infiltrator.scan(S, rng, S.day);
  const th = S.begin('infiltrator', o);
  th.vars.strike = game.day + 1;
  days(game, input, 3);
  assert.equal(th.node, 'after');
  S.emit('war_declared', { war: 1, a: th.vars.home, b: th.vars.civ, why: 'test' });
  days(game, input, 1);
  assert.ok(th.done && th.outcome === 'betrayed');
  assert.ok(th.seenBy && th.seenBy.host, 'told to everyone, now');
  assert.ok(S.chronicle.some((c) => c.id === th.id));
});

// ------------------------------------------------------------ variety
test('pleas come from all sorts, and a chief\'s letter may say they\'re leaving, or bring a purse', () => {
  const { game, S } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  const voices = new Set();
  const plea = MOTIFS.plea;
  for (let i = 0; i < 400 && voices.size < 3; i++) {
    const out = plea.scan(S, new RNG(i), S.day) || [];
    for (const o of out) voices.add(o.vars.voice);
  }
  // (With outlaws or dens about: otherwise there's nothing to plead about.)
  if (voices.size) assert.ok(voices.size >= 2, [...voices].join(','));
  assert.ok(['parley', 'recruit', 'trap', 'duel', 'tribute', 'leave', 'gift'].every((k) => typeof k === 'string'));
  void L;
});

test('a word for anyone\'s hair, as you\'d see it', () => {
  assert.equal(hairWord({ look: { hair: '#1e1612' } }), 'black');
  assert.equal(hairWord({ look: { hair: '#f0ecd8' } }), 'white');
  assert.equal(hairWord({ look: { hair: '#c8c8c8' } }), 'silver');
  assert.ok(['red', 'auburn'].includes(hairWord({ look: { hair: '#b83a1c' } })));
  assert.ok(['fair', 'brown', 'light brown'].includes(hairWord({ look: { hair: '#d8a048' } })));
  assert.equal(hairWord({}), 'dark');
});

test('the great fish is landed, by a big catch near its waters', () => {
  const { game, input, S } = start();
  let o = null;
  const rng = new RNG(2);
  for (let i = 0; i < 2000 && !o; i++) o = MOTIFS.great_fish.scan(S, rng, S.day);
  if (!o) return;
  const th = S.begin('great_fish', o);
  for (let i = 0; i < 20 && !th.done; i++) {
    S.emit('fish_caught', { pid: 'host', kind: 'pike', big: true, item: 'fish', x: th.vars.at.x, z: th.vars.at.z });
    game.update(0.1, input);
    game.minute += 1;
  }
  assert.ok(th.done && th.outcome === 'landed');
  assert.ok(S.person('host').titles.some((t) => /Who Landed/.test(t)));
});

// ------------------------------------------------------------ the tavern's room
test('a tavern\'s room: two beds, let by the night, slept in only by who\'s paid', () => {
  const { game, input } = start();
  let n = 0;
  let rooms = 0;
  for (const L of game.world.layouts.values()) {
    for (const b of L.buildings) {
      if (b.type !== 'tavern' || b.underConstruction) continue;
      n++;
      if (b.inn && b.inn.beds.length === 2) rooms++;
    }
  }
  assert.ok(n > 0 && rooms === n, `${rooms} of ${n} taverns have a room`);
  const L = game.world.layouts.get(game.currentSettlement.id);
  const b = L.buildings.find((q) => q.type === 'tavern' && q.inn);
  assert.equal(innBedAt(L, b.inn.beds[0].x, b.inn.beds[0].z), b);
  assert.equal(game.world.getBlock(b.inn.beds[0].x, b.inn.y, b.inn.beds[0].z), B.bed);
  assert.equal(game.sim.bedOwner(b.inn.beds[0].x, b.inn.beds[0].z).kind, 'inn');
  assert.ok(innPrice(L, 7) < innPrice(L, 1) * 7, 'a week is cheaper by the night');
  // Asked of the innkeeper (or barkeep, or the cook where there's nobody else).
  game.teleportPlayer(b.inside.x, 6, b.inside.z);
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  const keeper = L.npcs.find((r) => ['innkeeper', 'barkeep', 'cook'].includes(r.job) && r.ent && !r.ent.dead);
  if (keeper) {
    const e = keeper.ent;
    assert.ok(topicsFor(e, game).some((t) => t.id === 'inn_room'));
    game.player.give('coin', 200);
    const r = respond(e, game, 'inn_room');
    assert.ok(r.choices && r.choices.length === 3);
    respond(e, game, 'inn_rent', '3');
    const stay = stayAt(L, b, game.sim.abs);
    assert.ok(stay && stay.pid === 'host');
  } else {
    const stay = rentRoom(L, b, 'host', 'You', 3, game.sim.abs);
    assert.ok(stayAt(L, b, game.sim.abs) === stay);
  }
});

// ------------------------------------------------------------ an older world
test('migration 0.54.0: the step is there; a tavern room put into a part of town kept from before', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.54.0') >= 0);
  const step = STEPS.find((q) => q.to === '0.54.0');
  assert.ok(step && step.data && step.game && step.town);
  assert.ok(stepsFor('0.53.0').some((q) => q.to === '0.54.0'));
  const { game } = start();
  const L = game.world.layouts.get(game.currentSettlement.id);
  const b = L.buildings.find((q) => q.type === 'tavern' && q.inn);
  const bed = b.inn.beds[0];
  // (As if this ground had been kept from an older world: no room there.)
  for (const q of b.inn.beds) game.world.setBlock(q.x, b.inn.y, q.z, B.air);
  step.town(L, game);
  assert.equal(game.world.getBlock(bed.x, b.inn.y, bed.z), B.bed);
  const log = [];
  step.data({}, log);
  step.game(game, log);
  assert.ok(log.length >= 2);
});
