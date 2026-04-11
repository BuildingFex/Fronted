import { createRouter, createWebHistory } from 'vue-router'
import { MarketingPaths, MarketingRouteNames } from '../../domain/marketingRoutes.js'
import LandingView from '../views/LandingView.vue'
import AuthView from '../views/AuthView.vue'
import TermsView from '../views/TermsView.vue'
import PrivacyView from '../views/PrivacyView.vue'
import AppShellView from '../views/AppShellView.vue'
import AppDashboardView from '../views/AppDashboardView.vue'
import AppProjectsView from '../views/AppProjectsView.vue'
import AppSettingsView from '../views/AppSettingsView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: MarketingPaths.HOME, name: MarketingRouteNames.HOME, component: LandingView },
    { path: MarketingPaths.LOGIN, name: MarketingRouteNames.LOGIN, component: AuthView },
    { path: MarketingPaths.REGISTER, name: MarketingRouteNames.REGISTER, component: AuthView },
    {
      path: MarketingPaths.APP,
      component: AppShellView,
      children: [
        { path: '', name: MarketingRouteNames.APP_DASHBOARD, component: AppDashboardView },
        { path: 'projects', name: MarketingRouteNames.APP_PROJECTS, component: AppProjectsView },
        { path: 'settings', name: MarketingRouteNames.APP_SETTINGS, component: AppSettingsView },
      ],
    },
    { path: MarketingPaths.TERMS, name: MarketingRouteNames.TERMS, component: TermsView },
    { path: MarketingPaths.PRIVACY, name: MarketingRouteNames.PRIVACY, component: PrivacyView },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth', top: 80 }
    }
    return { top: 0 }
  },
})
