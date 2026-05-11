/**
 * Active "data owner" for json-server queries (admin account id).
 * For residents, this is their building admin's id so fees/receipts stay scoped.
 * Set from session on login; cleared on logout.
 */
let activeDataOwnerId = null

export function setActiveDataOwnerId(id) {
  activeDataOwnerId = id ? String(id) : null
}

export function clearActiveDataOwnerId() {
  activeDataOwnerId = null
}

export function getActiveDataOwnerId() {
  return activeDataOwnerId
}
