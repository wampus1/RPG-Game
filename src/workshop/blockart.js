// Pictures of blocks for the Workshop (round 62): the game's own, from its
// texture atlas, and a mod's, from their art; as the game draws them (a
// cube's top and front, a prop's sprite), and as a small icon for lists.
import { TEX, SPR_H, TALL_H } from '../render/textures.js';
import { BLOCKS, B, META_ROT, META_STATE } from '../world/blocks.js';
import { LH } from '../config.js';
import { canvas } from './kit.js';
import { composite, resample } from '../mod/format.js';
import { NODES } from '../mod/graph.js';

const cache = new Map();

function fromAtlas(s, w, h) {
  const c = canvas(w, h);
  if (s && TEX.atlas) c.getContext('2d').drawImage(TEX.atlas, s.x, s.y, w, h, 0, 0, w, h);
  return c;
}

function rgbaCanvas(d, w, h) {
  const c = canvas(w, h);
  c.getContext('2d').putImageData(new ImageData(d, w, h), 0, 0);
  return c;
}

// How a block looks: { render, top, front, sprite, tall, see } (canvases),
// turned and in the state its `meta` gives (a door open, a torch lit).
export function blockArt(app, ref, meta = 0) {
  if (!ref || ref === 'keep') return null;
  const mod = ref[0] === '@' && app ? app.mod : null;
  const vb = !mod && B[ref] !== undefined ? BLOCKS[B[ref]] : null;
  const rot = vb && vb.rotatable ? meta & META_ROT : 0;
  const st = meta & META_STATE ? 1 : 0;
  const k = mod ? `${ref}:${modArtKey(app, ref.slice(1))}` : `${ref}:${rot}:${st}`;
  if (cache.has(k)) return cache.get(k);
  let art = null;
  if (mod) art = modBlockArt(app, ref.slice(1));
  else if (ref === 'air') art = { render: 'air' };
  else {
    const id = B[ref];
    const b = vb;
    if (b) {
      if (b.render === 'cube' || b.render === 'liquid' || b.render === 'door') {
        const t = (TEX.top[id * 4 + rot] || TEX.top[id * 4] || [])[0];
        const f = (TEX.front[id * 4 + rot] || TEX.front[id * 4] || [])[0];
        art = { render: 'cube', top: fromAtlas(t, 16, 16), front: fromAtlas(f, 16, LH), liquid: b.render === 'liquid', see: b.render !== 'cube' || b.opaque === false };
      } else if (b.render === 'fence') {
        const f = TEX.misc && TEX.misc.fence;
        const c = canvas(16, SPR_H);
        if (f && TEX.atlas) for (const part of [f.west, f.post, f.east]) c.getContext('2d').drawImage(TEX.atlas, part.x, part.y, part.w, part.h, 0, 0, part.w, part.h);
        art = { render: 'sprite', sprite: c };
      } else if (b.render === 'none' || b.render === 'placed') art = { render: 'air' };
      else {
        const arr = TEX.sprite[id * 4 + rot] || TEX.sprite[id * 4] || [];
        const s = arr[st * 4] || arr[0];
        if (b.render === 'flat') art = { render: 'flat', top: fromAtlas(s, 16, 16) };
        else art = { render: 'sprite', sprite: s ? fromAtlas(s, s.w, s.h) : canvas(16, SPR_H), tall: !!b.tall };
      }
    }
  }
  cache.set(k, art);
  return art;
}

function modArtKey(app, id) {
  const e = app.mod.entities[id];
  if (!e) return 'gone';
  const r = (e.graph.nodes || []).find((n) => n.type === 'tpl.block');
  if (!r) return 'none';
  const v = r.v || {};
  const p = r.p || {};
  const a = app.mod.assets[v.texture];
  const s = app.mod.assets[v.side];
  return `${v.texture}:${a ? a.frames[0].cels.l1?.length : 0}:${a ? JSON.stringify(a.frames[0].cels).length + a.palette.join('') : ''}:${v.side}:${s ? JSON.stringify(s.frames[0].cels).length : 0}:${p.shape}`;
}

function modBlockArt(app, id) {
  const e = app.mod.entities[id];
  const r = e && (e.graph.nodes || []).find((n) => n.type === 'tpl.block');
  if (!r) return null;
  const v = r.v || {};
  const shape = (r.p && r.p.shape) || 'cube';
  const a = app.mod.assets[v.texture];
  const color = app.mod.color || '#ff40ff';
  const flat = (asset, w, h) => (asset ? rgbaCanvas(resample(composite(asset, 0), asset.w, asset.h, w, h), w, h) : checker(color, w, h));
  if (shape === 'cube') {
    const top = flat(a, 16, 16);
    const side = app.mod.assets[v.side];
    const front = side ? flat(side, 16, LH) : darkFront(top);
    return { render: 'cube', top, front, mod: true };
  }
  if (shape === 'flat') return { render: 'flat', top: flat(a, 16, 16), mod: true };
  const tall = shape === 'tall';
  const H = tall ? TALL_H : SPR_H;
  const c = canvas(16, H);
  if (a) {
    const maxH = tall ? 36 : 24;
    const d = resample(composite(a, 0), a.w, a.h, 16, maxH, 'contain', true);
    c.getContext('2d').drawImage(rgbaCanvas(d, 16, maxH), 0, H - 3 - maxH);
  } else c.getContext('2d').drawImage(checker(color, 16, 16), 0, H - 19);
  return { render: 'sprite', sprite: c, tall, mod: true };
}

function checker(color, w, h) {
  const c = canvas(w, h);
  const x = c.getContext('2d');
  for (let y = 0; y < h; y += 4) for (let xx = 0; xx < w; xx += 4) {
    x.fillStyle = ((xx + y) / 4) % 2 ? color : '#2a2233';
    x.fillRect(xx, y, 4, 4);
  }
  return c;
}

function darkFront(top) {
  const c = canvas(16, LH);
  const x = c.getContext('2d');
  x.drawImage(top, 0, 4, 16, LH, 0, 0, 16, LH);
  x.fillStyle = 'rgba(10,6,20,0.3)';
  x.fillRect(0, 0, 16, LH);
  return c;
}

// A small icon of a block (a cube seen a little from above; a sprite as
// it is), `size` across.
export function blockIcon(app, ref, size = 32) {
  const art = blockArt(app, ref);
  const c = canvas(size, size);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  if (!art) return c;
  if (art.render === 'air') {
    x.strokeStyle = '#5e5470';
    x.setLineDash([3, 3]);
    x.strokeRect(size * 0.15 + 0.5, size * 0.15 + 0.5, size * 0.7, size * 0.7);
    return c;
  }
  if (art.render === 'cube') {
    const k = size / 28;
    x.drawImage(art.top, 0, 0, 16, 16, size * 0.2, 0, 16 * k * 1.1, 16 * k);
    x.drawImage(art.front, 0, 0, 16, LH, size * 0.2, 16 * k, 16 * k * 1.1, LH * k);
    return c;
  }
  if (art.render === 'flat') {
    x.drawImage(art.top, size * 0.15, size * 0.15, size * 0.7, size * 0.7);
    return c;
  }
  const s = art.sprite;
  const k = Math.min(size / s.width, size / s.height);
  x.drawImage(s, (size - s.width * k) / 2, size - s.height * k, s.width * k, s.height * k);
  return c;
}

export function forgetBlockArt(prefix = '@') {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}

// The mod's own blocks: ['@id', name].
export function modBlocks(app) {
  const out = [];
  for (const [id, e] of Object.entries(app.mod.entities || {})) {
    const r = (e.graph.nodes || []).find((n) => NODES[n.type] && n.type === 'tpl.block');
    if (r) out.push([`@${id}`, e.name]);
  }
  return out;
}

// The game's blocks, in groups, for the palette.
const HIDE = new Set(['air', 'door_top', 'cell_door_top', 'placed_item', 'sail', 'helm', 'kav_lift', 'stairs_up', 'rubble_seal', 'portcullis_up', 'boss_gate_open', 'cell_door_open', 'farmland_wet', 'grass_void', 'snow_void', 'rock_void', 'leaves_void', 'canopy', 'tent', 'wagon']);
export function blockGroups() {
  const g = { Ground: [], Wood: [], 'Stone & brick': [], Roofs: [], 'Glass & metal': [], Plants: [], 'Light & fire': [], Furniture: [], 'Old places': [], Islands: [], Other: [] };
  for (const b of BLOCKS) {
    if (!b || b.mod || HIDE.has(b.name) || b.name.startsWith('m:')) continue;
    const n = b.name;
    let k = 'Other';
    if (/^(kav_|barrow_|crypt_|mine_|cave_|bones|coffin|sarcophagus|pressure_plate|arrow_slit|lever|portcullis|cracked_floor|weak_wall|sealed_door|stairs_down|brazier|sinkhole|cave_mouth|urn|skull_pile|mine_cart|stalagmite|glowshroom|weapon_rack|war_banner|hanging_chains|powder_keg|roots|rubble|bone_throne|boss_gate|gong|idol|spikes|blight_|satchel|relic|void_bloom|glow_crystal|tendril|eye_stalk)/.test(n)) k = 'Old places';
    else if (/^(ash|basalt|obsidian|cinder|sulfur|scorched|moss|peat|mycelium|mushroom_|glowcap|roof_mushroom|roof_moss|roof_reed|mill_hub|root_wall|forge_brick|slag|coral|shell_sand|basalt_bricks|ash_plaster|kiln_|copper_roof|ember_gutter|nacre_tile|planks_cinder|planks_bog|planks_drift|log_cinder|log_mangrove|leaves_ember|leaves_mangrove|lava|steam_vent|hollow_door|forge_door|grotto_mouth)/.test(n)) k = 'Islands';
    else if (/^roof_|^thatch/.test(n)) k = 'Roofs';
    else if (/^(log_|planks|timber|log_wall|counter|bookshelf)/.test(n)) k = 'Wood';
    else if (/bricks|^adobe|^plaster|^marble|^sandstone|^flagstone/.test(n)) k = 'Stone & brick';
    else if (/^(glass|iron_bars|awning)/.test(n)) k = 'Glass & metal';
    else if (/^(torch|lantern|campfire|candles|fireplace|lamp|brazier)/.test(n) || b.light) k = 'Light & fire';
    else if (/^leaves|^tall_grass|^fern|^flower|bush|reeds|mushroom|herb|sapling|lily|crop|cactus|pumpkin/.test(n) || b.render === 'plant') k = 'Plants';
    else if (b.render === 'cube' || b.render === 'liquid') k = 'Ground';
    else if (b.render === 'sprite' || b.render === 'door' || b.render === 'fence' || b.render === 'flat') k = 'Furniture';
    g[k].push(n);
  }
  return g;
}
