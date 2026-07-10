import React, { useCallback, useEffect, useState } from 'react';
import { listHistory, reopenFinishedTournament } from '../../services/tournaments.js';
import HistoryModal from './HistoryModal.jsx';

const FORMAT_LABEL = { playoff: '🏆 Плей-офф', group: '📊 Групповой', 'group+playoff': '📊→🏆 Группы+ПО', league: '🏅 Лига' };
const PAGE_SIZE = 10;

function aggregateStats(history) {
  const allStats = {};
  history.forEach(entry => {
    Object.entries(entry.stats || {}).forEach(([player, s]) => {
      // Firebase stores objects keyed by small-integer-like strings (e.g. a
      // player literally named "1") as sparse arrays, so entry 0 can be null.
      if (!s) return;
      if (!allStats[player]) allStats[player] = { wins: 0, played: 0, tournaments: 0, trophies: 0, goalsFor: 0, goalsAgainst: 0 };
      allStats[player].wins += s.wins || 0;
      allStats[player].played += s.played || 0;
      allStats[player].tournaments++;
      allStats[player].goalsFor += s.goalsFor || 0;
      allStats[player].goalsAgainst += s.goalsAgainst || 0;
      if (entry.winner === player) allStats[player].trophies++;
    });
  });
  return Object.entries(allStats).sort((a, b) => b[1].trophies - a[1].trophies || b[1].wins - a[1].wins);
}

function collectPlayerClubs(history) {
  const playerClubs = {};
  history.forEach(e => {
    Object.entries(e.playerMeta || {}).forEach(([p, m]) => {
      if (!m || !m.club) return;
      if (!playerClubs[p]) playerClubs[p] = new Map();
      const existing = playerClubs[p].get(m.club);
      if (existing) existing.count++;
      else playerClubs[p].set(m.club, { ...m, count: 1 });
    });
  });
  return playerClubs;
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
  const playerClubs = collectPlayerClubs(history);
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
              <th>Игрок</th><th>Клуб</th><th>🏆</th><th>✅</th><th>❌</th><th>⚽</th><th>🚫</th><th>±</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map(([name, s], i) => {
              const isChamp = i === 0 && s.trophies > 0;
              const losses = s.played - s.wins;
              const diff = s.goalsFor - s.goalsAgainst;
              const clubs = playerClubs[name];
              return (
                <tr key={name}>
                  <td>{isChamp ? '👑 ' : ''}{name}</td>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    {clubs && clubs.size ? Array.from(clubs.values()).sort((a, b) => b.count - a.count).map(cm => (
                      <span key={cm.club} title={`${cm.club}${cm.league ? ' · ' + cm.league : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginRight: 6 }}>
                        {cm.icon
                          ? <img src={`${import.meta.env.BASE_URL}${cm.icon}`} style={{ width: 18, height: 18, objectFit: 'contain', verticalAlign: 'middle' }} alt="" />
                          : <span style={{ fontSize: '0.95rem' }}>{cm.flag || '⚽'}</span>}
                        {cm.count > 1 && <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginLeft: 1 }}>{cm.count}</span>}
                      </span>
                    )) : '—'}
                  </td>
                  <td className="td-gold">{s.trophies}</td>
                  <td className="td-green">{s.wins}</td>
                  <td className="td-red">{losses}</td>
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
