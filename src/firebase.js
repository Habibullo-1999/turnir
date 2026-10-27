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

// GET that also returns the node's ETag, for a later conditional write.
export async function fbGetWithEtag(path) {
  const res = await fetch(FIREBASE_URL + path + '.json', { headers: { 'X-Firebase-ETag': 'true' } });
  if (!res.ok) {
    throw new Error(`Firebase GET ${path} failed: ${res.status}`);
  }
  return { data: await res.json(), etag: res.headers.get('ETag') };
}

// PUT that only succeeds if the node still has `etag` (i.e. nobody else has
// written it since we read it). On a mismatch Firebase answers 412 with the
// current value and its ETag, which is returned as `{ conflict: true }` so
// the caller can re-apply its change on top of the fresh data.
export async function fbPutIfMatch(path, data, etag) {
  const res = await fetch(FIREBASE_URL + path + '.json', {
    method: 'PUT',
    headers: { 'X-Firebase-ETag': 'true', 'if-match': etag },
    body: JSON.stringify(data),
  });
  if (res.status === 412) {
    return { conflict: true, data: await res.json(), etag: res.headers.get('ETag') };
  }
  if (!res.ok) {
    throw new Error(`Firebase PUT ${path} failed: ${res.status}`);
  }
  return { conflict: false, data: await res.json(), etag: res.headers.get('ETag') };
}
