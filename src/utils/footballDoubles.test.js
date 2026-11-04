import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { aggregateAmericanoPairStats, calcAmericanoStandings, calcFootballDoublesStandings, computeAmericanoResult } from './americano.js';
import { confirmAmericanoScore } from './americanoActions.js';
import { getParticipantRemovalError, removeParticipant } from './removeParticipant.js';
import { FOOTBALL_DOUBLES, SPORT_CONFIG, TT_DOUBLES } from './sportConfig.js';
import { computeRecords } from './records.js';
import { getTournamentWinner } from './tournamentWinner.js';

function tournament(count, format) {
  return {
    ...buildTournamentPayload({
      name: 'Кубок 2×2',
      sport: FOOTBALL_DOUBLES,
      format,
      participants: Array.from({ length: count }, (_, i) => ({ name: `Игрок ${i + 1}` })),
    }),
    status: 'active',
  };
}

test('football doubles requires four unique players', () => {
  assert.throws(() => tournament(3), /минимум 4/);
  assert.throws(() => buildTournamentPayload({
    name: '', sport: FOOTBALL_DOUBLES,
    participants: ['A', 'B', 'C', ' A '].map(name => ({ name })),
  }), /уникальными/);
});

test('four players change partners every round and partner with everyone once', () => {
  const draft = tournament(4);
  assert.equal(draft.rounds.length, 3);
  const partnerships = new Set();
  for (const round of draft.rounds) {
    assert.equal(round.matches.length, 1);
    assert.deepEqual(round.byes, []);
    for (const pair of [round.matches[0].pairA, round.matches[0].pairB]) {
      partnerships.add(pair.slice().sort().join('/'));
    }
  }
  assert.equal(partnerships.size, 6);
});

test('all matches stay strictly 2×2 and every player is scheduled or resting', () => {
  for (let count = 4; count <= 11; count++) {
    const draft = tournament(count);
    for (const round of draft.rounds) {
      const scheduled = [...round.byes];
      for (const match of round.matches) {
        assert.equal(match.pairA.length, 2);
        assert.equal(match.pairB.length, 2);
        scheduled.push(...match.pairA, ...match.pairB);
      }
      assert.deepEqual(scheduled.sort(), draft.players.slice().sort());
    }
  }
});

test('draws give every player one point and count in pair statistics', () => {
  const draft = tournament(4);
  draft.rounds.forEach((round, index) => confirmAmericanoScore(draft, index, 0, 2, 2));
  assert.equal(draft.status, 'finished');
  for (const row of calcAmericanoStandings(draft)) {
    assert.equal(row.d, 3);
    assert.equal(row.pts, 3);
    assert.equal(row.pf, 6);
    assert.equal(row.w, 0);
    assert.equal(row.l, 0);
  }
  assert.ok(aggregateAmericanoPairStats([draft]).every(pair => pair.d === 1));
  const records = computeRecords([draft], SPORT_CONFIG[FOOTBALL_DOUBLES]);
  assert.equal(records.find(record => record.id === 'top-match').value, '4 гола');
  assert.ok(!records.some(record => record.id === 'win-streak'));
});

test('removal retains strict 2×2 scheduling and cannot leave fewer than four', () => {
  const draft = tournament(6);
  removeParticipant(draft, draft.players[0]);
  assert.equal(draft.players.length, 5);
  assert.ok(draft.rounds.every(round => round.matches.every(match => match.pairA.length === 2 && match.pairB.length === 2)));
  removeParticipant(draft, draft.players[0]);
  assert.match(getParticipantRemovalError(draft, draft.players[0]), /минимум 4/);
});

function assertReturnLeg(draft) {
  const half = draft.rounds.length / 2;
  for (let index = 0; index < half; index++) {
    const first = draft.rounds[index];
    const second = draft.rounds[index + half];
    assert.deepEqual(second.byes, first.byes);
    assert.notEqual(second.byes, first.byes);
    assert.equal(second.matches.length, first.matches.length);
    first.matches.forEach((match, matchIndex) => {
      const returnMatch = second.matches[matchIndex];
      assert.deepEqual(returnMatch.pairA, match.pairB);
      assert.deepEqual(returnMatch.pairB, match.pairA);
      assert.notEqual(returnMatch.pairA, match.pairB);
      assert.notEqual(returnMatch.pairB, match.pairA);
      assert.equal(returnMatch.score1, null);
      assert.equal(returnMatch.score2, null);
      assert.equal(returnMatch.played, false);
    });
  }
}

test('league adds a separate return leg with the same pairs and reversed home/away', () => {
  for (const count of [4, 5, 6, 8]) {
    const draft = tournament(count, 'league');
    assert.equal(draft.format, 'league');
    assert.equal(draft.rounds.length, (count % 2 ? count : count - 1) * 2);
    assertReturnLeg(draft);
  }
});

test('return matches have independent scores and league finishes only after both legs', () => {
  const draft = tournament(4, 'league');
  const half = draft.rounds.length / 2;
  for (let index = 0; index < half; index++) confirmAmericanoScore(draft, index, 0, 3, 1);
  assert.equal(draft.status, 'active');
  assertReturnLeg(draft);
  for (let index = half; index < draft.rounds.length; index++) confirmAmericanoScore(draft, index, 0, 3, 1);
  assert.equal(draft.status, 'finished');
  for (const row of calcAmericanoStandings(draft)) {
    assert.equal(row.played, 6);
    assert.equal(row.w, 3);
    assert.equal(row.l, 3);
    assert.equal(row.pts, 9);
    assert.equal(row.pf, 12);
    assert.equal(row.pa, 12);
  }
});

test('removing a league player retains unaffected fixtures in both legs', () => {
  const draft = tournament(6, 'league');
  const removed = draft.players[0];
  const kept = structuredClone(draft.rounds.flatMap(round => round.matches).filter(match => ![...match.pairA, ...match.pairB].includes(removed)));
  removeParticipant(draft, removed);
  assert.equal(draft.format, 'league');
  assert.deepEqual(draft.rounds.flatMap(round => round.matches), kept);
  assertReturnLeg(draft);
  for (const round of draft.rounds) {
    assert.ok(!round.byes.includes(removed));
    assert.ok(round.matches.every(match => ![...match.pairA, ...match.pairB].includes(removed)));
  }
});

function pairTournament(scores) {
  return {
    sport: FOOTBALL_DOUBLES, status: 'active', players: ['A', 'B', 'C', 'D'],
    rounds: scores.map(([pairA, pairB, score1, score2]) => ({
      matches: [{ pairA, pairB, score1, score2, played: true }],
    })),
  };
}

test('football winner is the best pair instead of the best individual player', () => {
  const draft = pairTournament([
    [['A', 'B'], ['C', 'D'], 8, 0],
    [['A', 'C'], ['B', 'D'], 2, 0],
    [['A', 'D'], ['B', 'C'], 3, 0],
  ]);
  assert.equal(calcAmericanoStandings(draft)[0].name, 'A');
  assert.equal(computeAmericanoResult(draft).winner, 'A & B');
  confirmAmericanoScore(draft, 2, 0, 3, 0);
  assert.equal(draft.status, 'finished');
  assert.equal(draft.winner, 'A & B');
  assert.equal(getTournamentWinner({ ...draft, winner: 'A' }), 'A & B');
  assert.equal(computeAmericanoResult({ ...draft, sport: TT_DOUBLES }).winner, 'A');
});

test('pair ranking uses points, goal difference and goals scored in that order', () => {
  const draft = pairTournament([
    [['A', 'B'], ['C', 'D'], 3, 1],
    [['C', 'A'], ['B', 'D'], 4, 2],
    [['B', 'A'], ['D', 'C'], 0, 0],
  ]);
  assert.equal(computeAmericanoResult(draft).winner, 'A & B'); // 4 points beats 3
  draft.rounds.pop();
  assert.equal(computeAmericanoResult(draft).winner, 'A & C'); // equal points and difference, more goals
  draft.rounds[0].matches[0].score1 = 5;
  assert.equal(computeAmericanoResult(draft).winner, 'A & B'); // bigger difference
});

test('full ties share first place and pair order never changes the result', () => {
  const draft = pairTournament([
    [['B', 'A'], ['C', 'D'], 2, 0],
    [['C', 'A'], ['B', 'D'], 2, 0],
  ]);
  assert.equal(computeAmericanoResult(draft).winner, 'A & B / A & C');
  draft.rounds.push({ matches: [{ pairA: ['D', 'C'], pairB: ['A', 'B'], score1: 0, score2: 2, played: true }] });
  const standings = calcFootballDoublesStandings(draft);
  assert.equal(standings[0].name, 'A & B');
  assert.equal(standings[0].pts, 6);
  assert.equal(standings[0].played, 2);
  assert.equal(standings[0].diff, 4);
  assert.equal(computeAmericanoResult({ ...draft, rounds: [] }).winner, null);
});
