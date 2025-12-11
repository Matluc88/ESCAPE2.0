import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { Suspense, useState, useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFPSControls } from '../../hooks/useFPSControls'

/**
 * DebugCollisionScene - A clean test scene with 4 BOX walls for pure collision verification
 * 
 * This scene is designed to test and debug the camera collision system without
 * the complexity of real 3D models. It provides:
 * - 4 simple box walls forming a room
 * - A floor plane
 * - Visual gizmos for sphere-cast rays, hit points, and normals
 * - Clear, predictable geometry for collision testing
 */

// Debug gizmo component that visualizes collision rays and hit points
function DebugGizmos({ debugDataRef }) {
  const [gizmoData, setGizmoData] = useState({ rays: [], alerts: [] })
  
  useFrame(() => {
    if (debugDataRef?.current) {
      const data = debugDataRef.current
      // Only update if frame changed
      if (data.lastFrameId !== gizmoData.lastFrameId) {
        setGizmoData({
          rays: data.sphereCastRays || [],
          alerts: data.proximityAlerts || [],
          lastFrameId: data.lastFrameId
        })
      }
    }
  })
  
  return (
    <group name="DebugGizmos">
      {/* Render sphere-cast rays */}
      {gizmoData.rays.map((ray, i) => {
        if (!ray.origin || !ray.direction) return null
        
        const end = new THREE.Vector3()
          .copy(ray.origin)
          .addScaledVector(ray.direction, ray.length || 1)
        
        return (
          <group key={`ray-${i}`}>
            {/* Ray line - green for miss, red for hit */}
            <Line
              points={[ray.origin.toArray(), end.toArray()]}
              color={ray.hit ? '#ff0000' : '#00ff00'}
              lineWidth={ray.hit ? 2 : 1}
            />
            
            {/* Hit point sphere */}
            {ray.hit && ray.hitPoint && (
              <mesh position={ray.hitPoint.toArray()}>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshBasicMaterial color="#ffff00" />
              </mesh>
            )}
            
            {/* Normal arrow at hit point */}
            {ray.hit && ray.hitPoint && ray.normal && (
              <Line
                points={[
                  ray.hitPoint.toArray(),
                  new THREE.Vector3()
                    .copy(ray.hitPoint)
                    .addScaledVector(ray.normal, 0.3)
                    .toArray()
                ]}
                color="#00ffff"
                lineWidth={2}
              />
            )}
          </group>
        )
      })}
      
      {/* Render proximity alerts as warning spheres */}
      {gizmoData.alerts.map((alert, i) => (
        <mesh key={`alert-${i}`} position={alert.position?.toArray() || [0, 0, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color="#ff6600" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

// Simple FPS controller for the debug scene
function DebugFPSController({ collisionObjects, mobileInput, boundaryLimits, initialPosition }) {
  const { camera } = useThree()
  
  // Use the FPS controls hook with debug-friendly settings
  useFPSControls(
    collisionObjects,
    mobileInput,
    [], // No ground objects - use flat floor
    boundaryLimits,
    initialPosition,
    0, // Initial yaw
    1.6, // Eye height
    0.3, // Collision radius
    1.8 // Player height
  )
  
  return null
}

// Wall component - a simple box that acts as a collision wall
function Wall({ position, size, rotation = [0, 0, 0], color = '#888888', name }) {
  return (
    <mesh position={position} rotation={rotation} name={name} userData={{ collidable: true }}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

// Floor component
function Floor({ size = [20, 20], position = [0, 0, 0] }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} name="floor" userData={{ ground: true, collidable: true }}>
      <planeGeometry args={size} />
      <meshStandardMaterial color="#cccccc" />
    </mesh>
  )
}

export default function DebugCollisionScene({ onObjectClick, mobileInput, isMobile = false }) {
  const [collisionObjects, setCollisionObjects] = useState([])
  const wallRefs = useRef([])
  const debugDataRef = useRef({
    sphereCastRays: [],
    proximityAlerts: [],
    lastFrameId: 0
  })
  
  // Room dimensions
  const ROOM_SIZE = 10
  const WALL_HEIGHT = 3
  const WALL_THICKNESS = 0.2
  
  // Boundary limits based on room size
  const boundaryLimits = useMemo(() => ({
    minX: -ROOM_SIZE / 2 + 1,
    maxX: ROOM_SIZE / 2 - 1,
    minZ: -ROOM_SIZE / 2 + 1,
    maxZ: ROOM_SIZE / 2 - 1
  }), [])
  
  // Initial spawn position at room center
  const initialPosition = useMemo(() => ({
    x: 0,
    y: 0,
    z: 0
  }), [])
  
  // Collect wall refs for collision detection
  useEffect(() => {
    // Filter out null refs and set collision objects
    const validWalls = wallRefs.current.filter(ref => ref !== null)
    setCollisionObjects(validWalls)
  }, [])
  
  // Callback to register wall meshes
  const registerWall = (index) => (mesh) => {
    if (mesh) {
      wallRefs.current[index] = mesh
      // Update collision objects when all walls are registered
      if (wallRefs.current.filter(r => r !== null).length === 4) {
        setCollisionObjects([...wallRefs.current])
      }
    }
  }
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 1.6, 0], fov: 75, near: 0.1 }}
        shadows={!isMobile}
        dpr={isMobile ? [1, 1.2] : [1, 2]}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow={!isMobile} />
        
        <DebugFPSController
          collisionObjects={collisionObjects}
          mobileInput={mobileInput}
          boundaryLimits={boundaryLimits}
          initialPosition={initialPosition}
        />
        
        <Suspense fallback={null}>
          {/* Floor */}
          <Floor size={[ROOM_SIZE, ROOM_SIZE]} />
          
          {/* 4 Walls forming a simple room */}
          {/* North wall (-Z) */}
          <mesh
            ref={registerWall(0)}
            position={[0, WALL_HEIGHT / 2, -ROOM_SIZE / 2]}
            name="wall_north"
            userData={{ collidable: true }}
          >
            <boxGeometry args={[ROOM_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
            <meshStandardMaterial color="#ff6666" />
          </mesh>
          
          {/* South wall (+Z) */}
          <mesh
            ref={registerWall(1)}
            position={[0, WALL_HEIGHT / 2, ROOM_SIZE / 2]}
            name="wall_south"
            userData={{ collidable: true }}
          >
            <boxGeometry args={[ROOM_SIZE, WALL_HEIGHT, WALL_THICKNESS]} />
            <meshStandardMaterial color="#66ff66" />
          </mesh>
          
          {/* East wall (+X) */}
          <mesh
            ref={registerWall(2)}
            position={[ROOM_SIZE / 2, WALL_HEIGHT / 2, 0]}
            name="wall_east"
            userData={{ collidable: true }}
          >
            <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE]} />
            <meshStandardMaterial color="#6666ff" />
          </mesh>
          
          {/* West wall (-X) */}
          <mesh
            ref={registerWall(3)}
            position={[-ROOM_SIZE / 2, WALL_HEIGHT / 2, 0]}
            name="wall_west"
            userData={{ collidable: true }}
          >
            <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE]} />
            <meshStandardMaterial color="#ffff66" />
          </mesh>
          
          {/* Debug gizmos for visualizing collision rays */}
          <DebugGizmos debugDataRef={debugDataRef} />
          
          {/* Center marker to help with orientation */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.4, 0.5, 32]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          
          {/* Axis indicators */}
          <Line points={[[0, 0.1, 0], [2, 0.1, 0]]} color="#ff0000" lineWidth={3} /> {/* X axis - red */}
          <Line points={[[0, 0.1, 0], [0, 2.1, 0]]} color="#00ff00" lineWidth={3} /> {/* Y axis - green */}
          <Line points={[[0, 0.1, 0], [0, 0.1, 2]]} color="#0000ff" lineWidth={3} /> {/* Z axis - blue */}
        </Suspense>
      </Canvas>
      
      {/* Debug info overlay */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        color: 'white',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        pointerEvents: 'none'
      }}>
        <div><strong>Debug Collision Scene</strong></div>
        <div>Room: {ROOM_SIZE}m x {ROOM_SIZE}m</div>
        <div>Walls: North(red), South(green), East(blue), West(yellow)</div>
        <div>Check browser console for collision logs</div>
        <div style={{ marginTop: '5px', color: '#aaa' }}>
          WASD to move, Mouse to look
        </div>
      </div>
    </div>
  )
}
