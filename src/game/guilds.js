// Guilds: players in a world banded together under a name. A guild's
// members see each other wherever they are: on the world map, on the
// little map in the corner, and down the side of the screen (each one's
// face and body, name and health, as they are now). Anyone not in one can
// found one; a member can ask anyone else here to join (they say yes or
// no); anyone can leave (the last out, and it's gone). The host keeps them
// (see net/host.js), with the world's save.

export const GUILD_NAME_MAX = 20;
// (Each guild's colour on the maps, in turn.)
export const GUILD_COLORS = ['#f0c850', '#70c8ff', '#ff8a70', '#90e070', '#d8a0ff', '#ffb0d0', '#60e0c8', '#e8e8e8'];

// A guild's name, tidied: letters, numbers, spaces and a little
// punctuation, at most GUILD_NAME_MAX long.
export function cleanGuildName(s) {
  return String(s || '').replace(/[^A-Za-z0-9 '\-&.]/g, '').replace(/\s+/g, ' ').trim().slice(0, GUILD_NAME_MAX);
}

export class Guilds {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.next = 1;
  }

  // The guild player `pid` (an account id) is in, if any.
  of(pid) {
    return this.list.find((g) => g.members.includes(pid)) || null;
  }

  get(gid) {
    return this.list.find((g) => g.id === gid) || null;
  }

  // The guilds that have asked `pid` to join.
  invitesFor(pid) {
    return this.list.filter((g) => g.invites.includes(pid) && !g.members.includes(pid));
  }

  // Do one thing as player `by` (their account id): `op` is 'create'
  // (with `name`), 'invite' (with `to`, an account id), 'join' or
  // 'decline' (with `gid`), or 'leave'. Returns { ok, why, guild, told:
  // [[account id, text]...] } (who's to be told what).
  act(by, op, { name = '', to = null, gid = null } = {}) {
    const told = [];
    const mine = this.of(by);
    const fail = (why) => ({ ok: false, why, told });
    const nameOf = (pid) => this.nameOf(pid);
    if (op === 'create') {
      if (mine) return fail(`You're already in ${mine.name}: leave it first.`);
      const nm = cleanGuildName(name);
      if (nm.length < 3) return fail('A guild\'s name needs at least three letters.');
      if (this.list.some((g) => g.name.toLowerCase() === nm.toLowerCase())) return fail(`There's already a guild called ${nm} here.`);
      const used = new Set(this.list.map((g) => g.color));
      const color = GUILD_COLORS.find((c) => !used.has(c)) || GUILD_COLORS[this.next % GUILD_COLORS.length];
      const guild = { id: this.next++, name: nm, color, leader: by, members: [by], invites: [], made: this.game.day };
      this.list.push(guild);
      told.push([by, `You founded the guild ${nm}. Invite others from the multiplayer menu (P).`]);
      return { ok: true, guild, told };
    }
    if (op === 'invite') {
      if (!mine) return fail('You\'re not in a guild: found one first.');
      if (!to || to === by) return fail('Invite whom?');
      if (mine.members.includes(to)) return fail(`${nameOf(to)} is already in ${mine.name}.`);
      if (mine.invites.includes(to)) return fail(`${nameOf(to)} has already been asked.`);
      mine.invites.push(to);
      told.push([by, `You asked ${nameOf(to)} to join ${mine.name}.`]);
      told.push([to, `${nameOf(by)} invites you to join the guild ${mine.name}. (Press P to answer.)`]);
      return { ok: true, guild: mine, told };
    }
    if (op === 'join') {
      const g = this.get(gid);
      if (!g || !g.invites.includes(by)) return fail('That invitation isn\'t open any more.');
      // (One guild at a time: out of the old one first.)
      if (mine && mine !== g) told.push(...this.act(by, 'leave').told);
      g.invites = g.invites.filter((q) => q !== by);
      if (!g.members.includes(by)) g.members.push(by);
      for (const m of g.members) told.push([m, m === by ? `You joined the guild ${g.name}.` : `${nameOf(by)} joined ${g.name}.`]);
      return { ok: true, guild: g, told };
    }
    if (op === 'decline') {
      const g = this.get(gid);
      if (!g) return fail('That invitation isn\'t open any more.');
      g.invites = g.invites.filter((q) => q !== by);
      for (const m of g.members) told.push([m, `${nameOf(by)} turned down ${g.name}'s invitation.`]);
      return { ok: true, guild: g, told };
    }
    if (op === 'leave') {
      if (!mine) return fail('You\'re not in a guild.');
      mine.members = mine.members.filter((q) => q !== by);
      told.push([by, `You left the guild ${mine.name}.`]);
      if (!mine.members.length) {
        this.list = this.list.filter((g) => g !== mine);
        return { ok: true, guild: null, told };
      }
      if (mine.leader === by) mine.leader = mine.members[0];
      for (const m of mine.members) told.push([m, `${nameOf(by)} left ${mine.name}.${mine.leader === m && by !== m ? ' You lead it now.' : ''}`]);
      return { ok: true, guild: mine, told };
    }
    return fail('?');
  }

  // A player's name, by their account id (here now, or kept from before).
  nameOf(pid) {
    const game = this.game;
    for (const s of game.seats || []) if (s.id === pid) return s.name;
    const ch = game.partyChars && game.partyChars.get(pid);
    return (ch && ch.profile && ch.profile.name) || 'Someone';
  }

  // What's sent to each player (see net/host.js): every guild, its name,
  // colour, members and who's been asked.
  summary() {
    return this.list.map((g) => ({ id: g.id, name: g.name, color: g.color, leader: g.leader, members: [...g.members], invites: [...g.invites], names: Object.fromEntries(g.members.map((m) => [m, this.nameOf(m)])) }));
  }

  serialize() {
    return { list: this.list, next: this.next };
  }

  load(d) {
    if (!d) return;
    this.list = (d.list || []).map((g) => ({ ...g, members: [...(g.members || [])], invites: [...(g.invites || [])] })).filter((g) => g.members.length);
    this.next = Math.max(d.next || 1, ...this.list.map((g) => g.id + 1));
  }
}

// The others in your guild, where they are and how they are (for the maps
// and the strip down the side of the screen): [{ id, name, color (theirs,
// from their picture), guild colour, x, z, mx, mz (where they are on the
// world map: down an old place, its way in), hp, maxHp, dead, below (the
// old place they're down, by name), here (in the same place as you: the
// island, or the same old place), look }].
export function guildMates(game) {
  if (game.remote) return game.remote.mates || [];
  if (!game.seats || !game.guilds) return [];
  const me = game.seat;
  const g = me && game.guilds.of(me.id);
  if (!g) return [];
  const out = [];
  const myRun = game.dungeon;
  for (const s of game.seats) {
    if (s === me || !g.members.includes(s.id)) continue;
    const p = s.ent;
    if (!p) continue;
    const run = game.world.inInstance(p.x) && game.runAt ? game.runAt(p.x) : null;
    out.push({
      id: s.id, name: s.name, color: (s.profile && s.profile.icon && s.profile.icon.color) || g.color, guild: g.color,
      x: p.x, z: p.z, mx: run ? run.rec.x : p.x, mz: run ? run.rec.z : p.z,
      hp: Math.max(0, Math.ceil(p.hp)), maxHp: p.maxHp, dead: !!p.dead, below: run ? run.rec.name : null,
      here: run ? run === myRun : !myRun, look: p.look,
    });
  }
  return out;
}
