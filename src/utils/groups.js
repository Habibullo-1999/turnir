import { shuffle } from './bracket.js';

export function buildGroups(players) {
  const shuffled = shuffle(players);
  const n = shuffled.length;
  let numGroups;
  if (n <= 5) numGroups = 1;
  else if (n <= 8) numGroups = 2;
  else numGroups = Math.ceil(n / 4);

  const groups = [];
  const letters = 'ABCDEFGH';
  for (let g = 0; g < numGroups; g++) {
    groups.push({ name: 'Группа ' + letters[g], players: [], matches: [] });
  }
  shuffled.forEach((p, i) => groups[i % numGroups].players.push(p));
  groups.forEach(group => {
    const ps = group.players;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        group.matches.push({ t1: ps[i], t2: ps[j], score1: null, score2: null, played: false });
      }
    }
  });
  return groups;
}

export function buildLeague(players) {
  const ps = shuffle(players);
  const matches = [];
  for (let i = 0; i < ps.length; i++) {
    for (let j = 0; j < ps.length; j++) {
      if (i !== j) matches.push({ t1: ps[i], t2: ps[j], score1: null, score2: null, played: false, home: true });
    }
  }
  return [{ name: 'Лига', players: ps, matches }];
}

export function calcStandings(group) {
  const table = {};
  group.players.forEach(p => { table[p] = { pts: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, played: 0 }; });
  group.matches.forEach(m => {
    if (!m.played) return;
    const s1 = m.score1, s2 = m.score2;
    table[m.t1].played++; table[m.t2].played++;
    table[m.t1].gf += s1; table[m.t1].ga += s2;
    table[m.t2].gf += s2; table[m.t2].ga += s1;
    if (s1 > s2) { table[m.t1].pts += 3; table[m.t1].w++; table[m.t2].l++; }
    else if (s1 < s2) { table[m.t2].pts += 3; table[m.t2].w++; table[m.t1].l++; }
    else { table[m.t1].pts++; table[m.t1].d++; table[m.t2].pts++; table[m.t2].d++; }
  });
  return Object.entries(table)
    .map(([name, s]) => ({ name, ...s, diff: s.gf - s.ga }))
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.gf - a.gf);
}

export function computeGroupTours(group) {
  const ps = group.players.slice();
  if (ps.length % 2 !== 0) ps.push('BYE');
  const n = ps.length;
  const numTours = n - 1;
  const matchMap = {};
  group.matches.forEach((m, i) => {
    matchMap[m.t1 + '|' + m.t2] = i;
    matchMap[m.t2 + '|' + m.t1] = i;
  });
  const tours = [];
  const rotating = ps.slice(1);
  for (let t = 0; t < numTours; t++) {
    const pairs = [[ps[0], rotating[0]]];
    for (let i = 1; i < n / 2; i++) {
      pairs.push([rotating[i], rotating[n - 1 - i]]);
    }
    const indices = [];
    pairs.forEach(([a, b]) => {
      if (a === 'BYE' || b === 'BYE') return;
      const idx = matchMap[a + '|' + b];
      if (idx !== undefined) indices.push(idx);
    });
    if (indices.length) tours.push(indices);
    rotating.push(rotating.shift());
  }
  return tours;
}

export function computeLeagueTours(group) {
  const ps = group.players.slice();
  if (ps.length % 2 !== 0) ps.push('BYE');
  const n = ps.length;
  const numTours = n - 1;

  const matchMap = {};
  group.matches.forEach((m, i) => {
    const key = m.t1 + '|' + m.t2;
    if (!matchMap[key]) matchMap[key] = [];
    matchMap[key].push(i);
  });
  const used = new Set();

  function pickMatch(a, b) {
    const candidates = matchMap[a + '|' + b] || [];
    const idx = candidates.find(i => !used.has(i));
    if (idx !== undefined) { used.add(idx); return idx; }
    return null;
  }

  const allTours = [];
  const rotating = ps.slice(1);

  for (let t = 0; t < numTours; t++) {
    const indices = [];
    const pairs = [[ps[0], rotating[0]]];
    for (let i = 1; i < n / 2; i++) pairs.push([rotating[i], rotating[n - 1 - i]]);
    pairs.forEach(([a, b]) => {
      if (a === 'BYE' || b === 'BYE') return;
      const idx = pickMatch(a, b); if (idx !== null) indices.push(idx);
    });
    if (indices.length) allTours.push(indices);
    rotating.push(rotating.shift());
  }

  const rotating2 = ps.slice(1);
  for (let t = 0; t < numTours; t++) {
    const indices = [];
    const pairs = [[ps[0], rotating2[0]]];
    for (let i = 1; i < n / 2; i++) pairs.push([rotating2[i], rotating2[n - 1 - i]]);
    pairs.forEach(([a, b]) => {
      if (a === 'BYE' || b === 'BYE') return;
      const idx = pickMatch(b, a); if (idx !== null) indices.push(idx);
    });
    if (indices.length) allTours.push(indices);
    rotating2.push(rotating2.shift());
  }

  return allTours;
}
