<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import { reservationsApi } from '@/socialSpaces/infrastructure/reservationsApi.js'
import { spacesApi } from '@/socialSpaces/infrastructure/spacesApi.js'

const { t, locale } = useI18n()

const reservations = ref([])
const spacesById = ref(new Map())
const loading = ref(false)
const loadError = ref(false)
const savingKey = ref('')

const sortedReservations = computed(() => {
  return reservations.value
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return String(b.startTime).localeCompare(String(a.startTime))
    })
})

function spaceName(spaceId) {
  return spacesById.value.get(spaceId)?.name ?? t('app.spaceFallbackName')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString(locale.value === 'es' ? 'es-PE' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function slotLabel(r) {
  return `${formatDate(r.date)} · ${r.startTime} – ${r.endTime}`
}

async function load() {
  loading.value = true
  loadError.value = false
  try {
    const [resList, spaces] = await Promise.all([reservationsApi.listAllForAdmin(), spacesApi.list()])
    reservations.value = resList
    spacesById.value = new Map(spaces.map((s) => [s.id, s]))
  } catch {
    loadError.value = true
    reservations.value = []
  } finally {
    loading.value = false
  }
}

async function onGuestCheckedIn(r, guest, checkedIn) {
  const key = `${r.id}:${guest.id}`
  if (savingKey.value) return
  savingKey.value = key
  try {
    const updated = await reservationsApi.setGuestCheckedIn(r.id, guest.id, checkedIn)
    const idx = reservations.value.findIndex((x) => x.id === updated.id)
    if (idx !== -1) {
      reservations.value[idx] = updated
    }
  } catch {
    await load()
  } finally {
    savingKey.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('app.pageGeneration') }}</h1>
    <p class="app-view__subtitle">{{ t('app.generationAdminSubtitle') }}</p>

    <div class="finance-page">
      <section class="finance-panel admin-gen-panel" :aria-label="t('app.pageGeneration')">
        <p v-if="loading" class="admin-gen-status">{{ t('app.generationAdminLoading') }}</p>
        <p v-else-if="loadError" class="admin-gen-alert" role="alert">{{ t('app.generationAdminLoadError') }}</p>
        <p v-else-if="!sortedReservations.length" class="admin-gen-empty">{{ t('app.generationAdminEmpty') }}</p>

        <ul v-else class="admin-gen-list">
          <li v-for="r in sortedReservations" :key="r.id" class="admin-gen-card">
            <div class="admin-gen-card__head">
              <div>
                <p class="admin-gen-card__space">{{ spaceName(r.spaceId) }}</p>
                <p class="admin-gen-card__meta">
                  <span class="admin-gen-label">{{ t('app.generationAdminResident') }}:</span>
                  {{ r.residentName || '—' }}
                  <span v-if="r.residentCode" class="admin-gen-code">({{ r.residentCode }})</span>
                </p>
                <p class="admin-gen-card__slot">
                  <span class="admin-gen-label">{{ t('app.generationAdminSlot') }}:</span>
                  {{ slotLabel(r) }}
                </p>
              </div>
            </div>

            <div class="admin-gen-guests">
              <p class="admin-gen-guests__title">{{ t('app.generationAdminGuestsTitle') }}</p>
              <p v-if="!r.guests?.length" class="admin-gen-muted">{{ t('app.generationAdminNoGuests') }}</p>
              <ul v-else class="admin-gen-guest-list">
                <li v-for="g in r.guests" :key="g.id" class="admin-gen-guest-row">
                  <Checkbox
                    :input-id="`in-${r.id}-${g.id}`"
                    binary
                    :model-value="Boolean(g.checkedIn)"
                    :disabled="savingKey === `${r.id}:${g.id}`"
                    :aria-label="t('app.generationAdminCheckInAria')"
                    @update:modelValue="(v) => onGuestCheckedIn(r, g, Boolean(v))"
                  />
                  <label class="admin-gen-guest-name" :for="`in-${r.id}-${g.id}`">{{ g.name }}</label>
                  <Tag
                    v-if="g.checkedIn"
                    severity="success"
                    class="admin-gen-tag"
                    :value="t('app.generationAdminEntered')"
                  />
                  <Tag v-else severity="secondary" class="admin-gen-tag" :value="t('app.generationAdminNotEntered')" />
                </li>
              </ul>
            </div>
          </li>
        </ul>
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
  max-width: 44rem;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.45;
  color: var(--apple-text-secondary, #6e6e73);
}

.finance-page {
  margin-top: 1.5rem;
}

.finance-panel {
  padding: 1.2rem 1.25rem 1.35rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.admin-gen-status,
.admin-gen-empty {
  margin: 0;
  font-size: 0.875rem;
  color: #6e6e73;
}

.admin-gen-alert {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #b42318;
}

.admin-gen-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.admin-gen-card {
  border-radius: 12px;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.admin-gen-card__head {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
}

.admin-gen-card__space {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1d1d1f;
}

.admin-gen-card__meta,
.admin-gen-card__slot {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: #6e6e73;
  line-height: 1.4;
}

.admin-gen-label {
  font-weight: 500;
  color: #86868b;
}

.admin-gen-code {
  margin-left: 0.15rem;
  opacity: 0.85;
}

.admin-gen-guests {
  padding: 0.75rem 1rem 0.95rem;
}

.admin-gen-guests__title {
  margin: 0 0 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #86868b;
}

.admin-gen-muted {
  margin: 0;
  font-size: 0.8125rem;
  color: #6e6e73;
}

.admin-gen-guest-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.admin-gen-guest-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.65rem;
}

.admin-gen-guest-name {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1d1d1f;
  cursor: pointer;
}

.admin-gen-tag {
  font-size: 0.7rem;
}
</style>
