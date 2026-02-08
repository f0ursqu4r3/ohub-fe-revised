import { createRouter, createWebHistory } from 'vue-router'
import { authGuard } from '@auth0/auth0-vue'
import { guestOnlyGuard, providerGuard, subscribedUserGuard, subscriptionGuard } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'map',
      component: () => import('../views/map/MapView.vue'),
      meta: { layout: 'empty' },
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('../views/map/AnalyticsView.vue'),
      meta: { layout: 'default' },
    },
    {
      path: '/callback',
      name: 'callback',
      component: () => import('../views/auth/CallbackView.vue'),
      meta: { layout: 'empty' },
      beforeEnter: (to) => {
        // Store error in sessionStorage before Auth0 SDK can clear the URL
        if (to.query.error) {
          sessionStorage.setItem('auth_error', to.query.error as string)
          sessionStorage.setItem(
            'auth_error_description',
            (to.query.error_description as string) || '',
          )
        }
        console.log('Callback beforeEnter:', to.fullPath, to.query)
        return true
      },
    },
    {
      path: '/developers',
      name: 'developers',
      component: () => import('../views/developers/DevelopersView.vue'),
      meta: { layout: 'empty' },
      beforeEnter: guestOnlyGuard,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { layout: 'empty' },
      beforeEnter: guestOnlyGuard,
    },
    {
      path: '/subscribe',
      name: 'subscribe',
      component: () => import('../views/auth/SubscribeView.vue'),
      meta: { layout: 'empty' },
      beforeEnter: [authGuard, subscribedUserGuard],
    },
    {
      path: '/developers/getting-started',
      name: 'getting-started',
      component: () => import('../views/developers/GettingStartedView.vue'),
      meta: { layout: 'developer' },
      beforeEnter: [authGuard, subscriptionGuard],
    },
    {
      path: '/developers/api-keys',
      name: 'api-keys',
      component: () => import('../views/developers/ApiKeysView.vue'),
      meta: { layout: 'developer' },
      beforeEnter: [authGuard, subscriptionGuard],
    },
    {
      path: '/developers/playground',
      name: 'playground',
      component: () => import('../views/developers/PlaygroundView.vue'),
      meta: { layout: 'developer' },
      beforeEnter: [authGuard, subscriptionGuard],
    },
    {
      path: '/developers/profile',
      name: 'profile',
      component: () => import('../views/developers/ProfileView.vue'),
      meta: { layout: 'developer' },
      beforeEnter: [authGuard, subscriptionGuard],
    },
    {
      path: '/map/:slug',
      name: 'provider-map',
      component: () => import('../views/map/MapView.vue'),
      meta: { layout: 'empty' },
    },
    {
      path: '/embed/:slug',
      name: 'embed-map',
      component: () => import('../views/map/EmbedMapView.vue'),
      meta: { layout: 'empty' },
    },
    {
      path: '/provider',
      name: 'provider-portal',
      component: () => import('../views/provider/ProviderOutagesView.vue'),
      meta: { layout: 'provider' },
      beforeEnter: [authGuard, providerGuard],
    },
    // catch-all route to main page for undefined routes
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'map' },
    },
  ],
})

export default router
