import { reactive, computed } from 'vue';
import { financesApi } from '../infrastructure/financesApi.js';

const state = reactive({
  settings: null,
  residents: [],
  receipts: [],
  isLoading: false,
  error: null
});

export function useFinancesStore() {
  const loadData = async () => {
    state.isLoading = true;
    state.error = null;
    try {
      state.settings = await financesApi.getSettings();
      state.residents = await financesApi.getResidents();
      state.receipts = await financesApi.getReceipts();
    } catch (err) {
      state.error = 'Failed to load finances data';
      console.error(err);
    } finally {
      state.isLoading = false;
    }
  };

  const getResidentFinancialStatus = computed(() => {
    return state.residents.map(resident => {
      // Find all receipts for this resident
      const resReceipts = state.receipts.filter(
        (r) => String(r.residentId) === String(resident.id),
      );

      // Calculate next payment date
      let baseDate = resident.admissionDate ? new Date(resident.admissionDate) : new Date('2024-01-01');
      if (isNaN(baseDate.getTime())) {
        baseDate = new Date('2024-01-01');
      }

      let nextPaymentDate = new Date(baseDate);
      nextPaymentDate.setDate(nextPaymentDate.getDate() + 30);

      if (resReceipts.length > 0) {
        // Check if they have unpaid receipts
        const unpaidReceipts = resReceipts.filter(r => r.status !== 'Paid');

        if (unpaidReceipts.length > 0) {
          // If they owe money, the 'Next Payment Date' should be the due date of their oldest unpaid receipt
          const oldestUnpaidDueDate = new Date(Math.min(...unpaidReceipts.map(r => new Date(r.dueDate))));
          if (!isNaN(oldestUnpaidDueDate.getTime())) {
            nextPaymentDate = new Date(oldestUnpaidDueDate);
          }
        } else {
          // If all are Paid, find the latest due date among all receipts and add 30 days for the NEXT expected cycle
          const latestDueDate = new Date(Math.max(...resReceipts.map(r => new Date(r.dueDate))));
          if (!isNaN(latestDueDate.getTime())) {
            nextPaymentDate = new Date(latestDueDate);
            nextPaymentDate.setDate(nextPaymentDate.getDate() + 30);
          }
        }
      }

      // Calculate countdown to next expected payment
      const today = new Date();
      const timeDiff = nextPaymentDate.getTime() - today.getTime();
      const daysUntilNextPayment = Math.ceil(timeDiff / (1000 * 3600 * 24));

      // Get local today string for accurate comparison (YYYY-MM-DD)
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      // Current exact status
      // A receipt is overdue if its status is 'Overdue' OR it is 'Pending' and today's date has reached (or passed) its due date
      const hasOverdue = resReceipts.some(r =>
        r.status === 'Overdue' ||
        (r.status === 'Pending' && todayStr >= r.dueDate)
      );
      const hasPending = resReceipts.some(r => r.status === 'Pending');

      let overallStatus = 'Pending';
      if (hasOverdue) overallStatus = 'Overdue';
      else if (resReceipts.length === 0 && daysUntilNextPayment <= 0) overallStatus = 'Overdue';
      else if (hasPending) overallStatus = 'Pending';
      else if (resReceipts.length > 0) overallStatus = 'Paid';

      const fmtDate = (d) => {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const dayDt = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${dayDt}`;
      };

      return {
        ...resident,
        nextPaymentDate: fmtDate(nextPaymentDate),
        daysUntilNextPayment,
        overallStatus,
        receipts: resReceipts
      };
    });
  });

  // Utility to reliably format date strings
  const formatLocalIsoStringDate = (dateOb) => {
    const y = dateOb.getFullYear();
    const m = (dateOb.getMonth() + 1).toString().padStart(2, '0');
    const day = dateOb.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const updateSettings = async (newSettings) => {
    try {
      state.isLoading = true;
      const updated = await financesApi.updateSettings(newSettings);
      state.settings = updated;
      return updated;
    } catch (err) {
      console.error('Error updating finance settings:', err);
      throw new Error('Error updating finance settings');
    } finally {
      state.isLoading = false;
    }
  };

  const generateInitialReceipt = async (resident) => {
    if (!state.settings) {
      // Attempt a gentle fallback fetch if settings are missing (likely on fresh reload without navigating to finances first)
      state.settings = await financesApi.getSettings().catch(() => ({ baseMonthlyExpense: 150 }));
    }

    const amount = state.settings.baseMonthlyExpense || 150;

    // Explicitly calculate 30 days from admissionDate
    const baseDateString = resident.admissionDate || formatLocalIsoStringDate(new Date());
    const baseDate = new Date(baseDateString);
    if (isNaN(baseDate.getTime())) return null;

    const nextDateObj = new Date(baseDate);
    nextDateObj.setDate(nextDateObj.getDate() + 30);

    const dueDate = formatLocalIsoStringDate(nextDateObj);
    const issueDate = formatLocalIsoStringDate(new Date());

    const receiptData = {
      id: Date.now(),
      residentId: resident.id,
      issueDate,
      dueDate,
      amount,
      status: 'Pending',
      lateFee: 0
    };

    try {
      const created = await financesApi.createReceipt(receiptData);
      state.receipts.push(created);
      return created;
    } catch (err) {
      console.error("Failed to generate initial receipt:", err);
      return null;
    }
  };

  // US-16: Massive Receipt Generation
  const generateMonthlyReceipts = async () => {
    if (!state.settings || !state.settings.baseMonthlyExpense) {
      throw new Error('Base monthly expense is not configured. Cannot generate receipts.');
    }

    try {
      state.isLoading = true;
      const amount = state.settings.baseMonthlyExpense;
      const issueDate = formatLocalIsoStringDate(new Date());

      // Logic: For each resident, check if they need a receipt right now (e.g. they don't have a pending one)
      const statuses = getResidentFinancialStatus.value;
      const newReceipts = [];

      for (const residentStatus of statuses) {
        // If there's no pending/overdue receipt, generate a new one based on the nextPaymentDate cycle
        if (residentStatus.overallStatus === 'Paid') {
          const dueDate = residentStatus.nextPaymentDate;
          const receiptData = {
            id: Date.now() + Math.floor(Math.random() * 1000), // Numeric explicit ID
            residentId: residentStatus.id,
            issueDate,
            dueDate,
            amount,
            status: 'Pending',
            lateFee: 0
          };
          const created = await financesApi.createReceipt(receiptData);
          state.receipts.push(created);
          newReceipts.push(created);
        }
      }
      return newReceipts;
    } catch (err) {
      console.error(err);
      throw new Error('Error generating monthly receipts');
    } finally {
      state.isLoading = false;
    }
  };

  // US-18: Automated payment reconciliation (Mocked from Frontend)
  const simulatePaymentReconciliation = async (receiptId) => {
    try {
      state.isLoading = true;
      const updatedReceipt = await financesApi.updateReceipt(receiptId, { status: 'Paid' });
      // Update local state
      const index = state.receipts.findIndex(r => r.id === receiptId);
      if (index !== -1) {
        state.receipts[index] = updatedReceipt;
      }

      // AUTO-GENERATION HOOK: "los recibos que se emitan automáticamente solo después de que se paguen"
      // Automatically evaluate if we should issue the *next* tracking bill right away
      const r = updatedReceipt;
      const baseDueDate = new Date(r.dueDate);
      if (!isNaN(baseDueDate.getTime())) {
        baseDueDate.setDate(baseDueDate.getDate() + 30);
        const nextDueDate = formatLocalIsoStringDate(baseDueDate);
        const issueDate = formatLocalIsoStringDate(new Date());

        if (!state.settings) {
          state.settings = await financesApi.getSettings().catch(() => ({ baseMonthlyExpense: 150 }));
        }

        const nextReceiptData = {
          id: Date.now() + Math.floor(Math.random() * 1000), // Numeric explicit ID
          residentId: r.residentId,
          issueDate,
          dueDate: nextDueDate,
          amount: state.settings.baseMonthlyExpense || 150,
          status: 'Pending',
          lateFee: 0
        };
        const autoCreated = await financesApi.createReceipt(nextReceiptData);
        state.receipts.push(autoCreated);
      }
    } catch (err) {
      console.error(err);
      throw new Error('Error processing payment reconciliation');
    } finally {
      state.isLoading = false;
    }
  };

  // US-19: Automated Late Fee Application (Nocturnal Mock)
  const simulateNightlyCron = async () => {
    if (!state.settings?.lateFeeRate && state.settings?.lateFeeRate !== 0) {
      state.settings = await financesApi.getSettings().catch(() => null);
    }
    if (state.settings?.lateFeeRate == null) {
      throw new Error('Late fee rate is not configured.');
    }

    try {
      state.isLoading = true;
      const today = new Date();
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = today.getDate().toString().padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const lateRate = Number(state.settings.lateFeeRate);

      for (let i = 0; i < state.receipts.length; i++) {
        const r = state.receipts[i];
        const isPastDue = todayStr >= r.dueDate;
        const needsLateFee =
          isPastDue &&
          r.status !== 'Paid' &&
          (r.status === 'Pending' || Number(r.lateFee || 0) === 0);

        if (needsLateFee) {
          const newLateFee = Number(r.amount) * lateRate;
          const updatedReceipt = await financesApi.updateReceipt(r.id, {
            status: 'Overdue',
            lateFee: newLateFee,
          });
          state.receipts[i] = updatedReceipt;
        }
      }
    } catch (err) {
      console.error(err);
      throw new Error('Error running nightly cron job');
    } finally {
      state.isLoading = false;
    }
  };

  return {
    state,
    loadData,
    getResidentFinancialStatus,
    generateInitialReceipt,
    generateMonthlyReceipts,
    simulatePaymentReconciliation,
    simulateNightlyCron,
    updateSettings
  };
}
