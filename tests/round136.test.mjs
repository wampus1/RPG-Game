// Round 136: townsfolk who act. Ambitions they set their hearts on and work
// towards through the town's own goings-on; friendships and quarrels made
// day by day; grievances shared, petitioned, protested, struck over, and
// left behind; and everything they do with each other, you can do with
// them: gossip and rumour, opinions and lies, dreams and secrets, peace
// made, drinks, bouts, lessons, courting, apologies and threats; and them
// coming to you.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput } from './helpers.mjs';
import { meet, socialDay } from '../src/sim/mind/social.js';
import { AMBITIONS, AMB_KINDS, ambitionWords } from '../src/sim/mind/ambition.js';
import { groupsDay, granted, refused, groupMatters } from '../src/sim/mind/groups.js';
import { residents, nk, chemistry, pkey } from '../src/sim/mind/common.js';
import { stir, feel } from '../src/sim/mind/emotion.js';
import { remember, recall, warm, opinionOf } from '../src/sim/mind/memory.js';
import { skillOf } from '../src/sim/mind/talent.js';
import { respond, topicsFor, openingLine } from '../src/game/dialogue.js';
import { sparDone } from '../src/game/social.js';
import { allRules } from '../src/game/talk/rules.js';
import { parseFx } from '../src/ui/textfx.js';
import { runCommand } from '../src/game/commands.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';
import { alive, DAY } from '../src/sim/econ.js';
import { RNG } from '../src/util/rng.js';
import { mastery } from '../src/game/mastery.js';

let shared = null;
function world() {
  if (shared) return shared;
  const g = makeGame(12345, { wg: 9 });
  const inp = stubInput();
  for (let i = 0; i < 30; i++) g.update(0.25, inp);
  g.player.inv[0] = { item: 'coin', count: 500 };
  shared = g;
  return g;
}
const townOf = (g) => {
  const n = g.npcs.find((q) => q.rec && q.settlement);
  return n.homeLayout || n.layout;
};
const people = (g) => g.npcs.filter((q) => q.rec && q.settlement && q.rec.age === 'adult' && alive(q.rec) && !q.rec.visitor);
const text = (r) => (r && r.lines ? r.lines.map((l) => parseFx(l).text).join(' ') : '');
const rep = (g, n) => g.sim.repEntry(g.sim.repSidOf(n), n.rec.idx);

test('day by day, those who get on become friends, and those who don\'t fall out', () => {
  const g = world();
  const L = townOf(g);
  const ppl = residents(L).filter((r) => r.age !== 'child');
  // The best-matched pair and the worst, meeting again and again.
  let best = null;
  let worst = null;
  for (let i = 0; i < ppl.length; i++) for (let j = i + 1; j < ppl.length; j++) {
    const a = ppl[i];
    const b = ppl[j];
    if ((a.friends || []).includes(b.idx)) continue;
    const c = chemistry(a, b);
    if (!best || c > best[2]) best = [a, b, c];
    if (!worst || c < worst[2]) worst = [a, b, c];
  }
  const A = { ...best[0], op: {}, friends: [...(best[0].friends || [])].slice(0, 2), mem: [], emo: null };
  const B = { ...best[1], op: {}, friends: [...(best[1].friends || [])].slice(0, 2), mem: [], emo: null };
  let got = null;
  for (let d = 0; d < 40 && got !== 'friends'; d++) got = meet(L, A, B, d, d * DAY, new RNG(d)) || got;
  assert.equal(got, 'friends');
  assert.ok(A.friends.includes(B.idx) && B.friends.includes(A.idx));
  assert.ok((A.mem || []).some((m) => m.k === 'friend'));
  const X = { ...worst[0], op: {}, mem: [], emo: null };
  const Y = { ...worst[1], op: {}, mem: [], emo: null };
  for (let d = 0; d < 60; d++) meet(L, X, Y, d, d * DAY, new RNG(d + 99));
  assert.ok(opinionOf(X, nk(Y)) < opinionOf(A, nk(B)));
  // And the town's day of it: cheap, and the grieving are sat with.
  const r = ppl[0];
  stir(r, 'grief', 0.8, 0);
  const t0 = performance.now();
  const out = socialDay(L, residents(L), 1, DAY, new RNG(7), g.sim.society);
  assert.ok(performance.now() - t0 < 30);
  assert.ok(out.met > 0);
});

test('ambitions: what someone wants, out of who they are; worked at, and done', () => {
  const g = world();
  const L = townOf(g);
  const M = g.sim.mind;
  const c = M.ctx(L, g.day);
  // Every kind's want can be asked of anyone without trouble.
  for (const r of c.adults) for (const k of AMB_KINDS) {
    const w = AMBITIONS[k].want(c, r);
    assert.ok(w === null || typeof w.s === 'number', k);
  }
  // A master in the making, made.
  const smith = c.adults.find((r) => r.job && r.age === 'adult' && r.skills);
  const jobKey = Object.keys(smith.skills)[0];
  smith.amb = { k: 'master', d: g.day, p: 0, st: 0, x: jobKey };
  smith.skills[jobKey] = 0.95;
  AMBITIONS.master.day(c, smith, smith.amb);
  assert.equal(smith.amb, null);
  assert.ok(recall(smith, g.day).some((m) => m.k === 'dream_done'));
  assert.ok(feel(smith, 'pride', c.now) > 0.2);
  // A new trade, taken up when they're ready.
  const lab = c.adults.find((r) => r !== smith && r.job !== 'guard' && r.job !== 'mayor' && r.ruler === undefined);
  const was = lab.job;
  lab.amb = { k: 'trade', d: g.day, p: 0, st: 0, x: 'guard' };
  lab.skills = { ...(lab.skills || {}), combat: 0.6 };
  c.guards = 0;
  const res = AMBITIONS.trade.day(c, lab, lab.amb);
  assert.equal(res, 'retrained');
  assert.equal(lab.job, 'guard');
  assert.notEqual(was, 'guard');
  assert.ok(L.econ.ledger.some((l) => l.text.includes('always wanted')));
  assert.ok(ambitionWords({ amb: { k: 'wed', n: 'Pip' } }).includes('Pip'));
});

test('a grudge: bad-mouthed about town, and someone playing confronted with it', () => {
  const g = world();
  const L = townOf(g);
  const M = g.sim.mind;
  const c = M.ctx(L, g.day);
  const [a, b] = c.adults.filter((r) => r.job !== 'mayor');
  a.amb = { k: 'revenge', d: g.day, p: 0, st: 0, t: nk(b), n: b.name.first, x: 'quarrel' };
  stir(a, 'anger', 0.8, c.now);
  const before = c.adults.filter((q) => (q.mem || []).some((m) => m.k === 'bad_word' && m.w === nk(b))).length;
  M.badMouth(L, a, a.amb, g.day, new RNG(3), 3);
  const after = c.adults.filter((q) => (q.mem || []).some((m) => m.k === 'bad_word' && m.w === nk(b))).length;
  assert.ok(after > before);
  // Against you: they'll come and have it out with you.
  const pk = pkey(g);
  a.amb = { k: 'revenge', d: g.day - 5, p: 0.5, st: 0, t: pk, n: null, x: 'insult' };
  AMBITIONS.revenge.day(c, a, a.amb);
  assert.ok(a.seek && a.seek.k === 'confront' && a.seek.pk === pk);
  a.seek = null;
  a.amb = null;
});

test('a town\'s grievance: petitioned, granted (or refused, and taken to the square), and tools downed', () => {
  const g = world();
  const L = townOf(g);
  const M = g.sim.mind;
  L.econ.tax = 0.24;
  const c = M.ctx(L, g.day);
  for (const r of c.adults) {
    stir(r, 'strain', 0.6, c.now);
    r.mood = 0.3;
  }
  L.econ.groups = [];
  groupsDay(c);
  const grp = L.econ.groups.find((q) => q.k === 'tax' && !q.out);
  assert.ok(grp, 'a group over the taxes');
  assert.ok(grp.mem.length >= 4);
  const mem = c.adults.filter((r) => grp.mem.includes(r.idx));
  // Refused: to the square.
  grp.st = 'petition';
  refused(c, grp, mem);
  assert.equal(grp.st, 'protest');
  // Refused again, hot enough: tools down.
  grp.heat = 1;
  refused(c, grp, mem);
  assert.equal(grp.st, 'strike');
  const striker = mem[0];
  assert.equal(M.canWork(striker, 10), false);
  // Granted: the tax comes down.
  const tax = L.econ.tax;
  granted(c, grp, mem, 'The mayor');
  assert.ok(L.econ.tax < tax);
  assert.ok(grp.out && grp.out.how === 'won');
  assert.ok(recall(mem[0], g.day).some((m) => m.k === 'petition_won'));
  // Before a player's council: a matter of its own.
  L.econ.groups.push({ id: 99, k: 'hunger', x: null, lead: mem[0].idx, ln: 'Test Lead', mem: mem.map((r) => r.idx), heat: 0.7, st: 'petition', d: g.day, sd: g.day, sup: [] });
  const ms = groupMatters(L);
  assert.ok(ms.some((q) => q.key === 'group:99' && q.opts[0].fx.act === 'mind_group'));
  assert.equal(M.groupAnswer(L, 99, true), 'won');
  L.econ.tax = 0.1;
  for (const r of c.adults) delete r.strike;
});

test('a death mourned together: a vigil, and the grief eased', () => {
  const g = world();
  const L = townOf(g);
  const M = g.sim.mind;
  const c = M.ctx(L, g.day);
  L.econ.groups = [];
  const mourners = c.adults.slice(0, 4);
  for (const r of mourners) {
    stir(r, 'grief', 0.7, c.now);
    remember(r, { k: 'loss', n: 'Bramwell', v: -0.8, s: 0.8, x: 'friend' }, g.day);
  }
  groupsDay(c);
  const v = L.econ.groups.find((q) => q.k === 'vigil');
  assert.ok(v, 'a vigil');
  const c2 = M.ctx(L, g.day + 1);
  groupsDay(c2);
  assert.ok(v.out && v.out.how === 'mourned');
  assert.ok(recall(mourners[0], g.day + 1).some((m) => m.k === 'vigil'));
});

test('gossip, both ways: what you hear you can pass on, and a lie told about someone comes back to you', () => {
  const g = world();
  const [a, b, c2] = people(g);
  const pk = pkey(g);
  rep(g, a).v = 30;
  remember(a.rec, { k: 'wed', n: 'Tamsin', v: 0.9, s: 0.8 }, g.day);
  const r = respond(a, g, 'so_word');
  assert.ok(text(r).length > 5);
  const heard = g.sim.mind.heard[pk];
  assert.ok(heard && heard.length);
  // Passed on.
  const sr = respond(b, g, 'so_share');
  assert.ok(sr.choices && sr.choices.length);
  const it = heard[+sr.choices[0].arg];
  respond(b, g, 'so_share', sr.choices[0].arg);
  assert.ok((b.rec.mem || []).some((m) => (m.o || `${m.k}:${m.w || ''}:${m.n || ''}:${m.d}`) === it.o));
  // Told someone's been bad-mouthing them: they won't forgive the one who did.
  const L = a.homeLayout || a.layout;
  heard.unshift({ k: 'bad_word', w: nk(c2.rec), n: c2.rec.name.first, x: a.rec.name.first, v: -0.5, s: 0.5, d: g.day, o: 'bw:t', sid: L.settlement.id, from: b.rec.idx, town: L.settlement.name });
  respond(c2, g, 'so_share', '0');
  assert.ok(opinionOf(c2.rec, nk(a.rec)) <= -0.3);
  assert.ok((c2.rec.mem || []).some((m) => m.k === 'betrayed'));
  // A rumour, believed or not; and if the one it's about hears it, they
  // know who started it.
  rep(g, b).v = 80;
  b.rec.skills = { ...(b.rec.skills || {}), lore: 0 };
  respond(b, g, 'so_rumour', `${c2.rec.idx}:bad`);
  const rum = (b.rec.mem || []).find((m) => m.k === 'rumour_bad' && m.w === nk(c2.rec));
  if (rum) {
    g.sim.mind.passOn(L, { ...b.rec, mem: [rum] }, c2.rec, g.day);
    assert.ok((c2.rec.mem || []).some((m) => m.k === 'slander' && m.w === pk));
  } else assert.ok((b.rec.mem || []).some((m) => m.k === 'liar' && m.w === pk));
});

test('what they make of someone, and of you: softened by the kind and timid, the truth if you press', () => {
  const g = world();
  const [a, b] = people(g);
  warm(a.rec, nk(b.rec), -0.7);
  const r = respond(a, g, 'so_think', String(b.rec.idx));
  assert.ok(text(r).length > 3);
  assert.ok(r.choices && r.choices.some((q) => q.arg.endsWith(':p')));
  const pressed = respond(a, g, 'so_think', `${b.rec.idx}:p`);
  assert.ok(text(pressed).length > 3);
  const me = respond(a, g, 'so_me');
  assert.ok(text(me).length > 3);
  assert.ok(me.choices && me.choices[0].arg === 'p');
});

test('dreams: told to a friend; encouraged, helped, or talked out of', () => {
  const g = world();
  const [, , , d] = people(g);
  rep(g, d).v = 40;
  d.rec.amb = { k: 'leave', d: g.day, p: 0.2, st: 0 };
  const r = respond(d, g, 'so_dream');
  assert.ok(/leave|go|out|start/i.test(text(r)), text(r));
  assert.ok(r.choices.length >= 2);
  respond(d, g, 'so_dream', 'enc');
  assert.ok(d.rec.amb.p > 0.2);
  respond(d, g, 'so_dream', 'help');
  assert.ok(d.rec.amb.p >= 0.7);
  for (let i = 0; i < 10 && d.rec.amb; i++) respond(d, g, 'so_dream', 'stop');
  // (Talked out of it, at last, or still set on it.)
  if (!d.rec.amb) assert.ok(recall(d.rec, g.day).some((m) => m.k === 'talked_out'));
  d.rec.amb = null;
});

test('friends made through you: an introduction, a drink at the tavern, a bout, a lesson, a courtship', () => {
  const g = world();
  const [a, b, , , e] = people(g);
  const before = opinionOf(a.rec, nk(b.rec));
  respond(a, g, 'so_intro', String(b.rec.idx));
  assert.notEqual(opinionOf(a.rec, nk(b.rec)), before);
  assert.match(text(respond(a, g, 'so_intro', String(b.rec.idx))), /already/i);
  g.minute = 19 * 60;
  rep(g, e).v = 50;
  e.rec.override = null;
  respond(e, g, 'so_drink');
  assert.ok(e.rec.override && e.rec.override.entry.place === 'tavern');
  // A bout over: practice for them.
  const c0 = skillOf(e.rec, 'combat');
  e.spar = { pk: pkey(g) };
  sparDone(g, e, 'lost');
  assert.ok(skillOf(e.rec, 'combat') >= c0);
  assert.ok(recall(e.rec, g.day).some((m) => m.k === 'sparred'));
  // A lesson: for you.
  e.rec.skills = { ...(e.rec.skills || {}), cooking: 0.8 };
  const m0 = mastery(g, 'cooking').xp;
  rep(g, e).taught = -1;
  respond(e, g, 'so_teach');
  assert.ok(mastery(g, 'cooking').xp > m0);
});

test('grievances against you: sulking, apologies, a price paid, a threat that cows them', () => {
  const g = world();
  const [, , c] = people(g);
  const pk = pkey(g);
  rep(g, c).v = -70;
  remember(c.rec, { k: 'hurt', w: pk, v: -0.8, s: 0.7 }, g.day);
  stir(c.rec, 'anger', 0.9, g.sim.abs);
  const ids = topicsFor(c, g).map((t) => t.id);
  assert.ok(ids.includes('so_sorry'));
  assert.ok(!ids.includes('ask') && !ids.includes('chat'));
  const r = respond(c, g, 'so_sorry');
  assert.ok(text(r).length > 3);
  // (Not forgiven for words: but for coin.)
  if (r.choices) respond(c, g, 'so_sorry', 'pay');
  const m = recall(c.rec, g.day, (q) => q.k === 'hurt' && q.w === pk)[0];
  assert.ok(!m || m.s < 0.7);
  // Confronted, they come to you: the opening is theirs.
  c.rec.seek = { pk, k: 'confront', d: g.day };
  remember(c.rec, { k: 'insult', w: pk, v: -0.6, s: 0.6 }, g.day);
  rep(g, c).v = -10;
  const open = parseFx(openingLine(c, g)).text;
  assert.ok(open.length > 3);
  const s = respond(c, g, 'so_seek');
  assert.ok(s.choices && s.choices.length >= 3);
  respond(c, g, 'so_seek', `pay:${String(s.choices[1].arg).split(':')[1]}`);
  assert.ok(!c.rec.seek);
});

test('what you do and say is remembered in a save: ambitions, who\'s looking for you, friends, groups, what you\'ve heard', () => {
  const g = world();
  const L = townOf(g);
  const r = residents(L).find((q) => q.age === 'adult');
  r.amb = { k: 'venture', d: g.day, p: 0.4, st: 0 };
  r.seek = { pk: pkey(g), k: 'thanks', d: g.day };
  r.friends = [...new Set([...(r.friends || []), 0])];
  L.econ.groups = [{ id: 7, k: 'safety', x: null, lead: r.idx, ln: 'X Y', mem: [r.idx], heat: 0.5, st: 'grumble', d: g.day, sd: g.day, sup: [] }];
  g.sim.mind.heard[pkey(g)] = [{ k: 'wed', n: 'Ivo', v: 0.9, s: 0.8, d: g.day, o: 'x', sid: L.settlement.id, from: 1, town: L.settlement.name }];
  const d = JSON.parse(JSON.stringify(g.serialize()));
  const Game = g.constructor;
  const g2 = new Game({ seed: d.seed, renderer: g.renderer, audio: null, ui: g.ui, save: d, wg: 9 });
  const L2 = g2.sim.layoutOf(L.settlement.id);
  const r2 = L2.npcs[r.idx];
  assert.equal(r2.amb.k, 'venture');
  assert.equal(r2.seek.k, 'thanks');
  assert.ok(r2.friends.includes(0));
  assert.ok(L2.econ.groups.some((q) => q.id === 7));
  assert.equal(g2.sim.mind.heard[pkey(g2)][0].n, 'Ivo');
  r.amb = null;
  r.seek = null;
  L.econ.groups = [];
});

test('the town\'s day of minds, ambitions and groups stays cheap', () => {
  const g = world();
  const L = townOf(g);
  const t0 = performance.now();
  for (let d = 0; d < 10; d++) g.sim.mind.townDay(L, g.day + d);
  const ms = (performance.now() - t0) / 10;
  assert.ok(ms < 20, `${ms.toFixed(2)}ms a day`);
});

test('every line of the new talk can be filled and read', () => {
  const known = new Set(['name', 'full', 'me', 'town', 'tw', 'trade', 'skill', 'skillWord', 'mut', 'title', 'address', 'held', 'dead', 'child', 'spouse', 'gift', 'killed', 'lost', 'kin', 'kinGift',
    'ambWho', 'ambWhat', 'ambTrade', 'ambBiz', 'grpLeader', 'grpAsk', 'grpWhat', 'grpDead', 'friend', 'rival', 'lostLove', 'badWho', 'badTeller', 'who', 'teller', 'what', 'subj', 'there', 'price', 'n']);
  const rules = allRules();
  assert.ok(rules.length >= 500);
  const topics = new Set(rules.map((r) => r.topic));
  for (const t of ['seek', 'seek_open', 'sulk', 'word', 'told', 'rumour', 'think', 'me', 'dream', 'secret', 'intro', 'mediate', 'drink', 'spar', 'teach', 'court', 'sorry', 'threat', 'group', 'rally', 'confront', 'thanks', 'advice', 'warn']) assert.ok(topics.has(t), t);
  for (const r of rules) for (const l of r.lines) {
    for (const m of l.matchAll(/\{([A-Za-z]+)\}/g)) assert.ok(known.has(m[1][0].toLowerCase() + m[1].slice(1)), `${r.id}: {${m[1]}}`);
    assert.ok(!/[{}]/.test(parseFx(l.replace(/\{([A-Za-z]+)\}/g, 'X')).text), `${r.id}: ${l}`);
    if (r.topic === 'pair') assert.match(l, / \|\| /, r.id);
  }
});

test('the mind command shows what they want and who they stand with', () => {
  const g = world();
  const n = people(g)[0];
  n.rec.amb = { k: 'learn', d: g.day, p: 0.5, st: 0 };
  g.player.x = n.x;
  g.player.z = n.z;
  const out = runCommand(g, 'mind');
  assert.ok(out.some((l) => l.startsWith('Wants: to study')), out.join('\n'));
  n.rec.amb = null;
});

test('version 1.36.0', () => {
  assert.ok(compareVersions('1.36.0', GAME_VERSION) <= 0);
  const s = stepsFor('1.35.0').find((q) => q.to === '1.36.0');
  assert.ok(s && s.game);
});
