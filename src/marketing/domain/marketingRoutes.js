/**
 * Ubiquitous language: public routes of the marketing / landing bounded context.
 * Keep names in sync with `presentation/router` route definitions.
 */
export const MarketingRouteNames = /** @type {const} */ ({
  HOME: 'home',
  LOGIN: 'login',
  REGISTER: 'register',
  APP_DASHBOARD: 'app-dashboard',
  APP_ADVANCED_MANAGEMENT: 'app-advanced-management',
  APP_IMPORT: 'app-import',
  APP_FINANCE: 'app-finance',
  APP_GENERATION: 'app-generation',
  APP_INCIDENTS: 'app-incidents',
  APP_INFORMATION: 'app-information',
  APP_PROJECTS: 'app-projects',
  APP_SETTINGS: 'app-settings',
  TERMS: 'terms',
  PRIVACY: 'privacy',
})

/** @typedef {typeof MarketingRouteNames[keyof typeof MarketingRouteNames]} MarketingRouteName */

export const MarketingPaths = /** @type {const} */ ({
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  APP: '/app',
  APP_ADVANCED_MANAGEMENT: '/app/advanced-management',
  APP_IMPORT: '/app/import',
  APP_FINANCE: '/app/finance',
  APP_GENERATION: '/app/generation',
  APP_INCIDENTS: '/app/incidents',
  APP_INFORMATION: '/app/information',
  APP_PROJECTS: '/app/projects',
  APP_SETTINGS: '/app/settings',
  TERMS: '/terms',
  PRIVACY: '/privacy',
})
