import { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'

export function useMqttFridge() {
  const clientRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [fridgeStatus, setFridgeStatus] = useState(null)
  
  const URL = 'wss://broker.hivemq.com:8884/mqtt'
  const COMMAND_TOPIC = 'home/cucina/frigo/comando'
  const STATUS_TOPIC = 'home/cucina/frigo/stato'

  useEffect(() => {
    if (clientRef.current) return

    console.log('🔌 Connecting to MQTT broker via WebSocket...')
    
    const client = mqtt.connect(URL, {
      clean: true,
      keepalive: 60,
      clientId: `web-fridge-${Math.random().toString(16).slice(2, 10)}`
    })
    
    clientRef.current = client

    client.on('connect', () => {
      console.log('✅ Connected to MQTT broker')
      setConnected(true)
      client.subscribe(STATUS_TOPIC, (err) => {
        if (err) {
          console.error('❌ Subscription error:', err)
        } else {
          console.log('📡 Subscribed to:', STATUS_TOPIC)
        }
      })
    })

    client.on('message', (topic, payload) => {
      if (topic === STATUS_TOPIC) {
        const status = payload.toString()
        console.log('📥 Received status:', status)
        setFridgeStatus(status)
      }
    })

    client.on('close', () => {
      console.log('🔌 MQTT connection closed')
      setConnected(false)
    })

    client.on('error', (error) => {
      console.error('❌ MQTT error:', error)
      setConnected(false)
    })

    return () => {
      console.log('🔌 Disconnecting from MQTT broker...')
      try {
        if (clientRef.current) {
          clientRef.current.end(true)
        }
      } catch (error) {
        console.error('Error disconnecting:', error)
      }
      clientRef.current = null
    }
  }, [])

  const setFridgeOn = () => {
    if (clientRef.current && connected) {
      console.log('📤 Sending command: ON')
      clientRef.current.publish(COMMAND_TOPIC, 'ON')
    } else {
      console.warn('⚠️ MQTT not connected, cannot send ON command')
    }
  }

  const setFridgeOff = () => {
    if (clientRef.current && connected) {
      console.log('📤 Sending command: OFF')
      clientRef.current.publish(COMMAND_TOPIC, 'OFF')
    } else {
      console.warn('⚠️ MQTT not connected, cannot send OFF command')
    }
  }

  return { connected, fridgeStatus, setFridgeOn, setFridgeOff }
}
