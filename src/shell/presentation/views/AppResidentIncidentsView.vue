<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { incidentsApi } from '@/incidents/infrastructure/incidentsApi.js'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Dialog from 'primevue/dialog'

const { t } = useI18n()

const incidents = ref([])
const loading = ref(false)
const error = ref(null)
const newDescription = ref('')
const isReportModalOpen = ref(false)

// Simulación: residente actual (en tu proyecto vendrá de auth)
const currentResident = {
  id: 'resident-1778137645757',
  name: 'Sebastian Martin Beingolea Montalvo'
}

onMounted(async () => {
  await loadIncidents()
})

async function loadIncidents() {
  try {
    loading.value = true
    const all = await incidentsApi.list()
    // ✅ Solo incidencias del residente actual
    incidents.value = all.filter(i => i.residentId === currentResident.id)
  } catch (err) {
    error.value = err
  } finally {
    loading.value = false
  }
}


function statusSeverity(status) {
  switch (status) {
    case 'open': return 'danger'
    case 'in-progress': return 'warning'
    case 'resolved': return 'success'
    default: return 'info'
  }
}

function generateIncidentId() {
  const allIds = incidents.value.map(i => parseInt(i.id.replace('incident-', '')))
  const maxId = allIds.length > 0 ? Math.max(...allIds) : 1000
  return `incident-${maxId + 1}`
}


async function reportIncident() {
  const text = newDescription.value?.trim()
  if (!text) return
  const incident = {
    id: generateIncidentId(),
    residentId: currentResident.id,
    residentName: currentResident.name,
    description: text,
    status: 'open',
    createdAt: new Date().toISOString(),
    provider: ''
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
    <h1 class="app-view__title">{{ t('app.incidentsTitle') }}</h1>
    <p class="app-view__subtitle">
      {{ t('app.incidentsSubtitle', { name: currentResident.name }) }}
    </p>

    <div class="resident-incidents__toolbar">
      <Button
        :label="t('app.residentIncidentsSubmit')"
        icon="pi pi-plus"
        class="p-button-success resident-incidents__open-btn"
        @click="openReportModal"
      />
    </div>

    <Dialog
      v-model:visible="isReportModalOpen"
      modal
      :header="t('app.residentIncidentsFormTitle')"
      :style="{ width: 'min(32rem, 92vw)' }"
      class="resident-incidents-dialog"
      :draggable="false"
    >
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
      <template #footer>
        <Button
          :label="t('app.cancelAction')"
          icon="pi pi-times"
          class="p-button-text"
          @click="closeReportModal"
        />
        <Button
          :label="t('app.residentIncidentsSubmit')"
          icon="pi pi-send"
          class="p-button-success"
          @click="reportIncident"
        />
      </template>
    </Dialog>

    <!-- Lista -->
    <DataTable :value="incidents" :loading="loading" responsiveLayout="scroll" class="p-datatable-sm">
      <Column field="id" header="ID"></Column>
      <Column field="description" :header="t('app.incidentDescription')"></Column>
      <Column field="createdAt" :header="t('app.incidentDate')"></Column>
      <Column :header="t('app.incidentStatus')">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="statusSeverity(data.status)" />
        </template>
      </Column>
      <Column :header="t('app.incidentProvider')">
        <template #body="{ data }">
          {{ data.provider || t('app.noProviderAssigned') }}
        </template>
      </Column>
    </DataTable>

    <p v-if="error" class="error">{{ t('app.residentsLoadError') }}</p>
  </div>
</template>

<style scoped>
.app-view {
  padding: 1.75rem 1.5rem;
  max-width: 72rem;
}

.app-view__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--apple-text, #1d1d1f);
}

.app-view__subtitle {
  margin: 0.35rem 0 1rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.resident-incidents__toolbar {
  margin-bottom: 1.25rem;
}

.resident-incidents-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.resident-incidents-dialog__field label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--apple-text, #1d1d1f);
}

.resident-incidents-dialog__textarea {
  width: 100%;
  min-height: 8rem;
}

.resident-incidents-dialog :deep(.p-dialog-content) {
  padding-top: 0.5rem;
}
.error {
  color: #b42318;
  margin-top: 1rem;
}
</style>
