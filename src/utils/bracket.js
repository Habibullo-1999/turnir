// Pure bracket-building / propagation helpers, ported from the original
// vanilla-JS prototype almost verbatim. All functions here operate on plain
// data (no DOM, no global `state`) so they can be unit-driven from React.

export function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getRoundLabel(totalRounds, roundIdx) {
  const fromEnd = totalRounds - 1 - roundIdx;
  if (fromEnd === 0) return 'Финал';
  if (fromEnd === 1) return 'Полуфинал';
  if (fromEnd === 2) return 'Четвертьфинал';
  if (fromEnd === 3) return '1/8 финала';
  if (fromEnd === 4) return '1/16 финала';
  return `Раунд ${roundIdx + 1}`;
}

export function isByeMatch(m) {
  return m.t1 === 'BYE' && m.t2 === 'BYE';
}

export function isRealMatch(m) {
  return m.t1 && m.t2 && m.t1 !== 'BYE' && m.t2 !== 'BYE';
}

// seeded: array of names/BYE, length already a power of 2
export function buildRounds(seeded) {
  const size = seeded.length;
  const totalRounds = Math.log2(size);
  const roundLabels = [];
  for (let r = 0; r < totalRounds; r++) roundLabels.push(getRoundLabel(totalRounds, r));

  const firstRound = [];
  for (let i = 0; i < size; i += 2) {
    const m = { t1: seeded[i], t2: seeded[i + 1], score1: null, score2: null, winner: null, t1Lucky: false, t2Lucky: false };
    if (m.t2 === 'BYE') m.winner = m.t1;
    else if (m.t1 === 'BYE') m.winner = m.t2;
    firstRound.push(m);
  }

  const rounds = [firstRound];
  for (let r = 1; r < totalRounds; r++) {
    const prevCount = rounds[r - 1].length;
    const round = [];
    for (let m = 0; m < prevCount / 2; m++) {
      round.push({ t1: null, t2: null, score1: null, score2: null, winner: null, t1Lucky: false, t2Lucky: false });
    }
    rounds.push(round);
  }
  return { rounds, roundLabels };
}

// Mutates `rounds` in place: propagates winners forward and fills in
// lucky-loser slots created by BYE-vs-BYE matches once all real matches in a
// round are finished.
export function propagateWinners(rounds) {
  for (let r = 0; r < rounds.length - 1; r++) {
    const round = rounds[r];
    const next = rounds[r + 1];

    const luckySlots = {};

    for (let m = 0; m < round.length; m++) {
      const match = round[m];
      const nm = Math.floor(m / 2);
      const slot = m % 2;
      const nextMatch = next[nm];

      if (!luckySlots[nm]) luckySlots[nm] = [false, false];
      if (!match.winner) continue;
      if (nextMatch.winner) continue;

      if (isByeMatch(match)) {
        luckySlots[nm][slot] = true;
        if (slot === 0) { nextMatch.t1 = null; nextMatch.t1Lucky = false; }
        else { nextMatch.t2 = null; nextMatch.t2Lucky = false; }
      } else {
        if (slot === 0) { nextMatch.t1 = match.winner; nextMatch.t1Lucky = false; }
        else { nextMatch.t2 = match.winner; nextMatch.t2Lucky = false; }
      }
    }

    next.forEach((match, nm) => {
      if (match.winner) return;
      const pending = luckySlots[nm] || [false, false];
      if (pending[0] || pending[1]) return;
      if (match.t1 && match.t2) {
        if (match.t2 === 'BYE') match.winner = match.t1;
        else if (match.t1 === 'BYE') match.winner = match.t2;
      }
    });

    const realMatches = round.filter(isRealMatch);
    const allRealDone = realMatches.length > 0 && realMatches.every(m => m.winner);
    const hasPending = Object.values(luckySlots).some(p => p[0] || p[1]);

    if (allRealDone && hasPending) {
      const losers = realMatches
        .map(m => {
          const loserIsT2 = m.winner === m.t1;
          const loserName = loserIsT2 ? m.t2 : m.t1;
          const goalsFor = loserIsT2 ? (m.score2 || 0) : (m.score1 || 0);
          const goalsAgainst = loserIsT2 ? (m.score1 || 0) : (m.score2 || 0);
          return { name: loserName, diff: goalsFor - goalsAgainst, scored: goalsFor };
        })
        .sort((a, b) => b.diff - a.diff || b.scored - a.scored);

      let li = 0;
      Object.entries(luckySlots).forEach(([nmStr, slots]) => {
        const nm = parseInt(nmStr, 10);
        const match = next[nm];
        if (match.winner) return;
        for (let s = 0; s < 2; s++) {
          if (slots[s] && li < losers.length) {
            if (s === 0) { match.t1 = losers[li].name; match.t1Lucky = true; }
            else { match.t2 = losers[li].name; match.t2Lucky = true; }
            li++;
          }
        }
        if (!match.winner && match.t1 && match.t2) {
          if (match.t1 === 'BYE') match.winner = match.t2;
          else if (match.t2 === 'BYE') match.winner = match.t1;
        }
      });
    }
  }
}
