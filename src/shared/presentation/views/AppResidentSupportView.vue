<script setup>
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Dialog from 'primevue/dialog'
import ConfirmActions from '@/shared/presentation/components/ConfirmActions.vue'
import Textarea from 'primevue/textarea'

import { useSupportStore } from '../../../support/application/supportStore.js'
import { useSession } from '@/iam/application/sessionStore.js'

const { t, locale } = useI18n()
const { state: sessionState } = useSession()
const store = useSupportStore()
const searchQuery = ref('')
const chatMessage = ref('')
const sending = ref(false)
const messagesEl = ref(null)

const filteredFaqs = computed(() => {
  if (!searchQuery.value) return store.state.faqs
  const q = searchQuery.value.toLowerCase()
  return store.state.faqs.filter((faq) => {
    const qText = t(`supportResident.${faq.questionKey}`).toLowerCase()
    const aText = t(`supportResident.${faq.answerKey}`).toLowerCase()
    return qText.includes(q) || aText.includes(q)
  })
})

const residentId = computed(() => sessionState.profile?.id ?? '')
const residentName = computed(() => sessionState.profile?.name ?? '')

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(locale.value === 'es' ? 'es-PE' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return String(iso)
  }
}

async function scrollChatToBottom() {
  await nextTick()
  const el = messagesEl.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(
  () => store.state.activeChat?.messages?.length,
  () => {
    scrollChatToBottom()
  },
)

watch(
  () => store.state.chatDialogVisible,
  (open) => {
    if (open) scrollChatToBottom()
  },
)

onMounted(async () => {
  store.loadFaqs()
  if (residentId.value) {
    await store.loadMyChats(residentId.value)
  }
})

const handleStartChat = async () => {
  if (!residentId.value) return
  await store.initiateAsyncChat(
    residentId.value,
    residentName.value,
    t('supportResident.defaultChatTopic'),
  )
}

async function sendChatMessage() {
  const text = chatMessage.value.trim()
  if (!text || sending.value) return
  sending.value = true
  try {
    await store.sendResidentMessage(text, { name: residentName.value })
    chatMessage.value = ''
  } catch (e) {
    console.error(e)
  } finally {
    sending.value = false
  }
}

function openExisting(chat) {
  store.openChatDialog(chat)
}

function previewLast(chat) {
  const msgs = chat.messages
  if (!Array.isArray(msgs) || msgs.length === 0) return '—'
  const last = msgs[msgs.length - 1]
  return typeof last?.body === 'string' ? last.body : '—'
}
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('supportResident.title') }}</h1>
    <p class="app-view__subtitle">{{ t('supportResident.faqDescription') }}</p>

    <div class="finance-page">
      <div class="finance-toolbar-row">
        <Button
          type="button"
          rounded
          :label="t('supportResident.startChatBtn')"
          icon="pi pi-comments"
          severity="secondary"
          class="finance-toolbar-row__btn"
          :disabled="!residentId"
          :loading="store.state.isSubmittingTicket"
          @click="handleStartChat"
        />
      </div>
      <p v-if="!residentId" class="app-view__subtitle support-session-hint" role="status">
        {{ t('supportResident.sessionMissing') }}
      </p>

      <div class="finance-main-row">
        <section
          class="finance-panel finance-panel--table table-panel support-stack"
          aria-labelledby="support-search-heading"
        >
          <h2 id="support-search-heading" class="finance-panel__section-title">
            {{ t('supportResident.searchPlaceholder') }}
          </h2>
          <div class="support-search-wrap">
            <i class="pi pi-search support-search-wrap__icon" aria-hidden="true"></i>
            <InputText
              v-model="searchQuery"
              :placeholder="t('supportResident.searchPlaceholder')"
              class="support-search-input"
            />
          </div>

          <h2 id="conv-heading" class="finance-panel__section-title support-section-spaced">
            {{ t('supportResident.conversationsTitle') }}
          </h2>
          <p v-if="store.state.loadChatsError" class="support-load-error" role="alert">
            {{ t('supportResident.loadChatsError') }}
          </p>
          <ul v-if="store.state.myChats.length" class="support-conv-list">
            <li v-for="c in store.state.myChats" :key="c.id">
              <button type="button" class="finance-card support-conv-card" @click="openExisting(c)">
                <span class="support-conv-card__topic">{{
                  c.topic || t('supportResident.defaultChatTopic')
                }}</span>
                <span class="support-conv-card__meta">{{ formatWhen(c.updatedAt || c.createdAt) }}</span>
                <span class="support-conv-card__preview">{{ previewLast(c) }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="empty-list support-empty-chats">{{ t('supportResident.noConversations') }}</p>
        </section>

        <section
          class="finance-panel finance-panel--calendar calendar-widget support-faq-panel"
          aria-labelledby="support-faq-heading"
        >
          <h2 id="support-faq-heading" class="finance-panel__section-title">
            {{ t('supportResident.faqTitle') }}
          </h2>
          <Accordion v-if="filteredFaqs.length > 0" class="faq-accordion">
            <AccordionPanel v-for="faq in filteredFaqs" :key="faq.id" :value="faq.id.toString()">
              <AccordionHeader class="faq-header">{{
                t(`supportResident.${faq.questionKey}`)
              }}</AccordionHeader>
              <AccordionContent>
                <p class="faq-answer">{{ t(`supportResident.${faq.answerKey}`) }}</p>
              </AccordionContent>
            </AccordionPanel>
          </Accordion>
          <div v-else-if="store.state.faqs.length > 0 && filteredFaqs.length === 0" class="support-faq-state">
            <p class="app-view__subtitle">{{ t('supportResident.faqNoResults') }}</p>
          </div>
          <div v-else class="support-faq-state">
            <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
          </div>
        </section>
      </div>
    </div>

    <Dialog
      v-model:visible="store.state.chatDialogVisible"
      modal
      :header="t('supportResident.chatTitle')"
      :style="{ width: 'min(42rem, 96vw)' }"
      @hide="store.closeChatDialog()"
    >
      <div class="chat-dialog-body">
        <div ref="messagesEl" class="chat-messages" role="log" aria-live="polite">
          <div class="chat-bubble chat-bubble--agent">
            <p>{{ t('supportResident.chatGreeting') }}</p>
          </div>
          <div
            v-for="m in store.state.activeChat?.messages || []"
            :key="m.id"
            class="chat-bubble"
            :class="
              m.authorRole === 'admin'
                ? 'chat-bubble--agent'
                : m.authorRole === 'resident'
                  ? 'chat-bubble--self'
                  : 'chat-bubble--neutral'
            "
          >
            <span class="chat-bubble__who">{{
              m.authorRole === 'admin'
                ? t('supportResident.labelAdmin')
                : m.authorRole === 'resident'
                  ? t('supportResident.labelYou')
                  : ''
            }}</span>
            <p class="chat-bubble__text">{{ m.body }}</p>
            <span class="chat-bubble__time">{{ formatWhen(m.createdAt) }}</span>
          </div>
        </div>
        <Textarea
          v-model="chatMessage"
          rows="3"
          :placeholder="t('supportResident.messagePlaceholder')"
          class="support-textarea"
          autoResize
          @keydown.enter.exact.prevent="sendChatMessage"
        />
      </div>
      <template #footer>
        <ConfirmActions
          :cancel-label="t('supportResident.cancel')"
          :confirm-label="t('supportResident.send')"
          cancel-icon="pi pi-times"
          confirm-icon="pi pi-send"
          :loading="sending"
          :disabled="!chatMessage.trim()"
          @cancel="store.closeChatDialog()"
          @confirm="sendChatMessage"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* Page shell — aligned with AppFinanceView */
.app-view {
  padding: 1.75rem 1.5rem 2.5rem;
  max-width: 72rem;
}

.app-view__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.15;
  color: var(--apple-text, #1d1d1f);
}

.app-view__subtitle {
  margin: 0.5rem 0 0;
  max-width: 42rem;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: -0.015em;
  color: var(--apple-text-secondary, #6e6e73);
}

.support-session-hint {
  margin-top: 0.35rem;
  color: #b42318;
}

.finance-page {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.finance-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.finance-toolbar-row__btn :deep(.p-button) {
  font-weight: 500;
  font-size: 0.8125rem;
  padding-block: 0.5rem;
  padding-inline: 1rem;
}

.finance-main-row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 1.25rem;
}

.table-panel {
  flex: 1 1 58%;
  min-width: 0;
}

.calendar-widget {
  flex: 0 1 22rem;
  min-width: 17rem;
}

@media (max-width: 1024px) {
  .finance-main-row {
    flex-direction: column;
  }

  .calendar-widget {
    flex: 1 1 auto;
    min-width: 0;
    max-width: none;
  }
}

.finance-panel {
  padding: 1.2rem 1.25rem 1.35rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.finance-panel--calendar {
  background: #fafafa;
}

.finance-panel--table {
  padding: 1.2rem 1.25rem 1.35rem;
  overflow: hidden;
}

.finance-panel__section-title {
  margin: 0 0 0.85rem;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--apple-text, #1d1d1f);
}

.support-section-spaced {
  margin-top: 1.35rem;
}

.support-stack {
  display: flex;
  flex-direction: column;
}

.support-search-wrap {
  position: relative;
  width: 100%;
  margin-bottom: 0.15rem;
}

.support-search-wrap__icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #86868b;
  font-size: 0.85rem;
  z-index: 1;
}

.support-search-input {
  width: 100%;
  padding-left: 2.35rem;
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  background: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--apple-text, #1d1d1f);
}

.support-search-input:focus {
  outline: none;
  border-color: #0a84ff;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
}

.support-conv-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.support-conv-card {
  width: 100%;
  text-align: left;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-family: inherit;
  transition: box-shadow 0.15s ease;
  appearance: none;
}

.support-conv-card:hover {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.support-conv-card__topic {
  font-weight: 600;
  font-size: 0.9375rem;
  letter-spacing: -0.02em;
  color: var(--apple-text, #1d1d1f);
}

.support-conv-card__meta {
  font-size: 0.72rem;
  color: #86868b;
  font-weight: 500;
}

.support-conv-card__preview {
  font-size: 0.8125rem;
  color: var(--apple-text-secondary, #6e6e73);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.support-load-error {
  color: #d70015;
  font-size: 0.8125rem;
  margin: 0 0 0.65rem;
}

.support-empty-chats {
  margin: 0;
  padding: 0.5rem 0;
}

.empty-list {
  color: var(--apple-text-secondary, #6e6e73);
  font-size: 0.8125rem;
  text-align: center;
}

.support-faq-panel {
  overflow: hidden;
}

.support-faq-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 12rem;
  color: #aeaeb2;
  font-size: 1.75rem;
}

.finance-card {
  padding: 1.1rem 1.2rem;
  border-radius: 12px;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.15s ease;
}

.faq-accordion :deep(.p-accordionheader) {
  background: #fff;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  color: var(--apple-text, #1d1d1f);
  font-weight: 600;
  font-size: 0.9rem;
  padding: 1rem 1.1rem;
  border-radius: 0;
}

.faq-accordion :deep(.p-accordionpanel:last-child .p-accordionheader) {
  border-bottom: none;
}

.faq-accordion :deep(.p-accordioncontent-content) {
  padding: 0 1.1rem 1.1rem;
  background: #fff;
}

.faq-answer {
  color: var(--apple-text-secondary, #6e6e73);
  line-height: 1.55;
  margin: 0;
  font-size: 0.875rem;
}

/* Chat dialog */
.chat-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.25rem;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 22rem;
  overflow-y: auto;
  padding: 0.25rem 0.15rem 0.5rem 0;
}

.chat-bubble {
  padding: 0.75rem 1rem;
  border-radius: 12px;
  max-width: 92%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.chat-bubble p {
  margin: 0;
}

.chat-bubble--agent {
  align-self: flex-start;
  background: #f2f2f7;
  color: var(--apple-text, #1d1d1f);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.chat-bubble--self {
  align-self: flex-end;
  background: rgba(10, 132, 255, 0.12);
  color: #0066cc;
  border: 1px solid rgba(10, 132, 255, 0.22);
}

.chat-bubble--neutral {
  align-self: flex-start;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.chat-bubble__who {
  display: block;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.055em;
  color: #86868b;
  margin-bottom: 0.35rem;
}

.chat-bubble--self .chat-bubble__who {
  color: #0a84ff;
}

.chat-bubble__text {
  font-size: 0.875rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-bubble__time {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.68rem;
  color: #86868b;
}

.support-textarea {
  width: 100%;
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  font-size: 0.875rem;
}

.support-textarea:focus {
  outline: none;
  border-color: #0a84ff;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
}
</style>
