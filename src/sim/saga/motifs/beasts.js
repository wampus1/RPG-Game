// Beasts (round 52). A pack dens up out in the wilds near a town: wolves
// in the woods and on the open land, slimes and ghouls in the marshes,
// cinderlings on the ashlands, crawlers in Myrrow's fungus woods. Left
// alone it grows; it takes the town's sheep, then the town's people (a
// worker out alone; their kin don't forget). Grow big enough and one of
// them grows into something with a name the town whispers (the Grey
// Widow, the Gravemother), with a price on its head that rises with every
// life it takes. Out there you find the den itself (bones, a skull or
// two, the earth worn bare), and the pack about it; at night, for the
// things of the night. Kill the last of them (and the named one) and the
// den is done.
import { motif, R, refKey, nameOf } from '../core.js';
import { pick, say, fill, layoutOf, laidTowns, townMid, spotNear, directions, living, fullName, biomeAt, odds, town, townName, hours } from './lib.js';
import { mayorOf, ledger, DAY } from '../../econ.js';
import { B } from '../../../world/blocks.js';
import { GROUND } from '../../../config.js';

const KINDS = {
  wolf: { word: 'wolves', one: 'wolf', max: 7, alpha: ['the Grey Widow', 'Old Ragged-Ear', 'the Pale Hunter', 'Ashmane', 'the Hollow Howl', 'Ironjaw'], alphaWord: 'a great grey wolf', hp: 44, dmg: 4, night: false },
  ghoul: { word: 'ghouls', one: 'ghoul', max: 6, alpha: ['the Gravemother', 'Long-Fingers', 'the Lantern Eater', 'Old Hunger'], alphaWord: 'a ghoul the size of a man', hp: 40, dmg: 4, night: true },
  slime: { word: 'slimes', one: 'slime', max: 8, alpha: ['the Great Ooze', 'the Bog Heart', 'the Swallower'], alphaWord: 'a slime big as a cart', hp: 38, dmg: 3, night: true },
  cinderling: { word: 'cinderlings', one: 'cinderling', max: 6, alpha: ['the Ember Matron', 'the Coal-Eyed', 'Old Smoulder'], alphaWord: 'a cinderling that burns white', hp: 34, dmg: 5, night: true },
  shroom_crawler: { word: 'crawlers', one: 'crawler', max: 6, alpha: ['the Rotking', 'the Pale Bloom', 'Old Spore'], alphaWord: 'a crawler grown fat on the dead', hp: 46, dmg: 4, night: false },
};
const PLACES = ['Hollow', 'Dell', 'Rise', 'Thicket', 'Gully', 'Coppice', 'Old Quarry', 'Fallen Elm', 'Black Pool', 'Crow Stones', 'Bramblefold', 'Sour Mire', 'Gallows Oak', 'Witch Hollow'];

function speciesFor(S, x, z, rng) {
  const b = biomeAt(S, x, z) || 'forest';
  if (/ash|volcano|cinder|geyser/.test(b)) return 'cinderling';
  if (/fungal|moor|mangrove/.test(b) && S.game.world.ow.islandAt && S.game.world.ow.islandAt(x, z) === 'myrrow') return 'shroom_crawler';
  if (/swamp|jungle|mangrove/.test(b)) return rng.chance(0.5) ? 'slime' : 'ghoul';
  return rng.chance(0.85) ? 'wolf' : 'ghoul';
}

export function denOf(S, th) {
  return th.cast.den ? S.dens[th.cast.den.key] : null;
}

// A den put down out from a town.
export function makeDen(S, sid, rng, species = null) {
  const s = town(S, sid);
  const m = townMid(s);
  if (!m) return null;
  const at = spotNear(S, m.x, m.z, 60, 150, rng, { woods: true, clear: 18 });
  if (!at) return null;
  species ||= speciesFor(S, at.x, at.z, rng);
  const K = KINDS[species] || KINDS.wolf;
  const key = `d${S.day}x${at.x}z${at.z}`;
  const d = S.dens[key] = {
    key, species, name: `${K.one} den at ${pick(rng, PLACES)}`, x: at.x, z: at.z, near: sid, pack: 2 + rng.int(0, 1), max: K.max,
    alpha: null, cleared: false, born: S.now, raids: 0, kills: 0, built: false,
  };
  return d;
}

// Someone (or something) puts paid to a den, out of sight.
export function clearDen(S, d, by) {
  if (!d || d.cleared) return;
  d.pack = 0;
  const hadAlpha = d.alpha && !d.alpha.dead;
  if (hadAlpha) {
    d.alpha.dead = true;
    S.emit('beast_slain', { den: d.key, name: d.alpha.name, by, x: d.x, z: d.z });
  }
  d.cleared = true;
  S.emit('den_cleared', { den: d.key, by, x: d.x, z: d.z, near: d.near });
}

function buildDen(S, d) {
  if (d.built) return;
  const w = S.game.world;
  if (!w.regionAt(d.x, d.z)) return;
  d.built = true;
  const ops = [];
  const y = (x, z) => {
    const v = w.findStandY(x, z, GROUND);
    return v > 0 ? v : GROUND;
  };
  const marks = d.species === 'ghoul' ? [B.bones, B.cobweb, B.skull_pile, B.bones] : d.species === 'slime' ? [B.bones, B.roots, B.bones] : d.species === 'cinderling' ? [B.bones, B.ash, B.skull_pile] : [B.bones, B.skull_pile, B.bones, B.rock];
  const offs = [[0, 0], [2, 1], [-2, 1], [1, -2], [-1, 2], [3, -1]];
  offs.forEach(([dx, dz], i) => {
    const id = marks[i % marks.length];
    if (id === undefined) return;
    const x = d.x + dx;
    const z = d.z + dz;
    if (w.getBlock(x, y(x, z), z) !== B.air) return;
    ops.push([x, y(x, z), z, id, 0]);
  });
  if (ops.length) S.sim.setBlocks(ops);
}

function workersOf(L) {
  return living(L).filter((r) => r.age !== 'child' && ['lumberjack', 'trapper', 'farmer', 'herbalist', 'fisher', 'miner', 'laborer', 'shepherd'].includes(r.job));
}

// ------------------------------------------------------------ the den
motif({
  id: 'den',
  family: 'beasts',
  max: 8,
  key: (o) => o.vars.denKey,
  title: (th, S) => {
    const d = denOf(S, th);
    return d ? `The ${d.name}` : 'A den in the wilds';
  },
  // Now and then a pack dens up near a town that hasn't one.
  scan(S, rng) {
    const out = [];
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 5)) {
      const sid = L.settlement.id;
      const m = townMid(L.settlement);
      const near = Object.values(S.dens).filter((d) => !d.cleared && Math.hypot(d.x - m.x, d.z - m.z) < 320);
      if (near.length || !rng.chance(0.07)) continue;
      const d = makeDen(S, sid, rng);
      if (!d) continue;
      out.push({ cast: { den: R.den(d.key), town: R.town(sid) }, sid, vars: { denKey: d.key }, spots: [{ x: d.x, z: d.z }] });
    }
    return out;
  },
  anchors: (th, S) => {
    const d = denOf(S, th);
    return d ? [{ x: d.x, z: d.z }] : [];
  },
  nodes: {
    lair: {
      enter(th, S) {
        const d = denOf(S, th);
        if (!d) return S.end(th, 'faded');
        S.note(th, `A pack of ${KINDS[d.species].word} has denned up ${directions(town(S, d.near), d.x, d.z)}.`);
      },
      day(th, S, rng) {
        const d = denOf(S, th);
        if (!d || d.cleared) return S.go(th, 'cleared');
        const K = KINDS[d.species];
        if (d.pack < d.max && rng.chance(0.45)) d.pack++;
        // One of them grows into something with a name.
        if (!d.alpha && d.pack >= 5 && rng.chance(0.35)) {
          d.alpha = { name: pick(rng, K.alpha), hp: K.hp, maxHp: K.hp, dmg: K.dmg, kills: 0, born: S.now };
          S.note(th, `Folk round ${townName(S, d.near)} have started whispering of ${d.alpha.name}: ${K.alphaWord}.`, { news: [d.near] });
          S.spawn(th, 'alpha', { cast: { den: R.den(d.key), town: R.town(d.near) }, sid: d.near, vars: { denKey: d.key } });
        }
        // Out after the town's flocks, or its people.
        if (d.pack >= 3 && rng.chance(0.04 + d.pack * 0.02 + (d.alpha ? 0.08 : 0))) raid(th, S, d, rng);
      },
      live(th, S) {
        const d = denOf(S, th);
        if (!d) return;
        if (S.nearest([{ x: d.x, z: d.z }]) <= 50) buildDen(S, d);
        const K = KINDS[d.species];
        const show = Math.min(d.pack, 5);
        for (let i = 0; i < 5; i++) {
          const k = `p${i}`;
          const a = S.actorSpec(th, k);
          if (i < show) {
            if (!a || a.dead) {
              S.actor(th, { key: k, kind: 'beast', role: 'pack', species: d.species, hostile: true, night: K.night, at: { x: d.x + ((i * 3) % 5) - 2, z: d.z + ((i * 2) % 5) - 2 }, orders: { home: { x: d.x, z: d.z } } });
            }
          } else if (a && !a.dead && !a.gone) S.dismissActor(th, k);
        }
        if (d.alpha && !d.alpha.dead) {
          const a = S.actorSpec(th, 'alpha');
          if (!a || a.dead) S.actor(th, { key: 'alpha', kind: 'beast', role: 'alpha', species: d.species, hostile: true, night: K.night, name: d.alpha.name, maxHp: d.alpha.maxHp, hp: d.alpha.hp, dmg: d.alpha.dmg, at: { x: d.x, z: d.z }, orders: { home: { x: d.x, z: d.z } } });
        }
      },
      on: {
        den_cleared(th, ev, S) {
          if (ev.den !== th.vars.denKey) return;
          S.go(th, 'cleared', null);
        },
      },
      fade: 60,
    },
    cleared: {
      enter(th, S) {
        const d = denOf(S, th);
        if (d) d.cleared = true;
        S.note(th, `The ${d ? d.name : 'den'} is done with.`);
      },
      final: true,
    },
  },
  // One of the pack (or the named one) killed in front of someone.
  actorDown(th, a, by, S) {
    const d = denOf(S, th);
    if (!d) return;
    if (a.role === 'alpha' && d.alpha) {
      d.alpha.dead = true;
      S.emit('beast_slain', { den: d.key, name: d.alpha.name, by, x: a.at ? a.at.x : d.x, z: a.at ? a.at.z : d.z });
    } else {
      d.pack = Math.max(0, d.pack - 1);
      // (The rest of the pack comes out for whoever did it.)
      a.dead = true;
    }
    // Put a fresh key on the spot, so the next one stands in for it.
    th.actors = th.actors.filter((q) => q !== a);
    if (d.pack <= 0 && (!d.alpha || d.alpha.dead)) {
      d.cleared = true;
      S.emit('den_cleared', { den: d.key, by, x: d.x, z: d.z, near: d.near });
    }
  },
});

// The pack goes for the town's sheep, or its people.
function raid(th, S, d, rng) {
  const L = layoutOf(S, d.near);
  if (!L) return;
  const K = KINDS[d.species];
  d.raids++;
  const ws = workersOf(L);
  if (ws.length && rng.chance(0.4 + (d.alpha ? 0.2 : 0))) {
    const v = rng.pick(ws);
    const killed = rng.chance(d.alpha ? 0.3 : 0.12);
    if (killed) {
      d.kills++;
      if (d.alpha) d.alpha.kills++;
      S.note(th, `${fullName(v)} went out to work and never came back. The ${K.word} had them${d.alpha ? `; folk say it was ${d.alpha.name}` : ''}.`, { news: [d.near] });
      S.emit('den_raid', { den: d.key, sid: d.near, victim: R.rec(d.near, v.idx), killed: true, alpha: !!d.alpha });
      S.sim.recordDeath(L, v, `killed by ${K.word}`, null);
    } else {
      v.hp = Math.max(1, Math.round((v.hp ?? v.maxHp ?? 20) * 0.4));
      S.note(th, `${fullName(v)} was mauled by ${K.word} out past ${L.settlement.name}, and only just made it home.`, { news: [d.near] });
      S.emit('den_raid', { den: d.key, sid: d.near, victim: R.rec(d.near, v.idx), killed: false, alpha: !!d.alpha });
    }
  } else {
    const n = rng.int(1, 3);
    S.note(th, pick(rng, [`${K.word[0].toUpperCase()}${K.word.slice(1)} got into the folds at ${L.settlement.name} in the night and took ${n} sheep.`, `A farmer of ${L.settlement.name} found ${n === 1 ? 'a ewe' : `${n} sheep`} torn open at dawn. ${K.word[0].toUpperCase()}${K.word.slice(1)}.`, `The dogs of ${L.settlement.name} howled all night: ${K.word} at the fences.`]), { news: [d.near] });
    S.emit('den_raid', { den: d.key, sid: d.near, livestock: n });
    if (L.econ.recent) L.econ.recent.violence = (L.econ.recent.violence || 0) + 1;
  }
}

// ------------------------------------------------------------ the named one
motif({
  id: 'alpha',
  family: 'beasts',
  max: 5,
  key: (o) => o.vars.denKey,
  title: (th, S) => {
    const d = denOf(S, th);
    return d && d.alpha ? `The Hunt for ${d.alpha.name.replace(/^the /, 'the ')}` : 'A beast with a name';
  },
  anchors: (th, S) => {
    const d = denOf(S, th);
    return d ? [{ x: d.x, z: d.z }] : [];
  },
  nodes: {
    prowl: {
      enter(th, S) {
        const d = denOf(S, th);
        if (!d || !d.alpha) return S.end(th, 'faded');
        const L = layoutOf(S, d.near);
        const m = L ? mayorOf(L) : null;
        const K = KINDS[d.species];
        const bounty = 40 + d.alpha.kills * 20;
        S.post(th, {
          role: 'hunt', kind: 'hunt', title: `Hunt down ${d.alpha.name}`, sid: d.near, giver: m ? R.rec(d.near, m.idx) : null,
          pitch: `There's ${K.alphaWord} out there we call ${d.alpha.name}. It runs with the ${K.word} at the ${d.name}, ${directions(town(S, d.near), d.x, d.z)}. ${d.alpha.kills ? `It's taken ${d.alpha.kills} of ours already.` : 'It\'s not taken anyone yet. Yet.'} The council will pay ¤${bounty} for proof it's dead.`,
          at: { x: d.x, z: d.z }, r: 30, target: R.den(d.key), reward: { coins: bounty, from: R.town(d.near), rep: 8, renown: d.near, renownPts: 6, renownWhy: `killing ${d.alpha.name}`, fame: 4, items: [['leather', 3]] },
          data: { bounty },
        });
      },
      day(th, S) {
        const d = denOf(S, th);
        if (!d) return S.end(th, 'faded');
        // Its price goes up with every life it takes.
        const t = S.tasksOf(th, 'hunt')[0];
        if (t && d.alpha && t.data.bounty < 40 + d.alpha.kills * 20) {
          t.data.bounty = 40 + d.alpha.kills * 20;
          t.reward.coins = t.data.bounty;
          t.title = `Hunt down ${d.alpha.name} (¤${t.data.bounty})`;
        }
      },
      on: {
        beast_slain(th, ev, S) {
          if (ev.den !== th.vars.denKey) return;
          const t = S.tasksOf(th, 'hunt')[0];
          if (t) S.complete(t, ev.by || R.town(th.sid));
          S.go(th, 'slain', `${ev.name} is dead${ev.by ? `, brought down by ${nameOf(S, ev.by)}` : ''}.`, { news: nearTowns(S, th) });
          if (ev.by && ev.by.t === 'pl') {
            const k = S.person(ev.by.pid);
            k.fame += 3;
            if (!k.titles.includes(`Slayer of ${ev.name.replace(/^the /, 'the ')}`)) k.titles.push(`Slayer of ${ev.name.replace(/^the /, 'the ')}`);
          }
        },
        den_cleared(th, ev, S) {
          if (ev.den !== th.vars.denKey) return;
          const d = denOf(S, th);
          // The den's gone, but the named one got away: it roams.
          if (d && d.alpha && !d.alpha.dead) {
            const rng = S.rng(th, 0xa1f);
            const m = townMid(town(S, d.near));
            const at = spotNear(S, m.x, m.z, 120, 220, rng, { woods: true });
            if (at) {
              const nd = makeDen(S, d.near, rng, d.species);
              if (nd) {
                nd.alpha = d.alpha;
                nd.pack = 1;
                nd.x = at.x;
                nd.z = at.z;
                d.alpha = null;
                th.vars.denKey = nd.key;
                th.cast.den = R.den(nd.key);
                S.spawn(th, 'den', { cast: { den: R.den(nd.key), town: R.town(nd.near) }, sid: nd.near, vars: { denKey: nd.key }, spots: [{ x: nd.x, z: nd.z }] });
                S.note(th, `${nd.alpha.name} got away from the den, and has gone to ground ${directions(town(S, nd.near), nd.x, nd.z)}.`, { news: [nd.near] });
                const t = S.tasksOf(th, 'hunt')[0];
                if (t) t.at = { x: nd.x, z: nd.z };
                return;
              }
            }
          }
        },
        den_raid(th, ev, S) {
          if (ev.den !== th.vars.denKey || !ev.killed || !ev.alpha) return;
          const d = denOf(S, th);
          if (d && d.alpha && d.alpha.kills >= 3 && !th.vars.dread) {
            th.vars.dread = true;
            S.note(th, `${d.alpha.name} has taken ${d.alpha.kills} lives now. Folk in ${townName(S, d.near)} won't walk out after dark.`, { news: nearTowns(S, th) });
          }
        },
      },
      fade: 40,
    },
    slain: {
      enter(th, S) {
        const d = denOf(S, th);
        if (d && d.alpha) d.alpha.dead = true;
      },
      final: true,
    },
  },
  tasks: {
    hunt: {
      npcs: { adv: 0.15, guard: 0 },
      npcPace: 0.25,
      // An adventurer goes after it, out of sight.
      npcTry(th, t, who, S, rng) {
        const d = denOf(S, th);
        if (!d || !d.alpha || d.alpha.dead) return;
        const a = S.strengthOf(who);
        if (rng.chance(odds(a, 4 + d.alpha.kills * 0.4) * 0.5)) {
          d.alpha.dead = true;
          S.emit('beast_slain', { den: d.key, name: d.alpha.name, by: who, x: d.x, z: d.z });
        } else if (rng.chance(0.25)) {
          hurtOrKill(S, who, rng, `went after ${d.alpha.name}`, d);
          S.drop(t, who);
        }
      },
      offer: (th, t) => [`Bring me proof and the coin's yours.`],
      status: (th, t, pid, S) => {
        const d = denOf(S, th);
        return d && d.alpha ? [`${d.alpha.name} still lives. It's been seen near the ${d.name}.`] : ['Is it dead?'];
      },
      thanks: (th, t, pid, S) => ['They\'ll sing about this in the tavern for years. Here\'s the bounty, and the town\'s thanks.'],
    },
  },
});

function nearTowns(S, th) {
  const d = denOf(S, th);
  const s = d ? town(S, d.near) : null;
  if (!s) return th.sid !== null ? [th.sid] : [];
  return S.game.world.ow.settlements.filter((o) => !o.deserted && Math.hypot(o.cx - s.cx, o.cz - s.cz) < 8).map((o) => o.id);
}

// An adventurer (or one of the watch) who went after something and came off
// worse.
export function hurtOrKill(S, who, rng, what, d = null) {
  if (who.t === 'adv') {
    const a = S.sim.adventurers.get(who.id);
    if (!a) return;
    a.hp = Math.max(1, a.hp - rng.int(8, 20));
    if (rng.chance(0.2 / Math.max(1, a.level))) {
      S.sim.adventurers.died(a.id, 'killed');
      const L = layoutOf(S, d ? d.near : a.at);
      if (L) ledger(L, S.day, `${a.name.first} ${a.name.last} ${what}, and didn't come back.`);
      S.emit('adv_died', { adv: a.id, cause: what, den: d ? d.key : null });
    }
  } else if (who.t === 'rec') {
    const L = layoutOf(S, who.sid);
    const r = L && L.npcs[who.idx];
    if (!r) return;
    if (rng.chance(0.15)) S.sim.recordDeath(L, r, `killed when they ${what}`, null);
    else r.hp = Math.max(1, Math.round((r.hp ?? 20) * 0.5));
  }
}

export { KINDS as BEASTS, refKey, fill, say, workersOf, hours, DAY };
