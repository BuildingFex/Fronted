import { apiClient } from '@/shell/infrastructure/api/apiClient.js'
import {
  apiError,
  createSessionToken,
  findResidentByCode,
  findUserByEmail,
  normalizeCode,
  normalizeEmail,
  publicResident,
  publicUser,
} from '@/shell/infrastructure/api/utils.js'

/**
 * Residents bounded-context API.
 *
 * Owns: lifecycle of resident accounts (creation by admin, invitation lookup,
 * credentials provisioning).
 * Errors expose `error.code`: 'RESIDENT_FIELDS_REQUIRED',
 * 'RESIDENT_CODE_ALREADY_EXISTS', 'RESIDENT_NOT_FOUND', 'EMAIL_ALREADY_EXISTS'.
 */
export const residentsApi = {
  async list() {
    const { data } = await apiClient.get('/users', { params: { role: 'resident' } })
    return Array.isArray(data) ? data.map(publicResident) : []
  },

  async add({ name, floor, code }) {
    const cleanName = String(name ?? '').trim()
    const cleanFloor = String(floor ?? '').trim()
    const cleanCode = normalizeCode(code)

    if (!cleanName || !cleanFloor || !cleanCode) {
      throw apiError('RESIDENT_FIELDS_REQUIRED')
    }

    const codeExists = await findResidentByCode(cleanCode)
    if (codeExists) {
      throw apiError('RESIDENT_CODE_ALREADY_EXISTS')
    }

    const newResident = {
      id: `resident-${Date.now()}`,
      name: cleanName,
      floor: cleanFloor,
      code: cleanCode,
      email: '',
      password: '',
      role: 'resident',
    }

    const { data: created } = await apiClient.post('/users', newResident)
    return publicResident(created)
  },

  async findByCode(code) {
    const resident = await findResidentByCode(code)
    if (!resident) {
      throw apiError('RESIDENT_NOT_FOUND')
    }
    return publicResident(resident)
  },

  async setCredentials({ code, email, password }) {
    const cleanEmail = normalizeEmail(email)
    const cleanPassword = String(password ?? '')

    const resident = await findResidentByCode(code)
    if (!resident) {
      throw apiError('RESIDENT_NOT_FOUND')
    }

    const emailOwner = await findUserByEmail(cleanEmail)
    if (emailOwner && emailOwner.id !== resident.id) {
      throw apiError('EMAIL_ALREADY_EXISTS')
    }

    const { data: updated } = await apiClient.patch(
      `/users/${encodeURIComponent(resident.id)}`,
      {
        email: cleanEmail,
        password: cleanPassword,
      },
    )

    return {
      user: publicUser(updated),
      token: createSessionToken(updated.id),
    }
  },
}
