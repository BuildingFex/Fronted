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
    const fee = state.fees.find((f) => f.status === 'Pendiente')
    if (!fee) return null

    try {
      // 1. Update the fee status to Paid
      await financesApi.updateFeeStatus(fee.id, 'Pagado')
      fee.status = 'Pagado'

      // 2. Record the payment in history
      const newPayment = {
        residentId,
        feeId: fee.id,
        feeMonth: fee.month,
        amount: fee.amount,
        paidAt: mpResult.date_approved || new Date().toISOString(),
        method: 'Mercado Pago',
        reference: mpResult.id,
      }
      const savedPayment = await financesApi.addPayment(newPayment)
      state.paymentHistory.push(savedPayment)
      
      return savedPayment
    } catch (err) {
      console.error('Error recording payment', err)
      return null
    }
  }

  return { state, loadData, recordPayment }
}
