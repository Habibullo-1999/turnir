import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteTournament, saveTournament } from './tournaments.js';

function response(status = 200) {
  return { ok: status === 200, status, json: async () => null };
}

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
    calls.push(options.method);
    if (options.method === 'PUT') await saveGate;
    return response();
  });
  const tournament = { id: 'delete-with-autosave', status: 'active' };
  const saving = saveTournament(tournament);
  const deleting = deleteTournament(tournament);
  const queuedSave = assert.rejects(saveTournament(tournament), /уже удалён/);
  await Promise.resolve();
  assert.deepEqual(calls, ['PUT']);
  releaseSave();
  await Promise.all([saving, deleting, queuedSave]);
  assert.deepEqual(calls, ['PUT', 'DELETE']);
  await assert.rejects(saveTournament(tournament), /уже удалён/);
  assert.deepEqual(calls, ['PUT', 'DELETE']);
});

test('failed deletion surfaces the error, allows saving and can be retried', async t => {
  const calls = [];
  let rejectDelete = true;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls.push(options.method);
    return response(options.method === 'DELETE' && rejectDelete ? 403 : 200);
  });
  const tournament = { id: 'delete-retry', status: 'active' };
  await assert.rejects(deleteTournament(tournament), /403/);
  await saveTournament(tournament);
  rejectDelete = false;
  await deleteTournament(tournament);
  await assert.rejects(saveTournament(tournament), /уже удалён/);
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
    calls.push({ url, method: options.method });
    if (options.method === 'PUT') await saveGate;
    return response();
  });
  const saving = saveTournament({ id: 'other-pending-save', status: 'active' });
  await deleteTournament({ id: 'independent-delete', status: 'active' });
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.ok(calls.at(-1).url.endsWith('/tournaments/independent-delete.json'));
  releaseSave();
  await saving;
});
