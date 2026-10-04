// Your account: who you are to the people you play with. Made once and
// kept in this browser for good; its name stays as you chose it, but its
// picture and the few words about you can be changed whenever you like.
// It also keeps your friends, and the friend requests waiting on an answer.
//
// (No server keeps accounts: an account lives in the browser it was made
// in. Its code, from the account window, carries it to another browser.)

export const NAME_MIN = 3;
export const NAME_MAX = 16;
export const DESC_MAX = 80;
const KEY = 'tessera-account-v1';

// The pictures to choose from: a shape, its colour, and the ground behind it.
export const ICON_SHAPES = ['sword', 'shield', 'crown', 'skull', 'star', 'leaf', 'moon', 'sun', 'flame', 'wave', 'eye', 'heart', 'key', 'anchor', 'mushroom', 'gem'];
export const ICON_COLORS = ['#ffe070', '#ff7060', '#80e070', '#70c8ff', '#c090ff', '#ffa050', '#f4ecd8', '#ff90c8'];
export const ICON_BGS = ['#2a2238', '#3a1e1e', '#1e3a26', '#1e2a44', '#3a2a14', '#14302e', '#30303a', '#401c34'];

export const DEFAULT_ICON = { shape: 'sword', color: ICON_COLORS[0], bg: ICON_BGS[0] };

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
  };
}

export const cleanDesc = (d) => String(d || '').replace(/\s+/g, ' ').trim().slice(0, DESC_MAX);

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
  return a ? { id: a.id, name: a.name, icon: cleanIcon(a.icon), desc: cleanDesc(a.desc) } : null;
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
      a.friends ||= [];
      a.incoming ||= [];
      a.sent ||= [];
      return a;
    } catch {
      return null;
    }
  }

  write() {
    try {
      this.st?.setItem(KEY, JSON.stringify(this.acc));
      return true;
    } catch {
      return false;
    }
  }

  get account() {
    return this.acc;
  }

  get profile() {
    return profileOf(this.acc);
  }

  // Make the account (once). Throws if the name won't do.
  create(name, icon, desc) {
    const why = nameProblem(name);
    if (why) throw new Error(why);
    this.acc = { id: newId(), name: String(name).trim(), icon: cleanIcon(icon), desc: cleanDesc(desc), made: Date.now(), friends: [], incoming: [], sent: [] };
    this.write();
    return this.acc;
  }

  // A new picture or new words (the name stays).
  update({ icon, desc } = {}) {
    if (!this.acc) return null;
    if (icon) this.acc.icon = cleanIcon(icon);
    if (desc !== undefined) this.acc.desc = cleanDesc(desc);
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
    const json = JSON.stringify({ id: this.acc.id, name: this.acc.name, icon: this.acc.icon, desc: this.acc.desc, made: this.acc.made, friends: this.acc.friends });
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
    this.acc = { id: String(a.id), name: a.name.trim(), icon: cleanIcon(a.icon), desc: cleanDesc(a.desc), made: a.made || Date.now(), friends: (a.friends || []).map((f) => ({ ...profileOf(f), since: f.since || Date.now() })), incoming: [], sent: [] };
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
