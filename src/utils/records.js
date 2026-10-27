import { computeTournamentResult, playedMatches } from './computeStats.js';
import { buildLadderRanking, computeLadderResult } from './ladder.js';
import { aggregateAmericanoPairStats, calcAmericanoStandings } from './americano.js';
import { computeMatchStats, formatMatchDate, getScores, getTeams } from './teamMatchLog.js';

// Рекорды для блока «🏅 Рекорды» в истории. Всё считается из уже сохранённых
// матчей, ничего нового не записывается. Каждый рекорд — карточка
// `{ id, icon, title, value, holders, detail }`: `holders` — кто (или какой
// матч) держит рекорд, при равенстве — все; `detail` — контекст, только
// когда держатель один. Рекорды со значением 0 не показываются.

function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${many}`;
  if (mod10 === 1) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

const GOALS = ['гол', 'гола', 'голов'];
const SETS = ['сет', 'сета', 'сетов'];
const POINTS = ['очко', 'очка', 'очков'];
const MATCHES = ['матч', 'матча', 'матчей'];
const WINS = ['победа', 'победы', 'побед'];
const TOURNAMENTS = ['турнир', 'турнира', 'турниров'];
const ROUNDS = ['раунд', 'раунда', 'раундов'];
const REPS = ['подтягивание', 'подтягивания', 'подтягиваний'];
const ASSISTS = ['пас', 'паса', 'пасов'];
const TIMES = ['раз', 'раза', 'раз'];

// История приходит от новых к старым, а серии считаются по порядку игр.
function chronological(history) {
  const when = e => e.playedAt || e.finishedAt || e.createdAt || parseInt(e.id, 10) || 0;
  return [...history].sort((a, b) => when(a) - when(b));
}

// candidates: [{ holder, value, detail }] → карточка с максимумом или null.
function pickRecord(base, candidates, format) {
  const max = candidates.reduce((m, c) => Math.max(m, c.value), 0);
  if (max <= 0) return null;
  const top = candidates.filter(c => c.value === max);
  const holders = [...new Set(top.map(c => c.holder))];
  return { ...base, value: format(max), holders, detail: holders.length === 1 ? top[0].detail || null : null };
}

// Счётчики по игрокам ({ name: n }) → кандидаты для pickRecord.
function fromCounts(counts) {
  return Object.entries(counts).map(([holder, value]) => ({ holder, value }));
}

function bump(counts, name, by = 1) {
  counts[name] = (counts[name] || 0) + by;
}

// Самая длинная серия подряд по результатам каждого игрока (в порядке игр).
function bestStreaks(resultsByPlayer, predicate) {
  const best = {};
  Object.entries(resultsByPlayer).forEach(([name, results]) => {
    let run = 0;
    results.forEach(r => {
      run = predicate(r) ? run + 1 : 0;
      best[name] = Math.max(best[name] || 0, run);
    });
  });
  return best;
}

// Один и тот же чемпион турниров подряд. Турнир без победителя рвёт серию.
function championStreaks(chrono, winnerOf) {
  const best = {};
  let current = null;
  let run = 0;
  chrono.forEach(entry => {
    const winner = winnerOf(entry);
    run = winner && winner === current ? run + 1 : winner ? 1 : 0;
    current = winner;
    if (winner) best[winner] = Math.max(best[winner] || 0, run);
  });
  return best;
}

// --- 🥅 Реальный футбол: одна запись = один матч -------------------------

function teamMatchRecords(history) {
  const chrono = chronological(history);
  const matches = [];
  const results = {};
  const hatTricks = {};
  const cleanSheets = {};
  const played = {};
  const ownGoals = {};
  const goalsInMatch = [];
  const assistsInMatch = [];

  chrono.forEach(entry => {
    const teams = getTeams(entry);
    const [s1, s2] = getScores(entry);
    const label = `${teams[0].name} ${s1}:${s2} ${teams[1].name}`;
    const detail = [entry.name, formatMatchDate(entry.playedAt || entry.finishedAt)].filter(Boolean).join(' · ');
    matches.push({ label, detail, total: s1 + s2, margin: Math.abs(s1 - s2) });

    computeMatchStats(entry).forEach(row => {
      (results[row.name] ||= []).push(row.result);
      bump(played, row.name);
      if (row.goals >= 3) bump(hatTricks, row.name);
      if (row.ga === 0) bump(cleanSheets, row.name);
      if (row.ownGoals) bump(ownGoals, row.name, row.ownGoals);
      goalsInMatch.push({ holder: row.name, value: row.goals, detail: label });
      assistsInMatch.push({ holder: row.name, value: row.assists, detail: label });
    });
  });

  return [
    pickRecord({ id: 'top-match', icon: '🎯', title: 'Самый результативный матч' },
      matches.map(m => ({ holder: m.label, value: m.total, detail: m.detail })), n => plural(n, GOALS)),
    pickRecord({ id: 'biggest-win', icon: '💥', title: 'Крупнейшая победа' },
      matches.map(m => ({ holder: m.label, value: m.margin, detail: m.detail })), n => `+${n}`),
    pickRecord({ id: 'goals-in-match', icon: '⚽', title: 'Больше всего голов в матче' }, goalsInMatch, n => plural(n, GOALS)),
    pickRecord({ id: 'hat-tricks', icon: '🎩', title: 'Хет-трики' }, fromCounts(hatTricks), n => plural(n, TIMES)),
    pickRecord({ id: 'assists-in-match', icon: '🅰️', title: 'Больше всего пасов в матче' }, assistsInMatch, n => plural(n, ASSISTS)),
    pickRecord({ id: 'win-streak', icon: '🔥', title: 'Серия побед' },
      fromCounts(bestStreaks(results, r => r === 'win')), n => plural(n, MATCHES)),
    pickRecord({ id: 'unbeaten', icon: '🛡️', title: 'Без поражений подряд' },
      fromCounts(bestStreaks(results, r => r !== 'loss')), n => plural(n, MATCHES)),
    pickRecord({ id: 'clean-sheets', icon: '🧤', title: '«Сухие» матчи' }, fromCounts(cleanSheets), n => plural(n, MATCHES)),
    pickRecord({ id: 'iron-man', icon: '🏃', title: 'Больше всего матчей' }, fromCounts(played), n => plural(n, MATCHES)),
    pickRecord({ id: 'own-goals', icon: '🙈', title: 'Больше всего автоголов' }, fromCounts(ownGoals), n => plural(n, GOALS)),
  ];
}

// --- ⚽ Футбол и 🏓 теннис 1×1: группы и плей-офф ----------------------------

// Повторяет statsFor из HistoryList: сырые матчи, если есть, иначе кеш.
function tournamentStats(entry) {
  if (entry.groups || entry.rounds) return computeTournamentResult(entry).stats;
  return entry.stats || {};
}

function bracketRecords(history, cfg) {
  const unit = cfg.diffLabel === 'Сеты' ? SETS : GOALS;
  const chrono = chronological(history);
  const matches = [];
  const results = {};
  const cleanWins = {};
  const penaltyWins = {};
  const scoredInTournament = [];
  const concededInTournament = [];

  chrono.forEach(entry => {
    const name = entry.name || 'Турнир';
    playedMatches(entry).forEach(m => {
      const label = `${m.t1} ${m.score1}:${m.score2} ${m.t2}`;
      matches.push({ label, detail: name, total: m.score1 + m.score2, margin: Math.abs(m.score1 - m.score2) });
      [[m.t1, m.score2], [m.t2, m.score1]].forEach(([player, conceded]) => {
        const result = m.winner == null ? 'draw' : m.winner === player ? 'win' : 'loss';
        (results[player] ||= []).push(result);
        if (result === 'win' && conceded === 0) bump(cleanWins, player);
        if (result === 'win' && m.penalties) bump(penaltyWins, player);
      });
    });
    Object.entries(tournamentStats(entry)).forEach(([player, s]) => {
      if (!s) return; // Firebase: разрежённый массив вместо объекта
      scoredInTournament.push({ holder: player, value: s.goalsFor || 0, detail: name });
      concededInTournament.push({ holder: player, value: s.goalsAgainst || 0, detail: name });
    });
  });

  const scoredTitle = unit === SETS ? 'Больше всего сетов за турнир' : 'Больше всего забито за турнир';
  const concededTitle = unit === SETS ? 'Больше всего проиграно сетов за турнир' : 'Больше всего пропущено за турнир';
  return [
    pickRecord({ id: 'top-match', icon: '🎯', title: 'Самый результативный матч' },
      matches.map(m => ({ holder: m.label, value: m.total, detail: m.detail })), n => plural(n, unit)),
    pickRecord({ id: 'biggest-win', icon: '💥', title: 'Крупнейшая победа' },
      matches.map(m => ({ holder: m.label, value: m.margin, detail: m.detail })), n => `+${n}`),
    pickRecord({ id: 'win-streak', icon: '🔥', title: 'Серия побед' },
      fromCounts(bestStreaks(results, r => r === 'win')), n => plural(n, MATCHES)),
    pickRecord({ id: 'champion-streak', icon: '🏆', title: 'Чемпион подряд' },
      fromCounts(championStreaks(chrono, e => e.winner)), n => plural(n, TOURNAMENTS)),
    pickRecord({ id: 'scored-in-tournament', icon: '⚡', title: scoredTitle }, scoredInTournament, n => plural(n, unit)),
    pickRecord({ id: 'conceded-in-tournament', icon: '🕳️', title: concededTitle }, concededInTournament, n => plural(n, unit)),
    pickRecord({ id: 'clean-wins', icon: '🧤', title: unit === SETS ? 'Победы всухую' : '«Сухие» победы' },
      fromCounts(cleanWins), n => plural(n, WINS)),
    cfg.hasPenalty
      ? pickRecord({ id: 'penalty-king', icon: '🥅', title: 'Король пенальти' }, fromCounts(penaltyWins), n => plural(n, WINS))
      : null,
  ];
}

// --- 🏓👥 Американо --------------------------------------------------------

function americanoRecords(history) {
  const chrono = chronological(history);
  const matches = [];
  const results = {};
  const pointsInTournament = [];

  chrono.forEach(entry => {
    const name = entry.name || 'Турнир';
    (entry.rounds || []).forEach(round => {
      (round.matches || []).forEach(m => {
        if (!m.played) return;
        const label = `${m.pairA.join(' / ')} ${m.score1}:${m.score2} ${m.pairB.join(' / ')}`;
        matches.push({ label, detail: name, total: m.score1 + m.score2, margin: Math.abs(m.score1 - m.score2) });
        m.pairA.forEach(p => (results[p] ||= []).push(m.score1 > m.score2 ? 'win' : 'loss'));
        m.pairB.forEach(p => (results[p] ||= []).push(m.score2 > m.score1 ? 'win' : 'loss'));
      });
    });
    calcAmericanoStandings(entry).forEach(row => {
      pointsInTournament.push({ holder: row.name, value: row.pf, detail: name });
    });
  });

  const pairs = aggregateAmericanoPairStats(history);
  return [
    pickRecord({ id: 'top-match', icon: '🎯', title: 'Самый результативный матч' },
      matches.map(m => ({ holder: m.label, value: m.total, detail: m.detail })), n => plural(n, POINTS)),
    pickRecord({ id: 'biggest-win', icon: '💥', title: 'Крупнейшая победа' },
      matches.map(m => ({ holder: m.label, value: m.margin, detail: m.detail })), n => `+${n}`),
    pickRecord({ id: 'best-duo', icon: '🤝', title: 'Лучший дуэт' },
      pairs.map(p => ({ holder: p.members.join(' & '), value: p.w, detail: `${p.w}–${p.l}` })), n => plural(n, WINS)),
    pickRecord({ id: 'win-streak', icon: '🔥', title: 'Серия побед' },
      fromCounts(bestStreaks(results, r => r === 'win')), n => plural(n, MATCHES)),
    pickRecord({ id: 'points-in-tournament', icon: '💯', title: 'Больше всего очков за турнир' }, pointsInTournament, n => plural(n, POINTS)),
  ];
}

// --- 🔝 Турник -------------------------------------------------------------

function ladderRecords(history) {
  const chrono = chronological(history);
  const repsInTournament = [];
  const longest = [];
  const podiums = {};
  const totalReps = {};

  chrono.forEach(entry => {
    const name = entry.name || 'Турнир';
    const rows = buildLadderRanking(entry);
    rows.forEach(row => {
      repsInTournament.push({ holder: row.name, value: row.totalReps || 0, detail: name });
      if (row.rank <= 3) bump(podiums, row.name);
      if (row.totalReps) bump(totalReps, row.name, row.totalReps);
    });
    const reached = rows.reduce((max, r) => Math.max(max, r.eliminatedRound ?? entry.round ?? 0), 0);
    const champion = entry.winner || computeLadderResult(entry).winner;
    longest.push({ holder: name, value: reached, detail: champion ? `🏆 ${champion}` : null });
  });

  return [
    pickRecord({ id: 'reps-in-tournament', icon: '💪', title: 'Рекорд подтягиваний за турнир' }, repsInTournament, n => plural(n, REPS)),
    pickRecord({ id: 'longest-tournament', icon: '🪜', title: 'Самый долгий турнир' }, longest, n => plural(n, ROUNDS)),
    pickRecord({ id: 'champion-streak', icon: '🏆', title: 'Чемпион подряд' },
      fromCounts(championStreaks(chrono, e => e.winner || computeLadderResult(e).winner)), n => plural(n, TOURNAMENTS)),
    pickRecord({ id: 'podiums', icon: '🥇', title: 'Больше всего подиумов' }, fromCounts(podiums), n => plural(n, TIMES)),
    pickRecord({ id: 'total-reps', icon: '📈', title: 'Всего подтягиваний' }, fromCounts(totalReps), n => plural(n, REPS)),
  ];
}

export function computeRecords(history, cfg) {
  if (!history.length) return [];
  const records = cfg.engine === 'team-match-log' ? teamMatchRecords(history)
    : cfg.engine === 'americano' ? americanoRecords(history)
    : cfg.engine === 'turnik-ladder' ? ladderRecords(history)
    : bracketRecords(history, cfg);
  return records.filter(Boolean);
}
