// Children's games. Children out playing find each other and start a game
// of tag or hide-and-seek, on a street, round the houses or on the square.
// In tag whoever is "it" chases the others until they catch one; in
// hide-and-seek one counts at the base while the rest hide behind walls,
// barrels and trees, then goes looking for them.
import { buildingAt } from '../sim/sim.js';
import { BLOCKS } from '../world/blocks.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const COUNT = ['One... two... three...', 'Four... five... six...', 'Seven... eight... nine...', 'Ten! Ready or not, here I come!'];

export class Playtime {
  constructor(game) {
    this.game = game;
    this.games = [];
    this.t = 1;
  }

  // Out playing (not at home, at lessons or fleeing from something).
  free(n) {
    const e = n.activity && n.activity.entry;
    return !n.dead && !n.sleeping && n.state === 'routine' && e && e.act === 'play' && e.place === 'play' && !n.rec.away && n.rec.age === 'child';
  }

  // Children don't play games all the time: now and then they'd rather
  // wander about, stand around, or sit down for a bit.
  mood(n) {
    const now = this.game.sim.abs;
    if (n.playMood && now < n.moodUntil) return n.playMood;
    const r = Math.random();
    const was = n.playMood;
    n.playMood = r < 0.45 ? 'game' : r < 0.7 ? 'wander' : r < 0.85 ? 'idle' : 'sit';
    n.moodUntil = now + 20 + Math.random() * 40;
    if (was && was !== n.playMood && !n.playing) {
      n.goal = n.pickGoal(n.activity.entry);
      n.atGoal = false;
      n.path = null;
    }
    return n.playMood;
  }

  update(dt) {
    for (const a of this.game.active.values()) {
      for (const n of a.npcs) {
        if (n.rec.age !== 'child' || !this.free(n)) continue;
        if (this.mood(n) !== 'game' && n.playing) {
          const g = n.playing;
          this.drop(g, n);
          n.goal = n.pickGoal(n.activity.entry);
          n.atGoal = false;
          n.path = null;
        }
      }
    }
    for (const g of this.games) this.step(g, dt);
    this.games = this.games.filter((g) => !g.over);
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 2;
    for (const a of this.game.active.values()) this.gather(a);
  }

  // Two or more children out playing near each other start a game.
  gather(a) {
    const free = a.npcs.filter((n) => !n.playing && this.free(n) && n.playMood === 'game');
    if (free.length < 2) return null;
    const first = pick(free);
    const group = free.filter((n) => dist(n, first) <= 20).slice(0, 5);
    if (group.length < 2) return null;
    return this.start(a.layout, group, Math.random() < 0.55 ? 'tag' : 'hide');
  }

  start(L, group, kind) {
    const area = this.pickArea(L, group, kind);
    if (!area) return null;
    const g = { kind, L, members: group, area, it: pick(group), phase: kind === 'tag' ? 'play' : 'gather', t: 0, grace: 2, last: null, lastT: 0, found: new Set(), spots: new Map(), tick: 0, over: false };
    for (const n of group) {
      n.playing = g;
      n.playPace = 0.75;
    }
    this.games.push(g);
    g.it.say(kind === 'tag' ? pick(['Tag! I\'m it!', 'Let\'s play tag! You\'re going down!', 'I\'m it! Run!']) : pick(['Hide and seek! I\'ll count!', 'Let\'s play hide and seek! I\'m seeking!']), 2.5, '#a0ffb0');
    if (kind === 'hide') for (const n of group) this.go(n, area.cx, area.cz, 1);
    return g;
  }

  // Where to play: the street by someone's house, a road, or the square.
  pickArea(L, group, kind) {
    const w = this.game.world;
    const homes = group.map((n) => L.buildings[n.rec.home]).filter((b) => b && b.outside);
    const opts = [];
    for (const b of homes) opts.push({ x: b.outside.x, z: b.outside.z }, { x: b.outside.x, z: b.outside.z });
    for (let i = 0; i < 3 && L.patrol.length; i++) opts.push(pick(L.patrol));
    opts.push({ x: L.plaza.cx + 3, z: L.plaza.cz + 2 });
    for (let tries = 0; tries < 6; tries++) {
      const c = pick(opts);
      const y = w.findStandY(c.x, c.z, group[0].y);
      if (y > 0 && !w.isWaterAt(c.x, y, c.z)) return { cx: c.x, cz: c.z, y, r: kind === 'tag' ? 8 : 11 };
    }
    return null;
  }

  // Open ground in the play area (never inside a house or in water).
  tileIn(g, near = null, away = null) {
    const w = this.game.world;
    const a = g.area;
    let best = null;
    for (let i = 0; i < 10; i++) {
      const x = (near ? near.x : a.cx) + Math.round((Math.random() * 2 - 1) * (near ? 4 : a.r));
      const z = (near ? near.z : a.cz) + Math.round((Math.random() * 2 - 1) * (near ? 4 : a.r));
      if (Math.max(Math.abs(x - a.cx), Math.abs(z - a.cz)) > a.r + 2) continue;
      const y = w.findStandY(x, z, a.y);
      if (y <= 0 || Math.abs(y - a.y) > 1 || w.isWaterAt(x, y, z) || w.isWaterAt(x, y - 1, z) || buildingAt(g.L, x, z)) continue;
      const score = away ? Math.max(Math.abs(x - away.x), Math.abs(z - away.z)) : Math.random();
      if (!best || score > best.score) best = { x, y, z, score };
    }
    return best;
  }

  go(n, x, z, near = 0) {
    const y = this.game.world.findStandY(x, z, n.y);
    // (Never up onto a wall or a roof.)
    if (y <= 0 || Math.abs(y - n.y) > 1) return false;
    n.goal = { x, y, z, near, play: true };
    n.atGoal = false;
    n.path = null;
    return true;
  }

  drop(g, n) {
    n.playing = null;
    n.playPace = null;
    g.members = g.members.filter((q) => q !== n);
  }

  end(g) {
    for (const n of [...g.members]) this.drop(g, n);
    g.over = true;
  }

  step(g, dt) {
    for (const n of [...g.members]) if (!this.free(n)) this.drop(g, n);
    if (g.members.length < 2) {
      this.end(g);
      return;
    }
    if (!g.members.includes(g.it)) g.it = pick(g.members);
    g.t += dt;
    g.age = (g.age || 0) + dt;
    g.tick -= dt;
    // Games run their course: everyone goes off to do something else.
    if (g.age > (g.span || (g.span = 90 + Math.random() * 150))) {
      for (const n of [...g.members]) n.moodUntil = 0;
      this.end(g);
      return;
    }
    if (g.kind === 'tag') this.tag(g, dt);
    else this.hide(g, dt);
  }

  // ------------------------------------------------------------ tag
  tag(g, dt) {
    const it = g.it;
    g.grace -= dt;
    g.lastT -= dt;
    // Caught someone?
    if (g.grace <= 0) {
      const caught = g.members.find((n) => n !== it && (n !== g.last || g.lastT <= 0) && dist(n, it) <= 1 && Math.abs(n.y - it.y) <= 1);
      if (caught) {
        // The tagger shouts and runs for it; the new "it" counts to three.
        this.game.audio?.play('tag', caught);
        caught.emoteShow('!', '#ffe070', 1.2);
        g.last = it;
        g.lastT = 6;
        g.it = caught;
        g.grace = 3;
        g.count = 0;
        caught.path = null;
        caught.goal = null;
        caught.atGoal = true;
        it.say(pick(['You\'re it!', 'Tag! You\'re it!', 'Ha! You\'re it!']), 2, '#a0ffb0');
        const t = this.tileIn(g, it, caught) || this.tileIn(g, null, caught);
        if (t) this.go(it, t.x, t.z);
        it.playPace = 0.62;
        return;
      }
    }
    // Counting down before giving chase.
    if (g.grace > 0) {
      const k = Math.ceil(g.grace);
      if (k !== g.count && k <= 3) {
        g.count = k;
        it.say(`${k}...`, 0.9, '#a0ffb0');
      }
      if (g.grace - dt <= 0) it.say(pick(['Here I come!', 'Ready or not!', 'Coming to get you!']), 1.5, '#a0ffb0');
    }
    if (g.tick > 0) return;
    g.tick = 0.5;
    const runners = g.members.filter((n) => n !== it);
    // "It" goes after the nearest (not straight back after whoever tagged them).
    if (g.grace <= 0) {
      const prey = runners.filter((n) => n !== g.last || g.lastT <= 0).sort((a, b) => dist(a, it) - dist(b, it))[0];
      it.playPace = 0.62;
      if (prey && (!it.goal || !it.goal.play || dist(it.goal, prey) > 1)) this.go(it, prey.x, prey.z, 1);
    }
    for (const n of runners) {
      n.playPace = 0.7;
      const close = dist(n, it) <= 5;
      const idle = n.atGoal || !n.goal || !n.goal.play;
      if (close && (idle || Math.random() < 0.35)) {
        const t = this.tileIn(g, n, it);
        if (t) this.go(n, t.x, t.z);
        if (Math.random() < 0.08) n.say(pick(['Can\'t catch me!', 'Too slow!', 'Nyah nyah!']), 1.5);
      } else if (idle && Math.random() < 0.3) {
        const t = this.tileIn(g, n);
        if (t) this.go(n, t.x, t.z);
      }
    }
  }

  // ------------------------------------------------------------ hide & seek
  // Good hiding places: open ground tucked in against walls, fences,
  // barrels or trees, out of sight of the base.
  hidingSpots(g) {
    const w = this.game.world;
    const a = g.area;
    const out = [];
    for (let dz = -a.r; dz <= a.r; dz++) {
      for (let dx = -a.r; dx <= a.r; dx++) {
        const x = a.cx + dx;
        const z = a.cz + dz;
        if (Math.abs(dx) + Math.abs(dz) < 3) continue;
        const y = w.findStandY(x, z, a.y);
        if (y <= 0 || Math.abs(y - a.y) > 1 || w.isWaterAt(x, y, z) || buildingAt(g.L, x, z)) continue;
        let cover = 0;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const b = BLOCKS[w.getBlock(x + ox, y, z + oz)];
          if (b.solid || b.name.startsWith('leaves') || b.render === 'fence') cover++;
        }
        if (cover < 2) continue;
        const seen = this.game.sim.lineOfSight(a.cx, a.cz, x, z, y + 1);
        out.push({ x, y, z, score: cover + (seen ? 0 : 4) + Math.random() * 2 });
      }
    }
    out.sort((p, q) => q.score - p.score);
    return out.slice(0, 24);
  }

  hide(g, dt) {
    const it = g.it;
    const a = g.area;
    const hiders = g.members.filter((n) => n !== it);
    if (g.phase === 'gather') {
      if (g.t > 8 || g.members.every((n) => dist(n, { x: a.cx, z: a.cz }) <= 3)) {
        g.phase = 'count';
        g.t = 0;
        g.count = 0;
        g.found = new Set();
        g.spots = new Map();
        const spots = this.hidingSpots(g);
        for (const n of hiders) {
          const s = spots.find((q) => ![...g.spots.values()].some((o) => dist(o, q) < 2)) || this.tileIn(g, null, { x: a.cx, z: a.cz });
          if (!s) continue;
          g.spots.set(n, s);
          this.go(n, s.x, s.z);
          n.playPace = 0.7;
        }
        g.search = spots;
        it.goal = null;
        it.path = null;
        it.atGoal = true;
        it.face(a.cx, a.cz - 1);
      }
      return;
    }
    if (g.phase === 'count') {
      if (g.tick <= 0) {
        g.tick = 2.5;
        if (g.count < COUNT.length) it.say(COUNT[g.count++], 2.2, '#a0ffb0');
        else {
          g.phase = 'seek';
          g.t = 0;
        }
      }
      return;
    }
    // Seeking: look round the likely spots; anyone close enough to see is found.
    for (const n of hiders) {
      if (g.found.has(n)) continue;
      const d = dist(n, it);
      if (d <= 1 || (d <= 5 && this.game.sim.lineOfSight(it.x, it.z, n.x, n.z, it.y + 1))) {
        g.found.add(n);
        it.say(pick([`Found you, ${n.rec.name.first}!`, `I see you, ${n.rec.name.first}!`, 'Found you!']), 2, '#a0ffb0');
        n.say(pick(['Aww!', 'How did you see me?', 'No fair!']), 1.8);
        this.game.audio?.play('tag', n);
        this.go(n, a.cx + Math.round(Math.random() * 2 - 1), a.cz + 1, 1);
      }
    }
    const left = hiders.filter((n) => !g.found.has(n));
    if (!left.length || g.t > 80) {
      if (left.length) it.say('I give up! Come out!', 2);
      // Whoever was found first counts next.
      const next = [...g.found][0] || pick(hiders);
      g.it = next;
      g.phase = 'gather';
      g.t = 0;
      next.say('My turn to count!', 2, '#a0ffb0');
      for (const n of g.members) this.go(n, a.cx, a.cz, 1);
      return;
    }
    if (g.tick > 0 || (it.goal && it.goal.play && !it.atGoal)) return;
    g.tick = 1;
    it.playPace = 0.8;
    // Now and then the seeker heads straight for a hider's corner.
    const target = Math.random() < 0.35 ? g.spots.get(pick(left)) : pick(g.search || []);
    const t = target || this.tileIn(g);
    if (t) this.go(it, t.x, t.z, 1);
  }
}
