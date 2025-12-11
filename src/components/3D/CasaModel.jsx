import { useLayoutEffect, useRef, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3, MeshStandardMaterial, Color, Raycaster } from 'three'
import { useThree } from '@react-three/fiber'
import { applyAutoCollisionTags, getCollidableMeshes } from '../../utils/autoCollisionTags'
import { useAntaCucina } from '../../hooks/useAntaCucina'
import { usePentolaAnimation } from '../../hooks/usePentolaAnimation'
import { useCancello, useCancelletto } from '../../hooks/useCancello'

const LED_SERRA_UUID = 'F1A5A79E-2A29-4D51-91F2-64C12C32521D'

/** Teleport e Snap: Posiziona e incolla al pavimento */
function teleportAndSnap(spawnPoint, scene, camera, eyeHeight = 1.3) {
  if (!spawnPoint || !camera) return

  // 1. Posizione Base
  const pos = new Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z)
  
  // 2. Raycast verticale per trovare il pavimento esatto
  const raycaster = new Raycaster(
    new Vector3(pos.x, pos.y + 5, pos.z), // Parti dall'alto
    new Vector3(0, -1, 0),                // Spara in basso
    0, 
    20 // Max distanza
  )
  
  // Cerca intersezioni con tutto
  const hits = raycaster.intersectObjects(scene.children, true)
  
  let finalY = pos.y
  
  // Filtra solo oggetti che sembrano pavimenti o solidi
  const groundHit = hits.find(h => h.object.isMesh && (h.object.userData.ground || h.object.userData.collidable))
  
  if (groundHit) {
      console.log(`[CasaModel] 🦶 SNAP TO GROUND: Trovato "${groundHit.object.name}" a Y=${groundHit.point.y.toFixed(3)}`)
      finalY = groundHit.point.y + eyeHeight
  } else {
      console.warn(`[CasaModel] ⚠️ Nessun pavimento sotto lo spawn. Uso Y predefinita.`)
      finalY = pos.y + (eyeHeight > 2 ? 0 : eyeHeight) // Se spawn è a terra, aggiungi eyeHeight
  }

  camera.position.set(pos.x, finalY, pos.z)
  camera.updateMatrixWorld(true)
  console.log(`[CasaModel] 📸 Camera Teleported to: ${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}`)
}

export default function CasaModel({ 
  sceneType = 'cucina',
  spawnNodeName = null,
  doorNodeName = null,
  onObjectClick, 
  modelRef, 
  enableShadows = true,
  cancelloAperto = false,
  cancellettoAperto = false,
  ledSerraVerde = false,
  mobileSmartAntaAperta = false,
  pentolaSuiFornelli = false
}) {
  const { scene } = useGLTF('/models/casa.glb', true)
  const groupRef = useRef()
  const ledSerraRef = useRef(null)
  const { camera } = useThree()
  const CASA_SCALE = 10  // Scala 10x per dimensioni realistiche (casa era in scala 1:10)

  const ledMaterial = useMemo(() => new MeshStandardMaterial({
    color: new Color(0xff0000), emissive: new Color(0xff0000), emissiveIntensity: 2.0, metalness: 0.5, roughness: 0.3
  }), [])

  // Animazioni
  if (sceneType === 'cucina') {
    useAntaCucina(scene, mobileSmartAntaAperta, { meshPattern: 'mobile smart + door_511', lato: 'destra', angoloApertura: 90, asse: 'z' })
    usePentolaAnimation(scene, pentolaSuiFornelli, { pentolaPattern: 'PENTOLA', fornelliPattern: 'Feu_1_460', offsetY: 0.1 })
  }
  if (sceneType === 'esterno') {
    useCancello(scene, cancelloAperto, { modalita: 'realistico' })
    useCancelletto(scene, cancellettoAperto)
  }

  // LED Material
  useEffect(() => {
    if (sceneType !== 'esterno' || !scene) return
    scene.traverse((obj) => {
      if (obj.isMesh && obj.name && obj.name.includes(LED_SERRA_UUID)) {
        ledSerraRef.current = obj; obj.material = ledMaterial
      }
    })
  }, [scene, sceneType, ledMaterial])

  useEffect(() => {
    if (sceneType !== 'esterno' || !ledSerraRef.current) return
    const c = ledSerraVerde ? new Color(0x00ff00) : new Color(0xff0000)
    if (ledSerraRef.current.material) { ledSerraRef.current.material.color.copy(c); ledSerraRef.current.material.emissive.copy(c) }
  }, [ledSerraVerde, sceneType])

  useLayoutEffect(() => {
    if (!scene || !groupRef.current) return

    // 0. Pulizia Camere
    scene.traverse(o => { if (o.isCamera && o.parent) o.parent.remove(o) })

    // 1. Scala e Centratura
    scene.scale.set(CASA_SCALE, CASA_SCALE, CASA_SCALE)
    scene.updateWorldMatrix(true, true)
    
    const box = new Box3().setFromObject(scene)
    const center = new Vector3(); box.getCenter(center)
    
    // TROVA IL PAVIMENTO DEL PIANO TERRA (non il minimo assoluto che potrebbe essere la cantina)
    let targetGroundY = box.min.y
    let mainFloorY = null
    
    scene.traverse(o => {
      if (o.isMesh && o.name) {
        const name = o.name.toLowerCase()
        
        // Cerca il pavimento/terreno principale (giardino per esterno, pavimenti per interno)
        let isMainGround = false
        
        if (sceneType === 'esterno') {
          // Per esterno: cerca giardino, prato, terreno
          isMainGround = /giardino|prato|grass|ground|terreno/i.test(name) && !/cantina|basement|seminterrato/i.test(name)
        } else {
          // Per scene interne: cerca pavimenti del piano terra (escludi cantina)
          isMainGround = /pattern|piano|pavimento|floor/i.test(name) && !/cantina|basement|seminterrato/i.test(name)
        }
        
        if (isMainGround) {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
          const objBox = new Box3().setFromObject(o)
          const floorY = objBox.min.y
          
          // Prendi il pavimento più ALTO tra quelli trovati (piano terra/giardino, non cantina)
          if (mainFloorY === null || floorY > mainFloorY) {
            mainFloorY = floorY
            console.log(`[CasaModel] 🏠 ${sceneType === 'esterno' ? 'Giardino' : 'Piano terra'} trovato: "${o.name}" a Y=${floorY.toFixed(3)}`)
          }
        }
      }
    })
    
    if (mainFloorY !== null) {
      targetGroundY = mainFloorY
      console.log(`[CasaModel] ✅ Usando ${sceneType === 'esterno' ? 'giardino' : 'pavimento piano terra'} come riferimento: Y=${targetGroundY.toFixed(3)}`)
    } else {
      console.warn(`[CasaModel] ⚠️ Pavimento principale non trovato, uso min.y=${targetGroundY.toFixed(3)}`)
    }
    
    groupRef.current.position.set(-center.x, -targetGroundY, -center.z)
    groupRef.current.updateWorldMatrix(true, true)

    // 2. Variabili
    let foundSpawnPoint = null
    let gateEyeHeight = null
    const currentScene = sceneType.toLowerCase()
    
    // Mappatura stanze -> pattern oggetti GLB
    // Gli oggetti nel GLB usano nomi diversi dalle stanze (es. "camera" -> oggetti con "letto")
    const roomToObjectPatterns = {
        'camera': ['letto', 'camera'],      // Camera da letto -> oggetti con "letto" o "camera"
        'bagno': ['bagno'],
        'soggiorno': ['soggiorno'],
        'cucina': ['cucina']
    }
    
    // Ottieni i pattern delle altre stanze (non quella corrente)
    const otherRoomPatterns = Object.entries(roomToObjectPatterns)
        .filter(([room]) => room !== currentScene)
        .flatMap(([, patterns]) => patterns)
    
    // Liste per forzare il passaggio al controller
    const forcedCollidables = []
    const forcedGrounds = []

    // 3. Traverse Unico (Visibilità + Spawn + Raccolta Collisioni)
    scene.traverse((child) => {
      const name = child.name ? child.name.toLowerCase() : ''
      
      // Spawn - cerca nodi che iniziano con spawnNodeName (i nodi GLB hanno UUID aggiunto)
      if (spawnNodeName && !foundSpawnPoint) {
         const spawnNameLower = spawnNodeName.toLowerCase()
         // Match esatto O nome che inizia con spawnNodeName (per gestire UUID come INIZIO_CUCINA(UUID))
         if (child.name === spawnNodeName || 
             name === spawnNameLower || 
             name.startsWith(spawnNameLower + '(') ||
             child.name.startsWith(spawnNodeName + '(')) {
             const wp = new Vector3(); child.getWorldPosition(wp)
             foundSpawnPoint = { x: wp.x, y: wp.y, z: wp.z }
             console.log(`[CasaModel] ✅ SPAWN TROVATO: "${child.name}" -> pos:`, foundSpawnPoint)
             child.visible = false 
         }
      }

      if (child.isMesh) {
        // Tagging Pavimenti (Regex Robustissima)
        if (/pattern|гольфстрим|piano|pavimento|floor|terra/i.test(name)) {
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
            const size = child.geometry.boundingBox.getSize(new Vector3()).length()
            if (size > 1.0) { // Ignora oggetti piccoli
                child.userData.ground = true
                child.userData.collidable = true
                forcedGrounds.push(child)
            }
        }
        
        // Visibilità
        if (sceneType === 'esterno') {
            child.visible = true
            if (gateEyeHeight === null && name.includes('cancell')) {
                const b = new Box3().setFromObject(child); const c = new Vector3(); b.getCenter(c); gateEyeHeight = c.y
            }
        } else {
            // Verifica se l'oggetto appartiene ad un'altra stanza usando i pattern corretti
            const belongsToOtherRoom = otherRoomPatterns.some(pattern => name.includes(pattern))
            
            // Se appartiene ad un'altra stanza, nascondi SEMPRE (anche se è strutturale)
            // Eccezione: solo elementi veramente condivisi come ingresso, cantina, ringhiera
            const isSharedStructure = /cantina|ingresso|ringhiera|pattern|body|гольфстрим/i.test(name)
            
            // Elementi strutturali generici (muri, pavimenti, etc.) sono visibili SOLO se:
            // 1. Non appartengono ad altre stanze, OPPURE
            // 2. Sono strutture condivise (ingresso, cantina, etc.)
            const isStructural = /muro|wall|porta|door|finestra|window|vetro|glass|infisso|pavimento|floor|soffitto|ceiling|tetto|roof|piano|terra|maniglia|handle/i.test(name)
            
            let hide = false
            if (belongsToOtherRoom && !isSharedStructure) {
                hide = true
            }
            
            child.visible = !hide
            if (child.visible) {
                 if (child.raycast && child.raycast._bak) delete child.raycast
            } else {
                 child.raycast = () => {}
            }
        }

        // Raccolta Collisioni e Ombre
        if (child.visible) {
            // Se è visibile, consideralo collidabile di default (a meno che non sia escluso esplicitamente)
            if (child.userData.collidable !== false) {
                forcedCollidables.push(child)
            }
        }
        
        child.castShadow = enableShadows
        child.receiveShadow = enableShadows
      }
    })

    // 4. Fallback Spawn
    if (!foundSpawnPoint) {
        foundSpawnPoint = sceneType === 'esterno' ? { x: 0, y: 0, z: box.max.z + 5 } : { x: 0, y: 1.3, z: 0 }
    }

    // 5. Invia al Parent (CON LISTE FORZATE + eyeHeight + playerRoot)
    const humanEyeHeight = 1.6
    const playerRootObj = scene.getObjectByName('PlayerRoot') || null
    
    if (modelRef) {
      console.log(`[CasaModel] Invio liste forzate: ${forcedCollidables.length} collision, ${forcedGrounds.length} grounds`)
      modelRef({ 
        current: groupRef.current, 
        spawnPoint: foundSpawnPoint, 
        gateEyeHeight,
        sceneType,
        // QUI LA MAGIA: Passiamo le liste già pronte
        forcedCollidables,
        forcedGrounds,
        eyeHeight: humanEyeHeight,  // Nuovo sistema
        playerRoot: playerRootObj    // Nuovo sistema (può essere null inizialmente)
      })
      console.log('[CasaModel] exposed playerRoot and eyeHeight to modelRef')
    }

    // 6. Teleport e Snap
    teleportAndSnap(foundSpawnPoint, scene, camera, 1.3)

  }, [scene, enableShadows, sceneType, spawnNodeName, modelRef, camera])

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onObjectClick && onObjectClick(e.object.name) }}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/models/casa.glb', true)
