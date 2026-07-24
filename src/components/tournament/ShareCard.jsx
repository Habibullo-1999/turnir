import React, { useState } from 'react';

export default function ShareCard({ tournamentId }) {
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}${location.pathname}#/view/${encodeURIComponent(tournamentId)}`;

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="card" id="share-card">
      <div className="card-title">🔗 Ссылка для просмотра</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
        Отправь эту ссылку — гости увидят турнир в реальном времени без возможности менять счёт.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          readOnly
          value={url}
          style={{ flex: 1, minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.75rem', padding: '8px 10px', fontFamily: 'monospace', outline: 'none' }}
        />
        <button
          onClick={copy}
          style={{ background: 'var(--green-dim)', border: 'none', borderRadius: 8, color: '#fff', fontSize: '0.8rem', fontWeight: 600, padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
        >
          {copied ? '✓ Скопировано' : 'Копировать'}
        </button>
      </div>
    </div>
  );
}
