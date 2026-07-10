import React, { useState } from 'react';
import { TournamentProvider, useTournament } from './context/TournamentContext.jsx';
import Header from './components/Header.jsx';
import LoadingOverlay from './components/LoadingOverlay.jsx';
import TournamentSetupForm from './components/home/TournamentSetupForm.jsx';
import ActiveTournamentsList from './components/home/ActiveTournamentsList.jsx';
import TournamentPage from './components/tournament/TournamentPage.jsx';
import HistoryList from './components/history/HistoryList.jsx';
import ViewOnlyPage from './components/viewonly/ViewOnlyPage.jsx';

const viewId = new URLSearchParams(window.location.search).get('view');
const noop = () => {};

function MainApp() {
  const [page, setPage] = useState('turnir');
  const { tournament, opening, openError } = useTournament();

  return (
    <>
      <Header page={page} onChangePage={setPage} />
      <div className="container">
        {page === 'turnir' && (
          <>
            <LoadingOverlay text={opening ? 'Загрузка турнира…' : null} />
            {openError && <div className="card" style={{ color: 'var(--red)' }}>⚠️ {openError}</div>}
            {tournament ? (
              <TournamentPage onHome={() => setPage('turnir')} />
            ) : (
              <>
                <TournamentSetupForm onCreated={noop} />
                <ActiveTournamentsList onOpen={noop} />
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
