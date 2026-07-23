import React, { useEffect, useState } from 'react';
import { getSportConfig } from '../../utils/sportConfig.js';

function parseScoreInput(raw) {
  if (raw === '' || raw === undefined) return 0;
  const n = parseInt(raw, 10);
  return n;
}

function ClubBadge({ meta }) {
  if (!meta || !meta.club) return null;
  return (
    <span className="club-badge">
      {meta.icon ? (
        <img src={`${import.meta.env.BASE_URL}${meta.icon}`} alt="" className="club-badge-icon" />
      ) : (
        <>{meta.flag} </>
      )}
      {meta.club}
    </span>
  );
}

// Shared by Bracket and GroupStage so every tournament format gets the exact
// same manual-edit behaviour: enter score -> confirm -> shown as played ->
// "✏️ Изменить счёт" always available while the tournament is active.
export default function MatchCard({
  variant, // 'bracket' | 'group'
  match,
  playerMeta,
  sport,
  editable,
  homeTag,
  onConfirm,
  onNeedPenalty,
  onEdit,
}) {
  const [s1, setS1] = useState('');
  const [s2, setS2] = useState('');
  const [error, setError] = useState(null);
  const cfg = getSportConfig(sport);

  const isBracket = variant === 'bracket';
  const isDone = isBracket ? Boolean(match.winner) : Boolean(match.played);
  const isByeMatch = isBracket && (match.t1 === 'BYE' || match.t2 === 'BYE');
  const hasBothTeams = Boolean(match.t1 && match.t2);
  const isActive = hasBothTeams && !isDone && (!isBracket || (match.t1 !== 'BYE' && match.t2 !== 'BYE'));

  useEffect(() => {
    if (!isDone) { setS1(''); setS2(''); setError(null); }
  }, [isDone]);

  function handleConfirm() {
    const p1 = parseScoreInput(s1);
    const p2 = parseScoreInput(s2);
    if (Number.isNaN(p1) || Number.isNaN(p2)) { setError('Введите корректный счёт.'); return; }
    if (p1 === p2) {
      if (isBracket && cfg.hasPenalty) {
        setError(null);
        onNeedPenalty(p1, p2);
        return;
      }
      if (!cfg.hasDraws) {
        setError('Ничья невозможна — введите разные значения.');
        return;
      }
    }
    setError(null);
    onConfirm(p1, p2);
  }

  if (isBracket) {
    return (
      <div className={'match-slot' + (isDone ? ' done' : '') + (isActive ? ' active' : '')}>
        {[1, 2].map(teamNum => {
          const name = teamNum === 1 ? match.t1 : match.t2;
          const score = teamNum === 1 ? match.score1 : match.score2;
          const pen = teamNum === 1 ? match.pen1 : match.pen2;
          const isLucky = teamNum === 1 ? match.t1Lucky : match.t2Lucky;
          const isBye = name === 'BYE';
          const isWinner = isDone && match.winner === name && !isBye;
          const isLoser = isDone && !isWinner && name && !isBye;
          return (
            <div
              key={teamNum}
              className={'match-team' + (isWinner ? ' winner' : '') + (isLoser ? ' loser' : '') + (isBye ? ' bye-slot' : '') + (isLucky && !isDone ? ' lucky' : '')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="team-name" style={{ display: 'block' }}>{name || '—'}</span>
                {!isBye && cfg.hasClub && <ClubBadge meta={playerMeta && playerMeta[name]} />}
              </div>
              {isLucky && !isDone && <span className="lucky-badge">🍀 LL</span>}
              {isDone ? (
                <span className={'score-display' + (isWinner ? ' winner-score' : '')}>
                  {!isByeMatch && score != null ? (pen != null ? `${score} (${pen})` : score) : ''}
                </span>
              ) : (
                !isBye && hasBothTeams && editable && (
                  <input
                    type="number"
                    min="0"
                    max="99"
                    className="team-score-input"
                    placeholder="0"
                    value={teamNum === 1 ? s1 : s2}
                    onChange={e => (teamNum === 1 ? setS1(e.target.value) : setS2(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
                  />
                )
              )}
            </div>
          );
        })}
        {isActive && editable && (
          <>
            {error && <div style={{ color: 'var(--red)', fontSize: '0.7rem', padding: '2px 4px' }}>{error}</div>}
            <button className="confirm-btn" onClick={handleConfirm}>Подтвердить ✓</button>
          </>
        )}
        {isDone && editable && (
          <button className="edit-match-btn" onClick={onEdit}>✏️ Изменить счёт</button>
        )}
      </div>
    );
  }

  // group variant
  const w1 = isDone && match.score1 > match.score2;
  const w2 = isDone && match.score2 > match.score1;
  return (
    <div className={'group-match' + (isDone ? ' played' : ' active')}>
      <div className="gm-row">
        <div className={'gm-team' + (w1 ? ' gm-winner' : '')}>
          <span className="gm-team-name">{match.t1}</span>
          {homeTag && match.home ? <span className="gm-home-tag">🏠</span> : null}
        </div>
        {isDone ? (
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
        <div className={'gm-team right' + (w2 ? ' gm-winner' : '')}><span className="gm-team-name">{match.t2}</span></div>
        {isDone && editable && (
          <button className="gm-edit" title="Редактировать счёт" onClick={onEdit}>✏️</button>
        )}
      </div>
      {!isDone && editable && (
        <>
          {error && <div style={{ color: 'var(--red)', fontSize: '0.7rem', padding: '2px 4px' }}>{error}</div>}
          <button className="gm-confirm" onClick={handleConfirm}>Подтвердить ✓</button>
        </>
      )}
    </div>
  );
}
