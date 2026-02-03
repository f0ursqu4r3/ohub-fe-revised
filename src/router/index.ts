import { createRouter, createWebHistory } from 'vue-router'
import { authGuard } from '@auth0/auth0-vue'
import { guestOnlyGuard, subscribedUserGuard, subscriptionGuard } from './guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'map',
      component: () => import('../views/MapView.vue'),
      meta: { layout: 'empty' },
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('../views/AnalyticsView.vue'),
      meta: { layout: 'default' },
    },
    {
      path: '/callback',
      name: 'callback',
      component: () => import('../views/CallbackView.vue'),
      meta: { layout: 'empty' },
    },
    {
      path: '/developers',
      name: 'developers',
      component: () => import('../views/DevelopersView.vue'),
      meta: { layout: 'empty' },
      beforeEnter: guestOnlyGuard,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { layout: 'empty' },
      beforeEnter: guestOnlyGuard,
    },
    {
      path: '/subscribe',
      name: 'subscribe',
      component: () => import('../views/SubscribeView.vue'),
      meta: { layout: 'empty' },
      beforeEnter: [authGuard, subscribedUserGuard],
    },
    {
      path: '/developers/getting-started',
      name: 'getting-started',
      component: () => import('../views/GettingStartedView.vue'),
      meta: { layout: 'developer' },
      beforeEnter: [authGuard, subscriptionGuard],
    },
    {
      path: '/developers/api-keys',
      name: 'api-keys',
      component: () => import('../views/ApiKeysView.vue'),
      meta: { layout: 'developer' },
      beforeEnter: [authGuard, subscriptionGuard],
    },
    {
      path: '/developers/playground',
      name: 'playground',
      component: () => import('../views/PlaygroundView.vue'),
      meta: { layout: 'developer' },
      beforeEnter: [authGuard, subscriptionGuard],
    },
    {
      path: '/developers/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { layout: 'developer' },
      beforeEnter: [authGuard, subscriptionGuard],
    },
    {
      path: '/map/:slug',
      name: 'provider-map',
      component: () => import('../views/MapView.vue'),
      meta: { layout: 'empty' },
    },
    // catch-all route to main page for undefined routes
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'map' },
    },
  ],
})

export default router
