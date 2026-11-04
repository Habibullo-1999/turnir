import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTeams, getPreviousRealMatch } from './teamMatchLog.js';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { reshuffleTeams } from './teamMatchActions.js';

const previousTeams = [
  { name: 'Красные', players: ['A', 'B', 'C', 'D'] },
  { name: 'Синие', players: ['E', 'F', 'G', 'H'] },
];

function repeatCount(teams, previous) {
  return teams.reduce((total, team) => total + previous.reduce((sum, old) => {
    const count = team.players.filter(player => old.players.includes(player)).length;
    return sum + count * (count - 1) / 2;
  }, 0), 0);
}

test('chooses the latest real match including active ones, ignoring other sports and missing rosters', () => {
  const finished = { id: '1', sport: 'football-real', status: 'finished', playedAt: 10, teams: previousTeams };
  const active = { ...finished, id: '2', status: 'active', playedAt: 20 };
  assert.equal(getPreviousRealMatch([
    active, finished, { ...active, playedAt: 30, sport: 'football-2x2' },
    { ...active, playedAt: 40, teams: null },
  ]), active);
  assert.equal(getPreviousRealMatch([]), null);
});

test('balances new rosters and achieves the minimum repeated teammate pairs for changed and odd attendance', () => {
  const rosters = [
    ['A', 'B', 'C', 'E', 'F'],
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    ['A', 'B', 'C', 'E', 'F', 'G', 'Новый'],
    ['A', 'B', 'Новый', 'Другой'],
  ];
  for (const players of rosters) {
    let minimum = Infinity;
    for (let mask = 0; mask < 2 ** players.length; mask++) {
      const teams = [0, 1].map(side => ({ players: players.filter((_, index) => ((mask >> index) & 1) === side) }));
      if (Math.abs(teams[0].players.length - teams[1].players.length) <= 1) {
        if (teams.some((team, side) => team.players.filter(player => !previousTeams[side].players.includes(player)).length < 2)) continue;
        if (teams[0].players.every(player => previousTeams[1].players.includes(player)) && teams[1].players.every(player => previousTeams[0].players.includes(player))) continue;
        minimum = Math.min(minimum, repeatCount(teams, previousTeams));
      }
    }
    for (let iteration = 0; iteration < 30; iteration++) {
      const teams = buildTeams(players, previousTeams);
      assert.deepEqual(teams.flatMap(team => team.players).sort(), [...players].sort());
      assert.ok(Math.abs(teams[0].players.length - teams[1].players.length) <= 1);
      assert.equal(repeatCount(teams, previousTeams), minimum);
      teams.forEach((team, side) => assert.ok(team.players.filter(player => !previousTeams[side].players.includes(player)).length >= 2));
    }
  }
});

test('creation and subsequent reshuffles keep using the previous match without mutating it', () => {
  const previousMatch = { id: 'previous', teams: previousTeams };
  const before = structuredClone(previousMatch);
  const draft = { ...buildTournamentPayload({
    name: 'Новый матч', sport: 'football-real', previousMatch,
    participants: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(name => ({ name })),
  }), status: 'active' };
  assert.equal(draft.previousMatchId, 'previous');
  for (let iteration = 0; iteration < 20; iteration++) {
    assert.equal(repeatCount(draft.teams, previousTeams), 4);
    reshuffleTeams(draft);
  }
  assert.deepEqual(previousMatch, before);
});

test('first match without history still includes everyone with balanced rosters', () => {
  const teams = buildTeams(['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(teams.flatMap(team => team.players).sort(), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(Math.abs(teams[0].players.length - teams[1].players.length), 1);
});

test('rejects a four-player rematch when only a complete side swap could replace two players', () => {
  assert.throws(() => buildTeams(['A', 'B', 'E', 'F'], previousTeams), /минимум двух/);
});
