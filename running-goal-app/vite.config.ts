import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true'
export default defineConfig({
  base: process.env.VITE_BASE_PATH || (isGitHubPages ? '/running-app/' : '/'),
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: 'Running Plan',
        short_name: 'Running Plan',
        description: 'Goal-based running training plan with interactive workouts.',
        start_url: '.',
        display: 'standalone',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
})
