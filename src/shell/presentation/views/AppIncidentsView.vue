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

      <Button
          :label="t('app.newIncident')"
          icon="pi pi-plus"
          class="p-button-success"
          @click="newIncident"
      />

      <DataTable
          :value="incidents"
          :loading="loading"
          responsiveLayout="scroll"
          class="p-datatable-sm"
      >
        <Column field="id" header="ID" />
        <Column field="residentName" :header="t('app.residentData')" />
        <Column field="description" :header="t('app.incidentDescription')" />
        <Column field="createdAt" :header="t('app.incidentDate')" />
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
        <Column :header="t('app.incidentActions')">
          <template #body="{ data }">
            <Button
                icon="pi pi-pencil"
                class="p-button-text"
                :label="t('app.editAction')"
                @click="openEditDialog(data)"
            />
            <Button
                icon="pi pi-trash"
                class="p-button-text p-button-danger"
                :label="t('app.deleteAction')"
                @click="deleteIncident(data.id)"
            />
          </template>
        </Column>
      </DataTable>

      <p v-if="error" class="error">{{ t('app.residentsLoadError') }}</p>

      <Dialog v-model:visible="isDialogOpen" modal :header="t('app.editIncident')" :style="{ width: '30rem' }">
        <div class="p-fluid">
          <div class="p-field">
            <label for="description">{{ t('app.incidentDescription') }}</label>
            <InputText id="description" v-model="editForm.description" />
          </div>
          <div class="p-field">
            <label for="status">{{ t('app.incidentStatus') }}</label>
            <Dropdown id="status" v-model="editForm.status" :options="statusOptions" optionLabel="label" optionValue="value" />
          </div>
          <div class="p-field">
            <label for="provider">{{ t('app.incidentProvider') }}</label>
            <InputText id="provider" v-model="editForm.provider" />
          </div>
        </div>
        <template #footer>
          <Button :label="t('app.cancelAction')" icon="pi pi-times" @click="isDialogOpen=false" class="p-button-text" />
          <Button :label="t('app.saveResidentAction')" icon="pi pi-check" @click="saveIncident" autofocus />
        </template>
      </Dialog>
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
.error {
  color: #b42318;
  margin-top: 1rem;
}
</style>
