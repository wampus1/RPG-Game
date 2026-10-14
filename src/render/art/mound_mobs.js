// (Round 108) What lives in the Hollow Hill, painted by hand (see
// render/pixart.js): silhouette first, then colours, texture, light and
// shade, outline and highlights, frame by frame. Each faces left (the
// renderer flips it); its groups are which frames it moves, stands,
// strikes and flinches with (see sprites.lookFrame).

// The Changeling: a child's size, a grey-green shawl drawn over its head
// as a hood, its face pale and greenish looking out of it, its eyes huge and
// black and old. Crying, its hands go to its face; it runs bent double with
// its prize; snatching, a long thin hand.
export const CHANGELING = {
  size: 24,
  pal: { a: '#151916', b: '#313a30', c: '#6e8072', d: '#1e2420', e: '#d4e0c8', f: '#4a3e27', g: '#e4d4a0', h: '#fff4cc', i: '#c8b47a', j: '#4e5e54', k: '#b4c4aa', l: '#101311', m: '#eef6e4', n: '#92a494', o: '#34403a', p: '#3e4a3d', q: '#8a9a84', r: '#040207', s: '#e8d8ff', t: '#5a6a58', u: '#6a4aa0', v: '#2a1e3a', w: '#06040a', x: '#120c1c', y: '#050403', z: '#282018', A: '#070504', B: '#1e1812', C: '#ffffff' },
  rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '.........aaaaaab........',
    '........acccccdeb.......',
    '........fghijdkjl.......',
    '.......fimeeeenojl......',
    '.......pmmmmeecool......',
    '.......pkekmkqcool......',
    '.......rsctekqcodl......',
    '.......rujmqqtcdl.......',
    '........racnccol........',
    '.........ajojjojl.......',
    '........lncjjoool.......',
    '........lcojjjool.......',
    '........lcjjojool.......',
    '.......lnojjjjool.......',
    '.......lcooojooool......',
    '......lnoooooooodl......',
    '......lcdbqjdqlol.......',
    '.......llbqbbqbl........',
    '........bkqbkqb.........',
    '.........bb.bb..........',
  ],
  frames: [
    {},
    { 4: '........................', 5: '.........aaaaaab........', 6: '........acccccdeb.......', 7: '........fghijdkjl.......', 8: '.......fimeeeenojl......', 9: '.......pmmmmeecool......', 10: '.......pkekmkqcool......', 11: '.......rsctekqcodl......', 12: '.......rujmqqtcdl.......', 13: '........racnccol........', 14: '.........ljcjoojl.......', 15: '........lnojjjool.......' },
    {},
    { 7: '.......fimmekenojl......', 8: '.......rsvksvmcool......', 9: '.......rwxqwxkcool......', 10: '........ptqmeqcodl......', 11: '........pmmkqtcdl.......', 12: '.........ancccol........', 13: '.........acojjojl.......', 14: '........lnjjjoool.......' },
    { 4: '........................', 5: '.......aaaaaap..........', 6: '......acccccdep.........', 7: '......fghijdkja.........', 8: '.....fimmekenojl........', 9: '.....rsvksvmcool........', 10: '.....rwxqwxkcool........', 11: '......ptqmeqcoolll......', 12: '......pmmkqtcojccjl.....', 13: '.......pajjjdacjjojl....', 14: '........yylllljjjjodl...', 15: '.......yzzy...lojool....', 16: '......yzhgzy..ljoodl....', 17: '......yzggzy.llldll.....', 18: '.......yzzyllncjl.......', 19: '.......lljjccooodl......' },
    { 4: '........................', 5: '........................', 6: '.......aaaaaap..........', 7: '......acccccdep.........', 8: '......fghijdkja.........', 9: '.....fimmekenojl........', 10: '.....rsvksvmcool........', 11: '.....rwxqwxkcoolll......', 12: '......ptqmeqcojccjl.....', 13: '......pmmkqtcojjjojl....', 14: '.......bljjjdlcjjjodl...', 15: '........yylllljojool....', 16: '.......yzzy...ljoodl....', 17: '......yzhgzy.llldll.....', 18: '......yzggzylncjl.......', 19: '.......yzzjccooodl......', 20: '......lcdlljdllol.......', 21: '.......ll.bqqb.l........', 22: '.........bkqqb..........', 23: '..........bbb...........' },
    { 4: '........................', 5: '.......aaaaaap..........', 6: '......acccccdep.........', 7: '......fghijdkja.........', 8: '.....fimmekenojl........', 9: '.....rsvksvmcool........', 10: '.....rwxqwxkcool........', 11: '......ptqmeqcoolll......', 12: '......pmmkqtcojccjl.....', 13: '.......pajjjdacjjojl....', 14: '........yylllljjjjodl...', 15: '.......yzzy...lojool....', 16: '......yzhgzy..ljoodl....', 17: '......yzggzy.llldll.....', 18: '.......yzzyllncjl.......', 19: '.......lljjccooodl......' },
    { 4: '........................', 5: '........................', 6: '.......aaaaaap..........', 7: '......acccccdep.........', 8: '......fghijdkja.........', 9: '.....fimmekenojl........', 10: '.....rsvksvmcool........', 11: '.....rwxqwxkcoolll......', 12: '......ptqmeqcojccjl.....', 13: '......pmmkqtcojjjojl....', 14: '.......bljjjdlcjjjodl...', 15: '........yylllljojool....', 16: '.......yzzy...ljoodl....', 17: '......yzhgzy.llldll.....', 18: '......yzggzylncjl.......', 19: '.......yzzjccooodl......', 20: '......lcdqljdbqol.......', 21: '.......bbqbllbqb........', 22: '......bkqb...bkqb.......', 23: '.......bb.....bb........' },
    { 7: '.......fimmekenojl......', 8: '.......rsvksvmcool......', 9: '.......rwxqwxkcool......', 10: '.......ABsBsmqcodl......', 11: '........pmmeqtcdl.......', 12: '.........ancccol........', 13: '..p....aaajojjojl.......', 14: '.beblllnccjcjoool.......', 15: 'belnccjllnojjjool.......', 16: '.beblll.lcjjojool.......', 17: 'beb....lnojjjjool.......', 18: '.b.....lcooojooool......' },
    { 7: '.......fimmekenojl......', 8: '.......rsvksvmcool......', 9: '.......rwxqwxkcool......', 10: '.......ABsBsmqcodl......', 11: '........pmmeqtcdl.......', 12: '..p......ancccol........', 13: '.pepaaaaaajojjojl.......', 14: 'belnnncccjdcjoool.......', 15: '.beblllllnojjjool.......', 16: 'beb.....lcjjojool.......', 17: '.b.....lnojjjjool.......' },
    { 6: '........fghCjdkjl.......', 7: '.......fimmekenojl......', 8: '.......rsvksvmcool......', 9: '.......rwxqwxkcool......', 10: '........ptqmeqcodl......', 11: '........pmmkqtcdl.......', 12: '.........ancccol........', 13: '.........acojjojl.......', 14: '........lnjjjoool.......', 16: '........lcjjCjool.......' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 2, 0.5], hurt: [10, 1, 0.2] },
};

// The Witch-Hare: a great grey-brown hare, its haunches huge, its ears
// dark-tipped, a red thread round its neck, its eye lit violet. It bounds;
// casting, it rears up and thumps, the witch-light between its paws.
export const WITCH_HARE = {
  size: 24,
  pal: { a: '#070504', b: '#282018', c: '#331c21', d: '#a86a76', e: '#968064', f: '#1d1610', g: '#4a3a2c', h: '#d0a8ff', i: '#9a60e8', j: '#bca88a', k: '#17110d', l: '#28161a', m: '#d09aa2', n: '#6e5a46', o: '#a02020', p: '#d04040', q: '#3a3730', r: '#fbf6ec', s: '#e4ddce', t: '#2a2018', u: '#9a9284', v: '#c4bcac', w: '#6a6458', x: '#050403', y: '#ffffff', z: '#1d0b38', A: '#280505', B: '#4a463d', C: '#5a28a0' },
  rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '.......a..a.............',
    '......abaaba............',
    '......abaaba............',
    '.....cdeffegf...........',
    '......cdefegf...........',
    '......cdeegf............',
    '......cdeegf............',
    '......feeegf............',
    '.....fghief.............',
    '....fgjjjggffffkk.......',
    '....lmnggopjjjgenkkqq...',
    '.....kgegoogejeeeegrsq..',
    '......kjgjjgnnngggtsuq..',
    '......ketrrsgeenngtvwq..',
    '......kgnrvvvjeegngtk...',
    '.......knrvvugnngngtk...',
    '.......knvuwjnngggtk....',
    '......kenkqknggggggk....',
    '.......kk...kkkkkkk.....',
    '........................',
  ],
  frames: [
    {},
    {},
    { 4: '..........a.............', 5: '.........aba............', 6: '........abba............', 7: '.......cdeegf...........', 8: '.......cdeegf...........' },
    {},
    {},
    { 3: '.........a...a..........', 4: '........aba.aba.........', 5: '.......aba.aba..........', 6: '......cdeffegf..........', 8: '....cdefegff............', 9: '....cdeegf..............', 10: '...feeegf...............', 11: '..fjhief................', 12: '.fgjjjgtffffff.kkkk.....', 13: '.cmgngopjjgjenfjjgekkq..', 14: '..kgegoojjeeeegeennetrq.', 15: '...kgjjjnnngnnnggggtrvvq', 16: '...kenngrseeeengnnggtugk', 17: '..kkkgrrvvvwgjeennnggntk', 18: '.knnkqrsvvuwenenggtggnk.', 19: 'knkk..qqvwqqkgnngggngggk', 20: '.k......qq...kkeggtkkkk.', 21: '...............kkkk.....', 22: '........................' },
    { 0: '..........a...a.........', 1: '.........aba.abx........', 2: '........aba.aba.........', 3: '.......cdeffegf.........', 4: '......cdeffegf..........', 5: '.....cdefegff...........', 6: '.....cdeegf.............', 7: '....feeegf..............', 8: '...fghief...............', 9: '..fgjjjggffffffkkkk.....', 10: '..cmnggopjjjgjjjeenkqq..', 11: '...fgegoogjejeeegnnnrsq.', 12: '....fjgjjngnngngggttsuq.', 13: '....fnngrrseeennnggtvwq.', 14: '...kkkgrsvuwjegennntngk.', 15: '..knnkqrsvuwenennggggkk.', 16: '.knkk..qvuwkenngggtntggk', 17: '..k.....qqq.kkengttkkkk.', 18: '..............kkkkk.....', 19: '........................', 20: '........................', 21: '........................', 22: '........................' },
    { 3: '........a..a............', 4: '.......abaaba...........', 5: '.......abaaba...........', 6: '......cdeffegf..........', 7: '.......cdefegf..........', 8: '.......cdeegf...........', 9: '.......cdeegf...........', 10: '.......feeegf...........', 11: '......fjhief............', 12: '.....fgjjjgtfffkk.......', 13: '.....cmnngopjjjenkkqq...', 14: '......kgegoojegeeenrsq..', 15: '.......kjjjgnnnngggsuq..', 16: '.......kgtrsenegngtvwq..', 17: '.......qsnrvsvjennggk...', 18: '.......qvnrvvuengngtk...', 19: '........knvwjgnggttk....', 20: '.......kenkknggggggk....', 21: '........kk..kkkkkkk.....', 22: '........................' },
    { 0: '.........abaaba.........', 1: '........cdeffegk........', 2: '.........cdefegk........', 3: '.........cdeegf.........', 4: '.........cdeegf.........', 5: '.........feeegf.........', 6: '........fjyief..........', 7: '......zfgjjjgtf.........', 8: '.....zicmnngopA.........', 9: '....zhzffgegooA.........', 10: '...ziyfefjnggenk........', 11: '....zfnfegrseenk........', 12: '......fnfgrvngnk........', 13: '.......fBrvvsegk........', 14: '........qrvvuegk........', 15: '........qsvvwenek.......', 16: '........kjvwjengnk......', 17: '........knvwgenngnk.....', 18: '........kgjjnnnggtk.....', 19: '........keeenggggtk.....', 20: '.........kgnnggttk......', 21: '........kngggggggk......', 22: '.........kkkkkkkk.......' },
    { 0: '.........abaaba.........', 1: '........cdeffegk........', 2: '.........cdefegk........', 3: '.........cdeegf.........', 4: '.........cdeegf.........', 5: '.........feeegf.........', 6: '.......hfjyief..........', 7: '...hz.zfgjjjgtf.........', 8: '...zCzicmnngopA.........', 9: '....zhfefgegooA.........', 10: '...ziyzfejnggenk........', 11: '..h.zfnffgrseenk........', 12: '......fnfgrvngnk........', 13: '.......fBrvvsegk........', 14: '........qrvvuegk........', 15: '........qsvvwenek.......', 16: '........kjvwjengnk......', 17: '........knvwgenngnk.....', 18: '........kgjjnnnggtk.....', 19: '........keeenggggtk.....', 20: '.........kgnnggttk......', 21: '........kngggggggk......', 22: '.........kkkkkkkk.......' },
    { 13: '....fgjyjggffffkk.......', 17: '......ketrrsgeynngtvwq..' },
  ],
  groups: { idle: [0, 4, 1.4], walk: [4, 4, 0.62], attack: [8, 2, 0.5], hurt: [10, 1, 0.2] },
};

export const MOUND_MOBS = { changeling: CHANGELING, witch_hare: WITCH_HARE };
