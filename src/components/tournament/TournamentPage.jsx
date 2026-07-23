import React, { useEffect, useRef, useState } from 'react';
import GroupStage from './GroupStage.jsx';
import Bracket from './Bracket.jsx';
import WinnerBanner from './WinnerBanner.jsx';
import ShareCard from './ShareCard.jsx';
import PenaltyModal from './PenaltyModal.jsx';
import TurnikLadder from './TurnikLadder.jsx';
import AmericanoBoard from './AmericanoBoard.jsx';
import SaveIndicator from '../SaveIndicator.jsx';
import { useTournament } from '../../context/TournamentContext.jsx';
import {
  confirmBracketScore, confirmBracketPenalty, clearBracketMatch,
  confirmGroupScore, clearGroupMatch, advanceGroupsToPlayoff, reopenTournament,
} from '../../utils/matchActions.js';
import { swapBracketSlots, movePlayerToGroup } from '../../utils/manualRearrange.js';
import { markPassed, markFailed, undoMark, advanceRound } from '../../utils/ladderActions.js';
import { confirmAmericanoScore, clearAmericanoScore } from '../../utils/americanoActions.js';
import { getSportConfig } from '../../utils/sportConfig.js';

export default function TournamentPage({ onHome }) {
  const { tournament, mutate, closeTournament, saveStatus, saveError } = useTournament();
  const [penaltyCtx, setPenaltyCtx] = useState(null);
  const [advanceError, setAdvanceError] = useState(null);
  const prevStatus = useRef(tournament?.status);
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    if (!tournament) return;
    if (prevStatus.current === 'active' && tournament.status === 'finished') {
      setJustFinished(true);
    }
    prevStatus.current = tournament.status;
  }, [tournament?.status]);

  if (!tournament) return null;

  const editable = tournament.status === 'active';
  const cfg = getSportConfig(tournament.sport);
  const isTurnik = cfg.engine === 'turnik-ladder';
  const isAmericano = cfg.engine === 'americano';
  const isBracketGroup = cfg.engine === 'bracket-group';
  const isGroupFormat = tournament.format === 'group' || tournament.format === 'group+playoff' || tournament.format === 'league';

  function handleGroupConfirm(gIdx, mIdx, s1, s2) {
    mutate(draft => confirmGroupScore(draft, gIdx, mIdx, s1, s2));
  }
  function handleGroupEdit(gIdx, mIdx) {
    mutate(draft => clearGroupMatch(draft, gIdx, mIdx));
  }
  function handleBracketConfirm(rIdx, mIdx, s1, s2) {
    mutate(draft => confirmBracketScore(draft, rIdx, mIdx, s1, s2));
  }
  function handleBracketEdit(rIdx, mIdx) {
    mutate(draft => clearBracketMatch(draft, rIdx, mIdx));
  }
  function handleNeedPenalty(rIdx, mIdx, s1, s2) {
    const match = tournament.rounds[rIdx][mIdx];
    setPenaltyCtx({ rIdx, mIdx, s1, s2, t1: match.t1, t2: match.t2 });
  }
  function handleConfirmPenalty(p1, p2) {
    const { rIdx, mIdx, s1, s2 } = penaltyCtx;
    mutate(draft => confirmBracketPenalty(draft, rIdx, mIdx, s1, s2, p1, p2));
    setPenaltyCtx(null);
  }
  function handleSwap(nameA, nameB) {
    mutate(draft => swapBracketSlots(draft, nameA, nameB));
  }
  function handleMovePlayer(player, targetGroupIdx) {
    mutate(draft => movePlayerToGroup(draft, player, targetGroupIdx));
  }
  function handleAdvance() {
    setAdvanceError(null);
    try {
      mutate(draft => advanceGroupsToPlayoff(draft));
    } catch (err) {
      setAdvanceError(err.message);
    }
  }
  function handleLadderPass(name) {
    mutate(draft => markPassed(draft, name));
  }
  function handleLadderFail(name) {
    mutate(draft => markFailed(draft, name));
  }
  function handleLadderUndo(name) {
    mutate(draft => undoMark(draft, name));
  }
  function handleLadderAdvance() {
    setAdvanceError(null);
    try {
      mutate(draft => advanceRound(draft));
    } catch (err) {
      setAdvanceError(err.message);
    }
  }
  function handleAmericanoConfirm(rIdx, mIdx, s1, s2) {
    mutate(draft => confirmAmericanoScore(draft, rIdx, mIdx, s1, s2));
  }
  function handleAmericanoEdit(rIdx, mIdx) {
    mutate(draft => clearAmericanoScore(draft, rIdx, mIdx));
  }
  function handleReopen() {
    setJustFinished(false);
    mutate(draft => reopenTournament(draft));
  }
  function handleNewTournament() {
    setJustFinished(false);
    closeTournament();
    onHome();
  }
  function handleGoHome() {
    closeTournament();
    onHome();
  }

  return (
    <div>
      {editable && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
          <SaveIndicator status={saveStatus} error={saveError} />
          <button className="pause-btn" onClick={handleGoHome}>🏠 Домой</button>
        </div>
      )}

      {isTurnik && (
        <TurnikLadder
          tournament={tournament}
          editable={editable}
          onPass={handleLadderPass}
          onFail={handleLadderFail}
          onUndo={handleLadderUndo}
          onAdvance={handleLadderAdvance}
        />
      )}

      {isAmericano && (
        <AmericanoBoard
          tournament={tournament}
          editable={editable}
          onConfirm={handleAmericanoConfirm}
          onEdit={handleAmericanoEdit}
        />
      )}

      {isBracketGroup && (
        <>
          {isGroupFormat && (
            <GroupStage
              tournament={tournament}
              editable={editable}
              onConfirmMatch={handleGroupConfirm}
              onEditMatch={handleGroupEdit}
              onAdvance={handleAdvance}
              onMovePlayer={handleMovePlayer}
            />
          )}

          {tournament.rounds && tournament.rounds.length > 0 && (
            <Bracket
              tournament={tournament}
              editable={editable}
              onConfirm={handleBracketConfirm}
              onNeedPenalty={handleNeedPenalty}
              onEdit={handleBracketEdit}
              onSwap={handleSwap}
            />
          )}
        </>
      )}
      {advanceError && <div style={{ color: 'var(--red)', margin: '8px 0' }}>⚠️ {advanceError}</div>}

      {tournament.status === 'finished' && tournament.winner && (
        <WinnerBanner tournament={tournament} celebrate={justFinished} onNewTournament={handleNewTournament} onReopen={handleReopen} />
      )}

      {tournament.status === 'active' && <ShareCard tournamentId={tournament.id} />}

      {isBracketGroup && <PenaltyModal ctx={penaltyCtx} onConfirm={handleConfirmPenalty} onClose={() => setPenaltyCtx(null)} />}
    </div>
  );
}
