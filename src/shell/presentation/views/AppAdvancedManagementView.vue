<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { residentsApi } from '@/residents/infrastructure/residentsApi.js'
import { spacesApi } from '@/socialSpaces/infrastructure/spacesApi.js'
import { reservationsApi } from '@/socialSpaces/infrastructure/reservationsApi.js'

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
    residents.value = await residentsApi.list()
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
    const newResident = await residentsApi.add({ name, floor, code })
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

const isBulkResidentsModalOpen = ref(false)
const bulkResidentsText = ref('')
const isSubmittingBulk = ref(false)
const bulkResults = ref([])

function openBulkResidentsModal() {
  bulkResidentsText.value = ''
  bulkResults.value = []
  isAddResidentModalOpen.value = false
  isBulkResidentsModalOpen.value = true
}

function closeBulkResidentsModal() {
  if (isSubmittingBulk.value) return
  isBulkResidentsModalOpen.value = false
}

function parseBulkLine(line) {
  const parts = line.split('-').map((part) => part.trim())
  if (parts.length !== 3) return null
  const [name, floor, code] = parts
  if (!name || !floor || !code) return null
  return { name, floor, code }
}

async function onBulkResidentsSubmit() {
  if (isSubmittingBulk.value) return

  const lines = bulkResidentsText.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (!lines.length) {
    bulkResults.value = [
      { line: 0, raw: '', status: 'error', message: t('app.bulkEmpty') },
    ]
    return
  }

  isSubmittingBulk.value = true
  const results = []
  const created = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const parsed = parseBulkLine(raw)
    if (!parsed) {
      results.push({
        line: i + 1,
        raw,
        status: 'error',
        message: t('app.bulkLineFormatError'),
      })
      continue
    }

    try {
      const newResident = await residentsApi.add(parsed)
      created.push(newResident)
      results.push({
        line: i + 1,
        raw,
        status: 'ok',
        message: t('app.bulkLineCreated', { name: newResident.name }),
      })
    } catch (error) {
      let message = t('auth.genericError')
      if (error?.code === 'RESIDENT_CODE_ALREADY_EXISTS') {
        message = t('app.addResidentCodeExists')
      } else if (error?.code === 'RESIDENT_FIELDS_REQUIRED') {
        message = t('app.addResidentRequired')
      }
      results.push({ line: i + 1, raw, status: 'error', message })
    }
  }

  if (created.length) {
    residents.value = [...created, ...residents.value]
    const failedLines = results
      .filter((r) => r.status === 'error')
      .map((r) => r.raw)
    bulkResidentsText.value = failedLines.join('\n')
  }

  bulkResults.value = results
  isSubmittingBulk.value = false
}

const spaces = ref([])
const isLoadingSpaces = ref(false)
const spacesLoadError = ref('')

const isAddSpaceModalOpen = ref(false)
const spaceForm = reactive({ name: '', description: '', capacity: '' })
const spaceModalError = ref('')
const isSubmittingSpace = ref(false)

const isSpaceCalendarModalOpen = ref(false)
const selectedSpace = ref(null)
const spaceReservations = ref([])
const isLoadingReservations = ref(false)
const reservationsLoadError = ref('')

async function loadSpaces() {
  isLoadingSpaces.value = true
  spacesLoadError.value = ''
  try {
    spaces.value = await spacesApi.list()
  } catch {
    spacesLoadError.value = t('app.spacesLoadError')
  } finally {
    isLoadingSpaces.value = false
  }
}

onMounted(loadSpaces)

function openAddSpaceModal() {
  spaceModalError.value = ''
  spaceForm.name = ''
  spaceForm.description = ''
  spaceForm.capacity = ''
  isAddSpaceModalOpen.value = true
}

function closeAddSpaceModal() {
  if (isSubmittingSpace.value) return
  isAddSpaceModalOpen.value = false
}

async function onAddSpaceSubmit() {
  if (isSubmittingSpace.value) return

  const name = spaceForm.name.trim()
  if (!name) {
    spaceModalError.value = t('app.spaceNameRequired')
    return
  }

  isSubmittingSpace.value = true
  spaceModalError.value = ''
  try {
    const newSpace = await spacesApi.add({
      name,
      description: spaceForm.description,
      capacity: spaceForm.capacity,
    })
    spaces.value = [newSpace, ...spaces.value]
    isAddSpaceModalOpen.value = false
  } catch (error) {
    if (error?.code === 'SPACE_NAME_REQUIRED') {
      spaceModalError.value = t('app.spaceNameRequired')
      return
    }
    spaceModalError.value = t('auth.genericError')
  } finally {
    isSubmittingSpace.value = false
  }
}

async function openSpaceCalendar(space) {
  selectedSpace.value = space
  isSpaceCalendarModalOpen.value = true
  isLoadingReservations.value = true
  reservationsLoadError.value = ''
  try {
    spaceReservations.value = await reservationsApi.listBySpace(space.id)
  } catch {
    reservationsLoadError.value = t('app.reservationsLoadError')
    spaceReservations.value = []
  } finally {
    isLoadingReservations.value = false
  }
}

function closeSpaceCalendar() {
  isSpaceCalendarModalOpen.value = false
  selectedSpace.value = null
  spaceReservations.value = []
}

const groupedReservations = computed(() => {
  const map = new Map()
  for (const reservation of spaceReservations.value) {
    if (!map.has(reservation.date)) {
      map.set(reservation.date, [])
    }
    map.get(reservation.date).push(reservation)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: items
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
})
</script>

<template>
  <div class="app-view">
    <section class="residents-layout">
      <article class="residents-panel residents-panel--right">
        <div class="residents-panel__top">
          <h2 class="residents-panel__title">{{ t('app.residentsColumnTitle') }}</h2>
          <button type="button" class="residents-panel__add-btn" @click="openAddResidentModal">
            <i class="pi pi-plus" aria-hidden="true" />
            <span>{{ t('app.addResidentAction') }}</span>
          </button>
        </div>

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
          <h2 class="residents-panel__title">{{ t('app.spacesColumnTitle') }}</h2>
          <button type="button" class="residents-panel__add-btn" @click="openAddSpaceModal">
            <i class="pi pi-plus" aria-hidden="true" />
            <span>{{ t('app.addSpaceAction') }}</span>
          </button>
        </div>

        <p v-if="isLoadingSpaces" class="residents-empty">
          {{ t('app.spacesLoading') }}
        </p>
        <p v-else-if="spacesLoadError" class="residents-empty residents-empty--error">
          {{ spacesLoadError }}
        </p>
        <p v-else-if="!spaces.length" class="residents-empty">
          {{ t('app.emptySpaces') }}
        </p>
        <ul v-else class="residents-list" role="list">
          <li
            v-for="space in spaces"
            :key="space.id"
            class="residents-list__item residents-list__item--clickable"
            tabindex="0"
            role="button"
            @click="openSpaceCalendar(space)"
            @keyup.enter="openSpaceCalendar(space)"
            @keyup.space.prevent="openSpaceCalendar(space)"
          >
            <p class="residents-list__name">{{ space.name }}</p>
            <div v-if="space.description" class="residents-list__meta">
              <span>{{ space.description }}</span>
            </div>
            <div v-if="space.capacity" class="residents-list__meta">
              <span>{{ t('app.spaceCapacityLabel') }}: {{ space.capacity }}</span>
            </div>
          </li>
        </ul>
      </article>
    </section>

    <div
      v-if="isAddResidentModalOpen"
      class="resident-modal-backdrop"
      role="presentation"
      @click.self="closeAddResidentModal"
    >
      <section class="resident-modal" role="dialog" aria-modal="true" :aria-label="t('app.addResidentModalTitle')">
        <div class="resident-modal__header">
          <h3 class="resident-modal__title">{{ t('app.addResidentModalTitle') }}</h3>
          <button
            type="button"
            class="resident-modal__bulk-btn"
            :disabled="isSubmitting"
            @click="openBulkResidentsModal"
          >
            <i class="pi pi-list" aria-hidden="true" />
            {{ t('app.addBulkResidentsAction') }}
          </button>
        </div>

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

    <div
      v-if="isBulkResidentsModalOpen"
      class="resident-modal-backdrop"
      role="presentation"
      @click.self="closeBulkResidentsModal"
    >
      <section
        class="resident-modal resident-modal--wide"
        role="dialog"
        aria-modal="true"
        :aria-label="t('app.bulkResidentsModalTitle')"
      >
        <h3 class="resident-modal__title">{{ t('app.bulkResidentsModalTitle') }}</h3>
        <p class="resident-modal__hint">{{ t('app.bulkResidentsHint') }}</p>
        <p class="resident-modal__example">{{ t('app.bulkResidentsExample') }}</p>

        <form class="resident-modal__form" @submit.prevent="onBulkResidentsSubmit">
          <label class="resident-modal__field">
            <span>{{ t('app.bulkResidentsTextareaLabel') }}</span>
            <textarea
              v-model="bulkResidentsText"
              class="resident-modal__textarea"
              rows="8"
              :placeholder="t('app.bulkResidentsPlaceholder')"
            />
          </label>

          <ul v-if="bulkResults.length" class="bulk-results" role="list">
            <li
              v-for="result in bulkResults"
              :key="result.line"
              class="bulk-results__item"
              :class="{
                'bulk-results__item--ok': result.status === 'ok',
                'bulk-results__item--error': result.status === 'error',
              }"
            >
              <span class="bulk-results__line">#{{ result.line }}</span>
              <span class="bulk-results__msg">{{ result.message }}</span>
            </li>
          </ul>

          <div class="resident-modal__actions">
            <button
              type="button"
              class="resident-modal__btn resident-modal__btn--secondary"
              :disabled="isSubmittingBulk"
              @click="closeBulkResidentsModal"
            >
              {{ t('app.closeAction') }}
            </button>
            <button
              type="submit"
              class="resident-modal__btn resident-modal__btn--primary"
              :disabled="isSubmittingBulk"
            >
              {{
                isSubmittingBulk
                  ? t('app.bulkResidentsSubmitting')
                  : t('app.bulkResidentsSubmit')
              }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="isAddSpaceModalOpen"
      class="resident-modal-backdrop"
      role="presentation"
      @click.self="closeAddSpaceModal"
    >
      <section class="resident-modal" role="dialog" aria-modal="true" :aria-label="t('app.addSpaceModalTitle')">
        <h3 class="resident-modal__title">{{ t('app.addSpaceModalTitle') }}</h3>

        <form class="resident-modal__form" @submit.prevent="onAddSpaceSubmit">
          <label class="resident-modal__field">
            <span>{{ t('app.spaceNameLabel') }}</span>
            <input v-model="spaceForm.name" type="text" />
          </label>

          <label class="resident-modal__field">
            <span>{{ t('app.spaceDescriptionLabel') }}</span>
            <input v-model="spaceForm.description" type="text" />
          </label>

          <label class="resident-modal__field">
            <span>{{ t('app.spaceCapacityLabel') }}</span>
            <input v-model="spaceForm.capacity" type="number" min="1" />
          </label>

          <p v-if="spaceModalError" class="resident-modal__error">{{ spaceModalError }}</p>

          <div class="resident-modal__actions">
            <button
              type="button"
              class="resident-modal__btn resident-modal__btn--secondary"
              :disabled="isSubmittingSpace"
              @click="closeAddSpaceModal"
            >
              {{ t('app.cancelAction') }}
            </button>
            <button
              type="submit"
              class="resident-modal__btn resident-modal__btn--primary"
              :disabled="isSubmittingSpace"
            >
              {{ isSubmittingSpace ? t('app.savingSpaceAction') : t('app.saveSpaceAction') }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="isSpaceCalendarModalOpen"
      class="resident-modal-backdrop"
      role="presentation"
      @click.self="closeSpaceCalendar"
    >
      <section
        class="resident-modal resident-modal--wide"
        role="dialog"
        aria-modal="true"
        :aria-label="t('app.spaceCalendarTitle')"
      >
        <h3 class="resident-modal__title">
          {{ t('app.spaceCalendarTitle') }}
          <span v-if="selectedSpace" class="resident-modal__title-suffix">— {{ selectedSpace.name }}</span>
        </h3>

        <p v-if="isLoadingReservations" class="residents-empty">
          {{ t('app.reservationsLoading') }}
        </p>
        <p v-else-if="reservationsLoadError" class="residents-empty residents-empty--error">
          {{ reservationsLoadError }}
        </p>
        <p v-else-if="!groupedReservations.length" class="residents-empty">
          {{ t('app.emptyReservations') }}
        </p>
        <ul v-else class="reservations-list" role="list">
          <li v-for="group in groupedReservations" :key="group.date" class="reservations-list__day">
            <h4 class="reservations-list__date">{{ group.date }}</h4>
            <ul class="reservations-list__slots" role="list">
              <li v-for="r in group.items" :key="r.id" class="reservations-list__slot">
                <span class="reservations-list__time">{{ r.startTime }} – {{ r.endTime }}</span>
                <span class="reservations-list__resident">
                  {{ r.residentName }}<span v-if="r.residentCode"> · {{ r.residentCode }}</span>
                </span>
              </li>
            </ul>
          </li>
        </ul>

        <div class="resident-modal__actions">
          <button
            type="button"
            class="resident-modal__btn resident-modal__btn--primary"
            @click="closeSpaceCalendar"
          >
            {{ t('app.closeAction') }}
          </button>
        </div>
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

@media (max-width: 860px) {
  .residents-layout {
    grid-template-columns: minmax(0, 1fr);
  }
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

.residents-list__item--clickable {
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.residents-list__item--clickable:hover,
.residents-list__item--clickable:focus-visible {
  border-color: #c7d2fe;
  background: #f0f4ff;
  outline: none;
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
  max-height: 90vh;
  overflow-y: auto;
}

.resident-modal--wide {
  width: min(100%, 38rem);
}

.resident-modal__title {
  margin: 0;
  font-size: 1.1rem;
}

.resident-modal__title-suffix {
  font-weight: 500;
  color: #6e6e73;
  margin-left: 0.25rem;
}

.resident-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.resident-modal__bulk-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #c7d2fe;
  background: #eaf3ff;
  color: #0a84ff;
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
}

.resident-modal__bulk-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resident-modal__hint {
  margin: 0.55rem 0 0;
  color: #1d1d1f;
  font-size: 0.875rem;
}

.resident-modal__example {
  margin: 0.2rem 0 0;
  color: #6e6e73;
  font-size: 0.825rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.resident-modal__textarea {
  width: 100%;
  border: 1px solid #d2d2d7;
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875rem;
  resize: vertical;
  box-sizing: border-box;
}

.bulk-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 14rem;
  overflow-y: auto;
}

.bulk-results__item {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  border-radius: 8px;
  padding: 0.4rem 0.55rem;
  font-size: 0.85rem;
}

.bulk-results__item--ok {
  background: #e6f4ea;
  color: #166534;
}

.bulk-results__item--error {
  background: #fdecee;
  color: #b42318;
}

.bulk-results__line {
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.bulk-results__msg {
  flex: 1;
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

.reservations-list {
  list-style: none;
  margin: 0.9rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.reservations-list__day {
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
  background: #fafafd;
}

.reservations-list__date {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
  color: #1d1d1f;
}

.reservations-list__slots {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.reservations-list__slot {
  display: flex;
  justify-content: space-between;
  gap: 0.85rem;
  font-size: 0.875rem;
  color: #1d1d1f;
}

.reservations-list__time {
  font-weight: 600;
}

.reservations-list__resident {
  color: #6e6e73;
}

</style>
