<script setup>
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { incidentsApi } from '@/incidents/infrastructure/incidentsApi.js'
import { authApi } from '@/iam/infrastructure/authApi.js'
import { useSession } from '@/iam/application/sessionStore.js'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'

const { t, locale } = useI18n()
const { state } = useSession()
const profile = computed(() => state.profile ?? {})

const incidents = ref([])
const loading = ref(false)
const error = ref(null)
const newDescription = ref('')
const isReportModalOpen = ref(false)

onMounted(async () => {
  await loadIncidents()
})

async function loadIncidents() {
  const residentId = profile.value.id
  if (!residentId) {
    incidents.value = []
    return
  }
  try {
    loading.value = true
    error.value = null
    const all = await incidentsApi.list()
    incidents.value = all.filter((i) => i.residentId === residentId)
  } catch (err) {
    error.value = err
  } finally {
    loading.value = false
  }
}

function statusSeverity(status) {
  switch (status) {
    case 'open':
      return 'danger'
    case 'in-progress':
      return 'warning'
    case 'resolved':
      return 'success'
    default:
      return 'info'
  }
}

function statusLabel(status) {
  switch (status) {
    case 'open':
      return t('incidentStatusOpen')
    case 'in-progress':
      return t('incidentStatusInProgress')
    case 'resolved':
      return t('incidentStatusResolved')
    default:
      return String(status ?? '—')
  }
}

const nfDateTime = computed(
  () => (iso) => {
    const s = String(iso ?? '').trim()
    if (!s) return '—'
    const d = new Date(s)
    if (!Number.isFinite(d.getTime())) return s
    const loc = locale.value === 'es' ? 'es-PE' : 'en-US'
    return new Intl.DateTimeFormat(loc, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  },
)

function openReportModal() {
  newDescription.value = ''
  isReportModalOpen.value = true
}

function closeReportModal() {
  isReportModalOpen.value = false
}

async function reportIncident() {
  const text = newDescription.value?.trim()
  if (!text) return
  const residentId = profile.value.id
  const residentName = profile.value.name || ''
  if (!residentId) return

  let ownerAdminId = profile.value.ownerAdminId ?? null
  if (!ownerAdminId) {
    const row = await authApi.getProfileById(residentId)
    ownerAdminId = row?.ownerAdminId ?? null
  }

  const incident = {
    id: `incident-${Date.now()}`,
    residentId,
    residentName,
    description: text,
    status: 'open',
    createdAt: new Date().toISOString(),
    provider: '',
    ...(ownerAdminId ? { ownerAdminId } : {}),
  }
  try {
    await incidentsApi.add(incident)
    newDescription.value = ''
    isReportModalOpen.value = false
    await loadIncidents()
  } catch (err) {
    error.value = err
  }
}
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('resident.incidentsTitle') }}</h1>
    <p class="app-view__subtitle">
      {{ t('resident.incidentsSubtitle', { name: profile.name || '' }) }}
    </p>

    <div class="incidents-page">
      <section class="incidents-panel" aria-labelledby="resident-incidents-list-heading">
        <header class="incidents-panel__head">
          <h2 id="resident-incidents-list-heading" class="incidents-panel__title">
            {{ t('app.residentIncidentsListTitle') }}
          </h2>
          <Button
            type="button"
            rounded
            severity="secondary"
            :label="t('app.residentIncidentsSubmit')"
            class="incidents-panel__btn"
            @click="openReportModal"
          />
        </header>

        <DataTable
          :value="incidents"
          :loading="loading"
          responsiveLayout="scroll"
          class="incidents-data incidents-table"
        >
          <Column field="id" header="ID" />
          <Column field="description" :header="t('app.incidentDescription')" />
          <Column :header="t('app.incidentDate')">
            <template #body="{ data }">
              {{ nfDateTime(data.createdAt) }}
            </template>
          </Column>
          <Column :header="t('app.incidentStatus')">
            <template #body="{ data }">
              <Tag
                class="incidents-status-tag"
                :value="statusLabel(data.status)"
                :severity="statusSeverity(data.status)"
              />
            </template>
          </Column>
          <Column :header="t('app.incidentProvider')">
            <template #body="{ data }">
              <span class="incidents-provider-cell">{{
                data.provider || t('app.noProviderAssigned')
              }}</span>
            </template>
          </Column>
        </DataTable>

        <p v-if="error" class="app-view__error incidents-page__error" role="alert">
          {{ t('app.residentsLoadError') }}
        </p>
      </section>
    </div>

    <Dialog
      v-model:visible="isReportModalOpen"
      modal
      :header="t('app.residentIncidentsFormTitle')"
      :style="{ width: 'min(32rem, 92vw)' }"
      class="resident-incidents-dialog"
      :draggable="false"
    >
      <div class="resident-incidents-dialog__form">
        <div class="resident-incidents-dialog__field">
          <label for="resident-incident-description">{{ t('app.incidentDescription') }}</label>
          <Textarea
            id="resident-incident-description"
            v-model="newDescription"
            :placeholder="t('app.residentIncidentsDescriptionPlaceholder')"
            class="resident-incidents-dialog__textarea"
            rows="5"
            auto-resize
          />
        </div>
      </div>
      <template #footer>
        <Button
          type="button"
          text
          rounded
          :label="t('app.cancelAction')"
          @click="closeReportModal"
        />
        <Button
          type="button"
          rounded
          :label="t('app.residentIncidentsSubmit')"
          @click="reportIncident"
        />
      </template>
    </Dialog>
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
  max-width: 36rem;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: -0.015em;
  color: var(--apple-text-secondary, #6e6e73);
}

.app-view__error {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  color: #b42318;
}

.incidents-page {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.incidents-page__error {
  margin: 0;
}

.incidents-panel {
  padding: 1.2rem 1.25rem 1.35rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.incidents-panel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem 1rem;
  margin-bottom: 0.85rem;
}

.incidents-panel__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--apple-text, #1d1d1f);
  max-width: min(100%, 18rem);
}

.incidents-panel__btn {
  flex-shrink: 0;
}

.incidents-panel__btn :deep(.p-button) {
  font-weight: 500;
  font-size: 0.8125rem;
  padding-block: 0.5rem;
  padding-inline: 1rem;
}

.incidents-table {
  margin-top: 0.15rem;
}

.incidents-data :deep(.p-datatable) {
  font-size: 0.875rem;
  border: none;
  border-radius: 12px;
  overflow: hidden;
}

.incidents-data :deep(.p-datatable-wrapper) {
  border-radius: 12px;
}

.incidents-data :deep(.p-datatable-header) {
  background: transparent;
  border: none;
  padding: 0;
}

.incidents-data :deep(.p-datatable-loading-overlay) {
  background: rgba(255, 255, 255, 0.75);
}

.incidents-data :deep(.p-datatable-thead > tr > th) {
  background: rgba(0, 0, 0, 0.02);
  color: #86868b;
  font-weight: 600;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.055em;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0.6rem 0.75rem;
}

.incidents-data :deep(.p-datatable-tbody > tr) {
  background: transparent;
  transition: background 0.12s ease;
}

.incidents-data :deep(.p-datatable-tbody > tr:hover) {
  background: rgba(0, 0, 0, 0.02);
}

.incidents-data :deep(.p-datatable-tbody > tr > td) {
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 0.7rem 0.75rem;
  vertical-align: middle;
  color: var(--apple-text, #1d1d1f);
}

.incidents-data :deep(.p-datatable-tbody > tr:last-child > td) {
  border-bottom: none;
}

.incidents-provider-cell {
  color: var(--apple-text-secondary, #6e6e73);
  font-size: 0.8125rem;
}

.incidents-status-tag :deep(.p-tag) {
  border-radius: 980px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 0.3rem 0.65rem;
}

.resident-incidents-dialog :deep(.p-dialog-header) {
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--apple-text, #1d1d1f);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 1rem 1.25rem;
}

.resident-incidents-dialog :deep(.p-dialog-content) {
  padding: 1.15rem 1.25rem 1.25rem;
}

.resident-incidents-dialog :deep(.p-dialog-footer) {
  gap: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0.85rem 1.25rem;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.resident-incidents-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.resident-incidents-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.resident-incidents-dialog__field label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
}

.resident-incidents-dialog__textarea {
  width: 100%;
  min-height: 8rem;
}

.resident-incidents-dialog :deep(.p-textarea) {
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  font-size: 0.9375rem;
  color: var(--apple-text, #1d1d1f);
}

.resident-incidents-dialog :deep(.p-textarea:enabled:focus) {
  outline: none;
  border-color: #0a84ff;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
}
</style>
