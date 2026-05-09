import axios from 'axios';
import { Receipt } from '../domain/receipt.js';

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
  }
};
