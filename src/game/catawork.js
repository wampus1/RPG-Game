// (Round 103) The Imperial Catacomb at work (laid out by world/deeps/
// catacomb.js): its lamps (lit by the fossors, snuffed by the lemures, lit
// again by you; where they're out, the lemures can't be touched); its
// shelf-graves (break one open for its grave goods, though a dead hand may
// close on your wrist, and the fossors will remember it); the busts of the
// ancestors, honoured in the order of their descent to open the family's
// tomb (wrongly, and the lemures come); and the eagle fallen, the ranks
// wavering.
//
// What's been done (the graves robbed, the busts honoured, the tomb
// opened) is kept in the floor's state, and put back when the floor's made
// again (see restore).
import { FY } from '../world/dungeongen.js';
import { B } from '../world/blocks.js';
import { addItem } from './inventory.js';

const k2 = (x, z) => `${x},${z}`;
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const mine = (run) => (run.state.catacomb ||= { robbed: {}, honoured: {}, opened: {} });
// What's going on about the floor this visit (not saved).
export const ccT = (run) => (run.cataT ||= { told: {}, opening: [], step: {} });
const isCata = (run) => run && run.rec && run.rec.type === 'catacomb';
export const runOf = (game, x) => game.runAt?.(x) || game.dungeon || null;
// The floor's lamps (where they stand).
export const lampsOf = (run) => (isCata(run) && run.data.lamps) || [];
// Is there a lamp burning within `r` of (x, z)?
export function litNear(run, x, z, r = 4) {
  const w = run.game.world;
  for (const l of lampsOf(run)) if (Math.abs(l.x - x) <= r && Math.abs(l.z - z) <= r && w.getState(l.x, l.y || FY, l.z)) return true;
  return false;
}

// ------------------------------------------------------------ put back
export function restore(run) {
  if (!isCata(run)) return;
  const w = run.game.world;
  const S = mine(run);
  for (const q of run.data.loculi || []) if (S.robbed[k2(q.x, q.z)]) for (const y of [FY, FY + 1]) w.setBlock(q.x, y, q.z, B.cc_loculi_open);
  for (const t of run.data.busts || []) {
    const n = S.honoured[k2(t.door.x, t.door.z)] || 0;
    for (const b of t.busts) if (t.order.indexOf(b.kind) < n) w.setState(b.x, FY, b.z, true);
    if (S.opened[k2(t.door.x, t.door.z)]) for (const y of [FY, FY + 1]) w.setBlock(t.door.x, y, t.door.z, B.air);
  }
}

// ------------------------------------------------------------ clicked
export function sayOf(b) {
  switch (b.name) {
    case 'cc_columbarium': return 'Little arched niches, row on row, an urn of ashes in most, a name under each.';
    case 'cc_skulls': return 'Skulls, stacked in rows, and the long bones laid between them.';
    case 'cc_fresco': return 'A garden painted on the plaster: a garland, a peacock, faded to ochre and red.';
    case 'cc_dove': return 'A white dove with an olive sprig, painted over a vine.';
    case 'cc_handhole': return 'A shelf-grave broken in from inside. It is very dark in there.';
    case 'cc_loculi_open': return 'A shelf-grave, broken open. Someone is still in it.';
    case 'cc_inscription': return 'A marble tablet, its letters cut deep.';
    case 'cc_bones': return 'Bones, and a skull grinning on top of them.';
    case 'cc_sarcophagus': return 'A marble sarcophagus, carved with rippling flutes.';
    default: return null;
  }
}

export function interact(run, x, y, z, b) {
  if (!isCata(run)) return false;
  const game = run.game;
  const p = game.player;
  const S = mine(run);
  const w = game.world;
  switch (b.interact) {
    // A lamp: lit again (with whatever you carry to strike a light).
    case 'cc_lamp': {
      if (w.getState(x, y, z)) {
        game.ui.msg('The little flame burns steady. The dark keeps its distance from it.', '#ffd890');
        return true;
      }
      w.setState(x, y, z, true);
      game.lightDirty = true;
      game.renderer.emit(x, y + 1.2, z, { n: 10, color: ['#ffd46a', '#ff9a2a', '#fff8d0'], up: 10, speed: 6, life: 0.6, glow: true });
      game.audio?.play('torch', { x, z });
      if (!ccT(run).told.lamp) {
        ccT(run).told.lamp = true;
        game.ui.msg('You light the lamp again. (Where the lamps are out, the lemures can\'t be touched: keep them lit.)', '#ffd890');
      } else game.ui.msg('You light the lamp again.', '#ffd890');
      return true;
    }
    // A sealed shelf-grave: broken open, for what's in it.
    case 'cc_loculus': {
      const q = (run.data.loculi || []).find((l) => l.x === x && l.z === z);
      for (const yy of [FY, FY + 1]) w.setBlock(x, yy, z, B.cc_loculi_open);
      game.audio?.play('crumble', { x, z });
      game.renderer.emit(x, FY + 1, z + 1, { n: 14, color: ['#a8673e', '#844a30', '#c8bc9c'], up: 20, speed: 20, gravity: 120, life: 0.7 });
      S.robbed[k2(x, z)] = true;
      const goods = [];
      if (!q || q.goods) {
        goods.push(['old_coin', 1 + Math.floor(Math.random() * 4)]);
        if (Math.random() < 0.18) goods.push([Math.random() < 0.5 ? 'gem' : 'gold_ingot', 1]);
      }
      const got = goods.filter(([k, n]) => addItem(p.inv, k, n) < n);
      // (Sometimes the one in it doesn't care to be robbed.)
      if (Math.random() < 0.22) {
        p.rootT = Math.max(p.rootT || 0, 1.2);
        game.damage(p, 3, null);
        game.renderer.floatText(x, FY + 2.4, z + 1, 'a hand closes on your wrist!', '#d8c8a0');
        game.audio?.play('bones', { x, z });
      }
      game.ui.msg(got.length ? `You break the tiles away. In among the bones: ${got.map(([k, n]) => (k === 'old_coin' ? `${n} old coin${n > 1 ? 's' : ''}` : k === 'gem' ? 'a gem' : 'a little gold')).join(', ')}.` : 'You break the tiles away. Only bones, and the dust of a shroud.', '#d8c8a0');
      robbed(run, p);
      return true;
    }
    // A bust of an ancestor: honoured, in its turn.
    case 'cc_bust':
      return honour(run, x, z);
    case 'cc_tombdoor':
      game.ui.msg('Two leaves of marble, bronze rings on them, the family\'s name over it. Shut fast, and no keyhole.', '#d8d0c0');
      return true;
  }
  return false;
}

// The graves robbed: the fossors stop their work to look; rob again, and
// they come for you.
function robbed(run, p) {
  const game = run.game;
  const S = mine(run);
  const n = Object.keys(S.robbed).length;
  const fossors = run.creatures().filter((c) => !c.dead && c.species === 'fossor' && !c.angry);
  if (!fossors.length) return;
  if (n === 1) {
    for (const c of fossors) game.renderer.floatText(c.x, c.y + 2.6, c.z, '...', '#d8c8a0');
    game.ui.msg('Somewhere along the gallery, the fossors have stopped digging. They are looking at you.', '#d8c8a0', true);
    return;
  }
  provoke(run, p, p, 'graves');
}
// The fossors given cause: every one near `at` turns on whoever gave it.
export function provoke(run, src, at, why = 'struck') {
  const game = run.game;
  let n = 0;
  for (const c of run.creatures()) {
    if (c.dead || c.species !== 'fossor' || c.angry) continue;
    if (dist(c, at) > 14 && c !== at) continue;
    c.angry = true;
    c.peaceful = false;
    c.target = src;
    if (c.dormant) run.wake?.(c);
    n++;
  }
  const T = ccT(run);
  if (n && !T.told[why]) {
    T.told[why] = true;
    game.ui.msg(why === 'graves' ? 'The fossors put down their lamps and take up their picks. They have buried a great many people.' : 'The fossors turn from their work, all of them at once.', '#e0a070', true);
  }
}
// A bust touched: honoured in its turn (its fillet shines), or out of turn
// (all of them go dark, and the house's dead come up to see who dares).
function honour(run, x, z) {
  const game = run.game;
  const w = game.world;
  const S = mine(run);
  const t = (run.data.busts || []).find((q) => q.busts.some((b) => b.x === x && b.z === z));
  const bust = t && t.busts.find((b) => b.x === x && b.z === z);
  if (!t || !bust) {
    game.ui.msg('A bust on a pillar, its name worn away.', '#d8d0c0');
    return true;
  }
  const dk = k2(t.door.x, t.door.z);
  const name = (t.names && t.names[bust.kind]) || 'an ancestor';
  if (S.opened[dk]) {
    game.ui.msg(`${name}. The house is open to you.`, '#e8d890');
    return true;
  }
  const n = S.honoured[dk] || 0;
  const at = t.order.indexOf(bust.kind);
  if (at < n) {
    game.ui.msg(`${name}, already honoured.`, '#e8d890');
    return true;
  }
  if (at === n) {
    S.honoured[dk] = n + 1;
    w.setState(x, FY, z, true);
    game.lightDirty = true;
    game.renderer.emit(x, FY + 1.6, z, { n: 12, color: ['#fff0a0', '#ecc848'], up: 16, speed: 10, life: 0.8, glow: true });
    game.renderer.floatText(x, FY + 3.2, z, name, '#ffe890');
    game.audio?.play('chime', { x, z });
    if (n + 1 < t.order.length) {
      game.ui.msg(`You lay your hand on the bust of ${name}, and a fillet of gold about its pillar shines.`, '#e8d890');
      return true;
    }
    S.opened[dk] = true;
    ccT(run).opening.push({ ...t.door, t: 1.6 });
    game.ui.msg('The last of the house honoured: all four fillets blaze, and the family\'s tomb grinds open.', '#ffe890', true);
    game.audio?.play('rumble', t.door);
    return true;
  }
  // Out of turn: the fillets go dark, and the dead come.
  S.honoured[dk] = 0;
  for (const b of t.busts) w.setState(b.x, FY, b.z, false);
  game.lightDirty = true;
  game.renderer.floatText(x, FY + 3.2, z, `${name}?`, '#c8b8d8');
  game.ui.msg(`Not ${name}, not yet. The fillets go dark, and the air goes cold: the dead of the house are coming to see who dares. (Read the tree on the wall.)`, '#c8b8d8', true);
  game.audio?.play('whisper', { x, z });
  const room = t.room;
  let k = 0;
  for (const [ox, oz] of [[-2, 2], [2, 2], [0, 3]]) {
    if (k >= 2) break;
    const s = game.findFreeSpot?.(x + ox, z + oz, 3);
    if (!s) continue;
    const c = run.spawn('lemur', s.x, s.y, s.z, { room });
    if (c) {
      c.target = game.player;
      game.renderer.emit(s.x, s.y + 1, s.z, { n: 14, color: ['#a8b8c8', '#d8e0e8'], up: 20, speed: 16, life: 0.8, shape: 'puff' });
      k++;
    }
  }
  return true;
}
// The eagle down: every shade near it wavers a moment, out of its ranks.
export function waver(run, c) {
  const game = run.game;
  let n = 0;
  for (const o of run.creatures()) {
    if (o.dead || o.species !== 'legion_shade' || dist(o, c) > 7) continue;
    o.stunT = Math.max(o.stunT || 0, 1.6);
    o.rankedT = 0;
    game.renderer.floatText(o.x, o.y + 2.4, o.z, 'wavers', '#c8b890');
    n++;
  }
  game.renderer.floatText(c.x, c.y + 3, c.z, 'THE EAGLE FALLS!', '#ffe080');
  if (n && !ccT(run).told.eagle) {
    ccT(run).told.eagle = true;
    game.ui.msg('The eagle goes down, and the ranks about it waver!', '#ffe080', true);
  }
}

// One of the catacomb's own fallen.
export function onKill(run, e) {
  if (!isCata(run)) return;
  // (A fossor's fellows, when he's cut down: see provoke.)
  if (e.species === 'fossor') {
    const p = run.game.player;
    provoke(run, p, e, 'struck');
  }
}

// ------------------------------------------------------------ each step
export function tick(run, dt) {
  if (!isCata(run)) return;
  const game = run.game;
  const w = game.world;
  const T = ccT(run);
  const r = game.renderer;
  // The ranks an aquilifer's dressed come undressed when it's gone.
  for (const c of run.creatures()) if (c.rankedT > 0) c.rankedT -= dt;
  // The family's tomb opening.
  for (const o of T.opening) {
    o.t -= dt;
    if (Math.random() < dt * 12) r.emit(o.x, FY + Math.random() * 2, o.z, { n: 1, color: ['#e8e0d0', '#c8bc9c'], up: 10, speed: 20, life: 0.5 });
    if (o.t <= 0) {
      for (const y of [FY, FY + 1]) if (w.getBlock(o.x, y, o.z) === B.cc_tombdoor) w.setBlock(o.x, y, o.z, B.air);
      game.audio?.play('creak', o);
      game.lightDirty = true;
    }
  }
  T.opening = T.opening.filter((o) => o.t > 0);
  // The dark, the first time you're in it with a lemur.
  if (!T.told.dark) {
    const p = game.player;
    for (const c of run.creatures()) {
      if (c.dead || c.species !== 'lemur' || dist(c, p) > 6 || litNear(run, c.x, c.z, 4)) continue;
      T.told.dark = true;
      game.ui.msg('A grey shape drifts out of the dark, and the lamps near it gutter out. (Lemures can\'t be touched in the dark: light the lamps, or fight them by one.)', '#b8c8d8', true);
      break;
    }
  }
}
