import React from 'react';
import { calcStandings } from '../../utils/groups.js';

export default function StandingsTable({ group, advanceCount = 0 }) {
  const standings = calcStandings(group);
  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th style={{ width: '40%' }}>Игрок</th>
          <th title="Матчи">М</th><th title="Победы">В</th><th title="Ничьи">Н</th>
          <th title="Поражения">П</th><th title="Голы">Г</th><th title="Разница">±</th>
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
                {row.name}
              </td>
              <td>{row.played}</td><td>{row.w}</td><td>{row.d}</td><td>{row.l}</td>
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
