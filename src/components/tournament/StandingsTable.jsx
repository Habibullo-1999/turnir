import React from 'react';
import { calcStandings } from '../../utils/groups.js';
import { getSportConfig } from '../../utils/sportConfig.js';

export default function StandingsTable({ group, advanceCount = 0, sport, participantMeta }) {
  const cfg = getSportConfig(sport);
  const standings = calcStandings(group);

  function displayName(name) {
    const meta = participantMeta && participantMeta[name];
    if (cfg.isDoubles && meta && meta.members) return meta.members.join(' / ');
    return name;
  }

  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th style={{ width: '40%' }}>{cfg.isDoubles ? 'Команда' : 'Игрок'}</th>
          <th title="Матчи">М</th><th title="Победы">В</th>
          {cfg.hasDraws && <th title="Ничьи">Н</th>}
          <th title="Поражения">П</th><th title={cfg.diffLabel}>{cfg.diffLabel[0]}</th><th title="Разница">±</th>
          <th title="Очки" style={{ color: 'var(--green)' }}>О</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((row, i) => {
          const advancing = advanceCount > 0 && i < advanceCount;
          const diffColor = row.diff > 0 ? 'var(--green)' : row.diff < 0 ? 'var(--red)' : 'var(--text-muted)';
          return (
            <tr key={row.name}>
              <td>
                <span className="pos">{i + 1}.</span>
                {advancing && <span className="advance-marker" />}
                {displayName(row.name)}
              </td>
              <td>{row.played}</td><td>{row.w}</td>
              {cfg.hasDraws && <td>{row.d}</td>}
              <td>{row.l}</td>
              <td>{row.gf}:{row.ga}</td>
              <td style={{ color: diffColor }}>{row.diff > 0 ? '+' : ''}{row.diff}</td>
              <td style={{ fontWeight: 700, color: 'var(--green)' }}>{row.pts}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
