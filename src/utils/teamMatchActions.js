import { attributedGoals, buildTeams, getScores, getTeams, matchResult, validateMatch } from './teamMatchLog.js';

// Мутаторы матча. Как и остальные *Actions.js — чистые функции над черновиком
// (см. `mutate` в TournamentContext), бросают ошибку с текстом для
// пользователя вместо тихой порчи данных.
//
// Запись здесь — сам матч, поэтому правки применяются сразу, без отдельной
// формы «добавить»: каждое нажатие уходит в сохранение, как отметки в турнике.

function writeTeams(draft, teams) {
  draft.teams = teams.map(team => ({ name: team.name, players: team.players, goals: team.goals }));
}

function writeScores(draft, scores) {
  draft.scores = [scores[0], scores[1]];
}

export function setPlayedAt(draft, ts) {
  draft.playedAt = ts;
}

export function renameTeam(draft, side, name) {
  const teams = getTeams(draft);
  teams[side] = { ...teams[side], name: name.trim() || teams[side].name };
  writeTeams(draft, teams);
}

export function setScore(draft, side, value) {
  const scores = getScores(draft);
  scores[side] = Math.max(0, Number.isInteger(value) ? value : 0);
  writeScores(draft, scores);
}

// Тап по автору гола — основной сценарий ввода, поэтому счёт дотягивается сам:
// обычный матч вводится одними «+». Убавление снимает гол и со счёта, но
// только если весь счёт был расписан по авторам (иначе там висят автоголы и
// голы без автора, которые нельзя терять).
export function bumpGoal(draft, side, player, delta) {
  const teams = getTeams(draft);
  const team = teams[side];
  if (!team.players.includes(player)) throw new Error('Игрок не в этой команде.');

  const before = attributedGoals(team);
  const next = Math.max(0, (team.goals[player] || 0) + delta);
  const goals = { ...team.goals };
  if (next > 0) goals[player] = next;
  else delete goals[player];
  teams[side] = { ...team, goals };
  writeTeams(draft, teams);

  const after = attributedGoals(teams[side]);
  const scores = getScores(draft);
  if (after > scores[side] || scores[side] === before) {
    scores[side] = after;
    writeScores(draft, scores);
  }
}

export function movePlayer(draft, player, toSide) {
  const teams = getTeams(draft);
  const fromSide = teams.findIndex(team => team.players.includes(player));
  if (fromSide < 0) throw new Error('Такого игрока нет в составах.');
  if (fromSide === toSide) return;
  if (teams[fromSide].players.length === 1) {
    throw new Error(`«${teams[fromSide].name}» осталась бы без игроков.`);
  }

  // Перевод — это исправление ошибки в составе, поэтому голы игрока уезжают
  // вместе с ним И переносятся в счёте: у прежней команды столько же
  // вычитается, у новой прибавляется. Голы без автора у прежней команды при
  // этом не теряются — счёт не падает ниже того, что расписано.
  const scored = teams[fromSide].goals[player] || 0;
  const fromGoals = { ...teams[fromSide].goals };
  delete fromGoals[player];
  const toGoals = { ...teams[toSide].goals };
  if (scored > 0) toGoals[player] = scored;

  teams[fromSide] = { ...teams[fromSide], players: teams[fromSide].players.filter(p => p !== player), goals: fromGoals };
  teams[toSide] = { ...teams[toSide], players: [...teams[toSide].players, player], goals: toGoals };
  writeTeams(draft, teams);

  const scores = getScores(draft);
  scores[fromSide] = Math.max(attributedGoals(teams[fromSide]), scores[fromSide] - scored);
  scores[toSide] = Math.max(attributedGoals(teams[toSide]), scores[toSide] + scored);
  writeScores(draft, scores);
}

// Пересобрать составы можно в любой момент, пока матч не завершён: он ещё не
// сыгран (или переигрывается), и переписывать нечего — голы обнуляются вместе
// с составами.
export function reshuffleTeams(draft) {
  writeTeams(draft, buildTeams(draft.players, getTeams(draft)));
  writeScores(draft, [0, 0]);
}

export function finishMatch(draft) {
  const invalid = validateMatch(draft);
  if (invalid) throw new Error(invalid);
  draft.status = 'finished';
  draft.finishedAt = Date.now();
  draft.date = new Date().toLocaleDateString('ru');
  draft.winner = matchResult(draft).winner;
}

export function reopenMatch(draft) {
  draft.status = 'active';
}
