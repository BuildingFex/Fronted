<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { spacesApi } from '@/socialSpaces/infrastructure/spacesApi.js'
import { reservationsApi } from '@/socialSpaces/infrastructure/reservationsApi.js'
import { useSession } from '@/iam/application/sessionStore.js'

const { t } = useI18n()
const { state } = useSession()
const profile = computed(() => state.profile ?? {})

const spaces = ref([])
const isLoadingSpaces = ref(false)
const spacesLoadError = ref('')

const isReserveModalOpen = ref(false)
const selectedSpace = ref(null)
const reservationForm = reactive({
  date: '',
  startTime: '',
  endTime: '',
})
const reservationError = ref('')
const isSubmittingReservation = ref(false)

const dayReservations = ref([])
const isLoadingDay = ref(false)

async function loadSpaces() {
  isLoadingSpaces.value = true
  spacesLoadError.value = ''
  try {
    spaces.value = await spacesApi.list()
  } catch {
    spacesLoadError.value = t('app.spacesLoadError')
  } finally {
    isLoadingSpaces.value = false
  }
}

onMounted(loadSpaces)

function openReserveModal(space) {
  selectedSpace.value = space
  reservationForm.date = ''
  reservationForm.startTime = ''
  reservationForm.endTime = ''
  reservationError.value = ''
  dayReservations.value = []
  isReserveModalOpen.value = true
}

function closeReserveModal() {
  if (isSubmittingReservation.value) return
  isReserveModalOpen.value = false
  selectedSpace.value = null
}

async function refreshDayReservations() {
  if (!selectedSpace.value || !reservationForm.date) {
    dayReservations.value = []
    return
  }
  isLoadingDay.value = true
  try {
    const all = await reservationsApi.listBySpace(selectedSpace.value.id)
    dayReservations.value = all
      .filter((r) => r.date === reservationForm.date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  } catch {
    dayReservations.value = []
  } finally {
    isLoadingDay.value = false
  }
}

async function onReserveSubmit() {
  if (isSubmittingReservation.value || !selectedSpace.value) return

  if (!profile.value.id) {
    reservationError.value = t('app.reservationProfileMissing')
    return
  }

  reservationError.value = ''
  isSubmittingReservation.value = true
  try {
    await reservationsApi.add({
      spaceId: selectedSpace.value.id,
      residentId: profile.value.id,
      residentName: profile.value.name,
      residentCode: profile.value.code,
      date: reservationForm.date,
      startTime: reservationForm.startTime,
      endTime: reservationForm.endTime,
    })
    isReserveModalOpen.value = false
    selectedSpace.value = null
  } catch (error) {
    if (error?.code === 'RESERVATION_FIELDS_REQUIRED') {
      reservationError.value = t('app.reservationRequired')
      return
    }
    if (error?.code === 'RESERVATION_TIME_INVALID') {
      reservationError.value = t('app.reservationTimeInvalid')
      return
    }
    if (error?.code === 'RESERVATION_OVERLAP') {
      reservationError.value = t('app.reservationOverlap')
      await refreshDayReservations()
      return
    }
    reservationError.value = t('auth.genericError')
  } finally {
    isSubmittingReservation.value = false
  }
}
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('resident.servicesTitle') }}</h1>
    <p class="app-view__subtitle">
      {{ t('resident.servicesSubtitle', { name: profile.name || '' }) }}
    </p>

    <p v-if="isLoadingSpaces" class="resident-empty">
      {{ t('app.spacesLoading') }}
    </p>
    <p v-else-if="spacesLoadError" class="resident-empty resident-empty--error">
      {{ spacesLoadError }}
    </p>
    <p v-else-if="!spaces.length" class="resident-empty">
      {{ t('app.emptySpacesResident') }}
    </p>
    <ul v-else class="resident-spaces" role="list">
      <li
        v-for="space in spaces"
        :key="space.id"
        class="resident-space"
        tabindex="0"
        role="button"
        @click="openReserveModal(space)"
        @keyup.enter="openReserveModal(space)"
        @keyup.space.prevent="openReserveModal(space)"
      >
        <h2 class="resident-space__name">{{ space.name }}</h2>
        <p v-if="space.description" class="resident-space__description">
          {{ space.description }}
        </p>
        <p v-if="space.capacity" class="resident-space__capacity">
          {{ t('app.spaceCapacityLabel') }}: {{ space.capacity }}
        </p>
        <span class="resident-space__cta">{{ t('app.reserveAction') }}</span>
      </li>
    </ul>

    <div
      v-if="isReserveModalOpen"
      class="resident-modal-backdrop"
      role="presentation"
      @click.self="closeReserveModal"
    >
      <section
        class="resident-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="t('app.reserveModalTitle')"
      >
        <h3 class="resident-modal__title">
          {{ t('app.reserveModalTitle') }}
          <span v-if="selectedSpace" class="resident-modal__title-suffix">— {{ selectedSpace.name }}</span>
        </h3>

        <form class="resident-modal__form" @submit.prevent="onReserveSubmit">
          <label class="resident-modal__field">
            <span>{{ t('app.reservationDateLabel') }}</span>
            <input
              v-model="reservationForm.date"
              type="date"
              @change="refreshDayReservations"
            />
          </label>

          <div class="resident-modal__row">
            <label class="resident-modal__field">
              <span>{{ t('app.reservationStartLabel') }}</span>
              <input v-model="reservationForm.startTime" type="time" />
            </label>
            <label class="resident-modal__field">
              <span>{{ t('app.reservationEndLabel') }}</span>
              <input v-model="reservationForm.endTime" type="time" />
            </label>
          </div>

          <div v-if="reservationForm.date" class="resident-modal__day-block">
            <p class="resident-modal__day-title">
              {{ t('app.reservedSlotsForDay') }}
            </p>
            <p v-if="isLoadingDay" class="resident-modal__day-empty">
              {{ t('app.reservationsLoading') }}
            </p>
            <p v-else-if="!dayReservations.length" class="resident-modal__day-empty">
              {{ t('app.noReservationsForDay') }}
            </p>
            <ul v-else class="resident-modal__day-list" role="list">
              <li v-for="r in dayReservations" :key="r.id">
                {{ r.startTime }} – {{ r.endTime }}
              </li>
            </ul>
          </div>

          <p v-if="reservationError" class="resident-modal__error">{{ reservationError }}</p>

          <div class="resident-modal__actions">
            <button
              type="button"
              class="resident-modal__btn resident-modal__btn--secondary"
              :disabled="isSubmittingReservation"
              @click="closeReserveModal"
            >
              {{ t('app.cancelAction') }}
            </button>
            <button
              type="submit"
              class="resident-modal__btn resident-modal__btn--primary"
              :disabled="isSubmittingReservation"
            >
              {{
                isSubmittingReservation
                  ? t('app.reservingAction')
                  : t('app.confirmReservationAction')
              }}
            </button>
          </div>
        </form>
      </section>
    </div>
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

.resident-empty {
  margin: 0.5rem 0 0;
  color: var(--apple-text-secondary, #6e6e73);
}

.resident-empty--error {
  color: #b42318;
}

.resident-spaces {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.75rem;
}

.resident-space {
  border: 1px solid #e8e8ed;
  border-radius: 12px;
  padding: 0.95rem;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.resident-space:hover,
.resident-space:focus-visible {
  border-color: #c7d2fe;
  background: #f0f4ff;
  outline: none;
}

.resident-space__name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.resident-space__description {
  margin: 0;
  color: #6e6e73;
  font-size: 0.875rem;
}

.resident-space__capacity {
  margin: 0;
  color: #6e6e73;
  font-size: 0.825rem;
}

.resident-space__cta {
  margin-top: 0.35rem;
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: #eaf3ff;
  color: #0a84ff;
  font-weight: 600;
  font-size: 0.8125rem;
}

.resident-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.resident-modal {
  width: min(100%, 30rem);
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #ececf1;
  padding: 1rem;
  max-height: 90vh;
  overflow-y: auto;
}

.resident-modal__title {
  margin: 0;
  font-size: 1.1rem;
}

.resident-modal__title-suffix {
  font-weight: 500;
  color: #6e6e73;
  margin-left: 0.25rem;
}

.resident-modal__form {
  margin-top: 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.resident-modal__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.9rem;
}

.resident-modal__field input {
  border: 1px solid #d2d2d7;
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
  font: inherit;
}

.resident-modal__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.resident-modal__day-block {
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
  background: #fafafd;
}

.resident-modal__day-title {
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1d1d1f;
}

.resident-modal__day-empty {
  margin: 0;
  color: #6e6e73;
  font-size: 0.825rem;
}

.resident-modal__day-list {
  margin: 0;
  padding-left: 1rem;
  font-size: 0.85rem;
  color: #1d1d1f;
}

.resident-modal__error {
  margin: 0;
  color: #b42318;
  font-size: 0.825rem;
}

.resident-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.resident-modal__btn {
  border: none;
  border-radius: 8px;
  padding: 0.5rem 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.resident-modal__btn--secondary {
  background: #f0f0f4;
  color: #1d1d1f;
}

.resident-modal__btn--primary {
  background: var(--apple-blue, #0a84ff);
  color: #ffffff;
}
</style>
