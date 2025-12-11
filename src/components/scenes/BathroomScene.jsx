import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Environment, Html, useProgress } from '@react-three/drei'
import { Suspense, useState, useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import CasaModel from '../3D/CasaModel'
import { useFPSControls } from '../../hooks/useFPSControls'

// Loading indicator component shown while the 3D model loads
function LoadingIndicator() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '10px',
        minWidth: '200px'
      }}>
        <div style={{ fontSize: '18px', marginBottom: '15px' }}>
          Caricamento bagno...
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: '#4CAF50',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>
        <div style={{ fontSize: '14px', marginTop: '10px' }}>
          {progress.toFixed(0)}%
        </div>
      </div>
    </Html>
  )
}

function FPSController({ modelRef, mobileInput, onLookAtChange, groundPlaneMesh, isMobile = false, boundaryLimits, initialPosition, initialYaw = 0, eyeHeight = 1.6, modelScale = 1 }) {
  const { camera } = useThree()
  const [collisionObjects, setCollisionObjects] = useState([])
  const [groundObjects, setGroundObjects] = useState([])
  const [interactiveObjects, setInteractiveObjects] = useState([])
  const raycasterRef = useRef(new THREE.Raycaster())
  const lastTargetRef = useRef(null)
  const timeSinceLastRaycastRef = useRef(0)
  const RAYCAST_INTERVAL = isMobile ? 0.1 : 0
  
  // Scala tutti i parametri FPS usando modelScale (come EsternoScene)
  const scaledCollisionRadius = 0.3 * modelScale
  const scaledPlayerHeight = 1.8 * modelScale
  const scaledMoveSpeed = 20.0 * modelScale
  
  useEffect(() => {
    if (!modelRef.current) return
    
    const collidables = []
    const grounds = []
    const interactives = []
    
    // Usa i tag userData impostati da CasaModel
    modelRef.current.traverse((child) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase()
        
        // CasaModel ha già taggato ground e collidable objects
        if (child.userData.ground === true) {
          grounds.push(child)
        } else if (child.userData.collidable === true) {
          collidables.push(child)
        }
        
        // Interactive objects
        if (name.startsWith('test') || name.includes('bagno') || name.includes('doccia') || name.includes('lavabo')) {
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
    
    console.log(`[BathroomScene] Ground objects (${grounds.length}):`, grounds.map(o => o.name))
    console.log(`[BathroomScene] Collidable objects (${collidables.length}):`, collidables.map(o => o.name))
    console.log(`[BathroomScene] Eye height:`, eyeHeight)
    
    setCollisionObjects(collidables)
    setGroundObjects(grounds)
    setInteractiveObjects(interactives)
  }, [modelRef, groundPlaneMesh, eyeHeight])
  
  // Log camera distance from ground periodically
  const logTimerRef = useRef(0)
  const LOG_INTERVAL = 2.0 // Log every 2 seconds
  
  useFrame((_, delta) => {
    // Log camera position and distance from ground
    logTimerRef.current += delta
    if (logTimerRef.current >= LOG_INTERVAL) {
      logTimerRef.current = 0
      
      const cameraY = camera.position.y
      let minGroundDistance = Infinity
      
      // Find closest ground mesh
      groundObjects.forEach(ground => {
        const groundBox = new THREE.Box3().setFromObject(ground)
        const groundY = groundBox.max.y // Top of ground mesh
        const distance = Math.abs(cameraY - groundY)
        if (distance < minGroundDistance) {
          minGroundDistance = distance
        }
      })
      
      console.log(`[BathroomScene] 📷 Camera Y: ${cameraY.toFixed(2)} | Distance from ground: ${minGroundDistance.toFixed(2)} | Position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`)
    }
  })
  
  useFrame((_, delta) => {
    if (!onLookAtChange || interactiveObjects.length === 0) return
    
    if (RAYCAST_INTERVAL > 0) {
      timeSinceLastRaycastRef.current += delta
      if (timeSinceLastRaycastRef.current < RAYCAST_INTERVAL) return
      timeSinceLastRaycastRef.current = 0
    }
    
    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    raycasterRef.current.set(camera.position, direction)
    raycasterRef.current.far = 5
    
    const intersects = raycasterRef.current.intersectObjects(interactiveObjects, true)
    
    if (intersects.length > 0) {
      const targetName = intersects[0].object.name
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
  
  // Usa parametri scalati (identici a EsternoScene)
  useFPSControls(
    collisionObjects,
    mobileInput,
    groundObjects,
    boundaryLimits,
    initialPosition,
    initialYaw,
    eyeHeight,
    scaledCollisionRadius,
    scaledPlayerHeight,
    scaledMoveSpeed
  )
  
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
      {/* Aumentato a 500x500 per coprire tutta la casa scalata */}
      <planeGeometry args={[500, 500]} />
      <meshStandardMaterial color="#cccccc" polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
    </mesh>
  )
}

export default function BathroomScene({ onObjectClick, onLookAtChange, mobileInput, isMobile = false }) {
  const [modelRef, setModelRef] = useState({ current: null, spawnPoint: null })
  const [groundPlaneRef, setGroundPlaneRef] = useState(null)
  const [boundaryLimits, setBoundaryLimits] = useState(null)
  
  // === CONFIGURAZIONE FISICA AGGIORNATA ===
  const MODEL_SCALE = 1
  
  // ALTEZZA OCCHI: 1.1 per una prospettiva più naturale
  const EYE_HEIGHT = 1.1 * MODEL_SCALE 
  
  const COLLISION_RADIUS = 0.3 * MODEL_SCALE
  const PLAYER_HEIGHT = 1.8 * MODEL_SCALE // Il corpo resta alto per le collisioni
  const MOVE_SPEED = 20.0 * MODEL_SCALE
  
  useEffect(() => {
    if (!modelRef.current) return
    
    modelRef.current.updateWorldMatrix(true, true)
    
    const box = new THREE.Box3().setFromObject(modelRef.current)
    
    const limits = {
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z
    }
    
    console.log('[Bathroom] Bounding box limits:', limits)
    console.log('[Bathroom] Model spawnPoint:', modelRef.spawnPoint)
    console.log('[Bathroom] Using FIXED params: eyeHeight=', EYE_HEIGHT, 'moveSpeed=', MOVE_SPEED, 'collisionRadius=', COLLISION_RADIUS)
    
    setBoundaryLimits(limits)
  }, [modelRef])
  
  const safeSpawnPosition = useMemo(() => {
    if (modelRef.spawnPoint) {
      const spawnFromModel = {
        x: modelRef.spawnPoint.x,
        y: modelRef.spawnPoint.y || 0,
        z: modelRef.spawnPoint.z
      }
      console.log('[Bathroom] Using GLB spawn point (world position):', spawnFromModel)
      return spawnFromModel
    }
    
    if (boundaryLimits) {
      const centerX = (boundaryLimits.minX + boundaryLimits.maxX) / 2
      const centerZ = (boundaryLimits.minZ + boundaryLimits.maxZ) / 2
      
      const safeSpawn = {
        x: centerX,
        y: 0,
        z: centerZ
      }
      
      console.log('[Bathroom] Spawning at room center (no GLB marker):', safeSpawn)
      return safeSpawn
    }
    
    const FALLBACK_SPAWN = { x: 0, y: 0, z: 0 }
    console.log('[Bathroom] Using fallback spawn position:', FALLBACK_SPAWN)
    return FALLBACK_SPAWN
  }, [modelRef.spawnPoint, boundaryLimits])
  
  const initialYaw = useMemo(() => {
    const yaw = 0
    console.log('[Bathroom] Initial yaw:', yaw, 'radians')
    return yaw
  }, [])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas 
        camera={{ position: [0, 1.6, 10], fov: 75, near: 0.1 }} 
        shadows={!isMobile}
        dpr={isMobile ? [1, 1.2] : [1, 2]}
        gl={{ antialias: !isMobile, powerPreference: isMobile ? 'low-power' : 'high-performance' }}
      >
        <ambientLight intensity={isMobile ? 0.7 : 0.6} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={0.8} 
          castShadow={!isMobile} 
          shadow-bias={-0.0005} 
        />
        
        <FPSController 
          modelRef={modelRef}
          mobileInput={mobileInput}
          onLookAtChange={onLookAtChange}
          groundPlaneMesh={groundPlaneRef}
          isMobile={isMobile}
          boundaryLimits={boundaryLimits}
          initialPosition={safeSpawnPosition}
          initialYaw={initialYaw}
          eyeHeight={EYE_HEIGHT}
          modelScale={MODEL_SCALE}
        />
        
        <Suspense fallback={<LoadingIndicator />}>
          <CasaModel 
            sceneType="bagno"
            spawnNodeName="INIZIO_BAGNO"
            onObjectClick={onObjectClick} 
            modelRef={setModelRef} 
            enableShadows={!isMobile}
          />
          
          <GroundPlane onGroundReady={setGroundPlaneRef} />
          
          {!isMobile && <Environment preset="apartment" />}
        </Suspense>
      </Canvas>
    </div>
  )
}
