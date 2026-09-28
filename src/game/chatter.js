// Villagers talk among themselves: when two of them idle close together
// near the player, one opens a short exchange about food, taxes, the
// weather, the news, the dead, each other, or you.
import { kitchenOf, st } from '../sim/econ.js';
import { affinity, griefOf } from './dialogue.js';
import { relationTo } from '../sim/favors.js';

const CHATTY = new Set(['social', 'hobby', 'wander', 'eat', 'home', 'play', 'work', 'visit']);

function pick(rng, arr) {
  return arr[Math.floor(rng.next() * arr.length)];
}

// Lines for `a` talking to `b`: [opener, reply] or [opener, reply, closer].
export function exchangeFor(a, b, game) {
  const ra = a.rec;
  const rb = b.rec;
  const L = a.layout;
  const e = L.econ;
  const sim = game.sim;
  const rng = a.rng;
  const B = rb.name.first;
  const Aname = ra.name.first;
  const rel = relationTo(ra, rb);
  const af = affinity(ra, rb);
  const opts = [];
  const h = game.minute / 60;
  const tw = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
  if (ra.age === 'child' && rb.age === 'child') {
    opts.push([`Tag! You're it, ${B}!`, 'No fair! I wasn\'t ready!'], [`${B}, wanna play hide and seek?`, 'Okay! You count!']);
    return pick(rng, opts);
  }
  if (rel === 'partner') opts.push([`Home for supper, ${B}?`, 'Wouldn\'t miss it.'], [`There you are, ${B}.`, 'Here I am. Miss me?', 'Always.']);
  if (rel === 'parent' && ra.age === 'child') opts.push([`${B}, can I have a sweet?`, 'After supper.', 'Awww...']);
  if (rel === 'child' && rb.age === 'child') opts.push([`Stay where I can see you, ${B}.`, 'Yes, yes...']);
  if (rel === 'friend') opts.push([`${B}! Fancy a drink later?`, 'You\'re buying.'], [`Good to see you, ${B}.`, 'You too, old friend.']);
  if (af < -0.35 && !rel) opts.push([`Oh. It's you, ${B}.`, `Charmed as always, ${Aname}.`], [`You still owe me, ${B}.`, 'I paid you back!', 'Did not.']);
  const g = griefOf(ra);
  if (g) {
    opts.push([`I keep thinking about ${g.first}.`, `We all do, ${Aname}. We all do.`]);
    return pick(rng, opts);
  }
  const k = kitchenOf(L);
  if (k) {
    if (st.count(k.store, 'feast')) opts.push(['Have you had the feast at the tavern?', 'Twice! Don\'t tell anyone.']);
    else if (st.count(k.store, 'gruel') && !st.count(k.store, 'stew')) opts.push(['Did you try the gruel today?', 'Don\'t remind me.']);
    else if (!st.count(k.store, 'stew')) opts.push(['The tavern\'s out of food again.', 'Those trappers need to pull their weight.']);
    else opts.push(['Stew again at the tavern.', 'Could be worse.']);
  }
  if (ra.hungry >= 1) opts.push([`${B}, have you any bread to spare?`, rb.personality.kindness > 0.55 ? 'Here, take some. Don\'t mention it.' : 'Sorry, we barely have enough ourselves.']);
  if (e.tax >= 0.16) opts.push([`${Math.round(e.tax * 100)}% tax! Can you believe it?`, 'Robbery, that\'s what it is.']);
  else if (e.tax <= 0.05) opts.push(['Taxes are low this season.', 'Long may it last.']);
  const w = game.weatherIn ? game.weatherIn(a.settlement) : game.weather && game.weather.kind;
  if (w === 'rain') opts.push(['Wet enough for you?', 'My boots are soaked through.']);
  else if (w === 'snow') opts.push(['Snow again...', 'I can\'t feel my toes.']);
  else if (w === 'fog') opts.push(['Can\'t see a thing in this fog.', 'Mind you don\'t walk into the well.']);
  const news = [...e.ledger].reverse().find((it) => it.day >= game.day - 1 && it.day > 0);
  if (news) opts.push([`Did you hear? ${news.text}`, pick(rng, ['No! Really?', 'I heard. Can you believe it?', 'Everyone\'s talking about it.'])]);
  const visits = (sim.visits.get(L.settlement.id) || []).filter((v) => sim.abs >= v.arrive && sim.abs < v.leave);
  if (visits.length) opts.push([`There's a merchant from ${visits[0].fromName} on the square.`, 'I might have a look later.']);
  if (ra.job === rb.job && ra.job !== 'retired') opts.push(['Busy day?', 'Never ends.'], ['Think we\'ll finish early today?', 'Ha! Dream on.']);
  // Gossip about the player, when they're within earshot.
  const p = game.player;
  if (Math.max(Math.abs(p.x - a.x), Math.abs(p.z - a.z)) <= 7) {
    const sid = a.settlement.id;
    const name = game.playerName;
    const op = sim.opinion(a);
    const met = sim.repEntry(sid, ra.idx).met;
    if (sim.justice.pendingIn(sid).length || sim.justice.recordOf(sid).convictions) opts.push([`That's ${name}. I heard they're trouble.`, 'Shh! Keep your voice down!']);
    else if (sim.careers.isGuard(sid)) opts.push([`${name} joined the watch, you know.`, 'About time we had more guards.']);
    else if (sim.isCitizen(sid)) opts.push([`${name} has settled in nicely.`, 'Seems a decent sort.']);
    else if (op >= 35) opts.push([`${name} is a good sort.`, 'Agreed.']);
    else if (op <= -25) opts.push([`Watch that one, ${B}.`, '*nods*']);
    else if (!met) opts.push(['Who\'s the stranger?', 'No idea. A traveler, I think.']);
  }
  opts.push([`${tw}, ${B}!`, `${tw}, ${Aname}.`], ['How\'s the family?', 'Can\'t complain. You?', 'Same old.'], ['Nice day for it.', 'It is, isn\'t it?']);
  return pick(rng, opts);
}

// Called every frame: now and then, start a conversation between two
// idle villagers the player can see, and play queued lines in turn.
export function ambientChatter(game, dt) {
  const c = game.chatter || (game.chatter = { t: 5, clock: 0, queue: [] });
  c.clock += dt;
  for (const q of c.queue) {
    if (q.done || c.clock < q.at) continue;
    q.done = true;
    const n = q.n;
    if (n.dead || n.state !== 'routine' || n.sleeping || n.distTo(q.to) > 3) {
      c.queue.forEach((o) => { if (o.id === q.id) o.done = true; });
      continue;
    }
    n.face(q.to.x, q.to.z);
    n.say(q.text, 3.2);
  }
  c.queue = c.queue.filter((q) => !q.done);
  c.t -= dt;
  if (c.t > 0) return;
  c.t = 4 + Math.random() * 6;
  const p = game.player;
  const idle = (n) => !n.dead && n.state === 'routine' && !n.sleeping && !n.moving && !n.bubble && n.atGoal && CHATTY.has(n.act)
    && (n.chatUntil || 0) < c.clock && Math.abs(n.x - p.x) < 18 && Math.abs(n.z - p.z) < 14;
  const near = game.npcs.filter(idle);
  for (let i = near.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [near[i], near[j]] = [near[j], near[i]];
  }
  for (const a of near) {
    const b = near.find((o) => o !== a && o.layout === a.layout && Math.max(Math.abs(o.x - a.x), Math.abs(o.z - a.z)) <= 2);
    if (!b) continue;
    const lines = exchangeFor(a, b, game);
    const id = c.clock;
    lines.forEach((text, i) => {
      const [n, to] = i % 2 === 0 ? [a, b] : [b, a];
      c.queue.push({ id, n, to, text, at: c.clock + i * 2.6 });
    });
    a.chatUntil = b.chatUntil = c.clock + 40 + Math.random() * 40;
    return;
  }
}
