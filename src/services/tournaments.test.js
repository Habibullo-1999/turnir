import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteTournament, getTournament, updateTournament } from './tournaments.js';

function response(status = 200, body = {}, etag = 'e1') {
  return { ok: status === 200, status, json: async () => body, headers: { get: () => etag } };
}

// Minimal in-memory Firebase node supporting GET (with ETag) and if-match PUT.
function fakeNode(initial) {
  let value = initial;
  let version = 1;
  return {
    get value() { return value; },
    // Simulates a write from another device.
    externalWrite(next) { value = next; version += 1; },
    async fetch(_url, options = {}) {
      const etag = `v${version}`;
      if (!options.method) return response(200, value, etag);
      if (options.method === 'PUT') {
        if (options.headers?.['if-match'] !== etag) return response(412, value, etag);
        value = JSON.parse(options.body);
        version += 1;
        return response(200, value, `v${version}`);
      }
      return response();
    },
  };
}

const noop = () => {};

test('deletes both active and finished tournaments at their own paths', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, method: options.method });
    return response();
  });
  for (const status of ['active', 'finished']) {
    const id = `delete-${status}`;
    await deleteTournament({ id, status });
    assert.ok(calls.at(-1).url.endsWith(`/tournaments/${id}.json`));
    assert.equal(calls.at(-1).method, 'DELETE');
  }
});

test('rejects missing and unsafe identifiers before making a request', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response());
  for (const tournament of [null, {}, { id: '' }, { id: 123 }, { id: '../other' }, { id: 'id?other' }, { id: 'id#fragment' }, { id: 'id\n' }]) {
    await assert.rejects(deleteTournament(tournament), /идентификатор/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('waits for previous autosaves and blocks queued and future saves after deletion', async t => {
  const calls = [];
  let releaseSave;
  const saveGate = new Promise(resolve => { releaseSave = resolve; });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (!options.method) return response();
    calls.push(options.method);
    if (options.method === 'PUT') await saveGate;
    return response();
  });
  const tournament = { id: 'delete-with-autosave', status: 'active' };
  const saving = updateTournament(tournament.id, noop);
  const deleting = deleteTournament(tournament);
  const queuedSave = assert.rejects(updateTournament(tournament.id, noop), /уже удалён/);
  while (!calls.length) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['PUT']);
  releaseSave();
  await Promise.all([saving, deleting, queuedSave]);
  assert.deepEqual(calls, ['PUT', 'DELETE']);
  await assert.rejects(updateTournament(tournament.id, noop), /уже удалён/);
  assert.deepEqual(calls, ['PUT', 'DELETE']);
});

test('failed deletion surfaces the error, allows saving and can be retried', async t => {
  const calls = [];
  let rejectDelete = true;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (!options.method) return response();
    calls.push(options.method);
    return response(options.method === 'DELETE' && rejectDelete ? 403 : 200);
  });
  const tournament = { id: 'delete-retry', status: 'active' };
  await assert.rejects(deleteTournament(tournament), /403/);
  await updateTournament(tournament.id, noop);
  rejectDelete = false;
  await deleteTournament(tournament);
  await assert.rejects(updateTournament(tournament.id, noop), /уже удалён/);
  assert.deepEqual(calls, ['DELETE', 'PUT', 'DELETE']);
});

test('concurrent deletion requests delete a tournament only once', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response());
  const tournament = { id: 'delete-once', status: 'finished' };
  await Promise.all([deleteTournament(tournament), deleteTournament(tournament)]);
  assert.equal(fetch.mock.callCount(), 1);
});

test('a pending save in another tournament does not block deletion', async t => {
  let releaseSave;
  const saveGate = new Promise(resolve => { releaseSave = resolve; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (!options.method) return response();
    calls.push({ url, method: options.method });
    if (options.method === 'PUT') await saveGate;
    return response();
  });
  const saving = updateTournament('other-pending-save', noop);
  await deleteTournament({ id: 'independent-delete', status: 'active' });
  const deleteCall = calls.find(c => c.method === 'DELETE');
  assert.ok(deleteCall.url.endsWith('/tournaments/independent-delete.json'));
  releaseSave();
  await saving;
});

test('an update from a stale copy is re-applied on top of the newer server version', async t => {
  const node = fakeNode({ id: 'conflict', status: 'active', scores: [] });
  t.mock.method(globalThis, 'fetch', (url, options) => node.fetch(url, options));
  await getTournament('conflict');
  node.externalWrite({ id: 'conflict', status: 'active', scores: ['other device'] });
  const saved = await updateTournament('conflict', draft => { draft.scores.push('mine'); });
  assert.deepEqual(saved.scores, ['other device', 'mine']);
  assert.deepEqual(node.value.scores, ['other device', 'mine']);
});

test('opening a tournament does not write it back', async t => {
  const node = fakeNode({ id: 'read-only-open', status: 'active' });
  const fetch = t.mock.method(globalThis, 'fetch', (url, options) => node.fetch(url, options));
  await getTournament('read-only-open');
  assert.deepEqual(fetch.mock.calls.map(c => c.arguments[1]?.method), [undefined]);
});
