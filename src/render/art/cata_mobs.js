// (Round 103) What lives in the Imperial Catacomb, painted by hand (see
// render/pixart.js): silhouette first, then colours, texture, light and
// shade, outline and highlights, frame by frame. Each faces left (the
// renderer flips it); its groups are which frames it moves, stands,
// strikes, flinches and lies still with (see sprites.lookFrame).

// The Aquilifer: the legion's standard-bearer, dead and still bearing: a
// lion's pelt over its skull, the mane down its back, a shirt of bronze
// scales, a red tunic, bone legs; the gilt eagle high on its pole, a red
// ribbon under it. It strikes with the standard's butt.
export const AQUILIFER = {
  size: 24,
  pal: { a: '#332304', b: '#fff0a0', c: ['#ffe080', 0.05], d: ['#ffe080', 0.06], e: '#ecc848', f: '#1d1208', g: '#030203', h: '#100c10', i: '#c89a20', j: '#a8783c', k: '#d0a058', l: '#170e06', m: ['#ffe080', 0.01], n: '#150e08', o: '#745236', p: '#4e3218', q: '#a83024', r: '#7a5228', s: '#4a3218', t: '#0e0703', u: '#1d0505', v: '#28241c', w: '#e8dec0', x: '#c4b894', y: '#6a5e48', z: '#684828', A: '#ffe890', B: '#a07010', C: '#4e1010', D: '#120904', E: '#1a0e06', F: '#7e5422', G: '#523414', H: '#988a6c', I: '#3a3428', J: '#a87a36', K: '#100b06', L: '#523a26', M: '#36261a', N: '#1f1c16', O: '#170404', P: '#7a1c18', Q: ['#ffe080', 0.0], R: '#ffffff', S: '#fffbe0' },
  rows: [
    '.abacdcaea..............',
    '.aebaaaeea.f.f..........',
    '..ghbeeiaffjfjf.........',
    '...aeeiafjjkkjjl........',
    '...mnonfjhpjjjjjl.......',
    '....noqrpjfjjjjpst......',
    '....noqufvwxxyrzst......',
    '....noquvxAxByrsszt.....',
    '....noCuvwxxxyrssst.....',
    '....non..ghxhDssssEt....',
    '....nonvvfjjpFFGszt.....',
    '....nowwwxHIpJGFsst.....',
    '....noHvvfJFJFFGsEt.....',
    '....non..fFJFJGFzt......',
    '....KLK..lGMGMGMsHN.....',
    '....KLK..OqqqPPPNHN.....',
    '....KLK..OqCPCCCNIN.....',
    '....KLK..OqCCCCCON......',
    '....KLK..OCxCNHCO.......',
    '....KLK...NwNNHN........',
    '....KLK...NxNNHN........',
    '....KLK...NHNNHN........',
    '....KLK..NHxyHxyN.......',
    '.....K....NNNNNN........',
  ],
  frames: [
    {},
    { 0: '..a..Q..a...............', 1: '.abacdcaea.f.f..........', 2: '.aebaaaeeafjfjf.........', 3: '..ghbeeifjjkkjjl........', 4: '...aeeifjhpjjjjjl.......', 5: '...mnofrpjfjjjjpst......', 8: '....nouqvwxxxyrssst.....', 9: '....nouCughxhDssssEt....' },
    { 0: '..a..Q..a...............', 1: '.abacdcaea.f.f..........', 2: '.aebaaaeeafjfjf.........', 3: '..ghbeeifjjkkjjl........', 4: '...aeeifjhpjjjjjl.......', 5: '...mnofrpjfjjjjpst......', 8: '....nouqvwxxxyrssst.....', 9: '....nouCughxhDssssEt....', 18: '....KLK..OCOCHOCO.......', 19: '....KLK...ONwHNO........', 20: '....KLK....NxHN.........', 21: '....KLK....NHHN.........', 22: '....KLK...NHxyyN........', 23: '.....K.....NNNN.........' },
    {},
    { 0: '..a..Q..a...............', 1: '.abacdcaea.f.f..........', 2: '.aebaaaeeafjfjf.........', 3: '..ghbeeifjjkkjjl........', 4: '...aeeifjhpjjjjjl.......', 5: '...mnofrpjfjjjjpst......', 8: '....nouqvwxxxyrssst.....', 9: '....nouCughxhDssssEt....', 18: '....KLK..OCOCOOCO.......', 19: '....KLK..NwNO.NHN.......', 20: '....KLK..NxN..NHN.......', 21: '....KLK..NHN..NHN.......', 22: '....KLK.NHxyNNHxyN......', 23: '.....K...NNN..NNN.......' },
    {},
    { 0: '.aebaaaeea..............', 1: '..ghbeeia..f.f..........', 2: '...aeeia.ffjfjf.........', 3: '...mnonmfjjkkjjl........', 4: '....noqfjhpjjjjjl.......', 7: '....noCuvxAxByrsszt.....', 8: '....nonvvwxxxyrssst.....', 9: '....nowxvghxhDssssEt....', 10: '....noHvwxHjpFFGszt.....', 11: '....non.vfFxpJGFsst.....', 12: '....non..fJFJFFGsEt.....' },
    { 0: '..a..Q..a...............', 1: '.abacdcaea.f.f..........', 2: '.aebaaaeeafjfjf.........', 3: '..ghbeeifjjkkjjl........', 4: '...aeeifjhpjjjjjl.......', 5: '...mnofrpjfjjjjpst......', 8: '....nouqvwxxxyrssst.....', 9: '....nouCughxhDssssEt....', 10: '....nonu.fjjpFFGszt.....', 11: '....nonvvvwHpJGFsst.....', 12: '....nowwxHJFJFFGsEt.....', 13: '...novHvvfFJFJGFzt......', 14: '...KLKN..lGMGMGMsHN.....', 15: '...KLK...OqqqPPPNHN.....', 16: '...KLK...OqCPCCCNIN.....', 17: '...KLK...OqCCCCCON......', 18: '...KLK...OCxCNHCO.......', 19: '...KLK....NwNNHN........', 20: '...KLK....NxNNHN........', 21: '...KLK....NHNNHN........', 22: '...KLK...NHxyHxyN.......', 23: '....K.....NNNNNN........' },
    { 6: '....noqufvwRxyrzst......', 7: '....noquvxSxByrsszt.....', 12: '....noHvvfJFRFFGsEt.....', 16: '....KLK..OqCPCRCNIN.....' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

// The Grasping Hand: a dead arm out of the dark of a broken shelf-grave,
// bone and the last of its skin, a rag of shroud on it, its long fingers
// curling; it snatches. Lying (up out of the ossuary's bones): the arm
// up out of the floor, clawing.
export const LOCULUS_HAND = {
  size: 24,
  pal: { a: '#030203', b: '#0a080a', c: '#020202', d: '#28241c', e: '#e8dec0', f: '#988a6c', g: '#100c10', h: '#c4b894', i: '#6a5e48', j: '#1f1c16', k: '#ffffff' },
  rows: [
    '........abbbbbbbbbc.....',
    '........abbbbbbbbbc.....',
    '........abbbbdefbbc.....',
    '........agggaghigc......',
    '.........aaadeijc.......',
    '............defj........',
    '...........defej........',
    '...........dffdhj.......',
    '...........deifhj.......',
    '.......d..deiddjfj......',
    '......ded.dhid..j.......',
    '.....dedhdefd...........',
    '......dhhheid...........',
    '......ddhhfd............',
    '.....jehhfj.............',
    '......jjhj..............',
    '......jej...............',
    '.......j................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  frames: [
    {},
    { 9: '........d.deiddjfj......', 10: '.......deddhid..j.......', 11: '......dehdefd...........', 13: '.......dhhfd............', 14: '......jehfj.............', 15: '.......jhj..............', 16: '.......jej..............', 17: '........j...............' },
    { 9: '.........ddeiddjfj......', 10: '........dedhid..j.......', 11: '.......dedefd...........', 13: '.......dhhfd............', 14: '......jhhfj.............', 15: '.......jhj..............', 16: '........jej.............', 17: '.........j..............' },
    { 9: '........d.deiddjfj......', 10: '.......deddhid..j.......', 11: '......dehdefd...........', 13: '.......dhhfd............', 14: '......jehfj.............', 15: '.......jhj..............', 16: '.......jej..............', 17: '........j...............' },
    {},
    { 9: '........d.deiddjfj......', 10: '.......deddhid..j.......', 11: '......dehdefd...........', 13: '.......dhhfd............', 14: '......jehfj.............', 15: '.......jhj..............', 16: '.......jej..............', 17: '........j...............' },
    { 3: '........agggdeiggc......', 4: '.........aaadhijc.......', 5: '...........dhed.........', 6: '...........dhfej........', 7: '..........dhfddhj.......', 8: '.........deiddfhj.......', 9: '.........dhid.djfj......', 10: '........deid....j.......', 11: '........dhid............', 12: '...d.d.deid.............', 13: '..dedhddhid.............', 14: '.jejhheeij..............', 15: '..j.jhhfj...............', 16: '..jjhhfj................', 17: '.jejjhj.................', 18: '..jj.j..................', 19: '..jej...................', 20: '...j....................' },
    { 3: '........agggdeiggc......', 4: '.........aaadhijc.......', 5: '...........dhed.........', 6: '...........dhfej........', 7: '..........dhfddhj.......', 8: '.........deiddfhj.......', 9: '.........dhid.djfj......', 10: '........deid....j.......', 11: '........dhid............', 12: '...d.d.deid.............', 13: '..dedhddhid.............', 14: '.jejhheeij..............', 15: '..j.jhhfj...............', 16: '..jjhhfj................', 17: '.jejjhj.................', 18: '..jj.j..................', 19: '..jej...................', 20: '...j....................' },
    { 6: '...........dkfej........', 13: '......ddhkfd............' },
    { 0: '........................', 1: '........................', 2: '........................', 3: '........................', 4: '........................', 5: '........................', 6: '........................', 7: '........................', 8: '.........d..............', 9: '........ded.d...........', 10: '.......dedhded..........', 11: '........dhhhd...........', 12: '........ddhhfd..........', 13: '.......dehhfhd..........', 14: '........jjheij..........', 15: '........jejhij..........', 16: '.........jjhij..........', 17: '..........jfej..........', 18: '...........jhfj.........', 19: '..........jfhfj.........', 20: '......j...jjhij.........', 21: '....jjejjjejhiejjjjj....', 22: '...jffhffhffhifhffhfj...', 23: '....jjjjjjjjjjjjjjjj....' },
    { 0: '........................', 1: '........................', 2: '........................', 3: '........................', 4: '........................', 5: '........................', 6: '........................', 7: '........................', 8: '...........d............', 9: '..........dedd..........', 10: '.........dehded.........', 11: '.........dhhhd..........', 12: '..........dhhfd.........', 13: '.........dehfhd.........', 14: '..........jheij.........', 15: '..........jehij.........', 16: '...........jhij.........', 17: '...........jefj.........', 18: '...........jhfj.........', 19: '..........jfhfj.........', 20: '......j...jjhij.........', 21: '....jjejjjejhiejjjjj....', 22: '...jffhffhffhifhffhfj...', 23: '....jjjjjjjjjjjjjjjj....' },
    { 0: '........................', 1: '........................', 2: '........................', 3: '........................', 4: '........................', 5: '........................', 6: '........................', 7: '........................', 8: '...........d............', 9: '..........ded...........', 10: '.........deded..........', 11: '........dhhhd...........', 12: '.........dhhfd..........', 13: '........dhhfhd..........', 14: '.........jheij..........', 15: '..........jefj..........', 16: '..........jeij..........', 17: '..........jfej..........', 18: '...........jhfj.........', 19: '..........jfhfj.........', 20: '......j...jjhij.........', 21: '....jjejjjejhiejjjjj....', 22: '...jffhffhffhifhffhfj...', 23: '....jjjjjjjjjjjjjjjj....' },
    { 0: '........................', 1: '........................', 2: '........................', 3: '........................', 4: '........................', 5: '........................', 6: '........................', 7: '........................', 8: '.........d..............', 9: '........dedd............', 10: '.......dehded...........', 11: '.......dhhhd............', 12: '........dhhfd...........', 13: '.......dehfhd...........', 14: '........jheij...........', 15: '........jehij...........', 16: '.........jjhfj..........', 17: '..........jfej..........', 18: '..........jhffj.........', 19: '..........jffj..........', 20: '......j...jjhfj.........', 21: '....jjejjjejhiejjjjj....', 22: '...jffhffhffhifhffhfj...', 23: '....jjjjjjjjjjjjjjjj....' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 2, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2], rest: [9, 4, 2.6] },
};

// The Lemur: a restless shade of the unburied, grey and shrouded, you can
// see through it; its hood dark but for two pale eyes, its rags trailing;
// it reaches.
export const LEMUR = {
  size: 24,
  pal: { a: ['#28313a', 0.4], b: ['#7a8ca0', 0.66], c: ['#1f262e', 0.4], d: ['#a8b8c8', 0.74], e: ['#dce6ee', 0.85], f: ['#56667a', 0.58], g: ['#0a080a', 0.4], h: ['#3a4654', 0.5], i: '#ffffff', j: '#0a080a', k: '#e8f6ff', l: ['#050405', 0.4], m: '#c0e0ff' },
  rows: [
    '........................',
    '........................',
    '.........aaaaaa.........',
    '........abbbbbbc........',
    '........adefbbbc........',
    '........adgggbbhc.......',
    '.......adbijkbffc.......',
    '.......abdgjgfbfc.......',
    '.......addgggbbffc......',
    '.......adbdfbbbfhc......',
    '.......adbbbbbbhfc......',
    '.......abbdbbbfffc......',
    '.......abddbbfbfc.......',
    '......abaddbfbbfc.......',
    '......cbcddfbbbfc.......',
    '.....cddcdbbbbbhc.......',
    '......cc.cbcbbbc........',
    '........ccbbbcbcc.......',
    '.......cfccffcccfc......',
    '.......cfccfc..cfc......',
    '......chc.chhc..chc.....',
    '.......c...cc....c......',
    '........................',
    '........................',
  ],
  frames: [
    {},
    { 1: '.........aaaaaa.........', 2: '........abbbbbbc........', 3: '........adebfbbc........', 4: '........adgggbbfc.......', 5: '.......addijkbbhc.......', 6: '.......adbgjgbffc.......', 7: '.......abdgggfbffc......', 8: '.......adbdbfbbffc......', 10: '.......abdbbbbbhfc......', 11: '.......abbdbbbffc.......', 12: '......abaddbbfbfc.......', 14: '.....cddcddfbbbfc.......', 15: '......cc.cbbbcbc........', 16: '.......ccbbcbccbcc......', 17: '......cfcccffc.ccfc.....', 18: '......cfc..cffc.cfc.....', 19: '.......chc.chhc.chc.....', 20: '........c...cc...c......', 21: '........................' },
    { 16: '......cccbbcbccbc.......', 17: '.......cbcbccbccbc......', 18: '......cfc.ccffc.cfc.....', 19: '.......cfc..cfccfc......', 20: '........chcchhchc.......', 21: '.........c..cc.c........' },
    { 2: '........................', 3: '.........aaaaaa.........', 4: '........abbbbbbc........', 5: '........adebbbbc........', 6: '........abgggbffc.......', 7: '.......abdijkfbfc.......', 8: '.......addgjgbbfc.......', 9: '.......addgggbbfhc......', 11: '.......adbdbbbfffc......', 12: '.......abddbbfbffc......', 13: '.......abddbfbbfc.......', 15: '......cbddbbbbbhfc......', 16: '.....cdddbdbbbfffc......', 17: '......cccbcbccbcbc......', 18: '.......cfc.ccfccfc......', 19: '........cfccffcfc.......', 20: '........chchhcchc.......', 21: '.........c.cc..c........' },
    {},
    { 1: '.........aaaaaa.........', 2: '........abbbbbbc........', 3: '........adebfbbc........', 4: '........adgggbbfc.......', 5: '.......addijkbbhc.......', 6: '.......adbgjgbffc.......', 7: '.......abdgggfbffc......', 8: '.......adbdbfbbffc......', 10: '.......abdbbbbbhfc......', 11: '.......abbdbbbffc.......', 12: '......abaddbbfbfc.......', 14: '.....cddcddfbbbfc.......', 15: '......cc.cbbbcbc........', 16: '.......ccbbcbccbcc......', 17: '......cfcccffc.ccfc.....', 18: '......cfc..cffc.cfc.....', 19: '.......chc.chhc.chc.....', 20: '........c...cc...c......', 21: '........................' },
    { 16: '......cccbbcbccbc.......', 17: '.......cbcbccbccbc......', 18: '......cfc.ccffc.cfc.....', 19: '.......cfc..cfccfc......', 20: '........chcchhchc.......', 21: '.........c..cc.c........' },
    { 2: '........................', 3: '.........aaaaaa.........', 4: '........abbbbbbc........', 5: '........adebbbbc........', 6: '........abgggbffc.......', 7: '.......abdijkfbfc.......', 8: '.......addgjgbbfc.......', 9: '.......addgggbbfhc......', 11: '.......adbdbbbfffc......', 12: '.......abddbbfbffc......', 13: '.......abddbfbbfc.......', 15: '......cbddbbbbbhfc......', 16: '.....cdddbdbbbfffc......', 17: '......cccbcbccbcbc......', 18: '.......cfc.ccfccfc......', 19: '........cfccffcfc.......', 20: '........chchhcchc.......', 21: '.........c.cc..c........' },
    { 2: '.......aaaaaa...........', 3: '......abbbbbba..........', 4: '......abeddfbba.........', 5: '......abgggbbba.........', 6: '.....abbijkbbbfc........', 7: 'a....abbgjgbbfbc........', 8: 'eaaaaabblllbfbbfc.......', 9: 'abbbbabbdddfbbbfc.......', 10: 'deaaabbbbdbbbbbhc.......', 11: 'aabbbaabdbdbbbffc.......', 12: 'adaaabbbbddbbfbfc.......', 13: '.a...aaadddbfbbfc.......', 14: '.......cdddfbbbfc.......', 15: '........cdbbbbbhc.......', 16: '.........cbcbbbc........' },
    { 1: '.......aaaaaa...........', 2: '......abbbbbba..........', 3: '......abeddbfba.........', 4: '......abgggfbba.........', 5: '.....abbijkbbbbc........', 6: 'a....abbgjgbbbfc........', 7: 'eaaaaabblllbbfbfc.......', 8: 'abbbbabbdddbfbbfc.......', 9: 'deaaabbbbddfbbbfc.......', 10: 'aabbbbabddbbbbbhc.......', 11: 'adaaaabbbbdbbbffc.......', 12: '.a....aabddbbfbfc.......', 13: '.......adddbfbbfc.......', 14: '........cddfbbbfc.......', 15: '.........cbbbcbc........', 16: '.......ccbbcbccbcc......', 17: '......cfcccffc.ccfc.....', 18: '......cfc..cffc.cfc.....', 19: '.......chc.chhc.chc.....', 20: '........c...cc...c......', 21: '........................' },
    { 6: '.......adbmjkbffc.......' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 2, 0.5], hurt: [10, 1, 0.2] },
};

// The Fossor: a gravedigger's ghost, stooped and pale, a brown tunic and
// hood, his pick over his shoulder and his little clay lamp burning in
// his hand. He swings the pick.
export const FOSSOR = {
  size: 24,
  pal: { a: '#150e08', b: '#0c0c0e', c: '#09090b', d: '#202421', e: '#5a4028', f: '#5c5c64', g: '#748078', h: '#9eaaa0', i: '#100b06', j: '#523a26', k: '#030203', l: '#100c10', m: '#4e5852', n: '#2e3430', o: '#3a2818', p: '#7c5a3a', q: '#9c7650', r: '#1e140c', s: ['#ffc860', 0.06], t: ['#ffc860', 0.08], u: ['#ffc860', 0.15], v: '#4a1d04', w: ['#ffc860', 0.02], x: ['#ffc860', 0.12], y: '#ff9a2a', z: '#fff8d0', A: '#200f05', B: '#a8642e', C: '#80441e', D: '#190c04', E: '#552a12', F: '#191c1a', G: '#ccd6cc', H: '#ffffff' },
  rows: [
    '........................',
    '...........aaabc........',
    '.........daeeeffcc......',
    '........dgeeeebfffc.....',
    '.......dgghgeeaijfc.....',
    '.......klhmmea.iji......',
    '.......dhmmmneaji.......',
    '........dmmneopei.......',
    '........aqqperpoi.......',
    '...sts..aegpeopoi.......',
    '..tuvut.aenpeopoi.......',
    '.wxvyvxwdnqeeoeoi.......',
    '.wxvzvAdgBBBCCCei.......',
    '..tACABBnCqppeqoi.......',
    '...sDBBBBEqeeopoi.......',
    '.....DDDiqpeoreri.......',
    '.........FgFFgFi........',
    '.........FgFFgF.........',
    '.........FgFFgF.........',
    '.........FgFFgF.........',
    '.........FgFFgF.........',
    '.........FnFFnF.........',
    '........ioeooeoi........',
    '.........iiiiii.........',
  ],
  frames: [
    {},
    {},
    { 16: '.........iFGgFii........', 17: '..........FhmF..........', 18: '..........FhmF..........', 19: '..........FhmF..........', 20: '..........FhmF..........', 21: '..........FgnF..........', 22: '.........ioeooi.........', 23: '..........iiii..........' },
    {},
    { 16: '........FgFiiFgF........', 17: '........FgF..FgF........', 18: '........FgF..FgF........', 19: '........FgF..FgF........', 20: '........FgF..FgF........', 21: '........FnF..FnF........', 22: '.......ioeoiioeoi.......', 23: '........iii..iii........' },
    {},
    { 0: '..............bffffc....', 1: '...........aaabfiji.....', 2: '.........daeeeaciji.....', 3: '........dgeeeeaiji......', 4: '.......dgghgeeaiji......', 6: '.......dhmmmneaiji......', 7: '........dmmneopeji......' },
    { 1: '...........aaa..........', 2: '.........daeeea.........', 3: '........dgeeeea.........', 4: '.......dgghgeea.........', 5: '.......klhmmea..........', 6: '.......dhmmmneai........', 7: '..b.....dmmneopei.......', 8: '.bfbaaaaaqqperpoi.......', 9: '.bffjjjjaegpeopoi.......', 10: '.bfbvaaajenpeopoi.......', 11: '.bfvyvxwdnqeeoeoi.......', 12: '.wbvzvAdgBBBCCCei.......' },
    { 4: '.......dggHgeeaijfc.....', 10: '..tuvut.aenHeopoi.......', 12: '.wxvyvAdgBBBCCCei.......' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

export const CATA_MOBS = { aquilifer: AQUILIFER, loculus_hand: LOCULUS_HAND, lemur: LEMUR, fossor: FOSSOR };
