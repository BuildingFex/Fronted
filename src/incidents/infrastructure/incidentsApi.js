import { apiClient } from '@/shared/infrastructure/api/apiClient.js'
import { withOwnerParams } from '@/shared/infrastructure/api/ownerQuery.js'
import { getActiveDataOwnerId } from '@/shared/infrastructure/api/ownerTenant.js'

export const incidentsApi = {
  async list() {
    const { data } = await apiClient.get('/incidents', { params: withOwnerParams() })
    return Array.isArray(data) ? data : []
  },

  async add(incident) {
    const { ownerAdminId: ownerFromPayload, ...rest } = incident
    const ownerId =
      getActiveDataOwnerId() ||
      (ownerFromPayload != null && ownerFromPayload !== ''
        ? String(ownerFromPayload)
        : null)
    const payload = {
      ...rest,
      ...(ownerId ? { ownerAdminId: ownerId } : {}),
    }
    const { data } = await apiClient.post('/incidents', payload)
    return data
  },

  async update(id, incident) {
    const ownerId = getActiveDataOwnerId()
    const payload = {
      ...incident,
      ...(ownerId ? { ownerAdminId: ownerId } : {}),
    }
    const { data } = await apiClient.put(`/incidents/${encodeURIComponent(id)}`, payload)
    return data
  },

  async remove(id) {
    await apiClient.delete(`/incidents/${encodeURIComponent(id)}`)
  },
}
