import React, { useState } from 'react';

export default function PenaltyModal({ ctx, onConfirm, onClose }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState(null);

  if (!ctx) return null;

  function handleConfirm() {
    const a = p1 === '' ? 0 : parseInt(p1, 10);
    const b = p2 === '' ? 0 : parseInt(p2, 10);
    if (Number.isNaN(a) || Number.isNaN(b)) { setError('Введите корректные числа.'); return; }
    if (a === b) { setError('Пенальти тоже равны — введите разные числа.'); return; }
    setP1(''); setP2(''); setError(null);
    onConfirm(a, b);
  }

  return (
    <div className="penalty-modal-overlay">
      <div className="penalty-modal-card">
        <div className="penalty-modal-title">⚽ Серия пенальти</div>
        <div className="penalty-modal-subtitle">Счёт в матче равный — определяем победителя по пенальти</div>
        <div className="penalty-modal-rows">
          <div className="penalty-modal-row">
            <span className="penalty-modal-name">{ctx.t1}</span>
            <input type="number" min="0" max="99" placeholder="0" autoFocus value={p1} onChange={e => setP1(e.target.value)} />
          </div>
          <div className="penalty-modal-row">
            <span className="penalty-modal-name">{ctx.t2}</span>
            <input type="number" min="0" max="99" placeholder="0" value={p2} onChange={e => setP2(e.target.value)} />
          </div>
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: '0.75rem', marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirm}>Подтвердить ✓</button>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
