<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fakeBackendApi } from '@/marketing/infrastructure/api/fakeBackendApi.js'

const { t } = useI18n()

const residents = ref([])
const accessLinks = reactive({})
const isLoading = ref(false)
const loadError = ref('')

const isAddResidentModalOpen = ref(false)
const modalError = ref('')
const isSubmitting = ref(false)
const searchQuery = ref('')
const residentForm = reactive({
  name: '',
  floor: '',
  code: '',
})

const totalResidents = computed(() => residents.value.length)
const filteredResidents = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return residents.value

  return residents.value.filter((resident) =>
    [resident.name, resident.floor, resident.code].some((value) =>
      String(value ?? '').toLowerCase().includes(query),
    ),
  )
})

async function loadResidents() {
  isLoading.value = true
  loadError.value = ''
  try {
    residents.value = await fakeBackendApi.residents.list()
  } catch {
    loadError.value = t('app.residentsLoadError')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadResidents)

function openAddResidentModal() {
  modalError.value = ''
  residentForm.name = ''
  residentForm.floor = ''
  residentForm.code = ''
  isAddResidentModalOpen.value = true
}

function closeAddResidentModal() {
  if (isSubmitting.value) return
  isAddResidentModalOpen.value = false
}

async function onAddResidentSubmit() {
  if (isSubmitting.value) return

  const name = residentForm.name.trim()
  const floor = residentForm.floor.trim()
  const code = residentForm.code.trim()

  if (!name || !floor || !code) {
    modalError.value = t('app.addResidentRequired')
    return
  }

  isSubmitting.value = true
  modalError.value = ''
  try {
    const newResident = await fakeBackendApi.residents.add({ name, floor, code })
    residents.value = [newResident, ...residents.value]
    isAddResidentModalOpen.value = false
  } catch (error) {
    if (error?.code === 'RESIDENT_CODE_ALREADY_EXISTS') {
      modalError.value = t('app.addResidentCodeExists')
      return
    }
    if (error?.code === 'RESIDENT_FIELDS_REQUIRED') {
      modalError.value = t('app.addResidentRequired')
      return
    }
    modalError.value = t('auth.genericError')
  } finally {
    isSubmitting.value = false
  }
}

function generateResidentAccessLink(resident) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams({
    invite: '1',
    code: resident.code,
  })
  accessLinks[resident.id] = `${baseUrl}/login?${params.toString()}`
}
</script>

<template>
  <div class="app-view">
    <section class="residents-layout">
      <article class="residents-panel residents-panel--left">
        <h2 class="residents-panel__title">{{ t('app.addResidentsSummaryTitle') }}</h2>
        <div class="residents-metric">
          <span class="residents-metric__label">{{ t('app.residentsCountLabel') }}</span>
          <strong class="residents-metric__value">{{ totalResidents }}</strong>
        </div>
        <label class="residents-search">
          <i class="pi pi-search residents-search__icon" aria-hidden="true" />
          <input
            v-model="searchQuery"
            type="text"
            class="residents-search__input"
            :placeholder="t('app.searchResidentsPlaceholder')"
            :aria-label="t('app.searchResidentsPlaceholder')"
          />
        </label>
        <p v-if="isLoading" class="residents-empty">
          {{ t('app.residentsLoading') }}
        </p>
        <p v-else-if="loadError" class="residents-empty residents-empty--error">
          {{ loadError }}
        </p>
        <p v-else-if="!residents.length" class="residents-empty">
          {{ t('app.emptyResidents') }}
        </p>
        <p v-else-if="!filteredResidents.length" class="residents-empty">
          {{ t('app.emptyResidentsSearch') }}
        </p>
        <ul v-else class="residents-list" role="list">
          <li v-for="resident in filteredResidents" :key="resident.id" class="residents-list__item">
            <p class="residents-list__name">
              {{ resident.name }}
              <span
                v-if="resident.hasCredentials"
                class="residents-list__badge"
                :title="t('app.residentHasCredentials')"
              >
                <i class="pi pi-check-circle" aria-hidden="true" />
                {{ t('app.residentHasCredentials') }}
              </span>
            </p>
            <div class="residents-list__meta">
              <span>{{ t('app.residentFloorLabel') }}: {{ resident.floor }}</span>
              <span>{{ t('app.residentCodeLabel') }}: {{ resident.code }}</span>
              <span v-if="resident.email">{{ t('auth.email') }}: {{ resident.email }}</span>
            </div>
            <div class="residents-list__actions">
              <button
                type="button"
                class="residents-list__share-btn"
                @click="generateResidentAccessLink(resident)"
              >
                <i class="pi pi-share-alt" aria-hidden="true" />
                <span>{{ t('app.shareResidentAction') }}</span>
              </button>
              <a
                v-if="accessLinks[resident.id]"
                class="residents-list__link"
                :href="accessLinks[resident.id]"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ accessLinks[resident.id] }}
              </a>
            </div>
          </li>
        </ul>
      </article>

      <article class="residents-panel residents-panel--right">
        <div class="residents-panel__top">
          <h2 class="residents-panel__title">{{ t('app.residentsColumnTitle') }}</h2>
          <button type="button" class="residents-panel__add-btn" @click="openAddResidentModal">
            <i class="pi pi-plus" aria-hidden="true" />
            <span>{{ t('app.addResidentAction') }}</span>
          </button>
        </div>
      </article>
    </section>

    <div
      v-if="isAddResidentModalOpen"
      class="resident-modal-backdrop"
      role="presentation"
      @click.self="closeAddResidentModal"
    >
      <section class="resident-modal" role="dialog" aria-modal="true" :aria-label="t('app.addResidentModalTitle')">
        <h3 class="resident-modal__title">{{ t('app.addResidentModalTitle') }}</h3>

        <form class="resident-modal__form" @submit.prevent="onAddResidentSubmit">
          <label class="resident-modal__field">
            <span>{{ t('app.residentNameLabel') }}</span>
            <input v-model="residentForm.name" type="text" autocomplete="name" />
          </label>

          <label class="resident-modal__field">
            <span>{{ t('app.residentFloorLabel') }}</span>
            <input v-model="residentForm.floor" type="text" />
          </label>

          <label class="resident-modal__field">
            <span>{{ t('app.residentCodeLabel') }}</span>
            <input v-model="residentForm.code" type="text" />
          </label>

          <p v-if="modalError" class="resident-modal__error">{{ modalError }}</p>

          <div class="resident-modal__actions">
            <button
              type="button"
              class="resident-modal__btn resident-modal__btn--secondary"
              :disabled="isSubmitting"
              @click="closeAddResidentModal"
            >
              {{ t('app.cancelAction') }}
            </button>
            <button
              type="submit"
              class="resident-modal__btn resident-modal__btn--primary"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? t('app.savingResidentAction') : t('app.saveResidentAction') }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app-view {
  padding: 1.75rem 1.5rem;
  max-width: 72rem;
}

.residents-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.residents-panel {
  border: 1px solid #e8e8ed;
  border-radius: 14px;
  padding: 1rem;
  background: #ffffff;
}

.residents-panel__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.residents-panel__text {
  margin: 0.5rem 0 0;
  color: var(--apple-text-secondary, #6e6e73);
}

.residents-metric {
  margin-top: 0.95rem;
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.45rem 0.7rem;
  border-radius: 999px;
  background: #f5f5f7;
}

.residents-metric__label {
  color: var(--apple-text-secondary, #6e6e73);
  font-size: 0.875rem;
}

.residents-metric__value {
  font-size: 0.95rem;
}

.residents-panel__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.residents-panel__add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: none;
  border-radius: 999px;
  background: var(--apple-blue, #0a84ff);
  color: #fff;
  padding: 0.5rem 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.residents-search {
  margin-top: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid #d2d2d7;
  border-radius: 10px;
  padding: 0.5rem 0.65rem;
  background: #ffffff;
}

.residents-search__icon {
  color: #6e6e73;
  font-size: 0.9rem;
}

.residents-search__input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  color: #1d1d1f;
}

.residents-search__input::placeholder {
  color: #86868b;
}

.residents-empty {
  margin: 1rem 0 0;
  color: var(--apple-text-secondary, #6e6e73);
}

.residents-empty--error {
  color: #b42318;
}

.residents-list__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: 0.4rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: #e6f4ea;
  color: #166534;
  font-size: 0.7rem;
  font-weight: 600;
  vertical-align: middle;
}

.residents-list {
  margin: 0.9rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.residents-list__item {
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 0.75rem 0.85rem;
  background: #fafafd;
}

.residents-list__name {
  margin: 0;
  font-weight: 600;
  color: #1d1d1f;
}

.residents-list__meta {
  margin-top: 0.35rem;
  display: flex;
  gap: 0.85rem;
  flex-wrap: wrap;
  color: #6e6e73;
  font-size: 0.875rem;
}

.residents-list__actions {
  margin-top: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.residents-list__share-btn {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: none;
  border-radius: 999px;
  background: #eaf3ff;
  color: #0a84ff;
  padding: 0.38rem 0.68rem;
  font-weight: 600;
  cursor: pointer;
}

.residents-list__link {
  font-size: 0.825rem;
  color: #0a84ff;
  text-decoration: underline;
  overflow-wrap: anywhere;
}

.resident-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.resident-modal {
  width: min(100%, 27rem);
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #ececf1;
  padding: 1rem;
}

.resident-modal__title {
  margin: 0;
  font-size: 1.1rem;
}

.resident-modal__form {
  margin-top: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.resident-modal__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.9rem;
}

.resident-modal__field input {
  border: 1px solid #d2d2d7;
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
  font: inherit;
}

.resident-modal__error {
  margin: 0;
  color: #b42318;
  font-size: 0.825rem;
}

.resident-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.resident-modal__btn {
  border: none;
  border-radius: 8px;
  padding: 0.5rem 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.resident-modal__btn--secondary {
  background: #f0f0f4;
  color: #1d1d1f;
}

.resident-modal__btn--primary {
  background: var(--apple-blue, #0a84ff);
  color: #ffffff;
}

@media (max-width: 860px) {
  .residents-layout {
    grid-template-columns: 1fr;
  }
}
</style>
