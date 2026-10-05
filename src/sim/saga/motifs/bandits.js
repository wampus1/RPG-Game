// The outlaws' side of things (round 52).
//
// A grudge. Kill enough of a band and they don't forget you: you're known
// among the world's outlaws (your name with them, see Saga.person().under),
// and they mean to make you pay. They send killers after you on the road
// (some with orders to take you alive); they put a price on your head that
// anyone may take up (other players too: see players.js); and when you've
// cost them enough, their chief writes to you: come and talk, at such a
// place, at dusk tomorrow. What the chief really wants is their own
// business: a truce, honestly meant; to bring you in with them; single
// combat, the band's freedom against yours; tribute; or a trap.
//
// The ones who kill you do well by it: a name ("Kestrel, the Wanderer's
// Bane"), better arms, a price on their head, and every adventurer and
// soldier in the country after them (a legend). Wipe out a band and the
// next band over hears of it. Rescue someone from their cage, or escape
// it, and that's remembered too.
//
// A windfall: a band that comes by a Kavorent core, a relic or Kavorent
// arms (off a merchant on the road, or off you in their cage) is a deal
// more dangerous; the realms want it back, sometimes more than one of
// them. A band dug in behind a wall is a stronghold, and a realm musters
// soldiers to storm it (you can go along). Join a band, and they'll have
// work for you.
import { motif, R, refKey, nameOf, NameOf, isAlive, resolve, playerOf, lcFirst, poss } from '../core.js';
import { pick, fill, layoutOf, town, townName, townMid, directions, living, fullName, odds, spotNear, hours, outInTheOpen, inTown, dist, purse } from './lib.js';
import { fromBandit, makePerson } from '../actors.js';
import { fortify, plan as campPlan, stash, stashOf } from './camp.js';
import { mayorOf, alive, ledger, DAY } from '../../econ.js';
import { ITEMS } from '../../../world/items.js';
import { countItem, removeItem } from '../../../game/inventory.js';
import { REGION_W } from '../../../config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const bandOf = (S, th) => (th.cast.band ? resolve(S, th.cast.band) : null);
const chiefOf = (b) => (b && b.members.length ? b.members[0] : null);

// ------------------------------------------------------------ names made
const BANE = ['{v}\'s Bane', 'the {v}-Killer', 'Who Felled {v}', 'the Red Hand', 'Black {w}', 'the Unbowed', 'Gallows-Cheat', 'the Wolf of the Road'];
const WORDS = ['Kestrel', 'Thorn', 'Ash', 'Crow', 'Briar', 'Flint', 'Hollow', 'Rook'];
const GOOD_ARMS = ['battle_axe', 'iron_sword+ruby', 'gold_sword', 'flail', 'iron_sword+onyx', 'spear+topaz', 'iron_axe+bloodstone'];

// One of a band did something to be remembered for: a name, better arms,
// and a legend of their own (see 'legend').
export function promote(S, band, mid, deed, victim, th = null) {
  const m = band && band.members.find((q) => q.id === mid);
  if (!m) return null;
  const rng = S.rng(th || { seed: band.id * 977 + mid, steps: 0 }, 0x9e0);
  const short = String(victim || 'the Wanderer').split(' ')[0];
  if (!m.title) m.title = fill(pick(rng, BANE), { v: short, w: pick(rng, WORDS) });
  m.maxHp += 8;
  m.hp = m.maxHp;
  m.armor = Math.max(m.armor ?? 0.1, 0.22);
  const arms = GOOD_ARMS.filter((k) => ITEMS[k]);
  if (arms.length && !(ITEMS[m.weapon] && ITEMS[m.weapon].kav)) m.weapon = pick(rng, arms);
  const key = `o${band.id}_${m.id}`;
  const n = S.named[key] || (S.named[key] = { key, kind: 'outlaw', name: `${m.name.first} ${m.name.last}`, band: band.id, member: m.id, power: 2.4, kills: [], born: S.now, dead: false });
  n.title = m.title;
  n.kills.push(victim);
  n.power += 0.6;
  n.at = band.camp ? { x: band.camp.x, z: band.camp.z } : n.at;
  if (!S.live().some((t) => t.m === 'legend' && t.vars.key === key)) S.spawn(th, 'legend', { cast: { named: R.named(key), band: R.band(band.id) }, sid: band.near, vars: { key, deed } });
  else S.emit('legend_grew', { key, deed, victim });
  return n;
}

// ------------------------------------------------------------ the grudge
const HUNT_GAP = hours(16);
const PLACES = ['old oak at the ford', 'standing stone', 'burnt mill', 'crossroads shrine', 'hanging tree', 'dry well', 'split boulder', 'fallen bridge'];

function target(th) {
  return th.cast.target;
}
function targetPid(th) {
  return th.cast.target.t === 'pl' ? th.cast.target.pid : null;
}

// Killers sent after someone playing.
function sendHunters(th, S, rng) {
  const b = bandOf(S, th);
  const pid = targetPid(th);
  const p = pid && playerOf(S.game, pid);
  if (!b || !b.camp || !p) return false;
  const free = b.members.filter((m) => !m.out);
  const heat = th.vars.heat || 0;
  const n = clamp(2 + Math.floor(heat / 4), 2, Math.min(5, free.length - (free.length > 2 ? 1 : 0)));
  if (n < 1 || free.length < 1) return false;
  // (The chief goes too, when it's personal enough.)
  const party = (heat >= 9 ? free : free.filter((m) => m !== chiefOf(b))).slice(0, n);
  if (!party.length) return false;
  const spot = spotNear(S, p.x, p.z, 20, 26, rng, { clear: 4, flat: 0 }) || { x: Math.round(p.x + 22), z: Math.round(p.z) };
  const L = layoutOf(S, b.near);
  const capture = rng.chance(th.vars.takeAlive ?? (0.25 + (1 - ((chiefOf(b) || {}).personality?.kindness ?? 0.5)) * 0.35));
  const name = nameOf(S, R.pl(pid));
  party.forEach((m, i) => {
    m.out = true;
    S.actor(th, {
      key: `h${m.id}`, kind: 'npc', role: 'hunter', hostile: true, at: { x: spot.x + (i % 2), z: spot.z + Math.floor(i / 2) },
      person: fromBandit(m, b),
      orders: { target: pid, capture, home: { x: b.camp.x, z: b.camp.z }, cry: pick(rng, [`${name}! ${b.name} send their regards!`, 'That\'s the one. Take them!', `For the ${b.name.replace(/^the /, '')}!`, capture ? 'Alive! The chief wants them alive!' : 'No mercy!']) },
    });
  });
  void L;
  th.vars.party = party.map((m) => m.id);
  th.vars.huntAt = S.now;
  th.vars.capture = capture;
  S.person(pid).lastHunt = S.now;
  S.tell(pid, pick(rng, ['You hear a twig snap somewhere behind you.', 'Someone\'s following you. You\'re sure of it.', 'Shapes moving through the trees, keeping pace with you.']), '#ffb080');
  return true;
}

function recall(th, S) {
  const b = bandOf(S, th);
  for (const a of th.actors.filter((q) => q.role === 'hunter' || q.role === 'ambush' || q.role === 'leader' || q.role === 'guard' || q.role === 'champion' || q.role === 'messenger')) S.dismissActor(th, a.key);
  if (b) for (const m of b.members) if ((th.vars.party || []).includes(m.id) || m.id === th.vars.meetM || (th.vars.escort || []).includes(m.id)) m.out = false;
  th.vars.party = [];
  th.actors = th.actors.filter((a) => !['hunter', 'ambush', 'leader', 'guard', 'champion', 'messenger'].includes(a.role));
}

function heat(th, n) {
  th.vars.heat = Math.max(0, (th.vars.heat || 0) + n);
  return th.vars.heat;
}

const SCHEMES = {
  parley: 'to talk terms',
  recruit: 'to make an offer',
  trap: 'to talk terms',
  duel: 'to settle it, one to one',
  tribute: 'to come to an arrangement',
  // (Round 54: not every chief wants a meeting.)
  leave: 'to say they\'re done',
  gift: 'to make peace, with a purse',
};

motif({
  id: 'grudge',
  family: 'bandits',
  max: 12,
  key: (o) => `${o.cast.band.id}:${refKey(o.cast.target)}`,
  title: (th, S) => `${NameOf(S, th.cast.band)} Want ${nameOf(S, th.cast.target)} Dead`,
  seeds: [
    // One of theirs killed: someone's on their list.
    { on: 'bandit_down', make: (ev, S) => {
      if (!ev.by || (ev.by.t !== 'pl' && ev.by.t !== 'adv')) return null;
      const b = S.sim.bandits.get(ev.band);
      if (ev.by.t === 'pl') {
        const k = S.person(ev.by.pid);
        k.under += 1 + (ev.title ? 2 : 0);
        if (k.joined === ev.band) return null;
      }
      const n = S.count(`heads:${ev.band}:${refKey(ev.by)}`, ev.n || 1);
      if (!b || S.live().some((t) => t.m === 'grudge' && t.key === `${ev.band}:${refKey(ev.by)}`)) return null;
      const under = ev.by.t === 'pl' ? S.person(ev.by.pid).under : 0;
      if (n < 2 && under < 6 && !ev.title) return null;
      return { cast: { band: R.band(ev.band), target: ev.by }, sid: b.near, vars: { heat: n + (ev.title ? 3 : 0), heads: n }, touched: ev.by.t === 'pl' ? [ev.by.pid] : [] };
    } },
    // A band wiped out: the next band over hears of it.
    { on: 'band_gone', make: (ev, S) => {
      if (!ev.by || (ev.by.t !== 'pl' && ev.by.t !== 'adv') || !ev.at) return null;
      const under = ev.by.t === 'pl' ? S.person(ev.by.pid).under : 3;
      if (ev.by.t === 'pl') S.person(ev.by.pid).under += 3;
      const near = S.sim.bandits.live().filter((b) => b.camp && b.id !== ev.band && Math.hypot(b.camp.x - ev.at.x, b.camp.z - ev.at.z) < 15 * REGION_W).sort((a, b) => Math.hypot(a.camp.x - ev.at.x, a.camp.z - ev.at.z) - Math.hypot(b.camp.x - ev.at.x, b.camp.z - ev.at.z))[0];
      if (!near || (under < 5 && Math.random() > 0.4)) return null;
      return { cast: { band: R.band(near.id), target: ev.by }, sid: near.near, vars: { heat: 3 + Math.floor(under / 4), avenging: ev.name }, touched: ev.by.t === 'pl' ? [ev.by.pid] : [] };
    } },
    // Their prize taken out of their cage from under them.
    { on: 'rescued', make: (ev, S) => {
      if (!ev.by || (ev.by.t !== 'pl' && ev.by.t !== 'adv')) return null;
      const b = S.sim.bandits.get(ev.band);
      if (!b) return null;
      return { cast: { band: R.band(b.id), target: ev.by }, sid: b.near, vars: { heat: 4, why: 'rescue' }, touched: ev.by.t === 'pl' ? [ev.by.pid] : [] };
    } },
    // And the one who got out of it.
    { on: 'escaped', make: (ev, S) => {
      const b = S.sim.bandits.get(ev.band);
      if (!b) return null;
      return { cast: { band: R.band(b.id), target: R.pl(ev.pid) }, sid: b.near, vars: { heat: 4, why: 'escape' }, touched: [ev.pid] };
    } },
  ],
  anchors: (th, S) => {
    const b = bandOf(S, th);
    return b && b.camp ? [{ x: b.camp.x, z: b.camp.z }] : [];
  },
  nodes: {
    seethe: {
      enter(th, S) {
        const b = bandOf(S, th);
        if (!b) return S.end(th, 'faded');
        if (!th.vars.sworn) {
          th.vars.sworn = true;
          const why = th.vars.avenging ? `for what was done to ${th.vars.avenging}` : th.vars.why === 'rescue' ? 'for taking what was theirs out of their cage' : th.vars.why === 'escape' ? 'for slipping out of their cage' : 'for the blood of their own';
          S.note(th, `${b.name} have sworn to make ${nameOf(S, target(th))} pay ${why}.`);
          if (targetPid(th)) S.tell(targetPid(th), `Word among the outlaws: ${b.name} want you dead.`, '#ff9080');
        }
      },
      hour(th, S, rng) {
        const b = bandOf(S, th);
        const pid = targetPid(th);
        if (!b || !pid) return;
        const k = S.person(pid);
        if (k.truce && k.truce[b.id] > S.now) return;
        if (k.joined === b.id) return S.end(th, 'joined');
        const h = th.vars.heat || 0;
        // Their chief's had enough: a letter.
        if (h >= 7 && !th.vars.wrote && chiefOf(b) && b.members.length >= 2 && rng.chance(0.08)) return S.go(th, 'letter');
        // A price on your head, for anyone who wants it.
        if (h >= 5 && !th.vars.priced && rng.chance(0.1)) {
          th.vars.priced = true;
          S.spawn(th, 'contract', { cast: { patron: R.band(b.id), target: R.pl(pid) }, sid: b.near, vars: { pay: 40 + h * 12, alive: rng.chance(0.35) } });
        }
        // Killers on the road.
        if (h >= 2 && outInTheOpen(S, pid) && S.now - (k.lastHunt || -1e9) >= HUNT_GAP && rng.chance(0.12 + h * 0.03)) {
          if (sendHunters(th, S, rng)) S.go(th, 'hunt');
        }
      },
      day(th, S, rng) {
        const b = bandOf(S, th);
        if (!b) return S.end(th, 'over');
        const tg = target(th);
        // Not someone playing: settled the plain way.
        if (tg.t !== 'pl') {
          if (!isAlive(S, tg)) return S.end(th, 'over');
          if (rng.chance(clamp((th.vars.heat || 0) * 0.06, 0.05, 0.4))) ambushNpc(th, S, rng);
          return;
        }
        // (A weak band thinks better of it, and moves on.)
        if (b.members.length <= 1 && rng.chance(0.4)) {
          S.sim.bandits.move(b, rng, S.day);
          S.end(th, 'fled', `${b.name}, down to their last, slipped away rather than face ${nameOf(S, tg)} again.`);
        }
        heat(th, -0.3);
        if ((th.vars.heat || 0) <= 0.5) S.end(th, 'cooled', `${b.name} have let it go. For now.`);
      },
      on: {
        bandit_down(th, ev, S) {
          if (ev.band !== th.cast.band.id || !ev.by || refKey(ev.by) !== refKey(target(th))) return;
          heat(th, 1.5);
          th.vars.heads = (th.vars.heads || 0) + (ev.n || 1);
          const pid = targetPid(th);
          if (pid && S.person(pid).truce && S.person(pid).truce[ev.band] > S.now) {
            S.person(pid).truce[ev.band] = 0;
            S.person(pid).under += 3;
            heat(th, 4);
            S.note(th, `${nameOf(S, target(th))} broke the truce with ${nameOf(S, th.cast.band)}.`, { news: [th.sid] });
            S.tell(pid, `You've broken the truce with ${nameOf(S, th.cast.band)}. They'll come for you now.`, '#ff9080');
          }
        },
        band_gone(th, ev, S) {
          if (ev.band !== th.cast.band.id) return;
          S.end(th, 'over', `${ev.name} are no more, and their grudge died with them.`);
        },
      },
      fade: 30,
    },
    hunt: {
      enter(th, S) {
        S.note(th, `${NameOf(S, th.cast.band)} sent ${(th.vars.party || []).length} of theirs after ${nameOf(S, target(th))}${th.vars.capture ? ', with orders to bring them back alive' : ''}.`, { hidden: true });
      },
      // Out of sight, they keep after you.
      hour(th, S) {
        const pid = targetPid(th);
        const p = pid && playerOf(S.game, pid);
        const k = pid ? S.person(pid) : null;
        const goal = p ? { x: p.x, z: p.z } : k && k.last;
        for (const a of th.actors) {
          if (a.role !== 'hunter' || a.gone || S.actorEnt(th, a.key) || !goal) continue;
          const tw = inTown(S, pid);
          const mid = tw ? townMid(tw) : null;
          // (They wait outside a town for you to come out.)
          const want = mid ? { x: mid.x + Math.sign(a.at.x - mid.x || 1) * 45, z: mid.z + Math.sign(a.at.z - mid.z || 1) * 30 } : goal;
          const d = dist(a.at, want);
          const step = Math.min(d, 70);
          if (d > 1) a.at = { x: Math.round(a.at.x + ((want.x - a.at.x) / d) * step), z: Math.round(a.at.z + ((want.z - a.at.z) / d) * step) };
        }
        if (S.now - (th.vars.huntAt || 0) > hours(20)) {
          S.note(th, 'The killers lost the trail and went home.');
          recall(th, S);
          S.go(th, 'seethe');
        }
      },
      live(th, S) {
        const left = th.actors.filter((a) => a.role === 'hunter' && !a.gone && !a.dead);
        if (!left.length) {
          const dead = th.actors.filter((a) => a.role === 'hunter' && a.dead).length;
          if (dead) {
            S.note(th, `${NameOf(S, target(th))} cut down ${dead === 1 ? 'the killer' : `${dead} of the killers`} ${nameOf(S, th.cast.band)} sent.`, { by: targetPid(th) });
            if (targetPid(th)) S.person(targetPid(th)).under += dead;
            heat(th, 1 + dead * 0.5);
          }
          recall(th, S);
          S.go(th, 'seethe');
        }
      },
      on: {
        player_died(th, ev, S) {
          if (ev.pid !== targetPid(th)) return;
          const b = bandOf(S, th);
          const byMe = ev.by && ev.by.t === 'bandit' && ev.by.band === th.cast.band.id;
          if (!b || !byMe) return;
          const n = promote(S, b, ev.by.m, 'killed', nameOf(S, target(th)), th);
          S.note(th, `${n ? `${n.name}, now called ${n.title},` : 'One of them'} killed ${nameOf(S, target(th))} on the road.`, { news: [b.near] });
          heat(th, -Math.ceil((th.vars.heat || 0) / 2));
          recall(th, S);
          S.go(th, 'seethe');
        },
        captured(th, ev, S) {
          if (ev.pid !== targetPid(th) || ev.band !== th.cast.band.id) return;
          recall(th, S);
          S.go(th, 'holding', null, { cap: ev.th });
        },
        band_gone(th, ev, S) {
          if (ev.band !== th.cast.band.id) return;
          recall(th, S);
          S.end(th, 'over');
        },
      },
    },
    // In their cage: what comes of that decides what comes of this.
    holding: {
      enter(th, S, o) {
        th.vars.cap = o && o.cap;
      },
      on: {
        saga_end(th, ev, S) {
          if (ev.m !== 'captive' || ev.th !== th.vars.cap) return;
          const pid = targetPid(th);
          switch (ev.outcome) {
            case 'joined': return S.end(th, 'joined');
            case 'ransomed':
              if (pid) S.person(pid).truce[th.cast.band.id] = S.now + 5 * DAY;
              return S.go(th, 'seethe');
            case 'cast_out':
              heat(th, -(th.vars.heat || 0));
              return S.end(th, 'humbled', `${nameOf(S, th.cast.band)} made an example of ${nameOf(S, target(th))}, and count the matter closed.`);
            default:
              heat(th, 3);
              return S.go(th, 'seethe');
          }
        },
      },
    },
    // A letter from their chief.
    letter: {
      enter(th, S) {
        const b = bandOf(S, th);
        const pid = targetPid(th);
        const chief = chiefOf(b);
        if (!b || !pid || !chief) return S.go(th, 'seethe');
        th.vars.wrote = true;
        const rng = S.rng(th, 0x1e7);
        const k = S.person(pid);
        const P = chief.personality || {};
        // (What a chief does depends on who they are: the honest and the
        // proud don't lay traps; the sly and the hot-headed might; a band
        // worn thin may simply want out.)
        const T = chief.traits || [];
        const honest = T.includes('honest') || T.includes('proud') || T.includes('kind');
        const sly = T.includes('shrewd') || T.includes('hot-headed') || T.includes('stingy');
        const weak = b.members.length <= 3;
        const scheme = S.choose(th, [
          { to: 'parley', w: 1 + (P.kindness ?? 0.5) * 2 - ((th.vars.heat || 0) > 12 ? 0.6 : 0) + (honest ? 0.5 : 0) },
          { to: 'recruit', w: 0.8 + (k.under >= 10 ? 1.5 : 0) + (k.fame < 4 ? 0.5 : 0) },
          { to: 'trap', w: Math.max(0.1, 0.4 + (1 - (P.kindness ?? 0.5)) * 1.4 + Math.min(1.2, (th.vars.heat || 0) * 0.05) + (sly ? 0.6 : 0) - (honest ? 0.7 : 0) - (weak ? 0.3 : 0)) },
          { to: 'duel', w: (P.bravery ?? 0.5) * 1.6 + (T.includes('proud') ? 0.4 : 0) },
          { to: 'tribute', w: b.loot < 50 ? 1 : 0.3 },
          { to: 'leave', w: weak ? 1.2 : 0.15 + (1 - (P.bravery ?? 0.5)) * 0.4 },
          { to: 'gift', w: (P.kindness ?? 0.5) * 0.8 + (b.loot > 60 ? 0.4 : 0) },
        ], rng).to;
        th.vars.gift = scheme === 'gift' ? Math.max(15, Math.min(60, Math.round((b.loot || 30) * 0.4))) : 0;
        th.vars.feint = scheme === 'leave' && sly && rng.chance(0.5);
        th.vars.scheme = scheme;
        // Where, and when: neutral ground between them, dusk tomorrow.
        const camp = { x: b.camp.x, z: b.camp.z };
        const spot = spotNear(S, camp.x, camp.z, 40, 80, rng, { clear: 12 }) || { x: camp.x + 50, z: camp.z };
        const place = pick(rng, PLACES);
        th.vars.meet = { ...spot, place, at: (S.day + 1) * DAY + 18 * 60 };
        const s = town(S, b.near);
        const where = directions(s, spot.x, spot.z);
        const sign = `${chief.name.first} ${chief.name.last}, of ${b.name}`;
        const body = {
          parley: [`To ${k.name}.`, '', `You've killed ${th.vars.heads || 'too many'} of mine. Enough blood.`, `Come to the ${place}, ${where}, at dusk tomorrow.`, 'Come alone, and we\'ll talk like people.', '', `- ${sign}`],
          recruit: [`To ${k.name}.`, '', 'You fight better than any of mine. That interests me.', `Come to the ${place}, ${where}, at dusk tomorrow,`, 'and hear what I have to offer. It\'ll make you rich.', '', `- ${sign}`],
          trap: [`To ${k.name}.`, '', 'There\'s been enough killing on both sides.', `Come to the ${place}, ${where}, at dusk tomorrow.`, 'Come alone, and we\'ll settle this like people.', '', `- ${sign}`],
          duel: [`To ${k.name}.`, '', 'You and me. Nobody else.', `The ${place}, ${where}, at dusk tomorrow.`, 'If I fall, my people leave these hills for good.', 'If you fall, you\'re mine.', '', `- ${sign}`],
          tribute: [`To ${k.name}.`, '', 'I think we can come to an arrangement, you and I.', `The ${place}, ${where}, at dusk tomorrow.`, '', `- ${sign}`],
          leave: [`To ${k.name}.`, '', `You've had ${th.vars.heads || 'enough'} of mine. I've had enough of burying them.`, 'We\'re leaving these hills. Don\'t follow us.', '', `- ${sign}`],
          gift: [`To ${k.name}.`, '', 'Here is a purse. Call it the price of peace.', 'Keep away from my people, and we\'ll keep away from yours.', 'Take the coin and we have a bargain. Strike us again and it\'s war.', '', `- ${sign}`],
        }[scheme];
        th.vars.noteKey = S.writeNote(th, 'letter', `A LETTER FROM ${b.name.toUpperCase()}`, body);
        th.vars.meetM = chief.id;
        // A messenger finds you.
        const p = playerOf(S.game, pid);
        const from = p ? spotNear(S, p.x, p.z, 16, 22, rng, { clear: 0, flat: 0 }) : null;
        const m2 = b.members.find((q) => !q.out && q !== chief);
        const person = m2 ? fromBandit(m2, b) : makePerson(rng, s ? s.style : 'vale', 'messenger');
        if (m2) {
          m2.out = true;
          th.vars.escort = [m2.id];
        }
        S.actor(th, {
          key: 'messenger', kind: 'npc', role: 'messenger', talk: true, at: from || { x: camp.x, z: camp.z },
          person, orders: { seek: pid, outlaw: true, markFor: pid, mark: 'talk', hail: `${k.name}? A word. I've a letter for you.`, patience: 120, ignoredLine: 'Your loss.' },
        });
        th.vars.sentAt = S.now;
        S.note(th, `${chief.name.first} ${chief.name.last} of ${b.name} sent a messenger to ${k.name} with a letter, asking to meet ${SCHEMES[scheme]}.`);
      },
      hour(th, S) {
        // (Couldn't find you: the letter's left for you.)
        if (S.now - th.vars.sentAt > hours(10) && !th.vars.delivered) {
          deliver(th, S, true);
          S.dismissActor(th, 'messenger');
        }
      },
      on: {
        outlaw_struck(th, ev, S) {
          if (ev.th !== th.id || ev.key !== 'messenger') return;
          heat(th, 2);
          th.vars.scheme = 'trap';
          th.vars.struck = true;
        },
      },
    },
    meeting: {
      enter(th, S) {
        const b = bandOf(S, th);
        const m = th.vars.meet;
        if (!b || !m) return S.go(th, 'seethe');
        const chief = chiefOf(b);
        if (!chief) return S.go(th, 'seethe');
        chief.out = true;
        th.vars.meetM = chief.id;
        const pid = targetPid(th);
        S.actor(th, { key: 'leader', kind: 'npc', role: 'leader', talk: true, at: { x: m.x, z: m.z }, person: fromBandit(chief, b), orders: { home: { x: m.x, z: m.z }, outlaw: true, markFor: pid, mark: 'talk' } });
        const guards = b.members.filter((q) => !q.out).slice(0, 2);
        th.vars.escort = guards.map((q) => q.id);
        guards.forEach((g, i) => {
          g.out = true;
          S.actor(th, { key: `g${i}`, kind: 'npc', role: 'guard', talk: true, at: { x: m.x + (i ? 2 : -2), z: m.z + 1 }, person: fromBandit(g, b), orders: { home: { x: m.x + (i ? 2 : -2), z: m.z + 1 }, outlaw: true, lines: ['...', 'Chief.', 'Hm.'] } });
        });
        th.vars.metAt = S.now;
      },
      live(th, S) {
        const pid = targetPid(th);
        const p = pid && playerOf(S.game, pid);
        const m = th.vars.meet;
        if (!p || !m) return;
        const d = Math.max(Math.abs(p.x - m.x), Math.abs(p.z - m.z));
        // A trap: once you're close, it's sprung.
        if (th.vars.scheme === 'trap' && !th.vars.sprung && d <= 5) {
          th.vars.near = (th.vars.near || 0) + 0.5;
          if (th.vars.near >= 5) spring(th, S);
        }
        // Walked away: the chief leaves too.
        if (d > 40 && S.now - th.vars.metAt > 10) {
          recall(th, S);
          heat(th, 1);
          S.note(th, `${nameOf(S, target(th))} walked away from the meeting.`);
          S.go(th, 'seethe');
        }
      },
      hour(th, S) {
        if (S.now - th.vars.metAt > hours(3)) {
          recall(th, S);
          S.go(th, 'seethe');
        }
      },
      on: {
        outlaw_struck(th, ev, S) {
          if (ev.th !== th.id) return;
          if (th.vars.scheme !== 'trap' || !th.vars.sprung) {
            th.vars.scheme = 'trap';
            spring(th, S, true);
          }
        },
        captured(th, ev, S) {
          if (ev.pid !== targetPid(th)) return;
          recall(th, S);
          S.go(th, 'holding', null, { cap: ev.th });
        },
        // Their chief yields in single combat: a chief's word is kept.
        duel_won(th, ev, S) {
          if (ev.actor !== `${th.id}:champion`) return;
          const b = bandOf(S, th);
          recall(th, S);
          if (b) S.sim.bandits.move(b, S.rng(th, 0xd0f), S.day);
          const pid = targetPid(th);
          if (pid) {
            S.person(pid).fame += 5;
            S.person(pid).under += 3;
          }
          S.end(th, 'honoured', `${nameOf(S, target(th))} beat ${b ? `${chiefOf(b) ? chiefOf(b).name.first : 'the chief'} of ${b.name}` : 'their chief'} in single combat. True to the chief's word, the band broke camp and left those hills.`, { news: b ? [b.near] : [] });
        },
        bandit_down(th, ev, S) {
          if (ev.band !== th.cast.band.id || ev.member !== th.vars.meetM) return;
          // The chief fell (in single combat, or in their own trap).
          const b = bandOf(S, th);
          if (th.vars.scheme === 'duel' && b) {
            recall(th, S);
            const rng = S.rng(th, 0xd0e);
            S.sim.bandits.move(b, rng, S.day);
            if (ev.by && ev.by.t === 'pl') {
              S.person(ev.by.pid).fame += 5;
              S.person(ev.by.pid).under += 4;
            }
            return S.end(th, 'honoured', `${nameOf(S, target(th))} killed ${ev.name} in single combat. True to the chief's word, ${b.name} broke camp and left those hills.`, { news: [b.near] });
          }
          heat(th, 3);
        },
        player_died(th, ev, S) {
          if (ev.pid !== targetPid(th)) return;
          const b = bandOf(S, th);
          if (b && ev.by && ev.by.t === 'bandit' && ev.by.band === b.id) promote(S, b, ev.by.m, 'killed', nameOf(S, target(th)), th);
          recall(th, S);
          S.go(th, 'seethe');
        },
      },
    },
  },
  tasks: {
    meet: {
      reach(th, t, pid, S) {
        const m = th.vars.meet;
        if (!m || pid !== targetPid(th)) return;
        if (S.now < m.at - 90) {
          if (!th.vars.early) {
            th.vars.early = true;
            S.tell(pid, 'Nobody here yet. The letter said dusk tomorrow.', '#c8c8c8');
          }
          return;
        }
        S.closeTask(t, 'done', R.pl(pid));
        S.go(th, 'meeting', `${nameOf(S, R.pl(pid))} came to the ${m.place}.`);
      },
      lapsed(th, t, S) {
        heat(th, 3);
        th.vars.takeAlive = 0.6;
        S.note(th, `${nameOf(S, target(th))} never came to the meeting. ${NameOf(S, th.cast.band)} took it as an insult.`);
        S.go(th, 'seethe');
      },
    },
  },
  hello(th, a, npc, pid, S) {
    const b = bandOf(S, th);
    if (a.role === 'messenger') return pid === targetPid(th) ? `You're ${nameOf(S, R.pl(pid))}? I've a letter for you, from ${chiefOf(b) ? chiefOf(b).name.first : 'the chief'} of ${b ? b.name : 'the band'}. Don't shoot the messenger.` : 'Not you. Move along.';
    if (a.role === 'leader') {
      if (pid !== targetPid(th)) return 'This isn\'t your business.';
      return {
        parley: `So you came. Good. I'm tired of burying my people, ${nameOf(S, R.pl(pid))}. Here's what I'm offering: you leave mine alone, and we leave you alone. Swear it, and it's done.`,
        recruit: `You've cost me ${th.vars.heads || 'a lot of'} good people. But I'll say this: you fight like three of them. Join us. A full share of everything we take, and nobody in these hills will ever raise a hand to you again.`,
        trap: 'You came alone? Good. Come closer. Let\'s talk.',
        duel: 'You came. Then let\'s not waste words. You and me, here, now. Win, and my people leave these hills. Lose, and you\'re mine.',
        tribute: `Here's how it is. ¤${tributeOf(th, S)}, and we forget your face. That's cheaper than the alternative.`,
      }[th.vars.scheme] || '...';
    }
    if (a.role === 'guard') return 'Talk to the chief.';
    return '...';
  },
  talk(th, a, npc, pid, S) {
    const tid = `t${th.id}`;
    const out = [];
    if (a.role === 'messenger' && pid === targetPid(th) && th.node === 'letter' && !th.vars.delivered) {
      out.push({ id: 'sgg_take', arg: tid, label: 'Give it here.' });
      out.push({ id: 'sgg_spurn', arg: tid, label: 'Tell your chief to go to the hells.' });
    }
    if (a.role === 'leader' && pid === targetPid(th) && th.node === 'meeting' && !th.vars.sprung) {
      const s = th.vars.scheme;
      if (s === 'parley' || s === 'trap') {
        out.push({ id: 'sgg_swear', arg: tid, label: 'I swear it. A truce.' });
        out.push({ id: 'sgg_demand', arg: tid, label: 'Here\'s my offer: leave these hills, or die in them.' });
      }
      if (s === 'recruit') {
        out.push({ id: 'sgg_join', arg: tid, label: 'I\'ll ride with you.' });
        out.push({ id: 'sgg_nojoin', arg: tid, label: 'I don\'t ride with outlaws.' });
      }
      if (s === 'duel') {
        out.push({ id: 'sgg_duel', arg: tid, label: 'Agreed. Draw.' });
        out.push({ id: 'sgg_noduel', arg: tid, label: 'I didn\'t come to fight you.' });
      }
      if (s === 'tribute') {
        out.push({ id: 'sgg_pay', arg: tid, label: `Pay them. (¤${tributeOf(th, S)})` });
        out.push({ id: 'sgg_nopay', arg: tid, label: 'You\'ll get nothing from me.' });
      }
    }
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const b = bandOf(S, th);
    const rng = S.rng(th, 0x4e5);
    switch (id) {
      case 'sgg_take':
        deliver(th, S, false);
        S.dismissActor(th, 'messenger');
        return { lines: ['There. Read it. The chief doesn\'t like waiting.', '(A sealed letter: read it [F/RMB].)'], close: true };
      case 'sgg_spurn':
        heat(th, 2);
        th.vars.takeAlive = 0.5;
        S.dismissActor(th, 'messenger');
        S.note(th, `${nameOf(S, R.pl(pid))} sent the messenger back with a curse.`);
        S.go(th, 'seethe');
        return { lines: [pick(rng, ['Your funeral.', 'I\'ll tell them. They won\'t like it.', 'Brave. Stupid, but brave.'])], close: true };
      case 'sgg_swear': {
        if (th.vars.scheme === 'trap') {
          spring(th, S);
          return { lines: ['Ha! Swear all you like. NOW!'], close: true };
        }
        S.person(pid).truce[b.id] = S.now + 10 * DAY;
        recall(th, S);
        S.note(th, `${nameOf(S, R.pl(pid))} and ${b.name} swore a truce at the ${th.vars.meet.place}.`, { news: [b.near] });
        S.go(th, 'seethe');
        th.vars.heat = 1;
        return { lines: ['Then it\'s done. Break it, and we\'ll come for you with everything we have.'], close: true };
      }
      case 'sgg_demand': {
        const mine = S.person(pid).fame + S.person(pid).under;
        if (th.vars.scheme !== 'trap' && b && mine >= 18 + b.members.length * 3) {
          recall(th, S);
          S.sim.bandits.move(b, rng, S.day);
          S.end(th, 'cowed', `${b.name} heard ${nameOf(S, R.pl(pid))} out, and chose to leave the hills rather than fight on.`, { news: [b.near] });
          return { lines: ['...', 'Fine. We\'ll go. But don\'t think we\'ll forget your face.'], close: true };
        }
        spring(th, S, true);
        return { lines: ['Then we\'re done talking.'], close: true };
      }
      case 'sgg_join': {
        const k = S.person(pid);
        k.joined = b.id;
        k.under += 4;
        S.give(pid, 'outlaw_token', 1);
        recall(th, S);
        S.note(th, `${nameOf(S, R.pl(pid))} joined ${b.name}.`, { news: [b.near] });
        S.townSay(pid, b.near, -12);
        S.spawn(th, 'outlaw_work', { cast: { band: R.band(b.id), member: R.pl(pid) }, sid: b.near, touched: [pid] });
        S.end(th, 'joined');
        return { lines: ['Ha! Welcome to the fire. Wear the token; my people will know you.', '(You\'re one of them now. They\'ll have work for you at their camp.)'], close: true };
      }
      case 'sgg_nojoin':
        heat(th, 1);
        recall(th, S);
        S.go(th, 'seethe');
        return { lines: [pick(rng, ['Your mistake.', 'Then we\'ll meet again, and not to talk.'])], close: true };
      case 'sgg_duel': {
        const e = S.actorEnt(th, 'leader');
        const a = S.actorSpec(th, 'leader');
        if (e && a) {
          S.dismissActor(th, 'leader');
          S.actor(th, { key: 'champion', kind: 'npc', role: 'champion', hostile: true, at: { x: Math.round(e.x), z: Math.round(e.z) }, person: a.person, orders: { target: pid, capture: true, brave: true, cry: 'Come on, then!' } });
        }
        th.vars.dueling = true;
        return { lines: ['(They draw.)'], close: true };
      }
      case 'sgg_noduel':
        heat(th, 2);
        recall(th, S);
        S.go(th, 'seethe');
        return { lines: ['Coward. We\'ll do it the other way, then.'], close: true };
      case 'sgg_pay': {
        const c = tributeOf(th, S);
        if (purse(S, pid) < c) return { lines: ['You haven\'t got it. Don\'t waste my time.'] };
        S.asPid(pid, (p) => removeItem(p.inv, 'coin', c));
        if (b) b.loot += c;
        S.person(pid).truce[b.id] = S.now + 7 * DAY;
        recall(th, S);
        th.vars.heat = 1;
        S.go(th, 'seethe');
        return { lines: ['Pleasure. A week, then. Then we\'ll talk again.'], close: true };
      }
      case 'sgg_nopay':
        heat(th, 2);
        recall(th, S);
        S.go(th, 'seethe');
        return { lines: ['Then you\'ll pay another way.'], close: true };
      default:
        return null;
    }
  },
});

function tributeOf(th, S) {
  return 30 + Math.round((th.vars.heat || 0) * 5);
}

// The letter, into your hands (or left for you).
function deliver(th, S, left) {
  if (th.vars.delivered) return;
  th.vars.delivered = true;
  const pid = targetPid(th);
  const m = th.vars.meet;
  S.give(pid, th.vars.noteKey, 1);
  if (left) S.tell(pid, 'A grubby child found you and pressed a sealed letter into your hand, then ran off. (Read it: F/RMB)', '#ffd890');
  // (Round 54) No meeting wanted: they're going, or they're paying.
  const b = bandOf(S, th);
  if (th.vars.scheme === 'gift' && b) {
    S.give(pid, 'coin', th.vars.gift);
    S.person(pid).truce[b.id] = S.now + 10 * DAY;
    th.vars.heat = 1;
    S.tell(pid, `There's a purse with the letter: ¤${th.vars.gift}. A truce with ${b.name}, for as long as you keep it.`, '#ffd890');
    S.note(th, `${b.name} sent ${nameOf(S, target(th))} a purse of ¤${th.vars.gift}: the price of peace.`, { news: [b.near] });
    return S.go(th, 'seethe');
  }
  if (th.vars.scheme === 'leave' && b) {
    if (th.vars.feint) {
      S.note(th, `${b.name} wrote that they were leaving the hills. They didn't.`, { hidden: true });
      heat(th, -Math.ceil((th.vars.heat || 0) / 2));
      return S.go(th, 'seethe');
    }
    S.sim.bandits.move(b, S.rng(th, 0x1ea), S.day);
    return S.end(th, 'left', `${b.name} wrote to ${nameOf(S, target(th))} that they'd had enough, and broke camp, and were gone from those hills by morning.`, { news: [b.near] });
  }
  const t = S.post(th, {
    role: 'meet', kind: 'meet', title: `Meet ${poss(nameOf(S, th.cast.band))} chief at the ${m.place}`, only: [pid], npc: false,
    at: { x: m.x, z: m.z }, r: 6, hand: 'auto', reward: { fame: 0 },
    pitch: 'Dusk tomorrow, it said.',
  });
  t.due = m.at + hours(4);
  t.pinLabel = `The ${m.place}`;
  S.accept(t, R.pl(pid));
  S.game.world.ow && S.asPid(pid, () => S.game.world.ow.pin(m.x, m.z, `The ${m.place}`, '?'));
}

// The trap is sprung: the chief and their guards draw, and more come out
// of the trees (to take you alive).
function spring(th, S, angry = false) {
  if (th.vars.sprung) return;
  th.vars.sprung = true;
  const b = bandOf(S, th);
  const pid = targetPid(th);
  const m = th.vars.meet;
  if (!b || !m) return;
  const rng = S.rng(th, 0x5b1);
  // The talkers become fighters where they stand.
  for (const a of th.actors.filter((q) => (q.role === 'leader' || q.role === 'guard') && !q.gone)) {
    const e = S.actorEnt(th, a.key);
    const at = e ? { x: Math.round(e.x), z: Math.round(e.z) } : a.at;
    S.dismissActor(th, a.key);
    S.actor(th, { key: `${a.key}f`, kind: 'npc', role: 'ambush', hostile: true, at, person: a.person, orders: { target: pid, capture: !angry || rng.chance(0.5), brave: a.role === 'leader' } });
  }
  // And the rest, out of the trees.
  const more = b.members.filter((q) => !q.out).slice(0, 3);
  more.forEach((q, i) => {
    q.out = true;
    (th.vars.escort ||= []).push(q.id);
    const ang = (i / 3) * Math.PI * 2;
    S.actor(th, { key: `a${q.id}`, kind: 'npc', role: 'ambush', hostile: true, at: { x: Math.round(m.x + Math.cos(ang) * 7), z: Math.round(m.z + Math.sin(ang) * 7) }, person: fromBandit(q, b), orders: { target: pid, capture: true, cry: 'Now! Take them!' } });
  });
  S.note(th, angry ? `The talk at the ${m.place} came to blades.` : `It was a trap: ${b.name} came out of the trees at the ${m.place}.`, { news: [b.near] });
  if (pid) S.tell(pid, angry ? 'They draw on you!' : 'It\'s a trap!', '#ff7060');
  th.vars.takeAlive = 0.8;
}

// Outlaws settle a grudge with someone not playing: an ambush on the road.
function ambushNpc(th, S, rng) {
  const b = bandOf(S, th);
  const tg = target(th);
  if (!b) return;
  const mine = S.strengthOf(R.band(b.id)) * 0.7;
  const theirs = S.strengthOf(tg);
  if (rng.chance(odds(mine, theirs))) {
    const killer = b.members[rng.int(0, b.members.length - 1)];
    const who = nameOf(S, tg);
    if (tg.t === 'adv') {
      S.sim.adventurers.died(tg.id, 'killed');
      S.emit('adv_died', { adv: tg.id, by: R.band(b.id), cause: `ambushed by ${b.name}` });
    } else if (tg.t === 'rec') {
      const L = layoutOf(S, tg.sid);
      const r = resolve(S, tg);
      if (L && r) S.sim.recordDeath(L, r, `ambushed by ${b.name}`, null);
    }
    const n = killer ? promote(S, b, killer.id, 'ambushed', who, th) : null;
    S.end(th, 'avenged', `${b.name} ambushed ${who} on the road. ${n ? `${n.name} struck the blow, and is called ${n.title} now.` : ''}`.trim(), { news: [b.near] });
  } else {
    const lost = b.members.splice(rng.int(0, b.members.length - 1), 1)[0];
    heat(th, 1);
    S.note(th, `${b.name} set on ${nameOf(S, tg)} on the road, and came off worse${lost ? `: ${lost.name.first} ${lost.name.last} was killed` : ''}.`, { news: [b.near] });
    if (!b.members.length) S.sim.bandits.wipedOut(b, S.day, nameOf(S, tg), tg);
  }
}

// ------------------------------------------------------------ a name in the stories
motif({
  id: 'legend',
  family: 'bandits',
  max: 10,
  key: (o) => o.vars.key,
  title: (th, S) => {
    const n = S.named[th.vars.key];
    return n ? `Wanted: ${n.name}, ${n.title}` : 'Wanted';
  },
  anchors: (th, S) => {
    const b = bandOf(S, th);
    return b && b.camp ? [{ x: b.camp.x, z: b.camp.z }] : [];
  },
  nodes: {
    wanted: {
      enter(th, S) {
        const n = S.named[th.vars.key];
        const b = bandOf(S, th);
        if (!n || !b) return S.end(th, 'faded');
        // (Round 54) Not every name is hunted: some are sung about, some
        // are too feared for anyone to post a price, and some want out.
        const rng = S.rng(th, 0x1e9);
        const m = b.members.find((q) => q.id === n.member);
        const P = (m && m.personality) || {};
        const victimPlayer = S.players().some((q) => nameOf(S, R.pl(q.pid)) === n.kills[n.kills.length - 1]);
        th.vars.how = th.vars.how || S.choose(th, [
          { to: 'wanted', w: 1.3 + (victimPlayer ? 0.8 : 0) },
          { to: 'hero', w: 0.3 + (P.kindness ?? 0.4) * 0.8 },
          { to: 'feared', w: 0.4 + n.kills.length * 0.15 },
          { to: 'turncoat', w: 0.15 + (P.kindness ?? 0.4) * 0.5 - (P.temper ?? 0.5) * 0.2 },
        ], rng).to;
        const how = th.vars.how;
        if (how === 'wanted') return postBounty(th, S);
        if (how === 'hero') {
          S.note(th, `${n.name} of ${b.name} is called ${n.title} now. But in the poorer streets of ${townName(S, b.near)} they say ${n.name} ${pick(rng, ['gave a merchant\'s purse to a widow', 'only robs those who can spare it', 'paid for a sick child\'s medicine', 'let a family keep their cow'])}. Nobody there will put a price on them.`, { news: [b.near] });
          if (rng.chance(0.5)) S.split(th, 'bard_song', { cast: { town: R.town(b.near) }, sid: b.near, vars: {} });
          return;
        }
        if (how === 'feared') {
          const L = layoutOf(S, b.near);
          const kin = L && living(L).find((r) => r.age !== 'child' && r.job !== 'mayor' && (r.mood ?? 0.5) < 0.4);
          S.note(th, `${n.name} of ${b.name} is called ${n.title} now. The council of ${townName(S, b.near)} won't post a price: they're afraid of what ${n.name} would do. They're paying to be left alone instead.`, { news: [b.near] });
          if (kin) {
            const t = S.post(th, {
              role: 'hunt', kind: 'hunt', title: `Bring down ${n.name}, ${n.title}`, sid: b.near, giver: R.rec(b.near, kin.idx),
              pitch: `The council's too frightened to do anything. I'm not. ${n.name} took ${n.kills[n.kills.length - 1] || 'someone I loved'} from me. I've saved a little. It's yours, if they die.`,
              at: b.camp ? { x: b.camp.x, z: b.camp.z } : null, r: 30, target: R.bandit(b.id, n.member),
              reward: { coins: 25 + n.kills.length * 10, from: R.rec(b.near, kin.idx), rep: 12, renown: b.near, renownPts: 5, renownWhy: `bringing down ${n.name}`, fame: 4, under: 3 },
            });
            t.offerLabel = 'You look like you\'ve lost someone.';
            t.glyph = 'x';
          }
          return;
        }
        // A turncoat: they want out, and send word.
        const at = b.camp ? spotNear(S, b.camp.x, b.camp.z, 30, 60, rng, { clear: 10 }) : null;
        if (!at) {
          th.vars.how = 'wanted';
          return postBounty(th, S);
        }
        th.vars.meetAt = at;
        th.vars.ruse = rng.chance(0.3 + (P.temper ?? 0.5) * 0.3);
        S.note(th, `${n.name} of ${b.name}, called ${n.title}, has sent word to ${townName(S, b.near)}: they want out. They'll talk to someone they can trust, alone, ${directions(town(S, b.near), at.x, at.z)}.`, { news: [b.near] });
        const t = S.post(th, {
          role: 'parley', kind: 'meet', title: `Meet ${n.name}, who wants out of ${b.name}`, sid: b.near, giver: null, at, r: 5,
          pitch: `Word came from the hills: ${n.name} wants to leave ${b.name}, and will talk to someone they can trust. It could be a trick. It could be a chance.`,
          reward: { coins: 0, fame: 1 },
        });
        t.rumour = `${n.name} of ${b.name} wants out`;
      },
      day(th, S, rng) {
        const n = S.named[th.vars.key];
        const b = bandOf(S, th);
        if (!n || !b) return S.end(th, 'faded');
        if (!b.members.some((m) => m.id === n.member)) return S.go(th, 'fallen', `${n.name} is dead.`);
        // A name grows: they take over, or go off with followers of their own.
        if (n.kills.length >= 3 && !th.vars.rose) {
          th.vars.rose = true;
          const i = b.members.findIndex((m) => m.id === n.member);
          if (i > 0 && rng.chance(0.6)) {
            const [m] = b.members.splice(i, 1);
            b.members.unshift(m);
            S.note(th, `${n.name} has taken ${b.name} for their own. The old chief is buried in the woods.`, { news: [b.near] });
          } else if (b.members.length >= 6) {
            const s = town(S, b.near);
            const nb = S.sim.bandits.form(s, rng, S.day);
            if (nb) {
              const half = b.members.splice(Math.ceil(b.members.length / 2));
              const lead = half.findIndex((m) => m.id === n.member);
              if (lead < 0) {
                const j = b.members.findIndex((m) => m.id === n.member);
                if (j >= 0) half.unshift(b.members.splice(j, 1)[0]);
              } else half.unshift(half.splice(lead, 1)[0]);
              nb.members.push(...half);
              nb.name = `${n.name.split(' ')[0]}'s ${pick(rng, ['Wolves', 'Knives', 'Crows', 'Hounds', 'Company'])}`;
              n.band = nb.id;
              th.cast.band = R.band(nb.id);
              S.note(th, `${n.name} has split from ${b.name} and taken half of them along: ${nb.name}, they call themselves now.`, { news: [b.near, nb.near] });
            }
          }
        }
      },
      on: {
        bandit_down(th, ev, S) {
          const n = S.named[th.vars.key];
          if (!n || ev.band !== n.band || (ev.member !== undefined && ev.member !== n.member)) return;
          if (ev.member === undefined) {
            const b = S.sim.bandits.get(n.band);
            if (b && b.members.some((m) => m.id === n.member)) return;
          }
          const t = S.tasksOf(th, 'hunt')[0];
          if (t && ev.by) S.complete(t, ev.by);
          if (ev.by && ev.by.t === 'pl') {
            const k = S.person(ev.by.pid);
            k.fame += 4;
            k.titles.push(`Slayer of ${n.name}`);
          }
          S.go(th, 'fallen', `${n.name}, ${n.title}, is dead${ev.by ? `, brought down by ${nameOf(S, ev.by)}` : ''}.`, { news: [n.band !== undefined && S.sim.bandits.bands.find((q) => q.id === n.band) ? S.sim.bandits.bands.find((q) => q.id === n.band).near : th.sid] });
        },
        legend_grew(th, ev, S) {
          if (ev.key !== th.vars.key) return;
          const n = S.named[th.vars.key];
          // (A folk hero who kills again, or a turncoat who doesn't turn:
          // a price on them after all.)
          if (n && th.vars.how && th.vars.how !== 'wanted' && th.vars.how !== 'feared') {
            th.vars.how = 'wanted';
            for (const q of S.tasksOf(th, 'parley')) S.closeTask(q, 'void');
            S.note(th, `After what ${n.name} did to ${ev.victim}, nobody sings about them any more.`);
            postBounty(th, S);
            return;
          }
          const t = S.tasksOf(th, 'hunt')[0];
          if (n && t) {
            t.reward.coins = 60 + n.kills.length * 30;
            t.title = `Bring down ${n.name}, ${n.title} (¤${t.reward.coins})`;
          }
          if (n) S.note(th, `${n.name} has ${ev.deed} ${ev.victim} too.`, { news: [th.sid] });
        },
        band_gone(th, ev, S) {
          const n = S.named[th.vars.key];
          if (!n || ev.band !== n.band) return;
          const t = S.tasksOf(th, 'hunt')[0];
          if (t && ev.by) S.complete(t, ev.by);
          S.go(th, 'fallen', `${n.name} fell with the rest of ${ev.name}.`);
        },
      },
      fade: 40,
    },
    fallen: {
      enter(th, S) {
        const n = S.named[th.vars.key];
        if (n) n.dead = true;
      },
      final: true,
    },
  },
  tasks: {
    // A turncoat, waiting where they said.
    parley: {
      reach(th, t, pid, S) {
        if (th.vars.met) return;
        const n = S.named[th.vars.key];
        const b = bandOf(S, th);
        const m = b && n ? b.members.find((q) => q.id === n.member) : null;
        if (!m) return S.closeTask(t, 'void');
        th.vars.met = pid;
        m.out = true;
        const at = th.vars.meetAt;
        if (th.vars.ruse) {
          // (It was a trick.)
          S.closeTask(t, 'failed');
          const rng = S.rng(th, 0x7e9);
          S.actor(th, { key: 'named', kind: 'npc', role: 'ambush', hostile: true, at, person: fromBandit(m, b), orders: { target: pid, capture: rng.chance(0.5), brave: true, cry: 'Trust! Ha!' } });
          b.members.filter((q) => !q.out && q !== m).slice(0, 2).forEach((q, i) => {
            q.out = true;
            S.actor(th, { key: `amb${i}`, kind: 'npc', role: 'ambush', hostile: true, at: { x: at.x + 6 - i * 12, z: at.z + 5 }, person: fromBandit(q, b), orders: { target: pid, capture: true } });
          });
          S.tell(pid, 'It\'s a trap!', '#ff7060');
          th.vars.how = 'wanted';
          return postBounty(th, S);
        }
        S.actor(th, { key: 'named', kind: 'npc', role: 'turncoat', talk: true, at, stay: true, person: fromBandit(m, b), orders: { home: at, outlaw: true, markFor: pid, mark: 'talk', lines: ['Keep your voice down.', 'Were you followed?', 'I\'m done with them. Done.'] } });
        S.closeTask(t, 'done', R.pl(pid));
      },
    },
    hunt: {
      npcs: { adv: 0.12, guard: 0.08 },
      npcPace: 0.3,
      npcTry(th, t, who, S, rng) {
        const n = S.named[th.vars.key];
        const b = n ? S.sim.bandits.get(n.band) : null;
        if (!n || !b || !rng.chance(0.4)) return;
        if (rng.chance(odds(S.strengthOf(who), n.power + S.strengthOf(R.band(b.id)) * 0.3))) {
          const m = b.members.find((q) => q.id === n.member);
          b.members = b.members.filter((q) => q !== m);
          S.emit('bandit_down', { band: b.id, member: n.member, n: 1, by: who, name: n.name, title: n.title });
          if (!b.members.length) S.sim.bandits.wipedOut(b, S.day, nameOf(S, who), who);
        } else {
          const tgt = nameOf(S, who);
          if (who.t === 'adv' && rng.chance(0.35)) {
            S.sim.adventurers.died(who.id, 'killed');
            n.kills.push(tgt);
            n.power += 0.4;
            S.emit('adv_died', { adv: who.id, by: R.named(n.key), cause: `killed by ${n.name}` });
            S.emit('legend_grew', { key: n.key, deed: 'killed', victim: tgt });
          } else S.note(th, `${NameOf(S, who)} went after ${n.name} and came back empty-handed.`);
          S.drop(t, who);
        }
      },
      offer: (th, t, pid, S) => [`They're with ${nameOf(S, th.cast.band)}, ${S.whereTask(t, th.sid)}.`],
      thanks: () => ['They\'re really dead? The roads will be safer. The realm keeps its word: here.'],
    },
  },
  hello(th, a) {
    return a.role === 'turncoat' ? 'You came. Good. Listen, before anyone sees us.' : '...';
  },
  talk(th, a, npc, pid) {
    if (a.role !== 'turncoat' || th.vars.met !== pid) return [];
    return [
      { id: 'sgx2_yield', arg: `t${th.id}`, label: 'Come with me to the town. Give yourself up, and I\'ll speak for you.' },
      { id: 'sgx2_tell', arg: `t${th.id}`, label: 'Tell me where your band keeps its loot, and go where you like.' },
      { id: 'sgx2_kill', arg: `t${th.id}`, label: '(Draw your blade.) You don\'t get to just walk away.' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const n = S.named[th.vars.key];
    const b = bandOf(S, th);
    if (!n || !b) return null;
    const m = b.members.find((q) => q.id === n.member);
    const rng = S.rng(th, 0x7ea);
    const leave = () => {
      if (m) b.members = b.members.filter((q) => q !== m);
      n.dead = true;
      n.gone = true;
      S.dismissActor(th, 'named');
      if (!b.members.length) S.sim.bandits.wipedOut(b, S.day, nameOf(S, R.pl(pid)), R.pl(pid));
    };
    if (id === 'sgx2_yield') {
      leave();
      const s = town(S, b.near);
      const pardoned = rng.chance(0.55);
      S.person(pid).fame += 2;
      S.give(pid, 'coin', 30);
      S.end(th, pardoned ? 'pardoned' : 'surrendered', pardoned
        ? `${n.name}, ${n.title}, walked into ${s ? s.name : 'town'} beside ${nameOf(S, R.pl(pid))} and gave themself up. The council, to everyone's surprise, let them work off their crimes on the walls.`
        : `${n.name}, ${n.title}, gave themself up to ${nameOf(S, R.pl(pid))}, and was taken to the realm's justice. ${b.name} have sworn to find whoever turned them.`, { news: [b.near] });
      return { lines: ['...All right. All right. I\'m tired. Walk with me, so nobody puts an arrow in me on the way.'], close: true };
    }
    if (id === 'sgx2_tell') {
      const loot = Math.max(0, Math.round((b.loot || 0) * 0.6));
      b.loot = Math.max(0, (b.loot || 0) - loot);
      leave();
      S.give(pid, 'coin', loot);
      S.person(pid).under += 2;
      S.end(th, 'turned', `${n.name}, ${n.title}, sold out ${b.name}'s hoard to ${nameOf(S, R.pl(pid))} and vanished down the coast road. ${b.name} are tearing the hills apart looking for them.`, { news: [b.near] });
      return { lines: [`Under the third stone from the fire-pit. ¤${loot}, near enough. I'll be over the water by tomorrow. Don't look for me.`, '(You find the hoard where they said.)'], close: true };
    }
    if (id === 'sgx2_kill') {
      const e = S.actorEnt(th, 'named');
      const at = e ? { x: Math.round(e.x), z: Math.round(e.z) } : th.vars.meetAt;
      S.dismissActor(th, 'named');
      S.actor(th, { key: 'namedf', kind: 'npc', role: 'ambush', hostile: true, at, person: fromBandit(m, b), orders: { target: pid, brave: true, cry: 'So much for trust!' } });
      return { lines: ['I should have known.'], close: true };
    }
    return null;
  },
});

// The price on a name: the town's mayor, and the realm.
function postBounty(th, S) {
  const n = S.named[th.vars.key];
  const b = bandOf(S, th);
  if (!n || !b) return;
  const L = layoutOf(S, b.near);
  const m = L ? mayorOf(L) : null;
  const pay = 60 + n.kills.length * 30;
  const t = S.post(th, {
    role: 'hunt', kind: 'hunt', title: `Bring down ${n.name}, ${n.title}`, sid: b.near, giver: m ? R.rec(b.near, m.idx) : null,
    pitch: `${n.name} rides with ${b.name}. They call them ${n.title} now, for ${n.kills[n.kills.length - 1] ? `what they did to ${n.kills[n.kills.length - 1]}` : 'what they\'ve done'}. The realm will pay ¤${pay} to see them dead.`,
    at: b.camp ? { x: b.camp.x, z: b.camp.z } : null, r: 30, target: R.bandit(b.id, n.member),
    reward: { coins: pay, from: R.town(b.near), rep: 6, renown: b.near, renownPts: 5, renownWhy: `bringing down ${n.name}`, fame: 4, under: 3 },
  });
  t.rumour = `There's a price of ¤${pay} on ${n.name}, ${n.title}`;
  t.glyph = 'x';
  const civ = town(S, b.near)?.civ;
  if (civ && S.sim.realms.proclaim) S.sim.realms.proclaim(civ, S.day, `A price of ¤${pay} has been set on the outlaw ${n.name}, called ${n.title}.`);
  S.note(th, `${n.name} of ${b.name} is called ${n.title} now. There's a price on their head.`, { news: [b.near] });
}

// ------------------------------------------------------------ a windfall
const TREASURE = (k) => k === 'kav_core' || (ITEMS[k] && (ITEMS[k].kind === 'relic' || ITEMS[k].kav));

motif({
  id: 'windfall',
  family: 'bandits',
  max: 6,
  key: (o) => `${o.cast.band.id}`,
  title: (th, S) => `${poss(NameOf(S, th.cast.band))} Windfall`,
  seeds: [
    // Off someone in their cage.
    { on: 'captive_loot', make: (ev, S) => {
      const got = (ev.items || []).filter((it) => TREASURE(it.item));
      if (!got.length) return null;
      const b = S.sim.bandits.get(ev.band);
      return b ? { cast: { band: R.band(b.id) }, sid: b.near, vars: { items: got.map((it) => it.item), from: ev.owner } } : null;
    } },
    // Off a merchant on the road, now and then: a core someone was carrying
    // to the capital.
    { on: 'robbery', make: (ev, S) => {
      if (Math.random() > 0.06) return null;
      const b = S.sim.bandits.get(ev.band);
      if (!b) return null;
      stash(S, b, [{ item: 'kav_core', count: 1 }]);
      return { cast: { band: R.band(b.id) }, sid: b.near, vars: { items: ['kav_core'], road: true } };
    } },
  ],
  anchors: (th, S) => {
    const b = bandOf(S, th);
    return b && b.camp ? [{ x: b.camp.x, z: b.camp.z }] : [];
  },
  nodes: {
    armed: {
      enter(th, S) {
        const b = bandOf(S, th);
        if (!b) return S.end(th, 'faded');
        const rng = S.rng(th, 0xa7d);
        const items = th.vars.items || [];
        b.windfall = { items, since: S.now };
        // Kavorent arms: the chief takes the best of them (out of the box).
        const arms = items.filter((k) => ITEMS[k] && ITEMS[k].kind === 'weapon');
        const chief = chiefOf(b);
        if (arms.length && chief) {
          const k = arms[0];
          const box = stashOf(b);
          const i = box.findIndex((it) => it.item === k);
          if (i >= 0) box.splice(i, 1);
          chief.weapon = k;
          chief.armor = Math.max(chief.armor ?? 0.1, 0.3);
        }
        // A core or a relic: they've found uses for it (and armed themselves
        // with what it fetched).
        for (const m of b.members) {
          m.armor = Math.max(m.armor ?? 0.1, 0.2);
          m.maxHp += 4;
          m.hp = m.maxHp;
          if (rng.chance(0.4) && ITEMS.iron_sword) m.weapon = rng.pick(['iron_sword', 'battle_axe', 'spear'].filter((k) => ITEMS[k]));
        }
        const what = items.map((k) => (ITEMS[k] ? ITEMS[k].name : k));
        const s = town(S, b.near);
        S.note(th, `${b.name} have come by ${what.slice(0, 2).join(' and ')}${th.vars.road ? ' off a merchant on the road' : ''}. They're better armed than any band in the hills now.`, { news: [b.near] });
        // The realms want it back.
        const civ = s && s.civ;
        const cap = civ && S.sim.realms.capitalOf ? S.sim.realms.capitalOf(civ) : null;
        const homeSid = cap ? cap.id : b.near;
        const L = layoutOf(S, homeSid) || layoutOf(S, b.near);
        const asker = L ? L.npcs.find((r) => alive(r) && r.job === 'scholar') || mayorOf(L) : null;
        const prize = items.find((k) => k === 'kav_core' || (ITEMS[k] && ITEMS[k].kind === 'relic')) || items[0];
        const pay = Math.round(((ITEMS[prize] && ITEMS[prize].value) || 200) * 0.45);
        const t = S.post(th, {
          role: 'recover', kind: 'retrieve', title: `Recover the ${ITEMS[prize] ? ITEMS[prize].name : 'treasure'} from ${b.name}`,
          sid: L ? L.settlement.id : b.near, giver: asker ? R.rec(L.settlement.id, asker.idx) : null, item: prize, n: 1,
          pitch: `${b.name} have a ${ITEMS[prize] ? ITEMS[prize].name : 'treasure'}. In the hands of outlaws it's a danger to every town in the realm. Bring it to me, and the realm will pay ¤${pay}.`,
          at: b.camp ? { x: b.camp.x, z: b.camp.z } : null, r: 30, reward: { coins: pay, from: R.town(L ? L.settlement.id : b.near), rep: 10, fame: 3 },
        });
        t.rumour = `${b.name} have a Kavorent treasure, and the realm wants it`;
        // (And a rival realm wants it more.)
        const rival = (S.game.world.ow.civs || []).find((c) => c !== civ && civ && S.sim.realms.standing && S.sim.realms.standing(civ, c) === 'hostile');
        const rcap = rival && S.sim.realms.capitalOf ? S.sim.realms.capitalOf(rival) : null;
        const RL = rcap ? layoutOf(S, rcap.id) : null;
        const rm = RL ? mayorOf(RL) : null;
        if (rm) {
          const t2 = S.post(th, {
            role: 'recover', kind: 'retrieve', title: `Bring the ${ITEMS[prize] ? ITEMS[prize].name : 'treasure'} to ${rival.name.replace(/^The /, 'the ')}`,
            sid: RL.settlement.id, giver: R.rec(RL.settlement.id, rm.idx), item: prize, n: 1,
            pitch: `We hear ${b.name} took a ${ITEMS[prize] ? ITEMS[prize].name : 'treasure'}. Our neighbours want it. We want it more: ¤${Math.round(pay * 1.4)}, and nobody need know where it went.`,
            at: t.at, r: 30, reward: { coins: Math.round(pay * 1.4), from: R.town(RL.settlement.id), rep: 6, fame: 1 },
          });
          t2.data.rival = true;
          t2.rumour = `${rival.name.replace(/^The /, 'the ')} would pay well for a certain Kavorent treasure`;
        }
      },
      day(th, S, rng) {
        const b = bandOf(S, th);
        if (!b) return;
        // Held long enough, they dig in round it.
        if (S.now - b.windfall.since > 5 * DAY && (b.outpost || 0) < 3 && rng.chance(0.4)) {
          const lv = fortify(S, b, (b.outpost || 0) + 1);
          S.note(th, `${b.name} are building round their prize: ${lv >= 3 ? 'a stronghold now' : 'a palisade'}.`, { news: [b.near] });
          if (lv >= 3) S.spawn(th, 'stronghold', { cast: { band: R.band(b.id), town: R.town(b.near) }, sid: b.near });
        }
      },
      on: {
        band_gone(th, ev, S) {
          if (ev.band !== th.cast.band.id) return;
          S.note(th, `${ev.name} are gone. Whatever they had is there for the taking.`);
          th.vars.loose = true;
        },
      },
      fade: 30,
    },
  },
  tasks: {
    recover: {
      npcs: { adv: 0.2, guard: 0 },
      // Handed over (see talk.js: it's in your pack).
      done(th, t, by, S) {
        for (const o of S.tasksOf(th, 'recover')) {
          if (o === t) continue;
          S.closeTask(o, 'failed', by);
          if (by && by.t === 'pl' && o.data.rival !== t.data.rival) S.note(th, `${nameOf(S, by)} took it to ${t.data.rival ? 'the rival realm' : 'the realm'}. ${o.giverName || 'The others'} won't forget it.`);
        }
        S.end(th, 'recovered');
      },
      offer: (th, t, pid, S) => [`${nameOf(S, th.cast.band)} are ${S.whereTask(t, t.sid)}.`],
      thanks: () => ['Thank you. You don\'t know what you\'ve spared us.'],
    },
  },
});

// ------------------------------------------------------------ a stronghold
motif({
  id: 'stronghold',
  family: 'bandits',
  max: 4,
  key: (o) => `${o.cast.band.id}`,
  title: (th, S) => `The Siege of ${nameOf(S, th.cast.band)}`,
  anchors: (th, S) => {
    const b = bandOf(S, th);
    return b && b.camp ? [{ x: b.camp.x, z: b.camp.z }] : [];
  },
  nodes: {
    muster: {
      enter(th, S) {
        const b = bandOf(S, th);
        if (!b || !b.camp) return S.end(th, 'faded');
        const L = layoutOf(S, b.near);
        const m = L ? mayorOf(L) : null;
        th.vars.at = (S.day + 1) * DAY + 12 * 60;
        th.vars.round = (th.vars.round || 0) + 1;
        const t = S.post(th, {
          role: 'assault', kind: 'defend', title: `Join the assault on ${poss(b.name)} stronghold (noon, day ${S.day + 1})`, sid: b.near,
          giver: m ? R.rec(b.near, m.idx) : null, at: b.camp.wall ? { x: b.camp.wall.gate.x, z: b.camp.wall.gate.z + 4 } : { x: b.camp.x, z: b.camp.z }, r: 40,
          pitch: `${b.name} have walled themselves in out there. The realm is sending soldiers at noon tomorrow to take it. Every blade counts: be there, and fight.`,
          reward: { coins: 30 + b.members.length * 5, from: R.town(b.near), rep: 6, renown: b.near, renownPts: 4, fame: 3 },
        });
        t.rumour = `Soldiers are going to storm ${poss(b.name)} stronghold`;
        S.note(th, `The realm is mustering soldiers to storm ${poss(b.name)} stronghold at noon on day ${S.day + 1}.`, { news: [b.near] });
      },
      hour(th, S) {
        if (S.now >= th.vars.at && !th.vars.went) attack(th, S);
      },
      day(th, S) {
        if (S.now >= th.vars.at && !th.vars.went) attack(th, S);
      },
      live(th, S) {
        if (!th.vars.went || th.vars.over) return;
        const left = th.actors.filter((a) => a.role === 'posse' && !a.gone && !a.dead);
        const b = bandOf(S, th);
        if (!left.length && b) {
          th.vars.over = true;
          failed(th, S);
        }
      },
      on: {
        band_gone(th, ev, S) {
          if (ev.band !== th.cast.band.id) return;
          const t = S.tasksOf(th, 'assault')[0];
          const here = th.vars.went ? S.players().filter(({ p }) => t && t.at && Math.max(Math.abs(p.x - t.at.x), Math.abs(p.z - t.at.z)) <= 50) : [];
          if (t) {
            if (here.length) S.complete(t, R.pl(here[0].pid));
            else S.closeTask(t, 'done', R.town(th.sid));
          }
          for (const a of th.actors) if (a.role === 'posse') S.dismissActor(th, a.key);
          S.end(th, 'taken', `${poss(ev.name)} stronghold has fallen.`, { news: [th.sid] });
        },
      },
      fade: 20,
    },
    tribute: {
      enter(th, S) {
        S.note(th, `${NameOf(S, th.cast.band)} beat off the realm's soldiers. Now the towns about pay them to be left alone.`, { news: [th.sid] });
      },
      day(th, S, rng) {
        const b = bandOf(S, th);
        if (!b) return S.end(th, 'over');
        for (const L of S.sim.bandits.nearTowns(b, 8).slice(0, 2)) {
          const take = Math.min(30, Math.floor(L.econ.treasury * 0.08));
          if (take <= 0) continue;
          L.econ.treasury -= take;
          b.loot += take;
          if (rng.chance(0.3)) ledger(L, S.day, `The council paid ${b.name} ¤${take} to keep off the roads this week.`);
        }
        if (S.now - th.nodeAt > 5 * DAY && rng.chance(0.4)) S.go(th, 'muster');
      },
      on: {
        band_gone(th, ev, S) {
          if (ev.band === th.cast.band.id) S.end(th, 'taken', `${ev.name} are gone, and the towns pay nobody now.`);
        },
      },
    },
  },
  tasks: { assault: {} },
});

// Noon: the soldiers march.
function attack(th, S) {
  th.vars.went = true;
  const b = bandOf(S, th);
  if (!b || !b.camp) return;
  const rng = S.rng(th, 0xa77);
  const s = town(S, b.near);
  const n = 5 + Math.min(4, th.vars.round || 1);
  const t = S.tasksOf(th, 'assault')[0];
  const gate = b.camp.wall ? b.camp.wall.gate : { x: b.camp.x, z: b.camp.z + 6 };
  if (S.nearest([gate]) <= 70) {
    // In front of you: they come up the road and storm it.
    const from = spotNear(S, gate.x, gate.z + 30, 0, 10, rng, { clear: 0, flat: 0 }) || { x: gate.x, z: gate.z + 30 };
    for (let i = 0; i < n; i++) {
      S.actor(th, { key: `s${i}`, kind: 'npc', role: 'posse', hostile: false, stay: true, at: { x: from.x + (i % 3) - 1, z: from.z + Math.floor(i / 3) }, person: makePerson(rng, s ? s.style : 'vale', 'soldier'), orders: { goal: { x: b.camp.fire.x, z: b.camp.fire.z } } });
    }
    S.note(th, 'The soldiers marched on the stronghold at noon.');
    return;
  }
  // Out of sight: settled the plain way.
  const mine = n * 1.2 + (t ? t.claims.filter((c) => c.who.t !== 'pl').length * 1.4 : 0);
  if (rng.chance(odds(mine, S.strengthOf(R.band(b.id)) * 1.3))) {
    S.sim.bandits.wipedOut(b, S.day, `the soldiers of ${s ? s.name : 'the realm'}`, R.town(b.near));
  } else failed(th, S);
}

function failed(th, S) {
  const b = bandOf(S, th);
  const t = S.tasksOf(th, 'assault')[0];
  if (t) S.closeTask(t, 'failed');
  for (const a of th.actors) if (a.role === 'posse') S.dismissActor(th, a.key);
  if (b) {
    b.members.push(S.sim.bandits.outlaw(S.rng(th, 0xf41), town(S, b.near)?.style || 'vale'));
    S.note(th, `The assault on ${poss(b.name)} stronghold failed. Soldiers lie dead before their gate.`, { news: [b.near] });
  }
  th.vars.went = false;
  th.vars.over = false;
  S.go(th, 'tribute');
}

// ------------------------------------------------------------ riding with them
const JOBS = ['shakedown', 'fence', 'scout'];

motif({
  id: 'outlaw_work',
  family: 'bandits',
  max: 6,
  key: (o) => refKey(o.cast.member),
  title: (th, S) => `Riding with ${NameOf(S, th.cast.band)}`,
  anchors: (th, S) => {
    const b = bandOf(S, th);
    return b && b.camp ? [{ x: b.camp.x, z: b.camp.z }] : [];
  },
  nodes: {
    riding: {
      enter(th, S) {
        const b = bandOf(S, th);
        if (!b || !b.camp) return S.end(th, 'faded');
        const pid = th.cast.member.pid;
        const rng = S.rng(th, 0x0f7);
        const P = campPlan(b);
        S.actor(th, {
          key: 'fence', kind: 'npc', role: 'quartermaster', talk: true, at: { x: P.x1 + 2, z: P.z + 2 }, stay: false,
          person: makePerson(rng, town(S, b.near)?.style, 'outlaw'),
          orders: { home: { x: P.x1 + 2, z: P.z + 2 }, outlaw: true, markFor: pid, mark: 'talk', lines: ['Got work, if you want it.', 'Chief says you\'re one of us now.'] },
        });
        S.note(th, `${nameOf(S, th.cast.member)} rides with ${b.name} now.`);
      },
      on: {
        bandit_down(th, ev, S) {
          const pid = th.cast.member.pid;
          if (ev.band !== th.cast.band.id || !ev.by || ev.by.t !== 'pl' || ev.by.pid !== pid) return;
          const k = S.person(pid);
          k.joined = null;
          S.dismissActor(th, 'fence');
          S.spawn(th, 'grudge', { cast: { band: th.cast.band, target: R.pl(pid) }, sid: th.sid, vars: { heat: 9, why: 'betrayal' } });
          S.end(th, 'betrayed', `${nameOf(S, R.pl(pid))} turned on ${nameOf(S, th.cast.band)}.`, { news: [th.sid] });
        },
        band_gone(th, ev, S) {
          if (ev.band !== th.cast.band.id) return;
          S.person(th.cast.member.pid).joined = null;
          S.end(th, 'over', `${ev.name} are gone. ${nameOf(S, th.cast.member)} rides alone again.`);
        },
      },
      fade: 60,
    },
  },
  tasks: {
    job: {
      // A job done, wherever it was: back to the quartermaster for the share.
      reach(th, t, pid, S) {
        if (t.data.job !== 'scout') return;
        const night = S.game.minute >= 1260 || S.game.minute < 300;
        if (!night) {
          if (!t.data.told) {
            t.data.told = true;
            S.tell(pid, 'Come back after dark: the watch is too busy by day.', '#c8c8c8');
          }
          return;
        }
        t.data.seen = true;
        S.complete(t, R.pl(pid));
      },
      done(th, t, by, S) {
        const b = bandOf(S, th);
        const pid = th.cast.member.pid;
        const k = S.person(pid);
        k.under += 2;
        th.vars.jobs = (th.vars.jobs || 0) + 1;
        if (t.data.job === 'scout' && b) {
          const L = layoutOf(S, t.data.sid);
          if (L) {
            const r = S.sim.bandits.raid(b, S.day, S.rng(th, 0x5c0));
            if (r && r.won) {
              const share = Math.round((r.take || 0) * 0.3);
              S.give(pid, 'coin', share);
              S.tell(pid, `${b.name} raided ${L.settlement.name} on what you told them. Your share: ¤${share}.`, '#ffd890');
            }
          }
        }
        if (th.vars.jobs === 3 && b) {
          k.titles.push(`Right Hand of ${b.name}`);
          S.note(th, `${b.name} call ${nameOf(S, by)} their right hand now.`, { news: [b.near] });
        }
      },
    },
  },
  hello(th, a, npc, pid, S) {
    if (pid !== th.cast.member.pid) return 'Who let you in here?';
    return S.tasksOf(th, 'job').length ? 'Well? Is it done?' : 'There you are. Work, if you want it.';
  },
  talk(th, a, npc, pid, S) {
    if (pid !== th.cast.member.pid) return [];
    const tid = `t${th.id}`;
    const open = S.tasksOf(th, 'job')[0];
    const out = [];
    if (!open) out.push({ id: 'sgw_job', arg: tid, label: 'What needs doing?' });
    else if (open.status === 'open') out.push({ id: 'sgw_how', arg: tid, label: `About the job: ${lcFirst(open.title)}...` });
    out.push({ id: 'sgw_leave', arg: tid, label: 'I\'m done riding with you.' });
    return out;
  },
  townTalk(th, npc, pid, S) {
    if (pid !== th.cast.member.pid) return [];
    const out = [];
    for (const t of S.tasksOf(th, 'job')) {
      if (!t.target || t.target.t !== 'rec' || t.target.sid !== npc.rec.sid || t.target.idx !== npc.rec.idx) continue;
      if (t.data.job === 'shakedown') out.push({ id: 'sgw_collect', arg: `t${th.id}:${t.id}`, label: `${nameOf(S, th.cast.band)} send their regards. Pay up.` });
      if (t.data.job === 'fence') out.push({ id: 'sgw_fence', arg: `t${th.id}:${t.id}`, label: 'I hear you buy things. No questions asked.' });
    }
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const b = bandOf(S, th);
    const rng = S.rng(th, 0x70b);
    const tidOf = () => +String(arg).split(':')[1];
    switch (id) {
      case 'sgw_job': {
        if (!b) return { lines: ['There\'s no band left to work for.'] };
        const job = pick(rng, JOBS);
        const towns = S.sim.bandits.nearTowns(b, 12);
        const L = towns.length ? pick(rng, towns) : null;
        if (!L) return { lines: ['Nothing today.'] };
        const ppl = living(L).filter((r) => r.age === 'adult');
        const mark = job === 'fence' ? ppl.find((r) => r.job === 'merchant' || (r.life && r.life.vice === 'thief')) || ppl[0] : ppl.find((r) => ['merchant', 'baker', 'tailor', 'blacksmith', 'innkeeper'].includes(r.job)) || ppl[0];
        if (!mark) return { lines: ['Nothing today.'] };
        const owe = rng.int(15, 40);
        const spec = {
          shakedown: { title: `Collect ¤${owe} from ${fullName(mark)} in ${L.settlement.name}`, line: `${fullName(mark)} in ${L.settlement.name} hasn't paid us this month. ¤${owe}. Go and remind them. Keep a third.` },
          fence: { title: `Sell the stolen goods to ${fullName(mark)} in ${L.settlement.name}`, line: `Take these to ${fullName(mark)} in ${L.settlement.name}. They know what to do with them. Half's yours.` },
          scout: { title: `Scout ${L.settlement.name}'s watch by night`, line: `Walk through ${L.settlement.name} after dark. Count the watch, see where the strongbox is. Then we'll pay them a visit.` },
        }[job];
        const t = S.post(th, {
          role: 'job', kind: job === 'scout' ? 'meet' : 'talk', title: spec.title, only: [pid], npc: false, hand: 'auto',
          target: job === 'scout' ? null : R.rec(L.settlement.id, mark.idx), at: job === 'scout' ? { x: L.plaza.cx, z: L.plaza.cz } : null, r: 6,
          data: { job, owe, sid: L.settlement.id }, reward: { fame: 0, under: 1 },
        });
        S.accept(t, R.pl(pid));
        if (job === 'fence') S.give(pid, 'stolen_goods', 2);
        return { lines: [spec.line] };
      }
      case 'sgw_how': {
        const t = S.tasksOf(th, 'job')[0];
        return { lines: [t ? `${t.title}. Well? Get on with it.` : 'Nothing doing.'] };
      }
      case 'sgw_leave': {
        S.person(pid).joined = null;
        S.dismissActor(th, 'fence');
        const sore = rng.chance(0.4);
        if (sore && b) S.spawn(th, 'grudge', { cast: { band: th.cast.band, target: R.pl(pid) }, sid: th.sid, vars: { heat: 4, why: 'desertion' } });
        S.end(th, 'left', `${nameOf(S, R.pl(pid))} left ${b ? b.name : 'the band'}.`);
        return { lines: [sore ? 'Nobody walks away from us. You\'ll see.' : 'Suit yourself. Keep your mouth shut about us, and we\'ll keep ours.'], close: true };
      }
      case 'sgw_collect': {
        const t = S.task(tidOf());
        if (!t || t.status !== 'open') return { lines: ['What?'] };
        const r = resolve(S, t.target);
        const paid = r ? Math.min(t.data.owe, Math.floor(r.coins || 0)) : 0;
        if (r) r.coins -= paid;
        const share = Math.round(paid / 3);
        if (b) b.loot += paid - share;
        S.give(pid, 'coin', share);
        S.game.sim.changeRep(npc, -15);
        S.townSay(pid, t.data.sid, -3, false);
        S.complete(t, R.pl(pid));
        return { lines: [paid ? `All right! All right. Here. ¤${paid}. Tell them I paid.` : 'I haven\'t got it! I swear!', `(You keep ¤${share}.)`] };
      }
      case 'sgw_fence': {
        const t = S.task(tidOf());
        if (!t || t.status !== 'open') return { lines: ['What?'] };
        const p = S.game.player;
        if (countItem(p.inv, 'stolen_goods') < 2) return { lines: ['Where\'s the goods, then?'] };
        removeItem(p.inv, 'stolen_goods', 2);
        const pay = 30 + rng.int(0, 20);
        S.give(pid, 'coin', Math.round(pay / 2));
        if (b) b.loot += Math.round(pay / 2);
        S.complete(t, R.pl(pid));
        return { lines: ['Lovely. Lovely. You never saw me.', `(¤${Math.round(pay / 2)} is yours.)`] };
      }
      default:
        return null;
    }
  },
});

export { recall, sendHunters, TREASURE };
