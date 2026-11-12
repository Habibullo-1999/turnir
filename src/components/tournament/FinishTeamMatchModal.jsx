import React, { useEffect, useRef, useState } from 'react';
import { getTeams, matchResult, pluralGoals } from '../../utils/teamMatchLog.js';

export default function FinishTeamMatchModal({ match, saveError, onConfirm, onClose }) {
  const dialogRef = useRef(null);
  const teams = getTeams(match);
  const { topScorerCandidates } = matchResult(match);
  const [bestPlayer, setBestPlayer] = useState(match.bestPlayer || '');
  const [topScorer, setTopScorer] = useState(match.topScorerName || '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState(null);
  const hasBestPlayer = teams.some(team => team.players.includes(bestPlayer));
  const needsScorer = topScorerCandidates.length > 1;
  const hasScorer = topScorerCandidates.some(row => row.name === topScorer);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (saving || !hasBestPlayer || (needsScorer && !hasScorer)) return;
    setSaving(true);
    setFailed(false);
    setError(null);
    try {
      setFailed(!(await onConfirm(bestPlayer, needsScorer ? topScorer : undefined)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="penalty-modal-card tml-finish-dialog"
      aria-labelledby="finish-match-title"
      onCancel={event => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <h2 id="finish-match-title" className="penalty-modal-title">Завершение матча</h2>
      <form onSubmit={submit}>
        <label className="tml-field">
          <span>Лучший игрок матча</span>
          <select className="tml-text-input" value={hasBestPlayer ? bestPlayer : ''} onChange={event => setBestPlayer(event.target.value)} disabled={saving} required>
            <option value="" disabled>Выберите игрока</option>
            {teams.map((team, side) => (
              <optgroup key={side} label={team.name}>
                {team.players.map(player => <option key={player}>{player}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {needsScorer && (
          <label className="tml-field">
            <span>Лучший бомбардир</span>
            <select className="tml-text-input" value={hasScorer ? topScorer : ''} onChange={event => setTopScorer(event.target.value)} disabled={saving} required>
              <option value="" disabled>Выберите бомбардира</option>
              {topScorerCandidates.map(row => (
                <option key={row.name} value={row.name}>{row.name} — {pluralGoals(row.goals)}</option>
              ))}
            </select>
          </label>
        )}
        {(error || failed) && <div role="alert" className="tml-add-error">{error || saveError || 'Не удалось завершить матч.'}</div>}
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={saving || !hasBestPlayer || (needsScorer && !hasScorer)}>
            {saving ? 'Сохраняем…' : 'Завершить матч'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Отмена</button>
        </div>
      </form>
    </dialog>
  );
}
