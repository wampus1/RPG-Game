// Leads: a rope (made from string) to put on an animal and lead it about,
// or tie it up at a fence post. A beast that wants a fight (a wolf, a slime,
// a boar you've angered) strains against it the whole time, and once it has
// pulled long enough it snaps the lead and is loose again. Animals that
// don't mind being led never break free.
import { BLOCKS } from '../world/blocks.js';
import { addItem, removeItem, countItem } from './inventory.js';

// How long (seconds) a beast takes to pull free: an outright hostile one,
// and one that's only been angered.
const BREAK_HOSTILE = 14;
const BREAK_ANGRY = 20;

export function canLead(e) {
  return !!e && !e.dead && (e.kind === 'creature' || e.kind === 'monster');
}

// The fence posts (and anything fence-like) you can tie a lead to.
export function isPost(id) {
  return !!BLOCKS[id] && BLOCKS[id].render === 'fence';
}

export function leading(game) {
  return game.creatures.filter((c) => !c.dead && c.leadBy === game.player);
}

// Right-clicking a creature: a lead on it, off it, or back in your hand from
// the post. False when a lead has nothing to do with it (the horse's own
// business: taming, saddling, riding).
export function leadUse(game, c, held) {
  if (!canLead(c)) return false;
  const p = game.player;
  const say = (t, col = '#c8c8c8') => game.ui.msg(t, col, true);
  const name = c.name.toLowerCase();
  // Yours on the lead: let it go (unless it's your own horse, and you've
  // something other than a lead in hand: then it's about riding it).
  if (c.leadBy === p && (held === 'lead' || !c.own)) {
    letGo(game, c, true);
    say(`You slip the lead off the ${name}.`);
    return true;
  }
  // Tied up by you: back on the lead.
  if (c.leadTied) {
    if (Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z)) > 3) return say('Get a little closer.'), true;
    c.tie = null;
    c.tieR = undefined;
    c.leadTied = false;
    c.leadBy = p;
    say(`You untie the ${name} and take up the lead.`);
    game.audio?.play('equip');
    return true;
  }
  if (held !== 'lead') return false;
  // Someone else's, tied up: leave it be (the horse's own rules say why).
  if (c.tie || c.leadBy) {
    if (c.species === 'horse') return false;
    return say(`The ${name} is tied up already.`), true;
  }
  if (Math.max(Math.abs(c.x - p.x), Math.abs(c.z - p.z)) > 3) return say('Get a little closer.'), true;
  removeItem(p.inv, 'lead', 1);
  c.leadBy = p;
  c.strain = 0;
  c.target = null;
  c.path = null;
  c.face(p.x, p.z);
  game.audio?.play('equip');
  say(c.hostileNow ? `You get a lead on the ${name}. It won't stand for it long!` : `You put a lead on the ${name}.`, c.hostileNow ? '#ffb080' : '#a0e0a0');
  return true;
}

// Right-clicking a fence post with something on the lead: tie them all up
// there.
export function tieLeads(game, x, y, z) {
  const led = leading(game);
  if (!led.length) return false;
  for (const c of led) {
    c.leadBy = null;
    c.leadTied = true;
    c.tie = { x, y, z };
    c.tieR = 1;
    c.thinkT = 0;
  }
  game.audio?.play('equip');
  game.ui.msg(led.length > 1 ? `You tie the animals up at the post.` : `You tie the ${led[0].name.toLowerCase()} up at the post.`, '#c8e0ff', true);
  return true;
}

// Off the lead, and the lead back in your pack (or lost, if it snapped).
export function letGo(game, c, giveBack) {
  if (c.leadTied) {
    c.tie = null;
    c.tieR = undefined;
  }
  c.leadBy = null;
  c.leadTied = false;
  c.strain = 0;
  if (giveBack) {
    if (addItem(game.player.inv, 'lead', 1) > 0) game.spawnDrop('lead', 1, game.player.x, game.player.y, game.player.z, true);
  }
}

// A beast pulls free: the lead snaps.
function snap(game, c) {
  letGo(game, c, false);
  c.angry = c.S.mode === 'neutral' ? true : c.angry;
  c.target = game.player && !game.player.dead ? game.player : null;
  game.renderer.emit(c.x, c.y + 1, c.z, { n: 8, color: ['#c8a064', '#8a6a3a'], up: 30, speed: 40, life: 0.5, oy: -4 });
  game.audio?.play('break', c);
  if (Math.max(Math.abs(c.x - game.player.x), Math.abs(c.z - game.player.z)) < 16) game.ui.msg(`The ${c.name.toLowerCase()} snaps its lead and breaks free!`, '#ff9080');
}

// Each tick, for a creature on a lead (held, or tied to a post). True when
// that's all it does this tick.
export function leadTick(c, dt) {
  const game = c.game;
  // Straining to get away (or at you).
  if (c.hostileNow) {
    c.strain = (c.strain || 0) + dt / (c.S.mode === 'hostile' ? BREAK_HOSTILE : BREAK_ANGRY);
    if (!c.moving && c.rng.chance(dt * 1.2)) {
      c.doAction(0.2);
      game.renderer.emit(c.x, c.y, c.z, { n: 2, color: ['#9a8a6a', '#6a5a4a'], up: 8, speed: 14, life: 0.4, oy: 6 });
    }
    if (c.strain >= 1) {
      snap(game, c);
      return false;
    }
  }
  const h = c.leadBy;
  if (!h) return false;
  if (h.dead || h.raft) {
    letGo(game, c, h === game.player);
    return false;
  }
  if (c.moving) return true;
  const dx = h.x - c.x;
  const dz = h.z - c.z;
  const d = Math.max(Math.abs(dx), Math.abs(dz));
  // Too far behind: the lead slips out of your hand.
  if (d > 9) {
    letGo(game, c, h === game.player);
    if (h === game.player) game.ui.msg(`The lead slips out of your hand. The ${c.name.toLowerCase()} is loose.`, '#ffb080');
    return false;
  }
  if (d <= 2) {
    if (c.rng.chance(dt * 0.6)) c.face(h.x, h.z);
    return true;
  }
  // Pulled along after you.
  const sx = Math.sign(dx);
  const sz = Math.sign(dz);
  const tries = Math.abs(dx) >= Math.abs(dz) ? [[sx, 0], [0, sz]] : [[0, sz], [sx, 0]];
  const dur = Math.min(c.S.step, 0.24);
  for (const [ox, oz] of tries) if ((ox || oz) && c.tryStep(c.x + ox, c.z + oz, dur)) return true;
  return true;
}

// For saving: how many leads are out on animals (creatures aren't saved,
// so the leads come back to your pack on loading).
export function leadsOut(game) {
  return game.creatures.filter((c) => !c.dead && (c.leadBy === game.player || c.leadTied)).length;
}

export function hasLead(game) {
  return countItem(game.player.inv, 'lead') > 0;
}
