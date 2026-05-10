import axios from 'axios';
import { Receipt } from '../domain/receipt.js';
import { apiClient } from '@/shell/infrastructure/api/apiClient.js';

const API_BASE_URL = 'http://localhost:3001';

export const financesApi = {
  async getSettings() {
    const response = await axios.get(`${API_BASE_URL}/financeSettings`);
    return response.data;
  },

  async getResidents() {
    const response = await axios.get(`${API_BASE_URL}/users?role=resident`);
    return response.data;
  },

  async getReceipts() {
    const response = await axios.get(`${API_BASE_URL}/receipts`);
    return response.data.map(data => new Receipt(data));
  },

  async getReceiptsByResident(residentId) {
    const response = await axios.get(`${API_BASE_URL}/receipts?residentId=${residentId}`);
    return response.data.map(data => new Receipt(data));
  },

  async createReceipt(receiptData) {
    const response = await axios.post(`${API_BASE_URL}/receipts`, receiptData);
    return new Receipt(response.data);
  },

  async updateReceipt(receiptId, updateData) {
    const response = await axios.patch(`${API_BASE_URL}/receipts/${receiptId}`, updateData);
    return new Receipt(response.data);
  },

  async getFees(residentId) {
    const { data } = await apiClient.get('/fees', { params: { residentId } });
    return data;
  },

  async getPayments(residentId) {
    const { data } = await apiClient.get('/payments', { params: { residentId } });
    return data;
  },

  async addPayment(paymentData) {
    const { data } = await apiClient.post('/payments', paymentData);
    return data;
  },

  async updateFeeStatus(feeId, status) {
    const { data } = await apiClient.patch(`/fees/${feeId}`, { status });
    return data;
  },
  
  async getDashboardKpis() {
    const { data } = await apiClient.get('/kpi');
    return data;
  }
};
