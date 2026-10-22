// (Round 117) Setting relic shards at an anvil: a relic from your pack in
// the relic slot, shards in the shard slot, and Set. Each shard makes the
// relic's circle reach half a pace further, for good (see game/relics.js).
// The slots only point at what's in your pack: nothing leaves it till it's
// set, and closing the window leaves everything where it was.
import { Window } from './window.js';
import { C, wrap } from './ascii.js';
import { ITEMS, SHARD_MAX } from '../world/items.js';
import { relicReach, shardRoom, setShards, salvageRelic, SALVAGE_SHARDS } from '../game/relics.js';

export class RelicAnvilWindow extends Window {
  constructor(ui) {
    super(ui, 62, 22, { kind: 'relicanvil' });
    this.relic = -1;
    this.shard = -1;
  }
  // The pack's relics and shards, by slot.
  candidates(game) {
    const inv = game.player.inv;
    const out = [];
    inv.forEach((s, i) => {
      const it = s && ITEMS[s.item];
      if (it && (it.kind === 'relic' || it.kind === 'relic_shard')) out.push(i);
    });
    return out;
  }
  draw(g, game) {
    const inv = game.player.inv;
    const kindAt = (i) => (inv[i] ? ITEMS[inv[i].item]?.kind : null);
    if (kindAt(this.relic) !== 'relic') this.relic = -1;
    if (kindAt(this.shard) !== 'relic_shard') this.shard = -1;
    g.fill(0, 0, this.w, this.h, ' ', C.fg, C.bg);
    g.box(0, 0, this.w, this.h, { bg: C.bg, double: true, title: 'THE ANVIL · RELIC SHARDS · SALVAGE' });
    // Your pack's relics and shards: click one to put it in its slot.
    g.text(2, 1, 'Your pack (click one)', C.dim);
    const list = this.candidates(game);
    if (!list.length) g.text(2, 3, 'No relics or relic shards in your pack.', C.faint);
    list.slice(0, 16).forEach((i, k) => {
      const y = 2 + k;
      const s = inv[i];
      const it = ITEMS[s.item];
      const used = i === this.relic || i === this.shard;
      const hov = this.hovering(1, y, 28, 1);
      g.fill(1, y, 28, 1, ' ', C.fg, used ? '#3a3050' : hov ? '#2a2236' : undefined);
      const label = it.kind === 'relic_shard' ? `${it.name} ×${s.count}` : `${it.name} (${it.shards || 0}/${SHARD_MAX})`;
      g.text(2, y, label.slice(0, 26), used ? C.white : it.kind === 'relic' ? it.color || C.fg : '#e0b8ff');
      this.hit(1, y, 28, 1, () => {
        if (it.kind === 'relic') this.relic = this.relic === i ? -1 : i;
        else this.shard = this.shard === i ? -1 : i;
        this.ui.audio?.play('select');
      });
    });
    // The two slots.
    const x = 32;
    const slot = (y, title, i, empty) => {
      g.text(x, y, title, C.dim);
      const hov = this.hovering(x, y + 1, 28, 3);
      g.box(x, y + 1, 28, 3, { bg: hov && i >= 0 ? '#2a2236' : '#18141e' });
      if (i < 0) g.text(x + 2, y + 2, empty, C.faint);
      else {
        const s = inv[i];
        const it = ITEMS[s.item];
        g.text(x + 2, y + 2, (it.kind === 'relic_shard' ? `${it.name} ×${s.count}` : it.name).slice(0, 24), it.kind === 'relic' ? it.color || C.white : '#e0b8ff');
        // (Clicked again: taken back out.)
        this.hit(x, y + 1, 28, 3, () => {
          if (it.kind === 'relic') this.relic = -1;
          else this.shard = -1;
          this.ui.audio?.play('select');
        });
      }
    };
    slot(1, 'Relic', this.relic, '(empty: click a relic)');
    slot(6, 'Shards', this.shard, '(empty: click shards)');
    // What setting them does.
    let y = 11;
    let can = false;
    let n = 0;
    if (this.relic >= 0) {
      const it = ITEMS[inv[this.relic].item];
      const room = shardRoom(inv[this.relic].item);
      const have = this.shard >= 0 ? inv[this.shard].count : 0;
      n = Math.min(room, have);
      g.text(x, y++, `Now: ${it.shards || 0} of ${SHARD_MAX} shards, radius ${relicReach(it.shards || 0)}`, C.fg);
      if (room <= 0) g.text(x, y++, 'It holds all the shards it can.', C.red);
      else if (n > 0) {
        g.text(x, y++, `After: ${(it.shards || 0) + n} of ${SHARD_MAX}, radius ${relicReach((it.shards || 0) + n)}`, '#a0e8c0');
        g.text(x, y++, `Uses ${n} shard${n > 1 ? 's' : ''}.`, C.dim);
        can = true;
      } else g.text(x, y++, 'Add shards to set.', C.faint);
    } else wrap(`Each shard makes a relic's circle reach ${0.5} paces further, up to ${SHARD_MAX} shards a relic.`, 28).forEach((l) => g.text(x, y++, l, C.dim));
    const label = can ? ` Set ${n} shard${n > 1 ? 's' : ''} ` : ' Set ';
    const by = this.h - 3;
    const hov = this.hovering(x, by, label.length, 1);
    g.text(x, by, label, can ? (hov ? C.white : C.hi) : C.faint, can ? (hov ? '#4a3a60' : '#2a2230') : undefined);
    if (can) this.hit(x, by, label.length, 1, (ck, gm) => this.set(gm || game));
    // (Round 139) Or the relic broken down into shards.
    if (this.relic >= 0) {
      const it = ITEMS[inv[this.relic].item];
      const sl = ` Salvage: ${SALVAGE_SHARDS + (it.shards || 0)} shards `;
      const sx = x + label.length + 2;
      const sh = this.hovering(sx, by, sl.length, 1);
      g.text(sx, by, sl, sh ? C.white : '#ffb080', sh ? '#5a3030' : '#2a2230');
      this.hit(sx, by, sl.length, 1, (ck, gm) => {
        const r = salvageRelic(gm || game, this.relic);
        if (!r.ok) return this.ui.msg(r.why, '#ffb080');
        this.relic = -1;
      });
    }
    g.text(2, this.h - 2, 'Enter: set   Esc: close', C.faint);
  }
  set(game) {
    const r = setShards(game, this.relic, this.shard);
    if (!r.ok) return this.ui.msg(r.why, '#ffb080');
    // (The relic stays in its slot, grown; the shards' slot empties if
    // they're all used.)
    if (!game.player.inv[this.shard]) this.shard = -1;
  }
  onKey(k) {
    if (k.code === 'Escape') {
      this.close();
      return true;
    }
    if (k.code === 'Enter') {
      this.set(this.ui.game);
      return true;
    }
    return false;
  }
}
