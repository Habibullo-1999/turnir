import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, bumpGoal, reshuffleTeams } from './teamMatchActions.js';
import { computeMatchStats } from './teamMatchLog.js';

function activeMatch() {
  return {
    id: 'existing-match',
    sport: 'football-real',
    status: 'active',
    players: ['Али', 'Олег', 'Иван', 'Антон'],
    scores: [3, 1],
    teams: [
      { name: 'Красные', players: ['Али', 'Олег'], goals: { Али: 2 } },
      { name: 'Синие', players: ['Иван', 'Антон'], goals: { Иван: 1 } },
    ],
  };
}

for (const side of [0, 1]) {
  test(`adds a player to side ${side} without changing existing results`, () => {
    const match = activeMatch();
    const previous = structuredClone(match);
    addPlayer(match, '  Джамшид  ', side);

    assert.deepEqual(match.players, [...previous.players, 'Джамшид']);
    assert.deepEqual(match.teams[side].players, [...previous.teams[side].players, 'Джамшид']);
    assert.deepEqual(match.teams[1 - side], previous.teams[1 - side]);
    assert.deepEqual(match.teams[side].goals, previous.teams[side].goals);
    assert.deepEqual(match.scores, previous.scores);
    assert.equal(match.id, previous.id);
    assert.equal(computeMatchStats(match).find(row => row.name === 'Джамшид').teamSide, side);

    bumpGoal(match, side, 'Джамшид', 1);
    assert.equal(match.teams[side].goals['Джамшид'], 1);
    reshuffleTeams(match);
    assert.equal(match.teams.flatMap(team => team.players).filter(name => name === 'Джамшид').length, 1);
  });
}

test('rejects empty names, duplicates and invalid teams without modifying the match', () => {
  for (const [name, side] of [['   ', 0], [' Али ', 1], ['Новый', null], ['Новый', -1], ['Новый', 2], ['Новый', '0']]) {
    const match = activeMatch();
    const previous = structuredClone(match);
    assert.throws(() => addPlayer(match, name, side));
    assert.deepEqual(match, previous);
  }
});

test('rejects players already in a roster even if missing from the participant list', () => {
  const match = activeMatch();
  match.players = match.players.filter(name => name !== 'Али');
  assert.throws(() => addPlayer(match, 'Али', 1), /уже добавлен/);
});

test('rejects additions to a finished match', () => {
  const match = { ...activeMatch(), status: 'finished' };
  const previous = structuredClone(match);
  assert.throws(() => addPlayer(match, 'Новый', 0), /верните матч в работу/);
  assert.deepEqual(match, previous);
});

test('handles Firebase object lists and empty goal maps', () => {
  const match = activeMatch();
  match.players = { 0: 'Али', 1: 'Олег', 2: 'Иван', 3: 'Антон' };
  match.teams = {
    0: { name: 'Красные', players: { 0: 'Али', 1: 'Олег' }, goals: null },
    1: { name: 'Синие', players: { 0: 'Иван', 1: 'Антон' }, goals: { Иван: 1 } },
  };
  addPlayer(match, 'Новый', 0);
  assert.deepEqual(match.players, ['Али', 'Олег', 'Иван', 'Антон', 'Новый']);
  assert.deepEqual(match.teams[0].players, ['Али', 'Олег', 'Новый']);
  assert.deepEqual(match.teams[0].goals, {});
  assert.deepEqual(match.scores, [3, 1]);
});
