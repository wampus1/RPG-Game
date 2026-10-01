// Outings: townsfolk off to see another town of their own realm, a few at
// a time. Someone gets the idea (more often when there's a do on somewhere
// near: a wedding, a feast day, a town's celebration) and asks a friend or
// two along; the watch usually sends a guard with them. They take the
// town's horses and its wagon when those are free, stay the day (or for
// the do), and come home with plenty to say about it, both to those who
// went and to those who didn't. Once in a while one of them liked the
// place so much they pack up and move there. Never more than about a fifth
// of a town is away at once, and the mayor and those the town can't do
// without rarely go. A citizen the one planning it likes is asked along.
import { alive, ledger, DAY, setOverride, notableNews, hearNews } from './econ.js';
import { deserted, relocate } from './civic.js';
import { RNG, hash4 } from '../util/rng.js';

// Those the town can't easily spare.
const ESSENTIAL = new Set(['mayor', 'guard', 'cook', 'innkeeper', 'barkeep', 'herbalist', 'priest', 'blacksmith', 'builder']);
const KEEN = ['curious', 'outgoing', 'well-traveled', 'cheerful', 'gossipy', 'romantic'];
const HOMEBODY = ['reserved', 'timid', 'gloomy', 'hardworking'];
// How long a trip stays in people's minds (and their talk).
export const TRIP_TALK_DAYS = 6;

const full = (r) => `${r.name.first} ${r.name.last}`;
const hodOf = (m) => ((m % DAY) + DAY) % DAY;

// When a trip leaves, from `day`: "today at 08:00", "tomorrow at 06:00"...
export function leavingWhen(t, day) {
  const d = Math.floor(t.depart / DAY) - day;
  const hh = String(Math.floor(hodOf(t.depart) / 60)).padStart(2, '0');
  return `${d <= 0 ? 'today' : d === 1 ? 'tomorrow' : 'the day after tomorrow'} at ${hh}:00`;
}

// Names in a list: "Ann", "Ann and Bo", "Ann, Bo and Cy".
export function listNames(names) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export class Outings {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.list = [];
    this.next = 1;
  }

  get(id) {
    return this.list.find((t) => t.id === id) || null;
  }

  essential(r) {
    return ESSENTIAL.has(r.job) || r.ruler !== undefined || !!r.councillor;
  }

  people(L) {
    return L.npcs.filter((r) => alive(r) && !r.migrated && !r.visitor);
  }

  // How many more can be away from town right now.
  room(L) {
    const all = this.people(L);
    const away = all.filter((r) => r.away || r.leaving || r.outing).length;
    return Math.floor(all.length / 5) - away;
  }

  free(r) {
    return r.age === 'adult' && alive(r) && !r.away && !r.leaving && !r.hired && !r.traveler && !r.migrated && !r.visitor && !r.outing && !r.sick && !(r.trip && r.trip.phase === 'away');
  }

  title(o, ev) {
    const OL = this.game.world.layouts.get(o.id);
    return OL && OL.econ ? this.sim.events.title(OL, ev) : 'the celebrations';
  }

  // Daily: someone gets the idea (a do coming up nearby draws people).
  // (With its own dice, so the rest of the town's day goes as it would.)
  daily(L, day) {
    const s = L.settlement;
    const rng = new RNG(hash4(s.seed, day, 0x0a71));
    if (deserted(s) || s.condition === 'abandoned' || !s.civ) return null;
    if (this.list.some((t) => t.sid === s.id)) return null;
    const ow = this.game.world.ow;
    const near = ow.settlements.filter((o) => o !== s && o.civ === s.civ && !deserted(o) && o.condition !== 'abandoned' && Math.hypot(o.cx - s.cx, o.cz - s.cz) < 18);
    if (!near.length) return null;
    const doOf = (o) => {
      const OL = this.game.world.layouts.get(o.id);
      if (!OL || !OL.econ) return null;
      return this.sim.events.upcoming(OL).find((ev) => ev.day >= day && ev.day <= day + 2 && ev.state !== 'on') || null;
    };
    const dos = near.map((o) => ({ o, ev: doOf(o) })).filter((q) => q.ev);
    let pick = null;
    if (dos.length && rng.chance(0.55)) pick = dos[rng.int(0, dos.length - 1)];
    else if (rng.chance(0.06)) pick = { o: near[rng.int(0, near.length - 1)], ev: null };
    return pick ? this.plan(L, pick.o, pick.ev, day, rng) : null;
  }

  // Who goes, how, and when.
  plan(L, dest, ev, day, rng, now = null) {
    const s = L.settlement;
    const room = this.room(L);
    if (room < 2) return null;
    const cands = this.people(L).filter((r) => this.free(r));
    const keen = (r) => {
      const p = r.personality || {};
      let k = 0.3 + ((p.sociability ?? 0.5) - 0.5) + ((p.curiosity ?? 0.5) - 0.5) * 0.5;
      if ((r.traits || []).some((t) => KEEN.includes(t))) k += 0.25;
      if ((r.traits || []).some((t) => HOMEBODY.includes(t))) k -= 0.15;
      if (this.essential(r)) k *= 0.08;
      return Math.max(0.01, k);
    };
    const weighted = (list, w) => {
      const tot = list.reduce((m, r) => m + w(r), 0);
      let x = rng.float(0, tot);
      for (const r of list) {
        x -= w(r);
        if (x <= 0) return r;
      }
      return list[list.length - 1] || null;
    };
    const lead = weighted(cands.filter((r) => r.job !== 'guard'), keen);
    if (!lead) return null;
    // A friend or two (their partner and family first).
    const close = (r) => (lead.partner === r.idx ? 4 : lead.household != null && lead.household === r.household ? 2.5 : (lead.friends || []).includes(r.idx) || (r.friends || []).includes(lead.idx) ? 3 : 1);
    const guards = cands.filter((r) => r.job === 'guard' && r.shift !== 'night');
    const onWatch = L.npcs.filter((r) => r.job === 'guard' && alive(r) && !r.away && !r.migrated).length;
    const guard = guards.length && onWatch >= 3 && rng.chance(0.75) ? guards[rng.int(0, guards.length - 1)] : null;
    const want = Math.max(0, Math.min(rng.int(1, 2), room - 1 - (guard ? 1 : 0)));
    const comps = [];
    let pool = cands.filter((r) => r !== lead && r.job !== 'guard');
    for (let i = 0; i < want && pool.length; i++) {
      const r = weighted(pool, (q) => keen(q) * close(q));
      comps.push(r);
      pool = pool.filter((q) => q !== r);
    }
    const at = now ?? this.sim.simNow ?? this.sim.abs;
    const walk = this.sim.diplomacy.travelHours(s, dest);
    let depart;
    if (ev) {
      depart = Math.max(at + 60, ev.s - Math.round(walk * 60 * 0.8) - 150);
      if (depart + walk * 60 * 0.8 > ev.e - 30) return null;
    } else depart = (day + 1) * DAY + 480 + rng.int(0, 90);
    const members = [lead, ...comps];
    const t = {
      id: this.next++, sid: s.id, dest: dest.id, lead: lead.idx, members: members.map((r) => r.idx), guard: guard ? guard.idx : null,
      ev: ev ? { id: ev.id, kind: ev.kind, day: ev.day, s: ev.s, e: ev.e, title: this.title(dest, ev) } : null,
      depart, arrive: 0, leave: 0, ret: 0, phase: 'planned', planned: day, player: null,
    };
    for (const r of [...members, guard].filter(Boolean)) r.outing = t.id;
    // A citizen they get on with is asked along.
    const c = this.sim.citizen;
    if (c && c.sid === s.id && this.sim.repEntry(s.id, lead.idx).v + this.sim.areaMod(s.id) >= 30 && !this.game.isWanted(s.id)) t.player = 'ask';
    this.list.push(t);
    const others = comps.map((r) => r.name.first);
    ledger(L, day, `${full(lead)} is off to ${dest.name}${t.ev ? ` for ${t.ev.title}` : ' to see the place'}${others.length ? `, with ${listNames(others)}` : ''}${guard ? ` (${guard.name.first} of the watch is going along)` : ''}.`);
    return t;
  }

  everyone(t, L) {
    return [...t.members, t.guard].filter((i) => i !== null && i !== undefined).map((i) => L.npcs[i]).filter(Boolean);
  }

  cancel(L, t, day, why) {
    for (const r of this.everyone(t, L)) if (r.outing === t.id) r.outing = null;
    t.phase = 'done';
    if (why) ledger(L, day, why);
  }

  // Hour by hour: set off, and come home again.
  hourly(L, h, day) {
    for (const t of this.list) {
      if (t.sid !== L.settlement.id) continue;
      if (t.phase === 'planned' && h >= t.depart) this.setOff(L, t, h, day);
      else if (t.phase === 'out' && h >= t.ret) this.home(L, t, h, day);
    }
    this.list = this.list.filter((t) => t.phase !== 'done');
  }

  setOff(L, t, h, day) {
    const s = L.settlement;
    const ow = this.game.world.ow;
    const dest = ow.settlements[t.dest];
    const lead = L.npcs[t.lead];
    if (!dest || deserted(dest) || !lead || !alive(lead) || lead.away || lead.migrated) {
      this.cancel(L, t, day, lead ? `${full(lead)}'s trip to ${dest ? dest.name : 'the next town'} was called off.` : null);
      return;
    }
    // The party waits by the road out a while for a citizen who said
    // they'd come.
    const g = this.game;
    if (t.player === 'joined' && g.active.has(s.id)) {
      const e = lead.ent;
      const p = g.player;
      const near = e && !e.dead && Math.max(Math.abs(e.x - p.x), Math.abs(e.z - p.z)) <= 8;
      if (!near) {
        if (!t.waitUntil) {
          t.waitUntil = h + 120;
          for (const r of this.everyone(t, L)) {
            setOverride(r, h, h + 150, 'travel', { place: 'road' });
            if (r.ent && !r.ent.dead) r.ent.activity = null;
          }
          if (e && !e.dead) e.say(e.rng.pick([`Where's ${g.playerName}? We'll wait a bit.`, 'We said we\'d wait. Just a little longer.']), 4);
        }
        if (h < t.waitUntil) return;
        t.player = 'left';
      } else t.withPlayer = true;
    }
    const going = this.everyone(t, L).filter((r) => alive(r) && !r.away && !r.migrated && !r.hired && r.outing === t.id);
    if (going.length < 2 && !t.withPlayer) {
      this.cancel(L, t, day, null);
      return;
    }
    // The town's horses and wagon, if they're free: the one planning it
    // takes the wagon (or a horse), the guard a horse; others ride if
    // there's one spare, and walk if not.
    const stable = this.sim.stables;
    const banner = s.civ ? s.civ.color.hex : '#b03030';
    const mounts = {};
    for (const r of going) {
      const m = stable.take(L, r === lead && going.length >= 2 ? 'wagon' : 'horse');
      if (m) {
        m.banner = banner;
        mounts[r.idx] = m;
      }
    }
    // Whoever has nothing to ride climbs up into the back of the wagon.
    const wagon = going.find((r) => mounts[r.idx] && mounts[r.idx].kind === 'wagon');
    const riders = wagon ? going.filter((r) => !mounts[r.idx]).slice(0, 3) : [];
    if (wagon) mounts[wagon.idx].riders = riders.map((r) => r.look);
    const slow = Math.max(...going.map((r) => (riders.includes(r) ? 0.75 : !mounts[r.idx] ? 1 : mounts[r.idx].kind === 'wagon' ? 0.75 : 0.65)));
    const hours = Math.max(2, Math.round(this.sim.diplomacy.travelHours(s, dest) * slow));
    t.arrive = h + hours * 60;
    // For a do: till it's over (and set off in the morning, if that's at
    // night). Otherwise a day there.
    let leave = t.ev ? Math.max(t.arrive + 120, t.ev.e + 30) : t.arrive + (8 + (t.id % 9)) * 60;
    const hod = hodOf(leave);
    if (hod >= 21 * 60) leave += DAY - hod + 450;
    else if (hod < 450) leave += 450 - hod;
    t.leave = leave;
    t.ret = leave + hours * 60;
    const list = this.sim.visits.get(dest.id) || [];
    going.forEach((r, i) => {
      const mount = mounts[r.idx] || null;
      const visit = {
        id: `o${t.id}:${r.idx}`, from: s.id, fromName: s.name, fromIdx: r.idx, name: r.name, style: s.style, look: r.look,
        goods: {}, arrive: t.arrive + i * 4, leave: t.leave, coins: r.coins || 0, traded: true, earned: 0, mount, guest: true, outing: t.id,
        news: i === 0 ? notableNews(L, day - 5, 3) : [], ev: t.ev,
      };
      list.push(visit);
      r.trip = { phase: 'away', dest: dest.id, depart: h, arrive: visit.arrive, ret: t.ret, visit: visit.id, mount, outing: t.id, ...(riders.includes(r) ? { passenger: true } : {}) };
      if (r.ent && !r.ent.dead) {
        setOverride(r, h, h + 180, 'travel', { place: 'road' });
        r.leaving = true;
        r.ent.activity = null;
      } else r.away = true;
    });
    this.sim.visits.set(dest.id, list);
    t.went = going.map((r) => r.idx);
    t.phase = 'out';
    const byWagon = Object.values(mounts).some((m) => m.kind === 'wagon');
    const how = byWagon ? ' in the town wagon' : Object.keys(mounts).length ? ' on horseback' : ' on foot';
    ledger(L, day, `${listNames(going.map((r) => r.name.first))} set off for ${dest.name}${how}${t.withPlayer ? `, with ${g.playerName}` : ''}.`);
    if (t.withPlayer) g.ui.msg(`You set off for ${dest.name} with ${listNames(going.map((r) => r.name.first))}.`, '#a0e0ff');
    else if (t.player === 'left' && g.active.has(s.id)) g.ui.msg(`${lead.name.first} and the others gave up waiting and left for ${dest.name} without you.`, '#c8c8c8');
  }

  home(L, t, h, day) {
    const ow = this.game.world.ow;
    const dest = ow.settlements[t.dest];
    const DL = dest && this.game.world.layouts.get(dest.id);
    const back = (t.went || []).map((i) => L.npcs[i]).filter((r) => r && alive(r) && !r.migrated);
    for (const r of back) {
      r.away = false;
      r.leaving = false;
      r.outing = null;
      if (r.trip && r.trip.mount) this.sim.stables.giveBack(r.trip.mount);
      r.trip = null;
      r.mood = Math.min(1, (r.mood ?? 0.5) + 0.12);
      r.tripMem = { dest: dest ? dest.name : 'the next town', sid: t.dest, day, ev: t.ev ? t.ev.kind : null, title: t.ev ? t.ev.title : null, with: t.went.filter((i) => i !== r.idx), player: !!t.playerCame };
    }
    for (const r of this.everyone(t, L)) if (r.outing === t.id) r.outing = null;
    if (dest) this.sim.visits.set(dest.id, (this.sim.visits.get(dest.id) || []).filter((v) => v.outing !== t.id));
    t.phase = 'done';
    if (!back.length) return;
    ledger(L, day, `${listNames(back.map((r) => r.name.first))} came back from ${dest ? dest.name : 'their trip'}${t.ev ? ` (${t.ev.title})` : ''}${t.playerCame ? `, where ${this.game.playerName} joined them` : ''}.`);
    // With what they heard there.
    if (DL && DL.econ) hearNews(L, dest.name, notableNews(DL, day - 3, 2), day, h);
    // Now and then someone liked it there so much they move (someone on
    // their own, free to go).
    const movers = back.filter((r) => r.idx !== t.guard && !this.essential(r) && (r.partner === null || r.partner === undefined) && !(r.children || []).length && (r.mood ?? 0.5) > 0.5);
    const roll = (t.id * 7919 + t.sid * 104729) % 100;
    if (DL && DL.econ && movers.length && roll < 6) {
      const m = movers[roll % movers.length];
      relocate(this.sim, L, [m], DL, `moving there after a visit`);
      ledger(L, day, `${full(m)} liked ${dest.name} so much on the trip that they're moving there.`);
    }
  }

  // While a town you're in: the one planning it asks you along; and a
  // trip you're on notices you got there.
  update() {
    const g = this.game;
    const p = g.player;
    const here = g.currentSettlement;
    const now = this.sim.abs;
    for (const t of this.list) {
      if (t.phase === 'planned' && t.player === 'ask' && here && here.id === t.sid && !t.asked) {
        const L = this.sim.layoutOf(t.sid);
        const e = L && L.npcs[t.lead] && L.npcs[t.lead].ent;
        if (!e || e.dead || e.sleeping || e.state !== 'routine' || Math.max(Math.abs(e.x - p.x), Math.abs(e.z - p.z)) > 8) continue;
        t.asked = true;
        const dest = g.world.ow.settlements[t.dest];
        const when = leavingWhen(t, g.day).replace(/ at .*/, '');
        e.face(p.x, p.z);
        e.say(`${g.playerName.split(' ')[0]}! We're off to ${dest.name} ${when}${t.ev ? ` for ${t.ev.title}` : ''}. Come with us?`, 5, '#a0e0ff');
        g.ui.msg(`${e.rec.name.first} asked you along to ${dest.name}. (Talk to them to answer.)`, '#a0e0ff');
      }
      if (t.phase === 'out' && t.player === 'joined' && !t.playerCame && here && here.id === t.dest && now >= t.arrive - 120 && now < t.leave) {
        t.playerCame = true;
        const L = this.sim.layoutOf(t.sid);
        for (const r of (t.went || []).map((i) => L.npcs[i]).filter(Boolean)) {
          const k = this.sim.repEntry(t.sid, r.idx);
          k.v = Math.min(100, k.v + 6);
        }
        g.ui.msg(`You made it to ${here.name} with the party from ${L.settlement.name}.`, '#a0ffa0');
      }
    }
  }

  // The trip someone's been asked on, or is part of.
  tripOf(rec, sid) {
    return this.list.find((t) => t.sid === sid && (t.lead === rec.idx || t.members.includes(rec.idx) || t.guard === rec.idx)) || null;
  }

  // Your answer.
  answer(t, yes) {
    t.player = yes ? 'joined' : 'declined';
    return t;
  }

  serialize() {
    return { list: this.list, next: this.next };
  }

  load(d) {
    this.list = (d && d.list) || [];
    this.next = (d && d.next) || 1;
  }
}
