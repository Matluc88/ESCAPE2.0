import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSession } from '../../utils/api'

function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreateSession = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await createSession()
      const sessionId = response.sessionId || `session-${Date.now()}`
      navigate(`/admin/session/${sessionId}/qrcodes`)
    } catch (err) {
      console.error('Errore creazione sessione:', err)
      const fallbackId = `session-${Date.now()}`
      navigate(`/admin/session/${fallbackId}/qrcodes`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '15px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '32px',
          color: '#333',
          marginBottom: '10px',
          marginTop: 0
        }}>
          Dashboard Admin
        </h1>
        
        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '30px'
        }}>
          Crea una nuova sessione per generare i QR code delle stanze
        </p>
        
        {error && (
          <div style={{
            backgroundColor: '#ffcccc',
            color: '#cc0000',
            padding: '10px 20px',
            borderRadius: '5px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
        
        <button
          onClick={handleCreateSession}
          disabled={loading}
          style={{
            width: '100%',
            padding: '15px 30px',
            backgroundColor: loading ? '#cccccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '18px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease'
          }}
        >
          {loading ? '⏳ Creazione in corso...' : '➕ Crea Nuova Sessione'}
        </button>
        
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#666',
          textAlign: 'left'
        }}>
          <strong>ℹ️ Come funziona:</strong>
          <ol style={{ marginTop: '10px', paddingLeft: '20px' }}>
            <li>Clicca su "Crea Nuova Sessione"</li>
            <li>Verranno generati 4 QR code (uno per stanza)</li>
            <li>Stampa i QR code e distribuiscili agli studenti</li>
            <li>Gli studenti scansionano il QR e inseriscono il loro nome</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
