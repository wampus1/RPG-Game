// Finding one another on the same network, with nothing to type but the
// game's own name:
//  - which of this machine's addresses the others can reach (its Wi-Fi or
//    cable, not the made-up networks of virtual machines, containers and
//    VPNs), best first;
//  - "tessera.local": this machine answers to that name on the network
//    (multicast DNS, as printers and phones do), so a friend can open
//    http://tessera.local:8080 without knowing the address;
//  - worlds hosted on the network, found by any copy of the game started
//    with "npm start" (each server hosting a world calls out now and then;
//    the others listen), so its Multiplayer menu lists them to join.
// Nothing here is needed to play: if the network won't carry it, the
// addresses still work.
import dgram from 'node:dgram';
import crypto from 'node:crypto';
import os from 'node:os';
import { setInterval, clearInterval } from 'node:timers';

// ------------------------------------------------------------ addresses
// (Adapters that are never the network your friends are on.)
const VIRTUAL = /(vethernet|virtualbox|vbox|vmware|vmnet|docker|^br-|^veth|virbr|wsl|hyper-v|utun|^tun|^tap|tailscale|zerotier|^zt|hamachi|npcap|loopback|bluetooth|^awdl|^llw|^anpi|^gif|^stf|^bridge)/i;
// (Those that are: Wi-Fi first, since that's how most people play.)
const WIFI = /(wi-?fi|wlan|^wl|airport|wireless)/i;
const WIRED = /(ethernet|^eth|^en[0-9ops]|local area connection)/i;

const octets = (ip) => String(ip).split('.').map(Number);
const toInt = (ip) => octets(ip).reduce((n, o) => n * 256 + (o & 255), 0) >>> 0;
const fromInt = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');

// How likely an address is the one the others can reach.
export function addressScore(name, address) {
  const [a, b] = octets(address);
  let s = 0;
  if (a === 169 && b === 254) s -= 100; // (no network: made up on the spot)
  if (a === 100 && b >= 64 && b < 128) s -= 30; // (a carrier's, or a VPN's)
  if (a === 192 && b === 168) s += 15;
  else if (a === 10) s += 10;
  else if (a === 172 && b >= 16 && b < 32) s += 5;
  if (VIRTUAL.test(name)) s -= 50;
  else if (WIFI.test(name)) s += 25;
  else if (WIRED.test(name)) s += 20;
  return s;
}

// This machine's IPv4 addresses on the network, best first:
// [{ name, address, netmask }].
export function rankAddresses(ifaces = os.networkInterfaces()) {
  const out = [];
  for (const [name, list] of Object.entries(ifaces || {})) {
    for (const a of list || []) {
      if ((a.family !== 'IPv4' && a.family !== 4) || a.internal) continue;
      out.push({ name, address: a.address, netmask: a.netmask || '255.255.255.0', score: addressScore(name, a.address) });
    }
  }
  return out.sort((p, q) => q.score - p.score).map(({ name, address, netmask }) => ({ name, address, netmask }));
}

// Which of ours is on the same network as `remote` (to answer them with).
export function addressFor(remote, ranked = rankAddresses()) {
  const r = toInt(String(remote || '').replace(/^::ffff:/, ''));
  for (const a of ranked) {
    const m = toInt(a.netmask);
    if ((toInt(a.address) & m) === (r & m)) return a.address;
  }
  return ranked.length ? ranked[0].address : null;
}

// Where to call out to everyone on each network.
export function broadcastAddresses(ranked = rankAddresses()) {
  const out = new Set(['255.255.255.255']);
  for (const a of ranked) out.add(fromInt((toInt(a.address) | ~toInt(a.netmask)) >>> 0));
  return [...out];
}

// ------------------------------------------------------------ tessera.local
// Multicast DNS (RFC 6762), the little of it needed to answer for one name.
export const MDNS_NAME = 'tessera.local';
const MDNS_GROUP = '224.0.0.251';
const MDNS_PORT = 5353;

function readName(buf, at) {
  const labels = [];
  let i = at;
  let end = -1;
  for (let hops = 0; hops < 32; hops++) {
    if (i >= buf.length) return null;
    const len = buf[i];
    if (len === 0) {
      if (end < 0) end = i + 1;
      return { name: labels.join('.'), next: end };
    }
    if ((len & 0xc0) === 0xc0) {
      if (i + 1 >= buf.length) return null;
      if (end < 0) end = i + 2;
      i = ((len & 0x3f) << 8) | buf[i + 1];
      continue;
    }
    if (i + 1 + len > buf.length) return null;
    labels.push(buf.toString('utf8', i + 1, i + 1 + len));
    i += 1 + len;
  }
  return null;
}

function writeName(name) {
  const parts = [];
  for (const label of String(name).split('.').filter(Boolean)) {
    const b = Buffer.from(label, 'utf8');
    parts.push(Buffer.from([b.length]), b);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

// A question asked on the network: { id, questions: [{ name, type, qu }] },
// or null (an answer, or not DNS at all).
export function parseQuery(buf) {
  if (!buf || buf.length < 12) return null;
  const id = buf.readUInt16BE(0);
  const flags = buf.readUInt16BE(2);
  if (flags & 0x8000) return null;
  const qd = buf.readUInt16BE(4);
  const questions = [];
  let at = 12;
  for (let k = 0; k < qd; k++) {
    const n = readName(buf, at);
    if (!n || n.next + 4 > buf.length) return null;
    const type = buf.readUInt16BE(n.next);
    const cls = buf.readUInt16BE(n.next + 2);
    questions.push({ name: n.name, type, qu: !!(cls & 0x8000) });
    at = n.next + 4;
  }
  return { id, questions };
}

// The question, for a name (as a phone or computer asks it).
export function queryPacket(name, { id = 0, type = 1 } = {}) {
  const head = Buffer.alloc(12);
  head.writeUInt16BE(id, 0);
  head.writeUInt16BE(1, 4);
  const tail = Buffer.alloc(4);
  tail.writeUInt16BE(type, 0);
  tail.writeUInt16BE(1, 2);
  return Buffer.concat([head, writeName(name), tail]);
}

// "That's me, at `address`." `legacy`: to a plain resolver that asked from
// a port of its own (its id and question echoed, a short life, no cache
// flush).
export function answerPacket(name, address, { id = 0, legacy = false, ttl = 120 } = {}) {
  const head = Buffer.alloc(12);
  head.writeUInt16BE(legacy ? id : 0, 0);
  head.writeUInt16BE(0x8400, 2);
  head.writeUInt16BE(legacy ? 1 : 0, 4);
  head.writeUInt16BE(1, 6);
  const nm = writeName(name);
  const parts = [head];
  if (legacy) {
    const q = Buffer.alloc(4);
    q.writeUInt16BE(1, 0);
    q.writeUInt16BE(1, 2);
    parts.push(nm, q);
  }
  const rr = Buffer.alloc(10);
  rr.writeUInt16BE(1, 0);
  rr.writeUInt16BE(legacy ? 1 : 0x8001, 2);
  rr.writeUInt32BE(legacy ? Math.min(ttl, 10) : ttl, 4);
  rr.writeUInt16BE(4, 8);
  parts.push(nm, rr, Buffer.from(octets(address)));
  return Buffer.concat(parts);
}

// The address in an answer for `name` (for the tests, and a quick check).
export function readAnswer(buf, name) {
  if (!buf || buf.length < 12 || !(buf.readUInt16BE(2) & 0x8000)) return null;
  const qd = buf.readUInt16BE(4);
  const an = buf.readUInt16BE(6);
  let at = 12;
  for (let k = 0; k < qd; k++) {
    const n = readName(buf, at);
    if (!n) return null;
    at = n.next + 4;
  }
  for (let k = 0; k < an; k++) {
    const n = readName(buf, at);
    if (!n || n.next + 10 > buf.length) return null;
    const type = buf.readUInt16BE(n.next);
    const len = buf.readUInt16BE(n.next + 8);
    const data = n.next + 10;
    if (type === 1 && len === 4 && n.name.toLowerCase() === name.toLowerCase()) return [...buf.subarray(data, data + 4)].join('.');
    at = data + len;
  }
  return null;
}

// Answer for `name` on the network. The responder, or null (no network,
// or the port isn't to be had): { name, close() }.
export function startMdns({ name = MDNS_NAME, log = null } = {}) {
  let sock;
  try {
    sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  } catch {
    return null;
  }
  const want = name.toLowerCase();
  const send = (pkt, port, host, via = null) => {
    try {
      if (via) sock.setMulticastInterface(via);
      sock.send(pkt, port, host);
    } catch {
      // (That network's gone: never mind.)
    }
  };
  const announce = () => {
    for (const a of rankAddresses()) send(answerPacket(name, a.address), MDNS_PORT, MDNS_GROUP, a.address);
  };
  sock.on('error', () => {
    try {
      sock.close();
    } catch {
      // Closed already.
    }
  });
  sock.on('message', (msg, rinfo) => {
    const q = parseQuery(msg);
    if (!q) return;
    const ask = q.questions.find((x) => x.name.toLowerCase() === want && (x.type === 1 || x.type === 255));
    if (!ask) return;
    const addr = addressFor(rinfo.address);
    if (!addr) return;
    if (rinfo.port !== MDNS_PORT) send(answerPacket(name, addr, { id: q.id, legacy: true }), rinfo.port, rinfo.address);
    else {
      send(answerPacket(name, addr), MDNS_PORT, MDNS_GROUP, addr);
      if (ask.qu) send(answerPacket(name, addr), rinfo.port, rinfo.address);
    }
  });
  try {
    sock.bind(MDNS_PORT, () => {
      try {
        sock.setMulticastTTL(255);
        sock.setMulticastLoopback(true);
        for (const a of rankAddresses()) {
          try {
            sock.addMembership(MDNS_GROUP, a.address);
          } catch {
            // (Not that one.)
          }
        }
      } catch {
        // (No multicast here: the addresses still work.)
      }
      announce();
      if (log) log(name);
    });
  } catch {
    return null;
  }
  return {
    name,
    close: () => {
      try {
        sock.close();
      } catch {
        // Closed already.
      }
    },
  };
}

// ------------------------------------------------------------ worlds nearby
export const DISCOVERY_PORT = 47812;
// (Heard from within this long: still there.)
const NEARBY_MS = 7000;

// What a server hosting a world calls out (or, `world` null, that it's
// stopped).
export function beaconText({ id, v, port, world }) {
  return JSON.stringify({ app: 'tessera', id, v, port, world: world || null });
}

// A call heard: { id, v, port, world }, or null (not ours, or our own).
export function readBeacon(text, selfId = null) {
  let m;
  try {
    m = JSON.parse(String(text));
  } catch {
    return null;
  }
  if (!m || m.app !== 'tessera' || !m.id || m.id === selfId || !Number.isInteger(m.port) || m.port <= 0 || m.port > 65535) return null;
  const w = m.world && typeof m.world === 'object' ? m.world : null;
  const clean = (s, n) => String(s ?? '').slice(0, n);
  // (And the version of the game it's running: round 59. Without it, every
  // world heard of from another computer looked like another version.)
  const world = w ? { name: clean(w.name, 40), hostName: clean(w.hostName, 24), hostIcon: w.hostIcon && typeof w.hostIcon === 'object' ? w.hostIcon : null, players: Math.max(0, Math.min(99, Number(w.players) || 0)), max: Math.max(1, Math.min(99, Number(w.max) || 1)), gv: w.gv ? clean(w.gv, 16) : null } : null;
  return { id: String(m.id), v: Number(m.v) || 0, port: m.port, world };
}

// The worlds heard of lately, each where it's hosted.
export class Nearby {
  constructor() {
    this.seen = new Map();
  }

  heard(b, addr, now = Date.now()) {
    const key = `${addr}:${b.port}`;
    if (!b.world) this.seen.delete(key);
    else this.seen.set(key, { addr, port: b.port, v: b.v, world: b.world, t: now });
  }

  list(now = Date.now()) {
    const out = [];
    for (const [k, e] of this.seen) {
      if (now - e.t > NEARBY_MS) this.seen.delete(k);
      else out.push({ addr: e.addr, port: e.port, v: e.v, world: e.world });
    }
    return out.sort((a, b) => (a.world.name < b.world.name ? -1 : 1));
  }
}

// Call out the world hosted here (every couple of seconds, while there is
// one), and hear the others'. `info()`: what the relay says (see
// Relay.info). The listener, or null: { list(), close() }.
export function startDiscovery({ port: udpPort = DISCOVERY_PORT, info }) {
  let sock;
  try {
    sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  } catch {
    return null;
  }
  const id = crypto.randomBytes(6).toString('hex');
  const nearby = new Nearby();
  let was = false;
  const call = (to = null) => {
    const i = info();
    const world = i.host ? { name: i.host.name, hostName: i.host.hostName, hostIcon: i.host.hostIcon, players: i.host.players, max: i.host.max } : null;
    // (Quiet when there's nothing hosted, but for once to say it's over.)
    if (!world && !was && !to) return;
    was = !!world;
    const pkt = Buffer.from(beaconText({ id, v: i.v, port: i.port, world }));
    for (const host of to ? [to] : broadcastAddresses()) {
      try {
        sock.send(pkt, udpPort, host);
      } catch {
        // (That network's gone.)
      }
    }
  };
  sock.on('error', () => {
    try {
      sock.close();
    } catch {
      // Closed already.
    }
  });
  sock.on('message', (msg, rinfo) => {
    const text = String(msg);
    // (A copy just started, asking who's hosting: told straight away.)
    if (text === 'tessera?') return call(rinfo.address);
    const b = readBeacon(text, id);
    if (b) nearby.heard(b, rinfo.address);
  });
  let timer = null;
  try {
    sock.bind(udpPort, () => {
      try {
        sock.setBroadcast(true);
      } catch {
        // (No calling out here: only hearing.)
      }
      for (const host of broadcastAddresses()) {
        try {
          sock.send(Buffer.from('tessera?'), udpPort, host);
        } catch {
          // (That network's gone.)
        }
      }
      timer = setInterval(() => call(), 2000);
      timer.unref?.();
    });
  } catch {
    return null;
  }
  return {
    list: () => nearby.list(),
    close: () => {
      if (timer) clearInterval(timer);
      try {
        sock.close();
      } catch {
        // Closed already.
      }
    },
  };
}
