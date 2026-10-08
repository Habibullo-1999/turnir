import React, { useState } from 'react';
import ConfirmDeleteModal from '../ConfirmDeleteModal.jsx';
import { getParticipantRemovalError, participantRemovalDescription } from '../../utils/removeParticipant.js';

export default function ParticipantRemoval({ tournament, onRemove }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [error, setError] = useState(null);
  const players = Array.isArray(tournament.players) ? tournament.players : Object.values(tournament.players || {}).filter(Boolean);
  const meta = tournament.participantMeta || tournament.playerMeta || {};

  function confirmRemoval() {
    setError(null);
    try {
      onRemove(selectedPlayer);
      setSelectedPlayer(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Участники</div>
      <div className="participant-management-list">
        {players.map(player => {
          const unavailable = getParticipantRemovalError(tournament, player);
          return (
            <div className="participant-management-row" key={player}>
              <div className="participant-management-name">
                <span>{player}</span>
                {meta[player]?.club && <span className="field-hint">{meta[player].club}</span>}
                {unavailable && <span className="field-hint">{unavailable}</span>}
              </div>
              <button
                type="button"
                className="participant-remove-btn"
                aria-label={`Удалить участника ${player}`}
                disabled={Boolean(unavailable)}
                title={unavailable || 'Удалить участника'}
                onClick={() => { setSelectedPlayer(player); setError(null); }}
              >Удалить</button>
            </div>
          );
        })}
      </div>
      {selectedPlayer !== null && (
        <ConfirmDeleteModal
          title={`Удалить участника «${selectedPlayer}»?`}
          description={`${participantRemovalDescription(tournament)} Это действие нельзя отменить.`}
          error={error}
          onConfirm={confirmRemoval}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
