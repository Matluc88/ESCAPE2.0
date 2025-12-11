// useAntaCucina.js
// Hook per animare l'anta del mobile smart cucina con pivot sul cardine
// Pattern basato su useCancello.js ma semplificato per anta singola

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Velocita' di apertura/chiusura (gradi al secondo)
const SPEED_DEG_PER_SEC = 90 // 90 gradi in 1 secondo

/**
 * Hook per animare un'anta di mobile cucina
 * @param {THREE.Object3D} scene - La scena/gruppo contenente l'anta
 * @param {boolean} aperto - true = anta aperta, false = anta chiusa
 * @param {Object} options - Opzioni di configurazione
 * @param {string} options.meshPattern - Pattern per trovare la mesh dell'anta (es: 'door_511')
 * @param {number} options.angoloApertura - Angolo di apertura in gradi (default: 90)
 * @param {string} options.lato - Lato del cardine: 'sinistra' o 'destra' (default: 'sinistra')
 * @param {string} options.asse - Asse di rotazione: 'y' o 'z' (default: 'y')
 */
export function useAntaCucina(scene, aperto, options = {}) {
  const {
    meshPattern = 'door_511',
    angoloApertura = 90,
    lato = 'sinistra',
    asse = 'y'
  } = options

  const pivot = useRef(null)
  const direzione = useRef(lato === 'sinistra' ? -1 : 1)
  const inizializzato = useRef(false)
  const posizioneCorrente = useRef(0)

  // Setup del pivot dinamico sul bordo dell'anta
  useEffect(() => {
    if (!scene || inizializzato.current) return

    let antaMesh = null

    // Cerca direttamente la mesh dell'anta usando il pattern (case insensitive)
    // Se il pattern contiene '+', lo trattiamo come AND di piu' pattern
    const patterns = meshPattern.toLowerCase().split('+').map(p => p.trim())
    
    scene.traverse((child) => {
      if (child.isMesh && child.name) {
        const nameLower = child.name.toLowerCase()
        
        // Verifica che TUTTI i pattern siano presenti nel nome
        const matchesAllPatterns = patterns.every(pattern => nameLower.includes(pattern))
        
        if (matchesAllPatterns) {
          console.log(`[useAntaCucina] Found matching anta: "${child.name}"`)
          antaMesh = child
        }
      }
    })

    if (!antaMesh) {
      console.warn(`[useAntaCucina] Anta mesh non trovata per pattern: ${meshPattern}`)
      return
    }

    console.log(`[useAntaCucina] Selected anta: ${antaMesh.name}`)

    // Crea il pivot sul bordo dell'anta (cardine)
    const creaPivotSuBordo = (mesh, latoCardine) => {
      if (!mesh || !mesh.parent) return null

      mesh.updateWorldMatrix(true, true)

      const box = new THREE.Box3().setFromObject(mesh)
      const center = new THREE.Vector3()
      box.getCenter(center)

      // Posizione del pivot sul bordo (cardine)
      let pivotWorldPos
      if (latoCardine === 'sinistra') {
        pivotWorldPos = new THREE.Vector3(box.min.x, center.y, center.z)
      } else {
        pivotWorldPos = new THREE.Vector3(box.max.x, center.y, center.z)
      }

      const parent = mesh.parent
      const pivotLocalPos = parent.worldToLocal(pivotWorldPos.clone())

      const pivotGroup = new THREE.Group()
      pivotGroup.name = `PIVOT_${mesh.name}`
      pivotGroup.position.copy(pivotLocalPos)

      parent.add(pivotGroup)

      // Attach la mesh al pivot senza offset aggiuntivi
      pivotGroup.attach(mesh)

      return {
        pivot: pivotGroup,
        direzione: latoCardine === 'sinistra' ? -1 : 1
      }
    }

    const result = creaPivotSuBordo(antaMesh, lato)
    if (result) {
      pivot.current = result.pivot
      direzione.current = result.direzione
      console.log(`[useAntaCucina] Pivot creato per ${antaMesh.name}, direzione: ${result.direzione}`)
    }

    inizializzato.current = true
  }, [scene, meshPattern, lato])

  // Animazione dell'anta
  useFrame((_, delta) => {
    if (!pivot.current) return

    const targetGradi = aperto ? angoloApertura : 0
    const gradiToRad = (g) => (g * Math.PI) / 180

    // Calcola lo step di movimento per questo frame
    const step = SPEED_DEG_PER_SEC * delta

    // Muovi verso il target
    if (aperto && posizioneCorrente.current < targetGradi) {
      posizioneCorrente.current = Math.min(targetGradi, posizioneCorrente.current + step)
    } else if (!aperto && posizioneCorrente.current > 0) {
      posizioneCorrente.current = Math.max(0, posizioneCorrente.current - step)
    }

    // Applica la rotazione sull'asse corretto
    const rotazione = direzione.current * gradiToRad(posizioneCorrente.current)
    if (asse === 'y') {
      pivot.current.rotation.y = rotazione
    } else {
      pivot.current.rotation.z = rotazione
    }
  })

  return { pivot, posizioneCorrente }
}

export default useAntaCucina
