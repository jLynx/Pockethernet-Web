import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pockethernet-192.png', 'pockethernet-512.png'],
      manifest: {
        name: 'Pockethernet Web',
        short_name: 'Pockethernet',
        description: 'Control and run tests with a Pockethernet network analyzer.',
        theme_color: '#246fc5',
        background_color: '#f4f6f8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pockethernet-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pockethernet-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: {
      ignored: [
        '**/android-reference/**',
        '**/dist/**',
        '**/storybook-static/**',
        '**/.wrangler/**',
        '**/public/pockethernet-*.png',
      ],
    },
    proxy: {
      '/api/latest-version': {
        target: 'https://ota.pockethernet.com',
        changeOrigin: true,
        rewrite: () => '/latest_version',
      },
    },
  },
});
