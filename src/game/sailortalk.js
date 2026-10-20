// (Round 131) A word with one of a great ship's people (see shipcrew.js),
// in the same window as anyone ashore (see ui/sailorwin.js): who they are
// and where they're from, their ship and where she's bound, the wind and
// the weather, news off the water (a pirates' haven given away, now and
// then), something of the sea learned, a yarn, a shanty; a merchant's
// wares bought off them on deck; a drink stood them; your own crew given
// their orders and asked how they're bearing up; a pirate captain's oath.
import { shipById, windOf, ownerId, theShip } from './ships3d.js';
import { SHIP_TYPES } from '../world/shipmodels.js';
import { FLEET_KINDS } from './shipfleets.js';
import { GUILDS } from './pirates.js';
import { piracyOf, isKnownPirate, pledge, PIRATE_AT } from './piracy.js';
import { countItem, removeItem } from './inventory.js';
import { ITEMS } from '../world/items.js';
import { RNG, hash4 } from '../util/rng.js';
import { pidOf } from '../sim/saga/refs.js';

const ROLE_NAMES = { captain: 'Captain', mate: 'Mate', gunner: 'Gunner', marine: 'Marine', merchant: 'Merchant', passenger: 'Passenger', pirate: 'Pirate', pirate_archer: 'Pirate Archer', sailor: 'Hand' };

// Who they are, worked out the same every time from their name.
function seedOf(c) {
  let h = 7;
  for (const ch of c.name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
function rngOf(c, salt = 0) {
  return new RNG(hash4(seedOf(c), salt, 0x5a11));
}
const pick = (rng, a) => a[rng.int(0, a.length - 1)];
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

export function shipOf(game, c) {
  return c.shipId !== null && c.shipId !== undefined ? shipById(game, c.shipId) : null;
}
export function isOwnCrew(game, c) {
  const S = shipOf(game, c);
  return !!(S && S.owner && S.owner === ownerId(game, game.player));
}

// Her voyage, if she's on one (see shipfleets.js), and where she's from.
function voyageOf(game, S) {
  if (!S || S.voyage === undefined || S.voyage === null) return null;
  const F = game.fleets;
  return F ? F.voyages.find((v) => v.id === S.voyage) || null : null;
}
function homeOf(game, c, S) {
  const ow = game.world.ow;
  const v = voyageOf(game, S);
  if (v && ow.settlements[v.from]) return ow.settlements[v.from].name;
  if (S && S.portSid !== undefined && ow.settlements[S.portSid]) return ow.settlements[S.portSid].name;
  const civ = c.civ !== null && c.civ !== undefined ? (ow.civs || [])[c.civ] : null;
  return civ ? civ.name.replace(/^The /, 'the ') : null;
}

// How long at sea, what they think of it, what they'd never do aboard.
export function background(c) {
  const rng = rngOf(c, 1);
  const years = c.role === 'captain' ? rng.int(14, 34) : c.role === 'mate' ? rng.int(9, 22) : c.role === 'merchant' || c.role === 'passenger' ? rng.int(0, 3) : rng.int(2, 16);
  const begin = pick(rng, ['as a ship\'s boy, scrubbing pots', 'on a fishing smack with my father', 'when the press gang caught me drunk on the quay', 'after the harvest failed at home', 'to get away from a girl\'s brothers', 'because the sea was the only road out of town']);
  const charm = pick(rng, ['Never whistle on deck: it calls up a wind you can\'t send back.', 'I won\'t sail on a Friday. Laugh all you like.', 'A cat aboard keeps her lucky. We\'ve two.', 'Never say "drowned" at sea. Say "gone below".', 'A gold ring in your ear pays for your burying, wherever you wash up.', 'If a gull lands on the rail, somebody\'s thinking of you.']);
  return { years, begin, charm };
}

// What they're at just now.
export function doing(c) {
  if (c.angry) return 'fighting!';
  if (c.paidOff) return 'going ashore';
  if (c.below) return c.below.why === 'pump' ? 'at the pump, below' : 'below decks';
  const k = c.task && (c.task.kind === 'go' && c.task.then ? c.task.then.kind : c.task.kind);
  return { helm: 'at the wheel', gun: 'at the guns', haul: 'hauling on the sheets', capstan: 'at the capstan', go: 'about the deck' }[k] || (c.role === 'merchant' || c.role === 'passenger' ? 'taking the air on deck' : 'on watch');
}

export function roleName(c) {
  return ROLE_NAMES[c.role] || 'Hand';
}

// The first thing they say.
export function sailorOpening(c, game) {
  const S = shipOf(game, c);
  const rng = new RNG(hash4(seedOf(c), Math.floor(game.sim.abs / 30), 0x0be));
  const w = game.weather;
  if (c.angry) return pick(rng, ['Not now! Can\'t you see we\'re fighting?', 'Get a blade in your hand or get below!']);
  if (S && S.pirate && !isOwnCrew(game, c)) return pick(rng, ['Well now. Who let you aboard?', 'Speak quick, before the captain sees you.', 'Arr. You\'ve a brave face, coming aboard us.']);
  if (isOwnCrew(game, c)) return pick(rng, ['Captain.', 'Aye, captain?', `Captain! ${w && w.storm ? 'She\'s taking it well, considering.' : 'Fine day for it.'}`, 'What\'ll it be, captain?']);
  if (w && (w.storm || w.blow > 0.5)) return pick(rng, ['Hold onto something!', 'Blowing a gale, this. Mind the rail.', 'Not the day for a chat, friend!']);
  const byRole = {
    captain: ['Welcome aboard. Mind where you put your feet.', `You'll be wanting the captain. That's me.`, `${S ? cap(theShip(S)) : 'She'}'s a good ship. Treat her kindly.`],
    mate: ['The captain\'s busy. What is it?', 'Aye? Make it quick, there\'s work.'],
    gunner: ['Don\'t touch the guns.', 'Mind the touch-hole. Lost a finger that way, once.'],
    marine: ['Move along.', 'No trouble aboard, now.', 'State your business.'],
    merchant: ['Ah! A customer, perhaps?', 'Seasick? Me too. Keep your eyes on the horizon.'],
    passenger: ['Are you crew? Do you know when we make port?', 'I\'ve never been to sea before. Is it always this... wet?'],
    sailor: ['Ahoy.', 'Lovely day for it.', 'Watch your step, the deck\'s wet.', 'Aye?'],
  };
  return pick(rng, byRole[c.role] || byRole.sailor);
}

// What there is to say to them.
export function sailorTopics(c, game) {
  const out = [];
  const add = (id, label, cat, arg) => out.push(arg === undefined ? { id, label, cat } : { id, label, cat, arg });
  const S = shipOf(game, c);
  const own = isOwnCrew(game, c);
  const p = game.player;
  if (c.angry && !own) {
    add('bye', '(Back away)', 'now');
    return out;
  }
  if (own) {
    add('sl_orders', 'Orders for you.', 'now');
    add('sl_crew', 'How are the crew bearing up?', 'now');
  }
  if (S && S.pirate && c.role === 'captain' && !S.fight) add('sl_swear', 'I\'d sail under your flag.', 'now');
  if (!own && S) add('sl_bound', S.pirate ? 'Where are you sailing?' : 'Where are you bound?', 'now');
  if (c.role === 'merchant') add('sl_wares', 'What are you carrying?', 'business');
  add('sl_who', 'Tell me about yourself.', 'talk');
  if (S) add('sl_ship', own ? 'What do you make of her?' : 'Tell me about the ship.', 'talk');
  add('sl_wind', 'How\'s the wind?', 'talk');
  add('sl_news', 'Any news off the water?', 'talk');
  add('sl_lore', 'Teach me something of the sea.', 'talk');
  add('sl_yarn', 'Spin me a yarn.', 'talk');
  if (c.role !== 'passenger' && c.role !== 'merchant') add('sl_shanty', 'Give us a shanty.', 'talk');
  const drink = ['rum', 'grog'].find((k) => countItem(p.inv, k) > 0);
  if (drink) add('sl_drink', `Have a ${drink === 'rum' ? 'tot of rum' : 'mug of grog'} on me.`, 'manners', drink);
  add('bye', 'Goodbye.', 'manners');
  return out;
}

// Their answer to topic `id` ({ lines, choices?, back?, close? }).
export function sailorRespond(c, game, id, arg) {
  const S = shipOf(game, c);
  const p = game.player;
  const rng = new RNG(hash4(seedOf(c), Math.floor(game.sim.abs), id.length, 0x7a1));
  const name = S ? theShip(S) : 'the ship';
  switch (id) {
    case 'bye':
      return { lines: [pick(rng, ['Fair winds.', 'Mind how you go.', 'Aye.', 'Off with you, then.'])], close: true };
    // ---------------------------------------------------------- your crew
    case 'sl_orders':
      return {
        lines: [`${c.first}, ${roleName(c).toLowerCase()} of ${name}. Your orders, captain?`],
        choices: [
          { id: 'sl_o_guns', label: 'Man the guns.' },
          { id: 'sl_o_pump', label: 'Below, and work the pump.' },
          { id: 'sl_o_carry', label: 'Carry on as you were.' },
          { id: 'sl_o_off', label: 'You\'re paid off: go ashore.' },
        ],
      };
    case 'sl_o_guns':
      c.order = 'guns';
      c.task = null;
      c.say('Aye, captain! To the guns!', 2.5);
      return { lines: ['Aye, captain! I\'ll have her run out and loaded.'] };
    case 'sl_o_pump':
      c.order = 'pump';
      c.task = null;
      c.say('Aye! Below to the pump!', 2.5);
      return { lines: ['Aye. Below to the pump, and I\'ll keep at it till you say.'] };
    case 'sl_o_carry':
      c.order = null;
      return { lines: ['Aye aye.'] };
    case 'sl_o_off':
      return { lines: ['Paid off? After all we\'ve been through? You\'re sure, captain?'], choices: [{ id: 'sl_o_off2', label: 'I\'m sure. Go ashore.' }], back: 'No, stay.' };
    case 'sl_o_off2':
      if (S) S.crewRecs = S.crewRecs.filter((r) => r !== c.recRef);
      c.paidOff = true;
      c.say('Fair enough. I\'ll find another berth.', 3);
      return { lines: ['Fair enough. I\'ll find another berth. Fair winds to you, captain.'], close: true };
    case 'sl_crew': {
      const crew = S ? S.crewRecs.filter((r) => !r.dead) : [];
      const hurt = crew.filter((r) => r.hp !== undefined && r.hp < (r.maxHp || 18) * 0.6).length;
      const B = game.sim.brethren;
      const st = B && B.standingOf(pidOf(p));
      const share = st ? st.m.crewShare ?? 0.25 : null;
      const grumble = st ? st.m.grumble || 0 : 0;
      const T = S ? SHIP_TYPES[S.type] : null;
      const lines = [`There's ${crew.length} of us aboard${T ? `; she wants ${T.crew} to sail her right` : ''}. ${crew.length < (T ? T.crew : 3) ? 'We\'re short-handed, captain: sign more on with Sailor\'s Articles.' : 'Enough hands for her.'}`];
      if (hurt) lines.push(`${hurt} of us ${hurt > 1 ? 'are' : 'is'} carrying wounds. A few days ashore would mend them.`);
      if (share !== null) lines.push(share <= 0 ? `And the lads are asking about shares, captain. They've had none${grumble >= 2 ? ', and they\'re talking about it below' : ''}.` : share >= 0.5 ? 'Half of every prize to the crew: they\'d follow you into a storm wall, captain.' : `A ${share >= 0.25 ? 'quarter' : 'tenth'} of every prize to the crew: fair enough, they say.`);
      else lines.push(pick(rng, ['Spirits are good. Food could be better.', 'They\'re content, captain. Mostly.', 'The cook\'s biscuits have weevils again, but nobody\'s mutinied over it yet.']));
      return { lines };
    }
    // ---------------------------------------------------------- the brethren
    case 'sl_swear': {
      const gi = S.guild ?? 0;
      const G = GUILDS[gi] || GUILDS[0];
      const r = piracyOf(game, p);
      if (r.guild === gi) return { lines: [`You're one of us already, brother. ${cap(G.name)} look after their own.`] };
      if (!isKnownPirate(game, p)) return { lines: [`You? You've not the stomach for our trade. Sink a few fat merchantmen (${Math.max(1, PIRATE_AT - r.n)} more), and then come and talk to me.`] };
      const other = r.guild !== null ? GUILDS[r.guild] : null;
      return {
        lines: [other ? `You're sworn to ${other.name}. Turn your coat and swear to ${G.name} instead? They'll not forgive it.` : `So you're the one sending honest ships to the bottom. Swear to ${G.name}, and no ship of ours will ever fire on you. Other guilds' may, mind.`],
        choices: [{ id: 'sl_swear2', label: `I swear to ${G.name}.` }],
        back: 'Not today.',
      };
    }
    case 'sl_swear2': {
      const gi = S.guild ?? 0;
      const G = GUILDS[gi] || GUILDS[0];
      pledge(game, p, gi, G);
      c.say('Welcome to the brotherhood! Yo-ho!', 3, '#ffd080');
      for (const o of game.sailors || []) if (o !== c && o.shipId === c.shipId && !o.dead && Math.random() < 0.5) o.say(pick(rng, ['Yo-ho!', 'A new brother!', 'Rum for the new hand!']), 2.5, '#ffd080');
      return { lines: [`Then welcome to the brotherhood. The Articles are nailed up in every haven of ${G.name}: learn them.`] };
    }
    // ---------------------------------------------------------- where to
    case 'sl_bound': {
      const v = voyageOf(game, S);
      const ow = game.world.ow;
      if (S.pirate) return { lines: [pick(rng, ['Wherever the fat ships are.', 'That\'s the captain\'s business, and none of yours.', 'Out where the merchantmen run, and home again with their cargo.'])] };
      if (v) {
        const to = ow.settlements[v.to];
        const from = ow.settlements[v.from];
        const left = Math.max(0, Math.round((v.len - v.at) / Math.max(1, v.pace) / 60));
        const kind = FLEET_KINDS[v.kind] ? FLEET_KINDS[v.kind].name : 'ship';
        return {
          lines: [
            `${to ? `${to.name}` : 'Over the sea'}, out of ${from ? from.name : 'home'}. We're a ${kind}${v.kind === 'trade' ? ', our hold full of goods and our merchants aboard' : v.kind === 'war' ? ', her decks full of marines' : v.kind === 'settlers' ? ', settlers aboard bound for a new shore' : ''}.`,
            left > 1 ? `With this wind, ${left} hours yet. You're welcome to stay aboard: keep out from underfoot, and you'll step ashore there with us.` : 'We\'re near enough there now.',
          ],
        };
      }
      if (S.portSid !== undefined) {
        const home = ow.settlements[S.portSid];
        return { lines: [`She's ${home ? `${home.name}'s` : 'the town\'s'} own ship. We lie here at the pier till the merchants want carrying, then off to a port over the sea and back again.`, 'The harbourmaster on the pier knows when we sail next.'] };
      }
      return { lines: [S.route && S.route.length ? 'Bound away, wind willing.' : 'We lie here a while yet.'] };
    }
    // ---------------------------------------------------------- them
    case 'sl_who': {
      const b = background(c);
      const home = homeOf(game, c, S);
      const lines = [];
      if (c.role === 'merchant') lines.push(`${c.name}, merchant${home ? ` of ${home}` : ''}. I buy where it's cheap and sell where it's dear, and the sea's the quickest road between.`);
      else if (c.role === 'passenger') lines.push(`${c.name}. I've a cousin over the water who says there's land going cheap. We'll see.`);
      else lines.push(`${c.name}, ${roleName(c).toLowerCase()}${S ? ` of ${name}` : ''}${home ? `, out of ${home}` : ''}. ${b.years ? `${b.years} years at sea; I started ${b.begin}.` : 'This is my first voyage.'}`);
      if (c.role === 'captain') lines.push(pick(rng, ['I had my first command at twenty-six. Ran her aground the first week. Never again.', 'I\'ve sailed every sea there is, bar the one beyond the storm wall. Nobody comes back from that.', 'A captain answers for every soul aboard. It sits heavy, some nights.']));
      else if (c.role === 'gunner') lines.push('Deaf in one ear, these ten years. It\'s the price of the trade.');
      else if (c.role === 'marine') lines.push('I fight. The sailors sail. That\'s the way of it.');
      else if (c.role === 'pirate' || c.role === 'pirate_archer') lines.push(pick(rng, ['I was honest once. It paid badly.', 'The Articles give me a share like any other man. No king ever did.', 'There\'s a price on my head in three realms. I\'m quite proud of it.']));
      if (c.role !== 'merchant' && c.role !== 'passenger') lines.push(b.charm);
      return { lines };
    }
    case 'sl_ship': {
      if (!S) return { lines: ['What ship?'] };
      const T = SHIP_TYPES[S.type] || {};
      const capt = (game.sailors || []).find((o) => o.shipId === S.id && o.role === 'captain' && !o.dead);
      const crew = S.crewRecs.filter((r) => !r.dead).length;
      const guns = S.m && S.m.guns ? S.m.guns.length : 0;
      const lines = [`${cap(name)}, a ${(T.name || 'ship').toLowerCase()}${guns ? ` of ${guns} guns` : ''}. ${crew} aboard${capt && capt !== c ? `, under ${capt.name}` : ''}.`];
      if (T.blurb) lines.push(T.blurb);
      if (S.pirate) {
        const G = GUILDS[S.guild ?? 0] || GUILDS[0];
        lines.push(`She sails for ${G.name}. Every ship that sees her flag knows to strike, or run.`);
      } else if (isOwnCrew(game, c)) {
        const hurt = S.floodCells > 0.5 ? ' She\'s taking water, mind: someone wants to be at that pump.' : '';
        lines.push(pick(rng, ['She handles sweet, captain. Better than any I\'ve served on.', 'She\'s a good ship. Bit of weed on her bottom; she\'d want careening, by and by.', 'She\'s yours, captain, and she knows it.']) + hurt);
      } else lines.push(pick(rng, ['Built in the yards at home, of good oak.', 'Older than she looks. She\'s been round the world twice.', 'Leaks a bit forward. Don\'t tell the captain I said so.']));
      return { lines };
    }
    // ---------------------------------------------------------- the sea
    case 'sl_wind': {
      const W = windOf(game);
      const fx = -W.x;
      const fz = -W.z;
      const from = `${fz < -0.38 ? 'north' : fz > 0.38 ? 'south' : ''}${fx > 0.38 ? (fz < -0.38 || fz > 0.38 ? '-east' : 'east') : fx < -0.38 ? (fz < -0.38 || fz > 0.38 ? '-west' : 'west') : ''}` || 'all over';
      const strength = W.k > 1.4 ? 'a gale' : W.k > 1.1 ? 'a stiff breeze' : W.k > 0.8 ? 'a good sailing breeze' : W.k > 0.5 ? 'light airs' : 'barely a breath';
      const w = game.weather;
      const sky = w && w.storm ? 'and a storm on top of it: double-reef the sails and pray' : w && w.kind === 'rain' ? 'and rain coming on' : w && w.kind === 'fog' ? 'and fog: keep a sharp lookout for rocks' : 'and the sky clear enough';
      return { lines: [`${cap(strength)} from the ${from}, ${sky}.`, pick(rng, ['Sail with it on your quarter and she\'ll fly. Head into it and you\'ll go nowhere.', 'Square sails want it behind them; a fore-and-aft rig can claw up into it. Trim your sheets to it (the wheel at the helm) and she\'ll thank you.', 'Red sky at night, sailor\'s delight. Red sky in the morning, sailor\'s warning. Never fails. Mostly.'])] };
    }
    case 'sl_news': {
      const lines = [];
      // (A pirates' haven given away, now and then: a sailor hears things.)
      const H = game.sim.havens;
      const pid = pidOf(p);
      const hv = H ? H.list.find((h) => !h.razed && !H.knows(h.sid, pid)) : null;
      // (Once each: asked again, they've nothing more of it.)
      const tells = hv && !c.toldHaven && !(S && S.pirate) && H.fxOf(hv, 'hidden') < 0.5 && rng.chance(c.role === 'captain' || c.role === 'mate' ? 0.4 : 0.25);
      c.toldHaven = true;
      if (tells) {
        const G = GUILDS[hv.guild] || GUILDS[0];
        H.learn(hv, pid, 'heard', `${c.name}, a sailor`);
        lines.push(`I'll tell you a thing, but you didn't hear it from me: ${G.name} keep a haven. ${hv.name}, they call it. We gave that shore a wide berth last voyage. I'll mark it on your map, roughly.`);
      } else {
        const B = game.sim.brethren;
        const notes = B ? B.all().flatMap((G) => (G.log || []).slice(-2).map((q) => q.text)) : [];
        if (notes.length && rng.chance(0.6)) lines.push(`Word in the last port: ${pick(rng, notes).replace(/^./, (m) => m.toLowerCase())}`);
        else lines.push(pick(rng, ['Black sails seen off the point last week. Three merchantmen gone missing since the new moon.', 'A whale the size of a church, off the banks. Swam right under us.', 'They say the storm wall\'s been quieter this season. I don\'t believe it.', 'Prices for salt are up in every port. Somebody\'s getting rich.']));
      }
      const wars = game.sim.war && game.sim.war.wars ? game.sim.war.wars : [];
      if (wars.length && rng.chance(0.6)) {
        const w = pick(rng, wars);
        const ow = game.world.ow;
        const a = (ow.civs || [])[w.lead ? w.lead.a : w.a[0]];
        const b = (ow.civs || [])[w.lead ? w.lead.b : w.b[0]];
        if (a && b) lines.push(`And there's war between ${a.name.replace(/^The /, 'the ')} and ${b.name.replace(/^The /, 'the ')}. Men-of-war on every sea lane: they'll stop anyone and search the hold.`);
      }
      return { lines };
    }
    case 'sl_lore': {
      const n = (c.loreN = (c.loreN || 0) + 1);
      const TIPS = {
        captain: ['Weigh anchor before you set sail: from the wheel, R gives the order, and the hands at the capstan bring it up.', 'Never fight a bigger ship broadside to broadside. Rake her: cross her bow or stern and fire down her length.', 'A ship in a bottle\'s a ship you own: a shipwright sells them, and the sea gives her back where you uncork her.', 'Sailor\'s Articles from a shipwright sign hands on. No hands, no ship: one soul can\'t work her.'],
        mate: ['Holes in her? A plank in your hand and a click on the hole mends it, inside or out.', 'Keep a hand at the pump in heavy weather. Water below makes her slow, then makes her sink.', 'A careful captain keeps spare planks aboard. A careless one swims.'],
        gunner: ['At a gun, the mouse wheel sets her elevation. Higher for further, but she\'ll drop short in a heavy swell.', 'Wait till she bears. A gun fired too early\'s a gun wasted, and a ball you\'ll want later.', 'Shot\'s sold by the blacksmith in any haven. Never sail short of it.'],
        marine: ['When they board, hold the rail. One man at the rail is worth three in the waist.', 'Never let them get a grapnel fast. Cut it, or you\'ll be fighting on your own deck.'],
        sailor: ['Square sails pull best with the wind behind; fore-and-aft sails can sail close into it.', 'Tie off a line with a round turn and two half hitches. Never a granny knot: they slip.', 'On the wheel, little and often. She turns slow and keeps turning after you stop.', 'Look at the horizon if you feel sick. Never at the deck.'],
        merchant: ['Buy salt where it\'s made and sell it where it isn\'t. That\'s all of trade, really.', 'Pirates rarely take a ship that pays them off. A realm that pays tribute to the brethren sails safe.'],
        passenger: ['I\'ve learned one thing: don\'t eat the biscuits.'],
      };
      const tips = TIPS[c.role] || TIPS.sailor;
      return { lines: [tips[(n - 1) % tips.length]] };
    }
    case 'sl_yarn': {
      const YARNS = [
        ['Twenty years back we found a ship adrift. Not a soul aboard; the table laid for dinner and the soup still warm.', 'We left her where she was. You don\'t take a ship like that.'],
        ['There\'s a light beyond the storm wall, some nights. Blue, and very steady. Old sailors say the Kavorent left it burning.', 'Nobody I know has ever gone to look.'],
        ['I saw a serpent once, off the outer isles. Long as three ships and grey as a stone.', 'The captain said it was a log. A log with eyes, then.'],
        ['My old captain buried his gold on a beach and drew a map of it, and was hanged before he could go back.', 'The map\'s out there still, they say. Every haven has someone selling one.'],
        ['There\'s a haven the brethren keep, somewhere, where the realms\' ships never go. Shacks on stilts, and a gallows on the beach for turncoats.', 'Go there and you\'ll find what you\'re looking for. Or it\'ll find you.'],
        ['We were becalmed nine days once. On the eighth the cook started looking at the ship\'s boy funny.', 'Wind came up on the ninth. Lucky for the boy.'],
        ['A drowned sailor rings the ship\'s bell at midnight, the night before a storm.', 'Heard it myself, twice. Both times, a storm.'],
      ];
      const y = YARNS[rngOf(c, (c.yarnN = (c.yarnN || 0) + 1)).int(0, YARNS.length - 1)];
      return { lines: y };
    }
    case 'sl_shanty': {
      const SHANTIES = [
        ['(Singing) Oh, the wind blows high and the wind blows free, and it\'s home, boys, home, across the sea...', '...and we\'ll drink to the girls that we\'ll never see, oh it\'s home, boys, home!'],
        ['(Singing) What shall we do with a lazy sailor, what shall we do with a lazy sailor...', '...early in the morning! Hooray, and up she rises!'],
        ['(Singing) Haul away, haul away, haul away together, haul away, boys, it\'s blowing stormy weather...', '...haul away, me rosy, haul away, Joe!'],
      ];
      const sh = pick(rng, SHANTIES);
      c.say('♪', 2, '#ffe070');
      for (const o of game.sailors || []) if (o !== c && o.shipId === c.shipId && !o.dead && !o.angry && Math.random() < 0.6) o.say(pick(rng, ['♪ Hooray! ♪', '♪ Haul away! ♪', '♪ Home, boys, home! ♪']), 2.5, '#ffe070');
      return { lines: sh };
    }
    case 'sl_drink': {
      if (!arg || countItem(p.inv, arg) <= 0) return { lines: ['You\'ve nothing to pour.'] };
      removeItem(p.inv, arg, 1);
      c.rec.mood = Math.min(1, (c.rec.mood ?? 0.6) + 0.2);
      if (c.recRef) c.recRef.mood = c.rec.mood;
      c.say(pick(rng, ['Your health!', 'Down the hatch!', 'Ahh. That\'s the stuff.']), 2.5, '#ffe070');
      return { lines: [pick(rng, ['That\'s kind of you. Your health, and fair winds!', 'Now that\'s a gentleman\'s gift. Or a lady\'s. Cheers!', 'Ahh. You\'re all right, you are.']), isOwnCrew(game, c) ? 'The lads\'ll hear you stood me a drink. They\'ll think the better of you for it.' : 'If you\'re ever wanting a berth, ask for me.'] };
    }
    // ---------------------------------------------------------- business
    case 'sl_wares': {
      const r2 = rngOf(c, 9);
      const pool = ['cloth', 'salt', 'jasmine_tea', 'rum', 'pearl', 'glass', 'iron_ingot', 'lantern', 'fishing_rod', 'olives', 'cooked_fish'].filter((k) => ITEMS[k]);
      const wares = [];
      while (wares.length < 3 && pool.length) wares.push(pool.splice(r2.int(0, pool.length - 1), 1)[0]);
      const price = (k) => Math.max(1, Math.round((ITEMS[k].value || 1) * 1.4));
      return {
        lines: [`Bound for market, all of it, but I'll sell a little on deck for ready coin: ${wares.map((k) => ITEMS[k].name.toLowerCase()).join(', ')}.`],
        choices: wares.map((k) => ({ id: 'sl_buy', arg: k, label: `${ITEMS[k].name} (¤${price(k)})` })),
        back: 'Nothing, thanks.',
      };
    }
    case 'sl_buy': {
      const k = arg;
      const cost = Math.max(1, Math.round(((ITEMS[k] && ITEMS[k].value) || 1) * 1.4));
      if (countItem(p.inv, 'coin') < cost) return { lines: [`¤${cost}, friend. You've not got it.`] };
      removeItem(p.inv, 'coin', cost);
      p.give(k, 1);
      game.audio?.play('coin');
      return { lines: [pick(rng, ['Pleasure doing business.', 'A fair price, at sea. Ashore you\'d pay double.', 'Done.'])] };
    }
  }
  return { lines: ['Aye.'] };
}
