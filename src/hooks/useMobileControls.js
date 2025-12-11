import { useRef, useCallback } from 'react'

/**
 * Professional-grade mobile control input state management
 * Implements PUBG-style smoothing with:
 * - Lerp interpolation (0.15 factor) for smooth transitions
 * - Separate target and current vectors for smooth decay
 * - Proper reset handling on touch release
 * 
 * @returns {Object} - { setMoveVec, setLookVec, getMoveVec, getLookVec, resetLook, updateSmoothing }
 */
export function useMobileControls() {
  // Target vectors (raw input from joysticks)
  const targetMoveVecRef = useRef({ x: 0, y: 0 })
  const targetLookVecRef = useRef({ x: 0, y: 0 })
  
  // Current smoothed vectors (what gets consumed by FPS controls)
  const currentMoveVecRef = useRef({ x: 0, y: 0 })
  const currentLookVecRef = useRef({ x: 0, y: 0 })
  
  // Active state tracking
  const moveActiveRef = useRef(false)
  const lookActiveRef = useRef(false)
  
  // Previous look vector for delta calculation (trackpad-style camera)
  const prevLookVecRef = useRef({ x: 0, y: 0 })
  
  // Smoothing configuration - separate factors for movement and look
  // Movement uses a lower factor (0.12) for smoother transitions near dead zone boundary
  // Too high causes jittery on/off movement, too low causes sluggish response
  const MOVE_SMOOTHING_FACTOR = 0.12 // Reduced from 0.20 to fix jittery movement near dead zone
  const LOOK_SMOOTHING_FACTOR = 0.15 // Lower lerp factor for smoother camera rotation
  const EPSILON = 0.001 // Threshold for considering value as zero

  /**
   * Linear interpolation helper
   */
  const lerp = (current, target, factor) => {
    return current + (target - current) * factor
  }

  /**
   * Set target movement vector from joystick
   * @param {Object} vec - { x, y, active } from VirtualJoystick
   */
  const setMoveVec = useCallback((vec) => {
    targetMoveVecRef.current = { x: vec.x, y: vec.y }
    moveActiveRef.current = vec.active !== false
    
    // If touch released, immediately stop movement (no inertia)
    // Reset both target AND current to zero so getMoveVec returns {0,0} immediately
    if (vec.active === false) {
      targetMoveVecRef.current = { x: 0, y: 0 }
      currentMoveVecRef.current = { x: 0, y: 0 }
      moveActiveRef.current = false
    }
  }, [])

  /**
   * Set target look vector from joystick
   * @param {Object} vec - { x, y, active } from VirtualJoystick
   */
  const setLookVec = useCallback((vec) => {
    targetLookVecRef.current = { x: vec.x, y: vec.y }
    // More robust active detection: also check magnitude to prevent stuck state
    // This helps on devices where touch events near screen edges may not fire reliably
    const mag = Math.sqrt(vec.x * vec.x + vec.y * vec.y)
    lookActiveRef.current = vec.active !== false || mag > 0.001
    
    // If touch released, immediately start decaying to zero
    if (vec.active === false) {
      targetLookVecRef.current = { x: 0, y: 0 }
    }
  }, [])

  /**
   * Get smoothed movement vector
   * Call this every frame to get interpolated values
   * @returns {Object} - { x, y } smoothed movement vector
   */
  const getMoveVec = useCallback(() => {
    const current = currentMoveVecRef.current
    const target = targetMoveVecRef.current
    
    // If joystick is released and target is zero, return zero immediately (no inertia)
    // This ensures the player stops moving the instant they release the joystick
    if (!moveActiveRef.current && target.x === 0 && target.y === 0) {
      currentMoveVecRef.current = { x: 0, y: 0 }
      return { x: 0, y: 0 }
    }
    
    // Apply lerp smoothing with movement-specific factor for smoother movement while active
    let smoothedX = lerp(current.x, target.x, MOVE_SMOOTHING_FACTOR)
    let smoothedY = lerp(current.y, target.y, MOVE_SMOOTHING_FACTOR)
    
    // Snap to zero if very close (prevents drift)
    if (Math.abs(smoothedX) < EPSILON) smoothedX = 0
    if (Math.abs(smoothedY) < EPSILON) smoothedY = 0
    
    // Update current for next frame
    currentMoveVecRef.current = { x: smoothedX, y: smoothedY }
    
    return { x: smoothedX, y: smoothedY }
  }, [])

  /**
   * Get smoothed look vector
   * Call this every frame to get interpolated values
   * @returns {Object} - { x, y } smoothed look vector
   */
  const getLookVec = useCallback(() => {
    // Apply lerp smoothing with look-specific factor for smoother camera rotation
    const current = currentLookVecRef.current
    const target = targetLookVecRef.current
    
    let smoothedX = lerp(current.x, target.x, LOOK_SMOOTHING_FACTOR)
    let smoothedY = lerp(current.y, target.y, LOOK_SMOOTHING_FACTOR)
    
    // Snap to zero if very close (prevents drift)
    if (Math.abs(smoothedX) < EPSILON) smoothedX = 0
    if (Math.abs(smoothedY) < EPSILON) smoothedY = 0
    
    // Update current for next frame
    currentLookVecRef.current = { x: smoothedX, y: smoothedY }
    
    return { x: smoothedX, y: smoothedY }
  }, [])

  /**
   * Get look delta (change since last frame) for trackpad-style camera rotation
   * Camera only rotates when finger is moving, not when held still
   * When joystick is released, returns {0, 0} so camera stays in place
   * @returns {Object} - { x, y } delta values
   */
  const getLookDelta = useCallback(() => {
    // If the look joystick is not active, do not generate any delta
    // This prevents the camera from "returning" when the user releases the joystick
    if (!lookActiveRef.current) {
      // Keep prev in sync with current so we don't get a jump on next activation
      prevLookVecRef.current = { ...currentLookVecRef.current }
      return { x: 0, y: 0 }
    }
    
    // When active, update the smoothed vector and compute delta
    const current = getLookVec()
    const prev = prevLookVecRef.current
    
    const dx = current.x - prev.x
    const dy = current.y - prev.y
    
    // Store current as previous for next frame
    prevLookVecRef.current = { x: current.x, y: current.y }
    
    return { x: dx, y: dy }
  }, [getLookVec])

  /**
   * Reset look vector immediately (for special cases)
   */
  const resetLook = useCallback(() => {
    targetLookVecRef.current = { x: 0, y: 0 }
    currentLookVecRef.current = { x: 0, y: 0 }
    prevLookVecRef.current = { x: 0, y: 0 }
    lookActiveRef.current = false
  }, [])

  /**
   * Reset movement vector immediately (for special cases)
   */
  const resetMove = useCallback(() => {
    targetMoveVecRef.current = { x: 0, y: 0 }
    currentMoveVecRef.current = { x: 0, y: 0 }
    moveActiveRef.current = false
  }, [])

  /**
   * Check if look joystick is currently active
   */
  const isLookActive = useCallback(() => {
    return lookActiveRef.current
  }, [])

  /**
   * Check if move joystick is currently active
   */
  const isMoveActive = useCallback(() => {
    return moveActiveRef.current
  }, [])

  return {
    setMoveVec,
    setLookVec,
    getMoveVec,
    getLookVec,
    getLookDelta,
    resetLook,
    resetMove,
    isLookActive,
    isMoveActive
  }
}

export default useMobileControls
