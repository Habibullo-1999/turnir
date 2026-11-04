import { isAmericanoComplete, computeAmericanoResult } from './americano.js';
import { getSportConfig } from './sportConfig.js';

function finishIfComplete(draft) {
  if (draft.status === 'finished') return;
  if (!isAmericanoComplete(draft)) return;
  draft.status = 'finished';
  draft.winner = computeAmericanoResult(draft).winner;
  draft.finishedAt = Date.now();
  draft.date = new Date().toLocaleDateString('ru');
}

export function confirmAmericanoScore(draft, roundIdx, matchIdx, s1, s2) {
  if (draft.status !== 'active') throw new Error('Сначала верните турнир в работу.');
  if (![s1, s2].every(score => Number.isInteger(score) && score >= 0 && score <= 99)) {
    throw new Error('Введите целый счёт от 0 до 99.');
  }
  if (!getSportConfig(draft.sport).hasDraws && s1 === s2) throw new Error('Ничья невозможна — введите разные значения.');
  const match = draft.rounds?.[roundIdx]?.matches?.[matchIdx];
  if (!match) throw new Error('Матч не найден. Обновите страницу.');
  match.score1 = s1;
  match.score2 = s2;
  match.played = true;
  finishIfComplete(draft);
}

export function clearAmericanoScore(draft, roundIdx, matchIdx) {
  const match = draft.rounds?.[roundIdx]?.matches?.[matchIdx];
  if (!match) throw new Error('Матч не найден. Обновите страницу.');
  match.score1 = null;
  match.score2 = null;
  match.played = false;
  if (draft.status === 'finished') draft.status = 'active';
  delete draft.winner;
  delete draft.stats;
  delete draft.finishedAt;
  delete draft.date;
}
