import { fbGet, fbPut, fbDelete, fbGetWithEtag, fbPutIfMatch } from '../firebase.js';

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

// Last known server state of each tournament this tab has read or written:
// id -> { data, etag }. Every update is applied on top of this (not on the
// tab's possibly stale React state) and written with `if-match`, so a write
// from an outdated copy can never silently erase someone else's change.
const snapshots = new Map();
const MAX_CONFLICT_RETRIES = 5;

export async function createTournament(payload) {
  const id = generateId();
  const now = Date.now();
  const tournament = { ...payload, id, status: 'active', createdAt: now, updatedAt: now };
  await serialize(id, () => fbPut(`/tournaments/${id}`, tournament));
  snapshots.set(id, { data: tournament, etag: null });
  return tournament;
}

// Applies `mutator` to a fresh copy of the tournament and saves it only if
// nobody else wrote it in the meantime; on a conflict the change is
// re-applied on top of the newer server version. Resolves with what was
// actually saved (including other people's changes).
export function updateTournament(id, mutator) {
  return serialize(id, async () => {
    for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
      if (deletedIds.has(id)) throw new Error('Турнир уже удалён.');
      let snap = snapshots.get(id);
      if (!snap || !snap.etag) {
        snap = await fbGetWithEtag(`/tournaments/${id}`);
        snapshots.set(id, snap);
      }
      if (!snap.data) throw new Error('Турнир удалён.');
      const draft = structuredClone(snap.data);
      mutator(draft);
      draft.updatedAt = Date.now();
      const res = await fbPutIfMatch(`/tournaments/${id}`, draft, snap.etag);
      if (res.conflict) {
        snapshots.set(id, { data: res.data, etag: res.etag });
        continue;
      }
      snapshots.set(id, { data: draft, etag: res.etag });
      return draft;
    }
    throw new Error('Турнир одновременно меняют другие — попробуйте ещё раз.');
  });
}

// Reopens a tournament straight from the History list (i.e. one that's no
// longer the "current" tournament in the editor) so a mistaken result can be
// fixed after the fact — moves it back into the active list.
export function reopenFinishedTournament(tournament) {
  return updateTournament(tournament.id, draft => { draft.status = 'active'; });
}

export async function getTournament(id) {
  const snap = await fbGetWithEtag(`/tournaments/${id}`);
  snapshots.set(id, snap);
  return snap.data;
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
    snapshots.delete(tournament.id);
  });
}
