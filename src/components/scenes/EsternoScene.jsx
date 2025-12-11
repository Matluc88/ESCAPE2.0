import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Suspense, useState, useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import CasaModel from '../3D/CasaModel'
import { useFPSControls } from '../../hooks/useFPSControls'

function FPSController({ modelRef, mobileInput, onLookAtChange, groundPlaneMesh, isMobile = false, boundaryLimits, initialPosition, eyeHeight = 1.6, modelScale = 1 }) {
  const { camera } = useThree()
  const [collisionObjects, setCollisionObjects] = useState([])
  const [groundObjects, setGroundObjects] = useState([])
  const [interactiveObjects, setInteractiveObjects] = useState([])
  const raycasterRef = useRef(new THREE.Raycaster())
  const lastTargetRef = useRef(null)
  const timeSinceLastRaycastRef = useRef(0)
  const RAYCAST_INTERVAL = isMobile ? 0.1 : 0 // Throttle raycasting on mobile (10 Hz)
  
  // Log props to debug eyeHeight propagation
  console.log('[EsternoFPSController] props:', { eyeHeight, modelScale, hasModelRef: !!modelRef.current })
  
  useEffect(() => {
    if (!modelRef.current) return
    
    const collidables = []
    const grounds = []
    const interactives = []
    
    // Collision tags are now auto-assigned by applyAutoCollisionTags() in EsternoModel.jsx
    // Here we just collect objects based on their userData tags
    modelRef.current.traverse((child) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase()
        
        // Collect ground objects (tagged by auto-collision system)
        if (child.userData.ground === true) {
          grounds.push(child)
        }
        
        // Collect collidable objects (tagged by auto-collision system)
        // Only include meshes that are explicitly marked as collidable
        // Skip meshes that are explicitly marked as non-collidable (small details)
        if (child.userData.collidable === true) {
          collidables.push(child)
        } else if (child.userData.collidable !== false) {
          // For meshes not tagged by auto-collision, add them as collidable by default
          // This ensures walls and other objects still block the player
          collidables.push(child)
          child.userData.collidable = true
        }
        
        // Mark interactive objects (test objects or known interactive names)
        if (name.startsWith('test') || 
            name.includes('cancello') || 
            name.includes('porta') || 
            name.includes('gate') ||
            name.includes('door')) {
          interactives.push(child)
          child.userData.interactive = true
        }
      }
    })
    
    // Add the programmatic ground plane if available
    if (groundPlaneMesh) {
      grounds.push(groundPlaneMesh)
      groundPlaneMesh.userData.ground = true
    }
    
    console.log(`[EsternoScene] Collision setup: ${collidables.length} collidable, ${grounds.length} ground, ${interactives.length} interactive`)
    setCollisionObjects(collidables)
    setGroundObjects(grounds)
    setInteractiveObjects(interactives)
  }, [modelRef, groundPlaneMesh])
  
  // Raycasting for interactive object detection (for mobile interaction button)
  // Throttled on mobile to improve performance (10 Hz instead of 60 Hz)
  useFrame((_, delta) => {
    if (!onLookAtChange || interactiveObjects.length === 0) return
    
    // Throttle raycasting on mobile
    if (RAYCAST_INTERVAL > 0) {
      timeSinceLastRaycastRef.current += delta
      if (timeSinceLastRaycastRef.current < RAYCAST_INTERVAL) return
      timeSinceLastRaycastRef.current = 0
    }
    
    // Cast ray from camera forward
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    raycasterRef.current.set(camera.position, direction)
    raycasterRef.current.far = 5 // Max interaction distance
    
    const intersects = raycasterRef.current.intersectObjects(interactiveObjects, true)
    
    if (intersects.length > 0) {
      const target = intersects[0].object
      // Find the root interactive object (might be a child mesh)
      let interactiveParent = target
      while (interactiveParent && !interactiveParent.userData.interactive) {
        interactiveParent = interactiveParent.parent
      }
      
      const targetName = interactiveParent?.name || target.name
      
      if (lastTargetRef.current !== targetName) {
        lastTargetRef.current = targetName
        onLookAtChange(targetName, targetName)
      }
    } else {
      if (lastTargetRef.current !== null) {
        lastTargetRef.current = null
        onLookAtChange(null, null)
      }
    }
  })
  
  // Scale all FPS parameters by the model scale (same as KitchenScene)
  const scaledCollisionRadius = 0.3 * modelScale
  const scaledPlayerHeight = 1.8 * modelScale
  const scaledMoveSpeed = 20.0 * modelScale // Increased from 5.0 for faster movement
  // Disable gravity for EsternoScene to preserve original behavior
  useFPSControls(collisionObjects, mobileInput, groundObjects, boundaryLimits, initialPosition, 0, eyeHeight, scaledCollisionRadius, scaledPlayerHeight, scaledMoveSpeed, true)
  
  return null
}

// Ground plane component that registers itself for ground detection
function GroundPlane({ onGroundReady }) {
  const meshRef = useRef()
  
  useEffect(() => {
    if (meshRef.current && onGroundReady) {
      onGroundReady(meshRef.current)
    }
  }, [onGroundReady])
  
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow name="ground_plane">
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#4a7c4e" polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
    </mesh>
  )
}

// Reference height for scale calculation (same as KitchenScene)
const REFERENCE_HEIGHT = 22.5

export default function EsternoScene({ onObjectClick, onLookAtChange, mobileInput, isMobile = false }) {
  const [modelRef, setModelRef] = useState({ current: null })
  const [groundPlaneRef, setGroundPlaneRef] = useState(null)
  const [boundaryLimits, setBoundaryLimits] = useState(null)
  // Start with null to prevent FPSController from rendering with unscaled values
  const [modelScale, setModelScale] = useState(null)
  // Spawn position calculated from model bounds (outside the house)
  const [spawnPosition, setSpawnPosition] = useState(null)
  // Eye height derived from gate (cancello) center Y position
  const [gateEyeHeight, setGateEyeHeight] = useState(null)
  // Gate animation state
  const [cancelloAperto, setCancelloAperto] = useState(false)
  const [cancellettoAperto, setCancellettoAperto] = useState(false)
  
  // Enigma 1: Fotocellula state (LED rosso/verde)
  // LED starts RED, pressing 'G' simulates ESP32 fotocellula and turns it GREEN
  const [fotocellulaSbloccata, setFotocellulaSbloccata] = useState(false)
  const [mostraMessaggio, setMostraMessaggio] = useState(false)
  
  // Keyboard shortcut: G key unlocks fotocellula (LED rosso → verde), H key for pedestrian gate
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'g' || e.key === 'G') {
        if (!fotocellulaSbloccata) {
          console.log('[EsternoScene] Fotocellula sbloccata! LED: ROSSO → VERDE')
          setFotocellulaSbloccata(true)
        }
      }
      if (e.key === 'h' || e.key === 'H') {
        setCancellettoAperto(prev => {
          console.log('[EsternoScene] Toggling pedestrian gate:', !prev ? 'OPEN' : 'CLOSED')
          return !prev
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fotocellulaSbloccata])
  
  // Handle click on cancello (gate)
  const handleCancelloClick = (objectName) => {
    const name = objectName.toLowerCase()
    // Check if clicked on gate (CANCELLO_ANTA_1 or CANCELLO_ANTA_2)
    if (name.includes('cancello_anta') || name.includes('cancello anta')) {
      if (!fotocellulaSbloccata) {
        // LED rosso: show message, don't open
        console.log('[EsternoScene] Cancello clicked but fotocellula NOT sbloccata (LED ROSSO)')
        setMostraMessaggio(true)
        // Hide message after 4 seconds
        setTimeout(() => setMostraMessaggio(false), 4000)
      } else {
        // LED verde: toggle gate
        console.log('[EsternoScene] Cancello clicked, fotocellula sbloccata (LED VERDE) - opening gate')
        setCancelloAperto(prev => !prev)
      }
    }
  }
  
  // Wrapper for onObjectClick that handles cancello logic
  const handleObjectClick = (objectName) => {
    handleCancelloClick(objectName)
    // Also call parent handler if provided
    if (onObjectClick) {
      onObjectClick(objectName)
    }
  }
  
  useEffect(() => {
    if (!modelRef.current) return
    
    // Update world matrices to ensure bounding box reflects repositioned model
    modelRef.current.updateWorldMatrix(true, true)
    
    const box = new THREE.Box3().setFromObject(modelRef.current)
    const limits = {
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z
    }
    
    // Calculate scale from bounding box height (same as KitchenScene)
    const modelHeight = box.max.y - box.min.y
    const calculatedScale = modelHeight / REFERENCE_HEIGHT
    console.log('[Esterno] Calculated scale:', calculatedScale, '(model height:', modelHeight, '/ reference:', REFERENCE_HEIGHT, ')')
    console.log('[Esterno] Scaled FPS params will be: moveSpeed=', 20.0 * calculatedScale, 'collisionRadius=', 0.3 * calculatedScale, 'eyeHeight=', 1.6 * calculatedScale)
    setModelScale(calculatedScale)
    
    // Find the gate (cancello/cancelletto) and use its center Y as eye height
    // This positions the camera at gate level as requested by the user
    let gateFound = false
    modelRef.current.traverse((child) => {
      if (gateFound) return // Only use the first gate found
      if (child.isMesh && child.name.toLowerCase().includes('cancell')) {
        const gateBox = new THREE.Box3().setFromObject(child)
        const gateCenter = new THREE.Vector3()
        gateBox.getCenter(gateCenter)
        console.log('[Esterno] Found gate:', child.name, 'Center Y:', gateCenter.y, 'Box:', { min: gateBox.min.y, max: gateBox.max.y })
        setGateEyeHeight(gateCenter.y)
        gateFound = true
      }
    })
    
    if (!gateFound) {
      console.log('[Esterno] No gate found, using default eyeHeight:', 1.6 * calculatedScale)
    }
    
    // Calculate spawn position OUTSIDE the house (using box.max.z + offset)
    const spawnOffset = 5 // Units outside the model bounds
    // Spawn at ground level (Y=0) - the model is already repositioned so floor is at Y=0
    // The eyeHeight parameter handles camera height above ground
    const outsideSpawn = {
      x: 0,
      y: 0,
      z: box.max.z + spawnOffset
    }
    console.log('[Esterno] Spawn position (outside house):', outsideSpawn, '(box.max.z:', box.max.z, '+ offset:', spawnOffset, ')')
    setSpawnPosition(outsideSpawn)
    
    console.log('[Esterno] Boundary limits:', limits)
    setBoundaryLimits(limits)
  }, [modelRef])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas 
        camera={{ position: [0, 1.6, 10], fov: 75, near: 0.1 }} 
        shadows={!isMobile}
        dpr={isMobile ? [1, 1.2] : [1, 2]}
        gl={{ antialias: !isMobile, powerPreference: isMobile ? 'low-power' : 'high-performance' }}
      >
        <ambientLight intensity={isMobile ? 0.8 : 0.7} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1.0} 
          castShadow={!isMobile} 
          shadow-bias={-0.0005} 
        />
        <hemisphereLight intensity={0.5} groundColor="#8B4513" />
        
        {/* Only render FPSController after modelScale has been calculated from the model's bounding box */}
        {/* Use gate center Y as eye height if found, otherwise fall back to scaled default */}
        {modelScale !== null && spawnPosition !== null && (
          <FPSController 
            modelRef={modelRef} 
            mobileInput={mobileInput}
            onLookAtChange={onLookAtChange}
            groundPlaneMesh={groundPlaneRef}
            isMobile={isMobile}
            boundaryLimits={null}
            initialPosition={spawnPosition}
            eyeHeight={gateEyeHeight ?? (1.6 * modelScale)}
            modelScale={modelScale}
          />
        )}
        
        <Suspense fallback={null}>
          <CasaModel 
            sceneType="esterno"
            onObjectClick={handleObjectClick} 
            modelRef={setModelRef} 
            enableShadows={!isMobile}
            cancelloAperto={cancelloAperto}
            cancellettoAperto={cancellettoAperto}
            ledSerraVerde={fotocellulaSbloccata}
          />
          <GroundPlane onGroundReady={setGroundPlaneRef} />
          {!isMobile && <Environment preset="sunset" />}
        </Suspense>
      </Canvas>
      
      {/* LED Indicator - shows fotocellula state (red = locked, green = unlocked) */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '10px 15px',
        borderRadius: '8px',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        zIndex: 1000
      }}>
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: fotocellulaSbloccata ? '#00ff00' : '#ff0000',
          boxShadow: fotocellulaSbloccata 
            ? '0 0 10px #00ff00, 0 0 20px #00ff00' 
            : '0 0 10px #ff0000, 0 0 20px #ff0000'
        }} />
        <span>Fotocellula: {fotocellulaSbloccata ? 'SBLOCCATA' : 'BLOCCATA'}</span>
      </div>
      
      {/* Message overlay - shown when clicking gate with LED red */}
      {mostraMessaggio && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          padding: '30px 40px',
          borderRadius: '12px',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          textAlign: 'center',
          maxWidth: '400px',
          zIndex: 1001,
          border: '2px solid #ff6600',
          boxShadow: '0 0 30px rgba(255, 102, 0, 0.5)'
        }}>
          <div style={{ marginBottom: '15px', fontSize: '24px' }}>🔒</div>
          <p style={{ margin: 0, lineHeight: '1.5' }}>
            Devi andare vicino al plastico e spostare la pietra che blocca la fotocellula
          </p>
        </div>
      )}
    </div>
  )
}
