// The game's own server (round 81: what `npm start` runs, and what the
// desktop app runs inside itself): the game's files, the LAN relay for
// multiplayer (see relay.mjs), this machine's name on the network and
// worlds hosted nearby (see lan.mjs), and each machine's keeping (see
// store.mjs).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Relay, lanAddresses } from './relay.mjs';
import { startMdns, startDiscovery, MDNS_NAME, DISCOVERY_PORT } from './lan.mjs';
import { MachineStore } from './store.mjs';
import { LAN_PATH } from '../src/net/protocol.js';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const plainIp = (ip) => String(ip || '').replace(/^::ffff:/, '');

// (Round 134) Each file served with a mark of the copy it is (its size and
// when it was last changed): asked for again with that mark, and not
// changed since, "you have it already" is all that's sent; and the game's
// code and pages squeezed (gzip) for another machine that can take it, kept so till the
// file changes. Still checked every time (no-cache), so a new version's
// seen at once; only no longer sent whole six hundred times over.
const PACK = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);
const packed = new Map();
export function serveFile(req, res, file, squeeze = true) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    const tag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const head = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: tag };
    if (req.headers['if-none-match'] === tag) {
      res.writeHead(304, head).end();
      return;
    }
    fs.readFile(file, (err2, data) => {
      if (err2) {
        res.writeHead(404).end('not found');
        return;
      }
      const gz = squeeze && PACK.has(path.extname(file)) && data.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      if (!gz) {
        res.writeHead(200, head);
        res.end(data);
        return;
      }
      let k = packed.get(file);
      if (!k || k.tag !== tag) {
        k = { tag, data: zlib.gzipSync(data, { level: 6 }) };
        packed.set(file, k);
      }
      res.writeHead(200, { ...head, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      res.end(k.data);
    });
  });
}

// Listening on `port`, or (with `tries` > 1) the next free one after it,
// or any free one at all. Resolves with the port it got.
function listen(server, port, tries) {
  return new Promise((resolve, reject) => {
    let at = port;
    let left = tries;
    const go = () => {
      const fail = (e) => {
        server.off('listening', ok);
        if (e && e.code === 'EADDRINUSE' && --left > 0) {
          at = left === 1 ? 0 : at + 1;
          go();
        } else reject(e);
      };
      const ok = () => {
        server.off('error', fail);
        resolve(server.address().port);
      };
      server.once('error', fail);
      server.once('listening', ok);
      server.listen(at);
    };
    go();
  });
}

// Started: resolves with { port, relay, server, close() }.
// `root`: where the game's files are. `dataDir`: where each machine's
// keeping goes. `localSaves`: false in the desktop app, which keeps this
// machine's own worlds in its data folder itself (only friends' machines'
// accounts are kept here). `tries`: how many ports to try, from `port` on.
export async function startServer({ root, port = 8080, dataDir, localSaves = true, lan = true, mdnsName = MDNS_NAME, discoveryPort = DISCOVERY_PORT, tries = 1, log = (m) => console.log(m) }) {
  let mdns = null;
  let nearby = null;
  const relay = new Relay({
    port,
    extra: () => ({ mdns: mdns ? mdns.name : null, nearby: nearby ? nearby.list() : [] }),
  });
  // Each machine's account and worlds, kept here as well as in its
  // browser (which keeps them apart for each address the game is opened
  // at): see store.mjs.
  const machines = new MachineStore(dataDir);
  const server = http.createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    // (This machine's own, at whatever address; another's, by its own.)
    const ip = plainIp(req.socket.remoteAddress);
    const local = ip === '::1' || ip.startsWith('127.') || lanAddresses().includes(ip);
    if (local && !localSaves && url.startsWith('/api/store')) {
      res.writeHead(404, { 'Cache-Control': 'no-cache' }).end();
      return;
    }
    if (machines.handle(req, res, url, local ? 'local' : `ip-${ip}`, local)) return;
    // Where this machine is on the network, and the world hosted here.
    if (url === LAN_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(relay.info()));
      return;
    }
    const file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    // (Squeezed for another machine; this one's own reads it straight off.)
    serveFile(req, res, file, !local);
  });
  server.on('upgrade', (req, socket) => relay.upgrade(req, socket));
  const got = await listen(server, port, tries);
  relay.port = got;
  log(`Tessera running at http://localhost:${got}`);
  const addrs = lanAddresses();
  if (addrs.length) log(`On your network: ${addrs.map((a) => `http://${a}:${got}`).join(', ')}`);
  if (lan) {
    mdns = startMdns({ name: mdnsName, log: (name) => log(`Also as http://${name}:${got} (on most phones and computers)`) });
    nearby = startDiscovery({ port: discoveryPort, info: () => relay.info() });
  }
  return {
    port: got,
    relay,
    server,
    close() {
      for (const s of [mdns, nearby]) {
        try {
          s?.close?.();
        } catch {
          // Gone already.
        }
      }
      server.closeAllConnections?.();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}
