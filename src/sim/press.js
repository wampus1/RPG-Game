// The press: a licensed scribe keeps a record of what happens (the town's
// notices, and news that comes in from afar), picks the stories for an
// edition at their desk and prints copies to hand out. Everyone who reads
// it knows the news, and some will talk about it.
import { countItem, removeItem } from '../game/inventory.js';
import { ledger } from './econ.js';

// Paper and ink for each run of copies.
export const COPIES_PER_RUN = 4;
export const MAX_HEADLINES = 4;

const MASTHEADS = ['Gazette', 'Crier', 'Chronicle', 'Herald', 'Courier', 'Broadsheet'];

export class Press {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.editions = [];
    this.next = 1;
  }

  mastheadFor(s) {
    let h = 0;
    for (const ch of s.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `The ${s.name} ${MASTHEADS[h % MASTHEADS.length]}`;
  }

  // The stories a scribe has on record: what happened in town these last
  // few days, and what travellers brought from other places.
  stories(L, days = 4) {
    const day = this.game.day;
    const e = L.econ;
    const out = [];
    for (const it of [...(e.ledger || [])].reverse()) {
      if (it.day < day - days) break;
      if (/wrote to|paid .* to carry|marked out a new/.test(it.text)) continue;
      if (!out.some((q) => q.text === it.text)) out.push({ text: it.text, day: it.day, from: L.settlement.name });
      if (out.length >= 12) break;
    }
    for (const r of [...(e.rumours || [])].reverse().slice(0, 4)) out.push({ text: r.text, day: r.day ?? day, from: r.from, afar: true });
    return out;
  }

  // Materials for a run of copies.
  canPrint(copies) {
    const inv = this.game.player.inv;
    const runs = Math.ceil(copies / COPIES_PER_RUN);
    return countItem(inv, 'paper') >= runs && countItem(inv, 'ink') >= runs;
  }

  // Print an edition: the chosen stories, this many copies.
  print(L, picks, copies = COPIES_PER_RUN) {
    const g = this.game;
    const p = g.player;
    if (!picks.length || !this.canPrint(copies)) return null;
    const runs = Math.ceil(copies / COPIES_PER_RUN);
    removeItem(p.inv, 'paper', runs);
    removeItem(p.inv, 'ink', runs);
    const s = L.settlement;
    const ed = { id: this.next++, sid: s.id, title: this.mastheadFor(s), day: g.day, by: g.playerName, headlines: picks.slice(0, MAX_HEADLINES).map((q) => ({ text: q.text, from: q.from, afar: !!q.afar })) };
    this.editions.push(ed);
    if (this.editions.length > 6) this.editions.shift();
    const left = p.give('newspaper', runs * COPIES_PER_RUN);
    if (left) g.spawnDrop('newspaper', left, p.x, p.y, p.z, true);
    ledger(L, g.day, `${g.playerName} printed ${ed.title}, edition ${ed.id}.`);
    return ed;
  }

  latest() {
    return this.editions[this.editions.length - 1] || null;
  }

  // Someone takes a copy. Returns what they make of it.
  handOut(npc) {
    const g = this.game;
    const p = g.player;
    const ed = this.latest();
    const rec = npc.rec;
    if (!ed || countItem(p.inv, 'newspaper') <= 0) return { ok: false, reason: 'none' };
    if (rec.readEdition === ed.id) return { ok: false, reason: 'read', ed };
    removeItem(p.inv, 'newspaper', 1);
    rec.readEdition = ed.id;
    // Fresh news pleases; stale news, less so.
    const fresh = g.day - ed.day <= 2;
    this.sim.changeRep(npc, fresh ? 2 : 0.5);
    // A licensed scribe gets a coin or two for a copy.
    let paid = 0;
    if (this.sim.careers.canUseBench('scribe') && rec.age !== 'child' && (rec.coins || 0) >= 2) {
      paid = rec.coins >= 20 ? 2 : 1;
      rec.coins -= paid;
      p.give('coin', paid);
    }
    const story = ed.headlines[rec.idx % ed.headlines.length];
    return { ok: true, ed, story, fresh, paid };
  }

  serialize() {
    return { editions: this.editions, next: this.next };
  }

  load(d) {
    if (!d) return;
    this.editions = d.editions || [];
    this.next = d.next || this.editions.length + 1;
  }
}
