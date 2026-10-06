// The Workshop's Music tab (round 66): songs sketched in patterns, the old
// trackers' way (see mod/song.js). Along the top, the song: a row for
// each channel (an instrument), a square for each bar, holding the number
// of the pattern the channel plays there (none: it's quiet). Below, the
// pattern under the cursor, to write: a piano roll (or, for drums, a row
// for each drum), a step to each square. Played on the game's own
// instruments, as its music is, or on the mod's own sounds. Songs come in
// from song files and MIDI files, and go out as either, or as a .wav.
import { h, ic, clear, button, group, field, textInput, numberInput, slider, check, select, panel, toast, menu, contextMenu, confirm, download, pickFile, dropTarget } from './kit.js';
import { titleBar, menuButton } from './common.js';
import { newChan, freeChanId, cleanSong, barSteps, stepSecs, songSecs, SongPlayer, songHost, renderSong, songToMidi, midiToSong, songFile, readSongFile, INSTRUMENTS, INST_NAME, DRUM_NAMES, KEY_NAMES, SCALE_NAMES, scaleOf, SPACES, SONG_LIMITS } from '../mod/song.js';
import { master, midiHz, Rack } from '../game/synth.js';
import { encodeWav, packClip, convertRate, cleanSound } from '../mod/sound.js';
import { freeId } from '../mod/format.js';

const COLORS = ['#ffd84a', '#5ab4ff', '#5ce07a', '#ff9a3c', '#b88cff', '#ff5a72', '#5ce1e6', '#e8a0ff', '#c8e060', '#ffb0a0', '#80a8ff', '#f0f0f0'];
const CELL = 30; // a bar's square in the song
const ROW = 26; // a channel's row
const HEAD = 18; // the bars' numbers along the top
const NOTE_H = 12; // a pitch's row in the roll
const DRUM_H = 24; // a drum's
const LO = 24; // the roll's lowest note (C1) ...
const HI = 108; // ... and the one past its highest (C8)
const KEYS_W = 46; // the roll's keys
const DRUM_W = 104; // the drums' names
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const noteName = (n) => `${KEY_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
const BLACK = new Set([1, 3, 6, 8, 10]);
const colorOf = (i) => COLORS[i % COLORS.length];
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// A few beats to start a drum pattern from (in the default kit's rows:
// kick, snare, hat, open hat, clap, tom, rim, crash), for 16 steps.
const BEATS = {
  'Four on the floor': [[0, 0], [4, 0], [8, 0], [12, 0], [4, 4], [12, 4], [2, 2], [6, 2], [10, 2], [14, 2]],
  'Rock beat': [[0, 0], [8, 0], [10, 0], [4, 1], [12, 1], ...[0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, 2])],
  'Half time': [[0, 0], [10, 0], [8, 1], ...[0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, 2])],
  'March': [[0, 0], [8, 0], [4, 1], [12, 1], [14, 1], [6, 6], [15, 6]],
  'Shuffle': [[0, 0], [7, 0], [8, 0], [4, 1], [12, 1], [0, 2], [3, 2], [4, 2], [7, 2], [8, 2], [11, 2], [12, 2], [15, 2]],
  'Tribal': [[0, 5], [3, 5], [6, 5], [8, 0], [10, 5], [12, 5], [14, 5], [4, 6], [12, 6]],
};

export default class MusicTool {
  constructor(app) {
    this.app = app;
    this.id = null;
    this.ch = 0;
    this.bar = 0;
    this.range = null; // [bar0, bar1] chosen in the song (inclusive)
    this.player = null;
    this.loopSel = false;
    this.lastLen = 2;
    this.clip = null;
    this.focus = 'roll';
    this.typed = '';
    this.vol = 0.7;
    try {
      const v = parseFloat(localStorage.getItem('ws-music-vol'));
      if (v >= 0 && v <= 1) this.vol = v;
    } catch {
      // Fine.
    }
    this.lastCk = 0;
  }

  get song() {
    return this.id && this.app.mod.songs && this.app.mod.songs[this.id] ? this.app.mod.songs[this.id] : null;
  }

  get chan() {
    const S = this.song;
    return S ? S.chans[clamp(this.ch, 0, S.chans.length - 1)] || null : null;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.onResize = () => this.drawRoll();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    // (Round 67: what was open, drawn again on coming back to the tab.)
    if (this.id && this.song) this.open('songs', this.id);
  }

  unmount() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
    window.cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  current() {
    return this.song ? { kind: 'songs', id: this.id } : null;
  }

  hintText() {
    return this.song ? 'Click a square in the song to pick a bar; write its pattern below (click to put a note, drag to lengthen it, click it again to take it away). Space plays.' : 'Make a song, or upload one (a song file, or MIDI).';
  }

  keyHelp() {
    return [['Space', 'Play from the bar chosen / stop'], ['Shift+Space', 'Play from the start'], ['0-9 (song)', 'The pattern a bar plays (0: none)'], ['+ / -', 'Next / last pattern there'], ['N', 'A new pattern there'], ['Arrows', 'Move about the song'], ['Ctrl+C / Ctrl+V', 'Copy / paste (a pattern, or bars of the song)'], ['Delete', 'Clear the pattern (or the bars chosen)'], ['Wheel on a note', 'How hard it\'s struck']];
  }

  open(kind, id) {
    this.stop();
    if (!id || !this.app.mod.songs || !this.app.mod.songs[id]) {
      this.id = null;
      return this.empty();
    }
    if (this.id !== id) {
      this.ch = 0;
      this.bar = 0;
      this.range = null;
      this.scrolled = false;
    }
    this.id = id;
    cleanSong(this.song);
    this.build();
    return null;
  }

  reload() {
    if (this.song) {
      cleanSong(this.song);
      this.build();
    } else this.empty();
  }

  removed(kind, id) {
    if (kind === 'songs' && id === this.id) {
      this.stop();
      this.id = null;
      this.empty();
    } else if (kind === 'sounds' && this.song) this.drawSide();
  }

  renamed() {
    if (this.nameEl && this.song) this.nameEl.value = this.song.name;
  }

  // ------------------------------------------------------------ nothing open
  empty() {
    clear(this.stage);
    clear(this.insp);
    const card = (icon, t, d, fn) => {
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, ic(icon), t), h('div', { class: 'd' }, d));
      c.addEventListener('click', fn);
      return c;
    };
    const list = Object.values(this.app.mod.songs || {});
    this.stage.append(h('div', { class: 'home scroll', style: { overflow: 'auto' } },
      h('h1', null, 'Music'),
      h('div', { class: 'sub' }, 'Songs, sketched in patterns: each instrument plays a bar-long pattern at a time, and the song says which pattern each plays in each bar (so a bar written once can come round again and again). They play on the game\'s own instruments, or on your sounds. Use them as a biome\'s music, or put one on from a node (Play music).'),
      h('div', { class: 'cards' },
        card('plus', 'A new song', 'A melody, chords, a bass and drums, waiting to be written.', () => this.app.create('songs', { name: 'Song' })),
        card('note', 'A song with a tune in it', 'A little tune to start from, to hear how it all goes together.', () => this.app.create('songs', { name: 'Song', demo: true })),
        card('import', 'Upload a song', 'A song file (.tsong), or a MIDI file (.mid).', () => this.upload())),
      list.length ? h('h2', null, 'This mod\'s songs') : null,
      list.length ? h('div', { class: 'cards' }, list.map((s) => card('note', s.name, `${s.bars} bars · ${s.bpm} beats a minute · ${mmss(songSecs(cleanSong(s)))}`, () => this.app.open('songs', s.id)))) : null));
    this.insp.append(h('div', { class: 'insp-head' }, ic('note'), 'Music'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open.')));
  }

  // ------------------------------------------------------------ changing it
  ck() {
    const now = performance.now();
    if (now - this.lastCk > 700) this.app.checkpoint('songs', this.id);
    this.lastCk = now;
  }

  // A change to the song: remembered for Undo, saved, drawn.
  set(fn, o = {}) {
    if (!this.song) return;
    if (o.ck !== false) this.ck();
    fn(this.song);
    this.app.touch('songs', this.id);
    if (this.player) this.player.refresh();
    if (o.restart && this.player) this.play(false, true);
    if (o.side) this.drawSide();
    if (o.grid !== false) this.drawGrid();
    if (o.roll !== false) this.drawRoll();
    if (o.heads) this.drawHeads();
    if (o.top) this.drawInfo();
  }

  // The pattern the chosen square plays (made, if `make` and it plays none).
  pat(make = false) {
    const c = this.chan;
    if (!c) return null;
    const n = c.seq[this.bar] || 0;
    if (n && c.pats[n - 1]) return c.pats[n - 1];
    if (!make) return null;
    if (c.pats.length >= SONG_LIMITS.pats) {
      toast('That channel has all the patterns it can have.', 'bad');
      return null;
    }
    // (Its first pattern, if that's still empty and nowhere else.)
    const unused = c.pats.findIndex((p, i) => !p.notes.length && !c.seq.includes(i + 1));
    if (unused >= 0) c.seq[this.bar] = unused + 1;
    else {
      c.pats.push({ notes: [] });
      c.seq[this.bar] = c.pats.length;
    }
    return c.pats[c.seq[this.bar] - 1];
  }

  // ------------------------------------------------------------ sound
  // The sound card (unlocked by the first click anywhere), and the desk
  // the songs here play through.
  audio() {
    const A = this.app.o.audio;
    if (!A || !A.ctx) return null;
    if (A.ctx.state === 'suspended') A.ctx.resume();
    if (!this.out || this.outCtx !== A.ctx) {
      this.outCtx = A.ctx;
      this.outGain = A.ctx.createGain();
      this.outGain.gain.value = 0.45 * this.vol;
      this.outGain.connect(A.ctx.destination);
      this.out = master(A.ctx, this.outGain);
      this.host = songHost(A.ctx);
      this.aud = null;
    }
    return A.ctx;
  }

  setVol(v) {
    this.vol = v;
    try {
      localStorage.setItem('ws-music-vol', String(v));
    } catch {
      // Fine.
    }
    if (this.outGain) this.outGain.gain.setTargetAtTime(0.45 * v, this.outCtx.currentTime, 0.05);
  }

  clipOf(ref) {
    return typeof ref === 'string' && ref[0] === '@' ? (this.app.mod.sounds || {})[ref.slice(1)] || null : null;
  }

  // A note heard as it's written (not while the song's playing: it's
  // heard in that).
  audition(c, note, len = 1) {
    const S = this.song;
    if (!S || !c || this.player) return;
    const ctx = this.audio();
    if (!ctx) return;
    if (!this.aud || this.audSpace !== S.space) {
      this.aud = new Rack(this.host, this.out, { space: S.space, wet: 0.2, echo: 0 });
      this.audSpace = S.space;
    }
    const ch = this.aud.chan('a', { verb: 0.25 });
    const t = ctx.currentTime + 0.02;
    const dur = Math.min(1.2, Math.max(0.15, len * stepSecs(S)));
    if (c.kind === 'drums') {
      if (c.kit[note]) this.aud.hit(c.kit[note], ch, t, 0.9, { dur });
    } else if (c.kind === 'tone') this.aud.play(c.inst || 'ep', ch, midiHz(note), t, dur, 0.8);
    else {
      const s = this.clipOf(c.inst);
      if (s) this.app.o.audio.playClip(s, { pitch: 2 ** ((note - (s.root || 60)) / 12), dest: this.out });
    }
    this.app.o.music?.duck?.(0.9);
  }

  play(fromStart = false, keepPos = false) {
    const S = this.song;
    if (!S) return;
    const ctx = this.audio();
    if (!ctx) {
      toast('Click anywhere once, so the browser lets sound play, then try again.');
      return;
    }
    const bs = barSteps(S);
    const at = keepPos && this.player ? Math.floor(this.player.at() ?? this.bar * bs) : fromStart ? 0 : this.bar * bs;
    if (this.player) this.player.stop(0.04);
    const r = this.loopSel ? this.loopRange() : null;
    this.player = new SongPlayer(this.host, this.out, S, { from: r ? clamp(at, r[0] * bs, r[1] * bs - 1) : at, loop: true, loopTo: 0, range: r, clip: (ref) => this.clipOf(ref) });
    this.app.o.music?.hush?.(true);
    this.drawPlay();
    if (!this.raf) this.tick();
  }

  loopRange() {
    const [a, b] = this.range || [this.bar, this.bar];
    return [Math.min(a, b), Math.max(a, b) + 1];
  }

  stop() {
    if (this.player) {
      this.player.stop(0.06);
      this.player = null;
      this.app.o.music?.hush?.(false);
    }
    this.playAt = null;
    if (this.playBtn) {
      this.drawPlay();
      this.drawGrid();
      this.drawRoll();
    }
  }

  toggle(fromStart = false) {
    if (this.player) this.stop();
    else this.play(fromStart);
  }

  tick() {
    const loop = () => {
      this.raf = 0;
      if (!this.player || !this.stage || !this.stage.isConnected) return;
      const ctx = this.outCtx;
      this.player.schedule(ctx.currentTime + 0.3);
      const at = this.player.at();
      if (at !== this.playAt) {
        this.playAt = at;
        this.drawGrid();
        this.drawRollHead();
      }
      this.raf = window.requestAnimationFrame(loop);
    };
    this.raf = window.requestAnimationFrame(loop);
  }

  drawPlay() {
    if (!this.playBtn) return;
    clear(this.playBtn);
    this.playBtn.append(ic(this.player ? 'stop' : 'play', 12), h('span', null, this.player ? 'Stop' : 'Play'));
    this.playBtn.classList.toggle('on', !!this.player);
  }

  // ------------------------------------------------------------ the screen
  build() {
    const app = this.app;
    const S = this.song;
    clear(this.stage);
    clear(this.insp);
    this.ch = clamp(this.ch, 0, Math.max(0, S.chans.length - 1));
    this.bar = clamp(this.bar, 0, S.bars - 1);
    this.playBtn = button('Play', { icon: 'play', small: true, kind: 'go', title: 'Play from the bar chosen, or stop (Space)', onClick: () => this.toggle(false) });
    const loopBtn = button(null, { icon: 'redo', small: true, on: this.loopSel, title: 'Play only the bars chosen, round and round', onClick: (e, b) => {
      this.loopSel = !this.loopSel;
      b.classList.toggle('on', this.loopSel);
      if (this.player) this.play(false, true);
    } });
    this.bpmIn = numberInput({ value: S.bpm, min: 40, max: 240, int: true, onChange: (v) => this.set((s) => (s.bpm = v), { side: true, grid: false, roll: false, top: true }) });
    this.bpmIn.style.width = '54px';
    const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: this.vol, class: 'mu-vol', 'data-tip': 'How loud it plays here (not in the game)' });
    vol.addEventListener('input', () => this.setVol(+vol.value));
    const bar = titleBar(app, 'songs', this.id,
      group(this.playBtn, button(null, { icon: 'prev', small: true, title: 'Play from the start (Shift+Space)', onClick: () => this.play(true) })), loopBtn,
      h('span', { class: 'sep' }),
      h('span', { class: 'note' }, 'Tempo'), this.bpmIn,
      select(KEY_NAMES.map((k, i) => [String(i), k]), String(S.key), (v) => this.set((s) => (s.key = +v), { side: true, grid: false })),
      select(Object.entries(SCALE_NAMES), S.scale, (v) => this.set((s) => (s.scale = v), { side: true, grid: false })),
      h('span', { class: 'spacer' }),
      h('span', { class: 'mu-info note' }), ic('speaker', 11), vol,
      menuButton('Upload', () => [
        { label: 'A song file or MIDI file, as a new song...', icon: 'import', onClick: () => this.upload() },
        { label: 'A MIDI file over this song...', icon: 'import', onClick: () => this.upload(true) },
      ], { small: true, icon: 'import' }),
      menuButton('Download', () => [
        { label: 'A song file (.tsong)', icon: 'export', onClick: () => this.downloadSong() },
        { label: 'A MIDI file (.mid)', icon: 'export', onClick: () => this.downloadMidi() },
        { label: 'A sound file (.wav)', icon: 'export', onClick: () => this.downloadWav() },
      ], { small: true, icon: 'export' }),
      menuButton('Use it', () => [
        { label: 'Make a sound of it (for the Sound tab)', icon: 'speaker', onClick: () => this.toSound() },
        { label: 'As a biome\'s music...', icon: 'tree', onClick: () => this.toBiome() },
      ], { small: true, kind: 'primary', icon: 'star' }));
    this.nameEl = bar.querySelector('.title input');
    this.infoEl = bar.querySelector('.mu-info');
    // The song.
    this.heads = h('div', { class: 'mu-heads' });
    this.gc = h('canvas', { class: 'mu-grid', tabindex: 0 });
    this.gscroll = h('div', { class: 'mu-gscroll' }, this.gc);
    const top = h('div', { class: 'mu-top' }, this.heads, this.gscroll);
    // The pattern.
    this.rc = h('canvas', { class: 'mu-roll', tabindex: 0 });
    this.rhead = h('div', { class: 'mu-rhead' });
    this.rscroll = h('div', { class: 'mu-rscroll' }, this.rc);
    const roll = h('div', { class: 'mu-rollwrap' }, this.rhead, this.rscroll);
    this.stage.append(bar, top, roll);
    dropTarget(this.heads, (q) => q.kind === 'sounds', (q) => this.addChannel('sound', `@${q.id}`));
    this.bindGrid();
    this.bindRoll();
    // The inspector.
    this.insp.append(h('div', { class: 'insp-head' }, ic('note'), S.name));
    this.side = h('div', { class: 'insp-body scroll' });
    this.insp.append(this.side);
    this.drawPlay();
    this.drawInfo();
    this.drawHeads();
    this.drawGrid();
    this.drawSide();
    requestAnimationFrame(() => {
      this.drawRoll();
      if (!this.scrolled) this.scrollToNotes();
    });
    app.hint(this.hintText());
  }

  drawInfo() {
    const S = this.song;
    if (!this.infoEl || !S) return;
    this.infoEl.textContent = `${S.bars} bars · ${mmss(songSecs(S))}`;
    if (this.bpmIn && document.activeElement !== this.bpmIn) this.bpmIn.value = String(S.bpm);
  }

  // ------------------------------------------------------------ channels
  drawHeads() {
    const S = this.song;
    if (!this.heads || !S) return;
    clear(this.heads);
    this.heads.append(h('div', { class: 'mu-hcorner', style: { height: `${HEAD}px` } }));
    S.chans.forEach((c, i) => {
      const mute = button(c.mute ? 'M' : 'm', { small: true, kind: 'ghost', cls: `mu-ms${c.mute ? ' on' : ''}`, title: 'Mute it', onClick: (e) => {
        e.stopPropagation();
        this.set((s) => (s.chans[i].mute = !s.chans[i].mute), { heads: true, roll: false });
      } });
      const solo = button(c.solo ? 'S' : 's', { small: true, kind: 'ghost', cls: `mu-ms${c.solo ? ' on' : ''}`, title: 'Hear only this one (and others soloed)', onClick: (e) => {
        e.stopPropagation();
        this.set((s) => (s.chans[i].solo = !s.chans[i].solo), { heads: true, roll: false });
      } });
      const kindIc = c.kind === 'drums' ? 'drum' : c.kind === 'sound' ? 'speaker' : 'note';
      const el = h('div', { class: `mu-head${i === this.ch ? ' on' : ''}${c.mute ? ' muted' : ''}`, style: { height: `${ROW}px`, '--cc': colorOf(i) }, 'data-tip': `${c.name}: ${c.kind === 'tone' ? INST_NAME[c.inst] || c.inst : c.kind === 'drums' ? 'drums' : this.soundName(c.inst)}` },
        h('span', { class: 'dot' }), ic(kindIc, 10), h('span', { class: 'nm' }, c.name), mute, solo);
      el.addEventListener('click', () => this.pick(i, this.bar));
      el.addEventListener('contextmenu', (e) => contextMenu(e, this.chanMenu(i)));
      this.heads.append(el);
    });
    if (S.chans.length < SONG_LIMITS.chans) {
      const add = button('Channel', { icon: 'plus', small: true, kind: 'ghost', title: 'Another instrument', onClick: (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        menu(this.addMenu(), r.left, r.bottom + 2);
      } });
      this.heads.append(h('div', { class: 'mu-addch' }, add));
    }
  }

  soundName(ref) {
    const s = this.clipOf(ref);
    return s ? s.name : 'no sound chosen';
  }

  addMenu() {
    const sounds = Object.values(this.app.mod.sounds || {});
    return [
      { label: 'An instrument', icon: 'note', sub: INSTRUMENTS.map(([fam, list]) => ({ label: fam, sub: list.map(([k, nm]) => ({ label: nm, onClick: () => this.addChannel('tone', k) })) })) },
      { label: 'Drums', icon: 'drum', onClick: () => this.addChannel('drums') },
      { label: 'One of your sounds', icon: 'speaker', sub: sounds.length ? sounds.map((s) => ({ label: s.name, onClick: () => this.addChannel('sound', `@${s.id}`) })) : [{ label: 'Make or bring in a sound first (the Sound tab)', off: true }] },
    ];
  }

  addChannel(kind, inst = null) {
    const S = this.song;
    if (!S || S.chans.length >= SONG_LIMITS.chans) return;
    this.set((s) => {
      const c = newChan(kind, { id: freeChanId(s), inst, name: kind === 'sound' ? this.soundName(inst) : undefined });
      c.seq = Array(s.bars).fill(0);
      c.seq[this.bar] = 1;
      s.chans.push(c);
      this.ch = s.chans.length - 1;
    }, { heads: true, side: true });
  }

  chanMenu(i) {
    const S = this.song;
    const c = S.chans[i];
    return [
      { head: c.name },
      { label: 'Duplicate', icon: 'copy', off: S.chans.length >= SONG_LIMITS.chans, onClick: () => this.set((s) => {
        const d = JSON.parse(JSON.stringify(c));
        d.id = freeChanId(s);
        d.name = `${c.name} 2`.slice(0, 24);
        s.chans.splice(i + 1, 0, d);
        this.ch = i + 1;
      }, { heads: true, side: true }) },
      { label: 'Move up', icon: 'up', off: i === 0, onClick: () => this.moveChan(i, -1) },
      { label: 'Move down', icon: 'down', off: i === S.chans.length - 1, onClick: () => this.moveChan(i, 1) },
      { sep: true },
      { label: 'Delete', icon: 'trash', danger: true, off: S.chans.length <= 1, onClick: () => this.set((s) => {
        s.chans.splice(i, 1);
        this.ch = clamp(this.ch >= i ? this.ch - 1 : this.ch, 0, s.chans.length - 1);
      }, { heads: true, side: true }) },
    ];
  }

  moveChan(i, d) {
    this.set((s) => {
      const [c] = s.chans.splice(i, 1);
      s.chans.splice(i + d, 0, c);
      this.ch = i + d;
    }, { heads: true, side: true });
  }

  // ------------------------------------------------------------ the song's grid
  pick(ch, bar, extend = false) {
    const S = this.song;
    const was = this.ch;
    this.ch = clamp(ch, 0, S.chans.length - 1);
    if (extend) this.range = [this.range ? this.range[0] : this.bar, clamp(bar, 0, S.bars - 1)];
    else this.range = null;
    this.bar = clamp(bar, 0, S.bars - 1);
    this.drawGrid();
    this.drawRoll();
    this.keepVisible();
    if (was !== this.ch) {
      this.drawHeads();
      this.drawSide();
    } else this.drawPatPanel();
  }

  keepVisible() {
    const sc = this.gscroll;
    if (!sc) return;
    const x = this.bar * CELL;
    if (x < sc.scrollLeft) sc.scrollLeft = x - CELL;
    else if (x + CELL > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = x + CELL * 2 - sc.clientWidth;
  }

  drawGrid() {
    const S = this.song;
    const cv = this.gc;
    if (!cv || !S) return;
    const W = S.bars * CELL + 1;
    const H = HEAD + S.chans.length * ROW + 1;
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    const x = cv.getContext('2d');
    x.fillStyle = '#0b102e';
    x.fillRect(0, 0, W, H);
    // The bars' numbers (every bar, or every few when they're long).
    x.font = '10px monospace';
    x.textBaseline = 'middle';
    x.textAlign = 'center';
    const every = S.bars > 99 ? 4 : 1;
    for (let b = 0; b < S.bars; b++) {
      const playing = this.playAt !== null && this.playAt !== undefined && Math.floor(this.playAt / barSteps(S)) === b;
      x.fillStyle = playing ? '#3a4a10' : b % 4 === 0 ? '#1b2452' : '#151d42';
      x.fillRect(b * CELL, 0, CELL - 1, HEAD - 1);
      if (b % every === 0) {
        x.fillStyle = b === S.loopFrom && S.loopFrom > 0 ? '#ffd84a' : '#a4addb';
        x.fillText(String(b + 1), b * CELL + CELL / 2, HEAD / 2 + 1);
      }
    }
    if (S.loopFrom > 0) {
      x.fillStyle = '#ffd84a';
      x.beginPath();
      x.moveTo(S.loopFrom * CELL, 0);
      x.lineTo(S.loopFrom * CELL + 6, 0);
      x.lineTo(S.loopFrom * CELL, 6);
      x.fill();
    }
    const [r0, r1] = this.range ? [Math.min(...this.range), Math.max(...this.range)] : [this.bar, this.bar];
    S.chans.forEach((c, i) => {
      const y = HEAD + i * ROW;
      const col = colorOf(i);
      for (let b = 0; b < S.bars; b++) {
        const n = c.seq[b] || 0;
        const px = b * CELL;
        if (n) {
          x.globalAlpha = c.mute ? 0.25 : 0.38;
          x.fillStyle = col;
          x.fillRect(px + 1, y + 1, CELL - 3, ROW - 3);
          x.globalAlpha = c.mute ? 0.4 : 1;
          // (A glimpse of its notes.)
          const P = c.pats[n - 1];
          if (P && P.notes.length) this.mini(x, c, P, px + 3, y + 3, CELL - 7, ROW - 7, col);
          x.fillStyle = '#ffffff';
          x.font = 'bold 10px monospace';
          x.textAlign = 'left';
          x.fillText(String(n), px + 3, y + 8);
          x.textAlign = 'center';
          x.globalAlpha = 1;
        } else {
          x.fillStyle = b % 4 === 0 ? '#141b40' : '#10163a';
          x.fillRect(px + 1, y + 1, CELL - 3, ROW - 3);
        }
      }
      if (i === this.ch) {
        x.strokeStyle = '#ffd84a';
        x.lineWidth = 2;
        x.strokeRect(r0 * CELL + 0.5, y + 0.5, (r1 - r0 + 1) * CELL - 2, ROW - 2);
        x.lineWidth = 1;
      }
    });
    // Where it's playing.
    if (this.playAt !== null && this.playAt !== undefined) {
      const px = (this.playAt / barSteps(S)) * CELL;
      x.fillStyle = '#ffffff';
      x.fillRect(Math.round(px), 0, 1, H);
    }
    // (The bars chosen to play round and round.)
    if (this.loopSel) {
      const [a, b] = this.loopRange();
      x.fillStyle = 'rgba(92, 224, 122, 0.8)';
      x.fillRect(a * CELL, HEAD - 3, (b - a) * CELL - 1, 2);
    }
  }

  // A pattern drawn tiny (in a square of the song).
  mini(x, c, P, px, py, w, hh, col) {
    const bs = barSteps(this.song);
    let lo = 999;
    let hi = -999;
    for (const n of P.notes) {
      lo = Math.min(lo, n[1]);
      hi = Math.max(hi, n[1]);
    }
    if (c.kind === 'drums') {
      lo = 0;
      hi = Math.max(1, c.kit.length - 1);
    }
    const span = Math.max(1, hi - lo);
    x.fillStyle = col;
    for (const [st, note, len] of P.notes) {
      const nx = px + (st / bs) * w;
      const nw = Math.max(1, (Math.min(len, bs - st) / bs) * w);
      const ny = c.kind === 'drums' ? py + (note / span) * (hh - 1) : py + (1 - (note - lo) / span) * (hh - 1);
      x.fillRect(Math.round(nx), Math.round(ny), Math.round(nw), 1);
    }
  }

  bindGrid() {
    const cv = this.gc;
    const at = (e) => {
      const r = cv.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      return { bar: Math.floor(px / CELL), ch: Math.floor((py - HEAD) / ROW), head: py < HEAD };
    };
    let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      const S = this.song;
      if (!S || e.button === 2) return;
      this.focus = 'grid';
      cv.focus();
      const p = at(e);
      if (p.bar < 0 || p.bar >= S.bars) return;
      if (p.head) {
        this.pick(this.ch, p.bar, e.shiftKey);
        if (this.player) this.play(false);
        return;
      }
      if (p.ch < 0 || p.ch >= S.chans.length) return;
      this.pick(p.ch, p.bar, e.shiftKey);
      drag = { ch: p.ch, bar0: e.shiftKey && this.range ? this.range[0] : p.bar };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = at(e);
      const b = clamp(p.bar, 0, this.song.bars - 1);
      if (b !== this.bar || (this.range && this.range[1] !== b)) {
        this.range = drag.bar0 === b ? null : [drag.bar0, b];
        this.bar = b;
        this.drawGrid();
        this.drawRoll();
        this.drawPatPanel();
      }
    });
    cv.addEventListener('pointerup', () => {
      drag = null;
    });
    cv.addEventListener('dblclick', (e) => {
      const p = at(e);
      const S = this.song;
      if (p.head || p.ch < 0 || p.ch >= S.chans.length || p.bar >= S.bars) return;
      if (!S.chans[p.ch].seq[p.bar]) this.set(() => this.pat(true), { side: true });
    });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const S = this.song;
      const p = at(e);
      if (p.bar < 0 || p.bar >= S.bars) return;
      if (p.head) {
        contextMenu(e, this.barMenu(p.bar));
        return;
      }
      if (p.ch < 0 || p.ch >= S.chans.length) return;
      if (!this.range || p.bar < Math.min(...this.range) || p.bar > Math.max(...this.range) || p.ch !== this.ch) this.pick(p.ch, p.bar);
      contextMenu(e, this.cellMenu());
    });
  }

  // What a square of the song can play.
  cellMenu() {
    const c = this.chan;
    const cur = c.seq[this.bar] || 0;
    const items = [{ head: `${c.name}, bar ${this.bar + 1}` }];
    c.pats.forEach((P, i) => items.push({ label: `Pattern ${i + 1}${P.notes.length ? '' : ' (empty)'}`, icon: cur === i + 1 ? 'check' : null, onClick: () => this.setCells(i + 1) }));
    items.push({ sep: true },
      { label: 'A new pattern here', icon: 'plus', key: 'N', onClick: () => this.newPattern(false) },
      { label: 'A copy of this pattern here', icon: 'copy', off: !cur, onClick: () => this.newPattern(true) },
      { label: 'Nothing here (quiet)', icon: 'minus', key: '0', onClick: () => this.setCells(0) });
    return items;
  }

  // What can be done to a bar of the whole song.
  barMenu(b) {
    const S = this.song;
    return [
      { head: `Bar ${b + 1}` },
      { label: 'Play from here', icon: 'play', onClick: () => {
        this.pick(this.ch, b);
        this.play(false);
      } },
      { label: 'Round again to here (as music)', icon: 'redo', onClick: () => this.set((s) => (s.loopFrom = b), { side: true }) },
      { sep: true },
      { label: 'Put a bar in before it', icon: 'plus', off: S.bars >= SONG_LIMITS.bars, onClick: () => this.set((s) => {
        for (const c of s.chans) c.seq.splice(b, 0, 0);
        s.bars++;
        if (s.loopFrom > b) s.loopFrom++;
      }, { side: true, top: true }) },
      { label: 'A copy of it after it', icon: 'copy', off: S.bars >= SONG_LIMITS.bars, onClick: () => this.set((s) => {
        for (const c of s.chans) c.seq.splice(b + 1, 0, c.seq[b] || 0);
        s.bars++;
        if (s.loopFrom > b) s.loopFrom++;
      }, { side: true, top: true }) },
      { label: 'Take it out', icon: 'trash', danger: true, off: S.bars <= 1, onClick: () => this.set((s) => {
        for (const c of s.chans) c.seq.splice(b, 1);
        s.bars--;
        if (s.loopFrom > b) s.loopFrom--;
        s.loopFrom = clamp(s.loopFrom, 0, s.bars - 1);
        this.bar = clamp(this.bar, 0, s.bars - 1);
      }, { side: true, top: true }) },
    ];
  }

  // The squares chosen (this channel's) play pattern `n` (0: none).
  setCells(n) {
    const c = this.chan;
    if (!c || n > c.pats.length) return;
    const [a, b] = this.range ? [Math.min(...this.range), Math.max(...this.range)] : [this.bar, this.bar];
    this.set(() => {
      for (let i = a; i <= b; i++) c.seq[i] = n;
    }, { side: true });
  }

  newPattern(copy) {
    const c = this.chan;
    if (!c) return;
    if (c.pats.length >= SONG_LIMITS.pats) {
      toast('That channel has all the patterns it can have.', 'bad');
      return;
    }
    const cur = this.pat(false);
    this.set(() => {
      c.pats.push({ notes: copy && cur ? cur.notes.map((q) => q.slice()) : [] });
      c.seq[this.bar] = c.pats.length;
    }, { side: true });
  }

  // ------------------------------------------------------------ the pattern
  rollGeom() {
    const S = this.song;
    const c = this.chan;
    const drums = c && c.kind === 'drums';
    const keys = drums ? DRUM_W : KEYS_W;
    const bs = barSteps(S);
    const avail = Math.max(200, (this.rscroll ? this.rscroll.clientWidth : 600) - 14);
    const stepW = Math.max(14, Math.floor((avail - keys) / bs));
    const rows = drums ? c.kit.length + 1 : HI - LO;
    const rh = drums ? DRUM_H : NOTE_H;
    return { drums, keys, bs, stepW, rows, rh, W: keys + stepW * bs + 1, H: rows * rh + 1 };
  }

  // The row a note's at (its y), and back.
  rowY(g, note) {
    return g.drums ? note * g.rh : (HI - 1 - note) * g.rh;
  }

  rowAt(g, y) {
    const r = Math.floor(y / g.rh);
    return g.drums ? r : HI - 1 - r;
  }

  scrollToNotes() {
    const c = this.chan;
    if (!c || !this.rscroll) return;
    this.scrolled = true;
    if (c.kind === 'drums') return;
    const g = this.rollGeom();
    const P = this.pat(false) || c.pats.find((p) => p.notes.length);
    const ns = P ? P.notes.map((q) => q[1]) : [];
    const mid = ns.length ? (Math.min(...ns) + Math.max(...ns)) / 2 : 62;
    this.rscroll.scrollTop = Math.max(0, this.rowY(g, Math.round(mid)) - this.rscroll.clientHeight / 2);
  }

  drawRoll() {
    const S = this.song;
    const cv = this.rc;
    const c = this.chan;
    if (!cv || !S || !c || !cv.isConnected) return;
    const g = this.rollGeom();
    if (cv.width !== g.W) cv.width = g.W;
    if (cv.height !== g.H) cv.height = g.H;
    const x = cv.getContext('2d');
    const scale = new Set(scaleOf(S.scale).map((d) => (d + S.key) % 12));
    const col = colorOf(this.ch);
    x.fillStyle = '#0b102e';
    x.fillRect(0, 0, g.W, g.H);
    x.font = '10px monospace';
    x.textBaseline = 'middle';
    // Its rows.
    for (let r = 0; r < g.rows; r++) {
      const y = r * g.rh;
      if (g.drums) {
        const d = c.kit[r];
        x.fillStyle = r % 2 ? '#141b40' : '#18204a';
        x.fillRect(g.keys, y, g.W - g.keys, g.rh - 1);
        x.fillStyle = d ? '#1b2452' : '#10163a';
        x.fillRect(0, y, g.keys - 2, g.rh - 1);
        x.fillStyle = d ? '#eef0ff' : '#67719f';
        x.textAlign = 'left';
        x.fillText(d ? DRUM_NAMES[d] || d : '+ a drum', 6, y + g.rh / 2);
        continue;
      }
      const note = HI - 1 - r;
      const pc = ((note % 12) + 12) % 12;
      const inScale = scale.has(pc);
      x.fillStyle = pc === S.key ? '#232c5c' : inScale ? '#18204a' : '#10163a';
      x.fillRect(g.keys, y, g.W - g.keys, g.rh - 1);
      // The key.
      x.fillStyle = BLACK.has(pc) ? '#222a44' : '#d8dcf0';
      x.fillRect(0, y, g.keys - 2, g.rh - 1);
      if (inScale) {
        x.fillStyle = pc === S.key ? '#ffd84a' : '#5ab4ff';
        x.fillRect(g.keys - 6, y + 2, 3, g.rh - 5);
      }
      if (pc === 0) {
        x.fillStyle = '#101633';
        x.textAlign = 'left';
        x.fillText(noteName(note), 3, y + g.rh / 2 + 1);
        x.fillStyle = '#34448a';
        x.fillRect(g.keys, y + g.rh - 1, g.W - g.keys, 1);
      }
    }
    // Its beats.
    for (let s = 0; s <= g.bs; s++) {
      x.fillStyle = s % g.bs === 0 ? '#5a6fc8' : s % S.steps === 0 ? '#34448a' : '#1e2650';
      x.fillRect(g.keys + s * g.stepW, 0, 1, g.H);
    }
    const P = this.pat(false);
    // (The other channels' notes in this bar, faintly, to write against.)
    if (!g.drums) {
      x.globalAlpha = 0.22;
      S.chans.forEach((o, i) => {
        if (i === this.ch || o.kind === 'drums') return;
        const n = o.seq[this.bar] || 0;
        const Q = n ? o.pats[n - 1] : null;
        if (!Q) return;
        x.fillStyle = colorOf(i);
        for (const [st, note, len] of Q.notes) x.fillRect(g.keys + st * g.stepW + 2, this.rowY(g, note) + 3, Math.min(len, g.bs - st) * g.stepW - 4, g.rh - 7);
      });
      x.globalAlpha = 1;
    }
    if (P) {
      for (const [st, note, len, vel] of P.notes) {
        const nx = g.keys + st * g.stepW + 1;
        const nw = Math.max(3, Math.min(len, g.bs - st) * g.stepW - 2);
        const ny = this.rowY(g, note) + 1;
        x.globalAlpha = 0.45 + 0.55 * vel;
        x.fillStyle = col;
        x.fillRect(nx, ny, nw, g.rh - 3);
        x.globalAlpha = 1;
        x.fillStyle = 'rgba(255,255,255,0.55)';
        x.fillRect(nx, ny, nw, 1);
        x.fillStyle = 'rgba(0,0,0,0.45)';
        x.fillRect(nx, ny + g.rh - 4, nw, 1);
        // (Running on past the bar's end.)
        if (st + len > g.bs) {
          x.fillStyle = '#ffffff';
          x.fillText('›', g.W - 8, ny + g.rh / 2 - 1);
        }
      }
    }
    this.rollG = g;
    this.drawRollHead();
  }

  // The line over the roll: what's open, and where it's playing.
  drawRollHead() {
    const S = this.song;
    const c = this.chan;
    if (!this.rhead || !S || !c) return;
    const n = c.seq[this.bar] || 0;
    clear(this.rhead);
    const g = this.rollG;
    const uses = n ? c.seq.filter((q) => q === n).length : 0;
    this.rhead.append(h('span', { class: 'dot', style: { background: colorOf(this.ch) } }), h('b', null, c.name), h('span', { class: 'note' }, n ? ` · pattern ${n}${uses > 1 ? ` (plays in ${uses} bars)` : ''} · bar ${this.bar + 1}` : ` · bar ${this.bar + 1} plays nothing: click below to start a pattern`));
    // (Where the song's got to, if it's playing this pattern.)
    if (this.rollMark) this.rollMark.remove();
    if (g && this.playAt !== null && this.playAt !== undefined) {
      const bs = barSteps(S);
      const pb = Math.floor(this.playAt / bs);
      if (n && (c.seq[pb] || 0) === n) {
        const st = this.playAt - pb * bs;
        this.rollMark = h('div', { class: 'mu-mark', style: { left: `${g.keys + st * g.stepW}px`, height: `${g.H}px` } });
        this.rscroll.append(this.rollMark);
      }
    }
  }

  bindRoll() {
    const cv = this.rc;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      const g = this.rollG || this.rollGeom();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      return { g, px, py, step: Math.floor((px - g.keys) / g.stepW), row: this.rowAt(g, py), keys: px < g.keys };
    };
    const hitNote = (P, p) => {
      if (!P) return -1;
      for (let i = P.notes.length - 1; i >= 0; i--) {
        const [st, note, len] = P.notes[i];
        if (note === p.row && p.step >= st && p.step < st + Math.max(1, Math.min(len, p.g.bs - st))) return i;
      }
      return -1;
    };
    let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      const S = this.song;
      const c = this.chan;
      if (!S || !c || e.button === 2) return;
      this.focus = 'roll';
      cv.focus();
      const p = pos(e);
      // The keys: heard (or, for drums, the drum on that row changed).
      if (p.keys) {
        if (c.kind === 'drums') {
          const r = cv.getBoundingClientRect();
          menu(this.drumMenu(p.row), e.clientX, Math.max(r.top, e.clientY));
        } else this.audition(c, p.row, 2);
        return;
      }
      if (p.step < 0 || p.step >= p.g.bs) return;
      if (c.kind === 'drums' && !c.kit[p.row]) return;
      if (c.kind !== 'drums' && (p.row < LO || p.row >= HI)) return;
      this.app.checkpoint('songs', this.id);
      this.lastCk = performance.now();
      const P = this.pat(true);
      if (!P) return;
      const i = hitNote(P, p);
      if (i >= 0) {
        const nt = P.notes[i];
        const endX = p.g.keys + (nt[0] + Math.min(nt[2], p.g.bs - nt[0])) * p.g.stepW;
        drag = { mode: c.kind !== 'drums' && endX - p.px < 7 ? 'size' : 'move', P, nt, st0: nt[0], row0: nt[1], len0: nt[2], step0: p.step, rowStart: p.row, moved: false };
      } else {
        if (P.notes.length >= SONG_LIMITS.notes) return;
        const nt = [p.step, p.row, c.kind === 'drums' ? 1 : clamp(this.lastLen, 1, p.g.bs - p.step), 0.8];
        P.notes.push(nt);
        drag = { mode: c.kind === 'drums' ? 'none' : 'draw', P, nt, step0: p.step, moved: true };
        this.audition(c, p.row, nt[2]);
        this.touched();
      }
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (!drag) {
        // (The pointer says what a drag would do.)
        const P = this.pat(false);
        const i = !p.keys ? hitNote(P, p) : -1;
        let cur = p.keys ? 'pointer' : 'crosshair';
        if (i >= 0) {
          const nt = P.notes[i];
          const endX = p.g.keys + (nt[0] + Math.min(nt[2], p.g.bs - nt[0])) * p.g.stepW;
          cur = this.chan.kind !== 'drums' && endX - p.px < 7 ? 'ew-resize' : 'move';
        }
        cv.style.cursor = cur;
        return;
      }
      const c = this.chan;
      const nt = drag.nt;
      if (drag.mode === 'draw' || drag.mode === 'size') {
        const len = clamp(p.step - nt[0] + 1, 1, SONG_LIMITS.len);
        if (len !== nt[2]) {
          nt[2] = len;
          this.lastLen = len;
          drag.moved = true;
          this.touched();
        }
      } else if (drag.mode === 'move') {
        const st = clamp(drag.st0 + (p.step - drag.step0), 0, p.g.bs - 1);
        const rows = c.kind === 'drums' ? c.kit.length - 1 : HI - 1;
        const row = clamp(drag.row0 + (p.row - drag.rowStart), c.kind === 'drums' ? 0 : LO, rows);
        if (st !== nt[0] || row !== nt[1]) {
          if (row !== nt[1]) this.audition(c, row, nt[2]);
          nt[0] = st;
          nt[1] = row;
          drag.moved = true;
          this.touched();
        }
      }
    });
    cv.addEventListener('pointerup', () => {
      if (!drag) return;
      // A note clicked (and not dragged): gone.
      if (!drag.moved && (drag.mode === 'move' || drag.mode === 'size')) {
        const i = drag.P.notes.indexOf(drag.nt);
        if (i >= 0) drag.P.notes.splice(i, 1);
        this.touched();
      } else if (drag.mode === 'move' || drag.mode === 'size') this.lastLen = drag.nt[2];
      drag = null;
      this.drawGrid();
      this.drawPatPanel();
    });
    cv.addEventListener('wheel', (e) => {
      const P = this.pat(false);
      const p = pos(e);
      const i = hitNote(P, p);
      if (i < 0) return;
      e.preventDefault();
      this.ck();
      const nt = P.notes[i];
      nt[3] = Math.round(clamp(nt[3] + (e.deltaY < 0 ? 0.1 : -0.1), 0.1, 1) * 10) / 10;
      this.touched();
      toast(`Struck ${Math.round(nt[3] * 100)}% hard`, '', 700);
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const P = this.pat(false);
      const p = pos(e);
      const i = hitNote(P, p);
      if (i >= 0) {
        this.ck();
        P.notes.splice(i, 1);
        this.touched();
        this.drawGrid();
        return;
      }
      contextMenu(e, this.patMenu());
    });
  }

  // A note changed: saved, drawn (the song's squares when it's let go).
  touched() {
    this.app.touch('songs', this.id);
    this.drawRoll();
  }

  drumMenu(row) {
    const c = this.chan;
    const items = [{ head: c.kit[row] ? DRUM_NAMES[c.kit[row]] : 'A new row' }];
    for (const [k, nm] of Object.entries(DRUM_NAMES)) items.push({ label: nm, icon: c.kit[row] === k ? 'check' : null, onClick: () => this.setDrum(row, k) });
    if (c.kit[row]) items.push({ sep: true }, { label: 'Hear it', icon: 'play', onClick: () => this.audition(c, row) }, { label: 'Take this row out', icon: 'trash', danger: true, off: c.kit.length <= 1, onClick: () => this.removeDrum(row) });
    return items;
  }

  setDrum(row, k) {
    const c = this.chan;
    if (row >= 16) return;
    this.set(() => {
      c.kit[row] = k;
    }, { side: true });
    this.audition(c, row);
  }

  removeDrum(row) {
    const c = this.chan;
    this.set(() => {
      c.kit.splice(row, 1);
      for (const P of c.pats) P.notes = P.notes.filter((q) => q[1] !== row).map((q) => (q[1] > row ? [q[0], q[1] - 1, q[2], q[3]] : q));
    }, { side: true });
  }

  patMenu() {
    const c = this.chan;
    const P = this.pat(false);
    const items = [{ head: 'The pattern' },
      { label: 'Copy', icon: 'copy', key: 'Ctrl+C', off: !P, onClick: () => this.copy() },
      { label: 'Paste', icon: 'paste', key: 'Ctrl+V', off: !this.clip || this.clip.type !== 'pattern', onClick: () => this.paste() },
      { label: 'Clear it', icon: 'trash', key: 'Delete', off: !P || !P.notes.length, onClick: () => this.clearPat() }];
    if (c.kind !== 'drums') {
      items.push({ sep: true },
        { label: 'Up a half-step', icon: 'up', off: !P, onClick: () => this.transpose(1) },
        { label: 'Down a half-step', icon: 'down', off: !P, onClick: () => this.transpose(-1) },
        { label: 'Up an octave', icon: 'up', off: !P, onClick: () => this.transpose(12) },
        { label: 'Down an octave', icon: 'down', off: !P, onClick: () => this.transpose(-12) },
        { label: 'Make up a melody (in the key)', icon: 'star', onClick: () => this.inventMelody() });
    } else items.push({ sep: true }, { label: 'A beat to start from', icon: 'drum', sub: Object.keys(BEATS).map((k) => ({ label: k, onClick: () => this.putBeat(k) })) });
    items.push({ label: 'A step later', icon: 'next', off: !P, onClick: () => this.shift(1) }, { label: 'A step sooner', icon: 'prev', off: !P, onClick: () => this.shift(-1) });
    return items;
  }

  copy() {
    const S = this.song;
    if (this.focus === 'grid' && this.range) {
      const [a, b] = [Math.min(...this.range), Math.max(...this.range)];
      this.clip = { type: 'bars', seq: S.chans[this.ch].seq.slice(a, b + 1) };
      toast(`Copied bars ${a + 1}-${b + 1} of ${this.chan.name}.`, '', 1200);
      return;
    }
    const P = this.pat(false);
    if (!P) return;
    this.clip = { type: 'pattern', kind: this.chan.kind, notes: P.notes.map((q) => q.slice()) };
    toast('Copied the pattern.', '', 1000);
  }

  paste() {
    const c = this.chan;
    if (!this.clip || !c) return;
    if (this.clip.type === 'bars') {
      const seq = this.clip.seq;
      this.set(() => {
        seq.forEach((n, i) => {
          if (this.bar + i < c.seq.length) c.seq[this.bar + i] = n <= c.pats.length ? n : 0;
        });
      }, { side: true });
      return;
    }
    this.set(() => {
      const P = this.pat(true);
      if (!P) return;
      const rows = c.kind === 'drums' ? c.kit.length : 128;
      const bs = barSteps(this.song);
      P.notes = this.clip.notes.filter((q) => q[0] < bs && q[1] < rows && (c.kind === 'drums') === (this.clip.kind === 'drums')).map((q) => q.slice());
    }, { side: true });
  }

  clearPat() {
    if (this.focus === 'grid' && this.range) return this.setCells(0);
    const P = this.pat(false);
    if (!P) return null;
    this.set(() => {
      P.notes = [];
    }, { side: true });
    return null;
  }

  transpose(d) {
    const P = this.pat(false);
    if (!P) return;
    this.set(() => {
      for (const q of P.notes) q[1] = clamp(q[1] + d, LO, HI - 1);
    });
  }

  shift(d) {
    const P = this.pat(false);
    if (!P) return;
    const bs = barSteps(this.song);
    this.set(() => {
      for (const q of P.notes) q[0] = (q[0] + d + bs) % bs;
    });
  }

  putBeat(name) {
    const c = this.chan;
    const bs = barSteps(this.song);
    this.set(() => {
      const P = this.pat(true);
      if (!P) return;
      // (The beat's rows as the default kit has them: found in this kit,
      // or the nearest it has.)
      const want = ['kick', 'snare', 'hat', 'hatO', 'clap', 'tom', 'rim', 'crash'];
      const rowOf = (r) => {
        const i = c.kit.indexOf(want[r]);
        return i >= 0 ? i : r < c.kit.length ? r : -1;
      };
      P.notes = BEATS[name].map(([st, r]) => [Math.round((st * bs) / 16), rowOf(r), 1, r === 2 ? 0.55 : 0.85]).filter((q) => q[1] >= 0 && q[0] < bs);
    }, { side: true });
  }

  // A melody made up: a wander up and down the key, mostly by step, long
  // notes on the beats.
  inventMelody() {
    const S = this.song;
    const c = this.chan;
    const bs = barSteps(S);
    const sc = scaleOf(S.scale);
    const P0 = this.pat(false);
    const ns = P0 && P0.notes.length ? P0.notes.map((q) => q[1]) : [];
    const base = ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : c.inst === 'pluckbass' || /bass|sub/.test(c.inst || '') ? 45 : 67;
    const deg = (n) => {
      const oct = Math.floor((n - S.key) / 12);
      const pc = (((n - S.key) % 12) + 12) % 12;
      let best = 0;
      sc.forEach((d, i) => {
        if (Math.abs(d - pc) < Math.abs(sc[best] - pc)) best = i;
      });
      return oct * sc.length + best;
    };
    const midiOf = (d) => S.key + 12 * Math.floor(d / sc.length) + sc[((d % sc.length) + sc.length) % sc.length];
    let d = deg(base);
    const start = d;
    const notes = [];
    let st = 0;
    while (st < bs) {
      const onBeat = st % S.steps === 0;
      const len = Math.min(bs - st, onBeat && Math.random() < 0.5 ? S.steps : Math.random() < 0.6 ? Math.max(1, S.steps / 2) : 1);
      if (Math.random() > 0.12 || st === 0) notes.push([st, clamp(midiOf(d), LO, HI - 1), len, onBeat ? 0.85 : 0.7]);
      const r = Math.random();
      d += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : 0;
      d = clamp(d, start - 5, start + 5);
      st += len;
    }
    this.set(() => {
      const P = this.pat(true);
      if (P) P.notes = notes;
    }, { side: true });
  }

  // ------------------------------------------------------------ keys
  onKey(e) {
    const S = this.song;
    if (!S) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') {
      this.toggle(e.shiftKey);
      return true;
    }
    if (ctrl && e.code === 'KeyC') {
      this.copy();
      return true;
    }
    if (ctrl && e.code === 'KeyV') {
      this.paste();
      return true;
    }
    if (ctrl) return false;
    if (e.code === 'Delete' || e.code === 'Backspace') {
      this.clearPat();
      return true;
    }
    const arrows = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (arrows[e.code] && this.focus === 'grid') {
      const [dc, db] = arrows[e.code];
      this.pick(this.ch + dc, this.bar + db, e.shiftKey && !!db);
      return true;
    }
    if (this.focus === 'grid' && /^Digit[0-9]$/.test(e.code)) {
      // (Two digits typed quickly: a pattern past 9.)
      const now = performance.now();
      this.typed = now - (this.typedT || 0) < 700 ? `${this.typed}${e.code.slice(5)}` : e.code.slice(5);
      this.typedT = now;
      let n = parseInt(this.typed, 10);
      if (n > this.chan.pats.length) n = parseInt(e.code.slice(5), 10);
      if (n <= this.chan.pats.length) this.setCells(n);
      return true;
    }
    if (e.key === '+' || e.key === '=') {
      this.setCells(Math.min(this.chan.pats.length, (this.chan.seq[this.bar] || 0) + 1));
      return true;
    }
    if (e.key === '-') {
      this.setCells(Math.max(0, (this.chan.seq[this.bar] || 0) - 1));
      return true;
    }
    if (e.code === 'KeyN') {
      this.newPattern(false);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ the panel
  drawSide() {
    const S = this.song;
    const side = this.side;
    if (!side || !S) return;
    clear(side);
    this.patPanelBody = h('div');
    side.append(panel('Song', this.songBody(), { key: 'mu-song' }), panel('Channel', this.chanBody(), { key: 'mu-chan' }), panel('Pattern', this.patPanelBody, { key: 'mu-pat' }));
    this.drawPatPanel();
    this.drawInfo();
  }

  songBody() {
    const S = this.song;
    const el = h('div');
    const set = (fn, o = {}) => this.set(fn, { side: true, top: true, ...o });
    el.append(
      field('Tempo', slider({ value: S.bpm, min: 40, max: 240, int: true, onChange: (v) => set((s) => (s.bpm = v), { grid: false, roll: false }) }), { tip: 'Beats a minute.' }),
      field('Beats a bar', select([2, 3, 4, 5, 6, 7, 8].map((n) => [String(n), String(n)]), String(S.beats), (v) => this.setGrid(+v, S.steps)), { tip: 'How many beats make a bar (and a pattern).' }),
      field('Steps a beat', select([['2', '2 (eighths)'], ['3', '3 (triplets)'], ['4', '4 (sixteenths)'], ['6', '6'], ['8', '8 (fine)']], String(S.steps), (v) => this.setGrid(S.beats, +v)), { tip: 'How finely a beat\'s cut (the squares in a pattern).' }),
      field('Bars', numberInput({ value: S.bars, min: 1, max: SONG_LIMITS.bars, int: true, onChange: (v) => set((s) => {
        for (const c of s.chans) c.seq = Array.from({ length: v }, (_, i) => c.seq[i] || 0);
        s.bars = v;
        s.loopFrom = clamp(s.loopFrom, 0, v - 1);
        this.bar = clamp(this.bar, 0, v - 1);
      }) }), { tip: 'How long the song is.' }),
      field('Key', select(KEY_NAMES.map((k, i) => [String(i), k]), String(S.key), (v) => set((s) => (s.key = +v), { grid: false })), { tip: 'The note it\'s home on (shown gold in the roll).' }),
      field('Scale', select(Object.entries(SCALE_NAMES), S.scale, (v) => set((s) => (s.scale = v), { grid: false })), { tip: 'The notes that belong (shown lighter in the roll).' }),
      field('Swing', slider({ value: Math.round(S.swing * 100), min: 0, max: 50, int: true, onChange: (v) => set((s) => (s.swing = v / 100), { grid: false, roll: false }) }), { tip: 'Every other step a little late: a lilt.' }),
      field('Room', select(SPACES.map((k) => [k, k[0].toUpperCase() + k.slice(1)]), S.space, (v) => set((s) => (s.space = v), { restart: true, grid: false, roll: false })), { tip: 'Where it\'s played: the ring of the room.' }),
      field('Room amount', slider({ value: Math.round(S.wet * 100), min: 0, max: 100, int: true, onChange: (v) => set((s) => (s.wet = v / 100), { grid: false, roll: false }) })),
      field('Echo', slider({ value: Math.round(S.echo * 100), min: 0, max: 100, int: true, onChange: (v) => set((s) => (s.echo = v / 100), { grid: false, roll: false }) }), { tip: 'A tape echo in time with it.' }),
      field('Round again from', numberInput({ value: S.loopFrom + 1, min: 1, max: S.bars, int: true, onChange: (v) => set((s) => (s.loopFrom = clamp(v - 1, 0, s.bars - 1))) }), { tip: 'Played as music, it starts at the top and comes back round to this bar (an intro played once).' }),
      h('div', { class: 'note', style: { padding: '4px 2px' } }, `${mmss(songSecs(S))} long; once round from bar ${S.loopFrom + 1}, ${mmss(songSecs(S) * (1 - S.loopFrom / S.bars))}.`));
    return el;
  }

  // The bar's shape changed (beats, steps): the notes put where they were
  // in time, as near as the new steps allow (any past the bar's end lost).
  async setGrid(beats, steps) {
    const S = this.song;
    if (beats === S.beats && steps === S.steps) return;
    const k = steps / S.steps;
    const bs = beats * steps;
    let lost = 0;
    for (const c of S.chans) for (const P of c.pats) for (const q of P.notes) if (Math.round(q[0] * k) >= bs) lost++;
    if (lost && !(await confirm('Some notes won\'t fit', `${lost} note${lost > 1 ? 's' : ''} would be past the end of the shorter bar, and be lost. Go on?`, { yes: 'Go on' }))) return this.drawSide();
    this.set((s) => {
      for (const c of s.chans) for (const P of c.pats) P.notes = P.notes.map(([st, n, len, vel]) => [Math.round(st * k), n, Math.max(1, Math.round(len * k)), vel]).filter((q) => q[0] < bs);
      s.beats = beats;
      s.steps = steps;
    }, { side: true, top: true });
    return null;
  }

  chanBody() {
    const S = this.song;
    const c = this.chan;
    const el = h('div');
    if (!c) return el;
    const set = (fn, o = {}) => this.set(fn, { grid: false, roll: false, ...o });
    el.append(field('Name', textInput({ value: c.name, max: 24, onChange: (v) => set(() => (c.name = v.trim().slice(0, 24) || c.name), { heads: true }) })));
    if (c.kind === 'tone') {
      const sel = h('select', { class: 'inp' });
      for (const [fam, list] of INSTRUMENTS) {
        const g = h('optgroup', { label: fam });
        for (const [k, nm] of list) g.append(h('option', { value: k, selected: k === c.inst || null }, nm));
        sel.append(g);
      }
      sel.addEventListener('change', () => {
        set(() => (c.inst = sel.value), { heads: true });
        this.audition(c, 60 + S.key, 4);
      });
      sel.addEventListener('keydown', (e) => e.stopPropagation());
      el.append(field('Instrument', h('div', { class: 'sound-pick' }, sel, button(null, { icon: 'play', small: true, kind: 'ghost', title: 'Hear it', onClick: () => this.audition(c, 60 + S.key, 4) }))));
    } else if (c.kind === 'sound') {
      const sounds = Object.values(this.app.mod.sounds || {});
      el.append(field('Sound', select([['', '(none)'], ...sounds.map((s) => [`@${s.id}`, s.name])], c.inst || '', (v) => set(() => (c.inst = v || null), { heads: true })), { tip: 'One of your sounds (the Sound tab), played higher or lower for each note.' }));
      const s = this.clipOf(c.inst);
      if (s) {
        el.append(field('Its note', select(Array.from({ length: 73 }, (_, i) => [String(24 + i), noteName(24 + i)]), String(s.root || 60), (v) => {
          this.app.checkpoint('sounds', s.id);
          s.root = +v;
          this.app.touch('sounds', s.id);
          this.audition(c, 60, 4);
        }), { tip: 'The note the sound is, as it was made (written there, it plays as it is).' }));
      }
      el.append(check('Rings out past its note', c.ring !== false, (v) => set(() => (c.ring = v)), { tip: 'Off: cut short at the note\'s end.' }));
    } else {
      const kit = h('div', { class: 'mu-kit' });
      c.kit.forEach((d, r) => {
        kit.append(h('div', { class: 'row' }, select(Object.entries(DRUM_NAMES), d, (v) => this.setDrum(r, v)), button(null, { icon: 'play', small: true, kind: 'ghost', title: 'Hear it', onClick: () => this.audition(c, r) }), button(null, { icon: 'trash', small: true, kind: 'ghost', title: 'Take this row out', onClick: () => this.removeDrum(r) })));
      });
      if (c.kit.length < 16) kit.append(button('A drum', { icon: 'plus', small: true, kind: 'ghost', onClick: () => this.setDrum(c.kit.length, 'tom') }));
      el.append(field('Its drums', kit, { tip: 'A row for each, top to bottom.' }));
    }
    el.append(
      field('Volume', slider({ value: Math.round(c.vol * 100), min: 0, max: 150, int: true, onChange: (v) => set(() => (c.vol = v / 100)) })),
      field('Left / right', slider({ value: Math.round(c.pan * 100), min: -100, max: 100, int: true, onChange: (v) => set(() => (c.pan = v / 100)) })),
      field('Room', slider({ value: Math.round(c.verb * 100), min: 0, max: 100, int: true, onChange: (v) => set(() => (c.verb = v / 100)) }), { tip: 'How much of it rings in the room.' }),
      field('Echo', slider({ value: Math.round(c.echo * 100), min: 0, max: 100, int: true, onChange: (v) => set(() => (c.echo = v / 100)) })),
      h('div', { class: 'row', style: { gap: '6px', marginTop: '4px' } },
        check('Muted', c.mute, (v) => set(() => (c.mute = v), { heads: true, grid: true })),
        check('Solo', c.solo, (v) => set(() => (c.solo = v), { heads: true, grid: true }))));
    return el;
  }

  drawPatPanel() {
    const el = this.patPanelBody;
    const c = this.chan;
    if (!el || !c) return;
    clear(el);
    const cur = c.seq[this.bar] || 0;
    const chips = h('div', { class: 'mu-pats' });
    c.pats.forEach((P, i) => {
      const uses = c.seq.filter((q) => q === i + 1).length;
      const chip = h('span', { class: `chip${cur === i + 1 ? ' on' : ''}${P.notes.length ? '' : ' none'}`, 'data-tip': `Pattern ${i + 1}: ${P.notes.length} notes, in ${uses} bar${uses === 1 ? '' : 's'} (click: play it in the bar${this.range ? 's' : ''} chosen)` }, String(i + 1));
      chip.addEventListener('click', () => this.setCells(i + 1));
      chips.append(chip);
    });
    el.append(h('div', { class: 'note' }, cur ? `Bar ${this.bar + 1} plays pattern ${cur}.` : `Bar ${this.bar + 1} plays nothing on this channel.`), chips,
      h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap', marginTop: '6px' } },
        button('New', { icon: 'plus', small: true, title: 'A new, empty pattern in this bar (N)', onClick: () => this.newPattern(false) }),
        button('Copy here', { icon: 'copy', small: true, disabled: !cur, title: 'A copy of this one, to change, in this bar', onClick: () => this.newPattern(true) }),
        button('None', { icon: 'minus', small: true, title: 'Nothing in this bar (0)', onClick: () => this.setCells(0) }),
        menuButton('More', () => this.patMenu(), { small: true })));
  }

  // ------------------------------------------------------------ in and out
  async upload(over = false) {
    const f = await pickFile('.tsong,.json,.mid,.midi,audio/midi');
    if (!f) return;
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const isMidi = /\.midi?$/i.test(f.name) || String.fromCharCode(...buf.subarray(0, 4)) === 'MThd';
      const name = f.name.replace(/\.(tsong|json|midi?)$/i, '').slice(0, 40) || 'Song';
      let song;
      let sounds = {};
      if (isMidi) song = midiToSong(buf, { name });
      else {
        const r = readSongFile(new window.TextDecoder().decode(buf));
        song = r.song;
        sounds = r.sounds;
      }
      // (The sounds it plays, put in the mod: as new ones if the mod has
      // others by those names.)
      const m = this.app.mod;
      for (const [sid, s] of Object.entries(sounds)) {
        if (!cleanSound(s)) continue;
        let nid = sid;
        if (m.sounds[sid] && m.sounds[sid].data !== s.data) nid = freeId(m, 'sounds', s.name || sid);
        if (!m.sounds[nid]) {
          m.sounds[nid] = { ...s, id: nid };
          this.app.touch('sounds', nid, { quiet: true });
        }
        for (const c of song.chans) if (c.inst === `@${sid}`) c.inst = `@${nid}`;
      }
      const lost = song.lost;
      delete song.lost;
      if (over && this.song) {
        if (!(await confirm('Over this song?', `"${this.song.name}" will be what's in the file instead (Undo brings it back).`, { yes: 'Put it over this' }))) return;
        this.app.checkpoint('songs', this.id);
        const keep = this.song.name;
        for (const k of Object.keys(this.song)) if (k !== 'id') delete this.song[k];
        Object.assign(this.song, song, { name: keep });
        this.app.touch('songs', this.id);
        this.build();
      } else {
        song.name = name;
        await this.app.create('songs', song);
      }
      this.app.drawExplorer();
      toast(`${isMidi ? 'MIDI' : 'Song'} brought in: ${song.chans.length} channels, ${song.bars} bars.${lost ? ` (${lost} bars had too many different patterns, and are quiet.)` : ''}`, 'good', 4000);
    } catch (e) {
      toast(e.message || String(e), 'bad', 5000);
    }
  }

  fileName() {
    return (this.song.name || 'song').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'song';
  }

  downloadSong() {
    download(`${this.fileName()}.tsong`, songFile(this.song, this.app.mod));
  }

  downloadMidi() {
    download(`${this.fileName()}.mid`, new window.Blob([songToMidi(this.song)], { type: 'audio/midi' }));
    toast('Downloaded. (MIDI has the notes and instruments: the room, the echo and your sounds stay here.)', 'good', 4000);
  }

  async render(rate) {
    toast('Making it into sound...', '', 1500);
    return renderSong(this.song, { rate, clip: (r) => this.clipOf(r) });
  }

  async downloadWav() {
    try {
      const r = await this.render(44100);
      download(`${this.fileName()}.wav`, new window.Blob([encodeWav(r.left, r.rate, r.right)], { type: 'audio/wav' }));
    } catch (e) {
      toast(e.message || String(e), 'bad', 5000);
    }
  }

  // The song made into a sound (in the mod's Sounds, for the Sound tab).
  async toSound() {
    try {
      const r = await this.render(44100);
      let x = convertRate(r.x, r.rate, 22050);
      const max = 22050 * 180;
      if (x.length > max) x = x.slice(0, max);
      const id = await this.app.create('sounds', { name: `${this.song.name} (sound)`.slice(0, 40), ...packClip(x, 22050), vol: 1, root: 60, loop: true }, { open: false });
      toast(`Made a sound of it: "${this.app.mod.sounds[id].name}", in Sounds.`, 'good', 3500);
    } catch (e) {
      toast(e.message || String(e), 'bad', 5000);
    }
  }

  toBiome() {
    const bs = Object.values(this.app.mod.biomes || {});
    const r = this.playBtn.getBoundingClientRect();
    const items = [{ head: 'Its music by day, in...' }];
    for (const b of bs) items.push({ label: b.title || b.name, onClick: () => {
      this.app.checkpoint('biomes', b.id);
      b.music = `@${this.id}`;
      this.app.touch('biomes', b.id);
      toast(`"${this.song.name}" plays in ${b.title || b.name} now.`, 'good');
    } });
    if (!bs.length) items.push({ label: 'Make a biome first (the Biome tab), or change one of the game\'s', off: true });
    menu(items, r.left, r.bottom + 4);
  }
}
