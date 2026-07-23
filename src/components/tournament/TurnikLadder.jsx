import React from 'react';
import { buildLadderRanking } from '../../utils/ladder.js';

function pluralReps(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} подтягиваний`;
  if (mod10 === 1) return `${n} подтягивание`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} подтягивания`;
  return `${n} подтягиваний`;
}

// Турник — лестница на выбывание, не таблица результатов: каждый раунд
// требует на 1 подтягивание больше, кто не выполнил норму — выбывает.
export default function TurnikLadder({ tournament, editable, onPass, onFail, onUndo, onAdvance }) {
  const round = tournament.round || 1;
  const passed = tournament.passed || {};
  const isFinished = tournament.status === 'finished';
  const rows = buildLadderRanking(tournament);

  const activeRows = rows.filter(r => r.eliminatedRound == null);
  const eliminatedRows = rows.filter(r => r.eliminatedRound != null);
  const allMarked = activeRows.length > 0 && activeRows.every(r => passed[r.name]);

  return (
    <div className="card">
      <div className="card-title">
        {isFinished ? 'Итоги турника' : `Раунд ${round} · ${pluralReps(round)}`}
      </div>

      <div className="saves-list">
        {activeRows.map(row => {
          const isPassed = Boolean(passed[row.name]);
          return (
            <div className="save-item" key={row.name}>
              <div className="save-item-info">
                <div className="save-item-name">{row.name}</div>
                {!isFinished && (
                  <div className="save-item-meta">
                    {isPassed ? '✅ Выполнил' : editable ? 'Ожидает отметки' : '—'}
                  </div>
                )}
              </div>
              {editable && !isFinished && (
                isPassed ? (
                  <button className="pause-btn" onClick={() => onUndo(row.name)}>↩ Отменить</button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="pause-btn" onClick={() => onPass(row.name)}>✅ Выполнил</button>
                    <button
                      className="pause-btn"
                      style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--red)' }}
                      onClick={() => onFail(row.name)}
                    >
                      ❌ Не выполнил
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {eliminatedRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 6 }}>Выбывшие:</div>
          <table className="standings-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Место</th>
                <th style={{ textAlign: 'left' }}>Участник</th>
                <th>Выбыл в раунде</th>
              </tr>
            </thead>
            <tbody>
              {eliminatedRows.map(row => (
                <tr key={row.name}>
                  <td>{row.rank}</td>
                  <td style={{ textAlign: 'left' }}>{row.name}</td>
                  <td>{row.eliminatedRound}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editable && !isFinished && (
        <div className="btn-row">
          <button className="btn btn-primary" disabled={!allMarked} onClick={onAdvance}>
            Начать раунд {round + 1} →
          </button>
        </div>
      )}
    </div>
  );
}
