/**
 * Mercado Pago Checkout Pro integration service.
 *
 * Backend endpoints:
 *   GET  /api/v1/payments/config    → public key + status
 *   POST /api/v1/payments/checkout  → Checkout Pro for resident maintenance fees
 *   POST /api/v1/payments/confirm     → confirm return from Checkout Pro
 *   POST /api/v1/payments/preference → single receipt preference (legacy)
 *   POST /api/v1/payments/process      → card token (legacy Bricks)
 */

import { apiClient } from '@/shared/infrastructure/api/apiClient.js'
import { getActiveDataOwnerId } from '@/shared/infrastructure/api/ownerTenant.js'

/**
 * Start Checkout Pro for all pending maintenance fees (resident).
 */
export async function checkoutMaintenanceFees({ residentId, payerEmail } = {}) {
  const ownerId = getActiveDataOwnerId()
  const frontendBaseUrl = typeof window !== 'undefined' ? window.location.origin : undefined

  const { data } = await apiClient.post('/api/v1/payments/checkout', {
    residentId: String(residentId),
    ...(ownerId ? { ownerAdminId: ownerId } : {}),
    ...(payerEmail ? { payerEmail } : {}),
    ...(frontendBaseUrl ? { frontendBaseUrl } : {}),
  })

  return {
    preferenceId: data.preferenceId,
    initPoint: data.initPoint ?? null,
    demo: Boolean(data.demo),
  }
}

/**
 * Confirm maintenance payment after Checkout Pro return.
 */
export async function confirmMaintenancePayment({ residentId, paymentId = null, demo = false } = {}) {
  const ownerId = getActiveDataOwnerId()

  const { data } = await apiClient.post('/api/v1/payments/confirm', {
    residentId: String(residentId),
    ...(ownerId ? { ownerAdminId: ownerId } : {}),
    paymentId,
    demo,
  })

  return {
    reconciled: Boolean(data.reconciled),
    itemsPaid: Number(data.itemsPaid ?? 0),
    paidAt: data.paidAt ?? null,
  }
}

/**
 * Create a MercadoPago payment preference for a single receipt (legacy).
 */
export async function createPaymentPreference(receiptId) {
  const ownerId = getActiveDataOwnerId()
  const { data } = await apiClient.post('/api/v1/payments/preference', {
    receiptId: String(receiptId),
    ...(ownerId ? { ownerAdminId: ownerId } : {}),
  })
  return {
    preferenceId: data.preferenceId,
    initPoint: data.initPoint ?? null,
  }
}

export function isPaymentApproved(result) {
  return result?.status === 'approved'
}
