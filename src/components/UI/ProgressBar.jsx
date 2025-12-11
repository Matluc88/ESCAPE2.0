import React from 'react'
import './ProgressBar.css'

const ROOM_EMOJIS = {
  cucina: '🍳',
  bagno: '🚿',
  camera: '🛏️',
  soggiorno: '🛋️',
  default: '🏠'
}

function ProgressBar({ room, completed = [], total = 5, current = null }) {
  const completedCount = completed.length
  const progressPercentage = total > 0 ? (completedCount / total) * 100 : 0
  const emoji = ROOM_EMOJIS[room] || ROOM_EMOJIS.default

  return (
    <div className="progress-bar-container">
      <div className="progress-header">
        <h3 className="progress-title">
          {emoji} {room ? room.charAt(0).toUpperCase() + room.slice(1) : 'Stanza'}
        </h3>
        <span className="progress-count">
          {completedCount} / {total}
        </span>
      </div>
      
      <div className="progress-bar-track">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${progressPercentage}%` }}
        >
          {progressPercentage > 10 && (
            <span className="progress-percentage">{Math.round(progressPercentage)}%</span>
          )}
        </div>
      </div>

      {current && (
        <div className="progress-current">
          <span className="progress-label">Puzzle corrente:</span>
          <span className="progress-current-name">{current}</span>
        </div>
      )}

      {completed.length > 0 && (
        <div className="progress-completed-list">
          <span className="progress-label">Completati:</span>
          <ul className="completed-items">
            {completed.map((item, index) => (
              <li key={index} className="completed-item">
                ✓ {item.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default ProgressBar
