import { apiClient } from '@/shell/infrastructure/api/apiClient.js'
import { reservationsApi } from '@/socialSpaces/infrastructure/reservationsApi.js'
import { withOwnerParams } from '@/shell/infrastructure/api/ownerQuery.js'
import { getActiveDataOwnerId } from '@/shell/infrastructure/api/ownerTenant.js'
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
    const { data } = await apiClient.get('/users', {
      params: withOwnerParams({ role: 'resident' }),
    })
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

    const ownerAdminId = getActiveDataOwnerId()
    if (!ownerAdminId) {
      throw apiError('RESIDENT_OWNER_REQUIRED')
    }

    const todayStr = new Date().toLocaleDateString('en-CA'); // Gets YYYY-MM-DD local format
    const newResident = {
      id: `resident-${Date.now()}`,
      name: cleanName,
      floor: cleanFloor,
      code: cleanCode,
      email: '',
      password: '',
      role: 'resident',
      admissionDate: todayStr,
      ownerAdminId,
    }

    const { data: created } = await apiClient.post('/users', newResident)
    return publicResident(created)
  },

  async findByCode(code) {
    const resident = await findResidentByCode(code, { globalScope: true })
    if (!resident) {
      throw apiError('RESIDENT_NOT_FOUND')
    }
    return publicResident(resident)
  },

  async remove(id) {
    const cleanId = String(id ?? '').trim()
    if (!cleanId) {
      throw apiError('RESIDENT_NOT_FOUND')
    }
    await apiClient.delete(`/users/${encodeURIComponent(cleanId)}`)
    return { id: cleanId }
  },

  /**
   * Returns counters of linked data that would be deleted in cascade.
   * Useful to show a preview to the admin before confirming the delete.
   * Errors per entity are silenced (count is 0) but reported via `errors`.
   */
  async previewLinkedData(id) {
    const cleanId = String(id ?? '').trim()
    if (!cleanId) throw apiError('RESIDENT_NOT_FOUND')

    const summary = { reservations: 0 }
    const errors = []

    try {
      const reservations = await reservationsApi.listByResident(cleanId)
      summary.reservations = Array.isArray(reservations) ? reservations.length : 0
    } catch (error) {
      errors.push({ entity: 'reservations', error })
    }

    return { summary, errors }
  },

  /**
   * Cascade-delete a resident and every piece of data linked to them.
   *
   * The function tries to remove every related entity even if a previous
   * step fails (so a transient error on one collection does not orphan the
   * rest), and finally removes the user record itself. The returned
   * `summary` reports how many items were deleted per entity, and the
   * optional `errors` array surfaces any partial failures so the UI can
   * decide what to do next.
   */
  async removeCascade(id) {
    const cleanId = String(id ?? '').trim()
    if (!cleanId) throw apiError('RESIDENT_NOT_FOUND')

    const summary = { reservations: 0 }
    const errors = []

    try {
      const result = await reservationsApi.removeByResident(cleanId)
      summary.reservations = result?.removed ?? 0
    } catch (error) {
      errors.push({ entity: 'reservations', error })
    }

    try {
      await apiClient.delete(`/users/${encodeURIComponent(cleanId)}`)
    } catch (error) {
      errors.push({ entity: 'user', error })
      throw apiError('RESIDENT_DELETE_FAILED')
    }

    return { id: cleanId, summary, errors }
  },

  async setCredentials({ code, email, password }) {
    const cleanEmail = normalizeEmail(email)
    const cleanPassword = String(password ?? '')

    const resident = await findResidentByCode(code, { globalScope: true })
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
