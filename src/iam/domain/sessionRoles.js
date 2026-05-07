/**
 * IAM domain: roles a session can carry inside the application.
 * Treated as a value object (frozen, no behavior).
 */
export const SessionRoles = Object.freeze({
  ADMIN: 'admin',
  RESIDENT: 'resident',
})

/** @typedef {typeof SessionRoles[keyof typeof SessionRoles]} SessionRole */
