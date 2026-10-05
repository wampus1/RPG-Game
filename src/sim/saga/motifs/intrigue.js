// A stranger in town (round 54): the hidden story.
//
// Someone new settles in a small town: kind, hard-working, quick to help
// (a roof mended for a widow, a child pulled from the river, wages given
// away). In a few weeks they're liked by everyone, the mayor most of all.
// Then the mayor dies in the night: a fever, a fall, the millpond. That's
// what the town is told, and what it believes.
//
// Nothing tells you any of this is a story. The newcomer is an agent of a
// realm that wants the town, and the mayor was in the way. If you wonder
// about the death and start asking, you'll find those who saw or heard
// something that night (each one thing, and not all of them right), and
// those who had their own reasons to wish the mayor gone. Nobody tells you
// who did it: you have what people saw (in your quest log, as they told
// it), what you can see for yourself (a face, a hat, where someone lives,
// how long they've been in town, what they do), and your own wits. Accuse
// someone to their face. Get it wrong and an innocent is shamed (and the
// one you didn't name hears you're asking). Leave it, and if their realm
// goes to war with this one, the agent opens the way: a granary burnt, the
// well fouled, the watch's keys gone, the gate left open. Then they're
// gone, and it's too late. It's rare.
import { motif, R, nameOf } from '../core.js';
import { pick, layoutOf, laidTowns, town, townMid, adults, fullName, recOf, has, nat, repWith, hairWord } from './lib.js';
import { makePerson } from '../actors.js';
import { mayorOf, alive, DAY, ledger } from '../../econ.js';
import { newcomer } from '../../civic.js';
import { personName, familyName, CULTURES } from '../../../world/names.js';
import { RNG, hash4 } from '../../../util/rng.js';

const tid = (th) => `t${th.id}`;
const civName = (c) => (c ? c.name.replace(/^The /, 'the ') : 'a realm');
const hairOf = (r) => hairWord(r);
const headOf = (r) => (r.look && r.look.hat === 'hood' ? 'hood' : r.look && r.look.hat ? 'hat' : 'bare');
// What a trade leaves on you.
const SMELL = {
  carpenter: 'sawdust and pine resin', builder: 'lime and wet stone', herbalist: 'herbs, something green and bitter', farmer: 'earth and the byre', laborer: 'lime and sweat',
  fisher: 'fish and tar', miner: 'stone dust', lumberjack: 'wood smoke and pine', baker: 'flour and yeast', cook: 'onions and smoke', blacksmith: 'coal smoke and hot iron',
  tailor: 'wool and lanolin', trapper: 'blood and fur', glassblower: 'hot sand', priest: 'incense', scholar: 'ink and old paper', merchant: 'perfume and road dust', handler: 'horses',
};
const COVER_JOBS = ['herbalist', 'carpenter', 'laborer', 'farmer', 'fisher', 'tailor', 'builder'];
// How each kind of agent kills, and what it's taken for.
const METHODS = {
  herbalist: { m: 'poison', said: 'a sudden fever in the night', body: 'There\'s a smell of bitter almonds on their lips. That\'s no fever. Someone who knows their herbs did this.' },
  cook: { m: 'poison', said: 'something they ate disagreed with them', body: 'Their lips are blue, and their tongue. That was in the food, and whoever put it there knew what they were doing.' },
  carpenter: { m: 'blow', said: 'a fall down their own stairs', body: 'The bruise on the back of the head is square-edged. Stairs don\'t do that. A mallet does.' },
  builder: { m: 'blow', said: 'a fall down their own stairs', body: 'A blow to the back of the head, flat and heavy, like a mason\'s maul. Not the stairs.' },
  fisher: { m: 'drown', said: 'drowning in the millpond, walking home in the dark', body: 'Marks on the shoulders, like someone held them down. And a knot in the cord round their wrist that only boatfolk tie.' },
  default: { m: 'smother', said: 'dying peacefully in their sleep', body: 'Peaceful? Look at their nails: they fought. And there\'s a thread caught in them, rough wool, not theirs.' },
};
const methodOf = (job) => METHODS[job] || METHODS.default;
const DEEDS = [
  '{s} mended old {o}\'s roof, and wouldn\'t take a coin for it.',
  '{s} pulled {o}\'s little one out of the river. Soaked to the skin, and laughing.',
  '{s} gave a week\'s wages to the poor box at the temple.',
  '{s} sat up three nights with {o}, who was sick, so the family could sleep.',
  '{s} found {o}\'s lost goat, halfway up the hill, and carried it home.',
  '{s} stood between two drunks at the tavern and talked them both into going home.',
  '{s} has been teaching the children their letters, of an evening.',
  '{s} helped bring in {o}\'s harvest before the rain.',
];
const SPY_NAMES = ['the Wren', 'the Lantern', 'the Second Bell', 'the Gardener', 'the Quiet Guest', 'the Thimble', 'Grey Glove'];

function civOf(S, id) {
  return S.game.world.ow.civs.find((c) => c.id === id) || (S.sim.realms.extraCivs || []).find((c) => c.id === id) || null;
}

// Which side of town someone lives on (from the middle).
function quarterOf(L, r) {
  const h = r.home !== null && r.home !== undefined ? L.buildings[r.home] : null;
  if (!h) return null;
  const m = townMid(L.settlement);
  const dx = (h.x0 + h.x1) / 2 - m.x;
  const dz = (h.z0 + h.z1) / 2 - m.z;
  if (Math.abs(dx) < 4 && Math.abs(dz) < 4) return 'middle';
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : dz > 0 ? 'south' : 'north';
}

// A facet of someone: what a witness might have noticed about them.
function facets(L, r, arrivedSince) {
  return {
    hair: hairOf(r),
    head: headOf(r),
    smell: r.job,
    quarter: quarterOf(L, r),
    newcomer: !!(r.arrived && (r.arrivedDay ?? 0) >= arrivedSince),
    foreign: !!r.foreignName,
  };
}

const CLUE_TEXT = {
  hair: (v, rng) => pick(rng, [`I couldn't sleep, and I looked out: someone with ${v} hair was at the mayor's back door. Late. Very late.`, `Someone went by under the lamp at the corner, quick, head down. ${v[0].toUpperCase()}${v.slice(1)} hair, I'm sure of that much.`]),
  head: (v) => (v === 'hood' ? 'Whoever went past my window that night had a hood up. On a warm night. I remember thinking that was odd.' : v === 'hat' ? 'I saw someone going toward the mayor\'s that night, in a hat pulled low.' : 'Whoever it was had nothing on their head: I saw their hair in the lamplight, bare.'),
  smell: (v) => `When we found them in the morning, the room smelt of ${SMELL[v] || 'nothing I could name'}. The mayor never had any of that about the house.`,
  quarter: (v) => (v === 'middle' ? 'I heard someone running after midnight. Not far: they stopped somewhere round the middle of town, by the square.' : `I heard footsteps running past, after midnight, off toward the ${v} side of town.`),
  newcomer: (v) => (v ? 'The dogs on our street barked fit to wake the dead that night. They don\'t bark at folk they know. Whoever it was hasn\'t been here long.' : 'The dogs never made a sound that night. Whoever it was, the dogs knew them.'),
  foreign: (v) => (v ? 'I heard them muttering as they passed: a word or two, in a tongue from somewhere else.' : 'I heard them curse when they tripped on our step: a good plain curse, from round here.'),
};
function clueText(rng, k, v) {
  return CLUE_TEXT[k](v, rng);
}

motif({
  id: 'infiltrator',
  family: 'intrigue',
  hidden: true,
  max: 1,
  key: (o) => `infil:${o.sid}`,
  title: (th) => (th.vars.dead ? `The Death of ${th.vars.dead}` : `A Stranger in ${th.vars.townName}`),
  scan(S, rng) {
    if (!rng.chance(0.012)) return null;
    const civs = S.game.world.ow.civs;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      const s = L.settlement;
      if (s.type === 'city' || !s.civ || adults(L).length < 8 || !mayorOf(L)) continue;
      if (S.live().some((t) => t.m === 'infiltrator')) return null;
      // A realm that wants it: no friend of the town's.
      const foes = civs.filter((c) => c !== s.civ && S.sim.realms.standing && ['hostile', 'wary'].includes(S.sim.realms.standing(s.civ, c)));
      if (!foes.length) continue;
      const foe = foes.find((c) => S.sim.realms.standing(s.civ, c) === 'hostile') || rng.pick(foes);
      return { cast: { town: R.town(s.id) }, sid: s.id, vars: { civ: foe.id, home: s.civ.id, townName: s.name } };
    }
    return null;
  },
  nodes: {
    // The newcomer arrives, and makes themself at home.
    settling: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const foe = civOf(S, th.vars.civ);
        if (!L || !foe) return S.end(th, 'faded');
        const rng = S.rng(th, 0x5b1);
        const cap = S.sim.realms.capitalOf ? S.sim.realms.capitalOf(foe) : null;
        const fstyle = cap && CULTURES[cap.style] ? cap.style : null;
        const jobs = COVER_JOBS.filter((j) => L.hasWorkplaceFor(j));
        const job = jobs.length ? rng.pick(jobs) : 'laborer';
        // (A foreign name, if their own people's: or one borrowed from here.)
        const own = L.settlement.style || 'vale';
        const foreign = !!fstyle && fstyle !== own && rng.chance(0.55);
        const style = foreign ? fstyle : own;
        const name = personName(rng, style, familyName(rng, style));
        const look = { hat: rng.pick(['hood', 'hood', null, 'cap']) };
        // (Some mean to lead the town when the mayor's gone; some only to
        // see it fall.)
        th.vars.ambition = rng.chance(0.4);
        const amb = th.vars.ambition;
        const r = newcomer(S.sim, L, { name, look, personality: { kindness: amb ? 0.95 : 0.5, sociability: amb ? 0.9 : 0.45, diligence: 0.85 }, traits: rng.shuffle(['kind', 'hardworking', 'well-traveled', 'witty', 'generous', 'honest']).slice(0, 2), job, why: 'arrived' });
        if (!r.look.hat || r.look.hat === 'cap') r.look.hat = look.hat === 'cap' ? (r.look.hat || null) : look.hat;
        r.arrivedDay = S.day;
        r.foreignName = foreign;
        r.coverJob = r.job;
        r.spy = th.id;
        r.skills ||= {};
        if (amb) r.skills.trading = Math.max(r.skills.trading || 0, 0.5);
        else r.skills.trading = Math.min(r.skills.trading || 0, 0.15);
        th.cast.spy = R.rec(th.sid, r.idx);
        th.names.spy = fullName(r);
        th.vars.code = pick(rng, SPY_NAMES);
        th.vars.since = S.day;
        th.vars.nature = S.choose(th, [{ to: 'cold', w: 1 }, { to: 'coward', w: 0.8 }, { to: 'zealot', w: 0.7 }], rng).to;
        th.vars.deeds = 0;
        th.vars.strike = S.day + rng.int(10, 18);
        th.vars.found = {};
        th.vars.wrong = {};
        // (Not the only new face this season: others come to live here
        // too, for their own reasons, about the same time.)
        th.vars.decoys = [];
        for (let i = 0; i < rng.int(1, 2); i++) {
          const dj = jobs.length ? rng.pick(jobs) : 'laborer';
          const dforeign = rng.chance(0.35) && !!fstyle;
          const dstyle = dforeign ? fstyle : own;
          const d = newcomer(S.sim, L, { name: personName(rng, dstyle, familyName(rng, dstyle)), look: { hat: rng.pick(['hood', null, null]) }, job: dj, why: 'arrived' });
          d.arrivedDay = S.day - rng.int(0, 6);
          d.foreignName = dforeign;
          d.coverJob = d.job;
          th.vars.decoys.push(d.idx);
          ledger(L, d.arrivedDay, `${fullName(d)} has come to live in ${L.settlement.name}, ${pick(rng, ['with a cousin', 'to work as a ' + dj, 'from somewhere down the coast', 'after the fire that took their old home'])}.`);
        }
        ledger(L, S.day, `${fullName(r)} has come to live in ${L.settlement.name}, ${pick(rng, ['looking for work', 'after a hard year somewhere else', 'with nothing but a pack and a smile', 'and taken up work as a ' + job])}.`);
        S.note(th, `${fullName(r)} came to ${L.settlement.name}: an agent of ${civName(foe)}, who call them ${th.vars.code}.`, { hidden: true });
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.spy);
        if (!L || !r || !alive(r)) return S.end(th, 'faded');
        // Good deeds, and friends made.
        if (rng.chance(0.45)) {
          const o = pick(rng, adults(L).filter((q) => q !== r));
          th.vars.deeds++;
          ledger(L, S.day, pick(rng, DEEDS).replace('{s}', fullName(r)).replace('{o}', o ? fullName(o) : 'a neighbour'));
          if (o) {
            r.friends = [...new Set([...(r.friends || []), o.idx])];
            o.friends = [...new Set([...(o.friends || []), r.idx])];
          }
        }
        const m = mayorOf(L);
        if (m && rng.chance(0.3) && !(r.friends || []).includes(m.idx)) {
          r.friends = [...(r.friends || []), m.idx];
          m.friends = [...new Set([...(m.friends || []), r.idx])];
          S.note(th, `${fullName(m)}, the ${L.settlement.type === 'village' ? 'elder' : 'mayor'}, has taken a liking to ${fullName(r)}: supper at their house, twice this week.`, { hidden: true });
        }
        // (Now and then, a letter in cipher under a stone at the edge of town.)
        if (rng.chance(0.25)) S.note(th, `In the night, ${r.name.first} left a letter in cipher under a stone by the ${quarterOf(L, r) || 'east'} road.`, { hidden: true });
        // A quarrel at the council, a debt: others with reasons to wish the mayor gone.
        if (!th.vars.herrings && S.day >= th.vars.strike - 3) herrings(th, S, rng, L);
        if (S.day >= th.vars.strike) S.go(th, 'murder');
      },
      fade: 40,
    },
    // The mayor dies, and it's taken for something else.
    murder: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.spy);
        const m = L && mayorOf(L);
        if (!L || !r || !m) return S.end(th, 'faded');
        if (!th.vars.herrings) herrings(th, S, S.rng(th, 0x4e7), L);
        const rng = S.rng(th, 0x3a1);
        const how = methodOf(r.job);
        th.cast.mayor = R.rec(th.sid, m.idx);
        th.names.mayor = fullName(m);
        th.vars.dead = `${L.settlement.type === 'village' ? 'Elder' : 'Mayor'} ${fullName(m)}`;
        th.vars.said = how.said;
        th.vars.body = how.body;
        th.vars.killedAt = S.now;
        S.retitle(th, `The Death of ${th.vars.dead}`);
        S.sim.recordDeath(L, m, how.said, null);
        S.note(th, `${th.vars.dead} of ${L.settlement.name} died in the night: ${how.said}, they say. The town mourns.`, { news: [th.sid] });
        S.note(th, `It was ${th.names.spy}: ${how.m === 'poison' ? 'poison, in a cup of something warm' : how.m === 'blow' ? 'a blow from behind, and the body arranged at the foot of the stairs' : how.m === 'drown' ? 'held under in the millpond' : 'a pillow, and a long minute'}.`, { hidden: true });
        // Who saw something: each one thing (and one of them wrong).
        const since = S.day - 40;
        const f = facets(L, r, since);
        th.vars.facet = f;
        const keys = rng.shuffle(['hair', 'head', 'smell', 'quarter', 'newcomer', 'foreign']).filter((k) => f[k] !== null);
        const bystanders = rng.shuffle(adults(L).filter((q) => q !== r && q !== m && !(th.vars.herringIdx || []).includes(q.idx) && q.job !== 'guard'));
        const wits = [];
        for (const k of keys.slice(0, 5)) {
          const w = bystanders.shift();
          if (!w) break;
          wits.push({ idx: w.idx, k, v: f[k], text: clueText(rng, k, f[k]), told: [] });
        }
        // (How many in town fit everything the true witnesses saw: the
        // one who did it, at least. Kept, to know it can be worked out.)
        const fits = adults(L).filter((q) => q !== m && alive(q) && wits.every((w) => facets(L, q, since)[w.k] === w.v));
        th.vars.fits = fits.length;
        // The mistaken one: sure of something that points elsewhere.
        const h0 = (th.vars.herringIdx || []).map((i) => L.npcs[i]).find(Boolean);
        const w2 = bystanders.shift();
        if (h0 && w2) {
          const hf = facets(L, h0, since);
          const k = ['hair', 'head', 'quarter'].find((q) => hf[q] !== f[q] && hf[q] !== null);
          if (k) wits.push({ idx: w2.idx, k, v: hf[k], text: clueText(rng, k, hf[k]), told: [], wrong: true });
        }
        // The herrings' alibis: someone who can vouch for them (if asked).
        for (const i of th.vars.herringIdx || []) {
          const w = bystanders.shift();
          const h = L.npcs[i];
          if (w && h) wits.push({ idx: w.idx, k: 'alibi', v: i, text: pick(rng, [`${fullName(h)}? They were at the tavern till past midnight. I poured their ale myself, and walked them home.`, `${fullName(h)} was sat up with me all that night: my mother was poorly. They never left the house.`, `${fullName(h)}? No. They were at the mill with me, fixing the wheel, till dawn.`]), told: [], about: i });
        }
        th.vars.wits = wits;
        // The stone the letters were left under.
        const q = f.quarter || 'east';
        const mid = townMid(L.settlement);
        const b = L.settlement.bounds;
        const at = q === 'east' ? { x: b.x1 + 3, z: mid.z } : q === 'west' ? { x: b.x0 - 3, z: mid.z } : q === 'south' ? { x: mid.x, z: b.z1 + 3 } : q === 'north' ? { x: mid.x, z: b.z0 - 3 } : { x: b.x1 + 3, z: mid.z };
        th.vars.stone = at;
        const kid = L.npcs.find((q2) => alive(q2) && q2.age === 'child' && !q2.away);
        th.vars.child = kid ? kid.idx : null;
        // The healer who laid them out.
        const healer = L.npcs.find((q2) => alive(q2) && !q2.away && q2.job === 'herbalist' && q2 !== r) || L.npcs.find((q2) => alive(q2) && !q2.away && q2.job === 'priest' && q2 !== r)
          || L.npcs.find((q2) => alive(q2) && !q2.away && q2.age !== 'child' && q2 !== r && ((m.children || []).includes(q2.idx) || m.partner === q2.idx))
          || L.npcs.find((q2) => alive(q2) && !q2.away && q2.age === 'elder' && q2 !== r);
        th.vars.healer = healer ? healer.idx : null;
        S.go(th, 'after');
      },
    },
    // The town gets on with it, and the agent waits for war.
    after: {
      enter(th, S) {
        th.vars.afterAt = S.now;
      },
      live(th, S) {
        // (The stone by the road: found by whoever's heard of it.)
        const at = th.vars.stone;
        if (!at) return;
        for (const { p, pid } of S.players()) {
          const fd = th.vars.found[pid];
          if (!fd || !fd.includes('stone') || fd.includes('cipher')) continue;
          if (Math.max(Math.abs(p.x - at.x), Math.abs(p.z - at.z)) > 3) continue;
          fd.push('cipher');
          const foe = civOf(S, th.vars.civ);
          const item = S.writeNote(th, 'letter', 'A Letter in Cipher', [
            'Most of it is in a cipher you can\'t read. A few words are plain, as if the writer was in a hurry:',
            '', `"...to the court of ${civName(foe)}... the old one trusts me now... it will look like ${th.vars.said}..."`, '', `It's signed with a drawing: ${th.vars.code === 'the Wren' ? 'a little bird' : th.vars.code === 'the Lantern' ? 'a lantern' : 'a mark you don\'t know'}. Not a name.`,
          ]);
          S.give(pid, item, 1);
          S.tell(pid, 'Under the flat stone by the road: a folded paper, damp, in cipher. (Read it: it\'s in your pack.)', '#c8a0ff');
        }
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.spy);
        if (!L || !r || !alive(r)) return S.end(th, 'faded', `${th.names.spy} is dead. Whatever they knew went into the ground with them.`, { hidden: true });
        // (Someone asking questions: the agent notices.)
        const asking = Object.values(th.vars.found).reduce((n, l) => n + l.length, 0);
        if (asking >= 4 && !th.vars.alarmed && rng.chance(0.3)) {
          th.vars.alarmed = true;
          alarm(th, S, rng, L, r);
        }
        // The agent, made mayor by the town that trusts them.
        if (r.job === 'mayor' && !th.vars.mayorNoted) {
          th.vars.mayorNoted = true;
          S.note(th, `${L.settlement.name} chose ${th.names.spy} to lead them. ${civName(civOf(S, th.vars.civ))} could not have asked for more.`, { hidden: true });
        }
        // (Long enough, and no war: called home, or settled in as theirs.)
        if ((S.now - th.vars.afterAt) / DAY > 45) {
          if (r.job === 'mayor' && rng.chance(0.6)) return S.end(th, 'puppet', `${th.names.spy} still leads ${L.settlement.name}. Their letters go to ${civName(civOf(S, th.vars.civ))} every week, and nobody reads them.`, { hidden: true });
          r.migrated = 'gone';
          r.away = true;
          if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
          ledger(L, S.day, `${fullName(r)} has left ${L.settlement.name}, as suddenly as they came. Everyone was sorry to see them go.`);
          S.end(th, 'vanished', `${th.names.spy} was called home. Nobody ever knew.`, { hidden: true });
        }
      },
      on: {
        war_declared(th, ev, S) {
          const ids = [ev.a, ev.b];
          if (!ids.includes(th.vars.civ) || !ids.includes(th.vars.home)) return;
          S.go(th, 'betrayal');
        },
      },
      fade: 80,
    },
    // War, and the agent opens the way.
    betrayal: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.spy);
        const rng = S.rng(th, 0xbe7);
        if (!L || !r || !alive(r)) return S.end(th, 'faded');
        const e = L.econ;
        const what = S.choose(th, [
          { to: 'granary', w: 1 },
          { to: 'well', w: 1 },
          { to: 'keys', w: (L.npcs.filter((q) => alive(q) && q.job === 'guard').length ? 1 : 0) },
          { to: 'treasury', w: e.treasury > 50 ? 1 : 0.2 },
        ], rng).to;
        let line;
        if (what === 'granary') {
          for (const k of Object.keys(e.stock || {})) if (typeof e.stock[k] === 'number') e.stock[k] = Math.floor(e.stock[k] * 0.3);
          line = `the night war was declared, the granary of ${L.settlement.name} burnt to the ground`;
        } else if (what === 'well') {
          for (const q of rng.shuffle(adults(L).filter((x) => x !== r)).slice(0, 6)) q.sick = true;
          line = `the morning after war was declared, half of ${L.settlement.name} woke sick: the well had been fouled`;
        } else if (what === 'keys') {
          const g = rng.pick(L.npcs.filter((q) => alive(q) && q.job === 'guard'));
          if (g) S.sim.recordDeath(L, g, 'a knife in the dark', null);
          line = `the night war was declared, a guard of ${L.settlement.name} was found dead at the gate, and the watch's keys were gone`;
        } else {
          const took = Math.floor(e.treasury * 0.8);
          e.treasury -= took;
          line = `the night war was declared, ¤${took} went missing from ${L.settlement.name}'s coffers`;
        }
        // (Gone to their own side.)
        r.migrated = 'gone';
        r.away = true;
        if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
        const foe = civOf(S, th.vars.civ);
        // (Now everyone knows: the story is told to all.)
        for (const { pid } of S.players()) S.reveal(th, pid);
        for (const pid of Object.keys(th.vars.found)) S.reveal(th, pid);
        S.end(th, 'betrayed', `${line[0].toUpperCase()}${line.slice(1)}. ${th.names.spy} was gone by morning: ${th.vars.code}, an agent of ${civName(foe)} all along, who killed ${th.vars.dead}. Too late, everyone remembers how kind they were.`, { news: [th.sid] });
      },
    },
  },
  ended(th, S) {
    const r = recOf(S, th.cast.spy);
    if (r && r.spy === th.id) r.spy = null;
  },
  // What you've found out (only what you have).
  journal(th, pid) {
    const out = [];
    const fd = th.vars.found[pid] || [];
    if (!fd.length) return out;
    out.push(['What you\'ve found out:', '#c8a0ff']);
    if (fd.includes('body')) out.push([`· The body (${th.vars.healerName || 'the healer'}): "${th.vars.body}"`, '#d8c8f0']);
    for (const w of th.vars.wits || []) if (fd.includes(`w${w.idx}`)) out.push([`· ${w.name || 'Someone'}: "${w.text}"`, '#d8c8f0']);
    if (fd.includes('stone')) out.push(['· A child saw someone hide a paper under the flat stone by the ' + (th.vars.facet && th.vars.facet.quarter && th.vars.facet.quarter !== 'middle' ? th.vars.facet.quarter : 'east') + ' road.', '#d8c8f0']);
    if (fd.includes('cipher')) out.push(['· The letter under the stone: someone writing to a foreign court, in cipher.', '#d8c8f0']);
    if (fd.includes('new')) out.push([`· New to town in the last weeks (the watch): ${th.vars.newList || 'nobody'}.`, '#d8c8f0']);
    for (const h of th.vars.herringNotes || []) if (fd.includes(`h${h.idx}`)) out.push([`· ${h.text}`, '#d8c8f0']);
    const wrong = th.vars.wrong[pid] || [];
    if (wrong.length) out.push([`Not them: ${wrong.join(', ')}.`, '#a08080']);
    out.push(['(Nobody will tell you who. When you\'re sure, say it to their face.)', '#8a8098']);
    return out;
  },
  townTalk(th, npc, pid, S) {
    if (th.node !== 'after' || !npc.rec || npc.rec.sid !== th.sid || (npc.rec.age === 'child' && th.vars.child !== npc.rec.idx)) return [];
    const out = [];
    const fd = th.vars.found[pid];
    const r = npc.rec;
    // Wondering about it at all: that's where it starts.
    if (!fd) {
      if (r.age !== 'child') out.push({ id: 'sgi_wonder', arg: tid(th), label: `${th.vars.dead}'s death... was it really ${th.vars.said}?` });
      return out;
    }
    if (r.idx === th.vars.healer && !fd.includes('body')) out.push({ id: 'sgi_body', arg: tid(th), label: `You laid out ${th.names.mayor}. Was there anything odd?` });
    const w = (th.vars.wits || []).find((q) => q.idx === r.idx);
    if (w && !fd.includes(`w${w.idx}`)) out.push({ id: 'sgi_saw', arg: tid(th), label: w.k === 'alibi' ? `Where was ${fullName(layoutOf(S, th.sid).npcs[w.about])} the night ${th.names.mayor} died?` : `The night ${th.names.mayor} died: did you see or hear anything?` });
    if (th.vars.child === r.idx && !fd.includes('stone')) out.push({ id: 'sgi_child', arg: tid(th), label: 'Seen anything strange lately?' });
    if (r.job === 'guard' && !fd.includes('new')) out.push({ id: 'sgi_new', arg: tid(th), label: 'Who\'s come to live here these last weeks?' });
    const h = (th.vars.herringNotes || []).find((q) => q.src === r.idx);
    if (h && !fd.includes(`h${h.idx}`)) out.push({ id: 'sgi_gossip', arg: `${tid(th)}:${h.idx}`, label: `Did anyone have a quarrel with ${th.names.mayor}?` });
    // Naming them: to their face.
    if (r.age !== 'child' && fd.length >= 2 && !(th.vars.wrong[pid] || []).includes(fullName(r)) && (th.vars.wrong[pid] || []).length < 3 && r.idx !== th.vars.healer) out.push({ id: 'sgi_accuse', arg: tid(th), label: `I know what you did to ${th.names.mayor}.` });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const L = layoutOf(S, th.sid);
    const rng = S.rng(th, 0x1a9 + (npc.id | 0));
    const fd = (th.vars.found[pid] ||= []);
    const r = npc.rec;
    switch (id) {
      case 'sgi_wonder': {
        // (Now it's yours to know.)
        S.reveal(th, pid);
        const wits = (th.vars.wits || []).filter((q) => q.k !== 'alibi');
        const w = wits.length ? L.npcs[pick(rng, wits).idx] : null;
        const hl = th.vars.healer !== null ? L.npcs[th.vars.healer] : null;
        S.note(th, `${nameOf(S, R.pl(pid))} has been asking whether ${th.vars.dead}'s death was what it seemed.`, { hidden: true });
        fd.push('asked');
        return { lines: [
          pick(rng, ['God rest them. Why do you ask? ...You don\'t think...?', 'That\'s what we were told. Why, what have you heard?', 'Strange you should ask. Some of us have wondered.']),
          `${hl ? `${fullName(hl)} laid them out: ask them.` : ''} ${w ? `And ${fullName(w)} was up that night, I think.` : ''}`.trim() || 'I don\'t know who\'d know more.',
          '(This is in your quest log now: O. What you find out goes there, as it\'s told to you.)',
        ] };
      }
      case 'sgi_body': {
        fd.push('body');
        th.vars.healerName = fullName(r);
        S.touch(th, pid);
        return { lines: [pick(rng, ['I\'ve said nothing to anyone. Who\'d listen?', 'Since you ask... and keep your voice down...']), th.vars.body] };
      }
      case 'sgi_saw': {
        const w = (th.vars.wits || []).find((q) => q.idx === r.idx);
        if (!w) return { lines: ['I was asleep.'] };
        fd.push(`w${w.idx}`);
        w.name = fullName(r);
        S.touch(th, pid);
        return { lines: [w.text, pick(rng, ['That\'s all I know.', 'I didn\'t think anything of it, then.', 'I\'ve told nobody else. I didn\'t want to be the one.'])] };
      }
      case 'sgi_child': {
        fd.push('stone');
        return { lines: ['I saw someone hide a paper under the big flat stone by the ' + (th.vars.facet && th.vars.facet.quarter && th.vars.facet.quarter !== 'middle' ? th.vars.facet.quarter : 'east') + ' road! At night! I was supposed to be asleep. Don\'t tell.', '(Go and look under the stone, just outside town on that side.)'] };
      }
      case 'sgi_new': {
        fd.push('new');
        const since = Math.floor(th.vars.killedAt / DAY) - 60;
        const list = L.npcs.filter((q) => alive(q) && !q.migrated && q.age !== 'child' && q.arrived && (q.arrivedDay ?? -1e9) >= since).map((q) => `${fullName(q)} (${q.coverJob && q.coverJob !== q.job ? `a ${q.coverJob}; ${q.job} now` : q.job})`);
        th.vars.newList = list.length ? list.join(', ') : 'nobody';
        return { lines: [list.length ? `New faces? A few. ${list.join('; ')}.` : 'Nobody new. Not for a long while.', 'Why? ...No, don\'t tell me.'] };
      }
      case 'sgi_gossip': {
        const hi = +String(arg).split(':')[1];
        const h = (th.vars.herringNotes || []).find((q) => q.idx === hi);
        if (!h) return { lines: ['Not that I know of.'] };
        fd.push(`h${h.idx}`);
        return { lines: [h.text] };
      }
      case 'sgi_accuse': {
        S.touch(th, pid);
        const spy = recOf(S, th.cast.spy);
        if (r !== spy) return accusedWrongly(th, S, rng, L, r, npc, pid);
        return unmasked(th, S, rng, L, spy, npc, pid);
      }
      default:
        return null;
    }
  },
  hello(th, a, npc) {
    return a.role === 'agent' ? pick(npc.rng, ['You should have left it alone.', 'For my country.', 'Nothing personal.']) : '...';
  },
  actorDown(th, a, by, S) {
    if (a.role !== 'agent') return;
    const L = layoutOf(S, th.sid);
    const pid = by && by.t === 'pl' ? by.pid : th.vars.accuser;
    const spy = recOf(S, th.cast.spy);
    if (spy && L) S.sim.recordDeath(L, spy, `killed, unmasked as a spy of ${civName(civOf(S, th.vars.civ))}`, by && by.t === 'pl' ? 'player' : null);
    if (pid) rewardFor(th, S, pid, 'fought');
    S.end(th, 'unmasked', `${th.names.spy}, unmasked as an agent of ${civName(civOf(S, th.vars.civ))}, drew a blade, and died by it.${pid ? ` ${nameOf(S, R.pl(pid))} saw through them.` : ''}`, { news: [th.sid] });
  },
});

// Others with reasons to wish the mayor gone (none of whom did it).
function herrings(th, S, rng, L) {
  th.vars.herrings = true;
  const r = recOf(S, th.cast.spy);
  const m = mayorOf(L);
  const pool = rng.shuffle(adults(L).filter((q) => q !== r && q !== m && q.job !== 'guard' && q.job !== 'priest'));
  const out = [];
  const notes = [];
  // A temper who quarrelled with them; someone who owed them; the one who'd step into their shoes.
  const hot = pool.find((q) => nat(q, 'temper') > 0.55 || has(q, 'hot-headed'));
  if (hot) {
    out.push(hot.idx);
    const why = pick(rng, ['the new tax', 'the well', 'a boundary stone', 'the mill dues', 'a dog']);
    ledger(L, S.day, `${fullName(hot)} and ${m ? fullName(m) : 'the mayor'} had a shouting match at the council over ${why}.`);
    const src = pool.find((q) => q !== hot && !out.includes(q.idx));
    if (src) notes.push({ idx: hot.idx, src: src.idx, text: `${fullName(hot)}, that's who. They had a shouting match with the mayor at the council, the week before, over ${why}. Swore they'd make them sorry.` });
  }
  const debtor = pool.find((q) => !out.includes(q.idx) && (q.coins || 0) < 10);
  if (debtor) {
    out.push(debtor.idx);
    const src = pool.find((q) => q !== debtor && !out.includes(q.idx) && !notes.some((n) => n.src === q.idx));
    if (src) notes.push({ idx: debtor.idx, src: src.idx, text: `${fullName(debtor)} owed the mayor money. A lot. The mayor was going to the magistrate about it. Now there's nobody to go.` });
  }
  th.vars.herringIdx = out;
  th.vars.herringNotes = notes;
}

// The agent hears someone's asking: they don't sit still.
function alarm(th, S, rng, L, r) {
  const how = S.choose(th, [
    { to: 'plant', w: 1 },
    { to: 'witness', w: th.vars.nature === 'cold' ? 1 : 0.3 },
    { to: 'charm', w: 0.8 },
  ], rng).to;
  if (how === 'plant') {
    // (A clue that points at someone else.)
    const h = (th.vars.herringIdx || []).map((i) => L.npcs[i]).find((q) => q && alive(q));
    const w = rng.pick(adults(L).filter((q) => q !== r && q !== h && !(th.vars.wits || []).some((x) => x.idx === q.idx)));
    if (h && w) {
      const k = ['hair', 'head'].find((q) => facets(L, h, 0)[q] !== th.vars.facet[q]) || 'hair';
      th.vars.wits.push({ idx: w.idx, k, v: facets(L, h, 0)[k], text: clueText(rng, k, facets(L, h, 0)[k]), told: [], wrong: true, planted: true });
      S.note(th, `${th.names.spy} heard someone was asking questions, and dropped a word in ${fullName(w)}'s ear about what they'd "seen" that night.`, { hidden: true });
    }
  } else if (how === 'witness') {
    // (One who saw too much: another accident.)
    const ws = (th.vars.wits || []).filter((q) => q.k !== 'alibi' && !q.wrong && L.npcs[q.idx] && alive(L.npcs[q.idx]));
    if (ws.length) {
      const w = rng.pick(ws);
      const v = L.npcs[w.idx];
      S.sim.recordDeath(L, v, rng.pick(['a fall from the hayloft', 'the cold, they say', 'a slip on the mill steps']), null);
      ledger(L, S.day, `${fullName(v)} was found dead: ${v.cause}. Two deaths in so short a time. People are uneasy.`);
      S.note(th, `${th.names.spy} silenced ${fullName(v)}, who had seen too much.`, { hidden: true });
    }
  } else {
    S.note(th, `${th.names.spy} has been extra kind to everyone lately: soup for the sick, a hand for anyone who needs one. Nobody could suspect them.`, { hidden: true });
    r.mood = 1;
  }
}

function accusedWrongly(th, S, rng, L, r, npc, pid) {
  (th.vars.wrong[pid] ||= []).push(fullName(r));
  repWith(S, L, r, -30);
  S.sim.changeRep(npc, -10);
  S.townSay(pid, th.sid, -4, false);
  S.note(th, `${nameOf(S, R.pl(pid))} accused ${fullName(r)} of killing ${th.names.mayor}. ${r.name.first} was ${pick(rng, ['horrified', 'furious', 'in tears'])}, and the town took their side.`, { hidden: true });
  // (The one who did it hears someone's asking.)
  if (!th.vars.alarmed && rng.chance(0.5)) {
    th.vars.alarmed = true;
    alarm(th, S, rng, L, recOf(S, th.cast.spy));
  }
  const left = 3 - th.vars.wrong[pid].length;
  return { lines: [
    pick(rng, ['WHAT? How dare you! I loved that old fool like my own family!', 'Me? I was nowhere near! Ask anyone!', '...You think I could... get out. Get OUT.']),
    left > 0 ? `(Word gets round that you're accusing people. ${left === 1 ? 'One more wrong guess and nobody in town will listen to you.' : 'Be surer next time.'})` : '(Nobody in town will listen to your accusations now.)',
  ], close: true };
}

function unmasked(th, S, rng, L, spy, npc, pid) {
  th.vars.accuser = pid;
  const nature = th.vars.nature;
  const foe = civOf(S, th.vars.civ);
  // (Caught: how they take it.)
  const ent = spy.ent && !spy.ent.dead ? spy.ent : null;
  if (nature === 'cold') {
    // They fight: there and then.
    const at = ent ? { x: Math.round(ent.x), z: Math.round(ent.z) } : townMid(L.settlement);
    if (ent) S.game.despawnNpc(ent);
    spy.away = true;
    const p = makePerson(new RNG(hash4(th.seed, 0xa6e)), L.settlement.style || 'vale', 'hunter');
    S.actor(th, {
      key: 'agent', kind: 'npc', role: 'agent', hostile: true, at,
      person: { ...p, name: spy.name, look: spy.look, title: th.vars.code[0].toUpperCase() + th.vars.code.slice(1) },
      orders: { target: pid, brave: true, cry: `For ${civName(foe)}!` },
    });
    S.note(th, `${nameOf(S, R.pl(pid))} named ${th.names.spy} to their face. ${th.names.spy} stopped smiling, and drew a knife.`, { news: [th.sid] });
    return { lines: ['...', `Clever. Too clever. ${civName(foe)} sends its regards.`], close: true };
  }
  if (nature === 'coward') {
    // They run: gone before the watch comes.
    spy.migrated = 'gone';
    spy.away = true;
    if (ent) S.game.despawnNpc(ent);
    rewardFor(th, S, pid, 'fled');
    S.end(th, 'fled', `${nameOf(S, R.pl(pid))} named ${th.names.spy} as ${th.names.mayor}'s killer. ${th.names.spy} ran that very hour, and was over the border by morning: an agent of ${civName(foe)} all along.`, { news: [th.sid] });
    return { lines: ['I... I don\'t know what you mean. Excuse me. I have to... excuse me.', '(They push past you, and run.)'], close: true };
  }
  // A true believer: they confess, proudly.
  if (S.sim.society && S.sim.society.exile) S.sim.society.exile(L, spy, S.day, rng, `murdering ${th.names.mayor} for ${civName(foe)}`);
  rewardFor(th, S, pid, 'confessed');
  S.end(th, 'unmasked', `${nameOf(S, R.pl(pid))} named ${th.names.spy} as ${th.names.mayor}'s killer, and ${th.names.spy} confessed it, proudly: an agent of ${civName(foe)}, sent to take the town. They were driven out in chains.`, { news: [th.sid] });
  return { lines: ['Yes. And I\'d do it again.', `${civName(foe)} will have this town, with me or without me. You've only slowed it down.`], close: true };
}

function rewardFor(th, S, pid, how) {
  const s = town(S, th.sid);
  const k = S.person(pid);
  k.fame += 6;
  const title = `Spy-catcher of ${s ? s.name : 'the Realm'}`;
  if (!k.titles.includes(title)) k.titles.push(title);
  S.asPid(pid, () => {
    S.sim.addRenown(th.sid, how === 'fled' ? 8 : 15, 'unmasking a spy');
    const left = S.game.player.give('coin', 60);
    if (left) S.game.spawnDrop('coin', left, S.game.player.x, S.game.player.y, S.game.player.z, true);
  });
  S.tell(pid, `The town gives you ¤60 from its coffers, and its thanks. ("${title}")`, '#ffe070');
  // (The realms hear of it.)
  const foe = civOf(S, th.vars.civ);
  const home = civOf(S, th.vars.home);
  if (foe && home && S.sim.realms.shift) S.sim.realms.shift(home, foe, -20, S.day);
  const L = layoutOf(S, th.sid);
  if (L) L.econ.treasury = Math.max(0, L.econ.treasury - 60);
}
