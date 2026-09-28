// Test helpers: run the game headlessly with stubbed renderer/UI.
import { Game } from '../src/game/game.js';

export function stubRenderer() {
  return {
    camX: 0,
    camY: 0,
    hidden: null,
    lighting: { sources: [] },
    emit() {},
    floatText() {},
    isHidden() {
      return false;
    },
    occlusionAlpha() {
      return 1;
    },
  };
}

export function stubUI() {
  const msgs = [];
  return {
    msgs,
    modal: false,
    handle: () => ({ pressed: [], clicks: [], wheel: 0 }),
    msg: (t) => msgs.push(t),
    hitTest: () => false,
    openContainer() {},
    openCrafting() {},
    openDialogue() {},
    openSign() {},
    openBook() {},
    openDeath() {},
    fade: 0,
  };
}

export function stubInput() {
  return {
    mouse: { x: 0, y: 0, down: false, inside: false },
    lastMoveKey: null,
    isDown: () => false,
    consume: () => ({ pressed: [], clicks: [], wheel: 0 }),
  };
}

export function makeGame(seed = 12345) {
  return new Game({ seed, renderer: stubRenderer(), audio: null, ui: stubUI() });
}
