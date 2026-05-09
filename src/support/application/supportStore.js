import { reactive } from 'vue';
import { supportApi } from '../infrastructure/supportApi.js';

const state = reactive({
  faqs: [],
  isSubmittingTicket: false,
  chatStarted: false,
  activeTicket: null,
  error: null
});

export function useSupportStore() {
  const loadFaqs = async () => {
    try {
      state.faqs = await supportApi.getFaqs();
    } catch (e) {
        state.error = 'Failed to load frequent questions';
        console.error(e);
    }
  };

  const initiateAsyncChat = async (residentId, topic) => {
    state.isSubmittingTicket = true;
    state.error = null;
    try {
       const newTicket = await supportApi.createSupportTicket({ 
           residentId, 
           topic: topic || 'General Support'
       });
       state.activeTicket = newTicket;
       state.chatStarted = true;
       return newTicket;
    } catch (e) {
       state.error = 'Failed to initiate asynchronous chat.';
       console.error(e);
       throw e;
    } finally {
       state.isSubmittingTicket = false;
    }
  };

  const closeChat = () => {
      state.chatStarted = false;
      state.activeTicket = null;
  };

  return {
    state,
    loadFaqs,
    initiateAsyncChat,
    closeChat
  };
}
