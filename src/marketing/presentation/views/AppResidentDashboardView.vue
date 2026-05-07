<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSession } from '@/marketing/application/sessionStore.js'

const { t } = useI18n()
const { state } = useSession()
const profile = computed(() => state.profile ?? {})
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('resident.dashboardTitle') }}</h1>
    <p class="app-view__subtitle">{{ t('resident.welcome', { name: profile.name || '' }) }}</p>

    <section class="resident-card">
      <h2 class="resident-card__title">{{ t('resident.profileTitle') }}</h2>
      <ul class="resident-card__list" role="list">
        <li><strong>{{ t('app.residentNameLabel') }}:</strong> {{ profile.name }}</li>
        <li><strong>{{ t('app.residentFloorLabel') }}:</strong> {{ profile.floor }}</li>
        <li><strong>{{ t('app.residentCodeLabel') }}:</strong> {{ profile.code }}</li>
        <li v-if="profile.email"><strong>{{ t('auth.email') }}:</strong> {{ profile.email }}</li>
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

.resident-card {
  background: #fff;
  border: 1px solid #e8e8ed;
  border-radius: 14px;
  padding: 1rem 1.1rem;
  max-width: 32rem;
}

.resident-card__title {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 600;
}

.resident-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: #1d1d1f;
}
</style>
