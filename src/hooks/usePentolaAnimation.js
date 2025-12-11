// usePentolaAnimation.js
// Hook per animare la pentola dalla posizione attuale ai fornelli
// Pattern basato su useAntaCucina.js con animazione di posizione invece di rotazione

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Velocita' di movimento (unita' al secondo)
const SPEED_UNITS_PER_SEC = 2.0

/**
 * Hook per animare la pentola verso i fornelli
 * @param {THREE.Object3D} scene - La scena/gruppo contenente la pentola e i fornelli
 * @param {boolean} suiFornelli - true = pentola sui fornelli, false = pentola nella posizione originale
 * @param {Object} options - Opzioni di configurazione
 * @param {string} options.pentolaPattern - Pattern per trovare la mesh della pentola (default: 'PENTOLA')
 * @param {string} options.fornelliPattern - Pattern per trovare i fornelli (default: 'Feu_446')
 * @param {number} options.offsetY - Offset verticale sopra i fornelli (default: 0.5)
 */
export function usePentolaAnimation(scene, suiFornelli, options = {}) {
  const {
    pentolaPattern = 'PENTOLA',
    fornelliPattern = 'Feu_446',
    offsetY = 0.5
  } = options

  const pentolaMesh = useRef(null)
  const posizioneOriginale = useRef(null)
  const posizioneTarget = useRef(null)
  const inizializzato = useRef(false)
  const animazioneInCorso = useRef(false)

  // Setup: trova la pentola e i fornelli, salva le posizioni
  useEffect(() => {
    if (!scene || inizializzato.current) return

    let pentola = null
    let fornelli = null

    // Cerca la pentola e i fornelli nella scena (case insensitive)
    scene.traverse((child) => {
      if (child.isMesh || child.isGroup || child.isObject3D) {
        const name = child.name || ''
        
        // Cerca la pentola
        if (name.toUpperCase().includes(pentolaPattern.toUpperCase())) {
          pentola = child
        }
        
        // Cerca i fornelli
        if (name.toLowerCase().includes(fornelliPattern.toLowerCase())) {
          fornelli = child
        }
      }
    })

    if (!pentola) {
      console.warn(`[usePentolaAnimation] Pentola non trovata per pattern: ${pentolaPattern}`)
      return
    }

    if (!fornelli) {
      console.warn(`[usePentolaAnimation] Fornelli non trovati per pattern: ${fornelliPattern}`)
      return
    }

    console.log(`[usePentolaAnimation] Pentola: "${pentola.name}", Fornelli: "${fornelli.name}"`)

    pentolaMesh.current = pentola

    // Salva la posizione originale della pentola
    posizioneOriginale.current = pentola.position.clone()

    // Calcola la posizione target (sopra i fornelli)
    const fornelliWorldPos = new THREE.Vector3()
    fornelli.getWorldPosition(fornelliWorldPos)
    
    // Converti in coordinate locali rispetto al parent della pentola
    if (pentola.parent) {
      const targetLocal = pentola.parent.worldToLocal(fornelliWorldPos.clone())
      // Aggiungi offset Y per posizionare la pentola sopra i fornelli
      targetLocal.y += offsetY
      posizioneTarget.current = targetLocal
    } else {
      fornelliWorldPos.y += offsetY
      posizioneTarget.current = fornelliWorldPos
    }
    
    console.log(`[usePentolaAnimation] Target position:`, posizioneTarget.current)

    inizializzato.current = true
  }, [scene, pentolaPattern, fornelliPattern, offsetY])

  // Animazione della pentola con lerp
  useFrame((_, delta) => {
    if (!pentolaMesh.current || !posizioneOriginale.current || !posizioneTarget.current) return

    const target = suiFornelli ? posizioneTarget.current : posizioneOriginale.current
    const currentPos = pentolaMesh.current.position

    // Calcola la distanza dal target
    const distanza = currentPos.distanceTo(target)

    // Se siamo abbastanza vicini, snap alla posizione finale
    if (distanza < 0.01) {
      if (animazioneInCorso.current) {
        currentPos.copy(target)
        animazioneInCorso.current = false
        console.log(`[usePentolaAnimation] Animazione completata - pentola ${suiFornelli ? 'sui fornelli' : 'nella posizione originale'}`)
      }
      return
    }

    animazioneInCorso.current = true

    // Movimento smooth con lerp basato su delta time
    const lerpFactor = Math.min(1, SPEED_UNITS_PER_SEC * delta / distanza)
    currentPos.lerp(target, lerpFactor)
  })

  return { pentolaMesh, posizioneOriginale, posizioneTarget, animazioneInCorso }
}

export default usePentolaAnimation
