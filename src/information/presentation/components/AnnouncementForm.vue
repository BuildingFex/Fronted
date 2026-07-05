<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ConfirmActions from '@/shared/presentation/components/ConfirmActions.vue'

const { t } = useI18n()

const emit = defineEmits(['submit'])

const title    = ref('')
const body     = ref('')
const priority = ref('normal')
const duration = ref(7)
const submitting = ref(false)
const error    = ref('')
const showModal = ref(false)

function openModal() {
  title.value    = ''
  body.value     = ''
  priority.value = 'normal'
  duration.value = 7
  error.value    = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function handleSubmit() {
  if (!title.value.trim() || !body.value.trim()) {
    error.value = t('information.requiredFields')
    return
  }
  error.value = ''
  submitting.value = true
  emit('submit', {
    title:    title.value.trim(),
    body:     body.value.trim(),
    priority: priority.value,
    duration: duration.value,
  })
  submitting.value = false
  closeModal()
}
</script>

<template>
  <button
    id="btn-new-announcement"
    type="button"
    class="ann-form__trigger"
    @click="openModal"
  >
    <i class="pi pi-plus ann-form__trigger-icon" aria-hidden="true" />
    {{ t('information.newAnnouncement') }}
  </button>

  <Teleport to="body">
    <Transition name="ann-modal">
      <div v-if="showModal" class="ann-modal-overlay bf-modal-backdrop" @click.self="closeModal">
        <div class="ann-modal bf-modal-panel" role="dialog" :aria-label="t('information.newAnnouncement')">
          <header class="ann-modal__header">
            <h2 class="ann-modal__title">{{ t('information.newAnnouncement') }}</h2>
            <button
              type="button"
              class="ann-modal__close"
              :aria-label="t('information.close')"
              @click="closeModal"
            >
              <i class="pi pi-times" aria-hidden="true" />
            </button>
          </header>

          <form class="ann-modal__body" @submit.prevent="handleSubmit">
            <label class="ann-field">
              <span class="ann-field__label">{{ t('information.titleLabel') }}</span>
              <input
                id="input-announcement-title"
                v-model="title"
                type="text"
                class="ann-field__input"
                :placeholder="t('information.titlePlaceholder')"
                maxlength="120"
              />
            </label>

            <label class="ann-field">
              <span class="ann-field__label">{{ t('information.bodyLabel') }}</span>
              <textarea
                id="input-announcement-body"
                v-model="body"
                class="ann-field__textarea"
                :placeholder="t('information.bodyPlaceholder')"
                rows="5"
              />
            </label>

            <label class="ann-field">
              <span class="ann-field__label">{{ t('information.priorityLabel') }}</span>
              <select
                id="select-announcement-priority"
                v-model="priority"
                class="ann-field__select"
              >
                <option value="normal">{{ t('information.priorityNormal') }}</option>
                <option value="important">{{ t('information.priorityImportant') }}</option>
                <option value="urgent">{{ t('information.priorityUrgent') }}</option>
              </select>
            </label>

            <label class="ann-field">
              <span class="ann-field__label">{{ t('information.durationLabel') }}</span>
              <select
                id="select-announcement-duration"
                v-model="duration"
                class="ann-field__select"
              >
                <option :value="7">{{ t('information.duration7') }}</option>
                <option :value="15">{{ t('information.duration15') }}</option>
                <option :value="30">{{ t('information.duration30') }}</option>
              </select>
              <span class="ann-field__hint">{{ t('information.durationHint') }}</span>
            </label>

            <p v-if="error" class="ann-modal__error">{{ error }}</p>

            <ConfirmActions
              :cancel-label="t('information.cancel')"
              :confirm-label="submitting ? t('information.sending') : t('information.send')"
              confirm-type="submit"
              :loading="submitting"
              :disabled="submitting"
              :cancel-disabled="submitting"
              @cancel="closeModal"
            />
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── trigger button ── */
.ann-form__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.1rem;
  border: none;
  border-radius: 980px;
  background: #0071e3;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.18s ease;
}
.ann-form__trigger:hover { background: #0077ed; }
.ann-form__trigger:focus-visible {
  outline: 2px solid #0071e3;
  outline-offset: 2px;
}
.ann-form__trigger-icon { font-size: 0.75rem; }

/* ── modal overlay ── */
.ann-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.ann-modal {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  width: 95%;
  max-width: 32rem;
  overflow: hidden;
  animation: ann-modal-in 0.28s cubic-bezier(0.34, 1.2, 0.64, 1);
}

@keyframes ann-modal-in {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ann-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.15rem 1.35rem 0.75rem;
  border-bottom: 1px solid #e8e8ed;
}
.ann-modal__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #1d1d1f;
}
.ann-modal__close {
  background: none;
  border: none;
  font-size: 1rem;
  color: #86868b;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
}
.ann-modal__close:hover { color: #1d1d1f; }
.ann-modal__close:focus-visible {
  outline: 2px solid #0071e3;
  outline-offset: 2px;
}

.ann-modal__body {
  padding: 1.15rem 1.35rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── fields ── */
.ann-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.ann-field__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6e6e73;
  letter-spacing: -0.01em;
}
.ann-field__input,
.ann-field__textarea,
.ann-field__select {
  font-family: inherit;
  font-size: 0.875rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid #d2d2d7;
  border-radius: 10px;
  background: #fafafa;
  color: #1d1d1f;
  transition: border-color 0.15s ease;
}
.ann-field__input:focus,
.ann-field__textarea:focus,
.ann-field__select:focus {
  outline: none;
  border-color: #0071e3;
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.12);
}
.ann-field__textarea { resize: vertical; min-height: 5.5rem; }
.ann-field__select { cursor: pointer; }
.ann-field__hint {
  font-size: 0.68rem;
  color: #86868b;
  margin-top: 0.1rem;
}

/* ── error ── */
.ann-modal__error {
  margin: 0;
  font-size: 0.78rem;
  color: #b42318;
  font-weight: 500;
}

.ann-modal__body .bf-actions {
  padding-top: 0.25rem;
}

/* ── transitions ── */
.ann-modal-enter-active,
.ann-modal-leave-active { transition: opacity 0.2s ease; }
.ann-modal-enter-from,
.ann-modal-leave-to { opacity: 0; }
</style>
