import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTournament } from '../context/TournamentContext.jsx';
import { listActive } from '../services/tournaments.js';

export default function Header({ onHome }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTournament } = useTournament();
  const [openingLatest, setOpeningLatest] = useState(false);

  async function openLatestTournament() {
    setOpeningLatest(true);
    try {
      const tournaments = await listActive();
      if (!tournaments.length) {
        navigate('/tournaments');
        return;
      }
      await openTournament(tournaments[0].id);
      navigate('/tournament');
    } finally {
      setOpeningLatest(false);
    }
  }
  return (
    <header>
      <div className="header-top">
        <button type="button" className="header-title" onClick={onHome}>
          <h1>🏆 Турниры</h1>
        </button>
        <nav className="header-nav" aria-label="Основная навигация">
          <NavLink end to="/" className={({ isActive }) => 'nav-btn' + (isActive ? ' active' : '')}>🏠 Главная</NavLink>
          <button type="button" className={'nav-btn' + (location.pathname === '/tournament' ? ' active' : '')} onClick={openLatestTournament} disabled={openingLatest}>🏆 {openingLatest ? 'Загрузка…' : 'Турнир'}</button>
          <NavLink to="/history" className={({ isActive }) => 'nav-btn' + (isActive ? ' active' : '')}>📊 История</NavLink>
        </nav>
      </div>
    </header>
  );
}
