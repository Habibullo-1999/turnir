import React from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { TournamentProvider, useTournament } from './context/TournamentContext.jsx';
import Header from './components/Header.jsx';
import LoadingOverlay from './components/LoadingOverlay.jsx';
import SportSelectScreen from './components/home/SportSelectScreen.jsx';
import TournamentSetupForm from './components/home/TournamentSetupForm.jsx';
import ActiveTournamentsList from './components/home/ActiveTournamentsList.jsx';
import TournamentPage from './components/tournament/TournamentPage.jsx';
import HistoryList from './components/history/HistoryList.jsx';
import ViewOnlyPage from './components/viewonly/ViewOnlyPage.jsx';
import { SPORT_CONFIG } from './utils/sportConfig.js';

function AppLayout() {
  const navigate = useNavigate();
  const { closeTournament } = useTournament();

  function goHome() {
    closeTournament();
    navigate('/');
  }

  return (
    <>
      <Header onHome={goHome} />
      <main className="container"><Outlet /></main>
    </>
  );
}

function HomePage() {
  const navigate = useNavigate();
  return <SportSelectScreen onSelect={sport => navigate(`/create/${sport}`)} />;
}

function CreateTournamentPage() {
  const { sport } = useParams();
  const navigate = useNavigate();

  if (!SPORT_CONFIG[sport]) return <Navigate to="/" replace />;

  return (
    <>
      <button className="pause-btn" style={{ marginBottom: 14 }} onClick={() => navigate('/')}>← Сменить вид спорта</button>
      <TournamentSetupForm sport={sport} onCreated={() => navigate('/tournament')} />
      <ActiveTournamentsList sport={sport} onOpen={() => navigate('/tournament')} />
    </>
  );
}

function TournamentRoute() {
  const navigate = useNavigate();
  const { tournament, opening, openError } = useTournament();

  if (opening) return <LoadingOverlay text="Загрузка турнира..." />;
  if (openError) return <div className="card" style={{ color: 'var(--red)' }}>⚠️ {openError}</div>;
  if (!tournament) return <Navigate to="/" replace />;

  return <TournamentPage onHome={() => navigate('/')} />;
}

function ViewOnlyRoute() {
  const { id } = useParams();
  return <ViewOnlyPage id={id} />;
}

function LegacyViewRedirect() {
  const viewId = new URLSearchParams(window.location.search).get('view');
  return viewId ? <Navigate to={`/view/${encodeURIComponent(viewId)}`} replace /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/view/:id" element={<ViewOnlyRoute />} />
        <Route element={<TournamentProvider><AppLayout /></TournamentProvider>}>
          <Route path="/" element={<HomePage />} />
          <Route path="/create/:sport" element={<CreateTournamentPage />} />
          <Route path="/tournament" element={<TournamentRoute />} />
          <Route path="/history" element={<HistoryList />} />
        </Route>
        <Route path="*" element={<LegacyViewRedirect />} />
      </Routes>
    </HashRouter>
  );
}
