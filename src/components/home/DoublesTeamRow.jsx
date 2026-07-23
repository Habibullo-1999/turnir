import React from 'react';

export default function DoublesTeamRow({ nameA, nameB, onNameAChange, onNameBChange, onRemove }) {
  return (
    <div className="participant-row">
      <input
        type="text"
        className="p-name"
        placeholder="Игрок 1"
        value={nameA}
        onChange={e => onNameAChange(e.target.value)}
      />
      <input
        type="text"
        className="p-name"
        placeholder="Игрок 2"
        value={nameB}
        onChange={e => onNameBChange(e.target.value)}
      />
      <button type="button" className="p-remove" onClick={onRemove}>✕</button>
    </div>
  );
}
