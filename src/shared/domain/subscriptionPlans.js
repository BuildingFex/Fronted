/** Plan identifiers stored from Settings → subscription UI. */
export const SubscriptionPlanId = /** @type {const} */ ({
  FREE: 'free',
  ESSENTIAL: 'essential',
  STANDARD: 'standard',
  SCALE: 'scale',
})

/** Max resident accounts allowed per plan (aligned with pricing copy). */
export const SUBSCRIPTION_PLAN_RESIDENT_LIMITS = /** @type {Record<string, number>} */ ({
  [SubscriptionPlanId.FREE]: 9,
  [SubscriptionPlanId.ESSENTIAL]: 15,
  [SubscriptionPlanId.STANDARD]: 40,
  [SubscriptionPlanId.SCALE]: 80,
})

/**
 * @param {string | null | undefined} planId
 * @returns {number}
 */
export function maxResidentsForSubscriptionPlan(planId) {
  const key = planId != null && String(planId).length ? String(planId) : SubscriptionPlanId.FREE
  const n = SUBSCRIPTION_PLAN_RESIDENT_LIMITS[key]
  return Number.isFinite(n) && n > 0 ? n : SUBSCRIPTION_PLAN_RESIDENT_LIMITS[SubscriptionPlanId.FREE]
}
