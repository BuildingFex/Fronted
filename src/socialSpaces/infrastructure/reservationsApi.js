import { apiClient } from '@/shell/infrastructure/api/apiClient.js'
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
 * 'RESERVATION_TIME_INVALID', 'RESERVATION_OVERLAP'.
 */
export const reservationsApi = {
  async listBySpace(spaceId) {
    const { data } = await apiClient.get('/reservations', { params: { spaceId } })
    return Array.isArray(data) ? data.map(publicReservation) : []
  },

  async listByResident(residentId) {
    const { data } = await apiClient.get('/reservations', { params: { residentId } })
    return Array.isArray(data) ? data.map(publicReservation) : []
  },

  async removeBySpace(spaceId) {
    const cleanSpaceId = String(spaceId ?? '').trim()
    if (!cleanSpaceId) return { removed: 0 }
    const { data } = await apiClient.get('/reservations', {
      params: { spaceId: cleanSpaceId },
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
      params: { residentId: cleanResidentId },
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
      params: { spaceId: cleanSpaceId, date: cleanDate },
    })

    const candidate = { date: cleanDate, startTime: cleanStart, endTime: cleanEnd }
    const overlapping = (existing ?? []).some((reservation) =>
      reservationsOverlap(reservation, candidate),
    )

    if (overlapping) {
      throw apiError('RESERVATION_OVERLAP')
    }

    const newReservation = {
      id: `reservation-${Date.now()}`,
      spaceId: cleanSpaceId,
      residentId: cleanResidentId,
      residentName: String(residentName ?? '').trim(),
      residentCode: String(residentCode ?? '').trim(),
      date: cleanDate,
      startTime: cleanStart,
      endTime: cleanEnd,
    }

    const { data: created } = await apiClient.post('/reservations', newReservation)
    return publicReservation(created)
  },
}
