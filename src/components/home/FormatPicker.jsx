import React from 'react';

const FORMATS = [
  { fmt: 'playoff', label: '🏆 Плей-офф' },
  { fmt: 'group', label: '📊 Групповой' },
  { fmt: 'group+playoff', label: '📊→🏆 Группы + Плей-офф' },
  { fmt: 'league', label: '🏅 Лига' },
];

export default function FormatPicker({ value, onChange, options = FORMATS }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(({ fmt, label }) => (
        <button
          key={fmt}
          type="button"
          aria-pressed={value === fmt}
          className={'format-btn' + (value === fmt ? ' active' : '')}
          onClick={() => onChange(fmt)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
