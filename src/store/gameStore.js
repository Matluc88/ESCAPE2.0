import { create } from 'zustand'

const useGameStore = create((set) => ({
  sessionId: null,
  roomName: null,
  playerName: null,
  roomState: null,
  
  setSession: (sessionId, roomName, playerName) => set({
    sessionId,
    roomName,
    playerName
  }),
  
  updateRoomState: (roomState) => set({ roomState }),
  
  clearSession: () => set({
    sessionId: null,
    roomName: null,
    playerName: null,
    roomState: null
  })
}))

export default useGameStore
