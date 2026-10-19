// (Round 125) A layer over the frame, finer than it (twice the view each
// way): for what must be read in a hand of its own, a letter held up to
// read (see ui/document.js). It goes through the CRT with the frame (its
// curve, scanlines, fringes and glow; see crt.js), its pixels a little
// coarse, never as coarse as the view's.
import { VIEW_W, VIEW_H } from '../config.js';

export const OVER_SCALE = 2;
export const OVER_W = VIEW_W * OVER_SCALE;
export const OVER_H = VIEW_H * OVER_SCALE;

// `shown`: drawn this frame (cleared once the frame's been put on screen).
export const overlay = { canvas: null, ctx: null, shown: false };

export function overlayCtx() {
  if (!overlay.canvas) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = OVER_W;
    c.height = OVER_H;
    overlay.canvas = c;
    overlay.ctx = c.getContext('2d');
  }
  return overlay.ctx;
}
