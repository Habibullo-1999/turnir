import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, bumpAssist, bumpGoal, bumpOwnGoal, movePlayer, renameTeam, reshuffleTeams } from './teamMatchActions.js';
import { computeMatchStats, matchResult, validateMatch } from './teamMatchLog.js';
import { removeParticipant } from './removeParticipant.js';

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
    assert.deepEqual(
      { ...match.teams[1 - side], assists: undefined, ownGoals: undefined },
      { ...previous.teams[1 - side], assists: undefined, ownGoals: undefined },
    );
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

test('an assist does not change the score and survives other actions', () => {
  const match = activeMatch();
  bumpAssist(match, 0, 'Олег', 1);
  assert.deepEqual(match.scores, [3, 1]);
  renameTeam(match, 0, 'Красные+');
  assert.equal(match.teams[0].assists['Олег'], 1);
  bumpAssist(match, 0, 'Олег', -1);
  assert.equal(match.teams[0].assists['Олег'], undefined);
});

test('assists cannot exceed the team goals that are not opponent own goals', () => {
  const match = activeMatch();
  bumpOwnGoal(match, 1, 'Антон', 1); // голом без автора у Красных оказался автогол: счёт 3:1
  assert.deepEqual(match.scores, [3, 1]);
  for (let i = 0; i < 2; i++) bumpAssist(match, 0, 'Олег', 1);
  assert.throws(() => bumpAssist(match, 0, 'Олег', 1), /Пасов больше/);
  assert.equal(match.teams[0].assists['Олег'], 2);
});

test('an own goal goes to the opponent score and is removed only when fully attributed', () => {
  const match = activeMatch(); // 3:1, у Красных расписано 2 из 3
  bumpOwnGoal(match, 0, 'Олег', 1);
  assert.deepEqual(match.scores, [3, 2]); // у Синих было расписано всё → счёт подтянулся
  bumpOwnGoal(match, 0, 'Олег', -1);
  assert.deepEqual(match.scores, [3, 1]);

  match.scores = [3, 3]; // у Синих 2 гола без автора
  bumpOwnGoal(match, 0, 'Олег', 1);
  assert.deepEqual(match.scores, [3, 3]);
  bumpOwnGoal(match, 0, 'Олег', -1);
  assert.deepEqual(match.scores, [3, 3]);
});

test('validation counts opponent own goals and rejects extra assists', () => {
  const match = activeMatch();
  match.teams[1].ownGoals = { Иван: 2 }; // Красным расписано 2 + 2 = 4 > 3
  assert.match(validateMatch(match), /расписано 4 гола, а команда забила 3/);
  match.teams[1].ownGoals = {};
  match.teams[0].assists = { Олег: 4 };
  assert.match(validateMatch(match), /расписано 4 паса/);
  match.teams[0].assists = { Олег: 2 };
  assert.equal(validateMatch(match), null);
});

test('moving a player carries assists and swaps own goal credit between scores', () => {
  const match = activeMatch(); // 3:1
  bumpOwnGoal(match, 0, 'Олег', 1); // 3:2
  bumpAssist(match, 0, 'Олег', 1);
  movePlayer(match, 'Олег', 1);
  assert.equal(match.teams[1].assists['Олег'], 1);
  assert.equal(match.teams[1].ownGoals['Олег'], 1);
  assert.equal(match.teams[0].ownGoals['Олег'], undefined);
  assert.deepEqual(match.scores, [4, 1]); // автогол теперь в пользу Красных
});

test('removing a player drops their assists and own goals from both scores', () => {
  const match = activeMatch(); // 3:1
  bumpOwnGoal(match, 0, 'Олег', 1); // 3:2
  bumpAssist(match, 0, 'Олег', 1);
  removeParticipant(match, 'Олег');
  assert.deepEqual(match.scores, [3, 1]);
  assert.equal(match.teams[0].assists['Олег'], undefined);
  assert.equal(match.teams[0].ownGoals['Олег'], undefined);
});

test('stats and top assist read Firebase-shaped data with missing fields', () => {
  const match = {
    ...activeMatch(),
    scores: { 0: 3, 1: 1 },
    teams: {
      0: { name: 'Красные', players: { 0: 'Али', 1: 'Олег' }, goals: { Али: 2 }, assists: { Олег: 2 } },
      1: { name: 'Синие', players: ['Иван', 'Антон'], ownGoals: { Антон: 1 } },
    },
  };
  const rows = computeMatchStats(match);
  assert.equal(rows.find(r => r.name === 'Олег').assists, 2);
  assert.equal(rows.find(r => r.name === 'Антон').ownGoals, 1);
  assert.equal(rows.find(r => r.name === 'Иван').goals, 0);
  assert.equal(matchResult(match).topAssist.name, 'Олег');
  assert.equal(matchResult({ ...activeMatch() }).topAssist, null);
});
