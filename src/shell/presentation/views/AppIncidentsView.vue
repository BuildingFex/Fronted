<script setup>
  import { ref, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { incidentsApi } from '@/incidents/infrastructure/incidentsApi.js'
  import  DataTable  from 'primevue/datatable'
  import  Column  from 'primevue/column'
  import  Tag  from 'primevue/tag'
  import  Button  from 'primevue/button'
  import  Dialog  from 'primevue/dialog'
  import InputText  from 'primevue/inputtext'
  import  Dropdown  from 'primevue/dropdown'

  const { t } = useI18n()

  const incidents = ref([])
  const loading = ref(false)
  const error = ref(null)

  const isDialogOpen = ref(false)
  const selectedIncident = ref(null)
  const editForm = ref({
  description: '',
  status: '',
  provider: ''
})

  const statusOptions = [
  { label: t('incidentStatusOpen'), value: 'open' },
  { label: t('incidentStatusInProgress'), value: 'in-progress' },
  { label: t('incidentStatusResolved'), value: 'resolved' }
  ]

  onMounted(async () => {
  await loadIncidents()
})

  async function loadIncidents() {
  try {
  loading.value = true
  incidents.value = await incidentsApi.list()
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

  function openEditDialog(incident) {
  selectedIncident.value = incident
  editForm.value = { ...incident }
  isDialogOpen.value = true
}

  async function saveIncident() {
  try {
  if (selectedIncident.value) {
  await incidentsApi.update(selectedIncident.value.id, editForm.value)
} else {
  await incidentsApi.add(editForm.value)
}
  await loadIncidents()
  isDialogOpen.value = false
} catch (err) {
  error.value = err
}
}

  async function deleteIncident(id) {
  try {
  await incidentsApi.remove(id)
  await loadIncidents()
} catch (err) {
  error.value = err
}
}

  function newIncident() {
  selectedIncident.value = null
  editForm.value = { id: generateIncidentId(), description: '', status: 'open', provider: '' }
  isDialogOpen.value = true

}

  function generateIncidentId() {
    // Busca el máximo número actual en los IDs
    const maxId = incidents.value
        .map(i => parseInt(i.id.replace('incident-', '')))
        .reduce((a, b) => Math.max(a, b), 1000) // empieza en 1000 si no hay nada
    return `incident-${maxId + 1}`
  }

</script>

<template>
  <div class="incidents-view">
    <div class="incidents-header">
      <div>
        <h1 class="incidents-title">{{ t('app.pageIncidents') }}</h1>
        <p class="incidents-subtitle">{{ t('app.incidentsAdminSubtitle') }}</p>
      </div>
      <Button
        :label="t('app.newIncident')"
        icon="pi pi-plus"
        class="p-button-outlined incidents-toolbar__btn incidents-toolbar__btn--primary"
        @click="newIncident"
      />
    </div>

    <div class="incidents-panel">
      <DataTable
        :value="incidents"
        :loading="loading"
        responsiveLayout="scroll"
        class="incidents-table"
      >
        <Column field="id" header="ID" />
        <Column field="residentName" :header="t('app.incidentResidentName')" />
        <Column field="description" :header="t('app.incidentDescription')" />
        <Column field="createdAt" :header="t('app.incidentDate')" />
        <Column :header="t('app.incidentStatus')">
          <template #body="{ data }">
            <Tag
              class="incidents-status-tag"
              :value="data.status"
              :severity="statusSeverity(data.status)"
            />
          </template>
        </Column>
        <Column :header="t('app.incidentProvider')">
          <template #body="{ data }">
            <span class="incidents-provider-cell">{{ data.provider || t('app.noProviderAssigned') }}</span>
          </template>
        </Column>
        <Column :header="t('app.incidentActions')">
          <template #body="{ data }">
            <div class="incidents-row-actions">
              <Button
                icon="pi pi-pencil"
                class="p-button-text incidents-row-actions__btn"
                :label="t('app.editAction')"
                @click="openEditDialog(data)"
              />
              <Button
                icon="pi pi-trash"
                class="p-button-text incidents-row-actions__btn incidents-row-actions__btn--danger"
                :label="t('app.deleteAction')"
                @click="deleteIncident(data.id)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <p v-if="error" class="incidents-error" role="alert">{{ t('app.residentsLoadError') }}</p>

    <Dialog
      v-model:visible="isDialogOpen"
      modal
      :header="t('app.editIncident')"
      :style="{ width: 'min(30rem, 92vw)' }"
      class="incidents-dialog"
      :draggable="false"
    >
      <div class="incidents-dialog__form">
        <div class="incidents-dialog__field">
          <label for="description">{{ t('app.incidentDescription') }}</label>
          <InputText id="description" v-model="editForm.description" class="incidents-dialog__input" />
        </div>
        <div class="incidents-dialog__field">
          <label for="status">{{ t('app.incidentStatus') }}</label>
          <Dropdown
            id="status"
            v-model="editForm.status"
            class="incidents-dialog__dropdown"
            :options="statusOptions"
            option-label="label"
            option-value="value"
          />
        </div>
        <div class="incidents-dialog__field">
          <label for="provider">{{ t('app.incidentProvider') }}</label>
          <InputText id="provider" v-model="editForm.provider" class="incidents-dialog__input" />
        </div>
      </div>
      <template #footer>
        <Button
          :label="t('app.cancelAction')"
          icon="pi pi-times"
          class="p-button-outlined incidents-dialog__btn incidents-dialog__btn--secondary"
          @click="isDialogOpen = false"
        />
        <Button
          :label="t('app.saveResidentAction')"
          icon="pi pi-check"
          class="p-button-outlined incidents-dialog__btn incidents-dialog__btn--primary"
          autofocus
          @click="saveIncident"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.incidents-view {
  padding: 1.75rem 1.5rem 2.5rem;
  max-width: 72rem;
  margin: 0 auto;
  font-family: inherit;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  letter-spacing: -0.022em;
  line-height: 1.47;
  -webkit-font-smoothing: antialiased;
}

.incidents-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--border);
}

.incidents-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--text);
}

.incidents-subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.9375rem;
  font-weight: 400;
  color: var(--muted);
  max-width: 36rem;
  line-height: 1.45;
}

.incidents-toolbar__btn.p-button.p-button-outlined {
  border-radius: 980px;
  font-weight: 600;
  font-size: 0.8125rem;
  padding: 0.5rem 1rem;
  border: 1px solid #d2d2d7;
  background: var(--bg);
  color: var(--text);
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  box-shadow: none;
}

.incidents-toolbar__btn--primary.p-button.p-button-outlined {
  color: #0a84ff;
  border-color: rgba(10, 132, 255, 0.35);
  background: rgba(10, 132, 255, 0.06);
}

.incidents-toolbar__btn--primary.p-button.p-button-outlined:not(:disabled):hover {
  background: rgba(10, 132, 255, 0.1);
  border-color: rgba(10, 132, 255, 0.45);
}

.incidents-toolbar__btn.p-button .p-button-icon {
  color: inherit;
}

.incidents-panel {
  padding: 0.35rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.incidents-table :deep(.p-datatable) {
  font-size: 0.875rem;
}

.incidents-table :deep(.p-datatable-header) {
  background: transparent;
  border: none;
  padding: 0.35rem 0.5rem;
}

.incidents-table :deep(.p-datatable-loading-overlay) {
  background: rgba(255, 255, 255, 0.75);
}

.incidents-table :deep(.p-datatable-thead > tr > th) {
  background: var(--bg-elevated);
  color: var(--muted);
  font-weight: 600;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 0.65rem 0.75rem;
}

.incidents-table :deep(.p-datatable-tbody > tr) {
  background: var(--bg);
  transition: background 0.12s ease;
}

.incidents-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--bg-elevated);
}

.incidents-table :deep(.p-datatable-tbody > tr > td) {
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0.75rem;
  vertical-align: middle;
  color: var(--text);
}

.incidents-provider-cell {
  color: var(--muted);
  font-size: 0.8125rem;
}

.incidents-status-tag :deep(.p-tag) {
  border-radius: 980px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 0.3rem 0.65rem;
}

.incidents-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.incidents-row-actions__btn.p-button.p-button-text {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #0a84ff;
  padding: 0.35rem 0.5rem;
}

.incidents-row-actions__btn.p-button.p-button-text .p-button-icon {
  color: inherit;
}

.incidents-row-actions__btn--danger.p-button.p-button-text {
  color: #ff3b30;
}

.incidents-row-actions__btn.p-button.p-button-text:not(:disabled):hover {
  background: rgba(10, 132, 255, 0.08);
}

.incidents-row-actions__btn--danger.p-button.p-button-text:not(:disabled):hover {
  background: rgba(255, 59, 48, 0.08);
}

.incidents-error {
  margin: 0;
  color: #ff3b30;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Dialog */
.incidents-dialog :deep(.p-dialog-header) {
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  padding: 1rem 1.25rem;
}

.incidents-dialog :deep(.p-dialog-content) {
  padding: 1.15rem 1.25rem 1.25rem;
}

.incidents-dialog :deep(.p-dialog-footer) {
  border-top: 1px solid var(--border);
  padding: 0.85rem 1.25rem;
  gap: 0.5rem;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.incidents-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.incidents-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.incidents-dialog__field label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--muted);
}

.incidents-dialog__input,
.incidents-dialog__dropdown {
  width: 100%;
}

.incidents-dialog :deep(.p-inputtext),
.incidents-dialog :deep(.p-dropdown) {
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  font-size: 0.9375rem;
  color: var(--text);
}

.incidents-dialog :deep(.p-inputtext:enabled:focus),
.incidents-dialog :deep(.p-dropdown:not(.p-disabled).p-focus) {
  outline: none;
  border-color: #0a84ff;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
}

.incidents-dialog__btn.p-button.p-button-outlined {
  border-radius: 980px;
  font-weight: 600;
  font-size: 0.8125rem;
  padding: 0.5rem 1rem;
  box-shadow: none;
}

.incidents-dialog__btn--secondary.p-button.p-button-outlined {
  border-color: #d2d2d7;
  background: var(--bg);
  color: var(--text);
}

.incidents-dialog__btn--secondary.p-button.p-button-outlined:not(:disabled):hover {
  background: var(--bg-elevated);
}

.incidents-dialog__btn--primary.p-button.p-button-outlined {
  color: #0a84ff;
  border-color: rgba(10, 132, 255, 0.35);
  background: rgba(10, 132, 255, 0.06);
}

.incidents-dialog__btn--primary.p-button.p-button-outlined:not(:disabled):hover {
  background: rgba(10, 132, 255, 0.12);
  border-color: rgba(10, 132, 255, 0.45);
}

.incidents-dialog__btn.p-button .p-button-icon {
  color: inherit;
}
</style>
