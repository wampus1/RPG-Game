// (Round 135) What's so, for what someone might say (see talk/rules.js):
// who they are and how they feel, what's on their mind, what they make of
// you; how you look and who you are (where you're from, how you came, how
// hurt or soaked or armed you are, what you hold, what you've done); and
// how things stand in their town. Worked out once each time it's asked,
// as the one talking to them (each player their own).
import { feelings, dominant } from '../../sim/mind/emotion.js';
import { recall } from '../../sim/mind/memory.js';
import { bestSkill, tradeSkill, skillWord, talentsOf, SKILLS, talentHint, ensureSkills } from '../../sim/mind/talent.js';
import { pkey } from '../../sim/mind/mind.js';
import { mutationsOf, MUTATIONS } from '../hero.js';
import { ITEMS } from '../../world/items.js';
import { alive } from '../../sim/econ.js';
import { ambitionWords } from '../../sim/mind/ambition.js';
import { groupOf, CAUSES } from '../../sim/mind/groups.js';

const TIME = (m) => {
  const h = m / 60;
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
};

// What a skill's called, said aloud.
export const SKILL_TALK = {
  cooking: 'cooking', hunting: 'hunting', fishing: 'fishing', farming: 'growing things', trading: 'trade', building: 'building', crafting: 'making things',
  combat: 'a fight', lore: 'books and learning', healing: 'healing', leadership: 'leading folk', charm: 'people',
};

export function factsFor(npc, game, leadOf = null) {
  const rec = npc.rec;
  const sim = game.sim;
  const s = npc.settlement;
  const L = npc.homeLayout || npc.layout;
  const now = sim.abs;
  const day = game.day;
  const F = { npc, game };
  // ---- who they are
  F.job = rec.job;
  F.age = rec.age;
  F.kid = rec.age === 'child';
  F.elder = rec.age === 'elder';
  const tr = rec.traits || [];
  for (const t of tr) F[`trait_${t.replace(/[^a-z]/g, '_')}`] = true;
  F.brave = tr.includes('brave');
  F.timid = tr.includes('timid');
  F.hot = tr.includes('hot-headed');
  F.kind = tr.includes('kind');
  F.gruff = tr.includes('gruff');
  F.outgoing = tr.includes('outgoing');
  F.reserved = tr.includes('reserved');
  F.lazy = tr.includes('lazy');
  F.diligent = tr.includes('hardworking');
  F.devout = tr.includes('devout') || rec.job === 'priest';
  F.partnered = rec.partner !== null && rec.partner !== undefined && L && L.npcs[rec.partner] && alive(L.npcs[rec.partner]);
  F.parent = (rec.children || []).some((i) => L && L.npcs[i] && alive(L.npcs[i]));
  F.hungry = (rec.hungry || 0) >= 1;
  F.starving = (rec.hungry || 0) >= 2;
  // ---- how they feel
  const e = feelings(rec, now) || {};
  F.joy = e.j || 0;
  F.grief = e.g || 0;
  F.fear = e.f || 0;
  F.anger = e.a || 0;
  F.shame = e.s || 0;
  F.pride = e.p || 0;
  F.love = e.l || 0;
  F.strain = e.x || 0;
  const d = dominant(rec, now, 0.3);
  F.feel = d ? d.kind : 'calm';
  F.feelV = d ? d.v : 0;
  F.mood = rec.mood ?? 0.5;
  // ---- what they can do
  if (rec.skills && L) ensureSkills(L, rec);
  const best = bestSkill(rec);
  F.bestSkill = best ? best[0] : null;
  F.bestV = best ? best[1] : 0;
  F.master = F.bestV >= 0.88;
  F.tradeV = tradeSkill(rec);
  F.green = !F.kid && F.tradeV < 0.3;
  F.skilled = F.tradeV >= 0.72;
  // ---- what's on their mind
  const ms = recall(rec, day);
  F.mem = ms[0] || null;
  for (const m of ms) {
    const k = `${m.h ? 'heard' : 'mem'}_${m.k}`;
    if (!F[k]) F[k] = m;
  }
  const pk = pkey(game);
  F.memP = ms.find((m) => m.w === pk && !m.h) || null;
  F.heardP = ms.find((m) => m.w === pk && m.h) || null;
  F.memPk = F.memP ? F.memP.k : null;
  F.heardPk = F.heardP ? F.heardP.k : null;
  // ---- what they make of you
  const op = sim.opinion(npc);
  F.op = op;
  F.opBand = op <= -60 ? 'hate' : op <= -25 ? 'dislike' : op >= 70 ? 'adore' : op >= 35 ? 'like' : 'neutral';
  F.met = !!sim.repEntry(sim.repSidOf(npc), rec.idx).met;
  // ---- you
  const h = game.hero || {};
  F.origin = h.origin || 'crash';
  F.outworlder = F.origin === 'outworlder';
  F.star = F.origin === 'star';
  F.brigand = F.origin === 'brigand';
  F.native = F.origin === 'native';
  F.kit = h.kit || null;
  const muts = mutationsOf(h);
  F.mutated = muts.length > 0;
  for (const k of muts) F[`mut_${k}`] = true;
  F.mutName = muts.length ? MUTATIONS[muts[0]].name.toLowerCase() : null;
  const p = game.player;
  const frac = p && p.maxHp ? p.hp / p.maxHp : 1;
  F.hurt = frac < 0.45;
  F.dying = frac < 0.2;
  F.weather = game.weatherIn ? game.weatherIn(s) : 'clear';
  F.indoors = !!(game.buildingAtPlayer && game.buildingAtPlayer());
  F.swimming = !!(p && game.world.isWaterAt && game.world.isWaterAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)));
  F.wet = F.swimming || (!F.indoors && (F.weather === 'rain' || F.weather === 'storm'));
  F.snowy = !F.indoors && F.weather === 'snow';
  F.tw = TIME(game.minute);
  F.night = F.tw === 'night';
  F.late = game.minute >= 22 * 60 || game.minute < 4 * 60;
  F.dawn = game.minute >= 4 * 60 && game.minute < 6.5 * 60;
  const held = p && p.inv ? p.inv[p.selected] : null;
  F.holding = held && held.item ? held.item : null;
  const hd = F.holding ? ITEMS[F.holding] : null;
  F.armed = !!(hd && hd.kind === 'weapon');
  F.holdingFood = !!(hd && hd.kind === 'food');
  F.holdingFlower = !!(F.holding && F.holding.startsWith('flower_'));
  F.holdingBook = F.holding === 'book' || F.holding === 'scroll';
  F.holdingTool = !!(hd && hd.kind === 'tool');
  const eq = (p && p.equip) || {};
  F.armoured = ['body', 'head'].some((k) => eq[k] && /iron|steel|chain|plate|mail/.test(eq[k].item || eq[k]));
  F.fine = ['body'].some((k) => eq[k] && /fine_coat|silk|velvet/.test(eq[k].item || eq[k]));
  F.ragged = !eq.body && !eq.legs;
  F.fighting = (game.combatT || 0) > 0;
  F.mounted = !!(p && p.mount);
  F.coins = p && p.inv ? p.inv.reduce((a, q) => a + (q && q.item === 'coin' ? q.count : 0), 0) : 0;
  F.rich = F.coins >= 400;
  F.broke = F.coins <= 2;
  F.wanted = !!(game.isWanted && game.isWanted(s.id));
  F.citizen = sim.isCitizen(s.id);
  F.onWatch = !!(sim.careers && sim.careers.isGuard(s.id));
  const ld = leadOf ? leadOf(game, s) : null;
  F.leader = !!ld;
  F.leadTitle = ld ? ld.title : null;
  F.leadAddress = ld ? ld.address : null;
  F.renown = sim.repSidOf(npc) === s.id && sim.renownTitle ? sim.renownTitle(s.id) : null;
  F.dread = sim.justice && sim.justice.dreadIn ? sim.justice.dreadIn(s.id) : 0;
  // ---- the town
  F.island = s.island || null;
  F.townType = s.type;
  F.poorTown = s.condition === 'poor';
  F.richTown = s.condition === 'prosperous';
  const vals = (s.civ && s.civ.values) || [];
  for (const v of vals) F[`civ_${v}`] = true;
  F.taxHigh = !!(L && L.econ && L.econ.tax >= 0.15);
  const ev = L && sim.events && sim.events.upcoming ? sim.events.upcoming(L) : [];
  F.festivalSoon = ev.some((q) => q.kind !== 'wedding' && q.day - day <= 2 && q.day >= day);
  F.weddingSoon = ev.some((q) => q.kind === 'wedding' && q.day - day <= 2 && q.day >= day);
  // ---- (Round 136) what they're after, and who they stand with
  const amb = rec.amb || null;
  F.amb = amb ? amb.k : null;
  if (amb) F[`amb_${amb.k}`] = true;
  F.ambSt = amb ? amb.st || 0 : 0;
  F.ambP = amb ? amb.p || 0 : 0;
  F.ambOnYou = !!(amb && amb.t === pk);
  const grp = L ? groupOf(L, rec) : null;
  F.grp = grp ? grp.k : null;
  if (grp) F[`grp_${grp.k}`] = true;
  F.grpSt = grp ? grp.st : null;
  F.grpLead = !!(grp && grp.lead === rec.idx);
  F.grpOnYou = !!(grp && grp.k === 'player' && grp.x === pk);
  F.seekK = rec.seek && rec.seek.pk === pk ? rec.seek.k : null;
  F.friends = (rec.friends || []).length;
  // ---- the words they can be filled with
  const name = game.playerName || 'friend';
  F.vars = {
    name: name.split(' ')[0],
    full: name,
    me: rec.name ? rec.name.first : 'I',
    town: s.name,
    tw: F.tw,
    trade: rec.job,
    skill: F.bestSkill ? SKILL_TALK[F.bestSkill] : null,
    skillWord: skillWord(F.bestV),
    mut: F.mutName,
    title: F.leadTitle,
    address: F.leadAddress,
    held: hd ? (hd.name || F.holding).toLowerCase() : null,
  };
  const n = (m) => (m && m.n ? m.n : null);
  F.vars.dead = n(F.mem_loss);
  F.vars.child = n(F.mem_born);
  F.vars.spouse = n(F.mem_wed);
  F.vars.gift = F.mem_gift && F.mem_gift.x ? (ITEMS[F.mem_gift.x]?.name || F.mem_gift.x).toLowerCase() : null;
  F.vars.killed = n(F.memP && F.memP.k === 'killed' ? F.memP : F.heardP && F.heardP.k === 'killed' ? F.heardP : null);
  F.vars.lost = F.mem_loss ? F.mem_loss.x : null;
  F.vars.ambWho = amb && amb.n ? amb.n : null;
  F.vars.ambWhat = amb ? ambitionWords(rec) : null;
  F.vars.ambTrade = amb && (amb.k === 'trade' || amb.k === 'master') ? amb.x : null;
  F.vars.ambBiz = amb && amb.k === 'venture' && amb.x ? amb.x : null;
  F.vars.grpLeader = grp ? (grp.lead === rec.idx ? 'me' : grp.ln.split(' ')[0]) : null;
  F.vars.grpAsk = grp ? CAUSES[grp.k].ask : null;
  F.vars.grpWhat = grp ? CAUSES[grp.k].what : null;
  F.vars.grpDead = grp && grp.k === 'vigil' ? grp.x : null;
  const fm = F.mem_friend || null;
  F.vars.friend = fm && fm.n ? fm.n : null;
  const rv = F.mem_rival || null;
  F.vars.rival = rv && rv.n ? rv.n : null;
  const hb = F.mem_heartbreak || F.mem_rejected || null;
  F.vars.lostLove = hb && hb.n ? hb.n : null;
  const bw = F.heard_bad_word || null;
  F.vars.badWho = bw && bw.n ? bw.n : null;
  F.vars.badTeller = bw && bw.x ? bw.x : null;
  // (A child's or a partner's gift or blind spot, as the proud or worried
  // would put it: see talentHint.)
  F.vars.kin = null;
  F.vars.kinGift = null;
  if (L) {
    for (const ci of rec.children || []) {
      const c = L.npcs[ci];
      if (!c || !alive(c) || c.age !== 'child') continue;
      const t = talentsOf(L, c);
      let bi = 0;
      for (let i = 1; i < t.length; i++) if (t[i] > t[bi]) bi = i;
      if (talentHint(t[bi]) === 'a gift' || talentHint(t[bi]) === 'a knack') {
        F.vars.kin = c.name.first;
        F.vars.kinGift = SKILL_TALK[SKILLS[bi]];
        F.kinGifted = talentHint(t[bi]);
        break;
      }
    }
  }
  // ---- (Round 147) the town's great places: what's on at them today,
  // what was called off, how the last of it went, and whether this one
  // works there (and if they're one to talk of it: about half the town)
  F.qJob = rec.qtag && rec.qtag.includes(':') ? rec.qtag.slice(rec.qtag.indexOf(':') + 1) : null;
  F.qFan = !!F.qJob || ((rec.idx * 2654435761) >>> 0) % 2 === 0;
  F.qOn = null;
  F.qNow = false;
  F.qCrowd = false;
  F.qOff = null;
  F.qPast = null;
  F.qCheers = false;
  const qs = (L && L.econ && L.quarters) || [];
  if (qs.length && sim.cities) {
    const C = sim.cities;
    for (const q of qs) {
      for (const e of C.eventsOf(L, q.i)) {
        if (e.off) {
          if (!F.qOff) {
            F.qOff = e.off;
            F.vars.qOffShow = e.title;
          }
        } else if (!e.done && e.e > now && !F.qOn) {
          F.qOn = e.type;
          F.qNow = now >= e.s;
          F.qCrowd = (e.crowd || 0) > 0;
          F.vars.qShow = e.title;
          F.vars.qPlace = q.name;
          const m = ((e.s % 1440) + 1440) % 1440;
          F.vars.qAt = `${Math.floor(m / 60) % 12 || 12}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''}${m < 720 ? 'am' : 'pm'}`;
        }
      }
    }
    const past = C.qs(L).past;
    const P = past.length ? past[past.length - 1] : null;
    if (P && P.n && day - P.day <= 2 && P.res && !P.res.startsWith('called off')) {
      F.qPast = P.type;
      F.qCheers = P.res === 'to cheers';
      F.vars.qPastShow = P.title;
      F.vars.qRes = P.res.split('; ')[0];
    }
  }
  return F;
}
