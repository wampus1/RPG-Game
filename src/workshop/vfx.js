// The VFX tool (round 62): effects, seen playing as the game will play
// them. Layers of art (moved by keyframes and by simulated motion: bob,
// sway, spin, pulse, flicker, rise, orbit, a springy pop, after-images),
// particles (bursts and streams with gravity, drag, wind and swirl, their
// colours and sizes over their life), spreading rings and soft glows, on a
// timeline; drag a layer about in the preview to place it, drag art in
// from the explorer to add it, and bake the whole into pixel art frames
// for the Pixel tool. The game plays effects with the same code
// (mod/vfx.js), so what's seen here is what's seen there.
import { h, ic, clear, button, group, field, numberInput, slider, check, seg, select, panel, toast, canvas, textInput, dropTarget, colorButton, menu, dialog } from './kit.js';
import { titleBar, menuButton, refPicker, quantize } from './common.js';
import { VfxPlayer, newLayer, EMITTER_PRESETS, LOOKS, SHAPES, EASES, TRACKS, trackAt } from '../mod/vfx.js';
import { SOUNDS } from '../mod/nodes.js';
import { composite, LIMITS, rgbaToHex, encodeCel } from '../mod/format.js';
import { blockArt } from './blockart.js';

const BGS = [['grass', 'Grass'], ['stone_bricks', 'Stone'], ['sand', 'Sand'], ['snow', 'Snow'], ['planks', 'Floor'], ['dark', 'Dark'], ['water', 'Water']];
const SPEEDS = [[0.25, '¼'], [0.5, '½'], [1, '1×'], [2, '2×']];
const TYPE_ICON = { sprite: 'pencil', emitter: 'sparkle', ring: 'target', glow: 'sun' };
const TRACK_NAME = { x: 'Across', y: 'Up/down', scale: 'Size', rot: 'Turn', alpha: 'Fade' };
const TRACK_DEF = { x: 0, y: 0, scale: 1, rot: 0, alpha: 1 };
const MOTIONS = {
  Still: {},
  Float: { bob: 2, bobHz: 0.8, sway: 4, swayHz: 0.6 },
  'Hover & glow': { bob: 1.5, bobHz: 1.2, pulse: 0.08, pulseHz: 1.2 },
  Spin: { spin: 360 },
  Flicker: { flicker: 0.5, pulse: 0.06, pulseHz: 7 },
  'Pop in': { pop: true, fadeOut: 0.3 },
  'Rise & fade': { rise: 18, fadeOut: 0.6 },
  Orbit: { orbit: 10, orbitHz: 0.7 },
  Shake: { shake: 1.5 },
  Trail: { orbit: 9, orbitHz: 1, ghosts: 4, ghostGap: 0.04 },
};

export default class VfxTool {
  constructor(app) {
    this.app = app;
    this.id = null;
    this.layerId = null;
    this.key = null;
    this.playing = true;
    this.speed = 1;
    this.zoom = 4;
    this.person = true;
    this.artCache = new Map();
    this.lastCk = 0;
  }

  get fx() {
    return this.id ? this.app.mod.vfx[this.id] : null;
  }

  get L() {
    const f = this.fx;
    return f ? (f.layers || []).find((l) => l.id === this.layerId) || null : null;
  }

  // ------------------------------------------------------------ mounting
  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    this.onResize = () => this.fitCanvas();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('ws-resize', this.onResize);
    if (this.id && this.fx) this.open('vfx', this.id);
  }

  unmount() {
    window.cancelAnimationFrame(this.raf);
    this.raf = null;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('ws-resize', this.onResize);
  }

  current() {
    return this.fx ? { kind: 'vfx', id: this.id } : null;
  }

  hintText() {
    if (!this.fx) return 'Pick an effect in the explorer, or make a new one.';
    return 'Drag the chosen layer about in the preview to place it. Drag art from the explorer in to add it. Enter plays; R starts it again.';
  }

  keyHelp() {
    return [['Enter', 'Play / pause'], ['R', 'Start it again'], [', .', 'Step back / on a little'], ['Delete', 'The chosen keyframe, or layer'], ['+ − 0', 'Zoom']];
  }

  onKey(e) {
    if (!this.fx || e.ctrlKey || e.metaKey) return false;
    if (e.key === 'Enter') {
      this.togglePlay();
      return true;
    }
    if (e.code === 'KeyR') {
      this.restart();
      return true;
    }
    if (e.key === ',' || e.key === '.') {
      this.playing = false;
      this.seekTo(Math.max(0, this.player.t + (e.key === ',' ? -1 / 30 : 1 / 30)));
      this.drawPlayBtn();
      return true;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.key) this.deleteKey();
      else if (this.L) this.removeLayer(this.L.id);
      return true;
    }
    const z = { '+': 1, '=': 1, '-': -1 }[e.key];
    if (z) {
      this.setZoom(this.zoom + z);
      return true;
    }
    if (e.key === '0') {
      this.setZoom(4);
      return true;
    }
    return false;
  }

  open(kind, id) {
    window.cancelAnimationFrame(this.raf);
    this.raf = null;
    if (!id || !this.app.mod.vfx[id]) {
      this.id = null;
      return this.empty();
    }
    if (this.id !== id) {
      this.layerId = null;
      this.key = null;
    }
    this.id = id;
    const f = this.fx;
    f.layers ||= [];
    // (Older effects: their layers made whole.)
    f.layers = f.layers.map((l) => (l.start === undefined ? newLayer(l.type || 'emitter', { ...l, ...(l.type === 'emitter' && l.preset && EMITTER_PRESETS[l.preset] ? { ...EMITTER_PRESETS[l.preset], ...l } : {}) }) : l));
    if (!f.layers.some((l) => l.id === this.layerId)) this.layerId = f.layers[0] ? f.layers[0].id : null;
    this.build();
  }

  reload() {
    if (this.fx) this.open('vfx', this.id);
  }

  removed(kind, id) {
    if (kind === 'vfx' && id === this.id) {
      this.id = null;
      this.empty();
    }
    if (kind === 'assets') this.artCache.delete(id);
  }

  renamed() {
    if (this.nameEl && this.fx) this.nameEl.value = this.fx.name;
  }

  empty() {
    clear(this.stage);
    clear(this.insp);
    const card = (icon, t, d, fn) => {
      const c = h('div', { class: 'card' }, h('div', { class: 't' }, ic(icon), t), h('div', { class: 'd' }, d));
      c.addEventListener('click', fn);
      return c;
    };
    const presets = h('div', { class: 'cards' });
    for (const [k, P] of Object.entries(EMITTER_PRESETS)) presets.append(card('sparkle', P.name, 'Particles, ready to change.', () => this.newEffect(P.name, [newLayer('emitter', { ...P, preset: k, name: P.name })])));
    this.stage.append(h('div', { class: 'home scroll', style: { overflow: 'auto' } },
      h('h1', null, 'VFX'),
      h('div', { class: 'sub' }, 'Effects: sparks and smoke, auras, spell bursts, shockwaves, glowing animated art. Play them from graphs (Play effect), on weapons\' hits, as a projectile\'s trail, on a trigger in a structure.'),
      h('div', { class: 'cards' },
        card('plus', 'A new effect', 'Start with a few sparks and build it up.', () => this.newEffect('Effect')),
        card('pencil', 'Animate some art', 'Drag art from the explorer onto the preview, or right-click it there and "Animate it in VFX".', () => toast('Right-click some art in the explorer, then "Animate it in VFX".'))),
      h('h2', null, 'Or start from'), presets));
    this.insp.append(h('div', { class: 'insp-head' }, ic('sparkle'), 'VFX'), h('div', { class: 'insp-body' }, h('div', { class: 'panel-b note' }, 'Nothing open.')));
  }

  newEffect(name, layers = null) {
    return this.app.create('vfx', { name, ...(layers ? { layers } : {}) });
  }

  // ------------------------------------------------------------ changing it
  // Remembered for Undo (once for a quick run of changes, as a slider's).
  ck() {
    const now = performance.now();
    if (now - this.lastCk > 700) this.app.checkpoint('vfx', this.id);
    this.lastCk = now;
  }

  set(fn, o = {}) {
    this.ck();
    fn(this.fx, this.L);
    this.app.touch('vfx', this.id);
    this.rebuildPlayer();
    if (o.layers) this.drawLayers();
    if (o.props) this.drawProps();
    if (o.timeline !== false) this.drawTimeline();
  }

  // ------------------------------------------------------------ art
  art(aid) {
    const a = this.app.mod.assets[aid];
    if (!a) return null;
    const ver = `${a.w}x${a.h}:${a.frames.length}:${a.frames.map((f) => Object.values(f.cels).join('')).join('|').length}:${a.palette.join('')}:${JSON.stringify(a.tags)}`;
    const c = this.artCache.get(aid);
    if (c && c.ver === ver) return c.art;
    const frames = a.frames.map((f, i) => {
      const cv = canvas(a.w, a.h);
      cv.getContext('2d').putImageData(new ImageData(composite(a, i), a.w, a.h), 0, 0);
      return cv;
    });
    const art = { frames, durs: a.frames.map((f) => f.dur || 100), tags: a.tags || [] };
    this.artCache.set(aid, { ver, art });
    return art;
  }

  rebuildPlayer() {
    const t = this.player ? this.player.t : 0;
    this.player = new VfxPlayer(this.fx, { art: (aid) => this.art(aid), loop: true, seed: 7 });
    this.player.seek(t);
  }

  // ------------------------------------------------------------ the screen
  build() {
    const app = this.app;
    const f = this.fx;
    clear(this.stage);
    clear(this.insp);
    this.playBtn = button(null, { icon: 'play', small: true, title: 'Play / pause (Enter)', onClick: () => this.togglePlay() });
    const bar = titleBar(app, 'vfx', this.id,
      group(this.playBtn, button(null, { icon: 'prev', small: true, title: 'From the start (R)', onClick: () => this.restart() })),
      seg(SPEEDS, this.speed, (v) => (this.speed = v)),
      h('span', { class: 'sep' }),
      select(BGS, f.bg || 'grass', (v) => this.set((x) => (x.bg = v), { timeline: false })),
      button(null, { icon: 'person', small: true, on: this.person, title: 'Someone standing there, for size', onClick: (e, b) => {
        this.person = !this.person;
        b.classList.toggle('on', this.person);
      } }),
      group(button(null, { icon: 'minus', small: true, title: 'Zoom out', onClick: () => this.setZoom(this.zoom - 1) }), button(null, { icon: 'plus', small: true, title: 'Zoom in', onClick: () => this.setZoom(this.zoom + 1) })),
      h('span', { class: 'spacer' }),
      menuButton('Export', () => [
        { label: 'Bake into pixel art (frames)...', icon: 'pencil', onClick: () => this.bakeDialog() },
        { label: 'A strip of frames (PNG)', icon: 'export', onClick: () => this.exportStrip() },
      ], { small: true, icon: 'export' }),
      menuButton('Use it', () => [
        { label: 'Make a projectile with it (as its trail)', icon: 'bolt', onClick: () => app.newEntity('tpl.projectile', { trail: this.id }, f.name) },
        { label: 'Make an effect (status) with it as its aura', icon: 'star', onClick: () => app.newEntity('tpl.effect', { vfx: this.id }, f.name) },
        { label: 'Play it from a trigger in a new structure', icon: 'house', onClick: () => app.builder(async (b) => {
          const id = await b.newDialog({ preset: 'shrine', open: false });
          if (!id) return;
          const st = app.mod.structures[id];
          const m = (st.marks || []).find((q) => q.type === 'trigger');
          if (m) m.vfx = this.id;
          app.touch('structures', id);
          app.open('structures', id);
        }) },
      ], { small: true, kind: 'primary', icon: 'star' }));
    this.nameEl = bar.querySelector('.title input');
    this.wrap = h('div', { class: 'canvas-wrap' });
    this.cv = h('canvas');
    this.hud = h('div', { class: 'hud' });
    this.wrap.append(this.cv, this.hud);
    this.bindCanvas();
    this.tl = h('div', { class: 'vfx-tl' });
    this.stage.append(bar, h('div', { style: { flex: 1, display: 'flex', minHeight: 0 } }, this.wrap), this.tl);
    dropTarget(this.wrap, (p) => p.kind === 'assets', (p) => this.addLayer('sprite', { asset: p.id, name: p.name }));
    // The inspector.
    this.insp.append(h('div', { class: 'insp-head' }, ic('sparkle'), f.name));
    const body = h('div', { class: 'insp-body scroll' });
    this.fxPanel = panel('Effect', h('div'), { key: 'vx-fx' });
    this.layersPanel = panel('Layers', h('div'), { key: 'vx-layers', tools: [button(null, { icon: 'plus', small: true, kind: 'ghost', title: 'Add a layer', onClick: (e) => this.addMenu(e) })] });
    this.propsPanel = panel('Layer', h('div'), { key: 'vx-layer' });
    this.motionPanel = panel('Motion', h('div'), { key: 'vx-motion' });
    body.append(this.layersPanel, this.propsPanel, this.motionPanel, this.fxPanel);
    this.insp.append(body);
    this.rebuildPlayer();
    this.drawFx();
    this.drawLayers();
    this.drawProps();
    this.drawTimeline();
    this.drawPlayBtn();
    this.app.hint(this.hintText());
    requestAnimationFrame(() => this.fitCanvas());
    let last = performance.now();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (this.playing && this.player) {
        this.player.step(dt * this.speed);
        this.movePlayhead();
      }
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  fitCanvas() {
    if (!this.cv || !this.wrap.isConnected) return;
    const r = this.wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cv.width = Math.max(1, Math.round(r.width * dpr));
    this.cv.height = Math.max(1, Math.round(r.height * dpr));
    this.cw = r.width;
    this.ch = r.height;
  }

  setZoom(z) {
    this.zoom = Math.max(1, Math.min(10, z));
  }

  togglePlay() {
    this.playing = !this.playing;
    this.drawPlayBtn();
  }

  drawPlayBtn() {
    if (!this.playBtn) return;
    this.playBtn.innerHTML = '';
    this.playBtn.append(ic(this.playing ? 'pause' : 'play', 11));
  }

  restart() {
    this.player.reset();
    this.playing = true;
    this.drawPlayBtn();
  }

  seekTo(t) {
    this.player.seek(Math.max(0, t));
    this.movePlayhead();
  }

  // The anchor (the feet of whatever it's on) on the canvas, in its own
  // pixels at 1:1.
  anchor() {
    const W = this.cw / this.zoom;
    const H = this.ch / this.zoom;
    return { x: Math.round(W / 2), y: Math.round(H * 0.62) };
  }

  draw() {
    if (!this.cv || !this.player) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.cv.getContext('2d');
    const z = this.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#08060b';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const W = Math.ceil(this.cw / z);
    const H = Math.ceil(this.ch / z);
    const A = this.anchor();
    // The ground: the game's own tiles, the anchor's row lit.
    const bg = this.fx.bg || 'grass';
    if (bg === 'dark') {
      ctx.fillStyle = '#100c16';
      ctx.fillRect(0, 0, W, H);
    } else {
      const art = blockArt(this.app, bg);
      const ox = ((A.x - 8) % 16) - 16;
      const oy = ((A.y - 22) % 16) - 16;
      if (art && art.top) for (let y = oy; y < H; y += 16) for (let x = ox; x < W; x += 16) ctx.drawImage(art.top, x, y);
      ctx.fillStyle = 'rgba(8,6,12,0.58)';
      ctx.fillRect(0, 0, W, H);
    }
    // Someone standing there, for size.
    if (this.person) drawPerson(ctx, A.x, A.y);
    // The effect.
    this.player.draw(ctx, A.x, A.y);
    // Where the chosen layer is (and its reach).
    const L = this.L;
    if (L) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(240,192,64,0.8)';
      ctx.lineWidth = 1 / z;
      const x = A.x + (L.x || 0);
      const y = A.y + (L.y || 0);
      ctx.setLineDash([2 / z, 2 / z]);
      ctx.beginPath();
      if (L.type === 'emitter') {
        if (L.shape === 'circle' || L.shape === 'ring') ctx.ellipse(x, y, L.r || 6, (L.r || 6) * 0.6, 0, 0, Math.PI * 2);
        else if (L.shape === 'line') {
          ctx.moveTo(x - (L.w || 16) / 2, y);
          ctx.lineTo(x + (L.w || 16) / 2, y);
        } else if (L.shape === 'box') ctx.rect(x - (L.w || 16) / 2, y - (L.h || 8) / 2, L.w || 16, L.h || 8);
        // (Which way they fly.)
        const d = ((L.dir ?? -90) * Math.PI) / 180;
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(d) * 12, y + Math.sin(d) * 12);
      } else if (L.type === 'ring') ctx.ellipse(x, y, L.to || 24, (L.to || 24) * (L.squash ?? 0.55), 0, 0, Math.PI * 2);
      else if (L.type === 'glow') ctx.arc(x, y, L.r || 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f0c040';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // The anchor.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(A.x - 3, A.y, 7, 1 / z);
    ctx.fillRect(A.x, A.y - 3, 1 / z, 7);
    this.hud.textContent = `${this.player.t.toFixed(2)}s / ${(+this.fx.dur || 1).toFixed(2)}s${this.fx.loop ? ' · loops' : ''}`;
  }

  bindCanvas() {
    const cv = this.cv;
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setZoom(this.zoom + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      const L = this.L;
      if (!L) return;
      cv.setPointerCapture(e.pointerId);
      this.ck();
      this.dragging = { x: e.clientX, y: e.clientY, lx: L.x || 0, ly: L.y || 0 };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.dragging || !this.L) return;
      const D = this.dragging;
      const L = this.L;
      L.x = Math.round(D.lx + (e.clientX - D.x) / this.zoom);
      L.y = Math.round(D.ly + (e.clientY - D.y) / this.zoom);
      this.hud.textContent = `${L.name}: ${L.x}, ${L.y}`;
    });
    const up = () => {
      if (!this.dragging) return;
      this.dragging = null;
      this.app.touch('vfx', this.id);
      this.drawProps();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }

  // ------------------------------------------------------------ layers
  addMenu(e) {
    const r = e.currentTarget.getBoundingClientRect();
    menu([
      { label: 'Art', icon: 'pencil', tip: 'A piece of your art, animated and moved', onClick: () => this.addLayer('sprite') },
      { label: 'Particles', icon: 'sparkle', sub: Object.entries(EMITTER_PRESETS).map(([k, P]) => ({ label: P.name, onClick: () => this.addLayer('emitter', { ...P, preset: k, name: P.name }) })) },
      { label: 'Ring (a shockwave)', icon: 'target', onClick: () => this.addLayer('ring') },
      { label: 'Glow', icon: 'sun', onClick: () => this.addLayer('glow') },
    ], r.left, r.bottom + 4);
  }

  addLayer(type, o = {}) {
    const L = newLayer(type, o);
    if (type === 'sprite' && !o.asset) {
      const first = Object.keys(this.app.mod.assets)[0];
      if (first) L.asset = first;
    }
    this.set((f) => f.layers.push(L));
    this.layerId = L.id;
    this.key = null;
    this.drawLayers();
    this.drawProps();
  }

  removeLayer(id) {
    this.set((f) => (f.layers = f.layers.filter((l) => l.id !== id)));
    if (this.layerId === id) this.layerId = this.fx.layers[0] ? this.fx.layers[0].id : null;
    this.key = null;
    this.drawLayers();
    this.drawProps();
  }

  pick(id) {
    this.layerId = id;
    this.key = null;
    this.drawLayers();
    this.drawProps();
    this.drawTimeline();
  }

  drawLayers() {
    const body = this.layersPanel.body;
    clear(body);
    const f = this.fx;
    const list = h('div', { class: 'list' });
    // (Drawn bottom to top: the last is in front, listed first.)
    [...f.layers].reverse().forEach((L) => {
      const i = f.layers.indexOf(L);
      const eye = button(null, { icon: L.hidden ? 'eyeOff' : 'eye', small: true, kind: 'ghost', title: 'Show / hide', onClick: (e) => {
        e.stopPropagation();
        this.set((x) => (x.layers[i].hidden = !x.layers[i].hidden), { layers: true });
      } });
      const li = h('div', { class: `li${L.id === this.layerId ? ' on' : ''}` }, eye, ic(TYPE_ICON[L.type]), h('span', { style: { flex: 1, opacity: L.hidden ? 0.5 : 1 } }, L.name),
        button(null, { icon: 'up', small: true, kind: 'ghost', title: 'Forward', disabled: i === f.layers.length - 1, onClick: (e) => {
          e.stopPropagation();
          this.set((x) => x.layers.splice(i + 1, 0, x.layers.splice(i, 1)[0]), { layers: true });
        } }),
        button(null, { icon: 'down', small: true, kind: 'ghost', title: 'Back', disabled: i === 0, onClick: (e) => {
          e.stopPropagation();
          this.set((x) => x.layers.splice(i - 1, 0, x.layers.splice(i, 1)[0]), { layers: true });
        } }),
        button(null, { icon: 'copy', small: true, kind: 'ghost', title: 'Duplicate', onClick: (e) => {
          e.stopPropagation();
          const c = JSON.parse(JSON.stringify(L));
          c.id = `l${Math.random().toString(36).slice(2, 7)}`;
          c.name = `${L.name} 2`;
          this.set((x) => x.layers.splice(i + 1, 0, c), { layers: true });
        } }),
        button(null, { icon: 'trash', small: true, kind: 'ghost', title: 'Delete', onClick: (e) => {
          e.stopPropagation();
          this.removeLayer(L.id);
        } }));
      li.addEventListener('click', () => this.pick(L.id));
      list.append(li);
    });
    if (!f.layers.length) list.append(h('div', { class: 'note' }, 'No layers: add some with +.'));
    body.append(list);
  }

  drawFx() {
    const body = this.fxPanel.body;
    clear(body);
    const f = this.fx;
    body.append(field('Lasts', slider({ value: f.dur ?? 1.2, min: 0.1, max: 10, step: 0.05, onChange: (v) => this.set((x) => (x.dur = v)) }), { tip: 'Seconds (each time round, if it loops).' }));
    body.append(check('Loops (an aura, a lasting fire)', !!f.loop, (v) => this.set((x) => (x.loop = v))));
    body.append(field('Shakes the screen', slider({ value: f.shake || 0, min: 0, max: 10, int: true, onChange: (v) => this.set((x) => (x.shake = v), { timeline: false }) })));
    body.append(field('Flash', h('div', { class: 'row', style: { gap: '6px' } }, check('', !!f.flash, (v) => this.set((x) => (x.flash = v ? '#ffffff' : null), { timeline: false })), colorButton(f.flash || '#ffffff', (v) => this.set((x) => (x.flash = v), { timeline: false })))));
    body.append(field('Sound', select([['', '(none)'], ...SOUNDS.map((s) => [s, s])], f.sound || '', (v) => this.set((x) => (x.sound = v || null), { timeline: false }))));
  }

  // ------------------------------------------------------------ a layer's settings
  drawProps() {
    const body = this.propsPanel.body;
    const mb = this.motionPanel.body;
    clear(body);
    clear(mb);
    const L = this.L;
    this.motionPanel.style.display = L && L.type === 'sprite' ? '' : 'none';
    if (!L) {
      body.append(h('div', { class: 'note' }, 'Choose a layer.'));
      return;
    }
    const app = this.app;
    const set = (k, v, again = false) => this.set((f, l) => (l[k] = v), { props: again, layers: k === 'name' });
    const num = (k, label, min, max, step = 1, tip = null) => field(label, slider({ value: L[k] ?? 0, min, max, step, int: step === 1, onChange: (v) => set(k, v) }), { tip });
    const pair = (k, label, min, max, step = 1, tip = null) => {
      const v = Array.isArray(L[k]) ? L[k] : [L[k] ?? 0, L[k] ?? 0];
      return field(label, h('div', { class: 'row', style: { gap: '4px', alignItems: 'center' } },
        numberInput({ value: v[0], min, max, step, onChange: (q) => set(k, [q, v[1]]) }), h('span', { class: 'note' }, '→'),
        numberInput({ value: v[1], min, max, step, onChange: (q) => set(k, [v[0], q]) })), { tip });
    };
    body.append(field('Name', textInput({ value: L.name, onChange: (v) => set('name', v.slice(0, 32) || L.name) })));
    const endAll = L.end === null || L.end === undefined;
    body.append(field('From (s)', numberInput({ value: L.start || 0, min: 0, max: 30, step: 0.05, onChange: (v) => set('start', v) })));
    body.append(field('Till (s)', endAll ? button('the end', { small: true, title: 'Click to set a time', onClick: () => set('end', +(this.fx.dur || 1).toFixed(2), true) }) : h('div', { class: 'row', style: { gap: '4px' } }, numberInput({ value: L.end, min: 0, max: 30, step: 0.05, onChange: (v) => set('end', v) }), button(null, { small: true, icon: 'close', title: 'Till the end', onClick: () => set('end', null, true) }))));
    body.append(field('Across', numberInput({ value: L.x || 0, min: -200, max: 200, onChange: (v) => set('x', v) }), { tip: 'Or drag it about in the preview.' }));
    body.append(field('Up/down', numberInput({ value: L.y || 0, min: -200, max: 200, onChange: (v) => set('y', v) }), { tip: 'Less than 0 is up. Or drag it about in the preview.' }));
    body.append(field('Blend', seg([['normal', 'Normal'], ['add', 'Glowing']], L.blend || 'normal', (v) => set('blend', v)), { tip: 'Glowing adds its light to what\'s behind it.' }));
    body.append(h('div', { class: 'hr' }));
    if (L.type === 'sprite') {
      body.append(field('Art', refPicker(app, 'asset', L.asset, (v) => set('asset', v, true), { create: () => app.newAsset({ use: 'fx' }) })));
      const a = app.mod.assets[L.asset];
      if (a && a.tags && a.tags.length) body.append(field('Animation', select([['', 'All its frames'], ...a.tags.map((t) => [t.name, t.name])], L.tag || '', (v) => set('tag', v || null))));
      body.append(field('Frames a second', slider({ value: L.fps || 0, min: 0, max: 30, int: true, onChange: (v) => set('fps', v) }), { tip: '0: as the art has them timed.' }));
      body.append(field('Plays', seg([['loop', 'Round'], ['once', 'Once'], ['pingpong', 'To and fro']], L.play || 'loop', (v) => set('play', v))));
      body.append(num('scale', 'Size', 0.1, 6, 0.05), num('rot', 'Turned', -180, 180, 1), num('alpha', 'Opacity', 0, 1, 0.05));
      body.append(check('Mirrored', !!L.flip, (v) => set('flip', v)));
      body.append(field('Tint', h('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, colorButton(L.tint || '#ffffff', (v) => set('tint', v)), slider({ value: L.tintAmt || 0, min: 0, max: 1, step: 0.05, onChange: (v) => set('tintAmt', v) }))));
      body.append(field('Glow', h('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, check('', !!L.glow, (v) => set('glow', v ? '#ffd070' : null, true)), L.glow ? colorButton(L.glow, (v) => set('glow', v)) : null, L.glow ? slider({ value: L.glowR || 10, min: 2, max: 60, int: true, onChange: (v) => set('glowR', v) }) : null)));
      this.drawMotion();
    } else if (L.type === 'emitter') {
      const pres = h('div', { class: 'chips', style: { marginBottom: '8px' } });
      for (const [k, P] of Object.entries(EMITTER_PRESETS)) {
        const c = h('span', { class: `chip${L.preset === k ? ' on' : ''}` }, P.name);
        c.addEventListener('click', () => this.set((f, l) => {
          const keep = { id: l.id, name: l.name, start: l.start, end: l.end, x: l.x, hidden: l.hidden };
          Object.assign(l, newLayer('emitter'), P, keep, { preset: k, y: P.y ?? l.y });
        }, { props: true }));
        pres.append(c);
      }
      body.append(h('div', { class: 'note' }, 'Start from:'), pres);
      body.append(field('From a', seg(SHAPES.map((s) => [s, s[0].toUpperCase() + s.slice(1)]), L.shape || 'point', (v) => set('shape', v, true))));
      if (L.shape === 'circle' || L.shape === 'ring') body.append(num('r', 'Radius', 0, 80));
      if (L.shape === 'line' || L.shape === 'box') body.append(num('w', 'Width', 0, 200));
      if (L.shape === 'box') body.append(num('h', 'Height', 0, 200));
      body.append(num('burst', 'At once', 0, 200, 1, 'How many burst out as it starts (each time round).'), num('rate', 'A second', 0, 300, 1, 'How many more stream out each second.'), num('max', 'At most', 10, 600, 10));
      body.append(pair('life', 'Life (s)', 0.02, 10, 0.05), pair('speed', 'Speed', 0, 400, 1));
      body.append(num('dir', 'Direction', -180, 180, 5, '-90 is straight up; 90 straight down.'), num('spread', 'Spread', 0, 360, 5));
      body.append(num('gravity', 'Gravity', -400, 400, 5, 'Less than 0: they rise.'), num('drag', 'Drag', 0, 8, 0.1), num('wind', 'Wind', -100, 100, 1), num('swirl', 'Swirl', -720, 720, 10, 'Round about where they came from.'), num('pull', 'Pull in', -100, 100, 1));
      body.append(pair('size', 'Size', 0, 40, 0.5, 'At birth → at death.'), pair('alpha', 'Opacity', 0, 1, 0.05));
      // Colours over their life.
      const cols = h('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap', alignItems: 'center' } });
      (L.colors || ['#ffffff']).forEach((c, i) => {
        cols.append(colorButton(c, (v) => this.set((f, l) => (l.colors[i] = v))));
      });
      if ((L.colors || []).length < 4) cols.append(button(null, { icon: 'plus', small: true, title: 'Another colour', onClick: () => this.set((f, l) => (l.colors = [...(l.colors || []), l.colors[l.colors.length - 1] || '#ffffff']), { props: true }) }));
      if ((L.colors || []).length > 1) cols.append(button(null, { icon: 'minus', small: true, title: 'One colour fewer', onClick: () => this.set((f, l) => l.colors.pop(), { props: true }) }));
      body.append(field('Colours', cols, { tip: 'From birth to death (or one at random each, below).' }));
      body.append(check('Each one colour, at random', !!L.random, (v) => set('random', v)));
      body.append(field('Look', seg(LOOKS.map((s) => [s, s[0].toUpperCase() + s.slice(1)]), L.look || 'pixel', (v) => set('look', v, true))));
      if (L.look === 'sprite') body.append(field('Art', refPicker(app, 'asset', L.asset, (v) => set('asset', v))));
      body.append(num('spin', 'Spin', -1080, 1080, 10));
      body.append(field('Bounce on the ground', h('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, check('', L.floor !== null && L.floor !== undefined, (v) => set('floor', v ? 0.3 : null, true)), L.floor !== null && L.floor !== undefined ? slider({ value: L.floor, min: 0, max: 1, step: 0.05, onChange: (v) => set('floor', v) }) : null)));
      body.append(check('Carried along (on someone moving)', !!L.local, (v) => set('local', v), { tip: 'Otherwise they\'re left behind where they came out.' }));
    } else if (L.type === 'ring') {
      body.append(num('from', 'From radius', 0, 120), num('to', 'To radius', 0, 200), num('width', 'Width', 1, 12), num('dur', 'Takes (s)', 0.05, 5, 0.05), num('squash', 'Flat', 0.1, 1, 0.05, '1: a circle; less: lying on the ground.'), num('alpha', 'Opacity', 0, 1, 0.05));
      body.append(field('Colour', colorButton(L.color || '#ffffff', (v) => set('color', v))), field('Easing', seg(EASES.map((e) => [e, e]), L.ease || 'out', (v) => set('ease', v))));
    } else if (L.type === 'glow') {
      body.append(num('r', 'Radius', 2, 160), num('alpha', 'Brightness', 0, 1, 0.05), num('pulse', 'Pulse', 0, 1, 0.05), num('pulseHz', 'Pulses a second', 0, 10, 0.1), num('flicker', 'Flicker', 0, 1, 0.05));
      body.append(field('Colour', colorButton(L.color || '#ffd070', (v) => set('color', v))));
    }
  }

  drawMotion() {
    const mb = this.motionPanel.body;
    clear(mb);
    const L = this.L;
    const A = (L.anim ||= {});
    const set = (k, v, again = false) => this.set((f, l) => ((l.anim ||= {})[k] = v), { timeline: false, props: again });
    const pres = h('div', { class: 'chips', style: { marginBottom: '8px' } });
    for (const [k, M] of Object.entries(MOTIONS)) {
      const c = h('span', { class: 'chip' }, k);
      c.addEventListener('click', () => this.set((f, l) => (l.anim = { ...newLayer('sprite').anim, ...M }), { props: true }));
      pres.append(c);
    }
    mb.append(h('div', { class: 'note' }, 'Moved without keyframes, by itself:'), pres);
    const n = (k, label, min, max, step = 0.1, tip = null) => field(label, slider({ value: A[k] ?? 0, min, max, step, onChange: (v) => set(k, v) }), { tip });
    mb.append(n('bob', 'Bob', 0, 20), n('bobHz', '  a second', 0, 8), n('sway', 'Sway (°)', 0, 90, 1), n('swayHz', '  a second', 0, 8), n('spin', 'Spin (°/s)', -1080, 1080, 10), n('pulse', 'Pulse', 0, 1, 0.01), n('pulseHz', '  a second', 0, 12), n('flicker', 'Flicker', 0, 1, 0.05), n('rise', 'Rise', -60, 60, 1, 'Pixels a second (less than 0: falls).'), n('orbit', 'Orbit', 0, 60, 1), n('orbitHz', '  a second', 0, 4, 0.05), n('shake', 'Shake', 0, 8, 0.1), n('fadeIn', 'Fade in (s)', 0, 3, 0.05), n('fadeOut', 'Fade out (s)', 0, 3, 0.05));
    mb.append(check('Pops in (springy)', !!A.pop, (v) => set('pop', v)));
    mb.append(n('ghosts', 'After-images', 0, 8, 1), n('ghostGap', '  apart (s)', 0.01, 0.3, 0.01));
    mb.append(h('div', { class: 'note', style: { marginTop: '6px' } }, 'For moves of your own, set keyframes on the timeline below the preview: click a track to add one.'));
    if (this.key) {
      const K = (L.keys[this.key.track] || [])[this.key.i];
      if (K) {
        mb.append(h('div', { class: 'hr' }), h('b', null, `Keyframe: ${TRACK_NAME[this.key.track]}`),
          field('At (s)', numberInput({ value: K.t, min: 0, max: 30, step: 0.01, onChange: (v) => this.setKey({ t: v }) })),
          field('Value', numberInput({ value: K.v, min: -999, max: 999, step: this.key.track === 'scale' || this.key.track === 'alpha' ? 0.05 : 1, onChange: (v) => this.setKey({ v }) })),
          field('Easing in', seg(EASES.map((e) => [e, e]), K.e || 'linear', (v) => this.setKey({ e: v }))),
          button('Delete keyframe', { small: true, icon: 'trash', kind: 'ghost', onClick: () => this.deleteKey() }));
      }
    }
  }

  // ------------------------------------------------------------ keyframes
  setKey(o) {
    const { track, i } = this.key;
    this.set((f, l) => {
      Object.assign(l.keys[track][i], o);
      const k = l.keys[track][i];
      l.keys[track].sort((a, b) => a.t - b.t);
      this.key.i = l.keys[track].indexOf(k);
    }, { timeline: true });
    this.drawMotion();
  }

  deleteKey() {
    if (!this.key) return;
    const { track, i } = this.key;
    this.set((f, l) => {
      l.keys[track].splice(i, 1);
      if (!l.keys[track].length) delete l.keys[track];
    });
    this.key = null;
    this.drawMotion();
  }

  addKey(track, t) {
    const L = this.L;
    const lt = Math.max(0, t - (L.start || 0));
    const v = trackAt((L.keys || {})[track], lt, TRACK_DEF[track]);
    this.set((f, l) => {
      l.keys ||= {};
      const arr = (l.keys[track] ||= []);
      arr.push({ t: +lt.toFixed(3), v: +(+v).toFixed(3), e: 'inout' });
      arr.sort((a, b) => a.t - b.t);
      this.key = { track, i: arr.findIndex((k) => Math.abs(k.t - lt) < 0.0015) };
    });
    this.drawMotion();
  }

  // ------------------------------------------------------------ the timeline
  drawTimeline() {
    const tl = this.tl;
    if (!tl) return;
    clear(tl);
    const f = this.fx;
    const D = Math.max(0.1, +f.dur || 1);
    const span = D * 1.25;
    const rows = h('div', { class: 'vt-rows' });
    // The ruler.
    const ruler = h('div', { class: 'vt-ruler' });
    for (let s = 0; s <= span + 1e-6; s += span > 4 ? 1 : span > 1.6 ? 0.5 : 0.25) ruler.append(h('span', { class: 'tick', style: { left: `${(s / span) * 100}%` } }, `${+s.toFixed(2)}s`));
    ruler.append(h('div', { class: 'vt-end', style: { left: `${(D / span) * 100}%` }, 'data-tip': 'The end (each time round)' }));
    this.head = h('div', { class: 'vt-head' });
    const lane = h('div', { class: 'vt-lane' }, ruler, rows, this.head);
    const toT = (e) => {
      const r = lane.getBoundingClientRect();
      return Math.max(0, Math.min(span, ((e.clientX - r.left) / r.width) * span));
    };
    ruler.addEventListener('pointerdown', (e) => {
      this.playing = false;
      this.drawPlayBtn();
      this.seekTo(toT(e));
      const mv = (ev) => this.seekTo(toT(ev));
      const up = () => {
        window.removeEventListener('pointermove', mv);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', mv);
      window.addEventListener('pointerup', up);
    });
    const names = h('div', { class: 'vt-names' }, h('div', { class: 'vt-n head' }, 'Layers'));
    for (const L of [...f.layers].reverse()) {
      const on = L.id === this.layerId;
      const nm = h('div', { class: `vt-n${on ? ' on' : ''}` }, ic(TYPE_ICON[L.type], 10), L.name);
      nm.addEventListener('click', () => this.pick(L.id));
      names.append(nm);
      const row = h('div', { class: `vt-row${on ? ' on' : ''}` });
      const s0 = L.start || 0;
      const s1 = L.end === null || L.end === undefined ? D : L.end;
      const bar = h('div', { class: `vt-bar t-${L.type}${L.hidden ? ' off' : ''}`, style: { left: `${(s0 / span) * 100}%`, width: `${(Math.max(0.02, s1 - s0) / span) * 100}%` } }, h('i', { class: 'grip l' }), h('i', { class: 'grip r' }));
      bar.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.pick(L.id);
        const which = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'm';
        const t0 = toT(e);
        const a = L.start || 0;
        const b = L.end === null || L.end === undefined ? D : L.end;
        this.ck();
        const mv = (ev) => {
          const d = toT(ev) - t0;
          const snap = (v) => Math.round(v * 20) / 20;
          if (which === 'l') L.start = Math.max(0, Math.min(b - 0.05, snap(a + d)));
          else if (which === 'r') L.end = Math.max(a + 0.05, snap(b + d));
          else {
            L.start = Math.max(0, snap(a + d));
            if (L.end !== null && L.end !== undefined) L.end = Math.max(L.start + 0.05, snap(b + d));
          }
          this.rebuildPlayer();
          bar.style.left = `${((L.start || 0) / span) * 100}%`;
          const e1 = L.end === null || L.end === undefined ? D : L.end;
          bar.style.width = `${(Math.max(0.02, e1 - (L.start || 0)) / span) * 100}%`;
        };
        const up = () => {
          window.removeEventListener('pointermove', mv);
          window.removeEventListener('pointerup', up);
          this.app.touch('vfx', this.id);
          this.drawTimeline();
          this.drawProps();
        };
        window.addEventListener('pointermove', mv);
        window.addEventListener('pointerup', up);
      });
      row.append(bar);
      rows.append(row);
      // The chosen art layer's keyframe tracks.
      if (on && L.type === 'sprite') for (const tr of TRACKS) {
        names.append(h('div', { class: 'vt-n sub' }, TRACK_NAME[tr]));
        const kr = h('div', { class: 'vt-row sub', 'data-tip': `Click to set a keyframe for ${TRACK_NAME[tr].toLowerCase()} here` });
        (L.keys && L.keys[tr] || []).forEach((K, i) => {
          const sel = this.key && this.key.track === tr && this.key.i === i;
          const dmd = h('div', { class: `vt-key${sel ? ' on' : ''}`, style: { left: `${((s0 + K.t) / span) * 100}%` }, 'data-tip': `${TRACK_NAME[tr]} ${K.v} at ${K.t}s` });
          dmd.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.key = { track: tr, i };
            this.ck();
            const mv = (ev) => {
              K.t = Math.max(0, +(toT(ev) - s0).toFixed(2));
              dmd.style.left = `${((s0 + K.t) / span) * 100}%`;
              this.rebuildPlayer();
            };
            const up = () => {
              window.removeEventListener('pointermove', mv);
              window.removeEventListener('pointerup', up);
              L.keys[tr].sort((a, b) => a.t - b.t);
              this.key.i = L.keys[tr].indexOf(K);
              this.app.touch('vfx', this.id);
              this.drawTimeline();
              this.drawMotion();
            };
            window.addEventListener('pointermove', mv);
            window.addEventListener('pointerup', up);
            this.drawMotion();
          });
          kr.append(dmd);
        });
        kr.addEventListener('pointerdown', (e) => {
          if (e.target !== kr) return;
          this.addKey(tr, toT(e));
        });
        rows.append(kr);
      }
    }
    tl.append(h('div', { class: 'vt' }, names, lane));
    this.span = span;
    this.movePlayhead();
  }

  movePlayhead() {
    if (!this.head || !this.player) return;
    this.head.style.left = `${(this.player.t / (this.span || 1)) * 100}%`;
  }

  // ------------------------------------------------------------ out
  // Frames of it, as pictures (w x h, `n` of them over its length).
  frames(w, hh, n, scale = 1) {
    const f = this.fx;
    const D = Math.max(0.1, +f.dur || 1);
    const p = new VfxPlayer(f, { art: (aid) => this.art(aid), loop: !!f.loop, seed: 7, scale });
    const out = [];
    for (let i = 0; i < n; i++) {
      p.seek((i / n) * D + (f.loop ? D : 0));
      const c = canvas(w, hh);
      p.draw(c.getContext('2d'), Math.round(w / 2), Math.round(hh * 0.75));
      out.push(c);
    }
    return out;
  }

  exportStrip() {
    const n = 12;
    const fr = this.frames(48, 48, n);
    const c = canvas(48 * n * 4, 48 * 4);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    fr.forEach((f, i) => x.drawImage(f, i * 192, 0, 192, 192));
    c.toBlob((b) => {
      const a = h('a', { href: URL.createObjectURL(b), download: `${String(this.fx.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-frames.png` });
      document.body.append(a);
      a.click();
      a.remove();
    });
  }

  // Into the Pixel tool: its frames as art (to touch up by hand, or to use
  // as a creature's or an item's look).
  async bakeDialog() {
    let W = 32;
    let H = 32;
    let n = Math.max(2, Math.min(24, Math.round((+this.fx.dur || 1) * 12)));
    let colours = 24;
    const v = await dialog({ title: 'Bake into pixel art', icon: 'pencil', body: [
      h('div', { class: 'note' }, 'Its frames drawn into a new piece of art (in the Pixel tool), to touch up by hand or to use as a look.'),
      h('div', { class: 'row' }, field('Width', numberInput({ value: W, min: 8, max: 128, int: true, onChange: (x) => (W = x) })), field('Height', numberInput({ value: H, min: 8, max: 128, int: true, onChange: (x) => (H = x) }))),
      field('Frames', slider({ value: n, min: 1, max: LIMITS.frames, int: true, onChange: (x) => (n = x) })),
      field('Colours at most', slider({ value: colours, min: 4, max: 64, int: true, onChange: (x) => (colours = x) })),
    ], buttons: [{ label: 'Cancel', kind: 'ghost', value: null }, { label: 'Bake', kind: 'primary', value: 'ok' }] });
    if (v !== 'ok') return;
    const fr = this.frames(W, H, n);
    // (One palette for all of them.)
    const all = new Uint8ClampedArray(W * H * 4 * n);
    fr.forEach((c, i) => all.set(c.getContext('2d').getImageData(0, 0, W, H).data, i * W * H * 4));
    const q = quantize(all, W, H * n, colours);
    const frames = fr.map((c, i) => ({ dur: Math.round(((+this.fx.dur || 1) * 1000) / n), cels: { l1: encodeCel(q.idx.subarray(i * W * H, (i + 1) * W * H)) } }));
    await this.app.create('assets', { name: `${this.fx.name} (baked)`, w: W, h: H, use: 'fx', palette: q.palette.length ? q.palette : [rgbaToHex(255, 255, 255)], frames, layers: [{ id: 'l1', name: 'Layer 1', visible: true, opacity: 1, blend: 'normal' }], tags: [], fps: 12 }, { open: false });
    toast('Baked into new art: it\'s in the explorer, under Art.', 'good');
  }
}

// A plain figure, for size (a person is 1 block across, about 1.5 high).
function drawPerson(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 5, y - 1, 11, 3);
  ctx.fillStyle = 'rgba(200,190,170,0.35)';
  ctx.fillRect(x - 3, y - 20, 7, 6);
  ctx.fillRect(x - 4, y - 14, 9, 9);
  ctx.fillRect(x - 3, y - 5, 3, 5);
  ctx.fillRect(x + 1, y - 5, 3, 5);
}
