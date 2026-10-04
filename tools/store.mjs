// A machine's own keeping (see serve.mjs): its account and its saved and
// hosted worlds, kept by the game's server as well as in the browser.
// A browser keeps its things apart for each address the game is opened
// at (localhost, the network address, tessera.local...), so without this
// each would be a stranger to the others. Kept in files in a folder of its
// own; each machine that asks has its own drawer: this machine's ("local"),
// or another's on the network, by its address (only its account, kept
// small: their worlds are their own machine's to keep).
import fs from 'node:fs';
import path from 'node:path';

export const STORE_PATH = '/api/store';
const KEY = /^[A-Za-z0-9._-]{1,80}$/;
// (Another machine's drawer: its account and the like, no worlds.)
const REMOTE_KEYS = /^account/;
const LOCAL_MAX = 96 * 1024 * 1024;
const REMOTE_MAX = 256 * 1024;

export class MachineStore {
  constructor(dir) {
    this.dir = dir;
  }

  drawer(ns) {
    return path.join(this.dir, ns.replace(/[^A-Za-z0-9._-]/g, '_'));
  }

  file(ns, key) {
    return path.join(this.drawer(ns), `${key}.txt`);
  }

  // What's in a drawer: { key: { t, size } }.
  list(ns) {
    const out = {};
    let names = [];
    try {
      names = fs.readdirSync(this.drawer(ns));
    } catch {
      return out;
    }
    for (const n of names) {
      if (!n.endsWith('.txt')) continue;
      try {
        const st = fs.statSync(path.join(this.drawer(ns), n));
        out[n.slice(0, -4)] = { t: Math.round(st.mtimeMs), size: st.size };
      } catch {
        // Gone meanwhile.
      }
    }
    return out;
  }

  get(ns, key) {
    try {
      return fs.readFileSync(this.file(ns, key), 'utf8');
    } catch {
      return null;
    }
  }

  // Kept, as of `t` (when it was written in the browser).
  put(ns, key, text, t = Date.now()) {
    fs.mkdirSync(this.drawer(ns), { recursive: true });
    const f = this.file(ns, key);
    const tmp = `${f}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, f);
    const when = new Date(Math.max(0, Math.min(Date.now() + 60000, t)));
    try {
      fs.utimesSync(f, when, when);
    } catch {
      // Its own time will do.
    }
  }

  del(ns, key) {
    try {
      fs.unlinkSync(this.file(ns, key));
    } catch {
      // Not there.
    }
  }

  // An HTTP request for /api/store[/key] from the drawer `ns` (local:
  // this machine's own). True if it was one.
  handle(req, res, url, ns, local) {
    if (url !== STORE_PATH && !url.startsWith(`${STORE_PATH}/`)) return false;
    const send = (code, body = '', type = 'application/json') => {
      res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(body);
    };
    if (url === STORE_PATH) {
      if (req.method !== 'GET') {
        send(405);
        return true;
      }
      send(200, JSON.stringify({ ns: local ? 'local' : 'remote', items: this.list(ns) }));
      return true;
    }
    const key = url.slice(STORE_PATH.length + 1);
    if (!KEY.test(key) || (!local && !REMOTE_KEYS.test(key))) {
      send(403);
      return true;
    }
    if (req.method === 'GET') {
      const v = this.get(ns, key);
      if (v === null) send(404);
      else send(200, v, 'text/plain; charset=utf-8');
      return true;
    }
    if (req.method === 'DELETE') {
      this.del(ns, key);
      send(204);
      return true;
    }
    if (req.method !== 'PUT') {
      send(405);
      return true;
    }
    const max = local ? LOCAL_MAX : REMOTE_MAX;
    const parts = [];
    let size = 0;
    let over = false;
    req.on('data', (d) => {
      size += d.length;
      if (size > max) over = true;
      else parts.push(d);
    });
    req.on('end', () => {
      if (over) return send(413);
      try {
        this.put(ns, key, Buffer.concat(parts).toString('utf8'), Number(req.headers['x-saved-at']) || Date.now());
        send(204);
      } catch {
        send(500);
      }
    });
    return true;
  }
}
