import { useMemo } from 'react';

// Derives the "known players" chip list (name + last-seen club meta) from
// finished tournaments, so returning players can be added to a new
// tournament with one click instead of retyping their name/club.
export function useKnownPlayers(history) {
  return useMemo(() => {
    const names = new Set();
    history.forEach(entry => (entry.players || []).forEach(p => names.add(p)));

    return [...names].sort().map(name => {
      // history is newest-first (see listHistory()), so the first match here
      // is the player's most recently used club.
      let meta = null;
      for (let i = 0; i < history.length; i++) {
        if (history[i].playerMeta && history[i].playerMeta[name]) {
          meta = history[i].playerMeta[name];
          break;
        }
      }
      return { name, meta };
    });
  }, [history]);
}
