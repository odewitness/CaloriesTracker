import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'NutriTrack',
        short_name: 'NutriTrack',
        description: 'Suivi nutritionnel quotidien — calories, macros, vitamines et minéraux',
        theme_color: '#1D9E75',
        background_color: '#F7F6F4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Pré-cache les assets buildés (JS/CSS/HTML/icônes) pour un chargement
        // quasi instantané et un minimum de résilience hors-ligne. Les appels
        // Supabase / Open Food Facts restent réseau (pas de cache API ici).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Injecte les écouteurs push/notificationclick (public/push-sw.js)
        // dans le service worker généré, sans passer en stratégie
        // injectManifest juste pour ces deux écouteurs.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})