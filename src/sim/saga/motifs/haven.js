// (Round 123) A pirates' haven: the brethren of a guild ashore by their
// cove (see game/pirates.js), where a brigand begins (see game/origins.js).
// Tents about a fire on the beach, barrels and crates of what's been
// taken, the guild's war banner, a post with the realms' WANTED notices
// nailed up (yours among them), and the brethren who live there: their
// chief, the quartermaster (who'll find you a hand for your ship), the
// gunner (powder and shot), and a couple of old salts with nothing better
// to do than talk.
import { motif } from '../core.js';
import { pick, purse, playerOf } from './lib.js';
import { makePerson } from '../actors.js';
import { B } from '../../../world/blocks.js';
import { GROUND } from '../../../config.js';
import { RNG, hash4 } from '../../../util/rng.js';
import { removeItem } from '../../../game/inventory.js';
import { GUILDS } from '../../../game/pirates.js';
import { piracyOf, pledge } from '../../../game/piracy.js';
import { shipsOf, ownerId } from '../../../game/ships3d.js';
import { makeCrew, addHand } from '../../../game/shipcrew.js';

const HAND_FEE = 25;
const SHOT_FEE = 20;
const SHOT_N = 20;
const tid = (th) => String(th.id);

// The haven's brethren: who they are, where they stand about the fire.
const PEOPLE = [
  { key: 'chief', role: 'chief', title: 'Pirate Chief', at: [0, 4], hat: 'tricorn', outfit: 'noble' },
  { key: 'qm', role: 'quartermaster', title: 'Quartermaster', at: [-4, 2], hat: 'bandana', outfit: 'vest' },
  { key: 'gun', role: 'gunner', title: 'Gunner', at: [4, 2], hat: 'cap', outfit: 'apron' },
  { key: 'salt1', role: 'salt', title: 'Old Salt', at: [-2, -1], hat: 'bandana', outfit: 'plain' },
  { key: 'salt2', role: 'salt', title: 'Deckhand', at: [3, -2], hat: null, outfit: 'vest' },
];

// The ground where the haven is, at (x, z) across its fire, `dx, dz` the
// way inland (a unit step) and `px, pz` along the beach.
function axes(th) {
  const v = th.vars;
  return { x: v.x, z: v.z, dx: v.dx, dz: v.dz, px: -v.dz, pz: v.dx };
}
function spotAt(th, along, inland) {
  const A = axes(th);
  return { x: Math.round(A.x + A.px * along + A.dx * inland), z: Math.round(A.z + A.pz * along + A.dz * inland) };
}

// Its tents, fire, stores and banner (once).
function build(th, S) {
  if (th.vars.built) return;
  const w = S.game.world;
  const yAt = (x, z) => (w.regionAt(x, z) ? Math.max(1, w.findStandY(x, z, GROUND)) : GROUND);
  const ops = [];
  const put = (along, inland, id, up = 0) => {
    const s = spotAt(th, along, inland);
    const y = yAt(s.x, s.z);
    if (w.regionAt(s.x, s.z) && w.isWaterAt(s.x, y - 1, s.z)) return;
    ops.push([s.x, y + up, s.z, id, 0]);
  };
  put(0, 2, B.campfire);
  put(-4, 5, B.tent);
  put(4, 5, B.tent);
  put(0, 7, B.tent);
  put(-6, 2, B.barrel);
  put(-6, 3, B.barrel);
  put(-6, 3, B.crate, 1);
  put(6, 1, B.crate);
  put(6, 2, B.crate_open ?? B.crate);
  put(-2, 6, B.dice_barrel ?? B.barrel);
  put(2, -1, B.war_banner ?? B.festival_banner);
  put(-3, -1, B.wanted_post ?? B.fence);
  for (const [a, i] of [[-7, 0], [7, 0], [-7, 6], [7, 6]]) {
    put(a, i, B.fence);
    put(a, i, B.torch, 1);
  }
  if (ops.length) S.sim.setBlocks(ops);
  th.vars.built = true;
}

// The brethren, standing where they live.
function people(th, S) {
  const rng = new RNG(hash4(th.seed, 0x4a7e));
  const G = GUILDS[th.vars.guild] || GUILDS[0];
  th.vars.names ||= {};
  for (const P of PEOPLE) {
    const at = spotAt(th, P.at[0], P.at[1]);
    const person = makePerson(rng, 'vale', 'outlaw');
    person.look.hat = P.hat;
    person.look.outfit = P.outfit;
    person.look.hatColor = G.flag === '#121212' ? '#1a1a1a' : G.flag;
    person.look.accent = '#8a1a1a';
    if (rng.chance(0.3)) person.look.acc = 'eyepatch';
    person.title = P.title;
    person.job = 'pirate';
    person.weapon = 'sabre';
    th.vars.names[P.key] = person.name.first;
    S.actor(th, {
      key: P.key, kind: 'npc', role: P.role, talk: true, at, stay: true, person,
      orders: { home: at, roam: P.role === 'salt' ? 4 : 1, lines: LINES[P.role] || null },
    });
  }
}

const LINES = {
  chief: ['The sea provides.', 'Keep your blade sharp and your mouth shut.', 'Every flag runs from ours.'],
  quartermaster: ['Hands for hire, if you\'ve the coin.', 'Who\'s been at the rum?'],
  gunner: ['Powder\'s dry. Mostly.', 'Mind the fuse.'],
  salt: ['Yo ho.', 'Seen a merchantman go by at dawn. Fat as a goose.', 'The realms hang our kind at the harbour mouth, you know.'],
};

// The brigand's own ship (the one sailing with them), or any of theirs.
function shipOfPid(S, pid) {
  const p = playerOf(S.game, pid);
  if (!p) return null;
  const me = ownerId(S.game, p);
  const mine = shipsOf(S.game).filter((q) => q.owner === me && !q.sinking);
  return (p.deck && mine.find((q) => q.id === p.deck.s)) || mine[0] || null;
}

const sworn = (S, pid, guild) => S.asPid(pid, (p) => piracyOf(S.game, p).guild === guild);

motif({
  id: 'pirate_haven',
  family: 'haven',
  max: 3,
  key: (o) => `haven:${o.vars.guild}`,
  title: (th) => `${th.vars.name}`,
  nodes: {
    open: {
      enter(th, S) {
        build(th, S);
        people(th, S);
        S.note(th, `${th.vars.name}: ${(GUILDS[th.vars.guild] || GUILDS[0]).name} keep a haven on the beach here, by their ships.`);
      },
      // (It's where they live: it never fades.)
      fade: 1e9,
    },
  },
  hello(th, a, npc, pid, S) {
    const G = GUILDS[th.vars.guild] || GUILDS[0];
    const ours = sworn(S, pid, th.vars.guild);
    const rng = npc.rng || new RNG(hash4(npc.id | 0, 0x7e1));
    if (!ours) return pick(rng, ['You\'re not one of ours. Mind yourself here.', `This is ${G.name}'s beach. Who let you ashore?`]);
    if (a.role === 'chief') return pick(rng, ['Back from the sea, are you? Good. The brethren need prizes.', 'There\'s a merchantman out there with your name on her cargo.', 'Sit, sit. Drink. Then go and make us rich.']);
    if (a.role === 'quartermaster') return pick(rng, ['Short of hands? I\'ve a few who\'d sail with you.', 'Your share\'s in the barrel. What\'s left of it.']);
    if (a.role === 'gunner') return pick(rng, ['Guns need feeding, captain.', 'I\'ve powder and shot, for the right price.']);
    return pick(rng, LINES.salt);
  },
  talk(th, a, npc, pid, S) {
    const out = [];
    const ours = sworn(S, pid, th.vars.guild);
    if (a.role === 'chief') {
      out.push({ id: 'hv_news', arg: tid(th), label: 'Any word of prizes on the water?' });
      if (!ours) out.push({ id: 'hv_swear', arg: tid(th), label: `I'd swear myself to ${(GUILDS[th.vars.guild] || GUILDS[0]).name}.` });
    }
    if (a.role === 'quartermaster' && ours) out.push({ id: 'hv_hand', arg: tid(th), label: `I need another hand aboard. (¤${HAND_FEE})` });
    if (a.role === 'gunner' && ours) out.push({ id: 'hv_shot', arg: tid(th), label: `Powder and shot for my guns. (¤${SHOT_FEE} for ${SHOT_N})` });
    if (a.role === 'salt') out.push({ id: 'hv_yarn', arg: tid(th), label: 'Tell me about this place.' });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const G = GUILDS[th.vars.guild] || GUILDS[0];
    const rng = new RNG(hash4(npc.id | 0, Math.floor(S.now), 0x4a9));
    switch (id) {
      case 'hv_news':
        return { lines: [pick(rng, [
          'Merchantmen out of the realms run the coast every few days. Fat, slow, and no guns worth the name. Take one and every realm\'s warships will know your face. They know it already, mind.',
          'The Red Hand have been poaching our waters. If you see their colours, you know what to do.',
          'A frigate of the realm came sniffing round the cove last week. Turned back when she saw our guns. They\'ll be back.',
        ])] };
      case 'hv_swear': {
        if (sworn(S, pid, th.vars.guild)) return { lines: ['You\'re one of us already.'] };
        S.asPid(pid, (p) => pledge(S.game, p, th.vars.guild, G));
        return { lines: ['Then you\'re one of us. Our ships won\'t fire on you, and our beach is yours.'] };
      }
      case 'hv_hand': {
        const ship = shipOfPid(S, pid);
        if (!ship) return { lines: ['A hand for what? You\'ve no ship. Come back with a deck under you.'] };
        if (purse(S, pid) < HAND_FEE) return { lines: [`¤${HAND_FEE}, and they're yours. They don't sail for promises.`] };
        S.asPid(pid, (p) => removeItem(p.inv, 'coin', HAND_FEE));
        const rec = makeCrew(hash4(th.seed, ship.crewRecs.length, Math.floor(S.now)), ship.type, 'vale', 3)[2];
        rec.role = rng.chance(0.4) ? 'gunner' : 'sailor';
        rec.temper = 'rogue';
        rec.look = { ...rec.look, hat: 'bandana', hatColor: '#1a1a1a' };
        ship.crewRecs.push(rec);
        addHand(S.game, ship, rec);
        return { lines: [`${rec.name.first || 'This one'}'ll do. Signed on as ${rec.role === 'gunner' ? 'a gunner' : 'a hand'}: ${ship.crewRecs.length} aboard ${ship.name} now.`] };
      }
      case 'hv_shot': {
        const ship = shipOfPid(S, pid);
        if (!ship) return { lines: ['Shot for what, your fists? Get a ship first.'] };
        if (purse(S, pid) < SHOT_FEE) return { lines: [`¤${SHOT_FEE}. Powder isn't free, even here.`] };
        S.asPid(pid, (p) => removeItem(p.inv, 'coin', SHOT_FEE));
        ship.ammo = (ship.ammo || 0) + SHOT_N;
        return { lines: [`${SHOT_N} rounds, stowed aboard ${ship.name}. Don't waste them on gulls.`] };
      }
      case 'hv_yarn':
        return { lines: [pick(rng, [
          `${th.vars.name}. ${G.name} have kept this beach since before the realms had warships. Nobody comes here who isn't one of us, or isn't lost.`,
          'The chief takes a share of every prize. The quartermaster finds you hands, the gunner sells you shot. And nobody asks where you got it.',
          'Half of us were honest sailors once. Then the realms stopped paying, or started hanging. Here, at least, the rum is free.',
        ])] };
      default:
        return null;
    }
  },
});
