// (Round 144) You in command, in a battle or at a siege (see bands.js for
// the bands and the commander's own thinking; ui/command.js for the war
// table you give the orders from).
//
// Who commands:
//   - the ruler of a realm in the fight: its host (its marshal);
//   - the head of a town: its levy as one of the host's captains; the whole
//     host, when it's their own town that's fought over (and no ruler of
//     theirs is there);
//   - a captain the realm's named (for a banner taken up and the day won;
//     or by the ruler's word): a band of their own;
//   - and anyone who takes up a band's fallen banner, there and then: that
//     band, till it's over.
// Everyone else of the realm who's called up fights in a band (the one
// nearest them when it begins), under its captain's orders.
//
// Orders are given in the moment: the battle never stops for them. A band
// you've given an order keeps to it till you give another, or leave it to
// its captain again; what you've not taken in hand, the realm's own
// commander (the marshal: see bands.js) sees to, by the plan, which you can
// change as it goes.
import { orderBand, bandOf, ORDERS, standing, centroid, nearestBand, bandUp } from './bands.js';

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'free folk');

// A player's own key (the host's, or a guest's seat).
export const pkOf = (p) => `p:${p && p.seat && !p.seat.host ? p.seat.id : 'host'}`;

// Who `p` is in a battle on side `sd`: 'marshal', 'captain' or 'soldier'.
export function rankFor(war, live, p, sd) {
  const g = war.game;
  const sim = war.sim;
  const S = live.sides[sd];
  const civ = S && S.civ;
  if (!civ) return 'soldier';
  return g.asPlayer(p, () => {
    // (The ruler of the side's realm, or of a realm fighting beside it.)
    const crown = sim.crown;
    const w = live.w;
    const ids = w ? w[sd] || [civ.id] : [civ.id];
    if (crown && ids.some((id) => war.civ(id) && crown.isRuler(war.civ(id)))) return 'marshal';
    // (The head of a town on this side: its own town fought over, the host;
    // else their levy.)
    const T = sim.office && sim.office.heldBy(sim.office.pid());
    const ts = T ? war.ow.settlements[T.sid] : null;
    if (ts && ts.civ && ids.includes(ts.civ.id)) {
      const plan = live.plan || {};
      const here = ts.id === plan.def || ts.id === plan.atk || (live.siege && live.siege.sid === ts.id);
      return here ? 'marshal' : 'captain';
    }
    const r = war.ranks && war.ranks[civ.id] && war.ranks[civ.id][pkOf(p)];
    return r || 'soldier';
  });
}

// When a battle begins: each of you on a side given your place in it (the
// host to command, a band to lead, a band to fight in).
export function assignCommand(war, live) {
  const g = war.game;
  live.cmd = {};
  live.ranks = new Map();
  for (const [p, sd] of live.pside) {
    const S = live.sides[sd];
    if (!S || !S.bands || !S.bands.length) continue;
    const pk = pkOf(p);
    let rank = rankFor(war, live, p, sd);
    if (rank === 'marshal' && live.cmd[sd]) rank = 'captain';
    const tell = (text) => g.asPlayer(p, () => g.ui.msg(text, '#ffe070'));
    if (rank === 'marshal') {
      live.cmd[sd] = { p, pk, rank };
      S.cmdBy = pk;
      if (S.marshal) S.marshal.player = pk;
      live.ranks.set(p, { rank, side: sd });
      tell(`You command the host of the ${plain(S.civ)}. B: the war table, to give your orders (the battle doesn't wait for them).`);
      continue;
    }
    if (rank === 'captain') {
      const front = S.bands.filter((b) => !b.player && ['left', 'centre', 'right', 'wing', 'storm', 'ladders', 'wall', 'gate'].includes(b.role));
      const b = (front.length ? front : S.bands.filter((q) => !q.player)).sort((q, o) => cheb(q.cen || q.anchor, p) - cheb(o.cen || o.anchor, p))[0];
      if (b) {
        takeBand(live, b, p, pk);
        live.ranks.set(p, { rank, side: sd, band: b.id });
        tell(`You lead ${b.name} of the ${plain(S.civ)}: they look to you. B: the war table, for your orders.`);
        continue;
      }
    }
    const near = S.bands.filter((b) => b.role !== 'bows' && b.role !== 'horse').sort((q, o) => cheb(q.cen || q.anchor, p) - cheb(o.cen || o.anchor, p))[0];
    live.ranks.set(p, { rank: 'soldier', side: sd, band: near ? near.id : null });
    if (near) tell(`You fight in ${near.name}${near.captain ? `, under ${near.captain.rec.name.first} ${near.captain.rec.name.last}` : ''}. Stay by its banner.`);
  }
}

// A band in your hands: its captain stands aside for you.
function takeBand(live, b, p, pk) {
  b.player = p;
  b.playerPk = pk;
  if (b.captain && b.captain.warband) b.captain.warband.captain = null;
  b.order = { ...b.order, by: pk };
}

// What `p` may command in the battle near them: { side, rank, bands }.
export function commandOf(war, p) {
  const live = war.live;
  if (!live || !live.sides || !live.pside) return null;
  const sd = live.pside.get(p);
  if (!sd || !live.sides[sd] || !live.sides[sd].bands) return null;
  const S = live.sides[sd];
  const marshal = !!(live.cmd && live.cmd[sd] && live.cmd[sd].p === p);
  const bands = marshal ? S.bands : S.bands.filter((b) => b.player === p);
  const r = live.ranks && live.ranks.get(p);
  return { side: sd, S, rank: marshal ? 'marshal' : bands.length ? 'captain' : 'soldier', bands, band: r && r.band ? bandOf(live, r.band) : bands[0] || null };
}

// An order from one of you: to a band (by its id), or to all you command.
export function playerOrder(war, p, bandId, kind, at = null) {
  const live = war.live;
  const c = commandOf(war, p);
  if (!c || c.rank === 'soldier') return { ok: false, why: 'You have no one to command here.' };
  const list = bandId === 'all' ? c.bands.filter((b) => b.state !== 'rout') : [bandOf(live, bandId)].filter(Boolean);
  if (!list.length) return { ok: false, why: 'No such band.' };
  if (list.some((b) => b.side !== c.side || (c.rank !== 'marshal' && b.player !== p))) return { ok: false, why: 'That band isn\'t yours to command.' };
  const pk = pkOf(p);
  const O = ORDERS[kind];
  if (kind !== 'free' && !O) return { ok: false, why: '?' };
  if (O && O.siege && !live.siege) return { ok: false, why: 'There are no walls here.' };
  if (kind === 'shieldwall' && !c.S.shields) return { ok: false, why: 'Your realm hasn\'t learned the shield wall.' };
  let done = 0;
  for (const b of list) {
    if (kind === 'free') {
      // (Back to its captain, and the marshal's plan.)
      b.order = { ...b.order, by: 'ai' };
      if (b.player === p) {
        b.player = null;
        b.playerPk = null;
      }
      done++;
      continue;
    }
    if (kind === 'loose' && b.role !== 'bows') continue;
    if (b.state === 'rout' && kind !== 'rally') continue;
    // (A point on the field: the enemy band nearest it is the mark.)
    const foe = at ? nearestBand(live, c.side === 'a' ? 'b' : 'a', at) : null;
    const target = kind === 'charge' || kind === 'wheel' || kind === 'advance' ? (foe && at && cheb(foe.cen || foe.anchor, at) <= 8 ? foe.id : null) : null;
    const point = kind === 'charge' || kind === 'loose' ? null : at;
    orderBand(live, b, kind, kind === 'follow' ? null : point, pk, target);
    if (kind === 'follow') b.order.p = p;
    if (kind === 'storm' && b.point) b.order.at = { ...b.point.out };
    b.auto = false;
    done++;
  }
  if (!done) return { ok: false, why: kind === 'loose' ? 'Only the bowmen can loose.' : 'They can\'t, as they are.' };
  return { ok: true, n: done };
}

// The plan changed (the marshal's own: see bands.js runPlan), for every
// band you've not taken in hand.
export function setPlan(war, p, tactic) {
  const c = commandOf(war, p);
  if (!c || c.rank !== 'marshal') return { ok: false, why: 'Only the commander of the host can change the plan.' };
  const S = c.S;
  if (S.tactic === tactic) return { ok: false, why: 'That\'s the plan already.' };
  S.tactic = tactic;
  S.prog = { stage: 0, t: 0 };
  S.withdrew = tactic === 'retreat';
  for (const b of S.bands) if (b.order.by !== 'ai' && b.order.by === pkOf(p) && !b.player) b.order.by = 'ai';
  return { ok: true };
}

// A fallen banner of your side, near you: taken up, and the band's yours.
export function takeBanner(war, p) {
  const live = war.live;
  if (!live || !live.fallenBanners || !live.pside) return null;
  const sd = live.pside.get(p);
  if (!sd) return null;
  const f = live.fallenBanners.find((q) => cheb(q, p) <= 1 && bandOf(live, q.band) && bandOf(live, q.band).side === sd);
  if (!f) return null;
  const b = bandOf(live, f.band);
  live.fallenBanners = live.fallenBanners.filter((q) => q !== f);
  b.banner = null;
  b.bearer = null;
  takeBand(live, b, p, pkOf(p));
  p.banner = { color: b.color, band: b.id };
  b.morale = Math.min(100, b.morale + 12);
  (live.raised ||= new Map()).set(p, b.id);
  if (live.ranks) live.ranks.set(p, { rank: 'captain', side: sd, band: b.id });
  const up = b.ents.find(standing);
  if (up) up.say(up.rng.pick(['The banner\'s up! Follow them!', 'With them! Form on the colours!', 'They\'ve got it! To the banner!']), 2.4, '#ffe070');
  return b;
}

// Afterwards: one of you who took up a banner, and won the day, is named a
// captain of the realm (a band of their own, next time).
export function afterCommand(war, live, winner) {
  const g = war.game;
  for (const [p, bid] of live.raised || []) {
    const b = bandOf(live, bid);
    p.banner = null;
    if (!b || b.side !== winner) continue;
    const civ = live.sides[b.side].civ;
    if (!civ) continue;
    war.ranks ||= {};
    const R = (war.ranks[civ.id] ||= {});
    const pk = pkOf(p);
    if (R[pk]) continue;
    R[pk] = 'captain';
    g.asPlayer(p, () => g.ui.msg(`For taking up the fallen banner of ${b.name} and carrying the day, the ${plain(civ)} name you a captain: a band of your own to lead, in the battles to come.`, '#ffe070'));
  }
  for (const [p] of live.pside || []) p.banner = null;
}

// The word for a town about to be taken (see conduct.js): spare it, take
// what can be carried, or give it to the soldiers.
export function giveWord(war, p, word) {
  const live = war.live;
  const c = commandOf(war, p);
  if (!live || !live.siege || !c || c.rank !== 'marshal' || c.side !== live.siege.atk) return { ok: false, why: 'Only the commander of the storming army can give that word.' };
  live.word = word === 'none' ? null : word;
  live.siege.word = live.word;
  return { ok: true };
}

// The commander of a side gone (fallen, or off the field): the marshal
// takes the bands they'd taken in hand.
export function lostCommand(war, live, sd) {
  const S = live.sides[sd];
  if (!S) return;
  S.cmdBy = null;
  if (S.marshal) S.marshal.player = null;
  for (const b of S.bands || []) if (!b.player && b.order.by !== 'ai') b.order = { ...b.order, by: 'ai' };
  if (live.cmd) delete live.cmd[sd];
}

// For the war table and the HUD: a band at a glance.
export function bandLine(b) {
  const up = bandUp(b);
  const c = b.cen || centroid(b);
  return { up, of: b.start, morale: Math.round(b.morale), state: b.state, order: b.order.kind, at: c };
}
