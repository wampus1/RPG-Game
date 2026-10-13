// (Round 106) What lives in the Salt Cathedral, painted by hand (see
// render/pixart.js): silhouette first, then colours, texture, light and
// shade, outline and highlights, frame by frame. Each faces left (the
// renderer flips it); its groups are which frames it moves, stands,
// strikes and flinches with (see sprites.lookFrame).

// The Salt Raker: one of the dead rakers, hunched in a cowled smock gone
// white and stiff with salt, crystals grown along its shoulders, two pale
// points in the cowl's hollow; its long rake held out before it. Striking,
// it swings the rake up and down, and hauls it back.
export const SALT_RAKER = {
  size: 24,
  pal: { a: '#313942', b: '#e4f0fa', c: '#413e44', d: '#3e4854', e: '#fcfafa', f: '#bcb8bc', g: '#333135', h: '#e2dede', i: '#ffffff', j: '#8e8a90', k: '#16141a', l: '#5e5a62', m: '#171310', n: '#867868', o: '#5a5862', p: '#2a241e', q: '#a89a88', r: '#64584a', s: '#1d1915', t: '#463c32' },
  rows: [
    '........................',
    '................a.......',
    '...............aba......',
    '............ccdba.......',
    '...........cefcgg.a.....',
    '..........ceffhhhaia....',
    '.........ceeeejjaba.....',
    '.........cfjjffjfg......',
    '........cfbkfffjjg.a....',
    '........clkkbhffjfaba...',
    '.........clkkhjffjfga...',
    '..........cehjjffjjaba..',
    '..........chjlhhfjjga...',
    '..........chjheffjjg....',
    '..........gefhjffjjfg...',
    '........mmnhjjohjohjg...',
    '.......mnpghffjffjjjg...',
    '......mpmmghffjffjjlg...',
    '....mmpm..ghjjohjofg....',
    'mmmmqpm...gjhjhjhjhjg...',
    'nrrrrm.....ggjgghggg....',
    'rmrmrm......gjgghg......',
    'egegeg.....gjfgjfg......',
    'g.g.g.......gg.gg.......',
  ],
  frames: [
    {},
    {},
    { 1: '........................', 2: '................a.......', 3: '...............aba......', 4: '............ccdba.......', 5: '...........cefcgg.a.....', 6: '..........ceffhhhaia....', 7: '.........ceeeejjaba.....', 8: '.........cfjjffjfg......', 9: '........cfbkfffjjg.a....', 10: '........clkkbhffjfaba...', 11: '.........clkkhjffjfga...', 12: '..........cehjjffjjaba..', 13: '..........chjlhhfjjga...', 14: '..........ghjhfffjjg....', 15: '.........mgeffohjohfg...', 16: '........mrnhffjffjjjg...', 17: '......mmnmghffjffjjjg...', 18: '.....mrpm.ghjjohjohjg...', 19: 'mmmmmpmm..gjhjhjhjhjg...' },
    { 1: '........................', 2: '................a.......', 3: '...............aba......', 4: '............ccdba.......', 5: '...........cefcgg.a.....', 6: '..........ceffhhhaia....', 7: '.........ceeeejjaba.....', 8: '.........cfjjffjfg......', 9: '........cfbkfffjjg.a....', 10: '........clkkbhffjfaba...', 11: '.........clkkhjffjfga...', 12: '..........cehjjffjjaba..', 13: '..........chjlhhfjjga...', 14: '..........ghjhfffjjg....', 15: '.........mgeffohjohfg...', 16: '........mrnhffjffjjjg...', 17: '......mmnmghffjffjjjg...', 18: '.....mrpm.ghjjohjohjg...', 19: 'mmmmmpmm..gjhjhjhjhjg...' },
    {},
    { 1: '........................', 2: '................a.......', 3: '...............aba......', 4: '............ccdba.......', 5: '...........cefcgg.a.....', 6: '..........ceffhhhaia....', 7: '.........ceeeejjaba.....', 8: '.........cfjjffjfg......', 9: '........cfbkfffjjg.a....', 10: '........clkkbhffjfaba...', 11: '.........clkkhjffjfga...', 12: '..........cehjjffjjaba..', 13: '..........chjlhhfjjga...', 14: '..........ghjhfffjjg....', 15: '.........mgeffohjohfg...', 16: '.......mmnphffjffjjjg...', 17: '......mrnmghffjffjjjg...', 18: '....mmpmm.ghjjohjohjg...', 19: 'mmmmrpm...gjhjhjhjhjg...', 20: 'rrrrmm.....gjgggghgg....', 21: 'mrmrm......gjg..ghg.....', 22: 'gegeg.....gjfg.gjfg.....', 23: '.g.g.......gg...gg......' },
    {},
    { 1: '........................', 2: '................a.......', 3: '...............aba......', 4: '............ccdba.......', 5: '...........cefcgg.a.....', 6: '..........ceffhhhaia....', 7: '.........ceeeejjaba.....', 8: '.........cfjjffjfg......', 9: '........cfbkfffjjg.a....', 10: '........clkkbhffjfaba...', 11: '.........clkkhjffjfga...', 12: '..........cehjjffjjaba..', 13: '..........chjlhhfjjga...', 14: '..........ghjhfffjjg....', 15: '.........mgeffohjohfg...', 16: '.......mmnphffjffjjjg...', 17: '......mrnmghffjffjjjg...', 18: '....mmpmm.ghjjohjohjg...', 19: 'mmmmrpm...gjhjhjhjhjg...', 20: 'rrrrmm.....gggjhgggg....', 21: 'mrmrm........gjhg.......', 22: 'gegeg.......gjjfg.......', 23: '.g.g.........ggg........' },
    { 0: '....srsrsrs.............', 1: '....srrrrrs.....a.......', 2: '.....sssrs.....aba......', 3: '.......sps..ccdba.......', 4: '........srscefcgg.a.....', 5: '........srceffhhhaia....', 6: '........spfeeejjaba.....', 7: '.........srfjffjfg......', 8: '........cfrkfffjjg.a....', 9: '........clnkbhffjfaba...', 10: '.........clrkhjffjfga...', 11: '..........snffjffjjaba..', 12: '..........cfpfhhfjjga...', 13: '..........chefhffjjg....', 14: '..........ghffjffjjfg...', 15: '..........ghjjohjohjg...', 16: '..........ghffjffjjjg...', 17: '..........ghffjffjjlg...', 18: '..........ghjjohjofg....', 19: '..........gjhjhjhjhjg...', 20: '...........ggjgghggg....', 21: '............gjgghg......', 22: '...........gjfgjfg......', 23: '............gg.gg.......' },
    { 14: '.........mgefhjffjjfg...', 15: '.......mmnphjjohjohjg...', 16: '.....mmnpmghffjffjjjg...', 17: 'mmmmmrpmm.ghffjffjjlg...', 18: 'rrrrrmm...ghjjohjofg....', 19: 'rtrmrm....gjhjhjhjhjg...', 20: 'rmrmrm.....ggjgghggg....', 21: 'egmggeg.....gjgghg......', 22: 'gegegg.....gjfgjfg......', 23: '.g.g........gg.gg.......' },
    { 11: '..........cehfjffjjaba..', 12: '..........chjjhhfjjga...', 13: '..........chjjfhfjjg....', 14: '..........ghjjfhfjjfg...', 15: '..........gfjefjjohjg...', 16: '..........mrnhjffjjjg...', 17: '........mmnehfjffjjlg...', 18: '.......mrpghjjohjofg....', 19: '..mmmmmpmmgjhjhjhjhjg...', 20: '.mnrrrrm...ggjgghggg....', 21: '.mrmrmrm....gjgghg......', 22: '.gegegeg...gjfgjfg......', 23: '..g.g.g.....gg.gg.......' },
    { 6: '.........ceeiejjaba.....', 10: '.........clkkhjifjfga...', 15: '........mmnhjjohjihjg...' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 3, 0.5], hurt: [11, 1, 0.2] },
};

// The Salt Bloom: crystal grown round a heart of brine, rooted in a crust
// of salt, its points white and clear, pink at their roots; its heart
// glowing green-blue and beating slow. Striking, its points thrust out.
export const SALT_BLOOM = {
  size: 24,
  pal: { a: '#3e4854', b: '#ffffff', c: '#e4f0fa', d: '#bcb8bc', e: '#413e44', f: '#313942', g: '#e2dede', h: '#333135', i: '#c0f4ea', j: '#7ac8bc', k: '#4a8a84', l: '#d0a6ae', m: '#a87c86', n: '#ecccd0', o: '#432f34' },
  rows: [
    '........................',
    '............a...........',
    '...........aba..........',
    '...........aba..........',
    '...........aba..........',
    '..........abcde..f......',
    '.......a..abcde.fbf.....',
    '......aba.abcge.fbf.....',
    '......abaabbcgdhfcf.....',
    '......acabbccgdfbcdh....',
    '.....abcdbbccgdbbcdh....',
    '.....abcdcbccgdbbcghf...',
    '....aabcgcbccgdcbcgdbf..',
    '...abbbcbcdijkdcbcgdbf..',
    '...fcbbcbckjijkcdcgdcf..',
    '...fcbbcbckjijkcdcgbcdh.',
    '..fbcdbcbcdkjkbcdcgbcdh.',
    '..fbcdbcbcdllmbcdcgbcdh.',
    '..fbcdnlbcdllmbcdlmbcdh.',
    '..fbcdnlnlmllmnlmlmnlmo.',
    '..onlmnlnlmllmnlmlmnlmo.',
    '..hddddddddddddddddddh..',
    '...hhddddddddddddddhh...',
    '.....hhhhhhhhhhhhhh.....',
  ],
  frames: [
    {},
    { 12: '....aabcgcbckgdcbcgdbf..', 13: '...abbbcbckijjkcbcgdbf..', 16: '..fbcdbcbckjjjkcdcgbcdh.', 17: '..fbcdbcbcdlkmbcdcgbcdh.' },
    { 12: '....aabcgcbckgdcbcgdbf..', 13: '...abbbcbckijjkcbcgdbf..', 16: '..fbcdbcbckjjjkcdcgbcdh.', 17: '..fbcdbcbcdlkmbcdcgbcdh.' },
    {},
    {},
    { 12: '....aabcgcbckgdcbcgdbf..', 13: '...abbbcbckijjkcbcgdbf..', 16: '..fbcdbcbckjjjkcdcgbcdh.', 17: '..fbcdbcbcdlkmbcdcgbcdh.' },
    { 12: '....aabcgcbckgdcbcgdbf..', 13: '...abbbcbckijjkcbcgdbf..', 16: '..fbcdbcbckjjjkcdcgbcdh.', 17: '..fbcdbcbcdlkmbcdcgbcdh.' },
    {},
    { 0: '...........aba..........', 1: '...........aba..........', 3: '..........abcde..f......', 4: '.......a..abcde.fbf.....', 5: '......aba.abcge.fbf.....', 6: '......abaabbcgdhfbf.....', 7: '......acaabbcgdfbcdh....', 8: '.....abcdabccgdfbcdh....', 9: '.....abcdbbccgddbcgh....', 10: '.....abcdbbccgdbbcgdh...', 11: '.....abcgcbccgdbbcgdh...', 12: '....abbcgcbkkkdcbcgdbf..', 13: '...abbbcbckijjkcbcgdbf..', 14: '...fcbbcbcjjijjcdcgdcf..', 15: '...fcbbcbcjjijjcdcgbcdh.', 16: '..fbcdbcbckjjjkcdcgbcdh.', 17: '..fbcdbcbcdkkkbcdlmbcdh.' },
    { 0: '...........aba..........', 1: '...........aba..........', 3: '..........abcde..f......', 4: '.......a..abcde.fbf.....', 5: '......aba.abcge.fbf.....', 6: '......abaabbcgdhfbf.....', 7: '......acaabbcgdfbcdh....', 8: '.....abcdabccgdfbcdh....', 9: '.....abcdbbccgddbcgh....', 10: '.....abcdbbccgdbbcgdh...', 11: '.....abcgcbccgdbbcgdh...', 12: '....abbcgckkkkkcbcgdbf..', 13: '...abbbcbkkijjkkbcgdbf..', 14: '...fcbbcbkjiiijkdcgdcf..', 15: '...fcbbcbkjiiijkdcgbcdh.', 16: '..fbcdbcbkkjjjkkdcgbcdh.', 17: '..fbcdbcbckkkkkcdlmbcdh.' },
    { 6: '.......a..abbde.fbf.....', 10: '.....abcdbbccgdbbbdh....', 11: '.....abbdcbccgdbbcghf...' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 2, 0.5], hurt: [10, 1, 0.2] },
};

// The Pale Flamingo: blind and gone white in the dark, pink only at its
// blush and legs; its neck an S, its eye milky, its bent beak dark at the
// tip. Still, it stands on one leg; startled, its wings go up.
export const PALE_FLAMINGO = {
  size: 24,
  pal: { a: '#6b7075', b: '#8c757b', c: '#080709', d: '#e0e8ee', e: '#fff6f6', f: '#0c0a0e', g: '#d8c8b0', h: '#e8ccd2', i: '#f8e8ea', j: '#6e5c60', k: '#ffffff', l: '#c8a8b0', m: '#f4c0c8', n: '#43232c', o: '#e098a8', p: '#b06878', q: '#060507', r: '#201e26' },
  rows: [
    '........................',
    '.......ab...............',
    '...cccadeb..............',
    '..cfggeeehb.............',
    '..cfcggcbehb............',
    '...c.cgc.bihb...........',
    '......c..behb...........',
    '........bihb............',
    '.......behb.............',
    '.......bihbbbbbjj.......',
    '........behkkkkelj......',
    '.........bihkiihmej.....',
    '........bkkkiiihimmn....',
    '........bkeeiiihlmej....',
    '.........jeeeiiihlj.....',
    '..........jeihhllj......',
    '...........jnomnj.......',
    '............nmn.........',
    '............nmn.........',
    '............non.........',
    '............non.........',
    '............non.........',
    '...........npopn........',
    '............nnn.........',
  ],
  frames: [
    {},
    { 1: '........................', 2: '.......ab...............', 3: '...cccadeb..............', 4: '..cfggeeehb.............', 5: '..cfcggcbehb............', 6: '...c.cgc.bihb...........', 7: '......c..behb...........', 8: '........bihb............', 9: '.......behbbbbbjj.......', 10: '.......bihbkkkkelj......', 11: '........behkeihlmej.....', 12: '........beihkeihimmn....', 13: '........bkkkiiihlmej....', 14: '.........jkeeiiihlj.....' },
    { 16: '...........nonnon.......', 17: '...........nonnon.......', 18: '...........nonnon.......', 19: '...........nonnon.......', 20: '...........nonnon.......', 21: '...........nonnon.......', 22: '..........nponpon.......', 23: '...........nn.nn........' },
    { 16: '...........nonnon.......', 17: '...........nonnon.......', 18: '...........nonnon.......', 19: '............noon........', 20: '............noon........', 21: '............noon........', 22: '...........npoon........' },
    { 16: '...........nonnon.......', 17: '...........nonnon.......', 18: '...........nonnon.......', 19: '...........nonnon.......', 20: '...........nonnon.......', 21: '...........nonnon.......', 22: '..........nponpon.......', 23: '...........nn.nn........' },
    { 16: '...........nonnon.......', 17: '...........nonnon.......', 18: '..........nnonnonn......', 19: '.........nonn..nnon.....', 20: '.........non....non.....', 21: '.........non....non.....', 22: '........npon...npon.....', 23: '.........nn.....nn......' },
    { 0: '.......ab...............', 1: '...cccadeb..............', 2: '..cfggeeehb...c...q.....', 3: '..cfcggcbbb..crq.qrq....', 4: '...c.cgcbehb.berqjirq...', 5: '......c..bihbbej.jij....', 6: '.........behbeb.jij.....', 7: '........bihbbeb.jij.....', 8: '.......behbbeb.jij......', 9: '.......bihbbebbjij......', 16: '...........nonnon.......', 17: '...........nonnon.......', 18: '...........nonnon.......', 19: '...........nonnon.......', 20: '...........nonnon.......', 21: '...........nonnon.......', 22: '..........nponpon.......', 23: '...........nn.nn........' },
    { 0: '.......ab.....c...q.....', 1: '...cccadeb...crq.qrq....', 2: '..cfggeeehb..berqjirq...', 3: '..cfcggcbbb..bej.jij....', 4: '...c.cgcbehbbeb.jij.....', 5: '......c..bihbeb.jij.....', 6: '.........beheb.jij......', 7: '........bihbeb.jij......', 8: '.......behb.b...j.......', 16: '...........nonnon.......', 17: '...........nonnon.......', 18: '...........nonnon.......', 19: '............noon........', 20: '............noon........', 21: '............noon........', 22: '...........npoon........' },
    { 8: '.......bkhb.............', 11: '.........bihkkihmej.....' },
  ],
  groups: { idle: [0, 2, 1.4], walk: [2, 4, 0.62], attack: [6, 2, 0.5], hurt: [8, 1, 0.2] },
};

export const SALT_MOBS = { salt_raker: SALT_RAKER, salt_bloom: SALT_BLOOM, pale_flamingo: PALE_FLAMINGO };
