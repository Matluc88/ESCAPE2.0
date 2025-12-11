import { useParams, useNavigate } from 'react-router-dom'

export default function Victory() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        color: '#333',
        padding: '3rem',
        borderRadius: '20px',
        maxWidth: '600px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: '6rem', marginBottom: '1rem' }}>🎉</div>
        
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: '#667eea' }}>
          Congratulazioni!
        </h1>
        
        <p style={{ fontSize: '1.5rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          Avete completato l'<strong>Escape Room 3D</strong>!<br/>
          Ottimo lavoro di squadra! 👏
        </p>
        
        <div style={{
          background: '#f0f0f0',
          padding: '1rem',
          borderRadius: '10px',
          marginBottom: '2rem'
        }}>
          <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
            Session: <code>{sessionId}</code>
          </p>
        </div>
        
        <button
          onClick={() => navigate('/admin')}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🏠 Nuova Partita
        </button>
      </div>
    </div>
  )
}
