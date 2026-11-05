import { buildRounds, nextPow2, propagateWinners, shuffle } from './bracket.js';
import { hasBracketStarted } from './manualRearrange.js';
import { FOOTBALL, FOOTBALL_DOUBLES, getSportConfig } from './sportConfig.js';
import { completeFootballDoublesSchedule } from './footballDoublesSchedule.js';
import { distributeDoublesClubs } from './doublesClubs.js';
import { interleaveAmericanoRounds, orderedAmericanoRounds } from './americano.js';

export function getParticipantAdditionError(tournament) {
  if (tournament.status !== 'active') return 'Сначала верните турнир в работу.';
  if (getSportConfig(tournament.sport).engine === 'americano') return null;
  if ((tournament.sport || FOOTBALL) !== FOOTBALL) return 'Добавление с выбором клуба доступно в футболе.';
  if (tournament.format === 'group+playoff' && tournament.rounds?.length) {
    return 'После выхода из групп в плей-офф добавлять участников нельзя.';
  }
  if (tournament.format === 'playoff' && hasBracketStarted(tournament.rounds)) {
    return 'В плей-офф можно добавить участника только до первого сыгранного матча.';
  }
  return null;
}

export function addParticipant(draft, { name, club = null, groupIndex = 0 }, seed = 0) {
  const unavailable = getParticipantAdditionError(draft);
  if (unavailable) throw new Error(unavailable);

  const player = name.trim();
  if (!player) throw new Error('Введите имя участника.');
  if (player === 'BYE' || Object.hasOwn(Object.prototype, player)) {
    throw new Error('Это имя зарезервировано. Используйте другое имя участника.');
  }
  if (draft.players.includes(player)) throw new Error(`Участник «${player}» уже добавлен.`);

  const cfg = getSportConfig(draft.sport);
  if (cfg.engine === 'americano') {
    // A mutation is replayed against the latest saved version: use the same
    // seed so optimistic and persisted schedules have identical match indices.
    let state = seed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const players = [...draft.players, player];
    const extraRounds = shuffle(draft.players, random).map(partner => {
      const opponents = shuffle(draft.players.filter(name => name !== partner), random).slice(0, 2);
      const match = { pairA: [player, partner], pairB: opponents, score1: null, score2: null, played: false };
      return { matches: [match], byes: players.filter(name => ![...match.pairA, ...match.pairB].includes(name)) };
    });
    const existing = orderedAmericanoRounds(draft).map(({ additionalLeg, ...round }) => ({
      ...round, byes: [...(round.byes || []), player],
    }));
    let rounds = interleaveAmericanoRounds(existing, extraRounds);
    if (draft.format === 'league' && cfg.doubleRoundRobinLeague) {
      const returnRounds = extraRounds.map(round => ({
        ...round,
        byes: [...round.byes],
        matches: round.matches.map(match => ({ ...match, pairA: [...match.pairB], pairB: [...match.pairA] })),
      }));
      const half = existing.length / 2;
      rounds = [
        ...interleaveAmericanoRounds(existing.slice(0, half), extraRounds),
        ...interleaveAmericanoRounds(existing.slice(half), returnRounds),
      ];
    }
    const updated = {
      ...draft,
      players,
      rounds,
    };
    if (draft.sport === FOOTBALL_DOUBLES) {
      completeFootballDoublesSchedule(updated);
    }
    // Reassign unplayed clubs for their new neighbours; played fixtures and
    // their club assignments stay untouched.
    if (draft.clubPool) {
      const clubs = [...draft.clubPool];
      const clubKey = value => value.club.trim().toLocaleLowerCase('ru-RU');
      if (draft.sport === FOOTBALL_DOUBLES && club && !clubs.some(existing => clubKey(existing) === clubKey(club))) {
        clubs.push(club);
      }
      distributeDoublesClubs(updated, clubs, seed);
    }
    draft.rounds = updated.rounds;
    if (updated.clubPool) draft.clubPool = updated.clubPool;
  } else if (draft.format === 'playoff') {
    const seeded = draft.rounds[0].flatMap(match => [match.t1, match.t2]);
    const byeIndex = seeded.indexOf('BYE');
    if (byeIndex >= 0) seeded[byeIndex] = player;
    else seeded.push(player);
    while (seeded.length < nextPow2(seeded.length)) seeded.push('BYE');
    const { rounds, roundLabels } = buildRounds(seeded);
    propagateWinners(rounds);
    draft.rounds = rounds;
    draft.roundLabels = roundLabels;
  } else {
    if (!Number.isInteger(groupIndex) || !draft.groups?.[groupIndex]) {
      throw new Error('Выберите группу для участника.');
    }
    const group = draft.groups[groupIndex];
    const doubleLeague = draft.format === 'league' && getSportConfig(draft.sport).doubleRoundRobinLeague;
    const matches = group.players.flatMap(opponent => {
      const match = { t1: opponent, t2: player, score1: null, score2: null, played: false };
      return doubleLeague
        ? [{ ...match, home: true }, { ...match, t1: player, t2: opponent, home: true }]
        : [match];
    });
    group.tieBreakOrder = [...(group.tieBreakOrder || group.players), player];
    group.players.push(player);
    group.matches.push(...matches);
  }

  draft.players.push(player);
  draft.participantMeta = { ...(draft.participantMeta || draft.playerMeta || {}) };
  if (club && cfg.hasClub) draft.participantMeta[player] = club;
  // A reopened tournament may still contain its previous final summary.
  delete draft.winner;
  delete draft.stats;
  delete draft.finishedAt;
  delete draft.date;
}
