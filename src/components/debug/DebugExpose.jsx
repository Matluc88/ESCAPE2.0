import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * DebugExpose - Espone oggetti Three.js nella console per debugging
 * 
 * ATTENZIONE: Questo componente è solo per debug.
 * Rimuovere o disabilitare in produzione per sicurezza e performance.
 * 
 * Uso nella console:
 * - window.__DEBUG.scene
 * - window.__DEBUG.camera
 * - window.__DEBUG.playerRoot
 * - window.__DEBUG.collisionObjects
 * - window.THREE (per accedere a THREE.Vector3, etc.)
 * 
 * Esempi di snippet da eseguire nella console:
 * 
 * // Ground list
 * const grounds = []
 * window.__DEBUG.scene.traverse(c => { 
 *   if (c.isMesh && c.userData && c.userData.ground) { 
 *     const p = new THREE.Vector3()
 *     c.getWorldPosition(p)
 *     grounds.push({name: c.name, worldY: +p.y.toFixed(3)})
 *   }
 * })
 * console.log('GROUND LIST', grounds.slice(0, 8))
 * 
 * // Camera and playerRoot world positions
 * const camW = new THREE.Vector3()
 * window.__DEBUG.camera.getWorldPosition(camW)
 * console.log('camera.worldPos', camW)
 * 
 * const prW = new THREE.Vector3()
 * if (window.__DEBUG.playerRoot) {
 *   window.__DEBUG.playerRoot.getWorldPosition(prW)
 *   console.log('playerRoot.worldPos', prW)
 * }
 * 
 * // Collision objects info
 * console.log('collisionObjects length', window.__DEBUG.collisionObjects?.length)
 * console.log('first 5 collisionObjects', window.__DEBUG.collisionObjects?.slice(0, 5).map(o => o.name))
 * 
 * @param {Object} props
 * @param {React.RefObject} props.playerRootRef - Ref al nodo root del player
 * @param {React.RefObject} props.collisionObjectsRef - Ref all'array di collision objects
 */
function DebugExpose({ playerRootRef, collisionObjectsRef }) {
  const { scene, camera, gl } = useThree()

  useEffect(() => {
    // Espone solo per debug: rimuovere in produzione
    window.__DEBUG = window.__DEBUG || {}
    window.__DEBUG.scene = scene
    window.__DEBUG.camera = camera
    window.__DEBUG.renderer = gl
    
    if (playerRootRef && playerRootRef.current) {
      window.__DEBUG.playerRoot = playerRootRef.current
    }
    
    if (collisionObjectsRef && collisionObjectsRef.current) {
      window.__DEBUG.collisionObjects = collisionObjectsRef.current
    }

    // Espone THREE globalmente per facilitare l'uso nella console
    window.THREE = THREE

    console.log('%c[DebugExpose] 🔧 Debug vars exposed on window.__DEBUG', 'color: #00ff00; font-weight: bold')
    console.log('[DebugExpose] Available:', {
      scene: !!window.__DEBUG.scene,
      camera: !!window.__DEBUG.camera,
      renderer: !!window.__DEBUG.renderer,
      playerRoot: !!window.__DEBUG.playerRoot,
      collisionObjects: !!window.__DEBUG.collisionObjects,
      THREE: !!window.THREE
    })
    
    // Pulizia quando il componente si smonta
    return () => {
      if (window.__DEBUG) {
        delete window.__DEBUG.scene
        delete window.__DEBUG.camera
        delete window.__DEBUG.renderer
        delete window.__DEBUG.playerRoot
        delete window.__DEBUG.collisionObjects
      }
      console.log('[DebugExpose] Cleaned up debug vars')
    }
  }, [scene, camera, gl, playerRootRef, collisionObjectsRef])

  return null
}

export default DebugExpose
