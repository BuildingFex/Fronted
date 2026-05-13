import { apiClient } from '@/shared/infrastructure/api/apiClient.js'
import { withOwnerParams } from '@/shared/infrastructure/api/ownerQuery.js'
import { getActiveDataOwnerId } from '@/shared/infrastructure/api/ownerTenant.js'

/**
 * Archivos subidos en la vista Importación (json-server).
 * Incluye data URL para permitir descarga local; tamaño razonable en cliente.
 */
export const importUploadsApi = {
  async list() {
    const { data } = await apiClient.get('/importUploads', {
      params: withOwnerParams({ _sort: 'uploadedAt', _order: 'desc' }),
    })
    return Array.isArray(data) ? data : []
  },

  async add({ fileName, mimeType, size, dataUrl }) {
    const ownerId = getActiveDataOwnerId()
    const payload = {
      id: `import-${Date.now()}`,
      fileName: String(fileName ?? '').trim() || 'archivo',
      mimeType: String(mimeType ?? 'application/octet-stream'),
      size: Number(size) || 0,
      uploadedAt: new Date().toISOString(),
      dataUrl: String(dataUrl ?? ''),
      ...(ownerId ? { ownerAdminId: ownerId } : {}),
    }
    const { data: created } = await apiClient.post('/importUploads', payload)
    return created
  },

  async remove(id) {
    const cleanId = String(id ?? '').trim()
    if (!cleanId) return
    await apiClient.delete(`/importUploads/${encodeURIComponent(cleanId)}`)
  },
}
