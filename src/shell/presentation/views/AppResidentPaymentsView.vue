<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Toast from 'primevue/toast'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useSession } from '@/iam/application/sessionStore.js'
import { useResidentPaymentStore } from '@/finances/application/residentPaymentStore.js'
import {
  renderCardPaymentBrick,
  processCardPayment,
} from '@/finances/infrastructure/mercadoPagoService.js'

const { t, locale } = useI18n()
const { state } = useSession()
const { state: paymentState, recordPayment, loadData } = useResidentPaymentStore()
const toast = useToast()

const profile = computed(() => state.profile ?? {})
const fees = computed(() => paymentState.fees || [])
const paymentHistory = computed(() => paymentState.paymentHistory || [])

const todayIso = new Date().toISOString().slice(0, 10)

onMounted(() => {
  if (profile.value.id) {
    loadData(profile.value.id)
  }
})

function getDaysUntilDue(dueDate) {
  const due = new Date(`${dueDate}T00:00:00`)
  const now = new Date(`${todayIso}T00:00:00`)
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24))
}

function feeStatusLabel(fee) {
  if (fee.status === 'Pagado') return t('residentFinance.statusPaid')
  const days = getDaysUntilDue(fee.dueDate)
  if (days < 0) return t('residentFinance.statusOverdue')
  if (days <= 5) return t('residentFinance.statusDueSoon')
  return t('residentFinance.statusPending')
}

function feeSeverity(fee) {
  if (fee.status === 'Pagado') return 'success'
  const days = getDaysUntilDue(fee.dueDate)
  if (days < 0) return 'danger'
  if (days <= 5) return 'warn'
  return 'info'
}

const pendingTotal = computed(() =>
  fees.value.filter((f) => f.status === 'Pendiente').reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
)

const nextDueFee = computed(() => {
  const pending = fees.value.filter((f) => f.status === 'Pendiente')
  return pending.length ? pending[0] : null
})

const hasOverdue = computed(() =>
  fees.value.some((f) => f.status === 'Pendiente' && getDaysUntilDue(f.dueDate) < 0),
)

const nfPen = computed(
  () => (value) =>
    new Intl.NumberFormat(locale.value === 'es' ? 'es-PE' : 'en-US', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0),
)

const isPayDialogOpen = ref(false)
const isProcessing = ref(false)
const bricksLoaded = ref(false)
const brickController = ref(null)
const mpBrickContainer = ref(null)
const useFallbackForm = ref(false)
const payForm = ref({ cardNumber: '', expiry: '', cvv: '', holder: '' })

function openPayDialog() {
  payForm.value = { cardNumber: '', expiry: '', cvv: '', holder: '' }
  useFallbackForm.value = false
  bricksLoaded.value = false
  isPayDialogOpen.value = true
}

watch(isPayDialogOpen, async (open) => {
  if (!open) {
    if (brickController.value) {
      try {
        brickController.value.unmount()
      } catch {
        /* ignore */
      }
      brickController.value = null
    }
    return
  }

  await nextTick()
  await new Promise((r) => setTimeout(r, 300))

  const container = mpBrickContainer.value
  if (!container) {
    useFallbackForm.value = true
    return
  }

  const amount = nextDueFee.value?.amount ?? pendingTotal.value
  const ctrl = await renderCardPaymentBrick(container, {
    amount,
    onSubmit: async (cardFormData) => {
      await handleBricksPayment(cardFormData)
    },
    onError: () => {
      useFallbackForm.value = true
    },
  })

  if (ctrl) {
    brickController.value = ctrl
    bricksLoaded.value = true
  } else {
    useFallbackForm.value = true
  }
})

async function handleBricksPayment(cardFormData) {
  isProcessing.value = true
  try {
    const result = await processCardPayment({
      ...cardFormData,
      transaction_amount: nextDueFee.value?.amount ?? 0,
    })
    await recordSuccessfulPayment(result)
  } catch {
    toast.add({
      severity: 'error',
      summary: t('residentFinance.paymentErrorTitle'),
      detail: t('residentFinance.paymentErrorDetail'),
      life: 4000,
    })
  } finally {
    isProcessing.value = false
  }
}

async function confirmFallbackPayment() {
  isProcessing.value = true
  try {
    const result = await processCardPayment({
      token: 'DEMO-TOKEN',
      payment_method_id: 'visa',
      transaction_amount: nextDueFee.value?.amount ?? 0,
      installments: 1,
      payer: { email: profile.value.email || 'demo@buildingfex.com' },
    })
    await recordSuccessfulPayment(result)
  } catch {
    toast.add({
      severity: 'error',
      summary: t('residentFinance.paymentErrorTitle'),
      detail: t('residentFinance.paymentErrorDetail'),
      life: 4000,
    })
  } finally {
    isProcessing.value = false
  }
}

async function recordSuccessfulPayment(result) {
  const record = await recordPayment(result, profile.value.id)
  if (record) {
    isPayDialogOpen.value = false
    toast.add({
      severity: 'success',
      summary: t('residentFinance.paymentSuccessTitle'),
      detail: t('residentFinance.paymentSuccessDetail'),
      life: 4000,
    })
  } else {
    toast.add({
      severity: 'error',
      summary: t('residentFinance.paymentErrorTitle'),
      detail: t('residentFinance.paymentErrorDetail'),
      life: 4000,
    })
  }
}

function formatExpirySlash() {
  let val = String(payForm.value.expiry ?? '').replace(/\D/g, '')
  if (val.length > 2) {
    val = `${val.substring(0, 2)}/${val.substring(2, 4)}`
  }
  payForm.value.expiry = val
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const loc = locale.value === 'es' ? 'es-PE' : 'en-US'
  return `${d.toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`
}
</script>

<template>
  <div class="app-view">
    <Toast position="top-right" />

    <h1 class="app-view__title">{{ t('resident.paymentsTitle') }}</h1>
    <p class="app-view__subtitle">
      {{ t('resident.paymentsSubtitle', { name: profile.name || '' }) }}
    </p>

    <div class="incidents-page">
      <p v-if="paymentState.error" class="app-view__error incidents-page__error" role="alert">
        {{ paymentState.error }}
      </p>

      <section class="incidents-panel" aria-labelledby="resident-payments-fees-heading">
        <header class="incidents-panel__head">
          <div class="resident-payments-summary">
            <h2 id="resident-payments-fees-heading" class="incidents-panel__title resident-payments-summary__title">
              {{ t('residentFinance.feeHistory') }}
            </h2>
            <p class="resident-payments-summary__due">
              <span class="resident-payments-summary__label">{{ t('residentFinance.totalDue') }}</span>
              <span class="resident-payments-summary__amount" :class="{ 'resident-payments-summary__amount--overdue': hasOverdue }">
                {{ nfPen(pendingTotal) }}
              </span>
              <span v-if="nextDueFee" class="resident-payments-summary__hint">
                {{ nextDueFee.month }}
                <template v-if="hasOverdue"> · {{ t('residentFinance.overdueWarning') }}</template>
              </span>
            </p>
          </div>
          <Button
            type="button"
            rounded
            :severity="hasOverdue ? 'danger' : 'secondary'"
            :label="t('residentFinance.payNow')"
            class="incidents-panel__btn"
            :disabled="pendingTotal === 0 || paymentState.isLoading"
            @click="openPayDialog"
          />
        </header>

        <DataTable
          :value="fees"
          responsiveLayout="scroll"
          :loading="paymentState.isLoading"
          class="incidents-data incidents-table"
        >
          <Column field="month" :header="t('residentFinance.colMonth')" />
          <Column :header="t('residentFinance.colAmount')">
            <template #body="{ data }">
              <span class="resident-payments-amount">{{ nfPen(Number(data.amount) || 0) }}</span>
            </template>
          </Column>
          <Column field="dueDate" :header="t('residentFinance.colDueDate')" />
          <Column :header="t('residentFinance.colBillingStatus')">
            <template #body="{ data }">
              <Tag class="incidents-status-tag" :value="feeStatusLabel(data)" :severity="feeSeverity(data)" rounded />
            </template>
          </Column>
        </DataTable>
      </section>

      <section class="incidents-panel" aria-labelledby="resident-payments-history-heading">
        <h2 id="resident-payments-history-heading" class="resident-payments-section-heading">
          {{ t('residentFinance.paymentHistoryTab') }}
        </h2>
        <p
          v-if="!paymentHistory.length && !paymentState.isLoading"
          class="resident-payments-empty"
        >
          {{ t('residentFinance.noPaymentsYet') }}
        </p>
        <DataTable
          v-else
          :value="paymentHistory"
          responsiveLayout="scroll"
          :loading="paymentState.isLoading"
          class="incidents-data incidents-table"
        >
          <Column field="feeMonth" :header="t('residentFinance.colMonth')" />
          <Column :header="t('residentFinance.colAmount')">
            <template #body="{ data }">
              <span class="resident-payments-amount">{{ nfPen(Number(data.amount) || 0) }}</span>
            </template>
          </Column>
          <Column :header="t('residentFinance.colPaidAt')">
            <template #body="{ data }">
              {{ formatDateTime(data.paidAt) }}
            </template>
          </Column>
          <Column field="method" :header="t('residentFinance.colMethod')" />
          <Column field="reference" :header="t('residentFinance.colReference')" />
        </DataTable>
      </section>
    </div>

    <Dialog
      v-model:visible="isPayDialogOpen"
      modal
      :header="t('residentFinance.payDialogTitle')"
      :style="{ width: 'min(32rem, 94vw)' }"
      class="resident-payments-dialog"
      :draggable="false"
    >
      <div class="resident-payments-dialog__summary">
        <span>{{ t('residentFinance.totalDue') }}</span>
        <strong>{{ nfPen(nextDueFee?.amount ?? pendingTotal) }}</strong>
      </div>

      <div ref="mpBrickContainer" v-show="!useFallbackForm" class="resident-payments-dialog__brick" />

      <div
        v-if="!bricksLoaded && !useFallbackForm"
        class="resident-payments-dialog__loading"
      >
        <span class="resident-payments-dialog__loading-text">{{ t('residentFinance.loadingMP') }}</span>
      </div>

      <div v-if="useFallbackForm" class="resident-payments-dialog__fallback">
        <Message severity="info" :closable="false" class="resident-payments-dialog__demo-msg">
          {{ t('residentFinance.demoMode') }}
        </Message>
        <div class="resident-payments-dialog__field">
          <label for="rp-card-number">{{ t('residentFinance.cardNumber') }}</label>
          <InputText
            id="rp-card-number"
            v-model="payForm.cardNumber"
            placeholder="0000 0000 0000 0000"
            maxlength="19"
            fluid
          />
        </div>
        <div class="resident-payments-dialog__row">
          <div class="resident-payments-dialog__field">
            <label for="rp-expiry">{{ t('residentFinance.expiry') }}</label>
            <InputText
              id="rp-expiry"
              v-model="payForm.expiry"
              placeholder="MM/YY"
              maxlength="5"
              fluid
              @update:model-value="formatExpirySlash"
            />
          </div>
          <div class="resident-payments-dialog__field">
            <label for="rp-cvv">{{ t('residentFinance.cvv') }}</label>
            <InputText id="rp-cvv" v-model="payForm.cvv" placeholder="•••" maxlength="4" fluid />
          </div>
        </div>
        <div class="resident-payments-dialog__field">
          <label for="rp-holder">{{ t('residentFinance.cardHolder') }}</label>
          <InputText
            id="rp-holder"
            v-model="payForm.holder"
            :placeholder="t('residentFinance.cardHolderPlaceholder')"
            fluid
          />
        </div>
      </div>

      <template #footer>
        <Button
          type="button"
          text
          rounded
          :label="t('app.cancelAction')"
          :disabled="isProcessing"
          @click="isPayDialogOpen = false"
        />
        <Button
          v-if="useFallbackForm"
          type="button"
          rounded
          :label="isProcessing ? t('residentFinance.processing') : t('residentFinance.confirmPay')"
          :loading="isProcessing"
          @click="confirmFallbackPayment"
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
  max-width: 36rem;
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.45;
  letter-spacing: -0.015em;
  color: var(--apple-text-secondary, #6e6e73);
}

.app-view__error {
  margin: 0;
  font-size: 0.8125rem;
  color: #b42318;
}

.incidents-page {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.incidents-page__error {
  margin: 0;
}

.incidents-panel {
  padding: 1.2rem 1.25rem 1.35rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.incidents-panel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem 1rem;
  margin-bottom: 0.85rem;
}

.incidents-panel__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--apple-text, #1d1d1f);
  max-width: min(100%, 18rem);
}

.incidents-panel__btn {
  flex-shrink: 0;
}

.incidents-panel__btn :deep(.p-button) {
  font-weight: 500;
  font-size: 0.8125rem;
  padding-block: 0.5rem;
  padding-inline: 1rem;
}

.resident-payments-summary {
  flex: 1;
  min-width: 0;
}

.resident-payments-summary__title {
  max-width: none;
}

.resident-payments-summary__due {
  margin: 0.5rem 0 0;
}

.resident-payments-summary__label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #86868b;
}

.resident-payments-summary__amount {
  display: block;
  margin-top: 0.2rem;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--apple-text, #1d1d1f);
}

.resident-payments-summary__amount--overdue {
  color: #d70015;
}

.resident-payments-summary__hint {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.resident-payments-section-heading {
  margin: 0 0 0.85rem;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--apple-text, #1d1d1f);
}

.resident-payments-empty {
  margin: 0;
  padding: 0.75rem 0 0.25rem;
  font-size: 0.875rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.resident-payments-amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.incidents-table {
  margin-top: 0.15rem;
}

.incidents-data :deep(.p-datatable) {
  font-size: 0.875rem;
  border: none;
  border-radius: 12px;
  overflow: hidden;
}

.incidents-data :deep(.p-datatable-wrapper) {
  border-radius: 12px;
}

.incidents-data :deep(.p-datatable-header) {
  background: transparent;
  border: none;
  padding: 0;
}

.incidents-data :deep(.p-datatable-loading-overlay) {
  background: rgba(255, 255, 255, 0.75);
}

.incidents-data :deep(.p-datatable-thead > tr > th) {
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

.incidents-data :deep(.p-datatable-tbody > tr) {
  background: transparent;
  transition: background 0.12s ease;
}

.incidents-data :deep(.p-datatable-tbody > tr:hover) {
  background: rgba(0, 0, 0, 0.02);
}

.incidents-data :deep(.p-datatable-tbody > tr > td) {
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 0.7rem 0.75rem;
  vertical-align: middle;
  color: var(--apple-text, #1d1d1f);
}

.incidents-data :deep(.p-datatable-tbody > tr:last-child > td) {
  border-bottom: none;
}

.incidents-status-tag :deep(.p-tag) {
  border-radius: 980px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 0.3rem 0.65rem;
}

.resident-payments-dialog :deep(.p-dialog-header) {
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--apple-text, #1d1d1f);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 1rem 1.25rem;
}

.resident-payments-dialog :deep(.p-dialog-content) {
  padding: 1.15rem 1.25rem 1.25rem;
}

.resident-payments-dialog :deep(.p-dialog-footer) {
  gap: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0.85rem 1.25rem;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.resident-payments-dialog__summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 12px;
  background: #f5f5f7;
  border: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 0.875rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.resident-payments-dialog__summary strong {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
  font-variant-numeric: tabular-nums;
}

.resident-payments-dialog__brick {
  min-height: 100px;
}

.resident-payments-dialog__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 0;
  color: var(--apple-text-secondary, #6e6e73);
  font-size: 0.875rem;
}

.resident-payments-dialog__fallback {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.resident-payments-dialog__demo-msg {
  margin: 0;
}

.resident-payments-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.resident-payments-dialog__field label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
}

.resident-payments-dialog__row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.resident-payments-dialog__row .resident-payments-dialog__field {
  flex: 1;
  min-width: 7rem;
}

.resident-payments-dialog :deep(.p-inputtext) {
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  font-size: 0.9375rem;
  color: var(--apple-text, #1d1d1f);
}

.resident-payments-dialog :deep(.p-inputtext:enabled:focus) {
  outline: none;
  border-color: #0a84ff;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
}
</style>
