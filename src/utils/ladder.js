// Турник: лестница на выбывание. Раунд N требует N подтягиваний; кто не
// выполнил норму раунда — выбывает с этим раундом, и организатор вводит
// реальное количество подтягиваний, которое участник успел сделать (для
// подсчёта общего числа подтягиваний и как tie-break при равном раунде
// выбывания). Ранжирование строится заново из `players`/`eliminated` при
// каждом рендере, ничего не кэшируется.

function sumTo(n) {
  return (n * (n + 1)) / 2;
}

export function buildLadderRanking(tournament) {
  const players = tournament.players || [];
  const eliminated = tournament.eliminated || {};
  const passed = tournament.passed || {};
  const round = tournament.round || 1;

  const rows = players.map(name => {
    const elim = eliminated[name];
    if (elim != null) {
      // Старые турниры хранили `eliminated[name]` как просто номер раунда
      // (без количества подтягиваний) — читаем оба варианта.
      const elimRound = typeof elim === 'object' ? elim.round : elim;
      const elimReps = typeof elim === 'object' ? elim.reps : null;
      return {
        name,
        eliminatedRound: elimRound,
        reps: elimReps,
        totalReps: sumTo(elimRound - 1) + (elimReps || 0),
      };
    }
    const completedThrough = passed[name] ? round : round - 1;
    return { name, eliminatedRound: null, reps: null, totalReps: sumTo(Math.max(completedThrough, 0)) };
  });

  rows.sort((a, b) => {
    const aActive = a.eliminatedRound == null;
    const bActive = b.eliminatedRound == null;
    if (aActive && bActive) return a.name.localeCompare(b.name, 'ru');
    if (aActive) return -1;
    if (bActive) return 1;
    return b.eliminatedRound - a.eliminatedRound || b.reps - a.reps || a.name.localeCompare(b.name, 'ru');
  });

  let rank = 0;
  let prevKey;
  rows.forEach((row, i) => {
    const key = row.eliminatedRound == null ? 'active' : `${row.eliminatedRound}:${row.reps}`;
    if (key !== prevKey) rank = i + 1;
    row.rank = rank;
    prevKey = key;
  });

  return rows;
}

// Турнир завершён, когда активных (не выбывших) участников не осталось
// вовсе (одновременный вылет последних — ничья за 1-е место), либо остался
// ровно один — но только если этот последний уже сам подтвердил выполнение
// текущего раунда. Без этого условия он становился бы чемпионом автоматически
// в момент выбывания предпоследнего соперника, ни разу не подтянувшись сам.
export function isLadderComplete(tournament) {
  const players = tournament.players || [];
  const eliminated = tournament.eliminated || {};
  const passed = tournament.passed || {};
  const active = players.filter(p => eliminated[p] == null);
  if (active.length === 0) return true;
  if (active.length === 1) return Boolean(passed[active[0]]);
  return false;
}

// winner === null означает одновременный вылет последних участников — ничья
// за 1-е место (видна в таблице через общий rank, а не через баннер победителя).
export function computeLadderResult(tournament) {
  const rows = buildLadderRanking(tournament);
  const winnerRow = rows.find(r => r.eliminatedRound == null);
  return { winner: winnerRow ? winnerRow.name : null };
}
