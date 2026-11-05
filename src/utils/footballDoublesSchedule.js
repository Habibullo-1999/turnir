import { interleaveAmericanoRounds, orderedAmericanoRounds } from './americano.js';

const pairKey = pair => JSON.stringify([...pair].sort());
const fixtureKey = match => JSON.stringify([pairKey(match.pairA), pairKey(match.pairB)].sort());
const emptyMatch = (pairA, pairB) => ({ pairA, pairB, score1: null, score2: null, played: false });

// Each four-player selection has three possible disjoint pair-versus-pair
// fixtures. Partner rotation alone covers only a fraction of these fixtures.
export function completeFootballDoublesSchedule(tournament) {
  const players = tournament.players;
  const existing = orderedAmericanoRounds(tournament);
  const isLeague = tournament.format === 'league';
  if (isLeague && existing.length % 2) throw new Error('В расписании отсутствуют ответные встречи.');
  const half = isLeague ? existing.length / 2 : existing.length;
  const first = existing.slice(0, half);
  const second = existing.slice(half);
  const known = new Set(first.flatMap(round => round.matches).map(fixtureKey));
  const pending = [];
  for (let a = 0; a < players.length - 3; a++) {
    for (let b = a + 1; b < players.length - 2; b++) {
      for (let c = b + 1; c < players.length - 1; c++) {
        for (let d = c + 1; d < players.length; d++) {
          for (const [left, right] of [
            [[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]],
          ]) {
            const match = emptyMatch(left.map(i => players[i]), right.map(i => players[i]));
            if (!known.has(fixtureKey(match))) pending.push(match);
          }
        }
      }
    }
  }
  if (!pending.length) return false;

  // Prefer players who have appeared less often; this also rotates rests for
  // five players instead of making the same player sit out in a long block.
  const appearances = new Map(players.map(player => [player, 0]));
  const added = [];
  while (pending.length) {
    let best = 0;
    let lowest = Infinity;
    pending.forEach((match, index) => {
      const count = [...match.pairA, ...match.pairB].reduce((sum, player) => sum + appearances.get(player), 0);
      if (count < lowest) { lowest = count; best = index; }
    });
    const [match] = pending.splice(best, 1);
    const playing = new Set([...match.pairA, ...match.pairB]);
    playing.forEach(player => appearances.set(player, appearances.get(player) + 1));
    added.push({ matches: [match], byes: players.filter(player => !playing.has(player)) });
  }
  const returns = added.map(round => ({
    matches: round.matches.map(match => emptyMatch([...match.pairB], [...match.pairA])),
    byes: [...round.byes],
  }));
  tournament.rounds = [
    ...interleaveAmericanoRounds(first, added),
    ...(isLeague ? interleaveAmericanoRounds(second, returns) : []),
  ];
  return true;
}
