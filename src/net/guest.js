// Playing in someone else's world (see host.js). The host's browser runs
// the world; this one keeps a copy of what can be seen of it, as the host
// sends it: the ground about you, the people and beasts in sight and what
// they're doing, the blows in the air, your own windows, how you are. It
// draws that, plays its sounds, and sends back what you press and click
// and point at, for the host to do as you.
import { heard } from './chat.js';
import { applyEntity, resolveEntity, dec } from './wire.js';
import { applyFrame } from './uiwire.js';
import { Region } from '../world/region.js';
import { REGION_W, REGION_D, GAME_MINUTES_PER_SECOND, DAY_MINUTES } from '../config.js';
import { BLOCKS } from '../world/blocks.js';
import { deathRitual, liftRide, bossEntrance, bossDefeat, spireOpening, duelYield } from '../game/scenes.js';
import { starfallScene } from '../game/starfall.js';
import { introFrom } from '../game/intros.js';
import { wallFall } from '../game/wallfall.js';
import { eruptionScene } from '../game/eruption.js';
import { DungeonRun } from '../game/dungeon.js';
import { dtypeOf } from '../world/dungeongen.js';
import { restamp } from '../world/sites.js';
import { GAME_VERSION, versionText } from '../version.js';
import { applyShips, driftShips } from '../game/ships3d.js';
import { registerDesign } from '../game/shipdesign.js';

// Keys that are this screen's own business (the camera, help, the map,
// the picture), not the host's.
export const LOCAL_KEYS = new Set(['KeyQ', 'KeyE', 'KeyH', 'F1', 'F2', 'F3', 'KeyM', 'KeyP', 'KeyL', 'Backquote', 'Slash', 'Enter', 'NumpadEnter']);
// (With one of the host's windows open over the world, it has your keys,
// all but these: the picture's own.)
const SCREEN_KEYS = new Set(['F2', 'F3']);

export class GuestNet {
  // `send`: words to the host; `build(save)`: the copy of the world made
  // from what the host sent (a Game, not running itself).
  constructor({ send, profile, build, onNeedHero, onNote, onParty, onFriend, onEnd }) {
    this.send = send;
    this.profile = profile;
    this.build = build;
    this.onNeedHero = onNeedHero || (() => {});
    this.onNote = onNote || (() => {});
    this.onParty = onParty || (() => {});
    this.onFriend = onFriend || (() => {});
    this.onEnd = onEnd || (() => {});
    this.game = null;
    this.ents = new Map();
    this.me = null;
    this.own = {};
    this.party = [];
    this.guilds = [];
    this.mates = [];
    this.wanted = new Set();
    this.sentAt = 0;
    this.last = '';
  }

  out(msg) {
    this.send(JSON.stringify(msg));
  }

  sendHero(hero) {
    this.out({ t: 'hero', hero });
  }

  // (Round 62) One of the world's mods, from the host: its text, promised
  // (null if it can't be had).
  requestPack(hash) {
    this.packWait ||= new Map();
    return new Promise((res) => {
      this.packWait.set(hash, res);
      this.out({ t: 'modpack?', hash });
      setTimeout(() => {
        if (this.packWait.get(hash) === res) {
          this.packWait.delete(hash);
          res(null);
        }
      }, 60000);
    });
  }

  modsReady() {
    this.out({ t: 'mods', ok: true });
  }

  receive(text) {
    let m;
    try {
      m = JSON.parse(text);
    } catch {
      return;
    }
    if (m.t === 'needHero') this.onNeedHero(m);
    // (Round 62) The world's mods: had, or to be got (see main.js).
    else if (m.t === 'mods?') this.onMods?.(m);
    else if (m.t === 'modpack') {
      const w = this.packWait && this.packWait.get(m.hash);
      if (w) {
        this.packWait.delete(m.hash);
        w(m.text || null);
      }
    }
    else if (m.t === 'welcome') this.welcome(m);
    else if (m.t === 's') this.snapshot(m);
    else if (m.t === 'party') {
      this.party = m.list || [];
      this.pvp = !!m.pvp;
      this.guilds = m.guilds || [];
      this.onParty(this.party);
    } else if (m.t === 'note') this.onNote(m.text, m.profile);
    // (Round 78) A line someone said that reaches you.
    else if (m.t === 'chat') heard(this.game && this.game.ui, m);
    // (What a command run on the host said: into the console.)
    else if (m.t === 'cmdOut') this.commandOut(m.lines || [], m.flags || null);
    else if (m.t === 'feat') this.onFeat?.(m.id);
    else if (m.t === 'friend') this.onFriend(m);
    else if (m.t === 'site') this.site(m);
    else if (m.t === 'closing' || m.t === 'hostgone') this.onEnd('The host has closed the world.');
    else if (m.t === 'kicked') this.onEnd(m.why || 'You were removed from the world.');
    else if (m.t === 'refused') this.onEnd(refusal(m.why, m), m.why === 'gameversion' ? 'ANOTHER VERSION' : null);
  }

  // ------------------------------------------------------------ arriving
  welcome(m) {
    this.me = m.me;
    this.party = m.party || [];
    this.hostProfile = m.host;
    this.worldInfo = m.world || {};
    const game = this.build(m.save);
    this.game = game;
    game.remote = this;
    game.npcs = [];
    game.creatures = [];
    game.drops = [];
    game.props = new Map();
    game.engines = [];
    game.active = new Map();
    const w = game.world;
    w.remote = true;
    w.netRegions = new Map();
    w.wantRegion = (rx, rz) => this.need(rx, rz);
    w.dropRegion = (rx, rz) => this.out({ t: 'drop', rx, rz });
    w.onRegionLoad = null;
    // (Round 80) The world runs on the host's machine, not here: no town
    // laid out, kept or lived in on this one (see World.layOut), nothing
    // of the host's simulation (see Game.update: a player's copy only
    // carries on what it's shown, between words).
    w.onLayout = null;
    // (Someone else's opinion of you is theirs to tell: the host does.)
    game.sim.opinion = (npc) => (npc && npc.netOp !== undefined ? npc.netOp : 0);
    this.onParty(this.party);
    // (Asked for word less often, if the settings say so.)
    if (this.rate && this.rate !== 20) this.out({ t: 'rate', hz: this.rate });
  }

  // How often the host sends word (round 57: 'Online (as a guest)' in the
  // settings): 20 a second, smooth, or 10, lighter on a slow line or a
  // slow machine. What you send back is thinned out to match.
  setRate(hz) {
    const was = this.rate;
    this.rate = hz;
    if (this.game && hz !== was) this.out({ t: 'rate', hz });
  }

  // May I use the command console here? (The host's to say: round 57.)
  canCommand() {
    const me = (this.party || []).find((q) => this.profile && q.id === this.profile.id);
    return !!(me && me.perm && me.perm.commands);
  }

  // (Round 78) A line said, on a channel (the host passes it on).
  chat(ch, text) {
    this.out({ t: 'chat', ch, text: String(text).slice(0, 200) });
  }

  // A command typed in the console: the host runs it, as you.
  command(text) {
    this.out({ t: 'cmd', text: String(text).slice(0, 200) });
  }

  commandOut(lines, flags = null) {
    const game = this.game;
    // (Your map, on your own screen: shown whole, or clicked to go there.)
    if (game && flags) {
      game.revealMap = !!flags.reveal;
      game.cheats = { ...(game.cheats || {}), mapTeleport: !!flags.mapTeleport };
    }
    const ui = game && game.ui;
    if (!ui) return;
    const log = (ui.consoleLog ||= []);
    log.push(...lines.map((l) => (typeof l === 'string' ? l : { text: l.text, c: l.c || undefined })));
    while (log.length > 200) log.shift();
  }

  need(rx, rz) {
    const k = `${rx},${rz}`;
    this.asked ||= new Map();
    const t = this.asked.get(k);
    const now = Date.now();
    if (t && now - t < 2000) return;
    this.asked.set(k, now);
    this.out({ t: 'need', rx, rz });
  }

  // ------------------------------------------------------------ what's sent
  snapshot(m) {
    const game = this.game;
    if (!game) return;
    const w = game.world;
    if (m.inst) this.instance(m.inst);
    if (m.r) for (const d of m.r) {
      const key = w.regionKey(d.rx, d.rz);
      // (Fresh from the host: whatever was here goes.)
      if (w.regions.has(key)) w.regions.delete(key);
      w._lastKey = -1;
      w._lastRegion = null;
      w.netRegions.set(key, d);
      w.loadRegion(d.rx, d.rz);
      game.lightDirty = true;
    }
    if (m.b) for (const [x, y, z, id, meta] of m.b) {
      const old = w.getBlock(x, y, z);
      if (!w.regionAt(x, z)) continue;
      w.setBlock(x, y, z, id, meta);
      if ((BLOCKS[old] && (BLOCKS[old].light || BLOCKS[old].opaque)) || (BLOCKS[id] && (BLOCKS[id].light || BLOCKS[id].opaque))) game.lightDirty = true;
    }
    if (m.e) {
      const touched = [];
      for (const pack of m.e) touched.push(applyEntity(game, this.ents, pack));
      const find = (id) => this.ents.get(id) || null;
      for (const e of touched) resolveEntity(e, find);
    }
    if (m.gone) {
      // (Kept a moment: a master just fallen is still drawn, coming
      // apart, in the scene of its fall.)
      this.lately ||= new Map();
      for (const id of m.gone) {
        if (id === this.me) continue;
        const e = this.ents.get(id);
        if (e) this.lately.set(id, e);
        this.ents.delete(id);
      }
      if (this.lately.size > 64) this.lately = new Map([...this.lately].slice(-32));
    }
    this.sortEnts();
    // (Round 68) The great ships about you.
    if (m.sh) applyShips(game, m.sh);
    if (m.l) this.lists(m.l);
    if (m.w) this.globals(m.w);
    if (m.own) this.ownState(m.own);
    // The others in your guild, as they are now.
    if (m.gm) this.mates = m.gm;
    if (m.slow) {
      game.placed = new Map(m.slow.placed || []);
      game.relics = new Map((m.slow.relics || []).map(([k, v]) => [k, dec(v, () => null)]));
      // (The storm wall, down on the host's side: down here too.)
      if (m.slow.wallDown) game.world.ow.wallDown = game.wallDown = true;
      game.signIcons = new Map(m.slow.signs || []);
      // (Round 78) Blueprints laid out about you (see game/plans.js).
      game.plans = new Map((m.slow.plans || []).map((q) => [q.id, q]));
      for (const d of m.slow.designs || []) if (!game.shipDesigns || !game.shipDesigns.has(d.id)) registerDesign(game, d, d.id);
      game.displayShown = new Map(m.slow.shown || []);
    }
    // Your own map: what's new on it.
    if (m.ex) {
      const ow = w.ow;
      for (const i of m.ex) {
        if (ow.explored[i]) continue;
        ow.explored[i] = 1;
        ow.exploredN = (ow.exploredN || 0) + 1;
      }
    }
    if (m.pins) w.ow.pins = m.pins;
    if (m.places) this.places(m.places);
    if (m.ui) applyFrame(game.ui, m.ui);
    if (m.m) for (const [text, color, merge] of m.m) game.ui.msg(text, color, !!merge);
    if (m.fx) this.effects(m.fx);
  }

  // The old places and camps known of in the host's world (round 56: so
  // what's heard of there is on this map too).
  places(pl) {
    const D = this.game.sim.dungeons;
    for (const [id, seen, cleared, entered, depth, clearedBy, open] of pl.ds || []) {
      const d = D && D.get(id);
      if (!d) continue;
      d.known = true;
      d.seen = !!seen;
      d.cleared = !!cleared;
      d.entered = !!entered;
      if (depth) d.depth = depth;
      d.clearedBy = clearedBy || d.clearedBy;
      if (open && d.spire && (d.spire.open === null || d.spire.open === undefined)) d.spire.open = true;
    }
    const B = this.game.sim.bandits;
    if (B) {
      const camps = pl.camps || [];
      B.knownCamps = () => camps;
    }
  }

  // Everyone, in their lists.
  sortEnts() {
    const game = this.game;
    const npcs = [];
    const creatures = [];
    const drops = [];
    const engines = [];
    const props = new Map();
    const players = [];
    const sailors = [];
    for (const e of this.ents.values()) {
      if (e.netKind === 'N') npcs.push(e);
      else if (e.netKind === 'C') creatures.push(e);
      else if (e.netKind === 'D') drops.push(e);
      else if (e.netKind === 'E') engines.push(e);
      else if (e.netKind === 'R') props.set(e.id, e);
      else if (e.netKind === 'P') players.push(e);
      else if (e.netKind === 'S') sailors.push(e);
    }
    game.sailors = sailors;
    game.npcs = npcs;
    game.creatures = creatures;
    game.drops = drops;
    game.engines = engines;
    game.props = props;
    this.players = players;
    const me = this.ents.get(this.me);
    if (me) {
      if (game.player !== me) {
        game.player = me;
        game.renderer.camInit = false;
      }
    }
    for (const n of npcs) {
      const op = this.ops && this.ops.get(n.id);
      if (op !== undefined) n.netOp = op;
      n.netMark = (this.qms && this.qms.get(n.id)) || null;
    }
  }

  // An old place changed on the host's side (a dungeon's way in fallen
  // in, a spire opened): our copy of it, and the ground we have of it.
  site(m) {
    const w = this.game.world;
    const s = (w.sites || []).find((q) => q.id === m.id);
    if (!s) return;
    s.state = m.state || {};
    restamp(w, s);
    this.game.lightDirty = true;
  }

  instance(inst) {
    const w = this.game.world;
    if (inst.none) {
      w.setInstance(null);
      this.game.lightDirty = true;
      return;
    }
    const regions = new Map();
    for (const d of inst.regions) {
      const r = Region.deserialize(d);
      regions.set(d.rx * 4096 + d.rz, r);
    }
    w.setInstance({ regions, floor: inst.floor ?? undefined, maxY: inst.maxY ?? undefined, voyage: inst.voyage });
    this.game.lightDirty = true;
    this.game.renderer.camInit = false;
  }

  lists(l) {
    const game = this.game;
    const find = (id) => this.ents.get(id) || null;
    for (const k of Object.keys(l)) game[k] = dec(l[k], find);
    // (Each arrow's flight: where along it is the host's, then ours.)
  }

  globals(g) {
    const game = this.game;
    // (Our clock runs on between words; put right if it's drifted.)
    if (Math.abs(g.day * DAY_MINUTES + g.minute - (game.day * DAY_MINUTES + game.minute)) > 2) {
      game.minute = g.minute;
      game.day = g.day;
    }
    game.weather = g.weather;
    const d = g.dungeon;
    if (!d) {
      game.dungeon = null;
      return;
    }
    const rec = game.sim.dungeons.get(d.id);
    if (!rec) return;
    let run = game.dungeon;
    if (!run || run.rec !== rec) {
      run = Object.create(DungeonRun.prototype);
      run.game = game;
      run.rec = rec;
      // (Its kind, as the screen needs it: its name, its dark, its music.)
      run.T = dtypeOf(rec);
      run.state = { stairs: [], solved: {} };
      run.t = 0;
      run.plateOn = new Map();
      run.carriedBy = new Map();
      run.notes = [];
      game.dungeon = run;
    }
    const find = (id) => this.ents.get(id) || null;
    run.floor = d.floor;
    run.fight = dec(d.fight, find);
    run.fallen = dec(d.fallen, find);
    run.data = { bossRoom: d.bossRoom, up: d.up, upAt: d.upAt, down: d.down };
    run.packs = d.packs || [];
    run.update = () => {};
  }

  // Your own: sleep, scene, how you feel, where you stand with the town.
  ownState(o) {
    const game = this.game;
    const sim = game.sim;
    this.own = o;
    game.sleep = o.sleep ? { ...o.sleep, bed: null, from: null } : null;
    game.sleepFast = o.fast > 1 ? o.fast : 0;
    game.waiting = o.waiting ? { t: 0 } : null;
    game.mining = o.mining;
    game.fishing = o.fishing;
    game.shake = Math.max(game.shake || 0, o.shake || 0);
    game.hurtFlash = Math.max(game.hurtFlash || 0, o.hurt || 0);
    game.healFlash = Math.max(game.healFlash || 0, o.heal || 0);
    game.combatT = o.combat;
    game.combatWith = o.with;
    game.currentSettlement = o.cs !== null && o.cs !== undefined ? game.world.ow.settlements[o.cs] || null : null;
    game.wanted = new Map(o.wanted || []);
    sim.justice.jail = o.jail;
    sim.justice.escort = o.escort ? {} : null;
    sim.justice.exiled = new Set(o.exiled || []);
    sim.citizen = o.citizen;
    this.hud = o.hud || [];
    sim.careers.hudLines = () => this.hud;
    game.stormSea = o.storm || null;
    game.charging = o.charging || null;
    if (o.ops) this.ops = new Map(o.ops);
    if (o.qm) this.qms = new Map(o.qm);
    this.scene(o.scene);
  }

  // A scene of yours (your fall, a ride in a lift, a master's waking):
  // played here, as the host plays it there.
  scene(s) {
    const game = this.game;
    const cur = game.scene;
    if (!s) {
      if (cur) game.scene = null;
      return;
    }
    if (cur && cur.kind === s.kind) {
      // (Kept in step with the host's.)
      if (Math.abs(cur.t - s.t) > 0.5) cur.t = s.t;
      return;
    }
    const find = (id) => this.ents.get(id) || (this.lately && this.lately.get(id)) || null;
    let sc = null;
    try {
      if (s.kind === 'death') sc = deathRitual(game, s.cause || 'misfortune', s.below || null);
      else if (s.kind === 'lift') sc = liftRide(game, s.dir || 1, () => {}, s.label || '');
      else if (s.kind === 'boss_in' && game.dungeon) {
        const boss = (Array.isArray(s.boss) ? s.boss : [s.boss]).map(find).filter(Boolean);
        if (boss.length) sc = bossEntrance(game, game.dungeon, boss);
      } else if (s.kind === 'boss_down' && game.dungeon) {
        const b = find(Array.isArray(s.boss) ? s.boss[0] : s.boss);
        if (b) {
          // (Fallen: drawn as it comes apart, see Renderer.)
          b.dead = true;
          sc = bossDefeat(game, game.dungeon, b);
        }
      } else if (s.kind === 'yield') {
        // (A bout's end: the other one, whoever it was.)
        const foe = find(s.foe);
        if (foe) sc = duelYield(game, foe, !!s.won, { name: s.name || foe.name, quiet: true });
      } else if (s.kind === 'spire') {
        const rec = game.sim.dungeons.get(s.rec);
        if (rec) sc = spireOpening(game, rec, s.side, s.gemColor);
      } else if (s.kind === 'wall') sc = wallFall(game);
      else if (s.kind === 'erupt') sc = eruptionScene(game, { here: !!s.here });
      else if (s.kind === 'starfall') sc = starfallScene(game, { village: s.village, first: s.first });
      else sc = introFrom(game, s);
    } catch (e) {
      void e;
      sc = null;
    }
    if (sc) {
      sc.t = s.t;
      // (The host does what the scene does; here it's only seen.)
      sc.end = null;
      if (sc.act) sc.act = () => {};
      game.scene = sc;
    }
  }

  // What happened near you: sparks, words, flashes, sounds.
  effects(list) {
    const game = this.game;
    const r = game.renderer;
    for (const [kind, args] of list) {
      if (kind === 'sound') {
        const [name, at, o] = args;
        game.audio?.play(name, at || undefined, null, o && typeof o === 'object' ? o : null);
      } else if (typeof r[kind] === 'function') r[kind](...args);
    }
  }

  // ------------------------------------------------------------ each frame
  // The copy of the world kept moving between words from the host, and
  // what you do sent to it.
  update(dt, input) {
    const game = this.game;
    game.dt = dt;
    const ui = game.ui;
    const ev = input.consume();
    const remoteModal = ui.windows.some((w) => w.remote && w.modal && w.state !== 'closing');
    const local = ui.windows.find((w) => !w.remote && w.kind !== 'banner' && w.state !== 'closing');
    const fwd = { pressed: [], clicks: [], wheel: 0, wheelShift: ev.wheelShift };
    if (local) {
      // A window of this screen's own is open: it has your keys and clicks.
      ui.handle(ev, input, game);
    } else {
      ui.mouse = input.mouse;
      ui.mouseCell = { x: Math.floor(input.mouse.x / 6), y: Math.floor(input.mouse.y / 8) };
      for (const k of ev.pressed) {
        if (k.code === 'Escape' && !remoteModal) {
          this.openPause?.();
          continue;
        }
        if (remoteModal ? SCREEN_KEYS.has(k.code) : LOCAL_KEYS.has(k.code)) {
          this.localKey(k);
          continue;
        }
        fwd.pressed.push(k);
      }
      // Right-click someone you're playing with: their profile, here.
      const c = game.cursor;
      const other = !remoteModal && c && c.entity && c.entity.kind === 'player' && c.entity !== game.player && c.entity.account ? c.entity : null;
      fwd.clicks = other && this.onProfile ? ev.clicks.filter((q) => {
        if (q.button !== 2) return true;
        if (q.type === 'down') this.onProfile(other.account);
        return false;
      }) : ev.clicks;
      fwd.wheel = ev.wheel;
    }
    // Your pointer: what's under it, worked out on your own screen.
    const blocked = remoteModal || !!local || !game.player || game.player.dead || !!game.sleep;
    if (!blocked && game.player) game.updateCursor(input);
    else game.cursor = null;
    this.sendInput(input, fwd, !!local);
    // The time, between words.
    game.minute += dt * GAME_MINUTES_PER_SECOND * (game.sleepFast > 1 ? game.sleepFast : 1);
    if (game.minute >= DAY_MINUTES) {
      game.minute -= DAY_MINUTES;
      game.day++;
    }
    // Everyone carries on with what they were doing till the next word,
    // and whatever's in the air flies on.
    for (const e of this.ents.values()) tick(e, dt);
    for (const a of game.projectiles || []) if (a.t < a.dur) a.t = Math.min(a.dur, a.t + dt);
    driftShips(game, dt);
    for (const h of game.hazards || []) h.t = (h.t || 0) + dt;
    for (const z of game.zones || []) z.t = (z.t || 0) + dt;
    for (const o of game.orbs || []) {
      o.t = (o.t || 0) + dt;
      o.x += (o.vx || 0) * dt;
      o.z += (o.vz || 0) * dt;
    }
    // Your scene, played here.
    const sc = game.scene;
    if (sc) {
      sc.t += dt;
      try {
        sc.update?.(game, dt, []);
      } catch {
        // (A scene that can't be played here is only drawn.)
      }
      if (sc.t >= sc.dur && game.scene === sc) game.scene = null;
    }
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 3.6);
    if (game.hurtFlash > 0) game.hurtFlash = Math.max(0, game.hurtFlash - dt * 2.2);
    if (game.healFlash > 0) game.healFlash = Math.max(0, game.healFlash - dt * 1.1);
    // The ground: what's in sight (and a little more) asked for, what's
    // far behind let go.
    this.ground();
    // Birds, butterflies, the wind: this screen's own.
    try {
      game.wildlife?.update(dt);
      game.ambientSounds(dt);
    } catch {
      // (Not here.)
    }
    const p = game.player;
    if (p) game.world.ow.markExplored(p.x, p.z, 1);
    if (game.audio) game.audio.listener = p;
    game.renderer.zoomGoal = game.scene && game.scene.zoom ? game.scene.zoom : 1;
    game.renderer.zoomSnap = !!(game.scene && game.scene.zoom);
    const vis = p ? [p] : [];
    const near = (e) => p && Math.abs(e.x - p.x) < 26 && Math.abs(e.z - p.z) < 26;
    for (const e of this.ents.values()) if (e !== p && !e.dead && near(e)) vis.push(e);
    game.visibleEntities = vis;
  }

  localKey(k) {
    const game = this.game;
    if ((k.code === 'KeyQ' || k.code === 'KeyE') && game.renderer.turn) game.renderer.turn(k.code === 'KeyQ' ? -1 : 1);
    else if (this.onLocalKey) this.onLocalKey(k);
  }

  sendInput(input, fwd, held) {
    const game = this.game;
    const c = game.cursor;
    const keys = held ? [] : [...(input.keys || [])].filter((k) => !LOCAL_KEYS.has(k));
    const mouse = { x: Math.round(input.mouse.x), y: Math.round(input.mouse.y), down: held ? false : !!input.mouse.down, rdown: held ? false : !!input.mouse.rdown, inside: !!input.mouse.inside };
    let aim = null;
    try {
      aim = game.aimAngle();
    } catch {
      aim = null;
    }
    const msg = {
      t: 'in',
      k: keys,
      m: mouse,
      p: fwd.pressed.map((k) => ({ code: k.code, key: k.key, shift: k.shift, ctrl: k.ctrl })),
      c: fwd.clicks.map((q) => ({ button: q.button, x: q.x, y: q.y, shift: q.shift, ctrl: q.ctrl, type: q.type })),
      w: fwd.wheel || 0,
      ws: !!fwd.wheelShift,
      lk: input.lastMoveKey || null,
      aim: aim === null ? null : Math.round(aim * 1000) / 1000,
      view: game.renderer.view || 0,
      cur: c ? packCursor(c) : null,
      away: held,
    };
    // (Nothing new: not sent again, but every so often all the same.)
    const j = JSON.stringify(msg);
    const now = Date.now();
    if (j === this.last && !msg.p.length && !msg.c.length && now - this.sentAt < 250) return;
    // (On the light setting: only the pointer moved, not every frame of it.)
    const kj = JSON.stringify(msg.k);
    if (this.rate && this.rate <= 10 && !msg.p.length && !msg.c.length && kj === this.lastKeys && !!msg.m.down === !!this.lastDown && now - this.sentAt < 66) return;
    this.lastKeys = kj;
    this.lastDown = !!msg.m.down;
    this.last = j;
    this.sentAt = now;
    this.send(j);
  }

  ground() {
    const game = this.game;
    const w = game.world;
    const p = game.player;
    if (!p || w.inInstance(p.x)) return;
    const rx = Math.floor(p.x / REGION_W);
    const rz = Math.floor(p.z / REGION_D);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (w.inBounds(rx + dx, rz + dz) && !w.isLoaded(rx + dx, rz + dz)) w.loadRegion(rx + dx, rz + dz);
    // (Far behind: let go, and the host told.)
    this.dropT = (this.dropT || 0) + 1;
    if (this.dropT % 120) return;
    for (const r of [...w.regions.values()]) {
      if (Math.abs(r.rx - rx) <= 3 && Math.abs(r.rz - rz) <= 3) continue;
      w.regions.delete(w.regionKey(r.rx, r.rz));
      w._lastKey = -1;
      w._lastRegion = null;
      this.out({ t: 'drop', rx: r.rx, rz: r.rz });
    }
  }

  setProfile(profile) {
    this.out({ t: 'profile', icon: profile.icon, desc: profile.desc, title: profile.title || '' });
  }

  friend(to, yes) {
    this.out({ t: 'friend', to, yes });
  }

  // A bout with another player here, for `wager` coins (see game/bout.js).
  bout(to, wager) {
    this.out({ t: 'bout', to, wager });
  }

  // A guild's doings, asked of the host (see game/guilds.js): `op` 'create'
  // (`name`), 'invite' (`to`), 'join' or 'decline' (`gid`), or 'leave'.
  guild(op, args = {}) {
    this.out({ t: 'guild', op, ...args });
  }
}

// What a thing goes on doing between words from the host: walking on to
// where it was going, its flash and its words fading.
function tick(e, dt) {
  if (e.moveT !== undefined && e.moveT < 1) e.moveT = Math.min(1, e.moveT + dt / (e.moveDur || 0.2));
  if (e.flash > 0) e.flash -= dt;
  if (e.actionTimer > 0) e.actionTimer -= dt;
  if (e.bubble && e.bubble.t !== undefined) {
    e.bubble.t -= dt;
    if (e.bubble.t <= 0) e.bubble = null;
  }
  if (e.emote && e.emote.t !== undefined) {
    e.emote.t -= dt;
    if (e.emote.t <= 0) e.emote = null;
  }
  // (A dropped thing in the air: where it was going.)
  if (e.netKind === 'D' && !e.resting) {
    e.px += (e.vx || 0) * dt;
    e.pz += (e.vz || 0) * dt;
  }
}

// What the pointer's on, as data.
function packCursor(c) {
  const out = { mx: Math.round(c.mx), my: Math.round(c.my) };
  if (c.entity) {
    out.ent = c.entity.id;
    out.entUp = Math.round((c.entUp ?? 0.5) * 100) / 100;
    if (c.part) out.part = c.part;
  }
  if (c.x !== undefined) {
    out.x = c.x;
    out.y = c.y;
    out.z = c.z;
    out.face = c.face;
    if (c.plan) out.plan = true;
    if (c.place) out.place = { x: c.place.x, y: c.place.y, z: c.place.z };
  }
  if (c.ship) out.ship = { s: c.ship.s, vi: c.ship.vi, face: c.ship.face };
  return out;
}

export function refusal(why, m = {}) {
  // (Another version of the game: which, and that it can't be joined.)
  if (why === 'gameversion') return `This world is running ${versionText(m.host)} of the game, and you have ${versionText(m.you || GAME_VERSION)}. Your version is incompatible: you can't join this server.`;
  return {
    full: 'That world is full.',
    banned: 'You are banned from that world.',
    nohost: 'Nobody is hosting a world there right now.',
    version: 'That host is playing a different version of the game.',
    'already here': 'You are already in that world (from another window?).',
    'no account': 'You need an account to join.',
    mods: 'That world uses mods you didn\'t install.',
  }[why] || `You couldn't join that world${why ? ` (${why})` : ''}.`;
}
