import { propagateWinners, nextPow2, shuffle, buildRounds } from './bracket.js';
import { calcStandings } from './groups.js';
import { computeTournamentResult, isTournamentComplete } from './computeStats.js';

function finishIfComplete(draft) {
  if (draft.status === 'finished') return;
  if (!isTournamentComplete(draft)) return;
  const { winner, stats } = computeTournamentResult(draft);
  draft.status = 'finished';
  draft.winner = winner;
  draft.stats = stats;
  draft.finishedAt = Date.now();
  draft.date = new Date().toLocaleDateString('ru');
}

export function confirmBracketScore(draft, rIdx, mIdx, s1, s2) {
  const match = draft.rounds[rIdx][mIdx];
  match.score1 = s1;
  match.score2 = s2;
  match.winner = s1 > s2 ? match.t1 : match.t2;
  propagateWinners(draft.rounds);
  finishIfComplete(draft);
}

export function confirmBracketPenalty(draft, rIdx, mIdx, s1, s2, p1, p2) {
  const match = draft.rounds[rIdx][mIdx];
  match.score1 = s1;
  match.score2 = s2;
  match.pen1 = p1;
  match.pen2 = p2;
  match.winner = p1 > p2 ? match.t1 : match.t2;
  propagateWinners(draft.rounds);
  finishIfComplete(draft);
}

// Clears a played bracket match and recursively clears any downstream
// matches the winner had already advanced into.
export function clearBracketMatch(draft, rIdx, mIdx) {
  const match = draft.rounds[rIdx][mIdx];
  const prevWinner = match.winner;
  match.winner = null; match.score1 = null; match.score2 = null;
  match.pen1 = undefined; match.pen2 = undefined;

  if (prevWinner) {
    for (let r = rIdx + 1; r < draft.rounds.length; r++) {
      for (let m = 0; m < draft.rounds[r].length; m++) {
        const nm = draft.rounds[r][m];
        if (nm.t1 === prevWinner || nm.t2 === prevWinner) {
          if (nm.winner) clearBracketMatch(draft, r, m);
          if (nm.t1 === prevWinner) nm.t1 = null;
          if (nm.t2 === prevWinner) nm.t2 = null;
        }
      }
    }
  }
}

export function confirmGroupScore(draft, gIdx, mIdx, s1, s2) {
  const match = draft.groups[gIdx].matches[mIdx];
  match.score1 = s1;
  match.score2 = s2;
  match.played = true;
  finishIfComplete(draft);
}

export function clearGroupMatch(draft, gIdx, mIdx) {
  const match = draft.groups[gIdx].matches[mIdx];
  match.played = false;
  match.score1 = null;
  match.score2 = null;
}

export function advanceGroupsToPlayoff(draft) {
  const advanceCount = Math.min(2, Math.min(...draft.groups.map(g => g.players.length)));
  const advancedPlayers = [];
  draft.groups.forEach(group => {
    calcStandings(group).slice(0, advanceCount).forEach(p => advancedPlayers.push(p.name));
  });

  if (advancedPlayers.length < 2) {
    throw new Error('Недостаточно участников для плей-офф.');
  }

  const size = nextPow2(advancedPlayers.length);
  const seeded = shuffle(advancedPlayers);
  while (seeded.length < size) seeded.push('BYE');

  const { rounds, roundLabels } = buildRounds(seeded);
  draft.rounds = rounds;
  draft.roundLabels = roundLabels;
  propagateWinners(draft.rounds);
  finishIfComplete(draft);
}
