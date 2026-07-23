// Турник: лестница на выбывание. Раунд N требует N подтягиваний; кто не
// выполнил норму раунда — выбывает с этим раундом. Ранжирование строится
// заново из `players`/`eliminated` при каждом рендере, ничего не кэшируется.

export function buildLadderRanking(tournament) {
  const players = tournament.players || [];
  const eliminated = tournament.eliminated || {};
  const rows = players.map(name => ({ name, eliminatedRound: eliminated[name] ?? null }));

  rows.sort((a, b) => {
    const aActive = a.eliminatedRound == null;
    const bActive = b.eliminatedRound == null;
    if (aActive && bActive) return a.name.localeCompare(b.name, 'ru');
    if (aActive) return -1;
    if (bActive) return 1;
    return b.eliminatedRound - a.eliminatedRound || a.name.localeCompare(b.name, 'ru');
  });

  let rank = 0;
  let prevKey;
  rows.forEach((row, i) => {
    const key = row.eliminatedRound ?? 'active';
    if (key !== prevKey) rank = i + 1;
    row.rank = rank;
    prevKey = key;
  });

  return rows;
}

export function isLadderComplete(tournament) {
  const players = tournament.players || [];
  const eliminated = tournament.eliminated || {};
  const active = players.filter(p => eliminated[p] == null);
  return active.length <= 1;
}

// winner === null означает одновременный вылет последних участников — ничья
// за 1-е место (видна в таблице через общий rank, а не через баннер победителя).
export function computeLadderResult(tournament) {
  const rows = buildLadderRanking(tournament);
  const winnerRow = rows.find(r => r.eliminatedRound == null);
  return { winner: winnerRow ? winnerRow.name : null };
}
