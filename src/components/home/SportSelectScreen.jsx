import React from 'react';
import { SPORT_CONFIG } from '../../utils/sportConfig.js';

export default function SportSelectScreen({ onSelect }) {
  return (
    <div>
      <div className="card-title" style={{ marginBottom: 14 }}>Выберите вид спорта</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {Object.values(SPORT_CONFIG).map(cfg => (
          <button
            key={cfg.sport}
            type="button"
            className="card"
            onClick={() => onSelect(cfg.sport)}
            style={{
              cursor: 'pointer',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '24px 12px',
              fontFamily: 'inherit',
              color: 'var(--text)',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green-dim)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <span style={{ fontSize: '2rem' }}>{cfg.icon}</span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cfg.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
