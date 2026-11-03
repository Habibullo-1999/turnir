import { computeAmericanoResult } from './americano.js';
import { FOOTBALL_DOUBLES } from './sportConfig.js';

// Старые записи 2×2 могли сохранить личного чемпиона. Матчи — источник истины.
export function getTournamentWinner(tournament) {
  if (tournament.sport === FOOTBALL_DOUBLES && tournament.rounds?.length) {
    return computeAmericanoResult(tournament).winner;
  }
  return tournament.winner;
}
