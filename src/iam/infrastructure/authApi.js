import { apiClient } from '@/shell/infrastructure/api/apiClient.js'
import {
  apiError,
  createSessionToken,
  findUserByEmail,
  normalizeEmail,
  publicUser,
} from '@/shell/infrastructure/api/utils.js'

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
    const user = await findUserByEmail(email)
    if (!user) {
      throw apiError('EMAIL_NOT_FOUND')
    }
    if (user.password !== password) {
      throw apiError('INVALID_PASSWORD')
    }
    return {
      user: publicUser(user),
      token: createSessionToken(user.id),
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

    return {
      user: publicUser(created),
      token: createSessionToken(created.id),
    }
  },
}
