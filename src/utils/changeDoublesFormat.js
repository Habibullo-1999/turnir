import { FOOTBALL_DOUBLES } from './sportConfig.js';
import { americanoReturnPairs, orderedAmericanoRounds, isAmericanoComplete, computeAmericanoResult } from './americano.js';
import { completeFootballDoublesSchedule } from './footballDoublesSchedule.js';
import { distributeDoublesClubs } from './doublesClubs.js';

export function changeDoublesFormat(draft, format, seed = 0) {
  if (draft.sport !== FOOTBALL_DOUBLES || draft.status !== 'active') {
    throw new Error('Смена формата доступна только для активного футбола 2×2.');
  }
  if (!['americano', 'league'].includes(format)) throw new Error('Неизвестный формат турнира.');
  if ((draft.format === 'league' ? 'league' : 'americano') === format) return;
  const updated = structuredClone(draft);
  if (format === 'americano') {
    const pairs = americanoReturnPairs(updated);
    if (pairs.some(({ first, second }) => first.played && second.played)) {
      throw new Error('Обе встречи одной из пар уже сыграны. Перейти на один круг без потери результата нельзя.');
    }
    const replacements = new Map(pairs.map(({ first, second }) => [first, second.played ? second : first]));
    const rounds = orderedAmericanoRounds(updated);
    updated.rounds = rounds.slice(0, rounds.length / 2).map(({ additionalLeg, ...round }) => ({
      ...round, matches: round.matches.map(match => replacements.get(match)),
    }));
    delete updated.format;
  } else {
    const first = updated.rounds.map(({ additionalLeg, ...round }) => round);
    updated.rounds = [...first, ...first.map(round => ({
      byes: [...(round.byes || [])],
      matches: round.matches.map(match => ({
        pairA: [...match.pairB], pairB: [...match.pairA],
        score1: null, score2: null, played: false,
        ...(match.clubA ? { clubB: { ...match.clubA } } : {}),
        ...(match.clubB ? { clubA: { ...match.clubB } } : {}),
      })),
    }))];
    updated.format = 'league';
    completeFootballDoublesSchedule(updated);
  }
  if (updated.clubPool) distributeDoublesClubs(updated, updated.clubPool, seed);
  draft.rounds = updated.rounds;
  if (format === 'league') draft.format = 'league';
  else delete draft.format;
  delete draft.winner;
  delete draft.stats;
  delete draft.finishedAt;
  delete draft.date;
  if (isAmericanoComplete(draft)) {
    draft.status = 'finished';
    draft.winner = computeAmericanoResult(draft).winner;
    draft.finishedAt = Date.now();
    draft.date = new Date().toLocaleDateString('ru');
  }
}
