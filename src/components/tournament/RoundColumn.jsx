import React from 'react';
import MatchCard from './MatchCard.jsx';

export default function RoundColumn({ round, roundIdx, label, playerMeta, editable, onConfirm, onNeedPenalty, onEdit }) {
  const spacerH = Math.pow(2, roundIdx) * 10;
  return (
    <div className="round-col">
      <div className="round-label">{label}</div>
      <div className="round-matches">
        {round.map((match, mIdx) => (
          <React.Fragment key={mIdx}>
            {mIdx > 0 && <div style={{ height: spacerH }} />}
            <div className="match-wrapper">
              <MatchCard
                variant="bracket"
                match={match}
                playerMeta={playerMeta}
                editable={editable}
                onConfirm={(s1, s2) => onConfirm(roundIdx, mIdx, s1, s2)}
                onNeedPenalty={(s1, s2) => onNeedPenalty(roundIdx, mIdx, s1, s2)}
                onEdit={() => onEdit(roundIdx, mIdx)}
              />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
