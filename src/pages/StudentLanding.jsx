import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const ROOM_CONFIG = {
  esterno: { name: 'Esterno', emoji: '🏡', color: '#8B4513' },
  cucina: { name: 'Cucina', emoji: '🍳', color: '#FF6B6B' },
  soggiorno: { name: 'Soggiorno', emoji: '📺', color: '#4ECDC4' },
  bagno: { name: 'Bagno', emoji: '🚿', color: '#95E1D3' },
  camera: { name: 'Camera', emoji: '🛏️', color: '#F38181' }
}

function StudentLanding() {
  const { sessionId, room } = useParams()
  const navigate = useNavigate()
  const [playerName, setPlayerName] = useState('')
  
  const roomConfig = ROOM_CONFIG[room] || ROOM_CONFIG.cucina

  const handleEnter = () => {
    if (!playerName.trim()) {
      alert('Per favore, inserisci il tuo nome!')
      return
    }
    
    navigate(`/play/${sessionId}/${room}?name=${encodeURIComponent(playerName.trim())}`)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleEnter()
    }
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: roomConfig.color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      transition: 'background-color 0.3s ease'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{
          fontSize: '80px',
          marginBottom: '20px',
          animation: 'bounce 2s infinite'
        }}>
          {roomConfig.emoji}
        </div>
        
        <h1 style={{
          fontSize: '32px',
          color: roomConfig.color,
          marginBottom: '10px',
          marginTop: 0
        }}>
          Stanza: {roomConfig.name}
        </h1>
        
        <p style={{
          fontSize: '14px',
          color: '#666',
          marginBottom: '30px'
        }}>
          Sessione: {sessionId}
        </p>
        
        <div style={{
          marginBottom: '20px'
        }}>
          <label style={{
            display: 'block',
            fontSize: '16px',
            color: '#333',
            marginBottom: '10px',
            fontWeight: 'bold'
          }}>
            Il tuo nome
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyPress={handleKeyPress}
            autoFocus
            placeholder="Inserisci il tuo nome..."
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '16px',
              border: `2px solid ${roomConfig.color}`,
              borderRadius: '10px',
              outline: 'none',
              transition: 'all 0.3s ease',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <button
          onClick={handleEnter}
          style={{
            width: '100%',
            padding: '15px 30px',
            backgroundColor: roomConfig.color,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '20px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease'
          }}
        >
          ENTRA 🚪
        </button>
        
        <p style={{
          fontSize: '12px',
          color: '#999',
          marginTop: '20px',
          marginBottom: 0
        }}>
          Premi INVIO o clicca sul bottone per entrare
        </p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        input:focus {
          box-shadow: 0 0 0 3px ${roomConfig.color}33;
        }
        
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        
        button:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}

export default StudentLanding
