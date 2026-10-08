import test from 'node:test';
import assert from 'node:assert/strict';
import { addParticipant } from './participantActions.js';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { calcStandings, computeGroupTours, computeLeagueTours } from './groups.js';
import { confirmGroupScore, advanceGroupsToPlayoff } from './matchActions.js';
import { computeTournamentResult } from './computeStats.js';

const club = { club: 'Реал Мадрид', league: 'Ла Лига', flag: '🇪🇸', icon: '' };

function tournament(format, count = 4) {
  return {
    ...buildTournamentPayload({ name: 'Кубок', sport: 'football', format, participants: Array.from({ length: count }, (_, i) => ({ name: `Игрок ${i + 1}` })) }),
    id: 'existing-tournament',
    status: 'active',
  };
}

test('adds to a selected group and preserves all existing results and draw order', () => {
  const draft = tournament('group', 6);
  confirmGroupScore(draft, 1, 0, 3, 1);
  const before = structuredClone(draft);
  addParticipant(draft, { name: '  Новый  ', club, groupIndex: 1 });

  assert.deepEqual(draft.groups[0], before.groups[0]);
  assert.deepEqual(draft.groups[1].matches.slice(0, before.groups[1].matches.length), before.groups[1].matches);
  assert.deepEqual(draft.groups[1].tieBreakOrder, [...before.groups[1].tieBreakOrder, 'Новый']);
  assert.deepEqual(draft.participantMeta['Новый'], club);
  assert.equal(draft.groups[1].matches.length, before.groups[1].matches.length + before.groups[1].players.length);
  assert.equal(calcStandings(draft.groups[1]).find(row => row.name === 'Новый').played, 0);
  assert.equal(computeTournamentResult(draft).stats['Новый'].played, 0);
  assert.equal(computeGroupTours(draft.groups[1]).flat().length, draft.groups[1].matches.length);
  assert.equal(draft.id, before.id);
});

test('adds both home and away fixtures in the football league without resetting scores', () => {
  const draft = tournament('league');
  confirmGroupScore(draft, 0, 0, 2, 2);
  const before = structuredClone(draft);
  addParticipant(draft, { name: 'Новый', club });
  const group = draft.groups[0];

  assert.deepEqual(group.matches.slice(0, before.groups[0].matches.length), before.groups[0].matches);
  for (const opponent of before.players) {
    assert.equal(group.matches.filter(match => match.t1 === opponent && match.t2 === 'Новый').length, 1);
    assert.equal(group.matches.filter(match => match.t1 === 'Новый' && match.t2 === opponent).length, 1);
  }
  const scheduled = computeLeagueTours(group).flat();
  assert.equal(scheduled.length, group.matches.length);
  assert.equal(new Set(scheduled).size, group.matches.length);
});

test('fills a BYE in an unplayed playoff and removes outdated auto-advancement', () => {
  const draft = tournament('playoff', 3);
  const before = structuredClone(draft);
  addParticipant(draft, { name: 'Новый', club });
  assert.deepEqual(draft.rounds[0].flatMap(match => [match.t1, match.t2]), before.rounds[0].flatMap(match => [match.t1, match.t2]).map(name => name === 'BYE' ? 'Новый' : name));
  assert.equal(draft.rounds.length, before.rounds.length);
  assert.ok(draft.rounds[0].every(match => match.winner === null));
  assert.equal(draft.rounds[1][0].t1, null);
  assert.equal(draft.rounds[1][0].t2, null);
});

test('expands a full unplayed playoff while preserving existing first-round pairs', () => {
  const draft = tournament('playoff');
  const before = structuredClone(draft);
  addParticipant(draft, { name: 'Новый' });
  assert.deepEqual(draft.rounds[0].slice(0, before.rounds[0].length), before.rounds[0]);
  assert.equal(draft.rounds.length, 3);
  assert.equal(draft.rounds[0].flatMap(match => [match.t1, match.t2]).filter(name => name === 'Новый').length, 1);
  assert.equal(draft.roundLabels.length, draft.rounds.length);
});

test('rejects additions to a started playoff or after group qualification without changing data', () => {
  const playoff = tournament('playoff');
  playoff.rounds[0][0].score1 = 1;
  playoff.rounds[0][0].score2 = 0;
  const qualified = tournament('group+playoff');
  advanceGroupsToPlayoff(qualified);
  for (const draft of [playoff, qualified]) {
    const before = structuredClone(draft);
    assert.throws(() => addParticipant(draft, { name: 'Новый', club }));
    assert.deepEqual(draft, before);
  }
});

test('rejects invalid participants, groups and finished tournaments without changing data', () => {
  for (const participant of [{ name: '  ' }, { name: 'Игрок 1' }, { name: 'BYE' }, { name: '__proto__' }, { name: 'Новый', groupIndex: -1 }, { name: 'Новый', groupIndex: null }, { name: 'Новый', groupIndex: 99 }]) {
    const draft = tournament('group');
    const before = structuredClone(draft);
    assert.throws(() => addParticipant(draft, participant));
    assert.deepEqual(draft, before);
  }
  const draft = { ...tournament('league'), status: 'finished' };
  const before = structuredClone(draft);
  assert.throws(() => addParticipant(draft, { name: 'Новый' }));
  assert.deepEqual(draft, before);
});

test('supports legacy football metadata and clears stale summaries on a reopened tournament', () => {
  const draft = tournament('league');
  delete draft.sport;
  delete draft.participantMeta;
  draft.playerMeta = { 'Игрок 1': club };
  Object.assign(draft, { winner: 'Игрок 1', stats: {}, finishedAt: 123, date: '01.01.2026' });
  addParticipant(draft, { name: 'Новый', club });
  assert.deepEqual(draft.participantMeta, { 'Игрок 1': club, Новый: club });
  for (const key of ['winner', 'stats', 'finishedAt', 'date']) assert.equal(Object.hasOwn(draft, key), false);
});
