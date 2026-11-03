import React, { useState } from 'react';
import { calcAmericanoStandings } from '../../utils/americano.js';
import { FOOTBALL_DOUBLES, getSportConfig } from '../../utils/sportConfig.js';
import DoublesClubPicker from '../home/DoublesClubPicker.jsx';

function pairName(pair) {
  return pair.join(' / ');
}

function PairLabel({ pair, club }) {
  return <span className="gm-team-name doubles-pair-label">
    <span>{pairName(pair)}</span>
    {club?.club && <span className="doubles-club">
      {club.icon ? <img src={`${import.meta.env.BASE_URL}${club.icon}`} alt="" className="club-badge-icon" /> : club.flag}
      {club.club}
    </span>}
  </span>;
}

function AmericanoMatch({ match, editable, hasDraws, onConfirm, onEdit }) {
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [error, setError] = useState(null);

  function handleConfirm() {
    const p1 = parseInt(s1 || '0', 10);
    const p2 = parseInt(s2 || '0', 10);
    if (Number.isNaN(p1) || Number.isNaN(p2)) { setError('Введите корректный счёт.'); return; }
    if (!hasDraws && p1 === p2) { setError('Ничья невозможна — введите разные значения.'); return; }
    setError(null);
    onConfirm(p1, p2);
  }

  const w1 = match.played && match.score1 > match.score2;
  const w2 = match.played && match.score2 > match.score1;

  return (
    <div className={'group-match' + (match.played ? ' played' : ' active')}>
      <div className="gm-row">
        <div className={'gm-team' + (w1 ? ' gm-winner' : '')}><PairLabel pair={match.pairA} club={match.clubA} /></div>
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
        <div className={'gm-team right' + (w2 ? ' gm-winner' : '')}><PairLabel pair={match.pairB} club={match.clubB} /></div>
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

// Режим 2×2 «Американо»: партнёры меняются каждый раунд (сгенерировано
// заранее при создании турнира), поэтому зачёт — личный, по игрокам, а не по
// парам.
export default function AmericanoBoard({ tournament, editable, onConfirm = () => {}, onEdit = () => {}, onDistributeClubs }) {
  const [clubPool, setClubPool] = useState(tournament.clubPool || null);
  const [clubError, setClubError] = useState(null);
  const cfg = getSportConfig(tournament.sport);
  const standings = calcAmericanoStandings(tournament);
  const isLeague = tournament.format === 'league' && cfg.doubleRoundRobinLeague;
  const roundsPerLeg = (tournament.rounds || []).length / 2;

  return (
    <div className="card">
      <div className="table-scroll">
      <table className="standings-table">
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Игрок</th>
            <th title="Матчи">М</th><th title="Победы">В</th>{cfg.hasDraws && <th title="Ничьи">Н</th>}<th title="Поражения">П</th>
            <th>{cfg.diffLabel}</th><th title="Разница">±</th>
            <th title="Очки турнира" style={{ color: 'var(--green)' }}>Т</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.name}>
              <td><span className="pos">{i + 1}.</span>{row.name}</td>
              <td>{row.played}</td><td>{row.w}</td>{cfg.hasDraws && <td>{row.d}</td>}<td>{row.l}</td>
              <td>{row.pf}:{row.pa}</td>
              <td style={{ color: row.diff > 0 ? 'var(--green)' : row.diff < 0 ? 'var(--red)' : 'var(--text-muted)' }}>{row.diff > 0 ? '+' : ''}{row.diff}</td>
              <td style={{ fontWeight: 700, color: 'var(--green)' }}>{row.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {isLeague && <div className="field-hint">Личный зачёт. В каждом матче слева — хозяева, справа — гости. Ответные встречи проходят отдельным вторым кругом.</div>}

      {editable && tournament.sport === FOOTBALL_DOUBLES && onDistributeClubs && <>
        <DoublesClubPicker clubs={clubPool} onChange={setClubPool} playerCount={tournament.players.length} allowNone />
        <button type="button" className="btn btn-secondary" disabled={!clubPool || clubPool.some(club => !club)} onClick={() => {
          setClubError(null);
          try { onDistributeClubs(clubPool); } catch (error) { setClubError(error.message); }
        }}>🎲 Распределить клубы</button>
        <div className="field-hint">Распределение применяется только к несыгранным матчам.</div>
        {clubError && <div className="field-hint" style={{ color: 'var(--red)' }}>{clubError}</div>}
      </>}

      {(tournament.rounds || []).map((round, rIdx) => (
        <div className="group-block" key={rIdx}>
          <div className="group-name">
            {isLeague
              ? `Круг ${rIdx < roundsPerLeg ? 1 : 2} · Тур ${rIdx % roundsPerLeg + 1}${rIdx >= roundsPerLeg ? ' · Ответные встречи' : ''}`
              : `Раунд ${rIdx + 1}`}
          </div>
          <div className="group-tour-matches">
            {round.matches.map((match, mIdx) => (
              <AmericanoMatch
                key={mIdx}
                match={match}
                editable={editable}
                hasDraws={cfg.hasDraws}
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
