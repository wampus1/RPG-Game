// The Workshop's Sound tab (round 66): a sound's shape, to cut and join and
// work on (see mod/sound.js). Bring one in (a .wav, .mp3, .ogg...), record
// one, or take one of the game's own; choose a stretch of it with the
// mouse; cut, copy, paste, take out, keep only it; make it louder,
// softer, faster, slower, higher, lower, backwards, echoing, ringing in a
// room, muffled, crushed; mix other sounds in over it (yours, a file, the
// game's, a tone, a song of yours). Kept small in the mod; downloaded as a
// .wav.
import { h, ic, clear, button, group, field, slider, check, select, panel, toast, menu, contextMenu, dialog, download, pickFile, confirm } from './kit.js';
import { titleBar, menuButton } from './common.js';
import { SOUNDS } from '../mod/nodes.js';
import { clipSamples, packClip, clipSecs, clipBytes, encodeWav, decodeWav, convertRate, cut, insert, mixIn, onRange, silence, normalize, fade, peaks, tone as makeTone, EFFECTS, SOUND_RATES, RATE_NAMES, SOUND_MAX_SECS, cleanSound } from '../mod/sound.js';
import { renderSong, cleanSong, freeChanId, KEY_NAMES } from '../mod/song.js';
import { renderGameSound } from '../game/audio.js';

const RULER = 18; // the seconds along the top
const STRIP = 22; // the whole sound, small, along the bottom
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const noteName = (n) => `${KEY_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
const ADDS = ['gain', 'normalize', 'fadein', 'fadeout', 'reverse', 'speed', 'stretch', 'pitch', 'echo', 'reverb', 'lowpass', 'highpass', 'phone', 'distort', 'crush', 'tremolo', 'vibrato', 'chorus', 'trim'];

export default class SoundTool {
  constructor(app) {
    this.app = app;
    this.id = null;
    this.x = new Float32Array(0);
    this.a = null; // the stretch chosen [a, b) (samples), or null
    this.b = null;
    this.cur = 0; // where a paste goes
    this.view = { a: 0, spp: 1 }; // the first sample shown, samples a pixel
    this.undoS = [];
    this.redoS = [];
    this.clip = null;
    this.fx = null; // the effect being set up: { key, o }
    this.vol = 0.8;
  }

  get s() {
    return this.id && this.app.mod.sounds && this.app.mod.sounds[this.id] ? this.app.mod.sounds[this.id] : null;
  }

  get rate() {
    return this.s ? this.s.rate : 22050;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.onResize = () => this.draw();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    // (Round 67: what was open, drawn again on coming back to the tab.)
    if (this.id && this.s) this.open('sounds', this.id);
  }

  unmount() {
    this.stopPlay();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
  }

  current() {
    return this.s ? { kind: 'sounds', id: this.id } : null;
  }

  hintText() {
    return this.s ? 'Drag across the sound to choose a stretch of it (Shift to stretch the choice); click to put the cursor. Space plays; Ctrl+wheel zooms. Effects work on what\'s chosen (or all of it).' : 'Bring a sound in (a file, the microphone, the game\'s), then work on it.';
  }

  keyHelp() {
    return [['Space', 'Play (what\'s chosen, or from the cursor) / stop'], ['Ctrl+A', 'Choose all of it'], ['Esc', 'Choose none'], ['Ctrl+X / C / V', 'Cut / copy / paste (at the cursor)'], ['Delete', 'Take out what\'s chosen'], ['Ctrl+wheel', 'Zoom'], ['Wheel', 'Along it']];
  }

  open(kind, id) {
    this.stopPlay();
    if (!id || !this.app.mod.sounds || !this.app.mod.sounds[id]) {
      this.id = null;
      return this.empty();
    }
    if (this.id !== id) {
      this.a = null;
      this.b = null;
      this.cur = 0;
      this.undoS = [];
      this.redoS = [];
      this.fx = null;
      this.fitNext = true;
    }
    this.id = id;
    cleanSound(this.s);
    this.x = clipSamples(this.s).slice();
    this.build();
    return null;
  }

  reload() {
    if (this.s) {
      this.x = clipSamples(this.s).slice();
      this.build();
    } else this.empty();
  }

  removed(kind, id) {
    if (kind === 'sounds' && id === this.id) {
      this.stopPlay();
      this.id = null;
      this.empty();
    }
  }

  renamed() {
    if (this.nameEl && this.s) this.nameEl.value = this.s.name;
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
    this.stage.append(h('div', { class: 'home scroll', style: { overflow: 'auto' } },
      h('h1', null, 'Sound'),
      h('div', { class: 'sub' }, 'Sounds for your mod: bring one in from a file (or record one), then cut it, join it, mix others in, make it faster, slower, higher, louder, echoing. Use them from nodes (Sound, Play music), on effects and triggers, as instruments in your songs, or as a biome\'s music.'),
      h('div', { class: 'cards' },
        card('import', 'From a sound file', 'A .wav, .mp3, .ogg or .flac (up to three minutes).', () => this.importFile()),
        card('mic', 'Record one', 'From a microphone.', () => this.record()),
        card('speaker', 'One of the game\'s', 'Start from one of the game\'s own sounds.', () => this.fromGame()),
        card('plus', 'Silence, to build on', 'A second of nothing: mix tones and sounds into it.', () => this.newBlank()))));
    this.insp.append(h('div', { class: 'insp-head' }, ic('speaker'), 'Sound'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open.')));
  }

  // ------------------------------------------------------------ bringing one in
  ctx() {
    const A = this.app.o.audio;
    if (A && A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return A.ctx;
    }
    return null;
  }

  // A file's sound, one channel: { rate, x }.
  async decodeFile(f) {
    const buf = await f.arrayBuffer();
    const ctx = this.ctx() || (globalThis.OfflineAudioContext ? new globalThis.OfflineAudioContext(1, 1, 44100) : null);
    if (ctx && ctx.decodeAudioData) {
      try {
        const ab = await ctx.decodeAudioData(buf.slice(0));
        const x = new Float32Array(ab.length);
        for (let c = 0; c < ab.numberOfChannels; c++) {
          const d = ab.getChannelData(c);
          for (let i = 0; i < x.length; i++) x[i] += d[i] / ab.numberOfChannels;
        }
        return { rate: ab.sampleRate, x };
      } catch {
        // (Read it as a .wav ourselves, then.)
      }
    }
    const w = decodeWav(new Uint8Array(buf));
    if (!w) throw new Error('That file\'s sound couldn\'t be read (try a .wav, .mp3 or .ogg).');
    return w;
  }

  // How good to keep it (and so how big it is), asked.
  async askRate(secs, def = 22050) {
    const pick = await dialog({ title: 'How should it be kept?', icon: 'speaker', body: h('div', null,
      h('div', { class: 'note', style: { marginBottom: '8px' } }, `It's ${secs.toFixed(1)} seconds long. Clearer sounds are bigger (a mod with them is bigger to send).`),
      ...SOUND_RATES.map((r) => h('div', { class: 'note' }, `${RATE_NAMES[r]}: about ${Math.max(1, Math.round((secs * r * 0.68) / 1024))} KB`))),
    buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, ...SOUND_RATES.map((r) => ({ label: RATE_NAMES[r].split(' ')[0], kind: r === def ? 'primary' : null, value: r }))] });
    return pick || null;
  }

  async importFile() {
    const f = await pickFile('audio/*,.wav,.mp3,.ogg,.oga,.flac,.m4a,.aac,.webm');
    if (!f) return null;
    try {
      const w = await this.decodeFile(f);
      return await this.fromSamples(w.x, w.rate, f.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 40) || 'Sound');
    } catch (e) {
      toast(e.message || String(e), 'bad', 5000);
      return null;
    }
  }

  // Samples (at `rate`) as a new sound of the mod's, opened.
  async fromSamples(x, rate, name, o = {}) {
    let secs = x.length / rate;
    if (secs > SOUND_MAX_SECS) {
      if (!(await confirm('That\'s a long one', `It's ${fmt(secs)} long: only the first ${fmt(SOUND_MAX_SECS)} can be kept. Keep that much?`, { yes: 'Keep the first part' }))) return null;
      x = x.subarray(0, Math.floor(SOUND_MAX_SECS * rate));
      secs = SOUND_MAX_SECS;
    }
    const to = o.rate || (await this.askRate(secs, secs > 40 ? 16000 : 22050));
    if (!to) return null;
    const y = convertRate(x, rate, to);
    const id = await this.app.create('sounds', { name, ...packClip(y, to), vol: 1, root: 60, loop: secs > 20 });
    toast(`"${name}" brought in (${secs.toFixed(1)}s).`, 'good');
    return id;
  }

  async newBlank() {
    return this.app.create('sounds', { name: 'Sound', ...packClip(silence(22050), 22050), vol: 1, root: 60, loop: false });
  }

  // One of the game's own sounds, as a new sound (`mix`: into this one).
  fromGame(mix = false) {
    const r = this.stage ? this.stage.getBoundingClientRect() : { left: 200, top: 100 };
    const items = [{ head: 'The game\'s sounds' }];
    for (const name of SOUNDS) items.push({ label: name, onClick: async () => {
      const g = await renderGameSound(name, mix ? this.rate : 22050);
      if (!g || !g.x.length) {
        toast('That one couldn\'t be made here.', 'bad');
        return;
      }
      if (mix) this.mixDialog(g.x, name);
      else this.app.create('sounds', { name, ...packClip(g.x, 22050), vol: 1, root: 60, loop: false });
    } });
    menu(items, r.left + 40, r.top + 60);
  }

  async record() {
    const nav = globalThis.navigator;
    if (!nav || !nav.mediaDevices || !nav.mediaDevices.getUserMedia || !globalThis.MediaRecorder) {
      toast('This browser can\'t record.', 'bad');
      return;
    }
    let stream;
    try {
      stream = await nav.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast('No microphone (or it wasn\'t allowed).', 'bad');
      return;
    }
    const rec = new globalThis.MediaRecorder(stream);
    const parts = [];
    rec.ondataavailable = (e) => parts.push(e.data);
    const t0 = performance.now();
    const clock = h('div', { class: 'big', style: { fontFamily: 'var(--pix)', fontSize: '24px', textAlign: 'center' } }, '0:00.0');
    const timer = window.setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      clock.textContent = fmt(s).slice(0, -1);
      if (s >= SOUND_MAX_SECS) rec.state === 'recording' && rec.stop();
    }, 100);
    rec.start();
    const done = new Promise((res) => {
      rec.onstop = res;
    });
    const keep = await dialog({ title: 'Recording', icon: 'mic', body: h('div', null, h('div', { class: 'note' }, 'Speak, sing, knock, clap...'), clock), buttons: [{ label: 'Throw it away', kind: 'ghost', value: false }, { label: 'Stop and keep it', kind: 'primary', value: true }] });
    window.clearInterval(timer);
    if (rec.state === 'recording') rec.stop();
    await done;
    for (const tr of stream.getTracks()) tr.stop();
    if (!keep) return;
    try {
      const blob = new window.Blob(parts, { type: rec.mimeType || 'audio/webm' });
      const w = await this.decodeFile(blob);
      await this.fromSamples(w.x, w.rate, 'Recording', { rate: 22050 });
    } catch (e) {
      toast(e.message || String(e), 'bad', 5000);
    }
  }

  // ------------------------------------------------------------ changing it
  // The samples changed: kept (and the last way they were, for Undo).
  commit(y, label = null) {
    const s = this.s;
    if (!s) return;
    if (y.length > s.rate * SOUND_MAX_SECS) {
      y = y.slice(0, s.rate * SOUND_MAX_SECS);
      toast(`A sound can be ${fmt(SOUND_MAX_SECS)} long at most: the end's cut off.`, 'bad');
    }
    this.undoS.push({ rate: s.rate, n: s.n, data: s.data, a: this.a, b: this.b });
    if (this.undoS.length > 40) this.undoS.shift();
    this.redoS = [];
    this.x = y;
    Object.assign(s, packClip(y, s.rate));
    this.app.touch('sounds', this.id);
    this.cur = clamp(this.cur, 0, y.length);
    if (this.a !== null && (this.a >= y.length || this.b > y.length)) {
      this.b = Math.min(this.b, y.length);
      if (this.a >= this.b) this.a = this.b = null;
    }
    this.draw();
    this.drawSide();
    if (label) this.app.hint(label);
  }

  undo() {
    return this.stepHist(this.undoS, this.redoS);
  }

  redo() {
    return this.stepHist(this.redoS, this.undoS);
  }

  stepHist(from, to) {
    const s = this.s;
    if (!s || !from.length) return false;
    const st = from.pop();
    to.push({ rate: s.rate, n: s.n, data: s.data, a: this.a, b: this.b });
    Object.assign(s, { rate: st.rate, n: st.n, data: st.data });
    this.a = st.a;
    this.b = st.b;
    this.x = clipSamples(s).slice();
    this.app.touch('sounds', this.id);
    this.draw();
    this.drawSide();
    return true;
  }

  // The stretch worked on: what's chosen, or all of it.
  span() {
    return this.a !== null && this.b > this.a ? [this.a, this.b] : [0, this.x.length];
  }

  has() {
    return this.a !== null && this.b > this.a;
  }

  // `fn` done to what's chosen (or all of it); what comes out chosen.
  apply(fn, label) {
    const [a, b] = this.span();
    let len = 0;
    const y = onRange(this.x, a, b, (q) => {
      const r = fn(q);
      len = r.length;
      return r;
    });
    if (this.has()) {
      this.a = a;
      this.b = a + len;
    }
    this.commit(y, label);
  }

  copy() {
    if (!this.has()) return false;
    this.clip = this.x.slice(this.a, this.b);
    toast(`Copied ${(this.clip.length / this.rate).toFixed(2)}s.`, '', 900);
    return true;
  }

  cutSel() {
    if (!this.copy()) return;
    this.deleteSel();
  }

  deleteSel() {
    if (!this.has()) return;
    const a = this.a;
    const y = cut(this.x, this.a, this.b);
    this.a = this.b = null;
    this.cur = a;
    this.commit(y, 'Taken out.');
  }

  paste() {
    if (!this.clip) return;
    const at = this.has() ? this.a : this.cur;
    const base = this.has() ? cut(this.x, this.a, this.b) : this.x;
    const y = insert(base, at, this.clip);
    this.a = at;
    this.b = at + this.clip.length;
    this.commit(y, 'Pasted.');
  }

  trimTo() {
    if (!this.has()) return;
    const y = this.x.slice(this.a, this.b);
    this.a = this.b = null;
    this.cur = 0;
    this.fitNext = true;
    this.commit(y, 'Only that kept.');
  }

  silenceSel() {
    if (!this.has()) return;
    this.apply((q) => silence(q.length), 'Silenced.');
  }

  async insertSilence() {
    let secs = 0.5;
    const ok = await dialog({ title: 'Silence', icon: 'plus', body: h('div', null, field('How long (seconds)', slider({ value: secs, min: 0.05, max: 10, step: 0.05, onChange: (v) => (secs = v) }))), buttons: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Put it in', kind: 'primary', value: true }] });
    if (!ok) return;
    const at = this.has() ? this.a : this.cur;
    this.a = at;
    this.b = at + Math.round(secs * this.rate);
    this.commit(insert(this.x, at, silence(Math.round(secs * this.rate))), 'Silence put in.');
  }

  // Another sound laid over this one (or put in, pushing the rest along),
  // from the cursor, as loud as chosen.
  async mixDialog(y, name) {
    let g = 1;
    let how = 'mix';
    const at = this.has() ? this.a : this.cur;
    const hear = () => this.playSamples(mixIn(this.x.slice(at, at + y.length), y, 0, g), this.rate);
    const v = await dialog({ title: `Mix in "${name}"`, icon: 'speaker', body: h('div', null,
      h('div', { class: 'note', style: { marginBottom: '6px' } }, `${(y.length / this.rate).toFixed(2)}s, from ${fmt(at / this.rate)}.`),
      field('As loud as', slider({ value: 100, min: 5, max: 200, int: true, onChange: (q) => (g = q / 100) }), { tip: 'Against itself as it is.' }),
      field('How', select([['mix', 'Over what\'s there (mixed)'], ['insert', 'Put in there (the rest later)']], how, (q) => (how = q))),
      button('Hear it', { icon: 'play', small: true, onClick: hear })),
    buttons: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Mix it in', kind: 'primary', value: true }] });
    this.stopPlay();
    if (!v) return;
    const scaled = g === 1 ? y : y.map((q) => q * g);
    const out = how === 'insert' ? insert(this.x, at, scaled) : mixIn(this.x, scaled, at, 1);
    this.a = at;
    this.b = at + y.length;
    this.commit(out, `"${name}" mixed in.`);
  }

  mixMenu(e) {
    const sounds = Object.values(this.app.mod.sounds || {}).filter((q) => q.id !== this.id);
    const songs = Object.values(this.app.mod.songs || {});
    const r = e.currentTarget.getBoundingClientRect();
    menu([
      { head: 'Mix in, from the cursor' },
      { label: 'Another of your sounds', icon: 'speaker', sub: sounds.length ? sounds.map((q) => ({ label: q.name, onClick: () => this.mixDialog(convertRate(clipSamples(q), q.rate, this.rate), q.name) })) : [{ label: 'No others yet', off: true }] },
      { label: 'A sound file...', icon: 'import', onClick: async () => {
        const f = await pickFile('audio/*,.wav,.mp3,.ogg,.flac,.m4a');
        if (!f) return;
        try {
          const w = await this.decodeFile(f);
          this.mixDialog(convertRate(w.x, w.rate, this.rate), f.name);
        } catch (err) {
          toast(err.message || String(err), 'bad');
        }
      } },
      { label: 'One of the game\'s sounds', icon: 'speaker', onClick: () => this.fromGame(true) },
      { label: 'A tone...', icon: 'wave', onClick: () => this.toneDialog() },
      { label: 'One of your songs', icon: 'note', sub: songs.length ? songs.map((q) => ({ label: q.name, onClick: async () => {
        try {
          toast('Making it into sound...', '', 1200);
          const rs = await renderSong(cleanSong(q), { rate: 44100, tail: 1.5, clip: (ref) => (ref && ref[0] === '@' ? this.app.mod.sounds[ref.slice(1)] : null) });
          this.mixDialog(convertRate(rs.x, rs.rate, this.rate), q.name);
        } catch (err) {
          toast(err.message || String(err), 'bad');
        }
      } })) : [{ label: 'No songs yet (the Music tab)', off: true }] },
      { label: 'Silence...', icon: 'minus', onClick: () => this.insertSilence() },
    ], r.left, r.bottom + 4);
  }

  async toneDialog() {
    const o = { kind: 'sine', f: 440, f2: 440, secs: 0.5, vol: 0.5 };
    const v = await dialog({ title: 'A tone', icon: 'wave', body: h('div', null,
      field('Wave', select([['sine', 'Sine (pure)'], ['square', 'Square (hollow, old machines)'], ['saw', 'Saw (buzzy)'], ['noise', 'Noise (hiss)']], o.kind, (q) => (o.kind = q))),
      field('Pitch (Hz)', slider({ value: o.f, min: 30, max: 4000, int: true, onChange: (q) => (o.f = q) })),
      field('Sliding to (Hz)', slider({ value: o.f2, min: 30, max: 4000, int: true, onChange: (q) => (o.f2 = q) })),
      field('How long (seconds)', slider({ value: o.secs, min: 0.02, max: 10, step: 0.02, onChange: (q) => (o.secs = q) })),
      field('How loud', slider({ value: 50, min: 5, max: 100, int: true, onChange: (q) => (o.vol = q / 100) })),
      button('Hear it', { icon: 'play', small: true, onClick: () => this.playSamples(makeTone(this.rate, o.kind, o.f, o.secs, o.f2, o.vol), this.rate) })),
    buttons: [{ label: 'Cancel', kind: 'ghost', value: false }, { label: 'Next', kind: 'primary', value: true }] });
    this.stopPlay();
    if (v) this.mixDialog(makeTone(this.rate, o.kind, o.f, o.secs, o.f2, o.vol), `${o.kind} tone`);
  }

  async setRate(r) {
    const s = this.s;
    if (!s || r === s.rate) return;
    const y = convertRate(this.x, s.rate, r);
    const k = r / s.rate;
    this.undoS.push({ rate: s.rate, n: s.n, data: s.data, a: this.a, b: this.b });
    this.redoS = [];
    if (this.a !== null) {
      this.a = Math.round(this.a * k);
      this.b = Math.round(this.b * k);
    }
    this.cur = Math.round(this.cur * k);
    this.view.a = Math.round(this.view.a * k);
    this.view.spp *= k;
    Object.assign(s, packClip(y, r));
    this.x = y;
    this.app.touch('sounds', this.id);
    this.draw();
    this.drawSide();
  }

  // ------------------------------------------------------------ playing it
  out() {
    const ctx = this.ctx();
    if (!ctx) return null;
    if (!this.outGain || this.outGain.context !== ctx) {
      this.outGain = ctx.createGain();
      this.outGain.connect(ctx.destination);
    }
    this.outGain.gain.value = this.vol;
    return ctx;
  }

  playSamples(x, rate, from = 0, o = {}) {
    this.stopPlay(true);
    const ctx = this.out();
    if (!ctx) {
      toast('Click anywhere once, so the browser lets sound play, then try again.');
      return;
    }
    if (!x.length) return;
    const buf = ctx.createBuffer(1, x.length, rate);
    buf.getChannelData(0).set(x);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = o.vol ?? 1;
    src.connect(g).connect(this.outGain);
    const t0 = ctx.currentTime + 0.02;
    src.start(t0);
    this.playing = { src, t0, from, rate, end: x.length, mark: !!o.mark };
    src.onended = () => {
      if (this.playing && this.playing.src === src) this.stopPlay();
    };
    this.app.o.music?.hush?.(true);
    this.drawPlay();
    if (o.mark) this.tick();
  }

  play() {
    if (this.playing) return this.stopPlay();
    const [a, b] = this.has() ? [this.a, this.b] : [this.cur >= this.x.length - 1 ? 0 : this.cur, this.x.length];
    this.playSamples(this.x.subarray(a, b), this.rate, a, { mark: true });
    return null;
  }

  stopPlay(quiet = false) {
    if (this.playing) {
      try {
        this.playing.src.stop();
      } catch {
        // (Over already.)
      }
      this.playing = null;
      this.app.o.music?.hush?.(false);
    }
    window.cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.playAt = null;
    if (!quiet && this.cv) {
      this.drawPlay();
      this.draw();
    }
  }

  tick() {
    const loop = () => {
      const P = this.playing;
      if (!P || !this.cv || !this.cv.isConnected) return;
      const ctx = this.ctx();
      this.playAt = P.from + Math.max(0, (ctx.currentTime - P.t0) * P.rate);
      this.draw();
      this.raf = window.requestAnimationFrame(loop);
    };
    this.raf = window.requestAnimationFrame(loop);
  }

  drawPlay() {
    if (!this.playBtn) return;
    clear(this.playBtn);
    this.playBtn.append(ic(this.playing ? 'stop' : 'play', 12), h('span', null, this.playing ? 'Stop' : 'Play'));
    this.playBtn.classList.toggle('on', !!this.playing);
  }

  // ------------------------------------------------------------ the screen
  build() {
    const app = this.app;
    clear(this.stage);
    clear(this.insp);
    this.playBtn = button('Play', { icon: 'play', small: true, kind: 'go', title: 'Play what\'s chosen (or from the cursor), or stop (Space)', onClick: () => this.play() });
    const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: this.vol, class: 'mu-vol', 'data-tip': 'How loud it plays here (not in the game)' });
    vol.addEventListener('input', () => {
      this.vol = +vol.value;
      if (this.outGain) this.outGain.gain.value = this.vol;
    });
    const bar = titleBar(app, 'sounds', this.id,
      this.playBtn,
      group(button(null, { icon: 'minus', small: true, title: 'Zoom out (Ctrl+wheel)', onClick: () => this.zoom(2) }), button(null, { icon: 'plus', small: true, title: 'Zoom in (Ctrl+wheel)', onClick: () => this.zoom(0.5) }), button('All', { small: true, title: 'See all of it', onClick: () => this.fit() })),
      h('span', { class: 'sep' }),
      h('span', { class: 'sn-time note' }),
      h('span', { class: 'spacer' }), ic('speaker', 11), vol,
      menuButton('Bring in', () => [
        { label: 'A sound file, as a new sound...', icon: 'import', onClick: () => this.importFile() },
        { label: 'A recording, as a new sound...', icon: 'mic', onClick: () => this.record() },
        { label: 'One of the game\'s, as a new sound', icon: 'speaker', onClick: () => this.fromGame() },
      ], { small: true, icon: 'import' }),
      button('Download', { icon: 'export', small: true, title: 'As a .wav file', onClick: () => this.downloadWav() }),
      menuButton('Use it', () => this.useMenu(), { small: true, kind: 'primary', icon: 'star' }));
    this.nameEl = bar.querySelector('.title input');
    this.timeEl = bar.querySelector('.sn-time');
    const btn = (label, icon, tip, fn) => button(label, { icon, small: true, title: tip, onClick: fn });
    const edits = h('div', { class: 'sn-edits' },
      group(btn('Cut', 'cut', 'Cut what\'s chosen (Ctrl+X)', () => this.cutSel()), btn('Copy', 'copy', 'Copy what\'s chosen (Ctrl+C)', () => this.copy()), btn('Paste', 'paste', 'Paste at the cursor, or over what\'s chosen (Ctrl+V)', () => this.paste())),
      group(btn('Take out', 'trash', 'Take out what\'s chosen (Delete)', () => this.deleteSel()), btn('Keep only it', 'crop', 'Keep only what\'s chosen', () => this.trimTo()), btn('Silence', 'minus', 'What\'s chosen made silent', () => this.silenceSel())),
      group(btn('Fade in', null, 'What\'s chosen (or all of it) fades in', () => this.apply((q) => fade(q, q.length, 0), 'Faded in.')), btn('Fade out', null, 'What\'s chosen (or all of it) fades out', () => this.apply((q) => fade(q, 0, q.length), 'Faded out.')), btn('Loudest', null, 'As loud as it can be without cracking', () => this.apply((q) => normalize(q), 'Made as loud as it can be.'))),
      group(btn('Volume', 'speaker', 'Louder or softer', () => this.setFx('gain')), btn('Speed', 'next', 'Faster or slower', () => this.setFx('speed'))),
      menuButton('Effects', () => ADDS.map((k) => ({ label: EFFECTS[k][0], onClick: () => this.setFx(k) })), { small: true, icon: 'sparkle' }),
      button('Mix in', { icon: 'plus', small: true, kind: 'primary', title: 'Mix another sound in from the cursor: yours, a file, the game\'s, a tone, a song', onClick: (e) => this.mixMenu(e) }));
    this.cv = h('canvas', { class: 'sn-wave', tabindex: 0 });
    this.wrap = h('div', { class: 'sn-wrap' }, this.cv);
    this.stage.append(bar, edits, this.wrap);
    this.bindWave();
    this.insp.append(h('div', { class: 'insp-head' }, ic('speaker'), this.s.name));
    this.side = h('div', { class: 'insp-body scroll' });
    this.insp.append(this.side);
    this.drawPlay();
    this.drawSide();
    requestAnimationFrame(() => {
      if (this.fitNext) {
        this.fitNext = false;
        this.fit();
      } else this.draw();
    });
    app.hint(this.hintText());
  }

  useMenu() {
    const app = this.app;
    const fxs = Object.values(app.mod.vfx || {});
    const bs = Object.values(app.mod.biomes || {});
    return [
      { label: 'An instrument in a new song', icon: 'note', onClick: async () => {
        const id = await app.create('songs', { name: `${this.s.name} song`.slice(0, 40) }, { open: false });
        const S = app.mod.songs[id];
        S.chans.push({ id: freeChanId(S), name: this.s.name.slice(0, 24), kind: 'sound', inst: `@${this.id}`, vol: 0.9, pan: 0, verb: 0.25, echo: 0, mute: false, solo: false, ring: true, pats: [{ notes: [[0, 60, 4, 0.8], [8, 67, 4, 0.8]] }], seq: Array(S.bars).fill(1) });
        app.touch('songs', id);
        app.open('songs', id);
      } },
      { label: 'Heard when an effect plays', icon: 'sparkle', sub: fxs.length ? fxs.map((f) => ({ label: f.name, onClick: () => {
        app.checkpoint('vfx', f.id);
        f.sound = `@${this.id}`;
        app.touch('vfx', f.id);
        toast(`"${f.name}" plays "${this.s.name}" now.`, 'good');
      } })) : [{ label: 'No effects yet (the VFX tab)', off: true }] },
      { label: 'A biome\'s music (round and round)', icon: 'tree', sub: bs.length ? bs.map((b) => ({ label: b.title || b.name, onClick: () => {
        app.checkpoint('biomes', b.id);
        b.music = `@${this.id}`;
        app.touch('biomes', b.id);
        if (!this.s.loop) this.s.loop = true;
        toast(`"${this.s.name}" plays in ${b.title || b.name} now.`, 'good');
      } })) : [{ label: 'No biomes yet (the Biome tab)', off: true }] },
      { sep: true },
      { head: 'From a node: Sound, or Play music, has it in its list.' },
    ];
  }

  // ------------------------------------------------------------ the shape
  fit() {
    const w = Math.max(100, (this.wrap ? this.wrap.clientWidth : 800) - 2);
    this.view = { a: 0, spp: Math.max(1 / 16, this.x.length / w) };
    this.draw();
  }

  zoom(k, aroundPx = null) {
    const w = this.cv ? this.cv.width : 800;
    const px = aroundPx ?? w / 2;
    const at = this.view.a + px * this.view.spp;
    const spp = clamp(this.view.spp * k, 1 / 16, Math.max(1, this.x.length / Math.max(50, w)) * 1.0001);
    this.view = { a: at - px * spp, spp };
    this.clampView();
    this.draw();
  }

  clampView() {
    const w = this.cv ? this.cv.width : 800;
    const span = w * this.view.spp;
    this.view.a = clamp(this.view.a, 0, Math.max(0, this.x.length - span));
  }

  draw() {
    const cv = this.cv;
    if (!cv || !this.wrap || !cv.isConnected) return;
    const W = Math.max(100, this.wrap.clientWidth - 2);
    const H = Math.max(120, this.wrap.clientHeight - 2);
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    this.clampView();
    const x = cv.getContext('2d');
    const r = this.rate;
    const v = this.view;
    const mid = RULER + (H - RULER - STRIP) / 2;
    const amp = (H - RULER - STRIP) / 2 - 4;
    x.fillStyle = '#0b102e';
    x.fillRect(0, 0, W, H);
    // What's chosen.
    const sx = (smp) => (smp - v.a) / v.spp;
    if (this.has()) {
      x.fillStyle = 'rgba(43, 69, 171, 0.55)';
      x.fillRect(sx(this.a), RULER, Math.max(1, (this.b - this.a) / v.spp), H - RULER - STRIP);
    }
    // The seconds.
    x.fillStyle = '#151d42';
    x.fillRect(0, 0, W, RULER);
    const secsSpan = (W * v.spp) / r;
    const steps = [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const tick = steps.find((q) => secsSpan / q <= W / 70) || 60;
    x.font = '10px monospace';
    x.textBaseline = 'middle';
    x.textAlign = 'left';
    for (let t = Math.floor(v.a / r / tick) * tick; t <= (v.a + W * v.spp) / r; t += tick) {
      const px = Math.round(sx(t * r));
      x.fillStyle = '#34448a';
      x.fillRect(px, RULER - 6, 1, 6);
      x.fillStyle = '#a4addb';
      x.fillText(tick < 1 ? `${t.toFixed(tick < 0.01 ? 3 : 2)}s` : fmt(t).replace(/\.00$/, ''), px + 3, RULER / 2);
    }
    // The middle line, and the shape.
    x.fillStyle = '#232c5c';
    x.fillRect(0, Math.round(mid), W, 1);
    const d = this.x;
    x.fillStyle = '#80d8ff';
    if (v.spp >= 1) {
      const pk = peaks(d, v.a, v.a + W * v.spp, W);
      for (let i = 0; i < W; i++) {
        const lo = pk[i * 2];
        const hi = pk[i * 2 + 1];
        if (lo === 0 && hi === 0) continue;
        const y0 = Math.round(mid - hi * amp);
        const y1 = Math.round(mid - lo * amp);
        x.fillRect(i, y0, 1, Math.max(1, y1 - y0));
      }
    } else {
      x.strokeStyle = '#80d8ff';
      x.beginPath();
      for (let i = Math.floor(v.a); i <= Math.ceil(v.a + W * v.spp) && i < d.length; i++) {
        const px = sx(i);
        const py = mid - d[i] * amp;
        if (i === Math.floor(v.a)) x.moveTo(px, py);
        else x.lineTo(px, py);
        if (v.spp < 0.25) x.fillRect(px - 1, py - 1, 3, 3);
      }
      x.stroke();
    }
    // Over the top: louder than it can be.
    x.fillStyle = 'rgba(255, 90, 114, 0.25)';
    x.fillRect(0, RULER, W, 2);
    x.fillRect(0, RULER + (H - RULER - STRIP) - 2, W, 2);
    // The cursor, and where it's playing.
    x.fillStyle = '#ffd84a';
    x.fillRect(Math.round(sx(this.cur)), RULER, 1, H - RULER - STRIP);
    if (this.playAt !== null && this.playAt !== undefined) {
      x.fillStyle = '#ffffff';
      x.fillRect(Math.round(sx(this.playAt)), 0, 2, H - STRIP);
    }
    // All of it, small, and the part shown.
    const sy = H - STRIP;
    x.fillStyle = '#151d42';
    x.fillRect(0, sy, W, STRIP);
    if (d.length) {
      const pk = peaks(d, 0, d.length, W);
      x.fillStyle = '#4a6a9a';
      for (let i = 0; i < W; i++) {
        const lo = pk[i * 2];
        const hi = pk[i * 2 + 1];
        const y0 = Math.round(sy + STRIP / 2 - hi * (STRIP / 2 - 2));
        const y1 = Math.round(sy + STRIP / 2 - lo * (STRIP / 2 - 2));
        x.fillRect(i, y0, 1, Math.max(1, y1 - y0));
      }
      const k = W / d.length;
      x.strokeStyle = '#ffd84a';
      x.strokeRect(Math.round(v.a * k) + 0.5, sy + 0.5, Math.max(3, W * v.spp * k) - 1, STRIP - 1);
    }
    this.drawTime();
  }

  drawTime() {
    if (!this.timeEl) return;
    const r = this.rate;
    const all = fmt(this.x.length / r);
    this.timeEl.textContent = this.has() ? `${fmt(this.a / r)} – ${fmt(this.b / r)} (${((this.b - this.a) / r).toFixed(2)}s) of ${all}` : `${fmt(this.cur / r)} of ${all}`;
  }

  bindWave() {
    const cv = this.cv;
    const smp = (e) => {
      const r = cv.getBoundingClientRect();
      return clamp(Math.round(this.view.a + (e.clientX - r.left) * this.view.spp), 0, this.x.length);
    };
    let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      if (e.button === 2) return;
      cv.focus();
      const r = cv.getBoundingClientRect();
      const py = e.clientY - r.top;
      cv.setPointerCapture(e.pointerId);
      // (The strip: where to look.)
      if (py > cv.height - STRIP) {
        drag = { mode: 'strip' };
        this.view.a = ((e.clientX - r.left) / cv.width) * this.x.length - (cv.width * this.view.spp) / 2;
        this.draw();
        return;
      }
      const p = smp(e);
      const edge = (q) => this.has() && Math.abs((q - this.view.a) / this.view.spp - (e.clientX - r.left)) < 5;
      if (edge(this.a)) drag = { mode: 'sel', anchor: this.b };
      else if (edge(this.b)) drag = { mode: 'sel', anchor: this.a };
      else if (e.shiftKey && this.has()) drag = { mode: 'sel', anchor: Math.abs(p - this.a) < Math.abs(p - this.b) ? this.b : this.a };
      else if (e.shiftKey) drag = { mode: 'sel', anchor: this.cur };
      else drag = { mode: 'sel', anchor: p, fresh: true, x0: e.clientX };
      if (drag.fresh) {
        this.cur = p;
        this.a = this.b = null;
      }
      this.selTo(drag.anchor, p);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) {
        const r = cv.getBoundingClientRect();
        const near = (q) => this.has() && Math.abs((q - this.view.a) / this.view.spp - (e.clientX - r.left)) < 5;
        cv.style.cursor = e.clientY - r.top > cv.height - STRIP ? 'pointer' : near(this.a) || near(this.b) ? 'ew-resize' : 'text';
        return;
      }
      if (drag.mode === 'strip') {
        const r = cv.getBoundingClientRect();
        this.view.a = ((e.clientX - r.left) / cv.width) * this.x.length - (cv.width * this.view.spp) / 2;
        this.draw();
        return;
      }
      if (drag.fresh && Math.abs(e.clientX - drag.x0) < 3) return;
      this.selTo(drag.anchor, smp(e));
    });
    cv.addEventListener('pointerup', () => {
      if (drag && drag.mode === 'sel' && this.has() && this.b - this.a < 2) this.a = this.b = null;
      drag = null;
      this.draw();
      this.drawSel();
    });
    cv.addEventListener('dblclick', () => {
      this.a = 0;
      this.b = this.x.length;
      this.draw();
      this.drawSel();
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) this.zoom(e.deltaY > 0 ? 1.25 : 0.8, e.clientX - r.left);
      else {
        this.view.a += (e.deltaY + e.deltaX) * this.view.spp;
        this.clampView();
        this.draw();
      }
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenu(e, [
        { label: 'Play', icon: 'play', key: 'Space', onClick: () => this.play() },
        { sep: true },
        { label: 'Cut', icon: 'cut', key: 'Ctrl+X', off: !this.has(), onClick: () => this.cutSel() },
        { label: 'Copy', icon: 'copy', key: 'Ctrl+C', off: !this.has(), onClick: () => this.copy() },
        { label: 'Paste', icon: 'paste', key: 'Ctrl+V', off: !this.clip, onClick: () => this.paste() },
        { label: 'Take out', icon: 'trash', key: 'Delete', off: !this.has(), onClick: () => this.deleteSel() },
        { label: 'Keep only it', icon: 'crop', off: !this.has(), onClick: () => this.trimTo() },
        { sep: true },
        { label: 'Choose all of it', key: 'Ctrl+A', onClick: () => this.selectAll() },
      ]);
    });
  }

  selTo(p, q) {
    this.a = Math.min(p, q);
    this.b = Math.max(p, q);
    if (this.b - this.a < 1) this.a = this.b = null;
    this.draw();
  }

  selectAll() {
    this.a = 0;
    this.b = this.x.length;
    this.draw();
    this.drawSel();
  }

  onKey(e) {
    if (!this.s) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') {
      this.play();
      return true;
    }
    if (ctrl && e.code === 'KeyA') {
      this.selectAll();
      return true;
    }
    if (ctrl && e.code === 'KeyC') return this.copy() || true;
    if (ctrl && e.code === 'KeyX') {
      this.cutSel();
      return true;
    }
    if (ctrl && e.code === 'KeyV') {
      this.paste();
      return true;
    }
    if (!ctrl && (e.code === 'Delete' || e.code === 'Backspace')) {
      this.deleteSel();
      return true;
    }
    if (e.code === 'Escape' && this.has()) {
      this.a = this.b = null;
      this.draw();
      this.drawSel();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ the panel
  drawSide() {
    const s = this.s;
    const side = this.side;
    if (!side || !s) return;
    clear(side);
    const set = (fn) => {
      this.app.checkpoint('sounds', this.id);
      fn(s);
      this.app.touch('sounds', this.id);
    };
    const info = h('div', { class: 'note' }, `${clipSecs(s).toFixed(2)} seconds · ${Math.max(1, Math.round(clipBytes(s) / 1024))} KB in the mod`);
    const body = h('div', null, info,
      field('Kept at', select(SOUND_RATES.map((r) => [String(r), RATE_NAMES[r]]), String(s.rate), (v) => this.setRate(+v)), { tip: 'Clearer is bigger. Lower it to make the mod smaller.' }),
      field('In the game, as loud as', slider({ value: Math.round((s.vol ?? 1) * 100), min: 0, max: 200, int: true, onChange: (v) => set((q) => (q.vol = v / 100)) }), { tip: 'How loud the game plays it (100: as it is).' }),
      field('Its note', select(Array.from({ length: 73 }, (_, i) => [String(24 + i), noteName(24 + i)]), String(s.root || 60), (v) => set((q) => (q.root = +v))), { tip: 'As an instrument in a song: the note it is as it was made (written there, it plays as it is).' }),
      check('Round and round (as music)', !!s.loop, (v) => set((q) => (q.loop = v)), { tip: 'Played as music (a biome\'s, or from Play music), it starts again as it ends.' }),
      h('div', { class: 'row', style: { marginTop: '6px', gap: '4px' } }, button('Hear it as the game will', { icon: 'play', small: true, onClick: () => this.playSamples(this.x, s.rate, 0, { vol: s.vol ?? 1 }) })));
    this.selBody = h('div');
    this.fxBody = h('div');
    side.append(panel('Sound', body, { key: 'sn-sound' }), panel('Chosen', this.selBody, { key: 'sn-sel' }), panel('Effect', this.fxBody, { key: 'sn-fx' }));
    this.drawSel();
    this.drawFx();
  }

  drawSel() {
    const el = this.selBody;
    this.drawTime();
    if (!el) return;
    clear(el);
    const r = this.rate;
    if (!this.has()) {
      el.append(h('div', { class: 'note' }, 'Nothing chosen: what\'s done is done to all of it. Drag across the sound to choose a stretch of it.'), button('Choose all of it', { small: true, onClick: () => this.selectAll() }));
      return;
    }
    const num = (label, v, fn) => field(label, slider({ value: +(v / r).toFixed(3), min: 0, max: +(this.x.length / r).toFixed(3), step: 0.001, onChange: (q) => {
      fn(Math.round(q * r));
      this.draw();
      this.drawTime();
    } }));
    el.append(num('From (seconds)', this.a, (q) => (this.a = Math.min(q, this.b - 1))), num('To', this.b, (q) => (this.b = Math.max(q, this.a + 1))),
      h('div', { class: 'note' }, `${((this.b - this.a) / r).toFixed(3)} seconds chosen.`),
      h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap', marginTop: '4px' } }, button('None', { small: true, onClick: () => {
        this.a = this.b = null;
        this.draw();
        this.drawSel();
      } }), button('Zoom to it', { small: true, onClick: () => {
        const w = this.cv.width;
        this.view = { a: this.a - (this.b - this.a) * 0.05, spp: Math.max(1 / 16, ((this.b - this.a) * 1.1) / w) };
        this.draw();
      } })));
  }

  // An effect to work on what's chosen (its settings, heard before it's
  // done).
  setFx(key) {
    const E = EFFECTS[key];
    if (!E) return;
    this.fx = { key, o: Object.fromEntries(E[1].map((a) => [a[0], a[5]])) };
    // (No settings: done at once.)
    if (!E[1].length) {
      this.apply((q) => E[2](q, this.rate, {}), `${E[0]}: done.`);
      this.fx = null;
      return;
    }
    this.drawFx();
    const p = this.fxBody && this.fxBody.closest('.panel');
    if (p) {
      p.classList.remove('closed');
      p.scrollIntoView({ block: 'nearest' });
    }
  }

  drawFx() {
    const el = this.fxBody;
    if (!el) return;
    clear(el);
    if (!this.fx) {
      el.append(h('div', { class: 'note' }, 'Pick one from Effects (or Volume, Speed above the sound): its settings show here, to hear before it\'s done.'));
      return;
    }
    const E = EFFECTS[this.fx.key];
    const o = this.fx.o;
    el.append(h('div', { class: 'note', style: { color: 'var(--gold)', marginBottom: '4px' } }, E[0]));
    for (const [k, label, min, max, step] of E[1]) el.append(field(label, slider({ value: o[k], min, max, step, onChange: (v) => (o[k] = v) })));
    const target = this.has() ? 'what\'s chosen' : 'all of it';
    el.append(h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap', marginTop: '6px' } },
      button('Hear it', { icon: 'play', small: true, onClick: () => {
        const [a, b] = this.span();
        // (A long stretch: its first few seconds.)
        const piece = this.x.subarray(a, Math.min(b, a + this.rate * 8));
        this.playSamples(E[2](piece.slice(), this.rate, o), this.rate);
      } }),
      button(`Do it to ${target}`, { icon: 'check', small: true, kind: 'primary', onClick: () => this.apply((q) => E[2](q, this.rate, o), `${E[0]}: done.`) }),
      button(null, { icon: 'close', small: true, kind: 'ghost', title: 'Put it away', onClick: () => {
        this.fx = null;
        this.drawFx();
      } })));
  }

  downloadWav() {
    const s = this.s;
    const name = (s.name || 'sound').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'sound';
    download(`${name}.wav`, new window.Blob([encodeWav(this.x, s.rate)], { type: 'audio/wav' }));
  }
}
