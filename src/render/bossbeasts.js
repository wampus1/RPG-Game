// The masters that aren't shaped like people (see bossbody.js, which
// draws them), sculpted (see sculpt.js): bodies built of rounded masses
// flowing into one another, each surfaced as what it is (glazed clay,
// black glass, cooling crust, iron, scale and hide, fur, chitin, coral,
// shell, fungus, bark), side on and facing left, in twenty-four frames of
// breath. And what moves on them of itself, every frame (see each one's
// `rig`, and bossrig.js): the Glass Wyrm's and the Lamprey Queen's bodies
// strung out behind their heads along the way they came, the Worm's swaying
// up out of its hole; the Drake's chain from its collar to the stake, and
// its wings beating; the Molten Heart's four chains to their anchors; the
// Moth-Mother's four wings; the Kraken's eight arms; the Bloat's trailing
// feelers; the moss hanging off the Elder Stag's antlers; the Prime's
// floating shoulder-stones.
import { Paint, hash2 } from './paint.js';
import { hex, mix, shade, toHex } from './pixel.js';
import { Sculpt } from './sculpt.js';
import { Part, Rope, Train, bodyOf, drawBody, drawChain, drawStrand, onScreen } from './bossrig.js';

const TAU = Math.PI * 2;
const sn = (t, k = 1, ph = 0) => Math.sin(t * TAU * k + ph);
const HOT = '#ff6a1a';
const CORE = '#ffe890';
const dark = (c, k = 0.75) => toHex(shade(hex(c), k));

// A glowing crack, painted over: a hot line, its corners white-hot.
function crack(P, pts, hot = HOT, core = CORE) {
  for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], hot);
  for (let i = 1; i + 1 < pts.length; i++) P.set(pts[i][0], pts[i][1], hex(core));
}
// Paint over what's there (keeping its light) where `test` says.
function tint(P, test, col, k) {
  P.over((x, y, c) => (test(x, y, c) ? mix(c, hex(col), k) : null));
}

// ------------------------------------------------------------ parts
// A part sculpted once (and turned as wanted: see bossrig.Part); `o.paint`
// paints over it (its markings).
const PARTS = new Map();
function part(key, w, h, px, py, fn, o = {}) {
  let p = PARTS.get(key);
  if (!p) {
    p = new Part(() => {
      const X = new Sculpt(w, h, { seed: key.length * 7 });
      fn(X);
      const out = X.render({ outline: false });
      if (!o.paint) return out;
      const P = new Paint(w, h);
      P.p = out;
      o.paint(P);
      return P.p;
    }, px, py, o);
    PARTS.set(key, p);
  }
  return p;
}
// The way a master's body lies behind it on the ground (in paces): back
// the way it's facing on screen.
function backward(R) {
  const [x, z] = R.r.toWorld(R.flip ? -1 : 1, 0);
  return { x, z };
}
// Where it is in the world (where it's drawn).
const posOf = (e) => (e.renderPos ? e.renderPos() : e);

// A serpent's body: a train of segments behind its head along the way it
// came, each following the one ahead, swaying as it goes (see
// bossrig.Train); drawn whole through them, one smooth length of it out
// of the base of its neck, skinned as it is (see bossrig.bodyOf: `rad`,
// `skin`, `gloss`, `fin`), the part nearer you than its head drawn after
// it (`front`); `lift(i)` how far each is raised (pixels), `crest(i)`
// what stands up along its back (a spine) at each.
function serpent(R, cfg, front) {
  const e = R.e;
  const s = e.rig;
  if (!s.train) s.train = new Train(cfg.n, cfg.gap);
  if (!front) {
    const p = posOf(e);
    s.train.mark(p.x, p.z);
    const pts = s.train.points(backward(R), (i) => Math.sin(R.t * cfg.wave - i * 0.9) * cfg.amp * Math.min(1, i / 2));
    const scr = pts.map((q, i) => {
      const a = onScreen(R.r, q.x, p.y, q.z);
      return { x: a.x, y: a.y - (cfg.lift ? cfg.lift(i) : 0) };
    });
    // (Out of the base of its neck, where it's painted.)
    scr[0] = { x: R.x, y: R.y - (cfg.lift ? cfg.lift(0) : 0) };
    const headY = R.y;
    s.body = bodyOf(scr, { rad: cfg.rad, skin: cfg.skin, gloss: cfg.gloss, fin: cfg.fin, flip: R.flip, front: (x, y) => y > headY + 1 }, (s.bodyCv ||= {}));
    s.scr = scr;
    s.headY = headY;
  }
  const b = s.body;
  if (!b) return;
  drawBody(R.ctx, front ? b.front : b.back, cfg.alpha ?? 1);
  if (!cfg.crest) return;
  const scr = s.scr;
  for (let i = scr.length - 1; i >= 1; i--) {
    const a = scr[i];
    if ((a.y > s.headY + 1) !== front) continue;
    const c = cfg.crest(i);
    if (c) c.draw(R.ctx, a.x, a.y - cfg.rad(i / (scr.length - 1)) + 1, 0, false, cfg.alpha ?? 1);
  }
}

// A curling arm: from (x, y), heading `a0`, `n` steps of `len`, each
// turning by the curl (a wave running down it).
function curl(x, y, a0, n, len, t, ph, amp = 0.35, speed = 2.2) {
  const pts = [{ x, y }];
  let a = a0;
  for (let i = 1; i <= n; i++) {
    a += Math.sin(t * speed + ph - i * 0.55) * amp * (0.3 + i / n);
    x += Math.cos(a) * len;
    y += Math.sin(a) * len;
    pts.push({ x, y });
  }
  return pts;
}

// ------------------------------------------------------------ Kharos
const BEASTS = {
  // A great burial urn of glazed clay, painted in bands, cracked and
  // glowing; arms of ash out of its sides, waving (rig); a face painted on
  // its belly; its lid riding on the smoke (rig), thrown back as she
  // breathes in.
  urn_mother: {
    w: 60, h: 64, ax: 30, ay: 62,
    sculpt(X, t) {
      const clay = '#b0603a';
      X.in(0, 3);
      X.slab([[20, 52], [40, 52], [42, 60.5], [18, 60.5]], dark(clay, 0.85), 'ceramic', { rz: 5, bevel: 3 });
      X.ball(30, 39, 18, 16.5 + sn(t) * 0.4, clay, 'ceramic', { rz: 14 });
      X.tube(30, 25, 30, 19, 8.4, 7.2, clay, 'ceramic', { z: 6 });
      X.in(1, 1);
      X.ball(30, 17.5, 11, 3.4, dark(clay, 0.9), 'ceramic', { rz: 3, z: 8 });
      X.ball(30, 17.6, 8, 1.6, '#1a0e0a', 'ink', { z: 11, rz: 0.4 });
    },
    paint(P, t, st) {
      // The painted bands, round the curve of her; her face.
      tint(P, (x, y) => (y === 26 || y === 27 || y === 52 || y === 51) && Math.abs(x - 30) < 18, '#2a140e', 0.7);
      tint(P, (x, y) => y >= 29 && y <= 32 && (x + (y - 29) * 2) % 8 < 4 && Math.abs(x - 30) < 17, '#f0d090', 0.55);
      tint(P, (x, y) => y >= 47 && y <= 49 && x % 4 < 2 && Math.abs(x - 30) < 15, '#2a140e', 0.5);
      const hot = st.wind || st.inhale;
      for (const ex of [23, 36]) {
        P.poly([[ex - 4, 39], [ex, 36.5], [ex + 4, 39], [ex, 41.5]], '#e8d0a0', { lv: 0.7, contrast: 0.4 });
        P.blob(ex, 39, 1.5, 1.5, hot ? '#ffb040' : '#2a140e', { lift: hot ? 0.5 : 0 });
      }
      if (st.inhale) P.blob(30, 46, 3, 2.5, '#ffb040', { lift: 0.4 });
      else P.line(26, 46, 34, 46, '#2a140e');
      crack(P, [[41, 28], [43, 33], [41, 37], [44, 42]]);
      crack(P, [[17, 42], [19, 46], [17, 50]]);
      crack(P, [[28, 51], [30, 55], [29, 59]]);
    },
    fx(P, t, st) {
      for (let i = 0; i < 5; i++) {
        const k = (t + i / 5) % 1;
        if (st.inhale) P.puff(30 + Math.cos(i * 1.7) * (1 - k) * 22, 16 + Math.sin(i * 1.7) * (1 - k) * 10, 2, '#9a908a', 0.6 * k);
        else P.puff(30 + sn(k, 0.5, i) * 3, 12 - k * 11, 1.5 + k * 3, '#8a8280', 0.5 * (1 - k));
      }
      for (const [x, y] of [[43, 33], [19, 46]]) P.fx(x, y, CORE, 0.5 + 0.5 * sn(t, 2, x));
    },
    rig: {
      behind(R) {
        // Her ash arms: out of her shoulders and up, waving, fingers
        // spread, embers in the ash.
        const up = R.st.wind || R.st.inhale ? 7 : 0;
        for (const s of [-1, 1]) {
          const bx = R.ox + 30 + s * 14;
          const by = R.oy + 31;
          const pts = curl(bx, by, -Math.PI / 2 + s * 0.9, 9, 2.6, R.t, s * 1.7, 0.22, 1.8);
          for (const q of pts) q.y -= up * 0.15;
          // (Ash, packed into an arm: grey, crumbling, embers in it.)
          const cv = (R.e.rig.ashCv ||= [{}, {}])[s > 0 ? 1 : 0];
          const arm = bodyOf([...pts].reverse(), { rad: (k) => 1 + 1.2 * k, skin: ashSkin(R.t), gloss: 0 }, cv);
          drawBody(R.ctx, arm.back);
          const tip = pts[pts.length - 1];
          for (let i = 0; i < 4; i++) {
            const a = -Math.PI / 2 + s * (-0.5 + i * 0.4) + Math.sin(R.t * 3 + i) * 0.15;
            drawStrand(R.ctx, [tip, { x: tip.x + Math.cos(a) * 4, y: tip.y + Math.sin(a) * 4 }], '#6a6260', 1, 1);
          }
        }
      },
      front(R) {
        // The lid, riding the smoke: bobbing, tilting; thrown back as she
        // breathes in.
        const lid = part('urn_lid', 26, 12, 13, 8, (X) => {
          X.ball(13, 8, 10.5, 3, '#8a4a2c', 'ceramic', { rz: 3 });
          X.ball(13, 5, 3, 2.6, '#d8a050', 'gold', { z: 2.6, rz: 2 });
        });
        const inhale = R.st.inhale;
        const lift = inhale ? 9 : 1.5 + Math.max(0, Math.sin(R.t * 2.2)) * 2;
        const tilt = inhale ? -0.55 : Math.sin(R.t * 1.3) * 0.08;
        lid.draw(R.ctx, R.ox + 30 + (inhale ? 5 : 0), R.oy + 14 - lift, tilt);
      },
    },
  },

  // A serpent of black volcanic glass: its head reared up on its neck (the
  // painting), its body strung out behind it over the floor along the way
  // it came, crystal spines down its back, swaying as it goes (the rig).
  glass_wyrm: {
    w: 44, h: 46, ax: 30, ay: 44,
    sculpt(X, t, st) {
      const glass = '#3a3058';
      const gape = st.wind ? 1 : 0.15 + Math.max(0, sn(t)) * 0.12;
      X.in(0, 3);
      // The neck, rising out of the floor in an arc to the head.
      X.limb([[30, 44, 6.5, 2], [29, 36, 6, 4], [24, 26, 5.4, 6], [17, 19, 4.8, 7]], glass, 'obsidian', { cell: 5 });
      // The head: a long wedge of a skull, brows like blades.
      X.ball(12, 16, 7.5, 5, glass, 'obsidian', { rz: 5, z: 6, ang: -0.15, cell: 4 });
      X.ball(5.5, 17 + gape * 2, 4.8, 2.4, glass, 'obsidian', { rz: 2.6, z: 7, ang: -0.1 });
      X.in(1, 1.5);
      // The lower jaw, dropping as it strikes.
      X.slab([[3, 20 + gape * 3], [14, 19.5], [16, 22 + gape * 2], [5, 23 + gape * 6]], dark(glass, 0.85), 'obsidian', { rz: 2, bevel: 1.2, z: 5 });
      X.in(2, 1);
      for (let i = 0; i < 5; i++) X.tube(10 + i * 3.5, 12 - i * 0.4, 13 + i * 3.6, 6 - (i % 2) * 2, 1.4, 0.3, '#8a78c8', 'glass', { z: 6 });
      for (let i = 0; i < 3; i++) X.tube(26 - i * 1.5, 28 + i * 5, 32 - i, 25 + i * 5, 1.2, 0.3, '#8a78c8', 'glass', { z: 6 });
    },
    paint(P, t, st) {
      P.eye(9, 14, st.wind ? '#ffd080' : '#ff6040', true);
      if (st.wind) for (let i = 0; i < 4; i++) P.set(5 + i * 2, 20 + (i % 2), hex('#e8e0ff'));
    },
    fx(P, t) {
      // Light running up through its spines.
      const k = (t * 2) % 1;
      P.fx(13 + k * 14, 6 + k * 3, '#e0d8ff', 0.8);
    },
    rig: {
      under(R) {
        serpent(R, wyrmCfg, false);
      },
      over(R) {
        serpent(R, wyrmCfg, true);
      },
    },
  },

  // A great slug of cooling lava: a crust split in glowing seams that
  // pulse with its heart, eyes on stalks swaying, a molten foot.
  magma_tender: {
    w: 70, h: 52, ax: 36, ay: 50,
    sculpt(X, t) {
      const crust = '#3a2420';
      const heave = sn(t) * 0.8;
      X.in(0, 4);
      X.ball(36, 42, 30, 7, '#5a1a0a', 'molten', { rz: 5, cell: 3.5, flow: 0.8 });
      X.ball(38, 34 - heave, 22, 12 + heave, crust, 'molten', { rz: 12, cell: 5, flow: 0.3 });
      X.ball(18, 36, 11, 9, crust, 'molten', { rz: 9, cell: 4.5, flow: 0.3 });
      X.ball(56, 39, 10, 6, crust, 'molten', { rz: 6, cell: 4.5, flow: 0.3 });
      // Eye stalks, swaying.
      X.in(1, 1.5);
      for (const [x, ph] of [[13, 0], [19, 1.4]]) {
        const sw = sn(t, 1, ph) * 2;
        X.limb([[x, 30, 1.6, 6], [x - 2 + sw * 0.5, 24, 1.2, 7], [x - 3 + sw, 19, 1, 7]], crust, 'molten', { cell: 2.5 });
        X.ball(x - 3 + sw, 18, 2, 2, '#2a1a18', 'molten', { z: 8, rz: 2, cell: 2 });
      }
    },
    paint(P, t, st) {
      for (const [x, ph] of [[13, 0], [19, 1.4]]) P.eye(Math.round(x - 3 + sn(t, 1, ph) * 2 - 0.5), 18, st.wind ? '#ffffff' : '#ffd060', true);
    },
    fx(P, t) {
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        P.puff(30 + i * 10, 22 - k * 16, 1.5 + k * 2, '#5a4a48', 0.45 * (1 - k));
      }
    },
  },

  // An iron boiler on legs: a furnace in its belly behind a grate, a
  // leather bellows on its side pumping, stacks on its shoulders smoking;
  // red-hot as the heat in it climbs, steam spouting as it vents.
  bellows_golem: {
    w: 66, h: 70, ax: 33, ay: 68,
    sculpt(X, t, st) {
      const heat = st.heat || 0;
      const iron = heat >= 2 ? '#8a4a3a' : heat >= 1 ? '#6a4a44' : '#4a4a52';
      const pump = Math.max(0, sn(t, 2)) * 3;
      X.in(0, 2);
      // Legs, stumped and riveted.
      for (const x of [22, 44]) {
        X.limb([[x, 50, 4.6, 0], [x - 1, 58, 4, 0], [x - 1, 64, 4.4, 0]], iron, 'metal');
        X.ball(x - 2, 66, 6, 2.4, dark(iron, 0.8), 'metal', { rz: 2 });
      }
      X.in(1, 3);
      // The boiler: a riveted drum, a dome on top.
      X.ball(33, 38, 19, 16, iron, 'metal', { rz: 15 });
      X.ball(33, 22, 13, 6, iron, 'metal', { rz: 8, z: 3 });
      // Stacks.
      for (const x of [22, 44]) X.tube(x, 24, x + (x < 33 ? -2 : 2), 9, 3.4, 3, dark(iron, 0.8), 'metal', { z: 2 });
      X.in(2, 1);
      // The bellows on its flank, pumping.
      X.slab([[46, 32 - pump], [56, 28 - pump * 1.3], [57, 46 + pump * 0.3], [47, 45]], '#6a4a2a', 'leather', { z: 12, rz: 3, bevel: 2 });
      X.tube(47, 38, 52, 38, 1.2, 1.2, '#4a3a2a', 'wood', { z: 15 });
      // Its arms: pistons and pincers.
      X.limb([[15, 32, 3.4, 8], [9, 40, 3, 9], [10, 48, 2.6, 10]], dark(iron, 0.9), 'metal');
      X.ball(10, 50, 3.6, 3, dark(iron, 0.8), 'metal', { z: 11, rz: 3 });
    },
    paint(P, t, st) {
      const heat = st.heat || 0;
      // Rivets in rows; the grate over the fire.
      for (let i = 0; i < 9; i++) for (const y of [28, 48]) P.set(17 + i * 4, y + (i % 2), hex('#a8a8b0'));
      const fire = heat >= 2 ? '#fff0a0' : heat >= 1 ? '#ffb040' : '#ff7a20';
      for (let y = 37; y <= 45; y++) for (let x = 26; x <= 40; x++) {
        const bar = (x - 26) % 3 === 0 || y === 37 || y === 45;
        P.set(x, y, hex(bar ? '#2a2a30' : sn(t, 3, x * 0.7 + y) > 0.2 ? fire : '#ff5a10'));
      }
      if (heat >= 1) tint(P, (x, y) => hash2(x, y, 9) < 0.08 * heat, '#ff6030', 0.6);
    },
    fx(P, t, st) {
      for (const x of [20, 46]) {
        for (let i = 0; i < 3; i++) {
          const k = (t * 2 + i / 3 + x * 0.01) % 1;
          P.puff(x + sn(k, 1, x) * 2, 8 - k * 8, 1.5 + k * 3, '#6a6466', 0.5 * (1 - k));
        }
      }
      if (st.vent) for (let i = 0; i < 6; i++) {
        const k = (t * 3 + i / 6) % 1;
        P.puff(12 - k * 10, 38 + sn(k, 2, i) * 3, 2 + k * 4, '#f0f0f0', 0.7 * (1 - k));
      }
    },
  },

  // A heaving mass of fused glass and bone: eyes in it, ribs and skulls
  // half sunk in it, long crystals standing out of it, light running
  // through them; shards of it wheeling round it (rig).
  vitrified_horror: {
    w: 66, h: 62, ax: 33, ay: 60,
    sculpt(X, t) {
      const glass = '#5a7aa8';
      const heave = sn(t) * 0.7;
      X.in(0, 4);
      X.ball(33, 46, 24, 13 + heave, glass, 'glass', { rz: 12 });
      X.ball(27, 36, 14, 12, glass, 'glass', { rz: 11, z: 2 });
      X.ball(42, 38, 11, 10, glass, 'glass', { rz: 9, z: 1 });
      X.in(1, 1.5);
      // Bone sunk in the glass: ribs, a skull.
      for (let i = 0; i < 4; i++) X.limb([[22 + i * 5, 42, 1, 9], [20 + i * 5.4, 48, 0.9, 10], [24 + i * 5, 53, 0.8, 9]], '#e8e0c8', 'bone');
      X.ball(36, 32, 4.2, 4, '#e8e0c8', 'bone', { z: 10, rz: 3.6 });
      X.in(2, 1);
      for (const [x, y, a, l] of [[20, 30, -2.2, 14], [30, 26, -1.7, 18], [44, 30, -1.1, 12], [50, 40, -0.4, 9], [14, 40, -2.8, 9]]) {
        X.tube(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 2.4, 0.4, '#a8c8ff', 'glass', { z: 6 });
      }
    },
    paint(P, t, st) {
      P.rect(34, 31, 1.6, 1.6, '#1a1420');
      P.rect(37.4, 31, 1.6, 1.6, '#1a1420');
      for (const [x, y] of [[25, 38], [31, 45], [43, 42]]) P.eye(x, y, st.wind ? '#ffffff' : '#ff6040', true);
    },
    fx(P, t) {
      for (let i = 0; i < 5; i++) {
        const k = (t * 2 + i / 5) % 1;
        P.fx(30 + Math.cos(i) * 3 + k * 2, 26 - k * 16, '#e0f0ff', 0.9 * (1 - k));
      }
    },
    rig: {
      behind(R) {
        orbitShards(R, false);
      },
      front(R) {
        orbitShards(R, true);
      },
    },
  },

  // A drake, red and scarred: scales and a pale belly, horns, a collar of
  // iron at its throat (the chain from it runs to the stake in the floor:
  // the rig), its wings beating (the rig), a tail swinging, fire in its
  // jaws as it rears.
  chained_drake: {
    w: 74, h: 62, ax: 38, ay: 60,
    sculpt(X, t, st) {
      const scale = '#8a2a1e';
      const rear = st.wind ? 1 : 0;
      const sw = sn(t);
      X.in(0, 2);
      // The far legs, behind.
      X.limb([[46, 44, 4, -2], [49, 51, 3.2, -2], [47, 58, 2.6, -2]], dark(scale, 0.8), 'scales');
      X.limb([[28, 44, 3.6, -2], [25, 51, 3, -2], [27, 58, 2.6, -2]], dark(scale, 0.8), 'scales');
      X.in(1, 3.5);
      // Tail, swinging.
      X.limb([[54, 42, 6, 2], [62, 40 + sw, 4.4, 2], [68, 35 + sw * 2, 2.6, 2], [71, 28 + sw * 3, 1.2, 2]], scale, 'scales', { scale: 3 });
      // Body, belly, neck, head.
      X.ball(40, 38, 16, 10, scale, 'scales', { rz: 10, along: 'x', scale: 3.5 });
      X.ball(38, 44, 12, 5, '#d8a060', 'leather', { rz: 5, z: 4 });
      X.limb([[28, 34, 7, 4], [22, 26 - rear * 4, 5.4, 6], [17, 20 - rear * 7, 4.6, 7]], scale, 'scales', { scale: 2.6 });
      X.ball(11, 18 - rear * 7, 7, 5, scale, 'scales', { rz: 5.5, z: 7, ang: -0.1, scale: 2.4 });
      X.ball(5, 20 - rear * 7 + rear * 2, 4.2, 2.4, scale, 'scales', { rz: 3, z: 8, scale: 2 });
      X.in(2, 1.5);
      // Horns, swept back.
      X.limb([[13, 14 - rear * 7, 1.4, 9], [18, 10 - rear * 7, 0.9, 8], [22, 9 - rear * 7, 0.4, 7]], '#e8d8b0', 'bone');
      // The collar, iron, riveted.
      X.ball(22.5, 27 - rear * 4, 4, 5.6, '#5a5a62', 'metal', { rz: 3, z: 10, ang: 0.4 });
      // The near legs, in front.
      X.in(3, 2);
      X.limb([[48, 46, 4.6, 6], [52, 52, 3.6, 7], [49, 59, 3, 7]], scale, 'scales');
      X.limb([[30, 46, 4.2, 6], [27, 52, 3.4, 7], [29, 59, 3, 7]], scale, 'scales');
      for (const x of [47, 27]) X.ball(x, 60, 3.6, 1.6, dark(scale, 0.7), 'scales', { z: 8, rz: 1.5 });
    },
    paint(P, t, st) {
      const rear = st.wind ? 1 : 0;
      P.eye(9, 16 - rear * 7, st.wind ? '#ffffff' : '#ffd060', true);
      // Scars across its flank.
      P.line(36, 33, 44, 40, '#4a1410');
      P.line(40, 31, 47, 37, '#4a1410');
    },
    fx(P, t, st) {
      const rear = st.wind ? 1 : 0;
      if (st.wind) {
        for (let i = 0; i < 8; i++) {
          const k = (t * 3 + i / 8) % 1;
          P.puff(3 - k * 3, 21 - rear * 5 + sn(k, 2, i) * 2, 1 + k * 2, k < 0.4 ? '#fff0a0' : '#ff8030', 0.85 * (1 - k));
        }
      } else P.fx(3, 21, '#ff8030', 0.5 + 0.5 * sn(t, 2));
    },
    rig: {
      under(R) {
        drakeChain(R, false);
      },
      behind(R) {
        drakeWing(R, false);
      },
      front(R) {
        drakeWing(R, true);
      },
      over(R) {
        drakeChain(R, true);
      },
    },
  },

  // A hulk of slag, knuckles to the floor: rock crusted on rock, molten
  // seams, a core of fire in its chest; its lodestone heart waking blue.
  slag_titan: {
    w: 72, h: 70, ax: 36, ay: 68,
    sculpt(X, t) {
      const rock = '#5a4a44';
      const b = sn(t) * 0.8;
      X.in(0, 3);
      X.limb([[52, 30, 6, -2], [58, 44, 5, -2], [58, 60, 6.4, -2]], dark(rock, 0.8), 'rock', { cell: 4 });
      X.in(1, 4);
      for (const x of [27, 45]) X.limb([[x, 50, 6.6, 0], [x - 1, 66, 6.4, 0]], rock, 'rock', { cell: 4.5 });
      X.ball(37, 36 - b, 21, 17, rock, 'rock', { rz: 15, cell: 6 });
      X.ball(28, 20 - b, 12, 9, rock, 'rock', { rz: 9, z: 4, cell: 5 });
      X.ball(20, 24 - b, 6, 5, rock, 'molten', { rz: 5, z: 9, cell: 3 });
      X.in(2, 3);
      X.limb([[18, 30 - b, 7, 8], [12, 44, 6, 9], [13, 58, 7.4, 10]], rock, 'rock', { cell: 4.5 });
      X.ball(13, 61, 7, 5, rock, 'rock', { rz: 5, z: 10, cell: 3 });
      // Molten seams through it.
      X.in(3, 0.5);
      for (const [x0, y0, x1, y1] of [[30, 26, 40, 44], [44, 22, 48, 38], [24, 40, 34, 52]]) X.tube(x0, y0, x1, y1, 1.2, 0.8, '#ff6a1a', 'molten', { z: 16, glow: '#ffb040', glowK: 0.6, cell: 2 });
    },
    paint(P, t, st) {
      const wake = st.wind || st.eyes;
      P.blob(36, 33, 4 + sn(t) * 0.6, 4 + sn(t) * 0.6, wake ? '#5ac8ff' : '#ff8030', { lift: 0.6 });
      P.eye(18, 22, wake ? '#a0e8ff' : '#ffd060', true);
    },
    fx(P, t, st) {
      if (st.wind || st.eyes) for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + t * TAU;
        const k = (t * 2 + i / 8) % 1;
        P.fx(36 + Math.cos(a) * (18 - k * 14), 33 + Math.sin(a) * (14 - k * 10), '#a0e8ff', 0.9);
      }
    },
  },

  // A heart of rock and fire, hung in the air by four chains (rig, to the
  // anchors in the corners of its hall): it beats (twice, and rests), the
  // veins in it flaring with each beat.
  molten_heart: {
    w: 56, h: 74, ax: 28, ay: 72,
    sculpt(X, t) {
      const beat = beatOf(t);
      const s = 1 + beat * 0.07;
      X.in(0, 4);
      X.ball(28, 26, 15 * s, 13 * s, '#3a2420', 'molten', { rz: 13, cell: 4, flow: 0.5 });
      X.ball(21, 15, 7 * s, 6 * s, '#3a2420', 'molten', { rz: 6, cell: 3.5, z: 3 });
      X.ball(34, 14, 6 * s, 5.4 * s, '#3a2420', 'molten', { rz: 5, cell: 3.5, z: 2 });
      X.ball(28, 38, 9 * s, 8 * s, '#3a2420', 'molten', { rz: 8, cell: 4, z: 1 });
      X.in(1, 1.5);
      // Its great vessels, torn off short: the arch of the aorta rising out
      // of the top of it and over, the trunk beside it, a vein behind;
      // each open end dark and glowing within.
      X.limb([[25, 13, 3.4, 4], [24, 6, 3.2, 5], [27, 2, 3, 6], [32, 2, 2.8, 6], [35, 6, 2.6, 6]], '#5a2a20', 'flesh');
      X.limb([[31, 14, 2.8, 8], [33, 9, 2.4, 8], [32, 6, 2.1, 8]], '#6a3024', 'flesh');
      X.limb([[18, 15, 2.4, 2], [16, 9, 2, 2]], '#4a2018', 'flesh');
      for (const [x, y, r] of [[35.4, 7.4, 2], [32, 5.2, 1.6], [16, 8.2, 1.4]]) X.ball(x, y, r, r * 0.6, '#ff6a1a', 'molten', { z: 10, rz: 0.5, glow: '#ffb040', glowK: 0.5 });
    },
    paint(P, t) {
      const beat = beatOf(t);
      const col = mix(hex('#ff5a10'), hex('#fff0a0'), beat);
      for (const pts of [[[20, 20], [24, 28], [22, 36]], [[34, 18], [31, 27], [35, 34]], [[27, 14], [28, 24], [28, 34], [29, 42]]]) crack(P, pts, toHex(col), '#ffffff');
    },
    fx(P, t) {
      const beat = beatOf(t);
      P.puff(28, 27, 16, '#ff6020', 0.12 + beat * 0.2);
      for (let i = 0; i < 4; i++) {
        const k = (t * 2 + i / 4) % 1;
        P.fx(20 + i * 5, 50 + k * 18, k < 0.5 ? '#ffb040' : '#ff6020', 0.9 * (1 - k));
      }
    },
    rig: {
      under(R) {
        heartChains(R, false);
      },
      over(R) {
        heartChains(R, true);
      },
    },
  },
};

// The wyrm's length: black glass, glossy, rippled as glass breaks (in
// shells), its belly in plates; a crystal spine standing up off every
// other segment, smaller toward the tail; raised a little near its neck.
const wyrmSpine = [];
const GLASS = hex('#3a3058');
const GLASS_BELLY = hex('#2a2240');
const wyrmCfg = {
  n: 13, gap: 0.5, wave: 3.2, amp: 0.22, gloss: 0.9,
  lift: (i) => Math.max(0, 3 - i) * 0.8,
  rad: (k) => 1.2 + 5.4 * Math.pow(1 - k, 0.8),
  skin(k, u, v, ny) {
    if (ny > 0.45) return Math.floor(u / 3) % 2 ? shade(GLASS_BELLY, 0.8) : GLASS_BELLY;
    // (Conchoidal ripples: rings in the glass, lighter where they break.)
    const r = Math.sin(u * 0.75 + v * 2.4 + hash2(Math.floor(u / 6), 1, 3) * 6);
    return r > 0.82 ? mix(GLASS, [150, 130, 210], 0.35) : r < -0.9 ? shade(GLASS, 0.7) : GLASS;
  },
  crest(i) {
    if (i % 2 || i > 10) return null;
    const k = Math.min(3, Math.floor(i / 3));
    return (wyrmSpine[k] ||= part(`wyrm_spine${k}`, 7, 10, 3.5, 9, (X) => {
      const h = 7.5 - k * 1.5;
      X.slab([[1.5, 9.5], [3.2, 9.5 - h], [4.2, 9.5 - h * 0.6], [5.5, 9.5]], '#8a78c8', 'glass', { rz: 1.4, bevel: 0.8 });
    }));
  },
};

// The shards wheeling round the Vitrified Horror (those behind it first).
function orbitShards(R, front) {
  const sh = part('vh_shard', 9, 9, 4.5, 4.5, (X) => X.slab([[1, 4], [4.5, 0.5], [8, 3], [5, 8]], '#a8c8ff', 'glass', { rz: 1.5, bevel: 1 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + R.t * (0.9 + (i % 2) * 0.3);
    const s = Math.sin(a);
    if ((s > 0) !== front) continue;
    sh.draw(R.ctx, R.ox + 33 + Math.cos(a) * 27, R.oy + 38 + s * 8 + Math.sin(R.t * 2 + i) * 2, R.t * 2 + i, false, front ? 1 : 0.7);
  }
}

// The drake's chain: from the collar at its throat to the stake in the
// floor of its hall, iron links that hang and drag and pull taut (a
// Verlet chain in the world: see bossrig.Rope); torn free, it drags
// behind from the collar.
function drakeChain(R, front) {
  const e = R.e;
  const s = e.rig;
  const p = posOf(e);
  const A = e.anchor;
  if (!A) return;
  // (The collar, in the world: up its neck, toward its head; where it's
  // painted, a tile to the side it faces and two and a half layers up.)
  const [fx, fz] = R.r.toWorld(R.flip ? 1 : -1, 0);
  const rear = R.st.wind ? 1 : 0;
  const collar = { x: p.x + fx * 0.97, y: 2.0 + rear * 0.25, z: p.z + fz * 0.97 };
  const stake = { x: A.x, y: 0.1, z: A.z };
  if (!s.chain) s.chain = new Rope(18, 0.42, collar, e.unchained ? null : stake);
  // (The collar's painted on the side it faces on screen: turn the camera
  // and it's somewhere else in the world. The chain's carried there.)
  if (s.chainView !== undefined && s.chainView !== R.r.view && s.chainAt) s.chain.carry(collar.x - s.chainAt.x, 0, collar.z - s.chainAt.z, !e.unchained);
  s.chainView = R.r.view;
  s.chainAt = collar;
  if (!front) s.chain.step(R.dt || 1 / 60, collar, e.unchained ? null : stake, { gravity: 18, drag: 0.97 });
  const pts = s.chain.screen(R.r, p.y);
  // (Split where it passes nearer you than the drake.)
  const near = R.r.toView(p.x, p.z)[1] + 0.35;
  const seq = [];
  for (let i = 0; i < pts.length; i++) {
    const q = s.chain.p[i];
    if ((R.r.toView(q.x, q.z)[1] > near) === front) seq.push(pts[i]);
    else {
      if (seq.length > 1) drawChain(R.ctx, seq, '#6a6670');
      seq.length = 0;
    }
  }
  if (seq.length > 1) drawChain(R.ctx, seq, '#6a6670');
  // The stake, and the ring on it.
  if (!front && !e.unchained) {
    const q = onScreen(R.r, A.x, p.y, A.z);
    R.ctx.fillStyle = '#3a3638';
    R.ctx.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 6, 4, 7);
    R.ctx.fillStyle = '#8a8690';
    R.ctx.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 6, 4, 1);
  }
}
// Its wings: membrane on a frame of bone, half spread and beating (the far
// one behind it, darker).
function drakeWing(R, near) {
  const w = part(`drake_wing${near ? 1 : 0}`, 30, 24, 4, 21, (X) => {
    const c = near ? '#7a2a20' : '#5a1e16';
    X.slab([[4, 21], [14, 4], [28, 1], [26, 10], [20, 13], [17, 22]], c, 'leather', { rz: 1.4, bevel: 1.2 });
    for (const [x1, y1] of [[14, 4], [28, 1], [26, 10]]) X.tube(4, 21, x1, y1, 1.2, 0.5, '#d8b088', 'bone', { z: 1.6 });
  });
  const rate = R.st.wind ? 8 : 3.2;
  const beat = Math.sin(R.t * rate + (near ? 0 : 0.5));
  const sy = 0.35 + 0.65 * (beat * 0.5 + 0.5);
  w.flapY(R.ctx, R.ox + (near ? 40 : 46), R.oy + 31, near ? -0.25 : -0.05, sy * (near ? 1 : 0.9), near ? 1 : 0.85);
}
// The heart's beat: two strokes and a rest (0..1).
function beatOf(t) {
  const k = (t * 2) % 1;
  return Math.max(0, Math.sin(k * TAU * 2)) * (k < 0.5 ? 1 : 0);
}
// Its chains: one from each anchor in its hall up to it, fast to its side
// that faces the anchor (those that come from nearer you than it drawn
// over it, `front`); an anchor broken, its chain hangs loose from the
// heart and swings as it beats.
function heartChains(R, front) {
  const e = R.e;
  const g = e.game;
  const s = e.rig;
  const p = posOf(e);
  const top = { x: p.x, y: 3.3, z: p.z };
  const mid = R.r.toView(p.x, p.z)[1];
  s.chains ||= [];
  // (Each anchor's chain made as it's first seen, and kept after it's
  // broken.)
  for (const a of g && g.creatures ? g.creatures : []) {
    if (a.species !== 'heart_anchor' || a.dead || s.chains.some((c) => c.a === a)) continue;
    const d = Math.hypot(a.x - top.x, a.z - top.z) || 1;
    s.chains.push({ a, rope: new Rope(14, (Math.hypot(d, top.y) / 14) * 1.06, top, { x: a.x, y: 0.25, z: a.z }) });
  }
  for (const c of s.chains) {
    const a = c.a;
    const held = !a.dead && g.creatures.includes(a);
    const dx = a.x - top.x;
    const dz = a.z - top.z;
    const d = Math.hypot(dx, dz) || 1;
    if ((R.r.toView(a.x, a.z)[1] > mid) !== front) continue;
    const from = { x: top.x + (dx / d) * 0.6, y: top.y, z: top.z + (dz / d) * 0.6 };
    c.rope.step(R.dt || 1 / 60, from, held ? { x: a.x, y: 0.25, z: a.z } : null, { gravity: 14, drag: 0.96 });
    drawChain(R.ctx, c.rope.screen(R.r, p.y), '#7a6a5a');
  }
}

Object.assign(BEASTS, {
  // ------------------------------------------------------------ Myrrow
  // A moth as big as a cart: a furred body (head, thorax, a long banded
  // abdomen), plumed feelers, legs; hung in the air on four wings of
  // dusk-violet, each beating on its own hinge, an eye on each (the rig);
  // they open, and glow, as she fixes you with them.
  moth_mother: {
    w: 60, h: 60, ax: 30, ay: 58,
    sculpt(X, t) {
      const fur = '#6a5a7a';
      const bob = sn(t) * 1.2;
      X.in(0, 3);
      X.limb([[36, 32 + bob, 6, 2], [44, 35 + bob, 5.4, 2], [51, 39 + bob, 3.6, 2]], '#4a3a5a', 'fur', { seed: 3 });
      X.ball(27, 30 + bob, 8, 7, fur, 'fur', { rz: 7 });
      X.ball(18, 28 + bob, 5, 4.6, fur, 'fur', { rz: 4.6, z: 2 });
      X.in(1, 1);
      // Plumed feelers.
      for (const [dx, ph] of [[0, 0], [2, 1]]) {
        const sw = sn(t, 1, ph) * 1.5;
        X.limb([[16 + dx, 24 + bob, 0.7, 5], [12 + dx + sw, 17 + bob, 0.6, 5], [9 + dx + sw * 1.5, 12 + bob, 0.4, 5]], '#c8b8a0', 'feather');
        for (let k = 0; k < 4; k++) X.tube(12 + dx + sw - k, 17 + bob - k * 1.4, 10 + dx + sw - k, 15 + bob - k * 1.4, 0.4, 0.2, '#c8b8a0', 'feather', { z: 5 });
      }
      // Legs, dangling.
      X.in(2, 1);
      for (let i = 0; i < 3; i++) X.limb([[24 + i * 4, 35 + bob, 0.9, 6], [22 + i * 4, 41 + bob, 0.7, 6], [23 + i * 4 + sn(t, 1, i), 46 + bob, 0.5, 6]], '#3a2e48', 'chitin');
    },
    paint(P, t, st) {
      const bob = sn(t) * 1.2;
      P.eye(15, 27 + bob, st.eyes ? '#ffe070' : '#c8a0ff', true);
      // Bands down the abdomen.
      tint(P, (x, y) => x > 34 && (x - 34) % 4 === 0 && Math.abs(y - (34 + bob + (x - 36) * 0.4)) < 5, '#2a2036', 0.5);
    },
    fx(P, t) {
      for (let i = 0; i < 6; i++) {
        const k = (t + i / 6) % 1;
        P.fx(22 + i * 4 + sn(k, 1, i) * 3, 40 + k * 18, '#d8c8f0', 0.8 * (1 - k));
      }
    },
    rig: {
      behind(R) {
        mothWings(R, false);
      },
      front(R) {
        mothWings(R, true);
      },
    },
  },

  // A colossus of fungus: a great spotted cap over a pale fibrous stalk of
  // a body, gills under it shedding spores, arms of root, a skirt of roots
  // for legs; its cap claps down as it coughs.
  spore_colossus: {
    w: 70, h: 74, ax: 35, ay: 72,
    sculpt(X, t, st) {
      const cough = st.wind ? 1 : 0;
      const cap = '#6a3a5a';
      X.in(0, 3);
      for (let i = 0; i < 7; i++) {
        const x = 20 + i * 5;
        X.limb([[35 + (i - 3) * 2, 56, 2.6, 1], [x, 66, 2, 1], [x + (i - 3) * 1.4, 71, 1.4, 1]], '#8a7060', 'bark');
      }
      X.ball(35, 48, 12, 14, '#d8ccc0', 'fungus', { rz: 11 });
      X.ball(35, 36, 10, 8, '#d8ccc0', 'fungus', { rz: 9, z: 1 });
      X.in(1, 2);
      // Root arms.
      X.limb([[25, 40, 3.4, 6], [16, 46, 2.8, 7], [12, 56 + sn(t), 2, 7], [10, 60 + sn(t), 1.2, 6]], '#8a7060', 'bark');
      X.limb([[46, 40, 3.4, 6], [54, 46, 2.8, 7], [57, 55 - sn(t), 2, 7]], '#8a7060', 'bark');
      X.in(2, 2.5);
      // The gills and the cap over them.
      X.ball(35, 30 + cough * 4, 24, 4, '#c8a8a0', 'fungus', { rz: 3, z: 2 });
      X.ball(35, 22 + cough * 4, 26, 11, cap, 'fungus', { rz: 12, z: 3 });
    },
    paint(P, t, st) {
      const cough = st.wind ? 1 : 0;
      for (let i = 0; i < 9; i++) {
        const x = 14 + hash2(i, 1, 5) * 42;
        const y = 14 + cough * 4 + hash2(i, 2, 5) * 12;
        P.blob(x, y, 1.8 + hash2(i, 3, 5) * 1.6, 1.4 + hash2(i, 3, 5), '#f0e0c8', { lift: 0.3 });
      }
      for (let x = 13; x < 58; x += 2) P.set(x, 31 + cough * 4, hex('#8a6060'));
      P.eye(31, 38, '#e8ff80');
      P.eye(38, 38, '#e8ff80');
    },
    fx(P, t, st) {
      for (let i = 0; i < (st.wind ? 18 : 8); i++) {
        const k = (t + i / 10) % 1;
        P.fx(14 + hash2(i, 4, 5) * 42 + sn(k, 1, i) * 2, 32 + k * 30, i % 2 ? '#e8e0a0' : '#c0d880', 0.8 * (1 - k));
      }
    },
  },

  // A lamprey grown huge: up out of the black water, its round mouth all
  // rings of teeth, gills in a row behind (the painting); the long grey-
  // green body behind it strung out through the water (the rig). Under the
  // water, only its back-fin cutting along and the rings it makes.
  lamprey_queen: {
    w: 40, h: 48, ax: 28, ay: 46,
    noBody: (e, st) => !!st.under,
    sculpt(X, t, st) {
      const skin = '#4a5a48';
      const gape = st.wind ? 1 : 0.4 + sn(t) * 0.15;
      X.in(0, 3);
      X.limb([[28, 46, 6, 2], [26, 36, 6, 4], [20, 26, 5.6, 6], [13, 19, 5.4, 7]], skin, 'slime');
      X.ball(9, 15, 6.4, 6.8, skin, 'slime', { rz: 6, z: 7 });
      X.in(1, 0.5);
      // The mouth: a round sucker, rings of teeth in it.
      X.ball(5, 14, 4.6 * (0.8 + gape * 0.2), 5.4 * (0.8 + gape * 0.2), '#7a4a48', 'flesh', { rz: 1.5, z: 12 });
    },
    paint(P, t, st) {
      const gape = st.wind ? 1 : 0.4 + sn(t) * 0.15;
      const r = 4.6 * (0.8 + gape * 0.2);
      P.blob(5, 14, r * 0.55, r * 0.65, '#1a0a0a', { amb: 0 });
      for (let k = 0; k < 2; k++) for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + k * 0.3;
        P.set(5 + Math.cos(a) * (r * (0.75 - k * 0.25)), 14 + Math.sin(a) * (r * (0.85 - k * 0.25)), hex('#f0e8d0'));
      }
      for (let i = 0; i < 5; i++) P.rect(15 + i * 2, 21 + i * 1.6, 1, 2, '#1a2018');
      P.eye(12, 10, '#e0f070');
    },
    rig: {
      under(R) {
        if (R.st.under) lampreyUnder(R);
        else serpent(R, lampreyCfg, false);
      },
      over(R) {
        if (!R.st.under) serpent(R, lampreyCfg, true);
      },
    },
  },

  // A bloated sac of marsh-gas, floating: veined, pocked with blisters,
  // swelling and settling, its little pinched face in the middle of it;
  // feelers trailing under it (the rig); gas leaking from it.
  gas_bloat: {
    w: 60, h: 66, ax: 30, ay: 64,
    sculpt(X, t) {
      const sw = sn(t) * 1.2;
      X.in(0, 4);
      X.ball(30, 26, 20 + sw, 18 + sw, '#7a8a50', 'slime', { rz: 17 });
      X.ball(22, 18, 7, 6, '#8a9a5a', 'slime', { rz: 5, z: 12 });
      X.ball(40, 32, 6, 5, '#8a9a5a', 'slime', { rz: 5, z: 12 });
      X.ball(30, 44, 6, 3, '#5a6a3a', 'flesh', { rz: 3, z: 6 });
    },
    paint(P) {
      // Veins, blisters; the little pinched face.
      for (const pts of [[[16, 20], [22, 26], [20, 34]], [[38, 14], [36, 22], [42, 28]], [[30, 10], [30, 18]]]) for (let i = 0; i + 1 < pts.length; i++) P.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#4a3a2a');
      for (const [x, y] of [[20, 30], [38, 20], [44, 34], [26, 38]]) P.blob(x, y, 1.4, 1.2, '#c8d070', { lift: 0.3 });
      P.blob(30, 28, 3.5, 2.6, '#4a4a2a', { amb: 0.4 });
      P.set(28, 27, hex('#ffe070'));
      P.set(32, 27, hex('#ffe070'));
      P.line(29, 30, 31, 30, '#2a1a10');
    },
    fx(P, t) {
      for (let i = 0; i < 5; i++) {
        const k = (t + i / 5) % 1;
        P.puff(18 + i * 6 + sn(k, 1, i) * 2, 10 - k * 8, 2 + k * 3, '#b0c070', 0.4 * (1 - k));
      }
    },
    rig: {
      behind(R) {
        bloatFeelers(R);
      },
    },
  },

  // Three drowned singers grown into one, up to their waists in black
  // water: hair streaming, eyes pale, mouths open; when they sing their
  // mouths glow and the notes rise.
  drowned_choir: {
    w: 66, h: 56, ax: 33, ay: 54,
    sculpt(X, t) {
      const skin = '#8a9aa0';
      X.in(0, 3);
      // The water they stand in.
      X.ball(33, 50, 30, 5, '#1e3a4a', 'glass', { rz: 2 });
      X.in(1, 3);
      for (const [cx, h, ph] of [[18, 0, 0], [33, -4, 1.2], [48, 0, 2.4]]) {
        const sway = sn(t, 1, ph) * 0.8;
        X.ball(cx, 40 + h, 8, 9, '#2a3a40', 'cloth', { rz: 7 });
        X.tube(cx, 31 + h, cx + sway, 26 + h, 2.4, 2.2, skin, 'skin');
        X.ball(cx + sway, 21 + h, 5, 5.6, skin, 'skin', { rz: 5, z: 2 });
        // Hair, long and streaming wet.
        X.limb([[cx + sway + 1, 17 + h, 5, 1], [cx + sway + 4 + sway, 26 + h, 4.4, 0], [cx + sway + 5 + sway * 2, 36 + h, 3, -1]], '#1a2a2a', 'hair');
      }
    },
    paint(P, t, st) {
      for (const [cx, h, ph] of [[18, 0, 0], [33, -4, 1.2], [48, 0, 2.4]]) {
        const sway = sn(t, 1, ph) * 0.8;
        P.eye(cx + sway - 2, 20 + h, '#c8f0ff');
        P.eye(cx + sway + 1, 20 + h, '#c8f0ff');
        P.blob(cx + sway - 0.5, 24 + h, 1.2, st.song ? 1.8 : 1, st.song ? '#a0f0ff' : '#1a1418', { lift: st.song ? 0.6 : 0 });
      }
    },
    fx(P, t, st) {
      for (let i = 0; i < 4; i++) {
        const k = (t + i / 4) % 1;
        P.fx(4 + ((i * 17) % 58) + k * 4, 50, '#a0d0e0', 0.5 * (1 - k));
      }
      if (st.song) for (let i = 0; i < 6; i++) {
        const k = (t * 2 + i / 6) % 1;
        P.fx(18 + (i % 3) * 15 + sn(k, 1, i) * 3, 20 - k * 18, '#a0f0ff', 1 - k);
      }
    },
  },

  // A kraken off a smugglers' wreck: a great red mantle, one eye (the
  // other under a patch), a sea-chest spilling gold in its grip; its eight
  // arms curling and uncurling (the rig), suckers along them; ink running
  // from it.
  smugglers_kraken: {
    w: 76, h: 66, ax: 38, ay: 64,
    sculpt(X, t) {
      const red = '#a03a30';
      const sw = sn(t);
      X.in(0, 4);
      X.ball(42, 26 + sw, 15, 18, red, 'flesh', { rz: 14, ang: 0.35 });
      X.ball(34, 42, 13, 9, red, 'flesh', { rz: 10, z: 2 });
      X.in(1, 1.5);
      // The sea-chest, banded, its lid sprung.
      X.slab([[14, 48], [34, 48], [33, 60], [15, 60]], '#6a4a2a', 'wood', { rz: 6, bevel: 2, z: 8 });
      X.slab([[14, 45], [34, 43], [34, 47], [14, 49]], '#5a3a20', 'wood', { rz: 4, bevel: 1.5, z: 10 });
      X.tube(14, 54, 34, 54, 1, 1, '#c8a040', 'gold', { z: 14 });
      for (let i = 0; i < 6; i++) X.ball(17 + i * 3, 46 + (i % 2), 1.6, 1.2, '#ffd050', 'gold', { z: 12 + (i % 2), rz: 1.2 });
    },
    paint(P, t, st) {
      P.eye(31, 36, st.wind ? '#ffffff' : '#ffe060', true);
      P.blob(39, 35, 3, 2.4, '#1a1414', { amb: 0.3 });
      P.line(36, 31, 46, 39, '#1a1414');
    },
    fx(P, t) {
      for (let i = 0; i < 4; i++) {
        const k = (t + i / 4) % 1;
        P.puff(52 + i * 4, 56 + k * 6, 2 + k * 3, '#1a1420', 0.45 * (1 - k));
      }
      if (Math.floor(t * 12) % 3 === 0) P.fx(20 + (Math.floor(t * 12) % 12), 46, '#ffffff', 1);
    },
    rig: {
      behind(R) {
        krakenArms(R, false);
      },
      front(R) {
        krakenArms(R, true);
      },
    },
  },

  // A sea-turtle as old as the reef: a domed shell grown over with coral
  // and weed and barnacles, a beaked head swaying on its neck, flippers
  // rowing.
  tide_mother: {
    w: 76, h: 56, ax: 38, ay: 54,
    sculpt(X, t) {
      const skin = '#6a7a5a';
      const row = sn(t);
      X.in(0, 2);
      X.limb([[52, 42, 4, -2], [60, 48 - row * 2, 3, -2], [66, 50 - row * 3, 1.6, -2]], dark(skin, 0.8), 'leather');
      X.in(1, 3);
      X.ball(40, 34, 24, 15, '#4a6a5a', 'shell', { rz: 15 });
      X.ball(40, 43, 22, 5, '#c8b890', 'leather', { rz: 4, z: 4 });
      // Coral and weed grown on it; barnacles.
      X.in(2, 1);
      for (const [x, y, c] of [[32, 22, '#e07868'], [46, 21, '#f0a060'], [52, 27, '#e07868']]) {
        X.tube(x, y + 2, x - 2, y - 5, 1.6, 0.8, c, 'coral', { z: 12 });
        X.tube(x, y, x + 3, y - 4, 1.2, 0.6, c, 'coral', { z: 12 });
      }
      for (let i = 0; i < 6; i++) X.ball(26 + i * 5, 28 + (i % 2) * 6, 1.4, 1.2, '#d8d0c0', 'shell', { z: 13, rz: 1.2 });
      X.in(3, 2.5);
      // The head on its neck, and the near flipper.
      X.limb([[20, 38, 5, 6], [13, 36 + sn(t) * 1.5, 4.4, 7]], skin, 'leather');
      X.ball(9, 35 + sn(t) * 1.5, 6, 4.6, skin, 'leather', { rz: 4.6, z: 8 });
      X.slab([[26, 44], [32, 44], [24, 54 + row * 2], [16, 52 + row * 2]], skin, 'leather', { rz: 2.4, bevel: 1.6, z: 9 });
    },
    paint(P, t) {
      P.eye(7, 33 + sn(t) * 1.5, '#e0d080', true);
      P.line(3, 36 + sn(t) * 1.5, 7, 37 + sn(t) * 1.5, '#2a2a1a');
      // The plates of the shell.
      for (const [x, y] of [[34, 26], [44, 26], [39, 33], [30, 34], [48, 34]]) P.line(x - 4, y, x + 4, y, '#2a3a30');
    },
    fx(P, t) {
      for (let i = 0; i < 4; i++) {
        const k = (t + i / 4) % 1;
        P.fx(14 + i * 14, 52 - k * 4, '#a0d8e0', 0.5 * Math.sin(k * Math.PI));
      }
    },
  },

  // A clam the size of a boat: two ridged shells, closed, breathing bubbles
  // out of the lip; prised open, a tongue of blue flesh and a pearl
  // glowing in it.
  abyssal_clam: {
    w: 70, h: 54, ax: 35, ay: 52,
    sculpt(X, t, st) {
      const open = st.open ? 1 : 0.05 + Math.max(0, sn(t)) * 0.05;
      X.in(0, 2);
      // The lower shell.
      X.ball(35, 42, 28, 9, '#5a5a6a', 'shell', { rz: 10 });
      if (open > 0.2) {
        X.in(1, 2);
        X.ball(35, 38, 20, 5, '#5a7aa8', 'slime', { rz: 4, z: 3 });
        X.ball(35, 35, 4, 4, '#f0f8ff', 'shell', { rz: 4, z: 6, glow: '#c0f0ff', glowK: 0.4 });
      }
      X.in(2, 2);
      // The upper shell, ridged, lifting.
      X.ball(35, 32 - open * 10, 28, 11, '#6a6a7c', 'shell', { rz: 11, z: 1 + open * 2 });
      for (let i = 0; i < 7; i++) X.tube(35, 40 - open * 10, 12 + i * 7.6, 24 - open * 10 + Math.abs(i - 3) * 2, 1.4, 1, '#7a7a8c', 'shell', { z: 10 });
    },
    fx(P, t, st) {
      for (let i = 0; i < 4; i++) {
        const k = (t + i / 4) % 1;
        P.fx(20 + i * 10 + sn(k, 1, i) * 2, 40 - k * 24, '#c0e8f8', 0.8 * (1 - k));
      }
      if (st.open) P.puff(35, 35, 8, '#c0f0ff', 0.25 + 0.1 * sn(t, 2));
    },
  },

  // A giant built of the reef: rock and coral, branches of it on its
  // shoulders like horns, anemones waving, eyes glowing in a crevice; a
  // shoal of little fish wheeling round it (the rig).
  coral_colossus: {
    w: 74, h: 72, ax: 37, ay: 70,
    sculpt(X, t) {
      const rock = '#6a6a70';
      const b = sn(t) * 0.8;
      X.in(0, 3);
      for (const x of [28, 46]) X.limb([[x, 50, 6.4, 0], [x - 1, 67, 6, 0]], rock, 'rock', { cell: 4.5 });
      X.ball(37, 36 - b, 20, 17, rock, 'rock', { rz: 15, cell: 6 });
      X.ball(30, 22 - b, 11, 9, rock, 'rock', { rz: 9, z: 3, cell: 5 });
      X.in(1, 2);
      // Coral branches on its shoulders; anemones.
      for (const [x, y, s] of [[20, 20, -1], [50, 20, 1]]) {
        X.limb([[x, y - b, 2.4, 6], [x + s * 4, y - 8 - b, 1.8, 6], [x + s * 3, y - 15 - b, 1.2, 6]], '#e07868', 'coral');
        X.limb([[x + s * 4, y - 8 - b, 1.4, 6], [x + s * 9, y - 12 - b, 1, 6]], '#f0a060', 'coral');
      }
      for (let i = 0; i < 4; i++) {
        const x = 26 + i * 6;
        const w = sn(t, 1, i) * 1.4;
        X.limb([[x, 44 - b, 1.4, 14], [x + w, 40 - b, 1, 14], [x + w * 1.6, 37 - b, 0.6, 14]], i % 2 ? '#f080c0' : '#80e0c0', 'slime');
      }
      X.in(2, 3);
      X.limb([[18, 30 - b, 6, 8], [12, 44, 5.4, 9], [13, 57, 6.4, 10]], rock, 'rock', { cell: 4 });
    },
    paint(P, t, st) {
      const b = sn(t) * 0.8;
      P.blob(30, 23 - b, 5, 2, '#1a1418', { amb: 0 });
      P.eye(28, 23 - b, st.wind ? '#ffffff' : '#ff8a8a', true);
      P.eye(32, 23 - b, st.wind ? '#ffffff' : '#ff8a8a', true);
    },
    rig: {
      behind(R) {
        shoal(R, false);
      },
      front(R) {
        shoal(R, true);
      },
    },
  },
});

// The lamprey's length: slick grey-green, mottled dark, pale under; a
// soft fin running along the back of it to the tail.
const LAMP = hex('#4a5a48');
const LAMP_BELLY = hex('#9aa888');
const lampreyCfg = {
  n: 14, gap: 0.5, wave: 2.6, amp: 0.3, gloss: 0.55,
  rad: (k) => 1 + 5.2 * Math.pow(1 - k, 0.7),
  skin(k, u, v, ny) {
    if (ny > 0.4) return mix(LAMP, LAMP_BELLY, Math.min(1, (ny - 0.4) * 3));
    const m = hash2(Math.floor(u / 3), Math.floor((v + 1) * 2.5), 7);
    return m > 0.78 ? shade(LAMP, 0.62) : LAMP;
  },
  fin: (k) => (k > 0.25 ? { h: 1 + 2.4 * Math.sin(((k - 0.25) / 0.75) * Math.PI * 0.9), col: '#3a4a38' } : null),
};
// Under the water: its back-fin cutting along the surface, the rings it
// makes.
function lampreyUnder(R) {
  const e = R.e;
  const s = e.rig;
  if (!s.train) s.train = new Train(lampreyCfg.n, lampreyCfg.gap);
  const p = posOf(e);
  s.train.mark(p.x, p.z);
  const pts = s.train.points(backward(R), (i) => Math.sin(R.t * 2.6 - i * 0.9) * 0.3);
  const ctx = R.ctx;
  pts.forEach((q, i) => {
    if (i % 2) return;
    const a = onScreen(R.r, q.x, p.y, q.z);
    ctx.globalAlpha = 0.85 - i * 0.05;
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(Math.round(a.x) - 1, Math.round(a.y) - 5 + (i ? 1 : 0), 2, i ? 3 : 4);
    ctx.fillStyle = '#c8e0e8';
    ctx.fillRect(Math.round(a.x) - 3, Math.round(a.y) - 1, 6, 1);
  });
  const h = onScreen(R.r, p.x, p.y, p.z);
  const k = (R.t * 0.8) % 1;
  ctx.globalAlpha = 0.6 * (1 - k);
  ctx.strokeStyle = '#c8e0e8';
  ctx.beginPath();
  ctx.ellipse(h.x, h.y - 1, 3 + k * 12, (3 + k * 12) * 0.45, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// The Moth-Mother's wings: fore and hind on each side, each its own
// sculpted piece (membrane furred at the root, an eye on the forewing),
// beating on its hinge at the thorax, the far pair behind her body.
// (How far (x, y) is from the line a-b.)
function segDist(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
}
const marginDist = (x, y, edge) => Math.min(...edge.slice(1).map((b, i) => segDist(x, y, edge[i], b)));
// A moth's wing, marked as a moth's are: dark veins running out from the
// root, a pale band in from the outer edge and a fringe on it, a dusting
// of scales, and an eye (rings of black, gold and a white spark) that
// glows when she opens them on you; `outer` the edge it's marked in from.
function mothMarks(P, root, outer, eye, base, eyes) {
  const pale = mix(base, [230, 200, 240], 0.45);
  P.over((x, y, c) => {
    const d = marginDist(x + 0.5, y + 0.5, outer);
    let n = c;
    // (The veins: lines from the root out to the edge, every so often.)
    const a = Math.atan2(y - root[1], x - root[0]);
    if (Math.abs(Math.sin(a * 7)) < 0.12 && Math.hypot(x - root[0], y - root[1]) > 5) n = shade(n, 0.72);
    if (d < 1.2) n = (x + y) % 2 ? mix(n, pale, 0.6) : shade(n, 0.7);
    else if (d > 2.4 && d < 4.2) n = mix(n, pale, 0.35);
    if (hash2(x, y, 21) > 0.9) n = shade(n, 1.15);
    // (The eye.)
    if (eye) {
      const e = Math.hypot((x - eye[0]) / 1.1, y - eye[1]);
      if (e < eye[2]) {
        const k = e / eye[2];
        n = k < 0.25 ? (eyes ? [255, 255, 255] : [210, 190, 240]) : k < 0.5 ? (eyes ? [40, 20, 10] : [26, 18, 40]) : k < 0.8 ? (eyes ? [255, 214, 90] : [214, 160, 70]) : [26, 18, 40];
      }
    }
    return n;
  });
  if (eye && eyes) P.glint(eye[0] - 1, eye[1] - 1);
}
function mothWings(R, near) {
  const eyes = !!R.st.eyes;
  const fore = part(`moth_fore${near ? 1 : 0}${eyes ? 1 : 0}`, 34, 30, 30, 27, (X) => {
    const c = near ? '#6a4a8a' : '#4a3a6a';
    // (Long and pointed: the leading edge running straight out to the
    // tip, the outer edge curving back in.)
    X.slab([[30, 27], [27, 21], [21, 13], [13, 6], [5, 2], [1, 2], [1, 6], [3, 12], [8, 18], [15, 23], [23, 27]], c, 'velvet', { rz: 1.4, bevel: 2.2 });
    X.ball(27, 24, 4, 3, '#8a7a9a', 'fur', { z: 1.6, rz: 1 });
  }, { paint: (P) => mothMarks(P, [30, 27], [[1, 2], [1, 6], [3, 12], [8, 18], [15, 23], [23, 27]], [12, 11, 4.6], hex(near ? '#6a4a8a' : '#4a3a6a'), eyes) });
  const hind = part(`moth_hind${near ? 1 : 0}${eyes ? 1 : 0}`, 24, 22, 20, 3, (X) => {
    const c = near ? '#7a4a7a' : '#4a3a5a';
    // (Round, a fan.)
    X.slab([[20, 3], [14, 1], [8, 3], [3, 8], [2, 14], [5, 19], [10, 20], [15, 17], [19, 10]], c, 'velvet', { rz: 1.4, bevel: 2 });
    X.ball(18, 5, 3, 2.4, '#8a7a9a', 'fur', { z: 1.4, rz: 0.8 });
  }, { paint: (P) => mothMarks(P, [20, 3], [[8, 3], [3, 8], [2, 14], [5, 19], [10, 20], [15, 17]], [8, 13, 2.6], hex(near ? '#7a4a7a' : '#4a3a5a'), eyes) });
  const bob = Math.sin(R.phase * TAU) * 1.2;
  const rate = R.st.eyes ? 4.5 : 7;
  const beat = Math.sin(R.t * rate + (near ? 0 : 0.6));
  const hingeX = R.ox + (near ? 27 : 30);
  const hingeY = R.oy + 27 + bob;
  // (Forewing up over her, hindwing down under; held open wide when she
  // fixes you with the eyes.)
  const sFore = eyes ? 1 : 0.25 + 0.75 * (beat * 0.5 + 0.5);
  const sHind = eyes ? 1 : 0.3 + 0.7 * (Math.sin(R.t * rate + (near ? 0.5 : 1.1)) * 0.5 + 0.5);
  hind.flapY(R.ctx, hingeX + 2, hingeY + 2, near ? 0.15 : 0.3, sHind, near ? 1 : 0.8);
  fore.flapY(R.ctx, hingeX, hingeY, near ? -0.1 : 0.05, sFore, near ? 1 : 0.8);
}

// The Bloat's feelers: soft strands hanging from under it, swaying and
// trailing as it drifts (each a little hanging chain, held at the top).
function bloatFeelers(R) {
  const s = R.e.rig;
  s.feel ||= [0, 1, 2, 3].map(() => ({ x: [], y: [], px: [], py: [] }));
  const n = 7;
  const dt = Math.min(R.dt || 1 / 60, 1 / 30);
  s.feel.forEach((f, k) => {
    const ax = R.ox + 22 + k * 5.5;
    const ay = R.oy + 44 - Math.abs(k - 1.5) * 1.5;
    if (!f.x.length) for (let i = 0; i <= n; i++) {
      f.x.push(ax);
      f.y.push(ay + i * 2.6);
      f.px.push(ax);
      f.py.push(ay + i * 2.6);
    }
    for (let i = 1; i <= n; i++) {
      const vx = (f.x[i] - f.px[i]) * 0.94;
      const vy = (f.y[i] - f.py[i]) * 0.94;
      f.px[i] = f.x[i];
      f.py[i] = f.y[i];
      f.x[i] += vx + Math.sin(R.t * 1.6 + k + i * 0.5) * 0.04;
      f.y[i] += vy + 30 * dt * dt;
    }
    for (let it = 0; it < 6; it++) {
      f.x[0] = ax;
      f.y[0] = ay;
      for (let i = 0; i < n; i++) {
        const dx = f.x[i + 1] - f.x[i];
        const dy = f.y[i + 1] - f.y[i];
        const d = Math.hypot(dx, dy) || 1e-6;
        const c = (d - 2.6) / d;
        if (i > 0) {
          f.x[i] += dx * c * 0.5;
          f.y[i] += dy * c * 0.5;
        }
        f.x[i + 1] -= dx * c * (i > 0 ? 0.5 : 1);
        f.y[i + 1] -= dy * c * (i > 0 ? 0.5 : 1);
      }
    }
    drawStrand(R.ctx, f.x.map((x, i) => ({ x, y: f.y[i] })), '#6a7a40', 2, 1);
  });
}

// The Kraken's arms: eight, curling and uncurling each in its own time,
// out from under its mantle (those behind first), suckers along them.
// Ash packed into a limb: grey, flecked, embers glowing in it and dying.
const ASH = hex('#7a7270');
function ashSkin(t) {
  return (k, u, v) => {
    const h = hash2(Math.floor(u), Math.floor((v + 1) * 2), 11);
    if (h > 0.93) return Math.sin(t * 4 + u) > 0 ? [255, 138, 48] : [200, 74, 26];
    return h < 0.3 ? shade(ASH, 0.8) : h > 0.75 ? shade(ASH, 1.15) : ASH;
  };
}
// Each arm one smooth length of muscle (see bossrig.bodyOf), thick at the
// root and tapering to a curling tip, red above and pale under, a row of
// suckers down the underside.
const ARM = hex('#a03a30');
const ARM_UNDER = hex('#e8a090');
const SUCKER = hex('#f8e0d0');
function armSkin(back) {
  const top = back ? shade(ARM, 0.8) : ARM;
  const under = back ? shade(ARM_UNDER, 0.8) : ARM_UNDER;
  return (k, u, v, ny) => {
    if (ny > 0.3) {
      // (Suckers: pale rings, one every few pixels, a dark pit in each.)
      const m = u % 3.5;
      if (ny > 0.55 && m < 2) return m > 0.6 && m < 1.4 && ny > 0.75 ? shade(SUCKER, 0.55) : SUCKER;
      return under;
    }
    return hash2(Math.floor(u / 2), Math.floor(v * 3), 5) > 0.85 ? shade(top, 0.8) : top;
  };
}
const ARM_SKIN = [armSkin(false), armSkin(true)];
function krakenArms(R, front) {
  const s = R.e.rig;
  s.armCv ||= [];
  for (let i = 0; i < 8; i++) {
    const isFront = i % 2 === 0;
    if (isFront !== front) continue;
    const bx = R.ox + 30 + (i - 3.5) * 4.5;
    const by = R.oy + 46;
    const a0 = Math.PI * (0.35 + (i / 7) * 0.3) + (i < 4 ? 0.4 : -0.4);
    const amp = R.st.wind ? 0.55 : 0.32;
    const pts = curl(bx, by, a0 + (i < 4 ? 0.6 : -0.6), 12, 2.4, R.t, i * 1.3, amp, R.st.wind ? 4 : 2);
    const b = bodyOf(pts, { rad: (k) => 0.8 + 2.6 * (1 - k), skin: ARM_SKIN[isFront ? 0 : 1], gloss: 0.4 }, (s.armCv[i] ||= {}));
    drawBody(R.ctx, b.back);
  }
}

// The shoal round the Coral Colossus: little fish wheeling, catching the
// light as they turn (those behind first).
function shoal(R, front) {
  const fish = part('fish', 7, 5, 3.5, 2.5, (X) => {
    X.ball(3, 2.5, 2.6, 1.5, '#f0c050', 'scales', { rz: 1.4, scale: 1.4 });
    X.slab([[5, 2.5], [7, 0.5], [7, 4.5]], '#f0a040', 'scales', { rz: 0.6, bevel: 0.5 });
  });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + R.t * (0.8 + (i % 3) * 0.15);
    const s = Math.sin(a);
    if ((s > 0) !== front) continue;
    const x = R.ox + 37 + Math.cos(a) * (24 + (i % 3) * 3);
    const y = R.oy + 34 + s * 9 + Math.sin(R.t * 3 + i) * 2;
    fish.draw(R.ctx, x, y, Math.atan2(Math.cos(a) * 9, -Math.sin(a) * 26) + Math.PI);
  }
}

Object.assign(BEASTS, {
  // ------------------------------------------------------------ Thessa's grove
  // A stag as tall as a house, grey with age: shaggy, its antlers like a
  // dead tree, hung with moss that sways and trails (the rig); eyes green;
  // head down to charge.
  elder_stag: {
    w: 72, h: 70, ax: 36, ay: 68,
    sculpt(X, t, st) {
      const fur = '#7a7468';
      const down = st.wind ? 1 : 0;
      const b = sn(t) * 0.6;
      X.in(0, 2);
      X.limb([[48, 44, 3.6, -2], [51, 55, 2.6, -2], [50, 66, 2, -2]], dark(fur, 0.8), 'fur');
      X.limb([[25, 44, 3.4, -2], [22, 55, 2.6, -2], [24, 66, 2, -2]], dark(fur, 0.8), 'fur');
      X.in(1, 3.5);
      X.ball(38, 38 - b, 16, 10, fur, 'fur', { rz: 10, along: 'x' });
      X.ball(52, 36 - b, 5, 4, fur, 'fur', { rz: 4, z: 1 });
      X.limb([[27, 34 - b, 7, 4], [21, 28 + down * 6, 5.4, 6], [17, 25 + down * 10, 4.6, 7]], fur, 'fur');
      X.ball(13, 26 + down * 10, 6, 4.2, fur, 'fur', { rz: 4.4, z: 7 });
      X.ball(7, 28 + down * 10, 3.6, 2.6, dark(fur, 0.85), 'leather', { rz: 2.6, z: 8 });
      X.ball(22, 37 + down * 3, 5, 6, '#9a9488', 'fur', { rz: 4, z: 6 });
      X.in(2, 2);
      X.limb([[46, 46, 4, 6], [49, 56, 3, 7], [48, 66, 2.2, 7]], fur, 'fur');
      X.limb([[28, 46, 3.8, 6], [25, 56, 3, 7], [26, 66, 2.2, 7]], fur, 'fur');
      for (const x of [47, 25]) X.ball(x, 67, 2.6, 1.4, '#2a2420', 'bone', { z: 8, rz: 1.2 });
      // Antlers: two great branching crowns, gnarled as dead wood.
      X.in(3, 1.2);
      for (const s of [-1, 1]) {
        const rx = 15 + s * 2;
        const ry = 21 + down * 10;
        X.limb([[rx, ry, 1.6, 9], [rx + s * 3, ry - 8, 1.3, 9], [rx + s * 2, ry - 17, 1, 9], [rx + s * 5, ry - 24, 0.6, 9]], '#c8b898', 'bark');
        X.limb([[rx + s * 3, ry - 8, 1, 9], [rx + s * 10, ry - 12, 0.7, 9], [rx + s * 14, ry - 18, 0.4, 9]], '#c8b898', 'bark');
        X.limb([[rx + s * 2, ry - 17, 0.8, 9], [rx - s * 4, ry - 22, 0.5, 9]], '#c8b898', 'bark');
      }
    },
    paint(P, t, st) {
      const down = st.wind ? 1 : 0;
      P.eye(11, 25 + down * 10, '#80ff80', true);
    },
    fx(P, t, st) {
      if (st.wind) for (let i = 0; i < 3; i++) {
        const k = (t * 2 + i / 3) % 1;
        P.puff(5 - k * 4, 40 - k * 2, 1 + k * 2, '#e0e8e0', 0.6 * (1 - k));
      }
    },
    rig: {
      front(R) {
        // Moss hanging from the antlers, swaying and trailing.
        const down = R.st.wind ? 10 : 0;
        for (const [x, y, len, k] of [[18, 13, 9, 0], [25, 9, 7, 1], [10, 11, 8, 2], [14, 5, 6, 3], [28, 4, 5, 4]]) {
          const pts = [];
          for (let i = 0; i <= 5; i++) {
            const f = i / 5;
            pts.push({ x: R.ox + x + Math.sin(R.t * 1.8 + k + f * 2) * f * 1.6 - R.drift * 4 * f, y: R.oy + y + down + f * len });
          }
          drawStrand(R.ctx, pts, k % 2 ? '#6a8a4a' : '#4a6a3a', 2, 1);
        }
      },
    },
  },

  // An oak that walks, hollowed by age: a face in its trunk, branches for
  // arms, roots for feet, its leaves as the season it's in (spring
  // blossom, summer green, autumn fire, winter bare and snowed on).
  hollow_oak: {
    w: 78, h: 80, ax: 39, ay: 78,
    sculpt(X, t, st) {
      const bark = '#5a4a3a';
      const season = st.season ?? 1;
      const b = sn(t) * 0.7;
      X.in(0, 3);
      for (const [x, s] of [[30, -1], [48, 1], [39, 0]]) X.limb([[x, 66, 4, 0], [x + s * 6, 74, 3, 0], [x + s * 10, 78, 1.6, 0]], bark, 'bark');
      X.ball(39, 52, 13, 18, bark, 'bark', { rz: 11 });
      X.ball(39, 36 - b, 12, 10, bark, 'bark', { rz: 10, z: 1 });
      X.in(1, 2);
      for (const s of [-1, 1]) X.limb([[39 + s * 10, 38 - b, 4, 6], [39 + s * 20, 30 - b + sn(t, 1, s) * 1.5, 3, 6], [39 + s * 28, 22 - b + sn(t, 1, s) * 2.5, 1.8, 6], [39 + s * 32, 14 - b + sn(t, 1, s) * 3, 1, 6]], bark, 'bark');
      if (season !== 3) {
        X.in(2, 4);
        const leaf = season === 0 ? '#c8e090' : season === 2 ? '#c86a2a' : '#4a7a3a';
        for (const [x, y, r] of [[39, 16, 14], [26, 20, 10], [52, 20, 10], [14, 14, 6], [64, 14, 6], [39, 26, 9]]) X.ball(x, y - b, r, r * 0.75, leaf, 'moss', { rz: r * 0.7, z: 4 });
      }
    },
    paint(P, t, st) {
      const b = sn(t) * 0.7;
      // The hollow face: two eye-holes and a mouth, a glow deep in them.
      for (const x of [34, 43]) P.blob(x, 44 - b, 2.4, 3, '#140c08', { amb: 0 });
      P.blob(39, 52 - b, 3.6, 4.4, '#140c08', { amb: 0 });
      for (const x of [34, 43]) P.set(x, 44 - b, hex(st.wind ? '#ffe080' : '#a0e070'));
      const season = st.season ?? 1;
      if (season === 0) for (let i = 0; i < 12; i++) P.set(18 + hash2(i, 1, 3) * 44, 8 + hash2(i, 2, 3) * 22, hex('#fff0f4'));
      if (season === 3) tint(P, (x, y) => y < 40 && hash2(x, y, 4) < 0.25, '#f0f4ff', 0.7);
    },
    fx(P, t, st) {
      const season = st.season ?? 1;
      const col = season === 0 ? '#ffe0ec' : season === 2 ? '#e08030' : season === 3 ? '#ffffff' : '#6aa04a';
      for (let i = 0; i < 6; i++) {
        const k = (t + i / 6) % 1;
        P.fx(14 + i * 9 + sn(k, 1, i) * 4, 18 + k * 56, col, 0.9 * (1 - k * 0.6));
      }
    },
  },

  // The Worm: up out of the floor, banded and bristled, swaying (its body a
  // column of segments, each set on the curve: the rig), its maw a ring of
  // teeth opening at the top of it as it rears. The painting is only the
  // hole it's come up through.
  worm: {
    w: 48, h: 20, ax: 24, ay: 16,
    sculpt(X, t, st) {
      // (The floor heaves round the hole as it rears.)
      const heave = st.wind ? 2 : Math.max(0, sn(t)) * 0.8;
      X.in(0, 2);
      X.ball(24, 14 - heave * 0.5, 20 + heave, 5 + heave * 0.5, '#5a4a3a', 'rock', { rz: 3 + heave, cell: 3 });
      for (let i = 0; i < 5; i++) X.ball(8 + i * 8, 11 - heave - (i % 2), 2.6, 2, '#6a5a48', 'rock', { z: 3 + heave, rz: 2, cell: 2 });
      X.in(1, 1);
      X.ball(24, 13.5, 13, 3, '#140e0a', 'ink', { z: 5 + heave, rz: 0.4 });
    },
    fx(P, t) {
      // Earth crumbling back down into the hole.
      for (let i = 0; i < 5; i++) {
        const k = (t * 2 + i / 5) % 1;
        P.fx(14 + i * 5, 10 + k * 5, '#8a7a60', 1 - k);
      }
    },
    rig: {
      front(R) {
        wormColumn(R);
      },
    },
  },

  // The Prime: a Kavorent engine of war, plates of violet stone over a
  // core of orange fire, light running in its seams; its shoulder-stones
  // hang off it, floating (the rig).
  prime: {
    w: 66, h: 64, ax: 33, ay: 62,
    sculpt(X, t, st) {
      const stone = '#3e3050';
      const wind = st.wind;
      X.in(0, 1.5);
      X.slab([[48, 24], [56, 26], [57, 46], [50, 46]], dark(stone, 0.8), 'rock', { rz: 5, bevel: 2, cell: 7 });
      for (const x of [24, 42]) {
        X.slab([[x - 5, 44], [x + 5, 44], [x + 4, 58], [x - 4, 58]], stone, 'rock', { rz: 5, bevel: 2, cell: 7 });
        X.slab([[x - 6, 57], [x + 6, 57], [x + 6, 61.5], [x - 6, 61.5]], dark(stone, 0.8), 'rock', { rz: 4, bevel: 1.5, cell: 7 });
      }
      X.in(1, 1.5);
      X.slab([[16, 20], [50, 20], [44, 44], [22, 44]], stone, 'rock', { rz: 9, bevel: 4, cell: 8 });
      X.slab([[27, 8], [39, 8], [40, 19.5], [26, 19.5]], stone, 'rock', { rz: 7, bevel: 2.5, cell: 8, z: 2 });
      X.in(2, 1.5);
      const fy = wind ? 6 : 48;
      X.slab([[10, 26], [17, 26], [16, wind ? 16 : 46], [9, wind ? 16 : 46]], stone, 'rock', { rz: 5, bevel: 2, z: 8, cell: 7 });
      X.slab([[6, fy - 4], [18, fy - 4], [18, fy + 5], [6, fy + 5]], toHex(shade(hex(stone), 1.1)), 'rock', { rz: 6, bevel: 2, z: 10, cell: 7 });
    },
    paint(P, t, st) {
      const pulse = 0.5 + 0.5 * sn(t, 1);
      const seam = toHex(mix(hex('#3a9ab0'), hex('#c8fbff'), pulse));
      for (const [a, b] of [[[20, 22], [33, 34]], [[46, 22], [33, 34]], [[33, 34], [33, 43]], [[27, 10], [39, 10]], [[22, 44], [44, 44]]]) P.line(a[0], a[1], b[0], b[1], seam);
      P.blob(33, 29, 4 + pulse, 4 + pulse, st.wind ? '#ffd090' : '#ff9050', { lift: 0.3 + pulse * 0.3 });
      P.rect(28, 13, 10, 2, '#140e1e');
      P.rect(29, 13, 8, 1, st.wind ? '#ffffff' : '#ff9050');
      const fy = st.wind ? 6 : 48;
      P.line(7, fy, 17, fy, seam);
    },
    fx(P, t) {
      P.puff(33, 29, 8, '#ff9050', 0.18 + 0.1 * sn(t));
      for (let i = 0; i < 3; i++) {
        const k = (t + i / 3) % 1;
        P.fx(16 + i * 16, 56 - k * 40, '#5ad8f0', 0.8 * (1 - k));
      }
    },
    rig: {
      front(R) {
        const stn = part('prime_stone', 16, 12, 8, 6, (X) => X.slab([[1, 2], [14, 1], [15, 9], [2, 10.5]], '#4e4060', 'rock', { rz: 5, bevel: 2, cell: 7 }));
        for (const [x, ph] of [[12, 0], [54, 2]]) {
          const y = 18 + Math.sin(R.t * 2.2 + ph) * 2;
          stn.draw(R.ctx, R.ox + x, R.oy + y, Math.sin(R.t * 0.9 + ph) * 0.12);
          R.ctx.fillStyle = '#5ad8f0';
          R.ctx.globalAlpha = 0.6 + 0.3 * Math.sin(R.t * 3 + ph);
          R.ctx.fillRect(Math.round(R.ox + x - 5), Math.round(R.oy + y), 10, 1);
          R.ctx.globalAlpha = 1;
        }
      },
    },
  },
});

// The masters of the far islands' spires (see entities/bosses_spire.js),
// the Kavorent's make: alloy plate, seams of cold light.
const ALLOY = '#2e2c46';
const ALLOY_LO = '#1e1c30';
Object.assign(BEASTS, {
  // The Crucible: a squat engine of alloy on four piston legs, a great
  // crucible in its middle open at the top on molten metal, its heat
  // showing (the plate going red, then white at the seams), two piston
  // arms; spent, its core open and frosted with coolant.
  crucible: {
    w: 70, h: 72, ax: 35, ay: 70,
    sculpt(X, t, st) {
      const heat = st.heat || 0;
      const plate = heat >= 2 ? '#5a3040' : heat >= 1 ? '#40304a' : ALLOY;
      const pump = Math.max(0, sn(t, 2)) * 2.5;
      X.in(0, 2);
      // Its legs: pistons, splayed, on broad feet.
      for (const [x, d] of [[16, -1], [28, -0.5], [42, 0.5], [54, 1]]) {
        X.limb([[x, 48, 3.6, 0], [x + d * 3, 58, 3, 0], [x + d * 4, 65, 3.4, 0]], ALLOY_LO, 'metal');
        X.ball(x + d * 4, 68, 5.2, 2.2, ALLOY, 'metal', { rz: 2 });
      }
      X.in(1, 3);
      // The housing, plated, broad at its foot.
      X.slab([[10, 30], [60, 30], [64, 52], [6, 52]], plate, 'metal', { rz: 12, bevel: 4 });
      // The crucible itself: a great drum, its lip rolled over.
      X.ball(35, 30, 18, 15, plate, 'metal', { rz: 14, z: 2 });
      X.ball(35, 17, 15, 5, ALLOY, 'metal', { rz: 5, z: 5 });
      X.ball(35, 17, 11.5, 3.4, heat >= 1 ? '#ff8a20' : '#ff6a10', 'molten', { rz: 1, z: 8, glow: '#ffd060', glowK: 0.6 });
      X.in(2, 1.5);
      // Its arms: pistons out either side, hammers on their ends.
      for (const side of [-1, 1]) {
        const x0 = 35 + side * 22;
        X.tube(x0, 30, x0 + side * 8, 40 - pump * side * 0.6, 3.2, 2.6, ALLOY_LO, 'metal', { z: 8 });
        X.slab([[x0 + side * 5, 38 - pump], [x0 + side * 13, 38 - pump], [x0 + side * 13, 48 - pump], [x0 + side * 5, 48 - pump]], ALLOY, 'metal', { rz: 6, bevel: 2, z: 10 });
      }
      // Stacks at its back, venting.
      for (const x of [22, 48]) X.tube(x, 20, x, 6, 2.6, 2.2, ALLOY_LO, 'metal', { z: -2 });
    },
    paint(P, t, st) {
      const heat = st.heat || 0;
      const pulse = 0.5 + 0.5 * sn(t, 1);
      const seam = st.vent ? '#e0f8ff' : heat >= 2 ? '#fff0a0' : heat >= 1 ? '#ffb040' : toHex(mix(hex('#3a9ab0'), hex('#c8fbff'), pulse));
      // Its seams: round the drum, down the housing.
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.15 + i * 0.0875);
        P.set(35 + Math.cos(a) * 17, 30 + Math.sin(a) * 14, hex(seam));
      }
      for (const x of [18, 28, 42, 52]) P.line(x, 34, x - (x < 35 ? 2 : -2), 50, seam);
      P.line(12, 51, 58, 51, seam);
      // The grate in its belly: molten behind the bars (frost, spent).
      for (let y = 38; y <= 46; y++) for (let x = 29; x <= 41; x++) {
        const bar = (x - 29) % 3 === 0 || y === 38 || y === 46;
        const hot = st.vent ? '#a8e4f8' : heat >= 2 ? '#fff0a0' : sn(t, 3, x * 0.7 + y) > 0.2 ? '#ffb040' : '#ff5a10';
        P.set(x, y, hex(bar ? '#1a1828' : hot));
      }
      if (heat >= 1 && !st.vent) tint(P, (x, y) => hash2(x, y, 7) < 0.06 * heat, '#ff5020', 0.5);
      if (st.vent) tint(P, (x, y) => hash2(x, y, 5) < 0.12, '#e0f8ff', 0.6);
    },
    fx(P, t, st) {
      const heat = st.heat || 0;
      P.puff(35, 15, 9, st.vent ? '#a0e8ff' : '#ff8030', 0.15 + heat * 0.08);
      for (const x of [22, 48]) for (let i = 0; i < 3; i++) {
        const k = (t * 2 + i / 3 + x * 0.01) % 1;
        P.puff(x + sn(k, 1, x) * 2, 5 - k * 5, 1.5 + k * 3, st.vent ? '#c8e8f0' : heat >= 1 ? '#ff9040' : '#6a6466', 0.5 * (1 - k));
      }
      if (heat >= 2) for (let i = 0; i < 5; i++) {
        const k = (t * 3 + i / 5) % 1;
        P.fx(14 + i * 10, 52 - k * 30, '#ffd060', 0.8 * (1 - k));
      }
    },
  },

  // The Condenser: a hovering coil of alloy, three vanes standing out from
  // it like a lantern's ribs, a storm cloud churning in its crown; rain
  // falls off it always, and lightning runs between its vanes.
  condenser: {
    w: 64, h: 76, ax: 32, ay: 74,
    sculpt(X, t, st) {
      const turn = t * TAU;
      X.in(0, 2);
      // Its cloud crown, behind and over it.
      for (let i = 0; i < 6; i++) {
        const a = turn * 0.5 + (i / 6) * TAU;
        X.ball(32 + Math.cos(a) * 12, 14 + Math.sin(a) * 3, 9, 6.5, '#4a5468', 'ash', { rz: 6, z: Math.sin(a) * 3 });
      }
      X.in(1, 2.5);
      // The coil: a column ringed in alloy bands, tapering to a point below.
      X.tube(32, 18, 32, 58, 8, 3, ALLOY, 'metal', { z: 2 });
      for (let y = 22; y <= 50; y += 6) X.ball(32, y, 9.5 - (y - 22) * 0.12, 2.4, ALLOY_LO, 'metal', { rz: 2, z: 4 });
      X.ball(32, 62, 2.6, 4, ALLOY_LO, 'metal', { rz: 2, z: 4 });
      X.in(2, 1.5);
      // Its vanes: three, curved out from the coil and back.
      for (let i = 0; i < 3; i++) {
        const a = turn * 0.25 + (i / 3) * TAU;
        const sx = Math.cos(a);
        const front = Math.sin(a);
        const x = 32 + sx * 15;
        X.slab([[32 + sx * 6, 24], [x, 28], [x + sx * 2, 42], [32 + sx * 6, 50]], front > -0.2 ? '#3a3a5a' : ALLOY_LO, 'metal', { rz: 3, bevel: 1.5, z: front * 8 });
      }
      // A lens in its middle, looking out.
      X.ball(32, 34, 4.4, 4.4, '#1a2a3a', 'glass', { rz: 3, z: 10 });
    },
    paint(P, t, st) {
      const pulse = 0.5 + 0.5 * sn(t, 2);
      const seam = toHex(mix(hex('#5a8ac0'), hex('#e0f4ff'), pulse));
      for (let y = 22; y <= 50; y += 6) P.line(32 - (9 - (y - 22) * 0.12), y, 32 + (9 - (y - 22) * 0.12), y, seam);
      P.blob(32, 34, 2.4 + pulse * 0.6, 2.4 + pulse * 0.6, st.wind ? '#fff8a0' : '#8ad0ff', { lift: 0.5 });
      P.glint(31, 33, '#ffffff');
    },
    fx(P, t, st) {
      // Rain off it, always; lightning between its vanes now and then.
      for (let i = 0; i < 10; i++) {
        const k = (t * 3 + i / 10) % 1;
        const x = 18 + ((i * 37) % 28);
        P.fx(x, 20 + k * 52, '#8ab8e0', 0.7 * (1 - k));
        P.fx(x, 21 + k * 52, '#c8e0ff', 0.5 * (1 - k));
      }
      if (st.wind || sn(t, 3) > 0.7) {
        let x = 18;
        let y = 30;
        for (let s = 0; s < 8; s++) {
          const nx = x + 3.6;
          const ny = 30 + (hash2(s, Math.floor(t * 24), 3) - 0.5) * 8;
          P.line(x, y, nx, ny, '#fff8a0');
          x = nx;
          y = ny;
        }
      }
      P.puff(32, 14, 14, '#2a3448', 0.18);
    },
  },
});

// The Worm's body: one length of it, ringed like an earthworm's, up out
// of its hole on a swaying curve (see bossrig.bodyOf), bristles along the
// rings; the maw on top turned the way the curve runs; rearing higher as
// it strikes.
const WORM = hex('#b08a60');
function wormSkin(k, u, v, ny) {
  // (Its rings: a groove every four pixels, the flesh swelling between.)
  const m = u % 4;
  const c = ny > 0.5 ? mix(WORM, [220, 190, 150], 0.35) : WORM;
  return m < 0.8 ? shade(c, 0.6) : m < 1.6 ? shade(c, 1.1) : c;
}
function wormColumn(R) {
  const head = part('wormhead', 22, 20, 11, 15, (X) => {
    X.ball(11, 12, 9, 7.5, '#a07a50', 'flesh', { rz: 7 });
    X.ball(11, 6, 7, 3, '#5a1a14', 'flesh', { z: 6, rz: 1 });
  });
  const rear = R.st.wind ? 1.35 : 1;
  const n = 9;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    pts.push({ x: R.ox + 24 + Math.sin(R.t * 1.6 - f * 2.4) * 6 * f, y: R.oy + 14 - f * 52 * rear });
  }
  const body = bodyOf([...pts].reverse(), { rad: (k) => 6.4 + 1.4 * k, skin: wormSkin, gloss: 0.35 }, (R.e.rig.wormCv ||= {}));
  drawBody(R.ctx, body.back);
  // (Bristles on its rings, catching the light.)
  R.ctx.fillStyle = '#3a2a1a';
  for (let i = 1; i < n - 1; i++) {
    const a = pts[i];
    for (const side of [-1, 1]) R.ctx.fillRect(Math.round(a.x + side * (7 + (i % 2))), Math.round(a.y), 1 + (i % 2), 1);
  }
  const top = pts[n];
  const prev = pts[n - 1];
  head.draw(R.ctx, top.x, top.y, Math.atan2(top.y - prev.y, top.x - prev.x) + Math.PI / 2);
  // Its teeth, a ring round the maw.
  const ctx = R.ctx;
  ctx.fillStyle = '#f0e8d0';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + R.t * 0.5;
    ctx.fillRect(Math.round(top.x + Math.cos(a) * 5), Math.round(top.y - 9 + Math.sin(a) * 2), 1, 2);
  }
}

// ------------------------------------------------------------ painting
export function beastOf(species) {
  return BEASTS[species] || null;
}
export const BEAST_SPECIES = Object.keys(BEASTS);
// (Round 68: more of them, the far lands': see farbosses.js.)
export function addBeasts(more) {
  Object.assign(BEASTS, more);
  for (const k of Object.keys(more)) if (!BEAST_SPECIES.includes(k)) BEAST_SPECIES.push(k);
}
export { part as beastPart, serpent as beastSerpent, curl as beastCurl };
export function paintBeast(species, t, st) {
  const B = BEASTS[species];
  const X = new Sculpt(B.w, B.h, { seed: species.length * 13, t });
  B.sculpt(X, t, st);
  const px = X.render();
  const P = new Paint(B.w, B.h);
  P.p = px;
  if (B.paint) B.paint(P, t, st);
  if (B.fx) B.fx(P, t, st);
  return P.p;
}
