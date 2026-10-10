// Minimal static file server for local play: `npm start` then open the URL.
// It's also the LAN relay for multiplayer (see relay.mjs): a world hosted
// from this machine's browser can be joined by anyone on the same network
// at this machine's address, shown in the game when you host; or as
// http://tessera.local:8080 (this machine answers to that name); or from
// the Multiplayer menu of their own copy of the game, which finds worlds
// hosted nearby by itself (see lan.mjs). (Round 81: the server itself is
// server.mjs, which the desktop app runs too.)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';
import { MDNS_NAME, DISCOVERY_PORT } from './lan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
startServer({
  root,
  port: Number(process.env.PORT) || 8080,
  // (TESSERA_DATA: another folder to keep each machine's account and
  // worlds in: see store.mjs.)
  dataDir: process.env.TESSERA_DATA || path.join(root, 'saves'),
  // (TESSERA_NAME: another name to answer to; TESSERA_LAN=off: neither the
  // name nor finding worlds nearby.)
  lan: process.env.TESSERA_LAN !== 'off',
  mdnsName: process.env.TESSERA_NAME ? `${process.env.TESSERA_NAME.replace(/\.local$/, '')}.local` : MDNS_NAME,
  discoveryPort: Number(process.env.TESSERA_DISCOVERY_PORT) || DISCOVERY_PORT,
}).catch((e) => {
  console.error(e && e.code === 'EADDRINUSE' ? `Port ${process.env.PORT || 8080} is already in use: is the game already running? (PORT=8081 npm start to use another.)` : e);
  process.exit(1);
});
