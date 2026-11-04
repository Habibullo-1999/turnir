import { shuffle } from './bracket.js';
import { FOOTBALL_DOUBLES } from './sportConfig.js';
import { americanoReturnPairs, orderedAmericanoRounds } from './americano.js';

const clubKey = club => String(club?.club || '').trim().toLocaleLowerCase('ru-RU');

function copyReversedClubs(source, target) {
  for (const [from, to] of [['clubA', 'clubB'], ['clubB', 'clubA']]) {
    if (source[from]) target[to] = { ...source[from] };
    else delete target[to];
  }
}

export function minimumDoublesClubs(playerCount, rounds) {
  return rounds
    ? Math.max(4, ...rounds.map(round => round.matches.length * 2 + 2))
    : Math.max(4, Math.floor(playerCount / 4) * 2 + 2);
}

// Repair unplayed legacy rematches without changing recorded match history.
export function synchronizeDoublesReturnClubs(draft) {
  if (draft.sport !== FOOTBALL_DOUBLES || draft.format !== 'league') return;
  for (const { first, second } of americanoReturnPairs(draft)) {
    if (first.played && second.played) continue;
    const source = second.played ? second : first;
    const target = second.played ? first : second;
    copyReversedClubs(source, target);
  }
}

// Seed передаётся из обработчика: повторное применение мутации при сохранении
// должно дать ту же жеребьёвку, что и оптимистическое обновление интерфейса.
export function distributeDoublesClubs(draft, clubs, seed) {
  if (draft.sport !== FOOTBALL_DOUBLES) throw new Error('Клубы пар доступны только в футболе 2×2.');
  if (draft.status === 'finished') throw new Error('Сначала верните турнир в работу.');
  // Additional fixtures can be appended one at a time; the pool depends on
  // simultaneous teams in the actual schedule, not just the roster size.
  const minimum = minimumDoublesClubs(draft.players.length, draft.rounds || []);
  if (!clubs || clubs.some(club => !clubKey(club))) throw new Error('Выберите клуб в каждом поле.');
  if (new Set(clubs.map(clubKey)).size !== clubs.length) throw new Error('Клубы в наборе не должны повторяться.');
  if (clubs.length < minimum) throw new Error(`Для смены клубов выберите минимум ${minimum} разных клубов.`);

  if (draft.format === 'league') {
    const updated = structuredClone(draft);
    const pairs = americanoReturnPairs(updated);
    const rounds = orderedAmericanoRounds(updated);
    const firstLeg = { ...updated, format: undefined, rounds: rounds.slice(0, rounds.length / 2) };
    const frozen = [];
    for (const { first, second } of pairs) {
      if (!second.played) continue;
      if (first.played) {
        if (clubKey(first.clubA) !== clubKey(second.clubB) || clubKey(first.clubB) !== clubKey(second.clubA)) {
          throw new Error('Клубы в сыгранных прямом и ответном матчах различаются. Сначала исправьте эти встречи.');
        }
      } else {
        frozen.push({ first, played: first.played });
        first.played = true;
        copyReversedClubs(second, first);
      }
    }
    distributeDoublesClubs(firstLeg, clubs, seed);
    const assigned = firstLeg.rounds.flatMap(round => round.matches);
    pairs.forEach(({ first, second }, index) => {
      for (const field of ['clubA', 'clubB']) {
        if (assigned[index][field]) first[field] = { ...assigned[index][field] };
        else delete first[field];
      }
      if (!second.played) {
        copyReversedClubs(first, second);
      }
    });
    frozen.forEach(({ first, played }) => { first.played = played; });
    draft.rounds = updated.rounds;
    draft.clubPool = clubs.map(club => ({ ...club }));
    return;
  }

  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const rounds = structuredClone(draft.rounds || []);
  const lastClub = new Map();
  const nextFixed = new Map();
  const futureClubs = [];
  // Если счёт вводили не по порядку, сохраняем клубы сыгранных матчей
  // и не назначаем их тем же игрокам в соседней несыгранной встрече.
  for (let index = rounds.length - 1; index >= 0; index--) {
    futureClubs[index] = new Map(nextFixed);
    rounds[index].matches.filter(match => match.played).forEach(match => {
      [['pairA', 'clubA'], ['pairB', 'clubB']].forEach(([pair, field]) => {
        match[pair].forEach(player => nextFixed.set(player, clubKey(match[field])));
      });
    });
  }

  rounds.forEach((round, index) => {
    const used = new Set();
    const slots = [];
    round.matches.forEach(match => {
      [['pairA', 'clubA'], ['pairB', 'clubB']].forEach(([pair, field]) => {
        if (match.played) {
          const key = clubKey(match[field]);
          if (key) used.add(key);
          match[pair].forEach(player => lastClub.set(player, key));
        } else {
          const blocked = new Set(match[pair].flatMap(player => [lastClub.get(player), futureClubs[index].get(player)]).filter(Boolean));
          slots.push({ match, pair, field, candidates: shuffle(clubs, random).filter(club => !blocked.has(clubKey(club))) });
        }
      });
    });
    slots.sort((a, b) => a.candidates.length - b.candidates.length);
    function assign(slotIndex) {
      if (slotIndex === slots.length) return true;
      const slot = slots[slotIndex];
      for (const club of slot.candidates) {
        const key = clubKey(club);
        if (used.has(key)) continue;
        used.add(key);
        slot.match[slot.field] = { ...club };
        if (assign(slotIndex + 1)) return true;
        used.delete(key);
      }
      return false;
    }
    if (!assign(0)) throw new Error('Не удалось сменить клубы без повторов. Добавьте клубы в набор.');
    slots.forEach(({ match, pair, field }) => match[pair].forEach(player => lastClub.set(player, clubKey(match[field]))));
  });
  draft.rounds = rounds;
  draft.clubPool = clubs.map(club => ({ ...club }));
}
