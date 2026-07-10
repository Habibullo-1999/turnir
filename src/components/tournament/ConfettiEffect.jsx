import React, { useMemo } from 'react';

const COLORS = ['#22c55e', '#fbbf24', '#ef4444', '#3b82f6', '#a855f7', '#f97316'];

// Remounted by the parent (key={winner name}) each time a new champion is
// declared, so it re-triggers the burst rather than trying to reset CSS
// animation state on an already-mounted node.
export default function ConfettiEffect() {
  const pieces = useMemo(() => Array.from({ length: 90 }, () => ({
    left: Math.random() * 100 + 'vw',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: (1.5 + Math.random() * 2.5) + 's',
    delay: (Math.random() * 2) + 's',
    size: (6 + Math.random() * 8) + 'px',
  })), []);

  return (
    <div className="confetti-container">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: p.left,
            background: p.color,
            animationDuration: p.duration,
            animationDelay: p.delay,
            width: p.size,
            height: p.size,
          }}
        />
      ))}
    </div>
  );
}
