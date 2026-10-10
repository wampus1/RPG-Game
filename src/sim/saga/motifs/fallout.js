// (Round 79) When you take something on and the time runs out: not just a
// line in your journal, but what comes of it, a story of its own (more
// often than not: chance has a say).
//   - The trouble grows (a beast, outlaws, a plea for help no one
//     answered): it struck the town, and now there's mending to do; bring
//     planks to the mayor and help put it right.
//   - Someone blames you (a lost child, a runaway, one taken): their kin
//     want a word. Say sorry and mean it, or make it good with coin; leave
//     it, and the whole family turns cold.
//   - Word gets round (anything else): the one who asked tells everyone
//     you didn't come through. Put it right with them.
//   - The trail goes cold (see trails.js): weeks later a new lead turns
//     up, somewhere else (over the sea, if the storm's down).
import { motif, R, nameOf, MOTIFS, LAPSE_HOOKS } from '../core.js';
import { pick, layoutOf, recOf, isRec, persuade, purse, repWith, adults, kinOf } from './lib.js';
import { mayorOf } from '../../econ.js';
import { removeItem } from '../../../game/inventory.js';
import { trailFrom } from './trails.js';

const tid = (th) => `t${th.id}`;
const WORSE = new Set(['plea', 'den', 'alpha', 'grudge', 'stronghold', 'outlaw_work', 'swarm', 'fever', 'shortage', 'refugees', 'army_ashore', 'raider_bounty', 'harvest', 'dry_well', 'bridge_out', 'ratcatcher']);
const BLAME = new Set(['lost_child', 'missing', 'runaway', 'captive', 'child_alone', 'lost_traveller', 'taken_at_sea', 'last_wish', 'homecoming', 'orphan']);

// What a story missed turns into (null: nothing, this time).
export function fallKind(th) {
  if (th.m === 'trail') return 'cold';
  if (WORSE.has(th.m)) return 'worse';
  if (BLAME.has(th.m)) return 'blame';
  return 'word';
}

// A task someone playing had taken on ran out of time: what comes of it.
export function failBranch(S, th, t) {
  if (!th || th.m === 'fallout' || th.vars.fellOut) return null;
  const M = MOTIFS[th.m];
  if (M && M.noFallout) return null;
  const c = t.claims.find((q) => q.who.t === 'pl');
  if (!c) return null;
  const rng = S.rng(th, 0xfa11);
  // (Not always: chance has a say.)
  if (!rng.chance(0.7)) {
    S.trace?.('branch', `${th.title}: "${t.title}" missed; nothing came of it this time`);
    return null;
  }
  const kind = fallKind(th);
  th.vars.fellOut = true;
  const giver = t.giver && t.giver.t === 'rec' ? t.giver : Object.values(th.cast).find((r) => r && r.t === 'rec') || null;
  const kid = S.spawn(th, 'fallout', {
    sid: th.sid, cast: { giver, town: th.sid !== null && th.sid !== undefined ? R.town(th.sid) : null },
    vars: { kind, failed: t.title, story: th.title, pid: c.who.pid, from: th.m },
    touched: [c.who.pid],
  });
  S.trace?.('branch', kid ? `${th.title}: "${t.title}" missed by ${c.who.pid}; it led to ${kid.title} (${kind})` : `${th.title}: missed, but no room for what would have come of it`);
  return kid;
}

LAPSE_HOOKS.push(failBranch);

const TITLES = { worse: 'Too Late', blame: 'A Word of Blame', word: 'Word Gets Round', cold: 'The Trail Goes Cold' };

motif({
  id: 'fallout',
  family: 'fallout',
  max: 6,
  key: (o) => `fallout|${o.vars && o.vars.story}|${o.vars && o.vars.pid}`,
  title: (th) => `${TITLES[th.vars.kind] || 'What Came of It'}: ${th.vars.story}`,
  nodes: {
    after: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const pid = th.vars.pid;
        const k = th.vars.kind;
        const giver = recOf(S, th.cast.giver);
        const who = giver ? `${giver.name.first} ${giver.name.last}` : 'they';
        if (k === 'cold') {
          // A new lead, a while later (see `day`).
          th.vars.leadAt = S.day + 3 + Math.floor(S.rng(th, 1).next() * 5);
          S.tell(pid, `The trail you were following has gone cold: ${th.vars.story}. Perhaps, in time, word will come again.`, '#c8c8c8');
          return;
        }
        if (!L) return S.end(th, 'faded');
        if (k === 'worse') {
          L.econ.treasury = Math.max(0, L.econ.treasury - 20);
          const m = mayorOf(L);
          S.note(th, `Nobody came in time, and ${L.settlement.name} paid for it: ${th.vars.story.toLowerCase()} ended badly.`, { news: [th.sid] });
          const t = S.post(th, {
            role: 'mend', kind: 'fetch', item: 'planks', n: 20, title: `Help ${L.settlement.name} mend what was lost`, sid: th.sid, giver: m ? R.rec(th.sid, m.idx) : null,
            pitch: 'We\'re putting it back together, plank by plank. Twenty planks would see the worst of it mended.', days: 8,
            reward: { coins: 25, from: R.town(th.sid), rep: 10, renown: th.sid, renownPts: 2, renownWhy: 'helping mend things' },
          });
          t.rumour = `${L.settlement.name} is mending after ${th.vars.story.toLowerCase()}`;
          S.tell(pid, `You didn't make it in time: ${th.vars.failed}. Word comes from ${L.settlement.name}: it went badly. They could use help now.`, '#ffb080');
        } else if (k === 'blame') {
          const kin = giver ? kinOf(L, giver)[0] || giver : null;
          if (kin) {
            th.cast.kin = R.rec(th.sid, kin.idx);
            th.names.kin = `${kin.name.first} ${kin.name.last}`;
          }
          S.tell(pid, `${th.names.kin || who} of ${L.settlement.name} blames you for ${th.vars.story.toLowerCase()}: you said you'd help, and you didn't come. They want a word.`, '#ffb080');
          if (kin) repWith(S, L, kin, -12);
        } else {
          if (giver) repWith(S, L, giver, -10);
          for (const r of adults(L).slice(0, 3)) repWith(S, L, r, -2);
          S.tell(pid, `${who} of ${L.settlement.name} is telling everyone you said you'd help (${th.vars.failed.toLowerCase()}) and never came.`, '#ffb080');
        }
      },
      day(th, S) {
        if (th.vars.kind === 'cold' && S.day >= (th.vars.leadAt || 0)) {
          const L = layoutOf(S, th.sid);
          const rng = S.rng(th, 2);
          const o = L ? trailFrom(S, L, rng, 'heirloom') : null;
          if (o) {
            o.vars.pitch = `A new lead: ${o.vars.pitch}`;
            const kid = S.spawn(th, 'trail', o);
            if (kid) {
              S.tell(th.vars.pid, `A new lead on ${th.vars.story}: ${kid.vars.rumour}. Ask in ${L.settlement.name}.`, '#a0e0ff');
              return S.end(th, 'reopened', 'A new lead turned up.');
            }
          }
          return S.end(th, 'cold', 'The trail never warmed again.');
        }
      },
      fade: 14,
      faded(th) {
        return th.vars.kind === 'blame' ? `${th.names.kin || 'They'} never forgave it.` : null;
      },
    },
  },
  tasks: {
    mend: {
      done(th, t, by, S) {
        S.end(th, 'mended', `${nameOf(S, by)} brought the planks, and ${S.game.world.ow.settlements[th.sid]?.name || 'the town'} was mended.`, { news: [th.sid] });
      },
      thanks: () => ['That\'s the roof back on, and the fence up. Thank you. Better late than never.'],
    },
  },
  townTalk(th, npc, pid) {
    if (pid !== th.vars.pid) return [];
    const who = th.vars.kind === 'blame' ? th.cast.kin || th.cast.giver : th.vars.kind === 'word' ? th.cast.giver : null;
    if (!who || !isRec(npc, who)) return [];
    return [
      { id: 'sgo_sorry', arg: tid(th), label: 'I\'m sorry I didn\'t come. I should have.' },
      { id: 'sgo_pay', arg: tid(th), label: 'Let me make it right. (¤20)' },
    ];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x50);
    const L = layoutOf(S, th.sid);
    if (id === 'sgo_sorry') {
      if (th.vars.triedSorry === S.day) return { lines: ['I\'ve heard it. Give me time.'] };
      th.vars.triedSorry = S.day;
      if (persuade(S, npc, rng, 0.35, 0.1)) {
        if (L) repWith(S, L, npc.rec, 12);
        S.end(th, 'forgiven', `${nameOf(S, R.pl(pid))} made their peace over ${th.vars.story.toLowerCase()}.`);
        return { lines: [pick(rng, ['...I know. You can\'t be everywhere. Let\'s leave it.', 'It\'s done. I don\'t hold it against you. Not any more.'])] };
      }
      return { lines: [pick(rng, ['Sorry doesn\'t change it.', 'Words are cheap.'])] };
    }
    if (id === 'sgo_pay') {
      if (purse(S, pid) < 20) return { lines: ['(You don\'t have ¤20.)'] };
      removeItem(S.game.player.inv, 'coin', 20);
      S.game.audio?.play('coin');
      if (L) repWith(S, L, npc.rec, 8);
      S.end(th, 'mended', `${nameOf(S, R.pl(pid))} made it good with coin.`);
      return { lines: ['...It doesn\'t bring anything back. But it helps. Thank you.'] };
    }
    return null;
  },
});
