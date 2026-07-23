export const FOOTBALL = 'football';
export const TT_SINGLES = 'table-tennis-1x1';
export const TT_DOUBLES = 'table-tennis-2x2';
export const TURNIK = 'turnik';

export const SPORT_CONFIG = {
  [FOOTBALL]: {
    sport: FOOTBALL,
    label: 'Футбол',
    icon: '⚽',
    engine: 'bracket-group',
    isDoubles: false,
    hasClub: true,
    hasPenalty: true,
    hasDraws: true,
    unitNoun: 'участников',
    diffLabel: 'Голы',
    diffGenitive: 'голов',
    doubleRoundRobinLeague: true,
  },
  [TT_SINGLES]: {
    sport: TT_SINGLES,
    label: 'Наст. теннис 1×1',
    icon: '🏓',
    engine: 'bracket-group',
    isDoubles: false,
    hasClub: false,
    hasPenalty: false,
    hasDraws: false,
    unitNoun: 'участников',
    diffLabel: 'Сеты',
    diffGenitive: 'сетов',
    doubleRoundRobinLeague: false,
  },
  [TT_DOUBLES]: {
    sport: TT_DOUBLES,
    label: 'Наст. теннис 2×2',
    icon: '🏓👥',
    engine: 'bracket-group',
    isDoubles: true,
    hasClub: false,
    hasPenalty: false,
    hasDraws: false,
    unitNoun: 'команд',
    diffLabel: 'Сеты',
    diffGenitive: 'сетов',
    doubleRoundRobinLeague: false,
  },
  [TURNIK]: {
    sport: TURNIK,
    label: 'Турник',
    icon: '🔝',
    engine: 'turnik-ladder',
    isDoubles: false,
    hasClub: false,
    hasPenalty: false,
    hasDraws: false,
    unitNoun: 'участников',
  },
};

// Старые турниры без поля `sport` (созданы до этой фичи) читаются как футбол.
export function getSportConfig(sport) {
  return SPORT_CONFIG[sport] || SPORT_CONFIG[FOOTBALL];
}

// Для пар 2×2 `name` — это техническый составной ID команды («Иван & Петр»),
// не то, что должно показываться пользователю — резолвим через participantMeta.
export function displayParticipantName(tournament, name) {
  if (!name) return name;
  const cfg = getSportConfig(tournament.sport);
  const meta = (tournament.participantMeta || tournament.playerMeta || {})[name];
  if (cfg.isDoubles && meta && meta.members) return meta.members.join(' / ');
  return name;
}
