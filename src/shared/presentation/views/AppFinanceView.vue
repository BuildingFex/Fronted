<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dropdown from 'primevue/dropdown'

import { useFinancesStore } from '../../../finances/application/financesStore.js'

const { t, locale } = useI18n()
const store = useFinancesStore()

const nfPen = computed(() => (value) => {
  const n = Number(value)
  return new Intl.NumberFormat(locale.value === 'es' ? 'es-PE' : 'en-US', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
})

const uiState = ref({
  isGenerating: false,
  isCronRunning: false,
  isLoaded: false,
  isSaving: false,
})

const editSettings = ref({
  baseMonthlyExpense: 0,
  lateFeeRate: 0,
  lateFeeRateDisplay: 0,
})

onMounted(async () => {
  await store.loadData()
  editSettings.value = {
    baseMonthlyExpense: store.state.settings?.baseMonthlyExpense ?? 150,
    lateFeeRate: store.state.settings?.lateFeeRate ?? 0.05,
    lateFeeRateDisplay: Math.round((store.state.settings?.lateFeeRate ?? 0.05) * 100),
  }
  uiState.value.isLoaded = true
})

const handleSaveSettings = async () => {
  if (uiState.value.isSaving) return
  uiState.value.isSaving = true
  try {
    await store.updateSettings({
      baseMonthlyExpense: editSettings.value.baseMonthlyExpense,
      lateFeeRate: editSettings.value.lateFeeRateDisplay / 100,
    })
    alert(t('financeAdmin.settingsSaved'))
  } catch (e) {
    alert(e.message)
  } finally {
    uiState.value.isSaving = false
  }
}

const handleGenerateReceipts = async () => {
  if(uiState.value.isGenerating) return;
  uiState.value.isGenerating = true;
  try {
    const newReceipts = await store.generateMonthlyReceipts()
    if(newReceipts.length === 0) {
      alert("No new receipts generated. Everyone is up to date based on their next cycle.");
    } else {
      alert(`Generated ${newReceipts.length} new receipts!`);
    }
    await store.loadData()
  } catch(e) {
    alert(e.message)
  } finally {
    uiState.value.isGenerating = false;
  }
}

const handleSimulateCron = async () => {
  if(uiState.value.isCronRunning) return;
  uiState.value.isCronRunning = true;
  try {
    await store.simulateNightlyCron()
    alert('Simulated Nightly Cron. Late fees applied where applicable.');
    await store.loadData()
  } catch(e) {
    alert(e.message)
  } finally {
    uiState.value.isCronRunning = false;
  }
}

// Payment History grouped by Floor
const floorSections = computed(() => {
  const sections = {};
  const data = store.getResidentFinancialStatus.value || [];
  data.forEach(res => {
    if(!sections[res.floor]) sections[res.floor] = [];
    sections[res.floor].push(res);
  });
  return Object.keys(sections).map(floor => ({
    floor,
    residents: sections[floor]
  })).sort((a,b) => parseInt(a.floor) - parseInt(b.floor));
})

const historyFloorFilter = ref('')

const historyFloorOptions = computed(() => {
  const all = { label: t('financeAdmin.allFloors'), value: '' }
  const byFloor = floorSections.value.map((s) => ({
    label: `${t('financeAdmin.tableFloor')} ${s.floor}`,
    value: String(s.floor),
  }))
  return [all, ...byFloor]
})

const filteredFloorSections = computed(() => {
  if (!historyFloorFilter.value) {
    return floorSections.value
  }
  return floorSections.value.filter((s) => String(s.floor) === String(historyFloorFilter.value))
})

// Simple custom current month calendar logic to show colorful indicator dots
const currentMonthData = computed(() => {
  const dt = new Date();
  const year = dt.getFullYear();
  const month = dt.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Determine the day of the week for the 1st of the month (0 = Sunday)
  const firstDay = new Date(year, month, 1).getDay();
  // Name of the month
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(dt);

  const days = [];
  
  // Pad the first days of the grid before the 1st of the month starts
  for (let i = 0; i < firstDay; i++) {
     days.push({ date: '', status: null, empty: true });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    // Generate YYYY-MM-DD locally avoiding UTC offset bugs
    const dStr = i.toString().padStart(2, '0');
    const mStr = (month + 1).toString().padStart(2, '0');
    const dateStr = `${year}-${mStr}-${dStr}`;
    
    // determine status by looking into all receipts for this date
    let status = null; 
    let hasPaid = false;
    let hasOverdue = false;
    let hasPending = false;

    if (store.state.receipts) {
       for(const rc of store.state.receipts) {
         if (rc.dueDate === dateStr) {
           if(rc.status === 'Paid') hasPaid = true;
           else if(rc.status === 'Overdue') hasOverdue = true;
           else if(rc.status === 'Pending') hasPending = true;
         }
       }
    }

    // Get today for implicit status checking
    const todayYmd = `${dt.getFullYear()}-${(dt.getMonth()+1).toString().padStart(2, '0')}-${dt.getDate().toString().padStart(2, '0')}`;

    // Include residents with no receipts defaulting to 'Pending' or 'Overdue'
    if (store.getResidentFinancialStatus.value) {
       for (const res of store.getResidentFinancialStatus.value) {
          if (res.receipts.length === 0 && res.nextPaymentDate === dateStr) {
             if (dateStr <= todayYmd) {
                 hasOverdue = true;
             } else {
                 hasPending = true;
             }
          }
       }
    }

    if (hasOverdue) status = 'overdue';
    else if (hasPending) status = 'pending';
    else if (hasPaid) status = 'paid';

    days.push({
      date: i,
      status, // paid, pending, overdue, null
      empty: false
    });
  }
  return { monthName, days };
});

const getStatusBadgeClass = (status) => {
  if(status === 'Paid') return 'status-paid';
  if(status === 'Pending') return 'status-pending';
  if(status === 'Overdue') return 'status-overdue';
  return '';
}
</script>

<template>
  <div v-if="uiState.isLoaded" class="app-view">
    <h1 class="app-view__title">{{ t('financeAdmin.title') }}</h1>
    <p class="app-view__subtitle">{{ t('financeAdmin.subtitle') }}</p>

    <div class="finance-page">
      <div class="finance-toolbar-row">
        <Button
          type="button"
          rounded
          severity="secondary"
          :label="t('financeAdmin.generateReceipts')"
          :loading="uiState.isGenerating"
          class="import-dropzone__btn"
          @click="handleGenerateReceipts"
        />
        <Button
          type="button"
          rounded
          severity="secondary"
          :label="t('financeAdmin.simulateCron')"
          :loading="uiState.isCronRunning"
          class="import-dropzone__btn"
          @click="handleSimulateCron"
        />
      </div>

      <section class="finance-panel finance-panel--settings import-panel" aria-labelledby="finance-settings-heading">
        <h2 id="finance-settings-heading" class="finance-panel__section-title">
          {{ t('financeAdmin.settingsTitle') }}
        </h2>
        <div class="settings-form">
          <div class="settings-field">
            <label for="baseMonthlyExpense">{{ t('financeAdmin.baseMonthlyExpense') }}</label>
            <InputNumber
              id="baseMonthlyExpense"
              v-model="editSettings.baseMonthlyExpense"
              :minFractionDigits="2"
              :maxFractionDigits="2"
              :min="0"
              mode="currency"
              currency="PEN"
              locale="es-PE"
              class="settings-input"
            />
          </div>
          <div class="settings-field">
            <label for="lateFeeRate">{{ t('financeAdmin.lateFeeRate') }}</label>
            <InputNumber
              id="lateFeeRate"
              v-model="editSettings.lateFeeRateDisplay"
              :minFractionDigits="0"
              :maxFractionDigits="2"
              :min="0"
              :max="100"
              suffix="%"
              class="settings-input"
            />
          </div>
          <Button
            type="button"
            rounded
            severity="primary"
            :label="t('financeAdmin.saveSettings')"
            :loading="uiState.isSaving"
            class="settings-save-btn"
            @click="handleSaveSettings"
          />
        </div>
      </section>

      <div class="finance-main-row">
        <section
          class="finance-panel finance-panel--table table-panel import-panel"
          aria-labelledby="finance-residents-heading"
        >
          <h2 id="finance-residents-heading" class="finance-panel__section-title">
            {{ t('financeAdmin.residentsPanelTitle') }}
          </h2>
          <DataTable
            :value="store.getResidentFinancialStatus.value"
            responsiveLayout="scroll"
            class="finance-data finance-table"
            :paginator="true"
            :rows="10"
          >
            <Column field="name" :header="t('financeAdmin.tableResident')">
              <template #body="slotProps">
                <div class="resident-info">
                  <strong>{{ slotProps.data.name }}</strong>
                  <small>{{
                    t('financeAdmin.residentFloorApt', {
                      floor: slotProps.data.floor,
                      code: slotProps.data.code,
                    })
                  }}</small>
                </div>
              </template>
            </Column>
            <Column field="admissionDate" :header="t('financeAdmin.tableAdmission')" />
            <Column field="nextPaymentDate" :header="t('financeAdmin.tableNextPayment')">
              <template #body="slotProps">
                <span class="finance-date-cell">{{ slotProps.data.nextPaymentDate }}</span>
              </template>
            </Column>
            <Column :header="t('financeAdmin.tableCountdown')">
              <template #body="slotProps">
                <span
                  class="days-left"
                  :class="{ urgent: slotProps.data.daysUntilNextPayment <= 5 }"
                >
                  {{ t('financeAdmin.daysRemaining', { n: slotProps.data.daysUntilNextPayment }) }}
                </span>
              </template>
            </Column>
            <Column :header="t('financeAdmin.tableStatus')">
              <template #body="slotProps">
                <span
                  class="status-badge"
                  :class="getStatusBadgeClass(slotProps.data.overallStatus)"
                >
                  {{ t(`financeAdmin.status${slotProps.data.overallStatus}`) }}
                </span>
              </template>
            </Column>
          </DataTable>
        </section>

        <section
          class="finance-panel finance-panel--calendar calendar-widget import-panel"
          aria-labelledby="finance-calendar-heading"
        >
          <h2 id="finance-calendar-heading" class="finance-panel__section-title">
            {{ t('financeAdmin.calendarTitle') }}
            <span class="finance-panel__title-month">{{ currentMonthData.monthName }}</span>
          </h2>
        <div class="calendar-grid">
           <div class="weekday-header">S</div>
           <div class="weekday-header">M</div>
           <div class="weekday-header">T</div>
           <div class="weekday-header">W</div>
           <div class="weekday-header">T</div>
           <div class="weekday-header">F</div>
           <div class="weekday-header">S</div>
          <div class="calendar-day" v-for="(day, idx) in currentMonthData.days" :key="idx" :class="{'empty-day': day.empty}">
            <span class="day-number" v-if="!day.empty">{{ day.date }}</span>
            <div class="day-dot" :class="day.status" v-if="day.status && !day.empty"></div>
          </div>
        </div>
        <div class="calendar-legend">
          <div class="legend-item"><div class="day-dot paid"></div> {{ t('financeAdmin.statusPaid') }}</div>
          <div class="legend-item"><div class="day-dot pending"></div> {{ t('financeAdmin.statusPending') }}</div>
          <div class="legend-item"><div class="day-dot overdue"></div> {{ t('financeAdmin.statusOverdue') }}</div>
        </div>
        </section>
      </div>

      <section
        class="finance-panel finance-panel--history import-panel"
        aria-labelledby="finance-history-heading"
      >
        <div class="finance-history__toolbar">
          <h2 id="finance-history-heading" class="finance-panel__section-title">
            {{ t('financeAdmin.paymentHistory') }}
          </h2>
          <Dropdown
            v-if="historyFloorOptions.length > 1"
            v-model="historyFloorFilter"
            :options="historyFloorOptions"
            option-label="label"
            option-value="value"
            class="finance-history__floor-filter"
            :aria-label="t('financeAdmin.filterFloorAria')"
          />
        </div>

        <div v-for="section in filteredFloorSections" :key="section.floor" class="floor-section">
          <h3 class="floor-title">
            {{ t('financeAdmin.tableFloor') }} {{ section.floor }}
          </h3>
          <div class="history-cards">
            <div v-for="res in section.residents" :key="res.id" class="finance-card">
              <h4>
                {{ res.name }}
                <span class="apt-code">#{{ res.code }}</span>
              </h4>
              <ul class="receipt-list">
                <li v-for="rc in res.receipts" :key="rc.id">
                  <div class="rc-info">
                    <span>{{ t('financeAdmin.receiptDue') }}: {{ rc.dueDate }}</span>
                    <strong>{{ nfPen(Number(rc.amount) + Number(rc.lateFee)) }}</strong>
                  </div>
                  <span class="small-badge" :class="getStatusBadgeClass(rc.status)">{{ rc.status }}</span>
                </li>
                <li v-if="res.receipts.length === 0" class="empty-list">
                  {{ t('financeAdmin.emptyReceipts') }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <div v-else class="app-view finance-loading" role="status" aria-live="polite">
    <p class="app-view__status finance-loading__text">{{ t('financeAdmin.loading') }}</p>
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

.app-view__status {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.finance-page {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.finance-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
}

.import-dropzone__btn :deep(.p-button) {
  font-weight: 500;
  font-size: 0.8125rem;
  padding-block: 0.5rem;
  padding-inline: 1rem;
}

.finance-main-row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 1.25rem;
}

.table-panel {
  flex: 1 1 58%;
  min-width: 0;
}

.calendar-widget {
  flex: 0 1 22rem;
  min-width: 17rem;
}

@media (max-width: 1024px) {
  .finance-main-row {
    flex-direction: column;
  }

  .calendar-widget {
    flex: 1 1 auto;
    min-width: 0;
    max-width: none;
  }
}

.finance-panel {
  padding: 1.2rem 1.25rem 1.35rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.finance-panel--calendar {
  background: #fafafa;
}

.finance-panel--settings {
  background: #fafafa;
}

.finance-panel--table {
  padding: 1.2rem 1.25rem 1.35rem;
  overflow: hidden;
}

.finance-panel__section-title {
  margin: 0 0 0.5rem;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--apple-text, #1d1d1f);
}

.import-panel .finance-table {
  margin-top: 0.65rem;
}

.import-panel .calendar-grid {
  margin-top: 0.65rem;
}

.finance-panel__title-month {
  display: inline-block;
  margin-left: 0.35rem;
  text-transform: capitalize;
  color: #86868b;
  font-weight: 500;
}

.finance-table {
  margin-top: 0.15rem;
}

.finance-data :deep(.p-datatable) {
  font-size: 0.875rem;
  border: none;
  border-radius: 12px;
  overflow: hidden;
}

.finance-data :deep(.p-datatable-wrapper) {
  border-radius: 12px;
}

.finance-data :deep(.p-datatable-header) {
  background: transparent;
  border: none;
  padding: 0;
}

.finance-data :deep(.p-datatable-thead > tr > th) {
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

.finance-data :deep(.p-datatable-tbody > tr) {
  background: transparent;
  transition: background 0.12s ease;
}

.finance-data :deep(.p-datatable-tbody > tr:hover) {
  background: rgba(0, 0, 0, 0.02);
}

.finance-data :deep(.p-datatable-tbody > tr > td) {
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 0.7rem 0.75rem;
  vertical-align: middle;
  color: var(--apple-text, #1d1d1f);
}

.finance-data :deep(.p-datatable-tbody > tr:last-child > td) {
  border-bottom: none;
}

.finance-data :deep(.p-paginator) {
  background: transparent;
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0.6rem 0.5rem;
  font-size: 0.8125rem;
}

.finance-data :deep(.p-paginator .p-paginator-page.p-highlight) {
  background: rgba(10, 132, 255, 0.12);
  color: #0a84ff;
}

.finance-date-cell {
  font-weight: 500;
  color: var(--apple-text, #1d1d1f);
}

.resident-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.resident-info strong {
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
}

.resident-info small {
  color: var(--apple-text-secondary, #6e6e73);
  font-size: 0.75rem;
}

.days-left {
  font-weight: 600;
  font-size: 0.8125rem;
  color: #0a84ff;
  background: rgba(10, 132, 255, 0.08);
  padding: 0.25rem 0.55rem;
  border-radius: 980px;
}

.days-left.urgent {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.08);
}

.status-badge {
  padding: 0.25rem 0.65rem;
  border-radius: 980px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.status-paid {
  background: rgba(52, 199, 89, 0.14);
  color: #248a3d;
}

.status-pending {
  background: rgba(255, 149, 0, 0.14);
  color: #c35b00;
}

.status-overdue {
  background: rgba(255, 59, 48, 0.12);
  color: #d70015;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.35rem;
}

.calendar-day {
  background: #fff;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0.4rem 0.35rem;
  text-align: center;
  position: relative;
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--apple-text, #1d1d1f);
  min-height: 2.75rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.empty-day {
  background: transparent;
  border: none;
}

.weekday-header {
  font-weight: 600;
  color: #86868b;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: center;
  margin-bottom: 0.25rem;
}

.day-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 3px;
}

.day-dot.paid {
  background: #34c759;
  box-shadow: 0 0 0 1px rgba(52, 199, 89, 0.25);
}

.day-dot.pending {
  background: #ff9500;
  box-shadow: 0 0 0 1px rgba(255, 149, 0, 0.25);
}

.day-dot.overdue {
  background: #ff3b30;
  box-shadow: 0 0 0 1px rgba(255, 59, 48, 0.2);
}

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  margin-top: 1.125rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 0.75rem;
  color: #86868b;
  font-weight: 500;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.finance-history__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 1.25rem;
  flex-wrap: wrap;
  margin-bottom: 0.65rem;
}

.finance-history__toolbar .finance-panel__section-title {
  margin-bottom: 0;
}

.finance-history__floor-filter {
  min-width: 11rem;
  flex: 0 1 auto;
}

.finance-history__floor-filter :deep(.p-dropdown) {
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  background: #fff;
  font-size: 0.875rem;
}

.finance-history__floor-filter :deep(.p-dropdown:not(.p-disabled):hover) {
  border-color: rgba(0, 0, 0, 0.14);
}

.finance-history__floor-filter :deep(.p-dropdown:not(.p-disabled).p-focus) {
  outline: none;
  border-color: #0a84ff;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
}

.finance-history__floor-filter :deep(.p-dropdown-label) {
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  color: var(--apple-text, #1d1d1f);
}

.floor-section {
  margin-bottom: 1.75rem;
}

.floor-section:last-child {
  margin-bottom: 0;
}

.floor-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.055em;
  color: #86868b;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.history-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.finance-card {
  padding: 1.1rem 1.2rem;
  border-radius: 10px;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.15s ease;
}

.finance-card:hover {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.finance-card h4 {
  margin: 0 0 0.85rem;
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--apple-text, #1d1d1f);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.apt-code {
  color: var(--apple-text-secondary, #6e6e73);
  font-weight: 500;
  font-size: 0.8125rem;
}

.receipt-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.receipt-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  background: #fff;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.rc-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.8125rem;
}

.rc-info span {
  color: var(--apple-text-secondary, #6e6e73);
}

.rc-info strong {
  color: var(--apple-text, #1d1d1f);
  font-size: 0.9375rem;
  font-weight: 600;
}

.small-badge {
  font-size: 0.6875rem;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  font-weight: 600;
}

.empty-list {
  color: var(--apple-text-secondary, #6e6e73);
  font-size: 0.8125rem;
  justify-content: center !important;
  background: transparent !important;
  border: none !important;
}

.finance-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 45vh;
}

.finance-loading__text {
  text-align: center;
}

.settings-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  margin-top: 0.75rem;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 10rem;
}

.settings-field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--apple-text-secondary, #6e6e73);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.settings-input :deep(.p-inputnumber-input) {
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
}

.settings-input :deep(.p-inputnumber:not(.p-disabled):hover .p-inputnumber-input) {
  border-color: rgba(0, 0, 0, 0.14);
}

.settings-input :deep(.p-inputnumber.p-inputnumber-focus .p-inputnumber-input) {
  border-color: #0a84ff;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
}

.settings-save-btn {
  margin-left: auto;
}
</style>
