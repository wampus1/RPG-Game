// How practised you are at the fine work: angling, setting stones, study at
// the desk, picking locks. Each success counts toward the next rank (1 to
// 10), and the work changes as you rise: rarer and fiercer fish bite, the
// settings get fiddlier, the problems on the desk harder (and pay better),
// your hands steadier at a lock. (Kept with your other records.)
export const CRAFTS = {
  fishing: { name: 'Angling', rank: ['Novice', 'Dabbler', 'Angler', 'Angler', 'Fisher', 'Fisher', 'Old Hand', 'Old Hand', 'Master Angler', 'Legend of the Water'] },
  setting: { name: 'Gem setting', rank: ['Novice', 'Apprentice', 'Apprentice', 'Setter', 'Setter', 'Journeyman', 'Journeyman', 'Fine Setter', 'Master Setter', 'Master Jeweller'] },
  study: { name: 'Study', rank: ['Novice', 'Student', 'Student', 'Scholar', 'Scholar', 'Learned', 'Learned', 'Sage', 'Sage', 'Luminary'] },
  lockpick: { name: 'Lockpicking', rank: ['Fumbler', 'Fumbler', 'Picker', 'Picker', 'Lockpick', 'Lockpick', 'Cracksman', 'Cracksman', 'Master Thief', 'Ghost'] },
  // (Round 54: taught at a city's Academy, and learnt at the pot and in
  // a fight. Cooking: every dish comes out a little better, rank on rank;
  // dueling: a parry's moment a little longer.)
  cooking: { name: 'Cookery', rank: ['Scorcher', 'Kitchen Hand', 'Kitchen Hand', 'Cook', 'Cook', 'Good Cook', 'Good Cook', 'Chef', 'Chef', 'Master Chef'] },
  dueling: { name: 'Swordplay', rank: ['Flailer', 'Novice', 'Novice', 'Fencer', 'Fencer', 'Duellist', 'Duellist', 'Blademaster', 'Blademaster', 'Sword Saint'] },
};

// (Round 54) What a rank in these is worth: a dish's cooking nudged up; a
// parry's window widened (seconds).
export const cookBonus = (game) => (mastery(game, 'cooking').rank - 1) * 0.02;
export const parryBonusOf = (game) => (mastery(game, 'dueling').rank - 1) * 0.008;
// Successes needed for each rank.
export const RANKS = [0, 3, 8, 15, 25, 40, 60, 85, 115, 150];

export function mastery(game, key) {
  const m = (game.stats ||= {}).mastery || {};
  const xp = m[key] || 0;
  let rank = 1;
  while (rank < RANKS.length && xp >= RANKS[rank]) rank++;
  const lo = RANKS[rank - 1];
  const hi = RANKS[rank] ?? null;
  return { xp, rank, title: CRAFTS[key]?.rank[rank - 1] || '', frac: hi === null ? 1 : (xp - lo) / (hi - lo) };
}

// A success (worth `n`): true if it brought you up a rank.
export function gainMastery(game, key, n = 1) {
  const before = mastery(game, key).rank;
  const m = ((game.stats ||= {}).mastery ||= {});
  m[key] = (m[key] || 0) + n;
  const now = mastery(game, key);
  if (now.rank > before) {
    game.ui?.msg?.(`${CRAFTS[key].name}: rank ${now.rank}, ${now.title}! The work will ask more of you now, and give more.`, '#ffe070', true);
    game.audio?.play('fanfare');
    return true;
  }
  return false;
}

// "Rank 3 · Angler" and a little bar to the next.
export function rankText(game, key, w = 8) {
  const m = mastery(game, key);
  const n = Math.round(m.frac * w);
  return `Rank ${m.rank} ${m.title} ${'■'.repeat(n)}${'·'.repeat(w - n)}`;
}
