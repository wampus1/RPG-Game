// Comings and goings on the roads (round 54).
//
//   - Lost out there: someone gone astray in the snow, or the sand, or the
//     fog, and their companion back in town beside themself.
//   - The bridge is out: the river's taken it, the road's cut, and the
//     carts are piling up on both banks.
//   - A child alone: come in off the road with a story (a village burnt,
//     parents gone). Is it true?
//   - A stranger with no past: found by the road with no memory. A noble?
//     A deserter? An outlaw? Help them remember, and find out.
//   - The travelling show: tumblers and a strongman and a fire-eater, tents
//     outside town for a few nights. Joy, mostly, and then something goes
//     missing and the show folk are blamed.
//   - A noble in hiding: the new farmhand with soft hands and good manners,
//     and riders on the road asking after someone just like them.
//   - The old soldier: a veteran with one last errand from the war: a medal
//     to return, a comrade to find, something buried in a hurry.
import { motif, R, nameOf } from '../core.js';
import { pick, say, layoutOf, laidTowns, townName, townMid, living, adults, fullName, recOf, has, nat, single, spotNear, biomeAt, persuade, repWith, isRec, someone, purse } from './lib.js';
import { makePerson } from '../actors.js';
import { mayorOf, alive, DAY, ledger } from '../../econ.js';
import { newcomer } from '../../civic.js';
import { ITEMS } from '../../../world/items.js';
import { removeItem } from '../../../game/inventory.js';

const tid = (th) => `t${th.id}`;
const first = (r) => (r ? r.name.first : 'them');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ------------------------------------------------------------ lost out there
motif({
  id: 'lost_traveller',
  family: 'roads',
  max: 2,
  key: (o) => `lostt:${o.sid}`,
  title: (th) => `${th.vars.name}, Lost in the ${cap(th.vars.terrain)}`,
  scan(S, rng) {
    if (!rng.chance(0.05)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const m = townMid(L.settlement);
      const at = spotNear(S, m.x, m.z, 70, 140, rng, { clear: 10 });
      const kin = someone(L, rng);
      if (!at || !kin) continue;
      const b = biomeAt(S, at.x, at.z) || '';
      const terrain = /tundra|taiga|snow|ice/.test(b) ? 'snow' : /desert|savanna/.test(b) ? 'sand' : /swamp|marsh|bog/.test(b) ? 'mire' : 'fog';
      return { cast: { kin: R.rec(L.settlement.id, kin.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, spots: [at], vars: { at, terrain, name: '' } };
    }
    return null;
  },
  anchors: (th) => [th.vars.at],
  nodes: {
    astray: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x105);
        const p = makePerson(rng, L.settlement.style || 'vale', rng.pick(['merchant', 'messenger', 'stranger']));
        th.vars.name = `${p.name.first} ${p.name.last}`;
        S.retitle(th, `${th.vars.name}, Lost in the ${cap(th.vars.terrain)}`);
        th.vars.hours = 0;
        th.vars.wolves = rng.chance(0.35);
        S.actor(th, { key: 'lost', kind: 'npc', role: 'lost', talk: true, at: th.vars.at, person: { ...p, title: 'Lost Traveller' }, orders: { home: th.vars.at, roam: 2, mark: 'talk', lines: ['Hello? HELLO?', 'Which way is the road?', '*shivers*'] } });
        const t = S.post(th, {
          role: 'find', kind: 'find', title: `Find ${th.vars.name}, lost in the ${th.vars.terrain}, and lead them in`, sid: th.sid, giver: th.cast.kin, at: th.vars.at, r: 5, days: 3,
          pitch: say(rng, ['We were walking together and the {t} came down and I lost them. I made it here. They didn\'t. Please. They\'re out there.', '{n} went out to check the traps before the {t} came in. That was yesterday.'], { t: th.vars.terrain, n: th.vars.name }),
          reward: { coins: 20, from: th.cast.kin, rep: 15, renown: th.sid, renownPts: 3, renownWhy: `bringing ${th.vars.name} in`, fame: 1 },
        });
        t.offerLabel = 'Have you lost someone?';
        if (th.vars.wolves) for (let i = 0; i < 2; i++) S.actor(th, { key: `w${i}`, kind: 'beast', role: 'wolf', species: 'wolf', hostile: true, at: { x: th.vars.at.x + 6 + i * 2, z: th.vars.at.z - 5 }, orders: { home: th.vars.at } });
      },
      live(th, S) {
        const e = S.actorEnt(th, 'lost');
        const L = layoutOf(S, th.sid);
        if (!e || !L || !th.vars.led) return;
        const m = townMid(L.settlement);
        if (Math.max(Math.abs(e.x - m.x), Math.abs(e.z - m.z)) > 30) return;
        S.dismissActor(th, 'lost');
        const t = S.tasksOf(th, 'find')[0];
        if (t) S.complete(t, R.pl(th.vars.led));
        S.end(th, 'brought in', `${nameOf(S, R.pl(th.vars.led))} found ${th.vars.name} in the ${th.vars.terrain} and led them in, half frozen and talking nonsense, but alive.`, { news: [th.sid] });
      },
      day(th, S, rng) {
        const days = (S.now - th.nodeAt) / DAY;
        if (days < 2) return;
        S.dismissActor(th, 'lost');
        const how = S.choose(th, [{ to: 'self', w: 1 }, { to: 'dead', w: th.vars.terrain === 'snow' ? 1.2 : 0.6 }, { to: 'gone', w: 0.4 }], rng).to;
        if (how === 'self') return S.end(th, 'found their way', `${th.vars.name} stumbled in on their own on the third morning, frostbitten and furious that nobody came.`);
        if (how === 'dead') return S.end(th, 'too late', `${th.vars.name} was found in the ${th.vars.terrain}, too late. ${th.names.kin} ${pick(rng, ['hasn\'t stopped blaming themselves.', 'went out to bring them home.'])}`, { news: [th.sid] });
        return S.end(th, 'never found', `${th.vars.name} was never found. ${th.names.kin} leaves a lamp in the window.`);
      },
      fade: 4,
    },
  },
  hello(th) {
    return th.vars.led ? 'I\'m right behind you.' : 'Oh thank the gods. Which way is town?';
  },
  talk(th, a) {
    if (a.role !== 'lost' || th.vars.led) return [];
    return [{ id: 'sgl3_follow', arg: tid(th), label: 'Follow me. Stay close.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgl3_follow') return null;
    th.vars.led = pid;
    const t = S.tasksOf(th, 'find')[0];
    if (t && !S.claimedBy(t, pid)) S.accept(t, R.pl(pid));
    const a = S.actorSpec(th, 'lost');
    if (a) a.orders = { ...(a.orders || {}), follow: pid, mark: null, lines: ['Wait for me!', 'I can\'t feel my feet.', 'Are we close?'] };
    if (npc && npc.saga) npc.saga.follow = pid;
    return { lines: ['Right behind you. Right behind you.', '(They\'ll follow you. Lead them into town.)'], close: true };
  },
});

// ------------------------------------------------------------ the bridge is out
motif({
  id: 'bridge_out',
  family: 'roads',
  max: 2,
  key: (o) => `bridge:${o.sid}`,
  title: (th, S) => `The ${townName(S, th.sid)} Bridge Is Out`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const others = laidTowns(S).filter((T) => T !== L && Math.hypot(T.settlement.cx - L.settlement.cx, T.settlement.cz - L.settlement.cz) < 8);
      if (!others.length) continue;
      return { cast: { town: R.town(L.settlement.id), other: R.town(rng.pick(others).settlement.id) }, sid: L.settlement.id };
    }
    return null;
  },
  nodes: {
    washed: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xb1d);
        th.vars.why = rng.pick(['the spring flood', 'a storm in the hills', 'rot nobody fixed', 'a runaway cart']);
        const builder = adults(L).find((r) => ['builder', 'carpenter'].includes(r.job)) || mayorOf(L);
        th.cast.builder = builder ? R.rec(th.sid, builder.idx) : null;
        th.names.builder = builder ? fullName(builder) : 'the council';
        S.note(th, `${cap(th.vars.why)} took the bridge on the road from ${L.settlement.name} to ${townName(S, th.cast.other.sid)}. Carts are stuck on both banks.`, { news: [th.sid, th.cast.other.sid] });
        const t = S.post(th, {
          role: 'timber', kind: 'fetch', title: `Bring ${builder ? first(builder) : 'the council'} 16 planks to rebuild the bridge`, sid: th.sid, giver: th.cast.builder, item: 'planks', n: 16,
          pitch: 'Sixteen good planks and I\'ll have it across in two days. Without them, we\'re cut off till the summer.',
          reward: { coins: 30, from: R.town(th.sid), rep: 15, renown: th.sid, renownPts: 4, renownWhy: 'rebuilding the bridge', fame: 1 },
        });
        t.offerLabel = 'What happened to the bridge?';
        th.vars.cost = 0;
        // (And who pays: the two towns may quarrel over it.)
        th.vars.quarrel = rng.chance(0.4);
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        L.econ.treasury = Math.max(0, L.econ.treasury - 2);
        const days = (S.now - th.nodeAt) / DAY;
        if (days >= 2 && !th.vars.turn) {
          th.vars.turn = S.choose(th, [{ to: 'ferry', w: 1 }, { to: 'drowned', w: 0.4 }, { to: 'none', w: 1 }], rng).to;
          if (th.vars.turn === 'ferry') {
            const f = someone(L, rng, (r) => ['fisher', 'laborer'].includes(r.job) && !r.venture);
            if (f) S.split(th, 'venture', { cast: { owner: R.rec(th.sid, f.idx), town: R.town(th.sid) }, sid: th.sid, vars: { kind: 'ferry', biz: 'a ferry', wants: 'planks', n: 8, need: 30 } }, `${fullName(f)} has started rowing people across where the bridge was, for a coin.`);
          } else if (th.vars.turn === 'drowned') {
            S.note(th, `A carter tried to ford the river where the bridge was, and was swept away with their horse.`, { news: [th.sid] });
          }
        }
        if (th.vars.quarrel && days >= 3 && !th.vars.quarrelled) {
          th.vars.quarrelled = true;
          S.note(th, `${townName(S, th.sid)} and ${townName(S, th.cast.other.sid)} are arguing over who should pay for the bridge. Nobody's building anything.`, { news: [th.sid, th.cast.other.sid] });
        }
        if (days > (th.vars.quarrel ? 12 : 8)) {
          L.econ.treasury = Math.max(0, L.econ.treasury - 40);
          S.end(th, 'rebuilt', `The bridge is up again, at last, paid for by ${L.settlement.name}${th.vars.quarrel ? `, after a lot of shouting at ${townName(S, th.cast.other.sid)}` : ''}.`, { news: [th.sid] });
        }
      },
      fade: 14,
    },
  },
  tasks: {
    timber: {
      done(th, t, by, S) {
        S.end(th, 'rebuilt', `${nameOf(S, by)} brought the timber, and ${th.names.builder} had the bridge across in two days. The carts are rolling again.`, { news: [th.sid, th.cast.other.sid] });
      },
      thanks: () => ['Good wood! Now stand back and watch.'],
    },
  },
});

// ------------------------------------------------------------ a child alone
motif({
  id: 'child_alone',
  family: 'roads',
  max: 1,
  key: (o) => `childa:${o.sid}`,
  title: (th) => `The Child from the Road`,
  scan(S, rng) {
    if (!rng.chance(0.03)) return null;
    const L = rng.pick(laidTowns(S));
    return L ? { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id } : null;
  },
  nodes: {
    arrived: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xc1d);
        const p = makePerson(rng, L.settlement.style || 'vale', 'child');
        th.vars.name = `${p.name.first}`;
        th.vars.person = p;
        th.vars.truth = S.choose(th, [{ to: 'true', w: 1 }, { to: 'runaway', w: 0.8 }, { to: 'pickpocket', w: 0.5 }, { to: 'noble', w: 0.3 }], rng).to;
        const at = townMid(L.settlement);
        S.actor(th, { key: 'child', kind: 'npc', role: 'child', talk: true, at, stay: true, person: { ...p, title: 'Child from the Road' }, orders: { home: at, roam: 4, mark: 'talk', lines: ['*sniff*', 'Have you got any bread?', 'I\'m not scared.'] } });
        S.note(th, `A child walked into ${L.settlement.name} off the road, alone, with no shoes. They say their name is ${th.vars.name}, and that their village burnt.`, { news: [th.sid] });
        th.vars.trust = 0;
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        if (th.vars.truth === 'pickpocket' && days >= 1 && !th.vars.stole) {
          th.vars.stole = true;
          S.note(th, `Purses have been going missing in the market since the child came. ${pick(rng, ['Nobody wants to say it.', 'People are watching their pockets, and the child.'])}`);
        }
        if (th.vars.truth === 'noble' && days >= 2 && !th.vars.riders) {
          th.vars.riders = true;
          S.note(th, 'Riders in a lord\'s colours came through asking after a lost child. A reward was mentioned.', { news: [th.sid] });
        }
        if (days > 5) {
          S.dismissActor(th, 'child');
          const v = th.vars.truth;
          if (v === 'true') {
            const k = adults(L).find((r) => nat(r, 'kindness') > 0.6);
            return S.end(th, 'taken in', `Nobody came for ${th.vars.name}. ${k ? `${fullName(k)} took them in, and they've shoes now.` : 'The temple took them in.'}`, { news: [th.sid] });
          }
          if (v === 'runaway') return S.end(th, 'fetched', `${th.vars.name}'s mother came looking, three towns over, and found them. There was no burnt village: a hard father, and a broken window. They went home, holding hands.`, { news: [th.sid] });
          if (v === 'pickpocket') return S.end(th, 'gone', `${th.vars.name} was gone one morning, and so were a dozen purses. The village that burnt was never on any map.`, { news: [th.sid] });
          return S.end(th, 'claimed', `The riders came back, and knelt to the child. ${th.vars.name} is a lord's heir, it turns out, who ran from the castle to see the world. The town got the reward.`, { news: [th.sid] });
        }
      },
      fade: 7,
    },
  },
  hello(th) {
    return 'Are you going to send me away?';
  },
  talk(th, a, npc, pid) {
    if (a.role !== 'child') return [];
    const out = [{ id: 'sgc2_tell', arg: tid(th), label: 'Tell me about your village.' }, { id: 'sgc2_bread', arg: tid(th), label: 'Here: have something to eat.' }];
    if (th.vars.trust >= 2) out.push({ id: 'sgc2_truth', arg: tid(th), label: 'You can tell me the truth. I won\'t be angry.' });
    void pid;
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0xc2d + Math.floor(S.now / 60));
    S.touch(th, pid);
    if (id === 'sgc2_tell') {
      th.vars.trust++;
      return { lines: [th.vars.truth === 'true' ? pick(rng, ['There was smoke, and men with torches, and Mam said run. So I ran.', 'It was by a river. There were ducks. There aren\'t any ducks now.']) : pick(rng, ['It was... big. With a church. And, um. Fire. Lots of fire.', 'I don\'t want to talk about it. (They look at your purse.)', 'It had a castle. I mean, it didn\'t. It had a barn.'])] };
    }
    if (id === 'sgc2_bread') {
      const p = S.game.player;
      const food = p.inv.find((q) => q && ITEMS[q.item] && ITEMS[q.item].kind === 'food');
      if (!food) return { lines: ['(You haven\'t any food on you.)'] };
      removeItem(p.inv, food.item, 1);
      th.vars.trust += 2;
      return { lines: ['(They eat it so fast you worry they\'ll choke.) Thank you.'] };
    }
    if (id === 'sgc2_truth') {
      const v = th.vars.truth;
      S.dismissActor(th, 'child');
      if (v === 'true') {
        S.end(th, 'helped', `${nameOf(S, R.pl(pid))} sat with ${th.vars.name} until they told it all. It was true: the village is gone. ${nameOf(S, R.pl(pid))} found them a bed with a kind family in ${townName(S, th.sid)}.`, { news: [th.sid] });
        return { lines: ['I did tell the truth. I did. (And then they cry, properly, for the first time.)'], close: true };
      }
      if (v === 'runaway') {
        S.end(th, 'sent home', `${th.vars.name} admitted to ${nameOf(S, R.pl(pid))} that they'd run away from home. A carter took them back, with a letter for their father from the mayor.`, { news: [th.sid] });
        return { lines: ['...There wasn\'t a fire. My da hits me. I\'m not going back. ...Unless someone tells him not to.'], close: true };
      }
      if (v === 'pickpocket') {
        S.person(pid).fame += 0.5;
        S.end(th, 'caught', `${th.vars.name} turned out their pockets for ${nameOf(S, R.pl(pid))}: eleven purses. The village never burnt. The purses went back to their owners, and the child went to the temple, which may be a punishment for everyone.`, { news: [th.sid] });
        return { lines: ['...Fine. (They turn out their pockets. Purse after purse after purse.) Don\'t tell the watch. Please.'], close: true };
      }
      S.give(pid, 'coin', 40);
      S.end(th, 'claimed', `${th.vars.name} told ${nameOf(S, R.pl(pid))} who they really were: a lord's heir, run off from the castle. ${nameOf(S, R.pl(pid))} took them home, and was well paid for it.`, { news: [th.sid] });
      return { lines: ['My father is Lord of the Westmarch. Please don\'t make me go back. ...Fine. But you\'re coming with me, and you\'re getting a reward, and that\'s an order.'], close: true };
    }
    return null;
  },
});

// ------------------------------------------------------------ a stranger with no past
motif({
  id: 'no_memory',
  family: 'roads',
  max: 1,
  key: (o) => `nomem:${o.sid}`,
  title: () => 'The Stranger Who Can\'t Remember',
  scan(S, rng) {
    if (!rng.chance(0.025)) return null;
    const L = rng.pick(laidTowns(S));
    return L ? { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id } : null;
  },
  nodes: {
    found: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0xa3e);
        th.vars.truth = S.choose(th, [{ to: 'noble', w: 0.6 }, { to: 'deserter', w: 0.8 }, { to: 'outlaw', w: 0.7 }, { to: 'scholar', w: 0.6 }, { to: 'nobody', w: 1 }], rng).to;
        const kind = { noble: 'merchant', deserter: 'soldier', outlaw: 'outlaw', scholar: 'scholar', nobody: 'refugee' }[th.vars.truth];
        const p = makePerson(rng, L.settlement.style || 'vale', kind);
        p.weapon = null;
        th.vars.person = p;
        th.vars.real = `${p.name.first} ${p.name.last}`;
        th.vars.clues = 0;
        const at = townMid(L.settlement);
        S.actor(th, { key: 'stranger', kind: 'npc', role: 'stranger', talk: true, at, stay: true, person: { ...p, name: { first: 'Nobody', last: '' }, title: 'Stranger' }, orders: { home: at, roam: 4, mark: 'talk', lines: ['Do I know you?', 'I keep almost remembering.', 'What is this place?'] } });
        S.note(th, `A stranger was found by the road outside ${L.settlement.name}, with a cut on the head, a ${pick(rng, ['ring', 'knife', 'letter with the name torn off', 'tattoo on the wrist'])}, and no memory at all. Not even a name.`, { news: [th.sid] });
      },
      day(th, S, rng) {
        if ((S.now - th.nodeAt) / DAY > 7) {
          const L = layoutOf(S, th.sid);
          S.dismissActor(th, 'stranger');
          if (L && rng.chance(0.5)) {
            newcomer(S.sim, L, { name: { first: pick(rng, ['Wren', 'Hal', 'Bryn', 'Moss']), last: 'Roadfound' }, look: th.vars.person.look, personality: th.vars.person.personality, why: 'found by the road' });
            return S.end(th, 'new life', `The stranger never remembered. They took a new name, Roadfound, and a job, and a room in ${L.settlement.name}. They seem happy. Sometimes they look at the road a long time.`, { news: [th.sid] });
          }
          return S.end(th, 'walked off', 'The stranger with no memory walked off one morning, as if they\'d suddenly remembered somewhere to be.');
        }
      },
      fade: 9,
    },
  },
  hello() {
    return 'Do you know me? Please say you know me.';
  },
  talk(th, a) {
    if (a.role !== 'stranger') return [];
    const out = [
      { id: 'sgn2_ring', arg: tid(th), label: 'What\'s that on your hand? Does it mean anything?' },
      { id: 'sgn2_blade', arg: tid(th), label: '(Toss them a stick.) Catch!' },
      { id: 'sgn2_read', arg: tid(th), label: 'Can you read this sign?' },
    ];
    if (th.vars.clues >= 2) out.push({ id: 'sgn2_remember', arg: tid(th), label: 'Think. Close your eyes. Who are you?' });
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const v = th.vars.truth;
    S.touch(th, pid);
    const done = (th.vars.tried ||= []);
    if (!done.includes(id)) {
      done.push(id);
      th.vars.clues++;
    }
    if (id === 'sgn2_ring') return { lines: [v === 'noble' ? 'A signet. A boar, rampant. Why do I know the word "rampant"?' : v === 'outlaw' ? 'A tattoo: a broken chain. It makes my hands go cold. I don\'t know why.' : v === 'deserter' ? 'A scar where a badge was cut off. I think I cut it off myself.' : v === 'scholar' ? 'Ink stains. Old ones, deep in. I must have written a great deal.' : 'Nothing. Calluses. I must have worked.'] };
    if (id === 'sgn2_blade') return { lines: [v === 'deserter' || v === 'outlaw' ? '(They catch it without looking, and are in a fighting stance before they know it.) ...Oh.' : v === 'noble' ? '(They catch it, and hold it like a fencing foil, elegantly.) Huh.' : '(It bounces off their head.) Ow. Was that a test?'] };
    if (id === 'sgn2_read') return { lines: [v === 'scholar' ? 'Of course. And the old script under it, and the older one under THAT. ...How do I know that?' : v === 'noble' ? '"Tavern." Yes. I read. Everyone reads. Don\'t they?' : '(They frown at it a long time.) ...No. No, I don\'t think I can.'] };
    if (id === 'sgn2_remember') {
      S.dismissActor(th, 'stranger');
      const L = layoutOf(S, th.sid);
      const nm = th.vars.real;
      if (v === 'noble') {
        S.give(pid, 'coin', 50);
        S.end(th, 'remembered', `With ${nameOf(S, R.pl(pid))}'s help, the stranger remembered: ${nm}, of a noble house, waylaid on the road. Their family sent ¤50 and a carriage.`, { news: [th.sid] });
        return { lines: [`${nm}. My name is ${nm}. My house... oh, they'll be frantic. You'll be rewarded. You'll be very well rewarded.`], close: true };
      }
      if (v === 'deserter') {
        S.end(th, 'remembered', `The stranger remembered: ${nm}, a soldier who walked away from the war. ${pick(S.rng(th, 9), ['They\'re going back to face it.', 'They\'re not going back. Nobody here will tell.'])}`, { news: [th.sid] });
        return { lines: [`${nm}. Third company. I walked away. I couldn't... I walked away. And now I remember why.`], close: true };
      }
      if (v === 'outlaw') {
        const reform = S.rng(th, 7).chance(0.6);
        if (reform && L) newcomer(S.sim, L, { name: { first: nm.split(' ')[0], last: nm.split(' ').slice(1).join(' ') || 'Roadfound' }, look: th.vars.person.look, personality: th.vars.person.personality, why: 'found by the road' });
        S.end(th, 'remembered', `The stranger remembered: ${nm}, an outlaw, left for dead by their own band. ${reform ? `They've chosen to stay in ${townName(S, th.sid)} and be someone else.` : 'They were gone by morning, back to the hills.'}`, { news: [th.sid] });
        return { lines: [`${nm}. They called me ${nm} the Knife. My own band left me in a ditch. ...I don't think I want to be them any more.`], close: true };
      }
      if (v === 'scholar') {
        const s = S.game.world.ow.settlements[th.sid];
        if (s && S.sim.tech && S.sim.tech.addPoints) S.sim.tech.addPoints(s, 3, S.day);
        S.end(th, 'remembered', `The stranger remembered: ${nm}, a scholar, robbed on the road. They stayed a week, teaching the town's children before going on.`, { news: [th.sid] });
        return { lines: [`${nm}. I was bound for the Academy. My notes! ...Gone. Well. I'll write them again. Better.`], close: true };
      }
      S.end(th, 'remembered', `The stranger remembered: ${nm}, nobody in particular, from a farm two valleys over. They cried with relief.`, { news: [th.sid] });
      return { lines: [`${nm}! I'm ${nm}! I have a farm! I have a GOAT! I have to feed the goat!`], close: true };
    }
    return null;
  },
});

// ------------------------------------------------------------ the travelling show
motif({
  id: 'show',
  family: 'roads',
  max: 1,
  key: (o) => `show:${o.sid}`,
  title: (th) => `${th.vars.troupe} Comes to ${th.vars.townName}`,
  scan(S, rng) {
    if (!rng.chance(0.04)) return null;
    const L = rng.pick(laidTowns(S));
    return L ? { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { troupe: rng.pick(['Madame Orsolya\'s Marvels', 'the Brothers Fennick', 'the Lantern Players', 'Captain Gull\'s Travelling Wonders']), townName: L.settlement.name } } : null;
  },
  nodes: {
    camped: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x540);
        if (S.sim.camps && S.sim.camps.pitch) S.sim.camps.pitch(L, `show:${th.id}`, 'nomad', 3, S.now + 4 * DAY, th.id);
        th.vars.twist = S.choose(th, [
          { to: 'joy', w: 1.2 },
          { to: 'theft', w: 0.8 },
          { to: 'runaway', w: adults(L).some((r) => single(L, r) && (has(r, 'romantic') || has(r, 'curious'))) ? 0.8 : 0 },
          { to: 'strongman', w: 0.7 },
        ], rng).to;
        S.note(th, `${th.vars.troupe} has pitched its tents outside ${L.settlement.name}: tumblers, a fire-eater, a strongman, and a woman who swallows swords. Shows every night.`, { news: [th.sid] });
        const at = townMid(L.settlement);
        const p = makePerson(rng, 'vale', 'champion');
        th.vars.strong = `${p.name.first} the Mighty`;
        if (th.vars.twist === 'strongman') S.actor(th, { key: 'strong', kind: 'npc', role: 'strongman', talk: true, at, stay: true, person: { ...p, weapon: null, title: 'Strongman' }, orders: { home: at, roam: 3, mark: 'talk', lines: ['Who will wrestle the Mighty?', '¤20 to anyone who can throw me!', '*flexes*'] } });
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const days = (S.now - th.nodeAt) / DAY;
        for (const r of living(L)) r.mood = Math.min(1, (r.mood ?? 0.5) + 0.03);
        if (th.vars.twist === 'theft' && days >= 1 && !th.vars.stolen) {
          th.vars.stolen = true;
          const thief = someone(L, rng, (r) => has(r, 'shrewd') || has(r, 'stingy') || (r.life && r.life.vice === 'thief'));
          th.vars.thief = thief ? thief.idx : null;
          const m = mayorOf(L);
          S.note(th, `${m ? `${fullName(m)}'s` : 'The council\'s'} silver candlesticks have gone missing. Everyone says it was the show folk.`, { news: [th.sid] });
          if (thief) {
            const t = S.post(th, {
              role: 'thief', kind: 'talk', title: 'Find out who really took the candlesticks', sid: th.sid, giver: null,
              pitch: 'The show folk swear they never touched them. The town wants them gone. Somebody should find out.',
              reward: { coins: 15, from: R.town(th.sid), rep: 15, fame: 1 },
            });
            t.rumour = 'The show folk are blamed for a theft';
          }
        }
        if (days > 3) {
          S.dismissActor(th, 'strong');
          if (S.sim.camps && S.sim.camps.strike) S.sim.camps.strike(`show:${th.id}`);
          const v = th.vars.twist;
          if (v === 'runaway') {
            const r = someone(L, rng, (q) => single(L, q) && (has(q, 'romantic') || has(q, 'curious')));
            if (r) {
              r.away = true;
              r.migrated = 'the show';
              if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
              return S.end(th, 'ran off with the show', `${th.vars.troupe} moved on, and ${fullName(r)} went with them: to learn the tightrope, they said. ${pick(rng, ['Their family are furious.', 'A letter came a month later, from three towns away, with a drawing of them upside down.'])}`, { news: [th.sid] });
            }
          }
          if (v === 'theft' && !th.vars.cleared) return S.end(th, 'run out', `${th.vars.troupe} was run out of ${L.settlement.name} over the candlesticks. ${th.vars.thief !== null ? 'The candlesticks were never found. Not with the show, anyway.' : ''}`, { news: [th.sid] });
          return S.end(th, 'moved on', `${th.vars.troupe} packed up and moved on. ${pick(rng, ['The children are walking on their hands everywhere.', 'Someone\'s been trying to eat fire. They\'re fine.', 'The town is quieter now, and duller.'])}`, { news: [th.sid] });
        }
      },
      fade: 6,
    },
  },
  hello(th) {
    return 'Step up! Step up! Who\'ll try their strength against the Mighty?';
  },
  talk(th, a) {
    if (a.role !== 'strongman') return [];
    return [{ id: 'sgs3_wrestle', arg: tid(th), label: 'I\'ll wrestle you.' }];
  },
  townTalk(th, npc, pid, S) {
    if (th.vars.twist !== 'theft' || !th.vars.stolen || th.vars.cleared || !npc.rec || npc.rec.sid !== th.sid || npc.rec.age === 'child') return [];
    if (npc.rec.idx === th.vars.thief) return [{ id: 'sgs3_accuse', arg: tid(th), label: 'The candlesticks. I know it was you.' }];
    if ((npc.id + th.id) % 3 === 0 && !(th.vars.heard || []).includes(pid)) return [{ id: 'sgs3_ask', arg: tid(th), label: 'Seen anyone with silver candlesticks?' }];
    return [];
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x541);
    const L = layoutOf(S, th.sid);
    if (id === 'sgs3_wrestle') {
      const at = { x: Math.round(npc.x), z: Math.round(npc.z) };
      S.dismissActor(th, 'strong');
      S.actor(th, { key: 'bout', kind: 'npc', role: 'champion', hostile: true, at, person: { ...makePerson(rng, 'vale', 'champion'), weapon: null, name: { first: th.vars.strong.split(' ')[0], last: 'the Mighty' } }, orders: { target: pid, brave: true, cry: 'HUP!' } });
      th.vars.wrestler = pid;
      return { lines: ['HA! A brave one! The crowd gathers!'], close: true };
    }
    if (id === 'sgs3_ask') {
      (th.vars.heard ||= []).push(pid);
      const thief = L && th.vars.thief !== null ? L.npcs[th.vars.thief] : null;
      return { lines: [thief && rng.chance(0.6) ? `Funny you should ask. I saw ${fullName(thief)} coming out of the council house late that night, with a sack.` : pick(rng, ['Not me. It was the show folk, everyone says so.', 'I saw nothing. I sleep like the dead.'])] };
    }
    if (id === 'sgs3_accuse') {
      S.touch(th, pid);
      if (persuade(S, npc, rng, 0.35, 0.1)) {
        th.vars.cleared = true;
        const t = S.tasksOf(th, 'thief')[0];
        if (t) S.complete(t, R.pl(pid));
        repWith(S, L, npc.rec, -20);
        S.end(th, 'cleared', `${nameOf(S, R.pl(pid))} found the council's candlesticks under ${fullName(npc.rec)}'s floorboards, not with the show folk. ${th.vars.troupe} gave one last show, free, for the whole town.`, { news: [th.sid] });
        return { lines: ['...They were just SITTING there. Nobody was using them. ...Fine. They\'re under the floorboards.'], close: true };
      }
      return { lines: ['How dare you. I\'ll have the watch on you.'] };
    }
    return null;
  },
  on: {
    duel_won(th, ev, S) {
      if (ev.actor !== `${th.id}:bout`) return;
      S.dismissActor(th, 'bout');
      const pid = th.vars.wrestler;
      if (pid) {
        S.give(pid, 'coin', 20);
        S.person(pid).fame += 1;
        S.note(th, `${nameOf(S, R.pl(pid))} threw ${th.vars.strong} in front of half the town, and won ¤20.`, { by: pid, news: [th.sid] });
      }
    },
    player_yielded(th, ev, S) {
      if (ev.byActor !== `${th.id}:bout`) return;
      S.dismissActor(th, 'bout');
    },
  },
  tasks: { thief: {} },
});

// ------------------------------------------------------------ a noble in hiding
motif({
  id: 'hidden_noble',
  family: 'roads',
  max: 1,
  key: (o) => `noble:${o.sid}`,
  title: (th) => `The Farmhand with Soft Hands`,
  scan(S, rng) {
    if (!rng.chance(0.025)) return null;
    for (const L of rng.shuffle(laidTowns(S).filter((q) => q.settlement.type !== 'city')).slice(0, 3)) {
      if (!L.fields || !L.fields.length) continue;
      return { cast: { town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { why: rng.pick(['an arranged marriage', 'a cruel father', 'a crown they never wanted', 'a duel they\'d lost', 'boredom, mostly']) } };
    }
    return null;
  },
  nodes: {
    hiding: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        if (!L) return S.end(th, 'faded');
        const rng = S.rng(th, 0x40b);
        const r = newcomer(S.sim, L, { name: { first: pick(rng, ['Tobias', 'Isolde', 'Perrin', 'Seraphine', 'Lucan', 'Avelina']), last: 'Smith' }, personality: { kindness: 0.7, sociability: 0.5 }, traits: ['proud', 'bookish'], job: 'farmer', why: 'arrived' });
        th.cast.noble = R.rec(th.sid, r.idx);
        th.names.noble = fullName(r);
        th.vars.house = pick(rng, ['Ashcombe', 'Valerane', 'Thornwick', 'Morrow']);
        th.vars.reward = 60 + rng.int(0, 60);
        ledger(L, S.day, `${fullName(r)} has taken work on the farms in ${L.settlement.name}. Their hands blister, and they say "pardon me" to the cows.`);
        S.note(th, `${fullName(r)} is not a farmhand. They're the heir of House ${th.vars.house}, fled from ${th.vars.why}.`, { hidden: true });
        th.vars.ridersDay = S.day + rng.int(2, 4);
      },
      day(th, S, rng) {
        const L = layoutOf(S, th.sid);
        const r = recOf(S, th.cast.noble);
        if (!L || !r || !alive(r)) return S.end(th, 'faded');
        if (S.day >= th.vars.ridersDay && !th.vars.riders) {
          th.vars.riders = true;
          S.note(th, `Riders of House ${th.vars.house} came through ${L.settlement.name}, asking after a young noble "with fine manners and soft hands". There's a reward of ¤${th.vars.reward}.`, { news: [th.sid] });
          // (Love found here, now and then.)
          const o = someone(L, rng, (q) => q !== r && single(L, q) && !q.courting);
          if (o && rng.chance(0.4) && !r.courting) S.split(th, 'courtship', { cast: { a: th.cast.noble, b: R.rec(th.sid, o.idx), town: R.town(th.sid) }, sid: th.sid, vars: { met: 'in the hayfields', ha: 0.7, hb: 0.6 } });
        }
        const days = (S.now - th.nodeAt) / DAY;
        if (days > 9) {
          // (The town keeps the secret, or doesn't.)
          const tell = adults(L).filter((q) => has(q, 'stingy') || has(q, 'gossipy')).length;
          if (rng.chance(Math.min(0.7, 0.2 + tell * 0.1))) {
            r.away = true;
            r.migrated = 'home';
            if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
            return S.end(th, 'taken home', `Someone in ${L.settlement.name} told the riders of House ${th.vars.house}. ${th.names.noble} was taken home in a closed carriage. ${pick(rng, ['They waved, once.', 'The reward bought the tavern a new roof.'])}`, { news: [th.sid] });
          }
          return S.end(th, 'stayed', `${th.names.noble} stayed in ${L.settlement.name}. Everyone knows who they are. Nobody has said a word to the riders. They've stopped saying "pardon me" to the cows.`, { news: [th.sid] });
        }
      },
      fade: 12,
    },
  },
  townTalk(th, npc, pid, S) {
    if (th.done || !isRec(npc, th.cast.noble)) return [];
    const out = [];
    if (!th.vars.known || !th.vars.known.includes(pid)) out.push({ id: 'sgn3_who', arg: tid(th), label: 'You\'re no farmhand. Who are you really?' });
    else {
      out.push({ id: 'sgn3_home', arg: tid(th), label: 'Go home. Face it.' });
      out.push({ id: 'sgn3_safe', arg: tid(th), label: 'Your secret\'s safe with me.' });
    }
    return out;
  },
  respond(th, npc, pid, id, arg, S) {
    const rng = S.rng(th, 0x40c);
    S.touch(th, pid);
    if (id === 'sgn3_who') {
      S.reveal(th, pid);
      (th.vars.known ||= []).push(pid);
      if (persuade(S, npc, rng, 0.4, 0)) return { lines: [`...Is it that obvious? House ${th.vars.house}. I ran from ${th.vars.why}. Please. Don't tell the riders.`] };
      (th.vars.known = th.vars.known.filter((q) => q !== pid));
      return { lines: ['Just a farmhand. A clumsy one. Excuse me: the cows.'] };
    }
    if (id === 'sgn3_home') {
      if (persuade(S, npc, rng, 0.25, 0.2)) {
        const r = npc.rec;
        r.away = true;
        r.migrated = 'home';
        if (r.ent && !r.ent.dead) S.game.despawnNpc(r.ent);
        S.give(pid, 'coin', Math.round(th.vars.reward / 2));
        S.end(th, 'went home', `${th.names.noble} went home to House ${th.vars.house} to face ${th.vars.why}, on ${nameOf(S, R.pl(pid))}'s advice. A purse came for ${nameOf(S, R.pl(pid))} a week later, and a letter: "You were right. Thank you."`, { news: [th.sid] });
        return { lines: ['...You\'re right. Running isn\'t living. I\'ll go back. On my own terms.'], close: true };
      }
      return { lines: ['Back to THAT? Never.'] };
    }
    if (id === 'sgn3_safe') {
      th.vars.safe = pid;
      repWith(S, layoutOf(S, th.sid), npc.rec, 20);
      return { lines: ['Thank you. Truly. If I\'m ever anybody again, you\'ll have a friend in House ' + th.vars.house + '.'] };
    }
    return null;
  },
});

// ------------------------------------------------------------ the old soldier
motif({
  id: 'old_soldier',
  family: 'roads',
  max: 2,
  key: (o) => `vet:${o.cast.vet.sid}:${o.cast.vet.idx}`,
  title: (th) => `${th.names.vet}'s Last Errand`,
  scan(S, rng) {
    if (!rng.chance(0.04)) return null;
    for (const L of rng.shuffle(laidTowns(S)).slice(0, 3)) {
      const v = living(L).find((r) => r.age === 'elder' && !r.wish);
      const far = laidTowns(S).filter((T) => T !== L);
      if (!v || !far.length) continue;
      const T = rng.pick(far);
      const f = adults(T)[0];
      if (!f) continue;
      return { cast: { vet: R.rec(L.settlement.id, v.idx), far: R.rec(T.settlement.id, f.idx), town: R.town(L.settlement.id) }, sid: L.settlement.id, vars: { errand: rng.pick(['medal', 'comrade', 'chest']), farTown: T.settlement.name } };
    }
    return null;
  },
  nodes: {
    asking: {
      enter(th, S) {
        const L = layoutOf(S, th.sid);
        const v = recOf(S, th.cast.vet);
        if (!L || !v) return S.end(th, 'faded');
        const rng = S.rng(th, 0x0e7);
        const e = th.vars.errand;
        if (e === 'medal') {
          S.note(th, `${th.names.vet} fought in the old war. They've kept a dead comrade's medal for forty years, meaning to take it to the family in ${th.vars.farTown}. They can't walk that far now.`);
          const t = S.post(th, {
            role: 'medal', kind: 'deliver', title: `Carry ${first(v)}'s comrade's medal to ${th.names.far} in ${th.vars.farTown}`, sid: th.sid, giver: th.cast.vet, target: th.cast.far,
            pitch: `He died in my arms at the ford. Told me to take this to his people. I never did. Forty years. Take it for me? Tell them he was brave. He was.`,
            reward: { coins: 15, rep: 20, fame: 1.5 },
          });
          t.offerLabel = 'You fought in the old war, didn\'t you?';
          t.item = S.writeNote(th, 'letter', 'A Medal and a Letter', ['A tarnished medal on a faded ribbon, wrapped in a letter:', '', `"He held the ford for an hour with three men. He died there. He talked about you all the time. I'm sorry it took me so long. - ${th.names.vet}"`]);
          t.n = 1;
          th.vars.letter = t.item;
        } else if (e === 'comrade') {
          S.note(th, `${th.names.vet} has heard that the comrade who saved their life in the old war is alive, in ${th.vars.farTown}: ${th.names.far}. They want to say thank you, before it's too late for either of them.`);
          const t = S.post(th, {
            role: 'comrade', kind: 'deliver', title: `Take ${first(v)}'s letter to ${th.names.far} in ${th.vars.farTown}`, sid: th.sid, giver: th.cast.vet, target: th.cast.far,
            pitch: 'They pulled me out of the river at Greyhollow. I never thanked them. Will you take this? Tell them old Ashface is still alive.',
            reward: { coins: 10, rep: 15, fame: 1 },
          });
          t.offerLabel = 'Those are old scars.';
          t.item = S.writeNote(th, 'letter', `To ${th.names.far}`, [`You pulled me out of the river at Greyhollow, and I never said thank you. Thank you. I've had forty years because of you. Come and drink with me, if your legs still work. Mine barely do. - ${th.names.vet} (Ashface)`]);
          t.n = 1;
          th.vars.letter = t.item;
        } else {
          const m = townMid(L.settlement);
          const at = spotNear(S, m.x, m.z, 60, 120, rng, { clear: 12 });
          if (!at) return S.end(th, 'faded');
          th.vars.at = at;
          S.note(th, `${th.names.vet} says that in the last days of the old war, their company buried the pay chest by the ${pick(rng, ['split oak', 'three stones', 'old shrine'])} rather than let the enemy have it. Nobody ever went back.`);
          const t = S.post(th, {
            role: 'chest', kind: 'find', title: `Dig up the old pay chest where ${first(v)} says`, sid: th.sid, giver: th.cast.vet, at, r: 3,
            pitch: 'Forty years it\'s been in the ground. Half of it\'s owed to the widows of my company. Dig it up, bring me their share, and keep the rest. I trust you. Don\'t make me wrong.',
            reward: { coins: 0, rep: 15, fame: 1 },
          });
          t.offerLabel = 'You look like you\'ve a story to tell.';
        }
      },
      day(th, S, rng) {
        const v = recOf(S, th.cast.vet);
        if (!v || !alive(v)) return S.end(th, 'too late', `${th.names.vet} died with their errand undone.`);
        if ((S.now - th.nodeAt) / DAY > 16) S.end(th, 'faded', `${th.names.vet} stopped asking. ${pick(rng, ['Their eyes went to the road, sometimes.', 'Maybe next spring, they said.'])}`);
      },
      fade: 18,
    },
    // The chest dug up: the widows' share, owed.
    owed: {
      day(th, S) {
        if ((S.now - th.nodeAt) / DAY < 5) return;
        S.townSay(th.vars.dug, th.sid, -4);
        S.end(th, 'kept', `${nameOf(S, R.pl(th.vars.dug))} dug up the old company's pay chest, and never came back with the widows' share. ${th.names.vet} knows.`, { news: [th.sid] });
      },
      fade: 8,
    },
  },
  tasks: {
    medal: {
      accepted(th, t, who, S) {
        if (who.t === 'pl' && th.vars.letter) S.give(who.pid, th.vars.letter, 1);
      },
      done(th, t, by, S) {
        S.end(th, 'delivered', `${nameOf(S, by)} carried ${th.names.vet}'s dead comrade's medal to ${th.names.far} in ${th.vars.farTown}, forty years late. They hung it over the hearth.`, { news: [th.sid] });
      },
      thanks: () => ['My grandfather\'s? ...We never knew how he died. Now we do. Thank you.'],
    },
    comrade: {
      accepted(th, t, who, S) {
        if (who.t === 'pl' && th.vars.letter) S.give(who.pid, th.vars.letter, 1);
      },
      done(th, t, by, S) {
        const rng = S.rng(th, 0x0e8);
        S.end(th, 'reunited', rng.chance(0.6) ? `${th.names.far} came all the way from ${th.vars.farTown}. The two old soldiers drank until the tavern shut, and then sang outside it.` : `${th.names.far} wrote back: "Ashface! You owe me a drink. Forty years of drinks." They write every month now.`, { news: [th.sid] });
        void by;
      },
      thanks: () => ['Ashface? ASHFACE? The old devil is alive!'],
    },
    chest: {
      reach(th, t, pid, S) {
        const rng = S.rng(th, 0x0e9);
        S.complete(t, R.pl(pid));
        const real = rng.chance(0.7);
        if (!real) {
          S.tell(pid, 'You dig until your arms ache. Someone got here first: a rotted, empty chest, and old boot-prints.', '#c8c8c8');
          return S.end(th, 'empty', `The old pay chest was found, empty. Someone found it years ago. ${th.names.vet} laughed until they cried.`);
        }
        S.give(pid, 'coin', 100);
        if (ITEMS.old_coin) S.give(pid, 'old_coin', 3);
        th.vars.dug = pid;
        th.vars.owed = 50;
        S.tell(pid, 'An iron-bound chest, rusted shut. You break it open: old coin, ¤100 of it. Half is owed to the widows.', '#ffe070');
        S.go(th, 'owed');
      },
    },
  },
  townTalk(th, npc, pid, S) {
    if (th.node !== 'owed' || th.vars.dug !== pid || !isRec(npc, th.cast.vet)) return [];
    return [{ id: 'sgv3_give', arg: tid(th), label: 'The widows\' share: ¤50.' }, { id: 'sgv3_keep', arg: tid(th), label: 'There was nothing there.' }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id === 'sgv3_give') {
      if (purse(S, pid) < 50) return { lines: ['¤50, for the widows. You have it?'] };
      S.asPid(pid, (pl) => removeItem(pl.inv, 'coin', 50));
      S.person(pid).fame += 2;
      S.end(th, 'honoured', `${nameOf(S, R.pl(pid))} dug up the old company's pay chest and brought the widows' share to ${th.names.vet}, every coin. The old soldier saluted them.`, { news: [th.sid] });
      return { lines: ['(They count it, slowly. Then they stand, which is hard for them, and salute.)', 'There are still honest folk in the world. The company would have liked you.'] };
    }
    if (id === 'sgv3_keep') {
      const rng = S.rng(th, 0x0ea);
      if (rng.chance(0.4)) {
        S.townSay(pid, th.sid, -6);
        S.end(th, 'lied', `${nameOf(S, R.pl(pid))} told ${th.names.vet} the pay chest was empty. ${th.names.vet} had seen the old coins in the market.`, { news: [th.sid] });
        return { lines: ['Empty. I see. Then whose old coin is that, being spent in the market? Get out of my house.'], close: true };
      }
      S.end(th, 'empty', `${th.names.vet} was told the old pay chest was empty. They believed it.`, { hidden: true, by: pid });
      return { lines: ['Empty. Ah, well. Somebody had it long ago. It was a fine story, though.'] };
    }
    return null;
  },
});

