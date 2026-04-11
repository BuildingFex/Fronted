<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import SkipLink from '../components/SkipLink.vue'
import { MarketingRouteNames } from '@/marketing/domain/marketingRoutes.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const isRegister = computed(() => route.name === MarketingRouteNames.REGISTER)

/** Demo: correos que simulan “no registrados”. Cualquier otro email con formato válido = registrado. */
const HARDCODE_UNREGISTERED_EMAILS = ['noregist@example.com', 'no@buildingfex.test']

const loginStep = ref(1)
const loginEmail = ref('')
const loginPassword = ref('')
const loginEmailError = ref('')

const regName = ref('')
const regEmail = ref('')
const regPassword = ref('')

function isEmailRegisteredHardcoded(email) {
  const e = email.trim().toLowerCase()
  return !HARDCODE_UNREGISTERED_EMAILS.includes(e)
}

function onLoginContinue() {
  loginEmailError.value = ''
  const raw = loginEmail.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    loginEmailError.value = t('auth.emailInvalid')
    return
  }
  if (!isEmailRegisteredHardcoded(raw)) {
    loginEmailError.value = t('auth.emailNotRegistered')
    return
  }
  loginStep.value = 2
}

function handleLoginSubmit() {
  if (loginStep.value === 1) {
    onLoginContinue()
    return
  }
  onLoginSubmit()
}

function onLoginSubmit() {
  // Demo: sin backend; cualquier contraseña tras paso 2 entra a la vista en blanco
  router.push({ name: MarketingRouteNames.APP_DASHBOARD })
}

function onRegisterSubmit() {
  // Demo: sin backend; crear cuenta lleva al panel (dashboard)
  router.push({ name: MarketingRouteNames.APP_DASHBOARD })
}

watch(
  () => route.name,
  (name) => {
    if (name === MarketingRouteNames.LOGIN) {
      loginStep.value = 1
      loginPassword.value = ''
      loginEmailError.value = ''
    }
  },
)

watch(loginEmail, () => {
  if (loginStep.value === 2) {
    loginStep.value = 1
    loginPassword.value = ''
    loginEmailError.value = ''
  }
})
</script>

<template>
  <div class="auth-page">
    <SkipLink />
    <main id="main-content" class="auth-main" role="main" tabindex="-1">
      <div class="auth-shell">
        <nav class="auth-tabs" :aria-label="t('auth.tabsAria')" role="tablist">
          <div class="auth-tabs__track">
            <span
              class="auth-tabs__pill"
              :class="{ 'auth-tabs__pill--register': isRegister }"
              aria-hidden="true"
            />
            <RouterLink
              class="auth-tab"
              role="tab"
              :class="{ 'auth-tab--active': !isRegister }"
              :aria-selected="!isRegister"
              :to="{ name: MarketingRouteNames.LOGIN }"
            >
              {{ t('auth.loginTab') }}
            </RouterLink>
            <RouterLink
              class="auth-tab"
              role="tab"
              :class="{ 'auth-tab--active': isRegister }"
              :aria-selected="isRegister"
              :to="{ name: MarketingRouteNames.REGISTER }"
            >
              {{ t('auth.registerTab') }}
            </RouterLink>
          </div>
        </nav>

        <div v-if="!isRegister" class="auth-card auth-card--centered">
          <div class="auth-brand">
            <img
              src="/logo-buildingfex.png"
              :alt="t('brand')"
              class="auth-logo"
              width="200"
              height="48"
              decoding="async"
            />
          </div>
          <h1 class="auth-title auth-title--center">{{ t('auth.loginTitle') }}</h1>
          <p class="auth-subtitle">{{ t('auth.loginSubtitle') }}</p>

          <form class="auth-form auth-form--narrow" :aria-label="t('auth.ariaLogin')" @submit.prevent="handleLoginSubmit">
            <div class="auth-field">
              <input
                v-model="loginEmail"
                class="auth-input"
                type="email"
                name="email"
                autocomplete="email"
                required
                :aria-label="t('auth.emailPlaceholder')"
                :placeholder="t('auth.emailPlaceholder')"
              />
            </div>
            <div v-if="loginStep === 2" class="auth-field auth-field--step2">
              <input
                v-model="loginPassword"
                class="auth-input"
                type="password"
                name="password"
                autocomplete="current-password"
                required
                :aria-label="t('auth.passwordPlaceholder')"
                :placeholder="t('auth.passwordPlaceholder')"
              />
            </div>
            <p v-if="loginEmailError" class="auth-error" role="alert">{{ loginEmailError }}</p>
            <Button
              type="submit"
              class="auth-submit"
              rounded
              :label="loginStep === 1 ? t('auth.continue') : t('auth.signIn')"
              severity="info"
            />
          </form>
        </div>

        <div v-else class="auth-card auth-card--centered">
          <div class="auth-brand">
            <img
              src="/logo-buildingfex.png"
              :alt="t('brand')"
              class="auth-logo"
              width="200"
              height="48"
              decoding="async"
            />
          </div>
          <h1 class="auth-title auth-title--center">{{ t('auth.registerTitle') }}</h1>
          <p class="auth-subtitle">{{ t('auth.registerSubtitle') }}</p>

          <form class="auth-form auth-form--narrow" :aria-label="t('auth.ariaRegister')" @submit.prevent="onRegisterSubmit">
            <div class="auth-field">
              <input
                v-model="regName"
                class="auth-input"
                type="text"
                name="name"
                autocomplete="name"
                required
                :aria-label="t('auth.fullNamePlaceholder')"
                :placeholder="t('auth.fullNamePlaceholder')"
              />
            </div>
            <div class="auth-field">
              <input
                v-model="regEmail"
                class="auth-input"
                type="email"
                name="email"
                autocomplete="email"
                required
                :aria-label="t('auth.emailPlaceholder')"
                :placeholder="t('auth.emailPlaceholder')"
              />
            </div>
            <div class="auth-field">
              <input
                v-model="regPassword"
                class="auth-input"
                type="password"
                name="password"
                autocomplete="new-password"
                required
                :aria-label="t('auth.passwordPlaceholder')"
                :placeholder="t('auth.passwordPlaceholder')"
              />
            </div>
            <Button
              type="submit"
              class="auth-submit"
              rounded
              :label="t('auth.createAccount')"
              severity="info"
            />
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--apple-bg-secondary, #f5f5f7);
  font-family: var(--apple-font, -apple-system, system-ui, sans-serif);
  -webkit-font-smoothing: antialiased;
}

.auth-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(env(safe-area-inset-top, 0px) + 2rem) 1.25rem 2.5rem;
}

.auth-shell {
  width: 100%;
  max-width: 420px;
}

.auth-tabs {
  margin-bottom: 1rem;
}

.auth-tabs__track {
  /* ~40% menos altura que antes (padding y gap escalados a 0.6) */
  --tab-p: 0.21rem;
  --tab-gap: 0.21rem;

  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--tab-gap);
  padding: var(--tab-p);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
}

.auth-tabs__pill {
  position: absolute;
  top: var(--tab-p);
  bottom: var(--tab-p);
  left: var(--tab-p);
  z-index: 0;
  width: calc((100% - 2 * var(--tab-p) - var(--tab-gap)) / 2);
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.07);
  pointer-events: none;
  transition: transform 0.42s cubic-bezier(0.34, 1.2, 0.64, 1);
  will-change: transform;
}

.auth-tabs__pill--register {
  transform: translateX(calc(100% + var(--tab-gap)));
}

.auth-tab {
  position: relative;
  z-index: 1;
  margin: 0;
  text-align: center;
  padding: 0.33rem 0.65rem;
  font-size: 0.8125rem;
  line-height: 1.25;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--apple-text-secondary);
  text-decoration: none;
  border-radius: 999px;
  transition:
    color 0.28s ease,
    font-weight 0.28s ease;
}

.auth-tab:hover {
  color: var(--apple-text);
}

.auth-tab--active {
  color: var(--apple-text);
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .auth-tabs__pill {
    transition-duration: 0.01ms;
  }
}

.auth-card {
  padding: 1.75rem 1.5rem 1.5rem;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    0 12px 28px rgba(0, 0, 0, 0.06);
}

.auth-card--centered {
  text-align: center;
}

.auth-brand {
  display: flex;
  justify-content: center;
  margin-bottom: 1.35rem;
}

.auth-logo {
  height: 44px;
  width: auto;
  max-width: min(220px, 72vw);
  object-fit: contain;
  object-position: center;
}

.auth-title {
  margin: 0 0 0.5rem;
  font-size: clamp(1.35rem, 3vw, 1.6rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: #000000;
}

.auth-title--center {
  text-align: center;
}

.auth-subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.9375rem;
  line-height: 1.45;
  letter-spacing: -0.015em;
  color: #6e6e73;
  text-align: center;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-form--narrow {
  max-width: 100%;
  margin: 0 auto;
  width: 100%;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-align: left;
}

.auth-field--step2 {
  animation: auth-field-in 0.35s cubic-bezier(0.25, 0.1, 0.25, 1) both;
}

@keyframes auth-field-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auth-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.7rem 0.9rem;
  font-size: 1rem;
  font-family: inherit;
  letter-spacing: -0.02em;
  color: var(--apple-text);
  background: #ffffff;
  border: 1px solid #d2d2d7;
  border-radius: 10px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.auth-input::placeholder {
  color: #86868b;
}

.auth-input:focus {
  outline: none;
  border-color: rgba(var(--apple-blue-rgb), 0.55);
  box-shadow: 0 0 0 3px rgba(var(--apple-blue-rgb), 0.15);
}

.auth-error {
  margin: -0.25rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: #b42318;
  text-align: center;
}

.auth-submit {
  margin-top: 0.35rem;
  width: 100%;
  justify-content: center;
}

.auth-submit :deep(.p-button) {
  width: 100%;
  justify-content: center;
  font-weight: 600 !important;
  padding-top: 0.7rem !important;
  padding-bottom: 0.7rem !important;
}

@media (prefers-reduced-motion: reduce) {
  .auth-field--step2 {
    animation: none;
  }
}
</style>
