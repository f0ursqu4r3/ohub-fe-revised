import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export const useDarkModeStore = defineStore('darkMode', () => {
  // Initialize from localStorage or system preference
  const getInitialMode = (): boolean => {
    const stored = localStorage.getItem('darkMode')
    if (stored !== null) {
      return stored === 'true'
    }
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  const isDark = ref(getInitialMode())

  // Persist to localStorage
  watch(isDark, (value) => {
    localStorage.setItem('darkMode', String(value))
  })

  const toggle = () => {
    isDark.value = !isDark.value
  }

  const setDark = (value: boolean) => {
    isDark.value = value
  }

  return {
    isDark,
    toggle,
    setDark,
  }
})
