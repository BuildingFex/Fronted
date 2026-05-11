<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSession } from '@/iam/application/sessionStore.js'
import { reservationsApi } from '@/socialSpaces/infrastructure/reservationsApi.js'
import { spacesApi } from '@/socialSpaces/infrastructure/spacesApi.js'
import { announcementsApi } from '@/information/infrastructure/announcementsApi.js'

const { t } = useI18n()
const { state } = useSession()
const profile = computed(() => state.profile ?? {})

const reservations = ref([])
const spacesById = ref(new Map())
const isLoadingReservations = ref(false)
const reservationsError = ref('')

const announcements = ref([])
const isLoadingAnnouncements = ref(false)

// ── carousel state ──
const currentIndex = ref(0)
const showAllModal = ref(false)

const todayIso = new Date().toISOString().slice(0, 10)

const upcomingReservations = computed(() => {
  return reservations.value
    .filter((r) => r.date >= todayIso)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.startTime.localeCompare(b.startTime)
    })
})

// Active (non-expired) announcements for the carousel
const activeAnnouncements = computed(() =>
  announcements.value.filter((a) => !a.expiresAt || new Date() < new Date(a.expiresAt))
)

const currentAnnouncement = computed(() => activeAnnouncements.value[currentIndex.value] ?? null)

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

function isExpired(iso) {
  if (!iso) return false
  return new Date() > new Date(iso)
}

async function loadReservations() {
  if (!profile.value.id) { reservations.value = []; return }
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

async function loadAnnouncements() {
  isLoadingAnnouncements.value = true
  try {
    announcements.value = await announcementsApi.list()
    currentIndex.value = 0
  } catch {
    // silently fail
  } finally {
    isLoadingAnnouncements.value = false
  }
}

onMounted(() => {
  loadReservations()
  loadAnnouncements()
})
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

    <!-- ── ANNOUNCEMENTS SECTION ── -->
    <section class="resident-card resident-card--announcements">
      <div class="ann-section-header">
        <h2 class="resident-card__title">
          <i class="pi pi-megaphone" aria-hidden="true" style="margin-right:0.4rem;color:#0071e3" />
          {{ t('resident.announcementsTitle') }}
        </h2>
        <button
          v-if="activeAnnouncements.length > 0"
          type="button"
          class="ann-see-all-btn"
          @click="showAllModal = true"
        >
          <i class="pi pi-list" aria-hidden="true" />
          {{ t('information.seeAll') }}
        </button>
      </div>

      <!-- loading -->
      <p v-if="isLoadingAnnouncements" class="resident-card__empty">
        {{ t('information.loading') }}
      </p>

      <!-- empty -->
      <p v-else-if="activeAnnouncements.length === 0" class="resident-card__empty">
        {{ t('resident.announcementsEmpty') }}
      </p>

      <!-- carousel -->
      <div v-else class="ann-carousel">
        <!-- nav: prev -->
        <button
          class="ann-carousel__nav ann-carousel__nav--prev"
          :disabled="activeAnnouncements.length <= 1"
          :aria-label="t('information.prevAnnouncement')"
          type="button"
          @click="prevAnn"
        >
          <i class="pi pi-chevron-left" />
        </button>

        <!-- card -->
        <Transition name="ann-slide" mode="out-in">
          <article
            v-if="currentAnnouncement"
            :key="currentAnnouncement.id"
            class="ann-carousel__card"
            :class="{
              'ann-carousel__card--urgent': currentAnnouncement.priority === 'urgent',
              'ann-carousel__card--important': currentAnnouncement.priority === 'important',
            }"
          >
            <!-- top row: badge + duration -->
            <div class="ann-carousel__top">
              <span class="ann-badge" :class="priorityClass(currentAnnouncement.priority)">
                {{ priorityLabel(currentAnnouncement.priority) }}
              </span>
              <span v-if="currentAnnouncement.duration" class="ann-carousel__duration">
                <i class="pi pi-clock" aria-hidden="true" />
                {{ durationLabel(currentAnnouncement.duration) }}
              </span>
            </div>

            <h3 class="ann-carousel__title">{{ currentAnnouncement.title }}</h3>
            <p class="ann-carousel__body">{{ currentAnnouncement.body }}</p>

            <!-- footer: author + expiry -->
            <div class="ann-carousel__footer">
              <span class="ann-carousel__author">
                <i class="pi pi-user" aria-hidden="true" />
                {{ currentAnnouncement.authorName }}
              </span>
              <span v-if="currentAnnouncement.expiresAt" class="ann-carousel__expiry">
                <i class="pi pi-calendar" aria-hidden="true" />
                {{ t('information.expiresOn', { date: formatExpiry(currentAnnouncement.expiresAt) }) }}
              </span>
            </div>
          </article>
        </Transition>

        <!-- nav: next -->
        <button
          class="ann-carousel__nav ann-carousel__nav--next"
          :disabled="activeAnnouncements.length <= 1"
          :aria-label="t('information.nextAnnouncement')"
          type="button"
          @click="nextAnn"
        >
          <i class="pi pi-chevron-right" />
        </button>
      </div>

      <!-- dots / counter -->
      <div v-if="activeAnnouncements.length > 1" class="ann-carousel__dots">
        <button
          v-for="(_, i) in activeAnnouncements"
          :key="i"
          class="ann-carousel__dot"
          :class="{ 'ann-carousel__dot--active': i === currentIndex }"
          type="button"
          :aria-label="`Comunicado ${i + 1}`"
          @click="currentIndex = i"
        />
      </div>
    </section>

    <!-- ── SEE-ALL MODAL ── -->
    <Teleport to="body">
      <Transition name="ann-modal">
        <div v-if="showAllModal" class="ann-all-overlay" @click.self="showAllModal = false">
          <div class="ann-all-modal" role="dialog" :aria-label="t('information.allAnnouncementsTitle')">
            <header class="ann-all-modal__header">
              <h2 class="ann-all-modal__title">
                <i class="pi pi-megaphone" aria-hidden="true" style="margin-right:0.4rem;color:#0071e3" />
                {{ t('information.allAnnouncementsTitle') }}
              </h2>
              <button
                type="button"
                class="ann-all-modal__close"
                :aria-label="t('information.close')"
                @click="showAllModal = false"
              >
                <i class="pi pi-times" />
              </button>
            </header>

            <div class="ann-all-modal__body">
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
                    <span v-if="ann.duration" class="ann-carousel__duration">
                      <i class="pi pi-clock" aria-hidden="true" />
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
                  <span class="ann-carousel__author">
                    <i class="pi pi-user" aria-hidden="true" />
                    {{ ann.authorName }}
                  </span>
                  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.1rem;">
                    <time style="font-size:0.68rem;color:#86868b;">{{ formatDate(ann.createdAt) }}</time>
                    <span v-if="ann.expiresAt" :class="isExpired(ann.expiresAt) ? 'ann-all-expiry--expired' : 'ann-all-expiry'">
                      <i class="pi pi-calendar-times" aria-hidden="true" />
                      {{ isExpired(ann.expiresAt) ? t('information.expired') : t('information.expiresOn', { date: formatExpiry(ann.expiresAt) }) }}
                    </span>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>


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

/* ── announcements section ── */
.resident-card--announcements {
  max-width: 100%;
}

.ann-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
}
.ann-section-header .resident-card__title { margin-bottom: 0; }

.ann-see-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.85rem;
  border: 1px solid #d2d2d7;
  border-radius: 980px;
  background: #fff;
  color: #0071e3;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.ann-see-all-btn:hover {
  background: #f0f6ff;
  border-color: #0071e3;
}

/* ── carousel wrapper ── */
.ann-carousel {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.ann-carousel__nav {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid #e8e8ed;
  background: #fff;
  color: #1d1d1f;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.ann-carousel__nav:hover:not(:disabled) {
  background: #0071e3;
  border-color: #0071e3;
  color: #fff;
}
.ann-carousel__nav:disabled {
  opacity: 0.3;
  cursor: default;
}

/* ── carousel card ── */
.ann-carousel__card {
  flex: 1;
  min-width: 0;
  background: #fff;
  border: 1px solid #e8e8ed;
  border-radius: 16px;
  padding: 1.1rem 1.25rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.05);
  transition: box-shadow 0.18s ease;
}
.ann-carousel__card--urgent  { border-left: 4px solid #ff3b30; }
.ann-carousel__card--important { border-left: 4px solid #e65100; }

.ann-carousel__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.ann-carousel__duration {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: #0071e3;
  background: #e8f0fe;
  padding: 0.15rem 0.5rem;
  border-radius: 980px;
}

.ann-carousel__title {
  margin: 0 0 0.45rem;
  font-size: 0.97rem;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
}

.ann-carousel__body {
  margin: 0 0 0.8rem;
  font-size: 0.84rem;
  color: #3a3a3c;
  line-height: 1.55;
  white-space: pre-line;
}

.ann-carousel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.7rem;
  color: #86868b;
}

.ann-carousel__author {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
}

.ann-carousel__expiry {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: #34a853;
  font-weight: 500;
}

/* ── dots ── */
.ann-carousel__dots {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 0.75rem;
}
.ann-carousel__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: none;
  background: #d2d2d7;
  cursor: pointer;
  padding: 0;
  transition: background 0.18s ease, transform 0.18s ease;
}
.ann-carousel__dot--active {
  background: #0071e3;
  transform: scale(1.3);
}

/* ── slide transition ── */
.ann-slide-enter-active, .ann-slide-leave-active { transition: all 0.22s ease; }
.ann-slide-enter-from { opacity: 0; transform: translateX(18px); }
.ann-slide-leave-to  { opacity: 0; transform: translateX(-18px); }

/* ── SEE-ALL MODAL ── */
.ann-all-overlay {
  position: fixed;
  inset: 0;
  z-index: 9100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.38);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.ann-all-modal {
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.18);
  width: 95%;
  max-width: 36rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ann-modal-in 0.28s cubic-bezier(0.34, 1.2, 0.64, 1);
}

@keyframes ann-modal-in {
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ann-all-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.15rem 1.35rem 0.75rem;
  border-bottom: 1px solid #e8e8ed;
  flex-shrink: 0;
}

.ann-all-modal__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #1d1d1f;
}

.ann-all-modal__close {
  background: none;
  border: none;
  font-size: 1rem;
  color: #86868b;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  line-height: 1;
}
.ann-all-modal__close:hover { color: #1d1d1f; }

.ann-all-modal__body {
  overflow-y: auto;
  padding: 0.85rem 1.35rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── list items inside modal ── */
.ann-all-item {
  background: #fafafa;
  border: 1px solid #e8e8ed;
  border-radius: 12px;
  padding: 0.9rem 1rem;
  transition: border-color 0.15s ease;
}
.ann-all-item:hover { border-color: #d2d2d7; }
.ann-all-item--urgent   { border-left: 3px solid #ff3b30; }
.ann-all-item--expired  { opacity: 0.55; }

.ann-all-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.45rem;
}
.ann-all-item__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.ann-expired-tag {
  display: inline-flex;
  align-items: center;
  font-size: 0.62rem;
  font-weight: 700;
  color: #b42318;
  background: #fdecee;
  padding: 0.12rem 0.45rem;
  border-radius: 980px;
  text-transform: uppercase;
}

.ann-all-item__title {
  margin: 0 0 0.3rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
}
.ann-all-item__body {
  margin: 0 0 0.6rem;
  font-size: 0.82rem;
  color: #3a3a3c;
  line-height: 1.55;
  white-space: pre-line;
}
.ann-all-item__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.7rem;
  color: #86868b;
}

.ann-all-expiry {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.65rem;
  color: #34a853;
  font-weight: 500;
}
.ann-all-expiry--expired {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.65rem;
  color: #b42318;
  font-weight: 500;
}

/* ── priority badges ── */
.ann-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 980px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.ann-badge--normal    { background: #f2f2f7; color: #6e6e73; }
.ann-badge--important { background: #fff3e0; color: #e65100; }
.ann-badge--urgent    { background: #fdecee; color: #b42318; }

/* ── modal transition ── */
.ann-modal-enter-active, .ann-modal-leave-active { transition: opacity 0.2s ease; }
.ann-modal-enter-from, .ann-modal-leave-to { opacity: 0; }
</style>

