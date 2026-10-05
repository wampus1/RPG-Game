// The realms' business (round 52).
//
//   - War orders: with a war on, the capital needs orders carried to the
//     town nearest the fighting; the enemy has riders watching the roads.
//   - A spy: realms that hate each other want to know what the other's
//     watch is like. Walk through their town by night, unseen, and come
//     back.
//   - Prisoners of war: someone's son or daughter rots in an enemy cell;
//     carry the ransom to the enemy's capital and bring them home.
//   - A pretender: a ruler crowned, and someone at court says it should
//     have been them. Each side wants letters carried to the towns; how
//     the towns lean decides it.
import { motif, R, nameOf, resolve, playerOf } from '../core.js';
import { layoutOf, town, townName, townMid, adults, kinOf, relWord, spotNear, outInTheOpen, purse } from './lib.js';
import { makePerson } from '../actors.js';
import { mayorOf, alive, DAY } from '../../econ.js';
import { countItem, removeItem } from '../../../game/inventory.js';

const tid = (th) => `t${th.id}`;
const civName = (c) => (c ? c.name.replace(/^The /, 'the ') : 'the realm');

function civOf(S, id) {
  return S.game.world.ow.civs.find((c) => c.id === id) || (S.sim.realms.extraCivs || []).find((c) => c.id === id) || null;
}
function capital(S, civ) {
  return civ && S.sim.realms.capitalOf ? S.sim.realms.capitalOf(civ) : null;
}

// ------------------------------------------------------------ war orders
motif({
  id: 'war_orders',
  family: 'realm',
  max: 3,
  key: (o) => `orders:${o.vars.war}:${o.vars.civ}`,
  title: (th, S) => `Orders for the Front (${civName(civOf(S, th.vars.civ))})`,
  seeds: [{ on: 'war_declared', make: (ev, S) => {
    const out = [];
    for (const id of [ev.a, ev.b]) {
      const civ = civOf(S, id);
      const cap = capital(S, civ);
      const foe = civOf(S, id === ev.a ? ev.b : ev.a);
      const fcap = capital(S, foe);
      if (!cap || !fcap) continue;
      // The town of ours nearest the enemy's capital.
      const front = S.game.world.ow.settlements.filter((s) => s.civ === civ && !s.deserted && s.id !== cap.id).sort((a, b) => Math.hypot(a.cx - fcap.cx, a.cz - fcap.cz) - Math.hypot(b.cx - fcap.cx, b.cz - fcap.cz))[0];
      if (!front || !layoutOf(S, cap.id)) continue;
      out.push({ cast: { town: R.town(cap.id), front: R.town(front.id) }, sid: cap.id, vars: { war: ev.war, civ: id, foe: foe.id } });
    }
    return out;
  } }],
  nodes: {
    sealed: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const m = L ? mayorOf(L) : null;
        const FL = layoutOf(S, th.cast.front.sid);
        const fm = FL ? mayorOf(FL) : null;
        const civ = civOf(S, th.vars.civ);
        const note = S.writeNote(th, 'orders', 'SEALED ORDERS', [`To the council of ${townName(S, th.cast.front.sid)}, from the court of ${civName(civ)}.`, '', 'Hold the town. Muster every blade you can.', 'Help comes, but not soon. Do not surrender the bridges.', '', '(The rest is in a cipher you can\'t read.)']);
        th.vars.note = note;
        const t = S.post(th, {
          role: 'carry', kind: 'deliver', title: `Carry sealed orders from ${townName(S, th.sid)} to ${townName(S, th.cast.front.sid)}`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null,
          target: fm ? R.rec(th.cast.front.sid, fm.idx) : null, item: note, n: 1, hand: 'auto',
          pitch: `These orders must reach the council of ${townName(S, th.cast.front.sid)}, near the fighting. The enemy watches the roads. Ride hard, and don't let them take you.`,
          reward: { coins: 40, from: R.town(th.sid), rep: 6, renown: th.cast.front.sid, renownPts: 4, renownWhy: 'carrying orders through the war', fame: 2 },
        });
        t.rumour = `The court needs a rider for the front`;
      },
      // The enemy's riders, on the road.
      hour(th, S, rng) {
        const t = S.tasksOf(th, 'carry')[0];
        if (!t) return;
        for (const c of t.claims) {
          if (c.who.t !== 'pl' || th.vars[`ambushed_${c.who.pid}`]) continue;
          if (!outInTheOpen(S, c.who.pid) || !rng.chance(0.15)) continue;
          th.vars[`ambushed_${c.who.pid}`] = true;
          const p = playerOf(S.game, c.who.pid);
          const at = spotNear(S, p.x, p.z, 18, 24, rng, { clear: 0, flat: 0 });
          if (!at) continue;
          const foe = civOf(S, th.vars.foe);
          for (let i = 0; i < 2; i++) S.actor(th, { key: `rider${c.who.pid}${i}`, kind: 'npc', role: 'hunter', hostile: true, at: { x: at.x + i, z: at.z }, person: makePerson(rng, foe ? foe.style : 'vale', 'soldier'), orders: { target: c.who.pid, cry: `A rider from ${civName(civOf(S, th.vars.civ))}! After them!` } });
          S.tell(c.who.pid, `Riders in ${civName(foe)}'s colours, coming hard.`, '#ffb080');
        }
      },
      on: {
        war_over(th, ev, S) {
          if (ev.war !== th.vars.war) return;
          S.end(th, 'peace', 'The war ended before the orders mattered.');
        },
      },
    },
  },
  tasks: {
    carry: {
      accepted(th, t, who, S) {
        if (who.t === 'pl') S.give(who.pid, th.vars.note, 1);
      },
      thanks: () => ['Orders, from the court? Thank the gods. You rode through all that?'],
      done(th, t, by, S) {
        S.end(th, 'delivered', `${nameOf(S, by)} carried the court's orders through to ${townName(S, th.cast.front.sid)}.`, { news: [th.cast.front.sid] });
      },
    },
  },
});

// ------------------------------------------------------------ a spy
motif({
  id: 'spy',
  family: 'realm',
  max: 2,
  key: (o) => `spy:${o.vars.civ}:${o.vars.foe}`,
  title: (th, S) => `Eyes on ${townName(S, th.vars.mark)}`,
  scan(S, rng) {
    if (!rng.chance(0.06)) return null;
    const civs = S.game.world.ow.civs;
    for (const a of rng.shuffle(civs.slice())) {
      const foe = civs.find((b) => b !== a && S.sim.realms.standing && S.sim.realms.standing(a, b) === 'hostile');
      if (!foe) continue;
      const cap = capital(S, a);
      const mark = S.game.world.ow.settlements.filter((s) => s.civ === foe && !s.deserted).sort((x, y) => Math.hypot(x.cx - (cap ? cap.cx : 0), x.cz - (cap ? cap.cz : 0)) - Math.hypot(y.cx - (cap ? cap.cx : 0), y.cz - (cap ? cap.cz : 0)))[0];
      if (!cap || !mark || !layoutOf(S, cap.id)) continue;
      return { cast: { town: R.town(cap.id) }, sid: cap.id, vars: { civ: a.id, foe: foe.id, mark: mark.id } };
    }
    return null;
  },
  nodes: {
    asked: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const m = L ? mayorOf(L) : null;
        const ms = town(S, th.vars.mark);
        const mid = townMid(ms);
        const t = S.post(th, {
          role: 'look', kind: 'meet', title: `Walk through ${ms.name} by night, unseen, and report back`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null, board: false,
          at: mid, r: 8, reward: { coins: 45, from: R.town(th.sid), rep: 8, fame: 1 },
          pitch: `We need to know how ${ms.name}'s watch is kept: how many, where they stand at night. Walk through after dark. Don't get caught. Then come back and tell me.`,
        });
        t.offerLabel = 'You look like you\'ve a job that needs doing quietly.';
      },
      day(th, S) {
        if (S.now - th.nodeAt > 6 * DAY) S.end(th, 'faded');
      },
    },
  },
  tasks: {
    look: {
      reach(th, t, pid, S) {
        const night = S.game.minute >= 1260 || S.game.minute < 300;
        if (!night) {
          if (!th.vars[`told${pid}`]) {
            th.vars[`told${pid}`] = true;
            S.tell(pid, 'Too many eyes by day. Come back after dark.', '#c8c8c8');
          }
          return;
        }
        // (Seen by the watch?)
        const g = S.game.npcs.find((n) => !n.dead && n.rec && n.rec.job === 'guard' && n.settlement && n.settlement.id === th.vars.mark && n.distTo(playerOf(S.game, pid)) < 6 && !n.sleeping);
        if (g && S.rng(th, 0x5b).chance(0.4)) {
          g.say('You! What are you doing skulking about?', 3, '#ff9080');
          S.townSay(pid, th.vars.mark, -10);
          S.note(th, `The watch of ${townName(S, th.vars.mark)} caught sight of ${nameOf(S, R.pl(pid))} skulking about at night.`, { by: pid });
        }
        S.complete(t, R.pl(pid));
      },
      thanks: (th, t, pid, S) => [`Four at the gate, two on the walls, and the rest asleep by midnight? Ha. ${townName(S, th.vars.mark)} won't know what hit it.`],
      done(th, t, by, S) {
        th.vars.done = true;
      },
      paid(th, t, pid, S) {
        S.end(th, 'reported', `${nameOf(S, R.pl(pid))} spied on ${townName(S, th.vars.mark)} for ${civName(civOf(S, th.vars.civ))}.`, { hidden: true, by: pid });
      },
    },
  },
});

// ------------------------------------------------------------ prisoners of war
motif({
  id: 'pow',
  family: 'realm',
  max: 4,
  key: (o) => `pow:${o.vars.p}`,
  title: (th, S) => `${th.names.prisoner} in ${townName(S, th.vars.at)}'s Cells`,
  scan(S, rng) {
    const w = S.sim.war;
    if (!w.prisoners || !w.prisoners.length || !rng.chance(0.3)) return null;
    const p = rng.pick(w.prisoners);
    const L = layoutOf(S, p.sid);
    const r = L && L.npcs[p.idx];
    if (!r) return null;
    const kin = kinOf(L, r)[0];
    if (!kin) return null;
    return { cast: { prisoner: R.rec(p.sid, p.idx), kin: R.rec(p.sid, kin.idx), town: R.town(p.sid) }, sid: p.sid, vars: { p: p.id, at: p.at, ransom: 40 + rng.int(0, 40) } };
  },
  nodes: {
    held: {
      enter(th, S) {
        const at = town(S, th.vars.at);
        S.post(th, {
          role: 'ransom', kind: 'pay', title: `Carry ¤${th.vars.ransom} to ${at ? at.name : 'the enemy'} and bring ${th.names.prisoner} home`, sid: th.sid, giver: th.cast.kin,
          pitch: `My ${relWord(resolve(S, th.cast.kin) || {}, resolve(S, th.cast.prisoner) || {})} ${th.names.prisoner} was taken in the fighting, and sits in a cell in ${at ? at.name : 'the enemy\'s capital'}. I've scraped together ¤${th.vars.ransom}. Their council will take it. Would you carry it, and bring them back?`,
          reward: { coins: 10, from: th.cast.kin, rep: 20, fame: 1 },
        });
      },
      day(th, S) {
        const w = S.sim.war;
        if (!w.prisoners.some((q) => q.id === th.vars.p)) S.end(th, 'freed', `${th.names.prisoner} is home.`);
      },
    },
  },
  tasks: {
    ransom: {
      accepted(th, t, who, S) {
        if (who.t !== 'pl') return;
        S.give(who.pid, 'coin', th.vars.ransom);
        S.tell(who.pid, `${th.names.kin || 'They'} pressed ¤${th.vars.ransom} into your hands. Take it to the council of ${townName(S, th.vars.at)}.`, '#ffd890');
      },
      thanks: () => ['You brought them home. You brought them home!'],
    },
  },
  townTalk(th, npc, pid, S) {
    if (!npc.rec || npc.rec.job !== 'mayor' || npc.rec.sid !== th.vars.at) return [];
    const t = S.tasksOf(th, 'ransom')[0];
    if (!t || !S.claimedBy(t, pid)) return [];
    return [{ id: 'sgp_pay', arg: tid(th), label: `I've come with ¤${th.vars.ransom} for ${th.names.prisoner}.` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgp_pay') return null;
    if (purse(S, pid) < th.vars.ransom) return { lines: ['That\'s not the sum. Come back with all of it.'] };
    S.asPid(pid, (p) => removeItem(p.inv, 'coin', th.vars.ransom));
    const L = layoutOf(S, th.vars.at);
    if (L) L.econ.treasury += th.vars.ransom;
    const w = S.sim.war;
    const p = w.prisoners.find((q) => q.id === th.vars.p);
    if (p) w.release(p, 'ransomed', S.day);
    const t = S.tasksOf(th, 'ransom')[0];
    if (t) S.complete(t, R.pl(pid));
    S.note(th, `${nameOf(S, R.pl(pid))} paid ${th.names.prisoner}'s ransom in ${townName(S, th.vars.at)}.`, { news: [th.sid], by: pid });
    return { lines: ['Hm. The sum is right. Very well: they\'ll be set on the road home today.'] };
  },
});

// ------------------------------------------------------------ a pretender
motif({
  id: 'pretender',
  family: 'realm',
  max: 2,
  key: (o) => `pretender:${o.vars.civ}`,
  title: (th, S) => `The Claim of ${th.names.claimant}`,
  seeds: [{ on: 'crowned', make: (ev, S) => {
    if (Math.random() > 0.35) return null;
    const L = layoutOf(S, ev.sid);
    if (!L) return null;
    const rival = adults(L).filter((r) => r.idx !== ev.idx && (r.job === 'noble' || r.councillor !== undefined) && r.ruler === undefined)[0];
    if (!rival) return null;
    return { cast: { ruler: R.rec(ev.sid, ev.idx), claimant: R.rec(ev.sid, rival.idx), town: R.town(ev.sid) }, sid: ev.sid, vars: { civ: ev.civ, lean: 0 } };
  }}],
  nodes: {
    contested: {
      enter(th, S) {
        const civ = civOf(S, th.vars.civ);
        S.note(th, `${th.names.claimant} says the throne of ${civName(civ)} should have been theirs, not ${th.names.ruler}'s.`, { news: [th.sid] });
        const towns = S.game.world.ow.settlements.filter((s) => s.civ === civ && s.id !== th.sid && !s.deserted).slice(0, 3);
        th.vars.towns = towns.map((s) => s.id);
        for (const side of ['claimant', 'ruler']) {
          const lines = side === 'claimant'
            ? [`To the councils of ${civName(civ)}:`, '', `${th.names.ruler} took the throne by trickery. I, ${th.names.claimant}, am the rightful heir.`, 'Stand with me, and your town will not be forgotten.']
            : [`To the councils of ${civName(civ)}:`, '', `${th.names.claimant} would tear the realm apart for their pride.`, `Stand with your crowned ruler, ${th.names.ruler}, and keep the peace.`];
          const note = S.writeNote(th, 'letter', side === 'claimant' ? 'A LETTER OF CLAIM' : 'A ROYAL LETTER', lines);
          th.vars[`note_${side}`] = note;
          const t = S.post(th, {
            role: side, kind: 'deliver', title: `Carry ${th.names[side]}'s letters to the towns of ${civName(civ)}`, sid: th.sid, giver: th.cast[side], board: false,
            item: note, n: 1, need: th.vars.towns.length,
            pitch: side === 'claimant' ? `The crown is mine by right. Carry my letters to the councils of ${th.vars.towns.map((id) => townName(S, id)).join(', ')}. Every town that stands with me is a step closer.` : `${th.names.claimant} is stirring up the towns. Take my letters to ${th.vars.towns.map((id) => townName(S, id)).join(', ')}, before theirs arrive.`,
            reward: { coins: 50, from: th.cast[side], rep: 10, fame: 2 },
          });
          t.offerLabel = side === 'claimant' ? 'They say the crown went to the wrong head.' : 'Is the realm in danger, your grace?';
        }
      },
      day(th, S, rng) {
        if (S.now - th.nodeAt > 8 * DAY) settle(th, S, rng);
      },
    },
  },
  tasks: {
    claimant: { accepted: (th, t, who, S) => giveLetters(th, t, who, S, 'claimant') },
    ruler: { accepted: (th, t, who, S) => giveLetters(th, t, who, S, 'ruler') },
  },
  // A letter handed to a council: that town leans one way.
  townTalk(th, npc, pid, S) {
    if (!npc.rec || npc.rec.job !== 'mayor' || !th.vars.towns.includes(npc.rec.sid)) return [];
    const out = [];
    for (const side of ['claimant', 'ruler']) {
      const t = S.tasksOf(th, side)[0];
      if (!t || !S.claimedBy(t, pid) || (th.vars[`gave_${side}`] || []).includes(npc.rec.sid)) continue;
      if (countItem(S.game.player.inv, th.vars[`note_${side}`]) <= 0) continue;
      out.push({ id: 'sgq_give', arg: `${tid(th)}:${side}`, label: `A letter from ${th.names[side]}.` });
    }
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgq_give') return null;
    const side = String(arg).split(':')[1];
    removeItem(S.game.player.inv, th.vars[`note_${side}`], 1);
    (th.vars[`gave_${side}`] ||= []).push(npc.rec.sid);
    th.vars.lean += side === 'claimant' ? 1 : -1;
    const t = S.tasksOf(th, side)[0];
    if (t) {
      t.count++;
      if (t.count >= t.need) S.complete(t, R.pl(pid));
    }
    S.touch(th, pid);
    if ((th.vars.gave_claimant || []).length + (th.vars.gave_ruler || []).length >= th.vars.towns.length) settle(th, S, S.rng(th, 0x5e7));
    return { lines: [side === 'claimant' ? 'Hm. A bold claim. The council will think on it.' : 'The crown has our loyalty. Tell them so.'] };
  },
});

function giveLetters(th, t, who, S, side) {
  if (who.t !== 'pl') return;
  S.give(who.pid, th.vars[`note_${side}`], th.vars.towns.length);
}

// How the towns leaned decides it.
function settle(th, S, rng) {
  if (th.done) return;
  const civ = civOf(S, th.vars.civ);
  const L = layoutOf(S, th.sid);
  const c = resolve(S, th.cast.claimant);
  if (th.vars.lean > 0 && c && L && civ && alive(c) && S.sim.realms.crown) {
    S.sim.realms.crown(civ, L, c, S.day, (t) => `${t} has taken the throne, the towns behind them.`);
    S.end(th, 'usurped', `${th.names.claimant} took the throne of ${civName(civ)}, with the towns behind them. ${th.names.ruler} fled.`, { news: [th.sid, ...th.vars.towns] });
  } else if (th.vars.lean < 0 || rng.chance(0.6)) {
    if (c && L && S.sim.society && S.sim.society.exile) S.sim.society.exile(L, c, S.day, rng, 'treason');
    S.end(th, 'crushed', `${th.names.claimant}'s claim came to nothing. They were driven out of ${townName(S, th.sid)} for treason.`, { news: [th.sid] });
  } else S.end(th, 'faded', `The towns stayed out of it, and ${th.names.claimant}'s claim faded away.`);
}
