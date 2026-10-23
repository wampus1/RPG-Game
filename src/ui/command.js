// (Round 144) The war table (B): where you command, in the moment, without
// the battle stopping for you.
//   - In a battle near you, with a host or a band to command: the field
//     from above (the lie of the land, every soldier a dot in their colours,
//     each band's banner and its order), your bands down the side with
//     their nerve and what they're about, and the orders: pick a band (its
//     number, or click it on the field), click where (for an advance, a
//     falling back, a swing round a flank), and give the word. The host's
//     commander can change the plan as it goes, and leave a band to its
//     captain again. Storming a town, the word for when it falls.
//   - Before a battle, for whoever's to command the host: a council of war.
//     The field and the hour, what's coming against you (as near as can be
//     told; scouts can tell you more), how each plan would answer, and
//     whether to shut the gates instead.
//   - A siege (yours to command, or to hold): its state day by day, and the
//     orders for it.
//   - Otherwise, how the war stands, and where you are in it.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { button } from './govkit.js';
import { CHAR_W, CHAR_H } from '../config.js';
import { ORDERS, standing, bandUp, centroid } from '../sim/bands.js';
import { commandOf, playerOrder, setPlan, giveWord, pkOf } from '../sim/command.js';
import { TACTICS } from '../sim/war.js';
import { siegeLines, siegeOrder, RATION_NAMES } from '../sim/siege.js';
import { lookOf } from './townlook.js';
import { styleOf } from '../sim/bands.js';
import { DAY } from '../sim/econ.js';

const W = 82;
const H = 32;
const plain = (civ) => (civ ? civ.name.replace(/^The /, '') : 'free folk');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
// The orders as they're shown, in order, with their keys.
const ORDER_KEYS = [['hold', 'H'], ['advance', 'A'], ['charge', 'C'], ['fallback', 'F'], ['wheel', 'W'], ['rally', 'R'], ['loose', 'L'], ['shieldwall', 'S'], ['follow', 'O'], ['storm', 'T'], ['man', 'M'], ['free', 'X']];
const STATE_COL = { ok: '#a0e8a0', waver: '#ffd070', rout: '#ff7060' };
const PLAN_IDS = ['line', 'flank', 'pincer', 'hold', 'works', 'feint', 'retreat'];
// The map's square on the window, in its cells.
const MX = 35;
const MY = 3;
const MW = 45;
const MH = 21;

export class WarTableWindow extends Window {
  constructor(ui) {
    super(ui, W, H, { kind: 'wartable' });
    this.game = ui.game;
    // (Whose table it is: with others playing, the one who opened it.)
    this.me = ui.game.player;
    this.sel = null; // band id, or 'all'
    this.point = null; // a point on the field, clicked
    this.say = null;
    this.t = 0;
    this.groundAt = -1;
  }

  get war() {
    return this.game.sim.war;
  }

  update(dt) {
    this.t += dt;
    if (this.say) {
      this.say.t -= dt;
      if (this.say.t <= 0) this.say = null;
    }
  }

  tell(text, col = C.hi) {
    this.say = { text, col, t: 4 };
  }

  // What's shown: a battle you're in, a siege you're part of, a battle to
  // come you're to command, or the war as it stands.
  mode() {
    const war = this.war;
    const p = this.me;
    if (war.live && war.live.kind === 'battle' && war.live.pside && war.live.pside.has(p)) return 'field';
    const civ = war.playerCiv();
    const w = civ ? war.warOf(civ) : null;
    if (w && w.siege && this.siegeRole(w)) return 'siege';
    if (w && w.plan && !w.plan.live && this.councilRole(w)) return 'council';
    return 'war';
  }

  // ------------------------------------------------------------ drawing
  draw(g) {
    const war = this.war;
    const mode = this.mode();
    g.box(0, 0, this.w, this.h, { bg: 'rgba(20,16,12,0.96)', double: true, title: 'THE WAR TABLE', titleFg: '#ffd070' });
    this.mapOn = false;
    if (mode === 'field') this.drawField(g);
    else if (mode === 'siege') this.drawSiege(g);
    else if (mode === 'council') this.drawCouncil(g);
    else this.drawWar(g);
    if (this.say) g.text(2, this.h - 2, this.say.text.slice(0, this.w - 4), this.say.col);
    g.text(this.w - 22, this.h - 1, ' B / ESC: close ', C.dim);
    void war;
  }

  // ------------------------------------------------------------ the field
  drawField(g) {
    const war = this.war;
    const L = war.live;
    const p = this.me;
    const c = commandOf(war, p);
    const S = L.sides[c.side];
    const O = L.sides[c.side === 'a' ? 'b' : 'a'];
    this.mapOn = true;
    const name = L.plan ? L.plan.name.replace(/^the /, 'The ') : 'The battle';
    g.text(2, 1, name.slice(0, 40), C.hi);
    const role = c.rank === 'marshal' ? 'You command the host.' : c.rank === 'captain' ? `You lead ${c.bands.map((b) => b.name).join(', ')}.` : `You fight in ${c.band ? c.band.name : 'the line'}${c.band && c.band.captain ? ` (Captain ${c.band.captain.rec.name.first})` : ''}.`;
    g.text(2, 2, role.slice(0, 32), c.rank === 'soldier' ? C.dim : '#ffd070');
    // Our bands.
    let y = 4;
    g.text(2, y++, `OURS: the ${plain(S.civ)}`.slice(0, 31), S.civ ? S.civ.color.hex : C.fg);
    const mine = c.rank === 'marshal' ? S.bands : S.bands;
    mine.forEach((b, i) => {
      if (y > 17) return;
      const up = bandUp(b);
      const ours = c.rank === 'marshal' || b.player === p;
      const sel = this.sel === b.id || (this.sel === 'all' && ours);
      const bg = sel ? C.bgSel : this.hovering(1, y, 32, 1) && ours ? 'rgba(60,50,30,0.8)' : undefined;
      if (bg) g.fill(1, y, 32, 1, ' ', C.fg, bg);
      g.text(2, y, `${i + 1}`, ours ? C.hi : C.faint);
      g.put(4, y, '⚑', b.color);
      g.text(6, y, b.name.replace(/^the /, '').slice(0, 11), b.state === 'rout' ? '#ff7060' : ours ? C.fg : C.dim);
      const bars = Math.round(b.morale / 20);
      for (let k = 0; k < 5; k++) g.put(18 + k, y, k < bars ? '▮' : '▯', k < bars ? STATE_COL[b.state] : C.faint);
      g.text(24, y, `${up}`.padStart(2), C.dim);
      const ord = b.state === 'rout' ? 'RUNNING' : (ORDERS[b.order.kind] ? ORDERS[b.order.kind].name : b.order.kind).toUpperCase();
      g.text(27, y, ord.slice(0, 6), b.order.by === 'ai' ? C.dim : '#a0d8ff');
      if (ours) this.hit(1, y, 32, 1, () => {
        this.sel = b.id;
      });
      y++;
    });
    y++;
    g.text(2, y++, `THEIRS: the ${plain(O.civ)}`.slice(0, 31), O.civ ? O.civ.color.hex : C.fg);
    for (const b of O.bands) {
      if (y > 23) break;
      const up = bandUp(b);
      g.put(4, y, '⚑', b.color);
      g.text(6, y, b.name.replace(/^the /, '').slice(0, 11), b.state === 'rout' ? '#ff7060' : C.dim);
      // (Their nerve, as it looks from here: roughly.)
      const look = b.state === 'rout' ? 'running' : b.state === 'waver' ? 'shaken' : b.morale > 65 ? 'steady' : 'holding';
      g.text(18, y, look, STATE_COL[b.state]);
      g.text(26, y, `${up}`.padStart(2), C.faint);
      y++;
    }
    // The plan.
    g.text(MX, 1, `Their plan: ${TACTICS[O.tactic] ? TACTICS[O.tactic].name : 'storming the walls'}`.slice(0, MW), C.dim);
    g.text(MX, 2, `Ours: ${TACTICS[S.tactic] ? TACTICS[S.tactic].name : S.tactic === 'walls' ? 'holding the walls' : 'storming the walls'}`.slice(0, MW), C.fg);
    // The orders.
    if (c.rank === 'soldier') {
      const lines = wrap('You\'re not in command here: keep with your band\'s banner, and do as your captain says. If the banner falls, take it up (F, standing on it): the band will look to you.', 76);
      lines.forEach((l, i) => g.text(2, 25 + i, l, C.dim));
      return;
    }
    let x = 2;
    y = 25;
    g.text(2, 24, (this.sel ? (this.sel === 'all' ? 'All your bands:' : `${cap(S.bands.find((b) => b.id === this.sel)?.name || '')}:`) + (this.point ? ' (to the point marked)' : ' (click the field for where; right-click: go there)') : 'Pick a band (1-9, 0 for all, or click it); then an order.').slice(0, this.w - 4), this.sel ? C.hi : C.dim);
    for (const [k, key] of ORDER_KEYS) {
      const O0 = ORDERS[k];
      if (O0 && O0.siege && !L.siege) continue;
      if (k === 'shieldwall' && !S.shields) continue;
      const label = ` ${key} ${k === 'free' ? 'To its captain' : O0.name} `;
      if (x + label.length > this.w - 2) {
        x = 2;
        y++;
      }
      x = button(this, g, x, y, label, k === 'charge' ? '#ff9070' : k === 'free' ? C.dim : C.fg, () => this.order(k), !!this.sel);
    }
    y++;
    if (c.rank === 'marshal') {
      g.text(2, y + 1, 'Plan:', C.dim);
      let px = 8;
      for (const t of PLAN_IDS) {
        const lab = ` ${t} `;
        px = button(this, g, px, y + 1, lab, S.tactic === t ? '#ffd070' : C.fg, () => {
          const r = setPlan(this.war, this.me, t);
          this.tell(r.ok ? `The plan now: ${TACTICS[t].name}.` : r.why, r.ok ? C.hi : C.orange);
        }, S.tactic !== t && !L.siege);
      }
      // Storming a town: the word for when it falls.
      if (L.siege && c.side === L.siege.atk) {
        g.text(2, y + 2, 'When it falls:', C.dim);
        let wx = 17;
        for (const [k, lab] of [['spare', ' Spare the town '], ['loot', ' Plunder, no killing '], ['free', ' The town is yours '], ['none', ' As they will ']]) {
          wx = button(this, g, wx, y + 2, lab, (L.word || 'none') === k ? '#ffd070' : k === 'free' ? '#ff9070' : C.fg, () => {
            const r = giveWord(this.war, this.me, k);
            this.tell(r.ok ? 'The word is given.' : r.why, r.ok ? C.hi : C.orange);
          });
        }
      }
    }
  }

  // An order to the band picked (and the point clicked, for where).
  order(kind) {
    if (!this.sel) return this.tell('Pick a band first (its number, or click it).', C.orange);
    const at = this.point && this.t - this.point.t < 30 ? this.point : null;
    const r = playerOrder(this.war, this.me, this.sel, kind, at);
    if (!r.ok) return this.tell(r.why, C.orange);
    this.ui.audio?.play('war_horn');
    this.tell(kind === 'free' ? 'Left to its captain.' : `${ORDERS[kind].name}!`, C.hi);
    if (at && kind !== 'free') this.point = null;
    return null;
  }

  // The field from above: the land (as the blocks on top colour it), then
  // the soldiers, the banners, the orders, you.
  drawPixels(ctx) {
    if (!this.mapOn) return;
    const war = this.war;
    const L = war.live;
    if (!L || !L.sides) return;
    const X = (this.x + MX) * CHAR_W;
    const Y = (this.y + MY) * CHAR_H;
    const PW = MW * CHAR_W;
    const PH = MH * CHAR_H;
    // The view: round the field (all the bands), four pixels a pace.
    const k = 4;
    const cx = Math.round(L.centre.x);
    const cz = Math.round(L.centre.z);
    const tw = Math.floor(PW / k);
    const th = Math.floor(PH / k);
    const x0 = cx - Math.floor(tw / 2);
    const z0 = cz - Math.floor(th / 2);
    this.view = { x0, z0, k, X, Y, tw, th };
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, PW, PH);
    ctx.clip();
    // The land, redrawn now and then.
    if (!this.ground || this.groundAt < 0 || this.t - this.groundAt > 2 || this.groundKey !== `${x0},${z0}`) {
      this.ground = this.paintGround(x0, z0, tw, th);
      this.groundAt = this.t;
      this.groundKey = `${x0},${z0}`;
    }
    if (this.ground) ctx.drawImage(this.ground, X, Y, tw * k, th * k);
    else {
      ctx.fillStyle = '#2a3020';
      ctx.fillRect(X, Y, PW, PH);
    }
    const at = (x, z) => [X + (x - x0) * k, Y + (z - z0) * k];
    const p = this.me;
    const c = commandOf(war, p);
    // Orders: a line from each of our bands to where it's bound.
    for (const s of ['a', 'b']) {
      const S = L.sides[s];
      for (const b of S.bands || []) {
        if (!bandUp(b)) continue;
        const cen = b.cen || centroid(b);
        if (s === c.side && b.order.at && b.state !== 'rout') {
          const [ax, ay] = at(cen.x, cen.z);
          const [bx, by] = at(b.order.at.x, b.order.at.z);
          ctx.strokeStyle = b.order.by === 'ai' ? 'rgba(255,224,112,0.5)' : 'rgba(160,216,255,0.85)';
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(ax + 2, ay + 2);
          ctx.lineTo(bx + 2, by + 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    // Everyone on the field: a dot each, in their colours (ours bright).
    for (const s of ['a', 'b']) {
      const S = L.sides[s];
      const col = S.civ ? S.civ.color.hex : '#a09080';
      ctx.fillStyle = col;
      for (const n of S.ents) {
        if (n.dead || n.down) continue;
        const [px, py] = at(n.x, n.z);
        if (px < X - k || py < Y - k || px > X + PW || py > Y + PH) continue;
        ctx.globalAlpha = n.warband && n.warband.phase === 'flee' ? 0.4 : 1;
        ctx.fillRect(px, py, k - 1, k - 1);
      }
      ctx.globalAlpha = 1;
      // The banners, with each band's number (ours).
      (S.bands || []).forEach((b, i) => {
        if (!bandUp(b)) return;
        const cen = b.cen || centroid(b);
        const [px, py] = at(cen.x, cen.z);
        ctx.fillStyle = '#e8d070';
        ctx.fillRect(px + 1, py - 9, 1, 10);
        ctx.fillStyle = b.color;
        ctx.fillRect(px + 2, py - 9, 6, 4);
        if (b.state === 'rout') {
          ctx.fillStyle = '#ff5040';
          ctx.fillRect(px + 2, py - 5, 6, 1);
        }
        if (s === c.side) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '8px monospace';
          ctx.fillText(String(i + 1), px + 9, py - 3);
          if (this.sel === b.id || (this.sel === 'all' && (c.rank === 'marshal' || b.player === p))) {
            ctx.strokeStyle = 'rgba(160,216,255,0.9)';
            ctx.strokeRect(px - 5, py - 11, 16, 16);
          }
        }
      });
    }
    // The engines.
    for (const e of L.engines || []) {
      if (e.broken) continue;
      const [px, py] = at(e.x, e.z);
      ctx.fillStyle = '#8a5a30';
      ctx.fillRect(px - 1, py - 1, k + 2, k + 2);
    }
    // You (and the others playing).
    for (const q of this.game.everyone ? this.game.everyone() : [p]) {
      const [px, py] = at(q.x, q.z);
      ctx.fillStyle = q === p ? '#ffffff' : '#c8e8ff';
      ctx.fillRect(px - 1, py - 1, k + 1, k + 1);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(px - 1.5, py - 1.5, k + 2, k + 2);
    }
    // Where you've clicked.
    if (this.point) {
      const [px, py] = at(this.point.x, this.point.z);
      ctx.strokeStyle = Math.floor(this.t * 4) % 2 ? '#a0d8ff' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(px - 3, py - 3);
      ctx.lineTo(px + 6, py + 6);
      ctx.moveTo(px + 6, py - 3);
      ctx.lineTo(px - 3, py + 6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#8a6a3a';
    ctx.strokeRect(X - 0.5, Y - 0.5, PW + 1, PH + 1);
  }

  // The land under the field: what's on top of each tile, its colour.
  paintGround(x0, z0, tw, th) {
    if (typeof document === 'undefined') return null;
    const w = this.game.world;
    const cv = document.createElement('canvas');
    cv.width = tw;
    cv.height = th;
    const c2 = cv.getContext('2d');
    const img = c2.createImageData(tw, th);
    const d = img.data;
    for (let j = 0; j < th; j++) {
      for (let i = 0; i < tw; i++) {
        const x = x0 + i;
        const z = z0 + j;
        let col = [30, 34, 24];
        if (w.regionAt(x, z)) {
          const top = w.topAt(x, z);
          const id = top > 0 ? w.getBlock(x, top - 1, z) : 0;
          if (id) {
            const L0 = lookOf(id, top > 8, false);
            const f = Math.max(0.55, Math.min(1.25, 0.8 + (top - 6) * 0.07));
            col = [L0.c[0] * f, L0.c[1] * f, L0.c[2] * f];
          }
        }
        const o = (j * tw + i) * 4;
        d[o] = col[0] * 0.8;
        d[o + 1] = col[1] * 0.8;
        d[o + 2] = col[2] * 0.8;
        d[o + 3] = 255;
      }
    }
    c2.putImageData(img, 0, 0);
    return cv;
  }

  // ------------------------------------------------------------ a siege
  siegeRole(w) {
    const war = this.war;
    const S = w.siege;
    const civ = war.playerCiv();
    if (!civ) return null;
    const sd = war.sideOf(w, civ);
    if (!sd) return null;
    const side = sd === S.atk ? 'atk' : 'def';
    // (The ruler of either side; the head of the town besieged.)
    const sim = war.sim;
    if (sim.crown && sim.crown.isRuler(civ)) return side;
    const T = sim.office && sim.office.heldBy(sim.office.pid());
    if (T && T.sid === S.sid) return 'def';
    if (war.ranks && war.ranks[civ.id] && war.ranks[civ.id][pkOf(this.me)] === 'marshal') return side;
    return null;
  }

  drawSiege(g) {
    const war = this.war;
    const civ = war.playerCiv();
    const w = war.warOf(civ);
    const S = w.siege;
    const role = this.siegeRole(w);
    const s = war.ow.settlements[S.sid];
    g.text(2, 1, `THE SIEGE OF ${s.name.toUpperCase()}`, C.hi);
    g.text(2, 2, role === 'atk' ? 'You command the besiegers.' : 'You command the town\'s defence.', '#ffd070');
    let y = 4;
    for (const l of siegeLines(war, w)) for (const q of wrap(l, this.w - 6)) g.text(3, y++, q, C.fg);
    y++;
    const mine = S.cmd[role] === pkOf(this.me);
    g.text(2, y++, mine ? 'Your orders stand: the commander waits on your word.' : 'The commander in the field decides, unless you give the word.', C.dim);
    y++;
    const act = (key, v, label) => {
      const r = siegeOrder(war, w, role, key, v);
      if (r.ok) {
        S.cmd[role] = pkOf(this.me);
        this.tell(label, C.hi);
      } else this.tell(r.why, C.orange);
    };
    let x = 2;
    if (role === 'def') {
      g.text(2, y, 'Rations:', C.dim);
      x = 12;
      for (const v of ['full', 'half', 'quarter']) x = button(this, g, x, y, ` ${RATION_NAMES[v]} `, S.rations === v ? '#ffd070' : C.fg, () => act('rations', v, `On ${RATION_NAMES[v]}.`));
      y += 2;
      x = 2;
      x = button(this, g, x, y, ' Sally out at the engines ', '#ff9070', () => act('sally', true, 'The garrison sallies out!'));
      x = button(this, g, x, y, ' Mend the wall ', C.fg, () => act('mend', true, 'To the breach with timber and rubble!'));
      x = button(this, g, x, y, ' Send for relief ', C.fg, () => act('relief', true, 'Riders slip out by night, for help.'));
      if (S.terms && !S.terms.answer) {
        y += 2;
        g.text(2, y, `Terms offered (${S.terms.kind}):`, C.hi);
        x = 28;
        x = button(this, g, x, y, ' Accept ', '#a0e8a0', () => act('terms', 'accept', 'The gates open.'));
        button(this, g, x, y, ' Refuse ', '#ff9070', () => act('terms', 'refuse', 'Refused.'));
      }
    } else {
      g.text(2, y, 'Storm at dawn:', C.dim);
      x = 17;
      const ways = [];
      if (S.gate && !S.gate.broken && S.engines.rams) ways.push(['gate', 'the gate (ram)']);
      if (S.walls.some((q) => q.down)) ways.push(['breach', 'the breach']);
      if (S.engines.ladders) ways.push(['walls', 'the walls (ladders)']);
      if (S.small) ways.push(['barricade', 'the barricades']);
      for (const [k, lab] of ways) x = button(this, g, x, y, ` ${lab} `, '#ff9070', () => act('assault', [k], `The assault on ${lab} is set for dawn.`), !S.next);
      if (ways.length > 1) button(this, g, x, y, ' all at once ', '#ff7050', () => act('assault', ways.map((q) => q[0]), 'Every point at once, at dawn.'), !S.next);
      y += 2;
      g.text(2, y, 'Build:', C.dim);
      x = 9;
      x = button(this, g, x, y, ' a catapult ', C.fg, () => act('build', 'catapults', 'A catapult, in two days.'), S.tech.catapults);
      x = button(this, g, x, y, ' a ram ', C.fg, () => act('build', 'rams', 'A ram, by tomorrow.'), S.tech.rams && !!S.gate);
      x = button(this, g, x, y, ' ladders ', C.fg, () => act('build', 'ladders', 'Ladders.'));
      button(this, g, x, y, ' dig under the wall ', C.fg, () => act('sap', true, 'The sappers start digging.'), S.tech.siegecraft && !S.sap);
      y += 2;
      x = 2;
      x = button(this, g, x, y, ' Offer generous terms ', '#a0e8a0', () => act('terms', 'generous', 'Envoys to the gate, under a white cloth.'), !S.terms || !!S.terms.answer);
      x = button(this, g, x, y, ' Offer hard terms ', C.fg, () => act('terms', 'harsh', 'Envoys to the gate, with hard terms.'), !S.terms || !!S.terms.answer);
      button(this, g, x, y, ' Lift the siege ', C.dim, () => act('lift', true, 'The siege is lifted.'));
      y += 2;
      g.text(2, y, 'When it falls:', C.dim);
      x = 17;
      for (const [k, lab] of [['spare', ' Spare the town '], ['loot', ' Plunder, no killing '], ['free', ' The town is yours '], ['none', ' As they will ']]) x = button(this, g, x, y, lab, (S.word || 'none') === k ? '#ffd070' : k === 'free' ? '#ff9070' : C.fg, () => act('word', k, 'The word is given.'));
    }
    if (mine) button(this, g, 2, this.h - 3, ' Leave it to the commander in the field ', C.dim, () => {
      S.cmd[role] = null;
      this.tell('The commander in the field decides now.', C.hi);
    });
  }

  // ------------------------------------------------------------ a council
  councilRole(w) {
    const war = this.war;
    const civ = war.playerCiv();
    if (!civ) return null;
    const sd = war.sideOf(w, civ);
    if (!sd) return null;
    const sim = war.sim;
    if (sim.crown && sim.crown.isRuler(civ)) return sd;
    const T = sim.office && sim.office.heldBy(sim.office.pid());
    if (T && (T.sid === w.plan.def || T.sid === w.plan.atk) && war.ow.settlements[T.sid].civ === civ) return sd;
    if (war.ranks && war.ranks[civ.id] && war.ranks[civ.id][pkOf(this.me)] === 'marshal') return sd;
    return null;
  }

  drawCouncil(g) {
    const war = this.war;
    const civ = war.playerCiv();
    const w = war.warOf(civ);
    const plan = w.plan;
    const sd = this.councilRole(w);
    const od = sd === 'a' ? 'b' : 'a';
    const foe = war.civ(w.lead[od]);
    const def = war.ow.settlements[plan.def];
    g.text(2, 1, 'COUNCIL OF WAR', C.hi);
    g.text(18, 1, `${plan.name.replace(/^the /, 'The ')}`.slice(0, 60), C.fg);
    const now = war.sim.abs;
    const hrs = Math.max(0, Math.round((plan.at - now) / 60));
    g.text(2, 2, `${hrs ? `In about ${hrs} hour${hrs > 1 ? 's' : ''}` : 'Within the hour'}, outside ${def ? def.name : '?'}; on ${plan.biome}${plan.river ? ', at a ford' : ''}. ${sd === plan.attacker ? 'You attack.' : 'You defend.'}`.slice(0, this.w - 4), C.dim);
    // The two sides, as near as can be told.
    const est = (side) => {
      const P = war.pool(w, side, plan);
      return { n: P.recs.length + P.extra, guards: P.recs.filter((q) => q.r.job === 'guard').length };
    };
    const ours = est(sd);
    const theirs = est(od);
    const rough = (n) => (plan.scouted ? `${n}` : n < 8 ? 'a handful' : n < 20 ? 'a score or so' : n < 45 ? `some ${Math.round(n / 10) * 10}` : `${Math.round(n / 20) * 20} or more`);
    g.text(2, 4, `Ours: up to ${ours.n} (${ours.guards} of the watch)`, '#a0e8a0');
    g.text(2, 5, `Theirs: ${rough(theirs.n)}${plan.scouted ? ` (${theirs.guards} of the watch)` : ''}`, '#ffa080');
    const ruler = foe ? war.realms.ruler(foe) : null;
    const style = styleOf(ruler);
    g.text(2, 6, `Their ruler is ${style === 'bold' ? 'bold: they like to attack' : style === 'cautious' ? 'cautious: they like good ground' : style === 'cunning' ? 'cunning: expect something clever' : 'steady'}.`, C.dim);
    const theirPlan = plan.scouted && plan[od === 'a' ? 'ta' : 'tb'] ? plan[od === 'a' ? 'ta' : 'tb'] : null;
    g.text(2, 7, theirPlan ? `Your scouts say they mean to fight with ${TACTICS[theirPlan].name}.` : 'What they mean to do, nobody knows. Scouts might find out.', theirPlan ? C.hi : C.faint);
    // The plans, and how each would answer theirs.
    const mineK = sd === 'a' ? 'ta' : 'tb';
    let y = 9;
    g.text(2, y++, 'Your plan:', C.hi);
    for (const t of PLAN_IDS) {
      const sel = plan[mineK] === t;
      const vs = theirPlan ? war.matchOf(t, theirPlan) : null;
      const ground = war.terrainMult(t, plan, sd !== plan.attacker);
      const hint = [vs ? (vs >= 1.15 ? 'strong against theirs' : vs <= 0.85 ? 'weak against theirs' : 'even against theirs') : '', ground > 1.05 ? 'the ground favours it' : ground < 0.97 ? 'poor ground for it' : ''].filter(Boolean).join('; ');
      button(this, g, 3, y, ` ${TACTICS[t].name} `.padEnd(26), sel ? '#ffd070' : C.fg, () => {
        plan[mineK] = t;
        plan.cmd ||= {};
        plan.cmd[sd] = { pk: pkOf(this.me) };
        this.tell(`So be it: ${TACTICS[t].name}.`, C.hi);
      });
      if (hint) g.text(30, y, hint, vs && vs >= 1.15 ? '#a0e8a0' : vs && vs <= 0.85 ? '#ffa080' : C.dim);
      y++;
    }
    y++;
    let x = 2;
    x = button(this, g, x, y, ' Send scouts ', C.fg, () => this.scout(w, sd), !plan.scouted && !plan.scoutsOut);
    if (plan[mineK]) x = button(this, g, x, y, ' Leave it to the marshal ', C.dim, () => {
      plan[mineK] = null;
      this.tell('The marshal will choose on the day.', C.hi);
    });
    // Behind walls: don't go out at all.
    const DL = def && war.game.world.layouts.get(def.id);
    if (sd !== plan.attacker && DL && DL.walled) button(this, g, x, y, plan.shut ? ' Go out and fight ' : ' Shut the gates and stand a siege ', plan.shut ? C.fg : '#ffd070', () => {
      plan.shut = !plan.shut;
      this.tell(plan.shut ? 'The gates will be shut: let them come to the walls.' : 'We go out to meet them.', C.hi);
    });
  }

  // Scouts out to the enemy: they find out how they mean to fight (and,
  // now and then, are caught, and tell them how you do).
  scout(w, sd) {
    const war = this.war;
    const plan = w.plan;
    const od = sd === 'a' ? 'b' : 'a';
    const rng = { next: Math.random, chance: (p) => Math.random() < p, float: (a, b) => a + Math.random() * (b - a), int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick: (l) => l[Math.floor(Math.random() * l.length)] };
    plan.scoutsOut = true;
    const theirK = od === 'a' ? 'ta' : 'tb';
    if (!plan[theirK]) {
      const PA = war.pool(w, 'a', plan);
      const PB = war.pool(w, 'b', plan);
      const qa = war.armyPower(PA, 'a', w, plan);
      const qb = war.armyPower(PB, 'b', w, plan);
      plan[theirK] = war.chooseTactic(w, od, od === 'a' ? qa : qb, od === 'a' ? qb : qa, plan, rng);
    }
    plan.scouted = true;
    if (Math.random() < 0.25) {
      // (Caught: and they'll know yours, and answer it.)
      const mineK = sd === 'a' ? 'ta' : 'tb';
      if (plan[mineK]) plan[theirK] = PLAN_IDS.filter((t) => t !== 'retreat').sort((p, q) => war.matchOf(q, plan[mineK]) - war.matchOf(p, plan[mineK]))[0];
      plan.scoutsCaught = true;
      this.tell('Your scouts came back with what they saw; but one was caught, and talked.', C.orange);
    } else this.tell('Your scouts are back, with word of the enemy.', C.hi);
  }

  // ------------------------------------------------------------ the war
  drawWar(g) {
    const war = this.war;
    const civ = war.playerCiv();
    let y = 2;
    if (!civ) {
      for (const l of wrap('You\'re no citizen of any realm: no realm\'s wars are yours to fight or to command. (Become a citizen of a town, and its realm\'s wars are yours too.)', this.w - 6)) g.text(3, y++, l, C.dim);
      return;
    }
    const w = war.warOf(civ);
    if (!w) {
      g.text(3, y++, `The ${plain(civ)} is at peace.`, C.fg);
      return;
    }
    for (const l of war.summary(civ)) for (const q of wrap(l, this.w - 6)) g.text(3, y++, q, C.fg);
    y++;
    if (w.plan) {
      const hrs = Math.max(0, Math.round((w.plan.at - war.sim.abs) / 60));
      g.text(3, y++, `${w.plan.name.replace(/^the /, 'The ')}: ${hrs ? `in about ${hrs} hours` : 'within the hour'}. (It's marked on your map.)`.slice(0, this.w - 6), C.hi);
    }
    if (w.siege) for (const l of siegeLines(war, w)) for (const q of wrap(l, this.w - 6)) g.text(3, y++, q, C.fg);
    y++;
    for (const l of wrap('In a battle, those who command (the realm\'s ruler, the head of the town fought over, a captain) give their orders from this table as it goes. Anyone can take up a fallen banner, and lead its band.', this.w - 6)) g.text(3, y++, l, C.dim);
    void DAY;
  }

  // ------------------------------------------------------------ input
  onKey(k) {
    if (k.code === 'Escape' || k.code === 'KeyB') {
      this.close();
      return true;
    }
    if (this.mode() !== 'field') return true;
    const war = this.war;
    const c = commandOf(war, this.me);
    if (!c || c.rank === 'soldier') return true;
    const m = /^Digit(\d)$/.exec(k.code);
    if (m) {
      const i = +m[1];
      if (i === 0) this.sel = 'all';
      else {
        const b = c.S.bands[i - 1];
        if (b && (c.rank === 'marshal' || b.player === this.me)) this.sel = b.id;
      }
      return true;
    }
    const o = ORDER_KEYS.find((q) => `Key${q[1]}` === k.code);
    if (o) {
      this.order(o[0]);
      return true;
    }
    return true;
  }

  onClick(ck, cx, cy, game) {
    // A click on the field: a band of yours picked; elsewhere, a point.
    const v = this.view;
    if (this.mapOn && v && cx >= MX && cy >= MY && cx < MX + MW && cy < MY + MH) {
      const mouse = this.ui.mouse;
      const x = v.x0 + Math.floor((mouse.x - v.X) / v.k);
      const z = v.z0 + Math.floor((mouse.y - v.Y) / v.k);
      const c = commandOf(this.war, this.me);
      if (c && c.rank !== 'soldier') {
        const near = c.S.bands.filter((b) => bandUp(b) && (c.rank === 'marshal' || b.player === this.me)).sort((p, q) => cheb(p.cen || p.anchor, { x, z }) - cheb(q.cen || q.anchor, { x, z }))[0];
        // (Right button: straight there, an advance.)
        if (ck && ck.button === 2 && this.sel) {
          this.point = { x, z, t: this.t };
          this.order('advance');
          return true;
        }
        if (near && cheb(near.cen || near.anchor, { x, z }) <= 2) this.sel = near.id;
        else this.point = { x, z, t: this.t };
      }
      return true;
    }
    return super.onClick(ck, cx, cy, game);
  }
}

export { standing };
