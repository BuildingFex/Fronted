<script setup>
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Chart from 'primevue/chart'
import { financesApi } from '@/finances/infrastructure/financesApi.js'
import { adminManagementExpensesApi } from '@/finances/infrastructure/adminManagementExpensesApi.js'
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
const chartHasData = ref(false)

const nfPen = computed(
  () => (value) =>
    new Intl.NumberFormat(locale.value === 'es' ? 'es-PE' : 'en-US', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0),
)

function monthLabelFromKey(monthKey) {
  const [year, month] = String(monthKey ?? '').split('-').map(Number)
  if (!year || !month) return String(monthKey ?? '')
  const loc = locale.value === 'es' ? 'es-PE' : 'en-US'
  return new Intl.DateTimeFormat(loc, { month: 'short' }).format(new Date(year, month - 1, 1))
}

function buildChartFromMonthlyApi(monthlyChart) {
  const rows = Array.isArray(monthlyChart) ? monthlyChart : []
  const labels = rows.map((row) => monthLabelFromKey(row.monthKey))
  const incomeData = rows.map((row) => Number(row.income) || 0)
  const expenseData = rows.map((row) => Number(row.expenses) || 0)
  const hasData = incomeData.some((v) => v > 0) || expenseData.some((v) => v > 0)
  return { labels, incomeData, expenseData, hasData }
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthKeyFromIso(value) {
  const raw = String(value ?? '').trim()
  return raw.length >= 7 ? raw.slice(0, 7) : ''
}

function buildChartFromTransactions(payments, expenses, receipts) {
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i -= 1) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1))
  }

  const labels = months.map((m) => monthLabelFromKey(monthKeyFromDate(m)))

  const incomeData = months.map((m) => {
    const key = monthKeyFromDate(m)
    const fromPayments = (payments ?? [])
      .filter((p) => monthKeyFromIso(p.paidAt) === key)
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
    if (fromPayments > 0) return fromPayments
    return (receipts ?? [])
      .filter((r) => r.status === 'Paid' && monthKeyFromIso(r.issueDate) === key)
      .reduce((sum, r) => sum + Number(r.amount ?? 0) + Number(r.lateFee ?? 0) + Number(r.extraCharges ?? 0), 0)
  })

  const expenseData = months.map((m) => {
    const key = monthKeyFromDate(m)
    return (expenses ?? [])
      .filter((e) => monthKeyFromIso(e.purchaseDate) === key)
      .reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
  })

  const hasData = incomeData.some((v) => v > 0) || expenseData.some((v) => v > 0)
  return { labels, incomeData, expenseData, hasData }
}

const chartData = ref({
  labels: [],
  datasets: [
    {
      label: t('dashboard.income'),
      backgroundColor: 'rgba(52, 199, 89, 0.45)',
      borderColor: '#34c759',
      borderWidth: 1,
      borderRadius: 6,
      data: [],
    },
    {
      label: t('dashboard.expenses'),
      backgroundColor: 'rgba(255, 59, 48, 0.4)',
      borderColor: '#ff3b30',
      borderWidth: 1,
      borderRadius: 6,
      data: [],
    },
  ],
})

function applyChartData({ labels, incomeData, expenseData, hasData }) {
  chartHasData.value = hasData
  chartData.value = {
    labels,
    datasets: [
      { ...chartData.value.datasets[0], label: t('dashboard.income'), data: incomeData },
      { ...chartData.value.datasets[1], label: t('dashboard.expenses'), data: expenseData },
    ],
  }
}

async function loadAdminChart(kpiData) {
  const fromApi = buildChartFromMonthlyApi(kpiData?.monthlyChart)
  if (fromApi.hasData) {
    applyChartData(fromApi)
    return
  }

  const [payments, expenses, receipts] = await Promise.all([
    financesApi.getAllPayments(),
    adminManagementExpensesApi.list(),
    financesApi.getReceipts(),
  ])
  applyChartData(buildChartFromTransactions(payments, expenses, receipts))
}

onMounted(async () => {
  try {
    const [kpiData, incidentsData] = await Promise.all([
      financesApi.getDashboardKpis(),
      incidentsApi.list(),
    ])

    if (kpiData && typeof kpiData === 'object') {
      kpi.value = {
        totalResidents: Number(kpiData.totalResidents) || 0,
        occupiedUnits: Number(kpiData.occupiedUnits) || 0,
        emptyUnits: Number(kpiData.emptyUnits) || 0,
        totalDebt: Number(kpiData.totalDebt ?? kpiData.totalPendingDebt) || 0,
      }

      await loadAdminChart(kpiData)
    }

    if (Array.isArray(incidentsData)) {
      recentIncidents.value = [...incidentsData]
        .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
        .slice(0, 5)
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
        callback: (v) => (v >= 1000 ? `S/ ${(v / 1000).toFixed(0)}k` : `S/ ${v}`),
      },
    },
  },
})
</script>

<template>
  <div class="app-view">
    <div class="page-header">
      <h1 class="page-title">{{ t('dashboard.title') }}</h1>
      <p class="page-subtitle">{{ t('dashboard.subtitle') }}</p>
    </div>

    <div class="finance-page">
      <section class="finance-panel" aria-labelledby="dashboard-kpi-heading">
        <h2 id="dashboard-kpi-heading" class="finance-panel__section-title mb-4">
          {{ t('dashboard.financialOverview') }}
        </h2>
        
        <!-- Premium KPI Grid -->
        <div class="kpi-grid custom-scrollbar">
          <!-- Card 1: Total Residents -->
          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon icon-blue">
                <i class="pi pi-users" aria-hidden="true"></i>
              </div>
              <span class="kpi-label">{{ t('dashboard.totalResidents') }}</span>
            </div>
            <div class="kpi-value">{{ isLoading ? '…' : kpi.totalResidents }}</div>
            <span class="kpi-subtext">
              <i class="pi pi-verified" aria-hidden="true"></i> Usuarios registrados
            </span>
          </div>

          <!-- Card 2: Occupied Units -->
          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon icon-green">
                <i class="pi pi-building" aria-hidden="true"></i>
              </div>
              <span class="kpi-label">{{ t('dashboard.occupiedUnits') }}</span>
            </div>
            <div class="kpi-value">{{ isLoading ? '…' : kpi.occupiedUnits }}</div>
            <span class="kpi-subtext">
              <i class="pi pi-check-circle" aria-hidden="true"></i> Departamentos activos
            </span>
          </div>

          <!-- Card 3: Empty Units -->
          <div class="kpi-card">
            <div class="kpi-header">
              <div class="kpi-icon icon-orange">
                <i class="pi pi-home" aria-hidden="true"></i>
              </div>
              <span class="kpi-label">{{ t('dashboard.emptyUnits') }}</span>
            </div>
            <div class="kpi-value">{{ isLoading ? '…' : kpi.emptyUnits }}</div>
            <span class="kpi-subtext">
              <i class="pi pi-info-circle" aria-hidden="true"></i> Disponibles
            </span>
          </div>

          <!-- Card 4: Critical Delinquency -->
          <div class="kpi-card card-danger">
            <div class="kpi-header">
              <div class="kpi-icon icon-red">
                <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
              </div>
              <span class="kpi-label">{{ t('dashboard.criticalDelinquency') }}</span>
            </div>
            <div class="kpi-value text-red">{{ isLoading ? '…' : nfPen(kpi.totalDebt) }}</div>
            <span class="kpi-subtext subtext-red">
              <i class="pi pi-arrow-up" aria-hidden="true"></i> Deuda acumulada
            </span>
          </div>
        </div>
      </section>

      <div class="grid-layout">
        <!-- Incidents Table -->
        <section class="finance-panel flex-1" aria-labelledby="dashboard-incidents-heading">
          <h2 id="dashboard-incidents-heading" class="finance-panel__section-title mb-3">
            {{ t('dashboard.recentIncidents') }}
          </h2>
          
          <p v-if="!recentIncidents.length && !isLoading" class="text-center text-color-secondary my-5">
            No hay incidentes reportados recientemente.
          </p>
          
          <DataTable
            v-else
            :value="recentIncidents"
            responsiveLayout="scroll"
            :loading="isLoading"
            class="premium-table"
          >
            <Column field="description" :header="t('app.incidentDescription')" />
            <Column field="residentName" :header="t('app.incidentResidentName')">
              <template #body="{ data }">
                <span class="font-semibold">{{ data.residentName }}</span>
              </template>
            </Column>
            <Column :header="t('app.incidentDate')">
              <template #body="{ data }">
                <span class="text-500">{{ nfDate(data.createdAt) }}</span>
              </template>
            </Column>
            <Column :header="t('dashboard.incidentStatus')">
              <template #body="{ data }">
                <Tag
                  class="px-3"
                  :value="incidentStatusLabel(data.status)"
                  :severity="incidentSeverity(data.status)"
                  rounded
                />
              </template>
            </Column>
          </DataTable>
        </section>

        <!-- Income/Expenses Chart -->
        <section class="finance-panel flex-1" aria-labelledby="dashboard-chart-heading">
          <h2 id="dashboard-chart-heading" class="finance-panel__section-title mb-3">
            {{ t('dashboard.income') }} / {{ t('dashboard.expenses') }}
          </h2>
          <div class="dashboard-chart-wrap">
            <p v-if="!isLoading && !chartHasData" class="dashboard-chart-empty">
              {{ t('dashboard.chartEmpty') }}
            </p>
            <Chart
              v-else
              type="bar"
              :data="chartData"
              :options="chartOptions"
              class="dashboard-chart"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-view {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* Page Header */
.page-header {
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: var(--surface-900);
  letter-spacing: -0.02em;
}
.page-subtitle {
  margin: 0;
  font-size: 1.125rem;
  color: var(--surface-500);
}

.finance-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.finance-panel {
  padding: 1.5rem;
  border-radius: 16px;
  background: var(--surface-0, #ffffff);
  border: 1px solid var(--surface-200, #e2e8f0);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
}

.finance-panel__section-title {
  margin: 0 0 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--surface-900);
}

/* KPI GRID CSS */
.kpi-grid {
  display: flex;
  flex-direction: row;
  gap: 1.25rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.kpi-card {
  flex: 1;
  min-width: 250px;
  background: var(--surface-0, #ffffff);
  border: 1px solid var(--surface-200, #e2e8f0);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
}

.kpi-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.kpi-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 1rem;
  font-size: 1.2rem;
}

.icon-blue { background: #e0f2fe; color: #0284c7; }
.icon-green { background: #dcfce7; color: #16a34a; }
.icon-orange { background: #ffedd5; color: #ea580c; }
.icon-red { background: #fee2e2; color: #dc2626; }

.kpi-label {
  color: var(--surface-500, #64748b);
  font-weight: 500;
  font-size: 0.9rem;
}

.kpi-value {
  color: var(--surface-900, #0f172a);
  font-weight: 700;
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}

.kpi-subtext {
  color: var(--surface-500, #64748b);
  font-size: 0.8rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.subtext-red { color: #dc2626; }
.text-red { color: #dc2626 !important; }
.card-danger { background: #fff5f5; border-color: #fecaca; }

.custom-scrollbar::-webkit-scrollbar {
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--surface-300);
  border-radius: 10px;
}

.grid-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
@media (min-width: 1024px) {
  .grid-layout {
    flex-direction: row;
  }
}

/* Premium DataTable Styling */
.premium-table :deep(.p-datatable-header) {
  background: transparent;
  border: none;
}
.premium-table :deep(.p-datatable-thead > tr > th) {
  background: transparent;
  color: var(--surface-500);
  font-weight: 500;
  font-size: 0.85rem;
  text-transform: capitalize;
  border: none;
  border-bottom: 1px solid var(--surface-200);
  padding: 1rem;
}
.premium-table :deep(.p-datatable-tbody > tr) {
  background: transparent;
}
.premium-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--surface-50);
}
.premium-table :deep(.p-datatable-tbody > tr > td) {
  border: none;
  border-bottom: 1px solid var(--surface-100);
  padding: 1rem;
  vertical-align: middle;
}
.premium-table :deep(.p-datatable-wrapper) {
  border-radius: 12px;
}

.dashboard-chart-wrap {
  height: 300px;
  position: relative;
}
.dashboard-chart-empty {
  margin: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--surface-500, #64748b);
  font-size: 0.9375rem;
  padding: 1rem;
}
.dashboard-chart {
  height: 100%;
}
</style>
