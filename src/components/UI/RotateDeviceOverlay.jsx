import React from 'react'
import './RotateDeviceOverlay.css'

/**
 * Overlay that appears when device is in portrait mode
 * Prompts user to rotate to landscape for 3D gameplay
 */
function RotateDeviceOverlay() {
  return (
    <div className="rotate-overlay">
      <div className="rotate-content">
        <div className="rotate-icon">
          <svg 
            viewBox="0 0 100 100" 
            width="120" 
            height="120"
            className="phone-icon"
          >
            {/* Phone outline */}
            <rect 
              x="30" y="10" 
              width="40" height="80" 
              rx="5" ry="5" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="3"
            />
            {/* Screen */}
            <rect 
              x="35" y="18" 
              width="30" height="60" 
              fill="currentColor" 
              opacity="0.3"
            />
            {/* Home button */}
            <circle cx="50" cy="85" r="4" fill="currentColor" />
          </svg>
          <div className="rotate-arrow">
            <svg viewBox="0 0 50 50" width="40" height="40">
              <path 
                d="M25 5 C10 5 5 20 5 25 C5 30 10 45 25 45" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3"
                strokeLinecap="round"
              />
              <polygon 
                points="20,40 25,50 30,40" 
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
        <h2 className="rotate-title">Ruota lo smartphone</h2>
        <p className="rotate-message">
          Per entrare nella stanza 3D, ruota il dispositivo in orizzontale
        </p>
      </div>
    </div>
  )
}

export default RotateDeviceOverlay
