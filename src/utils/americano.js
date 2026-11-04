import { shuffle } from './bracket.js';
import { FOOTBALL_DOUBLES, getSportConfig } from './sportConfig.js';

const BYE = null;

// Keep completed rounds at the front and spread new rounds between the
// remaining fixtures without changing the relative order of existing rounds.
export function interleaveAmericanoRounds(existing, added) {
  if (!existing.length) return added;
  const firstUnplayed = existing.findIndex(round => round.matches.some(match => !match.played));
  const start = firstUnplayed < 0 ? existing.length - 1 : Math.max(0, firstUnplayed - 1);
  const anchors = existing.slice(start);
  const rounds = existing.slice(0, start);
  anchors.forEach((round, index) => {
    rounds.push(round, ...added.slice(
      Math.ceil(index * added.length / anchors.length),
      Math.ceil((index + 1) * added.length / anchors.length),
    ));
  });
  return rounds;
}

// Older saved leagues kept new-player fixtures in a separate block. Display
// and extend them in the regular legs while retaining the original match data.
export function orderedAmericanoRounds(tournament) {
  const rounds = tournament.rounds || [];
  if (!rounds.some(round => round.additionalLeg)) return rounds;
  const original = rounds.filter(round => !round.additionalLeg);
  const half = original.length / 2;
  return [
    ...interleaveAmericanoRounds(original.slice(0, half), rounds.filter(round => round.additionalLeg === 1)),
    ...interleaveAmericanoRounds(original.slice(half), rounds.filter(round => round.additionalLeg === 2)),
  ];
}

export function americanoReturnPairs(tournament) {
  if (tournament.format !== 'league' || !getSportConfig(tournament.sport).doubleRoundRobinLeague) return [];
  const rounds = orderedAmericanoRounds(tournament);
  if (rounds.length % 2) throw new Error('В расписании отсутствуют ответные встречи.');
  const half = rounds.length / 2;
  const key = (a, b) => JSON.stringify([[...a].sort(), [...b].sort()]);
  const returns = new Map();
  rounds.slice(half).flatMap(round => round.matches).forEach(match => {
    const signature = key(match.pairB, match.pairA);
    if (!returns.has(signature)) returns.set(signature, []);
    returns.get(signature).push(match);
  });
  const pairs = rounds.slice(0, half).flatMap(round => round.matches).map(first => {
    const second = returns.get(key(first.pairA, first.pairB))?.shift();
    if (!second) throw new Error('В расписании отсутствует ответный матч для одной из пар.');
    return { first, second };
  });
  if ([...returns.values()].some(matches => matches.length)) {
    throw new Error('В расписании есть ответный матч без первой встречи.');
  }
  return pairs;
}

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
export function buildAmericanoRounds(players, { allowUnevenTeams = true, double = false, random = Math.random } = {}) {
  const shuffled = shuffle(players, random);
  const partnerRounds = circlePartnerRounds(shuffled);

  const rounds = partnerRounds.map(pairs => {
    const partnerships = [];
    const solos = [];
    pairs.forEach(([a, b]) => {
      if (a === BYE) solos.push(b);
      else if (b === BYE) solos.push(a);
      else partnerships.push([a, b]);
    });

    const shuffledPartnerships = shuffle(partnerships, random);
    const matches = [];
    let i = 0;
    for (; i + 1 < shuffledPartnerships.length; i += 2) {
      matches.push({ pairA: shuffledPartnerships[i], pairB: shuffledPartnerships[i + 1], score1: null, score2: null, played: false });
    }
    const leftoverPartnership = i < shuffledPartnerships.length ? shuffledPartnerships[i] : null;

    const byes = [];
    if (allowUnevenTeams && leftoverPartnership && solos.length > 0) {
      matches.push({ pairA: [solos.shift()], pairB: leftoverPartnership, score1: null, score2: null, played: false });
    } else if (leftoverPartnership) {
      byes.push(...leftoverPartnership);
    }
    byes.push(...solos);

    return { matches, byes };
  });
  if (!double) return rounds;

  // Ответный круг повторяет составы, меняя хозяев и гостей местами.
  const returnRounds = rounds.map(round => ({
    matches: round.matches.map(match => ({
      pairA: [...match.pairB],
      pairB: [...match.pairA],
      score1: null,
      score2: null,
      played: false,
    })),
    byes: [...round.byes],
  }));
  return [...rounds, ...returnRounds];
}

export function calcAmericanoStandings(tournament) {
  const table = {};
  (tournament.players || []).forEach(p => { table[p] = { pts: 0, w: 0, d: 0, l: 0, played: 0, pf: 0, pa: 0 }; });

  (tournament.rounds || []).forEach(round => {
    round.matches.forEach(m => {
      if (!m.played) return;
      const s1 = m.score1, s2 = m.score2;
      m.pairA.forEach(p => { table[p].played++; table[p].pf += s1; table[p].pa += s2; });
      m.pairB.forEach(p => { table[p].played++; table[p].pf += s2; table[p].pa += s1; });
      if (s1 > s2) { m.pairA.forEach(p => { table[p].w++; table[p].pts += 3; }); m.pairB.forEach(p => { table[p].l++; }); }
      else if (s2 > s1) { m.pairB.forEach(p => { table[p].w++; table[p].pts += 3; }); m.pairA.forEach(p => { table[p].l++; }); }
      else { [...m.pairA, ...m.pairB].forEach(p => { table[p].d++; table[p].pts++; }); }
    });
  });

  return Object.entries(table)
    .map(([name, s]) => ({ name, ...s, diff: s.pf - s.pa }))
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.pf - a.pf);
}

export function isAmericanoComplete(tournament) {
  const matches = (tournament.rounds || []).flatMap(round => round.matches);
  return matches.length > 0 && matches.every(match => match.played);
}

export function computeAmericanoResult(tournament) {
  if (tournament.sport === FOOTBALL_DOUBLES) {
    const standings = calcFootballDoublesStandings(tournament);
    const first = standings[0];
    const winners = first ? standings.filter(row => comparePairResults(row, first) === 0) : [];
    return { winner: winners.map(row => row.name).join(' / ') || null, standings };
  }
  const standings = calcAmericanoStandings(tournament);
  return { winner: standings[0]?.name || null, standings };
}

function comparePairResults(a, b) {
  return b.pts - a.pts || b.diff - a.diff || b.pf - a.pf;
}

export function calcFootballDoublesStandings(tournament) {
  return aggregateAmericanoPairStats([tournament])
    .map(row => ({ ...row, name: row.members.join(' & '), pts: row.w * 3 + row.d, diff: row.pf - row.pa }))
    .sort((a, b) => comparePairResults(a, b) || a.name.localeCompare(b.name, 'ru'));
}

// Партнёры в «Американо» меняются каждый раунд, поэтому нет смысла в личном
// зачёте между турнирами — вместо этого считаем, как сыгрались конкретные
// пары (по всем раундам всех турниров этого вида спорта), не только личный
// счёт каждого игрока в TurnikLadder/AmericanoBoard.
function pairKey(pair) {
  return pair.slice().sort((a, b) => a.localeCompare(b, 'ru')).join(' & ');
}

function creditPair(table, pair, pf, pa) {
  if (pair.length < 2) return; // сольная сторона матча 1×2 — тут нет пары
  const key = pairKey(pair);
  if (!table[key]) table[key] = { members: pair.slice().sort((a, b) => a.localeCompare(b, 'ru')), played: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0 };
  const s = table[key];
  s.played++;
  s.pf += pf;
  s.pa += pa;
  if (pf > pa) s.w++;
  else if (pa > pf) s.l++;
  else s.d++;
}

export function aggregateAmericanoPairStats(history) {
  const table = {};
  history.forEach(entry => {
    (entry.rounds || []).forEach(round => {
      round.matches.forEach(m => {
        if (!m.played) return;
        creditPair(table, m.pairA, m.score1, m.score2);
        creditPair(table, m.pairB, m.score2, m.score1);
      });
    });
  });
  return Object.values(table).sort((a, b) => (b.w * 3 + b.d) - (a.w * 3 + a.d) || (b.pf - b.pa) - (a.pf - a.pa));
}
