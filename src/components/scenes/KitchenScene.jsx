import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Environment, Html, useProgress } from '@react-three/drei'
import { Suspense, useState, useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import CasaModel from '../3D/CasaModel'
import { useFPSControls } from '../../hooks/useFPSControls'
import DebugExpose from '../debug/DebugExpose'

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
          Caricamento cucina...
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

// --- COMPONENTE DEBUG VISIVO ---
function DebugOverlay() {
  const { camera } = useThree()
  const [info, setInfo] = useState("")
  
  useFrame(() => {
    const r = camera.position
    setInfo(`POS: ${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}`)
  })

  return (
    <Html position={[0,0,0]} style={{ pointerEvents: 'none' }}>
      <div style={{ 
        position: 'fixed', top: '10px', left: '10px', 
        background: 'rgba(0,0,0,0.8)', color: '#0f0', 
        padding: '10px', fontFamily: 'monospace', fontSize: '14px',
        width: '300px', zIndex: 9999 
      }}>
        {info}
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
  const RAYCAST_INTERVAL = isMobile ? 0.1 : 0 // Throttle raycasting on mobile (10 Hz)
  
  // PARAMETRI UMANI STANDARD ANTI-JITTER (casa ora a scala 10x = dimensioni reali)
  const MODEL_SCALE = 1
  const RADIUS = 0.25 * MODEL_SCALE  // Ridotto per passare fluido nelle porte
  const PLAYER_HEIGHT = 1.8 * MODEL_SCALE  // Altezza standard essere umano
  const MOVE_SPEED = 6.0 * MODEL_SCALE  // Camminata veloce (era 10.0 = corsa olimpica)
  
  useEffect(() => {
    // === CASO 1: LISTE FORZATE DA CASAMODEL (Sincronizzazione perfetta!) ===
    if (modelRef && (modelRef.forcedCollidables || modelRef.forcedGrounds)) {
      console.log('[KitchenScene] 🚀 USANDO LISTE FORZATE DA CASAMODEL');
      
      let cols = modelRef.forcedCollidables || [];
      let grnds = modelRef.forcedGrounds || [];
      const interactives = [];

      // Aggiungi ground plane artificiale se c'è
      if (groundPlaneMesh) {
        grnds = [...grnds, groundPlaneMesh];
        groundPlaneMesh.userData.ground = true;
      }

      // Cerca oggetti interattivi nelle collidables
      cols.forEach(child => {
        const name = child.name ? child.name.toLowerCase() : '';
        
        let hasMobileSmartAncestor = false;
        let node = child.parent;
        while (node) {
          const parentName = node.name?.toLowerCase() ?? '';
          if (parentName.includes('mobile smart')) {
            hasMobileSmartAncestor = true;
            break;
          }
          node = node.parent;
        }
        
        if (name.startsWith('test') || 
            name.includes('forno') || 
            name.includes('frigo') || 
            name.includes('cassetto') ||
            name.includes('finestra') ||
            name.includes('mobile smart') ||
            hasMobileSmartAncestor) {
          interactives.push(child);
          child.userData.interactive = true;
        }
      });

      setCollisionObjects(cols);
      setGroundObjects(grnds);
      setInteractiveObjects(interactives);
      
      console.log(`[KitchenScene] ✅ Configurazione: ${cols.length} collision, ${grnds.length} grounds, ${interactives.length} interattivi`);
      return;
    }

    // === CASO 2: FALLBACK (Codice vecchio se CasaModel non manda liste) ===
    if (!modelRef || !modelRef.current) return;
    
    const collidables = []
    const grounds = []
    const interactives = []
    
    console.log('[KitchenScene] ⚠️ Fallback: Calcolo liste manualmente (LENTO)');
    
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
        
        // Mark interactive objects
        let hasMobileSmartAncestor = false
        let node = child.parent
        while (node) {
          const parentName = node.name?.toLowerCase() ?? ''
          if (parentName.includes('mobile smart')) {
            hasMobileSmartAncestor = true
            break
          }
          node = node.parent
        }
        
        if (name.startsWith('test') || 
            name.includes('forno') || 
            name.includes('frigo') || 
            name.includes('cassetto') ||
            name.includes('finestra') ||
            name.includes('mobile smart') ||
            hasMobileSmartAncestor) {
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
    
    console.log(`[KitchenScene] Ground objects (${grounds.length}):`, grounds.map(o => o.name))
    console.log(`[KitchenScene] Collidable objects (${collidables.length}):`, collidables.map(o => o.name))
    
    setCollisionObjects(collidables)
    setGroundObjects(grounds)
    setInteractiveObjects(interactives)
  }, [modelRef, groundPlaneMesh])
  
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
      
      console.log(`[KitchenScene] 📷 Camera Y: ${cameraY.toFixed(2)} | Distance from ground: ${minGroundDistance.toFixed(2)} | Position: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`)
    }
  })
  
  // Raycasting for interactive object detection
  // Throttled on mobile to improve performance (10 Hz instead of 60 Hz)
  useFrame((_, delta) => {
    if (!onLookAtChange || interactiveObjects.length === 0) return
    
    // Throttle raycasting on mobile
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
      const target = intersects[0].object
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
  
  // Usa parametri rilassati
  useFPSControls(
    collisionObjects,
    mobileInput,
    groundObjects,
    boundaryLimits,
    initialPosition,
    initialYaw,
    eyeHeight,
    RADIUS,
    PLAYER_HEIGHT,
    MOVE_SPEED
  )
  
  // Log pulito ogni 2 secondi
  useFrame((state) => {
    if (Math.floor(state.clock.elapsedTime) % 2 !== 0) return;
    const wp = new THREE.Vector3();
    camera.getWorldPosition(wp);
    console.log(`[FPS] Pos: ${wp.x.toFixed(2)}, ${wp.y.toFixed(2)}, ${wp.z.toFixed(2)}`);
  })
  
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

export default function KitchenScene({ onObjectClick, onLookAtChange, mobileInput, isMobile = false }) {
  const [modelRef, setModelRef] = useState({ current: null, spawnPoint: null })
  const [groundPlaneRef, setGroundPlaneRef] = useState(null)
  const [boundaryLimits, setBoundaryLimits] = useState(null)
  
  // === CONFIGURAZIONE FISICA STANDARD UMANO ANTI-JITTER (casa ora 10x = scala reale) ===
  const MODEL_SCALE = 1
  
  // ALTEZZA OCCHI: 1.6m standard per essere umano adulto
  const EYE_HEIGHT = 1.6 * MODEL_SCALE
  
  const COLLISION_RADIUS = 0.25 * MODEL_SCALE  // Ridotto per passare fluido nelle porte
  const PLAYER_HEIGHT = 1.8 * MODEL_SCALE  // Altezza totale standard
  const MOVE_SPEED = 6.0 * MODEL_SCALE  // Camminata veloce (era 10.0 = corsa olimpica)
  
  // Stato per l'anta del mobile smart cucina (contiene la pentola)
  const [mobileSmartAntaAperta, setMobileSmartAntaAperta] = useState(false)
  
  // Stato per l'animazione della pentola verso i fornelli
  const [pentolaSuiFornelli, setPentolaSuiFornelli] = useState(false)
  
  // Keyboard listener per Tasto A (toggle anta) e Tasto B (sposta pentola)
  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      
      // Tasto A - Toggle apertura/chiusura anta mobile smart
      if (key === 'a') {
        console.log('[KitchenScene] Tasto A premuto - toggle anta mobile smart')
        setMobileSmartAntaAperta(prev => !prev)
      }
      
      // Tasto B - Sposta pentola sui fornelli
      if (key === 'b') {
        console.log('[KitchenScene] Tasto B premuto - sposta pentola sui fornelli')
        setPentolaSuiFornelli(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
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
    
    console.log('[Kitchen] Bounding box limits:', limits)
    console.log('[Kitchen] Model spawnPoint:', modelRef.spawnPoint)
    console.log('[Kitchen] Using FIXED params: eyeHeight=', EYE_HEIGHT, 'moveSpeed=', MOVE_SPEED, 'collisionRadius=', COLLISION_RADIUS)
    
    setBoundaryLimits(limits)
  }, [modelRef])
  
  // Compute spawn position from the GLB model's POSIZIONE_INIZIALE marker
  // The world position is calculated AFTER model transformations (scale + reposition) in KitchenModel.jsx
  const safeSpawnPosition = useMemo(() => {
    // First priority: use the spawn point from the GLB model (world position after transformations)
    // This is set by POSIZIONE_INIZIALE or MANIGLIA_PORTA markers in KitchenModel.jsx
    if (modelRef.spawnPoint) {
      const spawnFromModel = {
        x: modelRef.spawnPoint.x,
        y: modelRef.spawnPoint.y || 0,
        z: modelRef.spawnPoint.z
      }
      console.log('[Kitchen] Using GLB spawn point (world position):', spawnFromModel)
      return spawnFromModel
    }
    
    // Fallback: spawn at the room center if no GLB marker is available
    if (boundaryLimits) {
      const centerX = (boundaryLimits.minX + boundaryLimits.maxX) / 2
      const centerZ = (boundaryLimits.minZ + boundaryLimits.maxZ) / 2
      
      const safeSpawn = {
        x: centerX,
        y: 0,
        z: centerZ
      }
      
      console.log('[Kitchen] Spawning at room center (no GLB marker):', safeSpawn)
      return safeSpawn
    }
    
    // Final fallback if no boundary limits yet
    const FALLBACK_SPAWN = { x: 0, y: 0, z: 0 }
    console.log('[Kitchen] Using fallback spawn position:', FALLBACK_SPAWN)
    return FALLBACK_SPAWN
  }, [modelRef.spawnPoint, boundaryLimits])
  
  // Initial yaw (90 degrees = 1.57 radians)
  // This makes the player face the correct direction when spawning
  const initialYaw = useMemo(() => {
    const yaw = 1.57 // 90 degrees in radians
    console.log('[Kitchen] Initial yaw:', yaw, 'radians (', (yaw * 180 / Math.PI).toFixed(1), 'degrees)')
    return yaw
  }, [])
  
  // Handler per il click sull'anta del mobile smart cucina
  const handleMobileSmartAntaClick = (objectName) => {
    const name = objectName.toLowerCase()
    // Check if clicked on mobile smart cucina anta
    if (name.includes('mobile smart cucina anta') || 
        name.includes('sweethome3d_opening_on_hinge_1_door_511')) {
      console.log('[KitchenScene] Mobile smart anta clicked, toggling:', !mobileSmartAntaAperta)
      setMobileSmartAntaAperta(prev => !prev)
    }
  }
  
  // Wrapper per onObjectClick che gestisce la logica dell'anta
  const handleObjectClick = (objectName) => {
    handleMobileSmartAntaClick(objectName)
    // Chiama anche il parent handler se fornito
    if (onObjectClick) {
      onObjectClick(objectName)
    }
  }

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
        
        {/* Debug Overlay - Mostra coordinate in tempo reale */}
        <DebugOverlay />
        
        {/* DebugExpose - Espone variabili Three.js in window.__DEBUG per console debugging */}
        <DebugExpose />
        
        {/* Griglia di riferimento per vedere il livello del terreno */}
        <gridHelper args={[100, 100]} position={[0, 0.01, 0]} />
        
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
            sceneType="cucina"
            spawnNodeName="INIZIO_CUCINA"
            onObjectClick={handleObjectClick} 
            modelRef={setModelRef} 
            enableShadows={!isMobile}
            mobileSmartAntaAperta={mobileSmartAntaAperta}
            pentolaSuiFornelli={pentolaSuiFornelli}
          />
          
          <GroundPlane onGroundReady={setGroundPlaneRef} />
          
          {!isMobile && <Environment preset="apartment" />}
        </Suspense>
      </Canvas>
    </div>
  )
}
