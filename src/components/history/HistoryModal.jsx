import React from 'react';
import StandingsTable from '../tournament/StandingsTable.jsx';
import MatchCard from '../tournament/MatchCard.jsx';
import { computeGroupTours, computeLeagueTours } from '../../utils/groups.js';

export default function HistoryModal({ entry, onClose }) {
  const groups = entry.groups || [];
  const rounds = entry.rounds || [];
  const isLeague = entry.format === 'league';

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal-inner" onClick={e => e.stopPropagation()}>
        <div className="history-modal-header">
          <div>
            <div className="history-modal-title">{entry.name || 'Турнир'}</div>
            <div className="history-modal-subtitle">{entry.date} · {(entry.players || []).length} участников · 🏆 {entry.winner || '—'}</div>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>✕ Закрыть</button>
        </div>

        {groups.length > 0 && (
          <div className="history-modal-groups">
            {groups.map((group, gIdx) => {
              const tours = isLeague ? computeLeagueTours(group) : computeGroupTours(group);
              return (
                <div className="group-block" key={gIdx}>
                  <div className="group-name">{isLeague ? '🏅 Лига' : group.name}</div>
                  <StandingsTable group={group} />
                  <div className="group-tours">
                    {tours.map((matchIndices, tIdx) => (
                      <div className="group-tour" key={tIdx}>
                        <div className="group-tour-label">Тур {tIdx + 1}</div>
                        <div className="group-tour-matches">
                          {matchIndices.map(mIdx => (
                            <MatchCard key={mIdx} variant="group" match={group.matches[mIdx]} editable={false} homeTag={isLeague} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {rounds.length > 0 && (
          <>
            {groups.length > 0 && <div className="history-modal-section-label">🏆 Плей-офф</div>}
            <div className="bracket-scroll">
              <div className="bracket">
                {rounds.map((round, rIdx) => (
                  <React.Fragment key={rIdx}>
                    <div className="round-col">
                      <div className="round-label">{(entry.roundLabels || [])[rIdx] || `Раунд ${rIdx + 1}`}</div>
                      <div className="round-matches">
                        {round.map((match, mIdx) => (
                          <React.Fragment key={mIdx}>
                            {mIdx > 0 && <div style={{ height: Math.pow(2, rIdx) * 10 }} />}
                            <div className="match-wrapper">
                              <MatchCard variant="bracket" match={match} playerMeta={entry.playerMeta} editable={false} />
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    {rIdx < rounds.length - 1 && <div style={{ width: 24, flexShrink: 0 }} />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
