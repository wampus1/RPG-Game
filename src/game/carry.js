// (Round 81) Worlds carried over from the browser version of the game into
// the desktop app (which keeps them in its own folder: see
// electron/data.js).
//
// What's carried is a "bundle":
//   { kind: 'tessera-carry', v: 1, gv, at, from,
//     kv:    { key: text }   what the game kept in browser storage (the
//                            slot list, your account, settings, keys,
//                            achievements, the mods' list...)
//     blobs: { key: text } } what it kept in its database: each world
//                            ('tessera-save-<slot>'), each mod ('mod:<id>',
//                            'modpack:<hash>')
// made by the browser version itself (Settings, General: "Save it all to
// a file"), or from what the game's server kept of a machine's worlds
// (its saves/local folder: see tools/store.mjs and net/machine.js), which
// is the worlds and the account, not the mods.
//
// Brought in (importBundle): each world into its own slot, or (that slot
// holding another world here already) the first free one of its kind; the
// same world kept here already, kept, unless the one carried is newer.
// Your account if there's none here (or it's this one, newer); mods,
// settings, keys and the rest where there are none of them here.
import { GAME_VERSION } from '../version.js';
import { SLOTS, MP_SLOTS } from './saves.js';

export const CARRY_KIND = 'tessera-carry';
// Whether the app's asked (or done) it: { state: 'done' | 'skipped', at }.
export const CARRY_KEY = 'tessera-carried-v1';
const SAVES_INDEX = 'tessera-saves-v2';
const ACCOUNT = 'tessera-account-v1';
const FEATS = 'tessera-feats-v1';
const MODS_INDEX = 'tessera-mods-v1';
const PACKS_INDEX = 'tessera-modpacks-v1';
const slotKey = (id) => `tessera-save-${id}`;
// (Browser storage that isn't carried as it is: the worlds and mods
// themselves, which go as blobs; the slot list, worked through below; and
// whether this was asked.)
const NOT_KV = (k) => k.startsWith('tessera-save-') || k.startsWith('tessera-mod:') || k.startsWith('tessera-modpack:') || k === CARRY_KEY;

const parse = (t, d) => {
  try {
    return t ? JSON.parse(t) ?? d : d;
  } catch {
    return d;
  }
};

// ------------------------------------------------------------ made
// Everything the browser version keeps, as a bundle (see above).
export async function exportBundle({ storage, store, modLib = null, from = '' }) {
  const kv = {};
  for (let i = 0; storage && i < storage.length; i++) {
    const k = storage.key(i);
    if (k === null || NOT_KV(k)) continue;
    const v = storage.getItem(k);
    if (v !== null) kv[k] = v;
  }
  const blobs = {};
  const ix = store.index();
  const kept = {};
  for (const [id, meta] of Object.entries(ix)) {
    const text = await store.rawText(id).catch(() => null);
    if (!text) continue;
    blobs[slotKey(id)] = text;
    const m = { ...meta };
    delete m.db;
    kept[id] = m;
  }
  kv[SAVES_INDEX] = JSON.stringify(kept);
  if (modLib) {
    for (const id of Object.keys(parse(kv[MODS_INDEX], {}))) {
      const t = await modLib.getRaw(`mod:${id}`).catch(() => null);
      if (t) blobs[`mod:${id}`] = t;
    }
    for (const hash of Object.keys(parse(kv[PACKS_INDEX], {}))) {
      const t = await modLib.getRaw(`modpack:${hash}`).catch(() => null);
      if (t) blobs[`modpack:${hash}`] = t;
    }
  }
  return { kind: CARRY_KIND, v: 1, gv: GAME_VERSION, at: Date.now(), from, kv, blobs };
}

// What the game's server kept of a machine (its drawer's files, as text:
// see tools/store.mjs), as a bundle: its worlds (any deleted since left
// out) and its account.
export function serverStoreBundle({ index = null, account = null, saves = {} }, from = '') {
  const ix = parse(index, {});
  const kept = {};
  const blobs = {};
  for (const [id, meta] of Object.entries(ix)) {
    if (!meta || meta.gone || typeof saves[id] !== 'string') continue;
    const m = { ...meta };
    delete m.db;
    kept[id] = m;
    blobs[slotKey(id)] = saves[id];
  }
  const kv = { [SAVES_INDEX]: JSON.stringify(kept) };
  if (account && parse(account, null)?.id) kv[ACCOUNT] = account;
  return { kind: CARRY_KIND, v: 1, gv: null, at: Date.now(), from, kv, blobs };
}

export function isBundle(b) {
  return !!(b && b.kind === CARRY_KIND && b.kv && typeof b.kv === 'object' && b.blobs && typeof b.blobs === 'object');
}

// What's in it, to show before it's brought in: { worlds: [{ id, meta }],
// hosted, account (its name, or null), mods, settings }.
export function bundleSummary(b) {
  const ix = parse(b.kv[SAVES_INDEX], {});
  const worlds = Object.entries(ix)
    .filter(([id, m]) => m && !m.gone && !id.includes('~') && typeof b.blobs[slotKey(id)] === 'string')
    .map(([id, meta]) => ({ id, meta }))
    .sort((a, c) => (c.meta.savedAt || 0) - (a.meta.savedAt || 0));
  const acc = parse(b.kv[ACCOUNT], null);
  return {
    worlds,
    hosted: worlds.filter((w) => MP_SLOTS.includes(w.id)).length,
    account: acc && acc.id ? acc.name || (acc.profile && acc.profile.name) || 'your account' : null,
    mods: Object.keys(parse(b.kv[MODS_INDEX], {})).length,
    settings: !!b.kv['tessera-settings'],
  };
}

// (The same world, one save of it or another: the same seed, the same
// character, the same name if it's one you host.)
function sameWorld(a, b) {
  return a && b && a.seed === b.seed && (a.name || '') === (b.name || '') && (a.world || '') === (b.world || '');
}

// A free slot of the kind `id` is (yours or one you host), or null.
function freeSlotLike(id, ix) {
  const kind = MP_SLOTS.includes(id) ? MP_SLOTS : SLOTS.filter((s) => s !== 'auto');
  return kind.find((s) => !ix[s]) || null;
}

// The mods a world was made with (from its text, without reading the
// whole of it): [{ id, hash, name }].
export function worldModRefs(text) {
  const m = /"mods":\{"refs":(\[.*?\]),"blockIds"/.exec(text || '');
  const refs = m ? parse(m[1], []) : [];
  return Array.isArray(refs) ? refs.filter((r) => r && r.hash) : [];
}

// ------------------------------------------------------------ brought in
// `storage`: the app's (see util/appstore.js); `store`: its SaveStore;
// `modLib`: its ModLibrary. Resolves with what was done:
//   { worlds: [{ id, to, meta, status: 'added' | 'newer' | 'moved' |
//     'had' | 'full' }], account: 'taken' | 'newer' | 'kept' | null,
//     mods, settings, needMods: [names] }
export async function importBundle(b, { storage, store, modLib = null }) {
  if (!isBundle(b)) throw new Error('That isn\'t a file of Tessera worlds.');
  const kv = b.kv;
  const blobs = b.blobs;
  const report = { worlds: [], account: null, mods: 0, settings: false, needMods: [] };

  // The worlds: each (and the worlds crossed into from it, "slot~map")
  // into its slot.
  const theirs = parse(kv[SAVES_INDEX], {});
  const ids = Object.keys(theirs).filter((id) => theirs[id] && !theirs[id].gone && typeof blobs[slotKey(id)] === 'string');
  const to = new Map();
  for (const id of ids.filter((q) => !q.includes('~')).sort((a, c) => (theirs[c].savedAt || 0) - (theirs[a].savedAt || 0))) {
    const meta = theirs[id];
    const ix = store.index();
    const here = ix[id];
    let slot = id;
    let status = 'added';
    if (here && sameWorld(here, meta)) {
      if ((meta.savedAt || 0) <= (here.savedAt || 0)) {
        report.worlds.push({ id, to: id, meta, status: 'had' });
        continue;
      }
      status = 'newer';
    } else if (here) {
      // (Its slot's taken by another world here: is that world's same
      // save in another slot already? Then that's it.)
      const twin = Object.entries(ix).find(([k, m]) => !k.includes('~') && sameWorld(m, meta) && (m.savedAt || 0) >= (meta.savedAt || 0));
      if (twin) {
        report.worlds.push({ id, to: twin[0], meta, status: 'had' });
        continue;
      }
      slot = freeSlotLike(id, ix);
      if (!slot) {
        report.worlds.push({ id, to: null, meta, status: 'full' });
        continue;
      }
      status = 'moved';
    }
    await store.putText(slot, blobs[slotKey(id)], meta);
    to.set(id, slot);
    report.worlds.push({ id, to: slot, meta, status });
  }
  for (const id of ids.filter((q) => q.includes('~'))) {
    const parent = id.slice(0, id.indexOf('~'));
    if (!to.has(parent)) continue;
    await store.putText(to.get(parent) + id.slice(parent.length), blobs[slotKey(id)], theirs[id]);
  }

  // Your account: if there's none here, or it's this one and newer.
  const acc = parse(kv[ACCOUNT], null);
  if (acc && acc.id) {
    const mine = parse(storage.getItem(ACCOUNT), null);
    const age = (a) => (a ? a.at || a.made || 0 : -1);
    if (!mine || !mine.id) {
      storage.setItem(ACCOUNT, kv[ACCOUNT]);
      report.account = 'taken';
    } else if (mine.id === acc.id && age(acc) > age(mine)) {
      storage.setItem(ACCOUNT, kv[ACCOUNT]);
      report.account = 'newer';
    } else report.account = 'kept';
  }

  // Achievements: all of both (each from when it was first earned).
  if (kv[FEATS]) {
    const a = parse(storage.getItem(FEATS), {});
    const c = parse(kv[FEATS], {});
    const out = { ...a };
    for (const [k, t] of Object.entries(c)) out[k] = out[k] ? Math.min(out[k], t) : t;
    storage.setItem(FEATS, JSON.stringify(out));
  }

  // Mods: those not here, and those here older than the ones carried.
  const myMods = parse(storage.getItem(MODS_INDEX), {});
  const myPacks = parse(storage.getItem(PACKS_INDEX), {});
  const put = async (key, text) => {
    if (modLib) await modLib.putRaw(key, text);
  };
  let modsChanged = false;
  for (const [id, e] of Object.entries(parse(kv[MODS_INDEX], {}))) {
    const text = blobs[`mod:${id}`];
    if (typeof text !== 'string' || (myMods[id] && (myMods[id].updated || 0) >= (e.updated || 0))) continue;
    await put(`mod:${id}`, text);
    myMods[id] = e;
    report.mods++;
    modsChanged = true;
  }
  let packsChanged = false;
  for (const [hash, e] of Object.entries(parse(kv[PACKS_INDEX], {}))) {
    const text = blobs[`modpack:${hash}`];
    if (typeof text !== 'string' || myPacks[hash]) continue;
    await put(`modpack:${hash}`, text);
    myPacks[hash] = e;
    packsChanged = true;
  }
  if (modsChanged) storage.setItem(MODS_INDEX, JSON.stringify(myMods));
  if (packsChanged) storage.setItem(PACKS_INDEX, JSON.stringify(myPacks));

  // The rest (settings, keys, ...): where there's nothing of it here.
  for (const [k, v] of Object.entries(kv)) {
    if (NOT_KV(k) || [SAVES_INDEX, ACCOUNT, FEATS, MODS_INDEX, PACKS_INDEX].includes(k) || typeof v !== 'string') continue;
    if (storage.getItem(k) !== null) continue;
    storage.setItem(k, v);
    if (k === 'tessera-settings') report.settings = true;
  }

  // Worlds made with mods that aren't here now.
  const need = new Set();
  for (const w of report.worlds) {
    if (w.status === 'full' || w.status === 'had') continue;
    for (const r of worldModRefs(blobs[slotKey(w.id)])) if (!myPacks[r.hash] && !myMods[r.id]) need.add(r.name || r.id);
  }
  report.needMods = [...need];
  storage.setItem(CARRY_KEY, JSON.stringify({ state: 'done', at: Date.now(), from: b.from || '' }));
  return report;
}

// What was done, in a few lines.
export function reportLines(r) {
  const out = [];
  const n = r.worlds.filter((w) => ['added', 'newer', 'moved'].includes(w.status));
  const name = (w) => (w.meta.world ? `"${w.meta.world}"` : `${w.meta.name || 'Someone'}, day ${w.meta.day ?? '?'}`);
  if (n.length) out.push(`Brought in ${n.length} world${n.length > 1 ? 's' : ''}${r.account === 'taken' || r.account === 'newer' ? ' and your account' : ''}.`);
  else if (r.worlds.length) out.push('Those worlds are here already.');
  else out.push(r.account === 'taken' ? 'Brought in your account (there were no worlds).' : 'There were no worlds to bring in.');
  for (const w of r.worlds) {
    if (w.status === 'moved') out.push(`${name(w)} went into slot ${w.to} (slot ${w.id} has another world).`);
    if (w.status === 'full') out.push(`${name(w)} couldn't come: every slot of its kind is taken. Free one and bring them in again.`);
  }
  if (r.account === 'kept') out.push('You had an account here already: it\'s kept as it was.');
  if (r.mods) out.push(`And ${r.mods} mod${r.mods > 1 ? 's' : ''}.`);
  if (r.needMods.length) out.push(`Made with mods not brought along: ${r.needMods.join(', ')}. Save everything to a file from the browser version (Settings, General) and bring that in, or import them in the Workshop.`);
  return out;
}
