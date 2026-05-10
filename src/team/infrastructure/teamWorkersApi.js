import { apiClient } from '@/shell/infrastructure/api/apiClient.js'
import { apiError } from '@/shell/infrastructure/api/utils.js'

/**
 * Admin team / staff directory (mock json-server CRUD).
 *
 * Payload fields: id, name, phone, dni, salary (number), photoUrl (optional data URL).
 */
export const teamWorkersApi = {
  async list() {
    const { data } = await apiClient.get('/teamWorkers')
    return Array.isArray(data) ? data : []
  },

  async add({ name, phone, dni, salary, photoUrl }) {
    const cleanName = String(name ?? '').trim()
    const cleanPhone = String(phone ?? '').trim()
    const cleanDni = String(dni ?? '').trim()
    const parsedSalary =
      salary === '' || salary == null ? Number.NaN : Number(salary)

    if (!cleanName || !cleanPhone || !cleanDni || !Number.isFinite(parsedSalary)) {
      throw apiError(
        'TEAM_WORKER_FIELDS_REQUIRED',
        'Name, phone, DNI and a valid salary are required.',
      )
    }

    const newWorker = {
      id: `worker-${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      dni: cleanDni,
      salary: parsedSalary,
      photoUrl: String(photoUrl ?? '').trim(),
    }

    const { data: created } = await apiClient.post('/teamWorkers', newWorker)
    return created
  },
}
