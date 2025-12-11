import { useGLTF } from '@react-three/drei'
import { useState } from 'react'

export default function RoomModel({ 
  modelPath, 
  onObjectClick, 
  interactiveObjects = []
}) {
  const { scene } = useGLTF(modelPath)
  const [hoveredObject, setHoveredObject] = useState(null)

  const clonedScene = scene.clone()

  clonedScene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
      
      if (interactiveObjects.includes(child.name)) {
        child.userData.interactive = true
      }
    }
  })

  const handleClick = (event) => {
    event.stopPropagation()
    if (event.object.userData.interactive) {
      console.log('🖱️ Click:', event.object.name)
      onObjectClick(event.object.name)
    }
  }

  const handlePointerOver = (event) => {
    event.stopPropagation()
    if (event.object.userData.interactive) {
      document.body.style.cursor = 'pointer'
      setHoveredObject(event.object.name)
      if (event.object.material.emissive) {
        event.object.material.emissive.setHex(0x555555)
      }
    }
  }

  const handlePointerOut = (event) => {
    event.stopPropagation()
    if (event.object.userData.interactive) {
      document.body.style.cursor = 'default'
      setHoveredObject(null)
      if (event.object.material.emissive) {
        event.object.material.emissive.setHex(0x000000)
      }
    }
  }

  return (
    <primitive
      object={clonedScene}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  )
}

useGLTF.preload('/models/cucina.glb')
useGLTF.preload('/models/soggiorno.glb')
useGLTF.preload('/models/bagno.glb')
useGLTF.preload('/models/camera.glb')
