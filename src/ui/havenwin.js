// (Round 130) A pirates' haven, painted (see sim/havens.js): the card that
// comes down over the top of the screen when you first come upon one (the
// haven seen from the hill above it at the hour it is: its stilt shacks
// along the shore, their windows lit after dark, the jetty, smoke from the
// rum house, the guild's black flag snapping on its mast, the brethren's
// ships riding at anchor off it, gulls wheeling), painted the way the
// openings are (see festpaint.js), with its name across the foot on a
// strip of torn parchment.
import { Window } from './window.js';
import { COLS, ROWS } from '../config.js';
import { Bmp, rgb, ramp, mixC, hash2, hills as paintHills, palm, pine } from '../render/brush.js';
import { makeBuf, paintSky, rect, dot, line, text, parchment, rand, darken, panel, meter, sprite, disc, wrap, Sparks, Pops, mixH, UW, UH } from './festpaint.js';
import { GUILD_COLORS, GUILD_NAMES } from '../world/havenkit.js';

const CW = 256;
const CH = 64;
const HZ = 30; // the sea's horizon
const SHORE = 47; // where the beach meets the water, under the shacks
const LIFE = 7;

// The guild's flag and mark colours, as the world's (see havenart.js).
const MARKS = ['#f0f0e8', '#f0f0e8', '#e8e0d0'];

export class HavenCardWindow extends Window {
  // `info`: { name, guild, seed, hour, razed }. (`mirror`: drawn here for
  // the host, who keeps the window: see net/uiwire.js.)
  constructor(ui, info, { mirror = false } = {}) {
    ui.windows = ui.windows.filter((w) => w.kind !== 'havencard' && w.kind !== 'banner');
    super(ui, COLS, 17, { kind: 'havencard', modal: false, x: 0, y: 1 });
    this.info = info;
    this.mirror = mirror;
    // (The host's copy of one shown on someone else's screen.)
    this.passive = !!ui.remoteSeat && !mirror;
    if (this.passive) this.mir = { k: 'havencard', d: info };
    this.t = 0;
    this.r = rand(info.seed || 7);
    this.gulls = Array.from({ length: 5 }, (_, i) => ({ x: this.r() * CW, y: 6 + this.r() * 16, v: 6 + this.r() * 8, ph: this.r() * 6, k: i }));
    this.smoke = [];
  }

  update(dt) {
    this.t += dt;
    if (this.t > LIFE) this.close();
    // (Smoke from the rum house's chimney, a puff at a time.)
    if (this.r() < dt * 3) this.smoke.push({ x: 0, y: 0, a: 0 });
    for (const s of this.smoke) s.a += dt;
    this.smoke = this.smoke.filter((s) => s.a < 3);
  }

  contains(cx, cy) {
    return cy >= this.y && cy < this.y + this.h && this.t > 0.3;
  }

  onClick() {
    this.t = Math.max(this.t, LIFE - 0.6);
    return true;
  }

  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', '#000000', 'rgba(0,0,0,0)');
  }

  // The haven's lasting parts, painted once.
  backdrop() {
    const I = this.info;
    const b = new Bmp(CW, CH);
    const S = paintSky(b, HZ, I.hour ?? 12, false, I.seed || 1);
    this.S = S;
    const air = rgb(S.low);
    // The sea, banded and dithered toward the shore.
    const sea = ramp('#2a5a7a', 4, { spread: 0.34 });
    for (let y = HZ; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const k = (y - HZ) / (CH - HZ);
        const n = hash2(x, y, 3);
        let c = k < 0.15 ? sea[3] : k < 0.5 ? (n < 0.3 ? sea[2] : sea[1]) : n < 0.2 ? sea[1] : sea[0];
        if (k < 0.3) c = mixC(c, air, 0.4 - k);
        b.set(x, y, c);
      }
    }
    // The headland behind the haven, and its palms.
    const land = ramp('#5a7a3a', 4, { spread: 0.3 });
    const crest = (x) => (x < 40 || x > 220 ? CH : SHORE - 12 - Math.sin((x - 40) / 180 * Math.PI) * 9 + Math.sin(x * 0.2) * 1.5);
    paintHills(b, crest, SHORE + 1, land.map((c) => mixC(c, air, 0.15)), { seed: (I.seed || 1) % 97 });
    // The beach: a strip of sand at the water's edge.
    const sand = ramp('#d8c088', 3, { spread: 0.2 });
    for (let x = 34; x < 226; x++) {
      const top = SHORE - (hash2(x, 1, 9) < 0.3 ? 1 : 0);
      for (let y = top; y < SHORE + 3; y++) b.set(x, y, y === SHORE + 2 ? sand[0] : hash2(x, y, 2) < 0.2 ? sand[1] : sand[2]);
    }
    const leaf = ramp('#3a7a3a', 5, { spread: 0.36 });
    const bark = [rgb('#5a3a20'), rgb('#7a5030'), rgb('#3a2414')];
    for (const [x, h] of [[48, 13], [58, 10], [204, 12], [214, 9]]) palm(b, x, SHORE, h, leaf, bark, x * 13);
    for (const x of [120, 132]) pine(b, x, SHORE - 9, 7, ramp('#2a4a2a', 5, { spread: 0.3 }), bark, x, { bare: false });
    // The shacks along the shore, on their stilts, patched and leaning.
    this.windows = [];
    const r = rand((I.seed || 1) + 5);
    const shack = (x0, w, h, roof, hall = false) => {
      const yb = SHORE - 1;
      const stilt = 3;
      for (const sx of [x0, x0 + w - 1]) for (let y = yb - stilt; y <= yb + 2; y++) b.set(sx, y, rgb('#3a2a1a'));
      const wall = ramp(hall ? '#6a4a2c' : r() < 0.5 ? '#8a7458' : '#5e4a34', 3, { spread: 0.25 });
      for (let y = yb - stilt - h; y < yb - stilt; y++) {
        for (let x = x0; x < x0 + w; x++) b.set(x, y, (x - x0) % 3 === 0 ? wall[0] : hash2(x, y, 5) < 0.15 ? wall[2] : wall[1]);
      }
      // Its roof: sailcloth (pale, patched) or reed.
      const rc = ramp(roof, 3, { spread: 0.25 });
      const top = yb - stilt - h;
      for (let k = 0; k < 4; k++) for (let x = x0 - 1 + k; x < x0 + w + 1 - k; x++) b.set(x, top - k, k === 0 ? rc[0] : hash2(x, k, 8) < 0.2 ? rc[2] : rc[1]);
      if (roof === '#d8ccb0') b.set(x0 + 2 + Math.floor(r() * (w - 4)), top - 1, rgb('#a8483a'));
      // A window or two (lit after dark).
      for (let x = x0 + 2; x < x0 + w - 2; x += 4) {
        this.windows.push({ x, y: yb - stilt - h + 2, ph: r() * 6 });
        b.set(x, yb - stilt - h + 2, rgb('#2a1e14'));
        b.set(x + 1, yb - stilt - h + 2, rgb('#2a1e14'));
      }
      // The planks under them, to the water.
      for (let x = x0 - 1; x <= x0 + w; x++) b.set(x, yb - stilt + 1, rgb('#6a5236'));
    };
    shack(70, 12, 6, '#d8ccb0');
    shack(86, 10, 5, '#c8b070');
    shack(100, 20, 8, '#6a4a2c', true);
    this.hall = { x: 110, y: SHORE - 1 - 3 - 8 - 4 };
    shack(124, 9, 5, '#d8ccb0');
    shack(137, 14, 7, '#c8b070');
    this.chimney = { x: 146, y: SHORE - 1 - 3 - 7 - 4 };
    for (let y = this.chimney.y - 3; y <= this.chimney.y; y++) b.set(this.chimney.x, y, rgb('#4a4040'));
    shack(155, 10, 5, '#d8ccb0');
    // The stockade: sharpened stakes.
    for (let x = 170; x < 186; x += 2) for (let y = SHORE - 10; y < SHORE; y++) b.set(x, y, rgb(y === SHORE - 10 ? '#8a7a5a' : '#5a4228'));
    // The gallows, small against the sky at the end of the beach.
    for (let y = SHORE - 11; y < SHORE; y++) b.set(194, y, rgb('#2a1e14'));
    for (let x = 194; x < 199; x++) b.set(x, SHORE - 11, rgb('#2a1e14'));
    for (let y = SHORE - 10; y < SHORE - 6; y++) b.set(198, y, rgb('#b8a070'));
    // The jetty, out into the sea.
    for (let y = SHORE + 2; y < SHORE + 12; y++) {
      for (let x = 112; x < 116; x++) b.set(x, y, rgb(x === 112 ? '#3a2a1a' : '#7a5e3e'));
      if (y % 3 === 0) b.set(111, y, rgb('#2a1e14'));
    }
    darken(b, HZ - 20, S.light);
    if (I.razed) for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (hash2(x, y, 11) < 0.12) b.set(x, y, rgb('#1a1612'), 0.5);
    return b.canvas();
  }

  drawPixels(ctx) {
    if (this.passive || typeof document === 'undefined') return;
    this.bg ||= this.backdrop();
    this.scene ||= makeBuf(CW, CH);
    if (!this.bg || !this.scene) return;
    const g = this.scene.getContext('2d');
    const t = this.t;
    const I = this.info;
    g.drawImage(this.bg, 0, 0);
    const night = this.S && this.S.light < 0.45;
    // Waves: short bright dashes drifting along the bands.
    for (let k = 0; k < 40; k++) {
      const y = HZ + 3 + ((k * 7) % (CH - HZ - 4));
      if (y > SHORE - 2 && y < SHORE + 3) continue;
      const x = Math.round((k * 37 + t * (4 + (y - HZ) * 0.3)) % (CW + 8)) - 4;
      const w = 2 + (k % 3);
      rect(g, x, y, w, 1, night ? 'rgba(160,190,220,0.45)' : 'rgba(220,240,255,0.7)');
    }
    // Surf along the beach.
    for (let x = 34; x < 226; x += 2) if (Math.sin(x * 0.4 + t * 3) > 0.55) dot(g, x, SHORE + 3, '#e8f0f0');
    // The windows, lit after dark (a flicker in each).
    for (const w of this.windows) {
      const lit = night ? 0.7 + Math.sin(t * 5 + w.ph) * 0.2 : 0;
      if (lit > 0) {
        rect(g, w.x, w.y, 2, 1, `rgba(255,190,90,${lit.toFixed(2)})`);
        rect(g, w.x - 1, w.y - 1, 4, 3, `rgba(255,170,70,${(lit * 0.18).toFixed(2)})`);
      }
    }
    // Smoke off the rum house's chimney.
    for (const s of this.smoke) {
      const a = Math.max(0, 0.5 - s.a * 0.17);
      const sx = this.chimney.x + Math.sin(s.a * 2) * 1.5 + s.a * 3;
      const sy = this.chimney.y - 4 - s.a * 5;
      rect(g, sx, sy, 1 + Math.floor(s.a), 1 + Math.floor(s.a * 0.7), `rgba(200,196,190,${a.toFixed(2)})`);
    }
    // The guild's flag on its mast over the hall.
    const F = this.hall;
    line(g, F.x, F.y, F.x, F.y - 12, '#3a2a1a');
    const col = GUILD_COLORS[I.guild] || GUILD_COLORS[0];
    for (let x = 0; x < 8; x++) {
      const dy = Math.round(Math.sin(x * 0.8 - t * 6) * Math.min(1, x / 3));
      for (let y = 0; y < 5; y++) dot(g, F.x + 1 + x, F.y - 12 + y + dy, x === 3 && y === 2 ? MARKS[I.guild] || '#f0f0e8' : col);
    }
    // Their ships at anchor, rocking.
    this.ship(g, 44, HZ + 14, t, 0, col);
    this.ship(g, 180, HZ + 9, t, 1.7, col, 0.75);
    this.ship(g, 232, HZ + 20, t, 3.1, col, 1.1);
    // Gulls.
    for (const q of this.gulls) {
      const x = Math.round((q.x + t * q.v) % (CW + 10)) - 5;
      const y = Math.round(q.y + Math.sin(t * 1.3 + q.ph) * 3);
      const up = Math.sin(t * 9 + q.ph) > 0;
      const c = night ? '#a8a8b8' : '#f8f8f8';
      dot(g, x, y, c);
      dot(g, x - 1, y + (up ? -1 : 0), c);
      dot(g, x + 1, y + (up ? -1 : 0), c);
      dot(g, x - 2, y + (up ? -1 : 1), c);
      dot(g, x + 2, y + (up ? -1 : 1), c);
    }
    // Down from the top, and back up at the end.
    const k = Math.min(1, t / 0.45, Math.max(0, (LIFE - t) / 0.55));
    const ease = 1 - (1 - k) * (1 - k);
    const X = this.x * 6;
    const Y = this.y * 8 - Math.round((1 - ease) * 150);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    rect(ctx, X, Y - 2, CW * 2, CH * 2 + 4, '#0c0a08');
    ctx.drawImage(this.scene, X, Y, CW * 2, CH * 2);
    rect(ctx, X, Y + CH * 2, CW * 2, 2, '#c8a060');
    // The name on its torn strip of parchment, and whose it is.
    const sub = I.razed ? 'A PIRATES\' HAVEN, BURNED OUT' : `A HAVEN OF ${String(GUILD_NAMES[I.guild] || 'the brethren').toUpperCase()}`;
    const pw = Math.max(200, I.name.length * 12 + 40, sub.length * 6 + 24);
    const px = X + CW - pw / 2;
    const py = Y + CH * 2 - 28;
    parchment(ctx, px, py, pw, 26, I.seed || 3);
    for (let i = 0; i < pw; i += 3) if (hash2(i, 0, 4) < 0.5) rect(ctx, px + i, py + 25, 3, 1, '#0c0a08');
    text(ctx, I.name.toUpperCase(), px + pw / 2, py + 3, '#3a1a10', { scale: 2, shadow: null, align: 'center' });
    text(ctx, sub, px + pw / 2, py + 17, '#6a3a20', { shadow: null, align: 'center' });
    ctx.restore();
  }

  // A ship riding at anchor: her hull, two masts, her sails furled or
  // patched, the black flag at the main; she rolls on the swell.
  ship(g, x, y, t, ph, col, s = 1) {
    const roll = Math.sin(t * 1.4 + ph);
    const yy = Math.round(y + roll * 0.8);
    const L = Math.round(18 * s);
    const hull = '#2e2218';
    for (let i = 0; i < L; i++) {
      const sag = i < 2 || i > L - 3 ? 1 : 0;
      rect(g, x + i, yy - 2 + sag, 1, 3 - sag, i % 4 === 0 ? '#4a3626' : hull);
    }
    rect(g, x + 2, yy - 2, L - 4, 1, '#6a4a2c');
    const lean = Math.round(roll * 0.6);
    for (const [mx, mh] of [[Math.round(L * 0.35), Math.round(11 * s)], [Math.round(L * 0.7), Math.round(9 * s)]]) {
      line(g, x + mx, yy - 3, x + mx + lean, yy - 3 - mh, '#3a2a1a');
      // (Her sails half set: pale, a patch on one.)
      for (let j = 2; j < mh - 2; j++) {
        const w = Math.round((mh - j) * 0.35) + 1;
        rect(g, x + mx + lean - w, yy - 3 - j, w * 2, 1, j === Math.round(mh / 2) ? '#b8a888' : '#e0d6c0');
      }
      if (mx > L / 2) {
        for (let k = 0; k < 4; k++) dot(g, x + mx + lean + 1 + k, yy - 3 - mh + (Math.sin(t * 7 + k + ph) > 0 ? 1 : 0), col);
        dot(g, x + mx + lean + 1, yy - 3 - mh + 1, col);
      }
    }
    // Her reflection, broken on the water.
    for (let i = 0; i < L; i += 2) if (Math.sin(i + t * 4 + ph) > 0) dot(g, x + i, yy + 2, 'rgba(20,16,12,0.5)');
  }
}

// ------------------------------------------------------------ the council
// The guild hall, at night: the long table, the captains behind it (each
// as they look in the world, seated), the chief's high chair in the middle,
// the chest on the table with the guild's coin heaped in it, the lantern
// swinging over it all and its light swinging with it, the Articles nailed
// up on the wall, the guild's flag hung behind the chief, the sea through
// the window. When the captains vote, each holds up their cutlass for aye
// or bangs the table for nay, in turn; at a share-out the coin flies from
// the chest to each of them. Below: the business of the council, in tabs.
const HW = 256;
const HH = 100;
const TABLE = 72; // the table's top edge
const TABS = [['council', 'COUNCIL'], ['articles', 'ARTICLES'], ['fleet', 'CAPTAINS'], ['realms', 'REALMS'], ['stockade', 'STOCKADE'], ['orders', 'ORDERS']];
const STANCE = { prey: 'their prey', tribute: 'pays tribute', marque: 'our patron (marque)', hunted: 'hunting us' };
const REL_COL = { war: '#ff7060', rival: '#e0b070', truce: '#c8d890', alliance: '#90e0a0' };
const inRect = (m, b) => b && m.x >= b.x && m.y >= b.y && m.x < b.x + b.w && m.y < b.y + b.h;

export class HavenCouncilWindow extends Window {
  // `data`: { i, hid, view (see Brethren.view), vote?, toast? }. (`mirror`:
  // drawn here for the host, who keeps it: see net/uiwire.js.)
  constructor(ui, data, { mirror = false } = {}) {
    super(ui, COLS, ROWS, { kind: 'havencouncil', x: 0, y: 0 });
    this.data = data;
    this.mirror = mirror;
    this.passive = !!ui.remoteSeat && !mirror;
    if (this.passive) this.mir = { k: 'havencouncil', d: data };
    this.tab = 'council';
    this.t = 0;
    this.refreshT = 0;
    this.btns = [];
    this.sparks = new Sparks();
    this.pops = new Pops();
    this.coins = [];
    this.scroll = 0;
    if (data.vote) this.startVote(data.vote);
  }

  get view() {
    return this.data.view;
  }

  // Whose screen it is: their id with the brethren.
  pid() {
    const seat = this.ui.remoteSeat;
    if (seat) return seat.host ? 'host' : String(seat.id);
    return 'host';
  }

  // Newer word from the host (a guest's screen).
  remirror(d) {
    const was = this.data;
    this.data = d;
    if (d.vote && (!was.vote || was.vote.n !== d.vote.n)) this.startVote(d.vote);
    if (d.toast && (!was.toast || was.toast.n !== d.toast.n)) this.say(d.toast.text);
    if (d.share && (!was.share || was.share !== d.share)) this.shareAnim();
  }

  startVote(v) {
    this.vote = { votes: v.votes || [], carried: v.carried, t: 0, n: v.n };
  }

  say(textLine) {
    this.toast = { text: textLine, t: 4 };
  }

  shareAnim() {
    const caps = (this.view && this.view.captains) || [];
    caps.forEach((c, i) => {
      for (let k = 0; k < 5; k++) this.coins.push({ i, k, t: -k * 0.12 - i * 0.05 });
    });
  }

  // Something asked of the council: from here (the host, or a game played
  // alone), or sent to the host from a guest's screen.
  act(msg) {
    if (this.mirror) {
      (this.ui.forward ||= []).push({ code: 'HavenAct', key: JSON.stringify(msg) });
      return;
    }
    const game = this.ui.game;
    const r = game && game.havenAct ? game.havenAct(this.pid(), this.data.i, msg) : null;
    this.after(msg, r);
  }

  // How it went (here, or at the host for a guest's screen to show).
  after(msg, r) {
    if (!r) return;
    const n = (this.data.toast ? this.data.toast.n : 0) + 1;
    if (r.vote) {
      this.data.vote = { ...r.vote, n };
      this.startVote(this.data.vote);
    }
    if (r.text) {
      this.data.toast = { text: r.text, n };
      this.say(r.text);
    }
    if (msg.a === 'decide' && msg.kind === 'share') {
      this.data.share = n;
      this.shareAnim();
    }
    this.refresh(true);
  }

  refresh(now = false) {
    if (this.mirror) return;
    this.refreshT -= now ? 99 : 0;
    const game = this.ui.game;
    if (!game || !game.sim || !game.sim.brethren) return;
    this.data.view = game.sim.brethren.view(this.data.i, this.pid());
    if (this.passive) this.mir = { k: 'havencouncil', d: this.data };
  }

  update(dt) {
    this.t += dt;
    this.refreshT -= dt;
    if (this.refreshT <= 0) {
      this.refreshT = 0.5;
      this.refresh();
    }
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
    if (this.vote) this.vote.t += dt;
    for (const c of this.coins) c.t += dt;
    this.coins = this.coins.filter((c) => c.t < 1.4);
    this.sparks.update?.(dt);
    this.pops.update?.(dt);
  }

  close() {
    if (this.mirror) {
      (this.ui.forward ||= []).push({ code: 'HavenAct', key: JSON.stringify({ a: 'close' }) });
      (this.ui.putDown ||= new Set()).add(this.mirrorOf);
    }
    super.close();
  }

  onKey(k) {
    if (this.passive) {
      if (k.code === 'HavenAct') {
        let m = null;
        try {
          m = JSON.parse(k.key);
        } catch {
          return true;
        }
        if (m && m.a === 'close') super.close();
        else if (m) this.act(m);
        return true;
      }
      if (k.code === 'Escape') super.close();
      return true;
    }
    if (k.code === 'Escape' || k.code === 'KeyH') {
      this.close();
      return true;
    }
    const n = TABS.findIndex(([t]) => t === this.tab);
    if (k.code === 'Tab' || k.code === 'ArrowRight') this.tab = TABS[(n + 1) % TABS.length][0];
    if (k.code === 'ArrowLeft') this.tab = TABS[(n + TABS.length - 1) % TABS.length][0];
    return true;
  }

  onClick(ck) {
    if (this.passive) return true;
    if (ck && ck.button === 2) {
      this.close();
      return true;
    }
    const m = this.mouse();
    for (const b of this.btns) {
      if (!inRect(m, b)) continue;
      this.ui.audio?.play('select');
      b.fn();
      return true;
    }
    return true;
  }

  onWheel(d) {
    this.scroll = Math.max(0, this.scroll + (d > 0 ? 1 : -1));
  }

  mouse() {
    const m = this.ui.mouse || { x: 0, y: 0 };
    return { x: m.x, y: m.y };
  }

  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', '#000000', '#000000');
  }

  // ------------------------------------------------------------ painting
  // The hall's lasting parts (once).
  backdrop() {
    const b = new Bmp(HW, HH);
    const V = this.view || {};
    // The back wall: planks of salvage, a ship's timber here and there.
    const wall = ramp('#4a3424', 4, { spread: 0.3 });
    for (let y = 0; y < HH; y++) {
      for (let x = 0; x < HW; x++) {
        const plank = Math.floor(x / 7);
        const seam = x % 7 === 0;
        // (Each plank its own shade; the grain running down it.)
        const base = plank % 3 === 0 ? wall[1] : plank % 3 === 1 ? wall[2] : mixC(wall[1], wall[2], 0.5);
        const grain = (x + Math.floor(Math.sin(y * 0.15 + plank) * 2)) % 7 === 3;
        let c = seam ? wall[0] : grain ? mixC(base, wall[0], 0.35) : base;
        if (!seam && hash2(plank, y >> 2, 9) < 0.015) c = wall[0];
        b.set(x, y, c);
      }
    }
    // The beams and the posts.
    const beam = ramp('#2e2016', 3, { spread: 0.3 });
    for (let x = 0; x < HW; x++) for (let y = 4; y < 9; y++) b.set(x, y, y === 4 ? beam[2] : y === 8 ? beam[0] : beam[1]);
    for (const px of [14, 240]) for (let y = 9; y < HH; y++) for (let x = px; x < px + 5; x++) b.set(x, y, x === px ? beam[2] : beam[1]);
    // The window: the sea at night, the moon over it, a ship far off.
    const wx = 196;
    const wy = 20;
    for (let y = wy; y < wy + 30; y++) {
      for (let x = wx; x < wx + 34; x++) {
        const sea = y > wy + 18;
        const k = (y - wy) / 30;
        b.set(x, y, rgb(sea ? (hash2(x, y, 4) < 0.15 ? '#2a4a6a' : '#16263c') : mixH('#0a0e22', '#2a2a4a', k)));
      }
    }
    for (let i = 0; i < 14; i++) b.set(wx + 2 + ((i * 7) % 30), wy + 2 + ((i * 5) % 14), rgb('#e0e4ff'));
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) b.set(wx + 25 + x, wy + 7 + y, rgb(x * x + y * y <= 4 ? '#fff8e0' : '#d8d4c0'));
    for (let x = wx + 4; x < wx + 12; x++) b.set(x, wy + 18, rgb('#0a0a10'));
    b.set(wx + 7, wy + 15, rgb('#0a0a10'));
    b.set(wx + 7, wy + 16, rgb('#0a0a10'));
    b.set(wx + 7, wy + 17, rgb('#0a0a10'));
    for (let x = wx - 1; x <= wx + 34; x++) {
      b.set(x, wy - 1, beam[0]);
      b.set(x, wy + 30, beam[0]);
      b.set(x, wy + 15, beam[1]);
    }
    for (let y = wy - 1; y <= wy + 30; y++) {
      b.set(wx - 1, y, beam[0]);
      b.set(wx + 34, y, beam[0]);
      b.set(wx + 17, y, beam[1]);
    }
    // The Articles, nailed up: a parchment of close writing, a dagger
    // through its foot.
    const par = ramp('#e0cc9a', 3, { spread: 0.25 });
    for (let y = 16; y < 54; y++) for (let x = 28; x < 60; x++) b.set(x, y, (x === 28 || x === 59 || y === 16 || y === 53) ? par[0] : hash2(x, y, 6) < 0.1 ? par[1] : par[2]);
    for (let r = 0; r < 12; r++) for (let x = 31; x < 31 + 14 + ((r * 7) % 12); x++) if (hash2(x, r, 3) < 0.8) b.set(x, 20 + r * 3, rgb('#5a4630'));
    for (let x = 34; x < 54; x++) b.set(x, 18, rgb('#3a2a1a'));
    for (let y = 48; y < 58; y++) b.set(44, y, rgb('#c8c8d0'));
    for (let x = 42; x < 47; x++) b.set(x, 47, rgb('#6a4a2c'));
    // Shelves of bottles; a keg; a ship's wheel hung up as trophy.
    for (let x = 70; x < 100; x++) b.set(x, 40, beam[2]);
    for (let i = 0; i < 7; i++) {
      const bx = 72 + i * 4;
      const c = ['#3a5a2a', '#5a2a1a', '#2a3a5a', '#6a5a2a'][i % 4];
      for (let y = 33; y < 40; y++) b.set(bx, y, rgb(c));
      b.set(bx, 32, rgb('#c8a060'));
      b.set(bx + 1, 35, rgb(mixH(c, '#ffffff', 0.4)));
    }
    for (let a = 0; a < 16; a++) {
      const th = (a / 16) * Math.PI * 2;
      for (let r = 2; r < 9; r++) if (r === 8 || a % 2 === 0) b.set(Math.round(168 + Math.cos(th) * r), Math.round(32 + Math.sin(th) * r), rgb(r === 8 ? '#5a3a20' : '#7a5230'));
    }
    // The floor.
    const fl = ramp('#3a2a1c', 3, { spread: 0.3 });
    for (let y = 88; y < HH; y++) for (let x = 0; x < HW; x++) b.set(x, y, (x + y * 3) % 11 === 0 ? fl[0] : hash2(x, y, 7) < 0.2 ? fl[2] : fl[1]);
    void V;
    return b.canvas();
  }

  // The table and what's on it (drawn over the captains' laps).
  table(g, t, V) {
    const top = '#7a5634';
    rect(g, 22, TABLE, 212, 3, top);
    rect(g, 22, TABLE, 212, 1, '#9a7448');
    rect(g, 22, TABLE + 3, 212, 10, '#4a321e');
    for (let x = 30; x < 230; x += 22) rect(g, x, TABLE + 3, 1, 10, '#3a2614');
    rect(g, 26, TABLE + 13, 4, 6, '#3a2614');
    rect(g, 226, TABLE + 13, 4, 6, '#3a2614');
    // Tankards and a candle.
    for (const x of [36, 64, 112, 150, 186]) {
      rect(g, x, TABLE - 4, 3, 4, '#8a6a4a');
      dot(g, x, TABLE - 5, '#f0e8d0');
    }
    const fl = Math.sin(t * 13) > 0 ? 1 : 0;
    rect(g, 92, TABLE - 5, 2, 5, '#e8e0c8');
    dot(g, 92 + fl, TABLE - 7, '#ffd070');
    dot(g, 92, TABLE - 6, '#ff9040');
    // The chest, its lid up, the guild's coin heaped in it (before the
    // chief, a little to one side).
    const cx = 210;
    rect(g, cx - 10, TABLE - 8, 20, 8, '#5a3a20');
    rect(g, cx - 10, TABLE - 8, 20, 1, '#7a5230');
    rect(g, cx - 10, TABLE - 14, 20, 5, '#4a2e18');
    rect(g, cx - 10, TABLE - 14, 20, 1, '#6a4428');
    rect(g, cx - 1, TABLE - 6, 2, 3, '#c8a040');
    const heap = Math.min(7, Math.floor((V.treasury || 0) / 60));
    for (let k = 0; k < heap; k++) {
      const w = 16 - k * 2;
      rect(g, cx - w / 2, TABLE - 9 - k, w, 1, k % 2 ? '#e0b830' : '#f0d050');
    }
    if (heap && Math.sin(t * 2.3) > 0.92) {
      dot(g, cx - 3 + (Math.floor(t * 3) % 6), TABLE - 10 - heap, '#ffffff');
    }
  }

  // The captains behind the table, seated: the chief in the middle in the
  // high chair. Their places, for the nameplates.
  captains(g, t, V) {
    const caps = V.captains || [];
    const n = caps.length;
    const order = [...caps].sort((a, b) => (b.chief ? 1 : 0) - (a.chief ? 1 : 0));
    // (The chief at the middle, the rest out to either side.)
    const slots = [];
    const mid = 128;
    order.forEach((c, k) => {
      const side = k === 0 ? 0 : k % 2 ? -1 : 1;
      const step = Math.ceil(k / 2);
      slots.push({ c, x: mid + side * step * Math.min(28, 190 / Math.max(2, n)) });
    });
    // The chief's chair: a tall back of red velvet, studded.
    const ch = slots.find((q) => q.c.chief);
    if (ch) {
      rect(g, ch.x - 9, TABLE - 34, 18, 34, '#5a1414');
      rect(g, ch.x - 9, TABLE - 34, 18, 2, '#c8a040');
      rect(g, ch.x - 7, TABLE - 31, 14, 28, '#7a1e1e');
      for (let y = TABLE - 30; y < TABLE - 4; y += 4) {
        dot(g, ch.x - 8, y, '#c8a040');
        dot(g, ch.x + 7, y, '#c8a040');
      }
    }
    for (const q of slots) {
      const look = q.c.look || null;
      const bob = Math.sin(t * 1.7 + q.x) > 0.85 ? 1 : 0;
      if (look) sprite(g, look, q.x, TABLE + 3 - bob, 0, 4);
      else {
        // (A player's own: a dark figure, their look's not ours to keep.)
        rect(g, q.x - 4, TABLE - 16, 8, 16, '#2a2a3a');
        disc(g, q.x, TABLE - 20, 3, '#e0b090');
        rect(g, q.x - 4, TABLE - 24, 8, 2, '#121212');
      }
    }
    this.slots = slots;
    return slots;
  }

  // The vote, in turn: aye (cutlass up) or nay (a fist on the table).
  voteFx(g, t) {
    const v = this.vote;
    if (!v || !this.slots) return;
    v.votes.forEach((q, k) => {
      const at = 0.6 + k * 0.55;
      if (v.t < at) return;
      const slot = this.slots.find((s) => s.c.name === q.name);
      if (!slot) return;
      const age = v.t - at;
      if (q.aye) {
        const up = Math.min(1, age * 4);
        const hx = slot.x + 5;
        const hy = TABLE - 18;
        line(g, hx, hy, hx + 2, hy - Math.round(12 * up), '#d8dce4');
        rect(g, hx - 1, hy, 3, 1, '#c8a040');
        if (age < 0.25) this.sparks.burst?.(hx + 2, hy - 12, 4, ['#ffffff', '#d8dce4']);
      } else {
        const bang = age < 0.3 ? Math.round(Math.sin(age * 30) * 2) : 0;
        rect(g, slot.x - 2, TABLE - 3 + bang, 4, 3, '#e0b090');
      }
    });
    const done = v.t > 0.6 + v.votes.length * 0.55 + 0.4;
    if (done && !v.shown) {
      v.shown = true;
      this.say(v.carried ? 'CARRIED!' : 'VOTED DOWN.');
    }
  }

  drawPixels(ctx) {
    if (this.passive || typeof document === 'undefined') return;
    const V = this.view;
    if (!V) return;
    this.bg ||= this.backdrop();
    this.scene ||= makeBuf(HW, HH);
    if (!this.bg || !this.scene) return;
    const g = this.scene.getContext('2d');
    const t = this.t;
    g.drawImage(this.bg, 0, 0);
    // The guild's flag hung behind the chair, stirring in the draught.
    const fx = 112;
    const fy = 12;
    for (let x = 0; x < 32; x++) {
      const dy = Math.round(Math.sin(x * 0.4 - t * 2) * 0.8);
      for (let y = 0; y < 18 + (x % 5 === 0 ? 1 : 0); y++) dot(g, fx + x, fy + y + dy, mixH(V.flag || '#121212', '#000000', Math.sin(x * 0.4 - t * 2 + 1) > 0.4 ? 0 : 0.25));
    }
    rect(g, fx - 2, fy - 1, 36, 1, '#3a2a1a');
    for (const [x, y] of [[14, 4], [15, 4], [16, 4], [13, 5], [14, 5], [15, 5], [16, 5], [17, 5], [13, 6], [15, 6], [17, 6], [14, 7], [16, 7]]) dot(g, fx + x, fy + y, '#e8e4d8');
    this.captains(g, t, V);
    this.table(g, t, V);
    this.voteFx(g, t);
    // The lantern swinging on its chain, its light swinging with it.
    const th = Math.sin(t * 1.3) * 0.28;
    const lx = 128 + Math.sin(th) * 20;
    const ly = 8 + Math.cos(th) * 20;
    line(g, 128, 8, lx, ly, '#5a5a62');
    rect(g, lx - 3, ly, 6, 7, '#3a3a40');
    rect(g, lx - 2, ly + 1, 4, 5, Math.sin(t * 9) > 0 ? '#ffd070' : '#ffc050');
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let r = 40; r > 0; r -= 8) {
      g.fillStyle = `rgba(255,170,70,${(0.035 * (1 - r / 44)).toFixed(3)})`;
      g.beginPath();
      g.ellipse(lx, TABLE - 6, r * 1.6, r * 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // The coin flying out to them at a share-out.
    for (const c of this.coins) {
      if (c.t < 0 || !this.slots || !this.slots[c.i]) continue;
      const k = Math.min(1, c.t / 0.9);
      const sx = 210;
      const sy = TABLE - 12;
      const ex = this.slots[c.i].x;
      const ey = TABLE - 4;
      dot(g, sx + (ex - sx) * k, sy + (ey - sy) * k - Math.sin(k * Math.PI) * 18, k < 1 ? '#f0d050' : '#c8a040');
    }
    this.sparks.draw?.(g);
    // On screen: the hall doubled, the business below.
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    rect(ctx, 0, 0, UW, UH, '#0a0806');
    ctx.drawImage(this.scene, 0, 0, HW * 2, HH * 2);
    // The header: whose hall, their chief, the chest, the mood.
    text(ctx, String(V.name).toUpperCase(), 10, 8, '#ffe070', { scale: 2 });
    text(ctx, V.chief ? `CHIEF: ${String(V.chief).toUpperCase()}${V.chiefYou ? ' (YOU)' : ''}` : 'NO CHIEF', 10, 28, V.chiefYou ? '#90e0ff' : '#e8d0a0');
    if (V.king) text(ctx, `PIRATE KING: ${String(V.king).toUpperCase()}`, 10, 38, '#ffd040');
    text(ctx, `¤${V.treasury} IN THE CHEST`, UW - 10, 8, '#f0d050', { align: 'right' });
    meter(ctx, UW - 110, 30, 100, 7, V.mood, V.mood > 0.6 ? '#70c070' : V.mood > 0.35 ? '#d0b040' : '#d05040', 'THE BRETHREN');
    // Nameplates under the captains.
    for (const q of this.slots || []) {
      const nm = String(q.c.name).split(' ').slice(-1)[0].toUpperCase().slice(0, 9);
      text(ctx, nm, q.x * 2, (TABLE + 14) * 2, q.c.you ? '#90e0ff' : q.c.chief ? '#ffe070' : '#e8d8b8', { align: 'center' });
      if (q.c.state === 'sea') text(ctx, 'AT SEA', q.x * 2, (TABLE + 14) * 2 + 9, '#8ab0d0', { align: 'center' });
    }
    this.paintBusiness(ctx, V);
    if (this.toast) {
      const lines = wrap(this.toast.text, 70).slice(0, 3);
      const w = Math.min(UW - 40, Math.max(...lines.map((l) => l.length)) * 6 + 20);
      panel(ctx, (UW - w) / 2, 56, w, 12 + lines.length * 10);
      lines.forEach((l, i) => text(ctx, l, UW / 2, 62 + i * 10, '#fff0c0', { align: 'center' }));
    }
    ctx.restore();
  }

  // The council's business, under the hall: a tab at a time.
  paintBusiness(ctx, V) {
    const y0 = HH * 2;
    panel(ctx, 2, y0, UW - 4, UH - y0 - 2, { fill: 'rgba(16,12,10,0.97)' });
    this.btns = [];
    const m = this.mouse();
    const btn = (x, y, w, label, fn, on = true) => {
      const b = { x, y, w, h: 11, fn };
      const hov = on && inRect(m, b);
      rect(ctx, x, y, w, 11, !on ? 'rgba(40,36,30,0.9)' : hov ? '#5a4628' : '#2e2418');
      rect(ctx, x, y, w, 1, on ? '#c8a060' : '#4a4030');
      text(ctx, label, x + w / 2, y + 2, !on ? '#6a6050' : hov ? '#fff0c0' : '#e8d0a0', { align: 'center' });
      if (on) this.btns.push(b);
    };
    TABS.forEach(([k, label], i) => {
      const x = 8 + i * 82;
      const sel = this.tab === k;
      const b = { x, y: y0 + 4, w: 78, h: 11, fn: () => (this.tab = k) };
      const hov = inRect(m, b);
      rect(ctx, x, y0 + 4, 78, 11, sel ? '#6a4a24' : hov ? '#3a2e1e' : '#20180f');
      text(ctx, label, x + 39, y0 + 6, sel ? '#ffe070' : '#c8b890', { align: 'center' });
      this.btns.push(b);
    });
    const yy = y0 + 20;
    const row = (k) => yy + k * 11;
    const me = V.me;
    const chief = !!V.chiefYou;
    if (this.tab === 'council') {
      if (!V.matters.length) text(ctx, 'Nothing before the council. The brethren drink.', 12, row(0), '#a89878');
      V.matters.slice(this.scroll, this.scroll + 6).forEach((q, k) => {
        text(ctx, String(q.text).slice(0, 52), 12, row(k), '#f0e0c0');
        let x = UW - 12;
        for (const [ok, label] of [...q.opts].reverse()) {
          const w = Math.min(96, label.length * 6 + 8);
          x -= w + 4;
          if (chief || me) btn(x, row(k) - 2, w, label.slice(0, 15), () => this.act({ a: 'decide', mid: q.id, k: ok, kind: q.kind }), true);
        }
        if (q.voted) text(ctx, `(you: ${q.voted})`, 12, row(k) + 8, '#8ab0d0');
      });
      if (V.past.length) text(ctx, `LAST: ${String(V.past[V.past.length - 1].outcome || '').slice(0, 76)}`, 12, UH - 14, '#a89878');
    } else if (this.tab === 'articles') {
      const ART = [['shares', 'Shares', [['equal', 'Equal'], ['captain', 'Double'], ['chief', 'Chief 3']]], ['quarter', 'Quarter', [['give', 'Give'], ['none', 'None']]], ['fishers', 'Fishers', [['spare', 'Spare'], ['take', 'Take all']]], ['thieves', 'Thieves', [['maroon', 'Maroon'], ['flog', 'Flog'], ['plank', 'Plank']]]];
      ART.forEach(([k, label, opts], i) => {
        text(ctx, `${i + 1}. ${label.toUpperCase()}`, 12, row(i) + 1, '#ffe070');
        opts.forEach(([v, l], j) => {
          const cur = V.articles[k] === v;
          const x = 120 + j * 86;
          if (cur) {
            rect(ctx, x, row(i) - 1, 82, 11, '#6a4a24');
            text(ctx, l.toUpperCase(), x + 41, row(i) + 1, '#ffe070', { align: 'center' });
          } else btn(x, row(i) - 1, 82, `AMEND: ${l}`.slice(0, 13), () => this.act({ a: 'chief', act: 'article', arg: `${k}:${v}` }), chief);
        });
      });
      text(ctx, chief ? 'An amendment goes to the captains\' vote.' : 'Only the chief can put an amendment to the vote.', 12, row(4) + 2, '#a89878');
    } else if (this.tab === 'fleet') {
      V.captains.slice(this.scroll, this.scroll + 5).forEach((c, k) => {
        const col = c.you ? '#90e0ff' : c.chief ? '#ffe070' : '#f0e0c0';
        text(ctx, `${c.name}`.slice(0, 20), 12, row(k), col);
        text(ctx, `${c.ship}`.slice(0, 20), 140, row(k), '#c8b890');
        text(ctx, c.state === 'sea' ? 'at sea' : c.state === 'careen' ? 'careening' : c.state === 'player' ? 'yours' : 'ashore', 268, row(k), '#8ab0d0');
        text(ctx, `${c.prizes} prizes  ${c.scars} scars`, 336, row(k), '#a89878');
        meter(ctx, 448, row(k) + 1, 50, 5, c.loyalty, '#7090c0');
      });
      V.rel.forEach((r, k) => {
        const x = 12 + k * 250;
        text(ctx, `${r.name}: `, x, UH - 26, '#e8d0a0');
        text(ctx, r.rel.toUpperCase(), x + (r.name.length + 2) * 6, UH - 26, REL_COL[r.rel] || '#e8d0a0');
        if (chief) {
          ['war', 'truce', 'alliance'].filter((q) => q !== r.rel).forEach((q, j) => btn(x + j * 60, UH - 15, 56, q.toUpperCase(), () => this.act({ a: 'chief', act: 'relation', arg: `${r.j}:${q}` })));
        }
      });
    } else if (this.tab === 'realms') {
      if (!V.realms.length) text(ctx, 'No realm has reckoned with us yet.', 12, row(0), '#a89878');
      V.realms.slice(this.scroll, this.scroll + 6).forEach((r, k) => {
        text(ctx, `The ${r.name}`.slice(0, 28), 12, row(k), '#f0e0c0');
        text(ctx, STANCE[r.stance] || r.stance, 190, row(k), r.stance === 'hunted' ? '#ff7060' : r.stance === 'tribute' ? '#90e0a0' : '#c8b890');
        meter(ctx, 330, row(k) + 1, 60, 5, Math.min(1, r.pressure / 6), '#c05040');
        if (chief && r.stance !== 'tribute') btn(UW - 110, row(k) - 2, 96, 'RAID SHIPPING', () => this.act({ a: 'chief', act: 'raid_ship', arg: String(r.civ) }));
      });
    } else if (this.tab === 'stockade') {
      if (!V.held.length) text(ctx, 'The stockade is empty.', 12, row(0), '#a89878');
      V.held.slice(this.scroll, this.scroll + 6).forEach((q, k) => {
        text(ctx, `${q.name}, of ${q.from}`.slice(0, 34), 12, row(k), '#f0e0c0');
        text(ctx, `${q.days}d  ransom ¤${q.ransom}`, 220, row(k), '#c8b890');
        if (chief) {
          btn(UW - 200, row(k) - 2, 90, 'LET GO', () => this.act({ a: 'chief', act: 'release', arg: String(q.id) }));
          btn(UW - 104, row(k) - 2, 90, 'PRESS INTO CREW', () => this.act({ a: 'chief', act: 'press', arg: String(q.id) }));
        }
      });
    } else if (this.tab === 'orders') {
      if (!chief) {
        const lines = me ? [`You: ${me.rank.toUpperCase()}, merit ${me.merit}${me.owed ? `, ¤${me.owed} owed you` : ''}.`, me.rank === 'hand' ? `A captain's commission at ${V.captainAt} merit, with a ship of your own.` : me.rank === 'captain' ? `Stand for chief at ${V.chiefAt} merit: the captains' vote, or a challenge.` : '', 'Only the chief gives orders here.'] : ['You\'re not of this brotherhood.'];
        lines.filter(Boolean).forEach((l, k) => text(ctx, l, 12, row(k), k ? '#a89878' : '#f0e0c0'));
        if (me && me.rank === 'captain') btn(12, row(3), 170, 'CALL THE CAPTAINS TO VOTE', () => this.act({ a: 'vote' }), me.merit >= V.chiefAt);
      } else {
        btn(12, row(0), 150, 'CAREEN THE FLEET', () => this.act({ a: 'chief', act: 'careen' }));
        btn(170, row(0), 160, 'FOUND A HAVEN (¤200)', () => this.act({ a: 'chief', act: 'found' }), V.treasury >= 200);
        text(ctx, 'RAID A COAST:', 12, row(1) + 4, '#ffe070');
        V.targets.forEach((q, k) => btn(12 + k * 124, row(2), 120, `${q.name}`.slice(0, 18), () => this.act({ a: 'chief', act: 'raid_coast', arg: String(q.sid) })));
        if (!V.targets.length) text(ctx, 'No coast within reach worth the powder.', 100, row(1) + 4, '#a89878');
        text(ctx, 'THE LOG:', 12, row(3) + 4, '#ffe070');
        (V.log || []).slice(-2).forEach((l, k) => text(ctx, String(l.text).slice(0, 80), 12, row(4) + k * 9, '#a89878'));
      }
    }
    text(ctx, 'ESC: LEAVE THE HALL  ·  TAB: NEXT', UW / 2, UH - 9, '#6a6050', { align: 'center' });
  }
}

// ------------------------------------------------------------ the map
// A dead captain's treasure map: the coast round the spot drawn from the
// lie of the land as it really is, in brown ink on old parchment, the sea
// hatched, a dotted way from the nearest town's side, a compass rose, and
// the X, pulsing red. `info`: { x, z, n, who, hint, dug }.
export class TreasureMapWindow extends Window {
  constructor(ui, info, { mirror = false } = {}) {
    super(ui, COLS, ROWS, { kind: 'tmap', x: 0, y: 0 });
    this.info = info;
    this.mirror = mirror;
    this.passive = !!ui.remoteSeat && !mirror;
    if (this.passive) this.mir = { k: 'tmap', d: info };
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
  }

  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', '#000000', 'rgba(0,0,0,0)');
  }

  onKey(k) {
    if (this.passive) {
      if (k.code === 'HavenAct' || k.code === 'Escape') super.close();
      return true;
    }
    if (k.code === 'Escape' || k.code === 'KeyE' || k.code === 'Enter') this.close();
    return true;
  }

  onClick() {
    if (!this.passive) this.close();
    return true;
  }

  close() {
    if (this.mirror) {
      (this.ui.forward ||= []).push({ code: 'HavenAct', key: '{"a":"close"}' });
      (this.ui.putDown ||= new Set()).add(this.mirrorOf);
    }
    super.close();
  }

  // The chart itself (once): 96 by 64 inked squares, each six paces.
  chart() {
    const game = this.ui.game;
    const ow = game && game.world && game.world.ow;
    const W = 96;
    const H = 64;
    const b = new Bmp(W * 3, H * 3);
    const I = this.info;
    const land = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) land.push(ow ? ow.continentAt(I.x + (i - W / 2) * 6, I.z + (j - H / 2) * 6) > 0.02 : (i + j) % 7 > 2);
    const L = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? false : land[j * W + i]);
    const ink = rgb('#3a2210');
    // (Old paper, browned: the land washed a shade darker in ochre, the
    // sea hatched in faded blue, the coast inked thick.)
    const paper = ramp('#b89a64', 3, { spread: 0.2 });
    const landC = ramp('#9a7a44', 3, { spread: 0.2 });
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const coast = L(i, j) !== L(i + 1, j) || L(i, j) !== L(i, j + 1) || L(i, j) !== L(i - 1, j) || L(i, j) !== L(i, j - 1);
        const shore = !L(i, j) && (L(i + 2, j) || L(i - 2, j) || L(i, j + 2) || L(i, j - 2));
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            const x = i * 3 + dx;
            const y = j * 3 + dy;
            const n = hash2(x >> 1, y >> 1, 5);
            let c = L(i, j) ? (n < 0.15 ? landC[0] : landC[1]) : n < 0.12 ? paper[1] : paper[2];
            if (!L(i, j) && (x + y) % 4 === 0) c = rgb(shore ? '#5a7a8a' : '#7a9098');
            if (L(i, j) && hash2(i, j, 13) < 0.05 && dx === 1 && dy === 1) c = rgb('#4a6a2a');
            if (coast && L(i, j)) c = ink;
            b.set(x, y, c);
          }
        }
      }
    }
    // Burnt, ragged edges.
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const e = Math.min(x, y, b.w - 1 - x, b.h - 1 - y);
        const n = hash2(x >> 2, y >> 2, 21);
        if (e < 2 + n * 6) b.set(x, y, e < 1 + n * 3 ? [0, 0, 0] : rgb('#5a3a18'), e < 1 + n * 3 ? 0 : 1);
      }
    }
    return b.canvas();
  }

  drawPixels(ctx) {
    if (this.passive || typeof document === 'undefined') return;
    this.cv ||= this.chart();
    if (!this.cv) return;
    const I = this.info;
    const cw = this.cv.width;
    const chh = this.cv.height;
    const x0 = Math.round((UW - cw) / 2);
    const y0 = 34;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    rect(ctx, 0, 0, UW, UH, 'rgba(8,6,4,0.82)');
    ctx.drawImage(this.cv, x0, y0);
    // The dotted way, from the edge toward the town, to the X.
    const cx = x0 + cw / 2;
    const cy = y0 + chh / 2;
    for (let k = 0; k < 18; k++) {
      const f = k / 18;
      const px = cx - 70 + f * 70 + Math.sin(f * 7) * 8;
      const py = cy + 50 - f * 50;
      if (k % 2 === 0) rect(ctx, px, py, 2, 2, '#5a3a20');
    }
    // The X, pulsing.
    const pulse = 1 + Math.round((Math.sin(this.t * 4) + 1) * 1);
    for (let d = -4 - pulse; d <= 4 + pulse; d++) {
      rect(ctx, cx + d - 1, cy + d - 1, 3, 3, '#a81818');
      rect(ctx, cx + d - 1, cy - d - 1, 3, 3, '#a81818');
    }
    // A compass rose.
    const rx = x0 + cw - 30;
    const ry = y0 + 28;
    for (let d = -12; d <= 12; d++) {
      dot(ctx, rx + d, ry, '#4a2e18');
      dot(ctx, rx, ry + d, '#4a2e18');
    }
    for (const [dx, dy] of [[-2, -10], [2, -10], [0, -12]]) dot(ctx, rx + dx, ry + dy, '#a81818');
    text(ctx, 'N', rx - 2, ry - 22, '#4a2e18', { shadow: null });
    text(ctx, `THE HOARD OF ${String(I.who || 'A CAPTAIN').toUpperCase()}`, UW / 2, 12, '#ffe070', { scale: 2, align: 'center' });
    text(ctx, String(I.hint || ''), UW / 2, y0 + chh + 8, '#e8d0a0', { align: 'center' });
    text(ctx, I.dug ? 'SOMEONE HAS DUG HERE ALREADY.' : 'DIG AT THE X WITH A SHOVEL.', UW / 2, y0 + chh + 20, I.dug ? '#c08070' : '#a8e0a0', { align: 'center' });
    text(ctx, 'CLICK OR ESC: FOLD IT UP', UW / 2, UH - 10, '#8a7a5a', { align: 'center' });
    ctx.restore();
  }
}

// The windows a guest's screen draws itself (see net/uiwire.js).
export const HAVEN_WINDOWS = { havencard: HavenCardWindow, havencouncil: HavenCouncilWindow, tmap: TreasureMapWindow };
