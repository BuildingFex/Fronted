<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSession } from '@/iam/application/sessionStore.js'
import { authApi } from '@/iam/infrastructure/authApi.js'
import { residentsApi } from '@/residents/infrastructure/residentsApi.js'
import { SubscriptionPlanId, maxResidentsForSubscriptionPlan } from '@/shared/domain/subscriptionPlans.js'
import {
  getSubscriptionPlanIdForOwner,
  saveSubscriptionPlanForOwner,
} from '@/shared/infrastructure/subscriptionPlanStorage.js'

const { t } = useI18n()
const { state, isAdmin, isResident } = useSession()

const sessionProfile = computed(() => state.profile ?? {})
const serverProfile = ref(null)
const isLoading = ref(false)
const loadError = ref(false)

const display = computed(() => ({
  ...sessionProfile.value,
  ...(serverProfile.value ?? {}),
}))

async function loadServerProfile() {
  const id = sessionProfile.value?.id
  if (!id) {
    serverProfile.value = null
    return
  }
  isLoading.value = true
  loadError.value = false
  try {
    const full = await authApi.getProfileById(id)
    serverProfile.value = full
    if (!full) loadError.value = true
  } catch {
    loadError.value = true
    serverProfile.value = null
  } finally {
    isLoading.value = false
  }
}

const selectedPlanId = ref(SubscriptionPlanId.FREE)
const residentsCount = ref(0)
const planSaveNotice = ref('')

const activeResidentLimit = computed(() =>
  maxResidentsForSubscriptionPlan(selectedPlanId.value),
)

function syncPlanFromStorage() {
  const id = sessionProfile.value?.id
  if (!id) {
    selectedPlanId.value = SubscriptionPlanId.FREE
    return
  }
  selectedPlanId.value = getSubscriptionPlanIdForOwner(id)
}

async function refreshResidentCount() {
  if (!isAdmin) return
  try {
    residentsCount.value = (await residentsApi.list()).length
  } catch {
    residentsCount.value = 0
  }
}

async function initSettings() {
  await loadServerProfile()
  syncPlanFromStorage()
  await refreshResidentCount()
}

function selectPlan(planId) {
  const id = sessionProfile.value?.id
  if (!id) return
  saveSubscriptionPlanForOwner(id, planId)
  selectedPlanId.value = planId
  planSaveNotice.value = t('app.settingsPlanSaved')
  window.setTimeout(() => {
    planSaveNotice.value = ''
  }, 2800)
}

onMounted(initSettings)
watch(
  () => sessionProfile.value?.id,
  async () => {
    await loadServerProfile()
    syncPlanFromStorage()
    await refreshResidentCount()
  },
)
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('app.pageSettings') }}</h1>
    <p class="app-view__subtitle">{{ t('app.settingsProfileSubtitle') }}</p>

    <p v-if="isLoading" class="app-view__status">{{ t('app.settingsLoadingProfile') }}</p>
    <p v-else-if="loadError" class="app-view__status app-view__status--warn">
      {{ t('app.settingsProfileLoadError') }}
    </p>

    <section v-if="isAdmin" class="settings-card" aria-labelledby="settings-admin-heading">
      <h2 id="settings-admin-heading" class="settings-card__title">
        {{ t('app.settingsAdminProfileTitle') }}
      </h2>
      <ul class="settings-card__list" role="list">
        <li v-if="display.name">
          <strong>{{ t('auth.fullName') }}:</strong> {{ display.name }}
        </li>
        <li v-if="display.email">
          <strong>{{ t('auth.email') }}:</strong> {{ display.email }}
        </li>
        <li v-if="display.dni">
          <strong>{{ t('app.settingsAdminDniLabel') }}:</strong> {{ display.dni }}
        </li>
        <li v-if="display.address">
          <strong>{{ t('app.settingsAdminAddressLabel') }}:</strong> {{ display.address }}
        </li>
        <li v-if="display.company">
          <strong>{{ t('app.settingsAdminCompanyLabel') }}:</strong> {{ display.company }}
        </li>
        <li v-if="display.ruc">
          <strong>{{ t('app.settingsAdminRucLabel') }}:</strong> {{ display.ruc }}
        </li>
      </ul>
    </section>

    <!-- Subscriptions — solo visible para admin -->
    <section v-if="isAdmin" class="plans-section" aria-labelledby="settings-plans-heading">
      <h2 id="settings-plans-heading" class="plans-section__title">
        {{ t('app.settingsPlansTitle') }}
      </h2>
      <p class="plans-section__subtitle">{{ t('app.settingsPlansSubtitle') }}</p>
      <p class="plans-section__usage">
        {{ t('app.settingsPlanUsageLine', { current: residentsCount, max: activeResidentLimit }) }}
      </p>
      <p v-if="planSaveNotice" class="plans-section__notice" role="status">
        {{ planSaveNotice }}
      </p>

      <div class="plans-grid">

        <!-- Free -->
        <div
          class="plan-card plan-card--free"
          :class="{ 'plan-card--selected': selectedPlanId === SubscriptionPlanId.FREE }"
        >
          <div class="plan-card__header">
            <span class="plan-card__name">Free</span>
          </div>
          <div class="plan-card__price">
            <span class="plan-card__amount">S/ 0</span>
            <span class="plan-card__period">/ mes</span>
          </div>
          <p class="plan-card__range">Hasta 9 departamentos</p>
          <p class="plan-card__billing">Empieza sin costo.</p>
          <ul class="plan-card__features">
            <li><i class="pi pi-check" aria-hidden="true"></i> Dashboard y directorio de residentes.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Anuncios y registro de visitas.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Una cuenta de administrador.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Soporte comunitario.</li>
          </ul>
          <button
            type="button"
            class="plan-card__btn plan-card__btn--ghost"
            @click="selectPlan(SubscriptionPlanId.FREE)"
          >
            {{ t('app.settingsPlanSelectFree') }}
          </button>
        </div>

        <!-- Essential -->
        <div
          class="plan-card"
          :class="{ 'plan-card--selected': selectedPlanId === SubscriptionPlanId.ESSENTIAL }"
        >
          <div class="plan-card__header">
            <span class="plan-card__name">Essential</span>
          </div>
          <div class="plan-card__price">
            <span class="plan-card__amount">S/ 40</span>
            <span class="plan-card__period">/ mes (PEN)</span>
          </div>
          <p class="plan-card__range">10–15 departamentos</p>
          <p class="plan-card__billing">Facturación mensual en soles peruanos (PEN).</p>
          <ul class="plan-card__features">
            <li><i class="pi pi-check" aria-hidden="true"></i> Para edificios pequeños y condominios.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Áreas comunes, cobranzas y anuncios.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Documentos y registro de visitas.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Consola web para administradores.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Soporte por email en días hábiles.</li>
          </ul>
          <button
            type="button"
            class="plan-card__btn plan-card__btn--ghost"
            @click="selectPlan(SubscriptionPlanId.ESSENTIAL)"
          >
            {{ t('app.settingsPlanSelectEssential') }}
          </button>
        </div>

        <!-- Standard — destacado -->
        <div
          class="plan-card plan-card--highlighted"
          :class="{ 'plan-card--selected': selectedPlanId === SubscriptionPlanId.STANDARD }"
        >
          <div class="plan-card__header">
            <span class="plan-card__name">Standard</span>
            <span class="plan-card__badge">Más popular</span>
          </div>
          <div class="plan-card__price">
            <span class="plan-card__amount">S/ 80</span>
            <span class="plan-card__period">/ mes (PEN)</span>
          </div>
          <p class="plan-card__range">16–40 departamentos</p>
          <p class="plan-card__billing">Facturación mensual en PEN. Hasta 40 unidades.</p>
          <ul class="plan-card__features">
            <li><i class="pi pi-check" aria-hidden="true"></i> Para torres medianas y comunidades activas.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Mismas funciones que Essential, mayor capacidad.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Visibilidad de cuotas y morosidad.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Difusión a residentes y comités.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Soporte operativo prioritario.</li>
          </ul>
          <button
            type="button"
            class="plan-card__btn plan-card__btn--primary"
            @click="selectPlan(SubscriptionPlanId.STANDARD)"
          >
            {{ t('app.settingsPlanSelectStandard') }}
          </button>
        </div>

        <!-- Scale -->
        <div
          class="plan-card"
          :class="{ 'plan-card--selected': selectedPlanId === SubscriptionPlanId.SCALE }"
        >
          <div class="plan-card__header">
            <span class="plan-card__name">Scale</span>
          </div>
          <div class="plan-card__price">
            <span class="plan-card__amount">S/ 120</span>
            <span class="plan-card__period">/ mes (PEN)</span>
          </div>
          <p class="plan-card__range">41–80 departamentos</p>
          <p class="plan-card__billing">Facturación mensual en PEN. Nivel para no solapar con 16–40.</p>
          <ul class="plan-card__features">
            <li><i class="pi pi-check" aria-hidden="true"></i> Grandes conjuntos y edificios en altura.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Rendimiento acorde al tamaño del edificio.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Reportes para juntas y comités grandes.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Asistencia en despliegue y onboarding.</li>
            <li><i class="pi pi-check" aria-hidden="true"></i> Canal de soporte con tiempos de respuesta.</li>
          </ul>
          <button
            type="button"
            class="plan-card__btn plan-card__btn--ghost"
            @click="selectPlan(SubscriptionPlanId.SCALE)"
          >
            {{ t('app.settingsPlanSelectScale') }}
          </button>
        </div>

      </div>
    </section>

    <section
      v-if="isResident"
      class="settings-card"
      aria-labelledby="settings-resident-heading"
    >
      <h2 id="settings-resident-heading" class="settings-card__title">
        {{ t('app.settingsResidentProfileTitle') }}
      </h2>
      <ul class="settings-card__list" role="list">
        <li v-if="display.name">
          <strong>{{ t('app.residentNameLabel') }}:</strong> {{ display.name }}
        </li>
        <li v-if="display.floor != null && display.floor !== ''">
          <strong>{{ t('app.residentFloorLabel') }}:</strong> {{ display.floor }}
        </li>
        <li v-if="display.code != null && display.code !== ''">
          <strong>{{ t('app.residentCodeLabel') }}:</strong> {{ display.code }}
        </li>
        <li v-if="display.email">
          <strong>{{ t('auth.email') }}:</strong> {{ display.email }}
        </li>
        <li v-if="display.admissionDate">
          <strong>{{ t('app.settingsResidentAdmissionLabel') }}:</strong>
          {{ display.admissionDate }}
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.app-view {
  padding: 1.75rem 1.5rem 3rem;
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
  margin: 0.5rem 0 1.5rem;
  font-size: 0.875rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.app-view__status {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.app-view__status--warn {
  color: #b42318;
}

/* ── Perfil card ── */
.settings-card {
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  padding: 1.2rem 1.25rem;
  max-width: 32rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  margin-bottom: 1.5rem;
}

.settings-card__title {
  margin: 0 0 0.65rem;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--apple-text, #1d1d1f);
}

.settings-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--apple-text, #1d1d1f);
}

/* ── Sección de planes ── */
.plans-section {
  margin-top: 2rem;
}

.plans-section__title {
  margin: 0 0 0.25rem;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--apple-text, #1d1d1f);
}

.plans-section__subtitle {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.plans-section__usage {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--apple-text, #1d1d1f);
}

.plans-section__notice {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: #248a3d;
}

/* ── Grid de planes ── */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  align-items: stretch;
}

/* ── Tarjeta de plan ── */
.plan-card {
  display: flex;
  flex-direction: column;
  padding: 1.35rem 1.25rem 1.25rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.plan-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

/* Plan destacado */
.plan-card--highlighted {
  border-color: #0a84ff;
  box-shadow: 0 0 0 1px #0a84ff, 0 4px 16px rgba(10, 132, 255, 0.12);
}

.plan-card--highlighted:hover {
  box-shadow: 0 0 0 1px #0a84ff, 0 8px 24px rgba(10, 132, 255, 0.18);
}

/* Plan free — borde verde */
.plan-card--free {
  border-color: rgba(52, 199, 89, 0.4);
}

.plan-card--selected {
  box-shadow: 0 0 0 2px #0a84ff, 0 4px 16px rgba(10, 132, 255, 0.12);
}

.plan-card--highlighted.plan-card--selected {
  box-shadow: 0 0 0 2px #0a84ff, 0 0 0 1px #0a84ff, 0 8px 24px rgba(10, 132, 255, 0.18);
}

/* ── Header del plan ── */
.plan-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}

.plan-card__name {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--apple-text, #1d1d1f);
}

.plan-card__badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 980px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: #0a84ff;
  color: #fff;
}

/* ── Precio ── */
.plan-card__price {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 0.4rem;
}

.plan-card__amount {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  color: var(--apple-text, #1d1d1f);
}

.plan-card--highlighted .plan-card__amount {
  color: #0a84ff;
}

.plan-card__period {
  font-size: 0.8125rem;
  color: var(--apple-text-secondary, #6e6e73);
}

/* ── Rango de apartamentos ── */
.plan-card__range {
  margin: 0 0 0.2rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--apple-text, #1d1d1f);
}

/* ── Texto de facturación ── */
.plan-card__billing {
  margin: 0 0 1rem;
  font-size: 0.75rem;
  color: var(--apple-text-secondary, #6e6e73);
  line-height: 1.4;
}

/* ── Lista de features ── */
.plan-card__features {
  flex: 1;
  list-style: none;
  margin: 0 0 1.25rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--apple-text, #1d1d1f);
  line-height: 1.4;
}

.plan-card__features li {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.plan-card__features .pi-check {
  color: #34c759;
  font-size: 0.75rem;
  margin-top: 0.1rem;
  flex-shrink: 0;
}

/* ── Botones ── */
.plan-card__btn {
  width: 100%;
  padding: 0.6rem 1rem;
  border-radius: 980px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s ease, opacity 0.15s ease;
  margin-top: auto;
}

.plan-card__btn--primary {
  background: #0a84ff;
  color: #fff;
}

.plan-card__btn--primary:hover {
  background: #0071e3;
}

.plan-card__btn--ghost {
  background: rgba(0, 0, 0, 0.05);
  color: var(--apple-text, #1d1d1f);
}

.plan-card__btn--ghost:hover {
  background: rgba(0, 0, 0, 0.09);
}
</style>
