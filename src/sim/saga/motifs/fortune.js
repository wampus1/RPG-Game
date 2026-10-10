// (Round 79) A stroke of luck: what the stories' director (see
// ../director.js) sends someone playing a day or two after a loss (killed,
// taken, raided, a story gone badly), so a hard run has an opening in it.
// One of:
//   - A cache: someone who heard of your bad luck tells you where their
//     grandfather buried something, a walk out of town. Yours, if you go.
//   - A patron: a well-off townsperson wants a word carried to a town
//     near by, and pays handsomely for it.
//   - A bargain: a trader has a fine piece they'll let go at a friend's
//     price, for a few days.
import { motif, R, nameOf } from '../core.js';
import { pick, laidTowns, townName, adults, isRec, purse, spotNear, townMid, directions, playerOf, DAY } from './lib.js';
import { starGear } from '../../../world/quality.js';
import { ITEMS } from '../../../world/items.js';
import { removeItem } from '../../../game/inventory.js';
import { REGION_W, REGION_D } from '../../../config.js';

const tid = (th) => `t${th.id}`;
const WHY = { death: 'after what happened to you', captured: 'after your time in chains', raid: 'after the raid', story: 'after the way things went' };
const BARGAINS = ['iron_sword', 'iron_axe', 'iron_breastplate', 'iron_helmet', 'bow', 'iron_pickaxe', 'iron_shield'];

// The town nearest them that has people in it.
function nearTown(S, p) {
  let best = null;
  let bd = Infinity;
  for (const L of laidTowns(S)) {
    const s = L.settlement;
    const d = Math.hypot((s.cx + 0.5) * REGION_W - p.x, (s.cz + 0.5) * REGION_D - p.z);
    if (d < bd) [best, bd] = [L, d];
  }
  return bd < 900 ? best : null;
}

motif({
  id: 'boon',
  family: 'fortune',
  tone: 'calm',
  max: 4,
  key: (o) => `boon|${o.vars && o.vars.pid}`,
  title: (th) => ({ cache: 'A Buried Kindness', patron: 'A Patron\'s Errand', bargain: 'A Friend\'s Price' })[th.vars.kind] || 'A Stroke of Luck',
  nodes: {
    offered: {
      enter(th, S) {
        const rng = S.rng(th, 0xb0);
        const pid = th.vars.pid;
        const p = playerOf(S.game, pid);
        const L = p ? nearTown(S, p) : null;
        if (!L) return S.end(th, 'faded');
        th.sid = L.settlement.id;
        th.cast.town = R.town(th.sid);
        const kind = (th.vars.kind ||= pick(rng, ['cache', 'patron', 'bargain']));
        const folk = adults(L).filter((r) => r.job !== 'guard' && r.job !== 'mayor');
        const who = kind === 'bargain' ? folk.find((r) => ['merchant', 'smith', 'trader', 'blacksmith'].includes(r.job)) || pick(rng, folk) : pick(rng, folk);
        if (!who) return S.end(th, 'faded');
        th.cast.giver = R.rec(th.sid, who.idx);
        th.names.giver = `${who.name.first} ${who.name.last}`;
        th.title = ({ cache: 'A Buried Kindness', patron: 'A Patron\'s Errand', bargain: 'A Friend\'s Price' })[kind];
        const why = WHY[th.vars.why] || 'after your bad luck';
        if (kind === 'cache') {
          const mid = townMid(L.settlement);
          const at = spotNear(S, mid.x, mid.z, 28, 70, rng, { clear: 6 });
          if (!at) return S.end(th, 'faded');
          th.spots = [at];
          const t = S.post(th, {
            role: 'cache', kind: 'visit', title: `Dig up what ${who.name.first}'s grandfather buried`, sid: th.sid, at, r: 3, only: [pid], days: 6,
            pitch: `${who.name.first} pulls you aside ${why}: "My grandfather buried something out ${directions(L.settlement, at.x, at.z)}. I've no use for it. You have."`,
            reward: { coins: rng.int(40, 90), items: [[pick(rng, ['gem', 'gold_ingot', 'potion_vigor', 'potion_fortitude']), 1]].filter(([k]) => ITEMS[k]), fame: 1 },
          });
          S.accept(t, R.pl(pid));
          S.game.world.ow.pin?.(at.x, at.z, 'A buried kindness', '!', { quest: true });
          S.tell(pid, `${th.names.giver} of ${L.settlement.name} has heard of your luck ${why}: there's something buried ${directions(L.settlement, at.x, at.z)}, and it's yours. (Marked on your map.)`, '#a0ffc0');
        } else if (kind === 'patron') {
          const others = laidTowns(S).filter((o) => o !== L && Math.hypot(o.settlement.cx - L.settlement.cx, o.settlement.cz - L.settlement.cz) <= 10);
          const to = others.length ? pick(rng, others) : null;
          if (!to) return S.end(th, 'faded');
          th.vars.to = to.settlement.id;
          const at = townMid(to.settlement);
          const t = S.post(th, {
            role: 'carry', kind: 'visit', title: `Carry ${who.name.first}'s word to ${to.settlement.name}`, sid: th.sid, at, r: 14, only: [pid], days: 8,
            giver: R.rec(th.sid, who.idx), hand: 'auto',
            pitch: `"I need a word carried to ${to.settlement.name}, and quickly. I hear you could use the work ${why}. It pays well."`,
            reward: { coins: rng.int(60, 110), from: { t: 'purse' }, rep: 8, fame: 1 },
          });
          S.accept(t, R.pl(pid));
          S.tell(pid, `${th.names.giver} of ${L.settlement.name} sends for you ${why}: a well-paid errand to ${to.settlement.name}. (In your quest log.)`, '#a0ffc0');
        } else {
          th.vars.item = pick(rng, BARGAINS.filter((k) => ITEMS[k]));
          th.vars.price = rng.int(15, 30);
          th.vars.until = S.now + 4 * DAY;
          S.tell(pid, `${th.names.giver}, in ${L.settlement.name}, sends word ${why}: a fine ${ITEMS[th.vars.item]?.name.toLowerCase() || 'piece'} for you at a friend's price, if you come in the next few days.`, '#a0ffc0');
        }
        S.trace?.('director', `${th.title} for ${pid}: ${kind} in ${L.settlement.name}`);
      },
      day(th, S) {
        if (th.vars.kind === 'bargain' && S.now > th.vars.until) S.end(th, 'faded', `${th.names.giver} sold the piece to someone else.`);
      },
      fade: 9,
    },
  },
  tasks: {
    cache: {
      reach(th, t, pid, S) {
        S.complete(t, R.pl(pid), `${nameOf(S, R.pl(pid))} dug up what ${th.names.giver}'s grandfather buried.`);
        S.tell(pid, 'Under a flat stone, wrapped in oilcloth: it\'s yours now.', '#a0ffc0');
        S.end(th, 'found');
      },
    },
    carry: {
      reach(th, t, pid, S) {
        S.complete(t, R.pl(pid), `${nameOf(S, R.pl(pid))} carried ${th.names.giver}'s word to ${townName(S, th.vars.to)}.`);
        S.end(th, 'done');
      },
    },
  },
  townTalk(th, npc, pid) {
    if (th.vars.kind !== 'bargain' || pid !== th.vars.pid || !isRec(npc, th.cast.giver)) return [];
    return [{ id: 'sgb_buy', arg: tid(th), label: `About that ${ITEMS[th.vars.item]?.name.toLowerCase() || 'piece'}... (¤${th.vars.price})` }];
  },
  respond(th, npc, pid, id, arg, S) {
    if (id !== 'sgb_buy') return null;
    const g = S.game;
    if (purse(S, pid) < th.vars.price) return { lines: [`It's ¤${th.vars.price}. Come back when you have it; I'll hold it a day or two.`] };
    removeItem(g.player.inv, 'coin', th.vars.price);
    const key = starGear(th.vars.item, { origin: 'c', stars: 3 });
    const left = g.player.give ? g.player.give(key, 1) : 1;
    if (left) g.spawnDrop(key, left, g.player.x, g.player.y, g.player.z, true);
    g.audio?.play('coin');
    S.end(th, 'bought', `${nameOf(S, R.pl(pid))} bought a fine ${ITEMS[th.vars.item]?.name.toLowerCase() || 'piece'} from ${th.names.giver} at a friend's price.`);
    return { lines: [pick(S.rng(th, 3), ['Take good care of it.', 'Worth twice that, you know. Don\'t tell anyone.', 'May it bring better luck than you\'ve had.'])] };
  },
});
