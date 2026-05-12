<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import { importUploadsApi } from '@/import/infrastructure/importUploadsApi.js'

const { t, locale } = useI18n()

const MAX_BYTES = 1024 * 1024

const items = ref([])
const loading = ref(false)
const loadError = ref(false)
const uploading = ref(false)
const uploadError = ref('')
const isDragging = ref(false)
const fileInputRef = ref(null)
const deletingId = ref(null)

function formatBytes(n) {
  const x = Number(n) || 0
  if (x < 1024) return `${x} B`
  if (x < 1024 * 1024) return `${(x / 1024).toFixed(x < 10240 ? 1 : 0)} KB`
  return `${(x / (1024 * 1024)).toFixed(1)} MB`
}

const maxSizeLabel = computed(() => formatBytes(MAX_BYTES))

function localDateKey(iso) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayKey() {
  return localDateKey(new Date().toISOString())
}

function yesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localDateKey(d.toISOString())
}

function dateGroupLabel(dateKey) {
  if (dateKey === todayKey()) return t('importView.today')
  if (dateKey === yesterdayKey()) return t('importView.yesterday')
  const d = new Date(`${dateKey}T12:00:00`)
  return d.toLocaleDateString(locale.value === 'es' ? 'es-PE' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const groupedByDate = computed(() => {
  const map = new Map()
  for (const row of items.value) {
    const key = localDateKey(row.uploadedAt)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a))
  return keys.map((dateKey) => ({
    dateKey,
    label: dateGroupLabel(dateKey),
    items: map.get(dateKey),
  }))
})

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result ?? ''))
    fr.onerror = () => reject(new Error('read'))
    fr.readAsDataURL(file)
  })
}

async function loadList() {
  loading.value = true
  loadError.value = false
  try {
    items.value = await importUploadsApi.list()
  } catch {
    loadError.value = true
    items.value = []
  } finally {
    loading.value = false
  }
}

async function ingestFiles(fileList) {
  const files = Array.from(fileList ?? []).filter((f) => f.size > 0)
  if (!files.length) return
  uploadError.value = ''
  uploading.value = true
  try {
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        uploadError.value = t('importView.fileTooLarge', { max: maxSizeLabel.value })
        continue
      }
      const dataUrl = await readFileAsDataUrl(file)
      await importUploadsApi.add({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
      })
    }
    await loadList()
  } catch {
    uploadError.value = t('importView.uploadError')
  } finally {
    uploading.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

function onFileInputChange(e) {
  ingestFiles(e.target?.files)
}

function onDrop(e) {
  e.preventDefault()
  isDragging.value = false
  ingestFiles(e.dataTransfer?.files)
}

function onDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function openFilePicker() {
  fileInputRef.value?.click()
}

async function onDiscard(id) {
  if (!id || deletingId.value) return
  deletingId.value = id
  uploadError.value = ''
  try {
    await importUploadsApi.remove(id)
    items.value = items.value.filter((r) => r.id !== id)
  } catch {
    uploadError.value = t('importView.deleteError')
  } finally {
    deletingId.value = null
  }
}

onMounted(loadList)
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('app.pageImport') }}</h1>
    <p class="app-view__subtitle">{{ t('importView.subtitle') }}</p>

    <div class="finance-page">
      <section class="finance-panel import-panel" aria-labelledby="import-upload-heading">
        <h2 id="import-upload-heading" class="finance-panel__section-title">
          {{ t('importView.uploadSectionTitle') }}
        </h2>
        <p class="import-panel__hint">{{ t('importView.maxSizeHint', { size: maxSizeLabel }) }}</p>

        <div
          class="import-dropzone"
          :class="{ 'import-dropzone--drag': isDragging, 'import-dropzone--busy': uploading }"
          role="button"
          tabindex="0"
          :aria-busy="uploading"
          @click="openFilePicker"
          @keydown.enter.prevent="openFilePicker"
          @keydown.space.prevent="openFilePicker"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <i class="pi pi-cloud-upload import-dropzone__icon" aria-hidden="true" />
          <p class="import-dropzone__title">{{ t('importView.dropTitle') }}</p>
          <p class="import-dropzone__hint">{{ t('importView.dropHint') }}</p>
          <Button
            type="button"
            rounded
            severity="secondary"
            class="import-dropzone__btn"
            :label="t('importView.chooseFiles')"
            :loading="uploading"
            @click.stop="openFilePicker"
          />
          <input
            ref="fileInputRef"
            type="file"
            class="import-dropzone__input"
            multiple
            @change="onFileInputChange"
          />
        </div>

        <p v-if="uploadError" class="import-alert import-alert--error" role="alert">
          {{ uploadError }}
        </p>
      </section>

      <section class="finance-panel import-panel" aria-labelledby="import-list-heading">
        <h2 id="import-list-heading" class="finance-panel__section-title">
          {{ t('importView.listSectionTitle') }}
        </h2>

        <p v-if="loading" class="import-status">{{ t('importView.loading') }}</p>
        <p v-else-if="loadError" class="import-alert import-alert--error" role="alert">
          {{ t('importView.loadError') }}
        </p>
        <p v-else-if="!items.length" class="import-empty">{{ t('importView.empty') }}</p>

        <div v-else class="import-groups">
          <section
            v-for="group in groupedByDate"
            :key="group.dateKey"
            class="import-date-group"
            :aria-label="group.label"
          >
            <header class="import-date-group__header">
              <h3 class="import-date-group__title">{{ group.label }}</h3>
              <span class="import-date-group__count">{{
                t('importView.filesInDay', { n: group.items.length })
              }}</span>
            </header>
            <ul class="import-file-list">
              <li v-for="file in group.items" :key="file.id" class="import-file-row">
                <div class="import-file-row__main">
                  <i class="pi pi-file import-file-row__icon" aria-hidden="true" />
                  <div class="import-file-row__meta">
                    <span class="import-file-row__name">{{ file.fileName }}</span>
                    <span class="import-file-row__sub">{{ formatBytes(file.size) }}</span>
                  </div>
                </div>
                <div class="import-file-row__actions">
                  <a
                    v-if="file.dataUrl"
                    class="import-link"
                    :href="file.dataUrl"
                    :download="file.fileName"
                  >
                    <i class="pi pi-download" aria-hidden="true" />
                    {{ t('importView.download') }}
                  </a>
                  <button
                    type="button"
                    class="import-discard"
                    :disabled="deletingId === file.id"
                    @click="onDiscard(file.id)"
                  >
                    <i class="pi pi-trash" aria-hidden="true" />
                    {{ deletingId === file.id ? '…' : t('importView.discard') }}
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
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
  max-width: 40rem;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: -0.015em;
  color: var(--apple-text-secondary, #6e6e73);
}

.finance-page {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.finance-panel {
  padding: 1.2rem 1.25rem 1.35rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.finance-panel__section-title {
  margin: 0 0 0.5rem;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--apple-text, #1d1d1f);
}

.import-panel__hint {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.import-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 2rem 1.25rem;
  border-radius: 12px;
  border: 2px dashed rgba(0, 0, 0, 0.12);
  background: #fafafa;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.import-dropzone:hover,
.import-dropzone:focus-visible {
  outline: none;
  border-color: rgba(10, 132, 255, 0.45);
  background: rgba(10, 132, 255, 0.04);
}

.import-dropzone--drag {
  border-color: #0a84ff;
  background: rgba(10, 132, 255, 0.08);
}

.import-dropzone--busy {
  pointer-events: none;
  opacity: 0.85;
}

.import-dropzone__icon {
  font-size: 2rem;
  color: #86868b;
  margin-bottom: 0.25rem;
}

.import-dropzone__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
}

.import-dropzone__hint {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: #86868b;
}

.import-dropzone__input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.import-dropzone__btn :deep(.p-button) {
  font-weight: 500;
  font-size: 0.8125rem;
  padding-block: 0.5rem;
  padding-inline: 1rem;
}

.import-alert {
  margin: 0.75rem 0 0;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.import-alert--error {
  color: #b42318;
  background: rgba(180, 35, 24, 0.06);
  border: 1px solid rgba(180, 35, 24, 0.12);
}

.import-status,
.import-empty {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  color: #6e6e73;
}

.import-groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 0.75rem;
}

.import-date-group__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
  margin-bottom: 0.65rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.import-date-group__title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: capitalize;
  color: var(--apple-text, #1d1d1f);
}

.import-date-group__count {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #86868b;
}

.import-file-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.import-file-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.import-file-row__main {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  flex: 1 1 auto;
}

.import-file-row__icon {
  font-size: 1.1rem;
  color: #86868b;
  flex-shrink: 0;
}

.import-file-row__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.import-file-row__name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-file-row__sub {
  font-size: 0.75rem;
  color: #86868b;
}

.import-file-row__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.import-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: 980px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #0a84ff;
  background: rgba(10, 132, 255, 0.1);
  text-decoration: none;
  transition: background 0.15s ease;
}

.import-link:hover {
  background: rgba(10, 132, 255, 0.16);
}

.import-discard {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border: none;
  border-radius: 980px;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  color: #b42318;
  background: rgba(180, 35, 24, 0.08);
  transition: background 0.15s ease;
}

.import-discard:hover:not(:disabled) {
  background: rgba(180, 35, 24, 0.14);
}

.import-discard:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
