// (Round 95) The barrows' gold, drawn by hand (16 by 16).
import { grid } from '../pixart.js';

const GOLD = { k: '#2a1a06', y: '#7a5414', Y: '#b8862a', Z: '#e8bc48', W: '#fff0a0', g: '#5a3a10' };
const ICONS = {
  // A torc: twisted gold, open at the front, a knob at each end.
  gold_torc: {
    pal: GOLD,
    rows: [
      '................',
      '................',
      '.....kkkkkk.....',
      '...kkZWYZWYkk...',
      '..kZYkkkkkkYZk..',
      '.kWYk......kYWk.',
      '.kZk........kZk.',
      'kYZk........kZYk',
      'kZYk........kYZk',
      '.kZk........kZk.',
      '.kYZk......kZYk.',
      '..kYk......kYk..',
      '..kWZk....kZWk..',
      '...kYk....kYk...',
      '....k......k....',
      '................',
    ],
  },
  // An arm-ring: three coils of gold, stamped.
  arm_ring: {
    pal: GOLD,
    rows: [
      '................',
      '................',
      '................',
      '....kkkkkkkk....',
      '..kkZWZYZWZYkk..',
      '.kZYkkkkkkkkYZk.',
      '.kYkkkkkkkkkkYk.',
      '.kZWZYZWZYZWZZk.',
      '.kYkkkkkkkkkkYk.',
      '.kkZYkkkkkkYZkk.',
      '.kYZWZYZWZYZWYk.',
      '..kkYgYgYgYgkk..',
      '....kkkkkkkk....',
      '................',
      '................',
      '................',
    ],
  },
};
export function barrowIcon(key) {
  const d = ICONS[key];
  return d ? grid(d) : null;
}
