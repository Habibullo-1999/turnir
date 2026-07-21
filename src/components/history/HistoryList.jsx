import React, { useCallback, useEffect, useState } from 'react';
import { listHistory, reopenFinishedTournament } from '../../services/tournaments.js';
import { computeTournamentResult } from '../../utils/computeStats.js';
import HistoryModal from './HistoryModal.jsx';

const FORMAT_LABEL = { playoff: '🏆 Плей-офф', group: '📊 Групповой', 'group+playoff': '📊→🏆 Группы+ПО', league: '🏅 Лига' };
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
      if (!allStats[player]) allStats[player] = { wins: 0, draws: 0, losses: 0, played: 0, tournaments: 0, trophies: 0, goalsFor: 0, goalsAgainst: 0 };
      allStats[player].wins += s.wins || 0;
      allStats[player].draws += s.draws || 0;
      allStats[player].losses += s.losses ?? (s.played || 0) - (s.wins || 0);
      allStats[player].played += s.played || 0;
      allStats[player].tournaments++;
      allStats[player].goalsFor += s.goalsFor || 0;
      allStats[player].goalsAgainst += s.goalsAgainst || 0;
      if (entry.winner === player) allStats[player].trophies++;
    });
  });
  return Object.entries(allStats).sort((a, b) => b[1].trophies - a[1].trophies || b[1].wins - a[1].wins);
}

export default function HistoryList() {
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openEntry, setOpenEntry] = useState(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listHistory()
      .then(setHistory)
      .catch(err => setError(`Не удалось загрузить историю: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [history.length]);

  async function handleReopen(entry) {
    if (!confirm(`Вернуть турнир «${entry.name || 'Турнир'}» в игру и снять пометку "завершён"?`)) return;
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

  const sortedStats = aggregateStats(history);
  const listDesc = history; // already sorted newest-first by listHistory()
  const totalPages = Math.max(1, Math.ceil(listDesc.length / PAGE_SIZE));
  const pageItems = listDesc.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="card" id="history-section">
      <div className="card-title">История и статистика</div>

      {sortedStats.length > 0 && (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Игрок</th><th>🏆</th><th>Игр</th><th>✅</th><th>🤝</th><th>❌</th><th>⚽</th><th>🚫</th><th>±</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map(([name, s], i) => {
              const isChamp = i === 0 && s.trophies > 0;
              const diff = s.goalsFor - s.goalsAgainst;
              return (
                <tr key={name}>
                  <td>{isChamp ? '👑 ' : ''}{name}</td>
                  <td className="td-gold">{s.trophies}</td>
                  <td>{s.played}</td>
                  <td className="td-green">{s.wins}</td>
                  <td>{s.draws}</td>
                  <td className="td-red">{s.losses}</td>
                  <td>{s.goalsFor}</td>
                  <td>{s.goalsAgainst}</td>
                  <td className={diff > 0 ? 'td-green' : diff < 0 ? 'td-red' : ''}>{diff > 0 ? '+' : ''}{diff}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="history-list">
        {pageItems.map(entry => (
          <div className="history-item" key={entry.id}>
            <div>
              <div className="history-item-name">{entry.name || 'Турнир'}</div>
              <div className="history-item-meta">
                {entry.date} · {(entry.players || []).length} участников · {FORMAT_LABEL[entry.format] || '🏆 Плей-офф'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="history-item-winner">{entry.winner ? '🏆 ' + entry.winner : '—'}</div>
              <button className="btn btn-reset" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => setOpenEntry(entry)}>📊 Сетка</button>
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

      {openEntry && <HistoryModal entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </div>
  );
}
