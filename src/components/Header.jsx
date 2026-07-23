import React from 'react';

export default function Header({ page, onChangePage, onHome }) {
  return (
    <header>
      <div className="header-top">
        <button type="button" className="header-title" onClick={onHome}>
          <h1>🏆 Турниры</h1>
        </button>
        <nav className="header-nav">
          <button className={'nav-btn' + (page === 'history' ? ' active' : '')} onClick={() => onChangePage('history')}>🏠 Home</button>
          <button className={'nav-btn' + (page === 'turnir' ? ' active' : '')} onClick={() => onChangePage('turnir')}>🏆 Турнир</button>
        </nav>
      </div>
    </header>
  );
}
