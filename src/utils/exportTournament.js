export function downloadTournamentJson(tournament) {
  const blob = new Blob([JSON.stringify(tournament, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (tournament.name || 'tournament').replace(/[^a-zа-яё0-9]/gi, '_');
  const date = tournament.date || new Date().toLocaleDateString('ru');
  a.href = url;
  a.download = `${safeName}_${date.replace(/\./g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
