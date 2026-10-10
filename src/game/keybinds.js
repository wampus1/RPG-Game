// (Round 77) The controls, rebindable. Each action has the key it's always
// had (its "own" key: what the rest of the game listens for) and the key
// the player's chosen for it. Input turns a key pressed into the own key of
// whatever it's bound to, so nothing else needs to know: press N for the
// map, and the map hears KeyM.
//   Kept in the browser between games (see Settings: Controls).
import { appStorage } from '../util/appstore.js';

export const KEYBINDS_KEY = 'tessera-keybinds';

export const ACTIONS = [
  { id: 'up', label: 'Move up', group: 'Moving', def: 'KeyW' },
  { id: 'down', label: 'Move down', group: 'Moving', def: 'KeyS' },
  { id: 'left', label: 'Move left', group: 'Moving', def: 'KeyA' },
  { id: 'right', label: 'Move right', group: 'Moving', def: 'KeyD' },
  { id: 'sprint', label: 'Sprint (hold)', group: 'Moving', def: 'ShiftLeft' },
  { id: 'roll', label: 'Roll / reel in', group: 'Moving', def: 'Space' },
  { id: 'turnL', label: 'Turn view left', group: 'Moving', def: 'KeyQ' },
  { id: 'turnR', label: 'Turn view right', group: 'Moving', def: 'KeyE' },
  { id: 'use', label: 'Use / interact', group: 'Doing', def: 'KeyF' },
  { id: 'rotate', label: 'Rotate block', group: 'Doing', def: 'KeyR' },
  { id: 'toss', label: 'Throw item', group: 'Doing', def: 'KeyG' },
  { id: 'wait', label: 'Wait (sitting)', group: 'Doing', def: 'KeyT' },
  { id: 'layerDown', label: 'Build layer down', group: 'Doing', def: 'KeyZ' },
  { id: 'layerUp', label: 'Build layer up', group: 'Doing', def: 'KeyX' },
  { id: 'layerAuto', label: 'Build layer auto', group: 'Doing', def: 'KeyV' },
  { id: 'bag', label: 'Bag', group: 'Windows', def: 'Tab' },
  { id: 'craft', label: 'Crafting', group: 'Windows', def: 'KeyC' },
  { id: 'map', label: 'Map', group: 'Windows', def: 'KeyM' },
  { id: 'journal', label: 'Journal', group: 'Windows', def: 'KeyJ' },
  { id: 'quests', label: 'Quest log', group: 'Windows', def: 'KeyO' },
  { id: 'feats', label: 'Achievements', group: 'Windows', def: 'KeyL' },
  { id: 'help', label: 'How to play', group: 'Windows', def: 'KeyH' },
  { id: 'party', label: 'Multiplayer (in a world)', group: 'Windows', def: 'KeyP' },
  { id: 'console', label: 'Command console', group: 'Windows', def: 'Backquote' },
  { id: 'crt', label: 'CRT effect on/off', group: 'Windows', def: 'F2' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: `belt${n}`, label: `Belt slot ${n}`, group: 'Belt', def: `Digit${n}` })),
];
const BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

// The player's choices: action id -> key code (only those changed).
let chosen = {};
// Key pressed -> the own key it stands for (null: nothing).
let table = new Map();

function rebuild() {
  table = new Map();
  for (const a of ACTIONS) table.set(keyOf(a.id), a.def);
  // (A key that was an action's own and is now bound to nothing does
  // nothing; its action's moved elsewhere.)
  for (const a of ACTIONS) if (!table.has(a.def)) table.set(a.def, null);
}

// The key an action's on now.
export function keyOf(id) {
  const a = BY_ID.get(id);
  return (a && chosen[id]) || (a ? a.def : null);
}

// What a key pressed stands for: the own key of the action it's bound to,
// or the key itself if it's no action's (letters typed, arrows, Escape).
export function remapKey(code) {
  if (!table.has(code)) return code;
  const v = table.get(code);
  return v === null ? `Unbound:${code}` : v;
}

// Bind `id` to `code`; whatever had that key takes this one's old key.
export function bind(id, code, storage = appStorage()) {
  const a = BY_ID.get(id);
  if (!a || !code || ['Escape', 'Enter', 'Backspace', 'F1', 'F3'].includes(code)) return false;
  const old = keyOf(id);
  for (const b of ACTIONS) {
    if (b.id !== id && keyOf(b.id) === code) {
      if (old === b.def) delete chosen[b.id];
      else chosen[b.id] = old;
    }
  }
  if (code === a.def) delete chosen[id];
  else chosen[id] = code;
  rebuild();
  saveKeybinds(storage);
  return true;
}

export function resetKeybinds(storage = appStorage()) {
  chosen = {};
  rebuild();
  saveKeybinds(storage);
}

export function loadKeybinds(storage = appStorage()) {
  try {
    const got = JSON.parse(storage && storage.getItem(KEYBINDS_KEY)) || {};
    chosen = {};
    for (const [k, v] of Object.entries(got)) if (BY_ID.has(k) && typeof v === 'string') chosen[k] = v;
  } catch {
    chosen = {};
  }
  rebuild();
}

export function saveKeybinds(storage = appStorage()) {
  try {
    storage && storage.setItem(KEYBINDS_KEY, JSON.stringify(chosen));
  } catch {
    // Not kept: they still hold for this session.
  }
}

// A key's name as shown.
const NAMES = {
  ShiftLeft: 'Shift', ShiftRight: 'R-Shift', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', AltRight: 'R-Alt', Space: 'Space', Tab: 'Tab',
  Backquote: '`', Slash: '/', Backslash: '\\', Comma: ',', Period: '.', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=',
  Enter: 'Enter', Backspace: 'Backspace', CapsLock: 'Caps', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}
export const actionKeyName = (id) => keyName(keyOf(id));

rebuild();
