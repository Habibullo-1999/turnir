import { propagateWinners } from './bracket.js';

// Manual rearrangement is only offered before anyone has actually played —
// once a real result exists, swapping people around would silently corrupt
// standings/bracket history, so callers must gate the UI on these checks.

export function hasBracketStarted(rounds) {
  return (rounds || []).some(round => round.some(m => m.score1 !== undefined && m.score1 !== null));
}

export function hasGroupsStarted(groups) {
  return (groups || []).some(g => g.matches.some(m => m.played));
}

// Flattens round 0 into swappable slots, skipping BYE (nothing meaningful to
// swap a bye with) — used to populate the two pickers in the UI.
export function getBracketSlots(rounds) {
  const slots = [];
  if (!rounds || !rounds.length) return slots;
  rounds[0].forEach((match, matchIdx) => {
    [1, 2].forEach(side => {
      const name = side === 1 ? match.t1 : match.t2;
      if (name && name !== 'BYE') slots.push({ matchIdx, side, name });
    });
  });
  return slots;
}

// Swaps the two named players' positions in round 0, then rebuilds winners
// for any bye matches affected and re-propagates downstream rounds.
export function swapBracketSlots(draft, nameA, nameB) {
  const round0 = draft.rounds[0];
  let posA = null, posB = null;
  round0.forEach((match, matchIdx) => {
    if (match.t1 === nameA) posA = { matchIdx, side: 1 };
    if (match.t2 === nameA) posA = { matchIdx, side: 2 };
    if (match.t1 === nameB) posB = { matchIdx, side: 1 };
    if (match.t2 === nameB) posB = { matchIdx, side: 2 };
  });
  if (!posA || !posB) return;

  const setSlot = (pos, name) => {
    const match = round0[pos.matchIdx];
    if (pos.side === 1) match.t1 = name; else match.t2 = name;
  };
  setSlot(posA, nameB);
  setSlot(posB, nameA);

  // Recompute round-0 winners (bye auto-advances) now that occupants moved.
  round0.forEach(match => {
    if (match.t1 === 'BYE' && match.t2 === 'BYE') { match.winner = null; return; }
    if (match.t2 === 'BYE') { match.winner = match.t1; return; }
    if (match.t1 === 'BYE') { match.winner = match.t2; return; }
    match.winner = null;
    match.score1 = null;
    match.score2 = null;
  });

  // Reset downstream rounds (nothing has been played yet, so they only ever
  // held auto-advanced byes) before re-propagating from the fixed round 0.
  for (let r = 1; r < draft.rounds.length; r++) {
    draft.rounds[r].forEach(match => {
      match.t1 = null; match.t2 = null; match.winner = null;
      match.score1 = null; match.score2 = null;
      match.t1Lucky = false; match.t2Lucky = false;
    });
  }
  propagateWinners(draft.rounds);
}

// Moves a player from one group to another (group / group+playoff only —
// league has a single flat pool, so there's nothing to move between).
// Rebuilds the fixture list for both affected groups.
export function movePlayerToGroup(draft, playerName, targetGroupIdx) {
  const sourceGroupIdx = draft.groups.findIndex(g => g.players.includes(playerName));
  if (sourceGroupIdx === -1 || sourceGroupIdx === targetGroupIdx) return;

  const source = draft.groups[sourceGroupIdx];
  const target = draft.groups[targetGroupIdx];

  source.players = source.players.filter(p => p !== playerName);
  source.matches = source.matches.filter(m => m.t1 !== playerName && m.t2 !== playerName);

  target.players.forEach(existing => {
    target.matches.push({ t1: existing, t2: playerName, score1: null, score2: null, played: false });
  });
  target.players.push(playerName);
}
