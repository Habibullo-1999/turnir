import React, { useCallback, useEffect, useState } from 'react';
import { listActive } from '../../services/tournaments.js';
import { useTournament } from '../../context/TournamentContext.jsx';

const FORMAT_LABEL = { playoff: '🏆 Плей-офф', group: '📊 Групповой', 'group+playoff': '📊→🏆 Группы + Плей-офф', league: '🏅 Лига' };

export default function ActiveTournamentsList({ onOpen }) {
  const { openTournament } = useTournament();
  const [tournaments, setTournaments] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listActive()
      .then(setTournaments)
      .catch(err => setError(`Не удалось загрузить список турниров: ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleContinue(t) {
    await openTournament(t.id);
    onOpen();
  }

  if (loading) return null;

  if (error) {
    return (
      <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 8 }}>⚠️ {error}</div>
        <button className="btn btn-secondary" onClick={load}>Повторить</button>
      </div>
    );
  }

  if (!tournaments.length) return null;

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--green)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'block', width: 3, height: 14, background: 'var(--green)', borderRadius: 2 }} />
        Турниры в процессе
      </div>
      <div className="saves-list">
        {tournaments.map(t => (
          <div className="save-item" key={t.id}>
            <div className="save-item-info">
              <div className="save-item-name">{t.name || 'Без названия'}</div>
              <div className="save-item-meta">
                {FORMAT_LABEL[t.format] || t.format || ''} · {(t.players || []).length} участников
              </div>
            </div>
            <button className="pause-btn" onClick={() => handleContinue(t)}>▶ Продолжить</button>
          </div>
        ))}
      </div>
    </div>
  );
}
