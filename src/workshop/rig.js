// (Round 62) The rig tool: see below.
import { h, clear } from './kit.js';

export default class Tool {
  constructor(app) {
    this.app = app;
  }

  mount(stage, insp) {
    this.stage = stage;
    this.insp = insp;
    clear(stage);
    stage.append(h('div', { class: 'empty-stage' }, h('div', { class: 'big' }, 'Coming together...')));
  }

  unmount() {}

  open() {}

  current() {
    return null;
  }
}
