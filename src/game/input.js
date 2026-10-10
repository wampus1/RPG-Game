import { remapKey } from './keybinds.js';

// Keyboard + mouse state. Pointer positions are mapped through the CRT
// curvature so clicks land on what the player sees.

export class Input {
  constructor(canvas, crt) {
    this.canvas = canvas;
    this.crt = crt;
    this.keys = new Set();
    this.pressed = [];
    this.mouse = { x: 0, y: 0, down: false, rdown: false, inside: false };
    this.clicks = [];
    this.wheel = 0;
    this.lastMoveKey = null;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      // (Round 62: the Workshop open over the game: its keys are its own.)
      if (this.paused) return;
      // (Round 77: through the player's own bindings; `raw` is the key
      // itself, for choosing a binding.)
      const raw = normKey(e);
      const k = remapKey(raw);
      // (Ctrl with a game key mustn't reach the browser: Ctrl+G is "find
      // next", Ctrl+B bookmarks, Ctrl+D bookmarks the page, and so on.)
      const ctrlGame = (e.ctrlKey || e.metaKey) && ['KeyG', 'KeyB', 'KeyD', 'KeyF', 'KeyS', 'KeyE', 'KeyQ', 'KeyH', 'KeyJ', 'KeyK', 'KeyP'].includes(k);
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F3', 'Backquote', 'Slash'].some((q) => q === k || q === raw) || ctrlGame) e.preventDefault();
      if (!this.keys.has(k)) {
        this.pressed.push({ code: k, raw, key: e.key, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) this.lastMoveKey = k;
      }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(remapKey(normKey(e))));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.rdown = false;
    });
    const pos = (e) => {
      const p = this.crt.mapPointer(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    };
    canvas.addEventListener('mousemove', (e) => {
      pos(e);
      this.mouse.inside = true;
    });
    canvas.addEventListener('mouseleave', () => (this.mouse.inside = false));
    canvas.addEventListener('mousedown', (e) => {
      pos(e);
      e.preventDefault();
      canvas.focus?.();
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.rdown = true;
      this.clicks.push({ button: e.button, x: this.mouse.x, y: this.mouse.y, shift: e.shiftKey, ctrl: e.ctrlKey, t: performance.now(), type: 'down' });
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
      this.clicks.push({ button: e.button, x: this.mouse.x, y: this.mouse.y, shift: e.shiftKey, t: performance.now(), type: 'up' });
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // (With shift held, most browsers scroll sideways: deltaX, not Y.)
        this.wheel += Math.sign(e.deltaY || e.deltaX);
        this.wheelShift = e.shiftKey;
      },
      { passive: false },
    );
  }

  isDown(code) {
    return this.keys.has(code);
  }

  consume() {
    const p = this.pressed;
    const c = this.clicks;
    const w = this.wheel;
    this.pressed = [];
    this.clicks = [];
    this.wheel = 0;
    return { pressed: p, clicks: c, wheel: w, wheelShift: this.wheelShift };
  }
}

function normKey(e) {
  if (e.code && e.code !== 'Unidentified') return e.code;
  return e.key;
}
