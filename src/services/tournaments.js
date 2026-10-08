import { fbGet, fbPut, fbDelete } from '../firebase.js';

// Every tournament is its own document at /tournaments/{id} from the moment
// it's created — there is no shared "active slot" that a second tournament
// could accidentally overwrite, and no separate "paused" table to move data
// into/out of. status is the single source of truth: 'active' | 'finished'.

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Serializes writes per tournament id so overlapping edits (double-clicks,
// fast successive score confirmations) can never resolve out of order and
// clobber each other. Callers still get the real result/error of their own
// write; only the ordering is enforced.
const writeLocks = new Map();
const deletedIds = new Set();
function serialize(id, fn) {
  const prior = writeLocks.get(id) || Promise.resolve();
  const run = prior.then(fn, fn);
  writeLocks.set(id, run.catch(() => {}));
  return run;
}

export async function createTournament(payload) {
  const id = generateId();
  const now = Date.now();
  const tournament = { ...payload, id, status: 'active', createdAt: now, updatedAt: now };
  await serialize(id, () => fbPut(`/tournaments/${id}`, tournament));
  return tournament;
}

// `tournament` must be the full object (Firebase PUT replaces the whole node).
export function saveTournament(tournament) {
  const updated = { ...tournament, updatedAt: Date.now() };
  return serialize(tournament.id, () => {
    if (deletedIds.has(tournament.id)) throw new Error('Турнир уже удалён.');
    return fbPut(`/tournaments/${tournament.id}`, updated);
  }).then(() => updated);
}

export function finishTournament(tournament) {
  return saveTournament({ ...tournament, status: 'finished' });
}

// Reopens a tournament straight from the History list (i.e. one that's no
// longer the "current" tournament in the editor) so a mistaken result can be
// fixed after the fact — moves it back into the active list.
export function reopenFinishedTournament(tournament) {
  return saveTournament({ ...tournament, status: 'active' });
}

export async function getTournament(id) {
  return fbGet(`/tournaments/${id}`);
}

async function listAll() {
  const data = await fbGet('/tournaments');
  if (!data) return [];
  return Object.values(data);
}

// Migrated tournaments (from the old /state, /saves, /history paths) never
// had a createdAt field — fall back to the numeric prefix of their id
// (old ids were a bare timestamp, new ones are `${timestamp}-${suffix}`),
// so ordering stays chronological either way.
function sortKey(t) {
  return t.createdAt || parseInt(t.id, 10) || 0;
}

export async function listActive() {
  const all = await listAll();
  return all.filter(t => t.status === 'active').sort((a, b) => sortKey(b) - sortKey(a));
}

export async function listHistory() {
  const all = await listAll();
  return all.filter(t => t.status === 'finished').sort((a, b) => sortKey(b) - sortKey(a));
}

// Serialize deletion with autosaves and reject late writes to prevent a
// pending save from recreating the deleted tournament in this session.
export async function deleteTournament(tournament) {
  if (!tournament || typeof tournament.id !== 'string' || !tournament.id || /[.#$\[\]\/?%\\\u0000-\u001f\u007f]/.test(tournament.id)) {
    throw new Error('Некорректный идентификатор турнира.');
  }
  return serialize(tournament.id, async () => {
    if (deletedIds.has(tournament.id)) return;
    await fbDelete(`/tournaments/${tournament.id}`);
    deletedIds.add(tournament.id);
  });
}
