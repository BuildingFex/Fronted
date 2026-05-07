<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSession } from '@/iam/application/sessionStore.js'
import { reservationsApi } from '@/socialSpaces/infrastructure/reservationsApi.js'
import { spacesApi } from '@/socialSpaces/infrastructure/spacesApi.js'

const { t } = useI18n()
const { state } = useSession()
const profile = computed(() => state.profile ?? {})

const reservations = ref([])
const spacesById = ref(new Map())
const isLoadingReservations = ref(false)
const reservationsError = ref('')

const todayIso = new Date().toISOString().slice(0, 10)

const upcomingReservations = computed(() => {
  return reservations.value
    .filter((r) => r.date >= todayIso)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.startTime.localeCompare(b.startTime)
    })
})

function spaceNameFor(reservation) {
  return spacesById.value.get(reservation.spaceId)?.name ?? t('app.spaceFallbackName')
}

async function loadReservations() {
  if (!profile.value.id) {
    reservations.value = []
    return
  }

  isLoadingReservations.value = true
  reservationsError.value = ''
  try {
    const [residentReservations, spaces] = await Promise.all([
      reservationsApi.listByResident(profile.value.id),
      spacesApi.list(),
    ])
    reservations.value = residentReservations
    spacesById.value = new Map(spaces.map((space) => [space.id, space]))
  } catch {
    reservationsError.value = t('app.reservationsLoadError')
  } finally {
    isLoadingReservations.value = false
  }
}

onMounted(loadReservations)
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('resident.dashboardTitle') }}</h1>
    <p class="app-view__subtitle">{{ t('resident.welcome', { name: profile.name || '' }) }}</p>

    <section class="resident-card resident-card--reminder">
      <h2 class="resident-card__title">{{ t('resident.reservationsReminderTitle') }}</h2>

      <p v-if="isLoadingReservations" class="resident-card__empty">
        {{ t('app.reservationsLoading') }}
      </p>
      <p v-else-if="reservationsError" class="resident-card__empty resident-card__empty--error">
        {{ reservationsError }}
      </p>
      <p v-else-if="!upcomingReservations.length" class="resident-card__empty">
        {{ t('resident.reservationsReminderEmpty') }}
      </p>
      <ul v-else class="resident-card__reservations" role="list">
        <li v-for="r in upcomingReservations" :key="r.id" class="resident-card__reservation">
          <div class="resident-card__reservation-main">
            <strong class="resident-card__reservation-space">{{ spaceNameFor(r) }}</strong>
            <span class="resident-card__reservation-time">{{ r.startTime }} – {{ r.endTime }}</span>
          </div>
          <span class="resident-card__reservation-date">{{ r.date }}</span>
        </li>
      </ul>
    </section>

    <section class="resident-card">
      <h2 class="resident-card__title">{{ t('resident.profileTitle') }}</h2>
      <ul class="resident-card__list" role="list">
        <li><strong>{{ t('app.residentNameLabel') }}:</strong> {{ profile.name }}</li>
        <li><strong>{{ t('app.residentFloorLabel') }}:</strong> {{ profile.floor }}</li>
        <li><strong>{{ t('app.residentCodeLabel') }}:</strong> {{ profile.code }}</li>
        <li v-if="profile.email"><strong>{{ t('auth.email') }}:</strong> {{ profile.email }}</li>
      </ul>
    </section>
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
  margin: 0.35rem 0 1.25rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.resident-card {
  background: #fff;
  border: 1px solid #e8e8ed;
  border-radius: 14px;
  padding: 1rem 1.1rem;
  max-width: 32rem;
  margin-bottom: 0.85rem;
}

.resident-card--reminder {
  background: #f0f4ff;
  border-color: #c7d2fe;
}

.resident-card__title {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 600;
}

.resident-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: #1d1d1f;
}

.resident-card__empty {
  margin: 0;
  color: #6e6e73;
  font-size: 0.9rem;
}

.resident-card__empty--error {
  color: #b42318;
}

.resident-card__reservations {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.resident-card__reservation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.85rem;
  background: #ffffff;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 0.55rem 0.7rem;
}

.resident-card__reservation-main {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.resident-card__reservation-space {
  color: #1d1d1f;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resident-card__reservation-time {
  color: #6e6e73;
  font-size: 0.825rem;
}

.resident-card__reservation-date {
  color: #0a84ff;
  font-weight: 600;
  font-size: 0.875rem;
  white-space: nowrap;
}
</style>
