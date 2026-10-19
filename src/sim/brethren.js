// (Round 130) The brotherhoods. Each guild of pirates (see game/pirates.js)
// is a polity of its own, kept by its Articles: a chief the captains chose,
// a quartermaster in each haven to keep the chief honest, the captains
// themselves (real people of the havens, ashore between cruises, careening
// their ships on the beach), a common chest the prizes go into, and a
// share-out every week by the Articles. Lean weeks sour them: captains
// desert to a rival guild or take a realm's pardon, and the council throws
// out a chief who can't fill the chest.
//
// The guilds have their quarrels with each other (rivals, at truce, allied
// or at war) and with the realms they prey on. A realm that's lost enough
// ships to them may buy them off (tribute), hire them against an enemy
// (letters of marque), offer their captains the King's Pardon, or, if it
// has learned where a haven is, send marines to burn it out for good (see
// havens.js). The coasts feel it: ships taken, captives carried off,
// ransoms demanded, the watch on the harbour wall.
//
// Anyone sworn to a guild is one of its hands, and can rise: a captain's
// commission once they've proved themselves with a ship of their own, and
// the chief's chair by the captains' vote or by beating the chief under the
// Articles. A chief sits the council in the guild hall (see
// ui/havenwin.js): dividing the prize, judging thieves, answering the
// realms, calling raids, careening the fleet, amending the Articles,
// treating with the other guilds; other players of the guild sit with them
// and vote.
import { RNG, hash4, clamp } from '../util/rng.js';
import { ledger, alive, DAY } from './econ.js';
import { pidOf, playerOf, playerName } from './saga/refs.js';
import { GUILDS } from '../game/pirates.js';
import { isHaven } from './havenref.js';
import { removeItem } from '../game/inventory.js';

export const CAPTAIN_AT = 40; // merit for a captain's commission
export const CHIEF_AT = 120; // merit to stand for chief
const EPITHETS = ['Calico', 'Black', 'Red', 'Mad', 'Gentleman', 'Salt', 'Iron', 'Bloody', 'Smiling', 'Half-Hand', 'One-Eyed', 'Long', 'Bonny', 'Tarry', 'Old', 'Scarlet', 'Silver', 'Gallows', 'Stormy', 'Lucky'];
const SHIPS = ['Black Gull', 'Red Widow', 'Sea Wolf', 'Grinning Jack', 'Bloody Mary', 'Kraken\'s Due', 'Hangman\'s Luck', 'Salt Hag', 'Revenge', 'Fancy', 'Night Heron', 'Dead Calm', 'Rogue\'s March', 'Crooked Mile', 'Lady Scorn', 'Gallant Thief'];

// The Articles: what the guild's ruled by. Each its choices: [key, what it
// says, a word for it].
export const ARTICLES = {
  shares: { name: 'Shares', opts: [['equal', 'Every hand an equal share, the chief no more', 'Equal'], ['captain', 'A captain two shares, the chief two', 'Double'], ['chief', 'The chief three shares, captains two', 'Chief\'s three']] },
  quarter: { name: 'Quarter', opts: [['give', 'Quarter to any crew that strikes', 'Give quarter'], ['none', 'No quarter given', 'No quarter']] },
  fishers: { name: 'Fishers', opts: [['spare', 'Spare the fishing boats and the poor', 'Spare'], ['take', 'Take whatever the sea sends', 'Take all']] },
  thieves: { name: 'Thieves', opts: [['maroon', 'A thief from the brethren is marooned', 'Maroon'], ['flog', 'Forty lashes at the mast', 'Flog'], ['plank', 'The plank', 'Plank']] },
};
export const ARTICLE_IDS = Object.keys(ARTICLES);
const DEFAULT_ARTICLES = [
  { shares: 'captain', quarter: 'give', fishers: 'spare', thieves: 'maroon' },
  { shares: 'chief', quarter: 'none', fishers: 'take', thieves: 'plank' },
  { shares: 'equal', quarter: 'give', fishers: 'spare', thieves: 'flog' },
];
export const RELATIONS = ['war', 'rival', 'truce', 'alliance'];
export const RANK_NAMES = { hand: 'Hand', captain: 'Captain', chief: 'Chief', king: 'Pirate King' };
const fullName = (r) => `${r.name.first} ${r.name.last}`;
const key2 = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export class Brethren {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.g = [];
    this.rel = {}; // 'a:b' -> relation between guilds
    this.king = null; // { pid, name, day }
    this.nextMatter = 1;
    this.lastDay = null;
  }

  // ------------------------------------------------------------ the polity
  // Guild `i`, made the first time it's wanted.
  of(i) {
    if (!GUILDS[i]) return null;
    if (!this.g[i]) {
      this.g[i] = {
        id: i, chief: null, captains: [], nextCap: 1, treasury: 160, articles: { ...DEFAULT_ARTICLES[i] }, mood: 0.6, lean: 0,
        realms: {}, members: {}, matters: [], log: [], lastShare: null, careen: null, broken: false,
      };
    }
    return this.g[i];
  }

  all() {
    return GUILDS.map((_, i) => this.of(i));
  }

  name(i) {
    return (GUILDS[i] || GUILDS[0]).name;
  }

  relation(a, b) {
    if (a === b) return 'alliance';
    return this.rel[key2(a, b)] || 'rival';
  }

  setRelation(a, b, r, day = this.game.day, why = null) {
    if (a === b) return;
    const was = this.relation(a, b);
    if (was === r) return;
    this.rel[key2(a, b)] = r;
    const text = {
      war: `${cap(this.name(a))} and ${this.name(b)} are at war: their ships will fight on sight.`,
      rival: `${cap(this.name(a))} and ${this.name(b)} are back to their old rivalry.`,
      truce: `${cap(this.name(a))} and ${this.name(b)} have made a truce.`,
      alliance: `${cap(this.name(a))} and ${this.name(b)} have sworn an alliance: their ships sail together now.`,
    }[r];
    for (const g of [a, b]) this.note(g, `${text}${why ? ` (${why})` : ''}`, day);
  }

  note(i, text, day = this.game.day) {
    const G = this.of(i);
    if (!G) return;
    G.log.push({ day, text });
    if (G.log.length > 40) G.log.splice(0, G.log.length - 40);
    for (const h of this.sim.havens.standing(i)) {
      const L = this.sim.havens.layout(h);
      if (L && L.econ) ledger(L, day, text);
    }
  }

  // Tell whoever of the guild is playing.
  tellMembers(i, text, color = '#ffd080') {
    const G = this.of(i);
    for (const pid of Object.keys(G.members)) {
      const p = playerOf(this.game, pid);
      if (!p) continue;
      const say = () => this.game.ui.msg(text, color);
      this.game.asPlayer ? this.game.asPlayer(p, say) : say();
    }
  }

  // The captain record of a guild by id; the record of the person they are.
  captain(G, id) {
    return G.captains.find((c) => c.id === id) || null;
  }

  recOf(c) {
    if (!c || !c.rec) return null;
    const L = this.game.world.layouts.get(c.rec.sid);
    return L ? L.npcs[c.rec.idx] || null : null;
  }

  // Who leads guild `i`: { name, pid } or { name, cap }.
  chief(i) {
    const G = this.of(i);
    if (!G.chief) return null;
    if (G.chief.pid) return { name: G.chief.name, pid: G.chief.pid };
    const c = this.captain(G, G.chief.cap);
    return c ? { name: c.name, cap: c } : null;
  }

  chiefPid(i) {
    const G = this.of(i);
    return G.chief && G.chief.pid ? G.chief.pid : null;
  }

  // The guild's captains, once a haven of theirs has people in it: the
  // boldest of its corsairs given ships, the boldest of those the chief.
  seat(i, day) {
    const G = this.of(i);
    if (G.captains.length) return;
    const h = this.sim.havens.standing(i)[0];
    const L = h && this.sim.havens.layout(h);
    if (!L || !L.econ) return;
    const rng = new RNG(hash4(this.game.seed >>> 0, i, 0x3a9c));
    const bold = L.npcs.filter((r) => alive(r) && r.age === 'adult' && (r.job === 'guard' || r.job === 'laborer') && r.havenRank === undefined)
      .sort((a, b) => (b.personality?.bravery ?? 0.5) - (a.personality?.bravery ?? 0.5));
    for (const r of bold.slice(0, 3)) this.makeCaptain(G, h, L, r, rng, day);
    if (!G.captains.length) return;
    const top = [...G.captains].sort((a, b) => b.infamy - a.infamy)[0];
    this.crownChief(i, { cap: top.id }, day, 'chosen by the captains long since', true);
  }

  makeCaptain(G, h, L, r, rng, day, o = {}) {
    const id = G.nextCap++;
    const name = `${rng.pick(EPITHETS)} ${r.name.first}`;
    const used = new Set(this.all().flatMap((g) => g.captains.map((q) => q.ship)));
    const free = SHIPS.filter((n) => !used.has(`The ${n}`));
    const ship = `The ${rng.pick(free.length ? free : SHIPS)}`;
    const c = {
      id, rec: { sid: L.settlement.id, idx: r.idx }, name, ship, type: rng.chance(0.55) ? 'brigantine' : 'sloop', prizes: o.prizes ?? rng.int(2, 14),
      infamy: o.infamy ?? rng.int(5, 40), scars: rng.int(0, 3), loyalty: o.loyalty ?? 0.5 + rng.next() * 0.35, state: 'haven', until: day + rng.int(0, 3), haven: h.id, since: day,
    };
    r.havenRank = 'captain';
    r.capId = id;
    G.captains.push(c);
    return c;
  }

  // A new chief of guild `i` (`who`: { cap } or { pid, name }).
  crownChief(i, who, day, how, quiet = false) {
    const G = this.of(i);
    const old = this.chief(i);
    if (old && old.cap) {
      const r = this.recOf(old.cap);
      if (r) r.havenRank = 'captain';
    }
    G.chief = who.pid ? { pid: who.pid, name: who.name, since: day } : { cap: who.cap, since: day };
    if (who.cap) {
      const c = this.captain(G, who.cap);
      const r = this.recOf(c);
      if (r) r.havenRank = 'chief';
    }
    if (who.pid) {
      const m = (G.members[who.pid] ||= { rank: 'hand', merit: 0, joined: day, owed: 0, prizes: 0 });
      m.rank = 'chief';
    }
    for (const [pid, m] of Object.entries(G.members)) if (m.rank === 'chief' && pid !== who.pid) m.rank = 'captain';
    G.mood = clamp(G.mood + 0.1, 0, 1);
    if (!quiet) {
      const nm = who.pid ? who.name : this.chief(i).name;
      this.note(i, `${nm} is chief of ${this.name(i)} now (${how}).`, day);
      this.tellMembers(i, `${nm} is chief of ${this.name(i)} now, ${how}.`, '#ffe070');
    }
  }

  // ------------------------------------------------------------ members
  member(i, pid) {
    const G = this.of(i);
    return G ? G.members[pid] || null : null;
  }

  // Whose guild is `pid` sworn to, and their standing in it: { i, m }.
  standingOf(pid) {
    for (const G of this.g) {
      if (!G) continue;
      const m = G.members[pid];
      if (m && !m.gone) return { i: G.id, m, G };
    }
    return null;
  }

  // Sworn to guild `i` (see piracy.pledge): a hand, with merit for what
  // they've done already.
  joined(pid, i, p = null) {
    for (const G of this.g) if (G && G.id !== i && G.members[pid]) G.members[pid].gone = this.game.day;
    const G = this.of(i);
    const n = p ? this.game.piracy?.p?.[pid]?.n || 0 : 0;
    const m = (G.members[pid] ||= { rank: 'hand', merit: Math.min(30, n * 8), joined: this.game.day, owed: 0, prizes: 0 });
    delete m.gone;
    m.name = playerName(this.game, pid);
  }

  // Something done for the guild (or against it): merit, and a word when
  // it opens a door.
  deed(pid, kind, n = 1) {
    const st = this.standingOf(pid);
    if (!st) return 0;
    const pts = { prize: 10, rival: 12, paid: n, captive: 6, duel: 8, raid: 15, theft: -25, pardon: -999 }[kind] ?? n;
    const was = st.m.merit;
    st.m.merit = Math.max(0, was + (kind === 'paid' ? Math.floor(n) : pts * (kind === 'paid' ? 1 : n)));
    if (kind === 'prize') st.m.prizes = (st.m.prizes || 0) + n;
    if (was < CAPTAIN_AT && st.m.merit >= CAPTAIN_AT && st.m.rank === 'hand') this.tellPid(pid, `The brethren of ${this.name(st.i)} are talking about you: you've proved yourself. Ask a quartermaster for a captain's commission.`, '#ffe070');
    if (was < CHIEF_AT && st.m.merit >= CHIEF_AT && st.m.rank === 'captain') this.tellPid(pid, `Your name is spoken in every haven of ${this.name(st.i)}. You could stand for chief: call the captains to vote at a guild hall, or challenge the chief under the Articles.`, '#ffe070');
    return st.m.merit;
  }

  tellPid(pid, text, color = '#ffd080') {
    const p = playerOf(this.game, pid);
    if (!p) return;
    const say = () => this.game.ui.msg(text, color);
    this.game.asPlayer ? this.game.asPlayer(p, say) : say();
  }

  // A captain's commission: merit enough, and a ship of their own.
  commission(pid, ship) {
    const st = this.standingOf(pid);
    if (!st) return { ok: false, why: 'You\'re not sworn to the brethren.' };
    if (st.m.rank !== 'hand') return { ok: false, why: 'You\'re a captain already.' };
    if (st.m.merit < CAPTAIN_AT) return { ok: false, why: `The brethren don't know you well enough yet. (Merit ${st.m.merit} of ${CAPTAIN_AT}: take prizes, pay in your shares, fight the guild's enemies.)` };
    if (!ship) return { ok: false, why: 'A captain needs a ship under them. Come back with a deck of your own.' };
    st.m.rank = 'captain';
    st.m.ship = ship.name || 'her';
    const c = { id: st.G.nextCap++, rec: null, pid, name: `Captain ${playerName(this.game, pid)}`, ship: ship.name || 'her', type: ship.type, prizes: st.m.prizes || 0, infamy: Math.floor(st.m.merit / 4), scars: 0, loyalty: 1, state: 'player', until: 0, haven: null, since: this.game.day };
    st.G.captains.push(c);
    // (Under the guild's colours.)
    const G = GUILDS[st.i] || GUILDS[0];
    ship.flag = G.flag;
    ship.flagLayers = G.layers;
    this.note(st.i, `${playerName(this.game, pid)} is made a captain of ${this.name(st.i)}, with ${ship.name || 'a ship'} under the guild's colours.`);
    return { ok: true };
  }

  // ------------------------------------------------------------ income
  income(i, n, why = 'a prize') {
    const G = this.of(i);
    if (!G || n <= 0) return;
    G.treasury += n;
    G.lean = 0;
    void why;
  }

  // Coin paid in by a player (their share of what they've taken).
  payIn(pid, n) {
    const st = this.standingOf(pid);
    if (!st || n <= 0) return 0;
    this.income(st.i, n, 'paid in');
    st.m.paid = (st.m.paid || 0) + n;
    return this.deed(pid, 'paid', Math.max(1, Math.floor(n / 4)));
  }

  // ------------------------------------------------------------ at sea
  // How likely a voyage is to be taken at sea (see pirates.takenAtSea):
  // the more of the brethren's ships out, the likelier; a realm paying
  // tribute to all of them, never.
  seaOdds(v) {
    const ow = this.game.world.ow;
    const from = ow.settlements[v.from];
    const civ = from && from.civ ? from.civ.id : null;
    let out = 0;
    for (const G of this.all()) {
      if (G.broken) continue;
      const st = civ !== null ? G.realms[civ] : null;
      if (st && (st.stance === 'tribute' || st.stance === 'marque')) continue;
      const fleet = G.captains.filter((c) => c.state === 'sea').length;
      out += 0.012 * fleet * (G.articles.fishers === 'take' ? 1.2 : 1);
    }
    return clamp(out, 0, 0.12);
  }

  // A voyage taken (see shipfleets.end): which guild, whose ship, and the
  // plunder into their chest; now and then a captive carried off.
  prizeTaken(v, FL, rng, day) {
    const ow = this.game.world.ow;
    const from = ow.settlements[v.from];
    const civ = from && from.civ ? from.civ.id : null;
    const out = [];
    for (const G of this.all()) {
      if (G.broken) continue;
      const st = civ !== null ? G.realms[civ] : null;
      if (st && (st.stance === 'tribute' || st.stance === 'marque')) continue;
      for (const c of G.captains) if (c.state === 'sea') out.push({ G, c });
    }
    if (!out.length) return null;
    const { G, c } = out[rng.int(0, out.length - 1)];
    const n = 50 + rng.int(0, 120) + (v.kind === 'trade' ? 40 : 0);
    this.prize(G, c, n, civ, day, rng, FL && FL.settlement.coast ? FL : null);
    return { guild: G.id, captain: c.name, ship: c.ship };
  }

  // A prize taken by captain `c` of guild G off realm `civ`'s shipping.
  prize(G, c, n, civ, day, rng, port = null) {
    this.income(G.id, n);
    c.prizes++;
    c.infamy += 2;
    if (civ !== null && civ !== undefined) {
      const R = (G.realms[civ] ||= { stance: 'prey', since: day, pressure: 0 });
      R.pressure = (R.pressure || 0) + 1 + (G.articles.quarter === 'none' ? 0.5 : 0);
    }
    // (A captive now and then, for the ransom.)
    const h = this.sim.havens.get(c.haven) || this.sim.havens.standing(G.id)[0];
    if (h && rng.chance(G.articles.quarter === 'none' ? 0.4 : 0.25)) this.sim.havens.takeCaptive(h, `taken off a ship by ${c.ship}`, rng, day, civ, port && port.econ ? port : null);
    if (rng.chance(0.3)) this.note(G.id, `${c.name} brought ${c.ship} home with a prize: ¤${n} into the chest.`, day);
  }

  // ------------------------------------------------------------ each day
  daily(day) {
    if (this.lastDay !== null && day <= this.lastDay) return;
    this.lastDay = day;
    for (const G of this.all()) {
      const rng = new RNG(hash4(this.game.seed >>> 0, G.id, day, 0xb7e7));
      this.seat(G.id, day);
      if (!G.captains.length) continue;
      this.cruise(G, day, rng);
      if ((day + G.id * 2) % 7 === 0) this.shareOut(G, day, rng);
      this.temper(G, day, rng);
      this.autoMatters(G, day, rng);
    }
    if (day % 7 === 3) this.reckon(day);
    if (day % 5 === 1) this.guildsDrift(day);
    this.sim.havens.changes(day);
  }

  // The captains' comings and goings: out, prizes, back, careened.
  cruise(G, day, rng) {
    const H = this.sim.havens;
    for (const c of G.captains) {
      if (c.state === 'player' || c.state === 'dead' || c.state === 'hanged' || c.state === 'gone') continue;
      const r = this.recOf(c);
      if (r && !alive(r)) {
        c.state = 'dead';
        this.note(G.id, `${c.name} is dead, and ${c.ship} has no captain.`, day);
        continue;
      }
      const home = H.get(c.haven);
      if (!home || home.razed) {
        const other = H.standing(G.id)[0];
        if (other) c.haven = other.id;
        else if (c.state !== 'sea') continue;
      }
      if (c.state === 'haven' && day >= c.until && !(G.careen && day < G.careen)) {
        c.state = 'sea';
        c.until = day + rng.int(3, 6);
        if (r) {
          r.away = true;
          if (r.ent && !r.ent.dead) this.game.despawnNpc?.(r.ent);
        }
        continue;
      }
      if (c.state === 'careen' && day >= c.until) {
        c.state = 'haven';
        c.until = day + rng.int(1, 2);
        continue;
      }
      if (c.state !== 'sea') continue;
      // A prize, off whoever's shipping they can find.
      const civs = this.preyFor(G);
      if (civs.length && rng.chance(0.2 * (G.articles.fishers === 'take' ? 1.15 : 1))) {
        const civ = rng.pick(civs);
        const ports = this.sim.realms.memberLayouts(this.game.world.ow.civs[civ]).filter((L) => L.settlement.coast);
        const port = ports.length ? rng.pick(ports) : null;
        const n = 40 + rng.int(0, 110);
        this.prize(G, c, n, civ, day, rng, port);
        if (port) ledger(port, day, `A ship out of ${port.settlement.name} was taken by pirates: ${c.ship}, flying the colours of ${this.name(G.id)}.`);
      }
      // Hunted: a realm that's lost enough to them has its warships out.
      const hunt = Math.max(0, ...Object.values(G.realms).map((R) => (R.stance === 'hunted' || R.stance === 'prey' ? R.pressure || 0 : 0)));
      if (rng.chance(Math.min(0.06, 0.006 * hunt))) {
        const civ = Object.keys(G.realms).find((k) => (G.realms[k].pressure || 0) === hunt);
        const C = civ !== undefined ? this.game.world.ow.civs[+civ] : null;
        if (rng.chance(0.5)) {
          c.state = 'hanged';
          this.note(G.id, `${c.name} and ${c.ship} were taken by a warship${C ? ` of the ${C.name.replace(/^The /, '')}` : ''}. They hanged ${c.name.split(' ').pop()} at the harbour mouth.`, day);
          if (C) this.sim.realms.proclaim(C, day, `The pirate ${c.name} of ${this.name(G.id)} was taken at sea and hanged.`);
          if (r) this.sim.recordDeath(this.game.world.layouts.get(c.rec.sid), r, 'hanged for piracy', null, day);
        } else {
          c.scars++;
          c.state = 'careen';
          c.until = day + 3;
          if (r) r.away = false;
          this.note(G.id, `${c.name} limped home with ${c.ship} shot through, a realm's warship on her heels.`, day);
        }
        continue;
      }
      if (day >= c.until) {
        c.state = 'careen';
        c.until = day + rng.int(1, 2);
        if (r) r.away = false;
      }
    }
    // (A guild short of captains gives one of its corsairs a ship.)
    const live = G.captains.filter((c) => ['haven', 'sea', 'careen'].includes(c.state));
    if (live.length < 2) {
      for (const h of H.standing(G.id)) {
        const L = H.layout(h);
        const r = L && L.npcs.filter((q) => alive(q) && q.age === 'adult' && q.job === 'guard' && q.havenRank === undefined).sort((a, b) => (b.personality?.bravery ?? 0.5) - (a.personality?.bravery ?? 0.5))[0];
        if (!r) continue;
        const c = this.makeCaptain(G, h, L, r, rng, day, { prizes: 0, infamy: rng.int(1, 6) });
        this.note(G.id, `${c.name} has been given ${c.ship}, and a captain's share.`, day);
        break;
      }
    }
    // (No chief: the captains choose one.)
    if (!this.chief(G.id)) {
      const top = live.filter((c) => c.rec).sort((a, b) => b.infamy - a.infamy)[0];
      if (top) this.crownChief(G.id, { cap: top.id }, day, 'chosen by the captains');
    }
    G.broken = !H.standing(G.id).length && !live.length;
  }

  // Realms whose shipping guild G may take (not those paying it off, nor a
  // privateer's patron).
  preyFor(G) {
    const out = [];
    for (const C of this.game.world.ow.civs || []) {
      if (!C || !this.sim.realms.members(C).some((s) => s.coast)) continue;
      const R = G.realms[C.id];
      if (R && (R.stance === 'tribute' || R.stance === 'marque')) continue;
      out.push(C.id);
    }
    // (A privateer's: its patron's enemy, above all.)
    const foes = Object.values(G.realms).filter((R) => R.stance === 'marque' && R.foe !== undefined).map((R) => R.foe);
    return foes.length ? [...foes, ...foes, ...out] : out;
  }

  // The weekly share-out: what's in the chest divided by the Articles.
  shareOut(G, day, rng, how = null) {
    const chiefPid = this.chiefPid(G.id);
    // (A player chief's to decide: put to their council.)
    if (chiefPid && !how) {
      if (!G.matters.some((m) => m.kind === 'share')) this.table(G, 'share', `The chest holds ¤${G.treasury}. The brethren want their shares.`, [['generous', 'Share out nearly all of it'], ['articles', 'By the Articles'], ['keep', 'Keep most of it in the chest']], {}, day);
      return;
    }
    const k = how === 'generous' ? 0.85 : how === 'keep' ? 0.3 : 0.6;
    if (G.treasury < 50) {
      G.lean++;
      G.mood = clamp(G.mood - 0.08 - G.lean * 0.02, 0, 1);
      this.note(G.id, `A lean week: the chest's near empty, and there's nothing to share out. The brethren grumble.`, day);
      return;
    }
    const pot = Math.floor(G.treasury * k);
    G.treasury -= pot;
    G.lastShare = { day, pot };
    const art = G.articles.shares;
    const chiefCut = art === 'chief' ? 3 : art === 'captain' ? 2 : 1;
    const capCut = art === 'equal' ? 1 : 2;
    const caps = G.captains.filter((c) => ['haven', 'sea', 'careen', 'player'].includes(c.state));
    const crew = 8 * caps.length;
    const units = crew + capCut * caps.length + chiefCut;
    const per = pot / Math.max(1, units);
    // (Each player of the guild their share: owed, at any quartermaster.)
    for (const [pid, m] of Object.entries(G.members)) {
      if (m.gone) continue;
      const cut = m.rank === 'chief' ? chiefCut : m.rank === 'captain' ? capCut : 1;
      m.owed = (m.owed || 0) + Math.floor(per * cut);
      void pid;
    }
    G.mood = clamp(G.mood + (k > 0.7 ? 0.14 : k < 0.4 ? -0.06 : 0.06) + (art === 'equal' ? 0.04 : art === 'chief' ? -0.04 : 0), 0, 1);
    for (const c of caps) c.loyalty = clamp(c.loyalty + (k > 0.7 ? 0.05 : k < 0.4 ? -0.05 : 0.02), 0, 1);
    this.note(G.id, `The share-out: ¤${pot} divided by the Articles, ¤${Math.floor(per)} a share. ${k > 0.7 ? 'The brethren cheer the chief.' : k < 0.4 ? 'Most of it stays in the chest, and the brethren mutter.' : 'Rum all round.'}`, day);
    // (A big share-out: the haven makes a night of it. See havenplay.revel.)
    if (pot >= 180) this.sim.havens.revel(G.id, day);
    void rng;
  }

  // How the brethren take things: a sour guild loses captains, and throws
  // out its chief.
  temper(G, day, rng) {
    G.mood = clamp(G.mood + (0.5 - G.mood) * 0.03, 0, 1);
    const live = G.captains.filter((c) => ['haven', 'sea', 'careen'].includes(c.state));
    if (G.mood < 0.35 && live.length > 1 && rng.chance(0.08)) {
      const c = [...live].sort((a, b) => a.loyalty - b.loyalty)[0];
      const chief = this.chief(G.id);
      if (!(chief && chief.cap === c)) {
        const rivals = this.all().filter((o) => o !== G && !o.broken);
        const r = this.recOf(c);
        if (rivals.length && rng.chance(0.6)) {
          const to = rng.pick(rivals);
          c.state = 'gone';
          if (r) delete r.havenRank;
          const nc = { ...c, id: to.nextCap++, state: 'haven', until: day + 2, haven: (this.sim.havens.standing(to.id)[0] || {}).id ?? null, loyalty: 0.5 };
          to.captains.push(nc);
          if (r) r.capId = nc.id;
          if (r) r.havenRank = 'captain';
          this.note(G.id, `${c.name} has gone over to ${this.name(to.id)}, ${c.ship} and all, sick of empty shares.`, day);
          this.note(to.id, `${c.name} has come over to us from ${this.name(G.id)}, with ${c.ship}.`, day);
        } else {
          c.state = 'gone';
          if (r) delete r.havenRank;
          this.note(G.id, `${c.name} has taken a realm's pardon and given up the sea. Turncoat.`, day);
        }
      }
    }
    // The captains' council: a chief who can't fill the chest is thrown out.
    const chief = this.chief(G.id);
    if (chief && G.mood < 0.28 && rng.chance(0.25)) {
      if (chief.pid) {
        if (!G.matters.some((m) => m.kind === 'confidence')) this.table(G, 'confidence', 'The captains have called a vote: they say you\'ve kept the chest empty, and they want a new chief.', [['promise', 'Promise them prizes (and a share-out from your own purse)'], ['face', 'Face them down']], {}, day);
        return;
      }
      const next = live.filter((c) => c !== chief.cap).sort((a, b) => b.infamy * b.loyalty - a.infamy * a.loyalty)[0];
      const pc = this.playerCandidate(G);
      if (pc) {
        this.tellPid(pc.pid, `The captains of ${this.name(G.id)} are turning on their chief: if you mean to stand, now's the time (at a guild hall).`, '#ffe070');
        return;
      }
      if (next) {
        this.note(G.id, `The captains have voted ${chief.name} out: the chest was empty too long.`, day);
        this.crownChief(G.id, { cap: next.id }, day, 'voted in by the captains');
      }
    }
  }

  // The player of the guild most fit to stand for chief, if any.
  playerCandidate(G) {
    let best = null;
    for (const [pid, m] of Object.entries(G.members)) if (!m.gone && m.rank === 'captain' && m.merit >= CHIEF_AT && (!best || m.merit > best.m.merit)) best = { pid, m };
    return best;
  }

  // Now and then the guilds' quarrels turn (the chiefs' own, or the sea's).
  guildsDrift(day) {
    const rng = new RNG(hash4(this.game.seed >>> 0, day, 0x6d21));
    for (let a = 0; a < GUILDS.length; a++) {
      for (let b = a + 1; b < GUILDS.length; b++) {
        if (this.chiefPid(a) || this.chiefPid(b)) continue;
        if (!rng.chance(0.12)) continue;
        const r = this.relation(a, b);
        const i = RELATIONS.indexOf(r);
        const up = rng.chance(this.of(a).mood + this.of(b).mood > 1 ? 0.55 : 0.4);
        const next = RELATIONS[clamp(i + (up ? 1 : -1), 0, RELATIONS.length - 1)];
        if (next !== r) this.setRelation(a, b, next, day, up ? 'the chiefs drank on it' : rng.pick(['a prize fought over', 'an insult in a rum house', 'a captain gone over']));
      }
    }
    this.checkKing(day);
  }

  // ------------------------------------------------------------ the realms
  // Each week every realm the brethren have hurt reckons with them: buys
  // them off, hires them, offers their captains a pardon, or (if it knows
  // where a haven is) sends ships to burn it.
  reckon(day) {
    const H = this.sim.havens;
    const ow = this.game.world.ow;
    for (const G of this.all()) {
      if (G.broken) continue;
      for (const [k, R] of Object.entries(G.realms)) {
        const civ = +k;
        const C = ow.civs[civ];
        if (!C || !this.sim.realms.members(C).length) continue;
        const rng = new RNG(hash4(this.game.seed >>> 0, G.id, civ, day, 0x7ec0));
        R.pressure = Math.max(0, (R.pressure || 0) * 0.85);
        if (R.stance === 'tribute') {
          if (day % 10 === 3 || (day - R.since) % 10 < 7) this.payTribute(G, C, R, day);
          continue;
        }
        if (R.stance === 'marque') {
          if (!this.sim.war.warOf(C) || (R.foe !== undefined && !this.sim.war.enemies(C, ow.civs[R.foe]))) {
            R.stance = 'prey';
            this.note(G.id, `The ${C.name.replace(/^The /, '')}'s war is over, and its letters of marque with it.`, day);
          } else {
            const cap = this.sim.realms.capitalOf(C);
            const CL = cap && this.game.world.layouts.get(cap.id);
            if (CL && CL.econ && CL.econ.treasury > 120) {
              CL.econ.treasury -= 40;
              this.income(G.id, 40, 'privateering');
            }
          }
          continue;
        }
        // (A realm a player rules: theirs to decide; see the crown's talk.)
        if (this.sim.crown && this.sim.crown.of && this.sim.crown.of(C)?.holder) continue;
        const known = H.standing(G.id).filter((h) => H.realmKnows(h, civ));
        if (known.length && R.pressure >= 3 && !H.list.some((h) => h.expedition && this.sim.war.raids.some((q) => q.id === h.expedition))) {
          if (H.expedition(C, known[0], day, rng)) {
            R.stance = 'hunted';
            R.pressure = 0;
            continue;
          }
        }
        if (R.pressure >= 3 && !G.matters.some((m) => m.civ === civ)) {
          const cap = this.sim.realms.capitalOf(C);
          const CL = cap && this.game.world.layouts.get(cap.id);
          const rich = CL && CL.econ && CL.econ.treasury > 260;
          const atWar = this.sim.war.warOf(C);
          const foeId = atWar ? (atWar.a.includes(C.id) ? atWar.b : atWar.a)[0] : undefined;
          const foe = foeId !== undefined ? ow.civs[foeId] : null;
          if (foe && rng.chance(0.5)) this.table(G, 'marque', `The ${C.name.replace(/^The /, '')} offers letters of marque: sail as its privateers against the ${foe.name.replace(/^The /, '')}, for ¤40 a week, and leave its ships be.`, [['accept', 'Take its letters'], ['refuse', 'Refuse']], { civ, foe: foe.id }, day);
          else if (rich && rng.chance(0.6)) this.table(G, 'tribute', `The ${C.name.replace(/^The /, '')} offers tribute: ¤60 every ten days, if the brethren leave its ships and coasts be.`, [['accept', 'Take its coin'], ['refuse', 'Refuse it']], { civ, pay: 60 }, day);
          else if (rng.chance(0.4)) this.table(G, 'pardon', `The ${C.name.replace(/^The /, '')} has proclaimed the King's Pardon for any of the brethren who'll give up the sea. Some of the captains are tempted.`, [['scorn', 'Nail it to the gallows'], ['let', 'Let any who want it go']], { civ }, day);
        }
      }
    }
  }

  payTribute(G, C, R, day) {
    const cap = this.sim.realms.capitalOf(C);
    const CL = cap && this.game.world.layouts.get(cap.id);
    if (!CL || !CL.econ) return;
    if (R.paid === day) return;
    R.paid = day;
    if (CL.econ.treasury < (R.pay || 60)) {
      R.stance = 'prey';
      this.note(G.id, `The ${C.name.replace(/^The /, '')} has stopped paying its tribute. Its ships are fair game again.`, day);
      ledger(CL, day, `The treasury can't meet the tribute to the pirates: their ships will be back.`);
      return;
    }
    CL.econ.treasury -= R.pay || 60;
    this.income(G.id, R.pay || 60, 'tribute');
    ledger(CL, day, `¤${R.pay || 60} was paid to ${this.name(G.id)} to keep them off our ships.`);
  }

  // ------------------------------------------------------------ the council
  // A matter for the chief (a player's to decide in the council window; an
  // NPC chief's decided by them).
  table(G, kind, text, opts, data = {}, day = this.game.day) {
    const m = { id: this.nextMatter++, kind, text, opts, day, until: day + 3, votes: {}, ...data };
    G.matters.push(m);
    if (G.matters.length > 12) G.matters.shift();
    const pid = this.chiefPid(G.id);
    if (pid) this.tellPid(pid, `A matter for the chief of ${this.name(G.id)}: ${text} (Read the Articles by a guild hall's door to sit the council.)`, '#ffe070');
    return m;
  }

  // Matters an NPC chief decides, and a player chief's left too long.
  autoMatters(G, day, rng) {
    const pid = this.chiefPid(G.id);
    for (const m of G.matters.slice()) {
      if (pid && day < m.until) continue;
      const pick = {
        share: 'articles',
        tribute: G.mood < 0.5 || G.treasury < 120 ? 'accept' : 'refuse',
        marque: G.treasury < 200 ? 'accept' : rng.chance(0.5) ? 'accept' : 'refuse',
        pardon: G.mood > 0.4 ? 'scorn' : 'let',
        confidence: 'face',
        thief: G.articles.thieves,
        raid: m.opts[0][0],
        offer: G.mood > 0.5 ? 'accept' : 'refuse',
        king: 'refuse',
      }[m.kind] || m.opts[0][0];
      this.decide(G.id, m.id, pick, null, true);
    }
  }

  // Matter `mid` of guild `i` decided (`k` the choice) by `pid` (or by
  // the chief, NPC, if null). Its outcome, in words.
  decide(i, mid, k, pid = null, auto = false) {
    const G = this.of(i);
    const m = G.matters.find((q) => q.id === mid);
    if (!m) return null;
    if (pid && this.chiefPid(i) !== pid && !auto) {
      // (A captain of the guild who plays: their vote, for the chief.)
      m.votes[pid] = k;
      return 'Your vote is cast.';
    }
    G.matters = G.matters.filter((q) => q !== m);
    const day = this.game.day;
    const C = m.civ !== undefined ? this.game.world.ow.civs[m.civ] : null;
    const rn = C ? C.name.replace(/^The /, '') : 'the realm';
    let out = '';
    switch (m.kind) {
      case 'share':
        this.shareOut(G, day, null, k);
        out = k === 'generous' ? 'The chest is opened wide.' : k === 'keep' ? 'The chest stays mostly full.' : 'Shares by the Articles.';
        break;
      case 'tribute': {
        const R = (G.realms[m.civ] ||= { stance: 'prey', since: day, pressure: 0 });
        if (k === 'accept') {
          R.stance = 'tribute';
          R.since = day;
          R.pay = m.pay || 60;
          R.pressure = 0;
          out = `The brethren take the ${rn}'s coin, and leave its ships be.`;
          if (C) this.sim.realms.proclaim(C, day, `The crown pays ${this.name(i)} to keep off our ships and coasts.`);
        } else {
          G.mood = clamp(G.mood + 0.04, 0, 1);
          out = `The ${rn}'s envoy is sent home with nothing.`;
        }
        break;
      }
      case 'marque': {
        const R = (G.realms[m.civ] ||= { stance: 'prey', since: day, pressure: 0 });
        if (k === 'accept') {
          R.stance = 'marque';
          R.foe = m.foe;
          R.since = day;
          R.pressure = 0;
          out = `The brethren sail as the ${rn}'s privateers now.`;
        } else out = 'The letters of marque are torn up.';
        break;
      }
      case 'pardon':
        if (k === 'let') {
          const live = G.captains.filter((c) => ['haven', 'careen'].includes(c.state)).sort((a, b) => a.loyalty - b.loyalty);
          const c = live[0];
          if (c && c.loyalty < 0.6) {
            c.state = 'gone';
            const r = this.recOf(c);
            if (r) delete r.havenRank;
            out = `${c.name} takes the pardon and goes. The rest stay.`;
          } else out = 'Nobody takes it.';
          G.mood = clamp(G.mood + 0.05, 0, 1);
        } else {
          G.mood = clamp(G.mood + 0.03, 0, 1);
          out = 'The pardon is nailed to the gallows, for the gulls to read.';
        }
        break;
      case 'confidence':
        if (k === 'promise') {
          const p = pid && playerOf(this.game, pid);
          const coins = p ? p.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0) : 0;
          const give = Math.min(coins, 120);
          if (p && give > 0) {
            removeItem(p.inv, 'coin', give);
            G.treasury += give;
          }
          G.mood = clamp(G.mood + 0.1 + give / 600, 0, 1);
          out = give ? `¤${give} from your own purse into the chest, and promises of prizes. They'll give you another month.` : 'Promises. They\'ll give you a week.';
        } else if (G.mood + Math.random() * 0.3 < 0.35) {
          const live = G.captains.filter((c) => c.rec && ['haven', 'sea', 'careen'].includes(c.state)).sort((a, b) => b.infamy - a.infamy);
          if (live[0]) this.crownChief(i, { cap: live[0].id }, day, 'voted in by the captains, the old chief thrown out');
          out = 'They vote you out.';
        } else {
          G.mood = clamp(G.mood + 0.05, 0, 1);
          out = 'You stare them down. The vote fails.';
        }
        break;
      case 'thief': {
        const r = m.rec ? this.game.world.layouts.get(m.rec.sid)?.npcs[m.rec.idx] : null;
        G.mood = clamp(G.mood + (k === 'pardon' ? -0.04 : 0.03), 0, 1);
        out = k === 'pardon' ? `${m.who} is let off, and the brethren think the chief soft.` : k === 'maroon' ? `${m.who} is put ashore on a sandbar with a pistol and a bottle.` : k === 'flog' ? `${m.who} takes forty lashes at the mast.` : `${m.who} walks the plank.`;
        if (r && k === 'plank') this.sim.recordDeath(this.game.world.layouts.get(m.rec.sid), r, 'walked the plank', null, day);
        else if (r && k === 'maroon') {
          r.away = true;
          r.marooned = day;
        }
        break;
      }
      case 'raid': {
        out = this.callRaid(G, k, m, day);
        break;
      }
      case 'offer': {
        if (k === 'accept') this.setRelation(m.from, i, m.rel, day, 'the chiefs\' word');
        out = k === 'accept' ? 'Agreed.' : 'Refused.';
        break;
      }
      default:
        out = 'So decided.';
    }
    m.outcome = out;
    m.decided = day;
    (G.past ||= []).push({ day, text: m.text, choice: k, outcome: out });
    if (G.past.length > 20) G.past.shift();
    if (!auto) this.note(i, `The chief's council: ${out}`, day);
    return out;
  }

  // A raid the chief has called: `k` its target.
  callRaid(G, k, m, day) {
    const rng = new RNG(hash4(this.game.seed >>> 0, G.id, day, 0x4a1d));
    const live = G.captains.filter((c) => ['haven', 'careen', 'sea'].includes(c.state));
    if (!live.length) return 'There\'s nobody to send.';
    if (k === 'shipping' && m.civ !== undefined) {
      const C = this.game.world.ow.civs[m.civ];
      let n = 0;
      for (const c of live.slice(0, 3)) {
        c.state = 'sea';
        c.until = day + 4;
        if (rng.chance(0.65)) {
          const ports = C ? this.sim.realms.memberLayouts(C).filter((L) => L.settlement.coast) : [];
          this.prize(G, c, 60 + rng.int(0, 120), m.civ, day, rng, ports.length ? rng.pick(ports) : null);
          n++;
        }
      }
      return n ? `The fleet fell on the ${C ? C.name.replace(/^The /, '') : 'realm'}'s shipping: ${n} prize${n > 1 ? 's' : ''} taken.` : 'The fleet came home empty-handed.';
    }
    if (k === 'coast' && m.sid !== undefined) {
      const L = this.game.world.layouts.get(m.sid);
      if (!L || !L.econ) return 'The fleet couldn\'t find the place.';
      const def = this.sim.war.defence(L);
      const atk = 2 + live.length * 2.2;
      const win = rng.chance(atk / (atk + def));
      if (win) {
        const loot = Math.min(Math.floor(L.econ.treasury * 0.25), 160);
        L.econ.treasury -= loot;
        this.income(G.id, loot, 'a raid');
        const h = this.sim.havens.standing(G.id)[0];
        if (h) this.sim.havens.takeCaptive(h, 'carried off in a raid on the town', rng, day, null, L);
        ledger(L, day, `Pirates of ${this.name(G.id)} came ashore in the night and plundered the town: ¤${loot} and a captive carried off.`);
        if (L.settlement.civ) {
          const R = (G.realms[L.settlement.civ.id] ||= { stance: 'prey', since: day, pressure: 0 });
          R.pressure = (R.pressure || 0) + 2;
        }
        return `The raid on ${L.settlement.name}: ¤${loot} and a captive.`;
      }
      ledger(L, day, `Pirates tried to come ashore in the night; the watch drove them off.`);
      G.mood = clamp(G.mood - 0.05, 0, 1);
      return `The raid on ${L.settlement.name} was beaten off.`;
    }
    return 'The fleet stays in.';
  }

  // The coastal towns a chief could send a raid against (laid out, not a
  // haven, by the sea).
  raidTargets(G) {
    const out = [];
    for (const L of this.game.world.layouts.values()) {
      const s = L.settlement;
      if (!L.econ || !s.coast || isHaven(s) || s.deserted || s.condition === 'abandoned') continue;
      const R = s.civ ? G.realms[s.civ.id] : null;
      if (R && (R.stance === 'tribute' || R.stance === 'marque')) continue;
      out.push({ sid: s.id, name: s.name, treasury: L.econ.treasury, guards: this.sim.war.defence(L) });
    }
    return out.sort((a, b) => b.treasury / (b.guards + 1) - a.treasury / (a.guards + 1)).slice(0, 4);
  }

  // ------------------------------------------------------------ a chief's own
  // What a player chief can do from their council (see ui/havenwin.js),
  // each the matter it tables (decided there and then).
  chiefAct(i, pid, act, arg = null) {
    const G = this.of(i);
    if (this.chiefPid(i) !== pid) return 'Only the chief can do that.';
    const day = this.game.day;
    switch (act) {
      case 'careen':
        G.careen = day + 2;
        for (const c of G.captains) if (c.state === 'haven' || c.state === 'sea') {
          c.state = 'careen';
          c.until = day + 2;
          c.scars = Math.max(0, c.scars - 1);
          const r = this.recOf(c);
          if (r) r.away = false;
        }
        G.mood = clamp(G.mood + 0.03, 0, 1);
        this.note(i, 'The chief has called the fleet in to careen: every ship hauled up on the beach, scraped and tarred.', day);
        return 'The fleet comes in to careen. Two days on the beach, then out again, faster.';
      case 'raid_ship': {
        const m = { kind: 'raid', civ: +arg };
        return this.callRaid(G, 'shipping', m, day);
      }
      case 'raid_coast': {
        const m = { kind: 'raid', sid: +arg };
        return this.callRaid(G, 'coast', m, day);
      }
      case 'article': {
        const [k, v] = String(arg).split(':');
        if (!ARTICLES[k] || !ARTICLES[k].opts.some((o) => o[0] === v)) return 'No such article.';
        // (The captains vote on it: a popular change carries easily.)
        const kind = (k === 'shares' && v === 'equal') || (k === 'fishers' && v === 'take') || (k === 'quarter' && v === 'give');
        const ayes = G.captains.filter((c) => ['haven', 'sea', 'careen'].includes(c.state) && hash4(c.id, day, k.length) % 100 < (kind ? 75 : 45) + (G.mood - 0.5) * 40).length;
        const all = G.captains.filter((c) => ['haven', 'sea', 'careen'].includes(c.state)).length;
        if (ayes * 2 >= all) {
          G.articles[k] = v;
          this.note(i, `The Articles are amended: ${ARTICLES[k].opts.find((o) => o[0] === v)[1].toLowerCase()} (${ayes} of ${all} captains for it).`, day);
          return `Carried, ${ayes} to ${all - ayes}.`;
        }
        G.mood = clamp(G.mood - 0.03, 0, 1);
        return `Voted down, ${ayes} to ${all - ayes}.`;
      }
      case 'relation': {
        const [j, r] = String(arg).split(':');
        const o = +j;
        if (!GUILDS[o] || o === i || !RELATIONS.includes(r)) return 'Nonsense.';
        const cur = this.relation(i, o);
        if (r === 'war' || RELATIONS.indexOf(r) < RELATIONS.indexOf(cur)) {
          this.setRelation(i, o, r, day, 'the chief\'s word');
          return `It's ${r} with ${this.name(o)}.`;
        }
        // (Peace takes two: the other chief answers.)
        const op = this.chiefPid(o);
        if (op) {
          this.table(this.of(o), 'offer', `${playerName(this.game, pid)}, chief of ${this.name(i)}, offers ${r === 'alliance' ? 'an alliance' : 'a truce'}.`, [['accept', 'Accept'], ['refuse', 'Refuse']], { from: i, rel: r }, day);
          return `The offer's gone to ${this.name(o)}'s chief.`;
        }
        const yes = this.of(o).mood > 0.4 && hash4(i, o, day) % 100 < (r === 'truce' ? 70 : 45);
        if (yes) this.setRelation(i, o, r, day, 'the chiefs\' word');
        return yes ? `${cap(this.name(o))} agree.` : `${cap(this.name(o))} refuse.`;
      }
      case 'found': {
        if (G.treasury < 200) return 'It\'d take ¤200 from the chest to found a new haven.';
        const at = this.sim.havens.lonelyShore(new RNG(hash4(this.game.seed >>> 0, day, i, 0xf0)), null);
        if (!at) return 'There\'s no lonely shore left that nobody\'s seen.';
        G.treasury -= 200;
        const h = this.sim.havens.create(at.cx, at.cz, i, null, 'founded', new RNG(hash4(day, i, 0x7a)));
        this.sim.havens.learn(h, pid, 'seen');
        this.note(i, `The chief has founded a new haven: ${h.name}. Ships have gone with timber and hands.`, day);
        return `${h.name} is founded: marked on your map.`;
      }
      case 'release': {
        const p = this.sim.war.prisoners.find((q) => q.id === +arg && q.pirate === i);
        if (!p) return 'Nobody by that name in the stockade.';
        this.sim.war.release(p, 'released', day);
        G.mood = clamp(G.mood - 0.02, 0, 1);
        return `${p.name} is let go, and goes home.`;
      }
      case 'press': {
        const p = this.sim.war.prisoners.find((q) => q.id === +arg && q.pirate === i);
        const h = p && this.sim.havens.get(p.haven);
        if (!p || !h) return 'Nobody by that name in the stockade.';
        this.sim.havens.press(h, p, day);
        return `${p.name} takes the oath.`;
      }
    }
    return 'Nothing to do.';
  }

  // ------------------------------------------------------------ chief
  // The captains' vote, called by `pid` at a guild hall: the captains each
  // decide (merit against the chief's standing and the guild's mood). The
  // votes in order, for the window to show, and whether they carried it.
  callVote(i, pid) {
    const G = this.of(i);
    const st = this.standingOf(pid);
    const day = this.game.day;
    if (!st || st.i !== i) return { ok: false, why: 'You\'re not of this brotherhood.' };
    if (st.m.rank === 'chief') return { ok: false, why: 'You\'re chief already.' };
    if (st.m.rank !== 'captain') return { ok: false, why: 'Only a captain can stand for chief.' };
    if (st.m.merit < CHIEF_AT) return { ok: false, why: `The captains wouldn't follow you yet. (Merit ${st.m.merit} of ${CHIEF_AT}.)` };
    if (G.lastVote && day - G.lastVote < 7) return { ok: false, why: 'There was a vote this week already. Give it time.' };
    G.lastVote = day;
    const chief = this.chief(i);
    const chiefPow = chief ? (chief.cap ? chief.cap.infamy + chief.cap.prizes * 2 : this.member(i, chief.pid)?.merit || 60) : 0;
    const votes = [];
    for (const c of G.captains) {
      if (!['haven', 'sea', 'careen', 'player'].includes(c.state) || c.pid === pid || (chief && chief.cap === c)) continue;
      let lean = st.m.merit / (st.m.merit + chiefPow + 1) + (0.5 - G.mood) * 0.6 - (c.loyalty - 0.5) * 0.4 + ((hash4(c.id, day, 0x707e) % 100) / 100 - 0.5) * 0.35;
      // (A player captain's own vote: theirs, if they've cast it; else for.)
      if (c.pid) lean = 1;
      votes.push({ name: c.name, aye: lean > 0.45 });
    }
    const ayes = votes.filter((v) => v.aye).length;
    const carried = votes.length > 0 && ayes * 2 > votes.length;
    if (carried) this.crownChief(i, { pid, name: playerName(this.game, pid) }, day, `voted in by the captains, ${ayes} to ${votes.length - ayes}`);
    else {
      st.m.merit = Math.max(0, st.m.merit - 15);
      this.note(i, `${playerName(this.game, pid)} stood for chief and lost, ${ayes} to ${votes.length - ayes}.`, day);
    }
    return { ok: true, votes, carried, ayes };
  }

  // A challenge to the chief under the Articles, won or lost (see
  // Game.endDuel).
  challengeDone(i, pid, won) {
    const day = this.game.day;
    const st = this.standingOf(pid);
    if (!st) return;
    const chief = this.chief(i);
    if (won) {
      if (chief && chief.cap) {
        chief.cap.scars++;
        chief.cap.loyalty = 0.3;
      }
      this.crownChief(i, { pid, name: playerName(this.game, pid) }, day, `having beaten ${chief ? chief.name : 'the old chief'} under the Articles`);
      this.deed(pid, 'duel');
    } else {
      st.m.merit = Math.max(0, st.m.merit - 20);
      this.note(i, `${playerName(this.game, pid)} challenged ${chief ? chief.name : 'the chief'} under the Articles, and was beaten.`, day);
    }
  }

  // Can `pid` challenge the chief of guild `i` now? { ok, why }.
  canChallenge(i, pid) {
    const st = this.standingOf(pid);
    if (!st || st.i !== i) return { ok: false, why: 'You\'re not of this brotherhood.' };
    if (st.m.rank !== 'captain') return { ok: false, why: st.m.rank === 'chief' ? 'You\'re the chief.' : 'Only a captain may challenge the chief.' };
    if (st.m.merit < CHIEF_AT) return { ok: false, why: `The Articles say a challenger must be known to the brethren. (Merit ${st.m.merit} of ${CHIEF_AT}.)` };
    return { ok: true };
  }

  // The Pirate King: a chief whose guild's allied with both the others.
  checkKing(day) {
    for (let i = 0; i < GUILDS.length; i++) {
      const pid = this.chiefPid(i);
      if (!pid) continue;
      const allied = GUILDS.every((_, j) => j === i || this.relation(i, j) === 'alliance');
      if (allied && (!this.king || this.king.pid !== pid)) {
        this.king = { pid, name: playerName(this.game, pid), day, guild: i };
        for (let j = 0; j < GUILDS.length; j++) this.note(j, `${this.king.name}, chief of ${this.name(i)}, is hailed Pirate King by all the brethren.`, day);
        const m = this.member(i, pid);
        if (m) m.king = day;
        this.tellPid(pid, 'Every guild of the brethren hails you their king. The Pirate King!', '#ffe070');
      } else if (this.king && this.king.pid === pid && !allied) {
        this.note(i, `${this.king.name} is no longer king of the brethren: the guilds have fallen out.`, day);
        this.king = null;
      }
    }
  }

  // ------------------------------------------------------------ words
  flagLines(h, pid) {
    const i = h.guild;
    const G = this.of(i);
    const ch = this.chief(i);
    const st = this.standingOf(pid);
    const live = G.captains.filter((c) => ['haven', 'sea', 'careen', 'player'].includes(c.state));
    const lines = [
      `${cap(this.name(i))}. ${h.razed ? 'Burned out.' : `Their haven: ${h.name}.`}`,
      ch ? `Their chief: ${ch.name}.` : 'They have no chief.',
      `Captains: ${live.length} (${live.filter((c) => c.state === 'sea').length} at sea).`,
      `The brethren are ${G.mood > 0.65 ? 'flush and merry' : G.mood > 0.45 ? 'content enough' : G.mood > 0.3 ? 'grumbling' : 'close to mutiny'}.`,
    ];
    if (st && st.i === i) lines.push(`You: ${RANK_NAMES[st.m.rank]} (merit ${st.m.merit})${st.m.owed ? `, ¤${st.m.owed} of shares owed you` : ''}.`);
    else if (st) lines.push(`You're sworn to ${this.name(st.i)}: ${this.relation(i, st.i)} with this guild.`);
    if (this.king) lines.push(`The Pirate King: ${this.king.name}.`);
    return lines;
  }

  billsLines(h, pid) {
    const lines = [];
    const war = this.game.world.ow.civs || [];
    const pir = this.game.piracy && this.game.piracy.p ? this.game.piracy.p : {};
    for (const [k, r] of Object.entries(pir)) {
      const realms = Object.entries(r.sunk || {}).filter(([, n]) => n > 0).map(([c]) => war[+c]).filter(Boolean);
      if (!realms.length) continue;
      const price = this.sim.havens.bountyOf ? this.sim.havens.bountyOf(k) : 0;
      lines.push(`WANTED by the ${realms.map((c) => c.name.replace(/^The /, '')).join(' and ')}: ${playerName(this.game, k)}${price ? `, ¤${price}` : ''}.${k === pid ? ' (You.)' : ''}`);
    }
    if (h) {
      const G = this.of(h.guild);
      for (const c of G.captains.filter((q) => ['haven', 'sea', 'careen'].includes(q.state)).sort((a, b) => b.infamy - a.infamy).slice(0, 3)) lines.push(`WANTED: ${c.name} of ${c.ship}, for piracy. ¤${20 + c.infamy * 3}, dead or alive.`);
    }
    if (!lines.length) lines.push('Old bills, torn and faded. Nobody you know.');
    lines.push('(The brethren nail them up for a laugh.)');
    return lines;
  }

  // The Articles board, used: the council (for the guild's own), or the
  // Articles read out.
  openArticles(h, p) {
    const pid = pidOf(p);
    if (this.game.openHavenCouncil) this.game.openHavenCouncil(h, p);
    else this.game.ui.openSign(this.articlesLines(h.guild), 'THE ARTICLES');
    void pid;
  }

  articlesLines(i) {
    const G = this.of(i);
    return [`THE ARTICLES OF ${this.name(i).toUpperCase()}`, ...ARTICLE_IDS.map((k, n) => `${n + 1}. ${ARTICLES[k].opts.find((o) => o[0] === G.articles[k])[1]}.`), '5. No fighting aboard: settle it ashore, with steel.', '6. The chief is chosen by the captains, and may be challenged.'];
  }

  // A sea chest dug up (see havenplay.js): its treasure.
  openChest(x, y, z, p) {
    this.sim.havens.openChest(x, y, z, p);
  }

  // What the council window shows guild `i` to `pid` (plain data, sent to a
  // guest's screen as it is: see ui/havenwin.js).
  view(i, pid) {
    const G = this.of(i);
    const ch = this.chief(i);
    const st = this.standingOf(pid);
    const mine = st && st.i === i ? st.m : null;
    const H = this.sim.havens;
    const ow = this.game.world.ow;
    const held = H.standing(i).flatMap((h) => H.held(h).map((p) => ({ id: p.id, name: p.name, from: ow.settlements[p.sid]?.name || '?', days: this.game.day - p.day, ransom: p.ransom || 0, haven: h.name })));
    const realms = Object.entries(G.realms).map(([k, R]) => ({ civ: +k, name: ow.civs[+k] ? ow.civs[+k].name.replace(/^The /, '') : '?', stance: R.stance, pressure: Math.round((R.pressure || 0) * 10) / 10 }));
    return {
      i, name: this.name(i), flag: (GUILDS[i] || GUILDS[0]).flag, chief: ch ? ch.name : null, chiefYou: !!(ch && ch.pid === pid), treasury: G.treasury, mood: Math.round(G.mood * 100) / 100,
      articles: { ...G.articles },
      captains: G.captains.filter((c) => ['haven', 'sea', 'careen', 'player'].includes(c.state)).map((c) => {
        const r = this.recOf(c);
        return { id: c.id, name: c.name, ship: c.ship, state: c.state, prizes: c.prizes, infamy: c.infamy, scars: c.scars, loyalty: Math.round(c.loyalty * 100) / 100, chief: !!(ch && ch.cap === c), you: c.pid === pid, look: r ? r.look : null };
      }),
      matters: G.matters.map((m) => ({ id: m.id, kind: m.kind, text: m.text, opts: m.opts, voted: m.votes[pid] || null })),
      past: (G.past || []).slice(-5),
      log: G.log.slice(-6),
      rel: GUILDS.map((_, j) => (j === i ? null : { j, name: this.name(j), rel: this.relation(i, j) })).filter(Boolean),
      realms, held, havens: H.standing(i).map((h) => ({ id: h.id, name: h.name })),
      targets: mine && mine.rank === 'chief' ? this.raidTargets(G) : [],
      me: mine ? { rank: mine.rank, merit: mine.merit, owed: mine.owed || 0, king: !!mine.king } : null,
      king: this.king ? this.king.name : null, captainAt: CAPTAIN_AT, chiefAt: CHIEF_AT,
      lastVote: G.lastVote ?? null, day: this.game.day,
    };
  }

  // ------------------------------------------------------------ save
  serialize() {
    return { g: this.g, rel: this.rel, king: this.king, nextMatter: this.nextMatter, lastDay: this.lastDay };
  }

  load(d) {
    this.g = (d && d.g) || [];
    this.rel = (d && d.rel) || {};
    this.king = (d && d.king) || null;
    this.nextMatter = (d && d.nextMatter) || 1;
    this.lastDay = d && d.lastDay !== undefined ? d.lastDay : null;
  }
}

function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export { DAY, fullName };
