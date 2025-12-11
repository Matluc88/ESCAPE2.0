import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

function useWebSocket(sessionId, room, playerName) {
  const [connected, setConnected] = useState(false)
  const [sessionState, setSessionState] = useState(null)
  const [notifications, setNotifications] = useState([])
  const socketRef = useRef(null)

  useEffect(() => {
    if (!sessionId || !room || !playerName) {
      console.log('WebSocket: Missing required parameters', { sessionId, room, playerName })
      return
    }

    console.log('WebSocket: Connecting to', WS_URL)
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('WebSocket: Connected with ID', socket.id)
      setConnected(true)
      
      socket.emit('joinSession', {
        sessionId,
        room,
        playerName
      })
      console.log('WebSocket: Emitted joinSession', { sessionId, room, playerName })
    })

    socket.on('disconnect', () => {
      console.log('WebSocket: Disconnected')
      setConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('WebSocket: Connection error', error)
      setConnected(false)
    })

    socket.on('sessionState', (data) => {
      console.log('WebSocket: Received sessionState', data)
      setSessionState(data)
    })

    socket.on('playerJoined', (data) => {
      console.log('WebSocket: Player joined', data)
      addNotification(`${data.playerName} è entrato nella stanza ${data.room}`)
    })

    socket.on('playerLeft', (data) => {
      console.log('WebSocket: Player left', data)
      addNotification(`${data.playerName} ha lasciato la stanza ${data.room}`)
    })

    socket.on('actionSuccess', (data) => {
      console.log('WebSocket: Action success', data)
      addNotification(`✓ ${data.message || 'Azione completata!'}`)
      
      if (data.sessionState) {
        setSessionState(data.sessionState)
      }
    })

    socket.on('actionFailed', (data) => {
      console.log('WebSocket: Action failed', data)
      addNotification(`✗ ${data.message || 'Azione fallita!'}`)
    })

    socket.on('globalNotification', (data) => {
      console.log('WebSocket: Global notification', data)
      addNotification(data.message)
    })

    socket.on('globalStateUpdate', (data) => {
      console.log('WebSocket: Global state update', data)
      setSessionState(data)
    })

    socket.on('gameComplete', (data) => {
      console.log('WebSocket: Game complete', data)
      addNotification('🎉 Gioco completato! Congratulazioni!')
    })

    return () => {
      console.log('WebSocket: Cleaning up connection')
      socket.disconnect()
    }
  }, [sessionId, room, playerName])

  const addNotification = (message) => {
    const notification = {
      id: Date.now(),
      message,
      timestamp: new Date().toISOString()
    }
    setNotifications(prev => [...prev, notification])
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id))
    }, 5000)
  }

  const sendAction = (action, target) => {
    if (!socketRef.current || !connected) {
      console.warn('WebSocket: Cannot send action, not connected')
      addNotification('⚠ Non connesso al server')
      return
    }

    console.log('WebSocket: Sending action', { action, target, sessionId, room, playerName })
    socketRef.current.emit('playerAction', {
      sessionId,
      room,
      playerName,
      action,
      target
    })
  }

  return {
    connected,
    sessionState,
    notifications,
    sendAction
  }
}

export default useWebSocket
