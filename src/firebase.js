// Thin fetch wrapper around the Firebase Realtime Database REST API.
// Every call is awaited and throws on failure — callers must handle errors
// explicitly instead of silently treating a failed request as "no data".
export const FIREBASE_URL = 'https://turnir-2be75-default-rtdb.asia-southeast1.firebasedatabase.app';

async function request(path, options) {
  const res = await fetch(FIREBASE_URL + path + '.json', options);
  if (!res.ok) {
    throw new Error(`Firebase ${options?.method || 'GET'} ${path} failed: ${res.status}`);
  }
  return res.json();
}

export function fbGet(path) {
  return request(path);
}

export function fbPut(path, data) {
  return request(path, { method: 'PUT', body: JSON.stringify(data) });
}

export function fbPatch(path, data) {
  return request(path, { method: 'PATCH', body: JSON.stringify(data) });
}

export function fbDelete(path) {
  return request(path, { method: 'DELETE' });
}
