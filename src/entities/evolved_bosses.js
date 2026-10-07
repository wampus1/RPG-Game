// (Round 71) The four evolved masters, together (see evolved.js): their
// kinds, for creature.js.
import { ALCHEMIST_BOSSES } from './evolved_alchemist.js';
import { RIFT_BOSSES } from './evolved_rift.js';
import { HERO_BOSSES } from './evolved_hero.js';
import { WORM_BOSSES } from './evolved_worm.js';

export const EVOLVED_BOSSES = { ...ALCHEMIST_BOSSES, ...RIFT_BOSSES, ...HERO_BOSSES, ...WORM_BOSSES };
