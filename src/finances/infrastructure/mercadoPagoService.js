/**
 * Mercado Pago Checkout Bricks integration service.
 *
 * Backend endpoints:
 *   GET  /api/v1/payments/config    → public key + status
 *   POST /api/v1/payments/preference → Checkout Pro preference
 *   POST /api/v1/payments/process    → card token from Bricks
 */

import { apiClient } from '@/shared/infrastructure/api/apiClient.js'
import { getActiveDataOwnerId } from '@/shared/infrastructure/api/ownerTenant.js'

const ENV_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY || ''
const MP_TEST_BUYER_EMAIL = 'test_user_7044179726386555213@testuser.com'

let mpInstance = null
let resolvedPublicKey = ENV_PUBLIC_KEY

async function resolvePublicKey() {
  if (resolvedPublicKey && !resolvedPublicKey.includes('xxxx')) {
    return resolvedPublicKey
  }

  try {
    const { data } = await apiClient.get('/api/v1/payments/config')
    if (data?.publicKey) {
      resolvedPublicKey = data.publicKey
      return resolvedPublicKey
    }
  } catch {
    // Fall back to env key or placeholder below.
  }

  return resolvedPublicKey || 'TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
}

/**
 * Load and initialise the MercadoPago SDK singleton.
 */
export async function initMercadoPago() {
  if (mpInstance) return mpInstance

  const publicKey = await resolvePublicKey()
  if (!publicKey || publicKey.includes('xxxx')) {
    console.warn('[MercadoPago] Public key not configured.')
    return null
  }

  try {
    const { loadMercadoPago } = await import('@mercadopago/sdk-js')
    await loadMercadoPago()

    if (window.MercadoPago) {
      mpInstance = new window.MercadoPago(publicKey, { locale: 'es-PE' })
      return mpInstance
    }
  } catch (err) {
    console.warn('[MercadoPago] SDK could not be loaded.', err)
  }
  return null
}

/**
 * Render the Card Payment Brick inside the given container element.
 */
export async function renderCardPaymentBrick(container, { amount, onSubmit, onError }) {
  const mp = await initMercadoPago()
  if (!mp) return null

  try {
    const bricksBuilder = mp.bricks()
    const controller = await bricksBuilder.create('cardPayment', container, {
      initialization: { amount },
      callbacks: {
        onReady: () => {},
        onSubmit: (cardFormData) => {
          if (!onSubmit) return Promise.resolve()
          return onSubmit(cardFormData)
        },
        onError: (error) => {
          console.error('[MercadoPago Brick]', error)
          if (onError) onError(error)
        },
      },
      customization: {
        visual: { style: { theme: 'default' } },
        paymentMethods: { maxInstallments: 1 },
      },
    })

    return controller
  } catch (err) {
    console.warn('[MercadoPago] Bricks could not be rendered.', err)
    return null
  }
}

/**
 * Create a MercadoPago payment preference via the backend (Checkout Pro).
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

function buildPayerPayload(cardFormData, payerEmail) {
  const brickPayer = cardFormData?.payer
  const email = payerEmail || brickPayer?.email || MP_TEST_BUYER_EMAIL

  return {
    email,
    ...(brickPayer?.identification ? { identification: brickPayer.identification } : {}),
  }
}

/**
 * Process a card payment via the backend using the card token from Bricks.
 */
export async function processCardPayment(payload, options = {}) {
  const ownerId = getActiveDataOwnerId()
  const { receiptId = null, payerEmail = null } = options

  const { data } = await apiClient.post('/api/v1/payments/process', {
    token: payload.token,
    issuer_id: payload.issuer_id,
    payment_method_id: payload.payment_method_id,
    transaction_amount: payload.transaction_amount ?? payload.amount,
    installments: payload.installments ?? 1,
    payer: buildPayerPayload(payload, payerEmail),
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

export function isPaymentApproved(result) {
  return result?.status === 'approved'
}
