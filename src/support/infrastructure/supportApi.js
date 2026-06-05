import { apiClient } from '@/shared/infrastructure/api/apiClient.js'
import { withOwnerParams } from '@/shared/infrastructure/api/ownerQuery.js'
import { getActiveDataOwnerId } from '@/shared/infrastructure/api/ownerTenant.js'
import { Faq } from '../domain/faq.js'

/**
 * @param {string} chatId
 * @param {{ authorRole: 'resident' | 'admin', body: string, authorName?: string }} msg
 */
async function appendMessageInternal(chatId, msg) {
  const { data: chat } = await apiClient.get(
    `/supportChats/${encodeURIComponent(chatId)}`,
  )
  const row = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    authorRole: msg.authorRole,
    body: msg.body.trim(),
    createdAt: new Date().toISOString(),
    ...(msg.authorName ? { authorName: msg.authorName } : {}),
  }
  const messages = [...(Array.isArray(chat.messages) ? chat.messages : []), row]
  const updatedAt = row.createdAt
  const { data } = await apiClient.put(`/supportChats/${encodeURIComponent(chatId)}`, {
    ...chat,
    messages,
    updatedAt,
  })
  return data
}

export const supportApi = {
  async getFaqs() {
    const mockFaqs = [
      { id: 1, questionKey: 'faq1Question', answerKey: 'faq1Answer' },
      { id: 2, questionKey: 'faq2Question', answerKey: 'faq2Answer' },
      { id: 3, questionKey: 'faq3Question', answerKey: 'faq3Answer' },
      { id: 4, questionKey: 'faq4Question', answerKey: 'faq4Answer' },
    ]
    return mockFaqs.map((data) => new Faq(data))
  },

  /** @param {string} residentId */
  async listChatsForResident(residentId) {
    const cleanId = residentId != null ? String(residentId) : ''
    if (!cleanId) return []
    const { data } = await apiClient.get('/supportChats', {
      params: withOwnerParams({
        residentId: cleanId,
        _sort: 'updatedAt',
        _order: 'desc',
      }),
    })
    return Array.isArray(data) ? data : []
  },

  async listChatsForAdmin() {
    const { data } = await apiClient.get('/supportChats', {
      params: withOwnerParams({
        _sort: 'updatedAt',
        _order: 'desc',
      }),
    })
    return Array.isArray(data) ? data : []
  },

  /** @param {{ residentId: string, residentName?: string, topic?: string }} body */
  async createChat(body) {
    const ownerAdminId = getActiveDataOwnerId()
    if (!ownerAdminId) {
      const err = new Error('OWNER_REQUIRED')
      err.code = 'OWNER_REQUIRED'
      throw err
    }
    const now = new Date().toISOString()
    const id = `support-chat-${Date.now()}`
    const payload = {
      id,
      ownerAdminId,
      residentId: String(body.residentId),
      residentName: body.residentName != null ? String(body.residentName) : '',
      topic: body.topic != null && String(body.topic).trim() ? String(body.topic).trim() : 'Soporte',
      status: 'open',
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    const { data } = await apiClient.post('/supportChats', payload)
    return data
  },

  /** @param {string} chatId */
  async getChatById(chatId) {
    const { data } = await apiClient.get(`/supportChats/${encodeURIComponent(chatId)}`)
    return data
  },

  /**
   * @param {string} chatId
   * @param {{ authorRole: 'resident' | 'admin', body: string, authorName?: string }} message
   */
  async appendMessage(chatId, message) {
    return appendMessageInternal(chatId, message)
  },
}
