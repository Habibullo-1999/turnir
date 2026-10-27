import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createTournament as createTournamentApi, getTournament, updateTournament } from '../services/tournaments.js';

const TournamentContext = createContext(null);

export function TournamentProvider({ children }) {
  const [tournament, setTournament] = useState(null);
  const [openError, setOpenError] = useState(null);
  // Starts true (synchronously, before any effect runs) whenever the URL
  // already has a `tid` to restore — otherwise TournamentRoute's very first
  // render sees `opening: false, tournament: null` and redirects home before
  // the mount effect below even gets a chance to start reopening it.
  const [opening, setOpening] = useState(() => Boolean(new URLSearchParams(window.location.search).get('tid')));
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null);

  // Mirrors `tournament` synchronously so back-to-back mutations each build
  // on the previous one, and counts saves still in flight so the server's
  // answer only replaces the optimistic state once nothing newer is pending.
  const currentRef = useRef(null);
  const pendingRef = useRef(0);
  const sessionRef = useRef(0);
  const commit = (t) => {
    currentRef.current = t;
    pendingRef.current = 0;
    sessionRef.current += 1;
    setTournament(t);
  };

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
    commit(created);
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
        commit(null);
        clearTidParam();
      } else {
        commit(found);
        setSaveStatus('idle');
        setSaveError(null);
      }
    } catch (err) {
      setOpenError(`Не удалось загрузить турнир: ${err.message}`);
      commit(null);
      clearTidParam();
    } finally {
      setOpening(false);
    }
  }, []);

  // Applies a pure mutation to a deep copy of the current tournament and
  // shows it immediately, then saves it via updateTournament, which re-applies
  // the same mutation on top of the latest server version if someone else
  // changed the tournament meanwhile. A mutator that throws does so
  // synchronously here, before anything is shown or saved.
  const mutate = useCallback((mutator) => {
    const current = currentRef.current;
    if (!current) return;
    const draft = structuredClone(current);
    mutator(draft);
    currentRef.current = draft;
    setTournament(draft);

    const session = sessionRef.current;
    pendingRef.current += 1;
    setSaveStatus('saving');
    updateTournament(current.id, mutator)
      .then(saved => {
        if (sessionRef.current !== session) return;
        pendingRef.current -= 1;
        setSaveError(null);
        if (pendingRef.current === 0) {
          currentRef.current = saved;
          setTournament(saved);
          setSaveStatus('saved');
        }
      })
      .catch(err => {
        if (sessionRef.current !== session) return;
        pendingRef.current -= 1;
        setSaveStatus('error');
        setSaveError(err.message);
      });
  }, []);

  const closeTournament = useCallback(() => {
    commit(null);
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
