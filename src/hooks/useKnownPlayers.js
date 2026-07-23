import { useMemo } from 'react';
import { getSportConfig, FOOTBALL } from '../utils/sportConfig.js';

// Derives the "known players" chip list (name + last-seen club meta) from
// finished tournaments of the same sport, so returning players can be added
// to a new tournament with one click instead of retyping their name/club.
// Doubles sports store composite team-ID strings in `players`, not real
// individual names, so they're excluded entirely.
export function useKnownPlayers(history, sport = FOOTBALL) {
  return useMemo(() => {
    const cfg = getSportConfig(sport);
    if (cfg.isDoubles) return [];

    const sameSport = history.filter(entry => (entry.sport || FOOTBALL) === sport);
    const names = new Set();
    sameSport.forEach(entry => (entry.players || []).forEach(p => names.add(p)));

    return [...names].sort().map(name => {
      // history is newest-first (see listHistory()), so the first match here
      // is the player's most recently used club.
      let meta = null;
      for (let i = 0; i < sameSport.length; i++) {
        const entryMeta = sameSport[i].participantMeta || sameSport[i].playerMeta;
        if (entryMeta && entryMeta[name]) {
          meta = entryMeta[name];
          break;
        }
      }
      return { name, meta };
    });
  }, [history, sport]);
}
