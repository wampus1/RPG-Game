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
import { cookDish, parseDish } from '../world/dishes.js';
import { invAdd, invCount, kitchenOf, alive, traderOf } from '../sim/econ.js';
import { ITEMS } from '../world/items.js';
import { B } from '../world/blocks.js';
import { REGION_W, REGION_D } from '../config.js';

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
  {
    // The world's stories (see sim/saga): what's already afoot in an older
    // world taken up as stories of their own.
    to: '0.52.0',
    data(d, log) {
      log.push('The world\'s stories begin.');
    },
    game(game, log) {
      const S = game.sim.saga;
      if (!S) return;
      // Outlaws you've already brought down: they remember you.
      const heads = game.sim.bandits ? game.sim.bandits.heads || {} : {};
      let n = 0;
      for (const [band, k] of Object.entries(heads)) {
        n += k;
        S.count(`heads:${band}:pl:host`, k);
      }
      if (n) S.person('host').under += n;
      // A band with a price on its head: whoever posted it is asking for
      // help with it.
      let pleas = 0;
      for (const L of game.world.layouts.values()) {
        if (!L.econ) continue;
        for (const b of L.econ.bounties || []) {
          const band = game.sim.bandits.get(b.band);
          const m = L.npcs.find((r) => alive(r) && r.job === 'mayor');
          if (!band || !m) continue;
          if (S.begin('plea', { cast: { giver: { t: 'rec', sid: L.settlement.id, idx: m.idx }, threat: { t: 'band', id: band.id }, town: { t: 'town', sid: L.settlement.id } }, sid: L.settlement.id, vars: { how: 'raided', delay: 10 } })) pleas++;
        }
      }
      log.push(`The world's stories have begun${pleas ? `: ${pleas} town${pleas > 1 ? 's' : ''} asking for help with outlaws already` : ''}. (Quest log: O)`);
    },
  },
  {
    // Dishes that answer what you do, and make things happen (see
    // game/dishacts.js). The dishes already cooked keep what they did;
    // each kitchen puts up one of the new sort for sale.
    to: '0.53.0',
    data(d, log) {
      // (A dish's own bookkeeping, from before there was any: started clean.)
      if (d.player) for (const k of ['dishState', 'dishTemp', 'sheepT', 'rootT', 'hiccups']) delete d.player[k];
      log.push('Dishes can now set things off: lightning, little blasts, storms, a spell as a sheep...');
    },
    town(L) {
      const k = kitchenOf(L);
      if (!k || !k.store) return;
      const r = Math.random;
      for (let i = 0; i < 30; i++) {
        const ings = [];
        while (ings.length < 2 + Math.floor(r() * 2)) ings.push(PANTRY[Math.floor(r() * PANTRY.length)]);
        const key = cookDish(ings, 'p', 0.6 + r() * 0.4, r);
        const D = parseDish(key);
        if (!D || !(D.trig || D.fx.some((f) => f.i === 3))) continue;
        k.store[key] = (k.store[key] || 0) + 1;
        return;
      }
    },
  },
  {
    // Story upon story (see sim/saga/motifs): courtships and weddings, the
    // Academy, festivals, wonders, troubles; stories that run into each
    // other and go their own ways. And a room to let at every tavern.
    to: '0.54.0',
    data(d, log) {
      log.push('Many more stories: courtships, festivals, ventures, wonders, troubles, and an Academy in the cities.');
    },
    game(game, log) {
      const cities = [...game.world.layouts.values()].filter((L) => L.econ && L.settlement && L.settlement.type === 'city').length;
      log.push(`Taverns have a room to let (ask the innkeeper or the barkeep).${cities ? ' The cities will each raise an Academy.' : ''}`);
    },
    town(L, game) {
      // The tavern's room: in a part of town that's been changed since (and
      // so kept as it was), its walls, door and beds put in now (or when
      // that ground's next loaded).
      const w = game && game.world;
      const sim = game && game.sim;
      if (!w || !sim || !sim.setBlocks) return;
      for (const b of L.buildings) {
        if (b.type !== 'tavern' || !b.inn || !b.inn.blocks || b.underConstruction) continue;
        const bed = b.inn.beds[0];
        const key = w.regionKey(Math.floor(bed.x / REGION_W), Math.floor(bed.z / REGION_D));
        const loaded = w.regionAt(bed.x, bed.z);
        const kept = w.saved && w.saved.has(key);
        if (loaded ? w.getBlock(bed.x, b.inn.y, bed.z) === B.bed : !kept) continue;
        sim.setBlocks(b.inn.blocks.map(([x, y, z, id, meta]) => [x, y, z, id, meta]));
      }
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
