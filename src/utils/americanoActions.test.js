import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { confirmAmericanoScore, clearAmericanoScore } from './americanoActions.js';
import { computeAmericanoResult, isAmericanoComplete } from './americano.js';
import { removeParticipant } from './removeParticipant.js';

function tournament(sport = 'football-2x2', count = 4) {
  return {
    ...buildTournamentPayload({ name: '2×2', sport, participants: Array.from({ length: count }, (_, i) => ({ name: `Игрок ${i}` })) }),
    status: 'active',
  };
}

test('invalid scores, missing matches and finished tournaments are rejected atomically', () => {
  for (const [s1, s2] of [[-1, 0], [0, -1], [1.5, 0], [NaN, 0], [Infinity, 0], [100, 0], ['2', 1]]) {
    const draft = tournament();
    const before = structuredClone(draft);
    assert.throws(() => confirmAmericanoScore(draft, 0, 0, s1, s2), /целый счёт/);
    assert.deepEqual(draft, before);
  }
  const draft = tournament();
  const before = structuredClone(draft);
  assert.throws(() => confirmAmericanoScore(draft, 99, 0, 2, 1), /Матч не найден/);
  assert.throws(() => clearAmericanoScore(draft, 99, 0), /Матч не найден/);
  assert.deepEqual(draft, before);
  draft.status = 'finished';
  assert.throws(() => confirmAmericanoScore(draft, 0, 0, 2, 1), /верните/);
});

test('football accepts a draw while tennis rejects it without changing data', () => {
  const football = tournament();
  confirmAmericanoScore(football, 0, 0, 0, 0);
  assert.equal(football.rounds[0].matches[0].played, true);
  const tennis = tournament('table-tennis-2x2');
  const before = structuredClone(tennis);
  assert.throws(() => confirmAmericanoScore(tennis, 0, 0, 2, 2), /Ничья/);
  assert.deepEqual(tennis, before);
});

test('clearing a score removes stale final summaries and completing the match recalculates them', () => {
  const draft = tournament();
  draft.rounds.forEach((round, r) => round.matches.forEach((_, m) => confirmAmericanoScore(draft, r, m, 2, 1)));
  assert.equal(draft.status, 'finished');
  clearAmericanoScore(draft, 0, 0);
  assert.equal(draft.status, 'active');
  for (const field of ['winner', 'stats', 'finishedAt', 'date']) assert.equal(Object.hasOwn(draft, field), false);
  confirmAmericanoScore(draft, 0, 0, 1, 2);
  assert.equal(draft.status, 'finished');
  assert.equal(draft.winner, computeAmericanoResult(draft).winner);
});

test('removing a participant completes the tournament if all remaining fixtures are played', () => {
  const draft = tournament('football-2x2', 8);
  const player = draft.players[0];
  for (const round of draft.rounds) for (const match of round.matches) {
    if (![...match.pairA, ...match.pairB].includes(player)) Object.assign(match, { played: true, score1: 3, score2: 0 });
  }
  removeParticipant(draft, player);
  assert.equal(draft.status, 'finished');
  assert.equal(draft.winner, computeAmericanoResult(draft).winner);
  assert.ok(draft.finishedAt);
  assert.ok(draft.rounds.every(round => round.matches.every(match => ![...match.pairA, ...match.pairB].includes(player))));
});

test('empty rounds do not count as a completed tournament', () => {
  assert.equal(isAmericanoComplete({ rounds: [{ matches: [] }] }), false);
  assert.equal(isAmericanoComplete({ rounds: [] }), false);
});
