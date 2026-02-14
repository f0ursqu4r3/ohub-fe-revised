import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuth0 } from '@auth0/auth0-vue'
import type { User, Customer } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const auth0 = useAuth0()
  const customer = ref<Customer | null>(null)
  const isLoadingCustomer = ref(false)

  const isAuthenticated = computed(() => auth0.isAuthenticated.value)
  const user = computed(() => auth0.user.value as User | undefined)
  const isLoading = computed(() => auth0.isLoading.value || isLoadingCustomer.value)
  const isAdmin = computed(() => customer.value?.isAdmin === true)

  const fetchCustomer = async () => {
    if (!isAuthenticated.value) return

    isLoadingCustomer.value = true
    try {
      const token = await auth0.getAccessTokenSilently()
      const response = await fetch(`${import.meta.env.VITE_BASE_API_URL}/v1/customers/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      customer.value = await response.json()
    } finally {
      isLoadingCustomer.value = false
    }
  }

  const login = (returnTo = '/subscribe') => {
    localStorage.setItem('auth_redirect', returnTo)
    return auth0.loginWithRedirect()
  }

  const signup = (returnTo = '/subscribe') => {
    localStorage.setItem('auth_redirect', returnTo)
    return auth0.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup',
      },
    })
  }

  const logout = () => {
    customer.value = null
    auth0.logout({ logoutParams: { returnTo: window.location.origin } })
  }

  const getAccessToken = () => auth0.getAccessTokenSilently()

  return {
    customer,
    isAuthenticated,
    user,
    isLoading,
    isAdmin,
    fetchCustomer,
    login,
    signup,
    logout,
    getAccessToken,
  }
})
