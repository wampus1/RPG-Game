// A plea for help (round 52): someone who works out past the edge of town
// (a woodcutter in the trees, a trapper at her snares, a herbalist, a
// shepherd) runs into something out there: a band of outlaws camped in
// the woods, a den of wolves. They come home shaken and ask for help: an
// '!' over them, once word's got round. Anyone can take it on (you, the
// watch, adventurers passing through: as many as like), and the first to
// see it done ends it for everyone.
//
// Left too long, it grows. Outlaws dig in (a palisade, more of them, an
// outpost), go for the one who told on them, raid the town, take in the
// town's desperate; a pack grows, takes the sheep, then someone out alone.
// The one who asked may not live to see it done; their kin take it up.
//
// How it ends is told on: a band wiped out has friends among the world's
// outlaws (see bandits.js), and whoever did it is known to them.
import { motif, R, refKey, nameOf, NameOf, isAlive, resolve, lcFirst, poss } from '../core.js';
import { pick, say, layoutOf, laidTowns, townMid, directions, living, fullName, odds, town, townName, bandsNear, kinOf, relWord, recOf } from './lib.js';
import { mayorOf } from '../../econ.js';
import { fortify } from './camp.js';
import { BEASTS, denOf, clearDen, hurtOrKill } from './beasts.js';

const OUT_JOBS = ['lumberjack', 'trapper', 'herbalist', 'farmer', 'fisher', 'miner', 'laborer', 'shepherd'];

const MET = {
  bandits: {
    lumberjack: ['I was felling oaks {where} when I saw them: {threat}, {n} at least, camped among the trees. They chased me half a mile. I can\'t work with them out there.', 'There are outlaws in my stand of timber, {where}. {threat}, they call themselves. They took my axe and laughed at me.'],
    trapper: ['My snares {where} have been emptied, and not by foxes. {threat}. They\'ve a camp out there now, and they watch the trails.', 'I came on their fire {where}, a whole camp of them: {threat}. I don\'t go out there now.'],
    herbalist: ['I went out for herbs {where} and walked right into a camp of outlaws. {threat}. I dropped my basket and ran.', 'There are cutthroats in the meadows {where}. {threat}. I need those herbs for the sick, and I can\'t get to them.'],
    farmer: ['Outlaws took two of my sheep and laughed about it. {threat}, camped {where}. Next it\'ll be the house.', 'I saw their smoke {where}. {threat}. They come down to the fields at night and help themselves.'],
    fisher: ['They watch the water from the trees {where}. {threat}. I daren\'t put my boat out.', 'Outlaws stopped me on the bank {where} and took my catch. {threat}.'],
    miner: ['The way to the dig goes right past their camp {where}. {threat}. They took my pick and my pay.'],
    laborer: ['We were cutting stone {where} when they came out of the trees. {threat}. We ran for it.'],
    shepherd: ['They\'ve had three of my flock already. {threat}, camped {where}.'],
    merchant: ['They stopped me on the road {where} and took {lost}. {threat}. I want it back, and I want them gone.'],
    mayor: ['{threat} raided us in the night and got clean away. They\'re camped {where}. The council wants them gone.'],
    // (Round 54: not always the one who works out there.)
    kin: ['My little {kid} came home white as a sheet: they\'d been playing {where} and seen men with knives round a fire. {threat}. What if they\'d been seen?', '{kid} was out {where} after the goats, and ran right into them. {threat}. They let a child go, this time.'],
    guard: ['Two of us went out on patrol {where}. One came back. {threat}. I can\'t ask the council for more men, there aren\'t any.', 'We tracked them {where}: {threat}, dug in. Too many for the watch alone.'],
    priest: ['Pilgrims on their way to us were set on {where}. {threat}. They took the offerings, and they took a woman\'s shoes. Her SHOES.', 'The old shrine {where} has been made a den of thieves. {threat}. I\'d have it back.'],
    innkeeper: ['Nobody comes to the inn now: travellers won\'t take the road {where}. {threat}. I\'ll be ruined by spring.', 'A carter staggered in last night, robbed and beaten {where}. {threat}. That\'s three this month.'],
    elder: ['I\'ve seen this before, when I was young: {threat}, camped {where}, and then one night they came for the town. Don\'t wait for that night.', 'Mark me: {threat} out {where} will be at our doors by the harvest. They always are.'],
  },
  beasts: {
    lumberjack: ['{threat}. A whole pack of them, denned up {where}. They had my dog last night.', 'I heard them before I saw them: {threat}, out {where}. I\'m not going back in those trees.'],
    trapper: ['Something\'s been at my snares {where}, and it isn\'t foxes. {threat}. Big ones.', 'I found their den {where}: bones everywhere. {threat}.'],
    herbalist: ['I can\'t go out for herbs any more. There are {threat} {where}.'],
    farmer: ['{threat}, out {where}. They took two sheep last night, and the dog won\'t stop shaking.'],
    fisher: ['{threat} come down to the water {where} at dusk. I don\'t fish there now.'],
    miner: ['There\'s a den of {threat} on the way to the dig, {where}.'],
    laborer: ['{threat} chased us off the quarry {where}.'],
    shepherd: ['{threat} took half my flock. They\'re denned up {where}.'],
    mayor: ['{threat} have been coming in at night. They\'re denned up {where}.'],
    kin: ['My {kid} was nearly taken by {threat}, playing {where}. They got up a tree, thank the gods.', 'There are {threat} {where}. {kid} saw their eyes in the dark, and won\'t sleep without a candle now.'],
    guard: ['{threat}, denned up {where}. They had one of the watch\'s dogs. Next it\'ll be one of the watch.'],
    priest: ['The graves {where} have been dug at by {threat}. I can\'t have that. Nobody can have that.'],
    innkeeper: ['{threat} out {where} have the travellers scared off the road. I\'ve had two bookings in a week.'],
    elder: ['When I was a girl, {threat} came out of {where} the winter of the long frost. I\'ve not forgotten. Neither should you.'],
  },
};
// (Who might come asking: weighted, as a town is.)
const VOICES = [
  { v: 'worker', w: 1.4 }, { v: 'kin', w: 0.5 }, { v: 'guard', w: 0.45 }, { v: 'priest', w: 0.3 }, { v: 'innkeeper', w: 0.35 }, { v: 'elder', w: 0.35 },
];
function voiceOf(L, rng) {
  const ppl = living(L).filter((r) => r.age !== 'child');
  const kids = living(L).filter((r) => r.age === 'child');
  const options = [];
  for (const { v, w } of VOICES) {
    let pool = [];
    if (v === 'worker') pool = ppl.filter((r) => OUT_JOBS.includes(r.job));
    else if (v === 'kin') pool = ppl.filter((r) => (r.children || []).some((i) => kids.some((k) => k.idx === i)));
    else if (v === 'guard') pool = ppl.filter((r) => r.job === 'guard');
    else if (v === 'priest') pool = ppl.filter((r) => r.job === 'priest');
    else if (v === 'innkeeper') pool = ppl.filter((r) => ['innkeeper', 'barkeep'].includes(r.job));
    else if (v === 'elder') pool = ppl.filter((r) => r.age === 'elder');
    if (pool.length) options.push({ v, w, pool });
  }
  if (!options.length) return null;
  let r = rng.next() * options.reduce((a, o) => a + o.w, 0);
  const o = options.find((q) => (r -= q.w) <= 0) || options[options.length - 1];
  const who = rng.pick(o.pool);
  const kid = o.v === 'kin' ? kids.find((k) => (who.children || []).includes(k.idx)) : null;
  return { voice: o.v, who, kid: kid ? kid.name.first : null };
}
const CRIES = {
  bandits: ['Outlaws! There are outlaws in the woods!', 'Bandits! I barely got away!', 'Help! Outlaws, out past the fields!'],
  beasts: ['Wolves! There\'s a pack of them out there!', 'Run! There\'s something in the trees!', 'Beasts, out past the fields! I saw them!'],
};

function kindOf(th) {
  return th.cast.threat && th.cast.threat.t === 'den' ? 'beasts' : 'bandits';
}

function threatName(S, th) {
  if (kindOf(th) === 'beasts') {
    const d = denOf(S, { cast: { den: th.cast.threat } });
    return d ? BEASTS[d.species].word : 'beasts';
  }
  // (Gone: by the name they had.)
  return isAlive(S, th.cast.threat) ? nameOf(S, th.cast.threat) : th.names.threat || 'the outlaws';
}

function threatAt(S, th) {
  const t = th.cast.threat;
  if (!t) return null;
  if (t.t === 'den') {
    const d = S.dens[t.key];
    return d ? { x: d.x, z: d.z } : null;
  }
  const b = resolve(S, t);
  return b && b.camp ? { x: b.camp.x, z: b.camp.z } : null;
}

function threatStrength(S, th) {
  return S.strengthOf(th.cast.threat);
}

function bandOf(S, th) {
  return th.cast.threat && th.cast.threat.t === 'band' ? resolve(S, th.cast.threat) : null;
}

// The coin they can put up (and the council's share, if it's bad).
function purseFor(S, th) {
  const L = layoutOf(S, th.sid);
  const r = recOf(S, th.cast.giver);
  const b = bandOf(S, th);
  const own = Math.min(30, Math.floor((r && r.coins) || 0) * 0.6);
  const size = b ? 12 + b.members.length * 7 + (b.outpost || 0) * 18 : 15 + ((denOf(S, { cast: { den: th.cast.threat } }) || {}).pack || 2) * 5;
  const council = L && L.econ ? Math.min(Math.floor(L.econ.treasury * 0.3), size) : 0;
  return Math.max(12, Math.round(own + council + (th.vars.stage || 0) * 8));
}

function title(S, th) {
  const b = bandOf(S, th);
  if (b) return b.outpost >= 3 ? `Storm the stronghold of ${b.name}` : b.outpost ? `Clear the outpost of ${b.name}` : `Drive off ${b.name}`;
  const d = denOf(S, { cast: { den: th.cast.threat } });
  return d ? `Clear the ${d.name}` : 'Deal with the beasts';
}

// The plea itself: posted (or brought up to date, as things change).
function plead(th, S) {
  const L = layoutOf(S, th.sid);
  const at = threatAt(S, th);
  if (!L || !at) return null;
  const coins = purseFor(S, th);
  const ttl = title(S, th);
  let t = S.tasksOf(th, 'clear')[0];
  const giver = th.cast.giver && isAlive(S, th.cast.giver) ? th.cast.giver : null;
  if (t) {
    t.title = ttl;
    t.reward.coins = coins;
    t.at = at;
    if (!giver && t.giver) {
      t.giver = null;
      t.giverName = null;
      t.hand = 'auto';
    }
    return t;
  }
  const rng = S.rng(th, 0x91e);
  const g = recOf(S, giver);
  const kind = kindOf(th);
  const v = th.vars.voice;
  const job = th.vars.how === 'robbed' ? 'merchant' : th.vars.how === 'raided' ? 'mayor' : v && v !== 'worker' && MET[kind][v] ? v : g ? g.job : 'farmer';
  const lines = MET[kind][job] || MET[kind].farmer;
  const b = bandOf(S, th);
  const pitch = say(rng, lines, { where: directions(L.settlement, at.x, at.z), threat: threatName(S, th), n: b ? b.members.length : 3, lost: th.vars.lost || 'everything', kid: th.vars.kid || 'little one' })
    + ` ${coins ? pick(rng, [` I can pay ¤${coins}: it's all I have, and the council's put in.`, ` There's ¤${coins} for whoever does it.`, ` ¤${coins}, if you'll do it.`]) : ''}`;
  t = S.post(th, {
    role: 'clear', kind: 'clear', title: ttl, sid: th.sid, giver, pitch: pitch.trim(), at, r: 34, target: th.cast.threat,
    reward: { coins, from: giver || R.town(th.sid), rep: 10, renown: th.sid, renownPts: 4, renownWhy: `dealing with ${threatName(S, th)}`, fame: 2 },
    delay: th.tier === 'complex' ? 30 : 90,
  });
  t.rumour = `${giver ? nameOf(S, giver) : 'The council'} wants ${threatName(S, th)} dealt with`;
  t.glyph = kind === 'beasts' ? 'w' : 'x';
  return t;
}

motif({
  id: 'plea',
  family: 'threats',
  max: 10,
  key: (o) => refKey(o.cast.threat),
  title: (th, S) => (kindOf(th) === 'beasts' ? `${NameOf(S, th.cast.giver)}'s Plea: ${threatName(S, th)}` : `${NameOf(S, th.cast.giver)}'s Plea`),
  // Out at their work, someone runs into it.
  scan(S, rng) {
    const out = [];
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 6)) {
      const sid = L.settlement.id;
      const threats = [...bandsNear(S, sid, 6).map((b) => R.band(b.id))];
      const m = townMid(L.settlement);
      for (const d of Object.values(S.dens)) if (!d.cleared && Math.hypot(d.x - m.x, d.z - m.z) < 260) threats.push(R.den(d.key));
      for (const tr of threats) {
        if (S.live().some((t) => t.m === 'plea' && refKey(t.cast.threat) === refKey(tr))) continue;
        if (!rng.chance(0.3)) continue;
        const pickd = voiceOf(L, rng);
        if (!pickd) continue;
        out.push({ cast: { giver: R.rec(sid, pickd.who.idx), threat: tr, town: R.town(sid) }, sid, vars: { how: 'met', voice: pickd.voice, kid: pickd.kid, delay: rng.int(60, 180) } });
        break;
      }
    }
    return out;
  },
  seeds: [
    // A merchant robbed on the road wants them gone (and their goods back).
    { on: 'robbery', make: (ev, S) => {
      if (!ev.victim) return null;
      return { cast: { giver: ev.victim, threat: R.band(ev.band), town: R.town(ev.sid) }, sid: ev.sid, vars: { how: 'robbed', lost: ev.coins ? `¤${ev.coins}${ev.goods ? ' and half my goods' : ''}` : 'half my goods', delay: 60 } };
    } },
    // A town raided: the mayor wants them gone.
    { on: 'raid', make: (ev, S) => {
      if (!ev.won) return null;
      const L = layoutOf(S, ev.sid);
      const m = L ? mayorOf(L) : null;
      if (!m) return null;
      return { cast: { giver: R.rec(ev.sid, m.idx), threat: R.band(ev.band), town: R.town(ev.sid) }, sid: ev.sid, vars: { how: 'raided', delay: 30 } };
    } },
  ],
  anchors: (th, S) => [threatAt(S, th)].filter(Boolean),
  nodes: {
    met: {
      enter(th, S) {
        const at = threatAt(S, th);
        if (!at) return S.end(th, 'faded');
        const s = town(S, th.sid);
        const how = th.vars.how;
        const v = th.vars.voice;
        const who = NameOf(S, th.cast.giver);
        const where = directions(s, at.x, at.z);
        S.note(th, how === 'robbed' ? `${who} was robbed on the road by ${threatName(S, th)}.` : how === 'raided' ? `${threatName(S, th)} raided ${s.name}.`
          : v === 'kin' ? `${who}'s child ${th.vars.kid || ''} saw ${threatName(S, th)} ${where}, and ran home.`
            : v === 'guard' ? `A patrol from ${s.name} ran into ${threatName(S, th)} ${where}. ${who} came back to tell it.`
              : v === 'priest' ? `${threatName(S, th)} have been preying on those bound for the shrine ${where}. ${who} has had enough.`
                : v === 'innkeeper' ? `Travellers have stopped coming to ${s.name}: ${threatName(S, th)} are ${where}. ${who}, at the inn, is the first to say so.`
                  : v === 'elder' ? `Old ${who} says ${threatName(S, th)} ${where} are how it started last time.`
                    : `${who} ran into ${threatName(S, th)} ${where}.`);
      },
      // (Home again, shaken: they tell it.)
      hour(th, S) {
        const g = recOf(S, th.cast.giver);
        if (g && g.ent && !g.ent.dead && !th.vars.cried) {
          th.vars.cried = true;
          g.ent.say(pick(S.rng(th, 0xc1), CRIES[kindOf(th)]), 3.5, '#ffb080');
        }
        if (S.now - th.nodeAt >= (th.vars.delay || 90)) S.go(th, 'plea');
      },
      day(th, S) {
        S.go(th, 'plea');
      },
    },
    plea: {
      enter(th, S) {
        const t = plead(th, S);
        if (!t) return S.end(th, 'faded');
        if (!th.vars.asked) {
          th.vars.asked = true;
          S.note(th, `${t.giver ? NameOf(S, t.giver) : 'The council'} asked for help: ${lcFirst(t.title)}.`);
        }
      },
      // Left alone, it grows.
      day(th, S, rng) {
        th.vars.neglect = (th.vars.neglect || 0) + 1;
        const t = S.tasksOf(th, 'clear')[0];
        const tried = t && t.claims.length;
        if (th.vars.neglect >= (th.vars.patience ??= rng.int(2, 3) + (tried ? 1 : 0))) S.go(th, 'worse');
        else if (t) plead(th, S);
      },
      // Near enough to see: those who took it on (the watch, adventurers)
      // march out and fight it in front of you.
      live(th, S) {
        const t = S.tasksOf(th, 'clear')[0];
        const at = threatAt(S, th);
        if (!t || !at || th.vars.posseDay === S.day) return;
        const npcs = t.claims.filter((c) => c.who.t === 'rec' || c.who.t === 'adv');
        if (!npcs.length || S.nearest([at]) > 60) return;
        th.vars.posseDay = S.day;
        const s = town(S, th.sid);
        const m = townMid(s);
        const from = { x: Math.round(at.x + (m.x - at.x) * 0.35), z: Math.round(at.z + (m.z - at.z) * 0.35) };
        npcs.slice(0, 4).forEach((c, i) => {
          const o = resolve(S, c.who);
          if (!o) return;
          const person = c.who.t === 'adv'
            ? { name: o.name, look: o.look, personality: o.personality, traits: o.traits, age: 'adult', job: 'adventurer', weapon: o.gear.weapon, wear: o.gear.wear, maxHp: o.maxHp, armor: 0.3, title: 'Adventurer' }
            : { name: o.name, look: o.look, personality: o.personality, traits: o.traits, age: 'adult', job: 'guard', weapon: (o.equipment?.items || []).find((q) => q.item)?.item || 'iron_sword', maxHp: o.maxHp || 30, armor: o.equipment?.armor || 0.2, title: 'Guard' };
          S.actor(th, { key: `posse${i}`, kind: 'npc', role: 'posse', hostile: false, at: { x: from.x + (i % 2), z: from.z + Math.floor(i / 2) }, person, who: c.who, orders: { goal: at } });
        });
        S.note(th, `${npcs.map((c) => c.name).slice(0, 3).join(' and ')} marched out after ${threatName(S, th)}.`);
      },
      on: {
        band_gone(th, ev, S) {
          if (kindOf(th) !== 'bandits' || ev.band !== th.cast.threat.id) return;
          done(th, S, ev.by, ev.byName);
        },
        den_cleared(th, ev, S) {
          if (kindOf(th) !== 'beasts' || ev.den !== th.cast.threat.key) return;
          done(th, S, ev.by, null);
        },
        band_moved(th, ev, S) {
          if (kindOf(th) !== 'bandits' || ev.band !== th.cast.threat.id) return;
          const at = threatAt(S, th);
          const m = townMid(town(S, th.sid));
          if (at && m && Math.hypot(at.x - m.x, at.z - m.z) > 900) S.go(th, 'moved', `${threatName(S, th)} have moved on, far from ${townName(S, th.sid)}. For now.`, { news: [th.sid] });
          else {
            const t = S.tasksOf(th, 'clear')[0];
            if (t && at) t.at = at;
          }
        },
        npc_died(th, ev, S) {
          if (!th.cast.giver || refKey(ev.who) !== refKey(th.cast.giver)) return;
          S.go(th, 'bereaved', null, { cause: ev.cause });
        },
      },
      fade: 25,
    },
    // It got worse: what, depends on what it is and how things stand.
    worse: {
      enter(th, S) {
        const rng = S.rng(th, 0x3a5);
        th.vars.neglect = 0;
        th.vars.stage = (th.vars.stage || 0) + 1;
        th.vars.patience = rng.int(2, 4);
        const b = bandOf(S, th);
        const d = denOf(S, { cast: { den: th.cast.threat } });
        const L = layoutOf(S, th.sid);
        const s = town(S, th.sid);
        if (b) {
          const pickd = S.choose(th, [
            { to: 'dig', w: () => (b.outpost || 0) < 3 ? 3 : 0 },
            { to: 'strike', w: () => (recOf(S, th.cast.giver) ? 2 : 0) },
            { to: 'raid', w: () => (b.members.length >= 3 && L ? 1.5 : 0) },
            { to: 'grow', w: 1.2 },
            { to: 'leave', w: () => ((b.outpost || 0) === 0 && b.members.length <= 2 ? 1 : 0.15) },
          ], rng);
          switch (pickd && pickd.to) {
            case 'dig': {
              const lv = fortify(S, b, (b.outpost || 0) + 1);
              for (let i = 0; i < rng.int(1, 2); i++) b.members.push(S.sim.bandits.outlaw(rng, s ? s.style : 'vale'));
              b.known = true;
              S.note(th, lv >= 3 ? `${b.name} have walled themselves in out ${directions(s, b.camp.x, b.camp.z)}: a stronghold now, with a lookout and stakes at the gate.` : lv === 2 ? `${b.name} have finished a palisade round their camp, and there are more of them.` : `${b.name} are digging in: stakes going up round their tents, a banner at the gate. More have joined them.`, { news: [th.sid] });
              if (lv >= 3) S.spawn(th, 'stronghold', { cast: { band: R.band(b.id), town: R.town(th.sid) }, sid: th.sid });
              break;
            }
            case 'strike': {
              const g = recOf(S, th.cast.giver);
              const strong = S.strengthOf(R.band(b.id)) > 4;
              if (g && rng.chance(strong ? 0.25 : 0.1)) {
                S.note(th, `${fullName(g)} went back out to work, and ${b.name} were waiting. ${fullName(g)} is dead.`, { news: [th.sid] });
                th.vars.revenge = true;
                if (L) S.sim.recordDeath(L, g, `killed by ${b.name}`, null);
                break;
              }
              if (g) {
                const took = Math.min(g.coins || 0, rng.int(5, 20));
                g.coins = Math.max(0, (g.coins || 0) - took);
                g.hp = Math.max(1, Math.round((g.hp ?? 20) * 0.5));
                b.loot += took;
                S.note(th, `${b.name} caught ${fullName(g)} alone and beat them${took ? `, and took ¤${took}` : ''}: a lesson for telling tales.`, { news: [th.sid] });
              }
              break;
            }
            case 'raid': {
              const r = S.sim.bandits.raid(b, S.day, rng);
              if (r && r.won) S.note(th, `${b.name} grew bold and raided ${s.name}.`);
              break;
            }
            case 'grow': {
              // Desperate folk of the town take to the hills with them.
              const poor = L ? living(L).filter((r) => r.age === 'adult' && (r.hungry >= 1 || (r.coins || 0) < 3) && r.job !== 'mayor' && r.job !== 'guard') : [];
              if (poor.length && rng.chance(0.5)) {
                const r = rng.pick(poor);
                S.sim.bandits.recruit(r, L, S.day, rng);
                r.migrated = true;
                r.away = true;
                S.note(th, `${fullName(r)}, hungry and owing, slipped away in the night to join ${b.name}.`, { news: [th.sid] });
              } else {
                b.members.push(S.sim.bandits.outlaw(rng, s ? s.style : 'vale'));
                S.note(th, `More outlaws have come to ${poss(b.name)} fire. There are ${b.members.length} of them now.`);
              }
              break;
            }
            default: {
              S.sim.bandits.move(b, rng, S.day);
              break;
            }
          }
        } else if (d) {
          const K = BEASTS[d.species];
          const was = d.pack;
          d.pack = Math.min(d.max + 2, d.pack + rng.int(1, 2));
          if (d.pack > was) S.note(th, pick(rng, [`The ${K.word} at the ${d.name} are more now. ${d.pack} of them, folk reckon.`, `More ${K.word} have joined the pack at the ${d.name}.`, `The ${K.word} are bolder: seen in daylight now, close to the fields.`]), { news: [th.sid] });
        }
        if (!th.done && th.node === 'worse') S.go(th, 'plea');
      },
    },
    // Whoever asked is dead (by the thing they asked about, or not): their
    // kin take it up (for vengeance now), or the council does.
    bereaved: {
      enter(th, S, o) {
        const L = layoutOf(S, th.sid);
        const g = recOf(S, th.cast.giver);
        const kin = g && L ? kinOf(L, g) : [];
        const t = S.tasksOf(th, 'clear')[0];
        const killed = /bandit|killed by/.test((o && o.cause) || '') || th.vars.revenge;
        if (kin.length) {
          const k = kin.sort((a, b) => (b.personality?.bravery ?? 0) - (a.personality?.bravery ?? 0))[0];
          th.cast.giver = R.rec(th.sid, k.idx);
          th.names.giver = fullName(k);
          if (t) {
            t.giver = th.cast.giver;
            t.giverName = fullName(k);
            t.hand = 'giver';
            t.title = killed ? `Avenge ${fullName(g)}: ${lcFirst(t.title)}` : t.title;
            t.pitch = killed ? `${fullName(g)} was my ${relWord(k, g)}. ${threatName(S, th)} did this. I want them gone from the world. Whatever I have is yours.` : `${fullName(g)} asked for help with ${threatName(S, th)} before... before. I'll see it through. Will you?`;
            t.reward.coins += 15;
            t.reward.from = th.cast.giver;
          }
          S.note(th, `${fullName(k)} has taken up ${fullName(g || { name: { first: 'their', last: 'kin' } })}'s plea${killed ? ', for vengeance now' : ''}.`);
        } else if (L) {
          const m = mayorOf(L);
          if (t && m) {
            t.giver = R.rec(th.sid, m.idx);
            t.giverName = fullName(m);
            t.reward.from = R.town(th.sid);
          }
          S.note(th, `The council of ${L.settlement.name} has taken up the plea.`);
        }
        if (!th.done) S.go(th, 'plea');
      },
    },
    saved: {
      enter(th, S, o) {
        const by = o && o.by;
        const name = o && o.byName;
        S.note(th, `${threatName(S, th)} ${kindOf(th) === 'beasts' ? 'are' : 'are'} gone${name ? `, thanks to ${name}` : ''}. ${th.cast.giver && isAlive(S, th.cast.giver) ? `${NameOf(S, th.cast.giver)} can breathe again.` : ''}`.trim(), { by: by && by.t === 'pl' ? by.pid : null });
      },
      final: true,
    },
    moved: { final: true },
  },
  tasks: {
    clear: {
      npcs: { adv: 0.12, guard: 0.07 },
      npcPace: 0.3,
      // Someone else has a go at it, out of sight: the plain telling.
      npcTry(th, t, who, S, rng) {
        const mine = S.strengthOf(who) + t.claims.filter((c) => c.who.t !== 'pl').length * 0.4;
        const theirs = threatStrength(S, th) * 1.4;
        const b = bandOf(S, th);
        const d = denOf(S, { cast: { den: th.cast.threat } });
        if (rng.chance(odds(mine, theirs))) {
          if (b) {
            const nm = nameOf(S, who);
            S.sim.bandits.wipedOut(b, S.day, nm, who);
          } else if (d) clearDen(S, d, who);
        } else {
          hurtOrKill(S, who, rng, `went after ${threatName(S, th)}`, d);
          S.note(th, `${NameOf(S, who)} went after ${threatName(S, th)}, and came back the worse for it.`);
          S.drop(t, who);
          if (b) b.loot += 10;
        }
      },
      offer: (th, t, pid, S) => [`They're ${S.whereTask(t, th.sid)}.`],
      status: (th, t, pid, S) => {
        const b = bandOf(S, th);
        const d = denOf(S, { cast: { den: th.cast.threat } });
        if (b) return [`They're still out there: ${b.members.length} of them${b.outpost ? ', behind a palisade now' : ''}.`];
        if (d) return [`The ${BEASTS[d.species].word} are still out there. ${d.pack} of them, maybe more.`];
        return ['Is it done?'];
      },
      thanks: (th, t, pid, S) => [pick(S.rng(th, 0x7e), ['They\'re gone? Truly? I can go back to work. Thank you.', 'I\'ll sleep tonight for the first time in days. Thank you.', 'You did it! I owe you more than coin.'])],
    },
  },
  // One of the posse fell.
  actorDown(th, a, by, S) {
    if (a.role !== 'posse' || !a.who) return;
    if (a.who.t === 'adv') {
      S.sim.adventurers.died(a.who.id, 'killed');
      S.emit('adv_died', { adv: a.who.id, by: th.cast.threat, cause: `killed fighting ${threatName(S, th)}` });
    } else if (a.who.t === 'rec') {
      const L = layoutOf(S, a.who.sid);
      const r = resolve(S, a.who);
      if (L && r) S.sim.recordDeath(L, r, `killed fighting ${threatName(S, th)}`, null);
    }
    const t = S.tasksOf(th, 'clear')[0];
    if (t) S.drop(t, a.who);
  },
  // How it ended, told on: a band wiped out by someone is remembered by
  // the world's outlaws (see bandits.js, 'grudge').
  ended(th, S, outcome) {
    if (outcome !== 'saved') return;
  },
});

// Seen to: by whoever it was.
function done(th, S, by, byName) {
  const t = S.tasksOf(th, 'clear')[0];
  if (t && by) S.complete(t, by);
  else if (t) S.closeTask(t, 'done', null);
  S.go(th, 'saved', null, { by, byName: byName || (by ? nameOf(S, by) : null) });
}

export { threatAt, kindOf, threatName };
