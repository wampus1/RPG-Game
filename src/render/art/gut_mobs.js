// (Round 105) What lives in the Leviathan's Gut, painted by hand (see
// render/pixart.js): silhouette first, then colours, texture, light and
// shade, outline and highlights, frame by frame. Each faces left (the
// renderer flips it); its groups are which frames it moves, stands,
// strikes, flinches and lies still with (see sprites.lookFrame).

// The Gutworm: a pale worm out of its hole in the gut wall, thick as an
// arm, in rings; it rears and sways; its head a round mouth ringed in
// hooked teeth, red inside. Lunging, it stretches out low and opens wide.
export const GUTWORM = {
  size: 24,
  pal: { a: '#331d21', b: '#d4aca2', c: '#f0d8cc', d: '#6a1a24', e: '#c8bea0', f: '#e8e0c8', g: '#4a4338', h: '#1a0408', i: '#28171a', j: '#aa7a78', k: '#7a4a50', l: '#4a2a30', m: '#0a0406', n: '#020101', o: '#3a342c', p: '#ffffff' },
  rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '.........aaa............',
    '........abbba...........',
    '.......acdedfga.........',
    '......abddhddbbi........',
    '......abehhhebbji.......',
    '......abddhddbkjji......',
    '.......gfdedfkkjki......',
    '........abbbackkkli.....',
    '.........aaaacbkkkli....',
    '.............ackkkli....',
    '..............ickkkli...',
    '..............icbkkli...',
    '...............icbkkli..',
    '...............icbkkli..',
    '...............icbjkkli.',
    '................ibjkmmmn',
    '................ibkmmmmn',
    '.................ijmmmbi',
    '.................icckjli',
    '..................ibjki.',
  ],
  frames: [
    {},
    { 7: '......abddhddbkii.......', 8: '......abehhhebkbji......', 9: '......abddhddbkkjji.....', 10: '.......gfdedfkkkkli.....', 11: '........abbbaackkkli....', 12: '.........aaa.acbkkkli...', 13: '..............ackkkli...', 14: '..............icbkkkli..', 15: '...............icbkkli..', 17: '................icbkkli.', 18: '................icbkkli.', 20: '.................ijmmmmn' },
    {},
    { 6: '.......acdedfg..........', 7: '......abddhddba.........', 8: '......abehhhebbi........', 9: '......abddhddbbji.......', 10: '.......gfdedfkjjji......', 11: '........abbbckkkli......', 12: '.........aaacbkkkli.....', 13: '............ackkkkli....', 14: '.............ickkkli....', 15: '.............icbkkkli...', 16: '..............icbkkli...', 17: '..............icbkkkli..', 18: '...............icbkjkli.', 19: '...............icjjkmmmn' },
    {},
    { 7: '......abddhddbkii.......', 8: '......abehhhebkbji......', 9: '......abddhddbkkjji.....', 10: '.......gfdedfkkkkli.....', 11: '........abbbaackkkli....', 12: '.........aaa.acbkkkli...', 13: '..............ackkkli...', 14: '..............icbkkkli..', 15: '...............icbkkli..', 17: '................icbkkli.', 18: '................icbkkli.', 20: '.................ijmmmmn' },
    {},
    { 6: '.......acdedfg..........', 7: '......abddhddba.........', 8: '......abehhhebbi........', 9: '......abddhddbbji.......', 10: '.......gfdedfkjjji......', 11: '........abbbckkkli......', 12: '.........aaacbkkkli.....', 13: '............ackkkkli....', 14: '.............ickkkli....', 15: '.............icbkkkli...', 16: '..............icbkkli...', 17: '..............icbkkkli..', 18: '...............icbkjkli.', 19: '...............icjjkmmmn' },
    { 4: '........................', 5: '........................', 6: '........................', 7: '........................', 8: '........................', 9: '........................', 10: '........................', 11: '........................', 12: '.....aaa................', 13: '....abbbaaaa............', 14: '...icdedfckjiiii........', 15: '..ibdhhhdbckkbkliii.....', 16: '..ibehhhebckbkjkkjlii...', 17: '..ibdhhhdbckbkjkjkkjlii.', 18: '...ofdedfckbkkjkjkjkkjli', 19: '....ibbbiiiiickbkkkkmmmb', 20: '.....iii.....iiibjkmmmmj', 21: '................iijmmmck', 22: '..................iicbki', 23: '....................iii.' },
    { 4: '........................', 5: '........................', 6: '........................', 7: '........................', 8: '........................', 9: '........................', 10: '........................', 11: '........................', 12: '.....aaa................', 13: '....abbbaaaa............', 14: '...icdedfckjiiii........', 15: '..ibdhhhdbckkbkliii.....', 16: '..ibehhhebckbkjkkjlii...', 17: '..ibdhhhdbckbkjkjkkjlii.', 18: '...ofdedfckbkkjkjkjkkjli', 19: '....ibbbiiiiickbkkkkmmmb', 20: '.....iii.....iiibjkmmmmj', 21: '................iijmmmck', 22: '..................iicbki', 23: '....................iii.' },
    { 5: '........abpba...........', 12: '.........aaaacpkkkli....' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 2, 0.5], hurt: [10, 1, 0.2] },
};

// The Bile Blister: a sac swollen up out of the gut floor, its skin
// stretched thin and veined, the bile showing through it; it swells and
// slackens, and about to burst it is tight and bright.
export const BILE_BLISTER = {
  size: 24,
  pal: { a: '#2b3307', b: ['#6a8018', 0.7], c: ['#a0b828', 0.72], d: '#222805', e: ['#d0e050', 0.8], f: '#6a5aa0', g: ['#f0f8a0', 0.9], h: '#170408', i: '#76202a', j: '#ffffff' },
  rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.........aaaaaa.........',
    '.......aabccccbdd.......',
    '......abccceeccfbd......',
    '.....abcfgeeeeefcbd.....',
    '.....dbcefggeefecbd.....',
    '.....dccefggeefeccd.....',
    '.....dbceefgffeecbd.....',
    '.....dbceefgfeeecbd.....',
    '.....hdcceeeefeccdh.....',
    '....hiiiiiiiiiiiiiih....',
    '...hiiiiiiiiiiiiiiiih...',
    '....hhhhhhhhhhhhhhhh....',
    '........................',
    '........................',
  ],
  frames: [
    {},
    { 9: '.........aaaaaa.........', 10: '.......aabbccbbdd.......', 11: '......abccccccccbd......', 12: '.....abcceeeeeefcbd.....', 13: '.....abcfgegeeefcbd.....', 14: '....dbccefggeefeccbd....', 15: '....dbccefggeefeccbd....', 16: '.....dcceefgffeeccd.....' },
    { 8: '.........aaaaaa.........', 9: '.......aabbbbbbdd.......', 10: '......abbccccccbbd......', 11: '.....abccceeeecccbd.....', 12: '.....accgeeeeeefccd.....', 13: '....abccfeggeeefccbd....', 14: '....dbceefggeefeecbd....', 15: '....dbceefggeefeecbd....', 16: '....dbcceefgffeeccbd....', 17: '.....dcceefefeeeccd.....', 18: '.....dbccceeefcccbd.....' },
    { 9: '.........aaaaaa.........', 10: '.......aabbccbbdd.......', 11: '......abccccccccbd......', 12: '.....abcceeeeeefcbd.....', 13: '.....abcfgegeeefcbd.....', 14: '....dbccefggeefeccbd....', 15: '....dbccefggeefeccbd....', 16: '.....dcceefgffeeccd.....' },
    {},
    { 9: '.........aaaaaa.........', 10: '.......aabbccbbdd.......', 11: '......abccccccccbd......', 12: '.....abcceeeeeefcbd.....', 13: '.....abcfgegeeefcbd.....', 14: '....dbccefggeefeccbd....', 15: '....dbccefggeefeccbd....', 16: '.....dcceefgffeeccd.....' },
    { 8: '.........aaaaaa.........', 9: '.......aabbbbbbdd.......', 10: '......abbccccccbbd......', 11: '.....abccceeeecccbd.....', 12: '.....accgeeeeeefccd.....', 13: '....abccfeggeeefccbd....', 14: '....dbceefggeefeecbd....', 15: '....dbceefggeefeecbd....', 16: '....dbcceefgffeeccbd....', 17: '.....dcceefefeeeccd.....', 18: '.....dbccceeefcccbd.....' },
    { 9: '.........aaaaaa.........', 10: '.......aabbccbbdd.......', 11: '......abccccccccbd......', 12: '.....abcceeeeeefcbd.....', 13: '.....abcfgegeeefcbd.....', 14: '....dbccefggeefeccbd....', 15: '....dbccefggeefeccbd....', 16: '.....dcceefgffeeccd.....' },
    { 8: '........aaaaaaad........', 9: '.......acceeeeccd.......', 10: '......aceeeeeeeecd......', 11: '.....aceeggggggfecd.....', 12: '....aceeggggggfgeecd....', 13: '....acegfgggggfggecd....', 14: '....dceggfgggfgggecd....', 15: '....dceggfggffgggecd....', 16: '....dceeggfggfggeecd....', 17: '.....deegggggfggeed.....', 18: '.....dceeeggggfeecd.....' },
    { 6: '.........aaaaaa.........', 7: '.......aaccccccdd.......', 8: '......acceeeeeeccd......', 9: '.....aceeeggggeeecd.....', 10: '....aceeggggggggeecd....', 11: '....aeeggggggggfgeed....', 12: '...aceegfgggggfggeecd...', 13: '...aceegfgggggfggeecd...', 14: '...dceeggfgggfgggeecd...', 15: '...dceeggfggffgggeecd...', 16: '....deegggfggfgggeed....', 17: '....dceegggggfggeecd....', 18: '.....dceeeggggfeecd.....' },
    { 15: '.....dccefggjefeccd.....', 17: '.....dbcejfgfeeecbd.....' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 2, 0.5], hurt: [10, 1, 0.2] },
};

// The Ambergris Hermit: a hermit crab under a lump of ambergris it wears
// for its shell, its red legs and big claw out from under it, its eyes on
// stalks. Still, it draws in under the lump, and is a lump of ambergris.
export const AMBERGRIS_HERMIT = {
  size: 24,
  pal: { a: '#030102', b: '#100608', c: '#280e05', d: '#9a4420', e: '#201e1a', f: '#bab4a0', g: '#191814', h: '#948e7e', i: '#6e6a5e', j: '#4a4840', k: '#2e2c26', l: '#1f0b04', m: '#e88a50', n: '#c86434', o: '#3a1408', p: '#ffffff' },
  rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........a.............',
    '........aaba............',
    '.......abcdc.e..........',
    '.......cdcdcefegg.......',
    '.......cdeffffhhigg.....',
    '.......effhfjjkfifhg....',
    '.......efjkfhhfiiijg....',
    '...ll.gffhfhiihijjjig...',
    '..lmnlgffihhiiiikjjkg...',
    '.lnnnngijkfhjijkkhikg...',
    '.lnlnnddhhijkfhifkkg....',
    '..l.lllohfhihijjjkkg....',
    '.....ldllohihjjkkldl....',
    '.....ldldlgldjgldldl....',
    '.....lolol.lol.lolol....',
    '....lolol.lolol.lolol...',
    '.....l.l...l.l...l.l....',
  ],
  frames: [
    {},
    { 19: '.....ldlgghihjjkkldl....', 20: '.....lollollojlollol....', 21: '....lolldllololldllol...', 22: '...lol.lolol.lolol.lol..', 23: '....l...l.l...l.l...l...' },
    {},
    { 19: '.....ldlgghihjjkkldl....', 20: '.....lollollojlollol....', 21: '....lolldllololldllol...', 22: '...lol.lolol.lolol.lol..', 23: '....l...l.l...l.l...l...' },
    {},
    { 19: '.....ldlgghihjjkkldl....', 20: '.....lollollojlollol....', 21: '....lolldllololldllol...', 22: '...lol.lolol.lolol.lol..', 23: '....l...l.l...l.l...l...' },
    { 14: '..ll..gffhfhiihijjjig...', 15: '.lnmllgffihhiiiikjjkg...', 16: '.lnlnngijkfhjijkkhikg...', 17: '.lnnnnddhhijkfhifkkg....', 18: '..lllllohfhihijjjkkg....' },
    { 19: '.....ldlgghihjjkkldl....', 20: '.....lollollojlollol....', 21: '....lolldllololldllol...', 22: '...lol.lolol.lolol.lol..', 23: '....l...l.l...l.l...l...' },
    { 14: '...ll.gffhfhiphijjjig...', 16: '.lnnpngijkfhjijkkhikg...' },
    { 7: '........................', 8: '........................', 9: '........................', 10: '........................', 11: '........................', 12: '..........eeeeegg.......', 13: '.........effffhhig......', 14: '........gfffjjkfihg.....', 15: '.......gfjkfhhfiiiig....', 16: '......gffhfhiihijjjig...', 17: '......gffihhiiiikjjkg...', 18: '......gijkfhjijkkhikg...', 19: '.......ghhijkfhifkkg....', 20: '........gfhihjjkjkg.....', 21: '.........ghihjjkkg......', 22: '..........ggggggg.......', 23: '........................' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2], rest: [9, 1, 2.6] },
};

export const GUT_MOBS = { gutworm: GUTWORM, bile_blister: BILE_BLISTER, ambergris_hermit: AMBERGRIS_HERMIT };
