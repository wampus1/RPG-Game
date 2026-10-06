// Mods' stories in the game (round 62). Each story graph (see
// storynodes.js) is made into a story of the game's own kind (a motif:
// see sim/saga/core.js), so it's told as theirs are: begun now and then in
// a town (or after one of the game's stories ends, or on an event, or
// when a trigger or a graph starts it), its tasks posted on the boards and
// asked of passers-by, its people with something to say, its history in
// the journal. And changes to the game's own stories: one turned off, made
// more or less common, sent another way at a turn now and then, or
// something of the mod's done when one comes to a part of it.
import { MODS } from './state.js';
import { gameKey } from './format.js';
import { NODES } from './graph.js';
import { WHO_JOBS } from './storynodes.js';
import { MOTIFS, GO_HOOKS, R, nameOf, sameRef, isAlive, resolve } from '../sim/saga/core.js';
import { laidTowns, adults, living, spotNear, townsNear, layoutOf, fill, townMid } from '../sim/saga/motifs/lib.js';
import { mayorOf, alive } from '../sim/econ.js';
import { ITEMS } from '../world/items.js';
import { RNG, hash4, hashString } from '../util/rng.js';
import { townWeather } from '../world/weather.js';

const DAY_MIN = 24 * 60;
// (Round 64) Two things compared, as an If or a Wait for one has them:
// as numbers when both are, else as words (nothing counts as 0).
export function compareValues(a, op, b) {
  const asNum = (v) => (typeof v === 'number' ? v : typeof v === 'boolean' ? +v : v === undefined || v === null || String(v).trim() === '' ? null : Number.isNaN(+v) ? null : +v);
  let na = asNum(a);
  let nb = asNum(b);
  const blank = (v) => v === undefined || v === null || String(v).trim() === '';
  if (na === null && blank(a) && nb !== null) na = 0;
  if (nb === null && blank(b) && na !== null) nb = 0;
  const num = na !== null && nb !== null;
  const sa = String(a ?? '').trim().toLowerCase();
  const sb = String(b ?? '').trim().toLowerCase();
  switch (op) {
    case 'is': case '=': return num ? na === nb : sa === sb;
    case 'is not': case '≠': return num ? na !== nb : sa !== sb;
    case 'is at least': case '≥': return num ? na >= nb : sa >= sb;
    case 'is more than': case '>': return num ? na > nb : sa > sb;
    case 'is at most': case '≤': return num ? na <= nb : sa <= sb;
    case 'is less than': case '<': return num ? na < nb : sa < sb;
    case 'has in it': return sa.includes(sb);
    default: return false;
  }
}

const JOBS = WHO_JOBS;
const ISLE = { 'a town on Thessa': 'thessa', 'a town on Kharos': 'kharos', 'a town on Myrrow': 'myrrow' };
const ref = (mod, k) => (k && typeof k === 'string' && k[0] === '@' ? gameKey(mod.id, k.slice(1)) : k);

// Someone of a town, as a story wants them.
function castOne(L, who, rng, not = []) {
  if (!L || !who || who === 'nobody') return null;
  const skip = new Set(not.filter(Boolean).map((r) => r.idx));
  if (who === 'the mayor') {
    const m = mayorOf(L);
    return m && !skip.has(m.idx) ? m : null;
  }
  let pool;
  if (who === 'a child') pool = living(L).filter((r) => r.age === 'child' && !r.away);
  else if (who === 'an elder') pool = adults(L).filter((r) => r.age === 'elder' || r.job === 'retired');
  else if (JOBS[who]) pool = adults(L).filter((r) => JOBS[who].includes(r.job));
  else pool = adults(L).filter((r) => r.job !== 'mayor' && r.job !== 'guard');
  pool = pool.filter((r) => alive(r) && !skip.has(r.idx));
  return pool.length ? pool[Math.floor(rng.next() * pool.length)] : null;
}

// The beginning of a story in town L (or null if it hasn't the people).
function opening(L, st, rng, extra = {}) {
  if (!L || !L.settlement) return null;
  const v = st.p || {};
  const sid = L.settlement.id;
  const giver = castOne(L, v.giver, rng);
  if (v.giver && v.giver !== 'nobody' && !giver) return null;
  const other = castOne(L, v.other, rng, [giver]);
  if (v.other && v.other !== 'nobody' && !other) return null;
  const cast = { town: R.town(sid), ...(extra.cast || {}) };
  if (giver) cast.giver = R.rec(sid, giver.idx);
  if (other) cast.other = R.rec(sid, other.idx);
  return { cast, sid, vars: { ...(extra.vars || {}) }, parent: extra.parent ?? null };
}

function townsFor(S, where, near = null) {
  let list = laidTowns(S);
  const isle = ISLE[where];
  if (isle) list = list.filter((L) => L.settlement.island === isle);
  if (where === 'the nearest town' || near) {
    const p = near || (S.game.player ? { x: S.game.player.x, z: S.game.player.z } : null);
    if (p) list = list.sort((a, b) => Math.hypot(townMid(a.settlement).x - p.x, townMid(a.settlement).z - p.z) - Math.hypot(townMid(b.settlement).x - p.x, townMid(b.settlement).z - p.z));
  }
  return list;
}

// ------------------------------------------------------------ a story made
export function compileStory(mod, story) {
  const g = story.graph || { nodes: [], links: [] };
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const start = g.nodes.find((n) => n.type === 'st.start');
  if (!start) return null;
  const mid = gameKey(mod.id, story.id);
  const sv = start.p || {};
  const next = (nid, port) => {
    const l = g.links.find((q) => q.from[0] === nid && q.from[1] === port);
    return l && byId.has(l.to[0]) ? l.to[0] : null;
  };
  // (Round 64) A player in it, and their character (its traits, where
  // they came from, the values the mod's graphs keep with them).
  const inIt = (th, S) => {
    const ids = players(th, S);
    return S.players().filter((q) => ids.includes(q.pid));
  };
  const heroOf = (S, p) => (S.game.asPlayer ? S.game.asPlayer(p, () => S.game.hero) : S.game.hero) || null;
  // A value kept by the story ({name}), the world's ({world:name}) or a
  // player's in it ({player:name}: the first of them, or this one).
  const valueOf = (th, S, scope, name, p = null) => {
    const k = String(name ?? '').replace(/^\{|\}$/g, '');
    if (scope === 'world') return ((S.game.modState || {}).vars || {})[`${mod.id}:${k}`];
    if (scope === 'player') {
      const q = p || inIt(th, S)[0]?.p || S.game.player;
      const h = q ? heroOf(S, q) : null;
      // (No character: kept with the world, as the graphs keep them.)
      const bag = h ? h.modFlags || {} : (S.game.modState || {}).vars || {};
      return bag[`${mod.id}:${k}`];
    }
    return th.vars[k];
  };
  // Words with {world:name} and {player:name} in them, those put in.
  const scoped = (th, S, text, p = null) => String(text ?? '').replace(/\{(world|player|story):([\w.-]+)\}/g, (m, sc, k) => {
    const x = valueOf(th, S, sc, k, p);
    return x === undefined || x === null ? '' : typeof x === 'number' ? String(+x.toFixed(2)) : String(x);
  });
  // Its words, with what's in them filled in.
  const words = (th, S, text, n = null) => {
    text = scoped(th, S, text);
    const v = (n && n.p) || {};
    const it = ref(mod, v.item);
    const cr = ref(mod, v.creature);
    const town = th.sid !== null && th.sid !== undefined ? S.game.world.ow.settlements[th.sid] : null;
    const pl = Object.keys(th.touched || {})[0];
    return fill(text || '', {
      ...th.vars, town: town ? town.name : 'the town', giver: th.names.giver || 'someone', other: th.names.other || 'someone else',
      player: pl ? nameOf(S, R.pl(pl)) : 'you', item: it && ITEMS[it] ? ITEMS[it].name.toLowerCase() : v.item || 'things', count: v.count ?? '',
      creature: cr ? (MODS.species?.(cr)?.name || String(cr).replace(/^m:[^:]+:/, '').replace(/_/g, ' ')).toLowerCase() : 'beasts',
    });
  };
  // On to whatever's wired to `port` (or, nothing there, the story's over).
  const on = (th, S, nid, port, line = null) => {
    if (th.done) return;
    // (Too many steps at once: a loop. Stopped.)
    const now = S.now;
    if (th.vars._at !== now) {
      th.vars._at = now;
      th.vars._n = 0;
    }
    if (++th.vars._n > 60) return S.end(th, 'tangled', 'The story went round in circles, and stopped.');
    const to = next(nid, port);
    if (to) S.go(th, to, line);
    else S.end(th, 'over', line);
  };
  const players = (th, S) => {
    const t = Object.keys(th.touched || {});
    return t.length ? t : S.players().map((q) => q.pid);
  };
  const spotFor = (th, S, n, spot) => {
    const town = S.game.world.ow.settlements[th.sid];
    const c = town ? townMid(town) : null;
    if (!c) return null;
    const rng = S.rng(th, hashString(n.id));
    if (spot === 'in the town') return c;
    if (spot === 'by the one asking') {
      const ent = th.cast.giver ? resolve(S, th.cast.giver) : null;
      return ent && ent.x !== undefined ? { x: Math.round(ent.x), z: Math.round(ent.z) } : c;
    }
    // (Where a structure of the story's went up, if it raised one.)
    const placed = (th.vars._places || []).find((q) => q.x !== undefined);
    if (placed && spot === 'out near the town') return { x: placed.x, z: placed.z };
    return spotNear(S, c.x, c.z, spot === 'far out in the wilds' ? 90 : 40, spot === 'far out in the wilds' ? 160 : 80, rng, { clear: 12, flat: 1 }) || { x: c.x + 50, z: c.z };
  };
  // (Round 64) Whether an If's so, as things stand. Fields compared can
  // have values in them ({name}, {world:name}, {player:name}).
  const check = (th, S, v) => {
    const w = v.what || 'a player in it has';
    const ps = () => inIt(th, S);
    const town = th.sid !== null && th.sid !== undefined ? S.game.world.ow.settlements[th.sid] : null;
    const hour = (S.now / 60) % 24;
    const least = +(v.least ?? v.count ?? 1) || 0;
    const fillv = (t) => words(th, S, String(t ?? ''));
    switch (w) {
      case 'a player in it has': {
        const it = ref(mod, v.item);
        return ps().some(({ p }) => p.inv.reduce((s, q) => s + (q && q.item === it ? q.count : 0), 0) >= (v.count ?? 1));
      }
      case 'a player in it holds': {
        const it = ref(mod, v.item);
        return ps().some(({ p }) => (p.heldItem ? p.heldItem() : null) === it);
      }
      case 'a player in it wears': {
        const it = ref(mod, v.item);
        return ps().some(({ p }) => Object.values(p.equip || {}).includes(it));
      }
      case 'a player in it is hurt':
        return ps().some(({ p }) => (100 * Math.max(0, p.hp)) / Math.max(1, p.maxHp) < (+v.pct || 50));
      case 'a player in it is near': {
        let at = null;
        if (v.whom === 'the town') at = town ? townMid(town) : null;
        else if (v.whom === 'where a task is') at = (th.tasks || []).map((t) => t.at).find(Boolean) || null;
        else {
          const r = th.cast[v.whom === 'the other' ? 'other' : 'giver'];
          const e = r ? resolve(S, r) : null;
          at = e && e.x !== undefined ? e : null;
        }
        const d = +v.dist || 8;
        return !!at && ps().some(({ p }) => Math.hypot(p.x - at.x, p.z - at.z) <= d);
      }
      case 'a player in it is famous':
        return players(th, S).some((pid) => (S.person(pid).fame || 0) >= least);
      case 'the giver thinks well of a player in it': {
        const g = th.cast.giver;
        if (!g || g.t !== 'rec' || !S.sim.repEntry) return false;
        return S.sim.repEntry(g.sid, g.idx).v + (S.sim.areaMod ? S.sim.areaMod(g.sid) : 0) >= least;
      }
      case 'a player in it has the trait':
        return ps().some(({ p }) => {
          const h = heroOf(S, p);
          if (!h) return false;
          if (v.trait === 'mod') return (h.modTraits || []).some((k) => k === gameKey(mod.id, v.traitId || '') || String(k).endsWith(`:${v.traitId}`));
          return (h.traits || []).includes(v.trait || 'tough');
        });
      case 'a player in it came as':
        return ps().some(({ p }) => {
          const h = heroOf(S, p);
          if (!h) return false;
          if (v.origin === 'mod') return !!h.modOrigin && (h.modOrigin === gameKey(mod.id, v.originId || '') || String(h.modOrigin).endsWith(`:${v.originId}`));
          return !h.modOrigin && h.origin === (v.origin || 'crash');
        });
      case 'players in it are at least':
        return ps().length >= least;
      case 'the giver is alive':
        return !!th.cast.giver && isAlive(S, th.cast.giver);
      case 'the other is alive':
        return !!th.cast.other && isAlive(S, th.cast.other);
      case 'it is night':
        return !!(S.sim.isNight ? S.sim.isNight() : hour < 6 || hour >= 20);
      case 'it is day':
        return !(S.sim.isNight ? S.sim.isNight() : hour < 6 || hour >= 20);
      case 'the hour is between': {
        const a = +v.from || 0;
        const b = +v.to || 0;
        return a <= b ? hour >= a && hour < b : hour >= a || hour < b;
      }
      case 'days since it began are at least':
        return (S.now - (th.born ?? S.now)) / DAY_MIN >= least;
      case 'the weather is': {
        const k = town ? townWeather(S.game.seed, town, S.now) : S.game.weather?.kind || 'clear';
        return v.sky === 'rain or snow' || !v.sky ? k === 'rain' || k === 'snow' : k === v.sky;
      }
      case 'the town is a':
        return !!town && town.type === (v.size || 'village');
      case 'the town is on':
        return !!town && String(town.island || '').toLowerCase() === String(v.isle || 'Thessa').toLowerCase();
      case 'the town is at war':
        return !!town && !!S.sim.war && !!S.sim.war.atWar && S.sim.war.atWar(town.civ);
      case 'a value is at least':
        return (+valueOf(th, S, 'story', v.name) || 0) >= (v.count ?? 1);
      case 'a value is':
        return compareValues(valueOf(th, S, 'story', v.name), v.op || 'is at least', fillv(v.value));
      case 'a world value is':
        return compareValues(valueOf(th, S, 'world', v.name), v.op || 'is at least', fillv(v.value));
      case 'a player value is':
        return ps().some(({ p }) => compareValues(valueOf(th, S, 'player', v.name, p), v.op || 'is at least', fillv(v.value)));
      case 'these compare':
        return compareValues(fillv(v.left), v.op || 'is', fillv(v.value));
      case 'by chance':
        return S.rng(th, hashString(`${th.node}:${S.now}`)).next() * 100 < (v.chance ?? 50);
      case 'another story of yours is going': {
        const k = v.story ? gameKey(mod.id, v.story) : null;
        return !!k && S.live().some((t) => t !== th && t.m === k);
      }
      default:
        return false;
    }
  };
  // Every beat of the story, a node of its own.
  const nodes = {};
  const tasks = {};
  for (const n of g.nodes) {
    const v = n.p || {};
    const D = NODES[n.type];
    if (!D || !D.story) continue;
    const node = {};
    // (Structures waiting to go up near the town: raised when someone's
    // near enough to see them.)
    node.live = (th, S) => raisePending(th, S, mod);
    switch (n.type) {
      case 'st.start':
        node.enter = (th, S) => on(th, S, n.id, 'begin');
        break;
      case 'st.news':
        node.enter = (th, S) => {
          const t = words(th, S, v.text, n);
          S.note(th, t, { news: v.board !== false && th.sid !== null ? [th.sid] : [] });
          if (v.tell) for (const pid of S.players().map((q) => q.pid)) S.tell(pid, t, '#e8d8a8');
          on(th, S, n.id, 'next');
        };
        break;
      case 'st.task': {
        const kind = { 'bring things': 'fetch', 'carry something': 'deliver', 'slay creatures': 'slay', 'talk to someone': 'talk', 'go somewhere': 'find' }[v.kind] || 'fetch';
        node.enter = (th, S) => {
          const it = ref(mod, v.item);
          const cr = ref(mod, v.creature);
          const at = kind === 'slay' || kind === 'find' ? spotFor(th, S, n, v.spot) : null;
          if (v.structure && at && kind !== 'fetch') (th.vars._places ||= []).push({ id: v.structure, x: at.x, z: at.z, done: false });
          const target = kind === 'deliver' || kind === 'talk' ? th.cast[v.to || 'other'] || null : null;
          const reward = { coins: v.coins || 0, items: v.reward ? [[ref(mod, v.reward), v.rewardN || 1]].filter((q) => ITEMS[q[0]]) : [], rep: v.rep || 0, fame: 1 };
          const t = S.post(th, {
            role: n.id, kind, title: words(th, S, v.title, n), pitch: words(th, S, v.pitch, n), sid: th.sid, giver: th.cast.giver || null,
            item: kind === 'fetch' || kind === 'deliver' ? (it && ITEMS[it] ? it : 'bread') : null, n: v.count || 1, need: kind === 'slay' ? v.count || 1 : 1,
            target, at, r: kind === 'slay' ? 30 : 5, days: v.days || null, reward, data: { species: cr ? [cr] : [], spawn: kind === 'slay' ? { sp: cr, n: v.count || 1 } : null },
          });
          if (at) t.pinLabel = t.title;
        };
        node.live = (th, S) => {
          raisePending(th, S, mod);
          // (Its creatures there when someone comes near.)
          for (const t of S.tasksOf(th, n.id)) {
            const sp = t.data && t.data.spawn;
            if (!sp || sp.made || !sp.sp || !t.at || !MODS.species?.(sp.sp)) continue;
            const near = S.players().some(({ p }) => Math.max(Math.abs(p.x - t.at.x), Math.abs(p.z - t.at.z)) <= 40);
            if (!near) continue;
            sp.made = true;
            const game = S.game;
            for (let i = 0; i < Math.min(12, sp.n); i++) {
              const y = game.world.findStandY(t.at.x + (i % 3) * 2, t.at.z + Math.floor(i / 3) * 2);
              if (y < 1) continue;
              const s = game.findFreeSpot(t.at.x + (i % 3) * 2, t.at.z + Math.floor(i / 3) * 2, y);
              const c = game.spawnMonster(sp.sp, s.x, s.y, s.z);
              if (c) c.home = { x: t.at.x, z: t.at.z };
            }
          }
        };
        tasks[n.id] = {
          done: (th, t, by, S) => on(th, S, n.id, 'done'),
          lapsed: (th, t, S) => on(th, S, n.id, 'failed', `Nobody saw to it in time: ${t.title.toLowerCase()}.`),
          accepted: (th, t, who, S) => {
            if (kind === 'deliver' && who.t === 'pl' && t.item) S.give(who.pid, t.item, t.n || 1);
          },
          reach: kind === 'find' ? (th, t, pid, S) => S.complete(t, R.pl(pid)) : undefined,
        };
        break;
      }
      case 'st.talk':
        // (Waits: see townTalk and respond, below.)
        break;
      case 'st.wait':
        node.hour = (th, S) => {
          if (S.now - th.nodeAt >= (v.hours || 1) * 60) on(th, S, n.id, 'next');
        };
        node.day = node.hour;
        node.fade = Math.max(20, (v.hours || 1) / 24 + 5);
        break;
      case 'st.chance':
        node.enter = (th, S) => {
          const c = S.choose(th, [{ to: 'a', w: v.a ?? 1 }, { to: 'b', w: v.b ?? 1 }, { to: 'c', w: v.c ?? 0 }]);
          on(th, S, n.id, c ? c.to : 'a');
        };
        break;
      case 'st.check':
        node.enter = (th, S) => on(th, S, n.id, check(th, S, v) ? 'yes' : 'no');
        break;
      case 'st.set':
        node.enter = (th, S) => {
          const k = String(v.name || 'value').replace(/[^\w-]/g, '');
          // (Round 64: what's typed can have values in it too.)
          const by = +words(th, S, String(v.value ?? 1)) || 0;
          if (v.op === 'set') th.vars[k] = by;
          else if (v.op === 'take away') th.vars[k] = (+th.vars[k] || 0) - by;
          else if (v.op === 'a random number up to') th.vars[k] = Math.floor(S.rng(th, hashString(n.id)).next() * (Math.max(0, by) + 1));
          else if (v.op === 'words') th.vars[k] = words(th, S, v.words ?? '');
          else th.vars[k] = (+th.vars[k] || 0) + by;
          on(th, S, n.id, 'next');
        };
        break;
      case 'st.take':
        node.enter = (th, S) => {
          const it = ref(mod, v.item);
          const want = Math.max(1, +v.count || 1);
          const who = inIt(th, S).find(({ p }) => p.inv && p.inv.reduce((s, q) => s + (q && q.item === it ? q.count : 0), 0) >= want);
          if (!who || !it) return on(th, S, n.id, 'no');
          let left = want;
          for (let i = 0; i < who.p.inv.length && left > 0; i++) {
            const q = who.p.inv[i];
            if (!q || q.item !== it) continue;
            const k = Math.min(left, q.count);
            q.count -= k;
            left -= k;
            if (q.count <= 0) who.p.inv[i] = null;
          }
          if (v.text) S.tell(who.pid, words(th, S, v.text, n), '#ffe070');
          on(th, S, n.id, 'ok');
        };
        break;
      case 'st.rep':
        node.enter = (th, S) => {
          const k = Math.round(+v.n || 0);
          for (const pid of players(th, S)) {
            if (v.by === 'the town' || !v.by) {
              if (th.sid !== null && th.sid !== undefined) S.townSay(pid, th.sid, k);
            } else {
              const r = th.cast[v.by === 'the other' ? 'other' : 'giver'];
              if (r && r.t === 'rec' && S.sim.repEntry) S.sim.repEntry(r.sid, r.idx).v += k;
            }
            if (v.text) S.tell(pid, words(th, S, v.text, n), k >= 0 ? '#a0e080' : '#e09080');
          }
          on(th, S, n.id, 'next');
        };
        break;
      case 'st.say':
        node.enter = (th, S) => {
          const r = th.cast[v.who === 'other' ? 'other' : 'giver'];
          const e = r ? resolve(S, r) : null;
          if (e && e.say) e.say(words(th, S, v.text, n), 4);
          on(th, S, n.id, 'next');
        };
        break;
      case 'st.spawn':
        node.enter = (th, S) => {
          const at = spotFor(th, S, n, v.spot);
          if (at) (th.vars._spawns ||= []).push({ sp: ref(mod, v.creature), n: Math.max(1, Math.min(12, +v.count || 1)), x: at.x, z: at.z });
          on(th, S, n.id, 'next');
        };
        break;
      case 'st.give':
        node.enter = (th, S) => {
          const it = ref(mod, v.item);
          if (it && ITEMS[it]) for (const pid of players(th, S)) {
            S.give(pid, it, Math.max(1, v.count || 1));
            if (v.text) S.tell(pid, words(th, S, v.text, n), '#ffe070');
          }
          on(th, S, n.id, 'next');
        };
        break;
      case 'st.place':
        node.enter = (th, S) => {
          if (v.structure && mod.structures[v.structure]) {
            const at = spotFor(th, S, n, v.spot);
            if (at) {
              (th.vars._places ||= []).push({ id: v.structure, x: at.x, z: at.z, done: false });
              th.spots.push({ x: at.x, z: at.z });
            }
          }
          on(th, S, n.id, 'next');
        };
        break;
      case 'st.event':
        node.enter = (th, S) => {
          MODS.sendEvent?.(S.game, String(v.name || ''), v.value ?? null, {});
          on(th, S, n.id, 'next');
        };
        break;
      case 'st.until': {
        const what = v.what || 'an event';
        node.on = {
          mod_event: (th, ev, S) => {
            if (what === 'an event' && ev.name === v.name) on(th, S, n.id, 'next');
          },
          kill: (th, ev, S) => {
            if (what !== 'a kill' || !ev.species || ev.species !== ref(mod, v.creature)) return;
            // (So many of them: counted while it waits.)
            const k = `_k${n.id}`;
            th.vars[k] = (th.vars[k] || 0) + 1;
            if (th.vars[k] >= Math.max(1, +v.count || 1)) {
              delete th.vars[k];
              on(th, S, n.id, 'next');
            }
          },
        };
        // (Round 64) A value come to something; an hour of the day come round.
        const ready = (th, S) => {
          if (what === 'a value') {
            const m = /^\{?(?:(world|player|story):)?([\w.-]+)\}?$/.exec(String(v.value || '').trim());
            const cur = m ? valueOf(th, S, m[1] || 'story', m[2]) : undefined;
            if (m && m[1] === 'player') return inIt(th, S).some(({ p }) => compareValues(valueOf(th, S, 'player', m[2], p), v.op || 'is at least', words(th, S, String(v.than ?? ''))));
            return compareValues(cur, v.op || 'is at least', words(th, S, String(v.than ?? '')));
          }
          if (what === 'a time of day') return Math.floor((S.now / 60) % 24) === Math.floor(+v.hour || 0);
          return false;
        };
        if (what === 'a value' || what === 'a time of day') {
          node.live = (th, S) => {
            raisePending(th, S, mod);
            if (ready(th, S)) on(th, S, n.id, 'next');
          };
          node.hour = node.live;
          // (Far from anyone, a day goes by at a time: the hour's been and gone.)
          node.day = (th, S) => {
            if (what === 'a time of day' || ready(th, S)) on(th, S, n.id, 'next');
          };
        }
        node.fade = 60;
        break;
      }
      case 'st.story':
        node.enter = (th, S) => {
          if (v.story && mod.stories[v.story]) S.spawn(th, gameKey(mod.id, v.story), { sid: th.sid, cast: th.cast, vars: {} });
          on(th, S, n.id, 'next');
        };
        break;
      case 'st.end':
        node.enter = (th, S) => S.end(th, String(v.outcome || 'over'), words(th, S, v.text, n), { news: v.board !== false && th.sid !== null ? [th.sid] : [] });
        break;
      default:
    }
    nodes[n.id] = node;
  }
  // A word with someone: what they'd say, while the story's at it.
  const talkFor = (th, S, nid) => {
    const n = byId.get(nid);
    const v = n.p || {};
    const choices = ['a', 'b', 'c'].filter((k) => v[k]).map((k) => ({ id: 'sg_modc', arg: `t${th.id}:${nid}:${k}`, label: words(th, S, v[k], n) }));
    return { lines: [words(th, S, v.text, n)], choices: choices.length ? choices : [{ id: 'sg_modc', arg: `t${th.id}:${nid}:next`, label: 'I see.' }], back: null };
  };
  const isWho = (th, npc, who) => {
    const r = th.cast[who || 'giver'];
    return !!(r && npc.rec && r.t === 'rec' && r.idx === npc.rec.idx && r.sid === (npc.rec.sid ?? npc.settlement?.id));
  };
  const M = {
    id: mid, family: `mod:${mod.id}`, mod: mod.id, max: Math.max(1, Math.min(8, sv.max ?? 2)), hidden: !!sv.secret,
    key: (o) => (sv.perTown !== false && o.sid !== null && o.sid !== undefined ? `${mid}:${o.sid}` : null),
    title: (th, S) => words(th, S, sv.title || story.name || 'A story'),
    start: start.id,
    nodes,
    tasks,
    townTalk(th, npc, pid) {
      const n = byId.get(th.node);
      if (!n || n.type !== 'st.talk' || !isWho(th, npc, (n.p || {}).who)) return [];
      return [{ id: 'sg_mod', arg: `t${th.id}:${n.id}`, label: fill((n.p || {}).ask || 'Yes?', {}) }];
    },
    respond(th, npc, pid, id, arg, S) {
      const parts = String(arg || '').split(':');
      const nid = parts[1];
      if (id === 'sg_mod') {
        if (th.node !== nid) return { lines: ['Hm? Never mind.'] };
        S.touch(th, pid, null);
        return talkFor(th, S, nid);
      }
      if (id === 'sg_modc') {
        if (th.node !== nid) return { lines: ['...'] };
        const n = byId.get(nid);
        const port = parts[2] === 'next' || !next(nid, parts[2]) ? 'next' : parts[2];
        S.touch(th, pid, null);
        on(th, S, nid, port);
        // (Another word with the same one straight after: the talk goes on.)
        const nn = byId.get(th.node);
        if (!th.done && nn && nn.type === 'st.talk' && isWho(th, npc, (nn.p || {}).who)) return talkFor(th, S, nn.id);
        return { lines: [words(th, S, (n.p || {}).bye || 'Very well.', n)] };
      }
      return null;
    },
  };
  // How it begins.
  if (sv.when === 'now and then' || !sv.when) {
    M.scan = (S, rng) => {
      if (rng.next() * 100 >= (sv.chance ?? 8)) return null;
      for (const L of townsFor(S, sv.where).slice(0, 6)) {
        const o = opening(L, start, rng);
        if (o) return o;
      }
      return null;
    };
  } else if (sv.when === 'after a game story ends' || sv.when === 'when an event is sent') {
    const after = sv.when === 'after a game story ends';
    M.seeds = [{
      on: after ? 'saga_end' : 'mod_event',
      make(ev, S) {
        if (after && (ev.m !== sv.after || (sv.outcome && ev.outcome !== sv.outcome))) return null;
        if (!after && ev.name !== sv.event) return null;
        const prev = after ? S.thread(ev.th) : null;
        const rng = new RNG(hash4(S.game.seed | 0, Math.floor(S.now), hashString(mid)));
        const L = prev && prev.sid !== null && prev.sid !== undefined ? layoutOf(S, prev.sid) : townsFor(S, sv.where, ev.pos || null)[0];
        // (After one of the game's stories: its people, if they fit.)
        const cast = {};
        if (prev) for (const k of ['giver', 'other']) {
          const r = Object.values(prev.cast || {}).find((q) => q && q.t === 'rec' && isAlive(S, q) && !Object.values(cast).some((c) => sameRef(c, q)));
          if (r && (k === 'giver' ? sv.giver : sv.other) !== 'nobody') cast[k] = r;
        }
        const o = opening(L, start, rng, { cast, parent: prev ? prev.id : null });
        if (o) for (const k of Object.keys(cast)) o.cast[k] = cast[k];
        return o;
      },
    }];
  }
  return M;
}

// Structures a story's waiting to put up, raised once someone's near (and,
// round 64, creatures waiting to come).
function raisePending(th, S, mod) {
  for (const q of th.vars._spawns || []) {
    if (q.done || !q.sp || !MODS.species?.(q.sp)) continue;
    if (!S.players().some(({ p }) => Math.max(Math.abs(p.x - q.x), Math.abs(p.z - q.z)) <= 40)) continue;
    q.done = true;
    const game = S.game;
    for (let i = 0; i < q.n; i++) {
      const y = game.world.findStandY(q.x + (i % 3) * 2, q.z + Math.floor(i / 3) * 2);
      if (y < 1) continue;
      const s = game.findFreeSpot(q.x + (i % 3) * 2, q.z + Math.floor(i / 3) * 2, y);
      const c = game.spawnMonster(q.sp, s.x, s.y, s.z);
      if (c) c.home = { x: q.x, z: q.z };
    }
  }
  const list = th.vars._places;
  if (!list || !list.length) return;
  for (const q of list) {
    if (q.done || !mod.structures[q.id]) continue;
    const near = S.players().some(({ p }) => Math.max(Math.abs(p.x - q.x), Math.abs(p.z - q.z)) <= 48);
    if (!near) continue;
    const y = S.game.world.findStandY(q.x, q.z);
    if (y < 1) continue;
    q.done = true;
    MODS.placeStructure?.(S.game, mod, q.id, { x: q.x, y, z: q.z }, { level: true, marks: true });
  }
}

// ------------------------------------------------------------ in and out
const added = [];
const restore = [];
function install() {
  for (const m of MODS.active) {
    for (const st of Object.values(m.stories || {})) {
      let M = null;
      try {
        M = compileStory(m, st);
      } catch (e) {
        console.warn('mod story', m.id, st.id, e);
      }
      if (!M) continue;
      MOTIFS[M.id] = M;
      added.push(M.id);
    }
    for (const p of Object.values(m.patches || {})) applyPatch(m, p);
  }
  if (redirects.length || arrivals.length) GO_HOOKS.push(goHook);
}
function uninstall() {
  for (const id of added.splice(0)) delete MOTIFS[id];
  for (const r of restore.splice(0).reverse()) r();
  redirects.length = 0;
  arrivals.length = 0;
  const i = GO_HOOKS.indexOf(goHook);
  if (i >= 0) GO_HOOKS.splice(i, 1);
}
MODS.hooks.install.push(install);
MODS.hooks.uninstall.push(uninstall);

// ------------------------------------------------------------ changing the game's
// A change: { motif, off, often (0.25..4), turns: [{ from, to, chance,
// instead }] (instead: a part of it, an ending '=outcome', or one of the
// mod's stories '@id'), arrive: [{ node, message, event, story }] }.
const redirects = [];
const arrivals = [];
function applyPatch(m, p) {
  const M = MOTIFS[p.motif];
  if (!M) return;
  const keep = { scan: M.scan, seeds: M.seeds, begin: M.begin, max: M.max };
  restore.push(() => Object.assign(M, keep));
  if (p.off) {
    M.scan = null;
    M.seeds = [];
    M.begin = null;
    return;
  }
  const often = Math.max(0, Math.min(4, p.often ?? 1));
  if (often !== 1 && keep.scan) {
    M.scan = (S, rng, d) => {
      if (often < 1) return rng.next() < often ? keep.scan(S, rng, d) : null;
      const out = [];
      for (let i = 0; i < Math.ceil(often); i++) out.push(...[].concat(keep.scan(S, rng, d) || []));
      return out;
    };
    M.max = Math.max(1, Math.round((keep.max ?? 6) * Math.max(1, often)));
  }
  for (const t of p.turns || []) redirects.push({ mod: m, motif: p.motif, ...t });
  for (const a of p.arrive || []) arrivals.push({ mod: m, motif: p.motif, ...a });
}

function goHook(th, from, to, S, phase) {
  if (phase === 'arrive') {
    for (const a of arrivals) {
      if (a.motif !== th.m || a.node !== to) continue;
      if (a.message) for (const { pid } of S.players()) if (th.touched[pid] || th.tier === 'complex') S.tell(pid, a.message, '#c8b0ff');
      if (a.event) MODS.sendEvent?.(S.game, a.event, th.id, {});
      if (a.story && a.mod.stories[a.story]) S.spawn(th, gameKey(a.mod.id, a.story), { sid: th.sid, cast: th.cast });
    }
    return null;
  }
  for (const r of redirects) {
    if (r.motif !== th.m || (r.from && r.from !== from) || r.to !== to) continue;
    const rng = S.rng(th, 0x6e7);
    if (rng.next() * 100 >= (r.chance ?? 50)) continue;
    const ins = String(r.instead || '');
    if (ins.startsWith('=')) return { end: ins.slice(1) || 'over' };
    if (ins.startsWith('@')) {
      const sid = ins.slice(1);
      if (r.mod.stories[sid]) S.spawn(th, gameKey(r.mod.id, sid), { sid: th.sid, cast: th.cast });
      return { end: 'turned' };
    }
    if (ins && MOTIFS[th.m].nodes[ins]) return { to: ins };
  }
  return null;
}

// A mod's story begun now (by a trigger, a graph's Start story).
MODS.startStory = (game, mod, id, x = {}) => {
  const S = game.sim && game.sim.saga;
  const mid = gameKey(mod.id, String(id || '').replace(/^@/, ''));
  if (!S || !MOTIFS[mid]) return null;
  const st = mod.stories[String(id).replace(/^@/, '')];
  const start = st && (st.graph.nodes || []).find((n) => n.type === 'st.start');
  if (!start) return null;
  const at = (x && x.pos) || (game.player ? { x: game.player.x, z: game.player.z } : null);
  const rng = new RNG(hash4(game.seed | 0, Math.floor(S.now), hashString(mid), 7));
  const towns = at ? townsNear(S, at.x, at.z, 30).map((s) => layoutOf(S, s.id)).filter(Boolean) : laidTowns(S);
  for (const L of towns.slice(0, 5)) {
    const o = opening(L, start, rng);
    if (!o) continue;
    const th = S.startStory(mid, o);
    if (th && x && x.player && x.player.kind === 'player') S.touch(th, S.players().find((q) => q.p === x.player)?.pid ?? null, null);
    return th;
  }
  return null;
};
