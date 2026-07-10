import React from 'react';

export default function Header({ page, onChangePage }) {
  return (
    <header>
      <div className="header-top">
        <h1>⚽ Football Tournament</h1>
        <nav className="header-nav">
          <button className={'nav-btn' + (page === 'history' ? ' active' : '')} onClick={() => onChangePage('history')}>🏠 Home</button>
          <button className={'nav-btn' + (page === 'turnir' ? ' active' : '')} onClick={() => onChangePage('turnir')}>🏆 Турнир</button>
        </nav>
      </div>
    </header>
  );
}
