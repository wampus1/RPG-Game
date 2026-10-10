// (Round 81) Worlds from the browser version, found on this computer for
// the desktop app to bring in (see src/game/carry.js).
//
// The browser version ("npm start") kept a copy of each world and your
// account with its own server, in its folder: <game folder>/saves/local
// (see tools/store.mjs). The app looks for such a folder where a game
// folder's likely to be (the app's own folder, when it's run from one;
// home, Desktop, Documents, Downloads, and the places code is usually
// kept, two folders deep), and can be shown one (the game folder, its
// saves folder or saves/local), or a file the browser version saved
// everything to (Settings, General: "Save it all to a file").
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { serverStoreBundle, isBundle, bundleSummary } from '../src/game/carry.js';

const INDEX = 'saves-index.txt';
const SKIP = new Set(['node_modules', '.git', 'AppData', 'Library', '$Recycle.Bin', 'Windows', 'Program Files', 'Program Files (x86)', '.cache', '.npm']);

// The drawer folder for `dir` (the game folder, its saves, or the drawer
// itself), or null.
export function drawerOf(dir) {
  for (const d of [dir, path.join(dir, 'local'), path.join(dir, 'saves', 'local')]) {
    try {
      if (fs.statSync(path.join(d, INDEX)).isFile() || fs.statSync(path.join(d, 'account.txt')).isFile()) return d;
    } catch {
      // Not this one.
    }
  }
  return null;
}

// Where to look: { home, appRoot, extra: [dirs] } → the drawers found,
// each once.
export function findOldStores({ home, appRoot = null, extra = [], maxDirs = 4000 } = {}) {
  const roots = [...extra, appRoot, home && path.join(home, 'Desktop'), home && path.join(home, 'Documents'), home && path.join(home, 'Downloads'), home && path.join(home, 'OneDrive', 'Desktop'), home && path.join(home, 'OneDrive', 'Documents'), home && path.join(home, 'Documents', 'GitHub'), home && path.join(home, 'source', 'repos'), home && path.join(home, 'Projects'), home && path.join(home, 'projects'), home && path.join(home, 'code'), home && path.join(home, 'dev'), home && path.join(home, 'git'), home].filter(Boolean);
  const found = new Map();
  let seen = 0;
  const look = (dir, depth) => {
    if (seen++ > maxDirs) return;
    const d = drawerOf(dir);
    if (d) {
      const real = fs.realpathSync.native ? fs.realpathSync.native(d) : d;
      if (!found.has(real)) found.set(real, d);
      return;
    }
    if (depth <= 0) return;
    let names = [];
    try {
      names = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of names) {
      if (!e.isDirectory() || e.name.startsWith('.') || SKIP.has(e.name)) continue;
      look(path.join(dir, e.name), depth - 1);
    }
  };
  for (const r of roots) {
    try {
      if (!fs.statSync(r).isDirectory()) continue;
    } catch {
      continue;
    }
    look(r, r === home ? 1 : 2);
  }
  return [...found.values()];
}

// A drawer's worlds and account, as a bundle. (`peek`: each world only
// looked for, not read: enough to say what's there.)
export function readOldStore(dir, peek = false) {
  const d = drawerOf(dir);
  if (!d) throw new Error('No worlds from the browser version there (looked for saves\\local\\saves-index.txt).');
  const read = (n) => {
    try {
      return fs.readFileSync(path.join(d, n), 'utf8');
    } catch {
      return null;
    }
  };
  const index = read(INDEX);
  const saves = {};
  let ix = {};
  try {
    ix = JSON.parse(index || '{}') || {};
  } catch {
    ix = {};
  }
  for (const id of Object.keys(ix)) {
    if (!/^[A-Za-z0-9._~-]{1,80}$/.test(id)) continue;
    if (peek) {
      if (fs.existsSync(path.join(d, `save-${id}.txt`))) saves[id] = '';
      continue;
    }
    const t = read(`save-${id}.txt`);
    if (t !== null) saves[id] = t;
  }
  return serverStoreBundle({ index, account: read('account.txt'), saves }, d);
}

// A file the browser version saved everything to.
export function readExportFile(file) {
  let buf = fs.readFileSync(file);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  let b;
  try {
    b = JSON.parse(buf.toString('utf8'));
  } catch {
    b = null;
  }
  if (!isBundle(b)) throw new Error('That isn\'t a file of Tessera worlds (the browser version saves one from Settings, General).');
  b.from = file;
  return b;
}

// Each place found, as the page shows it: { dir, summary }.
export function describe(dirs) {
  const out = [];
  for (const dir of dirs) {
    try {
      out.push({ dir, summary: bundleSummary(readOldStore(dir, true)) });
    } catch {
      // (Unreadable: left out.)
    }
  }
  return out;
}
