/**
 * Active "data owner" for json-server queries (admin account id).
 * Re-exported from IAM session so owner scope always matches logged-in profile.
 */
export { getActiveDataOwnerId } from '@/iam/application/sessionStore.js'
