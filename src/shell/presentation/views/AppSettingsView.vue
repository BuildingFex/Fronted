<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSession } from '@/iam/application/sessionStore.js'
import { authApi } from '@/iam/infrastructure/authApi.js'

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

onMounted(loadServerProfile)
watch(
  () => sessionProfile.value?.id,
  () => loadServerProfile(),
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

    <section
      v-else-if="isResident"
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

.app-view__subtitle {
  margin: 0.35rem 0 1.25rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.app-view__status {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--apple-text-secondary, #6e6e73);
}

.app-view__status--warn {
  color: #b42318;
}

.settings-card {
  background: #fff;
  border: 1px solid #e8e8ed;
  border-radius: 14px;
  padding: 1rem 1.1rem;
  max-width: 32rem;
}

.settings-card__title {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 600;
}

.settings-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: #1d1d1f;
}
</style>
