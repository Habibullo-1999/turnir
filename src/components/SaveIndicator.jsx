import React from 'react';

export default function SaveIndicator({ status, error }) {
  if (!status || status === 'idle') return null;
  if (status === 'saving') return <div className="save-indicator">💾 Сохранение…</div>;
  if (status === 'error') {
    return (
      <div className="save-indicator error">
        ⚠️ Не удалось сохранить: {error}. Правки останутся на экране — повторим сохранение автоматически при следующем изменении, либо проверьте соединение.
      </div>
    );
  }
  return <div className="save-indicator saved">✅ Сохранено {new Date().toLocaleTimeString('ru')}</div>;
}
