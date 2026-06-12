import axios from 'axios'
import { API_BASE_URL } from '@/shared/infrastructure/envConfig.js'

/**
 * Centralized axios instance pointing at the json-server backend.
 *
 * Errors are normalized so the rest of the app can branch on `error.code`
 * (e.g. 'NETWORK_ERROR', 'TIMEOUT', or any HTTP-derived code such as 'HTTP_404').
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Add JWT Authorization header
apiClient.interceptors.request.use(async (config) => {
  try {
    const { getSessionToken } = await import('@/iam/application/sessionStore.js')
    const token = getSessionToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // Ignore import errors
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      const timeoutError = new Error('TIMEOUT')
      timeoutError.code = 'TIMEOUT'
      return Promise.reject(timeoutError)
    }

    if (!error.response) {
      const networkError = new Error('NETWORK_ERROR')
      networkError.code = 'NETWORK_ERROR'
      return Promise.reject(networkError)
    }

    const httpError = new Error(`HTTP_${error.response.status}`)
    httpError.code = `HTTP_${error.response.status}`
    httpError.status = error.response.status
    httpError.payload = error.response.data
    return Promise.reject(httpError)
  },
)
