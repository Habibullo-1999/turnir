import React from 'react';

export default function LoadingOverlay({ text }) {
  if (!text) return null;
  return (
    <div className="loading-overlay active">
      <div className="spinner" />
      <div className="loading-text">{text}</div>
    </div>
  );
}
