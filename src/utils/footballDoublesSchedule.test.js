import test from 'node:test';
import assert from 'node:assert/strict';
import { completeFootballDoublesSchedule } from './footballDoublesSchedule.js';
import { buildAmericanoRounds, americanoReturnPairs } from './americano.js';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { addParticipant } from './participantActions.js';
import { FOOTBALL_DOUBLES } from './sportConfig.js';
import { changeDoublesFormat } from './changeDoublesFormat.js';

const pairKey = pair => JSON.stringify([...pair].sort());
const key = match => JSON.stringify([pairKey(match.pairA), pairKey(match.pairB)]);

function assertFullSchedule(tournament) {
  const matches = tournament.rounds.flatMap(round => round.matches);
  const n = tournament.players.length;
  const isLeague = tournament.format === 'league';
  assert.equal(matches.length, n * (n - 1) * (n - 2) * (n - 3) / (isLeague ? 4 : 8));
  const fixtureKey = isLeague ? key : match => JSON.stringify([pairKey(match.pairA), pairKey(match.pairB)].sort());
  assert.equal(new Set(matches.map(fixtureKey)).size, matches.length);
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
  assert.equal(americanoReturnPairs(tournament).length, isLeague ? matches.length / 2 : 0);
  for (const left of tournament.players) for (const right of tournament.players) {
    if (left === right) continue;
    const pair = pairKey([left, right]);
    const fixtures = matches.filter(match => pairKey(match.pairA) === pair || pairKey(match.pairB) === pair);
    assert.equal(fixtures.length, (n - 2) * (n - 3) / (isLeague ? 1 : 2));
  }
}

test('every disjoint pair plays every other pair home and away with equal player participation', () => {
  for (const count of [4, 5, 6, 8]) {
    const tournament = buildTournamentPayload({
      name: 'Лига', sport: FOOTBALL_DOUBLES, format: 'league',
      participants: Array.from({ length: count }, (_, i) => ({ name: `Игрок ${i}` })),
    });
    assertFullSchedule(tournament);
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
  assert.equal(completeFootballDoublesSchedule(tournament), true);
  assertFullSchedule(tournament);
  const repaired = tournament.rounds.flatMap(round => round.matches);
  for (const match of existing) assert.deepEqual(repaired.find(item => key(item) === key(match)), match);
  const before = structuredClone(tournament);
  assert.equal(completeFootballDoublesSchedule(tournament), false);
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
    assertFullSchedule(tournament);
    assert.deepEqual(tournament.rounds.flatMap(round => round.matches).find(match => match.played), played);
  }
});

test('one round covers every disjoint pairing once for even and odd rosters', () => {
  for (const count of [4, 5, 6, 8]) {
    const tournament = buildTournamentPayload({
      name: 'Один круг', sport: FOOTBALL_DOUBLES, format: 'americano',
      participants: Array.from({ length: count }, (_, i) => ({ name: `Игрок ${i}` })),
    });
    assertFullSchedule(tournament);
    const before = structuredClone(tournament);
    assert.equal(completeFootballDoublesSchedule(tournament), false);
    assert.deepEqual(tournament, before);
  }
});

test('five players and five clubs create 15 fixtures and format switching preserves them', () => {
  const clubPool = Array.from({ length: 5 }, (_, i) => ({ club: `Клуб ${i}` }));
  const tournament = {
    ...buildTournamentPayload({
      name: 'Один круг', sport: FOOTBALL_DOUBLES, format: 'americano', clubPool,
      participants: ['A', 'B', 'C', 'D', 'E'].map(name => ({ name })),
    }), status: 'active',
  };
  assertFullSchedule(tournament);
  const original = structuredClone(tournament.rounds);
  const previousClub = new Map();
  for (const round of tournament.rounds) for (const match of round.matches) {
    assert.notEqual(match.clubA.club, match.clubB.club);
    for (const [pair, club] of [[match.pairA, match.clubA], [match.pairB, match.clubB]]) {
      assert.ok(clubPool.some(item => item.club === club.club));
      for (const player of pair) {
        assert.notEqual(previousClub.get(player), club.club);
        previousClub.set(player, club.club);
      }
    }
  }
  changeDoublesFormat(tournament, 'league', 42);
  assertFullSchedule(tournament);
  changeDoublesFormat(tournament, 'americano', 42);
  assertFullSchedule(tournament);
  assert.deepEqual(tournament.rounds.map(round => round.matches.map(key)), original.map(round => round.matches.map(key)));
});
