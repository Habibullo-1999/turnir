import React, { useState } from 'react';
import { getBracketSlots } from '../../utils/manualRearrange.js';

export default function BracketRearrange({ rounds, onSwap }) {
  const slots = getBracketSlots(rounds);
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');

  if (slots.length < 2) return null;

  function handleSwap() {
    if (!nameA || !nameB || nameA === nameB) return;
    onSwap(nameA, nameB);
    setNameA(''); setNameB('');
  }

  return (
    <div className="rearrange-panel">
      <div className="rearrange-title">🔁 Поменять участников местами в сетке</div>
      <div className="rearrange-row">
        <select value={nameA} onChange={e => setNameA(e.target.value)}>
          <option value="">Кого…</option>
          {slots.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
        <span>⇄</span>
        <select value={nameB} onChange={e => setNameB(e.target.value)}>
          <option value="">С кем…</option>
          {slots.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
        <button className="btn btn-secondary" disabled={!nameA || !nameB || nameA === nameB} onClick={handleSwap}>Поменять</button>
      </div>
    </div>
  );
}
