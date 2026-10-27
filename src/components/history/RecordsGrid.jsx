import React from 'react';

const MAX_HOLDERS = 3;

// Карточки рекордов над таблицей статистики (см. utils/records.js). Если
// рекорд делят несколько человек или матчей, показываем первых трёх и «+N».
export default function RecordsGrid({ records }) {
  if (!records.length) return null;
  return (
    <>
      <div className="group-name">🏅 Рекорды</div>
      <div className="stat-grid records-grid">
        {records.map(record => {
          const shown = record.holders.slice(0, MAX_HOLDERS);
          const more = record.holders.length - shown.length;
          return (
            <div className="stat-card record-card" key={record.id}>
              <div className="stat-icon">{record.icon}</div>
              <div className="stat-label">{record.title}</div>
              <div className="stat-wins">{record.value}</div>
              <div className="stat-name record-holders" title={record.holders.join(', ')}>
                {shown.join(', ')}{more > 0 && ` +${more}`}
              </div>
              {record.detail && <div className="stat-detail">{record.detail}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
