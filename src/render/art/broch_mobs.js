// (Round 109) What lives in the Drowned Broch, painted by hand (see
// render/pixart.js): silhouette first, then colours, texture, light and
// shade, outline and highlights, frame by frame. Each faces left (the
// renderer flips it); its groups are which frames it moves, stands,
// strikes and flinches with (see sprites.lookFrame).

// The Trowie: a little grey trow up out of the walls, hunched, its head too
// big for it, a long drooping nose, great ears, a green glint in its eye,
// its arms long enough to knuckle the ground; a smock of rags. It scuttles;
// it lunges with its mouth wide and its fingers grabbing.
export const TROWIE = {
  size: 24,
  pal: { a: '#28282b', b: '#aaaab2', c: '#1d211c', d: '#82828a', e: '#8a967e', f: '#171a16', g: '#b0baa0', h: '#66725e', i: '#465044', j: '#0e1014', k: '#a0f080', l: '#2a3028', m: '#15100b', n: '#100d08', o: '#16191e', p: '#86745a', q: '#6a5844', r: '#4e4030', s: '#342a1e', t: '#1e1810', u: '#d0d0d6', v: '#040407', w: '#ffffff' },
  rows: [
    '........................',
    '........................',
    '........a...............',
    '.......abaa..cc.........',
    '......adaddaceef........',
    '.....cgggehdhhhf........',
    '....cgieeeeehhc.........',
    '....chjkgehilc..........',
    '....cegghhhilc..........',
    '...ceeehhhiilcmn........',
    '..chciolhiiilpqrn.......',
    '..chicghiillprrsrn......',
    '.cecc.cccmreqrrssn......',
    '..c......mthsrrrsrn.....',
    '........nreprrrrssn.....',
    '........nrhqrrsrstn.....',
    '........nrhqsssssn......',
    '........nthssssssn......',
    '.........fhtnnnrsn......',
    '........feffef.fef......',
    '........fhffif.fif......',
    '.......fefeif.fif.......',
    '........fehhifhhif......',
    '.........ffff.fff.......',
  ],
  frames: [
    {},
    { 2: '........................', 3: '........a...............', 4: '.......abaa..cc.........', 5: '......adaddaceef........', 6: '.....cgggehdhhhf........', 7: '....cgieeeeehhc.........', 8: '....chjkgehilc..........', 9: '....cegghhhilc..........', 10: '...ceeehhhiilcmn........', 11: '..chciolhiiilpqrn.......', 12: '..chicghiillprrsrn......', 13: '.cecc.cccmresrrssn......', 14: '..f......nthqrrrsrn.....', 15: '........nreprrsrssn.....', 16: '........nrhqsssrstn.....' },
    { 2: '.......a................', 3: '......abaa..cc..........', 4: '.....adaddaceec.........', 5: '....cgggehdhhhc.........', 6: '...cgieeeeehhc..........', 7: '...chjkgehilc...........', 8: '...cegghhhilc...........', 9: '..ceeehhhiilcmmn........', 10: '.chciolhiiilpqqrn.......', 11: '.chicghiillrrrrsrn......', 12: 'cecc.cccmpreqrrssn......', 13: '.c......mqthsrrrsrn.....' },
    { 2: '........................', 3: '.......a................', 4: '......abaa..cc..........', 5: '.....adaddaceec.........', 6: '....cgggehdhhhc.........', 7: '...cgieeeeehhc..........', 8: '...chjkgehilc...........', 9: '...cegghhhilc...........', 10: '..ceeehhhiilcmmn........', 11: '.chciolhiiilpqqrn.......', 12: '.chicghiillrrrrsrn......', 13: 'cecc.cccmpresrrssn......', 14: '.f......nqshqrrrsrn.....', 15: '........nqshqrsrssn.....', 16: '........nqthqssrstn.....', 17: '........ntessssssn......', 18: '.........fhthfhrsn......', 19: '.........fhffefef.......', 20: '.........fhffifif.......', 21: '........fefeifif........', 22: '.........fefhhif........', 23: '..........f.fff.........' },
    { 2: '.......a................', 3: '......abaa..cc..........', 4: '.....adaddaceec.........', 5: '....cgggehdhhhc.........', 6: '...cgieeeeehhc..........', 7: '...chjkgehilc...........', 8: '...cegghhhilc...........', 9: '..ceeehhhiilcmmn........', 10: '.chciolhiiilpqqrn.......', 11: '.chicghiillrrrrsrn......', 12: 'cecc.cccmpreqrrssn......', 13: '.c......mqthsrrrsrn.....' },
    { 2: '........................', 3: '.......a................', 4: '......abaa..cc..........', 5: '.....adaddaceec.........', 6: '....cgggehdhhhc.........', 7: '...cgieeeeehhc..........', 8: '...chjkgehilc...........', 9: '...cegghhhilc...........', 10: '..ceeehhhiilcmmn........', 11: '.chciolhiiilpqqrn.......', 12: '.chicghiillrrrrsrn......', 13: 'cecc.cccmpresrrssn......', 14: '.f......nqthqrrrsrn.....', 15: '........nreprrsrssn.....', 16: '........nthqsssrstn.....', 17: '........fepssssssn......', 18: '........fhrtnnnrsn......', 19: '.......feffef..nfef.....', 20: '.......fhffif...fif.....', 21: '......fefeif...fiff.....', 22: '.......fehif...fhhif....', 23: '........fff.....fff.....' },
    { 2: '........................', 3: '......a.................', 4: '.....abaa..cc...........', 5: '....adaddaceec..........', 6: '...cgggehdhhhc..........', 7: '..cgiehhhehhc...........', 8: '..chjkgehilc............', 9: '..cegghhhilcmmmn........', 10: '.ceuhueehilmpqqrn.......', 11: 'chvjjjjeiilrrrrsrn......', 12: 'checgehggehlqrrssn......', 13: 'eecgeehmpqqqsrrrsrn.....', 14: 'ffeffffnrrrrrrrrssn.....', 15: 'fefef...nqrrrrsrstn.....', 16: '.f.f....nqrrsssssn......', 17: '........nrsssssssn......', 18: '.........nrtnnnrsn......', 19: '..........nfef.fef......', 20: '...........fif.fif......', 21: '..........fif.fif.......', 22: '.........fhhifhhif......', 23: '..........fff.fff.......' },
    { 2: '........................', 3: '......a.................', 4: '.....abaa..cc...........', 5: '....adaddaceec..........', 6: '...cgggehdhhhc..........', 7: '..cgiehhhehhc...........', 8: '..chjkgehilc............', 9: '..cegghhhilcmmmn........', 10: '.ceuhueehilmpqqrn.......', 11: 'chvjjjjeiilrrrrsrn......', 12: 'checgehggehlqrrssn......', 13: 'eecgeehmpqqqsrrrsrn.....', 14: 'ffeffffnrrrrrrrrssn.....', 15: 'fefef...nqrrrrsrstn.....', 16: '.f.f....nqrrsssssn......', 17: '........nrsssssssn......', 18: '.........nrtnnnrsn......', 19: '..........nfef.fef......', 20: '...........fif.fif......', 21: '..........fif.fif.......', 22: '.........fhhifhhif......', 23: '..........fff.fff.......' },
    { 8: '....ceggwhhilc..........', 14: '........nreprwrrssn.....' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

// The Lantern-Bearer: a wrecker's boy in oilskins too big for him and a red
// knitted cap, the false light on a pole over his shoulder, glowing amber.
// Swinging it at you, he two-hands the pole.
export const LANTERN_BEARER = {
  size: 24,
  pal: { a: '#280707', b: '#15100c', c: '#e07070', d: '#1e1812', e: '#c44040', f: '#1f0505', g: '#0c0e10', h: '#3e444c', i: '#5a4a38', j: '#9a2424', k: '#4a3328', l: '#f4d8bc', m: '#dcb898', n: '#c09878', o: '#3a281f', p: '#ffd46a', q: '#ff9a2a', r: '#040407', s: '#16191e', t: '#94705a', u: '#6a4a3a', v: '#0e120f', w: '#6a8a7a', x: '#4a665a', y: '#344a40', z: '#0b0e0c', A: '#22302a', B: '#100d09', C: '#141a16', D: '#0e0e17', E: '#3e3e5a', F: '#2a2a40', G: '#030305', H: '#1e2228', I: '#fff8d0', J: '#090b0d', K: '#ffffff' },
  rows: [
    '........................',
    '.............a..........',
    '.b.........aaca.........',
    'bdbb......aeeeef........',
    'ghidbb...aeeejjjf.......',
    'hhhbidb..klllmno........',
    'ppqhgbdbbrsmnnto........',
    'ppqhg.bidklmntuo........',
    'qqqhg..bbidntukf........',
    'hhhg.....aeidjejf.......',
    'ggg......vwxydwyz.......',
    '.........vwyyAidBB......',
    '.........vymxAynidB.....',
    '........vwxwyAyyCBdB....',
    '........zwxxyAyACzB.....',
    '........zwxxyAyACz......',
    '........zxxxxyyyyz......',
    '.........zDEDDFDz.......',
    '..........DEDDFD........',
    '..........DEDDFD........',
    '..........DEDDFD........',
    '..........DEDDFD........',
    '.........GHHGHHG........',
    '..........GG.GG.........',
  ],
  frames: [
    {},
    { 6: 'IIqhgbdbbrsmnnto........', 7: 'IIqhg.bidklmntuo........' },
    {},
    { 1: '........................', 2: '.............a..........', 3: '.b.........aaca.........', 4: 'bdbb......aeeeef........', 5: 'ghidbb...aeeejjjf.......', 6: 'hhhbidb..klllmno........', 7: 'IIqhgbdbbrsmnnto........', 8: 'IIqhg.bidklmntuo........', 9: 'qqqhg..bbidntukf........', 10: 'hhhg.....aeidjejf.......', 11: 'ggg......vwxydwyz.......', 12: '.........vwyyAidBB......', 13: '.........vymxAynidB.....', 14: '........zwxwyAyyCBdB....', 15: '........zwxxyAyACzB.....', 16: '........zwxxyAyACz......', 17: '........zxxxxyyyyz......', 18: '.........zzDEFDzz.......', 19: '...........DEFD.........', 20: '...........DEFD.........', 21: '...........DEFD.........', 22: '..........GHHHG.........', 23: '...........GGG..........' },
    {},
    { 1: '........................', 2: '.............a..........', 3: '.b.........aaca.........', 4: 'bdbb......aeeeef........', 5: 'ghidbb...aeeejjjf.......', 6: 'hhhbidb..klllmno........', 7: 'IIqhgbdbbrsmnnto........', 8: 'IIqhg.bidklmntuo........', 9: 'qqqhg..bbidntukf........', 10: 'hhhg.....aeidjejf.......', 11: 'ggg......vwxydwyz.......', 12: '.........vwyyAidBB......', 13: '.........vymxAynidB.....', 14: '........zwxwyAyyCBdB....', 15: '........zwxxyAyACzB.....', 16: '........zwxxyAyACz......', 17: '........zxxxxyyyyz......', 18: '.........DEDzzDFD.......', 19: '.........DED..DFD.......', 20: '.........DED..DFD.......', 21: '........GDED..DFD.......', 22: '.......GHHG...GHHG......', 23: '........GG.....GG.......' },
    { 2: '...........aaca.........', 3: '..........aeeeef........', 4: '.........aeeejjjf.......', 5: 'bb.......klllmno........', 6: 'idbb.....rsmnnto........', 7: 'hbidbbb..klmntuo........', 8: 'hhgbiidbbktntukf........', 9: 'pqhgbbbidaejejejf.......', 10: 'pqhg...bbiidwAxyz.......', 11: 'qqhg.....vwyiidyz.......', 12: 'hhg......vymwAnidBB.....', 13: 'gg......vwxwyAxyCidB....' },
    { 2: '...........aaca.........', 3: '..........aeeeef........', 4: '.........aeeejjjf.......', 5: '.........klllmno........', 6: '.........rsmnnto........', 7: '.........klmntuo........', 8: '.........ktntukf........', 9: '.........aejejejf.......', 10: '.........vwwxAyCz.......', 11: '.........vwxyAACz.......', 12: '.........vymxAnyzBB.....', 13: '........vwxwyAyCiidB....', 14: '.......BzxyAiiidxzB.....', 15: '...BBBBiiiidwAxyCz......', 16: 'BBBiiidBzxxxxyyyyz......', 17: 'iidBBBB..zDEDDFDz.......', 18: 'hJB.......DEDDFD........', 19: 'hhJ.......DEDDFD........', 20: 'IqhJ......DEDDFD........', 21: 'IqhJ......DEDDFD........', 22: 'qqhJ.....GHHGHHG........', 23: 'hhJ.......GG.GG.........' },
    { 6: 'ppqhgbdbbrsmKnto........', 13: '........vwxwyKyyCBdB....' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

// The Fulmar: a stubby grey-and-white sea-bird, its bill thick and yellow
// with the tube on it. It sits its nest; spitting, it stretches its neck
// out and its bill gapes, the oil coming out of it.
export const FULMAR = {
  size: 24,
  pal: { a: '#606367', b: '#3e330e', c: '#ffffff', d: '#eef0f0', e: '#f4e8a0', f: '#282c32', g: '#76808a', h: '#0e1014', i: '#dcc868', j: '#d8dadc', k: '#8a8e94', l: '#1f2327', m: '#b8a040', n: '#b4b8bc', o: '#bcc4ca', p: '#98a2aa', q: '#56606a', r: '#4b4e51', s: '#3a4048', t: '#281f11', u: '#a88a50', v: '#31280b', w: '#d0b070', x: '#7a6234' },
  rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.......aaaa.............',
    '....b.acccda............',
    '...befghcddda...........',
    '..biiiicddjkaaflll......',
    '..bmiiicddjnjkoppgl.....',
    '...bbbadjjnoppgggqgl....',
    '.......rdjnpggogggqgl...',
    '.......rdjngqqqgoggqgll.',
    '......rcdjnjgqqqqqoqqsql',
    '.......rdddjcdjqqqqqlll.',
    '.......rddjdjjjcjjkr....',
    '........rdjdjjjnnkr.....',
    '.........rrdjnkkrr......',
    '..........ttrrtt........',
    '.........tuuttuut.......',
    '..........tt..tt........',
  ],
  frames: [
    {},
    {},
    {},
    { 8: '........................', 9: '.......aaaa.............', 10: '....b.acccda............', 11: '...befghcddda...........', 12: '..biiiicddjkaaflll......', 13: '..bmiiicddjnjkoppgl.....', 14: '...vvvrdjjnoppgggqgl....', 15: '.......rdjnpggogggqgl...', 16: '.......rdjngqqqgoggqgll.', 17: '......rcdjnjgqqqqqoqqsql', 18: '.......rdddjcdjqqqqqlll.', 19: '.......rddjdjjjcjjkr....', 20: '........rdjdjjjnnkr.....', 21: '.........rrdjnkkrr......', 22: '..........tuuwxt........', 23: '...........tttt.........' },
    { 21: '..........tuttut........', 22: '.........tuwxuwxt.......', 23: '..........tttttt........' },
    { 8: '........................', 9: '.......aaaa.............', 10: '....b.acccda............', 11: '...befghcddda...........', 12: '..biiiicddjkaaflll......', 13: '..bmiiicddjnjkoppgl.....', 14: '...vvvrdjjnoppgggqgl....', 15: '.......rdjnpggogggqgl...', 16: '.......rdjngqqqgoggqgll.', 17: '......rcdjnjgqqqqqoqqsql', 18: '.......rdddjcdjqqqqqlll.', 19: '.......rddjdjjjcjjkr....', 20: '........rdjdjjjnnkr.....', 21: '.........rrdjnkkrr......', 22: '..........tuuwxt........', 23: '...........tttt.........' },
    { 21: '..........tuttut........', 22: '.........tuwxuwxt.......', 23: '..........tttttt........' },
    { 8: '........................', 9: '.......aaaa.............', 10: '....b.acccda............', 11: '...befghcddda...........', 12: '..biiiicddjkaaflll......', 13: '..bmiiicddjnjkoppgl.....', 14: '...vvvrdjjnoppgggqgl....', 15: '.......rdjnpggogggqgl...', 16: '.......rdjngqqqgoggqgll.', 17: '......rcdjnjgqqqqqoqqsql', 18: '.......rdddjcdjqqqqqlll.', 19: '.......rddjdjjjcjjkr....', 20: '........rdjdjjjnnkr.....', 21: '.........tudjnkkrr......', 22: '........tuwxttuwxt......', 23: '.........ttt..ttt.......' },
    { 7: '.....aaaa...............', 8: 'bbbbacccda..............', 9: 'iiiighcjdda.............', 10: 'ibbaccjjjna.............', 11: 'iiiicdjjnnaaaaflll......', 12: 'bbbbadjnnkacdjoppgl.....', 13: '.....aaadngpppgggqgl....', 14: '.......rdjdpggogggqgl...', 18: '.......rddddjjjcjjkr....' },
    { 7: '.....aaaa...............', 8: 'bbbbacccda..............', 9: 'iiiighcjdda.............', 10: 'ibbaccjjjna.............', 11: 'iiiicdjjnnaaaaflll......', 12: 'bbbbadjnnkacdjoppgl.....', 13: '.....aaadngpppgggqgl....', 14: '.......rdjdpggogggqgl...', 18: '.......rddddjjjcjjkr....' },
    { 11: '..biiiiccdjkaaflll......', 16: '......rcdjnjgcqqqqoqqsql' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 2, 0.5], hurt: [10, 1, 0.2] },
};

export const BROCH_MOBS = { trowie: TROWIE, lantern_bearer: LANTERN_BEARER, fulmar: FULMAR };
