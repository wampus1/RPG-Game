// The quick set (`npm test`, round 78): the essentials (tests/quick/) and
// the latest round's own tests, side by side, in about a minute. Every
// round's tests, the whole slow lot, are `npm run test:full`. Pass more
// test files (or rounds, as "77") to run them too.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tests = path.join(root, 'tests');
const quick = fs.readdirSync(path.join(tests, 'quick')).filter((f) => f.endsWith('.test.mjs')).map((f) => path.join('tests', 'quick', f));
const rounds = fs.readdirSync(tests).map((f) => /^round(\d+)\.test\.mjs$/.exec(f)).filter(Boolean).sort((a, b) => b[1] - a[1]);
const latest = rounds.length ? [path.join('tests', rounds[0][0])] : [];
const extra = process.argv.slice(2).map((a) => (/^\d+$/.test(a) ? path.join('tests', `round${a}.test.mjs`) : a));
const files = [...new Set([...quick, ...latest, ...extra])];

const t0 = Date.now();
console.log(`Quick tests: ${files.join(', ')}`);
const child = spawn(process.execPath, ['--test', `--test-concurrency=${Math.max(2, os.cpus().length)}`, ...files], { cwd: root, stdio: 'inherit' });
child.on('exit', (code) => {
  console.log(`\nQuick tests ${code === 0 ? 'passed' : 'FAILED'} in ${((Date.now() - t0) / 1000).toFixed(1)}s. (Everything: npm run test:full)`);
  process.exit(code ?? 1);
});
