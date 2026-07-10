import { calcStandings } from './groups.js';

function emptyStat() {
  return { wins: 0, played: 0, goalsFor: 0, goalsAgainst: 0 };
}

// Per-player wins/played/goals across one tournament, plus the champion's
// name — computed once, at the moment a tournament finishes, and stored on
// the tournament record (mirrors the original buildHistoryEntry snapshot).
export function computeTournamentResult(tournament) {
  let winner = null;
  if (tournament.rounds && tournament.rounds.length) {
    const finalMatch = tournament.rounds[tournament.rounds.length - 1][0];
    winner = finalMatch.winner && finalMatch.winner !== 'BYE' ? finalMatch.winner : null;
  } else if (tournament.groups && tournament.groups.length) {
    const allStandings = tournament.groups.flatMap(g => calcStandings(g));
    allStandings.sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.gf - a.gf);
    winner = allStandings[0]?.name || null;
  }

  const stats = {};
  (tournament.players || []).forEach(p => { stats[p] = emptyStat(); });

  (tournament.rounds || []).forEach(round => {
    round.forEach(m => {
      if (!m.winner || m.t1 === 'BYE' || m.t2 === 'BYE' || m.score1 == null) return;
      if (!stats[m.t1]) stats[m.t1] = emptyStat();
      if (!stats[m.t2]) stats[m.t2] = emptyStat();
      stats[m.t1].played++; stats[m.t2].played++;
      stats[m.t1].goalsFor += m.score1; stats[m.t1].goalsAgainst += m.score2;
      stats[m.t2].goalsFor += m.score2; stats[m.t2].goalsAgainst += m.score1;
      if (m.winner === m.t1) stats[m.t1].wins++; else stats[m.t2].wins++;
    });
  });

  (tournament.groups || []).forEach(group => {
    group.matches.forEach(m => {
      if (!m.played || m.score1 == null) return;
      if (!stats[m.t1]) stats[m.t1] = emptyStat();
      if (!stats[m.t2]) stats[m.t2] = emptyStat();
      stats[m.t1].played++; stats[m.t2].played++;
      stats[m.t1].goalsFor += m.score1; stats[m.t1].goalsAgainst += m.score2;
      stats[m.t2].goalsFor += m.score2; stats[m.t2].goalsAgainst += m.score1;
      if (m.score1 > m.score2) stats[m.t1].wins++;
      else if (m.score2 > m.score1) stats[m.t2].wins++;
    });
  });

  return { winner, stats };
}

// Returns true once the tournament has a decided champion: final bracket
// match won (playoff / group+playoff-after-advance), or every group match
// played (group / league).
export function isTournamentComplete(tournament) {
  if (tournament.format === 'playoff' || (tournament.format === 'group+playoff' && tournament.rounds?.length)) {
    if (!tournament.rounds?.length) return false;
    const finalMatch = tournament.rounds[tournament.rounds.length - 1][0];
    return Boolean(finalMatch.winner && finalMatch.winner !== 'BYE');
  }
  if (tournament.format === 'group+playoff') return false; // waiting on advanceToPlayoff
  return (tournament.groups || []).length > 0 && tournament.groups.every(g => g.matches.every(m => m.played));
}
