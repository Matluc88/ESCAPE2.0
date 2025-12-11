import { useLayoutEffect, useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3, MeshStandardMaterial, Color } from 'three'
import { applyAutoCollisionTags } from '../../utils/autoCollisionTags'
import { useCancello, useCancelletto } from '../../hooks/useCancello'

// LED INDIZIO SERRA UUID from the 3D model
const LED_SERRA_UUID = 'F1A5A79E-2A29-4D51-91F2-64C12C32521D'

export default function EsternoModel({ 
  onObjectClick, 
  modelRef, 
  enableShadows = true,
  cancelloAperto = false,
  cancellettoAperto = false,
  ledSerraVerde = false  // LED INDIZIO SERRA: false = red, true = green
}) {
  // Use Draco-compressed model (same as kitchen, just renamed for organization)
  const { scene } = useGLTF('/models/esterno.glb', true) // true enables Draco decoder
  const groupRef = useRef()
  const ledSerraRef = useRef(null)  // Reference to the LED INDIZIO SERRA mesh

  // Use same scale as kitchen model for consistency
  const ESTERNO_SCALE = 7
  
  // Gate animation hooks - animate the double gate and pedestrian gate
  useCancello(scene, cancelloAperto, { modalita: 'realistico' })
  useCancelletto(scene, cancellettoAperto)
  
  // Find and store reference to LED INDIZIO SERRA mesh
  useEffect(() => {
    if (!scene) return
    
    scene.traverse((obj) => {
      if (obj.isMesh && obj.name && obj.name.includes(LED_SERRA_UUID)) {
        console.log('[EsternoModel] Found LED INDIZIO SERRA:', obj.name)
        ledSerraRef.current = obj
        
        // Create emissive material for LED effect
        const ledMaterial = new MeshStandardMaterial({
          color: new Color(0xff0000),  // Start with red
          emissive: new Color(0xff0000),
          emissiveIntensity: 2.0,
          metalness: 0.5,
          roughness: 0.3
        })
        obj.material = ledMaterial
      }
    })
  }, [scene])
  
  // Update LED color when ledSerraVerde prop changes
  useEffect(() => {
    if (!ledSerraRef.current) return
    
    const ledColor = ledSerraVerde ? new Color(0x00ff00) : new Color(0xff0000)
    const material = ledSerraRef.current.material
    
    if (material) {
      material.color = ledColor
      material.emissive = ledColor
      console.log('[EsternoModel] LED INDIZIO SERRA color changed to:', ledSerraVerde ? 'GREEN' : 'RED')
    }
  }, [ledSerraVerde])

  useLayoutEffect(() => {
    if (!scene || !groupRef.current) return
    
    // Scale the scene (same as kitchen)
    scene.scale.set(ESTERNO_SCALE, ESTERNO_SCALE, ESTERNO_SCALE)
    scene.updateWorldMatrix(true, true)
    
    // Apply auto collision tags to all meshes in the scene
    // This must happen BEFORE collision checks start
    applyAutoCollisionTags(scene, true)
    
    // Calculate bounding box
    const box = new Box3().setFromObject(scene)
    const minY = box.min.y
    const maxY = box.max.y
    const center = new Vector3()
    box.getCenter(center)
    
    console.log('[EsternoModel] Bounding box after scaling:', {
      minY: minY,
      maxY: maxY,
      height: maxY - minY,
      center: { x: center.x, y: center.y, z: center.z }
    })
    
    // Find the GIARDINO mesh (the garden floor where the player walks)
    // This should be aligned with the green ground plane at Y=0
    // GIARDINO is the outdoor floor, while Terra is the grass/plants that grow on top
    let giardinoMesh = null
    const allMeshes = []
    scene.traverse((obj) => {
      if (obj.isMesh) {
        allMeshes.push(obj)
        // Look for GIARDINO mesh by name (case-insensitive)
        if (obj.name.toLowerCase().includes('giardino')) {
          giardinoMesh = obj
        }
      }
    })
    
    let targetGroundY = minY // fallback to overall minY
    
    if (giardinoMesh) {
      // Use GIARDINO's minY (bottom of the garden floor) for alignment
      // This puts the garden floor at Y=0, where the player walks
      const giardinoBox = new Box3().setFromObject(giardinoMesh)
      targetGroundY = giardinoBox.min.y
      console.log('[EsternoModel] Found GIARDINO mesh:', giardinoMesh.name)
      console.log('[EsternoModel] Using GIARDINO minY for alignment:', targetGroundY)
      console.log('[EsternoModel] GIARDINO bounds:', { minY: giardinoBox.min.y, maxY: giardinoBox.max.y })
    } else {
      console.log('[EsternoModel] GIARDINO mesh not found, using overall minY:', minY)
    }
    
    // Collect ground-tagged meshes for debug info
    const groundMeshes = allMeshes.filter(obj => obj.userData.ground === true)
    const meshBounds = groundMeshes.map((mesh) => {
      const meshBox = new Box3().setFromObject(mesh)
      return { name: mesh.name, minY: meshBox.min.y, maxY: meshBox.max.y }
    })
    
    // Store debug info on window for easy inspection
    window.__esternoDebug = {
      overallBox: { minY, maxY, height: maxY - minY },
      groundMeshes: meshBounds,
      giardinoMesh: giardinoMesh ? giardinoMesh.name : null,
      targetGroundY
    }
    
    console.log('[EsternoModel] Debug info stored on window.__esternoDebug')
    console.log('[EsternoModel] Ground-tagged meshes:', meshBounds)
    
    // Reposition the GROUP - centers the model and puts the GROUND at Y=0
    // Using targetGroundY ensures the visible grass aligns with the green ground plane
    groupRef.current.position.set(-center.x, -targetGroundY, -center.z)
    
    console.log('[EsternoModel] Group position after repositioning:', {
      x: groupRef.current.position.x,
      y: groupRef.current.position.y,
      z: groupRef.current.position.z
    })
    
    // Update world matrices after repositioning
    groupRef.current.updateWorldMatrix(true, true)
    
    scene.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = enableShadows
        object.receiveShadow = enableShadows
      }
    })
    
    // Pass the model ref to parent
    if (modelRef) {
      modelRef({ current: groupRef.current })
    }
  }, [scene, enableShadows])

  const handleClick = (event) => {
    event.stopPropagation()
    const clickedObject = event.object
    console.log('Clicked object:', clickedObject.name || 'unnamed', clickedObject)
    
    if (clickedObject.name && onObjectClick) {
      onObjectClick(clickedObject.name)
    }
  }

  const handlePointerOver = (event) => {
    event.stopPropagation()
    document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = (event) => {
    event.stopPropagation()
    document.body.style.cursor = 'default'
  }

  return (
    <group 
      ref={groupRef}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/models/esterno.glb', true) // Preload with Draco decoder
