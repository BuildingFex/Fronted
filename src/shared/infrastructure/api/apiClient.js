import axios from 'axios'
import { API_BASE_URL } from '@/shared/infrastructure/envConfig.js'
import { getAccessToken } from '@/iam/application/sessionStore.js'

/**
 * Centralized axios instance pointing at the BuildingFex API.
 *
 * Errors are normalized so the rest of the app can branch on `error.code`
 * (e.g. 'NETWORK_ERROR', 'TIMEOUT', 'EMAIL_NOT_FOUND', or 'HTTP_404').
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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

    const payload = error.response.data
    const apiCode =
      payload && typeof payload === 'object' && typeof payload.code === 'string'
        ? payload.code
        : null

    const httpError = new Error(apiCode ?? `HTTP_${error.response.status}`)
    httpError.code = apiCode ?? `HTTP_${error.response.status}`
    httpError.status = error.response.status
    httpError.payload = payload
    return Promise.reject(httpError)
  },
)
