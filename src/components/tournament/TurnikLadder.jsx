import React, { useState } from 'react';
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
// требует на 1 подтягивание больше, кто не выполнил норму — выбывает, и
// организатор всегда вводит, сколько подтягиваний участник реально успел
// сделать (нужно для общей статистики и для tie-break при равном раунде).
export default function TurnikLadder({ tournament, editable, onPass, onFail, onUndo, onAdvance }) {
  const round = tournament.round || 1;
  const passed = tournament.passed || {};
  const isFinished = tournament.status === 'finished';
  const rows = buildLadderRanking(tournament);
  const [failingName, setFailingName] = useState(null);
  const [repsInput, setRepsInput] = useState('');
  const [repsError, setRepsError] = useState(null);

  const activeRows = rows.filter(r => r.eliminatedRound == null);
  const eliminatedRows = rows.filter(r => r.eliminatedRound != null);
  const allMarked = activeRows.length > 0 && activeRows.every(r => passed[r.name]);

  function startFailing(name) {
    setFailingName(name);
    setRepsInput('');
    setRepsError(null);
  }
  function cancelFailing() {
    setFailingName(null);
    setRepsInput('');
    setRepsError(null);
  }
  function confirmFailing(name) {
    const reps = parseInt(repsInput, 10);
    if (Number.isNaN(reps) || reps < 0) { setRepsError('Введите количество подтягиваний.'); return; }
    onFail(name, reps);
    setFailingName(null);
    setRepsInput('');
    setRepsError(null);
  }

  return (
    <div className="card">
      <div className="card-title">
        {isFinished ? 'Итоги турника' : `Раунд ${round} · ${pluralReps(round)}`}
      </div>

      <div className="saves-list">
        {activeRows.map(row => {
          const isPassed = Boolean(passed[row.name]);
          const isFailing = failingName === row.name;
          return (
            <div className="save-item" key={row.name}>
              <div className="save-item-info">
                <div className="save-item-name">{row.name}</div>
                {!isFinished && !isFailing && (
                  <div className="save-item-meta">
                    {isPassed ? '✅ Выполнил' : editable ? 'Ожидает отметки' : '—'}
                  </div>
                )}
              </div>
              {editable && !isFinished && (
                isFailing ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      className="gm-score-input"
                      placeholder="0"
                      value={repsInput}
                      onChange={e => setRepsInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') confirmFailing(row.name); }}
                    />
                    <button className="pause-btn" onClick={() => confirmFailing(row.name)}>Подтвердить ✓</button>
                    <button className="pause-btn" onClick={cancelFailing}>← Отмена</button>
                  </div>
                ) : isPassed ? (
                  <button className="pause-btn" onClick={() => onUndo(row.name)}>↩ Отменить</button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="pause-btn" onClick={() => onPass(row.name)}>✅ Выполнил</button>
                    <button
                      className="pause-btn"
                      style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: 'var(--red)' }}
                      onClick={() => startFailing(row.name)}
                    >
                      ❌ Не выполнил
                    </button>
                  </div>
                )
              )}
              {isFailing && repsError && (
                <div style={{ color: 'var(--red)', fontSize: '0.7rem', marginTop: 4 }}>{repsError}</div>
              )}
            </div>
          );
        })}
      </div>

      {eliminatedRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 6 }}>Выбывшие:</div>
          <div className="table-scroll">
          <table className="standings-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Место</th>
                <th style={{ textAlign: 'left' }}>Участник</th>
                <th>Выбыл в раунде</th>
                <th>Подтягиваний</th>
              </tr>
            </thead>
            <tbody>
              {eliminatedRows.map(row => (
                <tr key={row.name}>
                  <td>{row.rank}</td>
                  <td style={{ textAlign: 'left' }}>{row.name}</td>
                  <td>{row.eliminatedRound}</td>
                  <td>{row.reps}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
