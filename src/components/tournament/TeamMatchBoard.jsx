import React, { useState } from 'react';
import {
  attributedAssists, computeMatchStats, creditedGoals, dateInputValue, formatMatchDate,
  getScores, getTeams, hasTeams, ownGoalsTotal, pluralGoals, pluralPlayers, timestampFromDateInput,
} from '../../utils/teamMatchLog.js';

// Счётчик «− n +» у игрока: голы, пасы или автоголы.
function Counter({ icon, title, value, onBump, canAdd = true, variant = '' }) {
  return (
    <div className={'tml-goal-ctl' + (variant ? ` ${variant}` : '')} title={title}>
      <span className="tml-counter-icon">{icon}</span>
      <button type="button" onClick={() => onBump(-1)} disabled={!value}>−</button>
      <span className="tml-goal-count">{value}</span>
      <button type="button" onClick={() => onBump(1)} disabled={!canAdd}>+</button>
    </div>
  );
}

function playerBadges(row) {
  const parts = [
    row.goals > 0 && `⚽ ${row.goals}`,
    row.assists > 0 && `🅰️ ${row.assists}`,
    row.ownGoals > 0 && `АГ ${row.ownGoals}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

// Одна запись — один матч, поэтому это не список игр, а сам матч: две команды,
// счёт, авторы голов, голевые пасы и автоголы. Правки применяются на месте (как отметки в турнике), а
// не через отдельную форму. То же самое рендерится в истории и в режиме
// просмотра с editable={false}.
export default function TeamMatchBoard({
  tournament, editable,
  onRenameTeam = () => {}, onSetScore = () => {}, onSetDate = () => {}, onBumpGoal = () => {},
  onBumpAssist = () => {}, onBumpOwnGoal = () => {}, onMovePlayer = () => {}, onReshuffle = () => {}, onFinish = () => {}, onAddPlayer = () => {},
}) {
  const [playerName, setPlayerName] = useState('');
  const [teamSide, setTeamSide] = useState('');
  const [addError, setAddError] = useState(null);
  const teams = getTeams(tournament);
  const [s1, s2] = getScores(tournament);
  const playedAt = tournament.playedAt || tournament.createdAt || Date.now();
  const isFinished = tournament.status === 'finished';
  const canEdit = editable && !isFinished;
  const split = hasTeams(tournament);
  const rows = computeMatchStats(tournament);
  const rowByName = Object.fromEntries(rows.map(row => [row.name, row]));
  const contributors = rows.filter(row => row.goals > 0 || row.assists > 0 || row.ownGoals > 0);

  function handleAddPlayer(event) {
    event.preventDefault();
    setAddError(null);
    try {
      onAddPlayer(playerName, teamSide === '' ? null : Number(teamSide));
      setPlayerName('');
    } catch (err) {
      setAddError(err.message);
    }
  }

  const addPlayerForm = canEdit && (
    <form className="tml-add-player" onSubmit={handleAddPlayer}>
      <label className="tml-field">
        <span>Имя участника</span>
        <input
          className="tml-text-input"
          type="text"
          value={playerName}
          onChange={event => setPlayerName(event.target.value)}
          required
        />
      </label>
      <label className="tml-field">
        <span>Команда</span>
        <select className="tml-text-input" value={teamSide} onChange={event => setTeamSide(event.target.value)} required>
          <option value="" disabled>Выберите команду</option>
          {teams.map((team, side) => <option key={side} value={side}>{team.name}</option>)}
        </select>
      </label>
      <button type="submit" className="btn btn-secondary" disabled={!playerName.trim() || teamSide === ''}>+ Добавить участника</button>
      {addError && <div className="tml-add-error" role="alert">{addError}</div>}
    </form>
  );

  if (!split) {
    return (
      <div className="card">
        <div className="card-title">{tournament.name || 'Матч'}</div>
        <div className="field-hint">Команды ещё не разделены.</div>
        {canEdit && (
          <div className="btn-row">
            <button className="btn btn-primary" onClick={onReshuffle}>🎲 Разделить {pluralPlayers((tournament.players || []).length)} на две команды</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">{tournament.name || 'Матч'}</div>

      <div className="tml-match-meta">
        {canEdit ? (
          <label className="tml-field">
            <span>Дата игры</span>
            <input
              type="date"
              className="tml-text-input"
              value={dateInputValue(playedAt)}
              onChange={e => onSetDate(timestampFromDateInput(e.target.value, playedAt))}
            />
          </label>
        ) : (
          <span className="tml-match-when">📅 {formatMatchDate(playedAt)}</span>
        )}
      </div>

      {addPlayerForm}

      <div className="tml-scoreboard">
        {[0, 1].map(side => {
          const team = teams[side];
          const score = side === 0 ? s1 : s2;
          const opponent = side === 0 ? s2 : s1;
          const credited = creditedGoals(tournament, side);
          const opponentOwnGoals = ownGoalsTotal(teams[1 - side]);
          const assists = attributedAssists(team);
          const assistable = score - opponentOwnGoals;
          return (
            <div className={'tml-team-panel' + (score > opponent ? ' winner' : '')} key={side}>
              <div className="tml-team-panel-head">
                {canEdit ? (
                  <input
                    type="text"
                    className="tml-team-name-input"
                    value={team.name}
                    onChange={e => onRenameTeam(side, e.target.value)}
                  />
                ) : (
                  <div className="tml-side-name">{team.name}</div>
                )}
                {canEdit ? (
                  <input
                    type="number"
                    min="0"
                    max="99"
                    className="gm-score-input"
                    value={String(score)}
                    onChange={e => onSetScore(side, parseInt(e.target.value || '0', 10))}
                  />
                ) : (
                  <div className={'tml-big-score' + (score > opponent ? ' tml-win' : '')}>{score}</div>
                )}
              </div>

              <div className="tml-roster">
                {team.players.map(player => {
                  const row = rowByName[player] || { goals: 0, assists: 0, ownGoals: 0 };
                  return (
                    <div className="tml-roster-row" key={player}>
                      <span className="tml-roster-name">{player}</span>
                      {canEdit ? (
                        <>
                          <div className="tml-counters">
                            <Counter icon="⚽" title="Голы" value={row.goals} onBump={delta => onBumpGoal(side, player, delta)} />
                            <Counter
                              icon="🅰️"
                              title="Голевые пасы"
                              value={row.assists}
                              canAdd={assists < assistable}
                              onBump={delta => onBumpAssist(side, player, delta)}
                            />
                            <Counter
                              icon="АГ"
                              title="Автоголы — идут в счёт соперника"
                              value={row.ownGoals}
                              variant="own"
                              onBump={delta => onBumpOwnGoal(side, player, delta)}
                            />
                          </div>
                          <button
                            type="button"
                            className="tml-roster-btn"
                            title="Перевести в другую команду"
                            onClick={() => onMovePlayer(player, 1 - side)}
                          >
                            ⇄
                          </button>
                        </>
                      ) : (
                        <span className={'tml-goal-badge' + (row.goals || row.assists ? ' scorer' : '')}>
                          {playerBadges(row)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className={'tml-attributed' + (credited !== score || assists > assistable ? ' warn' : '')}>
                {credited > score
                  ? `⚠️ расписано ${pluralGoals(credited)}, а забито ${score} — поправьте счёт`
                  : score === 0
                    ? '⚽ голов нет'
                    : credited === score
                      ? (score === 1 ? '⚽ гол расписан' : `⚽ все ${pluralGoals(score)} расписаны`)
                      : `⚽ расписано ${credited} из ${score} · без автора: ${score - credited}`}
                {opponentOwnGoals > 0 && ` · в т. ч. автогол: ${opponentOwnGoals}`}
                {assists > assistable
                  ? ` · ⚠️ пасов ${assists}, а голов без автоголов ${assistable}`
                  : assists > 0 && ` · 🅰️ пасов: ${assists}`}
              </div>
            </div>
          );
        })}
      </div>

      {contributors.length > 0 && (
        <>
          <div className="group-name" style={{ marginTop: 20 }}>Итоги</div>
          <div className="tml-scorers">
            {contributors.map(row => (
              <span className={'tml-scorer' + (!row.goals && !row.assists ? ' own' : '')} key={row.name}>
                <b>{row.name}</b> {playerBadges(row)}
                <span className="tml-scorer-team">{row.team}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {canEdit && (
        <div className="btn-row">
          <button className="btn btn-primary" onClick={onFinish}>🏁 Завершить матч</button>
          <button className="btn btn-secondary" onClick={onReshuffle}>🎲 Разделить заново</button>
        </div>
      )}
    </div>
  );
}
