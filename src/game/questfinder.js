// (Round 73) The one person a quest of yours sends you to (to meet, talk
// to, hand something to, or back to whoever asked once it's done): while
// you're in the same town as them, a marker over their head, and an arrow
// at the edge of the screen when they're off it. Worked out a few times a
// second (see Game.update); drawn by render/oldplaces.js.
import { entOf, pidOf } from '../sim/saga/refs.js';

const PERSON_KINDS = new Set(['meet', 'talk', 'deliver', 'find', 'escort', 'investigate', 'fetch', 'retrieve']);

export function questTargets(game) {
  const S = game.sim && game.sim.saga;
  const p = game.player;
  if (!S || !p || game.dungeon) return [];
  const ow = game.world.ow;
  const here = ow.settlementAt(p.x, p.z);
  if (!here) return [];
  const pid = pidOf(p);
  const out = [];
  for (const t of S.openTasks()) {
    if (!S.claimedBy(t, pid)) continue;
    // Done and to be handed in: whoever asked. Otherwise the one it's for.
    const ref = t.ready && t.giver ? t.giver : PERSON_KINDS.has(t.kind) ? t.target : null;
    if (!ref) continue;
    const e = entOf(S, ref);
    if (!e || e.dead || e === p) continue;
    if (ow.settlementAt(e.x, e.z) !== here) continue;
    out.push({ e, title: t.title });
    if (out.length >= 3) break;
  }
  return out;
}

export function updateQuestFinder(game, dt) {
  game.questFinderT = (game.questFinderT || 0) - dt;
  if (game.questFinderT > 0) return;
  game.questFinderT = 0.5;
  try {
    game.questFinder = questTargets(game);
  } catch {
    game.questFinder = [];
  }
}

// Drawn over the world.
export function drawQuestFinder(r, game) {
  const L = game.questFinder;
  if (!L || !L.length) return;
  const ctx = r.ctx;
  const t = r.time;
  for (const { e } of L) {
    if (e.dead) continue;
    const rp = e.renderPos ? e.renderPos() : e;
    const [u, v] = r.toView(rp.x, rp.z);
    const x = Math.round(u * 16 - r.camX + 8);
    const y = Math.round(v * 16 - rp.y * 12 + 12 - r.camY - 40 + Math.sin(t * 4) * 2);
    const m = 14;
    if (x > m && x < r.vw - m && y > m && y < r.vh - m) {
      // Over their head: a gold arrow pointing down at them.
      ctx.fillStyle = '#1a1000';
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 6 + i - 1, y + i - 1, 14 - i * 2 + 2, 2);
      ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ffe070' : '#ffb030';
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 6 + i, y + i, 12 - i * 2, 1);
      ctx.fillRect(x - 2, y - 5, 4, 5);
    } else {
      // Off the screen: an arrow at its edge, pointing their way.
      const cx = r.vw / 2;
      const cy = r.vh / 2;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min((r.vw / 2 - m) / Math.abs(dx || 1e-6), (r.vh / 2 - m) / Math.abs(dy || 1e-6));
      const ex = cx + dx * k;
      const ey = cy + dy * k;
      const ux = dx / d;
      const uy = dy / d;
      ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ffe070' : '#ffb030';
      ctx.beginPath();
      ctx.moveTo(ex + ux * 8, ey + uy * 8);
      ctx.lineTo(ex - uy * 6 - ux * 4, ey + ux * 6 - uy * 4);
      ctx.lineTo(ex + uy * 6 - ux * 4, ey - ux * 6 - uy * 4);
      ctx.closePath();
      ctx.fill();
    }
  }
}
