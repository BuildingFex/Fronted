<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  announcements: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  /** When `finance`, use the same card grid / surfaces as Finanzas (admin information). */
  layout: { type: String, default: 'default' },
})

const emit = defineEmits(['delete'])

function priorityClass(priority) {
  return `ann-badge--${priority}`
}

function priorityLabel(priority) {
  const map = {
    normal: t('information.priorityNormal'),
    important: t('information.priorityImportant'),
    urgent: t('information.priorityUrgent'),
  }
  return map[priority] ?? map.normal
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatExpiry(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function durationLabel(days) {
  if (!days) return ''
  if (days === 7)  return t('information.duration7')
  if (days === 15) return t('information.duration15')
  if (days === 30) return t('information.duration30')
  return `${days} ${t('information.durationDays')}`
}

function isExpired(iso) {
  if (!iso) return false
  return new Date() > new Date(iso)
}
</script>

<template>
  <div class="ann-list" :class="{ 'ann-list--finance': layout === 'finance' }">
    <!-- loading -->
    <p v-if="loading" class="ann-list__status">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />
      {{ t('information.loading') }}
    </p>

    <!-- empty -->
    <div v-else-if="!announcements.length" class="ann-list__empty">
      <i class="pi pi-megaphone ann-list__empty-icon" aria-hidden="true" />
      <p class="ann-list__empty-text">{{ t('information.empty') }}</p>
    </div>

    <!-- cards -->
    <TransitionGroup v-else name="ann-card" tag="div" class="ann-list__grid">
      <article
        v-for="ann in announcements"
        :key="ann.id"
        class="ann-card"
        :class="{
          'ann-card--urgent': ann.priority === 'urgent',
          'ann-card--expired': isExpired(ann.expiresAt),
        }"
      >
        <header class="ann-card__header">
          <span class="ann-badge" :class="priorityClass(ann.priority)">
            {{ priorityLabel(ann.priority) }}
          </span>
          <div class="ann-card__header-right">
            <span v-if="ann.duration" class="ann-duration-badge">
              <i class="pi pi-clock" aria-hidden="true" />
              {{ durationLabel(ann.duration) }}
            </span>
            <button
              v-if="isAdmin"
              type="button"
              class="ann-card__delete"
              :aria-label="t('information.delete')"
              @click="emit('delete', ann.id)"
            >
              <i class="pi pi-trash" aria-hidden="true" />
            </button>
          </div>
        </header>

        <h3 class="ann-card__title">{{ ann.title }}</h3>
        <p class="ann-card__body">{{ ann.body }}</p>

        <footer class="ann-card__footer">
          <span class="ann-card__author">
            <i class="pi pi-user" aria-hidden="true" />
            {{ ann.authorName }}
          </span>
          <div class="ann-card__footer-right">
            <time class="ann-card__date" :datetime="ann.createdAt">
              {{ formatDate(ann.createdAt) }}
            </time>
            <span v-if="ann.expiresAt" class="ann-card__expiry" :class="{ 'ann-card__expiry--expired': isExpired(ann.expiresAt) }">
              <i class="pi pi-calendar-times" aria-hidden="true" />
              {{ isExpired(ann.expiresAt) ? t('information.expired') : t('information.expiresOn', { date: formatExpiry(ann.expiresAt) }) }}
            </span>
          </div>
        </footer>
      </article>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* Finance-style admin layout (matches AppFinanceView history cards) */
.ann-list--finance .ann-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.ann-list--finance .ann-card {
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 1.1rem 1.2rem;
  box-shadow: none;
}

.ann-list--finance .ann-card:hover {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.08);
}

.ann-list--finance .ann-card--urgent {
  border-left-width: 3px;
}

.ann-list__status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6e6e73;
  font-size: 0.875rem;
  padding: 2rem 0;
}

/* ── empty ── */
.ann-list__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: #86868b;
}
.ann-list__empty-icon {
  font-size: 2.2rem;
  margin-bottom: 0.75rem;
  opacity: 0.5;
}
.ann-list__empty-text {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
}

/* ── grid ── */
.ann-list__grid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

/* ── card ── */
.ann-card {
  background: #fff;
  border: 1px solid #e8e8ed;
  border-radius: 14px;
  padding: 1.1rem 1.25rem;
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
}
.ann-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border-color: #d2d2d7;
}
.ann-card--urgent {
  border-left: 3px solid #ff3b30;
}

.ann-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.55rem;
}

.ann-card__header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* ── duration badge ── */
.ann-duration-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: #0071e3;
  background: #e8f0fe;
  padding: 0.15rem 0.5rem;
  border-radius: 980px;
}

/* ── expiry info ── */
.ann-card__footer-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
}

.ann-card__expiry {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.65rem;
  color: #34a853;
  font-weight: 500;
}
.ann-card__expiry--expired {
  color: #b42318;
}

/* ── expired card ── */
.ann-card--expired {
  opacity: 0.55;
  border-style: dashed;
}

.ann-card__delete {
  background: none;
  border: none;
  color: #86868b;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.2rem 0.35rem;
  border-radius: 6px;
  transition: color 0.15s ease, background 0.15s ease;
}
.ann-card__delete:hover {
  color: #b42318;
  background: #fdecee;
}
.ann-card__delete:focus-visible {
  outline: 2px solid #b42318;
  outline-offset: 2px;
}

.ann-card__title {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
}

.ann-card__body {
  margin: 0 0 0.75rem;
  font-size: 0.84rem;
  color: #3a3a3c;
  line-height: 1.55;
  white-space: pre-line;
}

.ann-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.72rem;
  color: #86868b;
}
.ann-card__author {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-weight: 500;
}
.ann-card__date {
  font-variant-numeric: tabular-nums;
}

/* ── badge ── */
.ann-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.55rem;
  border-radius: 980px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.ann-badge--normal {
  background: #f2f2f7;
  color: #6e6e73;
}
.ann-badge--important {
  background: #fff3e0;
  color: #e65100;
}
.ann-badge--urgent {
  background: #fdecee;
  color: #b42318;
}

/* ── transition ── */
.ann-card-enter-active { transition: all 0.3s ease; }
.ann-card-leave-active { transition: all 0.25s ease; }
.ann-card-enter-from { opacity: 0; transform: translateY(-8px); }
.ann-card-leave-to { opacity: 0; transform: translateX(16px); }
</style>
