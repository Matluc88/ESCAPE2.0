import React, { useState, useCallback, useRef } from 'react'
import VirtualJoystick from './VirtualJoystick'
import InteractionButton from './InteractionButton'
import './MobileControls.css'

/**
 * Mobile controls wrapper component
 * Contains left joystick (movement), right joystick (camera), and interaction button
 * @param {Object} props
 * @param {function} props.onMoveChange - Callback for movement joystick {x, y}
 * @param {function} props.onLookChange - Callback for look joystick {x, y}
 * @param {function} props.onInteract - Callback when interaction button is pressed
 * @param {boolean} props.canInteract - Whether an interactive object is targeted
 * @param {string} props.targetName - Name of the targeted object
 * @param {boolean} props.visible - Whether controls should be visible
 */
function MobileControls({ 
  onMoveChange, 
  onLookChange, 
  onInteract, 
  canInteract = false, 
  targetName = null,
  visible = true 
}) {
  // Store current joystick values for external access
  const moveVecRef = useRef({ x: 0, y: 0 })
  const lookVecRef = useRef({ x: 0, y: 0 })

  const handleMoveChange = useCallback((vec) => {
    moveVecRef.current = vec
    onMoveChange?.(vec)
  }, [onMoveChange])

  const handleLookChange = useCallback((vec) => {
    lookVecRef.current = vec
    onLookChange?.(vec)
  }, [onLookChange])

  const handleInteract = useCallback(() => {
    if (canInteract) {
      onInteract?.()
    }
  }, [canInteract, onInteract])

  if (!visible) return null

  return (
    <div className="mobile-controls">
      {/* Left joystick for movement */}
      <VirtualJoystick 
        position="left" 
        onChange={handleMoveChange}
        size={120}
      />
      
      {/* Right joystick for camera rotation - infinite drag enabled for continuous rotation */}
      <VirtualJoystick 
        position="right" 
        onChange={handleLookChange}
        size={120}
        infiniteDrag={true}
      />
      
      {/* Center interaction button */}
      <InteractionButton 
        active={canInteract}
        onPress={handleInteract}
        targetName={targetName}
      />
    </div>
  )
}

export default MobileControls
