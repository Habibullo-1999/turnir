import React from 'react';
import RoundColumn from './RoundColumn.jsx';
import BracketRearrange from './BracketRearrange.jsx';
import { hasBracketStarted } from '../../utils/manualRearrange.js';
import { getSportConfig } from '../../utils/sportConfig.js';

export default function Bracket({ tournament, editable, onConfirm, onNeedPenalty, onEdit, onSwap }) {
  const cfg = getSportConfig(tournament.sport);
  const participantMeta = tournament.participantMeta || tournament.playerMeta;
  const hasLucky = tournament.rounds.some(round => round.some(m => m.t1Lucky || m.t2Lucky));
  const canRearrange = editable && !hasBracketStarted(tournament.rounds);

  return (
    <div className="card" id="bracket-section">
      <div className="bracket-header">
        <div>
          <div className="bracket-title">{tournament.name}</div>
          <div className="bracket-subtitle">{tournament.players.length} {cfg.unitNoun} · {tournament.rounds.length} раундов</div>
        </div>
      </div>
      {canRearrange && <BracketRearrange rounds={tournament.rounds} onSwap={onSwap} />}
      {hasLucky && (
        <div className="lucky-legend">
          🍀 <strong>Lucky Loser</strong> — лучший проигравший из предыдущего раунда по разнице {cfg.diffGenitive}
        </div>
      )}
      <div className="bracket-scroll" style={{ marginTop: 16 }}>
        <div className="bracket">
          {tournament.rounds.map((round, rIdx) => (
            <React.Fragment key={rIdx}>
              <RoundColumn
                round={round}
                roundIdx={rIdx}
                label={tournament.roundLabels[rIdx]}
                playerMeta={participantMeta}
                sport={tournament.sport}
                editable={editable}
                onConfirm={onConfirm}
                onNeedPenalty={onNeedPenalty}
                onEdit={onEdit}
              />
              {rIdx < tournament.rounds.length - 1 && <div style={{ width: 24, flexShrink: 0 }} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
