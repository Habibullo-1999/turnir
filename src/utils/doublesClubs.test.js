import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { distributeDoublesClubs, minimumDoublesClubs, synchronizeDoublesReturnClubs } from './doublesClubs.js';
import { americanoReturnPairs, orderedAmericanoRounds } from './americano.js';
import { confirmAmericanoScore } from './americanoActions.js';
import { removeParticipant } from './removeParticipant.js';
import { FOOTBALL_DOUBLES, TT_DOUBLES } from './sportConfig.js';

const clubs = count => Array.from({ length: count }, (_, index) => ({ club: `Клуб ${index + 1}`, icon: '', flag: '⚽' }));
function tournament(count = 4, extra = {}) {
  return { ...buildTournamentPayload({
    name: 'Кубок', sport: FOOTBALL_DOUBLES, format: 'league',
    participants: Array.from({ length: count }, (_, index) => ({ name: `Игрок ${index + 1}` })),
    ...extra,
  }), status: 'active' };
}

function assertRotation(draft) {
  if (draft.format === 'league') {
    const ordered = orderedAmericanoRounds(draft);
    assertRotation({ ...draft, format: undefined, rounds: ordered.slice(0, ordered.length / 2) });
    for (const { first, second } of americanoReturnPairs(draft)) {
      assert.deepEqual(second.clubA, first.clubB);
      assert.deepEqual(second.clubB, first.clubA);
      if (first.clubA) assert.notEqual(second.clubB, first.clubA);
    }
    return;
  }
  const previous = new Map();
  for (const round of draft.rounds) {
    const used = new Set();
    for (const match of round.matches) {
      for (const [pair, field] of [['pairA', 'clubA'], ['pairB', 'clubB']]) {
        const club = match[field].club;
        assert.ok(!used.has(club), 'different clubs within a round');
        used.add(club);
        for (const player of match[pair]) {
          assert.notEqual(club, previous.get(player), 'each player changes club, including after resting');
          previous.set(player, club);
        }
      }
    }
  }
}

test('rotates clubs for both partners with the minimum pool, odd counts and return legs', () => {
  for (const count of [4, 5, 6, 7, 8, 9, 12]) {
    for (const seed of [0, 1, 42, 123456789]) {
      const draft = tournament(count);
      const before = structuredClone(draft);
      const pool = clubs(minimumDoublesClubs(count));
      distributeDoublesClubs(draft, pool, seed);
      assertRotation(draft);
      assert.deepEqual(draft.clubPool, pool);
      draft.rounds.forEach((round, r) => round.matches.forEach((match, m) => {
        const { clubA, clubB, ...rest } = match;
        assert.deepEqual(rest, before.rounds[r].matches[m]);
        assert.ok(clubA && clubB);
      }));
    }
  }
});

test('creation can assign clubs and old tournaments without clubs stay supported', () => {
  assertRotation(tournament(4, { clubPool: clubs(4) }));
  const old = tournament();
  assert.equal(old.clubPool, undefined);
  assert.equal(old.rounds[0].matches[0].clubA, undefined);
  distributeDoublesClubs(old, clubs(4), 123);
  assertRotation(old);
});

test('rerolls deterministically and preserves played matches and their club metadata', () => {
  const draft = tournament();
  distributeDoublesClubs(draft, clubs(8), 1);
  confirmAmericanoScore(draft, 0, 0, 3, 1);
  const played = structuredClone(draft.rounds[0].matches[0]);
  const other = structuredClone(draft);
  distributeDoublesClubs(draft, clubs(8), 42);
  distributeDoublesClubs(other, clubs(8), 42);
  assert.deepEqual(draft, other);
  assert.deepEqual(draft.rounds[0].matches[0], played);
  assertRotation(draft);
});

test('preserves played future rounds and avoids their clubs in adjacent unplayed matches', () => {
  const draft = tournament();
  distributeDoublesClubs(draft, clubs(10), 17);
  confirmAmericanoScore(draft, 2, 0, 1, 2);
  const fixed = structuredClone(draft.rounds[2]);
  distributeDoublesClubs(draft, clubs(10), 42);
  assert.deepEqual(draft.rounds[2], fixed);
  assertRotation(draft);
});

test('rejects incomplete, duplicated or small pools and finished or unrelated tournaments atomically', () => {
  for (const pool of [null, clubs(3), [null, ...clubs(4)], [...clubs(4), { club: ' клуб 1 ' }]]) {
    const draft = tournament();
    const before = structuredClone(draft);
    assert.throws(() => distributeDoublesClubs(draft, pool, 1));
    assert.deepEqual(draft, before);
  }
  for (const extra of [{ status: 'finished' }, { sport: TT_DOUBLES }]) {
    const draft = { ...tournament(), ...extra };
    assert.throws(() => distributeDoublesClubs(draft, clubs(4), 1));
  }
});

test('removing a participant preserves club assignments of unaffected fixtures', () => {
  const draft = tournament(8, { clubPool: clubs(6) });
  const removed = draft.players[0];
  const kept = structuredClone(draft.rounds.flatMap(round => round.matches).filter(match => ![...match.pairA, ...match.pairB].includes(removed)));
  removeParticipant(draft, removed);
  assert.deepEqual(draft.rounds.flatMap(round => round.matches), kept);
  assert.equal(draft.players.length, 7);
});

test('an impossible reroll between fixed rounds leaves the entire tournament unchanged', () => {
  const pool = clubs(4);
  const draft = { sport: FOOTBALL_DOUBLES, status: 'active', players: ['A', 'B', 'C', 'D'], rounds: [
    { matches: [{ pairA: ['A', 'B'], pairB: ['C', 'D'], clubA: pool[0], clubB: pool[1], played: true, score1: 1, score2: 0 }] },
    { matches: [{ pairA: ['A', 'C'], pairB: ['B', 'D'], played: false, score1: null, score2: null }] },
    { matches: [{ pairA: ['A', 'B'], pairB: ['C', 'D'], clubA: pool[2], clubB: pool[3], played: true, score1: 2, score2: 0 }] },
  ] };
  const before = structuredClone(draft);
  assert.throws(() => distributeDoublesClubs(draft, pool, 1), /Добавьте клубы/);
  assert.deepEqual(draft, before);
});

test('a played return match fixes the clubs of its unplayed first meeting', () => {
  const draft = tournament();
  distributeDoublesClubs(draft, clubs(8), 2);
  const half = draft.rounds.length / 2;
  confirmAmericanoScore(draft, half, 0, 2, 1);
  const played = structuredClone(draft.rounds[half].matches[0]);
  distributeDoublesClubs(draft, clubs(8), 91);
  assert.deepEqual(draft.rounds[half].matches[0], played);
  assert.equal(draft.rounds[0].matches[0].played, false);
  assert.equal(draft.rounds[0].matches[0].score1, null);
  assertRotation(draft);
});

test('clubs follow the actual return fixture even when return rounds are reordered', () => {
  const draft = tournament(8);
  const half = draft.rounds.length / 2;
  draft.rounds = [...draft.rounds.slice(0, half), ...draft.rounds.slice(half).reverse()];
  distributeDoublesClubs(draft, clubs(8), 42);
  assertRotation(draft);
});

test('inconsistent played clubs and missing return fixtures fail without changing data', () => {
  const draft = tournament();
  distributeDoublesClubs(draft, clubs(8), 2);
  const half = draft.rounds.length / 2;
  confirmAmericanoScore(draft, 0, 0, 1, 2);
  confirmAmericanoScore(draft, half, 0, 3, 0);
  draft.rounds[half].matches[0].clubA = { club: 'Другой клуб' };
  const before = structuredClone(draft);
  assert.throws(() => distributeDoublesClubs(draft, clubs(8), 3), /сыгранных/);
  assert.deepEqual(draft, before);
  const broken = tournament();
  broken.rounds.pop();
  const saved = structuredClone(broken);
  assert.throws(() => distributeDoublesClubs(broken, clubs(8), 3), /ответные/);
  assert.deepEqual(broken, saved);
});

test('legacy synchronization repairs unplayed return clubs and preserves played history', () => {
  const draft = tournament();
  distributeDoublesClubs(draft, clubs(8), 2);
  const { first, second } = americanoReturnPairs(draft)[0];
  first.played = true;
  first.score1 = 3;
  first.score2 = 1;
  second.clubA = { club: 'Старый неправильный клуб' };
  const played = structuredClone(first);
  synchronizeDoublesReturnClubs(draft);
  assert.deepEqual(first, played);
  assert.deepEqual(second.clubA, first.clubB);
  assert.deepEqual(second.clubB, first.clubA);
  second.played = true;
  second.clubA = { club: 'Исторический клуб' };
  const before = structuredClone(draft);
  synchronizeDoublesReturnClubs(draft);
  assert.deepEqual(draft, before);
});
