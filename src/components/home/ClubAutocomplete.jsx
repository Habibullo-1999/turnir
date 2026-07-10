import React, { useEffect, useMemo, useState } from 'react';
import { CLUBS } from '../../utils/clubs.js';

export default function ClubAutocomplete({ club, onSelect }) {
  const [query, setQuery] = useState(club ? club.club : '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(club ? club.club : '');
  }, [club]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return CLUBS.filter(c => c.n.toLowerCase().includes(q) || c.l.toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  function handleInput(e) {
    setQuery(e.target.value);
    if (club) onSelect(null);
    setOpen(true);
  }

  function handleSelect(c) {
    setQuery(c.n);
    onSelect({ club: c.n, league: c.l, flag: c.f, icon: c.i || '' });
    setOpen(false);
  }

  return (
    <div className="club-selector-wrap">
      <input
        type="text"
        className="p-club"
        placeholder="🔍 Клуб (необязательно)"
        autoComplete="off"
        value={query}
        onChange={handleInput}
        onFocus={() => query && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <div className={'club-dropdown' + (open && matches.length ? ' open' : '')}>
        {matches.map(c => (
          <div
            key={c.n}
            className="club-option"
            onMouseDown={e => { e.preventDefault(); handleSelect(c); }}
          >
            {c.i ? (
              <img src={`${import.meta.env.BASE_URL}${c.i}`} className="co-icon" alt="" />
            ) : (
              <span className="co-flag">{c.f}</span>
            )}
            <span className="co-name">{c.n}</span>
            <span className="co-league">{c.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
