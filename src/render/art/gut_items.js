// (Round 105) What comes out of the Leviathan's Gut, drawn by hand (16 by
// 16): ambergris, a lump of grey wax, marbled paler, specked dark with
// the beaks it was made round, lit on its upper left.
import { grid } from '../pixart.js';

const ICONS = {
  ambergris: {
    pal: { k: '#1a1814', a: '#3a3830', A: '#5a564c', m: '#7e786a', M: '#a49e8c', W: '#cec8b4', n: '#24201a' },
    rows: [
      '................',
      '................',
      '................',
      '.....kkkk.......',
      '...kkMWWMkk.....',
      '..kMWMMmmAkkk...',
      '..kWMmAmnmMMAk..',
      '.kMMmAAmmmMmAak.',
      '.kMmAnAmmAmmAak.',
      '.kmAAAmmAAnAAak.',
      '.kAmAAAAAAAAaak.',
      '..kAAaAAnAaaak..',
      '..kkaaaaaaaakk..',
      '....kkkkkkkk....',
      '................',
      '................',
    ],
  },
};
export function gutIcon(key) {
  const d = ICONS[key];
  return d ? grid(d) : null;
}
