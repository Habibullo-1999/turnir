#!/usr/bin/env node
// One-time migration: reads the old /state (single active tournament),
// /saves/{id} (paused tournaments) and /history/{id} (finished tournaments)
// paths and writes them into the new unified /tournaments/{id} structure
// with an explicit status field. Old paths are left untouched — delete them
// yourself in the Firebase console once you've verified the migration.
//
// Usage: npm run migrate:firebase

import readline from 'node:readline/promises';

const FIREBASE_URL = 'https://turnir-2be75-default-rtdb.asia-southeast1.firebasedatabase.app';

async function fbGet(path) {
  const res = await fetch(`${FIREBASE_URL}${path}.json`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function fbPut(path, data) {
  const res = await fetch(`${FIREBASE_URL}${path}.json`, { method: 'PUT', body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

function toTournament(entry, status) {
  const id = String(entry.id ?? Date.now());
  return { ...entry, id, status };
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `This will read data from ${FIREBASE_URL} and write new records under /tournaments.\n` +
    'It will NOT delete /state, /saves or /history. Continue? (yes/no) '
  );
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Aborted.');
    return;
  }

  let migrated = 0;

  const active = await fbGet('/state');
  if (active && active.players) {
    const t = toTournament(active, 'active');
    await fbPut(`/tournaments/${t.id}`, t);
    console.log(`Migrated active tournament "${t.name}" (${t.id})`);
    migrated++;
  }

  const saves = await fbGet('/saves');
  for (const entry of Object.values(saves || {})) {
    const t = toTournament(entry, 'active');
    await fbPut(`/tournaments/${t.id}`, t);
    console.log(`Migrated paused tournament "${t.name}" (${t.id})`);
    migrated++;
  }

  const history = await fbGet('/history');
  for (const entry of Object.values(history || {})) {
    const t = toTournament(entry, 'finished');
    await fbPut(`/tournaments/${t.id}`, t);
    console.log(`Migrated finished tournament "${t.name}" (${t.id})`);
    migrated++;
  }

  console.log(`Done. Migrated ${migrated} tournament(s) into /tournaments.`);
  console.log('Verify in the app, then remove /state, /saves and /history manually in the Firebase console.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
