// Playing together: your account (name, picture, a few words about you),
// the multiplayer menu on the title screen, hosting a world for your
// network, the party (who's here, kicking and banning, inviting friends),
// someone's profile (and a friend request), and the little notices when
// someone joins or asks to be your friend. See net/ for how it all goes
// over the network, and main.js for what each button does.
import { COLS, CHAR_W, CHAR_H, VIEW_W } from '../config.js';
import { Window } from './window.js';
import { C, wrap, Grid, drawGrid } from './ascii.js';
import { avatarCanvas, drawAvatar } from '../render/avatar.js';
import { ICON_SHAPES, ICON_COLORS, ICON_BGS, ICON_PATTERNS, ICON_FRAMES, TITLES, NAME_MAX, DESC_MAX, DESC_WORDS, wordCount, nameProblem, cleanIcon } from '../net/account.js';
import { MAX_PLAYERS, NET_VERSION } from '../net/protocol.js';
import { versionText, sameVersion, canUpgrade } from '../version.js';
import { GUILD_NAME_MAX } from '../game/guilds.js';
import { SaveDetailsWindow } from './windows.js';

// (Solid: nothing behind shows through.)
const PANEL = '#100c18';

const cycle = (list, v, d) => list[(list.indexOf(v) + d + list.length) % list.length];

// A row of a menu, as a button: highlighted under the pointer.
function button(w, g, x, y, width, label, fn, { color = C.fg, off = false, hint = null } = {}) {
  const hov = !off && w.hovering(x, y, width, 1);
  g.fill(x, y, width, 1, ' ', C.fg, off ? '#15121b' : hov ? C.bgHi : '#1c1726');
  g.text(x + 1, y, label, off ? C.faint : hov ? C.white : color, undefined, width - 2);
  if (hint) g.text(x + width - 1 - hint.length, y, hint, off ? C.faint : C.dim);
  if (!off) w.hit(x, y, width, 1, fn);
}

// ------------------------------------------------------------ the account
// Made once (a name, a picture, a few words); after, the picture and the
// words can be changed, never the name.
export class AccountWindow extends Window {
  // (`titles()`: the titles earned, to go by (see game/achievements.js);
  // `onFeats`: to see the achievements that unlock them.)
  constructor(ui, accounts, { onDone = null, onChange = null, titles = null, onFeats = null } = {}) {
    super(ui, 70, 34, { kind: 'account' });
    this.accounts = accounts;
    this.onDone = onDone;
    this.onChange = onChange;
    this.titles = titles || (() => accounts.titles());
    this.onFeats = onFeats;
    const a = accounts.account;
    this.editing = !!a;
    this.name = a ? a.name : '';
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    this.icon = cleanIcon(a ? a.icon : { shape: pick(ICON_SHAPES), color: pick(ICON_COLORS), bg: pick(ICON_BGS) });
    this.desc = a ? a.desc : '';
    this.title = a ? a.title || '' : '';
    this.sel = this.editing ? 1 : 0;
    this.err = null;
    this.code = null;
  }

  rows() {
    return [
      { id: 'name', label: 'Username', locked: this.editing },
      { id: 'title', label: 'Title', list: this.titleList(), show: (v) => v || 'none' },
      { id: 'shape', label: 'Picture', list: ICON_SHAPES },
      { id: 'color', label: 'Colour', list: ICON_COLORS, swatch: true },
      { id: 'bg', label: 'Background', list: ICON_BGS, swatch: true },
      { id: 'pattern', label: 'Pattern', list: ICON_PATTERNS },
      { id: 'frame', label: 'Frame', list: ICON_FRAMES },
      { id: 'desc', label: 'About you' },
    ];
  }

  value(id) {
    return id === 'title' ? this.title : this.icon[id];
  }

  // The titles you can pick: none, and those you've earned.
  titleList() {
    const got = this.titles() || [];
    return ['', ...TITLES.filter((t) => t && got.includes(t))];
  }

  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: this.editing ? 'YOUR ACCOUNT' : 'MAKE YOUR ACCOUNT' });
    g.text(2, 2, this.editing ? 'Your picture, title and the words about you can be changed.' : 'Who you are to the people you play with. Kept on this', C.dim);
    if (!this.editing) g.text(2, 3, 'machine for good; the name can\'t be changed later.', C.dim);
    // The picture, big, and you as others see you.
    g.box(this.w - 12, 5, 10, 8, { fg: C.faint, bg: '#100c18' });
    const cv = avatarCanvas(this.icon, 3);
    if (cv) g.image(this.w - 11, 6, cv, 0, 0);
    const who = this.name || '?';
    g.text(this.w - 7 - Math.ceil(who.length / 2), 14, who.slice(0, 12), C.hi);
    if (this.title) g.text(this.w - 7 - Math.ceil(this.title.length / 2), 15, this.title, C.dim);
    // (Titles are earned: see what earns them.)
    const earned = this.titleList().length - 1;
    g.text(this.w - 14, 17, `${earned}/${TITLES.length - 1} titles`, C.faint);
    if (this.onFeats) button(this, g, this.w - 15, 18, 14, 'Achievements', () => this.onFeats());
    const rows = this.rows();
    rows.forEach((r, i) => {
      const y = 5 + i * 2;
      const sel = i === this.sel;
      const hov = this.hovering(2, y, this.w - 16, 1);
      g.fill(2, y, this.w - 16, 1, ' ', C.fg, sel ? C.bgSel : hov ? C.bgHi : undefined);
      g.text(3, y, r.label, sel ? C.hi : C.fg);
      this.hit(2, y, this.w - 16, 1, () => {
        this.sel = i;
      });
      const vx = 16;
      if (r.id === 'name') {
        const shown = this.name + (sel && !r.locked && Math.floor(this.ui.time * 2) % 2 ? '_' : '');
        g.text(vx, y, shown || (r.locked ? '' : '(type a name)'), r.locked ? C.dim : this.name ? C.white : C.faint);
        if (r.locked) g.text(vx + this.name.length + 1, y, '(fixed)', C.faint);
      } else if (r.id === 'desc') {
        const lines = wrap(this.desc + (sel && Math.floor(this.ui.time * 2) % 2 ? '_' : ''), this.w - 30);
        if (!this.desc && !sel) g.text(vx, y, '(a few words about you)', C.faint);
        lines.slice(-7).forEach((l, k) => g.text(vx, y + k, l, C.white));
        const n = wordCount(this.desc);
        g.text(vx, y + 7, `${n}/${DESC_WORDS} words`, n >= DESC_WORDS ? C.orange : C.faint);
      } else {
        const cur = this.value(r.id);
        g.text(vx, y, '◄', C.hi);
        this.hit(vx, y, 1, 1, () => this.change(r.id, -1));
        let ax;
        if (r.swatch) {
          // (The colours to pick from, the one you have marked.)
          r.list.forEach((col, k) => g.put(vx + 2 + k * 2, y, '■', col));
          // (The one you have, marked beneath.)
          const at = r.list.indexOf(cur);
          if (at >= 0) g.put(vx + 2 + at * 2, y + 1, '▲', C.hi);
          r.list.forEach((col, k) => this.hit(vx + 2 + k * 2, y, 2, 1, () => {
            this.icon = { ...this.icon, [r.id]: col };
          }));
          ax = vx + 2 + r.list.length * 2;
        } else {
          const text = r.show ? r.show(cur) : cur;
          g.text(vx + 2, y, text, C.white);
          g.text(vx + 15, y, `${r.list.indexOf(cur) + 1}/${r.list.length}`, C.faint);
          ax = vx + 13;
        }
        g.text(ax, y, '►', C.hi);
        this.hit(ax, y, 1, 1, () => this.change(r.id, 1));
      }
    });
    if (this.err) g.text(2, 27, this.err, C.red, undefined, this.w - 4);
    const bw = 30;
    button(this, g, 2, 28, bw, this.editing ? '[ENTER] Save' : '[ENTER] Make my account', () => this.save(), { color: C.hi });
    button(this, g, 2, 30, bw, this.editing ? '[ESC] Close' : '[ESC] Back', () => this.close());
    if (this.editing) button(this, g, 34, 28, bw, '[X] Copy my account code', () => this.exportCode());
    else button(this, g, 34, 28, bw, '[I] Use an account code...', () => this.importCode());
    if (this.code) {
      g.text(34, 30, 'Your code (copied, if allowed):', C.dim);
      g.text(2, 32, this.code.slice(0, this.w - 4), C.cyan);
    } else g.text(2, 32, '↑↓ choose · ←→ change · type to write', C.faint);
  }

  change(id, d) {
    if (id === 'title') this.title = cycle(this.titleList(), this.title, d);
    else if (this.icon[id] !== undefined) {
      const list = { shape: ICON_SHAPES, color: ICON_COLORS, bg: ICON_BGS, pattern: ICON_PATTERNS, frame: ICON_FRAMES }[id];
      if (list) this.icon = { ...this.icon, [id]: cycle(list, this.icon[id], d) };
    }
    this.ui.audio?.play('select');
  }

  save() {
    try {
      if (this.editing) this.accounts.update({ icon: this.icon, desc: this.desc, title: this.title });
      else {
        const why = nameProblem(this.name);
        if (why) {
          this.err = why;
          this.sel = 0;
          return;
        }
        this.accounts.create(this.name, this.icon, this.desc, this.title);
      }
    } catch (e) {
      this.err = e.message;
      return;
    }
    this.ui.audio?.play('coin');
    this.close();
    if (this.onChange) this.onChange(this.accounts.profile);
    if (this.onDone) this.onDone(this.accounts.profile);
  }

  exportCode() {
    this.code = this.accounts.exportCode();
    try {
      globalThis.navigator?.clipboard?.writeText(this.code);
    } catch {
      // Shown on screen all the same.
    }
  }

  importCode() {
    const v = globalThis.prompt ? globalThis.prompt('Paste your account code:', '') : null;
    if (!v) return;
    try {
      this.accounts.importCode(v);
      this.ui.audio?.play('coin');
      this.close();
      if (this.onDone) this.onDone(this.accounts.profile);
    } catch (e) {
      this.err = e.message;
    }
  }

  onKey(k) {
    const rows = this.rows();
    const r = rows[this.sel];
    if (k.code === 'Escape') this.close();
    else if (k.code === 'Enter') this.save();
    else if (k.code === 'ArrowUp') this.sel = (this.sel + rows.length - 1) % rows.length;
    else if (k.code === 'ArrowDown' || k.code === 'Tab') this.sel = (this.sel + 1) % rows.length;
    else if ((k.code === 'ArrowLeft' || k.code === 'ArrowRight') && r.list) this.change(r.id, k.code === 'ArrowLeft' ? -1 : 1);
    else if (r.id === 'name' && !r.locked) {
      if (k.code === 'Backspace') this.name = this.name.slice(0, -1);
      else if (k.key && k.key.length === 1 && /[A-Za-z0-9_\- ]/.test(k.key) && this.name.length < NAME_MAX) this.name += k.key;
      this.err = null;
    } else if (r.id === 'desc') {
      if (k.code === 'Backspace') this.desc = this.desc.slice(0, -1);
      else if (k.key && k.key.length === 1 && this.desc.length < DESC_MAX) {
        // (Forty words at most: no starting a forty-first.)
        const starts = !/\s/.test(k.key) && (!this.desc || /\s$/.test(this.desc));
        if (starts && wordCount(this.desc) >= DESC_WORDS) this.err = `At most ${DESC_WORDS} words.`;
        else this.desc += k.key;
      }
    } else if (this.editing && k.code === 'KeyX') this.exportCode();
    else if (!this.editing && k.code === 'KeyI') this.importCode();
    return true;
  }
}

// ------------------------------------------------------------ the title menu
// The worlds to join: the one hosted at this address, then those found
// elsewhere on the network (each `at` its own address: see tools/lan.mjs).
const JOIN_KEYS = ['J', 'K', 'L'];
export function networkWorlds(lan) {
  if (!lan) return [];
  const out = [];
  if (lan.host) out.push({ ...lan.host, at: null });
  for (const n of lan.nearby || []) if (n && n.world) out.push({ ...n.world, v: n.v, at: { addr: n.addr, port: n.port } });
  return out.slice(0, JOIN_KEYS.length);
}

// From the title screen: a world of your own to host, one you've hosted
// before, or the one being hosted at this address.
export class MultiplayerWindow extends Window {
  // `ctx`: { accounts, lan (what the relay says, or null), saves ([{ id,
  // meta }] of your multiplayer worlds), hooks: { account, newWorld,
  // seedWorld, continueWorld(id), join } }
  constructor(ui, ctx) {
    super(ui, 66, 34, { kind: 'multiplayer' });
    this.ctx = ctx;
  }

  draw(g) {
    const { accounts, lan, saves, hooks } = this.ctx;
    const a = accounts.profile;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: 'MULTIPLAYER' });
    // You.
    if (a) {
      const cv = avatarCanvas(a.icon, 1);
      if (cv) g.image(2, 2, cv, 0, 0);
      g.text(6, 2, a.name, C.hi);
      g.text(6, 3, (a.desc || 'No description yet.').slice(0, this.w - 34), C.dim);
    } else g.text(2, 2, 'Make an account to play with others.', C.orange);
    button(this, g, this.w - 26, 2, 24, a ? '[A] Account & friends' : '[A] Make an account', () => hooks.account(), { color: a ? C.fg : C.hi });
    let y = 6;
    g.text(2, y++, 'YOUR WORLDS', C.border);
    const full = (saves || []).length >= 3;
    button(this, g, 2, y, this.w - 4, '[N] New multiplayer world (random)', () => hooks.newWorld(), { off: !a || full, hint: full ? 'delete one first' : null });
    y += 2;
    button(this, g, 2, y, this.w - 4, '[S] New multiplayer world from seed...', () => hooks.seedWorld(), { off: !a || full });
    y += 2;
    (saves || []).slice(0, 3).forEach((s, i) => {
      const m = s.meta;
      // (What's in it, and updating or deleting it: picked, see
      // SaveDetailsWindow. Round 50: not from the list itself.)
      const other = !sameVersion(m.gv);
      const up = canUpgrade(m.gv);
      button(this, g, 2, y, this.w - 4, `[${i + 1}] ${m.world || m.name}`.slice(0, 40), () => this.details(s.id), { off: !a, color: other ? C.orange : C.fg, hint: other ? `${versionText(m.gv)}${up ? ' · can update' : ''} · day ${m.day}` : `day ${m.day} · ${m.players || 1} played` });
      y += 2;
    });
    y += 1;
    g.text(2, y++, 'ON THIS NETWORK', C.border);
    const worlds = networkWorlds(lan);
    worlds.forEach((w, i) => {
      const key = JOIN_KEYS[i];
      const old = w.v && w.v !== NET_VERSION;
      // (A world on another version of the game: you're told, and can't.)
      const other = !old && !sameVersion(w.gv || null);
      button(this, g, 2, y, this.w - 4, `[${key}] Join "${w.name || 'a world'}" hosted by ${w.hostName || 'someone'}`.slice(0, this.w - 16), () => (other ? hooks.otherVersion(w) : hooks.join(w.at)), { off: !a || w.players >= w.max || old, color: other ? C.orange : C.hi, hint: old || other ? `${versionText(w.gv || null)}` : `${w.players}/${w.max}` });
      // (Found elsewhere on the network: where.)
      if (w.at) g.text(7, y + 1, `on another computer, at ${w.at.addr}`, C.faint);
      y += 2;
    });
    if (!worlds.length) {
      g.text(3, y++, lan ? 'Nobody is hosting a world on your network right now.' : 'This copy of the game wasn\'t started with "npm start",', C.dim);
      if (!lan) g.text(3, y++, 'so it can\'t host or find worlds on your network.', C.dim);
      y++;
    }
    const addrs = lan && lan.addrs && lan.addrs.length ? lan.addrs.map((x) => `http://${x}:${lan.port}`) : [];
    if (addrs.length) {
      g.text(3, y++, 'Friends on the same Wi-Fi join a world you host by opening', C.faint);
      g.text(3, y++, `${addrs[0]}${lan.mdns ? ` or http://${lan.mdns}:${lan.port}` : ''}`.slice(0, this.w - 5), C.cyan);
      g.text(3, y++, 'in their browser (or it shows up here, in their own copy).', C.faint);
    }
    button(this, g, 2, this.h - 3, 20, '[ESC] Back', () => this.close());
    g.text(24, this.h - 3, `Up to ${MAX_PLAYERS} players in a world.`, C.faint);
  }

  // One of your worlds, picked: what's in it, and hosting, updating or
  // deleting it.
  details(id) {
    const { hooks } = this.ctx;
    const meta = () => (this.ctx.saves || []).find((q) => q.id === id)?.meta || null;
    this.ui.open(new SaveDetailsWindow(this.ui, {
      id,
      title: 'YOUR WORLD',
      mp: true,
      meta,
      load: () => hooks.continueWorld(id),
      remove: () => hooks.deleteWorld(id),
      update: () => hooks.upgradeWorld?.(id, meta()),
    }));
  }

  onKey(k) {
    const { hooks, saves, accounts } = this.ctx;
    const a = accounts.profile;
    if (k.code === 'Escape') this.close();
    else if (k.code === 'KeyA') hooks.account();
    else if (!a) return true;
    else if (k.code === 'KeyN' && !(saves && saves.length >= 3)) hooks.newWorld();
    else if (k.code === 'KeyS' && !(saves && saves.length >= 3)) hooks.seedWorld();
    else if (JOIN_KEYS.includes(k.code.replace(/^Key/, ''))) {
      const w = networkWorlds(this.ctx.lan)[JOIN_KEYS.indexOf(k.code.replace(/^Key/, ''))];
      if (w && w.players < w.max && !(w.v && w.v !== NET_VERSION)) {
        if (!sameVersion(w.gv || null)) hooks.otherVersion(w);
        else hooks.join(w.at);
      }
    } else {
      const d = /^Digit([1-3])$/.exec(k.code);
      if (d && saves && saves[+d[1] - 1]) this.details(saves[+d[1] - 1].id);
    }
    return true;
  }
}

// How a world you've made is shared: on your network, or (not yet) online.
export class HostWindow extends Window {
  constructor(ui, { name = 'My world', lan = null, onStart }) {
    super(ui, 58, 18, { kind: 'host' });
    this.name = name;
    this.lan = lan;
    this.onStart = onStart;
  }

  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: 'HOST YOUR WORLD' });
    g.text(2, 2, 'World name', C.fg);
    g.fill(14, 2, this.w - 16, 1, ' ', C.fg, C.bgSel);
    g.text(15, 2, this.name + (Math.floor(this.ui.time * 2) % 2 ? '_' : ''), C.white);
    const ok = !!this.lan;
    g.text(2, 5, ok ? '(•)' : '( )', ok ? C.hi : C.faint);
    g.text(6, 5, 'Host on your network (LAN)', ok ? C.white : C.faint);
    if (ok) {
      const a = this.lan.addrs && this.lan.addrs[0];
      g.text(6, 6, a ? `Friends on your Wi-Fi open http://${a}:${this.lan.port}` : 'No network found: only this machine can join.', C.dim, undefined, this.w - 8);
      if (a && this.lan.mdns) g.text(6, 7, `(or http://${this.lan.mdns}:${this.lan.port})`, C.faint, undefined, this.w - 8);
    } else g.text(6, 6, 'Start the game with "npm start" to host on your network.', C.orange, undefined, this.w - 8);
    g.text(2, 8, '( )', C.faint);
    g.text(6, 8, 'Cloud hosting', C.faint);
    g.text(20, 8, '(coming soon: not available yet)', C.faint);
    button(this, g, 2, 12, 26, '[ENTER] Start the world', () => this.start(), { off: !ok, color: C.hi });
    button(this, g, 30, 12, 26, '[ESC] Back', () => this.close());
    g.text(2, 15, `Up to ${MAX_PLAYERS} players. You can kick, ban and invite`, C.faint);
    g.text(2, 16, 'from the pause menu (Esc, then P).', C.faint);
  }

  start() {
    if (!this.lan) return;
    const name = this.name.trim() || 'My world';
    this.close();
    this.onStart(name);
  }

  onKey(k) {
    if (k.code === 'Escape') this.close();
    else if (k.code === 'Enter') this.start();
    else if (k.code === 'Backspace') this.name = this.name.slice(0, -1);
    else if (k.key && k.key.length === 1 && this.name.length < 28) this.name += k.key;
    return true;
  }
}

// ------------------------------------------------------------ the party
// In a world with others (the pause menu, or P): who's here, and for the
// host, kicking, banning and inviting.
export class PartyWindow extends Window {
  // `ctx()`: { me, host (bool), world, addrs, party: [profiles], bans,
  // friends, requests, lobby (friends at this address's title screen),
  // pvp (players may hurt each other), hooks: { profile(p), kick(p), ban(p),
  // unban(id), invite(f), answer(id, yes), account(), leave(), pvp() } }
  constructor(ui, ctx) {
    super(ui, 74, 34, { kind: 'party' });
    this.ctx = ctx;
    this.scroll = 0;
  }

  draw(g) {
    const c = this.ctx();
    const H = c.hooks;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: `MULTIPLAYER · ${(c.world || 'this world').toUpperCase()}`.slice(0, this.w - 6) });
    let y = 2;
    if (c.host) {
      g.text(2, y++, c.addrs && c.addrs.length ? `Hosting on your network. Friends on your Wi-Fi open:` : 'Hosting (no network found: only this machine can join).', C.dim);
      if (c.addrs && c.addrs.length) {
        g.text(4, y++, [`http://${c.addrs[0]}`, c.mdns ? `http://${c.mdns}` : null].filter(Boolean).join('  or  ').slice(0, this.w - 6), C.cyan);
        // (Should that one not reach them: this machine's other addresses.)
        if (c.addrs.length > 1) g.text(4, y++, `(else: ${c.addrs.slice(1, 3).map((a) => `http://${a}`).join(', ')})`.slice(0, this.w - 6), C.faint);
      }
    } else g.text(2, y++, `In ${c.hostName || 'the host'}'s world.`, C.dim);
    // Fighting between players: the host's to allow.
    if (c.host) {
      const label = `[V] Players can hurt each other: ${c.pvp ? 'ON' : 'OFF'}`;
      button(this, g, 2, y++, label.length + 2, label, () => H.pvp(), { color: c.pvp ? C.red : C.dim });
    } else g.text(2, y++, c.pvp ? 'Players can hurt each other here (the host allows it).' : 'Players can\'t hurt each other here.', c.pvp ? C.red : C.faint);
    y++;
    const row = (p, yy, extra) => {
      const cv = p.icon ? avatarCanvas(p.icon, 1) : null;
      if (cv) g.image(2, yy, cv, 0, 0);
      else if (p.color) g.text(3, yy, '■', p.color);
      const nm = p.name + (p.host ? ' (host)' : '') + (p.id === c.me ? ' (you)' : '');
      g.text(6, yy, nm, p.id === c.me ? C.hi : p.color || C.white);
      let tx = 7 + nm.length;
      if (p.title) {
        g.text(tx, yy, `· ${p.title}`, C.dim);
        tx += p.title.length + 3;
      }
      // (Their guild, by name, in its colour.)
      if (p.guild) g.text(tx, yy, `[${p.guild.name}]`, p.guild.color);
      g.text(6, yy + 1, (p.desc || '').slice(0, 34), C.faint);
      let x = this.w - 2;
      for (const [label, fn, col] of extra.reverse()) {
        x -= label.length + 2;
        const hov = this.hovering(x, yy, label.length + 2, 1);
        g.fill(x, yy, label.length + 2, 1, ' ', C.fg, hov ? C.bgHi : 'rgba(40,32,52,0.95)');
        g.text(x + 1, yy, label, hov ? C.white : col || C.fg);
        this.hit(x, yy, label.length + 2, 1, fn);
        x -= 1;
      }
    };
    // The lists, scrolled if they don't all fit (wheel or ↑↓).
    const list = [];
    const head = (text) => list.push({ h: 1, draw: (yy) => g.text(2, yy, text, C.border) });
    const line = (text) => list.push({ h: 1, draw: (yy) => g.text(3, yy, text, C.faint) });
    const entry = (p, extra) => list.push({ h: 3, draw: (yy) => row(p, yy, extra) });
    // Your guild (or the founding of one), and invitations to others'.
    const guilds = c.guilds || [];
    const mine = guilds.find((q) => q.members.includes(c.me)) || null;
    const guildOf = (id) => guilds.find((q) => q.members.includes(id)) || null;
    head(mine ? `YOUR GUILD · ${mine.name.toUpperCase()} (${mine.members.length})` : 'GUILD');
    if (mine) {
      const names = mine.members.map((m) => `${(mine.names && mine.names[m]) || 'someone'}${m === mine.leader ? ' (leads)' : ''}`).join(', ');
      entry({ name: mine.name, color: mine.color, desc: names }, [['Leave', () => H.guild('leave'), C.orange]]);
      line('Guildmates see each other on the maps, and down the side of the screen.');
    } else {
      list.push({ h: 2, draw: (yy) => button(this, g, 2, yy, 30, '[G] Found a guild...', () => H.foundGuild(), { color: C.hi }) });
      line('A guild\'s members see each other on the maps, wherever they are.');
    }
    for (const q of guilds.filter((o) => o.invites.includes(c.me) && !o.members.includes(c.me))) {
      entry({ name: q.name, color: q.color, desc: `asks you to join (${q.members.length} member${q.members.length === 1 ? '' : 's'})` }, [['Join', () => H.guild('join', { gid: q.id }), C.green], ['Decline', () => H.guild('decline', { gid: q.id }), C.red]]);
    }
    head(`PLAYERS (${c.party.length}/${MAX_PLAYERS})`);
    for (const p of c.party) {
      const extra = [['Profile', () => H.profile(p)]];
      // (Into your guild: anyone here not in it, nor asked yet.)
      if (mine && p.id !== c.me && !mine.members.includes(p.id) && !mine.invites.includes(p.id)) extra.push(['Invite to guild', () => H.guild('invite', { to: p.id }), C.cyan]);
      if (c.host && !p.host) extra.push(['Kick', () => H.kick(p), C.orange], ['Ban', () => H.ban(p), C.red]);
      entry({ ...p, guild: guildOf(p.id) }, extra);
    }
    if (c.host) {
      head('BANNED');
      if (!c.bans.length) line('Nobody.');
      for (const b of c.bans) entry(b, [['Unban', () => H.unban(b.id), C.green]]);
    }
    if (c.requests.length) {
      head('FRIEND REQUESTS');
      for (const r of c.requests) entry(r, [['Accept', () => H.answer(r.id, true), C.green], ['Decline', () => H.answer(r.id, false), C.red]]);
    }
    head('FRIENDS');
    const here = new Set(c.party.map((p) => p.id));
    const waiting = new Set((c.lobby || []).map((p) => p.id));
    if (!c.friends.length) line('No friends yet: right-click someone in the world to see their profile.');
    for (const f of c.friends) {
      const status = here.has(f.id) ? 'in this world' : waiting.has(f.id) ? 'at this address\'s title screen' : 'not here';
      const extra = c.host && !here.has(f.id) ? [[waiting.has(f.id) ? 'Invite' : 'Invite (send address)', () => H.invite(f), C.green]] : [];
      entry({ ...f, desc: status }, extra);
    }
    const top = y;
    const bottom = this.h - 5;
    const total = list.reduce((n, q) => n + q.h, 0);
    this.maxScroll = Math.max(0, total - (bottom - top));
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll));
    let yy = top - this.scroll;
    for (const q of list) {
      if (yy >= top && yy + q.h <= bottom) q.draw(yy);
      yy += q.h;
    }
    if (this.scroll > 0) g.text(this.w - 4, top, '▲', C.dim);
    if (this.scroll < this.maxScroll) g.text(this.w - 4, bottom - 1, '▼', C.dim);
    if (c.note) g.text(2, this.h - 4, c.note.slice(0, this.w - 4), C.cyan);
    button(this, g, 2, this.h - 2, 22, '[A] Your account', () => H.account());
    if (!c.host) button(this, g, 26, this.h - 2, 22, '[L] Leave the world', () => H.leave(), { color: C.orange });
    button(this, g, this.w - 22, this.h - 2, 20, '[ESC] Close', () => this.close());
  }

  onKey(k) {
    const c = this.ctx();
    if (k.code === 'Escape' || k.code === 'KeyP') this.close();
    else if (k.code === 'KeyA') c.hooks.account();
    else if (k.code === 'KeyG' && !(c.guilds || []).some((q) => q.members.includes(c.me))) c.hooks.foundGuild();
    else if (k.code === 'KeyL' && !c.host) c.hooks.leave();
    else if (k.code === 'KeyV' && c.host) c.hooks.pvp();
    else if (k.code === 'ArrowDown') this.scroll += 3;
    else if (k.code === 'ArrowUp') this.scroll = Math.max(0, this.scroll - 3);
    return true;
  }

  onWheel(d) {
    this.scroll = Math.max(0, Math.min(this.maxScroll || 0, this.scroll + Math.sign(d) * 3));
  }
}

// A guild's name, to found it by.
export class GuildNameWindow extends Window {
  constructor(ui, onDone) {
    super(ui, 50, 12, { kind: 'guildName' });
    this.name = '';
    this.onDone = onDone;
  }

  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: 'FOUND A GUILD' });
    g.text(2, 2, 'What\'s it to be called?', C.fg);
    g.fill(2, 4, this.w - 4, 1, ' ', C.fg, C.bgSel);
    g.text(3, 4, this.name + (Math.floor(this.ui.time * 2) % 2 ? '_' : ''), C.white);
    g.text(2, 6, `At most ${GUILD_NAME_MAX} letters. You can ask others to join after.`, C.faint, undefined, this.w - 4);
    button(this, g, 2, 8, 22, '[ENTER] Found it', () => this.done(), { off: this.name.trim().length < 3, color: C.hi });
    button(this, g, 26, 8, 22, '[ESC] Back', () => this.close());
  }

  done() {
    if (this.name.trim().length < 3) return;
    this.close();
    this.onDone(this.name.trim());
  }

  onKey(k) {
    if (k.code === 'Escape') this.close();
    else if (k.code === 'Enter') this.done();
    else if (k.code === 'Backspace') this.name = this.name.slice(0, -1);
    else if (k.key && k.key.length === 1 && this.name.length < GUILD_NAME_MAX && /[A-Za-z0-9 '\-&.]/.test(k.key)) this.name += k.key;
    return true;
  }
}

// Someone's profile: their picture, name and words, and a friend request.
export class ProfileWindow extends Window {
  // `ctx()`: { me, friend (bool), sent (bool), hooks: { request(p), edit() } }
  constructor(ui, profile, ctx) {
    super(ui, 56, 18, { kind: 'profile' });
    this.profile = profile;
    this.ctx = ctx;
  }

  draw(g) {
    const p = this.profile;
    const c = this.ctx();
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: 'PROFILE' });
    g.box(2, 2, 10, 8, { fg: C.faint, bg: '#100c18' });
    const cv = avatarCanvas(p.icon, 3);
    if (cv) g.image(3, 3, cv, 0, 0);
    g.text(14, 2, p.name, C.hi);
    if (p.host) g.text(14 + p.name.length + 1, 2, '(host)', C.dim);
    if (p.title) g.text(14, 3, `the ${p.title}`, C.dim);
    wrap(p.desc || 'No description.', this.w - 16).slice(0, 8).forEach((l, i) => g.text(14, 5 + i, l, p.desc ? C.fg : C.faint));
    const mine = p.id === c.me;
    if (mine) button(this, g, 2, 14, 24, '[E] Edit your profile', () => c.hooks.edit());
    else if (c.friend) g.text(3, 14, '♥ Friends', C.green);
    else if (c.sent) g.text(3, 14, 'Friend request sent.', C.dim);
    else if (c.asked) button(this, g, 2, 14, 27, '[F] Accept their request', () => c.hooks.accept(p), { color: C.green });
    else button(this, g, 2, 14, 27, '[F] Send friend request', () => c.hooks.request(p), { color: C.hi });
    // A bout with them (in the same world): for what purse, if any.
    if (!mine && c.bout) {
      if (!this.picking) button(this, g, 30, 14, 24, '[D] Challenge to a bout', () => (this.picking = true), { color: C.orange });
      else {
        g.text(2, 16, 'Purse:', C.dim);
        BOUT_PURSES.forEach((w, i) => button(this, g, 9 + i * 11, 16, 10, `[${i + 1}] ${w ? `¤${w}` : 'none'}`, () => this.challenge(w), { color: C.orange }));
        return;
      }
    }
    button(this, g, this.w - 16, 16, 14, '[ESC] Close', () => this.close());
  }

  challenge(wager) {
    this.picking = false;
    this.ctx().hooks.bout(this.profile, wager);
    this.close();
  }

  onKey(k) {
    const c = this.ctx();
    const p = this.profile;
    if (this.picking) {
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(k.code);
      if (i >= 0) this.challenge(BOUT_PURSES[i]);
      else if (k.code === 'Escape' || k.code === 'KeyD') this.picking = false;
      return true;
    }
    if (k.code === 'Escape') this.close();
    else if (k.code === 'KeyE' && p.id === c.me) c.hooks.edit();
    else if (k.code === 'KeyF' && p.id !== c.me && !c.friend && !c.sent) (c.asked ? c.hooks.accept : c.hooks.request)(p);
    else if (k.code === 'KeyD' && p.id !== c.me && c.bout) this.picking = true;
    return true;
  }
}

// The purses a bout between players can be for (see game/bout.js).
export const BOUT_PURSES = [0, 10, 25, 50];

// Another player here challenges you to a bout (kept by the host for you:
// see game/bout.js). `ask`: { from (their profile), wager, live() }.
export class BoutAskWindow extends Window {
  constructor(ui, ask, onAnswer) {
    super(ui, 52, 12, { kind: 'boutAsk' });
    this.ask = ask;
    this.onAnswer = onAnswer;
  }

  draw(g) {
    const a = this.ask;
    // (Withdrawn, or no answer in time: gone.)
    if (a.live && !a.live()) {
      this.close();
      return;
    }
    const f = a.from || {};
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: 'A CHALLENGE' });
    const cv = avatarCanvas(f.icon, 1);
    if (cv) g.image(2, 2, cv, 0, 0);
    g.text(6, 2, f.name || 'Someone', C.hi);
    g.text(6, 3, `challenges you to a bout${a.wager ? `, for ¤${a.wager}` : ''}.`, C.fg);
    wrap('The first down to a quarter of their strength yields' + (a.wager ? ', and pays the purse.' : '.'), this.w - 4).slice(0, 2).forEach((l, i) => g.text(2, 5 + i, l, C.dim));
    button(this, g, 2, 9, 22, '[Y] Accept', () => this.answer(true), { color: C.green });
    button(this, g, 26, 9, 22, '[N] Decline', () => this.answer(false));
  }

  answer(yes) {
    this.close();
    this.onAnswer(yes);
  }

  onKey(k) {
    if (k.code === 'KeyY' || k.code === 'Enter') this.answer(true);
    else if (k.code === 'KeyN' || k.code === 'Escape') this.answer(false);
    return true;
  }
}

// A world's guest's own pause menu (the world goes on: it's the host's).
export class GuestPauseWindow extends Window {
  constructor(ui, hooks) {
    super(ui, 34, 14, { kind: 'pause' });
    this.items = [
      ['ESC', 'Resume', () => this.close()],
      ['P', 'Multiplayer', () => hooks.party()],
      ['A', 'Your account', () => hooks.account()],
      ['O', 'Settings', () => hooks.settings()],
      ['H', 'How to play', () => hooks.help()],
      ['L', 'Leave the world', () => hooks.leave()],
    ];
  }

  draw(g) {
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: 'PAUSED' });
    this.items.forEach(([k, label, fn], i) => {
      const y = 2 + i;
      const hov = this.hovering(2, y, this.w - 4, 1);
      g.fill(2, y, this.w - 4, 1, ' ', C.fg, hov ? C.bgHi : undefined);
      g.text(3, y, `[${k}]`, C.hi);
      g.text(10, y, label, hov ? C.white : C.fg);
      this.hit(2, y, this.w - 4, 1, () => fn());
    });
    g.text(3, this.h - 3, 'The world goes on while you\'re', C.faint);
    g.text(3, this.h - 2, 'here: it\'s the host\'s.', C.faint);
  }

  onKey(k) {
    const it = this.items.find(([key]) => (key === 'ESC' ? k.code === 'Escape' : `Key${key}` === k.code));
    if (it) it[2]();
    return true;
  }
}

// A friend hosting at this address asks you to come.
export class InviteWindow extends Window {
  constructor(ui, invite, onAnswer) {
    super(ui, 50, 12, { kind: 'invite' });
    this.invite = invite;
    this.onAnswer = onAnswer;
  }

  draw(g) {
    const f = this.invite.from || {};
    g.fill(0, 0, this.w, this.h, ' ', C.fg, PANEL);
    g.box(0, 0, this.w, this.h, { bg: PANEL, double: true, title: 'AN INVITATION' });
    const cv = avatarCanvas(f.icon, 1);
    if (cv) g.image(2, 2, cv, 0, 0);
    g.text(6, 2, f.name || 'A friend', C.hi);
    wrap(`invites you to play in "${this.invite.world || 'their world'}".`, this.w - 10).slice(0, 2).forEach((l, i) => g.text(6, 3 + i, l, C.fg));
    button(this, g, 2, 7, 22, '[Y] Join them', () => this.answer(true), { color: C.green });
    button(this, g, 26, 7, 22, '[N] Not now', () => this.answer(false));
  }

  answer(yes) {
    this.close();
    this.onAnswer(yes);
  }

  onKey(k) {
    if (k.code === 'KeyY' || k.code === 'Enter') this.answer(true);
    else if (k.code === 'KeyN' || k.code === 'Escape') this.answer(false);
    return true;
  }
}

// ------------------------------------------------------------ notices
// Little notices at the side of the screen: someone joined, someone wants
// to be friends. They fade after a few seconds.
export function addNote(ui, text, profile = null, color = C.fg) {
  (ui.notes ||= []).push({ text, profile, color, t: 6 });
  if (ui.notes.length > 4) ui.notes.shift();
  ui.audio?.play('select');
}

export function tickNotes(ui, dt) {
  if (!ui.notes) return;
  for (const n of ui.notes) n.t -= dt;
  ui.notes = ui.notes.filter((n) => n.t > 0);
}

export function drawNotes(ui, ctx) {
  if (!ui.notes || !ui.notes.length) return;
  // (Under the strip of guildmates, if there is one: see UI.drawGuildStrip.)
  let y = Math.max(7 * CHAR_H, ui.notesTop || 0);
  for (const n of ui.notes) {
    const lines = wrap(n.text, 30);
    const w = Math.max(...lines.map((l) => l.length)) + (n.profile ? 5 : 2);
    const h = Math.max(lines.length, n.profile ? 2 : 1) + 2;
    const g = new Grid(w, h);
    g.box(0, 0, w, h, { bg: C.bg, fg: C.border });
    lines.forEach((l, i) => g.text(n.profile ? 4 : 1, 1 + i, l, n.color));
    const x = Math.floor((VIEW_W - 4 - w * CHAR_W) / CHAR_W);
    ctx.globalAlpha = Math.min(1, n.t / 0.6);
    drawGrid(ctx, g, x, Math.floor(y / CHAR_H), 1, 0, ui.time);
    if (n.profile) drawAvatar(ctx, n.profile.icon, (x + 1) * CHAR_W - 2, y + CHAR_H, 1);
    ctx.globalAlpha = 1;
    y += h * CHAR_H + 2;
  }
}

export { COLS };
