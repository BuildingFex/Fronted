import { createRouter, createWebHistory } from 'vue-router'
import { MarketingPaths, MarketingRouteNames } from '../../domain/marketingRoutes.js'
import AuthView from '../views/AuthView.vue'
import AppShellView from '../views/AppShellView.vue'
import AppDashboardView from '../views/AppDashboardView.vue'
import AppAdvancedManagementView from '../views/AppAdvancedManagementView.vue'
import AppAddResidentsView from '../views/AppAddResidentsView.vue'
import AppImportView from '../views/AppImportView.vue'
import AppFinanceView from '../views/AppFinanceView.vue'
import AppGenerationView from '../views/AppGenerationView.vue'
import AppIncidentsView from '../views/AppIncidentsView.vue'
import AppInformationView from '../views/AppInformationView.vue'
import AppProjectsView from '../views/AppProjectsView.vue'
import AppSettingsView from '../views/AppSettingsView.vue'
import AppResidentDashboardView from '../views/AppResidentDashboardView.vue'
import AppResidentFinanceView from '../views/AppResidentFinanceView.vue'
import AppResidentPaymentsView from '../views/AppResidentPaymentsView.vue'
import AppResidentServicesView from '../views/AppResidentServicesView.vue'
import AppResidentIncidentsView from '../views/AppResidentIncidentsView.vue'
import AppResidentSupportView from '../views/AppResidentSupportView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: { name: MarketingRouteNames.LOGIN } },
    { path: MarketingPaths.LOGIN, name: MarketingRouteNames.LOGIN, component: AuthView },
    { path: MarketingPaths.REGISTER, name: MarketingRouteNames.REGISTER, component: AuthView },
    {
      path: MarketingPaths.APP,
      component: AppShellView,
      children: [
        { path: '', name: MarketingRouteNames.APP_DASHBOARD, component: AppDashboardView },
        {
          path: 'advanced-management',
          name: MarketingRouteNames.APP_ADVANCED_MANAGEMENT,
          component: AppAdvancedManagementView,
        },
        {
          path: 'add-residents',
          name: MarketingRouteNames.APP_ADD_RESIDENTS,
          component: AppAddResidentsView,
        },
        { path: 'import', name: MarketingRouteNames.APP_IMPORT, component: AppImportView },
        { path: 'finance', name: MarketingRouteNames.APP_FINANCE, component: AppFinanceView },
        { path: 'generation', name: MarketingRouteNames.APP_GENERATION, component: AppGenerationView },
        { path: 'incidents', name: MarketingRouteNames.APP_INCIDENTS, component: AppIncidentsView },
        { path: 'information', name: MarketingRouteNames.APP_INFORMATION, component: AppInformationView },
        { path: 'projects', name: MarketingRouteNames.APP_PROJECTS, component: AppProjectsView },
        { path: 'settings', name: MarketingRouteNames.APP_SETTINGS, component: AppSettingsView },
        {
          path: 'resident/dashboard',
          name: MarketingRouteNames.APP_RESIDENT_DASHBOARD,
          component: AppResidentDashboardView,
        },
        {
          path: 'resident/finance',
          name: MarketingRouteNames.APP_RESIDENT_FINANCE,
          component: AppResidentFinanceView,
        },
        {
          path: 'resident/payments',
          name: MarketingRouteNames.APP_RESIDENT_PAYMENTS,
          component: AppResidentPaymentsView,
        },
        {
          path: 'resident/services',
          name: MarketingRouteNames.APP_RESIDENT_SERVICES,
          component: AppResidentServicesView,
        },
        {
          path: 'resident/incidents',
          name: MarketingRouteNames.APP_RESIDENT_INCIDENTS,
          component: AppResidentIncidentsView,
        },
        {
          path: 'resident/support',
          name: MarketingRouteNames.APP_RESIDENT_SUPPORT,
          component: AppResidentSupportView,
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: MarketingRouteNames.LOGIN } },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})
