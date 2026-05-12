<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSession } from '@/iam/application/sessionStore.js'
import { reservationsApi } from '@/socialSpaces/infrastructure/reservationsApi.js'
import { spacesApi } from '@/socialSpaces/infrastructure/spacesApi.js'
import { announcementsApi } from '@/information/infrastructure/announcementsApi.js'
import { incidentsApi } from '@/incidents/infrastructure/incidentsApi.js'
import { useResidentPaymentStore } from '@/finances/application/residentPaymentStore.js'
import Tag from 'primevue/tag'

const { t } = useI18n()
const { state: sessionState } = useSession()
const { state: paymentState, loadData: loadFinanceData } = useResidentPaymentStore()

const profile = computed(() => sessionState.profile ?? {})

// --- Data State ---
const reservations = ref([])
const spacesById = ref(new Map())
const isLoadingReservations = ref(false)

const announcements = ref([])
const isLoadingAnnouncements = ref(false)

const incidents = ref([])
const isLoadingIncidents = ref(false)

// --- Carousel & Modal State ---
const currentIndex = ref(0)
const showAllAnnouncements = ref(false)
const showAllIncidents = ref(false)
const showAllReservations = ref(false)

const todayIso = new Date().toISOString().slice(0, 10)

// --- Computed Data ---
const allUpcomingReservations = computed(() => {
  return reservations.value
    .filter((r) => r.date >= todayIso)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.startTime.localeCompare(b.startTime)
    })
})

const todayReservations = computed(() => {
  return allUpcomingReservations.value.filter(r => r.date === todayIso)
})

const otherUpcomingReservations = computed(() => {
  return allUpcomingReservations.value.filter(r => r.date > todayIso)
})

const dashboardReservations = computed(() => {
  // Show all today's, and if less than 3, fill with upcoming
  const combined = [...todayReservations.value]
  if (combined.length < 3) {
    combined.push(...otherUpcomingReservations.value.slice(0, 3 - combined.length))
  }
  return combined
})

const activeAnnouncements = computed(() =>
  announcements.value.filter((a) => !a.expiresAt || new Date() < new Date(a.expiresAt))
)

const currentAnnouncement = computed(() => activeAnnouncements.value[currentIndex.value] ?? null)

const incidentsSummary = computed(() => {
  const summary = { open: 0, inProgress: 0, resolved: 0 }
  incidents.value.forEach(i => {
    if (i.status === 'open') summary.open++
    else if (i.status === 'in-progress') summary.inProgress++
    else if (i.status === 'resolved') summary.resolved++
  })
  return summary
})

const financeSummary = computed(() => {
  const fees = paymentState.fees || []
  const paid = fees.filter(f => f.status === 'Pagado').reduce((sum, f) => sum + f.amount, 0)
  const pending = fees.filter(f => f.status === 'Pendiente').reduce((sum, f) => sum + f.amount, 0)
  
  // Checking overdue
  const overdue = fees.filter(f => {
    if (f.status !== 'Pendiente') return false
    const due = new Date(f.dueDate + 'T00:00:00')
    const now = new Date(todayIso + 'T00:00:00')
    return due < now
  }).reduce((sum, f) => sum + f.amount, 0)

  return { paid, pending, overdue, total: paid + pending }
})

// --- Methods ---
function prevAnn() {
  if (currentIndex.value > 0) currentIndex.value--
  else currentIndex.value = Math.max(0, activeAnnouncements.value.length - 1)
}

function nextAnn() {
  if (currentIndex.value < activeAnnouncements.value.length - 1) currentIndex.value++
  else currentIndex.value = 0
}

function spaceNameFor(reservation) {
  return spacesById.value.get(reservation.spaceId)?.name ?? t('app.spaceFallbackName')
}

function priorityClass(priority) {
  return `ann-badge--${priority}`
}

function priorityLabel(priority) {
  const map = {
    normal: t('information.priorityNormal'),
    important: t('information.priorityImportant'),
    urgent: t('information.priorityUrgent'),
  }
  return map[priority] ?? map.normal
}

function formatCurrency(val) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(val)
}

function getIncidentSeverity(status) {
  if (status === 'open') return 'danger'
  if (status === 'in-progress') return 'warn'
  if (status === 'resolved') return 'success'
  return 'info'
}

function isExpired(iso) {
  if (!iso) return false
  return new Date() > new Date(iso)
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatExpiry(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function durationLabel(days) {
  if (!days) return ''
  if (days === 7)  return t('information.duration7')
  if (days === 15) return t('information.duration15')
  if (days === 30) return t('information.duration30')
  return `${days} ${t('information.durationDays')}`
}

// --- Chart Logic ---
const chartCanvas = ref(null)

function drawChart() {
  const ctx = chartCanvas.value?.getContext('2d')
  if (!ctx) return

  const { paid, pending, overdue } = financeSummary.value
  const total = paid + pending
  if (total === 0) return

  const width = chartCanvas.value.width
  const height = chartCanvas.value.height
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 2 - 10

  ctx.clearRect(0, 0, width, height)

  // Slices
  const data = [
    { val: paid, color: '#34c759' }, // Green
    { val: pending - overdue, color: '#ff9500' }, // Orange
    { val: overdue, color: '#ff3b30' } // Red
  ]

  let startAngle = -Math.PI / 2
  data.forEach(item => {
    if (item.val <= 0) return
    const sliceAngle = (item.val / total) * 2 * Math.PI
    
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle)
    ctx.closePath()
    ctx.fillStyle = item.color
    ctx.fill()
    
    // White border between slices
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    startAngle += sliceAngle
  })

  // Inner circle for donut effect
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius * 0.7, 0, 2 * Math.PI)
  ctx.fillStyle = '#fff'
  ctx.fill()
}

// Draw chart whenever finance data changes or on mount
watch(() => financeSummary.value, () => {
  setTimeout(drawChart, 100)
}, { deep: true })

async function loadInitialData() {
  if (!profile.value.id) return
  
  isLoadingReservations.value = true
  isLoadingAnnouncements.value = true
  isLoadingIncidents.value = true

  try {
    const [resList, spaces, annList, allIncidents] = await Promise.all([
      reservationsApi.listByResident(profile.value.id),
      spacesApi.list(),
      announcementsApi.list(),
      incidentsApi.list()
    ])

    reservations.value = resList
    spacesById.value = new Map(spaces.map(s => [s.id, s]))
    announcements.value = annList
    incidents.value = allIncidents.filter(i => i.residentId === profile.value.id)
    
    // Load finance data
    loadFinanceData(profile.value.id)
  } catch (err) {
    console.error('Error loading dashboard data', err)
  } finally {
    isLoadingReservations.value = false
    isLoadingAnnouncements.value = false
    isLoadingIncidents.value = false
  }
}

onMounted(() => {
  loadInitialData()
})
</script>

<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <div>
        <h1 class="dashboard-title">{{ t('resident.dashboardTitle') }}</h1>
        <p class="dashboard-subtitle">{{ t('resident.dashboardSubtitle') }}</p>
      </div>
      <div class="welcome-badge">
        <i class="pi pi-user" />
        <span>{{ t('resident.welcome', { name: profile.name || '' }) }}</span>
      </div>
    </header>

    <div class="bento-grid">
      <!-- KPI: Pending Finance -->
      <div class="bento-item kpi-item kpi-item--pending">
        <div class="kpi-icon">
          <i class="pi pi-wallet" />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">{{ t('resident.kpiPendingAmount') }}</span>
          <span class="kpi-value">{{ formatCurrency(financeSummary.pending) }}</span>
        </div>
        <div v-if="financeSummary.overdue > 0" class="kpi-badge kpi-badge--danger">
          {{ t('resident.financeChartOverdue') }}
        </div>
      </div>

      <!-- KPI: Open Incidents -->
      <div class="bento-item kpi-item kpi-item--incidents">
        <div class="kpi-icon">
          <i class="pi pi-exclamation-circle" />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">{{ t('resident.kpiOpenIncidents') }}</span>
          <span class="kpi-value">{{ incidentsSummary.open }}</span>
        </div>
      </div>

      <!-- KPI: Reservations -->
      <div class="bento-item kpi-item kpi-item--reservations">
        <div class="kpi-icon">
          <i class="pi pi-calendar" />
        </div>
        <div class="kpi-content">
          <span class="kpi-label">{{ t('resident.kpiUpcomingReservations') }}</span>
          <span class="kpi-value">{{ allUpcomingReservations.length }}</span>
        </div>
      </div>

      <!-- Finance Chart Section -->
      <div class="bento-item chart-section">
        <h2 class="section-title">{{ t('resident.financeChartTitle') }}</h2>
        <div class="chart-container">
          <div v-if="financeSummary.total > 0" class="chart-flex">
            <div class="canvas-wrapper">
              <canvas ref="chartCanvas" width="160" height="160"></canvas>
              <div class="chart-center-text">
                <span class="center-percent">{{ Math.round((financeSummary.paid / financeSummary.total) * 100) }}%</span>
                <span class="center-label">{{ t('resident.financeChartPaid') }}</span>
              </div>
            </div>
            <div class="chart-legend">
              <div class="legend-item">
                <span class="dot dot--paid"></span>
                <span class="label">{{ t('resident.financeChartPaid') }}</span>
                <span class="val">{{ formatCurrency(financeSummary.paid) }}</span>
              </div>
              <div class="legend-item">
                <span class="dot dot--pending"></span>
                <span class="label">{{ t('resident.financeChartPending') }}</span>
                <span class="val">{{ formatCurrency(financeSummary.pending - financeSummary.overdue) }}</span>
              </div>
              <div class="legend-item">
                <span class="dot dot--overdue"></span>
                <span class="label">{{ t('resident.financeChartOverdue') }}</span>
                <span class="val">{{ formatCurrency(financeSummary.overdue) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="chart-empty">
            <i class="pi pi-chart-pie" />
            <p>{{ t('resident.financeChartEmpty') }}</p>
          </div>
        </div>
      </div>

      <!-- Announcements Carousel -->
      <div class="bento-item announcements-section">
        <div class="section-header">
          <h2 class="section-title">
            <i class="pi pi-megaphone" />
            {{ t('resident.announcementsTitle') }}
          </h2>
          <button v-if="activeAnnouncements.length > 0" class="btn-see-all" @click="showAllAnnouncements = true">
            <i class="pi pi-external-link" />
            {{ t('information.seeAll') }}
          </button>
        </div>

        <div v-if="isLoadingAnnouncements" class="loading-state">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <div v-else-if="activeAnnouncements.length === 0" class="empty-state">
          <p>{{ t('resident.announcementsEmpty') }}</p>
        </div>
        <div v-else class="carousel-wrapper">
          <button class="nav-btn prev" @click="prevAnn" :disabled="activeAnnouncements.length <= 1">
            <i class="pi pi-chevron-left" />
          </button>
          
          <Transition name="fade" mode="out-in">
            <div :key="currentIndex" class="announcement-card" :class="priorityClass(currentAnnouncement.priority)">
              <div class="ann-header">
                <span class="ann-badge" :class="priorityClass(currentAnnouncement.priority)">
                  {{ priorityLabel(currentAnnouncement.priority) }}
                </span>
                <span class="ann-author">{{ currentAnnouncement.authorName }}</span>
              </div>
              <h3 class="ann-title">{{ currentAnnouncement.title }}</h3>
              <p class="ann-body">{{ currentAnnouncement.body }}</p>
            </div>
          </Transition>

          <button class="nav-btn next" @click="nextAnn" :disabled="activeAnnouncements.length <= 1">
            <i class="pi pi-chevron-right" />
          </button>
        </div>
        
        <div v-if="activeAnnouncements.length > 1" class="carousel-dots">
          <span 
            v-for="(_, i) in activeAnnouncements" 
            :key="i" 
            class="dot" 
            :class="{ active: i === currentIndex }"
            @click="currentIndex = i"
          ></span>
        </div>
      </div>

      <!-- ── SEE-ALL ANNOUNCEMENTS MODAL ── -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showAllAnnouncements" class="modal-overlay" @click.self="showAllAnnouncements = false">
            <div class="modal-content" role="dialog" :aria-label="t('information.allAnnouncementsTitle')">
              <header class="modal-header">
                <h2 class="modal-title">
                  <i class="pi pi-megaphone" aria-hidden="true" style="margin-right:0.4rem;color:#0071e3" />
                  {{ t('information.allAnnouncementsTitle') }}
                </h2>
                <button
                  type="button"
                  class="modal-close"
                  @click="showAllAnnouncements = false"
                >
                  <i class="pi pi-times" />
                </button>
              </header>

              <div class="modal-body">
                <article
                  v-for="ann in announcements"
                  :key="ann.id"
                  class="ann-all-item"
                  :class="{
                    'ann-all-item--urgent': ann.priority === 'urgent',
                    'ann-all-item--expired': isExpired(ann.expiresAt),
                  }"
                >
                  <div class="ann-all-item__top">
                    <span class="ann-badge" :class="priorityClass(ann.priority)">
                      {{ priorityLabel(ann.priority) }}
                    </span>
                    <div class="ann-all-item__meta">
                      <span v-if="ann.duration" class="ann-duration-tag">
                        <i class="pi pi-clock" />
                        {{ durationLabel(ann.duration) }}
                      </span>
                      <span v-if="isExpired(ann.expiresAt)" class="ann-expired-tag">
                        {{ t('information.expired') }}
                      </span>
                    </div>
                  </div>
                  <h3 class="ann-all-item__title">{{ ann.title }}</h3>
                  <p class="ann-all-item__body">{{ ann.body }}</p>
                  <div class="ann-all-item__footer">
                    <span class="ann-author">
                      <i class="pi pi-user" />
                      {{ ann.authorName }}
                    </span>
                    <div class="ann-dates">
                      <time class="ann-created">{{ formatDate(ann.createdAt) }}</time>
                      <span v-if="ann.expiresAt" class="ann-expiry">
                        <i class="pi pi-calendar-times" />
                        {{ t('information.expiresOn', { date: formatExpiry(ann.expiresAt) }) }}
                      </span>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <div class="bento-item reservations-section">
        <div class="section-header">
          <h2 class="section-title">{{ t('resident.reservationsReminderTitle') }}</h2>
          <button v-if="allUpcomingReservations.length > 0" class="btn-see-all" @click="showAllReservations = true">
            <i class="pi pi-external-link" />
            {{ t('information.seeAll') }}
          </button>
        </div>
        <div v-if="isLoadingReservations" class="loading-state">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <div v-else-if="allUpcomingReservations.length === 0" class="empty-state">
          <i class="pi pi-calendar-times" />
          <p>{{ t('resident.reservationsReminderEmpty') }}</p>
        </div>
        <div v-else class="res-list">
          <!-- Today's Section (if any) -->
          <div v-if="todayReservations.length > 0" class="res-group-label">{{ t('importView.today') }}</div>
          <div v-for="res in todayReservations.slice(0, 3)" :key="'today-' + res.id" class="res-item res-item--today">
            <div class="res-info">
              <span class="res-space">{{ spaceNameFor(res) }}</span>
              <span class="res-time">{{ res.startTime }} - {{ res.endTime }}</span>
            </div>
            <div class="res-date">
              {{ res.date }}
            </div>
          </div>

          <!-- Other Upcoming (if needed to fill) -->
          <div v-if="otherUpcomingReservations.length > 0 && todayReservations.length < 3" class="res-group-label" style="margin-top: 0.5rem">
            {{ t('resident.kpiUpcomingReservations') }}
          </div>
          <div v-for="res in otherUpcomingReservations.slice(0, Math.max(0, 3 - todayReservations.length))" :key="'other-' + res.id" class="res-item">
            <div class="res-info">
              <span class="res-space">{{ spaceNameFor(res) }}</span>
              <span class="res-time">{{ res.startTime }} - {{ res.endTime }}</span>
            </div>
            <div class="res-date">
              {{ res.date }}
            </div>
          </div>
        </div>
      </div>

      <!-- Incidents Summary -->
      <div class="bento-item incidents-section">
        <div class="section-header">
          <h2 class="section-title">{{ t('resident.incidentsSummaryTitle') }}</h2>
          <button v-if="incidents.length > 0" class="btn-see-all" @click="showAllIncidents = true">
            <i class="pi pi-external-link" />
            {{ t('information.seeAll') }}
          </button>
        </div>
        <div v-if="isLoadingIncidents" class="loading-state">
          <i class="pi pi-spin pi-spinner" />
        </div>
        <div v-else-if="incidents.length === 0" class="empty-state">
          <p>{{ t('resident.incidentsEmpty') }}</p>
        </div>
        <div v-else class="inc-grid">
          <div class="inc-stat">
            <span class="count">{{ incidentsSummary.open }}</span>
            <span class="label">{{ t('resident.incidentsOpen') }}</span>
          </div>
          <div class="inc-stat">
            <span class="count">{{ incidentsSummary.inProgress }}</span>
            <span class="label">{{ t('resident.incidentsInProgress') }}</span>
          </div>
          <div class="inc-stat">
            <span class="count">{{ incidentsSummary.resolved }}</span>
            <span class="label">{{ t('resident.incidentsResolved') }}</span>
          </div>
        </div>
        <div class="inc-recent" v-if="incidents.length > 0">
          <div v-for="inc in incidents.slice(0, 3)" :key="inc.id" class="inc-item inc-item--dashboard">
            <div class="inc-info-main">
              <span class="inc-desc-text">{{ inc.description }}</span>
              <span class="inc-date-sub">{{ formatDate(inc.createdAt) }}</span>
            </div>
            <Tag :value="inc.status" :severity="getIncidentSeverity(inc.status)" class="inc-tag" />
          </div>
        </div>
      </div>
    </div>

    <!-- ── SEE-ALL INCIDENTS MODAL ── -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showAllIncidents" class="modal-overlay" @click.self="showAllIncidents = false">
          <div class="modal-content" role="dialog" :aria-label="t('resident.incidentsTitle')">
            <header class="modal-header">
              <h2 class="modal-title">
                <i class="pi pi-exclamation-circle" aria-hidden="true" style="margin-right:0.4rem;color:#ff3b30" />
                {{ t('resident.incidentsTitle') }}
              </h2>
              <button type="button" class="modal-close" @click="showAllIncidents = false">
                <i class="pi pi-times" />
              </button>
            </header>
            <div class="modal-body">
              <div v-for="inc in incidents" :key="inc.id" class="inc-all-item">
                <div class="inc-all-header">
                  <Tag :value="inc.status" :severity="getIncidentSeverity(inc.status)" />
                  <span class="inc-date">{{ formatDate(inc.createdAt) }}</span>
                </div>
                <p class="inc-all-desc">{{ inc.description }}</p>
                <div v-if="inc.provider" class="inc-provider">
                  <i class="pi pi-user-edit" /> {{ inc.provider }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── SEE-ALL RESERVATIONS MODAL ── -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showAllReservations" class="modal-overlay" @click.self="showAllReservations = false">
          <div class="modal-content" role="dialog" :aria-label="t('resident.reservationsReminderTitle')">
            <header class="modal-header">
              <h2 class="modal-title">
                <i class="pi pi-calendar" aria-hidden="true" style="margin-right:0.4rem;color:#34c759" />
                {{ t('resident.reservationsReminderTitle') }}
              </h2>
              <button type="button" class="modal-close" @click="showAllReservations = false">
                <i class="pi pi-times" />
              </button>
            </header>
            <div class="modal-body">
              <div v-for="res in allUpcomingReservations" :key="res.id" class="res-all-item">
                <div class="res-all-info">
                  <span class="res-space">{{ spaceNameFor(res) }}</span>
                  <span class="res-time">{{ res.startTime }} - {{ res.endTime }}</span>
                </div>
                <div class="res-date-badge">
                  {{ res.date }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  color: #1d1d1f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2.5rem;
}

.dashboard-title {
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.04em;
  margin: 0;
}

.dashboard-subtitle {
  color: #6e6e73;
  font-size: 1.1rem;
  margin: 0.5rem 0 0;
}

.welcome-badge {
  background: #f5f5f7;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.9rem;
}

/* Bento Grid */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto auto;
  gap: 1.5rem;
}

.bento-item {
  background: #fff;
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid #f2f2f7;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.bento-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
}

/* KPIs */
.kpi-item {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  position: relative;
}

.kpi-icon {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.kpi-item--pending .kpi-icon { background: #fff2e0; color: #ff9500; }
.kpi-item--incidents .kpi-icon { background: #ffebeb; color: #ff3b30; }
.kpi-item--reservations .kpi-icon { background: #e8f5e9; color: #34c759; }

.kpi-content {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 0.85rem;
  color: #86868b;
  font-weight: 500;
}

.kpi-value {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.kpi-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.kpi-badge--danger { background: #ff3b30; color: #fff; }

/* Chart Section */
.chart-section {
  grid-column: span 2;
  grid-row: span 1;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chart-flex {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.canvas-wrapper {
  position: relative;
  width: 160px;
  height: 160px;
}

.chart-center-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}

.center-percent {
  font-size: 1.5rem;
  font-weight: 700;
}

.center-label {
  font-size: 0.7rem;
  color: #86868b;
  text-transform: uppercase;
  font-weight: 600;
}

.chart-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot--paid { background: #34c759; }
.dot--pending { background: #ff9500; }
.dot--overdue { background: #ff3b30; }

.legend-item .label {
  font-size: 0.9rem;
  color: #6e6e73;
  flex: 1;
}

.legend-item .val {
  font-weight: 600;
  font-size: 0.95rem;
}

.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #86868b;
  gap: 1rem;
}

.chart-empty i { font-size: 3rem; opacity: 0.2; }

/* Announcements Carousel */
.announcements-section {
  grid-column: span 2;
  grid-row: span 1;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-see-all {
  background: #f0f7ff;
  border: 1px solid #d0e7ff;
  color: #0071e3;
  padding: 0.4rem 0.8rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s;
}

.btn-see-all:hover {
  background: #0071e3;
  color: #fff;
  border-color: #0071e3;
}

.carousel-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.nav-btn {
  background: #f5f5f7;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.nav-btn:hover:not(:disabled) { background: #e8e8ed; }
.nav-btn:disabled { opacity: 0.3; cursor: default; }

.announcement-card {
  flex: 1;
  padding: 1.25rem;
  border-radius: 16px;
  background: #fbfbfd;
  min-height: 120px;
  border-left: 4px solid #d2d2d7;
}

.announcement-card.ann-badge--urgent { border-left-color: #ff3b30; background: #fff8f8; }
.announcement-card.ann-badge--important { border-left-color: #ff9500; background: #fffaf2; }

.ann-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.ann-badge {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.ann-badge--normal { background: #e8e8ed; color: #86868b; }
.ann-badge--important { background: #fff2e0; color: #ff9500; }
.ann-badge--urgent { background: #ffebeb; color: #ff3b30; }

.ann-author { font-size: 0.75rem; color: #86868b; font-weight: 500; }
.ann-title { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.5rem; }
.ann-body { font-size: 0.9rem; color: #3a3a3c; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.carousel-dots {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.carousel-dots .dot {
  width: 6px;
  height: 6px;
  background: #d2d2d7;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;
}

.carousel-dots .dot.active { background: #0071e3; transform: scale(1.2); }

/* Reservations Section */
.reservations-section {
  grid-column: span 2;
}

.res-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.res-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fbfbfd;
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid transparent;
}

.res-item--today {
  background: #fff;
  border-color: #d0e7ff;
  box-shadow: 0 2px 8px rgba(0, 113, 227, 0.05);
}

.res-group-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #86868b;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.res-info { display: flex; flex-direction: column; }
.res-space { font-weight: 600; font-size: 1rem; }
.res-time { font-size: 0.85rem; color: #86868b; }
.res-date { font-weight: 700; color: #0071e3; font-size: 0.9rem; }

/* Incidents Section */
.incidents-section {
  grid-column: span 2;
}

.inc-grid {
  display: flex;
  justify-content: space-around;
  margin-bottom: 1.5rem;
  background: #f5f5f7;
  padding: 1rem;
  border-radius: 16px;
}

.inc-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.inc-stat .count { font-size: 1.5rem; font-weight: 700; }
.inc-stat .label { font-size: 0.75rem; color: #86868b; font-weight: 600; text-transform: uppercase; }

.inc-recent {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.inc-item--dashboard {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fbfbfd;
  padding: 1rem;
  border-radius: 16px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.inc-item--dashboard:hover {
  background: #fff;
  border-color: #f2f2f7;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.inc-info-main {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.inc-desc-text {
  font-weight: 600;
  font-size: 0.95rem;
  color: #1d1d1f;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inc-date-sub {
  font-size: 0.75rem;
  color: #86868b;
}

.inc-tag {
  flex-shrink: 0;
}

/* States */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #86868b;
  gap: 0.5rem;
  padding: 1rem;
}

.empty-state i { font-size: 2rem; opacity: 0.3; }

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-content {
  background: #fff;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  border-radius: 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #f2f2f7;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.modal-close {
  background: #f5f5f7;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ann-all-item {
  background: #fbfbfd;
  border-radius: 16px;
  padding: 1.25rem;
  border: 1px solid #f2f2f7;
}

.ann-all-item--urgent { border-left: 4px solid #ff3b30; }
.ann-all-item--expired { opacity: 0.6; }

.ann-all-item__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.ann-all-item__meta {
  display: flex;
  gap: 0.5rem;
}

.ann-duration-tag, .ann-expired-tag {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.ann-duration-tag { background: #e8f0fe; color: #0071e3; }
.ann-expired-tag { background: #ffebeb; color: #ff3b30; }

.ann-all-item__title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.ann-all-item__body {
  font-size: 0.9rem;
  color: #3a3a3c;
  line-height: 1.4;
  margin-bottom: 1rem;
}

.ann-all-item__footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1px solid #f2f2f7;
  padding-top: 0.75rem;
}

.ann-dates {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
}

.ann-created { font-size: 0.75rem; color: #86868b; }
.ann-expiry { font-size: 0.75rem; color: #34c759; font-weight: 500; display: flex; align-items: center; gap: 0.25rem; }

/* All Incidents Items */
.inc-all-item {
  background: #fbfbfd;
  border-radius: 16px;
  padding: 1.25rem;
  border: 1px solid #f2f2f7;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.inc-all-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.inc-date { font-size: 0.75rem; color: #86868b; }
.inc-all-desc { font-size: 0.95rem; color: #1d1d1f; margin: 0; line-height: 1.5; }
.inc-provider { font-size: 0.8rem; color: #0071e3; font-weight: 500; display: flex; align-items: center; gap: 0.4rem; }

/* All Reservations Items */
.res-all-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fbfbfd;
  padding: 1.25rem;
  border-radius: 16px;
  border: 1px solid #f2f2f7;
}

.res-all-info { display: flex; flex-direction: column; gap: 0.25rem; }
.res-date-badge {
  background: #e8f5e9;
  padding: 0.4rem 0.8rem;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.85rem;
  color: #34c759;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* Responsive */
@media (max-width: 1024px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
  .chart-flex {
    flex-direction: column;
  }
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
  }
  .bento-item {
    grid-column: span 1 !important;
  }
}
</style>
