// Small requests villagers make of the player: bring them something they
// need, deal with the beasts prowling around town, or carry a letter to
// someone they care about. Each person offers at most one thing a day.
import { ITEMS } from '../world/items.js';
import { alive, invAdd, ledger } from './econ.js';
import { RNG, hash4 } from '../util/rng.js';
import { countItem, removeItem } from '../game/inventory.js';

const WANTS = {
  cook: [['raw_meat', 4], ['fish', 4], ['cabbage', 3]],
  innkeeper: [['raw_meat', 3], ['apple', 5]],
  barkeep: [['wheat', 6], ['apple', 5]],
  blacksmith: [['iron_ore', 4], ['coal', 6]],
  carpenter: [['log_oak', 8], ['planks', 16]],
  laborer: [['cobblestone', 16], ['log_oak', 6]],
  herbalist: [['herb', 3], ['mushroom', 4], ['flower_blue', 2]],
  baker: [['wheat', 6], ['berries', 6]],
  tailor: [['leather', 3], ['string', 4]],
  scholar: [['book', 1], ['feather', 5]],
  priest: [['flower_white', 3], ['torch', 6]],
  farmer: [['bone', 4], ['fence', 6]],
  fisher: [['string', 3], ['reeds', 6]],
  trapper: [['arrow', 12], ['string', 2]],
  merchant: [['gem', 1], ['gold_ingot', 1]],
  noble: [['gem', 1], ['flower_purple', 3]],
  miner: [['coal', 8], ['torch', 8]],
  lumberjack: [['apple', 4], ['bread', 2]],
  guard: [['arrow', 10], ['bread', 2]],
  mayor: [['scroll', 1]],
  beggar: [['bread', 1]],
  retired: [['pie', 1], ['flower_red', 3]],
  child: [['flower_yellow', 2], ['berries', 4], ['apple', 1]],
};

const HOBBY_ITEM = {
  reading: 'book', fishing: 'fishing_rod', music: 'lute', praying: 'prayer_beads', smoking: 'pipe', dice: 'dice', sketching: 'sketchbook',
};

const MAX_ACTIVE = 4;

export function plural(item, n) {
  if (item === 'food') return 'something to eat';
  const nm = ITEMS[item].name.toLowerCase();
  const mass = /(ore|meat|fish|wheat|coal|string|leather|cobblestone|bread|cloth)$/.test(nm);
  if (n === 1) return mass ? `some ${nm}` : `${/^[aeiou]/.test(nm) ? 'an' : 'a'} ${nm}`;
  if (mass || /s$/.test(nm)) return `${n} ${nm}`;
  return `${n} ${nm}${/(ch|sh|x)$/.test(nm) ? 'es' : 's'}`;
}

export function relationTo(rec, other) {
  if (rec.partner === other.idx) return 'partner';
  if (rec.children.includes(other.idx)) return 'child';
  if (rec.parents.includes(other.idx)) return 'parent';
  if (rec.household !== undefined && rec.household === other.household) return 'family';
  if ((rec.friends || []).includes(other.idx)) return 'friend';
  return null;
}

export class Favors {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.list = [];
    this.offers = new Map();
    this.next = 1;
    this.done = 0;
    this.day = null;
  }

  given(npc) {
    if (npc.visit) return null;
    const sid = npc.settlement.id;
    return this.list.find((f) => f.sid === sid && f.giver === npc.rec.idx) || null;
  }

  letterFor(npc) {
    if (npc.visit) return null;
    const sid = npc.settlement.id;
    return this.list.find((f) => f.kind === 'deliver' && f.sid === sid && f.to === npc.rec.idx) || null;
  }

  // What they'd ask of you today (the same offer all day long).
  offer(npc) {
    const g = this.game;
    const rec = npc.rec;
    const L = npc.layout;
    const s = L.settlement;
    if (npc.visit || npc.hired || rec.visitor) return { none: 'traveling' };
    if (this.given(npc)) return { none: 'active' };
    const r = this.sim.repEntry(s.id, rec.idx);
    if (r.favorDay === g.day) return { none: 'asked' };
    // Someone you just helped doesn't need you again straight away.
    if (r.favorNext !== undefined && g.day < r.favorNext) return { none: 'recent' };
    if (this.sim.opinion(npc) < -25) return { none: 'distrust' };
    if (this.list.length >= MAX_ACTIVE) return { none: 'busy' };
    const key = `${s.id}:${rec.idx}:${g.day}`;
    if (this.offers.has(key)) return this.offers.get(key);
    const rng = new RNG(hash4(rec.idx, s.seed, g.day, 0xfa7));
    const cands = [];
    if (rec.hungry >= 1) cands.push({ kind: 'fetch', item: 'food', count: 1, w: 4 });
    for (const [item, count] of WANTS[rec.age === 'child' ? 'child' : rec.job] || []) if (ITEMS[item]) cands.push({ kind: 'fetch', item, count, w: 1 });
    for (const h of rec.hobbies || []) {
      const it = HOBBY_ITEM[h];
      if (it && rec.age !== 'child' && !rec.equipment.items.some((i) => i.item === it)) cands.push({ kind: 'fetch', item: it, count: 1, w: 0.6, hobby: h });
    }
    if (['guard', 'mayor', 'farmer', 'trapper'].includes(rec.job)) cands.push({ kind: 'slay', count: rng.int(2, 4), w: 1.3 });
    if (rec.age !== 'child') {
      const dear = [rec.partner, ...rec.children, ...rec.parents, ...(rec.friends || [])]
        .filter((i) => i !== null && i !== undefined && i !== rec.idx).map((i) => L.npcs[i]).filter((o) => o && alive(o) && !o.away && o.age !== 'child');
      if (dear.length) cands.push({ kind: 'deliver', to: rng.pick(dear).idx, w: 1.6 });
    }
    // Not everyone needs a hand; the reserved rarely ask.
    if (!cands.length || rng.chance(rec.age === 'child' ? 0.6 : 0.3 - rec.personality.sociability * 0.2)) {
      const o = { none: 'nothing', key };
      this.offers.set(key, o);
      return o;
    }
    let t = rng.next() * cands.reduce((a, c) => a + c.w, 0);
    let c = cands[0];
    for (const q of cands) {
      t -= q.w;
      if (t <= 0) {
        c = q;
        break;
      }
    }
    const official = rec.job === 'guard' || rec.job === 'mayor';
    const value = c.kind === 'fetch' ? (c.item === 'food' ? 3 : ITEMS[c.item].value * c.count) : c.kind === 'slay' ? c.count * 3 : 3;
    const purse = official && c.kind === 'slay' ? L.econ.treasury : rec.coins || 0;
    const mood = rec.traits.includes('generous') ? 1.3 : rec.traits.includes('stingy') ? 0.6 : 1;
    let coins = rec.age === 'child' ? 1 : Math.round((value * 1.4 + 3) * mood);
    coins = Math.max(0, Math.min(coins, Math.floor(purse * 0.5)));
    const o = {
      key, kind: c.kind, item: c.item || null, count: c.count || 1, hobby: c.hobby || null, to: c.to ?? null,
      toName: c.to !== undefined && c.to !== null ? L.npcs[c.to].name.first : null, coins, rep: coins < 3 ? 12 : 8,
      days: c.kind === 'fetch' ? 4 : 2, official: official && c.kind === 'slay',
    };
    o.text = this.pitch(npc, o);
    this.offers.set(key, o);
    return o;
  }

  pitch(npc, o) {
    const rec = npc.rec;
    const rng = new RNG(hash4(rec.idx, o.count, 0x917));
    const what = o.item ? plural(o.item, o.count) : '';
    const pay = o.coins ? ` I can pay ¤${o.coins}.` : ' I can\'t pay much, but I\'d owe you one.';
    if (rec.age === 'child') return `Can you find me ${what}? Pleeease? I'll be your best friend!`;
    if (o.kind === 'deliver') {
      const other = npc.layout.npcs[o.to];
      const rel = relationTo(rec, other);
      const who = rel === 'partner' ? `my partner ${o.toName}` : rel === 'child' ? `my ${other.age === 'child' ? 'little one' : 'grown child'}, ${o.toName}` : rel === 'parent' ? `my parent, ${o.toName}` : rel === 'friend' ? `my friend ${o.toName}` : o.toName;
      return `Could you take this letter to ${who}? I can't get away right now.${o.coins ? ` Here's ¤${o.coins} for your trouble, once it's delivered.` : ''}`;
    }
    if (o.kind === 'slay') {
      const where = rec.job === 'farmer' ? 'Something keeps going for the animals at night.' : rec.job === 'trapper' ? 'The woods are crawling with beasts; they scare off the game.' : 'Beasts have been prowling around town after dark.';
      return `${where} Put down ${o.count} of them near town, would you?${pay}`;
    }
    if (o.item === 'food') return `I haven't eaten properly in days... Could you bring me something to eat? Anything at all.${o.coins ? '' : ' I\'ve nothing to pay you with.'}`;
    if (o.hobby) return `I've always wanted ${what} of my own. If you ever come across one...${pay}`;
    const byJob = {
      cook: `The pot's nearly empty. Bring me ${what}?`, blacksmith: `The forge is hungry and I'm short on stock. I need ${what}.`,
      carpenter: `I've more orders than timber. Could you bring me ${what}?`, herbalist: `I'm out of the good stuff. Could you gather ${what}?`,
      baker: `The mill's been slow. I need ${what} for tomorrow's baking.`, priest: `The shrine could use a little care. Would you bring ${what}?`,
      scholar: `My research has stalled. I need ${what}.`, guard: `We're short on supplies at the guardhouse. ${what[0].toUpperCase() + what.slice(1)} would help.`,
    }[rec.job];
    return `${byJob || rng.pick([`I could really use ${what}.`, `If you come across ${what}, I'd take them off your hands.`])}${pay}`;
  }

  accept(npc) {
    const o = this.offer(npc);
    if (!o || o.none) return null;
    const g = this.game;
    const L = npc.layout;
    const f = {
      id: this.next++, sid: L.settlement.id, town: L.settlement.name, giver: npc.rec.idx, giverName: npc.rec.name.first, kind: o.kind, item: o.item, count: o.count,
      to: o.to, toName: o.toName, coins: o.coins, rep: o.rep, day: g.day, due: g.day + o.days, kills: 0, official: o.official, text: o.text,
    };
    if (f.kind === 'slay') f.b = { x0: L.bounds.x0 - 30, z0: L.bounds.z0 - 30, x1: L.bounds.x1 + 30, z1: L.bounds.z1 + 30 };
    if (f.kind === 'deliver') {
      const p = g.player;
      const left = p.give('letter', 1);
      if (left) g.spawnDrop('letter', left, p.x, p.y, p.z, true);
    }
    this.list.push(f);
    this.offers.delete(o.key);
    return f;
  }

  decline(npc) {
    this.sim.repEntry(npc.settlement.id, npc.rec.idx).favorDay = this.game.day;
  }

  // How far along a request is: { have, need }.
  progress(f) {
    const inv = this.game.player.inv;
    if (f.kind === 'slay') return { have: Math.min(f.kills, f.count), need: f.count };
    if (f.kind === 'deliver') return { have: 0, need: 1 };
    if (f.item === 'food') return { have: inv.reduce((n, s) => n + (s && ITEMS[s.item]?.kind === 'food' ? s.count : 0), 0) > 0 ? 1 : 0, need: 1 };
    return { have: Math.min(countItem(inv, f.item), f.count), need: f.count };
  }

  describe(f) {
    if (f.kind === 'slay') return `Slay ${f.count} beasts near ${f.town} (${Math.min(f.kills, f.count)}/${f.count}) for ${f.giverName}`;
    if (f.kind === 'deliver') return `Deliver ${f.giverName}'s letter to ${f.toName} in ${f.town}`;
    const pr = this.progress(f);
    return `Bring ${f.giverName} ${plural(f.item, f.count)} (${pr.have}/${pr.need}) in ${f.town}`;
  }

  // Hand over what they asked for, if you have it.
  turnIn(npc) {
    const f = this.given(npc);
    if (!f) return null;
    const pr = this.progress(f);
    if (f.kind === 'deliver' || pr.have < pr.need) return { f, pr, done: false };
    const inv = this.game.player.inv;
    const rec = npc.rec;
    if (f.kind === 'fetch') {
      if (f.item === 'food') {
        const s = inv.filter((q) => q && ITEMS[q.item].kind === 'food').sort((a, b) => ITEMS[b.item].heal - ITEMS[a.item].heal)[0];
        removeItem(inv, s.item, 1);
        rec.hungry = 0;
        rec.fed = (rec.fed || 0) + 1;
      } else {
        removeItem(inv, f.item, f.count);
        invAdd(rec.inv, f.item, f.count);
      }
    }
    const paid = this.complete(f, npc);
    return { f, pr, done: true, paid };
  }

  complete(f, npc) {
    const L = npc.layout;
    const rec = npc.rec;
    let paid = 0;
    if (f.official) {
      paid = Math.max(0, Math.min(f.coins, Math.floor(L.econ.treasury)));
      L.econ.treasury -= paid;
    } else {
      paid = Math.max(0, Math.min(f.coins, rec.coins || 0));
      rec.coins -= paid;
    }
    if (paid) {
      const p = this.game.player;
      const left = p.give('coin', paid);
      if (left) this.game.spawnDrop('coin', left, p.x, p.y, p.z, true);
      this.game.audio?.play('coin');
    }
    this.sim.changeRep(npc, f.rep);
    this.sim.addRenown(f.sid, f.official ? 3 : 2, 'your help');
    this.list = this.list.filter((q) => q !== f);
    this.done++;
    const r = this.sim.repEntry(f.sid, f.giver);
    r.favorNext = this.game.day + 1 + ((f.id + f.giver) % 2);
    if (f.kind === 'slay') ledger(L, this.game.day, `${this.game.playerName} cleared beasts from around ${L.settlement.name}.`);
    return paid;
  }

  // Handing a letter to the person it's for.
  deliver(npc) {
    const f = this.letterFor(npc);
    if (!f) return null;
    const inv = this.game.player.inv;
    if (countItem(inv, 'letter') <= 0) return { f, missing: true };
    removeItem(inv, 'letter', 1);
    const L = npc.layout;
    const giver = L.npcs[f.giver];
    this.sim.changeRep(npc, 3);
    const paid = giver ? this.complete(f, giver.ent && !giver.ent.dead ? giver.ent : { rec: giver, settlement: L.settlement, layout: L }) : 0;
    if (!giver) this.list = this.list.filter((q) => q !== f);
    return { f, paid };
  }

  onKill(c) {
    if (!c.hostileNow) return;
    for (const f of this.list) {
      if (f.kind !== 'slay' || f.kills >= f.count) continue;
      if (c.x < f.b.x0 || c.x > f.b.x1 || c.z < f.b.z0 || c.z > f.b.z1) continue;
      f.kills++;
      if (f.kills >= f.count) this.game.ui.msg(`Request done: go and tell ${f.giverName}.`, '#a0e0ff');
    }
  }

  // Requests left too long lapse, and the person is let down.
  update() {
    const day = this.game.day;
    if (this.day === day) return;
    this.day = day;
    for (const k of [...this.offers.keys()]) if (!k.endsWith(`:${day}`)) this.offers.delete(k);
    for (const f of [...this.list]) {
      if (day <= f.due) continue;
      this.list = this.list.filter((q) => q !== f);
      const L = this.sim.layoutOf(f.sid);
      const rec = L && L.npcs[f.giver];
      if (rec && alive(rec)) this.sim.changeRep(rec.ent && !rec.ent.dead ? rec.ent : { rec, settlement: L.settlement }, -3);
      this.game.ui.msg(`You never got back to ${f.giverName} in ${f.town}.`, '#ffb080');
    }
    // Requests from the dead are void.
    this.list = this.list.filter((f) => {
      const L = this.sim.layoutOf(f.sid);
      return L && L.npcs[f.giver] && alive(L.npcs[f.giver]);
    });
  }

  serialize() {
    return { list: this.list, next: this.next, done: this.done };
  }

  load(d) {
    if (!d) return;
    this.list = d.list || [];
    this.next = d.next || 1;
    this.done = d.done || 0;
  }
}
