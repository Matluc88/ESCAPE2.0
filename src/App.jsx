import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/admin/Dashboard'
import QRCodesPage from './pages/admin/QRCodesPage'
import StudentLanding from './pages/StudentLanding'
import RoomScene from './pages/RoomScene'
import Victory from './pages/Victory'
import DebugCollisionScene from './components/scenes/DebugCollisionScene'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/session/:sessionId/qrcodes" element={<QRCodesPage />} />
        
        <Route path="/s/:sessionId/:room" element={<StudentLanding />} />
        <Route path="/play/:sessionId/:room" element={<RoomScene />} />
        
        <Route path="/victory/:sessionId" element={<Victory />} />
        
        {/* Debug scene for testing camera collision detection */}
        <Route path="/debug/collision" element={<DebugCollisionScene />} />
        
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router>
  )
}

export default App
