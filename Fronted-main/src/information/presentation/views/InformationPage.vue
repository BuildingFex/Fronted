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
    <div class="info-header">
      <div>
        <h1 class="app-view__title">{{ t('information.pageTitle') }}</h1>
        <p class="app-view__subtitle">
          {{ isAdmin ? t('information.adminSubtitle') : t('information.residentSubtitle') }}
        </p>
      </div>
      <AnnouncementForm v-if="isAdmin" @submit="handleCreate" />
    </div>

    <p v-if="loadError" class="info-error">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      {{ t('information.loadError') }}
    </p>

    <AnnouncementsList
      :announcements="announcements"
      :loading="loading"
      :is-admin="isAdmin"
      @delete="handleDelete"
    />
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
  margin: 0.3rem 0 0;
  font-size: 0.84rem;
  color: #6e6e73;
  font-weight: 400;
}

.info-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.info-error {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 1rem;
  font-size: 0.84rem;
  color: #b42318;
  font-weight: 500;
}
</style>
