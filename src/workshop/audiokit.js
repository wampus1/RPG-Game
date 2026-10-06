// The Workshop's bits for sound and music (round 66): a choice of music
// (the game's themes, the mod's songs and sounds) to hear before it's
// chosen, and a sound's shape drawn small.
import { h, ic, button } from './kit.js';
import { THEME_LIST } from '../mod/nodes.js';
import { peaks, clipSamples } from '../mod/sound.js';

// The music a value stands for, as a name.
export function musicLabel(app, v) {
  if (!v) return null;
  if (v[0] === '@') {
    const id = v.slice(1);
    const m = app.mod;
    if (m.songs && m.songs[id]) return `♫ ${m.songs[id].name}`;
    if (m.sounds && m.sounds[id]) return `♪ ${m.sounds[id].name}`;
    return '(deleted)';
  }
  const t = THEME_LIST.find(([k]) => k === v);
  return t ? t[1] : v;
}

// Heard in the Workshop (the game's theme, or the mod's song or sound), in
// place of its own music for a while; null stops it.
export function previewMusic(app, v, secs = 45) {
  const M = app.o.music;
  if (!M || !M.preview) return false;
  const A = app.o.audio;
  if (A && A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  if (!v) {
    M.preview(null);
    return true;
  }
  if (v[0] === '@') {
    const id = v.slice(1);
    const song = app.mod.songs && app.mod.songs[id];
    const sound = app.mod.sounds && app.mod.sounds[id];
    if (!song && !sound) return false;
    M.preview(song ? { song, mod: app.mod } : { sound, mod: app.mod }, secs);
    return true;
  }
  M.preview(v, secs);
  return true;
}

// A choice of music: the mod's songs and sounds, then the game's themes
// (`o.none`: a choice of none first, as ''), and a button to hear it.
export function musicPicker(app, value, onChange, o = {}) {
  const sel = h('select', { class: 'inp' });
  const add = (parent, v, label) => {
    const op = h('option', { value: v }, label);
    if (v === (value || '')) op.selected = true;
    parent.append(op);
  };
  if (o.none) add(sel, '', o.none);
  const songs = Object.values(app.mod.songs || {}).sort((a, b) => a.name.localeCompare(b.name));
  const sounds = Object.values(app.mod.sounds || {}).sort((a, b) => a.name.localeCompare(b.name));
  if (songs.length) {
    const g = h('optgroup', { label: 'Your songs' });
    for (const s of songs) add(g, `@${s.id}`, `♫ ${s.name}`);
    sel.append(g);
  }
  if (sounds.length) {
    const g = h('optgroup', { label: 'Your sounds (round and round)' });
    for (const s of sounds) add(g, `@${s.id}`, `♪ ${s.name}`);
    sel.append(g);
  }
  const g = h('optgroup', { label: 'The game\'s music' });
  for (const [k, name] of THEME_LIST) add(g, k, name);
  sel.append(g);
  if (value && ![...sel.options].some((op) => op.value === value)) add(sel, value, musicLabel(app, value) || value);
  let playing = false;
  const hear = button(null, { icon: 'play', small: true, kind: 'ghost', title: 'Hear it (click again to stop)' });
  const drawHear = () => {
    hear.innerHTML = '';
    hear.append(ic(playing ? 'stop' : 'play', 11));
  };
  hear.addEventListener('click', (e) => {
    e.stopPropagation();
    if (playing) {
      previewMusic(app, null);
      playing = false;
    } else playing = previewMusic(app, sel.value || o.fallback || null);
    drawHear();
  });
  sel.addEventListener('change', () => {
    onChange(sel.value || null);
    if (playing) previewMusic(app, sel.value || o.fallback || null);
  });
  sel.addEventListener('keydown', (e) => e.stopPropagation());
  return h('div', { class: 'sound-pick' }, sel, hear);
}

// A sound's shape, small (a canvas `w` by `ht`), in `color`.
export function waveThumb(s, w = 40, ht = 40, color = '#80d8ff') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = ht;
  const x = c.getContext('2d');
  const d = clipSamples(s);
  if (!d.length) return c;
  const pk = peaks(d, 0, d.length, w);
  x.fillStyle = color;
  for (let i = 0; i < w; i++) {
    const lo = pk[i * 2];
    const hi = pk[i * 2 + 1];
    const y0 = Math.round(ht / 2 - hi * (ht / 2 - 1));
    const y1 = Math.round(ht / 2 - lo * (ht / 2 - 1));
    x.fillRect(i, y0, 1, Math.max(1, y1 - y0));
  }
  return c;
}
