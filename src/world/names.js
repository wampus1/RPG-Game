// Culture-flavoured name generators for civilizations, settlements and people.

export const CULTURES = {
  vale: {
    label: 'Valeborn',
    placePre: ['Ash', 'Oak', 'Elm', 'Thorn', 'Brook', 'Mill', 'Stone', 'Wolf', 'Raven', 'Bram', 'Hollow', 'Green', 'Fair', 'Clay', 'Red', 'Wil', 'Hart', 'Hay', 'Kings', 'Mor', 'Bright', 'Sheep', 'Apple', 'Wyn'],
    placeSuf: ['ford', 'wick', 'ton', 'ham', 'dale', 'field', 'stead', 'bury', 'mere', 'worth', 'holm', 'ley', 'brook', 'cross', 'well', 'gate'],
    first: ['Ada', 'Bram', 'Cora', 'Edda', 'Finn', 'Gwen', 'Hal', 'Ivy', 'Jory', 'Kit', 'Lark', 'Mabel', 'Ned', 'Olive', 'Pip', 'Quinn', 'Rowan', 'Sage', 'Tam', 'Una', 'Wren', 'Alder', 'Bess', 'Colm', 'Dell', 'Elsie', 'Garth', 'Hazel', 'Jem', 'Marl', 'Nell', 'Oswin', 'Perry', 'Rue', 'Tobin', 'Vera'],
    lastPre: ['Ash', 'Black', 'Brook', 'Cotton', 'Fair', 'Green', 'Hay', 'Mill', 'Oak', 'Thatch', 'Under', 'White', 'Hill', 'Fern', 'Tall'],
    lastSuf: ['wood', 'field', 'er', 'ley', 'hill', 'ford', 'smith', 'well', 'croft', 'ton', 'by', 'wright'],
  },
  north: {
    label: 'Nordvolk',
    placePre: ['Frost', 'Ulf', 'Skal', 'Vard', 'Hrim', 'Bjorn', 'Sig', 'Kald', 'Rav', 'Tor', 'Grim', 'Isk', 'Hvit', 'Stor', 'Jarn'],
    placeSuf: ['heim', 'vik', 'gard', 'stad', 'fell', 'holt', 'by', 'fjord', 'mark', 'havn', 'nes', 'dal'],
    first: ['Astrid', 'Bjorn', 'Dagny', 'Eirik', 'Frida', 'Gunnar', 'Hilde', 'Ingrid', 'Jorund', 'Kari', 'Leif', 'Runa', 'Sigrun', 'Torvald', 'Ulla', 'Vidar', 'Yrsa', 'Arne', 'Brynja', 'Hakon', 'Solveig', 'Ragna', 'Stig', 'Tove'],
    lastPre: ['Iron', 'Frost', 'Storm', 'Snow', 'Bear', 'Wolf', 'Elk', 'Ice', 'Stone', 'Ash'],
    lastSuf: ['sen', 'dottir', 'son', 'blade', 'mane', 'hand', 'heart', 'beard'],
  },
  sun: {
    label: 'Sunreach',
    placePre: ['Al-Qa', 'Zar', 'Sa', 'Ka', 'Ras', 'Mir', 'Dah', 'Tam', 'Jub', 'Sha', 'Nu', 'Ha', 'Bel', 'Qa'],
    placeSuf: ['abad', 'qar', 'ir', 'ara', 'esh', 'un', 'ahar', 'zim', 'oum', 'kesh', 'rim', 'ad'],
    first: ['Amir', 'Basra', 'Dalia', 'Farid', 'Hana', 'Idris', 'Jamal', 'Kamila', 'Layla', 'Malik', 'Nadia', 'Omar', 'Rania', 'Samir', 'Tariq', 'Yara', 'Zahir', 'Suha', 'Karim', 'Noor', 'Rafi', 'Salma'],
    lastPre: ['al-', 'ibn ', 'bint ', 'el-'],
    lastSuf: ['Rashid', 'Qadir', 'Najm', 'Samar', 'Harith', 'Zayn', 'Fahd', 'Mansur', 'Sahir'],
  },
  wild: {
    label: 'Verdani',
    placePre: ['Xa', 'Tla', 'Ix', 'Co', 'Mo', 'Pa', 'Ata', 'Qui', 'Olo', 'Tza', 'Chal', 'Yax'],
    placeSuf: ['pan', 'tlan', 'co', 'hua', 'mal', 'tepec', 'xal', 'oca', 'quen', 'lan', 'ba'],
    first: ['Itza', 'Xochi', 'Tupa', 'Nahu', 'Yaretz', 'Cualli', 'Ixel', 'Tonal', 'Mayel', 'Coatl', 'Neza', 'Atl', 'Citlal', 'Oxi', 'Paqo', 'Yolo', 'Tiko', 'Ameyal'],
    lastPre: ['Jade', 'Rain', 'Sun', 'Moon', 'River', 'Vine', 'Stone', 'Fire'],
    lastSuf: ['walker', 'song', 'feather', 'tooth', 'root', 'bloom', 'eye', 'tail'],
  },
  high: {
    label: 'Kharduum',
    placePre: ['Dun', 'Kar', 'Bar', 'Thal', 'Gor', 'Dur', 'Mag', 'Brom', 'Khaz', 'Orn', 'Grund'],
    placeSuf: ['hold', 'mount', 'crag', 'peak', 'deep', 'forge', 'gate', 'spire', 'rock', 'hall'],
    first: ['Borin', 'Dagna', 'Durek', 'Helga', 'Korra', 'Magni', 'Nori', 'Orla', 'Rurik', 'Sigga', 'Thrain', 'Vala', 'Brenna', 'Gundi', 'Hjal', 'Kili', 'Marta', 'Thora'],
    lastPre: ['Stone', 'Deep', 'Iron', 'Coal', 'Gold', 'Anvil', 'Granite', 'Copper'],
    lastSuf: ['fist', 'delver', 'beard', 'hammer', 'shield', 'helm', 'vein', 'forge'],
  },
};

export const CIV_TITLES = ['Kingdom', 'Dominion', 'Republic', 'Confederacy', 'Principality', 'Commonwealth', 'Duchy', 'League'];

export function placeName(rng, culture) {
  const c = CULTURES[culture];
  let name = rng.pick(c.placePre) + rng.pick(c.placeSuf);
  if (name.includes('-')) {
    const [a, b] = name.split('-');
    name = `${a}-${b[0].toUpperCase()}${b.slice(1)}`;
  }
  return name;
}

export function personName(rng, culture, family) {
  const c = CULTURES[culture];
  const first = rng.pick(c.first);
  return { first, last: family || familyName(rng, culture) };
}

export function familyName(rng, culture) {
  const c = CULTURES[culture];
  const pre = rng.pick(c.lastPre);
  const suf = rng.pick(c.lastSuf);
  if (pre.endsWith(' ') || pre.endsWith('-')) return pre + suf;
  return pre + suf.toLowerCase();
}
