// (Round 107) What lives in the Deep Warren, painted by hand (see
// render/pixart.js): silhouette first, then colours, texture, light and
// shade, outline and highlights, frame by frame. Each faces left (the
// renderer flips it); its groups are which frames it moves, stands,
// strikes and flinches with (see sprites.lookFrame).

// The Gloom Moth: a great dun moth, its body thick and furred, its wings
// broad and soft with a faded eyespot on each, its antennae feathered; its
// wings beat; spread wide, it shakes its dust.
export const GLOOM_MOTH = {
  size: 24,
  pal: { a: '#1d1710', b: '#17120d', c: '#6e5e44', d: '#948062', e: '#4a3e2c', f: '#b8a484', g: '#a06a2a', h: '#6a4018', i: '#282016', j: '#3a2210', k: '#281e14', l: '#a89880', m: '#80705a', n: '#ccbea4', o: '#5a4a34', p: '#2a2218', q: '#1f1911', r: '#3a2e20', s: '#080504', t: '#d0c4a0', u: '#ffffff' },
  rows: [
    '........................',
    '.a..a...............b..b',
    'acaaca.............bcbbc',
    'ddddecaa..........bfcddd',
    'dcccccdda........bfcccee',
    'ddddccecca......bfeecddd',
    'adcccceedda....bfeeeccee',
    'adddeeghdccai.afeeghdddd',
    '.adceejeeeklmafceejfceeb',
    '.addcceceenllldccceccddb',
    '..adccceeenmmmdccecceeb.',
    '..adcceceenmmodcccecedb.',
    '...adceeeenomoceceeeeb..',
    '...aceeeepnmmoaceeeepb..',
    '....bpbbpqnomoqbpbbpb...',
    '.....b..bqlmmrq.b..b....',
    '.........qloorq.........',
    '..........qmrq..........',
    '...........qq...........',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
  ],
  frames: [
    {},
    { 1: '........................', 2: '......aa................', 3: '.a..aadda...........b..b', 4: 'acaacaacca.........bcbbc', 5: 'addadcaadda......bbfebdd', 6: 'fccdccdeaccai...bedecdee', 7: 'ddddcceecsklmiabfceecddd', 8: 'cecceeghdcnlllfdeeghdcee', 9: 'adddeejfeenmmmdceejfcddd', 10: '.aceccdeeenmmodccedccepb', 11: '..adeceeeenomoceceecedb.', 12: '...aceeeepnmmoaceeeepb..', 13: '....apaapinomoibpbbpb...', 14: '.....b..bqlmmrq.b..b....', 15: '.........qloorq.........', 16: '..........qmrq..........', 17: '...........qq...........', 18: '........................' },
    { 1: '........................', 2: '........................', 3: '......aa................', 4: '.....adda...............', 5: '......acca..............', 6: '.......adda.............', 7: '........accai...........', 8: '.aa.aa...sklmi.....bb.bb', 9: 'addafcaaainlllibbbbfcbdd', 10: 'adcdcccedcnmmmfddececdee', 11: 'ddddeeghdenmmodceeghdddd', 12: 'ceeeeejeeenomoceeejfceee', 13: 'adddeeeeepnmmoaceeeeeddd', 14: '.bbbcpbepqnomoqbcebcpbbb', 15: '....bb.bbqlmmrq.bb.bb...' },
    { 1: '........................', 2: '........................', 3: '........................', 4: '......aa................', 5: '.a..aadda...........b..b', 6: 'acaacaacca.........bcbbc', 7: 'addadcaadda......bbfebdd', 8: 'fccdccdeaccai...bedecdee', 9: 'ddddcceecsklmiabfceecddd', 10: 'cecceeghdcnlllfdeeghdcee', 11: 'adddeejfeenmmmdceejfcddd', 12: '.aceccdeeenmmodccedccepb', 13: '..adeceeeenomoceceecedb.', 14: '...bceeeepnmmobceeeepb..', 15: '....bpbbpqnomoqbpbbpb...', 16: '.....b..bqlmmrq.b..b....', 17: '.........qloorq.........', 18: '..........qmrq..........', 19: '...........qq...........' },
    {},
    { 1: '........................', 2: '......aa................', 3: '.a..aadda...........b..b', 4: 'acaacaacca.........bcbbc', 5: 'addadcaadda......bbfebdd', 6: 'fccdccdeaccai...bedecdee', 7: 'ddddcceecsklmiabfceecddd', 8: 'cecceeghdcnlllfdeeghdcee', 9: 'adddeejfeenmmmdceejfcddd', 10: '.aceccdeeenmmodccedccepb', 11: '..adeceeeenomoceceecedb.', 12: '...aceeeepnmmoaceeeepb..', 13: '....apaapinomoibpbbpb...', 14: '.....b..bqlmmrq.b..b....', 15: '.........qloorq.........', 16: '..........qmrq..........', 17: '...........qq...........', 18: '........................' },
    { 1: '........................', 2: '........................', 3: '......aa................', 4: '.....adda...............', 5: '......acca..............', 6: '.......adda.............', 7: '........accai...........', 8: '.aa.aa...sklmi.....bb.bb', 9: 'addafcaaainlllibbbbfcbdd', 10: 'adcdcccedcnmmmfddececdee', 11: 'ddddeeghdenmmodceeghdddd', 12: 'ceeeeejeeenomoceeejfceee', 13: 'adddeeeeepnmmoaceeeeeddd', 14: '.bbbcpbepqnomoqbcebcpbbb', 15: '....bb.bbqlmmrq.bb.bb...' },
    { 1: '........................', 2: '........................', 3: '........................', 4: '......aa................', 5: '.a..aadda...........b..b', 6: 'acaacaacca.........bcbbc', 7: 'addadcaadda......bbfebdd', 8: 'fccdccdeaccai...bedecdee', 9: 'ddddcceecsklmiabfceecddd', 10: 'cecceeghdcnlllfdeeghdcee', 11: 'adddeejfeenmmmdceejfcddd', 12: '.aceccdeeenmmodccedccepb', 13: '..adeceeeenomoceceecedb.', 14: '...bceeeepnmmobceeeepb..', 15: '....bpbbpqnomoqbpbbpb...', 16: '.....b..bqlmmrq.b..b....', 17: '.........qloorq.........', 18: '..........qmrq..........', 19: '...........qq...........' },
    { 1: '........................', 2: '........................', 3: '......aa................', 4: '..at.adda.............b.', 5: 'aadaa.acca..........tbdb', 6: 'fdcdcaaadda.......bbfdec', 7: 'ddddcdeaaccai....bedcddd', 8: 'dccccceeasklmi.bbeeeccee', 9: 'ddddeeghfcnlllafdeghdddd', 10: 'dccceejeeenmmmfceejfccee', 11: 'ddddcceceenmmodccceccddd', 12: 'cetecceeeenomodcceccceee', 13: 'adddeeeeepnmmoceeeeeetdd', 14: '.bbbcpbepqnomobceeeepbbb', 15: '....bb.bbqlmmrqbbbbbb...', 18: '......t....qq...........', 19: '.................t......' },
    { 1: '........................', 2: '........................', 3: '......aa................', 4: '..at.adda.............b.', 5: 'aadaa.acca..........tbdb', 6: 'fdcdcaaadda.......bbfdec', 7: 'ddddcdeaaccai....bedcddd', 8: 'dccccceeasklmi.bbeeeccee', 9: 'ddddeeghfcnlllafdeghdddd', 10: 'dccceejeeenmmmfceejfccee', 11: 'ddddcceceenmmodccceccddd', 12: 'cetecceeeenomodcceccceee', 13: 'adddeeeeepnmmoceeeeeetdd', 14: '.bbbcpbepqnomobceeeepbbb', 15: '....bb.bbqlmmrqbbbbbb...', 18: '......t....qq...........', 19: '.................t......' },
    { 10: '..adcccueenmmmdccecceeb.', 12: '...adceeeenouoceceeeeb..' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 2, 0.5], hurt: [10, 1, 0.2] },
};

// The Larder Grub: fat and pale, curled a little, in soft folds; its small
// brown head, its little legs, its gut dark through it. It inches.
export const LARDER_GRUB = {
  size: 24,
  pal: { a: '#605646', b: '#b4a688', c: '#fffaee', d: '#d8ccae', e: '#4b4437', f: '#f0e8d0', g: '#170e06', h: '#6e4624', i: '#b8844e', j: '#060403', k: '#1e160e', l: '#8a7c64', m: '#4a2e16', n: '#ffffff' },
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
    '........................',
    '........................',
    '.........aaaaa..........',
    '.......aabccbdae........',
    '......eccbddbbfbe.......',
    '....eebcfbddbdbbdee.....',
    '...eccbffbddbdbbbdbe....',
    '...ghhbcfhhhhhhbbbbe....',
    '..gihhbcfbdbbbbbbbbe....',
    '.jkhhcbbleeeeeebbbbe....',
    '..jggeegeg.....eeee.....',
    '......gmgmg.............',
    '.......g.g..............',
    '........................',
  ],
  frames: [
    {},
    { 11: '.........aa.............', 12: '........acfaaaa.........', 13: '......aabccbcfbe........', 14: '.....eccbfdbdbbde.......', 15: '....ebcfbddbdbbbde......', 16: '...ecbffbddbddbbbbe.....', 17: '...ghhccbhhhhhhbbble....', 18: '..gihhcfblleefbddble....', 19: '.jkhhbbleee..eedbbe.....', 20: '..jggeeg.g.....eee......' },
    {},
    { 11: '.........aa.............', 12: '........acfaaaa.........', 13: '......aabccbcfbe........', 14: '.....eccbfdbdbbde.......', 15: '....ebcfbddbdbbbde......', 16: '...ecbffbddbddbbbbe.....', 17: '...ghhccbhhhhhhbbble....', 18: '..gihhcfblleefbddble....', 19: '.jkhhbbleee..eedbbe.....', 20: '..jggeeg.g.....eee......' },
    { 11: '........aaaaaa..........', 12: '.......accbcfba.........', 13: '......abcfbddbde........', 14: '.....ecbffbddbdde.......', 15: '....eccbfdbddbbbbe......', 16: '...ebcfbfdbddbbbbde.....', 17: '...ghhcbdhhhhhhbble.....', 18: '..gihhfbleeeebddble.....', 19: '.jkhhcbbe....efbble.....', 20: '..jggeeg.g....eeee......' },
    { 11: '.........aa.............', 12: '........acfaaaa.........', 13: '......aabccbcfbe........', 14: '.....eccbfdbdbbde.......', 15: '....ebcfbddbdbbbde......', 16: '...ecbffbddbddbbbbe.....', 17: '...ghhccbhhhhhhbbble....', 18: '..gihhcfblleefbddble....', 19: '.jkhhbbleee..eedbbe.....', 20: '..jggeeg.g.....eee......' },
    { 11: '........aaaaaa..........', 12: '.......accbcfba.........', 13: '......abcfbddbde........', 14: '.....ecbffbddbdde.......', 15: '....eccbfdbddbbbbe......', 16: '...ebcfbfdbddbbbbde.....', 17: '...ghhcbdhhhhhhbble.....', 18: '..gihhfbleeeebddble.....', 19: '.jkhhcbbe....efbble.....', 20: '..jggeeg.g....eeee......' },
    { 16: '...eccbffbndbdbbbdbe....', 17: '...ghhbcfhhhhnhbbbbe....' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 1, 0.5], hurt: [7, 1, 0.2] },
};

// The Rootbound: one of the delvers, taken by the roots, its patched green
// coat half lost under them, one eye glowing pale in its face, roots trailing
// from it into the floor. Casting, it thrusts its arm down.
export const ROOTBOUND = {
  size: 24,
  pal: { a: '#332b1d', b: '#ddd0a8', c: '#bcaa82', d: '#151d0e', e: '#82a052', f: '#62803e', g: '#46602e', h: '#2e4020', i: '#1e2a14', j: '#e0ffb0', k: '#b0d880', l: '#10170b', m: '#080504', n: '#1e160e', o: '#140e0a', p: '#282217', q: '#968460', r: '#c08e66', s: '#28311f', t: '#ffffff' },
  rows: [
    '........................',
    '..........a.............',
    '.........aba............',
    '........aacaa...........',
    '.......accacca..........',
    '........deffgca.........',
    '.......dghgghgd.........',
    '......dijkfhghgl........',
    '......abbghhhhil........',
    '.......mnocbgid.........',
    '........diiibbcp........',
    '.......dghhhiiibp.......',
    '......abcghhhhhigl......',
    '......diqrcbghhhhl......',
    '......pcefiibbcgil......',
    '......pqghhhiiibbcp.....',
    '.....pcbbghhhrfiiqp.....',
    '.....pqlibcbgghilpcp....',
    '....pcp.liiibbccpppp....',
    '.....pqplhhhiilpqcpqp...',
    '......p.lhqlhqp.ppqpcp..',
    '........lhqlhqp...pcpp..',
    '.......pcqpcqp.....pqqp.',
    '........pp.pp.......pp..',
  ],
  frames: [
    {},
    {},
    {},
    { 1: '........................', 2: '..........a.............', 3: '.........aba............', 4: '........aacaa...........', 5: '.......accacca..........', 6: '........deffgca.........', 7: '.......dghgghgd.........', 8: '......dijkfhghgl........', 9: '......abbghhhhil........', 10: '.......mnocbgid.........', 11: '........diiibbcp........', 12: '.......dghhhiiibp.......', 13: '......abcghhhhhigl......', 14: '......liqrcbghhhhl......', 15: '......pcefiibbcgicp.....', 16: '......pqghhhiiibbqp.....', 17: '.....pcbbghhhrfiipcp....', 18: '.....pqlibcbgghilppp....', 19: '....pcp.liiibbcpqcpqp...', 20: '.....pqp.lfhiil.ppqpcp..', 21: '......p..lhhqp....pcpp..', 22: '........pccqp......pqqp.', 23: '.........ppp........pp..' },
    {},
    { 1: '........................', 2: '..........a.............', 3: '.........aba............', 4: '........aacaa...........', 5: '.......accacca..........', 6: '........deffgca.........', 7: '.......dghgghgd.........', 8: '......dijkfhghgl........', 9: '......abbghhhhil........', 10: '.......mnocbgid.........', 11: '........diiibbcp........', 12: '.......dghhhiiibp.......', 13: '......abcghhhhhigl......', 14: '......liqrcbghhhhl......', 15: '......pcefiibbcgicp.....', 16: '......pqghhhiiibbqp.....', 17: '.....pcbbghhhrfiipcp....', 18: '.....pqlibcbgghilppp....', 19: '....pcplhiiibbcpqcpqp...', 20: '.....pqlhqghiiqpppqpcp..', 21: '......plhqpllhqp..pcpp..', 22: '......pcqp.pcqp....pqqp.', 23: '.......pp...pp......pp..' },
    { 13: '......acircbghhhhl......', 14: '.....pcehfiibbcgil......', 15: '.....pqghhhhiiibbcp.....', 16: '....pcpbbghhhrfiiqp.....', 17: '...pcp.libcbgghilpcp....', 18: '..sks...liiibbccpppp....', 19: '.pcp....lhhhiilpqcpqp...', 20: 'pcpcp...lhqlhqp.ppqpcp..', 21: 'ppcpcp..lhqlhqp...pcpp..', 22: 'cpp.p..pcqpcqp.....pqqp.', 23: 'p.......pp.pp.......pp..' },
    { 13: '......acircbghhhhl......', 14: '.....pcehfiibbcgil......', 15: '.....pqghhhhiiibbcp.....', 16: '....pcpbbghhhrfiiqp.....', 17: '...pcp.libcbgghilpcp....', 18: '..sks...liiibbccpppp....', 19: '.pcp....lhhhiilpqcpqp...', 20: 'pcpcp...lhqlhqp.ppqpcp..', 21: 'ppcpcp..lhqlhqp...pcpp..', 22: 'cpp.p..pcqpcqp.....pqqp.', 23: 'p.......pp.pp.......pp..' },
    { 6: '.......dgtgghgd.........', 13: '......diqrctghhhhl......' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

export const WARREN_MOBS = { gloom_moth: GLOOM_MOTH, larder_grub: LARDER_GRUB, rootbound: ROOTBOUND };
