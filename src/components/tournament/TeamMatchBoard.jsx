import React from 'react';
import {
  attributedGoals, computeMatchStats, dateInputValue, formatMatchDate, getGoals,
  getScores, getTeams, hasTeams, pluralGoals, pluralPlayers, timestampFromDateInput,
} from '../../utils/teamMatchLog.js';

// Одна запись — один матч, поэтому это не список игр, а сам матч: две команды,
// счёт и авторы голов. Правки применяются на месте (как отметки в турнике), а
// не через отдельную форму. То же самое рендерится в истории и в режиме
// просмотра с editable={false}.
export default function TeamMatchBoard({
  tournament, editable,
  onRenameTeam = () => {}, onSetScore = () => {}, onSetDate = () => {}, onBumpGoal = () => {},
  onMovePlayer = () => {}, onReshuffle = () => {}, onFinish = () => {},
}) {
  const teams = getTeams(tournament);
  const [s1, s2] = getScores(tournament);
  const playedAt = tournament.playedAt || tournament.createdAt || Date.now();
  const isFinished = tournament.status === 'finished';
  const canEdit = editable && !isFinished;
  const split = hasTeams(tournament);
  const rows = computeMatchStats(tournament);
  const scorers = rows.filter(row => row.goals > 0);

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

      <div className="tml-scoreboard">
        {[0, 1].map(side => {
          const team = teams[side];
          const score = side === 0 ? s1 : s2;
          const opponent = side === 0 ? s2 : s1;
          const attributed = attributedGoals(team);
          const goals = getGoals(team).reduce((acc, g) => ({ ...acc, [g.name]: g.count }), {});
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
                {team.players.map(player => (
                  <div className="tml-roster-row" key={player}>
                    <span className="tml-roster-name">{player}</span>
                    {canEdit ? (
                      <>
                        <div className="tml-goal-ctl">
                          <button type="button" onClick={() => onBumpGoal(side, player, -1)} disabled={!goals[player]}>−</button>
                          <span className="tml-goal-count">{goals[player] || 0}</span>
                          <button type="button" onClick={() => onBumpGoal(side, player, 1)}>+</button>
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
                      <span className={'tml-goal-badge' + (goals[player] ? ' scorer' : '')}>
                        {goals[player] ? `⚽ ${goals[player]}` : '—'}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className={'tml-attributed' + (attributed !== score ? ' warn' : '')}>
                {attributed > score
                  ? `⚠️ расписано ${pluralGoals(attributed)}, а забито ${score} — поправьте счёт`
                  : score === 0
                    ? '⚽ голов нет'
                    : attributed === score
                      ? (score === 1 ? '⚽ гол расписан' : `⚽ все ${pluralGoals(score)} расписаны`)
                      : `⚽ расписано ${attributed} из ${score} · без автора: ${score - attributed}`}
              </div>
            </div>
          );
        })}
      </div>

      {scorers.length > 0 && (
        <>
          <div className="group-name" style={{ marginTop: 20 }}>Забили</div>
          <div className="tml-scorers">
            {scorers.map(row => (
              <span className="tml-scorer" key={row.name}>
                <b>{row.name}</b> ⚽{row.goals}
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
