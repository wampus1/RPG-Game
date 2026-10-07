// Taken alive (round 52). Killers sent with orders to bring someone back
// alive, an ambush at a meeting that was never a meeting, a stronghold's
// outlaws who take prisoners now: when you fall to them you don't die,
// you wake in a cage of iron bars at their camp.
//
// They take your weapons and armour, your coin and gold, your relics, your
// Kavorent things and any cores you carried: it all goes in the strongbox
// by their fire (and what's good, they use: see 'windfall' in bandits.js).
// A jailer sits by the door. Then it depends what they want with you:
//   - a ransom: word goes to the town you're a citizen of (and to anyone
//     else playing); pay it (to the jailer, at the camp) and you walk out
//     with your things;
//   - to recruit you: their chief comes to the cage with an offer;
//   - to make an example of you: at the end of it they throw you out in
//     the wilds with nothing.
// Or you get yourself out: a lockpick in your boot (they didn't find it),
// or dig, or break the bars. Or someone gets you out: anyone playing, the
// watch of your town, an adventurer (they hear of it); kill the jailer for
// the key, or wipe the band out and the door hangs open.
//
// Townsfolk are taken too (a merchant off the road, a guard who went after
// them): their town wants them back, and it's the same cage.
//
// And afterwards: your things are still in their strongbox (until someone
// opens it: maybe you).
import { motif, HOOKS, R, refKey, nameOf, NameOf, resolve, pidOf, playerOf, poss } from '../core.js';
import { pick, layoutOf, town, townName, townMid, directions, fullName, odds, homeOf, renownIn, spotNear, hours } from './lib.js';
import { cage, stash, stashOf, stashAt, setDoor, inCage, cageAt } from './camp.js';
import { fromBandit, makePerson } from '../actors.js';
import { ITEMS } from '../../../world/items.js';
import { mayorOf, DAY, alive } from '../../econ.js';
import { countItem, removeItem } from '../../../game/inventory.js';
import { LockWindow } from '../../../ui/lockpick.js';
import { hash4 } from '../../../util/rng.js';
import { B } from '../../../world/blocks.js';


// What captors take off you.
export function seizable(k) {
  const d = ITEMS[k];
  if (!d) return false;
  if (k === 'coin' || /^kav_/.test(k) || /^gold_(ingot|ore|nugget)/.test(k) || k === 'gem' || k === 'holy_relic') return true;
  if (k === 'arrow' || k === 'bolt') return true;
  return ['weapon', 'armor', 'relic', 'gadget', 'enhancer'].includes(d.kind) || !!d.kav;
}

// Everything they take, out of a player's pack and off their back.
export function seize(p) {
  const taken = [];
  for (let i = 0; i < p.inv.length; i++) {
    const s = p.inv[i];
    if (!s || !seizable(s.item)) continue;
    taken.push({ item: s.item, count: s.count });
    p.inv[i] = null;
  }
  for (const slot of Object.keys(p.equip || {})) {
    const k = p.equip[slot];
    if (!k || !seizable(k)) continue;
    taken.push({ item: k, count: 1, slot });
    p.equip[slot] = null;
  }
  p.recalcMaxHp?.();
  p.hp = Math.min(p.hp, p.maxHp);
  return taken;
}

function bandOf(S, th) {
  return resolve(S, th.cast.band);
}

function heldTh(S, pid) {
  return S.live().find((t) => t.m === 'captive' && t.cast.captive.t === 'pl' && t.cast.captive.pid === pid) || null;
}

function listTaken(items) {
  if (!items.length) return 'nothing';
  const coins = items.filter((it) => it.item === 'coin').reduce((n, it) => n + it.count, 0);
  const rest = [...new Set(items.filter((it) => it.item !== 'coin').map((it) => (ITEMS[it.item] ? ITEMS[it.item].name.toLowerCase() : it.item)))];
  const out = rest.slice(0, 4);
  if (rest.length > 4) out.push(`${rest.length - 4} more`);
  if (coins) out.push(`¤${coins}`);
  return out.join(', ').replace(/, ([^,]*)$/, ' and $1');
}

// ------------------------------------------------------------ hooks
// About to fall to someone sent to take you alive: taken, not killed.
HOOKS.subdue.push((S, p, source) => {
  if (!source || !p || p.sagaHeld || p.dead) return false;
  const g = S.game;
  if (g.dungeon && g.world.inInstance && g.world.inInstance(p.x)) return false;
  if (g.duel) return false;
  const pid = pidOf(p);
  if (heldTh(S, pid)) return false;
  let band = null;
  let from = null;
  const wb = source.warband;
  if (wb && wb.kind === 'saga' && wb.capture && wb.band !== undefined) {
    band = wb.band;
    from = wb.th;
  } else if (wb && wb.kind === 'bandit') {
    const b = S.sim.bandits.get(wb.band);
    // (A band dug in behind a wall takes those it knows of alive.)
    if (b && (b.outpost || 0) >= 2 && S.person(pid).under >= 6 && Math.random() < 0.5) band = b.id;
  } else if (source.kind === 'player') {
    // (A contract to take them alive: see players.js.)
    const c = S.captureFor && S.captureFor(source, p);
    if (c) {
      band = c.band;
      from = c.th;
    }
  }
  if (band === null || band === undefined) return false;
  const b = S.sim.bandits.get(band);
  if (!b || !b.camp) return false;
  p.hp = 1;
  const th = S.begin('captive', { cast: { captive: R.pl(pid), band: R.band(b.id) }, vars: { from, by: source.kind === 'player' ? pidOf(source) : null }, parent: from, touched: [pid], sid: b.near });
  if (!th) return false;
  S.emit('captured', { pid, band: b.id, th: th.id, by: source.kind === 'player' ? R.pl(pidOf(source)) : null });
  return true;
});

// The cage door: locked to the one inside (but for a lockpick in their
// boot), and to anyone outside while it's watched (but for the key).
HOOKS.door.push((S, x, y, z) => {
  const b = cageAt(S, x, z);
  if (!b) return false;
  const g = S.game;
  const p = g.player;
  const pid = pidOf(p);
  const th = S.live().find((t) => t.m === 'captive' && t.cast.band.id === b.id && t.node === 'held');
  const W = g.world;
  const open = W.getBlock(x, y, z) === B.cell_door_open;
  if (!th) {
    // (Nobody in it: just a door.)
    setDoor(S, b, !open);
    g.audio?.play('door');
    return true;
  }
  const me = th.cast.captive.t === 'pl' && th.cast.captive.pid === pid;
  const pick2 = (onOpen) => {
    if (countItem(p.inv, 'lockpick') <= 0) return false;
    g.ui.open(new LockWindow(g.ui, g, { tier: 2, seed: hash4(x, y, z, 0xca9e), label: 'The cage door', watched: () => false, onOpen }));
    return true;
  };
  if (me) {
    if (!pick2(() => {
      setDoor(S, b, true);
      g.ui.msg('The lock gives. The door swings open...', '#a0e0a0');
      th.vars.picked = true;
    })) g.ui.msg('The door\'s locked fast. (A lockpick might do it, if you had one.)', '#c8c8c8', true);
    return true;
  }
  const watch = guardsNear(S, b, th, 7);
  const free = () => {
    setDoor(S, b, true);
    S.go(th, 'freed', `${nameOf(S, R.pl(pid))} opened the cage.`, { by: R.pl(pid) });
  };
  if (countItem(p.inv, 'cage_key') > 0) {
    removeItem(p.inv, 'cage_key', 1);
    g.ui.msg('The key turns. The door swings open.', '#a0e0a0');
    free();
    return true;
  }
  if (watch.length) {
    g.ui.msg('Not with them watching. (Deal with the guards first, or get the key off the jailer.)', '#ffb080', true);
    return true;
  }
  if (!pick2(free)) g.ui.msg('Locked. The jailer had the key... or one of them does.', '#c8c8c8', true);
  return true;
});

// The strongbox by the fire: whoever opens it (unwatched) takes the lot.
HOOKS.chest.push((S, x, y, z) => {
  const b = stashAt(S, x, z);
  if (!b) return false;
  const g = S.game;
  const p = g.player;
  const pid = pidOf(p);
  const th = S.live().find((t) => t.m === 'captive' && t.cast.band.id === b.id && t.node === 'held');
  if (th && th.cast.captive.t === 'pl' && th.cast.captive.pid === pid) return true;
  if (guardsNear(S, b, th, 6).length) {
    g.ui.msg('Not with them watching.', '#ffb080', true);
    return true;
  }
  const items = stashOf(b);
  if (!items.length) {
    g.ui.msg('The strongbox is empty.', '#c8c8c8');
    return true;
  }
  b.stash = [];
  const owners = new Set();
  for (const it of items) {
    const left = p.give(it.item, it.count);
    if (left) g.spawnDrop(it.item, left, p.x, p.y, p.z, true);
    if (it.owner) owners.add(it.owner);
  }
  g.audio?.play('chest');
  g.ui.msg(`You empty the outlaws' strongbox: ${listTaken(items)}.`, '#ffe070');
  for (const o of owners) {
    if (o === pid) continue;
    S.tell(o, `${nameOf(S, R.pl(pid))} has emptied the strongbox at ${poss(b.name)} camp, and your things with it.`, '#ffb080');
    S.emit('gear_taken', { owner: o, by: R.pl(pid), band: b.id });
  }
  S.emit('stash_opened', { band: b.id, by: R.pl(pid), owners: [...owners] });
  return true;
});

// Back in the world after being away: put where their story left them.
HOOKS.rejoin.push((S, pid, p) => {
  const k = S.person(pid);
  const th = heldTh(S, pid);
  if (th) {
    const b = bandOf(S, th);
    const cg = b && b.camp && b.camp.cage;
    if (cg) {
      S.asPid(pid, () => S.game.teleportPlayer(cg.cell.x, cg.cell.y, cg.cell.z));
      p.sagaHeld = { th: th.id };
      S.asPid(pid, () => S.game.ui.msg(`You're still in ${poss(b.name)} cage, where they left you. (See your quest log: O)`, '#ffb080'));
    }
    return;
  }
  p.sagaHeld = null;
  if (k.releaseTo) {
    const at = k.releaseTo;
    k.releaseTo = null;
    S.asPid(pid, () => S.game.teleportPlayer(at.x, at.y ?? 6, at.z));
  }
});

// Those of the band standing about the cage.
function guardsNear(S, b, th, r) {
  const out = [];
  const c = b.camp && b.camp.cage;
  if (!c) return out;
  for (const [k, n] of S.sim.bandits.ents) {
    if (!k.startsWith(`${b.id}:`) || !n || n.dead || n.down || (n.warband && n.warband.phase === 'flee')) continue;
    if (Math.max(Math.abs(n.x - c.door.x), Math.abs(n.z - c.door.z)) <= r) out.push(n);
  }
  if (th) {
    const j = S.actorEnt(th, 'jailer');
    if (j && Math.max(Math.abs(j.x - c.door.x), Math.abs(j.z - c.door.z)) <= r) out.push(j);
  }
  return out;
}

const JAILER_LINES = ['Comfortable?', 'Don\'t try anything.', 'Chief\'ll be along.', 'Nobody\'s coming for you.', 'Quiet in there.'];

// ------------------------------------------------------------ the story
motif({
  id: 'captive',
  family: 'bandits',
  max: 12,
  key: (o) => refKey(o.cast.captive),
  title: (th, S) => `${NameOf(S, th.cast.captive)} in ${poss(nameOf(S, th.cast.band))} Cage`,
  seeds: [
    // A merchant set on on the road is sometimes taken, not just robbed.
    { on: 'robbery', make: (ev, S) => {
      const b = S.sim.bandits.get(ev.band);
      if (!b || !b.camp || !ev.victim || Math.random() > 0.18) return null;
      return { cast: { captive: ev.victim, band: R.band(b.id) }, sid: ev.sid, vars: { how: 'road' } };
    } },
  ],
  anchors: (th, S) => {
    const b = bandOf(S, th);
    return b && b.camp ? [{ x: b.camp.x, z: b.camp.z }] : [];
  },
  nodes: {
    held: {
      enter(th, S) {
        const b = bandOf(S, th);
        if (!b || !b.camp) return S.end(th, 'faded');
        const rng = S.rng(th, 0xca9);
        b.holding = true;
        // (What they mean to do with you: as the chief is, and the band.)
        const CP = (b.members[0] && b.members[0].personality) || {};
        th.vars.plan ||= S.choose(th, [
          { to: 'ransom', w: 2 + ((b.loot || 0) < 50 ? 1 : 0) },
          { to: 'recruit', w: () => (th.cast.captive.t === 'pl' ? 1 + Math.min(2, S.person(th.cast.captive.pid).under / 8) : 0) },
          { to: 'example', w: 0.6 + (CP.temper ?? 0.5) },
        ], rng).to;
        th.vars.until = S.now + hours(rng.int(30, 54));
        th.vars.demand = demandFor(S, th);
        const cg = cage(S, b);
        if (th.cast.captive.t === 'pl') holdPlayer(th, S, b, cg);
        else holdNpc(th, S, b, cg);
        // The jailer, sat by the door (one of them, away from the fire).
        const m = b.members.find((q) => !q.out && q !== b.members[0]) || null;
        if (m) {
          m.out = true;
          th.vars.jailerM = m.id;
        }
        S.actor(th, {
          key: 'jailer', kind: 'npc', role: 'jailer', talk: true, at: { x: cg.door.x + 1, z: cg.door.z },
          person: m ? fromBandit(m, b) : makePerson(rng, town(S, b.near)?.style, 'outlaw'),
          orders: { home: { x: cg.door.x + 1, z: cg.door.z }, outlaw: true, lines: JAILER_LINES, markFor: th.cast.captive.t === 'pl' ? th.cast.captive.pid : null, mark: th.cast.captive.t === 'pl' ? 'talk' : null },
        });
        postTasks(th, S, b);
      },
      live(th, S) {
        const b = bandOf(S, th);
        if (!b) return S.go(th, 'freed', null, { by: null });
        const c = th.cast.captive;
        if (c.t !== 'pl') return;
        const p = playerOf(S.game, c.pid);
        if (!p) return;
        p.sagaHeld = { th: th.id };
        // Out of the cage, not let out: escaped.
        if (!inCage(b, p.x, p.z) && !p.moving) {
          th.vars.outT = (th.vars.outT || 0) + 0.5;
          if (th.vars.outT >= 1) S.go(th, 'escaped', null);
        } else th.vars.outT = 0;
        // The chief comes to the cage with what they want of you.
        if (!th.vars.visited && S.now - th.nodeAt > hours(3)) {
          th.vars.visited = true;
          const cg = b.camp && b.camp.cage;
          const chief = b.members[0];
          if (cg && chief) {
            chief.out = true;
            th.vars.chiefM = chief.id;
            S.actor(th, {
              key: 'chief', kind: 'npc', role: 'chief', talk: true, at: { x: cg.door.x + 1, z: cg.door.z + 1 },
              person: fromBandit(chief, b), orders: { home: { x: cg.door.x + 1, z: cg.door.z + 1 }, outlaw: true, markFor: c.pid, mark: 'talk' },
            });
            S.tell(c.pid, `${chief.name.first} ${chief.name.last}, chief of ${b.name}, has come to the cage. They want a word.`, '#ffd890');
          }
        }
      },
      hour(th, S) {
        const c = th.cast.captive;
        if (S.now >= th.vars.until) {
          if (th.vars.plan === 'recruit' && c.t === 'pl' && !th.vars.refused) th.vars.plan = 'example';
          S.go(th, 'cast_out');
        }
      },
      day(th, S, rng) {
        const b = bandOf(S, th);
        if (!b) return S.go(th, 'freed', null, { by: null });
        if (S.now >= th.vars.until) return S.go(th, 'cast_out');
        // (Round 54) Not every outlaw has the stomach for it: a soft heart
        // among them may slip the bolt in the night.
        if (!th.vars.mercyTried) {
          const soft = b.members.find((q) => q !== b.members[0] && (q.personality?.kindness ?? 0) > 0.65);
          if (soft && rng.chance(0.12)) {
            th.vars.mercyTried = true;
            return S.go(th, 'freed', `${soft.name.first}, one of ${b.name}, slipped the bolt of the cage in the night and whispered "Go. Now. Don't look back."`, { by: null });
          }
        }
        // Their town pays (if it will, and can).
        const c = th.cast.captive;
        if (th.vars.plan === 'ransom') {
          const home = c.t === 'pl' ? homeOf(S, c.pid) : c.sid;
          const L = layoutOf(S, home);
          const willing = c.t === 'pl' ? (renownIn(S, c.pid, home) >= 10 ? 0.45 : home !== null ? 0.2 : 0) : 0.35;
          if (L && L.econ && L.econ.treasury >= th.vars.demand && rng.chance(willing)) {
            L.econ.treasury -= th.vars.demand;
            b.loot += th.vars.demand;
            S.go(th, 'ransomed', `The council of ${L.settlement.name} paid ¤${th.vars.demand} for ${nameOf(S, c)}.`, { news: [home], by: R.town(home) });
          }
        }
      },
      on: {
        band_gone(th, ev, S) {
          if (ev.band !== th.cast.band.id) return;
          S.go(th, 'freed', `With ${ev.name} gone, there's nobody left to hold the cage.`, { by: ev.by });
        },
      },
      exit(th, S) {
        const b = bandOf(S, th);
        if (b) b.holding = false;
      },
    },
    freed: {
      enter(th, S, o) {
        const by = o && o.by;
        release(th, S, 'freed');
        const c = th.cast.captive;
        if (!th.hist.some((h) => /opened the cage|nobody left/.test(h.text))) S.note(th, `${NameOf(S, c)} was freed${by ? ` by ${nameOf(S, by)}` : ''}.`);
        const t = S.tasksOf(th, 'rescue')[0];
        if (t && by && c.t === 'pl') S.complete(t, by);
        if (by && by.t === 'pl' && c.t === 'pl' && by.pid !== c.pid) {
          S.person(by.pid).fame += 2;
          S.tell(c.pid, `${nameOf(S, by)} got you out!`, '#a0e0a0');
          // (The band won't forget who took their prize.)
          S.emit('rescued', { band: th.cast.band.id, by, captive: c });
        }
        if (c.t !== 'pl') freeNpc(th, S, by);
        else S.end(th, 'freed');
      },
      // (A townsperson let out follows whoever let them out home: once
      // they're back among their own people, they know the way from there,
      // say so, and go on alone, to whoever's waiting for them. Round 56.)
      live(th, S) {
        const c = th.cast.captive;
        if (c.t === 'pl') return;
        const e = S.actorEnt(th, 'captive');
        // (Killed on the way: see castDown.)
        if (S.actorSpec(th, 'captive')?.dead || !alive(resolve(S, c))) return;
        if (th.vars.parted) {
          if (!e) {
            homeNpc(th, S);
            S.end(th, 'home', `${NameOf(S, c)} is home again.`, { news: [c.sid] });
          }
          return;
        }
        if (e && th.vars.leader && amongOwn(S, c.sid, e)) partWays(th, S, e);
      },
      day(th, S) {
        // (Nobody led them: they find their own way home.)
        if (th.cast.captive.t !== 'pl' && S.now - th.nodeAt > DAY && alive(resolve(S, th.cast.captive)) && !S.actorSpec(th, 'captive')?.dead) {
          homeNpc(th, S);
          S.end(th, 'home', `${NameOf(S, th.cast.captive)} found their way home.`);
        }
      },
    },
    escaped: {
      enter(th, S) {
        const c = th.cast.captive;
        const b = bandOf(S, th);
        release(th, S, 'escaped');
        S.note(th, `${NameOf(S, c)} broke out of ${b ? b.name : 'the outlaws'}'s cage and got away.`, { news: b ? [b.near] : [] });
        if (c.t === 'pl') {
          S.person(c.pid).under += 3;
          S.tell(c.pid, 'You\'re out! Run, before they see!', '#a0e0a0');
          S.emit('escaped', { pid: c.pid, band: th.cast.band.id });
        }
        S.end(th, 'escaped');
      },
    },
    ransomed: {
      enter(th, S, o) {
        const c = th.cast.captive;
        const b = bandOf(S, th);
        // (Paid for: they hand back what they took, coin aside.)
        if (c.t === 'pl' && b) returnGear(S, b, c.pid, true);
        // (Safe passage out of the camp, for them and whoever paid.)
        if (b) {
          for (const pid of [c.t === 'pl' ? c.pid : null, o && o.by && o.by.t === 'pl' ? o.by.pid : null]) {
            if (!pid) continue;
            const k = S.person(pid);
            (k.truce ||= {})[b.id] = Math.max(k.truce[b.id] || 0, S.now + 180);
          }
        }
        release(th, S, 'ransomed');
        if (!th.hist.some((h) => /paid/.test(h.text))) S.note(th, `${NameOf(S, c)} was ransomed${o && o.by ? ` by ${nameOf(S, o.by)}` : ''}.`);
        if (c.t === 'pl') S.tell(c.pid, 'The ransom\'s paid. They let you go, and hand back your things (not the coin).', '#a0e0a0');
        if (c.t !== 'pl') homeNpc(th, S);
        S.end(th, 'ransomed');
      },
    },
    joined: {
      enter(th, S) {
        const c = th.cast.captive;
        const b = bandOf(S, th);
        if (b && c.t === 'pl') {
          returnGear(S, b, c.pid, false);
          const k = S.person(c.pid);
          k.joined = b.id;
          k.under += 4;
          S.give(c.pid, 'outlaw_token', 1);
          S.spawn(th, 'outlaw_work', { cast: { band: R.band(b.id), member: R.pl(c.pid) }, sid: b.near, touched: [c.pid] });
        }
        release(th, S, 'joined');
        S.note(th, `${NameOf(S, c)} swore to ride with ${b ? b.name : 'the outlaws'}, and walked out of the cage one of them.`, { news: b ? [b.near] : [] });
        S.end(th, 'joined');
      },
    },
    cast_out: {
      enter(th, S) {
        const c = th.cast.captive;
        const b = bandOf(S, th);
        const rng = S.rng(th, 0xc0);
        if (c.t === 'pl') {
          const k = S.person(c.pid);
          const m = b && b.camp ? { x: b.camp.x, z: b.camp.z } : k.last;
          const at = m ? spotNear(S, m.x, m.z, 160, 260, rng, { clear: 10 }) : null;
          release(th, S, 'cast_out', at);
          S.note(th, `${b ? b.name : 'The outlaws'} had no more use for ${nameOf(S, c)}: they marched them out blindfolded and left them in the wilds with nothing.`, { news: b ? [b.near] : [] });
          S.tell(c.pid, 'They march you out blindfolded, a long way, and leave you there. Your things are still in their strongbox.', '#ffb080');
          S.asPid(c.pid, () => S.game.ui.showBlackout?.(['A sack over your head.', 'Hours of walking.', 'Then a shove, and they\'re gone.']));
        } else {
          const L = layoutOf(S, c.sid);
          const r = resolve(S, c);
          if (th.vars.plan === 'example' && L && r && rng.chance(0.5)) {
            S.note(th, `Nobody came for ${nameOf(S, c)}. ${b ? b.name : 'The outlaws'} left them hanging from an oak as a warning.`, { news: [c.sid] });
            if (r.captive) delete r.captive;
            S.sim.recordDeath(L, r, `killed by ${b ? b.name : 'outlaws'}`, null);
          } else {
            homeNpc(th, S);
            S.note(th, `${b ? b.name : 'The outlaws'} let ${nameOf(S, c)} go at last, bruised and starved.`, { news: [c.sid] });
          }
        }
        S.end(th, 'cast_out');
      },
    },
  },
  tasks: {
    // Getting them out.
    rescue: {
      npcs: { adv: 0.15, guard: 0.08 },
      npcPace: 0.35,
      npcTry(th, t, who, S, rng) {
        const b = bandOf(S, th);
        if (!b || th.node !== 'held' || !rng.chance(0.5)) return;
        if (rng.chance(odds(S.strengthOf(who) * 1.3, S.strengthOf(R.band(b.id)) * 0.8))) {
          S.go(th, 'freed', `${NameOf(S, who)} slipped into ${poss(b.name)} camp by night and got ${nameOf(S, th.cast.captive)} out.`, { by: who });
        } else {
          S.note(th, `${NameOf(S, who)} tried to get ${nameOf(S, th.cast.captive)} out of ${poss(b.name)} camp, and was driven off.`);
          S.drop(t, who);
        }
      },
      offer: (th, t, pid, S) => {
        const b = bandOf(S, th);
        return b && b.camp ? [`They're held at ${poss(b.name)} camp, ${directions(town(S, b.near), b.camp.x, b.camp.z)}. There's a cage; the jailer has the key.`] : [];
      },
      status: (th) => [th.node === 'held' ? 'Still in the cage, as far as anyone knows.' : 'Out, I hear.'],
      thanks: () => ['You brought them back. The whole town owes you.'],
    },
  },
  // The jailer, the chief, a captive townsperson: what they say.
  hello(th, a, npc, pid, S) {
    const c = th.cast.captive;
    const me = c.t === 'pl' && c.pid === pid;
    const b = bandOf(S, th);
    if (a.role === 'jailer') return me ? pick(S.rng(th, 1), ['Awake, are we?', 'Something you want?', 'Comfortable in there?']) : th.node === 'held' ? pick(S.rng(th, 2), ['Who in the hells are you?', 'Visitor? We don\'t get visitors.', 'You lost, friend?']) : '...';
    if (a.role === 'chief') {
      if (!me) return 'Not your business.';
      const plan = th.vars.plan;
      return plan === 'recruit' ? `So you're the one that's been killing my people. I could use someone like that. ${b ? b.name : 'We'} look after our own: a share of everything, and nobody hunting you. What do you say?`
        : plan === 'ransom' ? `Your friends will pay ¤${th.vars.demand} to have you back. If they love you. We'll see.`
          : 'You\'ll be an example to anyone else who thinks to cross us. At the end of it, out you go, with nothing.';
    }
    if (a.role === 'captive') return th.node === 'held' ? pick(S.rng(th, 3), ['Please, get me out of here!', 'Have you come for me? Tell me you have.', 'They said nobody\'d come...']) : 'Thank you. Take me home?';
    return '...';
  },
  talk(th, a, npc, pid, S) {
    const c = th.cast.captive;
    const me = c.t === 'pl' && c.pid === pid;
    const out = [];
    const tid = `t${th.id}`;
    if (a.role === 'jailer' && th.node === 'held') {
      if (me) {
        out.push({ id: 'sgc_ask', arg: tid, label: 'What do you want with me?' });
        out.push({ id: 'sgc_beg', arg: tid, label: 'Let me out. Please.' });
        if (!S.game.isParty()) out.push({ id: 'sgc_wait', arg: tid, label: '(Sit and wait a few hours)' });
      } else {
        if (th.vars.plan === 'ransom') out.push({ id: 'sgc_pay', arg: tid, label: `I've come to pay ${nameOf(S, c)}'s ransom. (¤${th.vars.demand})` });
        out.push({ id: 'sgc_threat', arg: tid, label: `Let ${nameOf(S, c, { full: false })} go, or else.` });
      }
    }
    if (a.role === 'chief' && me && th.node === 'held') {
      if (th.vars.plan === 'recruit' && !th.vars.refused) {
        out.push({ id: 'sgc_join', arg: tid, label: 'I\'ll ride with you.' });
        out.push({ id: 'sgc_refuse', arg: tid, label: 'I\'d rather rot.' });
      } else out.push({ id: 'sgc_spit', arg: tid, label: '(Spit at their feet)' });
    }
    if (a.role === 'captive' && th.node === 'freed' && !th.vars.leader) out.push({ id: 'sgc_lead', arg: tid, label: 'Follow me. I\'ll take you home.' });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const c = th.cast.captive;
    const b = bandOf(S, th);
    const rng = S.rng(th, 0x5e);
    switch (id) {
      case 'sgc_ask': {
        const plan = th.vars.plan;
        const left = Math.max(1, Math.round((th.vars.until - S.now) / 60));
        return { lines: [plan === 'ransom' ? `You? You're worth ¤${th.vars.demand} to someone. Let's hope they think so.` : plan === 'recruit' ? 'Chief\'s got plans for you. Wait and see.' : 'You\'re a lesson. To everyone.', `${left > 30 ? 'Couple of days' : `${left} hours`} and we'll know.`] };
      }
      case 'sgc_beg':
        return { lines: [pick(rng, ['Ha! No.', 'Not likely.', 'Begging won\'t do it.', 'Keep it down in there.'])] };
      case 'sgc_wait': {
        S.game.advanceTime(180);
        return { lines: ['(Three hours pass. Nobody comes.)'], close: true };
      }
      case 'sgc_pay': {
        const d = th.vars.demand;
        const g = S.game;
        const have = g.player.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
        if (have < d) return { lines: [`¤${d}. You haven't got it. Come back when you have.`] };
        removeItem(g.player.inv, 'coin', d);
        if (b) b.loot += d;
        S.touch(th, pid);
        S.go(th, 'ransomed', `${nameOf(S, R.pl(pid))} paid ¤${d} for ${nameOf(S, c)}.`, { by: R.pl(pid) });
        return { lines: ['Pleasure doing business. Out you come, then.'], close: true };
      }
      case 'sgc_threat': {
        const fame = S.person(pid).fame + S.person(pid).under;
        const few = b ? b.members.length : 0;
        if (fame >= 20 + few * 3) {
          const j = S.actorEnt(th, 'jailer');
          if (j) j.saga.leaving = true;
          if (b) setDoor(S, b, true);
          S.go(th, 'freed', `The jailer took one look at ${nameOf(S, R.pl(pid))}, threw down the key and ran.`, { by: R.pl(pid) });
          return { lines: ['You\'re... you\'re THAT one. Here, here, take the key, I never saw you!'], close: true };
        }
        S.emit('outlaw_struck', { th: th.id, key: 'jailer', by: R.pl(pid) });
        return { lines: ['Or else what?', '(They reach for their blade.)'], close: true };
      }
      case 'sgc_join':
        S.go(th, 'joined');
        return { lines: ['Ha! I knew it. Welcome to the fire. Get your things; you\'ll need them.'], close: true };
      case 'sgc_refuse':
        th.vars.refused = true;
        th.vars.plan = 'example';
        return { lines: ['Then you\'re no use to me. Enjoy the cage.'], close: true };
      case 'sgc_spit':
        return { lines: [pick(rng, ['Spirit. That\'ll go soon enough.', 'Ha. We\'ll see how long that lasts.'])], close: true };
      case 'sgc_lead': {
        th.vars.leader = pid;
        const e = S.actorEnt(th, 'captive');
        if (e && e.saga) e.saga.follow = pid;
        const a = S.actorSpec(th, 'captive');
        if (a) a.orders = { ...(a.orders || {}), follow: pid };
        return { lines: ['Yes. Yes, let\'s go, before they come back.'], close: true };
      }
      default:
        return null;
    }
  },
  // (Round 56) The captive dead: in the cage, on the road home, or after.
  // Killed by the very one who'd got them out, it's remembered.
  castDown(th, role, ev, S) {
    if (role !== 'captive') return null;
    const c = th.cast.captive;
    const b = bandOf(S, th);
    const by = ev.by;
    const where = townName(S, c.sid);
    if (by && by.t === 'pl' && (th.vars.leader === by.pid || th.node === 'freed')) {
      const pid = by.pid;
      S.person(pid).under += 2;
      if (b) S.emit('captive_slain', { band: b.id, by });
      return `${nameOf(S, by)} got ${NameOf(S, c)} out of the cage, and then cut them down on the road home. ${where} won't forget it, and the outlaws laugh about it round their fires.`;
    }
    if (by && by.t === 'pl') return `${NameOf(S, c)} was killed by ${nameOf(S, by)} before they ever got out of ${b ? poss(b.name) : 'the'} cage.`;
    if (th.node === 'held') return `${NameOf(S, c)} died in ${b ? poss(b.name) : 'the outlaws\''} cage. Nobody came in time.`;
    return `${NameOf(S, c)} never made it home to ${where}.`;
  },
  actorDown(th, a, by, S) {
    // (The jailer had the key on them.)
    if (a.role === 'jailer' && a.at) {
      const g = S.game;
      g.spawnDrop('cage_key', 1, a.at.x, g.world.findStandY(a.at.x, a.at.z, 6), a.at.z, true);
    }
  },
});

// What it'll cost to have them back.
function demandFor(S, th) {
  const c = th.cast.captive;
  if (c.t === 'pl') {
    const k = S.person(c.pid);
    return Math.round(60 + k.fame * 4 + k.under * 3);
  }
  const r = resolve(S, c);
  return r ? Math.round(30 + (r.coins || 0) * 0.5 + (r.job === 'merchant' ? 40 : 0)) : 40;
}

function holdPlayer(th, S, b, cg) {
  const pid = th.cast.captive.pid;
  let taken = [];
  S.asPid(pid, (p) => {
    const g = S.game;
    g.stopPlayerActions?.();
    g.ui.closeAll?.();
    taken = seize(p);
    stash(S, b, taken, pid);
    // (Whatever was lying about the cage, they've had: nothing in reach.)
    for (const d of g.drops) {
      if (d.dead || Math.max(Math.abs(d.x - cg.cell.x), Math.abs(d.z - cg.cell.z)) > 3) continue;
      if (d.item === 'coin') b.loot = (b.loot || 0) + d.count;
      else stash(S, b, [{ item: d.item, count: d.count }]);
      d.dead = true;
    }
    g.teleportPlayer(cg.cell.x, cg.cell.y, cg.cell.z);
    p.hp = Math.max(p.hp, Math.round(p.maxHp * 0.35));
    p.sagaHeld = { th: th.id };
    p.fightAt = 0;
    g.combatT = 0;
    g.ui.showBlackout?.(['Struck down.', 'Dragged through the trees...', `You wake in a cage at ${poss(b.name)} camp.`]);
  });
  th.vars.taken = taken.map((it) => ({ item: it.item, count: it.count }));
  S.note(th, `${b.name} took ${nameOf(S, th.cast.captive)} alive and threw them in a cage at their camp. They took ${listTaken(taken)}.`, { news: [b.near] });
  const plan = th.vars.plan;
  S.tell(pid, `They've taken ${listTaken(taken)}. ${plan === 'ransom' ? `They want ¤${th.vars.demand} for you.` : plan === 'recruit' ? 'Their chief will come to talk.' : 'They mean to make an example of you.'} (Talk to the jailer. A lockpick would open the door; or someone might come for you.)`, '#ffd890');
  S.emit('captive_loot', { band: b.id, items: th.vars.taken, owner: pid, th: th.id });
}

function holdNpc(th, S, b, cg) {
  const c = th.cast.captive;
  const r = resolve(S, c);
  if (!r) return S.end(th, 'faded');
  r.captive = { band: b.id, saga: th.id };
  r.away = true;
  if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
  S.actor(th, {
    key: 'captive', kind: 'npc', role: 'captive', talk: true, at: { x: cg.cell.x, z: cg.cell.z },
    person: { name: r.name, look: r.look, personality: r.personality, traits: r.traits, age: r.age, job: r.job, maxHp: r.maxHp || 20, title: 'Captive' },
    orders: { home: { x: cg.cell.x, z: cg.cell.z }, lines: ['Help! Somebody help me!', 'Please...', 'I want to go home.'] },
  });
  S.note(th, `${b.name} took ${fullName(r)} captive${th.vars.how === 'road' ? ' on the road' : ''}, and want ¤${th.vars.demand} for them.`, { news: [c.sid] });
}

function postTasks(th, S, b) {
  const c = th.cast.captive;
  const home = c.t === 'pl' ? homeOf(S, c.pid) : c.sid;
  const L = layoutOf(S, home);
  const m = L ? mayorOf(L) : null;
  const camp = b.camp ? { x: b.camp.x, z: b.camp.z } : null;
  const others = Object.keys(S.people).filter((q) => !(c.t === 'pl' && q === c.pid));
  const t = S.post(th, {
    role: 'rescue', kind: 'rescue', title: `Free ${nameOf(S, c)} from ${b.name}`, sid: home ?? b.near, giver: m && home !== null && home !== undefined ? R.rec(home, m.idx) : null,
    pitch: `${nameOf(S, c)} has been taken by ${b.name}. They're held in a cage at their camp. ${th.vars.plan === 'ransom' ? `They want ¤${th.vars.demand}, which we can't pay. ` : ''}Bring them home.`,
    at: camp, r: 8, target: c, secret: c.t === 'pl' ? c.pid : null,
    reward: { coins: c.t === 'pl' ? 40 : 30, from: home !== null && home !== undefined ? R.town(home) : null, rep: 8, renown: home ?? null, renownPts: 4, fame: 3 },
    delay: 20,
  });
  t.rumour = `${nameOf(S, c)} is held captive by ${b.name}`;
  t.glyph = 'c';
  // (One of you taken: everyone else playing hears of it at once. Someone
  // of a town's: word of it goes round as word does, Round 73.)
  for (const q of c.t === 'pl' ? others : []) {
    S.hear(q, t);
    S.tell(q, `${nameOf(S, c)} has been taken captive by ${b.name}! (See your quest log: O)`, '#ffb080');
  }
}

// Out of the cage (and what they were made to stop being).
function release(th, S, how, at = null) {
  const b = bandOf(S, th);
  const c = th.cast.captive;
  if (b) b.holding = false;
  if (b && b.camp && b.camp.cage) setDoor(S, b, true);
  S.dismissActor(th, 'jailer');
  S.dismissActor(th, 'chief');
  // (Back to the fire.)
  if (b) for (const m of b.members) if (m.id === th.vars.jailerM || m.id === th.vars.chiefM) m.out = false;
  if (c.t !== 'pl') return;
  const p = playerOf(S.game, c.pid);
  const k = S.person(c.pid);
  if (p) {
    p.sagaHeld = null;
    if (at) S.asPid(c.pid, () => S.game.teleportPlayer(at.x, 6, at.z));
    else if (how === 'ransomed' || how === 'joined') {
      const cg = b && b.camp && b.camp.cage;
      if (cg) S.asPid(c.pid, () => S.game.teleportPlayer(cg.door.x + 2, cg.door.y, cg.door.z));
    }
  } else if (at) k.releaseTo = at;
  // What they took that's still in the box: the way to it, if you want it.
  if (b && how !== 'ransomed' && how !== 'joined' && stashOf(b).some((it) => it.owner === c.pid)) {
    S.spawn(th, 'reclaim', { cast: { owner: c, band: R.band(b.id) }, sid: b.near, touched: [c.pid] });
  }
}

// What's theirs, out of the box and back to them.
function returnGear(S, b, pid, keepCoin) {
  const mine = stashOf(b).filter((it) => it.owner === pid && !(keepCoin && it.item === 'coin'));
  if (!mine.length) return;
  b.stash = stashOf(b).filter((it) => !mine.includes(it));
  S.asPid(pid, (p) => {
    for (const it of mine) {
      if (it.slot && !p.equip[it.slot]) {
        p.equip[it.slot] = it.item;
        continue;
      }
      const left = p.give(it.item, it.count);
      if (left) S.game.spawnDrop(it.item, left, p.x, p.y, p.z, true);
    }
    p.recalcMaxHp?.();
  });
}

function freeNpc(th, S, by) {
  const a = S.actorSpec(th, 'captive');
  if (a) a.orders = { ...(a.orders || {}), lines: ['Thank you! Take me home?', 'Let\'s go, quickly.'] };
  if (by && by.t === 'pl') {
    th.vars.leader = by.pid;
    const e = S.actorEnt(th, 'captive');
    if (e && e.saga) e.saga.follow = by.pid;
    if (a) a.orders.follow = by.pid;
  }
  // (Nobody there in the flesh to lead them: they walk home.)
  if (!S.actorEnt(th, 'captive')) {
    homeNpc(th, S);
    S.end(th, 'home', `${NameOf(S, th.cast.captive)} made it home.`);
  }
}

// Back among their own: near home, or in a town of their own realm.
function amongOwn(S, sid, e) {
  const home = town(S, sid);
  const mid = townMid(home);
  if (mid && Math.hypot(e.x - mid.x, e.z - mid.z) < 40) return true;
  const here = S.game.world.ow.settlementAt(Math.round(e.x), Math.round(e.z));
  return !!(here && home && here.civ !== undefined && here.civ === home.civ);
}

// Who'll be waiting for them at home: [name, how they're kin], or null.
function waitingFor(S, c) {
  const L = layoutOf(S, c.sid);
  const r = resolve(S, c);
  if (!L || !r) return null;
  const at = (i) => (Number.isInteger(i) ? L.npcs[i] : null);
  const ok = (q) => q && q !== r && q.alive !== false && !q.dead && q.name;
  const tries = [[at(r.partner), 'partner'], ...(r.children || []).map((i) => [at(i), 'child']), ...(r.parents || []).map((i) => [at(i), 'parent']), ...(r.friends || []).map((i) => [at(i), 'friend'])];
  const f = tries.find(([q]) => ok(q));
  return f ? [f[0].name.first, f[1]] : null;
}

// Parting from whoever led them, to walk the rest of the way alone.
function partWays(th, S, e) {
  const c = th.cast.captive;
  const rng = S.rng(th, 0x9a7);
  const w = waitingFor(S, c);
  const place = town(S, c.sid);
  const where = place ? place.name : 'home';
  const line = !w ? pick(rng, [
    `I know where I am now. I can walk to ${where} from here. Thank you, for all of it.`,
    'These are my own roads. Go on: I\'ll manage the rest. I won\'t forget this.',
  ]) : {
    partner: [`I can find my way from here. ${w[0]} must think I'm dead. I'm going straight to them.`, `${w[0]}'s waiting in ${where}. I can't keep them waiting another hour. Thank you!`],
    child: [`${w[0]} will be watching the road for me. I know the way now. Thank you, with all my heart.`, `I'm going home to ${w[0]}. I can see the way from here. Bless you.`],
    parent: [`I'm going home to ${w[0]}. I know these roads. Thank you, truly.`, `${w[0]} will have worn a hole in the floor waiting. I'll go on alone from here. Thank you!`],
    friend: [`From here I know the way. I'll go to ${w[0]} first: they'll have been out of their mind.`, `I'll find ${w[0]} and let them know I'm alive. Go on, I'm fine from here. Thank you.`],
  }[w[1]][rng.int(0, 1)];
  e.say(line, 5, '#e8d0a0');
  th.vars.parted = true;
  const t = S.tasksOf(th, 'rescue')[0];
  const by = th.vars.leader ? R.pl(th.vars.leader) : null;
  if (t && by) S.complete(t, by);
  S.note(th, `${NameOf(S, c)} parted from ${by ? nameOf(S, by) : 'their rescuer'} on the way into ${where}${w ? `, to go to ${w[0]}` : ''}.`);
  // (On alone: to the middle of town, and gone from sight.)
  const mid = townMid(place) || { x: Math.round(e.x), z: Math.round(e.z) };
  if (e.saga) {
    e.saga.follow = null;
    e.saga.homeward = mid;
  }
  const a = S.actorSpec(th, 'captive');
  if (a) a.orders = { ...(a.orders || {}), follow: null, homeward: mid };
}

function homeNpc(th, S) {
  const r = resolve(S, th.cast.captive);
  if (r) {
    delete r.captive;
    r.away = false;
  }
  S.dismissActor(th, 'captive');
}

// ------------------------------------------------------------ getting it back
motif({
  id: 'reclaim',
  family: 'bandits',
  max: 8,
  key: (o) => `${refKey(o.cast.owner)}:${o.cast.band.id}`,
  title: (th, S) => `Take Back What ${nameOf(S, th.cast.band)} Took`,
  nodes: {
    waiting: {
      enter(th, S) {
        const b = resolve(S, th.cast.band);
        const pid = th.cast.owner.pid;
        if (!b || !b.camp) return S.end(th, 'faded');
        const items = stashOf(b).filter((it) => it.owner === pid);
        S.post(th, {
          role: 'reclaim', kind: 'retrieve', title: `Recover your things from ${poss(b.name)} strongbox`, at: { x: b.camp.x, z: b.camp.z }, r: 10, only: [pid], npc: false,
          pitch: `Your ${listTaken(items)} are in the strongbox by ${poss(b.name)} fire.`, reward: { fame: 0 }, hand: 'auto',
        });
      },
      on: {
        stash_opened(th, ev, S) {
          if (ev.band !== th.cast.band.id) return;
          const t = S.tasksOf(th, 'reclaim')[0];
          if (ev.by && ev.by.t === 'pl' && ev.by.pid === th.cast.owner.pid) {
            if (t) S.complete(t, ev.by);
            S.end(th, 'recovered', 'You took back what was yours.');
          } else {
            if (t) S.closeTask(t, 'failed', ev.by);
            S.end(th, 'lost', `${nameOf(S, ev.by)} emptied the strongbox before you could.`);
          }
        },
        band_gone(th, ev, S) {
          if (ev.band !== th.cast.band.id) return;
          // (The camp's struck: what was in the box is left lying there.)
          const b = S.sim.bandits.bands.find((q) => q.id === ev.band);
          const items = stashOf(b);
          if (b && items.length && ev.at) {
            const g = S.game;
            if (g.world.regionAt(ev.at.x, ev.at.z)) {
              for (const it of items) g.spawnDrop(it.item, it.count, ev.at.x, g.world.findStandY(ev.at.x, ev.at.z, 6), ev.at.z, true);
              b.stash = [];
              S.end(th, 'scattered', 'With the camp gone, the strongbox was broken open and its things left lying in the grass.');
              return;
            }
          }
          S.end(th, 'lost', 'The band is gone, and whatever was in their strongbox with them.');
        },
      },
      fade: 30,
    },
  },
  tasks: { reclaim: {} },
});

export { listTaken };
