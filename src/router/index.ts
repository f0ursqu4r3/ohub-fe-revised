import { createRouter, createWebHistory } from 'vue-router'
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { authGuard } from '@auth0/auth0-vue'

// Guard to redirect authenticated users away from /developers
const guestOnlyGuard = async (
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  // Dynamically import the auth store
  const { useAuthStore } = await import('@/stores/auth')
  const authStore = useAuthStore()

  // Wait for auth to be ready
  while (authStore.isLoading) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  if (authStore.isAuthenticated) {
    next({ name: 'api-keys' })
  } else {
    next()
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { layout: 'default' },
    },
    {
      path: '/callback',
      name: 'callback',
      component: () => import('../views/CallbackView.vue'),
      meta: { layout: 'default' },
    },
    {
      path: '/developers',
      name: 'developers',
      component: () => import('../views/DevelopersView.vue'),
      meta: { layout: 'default' },
      beforeEnter: guestOnlyGuard,
    },
    {
      path: '/developers/api-keys',
      name: 'api-keys',
      component: () => import('../views/ApiKeysView.vue'),
      meta: { layout: 'developer' },
      beforeEnter: authGuard,
    },
    {
      path: '/developers/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { layout: 'developer' },
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
