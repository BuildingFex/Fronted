import { getActiveDataOwnerId } from './ownerTenant.js'

/** Merge json-server query params with owner scope when a data owner is active. */
export function withOwnerParams(params = {}) {
  const ownerId = getActiveDataOwnerId()
  if (!ownerId) return { ...params }
  return { ...params, ownerAdminId: ownerId }
}
