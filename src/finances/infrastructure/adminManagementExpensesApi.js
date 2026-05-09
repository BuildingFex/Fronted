import { apiClient } from '@/shell/infrastructure/api/apiClient.js'
import { apiError } from '@/shell/infrastructure/api/utils.js'

/**
 * Gastos administrativos (mock json-server) para vista recaudaciones.
 */
export const adminManagementExpensesApi = {
  async list() {
    const { data } = await apiClient.get('/adminManagementExpenses')
    return Array.isArray(data) ? data : []
  },

  async add({ name, amount, purchaseDate, invoicePhotoUrl }) {
    const cleanName = String(name ?? '').trim()
    const parsedAmount = amount === '' || amount == null ? Number.NaN : Number(amount)
    const dateStr = String(purchaseDate ?? '').trim()

    if (!cleanName || !Number.isFinite(parsedAmount) || parsedAmount < 0 || !dateStr) {
      throw apiError(
        'ADMIN_EXPENSE_FIELDS_REQUIRED',
        'Name, a valid amount, and purchase date are required.',
      )
    }

    const newRow = {
      id: `admin-exp-${Date.now()}`,
      name: cleanName,
      amount: parsedAmount,
      purchaseDate: dateStr,
      invoicePhotoUrl: String(invoicePhotoUrl ?? '').trim(),
    }

    const { data: created } = await apiClient.post('/adminManagementExpenses', newRow)
    return created
  },
}
