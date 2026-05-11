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
  <div class="app-view">
    <h1 class="app-view__title">{{ t('app.pageIncidents') }}</h1>
    <p class="app-view__subtitle">{{ t('app.incidentsAdminSubtitle') }}</p>

    <div class="incidents-page">
      <section class="incidents-panel" aria-labelledby="incidents-list-heading">
        <header class="incidents-panel__head">
          <h2 id="incidents-list-heading" class="incidents-panel__title">
            {{ t('app.incidentsAdminListTitle') }}
          </h2>
          <Button
            type="button"
            rounded
            severity="secondary"
            :label="t('app.newIncident')"
            class="incidents-panel__btn"
            @click="newIncident"
          />
        </header>

        <DataTable
          :value="incidents"
          :loading="loading"
          responsiveLayout="scroll"
          class="incidents-data incidents-table"
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
                text
                rounded
                class="incidents-row-actions__btn"
                :label="t('app.editAction')"
                @click="openEditDialog(data)"
              />
              <Button
                text
                rounded
                class="incidents-row-actions__btn incidents-row-actions__btn--danger"
                :label="t('app.deleteAction')"
                @click="deleteIncident(data.id)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
      </section>

      <p v-if="error" class="app-view__error incidents-page__error" role="alert">
        {{ t('app.residentsLoadError') }}
      </p>
    </div>

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
          type="button"
          text
          rounded
          :label="t('app.cancelAction')"
          @click="isDialogOpen = false"
        />
        <Button
          type="button"
          rounded
          :label="t('app.saveSpaceUpdateAction')"
          autofocus
          @click="saveIncident"
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
  margin: 0;
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

.incidents-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.35rem;
  align-items: center;
}

.incidents-row-actions__btn :deep(.p-button) {
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.35rem 0.55rem;
}

.incidents-row-actions__btn:not(.incidents-row-actions__btn--danger) :deep(.p-button) {
  color: #0a84ff;
}

.incidents-row-actions__btn--danger :deep(.p-button) {
  color: #ff3b30;
}

.incidents-dialog :deep(.p-dialog-header) {
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--apple-text, #1d1d1f);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 1rem 1.25rem;
}

.incidents-dialog :deep(.p-dialog-content) {
  padding: 1.15rem 1.25rem 1.25rem;
}

.incidents-dialog :deep(.p-dialog-footer) {
  gap: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0.85rem 1.25rem;
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
  color: var(--apple-text, #1d1d1f);
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
  color: var(--apple-text, #1d1d1f);
}

.incidents-dialog :deep(.p-inputtext:enabled:focus),
.incidents-dialog :deep(.p-dropdown:not(.p-disabled).p-focus) {
  outline: none;
  border-color: #0a84ff;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
}
</style>
