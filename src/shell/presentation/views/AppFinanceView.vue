<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Dropdown from 'primevue/dropdown'

import { useFinancesStore } from '../../../finances/application/financesStore.js'

const { t } = useI18n()
const store = useFinancesStore()

const uiState = ref({
  isGenerating: false,
  isCronRunning: false,
  isLoaded: false
})

onMounted(async () => {
  await store.loadData()
  uiState.value.isLoaded = true
})

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
  <div class="finance-view" v-if="uiState.isLoaded">
    
    <div class="finance-header">
      <div>
        <h1 class="finance-title">{{ t('financeAdmin.title') }}</h1>
        <p class="finance-subtitle">Manage resident payments, automatic receipts, and penalties.</p>
      </div>
      <div class="finance-toolbar">
        <Button 
          icon="pi pi-receipt" 
          :label="t('financeAdmin.generateReceipts')" 
          class="p-button-outlined finance-toolbar__btn finance-toolbar__btn--primary" 
          @click="handleGenerateReceipts" 
          :loading="uiState.isGenerating"
        />
        <Button 
          icon="pi pi-cog" 
          :label="t('financeAdmin.simulateCron')" 
          class="p-button-outlined finance-toolbar__btn finance-toolbar__btn--danger" 
          @click="handleSimulateCron" 
          :loading="uiState.isCronRunning"
        />
      </div>
    </div>

    <div class="finance-main-row">
      <div class="finance-panel finance-panel--table table-panel">
        <DataTable 
            :value="store.getResidentFinancialStatus.value" 
            responsiveLayout="scroll" 
            class="premium-table" 
            :paginator="true" 
            :rows="10">
          
          <Column field="name" :header="t('financeAdmin.tableResident')">
             <template #body="slotProps">
               <div class="resident-info">
                  <strong>{{ slotProps.data.name }}</strong>
                  <small>Floor {{ slotProps.data.floor }} - Apt {{ slotProps.data.code }}</small>
               </div>
             </template>
          </Column>
          <Column field="admissionDate" :header="t('financeAdmin.tableAdmission')"></Column>
          <Column field="nextPaymentDate" :header="t('financeAdmin.tableNextPayment')">
             <template #body="slotProps">
                <span class="font-medium">{{ slotProps.data.nextPaymentDate }}</span>
             </template>
          </Column>
          <Column :header="t('financeAdmin.tableCountdown')">
            <template #body="slotProps">
              <span class="days-left" :class="{'urgent': slotProps.data.daysUntilNextPayment <= 5}">
                {{ slotProps.data.daysUntilNextPayment }} days
              </span>
            </template>
          </Column>
          <Column :header="t('financeAdmin.tableStatus')">
            <template #body="slotProps">
              <span class="status-badge" :class="getStatusBadgeClass(slotProps.data.overallStatus)">
                {{ t(`financeAdmin.status${slotProps.data.overallStatus}`) }}
              </span>
            </template>
          </Column>
        </DataTable>
      </div>

      <div class="finance-panel finance-panel--calendar calendar-widget">
        <h2 class="finance-panel__title">
          <i class="pi pi-calendar" aria-hidden="true"></i>
          {{ t('financeAdmin.calendarTitle') }} — <span class="finance-panel__title-month">{{ currentMonthData.monthName }}</span>
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
      </div>
    </div>

    <div class="finance-history">
      <div class="finance-history__toolbar">
        <h2 class="finance-history__heading">{{ t('financeAdmin.paymentHistory') }}</h2>
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

       <div class="floor-section" v-for="section in filteredFloorSections" :key="section.floor">
          <h3 class="floor-title">Floor {{ section.floor }}</h3>
          <div class="history-cards">
             <div class="finance-card" v-for="res in section.residents" :key="res.id">
                <h4>{{ res.name }} <span class="apt-code">#{{res.code}}</span></h4>
                <ul class="receipt-list">
                   <li v-for="rc in res.receipts" :key="rc.id">
                      <div class="rc-info">
                         <span>Due: {{ rc.dueDate }}</span>
                         <strong>${{ rc.amount + rc.lateFee }}</strong>
                      </div>
                      <span class="small-badge" :class="getStatusBadgeClass(rc.status)">{{ rc.status }}</span>
                   </li>
                   <li v-if="res.receipts.length === 0" class="empty-list">No payment history</li>
                </ul>
             </div>
          </div>
       </div>
    </div>

  </div>
  
  <div v-else class="finance-loading" role="status" aria-live="polite">
     <i class="pi pi-spin pi-spinner finance-loading__icon" aria-hidden="true"></i>
  </div>
</template>

<style scoped>
.finance-view {
  padding: 1.75rem 1.5rem 2.5rem;
  max-width: 72rem;
  margin: 0 auto;
  font-family: inherit;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  letter-spacing: -0.022em;
  line-height: 1.47;
  -webkit-font-smoothing: antialiased;
}

.finance-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--border);
}

.finance-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--text);
}

.finance-subtitle {
  margin: 0.35rem 0 0 0;
  font-size: 0.9375rem;
  font-weight: 400;
  color: var(--muted);
  max-width: 28rem;
  line-height: 1.45;
}

.finance-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.finance-toolbar__btn.p-button.p-button-outlined {
  border-radius: 980px;
  font-weight: 600;
  font-size: 0.8125rem;
  padding: 0.5rem 1rem;
  border: 1px solid #d2d2d7;
  background: var(--bg);
  color: var(--text);
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  box-shadow: none;
}

.finance-toolbar__btn--primary.p-button.p-button-outlined {
  color: #0a84ff;
  border-color: rgba(10, 132, 255, 0.35);
  background: rgba(10, 132, 255, 0.06);
}

.finance-toolbar__btn--danger.p-button.p-button-outlined {
  color: #ff3b30;
  border-color: rgba(255, 59, 48, 0.28);
  background: rgba(255, 59, 48, 0.05);
}

.finance-toolbar__btn.p-button.p-button-outlined:not(:disabled):hover {
  background: var(--bg-elevated);
}

.finance-toolbar__btn--primary.p-button.p-button-outlined:not(:disabled):hover {
  background: rgba(10, 132, 255, 0.1);
  border-color: rgba(10, 132, 255, 0.45);
}

.finance-toolbar__btn--danger.p-button.p-button-outlined:not(:disabled):hover {
  background: rgba(255, 59, 48, 0.1);
  border-color: rgba(255, 59, 48, 0.4);
}

.finance-toolbar__btn.p-button .p-button-icon {
  color: inherit;
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
  padding: 1.25rem 1.35rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
  box-shadow: var(--shadow);
}

.finance-panel--calendar {
  background: var(--bg-elevated);
}

.finance-panel__title {
  margin: 0 0 1.125rem 0;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  color: var(--text);
}

.finance-panel__title .pi {
  color: var(--muted);
  font-size: 1rem;
}

.finance-panel__title-month {
  text-transform: capitalize;
  color: var(--muted);
  font-weight: 500;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.35rem;
}

.calendar-day {
  background: var(--bg);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0.4rem 0.35rem;
  text-align: center;
  position: relative;
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--text);
  min-height: 2.75rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.empty-day {
  background: transparent;
  border: none;
  box-shadow: none;
}

.weekday-header {
  font-weight: 600;
  color: var(--muted);
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
  border-top: 1px solid var(--border);
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: 500;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.finance-panel--table {
  padding: 0.35rem;
  overflow: hidden;
}

.premium-table :deep(.p-datatable) {
  font-size: 0.875rem;
}

.premium-table :deep(.p-datatable-header) {
  background: transparent;
  border: none;
  padding: 0.35rem 0.5rem;
}

.premium-table :deep(.p-datatable-thead > tr > th) {
  background: var(--bg-elevated);
  color: var(--muted);
  font-weight: 600;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 0.65rem 0.75rem;
}

.premium-table :deep(.p-datatable-tbody > tr) {
  background: var(--bg);
  transition: background 0.12s ease;
}

.premium-table :deep(.p-datatable-tbody > tr:hover) {
  background: var(--bg-elevated);
}

.premium-table :deep(.p-datatable-tbody > tr > td) {
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 0.75rem;
  vertical-align: middle;
}

.premium-table :deep(.p-paginator) {
  background: transparent;
  border: none;
  padding: 0.6rem 0.5rem;
  font-size: 0.8125rem;
}

.premium-table :deep(.p-paginator .p-paginator-page.p-highlight) {
  background: var(--accent-dim);
  color: var(--accent);
}

.resident-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.resident-info strong {
  font-weight: 600;
  color: var(--text);
}

.resident-info small {
  color: var(--muted);
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

.finance-history__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 1.25rem;
  flex-wrap: wrap;
  margin-bottom: 1.25rem;
}

.finance-history__heading {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--text);
}

.finance-history__floor-filter {
  min-width: 11rem;
  flex: 0 1 auto;
}

.finance-history__floor-filter :deep(.p-dropdown) {
  border-radius: 10px;
  border: 1px solid #d2d2d7;
  background: var(--bg);
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
  color: var(--text);
}

.floor-section {
  margin-bottom: 2rem;
}

.floor-title {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.history-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.finance-card {
  padding: 1.15rem 1.25rem;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.finance-card:hover {
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}

.finance-card h4 {
  margin: 0 0 0.9rem 0;
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.apt-code {
  color: var(--muted);
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
  background: var(--bg-elevated);
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.rc-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  font-size: 0.8125rem;
}

.rc-info span {
  color: var(--muted);
}

.rc-info strong {
  color: var(--text);
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
  color: var(--muted);
  font-style: italic;
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
  color: var(--accent);
}

.finance-loading__icon {
  font-size: 2rem;
}
</style>
