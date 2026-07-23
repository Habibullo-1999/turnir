import React, { useState } from 'react';
import { calcAmericanoStandings } from '../../utils/americano.js';

function pairName(pair) {
  return pair.join(' / ');
}

function AmericanoMatch({ match, editable, onConfirm, onEdit }) {
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [error, setError] = useState(null);

  function handleConfirm() {
    const p1 = parseInt(s1 || '0', 10);
    const p2 = parseInt(s2 || '0', 10);
    if (Number.isNaN(p1) || Number.isNaN(p2)) { setError('Введите корректный счёт.'); return; }
    if (p1 === p2) { setError('Ничья невозможна — введите разные значения.'); return; }
    setError(null);
    onConfirm(p1, p2);
  }

  const w1 = match.played && match.score1 > match.score2;
  const w2 = match.played && match.score2 > match.score1;

  return (
    <div className={'group-match' + (match.played ? ' played' : ' active')}>
      <div className="gm-row">
        <div className={'gm-team' + (w1 ? ' gm-winner' : '')}><span className="gm-team-name">{pairName(match.pairA)}</span></div>
        {match.played ? (
          <div className="gm-result">{match.score1} : {match.score2}</div>
        ) : editable ? (
          <div className="gm-score">
            <input type="number" min="0" max="99" className="gm-score-input" placeholder="0" value={s1} onChange={e => setS1(e.target.value)} />
            <span className="gm-sep">:</span>
            <input type="number" min="0" max="99" className="gm-score-input" placeholder="0" value={s2} onChange={e => setS2(e.target.value)} />
          </div>
        ) : (
          <div className="gm-result">— : —</div>
        )}
        <div className={'gm-team right' + (w2 ? ' gm-winner' : '')}><span className="gm-team-name">{pairName(match.pairB)}</span></div>
        {match.played && editable && (
          <button className="gm-edit" title="Редактировать счёт" onClick={onEdit}>✏️</button>
        )}
      </div>
      {!match.played && editable && (
        <>
          {error && <div style={{ color: 'var(--red)', fontSize: '0.7rem', padding: '2px 4px' }}>{error}</div>}
          <button className="gm-confirm" onClick={handleConfirm}>Подтвердить ✓</button>
        </>
      )}
    </div>
  );
}

// Теннис 2×2 «Американо»: партнёры меняются каждый раунд (сгенерировано
// заранее при создании турнира), поэтому зачёт — личный, по игрокам, а не по
// парам.
export default function AmericanoBoard({ tournament, editable, onConfirm = () => {}, onEdit = () => {} }) {
  const standings = calcAmericanoStandings(tournament);

  return (
    <div className="card">
      <table className="standings-table">
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Игрок</th>
            <th title="Матчи">М</th><th title="Победы">В</th><th title="Поражения">П</th>
            <th title="Очки">О</th><th title="Разница">±</th>
            <th title="Очки турнира" style={{ color: 'var(--green)' }}>Т</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.name}>
              <td><span className="pos">{i + 1}.</span>{row.name}</td>
              <td>{row.played}</td><td>{row.w}</td><td>{row.l}</td>
              <td>{row.pf}:{row.pa}</td>
              <td style={{ color: row.diff > 0 ? 'var(--green)' : row.diff < 0 ? 'var(--red)' : 'var(--text-muted)' }}>{row.diff > 0 ? '+' : ''}{row.diff}</td>
              <td style={{ fontWeight: 700, color: 'var(--green)' }}>{row.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(tournament.rounds || []).map((round, rIdx) => (
        <div className="group-block" key={rIdx}>
          <div className="group-name">Раунд {rIdx + 1}</div>
          <div className="group-tour-matches">
            {round.matches.map((match, mIdx) => (
              <AmericanoMatch
                key={mIdx}
                match={match}
                editable={editable}
                onConfirm={(s1, s2) => onConfirm(rIdx, mIdx, s1, s2)}
                onEdit={() => onEdit(rIdx, mIdx)}
              />
            ))}
          </div>
          {round.byes && round.byes.length > 0 && (
            <div className="field-hint" style={{ marginTop: 8 }}>😴 Отдыхают: {round.byes.join(', ')}</div>
          )}
        </div>
      ))}
    </div>
  );
}
