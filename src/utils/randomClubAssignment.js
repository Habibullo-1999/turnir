function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('ru-RU');
}

function shuffle(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getLastClubsByPlayer(history, sport, defaultSport) {
  const lastClubs = new Map();

  history
    .filter(entry => (entry.sport || defaultSport) === sport)
    .forEach(entry => {
      const meta = entry.participantMeta || entry.playerMeta || {};
      (entry.players || []).forEach(player => {
        const playerKey = normalize(player);
        if (lastClubs.has(playerKey)) return;

        const metaKey = Object.keys(meta).find(key => normalize(key) === playerKey);
        lastClubs.set(playerKey, normalize(metaKey ? meta[metaKey]?.club : ''));
      });
    });

  return lastClubs;
}

export function assignRandomClubs(participantRows, clubs, lastClubsByPlayer) {
  const rowOrder = shuffle(participantRows);
  const availableClubIndexes = clubs.map((_, index) => index);
  const assignments = new Map();

  function assign(rowIndex) {
    if (rowIndex === rowOrder.length) return true;

    const row = rowOrder[rowIndex];
    const previousClub = lastClubsByPlayer.get(normalize(row.name));
    const candidates = shuffle(availableClubIndexes).filter(index => (
      !previousClub || normalize(clubs[index]?.club) !== previousClub
    ));

    for (const clubIndex of candidates) {
      assignments.set(row.id, { ...clubs[clubIndex] });
      availableClubIndexes.splice(availableClubIndexes.indexOf(clubIndex), 1);
      if (assign(rowIndex + 1)) return assignments;
      availableClubIndexes.push(clubIndex);
      assignments.delete(row.id);
    }

    return null;
  }

  return assign(0);
}
