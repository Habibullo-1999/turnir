import React, { useCallback, useEffect, useState } from 'react';
import { listHistory, reopenFinishedTournament } from '../../services/tournaments.js';
import { computeTournamentResult } from '../../utils/computeStats.js';
import { buildLadderRanking } from '../../utils/ladder.js';
import { DRAW_LABEL, computeMatchStats, getScores, matchResult, pluralPlayers } from '../../utils/teamMatchLog.js';
import { SPORT_CONFIG, getSportConfig, FOOTBALL } from '../../utils/sportConfig.js';
import HistoryModal from './HistoryModal.jsx';

const FORMAT_LABEL = { playoff: '🏆 Плей-офф', group: '📊 Групповой', 'group+playoff': '📊→🏆 Группы+ПО', league: '🏅 Лига' };
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const PAGE_SIZE = 10;

// Recomputes from the raw match data instead of trusting `entry.stats`, which
// is only a cache written once when the tournament finished — it can be
// stale (e.g. it predates a fix to the win/draw/loss counting logic) while
// the underlying groups/rounds are always accurate. Falls back to the cached
// snapshot for legacy entries migrated without raw match data.
function statsFor(entry) {
  if (entry.groups || entry.rounds) return computeTournamentResult(entry).stats;
  return entry.stats || {};
}

function aggregateStats(history) {
  const allStats = {};
  history.forEach(entry => {
    Object.entries(statsFor(entry)).forEach(([player, s]) => {
      // Firebase stores objects keyed by small-integer-like strings (e.g. a
      // player literally named "1") as sparse arrays, so entry 0 can be null.
      if (!s) return;
      if (!allStats[player]) allStats[player] = { wins: 0, draws: 0, losses: 0, played: 0, tournaments: 0, trophies: 0, goalsFor: 0, goalsAgainst: 0, championships: [] };
      allStats[player].wins += s.wins || 0;
      allStats[player].draws += s.draws || 0;
      allStats[player].losses += s.losses ?? (s.played || 0) - (s.wins || 0);
      allStats[player].played += s.played || 0;
      allStats[player].tournaments++;
      allStats[player].goalsFor += s.goalsFor || 0;
      allStats[player].goalsAgainst += s.goalsAgainst || 0;
      if (entry.winner === player) {
        const participantMeta = entry.participantMeta || entry.playerMeta || {};
        allStats[player].trophies++;
        allStats[player].championships.push({
          tournament: entry.name || 'Турнир',
          club: participantMeta[player]?.club || 'Команда не указана',
        });
      }
    });
  });
  return Object.entries(allStats).sort((a, b) => b[1].trophies - a[1].trophies || b[1].wins - a[1].wins);
}

function aggregateLadderStats(history) {
  const allStats = {};
  history.forEach(entry => {
    buildLadderRanking(entry).forEach(row => {
      if (!allStats[row.name]) allStats[row.name] = { tournaments: 0, gold: 0, silver: 0, bronze: 0, bestRound: 0, totalReps: 0 };
      const s = allStats[row.name];
      s.tournaments++;
      if (row.rank === 1) s.gold++;
      else if (row.rank === 2) s.silver++;
      else if (row.rank === 3) s.bronze++;
      const survivedRounds = row.eliminatedRound != null ? row.eliminatedRound - 1 : (entry.round || 1);
      if (survivedRounds > s.bestRound) s.bestRound = survivedRounds;
      s.totalReps += row.totalReps || 0;
    });
  });
  return Object.entries(allStats).sort((a, b) => b[1].gold - a[1].gold || b[1].bestRound - a[1].bestRound);
}

// Партнёры в «Американо» меняются каждый раунд, поэтому нет смысла в личном
// зачёте между турнирами — вместо этого считаем, как сыгрались конкретные
// пары (по всем раундам всех турниров этого вида спорта), не только личный
// счёт каждого игрока в TurnikLadder/AmericanoBoard.
function pairKey(pair) {
  return pair.slice().sort((a, b) => a.localeCompare(b, 'ru')).join(' & ');
}

function creditPair(table, pair, pf, pa) {
  if (pair.length < 2) return; // сольная сторона матча 1×2 — тут нет пары
  const key = pairKey(pair);
  if (!table[key]) table[key] = { members: pair.slice().sort((a, b) => a.localeCompare(b, 'ru')), played: 0, w: 0, l: 0, pf: 0, pa: 0 };
  const s = table[key];
  s.played++;
  s.pf += pf;
  s.pa += pa;
  if (pf > pa) s.w++;
  else if (pa > pf) s.l++;
}

function aggregateAmericanoPairStats(history) {
  const table = {};
  history.forEach(entry => {
    (entry.rounds || []).forEach(round => {
      round.matches.forEach(m => {
        if (!m.played) return;
        creditPair(table, m.pairA, m.score1, m.score2);
        creditPair(table, m.pairB, m.score2, m.score1);
      });
    });
  });
  return Object.values(table).sort((a, b) => b.w - a.w || (b.pf - b.pa) - (a.pf - a.pa));
}

// «Реальный футбол»: сквозной личный зачёт по всем сыгранным матчам — сколько
// человек забил, сколько сыграл, сколько выиграл и сколько раз был лучшим
// бомбардиром матча. Пересчитывается из сырых матчей, кеш `stats` не нужен.
function aggregateTeamMatchStats(history) {
  const allStats = {};
  history.forEach(entry => {
    const topScorer = matchResult(entry).topScorer;
    computeMatchStats(entry).forEach(row => {
      if (!allStats[row.name]) {
        allStats[row.name] = { played: 0, goals: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, boots: 0 };
      }
      const s = allStats[row.name];
      s.played++;
      s.goals += row.goals;
      s.gf += row.gf;
      s.ga += row.ga;
      if (row.result === 'win') s.wins++;
      else if (row.result === 'loss') s.losses++;
      else s.draws++;
      if (topScorer && topScorer.name === row.name) s.boots++;
    });
  });
  return Object.entries(allStats).sort((a, b) =>
    b[1].goals - a[1].goals || b[1].wins - a[1].wins || b[1].played - a[1].played);
}

function metaLabel(entry, cfg) {
  if (cfg.engine === 'turnik-ladder') return `${cfg.icon} Турник`;
  if (cfg.engine === 'americano') return `${cfg.icon} Американо`;
  if (cfg.engine === 'team-match-log') {
    const [s1, s2] = getScores(entry);
    return `${cfg.icon} ${s1} : ${s2}`;
  }
  return FORMAT_LABEL[entry.format] || '🏆 Плей-офф';
}

// Старые (мигрированные) записи не всегда содержат `finishedAt` — тогда
// разбираем `date` (ДД.ММ.ГГГГ), а если и его нет — числовой префикс id
// (старые id были просто таймстемпом, см. sortKey в services/tournaments.js).
function getFinishDate(entry) {
  if (entry.finishedAt) return new Date(entry.finishedAt);
  if (entry.date) {
    const [d, m, y] = entry.date.split('.').map(Number);
    if (d && m && y) return new Date(y, m - 1, d);
  }
  const numericId = parseInt(entry.id, 10);
  if (!Number.isNaN(numericId)) return new Date(numericId);
  return null;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildPeriodOptions(history) {
  const years = new Set();
  const months = new Set();
  history.forEach(entry => {
    const d = getFinishDate(entry);
    if (!d) return;
    years.add(d.getFullYear());
    months.add(monthKey(d));
  });
  return {
    years: [...years].sort((a, b) => b - a),
    months: [...months].sort((a, b) => b.localeCompare(a)),
  };
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function matchesPeriod(entry, period) {
  if (period === 'all') return true;
  const d = getFinishDate(entry);
  if (!d) return false;
  if (period.startsWith('year:')) return String(d.getFullYear()) === period.slice(5);
  if (period.startsWith('month:')) return monthKey(d) === period.slice(6);
  return true;
}

export default function HistoryList() {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openEntry, setOpenEntry] = useState(null);
  const [page, setPage] = useState(1);
  const [sportFilter, setSportFilter] = useState(FOOTBALL);
  const [period, setPeriod] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listHistory()
      .then(setHistory)
      .catch(err => setError(`Не удалось загрузить историю: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [history.length, sportFilter, period]);
  useEffect(() => { setPeriod('all'); }, [sportFilter]);

  async function handleReopen(entry) {
    if (!confirm(`Вернуть «${entry.name || 'Турнир'}» в работу и снять пометку "завершён"?`)) return;
    await reopenFinishedTournament(entry);
    load();
  }

  if (loading) return <div className="card">Загрузка истории…</div>;
  if (error) {
    return (
      <div className="card">
        <div style={{ color: 'var(--red)', marginBottom: 8 }}>⚠️ {error}</div>
        <button className="btn btn-secondary" onClick={load}>Повторить</button>
      </div>
    );
  }
  if (!history.length) {
    return <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Пока нет завершённых турниров.</div>;
  }

  const cfg = getSportConfig(sportFilter);
  const isTurnik = cfg.engine === 'turnik-ladder';
  const isAmericano = cfg.engine === 'americano';
  const isTeamMatchLog = cfg.engine === 'team-match-log';
  const sportHistory = history.filter(entry => (entry.sport || FOOTBALL) === sportFilter);
  const { years, months } = buildPeriodOptions(sportHistory);
  const periodHistory = sportHistory.filter(entry => matchesPeriod(entry, period));
  const sortedStats = isTurnik ? aggregateLadderStats(periodHistory)
    : isAmericano ? aggregateAmericanoPairStats(periodHistory)
    : isTeamMatchLog ? aggregateTeamMatchStats(periodHistory)
    : aggregateStats(periodHistory);
  const listDesc = periodHistory; // already sorted newest-first by listHistory()
  const totalPages = Math.max(1, Math.ceil(listDesc.length / PAGE_SIZE));
  const pageItems = listDesc.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="card" id="history-section">
      <div className="card-title">История и статистика</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.values(SPORT_CONFIG).map(sc => (
          <button
            key={sc.sport}
            type="button"
            className={'format-btn' + (sportFilter === sc.sport ? ' active' : '')}
            onClick={() => setSportFilter(sc.sport)}
          >
            {sc.icon} {sc.label}
          </button>
        ))}
      </div>

      {(years.length > 0 || months.length > 0) && (
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '7px 10px', fontSize: '0.85rem', fontFamily: 'inherit' }}
        >
          <option value="all">Всё время</option>
          {years.length > 0 && (
            <optgroup label="Год">
              {years.map(y => <option key={y} value={`year:${y}`}>{y}</option>)}
            </optgroup>
          )}
          {months.length > 0 && (
            <optgroup label="Месяц">
              {months.map(m => <option key={m} value={`month:${m}`}>{monthLabel(m)}</option>)}
            </optgroup>
          )}
        </select>
      )}

      {!periodHistory.length ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>Нет завершённых турниров за этот период.</div>
      ) : (
        <>
          {isTurnik && sortedStats.length > 0 && (
            <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Игрок</th><th>Турниров</th><th>🥇</th><th>🥈</th><th>🥉</th><th>Лучший результат</th><th>Всего подтягиваний</th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map(([name, s], i) => (
                  <tr key={name}>
                    <td>{i === 0 && s.gold > 0 ? '👑 ' : ''}{name}</td>
                    <td>{s.tournaments}</td>
                    <td className="td-gold">{s.gold}</td>
                    <td>{s.silver}</td>
                    <td>{s.bronze}</td>
                    <td>{s.bestRound}</td>
                    <td>{s.totalReps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {isAmericano && sortedStats.length > 0 && (
            <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Пара</th><th>Матчей</th><th>✅</th><th>❌</th><th>Очки</th><th>±</th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map(s => {
                  const diff = s.pf - s.pa;
                  return (
                    <tr key={s.members.join('&')}>
                      <td>{s.members.join(' / ')}</td>
                      <td>{s.played}</td>
                      <td className="td-green">{s.w}</td>
                      <td className="td-red">{s.l}</td>
                      <td>{s.pf}:{s.pa}</td>
                      <td className={diff > 0 ? 'td-green' : diff < 0 ? 'td-red' : ''}>{diff > 0 ? '+' : ''}{diff}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}

          {isTeamMatchLog && sortedStats.length > 0 && (
            <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Игрок</th><th title="Сколько раз был лучшим бомбардиром матча">👟</th>
                  <th>Матчей</th><th title="Голы">⚽</th>
                  <th>✅</th><th>🤝</th><th>❌</th><th title="Голов за матч">⚽/М</th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map(([name, s], i) => (
                  <tr key={name}>
                    <td>{i === 0 && s.goals > 0 ? '👟 ' : ''}{name}</td>
                    <td className="td-gold">{s.boots}</td>
                    <td>{s.played}</td>
                    <td className="td-green">{s.goals}</td>
                    <td className="td-green">{s.wins}</td>
                    <td>{s.draws}</td>
                    <td className="td-red">{s.losses}</td>
                    <td>{s.played ? (s.goals / s.played).toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {!isTurnik && !isAmericano && !isTeamMatchLog && sortedStats.length > 0 && (
            <div className="table-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Игрок</th><th>🏆</th><th>Игр</th><th>✅</th>
                  {cfg.hasDraws && <th>🤝</th>}
                  <th>❌</th><th>{cfg.diffLabel}</th><th>🚫</th><th>±</th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map(([name, s], i) => {
                  const isChamp = i === 0 && s.trophies > 0;
                  const diff = s.goalsFor - s.goalsAgainst;
                  const championshipsTooltip = s.championships.length
                    ? `Чемпионские команды:\n${s.championships.map(({ club, tournament }) => `${club} — ${tournament}`).join('\n')}`
                    : undefined;
                  return (
                    <tr key={name}>
                      <td>{isChamp ? '👑 ' : ''}{name}</td>
                      <td className="td-gold" title={championshipsTooltip}>{s.trophies}</td>
                      <td>{s.played}</td>
                      <td className="td-green">{s.wins}</td>
                      {cfg.hasDraws && <td>{s.draws}</td>}
                      <td className="td-red">{s.losses}</td>
                      <td>{s.goalsFor}</td>
                      <td>{s.goalsAgainst}</td>
                      <td className={diff > 0 ? 'td-green' : diff < 0 ? 'td-red' : ''}>{diff > 0 ? '+' : ''}{diff}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}

          <div className="history-list">
            {pageItems.map(entry => (
              <div className="history-item" key={entry.id}>
                <div>
                  <div className="history-item-name">{entry.name || 'Турнир'}</div>
                  <div className="history-item-meta">
                    {entry.date} · {(entry.players || []).length} {cfg.unitNoun} · {metaLabel(entry, cfg)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div className="history-item-winner">{entry.winner ? `${entry.winner === DRAW_LABEL ? '🤝' : '🏆'} ${entry.winner}` : '—'}</div>
                  <button className="btn btn-reset" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => setOpenEntry(entry)}>{isTeamMatchLog ? '📊 Матч' : '📊 Сетка'}</button>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => handleReopen(entry)}>↩️ Вернуть</button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="history-pagination">
              <button className="btn btn-reset" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Назад</button>
              <span>Страница {page} из {totalPages}</span>
              <button className="btn btn-reset" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Вперёд →</button>
            </div>
          )}
        </>
      )}

      {openEntry && <HistoryModal entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </div>
  );
}
