import test from 'node:test';
import assert from 'node:assert/strict';
import { removeParticipant, getParticipantRemovalError } from './removeParticipant.js';
import { buildTournamentPayload } from './createTournamentPayload.js';
import { confirmBracketScore, confirmBracketPenalty, confirmGroupScore, advanceGroupsToPlayoff } from './matchActions.js';
import { buildRounds, propagateWinners } from './bracket.js';
import { calcStandings } from './groups.js';
import { calcAmericanoStandings } from './americano.js';
import { buildLadderRanking } from './ladder.js';
import { computeMatchStats } from './teamMatchLog.js';

function tournament(sport = 'football', format = 'league', count = 4) {
  return {
    ...buildTournamentPayload({ name: 'Кубок', sport, format, participants: Array.from({ length: count }, (_, i) => ({ name: `Игрок ${i + 1}` })) }),
    id: 'existing-tournament',
    status: 'active',
  };
}

function playoff(seeded) {
  const { rounds, roundLabels } = buildRounds(seeded);
  propagateWinners(rounds);
  return { sport: 'football', format: 'playoff', players: seeded.filter(name => name !== 'BYE'), rounds, roundLabels, status: 'active' };
}

test('removes league fixtures, metadata and statistics while retaining other results', () => {
  const draft = tournament();
  const player = draft.players[0];
  const group = draft.groups[0];
  const index = group.matches.findIndex(match => match.t1 !== player && match.t2 !== player);
  confirmGroupScore(draft, 0, index, 3, 1);
  const kept = structuredClone(group.matches[index]);
  draft.participantMeta[player] = { club: 'Реал' };
  draft.playerMeta = { [player]: { club: 'Реал' } };
  removeParticipant(draft, player);

  assert.equal(draft.players.includes(player), false);
  assert.equal(Object.hasOwn(draft.participantMeta, player), false);
  assert.equal(Object.hasOwn(draft.playerMeta, player), false);
  assert.ok(group.matches.some(match => JSON.stringify(match) === JSON.stringify(kept)));
  assert.equal(group.matches.length, 6);
  assert.ok(group.matches.every(match => match.t1 !== player && match.t2 !== player));
  assert.equal(group.tieBreakOrder.includes(player), false);
  assert.equal(calcStandings(group).length, 3);
});

test('supports singles tennis and all group formats', () => {
  for (const sport of ['football', 'table-tennis-1x1']) {
    for (const format of ['group', 'group+playoff', 'league']) {
      const draft = tournament(sport, format, 6);
      const player = draft.groups[0].players[0];
      const otherGroups = structuredClone(draft.groups.slice(1));
      removeParticipant(draft, player);
      assert.deepEqual(draft.groups.slice(1), otherGroups);
      assert.ok(draft.groups.every(group => !group.players.includes(player)));
      assert.equal(draft.players.length, 5);
    }
  }
});

test('removes a playoff winner and clears changed downstream pairings, retaining unrelated penalties', () => {
  const draft = playoff(['А', 'Б', 'В', 'Г']);
  confirmBracketScore(draft, 0, 0, 2, 1);
  confirmBracketPenalty(draft, 0, 1, 1, 1, 5, 4);
  confirmBracketScore(draft, 1, 0, 2, 0);
  draft.status = 'active';
  const otherMatch = structuredClone(draft.rounds[0][1]);
  removeParticipant(draft, 'А');

  assert.deepEqual(draft.rounds[0][1], otherMatch);
  assert.equal(draft.rounds[0][0].t1, 'BYE');
  assert.equal(draft.rounds[0][0].winner, 'Б');
  assert.equal(draft.rounds[1][0].t1, 'Б');
  assert.equal(draft.rounds[1][0].t2, 'В');
  assert.equal(draft.rounds[1][0].winner, null);
  assert.equal(draft.rounds[1][0].score1, null);
  assert.equal(draft.status, 'active');
  assert.equal(Object.hasOwn(draft, 'winner'), false);
  assert.ok(draft.rounds.flat().every(match => match.t1 !== 'А' && match.t2 !== 'А' && match.winner !== 'А'));
});

test('removing a playoff loser preserves an unchanged final and recomputes final statistics', () => {
  const draft = playoff(['А', 'Б', 'В', 'Г']);
  confirmBracketScore(draft, 0, 0, 2, 1);
  confirmBracketScore(draft, 0, 1, 2, 0);
  confirmBracketScore(draft, 1, 0, 3, 1);
  draft.status = 'active';
  const final = structuredClone(draft.rounds[1][0]);
  removeParticipant(draft, 'Б');
  assert.deepEqual(draft.rounds[1][0], final);
  assert.equal(draft.status, 'finished');
  assert.equal(draft.winner, 'А');
  assert.equal(Object.hasOwn(draft.stats, 'Б'), false);
  assert.equal(draft.stats['А'].played, 1);
});

test('recalculates lucky-loser advancement after removing a participant', () => {
  const draft = playoff(['А', 'Б', 'В', 'Г', 'Д', 'Е', 'BYE', 'BYE']);
  confirmBracketScore(draft, 0, 0, 3, 2);
  confirmBracketScore(draft, 0, 1, 4, 0);
  confirmBracketScore(draft, 0, 2, 2, 0);
  assert.equal(draft.rounds[1][1].t2, 'Б');
  removeParticipant(draft, 'Б');
  assert.equal(draft.rounds[1][1].t2, 'Е');
  assert.ok(draft.rounds.flat().every(match => match.t1 !== 'Б' && match.t2 !== 'Б' && match.winner !== 'Б'));
});

test('removes qualified participants from both groups and the playoff', () => {
  const draft = tournament('football', 'group+playoff', 6);
  advanceGroupsToPlayoff(draft);
  const player = draft.rounds[0][0].t1;
  removeParticipant(draft, player);
  assert.ok(draft.groups.every(group => !group.players.includes(player) && group.matches.every(match => match.t1 !== player && match.t2 !== player)));
  assert.ok(draft.rounds.flat().every(match => match.t1 !== player && match.t2 !== player));
});

test('removes a real football scorer and only their goals from the score', () => {
  const draft = tournament('football-real');
  const player = draft.teams[0].players[0];
  const teammate = draft.teams[0].players[1];
  draft.teams[0].goals = { [player]: 2, [teammate]: 1 };
  draft.scores = [5, 1];
  const otherTeam = structuredClone(draft.teams[1]);
  removeParticipant(draft, player);
  assert.deepEqual(draft.scores, [3, 1]);
  assert.deepEqual(draft.teams[0].goals, { [teammate]: 1 });
  assert.deepEqual(draft.teams[1], otherTeam);
  assert.equal(computeMatchStats(draft).some(row => row.name === player), false);
});

test('supports Firebase object lists and nullable goal maps', () => {
  const draft = tournament('football-real');
  const player = draft.teams[0].players[0];
  draft.players = Object.fromEntries(draft.players.map((name, i) => [i, name]));
  draft.teams = Object.fromEntries(draft.teams.map((team, i) => [i, { ...team, goals: null, players: Object.fromEntries(team.players.map((name, j) => [j, name])) }]));
  removeParticipant(draft, player);
  assert.equal(draft.players.length, 3);
  assert.deepEqual(draft.scores, [0, 0]);
  assert.equal(draft.teams[0].players.includes(player), false);
});

test('rebuilds Americano without deleted participants or stale results', () => {
  const draft = tournament('table-tennis-2x2');
  const player = draft.players[0];
  Object.assign(draft.rounds[0].matches[0], { played: true, score1: 3, score2: 1 });
  removeParticipant(draft, player);
  assert.equal(draft.players.length, 3);
  assert.ok(draft.rounds.length > 0);
  assert.ok(draft.rounds.every(round => !round.byes.includes(player) && round.matches.every(match => !match.played && match.score1 === null && ![...match.pairA, ...match.pairB].includes(player))));
  assert.equal(calcAmericanoStandings(draft).length, 3);
  assert.ok(calcAmericanoStandings(draft).every(row => row.played === 0));
});

test('removes ladder marks, preserving remaining participants and completing a decided ladder', () => {
  const draft = tournament('turnik');
  const [player, winner, ...others] = draft.players;
  draft.round = 2;
  draft.passed = { [player]: true, [winner]: true };
  draft.eliminated = Object.fromEntries(others.map(name => [name, { round: 1, reps: 0 }]));
  const eliminated = structuredClone(draft.eliminated);
  removeParticipant(draft, player);
  assert.equal(Object.hasOwn(draft.passed, player), false);
  assert.deepEqual(draft.eliminated, eliminated);
  assert.equal(draft.status, 'finished');
  assert.equal(draft.winner, winner);
  assert.equal(buildLadderRanking(draft).some(row => row.name === player), false);
});

test('rejects invalid removals without changing tournament data', () => {
  const minimums = ['football', 'table-tennis-1x1', 'turnik'].map(sport => tournament(sport, 'league', 2));
  minimums.push(tournament('table-tennis-2x2', undefined, 3));
  const emptyTeam = tournament('football-real');
  const first = emptyTeam.teams[0].players[0];
  emptyTeam.teams[1].players.push(emptyTeam.teams[0].players.pop());
  const finished = { ...tournament(), status: 'finished' };
  const oneInGroup = tournament('football', 'group', 6);
  const group = oneInGroup.groups[0];
  group.players = [group.players[0]];
  const cases = [...minimums.map(draft => [draft, draft.players[0]]), [emptyTeam, first], [finished, finished.players[0]], [oneInGroup, group.players[0]], [tournament(), 'Несуществующий']];
  for (const [draft, player] of cases) {
    const before = structuredClone(draft);
    assert.ok(getParticipantRemovalError(draft, player));
    assert.throws(() => removeParticipant(draft, player));
    assert.deepEqual(draft, before);
  }
});
