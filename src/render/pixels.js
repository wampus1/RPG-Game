// (Round 115) A small canvas's pixels, for reading (an icon's, a sheet's, a
// master's texture). Reading a canvas back off the screen's card stalls the
// frame (more than a second of it, on a slow machine, the first time a
// town's signs or a feast's dishes came into view), so what's put into one
// as it's made is kept with it (see keepPixels), and anything else is read
// off it once and kept. Only for canvases that aren't drawn on again once
// they're made: a sprite, an icon, a texture.
const KEPT = new WeakMap();

export function keepPixels(c, data) {
  if (c && data) KEPT.set(c, data);
  return c;
}

export function pixelsOf(c) {
  let d = KEPT.get(c);
  if (!d) {
    d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    KEPT.set(c, d);
  }
  return d;
}

// The pixels of a w by h piece of it at (x, y), as getImageData gives them.
export function pixelsIn(c, x, y, w, h) {
  const d = pixelsOf(c);
  if (x === 0 && y === 0 && w === c.width && h === c.height) return d;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) {
    const sy = y + j;
    if (sy < 0 || sy >= c.height) continue;
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      if (sx < 0 || sx >= c.width) continue;
      const a = (sy * c.width + sx) * 4;
      const b = (j * w + i) * 4;
      out[b] = d[a];
      out[b + 1] = d[a + 1];
      out[b + 2] = d[a + 2];
      out[b + 3] = d[a + 3];
    }
  }
  return out;
}
