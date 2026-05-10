import { createApp, watch } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import App from '@/shell/presentation/App.vue'
import i18n from '@/shell/infrastructure/i18n'
import router from '@/shell/presentation/router'
import '@/shell/presentation/assets/main.css'
import 'primeicons/primeicons.css'
import { syncDocumentLocale } from '@/shell/application/syncDocumentLocale.js'

const app = createApp(App)

app.use(i18n)
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})
app.use(ToastService)

app.mount('#app')

watch(
  () => i18n.global.locale.value,
  (loc) => {
    syncDocumentLocale(loc)
  },
  { immediate: true },
)
