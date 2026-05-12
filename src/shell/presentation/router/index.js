import { createRouter, createWebHistory } from 'vue-router'
import { AppPaths, AppRouteNames } from '@/shell/domain/appRoutes.js'
import AuthView from '@/iam/presentation/views/AuthView.vue'
import AppShellView from '@/shell/presentation/views/AppShellView.vue'
import AppDashboardView from '@/shell/presentation/views/AppDashboardView.vue'
import AppAdvancedManagementView from '@/shell/presentation/views/AppAdvancedManagementView.vue'
import AppImportView from '@/shell/presentation/views/AppImportView.vue'
import AppFinanceView from '@/shell/presentation/views/AppFinanceView.vue'
import AppGenerationView from '@/shell/presentation/views/AppGenerationView.vue'
import AppIncidentsView from '@/shell/presentation/views/AppIncidentsView.vue'
import AppInformationView from '@/shell/presentation/views/AppInformationView.vue'
import AppCollectionsManagementExpensesView from '@/shell/presentation/views/AppCollectionsManagementExpensesView.vue'
import AppTeamView from '@/shell/presentation/views/AppTeamView.vue'
import AppProjectsView from '@/shell/presentation/views/AppProjectsView.vue'
import AppSettingsView from '@/shell/presentation/views/AppSettingsView.vue'
import AppResidentDashboardView from '@/shell/presentation/views/AppResidentDashboardView.vue'
import AppResidentFinanceView from '@/shell/presentation/views/AppResidentFinanceView.vue'
import AppResidentServicesView from '@/shell/presentation/views/AppResidentServicesView.vue'
import AppResidentGenerationView from '@/shell/presentation/views/AppResidentGenerationView.vue'
import AppResidentIncidentsView from '@/shell/presentation/views/AppResidentIncidentsView.vue'
import AppResidentSupportView from '@/shell/presentation/views/AppResidentSupportView.vue'
import GuestInviteView from '@/socialSpaces/presentation/views/GuestInviteView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: { name: AppRouteNames.LOGIN } },
    { path: AppPaths.LOGIN, name: AppRouteNames.LOGIN, component: AuthView },
    { path: AppPaths.REGISTER, name: AppRouteNames.REGISTER, component: AuthView },
    {
      path: AppPaths.GUEST_INVITE,
      name: AppRouteNames.GUEST_INVITE,
      component: GuestInviteView,
    },
    {
      path: AppPaths.APP,
      component: AppShellView,
      children: [
        { path: '', name: AppRouteNames.APP_DASHBOARD, component: AppDashboardView },
        {
          path: 'advanced-management',
          name: AppRouteNames.APP_ADVANCED_MANAGEMENT,
          component: AppAdvancedManagementView,
        },
        { path: 'import', name: AppRouteNames.APP_IMPORT, component: AppImportView },
        { path: 'finance', name: AppRouteNames.APP_FINANCE, component: AppFinanceView },
        { path: 'generation', name: AppRouteNames.APP_GENERATION, component: AppGenerationView },
        { path: 'incidents', name: AppRouteNames.APP_INCIDENTS, component: AppIncidentsView },
        { path: 'information', name: AppRouteNames.APP_INFORMATION, component: AppInformationView },
        {
          path: 'collections-management-expenses',
          name: AppRouteNames.APP_COLLECTIONS_MANAGEMENT_EXPENSES,
          component: AppCollectionsManagementExpensesView,
        },
        { path: 'team', name: AppRouteNames.APP_TEAM, component: AppTeamView },
        { path: 'projects', name: AppRouteNames.APP_PROJECTS, component: AppProjectsView },
        { path: 'settings', name: AppRouteNames.APP_SETTINGS, component: AppSettingsView },
        {
          path: 'resident/dashboard',
          name: AppRouteNames.APP_RESIDENT_DASHBOARD,
          component: AppResidentDashboardView,
        },
        {
          path: 'resident/finance',
          name: AppRouteNames.APP_RESIDENT_FINANCE,
          component: AppResidentFinanceView,
        },
        {
          path: 'resident/services',
          name: AppRouteNames.APP_RESIDENT_SERVICES,
          component: AppResidentServicesView,
        },
        {
          path: 'resident/generation',
          name: AppRouteNames.APP_RESIDENT_GENERATION,
          component: AppResidentGenerationView,
        },
        {
          path: 'resident/incidents',
          name: AppRouteNames.APP_RESIDENT_INCIDENTS,
          component: AppResidentIncidentsView,
        },
        {
          path: 'resident/support',
          name: AppRouteNames.APP_RESIDENT_SUPPORT,
          component: AppResidentSupportView,
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: AppRouteNames.LOGIN } },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})
