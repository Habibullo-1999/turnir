import { nextPow2, shuffle, buildRounds, propagateWinners } from './bracket.js';
import { buildGroups, buildLeague } from './groups.js';
import { buildAmericanoRounds } from './americano.js';
import { getSportConfig, FOOTBALL, TURNIK } from './sportConfig.js';
import { MIN_TEAM_LOG_PLAYERS, buildTeams } from './teamMatchLog.js';

// participants: [{ name: string, club: {club,league,flag,icon} | null }]
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

  // «Реальный футбол» — один настоящий матч для статистики. Сетки нет: те, кто
  // пришёл, сразу делятся на две команды, а дальше в записи ведутся счёт и
  // авторы голов.
  if (cfg.engine === 'team-match-log') {
    const names = participants.map(p => p.name.trim()).filter(Boolean);
    if (names.length < MIN_TEAM_LOG_PLAYERS) {
      throw new Error(`Введите минимум ${MIN_TEAM_LOG_PLAYERS} игроков.`);
    }
    // Вся статистика этого режима заведена на имя игрока (состав, авторы
    // голов), поэтому тёзки здесь ломали бы её молча — проверяем сразу.
    const duplicate = names.find((n, i) => names.indexOf(n) !== i);
    if (duplicate) {
      throw new Error(`Игрок «${duplicate}» указан дважды — имена должны быть уникальными.`);
    }
    return {
      name: name.trim() || 'Матч',
      sport,
      players: names,
      playedAt: Date.now(),
      scores: [0, 0],
      teams: buildTeams(names),
    };
  }

  if (cfg.engine === 'americano') {
    const names = participants.map(p => p.name.trim()).filter(Boolean);
    if (names.length < 3) {
      throw new Error('Введите минимум 3 участника.');
    }
    return {
      name: name.trim() || 'Турнир',
      sport,
      players: names,
      rounds: buildAmericanoRounds(names),
    };
  }

  const names = participants.map(p => p.name.trim()).filter(Boolean);
  if (names.length < 2) {
    throw new Error('Введите минимум 2 участника.');
  }

  const participantMeta = {};
  participants.forEach(p => {
    const trimmed = p.name.trim();
    if (trimmed && p.club && cfg.hasClub) participantMeta[trimmed] = p.club;
  });

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
