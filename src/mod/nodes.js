// The kinds of node the Workshop's graphs are built from (round 62): the
// templates every entity starts from, the moments things happen, what's
// done then, and the values handed about. (What a node does in the game it
// does through SVC, filled in by hooks.js: nothing here reaches into the
// game itself, so the Workshop can show these without the game loaded.)
import { def, T, FILL } from './graph.js';
import { TOWN_FACTS, TOWN_CHANGES, PERSON_FACTS, PERSON_CHANGES, LAW_LIST, JOB_LIST, SHOP_KINDS } from './townlists.js';

// What the nodes reach the game through (see hooks.js).
export const SVC = {};

export const BIOME_LIST = ['plains', 'forest', 'taiga', 'tundra', 'desert', 'savanna', 'jungle', 'swamp', 'mountain', 'beach', 'ashland', 'cinderwood', 'geyser', 'mangrove', 'fungal', 'moor'];
export const ELEMENTS = ['none', 'fire', 'frost', 'poison', 'shock', 'force'];
export const STATUSES = ['burn', 'chill', 'stun', 'poison', 'haste', 'slow', 'regen', 'weak', 'shield'];
export const SOUNDS = ['hit', 'hurt', 'death', 'swing', 'parry', 'pickup', 'coin', 'craft', 'eat', 'gulp', 'heal', 'door', 'chest', 'break', 'place', 'boom', 'thunder', 'portal', 'pulse', 'whoosh', 'roar', 'growl', 'chime', 'bell', 'gong',
  'fanfare', 'victory', 'magic', 'freeze', 'reflect', 'orb', 'beam', 'charge', 'rumble', 'whisper', 'shatter', 'thud', 'secret', 'rune', 'hiss', 'crackle', 'drip', 'splash', 'click', 'lever', 'unlock', 'locked', 'error', 'bow', 'impact', 'stomp', 'flap', 'sting', 'scream', 'star_ding', 'puff', 'baa', 'howl', 'chirp', 'hoot', 'frog', 'horn'];
export const STYLE_LIST = ['sword', 'dagger', 'axe', 'club', 'spear', 'flail', 'staff', 'great', 'maul', 'halberd'];
export const ATTACKS = ['bite', 'snap', 'slam', 'gore', 'rake', 'pounce', 'sting', 'bash', 'sword', 'club', 'spear', 'great', 'maul'];
export const ARMOR_LOOKS = { head: ['helmet', 'lcap', 'hood', 'straw', 'circlet', 'goggles'], body: ['plate', 'chain', 'leather', 'linen', 'coat'], legs: ['plate', 'leather', 'cloth'], feet: ['iron', 'leather'], shield: ['wood', 'iron', 'round'] };
export const STATIONS = ['hand', 'workbench', 'furnace', 'anvil'];
export const HAIR_STYLES = ['short', 'long', 'bald', 'spiky', 'bun', 'braid', 'mohawk', 'ponytail', 'curly'];

const C = {
  town: '#6a5a24', info: '#2a4a5a', tpl: '#7a5a2a', event: '#2a5a3a', flow: '#4a4a5a', act: '#2a4a6a', boss: '#6a2a2a', dlg: '#5a3a6a', data: '#3a3a46', ref: '#5a3a4a', math: '#2a4a4a', q: '#3a4a2a', var: '#4a3a2a', beh: '#6a4a24',
};
const F = (id, label = null) => ({ id, t: T.flow, label: label || id });
const n = (id, label, d = 0, o = {}) => ({ id, t: T.num, label, def: d, ...o });
const txt = (id, label, d = '', o = {}) => ({ id, t: T.text, label, def: d, ...o });
const bool = (id, label, d = false, o = {}) => ({ id, t: T.bool, label, def: d, ...o });
const col = (id, label, d = '#ffe070', o = {}) => ({ id, t: T.color, label, def: d, ...o });
const pick = (id, label, opts, d = opts[0], o = {}) => ({ id, t: 'enum', label, opts, def: d, ...o });
const ref = (id, t, label, o = {}) => ({ id, t, label, def: null, ...o });
const out = (id, t, label) => ({ id, t, label });

// ------------------------------------------------------------ helpers
// A place: an entity's, or a place itself.
export function posOf(v) {
  if (!v) return null;
  if (typeof v.x === 'number' && typeof v.z === 'number') return { x: Math.round(v.x), y: Math.round(v.y ?? 6), z: Math.round(v.z) };
  return null;
}
const isEnt = (v) => !!(v && typeof v === 'object' && (v.kind === 'player' || v.kind === 'creature' || v.kind === 'monster' || v.kind === 'npc'));
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(+v) ? +v : typeof v === 'boolean' ? +v : d);
const where = (x, api, port = 'at') => posOf(api.in(port)) || posOf(x.pos) || posOf(x.self) || posOf(x.player);
const who = (x, api, port = 'target') => {
  const v = api.in(port);
  return isEnt(v) ? v : null;
};
// (Text with {name} slots: the context's own values put in. Round 64: any
// variable's too, by its name ({gold}, {times-met}): the flow's own first,
// then what's kept on self, the world, the player; or say where, as
// {world:gold}, {player:class}, {self:count}, {local:n}.)
export function fillText(x, s) {
  return String(s ?? '').replace(/\{([\w:.-]+)\}/g, (m, k) => {
    let v;
    const at = k.indexOf(':');
    if (at > 0 && ['self', 'world', 'local', 'player'].includes(k.slice(0, at))) v = SVC.getVar?.(x, k.slice(0, at), k.slice(at + 1));
    else if (k === 'self') v = x.self && x.self.name;
    else if (k === 'target') v = x.target && (x.target.name || (x.target.account && x.target.account.name));
    else if (k === 'player') v = SVC.playerName?.(x);
    else if (k === 'value') v = x.payload;
    else {
      v = (x.vars || {})[k] ?? (x.locals || {})[k];
      if (v === undefined && SVC.getVar && x.game) v = SVC.getVar(x, 'self', k) ?? SVC.getVar(x, 'world', k) ?? SVC.getVar(x, 'player', k);
    }
    return v === undefined || v === null ? m : typeof v === 'number' ? String(+v.toFixed(2)) : String(v);
  });
}
FILL.fn = fillText;

// ============================================================ templates
// The roots. `kind`: what the game makes of it (see registry.js).
const BLOCK_SHAPES = ['cube', 'prop', 'plant', 'flat', 'tall'];
def('tpl.block', {
  cat: 'Templates', title: 'Block', root: true, kind: 'block', color: C.tpl,
  help: 'A block you can place and break. Cube blocks show their Texture on top and their Side picture on the front; props, plants and flats show the Texture as a sprite.',
  in: [
    txt('name', 'Name', 'New Block'), ref('texture', T.asset, 'Texture'), ref('side', T.asset, 'Side (cube)', { show: { shape: ['cube'] } }),
    n('hardness', 'Hardness', 1, { min: 0, max: 20, step: 0.1 }), n('light', 'Light', 0, { min: 0, max: 15, step: 1 }),
    ref('drop', T.item, 'Drops (item)', { adv: true }), ref('loot', T.loot, 'Drops (loot table)', { adv: true }), n('value', 'Value', 1, { min: 0, max: 9999, adv: true }),
    n('slots', 'Chest slots', 9, { min: 1, max: 27, show: { use: ['container'] } }), n('near', 'Near radius', 3, { min: 1, max: 12, adv: true }),
  ],
  props: [pick('shape', 'Shape', BLOCK_SHAPES), pick('tool', 'Tool', ['none', 'pick', 'axe', 'shovel']), bool('solid', 'Solid', true), bool('seeThrough', 'See-through', false), pick('use', 'Right-click', ['nothing', 'container', 'sit', 'door', 'graph']), bool('rotatable', 'Turns to face you', false), bool('item', 'Has an item', true)],
  out: [F('onPlace', 'On placed'), F('onBreak', 'On broken'), F('onUse', 'On right-click'), F('onStep', 'On stepped on'), F('onNear', 'On someone near'),
    out('pos', T.pos, 'Where'), out('who', T.ent, 'Who')],
  eval: (x, nn, port) => (port === 'pos' ? x.pos : x.target),
});
def('tpl.food', {
  cat: 'Templates', title: 'Consumable', root: true, kind: 'item', color: C.tpl,
  help: 'Something eaten or drunk (food, a drink, a potion): it heals, and On used does whatever you wire after it.',
  in: [txt('name', 'Name', 'New Food'), ref('icon', T.asset, 'Icon'), n('heal', 'Heals', 2, { min: 0, max: 40 }), n('regen', 'Heals over time', 0, { min: 0, max: 40 }), n('stack', 'Stack', 16, { min: 1, max: 999, adv: true }), n('value', 'Value', 4, { min: 0, max: 9999 }),
    ref('effect', T.effect, 'Gives effect', { adv: true }), n('effectSecs', 'Effect seconds', 30, { min: 1, max: 3600, adv: true }), txt('about', 'Description', '', { adv: true })],
  props: [pick('kind', 'Kind', ['food', 'drink', 'potion']), bool('anytime', 'Usable at full health', false)],
  out: [F('onUse', 'On used'), out('user', T.ent, 'Who')],
  eval: (x) => x.target,
});
def('tpl.weapon', {
  cat: 'Templates', title: 'Weapon', root: true, kind: 'item', color: C.tpl,
  help: 'A weapon. Melee weapons swing in their Style; ranged ones shoot their Ammo (or nothing at all, if left empty). On hit runs for each foe struck.',
  in: [txt('name', 'Name', 'New Blade'), ref('icon', T.asset, 'Icon'), n('damage', 'Damage', 5, { min: 0, max: 200 }), n('reach', 'Reach', 1.6, { min: 1, max: 3, step: 0.1, show: { ranged: [false] } }), n('cooldown', 'Swing time', 0.42, { min: 0.15, max: 3, step: 0.01 }),
    n('range', 'Range', 8, { min: 3, max: 16, show: { ranged: [true] } }), ref('ammo', T.item, 'Ammo', { show: { ranged: [true] } }), n('knock', 'Knockback', 0, { min: 0, max: 4, adv: true }), n('value', 'Value', 20, { min: 0, max: 9999, adv: true }), txt('about', 'Description', '', { adv: true })],
  props: [bool('ranged', 'Ranged', false), pick('style', 'Style', STYLE_LIST, 'sword', { show: { ranged: [false] } }), pick('hands', 'Hands', ['one', 'two']), pick('element', 'Element', ELEMENTS)],
  out: [F('onHit', 'On hit'), { ...F('onSwing', 'On swing'), show: { ranged: [false] } }, { ...F('onShoot', 'On shot'), show: { ranged: [true] } }, F('onKill', 'On kill'), out('user', T.ent, 'Wielder'), out('foe', T.ent, 'Foe struck')],
  eval: (x, nn, port) => (port === 'foe' ? x.target : x.self),
});
def('tpl.tool', {
  cat: 'Templates', title: 'Tool', root: true, kind: 'item', color: C.tpl,
  help: 'A tool for breaking blocks quicker (and hitting things, not so well). On block broken runs for each block it breaks.',
  in: [txt('name', 'Name', 'New Tool'), ref('icon', T.asset, 'Icon'), n('speed', 'Speed', 4, { min: 0.5, max: 20, step: 0.1 }), n('damage', 'Damage', 2, { min: 0, max: 50 }), n('value', 'Value', 12, { min: 0, max: 9999, adv: true }), txt('about', 'Description', '', { adv: true })],
  props: [pick('tool', 'Breaks', ['pick', 'axe', 'shovel'])],
  out: [F('onBreak', 'On block broken'), F('onUse', 'On right-click'), out('pos', T.pos, 'Where'), out('user', T.ent, 'Who')],
  eval: (x, nn, port) => (port === 'pos' ? x.pos : x.self),
});
def('tpl.armor', {
  cat: 'Templates', title: 'Armour', root: true, kind: 'item', color: C.tpl,
  help: 'Something worn (a helm, a shirt of mail, boots, a shield). It shows on you in the Look you pick, in its Tint. While worn ticks every second.',
  in: [txt('name', 'Name', 'New Armour'), ref('icon', T.asset, 'Icon'), n('armor', 'Armour %', 10, { min: 0, max: 50 }), col('tint', 'Tint', '#a8b0c0'), n('block', 'Shield block %', 75, { min: 0, max: 95, show: { slot: ['shield'] } }), n('value', 'Value', 30, { min: 0, max: 9999, adv: true }), txt('about', 'Description', '', { adv: true })],
  props: [pick('slot', 'Worn on', ['head', 'body', 'legs', 'feet', 'shield']), pick('look', 'Look', ['auto', 'helmet', 'lcap', 'hood', 'straw', 'circlet', 'goggles', 'plate', 'chain', 'leather', 'linen', 'coat', 'cloth', 'iron', 'wood', 'round'])],
  out: [F('onEquip', 'On put on'), F('onUnequip', 'On taken off'), F('onWorn', 'While worn (each second)'), F('onHurt', 'On wearer hurt'), { ...F('onBlock', 'On a blow blocked'), show: { slot: ['shield'] } }, out('user', T.ent, 'Wearer'), out('foe', T.ent, 'Attacker')],
  eval: (x, nn, port) => (port === 'foe' ? x.target : x.self),
});
def('tpl.material', {
  cat: 'Templates', title: 'Material', root: true, kind: 'item', color: C.tpl,
  help: 'A plain thing to carry, sell and craft with (an ore, a hide, a trinket).',
  in: [txt('name', 'Name', 'New Material'), ref('icon', T.asset, 'Icon'), n('stack', 'Stack', 64, { min: 1, max: 999 }), n('value', 'Value', 2, { min: 0, max: 9999 }), txt('about', 'Description', '', { adv: true })],
  props: [bool('fuel', 'Burns as fuel', false)],
  out: [F('onUse', 'On right-click'), out('user', T.ent, 'Who')],
  eval: (x) => x.self,
});
const CREATURE_IN = [
  txt('name', 'Name', 'New Creature'), ref('look', T.asset, 'Look (art)'), ref('rig', T.rig, 'Look (rig)', { adv: true }), n('hp', 'Health', 10, { min: 1, max: 5000 }), n('speed', 'Speed', 1, { min: 0.2, max: 4, step: 0.1 }),
  ref('loot', T.loot, 'Drops (loot table)'), ref('drop', T.item, 'Drops (item)', { adv: true }), n('light', 'Glows', 0, { min: 0, max: 15, adv: true }), n('tick', 'Tick every (s)', 1, { min: 0.2, max: 60, step: 0.1, adv: true }),
];
const SPAWN_PROPS = [pick('spawnTime', 'Wanders out', ['day', 'night', 'any', 'never']), { id: 'biomes', t: 'multi', label: 'Biomes', opts: BIOME_LIST, def: ['plains', 'forest'] }, { id: 'weight', t: 'number', label: 'How common (0-10)', def: 3, min: 0, max: 10 }, { id: 'group', t: 'number', label: 'In groups of', def: 1, min: 1, max: 6 }];
const CREATURE_OUT = [F('onSpawn', 'On spawned'), F('onTick', 'Every tick'), F('onHurt', 'On hurt'), F('onDeath', 'On death'), F('onUse', 'On right-click'), out('me', T.ent, 'This creature'), out('foe', T.ent, 'Other')];
const creatureEval = (x, nn, port) => (port === 'foe' ? x.target : x.self);
def('tpl.animal', {
  cat: 'Templates', title: 'Animal', root: true, kind: 'creature', color: C.tpl,
  help: 'A beast of the wild: it wanders, and runs (or, if Temper is "fights back", turns on whoever hurts it).',
  in: [...CREATURE_IN, n('damage', 'Damage', 0, { min: 0, max: 100, show: { temper: ['fights back'] } })],
  props: [pick('temper', 'Temper', ['shy', 'fights back', 'tame']), bool('swims', 'Swims', false), bool('floats', 'Flies', false), ...SPAWN_PROPS],
  out: CREATURE_OUT, eval: creatureEval,
});
def('tpl.hostile', {
  cat: 'Templates', title: 'Hostile', root: true, kind: 'creature', color: C.tpl,
  help: 'A monster that hunts whoever it sees. Wire Ability nodes to give it attacks of its own, besides its plain one.',
  in: [...CREATURE_IN, n('damage', 'Damage', 3, { min: 0, max: 200 }), n('aggro', 'Sees you at', 8, { min: 2, max: 24 })],
  props: [pick('attack', 'Attacks by', ['melee', 'arrows', 'fire orbs', 'frost orbs', 'none']), pick('blow', 'Blow', ATTACKS, 'bite', { show: { attack: ['melee'] } }), bool('burnsInSun', 'Burns in daylight', false), bool('floats', 'Flies', false), bool('fireproof', 'Fireproof', false), bool('swims', 'Swims', false), ...SPAWN_PROPS.map((p) => (p.id === 'spawnTime' ? { ...p, def: 'night' } : p))],
  out: [...CREATURE_OUT, F('onAttack', 'On attack'), F('onSee', 'On sees a foe')], eval: creatureEval,
});
// (A person with art of their own: no colours to dress them in.)
const NO_ART = (g) => !g('look') && !g('rig');
def('tpl.npc', {
  cat: 'Templates', title: 'Person (NPC)', root: true, kind: 'creature', color: C.tpl,
  help: 'Someone to talk to. Dress them with the colours below, or give them art of your own (the Pixel tool\'s "Person (NPC)" size is drawn at a person\'s height; start it from one of the game\'s people), and wire On talked to into Say nodes.',
  in: [txt('name', 'Name', 'Wanderer'), txt('title', 'Title', 'traveller'), ref('look', T.asset, 'Look (art)'), ref('rig', T.rig, 'Look (rig)', { adv: true }), n('hp', 'Health', 20, { min: 1, max: 5000 }),
    ...[col('skin', 'Skin', '#e0b090'), col('hair', 'Hair', '#4a3020'), col('shirt', 'Shirt', '#4a6a9a'), col('pants', 'Trousers', '#3a3a4a')].map((q) => ({ ...q, show: NO_ART })), n('wander', 'Wanders (paces)', 4, { min: 0, max: 30 }), n('tick', 'Tick every (s)', 2, { min: 0.2, max: 60, adv: true })],
  props: [pick('hairStyle', 'Hair', HAIR_STYLES, HAIR_STYLES[0], { show: NO_ART }), bool('immortal', 'Can\'t be hurt', false), pick('temper', 'If attacked', ['flees', 'fights back', 'shrugs it off'], 'flees', { show: { immortal: [false] } })],
  out: [F('onTalk', 'On talked to'), F('onSpawn', 'On spawned'), F('onTick', 'Every tick'), F('onHurt', 'On hurt'), F('onDeath', 'On death'), out('me', T.ent, 'This person'), out('foe', T.ent, 'Talker / attacker')],
  eval: creatureEval,
});
def('tpl.boss', {
  cat: 'Templates', title: 'Boss', root: true, kind: 'creature', color: C.boss,
  help: 'A master: a health bar across the screen, phases as it\'s worn down, abilities of its own (wire Ability nodes), and tiers (time crystals make it harder). Put it in a dungeon with the Builder\'s boss marker.',
  in: [txt('name', 'Name', 'The Unmade'), txt('title', 'Title', 'Keeper of the Deep'), ref('look', T.asset, 'Look (art)'), ref('rig', T.rig, 'Look (rig)', { adv: true }), n('hp', 'Health', 400, { min: 20, max: 50000 }), n('damage', 'Damage', 6, { min: 0, max: 400 }), n('speed', 'Speed', 1, { min: 0.2, max: 3, step: 0.1 }),
    ref('loot', T.loot, 'Drops (loot table)'), n('light', 'Glows', 6, { min: 0, max: 15, adv: true }), txt('intro', 'Shout on waking', 'You should not have come.', { adv: true }), txt('death', 'Last words', 'It... ends...', { adv: true })],
  props: [pick('size', 'Size', ['large (3x3)', 'normal']), pick('phases', 'Phases', ['3', '2', '4', '1']), pick('blow', 'Blow', ATTACKS, 'slam'), bool('fireproof', 'Fireproof', false), bool('floats', 'Flies', false)],
  out: [F('onWake', 'On woken'), { ...F('onPhase2', 'On phase 2'), show: { phases: { not: ['1'] } } }, { ...F('onPhase3', 'On phase 3'), show: { phases: ['3', '4'] } }, { ...F('onPhase4', 'On phase 4'), show: { phases: ['4'] } }, F('onHurt', 'On hurt'), F('onDeath', 'On defeated'), out('me', T.ent, 'The boss'), out('foe', T.ent, 'Foe')],
  eval: creatureEval,
});
def('tpl.effect', {
  cat: 'Templates', title: 'Effect', root: true, kind: 'effect', color: C.tpl,
  help: 'A lasting effect (a blessing, a curse, a poison). Give it with a Consumable, or the Apply effect node. While on, it changes how fast, how hard and how tough someone is, and ticks each second.',
  in: [txt('name', 'Name', 'Blessed'), ref('icon', T.asset, 'Icon'), col('color', 'Colour', '#80e070'), n('speed', 'Speed +%', 0, { min: -80, max: 200 }), n('damage', 'Damage +%', 0, { min: -80, max: 300 }), n('armor', 'Armour +%', 0, { min: -50, max: 60 }),
    n('regen', 'Health per second', 0, { min: -20, max: 20, step: 0.1 }), ref('vfx', T.vfx, 'Aura (effect)', { adv: true })],
  props: [pick('nature', 'Good or bad', ['good', 'bad']), pick('stack', 'Again', ['refresh', 'add time', 'ignore'])],
  out: [F('onApply', 'On given'), F('onTick', 'Each second'), F('onExpire', 'On worn off'), out('who', T.ent, 'Who has it')],
  eval: (x) => x.self,
});
def('tpl.event', {
  cat: 'Templates', title: 'World event', root: true, kind: 'event', color: C.event,
  help: 'Something that happens in the world: when it starts, at dawn or dusk or an hour of your choosing, every so often, when a custom event is sent (Send event), when someone comes near one of your structures, when something\'s killed, when a player joins or is downed, or when it starts to rain.',
  in: [n('every', 'Every (s)', 60, { min: 1, max: 86400, show: { when: ['every so often'] } }), txt('custom', 'Event name', 'my_event', { show: { when: ['custom event'] } }), ref('structure', T.structure, 'Near structure', { show: { when: ['near structure'] } }), ref('creature', T.creature, 'Killed creature', { show: { when: ['killed'] } }), n('radius', 'Radius', 8, { min: 1, max: 40, show: { when: ['near structure'] } }), n('hour', 'At hour', 12, { min: 0, max: 23, show: { when: ['at an hour'] } }), n('chance', 'Chance %', 100, { min: 0, max: 100 })],
  props: [pick('when', 'When', ['world starts', 'every so often', 'dawn', 'dusk', 'at an hour', 'custom event', 'near structure', 'killed', 'a player joins', 'a player is downed', 'it starts to rain']), bool('once', 'Only ever once', false)],
  out: [F('fire', 'Happens'), out('who', T.ent, 'Who'), out('pos', T.pos, 'Where'), out('value', T.any, 'Event value')],
  eval: (x, nn, port) => (port === 'who' ? x.target || x.player : port === 'pos' ? x.pos : x.payload),
});
def('tpl.recipe', {
  cat: 'Templates', title: 'Recipe', root: true, kind: 'recipe', color: C.tpl,
  help: 'A crafting recipe: what goes in (up to four things), where it\'s made, and what comes out.',
  in: [ref('out', T.item, 'Makes'), n('count', 'How many', 1, { min: 1, max: 64 }), ref('a', T.item, 'Needs'), n('an', '×', 1, { min: 1, max: 64 }), ref('b', T.item, 'And'), n('bn', '×', 1, { min: 1, max: 64 }), ref('c', T.item, 'And', { adv: true }), n('cn', '×', 1, { min: 1, max: 64, adv: true }), ref('d', T.item, 'And', { adv: true }), n('dn', '×', 1, { min: 1, max: 64, adv: true })],
  props: [pick('station', 'Made at', STATIONS)],
  out: [],
});
def('tpl.projectile', {
  cat: 'Templates', title: 'Projectile', root: true, kind: 'projectile', color: C.tpl,
  help: 'Something thrown or shot (by Shoot): how it looks in flight and what it does where it lands.',
  in: [txt('name', 'Name', 'Bolt'), ref('look', T.asset, 'Look (art)'), ref('trail', T.vfx, 'Trail (effect)'), ref('burst', T.vfx, 'Burst (effect)'), n('damage', 'Damage', 4, { min: 0, max: 400 }), n('speed', 'Speed', 12, { min: 2, max: 40 }), n('radius', 'Splash radius', 0, { min: 0, max: 6 })],
  props: [pick('path', 'Flies', ['straight', 'lobbed']), pick('element', 'Element', ELEMENTS)],
  out: [F('onHit', 'On hit'), out('pos', T.pos, 'Where'), out('foe', T.ent, 'Who')],
  eval: (x, nn, port) => (port === 'pos' ? x.pos : x.target),
});
export const TEMPLATES = ['tpl.block', 'tpl.food', 'tpl.weapon', 'tpl.tool', 'tpl.armor', 'tpl.material', 'tpl.animal', 'tpl.hostile', 'tpl.npc', 'tpl.boss', 'tpl.effect', 'tpl.event', 'tpl.recipe', 'tpl.projectile'];

// ============================================================ events
def('ev.ability', {
  cat: 'Events', title: 'Ability', starts: true, color: C.boss,
  help: 'An attack (or trick) of a creature\'s or boss\'s own: used when it\'s ready, its foe is in range and it\'s in the right phase. Wire what it does into Cast.',
  in: [txt('name', 'Name', 'Ground Slam'), n('cooldown', 'Cooldown (s)', 6, { min: 0.5, max: 120, step: 0.5 }), n('windup', 'Wind-up (s)', 0.8, { min: 0, max: 5, step: 0.1 }), n('min', 'Range from', 0, { min: 0, max: 30 }), n('max', 'Range to', 6, { min: 1, max: 40 }), n('weight', 'How often', 1, { min: 0.1, max: 10, step: 0.1 }), n('fromPhase', 'From phase', 1, { min: 1, max: 4 }), n('toPhase', 'To phase', 4, { min: 1, max: 4 })],
  props: [bool('shout', 'Shout its name', true)],
  out: [F('cast', 'Cast'), out('me', T.ent, 'Caster'), out('foe', T.ent, 'Foe')],
  eval: (x, nn, port) => (port === 'foe' ? x.target : x.self),
});
def('ev.custom', {
  cat: 'Events', title: 'On event', starts: true, color: C.event,
  help: 'When an event of this name is sent (by Send event, anywhere in the mod).',
  in: [txt('name', 'Event name', 'my_event')],
  out: [F('fire', 'Happens'), out('value', T.any, 'Value'), out('who', T.ent, 'Who'), out('pos', T.pos, 'Where')],
  eval: (x, nn, port) => (port === 'value' ? x.payload : port === 'who' ? x.target : x.pos),
});
def('ev.near', {
  cat: 'Events', title: 'Someone comes near', starts: true, color: C.event,
  help: 'When someone comes within so many paces of this creature (each one once, till they go off again: then Gone).',
  in: [n('r', 'Within (paces)', 5, { min: 1, max: 40 }), ref('species', T.creature, 'Only this creature', { show: { which: ['creatures', 'everyone'] } })],
  props: [pick('which', 'Who', ['players', 'creatures', 'everyone', 'foes of self'])],
  out: [F('fire', 'Comes near'), F('gone', 'Goes off'), out('who', T.ent, 'Who'), out('me', T.ent, 'This creature')],
  eval: (x, nn, port) => (port === 'me' ? x.self : x.target),
});
def('ev.lowhp', {
  cat: 'Events', title: 'Health falls low', starts: true, color: C.event,
  help: 'When this creature\'s health falls below so much (once each time: it has to mend above it again first).',
  in: [n('pct', 'Below (%)', 50, { min: 1, max: 99 })],
  out: [F('fire', 'Falls low'), out('me', T.ent, 'This creature'), out('foe', T.ent, 'Its foe')],
  eval: (x, nn, port) => (port === 'foe' ? x.target : x.self),
});
def('ev.timer', {
  cat: 'Events', title: 'Every so often', starts: true, color: C.event,
  help: 'Every so many seconds, while this entity is about (a creature alive; an item held or worn).',
  in: [n('every', 'Every (s)', 5, { min: 0.2, max: 3600, step: 0.1 })],
  out: [F('fire', 'Tick'), out('me', T.ent, 'This')],
  eval: (x) => x.self,
});

// ============================================================ flow
def('flow.seq', {
  cat: 'Flow', title: 'Sequence', color: C.flow, help: 'Does each output in turn: 1, then 2, then 3, then 4.',
  in: [F('in', 'Do')], out: [F('a', '1'), F('b', '2'), F('c', '3'), F('d', '4')],
  run: () => ['a', 'b', 'c', 'd'],
});
def('flow.branch', {
  cat: 'Flow', title: 'If', color: C.flow, help: 'Yes or no: which way depends on the condition.',
  in: [F('in', 'Do'), bool('cond', 'Condition', true)], out: [F('yes', 'Yes'), F('no', 'No')],
  run: (x, nn, api) => (api.in('cond') ? 'yes' : 'no'),
});
def('flow.chance', {
  cat: 'Flow', title: 'Chance', color: C.flow, help: 'Goes on only now and then: Percent of the time.',
  in: [F('in', 'Do'), n('pct', 'Percent', 50, { min: 0, max: 100 })], out: [F('yes', 'Lucky'), F('no', 'Not')],
  run: (x, nn, api) => (Math.random() * 100 < num(api.in('pct')) ? 'yes' : 'no'),
});
def('flow.random', {
  cat: 'Flow', title: 'Pick one', color: C.flow, help: 'One of its outputs, at random, weighed by the numbers.',
  in: [F('in', 'Do'), n('wa', 'Weight 1', 1, { min: 0 }), n('wb', 'Weight 2', 1, { min: 0 }), n('wc', 'Weight 3', 0, { min: 0 }), n('wd', 'Weight 4', 0, { min: 0 })],
  out: [F('a', '1'), F('b', '2'), F('c', '3'), F('d', '4')],
  run: (x, nn, api) => {
    const w = ['wa', 'wb', 'wc', 'wd'].map((k) => Math.max(0, num(api.in(k))));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 4; i++) if ((r -= w[i]) < 0) return 'abcd'[i];
    return null;
  },
});
def('flow.delay', {
  cat: 'Flow', title: 'Wait', color: C.flow, waits: true, help: 'Waits, then goes on.',
  in: [F('in', 'Do'), n('secs', 'Seconds', 1, { min: 0, max: 600, step: 0.1 })], out: [F('then', 'Then')],
  run: (x, nn, api) => {
    api.later(Math.max(0, num(api.in('secs'))), 'then');
    return null;
  },
});
def('flow.repeat', {
  cat: 'Flow', title: 'Repeat', color: C.flow, help: 'Does Each so many times (a Wait after it spaces them out), then Done.',
  in: [F('in', 'Do'), n('times', 'Times', 3, { min: 1, max: 100 }), n('gap', 'Seconds apart', 0, { min: 0, max: 60, step: 0.05 })], out: [F('each', 'Each time'), F('done', 'Done'), out('i', T.num, 'Count')],
  run: (x, nn, api) => {
    const k = Math.min(100, Math.max(1, Math.round(num(api.in('times'), 1))));
    const gap = Math.max(0, num(api.in('gap')));
    if (!gap) {
      for (let i = 0; i < k; i++) {
        x.locals[`${nn.id}.i`] = i + 1;
        api.fire('each');
      }
      return 'done';
    }
    for (let i = 0; i < k; i++) api.later(gap * i, 'each', { [`${nn.id}.i`]: i + 1 });
    api.later(gap * k, 'done');
    return null;
  },
});
def('flow.foreach', {
  cat: 'Flow', title: 'For each nearby', color: C.flow, help: 'For each one near a place (players, creatures, or both): runs Each with them as Who.',
  in: [F('in', 'Do'), ref('at', T.pos, 'Around'), n('radius', 'Radius', 4, { min: 1, max: 40 })],
  props: [pick('which', 'Who', ['foes of self', 'players', 'creatures', 'everyone'])],
  out: [F('each', 'Each'), F('done', 'Done'), out('who', T.ent, 'Who')],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (!at) return 'done';
    for (const e of SVC.near(x, at, num(api.in('radius'), 4), api.prop('which'))) {
      x.locals[`${nn.id}.who`] = e;
      api.fire('each');
    }
    return 'done';
  },
});
def('flow.once', {
  cat: 'Flow', title: 'Only once', color: C.flow, help: 'Lets the flow through the first time only (for this creature or block; for the world, from a world event).',
  in: [F('in', 'Do')], out: [F('first', 'First time'), F('again', 'After')],
  run: (x, nn) => (SVC.once(x, nn.id) ? 'first' : 'again'),
});
def('flow.cooldown', {
  cat: 'Flow', title: 'Cooldown', color: C.flow, help: 'Lets the flow through at most once every so many seconds.',
  in: [F('in', 'Do'), n('secs', 'Seconds', 3, { min: 0.1, max: 3600, step: 0.1 })], out: [F('ready', 'Ready'), F('busy', 'Not yet')],
  run: (x, nn, api) => (SVC.cooldown(x, nn.id, num(api.in('secs'), 3)) ? 'ready' : 'busy'),
});

def('flow.switch', {
  cat: 'Flow', title: 'Switch', color: C.flow, help: 'Goes one way of several, by a value: the first case it matches (as a number if both are, else as words), or Other.',
  in: [F('in', 'Do'), { id: 'value', t: T.any, label: 'Value', def: '' }, txt('a', 'Case 1', 'a'), txt('b', 'Case 2', 'b'), txt('c', 'Case 3', '', { adv: true }), txt('d', 'Case 4', '', { adv: true })],
  out: [F('a', 'Case 1'), F('b', 'Case 2'), F('c', 'Case 3'), F('d', 'Case 4'), F('other', 'Other')],
  run: (x, nn, api) => {
    const v = api.in('value');
    for (const k of ['a', 'b', 'c', 'd']) {
      const c = api.in(k);
      if (c === '' || c === null || c === undefined) continue;
      if (SVC.compare ? SVC.compare(v, 'is', c) : String(v) === String(c)) return k;
    }
    return 'other';
  },
});
def('flow.counter', {
  cat: 'Flow', title: 'Every so many times', color: C.flow, help: 'Lets the flow through once in every so many times it comes (for this creature or block; for the world, from a world event).',
  in: [F('in', 'Do'), n('every', 'Every', 3, { min: 1, max: 1000 })], out: [F('yes', 'This time'), F('no', 'Not yet')],
  run: (x, nn, api) => (SVC.counter(x, nn.id, Math.max(1, Math.round(num(api.in('every'), 3)))) ? 'yes' : 'no'),
});
def('flow.check', {
  cat: 'Flow', title: 'Compare and go', color: C.flow, help: 'Yes or No by comparing two things: numbers if both are, else words. Either can have {names} in it.',
  in: [F('in', 'Do'), { id: 'a', t: T.any, label: 'This', def: '{count}' }, { id: 'b', t: T.any, label: 'With', def: 3 }],
  props: [pick('op', 'Is', ['is', 'is not', 'is at least', 'is more than', 'is at most', 'is less than', 'has in it'], 'is at least')],
  out: [F('yes', 'Yes'), F('no', 'No')],
  run: (x, nn, api) => (SVC.compare(api.in('a'), api.prop('op'), api.in('b')) ? 'yes' : 'no'),
});

// ============================================================ actions
const act = (type, o) => def(type, { cat: 'Actions', color: C.act, ...o, in: [F('in', 'Do'), ...(o.in || [])], out: [F('then', 'Then'), ...(o.out || [])] });
act('act.message', {
  title: 'Message', help: 'Words at the side of the screen, for whoever it\'s about ({target}, {self} and {player} are filled in).',
  in: [txt('text', 'Text', 'Something stirs...'), col('color', 'Colour', '#ffe070'), ref('to', T.ent, 'To (or everyone)')],
  run: (x, nn, api) => {
    SVC.message(x, fillText(x, api.in('text')), api.in('color'), api.in('to'));
    return 'then';
  },
});
act('act.float', {
  title: 'Words in the air', help: 'Words rising from a place (like the numbers of a blow).',
  in: [txt('text', 'Text', '!'), ref('at', T.pos, 'At'), col('color', 'Colour', '#ffffff')],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) SVC.float(x, at, fillText(x, api.in('text')), api.in('color'));
    return 'then';
  },
});
act('act.shout', {
  title: 'Say aloud', help: 'A speech bubble over someone (a creature, a person, a boss).',
  in: [txt('text', 'Text', 'Grr!'), ref('who', T.ent, 'Who (or self)'), col('color', 'Colour', '#f4ecd8')],
  run: (x, nn, api) => {
    const e = who(x, api, 'who') || x.self;
    if (e) SVC.shout(x, e, fillText(x, api.in('text')), api.in('color'));
    return 'then';
  },
});
act('act.sound', {
  title: 'Sound', help: 'One of the game\'s sounds, from a place.',
  in: [ref('at', T.pos, 'At')], props: [{ id: 'sound', t: 'sound', label: 'Sound', opts: SOUNDS, def: 'chime' }],
  run: (x, nn, api) => {
    SVC.sound(x, api.prop('sound'), where(x, api));
    return 'then';
  },
});
act('act.vfx', {
  title: 'Play effect', help: 'One of your effects (made in the VFX tool), at a place or following someone.',
  in: [ref('vfx', T.vfx, 'Effect'), ref('at', T.pos, 'At / on'), n('scale', 'Scale', 1, { min: 0.25, max: 4, step: 0.05 })], props: [bool('follow', 'Follows them', false)],
  run: (x, nn, api) => {
    const at = api.in('at');
    SVC.vfx(x, api.in('vfx'), isEnt(at) ? at : where(x, api), { follow: api.prop('follow'), scale: num(api.in('scale'), 1) });
    return 'then';
  },
});
act('act.particles', {
  title: 'Burst of sparks', help: 'A quick burst of specks of colour (for a bigger show, make an effect in the VFX tool).',
  in: [ref('at', T.pos, 'At'), col('color', 'Colour', '#ffd070'), col('color2', 'Second colour', '#ffffff'), n('count', 'How many', 12, { min: 1, max: 80 }), n('speed', 'Spread', 30, { min: 0, max: 120 }), n('up', 'Rise', 30, { min: -60, max: 120 }), n('life', 'Lasts (s)', 0.7, { min: 0.1, max: 4, step: 0.1 })],
  props: [pick('shape', 'Shape', ['dot', 'star', 'plus', 'puff', 'drop', 'shard']), bool('glow', 'Glow', true)],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) SVC.particles(x, at, { color: [api.in('color'), api.in('color2')], n: num(api.in('count'), 12), speed: num(api.in('speed'), 30), up: num(api.in('up'), 30), life: num(api.in('life'), 0.7), shape: api.prop('shape') === 'dot' ? undefined : api.prop('shape'), glow: api.prop('glow') });
    return 'then';
  },
});
act('act.shake', {
  title: 'Shake the screen', help: 'The ground shakes (for those near).',
  in: [n('power', 'Power', 0.5, { min: 0.05, max: 1, step: 0.05 }), ref('at', T.pos, 'Near')],
  run: (x, nn, api) => {
    SVC.shake(x, num(api.in('power'), 0.5), where(x, api));
    return 'then';
  },
});
act('act.flash', {
  title: 'Flash the screen', help: 'The screen flashes a colour.',
  in: [col('color', 'Colour', '#ffffff'), n('secs', 'Seconds', 0.25, { min: 0.05, max: 2, step: 0.05 })],
  run: (x, nn, api) => {
    SVC.flash(x, api.in('color'), num(api.in('secs'), 0.25));
    return 'then';
  },
});
act('act.damage', {
  title: 'Damage', help: 'Hurts someone (armour takes its share). An element adds its own: fire burns, frost slows, poison sickens, shock stuns, force knocks back.',
  in: [ref('target', T.ent, 'Who'), n('amount', 'Amount', 3, { min: 0, max: 9999 })], props: [pick('element', 'Element', ELEMENTS)],
  run: (x, nn, api) => {
    const t = who(x, api) || x.target;
    if (t) SVC.damage(x, t, num(api.in('amount'), 3), api.prop('element'));
    return 'then';
  },
});
act('act.heal', {
  title: 'Heal', help: 'Heals someone.',
  in: [ref('target', T.ent, 'Who (or self)'), n('amount', 'Amount', 4, { min: 0, max: 9999 })],
  run: (x, nn, api) => {
    const t = who(x, api) || x.self;
    if (t) SVC.heal(x, t, num(api.in('amount'), 4));
    return 'then';
  },
});
act('act.status', {
  title: 'Give a condition', help: 'Burning, chilled (slowed), stunned, poisoned, quickened, slowed, mending, weakened, or shielded, for a while.',
  in: [ref('target', T.ent, 'Who'), n('secs', 'Seconds', 3, { min: 0.1, max: 600, step: 0.1 })], props: [pick('status', 'Condition', STATUSES)],
  run: (x, nn, api) => {
    const t = who(x, api) || x.target;
    if (t) SVC.status(x, t, api.prop('status'), num(api.in('secs'), 3));
    return 'then';
  },
});
act('act.effect', {
  title: 'Apply effect', help: 'One of your Effects (an entity made from the Effect template), on someone for a while.',
  in: [ref('effect', T.effect, 'Effect'), ref('target', T.ent, 'Who (or self)'), n('secs', 'Seconds', 30, { min: 1, max: 3600 })],
  run: (x, nn, api) => {
    const t = who(x, api) || x.self;
    if (t) SVC.applyEffect(x, t, api.in('effect'), num(api.in('secs'), 30));
    return 'then';
  },
});
act('act.knock', {
  title: 'Knock back', help: 'Throws someone back, away from someone (or from self).',
  in: [ref('target', T.ent, 'Who'), ref('from', T.ent, 'Away from (or self)'), n('tiles', 'Paces', 2, { min: 1, max: 6 })],
  run: (x, nn, api) => {
    const t = who(x, api) || x.target;
    const f = who(x, api, 'from') || x.self;
    if (t && f) SVC.knock(x, f, t, num(api.in('tiles'), 2));
    return 'then';
  },
});
act('act.teleport', {
  title: 'Teleport', help: 'Moves someone to a place (the nearest open spot to it).',
  in: [ref('target', T.ent, 'Who (or self)'), ref('to', T.pos, 'To')],
  run: (x, nn, api) => {
    const t = who(x, api) || x.self;
    const to = posOf(api.in('to'));
    if (t && to) SVC.teleport(x, t, to);
    return 'then';
  },
});
act('act.kill', {
  title: 'Kill', help: 'Kills someone outright (a player is knocked down as by any blow that fells them).',
  in: [ref('target', T.ent, 'Who')],
  run: (x, nn, api) => {
    const t = who(x, api) || x.target;
    if (t) SVC.kill(x, t);
    return 'then';
  },
});
act('act.spawn', {
  title: 'Spawn creature', help: 'Brings a creature into the world (one of yours, or the game\'s own).',
  in: [ref('creature', T.creature, 'Creature'), ref('at', T.pos, 'At'), n('count', 'How many', 1, { min: 1, max: 12 })],
  out: [out('made', T.ent, 'Spawned')],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) {
      const list = SVC.spawn(x, api.in('creature'), at, Math.min(12, Math.max(1, num(api.in('count'), 1))));
      x.locals[`${nn.id}.made`] = list[list.length - 1] || null;
    }
    return 'then';
  },
});
act('act.drop', {
  title: 'Drop item', help: 'Items fall out onto the ground (to be picked up): new ones, or what someone has: in their main hand, their off hand, an armour slot, or a slot of their pack.',
  in: [ref('item', T.item, 'Item', { show: { from: ['new'] } }), ref('who', T.ent, 'Whose (or the player)', { show: { from: { not: ['new'] } } }), n('slot', 'Pack slot (1-36)', 1, { min: 1, max: 36, show: { from: ['a pack slot'] } }),
    n('count', 'How many (0: all)', 1, { min: 0, max: 999, show: { from: { not: ['an armour slot', 'the off hand'] } } }), ref('at', T.pos, 'At (or at their feet)')],
  props: [pick('from', 'From', [['new', 'nothing: new ones'], ['the main hand', 'their main hand'], ['the off hand', 'their off hand'], ['an armour slot', 'an armour slot'], ['a pack slot', 'a slot of their pack']], 'new'),
    pick('wear', 'Slot', ['head', 'body', 'legs', 'feet'], 'head', { show: { from: ['an armour slot'] } })],
  out: [out('dropped', T.item, 'Dropped')],
  run: (x, nn, api) => {
    const from = api.prop('from') || 'new';
    if (from === 'new') {
      const at = where(x, api);
      if (at) SVC.drop(x, api.in('item'), num(api.in('count'), 1), at);
      x.locals[`${nn.id}.dropped`] = api.in('item');
      return 'then';
    }
    const e = who(x, api, 'who') || x.player || x.target;
    const at = posOf(api.in('at')) || posOf(e);
    x.locals[`${nn.id}.dropped`] = e && at ? SVC.dropFrom(x, e, { from, slot: num(api.in('slot'), 1) - 1, wear: api.prop('wear'), n: num(api.in('count'), 1) }, at) : null;
    return 'then';
  },
});
act('act.loot', {
  title: 'Drop loot', help: 'Rolls one of your loot tables, and drops what comes out.',
  in: [ref('loot', T.loot, 'Loot table'), ref('at', T.pos, 'At')],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) SVC.loot(x, api.in('loot'), at);
    return 'then';
  },
});
act('act.give', {
  title: 'Give item', help: 'Into someone\'s pack (dropped at their feet if it\'s full).',
  in: [ref('item', T.item, 'Item'), n('count', 'How many', 1, { min: 1, max: 999 }), ref('target', T.ent, 'To (or the player)')],
  run: (x, nn, api) => {
    SVC.give(x, who(x, api) || x.player || x.target, api.in('item'), num(api.in('count'), 1));
    return 'then';
  },
});
def('act.take', {
  cat: 'Actions', title: 'Take item', color: C.act, help: 'Takes items from someone\'s pack, if they have them all (Has / Hasn\'t).',
  in: [F('in', 'Do'), ref('item', T.item, 'Item'), n('count', 'How many', 1, { min: 1, max: 999 }), ref('target', T.ent, 'From (or the player)')],
  out: [F('ok', 'Taken'), F('no', 'Hasn\'t enough')],
  run: (x, nn, api) => (SVC.take(x, who(x, api) || x.player || x.target, api.in('item'), num(api.in('count'), 1)) ? 'ok' : 'no'),
});
act('act.setblock', {
  title: 'Set block', help: 'Puts a block at a place (air clears it).',
  in: [ref('at', T.pos, 'At'), ref('block', T.block, 'Block')],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) SVC.setBlock(x, at, api.in('block'));
    return 'then';
  },
});
act('act.breakblock', {
  title: 'Break block', help: 'Breaks the block at a place, dropping what it drops.',
  in: [ref('at', T.pos, 'At')], props: [bool('drops', 'Drops it', true)],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) SVC.breakBlock(x, at, api.prop('drops'));
    return 'then';
  },
});
act('act.explode', {
  title: 'Explosion', help: 'A blast: hurts everyone in its radius, and can break the blocks round it.',
  in: [ref('at', T.pos, 'At'), n('radius', 'Radius', 2, { min: 1, max: 6 }), n('damage', 'Damage', 8, { min: 0, max: 9999 })], props: [bool('blocks', 'Breaks blocks', false)],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) SVC.explode(x, at, num(api.in('radius'), 2), num(api.in('damage'), 8), api.prop('blocks'));
    return 'then';
  },
});
act('act.lightning', {
  title: 'Lightning', help: 'A bolt from the sky onto a place.',
  in: [ref('at', T.pos, 'At'), n('damage', 'Damage', 10, { min: 0, max: 9999 })],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) SVC.lightning(x, at, num(api.in('damage'), 10));
    return 'then';
  },
});
act('act.fire', {
  title: 'Set the ground alight', help: 'Fire on the ground round a place, for a while (it burns whoever stands in it).',
  in: [ref('at', T.pos, 'At'), n('radius', 'Radius', 1, { min: 0, max: 5 })],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) SVC.groundFire(x, at, num(api.in('radius'), 1));
    return 'then';
  },
});
act('act.structure', {
  title: 'Place structure', help: 'Builds one of your structures at a place, all at once.',
  in: [ref('structure', T.structure, 'Structure'), ref('at', T.pos, 'At')],
  run: (x, nn, api) => {
    const at = where(x, api);
    if (at) SVC.placeStructure(x, api.in('structure'), at);
    return 'then';
  },
});
act('act.story', {
  title: 'Start story', help: 'Begins one of your stories, here (if there\'s room for it).',
  in: [ref('story', T.story, 'Story')],
  run: (x, nn, api) => {
    SVC.startStory(x, api.in('story'));
    return 'then';
  },
});
act('act.send', {
  title: 'Send event', help: 'Sends an event of a name, with a value: every On event (and World event) of that name hears it.',
  in: [txt('name', 'Event name', 'my_event'), { id: 'value', t: T.any, label: 'Value', def: null }],
  run: (x, nn, api) => {
    SVC.send(x, String(api.in('name') || ''), api.in('value'));
    return 'then';
  },
});
act('act.setvar', {
  title: 'Set variable', help: 'Keeps a value by a name: on this one creature or block (Self), for this flow only (Local), for the whole world, kept with it (World), or with the player\'s character (Player: what they chose on the character screen is there too, each row by its id).',
  in: [txt('name', 'Name', 'count'), { id: 'value', t: T.any, label: 'Value', def: 0 }], props: [pick('scope', 'Kept', ['self', 'world', 'local', 'player'])],
  run: (x, nn, api) => {
    SVC.setVar(x, api.prop('scope'), String(api.in('name')), api.in('value'));
    return 'then';
  },
});
act('act.addvar', {
  title: 'Add to variable', help: 'Adds to a number kept by a name (see Set variable).',
  in: [txt('name', 'Name', 'count'), n('by', 'Add', 1)], props: [pick('scope', 'Kept', ['self', 'world', 'local', 'player'])],
  run: (x, nn, api) => {
    const s = api.prop('scope');
    const k = String(api.in('name'));
    SVC.setVar(x, s, k, num(SVC.getVar(x, s, k)) + num(api.in('by'), 1));
    return 'then';
  },
});

act('act.weather', {
  title: 'Change the weather', help: 'Rain, snow, fog or clear skies, for so many minutes of the game\'s time (or back to how it would be).',
  in: [n('mins', 'For (game minutes)', 120, { min: 1, max: 24 * 60 * 7, show: { kind: { not: ['as it would be'] } } })], props: [pick('kind', 'Weather', ['rain', 'snow', 'fog', 'clear', 'as it would be'])],
  run: (x, nn, api) => {
    SVC.weather(x, api.prop('kind'), num(api.in('mins'), 120));
    return 'then';
  },
});
act('act.time', {
  title: 'Set the time', help: 'The time of day: set to an hour, or moved on by so many hours.',
  in: [n('h', 'Hour', 8, { min: -240, max: 240, step: 0.25 })], props: [pick('how', 'Do', ['set', 'add hours'])],
  run: (x, nn, api) => {
    SVC.setTime(x, api.prop('how'), num(api.in('h'), 8));
    return 'then';
  },
});
act('act.fill', {
  title: 'Fill an area', help: 'Every block in a box between two corners set to one block (air clears it). No more than 4096 at once.',
  in: [ref('a', T.pos, 'From corner'), ref('b', T.pos, 'To corner'), ref('block', T.block, 'Block')], out: [out('n', T.num, 'Blocks set')],
  run: (x, nn, api) => {
    const a = posOf(api.in('a'));
    const b = posOf(api.in('b'));
    x.locals[`${nn.id}.n`] = a && b ? SVC.fill(x, a, b, api.in('block')) : 0;
    return 'then';
  },
});

// ------------------------------------------------------------ behaviour
// (Round 64) What a creature does: told to walk somewhere, follow, flee,
// wander, patrol, keep away, stand, guard, go after someone. One order at
// a time (a new one takes its place); done, it goes back to its own ways.
const beh = (type, o) => def(type, { cat: 'Behaviour', color: C.beh, ...o, in: [F('in', 'Do'), ref('who', T.ent, 'Who (or self)'), ...(o.in || [])], out: [F('then', 'Then'), ...(o.out || [])] });
const creatureOf = (x, api) => who(x, api, 'who') || (isEnt(x.self) && x.self.kind !== 'player' ? x.self : null);
const paceOf = (api) => (api.prop('pace') === 'run' ? 0.6 : api.prop('pace') === 'creep' ? 1.8 : 1);
const PACE = pick('pace', 'Pace', ['walk', 'run', 'creep']);
const FIGHTS = bool('fights', 'Breaks off to fight', true);
beh('beh.goto', {
  title: 'Walk to', help: 'Off to a place, round whatever\'s in the way. Arrived when it gets there; Couldn\'t if it can\'t (or it takes too long).',
  in: [ref('to', T.pos, 'To'), n('near', 'Close enough (paces)', 1, { min: 0, max: 20 }), n('secs', 'Give up after (s)', 30, { min: 1, max: 600 })], props: [PACE, bool('fights', 'Breaks off to fight', false)],
  out: [F('arrived', 'Arrived'), F('failed', 'Couldn\'t')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    const to = posOf(api.in('to'));
    if (!c || !to) return 'then';
    const go = api.afterwards('arrived');
    const no = api.afterwards('failed');
    SVC.order(x, c, { kind: 'goto', at: to, near: num(api.in('near'), 1), secs: num(api.in('secs'), 30), pace: paceOf(api), fights: api.prop('fights'), done: (p) => (p === 'arrived' ? go() : no()) });
    return 'then';
  },
});
beh('beh.follow', {
  title: 'Follow', help: 'Keeps near someone (for so long, or till it\'s told something else).',
  in: [ref('leader', T.ent, 'Follow (or the player)'), n('dist', 'Keeps within (paces)', 2, { min: 1, max: 20 }), n('secs', 'For (s, 0: till told)', 0, { min: 0, max: 3600 })], props: [PACE, FIGHTS],
  out: [F('done', 'Done')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    const lead = who(x, api, 'leader') || x.player || x.target;
    if (!c || !lead) return 'then';
    const done = api.afterwards('done');
    SVC.order(x, c, { kind: 'follow', who: lead, dist: num(api.in('dist'), 2), secs: num(api.in('secs'), 0), pace: paceOf(api), fights: api.prop('fights'), done: () => done() });
    return 'then';
  },
});
beh('beh.flee', {
  title: 'Run from', help: 'Away from someone (or somewhere) till it\'s so far off: Safe then. For a while, it keeps its distance.',
  in: [ref('from', T.pos, 'From (or its foe)'), n('far', 'Till (paces)', 10, { min: 2, max: 60 }), n('secs', 'For (s, 0: till safe)', 0, { min: 0, max: 600 })], props: [PACE],
  out: [F('safe', 'Safe')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    const f = api.in('from') || (c && c.target) || x.target || x.player;
    if (!c || !posOf(f)) return 'then';
    const safe = api.afterwards('safe');
    SVC.order(x, c, { kind: 'flee', from: f, far: num(api.in('far'), 10), secs: num(api.in('secs'), 0), pace: paceOf(api), done: (p) => p === 'safe' && safe() });
    return 'then';
  },
});
beh('beh.wander', {
  title: 'Wander', help: 'Ambles about a place (or its home), never further than so far.',
  in: [ref('around', T.pos, 'Around (or its home)'), n('r', 'Within (paces)', 6, { min: 1, max: 60 }), n('every', 'A step every (s)', 2, { min: 0.2, max: 30, step: 0.1 }), n('secs', 'For (s, 0: till told)', 0, { min: 0, max: 3600 })], props: [PACE, FIGHTS],
  out: [F('done', 'Done')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    if (!c) return 'then';
    const done = api.afterwards('done');
    SVC.order(x, c, { kind: 'wander', at: posOf(api.in('around')), r: num(api.in('r'), 6), every: num(api.in('every'), 2), secs: num(api.in('secs'), 0), pace: paceOf(api), fights: api.prop('fights'), done: () => done() });
    return 'then';
  },
});
beh('beh.patrol', {
  title: 'Patrol', help: 'From place to place, waiting a moment at each: round and round, or there and back. Each fires at every one it reaches.',
  in: [ref('a', T.pos, 'Place 1'), ref('b', T.pos, 'Place 2'), ref('c', T.pos, 'Place 3'), ref('d', T.pos, 'Place 4', { adv: true }), n('pause', 'Waits (s)', 1, { min: 0, max: 60, step: 0.5 })], props: [pick('way', 'Goes', ['round and round', 'there and back']), PACE, FIGHTS],
  out: [F('each', 'At each'), out('at', T.pos, 'Where')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    const pts = ['a', 'b', 'c', 'd'].map((k) => posOf(api.in(k))).filter(Boolean);
    if (!c || !pts.length) return 'then';
    const each = api.afterwards('each');
    SVC.order(x, c, { kind: 'patrol', points: pts, pause: num(api.in('pause'), 1), back: api.prop('way') === 'there and back', pace: paceOf(api), fights: api.prop('fights'), each: (at) => each({ [`${nn.id}.at`]: at }) });
    return 'then';
  },
});
beh('beh.keep', {
  title: 'Keep its distance', help: 'Neither closer nor further than it likes from someone: backing off, closing in, circling (good with Shoot).',
  in: [ref('from', T.ent, 'From (or its foe)'), n('min', 'No closer than', 3, { min: 0, max: 30 }), n('max', 'No further than', 6, { min: 1, max: 40 }), n('secs', 'For (s, 0: till told)', 0, { min: 0, max: 3600 })], props: [PACE],
  out: [F('done', 'Done')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    const w = who(x, api, 'from') || (c && c.target) || x.target || x.player;
    if (!c || !w) return 'then';
    const done = api.afterwards('done');
    SVC.order(x, c, { kind: 'keep', who: w, min: num(api.in('min'), 3), max: num(api.in('max'), 6), secs: num(api.in('secs'), 0), pace: paceOf(api), done: () => done() });
    return 'then';
  },
});
beh('beh.hold', {
  title: 'Stand still', help: 'Stands where it is for a while (facing someone, if you like), then Done.',
  in: [n('secs', 'For (s)', 3, { min: 0.2, max: 3600, step: 0.1 }), ref('face', T.pos, 'Facing', { adv: true })],
  out: [F('done', 'Done')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    if (!c) return 'then';
    const done = api.afterwards('done');
    SVC.order(x, c, { kind: 'hold', face: api.in('face') || null, secs: num(api.in('secs'), 3), done: () => done() });
    return 'then';
  },
});
beh('beh.guard', {
  title: 'Guard a place', help: 'Keeps to a place and goes for whoever comes within so far of it (its foes, players, creatures of a kind, anyone not its own kind), back again after.',
  in: [ref('at', T.pos, 'Place (or where it is)'), n('r', 'Within (paces)', 6, { min: 1, max: 40 }), ref('species', T.creature, 'Only this creature', { show: { which: ['creatures'] } }), n('secs', 'For (s, 0: till told)', 0, { min: 0, max: 3600, adv: true })],
  props: [pick('which', 'Goes for', ['its foes', 'players', 'creatures', 'everyone not of its kind'])],
  out: [F('done', 'Done')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    if (!c) return 'then';
    const done = api.afterwards('done');
    const sp = api.in('species');
    SVC.order(x, c, { kind: 'guard', at: posOf(api.in('at')) || posOf(c), r: num(api.in('r'), 6), which: api.prop('which'), species: sp ? SVC.speciesKey(x, sp) : null, secs: num(api.in('secs'), 0), done: () => done() });
    return 'then';
  },
});
beh('beh.hunt', {
  title: 'Go after', help: 'Goes after someone and fights them (anyone: a player, another creature, a person), till one of them falls or it\'s told otherwise.',
  in: [ref('prey', T.ent, 'After (or the target)')],
  out: [F('done', 'Done')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    const w = who(x, api, 'prey') || x.target;
    if (!c || !w || w === c) return 'then';
    const done = api.afterwards('done');
    SVC.order(x, c, { kind: 'hunt', who: w, done: () => done() });
    return 'then';
  },
});
beh('beh.stop', {
  title: 'Back to its own ways', help: 'Whatever it was told to do, it stops, and goes back to its own ways.',
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    if (c) SVC.order(x, c, null);
    return 'then';
  },
});
beh('beh.leap', {
  title: 'Leap', help: 'Springs through the air to a place, or at someone (landing beside them).',
  in: [ref('to', T.pos, 'To (or its foe)'), n('height', 'Height', 14, { min: 4, max: 40 })],
  out: [F('landed', 'Landed')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    const to = posOf(api.in('to')) || posOf(c && c.target) || posOf(x.target);
    if (c && to && SVC.leap(x, c, to, num(api.in('height'), 14))) api.later(c.moveDur || 0.4, 'landed');
    return 'then';
  },
});
beh('beh.face', {
  title: 'Turn to face', help: 'Turns to face someone, or a place.',
  in: [ref('at', T.pos, 'Toward (or the target)')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    const at = posOf(api.in('at')) || posOf(x.target) || posOf(x.player);
    if (c && at) SVC.face(x, c, at);
    return 'then';
  },
});
beh('beh.temper', {
  title: 'Change temper', help: 'Calmed (it fights nobody), riled (it turns on the target, or whoever it meets), or back to its nature: for a while, or for good.',
  in: [n('secs', 'For (s, 0: for good)', 0, { min: 0, max: 3600, show: { how: { not: ['its nature'] } } })], props: [pick('how', 'Becomes', ['calm', 'hostile', 'its nature'])],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    if (c) SVC.temper(x, c, api.prop('how'), num(api.in('secs'), 0));
    return 'then';
  },
});
beh('beh.pace', {
  title: 'Change pace', help: 'Quicker or slower on its feet (2: twice as fast; 0.5: half), for a while or for good.',
  in: [n('k', 'Times as fast', 1.5, { min: 0.2, max: 5, step: 0.05 }), n('secs', 'For (s, 0: for good)', 0, { min: 0, max: 3600 })],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    if (c) SVC.pace(x, c, num(api.in('k'), 1.5), num(api.in('secs'), 0));
    return 'then';
  },
});
beh('beh.home', {
  title: 'Set its home', help: 'Where it calls home: where it wanders about and goes back to.',
  in: [ref('at', T.pos, 'Home (or where it is)')],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    if (c) SVC.setHome(x, c, posOf(api.in('at')) || posOf(c));
    return 'then';
  },
});
beh('beh.join', {
  title: 'Join someone', help: 'Becomes a player\'s companion: at their heel, fighting what comes for them (or leaves them again).',
  in: [ref('to', T.ent, 'Joins (or the player)', { show: { how: ['joins'] } })], props: [pick('how', 'It', ['joins', 'leaves'])],
  run: (x, nn, api) => {
    const c = creatureOf(x, api);
    const p = who(x, api, 'to') || x.player || x.target;
    if (c) SVC.join(x, c, p, api.prop('how') === 'leaves');
    return 'then';
  },
});

// ------------------------------------------------------------ attacks
const bossAct = (type, o) => act(type, { cat: 'Attacks', color: C.boss, ...o });
bossAct('atk.hazard', {
  title: 'Telegraphed blast', help: 'The ground lights up where it will strike (a ring, a circle, a line toward the foe, a cross, a cone), then it strikes after the wind-up.',
  in: [ref('at', T.pos, 'Centre (or self)'), n('radius', 'Size', 3, { min: 1, max: 14 }), n('windup', 'Wind-up (s)', 0.8, { min: 0.1, max: 4, step: 0.05 }), n('damage', 'Damage', 6, { min: 0, max: 9999 }), col('color', 'Colour', '#ff6040')],
  props: [pick('shape', 'Shape', ['ring', 'circle', 'line', 'cross', 'cone']), pick('element', 'Element', ELEMENTS)],
  run: (x, nn, api) => {
    SVC.hazard(x, { at: posOf(api.in('at')) || posOf(x.self), shape: api.prop('shape'), r: num(api.in('radius'), 3), windup: num(api.in('windup'), 0.8), dmg: num(api.in('damage'), 6), color: api.in('color'), element: api.prop('element') });
    return 'then';
  },
});
bossAct('atk.rings', {
  title: 'Shockwaves', help: 'Rings spreading out from the caster one after another, each with a gap to step through.',
  in: [n('count', 'Rings', 3, { min: 1, max: 8 }), n('gap', 'Seconds apart', 0.6, { min: 0.2, max: 3, step: 0.05 }), n('damage', 'Damage', 5, { min: 0, max: 9999 }), col('color', 'Colour', '#c8a0ff')], props: [pick('element', 'Element', ELEMENTS, 'force')],
  run: (x, nn, api) => {
    SVC.rings(x, num(api.in('count'), 3), num(api.in('gap'), 0.6), num(api.in('damage'), 5), api.in('color'), api.prop('element'));
    return 'then';
  },
});
bossAct('atk.charge', {
  title: 'Charge', help: 'Rushes at its foe in a line, striking whoever\'s in the way.',
  in: [ref('target', T.ent, 'At (or its foe)'), n('far', 'Paces', 6, { min: 2, max: 16 }), n('damage', 'Damage', 6, { min: 0, max: 9999 })],
  run: (x, nn, api) => {
    SVC.charge(x, who(x, api) || x.target, num(api.in('far'), 6), num(api.in('damage'), 6));
    return 'then';
  },
});
bossAct('atk.shoot', {
  title: 'Shoot', help: 'Shoots at someone (or a place): one of your Projectiles, or a plain bolt of colour. A volley spreads them in a fan.',
  in: [ref('projectile', T.any, 'Projectile (or none)'), ref('target', T.any, 'At (or its foe)'), n('count', 'Volley', 1, { min: 1, max: 12 }), n('spread', 'Spread (°)', 30, { min: 0, max: 360 }), n('damage', 'Damage', 4, { min: 0, max: 9999 }), col('color', 'Colour', '#ff9040')],
  props: [pick('element', 'Element', ELEMENTS, 'fire')],
  out: [F('hit', 'On hit'), out('foe', T.ent, 'Struck'), out('pos', T.pos, 'Where it landed')],
  run: (x, nn, api) => {
    const t = api.in('target');
    SVC.shoot(x, { proj: api.in('projectile'), at: isEnt(t) ? t : posOf(t) || x.target, n: num(api.in('count'), 1), spread: num(api.in('spread'), 30), dmg: num(api.in('damage'), 4), color: api.in('color'), element: api.prop('element'),
      onHit: (y) => {
        x.locals[`${nn.id}.foe`] = y.target || null;
        x.locals[`${nn.id}.pos`] = y.pos || null;
        api.fire('hit');
      } });
    return 'then';
  },
});
bossAct('atk.summon', {
  title: 'Summon', help: 'Calls creatures round the caster (they fight on its side).',
  in: [ref('creature', T.creature, 'Creature'), n('count', 'How many', 2, { min: 1, max: 8 })],
  run: (x, nn, api) => {
    SVC.summon(x, api.in('creature'), Math.min(8, Math.max(1, num(api.in('count'), 2))));
    return 'then';
  },
});
bossAct('atk.blink', {
  title: 'Blink', help: 'Vanishes and appears again near its foe (or across its hall).',
  in: [n('far', 'Paces from foe', 3, { min: 1, max: 12 })],
  run: (x, nn, api) => {
    SVC.blink(x, num(api.in('far'), 3));
    return 'then';
  },
});
bossAct('atk.guard', {
  title: 'Become untouchable', help: 'Nothing hurts the caster for a while (a shimmer round it).',
  in: [n('secs', 'Seconds', 3, { min: 0.5, max: 30, step: 0.5 })],
  run: (x, nn, api) => {
    SVC.guard(x, num(api.in('secs'), 3));
    return 'then';
  },
});

// ============================================================ talk
def('dlg.say', {
  cat: 'Dialogue', title: 'Say', color: C.dlg, waits: true,
  help: 'A line spoken to whoever\'s talking, and up to four answers to pick from (empty answers are left out; none at all: one "Go on").',
  in: [F('in', 'Do'), txt('text', 'Line', 'Well met, traveller.', { long: true }), txt('a', 'Answer 1', 'Who are you?'), txt('b', 'Answer 2', 'Goodbye.'), txt('c', 'Answer 3', ''), txt('d', 'Answer 4', ''), ref('speaker', T.ent, 'Speaker (or self)', { adv: true })],
  out: [F('ra', 'Answer 1'), F('rb', 'Answer 2'), F('rc', 'Answer 3'), F('rd', 'Answer 4')],
  run: (x, nn, api) => {
    const opts = ['a', 'b', 'c', 'd'].map((k) => [k, fillText(x, api.in(k))]).filter(([, t]) => t);
    api.ask(fillText(x, api.in('text')), opts.map(([, t]) => t), (i) => {
      const k = opts[i] ? opts[i][0] : 'a';
      api.fire(`r${k}`);
    });
    return null;
  },
});
def('dlg.end', {
  cat: 'Dialogue', title: 'End talk', color: C.dlg, help: 'Ends the conversation (with a last line, if you like).',
  in: [F('in', 'Do'), txt('text', 'Last line', '')], out: [],
  run: (x, nn, api) => {
    SVC.endTalk(x, fillText(x, api.in('text')));
    return null;
  },
});

// ============================================================ values
const val = (type, o) => def(type, { cat: 'Values', color: C.data, ...o });
val('val.number', { title: 'Number', in: [n('v', 'Value', 1)], out: [out('out', T.num, 'Number')], eval: (x, nn, p, api) => num(api.in('v')) });
val('val.text', { title: 'Text', in: [txt('v', 'Value', 'hello', { long: true })], out: [out('out', T.text, 'Text')], eval: (x, nn, p, api) => fillText(x, api.in('v')) });
val('val.bool', { title: 'Yes / No', in: [bool('v', 'Value', true)], out: [out('out', T.bool, 'Value')], eval: (x, nn, p, api) => !!api.in('v') });
val('val.color', { title: 'Colour', in: [col('v', 'Colour', '#ffe070')], out: [out('out', T.color, 'Colour')], eval: (x, nn, p, api) => api.in('v') });
const refNode = (type, t, title, help) => def(type, { cat: 'Things', color: C.ref, title, help, props: [{ id: 'ref', t, label: title, def: null }], out: [out('out', t, title)], eval: (x, nn, p, api) => api.prop('ref') });
refNode('ref.asset', T.asset, 'Art', 'A piece of your pixel art (drag one in from the explorer).');
refNode('ref.vfx', T.vfx, 'Effect', 'One of your effects.');
refNode('ref.rig', T.rig, 'Rig', 'One of your rigs.');
refNode('ref.item', T.item, 'Item', 'An item: yours, or one of the game\'s.');
refNode('ref.block', T.block, 'Block', 'A block: yours, or one of the game\'s.');
refNode('ref.creature', T.creature, 'Creature', 'A creature: yours, or one of the game\'s.');
refNode('ref.loot', T.loot, 'Loot table', 'One of your loot tables.');
refNode('ref.structure', T.structure, 'Structure', 'One of your structures.');
refNode('ref.story', T.story, 'Story', 'One of your stories.');
refNode('ref.effect', T.effect, 'Effect entity', 'One of your Effects (a lasting blessing or curse).');
refNode('ref.projectile', T.any, 'Projectile', 'One of your Projectiles.');

// ------------------------------------------------------------ who and where
const q = (type, o) => def(type, { cat: 'Who & where', color: C.q, ...o });
q('ctx.self', { title: 'Self', help: 'The creature, block, item user or boss this graph belongs to.', out: [out('out', T.ent, 'Self')], eval: (x) => x.self || null });
// (Round 65) Target, upgraded: who it's about, or its foe, who last hurt
// it, who it's following, a player looking at it, the strongest or
// weakest or a random foe near; with where they are, how far, how hurt.
export const TARGETS = ['who it\'s about', 'its foe', 'who last hurt it', 'who it last hurt', 'who it\'s following', 'the nearest player', 'a player looking at it', 'the strongest foe near', 'the weakest foe near', 'a random foe near', 'its owner (a companion\'s)'];
q('ctx.target', { title: 'Target', help: 'Someone, by how they stand to this one: who it\'s about (the foe struck, the one talking, whoever stepped on it), its foe, who last hurt it or was last hurt by it, who it\'s following, the nearest player, a player looking straight at it, the strongest, weakest or a random foe within reach. With where they are, how far, and how hurt.',
  in: [ref('of', T.ent, 'Of (or self)', { adv: true }), n('r', 'Looks within', 12, { min: 1, max: 60, show: (g) => ['the nearest player', 'a player looking at it', 'the strongest foe near', 'the weakest foe near', 'a random foe near'].includes(g('which')) })],
  props: [pick('which', 'Which', TARGETS)],
  out: [out('out', T.ent, 'Target'), out('found', T.bool, 'Found'), out('pos', T.pos, 'Where'), out('dist', T.num, 'How far'), out('pct', T.num, 'Health %')],
  eval: (x, nn, p, api) => {
    const k = `${nn.id}.t`;
    let t = x.locals[k];
    if (t === undefined || x.locals[`${k}@`] !== x.steps) {
      t = api.prop('which') && api.prop('which') !== 'who it\'s about' ? SVC.target?.(x, (isEnt(api.in('of')) && api.in('of')) || x.self, api.prop('which'), num(api.in('r'), 12)) ?? null : x.target || null;
      x.locals[k] = t;
      x.locals[`${k}@`] = x.steps;
    }
    if (p === 'found') return !!t;
    if (p === 'pos') return posOf(t);
    if (p === 'dist') {
      const a = posOf(api.in('of')) || posOf(x.self) || posOf(x.pos);
      return t && a ? Math.hypot(t.x - a.x, t.z - a.z) : 0;
    }
    if (p === 'pct') return t && t.maxHp ? Math.round((100 * Math.max(0, t.hp)) / t.maxHp) : 0;
    return t;
  } });
q('ctx.player', { title: 'Player', help: 'The player it\'s about (whoever used it, or the nearest).', out: [out('out', T.ent, 'Player')], eval: (x) => x.player || SVC.nearestPlayer?.(x) || null });
q('ctx.here', { title: 'Here', help: 'Where it happened (the block, the place struck, the creature).', out: [out('out', T.pos, 'Place')], eval: (x) => posOf(x.pos) || posOf(x.self) || null });
q('q.posof', { title: 'Place of', help: 'Where someone stands.', in: [ref('who', T.ent, 'Who')], out: [out('out', T.pos, 'Place')], eval: (x, nn, p, api) => posOf(api.in('who')) });
q('q.offset', { title: 'Place nearby', help: 'A place moved from another by so many paces (east, up, south).', in: [ref('at', T.pos, 'From'), n('dx', 'East', 0), n('dy', 'Up', 0), n('dz', 'South', 0)], out: [out('out', T.pos, 'Place')], eval: (x, nn, p, api) => {
  const a = posOf(api.in('at')) || posOf(x.pos) || posOf(x.self);
  return a ? { x: a.x + num(api.in('dx')), y: a.y + num(api.in('dy')), z: a.z + num(api.in('dz')) } : null;
} });
q('q.randpos', { title: 'Random place near', help: 'Somewhere open within so many paces.', in: [ref('at', T.pos, 'Around'), n('r', 'Within', 5, { min: 1, max: 40 })], out: [out('out', T.pos, 'Place')], eval: (x, nn, p, api) => SVC.randomSpot(x, posOf(api.in('at')) || posOf(x.pos) || posOf(x.self), num(api.in('r'), 5)) });
// (Round 65) Nearest, upgraded: of players, foes, creatures (of a kind),
// people (of a trade), or a block, a dropped item, one of your
// structures, a town; with where, how far, and whether there was one.
export const NEAREST = ['players', 'foes of self', 'creatures', 'everyone', 'a kind of creature', 'people (of a trade)', 'a block', 'a dropped item', 'one of your structures', 'a town'];
const ENT_NEAREST = ['players', 'foes of self', 'creatures', 'everyone', 'a kind of creature', 'people (of a trade)'];
q('q.nearest', { title: 'Nearest', help: 'The nearest one (of a kind) to a place, within so many paces: a player, a foe, a creature (of a kind), someone of a trade, a block of a kind, an item lying on the ground, one of your structures, a town. With where it is, how far, and whether there was one at all.',
  in: [ref('at', T.pos, 'To'), n('r', 'Within', 10, { min: 1, max: 200 }), ref('species', T.creature, 'Of this creature', { show: (g) => ['creatures', 'everyone', 'a kind of creature'].includes(g('which')) }),
    ref('block', T.block, 'Block', { show: { which: ['a block'] } }), ref('item', T.item, 'Item (or any)', { show: { which: ['a dropped item'] } }), ref('structure', T.structure, 'Structure', { show: { which: ['one of your structures'] } })],
  props: [pick('which', 'Of', NEAREST, 'players'), pick('job', 'Trade', [['anyone', 'Any trade'], ...JOB_LIST], 'anyone', { show: { which: ['people (of a trade)'] } }), pick('kind', 'Kind', ['any', 'village', 'town', 'city'], 'any', { show: { which: ['a town'] } }),
    bool('notSelf', 'Not itself', true, { show: { which: ENT_NEAREST } }), bool('sight', 'Only in plain sight', false, { show: { which: ENT_NEAREST } })],
  out: [{ ...out('out', T.ent, 'Who'), show: { which: ENT_NEAREST } }, { ...out('town', T.town, 'Town'), show: { which: ['a town'] } }, out('pos', T.pos, 'Where'), out('dist', T.num, 'How far'), out('found', T.bool, 'Found')],
  eval: (x, nn, p, api) => {
    const k = `${nn.id}.hit`;
    let hit = x.locals[k];
    if (hit === undefined || x.locals[`${k}@`] !== x.steps) {
      const at = posOf(api.in('at')) || posOf(x.pos) || posOf(x.self);
      hit = at && SVC.findNearest ? SVC.findNearest(x, at, { which: api.prop('which') || 'players', r: num(api.in('r'), 10), species: api.in('species'), block: api.in('block'), item: api.in('item'), structure: api.in('structure'), job: api.prop('job'), kind: api.prop('kind'), notSelf: api.prop('notSelf') !== false, sight: !!api.prop('sight') }) : null;
      x.locals[k] = hit;
      x.locals[`${k}@`] = x.steps;
    }
    if (p === 'found') return !!hit;
    if (!hit) return p === 'dist' ? 0 : null;
    if (p === 'pos') return hit.pos;
    if (p === 'dist') return hit.dist;
    if (p === 'town') return hit.town || null;
    return hit.ent || null;
  } });
q('q.count', { title: 'Count nearby', help: 'How many (of a kind) are within so many paces.', in: [ref('at', T.pos, 'Around'), n('r', 'Within', 10, { min: 1, max: 60 }), ref('species', T.creature, 'Only this creature', { adv: true })], props: [pick('which', 'Who', ['creatures', 'players', 'foes of self', 'everyone'])], out: [out('out', T.num, 'How many')],
  eval: (x, nn, p, api) => {
    const at = posOf(api.in('at')) || posOf(x.pos) || posOf(x.self);
    const sp = api.in('species');
    return at ? SVC.near(x, at, num(api.in('r'), 10), api.prop('which')).filter((e) => !sp || e.species === SVC.speciesKey(x, sp)).length : 0;
  } });
q('q.distance', { title: 'Distance', help: 'Paces between two places (or two people).', in: [ref('a', T.pos, 'From'), ref('b', T.pos, 'To')], out: [out('out', T.num, 'Paces')], eval: (x, nn, p, api) => {
  const a = posOf(api.in('a')) || posOf(x.self);
  const b = posOf(api.in('b')) || posOf(x.target);
  return a && b ? Math.hypot(a.x - b.x, a.z - b.z) : 0;
} });
q('q.health', { title: 'Health of', help: 'Someone\'s health: as it is, at most, and as a percentage.', in: [ref('who', T.ent, 'Who (or self)')], out: [out('hp', T.num, 'Health'), out('max', T.num, 'Most'), out('pct', T.num, 'Percent')], eval: (x, nn, p, api) => {
  const e = (isEnt(api.in('who')) && api.in('who')) || x.self;
  if (!e) return 0;
  return p === 'hp' ? e.hp : p === 'max' ? e.maxHp : Math.round((100 * e.hp) / Math.max(1, e.maxHp));
} });
q('q.isplayer', { title: 'Is a player?', in: [ref('who', T.ent, 'Who')], out: [out('out', T.bool, 'Yes')], eval: (x, nn, p, api) => !!(api.in('who') && api.in('who').kind === 'player') });
q('q.hasitem', { title: 'Has item?', help: 'Whether someone carries so many of an item.', in: [ref('who', T.ent, 'Who (or the player)'), ref('item', T.item, 'Item'), n('count', 'At least', 1, { min: 1 })], out: [out('out', T.bool, 'Has'), out('n', T.num, 'How many')], eval: (x, nn, p, api) => {
  const e = (isEnt(api.in('who')) && api.in('who')) || x.player || x.target;
  const k = SVC.count(x, e, api.in('item'));
  return p === 'n' ? k : k >= num(api.in('count'), 1);
} });
q('q.held', { title: 'Item in hand', help: 'What someone holds (its key), and whether it\'s this one.', in: [ref('who', T.ent, 'Who (or the player)'), ref('item', T.item, 'Is it')], out: [out('is', T.bool, 'Holding it'), out('key', T.item, 'Holding')], eval: (x, nn, p, api) => {
  const e = (isEnt(api.in('who')) && api.in('who')) || x.player;
  const k = e && e.heldItem ? e.heldItem() : null;
  return p === 'key' ? k : !!k && k === SVC.itemKey(x, api.in('item'));
} });
q('q.blockat', { title: 'Block at', help: 'Whether the block at a place is this one (or air).', in: [ref('at', T.pos, 'At'), ref('block', T.block, 'Is it')], out: [out('is', T.bool, 'It is'), out('block', T.block, 'Block')], eval: (x, nn, p, api) => {
  const at = posOf(api.in('at')) || posOf(x.pos);
  const b = at ? SVC.blockAt(x, at) : null;
  return p === 'block' ? b : !!b && b === SVC.blockKey(x, api.in('block'));
} });

// (Round 64) What a creature is at, and about it.
q('q.doing', { title: 'What it\'s doing', help: 'What a creature\'s at, in a word (walking, following, fleeing, wandering, patrolling, keeping away, standing, guarding, fighting, hunting, its own ways), and whether it\'s been told something.', in: [ref('who', T.ent, 'Who (or self)')], out: [out('what', T.text, 'Doing'), out('busy', T.bool, 'Told something')], eval: (x, nn, p, api) => {
  const e = (isEnt(api.in('who')) && api.in('who')) || x.self;
  return p === 'busy' ? !!(e && e.modOrder) : SVC.doing ? SVC.doing(x, e) : 'its own ways';
} });
q('q.foe', { title: 'Its foe', help: 'Who a creature is fighting (none if nobody).', in: [ref('who', T.ent, 'Who (or self)')], out: [out('out', T.ent, 'Foe')], eval: (x, nn, p, api) => {
  const e = (isEnt(api.in('who')) && api.in('who')) || x.self;
  return e && e.target && !e.target.dead ? e.target : null;
} });
q('q.home', { title: 'Its home', help: 'Where a creature calls home (where it wanders about).', in: [ref('who', T.ent, 'Who (or self)')], out: [out('out', T.pos, 'Home')], eval: (x, nn, p, api) => {
  const e = (isEnt(api.in('who')) && api.in('who')) || x.self;
  return e && e.home ? { x: e.home.x, y: e.home.y ?? e.y, z: e.home.z } : posOf(e);
} });
q('q.alive', { title: 'Still alive?', help: 'Whether someone is still alive (and about).', in: [ref('who', T.ent, 'Who')], out: [out('out', T.bool, 'Alive')], eval: (x, nn, p, api) => {
  const e = api.in('who');
  return !!(isEnt(e) && !e.dead && !e.limbo);
} });
q('q.kind', { title: 'Kind of', help: 'What kind of thing someone is (a creature\'s kind, "player", "person"), and whether it\'s this creature.', in: [ref('who', T.ent, 'Who (or the target)'), ref('species', T.creature, 'Is it')], out: [out('is', T.bool, 'It is'), out('kind', T.text, 'Kind')], eval: (x, nn, p, api) => {
  const e = (isEnt(api.in('who')) && api.in('who')) || x.target;
  const k = !e ? '' : e.kind === 'player' ? 'player' : e.kind === 'npc' ? 'person' : e.species || e.kind;
  return p === 'kind' ? k : !!e && !!api.in('species') && k === SVC.speciesKey(x, api.in('species'));
} });
q('q.wearing', { title: 'Worn', help: 'What someone wears in a slot (its key), and whether it\'s this.', in: [ref('who', T.ent, 'Who (or the player)'), ref('item', T.item, 'Is it')], props: [pick('slot', 'Slot', ['head', 'body', 'legs', 'feet', 'shield'])], out: [out('is', T.bool, 'Wearing it'), out('key', T.item, 'Wearing')], eval: (x, nn, p, api) => {
  const e = (isEnt(api.in('who')) && api.in('who')) || x.player;
  const k = e && e.equip ? e.equip[api.prop('slot')] || null : null;
  return p === 'key' ? k : !!k && k === SVC.itemKey(x, api.in('item'));
} });

// ------------------------------------------------------------ the world
const w = (type, o) => def(type, { cat: 'World', color: C.q, ...o });
w('q.night', { title: 'Is it night?', out: [out('out', T.bool, 'Night')], eval: (x) => SVC.isNight(x) });
w('q.hour', { title: 'Time of day', help: 'The hour (0-23.99) and the day.', out: [out('h', T.num, 'Hour'), out('day', T.num, 'Day')], eval: (x, nn, p) => (p === 'day' ? SVC.day(x) : SVC.hour(x)) });
w('q.biome', { title: 'Biome at', help: 'Whether a place is in a biome.', in: [ref('at', T.pos, 'At')], props: [pick('biome', 'Biome', BIOME_LIST)], out: [out('is', T.bool, 'It is'), out('name', T.text, 'Biome')], eval: (x, nn, p, api) => {
  const b = SVC.biome(x, posOf(api.in('at')) || posOf(x.pos) || posOf(x.self));
  // (One of this mod's own biomes: '@its id'.)
  const want = api.prop('biome');
  return p === 'name' ? b : b === (typeof want === 'string' && want[0] === '@' ? `m:${x.mod.id}:${want.slice(1)}` : want);
} });
w('q.below', { title: 'Down a dungeon?', help: 'Whether someone (or self) is down in a dungeon.', in: [ref('who', T.ent, 'Who')], out: [out('out', T.bool, 'Below')], eval: (x, nn, p, api) => SVC.below(x, (isEnt(api.in('who')) && api.in('who')) || x.self) });
w('q.weather', { title: 'Weather', help: 'The weather where the player is: rain, snow, fog or clear; and whether it\'s wet.', out: [out('kind', T.text, 'Weather'), out('wet', T.bool, 'Raining or snowing')], eval: (x, nn, p) => {
  const k = SVC.weatherNow ? SVC.weatherNow(x) : 'clear';
  return p === 'wet' ? k === 'rain' || k === 'snow' : k;
} });
w('q.roofed', { title: 'Under a roof?', help: 'Whether there\'s something overhead at a place (or someone).', in: [ref('at', T.pos, 'At')], out: [out('out', T.bool, 'Roofed')], eval: (x, nn, p, api) => {
  const at = posOf(api.in('at')) || posOf(x.pos) || posOf(x.self);
  return !!at && !!SVC.roofed?.(x, at);
} });
w('q.var', { title: 'Variable', help: 'A value kept by a name (see Set variable).', in: [txt('name', 'Name', 'count')], props: [pick('scope', 'Kept', ['self', 'world', 'local', 'player'])], out: [out('out', T.any, 'Value')], eval: (x, nn, p, api) => SVC.getVar(x, api.prop('scope'), String(api.in('name'))) ?? 0 });

// ------------------------------------------------------------ maths
const m = (type, o) => def(type, { cat: 'Maths', color: C.math, ...o });
m('math.op', { title: 'Calculate', in: [n('a', 'A', 1), n('b', 'B', 1)], props: [pick('op', 'Do', ['+', '−', '×', '÷', 'min', 'max', 'mod', 'power'])], out: [out('out', T.num, 'Result')], eval: (x, nn, p, api) => {
  const a = num(api.in('a'));
  const b = num(api.in('b'));
  switch (api.prop('op')) {
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b ? a / b : 0;
    case 'min': return Math.min(a, b);
    case 'max': return Math.max(a, b);
    case 'mod': return b ? ((a % b) + b) % b : 0;
    case 'power': return a ** b;
    default: return a + b;
  }
} });
m('math.random', { title: 'Random number', help: 'Between two numbers (whole numbers if Whole).', in: [n('min', 'From', 0), n('max', 'To', 10)], props: [bool('whole', 'Whole', true)], out: [out('out', T.num, 'Number')], eval: (x, nn, p, api) => {
  const a = num(api.in('min'));
  const b = num(api.in('max'));
  return api.prop('whole') ? Math.floor(a + Math.random() * (Math.floor(b) - Math.ceil(a) + 1)) : a + Math.random() * (b - a);
} });
m('math.compare', { title: 'Compare', in: [n('a', 'A', 0), n('b', 'B', 0)], props: [pick('op', 'Is', ['>', '<', '=', '≥', '≤', '≠'])], out: [out('out', T.bool, 'True')], eval: (x, nn, p, api) => {
  const a = api.in('a');
  const b = api.in('b');
  const A = num(a, NaN);
  const Bv = num(b, NaN);
  const both = !Number.isNaN(A) && !Number.isNaN(Bv);
  switch (api.prop('op')) {
    case '<': return A < Bv;
    case '=': return both ? A === Bv : a === b;
    case '≥': return A >= Bv;
    case '≤': return A <= Bv;
    case '≠': return both ? A !== Bv : a !== b;
    default: return A > Bv;
  }
} });
m('math.logic', { title: 'And / Or / Not', in: [bool('a', 'A', true), bool('b', 'B', true)], props: [pick('op', 'Do', ['and', 'or', 'not A', 'either but not both'])], out: [out('out', T.bool, 'Result')], eval: (x, nn, p, api) => {
  const a = !!api.in('a');
  const b = !!api.in('b');
  const op = api.prop('op');
  return op === 'or' ? a || b : op === 'not A' ? !a : op === 'either but not both' ? a !== b : a && b;
} });
m('math.round', { title: 'Round', in: [n('a', 'Number', 0)], props: [pick('how', 'How', ['nearest', 'down', 'up'])], out: [out('out', T.num, 'Whole')], eval: (x, nn, p, api) => {
  const a = num(api.in('a'));
  const h = api.prop('how');
  return h === 'down' ? Math.floor(a) : h === 'up' ? Math.ceil(a) : Math.round(a);
} });
m('math.clamp', { title: 'Keep between', help: 'A number, kept no lower than one and no higher than another.', in: [n('a', 'Number', 0), n('min', 'At least', 0), n('max', 'At most', 10)], out: [out('out', T.num, 'Number')], eval: (x, nn, p, api) => Math.max(num(api.in('min')), Math.min(num(api.in('max'), 10), num(api.in('a')))) });
m('math.fn', { title: 'Maths of', help: 'One number made into another: its size (no sign), square root, the negative, sine and cosine (of degrees), its sign.', in: [n('a', 'Number', 0)], props: [pick('fn', 'Take', ['size', 'square root', 'negative', 'sine', 'cosine', 'sign'])], out: [out('out', T.num, 'Result')], eval: (x, nn, p, api) => {
  const a = num(api.in('a'));
  switch (api.prop('fn')) {
    case 'square root': return a > 0 ? Math.sqrt(a) : 0;
    case 'negative': return -a;
    case 'sine': return Math.sin((a * Math.PI) / 180);
    case 'cosine': return Math.cos((a * Math.PI) / 180);
    case 'sign': return Math.sign(a);
    default: return Math.abs(a);
  }
} });
m('math.text', { title: 'Words', help: 'About some words: how long, in capitals or small letters, whether they have something in them or start with it, as a number.', in: [txt('a', 'Words', 'Hello'), txt('b', 'Has / starts with', 'He', { show: { op: ['has in it', 'starts with'] } })],
  props: [pick('op', 'Take', ['length', 'capitals', 'small letters', 'has in it', 'starts with', 'as a number'])], out: [out('out', T.any, 'Result')], eval: (x, nn, p, api) => {
    const a = String(api.in('a') ?? '');
    const b = String(api.in('b') ?? '');
    switch (api.prop('op')) {
      case 'capitals': return a.toUpperCase();
      case 'small letters': return a.toLowerCase();
      case 'has in it': return a.toLowerCase().includes(b.toLowerCase());
      case 'starts with': return a.toLowerCase().startsWith(b.toLowerCase());
      case 'as a number': return num(a, 0);
      default: return a.length;
    }
  } });
m('math.pickword', { title: 'Pick a word', help: 'One of a list of words (put commas between them), at random.', in: [txt('list', 'Words', 'red, green, blue')], out: [out('out', T.text, 'Word')], eval: (x, nn, p, api) => {
  const L = String(api.in('list') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return L.length ? L[Math.floor(Math.random() * L.length)] : '';
} });
m('math.join', { title: 'Join text', in: [txt('a', 'A', ''), txt('b', 'B', '')], out: [out('out', T.text, 'Text')], eval: (x, nn, p, api) => `${api.in('a') ?? ''}${api.in('b') ?? ''}` });

// ============================================================ towns
// (Round 65) The towns of the world and their people: which town, what's
// known of it, changing it, someone new moving in; about someone of a
// town, and changing them (their trade, coins, mood, what they think of
// you).
const tw = (type, o) => def(type, { cat: 'Towns', color: C.town, ...o });
const NUMERIC_CHANGES = ['coffers', 'tax %', 'everyone\'s mood', 'wood', 'stone', 'a feast day', 'your standing', 'wanted', 'stock a shop'];
tw('q.townof', { title: 'Town', help: 'A town: the one someone (or a place) is in, the nearest (of a kind), or one by its name. Wire it into the other Town nodes, or use it as a place (its square).',
  in: [{ id: 'of', t: T.any, label: 'Of (someone, a place, a name)', def: null }],
  props: [pick('how', 'Which', ['the one it\'s in', 'the nearest', 'by its name']), pick('kind', 'Kind', ['any', 'village', 'town', 'city'], 'any', { show: { how: ['the nearest'] } })],
  out: [out('out', T.town, 'Town'), out('found', T.bool, 'Found'), out('name', T.text, 'Name')],
  eval: (x, nn, p, api) => {
    const t = SVC.townOf ? SVC.townOf(x, api.in('of'), api.prop('how'), api.prop('kind')) : null;
    return p === 'found' ? !!t : p === 'name' ? (t ? t.name : '') : t;
  } });
tw('q.towninfo', { title: 'About a town', help: 'What\'s known of a town: its name, kind, island, how many live there, its coffers, its tax, how happy its people are, its wood and stone, its guards, its realm and ruler, whether it\'s at war, whether you\'re wanted there, how well you stand there, its laws, its weather.',
  in: [ref('town', T.town, 'Town (or the one here)')], props: [pick('what', 'What', TOWN_FACTS)], out: [out('out', T.any, 'Value')],
  eval: (x, nn, p, api) => (SVC.townFact ? SVC.townFact(x, api.in('town'), api.prop('what')) : null) });
tw('act.towndo', { title: 'Change a town', help: 'Its coffers, its tax, its people\'s mood, its wood and stone, a law (on or off), its name, a feast day, how well players stand there, whether they\'re wanted, a line in its records (on its notice board), a shop stocked with something.',
  in: [F('in', 'Do'), ref('town', T.town, 'Town (or the one here)'), n('value', 'By', 10, { show: { what: NUMERIC_CHANGES } }), txt('text', 'Words', '', { show: { what: ['name', 'a line in its records'] } }), ref('item', T.item, 'Item', { show: { what: ['stock a shop'] } })],
  props: [pick('what', 'Change', TOWN_CHANGES), pick('how', 'How', [['add', 'add (take away if below 0)'], ['set', 'set to']], 'add', { show: { what: ['coffers', 'tax %', 'everyone\'s mood', 'wood', 'stone', 'wanted'] } }),
    pick('law', 'Law', LAW_LIST, 'curfew', { show: { what: ['a law'] } }), bool('on', 'In force', true, { show: { what: ['a law'] } }), pick('shop', 'Shop', SHOP_KINDS, 'shop', { show: { what: ['stock a shop'] } })],
  out: [F('then', 'Then'), F('no', 'Couldn\'t')],
  run: (x, nn, api) => (SVC.changeTown && SVC.changeTown(x, api.in('town'), api.prop('what'), { value: num(api.in('value'), 0), how: api.prop('how'), law: api.prop('law'), on: api.prop('on'), text: fillText(x, api.in('text')), item: api.in('item'), shop: api.prop('shop') }) ? 'then' : 'no'),
});
tw('act.newcomer', { title: 'Someone moves in', help: 'Someone new comes to live in a town (in a trade, if the town has work for one): a home, a schedule, a place in its life.',
  in: [F('in', 'Do'), ref('town', T.town, 'Town (or the one here)'), txt('first', 'First name (or any)', '')], props: [pick('job', 'Trade', [['any', 'Whatever it needs'], ...JOB_LIST], 'any')],
  out: [F('then', 'Then'), out('who', T.ent, 'Who')],
  run: (x, nn, api) => {
    x.locals[`${nn.id}.who`] = SVC.newcomer ? SVC.newcomer(x, api.in('town'), { first: fillText(x, api.in('first')), job: api.prop('job') }) : null;
    return 'then';
  } });
tw('flow.people', { title: 'For each of its people', help: 'For each person of a town (of a trade, if you like): runs Each with them as Who. Those about now are the town\'s people walking it; a town far off, their records.',
  in: [F('in', 'Do'), ref('town', T.town, 'Town (or the one here)'), n('max', 'At most', 50, { min: 1, max: 500 })], props: [pick('job', 'Trade', [['anyone', 'Anyone'], ...JOB_LIST], 'anyone')],
  out: [F('each', 'Each'), F('done', 'Done'), out('who', T.ent, 'Who'), out('n', T.num, 'How many')],
  run: (x, nn, api) => {
    const list = SVC.peopleOf ? SVC.peopleOf(x, api.in('town'), api.prop('job')) : [];
    x.locals[`${nn.id}.n`] = list.length;
    for (const e of list.slice(0, Math.max(1, num(api.in('max'), 50)))) {
      x.locals[`${nn.id}.who`] = e;
      api.fire('each');
    }
    return 'done';
  } });
tw('q.person', { title: 'About someone', help: 'About someone of a town: their name, trade, age, mood, coins, what they think of you, their traits, their town, their home and their work (places), whether they\'re alive, married, how many children.',
  in: [ref('who', T.ent, 'Who (or the target)')], props: [pick('what', 'What', PERSON_FACTS)], out: [out('out', T.any, 'Value')],
  eval: (x, nn, p, api) => (SVC.personFact ? SVC.personFact(x, (isEnt(api.in('who')) && api.in('who')) || api.in('who') || x.target, api.prop('what')) : null) });
tw('act.persondo', { title: 'Change someone', help: 'Someone of a town: a new trade (with the tools and clothes of it), coins, their mood, what they think of you, a trait added or taken, a new first name.',
  in: [F('in', 'Do'), ref('who', T.ent, 'Who (or the target)'), n('value', 'By', 10, { show: { what: ['coins', 'mood', 'what they think of you'] } }), txt('text', 'Words', '', { show: { what: ['add a trait', 'take a trait', 'first name'] } })],
  props: [pick('what', 'Change', PERSON_CHANGES), pick('how', 'How', [['add', 'add'], ['set', 'set to']], 'add', { show: { what: ['coins', 'mood'] } }), pick('job', 'Trade', JOB_LIST, 'farmer', { show: { what: ['trade'] } })],
  out: [F('then', 'Then'), F('no', 'Couldn\'t')],
  run: (x, nn, api) => (SVC.changePerson && SVC.changePerson(x, api.in('who') || x.target, api.prop('what'), { value: num(api.in('value'), 0), how: api.prop('how'), job: api.prop('job'), text: fillText(x, api.in('text')) }) ? 'then' : 'no'),
});

// ============================================================ other worlds
// (Round 65) Another of your world maps: a world of its own, made the
// first time someone goes, kept after (see Game.requestCross).
tw('act.cross', { cat: 'World', color: C.q, title: 'Cross to another world', help: 'Sends a player (with everything they are and carry, and whoever\'s at their heel) to another of your world maps: a world of its own, made the first time anyone goes and kept after; or back to the world it all began in. A creature sent alone goes on ahead, there when someone next arrives. (Not while others are playing in the world.)',
  in: [F('in', 'Do'), ref('who', T.ent, 'Who (or the player)'), ref('at', T.pos, 'Arrive at (or where they were)', { adv: true })],
  props: [pick('to', 'To', [['map', 'one of your world maps'], ['first', 'the world it began as']], 'map'), { id: 'map', t: T.world, label: 'World map', def: null, show: { to: ['map'] } }],
  out: [F('then', 'Then')],
  run: (x, nn, api) => {
    const e = who(x, api, 'who') || x.player || x.target;
    if (e && SVC.cross) SVC.cross(x, e, api.prop('to') === 'first' ? null : api.prop('map'), posOf(api.in('at')));
    return 'then';
  } });
w('q.whichworld', { title: 'Which world', help: 'Which of the world maps this world was made from (the world it all began in, or one of yours, crossed into).', props: [{ id: 'map', t: T.world, label: 'Is it', def: null }],
  out: [out('name', T.text, 'Map'), out('first', T.bool, 'The first world'), out('is', T.bool, 'It is')],
  eval: (x, nn, p, api) => {
    const m = SVC.worldMap ? SVC.worldMap(x) : null;
    if (p === 'first') return !m;
    if (p === 'is') return !!m && m.mod === x.mod.id && m.id === api.prop('map');
    return m ? m.name || m.id : 'the first world';
  } });

// ============================================================ finding out
// (Round 65) What there is to know about anyone or anything: one node per
// kind of thing, a choice of what.
const inf = (type, o) => def(type, { cat: 'Find out', color: C.info, ...o });
export const ENT_FACTS = ['name', 'kind', 'place', 'health', 'most health', 'health %', 'speed', 'damage', 'facing', 'place ahead', 'block under', 'biome', 'town', 'moving', 'hostile', 'its foe', 'its home', 'what it\'s doing', 'held item', 'is a player', 'is a person', 'is a boss', 'flies', 'in water', 'burning', 'conditions', 'tier'];
inf('q.entinfo', { title: 'About someone', help: 'Anything about someone or something alive: name, kind, where, health (and most, and as a percentage), speed, damage, which way it faces and the place ahead, the block under it, its biome and town, whether it\'s moving, hostile, a player, a person, a boss, flying, in water, burning; its foe, its home, what it\'s doing, what it holds, its conditions, a master\'s tier.',
  in: [ref('who', T.ent, 'Who (or self)')], props: [pick('what', 'What', ENT_FACTS)], out: [out('out', T.any, 'Value')],
  eval: (x, nn, p, api) => (SVC.entFact ? SVC.entFact(x, (isEnt(api.in('who')) && api.in('who')) || x.self || x.target, api.prop('what')) : null) });
export const PLAYER_FACTS = ['name', 'coins', 'health', 'most health', 'stamina', 'held item', 'selected slot', 'armour %', 'items carried', 'empty slots', 'traits', 'came as', 'fame', 'days played', 'riding', 'sleeping', 'in a dungeon', 'wanted here'];
inf('q.playerinfo', { title: 'About a player', help: 'About a player: their name, coins, health, stamina, what they hold, their armour, how much they carry and how much room they have, their traits and where they came from, their fame, days played, whether they\'re riding, asleep, down a dungeon, wanted in the town they\'re in.',
  in: [ref('who', T.ent, 'Who (or the player)')], props: [pick('what', 'What', PLAYER_FACTS)], out: [out('out', T.any, 'Value')],
  eval: (x, nn, p, api) => (SVC.playerFact ? SVC.playerFact(x, (isEnt(api.in('who')) && api.in('who')) || x.player || x.target, api.prop('what')) : null) });
export const ITEM_FACTS = ['name', 'kind', 'value', 'damage', 'armour %', 'stack', 'heals', 'worn on', 'ranged', 'a block', 'food', 'stars'];
inf('q.iteminfo', { title: 'About an item', help: 'About an item (yours or the game\'s): its name, kind, value, damage, armour, how many stack, how much it heals, where it\'s worn, whether it\'s ranged, a block, food; its stars.',
  in: [ref('item', T.item, 'Item')], props: [pick('what', 'What', ITEM_FACTS)], out: [out('out', T.any, 'Value')],
  eval: (x, nn, p, api) => (SVC.itemFact ? SVC.itemFact(x, api.in('item'), api.prop('what')) : null) });
export const BLOCK_FACTS = ['name', 'its key', 'air', 'solid', 'liquid', 'hardness', 'light', 'tool', 'see-through', 'one of yours'];
inf('q.blockinfo', { title: 'About a block', help: 'About the block at a place: its name and key, whether it\'s air, solid, a liquid, see-through, one of this mod\'s; how hard, how bright, the tool for it.',
  in: [ref('at', T.pos, 'At (or here)')], props: [pick('what', 'What', BLOCK_FACTS)], out: [out('out', T.any, 'Value')],
  eval: (x, nn, p, api) => (SVC.blockFact ? SVC.blockFact(x, posOf(api.in('at')) || posOf(x.pos) || posOf(x.self), api.prop('what')) : null) });
inf('q.abilities', { title: 'Its abilities', help: 'A creature\'s abilities (its Ability nodes): how many, which are ready, the name of one ready now (the one it\'d likely use), and how long till one (by its name) is ready again.',
  in: [ref('who', T.ent, 'Whose (or self)'), txt('name', 'Ability (its name)', '')],
  out: [out('n', T.num, 'How many'), out('ready', T.num, 'Ready now'), out('next', T.text, 'One ready'), out('names', T.text, 'Their names'), out('left', T.num, 'Seconds till ready'), out('casting', T.bool, 'Winding one up')],
  eval: (x, nn, p, api) => {
    const a = SVC.abilities ? SVC.abilities(x, (isEnt(api.in('who')) && api.in('who')) || x.self, fillText(x, api.in('name'))) : null;
    if (!a) return p === 'next' || p === 'names' ? '' : p === 'casting' ? false : 0;
    return a[p];
  } });
inf('q.direction', { title: 'Direction', help: 'Which way one place (or someone) is from another: as a compass word, an angle, and the steps east and south.',
  in: [ref('a', T.pos, 'From (or self)'), ref('b', T.pos, 'To (or the target)')],
  out: [out('word', T.text, 'Way'), out('deg', T.num, 'Angle (°)'), out('dx', T.num, 'East'), out('dz', T.num, 'South')],
  eval: (x, nn, p, api) => {
    const a = posOf(api.in('a')) || posOf(x.self) || posOf(x.pos);
    const b = posOf(api.in('b')) || posOf(x.target);
    if (!a || !b) return p === 'word' ? '' : 0;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (p === 'dx') return dx;
    if (p === 'dz') return dz;
    const deg = ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
    if (p === 'deg') return Math.round(deg);
    return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.round(deg / 45) % 8];
  } });
inf('q.slot', { title: 'In a pack', help: 'What\'s in a slot of someone\'s pack (1 to 36), and how many; where in it an item is first found.',
  in: [ref('who', T.ent, 'Whose (or the player)'), n('slot', 'Slot', 1, { min: 1, max: 36 }), ref('item', T.item, 'Find this item', { adv: true })],
  out: [out('key', T.item, 'Item'), out('n', T.num, 'How many'), out('at', T.num, 'Found in slot (0: not)')],
  eval: (x, nn, p, api) => {
    const e = (isEnt(api.in('who')) && api.in('who')) || x.player || x.target;
    const inv = e && e.inv;
    if (!inv) return p === 'key' ? null : 0;
    if (p === 'at') {
      const k = SVC.itemKey ? SVC.itemKey(x, api.in('item')) : null;
      const i = k ? inv.findIndex((q) => q && q.item === k) : -1;
      return i + 1;
    }
    const s = inv[Math.max(0, Math.min(inv.length - 1, num(api.in('slot'), 1) - 1))];
    return p === 'key' ? (s ? s.item : null) : s ? s.count : 0;
  } });
inf('q.structinfo', { title: 'One of your structures', help: 'Where one of your structures stands in the world (the nearest of them), how many there are, and whether someone\'s there now.',
  in: [ref('structure', T.structure, 'Structure'), ref('at', T.pos, 'Nearest to (or here)'), n('r', 'Someone within', 8, { min: 1, max: 60, adv: true })],
  out: [out('pos', T.pos, 'Where'), out('n', T.num, 'How many'), out('dist', T.num, 'How far'), out('busy', T.bool, 'Someone there')],
  eval: (x, nn, p, api) => {
    const s = SVC.structInfo ? SVC.structInfo(x, api.in('structure'), posOf(api.in('at')) || posOf(x.pos) || posOf(x.self), num(api.in('r'), 8)) : null;
    if (!s) return p === 'pos' ? null : p === 'busy' ? false : 0;
    return s[p];
  } });
inf('q.random', { title: 'Someone at random', help: 'Someone near a place, picked at random (players, foes, creatures, or anyone).',
  in: [ref('at', T.pos, 'Around'), n('r', 'Within', 10, { min: 1, max: 60 })], props: [pick('which', 'Who', ['everyone', 'players', 'foes of self', 'creatures']), bool('notSelf', 'Not itself', true)],
  out: [out('out', T.ent, 'Who'), out('n', T.num, 'Out of')],
  eval: (x, nn, p, api) => {
    const at = posOf(api.in('at')) || posOf(x.pos) || posOf(x.self);
    const list = at ? SVC.near(x, at, num(api.in('r'), 10), api.prop('which')).filter((e) => !(api.prop('notSelf') !== false && e === x.self)) : [];
    if (p === 'n') return list.length;
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  } });

// What a template makes, for lists (the Workshop's "New" menu and so on).
export const TEMPLATE_INFO = {
  'tpl.block': { group: 'World', icon: 'cube', blurb: 'A block to place and break: stone, glowing crystal, a trapdoor.' },
  'tpl.food': { group: 'Items', icon: 'meat', blurb: 'Food, drink or a potion: heals and can do more.' },
  'tpl.weapon': { group: 'Items', icon: 'sword', blurb: 'A blade, a bow, a staff: with a style and on-hit powers.' },
  'tpl.tool': { group: 'Items', icon: 'pick', blurb: 'A pick, axe or shovel that breaks blocks.' },
  'tpl.armor': { group: 'Items', icon: 'shield', blurb: 'A helm, mail, boots or a shield.' },
  'tpl.material': { group: 'Items', icon: 'gem', blurb: 'An ore, a hide, a trinket: to carry, sell and craft with.' },
  'tpl.animal': { group: 'Creatures', icon: 'paw', blurb: 'A beast that wanders the wild.' },
  'tpl.hostile': { group: 'Creatures', icon: 'skull', blurb: 'A monster that hunts you.' },
  'tpl.npc': { group: 'Creatures', icon: 'person', blurb: 'Someone to talk to: dialogue, trades, quests.' },
  'tpl.boss': { group: 'Creatures', icon: 'crown', blurb: 'A master with phases, abilities and a health bar.' },
  'tpl.effect': { group: 'Logic', icon: 'sparkle', blurb: 'A blessing or curse that lasts a while.' },
  'tpl.event': { group: 'Logic', icon: 'bolt', blurb: 'Something that happens in the world.' },
  'tpl.recipe': { group: 'Logic', icon: 'anvil', blurb: 'A crafting recipe.' },
  'tpl.projectile': { group: 'Logic', icon: 'arrow', blurb: 'An arrow, orb or bolt for Shoot.' },
};

// (Round 62) The Story tool's nodes (in the same registry; marked story).
import './storynodes.js';
