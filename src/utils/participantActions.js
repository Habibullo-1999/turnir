import { buildRounds, nextPow2, propagateWinners } from './bracket.js';
import { hasBracketStarted } from './manualRearrange.js';
import { FOOTBALL, getSportConfig } from './sportConfig.js';

export function getParticipantAdditionError(tournament) {
  if (tournament.status !== 'active') return 'Сначала верните турнир в работу.';
  if ((tournament.sport || FOOTBALL) !== FOOTBALL) return 'Добавление с выбором клуба доступно в футболе.';
  if (tournament.format === 'group+playoff' && tournament.rounds?.length) {
    return 'После выхода из групп в плей-офф добавлять участников нельзя.';
  }
  if (tournament.format === 'playoff' && hasBracketStarted(tournament.rounds)) {
    return 'В плей-офф можно добавить участника только до первого сыгранного матча.';
  }
  return null;
}

export function addParticipant(draft, { name, club = null, groupIndex = 0 }) {
  const unavailable = getParticipantAdditionError(draft);
  if (unavailable) throw new Error(unavailable);

  const player = name.trim();
  if (!player) throw new Error('Введите имя участника.');
  if (player === 'BYE' || Object.hasOwn(Object.prototype, player)) {
    throw new Error('Это имя зарезервировано. Используйте другое имя участника.');
  }
  if (draft.players.includes(player)) throw new Error(`Участник «${player}» уже добавлен.`);

  if (draft.format === 'playoff') {
    const seeded = draft.rounds[0].flatMap(match => [match.t1, match.t2]);
    const byeIndex = seeded.indexOf('BYE');
    if (byeIndex >= 0) seeded[byeIndex] = player;
    else seeded.push(player);
    while (seeded.length < nextPow2(seeded.length)) seeded.push('BYE');
    const { rounds, roundLabels } = buildRounds(seeded);
    propagateWinners(rounds);
    draft.rounds = rounds;
    draft.roundLabels = roundLabels;
  } else {
    if (!Number.isInteger(groupIndex) || !draft.groups?.[groupIndex]) {
      throw new Error('Выберите группу для участника.');
    }
    const group = draft.groups[groupIndex];
    const doubleLeague = draft.format === 'league' && getSportConfig(draft.sport).doubleRoundRobinLeague;
    const matches = group.players.flatMap(opponent => {
      const match = { t1: opponent, t2: player, score1: null, score2: null, played: false };
      return doubleLeague
        ? [{ ...match, home: true }, { ...match, t1: player, t2: opponent, home: true }]
        : [match];
    });
    group.tieBreakOrder = [...(group.tieBreakOrder || group.players), player];
    group.players.push(player);
    group.matches.push(...matches);
  }

  draft.players.push(player);
  draft.participantMeta = { ...(draft.participantMeta || draft.playerMeta || {}) };
  if (club) draft.participantMeta[player] = club;
  // A reopened tournament may still contain its previous final summary.
  delete draft.winner;
  delete draft.stats;
  delete draft.finishedAt;
  delete draft.date;
}
