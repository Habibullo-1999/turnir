import React, { useCallback, useEffect, useState } from 'react';
import GroupStage from '../tournament/GroupStage.jsx';
import Bracket from '../tournament/Bracket.jsx';
import WinnerBanner from '../tournament/WinnerBanner.jsx';
import { getTournament } from '../../services/tournaments.js';

const FORMAT_LABEL = { playoff: '🏆 Плей-офф', group: '📊 Групповой', 'group+playoff': '📊→🏆 Группы + Плей-офф', league: '🏅 Лига' };
const REFRESH_SECONDS = 30;
const noop = () => {};

export default function ViewOnlyPage({ id }) {
  const [tournament, setTournament] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);

  const load = useCallback(() => {
    getTournament(id)
      .then(found => {
        if (!found) setNotFound(true);
        else { setTournament(found); setNotFound(false); }
      })
      .catch(() => { /* transient error: keep showing the last good snapshot */ });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { load(); return REFRESH_SECONDS; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [load]);

  if (notFound) {
    return <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Турнир не найден или завершён.</div>;
  }
  if (!tournament) return null;

  const isGroupFormat = tournament.format === 'group' || tournament.format === 'group+playoff' || tournament.format === 'league';

  return (
    <div>
      <div className="view-only-banner">
        <span className="live-dot" />
        LIVE · Режим просмотра — редактирование недоступно
      </div>
      <div className="container">
        <div className="vo-hero">
          <div className="vo-hero-name">{tournament.name || 'Турнир'}</div>
          <div className="vo-hero-sub">{FORMAT_LABEL[tournament.format] || ''} · {(tournament.players || []).length} участников</div>
          <div className="vo-refresh">
            <span>Обновление через <span>{countdown}</span> сек</span>
            <div className="vo-refresh-bar"><div className="vo-refresh-bar-fill" style={{ width: `${(countdown / REFRESH_SECONDS) * 100}%` }} /></div>
          </div>
        </div>

        {isGroupFormat && tournament.groups?.length > 0 && (
          <GroupStage tournament={tournament} editable={false} onConfirmMatch={noop} onEditMatch={noop} onAdvance={noop} />
        )}
        {tournament.rounds?.length > 0 && (
          <Bracket tournament={tournament} editable={false} onConfirm={noop} onNeedPenalty={noop} onEdit={noop} />
        )}
        {tournament.status === 'finished' && tournament.winner && (
          <WinnerBanner tournament={tournament} celebrate={false} readOnly />
        )}
      </div>
    </div>
  );
}
