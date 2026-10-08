import React, { useRef, useState } from 'react';
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx';
import { deleteTournament } from '../services/tournaments.js';
import { useTournament } from '../context/TournamentContext.jsx';

export default function DeleteTournamentButton({ tournament, onDeleted, className = 'participant-remove-btn', label = 'Удалить турнир' }) {
  const { tournament: currentTournament, closeTournament } = useTournament();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const pendingRef = useRef(false);

  async function handleConfirm() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setDeleting(true);
    setError(null);
    try {
      await deleteTournament(tournament);
    } catch (err) {
      setError(`Не удалось удалить турнир: ${err.message}`);
      return;
    } finally {
      pendingRef.current = false;
      setDeleting(false);
    }
    setShowConfirm(false);
    if (currentTournament?.id === tournament.id) closeTournament();
    onDeleted();
  }

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={`Удалить турнир ${tournament.name || 'Без названия'}`}
        onClick={() => { setError(null); setShowConfirm(true); }}
      >{label}</button>
      {showConfirm && (
        <ConfirmDeleteModal
          title={`Удалить турнир «${tournament.name || 'Без названия'}»?`}
          description="Турнир, его участники и все результаты будут удалены из списка турниров и истории. Это действие нельзя отменить."
          busy={deleting}
          error={error}
          onConfirm={handleConfirm}
          onClose={() => { if (!pendingRef.current) setShowConfirm(false); }}
        />
      )}
    </>
  );
}
