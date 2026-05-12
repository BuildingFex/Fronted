import { apiClient } from '@/shell/infrastructure/api/apiClient.js'
import { withOwnerParams } from '@/shell/infrastructure/api/ownerQuery.js'
import { getActiveDataOwnerId } from '@/shell/infrastructure/api/ownerTenant.js'
import {
  apiError,
  publicReservation,
  reservationsOverlap,
  timeToMinutes,
} from '@/shell/infrastructure/api/utils.js'

/**
 * Social Spaces bounded-context API (reservations side).
 *
 * Owns: time-bounded reservations residents make against published spaces.
 * Errors expose `error.code`: 'RESERVATION_FIELDS_REQUIRED',
 * 'RESERVATION_TIME_INVALID', 'RESERVATION_OVERLAP', 'RESERVATION_NOT_FOUND', 'GUEST_NOT_FOUND'.
 */
const MAX_RESERVATION_GUESTS = 5

export const reservationsApi = {
  async listBySpace(spaceId) {
    const { data } = await apiClient.get('/reservations', {
      params: withOwnerParams({ spaceId }),
    })
    return Array.isArray(data) ? data.map((r) => publicReservation(r, { omitInviteToken: true })) : []
  },

  async listByResident(residentId) {
    const { data } = await apiClient.get('/reservations', {
      params: withOwnerParams({ residentId }),
    })
    return Array.isArray(data) ? data.map(publicReservation) : []
  },

  /** All reservations for the active admin (Generation / oversight). */
  async listAllForAdmin() {
    const { data } = await apiClient.get('/reservations', { params: withOwnerParams() })
    return Array.isArray(data) ? data.map((r) => publicReservation(r, { omitInviteToken: true })) : []
  },

  async removeBySpace(spaceId) {
    const cleanSpaceId = String(spaceId ?? '').trim()
    if (!cleanSpaceId) return { removed: 0 }
    const { data } = await apiClient.get('/reservations', {
      params: withOwnerParams({ spaceId: cleanSpaceId }),
    })
    const items = Array.isArray(data) ? data : []
    await Promise.all(
      items.map((reservation) =>
        apiClient.delete(`/reservations/${encodeURIComponent(reservation.id)}`),
      ),
    )
    return { removed: items.length }
  },

  async removeByResident(residentId) {
    const cleanResidentId = String(residentId ?? '').trim()
    if (!cleanResidentId) return { removed: 0 }
    const { data } = await apiClient.get('/reservations', {
      params: withOwnerParams({ residentId: cleanResidentId }),
    })
    const items = Array.isArray(data) ? data : []
    await Promise.all(
      items.map((reservation) =>
        apiClient.delete(`/reservations/${encodeURIComponent(reservation.id)}`),
      ),
    )
    return { removed: items.length }
  },

  async add({ spaceId, residentId, residentName, residentCode, date, startTime, endTime }) {
    const cleanSpaceId = String(spaceId ?? '').trim()
    const cleanResidentId = String(residentId ?? '').trim()
    const cleanDate = String(date ?? '').trim()
    const cleanStart = String(startTime ?? '').trim()
    const cleanEnd = String(endTime ?? '').trim()

    if (!cleanSpaceId || !cleanResidentId || !cleanDate || !cleanStart || !cleanEnd) {
      throw apiError('RESERVATION_FIELDS_REQUIRED')
    }

    const startMin = timeToMinutes(cleanStart)
    const endMin = timeToMinutes(cleanEnd)
    if (Number.isNaN(startMin) || Number.isNaN(endMin) || startMin >= endMin) {
      throw apiError('RESERVATION_TIME_INVALID')
    }

    const { data: existing } = await apiClient.get('/reservations', {
      params: withOwnerParams({ spaceId: cleanSpaceId, date: cleanDate }),
    })

    const candidate = { date: cleanDate, startTime: cleanStart, endTime: cleanEnd }
    const overlapping = (existing ?? []).some((reservation) =>
      reservationsOverlap(reservation, candidate),
    )

    if (overlapping) {
      throw apiError('RESERVATION_OVERLAP')
    }

    const ownerId = getActiveDataOwnerId()
    const newReservation = {
      id: `reservation-${Date.now()}`,
      spaceId: cleanSpaceId,
      residentId: cleanResidentId,
      residentName: String(residentName ?? '').trim(),
      residentCode: String(residentCode ?? '').trim(),
      date: cleanDate,
      startTime: cleanStart,
      endTime: cleanEnd,
      guests: [],
      guestInviteToken: null,
      ...(ownerId ? { ownerAdminId: ownerId } : {}),
    }

    const { data: created } = await apiClient.post('/reservations', newReservation)
    return publicReservation(created)
  },

  /**
   * Replace guest list for a reservation (max 5 names). Preserves `checkedIn` / `checkedInAt` by guest `id`.
   * @param {string} reservationId
   * @param {Array<{ id?: string, name: string }>} guests
   */
  async updateGuests(reservationId, guests) {
    const cleanId = String(reservationId ?? '').trim()
    if (!cleanId) {
      throw apiError('RESERVATION_NOT_FOUND')
    }

    const { data: current } = await apiClient.get(`/reservations/${encodeURIComponent(cleanId)}`, {
      params: withOwnerParams(),
    })
    const currentGuests = Array.isArray(current?.guests) ? current.guests : []

    const normalized = (Array.isArray(guests) ? guests : [])
      .map((g, i) => {
        const name = String(g?.name ?? '').trim()
        if (!name.length) return null
        const incomingId = String(g?.id ?? '').trim()
        const prev = incomingId ? currentGuests.find((x) => String(x.id) === incomingId) : null
        const id = incomingId || `guest-${Date.now()}-${i}`
        return {
          id,
          name,
          checkedIn: Boolean(prev?.checkedIn),
          checkedInAt: prev?.checkedInAt ?? null,
        }
      })
      .filter(Boolean)
      .slice(0, MAX_RESERVATION_GUESTS)

    let guestInviteToken = current?.guestInviteToken ?? null
    if (normalized.length > 0) {
      if (!guestInviteToken) {
        guestInviteToken = `invite-${crypto.randomUUID()}`
      }
    } else {
      guestInviteToken = null
    }

    const { data: updated } = await apiClient.patch(
      `/reservations/${encodeURIComponent(cleanId)}`,
      { guests: normalized, guestInviteToken },
    )
    return publicReservation(updated)
  },

  /**
   * Admin marks whether a guest has physically entered (concierge / reception).
   * @param {string} reservationId
   * @param {string} guestId
   * @param {boolean} checkedIn
   */
  async setGuestCheckedIn(reservationId, guestId, checkedIn) {
    const rid = String(reservationId ?? '').trim()
    const gid = String(guestId ?? '').trim()
    if (!rid || !gid) {
      throw apiError('RESERVATION_NOT_FOUND')
    }
    const { data: current } = await apiClient.get(`/reservations/${encodeURIComponent(rid)}`, {
      params: withOwnerParams(),
    })
    const list = Array.isArray(current?.guests) ? current.guests : []
    let found = false
    const nextGuests = list.map((g) => {
      if (String(g.id) !== gid) {
        return {
          id: String(g.id),
          name: String(g.name ?? '').trim(),
          checkedIn: Boolean(g.checkedIn),
          checkedInAt: g.checkedInAt ?? null,
        }
      }
      found = true
      const on = Boolean(checkedIn)
      return {
        id: String(g.id),
        name: String(g.name ?? '').trim(),
        checkedIn: on,
        checkedInAt: on ? (g.checkedInAt || new Date().toISOString()) : null,
      }
    })
    if (!found) {
      throw apiError('GUEST_NOT_FOUND')
    }
    const { data: updated } = await apiClient.patch(`/reservations/${encodeURIComponent(rid)}`, {
      guests: nextGuests,
    })
    return publicReservation(updated, { omitInviteToken: true })
  },

  /**
   * Public lookup by invite token (no tenant scope). Used by guest invite page.
   * @returns {{ guests: Array<{id:string,name:string}>, date: string, startTime: string, endTime: string, spaceName: string, residentName: string }}
   */
  async getPublicInviteByToken(rawToken) {
    const token = String(rawToken ?? '').trim()
    if (!token) {
      throw apiError('INVITE_NOT_FOUND')
    }
    const { data } = await apiClient.get('/reservations', { params: { guestInviteToken: token } })
    const list = Array.isArray(data) ? data : []
    if (!list.length) {
      throw apiError('INVITE_NOT_FOUND')
    }
    const r = list[0]
    let spaceName = ''
    try {
      const { data: space } = await apiClient.get(`/socialSpaces/${encodeURIComponent(r.spaceId)}`)
      spaceName = String(space?.name ?? '').trim()
    } catch {
      spaceName = ''
    }
    const pub = publicReservation(r, { omitInviteToken: true })
    return {
      guests: pub.guests,
      date: pub.date,
      startTime: pub.startTime,
      endTime: pub.endTime,
      spaceName: spaceName || '—',
      residentName: String(r.residentName ?? '').trim(),
    }
  },
}
