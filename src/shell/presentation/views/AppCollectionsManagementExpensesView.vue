<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { adminManagementExpensesApi } from '@/finances/infrastructure/adminManagementExpensesApi.js'
import { useFinancesStore } from '@/finances/application/financesStore.js'

const { t, locale } = useI18n()
const { state, loadData } = useFinancesStore()

const expenses = ref([])
const costsLoading = ref(false)
const costsLoadError = ref('')

const modalOpen = ref(false)
const saving = ref(false)
const submitError = ref('')
const processingPhoto = ref(false)

const form = reactive({
  name: '',
  amount: null,
  purchaseDate: '',
  invoicePhotoUrl: '',
})

const MAX_IMAGE_DIMENSION = 1024
const IMAGE_OUTPUT_QUALITY = 0.82

function receiptTotalPaid(r) {
  if (!r || r.status !== 'Paid') return 0
  if (typeof r.getTotalAmount === 'function') {
    return Number(r.getTotalAmount()) || 0
  }
  return (Number(r.amount) || 0) + (Number(r.lateFee) || 0)
}

const grossCollected = computed(() =>
  state.receipts.reduce((sum, r) => sum + receiptTotalPaid(r), 0),
)

const totalCosts = computed(() =>
  expenses.value.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
)

const balanceAfterCosts = computed(() => grossCollected.value - totalCosts.value)

const nfCurrency = computed(
  () => (value) =>
    new Intl.NumberFormat(locale.value === 'es' ? 'es-PE' : 'en-US', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0),
)

const nfDate = computed(
  () => (isoOrYmd) => {
    const s = String(isoOrYmd ?? '').trim()
    if (!s) return '—'
    const d =
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s)
    if (!Number.isFinite(d.getTime())) return s
    return new Intl.DateTimeFormat(locale.value === 'es' ? 'es-PE' : 'en-US').format(d)
  },
)

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_ERROR'))
    reader.readAsDataURL(file)
  })
}

async function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('IMAGE_DECODE_ERROR'))
    img.src = dataUrl
  })
}

async function processImageFile(file) {
  if (!file || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
    throw new Error('IMAGE_INVALID')
  }
  const originalDataUrl = await readFileAsDataUrl(file)
  const img = await loadImageElement(originalDataUrl)

  const ratio = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(img.naturalWidth || 1, img.naturalHeight || 1),
  )
  const width = Math.max(1, Math.round((img.naturalWidth || 1) * ratio))
  const height = Math.max(1, Math.round((img.naturalHeight || 1) * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('IMAGE_CANVAS_ERROR')
  context.drawImage(img, 0, 0, width, height)
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  return canvas.toDataURL(mime, IMAGE_OUTPUT_QUALITY)
}

async function loadCosts() {
  costsLoading.value = true
  costsLoadError.value = ''
  try {
    expenses.value = await adminManagementExpensesApi.list()
  } catch {
    costsLoadError.value = t('collectionsMgmt.loadCostsError')
    expenses.value = []
  } finally {
    costsLoading.value = false
  }
}

function resetForm() {
  form.name = ''
  form.amount = null
  form.purchaseDate = ''
  form.invoicePhotoUrl = ''
  submitError.value = ''
}

function openModal() {
  resetForm()
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

async function onInvoiceChange(event) {
  const input = event.target
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  processingPhoto.value = true
  submitError.value = ''
  try {
    form.invoicePhotoUrl = await processImageFile(file)
  } catch {
    submitError.value = t('collectionsMgmt.invoiceInvalid')
    form.invoicePhotoUrl = ''
  } finally {
    processingPhoto.value = false
  }
}

async function submitCost() {
  if (saving.value) return
  submitError.value = ''

  const amt =
    form.amount === null || form.amount === undefined || form.amount === ''
      ? Number.NaN
      : Number(form.amount)

  if (!form.name.trim() || !Number.isFinite(amt) || !String(form.purchaseDate).trim()) {
    submitError.value = t('collectionsMgmt.requiredCostFields')
    return
  }

  saving.value = true
  try {
    await adminManagementExpensesApi.add({
      name: form.name,
      amount: amt,
      purchaseDate: form.purchaseDate,
      invoicePhotoUrl: form.invoicePhotoUrl,
    })
    closeModal()
    await loadCosts()
  } catch (err) {
    if (err?.code === 'ADMIN_EXPENSE_FIELDS_REQUIRED') {
      submitError.value = t('collectionsMgmt.requiredCostFields')
    } else {
      submitError.value = t('collectionsMgmt.saveCostError')
    }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadData()
  loadCosts()
})
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('app.collectionsManagementExpenses') }}</h1>

    <p v-if="state.isLoading" class="app-view__status">{{ t('collectionsMgmt.loading') }}</p>
    <p v-else-if="state.error" class="app-view__error" role="alert">
      {{ t('collectionsMgmt.loadError') }}
    </p>

    <template v-else>
      <section class="collections-total" aria-labelledby="collections-balance-heading">
        <h2 id="collections-balance-heading" class="collections-total__label">
          {{ t('collectionsMgmt.netAfterExpenses') }}
        </h2>
        <p class="collections-total__amount">{{ nfCurrency(balanceAfterCosts) }}</p>
        <p class="collections-total__breakdown">
          {{ t('collectionsMgmt.grossCollectedShort') }}:
          {{ nfCurrency(grossCollected) }}
          ·
          {{ t('collectionsMgmt.expensesTotalShort') }}: {{ nfCurrency(totalCosts) }}
        </p>
        <p class="collections-total__hint">{{ t('collectionsMgmt.amountHint') }}</p>
      </section>

      <section class="collections-costs" aria-labelledby="collections-costs-heading">
        <div class="collections-costs__head">
          <h2 id="collections-costs-heading" class="collections-costs__title">
            {{ t('collectionsMgmt.expensesSectionTitle') }}
          </h2>
          <Button
            type="button"
            outlined
            :label="t('collectionsMgmt.addCost')"
            icon="pi pi-plus"
            severity="success"
            @click="openModal"
          />
        </div>

        <Dialog
          v-model:visible="modalOpen"
          modal
          :header="t('collectionsMgmt.modalTitle')"
          class="collections-cost-dialog"
          :style="{ width: 'min(26rem, 92vw)' }"
          :draggable="false"
        >
          <div class="collections-form">
            <div class="collections-form__field">
              <label for="collections-cost-name">{{ t('collectionsMgmt.nameLabel') }}</label>
              <InputText
                id="collections-cost-name"
                v-model="form.name"
                class="collections-form__input"
                autocomplete="off"
                fluid
              />
            </div>
            <div class="collections-form__field">
              <label for="collections-cost-amount">{{ t('collectionsMgmt.priceLabel') }}</label>
              <InputNumber
                id="collections-cost-amount"
                v-model="form.amount"
                class="collections-form__input-num w-full"
                :min="0"
                mode="decimal"
                :maxFractionDigits="2"
                fluid
              />
            </div>
            <div class="collections-form__field">
              <label for="collections-cost-date">{{ t('collectionsMgmt.purchaseDateLabel') }}</label>
              <InputText
                id="collections-cost-date"
                v-model="form.purchaseDate"
                class="collections-form__input collections-form__input--date"
                type="date"
                fluid
              />
            </div>
            <div class="collections-form__field collections-form__field--photo">
              <span class="collections-form__photo-label">{{ t('collectionsMgmt.invoiceLabel') }}</span>
              <p class="collections-form__hint">{{ t('collectionsMgmt.invoiceHint') }}</p>
              <label class="collections-form__file">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  class="collections-form__file-input"
                  :disabled="processingPhoto || saving"
                  @change="onInvoiceChange"
                />
                <span class="collections-form__file-trigger">{{
                  processingPhoto ? t('collectionsMgmt.processingPhoto') : t('collectionsMgmt.invoiceChoose')
                }}</span>
              </label>
              <div v-if="form.invoicePhotoUrl" class="collections-form__preview-row">
                <img
                  :src="form.invoicePhotoUrl"
                  :alt="
                    form.name.trim() ? form.name.trim() : t('collectionsMgmt.invoiceLabel')
                  "
                  class="collections-form__preview"
                  width="80"
                  height="80"
                />
                <Button
                  type="button"
                  :label="t('collectionsMgmt.removePhoto')"
                  variant="text"
                  text
                  @click="form.invoicePhotoUrl = ''"
                />
              </div>
            </div>
            <p v-if="submitError" class="collections-form__error" role="alert">{{ submitError }}</p>
          </div>
          <template #footer>
            <Button
              type="button"
              outlined
              :label="t('app.cancelAction')"
              icon="pi pi-times"
              @click="closeModal"
            />
            <Button
              type="button"
              :label="t('collectionsMgmt.accept')"
              icon="pi pi-check"
              :loading="saving"
              @click="submitCost"
            />
          </template>
        </Dialog>

        <p v-if="costsLoading && !costsLoadError" class="collections-costs__loading">{{ t('collectionsMgmt.loading') }}</p>

        <DataTable :value="expenses" striped-rows class="collections-table">
          <template #empty>
            <p class="collections-table__empty">{{ t('collectionsMgmt.emptyCosts') }}</p>
          </template>
          <Column :header="t('collectionsMgmt.tableInvoice')" class="collections-col-photo">
            <template #body="{ data }">
              <img
                v-if="data.invoicePhotoUrl"
                :src="data.invoicePhotoUrl"
                :alt="data.name"
                class="collections-thumb"
                width="44"
                height="44"
              />
              <span v-else class="collections-thumb-placeholder">—</span>
            </template>
          </Column>
          <Column field="name" :header="t('collectionsMgmt.tableName')" />
          <Column :header="t('collectionsMgmt.tableAmount')">
            <template #body="{ data }">
              {{ nfCurrency(Number(data.amount) || 0) }}
            </template>
          </Column>
          <Column :header="t('collectionsMgmt.tableDate')">
            <template #body="{ data }">
              {{ nfDate(data.purchaseDate) }}
            </template>
          </Column>
        </DataTable>

        <p v-if="costsLoadError" class="app-view__error" role="alert">{{ costsLoadError }}</p>
      </section>
    </template>
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

.app-view__status {
  margin: 1rem 0 0;
  font-size: 0.9375rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.app-view__error {
  margin: 1rem 0 0;
  font-size: 0.9375rem;
  color: #b42318;
}

.collections-total {
  margin-top: 1.25rem;
  max-width: 28rem;
  padding: 1.25rem 1.35rem;
  border-radius: 14px;
  border: 1px solid #e8e8ed;
  background: #fff;
}

.collections-total__label {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--apple-text-secondary, #6e6e73);
}

.collections-total__amount {
  margin: 0.5rem 0 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--apple-text, #1d1d1f);
}

.collections-total__breakdown {
  margin: 0.55rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--apple-text-secondary, #6e6e73);
}

.collections-total__hint {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--apple-text-secondary, #6e6e73);
}

.collections-costs {
  margin-top: 2rem;
}

.collections-costs__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.collections-costs__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
}

.collections-costs__loading {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.collections-table {
  margin-top: 0.25rem;
}

.collections-form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.collections-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.collections-form__field label,
.collections-form__photo-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
}

.collections-form__hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.collections-form__input,
.collections-form__input-num {
  width: 100%;
}

.collections-form__input--date {
  min-height: 2.75rem;
}

.collections-form__file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  overflow: hidden;
}

.collections-form__file {
  position: relative;
  display: inline-flex;
  cursor: pointer;
}

.collections-form__file-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.85rem;
  border-radius: 10px;
  border: 1px solid #e8e8ed;
  background: #f5f5f7;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
}

.collections-form__file-trigger:hover {
  background: #ececf0;
}

.collections-form__preview-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.35rem;
}

.collections-form__preview {
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid #e8e8ed;
}

.collections-form__error {
  margin: 0;
  font-size: 0.8125rem;
  color: #b42318;
}

.collections-table__empty {
  margin: 0;
  padding: 1rem 0;
  color: var(--apple-text-secondary, #6e6e73);
}

.collections-thumb {
  border-radius: 8px;
  object-fit: cover;
  vertical-align: middle;
  border: 1px solid #e8e8ed;
}

.collections-thumb-placeholder {
  color: var(--apple-text-secondary, #6e6e73);
  font-size: 0.875rem;
}

.collections-cost-dialog :deep(.p-dialog-footer) {
  gap: 0.5rem;
}

.collections-cost-dialog :deep(.p-inputnumber) {
  width: 100%;
}
</style>
