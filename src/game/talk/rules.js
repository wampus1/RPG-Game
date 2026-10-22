// (Round 135) What someone says, chosen by what's so (see talk/facts.js),
// the way a well-read stage manager might: of all the lines written for
// the moment (talk/lines.js), those whose conditions all hold; of those,
// the most particular (the more that has to be so for a line to fit, the
// more it's about just this moment); and of those, one not said to you
// lately.
//
// A rule: { id, topic, when: { fact: want, ... }, lines: [...], cd?, once?,
// w? }. `want` is a value (the fact must be it), true or false (the fact
// must be, or mustn't), a list (any of them), { min, max } (a number
// between), or a test (fact, facts) => true. `cd`: days before it's said to
// you again (3, unless said); `once`: said to you once, ever. Lines may
// name things ({name}, {town}, {dead}... see facts.vars); a line whose
// names can't all be filled isn't used. They may carry marks for how
// they're said (see ui/textfx.js).
import { RULES } from './lines.js';

const KEY_W = { kid: 0.25, met: 0.25, indoors: 0.25, op: 0.5, opBand: 0.5, elder: 0.5, partnered: 0.5, parent: 0.5, job: 0.75, feel: 0.75 };
const FEELS = new Set(['joy', 'grief', 'fear', 'anger', 'shame', 'pride', 'love', 'strain']);
const BY_TOPIC = new Map();
function compile() {
  if (BY_TOPIC.size) return;
  for (const r of RULES) {
    const keys = Object.keys(r.when || {});
    // (How particular: a feeling, a trait or a state counts one; a memory
    // more, it's about this person; the guards that only keep a line from
    // the wrong mouth, less.)
    r.spec = keys.reduce((a, k) => a + (KEY_W[k] ?? (/^(mem_|heard_|memPk|heardPk|memP|heardP)/.test(k) ? 1.5 : 1)), 0) + (r.bonus || 0);
    r.keys = keys;
    if (!BY_TOPIC.has(r.topic)) BY_TOPIC.set(r.topic, []);
    BY_TOPIC.get(r.topic).push(r);
  }
  for (const list of BY_TOPIC.values()) list.sort((a, b) => b.spec - a.spec);
}

function holds(want, have, F) {
  if (typeof want === 'function') return !!want(have, F);
  if (want === true) return !!have;
  if (want === false) return !have;
  if (Array.isArray(want)) return want.includes(have);
  if (want && typeof want === 'object') return typeof have === 'number' && (want.min === undefined || have >= want.min) && (want.max === undefined || have <= want.max);
  return have === want;
}

export function matches(r, F) {
  for (const k of r.keys) if (!holds(r.when[k], F[k], F)) return false;
  return true;
}

// A line's names filled in, or null if one can't be.
export function fill(line, vars) {
  let ok = true;
  const out = line.replace(/\{([A-Za-z]+)\}/g, (all, k) => {
    const v = vars[k] ?? vars[k[0].toLowerCase() + k.slice(1)];
    if (v === null || v === undefined || v === '') {
      ok = false;
      return '';
    }
    return /^[A-Z]/.test(k) ? String(v)[0].toUpperCase() + String(v).slice(1) : String(v);
  });
  return ok ? out : null;
}

// What they'd say, for `topic` (or null if nothing written fits well
// enough): `min`, how particular a line must be to be worth saying over
// the usual (see dialogue.js); `rng` the speaker's own; `said`, where
// what's been said to you is kept (the player's record with them).
export function choose(topic, F, rng, said = null, min = 1) {
  compile();
  const list = BY_TOPIC.get(topic);
  if (!list) return null;
  const day = F.game.day;
  const recent = said && said.lines ? said.lines : null;
  // (Each that fits, scored: how particular it is, and how strongly the
  // feelings it's written for are felt: grief at its worst outweighs a
  // passing pride.)
  let best = -1;
  const fits = [];
  for (const r of list) {
    if (r.spec < min) break;
    if (!matches(r, F)) continue;
    const last = recent ? recent.find((q) => q[0] === r.id) : null;
    if (last && (r.once || day - last[1] < (r.cd ?? 3))) continue;
    let sc = r.spec;
    for (const k of r.keys) if (FEELS.has(k)) sc += (F[k] || 0) * 1.5;
    fits.push([sc, r]);
    if (sc > best) best = sc;
  }
  const pool = fits.filter((q) => q[0] >= best - 0.3).map((q) => q[1]);
  if (!pool.length) return null;
  let tot = 0;
  for (const r of pool) tot += r.w ?? 1;
  let k = rng.next() * tot;
  let pick = pool[pool.length - 1];
  for (const r of pool) {
    k -= r.w ?? 1;
    if (k <= 0) {
      pick = r;
      break;
    }
  }
  // (A line of it whose names can all be filled.)
  const opts = pick.lines.slice();
  for (let n = opts.length; n > 0; n--) {
    const i = Math.floor(rng.next() * opts.length);
    const text = fill(opts[i], F.vars);
    if (text) {
      if (said) {
        said.lines = (said.lines || []).filter((q) => q[0] !== pick.id && day - q[1] < 30);
        said.lines.push([pick.id, day]);
        if (said.lines.length > 12) said.lines.shift();
      }
      return { text, rule: pick };
    }
    opts.splice(i, 1);
  }
  return null;
}

// Every rule written, for checking (see tests).
export function allRules() {
  compile();
  return RULES;
}
