const USERS_STORAGE_KEY = 'buildingfex.fakeApi.users'

const DEFAULT_USERS = [
  {
    id: 'admin-seed-1',
    name: 'Admin Demo',
    email: 'admin@buildingfex.test',
    password: 'admin123',
    dni: '12345678',
    address: 'Av. Principal 123',
    company: 'BuildingFex',
    ruc: '20123456789',
    role: 'admin',
  },
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY)
    if (!raw) return [...DEFAULT_USERS]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [...DEFAULT_USERS]
  } catch {
    return [...DEFAULT_USERS]
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
}

function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }
}

function createSessionToken(userId) {
  return `fake-token-${userId}-${Date.now()}`
}

async function withLatency(fn) {
  await sleep(250)
  return fn()
}

/**
 * General fake API entry point.
 * This object is intentionally grouped by domains (auth, projects, etc.)
 * so it can grow without being tied only to authentication.
 */
export const fakeBackendApi = {
  auth: {
    async isEmailRegistered(email) {
      return withLatency(() => {
        const users = readUsers()
        const normalized = normalizeEmail(email)
        return users.some((user) => normalizeEmail(user.email) === normalized)
      })
    },

    async login({ email, password }) {
      return withLatency(() => {
        const users = readUsers()
        const normalized = normalizeEmail(email)
        const user = users.find((item) => normalizeEmail(item.email) === normalized)

        if (!user) {
          const error = new Error('EMAIL_NOT_FOUND')
          error.code = 'EMAIL_NOT_FOUND'
          throw error
        }

        if (user.password !== password) {
          const error = new Error('INVALID_PASSWORD')
          error.code = 'INVALID_PASSWORD'
          throw error
        }

        return {
          user: publicUser(user),
          token: createSessionToken(user.id),
        }
      })
    },

    async registerAdmin(payload) {
      return withLatency(() => {
        const users = readUsers()
        const normalized = normalizeEmail(payload.email)
        const exists = users.some((item) => normalizeEmail(item.email) === normalized)

        if (exists) {
          const error = new Error('EMAIL_ALREADY_EXISTS')
          error.code = 'EMAIL_ALREADY_EXISTS'
          throw error
        }

        const newUser = {
          id: `admin-${Date.now()}`,
          name: payload.name.trim(),
          email: normalized,
          password: payload.password,
          dni: payload.dni.trim(),
          address: payload.address.trim(),
          company: payload.company.trim(),
          ruc: payload.ruc.trim(),
          role: 'admin',
        }

        const nextUsers = [...users, newUser]
        saveUsers(nextUsers)

        return {
          user: publicUser(newUser),
          token: createSessionToken(newUser.id),
        }
      })
    },
  },
}
