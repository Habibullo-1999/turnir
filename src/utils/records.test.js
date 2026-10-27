import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRecords } from './records.js';
import { SPORT_CONFIG, FOOTBALL, FOOTBALL_REAL, TT_SINGLES, TT_DOUBLES, TURNIK } from './sportConfig.js';

const byId = records => Object.fromEntries(records.map(r => [r.id, r]));

function realMatch(playedAt, scores, red, blue) {
  return {
    id: String(playedAt), sport: FOOTBALL_REAL, status: 'finished', playedAt, scores,
    teams: [
      { name: 'Красные', players: Object.keys(red.players), goals: red.goals || {}, assists: red.assists || {}, ownGoals: red.ownGoals || {} },
      { name: 'Синие', players: Object.keys(blue.players), goals: blue.goals || {}, assists: blue.assists || {} },
    ],
  };
}

test('empty history has no records', () => {
  assert.deepEqual(computeRecords([], SPORT_CONFIG[FOOTBALL_REAL]), []);
});

test('real football: match, player and streak records in playing order', () => {
  const p = { Али: 1, Олег: 1 };
  const q = { Иван: 1, Антон: 1 };
  // История приходит от новых к старым — порядок массива не хронологический.
  const history = [
    realMatch(3000, [1, 1], { players: p, goals: { Али: 1 } }, { players: q, goals: { Иван: 1 } }),
    realMatch(1000, [5, 0], { players: p, goals: { Али: 3, Олег: 2 }, assists: { Олег: 2 } }, { players: q }),
    realMatch(2000, [2, 4], { players: p, goals: { Али: 2 }, ownGoals: { Олег: 1 } }, { players: q, goals: { Иван: 3 } }),
  ];
  const r = byId(computeRecords(history, SPORT_CONFIG[FOOTBALL_REAL]));

  assert.equal(r['top-match'].value, '6 голов');
  assert.deepEqual(r['top-match'].holders, ['Красные 2:4 Синие']);
  assert.equal(r['biggest-win'].value, '+5');
  assert.equal(r['goals-in-match'].value, '3 гола');
  assert.deepEqual(r['goals-in-match'].holders.sort(), ['Али', 'Иван']); // ничья в рекорде — оба
  assert.equal(r['goals-in-match'].detail, null);
  assert.deepEqual(r['hat-tricks'].holders.sort(), ['Али', 'Иван']);
  assert.equal(r['assists-in-match'].value, '2 паса');
  assert.equal(r['win-streak'].value, '1 матч');
  // Синие: поражение (1000), победа (2000), ничья (3000) → 2 без поражений.
  assert.equal(r.unbeaten.value, '2 матча');
  assert.deepEqual(r.unbeaten.holders.sort(), ['Антон', 'Иван']);
  assert.deepEqual(r['clean-sheets'].holders.sort(), ['Али', 'Олег']);
  assert.equal(r['iron-man'].value, '3 матча');
  assert.deepEqual(r['own-goals'].holders, ['Олег']);
});

function fifa(id, finishedAt, winner, extra) {
  return { id, name: `Кубок ${id}`, sport: FOOTBALL, status: 'finished', finishedAt, winner, players: ['A', 'B', 'C', 'D'], ...extra };
}

test('bracket: skips BYE/unplayed, counts penalties, streaks across tournaments', () => {
  const history = [
    fifa('3', 3000, 'C', {
      rounds: [[{ t1: 'C', t2: 'A', score1: 2, score2: 2, pen1: 4, pen2: 3, winner: 'C' }]],
    }),
    fifa('1', 1000, 'A', {
      groups: [{ name: 'Лига', players: ['A', 'B'], matches: [
        { t1: 'A', t2: 'B', score1: 6, score2: 0, played: true },
        { t1: 'B', t2: 'A', score1: null, score2: null, played: false },
      ] }],
      rounds: [[{ t1: 'A', t2: 'BYE', score1: null, score2: null, winner: 'A' }]],
    }),
    fifa('2', 2000, 'A', {
      rounds: [[{ t1: 'A', t2: 'B', score1: 3, score2: 1, winner: 'A' }]],
    }),
    // Старая запись без сырых матчей — только кеш stats.
    { id: '0', name: 'Старый', sport: FOOTBALL, status: 'finished', finishedAt: 500, winner: 'B', stats: { B: { goalsFor: 9, goalsAgainst: 1, wins: 3, played: 3 } } },
  ];
  const r = byId(computeRecords(history, SPORT_CONFIG[FOOTBALL]));

  assert.equal(r['top-match'].value, '6 голов'); // 6:0, BYE не считается
  assert.equal(r['biggest-win'].value, '+6');
  assert.equal(r['biggest-win'].detail, 'Кубок 1');
  assert.equal(r['win-streak'].value, '2 матча'); // A: 6:0, 3:1, затем поражение по пенальти
  assert.deepEqual(r['champion-streak'].holders, ['A']);
  assert.equal(r['champion-streak'].value, '2 турнира'); // B (старый) → A → A → C
  assert.equal(r['scored-in-tournament'].value, '9 голов');
  assert.deepEqual(r['scored-in-tournament'].holders, ['B']);
  assert.equal(r['conceded-in-tournament'].value, '6 голов');
  assert.deepEqual(r['clean-wins'].holders, ['A']);
  assert.deepEqual(r['penalty-king'].holders, ['C']);
});

test('table tennis singles uses sets and has no penalty record', () => {
  const history = [{
    id: '1', name: 'Пинг', sport: TT_SINGLES, status: 'finished', finishedAt: 1, winner: 'A', players: ['A', 'B'],
    rounds: [[{ t1: 'A', t2: 'B', score1: 3, score2: 0, winner: 'A' }]],
  }];
  const r = byId(computeRecords(history, SPORT_CONFIG[TT_SINGLES]));
  assert.equal(r['top-match'].value, '3 сета');
  assert.equal(r['clean-wins'].title, 'Победы всухую');
  assert.equal(r['penalty-king'], undefined);
});

test('americano: matches, best duo, streak and points in a tournament', () => {
  const history = [{
    id: '1', name: 'Американо', sport: TT_DOUBLES, status: 'finished', finishedAt: 1, players: ['A', 'B', 'C', 'D'],
    rounds: [
      { matches: [{ pairA: ['A', 'B'], pairB: ['C', 'D'], score1: 11, score2: 3, played: true }], byes: [] },
      { matches: [{ pairA: ['A', 'B'], pairB: ['C', 'D'], score1: 11, score2: 9, played: true }], byes: [] },
      { matches: [{ pairA: ['A', 'C'], pairB: ['B', 'D'], score1: 5, score2: 11, played: true }], byes: [] },
    ],
  }];
  const r = byId(computeRecords(history, SPORT_CONFIG[TT_DOUBLES]));
  assert.equal(r['top-match'].value, '20 очков');
  assert.equal(r['biggest-win'].value, '+8');
  assert.deepEqual(r['best-duo'].holders, ['A & B']);
  assert.equal(r['best-duo'].value, '2 победы');
  assert.deepEqual(r['win-streak'].holders, ['B']);
  assert.equal(r['win-streak'].value, '3 матча');
  assert.deepEqual(r['points-in-tournament'].holders, ['B']); // 11 + 11 + 11
});

test('turnik: reps, longest tournament, champion streak, podiums, legacy elimination format', () => {
  const ladder = (id, finishedAt, round, eliminated) => ({
    id, name: `Турник ${id}`, sport: TURNIK, status: 'finished', finishedAt, round,
    players: ['A', 'B', 'C'], passed: { A: true }, eliminated,
  });
  const history = [
    ladder('2', 2000, 5, { B: { round: 5, reps: 3 }, C: { round: 2, reps: 0 } }),
    ladder('1', 1000, 3, { B: 3, C: 1 }), // старый формат: только номер раунда
  ];
  const r = byId(computeRecords(history, SPORT_CONFIG[TURNIK]));
  assert.equal(r['reps-in-tournament'].value, '15 подтягиваний'); // A: 1+…+5
  assert.deepEqual(r['reps-in-tournament'].holders, ['A']);
  assert.equal(r['longest-tournament'].value, '5 раундов');
  assert.equal(r['longest-tournament'].detail, '🏆 A');
  assert.equal(r['champion-streak'].value, '2 турнира');
  assert.equal(r.podiums.value, '2 раза');
  assert.equal(r['total-reps'].value, '21 подтягивание'); // A: 6 + 15
});
