import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonPlayers, comparePlayers } from './headToHead.js';

const match = (t1, t2, score1, score2, extra = {}) => ({ t1, t2, score1, score2, played: true, ...extra });
const league = (id, matches, extra = {}) => ({ id, name: `Кубок ${id}`, finishedAt: Number(id), groups: [{ matches }], ...extra });

test('finds existing players in participant lists, raw matches and legacy sparse stats', () => {
  const sparseStats = [];
  sparseStats[2] = { wins: 1 };
  const history = [league('1', [match('A', 'B', 1, 0), match('A', 'BYE', null, null, { played: false })], { players: ['C', 'A'] }), { stats: sparseStats }];
  assert.deepEqual(comparisonPlayers(history), ['2', 'A', 'B', 'C']);
});

test('normalizes home and away scores, counts draws and ignores other opponents and unplayed matches', () => {
  const entry = league('1', [
    match('A', 'B', 3, 1), match('B', 'A', 4, 2), match('A', 'B', 2, 2),
    match('A', 'C', 10, 0), match('B', 'A', null, null, { played: false }),
  ]);
  const result = comparePlayers([entry], 'A', 'B');
  assert.deepEqual(result.wins, [1, 1]);
  assert.equal(result.draws, 1);
  assert.deepEqual(result.goals, [7, 7]);
  assert.deepEqual(result.matches.map(m => m.scores), [[2, 2], [2, 4], [3, 1]]);
  assert.deepEqual(result.biggestWins.map(m => m.scores), [[3, 1], [2, 4]]);
  assert.ok(result.matches.every(m => m.entry === entry));
});

test('counts penalty winners without adding shootout goals or a draw', () => {
  const result = comparePlayers([{
    id: '1', rounds: [[
      match('B', 'A', 2, 2, { winner: 'B', pen1: 5, pen2: 4 }),
      match('A', 'BYE', null, null, { winner: 'A' }),
      match('A', 'B', null, null, { winner: null }),
    ]],
  }], 'A', 'B');
  assert.deepEqual(result.wins, [0, 1]);
  assert.equal(result.draws, 0);
  assert.deepEqual(result.goals, [2, 2]);
  assert.equal(result.matches[0].penalties, true);
  assert.equal(result.matches[0].winner, 1);
});

test('calculates streaks chronologically across tournaments and resets on draws', () => {
  const history = [
    league('3', [match('A', 'B', 1, 1), match('B', 'A', 0, 2)]),
    league('1', [match('A', 'B', 3, 0)]),
    league('2', [match('A', 'B', 4, 0)]),
  ];
  const original = [...history];
  const result = comparePlayers(history, 'A', 'B');
  assert.deepEqual(result.bestStreaks, [2, 0]);
  assert.equal(result.biggestWins[0].entry.id, '2');
  assert.deepEqual(result.matches.map(m => m.entry.id), ['3', '3', '2', '1']);
  assert.deepEqual(history, original);
  const reversed = comparePlayers(history, 'B', 'A');
  assert.deepEqual(reversed.goals, [...result.goals].reverse());
  assert.deepEqual(reversed.wins, [...result.wins].reverse());
});

test('supports legacy dates and excludes cached aggregate stats from head-to-head results', () => {
  const history = [
    league('old2', [match('A', 'B', 1, 0)], { finishedAt: undefined, date: '02.01.2020' }),
    league('old1', [match('A', 'B', 0, 1)], { finishedAt: undefined, date: '01.01.2020' }),
    { id: 'old', stats: { A: { wins: 9 }, B: { wins: 5 } } },
  ];
  const result = comparePlayers(history, 'A', 'B');
  assert.equal(result.matches.length, 2);
  assert.deepEqual(result.matches.map(m => m.entry.id), ['old2', 'old1']);
});

test('no matches for missing players, same player or players without meetings', () => {
  const history = [league('1', [match('A', 'B', 1, 0)])];
  for (const pair of [['', 'B'], ['A', 'A'], ['A', 'C']]) {
    const result = comparePlayers(history, ...pair);
    assert.deepEqual(result.matches, []);
    assert.deepEqual(result.wins, [0, 0]);
    assert.deepEqual(result.biggestWins, [null, null]);
  }
});
