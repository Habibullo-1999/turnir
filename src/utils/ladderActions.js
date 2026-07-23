import { isLadderComplete, computeLadderResult } from './ladder.js';

function finishIfDone(draft) {
  if (draft.status === 'finished') return;
  if (!isLadderComplete(draft)) return;
  draft.status = 'finished';
  draft.winner = computeLadderResult(draft).winner;
  draft.finishedAt = Date.now();
  draft.date = new Date().toLocaleDateString('ru');
}

export function markPassed(draft, name) {
  delete draft.eliminated[name];
  draft.passed[name] = true;
}

// Может сразу завершить турнир, если это предпоследний оставшийся участник
// (или последние двое выбывают в одном раунде одновременно).
export function markFailed(draft, name) {
  delete draft.passed[name];
  draft.eliminated[name] = draft.round;
  finishIfDone(draft);
}

export function undoMark(draft, name) {
  delete draft.passed[name];
  if (draft.eliminated[name] === draft.round) delete draft.eliminated[name];
}

export function advanceRound(draft) {
  const active = draft.players.filter(p => draft.eliminated[p] == null);
  const allMarked = active.every(p => draft.passed[p]);
  if (!allMarked) throw new Error('Отметьте результат всем оставшимся участникам.');
  draft.round += 1;
  draft.passed = {};
}
