import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTournament } from '../../context/TournamentContext.jsx';
import { getPlayerProfiles, MAX_STAMINA, savePlayerStamina, staminaMap } from '../../services/playerProfiles.js';
import { listAll } from '../../services/tournaments.js';
import { FOOTBALL_REAL } from '../../utils/sportConfig.js';
import { getTeams } from '../../utils/teamMatchLog.js';

const SCORES = Array.from({ length: MAX_STAMINA }, (_, index) => index + 1);
const byName = new Intl.Collator('ru', { numeric: true });

function playerNames(matches, profiles) {
  const names = new Set(Object.keys(profiles));
  for (const match of matches) {
    if (match.sport !== FOOTBALL_REAL) continue;
    const rosters = getTeams(match).flatMap(team => team.players);
    for (const name of [...Object.values(match.players || {}), ...rosters]) {
      if (typeof name === 'string' && name.trim()) names.add(name);
    }
  }
  return [...names];
}

export default function PlayerStaminaPage() {
  const { state } = useLocation();
  const { tournament } = useTournament();
  const fromMatch = state?.fromMatch && tournament?.sport === FOOTBALL_REAL;
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState(null);
  const [changes, setChanges] = useState({});
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([getPlayerProfiles(), listAll()])
      .then(([profiles, matches]) => {
        if (!active) return;
        setPlayers(playerNames(matches, profiles));
        setScores(staminaMap(profiles));
      })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [attempt]);

  function savedScore(name) {
    return Object.hasOwn(scores, name) ? scores[name] : null;
  }

  const search = query.trim().toLocaleLowerCase('ru');
  const visiblePlayers = players
    .filter(name => name.toLocaleLowerCase('ru').includes(search))
    .sort((a, b) => (savedScore(b) ?? 0) - (savedScore(a) ?? 0) || byName.compare(a, b));
  const hasChanges = Object.keys(changes).length > 0;

  function changeScore(name, value) {
    const score = value === '' ? null : Number(value);
    setSaveStatus(null);
    setChanges(current => {
      if (score !== savedScore(name)) return { ...current, [name]: score };
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    if (saving || !hasChanges) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      await savePlayerStamina(changes);
      setScores(current => ({ ...current, ...changes }));
      setChanges({});
      setSaveStatus({ text: 'Оценки сохранены.' });
    } catch (error) {
      setSaveStatus({ error: true, text: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="player-stamina-page">
      <Link className="pause-btn" to={fromMatch ? '/tournament' : `/create/${FOOTBALL_REAL}`}>
        {fromMatch ? '← К матчу' : '← Реальный футбол'}
      </Link>
      <section className="card player-stamina" aria-labelledby="player-stamina-title">
        <h2 id="player-stamina-title" className="card-title">Выносливость игроков</h2>
        <p className="player-stamina-hint">«Равные команды» учитывают оценки от 1 до {MAX_STAMINA}. Без оценки берётся среднее среди пришедших игроков с оценкой.</p>
        {loadError ? (
          <div className="player-stamina-message">
            <p role="alert">Не удалось загрузить игроков и оценки.</p>
            <button type="button" className="pause-btn" onClick={() => { setLoadError(false); setAttempt(value => value + 1); }}>Повторить</button>
          </div>
        ) : scores === null ? (
          <p role="status" className="player-stamina-message">Загружаем оценки…</p>
        ) : players.length === 0 ? (
          <p className="player-stamina-message">Список игроков появится после создания первого матча.</p>
        ) : (
          <form onSubmit={handleSave}>
            <input type="text" className="player-stamina-search" aria-label="Поиск по имени" placeholder="Поиск по имени" value={query} onChange={event => setQuery(event.target.value)} />
            {visiblePlayers.length ? (
              <ul className="player-stamina-list">
                {visiblePlayers.map(name => {
                  const changed = Object.hasOwn(changes, name);
                  const score = (changed ? changes[name] : savedScore(name)) ?? null;
                  return (
                    <li key={name} data-changed={changed}>
                      <span className="player-stamina-name">{name}</span>
                      <span className="player-stamina-scale" aria-hidden="true">
                        <span style={{ width: `${(score ?? 0) / MAX_STAMINA * 100}%` }} />
                      </span>
                      <select aria-label={`Выносливость: ${name}`} value={score ?? ''} disabled={saving} onChange={event => changeScore(name, event.target.value)}>
                        <option value="">Без оценки</option>
                        {score !== null && !SCORES.includes(score) && <option value={score}>{score}</option>}
                        {SCORES.map(value => <option key={value} value={value}>{value} / {MAX_STAMINA}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="player-stamina-message">Игроки не найдены.</p>}
            <div className="player-stamina-footer">
              <button type="submit" className="btn btn-primary" disabled={!hasChanges || saving}>{saving ? 'Сохраняем…' : 'Сохранить оценки'}</button>
              {saveStatus && <p role={saveStatus.error ? 'alert' : 'status'}>{saveStatus.text}</p>}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
