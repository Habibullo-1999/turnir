import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { distributeDoublesClubs, minimumDoublesClubs } from './doublesClubs.js';
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

test('removing a participant rebuilds assignments along with the new pair schedule', () => {
  const draft = tournament(8, { clubPool: clubs(6) });
  removeParticipant(draft, draft.players[0]);
  assertRotation(draft);
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
