import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceTeams, computePlayerRatings, findPreviousTeams, ratingMatches } from './teamBalance.js';
import { applyTeams } from './teamMatchActions.js';

const players = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const previousTeams = [
  { name: 'Красные', players: ['A', 'B', 'C', 'D'] },
  { name: 'Синие', players: ['E', 'F', 'G', 'H'] },
];

function changes(teams, old) {
  return Math.min(...[[0, 1], [1, 0]].flatMap(([x, y]) => [
    teams[0].filter(p => !old[x].players.includes(p)).length,
    teams[1].filter(p => !old[y].players.includes(p)).length,
  ]));
}

test('ratings use finished and started open matches, skip empty open ones and the current match', () => {
  const base = { sport: 'football-real', teams: previousTeams };
  const all = [
    { ...base, id: '1', status: 'finished', scores: [3, 0], teams: [{ ...previousTeams[0], goals: { A: 3 } }, previousTeams[1]] },
    { ...base, id: '2', status: 'active', scores: [1, 0] },
    { ...base, id: '3', status: 'active', scores: [0, 0] },
    { ...base, id: 'current', status: 'finished', scores: [9, 0] },
    { ...base, id: '4', sport: 'football-2x2', status: 'finished', scores: [5, 0] },
  ];
  const matches = ratingMatches(all, 'current');
  assert.deepEqual(matches.map(m => m.id), ['1', '2']);
  const ratings = computePlayerRatings(matches);
  assert.equal(ratings.A.games, 2);
  assert.ok(ratings.A.rating > ratings.B.rating);
  assert.ok(ratings.B.rating > 0 && ratings.E.rating < 0);
});

test('splits strong players apart and changes at least two players in each team', () => {
  const ratings = Object.fromEntries(players.map((p, i) => [p, { rating: 8 - i, games: 5 }]));
  for (let i = 0; i < 50; i++) {
    const { teams, strength } = balanceTeams(players, ratings, previousTeams, previousTeams);
    assert.deepEqual(teams.flat().sort(), players);
    assert.equal(teams[0].length, 4);
    assert.ok(Math.abs(strength[0] - strength[1]) <= 2);
    assert.ok(changes(teams, previousTeams) >= 2);
  }
});

test('repeated presses do not keep producing the same lineup', () => {
  const ratings = Object.fromEntries(players.map(p => [p, { rating: 1, games: 3 }]));
  let current = previousTeams;
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const { teams } = balanceTeams(players, ratings, previousTeams, current);
    assert.ok(changes(teams, current) >= 2);
    assert.ok(changes(teams, previousTeams) >= 2);
    current = teams.map(roster => ({ players: roster }));
    seen.add(teams.map(t => [...t].sort().join()).sort().join('|'));
  }
  assert.ok(seen.size > 2);
});

test('odd count, newcomers and tiny groups still work', () => {
  const { teams } = balanceTeams(['A', 'B', 'C', 'Новый', 'E'], { A: { rating: 3 } }, previousTeams);
  assert.equal(teams.flat().length, 5);
  assert.equal(Math.abs(teams[0].length - teams[1].length), 1);
  const small = balanceTeams(['A', 'B', 'E', 'F'], {}, previousTeams);
  assert.equal(small.teams.flat().length, 4);
});

test('previous teams come from the latest earlier match, including open ones', () => {
  const current = { id: 'c', playedAt: 100 };
  const all = [
    { id: 'old', sport: 'football-real', playedAt: 10, teams: [{ players: ['X'] }, { players: ['Y'] }] },
    { id: 'open', sport: 'football-real', status: 'active', playedAt: 50, teams: previousTeams },
    { id: 'later', sport: 'football-real', playedAt: 200, teams: [{ players: ['Z'] }, { players: ['W'] }] },
  ];
  assert.deepEqual(findPreviousTeams(all, current).map(t => t.players), previousTeams.map(t => t.players));
});

test('applyTeams keeps team names, resets goals and rejects stale rosters', () => {
  const draft = { status: 'active', players, scores: [2, 1], teams: [{ ...previousTeams[0], goals: { A: 2 } }, previousTeams[1]] };
  applyTeams(draft, [['A', 'E', 'B', 'F'], ['C', 'G', 'D', 'H']]);
  assert.equal(draft.teams[0].name, 'Красные');
  assert.deepEqual(draft.teams[0].goals, {});
  assert.deepEqual(draft.scores, [0, 0]);
  assert.throws(() => applyTeams(draft, [['A'], ['B']]), /изменился/);
});

test('hidden stamina balances players with equal history', () => {
  const ratings = Object.fromEntries(players.map(p => [p, { rating: 0, games: 4 }]));
  const stamina = { A: 10, B: 10, C: 10, D: 10, E: 2, F: 2, G: 2, H: 2 };
  for (let i = 0; i < 30; i++) {
    const { teams, strength } = balanceTeams(players, ratings, [], [], { stamina });
    assert.equal(teams[0].filter(p => stamina[p] === 10).length, 2);
    assert.ok(Math.abs(strength[0] - strength[1]) < 1e-9);
  }
});
