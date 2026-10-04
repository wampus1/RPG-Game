// This machine's account and worlds, kept with the game's own server as
// well as in the browser (see tools/store.mjs). A browser keeps what it
// stores apart for each address the game is opened at (localhost, the
// network address, tessera.local...): without this each would have its
// own account and its own worlds, strangers to one another. Whichever
// copy is newer wins. (A friend's machine, at the host's server, keeps
// only its account there: its worlds are its own to keep.)
import { KEY as ACCOUNT_KEY } from './account.js';

export const STORE_PATH = '/api/store';
const INDEX = 'saves-index';
const saveKey = (id) => `save-${id}`;

export class MachineSync {
  // `storage`: the browser's (where the account lives); `accounts`,
  // `store`: the game's (see account.js and game/saves.js).
  constructor({ storage, accounts, store, fetch = (...a) => globalThis.fetch(...a) }) {
    this.st = storage;
    this.accounts = accounts;
    this.store = store;
    this.fetch = fetch;
    this.on = false;
    this.local = false;
    this.index = {};
    this.chain = Promise.resolve();
  }

  async req(method, key, body = null, at = null) {
    const headers = at ? { 'X-Saved-At': String(at) } : undefined;
    const r = await this.fetch(key ? `${STORE_PATH}/${key}` : STORE_PATH, { method, body, headers, cache: 'no-store' });
    if (method === 'GET') return r.ok ? (key ? r.text() : r.json()) : null;
    return r.ok;
  }

  // One after another, in the order asked (a save, then its index).
  queue(fn) {
    this.chain = this.chain.then(fn).catch(() => {});
    return this.chain;
  }

  // Brought into step with the server's copies; from then on, each change
  // goes there too. True if there's a server to keep them.
  async start() {
    let list;
    try {
      list = await this.req('GET', null);
    } catch {
      return false;
    }
    if (!list || !list.items) return false;
    this.on = true;
    this.local = list.ns === 'local';
    await this.syncAccount(list.items);
    if (this.local) await this.syncSaves(list.items);
    this.accounts.onWrite = () => this.queue(() => this.pushAccount());
    if (this.local) this.store.onChange = (id, meta) => this.queue(() => this.pushSave(id, meta));
    return true;
  }

  // ------------------------------------------------------------ the account
  async syncAccount(items) {
    const mine = this.accounts.account;
    let theirs = null;
    if (items.account) {
      try {
        theirs = JSON.parse(await this.req('GET', 'account'));
      } catch {
        theirs = null;
      }
    }
    const age = (a) => (a ? a.at || a.made || 0 : -1);
    if (theirs && theirs.id && age(theirs) > age(mine)) {
      this.st.setItem(ACCOUNT_KEY, JSON.stringify(theirs));
      this.accounts.reload();
    } else if (mine && age(mine) > age(theirs)) await this.pushAccount();
  }

  async pushAccount() {
    const a = this.accounts.account;
    if (!a) return;
    await this.req('PUT', 'account', JSON.stringify(a), a.at || Date.now());
  }

  // ------------------------------------------------------------ the worlds
  async syncSaves(items) {
    let theirs = {};
    if (items[INDEX]) {
      try {
        theirs = JSON.parse(await this.req('GET', INDEX)) || {};
      } catch {
        theirs = {};
      }
    }
    this.index = theirs;
    const mine = this.store.index();
    let changed = false;
    for (const id of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
      const L = mine[id];
      const S = theirs[id];
      if (S && S.gone) {
        // (Deleted at another address since it was last saved here.)
        if (L && (L.savedAt || 0) <= S.gone) this.store.remove(id, true);
        else if (L) changed = (await this.upload(id, L)) || changed;
      } else if (S && (!L || (S.savedAt || 0) > (L.savedAt || 0))) {
        const text = await this.req('GET', saveKey(id));
        if (text) await this.store.putText(id, text, S);
      } else if (L && (!S || (L.savedAt || 0) > (S.savedAt || 0))) changed = (await this.upload(id, L)) || changed;
    }
    if (changed) await this.req('PUT', INDEX, JSON.stringify(this.index));
  }

  // A save of this machine's, sent to be kept. True if it went.
  async upload(id, meta) {
    const text = await this.store.rawText(id);
    if (!text) return false;
    if (!(await this.req('PUT', saveKey(id), text, meta.savedAt))) return false;
    const m = { ...meta };
    delete m.db;
    this.index[id] = m;
    return true;
  }

  async pushSave(id, meta) {
    if (meta) {
      if (!(await this.upload(id, meta))) return;
    } else {
      this.index[id] = { gone: Date.now() };
      await this.req('DELETE', saveKey(id));
    }
    await this.req('PUT', INDEX, JSON.stringify(this.index));
  }
}
