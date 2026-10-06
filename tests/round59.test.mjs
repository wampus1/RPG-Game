// Round 59: a world heard of from another computer on the network (or
// hosted from an updated save) no longer looks like another version of the
// game to someone on the very same one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { beaconText, readBeacon, Nearby } from '../tools/lan.mjs';
import { networkWorlds, MultiplayerWindow } from '../src/ui/multiplayer.js';
import { NET_VERSION } from '../src/net/protocol.js';
import { GAME_VERSION, compareVersions } from '../src/version.js';
import { STEPS } from '../src/game/migrate.js';
import { stubUI } from './helpers.mjs';

const world = (gv) => ({ name: 'Ashvale', hostName: 'Wren', players: 1, max: 4, gv });

// A world called out from another computer, as this one's list has it.
function heard(gv) {
  const b = readBeacon(beaconText({ id: 'other', v: NET_VERSION, port: 8080, world: world(gv) }), 'me');
  const n = new Nearby();
  n.heard(b, '192.168.1.20');
  return networkWorlds({ host: null, nearby: n.list() });
}

// The multiplayer window over that list: pressing J to join it.
function press(worlds) {
  const said = { join: 0, other: 0 };
  const ctx = {
    accounts: { profile: { id: 'a', name: 'Kit', icon: null } },
    lan: { host: null, nearby: worlds.map((w) => ({ addr: w.at.addr, port: w.at.port, v: w.v, world: w })) },
    saves: [],
    hooks: { join: () => said.join++, otherVersion: () => said.other++, account() {}, newWorld() {}, seedWorld() {} },
  };
  const w = new MultiplayerWindow({ ...stubUI(), mouseCell: { x: -1, y: -1 } }, ctx);
  w.onKey({ code: 'KeyJ' });
  return said;
}

test('a world on another computer keeps its version on the way here', () => {
  const [w] = heard(GAME_VERSION);
  assert.equal(w.gv, GAME_VERSION);
  assert.deepEqual(press([w]), { join: 1, other: 0 }, 'the same version: in you go');
});

test('another version is still told apart; not knowing isn\'t taken for another', () => {
  const [old] = heard('0.40.0');
  assert.deepEqual(press([old]), { join: 0, other: 1 });
  // (From a computer whose call didn't say: the host's own server asks.)
  const [unknown] = heard(null);
  assert.equal(unknown.gv, null);
  assert.deepEqual(press([unknown]), { join: 1, other: 0 });
});

test('0.59.0', () => {
  assert.ok(STEPS.find((q) => q.to === '0.59.0'));
  assert.ok(compareVersions(GAME_VERSION, '0.59.0') >= 0);
});
