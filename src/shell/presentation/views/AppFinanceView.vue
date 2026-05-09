<script setup>
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

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
      <div class="finance-actions">
        <Button 
          icon="pi pi-receipt" 
          :label="t('financeAdmin.generateReceipts')" 
          class="p-button-outlined p-button-success glass-btn" 
          @click="handleGenerateReceipts" 
          :loading="uiState.isGenerating"
        />
        <Button 
          icon="pi pi-cog" 
          :label="t('financeAdmin.simulateCron')" 
          class="p-button-outlined p-button-danger glass-btn" 
          @click="handleSimulateCron" 
          :loading="uiState.isCronRunning"
        />
      </div>
    </div>

    <!-- Widgets row -->
    <div class="widgets-row">
      <!-- Calendar Widget -->
      <div class="widget glass-widget calendar-widget">
        <h2 class="widget-title"><i class="pi pi-calendar"></i> {{ t('financeAdmin.calendarTitle') }} - <span style="text-transform: capitalize">{{ currentMonthData.monthName }}</span></h2>
        <div class="calendar-grid">
           <!-- Weekdays header -->
           <div class="weekday-header">S</div>
           <div class="weekday-header">M</div>
           <div class="weekday-header">T</div>
           <div class="weekday-header">W</div>
           <div class="weekday-header">T</div>
           <div class="weekday-header">F</div>
           <div class="weekday-header">S</div>
           
          <!-- Calendar Days -->
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
    
    <!-- Table -->
    <div class="table-container glass-container">
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

    <!-- Section History -->
    <div class="sections-history">
       <h2 class="section-main-title">{{ t('financeAdmin.paymentHistory') }}</h2>
       
       <div class="floor-section" v-for="section in floorSections" :key="section.floor">
          <h3 class="floor-title">Floor {{ section.floor }}</h3>
          <div class="history-cards">
             <div class="history-card glass-card" v-for="res in section.residents" :key="res.id">
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
  
  <div v-else class="loading-state">
     <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
  </div>
</template>

<style scoped>
.finance-view {
  padding: 2rem;
  max-width: 80rem;
  margin: 0 auto;
  font-family: 'Inter', sans-serif;
  color: #2c3e50;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.finance-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 1rem;
}

.finance-title {
  margin: 0;
  font-size: 2.2rem;
  font-weight: 800;
  background: linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.finance-subtitle {
  margin: 0.5rem 0 0 0;
  color: #64748b;
  font-size: 1rem;
}

.finance-actions {
  display: flex;
  gap: 1rem;
}

.glass-btn {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.8);
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.glass-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

/* WIDGETS */
.widgets-row {
  display: flex;
  gap: 2rem;
}

.widget {
  flex: 1;
  padding: 1.5rem;
  border-radius: 1rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
}

.glass-widget {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
}

.widget-title {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #334155;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.calendar-day {
  background: #ffffff;
  border-radius: 0.5rem;
  padding: 0.5rem;
  text-align: center;
  position: relative;
  font-weight: 600;
  color: #475569;
  min-height: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.empty-day {
  background: transparent;
  box-shadow: none;
}

.weekday-header {
  font-weight: 800;
  color: #94a3b8;
  font-size: 0.85rem;
  text-align: center;
  margin-bottom: 0.5rem;
}

.day-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 4px;
}

.day-dot.paid { background: #10b981; box-shadow: 0 0 5px #10b981; }
.day-dot.pending { background: #f59e0b; box-shadow: 0 0 5px #f59e0b; }
.day-dot.overdue { background: #ef4444; box-shadow: 0 0 5px #ef4444; }

.calendar-legend {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}
.legend-item { display: flex; align-items: center; gap: 0.3rem;}

/* TABLE */
.glass-container {
  background: white;
  border-radius: 1rem;
  padding: 0.5rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.premium-table :deep(.p-datatable-header) {
  background: transparent;
  border: none;
}
.premium-table :deep(.p-datatable-thead > tr > th) {
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  border-bottom: 2px solid #e2e8f0;
}

.resident-info {
  display: flex;
  flex-direction: column;
}
.resident-info small {
  color: #64748b;
}

.days-left {
  font-weight: 700;
  color: #3b82f6;
  background: #eff6ff;
  padding: 0.3rem 0.6rem;
  border-radius: 1rem;
}
.days-left.urgent {
  color: #ef4444;
  background: #fef2f2;
}

.status-badge {
  padding: 0.3rem 0.8rem;
  border-radius: 2rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-paid { background: #d1fae5; color: #047857; }
.status-pending { background: #fef3c7; color: #b45309; }
.status-overdue { background: #fee2e2; color: #b91c1c; }

/* HISTORY CARDS */
.section-main-title {
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
  font-weight: 800;
  color: #1e293b;
}

.floor-section {
  margin-bottom: 2.5rem;
}

.floor-title {
  font-size: 1.3rem;
  color: #64748b;
  border-bottom: 2px dashed #cbd5e1;
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
}

.history-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.history-card {
  padding: 1.5rem;
  border-radius: 1rem;
}

.glass-card {
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.6);
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
  transition: transform 0.2s ease;
}
.glass-card:hover { transform: translateY(-3px); }

.history-card h4 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #334155;
  display: flex;
  justify-content: space-between;
}

.apt-code {
  color: #94a3b8;
  font-weight: 600;
}

.receipt-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.receipt-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 0.8rem 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  border-left: 4px solid #e2e8f0;
}

.rc-info {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}
.rc-info span { color: #64748b; }
.rc-info strong { color: #1e293b; font-size: 1.05rem;}

.small-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 0.5rem;
}
.empty-list {
  color: #94a3b8;
  font-style: italic;
  justify-content: center !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
  color: #3b82f6;
}
</style>
