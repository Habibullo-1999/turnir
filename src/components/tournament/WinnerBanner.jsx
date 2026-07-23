import React from 'react';
import ConfettiEffect from './ConfettiEffect.jsx';
import { downloadTournamentJson } from '../../utils/exportTournament.js';
import { displayParticipantName } from '../../utils/sportConfig.js';

export default function WinnerBanner({ tournament, celebrate, onNewTournament, onReopen, readOnly = false }) {
  function handleReopen() {
    if (confirm('Вернуть турнир в игру и снять пометку "завершён"? Можно будет исправить любой матч.')) {
      onReopen();
    }
  }

  const winnerName = displayParticipantName(tournament, tournament.winner);

  return (
    <>
      {celebrate && <ConfettiEffect key={tournament.winner} />}
      <div className="card" id="winner-section">
        <span className="trophy">🏆</span>
        <div className="winner-label">Победитель турнира</div>
        <div className="winner-name">{winnerName}</div>
        <div className="winner-sub">🏆 Чемпион турнира «{tournament.name}»</div>
        <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-export" onClick={() => downloadTournamentJson(tournament)}>📤 Экспорт результатов</button>
          {!readOnly && <button className="btn btn-secondary" onClick={handleReopen}>↩️ Вернуть турнир (исправить)</button>}
          {!readOnly && <button className="btn btn-reset" onClick={onNewTournament}>🔁 Новый турнир</button>}
        </div>
      </div>
    </>
  );
}
