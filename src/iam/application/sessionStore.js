import { reactive, computed, readonly } from 'vue'
import { SessionRoles } from '@/iam/domain/sessionRoles.js'

export { SessionRoles }

const STORAGE_KEY = 'buildingfex.session'

const state = reactive(loadInitialSession())

function loadInitialSession() {
  if (typeof window === 'undefined') {
    return { role: null, profile: null }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { role: null, profile: null }
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return {
        role: parsed.role ?? null,
        profile: parsed.profile ?? null,
      }
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
