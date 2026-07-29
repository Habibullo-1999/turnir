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
  // Может сразу завершить турнир: это последний оставшийся, и он только что
  // сам подтвердил выполнение раунда (см. isLadderComplete).
  finishIfDone(draft);
}

// reps — сколько подтягиваний участник реально успел сделать в этом
// (не выполненном до конца) раунде; используется как tie-break и для общей
// статистики подтягиваний в истории.
export function markFailed(draft, name, reps) {
  delete draft.passed[name];
  draft.eliminated[name] = { round: draft.round, reps };
  finishIfDone(draft);
}

export function undoMark(draft, name) {
  delete draft.passed[name];
  if (draft.eliminated[name]?.round === draft.round) delete draft.eliminated[name];
}

// "Вернуть турнир" переоткрывает его для исправления чужой ошибки (например,
// неверно введённых подтягиваний у выбывшего) — оно не должно заставлять уже
// подтвердившего раунд единственного оставшегося участника подтверждать его
// заново. Если активен только один (турнир уже был фактически решён), сразу
// восстанавливаем его отметку "выполнил", иначе finishIfDone никогда больше
// не сработает сам по себе и турнир зависнет в статусе "активен".
export function reopenLadder(draft) {
  draft.status = 'active';
  const active = draft.players.filter(p => draft.eliminated[p] == null);
  if (active.length === 1) draft.passed[active[0]] = true;
}

export function advanceRound(draft) {
  const active = draft.players.filter(p => draft.eliminated[p] == null);
  const allMarked = active.every(p => draft.passed[p]);
  if (!allMarked) throw new Error('Отметьте результат всем оставшимся участникам.');
  draft.round += 1;
  draft.passed = {};
}
