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

// (Older rounds' tests were written before realms had to learn things:
// everything is known there, as it used to be. Pass learned: false for a
// world that has to research.)
// (Round 68: and in the world as it was made before 0.68, the towns and
// places they name where they always were. Pass wg: 2 for a world made
// as new ones are now: see world/worldgen.js.)
export function makeGame(seed = 12345, { learned = true, wg = 1 } = {}) {
  const game = new Game({ seed, renderer: stubRenderer(), audio: null, ui: stubUI(), learned, wg });
  game.sim.tech.cheat = learned;
  // (What a game spreads over frames (a far town laid out, a way across
  // the sea) done there and then, so a test sees it at once.)
  game.instantWork = true;
  return game;
}

// Lots ready to build on, the way a town gets them day by day: a new street
// laid out (and finished by its builders) with lots along it.
export function lotsReady(game, L, type = 'house_m', n = 1) {
  const sim = game.sim;
  const fit = () => sim.roads.openLots(L).filter((q) => L.fits(q, type));
  for (let d = 0; d < 12 && fit().length < n; d++) {
    const plan = sim.roads.planStreet(L, L.lotSize(type));
    if (plan) sim.works.finishNow(L, sim.roads.startStreet(L, plan));
    else {
      const plot = L.openPlot(type);
      if (!plot || !sim.roads.addLot(L, plot, true)) break;
    }
    // (And any path to a lot laid.)
    for (const q of sim.works.projects) if (!q.done && q.sid === L.settlement.id && q.kind === 'path') sim.works.finishNow(L, q);
  }
  return fit();
}
