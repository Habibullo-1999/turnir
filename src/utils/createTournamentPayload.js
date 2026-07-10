import { nextPow2, shuffle, buildRounds, propagateWinners } from './bracket.js';
import { buildGroups, buildLeague } from './groups.js';

// participants: [{ name: string, club: {club,league,flag,icon} | null }]
export function buildTournamentPayload({ name, participants, format }) {
  const names = participants.map(p => p.name.trim()).filter(Boolean);
  if (names.length < 2) {
    throw new Error('Введите минимум 2 участника.');
  }

  const playerMeta = {};
  participants.forEach(p => {
    const trimmed = p.name.trim();
    if (trimmed && p.club) playerMeta[trimmed] = p.club;
  });

  const base = { name: name.trim() || 'Турнир', players: names, playerMeta, format };

  if (format === 'playoff') {
    const size = nextPow2(names.length);
    const seeded = shuffle(names);
    while (seeded.length < size) seeded.push('BYE');
    const { rounds, roundLabels } = buildRounds(seeded);
    propagateWinners(rounds);
    return { ...base, groups: [], rounds, roundLabels };
  }

  const groups = format === 'league' ? buildLeague(names) : buildGroups(names);
  return { ...base, groups, rounds: [], roundLabels: [] };
}
