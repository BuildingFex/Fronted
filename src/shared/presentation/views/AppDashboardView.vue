<script setup>
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Chart from 'primevue/chart'
import { financesApi } from '@/finances/infrastructure/financesApi.js'
import { incidentsApi } from '@/incidents/infrastructure/incidentsApi.js'

const { t, locale } = useI18n()

const kpi = ref({
  totalResidents: 0,
  occupiedUnits: 0,
  emptyUnits: 0,
  totalDebt: 0,
})

const recentIncidents = ref([])
const isLoading = ref(true)

const nfPen = computed(
  () => (value) =>
    new Intl.NumberFormat(locale.value === 'es' ? 'es-PE' : 'en-US', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0),
)

onMounted(async () => {
  try {
    const [kpiData, incidentsData] = await Promise.all([
      financesApi.getDashboardKpis(),
      incidentsApi.list(),
    ])

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
      recentIncidents.value = incidentsData.slice(0, 5)
    }
  } catch (error) {
    console.error('Error loading dashboard data:', error)
  } finally {
    isLoading.value = false
  }
})

function incidentSeverity(status) {
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

function incidentStatusLabel(status) {
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

const nfDate = computed(
  () => (iso) => {
    const s = String(iso ?? '').trim()
    if (!s) return ''
    const d = new Date(s)
    if (!Number.isFinite(d.getTime())) return s
    const loc = locale.value === 'es' ? 'es-PE' : 'en-US'
    return new Intl.DateTimeFormat(loc, { dateStyle: 'medium' }).format(d)
  },
)

const chartData = ref({
  labels: ['Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May'],
  datasets: [
    {
      label: t('dashboard.income'),
      backgroundColor: 'rgba(52, 199, 89, 0.45)',
      borderColor: '#34c759',
      borderWidth: 1,
      borderRadius: 6,
      data: [18500, 19200, 17800, 20100, 19800, 21000],
    },
    {
      label: t('dashboard.expenses'),
      backgroundColor: 'rgba(255, 59, 48, 0.4)',
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
        padding: 16,
        font: { size: 11, weight: '500' },
        color: '#6e6e73',
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
      grid: { color: 'rgba(0,0,0,0.05)' },
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
  <div class="app-view">
    <h1 class="app-view__title">{{ t('dashboard.title') }}</h1>
    <p class="app-view__subtitle">{{ t('dashboard.subtitle') }}</p>

    <div class="finance-page">
      <section class="finance-panel import-panel" aria-labelledby="dashboard-kpi-heading">
        <h2 id="dashboard-kpi-heading" class="finance-panel__section-title">
          {{ t('dashboard.financialOverview') }}
        </h2>
        <div class="dashboard-kpi-grid">
          <div class="dashboard-kpi">
            <span class="dashboard-kpi__label">{{ t('dashboard.totalResidents') }}</span>
            <strong class="dashboard-kpi__value">{{ isLoading ? '…' : kpi.totalResidents }}</strong>
          </div>
          <div class="dashboard-kpi">
            <span class="dashboard-kpi__label">{{ t('dashboard.occupiedUnits') }}</span>
            <strong class="dashboard-kpi__value">{{ isLoading ? '…' : kpi.occupiedUnits }}</strong>
          </div>
          <div class="dashboard-kpi">
            <span class="dashboard-kpi__label">{{ t('dashboard.emptyUnits') }}</span>
            <strong class="dashboard-kpi__value">{{ isLoading ? '…' : kpi.emptyUnits }}</strong>
          </div>
          <div class="dashboard-kpi dashboard-kpi--debt">
            <span class="dashboard-kpi__label">{{ t('dashboard.criticalDelinquency') }}</span>
            <strong class="dashboard-kpi__value dashboard-kpi__value--debt">{{
              isLoading ? '…' : nfPen(kpi.totalDebt)
            }}</strong>
          </div>
        </div>
      </section>

      <section
        class="finance-panel finance-panel--table import-panel"
        aria-labelledby="dashboard-incidents-heading"
      >
        <h2 id="dashboard-incidents-heading" class="finance-panel__section-title">
          {{ t('dashboard.recentIncidents') }}
        </h2>
        <DataTable
          :value="recentIncidents"
          responsiveLayout="scroll"
          :loading="isLoading"
          class="finance-data finance-table"
        >
          <Column field="description" :header="t('app.incidentDescription')" />
          <Column field="residentName" :header="t('app.incidentResidentName')" />
          <Column :header="t('app.incidentDate')">
            <template #body="{ data }">
              <span class="finance-date-cell">{{ nfDate(data.createdAt) }}</span>
            </template>
          </Column>
          <Column :header="t('dashboard.incidentStatus')">
            <template #body="{ data }">
              <Tag
                class="dashboard-status-tag"
                :value="incidentStatusLabel(data.status)"
                :severity="incidentSeverity(data.status)"
                rounded
              />
            </template>
          </Column>
        </DataTable>
      </section>

      <section
        class="finance-panel finance-panel--calendar import-panel chart-panel"
        aria-labelledby="dashboard-chart-heading"
      >
        <h2 id="dashboard-chart-heading" class="finance-panel__section-title">
          {{ t('dashboard.income') }} / {{ t('dashboard.expenses') }}
        </h2>
        <div class="dashboard-chart-wrap">
          <Chart type="bar" :data="chartData" :options="chartOptions" class="dashboard-chart" />
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

.finance-panel--calendar {
  background: #fafafa;
}

.finance-panel--table {
  padding: 1.2rem 1.25rem 1.35rem;
  overflow: hidden;
}

.import-panel .finance-table {
  margin-top: 0.65rem;
}

.chart-panel .dashboard-chart-wrap {
  margin-top: 0.65rem;
}

.dashboard-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
  gap: 0.75rem;
}

.dashboard-kpi {
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.dashboard-kpi--debt {
  background: #fff5f5;
  border-color: rgba(255, 59, 48, 0.18);
}

.dashboard-kpi__label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.055em;
  text-transform: uppercase;
  color: #86868b;
}

.dashboard-kpi__value {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--apple-text, #1d1d1f);
}

.dashboard-kpi__value--debt {
  color: #d70015;
}

.chart-panel {
  width: 100%;
}

.finance-table {
  margin-top: 0.15rem;
}

.finance-data :deep(.p-datatable) {
  font-size: 0.875rem;
  border: none;
  border-radius: 12px;
  overflow: hidden;
}

.finance-data :deep(.p-datatable-wrapper) {
  border-radius: 12px;
}

.finance-data :deep(.p-datatable-header) {
  background: transparent;
  border: none;
  padding: 0;
}

.finance-data :deep(.p-datatable-loading-overlay) {
  background: rgba(255, 255, 255, 0.75);
}

.finance-data :deep(.p-datatable-thead > tr > th) {
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

.finance-data :deep(.p-datatable-tbody > tr) {
  background: transparent;
  transition: background 0.12s ease;
}

.finance-data :deep(.p-datatable-tbody > tr:hover) {
  background: rgba(0, 0, 0, 0.02);
}

.finance-data :deep(.p-datatable-tbody > tr > td) {
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 0.7rem 0.75rem;
  vertical-align: middle;
  color: var(--apple-text, #1d1d1f);
}

.finance-data :deep(.p-datatable-tbody > tr:last-child > td) {
  border-bottom: none;
}

.finance-date-cell {
  font-weight: 500;
  color: var(--apple-text, #1d1d1f);
}

.dashboard-status-tag :deep(.p-tag) {
  border-radius: 980px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 0.3rem 0.65rem;
}

.dashboard-chart-wrap {
  height: 280px;
  position: relative;
}

.dashboard-chart {
  height: 100%;
}
</style>
