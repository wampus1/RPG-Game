// The old places of each Dagoni island, as its own people made them (see
// dungeongen.js, which builds them, and dtypeOf there, which puts these
// together with the usual kinds):
//   On Kharos the barrows are heaped of ash over basalt and their dead
//     burn; its mines are cut through glass and fire; its crypts are
//     walled in black brick; its outlaws' dens are ash-raiders' holes.
//   On Myrrow the barrows are peat, and what's laid in them keeps; its
//     mines are the old peat cuttings, dripping; its crypts are walled in
//     moss; its outlaws are pearl pirates in the sea caves.
//   And each island has a kind of old place nobody else has:
//     Thessa's Wildwood Hollows, under the roots of the oldest trees;
//     Kharos's Kiln-Deeps, the forges of the old Kiln-Kings, still hot;
//     Myrrow's Tide Grottoes, sea caves the tide comes and goes in.
// Every master of every one of them is its island's own (none of Thessa's
// three to a kind is met anywhere else), and the far islands' masters are
// harder than Thessa's: see ISLE_BOSS_HP.
import { B } from './blocks.js';

// Where you begin (inside the storm wall, washed up on its beach).
export const HOME_ISLE = 'thessa';

// The usual kinds, as each of the far islands makes them: their stone,
// their dark, what drifts in it, what lives there (and who stands in for
// whom: `swap`), what's left lying about, and who rules them.
export const ISLE_DSTYLE = {
  kharos: {
    barrow: {
      name: 'Ash Barrow', wall: B.basalt, floor: B.ash, alt: B.cinder,
      mobs: [['skeleton', 3], ['ash_wraith', 3], ['cinderling', 2], ['slag_crab', 1]],
      swap: { wight: ['ash_wraith', 'skeleton'], ghoul: ['magma_slug', 'ash_wraith'] },
      decor: [['urn', 4], ['skull_pile', 2], ['rubble', 2], ['candles', 1], ['ash_brazier', 1]],
      dark: [0.1, 0.06, 0.045], motes: ['#c8502a', '#8a8484'], ambient: ['crackle', 'whisper', 'wind_low'],
      loot: [['sulfur', 1, 2, 0.4], ['obsidian_shard', 1, 2, 0.3], ['ember_pod', 1, 1, 0.2]],
    },
    mine: {
      name: 'Glass Mine', wall: B.basalt, floor: B.cinder, alt: B.obsidian, beam: B.log_cinder,
      mobs: [['slag_crab', 3], ['cinderling', 2], ['magma_slug', 2], ['glasshide', 1], ['rat', 1]],
      swap: { crawler: ['slag_crab', 'glasshide'], moth: ['cinderling'], slime: ['magma_slug'] },
      decor: [['stalagmite', 3], ['mine_cart', 2], ['rubble', 3], ['powder_keg', 1], ['ash_brazier', 1]],
      dark: [0.11, 0.065, 0.04], motes: ['#ff8a3a', '#6a5a50'], ambient: ['rumble', 'crackle', 'tink'],
      loot: [['obsidian_shard', 1, 3, 0.5], ['sulfur', 1, 3, 0.4], ['glass', 1, 2, 0.3]],
    },
    crypt: {
      name: 'Glass Crypt', wall: B.basalt_bricks, floor: B.obsidian, alt: B.basalt, pool: B.lava,
      mobs: [['skeleton', 3], ['ash_wraith', 3], ['glasshide', 1], ['cinderling', 2]],
      swap: { drowned: ['ash_wraith', 'skeleton'], ghoul: ['ash_wraith'], wisp: ['cinderling'], wight: ['skeleton'] },
      decor: [['candles', 3], ['statue', 2], ['urn', 2], ['ash_brazier', 2], ['hanging_chains', 2]],
      dark: [0.09, 0.05, 0.07], motes: ['#c8a0ff', '#ff8040'], ambient: ['drone', 'chains', 'crackle'],
      loot: [['obsidian_shard', 1, 2, 0.4], ['glass', 1, 1, 0.25], ['obsidian_blade', 1, 1, 0.06]],
    },
    holdout: {
      name: 'Ash-Raider Den', wall: B.basalt, floor: B.ash, alt: B.scorched, beam: B.log_cinder,
      mobs: [['ash_raider', 4], ['ash_archer', 3], ['bombarder', 2], ['thief', 1], ['slag_crab', 1]],
      swap: { cutthroat: ['ash_raider'], holdout_archer: ['ash_archer'], wolf: ['slag_crab'], rat: ['slag_crab'] },
      decor: [['weapon_rack', 3], ['war_banner', 2], ['powder_keg', 3], ['ash_brazier', 2], ['rubble', 1]],
      dark: [0.11, 0.06, 0.045], motes: ['#8a8078', '#ff9030'], ambient: ['crackle', 'voices', 'creak'],
      loot: [['sulfur', 1, 3, 0.4], ['ash_goggles', 1, 1, 0.08], ['glass', 1, 2, 0.2]],
    },
  },
  myrrow: {
    barrow: {
      name: 'Bog Barrow', wall: B.peat, floor: B.mud, alt: B.moss,
      mobs: [['bog_body', 3], ['skeleton', 1], ['gloam_moth', 2], ['spore_puffer', 2], ['rat', 1]],
      swap: { wight: ['bog_body'], ghoul: ['bog_body', 'spore_puffer'], skeleton: ['bog_body', 'skeleton'] },
      decor: [['roots', 4], ['urn', 2], ['glowshroom', 3], ['rubble', 1]],
      dark: [0.05, 0.08, 0.06], motes: ['#9ab060', '#c8d8b0'], ambient: ['drip', 'whisper', 'frog'],
      loot: [['peat_turf', 1, 2, 0.4], ['moth_dust', 1, 2, 0.3], ['glowcap', 1, 2, 0.3]],
    },
    mine: {
      name: 'Peat Cutting', wall: B.peat, floor: B.mud, alt: B.mycelium, beam: B.log_mangrove,
      mobs: [['shroom_crawler', 2], ['spore_puffer', 3], ['rat', 2], ['gloam_moth', 2], ['bog_lurker', 1]],
      swap: { crawler: ['spore_puffer', 'shroom_brute'], moth: ['gloam_moth'], slime: ['spore_puffer'] },
      decor: [['glowshroom', 4], ['roots', 3], ['mine_cart', 1], ['rubble', 2]],
      dark: [0.05, 0.075, 0.065], motes: ['#b8e070', '#8aa060'], ambient: ['drip', 'skitter', 'drip'],
      loot: [['peat_turf', 2, 4, 0.5], ['glowcap', 1, 3, 0.4], ['spore_tincture', 1, 1, 0.12]],
    },
    crypt: {
      name: 'Mist Crypt', wall: B.mossy_bricks, floor: B.moss, alt: B.crypt_floor,
      mobs: [['drowned', 3], ['bog_body', 2], ['wisp', 2], ['lantern_thief', 1], ['gloam_moth', 1]],
      swap: { skeleton: ['bog_body', 'drowned'], ghoul: ['bog_body'], wight: ['drowned'] },
      decor: [['candles', 3], ['statue', 2], ['roots', 2], ['glowshroom', 2], ['hanging_chains', 1]],
      dark: [0.05, 0.07, 0.085], motes: ['#a0d8c8', '#e0fff0'], ambient: ['drip', 'whisper', 'drone'],
      loot: [['glowcap', 1, 2, 0.3], ['spore_tincture', 1, 1, 0.1], ['lantern', 1, 1, 0.15]],
    },
    holdout: {
      name: 'Pirates\' Cove', wall: B.coral_rock, floor: B.shell_sand, alt: B.planks_dark, beam: B.log_mangrove,
      mobs: [['reef_raider', 4], ['reef_archer', 3], ['thief', 2], ['reef_crab', 2]],
      swap: { cutthroat: ['reef_raider'], holdout_archer: ['reef_archer'], wolf: ['reef_crab'], rat: ['reef_crab'], bombarder: ['reef_raider'] },
      decor: [['barrel', 3], ['war_banner', 1], ['weapon_rack', 2], ['kelp', 2], ['powder_keg', 1]],
      dark: [0.045, 0.07, 0.09], motes: ['#8ac8d8', '#e0f4ff'], ambient: ['drip', 'wave', 'voices'],
      loot: [['pearl', 1, 2, 0.35], ['crab_meat', 1, 2, 0.3], ['pearl_necklace', 1, 1, 0.06]],
    },
  },
};

// Each island's own kind of old place.
export const ISLE_DTYPES = {
  // Under the roots of the oldest trees on Thessa: chambers like hollow
  // trunks, rooted walls, moss and glowcaps, briars, springs; what lives
  // in the wood lives down there, and some of it bigger.
  grove: {
    name: 'Wildwood Hollow', isle: 'thessa', wall: B.root_wall, floor: B.moss, alt: B.dirt, beam: null, regions: [2, 2], floors: [1, 3],
    kits: ['glade', 'thicket', 'burrow', 'spring', 'glade', 'thicket', 'collapsed', 'shrine', 'trap', 'treasure'],
    mobs: [['thornling', 4], ['wolf', 2], ['moth', 2], ['wisp', 2], ['crawler', 1]],
    swap: { skeleton: ['thornling'], wight: ['thornling'], drowned: ['thornling'], ghoul: ['wolf'] },
    bosses: ['thorn_queen', 'elder_stag', 'hollow_oak'], torches: 0.08,
    shapes: { round: 4, cave: 4, ell: 1 }, wiggle: 1.2, decor: [['roots', 4], ['glowshroom', 3], ['briar', 2], ['stalagmite', 1]],
    dark: [0.06, 0.09, 0.05], motes: ['#c8f080', '#f0ffc0'], ambient: ['wind_low', 'owl', 'drip', 'whisper'],
    loot: [['herb', 1, 3, 0.5], ['berries', 1, 3, 0.4], ['mushroom', 1, 2, 0.3], ['longbow', 1, 1, 0.05]],
  },
  // The forges of the old Kiln-Kings of Kharos, dug into the mountain:
  // halls of basalt brick, slag underfoot, channels of lava let through
  // them still, anvils, crucibles; the old smiths' work still walking.
  forge: {
    name: 'Kiln-Deep', isle: 'kharos', wall: B.forge_brick, floor: B.slag, alt: B.basalt, beam: null, regions: [2, 2], floors: [1, 3], pool: B.lava,
    kits: ['smelter', 'anvils', 'slagheap', 'cooling', 'smelter', 'anvils', 'pillared', 'guard', 'trap', 'treasure'],
    mobs: [['slag_crab', 3], ['cinderling', 2], ['magma_slug', 2], ['glasshide', 1], ['forge_hound', 2]],
    swap: { skeleton: ['forge_hound', 'cinderling'], wight: ['glasshide'], ghoul: ['magma_slug'], drowned: ['magma_slug'], crawler: ['slag_crab'] },
    bosses: ['kiln_king', 'slag_titan', 'molten_heart'], torches: 0.4,
    shapes: { rect: 4, octagon: 2, cross: 1 }, wiggle: 0, decor: [['anvil', 2], ['crucible', 2], ['ash_brazier', 2], ['hanging_chains', 2], ['rubble', 1]],
    dark: [0.13, 0.07, 0.04], motes: ['#ffb040', '#ff6020'], ambient: ['crackle', 'tink', 'rumble', 'hiss'],
    loot: [['iron_ingot', 1, 3, 0.5], ['obsidian_shard', 1, 3, 0.4], ['gold_ingot', 1, 1, 0.15], ['obsidian_blade', 1, 1, 0.08]],
  },
  // Sea caves on Myrrow's coast that the tide comes into and goes out of:
  // coral on the rock, shell sand, pools left behind, kelp; the wrecks of
  // boats that came in after pearls and never went out.
  grotto: {
    name: 'Tide Grotto', isle: 'myrrow', wall: B.coral_rock, floor: B.shell_sand, alt: B.sand, beam: null, regions: [2, 2], floors: [1, 3],
    kits: ['tidepool', 'reef', 'wreck', 'pearlbed', 'tidepool', 'reef', 'collapsed', 'shrine', 'trap', 'treasure'],
    mobs: [['reef_crab', 4], ['drowned', 2], ['bog_lurker', 1], ['spore_puffer', 1], ['gloam_moth', 1]],
    swap: { skeleton: ['drowned', 'reef_crab'], wight: ['drowned'], ghoul: ['reef_crab'], crawler: ['reef_crab'], slime: ['reef_crab'] },
    bosses: ['tide_mother', 'abyssal_clam', 'coral_colossus'], torches: 0.05,
    shapes: { cave: 6, round: 2 }, wiggle: 1.4, decor: [['coral', 4], ['kelp', 3], ['giant_clam', 1], ['rubble', 1]],
    dark: [0.04, 0.08, 0.1], motes: ['#80d8e8', '#e0ffff'], ambient: ['drip', 'wave', 'drip', 'splash'],
    loot: [['pearl', 1, 3, 0.5], ['crab_meat', 1, 2, 0.3], ['pearl_necklace', 1, 1, 0.08], ['coral', 1, 2, 0.3]],
  },
};
export const OWN_TYPE = { thessa: 'grove', kharos: 'forge', myrrow: 'grotto' };

// The masters of the far islands' old places, three to a kind (one picked
// for each place): see bosses_kharos.js and bosses_myrrow.js.
export const ISLE_BOSSES = {
  kharos: {
    barrow: ['cinder_king', 'urn_mother', 'smoke_herald'],
    mine: ['glass_wyrm', 'magma_tender', 'bellows_golem'],
    crypt: ['obsidian_abbess', 'kiln_priest', 'vitrified_horror'],
    holdout: ['ash_reaver', 'bombard_queen', 'chained_drake'],
  },
  myrrow: {
    barrow: ['bog_king', 'moth_mother', 'willow_wight'],
    mine: ['spore_colossus', 'lamprey_queen', 'gas_bloat'],
    crypt: ['lantern_lord', 'hollow_king', 'drowned_choir'],
    holdout: ['sharktooth', 'pearl_queen', 'smugglers_kraken'],
  },
};

// The far islands' masters, harder than Thessa's: their health, their
// blows, and their pace (ISLE_BOSS_TEMPO: how much quicker their works
// come round, their breath between attacks and their blows land; and
// they open with more of what they have, rather than feel you out).
export const ISLE_BOSS_HP = { kharos: 1.25, myrrow: 1.25 };
export const ISLE_BOSS_DMG = { kharos: 1.15, myrrow: 1.15 };
export const ISLE_BOSS_TEMPO = { kharos: 1.3, myrrow: 1.3 };

// Adventurers leave the far islands' old places alone a good while (time
// for you to get there first): not before this day, nor till you've had
// some days on the island yourself (or a long while has gone by).
export const FAR_DELVE_DAY = 40;
export const FAR_DELVE_GRACE = 10;
export const FAR_DELVE_LATEST = 90;

// What an island's own old place is called after (its founders, its
// wrecks), and how folk there speak of one.
export const ISLE_TYPE_LORE = {
  grove: {
    who: ['the Green Lady', 'the Oak-Father', 'the Antlered One', 'the Briar Maid', 'Old Hob of the Wood'],
    name: (who) => `the Hollow of ${who}`,
    text: (y, who, where, tn) => `In ${y}, ${tn ? `the folk of ${tn}` : 'the woodfolk'} stopped going into the old wood ${where}: there's a hollow under the roots there, they say, that belongs to ${who}, and what goes in is kept.`,
    short: (who, where) => `There's a hollow under the roots of the old wood ${where} that belongs to ${who}.`,
    rumour: (d, where) => [`Don't go into the old wood ${where}. ${cap(d.name)}'s under it, and the trees down there walk.`, `There's a hollow under the oldest trees ${where}. ${d.origin.short} My gran left milk out for it.`],
  },
  forge: {
    who: ['the Kiln-King Azkar', 'the Smith-Queen Pyrrha', 'Old Tephros the Founder', 'the Bellows-Lord Kharn'],
    name: (who) => `the Kiln-Deep of ${who}`,
    text: (y, who, where, tn) => `In ${y}, ${who} sealed the great forge under the mountain ${where} with their smiths still inside, so no lesser hand should ever work its fires. ${tn ? `${tn} still hears the hammers on still nights.` : 'The hammers are still heard.'}`,
    short: (who, where) => `${cap(who)} sealed their great forge ${where} with the smiths still in it.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. The fires down there never went out. Neither did the smiths.`, `You can feel the heat of ${d.name} through the ground ${where}. ${d.origin.short}`],
  },
  grotto: {
    who: ['the Pearl-Queen Kailani', 'Makoa Sharktooth', 'the Tide-Chief Nalu', 'Old Reva Netmender', 'the Drowned Fleet'],
    name: (who) => `the Grotto of ${who}`,
    text: (y, who, where, tn) => `In ${y}, ${who} went into the sea caves ${where} after the great pearl beds, and the tide came in behind them. ${tn ? `The stilt folk of ${tn}` : 'The stilt folk'} won't dive there now.`,
    short: (who, where) => `${cap(who)} went into the sea caves ${where} after pearls, and the tide shut them in.`,
    rumour: (d, where) => [`${cap(d.name)}, ${where}. The tide goes in and out of it twice a day, and so do things nobody's seen the whole of.`, `The pearl beds in the grotto ${where} are the best on Myrrow. ${d.origin.short}`],
  },
};

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
