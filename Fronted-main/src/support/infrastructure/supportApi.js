import axios from 'axios';
import { Faq, ChatTicket } from '../domain/faq.js';

const API_BASE_URL = 'http://localhost:3001';

export const supportApi = {
  // Frequently Asked Questions are strictly static as they mirror the core documentation,
  // but if they were dynamically fetched, it would go through here.
  async getFaqs() {
    // Simulated remote fetch for Domain objects mapping
    const mockFaqs = [
      { id: 1, questionKey: 'faq1Question', answerKey: 'faq1Answer' },
      { id: 2, questionKey: 'faq2Question', answerKey: 'faq2Answer' },
      { id: 3, questionKey: 'faq3Question', answerKey: 'faq3Answer' },
      { id: 4, questionKey: 'faq4Question', answerKey: 'faq4Answer' }
    ];
    return Promise.resolve(mockFaqs.map(data => new Faq(data)));
  },

  async createSupportTicket(ticketData) {
    // In a real app this would be: await axios.post(`${API_BASE_URL}/tickets`, ticketData);
    // Since we mock it without touching db.json to avoid polluting standard structure,
    // we simulate a resolved remote call.
    return new Promise(resolve => setTimeout(() => resolve(new ChatTicket({ id: Date.now(), ...ticketData})), 800));
  }
};
