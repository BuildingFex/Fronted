import { getActiveDataOwnerId } from '@/iam/application/sessionStore.js'
import { maxResidentsForSubscriptionPlan } from '@/shared/domain/subscriptionPlans.js'

const STORAGE_KEY = 'buildingfex.subscriptionPlanByOwner'

/**
 * @returns {Record<string, { planId: string, updatedAt: string }>}
 */
function readAll() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(map) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota errors
  }
}

/**
 * @param {string} ownerAdminId
 * @param {string} planId
 */
export function saveSubscriptionPlanForOwner(ownerAdminId, planId) {
  const id = ownerAdminId != null ? String(ownerAdminId) : ''
  if (!id) return
  const all = readAll()
  all[id] = {
    planId: String(planId),
    updatedAt: new Date().toISOString(),
  }
  writeAll(all)
}

/**
 * @param {string} [ownerAdminId] defaults to active session owner
 * @returns {string} plan id
 */
export function getSubscriptionPlanIdForOwner(ownerAdminId) {
  const oid =
    ownerAdminId != null && String(ownerAdminId).length
      ? String(ownerAdminId)
      : getActiveDataOwnerId()
  if (!oid) return 'free'
  const row = readAll()[oid]
  return row?.planId && String(row.planId).length ? String(row.planId) : 'free'
}

/** Max residents for the active admin (or given owner), from saved plan. */
export function getResidentLimitForActiveOwner() {
  return maxResidentsForSubscriptionPlan(getSubscriptionPlanIdForOwner())
}
