import test from 'node:test';
import assert from 'node:assert/strict';
import { completeFootballDoublesLeague } from './footballDoublesSchedule.js';
import { buildAmericanoRounds, americanoReturnPairs } from './americano.js';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { addParticipant } from './participantActions.js';
import { FOOTBALL_DOUBLES } from './sportConfig.js';

const pairKey = pair => JSON.stringify([...pair].sort());
const key = match => JSON.stringify([pairKey(match.pairA), pairKey(match.pairB)]);

function assertFullLeague(tournament) {
  const matches = tournament.rounds.flatMap(round => round.matches);
  const n = tournament.players.length;
  assert.equal(matches.length, n * (n - 1) * (n - 2) * (n - 3) / 4);
  assert.equal(new Set(matches.map(key)).size, matches.length);
  const appearances = new Map(tournament.players.map(player => [player, 0]));
  for (const round of tournament.rounds) {
    const scheduled = [...(round.byes || [])];
    for (const match of round.matches) {
      assert.equal(match.pairA.length, 2);
      assert.equal(match.pairB.length, 2);
      assert.equal(new Set([...match.pairA, ...match.pairB]).size, 4);
      for (const player of [...match.pairA, ...match.pairB]) {
        scheduled.push(player);
        appearances.set(player, appearances.get(player) + 1);
      }
    }
    assert.deepEqual(scheduled.sort(), [...tournament.players].sort());
  }
  assert.equal(new Set(appearances.values()).size, 1);
  assert.equal(americanoReturnPairs(tournament).length, matches.length / 2);
  for (const left of tournament.players) for (const right of tournament.players) {
    if (left === right) continue;
    const pair = pairKey([left, right]);
    const fixtures = matches.filter(match => pairKey(match.pairA) === pair || pairKey(match.pairB) === pair);
    assert.equal(fixtures.length, (n - 2) * (n - 3));
  }
}

test('every disjoint pair plays every other pair home and away with equal player participation', () => {
  for (const count of [4, 5, 6, 8]) {
    const tournament = buildTournamentPayload({
      name: 'Лига', sport: FOOTBALL_DOUBLES, format: 'league',
      participants: Array.from({ length: count }, (_, i) => ({ name: `Игрок ${i}` })),
    });
    assertFullLeague(tournament);
  }
});

test('repair retains every existing match and result and is idempotent', () => {
  const players = ['Хабиб', 'Давлат', 'Чамшид', 'Хооуми', 'Рустам'];
  const tournament = {
    sport: FOOTBALL_DOUBLES, format: 'league', status: 'active', players,
    rounds: buildAmericanoRounds(players, { allowUnevenTeams: false, double: true, random: () => 0.4 }),
  };
  Object.assign(tournament.rounds[0].matches[0], { played: true, score1: 2, score2: 1, clubA: { club: 'Арсенал' } });
  Object.assign(tournament.rounds[2].matches[0], { played: true, score1: 4, score2: 2 });
  const existing = structuredClone(tournament.rounds.flatMap(round => round.matches));
  assert.equal(completeFootballDoublesLeague(tournament), true);
  assertFullLeague(tournament);
  const repaired = tournament.rounds.flatMap(round => round.matches);
  for (const match of existing) assert.deepEqual(repaired.find(item => key(item) === key(match)), match);
  const before = structuredClone(tournament);
  assert.equal(completeFootballDoublesLeague(tournament), false);
  assert.deepEqual(tournament, before);
});

test('adding a fifth and sixth player completes all new combinations without dropping old results', () => {
  const tournament = {
    ...buildTournamentPayload({
      name: 'Лига', sport: FOOTBALL_DOUBLES, format: 'league',
      participants: ['A', 'B', 'C', 'D'].map(name => ({ name })),
    }), status: 'active',
  };
  Object.assign(tournament.rounds[0].matches[0], { played: true, score1: 3, score2: 1 });
  const played = structuredClone(tournament.rounds[0].matches[0]);
  for (const name of ['E', 'F']) {
    addParticipant(tournament, { name }, 123);
    assertFullLeague(tournament);
    assert.deepEqual(tournament.rounds.flatMap(round => round.matches).find(match => match.played), played);
  }
});
