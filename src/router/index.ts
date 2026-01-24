import { createRouter, createWebHistory } from 'vue-router'
import { authGuard } from '@auth0/auth0-vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/callback',
      name: 'callback',
      component: () => import('../views/CallbackView.vue'),
    },
    {
      path: '/developers',
      name: 'developers',
      component: () => import('../views/DevelopersView.vue'),
    },
    {
      path: '/developers/api-keys',
      name: 'api-keys',
      component: () => import('../views/ApiKeysView.vue'),
      beforeEnter: authGuard,
    },
    {
      path: '/developers/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      beforeEnter: authGuard,
    },
    // catch-all route to main page for undefined routes
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
})

export default router
