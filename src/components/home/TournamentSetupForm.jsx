import React, { useEffect, useState } from 'react';
import ParticipantRow from './ParticipantRow.jsx';
import ClubAutocomplete from './ClubAutocomplete.jsx';
import FormatPicker from './FormatPicker.jsx';
import { useKnownPlayers } from '../../hooks/useKnownPlayers.js';
import { buildTournamentPayload } from '../../utils/createTournamentPayload.js';
import { useTournament } from '../../context/TournamentContext.jsx';
import { listHistory } from '../../services/tournaments.js';
import { getSportConfig } from '../../utils/sportConfig.js';

let rowIdCounter = 0;
function newRow(name = '', club = null) {
  rowIdCounter += 1;
  return { id: rowIdCounter, name, club };
}

export default function TournamentSetupForm({ sport, onCreated }) {
  const cfg = getSportConfig(sport);
  const { startTournament } = useTournament();
  const [name, setName] = useState('');
  const [rows, setRows] = useState(() => [newRow(), newRow()]);
  const [format, setFormat] = useState('playoff');
  const [selectedClubs, setSelectedClubs] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    setRows([newRow(), newRow()]);
    setSelectedClubs([]);
  }, [sport]);

  const knownPlayers = useKnownPlayers(history, sport);
  const existingNames = rows.map(r => r.name.trim()).filter(Boolean);

  useEffect(() => {
    setSelectedClubs(prev => Array.from({ length: existingNames.length }, (_, index) => prev[index] || null));
  }, [existingNames.length]);

  function updateRow(id, patch) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow(name = '', club = null) {
    setRows(prev => [...prev, newRow(name, club)]);
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function addKnownPlayer(playerName, club) {
    setRows(prev => {
      if (prev.some(row => row.name.trim() === playerName)) return prev;
      const emptyRowIndex = prev.findIndex(row => !row.name.trim());
      if (emptyRowIndex < 0) return [...prev, newRow(playerName, club)];
      return prev.map((row, index) => index === emptyRowIndex ? { ...row, name: playerName, club } : row);
    });
  }

  function distributeRandomClubs() {
    const participantRows = rows.filter(row => row.name.trim());
    if (!participantRows.length) return;

    if (selectedClubs.length !== participantRows.length || selectedClubs.some(club => !club)) return;
    const clubPool = selectedClubs.slice().sort(() => Math.random() - 0.5);
    const assignments = participantRows.slice().sort(() => Math.random() - 0.5);
    const clubsByRowId = new Map(
      assignments.map((row, index) => {
        const club = clubPool[index % clubPool.length];
        return [row.id, { ...club }];
      }),
    );

    setRows(prev => prev.map(row => clubsByRowId.has(row.id) ? { ...row, club: clubsByRowId.get(row.id) } : row));
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      const payload = buildTournamentPayload({
        name,
        participants: rows.map(r => ({ name: r.name, club: r.club })),
        format,
        sport,
      });
      await startTournament(payload);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="card" id="setup-card">
      <div className="card-title">Настройка турнира</div>
      <input
        type="text"
        id="tournament-name"
        placeholder="Название турнира (напр. Летний кубок 2026)"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <div style={{ marginTop: 14 }}>
        <div id="participants-rows">
          {rows.map(r => (
            <ParticipantRow
              key={r.id}
              name={r.name}
              club={r.club}
              showClub={cfg.hasClub}
              onNameChange={val => updateRow(r.id, { name: val })}
              onClubChange={club => updateRow(r.id, { club })}
              onRemove={() => removeRow(r.id)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => addRow()}
          style={{ marginTop: 8, background: 'rgba(34,197,94,0.08)', color: 'var(--green)', border: '1px dashed rgba(34,197,94,0.3)', width: '100%', padding: 10, fontSize: '0.85rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Добавить участника
        </button>
        {cfg.hasClub && (
          <div className="random-clubs-panel">
            <div className="random-clubs-heading">Выберите клубы для распределения</div>
            {existingNames.length > 0 && (
              <div className="random-club-fields">
                {selectedClubs.map((club, index) => (
                  <div key={index} className="random-club-field">
                    <span>Клуб {index + 1}</span>
                    <ClubAutocomplete
                      club={club}
                      onSelect={value => setSelectedClubs(prev => prev.map((selected, selectedIndex) => selectedIndex === index ? value : selected))}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="random-clubs-controls">
              <button type="button" className="btn btn-secondary" onClick={distributeRandomClubs} disabled={!existingNames.length || selectedClubs.length !== existingNames.length || selectedClubs.some(club => !club)}>
                🎲 Распределить
              </button>
            </div>
            <div className="field-hint">Количество полей соответствует количеству заполненных участников. Выберите клуб в каждом поле, затем распределите их случайно.</div>
          </div>
        )}
        <div className="field-hint" style={{ marginTop: 6 }}>
          {cfg.engine === 'bracket-group' && `Минимум 2 ${cfg.unitNoun}. Лучший проигравший займёт место BYE.`}
          {cfg.engine === 'turnik-ladder' && `Минимум 2 ${cfg.unitNoun}.`}
          {cfg.engine === 'americano' && 'Минимум 3 участника. Команды формируются автоматически и меняются каждый раунд.'}
        </div>
      </div>

      {existingNames.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="tag">{existingNames.length} {cfg.unitNoun}</span>
        </div>
      )}

      {knownPlayers.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 6 }}>Известные игроки (нажми чтобы добавить):</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {knownPlayers.map(({ name: pName, meta }) => (
              <span
                key={pName}
                className="tag"
                style={{ cursor: 'pointer' }}
                onClick={() => addKnownPlayer(pName, meta)}
              >
                {pName}
              </span>
            ))}
          </div>
        </div>
      )}

      {cfg.engine === 'bracket-group' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--green)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'block', width: 3, height: 14, background: 'var(--green)', borderRadius: 2 }} />
            Формат турнира
          </div>
          <FormatPicker value={format} onChange={setFormat} />
        </div>
      )}

      {error && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: '0.85rem' }}>⚠️ {error}</div>}

      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Создаём…' : '⚡ Создать турнир'}
        </button>
      </div>
    </div>
  );
}
