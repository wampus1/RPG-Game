// The far lands beyond the storm, lived in (round 68): the two great
// continents and the five far isles, each with peoples of its own. Until
// now they were only land on the old charts; in a world made from 0.68 on
// (see worldgen.WORLD_GEN) they're settled like the Dagoni Islands, with
// realms and towns, and empires on the continents.
//
// Everything a far people is, kept here in one place (its names, what it
// eats and drinks, how it dresses, its gods and customs, how its founders
// came, the ships it names): each of the tables the game keeps by people
// (see world/names.js, sim/culture.js, sim/history.js and the rest) takes
// its rows from FAR_PEOPLES. What each land is (its peoples, how many
// realms and towns it has, its empires) is FAR_LANDS.
//
//   VELMARCH, the great northern continent: the Velari, an old empire of
//     marble roads, red-tiled roofs, laurels and legions, in its warm south
//     and middle; and the Rimeborn of its frozen north, reindeer herders
//     in turf-roofed longhouses who keep a fire of ice burning. Two
//     empires: one of each.
//   OSTRIA, the eastern continent: the Jade Court, of lacquered halls,
//     green-tiled roofs, lanterns and bells, in its green east; and the
//     Keshari of its red canyons and mesas, who build in red adobe up the
//     cliffs and wear turquoise. One empire: the Jade Court's.
//   CORROW, the lonely isle: the Bonewrights, whalers who build with the
//     ribs of the great whales washed up on its pale strand.
//   SALTMERE, the low isle: the Saltfolk, who rake the salt flats and
//     build white domes of salt brick by pink lagoons.
//   HOLLOWMARK, the far east isle: the Hollowfolk, who live in burrows dug
//     into the sides of its great sinkholes, under lantern trees.
//   THE WYRD ISLE: the Wyrdfolk, rune-carvers and seers in stone round
//     houses within their rings of standing stones, under the aurora.
//   THE GREY SKERRIES: the Skerrymen, who fish the cold seas from stone
//     huts and keep their beacons lit.

// Each far land: its peoples (the first its own people where nothing else
// decides), how many realms, cities, towns and villages it has (`empires`:
// how many of its realms are empires: their capitals the greatest places
// in the world), and which of its peoples suits which ground (`suits`:
// biome -> people; anything else, the first).
export const FAR_LANDS = {
  velmarch: {
    peoples: ['velari', 'rime'], civs: 5, towns: 8, villages: 14, empires: 2,
    empirePeoples: ['velari', 'rime'],
    suits: { taiga: 'rime', tundra: 'rime', rimewood: 'rime', mountain: 'rime' },
  },
  ostria: {
    peoples: ['jade', 'kesh'], civs: 4, towns: 6, villages: 11, empires: 1,
    empirePeoples: ['jade'],
    suits: { desert: 'kesh', savanna: 'kesh', red_mesa: 'kesh', mountain: 'kesh' },
  },
  corrow: { peoples: ['corrow'], civs: 1, towns: 1, villages: 3 },
  saltmere: { peoples: ['salt'], civs: 1, towns: 1, villages: 3 },
  hollowmark: { peoples: ['hollow'], civs: 1, towns: 1, villages: 3 },
  wyrd: { peoples: ['wyrd'], civs: 1, towns: 1, villages: 3 },
  skerries: { peoples: ['skerry'], civs: 1, towns: 1, villages: 3 },
};
export const FAR_KEYS = Object.keys(FAR_LANDS);

// What makes an empire's capital: bigger than any city (three map squares
// by three: see worldgen.makeSettlement), never poor, and rich in stores.
export const EMPIRE = { cw: 3, cd: 3, popX: 1.9 };

// --------------------------------------------------------------- the peoples
// For each far people: `land`; `label` (what they're called); names (realm
// words, place name parts, first names, family names); `values` (what their
// realms lean to holding dear) and `lean` (what they learn first); their
// table (`cuisine`), dress (`clothes`, a shirt trim `pattern`, `skins`);
// faith (`gods`, `clergy`, `rites` (see culture.RITES), sacred `beasts`,
// `taboos`, `folk`); history (`founders`, `epithets`, how they `came`, the
// `haunts` of their hills, the `places` their tales are told of); and the
// names they give their ships.
export const FAR_PEOPLES = {
  // --- Velmarch -------------------------------------------------------------
  // The Velari: the old empire of the continent's warm heart. Marble and
  // travertine, red barrel-tile roofs, gilt; laurels, eagles, legions, the
  // forum and the column. Latin names.
  velari: {
    land: 'velmarch', label: 'Velari',
    civ: ['Dominion', 'Republic', 'Consulate', 'Principate', 'Tetrarchy'],
    placePre: ['Aurel', 'Valen', 'Corvin', 'Septim', 'Lucan', 'Marcel', 'Claud', 'Flav', 'Tiber', 'Ostav', 'Caesar', 'Vesp', 'Juli', 'Aquil', 'Severin', 'Antoni'],
    placeSuf: ['ium', 'polis', 'a', 'ia', 'ona', 'entum', 'ica', 'anum', 'ova', 'essa', 'ae', 'um'],
    first: ['Aelia', 'Aurelius', 'Cassia', 'Decimus', 'Flavia', 'Gaius', 'Helena', 'Julia', 'Lucius', 'Marcus', 'Livia', 'Octavia', 'Quintus', 'Sabina', 'Titus', 'Valeria', 'Aulus', 'Camilla', 'Drusus', 'Fausta', 'Lucilla', 'Maximus', 'Nerva', 'Petronia', 'Septima', 'Tullia', 'Vibia', 'Albus', 'Cornelia', 'Domitia', 'Galen', 'Junia', 'Laelia', 'Marcellus', 'Paulina', 'Severus', 'Sextus', 'Tertia', 'Varro', 'Cato', 'Silvia', 'Rufus', 'Hadria', 'Lavinia', 'Corvus', 'Aemilia', 'Antonia'],
    lastPre: ['Aurel', 'Valer', 'Corneli', 'Fabi', 'Juli', 'Claudi', 'Domiti', 'Flavi', 'Licini', 'Manli', 'Octavi', 'Pompei', 'Sempron', 'Tulli', 'Vibi', 'Calpurn', 'Sulpici'],
    lastSuf: ['us', 'a', 'anus', 'ina', 'ana', 'o'],
    lastWhole: ['Agricola', 'Cicero', 'Crassus', 'Felix', 'Magnus', 'Nobilis', 'Paulus', 'Rufus', 'Severus', 'Varro'],
    values: ['martial', 'mercantile', 'scholarly', 'pious', 'artisan'],
    lean: { society: 1.4, engineering: 1.3, warfare: 1 },
    cuisine: { dishes: ['olive_bread', 'garum_stew'], word: 'olive bread, figs and a stew of fish and herbs', drink: 'spiced wine' },
    clothes: ['#f0ece0', '#a8282a', '#7a2a6a', '#e0b030', '#c8b89a', '#5a2a5a', '#d8d0c0', '#8a1e20', '#3a2a5a', '#b8963a'],
    pattern: 'sash',
    skins: ['#d8a878', '#c8946a', '#e0b88a', '#b8845a', '#e8c498', '#a87a50'],
    gods: {
      gods: ['the Unconquered Sun', 'Mother Velmara', 'the Laurel Twins', 'Janus of the Gates', 'the Hearth-Vestal', 'the Wolf-Nurse', 'the Lord of Legions'],
      faith: ['the Imperial Cult', 'the Laurel Rite', 'the Order of the Gates', 'the Vestal Flame', 'the Sun Unconquered', 'the College of Augurs'],
      feast: ['the Saturnalia', 'the Triumph', 'the Lupercal', 'the Vestalia', 'the Day of the Gates', 'the Laurel Games'],
      symbol: ['an eagle', 'a laurel wreath', 'a sun disc', 'a she-wolf', 'a sacred flame', 'two faces looking both ways'],
    },
    clergy: ['augur', 'flamen', 'vestal', 'pontifex'],
    rites: [0, 1, 0], beasts: ['the eagle', 'the she-wolf', 'the white bull'],
    taboos: ['holy_rest', 'temple_arms', 'sacred_beast'], folk: 'old empire',
    founders: ['Aurelian', 'Cassia', 'Decimus', 'Flavia', 'Marcellus', 'Septimia', 'Tiberius', 'Valeria'],
    epithets: ['the Conqueror', 'Pater Patriae', 'the Lawgiver', 'Augustus', 'the Builder'],
    came: ['down the marble road with the Ninth Legion', 'from the old capital when it fell to plague', 'as veterans given land for their service', 'founding a colony by the Emperor\'s decree'],
    haunts: ['a legion that still marches on the old road at night', 'the ghost of a murdered emperor', 'a she-wolf as big as a horse', 'the lemures who walk on the Day of the Dead'],
    places: ['the old forum', 'the aqueduct', 'the triumphal arch', 'the legion camp'],
    ships: ['Aquila', 'Victrix', 'Imperatrix', 'Fortuna', 'Concordia', 'Lupa'],
    dfounders: ['the Legate Varro', 'the Empress Livia', 'the Ninth Legion', 'Pontifex Albus'],
    rite: 'triumph',
    feastLook: { palette: 0, centre: [['brazier', 4]], centreWord: 'a brazier of sacred fire', light: ['lantern', 0], rugs: ['rug_red'] },
  },
  // The Rimeborn: reindeer folk of Velmarch's frozen north. Dark frosted
  // log longhouses, turf roofs, antlers over the doors, the frost hearth
  // (a fire of blue ice) in every square. Finnic names.
  rime: {
    land: 'velmarch', label: 'Rimeborn',
    civ: ['High Kingdom', 'Siida', 'Hearth-Holds', 'Frost Throne', 'Antler Realm'],
    placePre: ['Kaar', 'Ilma', 'Pohja', 'Tuo', 'Vaar', 'Lumi', 'Jaa', 'Kuu', 'Revon', 'Hirvi', 'Kivi', 'Talvi', 'Aurin', 'Sompa'],
    placeSuf: ['la', 'vaara', 'järvi', 'koski', 'maa', 'niemi', 'harju', 'oja', 'salo', 'kumpu'],
    first: ['Aino', 'Eero', 'Ilmari', 'Kaisa', 'Lempi', 'Marjatta', 'Niilo', 'Oona', 'Pekka', 'Ritva', 'Sampo', 'Tuuli', 'Ukko', 'Väinö', 'Aslak', 'Elle', 'Inga', 'Juho', 'Kerttu', 'Lauri', 'Maaret', 'Nilla', 'Ovla', 'Saara', 'Tapio', 'Unna', 'Vuokko', 'Ailu', 'Biret', 'Heikki', 'Iisko', 'Jouni', 'Kalle', 'Liisa', 'Mikko', 'Outi', 'Rauha', 'Sirkka', 'Taneli', 'Kirsti', 'Pirkko', 'Raimo', 'Seppo', 'Anneli', 'Hannu', 'Ilkka', 'Jaana', 'Marja', 'Nils', 'Risten', 'Ánte'],
    lastPre: ['Lumi', 'Jää', 'Kivi', 'Hirvi', 'Revon', 'Talvi', 'Kuu', 'Tähti', 'Koivu', 'Mänty', 'Susi', 'Karhu'],
    lastSuf: ['nen', 'la', 'mäki', 'joki', 'salo', 'oja', 'vaara', 'kangas', 'lahti'],
    lastWhole: ['Saijets', 'Aikio', 'Magga', 'Valkeapää', 'Länsman', 'Gaup'],
    values: ['martial', 'agrarian', 'pious', 'seafaring'],
    lean: { warfare: 1.3, society: 1, engineering: 0.8 },
    cuisine: { dishes: ['reindeer_roast', 'cloudberry_cakes'], word: 'roast reindeer and cloudberry cakes', drink: 'birch mead' },
    clothes: ['#2a4a8a', '#c8302a', '#f0e8d8', '#e0b030', '#3a3a44', '#5a6a8a', '#8a2a2a', '#d8d8e0', '#2a6a5a', '#4a3a2a'],
    pattern: 'stripes',
    skins: ['#e8c8a8', '#d8b494', '#f0d4b8', '#c8a080', '#e0bc9c', '#b89070'],
    gods: {
      gods: ['Ukko of the Thunder', 'the Reindeer Mother', 'the Frost-Maiden', 'the Bear Ancestor', 'Kuu the Moon', 'the Northern Fire', 'the Drum-Spirit'],
      faith: ['the Way of the Drum', 'the Frost Hearth', 'the Antler Rite', 'the Bear Feast Circle', 'the Moon Path', 'the Lights Above'],
      feast: ['the Bear Feast', 'the Return of the Sun', 'the Night of Lights', 'the Calving', 'the First Snow', 'the Drum Night'],
      symbol: ['a reindeer\'s antlers', 'a shaman\'s drum', 'a bear\'s paw', 'a crescent moon', 'a frozen flame', 'the northern lights'],
    },
    clergy: ['noaidi', 'drum-keeper', 'frost-singer', 'bear-speaker'],
    rites: [3, 1, 2], beasts: ['the reindeer', 'the bear', 'the snow owl'],
    taboos: ['sacred_beast', 'sacred_trees', 'holy_rest'], folk: 'frozen north',
    founders: ['Aslak', 'Biret', 'Ilmari', 'Kaisa', 'Niilo', 'Sampo', 'Tuuli', 'Väinö'],
    epithets: ['Ice-Heart', 'the Drummer', 'Bear-Brother', 'the Herd-Leader', 'Who-Walks-the-Lights'],
    came: ['following the great herds north', 'over the frozen sea in the long night', 'from the south, driven out by the legions', 'led by a drum-song in a dream'],
    haunts: ['a white reindeer that cannot be caught', 'the frost-maiden who kisses travellers to sleep', 'the stallo, a giant who eats the lost', 'the lights that come down and take children'],
    places: ['the sacred fell', 'the frozen falls', 'the old reindeer fence', 'the drum-stone'],
    ships: ['Northern Light', 'Frost Swan', 'Reindeer', 'Ice Maiden', 'Drumsong'],
    dfounders: ['the Drum-King Sampo', 'the Bear-Mother', 'the Frost-Maiden', 'the Herdlord Aslak'],
    rite: 'bearfeast',
    feastLook: { palette: 1, centre: [['campfire', 4]], centreWord: 'a great fire on the snow', light: ['torch', 4], rugs: ['rug_blue'] },
  },
  // --- Ostria ---------------------------------------------------------------
  // The Jade Court: red lacquered pillars and paper walls, green glazed
  // roofs swept up at the corners, lanterns, moon gates, the bell pagoda.
  jade: {
    land: 'ostria', label: 'Jade Court',
    civ: ['Celestial Throne', 'Middle Kingdom', 'Jade Dynasty', 'Court of the Phoenix', 'Protectorate'],
    placePre: ['Jin', 'Lian', 'Shu', 'Hai', 'Long', 'Feng', 'Bai', 'Yu', 'Huang', 'Qing', 'Ming', 'Xia', 'Tian', 'Lu'],
    placeSuf: ['zhou', 'an', 'ling', 'cheng', 'jing', 'shan', 'he', 'men', 'yang', 'tai'],
    first: ['Mei', 'Lian', 'Jun', 'Hua', 'Wei', 'Xiu', 'Bao', 'Ling', 'Tao', 'Yan', 'Fen', 'Kang', 'Lan', 'Ming', 'Ping', 'Qiu', 'Rong', 'Shan', 'Ting', 'Xin', 'Yue', 'Zhen', 'Ai', 'Chen', 'Feng', 'Hong', 'Jia', 'Lei', 'Mu', 'Ning', 'Ru', 'Sheng', 'Wen', 'Xiang', 'Yi', 'Zhu', 'Guang', 'Hui', 'Jing', 'Shu', 'Hao', 'Qing', 'Lu', 'Fang', 'Jie', 'Yun', 'Tian', 'Bo', 'Hai'],
    lastPre: ['Li', 'Wang', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun', 'Ma', 'Zhu', 'Hu', 'Guo', 'Lin', 'He', 'Gao', 'Luo', 'Zheng', 'Liang', 'Xie', 'Song', 'Tang', 'Han', 'Feng', 'Deng', 'Cao', 'Peng', 'Zeng', 'Xiao', 'Tian', 'Dong', 'Pan', 'Yuan', 'Cai', 'Jiang', 'Yu', 'Du', 'Ye', 'Cheng', 'Wei', 'Su', 'Lu', 'Ding', 'Ren', 'Shen', 'Yao', 'Jin', 'Fu', 'Zhong', 'Qiu', 'Xue', 'Yan', 'Lei', 'Bai', 'Long', 'Duan', 'Hao', 'Kong', 'Shao', 'Shi', 'Mao', 'Wan', 'Gu', 'Lai', 'Wen', 'Qin', 'Kang', 'Ouyang', 'Sima', 'Zhuge', 'Shangguan', 'Situ', 'Dongfang', 'Murong', 'Xiahou', 'Huangfu', 'Linghu'],
    lastSuf: [''],
    values: ['scholarly', 'artisan', 'mercantile', 'pious'],
    lean: { society: 1.5, economy: 1.2, engineering: 1 },
    cuisine: { dishes: ['dumplings', 'jasmine_tea'], word: 'steamed dumplings and jasmine tea', drink: 'jasmine tea' },
    clothes: ['#a8202a', '#2a8a5a', '#e0b030', '#1e2e6a', '#f0e8d8', '#c84a2a', '#3a6a4a', '#5a1e3a', '#d8c070', '#2a2a3a'],
    pattern: 'collar',
    skins: ['#e8c8a0', '#dcb890', '#f0d4b0', '#d0aa80', '#e4c098', '#c89c72'],
    gods: {
      gods: ['the Jade Emperor', 'the Lady of Mercy', 'the Dragon of the East', 'the Kitchen God', 'the Moon Lady', 'the Phoenix of the South', 'the Ancestors'],
      faith: ['the Way of Heaven', 'the Jade Rites', 'the Temple of Mercy', 'the Dragon Court', 'the Ancestral Hall', 'the Path of Harmony'],
      feast: ['the Lantern Festival', 'the Moon Festival', 'the Dragon Boat Race', 'the Spring Festival', 'the Feast of Ghosts', 'the Double Ninth'],
      symbol: ['a jade disc', 'a coiled dragon', 'a phoenix', 'a lotus', 'a red lantern', 'a bronze bell'],
    },
    clergy: ['abbot', 'monk', 'sage', 'temple-keeper'],
    rites: [0, 2, 0], beasts: ['the crane', 'the dragon', 'the red fox'],
    taboos: ['no_meat', 'temple_arms', 'sacred_beast', 'holy_rest'], folk: 'green east',
    founders: ['Bao', 'Feng', 'Hua', 'Lian', 'Mei', 'Ming', 'Wei', 'Yan'],
    epithets: ['the Sage', 'Dragon-Born', 'the Unworried', 'Iron-Brush', 'Heaven\'s Favoured'],
    came: ['down the river on lantern-lit barges', 'by the Emperor\'s mandate to settle the frontier', 'fleeing the flood of the great river', 'following a crane to the mountain spring'],
    haunts: ['a fox-spirit with nine tails', 'the hopping dead in their silk robes', 'a dragon sleeping in the lake', 'the hungry ghosts of the seventh month'],
    places: ['the old pagoda', 'the moon gate', 'the dragon well', 'the bamboo shrine'],
    ships: ['Jade Phoenix', 'Celestial Wind', 'Dragon Pearl', 'Lotus Moon', 'Golden Carp'],
    dfounders: ['the First Emperor', 'General Bai Qi', 'the Jade Empress', 'Abbot Lian'],
    rite: 'lanterns',
    feastLook: { palette: 2, centre: [['lantern', 4]], centreWord: 'a tower of red lanterns', light: ['lantern', 4], rugs: ['rug_red'] },
  },
  // The Keshari: canyon folk of Ostria's red mesas. Red adobe built up the
  // cliff faces, ladders, turquoise and black-and-white zigzags, the sun
  // wheel. Names of the high desert.
  kesh: {
    land: 'ostria', label: 'Keshari',
    civ: ['Sun Confederacy', 'Mesa Council', 'Canyon Kingdom', 'Turquoise Throne', 'League of Pueblos'],
    placePre: ['Kesh', 'Tsa', 'Ko', 'Pah', 'Wa', 'Ho', 'Ta', 'Ama', 'Sik', 'Tewa', 'Chak', 'Nam', 'Pi', 'Hu'],
    placeSuf: ['ri', 'tsi', 'mesa', 'wi', 'pah', 'ta', 'kova', 'ne', 'po', 'yatu'],
    first: ['Ahote', 'Chosovi', 'Dyani', 'Halona', 'Istas', 'Kachina', 'Lomasi', 'Mansi', 'Nayeli', 'Pamuya', 'Sakari', 'Tala', 'Wiyaka', 'Yepa', 'Ayasha', 'Cha', 'Eyota', 'Hototo', 'Kele', 'Lenno', 'Mato', 'Nita', 'Onawa', 'Paco', 'Sihu', 'Tocho', 'Wapi', 'Kai', 'Hiti', 'Kuwanyi', 'Leotie', 'Niyol', 'Sunki', 'Tiva', 'Yansa', 'Aponi', 'Chayton', 'Dezba', 'Elsu', 'Hakan', 'Kimi', 'Macawi', 'Nodin', 'Taima', 'Wakanda', 'Yazhi', 'Zitkala'],
    lastPre: ['Red', 'Sun', 'Sky', 'Turquoise', 'Canyon', 'Mesa', 'Corn', 'Eagle', 'Dust', 'Rain', 'Coyote', 'Hawk', 'Stone', 'Fire'],
    lastSuf: ['walker', 'dancer', 'singer', 'feather', 'runner', 'shield', 'cloud', 'water', 'hand', 'eye', 'bow'],
    values: ['agrarian', 'pious', 'artisan', 'martial'],
    lean: { engineering: 1.2, society: 1, warfare: 1 },
    cuisine: { dishes: ['chili_squash', 'blue_corn_cakes'], word: 'squash stewed with chili, and blue corn cakes', drink: 'cactus tea' },
    clothes: ['#2a9a9a', '#c8502a', '#e0a040', '#f0e8d8', '#1e1e24', '#a83a2a', '#3ab8b0', '#d8b070', '#6a3a2a', '#e8d8b0'],
    pattern: 'stripes',
    skins: ['#c88a5a', '#b87848', '#d89a68', '#a86a3c', '#d0925e', '#986034'],
    gods: {
      gods: ['the Sun Father', 'the Corn Mother', 'Spider Grandmother', 'the Twin War Gods', 'the Rain Kachinas', 'Coyote the Trickster', 'the Thunderbird'],
      faith: ['the Kiva Way', 'the Sun Dance', 'the Corn Covenant', 'the Kachina Society', 'the Web of Grandmother', 'the Thunder Rite'],
      feast: ['the Sun Dance', 'the Green Corn Feast', 'the Kachina Return', 'the Snake Dance', 'the Night of Rain', 'the Turquoise Day'],
      symbol: ['a sun wheel', 'an ear of blue corn', 'a spider\'s web', 'a thunderbird', 'a turquoise stone', 'a kachina mask'],
    },
    clergy: ['sun-priest', 'kiva elder', 'rain-caller', 'web-keeper'],
    rites: [3, 1, 4], beasts: ['the thunderbird', 'the coyote', 'the eagle'],
    taboos: ['sacred_beast', 'no_hunting', 'holy_rest', 'no_digging'], folk: 'red canyons',
    founders: ['Ahote', 'Dyani', 'Halona', 'Kele', 'Lomasi', 'Nayeli', 'Sakari', 'Tocho'],
    epithets: ['Sun-Caller', 'Who-Climbs-High', 'the Rain-Bringer', 'Turquoise-Eye', 'Thunder-Voice'],
    came: ['up out of the underworld through the sipapu', 'following the eagle to the high mesa', 'when the great drought drove them from the river', 'led by Spider Grandmother\'s thread'],
    haunts: ['the skinwalker who wears a coyote\'s hide', 'the thunderbird that nests on the needle rock', 'the ancient ones in the cliff houses', 'a giant serpent in the dry wash'],
    places: ['the cliff house', 'the great kiva', 'the needle rock', 'the painted cave'],
    ships: ['Thunderbird', 'Turquoise Sky', 'Red Hawk', 'Sun Wheel', 'Corn Maiden'],
    dfounders: ['the Sun-Priest Ahote', 'the Ancient Ones', 'the Turquoise Queen', 'Coyote'],
    rite: 'sundance',
    feastLook: { palette: 3, centre: [['campfire', 4]], centreWord: 'a dance fire', light: ['torch', 4], rugs: ['rug_red'] },
  },
  // --- the far isles ---------------------------------------------------------
  // The Bonewrights of Corrow: whalers and bone-carvers, houses framed in
  // whalebone under turf, the great jawbone arch over every square.
  corrow: {
    land: 'corrow', label: 'Bonewrights',
    civ: ['Whale-Lordship', 'Bone Council', 'Harpoon Kingdom', 'Strand Clans'],
    placePre: ['Kil', 'Dun', 'Ard', 'Bal', 'Inver', 'Kin', 'Strath', 'Glen', 'Ach', 'Car', 'Ros', 'Tor'],
    placeSuf: ['more', 'beg', 'ach', 'aig', 'ness', 'bost', 'vore', 'an', 'dale', 'shader'],
    first: ['Angus', 'Brenna', 'Calum', 'Deirdre', 'Ewan', 'Fiona', 'Gregor', 'Isla', 'Kenna', 'Lachlan', 'Morag', 'Niall', 'Oona', 'Rory', 'Seona', 'Torquil', 'Ailsa', 'Brodie', 'Catriona', 'Dougal', 'Eilidh', 'Fergus', 'Iain', 'Kirsty', 'Murdo', 'Peigi', 'Ruaridh', 'Shona', 'Uisdean', 'Mairi', 'Alasdair', 'Beathag', 'Coinneach', 'Domhnall', 'Eachann', 'Flora', 'Gormul', 'Hamish', 'Iseabail', 'Kenneth', 'Lorna', 'Murchadh', 'Nighean', 'Raghnall', 'Sileas', 'Tormod'],
    lastPre: ['Mac', 'Mac', 'Mac', 'Mc'],
    lastSuf: ['Leod', 'Neil', 'Donald', 'Aulay', 'Kinnon', 'Iver', 'Lean', 'Askill', 'Rae', 'Phail', 'Innes', 'Kenzie', 'Kay', 'Gregor', 'Lachlan', 'Millan', 'Callum', 'Diarmid', 'Ewen', 'Fadyen', 'Farlane', 'Intyre', 'Kechnie', 'Lennan', 'Murdo', 'Nab', 'Naughton', 'Pherson', 'Queen', 'Rory', 'Sween', 'Tavish', 'Vicar', 'Whirter', 'Coll'],
    lastWhole: ['Morrison', 'Campbell', 'Ross', 'Munro', 'Matheson', 'Gunn', 'Sutherland', 'Mackay', 'Nicolson', 'Beaton'],
    values: ['seafaring', 'artisan', 'martial'],
    lean: { economy: 1.2, warfare: 1.1 },
    cuisine: { dishes: ['whale_stew', 'oat_bannock'], word: 'whale stew and oat bannocks', drink: 'peat whisky' },
    clothes: ['#5a4a3a', '#7a7a74', '#e8e0cc', '#3a4a5a', '#8a6a3a', '#4a3a2a', '#a8a094', '#2a3a3a', '#6a5a4a', '#c8b898'],
    pattern: 'collar',
    skins: ['#e8c8b0', '#dcb8a0', '#f0d4bc', '#d0aa8c', '#e4c4a8', '#c89c80'],
    gods: {
      gods: ['the Great Whale', 'the Mother of the Strand', 'the Harpooner', 'the Drowned King', 'the Gull-Wife', 'Old Bones', 'the Kraken Below'],
      faith: ['the Rite of Bones', 'the Whale Covenant', 'the Strand Watch', 'the Harpoon Oath', 'the Drowned Court', 'the Song of the Deep'],
      feast: ['the Stranding', 'the Bone Moon', 'the Harpoon Blessing', 'the Night of Songs', 'the Return of the Whales', 'the Oil Lamp Feast'],
      symbol: ['a whale\'s jawbone', 'a harpoon', 'a scrimshaw tooth', 'a gull', 'a ribcage', 'an oil lamp'],
    },
    clergy: ['bone-reader', 'whale-singer', 'strand-keeper', 'harpoon-priest'],
    rites: [2, 2, 3], beasts: ['the whale', 'the gull', 'the crab'],
    taboos: ['sacred_beast', 'holy_rest', 'temple_arms'], folk: 'bone strand',
    founders: ['Angus', 'Brenna', 'Calum', 'Deirdre', 'Fergus', 'Isla', 'Morag', 'Torquil'],
    epithets: ['Whale-Bane', 'the Bone-Carver', 'Harpoon-Hand', 'Strand-Born', 'the Singer'],
    came: ['following the whales to where they come to die', 'on a raft of whale ribs', 'when the great storm drove the fleet onto the strand', 'to carve the bones of the leviathan'],
    haunts: ['a ghost whale that swims through the fog', 'the drowned whalers who knock on doors', 'a leviathan that isn\'t dead', 'the gull-wife who steals sailors'],
    places: ['the leviathan\'s skull', 'the bone strand', 'the old try-works', 'the harpoon rock'],
    ships: ['Harpoon', 'Bone Maiden', 'Leviathan', 'Strand Gull', 'Whale-Song'],
    dfounders: ['the Harpooner Torquil', 'the Leviathan', 'Old Bones', 'the Whale-Wife'],
    rite: 'stranding',
    feastLook: { palette: 1, centre: [['campfire', 4]], centreWord: 'a fire of whale oil', light: ['lantern', 4], rugs: ['rug_blue'] },
  },
  // The Saltfolk of Saltmere: white salt-brick domes with blue doors,
  // salt pans, pink lagoons, the salt obelisk. Island-Greek names.
  salt: {
    land: 'saltmere', label: 'Saltfolk',
    civ: ['Salt Republic', 'Brine League', 'Lagoon Doge', 'White Council'],
    placePre: ['Ales', 'Thal', 'Mira', 'Kal', 'Nax', 'Lix', 'Ser', 'Ami', 'Pyr', 'Hal', 'Tel', 'Ner'],
    placeSuf: ['os', 'ia', 'ena', 'aki', 'opoli', 'ira', 'essa', 'ados', 'ini', 'ou'],
    first: ['Alexios', 'Daphne', 'Eleni', 'Giorgos', 'Ioanna', 'Kostas', 'Lena', 'Manos', 'Nikos', 'Phaedra', 'Rhea', 'Stavros', 'Thalia', 'Yiannis', 'Zoe', 'Andreas', 'Chloe', 'Dimitra', 'Eirini', 'Fotis', 'Kassia', 'Leonidas', 'Melina', 'Panos', 'Sofia', 'Theo', 'Vasso', 'Xanthe', 'Aris', 'Marina', 'Agape', 'Christos', 'Despina', 'Evangelos', 'Filippos', 'Georgia', 'Iason', 'Katerina', 'Lefteris', 'Myrto', 'Nefeli', 'Orestis', 'Paraskevi', 'Spyros', 'Vasilis'],
    lastPre: ['Alati', 'Thala', 'Ammo', 'Kalo', 'Psari', 'Nero', 'Lefko', 'Galaz', 'Kokin', 'Ross', 'Mavro', 'Papa', 'Kosta', 'Vlacho', 'Spiro', 'Chrysto', 'Mela'],
    lastSuf: ['poulos', 'akis', 'idis', 'ou', 'as', 'ides'],
    values: ['mercantile', 'seafaring', 'agrarian'],
    lean: { economy: 1.5, engineering: 0.8 },
    cuisine: { dishes: ['shrimp_soup', 'salt_fish'], word: 'pink shrimp soup and salt fish', drink: 'lime cordial' },
    clothes: ['#f4f0e8', '#3a7ab8', '#e8a0a8', '#5ab0d8', '#e0d8c8', '#2a5a9a', '#f0c8c0', '#8ab8d8', '#d8b8a0', '#1e3a6a'],
    pattern: 'buttons',
    skins: ['#dcb088', '#ccA078', '#e8c098', '#c0946a', '#d8ac80', '#b48a60'],
    gods: {
      gods: ['the Salt Mother', 'the Sun on the Water', 'the Flamingo Queen', 'the Tide Brothers', 'the Brine-Keeper', 'the Lady of the Pans', 'the Wind from the East'],
      faith: ['the Salt Covenant', 'the White Rite', 'the Order of the Pans', 'the Lagoon Mysteries', 'the Brine Oath', 'the Sun Path'],
      feast: ['the Salt Harvest', 'the Flamingo Dance', 'the Night of White', 'the Brine Blessing', 'the Feast of Pans', 'the Sun\'s Return'],
      symbol: ['a salt crystal', 'a flamingo', 'a white dome', 'a rake', 'a fish on a hook', 'a blue door'],
    },
    clergy: ['salt-keeper', 'pan-priest', 'brine-reader', 'white sister'],
    rites: [0, 2, 0], beasts: ['the flamingo', 'the heron', 'the brine shrimp'],
    taboos: ['holy_rest', 'no_drink', 'sacred_beast'], folk: 'white pans',
    founders: ['Alexios', 'Daphne', 'Eleni', 'Kostas', 'Phaedra', 'Rhea', 'Stavros', 'Thalia'],
    epithets: ['Salt-Hand', 'the Raker', 'of the White Domes', 'the Flamingo', 'Sun-Squinting'],
    came: ['when the sea went out and left the salt', 'from Ostria\'s coast, chasing the salt trade', 'following the flamingos to the pink lagoons', 'on salt barges that ran aground and stayed'],
    haunts: ['a woman of salt who weeps on the flats', 'the drowned salt-rakers', 'a crab as big as a dome', 'the mirage city that walks toward you'],
    places: ['the salt obelisk', 'the old pans', 'the pink lagoon', 'the white chapel'],
    ships: ['White Gull', 'Salt Rose', 'Flamingo', 'Brine Queen', 'Sun-on-Water'],
    dfounders: ['the Salt Mother', 'Doge Kostas', 'the Brine-Keeper', 'the Drowned Rakers'],
    rite: 'saltharvest',
    feastLook: { palette: 3, centre: [['lantern', 4]], centreWord: 'a ring of white lanterns', light: ['lantern', 4], rugs: ['rug_blue'] },
  },
  // The Hollowfolk of Hollowmark: burrows dug into the sinkholes' walls,
  // round doors, moss roofs, lantern trees whose pods glow all night.
  hollow: {
    land: 'hollowmark', label: 'Hollowfolk',
    civ: ['Warren-Moot', 'Hollow Kingdom', 'Lantern Council', 'Deep Holds'],
    placePre: ['Glim', 'Delve', 'Moss', 'Lamp', 'Root', 'Hush', 'Burrow', 'Ember', 'Fern', 'Dim', 'Under', 'Cozy'],
    placeSuf: ['hollow', 'den', 'well', 'burrow', 'warren', 'deep', 'dell', 'nook', 'bottom', 'hole'],
    first: ['Bramble', 'Clover', 'Dimble', 'Elder', 'Fennel', 'Glimmer', 'Hazel', 'Juniper', 'Lumpkin', 'Moss', 'Nettle', 'Pip', 'Quill', 'Rootle', 'Sorrel', 'Thistle', 'Umber', 'Wick', 'Acorn', 'Burdock', 'Chervil', 'Dewberry', 'Fidget', 'Gorse', 'Hob', 'Inkcap', 'Lob', 'Mallow', 'Nib', 'Puddle', 'Tansy', 'Willow', 'Bilberry', 'Cobble', 'Dandelion', 'Fern', 'Gooseberry', 'Huckle', 'Ivy', 'Kettle', 'Loam', 'Marigold', 'Pennyroyal', 'Rush', 'Snowdrop', 'Teasel'],
    lastPre: ['Under', 'Deep', 'Dim', 'Glow', 'Moss', 'Root', 'Lamp', 'Mud', 'Burrow', 'Fern', 'Stone', 'Hollow'],
    lastSuf: ['hill', 'bottom', 'foot', 'warren', 'dig', 'mole', 'lamp', 'wick', 'den', 'root'],
    values: ['agrarian', 'artisan', 'scholarly'],
    lean: { engineering: 1.4, society: 1 },
    cuisine: { dishes: ['root_stew', 'glowberry_tart'], word: 'cave-root stew and glowberry tart', drink: 'mushroom ale' },
    clothes: ['#4a6a3a', '#6a4a2a', '#c8902a', '#3a4a2a', '#8a6a3a', '#5a3a2a', '#d8a040', '#2a3a2a', '#7a8a4a', '#a87a3a'],
    pattern: 'patches',
    skins: ['#d8a878', '#c8986a', '#e4b888', '#b88858', '#dcac7c', '#a87848'],
    gods: {
      gods: ['the Lantern Mother', 'the Old Mole', 'the Root of Roots', 'the Glow in the Dark', 'the Deep Sleeper', 'the Moth Queen', 'the First Digger'],
      faith: ['the Lantern Way', 'the Root Covenant', 'the Burrow Rite', 'the Order of the Glow', 'the Moth Mysteries', 'the Deep Peace'],
      feast: ['the Lantern Night', 'the First Dig', 'the Moth Moon', 'the Root Harvest', 'the Long Sleep', 'the Glowing'],
      symbol: ['a lantern pod', 'a mole\'s paw', 'a root', 'a moth', 'a round door', 'a glowing seed'],
    },
    clergy: ['lamplighter', 'root-tender', 'moth-keeper', 'burrow-warden'],
    rites: [4, 0, 4], beasts: ['the mole', 'the moth', 'the badger'],
    taboos: ['sacred_trees', 'holy_rest', 'no_digging'], folk: 'hollows',
    founders: ['Bramble', 'Dimble', 'Glimmer', 'Hazel', 'Juniper', 'Moss', 'Sorrel', 'Thistle'],
    epithets: ['Deep-Digger', 'Lantern-Bearer', 'the Cosy', 'Root-Wise', 'Who-Never-Saw-the-Sun'],
    came: ['up out of the sinkholes into the light', 'following the glow of the lantern trees', 'digging their way in from the coast', 'when the great hollow opened in a night'],
    haunts: ['the thing at the bottom of the deepest sinkhole', 'a lantern that leads you down and down', 'the blind wyrm in the roots', 'the moth queen who steals your dreams'],
    places: ['the great sinkhole', 'the lantern grove', 'the root cellar', 'the old burrow'],
    ships: ['Lantern Moth', 'Round Door', 'Deep Glow', 'Root Barge', 'Burrow Home'],
    dfounders: ['the First Digger', 'the Lantern Mother', 'Old Mole', 'the Root-King'],
    rite: 'lanterns',
    feastLook: { palette: 2, centre: [['lantern', 4]], centreWord: 'a great hanging lantern', light: ['lantern', 4], rugs: ['rug_green'] },
  },
  // The Wyrdfolk of the Wyrd Isle: stone round houses under turf, rings of
  // standing runestones, the aurora. Old Gaelic names.
  wyrd: {
    land: 'wyrd', label: 'Wyrdfolk',
    civ: ['Rune Kingdom', 'Circle of Seers', 'Fey Court', 'Stone Moot'],
    placePre: ['Fiann', 'Morr', 'Ciar', 'Bran', 'Dun', 'Aen', 'Cael', 'Lir', 'Moy', 'Teth', 'Ogh', 'Sidh'],
    placeSuf: ['dh', 'ach', 'wen', 'ra', 'more', 'tir', 'bal', 'loch', 'gal', 'ard'],
    first: ['Aoife', 'Bran', 'Caoimhe', 'Dara', 'Eithne', 'Fionn', 'Grainne', 'Lir', 'Maeve', 'Niamh', 'Oisin', 'Riona', 'Saoirse', 'Tadhg', 'Une', 'Brigid', 'Cathal', 'Deirbhile', 'Emer', 'Fiachra', 'Iollan', 'Mor', 'Nuala', 'Orlaith', 'Ronan', 'Sorcha', 'Tuathal', 'Aengus', 'Cliodhna', 'Muirne', 'Ailill', 'Blathnat', 'Conall', 'Dairine', 'Eochaid', 'Fand', 'Iuchra', 'Lughaid', 'Medb', 'Nechtan', 'Oengus', 'Rhonan', 'Scathach', 'Tlachtga', 'Uaithne', 'Etain'],
    lastPre: ['O\'', 'Mac ', 'Ni ', 'O\''],
    lastSuf: ['Fiann', 'Dubh', 'Rua', 'Ciar', 'Bran', 'Lir', 'Nemed', 'Aed', 'Conn', 'Morna', 'Sidhe', 'Duibhne', 'Neill', 'Briain', 'Ruairc', 'Flaherty', 'Dalaigh', 'Faolain', 'Ceallaigh', 'Brennan', 'Lochlainn', 'Mordha', 'Righ', 'Donnabhain', 'Caoimh'],
    values: ['scholarly', 'pious', 'agrarian'],
    lean: { society: 1.6, engineering: 0.6 },
    cuisine: { dishes: ['seer_stew', 'heather_bread'], word: 'seer\'s stew and heather bread', drink: 'aurora mead' },
    clothes: ['#5a3a8a', '#2a7a7a', '#d8d0c0', '#8a6aa8', '#3a5a4a', '#c8c0a8', '#4a2a6a', '#6ab0a8', '#7a6a5a', '#9a8ab0'],
    pattern: 'patches',
    skins: ['#ecd0b8', '#e0c0a8', '#f4dcc8', '#d4b49c', '#e8c8b0', '#c8a890'],
    gods: {
      gods: ['the Lady of the Lights', 'the Antlered One', 'the Ninth Rune', 'the Fair Folk', 'the Weaver of Wyrd', 'the Raven Queen', 'the Sleeper Under the Hill'],
      faith: ['the Rune Way', 'the Circle', 'the Fair Court', 'the Weave', 'the Raven Rite', 'the Hollow Hill'],
      feast: ['the Night of Lights', 'Samhain', 'Beltane', 'the Rune-Carving', 'the Raven Moon', 'Midsummer Eve'],
      symbol: ['a runestone', 'a ring of stones', 'antlers', 'a raven', 'a spindle', 'the aurora'],
    },
    clergy: ['seer', 'rune-carver', 'druid', 'circle-keeper'],
    rites: [3, 4, 1], beasts: ['the raven', 'the hare', 'the stag'],
    taboos: ['sacred_trees', 'sacred_beast', 'no_digging', 'holy_rest'], folk: 'circles',
    founders: ['Aoife', 'Bran', 'Dara', 'Fionn', 'Maeve', 'Niamh', 'Oisin', 'Riona'],
    epithets: ['Rune-Wise', 'the Seer', 'Raven-Friend', 'of the Ninth Rune', 'Who-Saw-the-Lights'],
    came: ['through a door in the hill that isn\'t there now', 'following the aurora west', 'carrying the nine runes from the old world', 'when the fair folk let them stay'],
    haunts: ['the fair folk who dance in the rings', 'a hare that is a witch', 'the Antlered One in the deep wood', 'the raven queen who counts the dead'],
    places: ['the stone circle', 'the hollow hill', 'the rune-wood', 'the raven rock'],
    ships: ['Raven', 'Aurora', 'Ninth Rune', 'Fair Wind', 'Hollow Hill'],
    dfounders: ['the Witch of the Ninth Rune', 'the Antlered King', 'the Raven Queen', 'Fionn the Seer'],
    rite: 'bonfire',
    feastLook: { palette: 1, centre: [['campfire', 4]], centreWord: 'a bonfire in the stone ring', light: ['torch', 4], rugs: ['rug_green'] },
  },
  // The Skerrymen of the Grey Skerries: stone beehive huts, slate roofs
  // held down with ropes and stones, oilskins, the beacon on the cliff.
  skerry: {
    land: 'skerries', label: 'Skerrymen',
    civ: ['Beacon League', 'Skerry Thing', 'Udal Earldom', 'Fisher Moot'],
    placePre: ['Sker', 'Hval', 'Stack', 'Grind', 'Fugl', 'Brei', 'Ness', 'Hamar', 'Lerwi', 'Vaa', 'Unst', 'Sumbur'],
    placeSuf: ['wick', 'voe', 'ay', 'ness', 'bister', 'setter', 'garth', 'quoy', 'hope', 'holm'],
    first: ['Arthur', 'Bertha', 'Brodie', 'Elspeth', 'Erling', 'Gibbie', 'Hakon', 'Inga', 'Jeemie', 'Kirsten', 'Lowrie', 'Magnie', 'Osla', 'Robbie', 'Sinna', 'Tammas', 'Wilma', 'Andrina', 'Eric', 'Freya', 'Geordie', 'Helga', 'Jemima', 'Lorna', 'Mansie', 'Ola', 'Sigurd', 'Thirza', 'Andrew', 'Barbara', 'Charlotte', 'Daniel', 'Grace', 'Gideon', 'Ingrid', 'Isobel', 'Laurence', 'Margaret', 'Ninian', 'Olaf', 'Peter', 'Rasmie', 'Sarah', 'Thomasina', 'Willa'],
    lastPre: ['Jamie', 'Hender', 'Ander', 'Lauren', 'Nicol', 'William', 'Thomas', 'Hugh', 'Magnus', 'Robert', 'Gilbert', 'Adam', 'Peter', 'Arthur', 'Christopher', 'Erasmus', 'Ninian', 'Olaf', 'Rasmus', 'Simon', 'Tammas', 'Gibbie', 'Lowrie', 'Mansie', 'Bertie', 'Gideon'],
    lastSuf: ['son', 'sen', 'son'],
    lastWhole: ['Tait', 'Sinclair', 'Isbister', 'Leask', 'Moar', 'Halcrow', 'Irvine', 'Inkster', 'Pottinger', 'Goudie', 'Mouat', 'Hunter', 'Umphray', 'Linklater', 'Spence', 'Flaws', 'Garriock', 'Fraser', 'Manson', 'Twatt'],
    values: ['seafaring', 'mercantile', 'martial'],
    lean: { economy: 1.3, warfare: 0.8 },
    cuisine: { dishes: ['fish_pie', 'seaweed_crisps'], word: 'fish pie and seaweed crisps', drink: 'peat whisky' },
    clothes: ['#e0b830', '#1e2e5a', '#7a7a84', '#c8c0b0', '#3a4a6a', '#5a5a64', '#a83a2a', '#2a3a4a', '#9a9aa4', '#e8e0d0'],
    pattern: 'collar',
    skins: ['#ecc8b0', '#e0b8a0', '#f4d4c0', '#d4aa90', '#e8c0a8', '#c89a80'],
    gods: {
      gods: ['the Beacon-Keeper', 'the Grey Sea', 'the Selkie Mother', 'the Storm Giant', 'the Puffin Saint', 'Old Finnman', 'the Drowned Bell'],
      faith: ['the Beacon Watch', 'the Selkie Rite', 'the Grey Covenant', 'the Fishers\' Oath', 'the Bell Below', 'the Storm Kirk'],
      feast: ['Up Helly Aa', 'the Beacon Night', 'the Selkie Moon', 'the First Catch', 'the Storm Vigil', 'the Puffin Return'],
      symbol: ['a beacon', 'a selkie skin', 'a puffin', 'a fishing boat', 'a bell', 'a rope knot'],
    },
    clergy: ['beacon-keeper', 'kirk-man', 'selkie-speaker', 'storm-reader'],
    rites: [2, 1, 3], beasts: ['the seal', 'the puffin', 'the gannet'],
    taboos: ['sacred_beast', 'holy_rest', 'no_hunting'], folk: 'skerries',
    founders: ['Erling', 'Hakon', 'Inga', 'Kirsten', 'Magnie', 'Osla', 'Sigurd', 'Tammas'],
    epithets: ['Beacon-Keeper', 'the Fisher', 'Storm-Eye', 'Selkie-Born', 'the Old Salt'],
    came: ['on a fishing fleet blown off course', 'following the cod north', 'to keep the beacons for the ships', 'when a selkie married a fisherman'],
    haunts: ['the selkies who take off their skins on the beach', 'Finnmen who row the fog', 'the trows who come out on Yule night', 'the drowned bell that rings before a storm'],
    places: ['the beacon cliff', 'the old broch', 'the sea stack', 'the selkie skerry'],
    ships: ['Beacon', 'Selkie', 'Grey Gannet', 'Storm Petrel', 'Puffin'],
    dfounders: ['the Wrecker', 'the Storm Roc', 'Old Finnman', 'the Beacon-Keeper Erling'],
    rite: 'bonfire',
    feastLook: { palette: 1, centre: [['campfire', 4]], centreWord: 'a bonfire of driftwood', light: ['lantern', 4], rugs: ['rug_blue'] },
  },
};

// --------------------------------------------------------------- their ways
// More of each far people: what befalls their towns over the years
// (`events`), their rulers of old (`chiefs`), how they build (`build`: block
// names, see world/settlement.buildingMats: wall and corner, floor, roof,
// `flat` roofs, the grander `civic` buildings' own, the roads and squares,
// their planking, the stone of a city's walls), the great thing in their
// squares (`piece`: see render/farpieces.js), how a far people's houses
// look in the picture of a hero's home town (`look`: see game/intros.js),
// and what they say of their land, of the storm far off in the south-west
// and of the islands inside it (`views`).
const MORE = {
  velari: {
    events: [
      (s) => `A Triumph was held in ${s.name}: the legions marched under a new arch with the spoils of a whole province behind them.`,
      () => 'The aqueduct broke in the great earthquake, and for a summer every drop was carried up from the river in jars.',
      (s) => `The Senate met in ${s.name} for a whole year while the capital burned, and the town never forgot the honour.`,
      () => 'A plague came in on a grain ship. The Emperor closed the gates, and the city lived; the ship\'s town did not.',
    ],
    chiefs: ['the Emperor Aurelian', 'the Empress Livia Magna', 'Consul Varro the Elder', 'the Legate Septimus Rufus'],
    look: { roofs: ['#b8482a', '#c45a34', '#a43e24'], wall: '#e8dcc0', timber: '#d8d0c0', shape: 'gable' },
    build: {
      wall: [['travertine', 4], ['plaster', 2], ['marble', 0.4]], corner: 'marble_column', floor: 'travertine', roof: [['roof_terracotta', 1]],
      civic: { wall: [['marble', 3], ['travertine', 2]], corner: 'marble_column', floor: 'marble', roof: [['roof_terracotta', 3], ['copper_roof', 1]] },
      road: ['gravel', 'flagstone', 'stone_bricks'], plaza: ['gravel', 'travertine', 'marble'], planks: 'planks', cityWall: 'travertine', barn: ['planks', 'log_oak'],
    },
    piece: 'triumph_column',
    views: {
      home: ['This is Velmarch, and the Empire is its heart. Every road on it was laid by a legion, and every road leads home.', 'North of the vineyards the land goes cold and the Rimeborn keep their reindeer. They were never conquered. They were never worth it, the Senate said.'],
      wall: ['Far to the south-west there is a storm that never ends. The augurs say the gods put it there to keep something in.', 'Ships that sail toward it come back with their sails in rags, if they come back at all.'],
      dagoni: ['Inside the storm? Islands, the old charts say: three of them. Nobody has been there in a thousand years.'],
    },
  },
  rime: {
    events: [
      () => 'The herds did not come back one spring. The noaidi drummed for nine nights, and on the tenth they came over the fell.',
      (s) => `The ice took the lake road to ${s.name} a week early, and a whole sledge train went down with it.`,
      () => 'The legions came north once. The Rimeborn let the winter fight for them, and only the eagles went home.',
      () => 'The northern lights came down so low one winter that the children could touch them. Nobody born that year has ever been cold.',
    ],
    chiefs: ['the Drum-King Sampo', 'Biret Bear-Sister', 'the Herdlord Aslak', 'Old Kerttu of the Lights'],
    look: { roofs: ['#4a6a34', '#566e3a', '#3e5a2c'], wall: '#3a3438', timber: '#2a2428', shape: 'steep' },
    build: {
      wall: [['log_frost', 4], ['planks_dark', 2]], corner: 'log_frost', floor: 'planks_dark', roof: [['roof_turf', 1]],
      civic: { wall: [['log_frost', 2], ['drystone', 2]], corner: 'log_frost', floor: 'planks_dark', roof: [['roof_turf', 2], ['roof_wood', 1]] },
      road: ['path', 'gravel', 'gravel'], plaza: ['gravel', 'cobblestone', 'cobblestone'], planks: 'planks_dark', cityWall: 'log_frost', barn: ['planks_dark', 'log_frost'],
    },
    piece: 'frost_hearth',
    views: {
      home: ['The north of Velmarch is ours: the fells, the frozen lakes and the herds. The south is the Empire\'s, and they are welcome to its heat.', 'In winter the sun does not rise for forty days. We keep the frost hearth burning, and we sing.'],
      wall: ['There is a storm in the south-west that the reindeer will not walk toward. The noaidi say it is the drum of a dead god.', 'Leave it be. Some things are not for going round.'],
      dagoni: ['Islands inside the storm, the old songs say. Warm ones. I would not know what to do with a warm island.'],
    },
  },
  jade: {
    events: [
      (s) => `The great river flooded, and the Emperor ordered a dyke built round ${s.name}; it took ten thousand hands and stands to this day.`,
      () => 'An examination was held for the whole realm, and a fisherman\'s son came first. He became Chancellor, and never forgot the river.',
      (s) => `A dragon was seen over the lake by ${s.name} at the Moon Festival. The harvest that year was the best in living memory.`,
      () => 'The silk worms sickened, and for three years the court wore cotton. The poets wrote that it was the saddest fashion in history.',
    ],
    chiefs: ['the First Emperor', 'the Jade Empress Lian', 'the Chancellor Bao the Unworried', 'General Feng of the Long Wall'],
    look: { roofs: ['#2a8a5a', '#2e9a62', '#24744c'], wall: '#f0e8d8', timber: '#a8202a', shape: 'steep' },
    build: {
      wall: [['paper_wall', 3], ['planks_lacquer', 1]], corner: 'planks_lacquer', floor: 'bamboo', roof: [['roof_jade', 1]],
      civic: { wall: [['planks_lacquer', 3], ['paper_wall', 1]], corner: 'planks_lacquer', floor: 'bamboo', roof: [['roof_jade', 1]] },
      road: ['path', 'flagstone', 'flagstone'], plaza: ['gravel', 'flagstone', 'stone_bricks'], planks: 'bamboo', cityWall: 'stone_bricks', barn: ['bamboo', 'planks_lacquer'],
    },
    piece: 'bell_pagoda',
    views: {
      home: ['Ostria\'s green east is the Middle Kingdom, and the Jade Throne is the middle of it. Everything else is the edge of the world.', 'The Keshari of the red canyons pay tribute when they feel like it, which is not often. The court pretends not to notice.'],
      wall: ['In the far south-west the sea is wrapped in a storm that has not ended since before the first dynasty. The sages call it the Knot.', 'The court astronomers say the stars over it are wrong.'],
      dagoni: ['There are said to be islands inside the Knot. The old maps mark them with a dragon curled round them, asleep.'],
    },
  },
  kesh: {
    events: [
      () => 'The rains did not come for seven years. The people climbed to the high mesa and danced until the thunderbird answered.',
      (s) => `A flash flood came down the wash in the night and took the lower houses of ${s.name}. They were built again higher up the cliff.`,
      () => 'The Jade Court sent an army into the canyons. The canyons sent back their banners, one by one, down the river.',
      (s) => `Turquoise was found in the cliff over ${s.name}: a whole seam of it, blue as the sky at noon.`,
    ],
    chiefs: ['the Sun-Priest Ahote', 'the Turquoise Queen Nayeli', 'Thunder-Voice Kele', 'Old Lomasi Rain-Bringer'],
    look: { roofs: ['#b8582e', '#a84e28'], wall: '#c8603a', timber: '#6a3a24', shape: 'flat' },
    build: {
      wall: [['adobe_red', 5], ['adobe', 1]], corner: 'adobe_red', floor: 'flagstone', roof: [['adobe_red', 1]], flat: true,
      civic: { wall: [['adobe_red', 3], ['turquoise_tile', 0.5]], corner: 'adobe_red', floor: 'turquoise_tile', roof: [['adobe_red', 1]], flat: true },
      road: ['path', 'flagstone', 'flagstone'], plaza: ['gravel', 'flagstone', 'turquoise_tile'], planks: 'planks', cityWall: 'adobe_red', barn: ['adobe_red', 'log_acacia'],
    },
    piece: 'sun_wheel',
    views: {
      home: ['The red canyons of Ostria are ours, and the mesas over them. We build up the cliffs where the floods cannot reach.', 'The Jade Court thinks the canyons are theirs. The canyons have their own opinion.'],
      wall: ['Away to the south-west, past the sea, there is a storm that has stood since the world was made. Spider Grandmother wove it, the elders say.', 'What she wove it round, she did not say.'],
      dagoni: ['Islands, inside the storm? Then there are people there, wondering about us.'],
    },
  },
  corrow: {
    events: [
      (s) => `A whale as long as the strand came ashore at ${s.name}. Its ribs are the roof of the council house still.`,
      () => 'The whales stopped coming for a whole generation. The bone-readers said they were angry, and the harpoons were hung up until they came back.',
      () => 'A ship from Velmarch put in for water and stayed a winter. Half the island has a Velari grandmother now.',
      (s) => `The fog lay on ${s.name} for a month, and the whale-singers sang the fleet home through it one boat at a time.`,
    ],
    chiefs: ['the Harpooner Torquil', 'Morag Whale-Bane', 'Old Angus the Bone-Carver', 'Isla Strand-Born'],
    look: { roofs: ['#5a7a3a', '#4e6a32'], wall: '#8a8274', timber: '#e8e0cc', shape: 'steep' },
    build: {
      wall: [['planks_drift', 3], ['drystone', 2]], corner: 'whalebone', floor: 'planks_drift', roof: [['roof_turf', 1]],
      civic: { wall: [['drystone', 3], ['whalebone', 0.6]], corner: 'whalebone', floor: 'planks_drift', roof: [['roof_turf', 1]] },
      road: ['path', 'gravel', 'gravel'], plaza: ['gravel', 'cobblestone', 'cobblestone'], planks: 'planks_drift', cityWall: 'drystone', barn: ['planks_drift', 'whalebone'],
    },
    piece: 'jaw_arch',
    views: {
      home: ['Corrow is a lonely rock between the two great lands, and the whales come here to die. We are what lives on what they leave.', 'Every house on the island has a whale in it somewhere: its ribs in the roof, its oil in the lamp.'],
      wall: ['South-west there is the storm. The whales go round it, and so do we.', 'On a still night you can hear it, like a sea that never stops breaking.'],
      dagoni: ['The whale-singers say there are islands inside the storm, and that the whales remember them.'],
    },
  },
  salt: {
    events: [
      (s) => `The best salt year anyone remembers: the pans of ${s.name} were white to the horizon, and the Republic paid off every debt it had.`,
      () => 'A great wave came in over the flats and turned a season\'s salt back into sea. The domes stood; nothing else did.',
      () => 'The flamingos did not come to the lagoon one spring, and the Doge was voted out the same week.',
      (s) => `A merchant of ${s.name} cornered the salt trade of all Ostria for a year, and was paid in jade by the Emperor's own treasurer.`,
    ],
    chiefs: ['Doge Kostas the Raker', 'the Salt Mother Rhea', 'Phaedra of the White Domes', 'Old Stavros Sun-Squinting'],
    look: { roofs: ['#3a7ab8', '#4a8ac8', '#f4f0e8'], wall: '#f4f0e8', timber: '#3a7ab8', shape: 'flat' },
    build: {
      wall: [['salt_brick', 5], ['plaster', 1]], corner: 'salt_brick', floor: 'tile_blue', roof: [['salt_brick', 1]], flat: true,
      civic: { wall: [['salt_brick', 4]], corner: 'salt_brick', floor: 'tile_blue', roof: [['tile_blue', 1]] },
      road: ['sand', 'flagstone', 'flagstone'], plaza: ['gravel', 'salt_brick', 'salt_brick'], planks: 'planks_birch', cityWall: 'salt_brick', barn: ['planks_birch', 'salt_brick'],
    },
    piece: 'salt_obelisk',
    views: {
      home: ['Saltmere is flat as a plate and white as one. We rake the pans, and the whole world puts our salt on its supper.', 'The lagoons are pink because of the shrimp, and the flamingos are pink because of the lagoons. Everything here is because of something else.'],
      wall: ['West of here, far off, the sky goes dark and stays dark. That is the storm. Our salt ships keep well clear.', 'Grandmother said a ship came out of it once, burnt black, and nobody on it would say a word.'],
      dagoni: ['Islands inside it? They would want salt, I expect. Everybody wants salt.'],
    },
  },
  hollow: {
    events: [
      (s) => `A new sinkhole opened in the night right under ${s.name}'s square. The Hollowfolk were delighted, and dug a market into its sides.`,
      () => 'The lantern trees went dark one autumn, every one. It was the longest winter in the burrows\' memory, until they lit again at midwinter.',
      () => 'Something came up from the deepest hollow and took the sheep. The burrow-wardens walled the shaft and never opened it again.',
      (s) => `A great moth, wings like sails, roosted on the moot-hall of ${s.name} for a week. It was taken for a blessing, and a new feast made of it.`,
    ],
    chiefs: ['the First Digger', 'Old Mother Hazel', 'Thane Burdock Deep-Digger', 'Sorrel Lantern-Bearer'],
    look: { roofs: ['#4a6a3a', '#5e7e48'], wall: '#8a6a48', timber: '#5a3a2a', shape: 'hut' },
    build: {
      wall: [['cob', 4], ['planks', 1]], corner: 'log_oak', floor: 'planks', roof: [['roof_moss', 1]],
      civic: { wall: [['cob', 3], ['mossy_bricks', 1]], corner: 'log_oak', floor: 'planks', roof: [['roof_moss', 1]] },
      road: ['path', 'path', 'gravel'], plaza: ['gravel', 'gravel', 'mossy_bricks'], planks: 'planks', cityWall: 'cob', barn: ['planks', 'log_oak'],
    },
    piece: 'lantern_tree',
    views: {
      home: ['Hollowmark is all holes, if you ask the sea-folk. We say it is all doors. The best houses are dug into the sides of the hollows, out of the wind.', 'The lantern trees light the bottoms at night. You never need a candle here.'],
      wall: ['There is a storm away west, the traders say, that never stops. We would just dig down until it went away.'],
      dagoni: ['Islands in the storm? I hope they have good soil. You can tell a lot about folk by their soil.'],
    },
  },
  wyrd: {
    events: [
      () => 'The standing stones moved one night, all of them, a full pace to the left. Nobody saw it happen. The seers would not discuss it.',
      (s) => `A child of ${s.name} was taken by the fair folk and came back seven years later, not a day older, speaking only in rhyme.`,
      () => 'The aurora stayed in the sky through a whole summer, and the crops grew in the night as well as the day.',
      (s) => `The ninth rune was carved again on the stone at ${s.name}. Everything went strange for a year, and then it went stranger.`,
    ],
    chiefs: ['the Witch of the Ninth Rune', 'Fionn the Seer', 'the Antlered King', 'Maeve of the Hollow Hill'],
    look: { roofs: ['#5a7a3a', '#4e6a34'], wall: '#8a8a84', timber: '#5a5a54', shape: 'hut' },
    build: {
      wall: [['drystone', 4], ['log_wall', 1]], corner: 'drystone', floor: 'planks_dark', roof: [['roof_turf', 1]],
      civic: { wall: [['drystone', 3], ['stone_bricks', 1]], corner: 'drystone', floor: 'flagstone', roof: [['roof_turf', 2], ['roof_slate', 1]] },
      road: ['path', 'path', 'gravel'], plaza: ['gravel', 'gravel', 'flagstone'], planks: 'planks_dark', cityWall: 'drystone', barn: ['planks_dark', 'drystone'],
    },
    piece: 'stone_ring',
    views: {
      home: ['The Wyrd Isle is never quite the same twice. The paths move. The hills are hollow. The stones listen.', 'The lights in the sky are the Lady\'s. On a good night they come right down to the circles and you can hear them hum.'],
      wall: ['The storm in the south? It is a door, of course. Everything is a door, if you know the rune for it.'],
      dagoni: ['The islands inside the storm are real. I have seen them in the smoke. I will not tell you what else I saw.'],
    },
  },
  skerry: {
    events: [
      () => 'The great gale of the year of the red moon took every boat off the beaches. The beacon burned all night, and every crew came home.',
      (s) => `A whale\'s worth of cod came into the voe at ${s.name} and the whole skerry salted fish for a month without stopping.`,
      () => 'A selkie wife went back to the sea and left seven children behind. Their great-great-grandchildren still swim better than anyone.',
      (s) => `Wreckers lit false lights on the stacks off ${s.name}, and a Velari grain ship went onto the rocks. The beacon-keepers hanged them on the cliff.`,
    ],
    chiefs: ['the Beacon-Keeper Erling', 'Earl Hakon Storm-Eye', 'Old Inga the Fisher', 'Sigurd Selkie-Born'],
    look: { roofs: ['#5a5a64', '#6a6a74'], wall: '#7a7a84', timber: '#3a3a44', shape: 'steep' },
    build: {
      wall: [['drystone', 5]], corner: 'drystone', floor: 'flagstone', roof: [['roof_rope', 1]],
      civic: { wall: [['drystone', 3], ['stone_bricks', 1]], corner: 'stone_bricks', floor: 'flagstone', roof: [['roof_slate', 2], ['roof_rope', 1]] },
      road: ['path', 'gravel', 'gravel'], plaza: ['gravel', 'cobblestone', 'cobblestone'], planks: 'planks_dark', cityWall: 'drystone', barn: ['planks_dark', 'drystone'],
    },
    piece: 'beacon',
    views: {
      home: ['The Grey Skerries are rock and heather and wind, and the best fishing in the world. Nothing grows taller than your knee.', 'We keep the beacons lit for the ships of all the lands. It is the one thing everybody agrees we are good for.'],
      wall: ['South of us is the storm. On a clear day you can see the top of it from the beacon cliff, like a mountain range made of cloud.', 'The fish will not go near it. That tells you enough.'],
      dagoni: ['There are islands in there, the old Finnmen say. They rowed in once. They rowed out again very fast.'],
    },
  },
};
for (const [k, m] of Object.entries(MORE)) Object.assign(FAR_PEOPLES[k], m);

// The great things in the far peoples' squares (blocks of their own: see
// world/blocks.js).
export const FAR_PIECES = Object.values(MORE).map((m) => m.piece);

export const FAR_STYLES = Object.keys(FAR_PEOPLES);
export const FAR_STYLE_SET = new Set(FAR_STYLES);

// A table of `field` by far people (for merging into the game's own
// tables: see names.js, culture.js...).
export function farTable(field, fn = null) {
  const out = {};
  for (const [k, P] of Object.entries(FAR_PEOPLES)) {
    const v = fn ? fn(P, k) : P[field];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// The people a square of a far land suits.
export function peopleFor(land, biome) {
  const F = FAR_LANDS[land];
  if (!F) return null;
  return (F.suits && F.suits[biome]) || F.peoples[0];
}

// Is a town (or realm) in the far lands?
export const isFar = (s) => !!(s && s.island && FAR_LANDS[s.island]);
// Are two towns (or realms) kept apart by the storm round the Dagoni
// Islands: one inside it, one beyond, while it stands? (See
// game/wallfall.js: once it's down, the world's open.)
export function cutOff(ow, a, b) {
  return !!(a && b && !(ow && ow.wallDown) && isFar(a) !== isFar(b));
}

// (Round 68) What a Kavorent core's worth to a town beyond the storm,
// against one inside it: with no spire of their own to learn from, the
// far lands want the old ones' power far more, and pay for it.
export const FAR_CORE = 2.6;
export const coreWorth = (s) => (isFar(s) ? FAR_CORE : 1);

// Is it a people of the far lands (not the Dagoni Islands')?
export const isFarStyle = (style) => FAR_STYLE_SET.has(style);
