// Wonders, strays and small mysteries (round 54).
//
//   - The white stag: seen at the edge of the woods. The hunters want it;
//     the devout say it's holy; the children just want to see it.
//   - A stray: a lamb (or a pig, or a fine horse with an empty saddle)
//     that's followed someone home and won't leave.
//   - A haunting: lights in an empty house, and noises. A ghost, a
//     squatter, a prank, or someone's grief.
//   - A shipwreck: on the rocks by a fishing town. Survivors to pull from
//     the water, cargo on the tide, and those who'd loot it.
//   - The well runs dry: a dowser, a new well to dig, or a neighbour
//     who's been turning the stream.
//   - A falling star: a light in the sky, and something come down in the
//     hills. Everyone wants it.
//   - The great fish: a legend of the lake, older than anyone, that every
//     angler in town has lost a line to. Land it, if you can.
//   - The pig chase: a prize pig loose in the market.
//   - The swarm: bees in the mayor's chimney.
//   - Ill luck: something brought into a town that shouldn't have been, and
//     everything going wrong since. Or is it?
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, townName, townMid, living, adults, fullName, recOf, has, nat, spotNear, biomeAt, persuade, repWith, isRec, someone } from './lib.js';
import { makePerson } from '../actors.js';
import { mayorOf, alive, DAY } from '../../econ.js';
import { BIOMES } from '../../../world/biomes.js';
import { ITEMS } from '../../../world/items.js';

const tid = (th) => `t${th.id}`;
const first = (r) => (r ? r.name.first : 'them');

// ------------------------------------------------------------ the white stag
motif({
  id: 'white_stag',
  family: 'wonder',
  max: 1,
  key: () => 'stag',
  title: (th, S) => `The White Stag of ${townName(S, th.sid)}`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      const m = townMid(L.settlement);
      const at = spotNear(S, m.x, m.z, 40, 90, rng, { woods: true, clear: 12 });
      if (!at) continue;
      const b = BIOMES[biomeAt(S, at.x, at.z)];
      if (!b || (b.treeChance || 0) < 0.05) continue;
      return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, spots: [at], vars: { at } };
    }
    return null;
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    seen: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x57a);
        const ppl = adults(L);
        const hunter = ppl.find((r) => r.job === 'trapper') || ppl.find((r) => has(r, 'brave') || has(r, 'shrewd')) || someone(L, rng);
        const holy = ppl.find((r) => r.job === 'priest') || ppl.find((r) => has(r, 'devout') || has(r, 'superstitious'));
        if (hunter) {
          th.cast.hunter = R.rec(th.sid, hunter.idx);
          th.names.hunter = fullName(hunter);
        }
        if (holy && holy !== hunter) {
          th.cast.holy = R.rec(th.sid, holy.idx);
          th.names.holy = fullName(holy);
        }
        S.note(th, say(rng, [
          'A white stag has been seen at the edge of the woods by {t}: white as milk, antlers like a crown.',
          'Children in {t} swear they saw a white stag in the trees at dawn. Then the woodcutters saw it too.',
        ], { t: L.settlement.name }), { news: [th.sid] });
        S.actor(th, { key: 'stag', kind: 'beast', role: 'stag', species: 'deer', hostile: false, at: th.vars.at, name: 'the White Stag', maxHp: 40, orders: { home: th.vars.at } });
        if (hunter) {
          const t = S.post(th, {
            role: 'hunt', kind: 'talk', title: `Bring down the White Stag for ${first(hunter)}`, sid: th.sid, giver: th.cast.hunter,
            pitch: say(rng, ['A white hide, and antlers like that? A lord would pay a fortune. I\'ll split it with whoever brings it down.', 'I\'ve hunted these woods forty years and never seen the like. I want that head on my wall. Help me and I\'ll make it worth your while.'], {}),
            reward: { coins: 60, from: th.cast.hunter, rep: 5 },
          });
          t.offerLabel = 'You look like you\'re after something.';
        }
        if (th.cast.holy) {
          const t = S.post(th, {
            role: 'spare', kind: 'talk', title: 'Keep the White Stag from the hunters', sid: th.sid, giver: th.cast.holy,
            pitch: say(rng, ['It\'s a sign. A blessing on this town. And there are men sharpening their knives for it. Don\'t let them.', 'The old stories say a white stag comes once in a lifetime, and the town that harms it never prospers again. Talk the hunters out of it. Or stand in their way.'], {}),
            reward: { coins: 0, rep: 15, renown: th.sid, renownPts: 3, renownWhy: 'sparing the White Stag', fame: 1 },
          });
          t.offerLabel = 'You look troubled, Father.';
        }
        th.vars.hunters = 0.3;
      },
      live(th, S) {
        // (Seen up close, unharmed: a blessing.)
        const e = S.actorEnt(th, 'stag');
        if (!e) return;
        for (const { p, pid } of S.players()) {
          if (Math.hypot(p.x - e.x, p.z - e.z) > 3 || (th.vars.blessed || []).includes(pid)) continue;
          (th.vars.blessed ||= []).push(pid);
          S.touch(th, pid);
          S.person(pid).fame += 1;
          S.asPid(pid, (pl) => { pl.hp = pl.maxHp; });
          S.tell(pid, 'The White Stag lifts its head and looks at you, a long moment. You feel lighter. (Healed.)', '#e0f0ff');
        }
      },
      day(th, S, rng) {
        const days = (S.now - th.nodeAt) / DAY;
        // The hunters go after it themselves, if nobody stops them.
        th.vars.hunters += th.vars.talked ? -0.2 : 0.12;
        if (days > 2 && th.vars.hunters > 0.5 && rng.chance(0.3)) {
          const got = rng.chance(0.45);
          if (got) return slain(th, S, null);
          S.note(th, `${th.names.hunter || 'The hunters'} went after the White Stag, and came back with nothing but a broken bow and a strange look.`);
          th.vars.hunters = 0.1;
        }
        if (days > 10) {
          for (const t of S.tasksOf(th, 'spare')) S.complete(t, null);
          S.end(th, 'gone', `The White Stag hasn't been seen since ${pick(rng, ['the full moon', 'the first frost', 'the storm'])}. ${pick(rng, ['The children still go looking.', 'Some say it was never there.', 'The town has had a good year since. People say that\'s why.'])}`, { news: [th.sid] });
        }
      },
      fade: 14,
    },
  },
  actorDown(th, a, by) {
    if (a.key === 'stag') th.vars.killedBy = by;
  },
  on: {
    kill(th, ev, S) {
      if (ev.actor !== `${th.id}:stag`) return;
      slain(th, S, ev.by && ev.by.t === 'pl' ? ev.by.pid : null);
    },
  },
  tasks: { hunt: {}, spare: {} },
  townTalk(th, npc, pid, S) {
    if (th.done || !isRec(npc, th.cast.hunter) || th.vars.talked) return [];
    return [{ id: 'sgw2_leave', arg: tid(th), label: 'Leave the stag be. Some things shouldn\'t be hunted.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgw2_leave') return null;
    const rng = S.rng(th, 0x1ea);
    S.touch(th, pid);
    if (persuade(S, npc, rng, 0.3, has(npc.rec, 'stubborn') ? 0.25 : 0)) {
      th.vars.talked = pid;
      for (const t of S.tasksOf(th, 'hunt')) S.closeTask(t, 'void');
      const t = S.tasksOf(th, 'spare')[0];
      if (t) S.complete(t, R.pl(pid));
      S.note(th, `${nameOf(S, R.pl(pid))} talked ${th.names.hunter} out of hunting the White Stag.`, { by: pid, news: [th.sid] });
      return { lines: [pick(rng, ['...My grandmother used to say the same. Fine. Fine! It can keep its head.', 'You\'re right. I saw it at dawn yesterday, and I couldn\'t loose. I don\'t know why.'])] };
    }
    th.vars.hunters += 0.15;
    return { lines: ['It\'s an animal. A valuable one. Out of my way.'] };
  },
});

function slain(th, S, pid) {
  if (th.done) return;
  const L = layoutOf(S, th.sid);
  const rng = S.rng(th, 0x5a1);
  const t = S.tasksOf(th, 'hunt')[0];
  if (pid && t) {
    if (!S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
    S.complete(t, R.pl(pid));
  }
  for (const q of S.tasksOf(th, 'spare')) S.closeTask(q, 'failed');
  if (ITEMS.trophy && pid) S.give(pid, 'trophy', 1);
  // (The devout don't forget; and some say the luck goes with it.)
  if (pid && th.cast.holy) S.townSay(pid, th.sid, -5, false);
  if (L) for (const r of living(L)) if (has(r, 'superstitious') || has(r, 'devout')) r.mood = Math.max(0, (r.mood ?? 0.5) - 0.2);
  S.end(th, 'slain', `The White Stag was killed${pid ? ` by ${nameOf(S, R.pl(pid))}` : ` by ${th.names.hunter || 'the hunters'}`}. ${pick(rng, ['Its hide went to a lord in the city.', 'The antlers hang over the tavern door. Some won\'t walk under them.', 'The children cried.'])}`, { news: [th.sid] });
  if (rng.chance(0.5)) S.split(th, 'ill_luck', { cast: { town: R.town(th.sid) }, sid: th.sid, vars: { cause: 'the White Stag was killed', thing: null } });
}

// ------------------------------------------------------------ a stray
const STRAYS = [
  { k: 'lamb', species: 'sheep', name: 'a lamb', kid: true },
  { k: 'piglet', species: 'pig', name: 'a piglet', kid: true },
  { k: 'hen', species: 'chicken', name: 'a speckled hen', kid: true },
  { k: 'horse', species: 'horse', name: 'a fine horse, saddled, with no rider', kid: false },
];

motif({
  id: 'stray',
  family: 'wonder',
  max: 2,
  key: (o) => `stray:${o.sid}`,
  title: (th) => `The ${th.vars.k[0].toUpperCase()}${th.vars.k.slice(1)} That Wouldn't Leave`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const s = rng.pick(STRAYS);
      const kids = living(L).filter((r) => r.age === 'child' && !r.away);
      const who = s.kid && kids.length ? rng.pick(kids) : someone(L, rng);
      if (!who) continue;
      return { cast: { who: R.rec(L.settlement.id, who.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { k: s.k, species: s.species, name: s.name } };
    }
    return null;
  },
  nodes: {
    followed: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.who);
        if (!L || !r) return S.end(th, 'faded');
        const rng = S.rng(th, 0x5e2);
        const h = r.home !== null && r.home !== undefined ? L.buildings[r.home] : null;
        const at = h && h.outside ? { x: h.outside.x + 1, z: h.outside.z + 1 } : townMid(L.settlement);
        th.vars.at = at;
        S.actor(th, { key: 'stray', kind: 'beast', role: 'stray', species: th.vars.species, hostile: false, at, name: th.vars.k === 'horse' ? 'Riderless Horse' : null, orders: { home: at } });
        // Whose it is, if anyone's.
        th.vars.truth = S.choose(th, [
          { to: 'nobody', w: 1 },
          { to: 'farmer', w: th.vars.k !== 'horse' ? 1 : 0 },
          { to: 'prize', w: th.vars.k === 'piglet' || th.vars.k === 'hen' ? 0.6 : 0.2 },
          { to: 'rider', w: th.vars.k === 'horse' ? 1.5 : 0 },
        ], rng).to;
        const par = (r.parents || []).map((i) => L.npcs[i]).find((q) => q && alive(q));
        if (par) {
          th.cast.parent = R.rec(th.sid, par.idx);
          th.names.parent = fullName(par);
          th.vars.no = nat(par, 'temper') > 0.5 || has(par, 'stingy') || has(par, 'gruff');
        }
        S.note(th, `${th.vars.name[0].toUpperCase()}${th.vars.name.slice(1)} followed ${fullName(r)} home, and won't leave.${par && th.vars.no ? ` ${th.names.parent} says it can't stay.` : ''}`, { news: [th.sid] });
        if (th.vars.truth === 'rider') {
          // (The rider: hurt on the road somewhere.)
          const m = townMid(L.settlement);
          const spot = spotNear(S, m.x, m.z, 60, 120, rng, { clear: 10 });
          if (spot) {
            th.vars.spot = spot;
            const p = makePerson(rng, L.settlement.style || 'vale', rng.chance(0.5) ? 'messenger' : 'merchant');
            th.vars.rider = `${p.name.first} ${p.name.last}`;
            S.actor(th, { key: 'rider', kind: 'npc', role: 'rider', talk: true, at: spot, stay: true, person: { ...p, title: 'Thrown Rider' }, orders: { home: spot, roam: 0, lines: ['Help... over here...', 'My leg...', 'Is anyone there?'], mark: 'talk' } });
            const t = S.post(th, {
              role: 'rider', kind: 'find', title: 'Find the riderless horse\'s rider', sid: th.sid, giver: mayorOf(L) ? R.rec(th.sid, mayorOf(L).idx) : null, at: spot, r: 4,
              pitch: 'A horse like that doesn\'t lose its rider for nothing. Somewhere out on the road, someone\'s hurt. Find them?',
              reward: { coins: 20, from: R.town(th.sid), rep: 10, fame: 1 },
            });
            t.rumour = 'A riderless horse came into town';
          }
        }
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.who);
        if (!L || !r) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        if (th.vars.truth === 'farmer' && days > 1 && !th.vars.claimed) {
          th.vars.claimed = true;
          const f = adults(L).find((q) => q.job === 'farmer' && q !== r);
          th.vars.farmer = f ? fullName(f) : 'a farmer from up the valley';
          th.vars.kind = f ? nat(f, 'kindness') > 0.5 : rng.chance(0.5);
          S.note(th, `${th.vars.farmer} has come asking after a lost ${th.vars.k}. ${th.vars.kind ? `Seeing ${first(r)}'s face, they said it could stay.` : `They took it home, and ${first(r)} cried all night.`}`);
          if (!th.vars.kind) {
            S.dismissActor(th, 'stray');
            return S.end(th, 'claimed', `The ${th.vars.k} went home with ${th.vars.farmer}.`);
          }
          th.vars.no = false;
        }
        if (th.vars.truth === 'prize' && days > 2 && !th.vars.claimed) {
          th.vars.claimed = true;
          S.note(th, `It turns out the ${th.vars.k} is a prize-winner, lost from the fair! There's a reward for it: ¤25.`, { news: [th.sid] });
          r.coins = (r.coins || 0) + 25;
          S.dismissActor(th, 'stray');
          return S.end(th, 'reward', `${fullName(r)} gave the ${th.vars.k} back to its owner and got ¤25 for it. ${pick(rng, ['They\'re going to buy one of their own.', 'They spent it all on sweets.'])}`);
        }
        if (th.vars.no && days > 2 && rng.chance(0.35)) {
          S.dismissActor(th, 'stray');
          return S.end(th, 'sent away', `${th.names.parent || 'The family'} took the ${th.vars.k} out past the fields and left it. ${first(r)} hasn't spoken to them since.`);
        }
        if (days > 6) {
          r.mood = Math.min(1, (r.mood ?? 0.5) + 0.3);
          return S.end(th, 'kept', `The ${th.vars.k} is ${first(r)}'s now. ${pick(rng, ['It follows them to school and waits outside.', 'They\'ve named it something ridiculous.', 'It sleeps at the foot of their bed, which nobody approves of.'])}`, { news: [th.sid] });
        }
      },
      fade: 9,
    },
  },
  tasks: {
    rider: {
      reach(th, t, pid, S) {
        S.complete(t, R.pl(pid));
        S.dismissActor(th, 'rider');
        S.dismissActor(th, 'stray');
        S.end(th, 'rider found', `${nameOf(S, R.pl(pid))} found ${th.vars.rider}, thrown and hurt by the road, and brought them back to their horse.`, { news: [th.sid] });
      },
    },
  },
  townTalk(th, npc, pid, S) {
    if (!th.vars.no || !isRec(npc, th.cast.parent) || th.vars.askedBy === pid) return [];
    return [{ id: 'sgs2_keep', arg: tid(th), label: `Let ${first(recOf(S, th.cast.who))} keep the ${th.vars.k}.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgs2_keep') return null;
    const rng = S.rng(th, 0x6e1);
    th.vars.askedBy = pid;
    S.touch(th, pid);
    if (persuade(S, npc, rng, 0.35, has(npc.rec, 'stingy') ? 0.2 : 0)) {
      th.vars.no = false;
      S.note(th, `${nameOf(S, R.pl(pid))} talked ${th.names.parent} round. The ${th.vars.k} can stay.`, { by: pid });
      return { lines: [pick(rng, ['...Oh, all RIGHT. But they\'re feeding it. Every day.', 'Fine. FINE. Look at their face. How could I say no?'])] };
    }
    return { lines: ['Another mouth to feed? No.'] };
  },
});

// ------------------------------------------------------------ a haunting
motif({
  id: 'haunting',
  family: 'wonder',
  max: 2,
  key: (o) => `haunt:${o.sid}`,
  title: (th, S) => `The Lights in ${th.vars.house}`,
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      // An empty house, or one whose people are gone.
      const used = new Set(L.npcs.filter((r) => alive(r) && !r.migrated).map((r) => r.home));
      const empty = L.buildings.filter((b) => b.residential && !b.underConstruction && !used.has(b.id) && !b.playerHome && b.inside);
      if (!empty.length) continue;
      const b = rng.pick(empty);
      const dead = L.npcs.find((r) => !alive(r) && r.home === b.id);
      return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { bid: b.id, house: b.homeName || (dead ? `the Old ${dead.name.last} House` : 'the Empty House'), dead: dead ? fullName(dead) : null } };
    }
    return null;
  },
  anchors: (th, S) => {
    const L = layoutOf(S, th.sid);
    const b = L && L.buildings[th.vars.bid];
    return b ? [{ x: b.inside.x, z: b.inside.z }] : [];
  },
  nodes: {
    lights: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const b = L && L.buildings[th.vars.bid];
        if (!b) return S.end(th, 'faded');
        const rng = S.rng(th, 0x6a0);
        th.vars.truth = S.choose(th, [
          { to: 'ghost', w: 1 },
          { to: 'squatter', w: 1 },
          { to: 'prank', w: 0.8 },
          { to: 'grief', w: th.vars.dead ? 1 : 0 },
        ], rng).to;
        S.note(th, say(rng, [
          'There are lights in {h} at night, though nobody\'s lived there in years. And noises.',
          'Children dare each other to touch the door of {h}. Something moved behind the shutters last night.',
          'The watch won\'t walk past {h} after dark. They say someone weeps in there.',
        ], { h: th.vars.house }), { news: [th.sid] });
        const m = mayorOf(L);
        const t = S.post(th, {
          role: 'look', kind: 'meet', title: `Find out what's in ${th.vars.house} (by night)`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null, at: { x: b.inside.x, z: b.inside.z }, r: 3,
          pitch: say(rng, ['Half the town won\'t sleep. Go into {h} after dark and see what\'s there. I\'ll not ask you what you saw: just whether it\'s gone.', 'Ghosts, they say. I say rats. Either way, someone has to look, and it won\'t be me.'], { h: th.vars.house }),
          reward: { coins: 15, from: R.town(th.sid), rep: 10, fame: 0.5 },
        });
        t.offerLabel = 'Have you seen the lights?';
      },
      day(th, S) {
        if ((S.now - th.nodeAt) / DAY > 12) S.end(th, 'faded', `The lights in ${th.vars.house} stopped, as suddenly as they started. Nobody knows why.`);
      },
      fade: 14,
    },
  },
  tasks: {
    look: {
      reach(th, t, pid, S) {
        const night = S.game.minute >= 1200 || S.game.minute < 300;
        if (!night) {
          if (!(th.vars.toldDay || []).includes(pid)) {
            (th.vars.toldDay ||= []).push(pid);
            S.tell(pid, 'By day it\'s just an empty house: dust, and a smell of wax. Come back after dark.', '#c8c8c8');
          }
          return;
        }
        if (th.vars.met) return;
        th.vars.met = pid;
        const L = layoutOf(S, th.sid);
        const b = L.buildings[th.vars.bid];
        const rng = S.rng(th, 0x6a1);
        const at = { x: b.inside.x, z: b.inside.z };
        const v = th.vars.truth;
        if (v === 'ghost') {
          S.actor(th, { key: 'ghost', kind: 'beast', role: 'ghost', species: 'wisp', hostile: rng.chance(0.5), night: true, at, name: th.vars.dead ? `The Ghost of ${th.vars.dead}` : 'The Pale Light', orders: { home: at } });
          S.tell(pid, 'The air goes cold. A pale light gathers in the corner, and takes a shape...', '#c8a0ff');
        } else if (v === 'squatter') {
          const p = makePerson(rng, L.settlement.style || 'vale', 'refugee');
          S.actor(th, { key: 'squatter', kind: 'npc', role: 'squatter', talk: true, at, stay: true, person: { ...p, title: 'Squatter' }, orders: { home: at, roam: 1, lines: ['Don\'t tell. Please don\'t tell.', 'I\'ve nowhere else.', '*shivers*'] } });
          S.tell(pid, 'A candle, a blanket, and someone crouched behind them, terrified.', '#c8c8c8');
        } else if (v === 'prank') {
          const kids = living(L).filter((r) => r.age === 'child');
          const names = kids.slice(0, 3).map((r) => r.name.first);
          S.complete(t, R.pl(pid));
          S.end(th, 'prank', `${nameOf(S, R.pl(pid))} went into ${th.vars.house} after dark, and found ${names.length ? names.join(', ') : 'three children'} with a lantern, a sheet and a tin whistle. They have been spoken to.`, { news: [th.sid] });
        } else {
          // Grief: the dead one's kin, keeping vigil.
          const kin = L.npcs.find((r) => alive(r) && r.age !== 'child' && th.vars.dead && r.name.last === th.vars.dead.split(' ').slice(-1)[0]);
          S.complete(t, R.pl(pid));
          S.end(th, 'grief', `${nameOf(S, R.pl(pid))} went into ${th.vars.house} after dark, and found ${kin ? fullName(kin) : 'an old neighbour'} sitting by a candle, talking to ${th.vars.dead}, who isn't there. They come every night. The town leaves them be now.`, { news: [th.sid] });
        }
      },
    },
  },
  actorDown(th, a, by, S) {
    if (a.key !== 'ghost') return;
    const pid = by && by.t === 'pl' ? by.pid : th.vars.met;
    const t = S.tasksOf(th, 'look')[0];
    if (t && pid) S.complete(t, R.pl(pid));
    S.end(th, 'laid', `${nameOf(S, R.pl(pid))} faced what was in ${th.vars.house}, and it's quiet there now.`, { news: [th.sid] });
  },
  hello(th, a) {
    return a.role === 'squatter' ? 'Please. Don\'t call the watch.' : '...';
  },
  talk(th, a) {
    if (a.role !== 'squatter') return [];
    return [
      { id: 'sgh2_stay', arg: tid(th), label: 'I won\'t tell. Stay, until you find somewhere.' },
      { id: 'sgh2_help', arg: tid(th), label: 'Come with me to the mayor. I\'ll speak for you.' },
      { id: 'sgh2_out', arg: tid(th), label: 'You can\'t stay here. Out.' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const t = S.tasksOf(th, 'look')[0];
    const L = layoutOf(S, th.sid);
    if (id === 'sgh2_stay') {
      if (t) S.complete(t, R.pl(pid));
      S.dismissActor(th, 'squatter');
      S.end(th, 'kept secret', `${nameOf(S, R.pl(pid))} went into ${th.vars.house} and told the town it was rats. It wasn't rats.`, { hidden: true, by: pid });
      return { lines: ['...Thank you. Thank you. I\'ll be gone by spring, I swear.'], close: true };
    }
    if (id === 'sgh2_help') {
      if (t) S.complete(t, R.pl(pid));
      const rng = S.rng(th, 0x9a1);
      S.dismissActor(th, 'squatter');
      const kind = L && mayorOf(L) && nat(mayorOf(L), 'kindness') > 0.45;
      S.end(th, kind ? 'taken in' : 'moved on', kind ? `The "ghost" in ${th.vars.house} was a homeless ${pick(rng, ['widow', 'lad', 'old soldier'])}. ${nameOf(S, R.pl(pid))} spoke for them, and the council let them stay.` : `The "ghost" in ${th.vars.house} was someone with nowhere to go. The council moved them on, ${nameOf(S, R.pl(pid))}'s word or no.`, { news: [th.sid] });
      return { lines: [kind ? 'You\'d do that? For me?' : 'They won\'t listen. They never do. But thank you for trying.'], close: true };
    }
    if (id === 'sgh2_out') {
      if (t) S.complete(t, R.pl(pid));
      S.dismissActor(th, 'squatter');
      S.end(th, 'turned out', `${nameOf(S, R.pl(pid))} found someone sleeping rough in ${th.vars.house}, and turned them out into the night.`, { news: [th.sid] });
      return { lines: ['(They gather their blanket and go, without a word.)'], close: true };
    }
    return null;
  },
});

// ------------------------------------------------------------ a shipwreck
motif({
  id: 'shipwreck',
  family: 'wonder',
  max: 1,
  key: (o) => `wreck:${o.sid}`,
  title: (th) => `The Wreck of the ${th.vars.ship}`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      const dock = L.spotsByTag ? L.spotsByTag('fish')[0] : null;
      if (!dock) continue;
      return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { at: { x: dock.x, z: dock.z }, ship: rng.pick(['Merry Gannet', 'Saltwife', 'Morning Bell', 'Dancing Jenny', 'Hope of Tarrow', 'Old Reliable']) } };
    }
    return null;
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    wrecked: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x5b9);
        th.vars.cargo = rng.pick(['wine', 'silk', 'spices', 'iron', 'books', 'gold, they say']);
        th.vars.noble = rng.chance(0.3);
        th.vars.saved = 0;
        S.note(th, `In the night, the ${th.vars.ship} went onto the rocks off ${L.settlement.name}, carrying ${th.vars.cargo}. There are people in the water.`, { news: [th.sid] });
        // The survivors, clinging on along the shore.
        const style = L.settlement.style || 'vale';
        for (let i = 0; i < 3; i++) {
          const p = makePerson(rng, rng.pick([style, 'vale']), i === 0 && th.vars.noble ? 'merchant' : 'refugee');
          const at = { x: th.vars.at.x + rng.int(-8, 8), z: th.vars.at.z + rng.int(-8, 8) };
          S.actor(th, { key: `sv${i}`, kind: 'npc', role: 'survivor', talk: true, at, person: { ...p, title: i === 0 && th.vars.noble ? 'Survivor (well dressed)' : 'Survivor' }, orders: { home: at, roam: 1, mark: 'talk', lines: ['Help!', 'Over here!', '*coughs up seawater*', 'The ship... the ship...'] } });
        }
        const t = S.post(th, {
          role: 'rescue', kind: 'talk', title: `Help the survivors of the ${th.vars.ship} ashore`, sid: th.sid, giver: null,
          pitch: 'There are people on the rocks by the landing. Some of them are still alive.',
          reward: { coins: 0, rep: 10, renown: th.sid, renownPts: 3, renownWhy: 'saving the shipwrecked', fame: 1 },
        });
        t.rumour = `A ship went down off ${L.settlement.name}`;
        // And those who'd sooner have the cargo.
        th.vars.looters = S.choose(th, [{ to: true, w: 0.7 }, { to: false, w: 1 }], rng).to;
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        if (days >= 1 && th.vars.looters && !th.vars.lootNote) {
          th.vars.lootNote = true;
          const who = someone(L, rng, (r) => has(r, 'stingy') || has(r, 'shrewd') || nat(r, 'temper') > 0.6);
          S.note(th, `${who ? fullName(who) : 'Someone from town'} and some others were down on the shore at dawn, hauling the ${th.vars.cargo} off the tide. The ship's owners will want it back.`, { news: [th.sid] });
        }
        if (days >= 2) {
          const saved = th.vars.saved;
          for (const a of th.actors) if (a.role === 'survivor' && !a.gone) S.dismissActor(th, a.key);
          if (th.vars.noble && th.vars.nobleSaved) {
            L.econ.treasury += 50;
            return S.end(th, 'rescued', `Among those pulled from the wreck of the ${th.vars.ship} was a noble of the city, who has sent ¤50 to ${L.settlement.name} in thanks${th.vars.nobleBy ? `, and a letter for ${nameOf(S, R.pl(th.vars.nobleBy))}` : ''}.`, { news: [th.sid] });
          }
          return S.end(th, saved ? 'rescued' : 'lost', saved ? `${saved} were pulled alive from the wreck of the ${th.vars.ship}. The town took them in.` : `Nobody came alive from the wreck of the ${th.vars.ship}. The town buried them on the hill above the sea.`, { news: [th.sid] });
        }
      },
      fade: 4,
    },
  },
  tasks: { rescue: {} },
  hello(th, a, npc) {
    return pick(npc.rng, ['Thank the gods! Help me!', 'Is it over? Is everyone...?', '*coughs*']);
  },
  talk(th, a) {
    if (a.role !== 'survivor' || a.helped) return [];
    return [{ id: 'sgw3_help', arg: `${tid(th)}:${a.key}`, label: 'Take my arm. You\'re safe now.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgw3_help') return null;
    const key = String(arg).split(':')[1];
    const a = S.actorSpec(th, key);
    if (!a || a.helped) return { lines: ['...'] };
    a.helped = true;
    th.vars.saved++;
    S.touch(th, pid);
    S.person(pid).fame += 0.5;
    const t = S.tasksOf(th, 'rescue')[0];
    if (t && th.vars.saved >= 2) S.complete(t, R.pl(pid));
    if (key === 'sv0' && th.vars.noble) {
      th.vars.nobleSaved = true;
      th.vars.nobleBy = pid;
    }
    S.dismissActor(th, key);
    return { lines: [key === 'sv0' && th.vars.noble ? 'You... you have the thanks of my house. You\'ll hear from us.' : pick(S.rng(th, 3), ['Thank you. Oh, thank you.', 'I thought I was going to die out there.', 'My things... never mind my things. I\'m alive.'])], close: true };
  },
});

// ------------------------------------------------------------ the well runs dry
motif({
  id: 'dry_well',
  family: 'wonder',
  max: 2,
  key: (o) => `well:${o.sid}`,
  title: (th, S) => `The Well of ${townName(S, th.sid)} Runs Dry`,
  scan(S, rng) {
    if (!rng.chance(0.04)) return null;
    const L = rng.pick(laidTowns(S));
    if (!L || adults(L).length < 6) return null;
    return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id };
  },
  nodes: {
    dry: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xd4e);
        th.vars.why = S.choose(th, [{ to: 'drought', w: 1 }, { to: 'diverted', w: 0.7 }, { to: 'collapse', w: 0.5 }, { to: 'nothing', w: 0.4 }], rng).to;
        S.note(th, `The well of ${L.settlement.name} has run dry. Folk are carrying water from the stream in buckets.`, { news: [th.sid] });
        if (th.vars.why === 'diverted') {
          const ppl = adults(L).filter((r) => has(r, 'stingy') || has(r, 'shrewd') || nat(r, 'temper') > 0.6);
          const cul = pick(rng, ppl) || someone(L, rng);
          if (cul) {
            th.cast.culprit = R.rec(th.sid, cul.idx);
            th.names.culprit = fullName(cul);
          }
        }
        const m = mayorOf(L);
        const t = S.post(th, {
          role: 'water', kind: 'talk', title: `Find out why ${L.settlement.name}'s well ran dry`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null,
          pitch: 'Forty years that well\'s never failed. Now it\'s dust. Ask about. Someone knows something, or the old folk remember something.',
          reward: { coins: 20, from: R.town(th.sid), rep: 12, renown: th.sid, renownPts: 3, renownWhy: 'bringing back the water', fame: 1 },
        });
        t.offerLabel = 'Is it true about the well?';
        th.vars.thirst = 0;
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        th.vars.thirst++;
        if (th.vars.thirst === 3) S.note(th, `Tempers are short in ${L.settlement.name}: queues at the stream, and fights in the queues.`);
        // (The dowser comes, if nobody's sorted it.)
        if (th.vars.thirst >= 5 && rng.chance(0.4)) {
          if (th.vars.why === 'diverted' && th.cast.culprit) {
            S.note(th, `An old dowser followed the dry channel up the hill and found the stream turned aside: ${th.names.culprit}'s doing, to water their own fields.`, { news: [th.sid] });
            return culpritFound(th, S, null, rng);
          }
          if (th.vars.why === 'collapse' || th.vars.why === 'drought') {
            L.econ.treasury = Math.max(0, L.econ.treasury - 30);
            return S.end(th, 'new well', `A dowser walked ${L.settlement.name} with a hazel twig and found water by the ${pick(rng, ['mill', 'chapel', 'old oak'])}. The new well cost ¤30, and it's sweet.`, { news: [th.sid] });
          }
          return S.end(th, 'came back', `The well of ${L.settlement.name} filled again in the night, all by itself. Nobody can say why. The priest says thank you to someone.`, { news: [th.sid] });
        }
      },
      fade: 12,
    },
  },
  tasks: { water: {} },
  townTalk(th, npc, pid, S) {
    if (th.done || !npc.rec || npc.rec.sid !== th.sid || npc.rec.age === 'child') return [];
    const out = [];
    if (npc.rec.age === 'elder' && !(th.vars.oldTold || []).includes(pid)) out.push({ id: 'sgd2_old', arg: tid(th), label: 'Has the well ever run dry before?' });
    if (th.vars.why === 'diverted' && th.vars.clue && isRec(npc, th.cast.culprit)) out.push({ id: 'sgd2_accuse', arg: tid(th), label: 'You turned the stream. Turn it back.' });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x0d2);
    const t = S.tasksOf(th, 'water')[0];
    if (id === 'sgd2_old') {
      (th.vars.oldTold ||= []).push(pid);
      S.touch(th, pid);
      if (th.vars.why === 'diverted') {
        th.vars.clue = true;
        return { lines: [`Never. It's fed from the stream on the hill. If it's dry, something's turned the stream. Or someone. ${th.names.culprit ? `${th.names.culprit} has been digging ditches up there, I hear.` : ''}`] };
      }
      if (th.vars.why === 'collapse') {
        if (t) S.complete(t, R.pl(pid));
        S.end(th, 'new well', `An old one of ${townName(S, th.sid)} told ${nameOf(S, R.pl(pid))} where the old well was, before this one: they dug it out, and there was water in it still.`, { news: [th.sid] });
        return { lines: ['Ah! There\'s an older well, you know. Under the flagstones by the chapel. My grandfather filled it in. Dig it out.'] };
      }
      return { lines: [pick(rng, ['Once, in the drought year. It came back with the rain. Pray for rain.', 'Not in my lifetime. Something\'s wrong.'])] };
    }
    if (id === 'sgd2_accuse') {
      S.touch(th, pid);
      if (persuade(S, npc, rng, 0.35, nat(npc.rec, 'temper') * 0.3)) {
        culpritFound(th, S, pid, rng);
        return { lines: [pick(rng, ['...Fine. FINE. My fields were dying. But fine.', 'Who told you? ...It doesn\'t matter. I\'ll open the channel.'])] };
      }
      repWith(S, layoutOf(S, th.sid), npc.rec, -10);
      return { lines: ['Prove it.'] };
    }
    return null;
  },
});

function culpritFound(th, S, pid, rng) {
  const t = S.tasksOf(th, 'water')[0];
  if (t && pid) S.complete(t, R.pl(pid));
  const L = layoutOf(S, th.sid);
  const c = recOf(S, th.cast.culprit);
  const m = L && mayorOf(L);
  S.end(th, 'stream turned back', `${th.names.culprit} had turned the stream to water their own fields. It runs to the well again${pid ? `, thanks to ${nameOf(S, R.pl(pid))}` : ''}.`, { news: [th.sid] });
  // (Not everyone forgives.)
  if (c && m && rng.chance(0.4) && c.name.last !== m.name.last) S.split(th, 'feud', { cast: { a: R.rec(th.sid, m.idx), b: th.cast.culprit, town: R.town(th.sid) }, sid: th.sid, vars: { why: 'the stream', fa: m.name.last, fb: c.name.last, step: 0 } });
}

// ------------------------------------------------------------ a falling star
motif({
  id: 'falling_star',
  family: 'wonder',
  max: 1,
  key: () => 'star',
  title: () => 'The Star That Fell',
  scan(S, rng) {
    if (!rng.chance(0.02)) return null;
    const L = rng.pick(laidTowns(S));
    if (!L) return null;
    const m = townMid(L.settlement);
    const at = spotNear(S, m.x, m.z, 90, 160, rng, { clear: 14 });
    if (!at) return null;
    return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, spots: [at], vars: { at } };
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    fallen: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x57f);
        S.note(th, `A light fell from the sky over ${L.settlement.name} last night, and came down in the hills with a sound like thunder. Something's out there, still smoking.`, { news: [th.sid] });
        // Who wants it.
        const ppl = adults(L);
        const scholar = ppl.find((r) => ['researcher', 'scholar'].includes(r.job));
        const priest = ppl.find((r) => r.job === 'priest');
        th.vars.racers = [];
        if (scholar) th.vars.racers.push({ who: fullName(scholar), why: 'to study it', idx: scholar.idx });
        if (priest) th.vars.racers.push({ who: fullName(priest), why: 'to bless it, or bury it', idx: priest.idx });
        th.vars.racers.push({ who: 'treasure-hunters from the city', why: 'to sell it' });
        const t = S.post(th, {
          role: 'star', kind: 'find', title: 'Find what fell from the sky', sid: th.sid, giver: null, at: th.vars.at, r: 3,
          pitch: 'Something came down in the hills. Everyone\'s talking of going to look. Whoever gets there first...',
          reward: { coins: 0, fame: 1 },
        });
        t.rumour = `A star fell near ${L.settlement.name}`;
        S.actor(th, { key: 'glow', kind: 'beast', role: 'glow', species: 'wisp', hostile: false, at: th.vars.at, name: 'Starfire', orders: { home: th.vars.at } });
        void rng;
      },
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY < 2) return;
        // (Someone else got there.)
        S.dismissActor(th, 'glow');
        const r = pick(rng, th.vars.racers);
        S.end(th, 'taken', `${r.who[0].toUpperCase()}${r.who.slice(1)} reached the fallen star first, and took it, ${r.why}. ${pick(rng, ['Nobody has seen it since.', 'They say it still glows at night.', 'It was smaller than everyone hoped.'])}`, { news: [th.sid] });
      },
      fade: 4,
    },
  },
  tasks: {
    star: {
      reach(th, t, pid, S) {
        const rng = S.rng(th, 0x57e);
        S.complete(t, R.pl(pid));
        S.dismissActor(th, 'glow');
        const what = S.choose(th, [{ to: 'shard', w: 1 }, { to: 'core', w: 0.3 }, { to: 'rock', w: 0.6 }], rng).to;
        if (what === 'shard' && ITEMS.relic_shard) S.give(pid, 'relic_shard', 1);
        if (what === 'core' && ITEMS.kav_core) S.give(pid, 'kav_core', 1);
        if (what === 'rock') S.give(pid, 'gem', rng.int(1, 3));
        S.tell(pid, what === 'rock' ? 'In a crater of glassy earth: a black rock, still warm, studded with stones that catch the light.' : 'In a crater of glassy earth: something that hums. It\'s still warm.', '#e0f0ff');
        S.end(th, 'found', `${nameOf(S, R.pl(pid))} reached the fallen star first.`, { news: [th.sid] });
      },
    },
  },
});

// ------------------------------------------------------------ the great fish
const FISH_NAMES = ['Old Whiskers', 'the Grandmother', 'Iron Jaw', 'the Mayor of the Lake', 'Big Bertha', 'the Silver Ghost'];

motif({
  id: 'great_fish',
  family: 'wonder',
  max: 1,
  key: () => 'bigfish',
  title: (th, S) => `${th.vars.fish} of ${townName(S, th.sid)}`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 4)) {
      const dock = L.spotsByTag ? L.spotsByTag('fish')[0] : null;
      if (!dock) continue;
      return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { fish: rng.pick(FISH_NAMES), at: { x: dock.x, z: dock.z } } };
    }
    return null;
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    legend: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xf15);
        const old = adults(L).find((r) => r.job === 'fisher' && r.age === 'elder') || adults(L).find((r) => r.job === 'fisher') || someone(L, rng);
        if (old) {
          th.cast.old = R.rec(th.sid, old.idx);
          th.names.old = fullName(old);
        }
        S.note(th, `${th.vars.fish} has been seen again off ${L.settlement.name}: a fish as long as a boat, older than anyone living. ${old ? `${fullName(old)} has lost forty years of lines to it.` : ''}`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'catch', kind: 'talk', title: `Land ${th.vars.fish}`, sid: th.sid, giver: th.cast.old || null,
          pitch: say(rng, ['Forty years I\'ve tried. Forty years! If anyone lands {f}, I want to see it before I die. A big one, off the landing here. Take your best rod.', 'They say whoever lands {f} will never want for luck. I say they\'ll never want for drinks, either. Off the landing: a big one.'], { f: th.vars.fish }),
          reward: { coins: 30, from: th.cast.old || R.town(th.sid), rep: 15, renown: th.sid, renownPts: 4, renownWhy: `landing ${th.vars.fish}`, fame: 2 },
        });
        t.offerLabel = 'Any luck on the water?';
      },
      on: {
        fish_caught(th, ev, S) {
          if (!ev.big || Math.max(Math.abs(ev.x - th.vars.at.x), Math.abs(ev.z - th.vars.at.z)) > 40) return;
          const rng = S.rng(th, 0xf16);
          // (Not every big one is the one.)
          if (!rng.chance(0.4)) {
            S.tell(ev.pid, `A big one! ...But not ${th.vars.fish}. ${th.names.old || 'The old fishers'} would know. Keep trying.`, '#a0e0ff');
            return;
          }
          const t = S.tasksOf(th, 'catch')[0];
          if (t) {
            if (!S.claimedBy(t, ev.pid)) S.accept(t, R.pl(ev.pid));
            S.complete(t, R.pl(ev.pid));
          }
          const k = S.person(ev.pid);
          const title = `Who Landed ${th.vars.fish}`;
          if (!k.titles.includes(title)) k.titles.push(title);
          S.tell(ev.pid, `It fights like nothing you've ever hooked... and then it's on the boards, gasping, enormous: ${th.vars.fish}!`, '#ffe070');
          S.end(th, 'landed', `${nameOf(S, R.pl(ev.pid))} landed ${th.vars.fish} off ${townName(S, th.sid)}. ${th.names.old ? `${th.names.old} wept.` : 'The whole town came down to see.'} ${pick(rng, ['They let it go again, after.', 'It fed half the town.', 'Its head hangs in the tavern now.'])}`, { news: [th.sid] });
        },
      },
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY > 16) {
          // (Or someone else does, in time.)
          if (rng.chance(0.3) && th.names.old) return S.end(th, 'landed', `${th.names.old} landed ${th.vars.fish} at last, after forty years, and then let it go. "We've both earned some rest," they said.`, { news: [th.sid] });
          S.end(th, 'still out there', `${th.vars.fish} hasn't been seen this season. It's out there, though. It's always out there.`);
        }
      },
      fade: 20,
    },
  },
  tasks: { catch: {} },
});

// ------------------------------------------------------------ the pig chase
motif({
  id: 'pig_chase',
  family: 'wonder',
  max: 2,
  key: (o) => `pig:${o.sid}`,
  title: (th, S) => `The Great ${th.vars.beast[0].toUpperCase()}${th.vars.beast.slice(1)} Chase of ${townName(S, th.sid)}`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const owner = adults(L).find((r) => ['farmer', 'handler', 'cook', 'baker'].includes(r.job));
      if (!owner) continue;
      const k = rng.pick([['pig', 'pig'], ['goat', 'sheep'], ['hen', 'chicken'], ['cow', 'cow']]);
      return { cast: { owner: R.rec(L.settlement.id, owner.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { beast: k[0], species: k[1], name: rng.pick(['Duchess', 'Barnaby', 'Lady Truffle', 'Sir Hamsworth', 'Mabel', 'the Bishop', 'Old Nick']) } };
    }
    return null;
  },
  anchors: (th, S) => {
    const L = layoutOf(S, th.sid);
    return L ? [townMid(L.settlement)] : [];
  },
  nodes: {
    loose: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const m = townMid(L.settlement);
        S.actor(th, { key: 'beast', kind: 'beast', role: 'loose', species: th.vars.species, hostile: false, at: m, name: th.vars.name, orders: { home: m } });
        S.note(th, `${th.vars.name}, ${th.names.owner}'s prize ${th.vars.beast}, has got loose in ${L.settlement.name}'s market, and is eating everything.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'catch', kind: 'talk', title: `Catch ${th.vars.name} the ${th.vars.beast}`, sid: th.sid, giver: th.cast.owner,
          pitch: say(S.rng(th, 4), ['{n}! My {b}! In the market! Catch them, don\'t hurt them, and there\'s ¤10 in it. And my eternal gratitude.', 'Have you SEEN {n}? Everyone has. That\'s the problem. Grab them for me? Gently!'], { n: th.vars.name, b: th.vars.beast }),
          reward: { coins: 10, from: th.cast.owner, rep: 10, fame: 0.5 },
        });
        t.offerLabel = 'What\'s all the shouting?';
      },
      live(th, S) {
        const e = S.actorEnt(th, 'beast');
        if (!e) return;
        for (const { p, pid } of S.players()) {
          if (Math.hypot(p.x - e.x, p.z - e.z) > 1.4) continue;
          const t = S.tasksOf(th, 'catch')[0];
          if (t && !S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
          if (t) S.complete(t, R.pl(pid));
          S.dismissActor(th, 'beast');
          S.tell(pid, `You grab ${th.vars.name}! There is a lot of squealing. Some of it is you.`, '#a0ffa0');
          return S.end(th, 'caught', `${nameOf(S, R.pl(pid))} caught ${th.vars.name} the ${th.vars.beast}, after a chase through three gardens and the tavern.`, { news: [th.sid] });
        }
      },
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY >= 1) {
          S.dismissActor(th, 'beast');
          const home = rng.chance(0.7);
          S.end(th, home ? 'came home' : 'gone', home ? `${th.vars.name} came home on their own at suppertime, very full, and went to sleep.` : `${th.vars.name} was last seen heading for the hills. ${th.names.owner} is inconsolable.`);
        }
      },
      fade: 2,
    },
  },
  actorDown(th, a, by, S) {
    if (a.key !== 'beast') return;
    const pid = by && by.t === 'pl' ? by.pid : null;
    if (pid) S.townSay(pid, th.sid, -3, false);
    const r = recOf(S, th.cast.owner);
    if (r && pid) repWith(S, layoutOf(S, th.sid), r, -25);
    S.end(th, 'killed', `${th.vars.name} the ${th.vars.beast} was killed${pid ? ` by ${nameOf(S, R.pl(pid))}` : ''}. "I said GENTLY," says ${th.names.owner}.`, { news: [th.sid] });
  },
  tasks: { catch: {} },
});

// ------------------------------------------------------------ the swarm
motif({
  id: 'swarm',
  family: 'wonder',
  max: 2,
  key: (o) => `swarm:${o.sid}`,
  title: (th, S) => `Bees in ${townName(S, th.sid)}`,
  scan(S, rng) {
    if (!rng.chance(0.04)) return null;
    const L = rng.pick(laidTowns(S));
    if (!L) return null;
    const m = mayorOf(L);
    const where = rng.pick([m ? `${fullName(m)}'s chimney` : 'the council chimney', 'the temple bell-tower', 'the tavern\'s cellar', 'the schoolroom roof']);
    return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { where } };
  },
  nodes: {
    swarmed: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xbee);
        const keeper = adults(L).find((r) => has(r, 'kind') && nat(r, 'bravery') > 0.5) || someone(L, rng);
        S.note(th, `A swarm of bees has moved into ${th.vars.where}. Nobody can get near it.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'smoke', kind: 'fetch', title: 'Bring peat or herbs to smoke the bees out (3)', sid: th.sid, giver: keeper ? R.rec(th.sid, keeper.idx) : null, item: ITEMS.peat_turf ? 'peat_turf' : 'herb', n: 3,
          pitch: say(rng, ['Smoke makes them sleepy. A bit of smouldering peat and I can move them to a proper hive. Three turves, if you can find them.', 'Don\'t kill them! Bees are luck. Smoke them out: bring me something that smoulders, three of it.'], {}),
          reward: { coins: 6, rep: 10, items: ITEMS.honey ? [['honey', 2]] : [], fame: 0.5 },
        });
        t.offerLabel = 'Why is everyone running?';
      },
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY > 3) {
          const L = layoutOf(S, th.sid);
          const flew = rng.chance(0.5);
          S.end(th, flew ? 'flew off' : 'stayed', flew ? `The bees left ${th.vars.where} on their own, one warm morning, and went over the hill.` : `The bees are still in ${th.vars.where}. ${L ? 'Everyone has got used to it. The honey is excellent.' : ''}`);
        }
      },
      fade: 5,
    },
  },
  tasks: {
    smoke: {
      done(th, t, by, S) {
        S.end(th, 'hived', `${nameOf(S, by)} helped smoke the bees out of ${th.vars.where}, into a proper hive. ${townName(S, th.sid)} has honey now.`, { news: [th.sid] });
      },
      thanks: () => ['Sleepy little things. There. Have some honey, for your trouble.'],
    },
  },
});

// ------------------------------------------------------------ ill luck
motif({
  id: 'ill_luck',
  family: 'wonder',
  max: 2,
  key: (o) => `ill:${o.sid}`,
  title: (th, S) => `Ill Luck in ${townName(S, th.sid)}`,
  nodes: {
    luckless: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x111);
        th.vars.real = rng.chance(0.5);
        th.vars.n = 0;
        S.note(th, `Since ${th.vars.cause}, everything's gone wrong in ${L.settlement.name}: ${pick(rng, ['milk souring', 'the mill wheel cracked', 'a run of stillbirths in the byres', 'dogs howling all night'])}. People are saying it's a curse.`, { news: [th.sid] });
        const priest = adults(L).find((r) => r.job === 'priest') || adults(L).find((r) => has(r, 'devout'));
        if (priest) {
          th.cast.priest = R.rec(th.sid, priest.idx);
          const t = S.post(th, {
            role: 'lift', kind: 'fetch', title: 'Bring prayer beads for a blessing on the town', sid: th.sid, giver: th.cast.priest, item: ITEMS.prayer_beads ? 'prayer_beads' : 'herb', n: 1,
            pitch: 'Curse or no curse, people need to believe it\'s lifted. A blessing, with proper beads: mine broke last week, which isn\'t helping.',
            reward: { coins: 5, rep: 12, fame: 0.5 },
          });
          t.offerLabel = 'Is it true, Father? Are we cursed?';
        }
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        th.vars.n++;
        if (th.vars.real && rng.chance(0.3)) {
          L.econ.treasury = Math.max(0, L.econ.treasury - 8);
          S.note(th, pick(rng, ['A barn roof fell in. Nobody was under it, this time.', 'The fishing boats came back empty, three days running.', 'A chimney fire. Then another.']));
        }
        if (th.vars.n > 7) S.end(th, th.vars.real ? 'endured' : 'passed', th.vars.real ? `The run of bad luck in ${L.settlement.name} ended as it began: for no reason anyone could see.` : `It turns out nothing was cursed: a bad week, and a lot of talk. ${pick(rng, ['People feel foolish now.', 'Some still touch wood.'])}`);
      },
      fade: 10,
    },
  },
  tasks: {
    lift: {
      done(th, t, by, S) {
        S.end(th, 'lifted', `The priest blessed the town with ${nameOf(S, by)}'s beads, and folk say the luck has turned. ${th.vars.real ? 'It has.' : 'It may never have been gone.'}`, { news: [th.sid] });
      },
    },
  },
});

