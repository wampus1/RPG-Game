// (Round 101) What works in the Kiln-Deep, painted by hand (see
// render/pixart.js): silhouette first, then colours, texture, light and
// shade, outline and highlights, frame by frame. Each faces left (the
// renderer flips it); its groups are which frames it moves, stands,
// strikes and flinches with (see sprites.lookFrame).

// The Ash-Smith: one of the sealed smiths, burnt to ash and still at the
// work: stooped and broad, its ash cracked with ember-light, two coals for
// eyes, a scorched leather apron, its hammer in hand; flakes of it drifting.
export const ASH_SMITH = {
  size: 24,
  pal: { a: '#191716', b: '#8e877e', c: '#b8b0a6', d: '#a83a0c', e: '#423e3a', f: '#66605a', g: '#fff0b0', h: '#ffc050', i: '#242220', j: '#131211', k: '#0a080a', l: '#522a14', m: '#0f0804', n: '#160c06', o: '#985630', p: '#743e20', q: '#32180c', r: '#f07a1a', s: '#0c0603', t: '#100905', u: '#543618', v: '#1e120a', w: '#08080b', x: '#545462', y: '#202028', z: '#0b0b0e', A: '#150c07', B: '#ffd060', C: '#ffffff' },
  rows: [
    '........................',
    '........................',
    '........................',
    '.......aaaab............',
    '......accbba.....c......',
    '.....acbdbefa...........',
    '.....acgfheia...........',
    '.....abbffiiaaaj........',
    '......akkelcccbfj.......',
    '.......aaelbeffefj......',
    '........aecfbfeiej......',
    '........mnbeoplbfbj.....',
    '.......abceolqqfrfj.....',
    '.......aceollqqfedj.....',
    '.......jbepnlqqfebfj....',
    '.......jbepllqqfebej....',
    '......jcfolllnqejcbj....',
    '.....jcffplllqqfjbej....',
    '......jespqqnqqfjfij....',
    '.....tutspqpqpnpjjj.....',
    '.....tvtwjccbbfij.......',
    '....wxxxxjcrdfeij.......',
    '....wyyyycbbbbbfj.......',
    '.....wwwjfeeeeeij.......',
  ],
  frames: [
    {},
    { 1: '..........b.............', 3: '.......aaaa...c.........', 4: '......accbba............', 6: '.....acgfheiaa..........', 7: '.....abbbfefbfaj........', 8: '......akkelcbfbfj.......', 10: '........aecfbfeiij......', 11: '.......abnbeoplbbfj.....', 12: '.......afceolqqfrej.....', 15: '.......jbepllqqfjbej....' },
    { 1: '...................c....', 3: '.......aaaa.............', 4: '......accbba............', 5: '.....acbdbefab.b........', 11: '........mlbeoplbfbj.....', 12: '.......abnbepqqfrfj.....', 13: '........aceolqqfedj.....', 14: '........jbenlqqfebfj....', 15: '........jbeplqqfebej....', 16: '.......jcfollnqejcbj....', 17: '......jcffpllqqfjbej....', 18: '.......jeoqqnqqsjfij....', 19: '.......tvpqpqpnpsjj.....', 20: '......tvtwjcbbfj........', 21: '.....wxxxxjrdfej........', 22: '.....wyyyycbbbfj........', 23: '......wwwjfeeeij........' },
    { 1: '...........b............', 3: '.......aaaa..b..........', 4: '......accbba....b.......', 6: '.....acgfheiaa..........', 7: '.....abbbfefbfaj........', 8: '......akkelcbfbfj.......', 10: '........aecfbfeiij......', 11: '.......abnbeoplbbfj.....', 12: '.......afceolqqfrej.....', 15: '.......jbepllqqfjbej....' },
    { 1: '..................c.....', 3: '.......aaaa........c....', 4: '......accbba............', 6: '.....acgfheiab..........', 11: '........acelpplbfbj.....', 12: '.......aceollqqfrfj.....', 13: '.......abepllqqfedj.....', 14: '......jceolnlqqfebfj....', 15: '......jbeplllqqfebej....', 16: '.....jcfsplllnqejcbj....', 17: '....jcffsplllqqfjbej....', 18: '.....jejspqqnqqbffij....', 19: '.....tvtspqpqpnpejj.....', 20: '....tvtwjcbfjjcfej......', 21: '...wxxxxjbfrjjbfej......', 22: '...wyyyycbbfjcbbfj......', 23: '....wwwjfeeijfeeij......' },
    { 1: '..............b.........', 3: '.......aaaa.............', 4: '......accbba.......c....', 7: '.....abbffiiaaaj...b....' },
    { 0: '......zyyyyz............', 1: '......acvAz.......b.....', 2: '.....acbfa.....b........', 3: '......afbaa.............', 4: '......accbca............', 5: '.....acedebba...........', 6: '.....abgbhfea...........', 7: '.....afefbffaaaj........', 8: '......akkbebccbfj.......', 9: '.......aabbfebfefj......', 10: '........afbebfeiej......', 11: '........moplpplbfbj.....', 12: '.......abplllqqfrfj.....', 13: '........mplllqqfedj.....', 14: '........splnlqqfebfj....', 15: '........splllqqfebej....', 16: '........splllnqejcbj....', 17: '........splllqqfjbej....', 18: '........spqqnqqfjfij....', 19: '........spqpqpnpjjj.....', 20: '.........jccbbfij.......', 21: '.........jcrdfeij.......', 22: '........jcbbbbbfj.......', 23: '........jfeeeeeij.......' },
    { 2: '...........bc...........', 3: '.......aaaa..c..........', 4: '......accbba............', 11: '........acelpplbfbj.....', 12: '.......aceollqqfrfj.....', 13: '..B..aaceolllqqfedj.....', 14: '...Bjccesplnlqqfebfj....', 15: 'B.tjcffjsplllqqfebej....', 16: 'wtuvjej.splllnqejcbj....', 17: 'xxxxwj..splllqqfjbej....', 18: 'yyyyw...spqqnqqfjfij....', 19: 'BwwwB...spqpqpnpjjj.....', 20: '.........jccbbfij.......', 21: '.........jcrdfeij.......', 22: '........jcbbbbbfj.......', 23: '........jfeeeeeij.......' },
    { 2: '............c...........', 3: '.......aaaa.............', 4: '......accbba............', 5: '.....acbdCefa....b......', 6: '.....acCfCeia...........', 12: '.......abceoCqqfrfj.....', 15: '.......jbepllqCfebej....' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

// The Bellowsback: a squat construct on four stubby iron legs, its face a
// plate with two slits of fire, a great leather bellows on its back and its
// bronze nozzle run forward over its head; it fills, and blows.
export const BELLOWSBACK = {
  size: 24,
  pal: { a: '#100905', b: '#9a6c36', c: '#150c07', d: '#1e120a', e: '#743e20', f: '#32180c', g: '#0c0603', h: '#1d1308', i: '#522a14', j: '#82602a', k: '#e8c878', l: '#b48c44', m: '#2a1c0c', n: '#523818', o: '#0f0804', p: '#0b0b0e', q: '#543618', r: '#08080b', s: '#828292', t: '#363642', u: '#545462', v: '#202028', w: '#101014', x: '#ffc050', y: '#985630', z: '#d8d2cc', A: '#ffffff', B: '#e8e4e0', C: '#c8c0b8' },
  rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '....................a...',
    '................aaaaba..',
    '.............ccabbbbda..',
    '..........cccbbbbeefeg..',
    '..hhhhhhhcbbbbeefeifeg..',
    '.hjkkklljmfeefeffeffeg..',
    '.hnhhhoiiifeffeffeffeg..',
    '..h.ppcqqqqqqqqqqqqqda..',
    '..rrstrssssssssuutrra...',
    '.rssssssuuutttttvvtwr...',
    '.ruvvvsutttvvvvvwwvwr...',
    '.rwxxuuuuuuuuuuuuuuutr..',
    '..rsutstttstttstttsvvr..',
    '..rtvvwvtvwvvvwvttwvvr..',
    '...rvvvvvvvvvvvvvvvvvr..',
    '....rrsttsssuutwuvrrr...',
    '....rsuuvutrrsuuvvtr....',
    '....rtvvvvwrrtvvvvwr....',
  ],
  frames: [
    {},
    { 6: '........................', 7: '...................aa...', 8: '..............caaaabba..', 9: '..........ccccbbbbbdeg..', 10: '..hhhhhhhcqbbbbyfeefeg..' },
    { 6: '........................', 7: '........................', 8: '.................aaaa...', 9: '...........ccccaabbbba..', 10: '..hhhhhhhhcbbbbbbbdfeg..', 11: '.hjkkklljmbbyfeefeefeg..' },
    { 6: '........................', 7: '...................aa...', 8: '..............caaaabba..', 9: '..........ccccbbbbbdeg..', 10: '..hhhhhhhcqbbbbyfeefeg..' },
    { 6: '........................', 7: '.................aaaa...', 8: '..............caabbbba..', 9: '..........ccccbbbbdfeg..', 10: '..hhhhhhhcbbbbeefeefeg..', 19: '..rtvvwvvvwvvvwvvvwvvr..', 21: '....rstrrsssuutwurrrr...', 22: '...rsuuuuuutrrsuutr.....', 23: '...rtvvvvvvwrrtvvwr.....' },
    { 6: '........................', 7: '...................aa...', 8: '..............caaaabba..', 9: '..........ccccbbbbbdeg..', 10: '..hhhhhhhcqbbbbyfeefeg..' },
    { 6: '........................', 7: '.................aaaa...', 8: '..............caabbbba..', 9: '..........ccccbbbbdfeg..', 10: '..hhhhhhhcbbbbeefeefeg..', 19: '..rtvvwvvvwvvvwvvtwvvr..', 21: '....rrrstsssuutwruvrr...', 22: '.....rsuutrrsuuuuvvtr...', 23: '.....rtvvwrrtvvvvvvwr...' },
    { 6: '........................', 7: '...................aa...', 8: '..............caaaabba..', 9: '..........ccccbbbbbdeg..', 10: '..hhhhhhhcqbbbbyfeefeg..' },
    { 5: '....................a...', 6: '.................aaaqa..', 7: '...............aabbbba..', 8: '............cccbbbyfeg..', 9: '.........cccqbbyfeifeg..', 10: '..hhhhhhcqbbyfeifeifeg..', 11: '.hjkkklljmfeffeffeffeg..' },
    { 6: '........................', 7: '........................', 8: '........................', 9: 'z.......................', 10: '.Ahhhhhhhhcccccaaaaaa...', 11: 'Bhjkkklljmbbbbbbbbbbba..', 12: '.znhhhoiiifeifeifeifeg..', 13: 'C.h.ppcqqqqqqqqqqqqqda..' },
    { 6: '........................', 7: '........................', 8: '................aaaaa...', 9: '...........ccccabbbbba..', 10: '..hhhhhhhhcbbbbAdeefeg..', 11: '.hjkkklljmbeefeefeffeg..', 16: '.ruvvvsutttvAvvvwwvwr...', 17: '.rwAAuuuuuuuuuuuuuuutr..', 18: '..rsutsttAstttstttsvvr..' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 2, 0.5], hurt: [10, 1, 0.2] },
};

// The Iron Warden: tall and heavy, riveted plate over a fire that shows
// through its seams, a helm with a T of light for a face, great pauldrons,
// its whole front a curved shield with a bronze boss, gauntlets like anvils.
export const IRON_WARDEN = {
  size: 24,
  pal: { a: '#0b0b0e', b: '#828292', c: '#545462', d: '#363642', e: '#202028', f: '#101014', g: '#ffc050', h: '#f07a1a', i: '#08080b', j: '#a83a0c', k: '#e8c878', l: '#82602a', m: '#523818', n: '#b48c44', o: '#ffd060', p: '#ffffff' },
  rows: [
    '..........aa............',
    '.........abca...........',
    '........abddda..........',
    '.......abceeefa.........',
    '.......aggggcda.........',
    '......aacheeeeaiii......',
    '.....abddjeeefabbci.....',
    '.....acebccdbbbccddi....',
    '....abbbddbfebbcddefi...',
    '....abccddefebbddefdi...',
    '....abccddefechdefbei...',
    '....acdeklceecddjfcei...',
    '...abdekkllcebcdefcei...',
    '...acdekllmcebcjefcei...',
    '...ibdddnmbdebcdffcei...',
    '...ibcbcbcdeebdefdefi...',
    '..ibdddbcddbedefibbci...',
    '..ibddebcdefeefbdcdei...',
    '...idfibbddjfbceedefi...',
    '....ii.ibcdefddeeiii....',
    '........ibddecdeei......',
    '........ibddecdeei......',
    '.......ibcccceeeei......',
    '.......ideeeeeeefi......',
  ],
  frames: [
    {},
    { 5: '......aacheeeeaiiii.....', 6: '.....abddjeeefbbbcdi....', 7: '....abdebccdbbbccdfi....', 8: '....abbbddbfebbcdefi....', 9: '....abccddefeccddefdi...', 15: '...ibcbcbcdeeceefdefi...', 17: '..ibddebcdefebccdcdei...', 18: '...idfibbddjfcdeedefi...' },
    { 12: '....acdekllcebcdefcei...', 13: '....acdenlmcebcjefcei...', 14: '....icdenmbdebcdffcei...', 15: '....ibcbbcdeebdefdefi...', 16: '...ibdddbcdbedefibbci...', 17: '...ibddebddeeefdicdei...', 18: '....idfbbcdjdfbeidefi...', 19: '.....iiibcbdefceiiii....', 20: '........iibddecei.......', 21: '.........ibddecei.......', 22: '........ibcccceei.......', 23: '........ideeeeefi.......' },
    { 5: '......aacheeeeaiiii.....', 6: '.....abddjeeefbbbcdi....', 7: '....abdebccdbbbccdfi....', 8: '....abbbddbfebbcdefi....', 9: '....abccddefeccddefdi...', 15: '...ibcbcbcdeeceefdefi...', 17: '..ibddebcdefebccdcdei...', 18: '...idfibbddjfcdeedefi...' },
    { 11: '...abddeklceecddjfcei...', 12: '...acdekkllcebcdefcei...', 14: '..ibcdefnmbdebcdffcei...', 15: '..ibcbbcccdeebdefdefi...', 16: '.ibdddbccddbedefibbci...', 17: '.ibddebcddefeefbdcdei...', 18: '..idfiibbdejiibeedefi...', 19: '...ii..ibddeiiddedii....', 20: '.......ibddeiicdeei.....', 21: '.......ibddeiicdeei.....', 22: '......ibcccdibeeeei.....', 23: '......ideeefideeefi.....' },
    {},
    { 0: '....aaa...aa............', 1: '...abbca.abca...........', 2: '...acdeaabddda..........', 3: '...acdecbceeefa.........', 4: '...adefdggggcda.........', 5: '....aabddheeeeaiii......', 6: '.....acdejeeefabbci.....', 7: '.....acbccdfbbbccddi....', 8: '....abbcddbfebbcddefi...', 9: '....abbcddefebbddefdi...', 11: '....abdeklceecddjfcei...', 12: '....abekkllcebcdefcei...', 13: '....abekllmcebcjefcei...', 14: '....ibddnmbdebcdffcei...', 15: '....ibbcccdeebdefdefi...', 16: '....ibccdddbedefibbci...', 17: '.....ibcddefeefbdcdei...', 18: '......ibbddjfbceedefi...', 19: '.......ibcdefddeeiii....' },
    { 9: '.o..abbcddefebbddefdi...', 10: 'oaaaabccddefechdefbei...', 11: 'abbcbddeklceecddjfcei...', 12: 'bddecbekkllcebcdefcei...', 13: 'bddeabekllmcebcjefcei...', 14: 'odefibddnmbdebcdffcei...', 15: '.iiiibbcccdeebdefdefi...', 16: '....ibccdddbedefibbci...', 17: '.....ibcddefeefbdcdei...', 18: '......ibbddjfbceedefi...', 19: '.......ibcdefddeeiii....' },
    { 4: '.......appppcda.........', 7: '.....acebccdbbbpcddi....', 11: '....acdeklcepcddjfcei...', 15: '...ibcbcbpdeebdefdefi...' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

export const FORGE_MOBS = { ash_smith: ASH_SMITH, bellowsback: BELLOWSBACK, iron_warden: IRON_WARDEN };
