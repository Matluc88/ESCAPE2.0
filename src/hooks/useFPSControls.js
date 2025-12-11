import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ========================================
// NUOVO SISTEMA COLLISIONE - Variabili Globali
// ========================================
let penetratingFrames = 0
const MAX_PENETRATING_FRAMES_BEFORE_SNAP = 8  // Aumentato per ridurre snap prematuri
const PENETRATION_EPS = 0.05                   // Tolleranza 5cm (era 2cm)
const SKIP_ANTI_TUNNEL_FRAMES = 12             // Skip più lungo allo spawn
const SNAP_MIN_DELTA = 0.05                    // Esegui snap solo se delta > 5cm
const SNAP_LERP = 0.2                          // Lerp per snap smooth

/**
 * Professional-grade FPS controls with 3-node transform hierarchy
 * Implements PUBG/COD Mobile-style architecture to prevent joystick flipping and crashes
 * 
 * Transform Hierarchy:
 * - PlayerRoot: receives ONLY translation (movement)
 * - YawPivot (child of PlayerRoot): receives ONLY yaw rotation (horizontal)
 * - CameraRig (child of YawPivot): receives ONLY pitch rotation (vertical)
 * - Camera (child of CameraRig): attached here with local offset for bobbing
 * 
 * This architecture ensures:
 * - Movement direction is calculated from yaw ONLY (never pitch)
 * - No inverted controls or joystick flipping
 * - No NaN vectors at extreme pitch angles
 * - Stable camera rotation without crashes
 * 
 * @param {Array} collisionObjects - Array of Three.js meshes to check collisions against
 * @param {Object} mobileInput - Optional mobile input { getMoveVec, getLookVec, isLookActive } for touch controls
 * @param {Array} groundObjects - Optional array of Three.js meshes to use for ground detection (defaults to collisionObjects)
 * @param {Object} boundaryLimits - Optional boundary limits { minX, maxX, minZ, maxZ } to constrain player movement within house perimeter
 * @param {Object} initialPosition - Optional initial spawn position { x, y, z } for the player (defaults to { x: 0, y: 0, z: 5 })
 * @param {number} initialYaw - Optional initial yaw rotation in radians (defaults to 0, which faces -Z direction)
 * @param {number} eyeHeight - Optional eye height in scene units (defaults to 1.6 for standard human height, use scaled value for scaled models)
 * @param {number} collisionRadius - Optional collision radius in scene units (defaults to 0.3, use scaled value for scaled models)
 * @param {number} playerHeight - Optional player height in scene units (defaults to 1.8, use scaled value for scaled models)
 * @param {number} moveSpeed - Optional movement speed in scene units per second (defaults to 5.0, use scaled value for scaled models)
 * @returns {Object} - Controls state and methods
 */
export function useFPSControls(collisionObjects = [], mobileInput = null, groundObjects = null, boundaryLimits = null, initialPosition = null, initialYaw = 0, eyeHeight = 1.6, collisionRadius = 0.3, playerHeight = 1.8, moveSpeed = 5.0, disableGravity = false) {
  const { camera, gl, scene } = useThree()
  
  // Transform hierarchy refs
  const playerRootRef = useRef(null)
  const yawPivotRef = useRef(null)
  const cameraRigRef = useRef(null)
  const hierarchyInitializedRef = useRef(false)
  
  // Guard to prevent detectGround() from overriding Y on the first frame after spawn
  const hasSpawnedRef = useRef(false)
  
  // Rotation state (in radians)
  const yawRef = useRef(0)
  const pitchRef = useRef(0)
  
  // Desktop controls
  const keysPressed = useRef(new Set())
  const isPointerLockedRef = useRef(false)
  
  // Gamepad controls
  const gamepadIndexRef = useRef(null)
  const gamepadLookVecRef = useRef({ x: 0, y: 0 })
  const gamepadMoveVecRef = useRef({ x: 0, y: 0 })
  
  // Mobile detection - uses multiple methods for robustness
  const isMobile = useRef(false)
  const touchDetectedRef = useRef(false)
  
  // Throttling for camera updates (60Hz max)
  const lastLookUpdateTimeRef = useRef(0)
  const LOOK_UPDATE_INTERVAL = 1 / 60
  
  // Sensitivity configuration (PUBG-style)
  const MOBILE_MOVE_SENSITIVITY = 1.8 // Increased from 1.2 for faster mobile movement response
  const MOBILE_LOOK_SENSITIVITY = 0.25
  const DESKTOP_LOOK_SENSITIVITY = 0.002
  
  // Gamepad sensitivity configuration - smooth and soft feel
  // GAMEPAD_LOOK_SPEED is in radians per second at full stick deflection
  const GAMEPAD_LOOK_SPEED = 2.5 // ~143 degrees/sec - smooth but responsive
  const GAMEPAD_MOVE_SENSITIVITY = 1.0 // Full speed for responsive movement (was 0.8)
  // Separate dead zones for different axes:
  // - Horizontal look (X): low dead zone for smooth continuous rotation
  // - Vertical look (Y): higher dead zone to filter out R3 click noise
  // - Movement: lower dead zone for smoother start of movement
  const GAMEPAD_LOOK_DEAD_ZONE_X = 0.08 // Low dead zone for horizontal rotation
  const GAMEPAD_LOOK_DEAD_ZONE_Y = 0.18 // Higher dead zone for vertical - filters R3 click noise
  const GAMEPAD_MOVE_DEAD_ZONE = 0.10 // Reduced dead zone for smoother movement start (was 0.15)
  const GAMEPAD_RESPONSE_CURVE = 1.2 // Gentler curve for smoother low-speed control
  
  // Non-linear response curve exponent
  // Reduced from 1.8 to 1.5 for smoother speed ramp-up at movement start
  const RESPONSE_CURVE_EXPONENT = 1.5
  
  // Pitch limits (+-80 degrees in radians)
  const MAX_PITCH = (80 * Math.PI) / 180
  const MIN_PITCH = -(80 * Math.PI) / 180
  
  // Head bobbing toggle - set to false to disable camera bobbing when walking
  const ENABLE_HEAD_BOBBING = false
  
  // --- TUNING ANTI-JITTER (Movimento Fluido) ---
  
  // Aumenta la tolleranza: ignoriamo penetrazioni sotto i 10cm
  const PENETRATION_THRESHOLD = 0.1
  
  // ========================================
  // DIAGNOSTIC: Temporary threshold adjustment to test if geometry is the issue
  // Set to true to use more permissive threshold (radius - 0.10 instead of radius)
  // If movement resumes with this enabled, the problem is geometry, not code
  // ========================================
  const DIAGNOSTIC_PERMISSIVE_THRESHOLD = false
  const DIAGNOSTIC_THRESHOLD_OFFSET = DIAGNOSTIC_PERMISSIVE_THRESHOLD ? -0.10 : 0
  
  // Camera collision configuration - ANTI-JITTER: valori molto morbidi
  const CAMERA_COLLISION_RADIUS = collisionRadius * 0.25 // Ridotto per non sbattere sugli stipiti
  const CAMERA_MIN_DISTANCE_FROM_WALL = 0.01 // Quasi zero per evitare respingimenti improvvisi
  const CAMERA_CORRECTION_LERP_FACTOR = 0.05 // MOLTO BASSO: correzione fluida, meno scattosa
  const ANTI_TUNNELLING_STEPS = 3 // Ridotto per alleggerire il calcolo
  
  // ========================================
  // DEBUG CONFIGURATION
  // Set CAMERA_DEBUG to true to enable collision debugging
  // In production, this should be false to avoid console spam
  // ========================================
  const CAMERA_DEBUG = true // ATTIVATO per debug collisioni
  const CAMERA_DEBUG_FLAGS = {
    sphereCast: false,       // Log sphere-cast hits, distances, directions (VERBOSE)
    antiTunnelling: false,   // Log anti-tunnelling checks (VERBOSE)
    updateOrder: false,      // Log complete update order per frame (VERBOSE)
    filtering: false,        // Log excluded objects and reasons (VERBOSE)
    proximity: false,        // Log proximity alerts (VERBOSE)
    colliderQuality: true,   // Log collider mesh quality info (UTILE - solo 1x per object)
    gizmos: false            // Enable visual gizmos (requires DebugGizmos component)
  }
  
  // Frame counter for debug logging
  const frameIdRef = useRef(0)
  
  // WeakSet to track already-logged filtered objects (avoid spam)
  const loggedFilteredObjectsRef = useRef(new WeakSet())
  
  // WeakSet to track already-logged collider quality info
  const loggedColliderQualityRef = useRef(new WeakSet())
  
  // Debug data for gizmos (exposed via ref for external components)
  const debugDataRef = useRef({
    sphereCastRays: [],      // Array of {origin, direction, length, hit, hitPoint, normal}
    proximityAlerts: [],     // Array of {position, direction, distance}
    lastFrameId: 0
  })
  
  // Store previous position for anti-tunnelling and lerp
  const previousPositionRef = useRef(new THREE.Vector3())
  const targetPositionRef = useRef(new THREE.Vector3())
  const isFirstFrameRef = useRef(true)
  
  // Penetration tracking for fallback snap
  const penetratingFramesRef = useRef(0)
  const MAX_PENETRATING_FRAMES_BEFORE_SNAP = 6
  const PENETRATION_EPS = 0.02
  const SKIP_ANTI_TUNNEL_FRAMES = 10
  const frameCountRef = useRef(0)
  
  const playerConfig = useRef({
    radius: collisionRadius,
    height: playerHeight,
    eyeHeight: eyeHeight,
    moveSpeed: moveSpeed,
    isMoving: false,
    cameraCollisionRadius: CAMERA_COLLISION_RADIUS
  })
  
  // Sync playerConfig when props change (useRef only captures initial values)
  // This is critical for dynamic scaling - when modelScale updates, we need to update the config
  useEffect(() => {
    playerConfig.current.radius = collisionRadius
    playerConfig.current.height = playerHeight
    playerConfig.current.eyeHeight = eyeHeight
    playerConfig.current.moveSpeed = moveSpeed
    playerConfig.current.cameraCollisionRadius = collisionRadius * 0.5
    console.log('[FPS Controls] Updated playerConfig from props:', {
      moveSpeed,
      collisionRadius,
      playerHeight,
      eyeHeight
    })
  }, [moveSpeed, collisionRadius, playerHeight, eyeHeight])
  
  // Log collision objects when they change - helps debug collision issues
  useEffect(() => {
    console.log('[FPS Controls] collisionObjects updated:', collisionObjects.length)
    if (collisionObjects.length > 0) {
      console.log('[FPS Controls] First 5 collidable objects:', collisionObjects.slice(0, 5).map(o => ({
        name: o.name,
        userData: o.userData
      })))
    }
  }, [collisionObjects])
  
  const bobbingState = useRef({
    time: 0,
    baseY: 0,
    verticalAmplitude: 0.065,
    horizontalAmplitude: 0.0325,
    frequency: 10,
    currentBobY: 0,
    currentBobX: 0,
    currentTilt: 0
  })
  
  const raycaster = useRef(new THREE.Raycaster())
  
  // Initialize the 3-node transform hierarchy
  useEffect(() => {
    if (hierarchyInitializedRef.current) return
    
    // Create the hierarchy nodes
    const playerRoot = new THREE.Group()
    playerRoot.name = 'PlayerRoot'
    
    const yawPivot = new THREE.Group()
    yawPivot.name = 'YawPivot'
    
    const cameraRig = new THREE.Group()
    cameraRig.name = 'CameraRig'
    
    // Build hierarchy: PlayerRoot -> YawPivot -> CameraRig -> Camera
    playerRoot.add(yawPivot)
    yawPivot.add(cameraRig)
    
    // Remove camera from its current parent and add to cameraRig
    if (camera.parent) {
      camera.parent.remove(camera)
    }
    cameraRig.add(camera)
    
    // Add playerRoot to scene
    scene.add(playerRoot)
    
    // Set initial positions - use initialPosition if provided, otherwise default to (0, 0, 5)
    // Architecture: playerRoot.y = feet/ground, cameraRig.y = eye height, camera.y = bobbing only
    const spawnPos = initialPosition || { x: 0, y: 0, z: 5 }
    playerRoot.position.set(spawnPos.x, spawnPos.y, spawnPos.z)
    yawPivot.position.set(0, 0, 0)
    cameraRig.position.set(0, playerConfig.current.eyeHeight, 0)  // Eye height on cameraRig
    camera.position.set(0, 0, 0)  // Camera local Y is for bobbing only
    
    // Reset camera rotation (rotation is now handled by yawPivot and cameraRig)
    camera.rotation.set(0, 0, 0)
    
    // Apply initial yaw rotation
    yawRef.current = initialYaw
    yawPivot.rotation.y = initialYaw
    
    // Store refs
    playerRootRef.current = playerRoot
    yawPivotRef.current = yawPivot
    cameraRigRef.current = cameraRig
    hierarchyInitializedRef.current = true
    
    // Detect touch capability using multiple methods
    const detectTouchDevice = () => {
      if (typeof window === 'undefined') return false
      
      // Method 1: Touch events support
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      // Method 2: Pointer type detection (coarse = touch, fine = mouse)
      const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches
      
      // Method 3: User agent detection (fallback)
      const ua = navigator.userAgent || ''
      const uaLooksMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      
      return hasTouch || hasCoarsePointer || uaLooksMobile
    }
    
    touchDetectedRef.current = detectTouchDevice()
    // Mobile mode is active if we have mobileInput AND touch is detected
    isMobile.current = !!mobileInput && touchDetectedRef.current
    
    console.log('[FPS Controls] Touch detection:', {
      touchDetected: touchDetectedRef.current,
      hasMobileInput: !!mobileInput,
      isMobileMode: isMobile.current
    })
    
    return () => {
      // Cleanup: restore camera to scene root
      if (cameraRig && camera) {
        cameraRig.remove(camera)
        scene.add(camera)
      }
      if (playerRoot) {
        scene.remove(playerRoot)
      }
      hierarchyInitializedRef.current = false
    }
  }, [camera, scene])
  
  // Reposition player when initialPosition changes (e.g., when model finishes loading and positioning)
  useEffect(() => {
    if (!playerRootRef.current || !cameraRigRef.current || !initialPosition) {
      console.log('[FPS Controls] ⚠️ Skipping reposition - missing refs or initialPosition:', {
        hasPlayerRoot: !!playerRootRef.current,
        hasCameraRig: !!cameraRigRef.current,
        hasInitialPosition: !!initialPosition,
        initialPosition
      });
      return
    }
    
    // Architecture: playerRoot.y = feet/ground, cameraRig.y = eye height, camera.y = bobbing only
    const CAMERA_EYE_LEVEL = playerConfig.current.eyeHeight
    
    console.log('[FPS Controls] 🎯 REPOSITIONING PLAYER TO:', initialPosition, '| eyeHeight:', CAMERA_EYE_LEVEL)
    playerRootRef.current.position.set(
      initialPosition.x,
      initialPosition.y || 0,
      initialPosition.z
    )
    
    // Set eye height on cameraRig, not on camera
    cameraRigRef.current.position.y = CAMERA_EYE_LEVEL
    camera.position.set(0, 0, 0)  // Camera local Y is for bobbing only
    
    // Set the spawn guard to prevent detectGround from overriding Y on first frame
    hasSpawnedRef.current = true
    
    // Log final positions for verification
    console.log('✅ FINAL Player root position:', {
      x: playerRootRef.current.position.x,
      y: playerRootRef.current.position.y,
      z: playerRootRef.current.position.z
    })
    console.log('✅ FINAL CameraRig position.y (eyeHeight):', cameraRigRef.current.position.y)
    console.log('✅ FINAL Camera position (local Y for bobbing):', camera.position.y)
    console.log('✅ FINAL Camera position (world Y):', playerRootRef.current.position.y + cameraRigRef.current.position.y + camera.position.y)
  }, [initialPosition, camera, eyeHeight])
  
  // Update yaw when initialYaw changes (e.g., when model finishes loading and we calculate the direction to face)
  useEffect(() => {
    if (!yawPivotRef.current || initialYaw === undefined) return
    
    console.log('[FPS Controls] Setting initial yaw to:', initialYaw, 'radians')
    yawRef.current = initialYaw
    yawPivotRef.current.rotation.y = initialYaw
  }, [initialYaw])
  
  // Update cameraRig Y position when eyeHeight changes (e.g., when model scale is calculated)
  // This ensures the scaled eyeHeight is applied to the cameraRig position
  // Architecture: playerRoot.y = feet/ground, cameraRig.y = eye height, camera.y = bobbing only
  useEffect(() => {
    if (!hierarchyInitializedRef.current || !cameraRigRef.current) return
    
    // Update cameraRig Y position to use the new scaled eyeHeight
    cameraRigRef.current.position.y = playerConfig.current.eyeHeight
    // Camera local Y is for bobbing only - keep current bobbing offset
    camera.position.y = bobbingState.current.baseY + bobbingState.current.currentBobY
    
    console.log('[FPS Controls] Re-applied eyeHeight to cameraRig:', {
      eyeHeight: playerConfig.current.eyeHeight,
      cameraRigY: cameraRigRef.current.position.y,
      cameraLocalY: camera.position.y
    })
  }, [eyeHeight, camera])
  
  // Setup desktop controls (mouse look and keyboard)
  useEffect(() => {
    if (isMobile.current) return
    
    const handleClick = () => {
      gl.domElement.requestPointerLock()
    }
    
    const handlePointerLockChange = () => {
      isPointerLockedRef.current = document.pointerLockElement === gl.domElement
    }
    
    const handleMouseMove = (event) => {
      if (!isPointerLockedRef.current) return
      
      // Update yaw (horizontal rotation) - applied to YawPivot
      yawRef.current -= event.movementX * DESKTOP_LOOK_SENSITIVITY
      
      // Update pitch (vertical rotation) - applied to CameraRig
      pitchRef.current -= event.movementY * DESKTOP_LOOK_SENSITIVITY
      
      // Clamp pitch to prevent over-rotation
      pitchRef.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitchRef.current))
    }
    
    const handleKeyDown = (event) => {
      keysPressed.current.add(event.code.toLowerCase())
    }
    
    const handleKeyUp = (event) => {
      keysPressed.current.delete(event.code.toLowerCase())
    }
    
    gl.domElement.addEventListener('click', handleClick)
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      gl.domElement.removeEventListener('click', handleClick)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [gl, mobileInput])
  
  // Update mobile flag when mobileInput changes
  useEffect(() => {
    // Re-detect touch capability when mobileInput changes
    const detectTouchDevice = () => {
      if (typeof window === 'undefined') return false
      
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches
      const ua = navigator.userAgent || ''
      const uaLooksMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      
      return hasTouch || hasCoarsePointer || uaLooksMobile
    }
    
    touchDetectedRef.current = detectTouchDevice()
    isMobile.current = !!mobileInput && touchDetectedRef.current
  }, [mobileInput])
  
  // Setup gamepad controls
  useEffect(() => {
    const handleGamepadConnected = (event) => {
      console.log('[FPS Controls] Gamepad connected:', event.gamepad.id)
      gamepadIndexRef.current = event.gamepad.index
    }
    
    const handleGamepadDisconnected = (event) => {
      console.log('[FPS Controls] Gamepad disconnected:', event.gamepad.id)
      if (gamepadIndexRef.current === event.gamepad.index) {
        gamepadIndexRef.current = null
        gamepadLookVecRef.current = { x: 0, y: 0 }
        gamepadMoveVecRef.current = { x: 0, y: 0 }
      }
    }
    
    // Check for already connected gamepads
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        console.log('[FPS Controls] Found existing gamepad:', gamepads[i].id)
        gamepadIndexRef.current = gamepads[i].index
        break
      }
    }
    
    window.addEventListener('gamepadconnected', handleGamepadConnected)
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected)
    
    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected)
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected)
    }
  }, [])
  
  /**
   * Apply dead zone and smoothing to gamepad axis value
   * @param {number} value - Raw axis value (-1 to 1)
   * @param {number} deadZone - Dead zone threshold
   * @returns {number} - Processed value with dead zone applied
   */
  const applyDeadZone = (value, deadZone) => {
    if (Math.abs(value) < deadZone) return 0
    // Remap value from [deadZone, 1] to [0, 1] for smooth transition
    const sign = value > 0 ? 1 : -1
    return sign * ((Math.abs(value) - deadZone) / (1 - deadZone))
  }
  
  /**
   * Poll gamepad and update look/move vectors
   * No smoothing applied here - values are used directly as velocity multipliers
   * This ensures continuous rotation when stick is held at max position
   */
  const pollGamepad = () => {
    if (gamepadIndexRef.current === null) return
    
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
    const gamepad = gamepads[gamepadIndexRef.current]
    
    if (!gamepad) return
    
    // Standard gamepad mapping:
    // axes[0] = Left stick X (left/right)
    // axes[1] = Left stick Y (up/down)
    // axes[2] = Right stick X (left/right) - camera yaw
    // axes[3] = Right stick Y (up/down) - camera pitch
    
    // Right stick for camera look
    // X axis: low dead zone for smooth continuous horizontal rotation
    // Y axis: higher dead zone to filter out noise when pressing R3 (stick click)
    const rawLookX = gamepad.axes[2] || 0
    const rawLookY = gamepad.axes[3] || 0
    gamepadLookVecRef.current.x = applyDeadZone(rawLookX, GAMEPAD_LOOK_DEAD_ZONE_X)
    gamepadLookVecRef.current.y = applyDeadZone(rawLookY, GAMEPAD_LOOK_DEAD_ZONE_Y)
    
    // Left stick for movement (higher dead zone to prevent drift when centered)
    const rawMoveX = gamepad.axes[0] || 0
    const rawMoveY = gamepad.axes[1] || 0
    gamepadMoveVecRef.current.x = applyDeadZone(rawMoveX, GAMEPAD_MOVE_DEAD_ZONE)
    gamepadMoveVecRef.current.y = applyDeadZone(rawMoveY, GAMEPAD_MOVE_DEAD_ZONE)
  }
  
  /**
   * Check if an object should be included in collision detection
   * Filters out triggers, particles, lights, and decorative objects
   * @param {THREE.Object3D} object - The object to check
   * @returns {boolean} - True if object should be used for collision
   */
  const isCollidableObject = (object) => {
    if (!object || !object.userData) return true
    
    // Skip objects explicitly marked as non-collidable
    let filterReason = null
    if (object.userData.trigger === true) filterReason = 'trigger=true'
    else if (object.userData.particle === true) filterReason = 'particle=true'
    else if (object.userData.light === true) filterReason = 'light=true'
    else if (object.userData.decorative === true) filterReason = 'decorative=true'
    else if (object.userData.noCollision === true) filterReason = 'noCollision=true'
    else if (object.userData.solid === false) filterReason = 'solid=false'
    else if (object.userData.collidable === false) filterReason = 'collidable=false'
    
    if (filterReason) {
      // Log filtered object (only once per object to avoid spam)
      if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.filtering && !loggedFilteredObjectsRef.current.has(object)) {
        loggedFilteredObjectsRef.current.add(object)
        console.log(`[Collision][Filter] Excluding object: "${object.name || 'unnamed'}" | reason: ${filterReason} | userData:`, object.userData)
      }
      return false
    }
    
    // Check for anomalous userData (both solid and noCollision set, etc.)
    if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.filtering && !loggedFilteredObjectsRef.current.has(object)) {
      const hasAnomalousData = (object.userData.solid === true && object.userData.noCollision === true) ||
                               (object.userData.collidable === true && object.userData.noCollision === true)
      if (hasAnomalousData) {
        loggedFilteredObjectsRef.current.add(object)
        console.warn(`[Collision][Filter] ANOMALOUS userData on object: "${object.name || 'unnamed'}" | userData:`, object.userData)
      }
    }
    
    // Include objects marked as solid or collidable, or objects without explicit marking
    return true
  }
  
  /**
   * Filter collision objects to only include solid objects
   * Also logs collider quality information (normals, bounding box) for debugging
   * @param {Array} objects - Array of objects to filter
   * @returns {Array} - Filtered array of collidable objects
   */
  const getFilteredCollisionObjects = (objects) => {
    const filtered = objects.filter(obj => isCollidableObject(obj))
    
    // Log collider quality info (only once per object)
    if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.colliderQuality) {
      for (const obj of filtered) {
        if (!loggedColliderQualityRef.current.has(obj)) {
          loggedColliderQualityRef.current.add(obj)
          
          // Check mesh quality
          if (obj.isMesh && obj.geometry) {
            const geo = obj.geometry
            const hasNormals = !!geo.attributes.normal
            const hasIndices = !!geo.index
            const vertexCount = geo.attributes.position ? geo.attributes.position.count : 0
            
            // Compute bounding box if not already computed
            if (!geo.boundingBox) {
              geo.computeBoundingBox()
            }
            
            const bbox = geo.boundingBox
            const bboxSize = bbox ? new THREE.Vector3().subVectors(bbox.max, bbox.min) : null
            
            // Log quality info
            console.log(`[Collision][ColliderQuality] "${obj.name || 'unnamed'}" | vertices: ${vertexCount} | hasNormals: ${hasNormals} | hasIndices: ${hasIndices} | bbox: ${bboxSize ? `(${bboxSize.x.toFixed(2)}, ${bboxSize.y.toFixed(2)}, ${bboxSize.z.toFixed(2)})` : 'N/A'}`)
            
            // Warn if normals are missing
            if (!hasNormals) {
              console.warn(`[Collision][ColliderQuality] WARNING: "${obj.name || 'unnamed'}" has NO NORMALS - collision detection may be unreliable!`)
              // Try to compute normals as a safety net
              try {
                geo.computeVertexNormals()
                console.log(`[Collision][ColliderQuality] Computed vertex normals for "${obj.name || 'unnamed'}"`)
              } catch (e) {
                console.error(`[Collision][ColliderQuality] Failed to compute normals for "${obj.name || 'unnamed'}":`, e)
              }
            }
            
            // Warn if bounding box is suspiciously small or large
            if (bboxSize) {
              const minDim = Math.min(bboxSize.x, bboxSize.y, bboxSize.z)
              const maxDim = Math.max(bboxSize.x, bboxSize.y, bboxSize.z)
              if (minDim < 0.01) {
                console.warn(`[Collision][ColliderQuality] WARNING: "${obj.name || 'unnamed'}" has very thin dimension (${minDim.toFixed(4)}) - may cause tunnelling!`)
              }
              if (maxDim > 1000) {
                console.warn(`[Collision][ColliderQuality] WARNING: "${obj.name || 'unnamed'}" has very large dimension (${maxDim.toFixed(2)}) - may be incorrectly scaled!`)
              }
            }
          }
        }
      }
    }
    
    return filtered
  }
  
  /**
   * Helper: Get world position origin for collision tests
   * Always uses playerRoot.getWorldPosition for accurate world coordinates
   */
  const getCollisionOrigin = (playerRoot, camera) => {
    const origin = new THREE.Vector3()
    if (playerRoot) {
      playerRoot.getWorldPosition(origin)
    } else {
      camera.getWorldPosition(origin)
    }
    return origin
  }
  
  /**
   * Helper: Ensure colliders are ready with updated matrices and bounding boxes
   */
  const ensureCollidersReady = (collisionObjects) => {
    if (!collisionObjects || !collisionObjects.length) return
    collisionObjects.forEach(m => {
      if (m.geometry && !m.geometry.boundingBox) {
        try { 
          m.geometry.computeBoundingBox() 
        } catch (e) {
          // Silent fail - some geometries may not support bounding box
        }
      }
      m.updateMatrixWorld(true)
    })
  }
  
  /**
   * Helper: Filter hits to ignore floor when casting downward from low heights
   */
  const filterHits = (hits, origin, sphereHeight) => {
    const EPS = 0.01
    return hits.filter(h => {
      if (!h || !h.object) return false
      // Ignore hits that are too close (numerical noise)
      if (h.distance !== undefined && h.distance < EPS) return false
      
      // Check if this is a downward ray hitting ground from low height
      const dir = origin.clone().sub(h.point).normalize()
      const isDownward = dir.y > 0.7
      const obj = h.object
      
      // If object is marked as ground and we're casting downward from low height, ignore it
      if (obj.userData && obj.userData.ground) {
        if (sphereHeight < 0.15 && isDownward) {
          if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.filtering) {
            console.log(`[Collision][GroundFilter] IGNORA ground downward: "${obj.name || 'unnamed'}" | height=${sphereHeight.toFixed(2)} | downward=${isDownward}`)
          }
          return false
        }
      }
      
      return true
    })
  }
  
  /**
   * Helper: Compute penetration with epsilon tolerance
   */
  const computePenetration = (minDist, threshold) => {
    const minDistAdjusted = minDist - PENETRATION_EPS
    const isPenetrating = minDistAdjusted < threshold
    return { minDistAdjusted, isPenetrating }
  }
  
  /**
   * Check collision in a specific direction using raycasting
   * @param {THREE.Vector3} position - Current position
   * @param {THREE.Vector3} direction - Direction to check
   * @param {number} distance - Distance to check
   * @param {boolean} filterObjects - Whether to filter out non-collidable objects (default: true)
   * @returns {Object|null} - Intersection object or null
   */
  const checkCollision = (position, direction, distance, filterObjects = true) => {
    raycaster.current.set(position, direction)
    raycaster.current.far = distance
    
    const objectsToCheck = filterObjects ? getFilteredCollisionObjects(collisionObjects) : collisionObjects
    const intersections = raycaster.current.intersectObjects(objectsToCheck, true)
    
    // Filter results to only include collidable objects
    for (let i = 0; i < intersections.length; i++) {
      if (isCollidableObject(intersections[i].object)) {
        return intersections[i]
      }
    }
    return null
  }
  
  /**
   * Perform sphere-cast-like collision detection using multiple rays
   * Simulates a sphere moving through space by casting rays from multiple points on the sphere surface
   * @param {THREE.Vector3} position - Center position of the sphere
   * @param {number} radius - Radius of the collision sphere
   * @param {THREE.Vector3} direction - Direction to check (optional, if null checks all directions)
   * @param {number} distance - Distance to check
   * @returns {Object|null} - Closest intersection object or null
   */
  const sphereCast = (position, radius, direction, distance) => {
    let closestHit = null
    let closestDistance = Infinity
    let hitCount = 0
    let totalRays = 0
    let hitDirection = null
    const debugRays = [] // For gizmo visualization
    
    // If direction is provided, cast rays from sphere surface in that direction
    if (direction && direction.lengthSq() > 0.0001) {
      const normalizedDir = direction.clone().normalize()
      
      // Create perpendicular vectors for the sphere surface sampling
      const up = new THREE.Vector3(0, 1, 0)
      let perpX = new THREE.Vector3().crossVectors(normalizedDir, up)
      if (perpX.lengthSq() < 0.0001) {
        perpX = new THREE.Vector3(1, 0, 0)
      }
      perpX.normalize()
      const perpY = new THREE.Vector3().crossVectors(normalizedDir, perpX).normalize()
      
      // Sample points on the sphere surface facing the direction (increased samples)
      // 8 angles instead of 4 for better coverage
      const sampleAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4]
      const sampleRadii = [0, radius * 0.33, radius * 0.66, radius]
      
      for (const r of sampleRadii) {
        for (const angle of sampleAngles) {
          const offsetX = Math.cos(angle) * r
          const offsetY = Math.sin(angle) * r
          const samplePos = position.clone()
            .add(perpX.clone().multiplyScalar(offsetX))
            .add(perpY.clone().multiplyScalar(offsetY))
          
          totalRays++
          const hit = checkCollision(samplePos, normalizedDir, distance + radius)
          
          // Store debug ray data for gizmos
          if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.gizmos) {
            debugRays.push({
              origin: samplePos.clone(),
              direction: normalizedDir.clone(),
              length: distance + radius,
              hit: !!hit,
              hitPoint: hit ? hit.point.clone() : null,
              normal: hit && hit.face ? hit.face.normal.clone() : null
            })
          }
          
          if (hit && hit.distance < closestDistance) {
            hitCount++
            closestDistance = hit.distance
            closestHit = hit
            hitDirection = normalizedDir.clone()
          }
        }
      }
    } else {
      // Check all directions (radial sphere cast) - increased from 8 to 16 horizontal
      const directions = []
      // Horizontal directions (16 directions for better coverage)
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2
        directions.push({ dir: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)), name: `H${i}` })
      }
      // Vertical directions
      directions.push({ dir: new THREE.Vector3(0, 1, 0), name: 'UP' })
      directions.push({ dir: new THREE.Vector3(0, -1, 0), name: 'DOWN' })
      // Diagonal directions (8 up, 8 down for better vertical coverage)
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        directions.push({ dir: new THREE.Vector3(Math.cos(angle) * 0.707, 0.707, Math.sin(angle) * 0.707), name: `DU${i}` })
        directions.push({ dir: new THREE.Vector3(Math.cos(angle) * 0.707, -0.707, Math.sin(angle) * 0.707), name: `DD${i}` })
      }
      
      for (const { dir, name } of directions) {
        totalRays++
        const hit = checkCollision(position, dir, distance)
        
        // Store debug ray data for gizmos
        if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.gizmos) {
          debugRays.push({
            origin: position.clone(),
            direction: dir.clone(),
            length: distance,
            hit: !!hit,
            hitPoint: hit ? hit.point.clone() : null,
            normal: hit && hit.face ? hit.face.normal.clone() : null,
            name: name
          })
        }
        
        if (hit && hit.distance < closestDistance) {
          hitCount++
          closestDistance = hit.distance
          closestHit = hit
          hitDirection = dir.clone()
        }
      }
    }
    
    // Log sphere-cast results (only when there are hits to avoid spam)
    if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.sphereCast && hitCount > 0) {
      const frameId = frameIdRef.current
      console.log(`[Collision][Frame ${frameId}][SphereCast] hits: ${hitCount}/${totalRays} | minDist: ${closestDistance.toFixed(3)} | hitDir: ${hitDirection ? `(${hitDirection.x.toFixed(2)}, ${hitDirection.y.toFixed(2)}, ${hitDirection.z.toFixed(2)})` : 'N/A'} | origin: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) | prevPos: (${previousPositionRef.current.x.toFixed(2)}, ${previousPositionRef.current.y.toFixed(2)}, ${previousPositionRef.current.z.toFixed(2)}) | object: "${closestHit?.object?.name || 'unnamed'}"`)
    }
    
    // Store debug rays for gizmo visualization
    if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.gizmos) {
      debugDataRef.current.sphereCastRays = debugRays
      debugDataRef.current.lastFrameId = frameIdRef.current
    }
    
    return closestHit
  }
  
  
  /**
   * Camera wall clamping: push camera away from walls if too close
   * Includes proximity alert system for immediate push-back when camera is dangerously close
   * @param {THREE.Vector3} position - Current camera/player position
   * @param {number} radius - Collision radius
   * @returns {THREE.Vector3} - Corrected position
   */
  const clampCameraFromWalls = (position, radius) => {
    const correctedPosition = position.clone()
    const minDistance = radius + CAMERA_MIN_DISTANCE_FROM_WALL
    const proximityAlertThreshold = radius // Alert when closer than radius
    const frameId = frameIdRef.current
    
    // Check all horizontal directions for nearby walls
    const directions = []
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2
      directions.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)))
    }
    
    let totalCorrection = new THREE.Vector3()
    let correctionCount = 0
    const proximityAlerts = []
    
    for (const dir of directions) {
      const hit = checkCollision(position, dir, minDistance)
      if (hit) {
        // ========================================
        // PROXIMITY ALERT: Camera is dangerously close to wall
        // Apply immediate push-back when below radius threshold
        // ========================================
        if (hit.distance < proximityAlertThreshold) {
          // CRITICAL: Camera is inside or very close to collision radius
          const pushDistance = proximityAlertThreshold - hit.distance + CAMERA_MIN_DISTANCE_FROM_WALL
          const pushVector = dir.clone().negate().multiplyScalar(pushDistance)
          
          // Apply immediate correction (not averaged)
          correctedPosition.add(pushVector)
          
          // Log proximity alert
          if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.proximity) {
            console.warn(`[Collision][Frame ${frameId}][PROXIMITY ALERT] dist: ${hit.distance.toFixed(3)} < radius: ${proximityAlertThreshold.toFixed(3)} | dir: (${dir.x.toFixed(2)}, ${dir.z.toFixed(2)}) | pushBack: ${pushDistance.toFixed(3)} | object: "${hit.object?.name || 'unnamed'}"`)
          }
          
          // Store for gizmo visualization
          proximityAlerts.push({
            position: position.clone(),
            direction: dir.clone(),
            distance: hit.distance,
            pushDistance: pushDistance,
            hitPoint: hit.point.clone()
          })
        } else if (hit.distance < minDistance) {
          // Wall is close but not critical - use averaged correction
          const pushDistance = minDistance - hit.distance
          const pushVector = dir.clone().negate().multiplyScalar(pushDistance)
          totalCorrection.add(pushVector)
          correctionCount++
        }
      }
    }
    
    if (correctionCount > 0) {
      // Average the non-critical corrections and apply
      totalCorrection.divideScalar(correctionCount)
      correctedPosition.add(totalCorrection)
      
      if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.proximity) {
        console.log(`[Collision][Frame ${frameId}][Clamping] ${correctionCount} walls nearby | avgCorrection: (${totalCorrection.x.toFixed(3)}, ${totalCorrection.z.toFixed(3)})`)
      }
    }
    
    // Store proximity alerts for gizmo visualization
    if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.gizmos) {
      debugDataRef.current.proximityAlerts = proximityAlerts
    }
    
    return correctedPosition
  }
  
  /**
   * Check collisions in 8 radial directions around the player
   * Only returns collisions that are actually penetrating (closer than player radius)
   * This prevents getting stuck on columns/curved surfaces where nearby geometry triggers false positives
   * @param {THREE.Vector3} newPosition - Proposed new position
   * @param {number} movementDistance - How far the player moved this frame (to prevent tunneling)
   * @param {boolean} onlyPenetrating - If true, only return collisions closer than player radius (default: true)
   * @returns {Array} - Array of collision objects
   */
  const checkRadialCollisions = (newPosition, movementDistance = 0, onlyPenetrating = true) => {
    const collisions = []
    // Extend check distance based on movement to prevent tunneling through walls
    // This ensures we detect walls even if we moved past them in a single frame
    const baseCheckDistance = playerConfig.current.radius + 0.1
    const checkDistance = baseCheckDistance + movementDistance
    const penetrationDistance = playerConfig.current.radius - PENETRATION_THRESHOLD
    
    const angles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4]
    
    angles.forEach((angle) => {
      const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle))
      const collision = checkCollision(newPosition, dir, checkDistance)
      if (collision) {
        // Only consider as blocking collision if we're actually penetrating the object
        // (closer than player radius minus threshold)
        // For movement-aware checks, also block if collision is within the movement distance
        const isBlocking = !onlyPenetrating || 
                          collision.distance < penetrationDistance ||
                          (movementDistance > 0 && collision.distance < playerConfig.current.radius + movementDistance * 0.5)
        if (isBlocking) {
          collisions.push({ ...collision, angle })
        }
      }
    })
    
    return collisions
  }
  
  /**
   * Calculate sliding vector along wall surface (versione semplificata)
   * @param {THREE.Vector3} moveVector - Original movement vector
   * @param {THREE.Vector3} normal - Wall normal vector
   * @returns {THREE.Vector3} - Sliding vector
   */
  const calculateSlideVector = (moveVector, normal) => {
    const normalComponent = normal.clone().multiplyScalar(moveVector.dot(normal))
    return moveVector.clone().sub(normalComponent)
  }
  
  /**
   * NUOVO SISTEMA - Collision Step
   * Routine completa di collision detection per frame
   */
  function collisionStep({ playerRoot, camera, collisionObjects, frameCount, eyeHeight, sphereHeights, threshold, radius }) {
    const origin = getCollisionOrigin(playerRoot, camera, eyeHeight)
    ensureCollidersReady(collisionObjects)

    let colliders = []
    let minDist = Infinity

    for (let h of sphereHeights) {
      const sphereOrigin = origin.clone().add(new THREE.Vector3(0, h, 0))
      const ray = new THREE.Raycaster(sphereOrigin, new THREE.Vector3(0, -1, 0), 0, radius + 2)
      const hits = ray.intersectObjects(collisionObjects, true)
      const filtered = filterHits(hits, origin, h)
      if (filtered.length) {
        colliders = colliders.concat(filtered.map(f => f.object))
        const d = filtered[0].distance !== undefined ? filtered[0].distance : Math.abs(origin.y - filtered[0].point.y)
        if (d < minDist) minDist = d
      }
    }

    const { minDistAdjusted, isPenetrating } = computePenetration(minDist === Infinity ? 9999 : minDist, threshold)
    let effectiveIsPenetrating = isPenetrating
    if (frameCount < SKIP_ANTI_TUNNEL_FRAMES) effectiveIsPenetrating = false

    if (effectiveIsPenetrating) penetratingFrames++ 
    else penetratingFrames = 0

    // Snap fallback con lerp - più prudente
    if (penetratingFrames >= MAX_PENETRATING_FRAMES_BEFORE_SNAP && playerRoot) {
      const downRay = new THREE.Raycaster(origin.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, -1, 0), 0, 10)
      const hitsDown = downRay.intersectObjects(collisionObjects, true)
      if (hitsDown.length > 0) {
        const groundY = hitsDown[0].point.y
        const desiredRootY = groundY
        const currentWorld = new THREE.Vector3()
        playerRoot.getWorldPosition(currentWorld)
        const delta = desiredRootY - currentWorld.y
        
        // Applica snap solo se delta significativo (> SNAP_MIN_DELTA)
        if (Math.abs(delta) > SNAP_MIN_DELTA) {
          const apply = delta * SNAP_LERP
          playerRoot.position.y += apply
          playerRoot.updateMatrixWorld(true)
          console.log('[FPS Controls] SNAP playerRoot (lerp) applied delta:', apply.toFixed(3))
        }
        
        // Reset se delta molto piccolo
        if (Math.abs(delta) < 0.01) {
          penetratingFrames = 0
        }
      }
    }

    console.log('[DIAGNOSTIC]', {
      frame: frameCount,
      minDist: minDist === Infinity ? 'N/A' : minDist.toFixed(3),
      minDistAdjusted: minDist === Infinity ? 'N/A' : minDistAdjusted.toFixed(3),
      threshold: threshold.toFixed(3),
      isPenetrating,
      effectiveIsPenetrating,
      colliders: colliders.slice(0, 5).map(c => c.name || 'unnamed')
    })

    return { effectiveIsPenetrating, colliders, minDist }
  }
  
  // Maximum step height for ground detection - prevents snapping onto roofs/tables
  // Only step up small vertical differences (like a small step / ramp)
  // Calcola lo scalino massimo in base all'altezza del giocatore (es. 35% dell'altezza)
  // Questo si adatta automaticamente se il modello è x1 o x7
  const MAX_GROUND_STEP_HEIGHT = playerConfig.current.height * 0.35
  
  /**
   * Ground detection migliorato per evitare di salire sui muri/soffitti
   * FIX ANTI-TELETRASPORTO: Ignora "pavimenti" più alti di 40cm (sono muri!)
   * @param {THREE.Vector3} position - Current position (at eye height)
   * @param {number} currentY - Current Y position of the player root
   * @returns {number|null} - Corrected Y position for player root, or null if no correction needed
   */
  const detectGround = (position, currentY) => {
    if (!groundObjects || groundObjects.length === 0) return null

    // Spara un raggio dall'alto verso il basso (dagli occhi ai piedi)
    const downDirection = new THREE.Vector3(0, -1, 0)
    raycaster.current.set(position, downDirection)
    raycaster.current.far = 50 

    const filteredTargets = getFilteredCollisionObjects(groundObjects)
    const intersections = raycaster.current.intersectObjects(filteredTargets, true)
    
    if (intersections.length > 0) {
      const groundY = intersections[0].point.y
      
      // Calcola la differenza di altezza
      const deltaY = groundY - currentY
      
      // === FIX TELETRASPORTO SOFFITTO ===
      // Definiamo l'altezza massima di un gradino (es. 40cm)
      // Se il "pavimento" trovato è più alto di 40cm rispetto ai piedi, è un muro o soffitto -> IGNORA
      const MAX_STEP_UP = 0.4 

      // 1. Stiamo salendo?
      if (deltaY > 0) {
        // Se il dislivello è accettabile (gradino), sali.
        if (deltaY <= MAX_STEP_UP) {
           return groundY
        }
        // Se è troppo alto (muro/soffitto), NON FARE NULLA (rimani giù)
        console.log(`[Ground][Skip] IGNORATO muro/soffitto: deltaY=${deltaY.toFixed(2)}m > MAX_STEP_UP=${MAX_STEP_UP}m`)
        return null 
      }
      
      // 2. Stiamo scendendo/cadendo? (deltaY <= 0)
      // Accettiamo la caduta (gravità) - SOLO se gravità abilitata
      if (!disableGravity) {
        return groundY
      }
    }
    
    // Nessuna terra trovata
    return null
  }
  
  /**
   * Update camera bobbing effect (applied to camera's local transform)
   * Architecture: eyeHeight is on cameraRig.position.y, camera.position.y is for bobbing only
   */
  const updateCameraBobbing = (delta, isMoving) => {
    const bobbing = bobbingState.current
    
    // If head bobbing is disabled, keep camera centered and level
    if (!ENABLE_HEAD_BOBBING) {
      bobbing.currentBobY = 0
      bobbing.currentBobX = 0
      bobbing.currentTilt = 0
      bobbing.time = 0
      
      camera.position.y = bobbing.baseY
      camera.position.x = 0
      camera.rotation.z = 0
      return
    }
    
    if (isMoving) {
      bobbing.time += delta * bobbing.frequency
      
      const targetBobY = Math.sin(bobbing.time) * bobbing.verticalAmplitude
      const targetBobX = Math.sin(bobbing.time * 0.5) * bobbing.horizontalAmplitude
      
      const strafeDirection = keysPressed.current.has('keya') ? -1 : keysPressed.current.has('keyd') ? 1 : 0
      const targetTilt = strafeDirection * 0.04
      
      bobbing.currentBobY = THREE.MathUtils.lerp(bobbing.currentBobY, targetBobY, 0.2)
      bobbing.currentBobX = THREE.MathUtils.lerp(bobbing.currentBobX, targetBobX, 0.2)
      bobbing.currentTilt = THREE.MathUtils.lerp(bobbing.currentTilt, targetTilt, 0.1)
    } else {
      // Immediate stop - no smoothing/inertia when player stops moving
      bobbing.currentBobY = 0
      bobbing.currentBobX = 0
      bobbing.currentTilt = 0
      bobbing.time = 0 // Reset bobbing phase for clean restart
    }
    
    // Apply bobbing to camera's LOCAL transform (not affecting yaw/pitch nodes)
    // Note: eyeHeight is now on cameraRig.position.y, so camera.position.y is bobbing only
    camera.position.y = bobbing.baseY + bobbing.currentBobY
    camera.position.x = bobbing.currentBobX
    camera.rotation.z = bobbing.currentTilt
  }
  
  useFrame((state, delta) => {
    // Wait for hierarchy to be initialized
    if (!hierarchyInitializedRef.current || !playerRootRef.current || !yawPivotRef.current || !cameraRigRef.current) {
      return
    }
    
    const playerRoot = playerRootRef.current
    const yawPivot = yawPivotRef.current
    const cameraRig = cameraRigRef.current
    
    // ========================================
    // DIAGNOSTIC: Per-frame collision tracking
    // Tracks minimum collision distance and collider names for debugging
    // ========================================
    let frameMinDistance = Infinity
    let frameMinHitNames = new Set()
    let frameCollisionSource = null // 'antiTunnel' or 'sphereCast'
    
    const registerCollisionSample = (hit, source) => {
      if (!hit) return
      const d = hit.distance
      if (d < frameMinDistance - 0.0001) {
        frameMinDistance = d
        frameMinHitNames = new Set([hit.object?.name || 'unnamed'])
        frameCollisionSource = source
      } else if (Math.abs(d - frameMinDistance) < 0.0001) {
        frameMinHitNames.add(hit.object?.name || 'unnamed')
      }
    }
    
    // Poll gamepad every frame (works regardless of pointer lock or mobile mode)
    pollGamepad()
    
    // Check if gamepad has any input (for activation purposes)
    const hasGamepadInput = gamepadIndexRef.current !== null && (
      Math.abs(gamepadLookVecRef.current.x) > 0.001 ||
      Math.abs(gamepadLookVecRef.current.y) > 0.001 ||
      Math.abs(gamepadMoveVecRef.current.x) > 0.001 ||
      Math.abs(gamepadMoveVecRef.current.y) > 0.001
    )
    
    // For desktop: require pointer lock OR gamepad connected
    // For mobile: always active
    const isActive = isMobile.current || isPointerLockedRef.current || gamepadIndexRef.current !== null
    if (!isActive) return
    
    let isMoving = false
    let isGamepadMoving = false // Track if movement is from gamepad (to disable bobbing)
    const velocity = new THREE.Vector3()
    
    // ========================================
    // ROTATION: Apply yaw to YawPivot, pitch to CameraRig
    // This is done BEFORE movement calculation
    // ========================================
    
    // Gamepad right stick camera rotation (works on desktop without pointer lock)
    // Uses delta time for frame-rate independent rotation
    if (gamepadIndexRef.current !== null) {
      const lookX = gamepadLookVecRef.current.x
      const lookY = gamepadLookVecRef.current.y
      
      if (Math.abs(lookX) > 0.001 || Math.abs(lookY) > 0.001) {
        // Apply gentler non-linear response curve for smoother low-speed control
        const curvedLookX = Math.sign(lookX) * Math.pow(Math.abs(lookX), GAMEPAD_RESPONSE_CURVE)
        const curvedLookY = Math.sign(lookY) * Math.pow(Math.abs(lookY), GAMEPAD_RESPONSE_CURVE)
        
        // Update yaw (horizontal rotation) - multiply by delta for frame-rate independence
        // GAMEPAD_LOOK_SPEED is in radians/second, so this gives continuous rotation
        yawRef.current -= curvedLookX * GAMEPAD_LOOK_SPEED * delta
        
        // Update pitch (vertical rotation) - applied to CameraRig
        pitchRef.current -= curvedLookY * GAMEPAD_LOOK_SPEED * delta
        
        // Clamp pitch to prevent over-rotation
        pitchRef.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitchRef.current))
      }
    }
    
    if (isMobile.current && mobileInput) {
      // Mobile camera rotation (right joystick) - velocity-based mode
      // The joystick vector is interpreted as angular velocity, not as a trackpad delta
      // This allows continuous rotation when holding the joystick at the edge (infinite drag)
      const lookVec = mobileInput.getLookVec ? mobileInput.getLookVec() : { x: 0, y: 0 }
      const lookMag = Math.sqrt(lookVec.x * lookVec.x + lookVec.y * lookVec.y)
      const LOOK_THRESHOLD = 0.05 // Threshold to filter noise
      const MOBILE_LOOK_SPEED = 2.5 // Radians per second at full magnitude (similar to gamepad)
      
      if (lookMag > LOOK_THRESHOLD) {
        // Apply non-linear response curve for finer control at low magnitudes
        const curvedMag = Math.pow(lookMag, RESPONSE_CURVE_EXPONENT)
        const curvedLookX = (lookVec.x / lookMag) * curvedMag
        const curvedLookY = (lookVec.y / lookMag) * curvedMag
        
        // Update yaw (horizontal rotation) - multiply by delta for frame-rate independence
        yawRef.current -= curvedLookX * MOBILE_LOOK_SPEED * delta
        
        // Update pitch (vertical rotation)
        pitchRef.current -= curvedLookY * MOBILE_LOOK_SPEED * delta
        
        // Clamp pitch to +-80 degrees
        pitchRef.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitchRef.current))
      }
    }
    
    // Apply rotations to the correct nodes
    // YawPivot: ONLY yaw rotation (Y axis)
    yawPivot.rotation.set(0, yawRef.current, 0)
    
    // CameraRig: ONLY pitch rotation (X axis)
    cameraRig.rotation.set(pitchRef.current, 0, 0)
    
    // ========================================
    // MOVEMENT: Calculate from YAW ONLY (never pitch)
    // This prevents inverted controls and NaN vectors
    // ========================================
    
    // Get yaw angle for movement calculation
    const yawRad = yawRef.current
    
    // Calculate forward and right vectors from YAW ONLY
    // In Three.js, the camera looks down -Z by default
    // So forward should be (-sin(yaw), 0, -cos(yaw)) to match camera direction
    // right = (cos(yaw), 0, -sin(yaw)) perpendicular to forward
    const forward = new THREE.Vector3(
      -Math.sin(yawRad),
      0,
      -Math.cos(yawRad)
    )
    
    const right = new THREE.Vector3(
      Math.cos(yawRad),
      0,
      -Math.sin(yawRad)
    )
    
    if (isMobile.current && mobileInput) {
      // Mobile movement (left joystick)
      const moveVec = mobileInput.getMoveVec()
      const rawMoveMag = Math.sqrt(moveVec.x * moveVec.x + moveVec.y * moveVec.y)
      // Increased from 0.05 to 0.08 to avoid on/off jitter near dead zone on touch devices
      const MOVE_THRESHOLD = 0.08
      
      if (rawMoveMag > MOVE_THRESHOLD) {
        // Apply non-linear response curve
        const curvedMag = Math.pow(rawMoveMag, RESPONSE_CURVE_EXPONENT)
        
        // Joystick mapping:
        // moveVec.y negative = forward, positive = backward
        // moveVec.x positive = right, negative = left
        const localForward = -moveVec.y
        const localRight = moveVec.x
        
        // movement = forward * dy + right * dx
        velocity
          .addScaledVector(forward, localForward)
          .addScaledVector(right, localRight)
        
        // Normalize to prevent diagonal speed boost
        if (velocity.lengthSq() > 1e-6) {
          velocity.normalize()
        }
        
        // Apply speed and sensitivity
        velocity.multiplyScalar(
          playerConfig.current.moveSpeed * MOBILE_MOVE_SENSITIVITY * curvedMag * delta
        )
        
        isMoving = true
        // Disable bobbing for mobile joystick movement (same as gamepad)
        isGamepadMoving = true
      }
    } else {
      // Desktop movement (keyboard + gamepad left stick)
      const moveForward = keysPressed.current.has('keyw') || keysPressed.current.has('arrowup')
      const moveBackward = keysPressed.current.has('keys') || keysPressed.current.has('arrowdown')
      const moveLeft = keysPressed.current.has('keya') || keysPressed.current.has('arrowleft')
      const moveRight = keysPressed.current.has('keyd') || keysPressed.current.has('arrowright')
      
      // Check for gamepad left stick movement
      const gamepadMoveX = gamepadMoveVecRef.current.x
      const gamepadMoveY = gamepadMoveVecRef.current.y
      const hasGamepadMove = Math.abs(gamepadMoveX) > 0.001 || Math.abs(gamepadMoveY) > 0.001
      
      // Track if movement is from gamepad (to disable bobbing for gamepad movement)
      isGamepadMoving = hasGamepadMove
      
      isMoving = moveForward || moveBackward || moveLeft || moveRight || hasGamepadMove
      
      let localForward = 0
      let localRight = 0
      
      // Keyboard input
      if (moveForward) localForward += 1
      if (moveBackward) localForward -= 1
      if (moveRight) localRight += 1
      if (moveLeft) localRight -= 1
      
      // Gamepad left stick input (additive with keyboard)
      // Gamepad Y axis: negative = forward, positive = backward
      // Gamepad X axis: positive = right, negative = left
      if (hasGamepadMove) {
        localForward -= gamepadMoveY // Invert Y for forward/backward
        localRight += gamepadMoveX
      }
      
      if (localForward !== 0 || localRight !== 0) {
        // movement = forward * dy + right * dx
        velocity
          .addScaledVector(forward, localForward)
          .addScaledVector(right, localRight)
        
        // Normalize to prevent diagonal speed boost
        if (velocity.lengthSq() > 1e-6) {
          velocity.normalize()
        }
        
        // Apply speed (with gamepad sensitivity if using gamepad)
        const speedMultiplier = hasGamepadMove ? GAMEPAD_MOVE_SENSITIVITY : 1.0
        velocity.multiplyScalar(playerConfig.current.moveSpeed * speedMultiplier * delta)
      }
    }
    
    // Update player moving state
    playerConfig.current.isMoving = isMoving
    
    // ========================================
    // COLLISION DETECTION AND POSITION UPDATE
    // Applied ONLY to PlayerRoot (translation node)
    // Implements: SphereCast, anti-tunnelling, lerp interpolation, camera clamping
    // ========================================
    
    // Increment frame counter for debug logging
    frameIdRef.current++
    const frameId = frameIdRef.current
    
    // Store previous position for anti-tunnelling (on first frame, initialize to current)
    if (isFirstFrameRef.current) {
      previousPositionRef.current.copy(playerRoot.position)
      targetPositionRef.current.copy(playerRoot.position)
      isFirstFrameRef.current = false
    }
    
    const currentPosition = playerRoot.position.clone()
    
    // ========================================
    // UPDATE ORDER LOG: Step 1 - Pre-collision state
    // ========================================
    if (CAMERA_DEBUG && CAMERA_DEBUG_FLAGS.updateOrder && velocity.lengthSq() > 0) {
      console.log(`[Collision][Frame ${frameId}][UpdateOrder] STEP 1: preTarget | currentPos: (${currentPosition.x.toFixed(2)}, ${currentPosition.y.toFixed(2)}, ${currentPosition.z.toFixed(2)}) | velocity: (${velocity.x.toFixed(3)}, ${velocity.z.toFixed(3)})`)
    }
    
    // ========================================
    // MULTI-HEIGHT COLLISION DETECTION
    // Check collisions at multiple heights to catch furniture at different levels
    // This creates a crude "capsule" collision by sampling at 5 vertical heights
    // OFFSET VERTICALE: Alziamo il punto più basso per evitare di "strisciare" sul pavimento
    // ========================================
    const collisionHeights = [
      playerConfig.current.radius * 0.5,                              // Alzato da 0.25 a 0.5 - evita pavimento
      playerConfig.current.radius * 1.2,                              // Low: ankle level (catches table legs)
      playerConfig.current.height * 0.33,                             // Lower-mid: knee level
      playerConfig.current.height * 0.66,                             // Upper-mid: waist level (catches most furniture)
      playerConfig.current.height - playerConfig.current.radius       // Upper: chest level (catches tall furniture, counters)
    ]
    
    // Use the mid-height as the primary reference for position calculations
    // collisionHeights are OFFSETS from player's feet, not absolute world Y values
    const primaryCollisionHeight = collisionHeights[2] // Use knee level (index 2) as primary reference
    const collisionCheckPosition = currentPosition.clone()
    collisionCheckPosition.y = currentPosition.y + primaryCollisionHeight
    const proposedPosition = collisionCheckPosition.clone().add(velocity)
    
    // Calculate movement distance for tunneling prevention
    const movementDistance = velocity.length()
    
    // Target position starts as the proposed position
    let targetX = proposedPosition.x
    let targetZ = proposedPosition.z
    let collisionOccurred = false
    
    // Log warning if moving but no collision objects (helps debug collision issues)
    if (collisionObjects.length === 0 && velocity.lengthSq() > 0) {
      // Only log once per second to avoid spam
      if (frameId % 60 === 0) {
        console.warn('[FPS Controls] WARNING: Moving with NO collision objects - collisions will not work!')
      }
    }
    
    // ========================================
    // NUOVO SISTEMA - Collision Detection Semplificato
    // ========================================
    if (collisionObjects.length > 0 && velocity.lengthSq() > 0) {
      // Usa collisionStep per rilevare penetrazioni
      frameCountRef.current++
      const { effectiveIsPenetrating } = collisionStep({
        playerRoot,
        camera,
        collisionObjects,
        frameCount: frameCountRef.current,
        eyeHeight: playerConfig.current.eyeHeight,
        sphereHeights: [0.1, 0.5, 1.0, 1.5],
        threshold: playerConfig.current.radius,
        radius: playerConfig.current.radius
      })
      
      // Se non c'è penetrazione, applica movimento normale
      if (!effectiveIsPenetrating) {
        playerRoot.position.x += velocity.x
        playerRoot.position.z += velocity.z
      }
      // Altrimenti rimani fermo (non applicare movimento)
      
      // ========================================
      // GROUND DETECTION - ALWAYS RUN
      // Only correct when camera goes BELOW ground level
      // Skip on first frame after spawn to preserve initial Y position
      // Ground detection always runs even after lateral collision
      // MAX_GROUND_STEP_HEIGHT prevents snapping onto roofs/tall furniture
      // ========================================
      if (hasSpawnedRef.current) {
        // First frame after spawn - skip ground detection to preserve spawn position
        hasSpawnedRef.current = false
        console.log('[FPS Controls] Skipping ground detection on first frame after spawn')
      } else {
        // Normal ground detection - only corrects if camera is below ground
        // MAX_GROUND_STEP_HEIGHT prevents snapping onto roofs/tall furniture
        const eyePosition = playerRoot.position.clone().add(new THREE.Vector3(0, playerConfig.current.eyeHeight, 0))
        const correctedY = detectGround(eyePosition, playerRoot.position.y)
        
        if (correctedY !== null) {
          // Apply correction with lerp for smooth transition (lerp OK for ground, not for collision)
          playerRoot.position.y = THREE.MathUtils.lerp(
            playerRoot.position.y,
            correctedY,
            CAMERA_CORRECTION_LERP_FACTOR * 2 // Faster correction for ground to prevent falling through
          )
        }
      }
      bobbingState.current.baseY = 0
    } else {
      if (velocity.lengthSq() > 0) {
        playerRoot.position.x += velocity.x
        playerRoot.position.z += velocity.z
      }
    }
    
    // Store current position for next frame's anti-tunnelling check
    previousPositionRef.current.copy(playerRoot.position)
    
    // Apply boundary limits to prevent player from leaving the house perimeter
    // This acts as a fallback safety net in addition to collision detection
    if (boundaryLimits) {
      const margin = playerConfig.current.radius
      if (boundaryLimits.minX !== undefined) {
        playerRoot.position.x = Math.max(boundaryLimits.minX + margin, playerRoot.position.x)
      }
      if (boundaryLimits.maxX !== undefined) {
        playerRoot.position.x = Math.min(boundaryLimits.maxX - margin, playerRoot.position.x)
      }
      if (boundaryLimits.minZ !== undefined) {
        playerRoot.position.z = Math.max(boundaryLimits.minZ + margin, playerRoot.position.z)
      }
      if (boundaryLimits.maxZ !== undefined) {
        playerRoot.position.z = Math.min(boundaryLimits.maxZ - margin, playerRoot.position.z)
      }
    }
    
    // Update camera bobbing (applied to camera's local transform)
    // Disable bobbing when moving with gamepad (only keyboard movement has bobbing)
    updateCameraBobbing(delta, isMoving && !isGamepadMoving)
    
    // ========================================
    // DIAGNOSTIC: End-of-frame collision summary
    // Logs minimum collision distance and collider names per frame
    // ========================================
    if (frameMinDistance < Infinity) {
      const radius = playerConfig.current.radius
      const threshold = radius + DIAGNOSTIC_THRESHOLD_OFFSET
      const isPenetrating = frameMinDistance < threshold
      console.log(
        `[DIAGNOSTIC][Frame ${frameIdRef.current}] ` +
        `minDist=${frameMinDistance.toFixed(3)} | ` +
        `radius=${radius.toFixed(3)} | ` +
        `threshold=${threshold.toFixed(3)} | ` +
        `isPenetrating=${isPenetrating} | ` +
        `source=${frameCollisionSource} | ` +
        `colliders=[${[...frameMinHitNames].join(', ')}]`
      )
    }
  })
  
  return {
    controls: null,
    isLocked: isPointerLockedRef.current
  }
}
