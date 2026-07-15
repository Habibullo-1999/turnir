import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createTournament as createTournamentApi, getTournament, saveTournament } from '../services/tournaments.js';

const TournamentContext = createContext(null);

export function TournamentProvider({ children }) {
  const [tournament, setTournament] = useState(null);
  const [openError, setOpenError] = useState(null);
  const [opening, setOpening] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null);

  // Persist on every change. Effect-driven (not a side effect inside
  // setState) so it always sees the real, awaited result and never races
  // with itself — the per-id write lock in services/tournaments.js also
  // guarantees ordering even if this fires twice in a row.
  useEffect(() => {
    if (!tournament) return;
    let cancelled = false;
    setSaveStatus('saving');
    saveTournament(tournament)
      .then(() => { if (!cancelled) { setSaveStatus('saved'); setSaveError(null); } })
      .catch(err => { if (!cancelled) { setSaveStatus('error'); setSaveError(err.message); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament]);

  // Keeps `?tid=` in the URL pointed at the open tournament so a page
  // refresh can reopen the same one (see the mount effect below). Only ever
  // *sets* it reactively — clearing it is done explicitly by whoever closes
  // the tournament, otherwise this would race the mount effect's own
  // "open the id already in the URL" read and erase it before that runs.
  useEffect(() => {
    if (!tournament) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('tid') !== tournament.id) {
      url.searchParams.set('tid', tournament.id);
      window.history.replaceState(null, '', url);
    }
  }, [tournament]);

  const clearTidParam = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('tid')) {
      url.searchParams.delete('tid');
      window.history.replaceState(null, '', url);
    }
  };

  // On first mount, reopen whatever tournament id is in the URL (set by the
  // effect above on a previous visit), so a refresh restores the same view.
  useEffect(() => {
    const tid = new URLSearchParams(window.location.search).get('tid');
    if (tid) openTournament(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTournament = useCallback(async (payload) => {
    const created = await createTournamentApi(payload);
    setTournament(created);
    return created;
  }, []);

  // Opens an existing tournament by id. On failure this NEVER falls back to
  // "no tournament" silently — the caller gets an explicit error it must
  // show, so a transient network hiccup can never be mistaken for "start a
  // fresh one" (that mistake is what used to overwrite real data).
  const openTournament = useCallback(async (id) => {
    setOpening(true);
    setOpenError(null);
    try {
      const found = await getTournament(id);
      if (!found) {
        setOpenError('Турнир не найден.');
        setTournament(null);
        clearTidParam();
      } else {
        setTournament(found);
      }
    } catch (err) {
      setOpenError(`Не удалось загрузить турнир: ${err.message}`);
      setTournament(null);
      clearTidParam();
    } finally {
      setOpening(false);
    }
  }, []);

  // Applies a pure mutation to a deep copy of the current tournament and
  // commits it as the new current tournament (triggers the persistence
  // effect above).
  const mutate = useCallback((mutator) => {
    setTournament(prev => {
      if (!prev) return prev;
      const draft = structuredClone(prev);
      mutator(draft);
      return draft;
    });
  }, []);

  const closeTournament = useCallback(() => {
    setTournament(null);
    setOpenError(null);
    clearTidParam();
  }, []);

  const value = {
    tournament,
    opening,
    openError,
    saveStatus,
    saveError,
    startTournament,
    openTournament,
    mutate,
    closeTournament,
  };

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
}
