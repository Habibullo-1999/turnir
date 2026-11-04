import React, { useState } from 'react';
import FormatPicker from '../home/FormatPicker.jsx';

const OPTIONS = [
  { fmt: 'americano', label: 'Один круг' },
  { fmt: 'league', label: 'Лига · дома и в гостях' },
];

export default function ChangeDoublesFormat({ tournament, onChange }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  return <div>
    <button type="button" className="pause-btn" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      ⇄ Сменить тип турнира
    </button>
    {open && <div className="card" style={{ marginTop: 10 }}>
      <div className="card-title">Формат текущего турнира</div>
      <FormatPicker value={tournament.format === 'league' ? 'league' : 'americano'} options={OPTIONS} onChange={format => {
        setError(null);
        try { onChange(format); } catch (err) { setError(err.message); }
      }} />
      <div className="field-hint">Сыгранные встречи сохраняются. Лига добавляет ответные матчи, один круг оставляет одну встречу между парами.</div>
      {error && <div className="participant-add-error" role="alert">{error}</div>}
    </div>}
  </div>;
}
