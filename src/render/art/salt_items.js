// (Round 106) What comes out of the Salt Cathedral, drawn by hand (16 by
// 16): a Mother's Tear, a drop of brine set hard and clear as glass, pink
// at its heart, a glint on its upper left.
import { grid } from '../pixart.js';

const ICONS = {
  mothers_tear: {
    pal: { k: '#2a1c24', c: '#6a8aa0', C: '#a8c8dc', w: '#e4f0f8', W: '#ffffff', p: '#a86878', P: '#e0a0b0', q: '#f8d0d8' },
    rows: [
      '................',
      '.......kk.......',
      '......kWck......',
      '......kwck......',
      '.....kwCcck.....',
      '.....kWCCck.....',
      '....kwCCqcck....',
      '....kWCqPpck....',
      '...kwCqPPpcck...',
      '...kwCPPPpcck...',
      '...kCCqPppcck...',
      '...kCCCppcccc...',
      '....kCCcccck....',
      '.....kkcccck....',
      '.......kkkk.....',
      '................',
    ],
  },
};
export function saltIcon(key) {
  const d = ICONS[key];
  return d ? grid(d) : null;
}
