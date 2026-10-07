// (Round 71) What the ancient places do to you as you come through them
// (see world/ancient.js for the places, and dungeongen.js for the rooms
// that keep these: the floor's `anc` lists), besides their dead and their
// beasts; and their perils, now and then, wherever you are (see
// DungeonRun.placeDangers); and what drifts in their air.
//   The Athanor: its transmutation circles turn, and their lines kindle,
//     fire then frost then acid, the ring and then what's inside it; its
//     stills breathe out poison by turns; its quicksilver drags at your
//     legs. Its peril: a flask of the great work bursting over you.
//   The Hall of the Last Champion: its trial-halls bar themselves behind
//     you and the dead come for you in waves till you've beaten them all;
//     its statues bring their swords down across their aisles as you pass;
//     its rows of pendulum blades swing in turn. Its peril: a volley of
//     ghost-arrows from the dead companions, down your row.
//   The Sundered Reach: its rifts take you through (see evolved.js,
//     addRift); spikes of the void come up out of its cracks; in its
//     echoing halls your own steps come back for you, where you were a
//     moment ago; its wells drag you in. Its peril: a slice of the void
//     cut across the hall where you stand.
//   The Gullet of the World: its acid eats at whoever wades it; its eggs
//     hatch as you pass; its halls quake and the roof comes in. Its peril:
//     the whole gut heaves (it drags you along), and leeches drop on you.
// (Round 72: and more of each. The Athanor's orreries, their planets
// turning through you; its salt gardens, light leaping crystal to crystal;
// its furnaces, fire up through the vents in turn. The Champion's tombs,
// whose dead sit up as you pass; his arena, one champion alone; his
// reliquaries, under the ghosts' bows. The Reach's shard-storms, void
// loose off the walls; its flickering floors, stripe by stripe. The
// Gullet's leech-pools; its throats that carry you along; its nests.)
import { FY } from '../world/dungeongen.js';
import { B, BLOCKS } from '../world/blocks.js';
import { addHazard, addZone, areaTiles } from '../entities/monsters.js';
import { chill } from './gems.js';
import { work, drag } from '../entities/bosskit.js';
import { addRift, addBouncer } from '../entities/evolved.js';
import { knock } from './combat.js';

const ELEMENTS = [
  { kind: 'fire', burn: 2, color: [255, 120, 40], puff: ['#ff8030', '#ffd060', '#ffffff'], word: 'fire' },
  { kind: 'cold', chill: 2.5, color: [150, 210, 255], puff: ['#a0d8ff', '#e8f8ff', '#ffffff'], word: 'frost' },
  { kind: 'acid', color: [160, 220, 60], puff: ['#a8e040', '#e0ff80', '#5a8a20'], word: 'acid' },
];
const VOID = ['#c8a0ff', '#5ad8f0', '#3a1a6a', '#ffffff'];
const inBox = (q, b, pad = 0) => q.x >= b.x0 - pad && q.x <= b.x1 + pad && q.z >= b.z0 - pad && q.z <= b.z1 + pad;
const solidAt = (game, x, z) => BLOCKS[game.world.getBlock(x, FY, z)].solid;

// Told once a floor (to whoever's there).
function tell(run, key, text, col) {
  const st = (run.ancTold ||= new Set());
  if (st.has(key)) return;
  st.add(key);
  run.game.ui.msg(text, col, true);
}

// Each frame, while anyone's down here.
export function ancientTick(run, dt) {
  const A = run.data && run.data.anc;
  if (!A) return;
  const game = run.game;
  if (run.ancFor !== run.data) {
    // (A floor just opened: its rifts open with it, its echoes start
    // listening.)
    run.ancFor = run.data;
    run.ancTold = new Set();
    game.rifts = (game.rifts || []).filter((R) => !R.run || R.run !== run);
    for (const P of A.portals) addRift(game, P.a, P.b, { life: Infinity, run, open: 1 });
    for (const q of [...A.circles, ...A.vents, ...A.cracks, ...A.echoes, ...A.wells, ...A.statues, ...A.blades, ...A.acid, ...A.eggs, ...A.quakes]) q.t = Math.random() * 2;
  }
  const party = run.partyHere().filter((q) => q && !q.dead && !q.down);
  if (!party.length || run.arriveT > 0) return;
  const lvl = (run.rec.level || 1) + run.floor;
  const dmg = 3 + lvl;
  const r = game.renderer;
  const here = (b, pad = 0) => party.filter((q) => inBox(q, b, pad));
  const say = (who, key, text, col) => game.asPlayer(who, () => tell(run, key, text, col));

  // ---------------------------------------------------- the Athanor
  // Its circles: the ring flares, then what's inside it, each element in
  // turn; a glow running round the lines all the while.
  for (const C of A.circles) {
    const in_ = here(C.box);
    if (!in_.length) continue;
    C.t += dt;
    C.el ??= 0;
    const E = ELEMENTS[C.el % 3];
    if (Math.random() < dt * 10) {
      const q = C.tiles[Math.floor(Math.random() * C.tiles.length)];
      r.emit(q.x, FY + 0.1, q.z, { n: 1, color: E.puff, up: 8, speed: 3, life: 0.8, glow: true, gravity: -6 });
    }
    if (C.t < 3.2) continue;
    C.t = 0;
    const inner = !!C.flip;
    C.flip = !C.flip;
    if (inner) C.el++;
    const ring = new Set(C.tiles.map((q) => `${q.x},${q.z}`));
    const rad = Math.max(...C.tiles.map((q) => Math.hypot(q.x - C.x, q.z - C.z)));
    const tiles = inner ? areaTiles(C.x, C.z, Math.ceil(rad), true).filter((q) => Math.hypot(q.x - C.x, q.z - C.z) < rad - 0.6 && !ring.has(`${q.x},${q.z}`) && !(q.x === C.x && q.z === C.z)) : C.tiles;
    addHazard(game, { tiles, y: FY, dur: 1.3, dmg: Math.round(dmg * 0.7), kind: E.kind, burn: E.burn, chill: E.chill, color: E.color, trap: true, place: true, onFire: (g, h) => {
      for (const q of h.tiles) if (Math.random() < 0.35) g.renderer.emit(q.x, FY + 0.3, q.z, { n: 2, color: E.puff, up: 26, speed: 14, life: 0.6, glow: true });
    } });
    game.audio?.play(E.kind === 'fire' ? 'hiss' : E.kind === 'cold' ? 'freeze' : 'drip', { x: C.x, z: C.z });
    say(in_[0], 'circle', `The circle in the floor turns under you, and its lines kindle with ${E.word}... (the ring, then what's inside it: keep to whichever isn't lit!)`, '#ffd070');
  }
  // Its stills, breathing poison by turns.
  for (const V of A.vents) {
    const in_ = here(V.box);
    if (!in_.length) continue;
    V.t += dt;
    if (V.t < 2.6) continue;
    V.t = 0;
    V.k = ((V.k ?? -1) + 1) % V.vents.length;
    const at = V.vents[V.k];
    const tiles = areaTiles(at.x, at.z, 1, true).filter((q) => !solidAt(game, q.x, q.z));
    r.emit(at.x, FY + 0.4, at.z, { n: 8, color: ['#a8e040', '#e0ff80'], up: 20, speed: 10, life: 0.8, shape: 'puff' });
    addHazard(game, { tiles, y: FY, dur: 1.1, dmg: Math.round(dmg * 0.5), kind: 'acid', center: at, radius: 1, trap: true, place: true, onFire: (g) => {
      addZone(g, { kind: 'mist', tiles, y: FY, life: 3.5, tick: 0.7, dmg: 1, slow: true, color: [150, 210, 60], puff: ['#a8e040', '#d8f080', '#5a8a20'] });
    } });
    game.audio?.play('hiss', at);
    say(in_[0], 'vents', 'The great stills gurgle, and their vents breathe out a green poison by turns... (watch which one is bubbling!)', '#c8f080');
  }
  // Its quicksilver: wading it, slowly; and cold.
  for (const M of A.mercury) {
    for (const p of here(M.box)) {
      if (game.world.getBlock(p.x, p.y - 1, p.z) !== B.quicksilver) continue;
      chill(p, 0.6);
      if (Math.random() < dt * 4) r.emit(p.x, p.y + 0.2, p.z, { n: 2, color: ['#e8e8f0', '#a8a8b8', '#ffffff'], up: 8, speed: 10, life: 0.5, glow: true });
      say(p, 'mercury', 'Quicksilver, heavy and cold: it drags at your legs like a hand.', '#d8d8e8');
    }
  }

  // ---------------------------------------------------- the Champion's hall
  for (const T of A.trials) trial(run, T, dt, party, dmg);
  // Its statues: as you pass in front of one, its sword comes down, along
  // the aisle in front of it.
  for (const S of A.statues) {
    const in_ = here(S.box);
    if (!in_.length) continue;
    for (const st of S.list) {
      st.cd = (st.cd || 0) - dt;
      if (st.cd > 0 || game.world.getBlock(st.x, FY, st.z) !== B.statue) continue;
      const p = in_.find((q) => Math.abs(q.x - st.x) <= 1 && (q.z - st.z) * st.dz >= 1 && (q.z - st.z) * st.dz <= 3);
      if (!p) continue;
      st.cd = 4.5;
      const tiles = [];
      for (let k = 1; k <= 3; k++) for (const dx of [-1, 0, 1]) if (!solidAt(game, st.x + dx, st.z + st.dz * k)) tiles.push({ x: st.x + dx, z: st.z + st.dz * k });
      r.emit(st.x, FY + 2, st.z, { n: 6, color: ['#c8c8c8', '#ffffff'], up: 10, speed: 20, life: 0.5 });
      addHazard(game, { tiles, y: FY, dur: 0.9, dmg, kind: 'slam', stun: 0.4, from: { x: st.x, z: st.z }, color: [220, 220, 200], trap: true, place: true });
      game.audio?.play('creak', st);
      say(p, 'statues', 'Stone grinds on stone: the statue brings its sword down across the aisle! (keep out of their reach, or be quick)', '#e0d8c0');
    }
  }
  // Its blades: the rows across the hall swinging in turn, one after
  // another down it (a gap between each to run through).
  for (const Bl of A.blades) {
    const in_ = here(Bl.box, 1);
    if (!in_.length || !Bl.rows.length) continue;
    Bl.t += dt;
    if (Bl.t < 1.15) continue;
    Bl.t = 0;
    Bl.k = ((Bl.k ?? -1) + 1) % Bl.rows.length;
    const z = Bl.rows[Bl.k];
    const tiles = [];
    for (let x = Bl.box.x0; x <= Bl.box.x1; x++) if (!solidAt(game, x, z)) tiles.push({ x, z });
    if (!tiles.length) continue;
    const dir = Bl.k % 2 ? 1 : -1;
    const a = dir > 0 ? tiles[0] : tiles[tiles.length - 1];
    const b = dir > 0 ? tiles[tiles.length - 1] : tiles[0];
    addHazard(game, { tiles, y: FY, dur: 1.0, dmg: Math.round(dmg * 1.1), kind: 'beam', from: a, to: b, beamColor: '#e8e8f0', halo: '#8a8a98', width: 2, knock: 1, color: [210, 210, 220], trap: true, place: true });
    game.audio?.play('whoosh', a);
    say(in_[0], 'blades', 'Great blades swing down out of the dark on their chains, row after row! (time your way through)', '#e0e0e8');
  }

  // ---------------------------------------------------- the Sundered Reach
  // Its cracks: void spikes up out of them, near whoever's by them.
  for (const K of A.cracks) {
    const in_ = here(K.box);
    if (!in_.length) continue;
    K.t += dt;
    if (K.t < 3.4) continue;
    K.t = 0;
    const p = in_[Math.floor(Math.random() * in_.length)];
    const tiles = K.tiles.filter((q) => Math.max(Math.abs(q.x - p.x), Math.abs(q.z - p.z)) <= 3);
    if (!tiles.length) continue;
    for (const q of tiles) r.emit(q.x, FY + 0.1, q.z, { n: 1, color: VOID, up: 4, speed: 4, life: 0.8, glow: true });
    addHazard(game, { tiles, y: FY, dur: 1.0, dmg, kind: 'erupt', color: [170, 110, 255], trap: true, place: true, onFire: (g, h) => {
      for (const q of h.tiles) g.renderer.emit(q.x, FY + 0.6, q.z, { n: 3, color: VOID, up: 40, speed: 10, life: 0.5, glow: true });
    } });
    game.audio?.play('spikes', p);
    say(p, 'cracks', 'The cracks in the floor glow, and spikes of the void stab up out of them! (keep off the seams)', '#c8a0ff');
  }
  // Its echoes: where you were a moment ago, the void remembers you.
  for (const E of A.echoes) {
    const in_ = here(E.box);
    E.trail ||= [];
    E.clock = (E.clock || 0) + dt;
    E.rec = (E.rec || 0) + dt;
    if (E.rec > 0.25) {
      E.rec = 0;
      for (const p of in_) E.trail.push({ x: p.x, z: p.z, t: E.clock });
      if (E.trail.length > 40) E.trail.splice(0, E.trail.length - 40);
    }
    if (!in_.length) continue;
    E.t += dt;
    if (E.t < 3.2) continue;
    E.t = 0;
    const now = E.clock;
    const back = E.trail.find((q) => now - q.t >= 2.2 && now - q.t < 2.8);
    if (!back) continue;
    const tiles = areaTiles(back.x, back.z, 1, true).filter((q) => !solidAt(game, q.x, q.z));
    r.emit(back.x, FY + 1, back.z, { n: 14, color: ['#1a1030', '#3a2a6a', '#c8a0ff'], up: 10, speed: 8, life: 1.1, shape: 'puff' });
    addHazard(game, { tiles, y: FY, dur: 1.1, dmg, kind: 'burst', center: back, radius: 1, color: [140, 90, 230], trap: true, place: true });
    game.audio?.play('whisper', back);
    say(in_[0], 'echoes', 'A shadow of you stands where you stood a moment ago... and comes apart. (Don\'t go back the way you came!)', '#c8a0ff');
  }
  // Its wells, dragging you in (the void at the middle bites).
  for (const W of A.wells) {
    const in_ = here(W.box);
    if (!in_.length) continue;
    W.t += dt;
    if (Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2;
      const d = 1 + Math.random() * 4;
      r.emit(W.x + Math.cos(a) * d, FY + 0.3, W.z + Math.sin(a) * d, { n: 1, color: VOID, up: 2, speed: 2, life: 0.6, glow: true });
    }
    if (W.t < 0.9) continue;
    W.t = 0;
    for (const p of in_) {
      const d = Math.max(Math.abs(p.x - W.x), Math.abs(p.z - W.z));
      if (d === 0) {
        game.dotHit = true;
        game.damage(p, Math.round(dmg * 0.6), null);
        game.dotHit = false;
        chill(p, 1);
      } else if (d <= 6 && !(p.rollT > 0)) drag(game, p, W, 1);
      say(p, 'well', 'The floor tilts toward the hole in the middle of the hall, and the dark in it pulls at you! (fight your way out)', '#c8a0ff');
    }
  }

  // ---------------------------------------------------- the Gullet
  // Its acid, eating at whoever wades it.
  for (const Q of A.acid) {
    for (const p of here(Q.box)) {
      if (!Q.tiles.some((q) => q.x === p.x && q.z === p.z) || p.rollT > 0) continue;
      p.acidT = (p.acidT || 0) - dt;
      if (Math.random() < dt * 6) r.emit(p.x, p.y + 0.1, p.z, { n: 1, color: ['#c8e070', '#a8c040'], up: 10, speed: 4, life: 0.5, shape: 'puff' });
      if (p.acidT > 0) continue;
      p.acidT = 0.8;
      game.dotHit = true;
      game.damage(p, Math.max(1, Math.round(dmg * 0.35)), null);
      game.dotHit = false;
      chill(p, 0.8);
      say(p, 'acid', 'The pool hisses and eats at your boots! (out of the acid!)', '#c8e070');
    }
    if (Math.random() < dt * 2) {
      const q = Q.tiles[Math.floor(Math.random() * Q.tiles.length)];
      r.emit(q.x, FY + 0.05, q.z, { n: 1, color: ['#c8e070', '#e8ff90'], up: 6, speed: 2, life: 0.7, glow: true });
    }
  }
  // Its eggs, hatching as you pass.
  for (const G of A.eggs) {
    const hatch = (e, p) => {
      e.hatched = true;
      if (game.world.getBlock(e.x, FY, e.z) !== B.void_bloom) return;
      game.world.setBlock(e.x, FY, e.z, B.air);
      r.emit(e.x, FY + 0.6, e.z, { n: 16, color: ['#c8e070', '#e8d8b0', '#8a6a4a'], up: 30, speed: 30, life: 0.7 });
      game.audio?.play('splash', e);
      const c = run.spawn(Math.random() < 0.5 ? 'broodling' : 'slugling', e.x, FY, e.z, {});
      if (c) {
        c.target = p;
        c.dormant = 0;
      }
    };
    for (const e of G.eggs) {
      if (e.hatched) continue;
      // (Round 72: a nest's eggs feel you coming further off, and hatch in
      // twos.)
      const p = party.find((q) => Math.max(Math.abs(q.x - e.x), Math.abs(q.z - e.z)) <= (G.nest ? 3 : 2));
      if (!p) continue;
      hatch(e, p);
      if (G.nest && Math.random() < 0.5) {
        const e2 = G.eggs.find((o) => !o.hatched && Math.max(Math.abs(o.x - e.x), Math.abs(o.z - e.z)) <= 3);
        if (e2) hatch(e2, p);
      }
      say(p, 'eggs', G.nest ? 'The nest stirs at your step: eggs split all round you, and what\'s in them comes out hungry!' : 'The egg splits, and something wet and hungry comes out of it!', '#e0d0a0');
    }
  }
  // Its quaking halls: the roof comes in, here and there, round you.
  for (const Q of A.quakes) {
    const in_ = here(Q.box);
    if (!in_.length) continue;
    Q.t += dt;
    if (Q.t < 3) continue;
    Q.t = 0;
    game.shake = Math.min(1, (game.shake || 0) + 0.3);
    for (const p of in_) {
      const tiles = [{ x: p.x + Math.round(Math.random() * 2 - 1), z: p.z + Math.round(Math.random() * 2 - 1) }];
      for (let k = 0; k < 3; k++) tiles.push({ x: p.x + Math.round((Math.random() - 0.5) * 6), z: p.z + Math.round((Math.random() - 0.5) * 6) });
      const ok = tiles.filter((q) => inBox(q, Q.box) && !solidAt(game, q.x, q.z));
      for (const t of ok) r.emit(t.x, FY + 2.4, t.z, { n: 3, color: ['#8a7a5a', '#6a5a40'], up: -10, speed: 6, gravity: 120, life: 0.9, oy: -10 });
      if (ok.length) addHazard(game, { tiles: ok, y: FY, dur: 1.2, dmg, stun: 0.3, kind: 'rocks', color: [190, 150, 100], trap: true, place: true });
      say(p, 'quake', 'The whole hall shudders, and the roof starts to come in! (watch the dust)', '#e0c8a0');
    }
    game.audio?.play('rumble', in_[0]);
  }

  // ---------------------------------------------------- (Round 72) more of each
  // The Athanor's orreries: their planets turning, each a ball of light,
  // through whoever's in its path.
  for (const O of A.orreries) {
    const in_ = here(O.box);
    O.t = (O.t || 0) + dt;
    if (!in_.length) continue;
    O.hit ||= new Map();
    for (const orb of O.orbits) {
      const a = orb.a0 + O.t * orb.w;
      const x = O.x + Math.cos(a) * orb.r * 1.15;
      const z = O.z + Math.sin(a) * orb.r;
      r.emit(x, FY + 0.7, z, { n: 1, color: ['#ffd070', '#ffffff', '#80e8ff'], up: 3, speed: 2, life: 0.25, glow: true });
      for (const p of in_) {
        if (Math.hypot(p.x - x, p.z - z) > 0.8 || p.rollT > 0 || (O.hit.get(p) || 0) > O.t) continue;
        O.hit.set(p, O.t + 0.9);
        game.damage(p, Math.round(dmg * 0.8), null);
        knock(game, { x: O.x, z: O.z }, p, 1);
        r.emit(x, FY + 1, z, { n: 10, color: ['#ffd070', '#ffffff'], up: 30, speed: 40, life: 0.5, glow: true });
        game.audio?.play('chime', p);
        say(p, 'orrery', 'The orrery turns, and its planets come round through you like stones from a sling! (keep off its rings)', '#ffd070');
      }
    }
  }
  // Its salt gardens: the crystals sing, and light leaps between them.
  for (const G of A.gardens) {
    const in_ = here(G.box);
    if (!in_.length) continue;
    G.t = (G.t || 0) + dt;
    if (Math.random() < dt * 6) {
      const c = G.crystals[Math.floor(Math.random() * G.crystals.length)];
      r.emit(c.x, FY + 1, c.z, { n: 1, color: ['#ffe8a0', '#ffffff', '#80e8ff'], up: 8, speed: 4, life: 0.6, glow: true });
    }
    if (G.t < 2.6) continue;
    G.t = 0;
    const a = G.crystals[Math.floor(Math.random() * G.crystals.length)];
    const rest = G.crystals.filter((c) => c !== a);
    const b = rest[Math.floor(Math.random() * rest.length)];
    const tiles = [];
    const seen = new Set();
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 2);
    for (let k = 0; k <= n; k++) {
      const x = Math.round(a.x + ((b.x - a.x) * k) / n);
      const z = Math.round(a.z + ((b.z - a.z) * k) / n);
      if (seen.has(`${x},${z}`) || solidAt(game, x, z)) continue;
      seen.add(`${x},${z}`);
      tiles.push({ x, z });
    }
    if (!tiles.length) continue;
    r.emit(a.x, FY + 1, a.z, { n: 8, color: ['#ffe8a0', '#ffffff'], up: 20, speed: 10, life: 0.5, glow: true });
    addHazard(game, { tiles, y: FY, dur: 1.0, dmg: Math.round(dmg * 0.9), kind: 'beam', from: a, to: b, beamColor: '#ffffff', halo: '#ffe070', width: 2, chill: 1, color: [255, 230, 120], trap: true, place: true });
    game.audio?.play('chime', a);
    say(in_[0], 'garden', 'The crystals sing, and light leaps from one to the next... (don\'t stand between them!)', '#ffe8a0');
  }
  // Its furnaces: the kiln's fire up through the vents, one after the
  // next, all the way round.
  for (const F of A.furnaces) {
    const in_ = here(F.box);
    if (!in_.length) continue;
    F.t = (F.t || 0) + dt;
    if (F.t < 0.9) continue;
    F.t = 0;
    F.k = ((F.k ?? -1) + 1) % F.vents.length;
    const at = F.vents[F.k];
    const tiles = areaTiles(at.x, at.z, 1, true).filter((q) => !solidAt(game, q.x, q.z));
    if (tiles.length) addHazard(game, { tiles, y: FY, dur: 0.7, dmg: Math.round(dmg * 0.7), kind: 'fire', burn: 2, center: at, radius: 1, color: [255, 120, 40], trap: true, place: true });
    const next = F.vents[(F.k + 1) % F.vents.length];
    r.emit(next.x, FY + 0.3, next.z, { n: 4, color: ['#ff8030', '#ffd060'], up: 14, speed: 6, life: 0.5, glow: true });
    game.audio?.play('hiss', at);
    say(in_[0], 'furnace', 'The kiln\'s fire comes up through the vents, one after the next, all the way round! (run with it, not into it)', '#ff9050');
  }

  // The Champion's companions' tombs: pass one, and what's in it sits up.
  for (const Tb of A.tombs) {
    const in_ = here(Tb.box);
    if (!in_.length) continue;
    for (const t of Tb.list) {
      if (t.open) continue;
      const key = `tomb${t.x},${t.z}`;
      if (run.state.solved[key]) {
        t.open = true;
        continue;
      }
      const p = in_.find((q) => Math.abs(q.x - t.x) <= 1 && Math.abs(q.z - t.z) <= 1);
      if (!p) continue;
      t.open = true;
      run.state.solved[key] = true;
      const x = t.x;
      const z = t.z + t.dz;
      r.emit(t.x, FY + 1, t.z, { n: 14, color: ['#c8c8c8', '#8a8a80', '#ffe8a0'], up: 24, speed: 20, life: 0.8, shape: 'puff' });
      game.audio?.play('creak', t);
      if (Math.random() < 0.35) {
        game.spawnDrop('old_coin', 3 + Math.floor(Math.random() * 6), x, FY, z, true);
        say(p, 'tomb_gold', 'The lid grinds aside: only bones in it, and the coins they were buried with.', '#e0d8c0');
        continue;
      }
      const c = !solidAt(game, x, z) && !game.entityAt?.(x, FY, z) ? run.spawn(Math.random() < 0.6 ? 'wight' : 'legion_shade', x, FY, z, {}) : null;
      if (c) c.target = p;
      say(p, 'tomb', 'The lid of the sarcophagus grinds aside as you pass, and what was laid in it sits up! (his companions keep their watch)', '#e0d8c0');
    }
  }
  // His reliquaries: the companions' ghosts drawing on whoever's in them.
  for (const Rq of A.reliquaries) {
    const in_ = here(Rq.box);
    if (!in_.length) {
      Rq.t = 0;
      continue;
    }
    Rq.t = (Rq.t || 0) + dt;
    if (Rq.t < 4.5) continue;
    Rq.t = 1.5;
    const p = in_[Math.floor(Math.random() * in_.length)];
    ancientDanger(run, 'champion', p, Math.round(dmg * 0.8));
    say(p, 'reliquary', 'The companions\' ghosts stand guard over their relics, and their bows are on you as long as you\'re in here. (take what you came for, and go)', '#c8e0ff');
  }

  // The Reach's shard-storms: splinters of the void loose in the hall.
  for (const St of A.storms) {
    const in_ = here(St.box, 1);
    St.live = (St.live || []).filter((b) => !b.done);
    if (!in_.length) {
      for (const b of St.live) b.done = true;
      St.live = [];
      continue;
    }
    St.t = (St.t || 0) + dt;
    if (St.live.length >= St.n || St.t < 1.2) continue;
    St.t = 0;
    const bx = St.box;
    let x = 0;
    let z = 0;
    let ok = false;
    for (let i = 0; i < 12 && !ok; i++) {
      x = bx.x0 + 1 + Math.floor(Math.random() * Math.max(1, bx.x1 - bx.x0 - 1));
      z = bx.z0 + 1 + Math.floor(Math.random() * Math.max(1, bx.z1 - bx.z0 - 1));
      ok = !solidAt(game, x, z) && !in_.some((q) => Math.hypot(q.x - x, q.z - z) < 2.5);
    }
    if (!ok) continue;
    const a = Math.random() * Math.PI * 2;
    St.live.push(addBouncer(game, { x, z, y: FY, vx: Math.cos(a), vz: Math.sin(a), v: 4.2, life: 14, dmg: Math.round(dmg * 0.8), r: 0.7, color: VOID, kind: 'void', slow: 1, spent: false }));
    r.emit(x, FY + 1, z, { n: 12, color: VOID, up: 24, speed: 30, life: 0.5, glow: true });
    game.audio?.play('void', { x, z });
    say(in_[0], 'storm', 'Splinters of the void fly about the hall, off its walls and back again! (roll through them, or round)', '#c8a0ff');
  }
  // Where the floor flickers: its stripes go over to the void by turns.
  for (const Fl of A.flickers) {
    const in_ = here(Fl.box);
    if (!in_.length) continue;
    Fl.t = (Fl.t || 0) + dt;
    const k = Fl.k ?? 0;
    if (Fl.t > 2 && Math.random() < dt * 40) {
      const q = Fl.bands[k][Math.floor(Math.random() * Fl.bands[k].length)];
      r.emit(q.x, FY + 0.2, q.z, { n: 1, color: VOID, up: 6, speed: 3, life: 0.4, glow: true });
    }
    if (Fl.t < 3) continue;
    Fl.t = 0;
    Fl.k = 1 - k;
    const tiles = Fl.bands[k].filter((q) => !solidAt(game, q.x, q.z));
    if (tiles.length) addHazard(game, { tiles, y: FY, dur: 0.6, dmg, kind: 'hex', chill: 1.2, color: [140, 90, 230], trap: true, place: true, quiet: true });
    game.audio?.play('void', in_[0]);
    say(in_[0], 'flicker', 'The floor flickers, stripe by stripe, and the void shows through where it was! (stand on the stripes that aren\'t)', '#c8a0ff');
  }

  // The Gullet's leech-pools: what lives in the acid, up round whoever wades.
  for (const Lp of A.leeches) {
    const in_ = here(Lp.box);
    if (!in_.length) continue;
    Lp.t = (Lp.t || 0) + dt;
    Lp.live = (Lp.live || []).filter((c) => !c.dead);
    if (Lp.t < 2.5 || Lp.live.length >= 4) continue;
    const p = in_.find((q) => Lp.tiles.some((t) => t.x === q.x && t.z === q.z));
    if (!p) continue;
    Lp.t = 0;
    const spots = areaTiles(p.x, p.z, 1, true).filter((q) => !(q.x === p.x && q.z === p.z) && !solidAt(game, q.x, q.z) && !game.entityAt?.(q.x, FY, q.z));
    if (!spots.length) continue;
    const q = spots[Math.floor(Math.random() * spots.length)];
    const c = run.spawn('slugling', q.x, FY, q.z, {});
    if (c) {
      c.target = p;
      Lp.live.push(c);
      r.emit(q.x, FY + 0.4, q.z, { n: 12, color: ['#c8e070', '#a8c040', '#5a8a2a'], up: 24, speed: 20, life: 0.6 });
      game.audio?.play('splash', q);
    }
    say(p, 'leeches', 'Something in the acid wakes at your wading, and comes up out of it, hungry! (out of the pool!)', '#c8e070');
  }
  // Its throats: the gut clenches and carries you along it.
  for (const Th of A.throats) {
    const in_ = here(Th.box);
    if (!in_.length) {
      Th.t = 0;
      continue;
    }
    Th.t = (Th.t || 0) + dt;
    if (Th.t < 2.4) continue;
    Th.t = 0;
    Th.dir = -(Th.dir || 1);
    for (const p of in_) drag(game, p, Th.axis === 'x' ? { x: p.x + Th.dir * 3, z: p.z } : { x: p.x, z: p.z + Th.dir * 3 }, 2);
    const bx = Th.box;
    for (let i = 0; i < 6; i++) r.emit(bx.x0 + Math.random() * (bx.x1 - bx.x0), FY + 0.3, bx.z0 + Math.random() * (bx.z1 - bx.z0), { n: 1, color: ['#a07a50', '#c8a080'], up: 10, speed: 6, life: 0.7, shape: 'puff' });
    game.shake = Math.min(1, (game.shake || 0) + 0.3);
    game.audio?.play('rumble', in_[0]);
    say(in_[0], 'throat', 'The walls of the gut clench and heave, and carry you along it, one way and then the other! (plant your feet between heaves)', '#c8a080');
  }
}

// A trial-hall: the ways out barred as you come in, and the dead in three
// waves; beaten, the bars go up (and it stays beaten, this floor).
function trial(run, T, dt, party, dmg) {
  const game = run.game;
  const key = `trial${T.room}`;
  if (run.state.solved[key]) return;
  const inside = party.filter((q) => inBox(q, T.box) && !(q.x === T.box.x0 || q.x === T.box.x1 || q.z === T.box.z0 || q.z === T.box.z1));
  const on = run.trialOn && run.trialOn.T === T ? run.trialOn : null;
  if (!on) {
    if (!inside.length || run.trialOn || run.fight) return;
    // (Barred: the ways out, each a gate, for as long as the trial lasts.)
    const bars = [];
    for (const d of T.doors) if (!party.some((q) => q.x === d.x && q.z === d.z) && work(game, d.x, FY, d.z, B.boss_gate, 0, null, { meta: Math.abs(d.x - (T.box.x0 + T.box.x1) / 2) > Math.abs(d.z - (T.box.z0 + T.box.z1) / 2) ? 1 : 0 })) bars.push(d);
    run.trialOn = { T, wave: 0, t: 1.2, mobs: [], bars, gone: 0 };
    game.audio?.play('gate_slam', bars[0] || T.box);
    game.shake = Math.min(1, (game.shake || 0) + 0.4);
    run.eachHere(() => game.ui.msg('The ways out slam shut! A voice like a bell: "PROVE YOURSELF WORTHY OF HIM."', '#ffe8a0', true));
    return;
  }
  // (All of you out of it, or down: it gives up, and lets you go.)
  on.gone = inside.length ? 0 : on.gone + dt;
  const lift = () => {
    for (const q of game.works || []) if (on.bars.some((d) => d.x === q.x && d.z === q.z && q.y === FY)) q.life = 0.01;
    run.trialOn = null;
  };
  if (on.gone > 4) {
    lift();
    for (const c of on.mobs) if (!c.dead) c.dead = true;
    return;
  }
  on.mobs = on.mobs.filter((c) => !c.dead);
  if (on.mobs.length) return;
  on.t -= dt;
  if (on.t > 0) return;
  const waves = T.arena ? 1 : 3;
  if (on.wave >= waves) {
    // Beaten.
    run.state.solved[key] = true;
    lift();
    game.audio?.play('fanfare');
    run.eachHere(() => game.ui.msg('The last of them falls, and the bars grind up. "WORTHY," says the bell-voice, a little sadly.', '#ffe8a0', true));
    return;
  }
  on.wave++;
  on.t = 1.6;
  // (Round 72: an arena's trial is one champion of the old wars, alone,
  // and twice the fighter any of the dead are.)
  const kinds = T.arena ? ['legion_shade'] : on.wave === 1 ? ['skeleton', 'skeleton', 'skeleton'] : on.wave === 2 ? ['skeleton', 'wight', 'ghoul', 'ghoul'] : ['legion_shade', 'wight', 'wight', 'skeleton'];
  const B0 = T.box;
  for (const k of kinds) {
    for (let i = 0; i < 20; i++) {
      const x = B0.x0 + 1 + Math.floor(Math.random() * Math.max(1, B0.x1 - B0.x0 - 1));
      const z = B0.z0 + 1 + Math.floor(Math.random() * Math.max(1, B0.z1 - B0.z0 - 1));
      if (solidAt(game, x, z) || game.entityAt?.(x, FY, z) || party.some((q) => Math.abs(q.x - x) + Math.abs(q.z - z) < 3)) continue;
      const c = run.spawn(k, x, FY, z, {});
      if (!c) break;
      c.target = party[0];
      if (T.arena) {
        c.maxHp = Math.round(c.maxHp * 2.5);
        c.hp = c.maxHp;
        c.arena = true;
      }
      on.mobs.push(c);
      game.renderer.emit(x, FY + 0.2, z, { n: 12, color: ['#e8e4d4', '#a8a088', '#ffe8a0'], up: 30, speed: 20, life: 0.7, shape: 'puff' });
      break;
    }
  }
  game.audio?.play('march', { x: (B0.x0 + B0.x1) / 2, z: (B0.z0 + B0.z1) / 2 });
  run.eachHere(() => game.ui.msg(T.arena ? 'A champion of the old wars steps out onto the sand, and salutes you.' : `Trial: wave ${on.wave} of 3. The dead rise up out of the floor!`, '#ffe8a0'));
  void dmg;
}

// Its peril (see DungeonRun.placeDangers): true if it went off.
export function ancientDanger(run, type, p, dmg) {
  const game = run.game;
  const r = game.renderer;
  const say = (k, text, col) => tell(run, `peril_${k}`, text, col);
  switch (type) {
    case 'athanor': {
      // A flask of the great work bursting over you: one element, raining
      // round where you stand.
      const E = ELEMENTS[Math.floor(Math.random() * 3)];
      const tiles = [{ x: p.x, z: p.z }, ...areaTiles(p.x, p.z, 2, true).filter((q) => Math.random() < 0.4 && !solidAt(game, q.x, q.z))];
      r.emit(p.x, FY + 3, p.z, { n: 14, color: ['#ffffff', '#c8f0ff', ...E.puff], up: 10, speed: 40, life: 0.5, glow: true });
      addHazard(game, { tiles, y: FY, dur: 1.4, dmg: Math.round(dmg * 0.8), kind: E.kind, burn: E.burn, chill: E.chill, color: E.color, trap: true, place: true });
      game.audio?.play('glass', p);
      say('flask', `Glass shatters somewhere above you, and ${E.word} rains down! (move!)`, '#ffd070');
      return true;
    }
    case 'champion': {
      // The dead companions' bows: a volley down your row.
      const across = Math.random() < 0.5;
      const tiles = [];
      for (let k = -6; k <= 6; k++) {
        const q = across ? { x: p.x + k, z: p.z } : { x: p.x, z: p.z + k };
        if (!solidAt(game, q.x, q.z)) tiles.push(q);
      }
      for (const t of tiles) if (Math.random() < 0.4) r.emit(t.x, FY + 1, t.z, { n: 1, color: ['#c8e0ff', '#ffffff'], up: 2, speed: 6, life: 0.8, glow: true });
      addHazard(game, { tiles, y: FY, dur: 1.3, dmg, kind: 'dart', from: tiles[0], to: tiles[tiles.length - 1], color: [200, 220, 255], trap: true, place: true });
      game.audio?.play('bow', p);
      say('volley', 'Pale archers stand along the walls a moment, drawing on you! (step out of the row!)', '#c8e0ff');
      return true;
    }
    case 'rift': {
      // A slice of the void cut across the hall where you stand.
      const ang = Math.random() * Math.PI;
      const tiles = [];
      const seen = new Set();
      for (let k = -6; k <= 6; k += 0.5) {
        const x = Math.round(p.x + Math.cos(ang) * k);
        const z = Math.round(p.z + Math.sin(ang) * k);
        if (seen.has(`${x},${z}`) || solidAt(game, x, z)) continue;
        seen.add(`${x},${z}`);
        tiles.push({ x, z });
      }
      addHazard(game, { tiles, y: FY, dur: 1.2, dmg: Math.round(dmg * 1.1), kind: 'beam', from: tiles[0], to: tiles[tiles.length - 1], beamColor: '#ffffff', halo: '#8a40ff', width: 2, chill: 1.5, color: [170, 110, 255], trap: true, place: true });
      game.audio?.play('void', p);
      say('slice', 'A line of white light opens in the air across the hall... (it\'s cutting: get off it!)', '#c8a0ff');
      return true;
    }
    case 'gullet': {
      // The gut heaves: the floor drags you along, and leeches drop.
      const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
      drag(game, p, { x: p.x + dir[0] * 3, z: p.z + dir[1] * 3 }, 2);
      game.shake = Math.min(1, (game.shake || 0) + 0.45);
      game.audio?.play('rumble', p);
      let n = 0;
      for (let k = 0; k < 2; k++) {
        const x = p.x + Math.round((Math.random() - 0.5) * 6);
        const z = p.z + Math.round((Math.random() - 0.5) * 6);
        if (solidAt(game, x, z) || game.entityAt?.(x, FY, z) || (x === p.x && z === p.z)) continue;
        r.emit(x, FY + 2.6, z, { n: 6, color: ['#5a3a3a', '#8a5a4a'], up: -20, speed: 6, gravity: 100, life: 0.6 });
        const c = run.spawn('slugling', x, FY, z, {});
        if (c) {
          c.target = p;
          n++;
        }
      }
      say('heave', `The whole gut heaves and drags you along it${n ? ', and leeches drop from the roof!' : '!'}`, '#c8a080');
      return true;
    }
  }
  return false;
}

// What drifts in its air, at (x, z): `c` its motes' colours.
export function ancientMotes(game, type, x, z, c) {
  const r = game.renderer;
  switch (type) {
    case 'athanor':
      // Gold dust turning in the light, and a breath of steam off the stills.
      if (Math.random() < 0.7) r.emit(x, FY + 0.6 + Math.random() * 1.8, z, { n: 1, color: c, up: 2, speed: 3, gravity: -2, life: 2.4, glow: true });
      else r.emit(x, FY + 0.2, z, { n: 1, color: ['#c8d8d0', '#e8f0e8'], up: 4, speed: 3, life: 1.8, shape: 'puff', gravity: -4 });
      return true;
    case 'champion':
      // Dust in the shafts of light, and the last ghost of a banner's gold.
      r.emit(x, FY + 2.4, z, { n: 1, color: c, up: -2, speed: 2, gravity: 3, life: 3, glow: Math.random() < 0.3 });
      return true;
    case 'rift':
      // Specks of the void falling upward; now and then a white seam.
      r.emit(x, FY + 0.2, z, { n: 1, color: c, up: 8, speed: 3, gravity: -10, life: 1.8, glow: true });
      return true;
    case 'gullet':
      // Drips off the roof, and a warm breath off the mud.
      if (Math.random() < 0.5) r.emit(x, FY + 2.6, z, { n: 1, color: ['#a8b870', '#c8d890'], up: -2, speed: 1, gravity: 90, life: 0.9, oy: -10 });
      else r.emit(x, FY + 0.2, z, { n: 1, color: c, up: 3, speed: 3, gravity: -4, life: 2, shape: 'puff' });
      return true;
  }
  return false;
}

// (Round 72) What's in the air round an ancient place's gate, outside, as
// you come up to it (`s` the site, `d` your distance from its door): its
// sounds, now and then, and the gullet's slow heartbeat through the ground.
// Quiet once its master's beaten. (Its lights and motes: render/ancientfx.js.)
export function ancientAir(game, s, d, dt) {
  const rec = game.sim.dungeons.get?.(s.id);
  if ((rec && rec.cleared) || d > 34) { game.ancientAirT = 0; return; }
  const near = 1 - Math.min(1, Math.max(0, (d - 6) / 28));
  const t = (game.ancientAirT = (game.ancientAirT || 0) + dt);
  const a = game.audio;
  const vol = 0.3 + near * 0.7;
  switch (s.type) {
    case 'athanor':
      if (t > 4.5 + Math.random() * 3) { a?.play(Math.random() < 0.6 ? 'hum' : 'chime', vol); game.ancientAirT = 0; }
      break;
    case 'champion':
      if (t > 7 + Math.random() * 5) { a?.play(Math.random() < 0.5 ? 'march' : 'whisper', vol); game.ancientAirT = 0; }
      break;
    case 'rift':
      if (t > 3.5 + Math.random() * 4) {
        a?.play(Math.random() < 0.6 ? 'void' : 'whisper', vol);
        if (near > 0.5 && Math.random() < 0.5) game.renderer.flashScreen?.('#c8a0ff', 0.05 + near * 0.06);
        game.ancientAirT = 0;
      }
      break;
    case 'gullet':
      if (t > 2.2) {
        a?.play('heart', vol);
        game.shake = Math.min(1, (game.shake || 0) + 0.05 + near * 0.12);
        game.ancientAirT = 0;
      }
      break;
  }
}

// (Round 73) Wading a liquid sunk in the floor, anywhere: acid eats at
// you (a little, often: get out of it), quicksilver drags at your legs.
export function wadeTick(game, dt) {
  for (const e of [...game.everyone(), ...(game.npcs || [])]) {
    if (!e || e.dead || e.down || !e.wading) continue;
    if (e.wading === 'quicksilver') {
      chill(e, 0.5);
      continue;
    }
    e.acidT = (e.acidT ?? 0.4) - dt;
    if (Math.random() < dt * 6) game.renderer.emit(e.x, e.y + 0.15, e.z, { n: 1, color: ['#c8f070', '#90d040', '#ffffff'], up: 14, speed: 6, life: 0.5, shape: 'puff' });
    if (e.acidT > 0) continue;
    e.acidT = 0.9;
    game.damage(e, 1, null);
    if (e.kind === 'player') game.renderer.floatText(e.x, e.y + 2.2, e.z, 'burning!', '#c8f070');
    game.audio?.play('hiss', e);
  }
}

// (Round 73) Above the hall where it waits, the Alinelidan goes through its
// own Gullet now and then: up out of the rock on one side of you and across
// and down into it again (see evolved_worm.passTick). It pays you no mind,
// and nothing you can do marks it. A minute or two between.
export function gulletPass(run, dt) {
  if (!run || run.rec.type !== 'gullet' || run.fight || run.floor >= (run.rec.depth || 1) - 1) return;
  const game = run.game;
  const w = run.passing;
  if (w && game.creatures.includes(w)) return;
  run.passing = null;
  run.passT = (run.passT ?? 30 + Math.random() * 30) - dt;
  if (run.passT > 0) return;
  run.passT = 75 + Math.random() * 60;
  const p = game.player;
  if (!p || p.dead) return;
  const a = Math.random() * Math.PI * 2;
  const ax = Math.cos(a);
  const az = Math.sin(a);
  const side = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.floor(Math.random() * 3));
  const from = { x: Math.round(p.x - ax * 20 - az * side), z: Math.round(p.z - az * 20 + ax * side) };
  const to = { x: Math.round(p.x + ax * 20 - az * side), z: Math.round(p.z + az * 20 + ax * side) };
  if (!run.has(from.x) || !run.has(to.x)) return;
  const c = run.spawn('alinelidan', from.x, FY, from.z, {});
  if (!c) return;
  c.passing = { from, to, len: Math.max(1, Math.round(Math.hypot(to.x - from.x, to.z - from.z))), i: 0, t: 0 };
  c.isBoss = false;
  c.burrowed = true;
  c.hostile = false;
  run.passing = c;
  game.audio?.play('rumble', c);
  if (!run.toldPass) {
    run.toldPass = true;
    game.ui.msg('The whole Gullet shudders. Something vast is moving through the rock.', '#e0ff90', true);
  }
}
