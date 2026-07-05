import { apiClient } from '@/shared/infrastructure/api/apiClient.js'
import { apiError } from '@/shared/infrastructure/api/utils.js'

function parseSubscription(data) {
  if (!data || typeof data !== 'object') return null
  return {
    planId: String(data.planId ?? data.PlanId ?? 'free'),
    residentLimit: Number(data.residentLimit ?? data.ResidentLimit ?? 9),
    residentsCount: Number(data.residentsCount ?? data.ResidentsCount ?? 0),
    monthlyPricePen: Number(data.monthlyPricePen ?? data.MonthlyPricePen ?? 0),
    paidUntil: data.paidUntil ?? data.PaidUntil ?? null,
    isPaid: Boolean(data.isPaid ?? data.IsPaid),
  }
}

export const subscriptionApi = {
  async getCurrent() {
    const { data } = await apiClient.get('/api/v1/subscription')
    return parseSubscription(data)
  },

  async changeToFreePlan() {
    const { data } = await apiClient.patch('/api/v1/subscription', { planId: 'free' })
    return parseSubscription(data)
  },

  async checkout(planId) {
    const { data } = await apiClient.post('/api/v1/subscription/checkout', { planId })
    return {
      preferenceId: data?.preferenceId ?? data?.PreferenceId ?? null,
      initPoint: data?.initPoint ?? data?.InitPoint ?? null,
      demo: Boolean(data?.demo ?? data?.Demo),
      amount: Number(data?.amount ?? data?.Amount ?? 0),
      planId: String(data?.planId ?? data?.PlanId ?? planId),
    }
  },

  async confirm({ planId, paymentId = null, demo = false }) {
    const { data } = await apiClient.post('/api/v1/subscription/confirm', {
      planId,
      paymentId,
      demo,
    })
    const subscription = parseSubscription(data?.subscription ?? data?.Subscription)
    return {
      activated: Boolean(data?.activated ?? data?.Activated),
      planId: String(data?.planId ?? data?.PlanId ?? planId),
      paidUntil: data?.paidUntil ?? data?.PaidUntil ?? null,
      subscription,
    }
  },
}

export function subscriptionApiError(error) {
  if (error?.code === 'PLAN_DOWNGRADE_RESIDENTS_EXCEEDED') {
    throw apiError(error.code, error.payload?.message)
  }
  if (error?.code === 'PAID_PLAN_REQUIRES_CHECKOUT') {
    throw apiError(error.code, error.payload?.message)
  }
  throw error
}
