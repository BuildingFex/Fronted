import { apiClient } from '@/shell/infrastructure/api/apiClient.js'
import { apiError, publicSpace } from '@/shell/infrastructure/api/utils.js'

/**
 * Social Spaces bounded-context API (spaces side).
 *
 * Owns: catalog of common areas administrators publish for residents.
 * Errors expose `error.code`: 'SPACE_NAME_REQUIRED'.
 */
export const spacesApi = {
  async list() {
    const { data } = await apiClient.get('/socialSpaces')
    return Array.isArray(data) ? data.map(publicSpace) : []
  },

  async add({ name, description, capacity }) {
    const cleanName = String(name ?? '').trim()
    const cleanDescription = String(description ?? '').trim()
    const parsedCapacity = capacity !== '' && capacity != null ? Number(capacity) : null

    if (!cleanName) {
      throw apiError('SPACE_NAME_REQUIRED')
    }

    const newSpace = {
      id: `space-${Date.now()}`,
      name: cleanName,
      description: cleanDescription,
      capacity: Number.isFinite(parsedCapacity) ? parsedCapacity : null,
    }

    const { data: created } = await apiClient.post('/socialSpaces', newSpace)
    return publicSpace(created)
  },
}
