import React, { useEffect, useMemo, useState } from 'react';
import ParticipantRow from './ParticipantRow.jsx';
import ClubAutocomplete from './ClubAutocomplete.jsx';
import DoublesClubPicker from './DoublesClubPicker.jsx';
import FormatPicker from './FormatPicker.jsx';
import { useKnownPlayers } from '../../hooks/useKnownPlayers.js';
import { buildTournamentPayload } from '../../utils/createTournamentPayload.js';
import { useTournament } from '../../context/TournamentContext.jsx';
import { listAll } from '../../services/tournaments.js';
import { loadTeamBalanceData } from '../../services/teamBalance.js';
import { FOOTBALL, FOOTBALL_DOUBLES, getSportConfig } from '../../utils/sportConfig.js';
import { assignRandomClubs, getLastClubsByPlayer } from '../../utils/randomClubAssignment.js';
import { MIN_TEAM_LOG_PLAYERS, getPreviousRealMatch, getTeams } from '../../utils/teamMatchLog.js';

let rowIdCounter = 0;
const DOUBLES_FORMATS = [
  { fmt: 'americano', label: 'Один круг' },
  { fmt: 'league', label: '🏅 Лига · дома и в гостях' },
];
function newRow(name = '', club = null) {
  rowIdCounter += 1;
  return { id: rowIdCounter, name, club };
}

function appendClubSlots(slots, count) {
  const lastId = slots.at(-1)?.id ?? 0;
  return [...slots, ...Array.from({ length: count }, (_, index) => ({
    id: lastId + index + 1,
    club: null,
  }))];
}

function PlayerSuggestions({ title, players, onAdd }) {
  if (players.length === 0) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {players.map(({ name, meta }) => (
          <button
            key={name}
            type="button"
            className="tag"
            style={{ cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => onAdd(name, meta)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TournamentSetupForm({ sport, onCreated }) {
  const cfg = getSportConfig(sport);
  const supportsDoublesLeague = cfg.engine === 'americano' && cfg.doubleRoundRobinLeague;
  const { startTournament } = useTournament();
  const [name, setName] = useState('');
  const [rows, setRows] = useState(() => [newRow(), newRow()]);
  const [format, setFormat] = useState('playoff');
  const [clubSlots, setClubSlots] = useState([]);
  const [clubPool, setClubPool] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAll().then(list => {
      if (!cancelled) setTournaments(list);
    }).catch(() => {
      if (!cancelled) setTournaments([]);
    });
    return () => { cancelled = true; };
  }, []);

  // Сразу открываем необходимое для выбранного режима количество полей.
  useEffect(() => {
    const initialRows = cfg.minParticipants || (cfg.engine === 'team-match-log' ? MIN_TEAM_LOG_PLAYERS : 2);
    setRows(Array.from({ length: initialRows }, () => newRow()));
    setClubSlots([]);
    setClubPool(null);
    setFormat(supportsDoublesLeague ? 'americano' : 'playoff');
  }, [sport]);

  const history = useMemo(() => tournaments
    .filter(tournament => tournament.status === 'finished'), [tournaments]);
  const knownPlayers = useKnownPlayers(cfg.engine === 'americano' ? tournaments : history, sport);
  const { lastMatchPlayers, otherKnownPlayers } = useMemo(() => {
    if (cfg.engine !== 'team-match-log') {
      return { lastMatchPlayers: [], otherKnownPlayers: knownPlayers };
    }

    const lastMatch = getPreviousRealMatch(tournaments);
    const lastMatchNames = new Set(getTeams(lastMatch).flatMap(team => team.players));
    return {
      lastMatchPlayers: [...lastMatchNames].sort().map(name => ({ name, meta: null })),
      otherKnownPlayers: knownPlayers.filter(({ name }) => !lastMatchNames.has(name)),
    };
  }, [cfg.engine, knownPlayers, tournaments]);
  const participantRows = rows.filter(row => row.name.trim());
  const playerCount = participantRows.length;
  const selectedClubs = clubSlots.map(slot => slot.club).filter(Boolean);
  const canDrawClubs = playerCount > 0 && selectedClubs.length >= playerCount;

  useEffect(() => {
    if (!cfg.hasClub) return;
    setClubSlots(prev => prev.length < playerCount ? appendClubSlots(prev, playerCount - prev.length) : prev);
  }, [cfg.hasClub, playerCount]);

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
    if (!canDrawClubs) return;
    const lastClubs = getLastClubsByPlayer(history, sport, FOOTBALL);
    const clubsByRowId = assignRandomClubs(participantRows, selectedClubs, lastClubs);

    if (!clubsByRowId) {
      setError('Невозможно распределить выбранные клубы без повторения команд из последнего турнира. Измените набор клубов.');
      return;
    }

    setError(null);
    setRows(prev => prev.map(row => clubsByRowId.has(row.id) ? { ...row, club: clubsByRowId.get(row.id) } : row));
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      const balance = cfg.engine === 'team-match-log' ? await loadTeamBalanceData() : null;
      const payload = buildTournamentPayload({
        name,
        participants: rows.map(r => ({ name: r.name, club: r.club })),
        format,
        sport,
        ...(balance ? {
          previousMatch: getPreviousRealMatch(balance.tournaments),
          ratings: balance.ratings,
          stamina: balance.stamina,
        } : {}),
        ...(sport === FOOTBALL_DOUBLES ? { clubPool } : {}),
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
      <div className="card-title">{cfg.engine === 'team-match-log' ? 'Новый матч' : 'Настройка турнира'}</div>
      <input
        type="text"
        id="tournament-name"
        placeholder={cfg.engine === 'team-match-log' ? 'Название матча (напр. Среда, поле у школы)' : 'Название турнира (напр. Летний кубок 2026)'}
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
        {sport === FOOTBALL_DOUBLES && <DoublesClubPicker clubs={clubPool} onChange={setClubPool} playerCount={playerCount} allowNone />}
        {cfg.hasClub && (
          <div className="random-clubs-panel">
            <div className="random-clubs-heading">Выберите клубы для распределения</div>
            {clubSlots.length > 0 && (
              <div className="random-club-fields">
                {clubSlots.map(({ id, club }, index) => (
                  <div key={id} className="random-club-field">
                    <span>Клуб {index + 1}</span>
                    <div className="random-club-input">
                      <ClubAutocomplete
                        club={club}
                        onSelect={value => setClubSlots(prev => prev.map(slot => slot.id === id ? { ...slot, club: value } : slot))}
                      />
                      {clubSlots.length > playerCount && (
                        <button
                          type="button"
                          className="p-remove"
                          aria-label={`Убрать клуб ${index + 1}`}
                          onClick={() => setClubSlots(prev => prev.filter(slot => slot.id !== id))}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="random-clubs-controls">
              <button type="button" className="btn btn-secondary" onClick={() => setClubSlots(prev => appendClubSlots(prev, 1))}>
                + Добавить клуб
              </button>
              <button type="button" className="btn btn-secondary" onClick={distributeRandomClubs} disabled={!canDrawClubs}>
                🎲 Распределить
              </button>
            </div>
            <div className="field-hint">Выберите не меньше клубов, чем участников. Каждый получит по одному клубу, остальные останутся в списке.</div>
          </div>
        )}
        <div className="field-hint" style={{ marginTop: 6 }}>
          {cfg.engine === 'bracket-group' && `Минимум 2 ${cfg.unitNoun}. Лучший проигравший займёт место BYE.`}
          {cfg.engine === 'turnik-ladder' && `Минимум 2 ${cfg.unitNoun}.`}
          {cfg.engine === 'americano' && `Минимум ${cfg.minParticipants || 3} участника. Пары формируются случайно и меняются каждый раунд.${cfg.allowUnevenTeams === false ? ' Лишние игроки отдыхают: каждый матч строго 2×2.' : ''}`}
          {supportsDoublesLeague && format === 'league' && ' Во втором круге те же пары играют ответные матчи, поменявшись дома и в гостях. Зачёт парный: победа — 3 очка, ничья — 1.'}
          {cfg.engine === 'team-match-log' && `Минимум ${MIN_TEAM_LOG_PLAYERS} игроков. Команды подбираются по результатам прошлых матчей и выносливости. По возможности в каждой команде меняются минимум два игрока по сравнению с последним составом. При нечётном числе игроков в одной команде будет на одного больше.`}
        </div>
      </div>

      {playerCount > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="tag">{playerCount} {cfg.unitNoun}</span>
        </div>
      )}

      <PlayerSuggestions title="Игроки последнего матча" players={lastMatchPlayers} onAdd={addKnownPlayer} />
      <PlayerSuggestions title="Известные игроки (нажми чтобы добавить)" players={otherKnownPlayers} onAdd={addKnownPlayer} />

      {(cfg.engine === 'bracket-group' || supportsDoublesLeague) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--green)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'block', width: 3, height: 14, background: 'var(--green)', borderRadius: 2 }} />
            Формат турнира
          </div>
          <FormatPicker value={format} onChange={setFormat} options={supportsDoublesLeague ? DOUBLES_FORMATS : undefined} />
        </div>
      )}

      {error && <div style={{ marginTop: 12, color: 'var(--red)', fontSize: '0.85rem' }}>⚠️ {error}</div>}

      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Создаём…' : cfg.engine === 'team-match-log' ? '⚡ Создать матч' : '⚡ Создать турнир'}
        </button>
      </div>
    </div>
  );
}
