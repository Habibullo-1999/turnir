import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { comparisonPlayers, comparePlayers } from '../../utils/headToHead.js';

function TournamentLink({ entry }) {
  return <Link to={`/view/${encodeURIComponent(entry.id)}`}>{entry.name || 'Турнир'}{entry.date ? ` · ${entry.date}` : ''}</Link>;
}

function MeetingScore({ meeting, players }) {
  return <>{meeting.scores.join(' : ')}{meeting.penalties && <small>по пенальти: {players[meeting.winner]}</small>}</>;
}

export default function PlayerComparison({ history, availableHistory }) {
  const [selected, setSelected] = useState(['', '']);
  const players = comparisonPlayers(availableHistory);
  const chosen = selected.map(name => players.includes(name) ? name : '');
  const ready = chosen.every(Boolean) && chosen[0] !== chosen[1];
  const comparison = ready ? comparePlayers(history, ...chosen) : null;
  const total = comparison?.matches.length || 0;

  return (
    <section className="player-comparison" aria-label="Сравнение игроков">
      <div className="group-name">⚔️ Личные встречи</div>
      <div className="comparison-pickers">
        {chosen.map((name, index) => (
          <label key={index}>
            {index === 0 ? 'Первый игрок' : 'Второй игрок'}
            <select value={name} onChange={event => {
              const value = event.target.value;
              setSelected(prev => prev.map((player, i) => i === index ? value : player));
            }}>
              <option value="">Выберите игрока</option>
              {players.map(player => <option key={player} value={player} disabled={player === chosen[1 - index]}>{player}</option>)}
            </select>
          </label>
        ))}
      </div>
      <p className="comparison-note">Учитываются выбранные период и количество игроков.</p>
      {!ready ? <p className="comparison-note">Выберите двух игроков для сравнения.</p>
        : !total ? <p className="comparison-note">У этих игроков нет личных встреч по выбранным фильтрам. Для старых турниров без счетов матчей сравнение недоступно.</p>
          : <>
            <div className="comparison-scoreboard">
              <div><span>{chosen[0]}</span><strong>{comparison.wins[0]}</strong><small>победы</small></div>
              <div className="comparison-draws"><span>Ничьи</span><strong>{comparison.draws}</strong><small>Матчей: {total}</small></div>
              <div><span>{chosen[1]}</span><strong>{comparison.wins[1]}</strong><small>победы</small></div>
            </div>
            <div className="table-scroll">
              <table className="stats-table comparison-table">
                <thead><tr><th>{chosen[0]}</th><th>Показатель</th><th>{chosen[1]}</th></tr></thead>
                <tbody>
                  <tr><td>{comparison.goals[0]}</td><th>Забито голов</th><td>{comparison.goals[1]}</td></tr>
                  <tr><td>{Math.round(comparison.wins[0] / total * 100)}%</td><th>Доля побед</th><td>{Math.round(comparison.wins[1] / total * 100)}%</td></tr>
                  <tr><td>{comparison.bestStreaks[0]}</td><th>Побед подряд</th><td>{comparison.bestStreaks[1]}</td></tr>
                  <tr>
                    <td>{comparison.biggestWins[0] ? <><MeetingScore meeting={comparison.biggestWins[0]} players={chosen} /><TournamentLink entry={comparison.biggestWins[0].entry} /></> : '—'}</td>
                    <th>Крупнейшая победа</th>
                    <td>{comparison.biggestWins[1] ? <><MeetingScore meeting={comparison.biggestWins[1]} players={chosen} /><TournamentLink entry={comparison.biggestWins[1].entry} /></> : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="comparison-note">Счёт указан в порядке: {chosen.join(' — ')}. Победы по пенальти учтены; голы в серии пенальти в сумму голов не входят.</p>
            <details className="comparison-meetings">
              <summary>Все личные встречи · {total}</summary>
              <div className="table-scroll">
                <table className="stats-table comparison-table">
                  <thead><tr><th>Турнир</th><th>Счёт</th><th>Победитель</th></tr></thead>
                  <tbody>{comparison.matches.map((meeting, index) => (
                    <tr key={`${meeting.entry.id}-${index}`}>
                      <td><TournamentLink entry={meeting.entry} /></td>
                      <td><MeetingScore meeting={meeting} players={chosen} /></td>
                      <td>{meeting.winner === null ? 'Ничья' : chosen[meeting.winner]}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          </>}
    </section>
  );
}
