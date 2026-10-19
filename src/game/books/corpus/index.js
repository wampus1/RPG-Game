// (Round 126) The books' library of sentences, every kind of book's
// together (see write.js).
import * as annals from './annals.js';
import * as realms from './realms.js';
import * as roads from './roads.js';
import * as table from './table.js';
import * as deeps from './deeps.js';
import * as creed from './creed.js';

const PARTS = [annals, realms, roads, table, deeps, creed];
export const POOLS = Object.assign({}, ...PARTS.map((p) => p.POOLS));
export const FLOWS = Object.assign({}, ...PARTS.map((p) => p.FLOWS));
