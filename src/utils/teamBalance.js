import { computeMatchStats, getScores, getTeams, hasTeams } from './teamMatchLog.js';
import { FOOTBALL_REAL } from './sportConfig.js';

// «⚖️ Равные команды» для реального футбола: делим пришедших так, чтобы
// суммарная сила команд была как можно ближе, при этом составы не повторяют
// ни прошлый матч (включая ещё открытый), ни текущее деление — минимум два
// игрока в каждой команде должны смениться.

const MAX_GD_PER_MATCH = 5;      // разгромы не должны перекраивать рейтинг
const CONTRIBUTION_WEIGHT = 0.4; // вес гола/паса относительно разницы мячей
const PRIOR_GAMES = 2;           // «виртуальные» игры с нулём: мало игр → рейтинг ближе к среднему
const BALANCE_TOLERANCE = 0.3;   // насколько разница сил может быть хуже лучшей, чтобы вариант попал в жребий
const MIN_CANDIDATES = 5;        // из скольких лучших вариантов как минимум тянем жребий
const ENUMERATE_LIMIT = 400000;  // дальше перебор слишком долгий — берём случайную выборку
const SAMPLE_SIZE = 60000;
const STAMINA_WEIGHT = 0.5;      // одно очко выносливости (из 10) ≈ полмяча разницы за матч
export const MIN_CHANGED_PLAYERS = 2;

function matchTime(match) {
  return Number(match.playedAt || match.finishedAt || match.createdAt) || parseInt(match.id, 10) || 0;
}

// Матчи, по которым считается сила: все реальные матчи с составами, кроме
// текущего. Открытый матч тоже идёт в зачёт, если в нём уже есть счёт —
// пустой 0:0 ещё не сыгран и посчитался бы как ничья.
export function ratingMatches(tournaments, excludeId) {
  return tournaments.filter(match => match && match.id !== excludeId && match.sport === FOOTBALL_REAL && hasTeams(match)
    && (match.status === 'finished' || getScores(match).some(score => score > 0)));
}

export function computePlayerRatings(matches) {
  const totals = {};
  for (const match of matches) {
    for (const row of computeMatchStats(match)) {
      const gd = Math.max(-MAX_GD_PER_MATCH, Math.min(MAX_GD_PER_MATCH, row.gf - row.ga));
      const entry = totals[row.name] || (totals[row.name] = { sum: 0, games: 0 });
      entry.sum += gd + CONTRIBUTION_WEIGHT * (row.goals + row.assists);
      entry.games += 1;
    }
  }
  return Object.fromEntries(Object.entries(totals).map(([name, { sum, games }]) => [name, { rating: sum / (games + PRIOR_GAMES), games }]));
}

// Последний реальный матч до текущего (открытые тоже считаются).
export function findPreviousTeams(tournaments, current) {
  const time = matchTime(current);
  const previous = tournaments
    .filter(match => match && match.id !== current.id && match.sport === FOOTBALL_REAL && hasTeams(match) && matchTime(match) <= time)
    .reduce((latest, match) => !latest || matchTime(match) > matchTime(latest) ? match : latest, null);
  if (previous) return getTeams(previous);
  return current.previousTeams ? getTeams({ teams: current.previousTeams }) : [];
}

function popcount(x) {
  let count = 0;
  while (x) { x &= x - 1; count++; }
  return count;
}

// Насколько новое деление отличается от старого: в худшей команде и при
// худшем сопоставлении сторон — сколько в ней игроков, которых не было в
// «её» прежней команде. Так простая перестановка команд местами даёт 0.
function changeDistance(maskA, full, oldMasks) {
  if (!oldMasks) return Infinity;
  const maskB = full & ~maskA;
  let distance = Infinity;
  for (const [oldA, oldB] of [oldMasks, [oldMasks[1], oldMasks[0]]]) {
    distance = Math.min(distance, popcount(maskA & ~oldA), popcount(maskB & ~oldB));
  }
  return distance;
}

function* allSubsets(n, k) {
  if (k === 0) { yield 0; return; }
  let mask = (1 << k) - 1;
  const limit = 1 << n;
  while (mask < limit) {
    yield mask;
    const c = mask & -mask;
    const r = mask + c;
    mask = (((r ^ mask) >>> 2) / c) | r;
  }
}

function* sampledSubsets(n, k, random) {
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const order = [...Array(n).keys()];
    for (let j = n - 1; j > 0; j--) {
      const t = Math.floor(random() * (j + 1));
      [order[j], order[t]] = [order[t], order[j]];
    }
    yield order.slice(0, k).reduce((mask, index) => mask | (1 << index), 0);
  }
}

function binomial(n, k) {
  let result = 1;
  for (let i = 1; i <= k; i++) result = result * (n - k + i) / i;
  return result;
}

/**
 * players — кто пришёл; ratings — из computePlayerRatings; previousTeams —
 * составы прошлого матча; currentTeams — текущее деление этого матча;
 * stamina — скрытая выносливость { имя: 1..10 }, добавляется к силе.
 * Возвращает { teams: [rosterA, rosterB], strength: [a, b], changed }.
 */
export function balanceTeams(players, ratings = {}, previousTeams = [], currentTeams = [], { stamina = {}, random = Math.random } = {}) {
  const pool = [...new Set(players.filter(Boolean))];
  const n = pool.length;
  if (n < 2) throw new Error('Нужно минимум два игрока.');
  if (n > 30) throw new Error('Слишком много игроков для автоматического деления.');

  // Новичкам без истории даём средний рейтинг присутствующих.
  const known = pool.filter(player => ratings[player]);
  const average = known.length ? known.reduce((sum, player) => sum + ratings[player].rating, 0) / known.length : 0;
  // Выносливость считается от среднего среди пришедших: важна разница между
  // игроками, а не сама шкала. У кого её нет — средняя.
  const withStamina = pool.filter(player => stamina[player] > 0);
  const averageStamina = withStamina.length ? withStamina.reduce((sum, player) => sum + stamina[player], 0) / withStamina.length : 0;
  const strength = pool.map(player => (ratings[player] ? ratings[player].rating : average)
    + STAMINA_WEIGHT * ((stamina[player] > 0 ? stamina[player] : averageStamina) - averageStamina));

  const full = (1 << n) - 1;
  const toMasks = teams => {
    const list = getTeams({ teams });
    if (!list.some(team => team.players.length)) return null;
    return list.map(team => pool.reduce((mask, player, index) => team.players.includes(player) ? mask | (1 << index) : mask, 0));
  };
  const previousMasks = toMasks(previousTeams);
  const currentMasks = toMasks(currentTeams);

  const k = Math.floor(n / 2);
  const subsets = binomial(n, k) <= ENUMERATE_LIMIT ? allSubsets(n, k) : sampledSubsets(n, k, random);
  const candidates = [];
  const seen = new Set();
  const total = strength.reduce((a, b) => a + b, 0);
  for (const mask of subsets) {
    // Для чётного n {A,B} и {B,A} — одно деление.
    const key = n % 2 === 0 ? Math.min(mask, full & ~mask) : mask;
    if (seen.has(key)) continue;
    seen.add(key);
    let sumA = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) sumA += strength[i];
    candidates.push({
      mask,
      diff: Math.abs(sumA - (total - sumA)),
      fromPrevious: changeDistance(mask, full, previousMasks),
      fromCurrent: changeDistance(mask, full, currentMasks),
    });
  }

  // Требование «минимум двое сменились» ослабляется, только если при таком
  // числе игроков оно в принципе невыполнимо (например, 4 человека).
  const needPrevious = Math.min(MIN_CHANGED_PLAYERS, Math.max(...candidates.map(c => c.fromPrevious)));
  let valid = candidates.filter(c => c.fromPrevious >= needPrevious);
  const needCurrent = Math.min(MIN_CHANGED_PLAYERS, Math.max(...valid.map(c => c.fromCurrent)));
  valid = valid.filter(c => c.fromCurrent >= needCurrent);

  valid.sort((a, b) => a.diff - b.diff);
  const best = valid[0].diff;
  const cutoff = Math.max(best + BALANCE_TOLERANCE, valid[Math.min(MIN_CANDIDATES, valid.length) - 1].diff);
  const shortlist = valid.filter(c => c.diff <= cutoff);
  const pick = shortlist[Math.floor(random() * shortlist.length)];

  const teamA = pool.filter((_, i) => pick.mask & (1 << i));
  const teamB = pool.filter((_, i) => !(pick.mask & (1 << i)));
  const sum = team => team.reduce((acc, player) => acc + strength[pool.indexOf(player)], 0);
  return {
    teams: [teamA, teamB],
    strength: [sum(teamA), sum(teamB)],
    changed: Math.min(pick.fromPrevious, pick.fromCurrent),
  };
}
