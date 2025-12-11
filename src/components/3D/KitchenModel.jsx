import { useLayoutEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import { applyAutoCollisionTags, getCollidableMeshes } from '../../utils/autoCollisionTags'
import { useAntaCucina } from '../../hooks/useAntaCucina'
import { usePentolaAnimation } from '../../hooks/usePentolaAnimation'

export default function KitchenModel({ onObjectClick, modelRef, enableShadows = true, mobileSmartAntaAperta = false, pentolaSuiFornelli = false }) {
  // Use Draco-compressed model for faster loading (40MB vs 189MB original)
  const { scene } = useGLTF('/models/cucina_compressed.glb', true) // true enables Draco decoder
  const groupRef = useRef()

  const KITCHEN_SCALE = 7
  
  // Hook per animare l'anta del mobile smart cucina (contiene la pentola)
  // Usa pattern combinato: deve contenere ENTRAMBI "mobile smart" E "door_511"
  // per evitare di aprire altre porte/ante che contengono solo "door_511"
  // asse: 'z' per aprire come un cancello (non perpendicolare al pavimento)
  // lato: 'destra' per aprire verso l'esterno (opposto al cancello che apre verso l'interno)
  useAntaCucina(scene, mobileSmartAntaAperta, {
    meshPattern: 'mobile smart + door_511',
    lato: 'destra',
    angoloApertura: 90,
    asse: 'z'
  })
  
  // Hook per animare la pentola verso i fornelli (Tasto B)
  // Usa Feu_1_460 che e' il piano cottura visibile, con offset ridotto
  usePentolaAnimation(scene, pentolaSuiFornelli, {
    pentolaPattern: 'PENTOLA',
    fornelliPattern: 'Feu_1_460',
    offsetY: 0.1
  })

    useLayoutEffect(() => {
      if (!scene || !groupRef.current) return
    
      // Scale the scene
      scene.scale.set(KITCHEN_SCALE, KITCHEN_SCALE, KITCHEN_SCALE)
      scene.updateWorldMatrix(true, true)
    
        // Apply auto collision tags to all meshes in the scene
        // This must happen BEFORE collision checks start
        applyAutoCollisionTags(scene, true)
    
        // Diagnostic logging: verify collidable objects count after auto-tagging
        const collidableMeshes = getCollidableMeshes(scene)
        console.log('[KitchenModel] After applyAutoCollisionTags - collidable meshes in scene:', collidableMeshes.length)
        console.log('[KitchenModel] First 10 collidable mesh names:', collidableMeshes.slice(0, 10).map(m => m.name))
    
    // Calculate bounding box
    const box = new Box3().setFromObject(scene)
    const minY = box.min.y
    const maxY = box.max.y
    const center = new Vector3()
    box.getCenter(center)
    
    console.log('[KitchenModel] Bounding box after scaling:', {
      minY: minY,
      maxY: maxY,
      height: maxY - minY,
      center: { x: center.x, y: center.y, z: center.z }
    })
    
    // Reposition the GROUP (not the scene) - same pattern as EsternoModel
    // This centers the model and puts the floor at Y=0
    groupRef.current.position.set(-center.x, -minY, -center.z)
    
    console.log('[KitchenModel] Group position after repositioning:', {
      x: groupRef.current.position.x,
      y: groupRef.current.position.y,
      z: groupRef.current.position.z
    })
    console.log('[KitchenModel] Floor should now be at Y=0, ceiling at Y=', maxY - minY)
    
    // Update world matrices after repositioning to ensure getWorldPosition is accurate
    groupRef.current.updateWorldMatrix(true, true)
    
    // Find spawn point reference - priority order:
    // 1. POSIZIONE_INIZIALE or INIZIO SCENA CUCINA (exact position markers)
    // 2. MANIGLIA PORTA CUCINA or MANIGLIA_PORTA (door handle with +2.0 Z offset)
    let spawnPoint = null
    let manigliaPosizione = null
    
    scene.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = enableShadows
        object.receiveShadow = enableShadows
        
        // FIX 3: Log ground-tagged objects for debugging
        if (object.userData.ground === true) {
          console.log('[GROUND TAG] Ground object:', object.name)
        }
      }
      
      if (object.name) {
        const nameUpper = object.name.toUpperCase()
        
        // Primary spawn markers: POSIZIONE_INIZIALE or INIZIO SCENA CUCINA
        // Use exact world position after group repositioning - highest priority
        if (nameUpper.includes('POSIZIONE_INIZIALE') || nameUpper.includes('INIZIO SCENA CUCINA') || nameUpper.includes('INIZIO_SCENA_CUCINA')) {
          const worldPos = new Vector3()
          object.getWorldPosition(worldPos)
          console.log('[KitchenModel] Found spawn marker:', object.name, 'worldPos:', { x: worldPos.x, y: worldPos.y, z: worldPos.z })
          // Use actual worldPos.y - the marker position is correct after group repositioning
          spawnPoint = { x: worldPos.x, y: worldPos.y, z: worldPos.z }
        }
        
        // Fallback spawn markers: MANIGLIA PORTA CUCINA or MANIGLIA_PORTA
        // Save as fallback (only use if primary markers not found)
        if (!manigliaPosizione && (nameUpper.includes('MANIGLIA PORTA CUCINA') || nameUpper.includes('MANIGLIA_PORTA_CUCINA') || nameUpper.includes('MANIGLIA_PORTA'))) {
          const worldPos = new Vector3()
          object.getWorldPosition(worldPos)
          console.log('[KitchenModel] Found door handle fallback:', object.name, 'worldPos:', { x: worldPos.x, y: worldPos.y, z: worldPos.z })
          // Use actual worldPos.y - the marker position is correct after group repositioning
          manigliaPosizione = { x: worldPos.x, y: worldPos.y, z: worldPos.z + 2.0 }
        }
      }
    })
    
    // Use door handle as fallback if primary spawn markers were not found
    if (!spawnPoint && manigliaPosizione) {
      spawnPoint = manigliaPosizione
      console.log('[KitchenModel] Using door handle as spawn fallback')
    }
    
    // Pass the model ref and spawn point to parent
    if (modelRef) {
      modelRef({ current: groupRef.current, spawnPoint })
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

useGLTF.preload('/models/cucina_compressed.glb', true) // Preload with Draco decoder
