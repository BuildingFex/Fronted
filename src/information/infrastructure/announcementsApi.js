import { apiClient } from '@/shell/infrastructure/api/apiClient.js'

/**
 * Information bounded-context API.
 *
 * Owns: announcements CRUD (comunicados oficiales).
 * Only admins should create / delete; reading is open to all roles.
 */
export const announcementsApi = {
  /**
   * Fetch all announcements, newest first.
   */
  async list() {
    const { data } = await apiClient.get('/announcements', {
      params: { _sort: 'createdAt', _order: 'desc' },
    })
    return data
  },

  /**
   * Create a new announcement.
   * @param {{ title: string, body: string, priority: string, duration: number, authorId: string, authorName: string }} announcement
   */
  async add(announcement) {
    const createdAt = new Date().toISOString()
    const duration  = announcement.duration ?? 7
    const expires   = new Date(createdAt)
    expires.setDate(expires.getDate() + duration)

    const payload = {
      ...announcement,
      id:        `ann-${Date.now()}`,
      createdAt,
      duration,
      expiresAt: expires.toISOString(),
    }
    const { data } = await apiClient.post('/announcements', payload)
    return data
  },

  /**
   * Delete an announcement by id.
   * @param {string} id
   */
  async remove(id) {
    await apiClient.delete(`/announcements/${id}`)
  },
}
