// Time crystals (round 61): what a master leaves when it falls, of its tier
// (see entities/bosstier.js). Held at the way into an old place whose
// master is beaten and used, one turns the place back: the ground about
// the way in shivers, light runs backwards into it out of the air, the
// fallen-in stones lift and fit themselves together again, a great clock
// spins backwards over it all, and with a crack like a bell the place
// stands as it was before anyone went down: open, its floors made afresh,
// its master waiting again, at a tier above the crystal's (the third at
// most): everything in it harder, its chests richer, its master stronger.
import { VIEW_W, VIEW_H } from '../config.js';
import { restamp, siteBlocks } from '../world/sites.js';
import { BLOCKS } from '../world/blocks.js';
import { ledger } from '../sim/econ.js';
import { TIER_MAX, roman, CRYSTAL_COLORS } from '../entities/bosstier.js';
import { pidOf } from '../sim/saga/refs.js';

const ease = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const lerp = (a, b, k) => a + (b - a) * k;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The tier a crystal turns a place back to: one above its own (at most 3).
// (Round 93) How long after a pack's warning using it again goes ahead.
const WARN_MS = 30000;

export const restoredTier = (crystalTier) => Math.min(TIER_MAX, (crystalTier || 1) + 1);

// The old place whose way in is within a few paces of (x, z), if any.
export function placeNear(game, x, z, r = 6) {
  let best = null;
  let bd = r + 1;
  for (const d of game.sim.dungeons.all) {
    if (d.x === undefined) continue;
    const dd = Math.max(Math.abs(d.x - x), Math.abs(d.z - z));
    if (dd < bd) {
      bd = dd;
      best = d;
    }
  }
  return best;
}

// Why a crystal can't turn `rec` back just now (null if it can). `packsOk`:
// the packs left down there already warned of, and to be lost to time.
export function cantRestore(game, rec, packsOk = false) {
  if (!rec) return 'Hold it at the way into an old place, one whose master is beaten, and use it there.';
  if (!rec.cleared) return `${cap(rec.name)}'s master still waits below. There's nothing yet to turn back.`;
  const run = game.runs && game.runs.get(rec.id);
  if (run && run.players().length) return 'Someone is still down there. Not while they are.';
  const pk = (rec.packs || [])[0];
  if (pk && !packsOk) return `${pk.name ? `${pk.name}'s` : 'A'} pack still lies down there, on floor ${pk.floor + 1}. Fetch it up first, or use the crystal again and it's lost to time.`;
  return null;
}

// A crystal used (held, at the way in): the scene of it, and the place
// turned back at its height. True if it was used (or told why not).
export function useTimeCrystal(game, def, rec = null) {
  const p = game.player;
  if (game.dungeon) {
    game.ui.msg('Not down here: at the way in, up in the air.', '#c8c8c8');
    return true;
  }
  if (game.scene) return true;
  rec ||= placeNear(game, p.x, p.z);
  // (Round 93) Told of a pack still down there, and used again here: so be
  // it (the pack's lost to time with the rest).
  const warned = game.crystalWarned;
  const again = !!(rec && warned && warned.id === rec.id && warned.at === pidOf(p) && Date.now() - warned.t < WARN_MS);
  const why = cantRestore(game, rec, again);
  if (why) {
    if (rec && (rec.packs || []).length && !cantRestore(game, rec, true)) game.crystalWarned = { id: rec.id, at: pidOf(p), t: Date.now() };
    game.ui.msg(why, '#c8a0ff');
    game.audio?.play('error');
    return true;
  }
  game.crystalWarned = null;
  const tier = restoredTier(def.tier);
  const slot = p.inv[p.selected];
  if (slot && slot.item === def.key) {
    slot.count--;
    if (slot.count <= 0) p.inv[p.selected] = null;
  }
  const color = def.color || CRYSTAL_COLORS[def.tier] || '#c8a0ff';
  game.scene = timeTurn(game, rec, tier, color);
  // (Round 92) Everyone else about the way in sees it too (each on their
  // own screen; only the one who held it up turns the place back).
  const by = game.playerName || 'Someone';
  for (const q of game.everyone ? game.everyone() : []) {
    if (q === p || q.dead || Math.max(Math.abs(q.x - rec.x), Math.abs(q.z - rec.z)) > WITNESS_R) continue;
    game.asPlayer(q, () => {
      if (!game.scene && !game.dungeon) game.scene = timeTurn(game, rec, tier, color, { witness: true, by, holder: p });
    });
  }
  return true;
}

// (How near the way in another player must be to see it turned back.)
export const WITNESS_R = 48;

// The place as it was before anyone went down: open, its floors to be
// made afresh, its master waiting, at `tier`.
export function restoreDungeon(game, rec, tier) {
  const D = game.sim.dungeons;
  const run = game.runs && game.runs.get(rec.id);
  if (run && !run.players().length) {
    run.close?.();
    game.runs.delete(rec.id);
  }
  rec.cleared = false;
  rec.clearedBy = null;
  rec.clearedDay = null;
  rec.floors = {};
  rec.weakened = 0;
  rec.looted = 0;
  rec.fallen = [];
  rec.packs = [];
  rec.pack = null;
  rec.metBoss = false;
  rec.tier = Math.max(1, Math.min(TIER_MAX, tier));
  rec.restores = (rec.restores || 0) + 1;
  if (rec.type === 'kavorent') {
    rec.vaults = [1, 2, 3];
    rec.cores = Math.max(rec.cores ?? 0, 4);
  }
  const site = D.site(rec);
  if (site) {
    site.state = { cleared: false, open: rec.spire ? rec.spire.open : null, beaten: false };
    restamp(game.world, site);
    stepOut(game, site);
  }
  game.lightDirty = true;
  const L = rec.town !== null && rec.town !== undefined ? game.sim.layoutOf(rec.town) : null;
  if (L && L.econ) ledger(L, game.day, `${game.playerName} turned ${rec.name} back to what it was before anyone went down. Folk say its master is stronger than ever.`);
  return rec;
}

// (Round 114) Whoever was standing in the way in as it stood back up
// round them is stepped out in front of it, never shut up inside its
// stones: everyone within its bounds put on the nearest open ground
// outside them.
// (Can whoever's standing at (x, y, z) walk out of the bounds by
// themselves, a step at a time?)
function canWalkOut(w, x, y, z, inside) {
  if (!w.canStand(x, y, z, true)) return false;
  const seen = new Set([`${x},${y},${z}`]);
  const q = [[x, y, z]];
  while (q.length && seen.size < 600) {
    const [cx, cy, cz] = q.shift();
    if (!inside(cx, cz)) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ny = w.stepTarget(cx, cy, cz, cx + dx, cz + dz, true);
      if (ny < 0) continue;
      const k = `${cx + dx},${ny},${cz + dz}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([cx + dx, ny, cz + dz]);
    }
  }
  return false;
}
export function stepOut(game, site) {
  const w = game.world;
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  let y1 = -Infinity;
  for (const [dx, y, dz, id] of siteBlocks(site, site.state || {})) {
    if (!id || !BLOCKS[id] || BLOCKS[id].name === 'air') continue;
    x0 = Math.min(x0, site.x + dx);
    x1 = Math.max(x1, site.x + dx);
    z0 = Math.min(z0, site.z + dz);
    z1 = Math.max(z1, site.z + dz);
    y1 = Math.max(y1, y);
  }
  if (x0 > x1) return [];
  const inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  const moved = [];
  for (const q of game.everyone ? game.everyone() : [game.player]) {
    if (!q || q.dead) continue;
    const px = Math.floor(q.x);
    const pz = Math.floor(q.z);
    if (!inside(px, pz) || q.y > y1 + 2) continue;
    if (canWalkOut(w, px, Math.round(q.y), pz, inside)) continue;
    // (The nearest open ground outside, ring by ring out from them.)
    let spot = null;
    for (let r = 1; r < 24 && !spot; r++) {
      let bd = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = px + dx;
          const z = pz + dz;
          if (inside(x, z)) continue;
          const y = w.findStandY(x, z, site.h + 1);
          if (!(y > 0) || w.isWaterAt(x, y, z)) continue;
          const d = Math.hypot(dx, dz);
          if (d < bd) {
            bd = d;
            spot = { x, y, z };
          }
        }
      }
    }
    if (!spot) continue;
    if (game.asPlayer && game.teleportPlayer) game.asPlayer(q, () => game.teleportPlayer(spot.x, spot.y, spot.z));
    else q.teleport?.(spot.x, spot.y, spot.z);
    moved.push(q);
  }
  return moved;
}

// The scene: about seven seconds, everyone else held still.
// (`witness`: another player's, watching; `shown`: a guest's screen's copy
// of the host's. Neither turns the place back: only the one who held it up
// does, on the host.)
export function timeTurn(game, rec, tier, color, { witness = false, by = null, shown = false, holder = null } = {}) {
  const p = game.player;
  // (Whoever's holding it up: you, or the one you're watching.)
  const hold = holder || p;
  const site = game.sim.dungeons.site(rec);
  const h = (site && site.h) || p.y - 1;
  const at = { x: rec.x, y: h + 1, z: rec.z };
  const tint = CRYSTAL_COLORS[tier] || color;
  return {
    kind: 'timeturn', rec, tier, color, witness, by, shown, holder: hold, t: 0, dur: 7.2, lock: true,
    SNAP: 4.7,
    z0: game.renderer ? game.renderer.zoom || 1 : 1,
    get zoom() {
      const peak = Math.max(this.z0, 1.35);
      return lerp(this.z0, peak, ease(clamp01(this.t / 1.6)) * (1 - ease(clamp01((this.t - 6) / 1.2))));
    },
    focus() {
      const k = ease(clamp01(this.t / 1.4)) * (1 - ease(clamp01((this.t - 6.2) / 1)));
      return { x: lerp(p.x, at.x, k), y: lerp(p.y, at.y, k), z: lerp(p.z, at.z, k) };
    },
    update(g, dt) {
      // (Every screen plays its own copy: on the host, nothing of it is
      // sent on to anyone else's as well.)
      if (g.net && !g.remote) g.net.mute++;
      try {
        this.play(g, dt);
      } finally {
        if (g.net && !g.remote) g.net.mute--;
      }
    },
    play(g, dt) {
      const r = g.renderer;
      if (!this.started) {
        this.started = true;
        if (this.witness) g.ui.msg(`${by || 'Someone'} holds a crystal up at the way in. It stops ticking. Then it starts again, backwards.`, color);
        else g.ui.msg('You hold the crystal up. It stops ticking. Then it starts again, backwards.', color);
        g.audio?.play('riser');
        g.audio?.play('rune');
      }
      // The crystal held up, burning brighter.
      if (this.t < this.SNAP) {
        if (Math.random() < dt * 30) r.emit(hold.x, hold.y + 2.6, hold.z, { n: 1, color: [color, '#ffffff', tint], up: 10, speed: 14, life: 0.6, glow: true, gravity: -8, shape: 'star' });
        // (Ticking, quicker and quicker, as it runs back.)
        this.tick = (this.tick ?? 0) - dt;
        if (this.tick <= 0) {
          this.tick = Math.max(0.07, 0.5 - this.t * 0.1);
          g.audio?.play('tink', at);
        }
      }
      if (this.t > 1 && this.t < this.SNAP) {
        // Light running backwards out of the air into the way in: rings
        // closing in on it, motes drawn down to it from all round.
        this.ringT = (this.ringT ?? 0) - dt;
        if (this.ringT <= 0) {
          this.ringT = Math.max(0.18, 0.5 - (this.t - 1) * 0.08);
          r.effect?.({ type: 'ring', wx: at.x, wy: at.y, wz: at.z, r0: 90, r1: 4, color: [tint, '#ffffff', color], life: 0.7, oy: 2, flat: 0.5, thick: 2 });
        }
        for (let i = 0; i < 3; i++) {
          if (Math.random() > dt * 40) continue;
          const a = Math.random() * Math.PI * 2;
          const d = 3 + Math.random() * 4;
          r.emit(at.x + Math.cos(a) * d, at.y + 0.5 + Math.random() * 2, at.z + Math.sin(a) * d, { n: 1, color: [tint, '#ffffff', color], up: -6, speed: 4, life: 0.7, glow: true, gravity: 30 });
        }
        // The fallen stones lifting, turning, going back where they were.
        if (Math.random() < dt * 14) r.emit(at.x + (Math.random() - 0.5) * 3, at.y, at.z + (Math.random() - 0.5) * 3, { n: 1, color: ['#8a8270', '#5a5650', '#c8b898', tint], up: 40, speed: 6, life: 0.9, gravity: -30, size: 2 });
        g.shake = Math.max(g.shake || 0, 0.08 + 0.3 * clamp01((this.t - 1) / (this.SNAP - 1)));
      }
      // The snap: the place as it was.
      if (this.t >= this.SNAP && !this.done) {
        this.done = true;
        if (!this.witness && !this.shown) restoreDungeon(g, rec, tier);
        r.flashScreen?.('#ffffff', 0.8);
        g.shake = 1.3;
        g.hitStop = Math.max(g.hitStop || 0, 0.15);
        for (let i = 0; i < 4; i++) r.effect?.({ type: 'ring', wx: at.x, wy: at.y, wz: at.z, r0: 4 + i * 6, r1: 140 + i * 40, color: [tint, '#ffffff', color], life: 0.9 + i * 0.3, oy: 2, flat: 0.5, thick: 3 });
        r.emit(at.x, at.y + 1, at.z, { n: 60, color: [tint, '#ffffff', color, '#fff0c0'], up: 70, speed: 90, life: 1.2, glow: true, gravity: 30, shape: 'star' });
        g.audio?.play('boom', at);
        g.audio?.play('chime', at);
        g.audio?.play('reveal_great');
      }
    },
    // Over it all: the world goes the colour of old glass, rewinding bands
    // run up the screen, and a great clock's hands spin backwards over the
    // way in, faster and faster, till the crack of it.
    draw(ctx) {
      const t = this.t;
      const W = VIEW_W;
      const H = VIEW_H;
      const into = clamp01((t - 0.6) / 1.2);
      const out = clamp01((t - this.SNAP) / 0.9);
      const a = into * (1 - out);
      if (a <= 0) return;
      ctx.save();
      // (The tint, a little stronger as it runs.)
      ctx.globalAlpha = a * (0.16 + 0.12 * clamp01((t - 1) / 3));
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      // (Rewinding bands.)
      ctx.globalAlpha = a * 0.22;
      for (let i = 0; i < 5; i++) {
        const y = ((H - ((t * (90 + i * 37) + i * 61) % (H + 20))) | 0) - 10;
        ctx.fillStyle = i % 2 ? '#ffffff' : tint;
        ctx.fillRect(0, y, W, 2 + (i % 3));
      }
      // (The clock.)
      const cx = W / 2;
      const cy = H / 2 - 6;
      const R = 54 + 6 * Math.sin(t * 3);
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = tint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R - 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 12; i++) {
        const q = (i / 12) * Math.PI * 2;
        const L = i % 3 === 0 ? 3 : 2;
        ctx.fillRect(Math.round(cx + Math.cos(q) * (R - 10)) - 1, Math.round(cy + Math.sin(q) * (R - 10)) - 1, L, L);
      }
      // (Its hands, backwards: the long one a blur at the last.)
      const spin = -(t * t * 1.6);
      for (const [len, k, w] of [[R - 14, 1, 2], [R - 26, 1 / 12, 3]]) {
        const q = spin * k - Math.PI / 2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(q) * len, cy + Math.sin(q) * len);
        ctx.stroke();
      }
      ctx.fillStyle = tint;
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
      // (After the snap: the clock shatters outward, the tint fading.)
      if (out > 0) {
        ctx.globalAlpha = (1 - out) * 0.9;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 24; i++) {
          const q = (i / 24) * Math.PI * 2 + i;
          const d = R + out * 160 * (0.6 + (i % 5) * 0.12);
          ctx.fillRect(Math.round(cx + Math.cos(q) * d), Math.round(cy + Math.sin(q) * d), 3, 2);
        }
      }
      ctx.restore();
    },
    end(g) {
      g.ui.msg(`${cap(rec.name)} stands as it was before anyone ever went down: tier ${roman(tier)}. Its master waits again, stronger than before.`, tint);
    },
  };
}
