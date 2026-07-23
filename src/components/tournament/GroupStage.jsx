import React from 'react';
import StandingsTable from './StandingsTable.jsx';
import MatchCard from './MatchCard.jsx';
import GroupRearrange from './GroupRearrange.jsx';
import { computeGroupTours, computeLeagueTours } from '../../utils/groups.js';
import { hasGroupsStarted } from '../../utils/manualRearrange.js';
import { getSportConfig } from '../../utils/sportConfig.js';

export default function GroupStage({ tournament, editable, onConfirmMatch, onEditMatch, onAdvance, onMovePlayer }) {
  const cfg = getSportConfig(tournament.sport);
  const participantMeta = tournament.participantMeta || tournament.playerMeta;
  const isLeague = tournament.format === 'league';
  const isDoubleLeague = isLeague && cfg.doubleRoundRobinLeague;
  const advanceCount = tournament.format === 'group+playoff'
    ? Math.min(2, Math.floor(tournament.groups[0].players.length / 2) + 1)
    : 0;
  const allGroupsDone = tournament.groups.every(g => g.matches.every(m => m.played));
  const showAdvance = tournament.format === 'group+playoff' && allGroupsDone && !tournament.rounds?.length;
  const canRearrange = editable && !isLeague && !hasGroupsStarted(tournament.groups);

  return (
    <div className="card" id="group-section">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="bracket-title">{tournament.name}</div>
          <div className="bracket-subtitle">
            {isLeague
              ? isDoubleLeague
                ? `${tournament.players.length} ${cfg.unitNoun} · ${tournament.players.length * (tournament.players.length - 1)} матчей · каждый с каждым дважды`
                : `${tournament.players.length} ${cfg.unitNoun} · ${tournament.players.length * (tournament.players.length - 1) / 2} матчей · каждый с каждым`
              : `${tournament.players.length} ${cfg.unitNoun} · ${tournament.groups.length} групп${tournament.format === 'group+playoff' ? ' → плей-офф' : ''}`}
          </div>
        </div>
        {showAdvance && editable && (
          <button className="btn btn-secondary" onClick={onAdvance}>⚡ К плей-офф</button>
        )}
      </div>

      {canRearrange && <GroupRearrange groups={tournament.groups} onMove={onMovePlayer} />}

      <div id="groups-container">
        {tournament.groups.map((group, gIdx) => {
          const tours = isDoubleLeague ? computeLeagueTours(group) : computeGroupTours(group);
          return (
            <div className="group-block" key={group.name + gIdx}>
              <div className="group-name">{isLeague ? '🏅 Лига' : group.name}</div>
              <StandingsTable group={group} advanceCount={advanceCount} sport={tournament.sport} />
              <div className="group-tours">
                {tours.map((matchIndices, tIdx) => (
                  <div className="group-tour" key={tIdx}>
                    <div className="group-tour-label">Тур {tIdx + 1}</div>
                    <div className="group-tour-matches">
                      {matchIndices.map(mIdx => (
                        <MatchCard
                          key={mIdx}
                          variant="group"
                          match={group.matches[mIdx]}
                          playerMeta={participantMeta}
                          sport={tournament.sport}
                          editable={editable}
                          homeTag={isDoubleLeague}
                          onConfirm={(s1, s2) => onConfirmMatch(gIdx, mIdx, s1, s2)}
                          onEdit={() => onEditMatch(gIdx, mIdx)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
