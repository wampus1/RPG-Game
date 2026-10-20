// (Round 130) Talk in a pirates' haven, and about one (see sim/havens.js,
// sim/brethren.js): the quartermaster (who keeps the haven for the guild:
// swearing in, hands for your ship, your shares paid in and paid out, a
// captain's commission, a captive's ransom), the chief (news of prizes; a
// challenge under the Articles), the captains (their careers), the
// gunsmith (powder and shot), the fence (charts to the guild's other
// havens), the old salts (yarns, and where a captain's treasure lies); a
// captive at the bars of the stockade; a village's steward, its governor a
// captain of the brethren, raising the black flag; and a realm's ruler,
// or anyone who knows where a haven is, at a realm's hall.
import { GUILDS } from './pirates.js';
import { isKnownPirate, piracyOf, pledge, pirateTo } from './piracy.js';
import { shipsOf, ownerId } from './ships3d.js';
import { makeCrew, addHand } from './shipcrew.js';
import { countItem, removeItem } from './inventory.js';
import { pidOf, playerName } from '../sim/saga/refs.js';
import { isHaven } from '../sim/havenref.js';
import { RANK_NAMES, CAPTAIN_AT, CHIEF_AT } from '../sim/brethren.js';
import { hash4, RNG } from '../util/rng.js';

const HAND_FEE = 25;
const SHOT_FEE = 20;
const SHOT_N = 20;
const ENTRY = 50; // an honest stranger's first share, to be sworn in
const CHART_FEE = 30;
const MAP_FEE = 45;

const pick = (rng, a) => a[Math.floor(rng.next() * a.length)];
const purse = (p) => countItem(p.inv, 'coin');

function shipOf(game, p) {
  const me = ownerId(game, p);
  const mine = shipsOf(game).filter((q) => q.owner === me && !q.sinking);
  return (p.deck && mine.find((q) => q.id === p.deck.s)) || mine[0] || null;
}

// The haven the NPC lives in (and its guild), or null.
function havenOf(game, npc) {
  const s = npc.settlement;
  if (!s || !isHaven(s) || npc.rec.visitor) return null;
  const h = game.sim.havens.of(s.id);
  return h ? { h, i: h.guild, G: GUILDS[h.guild] || GUILDS[0] } : null;
}

const roleOf = (rec) => (rec.havenRank === 'chief' ? 'chief' : rec.havenRank === 'captain' ? 'captain' : rec.job);

// What they say first.
export function havenHello(npc, game) {
  const H = havenOf(game, npc);
  if (!H) return null;
  const rec = npc.rec;
  const pid = pidOf(game.player);
  const B = game.sim.brethren;
  const st = B && B.standingOf(pid);
  const ours = st && st.i === H.i;
  const rng = npc.rng;
  const role = roleOf(rec);
  if (rec.age === 'child') return pick(rng, ['Are you a pirate? A real one?', 'My da took a Navy ship once. A big one!', 'Got any sweets? The cook won\'t give us any.']);
  if (!ours) {
    if (isKnownPirate(game, game.player)) return pick(rng, [`One of the trade, are you? Not one of ours, though. Mind yourself in ${H.h.name}.`, 'Another free sailor. Drink your rum and keep your knife sheathed.']);
    return pick(rng, ['You\'re not one of us. Who let you ashore?', `This is ${H.G.name}'s beach, stranger. Spend your coin and keep your eyes to yourself.`, 'Lost, are you? Most who come here are, one way or another.']);
  }
  const rank = st.m.rank;
  if (role === 'chief') return pick(rng, [rank === 'captain' ? 'Captain. The brethren need prizes; go and get them.' : 'Back from the sea? Good. The chest wants filling.', 'Sit, drink. Then go and make us rich.']);
  if (role === 'mayor') return pick(rng, [`${st.m.owed ? `There's ¤${st.m.owed} of shares here for you.` : 'Your share\'s in the barrel. What\'s left of it.'}`, 'Short of hands? I\'ve a few who\'d sail with you.']);
  if (role === 'captain') return pick(rng, ['Fair winds, brother.', 'The sea\'s been kind this week. Mostly.', 'Seen any fat merchantmen out there?']);
  if (rec.job === 'blacksmith') return pick(rng, ['Guns need feeding, captain.', 'Powder and shot, for the right price.']);
  return pick(rng, ['Yo ho.', 'Seen a merchantman go by at dawn. Fat as a goose.', 'The realms hang our kind at the harbour mouth, you know.', `Welcome home, ${RANK_NAMES[rank].toLowerCase()}.`]);
}

// What you can say to them.
export function havenTopics(npc, game) {
  const out = [];
  const add = (id, label, arg = undefined) => out.push(arg === undefined ? { id, label } : { id, arg, label });
  const rec = npc.rec;
  const sim = game.sim;
  const B = sim.brethren;
  const pid = pidOf(game.player);
  const s = npc.settlement;
  // (A village's steward, and its governor one of the brethren: the black flag.)
  if (s && !isHaven(s) && !s.civ && s.coast && B && sim.office && sim.office.isHolder(s.id, pid) && rec.steward) {
    const st = B.standingOf(pid);
    if (st && st.m.rank !== 'hand') add('hv_raise', `Raise the black flag of ${B.name(st.i)} over ${s.name}.`);
  }
  // (At a realm's hall: the haven you know of, told; a ruler's ships sent.)
  if (s && !isHaven(s) && s.civ && (rec.job === 'mayor' || rec.steward || (rec.job === 'guard' && rec.captain)) && sim.havens) {
    const H = sim.havens;
    const civ = s.civ.id;
    const tellable = H.standing().filter((h) => H.knows(h.sid, pid) && !H.realmKnows(h, civ));
    if (tellable.length) add('hv_tell', `I know where the pirates have a haven. (${tellable[0].name})`);
    if (sim.crown && sim.crown.isRuler(s.civ, pid)) {
      const hunt = H.standing().filter((h) => H.realmKnows(h, civ) && !h.expedition);
      if (hunt.length) add('hv_hunt', `Send our marines to burn out ${hunt[0].name}.`);
      // (A price on a pirate's head: another player the realm knows for one.)
      if (pirates(game, civ, pid).length) add('hv_bounty', 'Put a price on a pirate\'s head. (¤50 from the treasury)');
    }
  }
  const H = havenOf(game, npc);
  if (!H || rec.age === 'child') return out;
  const st = B && B.standingOf(pid);
  const ours = st && st.i === H.i;
  const role = roleOf(rec);
  if (role === 'mayor') {
    if (!ours) add('hv_swear', `I'd swear myself to ${H.G.name}.${isKnownPirate(game, game.player) ? '' : ` (¤${ENTRY}, a first share)`}`);
    if (ours) {
      add('hv_hand', `I need another hand aboard. (¤${HAND_FEE})`);
      add('hv_payin', 'I\'ve brought the guild its share.');
      if (st.m.owed) add('hv_owed', `My shares. (¤${st.m.owed} owed)`);
      if (st.m.rank === 'hand') add('hv_commission', 'I\'d have a captain\'s commission.');
      if (st.m.rank === 'captain') add('hv_vote', 'Call the captains to vote: I\'d stand for chief.');
      add('hv_council', st.m.rank === 'chief' ? 'Sit the council. (the chief\'s chair)' : 'What\'s before the council?');
    }
    if (sim.havens.held(H.h).length) add('hv_captives', 'The captives in your stockade...');
  }
  if (role === 'chief') {
    add('hv_news', 'Any word of prizes on the water?');
    if (ours && st.m.rank === 'captain') add('hv_challenge', 'I challenge you, under the Articles.');
    if (!ours && !st) add('hv_swear', `I'd swear myself to ${H.G.name}.`);
  }
  if (role === 'captain') add('hv_career', 'Tell me about your ship.');
  if (rec.job === 'blacksmith') add('hv_shot', `Powder and shot for my guns. (¤${SHOT_FEE} for ${SHOT_N})`);
  if (rec.job === 'merchant') add('hv_chart', `A chart to another haven of yours? (¤${CHART_FEE})`);
  if (rec.job === 'retired' || rec.age === 'elder') {
    add('hv_yarn', 'Tell me about this place.');
    add('hv_treasure', `Ever hear of buried treasure? (¤${MAP_FEE} for a map, they say)`);
  }
  return out;
}

// What they answer (null if it's not theirs to).
export function havenRespond(npc, game, id, arg) {
  if (!id.startsWith('hv_')) return null;
  const sim = game.sim;
  const B = sim.brethren;
  const p = game.player;
  const pid = pidOf(p);
  const rng = new RNG(hash4(npc.rec.idx, game.day, Math.floor(sim.abs), 0x4a9));
  const H = havenOf(game, npc);
  const st = B && B.standingOf(pid);
  const s = npc.settlement;
  switch (id) {
    case 'hv_swear': {
      if (!H) return null;
      if (st && st.i === H.i) return { lines: ['You\'re one of us already.'] };
      if (!isKnownPirate(game, p)) {
        if (purse(p) < ENTRY) return { lines: [`You're no pirate that I've heard of. Put ¤${ENTRY} in the chest, as your first share, and we'll see.`] };
        removeItem(p.inv, 'coin', ENTRY);
        B.income(H.i, ENTRY, 'a first share');
      }
      pledge(game, p, H.i, H.G);
      return { lines: [pick(rng, ['Then you\'re one of us. Our ships won\'t fire on you, and our beaches are yours.', `Sign here. Or make your mark. There: you're of ${H.G.name} now, and the Articles bind you.`]), 'Bring the guild prizes and your shares, and the brethren will come to know you.'] };
    }
    case 'hv_hand': {
      const ship = shipOf(game, p);
      if (!ship) return { lines: ['A hand for what? You\'ve no ship. Come back with a deck under you.'] };
      if (purse(p) < HAND_FEE) return { lines: [`¤${HAND_FEE}, and they're yours. They don't sail for promises.`] };
      removeItem(p.inv, 'coin', HAND_FEE);
      const rec = makeCrew(hash4(npc.rec.idx, ship.crewRecs.length, Math.floor(sim.abs)), ship.type, 'vale', 3)[2];
      rec.role = rng.chance(0.4) ? 'gunner' : 'sailor';
      rec.temper = 'rogue';
      rec.look = { ...rec.look, hat: 'bandana', hatColor: '#1a1a1a' };
      ship.crewRecs.push(rec);
      addHand(game, ship, rec);
      return { lines: [`${rec.name.first || 'This one'}'ll do. Signed on as ${rec.role === 'gunner' ? 'a gunner' : 'a hand'}: ${ship.crewRecs.length} aboard ${ship.name} now.`] };
    }
    case 'hv_shot': {
      const ship = shipOf(game, p);
      if (!ship) return { lines: ['Shot for what, your fists? Get a ship first.'] };
      if (purse(p) < SHOT_FEE) return { lines: [`¤${SHOT_FEE}. Powder isn't free, even here.`] };
      removeItem(p.inv, 'coin', SHOT_FEE);
      ship.ammo = (ship.ammo || 0) + SHOT_N;
      return { lines: [`${SHOT_N} rounds, stowed aboard ${ship.name}. Don't waste them on gulls.`] };
    }
    case 'hv_payin': {
      if (!st) return null;
      if (!arg) {
        const have = purse(p);
        const opts = [25, 50, 100, 250].filter((n) => n <= have);
        if (!opts.length) return { lines: ['With what? Your pockets are empty.'] };
        return { lines: ['How much goes in the chest?'], choices: opts.map((n) => ({ id: 'hv_payin', arg: String(n), label: `¤${n}` })) };
      }
      const n = Math.min(+arg, purse(p));
      if (n <= 0) return { lines: ['With what?'] };
      removeItem(p.inv, 'coin', n);
      const merit = B.payIn(pid, n);
      return { lines: [`¤${n} into the chest, and written in the book against your name. (Merit ${merit}.)`, pick(rng, ['The brethren will hear of it.', 'That\'s the spirit.'])] };
    }
    case 'hv_owed': {
      if (!st || !st.m.owed) return { lines: ['Nothing\'s owed you.'] };
      const n = st.m.owed;
      st.m.owed = 0;
      p.give('coin', n);
      return { lines: [`¤${n}, your shares by the Articles. Count it if you like; I did.`] };
    }
    case 'hv_commission': {
      const r = B.commission(pid, shipOf(game, p));
      if (!r.ok) return { lines: [r.why] };
      game.audio?.play('fanfare');
      return { lines: ['Then you\'re a captain of the brethren. Your ship flies our colours now; your crew take their shares by the Articles.', 'Captains sit the council, and vote for the chief. Don\'t forget it.'] };
    }
    case 'hv_vote': {
      if (!st) return null;
      const r = B.callVote(st.i, pid);
      if (!r.ok) return { lines: [r.why] };
      game.openHavenCouncil?.(H.h, p, { vote: r });
      return { lines: [r.carried ? `The captains have voted, ${r.ayes} to ${r.votes.length - r.ayes}: you're chief of ${B.name(st.i)}!` : `The captains have voted, ${r.ayes} to ${r.votes.length - r.ayes}. Not this time.`] };
    }
    case 'hv_council':
      if (!H) return null;
      game.openHavenCouncil?.(H.h, p);
      return { lines: ['Come into the hall.'], close: true };
    case 'hv_challenge': {
      if (!st) return null;
      const r = B.canChallenge(st.i, pid);
      if (!r.ok) return { lines: [r.why] };
      if (game.duel) return { lines: ['One fight at a time.'] };
      game.startDuel(npc, 0, { challenge: st.i });
      return { lines: ['Under the Articles, then. Steel, here, before the brethren. The first to yield loses all.'], close: true };
    }
    case 'hv_news':
      return { lines: [pick(rng, [
        'Merchantmen out of the realms run the coasts every few days. Fat, slow, and no guns worth the name.',
        'One of the realms has been asking after us. If they ever learn where we are, they\'ll come with fire.',
        'The other guilds have been poaching our waters. If you see their colours, you know what to do.',
      ])] };
    case 'hv_career': {
      const c = H && B.captain(B.of(H.i), npc.rec.capId);
      if (!c) return { lines: ['Ask the chief.'] };
      return { lines: [`The ${c.ship}, a ${c.type}, and mine since day ${c.since}. ${c.prizes} prizes taken, ${c.scars} scar${c.scars === 1 ? '' : 's'} to show for it.`, c.state === 'careen' ? 'She\'s up on the beach now, being scraped. Out again in a day or two.' : 'We put out again soon. There\'s always a merchantman.'] };
    }
    case 'hv_captives': {
      if (!H) return null;
      const held = sim.havens.held(H.h);
      if (!arg) {
        if (!held.length) return { lines: ['The stockade\'s empty.'] };
        return {
          lines: ['Here\'s what\'s in the stockade. Anyone you\'d pay for?'],
          choices: held.slice(0, 6).map((q) => ({ id: 'hv_captives', arg: String(q.id), label: `${q.name}, of ${game.world.ow.settlements[q.sid]?.name || '?'} (¤${q.ransom})` })),
        };
      }
      const q = held.find((c) => c.id === +arg);
      if (!q) return { lines: ['Gone already.'] };
      if (purse(p) < q.ransom) return { lines: [`¤${q.ransom}. They're worth that to someone, and it isn't me.`] };
      removeItem(p.inv, 'coin', q.ransom);
      sim.havens.ransomed(q, 'player');
      const home = game.world.ow.settlements[q.sid];
      if (home) sim.addRenown?.(home.id, 6, `paying a pirate's ransom for ${q.name}`);
      return { lines: [`¤${q.ransom}, and ${q.name}'s free to go. They'll be home in a few days.`] };
    }
    case 'hv_chart': {
      if (!H) return null;
      const others = sim.havens.standing(H.i).filter((h) => h !== H.h && !sim.havens.knows(h.sid, pid));
      if (!others.length) return { lines: ['You know all our havens already. Or all I\'d sell.'] };
      if (purse(p) < CHART_FEE) return { lines: [`¤${CHART_FEE}. Charts are dear.`] };
      removeItem(p.inv, 'coin', CHART_FEE);
      sim.havens.learn(others[0], pid, 'heard', 'a fence\'s chart');
      return { lines: [`There. ${others[0].name}. Don't let a realm's man see that chart.`] };
    }
    case 'hv_yarn':
      return { lines: [pick(rng, [
        `${H ? H.h.name : 'This place'}. The brethren have kept this shore since before the realms had warships. Nobody comes here who isn't one of us, or isn't lost.`,
        'The chief takes a share of every prize. The quartermaster keeps the book and the chest, and makes sure the chief doesn\'t take more. And nobody asks where you got it.',
        'Half of us were honest sailors once. Then the realms stopped paying, or started hanging. Here, at least, the rum is free.',
        'The captains choose the chief, and any captain can challenge one, under the Articles. Steel on the beach, the whole haven watching. I\'ve seen three chiefs fall that way.',
      ])] };
    case 'hv_treasure': {
      if (purse(p) < MAP_FEE) return { lines: [`Every old captain buries something. I've a map, if you've ¤${MAP_FEE}.`] };
      const key = sim.havens.treasureMap(rng, npc.settlement);
      if (!key) return { lines: ['I\'d a map once. Lost it at dice.'] };
      removeItem(p.inv, 'coin', MAP_FEE);
      p.give(key, 1);
      return { lines: ['Here: a dead captain\'s. Read it (right-click it), find the place, and dig where the X is. A shovel, mind.', 'If it\'s empty, don\'t come back to me.'] };
    }
    case 'hv_raise': {
      if (!st) return null;
      const h = sim.havens.turn(s, st.i, game.day, undefined, pid);
      if (!h) return { lines: ['Not here. Not now.'] };
      return { lines: [`The black flag of ${B.name(st.i)} goes up over ${s.name}. There's no taking it down now.`] };
    }
    case 'hv_tell': {
      const civ = s.civ;
      if (!civ) return null;
      const h = sim.havens.standing().find((q) => sim.havens.knows(q.sid, pid) && !sim.havens.realmKnows(q, civ.id));
      if (!h) return { lines: ['We know of it already.'] };
      sim.havens.tellRealm(h, civ.id, game.playerName, game.day);
      p.give('coin', 40);
      // (Told on your own brethren: a turncoat.)
      if (st && st.i === h.guild) {
        B.deed(pid, 'pardon');
        st.m.gone = game.day;
        piracyOf(game, p).guild = null;
        game.ui.msg(`You've sold ${B.name(h.guild)}'s haven to the realm. If the brethren learn of it, they'll hunt you to the end of the sea.`, '#ff8060');
      }
      return { lines: [`${h.name}? That's worth ¤40 to the crown, and more if our ships find it where you say.`] };
    }
    case 'hv_bounty': {
      const civ = s.civ;
      const list = pirates(game, civ.id, pid);
      if (!arg) return { lines: ['Whose head?'], choices: list.slice(0, 5).map((q) => ({ id: 'hv_bounty', arg: q.pid, label: `${q.name} (¤${sim.havens.bountyOf(q.pid)} now)` })) };
      const q = list.find((o) => o.pid === arg);
      const cap = sim.realms.capitalOf(civ);
      const CL = cap && game.world.layouts.get(cap.id);
      if (!q || !CL || !CL.econ || CL.econ.treasury < 50) return { lines: ['The treasury can\'t spare it.'] };
      CL.econ.treasury -= 50;
      const r = piracyOf(game, q.p);
      r.bounty = (r.bounty || 0) + 50;
      sim.realms.proclaim(civ, game.day, `By the crown's order: ¤${sim.havens.bountyOf(q.pid)} for the pirate ${q.name}, dead or alive.`);
      const tell = () => game.ui.msg(`The ${civ.name.replace(/^The /, '')} has put ¤${sim.havens.bountyOf(q.pid)} on your head. Its watch will be looking for you.`, '#ff9070');
      game.asPlayer ? game.asPlayer(q.p, tell) : tell();
      return { lines: [`It's proclaimed in every town of the realm: ¤${sim.havens.bountyOf(q.pid)} for ${q.name}.`] };
    }
    case 'hv_hunt': {
      const civ = s.civ;
      const h = sim.havens.standing().find((q) => sim.havens.realmKnows(q, civ.id) && !q.expedition);
      if (!h) return { lines: ['There\'s nowhere we know of to send them.'] };
      const raid = sim.havens.expedition(civ, h, game.day, rng);
      if (!raid) return { lines: ['We\'ve not men enough on the coast to send.'] };
      return { lines: [`It's done. ${raid.party.length} of the watch take ship with the marines tonight. ${h.name} burns in two nights, or they don't come back.`] };
    }
  }
  return null;
}

// The players realm `civ` knows for pirates (but `pid`): { pid, p, name }.
function pirates(game, civ, pid) {
  const out = [];
  for (const q of game.everyone ? game.everyone() : [game.player]) {
    const qp = pidOf(q);
    if (!q || qp === pid || !pirateTo(game, q, civ)) continue;
    out.push({ pid: qp, p: q, name: playerName(game, qp) });
  }
  return out;
}

// A captive at the bars (see game.talk): who they are, and what they want.
export function captiveSay(npc, game) {
  const c = npc.captive;
  const p = c && c.p;
  if (!p || p.pirate === undefined) return null;
  const home = game.world.ow.settlements[p.sid];
  const rng = npc.rng;
  return pick(rng, [
    `I'm ${p.name}, of ${home ? home.name : 'nowhere you know'}. They want ¤${p.ransom} for me. Nobody's coming.`,
    `${p.how ? `I was ${p.how}.` : 'They took me.'} Get me out of here. The quartermaster will take coin; a lockpick would do as well.`,
    `Tell them in ${home ? home.name : 'my town'} I'm alive. Tell them where this place is.`,
  ]);
}

export { CAPTAIN_AT, CHIEF_AT };
