// The newer story nodes at work in the game (round 68: see storynodes2.js
// for what each is). Each is made into a beat of the story, as the first
// ones are in storyrun.js, with the kit `K` it hands over: the story's
// words, its values, its people and places, its way on.
import { MODS } from './state.js';
import { gameKey } from './format.js';
import { NODES } from './graph.js';
import { LAND_OF, LANDS } from './storynodes.js';
import { R, nameOf, isAlive, resolve } from '../sim/saga/core.js';
import { entOf, whereOf, townMid, playerOf } from '../sim/saga/refs.js';
import { layoutOf } from '../sim/saga/motifs/lib.js';
import { ITEMS } from '../world/items.js';
import { REGION_W, REGION_D } from '../config.js';
import { hashString } from '../util/rng.js';
import { changeTown, changePerson, personFact, townFact, newcomerIn, townValue } from './towns.js';
import { countItem, removeItem } from '../game/inventory.js';
import { addShip, waterSpot, shipById, shipsOf, ownerId } from '../game/ships3d.js';
import { makeCrew } from '../game/shipcrew.js';
import { sendVoyage, ports } from '../game/shipfleets.js';
import { SHIP_TYPES } from '../world/shipmodels.js';
import { SVC } from './nodes.js';
import './storynodes2.js';

const DAY_MIN = 24 * 60;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const ROLE = { 'the giver': 'giver', 'the other': 'other', 'the third': 'third', 'the fourth': 'fourth' };
const landKey = (name) => (LANDS.find(([n]) => n === name) || [])[1] || String(name || '').toLowerCase();

// ------------------------------------------------------------ the story's people and places
export function townOfStory(th, S) {
  return th.sid !== null && th.sid !== undefined ? S.game.world.ow.settlements[th.sid] || null : null;
}
// Someone in it, where they're about (null: not about, or nobody).
export function roleEnt(th, S, role) {
  const r = th.cast[role];
  return r ? entOf(S, r) : null;
}
// Their record (and its town's layout).
export function roleRec(th, S, role) {
  const r = th.cast[role];
  if (!r || r.t !== 'rec') return null;
  const rec = resolve(S, r);
  const L = S.game.world.layouts.get(r.sid) || S.sim.layoutOf?.(r.sid) || null;
  return rec && L ? { rec, L, ent: rec.ent && !rec.ent.dead ? rec.ent : null } : null;
}
// Someone as the town nodes want them: their entity, or a stand-in for one.
const personArg = (P) => (P ? P.ent || { kind: 'npc', rec: P.rec, layout: P.L, settlement: P.L.settlement, name: `${P.rec.name.first} ${P.rec.name.last}` } : null);

// A place in the story (see PLACES), with a height to stand at.
export function placeOf(th, S, K, n, which) {
  const g = S.game;
  const town = townOfStory(th, S);
  const mid = town ? townMid(town) : null;
  let at = null;
  if (which === 'the town') at = mid;
  else if (ROLE[which]) at = th.cast[ROLE[which]] ? whereOf(S, th.cast[ROLE[which]]) : null;
  else if (which === 'a player in it') at = K.inIt(th, S)[0]?.p || null;
  else if (which === 'where its task is') at = (th.tasks || []).map((t) => t.at).find(Boolean) || null;
  else if (which === 'the story\'s place') at = th.vars._place || (th.vars._places || []).find((q) => q.x !== undefined) || (th.spots || [])[0] || null;
  else if (which === 'out near the town' || which === 'far out in the wilds') at = K.spotFor(th, S, n, which);
  else if (which === 'the sea off the town' && mid) at = waterSpot(g, 'sloop', mid.x, mid.z, 4);
  else if (which === 'the nearest other town' && mid) {
    const o = g.world.ow.settlements.filter((s) => s !== town && !s.deserted).sort((a, b) => Math.hypot(townMid(a).x - mid.x, townMid(a).z - mid.z) - Math.hypot(townMid(b).x - mid.x, townMid(b).z - mid.z))[0];
    at = o ? townMid(o) : null;
  }
  if (!at) at = which === 'the story\'s place' ? K.spotFor(th, S, n, 'out near the town') : mid;
  if (!at) return null;
  const x = Math.round(at.x);
  const z = Math.round(at.z);
  const y = g.world.regionAt?.(x, z) ? g.world.findStandY(x, z) : 0;
  return { x, y: y > 0 ? y : at.y ?? 6, z };
}

// What someone in a story has been told to do, kept with it (so they do
// it again if they go out of sight and come back), and done now if
// they're about.
export function order(th, S, role, o) {
  const all = (th.vars._orders ||= {});
  if (o) all[role] = { ...o, key: `${S.now}:${Math.random().toString(36).slice(2, 6)}` };
  else delete all[role];
  applyOrder(th, S, role, true);
}
function applyOrder(th, S, role, fresh = false) {
  const e = roleEnt(th, S, role);
  if (!e || e.dead || e.kind !== 'npc') return;
  const o = (th.vars._orders || {})[role];
  if (!o) {
    if (e.storyOrder && e.storyOrder.th === th.id) {
      e.storyOrder = null;
      if (e.state === 'story') e.state = 'routine';
    }
    return;
  }
  if (o.foe) {
    const near = S.players().filter(({ p }) => !p.dead && cheb(p, e) <= 12);
    if (near.length && e.state !== 'fight' && (fresh || e.state !== 'flee')) {
      e.storyOrder = null;
      e.engage?.(near[0].p);
    }
    return;
  }
  if (e.storyOrder && e.storyOrder.key === o.key) return;
  e.storyOrder = { th: th.id, key: o.key, follow: o.follow || null, home: o.home || null, roam: o.roam ?? 1, lines: o.lines || null };
  e.state = 'story';
  e.path = null;
  e.threat = null;
}
// Every order of a story's, kept up (each half-second it's near anyone).
export function keepOrders(th, S) {
  for (const role of Object.keys(th.vars._orders || {})) applyOrder(th, S, role);
}
// Over: everyone in it back to their own ways.
export function releaseOrders(th, S) {
  for (const role of Object.keys(th.vars._orders || {})) {
    const e = roleEnt(th, S, role);
    if (e && e.storyOrder && e.storyOrder.th === th.id) {
      e.storyOrder = null;
      if (e.state === 'story') e.state = 'routine';
    }
  }
  th.vars._orders = {};
}

// The nearest player in it to somewhere (pid and entity).
function nearestIn(th, S, K, at) {
  let best = null;
  for (const q of K.inIt(th, S)) if (!best || (at && cheb(q.p, at) < cheb(best.p, at))) best = q;
  return best;
}

// Words across a player's screen (a title card); a line in their log if
// they're playing elsewhere.
export function card(S, pid, title, sub, secs = 4, color = '#f0d890') {
  const g = S.game;
  const p = playerOf(g, pid);
  if (p && p === g.player && g.ui && g.ui.showCard) g.ui.showCard(title, sub, secs, color);
  else S.tell(pid, sub ? `${title}: ${sub}` : title, color);
}

// The story's ship (null: none, or gone).
export const storyShip = (th, S) => (th.vars._ship !== undefined && th.vars._ship !== null ? shipById(S.game, th.vars._ship) : null);

// ------------------------------------------------------------ more Ifs
// The If's round-68 questions (null: not one of these).
export function checkMore(th, S, K, v) {
  const g = S.game;
  const w = v.what;
  const ps = () => K.inIt(th, S);
  const town = townOfStory(th, S);
  const least = +(v.count ?? 1) || 0;
  switch (w) {
    case 'the third is alive': return !!th.cast.third && isAlive(S, th.cast.third);
    case 'the fourth is alive': return !!th.cast.fourth && isAlive(S, th.cast.fourth);
    case 'someone in it is following a player': return Object.keys(th.vars._orders || {}).some((r) => {
      const e = roleEnt(th, S, r);
      return e && e.storyOrder && e.storyOrder.follow && ps().some(({ p }) => cheb(p, e) <= 6);
    });
    case 'someone in it is where they were sent': return Object.keys(th.vars._orders || {}).some((r) => {
      const e = roleEnt(th, S, r);
      return e && e.storyOrder && e.storyOrder.home && e.storyOrder.there;
    });
    case 'a player in it is at sea': return ps().some(({ p }) => !!(p.raft || p.deck || p.swimming));
    case 'a player in it is aboard the story\'s ship': return ps().some(({ p }) => p.deck && p.deck.s === th.vars._ship);
    case 'the story\'s ship is sunk': {
      if (th.vars._ship === undefined || th.vars._ship === null) return false;
      const sh = storyShip(th, S);
      return !sh || sh.sinking > 0;
    }
    case 'the story\'s ship is near the town': {
      const sh = storyShip(th, S);
      const m = town ? townMid(town) : null;
      return !!(sh && m && Math.hypot(sh.x - m.x, sh.z - m.z) <= Math.max(+v.dist || 8, 40));
    }
    case 'a player in it is in a dungeon': return ps().some(({ p }) => !!(g.world.inInstance && g.world.inInstance(p.x)));
    case 'the storm wall is down': return !!g.world.ow.wallDown;
    case 'the town\'s realm is at war with a player\'s': {
      const mine = S.sim.war && S.sim.war.playerCiv ? S.sim.war.playerCiv() : null;
      return !!(town && town.civ && mine && S.sim.war.enemies(town.civ, mine));
    }
    case 'a player in it has coins': return ps().some(({ p }) => countItem(p.inv, 'coin') >= least);
    case 'a player in it is in the town': return !!town && ps().some(({ p }) => g.world.ow.settlementAt(Math.round(p.x), Math.round(p.z)) === town);
    case 'a player in it is near the story\'s place': {
      const at = placeOf(th, S, K, null, 'the story\'s place');
      return !!at && ps().some(({ p }) => cheb(p, at) <= (+v.dist || 8));
    }
    case 'the town has in its coffers': {
      const L = town ? layoutOf(S, town.id) : null;
      return !!(L && L.econ && (L.econ.treasury || 0) >= least);
    }
    case 'the town\'s people are content': return !!town && +townFact(g, town, 'mood') >= 55;
    case 'an event has been sent': return !!(th.vars._ev && th.vars._ev[v.event] !== undefined);
    default: return null;
  }
}

// ------------------------------------------------------------ the beats
// Node `n` (one of storynodes2's) made a beat of the story: { enter, live,
// hour, day, on, fade, castDown }, or null if it isn't one of these.
export function moreNode(n, K) {
  const v = n.p || {};
  const id = n.id;
  const on = (th, S, port, line = null) => K.on(th, S, id, port, line);
  const w = (th, S, t) => K.words(th, S, t, n);
  const node = {};
  switch (n.type) {
    // ---------------------------------------------------------- ways
    case 'st.switch':
      node.enter = (th, S) => {
        const val = K.input(th, S, n, 'value');
        for (const k of ['a', 'b', 'c', 'd', 'e']) {
          const t = v[k];
          if (t === undefined || t === null || String(t).trim() === '') continue;
          if (K.compare(val, v.op || 'is', w(th, S, t))) return on(th, S, k);
        }
        on(th, S, 'else');
      };
      return node;
    case 'st.loop':
      node.enter = (th, S) => {
        const k = `_loop${id}`;
        const c = (th.vars[k] || 0) + 1;
        if (c <= Math.max(1, +v.times || 1)) {
          th.vars[k] = c;
          return on(th, S, 'again');
        }
        delete th.vars[k];
        on(th, S, 'done');
      };
      return node;
    case 'st.once':
      node.enter = (th, S) => {
        const k = `_once${id}`;
        if (th.vars[k]) return on(th, S, 'after');
        th.vars[k] = 1;
        on(th, S, 'first');
      };
      return node;
    case 'st.cycle':
      node.enter = (th, S) => {
        const N = Math.max(2, Math.min(6, +v.ways || 2));
        const k = `_cyc${id}`;
        let i;
        if (v.shuffle) {
          let bag = Array.isArray(th.vars[k]) ? th.vars[k] : [];
          if (!bag.length) bag = Array.from({ length: N }, (_, j) => j);
          const r = S.rng(th, hashString(id)).next();
          i = bag.splice(Math.floor(r * bag.length), 1)[0];
          th.vars[k] = bag;
        } else {
          i = (th.vars[k] || 0) % N;
          th.vars[k] = i + 1;
        }
        on(th, S, `w${i + 1}`);
      };
      return node;
    case 'st.mark':
      node.enter = (th, S) => on(th, S, 'next');
      return node;
    case 'st.jump':
      node.enter = (th, S) => {
        const name = String(v.name || '').trim().toLowerCase();
        const m = K.g.nodes.find((q) => q.type === 'st.mark' && String((q.p || {}).name || '').trim().toLowerCase() === name);
        if (m) K.go(th, S, m.id);
        else S.end(th, 'over');
      };
      return node;
    case 'st.when': {
      const tick = (th, S) => {
        if (th.node !== id || th.done) return;
        if (K.check(th, S, v)) return on(th, S, 'yes');
        if ((+v.hours || 0) > 0 && S.now - th.nodeAt >= v.hours * 60) on(th, S, 'no');
      };
      node.enter = tick;
      node.live = (th, S) => {
        K.keep(th, S);
        tick(th, S);
      };
      node.hour = tick;
      node.day = tick;
      node.fade = (+v.hours || 0) > 0 ? v.hours / 24 + 5 : 120;
      return node;
    }
    case 'st.race': {
      const time = (th, S) => {
        if (th.node === id && (+v.hours || 0) > 0 && S.now - th.nodeAt >= v.hours * 60) on(th, S, 'time');
      };
      const near = (th, S) => {
        if (th.node !== id || !v.near || v.near === 'nobody') return;
        const at = placeOf(th, S, K, n, v.near);
        if (at && K.inIt(th, S).some(({ p }) => cheb(p, at) <= (+v.dist || 6))) on(th, S, 'near');
      };
      node.on = {
        mod_event: (th, ev, S) => {
          if (v.event && ev.name === v.event) on(th, S, 'ev');
        },
        kill: (th, ev, S) => {
          if (!v.creature || !ev.species || ev.species !== K.ref(v.creature)) return;
          const k = `_k${id}`;
          th.vars[k] = (th.vars[k] || 0) + 1;
          if (th.vars[k] >= Math.max(1, +v.count || 1)) {
            delete th.vars[k];
            on(th, S, 'kill');
          }
        },
      };
      node.live = (th, S) => {
        K.keep(th, S);
        near(th, S);
        time(th, S);
      };
      node.hour = (th, S) => {
        near(th, S);
        time(th, S);
      };
      node.day = time;
      node.fade = (+v.hours || 0) > 0 ? v.hours / 24 + 5 : 120;
      return node;
    }
    case 'st.meanwhile':
      node.enter = (th, S) => {
        const to = K.next(id, 'aside');
        const mine = S.live().filter((t) => t.m === th.m).length;
        if (to && mine < 16) {
          const keep = Object.fromEntries(Object.entries(th.vars).filter(([k]) => !k.startsWith('_') || k === '_place' || k === '_ship'));
          S.begin(th.m, { sid: th.sid, cast: { ...th.cast }, title: th.title, parent: th.id, touched: Object.keys(th.touched), vars: { ...keep, _branch: `${th.id}.${id}.${S.now}`, _jump: to } });
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.retitle':
      node.enter = (th, S) => {
        const t = w(th, S, v.title);
        if (t) S.retitle(th, t);
        if (v.line) S.note(th, w(th, S, v.line));
        if (v.card !== false && t) for (const pid of K.players(th, S)) card(S, pid, t, w(th, S, v.sub || ''), 4.5);
        on(th, S, 'next');
      };
      return node;
    case 'st.endstory':
      node.enter = (th, S) => {
        const k = v.story ? gameKey(K.mod.id, v.story) : null;
        if (k) for (const t of S.live()) if (t !== th && t.m === k && (!v.here || t.sid === th.sid)) S.end(t, String(v.outcome || 'cut short'));
        on(th, S, 'next');
      };
      return node;
    case 'st.reveal':
      node.enter = (th, S) => {
        for (const pid of K.players(th, S)) {
          if (v.show !== false) S.reveal(th, pid);
          else if (th.seenBy) delete th.seenBy[pid];
        }
        on(th, S, 'next');
      };
      return node;

    // ---------------------------------------------------------- people
    case 'st.cast':
      node.enter = (th, S) => {
        const g = S.game;
        const town = townOfStory(th, S);
        let L = null;
        if (v.from === 'the nearest other town' && town) {
          const m = townMid(town);
          const o = g.world.ow.settlements.filter((s) => s !== town && !s.deserted && s.condition !== 'abandoned').sort((a, b) => Math.hypot(townMid(a).x - m.x, townMid(a).z - m.z) - Math.hypot(townMid(b).x - m.x, townMid(b).z - m.z));
          for (const s of o.slice(0, 4)) {
            L = layoutOf(S, s.id);
            if (L) break;
          }
        } else if (v.from === 'the town of a player in it') {
          const q = K.inIt(th, S)[0];
          const s = q ? g.world.ow.settlementAt(Math.round(q.p.x), Math.round(q.p.z)) || g.world.ow.settlementsNear(q.p.x, q.p.z)[0] : null;
          L = s ? layoutOf(S, s.id) : null;
        } else L = town ? layoutOf(S, town.id) : null;
        const role = v.role === 'fourth' ? 'fourth' : 'third';
        const sid = L ? L.settlement.id : null;
        const not = Object.values(th.cast).filter((r) => r && r.t === 'rec' && r.sid === sid).map((r) => resolve(S, r)).filter(Boolean);
        const r = L ? K.castOne(L, v.who || 'someone grown', S.rng(th, hashString(id)), not) : null;
        if (!r) return on(th, S, 'none');
        th.cast[role] = R.rec(sid, r.idx);
        th.names[role] = nameOf(S, th.cast[role]);
        if (v.line) S.note(th, w(th, S, v.line));
        on(th, S, 'next');
      };
      return node;
    case 'st.walk': {
      const role = v.who || 'giver';
      const there = (th, S) => {
        const e = roleEnt(th, S, role);
        const o = (th.vars._orders || {})[role];
        if (e) return !!(e.storyOrder && e.storyOrder.there) || (o && o.home && cheb(e, o.home) <= 2);
        // (Nobody near to see them go: there in an hour.)
        return S.now - th.nodeAt >= 60;
      };
      node.enter = (th, S) => {
        const wired = K.input(th, S, n, 'at');
        const at = wired && typeof wired.x === 'number' ? { x: Math.round(wired.x), z: Math.round(wired.z) } : placeOf(th, S, K, n, v.to || 'the town');
        if (at && th.cast[role]) order(th, S, role, { home: { x: at.x, z: at.z }, roam: 1 });
        const e = roleEnt(th, S, role);
        if (e && v.say) e.say(w(th, S, v.say), 3);
        if (!v.wait || !at) on(th, S, 'next');
      };
      if (v.wait) {
        const tick = (th, S) => {
          if (th.node === id && !th.done && there(th, S)) on(th, S, 'next');
        };
        node.live = (th, S) => {
          K.keep(th, S);
          tick(th, S);
        };
        node.hour = tick;
        node.day = tick;
        node.fade = 4;
      }
      return node;
    }
    case 'st.escort': {
      const role = v.who || 'other';
      const lost = (th, S, why = null) => {
        for (const t of S.tasksOf(th, id)) S.closeTask(t, 'void');
        order(th, S, role, null);
        on(th, S, 'lost', why);
      };
      node.enter = (th, S) => {
        if (!th.cast[role] || !isAlive(S, th.cast[role])) return lost(th, S);
        const at = placeOf(th, S, K, n, v.to || 'the town');
        const e = roleEnt(th, S, role);
        const q = nearestIn(th, S, K, e || at);
        if (!at || !q) return lost(th, S);
        const pids = K.players(th, S);
        const t = S.post(th, { role: id, kind: 'find', title: w(th, S, v.title || 'See {other} safely to {town}'), sid: th.sid, giver: null, at: { x: at.x, z: at.z }, r: Math.max(2, +v.near || 5), only: pids, board: false, npc: false, hand: 'auto', reward: {}, days: (+v.hours || 0) > 0 ? v.hours / 24 : null });
        t.pinLabel = t.title;
        S.accept?.(t, R.pl(q.pid));
        order(th, S, role, { follow: q.pid });
      };
      node.live = (th, S) => {
        K.keep(th, S);
        if (th.node !== id || th.done) return;
        if (!isAlive(S, th.cast[role])) return lost(th, S);
        // (Following whichever of them is nearest, if the one they were
        // following has gone.)
        const o = (th.vars._orders || {})[role];
        const e = roleEnt(th, S, role);
        if (o && o.follow && e && !playerOf(S.game, o.follow)) {
          const q = nearestIn(th, S, K, e);
          if (q) order(th, S, role, { follow: q.pid });
        }
      };
      node.castDown = (th, r, ev, S) => {
        if (r !== role || th.node !== id) return null;
        lost(th, S, `${th.names[role] || 'They'} did not live to get there.`);
        return true;
      };
      node.fade = 30;
      K.tasks[id] = {
        anyone: true,
        reach: (th, t, pid, S) => {
          const e = roleEnt(th, S, role);
          if (e && cheb(e, t.at) <= t.r + 1) S.complete(t, R.pl(pid));
        },
        done: (th, t, by, S) => {
          order(th, S, role, { home: { x: t.at.x, z: t.at.z }, roam: 3 });
          on(th, S, 'done');
        },
        lapsed: (th, t, S) => {
          order(th, S, role, null);
          on(th, S, 'lost', 'They never got there in time.');
        },
      };
      return node;
    }
    case 'st.turn':
      node.enter = (th, S) => {
        const role = v.who || 'giver';
        const e = roleEnt(th, S, role);
        const q = nearestIn(th, S, K, e);
        if (e && v.say) e.say(w(th, S, v.say), 3, v.how === 'turn on the players' ? '#ff9080' : undefined);
        switch (v.how) {
          case 'turn on the players':
            order(th, S, role, { foe: true });
            break;
          case 'run from the players':
            order(th, S, role, null);
            if (e && q && e.startFlee) e.startFlee(q.p, null);
            break;
          case 'stand where they are': {
            const at = e ? { x: Math.round(e.x), z: Math.round(e.z) } : whereOf(S, th.cast[role]);
            if (at) order(th, S, role, { home: { x: Math.round(at.x), z: Math.round(at.z) }, roam: 0 });
            break;
          }
          case 'follow a player in it':
            if (q) order(th, S, role, { follow: q.pid });
            break;
          default:
            order(th, S, role, null);
            if (e && e.state === 'fight') e.calmDown?.(true);
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.fate':
      node.enter = (th, S) => {
        const role = v.who || 'other';
        const P = roleRec(th, S, role);
        const g = S.game;
        if (P && P.rec.alive !== false) {
          const n0 = Math.max(1, +v.n || 5);
          switch (v.what) {
            case 'die':
            case 'are struck down': {
              th.vars._fated = role;
              if (P.ent && v.what === 'are struck down') {
                g.renderer?.emit?.(P.ent.x, P.ent.y + 1, P.ent.z, { n: 14, color: ['#a01818', '#601010'], up: 30, speed: 40, life: 0.6 });
                g.audio?.play('scream', { x: P.ent.x, y: P.ent.y, z: P.ent.z });
              }
              S.sim.recordDeath(P.L, P.rec, v.what === 'die' ? w(th, S, v.cause || 'a fever') || 'illness' : 'violence', null);
              break;
            }
            case 'are hurt':
              if (P.ent) g.damage(P.ent, n0, null);
              else P.rec.hp = Math.max(1, (P.rec.hp ?? 10) - n0);
              break;
            case 'are healed':
              if (P.ent) P.ent.hp = Math.min(P.ent.maxHp, P.ent.hp + n0);
              else if (P.rec.hp !== undefined) P.rec.hp += n0;
              break;
            case 'grow happier':
            case 'grow sadder':
              changePerson(g, personArg(P), 'mood', { value: v.what === 'grow happier' ? 15 : -15 });
              break;
            case 'come into money':
              changePerson(g, personArg(P), 'coins', { value: n0 * 10 });
              break;
            case 'lose their money':
              changePerson(g, personArg(P), 'coins', { how: 'set', value: 0 });
              break;
            default:
          }
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.person':
      node.enter = (th, S) => {
        const P = roleRec(th, S, v.who || 'giver');
        const ok = P && changePerson(S.game, personArg(P), v.what || 'mood', { how: v.how || 'add', value: w(th, S, String(v.value ?? '0')), job: v.job, text: w(th, S, v.text || '') });
        if (ok && v.what === 'first name') th.names[v.who || 'giver'] = nameOf(S, th.cast[v.who || 'giver']);
        on(th, S, ok ? 'next' : 'no');
      };
      return node;
    case 'st.learn':
      node.enter = (th, S) => {
        const g = S.game;
        const of = v.of || 'the giver';
        let val = '';
        if (ROLE[of]) {
          const P = roleRec(th, S, ROLE[of]);
          val = P ? personFact(g, personArg(P), v.pf || 'name') : '';
          if (val && typeof val === 'object' && val.t === 'town') val = val.name;
          else if (val && typeof val === 'object') val = `${val.x},${val.z}`;
        } else if (of === 'the town') {
          const t = townOfStory(th, S);
          val = t ? townFact(g, t, v.tf || 'coffers') : '';
        } else if (of === 'a player in it') {
          const q = K.inIt(th, S)[0];
          if (q) {
            const p = q.p;
            switch (v.plf || 'name') {
              case 'name': val = nameOf(S, R.pl(q.pid)); break;
              case 'health': val = Math.round(p.hp); break;
              case 'health (%)': val = Math.round((100 * Math.max(0, p.hp)) / Math.max(1, p.maxHp)); break;
              case 'coins': val = countItem(p.inv, 'coin'); break;
              case 'fame': val = S.person(q.pid).fame || 0; break;
              case 'standing in the town': {
                const t = townOfStory(th, S);
                val = t ? S.asPid(q.pid, () => townFact(g, t, 'your standing')) ?? 0 : 0;
                break;
              }
              case 'land': {
                const L = g.world.ow.landAt(p.x, p.z);
                val = L ? (LANDS.find(([, k]) => k === L.key) || [L.key])[0] : 'the sea';
                break;
              }
              case 'at sea': val = !!(p.raft || p.deck); break;
              case 'aboard a ship': val = !!p.deck; break;
              default:
            }
          }
        } else {
          switch (v.wf || 'day') {
            case 'day': val = g.day; break;
            case 'hour': val = Math.floor(g.minute / 60); break;
            case 'weather': val = (g.weather && g.weather.kind) || 'clear'; break;
            case 'the wall is down': val = !!g.world.ow.wallDown; break;
            case 'ships at sea': val = shipsOf(g).length + ((g.fleets && g.fleets.voyages) || []).filter((q) => q.ship === null || q.ship === undefined).length; break;
            case 'stories going': val = S.live().length; break;
            default:
          }
        }
        const k = String(v.name || 'found').replace(/[^\w-]/g, '');
        th.vars[k] = typeof val === 'boolean' ? (val ? 'yes' : 'no') : val;
        on(th, S, 'next');
      };
      return node;
    case 'st.ask':
      // (Waits: see talkFor and respond in storyrun.js.)
      node.fade = 30;
      return node;
    case 'st.chat': {
      const lines = () => String(v.lines || '').split('\n').map((q) => q.trim()).filter(Boolean);
      node.enter = (th, S) => {
        const g = S.game;
        const gap = Math.max(1, +v.gap || 3);
        let who = 'giver';
        let i = 0;
        for (const raw of lines()) {
          const m = /^(giver|other|third|fourth)\s*:\s*(.*)$/i.exec(raw);
          if (m) who = m[1].toLowerCase();
          const text = w(th, S, m ? m[2] : raw);
          const role = who;
          MODS.host?.later(i * gap, () => {
            const e = roleEnt(th, S, role);
            if (e && e.say) e.say(text, gap + 0.6);
          }, { game: g });
          i++;
        }
        th.vars[`_chat${id}`] = S.now;
        if (v.wait === false || !i) return on(th, S, 'next');
        const steps = th.steps;
        MODS.host?.later(i * gap + 0.5, () => {
          if (!th.done && th.node === id && th.steps === steps) on(th, S, 'next');
        }, { game: g });
      };
      // (Its words lost, the game put away and back: on, after a while.)
      node.hour = (th, S) => {
        if (th.node === id && S.now - th.nodeAt >= 60) on(th, S, 'next');
      };
      node.day = node.hour;
      node.fade = 3;
      return node;
    }

    // ---------------------------------------------------------- towns and realms
    case 'st.town':
      node.enter = (th, S) => {
        const t = townOfStory(th, S);
        if (t) changeTown(S.game, t, v.what || 'coffers', { how: v.how || 'add', value: w(th, S, String(v.value ?? '0')), law: v.law, on: v.on !== false, text: w(th, S, v.text || ''), item: K.ref(v.item), shop: v.shop });
        on(th, S, 'next');
      };
      return node;
    case 'st.realm':
      node.enter = (th, S) => {
        const g = S.game;
        const t = townOfStory(th, S);
        const civ = t && t.civ;
        const war = S.sim.war;
        const realms = S.sim.realms;
        if (!civ || !war || !realms) return on(th, S, 'no');
        const m = townMid(t);
        const byDist = g.world.ow.settlements.filter((s) => s.civ && s.civ !== civ && !s.deserted).sort((a, b) => Math.hypot(townMid(a).x - m.x, townMid(a).z - m.z) - Math.hypot(townMid(b).x - m.x, townMid(b).z - m.z));
        let other = null;
        if (v.with === 'a realm on another land') other = byDist.find((s) => s.island !== t.island)?.civ || null;
        else if (v.with === 'a realm it is at war with') {
          const wr = war.warOf(civ);
          if (wr) {
            const side = war.sideOf(wr, civ);
            other = war.civ(wr.lead[side === 'a' ? 'b' : 'a']);
          }
        } else if (v.with === 'the realm of a player in it') other = war.playerCiv ? war.playerCiv() : null;
        else other = byDist[0]?.civ || null;
        if (!other || other === civ) return on(th, S, 'no');
        const r0 = S.rng(th, hashString(id));
        switch (v.what) {
          case 'go to war':
            if (war.enemies(civ, other) || war.atWar(civ) || war.atWar(other)) return on(th, S, 'no');
            war.declare(civ, other, { k: 'story', text: w(th, S, v.why || 'an old grievance') }, g.day, r0);
            break;
          case 'make peace': {
            const wr = war.warOf(civ);
            if (!wr || !war.enemies(civ, other)) return on(th, S, 'no');
            war.peace(wr, g.day, r0, null, false);
            break;
          }
          default:
            realms.shift(civ, other, (v.what === 'grow warmer' ? 1 : -1) * Math.max(1, +v.n || 20), g.day);
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.move':
      node.enter = (th, S) => {
        const g = S.game;
        const ow = g.world.ow;
        const t = townOfStory(th, S);
        const m = t ? townMid(t) : g.player ? { x: g.player.x, z: g.player.z } : { x: 0, z: 0 };
        const lived = ow.settlements.filter((s) => s !== t && !s.deserted && s.condition !== 'abandoned');
        const near = (list) => list.sort((a, b) => Math.hypot(townMid(a).x - m.x, townMid(a).z - m.z) - Math.hypot(townMid(b).x - m.x, townMid(b).z - m.z))[0] || null;
        let to = null;
        if (v.to === 'a town on a land') to = near(lived.filter((s) => s.island === landKey(v.land)));
        else if (v.to === 'its realm\'s capital') to = t && t.civ && S.sim.realms?.capitalOf ? S.sim.realms.capitalOf(t.civ) : null;
        else if (v.to === 'the town of the other') to = th.cast.other && th.cast.other.sid !== undefined ? ow.settlements[th.cast.other.sid] : null;
        else if (v.to === 'the town of a player in it') {
          const q = K.inIt(th, S)[0];
          to = q ? ow.settlementAt(Math.round(q.p.x), Math.round(q.p.z)) || near(ow.settlementsNear(q.p.x, q.p.z).filter((s) => !s.deserted)) : null;
        } else to = near(lived);
        if (!to || to === t || !layoutOf(S, to.id)) return on(th, S, 'no');
        th.sid = to.id;
        th.cast.town = R.town(to.id);
        th.names.town = to.name;
        on(th, S, 'next', v.line ? w(th, S, v.line) : null);
      };
      return node;
    case 'st.newcomer':
      node.enter = (th, S) => {
        const t = townOfStory(th, S);
        const rec = t ? newcomerIn(S.game, t, { job: v.job && v.job !== 'any' ? v.job : undefined, first: v.first ? w(th, S, v.first) : undefined }) : null;
        if (!rec) return on(th, S, 'no');
        if (v.role === 'third' || v.role === 'fourth') {
          th.cast[v.role] = R.rec(t.id, rec.idx);
          th.names[v.role] = nameOf(S, th.cast[v.role]);
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.dungeon':
      node.enter = (th, S) => {
        const g = S.game;
        const t = townOfStory(th, S);
        const m = t ? townMid(t) : g.player ? { x: g.player.x, z: g.player.z } : null;
        if (!m) return on(th, S, 'none');
        let best = null;
        let bd = Math.max(50, +v.far || 600);
        for (const s of g.world.ow.sites || []) {
          if (v.kind && v.kind !== 'any' && s.type !== v.kind) continue;
          const x = (s.cx + 0.5) * REGION_W;
          const z = (s.cz + 0.5) * REGION_D;
          const d = Math.hypot(x - m.x, z - m.z);
          if (d < bd) {
            bd = d;
            best = { x: Math.round(x), z: Math.round(z), type: s.type };
          }
        }
        if (!best) return on(th, S, 'none');
        th.vars._place = { x: best.x, z: best.z };
        th.spots.push({ x: best.x, z: best.z });
        if (v.label) g.world.ow.pin(best.x, best.z, w(th, S, v.label), '!');
        on(th, S, 'next');
      };
      return node;
    case 'st.weather':
      node.enter = (th, S) => {
        SVC.weather?.(K.ctx(th, S), v.kind || 'rain', Math.max(1, +v.hours || 6) * 60);
        on(th, S, 'next');
      };
      return node;
    case 'st.pin':
      node.enter = (th, S) => {
        const wired = K.input(th, S, n, 'at');
        const at = wired && typeof wired.x === 'number' ? wired : placeOf(th, S, K, n, v.at || 'the story\'s place');
        if (at) S.game.world.ow.pin(Math.round(at.x), Math.round(at.z), w(th, S, v.label || 'Here'), v.glyph || 'X');
        on(th, S, 'next');
      };
      return node;

    // ---------------------------------------------------------- the players
    case 'st.coins':
      node.enter = (th, S) => {
        const k = Math.max(1, Math.round(+v.n || 1));
        if (v.how === 'asked for') {
          const q = K.inIt(th, S).find(({ p }) => countItem(p.inv, 'coin') >= k);
          if (!q) return on(th, S, 'no');
          removeItem(q.p.inv, 'coin', k);
          S.game.audio?.play('coin');
          if (v.text) S.tell(q.pid, w(th, S, v.text), '#ffe070');
          return on(th, S, 'next');
        }
        for (const pid of K.players(th, S)) {
          S.give(pid, 'coin', k);
          if (v.text) S.tell(pid, w(th, S, v.text), '#ffe070');
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.harm':
      node.enter = (th, S) => {
        const x = K.ctx(th, S);
        const k = Math.max(1, +v.n || 1);
        for (const { p, pid } of K.inIt(th, S)) {
          if (v.what === 'hurt') S.game.damage(p, Math.round(k), null);
          else if (v.what === 'given a condition') SVC.status?.(x, p, v.status || 'regen', Math.max(1, +v.secs || 10));
          else SVC.heal?.(x, p, k);
          if (v.text) S.tell(pid, w(th, S, v.text), v.what === 'hurt' ? '#ff9080' : '#a0e080');
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.send':
      node.enter = (th, S) => {
        const g = S.game;
        const wired = K.input(th, S, n, 'at');
        const at = wired && typeof wired.x === 'number' ? { x: Math.round(wired.x), y: Math.round(wired.y ?? 6), z: Math.round(wired.z) } : placeOf(th, S, K, n, v.to || 'the town');
        const lines = String(v.lines || '').split('\n').map((q) => w(th, S, q.trim())).filter(Boolean);
        if (at) {
          g.loadAround?.(at.x, at.z, true);
          const y = g.world.findStandY(at.x, at.z);
          const to = { x: at.x, y: y > 0 ? y : at.y, z: at.z };
          const x = K.ctx(th, S);
          for (const { p } of K.inIt(th, S)) {
            SVC.teleport?.(x, p, to);
            if (lines.length) g.asPlayer(p, () => g.ui.showBlackout?.(lines, 2 + lines.length * 1.5));
          }
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.fame':
      node.enter = (th, S) => {
        for (const pid of K.players(th, S)) {
          const k = S.person(pid);
          k.fame = Math.max(0, (k.fame || 0) + Math.round(+v.n || 0));
          if (v.text) S.tell(pid, w(th, S, v.text), (+v.n || 0) >= 0 ? '#a0e0ff' : '#ff9080');
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.scene':
      node.enter = (th, S) => {
        const g = S.game;
        const x = K.ctx(th, S);
        const wired = K.input(th, S, n, 'at');
        const at = wired && typeof wired.x === 'number' ? { x: Math.round(wired.x), y: Math.round(wired.y ?? 6), z: Math.round(wired.z) } : placeOf(th, S, K, n, v.at || 'the giver');
        const players = K.inIt(th, S);
        if (+v.shake > 0) for (const { p } of players) g.asPlayer(p, () => (g.shake = Math.min(1.4, (g.shake || 0) + +v.shake)));
        if (+v.flashT > 0) g.renderer?.flashScreen?.(v.flash || '#ffffff', +v.flashT);
        if (v.sound && v.sound !== '(none)') g.audio?.play(K.ref(v.sound), at || null);
        if (v.music === 'stop') for (const { p } of players) SVC.music?.(x, p, null, 0);
        else if (v.music === 'song' && v.song) for (const { p } of players) SVC.music?.(x, p, `song:m:${K.mod.id}:${v.song}`, Math.max(0, +v.musicT || 0));
        else if (v.music) for (const { p } of players) SVC.music?.(x, p, v.music, Math.max(0, +v.musicT || 0));
        if (at && v.sparks && v.sparks !== '#000000') g.renderer?.emit?.(at.x, at.y + 1, at.z, { n: 24, color: [v.sparks, '#ffffff'], up: 40, speed: 45, life: 0.9, glow: true, shape: 'star' });
        if (at && v.vfx) MODS.playVfx?.(g, K.mod, v.vfx, at, {});
        on(th, S, 'next');
      };
      return node;
    case 'st.card':
      node.enter = (th, S) => {
        for (const pid of K.players(th, S)) card(S, pid, w(th, S, v.title || ''), w(th, S, v.sub || ''), Math.max(1, +v.secs || 4), v.color || '#f0d890');
        on(th, S, 'next');
      };
      return node;

    // ---------------------------------------------------------- the sea
    case 'st.ship':
      node.enter = (th, S) => {
        const g = S.game;
        const type = SHIP_TYPES[v.type] ? v.type : 'brigantine';
        const T = SHIP_TYPES[type];
        const t = townOfStory(th, S);
        const q = K.inIt(th, S)[0];
        const near = v.off === 'a player in it' && q ? q.p : t ? townMid(t) : q ? q.p : null;
        if (!near) return on(th, S, 'no');
        const foe = v.side === 'after the players';
        const at = waterSpot(g, type, Math.round(near.x), Math.round(near.z), foe ? 40 : v.off === 'far out' ? 60 : 6);
        if (!at) return on(th, S, 'no');
        const civ = v.side === 'the town\'s, at anchor' && t && t.civ ? t.civ : null;
        const seed = (S.rng(th, hashString(id)).next() * 1e9) >>> 0;
        const sh = addShip(g, {
          type, x: at.x, z: at.z, yaw: at.yaw, name: w(th, S, v.name || `The ${T.name}`), civ: civ ? civ.id : null,
          crew: makeCrew(seed, type, (t && t.style) || 'vale', Math.max(1, +v.crew || (foe ? T.crew + 2 : T.crew)), civ ? civ.id : null),
          ammo: foe ? 999 : 40, paint: foe ? '#2a2a30' : civ ? civ.color?.hex || '#8a2a1e' : '#6a4a2a', flag: foe ? '#1a1a1a' : civ ? civ.color?.hex || '#c8a040' : '#c8a040', emblem: foe ? 'disc' : 'cross',
          anchor: v.side !== 'passing by' && !foe,
        });
        if (v.cargo && ITEMS[K.ref(v.cargo)]) sh.store.set(K.ref(v.cargo), Math.max(1, +v.cargoN || 1));
        if (foe) {
          sh.fight = { player: true };
          sh.hostile = true;
          if (q) sh.route = [{ x: q.p.x, z: q.p.z }];
        } else if (v.side === 'passing by') {
          sh.route = [{ x: at.x + Math.sin(at.yaw) * 260, z: at.z + Math.cos(at.yaw) * 260 }];
          sh.leaveT = 300;
        }
        sh.story = th.id;
        th.vars._ship = sh.id;
        th.spots.push({ x: at.x, z: at.z });
        on(th, S, 'next');
      };
      return node;
    case 'st.shipdo':
      node.enter = (th, S) => {
        const g = S.game;
        const sh = storyShip(th, S);
        if (!sh || sh.sinking > 0) return on(th, S, 'no');
        const t = townOfStory(th, S);
        const q = nearestIn(th, S, K, sh);
        switch (v.what) {
          case 'sails to the town': {
            const m = t ? townMid(t) : null;
            const at = m ? waterSpot(g, sh.type, m.x, m.z, 4) : null;
            if (!at) return on(th, S, 'no');
            sh.route = [{ x: at.x, z: at.z }];
            sh.anchor = false;
            sh.mission = { moor: true };
            sh.leaveT = 0;
            break;
          }
          case 'sails to the players':
            if (!q) return on(th, S, 'no');
            sh.route = [{ x: q.p.x, z: q.p.z }];
            sh.anchor = false;
            sh.mission = { moor: true };
            break;
          case 'turns on the players':
            sh.fight = { player: true };
            sh.hostile = true;
            sh.anchor = false;
            if (q) sh.route = [{ x: q.p.x, z: q.p.z }];
            break;
          case 'drops anchor':
            sh.anchor = true;
            sh.route = null;
            break;
          case 'weighs anchor and leaves':
            sh.anchor = false;
            sh.fight = null;
            sh.hostile = false;
            sh.route = [{ x: sh.x + Math.sin(sh.yaw) * 260, z: sh.z + Math.cos(sh.yaw) * 260 }];
            sh.leaveT = 240;
            break;
          case 'is given to a player in it':
            if (!q) return on(th, S, 'no');
            sh.owner = ownerId(g, q.p);
            sh.hostile = false;
            sh.fight = null;
            sh.civ = null;
            S.tell(q.pid, `${sh.name} is yours now: her wheel is yours to take.`, '#a0e0ff');
            break;
          case 'founders':
            sh.sinking = 0.001;
            break;
          default:
        }
        on(th, S, 'next');
      };
      return node;
    case 'st.fleet':
      node.enter = (th, S) => {
        const g = S.game;
        const t = townOfStory(th, S);
        if (!t || !t.civ) return on(th, S, 'no');
        const all = ports(g);
        const m = townMid(t);
        const dist = (s) => Math.hypot(townMid(s).x - m.x, townMid(s).z - m.z);
        const from = all.includes(t) ? t : all.filter((s) => s.civ === t.civ).sort((a, b) => dist(a) - dist(b))[0];
        if (!from) return on(th, S, 'no');
        let to = all.filter((s) => s.island !== from.island);
        if (v.to === 'a port of a realm at war with it') to = to.filter((s) => S.sim.war && S.sim.war.enemies(from.civ, s.civ));
        else if (v.to === 'a port on a land') to = all.filter((s) => s.island === landKey(v.land) && s !== from);
        to = to.sort((a, b) => dist(a) - dist(b));
        for (const dest of to.slice(0, 4)) {
          const vy = sendVoyage(g, from, dest, v.kind || 'trade', { any: !!v.any });
          if (vy) {
            th.vars._voyage = vy.id;
            return on(th, S, 'next');
          }
        }
        on(th, S, 'no');
      };
      return node;

    // ---------------------------------------------------------- values
    case 'st.calc':
      node.enter = (th, S) => {
        const a = K.input(th, S, n, 'a');
        const b = K.input(th, S, n, 'b');
        const na = +a || 0;
        const nb = +b || 0;
        let r;
        switch (v.op || 'this + that') {
          case 'this - that': r = na - nb; break;
          case 'this × that': r = na * nb; break;
          case 'this ÷ that': r = nb ? na / nb : 0; break;
          case 'the least': r = Math.min(na, nb); break;
          case 'the most': r = Math.max(na, nb); break;
          case 'what\'s left over': r = nb ? ((na % nb) + nb) % nb : 0; break;
          case 'a random number between': {
            const lo = Math.min(na, nb);
            const hi = Math.max(na, nb);
            r = Math.floor(lo + S.rng(th, hashString(`${id}:${S.now}`)).next() * (Math.floor(hi) - Math.ceil(lo) + 1));
            break;
          }
          case 'this to the power': r = na ** nb; break;
          case 'joined as words': r = `${a ?? ''}${b ?? ''}`; break;
          case 'rounded': r = Math.round(na); break;
          default: r = na + nb;
        }
        if (typeof r === 'number') r = Number.isFinite(r) ? Math.round(r * 1000) / 1000 : 0;
        th.vars[String(v.name || 'value').replace(/[^\w-]/g, '')] = r;
        on(th, S, 'next');
      };
      return node;
    case 'st.keep':
      node.enter = (th, S) => {
        const raw = K.input(th, S, n, 'value');
        const k = String(v.name || 'value').replace(/[^\w.-]/g, '');
        const put = (get, set) => {
          const cur = get();
          if (v.op === 'words') set(String(raw ?? ''));
          else if (v.op === 'add') set((+cur || 0) + (+raw || 0));
          else if (v.op === 'take away') set((+cur || 0) - (+raw || 0));
          else set(typeof raw === 'number' || (raw !== '' && !Number.isNaN(+raw)) ? +raw : raw);
        };
        if (v.scope === 'each player in it') {
          for (const { p } of K.inIt(th, S)) put(() => K.valueOf(th, S, 'player', k, p), (x) => K.setValue(th, S, 'player', k, x, p));
        } else put(() => K.valueOf(th, S, 'world', k), (x) => K.setValue(th, S, 'world', k, x));
        on(th, S, 'next');
      };
      return node;
    case 'st.who':
    case 'st.value':
      // (Values only: see the evals below.)
      return {};
    default:
      return null;
  }
}

// ------------------------------------------------------------ the story's own values, for any node
// (Their `eval`s: what the story's people and places are, as the graph
// runner hands them about; a story's flows have `x.story` in them.)
NODES['st.who'].eval = (x, n, port) => {
  const st = x.story;
  if (!st) return null;
  const { th, S, K } = st;
  switch (port) {
    case 'giver': case 'other': case 'third': case 'fourth': return roleEnt(th, S, port);
    case 'player': return K.inIt(th, S)[0]?.p || null;
    case 'town': {
      const t = townOfStory(th, S);
      return t ? townValue(S.game, t) : null;
    }
    case 'task': return placeOf(th, S, K, n, 'where its task is');
    case 'place': return placeOf(th, S, K, n, 'the story\'s place');
    case 'ship': {
      const sh = storyShip(th, S);
      return sh ? { x: Math.round(sh.x), y: 6, z: Math.round(sh.z) } : null;
    }
    case 'title': return th.title;
    case 'days': return Math.floor((S.now - (th.born ?? S.now)) / DAY_MIN);
    default: return null;
  }
};
NODES['st.value'].eval = (x, n) => {
  const st = x.story;
  const k = String((n.p || {}).name || '').replace(/^\{|\}$/g, '');
  return st ? st.th.vars[k] : x.vars ? x.vars[k] : undefined;
};

// The words of A word, with conditions: its answers (what each asks, and
// whether the one talking has it).
export function askChoices(th, S, K, n, pid) {
  const v = n.p || {};
  const p = playerOf(S.game, pid) || S.game.player;
  const out = [];
  for (const k of ['a', 'b', 'c', 'd', 'e']) {
    const label = v[k] ? K.words(th, S, v[k], n) : '';
    if (!label) continue;
    const need = v[`${k}need`] || 'nothing';
    const cnt = Math.max(1, +v[`${k}n`] || 1);
    let ok = true;
    let what = '';
    if (need === 'an item') {
      const it = K.ref(v[`${k}item`]);
      ok = !!(p && it && countItem(p.inv, it) >= cnt);
      what = `${cnt} ${it && ITEMS[it] ? ITEMS[it].name.toLowerCase() : 'of it'}`;
    } else if (need === 'coins') {
      ok = !!(p && countItem(p.inv, 'coin') >= cnt);
      what = `${cnt} coin${cnt === 1 ? '' : 's'}`;
    } else if (need === 'a value at least') {
      ok = (+th.vars[String(v[`${k}val`] || '').replace(/[^\w-]/g, '')] || 0) >= cnt;
      what = `${v[`${k}val`]} ${cnt}`;
    }
    if (!ok && v.hide) continue;
    out.push({ k, label: ok || need === 'nothing' ? label : `${label} [needs ${what}]`, ok, need, cnt });
  }
  return out;
}
// The answer given: what it asks taken (true), or not had (false).
export function askPay(th, S, K, n, k, pid) {
  const v = n.p || {};
  const c = askChoices(th, S, K, n, pid).find((q) => q.k === k);
  if (!c) return true;
  if (!c.ok) return false;
  const p = playerOf(S.game, pid) || S.game.player;
  if (c.need === 'an item') removeItem(p.inv, K.ref(v[`${k}item`]), c.cnt);
  else if (c.need === 'coins') {
    removeItem(p.inv, 'coin', c.cnt);
    S.game.audio?.play('coin');
  }
  return true;
}

export { LAND_OF };
