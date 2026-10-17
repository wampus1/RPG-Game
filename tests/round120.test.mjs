// Round 120: an old place's tier on the map as a numeral on its icon's
// corner (I, II or III, in the tier's colour); nothing solid just inside a
// master's hall's doorway; and the version's step.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeGame } from './helpers.mjs';
import { buildFloor, FY } from '../src/world/dungeongen.js';
import { BLOCKS } from '../src/world/blocks.js';
import { TIER_BADGE } from '../src/ui/worldmap.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

test('a tier on the map: its numeral on the icon\'s corner, each tier its own colour', () => {
  assert.equal(new Set(TIER_BADGE.slice(1)).size, 3, 'three colours');
  const m = fs.readFileSync(new URL('../src/ui/worldmap.js', import.meta.url), 'utf8');
  assert.ok(/for \(let i = 0; i < tier; i\+\+\) ctx\.fillRect\(nx \+ \(1 \+ i \* 2\) \* u, ny, u, nh\);/.test(m), 'a stroke for each');
  assert.ok(!/a small shield of the tier's metal/.test(m), 'no shield any more');
});

test('nothing solid in the way just inside a master\'s hall', () => {
  const game = makeGame(12345, { wg: 2 });
  let halls = 0;
  for (const ty of new Set(game.sim.dungeons.all.map((d) => d.type))) {
    const base = game.sim.dungeons.all.find((d) => d.type === ty);
    for (let s = 0; s < 4; s++) {
      const rec = { ...base, seed: base.seed + s * 97, floors: {} };
      const f = buildFloor(rec, (rec.depth || 3) - 1);
      const g = f.bossGate;
      if (!g) continue;
      halls++;
      const get = (x, y, z) => {
        const r = f.regions.get(Math.floor(x / 64) * 4096 + Math.floor(z / 36));
        return r ? r.get(x % 64, y, z % 36) : 0;
      };
      for (let k = 1; k <= 3; k++) {
        for (let w = -1; w <= 1; w++) {
          const x = g.x - g.ox * k + (g.oz ? w : 0);
          const z = g.z - g.oz * k + (g.ox ? w : 0);
          const b = BLOCKS[get(x, FY + 1, z)];
          assert.ok(!(b && b.solid && !b.interact), `${ty} ${s}: ${b && b.name} ${k} paces in`);
        }
      }
    }
  }
  assert.ok(halls > 20, `${halls} halls looked at`);
});

test('version 1.20.0, and the step to it', () => {
  assert.ok(compareVersions(GAME_VERSION, '1.20.0') >= 0);
  const steps = stepsFor('1.19.0').filter((s) => s.to === '1.20.0');
  assert.equal(steps.length, 1);
  const log = [];
  steps[0].data({}, log);
  assert.ok(/tier/i.test(log[0]) && /boss/i.test(log[0]));
});
