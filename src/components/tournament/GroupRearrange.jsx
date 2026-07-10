import React, { useState } from 'react';

export default function GroupRearrange({ groups, onMove }) {
  const [player, setPlayer] = useState('');
  const [targetGroup, setTargetGroup] = useState('');

  if (groups.length < 2) return null;

  const currentGroupIdx = groups.findIndex(g => g.players.includes(player));

  function handleMove() {
    const idx = parseInt(targetGroup, 10);
    if (!player || Number.isNaN(idx)) return;
    onMove(player, idx);
    setPlayer(''); setTargetGroup('');
  }

  return (
    <div className="rearrange-panel">
      <div className="rearrange-title">🔁 Переместить игрока между группами</div>
      <div className="rearrange-row">
        <select value={player} onChange={e => { setPlayer(e.target.value); setTargetGroup(''); }}>
          <option value="">Игрок…</option>
          {groups.flatMap(g => g.players).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span>→</span>
        <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)} disabled={!player}>
          <option value="">В группу…</option>
          {groups.map((g, i) => i !== currentGroupIdx && (
            <option key={g.name} value={i}>{g.name}</option>
          ))}
        </select>
        <button className="btn btn-secondary" disabled={!player || targetGroup === ''} onClick={handleMove}>Переместить</button>
      </div>
    </div>
  );
}
