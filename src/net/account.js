// Your account: who you are to the people you play with. Made once and
// kept in this browser for good; its name stays as you chose it, but its
// picture and the few words about you can be changed whenever you like.
// It also keeps your friends, and the friend requests waiting on an answer.
//
// (It lives in the browser it was made in, and with the game's own server
// as well (see net/machine.js), so it's the same whatever address the game
// is opened at on that machine. Its code, from the account window,
// carries it to another browser.)

import { FEAT_TITLES, titlesOf, clean as cleanFeats } from '../game/achievements.js';

export const NAME_MIN = 3;
export const NAME_MAX = 16;
// The words about you: forty at most (and never a wall of letters).
export const DESC_WORDS = 40;
export const DESC_MAX = 320;
export const KEY = 'tessera-account-v1';

// The pictures to choose from: a shape, its colour, the ground behind it,
// a pattern on the ground, and the frame round it all.
export const ICON_SHAPES = ['sword', 'shield', 'crown', 'skull', 'star', 'leaf', 'moon', 'sun', 'flame', 'wave', 'eye', 'heart', 'key', 'anchor', 'mushroom', 'gem', 'axe', 'tree', 'fish', 'cat', 'ship', 'potion', 'tower', 'feather'];
export const ICON_COLORS = ['#ffe070', '#ff7060', '#80e070', '#70c8ff', '#c090ff', '#ffa050', '#f4ecd8', '#ff90c8', '#50e0c8', '#c8f060', '#e04050', '#a0a8b8', '#7080ff', '#d0a070'];
export const ICON_BGS = ['#2a2238', '#3a1e1e', '#1e3a26', '#1e2a44', '#3a2a14', '#14302e', '#30303a', '#401c34', '#101018', '#283a10', '#3a1830', '#203040', '#402a20', '#1c3438'];
export const ICON_PATTERNS = ['plain', 'stripes', 'dots', 'checks', 'glow', 'stars'];
export const ICON_FRAMES = ['plain', 'gold', 'silver', 'bronze', 'jade', 'ember', 'rune'];
// What you go by, after your name (shown with your profile). Each is
// unlocked by an achievement (see game/achievements.js): none to begin with.
export const TITLES = ['', ...FEAT_TITLES];

export const DEFAULT_ICON = { shape: 'sword', color: ICON_COLORS[0], bg: ICON_BGS[0], pattern: 'plain', frame: 'plain' };

// Is this a name an account can have? (null if so, else why not)
export function nameProblem(name) {
  const n = String(name || '').trim();
  if (n.length < NAME_MIN) return `At least ${NAME_MIN} letters.`;
  if (n.length > NAME_MAX) return `At most ${NAME_MAX} letters.`;
  if (!/^[A-Za-z0-9_\- ]+$/.test(n)) return 'Letters, numbers, spaces, - and _ only.';
  return null;
}

export function cleanIcon(icon) {
  const i = icon && typeof icon === 'object' ? icon : {};
  return {
    shape: ICON_SHAPES.includes(i.shape) ? i.shape : DEFAULT_ICON.shape,
    color: ICON_COLORS.includes(i.color) ? i.color : DEFAULT_ICON.color,
    bg: ICON_BGS.includes(i.bg) ? i.bg : DEFAULT_ICON.bg,
    pattern: ICON_PATTERNS.includes(i.pattern) ? i.pattern : DEFAULT_ICON.pattern,
    frame: ICON_FRAMES.includes(i.frame) ? i.frame : DEFAULT_ICON.frame,
  };
}

// How many words.
export const wordCount = (d) => (String(d || '').trim() ? String(d).trim().split(/\s+/).length : 0);

// The words about you, tidied: forty words at most.
export const cleanDesc = (d) => String(d || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, DESC_WORDS).join(' ').slice(0, DESC_MAX);

export const cleanTitle = (t) => (TITLES.includes(t) ? t : '');

function newId() {
  const c = globalThis.crypto;
  if (c && c.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

// What others are shown of an account.
export function profileOf(a) {
  return a ? { id: a.id, name: a.name, icon: cleanIcon(a.icon), desc: cleanDesc(a.desc), title: cleanTitle(a.title) } : null;
}

export class Accounts {
  constructor(storage) {
    this.st = storage;
    this.acc = this.read();
  }

  read() {
    try {
      const a = JSON.parse(this.st && this.st.getItem(KEY));
      if (!a || !a.id || nameProblem(a.name)) return null;
      a.icon = cleanIcon(a.icon);
      a.desc = cleanDesc(a.desc);
      a.feats = cleanFeats(a.feats);
      a.title = cleanTitle(a.title);
      // (A title is gone by only once it's been earned: see
      // game/achievements.js.)
      if (a.title && !titlesOf(a.feats).includes(a.title)) a.title = '';
      a.friends ||= [];
      a.incoming ||= [];
      a.sent ||= [];
      return a;
    } catch {
      return null;
    }
  }

  // (When it was last changed: the newest copy wins, see machine.js.)
  write() {
    if (this.acc) this.acc.at = Date.now();
    try {
      this.st?.setItem(KEY, JSON.stringify(this.acc));
      this.onWrite?.(this.acc);
      return true;
    } catch {
      return false;
    }
  }

  // Read again (another copy of it put in its place).
  reload() {
    this.acc = this.read();
    return this.acc;
  }

  get account() {
    return this.acc;
  }

  get profile() {
    return profileOf(this.acc);
  }

  // The titles this account has earned.
  titles() {
    return this.acc ? titlesOf(this.acc.feats) : [];
  }

  // Make the account (once). Throws if the name won't do. (`localFeats`:
  // achievements earned in this browser before there was an account, set
  // by whoever keeps them: see main.js.)
  create(name, icon, desc, title = '') {
    const why = nameProblem(name);
    if (why) throw new Error(why);
    const feats = cleanFeats(this.localFeats ? this.localFeats() : null);
    const t = cleanTitle(title);
    this.acc = { id: newId(), name: String(name).trim(), icon: cleanIcon(icon), desc: cleanDesc(desc), title: titlesOf(feats).includes(t) ? t : '', feats, made: Date.now(), friends: [], incoming: [], sent: [] };
    this.write();
    return this.acc;
  }

  // A new picture or new words (the name stays).
  update({ icon, desc, title } = {}) {
    if (!this.acc) return null;
    if (icon) this.acc.icon = cleanIcon(icon);
    if (desc !== undefined) this.acc.desc = cleanDesc(desc);
    if (title !== undefined) {
      const t = cleanTitle(title);
      if (!t || this.titles().includes(t)) this.acc.title = t;
    }
    this.write();
    return this.acc;
  }

  // ------------------------------------------------------------ friends
  isFriend(id) {
    return !!this.acc && this.acc.friends.some((f) => f.id === id);
  }

  hasSent(id) {
    return !!this.acc && this.acc.sent.includes(id);
  }

  // Asked someone (they're told; see host.js).
  sentRequest(to) {
    if (!this.acc || !to || to.id === this.acc.id || this.isFriend(to.id)) return false;
    if (!this.acc.sent.includes(to.id)) this.acc.sent.push(to.id);
    this.write();
    return true;
  }

  // Someone asked you: kept till you answer. (True if it's new.)
  gotRequest(from) {
    const p = profileOf(from);
    if (!this.acc || !p || !p.id || p.id === this.acc.id || this.isFriend(p.id)) return false;
    // (Asked each other at once: friends straight away.)
    if (this.acc.sent.includes(p.id)) {
      this.befriend(p);
      return false;
    }
    if (this.acc.incoming.some((q) => q.id === p.id)) return false;
    this.acc.incoming.push(p);
    this.write();
    return true;
  }

  // Your answer to a request: friends, or not.
  answer(id, yes) {
    if (!this.acc) return null;
    const q = this.acc.incoming.find((r) => r.id === id);
    this.acc.incoming = this.acc.incoming.filter((r) => r.id !== id);
    if (q && yes) this.befriend(q);
    else this.write();
    return q || null;
  }

  // They said yes (or you did).
  befriend(p) {
    if (!this.acc || !p || !p.id || p.id === this.acc.id) return;
    this.acc.sent = this.acc.sent.filter((x) => x !== p.id);
    this.acc.incoming = this.acc.incoming.filter((r) => r.id !== p.id);
    const old = this.acc.friends.find((f) => f.id === p.id);
    if (old) Object.assign(old, profileOf(p));
    else this.acc.friends.push({ ...profileOf(p), since: Date.now() });
    this.write();
  }

  // They said no: not waiting on them any more.
  dropSent(id) {
    if (!this.acc) return;
    this.acc.sent = this.acc.sent.filter((x) => x !== id);
    this.write();
  }

  unfriend(id) {
    if (!this.acc) return;
    this.acc.friends = this.acc.friends.filter((f) => f.id !== id);
    this.write();
  }

  // A friend seen again: their picture and words as they are now.
  refreshFriend(p) {
    const f = this.acc && this.acc.friends.find((q) => q.id === p.id);
    if (!f) return;
    Object.assign(f, profileOf(p));
    this.write();
  }

  // ------------------------------------------------------------ carrying it
  // The account as a code to paste into another browser.
  exportCode() {
    if (!this.acc) return '';
    const json = JSON.stringify({ id: this.acc.id, name: this.acc.name, icon: this.acc.icon, desc: this.acc.desc, title: this.acc.title, feats: this.acc.feats || {}, made: this.acc.made, friends: this.acc.friends });
    return 'TSA1.' + b64(json);
  }

  importCode(code) {
    const s = String(code || '').trim();
    if (!s.startsWith('TSA1.')) throw new Error('That isn\'t an account code.');
    let a;
    try {
      a = JSON.parse(unb64(s.slice(5)));
    } catch {
      throw new Error('That account code is damaged.');
    }
    if (!a || !a.id || nameProblem(a.name)) throw new Error('That account code is damaged.');
    const feats = cleanFeats(a.feats);
    const t = cleanTitle(a.title);
    this.acc = { id: String(a.id), name: a.name.trim(), icon: cleanIcon(a.icon), desc: cleanDesc(a.desc), title: titlesOf(feats).includes(t) ? t : '', feats, made: a.made || Date.now(), friends: (a.friends || []).map((f) => ({ ...profileOf(f), since: f.since || Date.now() })), incoming: [], sent: [] };
    this.write();
    return this.acc;
  }
}

function b64(s) {
  const bytes = new globalThis.TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return globalThis.btoa(bin);
}

function unb64(s) {
  const bin = globalThis.atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new globalThis.TextDecoder().decode(bytes);
}
