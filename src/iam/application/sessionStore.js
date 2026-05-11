import { reactive, computed, readonly } from 'vue'
import { SessionRoles } from '@/iam/domain/sessionRoles.js'
import {
  clearActiveDataOwnerId,
  setActiveDataOwnerId,
} from '@/shell/infrastructure/api/ownerTenant.js'

export { SessionRoles }

const STORAGE_KEY = 'buildingfex.session'

const state = reactive(loadInitialSession())

function loadInitialSession() {
  if (typeof window === 'undefined') {
    return { role: null, profile: null }
  }
  clearActiveDataOwnerId()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { role: null, profile: null }
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const role = parsed.role ?? null
      const profile = parsed.profile ?? null
      if (role === SessionRoles.ADMIN && profile?.id) {
        setActiveDataOwnerId(profile.id)
      } else if (role === SessionRoles.RESIDENT && profile?.ownerAdminId) {
        setActiveDataOwnerId(profile.ownerAdminId)
      }
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
    setActiveDataOwnerId(profile.id ?? null)
    persist()
  }

  function setResidentSession(profile = {}) {
    state.role = SessionRoles.RESIDENT
    state.profile = profile
    setActiveDataOwnerId(profile.ownerAdminId ?? null)
    persist()
  }

  function clearSession() {
    state.role = null
    state.profile = null
    clearActiveDataOwnerId()
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
