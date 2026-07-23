import React, { useState } from 'react';
import { TournamentProvider, useTournament } from './context/TournamentContext.jsx';
import Header from './components/Header.jsx';
import LoadingOverlay from './components/LoadingOverlay.jsx';
import SportSelectScreen from './components/home/SportSelectScreen.jsx';
import TournamentSetupForm from './components/home/TournamentSetupForm.jsx';
import ActiveTournamentsList from './components/home/ActiveTournamentsList.jsx';
import TournamentPage from './components/tournament/TournamentPage.jsx';
import HistoryList from './components/history/HistoryList.jsx';
import ViewOnlyPage from './components/viewonly/ViewOnlyPage.jsx';

const viewId = new URLSearchParams(window.location.search).get('view');
const noop = () => {};

function MainApp() {
  const [page, setPage] = useState('turnir');
  const [selectedSport, setSelectedSport] = useState(null);
  const { tournament, opening, openError, closeTournament } = useTournament();

  function goHome() {
    closeTournament();
    setSelectedSport(null);
    setPage('turnir');
  }

  return (
    <>
      <Header page={page} onChangePage={setPage} onHome={goHome} />
      <div className="container">
        {page === 'turnir' && (
          <>
            <LoadingOverlay text={opening ? 'Загрузка турнира…' : null} />
            {openError && <div className="card" style={{ color: 'var(--red)' }}>⚠️ {openError}</div>}
            {tournament ? (
              <TournamentPage onHome={() => setPage('turnir')} />
            ) : !selectedSport ? (
              <SportSelectScreen onSelect={setSelectedSport} />
            ) : (
              <>
                <button
                  className="pause-btn"
                  style={{ marginBottom: 14 }}
                  onClick={() => setSelectedSport(null)}
                >
                  ← Сменить вид спорта
                </button>
                <TournamentSetupForm sport={selectedSport} onCreated={noop} />
                <ActiveTournamentsList sport={selectedSport} onOpen={noop} />
              </>
            )}
          </>
        )}
        {page === 'history' && <HistoryList />}
      </div>
    </>
  );
}

export default function App() {
  if (viewId) return <ViewOnlyPage id={viewId} />;
  return (
    <TournamentProvider>
      <MainApp />
    </TournamentProvider>
  );
}
