// Sagas: the world's stories, as they happen (round 52).
//
// Everything that matters that happens anywhere (a woodcutter meets
// outlaws in the trees, a band is wiped out, someone is killed, a raid
// goes well or badly, a core comes up out of the ground, a player is
// captured) is told to the sagas as an event. A story (a thread) takes it
// up: a woodcutter's plea for help, a band's grudge, a captive held for
// ransom. Each thread is a small graph of situations (its nodes); from
// each it goes on by what happens next: what people do about it (players,
// the watch, adventurers, the outlaws themselves), and, left alone, how it
// grows. Where it goes next is weighed then and there from how things
// stand, so no two go the same way; and when one ends its end is told
// again as an event, so one story starts the next.
//
// Two ways of telling: a story nobody playing has had a hand in, and no
// part of which is near anyone, is told plainly (a day at a time, its
// fights settled by the strength of each side, its people records); one
// that someone has touched (taken it on, talked of it, fought in it, read
// its letters), or that has a part near anyone playing, is told in full
// (every hour, every turn it can take, and its people there in the flesh
// when you're close enough to see them).
//
// What people can do in a story (clear a camp, carry a letter, pay a
// ransom, find someone lost) are its tasks. Word of a task gets round its
// town over an hour or two, then to the towns about with the merchants;
// anyone who's heard of it can take it on (players, guards, adventurers,
// and as many at once as like), and the first to see it done ends it for
// everyone.
import { DAY, ledger, hearNews, alive as recAlive } from '../econ.js';
import { RNG, hash4, hashString, clamp } from '../../util/rng.js';
import { asSeat } from '../../game/party.js';
import { R, refKey, sameRef, resolve, isAlive, nameOf, NameOf, whereOf, entOf, pidOf, seatOfPid, playerOf, playerName, townMid, directions, poss } from './refs.js';

export { R, refKey, sameRef, resolve, isAlive, nameOf, NameOf, whereOf, entOf, pidOf, playerOf, playerName, townMid, directions, poss };

// A piece of a story this near anyone playing is told in full.
export const NEAR = 120;
// This near, its people stand there in the flesh.
export const SEEN = 44;
// And this far off, they're gone from the world again (but for the record).
export const GONE = 72;
// The most stories going at once, and open tasks a town will post.
export const MAX_THREADS = 70;
export const TOWN_TASKS = 4;
// How far word of a task travels in a day (in map squares between towns).
const WORD_REACH = 9;

// The kinds of story (see motifs/*.js, which add themselves here).
export const MOTIFS = {};
// What the motifs hook into the game by: a player about to fall (taken
// alive instead?), two players who may fight (a contract between them?), a
// cell door used, a letter read. Each a list of (S, ...) => true if it was
// theirs.
export const HOOKS = { subdue: [], feud: [], door: [], read: [], chest: [], rejoin: [] };
export function motif(def) {
  MOTIFS[def.id] = def;
  return def;
}

const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// (A task's title in the middle of a sentence: its first word only.)
export const lcFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

export class Saga {
  constructor(game, sim) {
    this.game = game;
    this.sim = sim;
    this.threads = [];
    this.next = 1;
    this.taskNext = 1;
    this.queue = [];
    // Everyone who's played in this world, as the stories know them (by
    // pidOf): their name, where they were last, their fame and their name
    // among outlaws, the grudges held against them, what they've heard of,
    // a captivity, word waiting for them.
    this.people = {};
    // Outlaws and beasts the stories have made a name of.
    this.named = {};
    // Dens of beasts out in the wilds.
    this.dens = {};
    // Counts kept between stories (heads a band has lost to someone...).
    this.tally = {};
    // (Stories' people in the flesh, by key: see syncActors.)
    this.actors = new Map();
    this.lastHour = null;
    this.started = false;
    this.liveT = 0;
    this.chronicle = [];
    this.byTask = new Map();
  }

  get now() {
    return this.sim.abs;
  }

  get day() {
    return Math.floor(this.sim.abs / DAY);
  }

  thread(id) {
    return this.threads.find((t) => t.id === id) || null;
  }

  live() {
    return this.threads.filter((t) => !t.done);
  }

  // Those still going, and those over with a reward still to be collected.
  owing() {
    return this.threads.filter((t) => !t.done || t.tasks.some((q) => q.status === 'won'));
  }

  task(id) {
    const hit = this.byTask.get(id);
    if (hit) return hit;
    for (const th of this.threads) for (const t of th.tasks) if (t.id === id) {
      this.byTask.set(id, t);
      return t;
    }
    return null;
  }

  threadOf(task) {
    return task ? this.thread(task.th) : null;
  }

  // ------------------------------------------------------------ people
  person(pid) {
    if (!pid) return null;
    let p = this.people[pid];
    if (!p) {
      p = this.people[pid] = {
        name: playerName(this.game, pid, this), fame: 0, under: 0, grudges: {}, known: {}, inbox: [], held: null, deeds: [], titles: [],
        truce: {}, joined: null, last: null, seen: this.now, owed: [],
      };
    }
    return p;
  }

  // Everyone playing in the world just now, with their pid.
  players() {
    const out = [];
    for (const p of this.game.everyone()) if (p && !p.limbo) out.push({ p, pid: pidOf(p) });
    return out;
  }

  // Do `fn` as the one playing with this pid (if they're here).
  asPid(pid, fn) {
    const g = this.game;
    if (!g.seats) return pid === 'host' ? fn(g.player) : undefined;
    const seat = seatOfPid(g, pid);
    if (!seat) return undefined;
    return asSeat(g, seat, () => fn(g.player));
  }

  // Word for someone playing: on their screen if they're here, waiting
  // for them if not.
  tell(pid, text, color = '#e8d8a8') {
    const person = this.person(pid);
    if (!person) return;
    const here = playerOf(this.game, pid);
    if (here) this.asPid(pid, () => this.game.ui.msg(text, color));
    else person.inbox.push({ text, color, at: this.now });
    if (person.inbox.length > 20) person.inbox.shift();
  }

  tellAll(text, color, except = null) {
    for (const { pid } of this.players()) if (pid !== except) this.tell(pid, text, color);
  }

  // ------------------------------------------------------------ events
  // Something happened. `type` and what it's about (see the motifs for
  // what each listens for).
  emit(type, data = {}) {
    this.queue.push({ type, ...data, at: this.now });
    if (this.queue.length > 400) this.queue.shift();
  }

  drain() {
    let n = 0;
    while (this.queue.length && n++ < 200) {
      const ev = this.queue.shift();
      this.handle(ev);
    }
  }

  handle(ev) {
    // Stories under way hear it first (in the node they're in, then the
    // story as a whole).
    for (const th of this.live()) {
      const M = MOTIFS[th.m];
      if (!M) continue;
      const node = M.nodes[th.node];
      const fn = (node && node.on && node.on[ev.type]) || (M.on && M.on[ev.type]);
      if (!fn) continue;
      try {
        fn(th, ev, this);
      } catch (e) {
        this.fault(th, e);
      }
    }
    // Tasks that count it (kills toward a cull, and so on).
    this.countTasks(ev);
    // Then whatever new story it might start.
    for (const M of Object.values(MOTIFS)) {
      for (const sd of M.seeds || []) {
        if (sd.on !== ev.type) continue;
        if (!this.room(M)) break;
        let made = null;
        try {
          made = sd.make(ev, this);
        } catch (e) {
          this.fault(null, e);
        }
        for (const o of [].concat(made || [])) if (o) this.begin(M.id, o);
      }
    }
  }

  fault(th, e) {
    if (typeof console !== 'undefined' && !this.quiet) console.warn('saga', th ? `${th.m}/${th.node}` : '', e);
    if (th) th.faults = (th.faults || 0) + 1;
    if (th && th.faults > 5) this.end(th, 'faded', null);
  }

  // ------------------------------------------------------------ stories
  // Room for another of this kind of story?
  room(M) {
    const live = this.live();
    if (live.length >= MAX_THREADS) return false;
    const fam = live.filter((t) => t.m === M.id).length;
    return fam < (M.max ?? 6);
  }

  // A new story. `o`: { cast: {role: ref}, vars, sid (the town it's of),
  // spots ([{x, z}]: where it happens), parent (thread id), title }.
  begin(mid, o = {}) {
    const M = MOTIFS[mid];
    if (!M) return null;
    // (One story of a kind about the same thing at once.)
    const key = M.key ? M.key(o, this) : null;
    if (key && this.live().some((t) => t.m === mid && t.key === key)) return null;
    const id = this.next++;
    const th = {
      id, m: mid, fam: M.family || mid, key, node: null, title: o.title || null,
      cast: Object.fromEntries(Object.entries(o.cast || {}).filter(([, r]) => r)), names: {}, vars: { ...(o.vars || {}) }, sid: o.sid ?? null, spots: (o.spots || []).filter(Boolean),
      born: this.now, nodeAt: this.now, clock: 0, tasks: [], hist: [], actors: [], parent: o.parent ?? null, kids: [],
      touched: {}, tier: 'simple', done: false, outcome: null, ended: null, seed: hash4(this.game.seed | 0, id, hashString(mid)), steps: 0,
    };
    // (Names kept, for when they're gone.)
    for (const [k, r] of Object.entries(th.cast)) th.names[k] = nameOf(this, r);
    if (!th.title) th.title = typeof M.title === 'function' ? M.title(th, this) : M.title || mid;
    this.threads.push(th);
    const par = th.parent !== null ? this.thread(th.parent) : null;
    if (par) {
      par.kids.push(id);
      // (Whoever had a hand in the one it came from has a hand in this.)
      for (const pid of Object.keys(par.touched)) th.touched[pid] = this.now;
    }
    for (const pid of o.touched || []) th.touched[pid] = this.now;
    this.retier(th);
    this.go(th, M.start || Object.keys(M.nodes)[0], o.line || null);
    return th;
  }

  // On to node `to` (`line`: what happened, for its history).
  go(th, to, line = null, o = {}) {
    if (th.done) return;
    const M = MOTIFS[th.m];
    const prev = th.node ? M.nodes[th.node] : null;
    if (prev && prev.exit) {
      try {
        prev.exit(th, this, to);
      } catch (e) {
        this.fault(th, e);
      }
    }
    th.node = to;
    th.nodeAt = this.now;
    th.clock = 0;
    th.steps++;
    if (line) this.note(th, line, o);
    const node = M.nodes[to];
    if (!node) return;
    if (node.enter) {
      try {
        node.enter(th, this, o);
      } catch (e) {
        this.fault(th, e);
      }
    }
    if (node.final && !th.done) this.end(th, to, null);
  }

  // The story's over: how it came out. Told to the world (see the
  // motifs' seeds that listen for 'saga_end').
  end(th, outcome, line = null, o = {}) {
    if (th.done) return;
    if (line) this.note(th, line, o);
    th.done = true;
    th.outcome = outcome;
    th.ended = this.now;
    for (const t of th.tasks) if (t.status === 'open') this.closeTask(t, 'void');
    for (const a of th.actors) this.dismissActor(th, a.key);
    const M = MOTIFS[th.m];
    if (M && M.ended) {
      try {
        M.ended(th, this, outcome);
      } catch (e) {
        this.fault(null, e);
      }
    }
    this.emit('saga_end', { th: th.id, m: th.m, fam: th.fam, outcome, cast: th.cast, vars: th.vars, touched: Object.keys(th.touched) });
    this.chronicle.push({ at: this.now, id: th.id, title: th.title, outcome, line: th.hist.length ? th.hist[th.hist.length - 1].text : '' });
    if (this.chronicle.length > 60) this.chronicle.shift();
  }

  // A line in the story's history. `o`: { news: [sid] (put up on those
  // towns' boards), hidden (only told once the story's over), by (pid) }.
  note(th, text, o = {}) {
    th.hist.push({ at: this.now, text: capFirst(text), node: th.node, hidden: !!o.hidden, by: o.by || null });
    if (th.hist.length > 40) th.hist.splice(1, 1);
    for (const sid of o.news || []) this.news(sid, capFirst(text));
  }

  // On a town's board (and from there, talked of further off).
  news(sid, text) {
    const L = this.sim.layoutOf(sid);
    if (L && L.econ) ledger(L, this.day, text);
  }

  // Word carried to a town (as news from afar).
  rumour(sid, from, text) {
    const L = this.sim.layoutOf(sid);
    if (L && L.econ) hearNews(L, from, [text], this.day, this.now);
  }

  // The same roll every time for the same story, step and salt.
  rng(th, salt = 0) {
    return new RNG(hash4(th.seed, th.steps, Math.floor(this.now / 60), salt));
  }

  // Of a list of [{ to, w, when }]: one, weighed by how things stand
  // (`w` a number or a function of the story; `when` whether it can be at
  // all). Null if none can.
  choose(th, opts, rng = this.rng(th, 0xc0)) {
    const ok = [];
    for (const q of opts) {
      if (q.when && !q.when(th, this)) continue;
      const w = typeof q.w === 'function' ? q.w(th, this) : q.w ?? 1;
      if (w > 0) ok.push({ q, w });
    }
    if (!ok.length) return null;
    let r = rng.next() * ok.reduce((a, b) => a + b.w, 0);
    for (const o of ok) if ((r -= o.w) <= 0) return o.q;
    return ok[ok.length - 1].q;
  }

  // A story that comes of this one.
  spawn(th, mid, o = {}) {
    if (!this.room(MOTIFS[mid] || {})) return null;
    return this.begin(mid, { ...o, parent: th ? th.id : null });
  }

  // ------------------------------------------------------------ in full or plainly
  // Where a story's pieces are (its people and places, and its tasks').
  anchors(th) {
    const out = [...th.spots];
    const M = MOTIFS[th.m];
    if (M && M.anchors) {
      try {
        out.push(...(M.anchors(th, this) || []));
      } catch {
        // (Nowhere, this time.)
      }
    }
    for (const [k, r] of Object.entries(th.cast)) {
      if (!r || r.t === 'pl' || r.t === 'civ' || k.startsWith('_')) continue;
      const w = whereOf(this, r);
      if (w) out.push(w);
    }
    for (const t of th.tasks) if (t.status === 'open' && t.at) out.push(t.at);
    for (const a of th.actors) if (!a.gone && a.at) out.push(a.at);
    return out;
  }

  // Nearest anyone playing is to any of these.
  nearest(pts) {
    let best = Infinity;
    for (const { p } of this.players()) for (const q of pts) best = Math.min(best, Math.max(Math.abs(q.x - p.x), Math.abs(q.z - p.z)));
    return best;
  }

  retier(th) {
    const was = th.tier;
    const touched = Object.keys(th.touched).length > 0;
    const near = this.nearest(this.anchors(th)) <= NEAR;
    th.tier = touched || near ? 'complex' : 'simple';
    th.near = near;
    if (was !== th.tier && th.tier === 'complex') {
      const M = MOTIFS[th.m];
      const node = M && M.nodes[th.node];
      if (node && node.wake) {
        try {
          node.wake(th, this);
        } catch (e) {
          this.fault(th, e);
        }
      }
    }
    return th.tier;
  }

  // Someone playing has a hand in it now: told in full from here on.
  touch(th, pid, why = null) {
    if (!th || !pid) return;
    const first = !th.touched[pid];
    th.touched[pid] = this.now;
    th.tier = 'complex';
    if (first && why) this.note(th, why, { by: pid });
  }

  touchedBy(th, pid) {
    return !!th.touched[pid];
  }

  // ------------------------------------------------------------ the clock
  update(dt) {
    if (!this.game.world || !this.game.world.ow) return;
    this.start();
    this.drain();
    const hour = Math.floor(this.now / 60);
    if (this.lastHour === null) this.lastHour = hour;
    // (Hours slept or waited through: caught up, a day's worth at most a
    // call.)
    let n = 0;
    while (this.lastHour < hour && n++ < 24) {
      this.lastHour++;
      try {
        this.hourly(this.lastHour);
        if (this.lastHour % 24 === 0) this.daily(Math.floor(this.lastHour / 24));
      } catch (e) {
        this.fault(null, e);
      }
    }
    if (this.lastHour < hour - 24 * 4) this.lastHour = hour - 24 * 4;
    this.liveT -= dt;
    if (this.liveT <= 0) {
      this.liveT = 0.5;
      for (const th of this.live()) {
        try {
          this.retier(th);
        } catch (e) {
          this.fault(th, e);
        }
      }
      for (const th of this.live()) {
        if (th.tier !== 'complex') continue;
        const node = MOTIFS[th.m]?.nodes[th.node];
        try {
          if (node && node.live) node.live(th, this, 0.5);
          this.liveTasks(th);
        } catch (e) {
          this.fault(th, e);
        }
      }
      try {
        this.syncActors();
        this.notePlayers();
      } catch (e) {
        this.fault(null, e);
      }
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    for (const M of Object.values(MOTIFS)) {
      if (!M.begin) continue;
      try {
        for (const o of [].concat(M.begin(this) || [])) if (o) this.begin(M.id, o);
      } catch (e) {
        this.fault(null, e);
      }
    }
  }

  hourly(h) {
    for (const th of this.live()) {
      const M = MOTIFS[th.m];
      const node = M && M.nodes[th.node];
      if (!node) continue;
      th.clock += node.pressure ?? 0;
      if (th.tier === 'complex' && node.hour) {
        try {
          node.hour(th, this, this.rng(th, h & 0xffff));
        } catch (e) {
          this.fault(th, e);
        }
      }
    }
    // Tasks run out.
    for (const th of this.live()) {
      for (const t of th.tasks) {
        if (t.status !== 'open' || !t.due || this.now < t.due) continue;
        this.closeTask(t, 'lapsed');
        const M = MOTIFS[th.m];
        const fn = M.tasks && M.tasks[t.role] && M.tasks[t.role].lapsed;
        if (fn) fn(th, t, this);
      }
    }
  }

  daily(d) {
    for (const th of this.live()) {
      const M = MOTIFS[th.m];
      const node = M && M.nodes[th.node];
      if (!node) continue;
      if (node.day) {
        try {
          node.day(th, this, this.rng(th, d & 0xffff));
        } catch (e) {
          this.fault(th, e);
        }
      }
      // A story that's gone quiet for too long fades.
      const quiet = (this.now - th.nodeAt) / DAY;
      if (!th.done && quiet > (node.fade ?? M.fade ?? 20)) this.end(th, 'faded', node.faded ? node.faded(th, this) : null);
    }
    // New stories, out of how things stand.
    const rng = new RNG(hash4(this.game.seed | 0, d, 0x5a9a));
    for (const M of Object.values(MOTIFS)) {
      if (!M.scan || !this.room(M)) continue;
      try {
        for (const o of [].concat(M.scan(this, rng, d) || [])) if (o && this.room(M)) this.begin(M.id, o);
      } catch (e) {
        this.fault(null, e);
      }
    }
    this.spreadWord(rng);
    this.npcsTakeTasks(rng);
    // Old stories cleared away (kept a while, for the journal).
    this.threads = this.threads.filter((t) => !t.done || this.now - t.ended < 30 * DAY || this.kept(t));
    this.byTask.clear();
    // Grudges and names cool, slowly.
    for (const p of Object.values(this.people)) {
      p.under = Math.max(0, p.under * 0.985 - 0.05);
      for (const k of Object.keys(p.grudges)) {
        p.grudges[k] *= 0.97;
        if (p.grudges[k] < 0.5) delete p.grudges[k];
      }
    }
  }

  // (A finished story someone playing had a hand in is kept longer.)
  kept(t) {
    return Object.keys(t.touched).length > 0 && this.now - t.ended < 120 * DAY;
  }

  // Where everyone playing is (for when they're gone).
  notePlayers() {
    const here = new Set();
    for (const { p, pid } of this.players()) {
      here.add(pid);
      const k = this.person(pid);
      // (Back in the world: what happened to them while they were away.)
      if (!this.present || !this.present.has(pid)) for (const fn of HOOKS.rejoin) fn(this, pid, p);
      k.last = { x: Math.round(p.x), z: Math.round(p.z) };
      k.seen = this.now;
      k.name = playerName(this.game, pid, this);
      if (k.inbox.length) {
        const msgs = k.inbox.splice(0);
        this.asPid(pid, () => {
          this.game.ui.msg('While you were away:', '#e8d8a8');
          for (const m of msgs.slice(-4)) this.game.ui.msg(m.text, m.color);
        });
      }
    }
    this.present = here;
  }

  // ------------------------------------------------------------ tasks
  // Something people can do in a story. `o`: { role (which of the
  // motif's task handlers), kind ('clear', 'slay', 'deliver', 'fetch',
  // 'meet', 'rescue', 'escort', 'find', 'pay', 'contract', 'retrieve',
  // 'defend', 'investigate', 'talk'), title, pitch (what the one asking
  // says), giver (a ref: who asks, and who you go back to), sid (the town
  // it's posted in), at ({x, z}: where it's done), r, target (a ref),
  // need, item, count, reward ({ coins, from (a ref: who pays; a town
  // pays from its treasury), rep, renown, fame, under, items: [[k, n]] }),
  // days, only ([pid]: only they hear of it), secret (pid: never told of
  // it), npc (false: not for townsfolk or adventurers), hand ('giver', or
  // 'auto': paid where it's done), delay (minutes before word of it gets
  // round its town) }.
  post(th, o) {
    const id = this.taskNext++;
    const now = this.now;
    const t = {
      id, th: th.id, role: o.role || o.kind, kind: o.kind, title: o.title, pitch: o.pitch || null,
      giver: o.giver || null, giverName: o.giver ? nameOf(this, o.giver) : null, sid: o.sid ?? null,
      at: o.at || null, r: o.r ?? 10, target: o.target || null, need: o.need ?? 1, count: 0, item: o.item || null, n: o.n || 0,
      reward: o.reward || {}, claims: [], status: 'open', posted: now, due: o.days ? now + o.days * DAY : null,
      known: {}, only: o.only || null, secret: o.secret || null, npc: o.npc !== false, hand: o.hand || (o.giver ? 'giver' : 'auto'),
      ready: null, doneBy: null, doneName: null, data: o.data || {}, board: o.board ?? (o.sid !== null && o.sid !== undefined),
    };
    if (t.sid !== null && t.sid !== undefined) t.known[t.sid] = now + (o.delay ?? 90);
    th.tasks.push(t);
    this.byTask.set(id, t);
    // Told straight to those it's for.
    for (const pid of t.only || []) this.hear(pid, t);
    return t;
  }

  tasksOf(th, role = null) {
    return th.tasks.filter((t) => t.status === 'open' && (!role || t.role === role));
  }

  openTasks() {
    const out = [];
    for (const th of this.live()) for (const t of th.tasks) if (t.status === 'open') out.push(t);
    return out;
  }

  // May `pid` know of it at all?
  visibleTo(t, pid) {
    if (t.secret && t.secret === pid) return false;
    if (t.only && !t.only.includes(pid)) return false;
    return true;
  }

  // Is it known in town `sid` (yet)?
  knownIn(t, sid) {
    const at = t.known[sid];
    return at !== undefined && this.now >= at;
  }

  // `pid` hears of it (and it's on their list of what's going on).
  hear(pid, t) {
    if (!this.visibleTo(t, pid)) return false;
    const k = this.person(pid);
    if (k.known[t.id]) return false;
    k.known[t.id] = this.now;
    return true;
  }

  heardOf(pid, t) {
    return !!this.person(pid).known[t.id] || this.claimedBy(t, pid);
  }

  claimedBy(t, pid) {
    return t.claims.some((c) => c.who.t === 'pl' && c.who.pid === pid);
  }

  // Take it on (a player or anyone else).
  accept(t, who) {
    if (!t || t.status !== 'open') return false;
    if (t.claims.some((c) => sameRef(c.who, who))) return false;
    t.claims.push({ who, at: this.now, name: nameOf(this, who) });
    const th = this.threadOf(t);
    if (who.t === 'pl') {
      this.hear(who.pid, t);
      this.touch(th, who.pid, `${nameOf(this, who)} took it on: ${lcFirst(t.title)}.`);
    } else if (th) this.note(th, `${NameOf(this, who)} took it on: ${lcFirst(t.title)}.`);
    const M = MOTIFS[th.m];
    const fn = M.tasks && M.tasks[t.role] && M.tasks[t.role].accepted;
    if (fn) fn(th, t, who, this);
    return true;
  }

  drop(t, who) {
    t.claims = t.claims.filter((c) => !sameRef(c.who, who));
  }

  closeTask(t, status, by = null) {
    if (t.status !== 'open' && t.status !== 'won') return;
    t.status = status;
    t.closed = this.now;
    if (by) {
      t.doneBy = by;
      t.doneName = nameOf(this, by);
    }
  }

  // Done: by `by` (a ref). If it's turned in to the one who asked, it
  // waits for that (for whoever did it); others who'd taken it on hear
  // it's been seen to.
  complete(t, by, line = null) {
    if (!t || (t.status !== 'open')) return;
    const th = this.threadOf(t);
    const M = MOTIFS[th.m];
    const who = nameOf(this, by);
    for (const c of t.claims) {
      if (c.who.t !== 'pl' || sameRef(c.who, by)) continue;
      this.tell(c.who.pid, `${capFirst(who)} has seen to it before you: ${lcFirst(t.title)}.`, '#c8c8c8');
    }
    if (by && by.t === 'pl' && t.hand === 'giver' && t.giver && isAlive(this, t.giver)) {
      t.status = 'won';
      t.doneBy = by;
      t.doneName = who;
      t.ready = by.pid;
      this.tell(by.pid, `Done: ${t.title}. Go back to ${nameOf(this, t.giver)} for your reward.`, '#a0e0ff');
    } else {
      this.closeTask(t, 'done', by);
      if (by && by.t === 'pl') this.reward(t, by.pid);
      else this.npcReward(t, by);
    }
    if (line) this.note(th, line, { by: by && by.t === 'pl' ? by.pid : null });
    const fn = M.tasks && M.tasks[t.role] && M.tasks[t.role].done;
    if (fn) fn(th, t, by, this);
  }

  // Turned in to the one who asked (see talk.js).
  turnIn(t, pid) {
    if (!t || t.status !== 'won' || t.ready !== pid) return null;
    this.closeTask(t, 'done', R.pl(pid));
    const paid = this.reward(t, pid);
    const th = this.threadOf(t);
    const M = MOTIFS[th.m];
    const fn = M.tasks && M.tasks[t.role] && M.tasks[t.role].paid;
    if (fn) fn(th, t, pid, this);
    return paid;
  }

  // What the one who did it gets.
  reward(t, pid) {
    const rw = t.reward || {};
    const out = { coins: 0, items: [] };
    const k = this.person(pid);
    this.asPid(pid, (p) => {
      const sim = this.sim;
      let coins = rw.coins || 0;
      if (coins) {
        const from = rw.from || t.giver;
        coins = this.pay(from, coins);
        if (coins) {
          const left = p.give('coin', coins);
          if (left) this.game.spawnDrop('coin', left, p.x, p.y, p.z, true);
          this.game.audio?.play('coin');
        }
      }
      out.coins = coins;
      for (const [item, n] of rw.items || []) {
        const left = p.give(item, n);
        if (left) this.game.spawnDrop(item, left, p.x, p.y, p.z, true);
        out.items.push([item, n]);
      }
      if (rw.rep && t.giver && t.giver.t === 'rec') {
        const rec = resolve(this, t.giver);
        const L = this.sim.layoutOf(t.giver.sid);
        if (rec && L) sim.changeRep(rec.ent && !rec.ent.dead ? rec.ent : { rec, settlement: L.settlement, layout: L }, rw.rep);
      }
      if (rw.renown !== undefined && rw.renown !== null) sim.addRenown(rw.renown, rw.renownPts || 3, rw.renownWhy || lcFirst(t.title));
    });
    k.fame += rw.fame ?? 1;
    if (rw.under) k.under = Math.max(0, k.under + rw.under);
    k.deeds.push({ at: this.now, text: t.title });
    if (k.deeds.length > 30) k.deeds.shift();
    this.stat(pid, 'sagaTasks');
    return out;
  }

  // An adventurer or a guard who saw to it: paid (out of the same purse).
  npcReward(t, by) {
    if (!by) return;
    const coins = this.pay(t.reward.from || t.giver, t.reward.coins || 0);
    if (by.t === 'adv') {
      const a = resolve(this, by);
      if (a) {
        a.coins += coins;
        a.deeds = (a.deeds || 0) + 1;
      }
    } else if (by.t === 'rec') {
      const r = resolve(this, by);
      if (r) r.coins = (r.coins || 0) + coins;
    }
  }

  // Coins out of someone's purse (or a town's treasury): as many as they
  // have, up to `n`.
  pay(from, n) {
    if (!n || !from) return n || 0;
    if (from.t === 'town') {
      const L = this.sim.layoutOf(from.sid);
      if (!L || !L.econ) return 0;
      const c = Math.max(0, Math.min(n, Math.floor(L.econ.treasury)));
      L.econ.treasury -= c;
      return c;
    }
    if (from.t === 'rec') {
      const r = resolve(this, from);
      if (!r) return 0;
      const c = Math.max(0, Math.min(n, Math.floor(r.coins || 0)));
      r.coins -= c;
      // (Short: their family, or the town, makes it up.)
      if (c < n && from.sid !== undefined) {
        const L = this.sim.layoutOf(from.sid);
        const more = L && L.econ ? Math.max(0, Math.min(n - c, Math.floor(L.econ.treasury * 0.2))) : 0;
        if (L && L.econ) L.econ.treasury -= more;
        return c + more;
      }
      return c;
    }
    if (from.t === 'band') {
      const b = resolve(this, from);
      if (!b) return 0;
      const c = Math.max(0, Math.min(n, Math.floor(b.loot || 0)));
      b.loot -= c;
      return c;
    }
    if (from.t === 'purse') return n;
    return n;
  }

  stat(pid, k, n = 1) {
    this.asPid(pid, () => {
      const st = this.game.stats;
      if (st) st[k] = (st[k] || 0) + n;
    });
  }

  // Kills and the like, toward tasks that count them.
  countTasks(ev) {
    if (ev.type !== 'kill' || !ev.by) return;
    for (const th of this.live()) {
      for (const t of th.tasks) {
        if (t.status !== 'open' || t.kind !== 'slay') continue;
        if (!t.claims.some((c) => sameRef(c.who, ev.by))) continue;
        const d = t.data;
        if (d.species && !d.species.includes(ev.species)) continue;
        if (d.hostile && !ev.hostile) continue;
        if (t.at && Math.max(Math.abs(ev.x - t.at.x), Math.abs(ev.z - t.at.z)) > t.r) continue;
        t.count++;
        if (ev.by.t === 'pl') this.tell(ev.by.pid, `${t.title}: ${Math.min(t.count, t.need)}/${t.need}`, '#a0e0ff');
        if (t.count >= t.need) this.complete(t, ev.by);
      }
    }
  }

  // Tasks done by being somewhere (a meeting kept, someone found, a
  // captive led home).
  liveTasks(th) {
    const M = MOTIFS[th.m];
    for (const t of th.tasks) {
      if (t.status !== 'open' || !t.at) continue;
      const h = M.tasks && M.tasks[t.role];
      if (!h || !h.reach) continue;
      for (const { p, pid } of this.players()) {
        if (!this.claimedBy(t, pid) && !h.anyone) continue;
        if (Math.max(Math.abs(p.x - t.at.x), Math.abs(p.z - t.at.z)) > t.r) continue;
        try {
          h.reach(th, t, pid, this);
        } catch (e) {
          this.fault(th, e);
        }
        if (t.status !== 'open') break;
      }
    }
  }

  // ------------------------------------------------------------ word of it
  // Word of open tasks goes out from town to town with the merchants (and
  // what they're about with it).
  spreadWord(rng) {
    const ow = this.game.world.ow;
    for (const t of this.openTasks()) {
      if (t.only || t.secret === 'all') continue;
      const th = this.threadOf(t);
      const known = Object.keys(t.known).map(Number).filter((sid) => this.knownIn(t, sid));
      for (const sid of known) {
        const s = ow.settlements[sid];
        if (!s) continue;
        for (const o of ow.settlements) {
          if (o === s || t.known[o.id] !== undefined || o.deserted) continue;
          const d = Math.hypot(o.cx - s.cx, o.cz - s.cz);
          if (d > WORD_REACH || !rng.chance(0.35 * (1 - d / (WORD_REACH + 1)))) continue;
          t.known[o.id] = this.now + rng.int(0, 600);
          this.rumour(o.id, s.name, `${t.giverName ? `${t.giverName} of ${s.name}` : s.name} is asking for help: ${lcFirst(t.title)}.`);
          if (th) th.reach = (th.reach || 0) + 1;
        }
      }
    }
  }

  // Tasks known in towns you're near: heard of (it's on your list, and
  // its one asking shows it), and the way to them on your map.
  tasksIn(sid, pid = null) {
    return this.openTasks().filter((t) => this.knownIn(t, sid) && (!pid || this.visibleTo(t, pid)));
  }

  // ------------------------------------------------------------ townsfolk and adventurers
  // The watch (unless the town's under attack) and adventurers staying in
  // town take on what's posted there that's theirs to do.
  npcsTakeTasks(rng) {
    for (const th of this.live()) {
      const M = MOTIFS[th.m];
      for (const t of th.tasks) {
        if (t.status !== 'open' || !t.npc) continue;
        const h = M.tasks && M.tasks[t.role];
        if (!h || !h.npcs) continue;
        for (const sid of Object.keys(t.known).map(Number)) {
          if (!this.knownIn(t, sid)) continue;
          const L = this.sim.layoutOf(sid);
          if (!L || !L.econ) continue;
          // (Raided lately: the watch stays home.)
          const besieged = (L.econ.raidedDay ?? -9) >= this.day - 1 || (this.sim.war.live && this.sim.war.live.TL === L);
          for (const a of this.sim.adventurers.here(sid)) {
            if (t.claims.some((c) => c.who.t === 'adv' && c.who.id === a.id)) continue;
            if (rng.chance(h.npcs.adv ?? 0.3)) this.accept(t, R.adv(a.id));
          }
          if (!besieged && h.npcs.guard && L.npcs.filter((r) => recAlive(r) && r.job === 'guard').length >= 3 && rng.chance(h.npcs.guard)) {
            const g = rng.pick(L.npcs.filter((r) => recAlive(r) && r.job === 'guard' && !r.away && r.soldier === undefined));
            if (g && !t.claims.some((c) => c.who.t === 'rec' && c.who.sid === sid && c.who.idx === g.idx)) this.accept(t, R.rec(sid, g.idx));
          }
        }
        // And each who's taken it on has a go at it (out of sight), now
        // and then (they've their own business too).
        if (h.npcTry) {
          for (const c of t.claims) {
            if (c.who.t === 'pl' || t.status !== 'open') continue;
            if (!rng.chance(h.npcPace ?? 0.3)) continue;
            if (this.nearest(this.anchors(th)) <= SEEN) continue;
            try {
              h.npcTry(th, t, c.who, this, rng);
            } catch (e) {
              this.fault(th, e);
            }
          }
        }
      }
    }
  }

  // How strong someone is in a fight (as the plain telling settles one).
  strengthOf(r) {
    const o = resolve(this, r);
    if (!o) return 0;
    switch (r.t) {
      case 'adv': return 1.4 + (o.level || 1) * 0.9;
      case 'rec': return o.job === 'guard' ? (o.drilled ? 1.6 : 1.2) : 0.6;
      case 'band': return o.members.reduce((a, m) => a + m.hp / m.maxHp, 0) * (1 + (o.outpost || 0) * 0.25) * (o.windfall ? 1.5 : 1);
      case 'named': return o.power || 2;
      case 'den': return (o.pack || 1) * 0.8 + (o.alpha ? 2 : 0);
      default: return 1;
    }
  }

  // ------------------------------------------------------------ in the flesh
  // A story's person (or beast) who stands in the world when you're near:
  // `a`: { key, kind ('npc' | 'beast'), role, at ({x, z}), rec (for a
  // person: name, look, job, weapon, hp...), species (a beast's), hp,
  // name, hostile, talk (they can be talked to: see talk.js), wb (their
  // orders: see entities/sagaman.js) }.
  actor(th, a) {
    const i = th.actors.findIndex((q) => q.key === a.key);
    const spec = { gone: false, dead: false, spawned: false, ...a };
    if (i >= 0) th.actors[i] = { ...th.actors[i], ...spec };
    else th.actors.push(spec);
    return spec;
  }

  actorSpec(th, key) {
    return th.actors.find((q) => q.key === key) || null;
  }

  dismissActor(th, key) {
    const a = this.actorSpec(th, key);
    if (a) a.gone = true;
    const e = this.actors.get(`${th.id}:${key}`);
    if (e && !e.dead) {
      if (e.kind === 'npc') this.game.despawnNpc(e);
      else {
        e.dead = true;
        this.game.removeOcc(e);
      }
    }
    this.actors.delete(`${th.id}:${key}`);
  }

  actorEnt(th, key) {
    const e = this.actors.get(`${th.id}:${key}`);
    return e && !e.dead ? e : null;
  }

  syncActors() {
    const g = this.game;
    for (const th of this.live()) {
      for (const a of th.actors) {
        const k = `${th.id}:${a.key}`;
        const e = this.actors.get(k);
        if (a.gone) {
          if (e && !e.dead) this.dismissActor(th, a.key);
          continue;
        }
        if (e && !e.dead) {
          a.at = { x: Math.round(e.x), z: Math.round(e.z) };
          if (e.hp !== undefined) a.hp = e.hp;
          if (this.nearest([a.at]) > GONE && !a.stay) {
            if (e.kind === 'npc') g.despawnNpc(e);
            else {
              e.dead = true;
              g.removeOcc(e);
            }
            this.actors.delete(k);
          }
          continue;
        }
        if (e && e.dead) {
          this.actors.delete(k);
          // (Killed, not just gone from sight.)
          if (e.sagaKilled) {
            a.gone = true;
            a.dead = true;
            // (One of a band, killed while talking or standing guard: one
            // fewer of them. Their fighters are seen to by Game.kill.)
            if (!e.warband && a.person && a.person.band !== undefined && a.person.band !== null) this.bandMemberDown(a.person.band, a.person.member, e.sagaKilledBy || null, a.person);
            const M = MOTIFS[th.m];
            const fn = M.actorDown;
            if (fn) {
              try {
                fn(th, a, e.sagaKilledBy || null, this);
              } catch (err) {
                this.fault(th, err);
              }
            }
            continue;
          }
        }
        if (!a.at || this.nearest([a.at]) > SEEN || !g.world.regionAt(a.at.x, a.at.z)) continue;
        // (Things of the night only come out at night.)
        if (a.night && g.isDay()) continue;
        if (g.dungeon && g.world.inInstance(g.player.x) && !g.isParty()) continue;
        const ent = this.spawnActor(th, a);
        if (ent) this.actors.set(k, ent);
      }
    }
  }

  spawnActor(th, a) {
    const g = this.game;
    const y = g.world.findStandY(a.at.x, a.at.z, 6);
    if (y <= 0) return null;
    const spot = g.findFreeSpot(a.at.x, a.at.z, y);
    if (!spot) return null;
    if (a.kind === 'beast') {
      return g.sagaBeast ? g.sagaBeast(a, spot, th) : null;
    }
    return g.sagaPerson ? g.sagaPerson(a, spot, th) : null;
  }

  // One of a band, dead, who wasn't a fighter in the band's own camp.
  bandMemberDown(band, member, by, person = null) {
    const b = this.sim.bandits.get(band);
    if (!b) return;
    const m = b.members.find((q) => q.id === member);
    if (!m) return;
    b.members = b.members.filter((q) => q !== m);
    this.emit('bandit_down', { band, member, n: 1, by, name: `${m.name.first} ${m.name.last}`, title: m.title || (person && person.title) || null });
    if (!b.members.length) this.sim.bandits.wipedOut(b, this.day, by ? nameOf(this, by) : null, by);
  }

  // One of the stories' own was killed (see Game.kill).
  onKilled(e, source) {
    e.sagaKilled = true;
    e.sagaKilledBy = source && source.kind === 'player' ? R.pl(pidOf(source)) : source && source.rec && source.rec.adventurer !== undefined ? R.adv(source.rec.adventurer) : null;
  }

  // ------------------------------------------------------------ hooks
  // `p` about to fall to `source`: taken alive instead? (True if so.)
  subdue(p, source) {
    for (const fn of HOOKS.subdue) if (fn(this, p, source)) return true;
    return false;
  }

  // May these two players fight (outside a bout, with the host saying
  // players may not)? Yes, if one has taken a contract on the other.
  feud(a, b) {
    for (const fn of HOOKS.feud) if (fn(this, a, b)) return true;
    return false;
  }

  // A cell door (a cage at a camp?) used. True if it was one of ours.
  door(x, y, z) {
    for (const fn of HOOKS.door) if (fn(this, x, y, z)) return true;
    return false;
  }

  // A chest opened (an outlaws' strongbox?). True if it was one of ours.
  chest(x, y, z) {
    for (const fn of HOOKS.chest) if (fn(this, x, y, z)) return true;
    return false;
  }

  // A letter read (a note~ item): what it says, and the story it's from
  // hears that it's been read.
  read(key) {
    for (const fn of HOOKS.read) if (fn(this, key)) return true;
    const [, tid, n] = String(key).split('~');
    const th = this.thread(+tid);
    const note = th && th.vars.notes && th.vars.notes[+n];
    if (!note) return false;
    const pid = pidOf(this.game.player);
    this.game.ui.openBook([note.title, ...note.lines]);
    this.game.audio?.play('page');
    if (!note.read || !note.read.includes(pid)) {
      (note.read ||= []).push(pid);
      this.touch(th, pid);
      const M = MOTIFS[th.m];
      if (M && M.onRead) M.onRead(th, +n, pid, this);
    }
    return true;
  }

  // A letter for a story (its title and what it says): its item key.
  writeNote(th, kind, title, lines) {
    th.vars.notes ||= [];
    th.vars.notes.push({ title, lines, kind });
    return `note~${th.id}~${th.vars.notes.length - 1}~${kind}`;
  }

  // Into someone's hands (dropped at their feet if their pack's full).
  give(pid, item, n = 1) {
    return this.asPid(pid, (p) => {
      const left = p.give(item, n);
      if (left) this.game.spawnDrop(item, left, p.x, p.y, p.z, true);
      return true;
    });
  }

  // ------------------------------------------------------------ what you see over their heads
  // '!': they've something to ask of you; '?' (ready): you've done what
  // they asked, come and say so; '…': you're on it. Null for nothing.
  markOf(npc, pid) {
    if (!npc || !npc.rec || npc.dead) return null;
    if (npc.saga) {
      if (npc.saga.markFor && npc.saga.markFor !== pid) return null;
      return npc.saga.mark || null;
    }
    const sid = npc.rec.sid ?? (npc.settlement && npc.settlement.id);
    let best = null;
    for (const th of this.owing()) {
      for (const t of th.tasks) {
        if (!t.giver || t.giver.t !== 'rec' || t.giver.sid !== sid || t.giver.idx !== npc.rec.idx) continue;
        if (t.status === 'won' && t.ready === pid) return 'ready';
        if (t.status !== 'open' || !this.visibleTo(t, pid)) continue;
        if (this.claimedBy(t, pid)) best = best || 'busy';
        else if (this.knownIn(t, sid)) best = 'offer';
      }
    }
    return best;
  }

  // ------------------------------------------------------------ standing
  // A grudge someone (a band, a family, a realm) holds against `pid`.
  grudge(pid, key, n) {
    const k = this.person(pid);
    k.grudges[key] = (k.grudges[key] || 0) + n;
    return k.grudges[key];
  }

  // What a town thinks of you for what the stories tell of you (riding
  // with the outlaws who raided them; killing the beast that took their
  // children): the one playing now.
  townMod(sid) {
    const k = this.people[pidOf(this.game.player)];
    return k && k.towns ? clamp(k.towns[sid] || 0, -40, 25) : 0;
  }

  // Change it (for `pid`, in town `sid`, and the towns about by half).
  townSay(pid, sid, n, spread = true) {
    const k = this.person(pid);
    k.towns ||= {};
    k.towns[sid] = (k.towns[sid] || 0) + n;
    const s = this.game.world.ow.settlements[sid];
    if (spread && s) {
      for (const o of this.game.world.ow.settlements) {
        if (o === s || o.deserted || Math.hypot(o.cx - s.cx, o.cz - s.cz) > 7) continue;
        k.towns[o.id] = (k.towns[o.id] || 0) + Math.round(n / 2);
      }
    }
    this.asPid(pid, () => this.sim.areaCache.clear());
  }

  count(key, n = 1) {
    this.tally[key] = (this.tally[key] || 0) + n;
    return this.tally[key];
  }

  // Does band `id` count player `p` one of their own (and not turned on
  // them since)?
  friendOfBand(id, p) {
    if (id === undefined || id === null || !p) return false;
    const k = this.people[pidOf(p)];
    // (One of them, or under a truce with them: safe passage, say.)
    return !!k && (k.joined === id || !!(k.truce && k.truce[id] > this.now));
  }

  // A truce with a band, broken by a blow.
  breakTruce(id, p) {
    const k = this.people[pidOf(p)];
    if (!k || !k.truce || !(k.truce[id] > this.now)) return;
    k.truce[id] = 0;
    const b = this.sim.bandits.get(id);
    this.tell(pidOf(p), `You struck one of ${b ? b.name : 'them'}: there's no truce between you now.`, '#ff9080');
  }

  // How the outlaws see you: a word for it.
  underWord(pid) {
    const u = this.person(pid).under;
    return u >= 40 ? 'a legend to fear' : u >= 22 ? 'a marked name' : u >= 10 ? 'known' : u >= 4 ? 'heard of' : 'nobody';
  }

  // ------------------------------------------------------------ save
  serialize() {
    return {
      threads: this.threads.map((t) => ({ ...t, near: undefined })),
      next: this.next, taskNext: this.taskNext, people: this.people, named: this.named, dens: this.dens, tally: this.tally,
      lastHour: this.lastHour, started: this.started, chronicle: this.chronicle, queue: this.queue.slice(-50),
    };
  }

  load(d) {
    this.actors = new Map();
    this.byTask = new Map();
    if (!d) return;
    this.threads = (d.threads || []).map((t) => ({ ...t, actors: (t.actors || []).map((a) => ({ ...a, spawned: false })) }));
    this.next = d.next || 1;
    this.taskNext = d.taskNext || 1;
    this.people = d.people || {};
    for (const p of Object.values(this.people)) {
      p.grudges ||= {};
      p.known ||= {};
      p.inbox ||= [];
      p.deeds ||= [];
      p.titles ||= [];
      p.truce ||= {};
      p.owed ||= [];
    }
    this.named = d.named || {};
    this.dens = d.dens || {};
    this.tally = d.tally || {};
    this.lastHour = d.lastHour ?? null;
    this.started = !!d.started;
    this.chronicle = d.chronicle || [];
    this.queue = d.queue || [];
  }

  // ------------------------------------------------------------ for the journal
  // The stories `pid` knows of (had a hand in, or heard of a task in),
  // newest first.
  storiesFor(pid) {
    const k = this.person(pid);
    return this.threads.filter((th) => th.touched[pid] || th.tasks.some((t) => k.known[t.id] || this.claimedBy(t, pid)))
      .sort((a, b) => (a.done - b.done) || (b.nodeAt - a.nodeAt));
  }

  // The chain a story's part of: its first, and everything that came of it.
  rootOf(th) {
    let t = th;
    let n = 0;
    while (t && t.parent !== null && n++ < 30) {
      const p = this.thread(t.parent);
      if (!p) break;
      t = p;
    }
    return t;
  }

  // Where a task is, as someone in town `sid` would tell you.
  whereTask(t, sid) {
    const s = this.game.world.ow.settlements[sid];
    if (!t.at) return t.giver ? `ask ${t.giverName}` : '';
    return directions(s, t.at.x, t.at.z);
  }
}

export function clampN(v, a, b) {
  return clamp(v, a, b);
}
