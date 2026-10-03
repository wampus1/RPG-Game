import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world/world.js';
import { activityAt, JOBS, HOBBIES } from '../src/entities/npcgen.js';
import { makeGame, stubInput } from './helpers.mjs';

function allNpcs(seed) {
  const w = new World(seed);
  const out = [];
  for (const s of w.ow.settlements) {
    if (s.condition === 'abandoned') continue;
    const L = w.getLayout(s);
    out.push({ s, L });
  }
  return out;
}

test('every NPC has a job, personality, hobbies, equipment and a full-day schedule', () => {
  for (const { L } of allNpcs(12345).slice(0, 12)) {
    for (const n of L.npcs) {
      assert.ok(JOBS[n.job], `job ${n.job}`);
      assert.ok(n.traits.length > 0);
      assert.ok(n.hobbies.length >= 1 && n.hobbies.every((h) => HOBBIES[h]));
      assert.ok(n.equipment && Array.isArray(n.equipment.items));
      for (const sched of [n.schedule.work, n.schedule.rest]) {
        assert.equal(sched[0].s, 0);
        assert.equal(sched[sched.length - 1].e, 1440);
        for (let i = 1; i < sched.length; i++) assert.equal(sched[i].s, sched[i - 1].e, 'schedule gap');
        assert.ok(sched.some((e) => e.act === 'sleep'));
      }
      if (n.age === 'adult' && n.job !== 'retired') assert.ok(n.schedule.work.some((e) => e.act === 'work'), `${n.job} never works`);
    }
  }
});

test('homes are only shared by members of the same family', () => {
  for (const { L } of allNpcs(4242)) {
    const byHome = new Map();
    for (const n of L.npcs) {
      if (!byHome.has(n.home)) byHome.set(n.home, []);
      byHome.get(n.home).push(n);
    }
    for (const [, members] of byHome) {
      if (members.length < 2) continue;
      // Everyone sharing a house is connected by partner/parent/child links.
      const ids = new Set(members.map((m) => m.idx));
      for (const m of members) {
        const linked = [m.partner, ...m.children, ...m.parents].some((i) => ids.has(i)) || members.every((o) => o.household === m.household);
        assert.ok(linked, `${m.name.first} shares a home with strangers`);
      }
      // A house hosts exactly one household.
      assert.equal(new Set(members.map((m) => m.household)).size, 1);
    }
  }
});

test('schedules are offset between NPCs (people wake at different times)', () => {
  const { L } = allNpcs(12345).find((x) => x.s.type === 'town');
  const wakes = L.npcs.filter((n) => n.age === 'adult').map((n) => n.schedule.work.find((e) => e.act !== 'sleep').s);
  assert.ok(new Set(wakes).size > wakes.length / 2, 'wake times should vary');
});

test('population scales with settlement size', () => {
  const list = allNpcs(4242);
  const avg = (t) => {
    const xs = list.filter((x) => x.s.type === t).map((x) => x.L.npcs.length);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  assert.ok(avg('village') < avg('town'));
  assert.ok(avg('town') < avg('city'));
});

test('NPCs walk to their scheduled places over a simulated day', () => {
  const game = makeGame(12345);
  const input = stubInput();
  const dt = 0.1;
  const report = {};
  // Start at 5:30 and simulate until ~23:30 in 3 checkpoints.
  game.minute = 5 * 60 + 30;
  for (const n of game.npcs) {
    n.activity = null;
    n.placeForCurrentActivity();
  }
  const checkpoints = [9 * 60, 13 * 60, 23 * 60 + 30];
  const moved = new Set();
  const start = new Map(game.npcs.map((n) => [n.id, `${n.x},${n.z}`]));
  // Whoever isn't there yet at a checkpoint must be on the way: within the
  // hour they get there (or their day moves them on to something else).
  const pending = new Map();
  const late = [];
  const settle = () => {
    for (const [n, p] of pending) {
      if (n.dead || n.atGoal || n.sleeping || n.activity !== p.activity) pending.delete(n);
      else if (game.minute - p.since > 60) {
        late.push(`${n.rec.job} at ${n.x},${n.z} for ${n.goal ? `${n.goal.x},${n.goal.z}` : '?'} since ${Math.round(p.since)}`);
        pending.delete(n);
      }
    }
  };
  for (const cp of checkpoints) {
    let guard = 0;
    while (game.minute < cp && guard++ < 200000) {
      game.update(dt, input);
      for (const n of game.npcs) if (`${n.x},${n.z}` !== start.get(n.id)) moved.add(n.id);
      settle();
    }
    const alive = game.npcs.filter((n) => !n.dead);
    const atGoal = alive.filter((n) => n.atGoal || n.sleeping).length;
    const onWay = alive.filter((n) => !n.atGoal && !n.sleeping && n.goal && n.path && n.path.length).length;
    report[cp] = { atGoal, onWay, total: alive.length, sleeping: alive.filter((n) => n.sleeping).length };
    for (const n of alive) if (!n.atGoal && !n.sleeping) pending.set(n, { activity: n.activity, since: game.minute });
  }
  for (let guard = 0; pending.size && guard < 200000; guard++) {
    game.update(dt, input);
    settle();
  }
  const alive = game.npcs.filter((n) => !n.dead);
  assert.ok(alive.length > 5);
  assert.ok(moved.size >= alive.length * 0.6, `only ${moved.size}/${alive.length} NPCs moved`);
  // At each checkpoint most people are where they want to be, or walking
  // there (a change of shift has some crossing town), and a good share are
  // already there...
  for (const cp of checkpoints) {
    const r = report[cp];
    assert.ok(r.atGoal + r.onWay >= r.total * 0.75 && r.atGoal >= r.total * 0.4, `checkpoint ${cp}: ${JSON.stringify(r)}`);
  }
  // ...and nobody's stuck on the way.
  assert.ok(late.length <= 1, `still not there an hour on: ${late.join('; ')}`);
  // Late at night most are asleep.
  assert.ok(report[23 * 60 + 30].sleeping >= report[23 * 60 + 30].total * 0.5, JSON.stringify(report));
});

test('attacking a villager makes people fight, flee or call guards', () => {
  const game = makeGame(12345);
  game.minute = 12 * 60;
  const input = stubInput();
  for (let i = 0; i < 20; i++) game.update(0.05, input);
  const victim = game.npcs.find((n) => !n.dead && n.rec.job !== 'guard' && !n.sleeping);
  game.player.teleport(victim.x + 1, victim.y, victim.z);
  game.player.attackCd = 0;
  game.attack(victim);
  // (The blow is wound up first, then lands: before they can walk off.)
  if (game.player.swing) game.player.swing.t = game.player.swing.dur;
  game.update(0.01, input);
  assert.ok(['fight', 'flee', 'alert'].includes(victim.state), victim.state);
  assert.ok(game.isWanted(victim.settlement.id));
  for (let i = 0; i < 40; i++) game.update(0.1, input);
  const guards = game.guardsOf(victim.settlement.id);
  if (guards.length) assert.ok(guards.some((g) => g.state === 'fight'), 'guards should respond');
});

test('activityAt maps every minute to an entry', () => {
  const w = new World(1);
  const L = w.getLayout(w.ow.spawnSettlement);
  const n = L.npcs[0];
  for (let m = 0; m < 1440; m += 7) assert.ok(activityAt(n, m, 3).entry);
});
