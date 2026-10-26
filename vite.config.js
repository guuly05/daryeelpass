import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['daryeel-mark.svg'],
      manifest: {
        name: 'DaryeelPass',
        short_name: 'Daryeel',
        description: 'Maamul booqashooyinka caafimaadkaaga.',
        theme_color: '#f7f5eb',
        background_color: '#f7f5eb',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/daryeel-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/',
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: []
      }
    })
  ]
});
