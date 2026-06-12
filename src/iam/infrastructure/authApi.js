import { apiClient } from '@/shared/infrastructure/api/apiClient.js'
import {
  apiError,
  createSessionToken,
  findUserByEmail,
  normalizeEmail,
  publicUser,
} from '@/shared/infrastructure/api/utils.js'

/**
 * IAM (Identity & Access Management) bounded-context API.
 *
 * Owns: authentication and admin registration.
 * Errors expose `error.code`: 'EMAIL_NOT_FOUND', 'INVALID_PASSWORD',
 * 'EMAIL_ALREADY_EXISTS', or generic ones from the shared client.
 */
export const authApi = {
  async isEmailRegistered(email) {
    const user = await findUserByEmail(email)
    return Boolean(user)
  },

  async login({ email, password }) {
    try {
      const { data } = await apiClient.post('/api/v1/authentication/sign-in', { email, password })
      return {
        user: publicUser(data.user),
        token: data.token,
      }
    } catch (err) {
      if (err.payload && err.payload.code) {
        throw apiError(err.payload.code)
      }
      throw err
    }
  },

  async registerAdmin(payload) {
    const normalizedEmail = normalizeEmail(payload.email)
    const exists = await findUserByEmail(normalizedEmail)
    if (exists) {
      throw apiError('EMAIL_ALREADY_EXISTS')
    }

    const newUser = {
      id: `admin-${Date.now()}`,
      name: String(payload.name ?? '').trim(),
      email: normalizedEmail,
      password: String(payload.password ?? ''),
      dni: String(payload.dni ?? '').trim(),
      address: String(payload.address ?? '').trim(),
      company: String(payload.company ?? '').trim(),
      ruc: String(payload.ruc ?? '').trim(),
      role: 'admin',
    }

    const { data: created } = await apiClient.post('/users', newUser)
    const merged =
      created && typeof created === 'object' ? { ...newUser, ...created } : { ...newUser }
    const ownerId = merged.id

    try {
      await apiClient.post('/financeSettings', {
        ownerAdminId: ownerId,
        baseMonthlyExpense: 150,
        lateFeeRate: 0.05,
      })
    } catch {
      // ignore seed failure (e.g. duplicate); admin can still open Finanzas
    }
    try {
      await apiClient.post('/kpi', {
        ownerAdminId: ownerId,
        totalResidents: 0,
        occupiedUnits: 0,
        emptyUnits: 0,
        totalDebt: 0,
      })
    } catch {
      // ignore
    }

    return {
      user: publicUser(merged),
      token: createSessionToken(ownerId),
    }
  },

  /**
   * Full user row for settings views (password stripped). Uses GET /users/:id.
   */
  async getProfileById(userId) {
    if (!userId) return null
    try {
      const { data } = await apiClient.get(`/users/${encodeURIComponent(userId)}`)
      if (!data || typeof data !== 'object') return null
      // eslint-disable-next-line no-unused-vars -- strip secret
      const { password, ...rest } = data
      return rest
    } catch {
      return null
    }
  },
}
