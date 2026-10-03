// Culture-flavoured name generators for civilizations, settlements and people.

export const CULTURES = {
  vale: {
    label: 'Valeborn',
    civ: ['Shire', 'Marches', 'Crown', 'Free Towns'],
    placePre: ['Ash', 'Oak', 'Elm', 'Thorn', 'Brook', 'Mill', 'Stone', 'Wolf', 'Raven', 'Bram', 'Hollow', 'Green', 'Fair', 'Clay', 'Red', 'Wil', 'Hart', 'Hay', 'Kings', 'Mor', 'Bright', 'Sheep', 'Apple', 'Wyn'],
    placeSuf: ['ford', 'wick', 'ton', 'ham', 'dale', 'field', 'stead', 'bury', 'mere', 'worth', 'holm', 'ley', 'brook', 'cross', 'well', 'gate'],
    first: ['Ada', 'Bram', 'Cora', 'Edda', 'Finn', 'Gwen', 'Hal', 'Ivy', 'Jory', 'Kit', 'Lark', 'Mabel', 'Ned', 'Olive', 'Pip', 'Quinn', 'Rowan', 'Sage', 'Tam', 'Una', 'Wren', 'Alder', 'Bess', 'Colm', 'Dell', 'Elsie', 'Garth', 'Hazel', 'Jem', 'Marl', 'Nell', 'Oswin', 'Perry', 'Rue', 'Tobin', 'Vera', 'Abel', 'Agnes', 'Alys', 'Barnaby', 'Beatrix', 'Benedict', 'Briar', 'Cecily', 'Clement', 'Daisy', 'Dunstan', 'Edric', 'Elowen', 'Emmet', 'Esme', 'Fern', 'Florence', 'Giles', 'Godric', 'Hattie', 'Hugh', 'Imogen', 'Isolde', 'Jasper', 'Josie', 'Lettie', 'Linus', 'Maud', 'Merritt', 'Milo', 'Nettie', 'Orrin', 'Posy', 'Reuben', 'Rosalind', 'Silas', 'Tabitha', 'Tilly', 'Ulric', 'Walter', 'Winnie', 'Yarrow'],
    lastPre: ['Ash', 'Black', 'Brook', 'Cotton', 'Fair', 'Green', 'Hay', 'Mill', 'Oak', 'Thatch', 'Under', 'White', 'Hill', 'Fern', 'Tall', 'Apple', 'Barley', 'Birch', 'Bramble', 'Brown', 'Burrow', 'Crab', 'Dun', 'Ember', 'Gold', 'Harrow', 'Holly', 'Long', 'Marsh', 'Moss', 'North', 'Rook', 'Rush', 'Shep', 'Stock', 'Swan', 'Thorn', 'Upton', 'West', 'Willow', 'Wool'],
    lastSuf: ['wood', 'field', 'er', 'ley', 'hill', 'ford', 'smith', 'well', 'croft', 'ton', 'by', 'wright', 'bottom', 'bridge', 'combe', 'dean', 'hurst', 'more', 'shaw', 'stone', 'wick', 'worth', 'man', 'thorpe', 'gate'],
    lastWhole: ['Baker', 'Bowyer', 'Carter', 'Chandler', 'Cooper', 'Dyer', 'Fletcher', 'Fuller', 'Glover', 'Hayward', 'Hooper', 'Mason', 'Miller', 'Potter', 'Reeve', 'Sawyer', 'Shepherd', 'Tanner', 'Thatcher', 'Turner', 'Weaver', 'Webb'],
  },
  north: {
    label: 'Nordvolk',
    civ: ['Jarldom', 'Clans', 'Thanedom', 'Sea-Kingdom', 'Hold'],
    placePre: ['Frost', 'Ulf', 'Skal', 'Vard', 'Hrim', 'Bjorn', 'Sig', 'Kald', 'Rav', 'Tor', 'Grim', 'Isk', 'Hvit', 'Stor', 'Jarn'],
    placeSuf: ['heim', 'vik', 'gard', 'stad', 'fell', 'holt', 'by', 'fjord', 'mark', 'havn', 'nes', 'dal'],
    first: ['Astrid', 'Bjorn', 'Dagny', 'Eirik', 'Frida', 'Gunnar', 'Hilde', 'Ingrid', 'Jorund', 'Kari', 'Leif', 'Runa', 'Sigrun', 'Torvald', 'Ulla', 'Vidar', 'Yrsa', 'Arne', 'Brynja', 'Hakon', 'Solveig', 'Ragna', 'Stig', 'Tove', 'Agnar', 'Alva', 'Asa', 'Bodil', 'Dag', 'Eydis', 'Finnur', 'Geir', 'Gudrun', 'Halla', 'Harald', 'Hedda', 'Idunn', 'Ivar', 'Jorunn', 'Ketil', 'Liv', 'Magnhild', 'Njal', 'Oddny', 'Orm', 'Ragnar', 'Rolf', 'Saga', 'Sten', 'Svala', 'Thyra', 'Ulf', 'Valdis', 'Vigdis', 'Yngvar', 'Aslaug', 'Bergljot', 'Grim', 'Halvard', 'Sigurd'],
    lastPre: ['Iron', 'Frost', 'Storm', 'Snow', 'Bear', 'Wolf', 'Elk', 'Ice', 'Stone', 'Ash', 'Raven', 'Horn', 'Salt', 'Oak', 'Fjell', 'Grey', 'Hawk', 'Rune', 'Sea', 'Wind', 'Thunder', 'Birch', 'Moss', 'Hammer'],
    lastSuf: ['sen', 'dottir', 'son', 'blade', 'mane', 'hand', 'heart', 'beard', 'born', 'strand', 'vik', 'gard', 'shield', 'fell', 'brand', 'helm', 'ward', 'tooth', 'wing'],
    lastWhole: ['Halvorsen', 'Magnusson', 'Olafsdottir', 'Eriksen', 'Haraldsen', 'Sigurdsson', 'Thorsdottir', 'Gunnarsen', 'Bjornsdottir', 'Ivarsson'],
  },
  sun: {
    label: 'Sunreach',
    civ: ['Sultanate', 'Emirate', 'Caliphate', 'Satrapy', 'Free Cities'],
    placePre: ['Al-Qa', 'Zar', 'Sa', 'Ka', 'Ras', 'Mir', 'Dah', 'Tam', 'Jub', 'Sha', 'Nu', 'Ha', 'Bel', 'Qa'],
    placeSuf: ['abad', 'qar', 'ir', 'ara', 'esh', 'un', 'ahar', 'zim', 'oum', 'kesh', 'rim', 'ad'],
    first: ['Amir', 'Basra', 'Dalia', 'Farid', 'Hana', 'Idris', 'Jamal', 'Kamila', 'Layla', 'Malik', 'Nadia', 'Omar', 'Rania', 'Samir', 'Tariq', 'Yara', 'Zahir', 'Suha', 'Karim', 'Noor', 'Rafi', 'Salma', 'Adil', 'Aisha', 'Anwar', 'Asma', 'Bashir', 'Dina', 'Fatin', 'Ghalib', 'Habib', 'Hala', 'Imran', 'Jalila', 'Khalid', 'Lina', 'Mounir', 'Nabil', 'Qamar', 'Rashida', 'Safiya', 'Selim', 'Shadi', 'Tahira', 'Usama', 'Wafa', 'Yasin', 'Zaina', 'Zubair', 'Farah', 'Hamza', 'Inas', 'Munira', 'Sami'],
    lastPre: ['al-', 'ibn ', 'bint ', 'el-', 'al-', 'ibn ', 'bint ', 'el-', 'abu ', 'an-'],
    lastSuf: ['Rashid', 'Qadir', 'Najm', 'Samar', 'Harith', 'Zayn', 'Fahd', 'Mansur', 'Sahir', 'Rashid', 'Qadir', 'Najm', 'Samar', 'Harith', 'Zayn', 'Fahd', 'Mansur', 'Sahir', 'Hakim', 'Jabir', 'Karam', 'Latif', 'Nasir', 'Qasim', 'Rahim', 'Sabir', 'Tahir', 'Wahid', 'Yusuf', 'Zahra', 'Badr', 'Hilal'],
    lastWhole: ['Haddad', 'Sabbagh', 'Najjar', 'Attar', 'Khayyat', 'Sayegh', 'Tamimi', 'Masri'],
  },
  wild: {
    label: 'Verdani',
    civ: ['Tribes', 'Confederacy of Clans', 'Sun-Throne', 'Serpent Council'],
    placePre: ['Xa', 'Tla', 'Ix', 'Co', 'Mo', 'Pa', 'Ata', 'Qui', 'Olo', 'Tza', 'Chal', 'Yax'],
    placeSuf: ['pan', 'tlan', 'co', 'hua', 'mal', 'tepec', 'xal', 'oca', 'quen', 'lan', 'ba'],
    first: ['Itza', 'Xochi', 'Tupa', 'Nahu', 'Yaretz', 'Cualli', 'Ixel', 'Tonal', 'Mayel', 'Coatl', 'Neza', 'Atl', 'Citlal', 'Oxi', 'Paqo', 'Yolo', 'Tiko', 'Ameyal', 'Anacaona', 'Ayotl', 'Chimal', 'Cuetlachtli', 'Eztli', 'Huitzil', 'Ichtaca', 'Itzel', 'Izel', 'Mazatl', 'Metztli', 'Nayeli', 'Necalli', 'Ocelotl', 'Quetzal', 'Tecolotl', 'Teyacapan', 'Tlaloc', 'Xiuhcoatl', 'Yaotl', 'Zyanya', 'Achcauh', 'Amoxtli', 'Cozcatl', 'Ehecatl', 'Iztli', 'Nochtli', 'Tochtli'],
    lastPre: ['Jade', 'Rain', 'Sun', 'Moon', 'River', 'Vine', 'Stone', 'Fire', 'Cloud', 'Serpent', 'Jaguar', 'Reed', 'Obsidian', 'Maize', 'Flower', 'Dawn', 'Star', 'Thunder', 'Shell', 'Cocoa'],
    lastSuf: ['walker', 'song', 'feather', 'tooth', 'root', 'bloom', 'eye', 'tail', 'dancer', 'weaver', 'runner', 'caller', 'keeper', 'singer', 'hand', 'heart', 'path', 'wing', 'claw', 'shade'],
  },
  high: {
    label: 'Kharduum',
    civ: ['Holds', 'Thanedom', 'Mountain Throne', 'Deep Kingdom', 'Under-Realm'],
    placePre: ['Dun', 'Kar', 'Bar', 'Thal', 'Gor', 'Dur', 'Mag', 'Brom', 'Khaz', 'Orn', 'Grund'],
    placeSuf: ['hold', 'mount', 'crag', 'peak', 'deep', 'forge', 'gate', 'spire', 'rock', 'hall'],
    first: ['Borin', 'Dagna', 'Durek', 'Helga', 'Korra', 'Magni', 'Nori', 'Orla', 'Rurik', 'Sigga', 'Thrain', 'Vala', 'Brenna', 'Gundi', 'Hjal', 'Kili', 'Marta', 'Thora', 'Ase', 'Balin', 'Bera', 'Dain', 'Dvalin', 'Eyra', 'Frerin', 'Grenna', 'Gloin', 'Haldis', 'Ingra', 'Kathra', 'Loni', 'Mirla', 'Nala', 'Ori', 'Rangrim', 'Runa', 'Skadi', 'Thorek', 'Tova', 'Ulfa', 'Vigrid', 'Yrsa', 'Barak', 'Dorn', 'Gilda', 'Hekla', 'Kazra', 'Morgrim'],
    lastPre: ['Stone', 'Deep', 'Iron', 'Coal', 'Gold', 'Anvil', 'Granite', 'Copper', 'Silver', 'Flint', 'Mithril', 'Obsidian', 'Slate', 'Bronze', 'Ember', 'Rune', 'Mountain', 'Cave', 'Ore', 'Steel', 'Boulder', 'Crag'],
    lastSuf: ['fist', 'delver', 'beard', 'hammer', 'shield', 'helm', 'vein', 'forge', 'breaker', 'crusher', 'grip', 'arm', 'mantle', 'born', 'guard', 'mail', 'song', 'axe', 'brow', 'foot'],
    lastWhole: ['Anvilborn', 'Deepdelver', 'Gemcutter', 'Holdkeeper', 'Stonewright', 'Tunnelwarden'],
  },
  // --- the other Dagoni Islands' peoples ----------------------------------
  // The Ashborn of Kharos: smiths and fire-priests under the smoking
  // mountain (hard consonants, names of ash and flame).
  ember: {
    label: 'Ashborn',
    civ: ['Forge-Throne', 'Ash Kingdom', 'Hearthold', 'Kiln Court'],
    placePre: ['Kha', 'Vul', 'Az', 'Ign', 'Pyr', 'Ser', 'Mag', 'Cin', 'Tor', 'Bas', 'Obs', 'Kel', 'Sul', 'Ash'],
    placeSuf: ['kiln', 'forge', 'reth', 'oss', 'ar', 'hearth', 'ash', 'umbra', 'cinder', 'vent', 'pyre', 'kar'],
    first: ['Azra', 'Bask', 'Cendra', 'Dax', 'Embra', 'Fyrn', 'Garo', 'Hesta', 'Ignis', 'Jorra', 'Kael', 'Lyra', 'Magma', 'Nyx', 'Obren', 'Pyra', 'Rask', 'Sulla', 'Tephra', 'Ustra', 'Vulka', 'Xera', 'Zarr', 'Brasa', 'Calda', 'Drass', 'Ferro', 'Hekla', 'Kindra', 'Lumen', 'Orr', 'Scoria', 'Tarn', 'Vesta', 'Ashk', 'Brann', 'Cind', 'Ember', 'Fumar', 'Ira', 'Basra', 'Cyra', 'Dolm', 'Fenix', 'Grael', 'Hask', 'Kelda', 'Moro', 'Pyrr', 'Rhea', 'Sable', 'Toph'],
    lastPre: ['Ash', 'Cinder', 'Flame', 'Basalt', 'Kiln', 'Smoke', 'Black', 'Glass', 'Slag', 'Forge', 'Ember', 'Soot', 'Sulphur', 'Char', 'Pumice'],
    lastSuf: ['born', 'hand', 'heart', 'tongue', 'walker', 'eye', 'brand', 'hammer', 'keeper', 'mark', 'blood', 'scale', 'crown', 'fall'],
    lastWhole: ['Kilnwright', 'Glassknapper', 'Ashwarden', 'Ventkeeper', 'Slagmonger'],
  },
  // The moor folk of Myrrow: quiet growers of mushroom and herb in the
  // mist, keepers of old lore (soft, sighing names).
  mist: {
    label: 'Mirefolk',
    civ: ['Moot', 'Mistholds', 'Circle', 'Hush Court'],
    placePre: ['Myr', 'Hollow', 'Fen', 'Moss', 'Grey', 'Hush', 'Mor', 'Bryn', 'Lune', 'Vell', 'Weald', 'Murk', 'Pale', 'Sol'],
    placeSuf: ['moor', 'mere', 'fen', 'how', 'combe', 'mist', 'wold', 'tarn', 'cairn', 'lea', 'cap', 'shade'],
    first: ['Aelis', 'Bryony', 'Cael', 'Dew', 'Elow', 'Fenna', 'Gloam', 'Heath', 'Isla', 'Juniper', 'Linnet', 'Myra', 'Nim', 'Orrel', 'Pell', 'Rill', 'Sorrel', 'Tamsin', 'Umber', 'Vetch', 'Willa', 'Yew', 'Aster', 'Bracken', 'Corrie', 'Drizzle', 'Ember', 'Fog', 'Hollis', 'Lichen', 'Morrow', 'Nettle', 'Peat', 'Rook', 'Sedge', 'Tansy', 'Whin', 'Moth', 'Alder', 'Briar', 'Cress', 'Dunlin', 'Eyebright', 'Fennel', 'Gorse', 'Hawthorn', 'Ivy', 'Mallow', 'Orris', 'Quill'],
    lastPre: ['Moss', 'Fen', 'Grey', 'Mist', 'Heather', 'Peat', 'Bog', 'Cap', 'Spore', 'Gloam', 'Owl', 'Moth', 'Toad', 'Reed', 'Lantern'],
    lastSuf: ['gatherer', 'wend', 'whisper', 'mere', 'hood', 'cap', 'ling', 'weaver', 'sight', 'water', 'tread', 'dell', 'lock', 'root'],
    lastWhole: ['Mushroomwife', 'Peatcutter', 'Lanternkeeper', 'Toadwhistle', 'Fogwalker'],
  },
  // The stilt folk of Myrrow's mangrove shores: fishers, rafters and
  // traders on the warm shallows (bright, rolling names).
  tide: {
    label: 'Stiltfolk',
    civ: ['Tide-Council', 'Reef League', 'Shoal Kingdom', 'Moorings'],
    placePre: ['Kai', 'Mara', 'Lagu', 'Coral', 'Salt', 'Reef', 'Wahi', 'Nalu', 'Pela', 'Shoal', 'Tuna', 'Mako', 'Brine', 'Ola'],
    placeSuf: ['moor', 'quay', 'reef', 'kai', 'shoal', 'ula', 'nui', 'stilts', 'cove', 'wash', 'landing', 'lagoon'],
    first: ['Ahi', 'Brin', 'Coral', 'Dune', 'Eke', 'Finn', 'Hali', 'Isa', 'Kai', 'Lani', 'Maka', 'Nalu', 'Ola', 'Pua', 'Reva', 'Sali', 'Tasi', 'Ulu', 'Wai', 'Yena', 'Ama', 'Bel', 'Kele', 'Kona', 'Lio', 'Mano', 'Nai', 'Pili', 'Rua', 'Tide', 'Wren', 'Moana', 'Keo', 'Luana', 'Alo', 'Ewa', 'Hina', 'Iolo', 'Kapo', 'Leilani', 'Mele', 'Niu', 'Opal', 'Pele', 'Rangi', 'Siale', 'Tama', 'Ula'],
    lastPre: ['Salt', 'Reef', 'Shell', 'Kelp', 'Crab', 'Gull', 'Tide', 'Pearl', 'Brine', 'Coral', 'Wave', 'Net', 'Drift', 'Stilt', 'Eel'],
    lastSuf: ['caller', 'diver', 'mender', 'runner', 'wake', 'spear', 'line', 'catch', 'song', 'foot', 'shore', 'sail', 'hook', 'swell'],
    lastWhole: ['Netmender', 'Pearldiver', 'Crabcatcher', 'Stiltwright', 'Rafter'],
  },
};

export const CIV_TITLES = ['Kingdom', 'Dominion', 'Republic', 'Confederacy', 'Principality', 'Commonwealth', 'Duchy', 'League', 'Empire', 'Realm', 'Union', 'Compact', 'Protectorate', 'Grand Duchy', 'March', 'Hegemony', 'Alliance', 'Free State'];

// A civilization's name: a title of its own people or a common one, before
// or after the name of its heartland. (Three draws, as it always took.)
export function civName(rng, culture) {
  const t = rng.next();
  const place = placeName(rng, culture);
  const titles = [...(CULTURES[culture].civ || []), ...CIV_TITLES];
  const k = Math.floor(t * titles.length * 2);
  const title = titles[k % titles.length];
  return k >= titles.length && !/ of /.test(title) ? `The ${place} ${title}` : `${title} of ${place}`;
}

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
  // (Two draws either way: now and then a trade or a father's name instead.)
  const a = rng.next();
  const b = rng.next();
  const whole = c.lastWhole || [];
  if (whole.length && a < 0.22) return whole[Math.floor(b * whole.length)];
  const pre = c.lastPre[Math.floor(((whole.length ? (a - 0.22) / 0.78 : a)) * c.lastPre.length)];
  const suf = c.lastSuf[Math.floor(b * c.lastSuf.length)];
  if (pre.endsWith(' ') || pre.endsWith('-')) return pre + suf;
  return (pre + suf.toLowerCase()).replace(/(.)\1\1/, '$1$1');
}
