import { apiClient } from '@/shared/infrastructure/api/apiClient.js'
import {
  apiError,
  findUserByEmail,
  normalizeEmail,
  publicUser,
} from '@/shared/infrastructure/api/utils.js'

const SIGN_IN_PATH = '/api/v1/authentication/sign-in'
const REGISTER_ADMIN_PATH = '/api/v1/authentication/register-admin'

function parseAuthResponse(data) {
  if (!data || typeof data !== 'object') {
    throw apiError('AUTH_ERROR', 'Invalid authentication response.')
  }
  const user = data.user ?? data.User
  const token = data.token ?? data.Token
  if (!user || typeof user !== 'object' || !token) {
    throw apiError('AUTH_ERROR', 'Invalid authentication response.')
  }
  return { user: publicUser(user), token: String(token) }
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

async function seedAdminDefaults(ownerId, token) {
  const headers = authHeaders(token)
  try {
    await apiClient.post(
      '/financeSettings',
      {
        ownerAdminId: ownerId,
        baseMonthlyExpense: 150,
        lateFeeRate: 0.05,
      },
      { headers },
    )
  } catch {
    // ignore seed failure (e.g. duplicate); admin can still open Finanzas
  }
  try {
    await apiClient.post(
      '/kpi',
      {
        ownerAdminId: ownerId,
        totalResidents: 0,
        occupiedUnits: 0,
        emptyUnits: 0,
        totalDebt: 0,
      },
      { headers },
    )
  } catch {
    // ignore
  }
}

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
      const { data } = await apiClient.post(SIGN_IN_PATH, {
        email: normalizeEmail(email),
        password: String(password ?? ''),
      })
      return parseAuthResponse(data)
    } catch (error) {
      if (error?.code === 'EMAIL_NOT_FOUND' || error?.code === 'INVALID_PASSWORD') {
        throw apiError(error.code, error.payload?.message)
      }
      throw error
    }
  },

  async registerAdmin(payload) {
    const normalizedEmail = normalizeEmail(payload.email)
    try {
      const { data } = await apiClient.post(REGISTER_ADMIN_PATH, {
        name: String(payload.name ?? '').trim(),
        email: normalizedEmail,
        password: String(payload.password ?? ''),
        dni: String(payload.dni ?? '').trim(),
        address: String(payload.address ?? '').trim(),
        company: String(payload.company ?? '').trim(),
        ruc: String(payload.ruc ?? '').trim(),
      })
      const { user, token } = parseAuthResponse(data)
      await seedAdminDefaults(user.id, token)
      return { user, token }
    } catch (error) {
      if (error?.code === 'EMAIL_ALREADY_EXISTS') {
        throw apiError(error.code, error.payload?.message)
      }
      throw error
    }
  },

  /**
   * Full user row for settings views. Uses GET /users/:id.
   */
  async getProfileById(userId) {
    if (!userId) return null
    try {
      const { data } = await apiClient.get(`/users/${encodeURIComponent(userId)}`)
      if (!data || typeof data !== 'object') return null
      return data
    } catch {
      return null
    }
  },
}
