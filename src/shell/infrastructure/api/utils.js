import { apiClient } from './apiClient.js'
import { getActiveDataOwnerId } from './ownerTenant.js'

/**
 * Cross-context HTTP/data utilities used by bounded-context APIs.
 * Each bounded context owns its own API module; these helpers stay in
 * the `shell` infrastructure because they are technical and shared by
 * several contexts (iam, residents, socialSpaces).
 */

export function apiError(code, message) {
  const error = new Error(message ?? code)
  error.code = code
  return error
}

export function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase()
}

export function normalizeCode(code) {
  return String(code ?? '').trim()
}

export function createSessionToken(userId) {
  return `fake-token-${userId}-${Date.now()}`
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    floor: user.floor ?? null,
    code: user.code ?? null,
    ownerAdminId: user.ownerAdminId ?? null,
  }
}

export function publicResident(user) {
  return {
    id: user.id,
    name: user.name,
    floor: user.floor ?? '',
    code: user.code ?? '',
    email: user.email ?? '',
    hasCredentials: Boolean(user.email && user.password),
  }
}

export function publicSpace(space) {
  return {
    id: space.id,
    name: space.name,
    description: space.description ?? '',
    capacity: space.capacity ?? null,
    imageUrl: space.imageUrl ?? '',
  }
}

export function publicReservation(reservation) {
  return {
    id: reservation.id,
    spaceId: reservation.spaceId,
    residentId: reservation.residentId ?? '',
    residentName: reservation.residentName ?? '',
    residentCode: reservation.residentCode ?? '',
    date: reservation.date,
    startTime: reservation.startTime,
    endTime: reservation.endTime,
  }
}

export function timeToMinutes(value) {
  if (!value) return Number.NaN
  const [h, m] = String(value).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.NaN
  return h * 60 + m
}

export function reservationsOverlap(a, b) {
  if (a.date !== b.date) return false
  const aStart = timeToMinutes(a.startTime)
  const aEnd = timeToMinutes(a.endTime)
  const bStart = timeToMinutes(b.startTime)
  const bEnd = timeToMinutes(b.endTime)
  if ([aStart, aEnd, bStart, bEnd].some(Number.isNaN)) return false
  return aStart < bEnd && bStart < aEnd
}

export async function findUserByEmail(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  const { data } = await apiClient.get('/users', { params: { email: normalized } })
  return Array.isArray(data) && data.length ? data[0] : null
}

/**
 * @param {string} code
 * @param {{ globalScope?: boolean }} [options] If globalScope, ignore active admin (invite flow).
 */
export async function findResidentByCode(code, options = {}) {
  const normalized = normalizeCode(code)
  if (!normalized) return null
  const params = { role: 'resident', code: normalized }
  if (!options.globalScope) {
    const ownerId = getActiveDataOwnerId()
    if (ownerId) params.ownerAdminId = ownerId
  }
  const { data } = await apiClient.get('/users', { params })
  return Array.isArray(data) && data.length ? data[0] : null
}
