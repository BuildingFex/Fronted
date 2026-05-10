<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import AccordionHeader from 'primevue/accordionheader'
import AccordionContent from 'primevue/accordioncontent'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'

import { useSupportStore } from '../../../support/application/supportStore.js'

const { t } = useI18n()
const store = useSupportStore()
const searchQuery = ref('')
const chatMessage = ref('')

const filteredFaqs = computed(() => {
    if (!searchQuery.value) return store.state.faqs;
    const q = searchQuery.value.toLowerCase();
    return store.state.faqs.filter(faq => {
       const qText = t(`supportResident.${faq.questionKey}`).toLowerCase();
       const aText = t(`supportResident.${faq.answerKey}`).toLowerCase();
       return qText.includes(q) || aText.includes(q);
    });
});

onMounted(async () => {
    store.loadFaqs()
})

const handleStartChat = async () => {
    await store.initiateAsyncChat('resident-123', 'Help requested from FAQ page')
}

const sendChatMessage = () => {
   if (!chatMessage.value.trim()) return
   chatMessage.value = ''
   alert("Message sent! A support agent will review it shortly directly in your app.")
   store.closeChat()
}
</script>

<template>
  <div class="support-view">
     <div class="support-grid">
         <!-- LEFT COLUMN -->
         <div class="left-col">
            <h1 class="main-title">{{ t('supportResident.title') }}</h1>
            
            <div class="search-box">
                <i class="pi pi-search search-icon"></i>
                <InputText v-model="searchQuery" :placeholder="t('supportResident.searchPlaceholder')" class="search-input" />
            </div>

            <h2 class="sub-title">{{ t('supportResident.faqTitle') }}</h2>
            <p class="desc-text">{{ t('supportResident.faqDescription') }}</p>
            
            <div class="chat-action-wrapper">
               <Button 
                  :label="t('supportResident.startChatBtn')" 
                  icon="pi pi-comments" 
                  class="p-button-outlined p-button-secondary chat-btn" 
                  @click="handleStartChat" 
                  :loading="store.state.isSubmittingTicket"
               />
            </div>
         </div>

         <!-- RIGHT COLUMN -->
         <div class="right-col">
            <div class="accordion-card glass-container">
               <Accordion class="faq-accordion" v-if="filteredFaqs.length > 0">
                  <AccordionPanel v-for="(faq, index) in filteredFaqs" :key="faq.id" :value="faq.id.toString()">
                      <AccordionHeader class="faq-header">{{ t(`supportResident.${faq.questionKey}`) }}</AccordionHeader>
                      <AccordionContent>
                         <p class="faq-answer">{{ t(`supportResident.${faq.answerKey}`) }}</p>
                      </AccordionContent>
                  </AccordionPanel>
               </Accordion>
               <div v-else-if="store.state.faqs.length > 0 && filteredFaqs.length === 0" class="loading-state">
                  <p style="color: #64748b; font-size: 1.1rem;">No results found.</p>
               </div>
               <div v-else class="loading-state">
                  <i class="pi pi-spin pi-spinner"></i>
               </div>
            </div>
         </div>
     </div>

     <!-- CHAT DIALOG MOCK -->
     <Dialog v-model:visible="store.state.chatStarted" modal :header="t('supportResident.chatTitle')" :style="{ width: '35rem' }">
         <div class="chat-dialog-content">
             <div class="chat-bubble receive">
                 <p>{{ t('supportResident.chatGreeting') }}</p>
             </div>
             <Textarea v-model="chatMessage" rows="5" placeholder="Type your message here..." class="chat-textarea" autoResize />
         </div>
         <template #footer>
             <Button label="Cancel" icon="pi pi-times" @click="store.closeChat()" text severity="secondary" />
             <Button label="Send" icon="pi pi-send" @click="sendChatMessage" autofocus class="p-button-primary" />
         </template>
     </Dialog>
  </div>
</template>

<style scoped>
.support-view {
  padding: 3rem 2rem;
  max-width: 85rem;
  margin: 0 auto;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1e293b;
}

.support-grid {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 4rem;
  align-items: flex-start;
}

@media (max-width: 900px) {
  .support-grid {
     grid-template-columns: 1fr;
  }
}

/* LEFT COL */
.left-col {
  padding-right: 1rem;
}

.main-title {
  margin: 0 0 1.5rem 0;
  font-size: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.search-box {
  position: relative;
  margin-bottom: 2.5rem;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  z-index: 2;
}

.search-input {
  width: 100%;
  padding: 0.8rem 1rem 0.8rem 2.8rem;
  border-radius: 2rem;
  border: none;
  background-color: #f1f5f9;
  font-size: 1rem;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.03);
  transition: all 0.2s ease;
}
.search-input:focus {
  outline: none;
  background-color: #e2e8f0;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.06), 0 0 0 2px rgba(59,130,246,0.3);
}

.sub-title {
  margin: 0 0 0.8rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
}

.desc-text {
  margin: 0 0 2rem 0;
  color: #64748b;
  line-height: 1.6;
  font-size: 1rem;
}

.chat-action-wrapper {
  margin-top: 2rem;
}

.chat-btn {
  border-radius: 2rem;
  padding: 0.8rem 1.5rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

/* RIGHT COL */
.accordion-card {
  background: #ffffff;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01);
  overflow: hidden;
}

.faq-accordion :deep(.p-accordionheader) {
  background: white;
  border: none;
  border-bottom: 1px solid #e2e8f0;
  color: #1e293b;
  font-weight: 700;
  padding: 1.25rem 1.5rem;
}
.faq-accordion :deep(.p-accordionpanel:last-child .p-accordionheader) {
  border-bottom: none;
}
  
.faq-accordion :deep(.p-accordioncontent-content) {
  padding: 0 1.5rem 1.25rem 1.5rem;
  background: white;
}

.faq-answer {
  color: #64748b;
  line-height: 1.6;
  margin: 0;
  font-size: 0.95rem;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  color: #cbd5e1;
  font-size: 2rem;
}

/* CHAT MOCK STYLES */
.chat-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 1rem;
}

.chat-bubble {
  background: #f1f5f9;
  padding: 1rem 1.5rem;
  border-radius: 1.5rem;
  border-top-left-radius: 0;
  max-width: 85%;
  align-self: flex-start;
  color: #334155;
  box-shadow: 0 2px 5px rgba(0,0,0,0.02);
}
.chat-bubble p {
  margin: 0;
}

.chat-textarea {
  width: 100%;
  border-radius: 0.5rem;
  resize: none;
  border: 1px solid #cbd5e1;
}
</style>
