import { apiClient } from '@/shell/infrastructure/api/apiClient.js'
import { withOwnerParams } from '@/shell/infrastructure/api/ownerQuery.js'
import { getActiveDataOwnerId } from '@/shell/infrastructure/api/ownerTenant.js'
import { Receipt } from '../domain/receipt.js'

export const financesApi = {
  async getSettings() {
    const { data } = await apiClient.get('/financeSettings', { params: withOwnerParams() })
    const row = Array.isArray(data) ? data[0] : data
    if (row && typeof row === 'object') {
      return {
        baseMonthlyExpense: row.baseMonthlyExpense ?? 150,
        lateFeeRate: row.lateFeeRate ?? 0.05,
      }
    }
    return { baseMonthlyExpense: 150, lateFeeRate: 0.05 }
  },

  async getResidents() {
    const { data } = await apiClient.get('/users', {
      params: withOwnerParams({ role: 'resident' }),
    })
    return Array.isArray(data) ? data : []
  },

  async getReceipts() {
    const { data } = await apiClient.get('/receipts', { params: withOwnerParams() })
    return (Array.isArray(data) ? data : []).map((d) => new Receipt(d))
  },

  async getReceiptsByResident(residentId) {
    const { data } = await apiClient.get('/receipts', {
      params: withOwnerParams({ residentId }),
    })
    return (Array.isArray(data) ? data : []).map((d) => new Receipt(d))
  },

  async createReceipt(receiptData) {
    const ownerId = getActiveDataOwnerId()
    const payload = {
      ...receiptData,
      ...(ownerId ? { ownerAdminId: ownerId } : {}),
    }
    const { data } = await apiClient.post('/receipts', payload)
    return new Receipt(data)
  },

  async updateReceipt(receiptId, updateData) {
    const { data } = await apiClient.patch(`/receipts/${receiptId}`, updateData)
    return new Receipt(data)
  },

  async getFees(residentId) {
    const { data } = await apiClient.get('/fees', {
      params: withOwnerParams({ residentId }),
    })
    return data
  },

  async getPayments(residentId) {
    const { data } = await apiClient.get('/payments', {
      params: withOwnerParams({ residentId }),
    })
    return data
  },

  async addPayment(paymentData) {
    const ownerId = getActiveDataOwnerId()
    const payload = {
      ...paymentData,
      ...(ownerId ? { ownerAdminId: ownerId } : {}),
    }
    const { data } = await apiClient.post('/payments', payload)
    return data
  },

  async updateFeeStatus(feeId, status) {
    const { data } = await apiClient.patch(`/fees/${feeId}`, { status })
    return data
  },

  async getDashboardKpis() {
    const { data } = await apiClient.get('/kpi', { params: withOwnerParams() })
    return data
  },
}
