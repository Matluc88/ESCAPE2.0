import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const apiClient = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const createSession = async () => {
  try {
    const response = await apiClient.post('/api/session/create')
    return response.data
  } catch (error) {
    console.error('Error creating session:', error)
    throw error
  }
}

export const getSession = async (sessionId) => {
  try {
    const response = await apiClient.get(`/api/session/${sessionId}`)
    return response.data
  } catch (error) {
    console.error('Error getting session:', error)
    throw error
  }
}

export default apiClient
