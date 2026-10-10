// (Round 79) The stories' director: when new stories start, by how hard
// things have been lately.
//
// Everything that happens is weighed as it's heard (a raid, a battle, a
// death, someone playing taken or killed weigh heavy; a festival, a peace
// made, light). The weight cools a little each day. Out of it, each day,
// a mood:
//   - quiet: just after something hard (a raid, a war come ashore). For a
//     few days the hard stories mostly hold off, and fewer new ones start
//     at all: a stretch to catch your breath.
//   - rising: when it's been quiet a good while. More start, and the hard
//     ones aren't held back.
//   - steady: between.
// Each day's new stories (those that start out of how things stand, not
// those that answer something that just happened) come in a number drawn
// for the day by the mood, and the stories looked at in a shuffled order:
// chance as well as direction, so no two worlds go the same way. Now and
// then a day's a wild one, the mood ignored.
//
// And after a loss (someone playing killed, taken, robbed by a raid on
// their town, a story they had a hand in gone badly), an opening: a day or
// two later a stroke of luck comes their way (see motifs/fortune.js).
//
// What it decides, and why, goes in the stories' trace (see the story
// debugger: ui/storydebug.js).

// How hard each kind of story is (the rest are neither).
const HARD = new Set([
  'grudge', 'legend', 'stronghold', 'outlaw_work', 'den', 'alpha', 'captive', 'reclaim', 'murder', 'thief', 'smuggle', 'infiltrator', 'vendetta',
  'feud', 'fever', 'runaway', 'challenge', 'war_orders', 'spy', 'pow', 'pretender', 'plea', 'taken_at_sea', 'army_ashore', 'raider_bounty',
  'witch_hunt', 'honour_duel', 'strike', 'moneylender', 'swarm', 'haunting', 'ill_luck', 'refugees', 'shortage', 'missing', 'lost_child',
  'shipwreck', 'fallout',
]);
const CALM = new Set([
  'festival', 'tournament', 'bard_song', 'harvest', 'courtship', 'reconcile', 'homecoming', 'golden_wedding', 'prodigy', 'white_stag', 'stray',
  'falling_star', 'great_fish', 'pig_chase', 'barn_raising', 'venture', 'apprentice', 'treasure_map', 'expedition', 'academy', 'student',
  'pilgrim', 'relic', 'windfall', 'boon', 'trail',
]);
export function toneOf(M) {
  if (!M) return 'neutral';
  if (M.tone) return M.tone;
  return HARD.has(M.id) ? 'hard' : CALM.has(M.id) ? 'calm' : 'neutral';
}

// How hard an outcome went (for those who had a hand in it).
const BAD = /^(blood|death|dead|lost|ruined|burnt|raided|taken|usurped|crushed|betrayed|puppet|vanished|swindled|cheated|grief|gone|drowned|fled|plague|failed|cold)$/;
export const badOutcome = (o) => BAD.test(String(o || ''));

// The weight of what's happened.
function weigh(ev) {
  switch (ev.type) {
    case 'raid': return ev.won ? 6 : 3;
    case 'war_raid': return 6;
    case 'war_declared': return 4;
    case 'troops_landed': return 5;
    case 'eruption': return 5;
    case 'player_died': return 6;
    case 'captured': return 5;
    case 'riot': return 3;
    case 'famine': return 3;
    case 'ship_taken': return 3;
    case 'robbery': return 1.5;
    case 'sea_fight': return 2;
    case 'npc_died': return /kill|slain|murder|raid|bandit|beast|war|battle/i.test(String(ev.cause || '')) ? 2 : 0.4;
    case 'crime': return ev.sev === 'severe' ? 3 : 0.5;
    case 'saga_end': return badOutcome(ev.outcome) ? 1.5 : -0.5;
    case 'peace_made': return -1.5;
    case 'kill': return ev.hostile ? 0.05 : 0;
    default: return 0;
  }
}

export class Director {
  constructor(S) {
    this.S = S;
    this.heat = 0;
    this.mood = 'steady';
    this.moodUntil = 0;
    this.quiet = 0;
    this.budget = 2;
    this.made = 0;
    this.wild = false;
    this.biggest = null;
    // Openings owed, after a loss: [{ pid, at (day), why, sid, x, z }].
    this.owed = [];
  }

  // Something happened.
  observe(ev) {
    const w = weigh(ev);
    if (!w) return;
    this.heat = Math.max(0, this.heat + w);
    if (w >= 3 && (!this.biggest || w >= this.biggest.w || this.S.day - this.biggest.day > 3)) this.biggest = { w, what: ev.type, day: this.S.day };
    // A loss for someone playing: an opening owed them.
    const S = this.S;
    let pid = null;
    let why = null;
    if (ev.type === 'player_died') [pid, why] = [ev.pid, 'death'];
    else if (ev.type === 'captured' && ev.pid) [pid, why] = [ev.pid, 'captured'];
    else if (ev.type === 'saga_end' && badOutcome(ev.outcome) && (ev.touched || []).length) [pid, why] = [ev.touched[0], 'story'];
    else if ((ev.type === 'raid' && ev.won) || ev.type === 'war_raid') {
      for (const { p, pid: q } of S.players()) {
        const s = S.game.world.ow.settlementAt(p.x, p.z);
        if (s && s.id === ev.sid) [pid, why] = [q, 'raid'];
      }
    }
    if (pid && !this.owed.some((o) => o.pid === pid)) {
      this.owed.push({ pid, at: S.day + 1, why });
      this.trace(`a loss for ${S.person(pid).name || pid} (${why}): an opening owed in a day or two`);
    }
  }

  // A new day: cooled, the mood for it, how many may start.
  newDay(d, rng) {
    const S = this.S;
    this.heat *= 0.62;
    if (this.heat < 0.05) this.heat = 0;
    this.quiet = this.heat < 1.5 ? this.quiet + 1 : 0;
    const was = this.mood;
    if (this.heat >= 7 && this.mood !== 'quiet') {
      this.mood = 'quiet';
      this.moodUntil = d + rng.int(2, 4);
    } else if (this.mood === 'quiet' && d < this.moodUntil) {
      // (Still catching its breath.)
    } else if (this.quiet >= 4) this.mood = 'rising';
    else this.mood = 'steady';
    this.wild = rng.chance(0.12);
    const [lo, hi] = { quiet: [0, 1], steady: [1, 3], rising: [2, 4] }[this.mood];
    this.budget = rng.int(lo, hi) + (this.wild ? 1 : 0);
    this.made = 0;
    if (was !== this.mood) this.trace(this.mood === 'quiet' ? `a quiet stretch after ${this.biggest ? this.biggest.what.replace(/_/g, ' ') : 'hard days'} (till day ${this.moodUntil})` : this.mood === 'rising' ? `it's been quiet ${this.quiet} days: things may stir` : 'back to the usual');
    this.trace(`day ${d}: mood ${this.mood}${this.wild ? ' (a wild day)' : ''}, heat ${this.heat.toFixed(1)}, up to ${this.budget} new`);
    // Openings come due.
    for (const o of [...this.owed]) {
      if (d < o.at) continue;
      this.owed.splice(this.owed.indexOf(o), 1);
      const th = S.startStory?.('boon', { vars: { pid: o.pid, why: o.why }, touched: [o.pid] });
      this.trace(th ? `an opening for ${S.person(o.pid).name || o.pid} after ${o.why}: ${th.title}` : `no room for an opening for ${o.pid}`);
    }
  }

  // May a story of this kind start today (from how things stand)?
  allows(M, rng) {
    if (this.made >= this.budget) return false;
    if (this.wild) return true;
    const tone = toneOf(M);
    if (tone === 'hard' && this.mood === 'quiet' && !rng.chance(0.12)) return false;
    if (tone === 'calm' && this.mood === 'rising' && !rng.chance(0.6)) return false;
    return true;
  }

  begun(M, th) {
    this.made++;
    if (th) this.trace(`started ${th.title} (${toneOf(M)}, ${this.mood})`);
  }

  trace(text) {
    this.S.trace?.('director', text);
  }

  save() {
    return { heat: this.heat, mood: this.mood, moodUntil: this.moodUntil, quiet: this.quiet, owed: this.owed, biggest: this.biggest };
  }

  load(d) {
    if (!d) return;
    this.heat = d.heat || 0;
    this.mood = d.mood || 'steady';
    this.moodUntil = d.moodUntil || 0;
    this.quiet = d.quiet || 0;
    this.owed = d.owed || [];
    this.biggest = d.biggest || null;
  }
}
