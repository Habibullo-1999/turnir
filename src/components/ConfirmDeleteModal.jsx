import React, { useEffect, useId, useRef } from 'react';

export default function ConfirmDeleteModal({ title, description, error, busy = false, onConfirm, onClose }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    cancelRef.current.focus();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-delete-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy}
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    >
      <div id={titleId} className="penalty-modal-title">{title}</div>
      <div id={descriptionId} className="penalty-modal-subtitle">{description}</div>
      {error && <div className="confirm-delete-error" role="alert">{error}</div>}
      <div className="confirm-delete-controls">
        <button type="button" className="btn btn-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Удаление…' : 'Удалить'}</button>
        <button ref={cancelRef} type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>Отмена</button>
      </div>
    </dialog>
  );
}
