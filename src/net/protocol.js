// What the host's browser, the LAN relay (tools/relay.mjs) and the players'
// browsers agree on: how many may play in one world, and the version of
// the conversation (a player on an older copy of the game is turned away
// rather than half-working).
//
// The host's browser keeps the one true world and runs it; the others
// send what they press and are sent what they'd see (see host.js and
// guest.js). The relay only passes the words along:
//   host -> relay  "@<cid>|<json>" to one player, "*|<json>" to all of
//                  them, "!<json>" for the relay itself (kick, ban, ...)
//   relay -> host  "@<cid>|<json>" from a player, "!<json>" from the relay
//   player <-> relay  plain json both ways.

// Players in a world at once, the host among them. (Kept in one place so
// it can be raised: nothing else counts on four.)
export const MAX_PLAYERS = 4;
export const NET_VERSION = 1;
// The relay's address on the game's own server.
export const NET_PATH = '/net';
export const LAN_PATH = '/api/lan';

// Split an envelope from the relay (host side): { cid, body } for a
// player's message, { ctl } for the relay's own.
export function openEnvelope(text) {
  if (text[0] === '!') return { ctl: JSON.parse(text.slice(1)) };
  if (text[0] === '@') {
    const bar = text.indexOf('|');
    return { cid: +text.slice(1, bar), body: text.slice(bar + 1) };
  }
  return { ctl: { t: 'bad' } };
}

export const toPlayer = (cid, body) => `@${cid}|${body}`;
export const toAll = (body) => `*|${body}`;
export const toRelay = (msg) => `!${JSON.stringify(msg)}`;
