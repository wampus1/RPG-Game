// A dish's picture (round 50: see world/dishes.js), made of the pictures
// of what went into it: on a skewer over the fire, chunks of each along
// the stick, browned; a stew or soup in a wooden bowl, its colour theirs,
// bits of them in it, steam off it; a pie with its crust crimped and what
// went in it on top (a tart open, its filling showing; a loaf, flecked);
// a platter of little heaps of each on a plate (a salad in a bowl).
// 16 by 16, like every item's.

const S = 16;

// Each ingredient's picture as pixels, its main colour, and a few small
// cut-outs of it (the most solid bits), for the dish's.
function sample(icon) {
  const d = icon.getContext('2d').getImageData(0, 0, S, S).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < S * S; i++) {
    if (d[i * 4 + 3] < 200) continue;
    r += d[i * 4];
    g += d[i * 4 + 1];
    b += d[i * 4 + 2];
    n++;
  }
  const avg = n ? [r / n, g / n, b / n] : [160, 120, 80];
  // Shrunk to w x w (nearest), keeping only what's solid.
  const shrink = (w) => {
    const out = [];
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        const sx = Math.floor(((x + 0.5) * S) / w);
        const sy = Math.floor(((y + 0.5) * S) / w);
        const o = (sy * S + sx) * 4;
        out.push(d[o + 3] > 160 ? [d[o], d[o + 1], d[o + 2]] : null);
      }
    }
    return out;
  };
  return { avg, shrink };
}

export function paintDish(def, iconOf) {
  const D = def.dish;
  const px = new Uint8ClampedArray(S * S * 4);
  const set = (x, y, c, a = 255) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S || !c) return;
    const o = (y * S + x) * 4;
    px[o] = c[0];
    px[o + 1] = c[1];
    px[o + 2] = c[2];
    px[o + 3] = a;
  };
  const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, v * k)));
  const ings = D.ings.map((k) => sample(iconOf(k)));
  const avg = ings.reduce((a, s) => a.map((v, i) => v + s.avg[i] / ings.length), [0, 0, 0]);
  // A small cut-out of an ingredient, at (x, y), w wide, browned by `k`.
  const chunk = (s, x, y, w, k = 1) => {
    const p = s.shrink(w);
    p.forEach((c, i) => c && set(x + (i % w), y + Math.floor(i / w), shade(c, k * (Math.floor(i / w) === w - 1 ? 0.8 : 1))));
  };
  const form = D.form;
  if (form === 'Skewer') {
    // The stick, corner to corner; the pieces threaded on it, browned.
    for (let i = 0; i < 14; i++) {
      set(1 + i, 14 - i, [150, 112, 70]);
      set(1 + i, 15 - i, [96, 66, 40]);
    }
    set(15, 0, [210, 190, 150]);
    const at = ings.length === 1 ? [0.5] : ings.length === 2 ? [0.36, 0.64] : [0.24, 0.5, 0.76];
    ings.forEach((s, i) => {
      const t = at[i];
      chunk(s, Math.round(1 + t * 13) - 2, Math.round(14 - t * 13) - 2, 5, 0.78);
    });
    // (A scorch or two.)
    set(6, 8, [50, 30, 20]);
    set(10, 5, [50, 30, 20]);
  } else if (form === 'Stew' || form === 'Soup' || form === 'Salad') {
    // A wooden bowl, its rim lit; what's in it its colour, with bits.
    const wood = form === 'Salad' ? [200, 186, 160] : [134, 86, 48];
    for (let y = 9; y < 15; y++) {
      const half = Math.round(7 - (y - 9) * (y - 9) * 0.16);
      for (let x = 8 - half; x < 8 + half; x++) set(x, y, shade(wood, y === 9 ? 1.25 : x < 8 - half + 2 ? 0.8 : 1));
    }
    for (let x = 3; x < 13; x++) set(x, 15, shade(wood, 0.6));
    const fill = form === 'Salad' ? [90, 160, 70] : shade(avg, 0.8);
    for (let x = 2; x < 14; x++) for (let y = 7; y < 10; y++) if (Math.abs(x - 7.5) / 6 + Math.abs(y - 8.5) / 1.6 < 1.05) set(x, y, shade(fill, y === 7 ? 1.2 : 1));
    ings.forEach((s, i) => chunk(s, 3 + i * 4, form === 'Salad' ? 5 : 7, 3, form === 'Salad' ? 1 : 0.9));
    if (form !== 'Salad') {
      // Steam.
      for (const [x, y] of [[5, 4], [6, 3], [5, 2], [10, 4], [9, 3], [10, 1]]) set(x, y, [235, 235, 240], 150);
    }
  } else if (form === 'Pie' || form === 'Tart') {
    // A pie dish, the crust round it crimped, the top: a lattice over
    // what's in it (a tart: open, the filling and pieces of it showing).
    const crust = [222, 170, 96];
    for (let y = 6; y < 15; y++) {
      for (let x = 1; x < 15; x++) {
        const e = ((x - 7.5) / 6.6) ** 2 + ((y - 10) / 4.4) ** 2;
        if (e > 1) continue;
        const rim = e > 0.62;
        set(x, y, rim ? shade(crust, (x + y) % 2 ? 1.12 : 0.92) : form === 'Tart' ? shade(avg, 0.95) : shade(crust, 1.05));
      }
    }
    for (let x = 2; x < 14; x++) set(x, 14, [130, 130, 140]);
    if (form === 'Pie') {
      // Lattice, the filling showing between.
      for (let y = 8; y < 13; y++) for (let x = 3; x < 13; x++) if ((x + y) % 3 === 0 && ((x - 7.5) / 5) ** 2 + ((y - 10) / 3) ** 2 < 1) set(x, y, shade(avg, 0.85));
      ings.forEach((s, i) => chunk(s, 4 + i * 3, 3 + (i % 2), 3, 1));
    } else ings.forEach((s, i) => chunk(s, 3 + i * 4, 8, 3, 1));
  } else if (form === 'Loaf') {
    // A loaf, scored across the top, flecked with what's in it.
    const bread = shade([200, 140, 74].map((v, i) => v * 0.7 + avg[i] * 0.3), 1);
    for (let y = 6; y < 14; y++) {
      for (let x = 1; x < 15; x++) {
        const e = ((x - 7.5) / 7) ** 2 + ((y - 10) / 4) ** 2;
        if (e > 1 || (y > 12 && (x < 2 || x > 13))) continue;
        set(x, y, shade(bread, y < 8 ? 1.2 : y > 12 ? 0.75 : 1));
      }
    }
    for (const x of [4, 7, 10]) {
      set(x, 8, shade(bread, 1.4));
      set(x + 1, 7, shade(bread, 1.4));
    }
    ings.forEach((s, i) => {
      set(3 + i * 4, 10, shade(s.avg, 0.9));
      set(5 + i * 4, 11, shade(s.avg, 0.9));
    });
  } else {
    // A platter: a plate, little heaps of each on it.
    for (let y = 8; y < 15; y++) {
      for (let x = 0; x < 16; x++) {
        const e = ((x - 7.5) / 7.8) ** 2 + ((y - 11) / 3.6) ** 2;
        if (e > 1) continue;
        set(x, y, e > 0.7 ? [210, 214, 222] : [236, 238, 242]);
      }
    }
    const spots = ings.length === 1 ? [[5, 4]] : ings.length === 2 ? [[2, 5], [8, 5]] : [[1, 6], [6, 3], [10, 6]];
    ings.forEach((s, i) => chunk(s, spots[i][0], spots[i][1], 6, 1));
  }
  // (An outline, to sit on any background like the other items.)
  const out = new Uint8ClampedArray(px);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const o = (y * S + x) * 4;
      if (px[o + 3]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const qx = x + dx;
        const qy = y + dy;
        return qx >= 0 && qy >= 0 && qx < S && qy < S && px[(qy * S + qx) * 4 + 3] > 200;
      });
      if (near) {
        out[o] = 24;
        out[o + 1] = 18;
        out[o + 2] = 14;
        out[o + 3] = 200;
      }
    }
  }
  return out;
}

export function dishIcon(def, iconOf) {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  img.data.set(paintDish(def, iconOf));
  g.putImageData(img, 0, 0);
  return c;
}
