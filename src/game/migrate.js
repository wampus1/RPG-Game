// Bringing a world saved in an older version of the game up to this one
// (round 50; from now on, each version adds its own step here). A world is
// brought up whenever it's loaded (and for good when it's updated from its
// details: see SaveDetailsWindow and main.js), one version at a time from
// the one it was saved in, each step in three parts as it needs them:
//   data(d, log):  the save itself, as written, before a game is made of
//     it: things renamed or moved, what's missing filled in;
//   game(game, log):  the world once it's loaded: new things given to
//     the people in it (and what was wrong in it put right);
//   town(L, game):  each town as it's laid out again (a world's towns are
//     only made when they're needed): new stock, new kit, anything new to
//     its people.
// What can't be brought in is what's made only with a new world: its
// land, its places.
import { GAME_VERSION, compareVersions } from '../version.js';
import { stockPantry, PANTRY } from './cooking.js';
import { invAdd, invCount, kitchenOf, alive, traderOf } from '../sim/econ.js';
import { ITEMS } from '../world/items.js';

export const STEPS = [
  {
    // Achievements: the counts they're kept by.
    to: '0.49.0',
    data(d, log) {
      d.stats ||= {};
      for (const k of ['harvested', 'insights']) if (typeof d.stats[k] !== 'number') d.stats[k] = 0;
      log.push('Achievement counts started.');
    },
  },
  {
    // Cooking, guards' salves, foods that mend over time.
    to: '0.50.0',
    data(d, log) {
      // A recipe book, and what you've learnt things are, for everyone
      // who's played in it.
      const fix = (pd) => {
        if (!pd) return;
        pd.recipes ||= [];
        pd.kinds ||= [];
        // (Effects of the old kind kept; a buff with no end dropped.)
        pd.buffs = (pd.buffs || []).filter((q) => q && typeof q.until === 'number');
      };
      fix(d.player);
      for (const c of (d.party && d.party.chars) || []) fix(Array.isArray(c) ? c[1] && c[1].player : c && c.player);
      d.stats ||= {};
      if (typeof d.stats.cooked !== 'number') d.stats.cooked = 0;
      log.push('Recipe books added.');
    },
    game(game, log) {
      log.push('Cooks will stock their kitchens; the watch will carry salves.');
    },
    town(L) {
      // Every kitchen (and bakery) stocked for its cook's own dishes.
      const e = L.econ;
      const k = kitchenOf(L);
      if (k) stockPantry(k.store);
      for (const b of L.buildings) if (b.type === 'bakery' && e.biz[b.id]) stockPantry(e.biz[b.id].store, Math.random, 1);
      // A salve each for the watch.
      for (const r of L.npcs) {
        if (!alive(r) || r.job !== 'guard') continue;
        r.inv ||= [];
        if (!invCount(r.inv, 'healing_salve')) invAdd(r.inv, 'healing_salve', 1);
      }
    },
  },
  {
    // Instruments to play, a pipe to smoke, recipes on scrolls; effects
    // shown by their pictures.
    to: '0.51.0',
    data(d, log) {
      // (An effect from a potion: which potion, for its picture.)
      const name = (q) => Object.keys(ITEMS).find((k) => ITEMS[k].kind === 'potion' && ITEMS[k].name === q.name);
      const fix = (pd) => {
        if (!pd) return;
        for (const q of pd.buffs || []) if (q && !q.dish && !q.item && q.name) q.item = name(q) || undefined;
      };
      fix(d.player);
      for (const c of (d.party && d.party.chars) || []) fix(Array.isArray(c) ? c[1] && c[1].player : c && c.player);
      log.push('Effects on you now show as pictures.');
    },
    game(game, log) {
      log.push('The shops have instruments, pipes and blank scrolls in; the cooks have recipes to sell.');
    },
    town(L) {
      // The new goods in the shops that deal in them (the shops only get
      // their stock when a town's first laid out).
      const e = L.econ;
      for (const r of L.npcs) {
        if (!alive(r)) continue;
        const t = traderOf(r);
        const b = r.work && r.work.building != null ? e.biz[r.work.building] : null;
        if (!b || !t) continue;
        for (const k of NEW_STOCK[t] || []) if (!b.store[k]) b.store[k] = 1 + (k.length % 2);
      }
      // A recipe on a scroll at the kitchen, from its cook's own.
      const k = kitchenOf(L);
      const cook = L.npcs.find((r) => alive(r) && (r.job === 'cook' || r.job === 'innkeeper') && (r.recipes || []).length);
      if (k && cook) k.store[`recipe~${cook.recipes[0].key}`] = 1;
    },
  },
];
// (What each kind of shop took in, in 0.51.)
const NEW_STOCK = { general: ['lute', 'flute', 'pipe', 'scroll'], carpenter: ['lyre', 'fiddle', 'hand_drum'], trapper: ['hunting_horn'] };

// The steps a world saved in version `gv` still needs, in order.
export function stepsFor(gv) {
  return STEPS.filter((s) => compareVersions(gv || null, s.to) < 0 && compareVersions(s.to, GAME_VERSION) <= 0);
}

// The save itself, brought up (in place): its data steps run, and the
// versions whose world and town steps are still to run noted in it
// (`pending`: run when it's loaded, see runMigrations). Returns { log,
// pending, from }.
export function migrateSave(d) {
  const from = d.gv || null;
  const log = [];
  const steps = stepsFor(from);
  for (const s of steps) {
    try {
      s.data?.(d, log);
    } catch (e) {
      log.push(`(${s.to}: ${e && e.message ? e.message : e})`);
    }
  }
  const pending = [...new Set([...(d.pending || []), ...steps.filter((s) => s.game || s.town).map((s) => s.to)])];
  d.pending = pending;
  d.gv = GAME_VERSION;
  return { log, pending, from };
}

// A loaded world: the steps it still needs run on it (and kept on its
// sim, so each town gets its own as it's laid out: see townMigrations).
export function runMigrations(game, pending) {
  const log = [];
  if (!pending || !pending.length) return log;
  const sim = game.sim;
  sim.migrate = [...new Set([...(sim.migrate || []), ...pending])];
  for (const v of pending) {
    const s = STEPS.find((q) => q.to === v);
    try {
      s?.game?.(game, log);
    } catch (e) {
      log.push(`(${v}: ${e && e.message ? e.message : e})`);
    }
  }
  // (Towns already laid out: theirs now.)
  for (const L of game.world.layouts.values()) if (L.econ) townMigrations(sim, L, !L.freshAttach);
  return log;
}

// A town laid out (see Sim.attach): any step it hasn't had yet. (One made
// fresh, never saved, already has everything new: only marked.)
export function townMigrations(sim, L, saved) {
  const pend = sim.migrate || [];
  if (!pend.length || !L.econ) return;
  L.econ.migrated ||= [];
  for (const v of pend) {
    if (L.econ.migrated.includes(v)) continue;
    L.econ.migrated.push(v);
    if (!saved) continue;
    const s = STEPS.find((q) => q.to === v);
    try {
      s?.town?.(L, sim.game);
    } catch {
      // (A town that won't take it is left as it was.)
    }
  }
}

export { PANTRY };
