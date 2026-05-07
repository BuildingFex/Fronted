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
    <h1 class="app-view__title">{{ t('resident.incidentsTitle') }}</h1>
    <p class="app-view__subtitle">
      {{ t('resident.incidentsSubtitle', { name: profile.name || '' }) }}
    </p>
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
  margin: 0.35rem 0 0;
  color: var(--apple-text-secondary, #6e6e73);
}
</style>
