// (Round 78) Talking with the others in a world you share: a line typed
// (Enter, in a world with others in it) goes out on one of three channels:
//   - everyone: all of you, wherever you are;
//   - near: those within a hundred paces of you, in the same place;
//   - here: those in the same place as you (out in the world, or down the
//     same old place), however far.
// Tab picks the channel as you type (or /g, /l, /i before the words). The
// host hears everything first and passes each line on only to those who
// should hear it (see HostNet.chat); a guest's line goes to the host.
import { INST_X0 } from '../config.js';

export const CHANNELS = [
  { id: 'global', name: 'Everyone', tag: 'ALL', color: '#e8e0a0', slash: ['g', 'global', 'all'] },
  { id: 'local', name: 'Near (100 paces)', tag: 'NEAR', color: '#a0e0ff', slash: ['l', 'local', 'near'] },
  { id: 'instance', name: 'This place', tag: 'HERE', color: '#c8a8ff', slash: ['i', 'instance', 'here'] },
];
export const CHANNEL_OF = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));
export const LOCAL_RANGE = 100;
const MAX_LEN = 160;

// Which place someone's in: the world above, or the space apart of an old
// place (a dungeon) or the inside of a ship (by where it lies).
export function placeOf(game, e) {
  if (!e) return 'world';
  if (e.x >= INST_X0 && game && game.world && game.world.instAt) {
    const inst = game.world.instAt(e.x);
    return inst ? `inst:${inst.slot ?? 0}` : 'inst';
  }
  return 'world';
}

// Does `to` hear a line `from` says on channel `ch`?
export function hears(game, from, to, ch) {
  if (!from || !to) return false;
  if (from === to) return true;
  if (ch === 'global') return true;
  const a = placeOf(game, from);
  const b = placeOf(game, to);
  if (a !== b) return false;
  if (ch === 'instance') return true;
  return Math.hypot(from.x - to.x, from.z - to.z) <= LOCAL_RANGE;
}

// A line as typed: { ch, text } (a /g, /l or /i before it picks the
// channel), or null if there's nothing to say.
export function parseLine(text, ch = 'global') {
  let t = String(text || '').trim();
  const m = /^\/(\w+)\s*(.*)$/.exec(t);
  if (m) {
    const c = CHANNELS.find((q) => q.slash.includes(m[1].toLowerCase()));
    if (c) {
      ch = c.id;
      t = m[2].trim();
    }
  }
  t = t.replace(/[\u0000-\u001f]/g, '').slice(0, MAX_LEN);
  if (!t) return null;
  return { ch: CHANNEL_OF[ch] ? ch : 'global', text: t };
}

// A line heard, kept for the screen (see ui.drawChat).
export function heard(ui, line) {
  if (!ui) return;
  const log = (ui.chatLog ||= []);
  log.push({ ...line, t: ui.time || 0 });
  while (log.length > 60) log.shift();
  ui.audio?.play('select');
}
