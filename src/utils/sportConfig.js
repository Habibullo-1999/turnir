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
    engine: 'americano',
    hasClub: false,
    hasPenalty: false,
    hasDraws: false,
    unitNoun: 'участников',
    diffLabel: 'Очки',
  },
  [TURNIK]: {
    sport: TURNIK,
    label: 'Турник',
    icon: '🔝',
    engine: 'turnik-ladder',
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
