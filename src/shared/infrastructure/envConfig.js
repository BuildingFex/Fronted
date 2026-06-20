/**
 * Base URL of the BuildingFex API (no trailing slash).
 *
 * Development: uses Vite proxy (empty base URL) → http://localhost:5001.
 * Do not use https://localhost:7001 in the browser (self-signed cert → NETWORK_ERROR).
 */
function resolveApiBaseUrl() {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()

  if (import.meta.env.DEV) {
    if (
      !configured ||
      configured.includes('localhost:7001') ||
      configured.startsWith('https://localhost')
    ) {
      return ''
    }
    return configured.replace(/\/$/, '')
  }

  let base = configured || 'http://localhost:5001'
  if (base.includes('localhost:7001')) {
    base = 'http://localhost:5001'
  }
  return base.replace(/\/$/, '')
}

export const API_BASE_URL = resolveApiBaseUrl()
