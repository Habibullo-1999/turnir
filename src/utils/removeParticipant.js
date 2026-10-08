import { buildRounds, isRealMatch, propagateWinners } from './bracket.js';
import { buildAmericanoRounds } from './americano.js';
import { computeTournamentResult, isTournamentComplete } from './computeStats.js';
import { computeLadderResult, isLadderComplete } from './ladder.js';
import { attributedGoals, getScores, getTeams } from './teamMatchLog.js';
import { getSportConfig } from './sportConfig.js';

function playerList(tournament) {
  const players = tournament.players || [];
  return Array.isArray(players) ? players : Object.values(players).filter(Boolean);
}

export function getParticipantRemovalError(tournament, player) {
  if (tournament.status !== 'active') return 'Сначала верните турнир в работу.';
  const players = playerList(tournament);
  if (!players.includes(player)) return 'Участник не найден.';
  const engine = getSportConfig(tournament.sport).engine;
  const minimum = engine === 'americano' ? 3 : 2;
  if (players.length <= minimum) return `В турнире должно остаться минимум ${minimum} участника.`;
  if (engine === 'team-match-log') {
    const team = getTeams(tournament).find(team => team.players.includes(player));
    if (team?.players.length === 1) return `В команде «${team.name}» должен остаться хотя бы один игрок.`;
  }
  if (engine === 'bracket-group') {
    const group = (tournament.groups || []).find(group => group.players.includes(player));
    if (group?.players.length === 1) return `В группе «${group.name}» должен остаться хотя бы один участник.`;
  }
  return null;
}

export function participantRemovalDescription(tournament) {
  switch (getSportConfig(tournament.sport).engine) {
    case 'team-match-log':
      return 'Участник и его голы будут удалены. Счёт команды уменьшится на количество его голов.';
    case 'americano':
      return 'Расписание Американо будет сформировано заново. Все результаты матчей будут сброшены.';
    case 'turnik-ladder':
      return 'Участник и его результаты подтягиваний будут удалены. Результаты остальных сохранятся.';
    default:
      return 'Матчи участника и их результаты будут удалены. В плей-офф участник заменится на BYE; результаты матчей с изменившимися соперниками будут сброшены.';
  }
}

function removeFromBracket(draft, player) {
  const previous = draft.rounds;
  const seeded = previous[0].flatMap(match => [match.t1, match.t2]).map(name => name === player ? 'BYE' : name);
  const { rounds, roundLabels } = buildRounds(seeded);
  // Recompute every advancement, retaining scores only for unchanged pairings.
  // This also recalculates lucky losers without stale downstream winners.
  propagateWinners(rounds);
  rounds.forEach((round, roundIndex) => {
    round.forEach((match, matchIndex) => {
      const old = previous[roundIndex][matchIndex];
      if (!isRealMatch(match) || old.t1 !== match.t1 || old.t2 !== match.t2 || old.score1 == null || !old.winner) return;
      match.score1 = old.score1;
      match.score2 = old.score2;
      match.winner = old.winner;
      if (old.pen1 != null) match.pen1 = old.pen1;
      if (old.pen2 != null) match.pen2 = old.pen2;
    });
    propagateWinners(rounds);
  });
  draft.rounds = rounds;
  draft.roundLabels = roundLabels;
}

export function removeParticipant(draft, player) {
  const invalid = getParticipantRemovalError(draft, player);
  if (invalid) throw new Error(invalid);
  const engine = getSportConfig(draft.sport).engine;
  draft.players = playerList(draft).filter(name => name !== player);
  for (const field of ['participantMeta', 'playerMeta', 'passed', 'eliminated']) {
    if (draft[field]) delete draft[field][player];
  }

  if (engine === 'team-match-log') {
    const teams = getTeams(draft);
    const scores = getScores(draft);
    teams.forEach((team, side) => {
      if (!team.players.includes(player)) return;
      const goals = { ...team.goals };
      const removedGoals = Number(goals[player]) || 0;
      delete goals[player];
      teams[side] = { ...team, players: team.players.filter(name => name !== player), goals };
      scores[side] = Math.max(attributedGoals(teams[side]), scores[side] - removedGoals);
    });
    draft.teams = teams;
    draft.scores = scores;
  } else if (engine === 'americano') {
    draft.rounds = buildAmericanoRounds(draft.players);
  } else if (engine === 'bracket-group') {
    (draft.groups || []).forEach(group => {
      group.players = group.players.filter(name => name !== player);
      group.tieBreakOrder = (group.tieBreakOrder || group.players).filter(name => name !== player);
      group.matches = group.matches.filter(match => match.t1 !== player && match.t2 !== player);
    });
    if (draft.rounds?.length) removeFromBracket(draft, player);
  }

  delete draft.winner;
  delete draft.stats;
  delete draft.finishedAt;
  delete draft.date;
  const complete = engine === 'bracket-group' ? isTournamentComplete(draft)
    : engine === 'turnik-ladder' ? isLadderComplete(draft) : false;
  if (complete) {
    const result = engine === 'turnik-ladder' ? computeLadderResult(draft) : computeTournamentResult(draft);
    draft.status = 'finished';
    draft.winner = result.winner;
    if (result.stats) draft.stats = result.stats;
    draft.finishedAt = Date.now();
    draft.date = new Date().toLocaleDateString('ru');
  }
}
