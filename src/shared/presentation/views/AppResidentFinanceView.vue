<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSession } from '@/iam/application/sessionStore.js'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Toast from 'primevue/toast'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Card from 'primevue/card'
import Message from 'primevue/message'
import ConfirmActions from '@/shared/presentation/components/ConfirmActions.vue'
import { useToast } from 'primevue/usetoast'
import {
  renderCardPaymentBrick,
  processCardPayment,
} from '@/finances/infrastructure/mercadoPagoService.js'
import { useResidentPaymentStore } from '@/finances/application/residentPaymentStore.js'

const { t } = useI18n()
const { state } = useSession()
const { state: paymentState, recordPayment, loadData } = useResidentPaymentStore()

const profile = computed(() => state.profile ?? {})
const toast = useToast()

const todayIso = new Date().toISOString().slice(0, 10)

const fees = computed(() => paymentState.fees || [])
const paymentHistory = computed(() => paymentState.paymentHistory || [])

onMounted(() => {
  if (profile.value.id) {
    loadData(profile.value.id)
  }
})

function getDaysUntilDue(dueDate) {
  const due = new Date(dueDate + 'T00:00:00')
  const now = new Date(todayIso + 'T00:00:00')
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
  fees.value.filter((f) => f.status === 'Pendiente').reduce((sum, f) => sum + f.amount, 0),
)

const nextDueFee = computed(() => {
  const pending = fees.value.filter((f) => f.status === 'Pendiente')
  return pending.length ? pending[0] : null
})

const hasOverdue = computed(() =>
  fees.value.some((f) => f.status === 'Pendiente' && getDaysUntilDue(f.dueDate) < 0),
)

const totalPaid = computed(() =>
  paymentHistory.value.reduce((sum, p) => sum + p.amount, 0),
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
      try { brickController.value.unmount() } catch { /* ignore */ }
      brickController.value = null
    }
    return
  }

  await nextTick()
  await new Promise((r) => setTimeout(r, 300))

  const container = mpBrickContainer.value
  if (!container) { useFallbackForm.value = true; return }

  const amount = pendingTotal.value
  const ctrl = await renderCardPaymentBrick(container, {
    amount,
    onSubmit: async (cardFormData) => { await handleBricksPayment(cardFormData) },
    onError: () => { useFallbackForm.value = true },
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
      transaction_amount: pendingTotal.value,
    })
    await recordSuccessfulPayment(result)
  } catch {
    toast.add({ severity: 'error', summary: t('residentFinance.paymentErrorTitle'), detail: t('residentFinance.paymentErrorDetail'), life: 4000 })
  } finally {
    isProcessing.value = false
  }
}

async function confirmFallbackPayment() {
  isProcessing.value = true
  try {
    // In demo mode, we record the payment directly through the store
    // instead of calling the MercadoPago API endpoint
    const demoResult = {
      id: `DEMO-${Date.now()}`,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: pendingTotal.value,
      payment_method_id: 'visa',
      date_approved: new Date().toISOString(),
    }
    await recordSuccessfulPayment(demoResult)
  } catch {
    toast.add({ severity: 'error', summary: t('residentFinance.paymentErrorTitle'), detail: t('residentFinance.paymentErrorDetail'), life: 4000 })
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

function formatExpiryDate(event) {
  let val = event.target.value.replace(/\D/g, '')
  if (val.length > 2) {
    val = val.substring(0, 2) + '/' + val.substring(2, 4)
  }
  payForm.value.expiry = val
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

const activeTab = ref('0')
</script>

<template>
  <div class="view-container">
    <Toast position="top-right" />

    <div class="page-header">
      <h1 class="page-title">{{ t('resident.financeTitle') }}</h1>
      <p class="page-subtitle">
        {{ t('resident.financeSubtitle', { name: profile.name || '' }) }}
      </p>
    </div>

    <Message v-if="paymentState.error" severity="error" :closable="false" class="error-msg">
      {{ paymentState.error }}
    </Message>

    <!-- KPI CARDS GRID (Pure CSS Layout) -->
    <div class="kpi-grid custom-scrollbar">
      <!-- Card 1: Total Paid -->
      <div class="kpi-card">
        <div class="kpi-header">
          <div class="kpi-icon icon-purple">
            <i class="pi pi-wallet" aria-hidden="true"></i>
          </div>
          <span class="kpi-label">{{ t('residentFinance.kpiTotalPaid', 'Historial Pagado') }}</span>
        </div>
        <div class="kpi-value">S/ {{ totalPaid.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
        <span class="kpi-subtext subtext-green">
          <i class="pi pi-arrow-up" aria-hidden="true"></i> {{ paymentHistory.length }} pagos realizados
        </span>
      </div>

      <!-- Card 2: Pending Payments -->
      <div class="kpi-card" :class="{ 'card-danger': hasOverdue }">
        <div class="kpi-header">
          <div class="kpi-icon" :class="hasOverdue ? 'icon-red' : 'icon-orange'">
            <i class="pi pi-clock" aria-hidden="true"></i>
          </div>
          <span class="kpi-label">{{ t('residentFinance.kpiPending', 'Monto Pendiente') }}</span>
        </div>
        <div class="kpi-value" :class="{ 'text-red': hasOverdue }">S/ {{ pendingTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}</div>
        <span v-if="hasOverdue" class="kpi-subtext subtext-red">
          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i> Tienes cuotas vencidas
        </span>
        <span v-else class="kpi-subtext">
          <i class="pi pi-check" aria-hidden="true"></i> Al día con tus pagos
        </span>
      </div>

      <!-- Card 3: Next Fee Month -->
      <div class="kpi-card relative-overflow">
        <div class="kpi-header">
          <div class="kpi-icon icon-blue">
            <i class="pi pi-calendar" aria-hidden="true"></i>
          </div>
          <span class="kpi-label">{{ t('residentFinance.kpiNextFee', 'Próxima Cuota') }}</span>
        </div>
        <div class="kpi-value">{{ nextDueFee?.month || '—' }}</div>
        <span class="kpi-subtext">
          Vence: {{ nextDueFee?.dueDate || 'Sin deuda' }}
        </span>
      </div>

      <!-- Card 4: Action / Pay Now -->
      <div class="kpi-card kpi-action-card">
        <Button
          :label="t('residentFinance.payNow')"
          icon="pi pi-credit-card"
          :severity="hasOverdue ? 'danger' : 'primary'"
          size="large"
          class="pay-btn"
          :disabled="pendingTotal === 0 || paymentState.isLoading"
          @click="openPayDialog"
        />
        <span class="kpi-subtext text-center mt-2">
          Pago seguro procesado por Mercado Pago
        </span>
      </div>
    </div>

    <Card>
      <template #content>
        <Tabs v-model:value="activeTab">
          <TabList>
            <Tab value="0">
              <i class="pi pi-list mr-2" aria-hidden="true"></i>
              {{ t('residentFinance.feeHistory') }}
            </Tab>
            <Tab value="1">
              <i class="pi pi-check-circle mr-2" aria-hidden="true"></i>
              {{ t('residentFinance.paymentHistoryTab') }}
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel value="0">
              <DataTable :value="fees" responsiveLayout="scroll" :loading="paymentState.isLoading" class="premium-table">
                <Column field="concept" :header="t('residentFinance.colConcept', 'Concepto')" />
                <Column field="month" :header="t('residentFinance.colMonth')" />
                <Column :header="t('residentFinance.colAmount')">
                  <template #body="{ data }">
                    <span class="font-semibold text-900">S/ {{ data.amount.toFixed(2) }}</span>
                  </template>
                </Column>
                <Column field="dueDate" :header="t('residentFinance.colDueDate')" />
                <Column :header="t('residentFinance.colBillingStatus')">
                  <template #body="{ data }">
                    <Tag :value="feeStatusLabel(data)" :severity="feeSeverity(data)" rounded class="px-3" />
                  </template>
                </Column>
              </DataTable>
            </TabPanel>

            <TabPanel value="1">
              <p v-if="!paymentHistory.length && !paymentState.isLoading" class="text-center text-color-secondary my-4">
                {{ t('residentFinance.noPaymentsYet') }}
              </p>
              <DataTable v-else :value="paymentHistory" responsiveLayout="scroll" :loading="paymentState.isLoading" class="premium-table">
                <Column field="concept" :header="t('residentFinance.colConcept', 'Concepto')" />
                <Column field="feeMonth" :header="t('residentFinance.colMonth')" />
                <Column :header="t('residentFinance.colAmount')">
                  <template #body="{ data }">
                    <span class="font-semibold text-900">S/ {{ data.amount.toFixed(2) }}</span>
                  </template>
                </Column>
                <Column :header="t('residentFinance.colPaidAt')">
                  <template #body="{ data }">
                    <span class="text-500">{{ formatDateTime(data.paidAt) }}</span>
                  </template>
                </Column>
                <Column field="method" :header="t('residentFinance.colMethod')">
                  <template #body="{ data }">
                    <span class="text-primary font-semibold"><i class="pi pi-wallet mr-1" aria-hidden="true"></i> {{ data.method }}</span>
                  </template>
                </Column>
                <Column field="reference" :header="t('residentFinance.colReference')">
                  <template #body="{ data }">
                     <span class="text-500">{{ data.reference }}</span>
                  </template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <Dialog
      v-model:visible="isPayDialogOpen"
      modal
      :header="t('residentFinance.payDialogTitle')"
      :style="{ width: 'min(32rem, 94vw)' }"
      :draggable="false"
    >
      <div class="p-3 border-round bg-gray-100 border-1 border-gray-300 flex justify-content-between align-items-center mb-3">
        <div class="flex flex-column">
          <span class="text-sm text-color-secondary">{{ t('residentFinance.totalDue', 'Total Acumulado a Pagar') }}</span>
          <span class="text-xs text-orange-500 font-semibold" v-if="fees.filter(f => f.status === 'Pendiente').length > 1">
            {{ fees.filter(f => f.status === 'Pendiente').length }} cuotas pendientes
          </span>
        </div>
        <strong class="text-2xl text-primary">S/ {{ pendingTotal.toFixed(2) }}</strong>
      </div>

      <div ref="mpBrickContainer" v-show="!useFallbackForm" style="min-height: 100px;"></div>

      <div v-if="!bricksLoaded && !useFallbackForm" class="flex flex-column align-items-center gap-3 py-4 text-color-secondary">
        <i class="pi pi-spin pi-spinner text-2xl text-primary" aria-hidden="true"></i>
        <span>{{ t('residentFinance.loadingMP') }}</span>
      </div>

      <div v-if="useFallbackForm" class="flex flex-column gap-3">
        <Message severity="info" :closable="false" class="mb-2">
          <i class="pi pi-wallet mr-2" aria-hidden="true"></i> Mercado Pago · {{ t('residentFinance.demoMode') }}
        </Message>

        <div class="flex flex-column gap-1">
          <label for="rf-card-number" class="text-sm font-semibold text-color-secondary">{{ t('residentFinance.cardNumber') }}</label>
          <InputText id="rf-card-number" v-model="payForm.cardNumber" placeholder="0000 0000 0000 0000" maxlength="19" class="w-full" />
        </div>
        <div class="flex gap-3">
          <div class="flex flex-column gap-1 flex-1">
            <label for="rf-expiry" class="text-sm font-semibold text-color-secondary">{{ t('residentFinance.expiry') }}</label>
            <InputText id="rf-expiry" v-model="payForm.expiry" @input="formatExpiryDate" placeholder="MM/YY" maxlength="5" class="w-full" />
          </div>
          <div class="flex flex-column gap-1 flex-1">
            <label for="rf-cvv" class="text-sm font-semibold text-color-secondary">{{ t('residentFinance.cvv') }}</label>
            <InputText id="rf-cvv" v-model="payForm.cvv" placeholder="•••" maxlength="4" class="w-full" />
          </div>
        </div>
        <div class="flex flex-column gap-1">
          <label for="rf-holder" class="text-sm font-semibold text-color-secondary">{{ t('residentFinance.cardHolder') }}</label>
          <InputText id="rf-holder" v-model="payForm.holder" :placeholder="t('residentFinance.cardHolderPlaceholder')" class="w-full" />
        </div>
      </div>

      <template #footer>
        <ConfirmActions
          :cancel-label="t('app.cancelAction')"
          :confirm-label="isProcessing ? t('residentFinance.processing') : t('residentFinance.confirmPay')"
          cancel-icon="pi pi-times"
          confirm-icon="pi pi-check"
          :show-confirm="useFallbackForm"
          :loading="isProcessing"
          :cancel-disabled="isProcessing"
          @cancel="isPayDialogOpen = false"
          @confirm="confirmFallbackPayment"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.view-container {
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
.error-msg {
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* KPI GRID CSS */
.kpi-grid {
  display: flex;
  flex-direction: row;
  gap: 1.25rem;
  margin-bottom: 2rem;
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
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
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

.icon-purple {
  background: #f3e8ff;
  color: #9333ea;
}

.icon-orange {
  background: #ffedd5;
  color: #ea580c;
}

.icon-red {
  background: #fee2e2;
  color: #dc2626;
}

.icon-blue {
  background: #e0f2fe;
  color: #0284c7;
}

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

.subtext-green { color: #16a34a; }
.subtext-red { color: #dc2626; }
.text-red { color: #dc2626 !important; }
.card-danger { background: #fff5f5; border-color: #fecaca; }

.kpi-action-card {
  background: linear-gradient(135deg, rgba(10, 132, 255, 0.05) 0%, transparent 100%);
  justify-content: center;
  align-items: center;
}

.pay-btn {
  width: 100%;
  padding: 1rem;
  border-radius: 12px;
  font-weight: 600;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.pay-btn:not(:disabled):hover {
  transform: translateY(-2px);
}

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

/* Premium DataTable Styling matching reference image */
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
</style>

