// The Workshop's Script tab (round 79): a mod's text scripts (see
// mod/script.js), for what's quicker typed than wired: commands with
// effects of their own, things done on the hour, answers to events, and
// the mod's versioned steps (`on migrate "1.2.0"`). Typed on the left,
// checked as you type (what's wrong, and on which line), tried out on the
// spot ("Try it": its top lines and `on load` run, with what it says in a
// list beneath), and beside it everything a script can call. A script
// reaches the game only through those: nothing else, ever.
import { h, ic, clear, button } from './kit.js';
import { checkScript, API_HELP, Script } from '../mod/script.js';

const START = `# A script of the mod's own. Lines starting with # are notes.
# "on command" adds a console command; try typing it in a world.
fn boom(power) {
  shake(power)
  flash("#ffd080", 0.3)
  particles("#ffb070", 30)
  say("Boom!", "#ffb070")
}

on command "boom" (args) {
  boom(num(args[0]) or 0.6)
}

on hour {
  if hour() == 6 { say("A new day.", "#ffe8a0") }
}
`;

export default class ScriptTool {
  constructor(app) {
    this.app = app;
    this.id = null;
  }

  get s() {
    return this.id && this.app.mod.scripts && this.app.mod.scripts[this.id] ? this.app.mod.scripts[this.id] : null;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    if (this.id && this.s) this.open('scripts', this.id);
    else this.empty();
  }

  unmount() {}

  current() {
    return this.s ? { kind: 'scripts', id: this.id } : null;
  }

  hintText() {
    return this.s ? 'Type the script on the left: it\'s checked as you go. "Try it" runs its top lines and "on load" now. The right-hand list is everything a script can do.' : 'Text scripts: commands, timed doings, answers to events, and versioned steps.';
  }

  open(kind, id) {
    if (!id || !this.app.mod.scripts || !this.app.mod.scripts[id]) {
      this.id = null;
      return this.empty();
    }
    this.id = id;
    this.build();
    return null;
  }

  reload() {
    if (this.s) this.build();
    else this.empty();
  }

  removed(kind, id) {
    if (kind === 'scripts' && id === this.id) {
      this.id = null;
      this.empty();
    }
  }

  renamed() {}

  empty() {
    clear(this.stage);
    clear(this.insp);
    const card = h('div', { class: 'card' }, h('div', { class: 't' }, ic('plus'), 'A new script'), h('div', { class: 'd' }, 'Starts with an example: a "boom" command and a word at dawn.'));
    card.addEventListener('click', () => this.app.create('scripts', { name: 'Script' }));
    this.stage.append(h('div', { class: 'home scroll', style: { overflow: 'auto' } },
      h('h1', null, 'Scripts'),
      h('div', { class: 'sub' }, 'Little programs of the mod\'s own, in plain text. They can do what the graph nodes do (words, sounds, effects, blocks, creatures, items, the time, the weather, values kept with the world, events, other mods) and nothing more: they can\'t reach your computer, and one that runs too long is stopped.'),
      h('div', { class: 'cards' }, card)));
    this.insp.append(h('div', { class: 'insp-head' }, ic('scroll'), 'Scripts'), this.apiList());
  }

  build() {
    const s = this.s;
    clear(this.stage);
    clear(this.insp);
    const area = h('textarea', { class: 'script-code', spellcheck: 'false', style: { width: '100%', height: '100%', minHeight: '360px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.45', background: '#0e0b16', color: '#e8e0f0', border: '1px solid #3a3050', padding: '8px', boxSizing: 'border-box', resize: 'none', tabSize: 2 } });
    area.value = s.code ?? START;
    if (s.code === undefined) {
      s.code = START;
      this.app.touch('scripts', this.id, { quiet: true });
    }
    const status = h('div', { class: 'script-status', style: { padding: '6px 8px', fontFamily: 'monospace', fontSize: '12px', minHeight: '20px' } });
    const out = h('div', { class: 'script-out', style: { padding: '6px 8px', fontFamily: 'monospace', fontSize: '12px', color: '#c8d8ff', maxHeight: '120px', overflow: 'auto' } });
    const check = () => {
      const errs = checkScript(area.value);
      clear(status);
      if (!errs.length) {
        let n = 0;
        try {
          n = new Script(area.value).prog.handlers.length;
        } catch {
          n = 0;
        }
        status.append(h('span', { style: { color: '#a0ffa0' } }, `Fine. ${n} handler${n === 1 ? '' : 's'}.`));
      } else for (const e of errs.slice(0, 4)) status.append(h('div', { style: { color: '#ff9080' } }, `${e.line ? `Line ${e.line}: ` : ''}${e.text.replace(/^line \d+: /, '')}`));
    };
    let t = 0;
    area.addEventListener('input', () => {
      s.code = area.value;
      const now = Date.now();
      if (now - (this.lastCk || 0) > 900) this.app.checkpoint('scripts', this.id);
      this.lastCk = now;
      this.app.touch('scripts', this.id);
      window.clearTimeout(t);
      t = window.setTimeout(check, 250);
    });
    // (Tab types two spaces, not a jump out of the box.)
    area.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const a = area.selectionStart;
      area.setRangeText('  ', a, area.selectionEnd, 'end');
      area.dispatchEvent(new window.Event('input'));
    });
    const tryIt = button('Try it', {
      icon: 'play', title: 'Runs the script\'s top lines and "on load" now, as if a world had started (what it would say shows below; nothing in a world is changed).',
      onClick: () => {
        clear(out);
        const lines = this.dryRun(area.value);
        for (const l of lines) out.append(h('div', { style: { color: l.startsWith('!') ? '#ff9080' : '#c8d8ff' } }, l));
        if (!lines.length) out.append(h('div', { style: { color: '#8a8498' } }, '(It said nothing.)'));
      },
    });
    const name = h('input', { class: 'inp', value: s.name || this.id, style: { width: '200px' } });
    name.addEventListener('change', () => {
      s.name = name.value.trim().slice(0, 48) || this.id;
      this.app.touch('scripts', this.id);
      this.app.drawExplorer?.();
    });
    const help = h('input', { class: 'inp', value: s.help || '', placeholder: 'What its commands do (shown in help)', style: { width: '280px' } });
    help.addEventListener('change', () => {
      s.help = help.value.trim().slice(0, 80);
      this.app.touch('scripts', this.id);
    });
    this.stage.append(h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', boxSizing: 'border-box', gap: '6px' } },
      h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, h('b', null, 'Script'), name, help, tryIt),
      h('div', { style: { flex: '1 1 auto', minHeight: '0' } }, area),
      status, out));
    this.insp.append(h('div', { class: 'insp-head' }, ic('scroll'), 'What scripts can do'), this.apiList());
    check();
  }

  // A run with nothing real behind it: what it'd say, and what'd go wrong.
  dryRun(code) {
    const said = [];
    let script;
    try {
      script = new Script(code, { name: 'try' });
    } catch (e) {
      return [`! ${e.message}`];
    }
    const noop = () => null;
    const svc = new Proxy({}, { get: (o, k) => (k === 'message' ? (x, text) => said.push(String(text)) : k === 'playerName' ? () => 'you' : noop) });
    const game = { minute: 360, day: 1, player: { x: 0, y: 6, z: 0, hp: 20, inv: [], kind: 'player' }, everyone: () => [], ui: { msg: noop } };
    const x = { game, mod: this.app.mod, svc, player: game.player, vars: {}, log: (t, level) => said.push(level === 'error' ? `! ${t}` : t), later: noop, sendEvent: (n) => said.push(`(event ${n})`), mods: () => [this.app.mod], modVar: noop, countItem: () => 0 };
    script.start(x);
    script.fire(x, 'load');
    return said.slice(0, 40);
  }

  apiList() {
    return h('div', { class: 'insp-body scroll', style: { overflow: 'auto' } },
      h('div', { class: 'panel-b note' }, 'Handlers: on load, tick (each second), hour, day, command "name" (args), event "name" (value), kill (what), break (block, pos), migrate "1.2.0" (the version a world had).'),
      ...API_HELP.map(([f, d]) => h('div', { style: { padding: '2px 8px', fontSize: '12px' } }, h('code', { style: { color: '#ffe070' } }, f), h('span', { style: { color: '#a8a0b8' } }, ` ${d}`))));
  }
}
