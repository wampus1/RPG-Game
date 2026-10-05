// Crime in the towns (round 52).
//
//   - A murder: someone's found dead, and nobody saw who did it. The
//     victim's kin (or the mayor) want it solved: ask about town (those who
//     saw something each remember one thing), then name the killer to the
//     watch. Name the wrong one and an innocent is shamed (and the real one
//     kills again); take too long and they run off to the outlaws.
//   - A thief in the night: things going missing from the market. Keep
//     watch on the square after dark and catch them at it; then turn them
//     in, or take a cut to look the other way.
//   - Smuggling: a shady sort wants a bundle carried past the watch into a
//     town where it's banned, or taxed to the bone.
import { motif, R, nameOf } from '../core.js';
import { pick, layoutOf, laidTowns, townName, adults, fullName, kinOf, recOf, hairWord } from './lib.js';
import {} from '../actors.js';
import { mayorOf, alive, DAY } from '../../econ.js';
import { countItem, removeItem } from '../../../game/inventory.js';
import { lawOn } from '../../laws.js';

const tid = (th) => `t${th.id}`;
const hairOf = (r) => hairWord(r);

// ------------------------------------------------------------ a murder
motif({
  id: 'murder',
  family: 'crime',
  max: 2,
  key: (o) => `murder:${o.sid}`,
  title: (th, S) => `Who Killed ${th.names.victim}?`,
  scan(S, rng) {
    if (!rng.chance(0.035)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const ppl = adults(L).filter((r) => r.job !== 'mayor' && r.job !== 'guard');
      const killers = ppl.filter((r) => r.life && (r.life.vice === 'brawler' || r.life.vice === 'thief'));
      if (!killers.length || ppl.length < 8) continue;
      const k = rng.pick(killers);
      const v = rng.pick(ppl.filter((r) => r !== k && r.household !== k.household));
      if (!v) continue;
      return { cast: { victim: R.rec(L.settlement.id, v.idx), killer: R.rec(L.settlement.id, k.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id };
    }
    return null;
  },
  nodes: {
    found: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const v = recOf(S, th.cast.victim);
        const k = recOf(S, th.cast.killer);
        if (!L || !v || !k) return S.end(th, 'faded');
        const rng = S.rng(th, 0x3d0);
        const where = pick(rng, ['behind the tavern', 'in the alley by the smithy', 'face down in the well yard', 'in their own doorway', 'by the stables']);
        S.sim.recordDeath(L, v, 'murdered', null);
        th.vars.where = where;
        // Who saw something: each remembers one thing about the killer.
        const clues = [
          `someone with ${hairOf(k)} hair hurrying off that way`,
          `a ${k.job === 'laborer' ? 'labourer' : JOB_WORD[k.job] || k.job} by the look of their clothes`,
          `${k.name.first[0]}... something. ${k.name.first[0]}-something, that's what they shouted`,
          `that ${k.name.first} and ${v.name.first} had words the day before`,
        ];
        const wits = rng.shuffle(adults(L).filter((r) => r !== k && r !== v)).slice(0, 4);
        th.vars.wits = wits.map((r, i) => ({ idx: r.idx, clue: clues[i % clues.length], told: [] }));
        // Three to choose from, the killer among them.
        const sus = rng.shuffle([k, ...rng.shuffle(adults(L).filter((r) => r !== k && r !== v && r.job !== 'mayor')).slice(0, 2)]);
        th.vars.suspects = sus.map((r) => r.idx);
        th.vars.asked = {};
        const kin = kinOf(L, v)[0] || mayorOf(L);
        th.cast.asker = kin ? R.rec(th.sid, kin.idx) : null;
        S.note(th, `${fullName(v)} was found dead ${where}. Nobody saw who did it.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'solve', kind: 'investigate', title: `Find out who killed ${v.name.first} ${v.name.last}`, sid: th.sid, giver: th.cast.asker,
          pitch: `${v.name.first} was found ${where}. Murdered. The watch shrugs. Someone in this town knows something: ask around, and when you know who it was, tell the watch.`,
          reward: { coins: 25, from: th.cast.asker || R.town(th.sid), rep: 12, renown: th.sid, renownPts: 4, renownWhy: 'finding a murderer', fame: 2 },
        });
        t.rumour = `Someone murdered ${fullName(v)}`;
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const k = recOf(S, th.cast.killer);
        if (!L || !k || !alive(k)) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        // Unfound: they strike again, or run.
        if (days > 2 && rng.chance(0.25)) {
          if (rng.chance(0.5) && S.sim.bandits) {
            S.sim.bandits.recruit(k, L, S.day, rng);
            k.migrated = true;
            k.away = true;
            const t = S.tasksOf(th, 'solve')[0];
            if (t) S.closeTask(t, 'failed');
            return S.end(th, 'fled', `${fullName(k)} vanished from ${L.settlement.name} in the night. They say ${fullName(k)} has gone to the outlaws, and that it was them who killed ${th.names.victim}.`, { news: [th.sid] });
          }
          const v2 = rng.pick(adults(L).filter((r) => r !== k && r.job !== 'mayor'));
          if (v2) {
            S.sim.recordDeath(L, v2, 'murdered', null);
            S.note(th, `Another body: ${fullName(v2)}. The town is afraid.`, { news: [th.sid] });
          }
        }
      },
      fade: 12,
    },
  },
  tasks: { solve: {} },
  townTalk(th, npc, pid, S) {
    if (npc.rec.sid !== th.sid || th.done) return [];
    const out = [];
    const w = th.vars.wits.find((q) => q.idx === npc.rec.idx);
    if (w && !w.told.includes(pid)) out.push({ id: 'sgd_ask', arg: tid(th), label: `About ${th.names.victim}'s murder: did you see anything?` });
    if (npc.rec.job === 'guard' && Object.keys(th.vars.asked[pid] || {}).length >= 1) out.push({ id: 'sgd_name', arg: tid(th), label: `I know who killed ${th.names.victim}.` });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const L = layoutOf(S, th.sid);
    switch (id) {
      case 'sgd_ask': {
        const w = th.vars.wits.find((q) => q.idx === npc.rec.idx);
        if (!w) return { lines: ['I didn\'t see anything.'] };
        w.told.push(pid);
        (th.vars.asked[pid] ||= {})[w.idx] = true;
        S.touch(th, pid);
        const t = S.tasksOf(th, 'solve')[0];
        if (t && !S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
        return { lines: [`I... I did see something. ${w.clue[0].toUpperCase()}${w.clue.slice(1)}. That's all.`, '(Ask others. When you\'re sure, tell the watch.)'] };
      }
      case 'sgd_name': {
        const choices = th.vars.suspects.map((i) => L && L.npcs[i]).filter(Boolean).map((r) => ({ id: 'sgd_accuse', arg: `${tid(th)}:${r.idx}`, label: `It was ${fullName(r)}.` }));
        return { lines: ['Go on, then. Who?'], choices, back: 'I\'m not sure yet.' };
      }
      case 'sgd_accuse': {
        const idx = +String(arg).split(':')[1];
        const r = L && L.npcs[idx];
        const k = recOf(S, th.cast.killer);
        const t = S.tasksOf(th, 'solve')[0];
        if (!r || !k) return { lines: ['Who?'] };
        if (r === k) {
          if (t) S.complete(t, R.pl(pid));
          if (S.sim.society && S.sim.society.exile) S.sim.society.exile(L, k, S.day, S.rng(th, 0xe1), `murdering ${th.names.victim}`);
          S.end(th, 'solved', `${nameOf(S, R.pl(pid))} named ${fullName(k)} as ${th.names.victim}'s killer. Faced with it, ${k.name.first} confessed, and was driven out of ${L.settlement.name}.`, { news: [th.sid] });
          return { lines: [`${fullName(k)}? ...We'll see.`, `(Later: ${k.name.first} confessed.)`] };
        }
        S.sim.changeRep(npc, -8);
        if (r.ent && !r.ent.dead) S.sim.changeRep(r.ent, -30);
        S.note(th, `${nameOf(S, R.pl(pid))} accused ${fullName(r)} of the murder. ${r.name.first} had been at home all night, and half the street can swear to it.`, { news: [th.sid] });
        th.vars.wrong = (th.vars.wrong || 0) + 1;
        return { lines: [`${fullName(r)}? They were at home with their family all night. Half the street can say so.`, 'Think harder before you go accusing people.'] };
      }
      default:
        return null;
    }
  },
});
const JOB_WORD = { farmer: 'farmer', miner: 'miner', fisher: 'fisher', blacksmith: 'smith', baker: 'baker', tailor: 'tailor', carpenter: 'carpenter', lumberjack: 'woodcutter', trapper: 'trapper', merchant: 'merchant', herbalist: 'herbalist', cook: 'cook', priest: 'priest', scholar: 'scholar', barkeep: 'tavern keeper', innkeeper: 'innkeeper' };

// ------------------------------------------------------------ a thief in the night
motif({
  id: 'thief',
  family: 'crime',
  max: 2,
  key: (o) => `thief:${o.sid}`,
  title: (th, S) => `The Night Thief of ${townName(S, th.sid)}`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const thieves = adults(L).filter((r) => r.life && r.life.vice === 'thief');
      if (!thieves.length || (L.econ.recent && (L.econ.recent.thefts || 0) < 1 && !rng.chance(0.3))) continue;
      return { cast: { thief: R.rec(L.settlement.id, rng.pick(thieves).idx), town: R.town(L.settlement.id) }, sid: L.settlement.id };
    }
    return null;
  },
  nodes: {
    prowling: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const g = L && L.npcs.find((r) => alive(r) && r.job === 'guard');
        if (!L) return S.end(th, 'faded');
        S.note(th, `Things keep going missing from the stalls of ${L.settlement.name} at night.`, { news: [th.sid] });
        const t = S.post(th, {
          role: 'watch', kind: 'meet', title: `Catch the night thief of ${L.settlement.name}`, sid: th.sid, giver: g ? R.rec(th.sid, g.idx) : null,
          at: { x: L.plaza.cx, z: L.plaza.cz }, r: 6,
          pitch: 'Every night something else is gone from the market. We\'re stretched thin. Keep watch on the square after dark, and catch whoever it is.',
          reward: { coins: 20, from: R.town(th.sid), rep: 8, renown: th.sid, renownPts: 2, renownWhy: 'catching a thief' },
        });
        t.rumour = 'There\'s a thief working the market at night';
      },
      // After dark, someone on watch in the square: the thief comes.
      live(th, S) {
        const t = S.tasksOf(th, 'watch')[0];
        if (!t) return;
        const night = S.game.minute >= 1290 || S.game.minute < 270;
        const watchers = S.players().filter(({ p, pid }) => S.claimedBy(t, pid) && Math.max(Math.abs(p.x - t.at.x), Math.abs(p.z - t.at.z)) <= 12);
        if (!night || !watchers.length || S.actorSpec(th, 'thief')) return;
        const k = recOf(S, th.cast.thief);
        if (!k) return;
        th.vars.watcher = watchers[0].pid;
        const at = { x: t.at.x + 6, z: t.at.z + 3 };
        S.actor(th, {
          key: 'thief', kind: 'npc', role: 'thief', talk: true, at,
          person: { name: k.name, look: { ...k.look, hat: 'hood' }, personality: k.personality, traits: k.traits, age: 'adult', job: k.job, maxHp: k.maxHp || 20, title: 'Hooded Figure' },
          orders: { home: { x: t.at.x - 2, z: t.at.z }, roam: 1, lines: ['...'], mark: 'talk' },
        });
      },
      day(th, S) {
        if (S.now - th.nodeAt > 6 * DAY) S.end(th, 'faded', 'The thefts stopped as suddenly as they started.');
      },
    },
  },
  tasks: { watch: {} },
  hello(th, a, npc, pid) {
    return `!! ...Oh. It's you. Look, I can explain.`;
  },
  talk(th, a, npc, pid) {
    return [
      { id: 'sgt_turn', arg: tid(th), label: `I know you, ${th.names.thief.split(' ')[0]}. You're coming with me to the watch.` },
      { id: 'sgt_cut', arg: tid(th), label: 'Half of what you took, and I never saw you.' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const L = layoutOf(S, th.sid);
    const k = recOf(S, th.cast.thief);
    const t = S.tasksOf(th, 'watch')[0];
    if (id === 'sgt_turn') {
      if (t) S.complete(t, R.pl(pid));
      S.dismissActor(th, 'thief');
      if (k && L && S.sim.society && S.sim.society.exile && (k.life?.crimes || 0) >= 1) S.sim.society.exile(L, k, S.day, S.rng(th, 0x7e), 'thieving');
      else if (k) (k.life ||= {}).crimes = (k.life.crimes || 0) + 1;
      S.end(th, 'caught', `${nameOf(S, R.pl(pid))} caught ${th.names.thief} stealing from the market at night.`, { news: [th.sid] });
      return { lines: ['...Fine. It was only ever little things. Only ever little things.'], close: true };
    }
    if (id === 'sgt_cut') {
      const cut = 15 + S.rng(th, 9).int(0, 15);
      S.give(pid, 'coin', cut);
      S.person(pid).under += 2;
      if (t) S.closeTask(t, 'failed');
      S.dismissActor(th, 'thief');
      S.end(th, 'bought', `${nameOf(S, R.pl(pid))} caught the night thief, and let them go for a share.`, { hidden: true, by: pid });
      return { lines: [`Here: ¤${cut}. We never met.`, '(The outlaws of the hills will hear you\'re someone who can be dealt with.)'], close: true };
    }
    return null;
  },
});

// ------------------------------------------------------------ smuggling
motif({
  id: 'smuggle',
  family: 'crime',
  max: 3,
  key: (o) => `smuggle:${o.sid}`,
  title: (th, S) => `A Bundle for ${townName(S, th.vars.to)}`,
  scan(S, rng) {
    if (!rng.chance(0.08)) return null;
    const towns = laidTowns(S);
    const banned = towns.filter((L) => lawOn(L, 'armsBan') || (L.econ.tax || 0) > 0.18);
    if (!banned.length) return null;
    const to = rng.pick(banned);
    const from = towns.filter((L) => L !== to).sort((a, b) => Math.hypot(a.settlement.cx - to.settlement.cx, a.settlement.cz - to.settlement.cz) - Math.hypot(b.settlement.cx - to.settlement.cx, b.settlement.cz - to.settlement.cz))[0];
    if (!from) return null;
    const contact = adults(from).find((r) => r.life && r.life.vice === 'thief') || adults(from).find((r) => r.job === 'barkeep');
    const fence = adults(to).find((r) => r.job === 'merchant' || r.job === 'barkeep');
    if (!contact || !fence) return null;
    return { cast: { contact: R.rec(from.settlement.id, contact.idx), fence: R.rec(to.settlement.id, fence.idx), town: R.town(from.settlement.id) }, sid: from.settlement.id, vars: { to: to.settlement.id } };
  },
  nodes: {
    offer: {
      enter(th, S) {
        const t = S.post(th, {
          role: 'carry', kind: 'smuggle', title: `Carry a bundle to ${th.names.fence} in ${townName(S, th.vars.to)}`, sid: th.sid, giver: th.cast.contact, board: false, npc: false,
          target: th.cast.fence, item: 'stolen_goods', n: 1, hand: 'auto',
          pitch: `I need something carried to ${th.names.fence} in ${townName(S, th.vars.to)}. No questions. The watch there would take an interest, so don't let them. ¤35 when it's handed over.`,
          reward: { coins: 35, from: { t: 'purse' }, under: 2, fame: 0 },
        });
        t.offerLabel = 'You look like someone with a proposition.';
      },
      day(th, S) {
        if (S.now - th.nodeAt > 5 * DAY) S.end(th, 'faded');
      },
    },
  },
  tasks: {
    carry: {
      accepted(th, t, who, S) {
        if (who.t === 'pl') S.give(who.pid, 'stolen_goods', 1);
      },
    },
  },
  townTalk(th, npc, pid, S) {
    const f = th.cast.fence;
    if (npc.rec.sid !== f.sid || npc.rec.idx !== f.idx) return [];
    const t = S.tasksOf(th, 'carry')[0];
    if (!t || !S.claimedBy(t, pid) || countItem(S.game.player.inv, 'stolen_goods') <= 0) return [];
    return [{ id: 'sgs_hand', arg: tid(th), label: `${th.names.contact} sent this.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgs_hand') return null;
    const t = S.tasksOf(th, 'carry')[0];
    removeItem(S.game.player.inv, 'stolen_goods', 1);
    // (A chance the watch saw it change hands.)
    const rng = S.rng(th, 0x5c);
    if (rng.chance(0.2)) {
      const g = S.game.npcs.find((n) => !n.dead && n.rec && n.rec.job === 'guard' && n.settlement && n.settlement.id === th.vars.to && n.distTo(S.game.player) < 9);
      if (g) S.sim.justice.commit(th.vars.to, 'theft', { witnesses: [g], desc: 'Smuggling', value: 30 });
    }
    if (t) S.complete(t, R.pl(pid));
    S.end(th, 'delivered', `${nameOf(S, R.pl(pid))} carried a bundle into ${townName(S, th.vars.to)} for ${th.names.contact}.`, { hidden: true, by: pid });
    return { lines: ['Ah. Good. Very good. Here\'s your coin. You were never here.'] };
  },
});

export { hairOf };
