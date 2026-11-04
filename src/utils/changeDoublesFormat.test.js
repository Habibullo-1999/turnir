import test from 'node:test';
import assert from 'node:assert/strict';
import { changeDoublesFormat } from './changeDoublesFormat.js';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { americanoReturnPairs } from './americano.js';
import { FOOTBALL_DOUBLES } from './sportConfig.js';

function tournament(format = 'league', clubs = false) {
  return { ...buildTournamentPayload({
    name: 'Тест', sport: FOOTBALL_DOUBLES, format,
    participants: ['A', 'B', 'C', 'D', 'E'].map(name => ({ name })),
    ...(clubs ? { clubPool: ['Арсенал', 'Реал', 'Барселона', 'Ливерпуль'].map(club => ({ club })) } : {}),
  }), status: 'active' };
}
const matches = draft => draft.rounds.flatMap(round => round.matches);

test('league to one round keeps played return results and clubs and removes unplayed rematches', () => {
  for (const clubs of [false, true]) {
    const draft = tournament('league', clubs);
    const pairs = americanoReturnPairs(draft);
    Object.assign(pairs[0].first, { played: true, score1: 2, score2: 1 });
    Object.assign(pairs[1].second, { played: true, score1: 4, score2: 3 });
    const played = structuredClone(matches(draft).filter(match => match.played));
    changeDoublesFormat(draft, 'americano', 42);
    assert.equal(draft.format, undefined);
    assert.equal(matches(draft).length, 15);
    assert.deepEqual(matches(draft).filter(match => match.played), played);
    changeDoublesFormat(draft, 'league', 42);
    assert.equal(matches(draft).length, 30);
    assert.deepEqual(matches(draft).filter(match => match.played), played);
    assert.equal(americanoReturnPairs(draft).length, 15);
  }
});

test('one round to league completes all fixtures without losing original results', () => {
  const draft = tournament('americano');
  Object.assign(matches(draft)[0], { played: true, score1: 1, score2: 0 });
  const played = structuredClone(matches(draft)[0]);
  changeDoublesFormat(draft, 'league');
  assert.equal(matches(draft).length, 30);
  assert.deepEqual(matches(draft).find(match => match.played), played);
});

test('rejects losing one of two played meetings atomically, invalid modes and finished tournaments', () => {
  const draft = tournament();
  const { first, second } = americanoReturnPairs(draft)[0];
  Object.assign(first, { played: true, score1: 1, score2: 0 });
  Object.assign(second, { played: true, score1: 2, score2: 0 });
  const before = structuredClone(draft);
  assert.throws(() => changeDoublesFormat(draft, 'americano'), /Обе встречи/);
  assert.deepEqual(draft, before);
  assert.throws(() => changeDoublesFormat(draft, 'invalid'), /Неизвестный/);
  assert.throws(() => changeDoublesFormat({ ...draft, status: 'finished' }, 'americano'), /активного/);
  changeDoublesFormat(draft, 'league');
  assert.deepEqual(draft, before);
});
