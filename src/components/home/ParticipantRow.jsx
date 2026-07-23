import React from 'react';
import ClubAutocomplete from './ClubAutocomplete.jsx';

export default function ParticipantRow({ name, club, onNameChange, onClubChange, onRemove, showClub = true }) {
  return (
    <div className="participant-row">
      <input
        type="text"
        className="p-name"
        placeholder="Имя участника"
        value={name}
        onChange={e => onNameChange(e.target.value)}
      />
      {showClub && <ClubAutocomplete club={club} onSelect={onClubChange} />}
      <button type="button" className="p-remove" onClick={onRemove}>✕</button>
    </div>
  );
}
