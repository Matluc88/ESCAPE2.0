import * as THREE from "three";

/**
 * Sistema di posizionamento camera robusto per casa.glb.
 * Funziona anche se gli spawn non esistono nel modello.
 */
export function getSpawnPosition(scene, sceneType) {
  console.log("=== GET SPAWN POSITION CALLED ===", sceneType);
  
  const fallbackByRoom = {
    cucina: "PORTA CUCINA",
    camera: "PORTA LETTO",
    soggiorno: "INIZIO_SOGGIORNO",
    bagno: "PORTA BAGNO",
    esterno: null,
  };

  const spawnByRoom = {
    cucina: "INIZIO_CUCINA",
    camera: "INIZIO_CAMERA_DA_LETTO",
    soggiorno: "INIZIO_SOGGIORNO",
    bagno: "INIZIO_BAGNO",
    esterno: null,
  };

  let spawnName = spawnByRoom[sceneType];
  let fallbackName = fallbackByRoom[sceneType];

  // 1️⃣ Cerco lo spawn specifico
  let spawn = spawnName ? scene.getObjectByName(spawnName) : null;

  if (spawn) {
    const pos = new THREE.Vector3();
    spawn.getWorldPosition(pos);

    console.warn(
      `SPAWN DEBUG → OK | stanza=${sceneType} | nodo=${spawnName} | pos=${pos.x.toFixed(
        2
      )}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    );

    return pos;
  }

  // 2️⃣ Se lo spawn non esiste → uso la porta della stanza
  const fallback = fallbackName ? scene.getObjectByName(fallbackName) : null;

  if (fallback) {
    const pos = new THREE.Vector3();
    fallback.getWorldPosition(pos);

    // Direzione della porta
    const forward = new THREE.Vector3();
    fallback.getWorldDirection(forward);

    // Posiziono la camera dietro la porta
    pos.addScaledVector(forward, -1.2);
    pos.y += 1.6;

    console.warn(
      `SPAWN DEBUG → FALLBACK | stanza=${sceneType} | porta=${fallbackName} | pos=${pos.x.toFixed(
        2
      )}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`
    );

    return pos;
  }

  // 3️⃣ Fallback finale: centro della stanza
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  center.y += 1.6;

  console.error(
    `SPAWN DEBUG → ERRORE | stanza=${sceneType} | nessun nodo trovato → uso centro bounding box`
  );

  return center;
}
