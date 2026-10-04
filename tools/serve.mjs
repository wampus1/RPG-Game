// Minimal static file server for local play: `npm start` then open the URL.
// It's also the LAN relay for multiplayer (see relay.mjs): a world hosted
// from this machine's browser can be joined by anyone on the same network
// at this machine's address, shown in the game when you host; or as
// http://tessera.local:8080 (this machine answers to that name); or from
// the Multiplayer menu of their own copy of the game, which finds worlds
// hosted nearby by itself (see lan.mjs).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Relay, lanAddresses } from './relay.mjs';
import { startMdns, startDiscovery, MDNS_NAME, DISCOVERY_PORT } from './lan.mjs';
import { MachineStore } from './store.mjs';
import { LAN_PATH } from '../src/net/protocol.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 8080;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
// (TESSERA_NAME: another name to answer to; TESSERA_LAN=off: neither the
// name nor finding worlds nearby.)
const lanOn = process.env.TESSERA_LAN !== 'off';
let mdns = null;
let nearby = null;
const relay = new Relay({
  port,
  extra: () => ({ mdns: mdns ? mdns.name : null, nearby: nearby ? nearby.list() : [] }),
});

// Each machine's account and worlds, kept here as well as in its browser
// (which keeps them apart for each address the game is opened at): see
// store.mjs. (TESSERA_DATA: another folder to keep them in.)
const machines = new MachineStore(process.env.TESSERA_DATA || path.join(root, 'saves'));
const plainIp = (ip) => String(ip || '').replace(/^::ffff:/, '');

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // (This machine's own, at whatever address; another's, by its own.)
  const ip = plainIp(req.socket.remoteAddress);
  const local = ip === '::1' || ip.startsWith('127.') || lanAddresses().includes(ip);
  if (machines.handle(req, res, url, local ? 'local' : `ip-${ip}`, local)) return;
  // Where this machine is on the network, and the world hosted here.
  if (url === LAN_PATH) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify(relay.info()));
    return;
  }
  let file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});
server.on('upgrade', (req, socket) => relay.upgrade(req, socket));
server.listen(port, () => {
  console.log(`Tessera running at http://localhost:${port}`);
  const lan = lanAddresses();
  if (lan.length) console.log(`On your network: ${lan.map((a) => `http://${a}:${port}`).join(', ')}`);
  if (!lanOn) return;
  mdns = startMdns({ name: process.env.TESSERA_NAME ? `${process.env.TESSERA_NAME.replace(/\.local$/, '')}.local` : MDNS_NAME, log: (name) => console.log(`Also as http://${name}:${port} (on most phones and computers)`) });
  nearby = startDiscovery({ port: Number(process.env.TESSERA_DISCOVERY_PORT) || DISCOVERY_PORT, info: () => relay.info() });
});
