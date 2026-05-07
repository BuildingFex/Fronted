<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SkipLink from '../components/SkipLink.vue'
import { AppRouteNames } from '@/shell/domain/appRoutes.js'
import { useSession } from '@/iam/application/sessionStore.js'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { isResident, clearSession } = useSession()

const adminNavItems = computed(() => [
  {
    key: 'dashboard',
    label: t('app.dashboard'),
    icon: 'pi pi-th-large',
    routeName: AppRouteNames.APP_DASHBOARD,
  },
  {
    key: 'advancedManagement',
    label: t('app.advancedManagement'),
    icon: 'pi pi-sitemap',
    routeName: AppRouteNames.APP_ADVANCED_MANAGEMENT,
  },
  {
    key: 'import',
    label: t('app.import'),
    icon: 'pi pi-upload',
    routeName: AppRouteNames.APP_IMPORT,
  },
  {
    key: 'finance',
    label: t('app.finance'),
    icon: 'pi pi-wallet',
    routeName: AppRouteNames.APP_FINANCE,
  },
  {
    key: 'generation',
    label: t('app.generation'),
    icon: 'pi pi-cog',
    routeName: AppRouteNames.APP_GENERATION,
  },
  {
    key: 'incidents',
    label: t('app.incidents'),
    icon: 'pi pi-exclamation-circle',
    routeName: AppRouteNames.APP_INCIDENTS,
  },
  {
    key: 'information',
    label: t('app.information'),
    icon: 'pi pi-info-circle',
    routeName: AppRouteNames.APP_INFORMATION,
  },
])

const residentNavItems = computed(() => [
  {
    key: 'residentDashboard',
    label: t('resident.navDashboard'),
    icon: 'pi pi-th-large',
    routeName: AppRouteNames.APP_RESIDENT_DASHBOARD,
  },
  {
    key: 'residentFinance',
    label: t('resident.navFinance'),
    icon: 'pi pi-wallet',
    routeName: AppRouteNames.APP_RESIDENT_FINANCE,
  },
  {
    key: 'residentPayments',
    label: t('resident.navPayments'),
    icon: 'pi pi-credit-card',
    routeName: AppRouteNames.APP_RESIDENT_PAYMENTS,
  },
  {
    key: 'residentServices',
    label: t('resident.navServices'),
    icon: 'pi pi-bolt',
    routeName: AppRouteNames.APP_RESIDENT_SERVICES,
  },
  {
    key: 'residentIncidents',
    label: t('resident.navIncidents'),
    icon: 'pi pi-exclamation-circle',
    routeName: AppRouteNames.APP_RESIDENT_INCIDENTS,
  },
  {
    key: 'residentSupport',
    label: t('resident.navSupport'),
    icon: 'pi pi-question-circle',
    routeName: AppRouteNames.APP_RESIDENT_SUPPORT,
  },
])

const appNavItems = computed(() =>
  isResident.value ? residentNavItems.value : adminNavItems.value,
)
const activeAppNavIndex = computed(() =>
  appNavItems.value.findIndex((item) => item.routeName === route.name),
)
const isAppNavPillVisible = computed(() => activeAppNavIndex.value >= 0)

function onLogout() {
  clearSession()
  router.push({ name: AppRouteNames.LOGIN })
}

function toggleAppLocale() {
  locale.value = locale.value === 'es' ? 'en' : 'es'
}
</script>

<template>
  <div class="app-shell">
    <SkipLink />
    <aside class="app-shell__sidebar">
      <header class="app-shell__top">
        <RouterLink class="app-shell__brand" :to="{ name: AppRouteNames.APP_DASHBOARD }">
          <img
            src="/logo-buildingfex.png"
            :alt="t('brand')"
            class="app-shell__logo"
            width="120"
            height="29"
            decoding="async"
          />
        </RouterLink>

        <button
          type="button"
          class="app-shell__lang-switch-btn"
          role="switch"
          :aria-label="t('app.languageSwitch')"
          :aria-checked="locale === 'en'"
          @click="toggleAppLocale"
        >
          <span class="app-shell__segment-track">
            <span
              class="app-shell__segment-pill"
              :class="{ 'app-shell__segment-pill--right': locale === 'en' }"
              aria-hidden="true"
            />
            <span
              class="app-shell__segment-locale"
              :class="{ 'app-shell__segment-tab--active': locale === 'es' }"
              aria-hidden="true"
            >ES</span>
            <span
              class="app-shell__segment-locale"
              :class="{ 'app-shell__segment-tab--active': locale === 'en' }"
              aria-hidden="true"
            >EN</span>
          </span>
        </button>
      </header>

      <div class="app-shell__divider" role="presentation" />

      <nav class="app-shell__nav" :aria-label="t('app.sidebarNav')">
        <div class="app-shell__nav-track" :style="{ '--nav-pill-index': activeAppNavIndex }">
          <span
            class="app-shell__nav-pill"
            :class="{ 'app-shell__nav-pill--hidden': !isAppNavPillVisible }"
            aria-hidden="true"
          />
          <RouterLink
            v-for="item in appNavItems"
            :key="item.key"
            class="app-shell__nav-link"
            active-class="app-shell__nav-link--active"
            exact-active-class="app-shell__nav-link--active"
            :to="{ name: item.routeName }"
          >
            <i :class="[item.icon, 'app-shell__nav-link-icon']" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <footer class="app-shell__footer">
        <RouterLink
          class="app-shell__chip app-shell__chip--outline app-shell__chip--footer"
          active-class="app-shell__chip--outline-active"
          exact-active-class="app-shell__chip--outline-active"
          :to="{ name: AppRouteNames.APP_SETTINGS }"
        >
          <i class="pi pi-cog app-shell__chip-icon" aria-hidden="true" />
          {{ t('app.settings') }}
        </RouterLink>
        <button type="button" class="app-shell__chip app-shell__chip--danger" @click="onLogout">
          <i class="pi pi-sign-out app-shell__chip-icon" aria-hidden="true" />
          {{ t('app.logout') }}
        </button>
      </footer>
    </aside>
    <main id="main-content" class="app-shell__main" role="main" tabindex="-1">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  --shell-sidebar-bg: #ffffff;
  --shell-border: #e8e8ed;
  --shell-text: #1d1d1f;
  --shell-muted: #6e6e73;
  --shell-nav-active: #f2f2f7;
  --shell-danger-bg: #fdecee;
  --shell-danger-text: #b42318;
  --shell-pill-radius: 980px;

  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  font-family: var(--apple-font, -apple-system, system-ui, sans-serif);
  -webkit-font-smoothing: antialiased;
  background: var(--apple-bg-secondary, #f5f5f7);
}

.app-shell__sidebar {
  display: flex;
  flex-direction: column;
  width: 13rem;
  flex-shrink: 0;
  background: var(--shell-sidebar-bg);
  border-right: 1px solid var(--shell-border);
  padding: 1rem 0.55rem 1rem;
  box-sizing: border-box;
  align-items: center;
  text-align: center;
}

.app-shell__top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.app-shell__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  text-decoration: none;
  color: inherit;
  border-radius: 12px;
  padding: 0.15rem 0.25rem;
  margin: -0.15rem -0.25rem;
}

.app-shell__brand:focus-visible {
  outline: var(--apple-focus-ring, 2px solid var(--apple-blue));
  outline-offset: 2px;
}

.app-shell__logo {
  display: block;
  height: auto;
  max-width: 7.75rem;
  margin-left: auto;
  margin-right: auto;
}

.app-shell__segment {
  width: 100%;
  max-width: 11.25rem;
}

.app-shell__segment-track {
  /* ~50% menos altura que la versión anterior */
  --seg-p: 0.105rem;
  --seg-gap: 0.18rem;

  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--seg-gap);
  padding: var(--seg-p);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.app-shell__segment-pill {
  position: absolute;
  top: var(--seg-p);
  bottom: var(--seg-p);
  left: var(--seg-p);
  z-index: 0;
  width: calc((100% - 2 * var(--seg-p) - var(--seg-gap)) / 2);
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.07);
  pointer-events: none;
  transition: transform 0.42s cubic-bezier(0.34, 1.2, 0.64, 1);
  will-change: transform;
}

.app-shell__segment-pill--right {
  transform: translateX(calc(100% + var(--seg-gap)));
}

.app-shell__segment-tab {
  position: relative;
  z-index: 1;
  margin: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.28rem;
  padding: 0.14rem 0.22rem;
  min-height: 1.18rem;
  font-size: 0.625rem;
  line-height: 1.2;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--shell-muted);
  background: transparent;
  border: none;
  border-radius: 999px;
  font-family: inherit;
  cursor: pointer;
  box-sizing: border-box;
  transition:
    color 0.28s ease,
    font-weight 0.28s ease;
}

.app-shell__segment-tab:hover {
  color: var(--shell-text);
}

.app-shell__segment-tab:focus-visible {
  outline: var(--apple-focus-ring, 2px solid var(--apple-blue));
  outline-offset: 2px;
}

.app-shell__segment-tab--active {
  color: var(--shell-text);
  font-weight: 700;
}

.app-shell__segment-tab-icon {
  flex-shrink: 0;
  font-size: 0.56rem;
  line-height: 1;
  opacity: 0.88;
}

.app-shell__segment-tab--active .app-shell__segment-tab-icon {
  opacity: 1;
}

.app-shell__segment-tab-text {
  display: block;
  max-width: 100%;
  text-align: center;
  text-wrap: balance;
}

.app-shell__segment-locale {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0.14rem 0.22rem;
  min-height: 1.18rem;
  font-size: 0.625rem;
  line-height: 1.2;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--shell-muted);
  pointer-events: none;
  user-select: none;
  box-sizing: border-box;
}

.app-shell__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.32rem 0.5rem;
  border: none;
  border-radius: var(--shell-pill-radius);
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
  box-sizing: border-box;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.app-shell__chip-icon {
  font-size: 0.75rem;
  opacity: 0.85;
}

.app-shell__chip--outline {
  background: #fff;
  color: var(--shell-text);
  border: 1px solid var(--shell-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.app-shell__chip--outline:hover {
  background: #fafafa;
  border-color: #d2d2d7;
}

.app-shell__chip--outline:focus-visible {
  outline: var(--apple-focus-ring, 2px solid var(--apple-blue));
  outline-offset: 2px;
}

.app-shell__chip--outline-active {
  background: var(--shell-nav-active);
  border-color: #d2d2d7;
}

.app-shell__chip--footer {
  width: 100%;
  max-width: 100%;
  justify-content: center;
}

.app-shell__chip--danger {
  width: 100%;
  max-width: 100%;
  justify-content: center;
  background: var(--shell-danger-bg);
  color: var(--shell-danger-text);
  border: 1px solid transparent;
}

.app-shell__chip--danger:hover {
  filter: brightness(0.97);
}

.app-shell__chip--danger:focus-visible {
  outline: 2px solid var(--shell-danger-text);
  outline-offset: 2px;
}

.app-shell__divider {
  height: 1px;
  background: var(--shell-border);
  margin: 1.125rem 0 0.875rem;
  flex-shrink: 0;
  width: 100%;
  max-width: 11.25rem;
}

.app-shell__nav {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  justify-content: center;
}

.app-shell__nav-track {
  --nav-p: 0.21rem;
  --nav-gap: 0.21rem;
  --nav-item-height: 2rem;
  display: grid;
  grid-template-columns: 1fr;
  grid-auto-rows: var(--nav-item-height);
  gap: var(--nav-gap);
  padding: var(--nav-p);
  width: 100%;
  max-width: 11.25rem;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
  position: relative;
}

.app-shell__nav-pill {
  position: absolute;
  top: var(--nav-p);
  left: var(--nav-p);
  right: var(--nav-p);
  z-index: 0;
  height: var(--nav-item-height);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.07);
  pointer-events: none;
  opacity: 1;
  transform: translateY(calc((var(--nav-item-height) + var(--nav-gap)) * var(--nav-pill-index)));
  transition:
    transform 0.42s cubic-bezier(0.34, 1.2, 0.64, 1),
    opacity 0.2s ease;
  will-change: transform;
}

.app-shell__nav-pill--hidden {
  opacity: 0;
}

.app-shell__nav-link {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0;
  width: 100%;
  text-align: center;
  padding: 0.3rem 0.35rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--shell-muted);
  background: transparent;
  text-decoration: none;
  box-sizing: border-box;
  transition:
    color 0.28s ease,
    font-weight 0.28s ease;
}

.app-shell__nav-link:hover {
  color: var(--shell-text);
}

.app-shell__nav-link:focus-visible {
  outline: var(--apple-focus-ring, 2px solid var(--apple-blue));
  outline-offset: 2px;
}

.app-shell__nav-link--active {
  color: var(--shell-text);
  font-weight: 700;
}

.app-shell__nav-link-icon {
  font-size: 0.85rem;
  color: var(--shell-muted);
  width: 1.1rem;
  text-align: center;
  flex-shrink: 0;
  transition: color 0.28s ease;
}

.app-shell__nav-link--active .app-shell__nav-link-icon {
  color: var(--shell-text);
}

.app-shell__footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding-top: 1rem;
  margin-top: auto;
  border-top: 1px solid var(--shell-border);
  width: 100%;
  max-width: 11.25rem;
}

.app-shell__lang-switch-btn {
  display: block;
  width: 100%;
  max-width: 11.25rem;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 0;
  border-radius: 999px;
}

.app-shell__lang-switch-btn:focus {
  outline: none;
}

.app-shell__lang-switch-btn:focus-visible {
  outline: var(--apple-focus-ring, 2px solid var(--apple-blue));
  outline-offset: 2px;
  border-radius: 12px;
}

.app-shell__main {
  flex: 1;
  min-width: 0;
  min-height: inherit;
  background: var(--apple-bg, #ffffff);
}

@media (prefers-reduced-motion: reduce) {
  .app-shell__segment-pill,
  .app-shell__nav-pill {
    transition-duration: 0.01ms;
  }

}

@media (max-width: 720px) {
  .app-shell {
    flex-direction: column;
  }

  .app-shell__sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--shell-border);
    max-height: none;
  }

  .app-shell__divider,
  .app-shell__nav-track,
  .app-shell__footer {
    max-width: min(16rem, 100%);
  }

  .app-shell__nav-link {
    padding: 0.45rem 0.5rem;
    font-size: 0.8125rem;
  }

  .app-shell__footer {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
  }

  .app-shell__chip--footer,
  .app-shell__chip--danger {
    width: auto;
    flex: 1 1 auto;
    min-width: min(100%, 8rem);
    justify-content: center;
  }

  .app-shell__lang-switch-btn {
    flex: 1 1 100%;
    max-width: 11.25rem;
  }
}
</style>
