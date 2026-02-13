import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'

// https://vite.dev/config/
export default defineConfig({
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
        button: {
          slots: {
            base: 'font-semibold transition-all duration-150',
          },
        },
        card: {
          slots: {
            root: 'shadow-sm ring-1 ring-[var(--ui-border)]',
          },
        },
        input: {
          slots: {
            base: 'transition-colors duration-150',
          },
        },
        modal: {
          slots: {
            overlay: 'bg-neutral-950/50',
            content: 'shadow-xl ring-1 ring-[var(--ui-border)]',
          },
        },
        badge: {
          slots: {
            base: 'font-medium',
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
