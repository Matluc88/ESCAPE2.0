// useCancello.js
// Hook per animare il cancello a doppia anta con pivot sui cardini
// Versione FIXATA: deterministica, senza drift, senza sfasamenti casuali

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Costanti Arduino: 135ms per grado, 120ms offset tra le ante
const DEGREE_DELAY_S = 0.135  // 135ms per grado = ~12.15s per 90°
const OFFSET_ANTA2_S = 0.12   // 120ms di ritardo per anta 2
const SPEED_DEG_PER_SEC = 1 / DEGREE_DELAY_S  // ~7.407 gradi/secondo

export function useCancello(scene, aperto, options = {}) {
  const {
    angoloApertura = 90,     // gradi
    modalita = 'realistico' // 'realistico' | 'fluido'
  } = options

  const pivot1 = useRef(null)
  const pivot2 = useRef(null)
  const direzione1 = useRef(-1)
  const direzione2 = useRef(1)
  const inizializzato = useRef(false)

  const posizione1 = useRef(0)
  const posizione2 = useRef(0)
  const elapsedSinceToggle = useRef(0)
  const anta2Started = useRef(false)

  // =========================
  // SETUP PIVOT DINAMICI
  // =========================
  useEffect(() => {
    if (!scene || inizializzato.current) return

    let anta1Mesh = null
    let anta2Mesh = null

    const matchAnta1 = (n) =>
      n.startsWith('CANCELLO ANTA 1') || n.startsWith('CANCELLO_ANTA_1')

    const matchAnta2 = (n) =>
      n.startsWith('CANCELLO ANTA 2') || n.startsWith('CANCELLO_ANTA_2')

    scene.traverse((child) => {
      if (child.isMesh && child.geometry && child.name) {
        if (matchAnta1(child.name)) anta1Mesh = child
        if (matchAnta2(child.name)) anta2Mesh = child
      }
    })

    const creaPivotSuBordo = (mesh, lato) => {
      if (!mesh || !mesh.parent) return null

      mesh.updateWorldMatrix(true, true)

      const box = new THREE.Box3().setFromObject(mesh)
      const center = new THREE.Vector3()
      box.getCenter(center)

      const pivotWorldPos =
        lato === "sinistra"
          ? new THREE.Vector3(box.min.x, center.y, center.z)
          : new THREE.Vector3(box.max.x, center.y, center.z)

      const parent = mesh.parent
      const pivotLocalPos = parent.worldToLocal(pivotWorldPos.clone())

      const pivotGroup = new THREE.Group()
      pivotGroup.name = `PIVOT_${mesh.name}`
      pivotGroup.position.copy(pivotLocalPos)

      parent.add(pivotGroup)

      // ✅ ATTACH SENZA NESSUN OFFSET SUCCESSIVO
      pivotGroup.attach(mesh)

      return {
        pivot: pivotGroup,
        direzione: lato === "sinistra" ? 1 : -1,
      }
    }

    if (anta1Mesh) {
      const r = creaPivotSuBordo(anta1Mesh, 'sinistra')
      if (r) {
        pivot1.current = r.pivot
        direzione1.current = r.direzione
      }
    } else {
      console.warn('⚠️ ANTA 1 non trovata')
    }
    if (pivot1.current) {
      window.DEBUG_PIVOT_1 = pivot1
    }

    if (anta2Mesh) {
      const r = creaPivotSuBordo(anta2Mesh, 'destra')
      if (r) {
        pivot2.current = r.pivot
        direzione2.current = r.direzione
      }
    } else {
      console.warn('⚠️ ANTA 2 non trovata')
    }
    if (pivot2.current) {
      window.DEBUG_PIVOT_2 = pivot2
    }

    inizializzato.current = true
  }, [scene])

  // RESET SINCRO QUANDO CAMBIA APERTO
  useEffect(() => {
    elapsedSinceToggle.current = 0
    anta2Started.current = false
  }, [aperto])

  // =========================
  // ANIMAZIONE
  // =========================
  useFrame((_, delta) => {
    if (!pivot1.current || !pivot2.current) return

    const targetGradi = aperto ? angoloApertura : 0
    const gradiToRad = (g) => (g * Math.PI) / 180

    if (modalita === 'realistico') {
      // Animazione time-based che replica Arduino: 135ms per grado, 120ms offset
      const step = SPEED_DEG_PER_SEC * delta  // gradi per questo frame

      elapsedSinceToggle.current += delta

      // ----- ANTA 1: si muove sempre verso il target -----
      if (aperto && posizione1.current < targetGradi) {
        posizione1.current = Math.min(targetGradi, posizione1.current + step)
      } else if (!aperto && posizione1.current > 0) {
        posizione1.current = Math.max(0, posizione1.current - step)
      }

      pivot1.current.rotation.z =
        direzione1.current * gradiToRad(posizione1.current)

      // ----- ANTA 2: inizia dopo 120ms di ritardo -----
      if (!anta2Started.current && elapsedSinceToggle.current >= OFFSET_ANTA2_S) {
        anta2Started.current = true
      }

      if (anta2Started.current) {
        if (aperto && posizione2.current < targetGradi) {
          posizione2.current = Math.min(targetGradi, posizione2.current + step)
        } else if (!aperto && posizione2.current > 0) {
          posizione2.current = Math.max(0, posizione2.current - step)
        }
      }

      // FORZATURA MATEMATICA CHIUSURA PERFETTA
      if (!aperto && posizione2.current <= step) {
        posizione2.current = 0
      }

      pivot2.current.rotation.z =
        direzione2.current * gradiToRad(posizione2.current)
    } else {
      // === MODALITÀ FLUIDA COERENTE ===
      const targetRad = gradiToRad(targetGradi)
      const velocita = 0.05

      const t1 = direzione1.current * targetRad
      const t2 = direzione2.current * targetRad

      pivot1.current.rotation.z +=
        (t1 - pivot1.current.rotation.z) * velocita

      pivot2.current.rotation.z +=
        (t2 - pivot2.current.rotation.z) * velocita
    }
  })

  return { pivot1, pivot2, posizione1, posizione2 }
}

// =========================
// CANCELLETTO PEDONALE
// =========================
export function useCancelletto(scene, aperto, options = {}) {
  const { angoloApertura = 90, velocita = 0.05 } = options

  const pivot = useRef(null)
  const inizializzato = useRef(false)

  useEffect(() => {
    if (!scene || inizializzato.current) return

    let cancellettoMesh = null

    const matchCancelletto = (n) =>
      n.startsWith('CANCELLETTO') || n.startsWith('CANCELLETTO_')

    scene.traverse((child) => {
      if (child.isMesh && child.geometry && child.name && matchCancelletto(child.name)) {
        cancellettoMesh = child
      }
    })

    if (cancellettoMesh && cancellettoMesh.parent) {
      const box = new THREE.Box3().setFromObject(cancellettoMesh)
      const center = new THREE.Vector3()
      box.getCenter(center)

      const pivotPos = new THREE.Vector3(box.min.x, center.y, center.z)

      const meshWorldPos = new THREE.Vector3()
      cancellettoMesh.getWorldPosition(meshWorldPos)

      const pivotGroup = new THREE.Group()
      pivotGroup.position.copy(pivotPos)

      cancellettoMesh.parent.add(pivotGroup)

      const offset = new THREE.Vector3().subVectors(
        meshWorldPos,
        pivotPos
      )

      pivotGroup.attach(cancellettoMesh)
      cancellettoMesh.position.copy(offset)

      pivot.current = pivotGroup
    }

    inizializzato.current = true
  }, [scene])

  useFrame(() => {
    if (!pivot.current) return
    const targetRad = aperto
      ? -(angoloApertura * Math.PI) / 180
      : 0
    pivot.current.rotation.y +=
      (targetRad - pivot.current.rotation.y) * velocita
  })

  return { pivot }
}

// =========================
// BOUNDS
// =========================
export const CANCELLO_BOUNDS = {
  spawnDavanti: { x: 161, y: 80, z: 580 }
}
