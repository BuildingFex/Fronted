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

  const amount = nextDueFee.value?.amount ?? pendingTotal.value
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
      transaction_amount: nextDueFee.value?.amount ?? 0,
    })
    recordSuccessfulPayment(result)
  } catch {
    toast.add({ severity: 'error', summary: t('residentFinance.paymentErrorTitle'), detail: t('residentFinance.paymentErrorDetail'), life: 4000 })
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
    recordSuccessfulPayment(result)
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

    <div class="view-header">
      <h1 class="text-2xl font-bold m-0">{{ t('resident.financeTitle') }}</h1>
      <p class="text-color-secondary mt-2 mb-4">
        {{ t('resident.financeSubtitle', { name: profile.name || '' }) }}
      </p>
    </div>

    <Message v-if="paymentState.error" severity="error" :closable="false" class="mb-4">
      {{ paymentState.error }}
    </Message>

    <Card class="mb-4">
      <template #content>
        <div class="flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <span class="text-color-secondary font-medium block mb-1">{{ t('residentFinance.totalDue') }}</span>
            <strong class="text-4xl block" :class="{ 'text-red-500': hasOverdue }">
              S/ {{ pendingTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 }) }}
            </strong>
            <span v-if="nextDueFee" class="text-sm font-semibold" :class="hasOverdue ? 'text-red-500' : 'text-primary'">
              {{ nextDueFee.month }}
              <template v-if="hasOverdue"> · {{ t('residentFinance.overdueWarning') }}</template>
            </span>
          </div>
          <Button
            :label="t('residentFinance.payNow')"
            icon="pi pi-credit-card"
            :severity="hasOverdue ? 'danger' : 'primary'"
            :disabled="pendingTotal === 0 || paymentState.isLoading"
            @click="openPayDialog"
          />
        </div>
      </template>
    </Card>

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
              <DataTable :value="fees" responsiveLayout="scroll" :loading="paymentState.isLoading">
                <Column field="month" :header="t('residentFinance.colMonth')" />
                <Column :header="t('residentFinance.colAmount')">
                  <template #body="{ data }">
                    <span class="font-semibold">S/ {{ data.amount.toFixed(2) }}</span>
                  </template>
                </Column>
                <Column field="dueDate" :header="t('residentFinance.colDueDate')" />
                <Column :header="t('residentFinance.colBillingStatus')">
                  <template #body="{ data }">
                    <Tag :value="feeStatusLabel(data)" :severity="feeSeverity(data)" rounded />
                  </template>
                </Column>
              </DataTable>
            </TabPanel>

            <TabPanel value="1">
              <p v-if="!paymentHistory.length && !paymentState.isLoading" class="text-center text-color-secondary my-4">
                {{ t('residentFinance.noPaymentsYet') }}
              </p>
              <DataTable v-else :value="paymentHistory" responsiveLayout="scroll" :loading="paymentState.isLoading">
                <Column field="feeMonth" :header="t('residentFinance.colMonth')" />
                <Column :header="t('residentFinance.colAmount')">
                  <template #body="{ data }">
                    <span class="font-semibold">S/ {{ data.amount.toFixed(2) }}</span>
                  </template>
                </Column>
                <Column :header="t('residentFinance.colPaidAt')">
                  <template #body="{ data }">
                    <span>{{ formatDateTime(data.paidAt) }}</span>
                  </template>
                </Column>
                <Column field="method" :header="t('residentFinance.colMethod')">
                  <template #body="{ data }">
                    <span class="text-primary font-semibold"><i class="pi pi-wallet mr-1" aria-hidden="true"></i> {{ data.method }}</span>
                  </template>
                </Column>
                <Column field="reference" :header="t('residentFinance.colReference')" />
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
        <span>{{ t('residentFinance.totalDue') }}</span>
        <strong class="text-xl">S/ {{ (nextDueFee?.amount ?? 0).toFixed(2) }}</strong>
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
        <Button :label="t('app.cancelAction')" icon="pi pi-times" severity="secondary" outlined @click="isPayDialogOpen = false" :disabled="isProcessing" />
        <Button
          v-if="useFallbackForm"
          :label="isProcessing ? t('residentFinance.processing') : t('residentFinance.confirmPay')"
          icon="pi pi-check"
          :loading="isProcessing"
          @click="confirmFallbackPayment"
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
</style>

