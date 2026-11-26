import { computePlayerRatings, ratingMatches } from '../utils/teamBalance.js';
import { getPlayerProfiles, staminaMap } from './playerProfiles.js';
import { listAll } from './tournaments.js';

export async function loadTeamBalanceData(excludeId) {
  const [tournaments, profiles] = await Promise.all([listAll(), getPlayerProfiles().catch(() => ({}))]);
  const matches = ratingMatches(tournaments, excludeId);
  return {
    tournaments,
    ratings: computePlayerRatings(matches),
    stamina: staminaMap(profiles),
    matchCount: matches.length,
  };
}
