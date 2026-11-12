import { fbGet } from '../firebase.js';

// Скрытые параметры игроков: /playerProfiles/{имя} = { stamina: 1..10 }.
// В интерфейсе не показываются и вручную правятся в базе; нужны только для
// деления реального футбола на равные команды. Если путь недоступен или
// пуст, деление идёт по одной истории матчей.
export async function getPlayerProfiles() {
  try {
    return (await fbGet('/playerProfiles')) || {};
  } catch {
    return {};
  }
}

export function staminaMap(profiles) {
  return Object.fromEntries(Object.entries(profiles || {})
    .map(([name, profile]) => [name, Number(profile?.stamina)])
    .filter(([, stamina]) => Number.isFinite(stamina) && stamina > 0));
}
