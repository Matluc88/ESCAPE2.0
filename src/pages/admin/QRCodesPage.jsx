import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'

const ROOMS = [
  { id: 'esterno', name: 'Esterno', emoji: '🏡', color: '#8B4513' },
  { id: 'cucina', name: 'Cucina', emoji: '🍳', color: '#FF6B6B' },
  { id: 'soggiorno', name: 'Soggiorno', emoji: '📺', color: '#4ECDC4' },
  { id: 'bagno', name: 'Bagno', emoji: '🚿', color: '#95E1D3' },
  { id: 'camera', name: 'Camera', emoji: '🛏️', color: '#F38181' }
]

function QRCodesPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div className="no-print" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        marginBottom: '20px'
      }}>
        <h1 style={{
          fontSize: '28px',
          color: '#333',
          marginBottom: '10px'
        }}>
          QR Code Sessione
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '20px'
        }}>
          Sessione ID: <strong>{sessionId}</strong>
        </p>
        <button
          onClick={handlePrint}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}
        >
          🖨️ Stampa QR Code
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {ROOMS.map((room) => {
          const qrUrl = `${window.location.origin}/s/${sessionId}/${room.id}`
          
          return (
            <div
              key={room.id}
              className="qr-card"
              style={{
                backgroundColor: 'white',
                padding: '30px',
                borderRadius: '15px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                textAlign: 'center',
                border: `4px solid ${room.color}`,
                pageBreakInside: 'avoid'
              }}
            >
              <Link
                to={`/s/${sessionId}/${room.id}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  cursor: 'pointer'
                }}
                aria-label={`Apri pagina studente per ${room.name}`}
              >
                <div style={{
                  fontSize: '64px',
                  marginBottom: '10px'
                }}>
                  {room.emoji}
                </div>
                
                <h2 style={{
                  fontSize: '24px',
                  color: room.color,
                  marginBottom: '20px',
                  marginTop: 0
                }}>
                  {room.name}
                </h2>
                
                <div style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '10px',
                  display: 'inline-block',
                  marginBottom: '15px'
                }}>
                  <QRCodeSVG
                    value={qrUrl}
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </Link>
              
              <p style={{
                fontSize: '12px',
                color: '#666',
                wordBreak: 'break-all',
                marginTop: '10px'
              }}>
                <a 
                  href={qrUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    color: room.color,
                    textDecoration: 'none'
                  }}
                >
                  {qrUrl}
                </a>
              </p>
              
              <div className="no-print" style={{
                marginTop: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <button
                  onClick={() => navigate(`/s/${sessionId}/${room.id}`)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: room.color,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  📱 Apri pagina studente
                </button>
                <button
                  onClick={() => navigate(`/play/${sessionId}/${room.id}?name=Guest`)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  🚀 Test rapido (salta nome)
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @media print {
          body {
            background: white;
          }
          
          .no-print {
            display: none !important;
          }
          
          .qr-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  )
}

export default QRCodesPage
