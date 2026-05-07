import { API_BASE_URL } from '@/marketing/infrastructure/envConfig.js'

/**
 * HTTP client backed by json-server (`server/db.json`).
 *
 * The exported shape is intentionally identical to the previous in-memory
 * fake backend so the rest of the app does not need to change.
 *
 * Errors thrown by this module always carry a `code` property so callers
 * can branch on it: 'EMAIL_NOT_FOUND', 'INVALID_PASSWORD', 'EMAIL_ALREADY_EXISTS',
 * 'RESIDENT_NOT_FOUND', 'RESIDENT_CODE_ALREADY_EXISTS', 'RESIDENT_FIELDS_REQUIRED',
 * 'NETWORK_ERROR'.
 */

function apiError(code, message) {
  const error = new Error(message ?? code)
  error.code = code
  return error
}

function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

function normalizeCode(code) {
  return String(code ?? '').trim()
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers ?? {}),
      },
      ...options,
    })
  } catch {
    throw apiError('NETWORK_ERROR')
  }

  if (!response.ok) {
    throw apiError('NETWORK_ERROR', `HTTP ${response.status}`)
  }

  if (response.status === 204) return null
  return response.json()
}

async function findUserByEmail(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  const matches = await request(`/users?email=${encodeURIComponent(normalized)}`)
  return Array.isArray(matches) && matches.length ? matches[0] : null
}

async function findResidentByCode(code) {
  const normalized = normalizeCode(code)
  if (!normalized) return null
  const matches = await request(
    `/users?role=resident&code=${encodeURIComponent(normalized)}`,
  )
  return Array.isArray(matches) && matches.length ? matches[0] : null
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    floor: user.floor ?? null,
    code: user.code ?? null,
  }
}

function publicResident(user) {
  return {
    id: user.id,
    name: user.name,
    floor: user.floor ?? '',
    code: user.code ?? '',
    email: user.email ?? '',
    hasCredentials: Boolean(user.email && user.password),
  }
}

function createSessionToken(userId) {
  return `fake-token-${userId}-${Date.now()}`
}

export const fakeBackendApi = {
  auth: {
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

      const created = await request('/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      })

      return {
        user: publicUser(created),
        token: createSessionToken(created.id),
      }
    },
  },

  residents: {
    async list() {
      const users = await request('/users?role=resident')
      return Array.isArray(users) ? users.map(publicResident) : []
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

      const created = await request('/users', {
        method: 'POST',
        body: JSON.stringify(newResident),
      })

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

      const updated = await request(`/users/${encodeURIComponent(resident.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
        }),
      })

      return {
        user: publicUser(updated),
        token: createSessionToken(updated.id),
      }
    },
  },
}
