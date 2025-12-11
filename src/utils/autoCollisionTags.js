/**
 * Auto-assigns collision tags (userData) to scene objects based on their names.
 * This function should be called right after loading a GLB scene.
 * 
 * IMPORTANT: This function PRESERVES existing userData tags from the GLB file.
 * If a mesh already has userData.collidable or userData.ground set, those values
 * are kept and NOT overwritten. Keyword-based heuristics only apply to meshes
 * that don't have explicit tags from the model.
 * 
 * Rules:
 * 1. PRESERVE GLB TAGS: If userData.collidable or userData.ground already exist, keep them
 * 2. GROUND DETECTION: Tag floor meshes with userData.ground = true (if not already tagged)
 * 3. COLLIDABLE OBJECTS: Tag walls/furniture with userData.collidable = true (if not already tagged)
 * 4. IGNORE SMALL DETAILS: Mark small decorative items as non-collidable (if not already tagged)
 * 5. DEFAULT TO COLLIDABLE: If no keywords match and mesh is large enough, tag as collidable
 * 
 * @param {THREE.Object3D} scene - The loaded GLTF scene to process
 * @param {boolean} enableDebugLog - Whether to print debug info to console (default: true)
 * @returns {Object} - Statistics about tagged objects { ground: [], collidable: [], ignored: [], preserved: [], defaultCollidable: [] }
 */
export function applyAutoCollisionTags(scene, enableDebugLog = true) {
  const stats = {
    ground: [],
    collidable: [],
    ignored: [],
    preserved: [], // Objects that already had tags from GLB
    defaultCollidable: [] // Objects tagged as collidable by default (no keyword match)
  }

  // Keywords for detection (all lowercase)
  const GROUND_KEYWORDS = ['piano', 'floor', 'terra', 'pavimento', 'ground']
  const WALL_KEYWORDS = ['muro', 'parete', 'wall', 'soffitto', 'ceiling']
  // NOTE: 'porta' (door) removed - doors should not auto-collide; use explicit GLB tags or scene whitelist
  const FURNITURE_KEYWORDS = ['mobile', 'cucina', 'pensile', 'tavolo', 'armadio', 'libreria', 'divano', 'letto', 'comodino', 'sedia', 'scaffale', 'frigo', 'forno', 'lavello', 'lavandino', 'doccia', 'vasca', 'wc', 'bidet', 'specchio', 'finestra', 'cassetto', 'mensola', 'ripiano', 'banco', 'counter', 'cabinet', 'shelf', 'table', 'chair', 'bed', 'sofa', 'desk', 'wardrobe', 'closet', 'window']
  const IGNORE_KEYWORDS = ['pomello', 'maniglia', 'rubinetto', 'vaso', 'bicchieri', 'display', 'bottiglia', 'piatto', 'tazza', 'posate', 'fiore', 'pianta', 'quadro', 'cornice', 'lampada', 'luce', 'light', 'lamp', 'decoration', 'decor', 'ornament', 'handle', 'knob', 'button', 'switch', 'outlet', 'socket', 'wire', 'cable', 'small', 'detail', 'accessory']
  
  // ========================================
  // CRITICAL: Meshes that should NEVER be collidable
  // These are large container meshes, reference geometry, or small decorative parts
  // that would trap the player if marked as collidable
  // ========================================
  const NEVER_COLLIDABLE_KEYWORDS = [
    'layer',      // Layer_01 and similar container meshes
    'terra',      // Ground/floor meshes (should be ground, not collidable)
    'servo',      // Servo motors and small mechanical parts
    'sg90',       // SG90 servo model
    'micro',      // Micro components
    'reference',  // Reference geometry
    'helper',     // Helper objects
    'placeholder',// Placeholder geometry
    'bounds',     // Bounding volumes
    'collision_volume', // Explicit collision volumes (handled separately)
    'trigger',    // Trigger volumes
    'invisible',  // Invisible meshes
    'hidden',     // Hidden meshes
  ]
  
  // Also check for specific problematic mesh name patterns (exact or partial matches)
  const NEVER_COLLIDABLE_PATTERNS = [
    /^layer_/i,           // Layer_01, Layer_02, etc.
    /^gg_/i,              // gg_Servo_SG90 and similar
    /servo/i,             // Any servo-related mesh
    /sg90/i,              // SG90 servo model
    /_chinese_/i,         // Chinese micro servo naming
  ]
  
  // Minimum bounding box volume to be considered collidable by default (in cubic units)
  // This filters out very small meshes that are likely decorative
  const MIN_COLLIDABLE_VOLUME = 0.001 // Very small threshold to catch most furniture

  scene.traverse((obj) => {
    if (!obj.isMesh) return

    const n = obj.name.toLowerCase()
    
    // ========================================
    // CRITICAL: Check NEVER_COLLIDABLE FIRST - these meshes should NEVER be collidable
    // This check runs BEFORE GLB tag preservation to override any incorrect tags
    // ========================================
    const isNeverCollidable = 
      NEVER_COLLIDABLE_KEYWORDS.some(k => n.includes(k)) ||
      NEVER_COLLIDABLE_PATTERNS.some(rx => rx.test(obj.name))
    
    if (isNeverCollidable) {
      // Floor meshes like "terra" can still be ground, but never collidable
      const isFloor = GROUND_KEYWORDS.some(k => n.includes(k))
      if (isFloor) {
        obj.userData.ground = obj.userData.ground ?? true
        stats.ground.push({
          name: obj.name,
          userData: { ...obj.userData },
          source: 'neverCollidable+ground'
        })
      }
      
      // Force collidable = false for these meshes (overrides any GLB tags)
      obj.userData.collidable = false
      stats.ignored.push({
        name: obj.name,
        userData: { ...obj.userData },
        source: 'neverCollidable'
      })
      return // Skip all other tagging for this mesh
    }
    
    // Check if the mesh already has explicit tags from the GLB file
    const hasCollidableTag = Object.prototype.hasOwnProperty.call(obj.userData, 'collidable')
    const hasGroundTag = Object.prototype.hasOwnProperty.call(obj.userData, 'ground')
    
    // If the mesh has any explicit tags from GLB, preserve them and skip keyword-based tagging
    if (hasCollidableTag || hasGroundTag) {
      stats.preserved.push({
        name: obj.name,
        userData: { ...obj.userData },
        source: 'GLB'
      })
      return // Skip keyword-based tagging for this mesh
    }

    // Check each category (only for meshes without explicit GLB tags)
    const isFloor = GROUND_KEYWORDS.some(k => n.includes(k))
    const isWall = WALL_KEYWORDS.some(k => n.includes(k))
    const isFurniture = FURNITURE_KEYWORDS.some(k => n.includes(k))
    const shouldIgnore = IGNORE_KEYWORDS.some(k => n.includes(k))

    // Apply tags based on rules (only if not already tagged)
    if (shouldIgnore) {
      // IGNORE SMALL DETAILS: Mark as non-collidable
      obj.userData.collidable = false
      stats.ignored.push({
        name: obj.name,
        userData: { ...obj.userData }
      })
    } else {
      // Apply ground tag
      if (isFloor) {
        obj.userData.ground = true
        stats.ground.push({
          name: obj.name,
          userData: { ...obj.userData }
        })
      }

      // Apply collidable tag - either by keyword match or by default for large enough meshes
      if (isWall || isFurniture) {
        obj.userData.collidable = true
        stats.collidable.push({
          name: obj.name,
          userData: { ...obj.userData }
        })
      } else if (!isFloor) {
        // No keyword match - check if mesh is large enough to be collidable by default
        // This ensures walls and furniture without matching keywords still block movement
        if (obj.geometry) {
          obj.geometry.computeBoundingBox()
          const bbox = obj.geometry.boundingBox
          if (bbox) {
            const size = bbox.max.clone().sub(bbox.min)
            const volume = size.x * size.y * size.z
            
            // Tag as collidable if volume is above threshold
            if (volume >= MIN_COLLIDABLE_VOLUME) {
              obj.userData.collidable = true
              stats.defaultCollidable.push({
                name: obj.name,
                volume: volume,
                userData: { ...obj.userData }
              })
            }
          }
        }
      }
    }
  })

  // Debug logging
  if (enableDebugLog) {
    console.log('=== AUTO COLLISION TAGS APPLIED ===')
    
    if (stats.ground.length > 0) {
      console.log(`\n[GROUND] ${stats.ground.length} objects tagged as ground:`)
      stats.ground.forEach(item => {
        console.log(`  - "${item.name}" | userData:`, item.userData)
      })
    }

    if (stats.collidable.length > 0) {
      console.log(`\n[COLLIDABLE] ${stats.collidable.length} objects tagged as collidable:`)
      stats.collidable.forEach(item => {
        console.log(`  - "${item.name}" | userData:`, item.userData)
      })
    }

    if (stats.ignored.length > 0) {
      console.log(`\n[IGNORED] ${stats.ignored.length} objects marked as non-collidable (small details):`)
      stats.ignored.forEach(item => {
        console.log(`  - "${item.name}" | userData:`, item.userData)
      })
    }

    if (stats.preserved.length > 0) {
      console.log(`\n[PRESERVED FROM GLB] ${stats.preserved.length} objects with existing tags from model:`)
      stats.preserved.forEach(item => {
        console.log(`  - "${item.name}" | userData:`, item.userData)
      })
    }

    if (stats.defaultCollidable.length > 0) {
      console.log(`\n[DEFAULT COLLIDABLE] ${stats.defaultCollidable.length} objects tagged as collidable by default (no keyword match, large enough):`)
      stats.defaultCollidable.forEach(item => {
        console.log(`  - "${item.name}" | volume: ${item.volume.toFixed(4)} | userData:`, item.userData)
      })
    }

    console.log('\n=== END AUTO COLLISION TAGS ===')
    const totalCollidable = stats.collidable.length + stats.defaultCollidable.length
    console.log(`Summary: ${stats.preserved.length} preserved from GLB, ${stats.ground.length} ground (auto), ${stats.collidable.length} collidable (keyword), ${stats.defaultCollidable.length} collidable (default), ${stats.ignored.length} ignored`)
    console.log(`Total collidable objects: ${totalCollidable}`)
  }

  return stats
}

/**
 * Collects all meshes from a scene that have userData.collidable = true
 * @param {THREE.Object3D} scene - The scene to traverse
 * @returns {THREE.Mesh[]} - Array of collidable meshes
 */
export function getCollidableMeshes(scene) {
  const collidables = []
  scene.traverse((obj) => {
    if (obj.isMesh && obj.userData.collidable === true) {
      collidables.push(obj)
    }
  })
  return collidables
}

/**
 * Collects all meshes from a scene that have userData.ground = true
 * @param {THREE.Object3D} scene - The scene to traverse
 * @returns {THREE.Mesh[]} - Array of ground meshes
 */
export function getGroundMeshes(scene) {
  const grounds = []
  scene.traverse((obj) => {
    if (obj.isMesh && obj.userData.ground === true) {
      grounds.push(obj)
    }
  })
  return grounds
}

export default applyAutoCollisionTags
