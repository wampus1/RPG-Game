// Round 52: the world's stories. Everything that happens out there (a
// woodcutter who ran into outlaws, a pack denned up in the woods, a child
// gone missing, a contract on someone playing) is a story that goes on
// whether anyone's watching or not, grows, and turns into other stories;
// tasks are what the people in them ask of you (with a ! over their heads),
// taken on by you, by others playing, or by the town's guards and passing
// adventurers; captors strip you of your weapons, armour, gold, relics and
// Kavorent tech and lock you in a cage; and those playing can take
// contracts on each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, stubInput, stubUI } from './helpers.mjs';
import { MOTIFS, R, pidOf, NEAR } from '../src/sim/saga/core.js';
import { sagaTopics, sagaRespond } from '../src/sim/saga/talk.js';
import { seizable, seize } from '../src/sim/saga/motifs/captive.js';
import { makeDen } from '../src/sim/saga/motifs/beasts.js';
import { topicsFor } from '../src/game/dialogue.js';
import { QuestWindow, questSummary } from '../src/ui/quests.js';
import { LedgerWindow } from '../src/ui/windows.js';
import { Grid } from '../src/ui/ascii.js';
import { ITEMS } from '../src/world/items.js';
import { STEPS, stepsFor } from '../src/game/migrate.js';
import { GAME_VERSION } from '../src/version.js';
import { asSeat } from '../src/game/party.js';
import { HostNet } from '../src/net/host.js';
import { alive, mayorOf } from '../src/sim/econ.js';
import { RNG } from '../src/util/rng.js';

function start(seed = 12345) {
  const game = makeGame(seed);
  const input = stubInput();
  game.minute = 10 * 60;
  for (let i = 0; i < 20; i++) game.update(0.1, input);
  return { game, input, p: game.player, S: game.sim.saga };
}
const run = (game, input, n = 10) => {
  for (let i = 0; i < n; i++) game.update(0.1, input);
};
const coins = (p) => p.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
// (Quiet: the stories say when something's gone wrong in them.)
function quiet(fn) {
  const warns = [];
  const w = console.warn;
  console.warn = (...a) => warns.push(a.map(String).join(' '));
  try {
    fn();
  } finally {
    console.warn = w;
  }
  return warns;
}
// The town you're standing in, and someone grown in it walking about.
function townFolk(game, input) {
  const s = game.currentSettlement || game.world.ow.settlements.find((o) => game.world.layouts.get(o.id));
  const L = game.world.layouts.get(s.id);
  const m = mayorOf(L);
  if (m && (!m.ent || m.ent.dead)) {
    const at = L.settlement.bounds;
    game.teleportPlayer(Math.round((at.x0 + at.x1) / 2), 6, Math.round((at.z0 + at.z1) / 2));
    run(game, input, 20);
  }
  return { s, L, m };
}
// A window drawn: nothing put outside it.
function drawsInside(w, game, what) {
  const g = new Grid(w.w, w.h);
  const outside = [];
  const put = g.put.bind(g);
  g.put = (x, y, ch, ...rest) => {
    if ((x < 0 || y < 0 || x >= g.w || y >= g.h) && ch !== ' ') outside.push(`${x},${y} '${ch}'`);
    return put(x, y, ch, ...rest);
  };
  w.hits = [];
  w.draw(g, game);
  assert.deepEqual(outside, [], `${what}: drawn off the window`);
  return g;
}
const text = (g) => {
  const rows = [];
  for (let y = 0; y < g.h; y++) {
    let r = '';
    for (let x = 0; x < g.w; x++) r += (g.cells ? g.cells[y * g.w + x]?.ch : g.get?.(x, y)?.ch) || ' ';
    rows.push(r);
  }
  return rows.join('\n');
};

test('the stories: every kind is well formed, and plenty of them', () => {
  const ids = Object.keys(MOTIFS);
  assert.ok(ids.length >= 36, `${ids.length} kinds of story`);
  for (const id of ids) {
    const M = MOTIFS[id];
    assert.ok(M.nodes && Object.keys(M.nodes).length, `${id} has nodes`);
    const first = M.start || Object.keys(M.nodes)[0];
    assert.ok(M.nodes[first], `${id} starts somewhere`);
    for (const sd of M.seeds || []) assert.ok(typeof sd.on === 'string' && typeof sd.make === 'function', `${id}: a seed listens for something`);
    for (const [role, h] of Object.entries(M.tasks || {})) assert.equal(typeof h, 'object', `${id}.${role}`);
  }
  for (const k of ['plea', 'den', 'alpha', 'grudge', 'captive', 'reclaim', 'legend', 'contract', 'bounty', 'beacons', 'lost_child', 'fever', 'vendetta', 'murder', 'relic', 'pilgrim', 'core_hunt', 'war_orders', 'stronghold', 'outlaw_work']) assert.ok(MOTIFS[k], k);
});

test('the stories: weeks go by in three worlds without anything going wrong, and they lead on to one another', () => {
  let ended = 0;
  for (const seed of [12345, 777]) {
    const { game, input, S } = start(seed);
    const warns = quiet(() => {
      for (let d = 0; d < 8; d++) {
        for (let h = 0; h < 24; h++) {
          game.minute += 60;
          if (game.minute >= 1440) {
            game.minute -= 1440;
            game.day++;
          }
          for (let k = 0; k < 2; k++) game.update(0.2, input);
        }
      }
    });
    assert.deepEqual(warns.filter((w) => /^saga/.test(w)), [], `seed ${seed}`);
    assert.ok(S.threads.length >= 5, `seed ${seed}: ${S.threads.length} stories`);
    const kinds = new Set(S.threads.map((t) => t.m));
    assert.ok(kinds.size >= 3, `seed ${seed}: ${[...kinds]}`);
    assert.ok(S.threads.some((t) => t.tasks.length), 'something asked of someone');
    // Far off: the simple tier; nothing that far away is acted out.
    for (const th of S.live()) {
      if (th.tier === 'simple') assert.ok(!Object.keys(th.touched).length && S.nearest(S.anchors(th)) > NEAR, `${th.m} simple`);
      for (const t of th.tasks) assert.ok(['open', 'won', 'done', 'void', 'lapsed', 'failed'].includes(t.status), t.status);
    }
    // Taken on by those who live there (guards, adventurers), or over.
    ended += S.threads.filter((t) => t.done || t.tasks.some((q) => q.claims.length)).length;
  }
  assert.ok(ended > 0, 'stories taken up, or come to an end');
});

test('the stories: saved and loaded, every story and everyone in them carries on', () => {
  const { game, input, S } = start();
  const band = game.sim.bandits.live()[0];
  const th = S.begin('grudge', { cast: { band: R.band(band.id), target: R.pl('host') }, sid: band.near, vars: { heat: 4 }, touched: ['host'] });
  S.person('host').under = 9;
  S.person('host').fame = 3;
  const d = makeDen(S, band.near, new RNG(4));
  const data = JSON.parse(JSON.stringify(game.sim.serialize()));
  const g2 = makeGame(12345);
  g2.sim.load(data);
  const S2 = g2.sim.saga;
  const th2 = S2.thread(th.id);
  assert.ok(th2, 'the grudge');
  assert.equal(th2.node, th.node);
  assert.equal(th2.vars.heat, 4);
  assert.equal(S2.person('host').under, 9);
  assert.ok(d && S2.dens[d.key], 'the den');
  assert.equal(S2.next, S.next);
  quiet(() => run(g2, input, 10));
  void input;
});

test('a plea: someone in town asks (the ! over them); you take it on, see to it, and are paid when you go back (the ?)', () => {
  const { game, input, p, S } = start();
  const { s, L, m } = townFolk(game, input);
  assert.ok(m && m.ent && !m.ent.dead, 'the mayor about');
  const band = game.sim.bandits.live()[0];
  const th = S.begin('plea', { cast: { giver: R.rec(s.id, m.idx), threat: R.band(band.id), town: R.town(s.id) }, sid: s.id, vars: { how: 'raided', delay: 0 } });
  assert.ok(th);
  S.go(th, 'plea');
  const t = S.tasksOf(th, 'clear')[0];
  assert.ok(t, 'asked');
  t.known[s.id] = S.now - 1;
  assert.equal(S.markOf(m.ent, 'host'), 'offer', 'the !');
  const top = sagaTopics(m.ent, game);
  const offer = top.find((q) => q.id === 'sg_offer');
  assert.ok(offer, 'they ask');
  // (In with the rest of what they'll talk about.)
  assert.ok(topicsFor(m.ent, game).some((q) => q.id === 'sg_offer'));
  const r = sagaRespond(m.ent, game, 'sg_offer', offer.arg);
  assert.ok(r.lines[0].length > 20, 'the pitch, in words written for it');
  assert.ok(r.choices.some((c) => c.id === 'sg_accept'));
  sagaRespond(m.ent, game, 'sg_accept', offer.arg);
  assert.ok(S.claimedBy(t, 'host'));
  assert.equal(S.markOf(m.ent, 'host'), 'busy');
  // In the quest log.
  const qw = new QuestWindow({ ...stubUI(), game, mouseCell: { x: -1, y: -1 } });
  assert.ok(qw.entries(game).some((e) => e.t === t));
  // The band wiped out by you: done, and the reward waits for you.
  game.sim.bandits.wipedOut(band, game.day, 'you', R.pl('host'));
  quiet(() => run(game, input, 4));
  assert.equal(t.status, 'won');
  assert.equal(S.markOf(m.ent, 'host'), 'ready', 'the ?');
  const turn = sagaTopics(m.ent, game).find((q) => q.id === 'sg_turnin');
  assert.ok(turn);
  const c0 = coins(p);
  const fame0 = S.person('host').fame;
  L.econ.treasury = Math.max(L.econ.treasury, 500);
  const paid = sagaRespond(m.ent, game, 'sg_turnin', turn.arg);
  assert.ok(paid.lines.length);
  assert.equal(t.status, 'done');
  assert.ok(coins(p) > c0, 'paid');
  assert.ok(S.person('host').fame > fame0, 'and a name for it');
  assert.ok(th.done, 'the story over');
});

test('a plea left alone gets worse; the watch and adventurers may take it on themselves', () => {
  const { game, input, S } = start();
  const { s, m } = townFolk(game, input);
  const band = game.sim.bandits.live()[0];
  const th = S.begin('plea', { cast: { giver: R.rec(s.id, m.idx), threat: R.band(band.id), town: R.town(s.id) }, sid: s.id, vars: { how: 'raided', delay: 0 } });
  S.go(th, 'plea');
  th.vars.patience = 1;
  th.vars.neglect = 0;
  quiet(() => MOTIFS.plea.nodes.plea.day(th, S, S.rng(th, 3)));
  assert.equal(th.vars.stage, 1, 'it got worse');
  assert.ok(th.hist.length >= 2);
  // Someone in town takes on what's asked (by the board's own pace).
  const t = S.openTasks().find((q) => q.npc && q.sid !== null);
  if (t) {
    t.known[t.sid] = S.now - 1;
    S.accept(t, R.town(t.sid));
    assert.ok(t.claims.length);
  }
});

test('captors take your weapons, armour, gold, relics, Kavorent tech and cores (not your bread or your lockpick)', () => {
  for (const k of ['iron_sword', 'kav_blade', 'kav_visor', 'leather_cap', 'coin', 'kav_core', 'kav_scrap', 'kav_blink', 'kav_edge', 'relic_hearth', 'overseer_eye', 'holy_relic', 'gold_ingot']) {
    if (ITEMS[k]) assert.ok(seizable(k), k);
  }
  for (const k of ['bread', 'herb', 'lockpick', 'apple']) if (ITEMS[k]) assert.ok(!seizable(k), k);
  const { p } = start();
  p.inv = Array(p.inv.length).fill(null);
  p.inv[0] = { item: 'iron_sword', count: 1 };
  p.inv[1] = { item: 'coin', count: 80 };
  p.inv[2] = { item: 'kav_core', count: 2 };
  p.inv[3] = { item: 'bread', count: 3 };
  p.inv[4] = { item: 'relic_hearth', count: 1 };
  p.inv[5] = { item: 'lockpick', count: 1 };
  p.equip.body = 'leather_tunic';
  const taken = seize(p);
  assert.deepEqual(new Set(taken.map((q) => q.item)), new Set(['iron_sword', 'coin', 'kav_core', 'relic_hearth', ...(ITEMS.leather_tunic ? ['leather_tunic'] : [])]));
  assert.equal(p.inv.filter(Boolean).map((q) => q.item).sort().join(), 'bread,lockpick');
});

test('a grudge: kill enough of a band and they hunt you; beaten down, you wake in their cage without your gear; walk out and get it back', () => {
  const { game, input, p, S } = start();
  const B = game.sim.bandits;
  const band = B.live()[0];
  game.teleportPlayer(band.camp.x + 4, 6, band.camp.z + 8);
  run(game, input, 30);
  const ents = [...B.ents.values()].filter((n) => !n.dead);
  assert.ok(ents.length >= 2, 'the band at its fire');
  quiet(() => {
    for (const n of ents.slice(0, 2)) game.kill(n, p);
    run(game, input, 10);
  });
  const gr = S.live().find((t) => t.m === 'grudge');
  assert.ok(gr, 'they hold a grudge');
  assert.ok(S.person('host').under > 0, 'known among the outlaws');
  // (What you carry.)
  p.inv = Array(p.inv.length).fill(null);
  p.inv[0] = { item: 'iron_sword', count: 1 };
  p.inv[1] = { item: 'coin', count: 50 };
  p.inv[2] = { item: 'kav_core', count: 1 };
  p.inv[3] = { item: 'bread', count: 2 };
  // Off in the open: they send someone.
  gr.vars.heat = 9;
  S.person('host').lastHunt = -1e9;
  game.teleportPlayer(band.camp.x + 120, 6, band.camp.z + 40);
  quiet(() => run(game, input, 20));
  let tries = 0;
  quiet(() => {
    while (gr.node === 'seethe' && tries++ < 80) S.hourly(++S.lastHour);
  });
  assert.equal(gr.node, 'hunt', 'killers on the road');
  for (const a of gr.actors) if (a.orders) a.orders.capture = true;
  quiet(() => run(game, input, 20));
  // (They may have had you already.)
  if (!p.sagaHeld) {
    const hunter = [...S.actors.values()].find((e) => !e.dead && e.warband && e.warband.role === 'hunter');
    assert.ok(hunter, 'a hunter in front of you');
    quiet(() => {
      game.damage(p, 999, hunter);
      run(game, input, 10);
    });
  }
  assert.ok(!p.dead, 'taken alive');
  const cap = S.live().find((t) => t.m === 'captive');
  assert.ok(cap, 'a captive');
  assert.ok(p.sagaHeld, 'held');
  const cg = band.camp.cage;
  assert.ok(cg, 'a cage built at their camp');
  assert.ok(Math.hypot(p.x - cg.cell.x, p.z - cg.cell.z) < 2, 'in it');
  assert.ok(!p.inv.some((q) => q && ['iron_sword', 'coin', 'kav_core'].includes(q.item)), 'stripped');
  assert.ok(p.inv.some((q) => q && q.item === 'bread'), 'but not of bread');
  assert.ok((band.stash || []).some((q) => q.item === 'iron_sword' && q.owner === 'host'), 'in their strongbox');
  // A jailer to talk to.
  const j = S.actorEnt(cap, 'jailer');
  assert.ok(j, 'a jailer');
  assert.ok(sagaTopics(j, game).length >= 2);
  // Out of the cage (as if the lock was picked): escaped, and a story to get it all back.
  quiet(() => {
    game.teleportPlayer(cg.cell.x + 5, cg.cell.y, cg.cell.z + 5);
    run(game, input, 40);
  });
  assert.ok(cap.done && cap.outcome === 'escaped', cap.outcome);
  assert.ok(!p.sagaHeld);
  const rc = S.threads.find((t) => t.m === 'reclaim');
  assert.ok(rc && rc.tasks.length, 'get it back');
});

test('a letter from the chief: a messenger finds you; you go to the meeting (or walk into a trap)', () => {
  for (const scheme of ['parley', 'trap']) {
    const { game, input, p, S } = start();
    const B = game.sim.bandits;
    const band = B.live()[0];
    const rr = new RNG(5);
    for (let i = 0; i < 3; i++) band.members.push(B.outlaw(rr, 'vale'));
    const gr = S.begin('grudge', { cast: { band: R.band(band.id), target: R.pl('host') }, sid: band.near, vars: { heat: 9 }, touched: ['host'] });
    game.teleportPlayer(band.camp.x + 140, 6, band.camp.z + 40);
    run(game, input, 10);
    quiet(() => S.go(gr, 'letter'));
    gr.vars.scheme = scheme;
    quiet(() => run(game, input, 40));
    const mess = S.actorEnt(gr, 'messenger');
    assert.ok(mess, 'a messenger');
    assert.ok(sagaTopics(mess, game).some((q) => q.id === 'sgg_take'), 'with a letter');
    quiet(() => sagaRespond(mess, game, 'sgg_take', `t${gr.id}`));
    const note = p.inv.find((q) => q && q.item.startsWith('note~'));
    assert.ok(note, 'the letter in your pack');
    assert.ok(ITEMS[note.item] || game.itemName(note.item), 'a note you can read');
    S.read(note.item);
    const mt = S.tasksOf(gr, 'meet')[0];
    assert.ok(mt && S.claimedBy(mt, 'host'), 'the meeting in your quest log');
    const m = gr.vars.meet;
    game.day = Math.floor(m.at / 1440);
    game.minute = m.at % 1440;
    game.teleportPlayer(m.x + 2, 6, m.z + 2);
    quiet(() => run(game, input, 30));
    assert.equal(gr.node, 'meeting');
    assert.ok(S.actorEnt(gr, 'leader'), 'the chief came');
    quiet(() => run(game, input, 80));
    if (scheme === 'trap') {
      assert.ok(gr.vars.sprung, 'a trap');
      // (They may have had you already.)
      if (!p.sagaHeld) {
        const foes = [...S.actors.values()].filter((e) => !e.dead && e.warband && e.warband.kind === 'saga' && e.warband.capture);
        assert.ok(foes.length, 'out to take you alive');
        quiet(() => {
          game.damage(p, 999, foes[0]);
          run(game, input, 20);
        });
      }
      assert.ok(!p.dead, 'alive');
      assert.ok(S.live().some((t) => t.m === 'captive' && t.cast.captive.pid === 'host'), 'taken');
    } else {
      const lead = S.actorEnt(gr, 'leader');
      assert.ok(sagaTopics(lead, game).length >= 2, 'terms to talk over');
    }
  }
});

test('a den: a pack grows near a town, raids it, and one of them grows a name with a price on it', () => {
  const { game, S } = start();
  const sid = game.sim.bandits.live()[0].near;
  const d = makeDen(S, sid, new RNG(9));
  assert.ok(d);
  const th = S.begin('den', { cast: { den: R.den(d.key), town: R.town(sid) }, sid, vars: { denKey: d.key }, spots: [{ x: d.x, z: d.z }] });
  assert.ok(th);
  d.pack = 5;
  let n = 0;
  quiet(() => {
    while (!d.alpha && n++ < 60) MOTIFS.den.nodes.lair.day(th, S, S.rng(th, n));
  });
  assert.ok(d.alpha, 'one with a name');
  const al = S.live().find((t) => t.m === 'alpha');
  assert.ok(al, 'the hunt for it');
  const t = S.tasksOf(al, 'hunt')[0];
  assert.ok(t && t.reward.coins >= 40);
  // Its price goes up with every life it takes.
  d.alpha.kills = 2;
  MOTIFS.alpha.nodes.prowl.day(al, S);
  assert.equal(t.reward.coins, 80);
  // Killed by you.
  S.accept(t, R.pl('host'));
  S.emit('beast_slain', { den: d.key, name: d.alpha.name, by: R.pl('host'), x: d.x, z: d.z });
  quiet(() => S.drain());
  assert.equal(al.outcome, 'slain');
  assert.ok(S.person('host').titles.some((q) => /^Slayer of/.test(q)), 'a title');
});

test('a lost child: found in the woods, follows you home', () => {
  const { game, input, p, S } = start();
  const L = [...game.world.layouts.values()].find((q) => q.econ && q.npcs.some((r) => alive(r) && r.age === 'child' && [...(r.parents || [])].some((i) => q.npcs[i] && alive(q.npcs[i]))));
  assert.ok(L, 'a town with a child in it');
  const c = L.npcs.find((r) => alive(r) && r.age === 'child' && [...(r.parents || [])].some((i) => L.npcs[i] && alive(L.npcs[i])));
  const par = [...c.parents].map((i) => L.npcs[i]).find((r) => r && alive(r));
  const b = L.settlement.bounds;
  const at = { x: Math.round(b.x1 + 30), z: Math.round((b.z0 + b.z1) / 2) };
  const th = S.begin('lost_child', { cast: { child: R.rec(L.settlement.id, c.idx), parent: R.rec(L.settlement.id, par.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, spots: [at], vars: { at } });
  assert.ok(th);
  assert.ok(c.away, 'gone from home');
  game.teleportPlayer(at.x + 3, 6, at.z);
  quiet(() => run(game, input, 30));
  const kid = S.actorEnt(th, 'child');
  assert.ok(kid, 'there in the woods');
  const come = sagaTopics(kid, game).find((q) => q.id === 'sgl_come');
  assert.ok(come);
  sagaRespond(kid, game, 'sgl_come', come.arg);
  assert.equal(kid.saga.follow, 'host');
  // Walked home: back in town, and the task done.
  game.teleportPlayer(Math.round((b.x0 + b.x1) / 2), 6, Math.round((b.z0 + b.z1) / 2));
  kid.x = p.x + 1;
  kid.z = p.z;
  quiet(() => run(game, input, 10));
  assert.ok(th.done, th.node);
  assert.equal(th.outcome, 'home');
  assert.ok(!c.away);
  const t = th.tasks[0];
  assert.ok(t.status === 'won' || t.status === 'done');
});

test('a fever: bring the herbs, get cures, and give them to the sick', () => {
  const { game, input, p, S } = start();
  const { s, L } = townFolk(game, input);
  const th = S.begin('fever', { cast: { town: R.town(s.id) }, sid: s.id });
  assert.ok(th);
  const sick = L.npcs.filter((r) => alive(r) && r.sick);
  assert.ok(sick.length >= 1, 'some fall sick');
  const t = S.tasksOf(th, 'herbs')[0];
  assert.ok(t && t.item);
  // Handed the herbs: done, and cures to give.
  p.give(t.item, t.n);
  S.accept(t, R.pl('host'));
  S.complete(t, R.pl('host'));
  if (t.status === 'won') S.turnIn(t, 'host');
  assert.ok(th.vars.cured);
  assert.ok(p.inv.some((q) => q && q.item === 'cure'), 'cures');
  const r = sick.find((q) => q.ent && !q.ent.dead) || sick[0];
  const npc = r.ent && !r.ent.dead ? r.ent : { rec: r, settlement: L.settlement, layout: L, x: p.x, z: p.z };
  const give = sagaTopics(npc, game).find((q) => q.id === 'sgc_cure');
  if (npc.rec && r.ent) {
    assert.ok(give, 'something to give them');
    sagaRespond(npc, game, 'sgc_cure', give.arg);
    assert.ok(!r.sick, 'well again');
  }
  assert.ok(ITEMS.cure && ITEMS.cure.effect && ITEMS.cure.effect.heal > 0, 'a cure can be drunk yourself');
});

test('players: a contract on one of you can be taken by another (no turning it down if it\'s on you); the feud lets you fight; paid on the kill', () => {
  const { game, input } = start();
  game.startParty({ id: 'h', name: 'Hosty' });
  const gui = stubUI();
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: gui, input: stubInput(), hero: null });
  const gp = seat.ent;
  const S = game.sim.saga;
  const band = game.sim.bandits.live()[0];
  band.loot = 200;
  asSeat(game, seat, () => game.teleportPlayer(band.camp.x + 200, 6, band.camp.z + 30));
  game.teleportPlayer(band.camp.x + 203, 6, band.camp.z + 30);
  run(game, input, 10);
  game.pvp = false;
  const c = S.begin('contract', { cast: { patron: R.band(band.id), target: R.pl('g') }, vars: { pay: 80 } });
  assert.ok(c);
  assert.equal(band.loot, 120, 'the money put by');
  const ct = S.tasksOf(c, 'contract')[0];
  assert.ok(!S.visibleTo(ct, 'g'), 'kept from the one it\'s on');
  assert.ok(S.visibleTo(ct, 'host'));
  assert.ok(!S.feud(game.player, gp), 'no fighting yet');
  // A go-between finds the host with the offer.
  quiet(() => {
    for (let h = 0; h < 30 && !S.actorSpec(c, 'offer:host'); h++) MOTIFS.contract.nodes.posted.hour(c, S, S.rng(c, h));
    run(game, input, 20);
  });
  const broker = S.actorEnt(c, 'offer:host');
  assert.ok(broker, 'a go-between');
  assert.equal(S.markOf(broker, 'host'), 'talk');
  assert.equal(S.markOf(broker, 'g'), null, 'no mark over them for the one it\'s on');
  const hear = sagaTopics(broker, game).find((q) => q.id === 'sgk_hear');
  assert.ok(hear);
  const r = sagaRespond(broker, game, 'sgk_hear', hear.arg);
  assert.ok(r.choices.some((q) => q.id === 'sgk_take'));
  sagaRespond(broker, game, 'sgk_take', hear.arg);
  assert.ok(S.claimedBy(ct, 'host'));
  assert.ok(S.feud(game.player, gp), 'now they may fight');
  const hp0 = gp.hp;
  game.damage(gp, 3, game.player);
  assert.ok(gp.hp < hp0, 'struck, though the world doesn\'t let players fight');
  const c0 = coins(game.player);
  quiet(() => {
    game.damage(gp, 999, game.player);
    run(game, input, 10);
  });
  assert.ok(gp.dead);
  assert.equal(c.outcome, 'collected');
  assert.equal(coins(game.player) - c0, 80, 'paid what was promised');
  assert.ok(S.person('host').under >= 4, 'and known for it among the outlaws');
});

test('players: one of you held by outlaws; the rest hear of it, and one pays the ransom; free with their things (and safe out of the camp)', () => {
  const { game, input } = start();
  game.startParty({ id: 'h', name: 'Hosty' });
  const gui = stubUI();
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: gui, input: stubInput(), hero: null });
  const gp = seat.ent;
  const S = game.sim.saga;
  const band = game.sim.bandits.live()[0];
  const th = S.begin('grudge', { cast: { band: R.band(band.id), target: R.pl('g') }, sid: band.near, vars: { heat: 9 }, touched: ['g'] });
  asSeat(game, seat, () => game.teleportPlayer(band.camp.x + 90, 6, band.camp.z + 30));
  game.teleportPlayer(band.camp.x + 95, 6, band.camp.z + 30);
  run(game, input, 10);
  const m = band.members[1];
  m.out = true;
  S.actor(th, { key: 'hx', kind: 'npc', role: 'hunter', hostile: true, at: { x: Math.round(gp.x) + 3, z: Math.round(gp.z) }, person: { name: m.name, look: m.look, personality: m.personality, traits: [], age: 'adult', job: 'bandit', weapon: m.weapon, maxHp: 20, band: band.id, member: m.id }, orders: { target: 'g', capture: true } });
  run(game, input, 10);
  gp.inv[0] = { item: 'iron_sword', count: 1 };
  quiet(() => {
    game.damage(gp, 999, S.actorEnt(th, 'hx'));
    run(game, input, 10);
  });
  const cap = S.live().find((t) => t.m === 'captive');
  assert.ok(cap && gp.sagaHeld, 'held');
  assert.ok(game.ui.msgs.some((q) => /taken captive/.test(q)), 'the host told');
  const rescue = S.tasksOf(cap, 'rescue')[0];
  assert.ok(rescue && S.heardOf('host', rescue), 'the rescue known to the host');
  assert.ok(!S.visibleTo(rescue, 'g'), 'not a task for the one held');
  // Away and back: still in the cage.
  game.removeSeat(seat);
  quiet(() => run(game, input, 20));
  assert.ok(!cap.done, 'still held while away');
  const gui2 = stubUI();
  const seat2 = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: gui2, input: stubInput(), hero: null });
  const gp2 = seat2.ent;
  quiet(() => run(game, input, 10));
  assert.ok(gp2.sagaHeld, 'held again on coming back');
  assert.ok(Math.hypot(gp2.x - band.camp.cage.cell.x, gp2.z - band.camp.cage.cell.z) < 2, 'in the cage');
  // The host goes to the jailer and pays.
  cap.vars.plan = 'ransom';
  const cg = band.camp.cage;
  game.teleportPlayer(cg.door.x + 3, cg.door.y, cg.door.z);
  quiet(() => run(game, input, 20));
  const j = S.actorEnt(cap, 'jailer');
  assert.ok(j);
  assert.ok(sagaTopics(j, game).some((q) => q.id === 'sgc_pay'), 'a ransom to pay');
  game.player.give('coin', 500);
  quiet(() => sagaRespond(j, game, 'sgc_pay', `t${cap.id}`));
  quiet(() => run(game, input, 30));
  assert.equal(cap.outcome, 'ransomed');
  assert.ok(!gp2.sagaHeld);
  assert.ok(gp2.inv.some((q) => q && q.item === 'iron_sword'), 'their sword back');
  assert.ok(!gp2.dead && !game.player.dead, 'let walk out of the camp');
  assert.ok(S.friendOfBand(band.id, gp2) && S.friendOfBand(band.id, game.player), 'safe passage');
});

test('players: two beacons, lit together by two of you', () => {
  const { game, input } = start();
  game.startParty({ id: 'h', name: 'Hosty' });
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: stubInput(), hero: null });
  const S = game.sim.saga;
  const band = game.sim.bandits.live()[0];
  const bt = S.begin('beacons', { cast: { town: R.town(band.near) }, sid: band.near, vars: { a: { x: band.camp.x + 200, z: band.camp.z }, b: { x: band.camp.x + 260, z: band.camp.z } } });
  assert.equal(bt.tasks.length, 2);
  game.teleportPlayer(bt.vars.a.x, bt.vars.y_a + 1, bt.vars.a.z + 1);
  quiet(() => run(game, input, 10));
  assert.equal(bt.node, 'dark', 'one alone can\'t');
  asSeat(game, seat, () => game.teleportPlayer(bt.vars.b.x, bt.vars.y_b + 1, bt.vars.b.z + 1));
  quiet(() => run(game, input, 10));
  assert.ok(bt.done && bt.outcome === 'lit');
  assert.ok(bt.tasks.every((t) => t.status === 'won' || t.status === 'done'));
  const L = game.world.layouts.get(band.near);
  if (L && L.econ) assert.ok(L.econ.beaconUntil > S.now, 'raiders keep off');
});

test('the quest log (O) and the board\'s WORK side draw inside themselves, and list what you\'re on', () => {
  const { game, input, S } = start();
  const { s, L, m } = townFolk(game, input);
  const band = game.sim.bandits.live()[0];
  const th = S.begin('plea', { cast: { giver: R.rec(s.id, m.idx), threat: R.band(band.id), town: R.town(s.id) }, sid: s.id, vars: { how: 'raided', delay: 0 } });
  S.go(th, 'plea');
  const t = S.tasksOf(th, 'clear')[0];
  t.known[s.id] = S.now - 1;
  S.accept(t, R.pl('host'));
  // A task with nobody in particular asking (straight off the board).
  const ui = stubUI();
  ui.game = game;
  ui.mouseCell = { x: -1, y: -1 };
  const qw = new QuestWindow(ui);
  for (const tab of ['tasks', 'heard', 'stories', 'name']) {
    qw.tab = tab;
    qw.sel = 0;
    drawsInside(qw, game, `quest log: ${tab}`);
  }
  qw.tab = 'tasks';
  assert.ok(qw.entries(game).length >= 1);
  const sum = questSummary(game);
  assert.ok(Array.isArray(sum) ? sum.length : String(sum).length, 'a summary for the journal');
  const lw = new LedgerWindow(ui, game, s, L);
  lw.tab = 'work';
  drawsInside(lw, game, 'board: work');
  const lines = lw.workLines(game);
  assert.ok(lines.some((q) => q.t && q.t.includes(t.title.slice(0, 20))), 'what\'s asked here');
  void text;
});

test('marks over heads: the ! for something asked, the ? when it\'s done, sent to those playing as guests', () => {
  const { game, input, S } = start();
  const { s, m } = townFolk(game, input);
  const band = game.sim.bandits.live()[0];
  const th = S.begin('plea', { cast: { giver: R.rec(s.id, m.idx), threat: R.band(band.id), town: R.town(s.id) }, sid: s.id, vars: { how: 'raided', delay: 0 } });
  S.go(th, 'plea');
  const t = S.tasksOf(th, 'clear')[0];
  t.known[s.id] = S.now + 9999;
  assert.equal(S.markOf(m.ent, 'host'), null, 'not known in town yet');
  t.known[s.id] = S.now - 1;
  game.markCache = null;
  assert.equal(game.questMark(m.ent), 'offer');
  // A guest standing by them: the host sends what's over their head (for
  // that guest).
  game.startParty({ id: 'h', name: 'Hosty' });
  const seat = game.addSeat({ id: 'g', name: 'Guesty' }, { ui: stubUI(), input: stubInput(), hero: null });
  asSeat(game, seat, () => game.teleportPlayer(Math.round(m.ent.x) + 2, Math.round(m.ent.y), Math.round(m.ent.z)));
  const net = Object.create(HostNet.prototype);
  net.game = game;
  const own = asSeat(game, seat, () => net.ownState({ seat }, 1));
  assert.ok(own.qm.some(([id, mk]) => id === m.ent.id && mk === 'offer'), 'the ! sent to the guest');
  // Taken on by the guest: grey for them, still gold for the host.
  S.accept(t, R.pl('g'));
  game.markCache = null;
  const own2 = asSeat(game, seat, () => net.ownState({ seat }, 1));
  assert.ok(own2.qm.some(([id, mk]) => id === m.ent.id && mk === 'busy'));
  assert.equal(S.markOf(m.ent, 'host'), 'offer');
});

test('migration 0.52.0: heads you took become a name among the outlaws; standing bounties become pleas', () => {
  assert.ok(STEPS.some((q) => q.to === GAME_VERSION), 'this version has its step');
  const step = STEPS.find((q) => q.to === '0.52.0');
  assert.ok(step && step.game && step.data);
  assert.ok(stepsFor('0.51.0').some((q) => q.to === '0.52.0'));
  const { game, input, S } = start();
  const band = game.sim.bandits.live()[0];
  game.sim.bandits.heads = { [band.id]: 3 };
  const L = game.world.layouts.get(band.near) || [...game.world.layouts.values()].find((q) => q.econ);
  L.econ.bounties = [{ band: band.id, reward: 50 }];
  const log = [];
  const u0 = S.person('host').under;
  step.game(game, log);
  assert.equal(S.person('host').under, u0 + 3);
  assert.ok(log.some((q) => /stories/.test(q)));
  if (mayorOf(L)) assert.ok(S.live().some((t) => t.m === 'plea' && t.cast.threat.id === band.id), 'a plea for the bounty');
  void input;
  void pidOf;
});
