import React from 'react';

export default function EditScoreConfirmModal({ ctx, onConfirm, onClose }) {
  if (!ctx) return null;

  return (
    <div className="penalty-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="edit-score-confirm-title">
      <div className="penalty-modal-card">
        <div id="edit-score-confirm-title" className="penalty-modal-title">✏️ Изменить счёт?</div>
        <div className="penalty-modal-subtitle">
          {ctx.label ? `Матч: ${ctx.label}. ` : ''}Текущий счёт будет очищен, и вы сможете ввести новый.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onConfirm}>Подтвердить</button>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
