import React, { useRef, useState, useCallback, useEffect } from 'react'
import './VirtualJoystick.css'

/**
 * Professional-grade virtual joystick component for touch controls
 * Implements PUBG/CoD Mobile-style controls with:
 * - Pixel-based dead zone (14px threshold)
 * - Analog output (magnitude varies with finger distance for non-linear response)
 * - Dynamic center offset (center follows finger within 14px radius)
 * - Multitouch isolation (each joystick tracks only its own touch)
 * - Smooth center return on touch release
 * - Optional infinite drag mode (center follows finger when at edge, for continuous rotation)
 * 
 * @param {Object} props
 * @param {string} props.position - 'left' or 'right' positioning
 * @param {function} props.onChange - Callback with analog {x, y, magnitude, active} values
 * @param {number} props.size - Size of the joystick in pixels (default: 120)
 * @param {boolean} props.infiniteDrag - If true, center follows finger at edge for infinite rotation (default: false)
 */
function VirtualJoystick({ position = 'left', onChange, size = 120, infiniteDrag = false }) {
  const containerRef = useRef(null)
  const [isActive, setIsActive] = useState(false)
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 })
  const [centerOffset, setCenterOffset] = useState({ x: 0, y: 0 })
  const touchIdRef = useRef(null)
  
  // Base center (original UI position) and dynamic center (follows finger)
  const baseCenterRef = useRef({ x: 0, y: 0 })
  const dynamicCenterRef = useRef({ x: 0, y: 0 })
  const centerReturnAnimRef = useRef(null)

  // Configuration constants
  const DEAD_ZONE_PX = 14 // Pixel-based dead zone threshold
  const CENTER_OFFSET_MAX = 14 // Max pixels the center can drift from base
  const CENTER_RETURN_FACTOR = 0.2 // Lerp factor for center return animation
  const maxDistance = size / 2 - 15 // Knob radius margin for visual clamping

  // Animate center back to original position when touch ends
  const animateCenterReturn = useCallback(() => {
    const current = { ...centerOffset }
    const targetX = 0
    const targetY = 0
    
    const newX = current.x + (targetX - current.x) * CENTER_RETURN_FACTOR
    const newY = current.y + (targetY - current.y) * CENTER_RETURN_FACTOR
    
    // Snap to zero if very close
    const finalX = Math.abs(newX) < 0.5 ? 0 : newX
    const finalY = Math.abs(newY) < 0.5 ? 0 : newY
    
    setCenterOffset({ x: finalX, y: finalY })
    
    // Continue animation if not at zero
    if (finalX !== 0 || finalY !== 0) {
      centerReturnAnimRef.current = requestAnimationFrame(animateCenterReturn)
    } else {
      centerReturnAnimRef.current = null
    }
  }, [centerOffset])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (centerReturnAnimRef.current) {
        cancelAnimationFrame(centerReturnAnimRef.current)
      }
    }
  }, [])

  const handleTouchStart = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Cancel any ongoing center return animation
    if (centerReturnAnimRef.current) {
      cancelAnimationFrame(centerReturnAnimRef.current)
      centerReturnAnimRef.current = null
    }
    
    // Only handle one touch at a time per joystick (multitouch isolation)
    if (touchIdRef.current !== null) return
    
    // Find a touch that started inside this joystick's container (hitbox check)
    const rect = containerRef.current.getBoundingClientRect()
    let validTouch = null
    
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i]
      if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
          touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        validTouch = touch
        break
      }
    }
    
    if (!validTouch) return
    
    touchIdRef.current = validTouch.identifier
    
    // Set base center (original UI position)
    baseCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    
    // Calculate dynamic center offset (center follows finger within radius)
    const offsetX = validTouch.clientX - baseCenterRef.current.x
    const offsetY = validTouch.clientY - baseCenterRef.current.y
    const offsetDist = Math.sqrt(offsetX * offsetX + offsetY * offsetY)
    
    let clampedOffsetX = offsetX
    let clampedOffsetY = offsetY
    if (offsetDist > CENTER_OFFSET_MAX) {
      const ratio = CENTER_OFFSET_MAX / offsetDist
      clampedOffsetX = offsetX * ratio
      clampedOffsetY = offsetY * ratio
    }
    
    // Set dynamic center
    dynamicCenterRef.current = {
      x: baseCenterRef.current.x + clampedOffsetX,
      y: baseCenterRef.current.y + clampedOffsetY
    }
    
    // Update visual center offset
    setCenterOffset({ x: clampedOffsetX, y: clampedOffsetY })
    
    setIsActive(true)
    
    // Calculate initial position relative to dynamic center
    const dx = validTouch.clientX - dynamicCenterRef.current.x
    const dy = validTouch.clientY - dynamicCenterRef.current.y
    updateKnobPosition(dx, dy)
  }, [])

  const handleTouchMove = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (touchIdRef.current === null) return
    
    // Find our specific touch by identifier (multitouch isolation)
    const touch = Array.from(e.touches).find(t => t.identifier === touchIdRef.current)
    if (!touch) return
    
    // Calculate position relative to current dynamic center
    let dx = touch.clientX - dynamicCenterRef.current.x
    let dy = touch.clientY - dynamicCenterRef.current.y
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy)
    
    // Infinite drag mode: when finger reaches edge, move center to follow (internally only)
    if (infiniteDrag && distanceFromCenter > maxDistance) {
      // Calculate how much the finger is beyond the edge
      const overflow = distanceFromCenter - maxDistance
      
      // Direction from center to finger
      const dirX = dx / distanceFromCenter
      const dirY = dy / distanceFromCenter
      
      // Move the dynamic center towards the finger by the overflow amount
      // This is internal only - the visual joystick stays in place
      dynamicCenterRef.current = {
        x: dynamicCenterRef.current.x + dirX * overflow,
        y: dynamicCenterRef.current.y + dirY * overflow
      }
      
      // Note: We do NOT update setCenterOffset here, so the joystick visually stays in place
      // while the internal center drifts to allow continuous rotation
      
      // Recalculate dx, dy relative to new center (finger is now at maxDistance)
      dx = touch.clientX - dynamicCenterRef.current.x
      dy = touch.clientY - dynamicCenterRef.current.y
    } else if (!infiniteDrag) {
      // Standard mode: center follows finger within limited radius from base
      const offsetX = touch.clientX - baseCenterRef.current.x
      const offsetY = touch.clientY - baseCenterRef.current.y
      const offsetDist = Math.sqrt(offsetX * offsetX + offsetY * offsetY)
      
      let clampedOffsetX = offsetX
      let clampedOffsetY = offsetY
      if (offsetDist > CENTER_OFFSET_MAX) {
        const ratio = CENTER_OFFSET_MAX / offsetDist
        clampedOffsetX = offsetX * ratio
        clampedOffsetY = offsetY * ratio
      }
      
      // Update dynamic center
      dynamicCenterRef.current = {
        x: baseCenterRef.current.x + clampedOffsetX,
        y: baseCenterRef.current.y + clampedOffsetY
      }
      
      // Update visual center offset
      setCenterOffset({ x: clampedOffsetX, y: clampedOffsetY })
      
      // Recalculate dx, dy relative to updated center
      dx = touch.clientX - dynamicCenterRef.current.x
      dy = touch.clientY - dynamicCenterRef.current.y
    }
    
    updateKnobPosition(dx, dy)
  }, [infiniteDrag, maxDistance])

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Check if our specific touch ended (multitouch isolation)
    const touchEnded = !Array.from(e.touches).some(t => t.identifier === touchIdRef.current)
    
    if (touchEnded) {
      touchIdRef.current = null
      setIsActive(false)
      setKnobPosition({ x: 0, y: 0 })
      // Reset to zero on touch release
      onChange?.({ x: 0, y: 0, magnitude: 0, active: false })
      
      // Start smooth center return animation
      if (centerOffset.x !== 0 || centerOffset.y !== 0) {
        centerReturnAnimRef.current = requestAnimationFrame(animateCenterReturn)
      }
    }
  }, [onChange, centerOffset, animateCenterReturn])

  const updateKnobPosition = useCallback((dx, dy) => {
    // Calculate distance from center in pixels
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Visual: Clamp knob position to max distance for display
    let visualX = dx
    let visualY = dy
    
    if (distance > maxDistance) {
      const ratio = maxDistance / distance
      visualX = dx * ratio
      visualY = dy * ratio
    }
    
    setKnobPosition({ x: visualX, y: visualY })
    
    // Apply pixel-based dead zone
    if (distance < DEAD_ZONE_PX) {
      // Inside dead zone - output zero
      onChange?.({ x: 0, y: 0, magnitude: 0, active: true })
      return
    }
    
    // Calculate analog output (magnitude varies with finger distance)
    // This enables non-linear response curve to work properly
    const dirX = dx / distance
    const dirY = dy / distance
    
    // Calculate magnitude as ratio of distance to maxDistance (0 to 1)
    // Subtract dead zone from distance for smoother transition
    const effectiveDistance = distance - DEAD_ZONE_PX
    const effectiveMaxDistance = maxDistance - DEAD_ZONE_PX
    const magnitude = Math.min(1, effectiveDistance / effectiveMaxDistance)
    
    // Output analog values: direction * magnitude
    // This gives smooth analog control where small movements = small magnitude
    const outputX = dirX * magnitude
    const outputY = dirY * magnitude
    
    // Ensure diagonal magnitude doesn't exceed 1.0
    const outputMag = Math.sqrt(outputX * outputX + outputY * outputY)
    const finalX = outputMag > 1 ? outputX / outputMag : outputX
    const finalY = outputMag > 1 ? outputY / outputMag : outputY
    const finalMag = Math.min(1, outputMag)
    
    onChange?.({ x: finalX, y: finalY, magnitude: finalMag, active: true })
  }, [maxDistance, onChange])

  // Add global touch listeners for better tracking
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: false })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const containerStyle = {
    width: size,
    height: size,
    [position]: 20,
  }

  // Apply dynamic center offset to the joystick base for visual feedback
  const baseStyle = {
    transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)`,
  }

  const knobStyle = {
    transform: `translate(${knobPosition.x}px, ${knobPosition.y}px)`,
    width: size * 0.4,
    height: size * 0.4,
  }

  return (
    <div 
      ref={containerRef}
      className={`virtual-joystick ${position} ${isActive ? 'active' : ''}`}
      style={containerStyle}
    >
      <div className="joystick-base" style={baseStyle}>
        <div className="joystick-knob" style={knobStyle} />
      </div>
    </div>
  )
}

export default VirtualJoystick
