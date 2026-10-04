// The masters that walk as people do, painted large (see bossbody.js):
// forty-four pixels across and fifty-eight high, half again a person's
// height and then some, a full figure lit as a painter would light it
// (see paint.js), facing you three-quarters on, in eight frames of breath
// and a pose for a blow coming. Each has its own dress and arms, and
// something of its own that moves: a cloak's hem, a crown of fire,
// smoke, a swinging lantern, moss, glass, the sea.
import { Paint, ramp, hash2 } from './paint.js';
import { hex, mix, shade } from './pixel.js';

export const FIG_W = 44;
export const FIG_H = 58;
export const FIG_AX = 22;
export const FIG_AY = 55;

const TAU = Math.PI * 2;
const STEEL = '#9aa0b0';
const IRON = '#6a6a74';
const WOOD = '#7a5232';
const GOLD = '#d8b040';

// ------------------------------------------------------------ the figure
// `S`: what it wears and carries; `t`: where it is in its breath (0..1);
// `st`: its state ({ wind } while a blow's coming, and its own).
function figure(P, S, t, st) {
  const wind = !!st.wind;
  const b = Math.round(Math.sin(t * TAU) * 0.8 + 0.2); // (breath: the body rises and falls a pixel)
  const sway = Math.sin(t * TAU);
  const J = {
    t, st, b, sway, wind,
    head: { x: 21.5, y: 16 + b },
    neck: { x: 22, y: 23 + b },
    shL: { x: 14.5, y: 26 + b },
    shR: { x: 29.5, y: 26 + b },
    hip: { x: 22, y: 37 },
    feetY: FIG_AY,
  };
  // Arms: idle, hanging (a little swing); winding up, the weapon arm
  // raised back over the shoulder, the other thrown forward.
  J.elL = wind ? { x: 10, y: 29 + b } : { x: 12, y: 32 + b + Math.round(sway * 0.5) };
  J.hdL = wind ? { x: 7, y: 32 + b } : { x: 12, y: 38 + b + Math.round(sway * 0.5) };
  J.elR = wind ? { x: 34, y: 21 + b } : { x: 32, y: 32 + b - Math.round(sway * 0.5) };
  J.hdR = wind ? { x: 32, y: 14 + b } : { x: 32, y: 38 + b - Math.round(sway * 0.5) };
  if (S.arms === 'both') {
    // (Two hands on one weapon, held across.)
    J.hdL = wind ? { x: 26, y: 18 + b } : { x: 18, y: 35 + b };
    J.elL = wind ? { x: 19, y: 23 + b } : { x: 13, y: 31 + b };
    J.hdR = wind ? { x: 30, y: 16 + b } : { x: 26, y: 35 + b };
  }
  if (S.pose) S.pose(J);
  // Behind everything: the cloak, what's slung on the back, long hair.
  if (S.cape) cape(P, S, J);
  if (S.behind) S.behind(P, J);
  if (S.hair && (S.hairStyle === 'long' || S.hairStyle === 'wild')) {
    const n = S.hairStyle === 'wild' ? 1.5 : 0;
    P.poly([[J.head.x - 6 - n, J.head.y - 2], [J.head.x + 6 + n, J.head.y - 2], [J.head.x + 7 + n + sway * 0.6, J.head.y + 14], [J.head.x - 7 - n + sway * 0.6, J.head.y + 14]], S.hair, { lv: 0.35 });
  }
  if (S.weaponBehind) weapon(P, S, J);
  // Legs (or the robe's skirts).
  if (S.robe) robe(P, S, J);
  else legs(P, S, J);
  // The body.
  torso(P, S, J);
  // Arms: the far one, then the near.
  arm(P, S, J, J.shL, J.elL, J.hdL);
  if (S.shield) shieldOn(P, S, J);
  // The head.
  head(P, S, J);
  arm(P, S, J, J.shR, J.elR, J.hdR);
  if (!S.weaponBehind) weapon(P, S, J);
  if (S.front) S.front(P, J);
  return J;
}

function cape(P, S, J) {
  const w = J.sway * 1.5;
  const flare = J.wind ? 3 : 0;
  const hem = J.feetY - (S.capeShort ? 10 : 2);
  P.poly([[J.shL.x - 1, J.shL.y - 1], [J.shR.x + 1, J.shR.y - 1], [J.shR.x + 5 + flare + w, hem], [J.shL.x - 4 + w * 0.6, hem + 1]], S.cape, { lv: 0.4, contrast: 0.6 });
  // Its folds, and a ragged hem if it's old.
  for (const fx of [0.3, 0.62]) {
    const x0 = J.shL.x + (J.shR.x - J.shL.x) * fx;
    P.line(x0, J.shL.y + 3, x0 + w * 0.8 + (fx - 0.45) * 6, hem - 1, shade(hex(S.cape), 0.55));
  }
  if (S.capeRagged) for (let x = Math.round(J.shL.x - 3); x < J.shR.x + 5; x += 3) P.p.clear(x + (Math.round(w) & 1), hem + 1);
}

function legs(P, S, J) {
  const pc = S.legs || '#3a3a44';
  const step = J.wind ? 2 : 0;
  for (const [hx, kx, ax] of [[19, 18 - step, 17 - step], [25, 26 + step, 27 + step]]) {
    P.tube(hx, J.hip.y, kx, 46, 3, 2.6, pc);
    P.tube(kx, 46, ax, 52, 2.6, 2.1, pc);
    P.blob(ax - 0.5, J.feetY - 1, 3.2, 1.9, S.boots || '#2a2228');
    if (S.greaves) P.blob(kx, 46, 2.4, 2, S.greaves);
  }
}

function robe(P, S, J) {
  const c = S.robe;
  const w = J.sway * 1.2;
  const hem = J.feetY;
  const top = J.hip.y - 3;
  P.poly([[16, top], [28, top], [33 + w, hem], [11 + w, hem]], c, { lv: 0.5, contrast: 0.8 });
  // Folds falling from the waist, swinging at the hem.
  for (const [x0, x1, k] of [[19, 15, 0.6], [22, 22, 0.75], [25, 29, 0.6]]) P.line(x0, top + 2, x1 + w, hem - 1, shade(hex(c), k));
  P.line(17, top + 3, 13 + w, hem - 2, mix(hex(c), [255, 240, 200], 0.15));
  if (S.trim) {
    P.line(11 + w, hem, 33 + w, hem, S.trim);
    P.line(11 + w, hem - 1, 33 + w, hem - 1, shade(hex(S.trim), 0.75));
  }
  if (S.robeRagged) for (let x = 12; x < 33; x += 3) P.p.clear(Math.round(x + w), hem);
}

function torso(P, S, J) {
  const c = S.body || '#5a4a6a';
  const { shL, shR, hip } = J;
  // The neck (under the body's collar), in the chin's shadow.
  P.tube(J.neck.x, J.neck.y - 2, J.neck.x, J.neck.y + 2, 2, 2.2, S.neckCol || S.skin, { lift: -0.15 });
  // (Lit as a body is, rounder at the chest: lighter to the left, a
  // shadow down its right side.)
  P.poly([[shL.x - 1, shL.y], [shR.x + 1, shR.y], [hip.x + 6, hip.y], [hip.x - 6, hip.y]], c, { lv: 0.5, grad: [-1, -0.35], contrast: 0.8 });
  P.blob(22, 30 + J.b, 7.5, 6.5, c, { flat: 0.35, amb: 0.3, clip: (x, y) => y >= shL.y });
  if (S.plate) {
    // A breastplate: its ridge, its shine; pauldrons, a fauld.
    const pc = S.plate;
    P.blob(22, 30 + J.b, 7, 6, pc, { flat: 0.7 });
    P.line(22, 25 + J.b, 22, 35 + J.b, shade(hex(pc), 1.25));
    P.glint(19, 27 + J.b);
    for (const s of [shL, shR]) P.blob(s.x, s.y + 0.5, 4, 3.2, pc);
    P.glint(shL.x - 1, shL.y - 1);
    P.poly([[hip.x - 7, hip.y - 2], [hip.x + 7, hip.y - 2], [hip.x + 8, hip.y + 3], [hip.x - 8, hip.y + 3]], shade(hex(pc), 0.85), { lv: 0.5 });
    for (let x = hip.x - 6; x <= hip.x + 6; x += 4) P.line(x, hip.y - 1, x, hip.y + 2, shade(hex(pc), 0.55));
  } else if (S.mail) {
    P.over((x, y, col) => (y > shL.y && y < hip.y && x > shL.x - 1 && x < shR.x + 1 && (x + y) % 2 === 0 ? shade(col, 0.82) : null));
  }
  if (S.belt) P.rect(hip.x - 7, hip.y - 2, 14, 2, S.belt);
  if (S.buckle) P.rect(hip.x - 1, hip.y - 2, 2, 2, S.buckle);
  if (S.sash) for (let i = 0; i < 12; i++) P.rect(shL.x + 1 + i, shL.y + 1 + i, 2, 1, S.sash);
  if (S.chest) S.chest(P, J);
}

function arm(P, S, J, sh, el, hd) {
  const sleeve = S.sleeve || S.body || '#5a4a6a';
  P.tube(sh.x, sh.y, el.x, el.y, 2.6, 2.3, sleeve);
  P.tube(el.x, el.y, hd.x, hd.y, 2.3, 1.9, S.forearm || sleeve);
  if (S.robe && !S.plate && !S.slimSleeves) P.blob(el.x + (hd.x - el.x) * 0.6, el.y + (hd.y - el.y) * 0.6 + 1, 2.8, 2.2, sleeve, { flat: 0.6 });
  P.blob(hd.x, hd.y, 1.9, 1.8, S.gloves || S.skin);
}

function head(P, S, J) {
  const h = J.head;
  // A hood or a veil: round the head and behind it, falling to the
  // shoulders, the face looking out of it.
  const hood = S.hat && (S.hat.kind === 'hood' || S.hat.kind === 'veil') ? S.hat : null;
  let clip;
  if (hood) {
    const c = hood.color;
    const fall = hood.kind === 'veil' ? 15 : 9;
    P.poly([[h.x - 6.5, h.y - 1], [h.x - 8 + J.sway * 0.5, h.y + fall], [h.x + 8 + J.sway * 0.5, h.y + fall], [h.x + 6.5, h.y - 1]], c, { lv: 0.35 });
    P.blob(h.x, h.y - 0.5, 6.4, 7, c);
    clip = (x, y) => ((x + 0.5 - h.x) / 3.5) ** 2 + ((y + 0.5 - h.y - 1.2) / 4.3) ** 2 <= 1;
  }
  if (S.skull) {
    // Bone: a skull's dome, sockets, cheekbones, teeth.
    P.blob(h.x, h.y, 5, 5.6, '#d8d0bc', { clip });
    P.rect(h.x - 3, h.y, 2, 2, '#1a1414');
    P.rect(h.x + 1, h.y, 2, 2, '#1a1414');
    P.rect(h.x - 2, h.y + 4, 5, 1, '#1a1414');
    for (let x = h.x - 2; x <= h.x + 2; x += 2) P.glint(x, h.y + 4, '#e8e0cc');
  } else if (S.hollow || (hood && hood.deep)) {
    // Nothing inside: a dark helm's slot, or a hood's shadow.
    P.blob(h.x, h.y + (hood ? 1 : 0), hood ? 3.6 : 5, hood ? 4.4 : 5.6, S.hollow || '#140e16', { clip, amb: 0.1 });
  } else {
    P.blob(h.x, h.y, 4.6, 5.3, S.skin, { clip });
    // A jaw's shadow, the nose.
    P.set(h.x + 3, h.y + 3, shade(hex(S.skin), 0.7));
    P.set(h.x - 1, h.y + 1, shade(hex(S.skin), 0.75));
  }
  if (hood) {
    // (The hood's shadow across the brow.)
    for (let x = Math.floor(h.x - 4); x <= h.x + 4; x++) {
      for (const y of [Math.round(h.y - 3), Math.round(h.y - 2)]) if (clip(x, y)) P.set(x, y, shade(P.get(x, y), y === Math.round(h.y - 3) ? 0.45 : 0.7));
    }
  }
  if (S.hair && S.hairStyle !== 'bald' && !hood) {
    P.blob(h.x, h.y - 2.5, 5.2, 3.6, S.hair, { clip: (x, y) => y < h.y - 0.5 || x > h.x + 3 || x < h.x - 4 });
    P.glint(h.x - 2, h.y - 5, mix(hex(S.hair), [255, 255, 255], 0.45));
  }
  if (S.beard) {
    // Whiskers from the cheeks, a moustache over the mouth, the beard's
    // point (and long, to the chest).
    const L = S.beardLong ? 6 : 0;
    P.poly([[h.x - 4.5, h.y + 1], [h.x - 2, h.y + 2.5], [h.x + 2, h.y + 2.5], [h.x + 4.5, h.y + 1], [h.x + 3.5, h.y + 5 + L], [h.x, h.y + 7 + L], [h.x - 3.5, h.y + 5 + L]], S.beard, { lv: 0.5 });
    P.line(h.x - 1, h.y + 3, h.x + 1, h.y + 3, shade(hex(S.beard), 0.45));
    if (L) for (const dx of [-1, 1]) P.line(h.x + dx * 1.5, h.y + 5, h.x + dx, h.y + 10, shade(hex(S.beard), 0.75));
  }
  // The eyes: burning, if it's dead or worse; else a mortal's.
  const ey = h.y + (S.skull ? 0 : 0);
  if (S.eyes) {
    const k = J.wind ? mix(hex(S.eyes), [255, 255, 255], 0.5) : hex(S.eyes);
    if (S.visor) P.rect(h.x - 3, ey, 7, 1, k);
    else {
      P.eye(h.x - 2, ey, k);
      P.eye(h.x + 2, ey, k);
    }
  } else if (!S.skull && !S.hollow) {
    P.set(h.x - 2, ey, '#1e1a28');
    P.set(h.x + 2, ey, '#1e1a28');
    if (!hood) {
      P.set(h.x - 2, ey - 1, shade(hex(S.hair || S.skin), 0.6));
      P.set(h.x + 2, ey - 1, shade(hex(S.hair || S.skin), 0.6));
    }
    if (!S.beard) P.set(h.x, ey + 3, shade(hex(S.skin), 0.65));
  }
  if (S.hat) hat(P, S, J);
  if (S.face) S.face(P, J);
}

function hat(P, S, J) {
  const h = J.head;
  const H = S.hat;
  const c = H.color;
  switch (H.kind) {
    case 'crown': {
      P.poly([[h.x - 5, h.y - 4], [h.x + 5, h.y - 4], [h.x + 5, h.y - 7], [h.x - 5, h.y - 7]], c, { lv: 0.7 });
      for (let i = 0; i < 4; i++) P.spike(h.x - 4.5 + i * 3, h.y - 7, -Math.PI / 2, 4 + (i % 2), 1.3, c);
      if (H.gem) P.set(h.x, h.y - 6, hex(H.gem));
      break;
    }
    case 'circlet':
      P.line(h.x - 5, h.y - 3, h.x + 5, h.y - 3, c);
      P.glint(h.x - 3, h.y - 3);
      if (H.gem) P.set(h.x, h.y - 3, hex(H.gem));
      break;
    case 'hood':
    case 'veil':
      // (Its lip, catching the light.)
      for (let i = -3; i <= 3; i++) P.set(h.x + i, h.y - 3.6 + Math.abs(i) * 0.4, shade(hex(c), 1.35));
      if (H.trim) for (const s of [-1, 1]) P.line(h.x + s * 4, h.y + 1, h.x + s * 5, h.y + 7, H.trim);
      break;
    case 'helm':
      P.blob(h.x, h.y - 1.5, 5.6, 5.6, c, { clip: (x, y) => y < h.y + 1 });
      P.rect(h.x - 5, h.y, 11, 4, shade(hex(c), 0.85));
      P.rect(h.x - 4, h.y + 1, 9, 1, '#120e14');
      if (H.crest) for (let i = 0; i < 5; i++) P.spike(h.x - 2 + i, h.y - 6, -Math.PI / 2 - 0.3 + i * 0.15, 4 + (i === 2 ? 3 : 0), 1, H.crest);
      if (H.spikes) for (const s of [-1, 1]) P.spike(h.x + s * 5, h.y - 3, -Math.PI / 2 + s * 0.7, 5, 1.2, H.spikes);
      P.glint(h.x - 3, h.y - 5);
      break;
    case 'tricorn': {
      // Its crown, and the brim cocked up on three sides, edged.
      P.blob(h.x, h.y - 5, 4.6, 3.2, c);
      P.poly([[h.x - 8.5, h.y - 5.5], [h.x - 5, h.y - 2.5], [h.x + 5, h.y - 2.5], [h.x + 8.5, h.y - 5.5], [h.x + 5, h.y - 4], [h.x - 5, h.y - 4]], shade(hex(c), 1.15), { lv: 0.55 });
      const tr = hex(H.trim || GOLD);
      P.line(h.x - 8, h.y - 5, h.x - 5, h.y - 3, tr);
      P.line(h.x + 5, h.y - 3, h.x + 8, h.y - 5, tr);
      P.line(h.x - 4, h.y - 3, h.x + 4, h.y - 3, shade(tr, 0.8));
      break;
    }
    case 'cone':
      P.poly([[h.x - 9, h.y - 2], [h.x + 9, h.y - 2], [h.x, h.y - 11]], c, { lv: 0.6 });
      P.line(h.x - 8, h.y - 2, h.x + 8, h.y - 2, shade(hex(c), 0.65));
      break;
    case 'mushcap':
      P.blob(h.x, h.y - 4, 8.5, 4.5, c, { clip: (x, y) => y < h.y - 2 });
      for (const [dx, dy] of [[-4, -6], [2, -7], [5, -4], [-1, -4]]) P.blob(h.x + dx, h.y + dy, 1, 0.8, '#f0ece0');
      P.line(h.x - 8, h.y - 2, h.x + 8, h.y - 2, shade(hex(c), 0.5));
      break;
    case 'wreath':
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        P.blob(h.x + Math.cos(a) * 5.5, h.y - 2 + Math.sin(a) * 3, 1.4, 1.1, i % 2 ? c : H.color2 || c);
      }
      if (H.flowers) for (const dx of [-4, 1, 4]) P.blob(h.x + dx, h.y - 4.5, 1, 1, H.flowers);
      break;
    case 'thorns':
      for (let i = 0; i < 7; i++) P.spike(h.x - 5 + i * 1.7, h.y - 4, -Math.PI / 2 + (i - 3) * 0.25, 4 + (i % 2) * 2, 0.9, c);
      if (H.flowers) P.blob(h.x + 3, h.y - 5, 1.5, 1.3, H.flowers);
      break;
    case 'bandana':
      P.blob(h.x, h.y - 2.5, 5.4, 3.6, c, { clip: (x, y) => y < h.y - 1 });
      P.tube(h.x + 5, h.y - 2, h.x + 8 + J.sway, h.y + 3, 1.2, 0.8, c);
      break;
    case 'miner':
      P.blob(h.x, h.y - 2.5, 5.6, 4, c, { clip: (x, y) => y < h.y - 0.5 });
      P.line(h.x - 6, h.y - 1, h.x + 6, h.y - 1, shade(hex(c), 0.7));
      P.blob(h.x - 1, h.y - 4, 1.6, 1.4, '#fff8a0');
      break;
    case 'shell':
      P.blob(h.x, h.y - 4, 6.5, 4, c, { clip: (x, y) => y < h.y - 1 });
      for (let i = -2; i <= 2; i++) P.line(h.x, h.y - 1, h.x + i * 3, h.y - 7, shade(hex(c), 0.8));
      break;
    case 'antlers':
      for (const s of [-1, 1]) {
        P.tube(h.x + s * 3, h.y - 4, h.x + s * 7, h.y - 10, 1.1, 0.8, c);
        P.tube(h.x + s * 7, h.y - 10, h.x + s * 6, h.y - 14, 0.8, 0.6, c);
        P.tube(h.x + s * 5, h.y - 7, h.x + s * 9, h.y - 9, 0.7, 0.5, c);
      }
      break;
  }
}

function shieldOn(P, S, J) {
  const c = S.shield;
  const x = J.hdL.x - 1;
  const y = J.hdL.y - 5;
  P.blob(x, y, 4.5, 6, c, { flat: 0.4 });
  P.blob(x, y, 1.5, 1.5, S.shieldBoss || GOLD);
  P.line(x - 4, y - 5, x - 4, y + 4, shade(hex(c), 1.3));
}

// ------------------------------------------------------------ arms they bear
function weapon(P, S, J) {
  const W = S.weapon;
  if (!W) return;
  const hd = J.hdR;
  const ang = J.wind ? (W.windAng ?? -2.2) : (W.ang ?? 1.15);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const at = (k) => ({ x: hd.x + ux * k, y: hd.y + uy * k });
  const steel = W.color || STEEL;
  switch (W.kind) {
    case 'greatsword': {
      const tip = at(W.len || 20);
      P.tube(hd.x - ux * 3, hd.y - uy * 3, hd.x + ux * 1, hd.y + uy * 1, 0.9, 0.9, WOOD);
      P.tube(at(1.5).x - uy * 3, at(1.5).y + ux * 3, at(1.5).x + uy * 3, at(1.5).y - ux * 3, 0.9, 0.9, W.guard || GOLD);
      P.poly([[at(2).x - uy * 1.6, at(2).y + ux * 1.6], [at(2).x + uy * 1.6, at(2).y - ux * 1.6], [tip.x, tip.y]], steel, { grad: [-uy, ux], contrast: 1.2 });
      P.line(at(3).x, at(3).y, tip.x - ux * 2, tip.y - uy * 2, mix(hex(steel), [255, 255, 255], 0.5));
      if (W.glow) for (let k = 4; k < (W.len || 20); k += 3) P.set(at(k).x + uy, at(k).y - ux, hex(W.glow));
      break;
    }
    case 'sabre': {
      const pts = [];
      for (let k = 0; k <= 13; k++) pts.push({ x: at(k).x + uy * (k * k) / 40, y: at(k).y - ux * (k * k) / 40 });
      for (let i = 0; i + 1 < pts.length; i++) P.tube(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 1.1 - i * 0.06, 1.05 - i * 0.06, steel);
      P.blob(hd.x, hd.y, 1.6, 1.6, W.guard || GOLD);
      break;
    }
    case 'spear': {
      const back = { x: hd.x - ux * 8, y: hd.y - uy * 8 };
      const tip = at(W.len || 16);
      P.tube(back.x, back.y, tip.x, tip.y, 0.8, 0.8, W.shaft || WOOD);
      P.spike(tip.x, tip.y, ang, 5, 1.6, steel);
      if (W.barb) P.spike(tip.x - ux * 1, tip.y - uy * 1, ang + 2.5, 2.5, 0.8, steel);
      break;
    }
    case 'warhammer':
    case 'mace':
    case 'pick': {
      const end = at(W.len || 14);
      P.tube(hd.x - ux * 3, hd.y - uy * 3, end.x, end.y, 0.9, 0.9, WOOD);
      if (W.kind === 'warhammer') P.poly([[end.x - uy * 4 - ux, end.y + ux * 4 - uy], [end.x + uy * 4 - ux, end.y - ux * 4 - uy], [end.x + uy * 4 + ux * 3, end.y - ux * 4 + uy * 3], [end.x - uy * 4 + ux * 3, end.y + ux * 4 + uy * 3]], steel, { contrast: 1.1 });
      else if (W.kind === 'mace') {
        P.blob(end.x + ux, end.y + uy, 2.6, 2.6, steel);
        for (let i = 0; i < 6; i++) P.spike(end.x + ux, end.y + uy, (i / 6) * TAU, 4, 0.8, steel);
      } else {
        P.tube(end.x - uy * 6, end.y + ux * 6, end.x + uy * 5, end.y - ux * 5, 1.1, 0.5, steel);
      }
      break;
    }
    case 'flail': {
      const end = at(8);
      P.tube(hd.x - ux * 2, hd.y - uy * 2, end.x, end.y, 0.9, 0.9, WOOD);
      // The chain, and the ball swinging on it.
      const sw = J.wind ? -2.6 + J.sway * 0.3 : 1.6 + J.sway * 0.5;
      const ball = { x: end.x + Math.cos(sw) * 8, y: end.y + Math.sin(sw) * 8 };
      for (let k = 1; k < 7; k++) P.set(end.x + ((ball.x - end.x) * k) / 7, end.y + ((ball.y - end.y) * k) / 7, k % 2 ? IRON : STEEL);
      P.blob(ball.x, ball.y, 2.8, 2.8, W.color || IRON);
      for (let i = 0; i < 6; i++) P.spike(ball.x, ball.y, (i / 6) * TAU + 0.3, 4, 0.8, STEEL);
      break;
    }
    case 'crossbow': {
      const c = { x: (J.hdL.x + J.hdR.x) / 2, y: (J.hdL.y + J.hdR.y) / 2 };
      P.tube(c.x + 6, c.y + 1, c.x - 8, c.y - 1, 1.2, 1, WOOD);
      P.tube(c.x - 6, c.y - 6, c.x - 6, c.y + 5, 0.9, 0.9, IRON);
      P.line(c.x - 6, c.y - 6, c.x + 2, c.y, '#e8e0c8');
      P.line(c.x - 6, c.y + 5, c.x + 2, c.y, '#e8e0c8');
      break;
    }
    case 'longbow': {
      const hdL = J.hdL;
      for (let k = -9; k <= 9; k++) {
        const x = hdL.x - 2 - Math.cos((k / 9) * 1.2) * 4 + 4;
        P.set(x - 4, hdL.y + k, hex(W.color || '#8a6a3a'));
      }
      P.line(hdL.x - 2, hdL.y - 9, hdL.x - 2, hdL.y + 9, '#e8e0c8');
      break;
    }
    case 'daggers':
      for (const h of [J.hdR, J.hdL]) P.spike(h.x, h.y, J.wind ? -1.6 : 1.3, 6, 1, steel);
      break;
    case 'staff': {
      const top = { x: hd.x + 1, y: hd.y - 20 };
      P.tube(hd.x + 1, hd.y + 10, top.x, top.y, 1, 1, W.shaft || '#4a3a2a');
      if (W.head) W.head(P, top, J);
      break;
    }
    case 'censer': {
      const sw = J.sway * 0.6 + (J.wind ? -1.2 : 0);
      const pot = { x: hd.x + Math.sin(sw) * 9, y: hd.y + Math.cos(sw) * 9 };
      for (let k = 1; k < 8; k++) P.set(hd.x + ((pot.x - hd.x) * k) / 8, hd.y + ((pot.y - hd.y) * k) / 8, hex(GOLD));
      P.blob(pot.x, pot.y, 2.8, 2.4, W.color || GOLD);
      if (W.fire) {
        P.blob(pot.x, pot.y - 2, 1.6, 1.8, '#ffb040', { lift: 0.4 });
        P.set(pot.x, pot.y - 4 - (Math.round(J.t * 8) % 2), hex('#ffe070'));
      }
      break;
    }
    case 'horn': {
      const at0 = J.wind ? { x: J.head.x - 3, y: J.head.y + 3 } : { x: hd.x, y: hd.y };
      const ang2 = J.wind ? -2.8 : 1.9;
      const pts = [];
      for (let k = 0; k <= 10; k++) pts.push([at0.x + Math.cos(ang2) * k + Math.sin(k / 3) * 1.5, at0.y + Math.sin(ang2) * k, 0.8 + k * 0.28]);
      P.limb(pts, W.color || '#c8b890');
      break;
    }
  }
}

// ------------------------------------------------------------ helpers
// A tongue of fire `h` high from (x, y), licking side to side: white-gold
// at its heart, red at its edge and its tip.
const FIRE = ['#fff0a0', '#ffa030', '#d84a14'];
const flame = (P, x, y, h, t, col = FIRE) => {
  for (let i = 0; i < h; i++) {
    const k = i / h;
    const w = Math.round((1 - k) * (0.5 + h * 0.13));
    const off = Math.round(Math.sin(t * TAU * 2 + k * 2.5) * k * 1.6);
    for (let dx = -w; dx <= w; dx++) {
      const edge = Math.abs(dx) / (w + 0.5);
      P.set(x + dx + off, y - i, hex(edge > 0.6 || k > 0.7 ? col[2] : edge > 0.25 || k > 0.4 ? col[1] : col[0]));
    }
  }
};
// A wisp: a bright head and a fading tail behind it along (dx, dy).
const wisp = (P, x, y, dx, dy, c, n = 4) => {
  for (let i = n; i >= 0; i--) P.fx(x - dx * i, y - dy * i, c, i ? 0.7 * (1 - i / (n + 1)) : 1);
  P.fx(x, y, '#ffffff', 0.5);
};
const drip = (P, x, y, len, t, c) => {
  const k = (t * len * 2) % len;
  P.set(x, y + k, hex(c));
};

// ------------------------------------------------------------ who's who
// Each: how it's dressed and armed, and its own moving parts.
const FIGS = {
  // ---- Thessa's barrows, mines, crypts and holdouts.
  barrow_king: {
    skin: '#9aa8b0', eyes: '#a0e8ff', skull: true, body: '#3a3a52', plate: '#7a7464', legs: '#2a2a3a', greaves: '#7a7464', boots: '#2a2a30', cape: '#2a3a5a', capeRagged: true,
    hat: { kind: 'crown', color: '#c8a030', gem: '#a0e8ff' }, weapon: { kind: 'greatsword', color: '#b8c8d8', glow: '#a0e8ff' },
    fx: (P, J) => {
      // Frost breath, curling from the skull.
      for (let i = 0; i < 2; i++) {
        const k = (J.t * 2 + i / 2) % 1;
        P.puff(J.head.x - 3 - k * 6, J.head.y + 4 - k * 4, 1 + k * 1.5, '#e0f8ff', 0.6 * (1 - k));
      }
    },
  },
  mound_witch: {
    skin: '#9aa88a', hair: '#2a2a22', hairStyle: 'wild', eyes: '#a0ff70', robe: '#2e2c24', body: '#2e2c24', trim: '#6a8a3a', robeRagged: true,
    hat: { kind: 'hood', color: '#2a2a22' }, weapon: { kind: 'staff', shaft: '#4a3a24', head: (P, top, J) => {
      P.blob(top.x, top.y, 2.6, 2.6, '#e8e0cc');
      P.rect(top.x - 1, top.y, 1, 1, '#1a1414');
      P.rect(top.x + 1, top.y, 1, 1, '#1a1414');
      const g = 0.5 + 0.5 * Math.sin(J.t * TAU * 2);
      P.set(top.x, top.y - 4 - Math.round(g), hex('#a0ff70'));
      P.set(top.x - 1, top.y - 3, hex('#5aa040'));
    } },
    fx: (P, J) => {
      // Her husbands' souls, circling her.
      P.around(22, 32, 14, 6, 3, J.t * TAU, (x, y, i, a) => wisp(P, x, y, -Math.sin(a) * 1.2, Math.cos(a) * 0.5, '#a0ff70'));
    },
  },
  huntsman: {
    skin: '#8a9aa4', hair: '#c8ccc8', hairStyle: 'long', eyes: '#80e8ff', body: '#3a4a3a', legs: '#2a3a2a', boots: '#1a2a1a', cape: '#4a5a4a', capeRagged: true,
    hat: { kind: 'antlers', color: '#d8d0b8' }, weapon: { kind: 'longbow', color: '#6a5a3a' }, belt: '#4a3a24',
    behind: (P, J) => {
      // A quiver of pale arrows.
      P.tube(31, 24 + J.b, 27, 38, 1.8, 1.6, '#4a3a24');
      for (let i = 0; i < 3; i++) P.set(31 + i - 1, 22 + J.b - i, hex('#e8e0c8'));
    },
  },
  foreman: {
    skin: '#d8d4c4', eyes: '#ffb040', skull: true, body: '#5a4a3a', legs: '#3a3226', boots: '#2a1e14', belt: '#2a1e14', buckle: '#c8a040',
    hat: { kind: 'miner', color: '#c8a030' }, weapon: { kind: 'pick', len: 13, color: '#8a8a98' },
    chest: (P, J) => {
      // His vest, and the lamp's glow on him.
      P.rect(17, 26 + J.b, 2, 9, '#4a3a2a');
      P.rect(25, 26 + J.b, 2, 9, '#4a3a2a');
    },
  },
  priest: {
    skin: '#7aa098', hair: '#3a5a3a', hairStyle: 'long', eyes: '#c8ffd0', robe: '#2a4a5a', body: '#2a4a5a', trim: '#c8a030', robeRagged: true,
    hat: { kind: 'hood', color: '#24404e' }, weapon: { kind: 'censer', color: '#a08a50' },
    front: (P, J) => {
      // Water running off him, weed hanging on.
      for (const x of [15, 20, 28]) drip(P, x, 40, 14, J.t + x * 0.1, '#80c8e0');
      P.line(17, 30 + J.b, 16, 40, '#3a6a3a');
      P.line(27, 32 + J.b, 28, 42, '#3a6a3a');
    },
  },
  hollow_saint: {
    skin: '#d8d4e0', hair: '#f0f0f8', hairStyle: 'long', eyes: '#c8a0ff', robe: '#dcd8cc', body: '#dcd8cc', trim: '#8a6ad8', slimSleeves: true,
    hat: { kind: 'circlet', color: '#e0c050', gem: '#c8a0ff' },
    fx: (P, J) => {
      // A halo, turning, broken in three places.
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU + J.t * TAU * 0.25;
        if (Math.floor(((a % TAU) / TAU) * 6) % 2 && i % 4 === 0) continue;
        P.fx(J.head.x + Math.cos(a) * 8.5, J.head.y - 2 + Math.sin(a) * 8.5, i % 5 ? '#e8d8ff' : '#ffffff', 0.85);
      }
    },
    face: (P, J) => {
      // Hollow: where her face was, only light.
      P.blob(J.head.x, J.head.y + 1, 2.8, 3.2, '#2a2038', { amb: 0 });
      P.eye(J.head.x - 1, J.head.y, '#c8a0ff');
      P.eye(J.head.x + 2, J.head.y, '#c8a0ff');
    },
  },
  warlord: {
    skin: '#a87a58', hair: '#1a1410', beard: '#1a1410', body: '#5a2020', plate: '#6a5a50', legs: '#3a3030', greaves: '#6a5a50', boots: '#2a2020', cape: '#7a2020',
    hat: { kind: 'helm', color: '#6a6060', spikes: '#c8c0b8' }, weapon: { kind: 'warhammer', len: 15, color: '#8a8a98' }, belt: '#2a1a14', buckle: GOLD,
  },
  twins: {
    skin: '#a87a58', hair: '#3a2a1a', body: '#4a3a3a', plate: '#5a5a62', legs: '#3a3030', greaves: '#5a5a62', boots: '#2a2020',
    hat: { kind: 'helm', color: '#5a5a62', crest: '#8a2020' }, weapon: { kind: 'warhammer', len: 14 }, shield: '#7a7a88', shieldBoss: '#8a2020',
  },
  twin_b: {
    skin: '#a87a58', hair: '#3a2a1a', hairStyle: 'long', body: '#2a2a2a', legs: '#22221e', boots: '#1a1a16', cape: '#3a2020', capeShort: true, belt: '#3a2a1a',
    hat: { kind: 'bandana', color: '#8a2020' }, weapon: { kind: 'daggers' }, sash: '#8a2020',
  },
  poisoner: {
    skin: '#b8a07a', hair: '#4a5a2a', eyes: '#c8ff60', robe: '#3a4a2a', body: '#3a4a2a', trim: '#a8c040',
    hat: { kind: 'hood', color: '#2e3a22' }, weapon: { kind: 'daggers', color: '#a8c040' },
    front: (P, J) => {
      // Her vials, on a bandolier, one bubbling.
      for (let i = 0; i < 4; i++) P.blob(17 + i * 2.5, 30 + J.b + i * 1.5, 0.9, 1.4, i % 2 ? '#a8e040' : '#c84a8a', { lift: 0.3 });
      P.set(18, 26 + J.b - (Math.round(J.t * 8) % 3), hex('#e8ff90'));
    },
  },
  thorn_queen: {
    skin: '#a8c890', hair: '#3a5a2a', hairStyle: 'long', eyes: '#e05070', robe: '#4a2a3a', body: '#4a2a3a', trim: '#e05070', robeRagged: true,
    hat: { kind: 'thorns', color: '#5a7a3a', flowers: '#e05070' }, weapon: { kind: 'staff', shaft: '#4a3a24', head: (P, top, J) => {
      P.blob(top.x, top.y, 2.6, 2.4, '#e05070');
      P.blob(top.x - 1, top.y - 1, 1.2, 1, '#ff90a0', { lift: 0.4 });
      P.spike(top.x - 2, top.y + 2, 2.4, 3, 0.8, '#5a8a3a');
      P.spike(top.x + 2, top.y + 2, 0.7, 3, 0.8, '#5a8a3a');
      if (J.wind) P.around(top.x, top.y, 4, 4, 5, J.t * TAU, (x, y) => P.set(x, y, hex('#ff90a0')));
    } },
    front: (P, J) => {
      // Briars climbing her skirts, roses on them.
      for (let i = 0; i < 4; i++) {
        const x = 14 + i * 5;
        P.line(x, 54, x + 2 + Math.round(J.sway), 40 + i, '#4a6a2a');
        P.blob(x + 2 + Math.round(J.sway), 40 + i, 1.2, 1.1, i % 2 ? '#e05070' : '#c83a5a', { lift: 0.3 });
      }
    },
  },

  // ---- Kharos.
  cinder_king: {
    skin: '#4a3a36', eyes: '#ff8030', robe: '#2a2020', body: '#2a2020', plate: '#4a3a34', trim: '#ff8030', cape: '#3a1810',
    hat: { kind: 'crown', color: '#a07020', gem: '#ff8030' }, weapon: { kind: 'greatsword', color: '#4a3a34', glow: '#ff8030' },
    face: (P, J) => {
      // His crown burns: flames off every point, flaring as he strikes.
      for (let i = 0; i < 4; i++) flame(P, Math.round(J.head.x - 4.5 + i * 3), Math.round(J.head.y - 10 - (i % 2)), J.wind ? 7 : 5, J.t + i * 0.27);
      // Cracks of fire in his skin.
      P.line(J.head.x - 3, J.head.y + 2, J.head.x - 1, J.head.y + 4, '#ff6020');
    },
    fx: (P, J) => {
      // Embers rising off him.
      for (let i = 0; i < 4; i++) {
        const k = (J.t + i / 4) % 1;
        P.fx(13 + i * 6 + Math.sin(k * 6 + i) * 1.5, 52 - k * 40, k < 0.5 ? '#ffe070' : '#ff6020', 1 - k * 0.8);
      }
    },
  },
  smoke_herald: {
    skin: '#8a8484', eyes: '#ff9050', robe: '#3e3836', body: '#3e3836', trim: '#ff6030', robeRagged: true, hollow: '#1a1616',
    hat: { kind: 'hood', color: '#4a4240', deep: true }, weapon: { kind: 'horn', color: '#d8c8a0' }, belt: '#2a2220', buckle: '#ff6030',
    fx: (P, J) => {
      // Smoke rolling off his shoulders, rising, thinning.
      for (let i = 0; i < 5; i++) {
        const k = (J.t + i / 5) % 1;
        const side = i % 2 ? 1 : -1;
        P.puff(22 + side * (8 + k * 4) + Math.sin(k * 5 + i) * 1.5, 26 - k * 22, 2 + k * 3, i % 2 ? '#9a9490' : '#7a7470', 0.55 * (1 - k));
      }
      // And a coal's glow, under the hood.
      P.fx(J.head.x, J.head.y + 4, '#ff6030', 0.35 + 0.2 * Math.sin(J.t * TAU));
    },
  },
  obsidian_abbess: {
    skin: '#c8c0d0', hair: '#140e1a', hairStyle: 'long', eyes: '#c8b8f0', robe: '#1e1824', body: '#1e1824', trim: '#c8b8f0', slimSleeves: true,
    hat: { kind: 'veil', color: '#2a2234', trim: '#c8b8f0' },
    behind: (P, J) => {
      // Panes of black glass drifting round her, catching the light.
      P.around(22, 28, 15, 9, 5, J.t * TAU * 0.5, (x, y, i) => {
        P.poly([[x - 2, y - 3], [x + 2, y - 2], [x + 1, y + 3], [x - 2, y + 2]], '#3a2e4a', { lv: 0.6, contrast: 1.6 });
        P.glint(x - 1, y - 2, '#e8e0ff');
        if (i === Math.floor(J.t * 5)) P.glint(x + 1, y, '#ffffff');
      });
    },
    front: (P, J) => {
      for (let k = 0; k < 3; k++) P.set(18 + k * 4, 44 + k * 3, hex('#c8b8f0'));
      P.blob(J.hdR.x, J.hdR.y - 1, 1.5, 1.5, '#c8b8f0', { lift: 0.5 });
    },
  },
  kiln_priest: {
    skin: '#a87a58', hair: '#e8e0d0', hairStyle: 'bald', eyes: '#ffd060', beard: '#e8e0d0', beardLong: true, robe: '#8a3a1a', body: '#8a3a1a', trim: '#ffd060',
    hat: { kind: 'cone', color: '#c86a2a' }, weapon: { kind: 'censer', color: '#8a5a2a', fire: true },
    front: (P, J) => {
      // Glaze dripping white-hot off his sleeves.
      drip(P, J.hdL.x, J.hdL.y + 2, 8, J.t, '#ffe8c0');
      drip(P, J.hdL.x + 1, J.hdL.y + 2, 8, J.t + 0.5, '#ffb040');
    },
  },
  ash_reaver: {
    skin: '#7a4a30', hair: '#0e0a08', beard: '#0e0a08', body: '#3a2a24', mail: true, legs: '#2a201c', boots: '#141010', belt: '#2a1a14', buckle: '#ff6030', cape: '#4a2a20', capeRagged: true,
    hat: { kind: 'helm', color: '#3a3436', crest: '#c84a1a' }, weapon: { kind: 'flail', color: '#5a4a44' }, sash: '#c84a1a',
    face: (P, J) => {
      // Fury in his eyes (and more of it, berserk).
      const k = J.st.berserk ? '#ff3020' : '#ff7040';
      P.eye(J.head.x - 2, J.head.y + 1, k);
      P.eye(J.head.x + 2, J.head.y + 1, k);
    },
    fx: (P, J) => {
      if (!J.st.berserk) return;
      // Berserk: steam of blood-heat off him, red.
      for (let i = 0; i < 5; i++) {
        const k = (J.t + i / 5) % 1;
        P.puff(12 + i * 5 + Math.sin(k * 4 + i), 38 - k * 30, 1 + k * 1.5, '#ff3020', 0.6 * (1 - k));
      }
    },
  },
  bombard_queen: {
    skin: '#b07850', hair: '#c83a1a', hairStyle: 'long', body: '#5a3a2a', legs: '#3a2a20', boots: '#2a1a12', gloves: '#2a2420', belt: '#3a2a1a', buckle: GOLD, arms: 'both',
    hat: { kind: 'bandana', color: '#ffb040' }, weapon: { kind: 'crossbow' },
    face: (P, J) => {
      // Goggles pushed up.
      P.blob(J.head.x - 2, J.head.y - 3, 1.5, 1.2, '#c87a40', { lift: 0.3 });
      P.blob(J.head.x + 2, J.head.y - 3, 1.5, 1.2, '#c87a40', { lift: 0.3 });
    },
    chest: (P, J) => {
      // A bandolier of little bombs, fuses fizzing.
      for (let i = 0; i < 5; i++) {
        P.blob(16 + i * 2.6, 26 + J.b + i * 2.2, 1.3, 1.3, '#2a2420');
        if ((Math.floor(J.t * 8) + i) % 3 === 0) P.set(16 + i * 2.6, 24 + J.b + i * 2.2, hex('#ffe070'));
      }
    },
  },
  kiln_king: {
    skin: '#6a4030', hair: '#ff9030', beard: '#ff9030', eyes: '#ffb040', body: '#3a2a20', plate: '#5a4a40', legs: '#2a1e18', greaves: '#4a3a30', boots: '#1a1210', gloves: '#2a2020', belt: '#2a1a14', buckle: '#ffd060',
    hat: { kind: 'crown', color: '#ffd060', gem: '#ff6020' }, weapon: { kind: 'warhammer', len: 16, color: '#5a4a40' },
    chest: (P, J) => {
      // A leather apron, scorched; the forge-glow under his plate.
      P.poly([[17, 34], [27, 34], [28, 50], [16, 50]], '#5a3a24', { lv: 0.45 });
      P.blob(22, 31 + J.b, 2, 1.6, '#ff9030', { lift: 0.5 + 0.2 * Math.sin(J.t * TAU) });
    },
  },

  // ---- Myrrow.
  bog_king: {
    skin: '#8a6a48', hair: '#2a1e12', hairStyle: 'long', eyes: '#e0c870', body: '#3a2e20', mail: true, legs: '#2e2418', boots: '#1e1810', cape: '#3a3020', capeRagged: true,
    hat: { kind: 'crown', color: '#8a7020', gem: '#e0c870' }, weapon: { kind: 'mace', len: 12, color: '#6a5a40' },
    front: (P, J) => {
      // Bog water running off him; weed and peat.
      for (const x of [14, 19, 26, 30]) drip(P, x, 38, 16, J.t + x * 0.07, '#5a4a30');
      P.line(16, 28 + J.b, 15, 38, '#4a5a2a');
      P.line(28, 29 + J.b, 29, 39, '#4a5a2a');
    },
  },
  willow_wight: {
    skin: '#9aa88a', hair: '#5a7a4a', hairStyle: 'wild', eyes: '#c8f0a0', robe: '#3a3228', body: '#3a3228', trim: '#a0d090', robeRagged: true,
    hat: { kind: 'wreath', color: '#5a8a3a', color2: '#3a6a2a' },
    front: (P, J) => {
      // Moss hanging from her arms like a willow's, swaying.
      for (const [h, n] of [[J.elL, 0], [J.hdL, 1], [J.elR, 2], [J.hdR, 3]]) {
        const len = 6 + (n % 2) * 4;
        const w = Math.round(Math.sin(J.t * TAU + n) * 1.2);
        P.line(h.x, h.y + 1, h.x + w, h.y + 1 + len, n % 2 ? '#8ab070' : '#5a8a4a');
        P.line(h.x + 1, h.y + 1, h.x + 1 + w, h.y + len - 2, '#6a9a52');
      }
    },
    fx: (P, J) => {
      // Tears.
      const k = (J.t * 2) % 1;
      P.fx(J.head.x - 2, J.head.y + 1 + k * 6, '#a0e8ff', 1 - k * 0.6);
    },
  },
  lantern_lord: {
    skin: '#a8b8b0', hair: '#d0e0dc', hairStyle: 'long', eyes: '#80e8d0', robe: '#2a3a3a', body: '#2a3a3a', trim: '#80e8d0',
    hat: { kind: 'mushcap', color: '#3a5a5a' }, weapon: { kind: 'staff', shaft: '#3a3a30', head: (P, top, J) => {
      // His lantern, swinging on the crook, a soul-flame in it.
      P.tube(top.x, top.y, top.x - 4, top.y - 2, 0.8, 0.8, '#3a3a30');
      const sw = Math.sin(J.t * TAU) * 0.35;
      const L = { x: top.x - 4 + Math.sin(sw) * 4, y: top.y + Math.cos(sw) * 4 };
      P.line(top.x - 4, top.y - 2, L.x, L.y - 2, '#8a8a7a');
      P.blob(L.x, L.y, 2.6, 3, '#3a4a40');
      P.blob(L.x, L.y, 1.5, 2, '#80e8d0', { lift: 0.6 });
      P.glint(L.x, L.y - 1, '#e0fff8');
    } },
    fx: (P, J) => {
      // Fog round his feet, drifting.
      for (let i = 0; i < 5; i++) {
        const k = (J.t + i / 5) % 1;
        P.puff(8 + i * 7 + k * 4, 53 - k * 4, 3, '#c0d8d0', 0.45 * Math.sin(k * Math.PI));
      }
    },
  },
  hollow_king: {
    skin: '#2a2a32', eyes: '#e0f0ff', visor: true, hollow: '#1a1a22', body: '#4a5058', plate: '#5a6068', legs: '#3a4048', greaves: '#5a6068', boots: '#2a3038', cape: '#2a3040', capeRagged: true,
    hat: { kind: 'helm', color: '#5a6068', crest: '#a0b8c8' }, weapon: { kind: 'greatsword', color: '#a0b0c0' },
    fx: (P, J) => {
      // Fog leaking from the joints of the armour.
      for (const [x, y] of [[J.shL.x, J.shL.y + 2], [J.shR.x, J.shR.y + 2], [22, 36], [J.elL.x, J.elL.y], [18, 46], [J.head.x, J.head.y + 5]]) {
        const k = (J.t + x * 0.05) % 1;
        P.puff(x + k * 2, y - k * 5, 0.8 + k * 1.5, '#d0e0e8', 0.6 * (1 - k));
      }
    },
  },
  sharktooth: {
    skin: '#a87048', hair: '#3a2418', hairStyle: 'long', beard: '#4a2e1c', body: '#1e3a4a', legs: '#3a3020', boots: '#2a2014', belt: '#3a2a1a', buckle: GOLD, cape: '#2a2420', capeShort: true,
    hat: { kind: 'tricorn', color: '#3a3230', trim: '#d8c8a0' }, weapon: { kind: 'spear', len: 14, barb: true, color: '#c8c8c0' },
    chest: (P, J) => {
      // A necklace of sharks' teeth.
      for (let i = 0; i < 5; i++) P.spike(18 + i * 2, 26 + J.b + Math.abs(i - 2) * 0.5, Math.PI / 2, 2.5, 0.7, '#f0e8dc');
      // (His hoard, glinting on him.)
      if (J.st.loot) for (let i = 0; i < 3; i++) if ((Math.floor(J.t * 8) + i * 3) % 8 === 0) P.glint(18 + i * 3, 36, '#ffe070');
    },
  },
  pearl_queen: {
    skin: '#a06a44', hair: '#1a1410', hairStyle: 'long', eyes: '#80c8e8', robe: '#e8e0d4', body: '#e8e0d4', trim: '#80c8e8',
    hat: { kind: 'shell', color: '#f0e8dc' }, weapon: { kind: 'sabre', color: '#c8d8e0' },
    chest: (P, J) => {
      for (let i = 0; i < 7; i++) P.blob(17 + i * 1.6, 25 + J.b + Math.sin(i / 6 * Math.PI) * 2.5, 0.8, 0.8, '#f8f4ff', { lift: 0.3 });
    },
    fx: (P, J) => {
      // In her nacre: a shell of pearl closed round her, shimmering.
      if (!J.st.shell) return;
      for (let y = 8; y < 57; y++) {
        for (let x = 4; x < 41; x++) {
          const d = ((x + 0.5 - 22) / 18) ** 2 + ((y + 0.5 - 33) / 24) ** 2;
          if (d > 1) continue;
          const hue = Math.sin(x * 0.3 + y * 0.2 + J.t * TAU) * 0.5 + 0.5;
          P.fx(x, y, hue > 0.5 ? '#f0d8ff' : '#d0f0ff', d > 0.86 ? 0.85 : 0.22);
        }
      }
      P.around(22, 33, 15, 20, 5, J.t * TAU, (x, y) => P.fx(x, y, '#ffffff', 1));
    },
  },
};
// (The second of them shares the first's looks.)
FIGS.saint_shade = FIGS.hollow_saint;
FIGS.hollow_echo = FIGS.hollow_king;

// The skin and the rest from its look, where its figure doesn't say.
export const FIG_SPECIES = Object.keys(FIGS);

// Paint one frame of `species` at breath `t`, in state `st`.
export function paintFigure(species, t, st) {
  const S = FIGS[species];
  const P = new Paint(FIG_W, FIG_H);
  const J = figure(P, S, t, st);
  // (Its texture: a faint grain over cloth and skin alike.)
  P.over((x, y, c) => (hash2(x, y, 7) < 0.06 ? shade(c, 0.93) : null));
  P.done();
  // (What's seen through, unoutlined: smoke, wisps, sparks, breath.)
  if (S.fx) S.fx(P, J);
  return P.p;
}
export const hasFigure = (species) => !!FIGS[species];
export { ramp };
