// Save slots: five of your own plus an autosave, each kept under its own
// key in browser storage, with a small index (who, where, when) so the
// slot list can be shown without reading every save.
export const SLOTS = ['auto', '1', '2', '3', '4', '5'];
const INDEX_KEY = 'tessera-saves-v2';
const LEGACY_KEY = 'tessera-save-v1';
const slotKey = (id) => `tessera-save-${id}`;

// What the slot list shows for a game.
export function metaOf(game) {
  const s = game.currentSettlement;
  const p = game.player;
  let place = s ? s.name : null;
  if (!place) {
    try {
      place = game.world.ow.biomeAt(p.x, p.z).biome;
    } catch {
      place = 'the wilds';
    }
  }
  return {
    name: game.playerName,
    origin: game.origin || null,
    day: game.day,
    minute: Math.floor(game.minute),
    seed: game.seed,
    place,
    savedAt: Date.now(),
  };
}

export function timeText(minute) {
  const h = Math.floor(minute / 60) % 24;
  const m = Math.floor(minute % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// "just now", "5 min ago", "3 h ago", "2 days ago".
export function agoText(t, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

export class SaveStore {
  constructor(storage) {
    this.st = storage;
    this.migrate();
  }

  get(key) {
    try {
      return this.st ? this.st.getItem(key) : null;
    } catch {
      return null;
    }
  }

  index() {
    try {
      return JSON.parse(this.get(INDEX_KEY)) || {};
    } catch {
      return {};
    }
  }

  writeIndex(ix) {
    this.st.setItem(INDEX_KEY, JSON.stringify(ix));
  }

  // A save from before there were slots goes into slot 1.
  migrate() {
    const old = this.get(LEGACY_KEY);
    if (!old) return;
    const ix = this.index();
    try {
      if (!ix['1']) {
        const d = JSON.parse(old);
        this.st.setItem(slotKey('1'), old);
        ix['1'] = { name: d.playerName || d.player?.name || 'Wanderer', day: d.day, minute: Math.floor(d.minute || 0), seed: d.seed, place: '?', savedAt: Date.now() };
        this.writeIndex(ix);
      }
      this.st.removeItem(LEGACY_KEY);
    } catch {
      // Leave it be; it can still be read another time.
    }
  }

  list() {
    const ix = this.index();
    return SLOTS.map((id) => ({ id, meta: ix[id] && this.get(slotKey(id)) ? ix[id] : null }));
  }

  has(id) {
    return !!this.list().find((s) => s.id === id)?.meta;
  }

  any() {
    return this.list().some((s) => s.meta);
  }

  // The slot saved to most recently.
  latest() {
    const all = this.list().filter((s) => s.meta);
    all.sort((a, b) => b.meta.savedAt - a.meta.savedAt);
    return all[0] || null;
  }

  // Throws if storage is full (the caller says so).
  save(id, game) {
    const data = JSON.stringify(game.serialize());
    const meta = metaOf(game);
    this.st.setItem(slotKey(id), data);
    const ix = this.index();
    ix[id] = meta;
    this.writeIndex(ix);
    return meta;
  }

  load(id) {
    const raw = this.get(slotKey(id));
    return raw ? JSON.parse(raw) : null;
  }

  remove(id) {
    try {
      this.st.removeItem(slotKey(id));
      const ix = this.index();
      delete ix[id];
      this.writeIndex(ix);
    } catch {
      // Nothing to remove.
    }
  }
}
