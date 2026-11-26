import { fbGet, fbPatch } from '../firebase.js';

const PROFILES_PATH = '/playerProfiles';
export const MAX_STAMINA = 10;

export async function getPlayerProfiles() {
  return (await fbGet(PROFILES_PATH)) || {};
}

export function savePlayerStamina(changes) {
  const updates = {};
  for (const [name, score] of Object.entries(changes)) {
    if (!name || /[.#$\[\]/\u0000-\u001f\u007f]/.test(name) || new TextEncoder().encode(name).length > 768) {
      throw new Error(`Имя «${name}» нельзя сохранить в профиле игрока.`);
    }
    if (score !== null && (!Number.isInteger(score) || score < 1 || score > MAX_STAMINA)) {
      throw new Error(`Выберите целый балл от 1 до ${MAX_STAMINA}.`);
    }
    updates[`${name}/stamina`] = score;
  }
  return fbPatch(PROFILES_PATH, updates).catch(error => {
    throw new Error('Не удалось сохранить оценки. Попробуйте ещё раз.', { cause: error });
  });
}

export function staminaMap(profiles) {
  return Object.fromEntries(Object.entries(profiles || {})
    .map(([name, profile]) => [name, Number(profile?.stamina)])
    .filter(([, stamina]) => Number.isFinite(stamina) && stamina > 0));
}
