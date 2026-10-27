import {
  attributedAssists, buildTeams, creditedGoals, getScores, getTeams, matchResult, ownGoalsTotal, validateMatch,
} from './teamMatchLog.js';

// Мутаторы матча. Как и остальные *Actions.js — чистые функции над черновиком
// (см. `mutate` в TournamentContext), бросают ошибку с текстом для
// пользователя вместо тихой порчи данных.
//
// Запись здесь — сам матч, поэтому правки применяются сразу, без отдельной
// формы «добавить»: каждое нажатие уходит в сохранение, как отметки в турнике.

function writeTeams(draft, teams) {
  draft.teams = teams.map(team => ({
    name: team.name, players: team.players, goals: team.goals, assists: team.assists, ownGoals: team.ownGoals,
  }));
}

function writeScores(draft, scores) {
  draft.scores = [scores[0], scores[1]];
}

export function setPlayedAt(draft, ts) {
  draft.playedAt = ts;
}

export function addPlayer(draft, name, side) {
  if (draft.status !== 'active') throw new Error('Сначала верните матч в работу.');
  const player = name.trim();
  if (!player) throw new Error('Введите имя участника.');
  if (side !== 0 && side !== 1) throw new Error('Выберите команду.');

  const teams = getTeams(draft);
  const players = (Array.isArray(draft.players) ? draft.players : Object.values(draft.players || {})).filter(Boolean);
  if (players.includes(player) || teams.some(team => team.players.includes(player))) {
    throw new Error(`Участник «${player}» уже добавлен.`);
  }

  teams[side].players.push(player);
  draft.players = [...players, player];
  writeTeams(draft, teams);
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

// Меняет счётчик игрока (`goals` / `assists` / `ownGoals`), не уходя ниже 0.
function bumpCounter(draft, side, player, field, delta) {
  const teams = getTeams(draft);
  const team = teams[side];
  if (!team.players.includes(player)) throw new Error('Игрок не в этой команде.');
  const next = Math.max(0, (Number(team[field][player]) || 0) + delta);
  const counts = { ...team[field] };
  if (next > 0) counts[player] = next;
  else delete counts[player];
  teams[side] = { ...team, [field]: counts };
  writeTeams(draft, teams);
}

// Тап по автору гола — основной сценарий ввода, поэтому счёт дотягивается сам:
// обычный матч вводится одними «+». Убавление снимает гол и со счёта, но
// только если весь счёт был расписан поимённо (иначе там висят голы без
// автора, которые нельзя терять).
function bumpCredited(draft, scoreSide, change) {
  const before = creditedGoals(draft, scoreSide);
  change();
  const after = creditedGoals(draft, scoreSide);
  const scores = getScores(draft);
  if (after > scores[scoreSide] || scores[scoreSide] === before) {
    scores[scoreSide] = after;
    writeScores(draft, scores);
  }
}

export function bumpGoal(draft, side, player, delta) {
  bumpCredited(draft, side, () => bumpCounter(draft, side, player, 'goals', delta));
}

// Автогол игрока стороны `side` идёт в счёт соперника.
export function bumpOwnGoal(draft, side, player, delta) {
  bumpCredited(draft, 1 - side, () => bumpCounter(draft, side, player, 'ownGoals', delta));
}

// Пас счёт не меняет. Пасов не может быть больше, чем голов команды, не
// считая автоголов соперника — на них паса не бывает.
export function bumpAssist(draft, side, player, delta) {
  if (delta > 0) {
    const teams = getTeams(draft);
    const assistable = getScores(draft)[side] - ownGoalsTotal(teams[1 - side]);
    if (attributedAssists(teams[side]) + delta > assistable) {
      throw new Error('Пасов больше, чем голов команды — сначала добавьте гол.');
    }
  }
  bumpCounter(draft, side, player, 'assists', delta);
}

export function movePlayer(draft, player, toSide) {
  const teams = getTeams(draft);
  const fromSide = teams.findIndex(team => team.players.includes(player));
  if (fromSide < 0) throw new Error('Такого игрока нет в составах.');
  if (fromSide === toSide) return;
  if (teams[fromSide].players.length === 1) {
    throw new Error(`«${teams[fromSide].name}» осталась бы без игроков.`);
  }

  // Перевод — это исправление ошибки в составе, поэтому голы, пасы и
  // автоголы игрока уезжают вместе с ним, а счёт пересчитывается: его голы
  // переходят из счёта прежней команды в счёт новой, а автоголы — наоборот
  // (раньше они шли новой команде как сопернику, теперь — прежней). Голы без
  // автора при этом не теряются — счёт не падает ниже того, что расписано.
  const from = teams[fromSide];
  const to = teams[toSide];
  const scored = Number(from.goals[player]) || 0;
  const own = Number(from.ownGoals[player]) || 0;
  const take = (map) => { const rest = { ...map }; delete rest[player]; return rest; };
  const give = (map, n) => (n > 0 ? { ...map, [player]: n } : { ...map });

  teams[fromSide] = {
    ...from,
    players: from.players.filter(p => p !== player),
    goals: take(from.goals),
    assists: take(from.assists),
    ownGoals: take(from.ownGoals),
  };
  teams[toSide] = {
    ...to,
    players: [...to.players, player],
    goals: give(to.goals, scored),
    assists: give(to.assists, Number(from.assists[player]) || 0),
    ownGoals: give(to.ownGoals, own),
  };
  writeTeams(draft, teams);

  const scores = getScores(draft);
  scores[fromSide] = Math.max(creditedGoals(draft, fromSide), scores[fromSide] - scored + own);
  scores[toSide] = Math.max(creditedGoals(draft, toSide), scores[toSide] + scored - own);
  writeScores(draft, scores);
}

// Пересобрать составы можно в любой момент, пока матч не завершён: он ещё не
// сыгран (или переигрывается), и переписывать нечего — голы, пасы и автоголы
// обнуляются вместе с составами.
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
