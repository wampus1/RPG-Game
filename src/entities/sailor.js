// A hand aboard one of the great ships (round 68: see game/ships3d.js):
// a sailor, a gunner, a marine, her captain. They live aboard: working
// her deck (at the wheel, hauling on the sheets, at the guns, keeping a
// lookout), going below and coming up again, and fighting for her. What
// they do is the ship's to say (see shipcrew.js); here's only who they are.
import { Entity } from './entity.js';

export const SAILOR_ROLES = {
  captain: { name: 'Captain', hp: 30, dmg: 4 },
  mate: { name: 'Mate', hp: 24, dmg: 3 },
  sailor: { name: 'Sailor', hp: 18, dmg: 2 },
  gunner: { name: 'Gunner', hp: 20, dmg: 3 },
  marine: { name: 'Marine', hp: 28, dmg: 5 },
  merchant: { name: 'Merchant', hp: 14, dmg: 1 },
  passenger: { name: 'Passenger', hp: 14, dmg: 1 },
  // (Round 78: a pirate crew's; see game/pirates.js.)
  pirate: { name: 'Pirate', hp: 20, dmg: 3 },
  pirate_archer: { name: 'Pirate Archer', hp: 16, dmg: 2 },
};

export class Sailor extends Entity {
  // `rec`: { name, look, role, civ, ship, style }.
  constructor(game, rec, x = 0, y = 0, z = 0) {
    super(game, x, y, z);
    this.kind = 'sailor';
    this.rec = { name: rec.name, role: rec.role || 'sailor', civ: rec.civ ?? null, style: rec.style || null, age: 'adult', traits: rec.traits || [], mood: rec.mood ?? 0.6 };
    // (Round 131) Named as anyone is (their name was an object: "slain by
    // [object]"), with their berth for a title.
    const nm = rec.name;
    this.name = nm && typeof nm === 'object' ? `${nm.first || ''} ${nm.last || ''}`.trim() || 'A sailor' : String(nm || 'A sailor');
    this.first = nm && typeof nm === 'object' ? nm.first || this.name : this.name.split(' ')[0];
    this.look = rec.look;
    this.role = rec.role || 'sailor';
    const R = SAILOR_ROLES[this.role] || SAILOR_ROLES.sailor;
    this.maxHp = rec.maxHp || R.hp;
    this.hp = rec.hp ?? this.maxHp;
    this.dmg = R.dmg;
    this.civ = rec.civ ?? null;
    this.shipId = rec.ship ?? null;
    this.task = null;
    this.attackCd = 0;
    this.solid = true;
  }

  // Their berth aboard, as a person's trade is (see NPC.title).
  get title() {
    return (SAILOR_ROLES[this.role] || SAILOR_ROLES.sailor).name;
  }

  // What's in their hand (a gunner's rammer, a marine's musket's no
  // part of the game: a cutlass).
  heldItem() {
    if (this.role === 'pirate_archer') return 'bow';
    return this.role === 'marine' || this.role === 'pirate' || this.angry ? 'sabre' : null;
  }

  offhandItem() {
    return null;
  }

  update(dt) {
    this.updateBase(dt);
    if (this.attackCd > 0) this.attackCd -= dt;
  }

  // Struck: the whole crew turns on whoever did it (see crewHurt).
  onHurt(source) {
    if (source && source !== this && this.game.shipCrewHurt) this.game.shipCrewHurt(this, source);
  }
}
