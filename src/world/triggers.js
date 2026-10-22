// (Round 137) Triggers and abilities: what a forged piece can carry besides
// its modifiers (see world/quality.js, game/smithing.js).
//   A trigger is something that happens to you, or that you do (you're
// struck, you land a telling blow, you fall below half your health, night
// falls). Each trigger on a piece is bound to one thing it sets off:
//   - one of the piece's own modifiers, which then works for a while
//     after (a keen edge for twelve seconds after you're struck), or
//   - an ability: something seen and heard (a ring of healing light about
//     you, a meteor called down on a foe, lightning leaping foe to foe).
// Some triggers come often (a blow landed), some seldom (a perfect parry),
// some hardly ever (a blow that would have killed you).
//   Written into a piece's key, after its modifiers, as "<what>-<trigger>"
// ("keen-struck", "halo-struck"): see quality.js. At an anvil what each
// trigger sets off can be changed round, for a price (see game/rebind.js);
// what the piece has, never.
//   (Plain data: what each does in play is game/abilities.js; how it looks,
// render/abilityfx.js.)

// How often a trigger comes, in words, by its `rate`.
export const RATES = {
  often: { name: 'often', color: '#90e890' },
  sometimes: { name: 'now and then', color: '#e8d070' },
  seldom: { name: 'seldom', color: '#f0a060' },
  rarely: { name: 'rarely', color: '#e07070' },
};

// Which kinds of gear a trigger can be on (where what sets it off happens).
const ANY = ['blade', 'bow', 'shield', 'armor', 'tool'];
const ARMS = ['blade', 'bow'];
const FIGHT = ['blade', 'bow', 'shield', 'armor'];

// Each trigger: `when` (how it reads: "when ..."), its trait's name (a
// material's nature: "of the night"), `rate`, `chance` (each time what
// sets it off happens), how long a modifier it sets off works after
// (`secs`; `hold`: as long as that holds instead: night, the old places),
// and the gear it goes on.
export const TRIGGERS = {
  // Often.
  struck: { when: 'you\'re struck', trait: 'battle-born', rate: 'often', chance: 0.3, secs: 12, gear: ANY },
  hit: { when: 'you land a blow', trait: 'eager', rate: 'often', chance: 0.18, secs: 10, gear: ARMS },
  tumble: { when: 'you roll', trait: 'nimble', rate: 'often', chance: 0.35, secs: 10, gear: ANY },
  block: { when: 'your shield takes a blow', trait: 'unbowed', rate: 'often', chance: 0.4, secs: 12, gear: ['shield'] },
  draw: { when: 'you loose a full-drawn arrow', trait: 'taut', rate: 'often', chance: 0.4, secs: 10, gear: ['bow'] },
  mine: { when: 'you break a block', trait: 'delving', rate: 'often', chance: 0.08, secs: 12, gear: ['tool'] },
  // Now and then.
  crit: { when: 'you land a telling blow', trait: 'true-striking', rate: 'sometimes', chance: 1, secs: 12, gear: ['blade'] },
  kill: { when: 'you bring a foe down', trait: 'wild', rate: 'sometimes', chance: 1, secs: 15, gear: ARMS },
  first: { when: 'you strike a foe that\'s still unhurt', trait: 'first-blooded', rate: 'sometimes', chance: 1, secs: 8, gear: ARMS },
  shot: { when: 'your arrow strikes from eight paces or more', trait: 'far-seeing', rate: 'sometimes', chance: 1, secs: 10, gear: ['bow'] },
  afflicted: { when: 'you\'re set alight, poisoned, frozen or cut to bleeding', trait: 'spiteful', rate: 'sometimes', chance: 1, secs: 12, gear: FIGHT },
  mend: { when: 'you\'re mended by three hearts or more at once', trait: 'grateful', rate: 'sometimes', chance: 1, secs: 15, gear: ANY },
  winded: { when: 'your breath runs out', trait: 'stubborn', rate: 'sometimes', chance: 1, secs: 10, gear: ANY },
  boss: { when: 'you strike a master of the old places', trait: 'giant-hating', rate: 'sometimes', chance: 0.25, secs: 10, gear: ARMS },
  ore: { when: 'you break ore out of the rock', trait: 'ore-hungry', rate: 'sometimes', chance: 1, secs: 20, gear: ['tool'] },
  fell: { when: 'you fell a tree', trait: 'woodsman\'s', rate: 'sometimes', chance: 1, secs: 20, gear: ['tool'] },
  // Seldom.
  parry: { when: 'you parry a blow', trait: 'deft-handed', rate: 'seldom', chance: 1, secs: 12, gear: ['shield', 'blade'] },
  dodge: { when: 'you roll clear of a blow', trait: 'elusive', rate: 'seldom', chance: 1, secs: 12, gear: ANY },
  bloodied: { when: 'you fall below half your health', trait: 'desperate', rate: 'seldom', chance: 1, secs: 15, gear: ANY },
  combo: { when: 'you land five blows in a row unhurt', trait: 'relentless', rate: 'seldom', chance: 1, secs: 12, gear: ['blade'] },
  mob: { when: 'you\'re struck with three foes or more about you', trait: 'cornered', rate: 'seldom', chance: 1, secs: 12, gear: FIGHT },
  fall: { when: 'you land from a long fall', trait: 'falling-star', rate: 'seldom', chance: 1, secs: 10, gear: ANY },
  soak: { when: 'you go into water', trait: 'of the water', rate: 'seldom', chance: 1, secs: 30, gear: ANY },
  // (Round 138) More of them.
  smash: { when: 'you land a heavy blow', trait: 'hammer-hearted', rate: 'sometimes', chance: 0.6, secs: 10, gear: ['blade'] },
  undead: { when: 'you strike one of the dead', trait: 'grave-hating', rate: 'sometimes', chance: 0.5, secs: 15, gear: ARMS },
  eat: { when: 'you eat', trait: 'hungry', rate: 'sometimes', chance: 1, secs: 20, gear: ANY },
  victory: { when: 'the last foe about you falls', trait: 'triumphant', rate: 'sometimes', chance: 1, secs: 20, gear: ANY },
  shotat: { when: 'you\'re struck from three paces off or more', trait: 'arrow-wary', rate: 'sometimes', chance: 0.6, secs: 12, gear: FIGHT },
  back: { when: 'you\'re struck from behind', trait: 'watchful', rate: 'seldom', chance: 1, secs: 12, gear: ['armor', 'shield'] },
  guardbreak: { when: 'your guard\'s broken', trait: 'unbreaking', rate: 'seldom', chance: 1, secs: 12, gear: ['shield'] },
  fish: { when: 'you land a fish', trait: 'sea-loving', rate: 'seldom', chance: 1, secs: 30, gear: ['armor', 'shield'] },
  oneshot: { when: 'you bring down an unhurt foe with a single blow', trait: 'deathly', rate: 'rarely', chance: 1, secs: 20, gear: ARMS },
  dawn: { when: 'day breaks (and a modifier works all day)', trait: 'of the dawn', rate: 'rarely', chance: 1, hold: 'day', gear: ANY },
  rain: { when: 'rain sets in (and a modifier works while it rains)', trait: 'storm-born', rate: 'rarely', chance: 1, hold: 'rain', gear: ANY },
  // Rarely.
  brink: { when: 'you fall below a fifth of your health', trait: 'last-ditch', rate: 'rarely', chance: 1, secs: 20, gear: ANY },
  streak: { when: 'you bring down three foes inside twelve seconds', trait: 'reaping', rate: 'rarely', chance: 1, secs: 20, gear: ARMS },
  deathblow: { when: 'a blow would kill you (you live, at one heart; once in five minutes)', trait: 'undying', rate: 'rarely', chance: 1, secs: 30, gear: ['armor', 'shield'] },
  dusk: { when: 'night falls (and a modifier works all night)', trait: 'of the night', rate: 'rarely', chance: 1, hold: 'night', gear: ANY },
  delve: { when: 'you go down into an old place (and a modifier works while you\'re there)', trait: 'of the deep', rate: 'rarely', chance: 1, hold: 'deep', gear: ANY },
};
export const TRIGGER_KEYS = Object.keys(TRIGGERS);

// Which kinds of gear an ability goes on.
const TOOLS = ['tool'];

// Each ability: its name, what it does (`about`), its trait's name, the
// trigger it's bound to when nothing in the work brings one (`trig`), how
// long before it can come again (`cd`, seconds), and the gear it goes on.
// (`foe`: it wants a foe about to do anything at all.)
export const ABILITIES = {
  halo: { name: 'Healing Aura', about: 'a ring of golden light about you for six seconds, mending you and those with you a heart each second', trait: 'radiant', trig: 'struck', cd: 24, gear: ANY, color: '#f0e080', pal: 'gold' },
  nova: { name: 'Flame Nova', about: 'a ring of fire bursts out of you, burning every foe within three paces', trait: 'blazing', trig: 'mob', cd: 12, gear: FIGHT, foe: true, color: '#ff8030', pal: 'fire' },
  glacier: { name: 'Glacial Spikes', about: 'spikes of ice burst up about you, freezing the nearest foe solid and chilling the rest', trait: 'glacial', trig: 'bloodied', cd: 14, gear: FIGHT, foe: true, color: '#a0e0ff', pal: 'ice' },
  chain: { name: 'Chain Lightning', about: 'lightning leaps from your foe to the next and the next, up to four of them', trait: 'storm-forged', trig: 'crit', cd: 10, gear: FIGHT, foe: true, color: '#c8d8ff', pal: 'storm' },
  meteor: { name: 'Meteor', about: 'a burning stone falls out of the sky onto a foe, and everything about it', trait: 'star-called', trig: 'kill', cd: 20, gear: FIGHT, foe: true, color: '#ff6020', pal: 'fire' },
  blades: { name: 'Whirling Blades', about: 'three blades of light circle you for six seconds, cutting any foe that comes close', trait: 'whirling', trig: 'combo', cd: 20, gear: FIGHT, color: '#e0e8ff', pal: 'steel' },
  aegis: { name: 'Aegis', about: 'a shell of light about you for ten seconds that takes up to eight hearts of harm', trait: 'warding', trig: 'block', cd: 26, gear: FIGHT, color: '#80c8ff', pal: 'water' },
  shade: { name: 'Shadow Step', about: 'you vanish and come out behind a foe, your next blow a telling one', trait: 'shadowed', trig: 'dodge', cd: 12, gear: FIGHT, foe: true, color: '#9a6ad8', pal: 'violet' },
  rend: { name: 'Earthsplitter', about: 'the ground splits open ahead of you, stunning and hurting every foe along the crack', trait: 'earth-shaking', trig: 'first', cd: 12, gear: FIGHT, foe: true, color: '#c8a070', pal: 'earth' },
  roots: { name: 'Grasping Roots', about: 'roots burst out of the ground and hold the foes about you fast', trait: 'rooted', trig: 'tumble', cd: 15, gear: FIGHT, foe: true, color: '#60a040', pal: 'green' },
  siphon: { name: 'Soul Siphon', about: 'life drawn out of every foe about you and into you', trait: 'hungering', trig: 'hit', cd: 14, gear: FIGHT, foe: true, color: '#c040a0', pal: 'rose' },
  wisps: { name: 'Spirit Wisps', about: 'three wisps rise off you and seek out your foes', trait: 'haunted', trig: 'streak', cd: 12, gear: FIGHT, foe: true, color: '#80ffe0', pal: 'spirit' },
  smite: { name: 'Sunlance', about: 'a lance of sunlight out of the sky onto a foe (the dead, twice as hard)', trait: 'sunlit', trig: 'boss', cd: 12, gear: FIGHT, foe: true, color: '#fff0a0', pal: 'gold' },
  quicken: { name: 'Quickening', about: 'for six seconds you move and swing quicker, after-images trailing you', trait: 'quickened', trig: 'winded', cd: 22, gear: ANY, color: '#ffe060', pal: 'gold' },
  rage: { name: 'Bloodrage', about: 'for eight seconds your blows land half as hard again', trait: 'raging', trig: 'brink', cd: 24, gear: FIGHT, color: '#ff3030', pal: 'blood' },
  bramble: { name: 'Bramble Mantle', about: 'for eight seconds whatever strikes you is torn by thorns and bleeds', trait: 'thorned', trig: 'struck', cd: 20, gear: FIGHT, color: '#70b040', pal: 'green' },
  cyclone: { name: 'Cyclone', about: 'a whirlwind drags the foes about you in, then flings them away', trait: 'wind-born', trig: 'mob', cd: 15, gear: FIGHT, foe: true, color: '#d0f0e8', pal: 'wind' },
  plague: { name: 'Plague Cloud', about: 'a cloud of rot hangs over your foe for five seconds, poisoning all in it', trait: 'rotting', trig: 'afflicted', cd: 15, gear: FIGHT, foe: true, color: '#90c040', pal: 'poison' },
  stasis: { name: 'Time Slip', about: 'time slows for every foe about you, for five seconds', trait: 'timeless', trig: 'deathblow', cd: 20, gear: FIGHT, foe: true, color: '#c0a0ff', pal: 'violet' },
  starfall: { name: 'Starfall', about: 'stars fall on your foes for two seconds', trait: 'starlit', trig: 'kill', cd: 20, gear: FIGHT, foe: true, color: '#fff8c0', pal: 'star' },
  phantom: { name: 'Phantom Blade', about: 'a ghost of you strikes a foe a second time', trait: 'echoing', trig: 'parry', cd: 8, gear: FIGHT, foe: true, color: '#b8a8ff', pal: 'violet' },
  thunder: { name: 'Thunderclap', about: 'a clap of thunder about you throws back and stuns every foe near', trait: 'thundering', trig: 'fall', cd: 12, gear: FIGHT, foe: true, color: '#e8f0ff', pal: 'storm' },
  beacon: { name: 'Rallying Light', about: 'you and those with you get your breath back, and two hearts', trait: 'rallying', trig: 'mend', cd: 25, gear: ANY, color: '#ffd080', pal: 'gold' },
  shatter: { name: 'Shatterstrike', about: 'the blocks about one you break, of the same kind, shatter with it', trait: 'shattering', trig: 'mine', cd: 6, gear: TOOLS, color: '#d8d0c0', pal: 'steel' },
  midas: { name: 'Golden Touch', about: 'coins burst out of what you\'ve worked (now and then a gem shard)', trait: 'gilded', trig: 'fell', cd: 30, gear: TOOLS, color: '#ffd040', pal: 'gold' },
  seek: { name: 'Seeker\'s Light', about: 'every vein of ore within eight paces glows for ten seconds', trait: 'seeking', trig: 'ore', cd: 20, gear: TOOLS, color: '#80f0ff', pal: 'spirit' },
  // (Round 138) More of them.
  firewall: { name: 'Wall of Flame', about: 'a wall of fire rises across the ground before you, burning whatever crosses it, for four seconds', trait: 'flame-walled', trig: 'guardbreak', cd: 18, gear: FIGHT, color: '#ff8030', pal: 'fire' },
  geyser: { name: 'Geyser', about: 'water bursts up out of the ground under a foe, throwing it off its feet', trait: 'welling', trig: 'rain', cd: 12, gear: FIGHT, foe: true, color: '#60b0f0', pal: 'water' },
  ironskin: { name: 'Ironskin', about: 'for eight seconds your skin turns hard as iron: every blow a third lighter', trait: 'iron-skinned', trig: 'back', cd: 22, gear: FIGHT, color: '#a8b0c0', pal: 'steel' },
  pact: { name: 'Blood Pact', about: 'for eight seconds every blow you land mends you a heart', trait: 'blood-sworn', trig: 'smash', cd: 22, gear: FIGHT, color: '#d02a30', pal: 'blood' },
  hook: { name: 'Chain Hook', about: 'a chain flies out to the furthest foe in reach and drags it to you, stunned', trait: 'chained', trig: 'shotat', cd: 12, gear: FIGHT, foe: true, color: '#8890a0', pal: 'steel' },
  lance: { name: 'Frost Lance', about: 'a lance of ice flies at a foe and freezes it where it stands', trait: 'rime-tipped', trig: 'draw', cd: 10, gear: FIGHT, foe: true, color: '#a0d8ff', pal: 'ice' },
  swarm: { name: 'Swarm', about: 'a swarm of bees comes out of nowhere and harries a foe for five seconds', trait: 'humming', trig: 'first', cd: 15, gear: FIGHT, foe: true, color: '#ffd030', pal: 'gold' },
  well: { name: 'Well of Night', about: 'a black well opens in the ground, drags the foes about it in, and shuts on them', trait: 'abyssal', trig: 'oneshot', cd: 18, gear: FIGHT, foe: true, color: '#7a50c0', pal: 'violet' },
  renew: { name: 'Spring Bloom', about: 'flowers come up about you: whatever burns, poisons, chills or bleeds you is gone, and you mend three hearts', trait: 'blooming', trig: 'afflicted', cd: 20, gear: ANY, color: '#90e070', pal: 'green' },
  veil: { name: 'Smoke Veil', about: 'smoke billows up about you: foes lose sight of you, and half their blows go astray, for five seconds', trait: 'smoky', trig: 'back', cd: 20, gear: FIGHT, color: '#9c9ca4', pal: 'smoke' },
  spirit: { name: 'Spirit Wolf', about: 'a wolf of pale light runs down a foe and bites it, three times', trait: 'wolf-blooded', trig: 'undead', cd: 14, gear: FIGHT, foe: true, color: '#80ffe0', pal: 'spirit' },
  gale: { name: 'Gale Step', about: 'you go with the wind, four paces at a stride, cutting every foe you pass', trait: 'gale-born', trig: 'tumble', cd: 12, gear: FIGHT, color: '#c8e8e0', pal: 'wind' },
};
export const ABILITY_KEYS = Object.keys(ABILITIES);

// Conditions of old saves (Round 132's "keen-night"), read as triggers.
// (Each to one that any kind of gear can carry.)
export const OLD_CONDS = { night: 'dusk', hurt: 'bloodied', deep: 'delve', wild: 'tumble', water: 'soak', fight: 'struck', day: 'mend' };

export const isTrigger = (t) => !!TRIGGERS[t];
export const isAbility = (a) => !!ABILITIES[a];
export const triggerFits = (t, cls) => !!TRIGGERS[t] && TRIGGERS[t].gear.includes(cls);
export const abilityFits = (a, cls) => !!ABILITIES[a] && ABILITIES[a].gear.includes(cls);

// A token of a piece's key taken apart: { p (what's set off, a modifier or
// an ability), t (its trigger, or null), ab (an ability?) }.
export function splitTok(tok) {
  const s = String(tok);
  const i = s.indexOf('-');
  const p = i < 0 ? s : s.slice(0, i);
  let t = i < 0 ? null : s.slice(i + 1);
  if (t && OLD_CONDS[t] && !TRIGGERS[t]) t = OLD_CONDS[t];
  return { p, t, ab: !!ABILITIES[p] };
}
export const tokOf = (p, t) => (t ? `${p}-${t}` : p);

// The trigger an ability's bound to with none in the work: its own, if it
// fits the gear, or the gear's own commonest.
const FALLBACK = { blade: 'hit', bow: 'draw', shield: 'block', armor: 'struck', tool: 'mine' };
export function fallbackTrigger(a, cls) {
  const t = ABILITIES[a] && ABILITIES[a].trig;
  return t && triggerFits(t, cls) ? t : FALLBACK[cls] || 'struck';
}

// How a trigger reads, whole: "when you're struck (often)".
export function triggerText(t) {
  const T = TRIGGERS[t];
  return T ? `when ${T.when}` : '';
}
