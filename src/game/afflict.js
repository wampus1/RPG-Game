// What the islands' masters do to you, rather than to their halls (see
// bosses_kharos.js, bosses_myrrow.js and bosses_grove.js): the states they
// leave you in, each with its own way out.
//   mesmerised (the Moth-Mother's eyes: your feet go the wrong way);
//   swallowed (into the Urn-Mother: strike, and strike, to burst out);
//   glazed (the Kiln-Priest's glaze: three coats and you're fired solid);
//   spore-laden (the Spore Colossus: roll to shake them off before they
//     bloom on you);
//   soul-taken (the Lantern-Lord keeps a piece of you in a lantern: break
//     it to have it back);
//   plundered (Makoa Sharktooth: knock it back out of him);
//   disarmed (the Slag Titan's lodestone tears iron out of your hand);
//   inked (the Kraken's ink: nothing to see but what's right by you).
// All of it is put right when the fight's over, one way or another (see
// settleAfflictions).
import { ITEMS } from '../world/items.js';
import { B } from '../world/blocks.js';
import { addItem, countItem, removeItem } from './inventory.js';

const say = (game, e, text, color) => game.renderer?.floatText?.(e.x, e.y + 2.6, e.z, text, color);

// ------------------------------------------------------------ mesmerised
export function mesmerise(game, p, secs) {
  p.mazeT = Math.max(p.mazeT || 0, secs);
  say(game, p, 'MESMERISED', '#e0b0ff');
  if (!game.toldMaze) game.ui.msg('Mesmerised by her eyes: your feet go the wrong way! (Look away when her wings open.)', '#e0b0ff', true);
  game.toldMaze = true;
}

// ------------------------------------------------------------ swallowed
// Into `by`: held, out of sight, burning; every blow you try is a shove
// at the inside of it (`need` of them to burst out); `max` seconds and it
// spits you out anyway, the worse for it.
export function swallow(game, p, by, { need = 7, max = 6, dmg = 1, spit = 6 } = {}) {
  if (p.swallowed || p.dead) return false;
  p.swallowed = { by, need, got: 0, t: 0, max, dmg, spit, acc: 0 };
  p.grabbedT = Math.max(p.grabbedT || 0, max + 1);
  p.swing = null;
  p.blocking = false;
  say(game, p, 'SWALLOWED!', '#ffb070');
  game.ui.msg(`${by.S.name} swallows you! Strike, and strike, to burst out!`, '#ffb070', true);
  game.audio?.play('gulp', by);
  return true;
}

// A blow struck from inside.
export function struggle(game, p) {
  const s = p.swallowed;
  if (!s) return false;
  s.got++;
  game.shake = Math.min(1.2, (game.shake || 0) + 0.25);
  say(game, s.by, `${s.got}/${s.need}`, '#ffe0a0');
  game.audio?.play('thud', s.by);
  s.by.flash = 0.1;
  if (s.got >= s.need) release(game, p, true);
  return true;
}

function release(game, p, burst) {
  const s = p.swallowed;
  if (!s) return;
  p.swallowed = null;
  p.grabbedT = 0;
  const c = s.by;
  if (burst) {
    say(game, p, 'BURST FREE!', '#ffe070');
    game.ui.msg(`You burst out of ${c.S.name}!`, '#ffe070', true);
    c.stunT = Math.max(c.stunT || 0, 2.5);
    c.exposedT = Math.max(c.exposedT || 0, 3);
    game.renderer?.emit?.(c.x, c.y + 1.4, c.z, { n: 30, color: ['#e8dcc8', '#8a6a4a', '#ffb070'], up: 50, speed: 70, gravity: 120, life: 0.8 });
  } else {
    game.damage(p, s.spit, c);
    p.stunT = Math.max(p.stunT || 0, 0.8);
    say(game, p, 'spat out', '#c8b8a0');
  }
  // (Out onto the floor a pace or two from it.)
  const a = Math.random() * Math.PI * 2;
  for (let r = 2; r <= 4; r++) {
    const x = Math.round(c.x + Math.cos(a) * r);
    const z = Math.round(c.z + Math.sin(a) * r);
    const y = game.world.findStandY(x, z, c.y);
    if (y === c.y && game.world.canStand(x, y, z) && !game.occupiedBySolid(x, y, z, p)) {
      p.teleport(x, y, z);
      game.moveEntity?.(p, x, y, z);
      break;
    }
  }
}

// ------------------------------------------------------------ glazed
// A coat of the Kiln-Priest's glaze; three and you're fired: set solid a
// moment, and burned.
export function glaze(game, p, by, n = 1) {
  if (p.dead) return;
  p.glaze = Math.min(3, (p.glaze || 0) + n);
  p.glazeT = 7;
  p.glazeBy = by;
  if (p.glaze >= 3) {
    p.glaze = 0;
    p.grabbedT = Math.max(p.grabbedT || 0, 1.8);
    p.stunT = Math.max(p.stunT || 0, 1.8);
    game.damage(p, Math.max(1, Math.round(8 * (by.dmgMult || 1))), by);
    say(game, p, 'FIRED SOLID!', '#ffb040');
    game.renderer?.emit?.(p.x, p.y + 1, p.z, { n: 24, color: ['#ffe0a0', '#ff9040', '#ffffff'], up: 40, speed: 50, life: 0.7, glow: true });
    game.audio?.play('glass', p);
  } else {
    say(game, p, `glazed ${'●'.repeat(p.glaze)}${'○'.repeat(3 - p.glaze)}`, '#ffd080');
    if (!game.toldGlaze) game.ui.msg('Glazed! A third coat and you\'re fired solid. It flakes off in time, and a hard blow to the Kiln-Priest cracks a coat off you.', '#ffd080', true);
    game.toldGlaze = true;
  }
}

// A hard blow to him chips a coat off you.
export function chipGlaze(game, p) {
  if (!(p.glaze > 0)) return;
  p.glaze--;
  say(game, p, 'the glaze cracks', '#ffe0a0');
}

// ------------------------------------------------------------ spores
// Spores taking root on you (`n` of a whole bloom); a roll shakes some off.
export function sporeUp(game, p, by, n) {
  if (p.dead) return;
  p.spores = Math.min(1, (p.spores || 0) + n);
  p.sporeBy = by;
  if (!game.toldSpores) game.ui.msg('Spores are taking root on you! Roll to shake them off before they bloom.', '#c8f070', true);
  game.toldSpores = true;
  if (p.spores >= 1) {
    p.spores = 0;
    game.damage(p, Math.max(1, Math.round(6 * (by.dmgMult || 1))), by);
    say(game, p, 'THE SPORES BLOOM!', '#c8f070');
    game.renderer?.emit?.(p.x, p.y + 1, p.z, { n: 30, color: ['#c8f070', '#8ac040', '#f0ffc0'], up: 30, speed: 50, life: 0.9, shape: 'puff' });
    game.audio?.play('void', p);
    spawnNear(game, 'spore_puffer', { x: p.x, y: p.y, z: p.z });
  }
}
function spawnNear(game, species, at) {
  for (let i = 0; i < 10; i++) {
    const x = at.x + Math.round((Math.random() - 0.5) * 4);
    const z = at.z + Math.round((Math.random() - 0.5) * 4);
    const y = game.world.findStandY(x, z, at.y);
    if (y !== at.y || game.entityAt?.(x, y, z) || (x === at.x && z === at.z)) continue;
    return game.spawnMonster(species, x, y, z, {});
  }
  return null;
}
export function shakeSpores(game, p) {
  if (!(p.spores > 0)) return;
  p.spores = Math.max(0, p.spores - 0.4);
  say(game, p, p.spores > 0 ? 'some spores shaken off' : 'spores shaken off!', '#e0ffb0');
  game.renderer?.emit?.(p.x, p.y + 0.8, p.z, { n: 12, color: ['#c8f070', '#8ac040'], up: 20, speed: 40, life: 0.6, shape: 'puff' });
}

// ------------------------------------------------------------ souls
// A heart of you taken into a lantern of `by`'s (its `souls`).
export function takeSoul(game, p, by, lantern) {
  if (p.dead || p.maxHp <= 4) return false;
  p.maxHp -= 1;
  p.hp = Math.min(p.hp, p.maxHp);
  p.soulsTaken = (p.soulsTaken || 0) + 1;
  lantern.souls = (lantern.souls || 0) + 1;
  lantern.soulOf = p;
  say(game, p, 'a piece of your soul is taken!', '#80e8d0');
  game.renderer?.effect?.({ type: 'siphon', wx: p.x, wy: p.y + 1, wz: p.z, tx: lantern.x, ty: lantern.y + 1, tz: lantern.z, life: 0.7, oy: -6, n: 12, amp: 3, color: ['#80e8d0', '#e0fff8'] });
  if (!game.toldSouls) game.ui.msg('The Lantern-Lord keeps a piece of your soul in a lantern (a heart less). Break the lantern to take it back!', '#80e8d0', true);
  game.toldSouls = true;
  return true;
}
// A lantern broken (or its keeper fallen): what it held comes home.
export function freeSouls(game, lantern) {
  const p = lantern.soulOf;
  const n = lantern.souls || 0;
  if (!p || !n) return;
  lantern.souls = 0;
  p.maxHp += n;
  p.soulsTaken = Math.max(0, (p.soulsTaken || 0) - n);
  p.hp = Math.min(p.maxHp, p.hp + n);
  say(game, p, `+${n} soul${n > 1 ? 's' : ''} returned`, '#e0fff8');
  game.renderer?.effect?.({ type: 'siphon', wx: lantern.x, wy: lantern.y + 1, wz: lantern.z, tx: p.x, ty: p.y + 1, tz: p.z, life: 0.7, oy: -6, n: 12, amp: 3, color: ['#e0fff8', '#80e8d0'] });
}

// ------------------------------------------------------------ plunder
// What `by` takes off you with a blow: a fifth of your coin, and a thing
// from your pack (never what you're holding or wearing).
export function plunder(game, p, by) {
  if (p.dead || (by.plunderT || 0) > 0) return;
  by.plunderT = 1.6;
  const loot = (by.loot ||= []);
  const coins = countItem(p.inv, 'coin');
  const take = coins > 0 ? Math.max(Math.min(coins, 3), Math.floor(coins * 0.2)) : 0;
  let what = '';
  if (take > 0) {
    removeItem(p.inv, 'coin', take);
    loot.push({ item: 'coin', count: take });
    what = `${take} coin${take > 1 ? 's' : ''}`;
  }
  const held = p.heldItem?.();
  const packs = p.inv.map((s, i) => ({ s, i })).filter(({ s, i }) => s && s.item !== 'coin' && i !== p.selected && s.item !== held && ITEMS[s.item] && !['weapon', 'tool', 'armor'].includes(ITEMS[s.item].kind));
  if (packs.length && Math.random() < 0.6) {
    const { s } = packs[Math.floor(Math.random() * packs.length)];
    const n = Math.max(1, Math.ceil(s.count / 2));
    removeItem(p.inv, s.item, n);
    loot.push({ item: s.item, count: n });
    what += `${what ? ' and ' : ''}${n > 1 ? `${n} ` : ''}${ITEMS[s.item].name.toLowerCase()}`;
  }
  if (!what) return;
  say(game, p, `stolen: ${what}!`, '#ffd070');
  by.say?.(['Mine now!', 'Thanks for that!', 'Into the hoard!'][Math.floor(Math.random() * 3)], 1.6, '#e8e0c8');
  if (!game.toldPlunder) game.ui.msg('Sharktooth picks your pockets with every blow! Hit him hard to knock your things back out of him.', '#ffd070', true);
  game.toldPlunder = true;
}
// A hard blow knocks some of it back out (`all`: everything, as he falls).
export function spill(game, by, all = false) {
  const loot = by.loot || [];
  if (!loot.length) return;
  const n = all ? loot.length : 1;
  for (let i = 0; i < n && loot.length; i++) {
    const q = loot.shift();
    game.spawnDrop(q.item, q.count, by.x, by.y, by.z, true);
  }
  if (!all) say(game, by, 'your things spill out!', '#ffe070');
}

// ------------------------------------------------------------ disarmed
const BASE = (k) => String(k || '').split(/[+~]/)[0];
const IRON = /^(iron|gold|steel|kav)_|^(dagger|harpoon|mace|short_sword|sabre|hand_axe|flail|greatsword|battle_axe|warhammer|halberd|spear)$/;
export const ironHeld = (k) => !!k && IRON.test(BASE(k));
export const ironWorn = (p) => Object.values(p.equip || {}).some((k) => k && /iron|chain|plate|steel|mail|kav|gold/.test(BASE(k)));

// Iron torn out of your hand (to land some paces off), or you, by your
// iron, dragged in. What happened ('weapon', 'pulled' or null).
export function lodestone(game, p, by, drag) {
  const k = p.heldItem?.();
  if (ironHeld(k)) {
    const slot = p.inv[p.selected];
    p.inv[p.selected] = null;
    p.swing = null;
    const a = Math.random() * Math.PI * 2;
    let spot = null;
    for (let r = 3; r <= 5 && !spot; r++) {
      for (let j = 0; j < 8 && !spot; j++) {
        const aa = a + j * 0.8;
        const x = Math.round(p.x + Math.cos(aa) * r);
        const z = Math.round(p.z + Math.sin(aa) * r);
        const y = game.world.findStandY(x, z, p.y);
        if (y === p.y && game.world.canStand(x, y, z) && game.world.getBlock(x, y, z) !== B.lava) spot = { x, y, z };
      }
    }
    const at = spot || { x: p.x, y: p.y, z: p.z };
    game.spawnDrop(slot.item, slot.count, at.x, at.y, at.z, true);
    say(game, p, 'DISARMED!', '#a0c8ff');
    game.ui.msg(`${by.S.name}'s lodestone tears your ${ITEMS[BASE(k)]?.name?.toLowerCase() || 'weapon'} out of your hand! Go and pick it up.`, '#a0c8ff', true);
    game.audio?.play('clang', p);
    return 'weapon';
  }
  if (ironWorn(p)) {
    drag(game, p, by, 2);
    say(game, p, 'dragged in by your iron!', '#a0c8ff');
    return 'pulled';
  }
  say(game, p, 'nothing of iron on you', '#c8c8c8');
  return null;
}

// ------------------------------------------------------------ inked
export function ink(game, p, secs) {
  if (!(p.inkT > 0)) say(game, p, 'BLINDED BY INK', '#c8a0d0');
  p.inkT = Math.max(p.inkT || 0, secs);
}

// ------------------------------------------------------------ each frame
export function tickAfflictions(game, p, dt) {
  if (!p) return;
  // (Round 71) Infested by the Alinelidan: each worm's bite, every couple
  // of seconds, till they work their way out (one at a time).
  if (p.worms > 0) {
    p.wormBite = (p.wormBite || 0) + dt;
    if (p.wormBite >= 2) {
      p.wormBite = 0;
      game.dotHit = true;
      game.damage(p, p.worms, null);
      game.dotHit = false;
      game.renderer?.emit?.(p.x, p.y + 1, p.z, { n: 3, color: ['#c8e070', '#8a4a3a'], up: 10, speed: 10, life: 0.5 });
    }
    p.wormT = (p.wormT ?? 45) - dt;
    if (p.wormT <= 0) {
      p.worms--;
      p.wormT = 45;
      if (p.worms <= 0) say(game, p, 'the worms are out', '#c8e070');
    }
  }
  if (p.mazeT > 0) {
    p.mazeT -= dt;
    if (Math.random() < dt * 8) game.renderer?.emit?.(p.x, p.y + 2.1, p.z, { n: 1, color: ['#e0b0ff', '#ffffff', '#c890ff'], up: 6, speed: 14, life: 0.5, glow: true, shape: 'star' });
  }
  if (p.inkT > 0) p.inkT -= dt;
  if (p.glazeT > 0) {
    p.glazeT -= dt;
    if (p.glazeT <= 0 && p.glaze > 0) {
      p.glaze--;
      p.glazeT = p.glaze > 0 ? 7 : 0;
    }
  }
  if (p.spores > 0) {
    p.spores = Math.max(0, p.spores - dt * 0.02);
    if (Math.random() < dt * 10 * p.spores) game.renderer?.emit?.(p.x, p.y + 1, p.z, { n: 1, color: ['#c8f070', '#8ac040'], up: 8, speed: 8, life: 0.6, shape: 'puff' });
  }
  const s = p.swallowed;
  if (s) {
    if (s.by.dead || p.dead) {
      release(game, p, true);
      return;
    }
    s.t += dt;
    s.acc += dt;
    p.grabbedT = Math.max(p.grabbedT || 0, 0.5);
    if (s.acc >= 0.8) {
      s.acc = 0;
      game.dotHit = true;
      game.damage(p, s.dmg, s.by);
      game.dotHit = false;
    }
    if (s.t >= s.max) release(game, p, false);
  }
}

// What's on you, for the bar under a master's (see ui.js).
export function afflictionsOf(p) {
  const out = [];
  if (!p) return out;
  if (p.swallowed) out.push({ text: `SWALLOWED ${p.swallowed.got}/${p.swallowed.need}: STRIKE!`, color: '#ffb070' });
  if (p.mazeT > 0) out.push({ text: 'MESMERISED', color: '#e0b0ff' });
  if (p.glaze > 0) out.push({ text: `GLAZED ${'●'.repeat(p.glaze)}${'○'.repeat(3 - p.glaze)}`, color: '#ffd080' });
  if (p.spores > 0.05) out.push({ text: `SPORES ${'▮'.repeat(Math.ceil(p.spores * 5))}${'▯'.repeat(5 - Math.ceil(p.spores * 5))}`, color: '#c8f070' });
  if (p.soulsTaken > 0) out.push({ text: `SOUL -${p.soulsTaken}`, color: '#80e8d0' });
  if (p.inkT > 0) out.push({ text: 'INKED', color: '#c8a0d0' });
  if (p.worms > 0) out.push({ text: `INFESTED ×${p.worms}`, color: '#e0ff90' });
  return out;
}

// The fight over (won, lost or left): you're yourself again, your soul
// back, your things back.
export function settleAfflictions(game, boss = null) {
  const p = game.player;
  if (!p) return;
  if (p.swallowed) {
    p.swallowed = null;
    p.grabbedT = 0;
  }
  p.mazeT = 0;
  p.inkT = 0;
  p.worms = 0;
  p.glaze = 0;
  p.spores = 0;
  for (const c of game.creatures) if (c.souls && c.soulOf === p) freeSouls(game, c);
  if (p.soulsTaken > 0) {
    p.maxHp += p.soulsTaken;
    p.soulsTaken = 0;
  }
  // (What was stolen: dropped where the thief falls; if he's still
  // standing, you find it in your pockets after all.)
  const fallen = [].concat(boss || []);
  for (const c of fallen) {
    if (c.loot && c.loot.length) spill(game, c, true);
    if (c.souls) freeSouls(game, c);
  }
  for (const c of game.creatures) {
    if (!c.loot || !c.loot.length) continue;
    if (c.dead) spill(game, c, true);
    else {
      for (const q of c.loot) {
        const left = addItem(p.inv, q.item, q.count);
        if (left) game.spawnDrop(q.item, left, p.x, p.y, p.z, true);
      }
      c.loot = [];
    }
  }
}
