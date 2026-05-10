/**
 * Mercado Pago Checkout Bricks integration service.
 *
 * In DEMO / sandbox mode the SDK is loaded but Bricks rendering is expected
 * to fail because no real Public Key is configured.  When that happens the
 * view falls back to a simulated card-payment form.
 *
 * To enable real Mercado Pago payments:
 *   1. Set VITE_MP_PUBLIC_KEY in your .env to your real TEST or PROD key.
 *   2. Implement a backend endpoint that creates a MercadoPago preference
 *      and returns the preferenceId (replace `createPaymentPreference`).
 *   3. Implement `processCardPayment` to call your backend with the
 *      card token that Bricks provides.
 */

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
 * Simulate creating a MercadoPago payment preference (backend call).
 *
 * In production this should POST to your API which in turn calls the
 * MercadoPago Node SDK to create a preference and returns { preferenceId }.
 */
export async function createPaymentPreference(/* feeId, amount */) {
  // Simulated network delay
  await new Promise((r) => setTimeout(r, 400))
  return {
    preferenceId: `DEMO-PREF-${Date.now()}`,
    initPoint: null, // not used for Bricks
  }
}

/**
 * Simulate processing a card payment via the backend.
 *
 * In production this receives the card token from Bricks and sends it
 * to your backend, which calls MercadoPago's payment API.
 *
 * @param {object} payload  { token, issuer_id, payment_method_id, transaction_amount, installments, payer }
 * @returns {Promise<object>} Simulated payment result.
 */
export async function processCardPayment(payload) {
  // Simulated processing delay
  await new Promise((r) => setTimeout(r, 1500))

  return {
    id: `MP-${Date.now()}`,
    status: 'approved',
    status_detail: 'accredited',
    transaction_amount: payload.transaction_amount ?? payload.amount ?? 0,
    payment_method_id: payload.payment_method_id ?? 'visa',
    date_approved: new Date().toISOString(),
  }
}
