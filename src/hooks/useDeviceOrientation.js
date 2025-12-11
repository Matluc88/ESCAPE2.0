import { useState, useEffect } from 'react'

/**
 * Hook to detect device orientation (portrait vs landscape)
 * Uses multiple detection methods for robust mobile detection
 * @returns {Object} - { isPortrait, isLandscape, isMobile }
 */
export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState({
    isPortrait: false,
    isLandscape: true,
    isMobile: false
  })

  useEffect(() => {
    // Check if device is mobile/touch using multiple methods for robustness
    const checkIsMobile = () => {
      if (typeof window === 'undefined') return false
      
      // Method 1: Touch events support
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      // Method 2: Pointer type detection (coarse = touch, fine = mouse)
      const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches
      
      // Method 3: User agent detection (fallback)
      const ua = navigator.userAgent || ''
      const uaLooksMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      
      // Method 4: Screen size heuristic (small screens are likely mobile)
      const isSmallScreen = window.innerWidth <= 1024 && window.innerHeight <= 1366
      
      // Consider mobile if any touch detection method succeeds, or UA looks mobile
      return hasTouch || hasCoarsePointer || uaLooksMobile
    }

    // Check orientation
    const checkOrientation = () => {
      const isMobile = checkIsMobile()
      
      // Use screen.orientation if available, fallback to window dimensions
      let isPortrait = false
      if (window.screen?.orientation?.type) {
        isPortrait = window.screen.orientation.type.includes('portrait')
      } else {
        isPortrait = window.innerHeight > window.innerWidth
      }

      setOrientation({
        isPortrait,
        isLandscape: !isPortrait,
        isMobile
      })
    }

    // Initial check
    checkOrientation()

    // Listen for orientation changes
    const handleOrientationChange = () => {
      // Small delay to ensure dimensions are updated
      setTimeout(checkOrientation, 100)
    }

    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)
    
    // Also listen to screen.orientation if available
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange)
    }

    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange)
      }
    }
  }, [])

  return orientation
}

export default useDeviceOrientation
