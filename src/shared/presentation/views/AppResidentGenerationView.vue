<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import { useSession } from '@/iam/application/sessionStore.js'
import { reservationsApi } from '@/socialSpaces/infrastructure/reservationsApi.js'
import { spacesApi } from '@/socialSpaces/infrastructure/spacesApi.js'
import { buildGuestInviteUrl } from '@/socialSpaces/infrastructure/guestInviteUrl.js'
import { reservationInviteExpiresAtMs } from '@/shared/infrastructure/api/utils.js'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

const MAX_GUESTS = 5

const { t, locale } = useI18n()
const { state } = useSession()
const profile = computed(() => state.profile ?? {})

const reservations = ref([])
const spacesById = ref(new Map())
const loading = ref(false)
const loadError = ref(false)

const expandedId = ref(null)
const guestsModalOpen = ref(false)
const modalReservation = ref(null)
const guestDraftRows = ref(
  Array.from({ length: MAX_GUESTS }, () => ({
    id: '',
    name: '',
  })),
)
const savingGuests = ref(false)
const guestsModalError = ref(false)

const nowMs = ref(Date.now())
const qrByReservationId = ref({})
const copiedReservationId = ref(null)

let inviteClock

function inviteExpiryMs(r) {
  return reservationInviteExpiresAtMs(r.date, r.startTime)
}

function inviteLinkExpired(r) {
  const exp = inviteExpiryMs(r)
  if (exp == null) return true
  return nowMs.value >= exp
}

function formatExpiryClockFromReservation(r) {
  const exp = inviteExpiryMs(r)
  if (exp == null) return ''
  const d = new Date(exp)
  return d.toLocaleTimeString(locale.value === 'es' ? 'es-PE' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const myReservations = computed(() => {
  const id = String(profile.value.id ?? '').trim()
  if (!id) return []
  return reservations.value
    .filter((r) => String(r.residentId ?? '') === id)
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return String(b.startTime).localeCompare(String(a.startTime))
    })
})

async function syncInviteQrs() {
  const next = { ...qrByReservationId.value }
  for (const r of myReservations.value) {
    if (!r.guestInviteToken || !r.guests?.length) {
      delete next[r.id]
      continue
    }
    const exp = inviteExpiryMs(r)
    if (exp == null || nowMs.value >= exp) {
      delete next[r.id]
      continue
    }
    const url = buildGuestInviteUrl(r.guestInviteToken)
    try {
      next[r.id] = await QRCode.toDataURL(url, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
    } catch {
      delete next[r.id]
    }
  }
  qrByReservationId.value = next
}

async function copyInviteLink(r) {
  const url = buildGuestInviteUrl(r.guestInviteToken)
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    copiedReservationId.value = r.id
    window.setTimeout(() => {
      if (copiedReservationId.value === r.id) copiedReservationId.value = null
    }, 2200)
  } catch {
    copiedReservationId.value = null
  }
}

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

function toggleExpand(reservationId) {
  const id = String(reservationId ?? '')
  expandedId.value = expandedId.value === id ? null : id
}

function openGuestsModal(r) {
  modalReservation.value = r
  guestsModalError.value = false
  const list = Array.isArray(r.guests) ? r.guests : []
  guestDraftRows.value = Array.from({ length: MAX_GUESTS }, (_, i) => ({
    id: String(list[i]?.id ?? '').trim(),
    name: String(list[i]?.name ?? '').trim(),
  }))
  guestsModalOpen.value = true
}

function closeGuestsModal() {
  guestsModalOpen.value = false
  modalReservation.value = null
}

async function confirmGuests() {
  const res = modalReservation.value
  if (!res?.id) return
  savingGuests.value = true
  guestsModalError.value = false
  try {
    const payload = guestDraftRows.value
      .map((row) => ({
        id: String(row.id ?? '').trim(),
        name: String(row.name ?? '').trim(),
      }))
      .filter((g) => g.name.length > 0)
      .slice(0, MAX_GUESTS)
    const updated = await reservationsApi.updateGuests(res.id, payload)
    const idx = reservations.value.findIndex((x) => x.id === updated.id)
    if (idx !== -1) {
      reservations.value[idx] = updated
    }
    void syncInviteQrs()
    closeGuestsModal()
  } catch {
    guestsModalError.value = true
  } finally {
    savingGuests.value = false
  }
}

async function load() {
  const rid = String(profile.value.id ?? '').trim()
  if (!rid) {
    reservations.value = []
    return
  }
  loading.value = true
  loadError.value = false
  try {
    const [resList, spaces] = await Promise.all([
      reservationsApi.listByResident(rid),
      spacesApi.list(),
    ])
    reservations.value = resList
    spacesById.value = new Map(spaces.map((s) => [s.id, s]))
  } catch {
    loadError.value = true
    reservations.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
  inviteClock = window.setInterval(() => {
    nowMs.value = Date.now()
    void syncInviteQrs()
  }, 5000)
})

watch(
  () =>
    reservations.value
      .map(
        (r) =>
          `${r.id}:${r.guestInviteToken ?? ''}:${r.guests?.length ?? 0}:${r.date}:${r.startTime}:${(r.guests ?? []).map((g) => `${g.id}:${g.checkedIn ? 1 : 0}`).join(',')}`,
      )
      .join('|'),
  () => {
    void syncInviteQrs()
  },
)

onUnmounted(() => {
  if (inviteClock) window.clearInterval(inviteClock)
})

watch(guestsModalOpen, (open) => {
  if (!open) {
    modalReservation.value = null
    guestsModalError.value = false
  }
})
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('resident.generationTitle') }}</h1>
    <p class="app-view__subtitle">{{ t('resident.generationSubtitle', { name: profile.name || '' }) }}</p>

    <div class="finance-page">
      <section class="finance-panel gen-panel" :aria-label="t('resident.generationTitle')">
        <p v-if="loading" class="gen-status">{{ t('resident.generationLoading') }}</p>
        <p v-else-if="loadError" class="gen-alert" role="alert">{{ t('resident.generationLoadError') }}</p>
        <p v-else-if="!profile.id" class="gen-alert" role="alert">{{ t('app.reservationProfileMissing') }}</p>
        <p v-else-if="!myReservations.length" class="gen-empty">{{ t('resident.generationEmpty') }}</p>

        <ul v-else class="gen-list">
          <li v-for="r in myReservations" :key="r.id" class="gen-card">
            <div class="gen-card__row">
              <button
                type="button"
                class="gen-card__toggle"
                :aria-expanded="expandedId === r.id"
                :aria-label="t('resident.generationExpandGuests')"
                @click="toggleExpand(r.id)"
              >
                <div class="gen-card__main">
                  <i class="pi pi-map-marker gen-card__icon" aria-hidden="true" />
                  <div class="gen-card__text">
                    <p class="gen-card__space">{{ spaceName(r.spaceId) }}</p>
                    <p class="gen-card__meta">
                      {{ formatDate(r.date) }}
                      <span class="gen-card__dot" aria-hidden="true">·</span>
                      {{ r.startTime }} – {{ r.endTime }}
                    </p>
                  </div>
                </div>
                <i
                  class="gen-card__chev pi"
                  :class="expandedId === r.id ? 'pi-chevron-up' : 'pi-chevron-down'"
                  aria-hidden="true"
                />
              </button>
              <Button
                type="button"
                class="gen-card__add"
                :label="t('resident.generationAddGuest')"
                severity="secondary"
                outlined
                size="small"
                @click.stop="openGuestsModal(r)"
              />
            </div>

            <div v-show="expandedId === r.id" class="gen-card__guests" role="region">
              <p class="gen-card__guests-title">{{ t('resident.generationGuestsSection') }}</p>
              <ul v-if="r.guests?.length" class="gen-guest-list">
                <li v-for="g in r.guests" :key="g.id" class="gen-guest-list__item">
                  <span class="gen-guest-list__name">{{ g.name }}</span>
                  <span
                    class="gen-guest-list__status"
                    :class="g.checkedIn ? 'gen-guest-list__status--in' : 'gen-guest-list__status--out'"
                  >
                    {{ g.checkedIn ? t('resident.generationGuestEntered') : t('resident.generationGuestNotEntered') }}
                  </span>
                </li>
              </ul>
              <p v-else class="gen-card__guests-empty">{{ t('resident.generationGuestsEmpty') }}</p>

              <div v-if="r.guestInviteToken && r.guests?.length" class="gen-invite">
                <p class="gen-invite__title">{{ t('resident.generationInviteTitle') }}</p>
                <p class="gen-invite__hint">{{ t('resident.generationInviteQrHelp') }}</p>
                <div class="gen-invite__row">
                  <InputText
                    readonly
                    class="gen-invite__url"
                    :model-value="buildGuestInviteUrl(r.guestInviteToken)"
                  />
                  <Button
                    type="button"
                    :label="t('resident.generationInviteCopy')"
                    size="small"
                    severity="secondary"
                    outlined
                    @click="copyInviteLink(r)"
                  />
                </div>
                <p v-if="copiedReservationId === r.id" class="gen-invite__copied" role="status">
                  {{ t('resident.generationInviteCopied') }}
                </p>
                <template v-if="!inviteLinkExpired(r)">
                  <div v-if="qrByReservationId[r.id]" class="gen-invite__qr">
                    <img
                      :src="qrByReservationId[r.id]"
                      width="200"
                      height="200"
                      alt=""
                      class="gen-invite__qr-img"
                    />
                  </div>
                </template>
                <p v-else class="gen-invite__expired" role="alert">
                  {{ t('resident.generationInviteExpired', { time: formatExpiryClockFromReservation(r) }) }}
                </p>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <Dialog
      v-model:visible="guestsModalOpen"
      modal
      :header="t('resident.generationGuestsModalTitle')"
      :style="{ width: 'min(22rem, 100vw - 2rem)' }"
      :dismissable-mask="true"
    >
      <p class="gen-modal__hint">{{ t('resident.generationGuestsModalHint') }}</p>
      <div class="gen-modal__fields">
        <label v-for="i in MAX_GUESTS" :key="i" class="gen-modal__field">
          <span class="gen-modal__sr">{{ t('resident.generationGuestPlaceholder') }} {{ i }}</span>
          <InputText
            v-model="guestDraftRows[i - 1].name"
            class="gen-modal__input"
            :placeholder="`${t('resident.generationGuestPlaceholder')} ${i}`"
            autocomplete="off"
          />
        </label>
      </div>
      <p v-if="guestsModalError" class="gen-modal__error" role="alert">
        {{ t('resident.generationGuestsSaveError') }}
      </p>
      <template #footer>
        <Button
          type="button"
          :label="t('resident.generationGuestsCancel')"
          severity="secondary"
          text
          :disabled="savingGuests"
          @click="closeGuestsModal"
        />
        <Button
          type="button"
          :label="t('resident.generationGuestsConfirm')"
          :loading="savingGuests"
          :disabled="savingGuests"
          @click="confirmGuests"
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
  max-width: 40rem;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: -0.015em;
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

.gen-status,
.gen-empty {
  margin: 0;
  font-size: 0.875rem;
  color: #6e6e73;
}

.gen-alert {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #b42318;
}

.gen-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.gen-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  border-radius: 12px;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.gen-card__row {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  min-width: 0;
}

.gen-card__toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: inherit;
  border-radius: 8px;
}

.gen-card__toggle:hover {
  background: rgba(0, 0, 0, 0.03);
}

.gen-card__toggle:focus-visible {
  outline: 2px solid var(--p-primary-color, #2563eb);
  outline-offset: 2px;
}

.gen-card__main {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  min-width: 0;
}

.gen-card__text {
  min-width: 0;
}

.gen-card__icon {
  margin-top: 0.15rem;
  color: #86868b;
  font-size: 1rem;
  flex-shrink: 0;
}

.gen-card__chev {
  margin-top: 0.2rem;
  color: #86868b;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.gen-card__space {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--apple-text, #1d1d1f);
}

.gen-card__meta {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: #6e6e73;
}

.gen-card__dot {
  margin: 0 0.25rem;
  opacity: 0.6;
}

.gen-card__add {
  flex-shrink: 0;
  align-self: center;
}

.gen-card__guests {
  padding: 0 1rem 0.9rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: #fff;
}

.gen-card__guests-title {
  margin: 0.65rem 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #86868b;
}

.gen-card__guests-empty {
  margin: 0 0 0.25rem;
  font-size: 0.8125rem;
  color: #6e6e73;
  line-height: 1.4;
}

.gen-guest-list {
  margin: 0;
  padding: 0 0 0.25rem 1rem;
  font-size: 0.875rem;
  color: var(--apple-text, #1d1d1f);
  line-height: 1.45;
}

.gen-guest-list__item {
  margin: 0.2rem 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
}

.gen-guest-list__name {
  font-weight: 500;
}

.gen-guest-list__status {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.gen-guest-list__status--in {
  color: #047857;
}

.gen-guest-list__status--out {
  color: #86868b;
}

.gen-modal__hint {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: #6e6e73;
  line-height: 1.45;
}

.gen-modal__fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gen-modal__field {
  display: block;
}

.gen-modal__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.gen-modal__input {
  width: 100%;
}

.gen-modal__error {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #b42318;
}

.gen-invite {
  margin-top: 1rem;
  padding-top: 0.85rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
}

.gen-invite__title {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #86868b;
}

.gen-invite__hint {
  margin: 0 0 0.65rem;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #6e6e73;
}

.gen-invite__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: stretch;
}

.gen-invite__url {
  flex: 1;
  min-width: 0;
  font-size: 0.75rem;
}

.gen-invite__copied {
  margin: 0.45rem 0 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #047857;
}

.gen-invite__qr {
  margin-top: 0.85rem;
  text-align: center;
}

.gen-invite__qr-img {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.gen-invite__expired {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #9a3412;
  line-height: 1.4;
}
</style>
