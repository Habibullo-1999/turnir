import { isAmericanoComplete, computeAmericanoResult } from './americano.js';

function finishIfComplete(draft) {
  if (draft.status === 'finished') return;
  if (!isAmericanoComplete(draft)) return;
  draft.status = 'finished';
  draft.winner = computeAmericanoResult(draft).winner;
  draft.finishedAt = Date.now();
  draft.date = new Date().toLocaleDateString('ru');
}

export function confirmAmericanoScore(draft, roundIdx, matchIdx, s1, s2) {
  const match = draft.rounds[roundIdx].matches[matchIdx];
  match.score1 = s1;
  match.score2 = s2;
  match.played = true;
  finishIfComplete(draft);
}

export function clearAmericanoScore(draft, roundIdx, matchIdx) {
  const match = draft.rounds[roundIdx].matches[matchIdx];
  match.score1 = null;
  match.score2 = null;
  match.played = false;
  if (draft.status === 'finished') draft.status = 'active';
}
