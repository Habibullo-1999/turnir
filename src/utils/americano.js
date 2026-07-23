import { shuffle } from './bracket.js';

const BYE = null;

// Standard round-robin "circle method", applied to PARTNERSHIPS instead of
// opponents: for N players it produces N-1 rounds, each a perfect matching
// (every player paired with exactly one other), such that every possible
// pair of players ends up partnered together exactly once across all rounds.
function circlePartnerRounds(players) {
  const arr = players.slice();
  if (arr.length % 2 !== 0) arr.push(BYE);
  const n = arr.length;
  const rotating = arr.slice(1);
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [[arr[0], rotating[0]]];
    for (let i = 1; i < n / 2; i++) pairs.push([rotating[i], rotating[n - 1 - i]]);
    rounds.push(pairs);
    rotating.push(rotating.shift());
  }
  return rounds;
}

// Builds the full "Американо" schedule: players are shuffled first (random
// partner assignment), then rotated via circlePartnerRounds so everyone
// partners with everyone across the tournament. Within each round the
// partnerships are randomly matched up against each other 2-vs-2; a leftover
// unpaired player is folded into a 1-vs-2 match against a leftover
// partnership rather than sitting out, whenever both exist that round.
export function buildAmericanoRounds(players) {
  const shuffled = shuffle(players);
  const partnerRounds = circlePartnerRounds(shuffled);

  return partnerRounds.map(pairs => {
    const partnerships = [];
    const solos = [];
    pairs.forEach(([a, b]) => {
      if (a === BYE) solos.push(b);
      else if (b === BYE) solos.push(a);
      else partnerships.push([a, b]);
    });

    const shuffledPartnerships = shuffle(partnerships);
    const matches = [];
    let i = 0;
    for (; i + 1 < shuffledPartnerships.length; i += 2) {
      matches.push({ pairA: shuffledPartnerships[i], pairB: shuffledPartnerships[i + 1], score1: null, score2: null, played: false });
    }
    const leftoverPartnership = i < shuffledPartnerships.length ? shuffledPartnerships[i] : null;

    const byes = [];
    if (leftoverPartnership && solos.length > 0) {
      matches.push({ pairA: [solos.shift()], pairB: leftoverPartnership, score1: null, score2: null, played: false });
    } else if (leftoverPartnership) {
      byes.push(...leftoverPartnership);
    }
    byes.push(...solos);

    return { matches, byes };
  });
}

export function calcAmericanoStandings(tournament) {
  const table = {};
  (tournament.players || []).forEach(p => { table[p] = { pts: 0, w: 0, l: 0, played: 0, pf: 0, pa: 0 }; });

  (tournament.rounds || []).forEach(round => {
    round.matches.forEach(m => {
      if (!m.played) return;
      const s1 = m.score1, s2 = m.score2;
      m.pairA.forEach(p => { table[p].played++; table[p].pf += s1; table[p].pa += s2; });
      m.pairB.forEach(p => { table[p].played++; table[p].pf += s2; table[p].pa += s1; });
      if (s1 > s2) { m.pairA.forEach(p => { table[p].w++; table[p].pts += 3; }); m.pairB.forEach(p => { table[p].l++; }); }
      else if (s2 > s1) { m.pairB.forEach(p => { table[p].w++; table[p].pts += 3; }); m.pairA.forEach(p => { table[p].l++; }); }
    });
  });

  return Object.entries(table)
    .map(([name, s]) => ({ name, ...s, diff: s.pf - s.pa }))
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf);
}

export function isAmericanoComplete(tournament) {
  return (tournament.rounds || []).length > 0 && tournament.rounds.every(r => r.matches.every(m => m.played));
}

export function computeAmericanoResult(tournament) {
  const standings = calcAmericanoStandings(tournament);
  return { winner: standings[0]?.name || null, standings };
}
