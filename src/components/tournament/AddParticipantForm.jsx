import React, { useState } from 'react';
import ClubAutocomplete from '../home/ClubAutocomplete.jsx';
import { getParticipantAdditionError } from '../../utils/participantActions.js';

export default function AddParticipantForm({ tournament, onAdd }) {
  const [name, setName] = useState('');
  const [club, setClub] = useState(null);
  const [groupIndex, setGroupIndex] = useState('');
  const [error, setError] = useState(null);
  const unavailable = getParticipantAdditionError(tournament);
  const chooseGroup = tournament.format !== 'playoff' && tournament.groups.length > 1;

  function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    try {
      onAdd({ name, club, groupIndex: chooseGroup ? (groupIndex === '' ? null : Number(groupIndex)) : 0 });
      setName('');
      setClub(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Добавить участника</div>
      {unavailable ? <div className="field-hint">{unavailable}</div> : (
        <form className="add-participant-form" onSubmit={handleSubmit}>
          <div className="participant-row">
            <input
              type="text"
              className="p-name"
              placeholder="Имя участника"
              aria-label="Имя участника"
              value={name}
              onChange={event => setName(event.target.value)}
              required
            />
            <ClubAutocomplete club={club} onSelect={setClub} />
          </div>
          <div className="rearrange-row">
            {chooseGroup && (
              <select aria-label="Группа участника" value={groupIndex} onChange={event => setGroupIndex(event.target.value)} required>
                <option value="" disabled>Выберите группу</option>
                {tournament.groups.map((group, index) => <option key={index} value={index}>{group.name}</option>)}
              </select>
            )}
            <button type="submit" className="btn btn-secondary" disabled={!name.trim() || (chooseGroup && groupIndex === '')}>
              + Добавить участника
            </button>
          </div>
          {tournament.format === 'playoff' && <div className="field-hint">Участник займёт место BYE. Если свободных мест нет, сетка расширится.</div>}
          {error && <div className="participant-add-error" role="alert">{error}</div>}
        </form>
      )}
    </div>
  );
}
