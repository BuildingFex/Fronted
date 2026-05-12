import { reactive } from 'vue'
import { supportApi } from '../infrastructure/supportApi.js'

const state = reactive({
  faqs: [],
  isSubmittingTicket: false,
  chatDialogVisible: false,
  activeChat: null,
  myChats: [],
  error: null,
  loadChatsError: null,
})

export function useSupportStore() {
  const loadFaqs = async () => {
    try {
      state.faqs = await supportApi.getFaqs()
    } catch (e) {
      state.error = 'Failed to load frequent questions'
      console.error(e)
    }
  }

  const loadMyChats = async (residentId) => {
    state.loadChatsError = null
    const cleanId = residentId != null ? String(residentId) : ''
    if (!cleanId) {
      state.myChats = []
      return
    }
    try {
      state.myChats = await supportApi.listChatsForResident(cleanId)
    } catch (e) {
      state.loadChatsError = 'CHATS_LOAD_FAILED'
      console.error(e)
      state.myChats = []
    }
  }

  const setActiveChat = (chat) => {
    state.activeChat = chat ? { ...chat, messages: [...(chat.messages || [])] } : null
  }

  const closeChatDialog = () => {
    state.chatDialogVisible = false
    state.activeChat = null
  }

  const openChatDialog = async (chat) => {
    state.error = null
    try {
      const full = await supportApi.getChatById(chat.id)
      setActiveChat(full)
      state.chatDialogVisible = true
    } catch (e) {
      state.error = 'CHAT_LOAD_FAILED'
      console.error(e)
    }
  }

  /**
   * @param {string} residentId
   * @param {string} [residentName]
   * @param {string} [topic]
   */
  const initiateAsyncChat = async (residentId, residentName, topic) => {
    state.isSubmittingTicket = true
    state.error = null
    try {
      const newChat = await supportApi.createChat({
        residentId,
        residentName,
        topic: topic || 'Soporte',
      })
      await loadMyChats(residentId)
      setActiveChat(newChat)
      state.chatDialogVisible = true
      return newChat
    } catch (e) {
      state.error = 'CHAT_CREATE_FAILED'
      console.error(e)
      throw e
    } finally {
      state.isSubmittingTicket = false
    }
  }

  /**
   * @param {string} body
   * @param {{ name?: string }} [residentProfile]
   */
  const sendResidentMessage = async (body, residentProfile = {}) => {
    const chatId = state.activeChat?.id
    if (!chatId || !body.trim()) return null
    const updated = await supportApi.appendMessage(chatId, {
      authorRole: 'resident',
      body,
      authorName: residentProfile.name,
    })
    setActiveChat(updated)
    const rid = updated?.residentId
    if (rid) await loadMyChats(rid)
    return updated
  }

  /** @deprecated use closeChatDialog */
  const closeChat = () => {
    closeChatDialog()
  }

  return {
    state,
    loadFaqs,
    loadMyChats,
    initiateAsyncChat,
    openChatDialog,
    closeChatDialog,
    closeChat,
    sendResidentMessage,
    setActiveChat,
  }
}
