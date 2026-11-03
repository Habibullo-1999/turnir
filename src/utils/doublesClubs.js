import { shuffle } from './bracket.js';
import { FOOTBALL_DOUBLES } from './sportConfig.js';

const clubKey = club => String(club?.club || '').trim().toLocaleLowerCase('ru-RU');

export function minimumDoublesClubs(playerCount) {
  return Math.max(4, Math.floor(playerCount / 4) * 2 + 2);
}

// Seed передаётся из обработчика: повторное применение мутации при сохранении
// должно дать ту же жеребьёвку, что и оптимистическое обновление интерфейса.
export function distributeDoublesClubs(draft, clubs, seed) {
  if (draft.sport !== FOOTBALL_DOUBLES) throw new Error('Клубы пар доступны только в футболе 2×2.');
  if (draft.status === 'finished') throw new Error('Сначала верните турнир в работу.');
  const minimum = minimumDoublesClubs(draft.players.length);
  if (!clubs || clubs.some(club => !clubKey(club))) throw new Error('Выберите клуб в каждом поле.');
  if (new Set(clubs.map(clubKey)).size !== clubs.length) throw new Error('Клубы в наборе не должны повторяться.');
  if (clubs.length < minimum) throw new Error(`Для смены клубов выберите минимум ${minimum} разных клубов.`);

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
