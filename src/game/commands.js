// The command console (the ` or / key): cheats and testing aids, for getting
// about the world quickly and making things happen when you want to see them.
import { ITEMS } from '../world/items.js';
import { GROUND, REGION_W, REGION_D, WORLD_TILES_W, WORLD_TILES_D, DAY_MINUTES } from '../config.js';
import { alive, DAY } from '../sim/econ.js';

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
};

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
