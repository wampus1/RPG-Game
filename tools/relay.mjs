// The LAN relay: the game's own little server (see serve.mjs) passing words
// between the one hosting a world (in a browser on this machine) and the
// players who join it from elsewhere on the same network. It keeps no
// world of its own: the host's browser does that (see src/net/host.js).
// Nothing to install: a small WebSocket server of its own (RFC 6455, text
// frames, ping and close).
import crypto from 'node:crypto';
import { setInterval } from 'node:timers';
import { rankAddresses } from './lan.mjs';
import { MAX_PLAYERS, NET_VERSION, NET_PATH } from '../src/net/protocol.js';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
// (A message bigger than this is someone up to no good: dropped.)
const MAX_MESSAGE = 64 * 1024 * 1024;
// (A connection that's said nothing, not even an answer to a ping, for
// this long is gone: a laptop shut, a browser that died. Its world is let
// go of, so it can be hosted again.)
const QUIET_MS = 45000;
const PING_MS = 15000;

// This machine's addresses on the network (what the others type in), the
// one they can most likely reach first (see lan.mjs).
export function lanAddresses() {
  return rankAddresses().map((a) => a.address);
}

const plainIp = (ip) => String(ip || '').replace(/^::ffff:/, '');
const isLoopback = (ip) => ['127.0.0.1', '::1', 'localhost'].includes(plainIp(ip)) || plainIp(ip).startsWith('127.');

// One WebSocket connection, server side.
class Sock {
  constructor(socket, ip) {
    this.socket = socket;
    this.ip = plainIp(ip);
    this.open = true;
    this.buf = Buffer.alloc(0);
    this.parts = [];
    this.onmessage = null;
    this.onclose = null;
    this.heard = Date.now();
    socket.setNoDelay?.(true);
    socket.on('data', (d) => {
      this.heard = Date.now();
      this.data(d);
    });
    socket.on('close', () => this.closed());
    socket.on('error', () => this.closed());
  }

  data(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const op = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let at = 2;
      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2);
        at = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        len = Number(b.readBigUInt64BE(2));
        at = 10;
      }
      if (len > MAX_MESSAGE) return this.close(1009, 'too big');
      const maskAt = at;
      if (masked) at += 4;
      if (b.length < at + len) return;
      let payload = b.subarray(at, at + len);
      if (masked) {
        const mask = b.subarray(maskAt, maskAt + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = b.subarray(at + len);
      if (op === 0x8) return this.close(1000, '');
      if (op === 0x9) {
        this.frame(0xa, payload);
        continue;
      }
      if (op === 0xa) continue;
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        this.parts.push(payload);
        if (fin) {
          const text = Buffer.concat(this.parts).toString('utf8');
          this.parts = [];
          try {
            this.onmessage?.(text);
          } catch (e) {
            console.error('relay:', e);
          }
        }
      }
    }
  }

  frame(op, payload) {
    if (!this.open) return;
    const n = payload.length;
    let head;
    if (n < 126) head = Buffer.from([0x80 | op, n]);
    else if (n < 65536) {
      head = Buffer.alloc(4);
      head[0] = 0x80 | op;
      head[1] = 126;
      head.writeUInt16BE(n, 2);
    } else {
      head = Buffer.alloc(10);
      head[0] = 0x80 | op;
      head[1] = 127;
      head.writeBigUInt64BE(BigInt(n), 2);
    }
    this.socket.write(Buffer.concat([head, payload]));
  }

  send(text) {
    this.frame(0x1, Buffer.from(text, 'utf8'));
  }

  json(msg) {
    this.send(JSON.stringify(msg));
  }

  close(code = 1000, why = '') {
    if (!this.open) return;
    const r = Buffer.from(why, 'utf8');
    const p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code, 0);
    r.copy(p, 2);
    this.frame(0x8, p);
    this.open = false;
    this.socket.end();
    this.closed();
  }

  closed() {
    if (this.gone) return;
    this.gone = true;
    this.open = false;
    try {
      this.socket.destroy();
    } catch {
      // Already gone.
    }
    this.onclose?.();
  }
}

// The relay: at most one host, a few players in its world, and anyone
// waiting at the title screen (so an invitation can find them).
export class Relay {
  // `extra()`: more to say in info (the name this machine answers to, and
  // worlds hosted elsewhere on the network: see serve.mjs).
  constructor({ port = 8080, max = MAX_PLAYERS, addrs = lanAddresses, extra = null } = {}) {
    this.port = port;
    this.max = max;
    this.addrs = addrs;
    this.extra = extra;
    this.host = null;
    this.world = null;
    this.guests = new Map(); // cid -> { sock, account }
    this.lobby = new Set(); // { sock, account }
    this.bans = { ids: new Set(), ips: new Set() };
    this.nextCid = 1;
    this.socks = new Set();
    this.beatT = null;
  }

  // Every connection pinged now and then (a browser answers by itself);
  // those long silent, closed.
  beat(now = Date.now()) {
    for (const s of this.socks) {
      if (!s.open) this.socks.delete(s);
      else if (now - s.heard > QUIET_MS) {
        this.socks.delete(s);
        s.closed();
      } else s.frame(0x9, Buffer.alloc(0));
    }
  }

  // What /api/lan says: where this machine is, and the world hosted here.
  info() {
    const h = this.host && this.world;
    return {
      v: NET_VERSION,
      port: this.port,
      addrs: this.addrs(),
      max: this.max,
      host: h ? { ...this.world, players: this.guests.size + 1, max: this.max } : null,
      ...(this.extra ? this.extra() : {}),
    };
  }

  // An HTTP upgrade request: a WebSocket for the relay, or not ours.
  upgrade(req, socket) {
    const url = new URL(req.url, 'http://x');
    const key = req.headers['sec-websocket-key'];
    if (url.pathname !== NET_PATH || !key) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return null;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const sock = new Sock(socket, req.socket.remoteAddress);
    this.socks.add(sock);
    if (!this.beatT) {
      this.beatT = setInterval(() => this.beat(), PING_MS);
      this.beatT.unref?.();
    }
    sock.onmessage = (text) => this.first(sock, text);
    return sock;
  }

  // The first word from a new connection says who it is.
  first(sock, text) {
    let m;
    try {
      m = JSON.parse(text);
    } catch {
      return sock.close(1002, 'bad hello');
    }
    if (!m || m.t !== 'hello') return sock.close(1002, 'bad hello');
    if (m.v !== NET_VERSION) {
      sock.json({ t: 'refused', why: 'version' });
      return sock.close(1000, 'version');
    }
    const account = cleanAccount(m.account);
    if (m.role === 'host') return this.hostHello(sock, m, account);
    if (m.role === 'guest') return this.guestHello(sock, account);
    if (m.role === 'lobby') return this.lobbyHello(sock, account);
    sock.close(1002, 'bad role');
  }

  // Only this machine's own browser may host here.
  hostHello(sock, m, account) {
    const mine = isLoopback(sock.ip) || this.addrs().includes(sock.ip);
    if (!mine) {
      sock.json({ t: 'refused', why: 'not this machine' });
      return sock.close(1000, 'not local');
    }
    if (this.host && this.host.sock.open) {
      sock.json({ t: 'refused', why: 'busy' });
      return sock.close(1000, 'busy');
    }
    this.host = { sock, account };
    this.world = { ...(m.world || {}), hostName: account.name, hostIcon: account.icon, hostId: account.id };
    this.setBans(m.bans);
    sock.onmessage = (text) => this.fromHost(text);
    sock.onclose = () => this.hostGone(sock);
    sock.json({ t: 'hosting', ...this.info() });
    this.tellLobby();
    console.log(`Hosting "${this.world.name || 'a world'}" for the LAN: ${this.addrs().map((a) => `http://${a}:${this.port}`).join(', ') || '(no network found)'}`);
  }

  guestHello(sock, account) {
    const why = !this.host ? 'nohost' : this.banned(account.id, sock.ip) ? 'banned' : this.guests.size + 1 >= this.max ? 'full' : null;
    if (why) {
      sock.json({ t: 'refused', why });
      return sock.close(1000, why);
    }
    const cid = this.nextCid++;
    const g = { sock, account, cid };
    this.guests.set(cid, g);
    sock.onmessage = (text) => {
      if (this.host) this.host.sock.send(`@${cid}|${text}`);
    };
    sock.onclose = () => {
      if (this.guests.get(cid) !== g) return;
      this.guests.delete(cid);
      if (this.host) this.host.sock.send(`!${JSON.stringify({ t: 'left', cid })}`);
      this.tellLobby();
    };
    this.host.sock.send(`!${JSON.stringify({ t: 'join', cid, account, ip: sock.ip })}`);
    this.tellLobby();
  }

  // Someone at the title screen: told whether a world's hosted here, and
  // found by an invitation.
  lobbyHello(sock, account) {
    const me = { sock, account };
    this.lobby.add(me);
    sock.onmessage = (text) => {
      let m;
      try {
        m = JSON.parse(text);
      } catch {
        return;
      }
      if (m.t === 'answer' && this.host) this.host.sock.send(`!${JSON.stringify({ t: 'answer', from: account, yes: !!m.yes })}`);
    };
    sock.onclose = () => {
      this.lobby.delete(me);
      this.tellHostLobby();
    };
    sock.json({ t: 'host', host: this.info().host });
    this.tellHostLobby();
  }

  fromHost(text) {
    const c = text[0];
    if (c === '@') {
      const bar = text.indexOf('|');
      const g = this.guests.get(+text.slice(1, bar));
      if (g) g.sock.send(text.slice(bar + 1));
    } else if (c === '*') {
      const body = text.slice(2);
      for (const g of this.guests.values()) g.sock.send(body);
    } else if (c === '!') {
      let m;
      try {
        m = JSON.parse(text.slice(1));
      } catch {
        return;
      }
      this.control(m);
    }
  }

  control(m) {
    if (m.t === 'kick' || m.t === 'refuse') {
      const g = this.guests.get(m.cid);
      if (!g) return;
      g.sock.json({ t: m.t === 'kick' ? 'kicked' : 'refused', why: m.why || '' });
      this.guests.delete(m.cid);
      g.sock.close(1000, m.t);
      this.tellLobby();
    } else if (m.t === 'bans') this.setBans(m);
    else if (m.t === 'world') {
      this.world = { ...this.world, ...m.world };
      this.tellLobby();
    } else if (m.t === 'invite') {
      for (const q of this.lobby) if (q.account.id === m.to) q.sock.json({ t: 'invite', ...m.invite });
    } else if (m.t === 'lobby?') this.tellHostLobby();
  }

  setBans(b) {
    if (!b) return;
    this.bans = { ids: new Set(b.ids || []), ips: new Set(b.ips || []) };
  }

  banned(id, ip) {
    return this.bans.ids.has(id) || this.bans.ips.has(ip);
  }

  hostGone(sock) {
    if (!this.host || this.host.sock !== sock) return;
    this.host = null;
    this.world = null;
    for (const g of this.guests.values()) {
      g.sock.json({ t: 'hostgone' });
      g.sock.close(1000, 'host gone');
    }
    this.guests.clear();
    this.tellLobby();
  }

  // Those at the title screen: is there a world here to join?
  tellLobby() {
    const host = this.info().host;
    for (const q of this.lobby) q.sock.json({ t: 'host', host });
  }

  // The host: who's at the title screen (to invite).
  tellHostLobby() {
    if (!this.host) return;
    const list = [...this.lobby].map((q) => q.account);
    this.host.sock.send(`!${JSON.stringify({ t: 'lobby', list })}`);
  }
}

// Only what an account says about itself, kept short.
function cleanAccount(a) {
  a = a && typeof a === 'object' ? a : {};
  return {
    id: String(a.id || '').slice(0, 64),
    name: String(a.name || 'Wanderer').slice(0, 20),
    icon: a.icon && typeof a.icon === 'object' ? { shape: String(a.icon.shape || '').slice(0, 20), color: String(a.icon.color || '').slice(0, 9), bg: String(a.icon.bg || '').slice(0, 9), pattern: String(a.icon.pattern || '').slice(0, 12), frame: String(a.icon.frame || '').slice(0, 12) } : null,
    desc: String(a.desc || '').slice(0, 400),
    title: String(a.title || '').slice(0, 24),
  };
}
