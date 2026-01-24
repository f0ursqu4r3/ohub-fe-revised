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

  const fetchCustomer = async () => {
    if (!isAuthenticated.value) return

    isLoadingCustomer.value = true
    try {
      const token = await auth0.getAccessTokenSilently()
      const response = await fetch(`${import.meta.env.VITE_BASE_API_URL}/v1/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      customer.value = await response.json()
    } finally {
      isLoadingCustomer.value = false
    }
  }

  const login = () =>
    auth0.loginWithRedirect({
      appState: { target: '/developers/api-keys' },
    })

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
    fetchCustomer,
    login,
    logout,
    getAccessToken,
  }
})
