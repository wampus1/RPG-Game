// Playing an instrument (round 51): held in your hand, the right button
// (or F) brings up its keys (see ui/instrument.js), and each key plays a
// note on it. Every instrument has its own keys and its own notes:
//   - a lute, plucked: the home row, a C major scale;
//   - a flute: the top row, D dorian, high and breathy;
//   - a lyre: the number keys, a pentatonic scale that can't go wrong;
//   - a fiddle: the bottom row, G minor, bowed;
//   - a hand drum: five strokes on F to K (a low boom, a tone, a slap, the
//     rim, a shake);
//   - a hunting horn: 1 to 5, the horn's own five natural notes.
// The notes are played by the same instruments the music is (see synth.js),
// through the game's sound (its volume).
import { Rack, midiHz } from './synth.js';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const noteName = (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

const row = (s) => [...s].map((ch) => ({ ';': 'Semicolon', ',': 'Comma', '.': 'Period', '/': 'Slash' }[ch] || (/\d/.test(ch) ? `Digit${ch}` : `Key${ch}`)));

export const INSTRUMENTS = {
  lute: { name: 'Lute', patch: 'pluck', cut: 1900, dur: 0.8, keys: row('ASDFGHJKL;'), labels: [...'ASDFGHJKL;'], notes: [48, 50, 52, 53, 55, 57, 59, 60, 62, 64] },
  flute: { name: 'Flute', patch: 'flute', dur: 0.55, keys: row('QWERTYUIOP'), labels: [...'QWERTYUIOP'], notes: [62, 64, 65, 67, 69, 71, 72, 74, 76, 77] },
  lyre: { name: 'Lyre', patch: 'harp', dur: 1.2, keys: row('12345678'), labels: [...'12345678'], notes: [60, 62, 64, 67, 69, 72, 74, 76] },
  fiddle: { name: 'Fiddle', patch: 'fiddle', dur: 0.6, keys: row('ZXCVBNM,./'), labels: [...'ZXCVBNM,./'], notes: [55, 57, 58, 60, 62, 63, 65, 67, 69, 70] },
  hand_drum: { name: 'Hand Drum', drums: ['tom', 'conga', 'bongo', 'rim', 'shaker'], strokes: ['Boom', 'Tone', 'Slap', 'Rim', 'Shake'], keys: row('FGHJK'), labels: [...'FGHJK'] },
  hunting_horn: { name: 'Hunting Horn', patch: 'horn', dur: 0.9, keys: row('12345'), labels: [...'12345'], notes: [48, 55, 60, 64, 67] },
};

// What a key of an instrument plays: its label under the key.
export function keyLabel(I, i) {
  return I.drums ? I.strokes[i] : noteName(I.notes[i]);
}

// The sound of them, made the first time a note's played (once the game
// has sound at all).
export class InstrumentVoice {
  constructor(music) {
    this.music = music;
    this.rack = null;
  }

  ready() {
    const m = this.music;
    if (!m || !m.ctx || m.ctx.state !== 'running' || !m.setup()) return false;
    if (!this.rack) {
      const out = (m.audio && m.audio.master) || m.ctx.destination;
      this.rack = new Rack(m, out, { space: 'room', wet: 0.22, echo: 0.05 });
      this.ch = this.rack.chan('instrument', { vol: 2.6, verb: 0.35 });
    }
    return true;
  }

  play(key, i, vel = 1) {
    const I = INSTRUMENTS[key];
    if (!I || i < 0 || i >= I.keys.length || !this.ready()) return false;
    const t = this.music.ctx.currentTime + 0.01;
    if (I.drums) this.rack.hit(I.drums[i], this.ch, t, vel);
    else this.rack.play(I.patch, this.ch, midiHz(I.notes[i]), t, I.dur, vel, { cut: I.cut });
    return true;
  }

  dispose() {
    if (this.rack) this.rack.dispose();
    this.rack = null;
  }
}
