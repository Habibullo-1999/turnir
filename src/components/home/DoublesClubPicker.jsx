import React from 'react';
import ClubAutocomplete from './ClubAutocomplete.jsx';
import { CLUBS } from '../../utils/clubs.js';
import { minimumDoublesClubs } from '../../utils/doublesClubs.js';

const ALL_CLUBS = CLUBS.map(club => ({ club: club.n, league: club.l, flag: club.f, icon: club.i || '' }));

export default function DoublesClubPicker({ clubs, onChange, playerCount, rounds, allowNone = false }) {
  const minimum = minimumDoublesClubs(playerCount, rounds);
  const allSelected = clubs?.length === ALL_CLUBS.length && clubs.every((club, index) => club?.club === ALL_CLUBS[index].club);
  const mode = !clubs ? 'none' : allSelected ? 'all' : 'custom';
  return (
    <div className="random-clubs-panel">
      <div className="random-clubs-heading">Клубы для пар 2×2</div>
      <select aria-label="Выбор клубов для пар" value={mode} onChange={event => {
        onChange(event.target.value === 'none' ? null : event.target.value === 'all' ? ALL_CLUBS : Array(minimum).fill(null));
      }}>
        {allowNone && <option value="none">Без клубов</option>}
        <option value="all">Случайно из всех клубов</option>
        <option value="custom">Выбрать набор клубов</option>
      </select>
      {mode === 'custom' && <>
        <div className="random-club-fields">
          {clubs.map((club, index) => (
            <div className="random-club-field" key={index}>
              <span>Клуб {index + 1}</span>
              <ClubAutocomplete club={club} onSelect={value => onChange(clubs.map((item, i) => i === index ? value : item))} />
              {clubs.length > minimum && <button type="button" className="btn btn-reset" onClick={() => onChange(clubs.filter((_, i) => i !== index))} aria-label={`Убрать клуб ${index + 1}`}>✕</button>}
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => onChange([...clubs, null])}>+ Добавить клуб</button>
      </>}
      <div className="field-hint">В первом круге при смене партнёров меняются клубы. В ответной встрече пара сохраняет клуб первого матча. В одном раунде клубы не повторяются. Для своего набора нужно минимум {minimum} разных клубов.</div>
    </div>
  );
}
