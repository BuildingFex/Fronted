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

const residentDeleteError = ref('')

const isDeleteResidentModalOpen = ref(false)
const deleteResidentCandidate = ref(null)
const deleteResidentPreview = ref(null)
const isLoadingDeletePreview = ref(false)
const isDeletingResidentCascade = ref(false)
const deleteResidentSummary = ref(null)
const deleteResidentHasErrors = ref(false)

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

async function openDeleteResidentModal(resident) {
  if (isDeletingResidentCascade.value) return
  deleteResidentCandidate.value = resident
  deleteResidentPreview.value = null
  deleteResidentSummary.value = null
  deleteResidentHasErrors.value = false
  residentDeleteError.value = ''
  isDeleteResidentModalOpen.value = true
  isLoadingDeletePreview.value = true
  try {
    const preview = await residentsApi.previewLinkedData(resident.id)
    deleteResidentPreview.value = preview.summary
  } catch {
    deleteResidentPreview.value = { reservations: 0 }
  } finally {
    isLoadingDeletePreview.value = false
  }
}

function closeDeleteResidentModal() {
  if (isDeletingResidentCascade.value) return
  isDeleteResidentModalOpen.value = false
  deleteResidentCandidate.value = null
  deleteResidentPreview.value = null
  deleteResidentSummary.value = null
  deleteResidentHasErrors.value = false
}

async function confirmDeleteResidentCascade() {
  if (!deleteResidentCandidate.value || isDeletingResidentCascade.value) return
  const resident = deleteResidentCandidate.value
  isDeletingResidentCascade.value = true
  residentDeleteError.value = ''
  try {
    const result = await residentsApi.removeCascade(resident.id)
    deleteResidentSummary.value = result.summary
    deleteResidentHasErrors.value = (result.errors?.length ?? 0) > 0
    residents.value = residents.value.filter((item) => item.id !== resident.id)
    delete accessLinks[resident.id]
    if (result.errors?.length) {
      console.warn('Cascade delete partial errors:', result.errors)
    }
  } catch (error) {
    console.error('Cascade delete failed:', error)
    residentDeleteError.value = t('app.deleteResidentError')
  } finally {
    isDeletingResidentCascade.value = false
  }
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
const spaceForm = reactive({ name: '', description: '', capacity: '', imageUrl: '' })
const spaceModalError = ref('')
const isSubmittingSpace = ref(false)
const isProcessingAddImage = ref(false)

const isEditSpaceModalOpen = ref(false)
const editSpaceForm = reactive({
  id: '',
  name: '',
  description: '',
  capacity: '',
  imageUrl: '',
})
const editSpaceModalError = ref('')
const isSubmittingEditSpace = ref(false)
const isProcessingEditImage = ref(false)

const deletingSpaceIds = reactive({})
const spaceDeleteError = ref('')

const isSpaceCalendarModalOpen = ref(false)
const selectedSpace = ref(null)
const spaceReservations = ref([])
const isLoadingReservations = ref(false)
const reservationsLoadError = ref('')

const MAX_IMAGE_DIMENSION = 1024
const IMAGE_OUTPUT_QUALITY = 0.82

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_ERROR'))
    reader.readAsDataURL(file)
  })
}

async function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('IMAGE_DECODE_ERROR'))
    img.src = dataUrl
  })
}

async function processImageFile(file) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
    throw new Error('IMAGE_INVALID')
  }
  const originalDataUrl = await readFileAsDataUrl(file)
  const img = await loadImageElement(originalDataUrl)

  const ratio = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(img.naturalWidth || 1, img.naturalHeight || 1),
  )
  const width = Math.max(1, Math.round((img.naturalWidth || 1) * ratio))
  const height = Math.max(1, Math.round((img.naturalHeight || 1) * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('IMAGE_CANVAS_ERROR')
  context.drawImage(img, 0, 0, width, height)
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  return canvas.toDataURL(mime, IMAGE_OUTPUT_QUALITY)
}

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
  spaceForm.imageUrl = ''
  isAddSpaceModalOpen.value = true
}

function closeAddSpaceModal() {
  if (isSubmittingSpace.value) return
  isAddSpaceModalOpen.value = false
}

async function onAddSpaceImageSelected(event) {
  const file = event.target?.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type?.startsWith('image/')) {
    spaceModalError.value = t('app.spaceImageInvalid')
    return
  }
  isProcessingAddImage.value = true
  spaceModalError.value = ''
  try {
    spaceForm.imageUrl = await processImageFile(file)
  } catch {
    spaceModalError.value = t('app.spaceImageError')
  } finally {
    isProcessingAddImage.value = false
  }
}

function clearAddSpaceImage() {
  spaceForm.imageUrl = ''
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
      imageUrl: spaceForm.imageUrl,
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

function openEditSpaceModal(space) {
  editSpaceModalError.value = ''
  editSpaceForm.id = space.id
  editSpaceForm.name = space.name ?? ''
  editSpaceForm.description = space.description ?? ''
  editSpaceForm.capacity = space.capacity ?? ''
  editSpaceForm.imageUrl = space.imageUrl ?? ''
  isEditSpaceModalOpen.value = true
}

function closeEditSpaceModal() {
  if (isSubmittingEditSpace.value) return
  isEditSpaceModalOpen.value = false
}

async function onEditSpaceImageSelected(event) {
  const file = event.target?.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type?.startsWith('image/')) {
    editSpaceModalError.value = t('app.spaceImageInvalid')
    return
  }
  isProcessingEditImage.value = true
  editSpaceModalError.value = ''
  try {
    editSpaceForm.imageUrl = await processImageFile(file)
  } catch {
    editSpaceModalError.value = t('app.spaceImageError')
  } finally {
    isProcessingEditImage.value = false
  }
}

function clearEditSpaceImage() {
  editSpaceForm.imageUrl = ''
}

async function onEditSpaceSubmit() {
  if (isSubmittingEditSpace.value) return

  const name = editSpaceForm.name.trim()
  if (!name) {
    editSpaceModalError.value = t('app.spaceNameRequired')
    return
  }

  isSubmittingEditSpace.value = true
  editSpaceModalError.value = ''
  try {
    const updated = await spacesApi.update({
      id: editSpaceForm.id,
      name,
      description: editSpaceForm.description,
      capacity: editSpaceForm.capacity,
      imageUrl: editSpaceForm.imageUrl,
    })
    spaces.value = spaces.value.map((space) =>
      space.id === updated.id ? updated : space,
    )
    isEditSpaceModalOpen.value = false
  } catch (error) {
    if (error?.code === 'SPACE_NAME_REQUIRED') {
      editSpaceModalError.value = t('app.spaceNameRequired')
      return
    }
    editSpaceModalError.value = t('auth.genericError')
  } finally {
    isSubmittingEditSpace.value = false
  }
}

async function deleteSpace(space) {
  if (deletingSpaceIds[space.id]) return
  const confirmed =
    typeof window === 'undefined'
      ? true
      : window.confirm(t('app.deleteSpaceConfirm', { name: space.name }))
  if (!confirmed) return

  spaceDeleteError.value = ''
  deletingSpaceIds[space.id] = true
  try {
    await reservationsApi.removeBySpace(space.id)
    await spacesApi.remove(space.id)
    spaces.value = spaces.value.filter((item) => item.id !== space.id)
  } catch {
    spaceDeleteError.value = t('app.deleteSpaceError')
  } finally {
    delete deletingSpaceIds[space.id]
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

        <p v-if="residentDeleteError" class="residents-empty residents-empty--error">
          {{ residentDeleteError }}
        </p>

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
              <button
                type="button"
                class="residents-list__delete-btn"
                :disabled="isDeletingResidentCascade && deleteResidentCandidate?.id === resident.id"
                @click="openDeleteResidentModal(resident)"
              >
                <i class="pi pi-trash" aria-hidden="true" />
                <span>{{ t('app.deleteResidentAction') }}</span>
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

        <p v-if="spaceDeleteError" class="residents-empty residents-empty--error">
          {{ spaceDeleteError }}
        </p>

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
            class="residents-list__item residents-list__item--clickable space-card"
            tabindex="0"
            role="button"
            @click="openSpaceCalendar(space)"
            @keyup.enter="openSpaceCalendar(space)"
            @keyup.space.prevent="openSpaceCalendar(space)"
          >
            <div v-if="space.imageUrl" class="space-card__image-wrapper">
              <img
                :src="space.imageUrl"
                :alt="t('app.spaceImageAlt', { name: space.name })"
                class="space-card__image"
              />
            </div>
            <div v-else class="space-card__image-placeholder" aria-hidden="true">
              <i class="pi pi-image" />
            </div>

            <p class="residents-list__name">{{ space.name }}</p>
            <div v-if="space.description" class="residents-list__meta">
              <span>{{ space.description }}</span>
            </div>
            <div v-if="space.capacity" class="residents-list__meta">
              <span>{{ t('app.spaceCapacityLabel') }}: {{ space.capacity }}</span>
            </div>

            <div class="space-card__actions" @click.stop @keyup.stop @keydown.stop>
              <button
                type="button"
                class="space-card__edit-btn"
                @click.stop="openEditSpaceModal(space)"
              >
                <i class="pi pi-pencil" aria-hidden="true" />
                <span>{{ t('app.editSpaceAction') }}</span>
              </button>
              <button
                type="button"
                class="space-card__delete-btn"
                :disabled="!!deletingSpaceIds[space.id]"
                @click.stop="deleteSpace(space)"
              >
                <i class="pi pi-trash" aria-hidden="true" />
                <span>{{ t('app.deleteSpaceAction') }}</span>
              </button>
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

          <div class="resident-modal__field space-image-field">
            <span>{{ t('app.spaceImageLabel') }}</span>
            <p class="space-image-field__hint">{{ t('app.spaceImageHint') }}</p>
            <div v-if="spaceForm.imageUrl" class="space-image-field__preview">
              <img :src="spaceForm.imageUrl" alt="" />
            </div>
            <div class="space-image-field__controls">
              <label class="space-image-field__btn">
                <input
                  type="file"
                  accept="image/*"
                  class="space-image-field__input"
                  :disabled="isProcessingAddImage || isSubmittingSpace"
                  @change="onAddSpaceImageSelected"
                />
                <i class="pi pi-upload" aria-hidden="true" />
                <span>
                  {{
                    isProcessingAddImage
                      ? t('app.spaceImageProcessing')
                      : spaceForm.imageUrl
                        ? t('app.spaceImageChange')
                        : t('app.spaceImageLabel')
                  }}
                </span>
              </label>
              <button
                v-if="spaceForm.imageUrl"
                type="button"
                class="space-image-field__remove"
                :disabled="isProcessingAddImage || isSubmittingSpace"
                @click="clearAddSpaceImage"
              >
                {{ t('app.spaceImageRemove') }}
              </button>
            </div>
          </div>

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
              :disabled="isSubmittingSpace || isProcessingAddImage"
            >
              {{ isSubmittingSpace ? t('app.savingSpaceAction') : t('app.saveSpaceAction') }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="isEditSpaceModalOpen"
      class="resident-modal-backdrop"
      role="presentation"
      @click.self="closeEditSpaceModal"
    >
      <section
        class="resident-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('app.editSpaceModalTitle')"
      >
        <h3 class="resident-modal__title">{{ t('app.editSpaceModalTitle') }}</h3>

        <form class="resident-modal__form" @submit.prevent="onEditSpaceSubmit">
          <label class="resident-modal__field">
            <span>{{ t('app.spaceNameLabel') }}</span>
            <input v-model="editSpaceForm.name" type="text" />
          </label>

          <label class="resident-modal__field">
            <span>{{ t('app.spaceDescriptionLabel') }}</span>
            <input v-model="editSpaceForm.description" type="text" />
          </label>

          <label class="resident-modal__field">
            <span>{{ t('app.spaceCapacityLabel') }}</span>
            <input v-model="editSpaceForm.capacity" type="number" min="1" />
          </label>

          <div class="resident-modal__field space-image-field">
            <span>{{ t('app.spaceImageLabel') }}</span>
            <p class="space-image-field__hint">{{ t('app.spaceImageHint') }}</p>
            <div v-if="editSpaceForm.imageUrl" class="space-image-field__preview">
              <img :src="editSpaceForm.imageUrl" alt="" />
            </div>
            <div class="space-image-field__controls">
              <label class="space-image-field__btn">
                <input
                  type="file"
                  accept="image/*"
                  class="space-image-field__input"
                  :disabled="isProcessingEditImage || isSubmittingEditSpace"
                  @change="onEditSpaceImageSelected"
                />
                <i class="pi pi-upload" aria-hidden="true" />
                <span>
                  {{
                    isProcessingEditImage
                      ? t('app.spaceImageProcessing')
                      : editSpaceForm.imageUrl
                        ? t('app.spaceImageChange')
                        : t('app.spaceImageLabel')
                  }}
                </span>
              </label>
              <button
                v-if="editSpaceForm.imageUrl"
                type="button"
                class="space-image-field__remove"
                :disabled="isProcessingEditImage || isSubmittingEditSpace"
                @click="clearEditSpaceImage"
              >
                {{ t('app.spaceImageRemove') }}
              </button>
            </div>
          </div>

          <p v-if="editSpaceModalError" class="resident-modal__error">{{ editSpaceModalError }}</p>

          <div class="resident-modal__actions">
            <button
              type="button"
              class="resident-modal__btn resident-modal__btn--secondary"
              :disabled="isSubmittingEditSpace"
              @click="closeEditSpaceModal"
            >
              {{ t('app.cancelAction') }}
            </button>
            <button
              type="submit"
              class="resident-modal__btn resident-modal__btn--primary"
              :disabled="isSubmittingEditSpace || isProcessingEditImage"
            >
              {{
                isSubmittingEditSpace
                  ? t('app.savingSpaceUpdateAction')
                  : t('app.saveSpaceUpdateAction')
              }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="isDeleteResidentModalOpen"
      class="resident-modal-backdrop"
      role="presentation"
      @click.self="closeDeleteResidentModal"
    >
      <section
        class="resident-modal resident-modal--danger"
        role="dialog"
        aria-modal="true"
        :aria-label="t('app.deleteResidentModalTitle')"
      >
        <h3 class="resident-modal__title resident-modal__title--danger">
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />
          {{ t('app.deleteResidentModalTitle') }}
        </h3>

        <p class="resident-modal__warning">
          {{
            t('app.deleteResidentWarning', {
              name: deleteResidentCandidate?.name || '',
            })
          }}
        </p>

        <div v-if="!deleteResidentSummary" class="delete-impact">
          <p class="delete-impact__title">{{ t('app.deleteResidentImpactTitle') }}</p>
          <p v-if="isLoadingDeletePreview" class="delete-impact__loading">
            {{ t('app.deleteResidentLoadingPreview') }}
          </p>
          <ul v-else class="delete-impact__list">
            <li
              v-if="(deleteResidentPreview?.reservations ?? 0) > 0"
              class="delete-impact__item"
            >
              <i class="pi pi-calendar" aria-hidden="true" />
              {{
                t('app.deleteResidentImpactReservations', {
                  n: deleteResidentPreview?.reservations ?? 0,
                })
              }}
            </li>
            <li class="delete-impact__item">
              <i class="pi pi-id-card" aria-hidden="true" />
              {{ t('app.deleteResidentImpactAccount') }}
            </li>
            <li
              v-if="(deleteResidentPreview?.reservations ?? 0) === 0"
              class="delete-impact__item delete-impact__item--muted"
            >
              <i class="pi pi-info-circle" aria-hidden="true" />
              {{ t('app.deleteResidentImpactNone') }}
            </li>
          </ul>
        </div>

        <div v-else class="delete-summary">
          <p class="delete-summary__title">
            <i class="pi pi-check-circle" aria-hidden="true" />
            {{ t('app.deleteResidentSuccessTitle') }}
          </p>
          <p class="delete-summary__subtitle">
            {{ t('app.deleteResidentSuccessSummary') }}
          </p>
          <ul class="delete-summary__list">
            <li class="delete-summary__item">
              <i class="pi pi-calendar" aria-hidden="true" />
              {{
                t('app.deleteResidentSummaryReservations', {
                  n: deleteResidentSummary.reservations,
                })
              }}
            </li>
            <li class="delete-summary__item">
              <i class="pi pi-id-card" aria-hidden="true" />
              {{ t('app.deleteResidentSummaryAccount') }}
            </li>
          </ul>
          <p
            v-if="deleteResidentHasErrors"
            class="delete-summary__partial"
          >
            {{ t('app.deleteResidentPartialError') }}
          </p>
        </div>

        <p v-if="residentDeleteError" class="resident-modal__error">
          {{ residentDeleteError }}
        </p>

        <div class="resident-modal__actions">
          <button
            v-if="!deleteResidentSummary"
            type="button"
            class="resident-modal__btn resident-modal__btn--secondary"
            :disabled="isDeletingResidentCascade"
            @click="closeDeleteResidentModal"
          >
            {{ t('app.cancelAction') }}
          </button>
          <button
            v-if="!deleteResidentSummary"
            type="button"
            class="resident-modal__btn resident-modal__btn--danger"
            :disabled="isDeletingResidentCascade || isLoadingDeletePreview"
            @click="confirmDeleteResidentCascade"
          >
            <i class="pi pi-trash" aria-hidden="true" />
            {{
              isDeletingResidentCascade
                ? t('app.deleteResidentInProgress')
                : t('app.deleteResidentConfirmAction')
            }}
          </button>
          <button
            v-else
            type="button"
            class="resident-modal__btn resident-modal__btn--primary"
            @click="closeDeleteResidentModal"
          >
            {{ t('app.closeAction') }}
          </button>
        </div>
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
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.residents-list__share-btn {
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

.residents-list__delete-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #f5c2c7;
  border-radius: 999px;
  background: #fdecee;
  color: #b42318;
  padding: 0.38rem 0.68rem;
  font-weight: 600;
  cursor: pointer;
}

.residents-list__delete-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.residents-list__link {
  font-size: 0.825rem;
  color: #0a84ff;
  text-decoration: underline;
  overflow-wrap: anywhere;
  flex-basis: 100%;
}

.space-card {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.space-card__image-wrapper {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #f0f0f4;
}

.space-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.space-card__image-placeholder {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  background: #f0f0f4;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c7c7cc;
  font-size: 1.6rem;
}

.space-card__actions {
  margin-top: 0.55rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.space-card__edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #d2d2d7;
  border-radius: 999px;
  background: #ffffff;
  color: #1d1d1f;
  padding: 0.32rem 0.68rem;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;
}

.space-card__edit-btn:hover {
  border-color: #c7d2fe;
  color: #0a84ff;
}

.space-card__delete-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #f5c2c7;
  border-radius: 999px;
  background: #fdecee;
  color: #b42318;
  padding: 0.32rem 0.68rem;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;
}

.space-card__delete-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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

.space-image-field {
  border: 1px dashed #d2d2d7;
  border-radius: 10px;
  padding: 0.65rem 0.7rem;
  background: #fafafd;
}

.space-image-field__hint {
  margin: 0.1rem 0 0;
  color: #6e6e73;
  font-size: 0.8rem;
}

.space-image-field__preview {
  margin-top: 0.55rem;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #f0f0f4;
}

.space-image-field__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.space-image-field__controls {
  margin-top: 0.55rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.space-image-field__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #c7d2fe;
  background: #eaf3ff;
  color: #0a84ff;
  border-radius: 999px;
  padding: 0.4rem 0.75rem;
  font-weight: 600;
  font-size: 0.825rem;
  cursor: pointer;
}

.space-image-field__input {
  display: none;
}

.space-image-field__remove {
  display: inline-flex;
  align-items: center;
  border: 1px solid #d2d2d7;
  background: #ffffff;
  color: #1d1d1f;
  border-radius: 999px;
  padding: 0.4rem 0.75rem;
  font-weight: 600;
  font-size: 0.825rem;
  cursor: pointer;
}

.space-image-field__remove:disabled,
.space-image-field__btn:has(input:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
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

.resident-modal__btn--danger {
  background: #b42318;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.resident-modal__btn--danger:hover:not(:disabled) {
  background: #9a1f15;
}

.resident-modal__btn--danger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.resident-modal--danger {
  border-color: #fde0e0;
}

.resident-modal__title--danger {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: #9a2a1f;
}

.resident-modal__title--danger .pi {
  color: #d97706;
}

.resident-modal__warning {
  margin: 0.5rem 0 0.85rem;
  color: #1d1d1f;
  font-size: 0.92rem;
}

.delete-impact {
  background: #fff8f0;
  border: 1px solid #fde0c4;
  border-radius: 10px;
  padding: 0.7rem 0.8rem;
}

.delete-impact__title {
  margin: 0 0 0.45rem;
  font-size: 0.825rem;
  font-weight: 600;
  color: #8a4a00;
}

.delete-impact__loading {
  margin: 0;
  color: #6e6e73;
  font-size: 0.85rem;
}

.delete-impact__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.delete-impact__item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  color: #1d1d1f;
}

.delete-impact__item .pi {
  color: #d97706;
  font-size: 0.85rem;
}

.delete-impact__item--muted {
  color: #6e6e73;
}

.delete-impact__item--muted .pi {
  color: #6e6e73;
}

.delete-summary {
  background: #ecfdf3;
  border: 1px solid #abefc6;
  border-radius: 10px;
  padding: 0.8rem 0.9rem;
}

.delete-summary__title {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #166534;
}

.delete-summary__title .pi {
  color: #16a34a;
}

.delete-summary__subtitle {
  margin: 0.4rem 0 0.55rem;
  color: #166534;
  font-size: 0.825rem;
}

.delete-summary__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.delete-summary__item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #1d1d1f;
}

.delete-summary__item .pi {
  color: #16a34a;
}

.delete-summary__partial {
  margin: 0.55rem 0 0;
  color: #b54708;
  font-size: 0.8rem;
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
