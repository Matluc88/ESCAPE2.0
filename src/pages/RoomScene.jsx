import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import KitchenScene from '../components/scenes/KitchenScene'
import LivingRoomScene from '../components/scenes/LivingRoomScene'
import BathroomScene from '../components/scenes/BathroomScene'
import BedroomScene from '../components/scenes/BedroomScene'
import EsternoScene from '../components/scenes/EsternoScene'
import useWebSocket from '../hooks/useWebSocket'
import { useMqttFridge } from '../hooks/useMqttFridge'
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'
import { useMobileControls } from '../hooks/useMobileControls'
import NotificationToast from '../components/UI/NotificationToast'
import ProgressBar from '../components/UI/ProgressBar'
import MobileControls from '../components/UI/MobileControls'
import RotateDeviceOverlay from '../components/UI/RotateDeviceOverlay'

const ROOM_EMOJIS = {
  esterno: '🏡',
  cucina: '🍳',
  bagno: '🚿',
  camera: '🛏️',
  soggiorno: '🛋️',
  default: '🏠'
}

function RoomScene() {
  const { sessionId, room } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const playerName = searchParams.get('name') || 'Guest'

  const [objectStates, setObjectStates] = useState({
    forno: 'off',
    frigo: 'off',
    cassetto: 'aperto',
    valvola_gas: 'aperta',
    finestra: 'aperta'
  })

  // Mobile controls state
  const { isPortrait, isLandscape, isMobile: detectedMobile } = useDeviceOrientation()
  const mobileControls = useMobileControls()
  const [currentTarget, setCurrentTarget] = useState(null)
  const [currentTargetName, setCurrentTargetName] = useState(null)
  
  // Debug override: add ?forceMobile=1 to URL to force mobile mode
  const forceMobile = searchParams.get('forceMobile') === '1'
  const isMobile = forceMobile || detectedMobile
  
  // Fullscreen management for mobile
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)
  
  // Request fullscreen on mobile when entering landscape mode
  useEffect(() => {
    if (!isMobile || !isLandscape) return
    
    const requestFullscreen = async () => {
      try {
        const elem = document.documentElement
        if (elem.requestFullscreen && !document.fullscreenElement) {
          await elem.requestFullscreen()
          setIsFullscreen(true)
        } else if (elem.webkitRequestFullscreen && !document.webkitFullscreenElement) {
          await elem.webkitRequestFullscreen()
          setIsFullscreen(true)
        }
      } catch (err) {
        console.log('Fullscreen request failed:', err)
      }
    }
    
    // Small delay to ensure the page is ready
    const timer = setTimeout(requestFullscreen, 500)
    return () => clearTimeout(timer)
  }, [isMobile, isLandscape])
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])

  const { connected, sessionState, notifications, sendAction } = useWebSocket(
    sessionId,
    room,
    playerName
  )

  const { connected: mqttConnected, fridgeStatus, setFridgeOn, setFridgeOff } = useMqttFridge()

  // Handle when player looks at an interactive object (for mobile interaction button)
  const handleLookAtChange = useCallback((target, targetName) => {
    setCurrentTarget(target)
    setCurrentTargetName(targetName)
  }, [])

  useEffect(() => {
    if (sessionState && sessionState.objectStates) {
      setObjectStates(prev => ({
        ...prev,
        ...sessionState.objectStates
      }))
    }
  }, [sessionState])

  // Wrap handleObjectClick in useCallback to avoid stale closure issues
  const handleObjectClick = useCallback((target) => {
    console.log('Click su:', target)
    
    const key = (target || '').toLowerCase()
    
    if (key === 'testcucina1') {
      console.log(`🧪 Test cube clicked: ${key} - Controlling LED`)
      if (fridgeStatus === 'ACCESO') {
        console.log(`Sending OFF command for ${key}`)
        setFridgeOff()
      } else {
        console.log(`Sending ON command for ${key}`)
        setFridgeOn()
      }
      return
    }
    
    if (key.startsWith('test')) {
      console.log(`🧪 Test cube clicked: ${key} - Not connected yet`)
      alert(`${target} non è ancora collegato. Solo testcucina1 controlla il LED.`)
      return
    }
    
    if (key === 'frigo') {
      if (fridgeStatus === 'ACCESO') {
        setFridgeOff()
      } else {
        setFridgeOn()
      }
    }
    
    let action
    if (key === 'forno' || key === 'frigo') {
      action = objectStates[key] === 'on' ? 'off' : 'on'
    } else if (key === 'cassetto') {
      action = objectStates.cassetto === 'aperto' ? 'close' : 'open'
    } else if (key === 'valvola_gas') {
      action = objectStates.valvola_gas === 'aperta' ? 'close' : 'open'
    } else if (key === 'finestra') {
      action = objectStates.finestra === 'aperta' ? 'close' : 'open'
    }
    
    if (action) {
      sendAction(action, key)
      
      const newState = { ...objectStates }
      if (key === 'forno' || key === 'frigo') {
        newState[key] = action === 'on' ? 'on' : 'off'
      } else if (key === 'cassetto') {
        newState.cassetto = action === 'close' ? 'chiuso' : 'aperto'
      } else if (key === 'valvola_gas') {
        newState.valvola_gas = action === 'close' ? 'chiusa' : 'aperta'
      } else if (key === 'finestra') {
        newState.finestra = action === 'close' ? 'chiusa' : 'aperta'
      }
      setObjectStates(newState)
    }
  }, [objectStates, fridgeStatus, sendAction, setFridgeOn, setFridgeOff])

  // Handle mobile interaction button press
  const handleMobileInteract = useCallback(() => {
    if (currentTarget) {
      handleObjectClick(currentTarget)
    }
  }, [currentTarget, handleObjectClick])

  const renderScene = () => {
    // Common props for all scenes
    // Always pass mobileControls - useFPSControls will decide internally whether to use mobile or desktop mode
    const sceneProps = {
      onObjectClick: handleObjectClick,
      onLookAtChange: handleLookAtChange,
      mobileInput: mobileControls
    }

    if (room === 'esterno') {
      return <EsternoScene {...sceneProps} isMobile={isMobile} />
    }
    if (room === 'cucina') {
      return <KitchenScene {...sceneProps} isMobile={isMobile} />
    }
    if (room === 'soggiorno') {
      return <LivingRoomScene {...sceneProps} isMobile={isMobile} />
    }
    if (room === 'bagno') {
      return <BathroomScene {...sceneProps} isMobile={isMobile} />
    }
    if (room === 'camera') {
      return <BedroomScene {...sceneProps} isMobile={isMobile} />
    }
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        color: '#666'
      }}>
        Stanza "{room}" - Coming Soon
      </div>
    )
  }

  const getCompletedPuzzles = () => {
    if (!sessionState || !sessionState.completed) return []
    return sessionState.completed
  }

  const getCurrentPuzzle = () => {
    if (!sessionState || !sessionState.currentPuzzle) return null
    return sessionState.currentPuzzle
  }

  const emoji = ROOM_EMOJIS[room] || ROOM_EMOJIS.default
  const truncatedSessionId = sessionId ? sessionId.substring(0, 8) : ''

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        backgroundColor: '#333',
        color: 'white',
        padding: '15px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <span style={{ fontSize: '20px' }}>
              {connected ? '🟢' : '🔴'}
            </span>
            <h1 style={{ margin: 0, fontSize: '20px' }}>
              {emoji} {room.charAt(0).toUpperCase() + room.slice(1)}
            </h1>
          </div>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#ccc' }}>
            {playerName} | Sessione: {truncatedSessionId}
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            minHeight: '44px',
            minWidth: '80px'
          }}
        >
          Esci
        </button>
      </header>
      
      <div style={{ flex: 1, position: 'relative' }}>
        {renderScene()}
        
        {/* Mobile controls - only show in landscape mode on mobile */}
        {isMobile && isLandscape && (
          <MobileControls
            onMoveChange={mobileControls.setMoveVec}
            onLookChange={mobileControls.setLookVec}
            onInteract={handleMobileInteract}
            canInteract={currentTarget !== null}
            targetName={currentTargetName}
            visible={true}
          />
        )}
        
        {/* Rotate device overlay - show when mobile and portrait */}
        {isMobile && isPortrait && <RotateDeviceOverlay />}
        
        <NotificationToast notifications={notifications} />
        
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'monospace',
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ marginBottom: '4px' }}>
            <strong>🔌 MQTT ESP32:</strong> {mqttConnected ? '🟢 Connesso' : '🔴 Disconnesso'}
          </div>
          <div>
            <strong>💡 LED:</strong> {fridgeStatus || '❓ Sconosciuto'}
          </div>
        </div>
        
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 100
        }}>
          <ProgressBar
            room={room}
            completed={getCompletedPuzzles()}
            total={5}
            current={getCurrentPuzzle()}
          />
        </div>
      </div>
    </div>
  )
}

export default RoomScene
