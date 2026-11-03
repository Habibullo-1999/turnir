import { playedMatches } from './computeStats.js';

export function comparisonPlayers(history) {
  const names = new Set();
  history.forEach(entry => {
    (entry.players || []).forEach(name => names.add(name));
    Object.entries(entry.stats || {}).forEach(([name, stats]) => { if (stats) names.add(name); });
    playedMatches(entry).forEach(match => { names.add(match.t1); names.add(match.t2); });
  });
  return [...names].filter(name => name && name !== 'BYE').sort((a, b) => a.localeCompare(b, 'ru'));
}

function finishedTime(entry) {
  if (entry.finishedAt) return new Date(entry.finishedAt).getTime() || 0;
  if (entry.date) {
    const [day, month, year] = entry.date.split('.').map(Number);
    if (day && month && year) return new Date(year, month - 1, day).getTime();
  }
  return entry.createdAt || parseInt(entry.id, 10) || 0;
}

// Счёт всегда ориентирован на выбранный порядок игроков, включая гостевые матчи.
export function comparePlayers(history, first, second) {
  const result = { matches: [], wins: [0, 0], draws: 0, goals: [0, 0], bestStreaks: [0, 0], biggestWins: [null, null] };
  if (!first || !second || first === second) return result;
  const streaks = [0, 0];
  const chronological = [...history].sort((a, b) => finishedTime(a) - finishedTime(b));

  chronological.forEach(entry => {
    playedMatches(entry).forEach(match => {
      const forward = match.t1 === first && match.t2 === second;
      const backward = match.t1 === second && match.t2 === first;
      if (!forward && !backward) return;
      const scores = forward ? [match.score1, match.score2] : [match.score2, match.score1];
      const winner = match.winner === first ? 0 : match.winner === second ? 1 : null;
      const meeting = { entry, scores, winner, penalties: match.penalties };
      result.matches.push(meeting);
      scores.forEach((score, i) => { result.goals[i] += score; });
      if (winner === null) result.draws++;
      else {
        result.wins[winner]++;
        const previous = result.biggestWins[winner];
        const margin = scores[winner] - scores[1 - winner];
        if (!previous || margin > previous.scores[winner] - previous.scores[1 - winner]) {
          result.biggestWins[winner] = meeting;
        }
      }
      streaks.forEach((streak, i) => {
        streaks[i] = winner === i ? streak + 1 : 0;
        result.bestStreaks[i] = Math.max(result.bestStreaks[i], streaks[i]);
      });
    });
  });
  result.matches.reverse();
  return result;
}
