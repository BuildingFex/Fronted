import { reactive } from 'vue'
import { financesApi } from '@/finances/infrastructure/financesApi.js'

const state = reactive({
  fees: [],
  paymentHistory: [],
  isLoading: false,
  error: null
})

export function useResidentPaymentStore() {
  async function loadData(residentId) {
    if (!residentId) return
    state.isLoading = true
    state.error = null
    try {
      state.fees = await financesApi.getFees(residentId)
      state.paymentHistory = await financesApi.getPayments(residentId)
    } catch (err) {
      console.error(err)
      state.error = err.message || 'Failed to load finances data'
    } finally {
      state.isLoading = false
    }
  }

  async function recordPayment(mpResult, residentId) {
    const pendingFees = state.fees.filter((f) => f.status === 'Pendiente')
    if (pendingFees.length === 0) return null

    try {
      const recordedPayments = []

      for (const fee of pendingFees) {
        // 1. Update the fee status to Paid (or create if it's a mock fee)
        if (typeof fee.id === 'string' && fee.id.startsWith('mock-')) {
          const realFee = { ...fee }
          delete realFee.id
          realFee.status = 'Pagado'
          
          // Disparamos la creación sin hacer await inmediatamente para mitigar el reinicio de json-server
          financesApi.addFee(realFee).catch(() => {})
          fee.status = 'Pagado'
        } else {
          financesApi.updateFeeStatus(fee.id, 'Pagado').catch(() => {})
          fee.status = 'Pagado'
        }

        // 2. Record the payment in history
        const newPayment = {
          residentId,
          feeId: fee.id,
          feeMonth: fee.month,
          concept: fee.concept,
          amount: fee.amount,
          paidAt: mpResult.date_approved || new Date().toISOString(),
          method: 'Mercado Pago',
          reference: mpResult.id,
        }
        
        try {
          const savedPayment = await financesApi.addPayment(newPayment)
          state.paymentHistory.push(savedPayment)
          recordedPayments.push(savedPayment)
        } catch (backendErr) {
          console.warn('Backend reiniciado o inaccesible, guardando solo en estado local.', backendErr)
          const localPayment = { ...newPayment, id: 'local-' + Date.now() }
          state.paymentHistory.push(localPayment)
          recordedPayments.push(localPayment)
        }
      }

      return recordedPayments.length > 0 ? recordedPayments[0] : null
    } catch (err) {
      console.error('Error recording accumulated payments', err)
      return null
    }
  }

  return { state, loadData, recordPayment }
}
