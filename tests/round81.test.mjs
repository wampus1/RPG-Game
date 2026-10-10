// Round 81: the essentials of the desktop app, where it touches the game:
// its data folder (everything kept as files, worlds gzipped, the slot list
// beside them); the page's storage over it; worlds carried over from the
// browser version (from its server's folder, or a file it saves), each
// into its slot or a free one; finding the browser version's folder; the
// server it runs (the next port if one's taken); the seed asked in the
// game; the settings' buttons; and the version.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import net from 'node:net';
import { DataFolder, safeName, blobPath } from '../electron/data.js';
import { findOldStores, readOldStore, readExportFile } from '../electron/carry.js';
import { FolderStorage, appDb } from '../src/util/appstore.js';
import { SaveStore } from '../src/game/saves.js';
import { serverStoreBundle, importBundle, exportBundle, reportLines, bundleSummary, worldModRefs, CARRY_KEY } from '../src/game/carry.js';
import { startServer } from '../tools/server.mjs';
import { SeedWindow, SettingsWindow } from '../src/ui/windows.js';
import { DEFAULTS, SETTING_ACTIONS } from '../src/game/settings.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { stepsFor } from '../src/game/migrate.js';

const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `tessera-r81-${n}-`));

// Browser storage, in memory.
class Mem {
  constructor(o = {}) {
    this.m = new Map(Object.entries(o));
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
  removeItem(k) {
    this.m.delete(k);
  }
  key(i) {
    return [...this.m.keys()][i] ?? null;
  }
  get length() {
    return this.m.size;
  }
}

// What the app gives the page (see electron/preload.cjs), straight onto a
// data folder.
const bridge = (data) => ({
  desktop: true,
  kvAll: () => data.all(),
  kvSet: (k, v) => data.set(k, v),
  kvDel: (k) => data.del(k),
  dbGet: (k) => data.getBlob(k),
  dbPut: (k, t) => data.putBlob(k, t),
  dbDel: (k) => data.delBlob(k),
});

const meta = (o) => ({ name: 'Ada', day: 3, minute: 600, seed: 1, place: 'Brindle', savedAt: 1000, gv: '0.80.0', ...o });

test('the data folder: the slot list beside the worlds, each world gzipped, the rest in storage.json, all there again next time', async () => {
  const dir = tmp('data');
  const d = new DataFolder(dir);
  d.set('tessera-saves-v2', JSON.stringify({ 1: meta() }));
  d.set('tessera-settings', '{"music":3}');
  d.flush();
  await d.putBlob('tessera-save-1', '{"seed":1,"big":"' + 'x'.repeat(5000) + '"}');
  await d.putBlob('mod:abc', '{"id":"abc"}');
  await d.putBlob('modpack:h1', '{"hash":"h1"}');
  assert.ok(fs.existsSync(path.join(dir, 'saves', 'index.json')));
  const gz = fs.readFileSync(path.join(dir, 'saves', '1.json.gz'));
  assert.equal(gz[0], 0x1f, 'gzipped');
  assert.ok(gz.length < 1000);
  assert.ok(fs.existsSync(path.join(dir, 'mods', 'abc.json.gz')) && fs.existsSync(path.join(dir, 'mods', 'packs', 'h1.json.gz')));
  assert.ok(!JSON.parse(fs.readFileSync(path.join(dir, 'storage.json'), 'utf8'))['tessera-saves-v2'], 'the slot list only beside the saves');
  const again = new DataFolder(dir);
  assert.deepEqual(JSON.parse(again.get('tessera-saves-v2')), { 1: meta() });
  assert.equal(again.get('tessera-settings'), '{"music":3}');
  assert.match(await again.getBlob('tessera-save-1'), /^\{"seed":1/);
  await again.delBlob('tessera-save-1');
  assert.equal(await again.getBlob('tessera-save-1'), null);
  // A spoilt storage.json: its .bak, and the spoilt one put aside.
  fs.writeFileSync(path.join(dir, 'storage.json'), '{not json');
  fs.writeFileSync(path.join(dir, 'storage.json.bak'), '{"tessera-settings":"{}"}');
  assert.equal(new DataFolder(dir).get('tessera-settings'), '{}');
  assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('storage.json.spoilt-')));
  // Names Windows can keep.
  assert.equal(safeName('1~map:a'), '1~map%3Aa');
  assert.equal(safeName('aux'), '_aux');
  assert.equal(blobPath('tessera-save-mp2'), path.join('saves', 'mp2.json.gz'));
});

test('the page\'s storage over the folder, and the saves through it: written there, read back', async () => {
  const dir = tmp('page');
  const data = new DataFolder(dir);
  const app = bridge(data);
  const st = new FolderStorage(app);
  st.setItem('tessera-keybinds', '{"up":"KeyI"}');
  assert.equal(st.getItem('tessera-keybinds'), '{"up":"KeyI"}');
  assert.equal(st.length, 1);
  assert.equal(st.key(0), 'tessera-keybinds');
  st.removeItem('tessera-keybinds');
  assert.equal(data.get('tessera-keybinds'), null);
  const store = new SaveStore(st, appDb(app));
  await store.putText('2', '{"seed":5,"day":9}', meta({ seed: 5, day: 9 }));
  assert.ok(fs.existsSync(path.join(dir, 'saves', '2.json.gz')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'saves', 'index.json'), 'utf8'))[2].day, 9);
  assert.deepEqual(await store.load('2'), { seed: 5, day: 9 });
  assert.equal(store.list().find((s) => s.id === '2').meta.day, 9);
});

test('worlds from the browser version\'s server folder: into their slots, or a free one when it\'s taken; the same world kept; the account; the worlds crossed into with them', async () => {
  const b = serverStoreBundle({
    index: JSON.stringify({ 1: meta({ seed: 11, savedAt: 500 }), 2: meta({ seed: 22, name: 'Bo' }), '2~west': meta({ seed: 22 }), 3: { gone: 9 }, mp1: meta({ seed: 33, world: 'Our world' }) }),
    account: JSON.stringify({ id: 'acc1', name: 'Ada', at: 50 }),
    saves: { 1: '{"seed":11}', 2: '{"seed":22}', '2~west': '{"seed":22,"map":"west"}', mp1: '{"seed":33}' },
  }, '/old/saves/local');
  const s = bundleSummary(b);
  assert.deepEqual(s.worlds.map((w) => w.id).sort(), ['1', '2', 'mp1']);
  assert.equal(s.hosted, 1);
  assert.equal(s.account, 'Ada');
  // Here already: slot 1 the same world, newer; slot 2 another world.
  const st = new Mem();
  const store = new SaveStore(st, null);
  await store.putText('1', '{"seed":11,"newer":true}', meta({ seed: 11, savedAt: 900 }));
  await store.putText('2', '{"seed":77}', meta({ seed: 77, name: 'Cy' }));
  const r = await importBundle(b, { storage: st, store });
  const by = Object.fromEntries(r.worlds.map((w) => [w.id, w]));
  assert.equal(by[1].status, 'had');
  assert.equal(by[2].status, 'moved');
  assert.equal(by[2].to, '3');
  assert.equal(by.mp1.status, 'added');
  assert.deepEqual(await store.load('1'), { seed: 11, newer: true }, 'the newer one here kept');
  assert.deepEqual(await store.load('2'), { seed: 77 }, 'the other world here left be');
  assert.deepEqual(await store.load('3'), { seed: 22 });
  assert.deepEqual(await store.load('3~west'), { seed: 22, map: 'west' }, 'the world crossed into went with it');
  assert.equal(store.index()[3].name, 'Bo');
  assert.equal(JSON.parse(st.getItem('tessera-account-v1')).id, 'acc1');
  assert.equal(r.account, 'taken');
  assert.equal(JSON.parse(st.getItem(CARRY_KEY)).state, 'done');
  assert.ok(reportLines(r).some((l) => /slot 3/.test(l)));
  // Brought in again: nothing new.
  const r2 = await importBundle(b, { storage: st, store });
  assert.ok(r2.worlds.every((w) => w.status === 'had'));
});

test('a file from the browser version: everything, mods too, round the way; the mods a world needs, told', async () => {
  // In the browser: a world, settings, a mod.
  const st = new Mem({ 'tessera-settings': '{"music":2}', 'tessera-feats-v1': '{"first":5}', 'tessera-mods-v1': '{"m1":{"id":"m1","name":"Red","updated":3}}', 'tessera-modpacks-v1': '{"hp":{"hash":"hp"}}' });
  const store = new SaveStore(st, null);
  const text = '{"seed":4,"mods":{"refs":[{"id":"m1","hash":"hp","name":"Red","version":1,"author":"","color":"#f00"}],"blockIds":{}}}';
  await store.putText('1', text, meta({ seed: 4 }));
  const raw = { 'mod:m1': '{"mod":1}', 'modpack:hp': '{"pack":1}' };
  const lib = { getRaw: async (k) => raw[k] || null };
  assert.equal(worldModRefs(text)[0].hash, 'hp');
  const b = await exportBundle({ storage: st, store, modLib: lib, from: 'localhost:8080' });
  // Saved, gzipped, read by the app.
  const f = path.join(tmp('file'), 'w.tessera');
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(b)));
  const got = readExportFile(f);
  // Into the app (its own feats already: both kept).
  const st2 = new Mem({ 'tessera-feats-v1': '{"other":7,"first":9}' });
  const store2 = new SaveStore(st2, null);
  const put = {};
  const r = await importBundle(got, { storage: st2, store: store2, modLib: { putRaw: async (k, t) => (put[k] = t) } });
  assert.equal(await store2.rawText('1'), text);
  assert.equal(st2.getItem('tessera-settings'), '{"music":2}');
  assert.deepEqual(JSON.parse(st2.getItem('tessera-feats-v1')), { other: 7, first: 5 });
  assert.deepEqual(put, raw);
  assert.equal(r.mods, 1);
  assert.deepEqual(r.needMods, [], 'its mod came too');
  // From the server's folder instead (no mods there): the mod it needs, told.
  const st3 = new Mem();
  const r3 = await importBundle(serverStoreBundle({ index: JSON.stringify({ 1: meta({ seed: 4 }) }), saves: { 1: text } }), { storage: st3, store: new SaveStore(st3, null) });
  assert.deepEqual(r3.needMods, ['Red']);
  // Not one of these.
  const bad = path.join(tmp('bad'), 'x.json');
  fs.writeFileSync(bad, '{"hello":1}');
  assert.throws(() => readExportFile(bad), /isn't a file of Tessera worlds/);
});

test('the browser version\'s folder, found where it\'s likely to be, or shown', () => {
  const home = tmp('home');
  const drawer = path.join(home, 'Documents', 'RPG-Game', 'saves', 'local');
  fs.mkdirSync(drawer, { recursive: true });
  fs.writeFileSync(path.join(drawer, 'saves-index.txt'), JSON.stringify({ 1: meta(), 2: { gone: 5 } }));
  fs.writeFileSync(path.join(drawer, 'save-1.txt'), '{"seed":1}');
  fs.writeFileSync(path.join(drawer, 'account.txt'), '{"id":"a","name":"Ada"}');
  fs.mkdirSync(path.join(home, 'Documents', 'node_modules', 'x', 'saves', 'local'), { recursive: true });
  const found = findOldStores({ home });
  assert.deepEqual(found, [drawer]);
  // Shown the game folder, its saves folder, or the drawer: all the same.
  for (const d of [path.join(home, 'Documents', 'RPG-Game'), path.join(home, 'Documents', 'RPG-Game', 'saves'), drawer]) {
    const b = readOldStore(d);
    assert.deepEqual(Object.keys(b.blobs), ['tessera-save-1']);
    assert.ok(b.kv['tessera-account-v1']);
  }
  assert.throws(() => readOldStore(home), /No worlds from the browser version there/);
});

test('the server it runs: on the next port when one\'s taken; this machine\'s own keeping not there in the app', async () => {
  const hold = net.createServer();
  await new Promise((r) => hold.listen(0, r));
  const taken = hold.address().port;
  const srv = await startServer({ root: path.resolve('.'), port: taken, tries: 4, dataDir: tmp('srv'), localSaves: false, lan: false, log: () => {} });
  try {
    assert.notEqual(srv.port, taken);
    assert.equal(srv.relay.port, srv.port);
    const page = await globalThis.fetch(`http://127.0.0.1:${srv.port}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Tessera<\/title>/);
    assert.equal((await globalThis.fetch(`http://127.0.0.1:${srv.port}/api/store`)).status, 404);
  } finally {
    await srv.close();
    hold.close();
  }
});

test('a seed typed in the game; the settings\' buttons, each where it belongs', () => {
  const ui = { mouseCell: { x: -1, y: -1 }, time: 0, hooks: {}, close() {}, audio: null };
  let got = null;
  const w = new SeedWindow(ui, (t) => (got = t));
  for (const key of ['m', 'y', ' ', 'w', 'o', 'r', 'l', 'd']) w.onKey({ code: 'KeyX', key });
  w.onKey({ code: 'Backspace' });
  w.onKey({ code: 'Enter' });
  assert.equal(got, 'my worl');
  const rows = (desktop) => {
    const s = new SettingsWindow({ ...ui, hooks: { desktop, settingAction: () => {} } }, { ...DEFAULTS });
    return s.lines().filter((l) => l.act2).map((l) => l.act2.act);
  };
  assert.deepEqual(rows(true), ['savesFolder', 'carry']);
  assert.deepEqual(rows(false), ['export']);
  assert.ok(SETTING_ACTIONS.every((a) => a.tab && a.label && a.btn));
});

test('version 0.81.0, with its step', () => {
  assert.ok(compareVersions(GAME_VERSION, '0.81.0') >= 0);
  assert.ok(stepsFor('0.80.0').some((s) => s.to === '0.81.0'));
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.version, GAME_VERSION);
  assert.equal(pkg.build.nsis.artifactName, 'Tessera.exe');
  assert.ok(fs.existsSync('build/icon.ico') && fs.existsSync('build/icon.png'));
});
