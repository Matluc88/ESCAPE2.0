import React from 'react'
import './InteractionButton.css'

/**
 * Interaction button (hand icon) for mobile controls
 * Highlights when pointing at an interactive object
 * @param {Object} props
 * @param {boolean} props.active - Whether an interactive object is targeted
 * @param {function} props.onPress - Callback when button is pressed
 * @param {string} props.targetName - Name of the targeted object (optional, for display)
 */
function InteractionButton({ active = false, onPress, targetName = null }) {
  const handleTouchStart = (e) => {
    e.preventDefault()
    if (active && onPress) {
      onPress()
    }
  }

  return (
    <div className="interaction-button-container">
      {targetName && active && (
        <div className="target-label">
          {targetName}
        </div>
      )}
      <button
        className={`interaction-button ${active ? 'active' : ''}`}
        onTouchStart={handleTouchStart}
        onClick={(e) => {
          e.preventDefault()
          if (active && onPress) {
            onPress()
          }
        }}
        disabled={!active}
        aria-label={active ? `Interagisci con ${targetName || 'oggetto'}` : 'Nessun oggetto selezionato'}
      >
        <svg 
          viewBox="0 0 100 100" 
          width="50" 
          height="50"
          className="hand-icon"
        >
          {/* Hand/pointer icon */}
          <path
            d="M50 15 
               C45 15 42 20 42 25 
               L42 45 
               L35 45 
               C30 45 27 48 27 53 
               L27 60 
               C27 75 35 85 50 85 
               C65 85 73 75 73 60 
               L73 35 
               C73 30 70 27 65 27 
               C62 27 60 28 58 30 
               L58 25 
               C58 20 55 15 50 15 Z
               M42 30 L42 50 M50 25 L50 50 M58 30 L58 50"
            fill="currentColor"
            stroke="none"
          />
          {/* Finger lines */}
          <path
            d="M44 30 L44 48 M50 25 L50 48 M56 30 L56 48"
            fill="none"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

export default InteractionButton
