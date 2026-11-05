import test from 'node:test';
import assert from 'node:assert/strict';
import { addParticipant } from './participantActions.js';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { calcStandings, computeGroupTours, computeLeagueTours } from './groups.js';
import { confirmGroupScore, advanceGroupsToPlayoff } from './matchActions.js';
import { computeTournamentResult } from './computeStats.js';
import { FOOTBALL_DOUBLES, TT_DOUBLES } from './sportConfig.js';
import { removeParticipant } from './removeParticipant.js';
import { americanoReturnPairs, calcAmericanoStandings, interleaveAmericanoRounds, orderedAmericanoRounds } from './americano.js';

const hasNewPlayer = round => round.matches.some(match => [...match.pairA, ...match.pairB].includes('Новый'));

test('interleaving keeps the completed prefix and puts new rounds between future fixtures', () => {
  const existing = Array.from({ length: 5 }, (_, index) => ({ matches: [{ played: index < 2 }] }));
  const added = [{ matches: [{ played: false }] }];
  assert.deepEqual(interleaveAmericanoRounds(existing, added), [existing[0], existing[1], added[0], ...existing.slice(2)]);
  assert.deepEqual(interleaveAmericanoRounds([], added), added);
  const completed = existing.slice(0, 2);
  assert.deepEqual(interleaveAmericanoRounds(completed, added), [...completed, ...added]);
});

test('legacy additional rounds display inside regular legs without changing stored match indices', () => {
  const original = Array.from({ length: 4 }, () => ({ matches: [{ played: false }] }));
  const first = { additionalLeg: 1, matches: [{ played: false }] };
  const second = { additionalLeg: 2, matches: [{ played: false }] };
  const draft = { rounds: [...original, first, second] };
  const before = structuredClone(draft);
  const ordered = orderedAmericanoRounds(draft);
  assert.deepEqual(ordered, [original[0], first, original[1], original[2], second, original[3]]);
  assert.equal(draft.rounds.indexOf(ordered[1]), 4);
  assert.equal(draft.rounds.indexOf(ordered[4]), 5);
  assert.deepEqual(draft, before);
});

test('league interleaving rotates a four-club pool and preserves a played match across seeds', () => {
  const draft = {
    ...buildTournamentPayload({
      name: '2×2', sport: FOOTBALL_DOUBLES, format: 'league',
      participants: ['A', 'B', 'C', 'D'].map(name => ({ name })),
      clubPool: Array.from({ length: 4 }, (_, i) => ({ club: `Клуб ${i}` })),
    }),
    status: 'active',
  };
  Object.assign(draft.rounds[0].matches[0], { played: true, score1: 2, score2: 1 });
  for (let seed = 0; seed < 20; seed++) {
    const next = structuredClone(draft);
    addParticipant(next, { name: 'Новый' }, seed);
    assert.deepEqual(next.rounds[0], { ...draft.rounds[0], byes: ['Новый'] });
    const previous = new Map();
    for (const round of next.rounds.slice(0, next.rounds.length / 2)) for (const match of round.matches) {
      assert.notEqual(match.clubA.club, match.clubB.club);
      for (const [pair, club] of [[match.pairA, match.clubA.club], [match.pairB, match.clubB.club]]) {
        for (const player of pair) {
          assert.notEqual(previous.get(player), club);
          previous.set(player, club);
        }
      }
    }
    for (const { first, second } of americanoReturnPairs(next)) {
      assert.deepEqual(second.clubA, first.clubB);
      assert.deepEqual(second.clubB, first.clubA);
    }
  }
});

function doublesTournament(count = 4, format, sport = FOOTBALL_DOUBLES) {
  return {
    ...buildTournamentPayload({ name: '2×2', sport, format, participants: Array.from({ length: count }, (_, i) => ({ name: `Игрок ${i + 1}` })) }),
    id: 'doubles', status: 'active',
  };
}

test('adding to doubles interleaves new-player matches and preserves every existing fixture and result', () => {
  for (const count of [4, 5, 7, 8]) {
    const draft = doublesTournament(count);
    Object.assign(draft.rounds[0].matches[0], { played: true, score1: 2, score2: 1 });
    Object.assign(draft, { winner: 'old', stats: {}, finishedAt: 1, date: 'old' });
    const before = structuredClone(draft);
    addParticipant(draft, { name: ' Новый ' }, 123);
    assert.deepEqual(draft.rounds.filter(round => !hasNewPlayer(round)).map(round => round.matches), before.rounds.map(round => round.matches));
    assert.ok(hasNewPlayer(draft.rounds[1]));
    assert.ok(!hasNewPlayer(draft.rounds[0]));
    assert.equal(draft.id, 'doubles');
    assert.equal(draft.status, 'active');
    assert.equal(draft.players.length, count + 1);
    assert.ok(draft.players.includes('Новый'));
    for (const round of draft.rounds) {
      const scheduled = [...round.byes];
      for (const match of round.matches) {
        assert.equal(match.pairA.length, 2);
        assert.equal(match.pairB.length, 2);
        if (hasNewPlayer(round)) {
          assert.ok([...match.pairA, ...match.pairB].includes('Новый'));
          assert.equal(match.played, false);
          assert.equal(match.score1, null);
          assert.equal(match.score2, null);
        }
        scheduled.push(...match.pairA, ...match.pairB);
      }
      assert.deepEqual(scheduled.sort(), [...draft.players].sort());
    }
    const partners = draft.rounds.filter(hasNewPlayer).flatMap(round => round.matches.flatMap(match =>
      [match.pairA, match.pairB].filter(pair => pair.includes('Новый')).flatMap(pair => pair.filter(player => player !== 'Новый')),
    ));
    assert.deepEqual([...new Set(partners)].sort(), [...before.players].sort());
    const n = draft.players.length;
    assert.equal(draft.rounds.flatMap(round => round.matches).length, n * (n - 1) * (n - 2) * (n - 3) / 8);
    for (const key of ['winner', 'stats', 'finishedAt', 'date']) assert.equal(Object.hasOwn(draft, key), false);
  }
});

test('doubles addition replays deterministically and preserves the separate return leg', () => {
  const draft = doublesTournament(4, 'league');
  const before = structuredClone(draft);
  const replay = structuredClone(draft);
  addParticipant(draft, { name: 'Новый' }, 456);
  addParticipant(replay, { name: 'Новый' }, 456);
  assert.deepEqual(draft, replay);
  assert.equal(draft.rounds.length, 30);
  assert.deepEqual(draft.rounds.filter(round => !hasNewPlayer(round)).map(round => round.matches), before.rounds.map(round => round.matches));
  const half = draft.rounds.length / 2;
  assert.ok(draft.rounds.slice(0, half).some(hasNewPlayer));
  assert.ok(draft.rounds.slice(half).some(hasNewPlayer));
  for (let i = 0; i < half; i++) {
    assert.equal(Object.hasOwn(draft.rounds[i], 'additionalLeg'), false);
    assert.deepEqual(draft.rounds[i + half].byes, draft.rounds[i].byes);
    draft.rounds[i].matches.forEach((match, j) => {
      assert.deepEqual(draft.rounds[i + half].matches[j].pairA, match.pairB);
      assert.deepEqual(draft.rounds[i + half].matches[j].pairB, match.pairA);
    });
  }
});

test('doubles rejects invalid additions without modifying the tournament', () => {
  for (const name of ['', '   ', 'Игрок 1', 'BYE', '__proto__']) {
    const draft = doublesTournament();
    const before = structuredClone(draft);
    assert.throws(() => addParticipant(draft, { name }));
    assert.deepEqual(draft, before);
  }
  const draft = { ...doublesTournament(), status: 'finished' };
  const before = structuredClone(draft);
  assert.throws(() => addParticipant(draft, { name: 'Новый' }));
  assert.deepEqual(draft, before);
});

test('doubles preserves played clubs and reassigns unplayed clubs when interleaving matches', () => {
  const clubs = Array.from({ length: 4 }, (_, i) => ({ club: `Клуб ${i}` }));
  const draft = { ...doublesTournament(), clubPool: clubs };
  for (const round of draft.rounds) for (const match of round.matches) {
    match.clubA = clubs[0];
    match.clubB = clubs[1];
  }
  Object.assign(draft.rounds[0].matches[0], { played: true, score1: 3, score2: 1 });
  const played = structuredClone(draft.rounds[0].matches[0]);
  addParticipant(draft, { name: 'Новый' }, 1);
  assert.deepEqual(draft.rounds[0].matches[0], played);
  assert.deepEqual(draft.clubPool, clubs);
  assert.ok(draft.rounds.every(round => round.matches.every(match => match.clubA && match.clubB && match.clubA.club !== match.clubB.club)));
  const larger = { ...doublesTournament(7), clubPool: clubs };
  addParticipant(larger, { name: 'Новый' }, 1);
  assert.equal(larger.players.length, 8);
  const tooFewClubs = { ...doublesTournament(7), clubPool: clubs.slice(0, 3) };
  const before = structuredClone(tooFewClubs);
  assert.throws(() => addParticipant(tooFewClubs, { name: 'Новый' }, 1), /минимум 4/);
  assert.deepEqual(tooFewClubs, before);
});

test('table tennis doubles preserves existing fixtures when adding a participant', () => {
  const draft = doublesTournament(6, undefined, TT_DOUBLES);
  const matches = structuredClone(draft.rounds.map(round => round.matches));
  addParticipant(draft, { name: 'Новый' }, 123);
  assert.equal(draft.players.length, 7);
  assert.deepEqual(draft.rounds.filter(round => !hasNewPlayer(round)).map(round => round.matches), matches);
});

test('removing an unplayed addition restores the original doubles schedule and statistics', () => {
  for (const format of [undefined, 'league']) {
    const draft = doublesTournament(4, format);
    Object.assign(draft.rounds[0].matches[0], { played: true, score1: 3, score2: 1 });
    const before = structuredClone(draft);
    addParticipant(draft, { name: 'Новый' }, 42);
    removeParticipant(draft, 'Новый');
    assert.deepEqual(draft.rounds, before.rounds);
    assert.deepEqual(draft.players, before.players);
    assert.deepEqual(calcAmericanoStandings(draft), calcAmericanoStandings(before));
  }
});

test('removing a played addition cancels only their matches and statistics', () => {
  const draft = doublesTournament(4);
  Object.assign(draft.rounds[0].matches[0], { played: true, score1: 3, score2: 1 });
  const before = structuredClone(draft);
  addParticipant(draft, { name: 'Новый' }, 42);
  Object.assign(draft.rounds.find(hasNewPlayer).matches[0], { played: true, score1: 9, score2: 0 });
  removeParticipant(draft, 'Новый');
  assert.deepEqual(draft.rounds, before.rounds);
  assert.deepEqual(calcAmericanoStandings(draft), calcAmericanoStandings(before));
});

const club = { club: 'Реал Мадрид', league: 'Ла Лига', flag: '🇪🇸', icon: '' };

test('a doubles addition extends the shared club pool without changing played matches or duplicating clubs', () => {
  const clubs = Array.from({ length: 4 }, (_, i) => ({ club: `Клуб ${i}` }));
  const draft = { ...doublesTournament(4, 'league'), clubPool: clubs };
  Object.assign(draft.rounds[0].matches[0], {
    played: true, score1: 3, score2: 1, clubA: clubs[0], clubB: clubs[1],
  });
  const played = structuredClone(draft.rounds[0].matches[0]);
  addParticipant(draft, { name: 'Новый', club }, 7);
  assert.equal(draft.clubPool.length, 5);
  assert.deepEqual(draft.clubPool[4], club);
  assert.deepEqual(draft.rounds.flatMap(round => round.matches).find(match => match.played), played);
  assert.equal(draft.participantMeta['Новый'], undefined);
  const duplicate = { ...doublesTournament(4, 'league'), clubPool: clubs };
  addParticipant(duplicate, { name: 'Новый', club: { club: ' клуб 0 ' } }, 7);
  assert.equal(duplicate.clubPool.length, 4);
});

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
