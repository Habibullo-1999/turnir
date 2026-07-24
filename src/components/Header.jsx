import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Header({ onHome }) {
  return (
    <header>
      <div className="header-top">
        <button type="button" className="header-title" onClick={onHome}>
          <h1>🏆 Турниры</h1>
        </button>
        <nav className="header-nav" aria-label="Основная навигация">
          <NavLink end to="/" className={({ isActive }) => 'nav-btn' + (isActive ? ' active' : '')}>🏠 Главная</NavLink>
          <NavLink to="/tournament" className={({ isActive }) => 'nav-btn' + (isActive ? ' active' : '')}>🏆 Турнир</NavLink>
          <NavLink to="/history" className={({ isActive }) => 'nav-btn' + (isActive ? ' active' : '')}>📊 История</NavLink>
        </nav>
      </div>
    </header>
  );
}
