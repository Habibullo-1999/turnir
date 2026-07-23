import { nextPow2, shuffle, buildRounds, propagateWinners } from './bracket.js';
import { buildGroups, buildLeague } from './groups.js';
import { getSportConfig, FOOTBALL, TURNIK } from './sportConfig.js';

function buildDoublesTeamId(a, b) {
  return [a.trim(), b.trim()].sort((x, y) => x.localeCompare(y, 'ru')).join(' & ');
}

// participants shape depends on sport:
//  - одиночки (football / table-tennis-1x1): [{ name, club: {club,league,flag,icon} | null }]
//  - пары (table-tennis-2x2): [{ nameA, nameB }]
export function buildTournamentPayload({ name, participants, format, sport = FOOTBALL }) {
  const cfg = getSportConfig(sport);

  if (cfg.engine === 'turnik-ladder') {
    const names = participants.map(p => p.name.trim()).filter(Boolean);
    if (names.length < 2) {
      throw new Error('Введите минимум 2 участника.');
    }
    return {
      name: name.trim() || 'Турник',
      sport: TURNIK,
      players: names,
      round: 1,
      passed: {},
      eliminated: {},
    };
  }

  let names;
  const participantMeta = {};

  if (cfg.isDoubles) {
    const seen = new Set();
    names = participants.map(p => {
      const a = (p.nameA || '').trim();
      const b = (p.nameB || '').trim();
      if (!a || !b) return null;
      const id = buildDoublesTeamId(a, b);
      if (seen.has(id)) throw new Error(`Команда «${a} и ${b}» уже добавлена дважды.`);
      seen.add(id);
      participantMeta[id] = { members: [a, b] };
      return id;
    }).filter(Boolean);
    if (names.length < 2) {
      throw new Error('Введите минимум 2 команды.');
    }
  } else {
    names = participants.map(p => p.name.trim()).filter(Boolean);
    if (names.length < 2) {
      throw new Error('Введите минимум 2 участника.');
    }
    participants.forEach(p => {
      const trimmed = p.name.trim();
      if (trimmed && p.club && cfg.hasClub) participantMeta[trimmed] = p.club;
    });
  }

  const base = { name: name.trim() || 'Турнир', players: names, participantMeta, format, sport };

  if (format === 'playoff') {
    const size = nextPow2(names.length);
    const seeded = shuffle(names);
    while (seeded.length < size) seeded.push('BYE');
    const { rounds, roundLabels } = buildRounds(seeded);
    propagateWinners(rounds);
    return { ...base, groups: [], rounds, roundLabels };
  }

  const groups = format === 'league' ? buildLeague(names, { double: cfg.doubleRoundRobinLeague }) : buildGroups(names);
  return { ...base, groups, rounds: [], roundLabels: [] };
}
