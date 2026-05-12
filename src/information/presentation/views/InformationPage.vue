<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSession } from '@/iam/application/sessionStore.js'
import { announcementsApi } from '@/information/infrastructure/announcementsApi.js'
import AnnouncementForm from '../components/AnnouncementForm.vue'
import AnnouncementsList from '../components/AnnouncementsList.vue'

const { t } = useI18n()
const { isAdmin, state: session } = useSession()

const announcements = ref([])
const loading = ref(false)
const loadError = ref(false)

async function fetchAnnouncements() {
  loading.value = true
  loadError.value = false
  try {
    announcements.value = await announcementsApi.list()
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function handleCreate(payload) {
  const announcement = {
    ...payload,
    authorId: session.profile?.id ?? '',
    authorName: session.profile?.name ?? 'Admin',
  }
  await announcementsApi.add(announcement)
  await fetchAnnouncements()
}

async function handleDelete(id) {
  await announcementsApi.remove(id)
  announcements.value = announcements.value.filter((a) => a.id !== id)
}

onMounted(fetchAnnouncements)
</script>

<template>
  <div class="app-view">
    <h1 class="app-view__title">{{ t('information.pageTitle') }}</h1>
    <p class="app-view__subtitle">
      {{ isAdmin ? t('information.adminSubtitle') : t('information.residentSubtitle') }}
    </p>

    <div class="finance-page">
      <div v-if="isAdmin" class="finance-toolbar-row finance-toolbar-row--information">
        <AnnouncementForm @submit="handleCreate" />
      </div>

      <section
        class="finance-panel finance-panel--information import-panel"
        :aria-labelledby="isAdmin ? 'info-announcements-heading-admin' : 'info-announcements-heading'"
      >
        <h2
          :id="isAdmin ? 'info-announcements-heading-admin' : 'info-announcements-heading'"
          class="finance-panel__section-title"
        >
          {{ t('information.announcementsPanelTitle') }}
        </h2>

        <p v-if="loadError" class="import-alert import-alert--error" role="alert">
          <i class="pi pi-exclamation-circle" aria-hidden="true" />
          {{ t('information.loadError') }}
        </p>

        <AnnouncementsList
          :announcements="announcements"
          :loading="loading"
          :is-admin="isAdmin"
          :layout="isAdmin ? 'finance' : 'default'"
          @delete="handleDelete"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Match AppFinanceView shell typography */
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

.finance-toolbar-row--information :deep(.ann-form__trigger) {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 500;
  font-size: 0.8125rem;
  padding-block: 0.5rem;
  padding-inline: 1rem;
  border-radius: 980px;
  border: 1px solid #d2d2d7;
  background: #fff;
  color: var(--apple-text, #1d1d1f);
  cursor: pointer;
  font-family: inherit;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.finance-toolbar-row--information :deep(.ann-form__trigger:hover) {
  background: #fafafa;
  border-color: rgba(0, 0, 0, 0.14);
}

.finance-toolbar-row--information :deep(.ann-form__trigger:focus-visible) {
  outline: none;
  border-color: #0a84ff;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
}

.finance-panel {
  padding: 1.2rem 1.25rem 1.35rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.finance-panel__section-title {
  margin: 0 0 0.5rem;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--apple-text, #1d1d1f);
}

.import-alert {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.85rem;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.import-alert--error {
  color: #b42318;
  background: rgba(180, 35, 24, 0.06);
  border: 1px solid rgba(180, 35, 24, 0.12);
}
</style>
