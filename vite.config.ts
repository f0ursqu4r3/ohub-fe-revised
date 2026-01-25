import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'

// https://vite.dev/config/
export default defineConfig({
  css: {
    lightningcss: {
      errorRecovery: true,
    },
  },
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    ui({
      ui: {
        colors: {
          primary: 'primary',
          secondary: 'secondary',
          neutral: 'neutral',
        },
        card: {
          slots: {
            root: 'shadow-sm',
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    allowedHosts: ['.ngrok-free.dev', '.ohub.io', '.ohub.test'],
    watch: {
      ignored: ['**/ref/**'],
    },
    proxy: {
      '/api': {
        target: 'https://api.canadianpoweroutages.ca',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
