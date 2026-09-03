import React from 'react';
import ConfettiEffect from './ConfettiEffect.jsx';
import { downloadTournamentJson } from '../../utils/exportTournament.js';

const habibTrophySrc = `${import.meta.env.BASE_URL}prince_habibu.jpg`;

// Подписи вынесены в пропсы: «реальный футбол» закрывает не турнир, а набор
// матчей, и его победитель — лучшая команда, а не чемпион турнира.
export default function WinnerBanner({
  tournament, celebrate, onNewTournament, onReopen, readOnly = false,
  label = 'Победитель турнира',
  icon = '🏆',
  subLabel = null,
  subText = null,
  reopenLabel = '↩️ Вернуть турнир (исправить)',
  newLabel = '🔁 Новый турнир',
  reopenPrompt = 'Вернуть турнир в игру и снять пометку "завершён"? Можно будет исправить любой матч.',
}) {
  function handleReopen() {
    if (confirm(reopenPrompt)) {
      onReopen();
    }
  }
  const participantMeta = tournament.participantMeta || tournament.playerMeta || {};
  const winnerMeta = participantMeta[tournament.winner];
  const winnerNameParts = [
    tournament.winner,
    ...(winnerMeta?.members || []),
  ].flatMap(name => String(name || '').split(/[&/+]/));
  const isHabibWinner = winnerNameParts.some(name => name.trim().toLocaleLowerCase('ru-RU') === 'хабиб');

  return (
    <>
      {celebrate && <ConfettiEffect key={tournament.winner} />}
      <div className="card" id="winner-section">
        {isHabibWinner ? (
          <img className="habib-trophy" src={habibTrophySrc} alt="Prince Habibu" />
        ) : (
          <span className="trophy">{icon}</span>
        )}
        <div className="winner-label">{label}</div>
        <div className="winner-name">{tournament.winner}</div>
        <div className="winner-sub">{subText || <>{icon} {subLabel || 'Чемпион турнира'} «{tournament.name}»</>}</div>
        <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-export" onClick={() => downloadTournamentJson(tournament)}>📤 Экспорт результатов</button>
          {!readOnly && <button className="btn btn-secondary" onClick={handleReopen}>{reopenLabel}</button>}
          {!readOnly && <button className="btn btn-reset" onClick={onNewTournament}>{newLabel}</button>}
        </div>
      </div>
    </>
  );
}
