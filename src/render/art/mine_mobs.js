// (Round 96) The mine's own, painted by hand (see render/pixart.js): its
// silhouette first, then its colours, its texture, its light and shade, its
// outline and highlights, frame by frame. Each faces left (the renderer
// flips it); its groups are which frames it walks, stands, strikes,
// flinches and rests with (see sprites.lookFrame).

// The Lost Miner: hunched, head pushed forward under a felt cap with a
// tallow lamp still burning on its brow; a dust-grey face, ember eyes, a
// rusted neckerchief, a moleskin jacket white with dust; the pick over its
// shoulder, swung up high and brought down in front. Sits slumped on a bunk.
export const LOST_MINER = {
  size: 24,
  pal: { a: '#121216', b: '#a8acb4', c: '#72757e', d: '#0e0e11', e: '#86380b', f: '#4c4f58', g: '#ff9030', h: '#30323a', i: '#fff0b0', j: '#120e0c', k: '#281d09', l: '#6a4c1a', m: '#c49c48', n: '#6c5e4c', o: '#56493a', p: '#2c241e', q: '#1a1b20', r: '#40362c', s: '#130e08', t: '#5a4024', u: '#1a1512', v: '#19120b', w: '#765634', x: '#1d1d1e', y: '#46464a', z: '#66666a', A: '#88888a', B: '#a49670', C: '#665a42', D: '#17130d', E: '#e07028', F: '#463c2a', G: '#2a2a2c', H: '#6e2a1a', I: '#2e0e08', J: '#857858', K: '#200905', L: '#4a1a10', M: '#171718', N: '#2a2418', O: '#1f190e', P: '#7a663c', Q: '#3a2e1a', R: '#5a4a2a', S: '#0d0d0f', T: '#64646e', U: '#3a3a42', V: '#4e4e58', W: '#28282e', X: '#18181c', Y: '#070605', Z: '#524838', '0': '#3e362c', '1': '#2c2620', '2': '#1c1814', '3': '#0e0c0a', '4': '#a8a8a6', '5': '#9a7430', '6': '#1d1910', '7': '#190704', '8': '#ffffff', '9': '#0e0b09', '!': '#241a10', '#': '#5a2a18' },
  rows: [
    '............aaa.........',
    '...........abccdd.......',
    '......e...abffffcdd.....',
    '.....ege..ahaaahffcd....',
    '....egigejja...dhffcd...',
    '....klmnoopjj...dqffhd..',
    '....klnpppropj.stdffhd..',
    '...juuuuuupppjvws.dfhd..',
    '....jxyzAyrpBBBBCDdhd...',
    '....xAyEAyyBBCCCBCDd....',
    '.....xzAyyCFCCCCCFD.....',
    '......xGHHHIJCCCFFD.....',
    '.......KLHFJCCCCFCD.....',
    '......xvtJFFCFFFFFD.....',
    '.....MAzCFFlFFFFFND.....',
    '.....MzGOPPPPPPPPQO.....',
    '......MMDBRJJJJJJCD.....',
    '........DCFFFFCFFND.....',
    '.........STUSSTUSD......',
    '.........SVWSSFUS.......',
    '.........SVXSSUXS.......',
    '........YZ01YYZ01Y......',
    '........Y022YY022Y......',
    '........Y323YY123Y......',
  ],
  frames: [
    {},
    { 0: '........................', 1: '............aaa.........', 2: '...........abccdd.......', 3: '......e...abffffcdd.....', 4: '.....ege..ahaaahffcd....', 5: '....egigejja...dhffcd...', 6: '....klmnoopjj...dqffhd..', 7: '....klnpppropj.stdffhd..', 8: '...juuuuuupppjvws.dfhd..', 9: '....jxyzAyrpBBBJCDdhd...', 10: '....xAyEAyyBBCCCBCDd....', 11: '.....xzAyyCCCCCCFFD.....', 12: '......xGHHHIJCCCFCD.....', 13: '.......KLHFJJCCCFFD.....', 14: '......MstJFFFFFFFFD.....', 15: '.....MAzCFFlFCFFFND.....', 16: '.....MzGOPPPPPPPPQO.....', 17: '......MMDCRCCCJCCND.....' },
    { 18: '.........DSTVVUSDD......', 19: '..........SVWFWS........', 20: '..........SUWWXS........', 21: '.........YZ00001Y.......', 22: '.........Y022222Y.......', 23: '.........Y322223Y.......' },
    { 0: '........................', 1: '............aaa.........', 2: '...........abccdd.......', 3: '......e...abffffcdd.....', 4: '.....ege..ahaaahffcd....', 5: '....egigejja...dhffcd...', 6: '....klmnoopjj...dqffhd..', 7: '....klnpppropj.stdffhd..', 8: '...juuuuuupppjvws.dfhd..', 9: '....jxyzAyrpBBBJCDdhd...', 10: '....xAyEAyyBBCCCBCDd....', 11: '.....xzAyyCCCCCCFFD.....', 12: '......xGHHHIJCCCFCD.....', 13: '.......KLHFJJCCCFFD.....', 14: '......MstJFFFFFFFFD.....', 15: '.....MAzCFFlFCFFFND.....', 16: '.....MzGOPPPPPPPPQO.....', 17: '......MMDCRCCCJCCND.....' },
    { 18: '........STUSDDSTUS......', 19: '........SVWS..SFWS......', 20: '........SUWS..SUXS......', 21: '.......YZ01Y..YZ01Y.....', 22: '.......Y022Y..Y022Y.....', 23: '.......Y323Y..Y123Y.....' },
    { 0: '........................', 1: '............aaa.........', 2: '...........abccdd.......', 3: '......e...abffffcdd.....', 4: '.....ege..ahaaahffcd....', 5: '....egigejja...dhffcd...', 6: '....klmnoopjj...dqffhd..', 7: '....klnpppropj.stdffhd..', 8: '...juuuuuupppjvws.dfhd..', 9: '....jxyzAyrpBBBJCDdhd...', 10: '....xAyEAyyBBCCCBCDd....', 11: '.....xzAyyCCCCCCFFD.....', 12: '......xGHHHIJCCCFCD.....', 13: '.......KLHFJJCCCFFD.....', 14: '......MstJFFFFFFFFD.....', 15: '.....MAzCFFlFCFFFND.....', 16: '.....MzGOPPPPPPPPQO.....', 17: '......MMDCRCCCJCCND.....' },
    { 0: '..............abcccd....', 1: '.............abffffcd...', 2: '.......e.....ahdddqfhd..', 3: '......ege.....a..stfhd..', 4: '.....egigejj.....sthd...', 5: '.....klmnoopjj..swsd....', 6: '.....klnpppropjsts......', 7: '....juuuuuupppjsts......', 8: '.....jxyzAyrpBBBJCD.....', 9: '.....xAyEAyyBBFFCBCD....', 10: '......xzAyyCFF4zBFFD....', 11: '.......xGHHHICzGJFFD....', 12: '........KLHF5CJJCCFD....', 13: '.........6JFCFFFFFFD....', 14: '.........DCFlFFFFFFD....', 15: '.........OPPPPPPPPQO....', 16: '.........DBRJJJJJJCD....', 17: '.........DCFFFCFFFND....', 18: '.........STUSSTUSDD.....' },
    { 0: '........................', 1: '........................', 2: '........................', 3: '....e...................', 4: '...ege..................', 5: '..egigejj...............', 6: '..klmnoopjj.............', 7: '..klnpppropj............', 8: '.juuuuuupppj666.........', 9: '..jxyzAyrpBBBJCD........', 10: '..xAyEAyyBBCCCBCD.......', 11: '...xzAyyCFCJCCFFD.......', 12: '....xGHHHIJCCCFFD.......', 13: '.aa..KLHJCCCJCFFD.......', 14: 'dbcdM4zJFwJFFFFFD.......', 15: 'bcfqtzGtFlFFFCFND.......', 16: 'cffhdMOPPPPPPPPQO.......', 17: 'fhdd..DCRCCCCCJND.......', 18: 'hd.....DDSTUSSTUS.......', 19: 'd........SVWSSFUS.......' },
    { 0: '........................', 1: '........................', 2: '........................', 3: '........................', 4: '....e...................', 5: '...ege..................', 6: '..egigejj...............', 7: '..klmnoopjj.............', 8: '..klnpppropj............', 9: '.juuuuuupppj666.........', 10: '..jxyzAyrpBBBJCD........', 11: '..xAyEAyyBBJCCBCD.......', 12: '...xzAyyCFCCCCFFD.......', 13: '....xGHHHIJCJCFFD.......', 14: '.dd..7LHJCCCCCFFD.......', 15: 'dbcdM4zCFwJFFCFFD.......', 16: 'bcfqtzGtFlFFFFFND.......', 17: 'cffhdMOPPPPPPPPQO.......', 18: 'fhdd...ORSTUSSTUS.......', 19: 'hd......OSVWSSFUS.......', 20: 'd........SVXSSUXS.......' },
    { 0: '........................', 1: '.............aad........', 2: '............abccdd......', 3: '.......e...abffffcdd....', 4: '......ege..ahaadhffcd...', 5: '.....egigejja...dhffcd..', 6: '.....klmnoopjj...dqffhd.', 7: '.....klnpppropj.stdffhd.', 8: '....juuuuuupppjsws.dfhd.', 9: '.....jxyzAyrpBBBJCDdhd..', 10: '.....xAy8AyyBBCCJBCDd...', 11: '......xzAyyJFCCCCFFD....', 12: '.......xGHHHIJCCCCFD....', 13: '........KLHFBCCCCFFD....', 14: '.......MstJFFFFFFFCD....', 15: '......MAzCFFlCFFFFND....', 16: '......MzGOPPPPPPPPQO....', 17: '.......MMDCRCCJCCCND....', 18: '.........STUSSTUSDD.....' },
    { 0: '........................', 1: '........................', 2: '........................', 3: '.........e..............', 4: '........ege.............', 5: '.......egigejj..........', 6: '.......klmnoopj9........', 7: '.......klnppprop9.......', 8: '......juuuuuuppp9.......', 9: '.......jxyzAyrpCD.......', 10: '.......xAyEzyyBFD.......', 11: '........xzGBCCFFD.......', 12: '.a......KIBFHHICD.......', 13: 'aba......6JFBJCNDss.....', 14: 'bfd....sDCFFFNtttt!s....', 15: 'ffdsssstttttt!PPQOs.....', 16: 'ffqttt!zJCJJJJJCD.......', 17: 'fhdssMzGTUCFFFCND.......', 18: 'hd....STWVVUUXSD........', 19: 'd....STWSVWSSS..........', 20: '.....SVWSVUS............', 21: '....YSUXSUXS............', 22: '...YZ0000001Y...........', 23: '...Y12222223Y...........' },
    { 0: '........................', 1: '........................', 2: '........................', 3: '........................', 4: '.........k..............', 5: '........klkjjj..........', 6: '.......klmnoopj9........', 7: '.......klnppprop9.......', 8: '......juuuuuuppp9.......', 9: '.......jxyzAyrpCD.......', 10: '.......xAy#zyyBFD.......', 11: '........xzGBCCFFD.......', 12: '.a......KIBFHHICD.......', 13: 'aba......6JFBJCNDss.....', 14: 'bfd....sDCFFFNtttt!s....', 15: 'ffdsssstttttt!PPQOs.....', 16: 'ffqttt!zJCJJJJJCD.......', 17: 'fhdssMzGTUCFFFCND.......', 18: 'hd....STWVVUUXSD........', 19: 'd....STWSVWSSS..........', 20: '.....SVWSVUS............', 21: '....YSUXSUXS............', 22: '...YZ0000001Y...........', 23: '...Y12222223Y...........' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 3, 0.5], hurt: [9, 1, 0.2], rest: [10, 2, 2.6] },
};

// The Blast Beetle: a high glossy black dome, its seams glowing with the
// powder smouldering in it; a chestnut head, pale mandibles. Lit, it curls
// up into a ball, blazing at the seams, sparks off it.
export const BLAST_BEETLE = {
  size: 16,
  pal: { a: '#08070b', b: '#060508', c: '#6e6680', d: '#423c4c', e: '#4a1606', f: '#2a2632', g: '#090705', h: '#30241a', i: '#8a3010', j: '#1a1720', k: '#463626', l: '#170e08', m: '#0c0a10', n: '#8a6644', o: '#6a4a30', p: '#aa845a', q: '#f0d8a0', r: '#4a3020', s: '#070504', t: '#1e1610', u: '#0e0a08', v: '#d06420', w: '#5c4834', x: '#280c03', y: '#330f04', z: '#ffb050', A: '#fff0a0', B: '#ffffff' },
  rows: [
    '................',
    '................',
    '................',
    '................',
    '......aaaabbb...',
    '.....accddeffb..',
    '.g..acceddeffdb.',
    'ghgaccdidfifffjb',
    '.gkacdddiffifjjb',
    '.lbkdddfiffijjjm',
    'lnnoodffiffijjmb',
    'pnqrrdfffiffijjb',
    'prrrrjjjjijjijjb',
    'lplskbffjjjmmts.',
    '.l.susstustusts.',
    '..sus.suusuussus',
  ],
  frames: [
    {},
    { 5: '.....accddiffb..', 6: '.g..acciddiffdb.', 7: 'ghgaccdvdfvfffjb', 8: '.gkacdddvffvfjjb', 9: '.lbkdddfvffvjjjm', 10: 'lnnoodffvffvjjmb', 11: 'pnqrrdfffvffvjjb', 12: 'prrrrjjjjvjjvjjb' },
    { 13: 'lpllskffjjjmmbb.', 14: '.l..sutusbstus..', 15: '...susuus.suuus.' },
    { 4: '................', 5: '......aaaabbb...', 6: '.....accddeffb..', 7: '.g..acceddeffdb.', 8: 'ghgaccdidfifffjb', 9: '.skbcdddiffifjjb', 10: '.lbkdddfiffijjjm', 11: 'lnnoodffiffijjmb', 12: 'pnqrrdfffiffijjb', 13: 'prrrrjjjjijjijjb', 14: 'lplskbffjjjmmts.', 15: '.lsus.suusuussus' },
    { 13: 'lpsksbffjjjmmsts', 14: '.lsus.bstwusbsts', 15: '.sus...shuus..su' },
    { 4: '................', 5: '......aaaabbb...', 6: '.....accddiffb..', 7: '.g..acciddiffdb.', 8: 'ghgaccdvdfvfffjb', 9: '.skbcdddvffvfjjb', 10: '.lbkdddfvffvjjjm', 11: 'lnnoodffvffvjjmb', 12: 'pnqrrdfffvffvjjb', 13: 'prrrrjjjjvjjvjjb', 14: 'lplskbffjjjmmts.', 15: '.lsus.suusuussus' },
    { 3: '.............x..', 4: '..y.....a...xzx.', 5: '.yzy.aaadabb.x..', 6: '..y.accvvvvfb...', 7: '...accvddfvvfb..', 8: '...advvvvvvfvb..', 9: '..bcvdvfffvfvjb.', 10: '..bdddfffffiimb.', 11: '..bddfffffijimb.', 12: '...bfffffjjiib..', 13: '...bronfjjmmmb..', 14: '....bffjjmmmb...', 15: '.....bbbmbbb....' },
    { 1: '............x...', 2: '...y.......xAx..', 3: '..yAy.......x...', 4: '...y....a.......', 5: '.....aaadabb..x.', 6: '.y..accAAAAfbxAx', 7: 'yAyaccAddfAAfbx.', 8: '.y.adAAAAAAfAb..', 9: '..bcAdAfffAfAjb.', 10: '..bdddfffffzzmb.', 11: '..bddfffffzjzmb.', 12: '...bfffffjjzzb..', 13: '...bronfjjmmmb..', 14: '....bffjjmmmb...', 15: '.....bbbmbbb....' },
    { 5: '.....accddvffb..', 6: '.g..accvddvffdb.', 7: 'ghgaccdzdfzfffjb', 8: '.gkacdddzffzfjjb', 9: '.lbkdddfzffzjjjm', 10: 'lnnoodffzffzjjmb', 11: 'pnBrrdfffzffzjjb', 12: 'prrrrjjjjzjjzjjb' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

// The Firedamp: a billowing pale yellow-green cloud with a face in it
// you're not sure of; wisps curling off it. It swells, and blows.
export const FIREDAMP = {
  size: 16,
  pal: { a: ['#98ac6e', 110], b: ['#b8ca8a', 160], c: ['#d6e4aa', 200], d: ['#f0f8d0', 228], e: ['#7a8a58', 60], f: ['#3e4a30', 150], g: ['#2e3824', 190] },
  rows: [
    '................',
    '................',
    '.....abba.......',
    '...abcddcbba....',
    '..abcdddccdb....',
    '.abcdddccccbbaa.',
    '.abcddccccccbbae',
    '.abfcdcccfcbbae.',
    '..abcccccccbbae.',
    '..abcccfcccbbae.',
    '...abccgccbaae..',
    '...aabcccbba....',
    '....eaabbae..e..',
    '.....e.aae..e...',
    '......e..e.e....',
    '.......e........',
  ],
  frames: [
    {},
    { 1: '......abb.......', 2: '....abcddba.....', 3: '...abcdddcbb....', 4: '..abcdddcccbbaa.', 5: '.abcdddcccccbbe.', 9: '..abcccfcccbba..', 11: '...aabcccbba.e..', 12: '....eaabbaaee...', 13: '.....ea.e.ee....', 14: '.....e...e......', 15: '......e.........' },
    { 2: '....abb..abba...', 3: '...abcddbbcdca..', 4: '..abcdddcccdcba.', 5: '.abcdddcccccbba.', 11: '...aabcccbbae...', 12: '....eaabbae.e...', 13: '......eaa.e..e..', 14: '.....e..e....e..', 15: '........e.......' },
    { 1: '.......abba.....', 2: '....abbcddcb....', 3: '...abcdddccba...', 4: '..abcdddcccbba..', 5: '.abcdddcccccbba.', 7: '.abfcdcccfcbbaee', 10: '...abccgccbaa...', 11: '...aabcccbba.e..', 12: '....eaabbae.e...', 13: '.....eeaae.e....', 14: '.......e.e......', 15: '................' },
    { 1: '....abb.abba....', 2: '..abcddcddccba..', 3: '.abcdddddccccba.', 4: 'abcdddddcccccbba', 5: 'abcdddcccccccbae', 6: 'abcddccccccccbae', 7: 'abcfcdcccfccbbae', 8: 'abccccccccccbbae', 9: '.abccfggfcccbb..', 10: '.abccggggccbba..', 11: '..abccccccbba...', 12: '...aabbccbaae...', 13: '....eaabba.e....', 14: '.....e.e.e..e...', 15: '................' },
    { 9: 'aaabcfgfcccbbae.', 10: 'bcbafgggccbaae..', 11: 'abaaabccccbba...', 12: '.e..eaabbae..e..' },
    { 1: '......bcc.......', 2: '....bcdddcb.....', 3: '...bcdddddcc....', 4: '..bcdddddddccbb.', 5: '.bcdddddddddcca.', 6: '.bcdddddddddccba', 7: '.bccdddddcdccba.', 8: '..bcdddddddccba.', 9: '..bcdddcdddccb..', 10: '...bcddcddcbba..', 11: '...bbcdddccb.a..', 12: '....abbccbbaa...', 13: '.....ab.a.aa....', 14: '.....a...a......', 15: '......a.........' },
  ],
  groups: { walk: [0, 4, 0.62], attack: [4, 2, 0.5], hurt: [6, 1, 0.2], idle: [0, 4, 0.62] },
};

// The Knocker: little and grey as the rock, a long drooping nose, big ears,
// a wispy beard, a leather cap and apron; a little hammer to knock with.
export const KNOCKER = {
  size: 16,
  pal: { a: '#150e08', b: '#33241a', c: '#634a34', d: '#100b06', e: '#1d1e20', f: '#45484a', g: '#64686a', h: '#868a8a', i: '#171819', j: '#a8aca8', k: '#0c1014', l: '#e8f0f0', m: '#8e8e88', n: '#d4d4cc', o: '#b4b4ac', p: '#4a4a47', q: '#3a3a38', r: '#4a3626', s: '#2a2c2e', t: '#1e140c', u: '#5a4024', v: '#241a10', w: '#0e0e11', x: '#a8acb4', y: '#4c4f58', z: '#130e08', A: '#1a1b20', B: '#7c5e44', C: '#ff8080' },
  rows: [
    '.....abcba......',
    '....abcccbdd....',
    '...abcccccbbd...',
    '...efgghhhhhi...',
    '..ejfklhgghhi...',
    '.ehjghhffgffi...',
    '.ehhjffffffi....',
    '..ehhmnonfi.....',
    '...pmononmqi....',
    '....qmonmjhgi...',
    '....ighhgggfgi..',
    '....drhsrhgffi..',
    '....dtgutbgffi..',
    '.....ibvihfii...',
    '....iwxyyhfi....',
    '...igggsigfsi...',
  ],
  frames: [
    {},
    { 0: '......aaa.......', 1: '.....abcba......', 2: '....abcccbdd....', 3: '...abcccccbbd...', 4: '...efgghhhhhi...', 5: '..ejfklhgghhi...', 6: '.ehjghhffgffi...', 7: '.ehhjffffffi....', 8: '..ehhmnonfi.....', 9: '...qmononmqi....', 10: '....qmonmjhgi...', 11: '....ighhgggfgi..', 12: '....dthsthgffi..', 13: '.....isvibgffi..', 14: '....iwxyyhfii...' },
    { 11: '....drhsrhfffi..', 12: '....dtsutbfffi..', 13: '.....dbvgfiii...', 14: '.....wxyygi.....', 15: '....iggggfsi....' },
    { 0: '......aaa.......', 1: '.....abcba......', 2: '....abcccbdd....', 3: '...abcccccbbd...', 4: '...efgghhhhhi...', 5: '..ejfklhgghhi...', 6: '.ehjghhffgffi...', 7: '.ehhjffffffi....', 8: '..ehhmnonfi.....', 9: '...qmononmqi....', 10: '....qmonmjhgi...', 11: '....ighhgggfgi..', 12: '....dthsthgffi..', 13: '.....isvibgffi..', 14: '....iwxyyhfii...' },
    { 13: '....ijbvzihfi...', 14: '...iigxyyihfi...', 15: '..iggfsiwigfsi..' },
    { 0: '......aaa.......', 1: '.....abcba......', 2: '....abcccbdd....', 3: '...abcccccbbd...', 4: '...efgghhhhhi...', 5: '..ejfklhgghhi...', 6: '.ehjghhffgffi...', 7: '.ehhjffffffi....', 8: '..ehhmnonfi.....', 9: '...qmononmqi....', 10: '....qmonmjhgi...', 11: '....ighhgggfgi..', 12: '....dthsthgffi..', 13: '.....isvibgffi..', 14: '....iwxyyhfii...' },
    { 0: '.....abcbawwww..', 1: '....abcccbxyyyw.', 2: '...abcccccyyyAw.', 3: '...efgghhhhhuz..', 4: '..ejfklhgghhuz..', 5: '.ehjghhffgffvz..', 6: '.ehhjffffffuz...', 7: '..ehhmnonhfvz...', 8: '...pmononhfi....', 9: '....qmonmhfgi...', 10: '....ismogggfgi..', 11: '....dBccrhgffi..', 12: '....drbbtbgffi..', 13: '.....ibgihfii...', 14: '....iihfihfi....', 15: '...iggfsigfsi...' },
    { 0: '......aaa.......', 1: '.....abcba......', 2: '....abcccbdd....', 3: '...abcccccbbd...', 4: '...efgghhhhhi...', 5: '..ejfklhgghhi...', 6: '.ehjghhffgffi...', 7: '.ehhjffffffi....', 8: '..ehhmnonfi.....', 9: 'ww.qmononmqi....', 10: 'xyw.qmonmjhgi...', 11: 'yywzighhgggfgi..', 12: 'yyuuuvhfthgffi..', 13: 'yAwzzibfibgffi..', 14: 'ww..iihfihfii...', 15: '...iggfsigfsi...' },
    { 0: '......aaa.......', 1: '.....abcba......', 2: '....abcccbdd....', 3: '...abcccccbbd...', 4: '...efgghhhhhi...', 5: '..ejfCChgghhi...', 6: '.ehjghhffgffi...', 7: '.ehhjffffffi....', 8: '..ehhmnonfi.....', 9: '...qmononmqi....', 10: '....qmonmjhgi...', 11: '....ighhgggfgi..', 12: '....dthsthgffi..', 13: '.....isvibgffi..', 14: '....iwxyyhfii...' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

export const MINE_MOBS = { lost_miner: LOST_MINER, blast_beetle: BLAST_BEETLE, firedamp: FIREDAMP, knocker: KNOCKER };
