import { shuffle } from './bracket.js';

// «Реальный футбол» — одна запись = один матч. Не турнир, не сетка и не набор
// игр: у матча своё название, своя дата, две команды с составами и авторами
// голов. Всё это ради статистики: кто сколько забил, когда была игра и кто за
// какую команду в ней играл. Сквозной зачёт по всем матчам считается в истории.

export const MIN_TEAM_LOG_PLAYERS = 4;
export const DEFAULT_TEAM_NAMES = ['Команда 1', 'Команда 2'];
export const DRAW_LABEL = 'Ничья';

// Firebase выбрасывает пустые массивы/объекты (`players: []` читается как null)
// и хранит объекты с числовыми ключами как разрежённые массивы, поэтому списки
// объектов и имён проходят через этот нормализатор. Числовые списки — нет:
// у них 0 значимый, см. getScores.
function toList(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : Object.values(value)).filter(Boolean);
}

// Возвращает ровно две команды с подставленными значениями по умолчанию, чтобы
// вызывающему коду не приходилось проверять форму записи.
export function getTeams(match) {
  const list = toList(match?.teams);
  return [0, 1].map(side => ({
    name: list[side]?.name || DEFAULT_TEAM_NAMES[side],
    players: toList(list[side]?.players),
    goals: list[side]?.goals || {},
  }));
}

// Страховка на случай записи без составов: обычный матч создаётся уже
// разделённым, но UI не должен ломаться, если команд в записи нет.
export function hasTeams(match) {
  return getTeams(match).some(team => team.players.length > 0);
}

export function getGoals(team) {
  const goals = team?.goals;
  if (!goals) return [];
  return Object.entries(goals)
    .filter(([name, count]) => name && count > 0)
    .map(([name, count]) => ({ name, count }));
}

// Намеренно НЕ через toList: тот отбрасывает falsy-элементы, а в счёте 0 —
// полноценное значение, и матч 0:1 читался бы как 1:0.
export function getScores(match) {
  const scores = match?.scores;
  const arr = Array.isArray(scores) ? scores : scores ? Object.values(scores) : [];
  return [Number(arr[0]) || 0, Number(arr[1]) || 0];
}

export function attributedGoals(team) {
  return getGoals(team).reduce((sum, g) => sum + g.count, 0);
}

export function totalGoals(match) {
  const [s1, s2] = getScores(match);
  return s1 + s2;
}

// Делит пришедших на две команды. Нечётный лишний не садится на лавку, а идёт
// в усиление случайной команде: 5 человек → 3×2 или 2×3, играют все.
export function splitTeams(players) {
  const pool = shuffle(toList(players));
  const half = Math.ceil(pool.length / 2);
  const first = pool.slice(0, half);
  const second = pool.slice(half);
  return Math.random() < 0.5 ? [first, second] : [second, first];
}

export function buildTeams(players, previousTeams = []) {
  return splitTeams(players).map((roster, side) => ({
    name: previousTeams[side]?.name || DEFAULT_TEAM_NAMES[side],
    players: roster,
    goals: {},
  }));
}

// Голов у авторов может быть МЕНЬШЕ счёта команды — это не ошибка: автоголы и
// «никто не помнит, кто забил» в дворовом футболе обычное дело. Больше счёта —
// уже ошибка ввода, и с ней матч нельзя завершить.
export function validateMatch(match) {
  const teams = getTeams(match);
  if (!teams[0].players.length || !teams[1].players.length) {
    return 'В каждой команде должен быть хотя бы один игрок.';
  }
  const overlap = teams[0].players.filter(p => teams[1].players.includes(p));
  if (overlap.length) return `Игрок не может играть за обе команды: ${overlap.join(', ')}.`;

  const rawScores = Array.isArray(match.scores) ? match.scores : [];
  const scores = getScores(match);
  for (let side = 0; side < 2; side++) {
    if (!Number.isInteger(rawScores[side]) || rawScores[side] < 0) return 'Счёт должен быть целым числом от 0.';
    const attributed = attributedGoals(teams[side]);
    if (attributed > scores[side]) {
      return `«${teams[side].name}»: у игроков расписано ${pluralGoals(attributed)}, а команда забила ${scores[side]}.`;
    }
  }
  return null;
}

// Личный зачёт одного матча: голы, результат и разница по каждому, кто играл.
export function computeMatchStats(match) {
  const teams = getTeams(match);
  const [s1, s2] = getScores(match);
  const rows = [];

  teams.forEach((team, side) => {
    const own = side === 0 ? s1 : s2;
    const opp = side === 0 ? s2 : s1;
    const goals = getGoals(team).reduce((acc, g) => ({ ...acc, [g.name]: g.count }), {});
    team.players.forEach(player => {
      rows.push({
        name: player,
        team: team.name,
        teamSide: side,
        goals: goals[player] || 0,
        gf: own,
        ga: opp,
        result: own > opp ? 'win' : own < opp ? 'loss' : 'draw',
      });
    });
  });

  return rows.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'ru'));
}

export function matchResult(match) {
  const teams = getTeams(match);
  const [s1, s2] = getScores(match);
  const draw = s1 === s2;
  const rows = computeMatchStats(match);
  const top = rows[0];
  return {
    winner: draw ? DRAW_LABEL : (s1 > s2 ? teams[0].name : teams[1].name),
    draw,
    topScorer: top && top.goals > 0 ? top : null,
  };
}

export function pluralGoals(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} голов`;
  if (mod10 === 1) return `${n} гол`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} гола`;
  return `${n} голов`;
}

export function pluralPlayers(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} игроков`;
  if (mod10 === 1) return `${n} игрок`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} игрока`;
  return `${n} игроков`;
}

export function pluralMatches(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} матчей`;
  if (mod10 === 1) return `${n} матч`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} матча`;
  return `${n} матчей`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function dateInputValue(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Меняет только дату, сохраняя исходное время, если день не менялся.
export function timestampFromDateInput(value, fallbackTs) {
  if (!value || dateInputValue(fallbackTs) === value) return fallbackTs;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return fallbackTs;
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

export function formatMatchDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('ru');
}
