/**
 * Mercado Pago Checkout Bricks integration service.
 *
 * This module connects to the ASP.NET Core backend endpoints:
 *   - POST /api/v1/payments/preference  → creates a Checkout Pro preference
 *   - POST /api/v1/payments/process     → processes card token from Bricks
 *
 * The backend in turn uses the official MercadoPago C# SDK to communicate
 * with the MercadoPago API.
 *
 * To enable real Mercado Pago payments:
 *   1. Set VITE_MP_PUBLIC_KEY in your .env to your real TEST or PROD key.
 *   2. Ensure the backend has a valid AccessToken in appsettings.json.
 */

import { apiClient } from '@/shared/infrastructure/api/apiClient.js'
import { getActiveDataOwnerId } from '@/shared/infrastructure/api/ownerTenant.js'

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY || 'TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'

let mpInstance = null

/**
 * Load and initialise the MercadoPago SDK singleton.
 * Returns the sdk instance or null if it cannot be loaded.
 */
export async function initMercadoPago() {
  if (mpInstance) return mpInstance

  try {
    const { loadMercadoPago } = await import('@mercadopago/sdk-js')
    await loadMercadoPago()

    if (window.MercadoPago) {
      mpInstance = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' })
      return mpInstance
    }
  } catch (err) {
    console.warn('[MercadoPago] SDK could not be loaded – running in demo mode.', err)
  }
  return null
}

/**
 * Render the Card Payment Brick inside the given container element.
 *
 * @param {HTMLElement} container   DOM node where the Brick will mount.
 * @param {object}      opts
 * @param {number}      opts.amount             Amount to charge.
 * @param {Function}    opts.onSubmit           Called with the card-token data.
 * @param {Function}    opts.onError            Called on Brick errors.
 * @returns {object|null} Brick controller, or null if Bricks are unavailable.
 */
export async function renderCardPaymentBrick(container, { amount, onSubmit, onError }) {
  const mp = await initMercadoPago()
  if (!mp) return null

  try {
    const bricksBuilder = mp.bricks()

    const controller = await bricksBuilder.create('cardPayment', container, {
      initialization: {
        amount,
      },
      callbacks: {
        onReady: () => { /* Brick loaded */ },
        onSubmit: async (cardFormData) => {
          if (onSubmit) await onSubmit(cardFormData)
        },
        onError: (error) => {
          console.error('[MercadoPago Brick]', error)
          if (onError) onError(error)
        },
      },
      customization: {
        visual: { hideFormTitle: true, hidePaymentButton: true },
        paymentMethods: {
          maxInstallments: 1,
        },
      },
    })

    return controller
  } catch (err) {
    console.warn('[MercadoPago] Bricks could not be rendered – falling back to demo form.', err)
    return null
  }
}

/**
 * Create a MercadoPago payment preference via the backend.
 *
 * Calls POST /api/v1/payments/preference which uses the MercadoPago C# SDK
 * to create a Checkout Pro preference and returns { preferenceId, initPoint }.
 *
 * @param {string|number} receiptId  The external ID of the receipt to pay.
 * @returns {Promise<{preferenceId: string, initPoint: string|null}>}
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

/**
 * Process a card payment via the backend using the card token from Bricks.
 *
 * Calls POST /api/v1/payments/process which uses the MercadoPago C# SDK
 * to create the actual payment and reconcile the receipt.
 *
 * @param {object} payload  { token, issuer_id, payment_method_id, transaction_amount, installments, payer }
 * @param {string} [receiptId]  Optional receipt external ID to associate the payment.
 * @returns {Promise<object>} Payment result with { id, status, status_detail, transaction_amount, payment_method_id, date_approved }.
 */
export async function processCardPayment(payload, receiptId = null) {
  const ownerId = getActiveDataOwnerId()
  const { data } = await apiClient.post('/api/v1/payments/process', {
    ...payload,
    ...(receiptId ? { receiptId: String(receiptId) } : {}),
    ...(ownerId ? { ownerAdminId: ownerId } : {}),
  })
  return {
    id: data.id,
    status: data.status,
    status_detail: data.status_detail,
    transaction_amount: data.transaction_amount ?? payload.transaction_amount ?? payload.amount ?? 0,
    payment_method_id: data.payment_method_id ?? payload.payment_method_id ?? 'visa',
    date_approved: data.date_approved ?? new Date().toISOString(),
  }
}
