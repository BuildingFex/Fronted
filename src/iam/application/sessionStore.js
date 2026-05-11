import { reactive, computed, readonly } from 'vue'
import { SessionRoles } from '@/iam/domain/sessionRoles.js'

export { SessionRoles }

const STORAGE_KEY = 'buildingfex.session'

const state = reactive(loadInitialSession())

/**
 * json-server "tenant": admin id or (for resident login) the building admin id.
 * Always derived from session state so it cannot drift from persisted profile.
 */
export function getActiveDataOwnerId() {
  if (state.role === SessionRoles.ADMIN) {
    const id = state.profile?.id
    return id != null && String(id).length ? String(id) : null
  }
  if (state.role === SessionRoles.RESIDENT) {
    const oid = state.profile?.ownerAdminId
    return oid != null && String(oid).length ? String(oid) : null
  }
  return null
}

function loadInitialSession() {
  if (typeof window === 'undefined') {
    return { role: null, profile: null }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { role: null, profile: null }
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const role = parsed.role ?? null
      const profile = parsed.profile ?? null
      return { role, profile }
    }
  } catch {
    // ignore parse errors
  }
  return { role: null, profile: null }
}

function persist() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ role: state.role, profile: state.profile }),
    )
  } catch {
    // ignore storage errors
  }
}

export function useSession() {
  const isAdmin = computed(() => state.role === SessionRoles.ADMIN)
  const isResident = computed(() => state.role === SessionRoles.RESIDENT)

  function setAdminSession(profile = {}) {
    state.role = SessionRoles.ADMIN
    state.profile = profile
    persist()
  }

  function setResidentSession(profile = {}) {
    state.role = SessionRoles.RESIDENT
    state.profile = profile
    persist()
  }

  function clearSession() {
    state.role = null
    state.profile = null
    persist()
  }

  return {
    state: readonly(state),
    isAdmin,
    isResident,
    setAdminSession,
    setResidentSession,
    clearSession,
  }
}
