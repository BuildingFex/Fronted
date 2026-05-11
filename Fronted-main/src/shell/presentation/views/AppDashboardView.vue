<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Chart from 'primevue/chart'
import Card from 'primevue/card'
import { financesApi } from '@/finances/infrastructure/financesApi.js'
import { incidentsApi } from '@/incidents/infrastructure/incidentsApi.js'

const { t } = useI18n()

const kpi = ref({
  totalResidents: 0,
  occupiedUnits: 0,
  emptyUnits: 0,
  totalDebt: 0,
})

const recentIncidents = ref([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const [kpiData, incidentsData] = await Promise.all([
      financesApi.getDashboardKpis(),
      incidentsApi.list()
    ])
    
    // Si la API devuelve arreglo o objeto
    if (kpiData && (Array.isArray(kpiData) ? kpiData[0] : kpiData)) {
      const data = Array.isArray(kpiData) ? kpiData[0] : kpiData
      kpi.value = {
        totalResidents: data.totalResidents || 0,
        occupiedUnits: data.occupiedUnits || 0,
        emptyUnits: data.emptyUnits || 0,
        totalDebt: data.totalDebt || 0,
      }
    }
    
    if (Array.isArray(incidentsData)) {
      recentIncidents.value = incidentsData.slice(0, 5) // Last 5
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error)
  } finally {
    isLoading.value = false
  }
})

function incidentSeverity(status) {
  switch (status) {
    case 'open': return 'danger'
    case 'in-progress': return 'warn'
    case 'resolved': return 'success'
    default: return 'info'
  }
}

function incidentStatusLabel(status) {
  switch (status) {
    case 'open': return t('incidentStatusOpen')
    case 'in-progress': return t('incidentStatusInProgress')
    case 'resolved': return t('incidentStatusResolved')
    default: return status
  }
}


const chartData = ref({
  labels: ['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May'],
  datasets: [
    {
      label: t('dashboard.income'),
      backgroundColor: 'rgba(52, 199, 89, 0.72)',
      borderColor: '#34c759',
      borderWidth: 1,
      borderRadius: 6,
      data: [18500, 19200, 17800, 20100, 19800, 21000],
    },
    {
      label: t('dashboard.expenses'),
      backgroundColor: 'rgba(255, 59, 48, 0.62)',
      borderColor: '#ff3b30',
      borderWidth: 1,
      borderRadius: 6,
      data: [12400, 13100, 11800, 14200, 12900, 13600],
    },
  ],
})

const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 20,
        font: { size: 12, weight: '500' },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11, weight: '500' }, color: '#86868b' },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: {
        font: { size: 11 },
        color: '#86868b',
        callback: (v) => `S/ ${(v / 1000).toFixed(0)}k`,
      },
    },
  },
})
</script>

<template>
  <div class="view-container">
    <div class="view-header">
      <h1 class="text-2xl font-bold m-0">{{ t('dashboard.title') }}</h1>
      <p class="text-color-secondary mt-2 mb-4">{{ t('dashboard.subtitle') }}</p>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 kpi-grid">
      <!-- Occupancy card -->
      <Card class="kpi-card">
        <template #content>
          <div class="flex align-items-center gap-3">
            <div class="kpi-icon text-blue-500 bg-blue-100">
              <i class="pi pi-users text-xl" aria-hidden="true"></i>
            </div>
            <div>
              <span class="text-color-secondary text-sm font-medium block">{{ t('dashboard.totalResidents') }}</span>
              <strong class="text-2xl">{{ isLoading ? '...' : kpi.totalResidents }}</strong>
            </div>
          </div>
        </template>
      </Card>

      <Card class="kpi-card">
        <template #content>
          <div class="flex align-items-center gap-3">
            <div class="kpi-icon text-green-600 bg-green-100">
              <i class="pi pi-check-circle text-xl" aria-hidden="true"></i>
            </div>
            <div>
              <span class="text-color-secondary text-sm font-medium block">{{ t('dashboard.occupiedUnits') }}</span>
              <strong class="text-2xl">{{ isLoading ? '...' : kpi.occupiedUnits }}</strong>
            </div>
          </div>
        </template>
      </Card>

      <Card class="kpi-card">
        <template #content>
          <div class="flex align-items-center gap-3">
            <div class="kpi-icon text-orange-500 bg-orange-100">
              <i class="pi pi-building text-xl" aria-hidden="true"></i>
            </div>
            <div>
              <span class="text-color-secondary text-sm font-medium block">{{ t('dashboard.emptyUnits') }}</span>
              <strong class="text-2xl">{{ isLoading ? '...' : kpi.emptyUnits }}</strong>
            </div>
          </div>
        </template>
      </Card>

      <!-- Critical delinquency -->
      <Card class="kpi-card border-red-200" style="background-color: rgba(255, 59, 48, 0.02)">
        <template #content>
          <div class="flex align-items-center gap-3">
            <div class="kpi-icon text-red-500 bg-red-100">
              <i class="pi pi-exclamation-triangle text-xl" aria-hidden="true"></i>
            </div>
            <div>
              <span class="text-color-secondary text-sm font-medium block">{{ t('dashboard.criticalDelinquency') }}</span>
              <strong class="text-2xl text-red-500">
                S/ {{ isLoading ? '...' : kpi.totalDebt.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
              </strong>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Main row: incidents table + chart -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <!-- Recent Incidents Table -->
      <div class="lg:col-span-7 col-span-12 w-full">
        <Card class="h-full">
          <template #title>
            <div class="flex align-items-center gap-2 text-lg">
              <i class="pi pi-flag text-color-secondary" aria-hidden="true"></i>
              {{ t('dashboard.recentIncidents') }}
            </div>
          </template>
          <template #content>
            <DataTable
              :value="recentIncidents"
              responsiveLayout="scroll"
              :loading="isLoading"
              class="p-datatable-sm"
            >
              <Column field="description" :header="t('app.incidentDescription')" />
              <Column field="residentName" :header="t('app.incidentResidentName')" />
              <Column :header="t('app.incidentDate')">
                <template #body="{ data }">
                  {{ data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '' }}
                </template>
              </Column>
              <Column :header="t('dashboard.incidentStatus')">
                <template #body="{ data }">
                  <Tag
                    :value="incidentStatusLabel(data.status)"
                    :severity="incidentSeverity(data.status)"
                    rounded
                  />
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>

      <!-- Bar Chart -->
      <div class="lg:col-span-5 col-span-12 w-full">
        <Card class="h-full">
          <template #title>
            <div class="flex align-items-center gap-2 text-lg">
              <i class="pi pi-chart-bar text-color-secondary" aria-hidden="true"></i>
              {{ t('dashboard.financialOverview') }}
            </div>
          </template>
          <template #content>
            <div style="height: 300px; position: relative;">
              <Chart type="bar" :data="chartData" :options="chartOptions" style="height: 100%;" />
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-container {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.kpi-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Ensure grid classes map to standard flex / grid properties if PrimeFlex handles it or we use raw CSS */
.grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
.lg\:grid-cols-4 { @media (min-width: 1024px) { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.lg\:grid-cols-12 { @media (min-width: 1024px) { grid-template-columns: repeat(12, minmax(0, 1fr)); } }
.lg\:col-span-7 { @media (min-width: 1024px) { grid-column: span 7 / span 7; } }
.lg\:col-span-5 { @media (min-width: 1024px) { grid-column: span 5 / span 5; } }
.col-span-12 { grid-column: span 12 / span 12; }
.w-full { width: 100%; }
.h-full { height: 100%; }

:deep(.p-card-body) {
  padding: 1.25rem;
}

:deep(.p-card-content) {
  padding: 0;
}
</style>
