// The command console (the ` or / key): cheats and testing aids, for getting
// about the world quickly and making things happen when you want to see them.
import { ITEMS } from '../world/items.js';
import { GROUND, REGION_W, REGION_D, WORLD_TILES_W, WORLD_TILES_D, DAY_MINUTES } from '../config.js';
import { alive, DAY } from '../sim/econ.js';
import { RNG, hash4 } from '../util/rng.js';
import { TECHS, BRANCHES } from '../sim/tech.js';

export const COMMANDS = {
  help: { args: '[command]', about: 'List the commands, or explain one.' },
  tp: { args: '<town> | <x> <z> | home', about: 'Teleport to a town (by name, or the start of one), to a spot in the world (tiles), or to where you wake up.' },
  teleport: { args: '[on|off]', about: 'While on, click anywhere you have seen on the world map (M) to teleport there.' },
  reveal: { args: '[off]', about: 'Show the whole world map (or hide what you haven\'t explored again).' },
  towns: { args: '', about: 'Every town, village and city, nearest first.' },
  where: { args: '', about: 'Where you are: tile, region and town.' },
  wedding: { args: '[now] [town]', about: 'Two single grown-ups get engaged: the wedding is in two days (or within a few hours, with "now").' },
  feast: { args: '[now] [town]', about: 'The council declares a feast day (two days off, or "now").' },
  fete: { args: '[now] [town]', about: 'A celebration of the town (two days off, or "now").' },
  street: { args: '[town]', about: 'The builders lay out a new street with lots along it.' },
  finish: { args: '[town]', about: 'Everything under construction in the town is finished at once.' },
  time: { args: '<hh:mm> | +<hours>', about: 'Wait until a time of day, or for so many hours (the world carries on).' },
  give: { args: '<item> [count]', about: 'Put something in your pack (by its key or name).' },
  coins: { args: '<count>', about: 'Add coins to your purse.' },
  heal: { args: '', about: 'Restore your health.' },
  god: { args: '[on|off]', about: 'Nothing can hurt you while it\'s on.' },
  skip: { args: '<days>', about: 'Fast-forward the world so many days (up to 120): towns, realms and wars all carry on.' },
  war: { args: '[realm] [on <realm>] | list | peace', about: 'Start a war: the first realm (yours, or the one you\'re in) declares war on the second. "list" names the realms; "peace" ends the wars of the realm you\'re in.' },
  erupt: { args: '[days]', about: 'The mountain on Kharos erupts now (or tells you how many days till it next does, with "days").' },
  learn: { args: '<step> | all | list [realm]', about: 'A realm (yours, or the one you\'re in) learns a step of the tree at once, by key or name, with whatever it needs first ("learn portals", "learn trade ships"); "all" learns everything it can; "list" names the steps.' },
};

// A realm by name (or part of it).
function civArg(game, q) {
  q = String(q || '').trim().toLowerCase().replace(/^the /, '');
  if (!q) return null;
  const civs = game.world.ow.civs.filter((c) => game.sim.realms.members(c).length);
  const nm = (c) => c.name.toLowerCase().replace(/^the /, '');
  return civs.find((c) => nm(c) === q) || civs.find((c) => nm(c).startsWith(q)) || civs.find((c) => nm(c).includes(q)) || null;
}

const hod = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

// A town by name (or the start of it), or the one you're in.
function townArg(game, words) {
  const ow = game.world.ow;
  const q = words.join(' ').trim().toLowerCase();
  if (!q) {
    const p = game.player;
    return game.currentSettlement || ow.settlementAt(p.x, p.z) || null;
  }
  return ow.settlements.find((s) => s.name.toLowerCase() === q) || ow.settlements.find((s) => s.name.toLowerCase().startsWith(q)) || ow.settlements.find((s) => s.name.toLowerCase().includes(q)) || null;
}

// Somewhere to stand at (x, z): the nearest open spot.
export function teleportTo(game, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  x = Math.max(1, Math.min(WORLD_TILES_W - 2, Math.round(x)));
  z = Math.max(1, Math.min(WORLD_TILES_D - 2, Math.round(z)));
  game.loadAround(x, z, true);
  const spot = game.findFreeSpot(x, z, GROUND);
  game.teleportPlayer(spot.x, spot.y, spot.z);
  // (A town you land in comes to life at once.)
  game.updateSettlements?.(true);
  return spot;
}

// Where a town's heart is (its square).
function townCentre(game, s) {
  const L = game.sim.layoutOf(s.id) || game.world.getLayout(s);
  if (L && L.plaza) return { x: L.plaza.cx, z: L.plaza.cz + (L.plaza.d ? Math.ceil(L.plaza.d / 2) + 1 : 3) };
  return { x: (s.bounds.x0 + s.bounds.x1) / 2, z: (s.bounds.z0 + s.bounds.z1) / 2 };
}

// Two single grown-ups of different families (not related) who could wed.
function couple(sim, L) {
  const taken = sim.events.engaged(L);
  const single = (r) => r.partner === null || r.partner === undefined || !alive(L.npcs[r.partner]);
  const adults = L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor && r.age === 'adult' && single(r) && r.job !== 'merchant' && !taken.has(r.idx));
  const related = (a, b) => a.parents.includes(b.idx) || b.parents.includes(a.idx) || a.parents.some((p) => b.parents.includes(p));
  for (const a of adults) {
    const b = adults.find((q) => q !== a && q.household !== a.household && !related(a, q));
    if (b) return [a, b];
  }
  return null;
}

function eventCmd(game, kind, words) {
  const sim = game.sim;
  const now = words[0] === 'now' || words[0] === 'soon';
  const s = townArg(game, now ? words.slice(1) : words);
  if (!s) return ['No such town (or you\'re not in one). Try "towns".'];
  if (s.deserted || s.condition === 'abandoned') return [`${s.name} is deserted.`];
  const L = sim.layoutOf(s.id);
  if (!L || !L.econ) return [`${s.name} has nobody to hold one.`];
  const day = game.day;
  const soon = now ? sim.now() + 120 : null;
  let ev;
  if (kind === 'wedding') {
    const pair = couple(sim, L);
    if (!pair) {
      const elsewhere = game.world.ow.settlements.filter((o) => o !== s && !o.deserted && o.condition !== 'abandoned').filter((o) => {
        const OL = sim.layoutOf(o.id);
        return OL && OL.econ && couple(sim, OL);
      });
      return [`Nobody in ${s.name} is free to marry just now.${elsewhere.length ? ` There are sweethearts in ${elsewhere.slice(0, 4).map((o) => o.name).join(', ')}.` : ''}`];
    }
    ev = sim.events.wedding(L, pair[0], pair[1], day, soon);
    const [a, b] = pair;
    return [`${a.name.first} ${a.name.last} and ${b.name.first} ${b.name.last} are to be married in ${s.name}: day ${ev.day}, ${hod(ev.s % DAY)}.`];
  }
  if (kind === 'feast') ev = sim.events.feast(L, day, 0, soon);
  else ev = sim.events.fete(L, day, s.type, soon);
  return [`${kind === 'feast' ? 'A feast day' : 'A celebration'} in ${s.name}: day ${ev.day}, from ${hod(ev.s % DAY)}.`];
}

// Run one line typed at the console; returns what it has to say.
export function runCommand(game, text) {
  const words = String(text || '').trim().replace(/^\//, '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const cmd = words.shift().toLowerCase();
  const sim = game.sim;
  const p = game.player;
  const ow = game.world.ow;
  switch (cmd) {
    case 'learn': {
      const T = sim.tech;
      const all = Object.keys(TECHS);
      const first = (words[0] || '').toLowerCase();
      if (!first) return ['learn <step> | all | list [realm]: e.g. "learn portals", "learn trade ships".'];
      if (first === 'list') return ['The steps of the tree:', ...BRANCHES.map((b) => `${b.name}: ${all.filter((k) => TECHS[k].branch === b.id).map((k) => k).join(', ')}`)];
      // (Which realm: named at the end, or yours, or the one you're in.)
      const here = game.currentSettlement || ow.settlementAt(p.x, p.z);
      const mine = sim.citizen ? ow.settlements[sim.citizen.sid] : null;
      let civ = null;
      let rest = words;
      for (let i = 1; i < words.length && !civ; i++) {
        const c = civArg(game, words.slice(i).join(' '));
        if (c) {
          civ = c;
          rest = words.slice(0, i);
        }
      }
      civ ||= (mine && mine.civ) || (here && here.civ) || null;
      if (!civ) return ['There\'s no realm here to teach: name one at the end ("war list" names them).'];
      const q = rest.join(' ').toLowerCase().replace(/[_-]/g, ' ').trim();
      if (q === 'all') {
        const st = T.stateOf(civ);
        let n = 0;
        for (let pass = 0; pass < 8; pass++) {
          for (const k of all.sort((a, b) => TECHS[a].tier - TECHS[b].tier)) if (!st.done.includes(k) && T.ready(st, k) && T.learn(civ, k, game.day)) n++;
        }
        return [`The ${civ.name.replace(/^The /, '')} has learned ${n} more step${n === 1 ? '' : 's'} (${st.done.length} of ${all.length}; the other side of each choice is barred).`];
      }
      const id = all.find((k) => k.replace(/_/g, ' ') === q) || all.find((k) => TECHS[k].name.toLowerCase() === q)
        || all.find((k) => TECHS[k].name.toLowerCase().startsWith(q) || k.startsWith(q.replace(/ /g, '_'))) || all.find((k) => TECHS[k].name.toLowerCase().includes(q));
      if (!id) return [`No step called "${q}": "learn list" names them.`];
      const st = T.stateOf(civ);
      if (st.done.includes(id)) return [`The ${civ.name.replace(/^The /, '')} knows ${TECHS[id].name} already.`];
      if (T.barred(st, id)) return [`The ${civ.name.replace(/^The /, '')} chose otherwise: ${TECHS[id].name} is barred to it.`];
      const got = T.learnWithPrereqs(civ, id, game.day);
      if (!got.includes(id)) return [`Couldn't learn ${TECHS[id].name}: something it needs is barred.`];
      return [`The ${civ.name.replace(/^The /, '')} has learned ${got.map((k) => TECHS[k].name).join(', ')}.`, TECHS[id].desc];
    }
    case 'help':
    case '?': {
      if (words[0] && COMMANDS[words[0]]) {
        const c = COMMANDS[words[0]];
        return [`${words[0]} ${c.args}`, c.about];
      }
      return ['Commands:', ...Object.entries(COMMANDS).map(([k, c]) => `${k}${c.args ? ` ${c.args}` : ''}`), '("help <command>" for more; [TAB] completes, [↑↓] history)'];
    }
    case 'tp': {
      if (!words.length) return ['tp <town> | <x> <z> | home'];
      if (words.length === 2 && words.every((w) => /^-?\d+$/.test(w))) {
        const spot = teleportTo(game, Number(words[0]), Number(words[1]));
        return [`Teleported to ${spot.x}, ${spot.z}.`];
      }
      if (words[0] === 'home' || words[0] === 'spawn') {
        const sp = p.spawn;
        const spot = teleportTo(game, sp.x, sp.z);
        return [`Teleported to where you wake up (${spot.x}, ${spot.z}).`];
      }
      const s = townArg(game, words);
      if (!s) return [`No town called "${words.join(' ')}". Try "towns".`];
      const c = townCentre(game, s);
      teleportTo(game, c.x, c.z);
      return [`Teleported to ${s.name}.`];
    }
    case 'teleport': {
      const on = words[0] ? !/^(off|no|0|false)$/i.test(words[0]) : !game.cheats.mapTeleport;
      game.cheats.mapTeleport = on;
      return [on ? 'Map teleport on: click a place on the world map (M) to go there.' : 'Map teleport off.'];
    }
    case 'reveal': {
      game.revealMap = !/^(off|no|0|false)$/i.test(words[0] || '');
      return [game.revealMap ? 'The whole world map is revealed.' : 'The world map shows only what you\'ve explored.'];
    }
    case 'towns': {
      const list = [...ow.settlements].sort((a, b) => Math.hypot(a.cx * REGION_W - p.x, a.cz * REGION_D - p.z) - Math.hypot(b.cx * REGION_W - p.x, b.cz * REGION_D - p.z));
      return list.map((s) => `${s.name} (${s.type}${s.deserted || s.condition === 'abandoned' ? ', deserted' : ''})`);
    }
    case 'where': {
      const s = ow.settlementAt(p.x, p.z);
      return [`Tile ${Math.floor(p.x)}, ${Math.floor(p.z)} (height ${Math.floor(p.y)}); region ${Math.floor(p.x / REGION_W)}, ${Math.floor(p.z / REGION_D)}${s ? `; in ${s.name}` : ''}. Day ${game.day}, ${hod(game.minute)}.`];
    }
    case 'wedding':
    case 'feast':
    case 'fete':
      return eventCmd(game, cmd, words);
    case 'street': {
      const s = townArg(game, words);
      const L = s && sim.layoutOf(s.id);
      if (!L || !L.econ) return ['No such town (or you\'re not in one).'];
      const plan = sim.roads.planStreet(L);
      if (!plan) return [`There's no room for a new street in ${s.name}.`];
      sim.roads.startStreet(L, plan);
      return [`The builders of ${s.name} start on a new street (${plan.lots.length} lot${plan.lots.length === 1 ? '' : 's'}).`];
    }
    case 'finish': {
      const s = townArg(game, words);
      const L = s && sim.layoutOf(s.id);
      if (!L || !L.econ) return ['No such town (or you\'re not in one).'];
      let n = 0;
      for (const q of sim.works.projects.filter((q) => !q.done && q.sid === s.id)) {
        sim.works.finishNow(L, q);
        n++;
      }
      const c = sim.construction;
      if (c && c.sid === s.id && !c.done && !c.cancelled) {
        sim.finishHomeNow(L);
        n++;
      }
      sim.roads.startWaiting(L);
      return [n ? `Finished ${n} piece${n === 1 ? '' : 's'} of work in ${s.name}.` : `Nothing is being built in ${s.name}.`];
    }
    case 'time': {
      const w = words[0] || '';
      let hours;
      const rel = /^\+(\d+(?:\.\d+)?)h?$/.exec(w);
      const at = /^(\d{1,2})(?::(\d{2}))?$/.exec(w);
      if (rel) hours = Number(rel[1]);
      else if (at) {
        const target = Number(at[1]) * 60 + Number(at[2] || 0);
        hours = (((target - game.minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES / 60;
      } else return [`It's ${hod(game.minute)} on day ${game.day}. (time <hh:mm> | +<hours>)`];
      if (!(hours > 0) || hours > 72) return ['Between a minute and three days, please.'];
      game.startWait(hours, true);
      return [`Waiting until ${hod(game.minute + hours * 60)}${game.minute + hours * 60 >= DAY_MINUTES ? ` on day ${game.day + Math.floor((game.minute + hours * 60) / DAY_MINUTES)}` : ''}... (press any key to stop)`];
    }
    case 'give': {
      if (!words.length) return ['give <item> [count]'];
      const n = /^\d+$/.test(words[words.length - 1]) && words.length > 1 ? Number(words.pop()) : 1;
      const q = words.join(' ').toLowerCase();
      const key = ITEMS[q] ? q : ITEMS[q.replace(/ /g, '_')] ? q.replace(/ /g, '_') : Object.keys(ITEMS).find((k) => ITEMS[k].name && ITEMS[k].name.toLowerCase() === q) || Object.keys(ITEMS).find((k) => k.startsWith(q.replace(/ /g, '_')));
      if (!key) return [`No item called "${q}".`];
      const left = p.give(key, Math.max(1, Math.min(999, n)));
      if (left) game.spawnDrop(key, left, p.x, p.y, p.z, true);
      return [`You have ${n} more ${ITEMS[key].name || key}.`];
    }
    case 'coins':
    case 'money': {
      const n = Math.max(1, Math.min(100000, Number(words[0]) || 100));
      const left = p.give('coin', n);
      if (left) game.spawnDrop('coin', left, p.x, p.y, p.z, true);
      return [`+¤${n}.`];
    }
    case 'heal':
      p.hp = p.maxHp;
      return ['You feel fully restored.'];
    case 'god': {
      const on = words[0] ? !/^(off|no|0|false)$/i.test(words[0]) : !game.cheats.god;
      game.cheats.god = on;
      if (on) p.hp = p.maxHp;
      return [on ? 'God mode on: nothing can hurt you.' : 'God mode off.'];
    }
    case 'erupt':
    case 'volcano': {
      const V = sim.volcano;
      if (words[0] === 'days') return [V.next === null ? 'The mountain sleeps: nobody knows when it will wake.' : `The mountain on Kharos wakes in ${V.daysToGo()} day${V.daysToGo() === 1 ? '' : 's'} (it has gone up ${V.count} time${V.count === 1 ? '' : 's'} so far).`];
      const r = V.erupt();
      return [`The mountain on Kharos erupts! (${r.dead} dead and ${r.burnt} roofs burning in its towns.)`];
    }
    case 'skip':
    case 'ff': {
      const n = Math.round(Number(words[0]));
      if (!(n >= 1 && n <= 120)) return ['skip <days> (1 to 120)'];
      if (!game.skipDays(n)) return ['You can\'t do that just now (asleep, in a cell or a fight).'];
      return [`Fast-forwarding ${n} day${n === 1 ? '' : 's'}...`];
    }
    case 'war': {
      const W = sim.war;
      const civs = ow.civs.filter((c) => sim.realms.members(c).length);
      if (!words.length || words[0] === 'list') {
        return ['Realms:', ...civs.map((c) => `${c.name.replace(/^The /, '')}${W.atWar(c) ? ' (at war)' : ''}`), 'war <realm> on <realm>, or war <realm> to set your own (or this town\'s) realm on it.'];
      }
      const here = (game.currentSettlement || ow.settlementAt(p.x, p.z))?.civ || W.playerCiv();
      if (words[0] === 'peace') {
        const civ = words[1] ? civArg(game, words.slice(1).join(' ')) : here;
        const w = civ && W.warOf(civ);
        if (!w) return [civ ? `The ${civ.name.replace(/^The /, '')} are at peace.` : 'Which realm? (war peace <realm>)'];
        W.peace(w, game.day, new RNG(hash4(game.seed, game.day, 0x3a77)), null, false);
        return ['Peace is made.'];
      }
      const text = words.join(' ');
      const m = /^(.*?)\s+(?:on|vs|against|with)\s+(.*)$/i.exec(text);
      const a = m ? civArg(game, m[1]) : here;
      const b = civArg(game, m ? m[2] : text);
      if (!a) return ['You\'re not in a realm: name both ("war <realm> on <realm>").'];
      if (!b) return [`No realm called "${m ? m[2] : text}". Try "war list".`];
      if (a === b) return ['A realm can\'t go to war with itself (try a rebellion).'];
      if (W.enemies(a, b)) return ['They\'re already at war.'];
      if (W.atWar(a) || W.atWar(b)) {
        // (Someone's already at war: they make peace there first.)
        for (const c of [a, b]) {
          const w0 = W.warOf(c);
          if (w0) W.peace(w0, game.day, new RNG(hash4(game.seed, game.day, 0x3a77)), null, false);
        }
      }
      if (sim.politics.allied(a, b)) sim.politics.breakAlliance(a, b, game.day, 'war is coming', -30);
      sim.realms.shift(a, b, -100, game.day);
      W.declare(a, b, { k: 'whim', text: 'an old grudge' }, game.day, new RNG(hash4(game.seed, game.day, 0x3a77)));
      return [`The ${a.name.replace(/^The /, '')} declare war on the ${b.name.replace(/^The /, '')}.`];
    }
    default:
      return [`Unknown command "${cmd}". Type "help".`];
  }
}

// Commands (and their argument words) that start with what's been typed.
export function complete(text) {
  const m = /^(\/?)(\S*)$/.exec(text);
  if (!m) return null;
  const hits = Object.keys(COMMANDS).filter((k) => k.startsWith(m[2].toLowerCase()));
  if (hits.length === 1) return `${hits[0]} `;
  if (hits.length > 1) {
    let pre = hits[0];
    for (const h of hits) while (!h.startsWith(pre)) pre = pre.slice(0, -1);
    return pre;
  }
  return null;
}
