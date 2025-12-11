import { useState } from 'react'
import { Box, Text } from '@react-three/drei'

export default function PlaceholderCube({ name, position, color, onObjectClick }) {
  const [hovered, setHovered] = useState(false)

  const handleClick = (event) => {
    event.stopPropagation()
    onObjectClick(name)
  }

  return (
    <group position={position}>
      <Box
        args={[1, 1, 1]}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          setHovered(false)
          document.body.style.cursor = 'default'
        }}
      >
        <meshStandardMaterial
          color={hovered ? '#ffff00' : color}
          emissive={hovered ? '#555555' : '#000000'}
        />
      </Box>
      <Text
        position={[0, 0.7, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {name}
      </Text>
    </group>
  )
}
