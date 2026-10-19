// (Round 124) An outworlder's mutations, at work (what each is: see
// hero.js MUTATIONS). Each its own gift and its own cost, none of them a
// trait of the islands' folk:
//   Third Eye: a blow foreseen every so often (halved); but the sun's glare
//     outdoors by day softens your own.
//   Glowing Spots: a light of your own at night and below ground (even in
//     the storm's black); but at night you're seen doing wrong from twice
//     as far.
//   Chitin Plates: every blow you take a little lighter; but your joints
//     are stiff (rolling costs more breath).
//   Gills: in water as fast as on land, and healing slowly there; but too
//     long out of it and you weaken.
//   Antennae: you feel the hostile things about you through stone and earth
//     (a ring where each stands); but no helmet or hat goes over them.
//   Dense Frame: blows harder, digging and chopping faster; but a heavier
//     tread.
//   Twin Hearts: once a day, a blow that would kill you doesn't; but food
//     does each of them less good.
import { mutationsOf } from './hero.js';
import { GROUND } from '../config.js';

export const has = (h, k) => mutationsOf(h).includes(k);

// How long between foreseen blows; how long out of water before the gills
// weaken you (seconds); how far tremor sense reaches, and how often.
export const FORESIGHT_EVERY = 15;
export const DRY_AFTER = 300;
export const TREMOR_RANGE = 22;
const TREMOR_EVERY = 4;

// Whose body this is: the one playing's, or (in a party) another player's,
// kept on their seat while it isn't theirs to play (see party.js).
function heroOf(game, p) {
  if (!p || p === game.player) return game.hero;
  const st = p.seat && p.seat.store;
  return (st && st.g && st.g.hero) || null;
}

// Full daylight, outdoors (the third eye's glare).
function inGlare(game, p) {
  const m = game.minute;
  if (m < 9 * 60 || m > 17 * 60) return false;
  if (game.dungeon && game.world.inInstance && game.world.inInstance(p.x)) return false;
  const b = p === game.player && game.buildingAtPlayer ? game.buildingAtPlayer() : null;
  return !b;
}

// A blow landing on you (`amount`, after armour): what your mutations make
// of it.
export function mutIncoming(game, p, source, amount) {
  const h = heroOf(game, p);
  if (!h || amount <= 0) return amount;
  if (has(h, 'chitin')) amount = Math.max(1, amount - 1);
  if (has(h, 'third_eye') && source && source !== p && !game.dotHit) {
    const m = (p.mut ||= {});
    // (Its cooldown in real seconds: see mutationTick.)
    if (!(m.foresee > 0)) {
      m.foresee = FORESIGHT_EVERY;
      amount = Math.max(1, Math.ceil(amount / 2));
      game.renderer?.floatText?.(p.x, p.y + 2.4, p.z, 'foreseen', '#c890ff');
    }
  }
  return amount;
}

// Your blow landing (`amount`, before the target's armour).
export function mutOutgoing(game, p, amount) {
  const h = heroOf(game, p);
  if (!h || amount <= 0) return amount;
  let k = 1;
  if (has(h, 'dense')) k *= 1.2;
  if (has(h, 'third_eye') && inGlare(game, p)) k *= 0.85;
  if (has(h, 'gills') && p.mut && p.mut.dry >= DRY_AFTER) k *= 0.9;
  return k === 1 ? amount : Math.max(1, Math.round(amount * k));
}

// A blow about to kill you: the second heart, once a day. Returns the
// blow as it lands.
export function mutLastBlow(game, p, amount) {
  const h = heroOf(game, p);
  if (!h || !has(h, 'twin_hearts') || p.hp - amount > 0) return amount;
  const m = (p.mut ||= {});
  if (m.heartDay === game.day) return amount;
  m.heartDay = game.day;
  const keep = Math.max(1, Math.ceil(p.maxHp / 3));
  if (p === game.player) game.ui.msg('Your second heart kicks in: you stay on your feet.', '#ff90a8');
  game.renderer?.floatText?.(p.x, p.y + 2.4, p.z, 'second heart', '#ff90a8');
  game.audio?.play('heart');
  return Math.max(0, p.hp - keep);
}

// Each frame, for the one playing.
export function mutationTick(game, p, dt) {
  const h = game.hero;
  const list = mutationsOf(h);
  if (!list.length || p.dead) return;
  const m = (p.mut ||= {});
  if (m.foresee > 0) m.foresee -= dt;
  // Gills: in water, healing; out of it, drying.
  if (list.includes('gills')) {
    const w = game.world;
    const wet = w.isWaterAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) || w.isWaterAt(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z));
    if (wet) {
      if (m.dry >= DRY_AFTER) game.ui.msg('The water soaks into your gills. You feel yourself again.', '#80d8ff');
      m.dry = 0;
      m.soak = (m.soak || 0) + dt;
      if (m.soak >= 4) {
        m.soak = 0;
        if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 1);
      }
    } else {
      const was = m.dry || 0;
      m.dry = was + dt;
      if (was < DRY_AFTER && m.dry >= DRY_AFTER) game.ui.msg('Your gills are drying out: you feel weaker. Get into water.', '#ffb080');
    }
  }
  // Antennae: the hostile things about you, felt through stone and earth.
  if (list.includes('antennae')) {
    m.tremor = (m.tremor || 0) - dt;
    if (m.tremor <= 0) {
      m.tremor = TREMOR_EVERY;
      for (const c of game.creatures || []) {
        if (c.dead || !c.hostileNow || Math.hypot(c.x - p.x, c.z - p.z) > TREMOR_RANGE) continue;
        game.renderer?.effect?.({ type: 'ring', wx: c.x, wy: (c.y ?? GROUND) + 0.1, wz: c.z, r0: 0.4, r1: 2.6, color: ['#c8a0ff', '#8060ff'], life: 0.9, oy: 0.1, flat: 0.5, thick: 1 });
      }
    }
  }
}

// What the light about you reaches (null: no say in it).
export function mutLight(h) {
  return has(h, 'glow') ? 5 : null;
}

// Can this be worn on the head? (Not over antennae.)
export function mutHeadOk(h) {
  return !has(h, 'antennae');
}
