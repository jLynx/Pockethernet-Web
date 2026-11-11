import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function getBuildRevision(): { hash: string; modified: boolean } {
  const cwd = fileURLToPath(new URL('.', import.meta.url));
  try {
    const options = { cwd, encoding: 'utf8' as const, stdio: 'pipe' as const };
    const hash = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
    const modified =
      execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], options).trim() !==
      '';
    return { hash, modified };
  } catch {
    const hash = [
      process.env.WORKERS_CI_COMMIT_SHA,
      process.env.CF_PAGES_COMMIT_SHA,
      process.env.GITHUB_SHA,
    ].find((value) => value && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value));
    return { hash: hash ?? '', modified: false };
  }
}

const buildRevision = getBuildRevision();

export default defineConfig({
  define: {
    __APP_GIT_HASH__: JSON.stringify(buildRevision.hash),
    __APP_GIT_MODIFIED__: JSON.stringify(buildRevision.modified),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['logo-192.png', 'logo-512.png', 'notification-events.js'],
      manifest: {
        name: 'Pocketweb for Pockethernet',
        short_name: 'Pocketweb',
        description: 'Control and run tests with a Pockethernet network analyzer.',
        theme_color: '#246fc5',
        background_color: '#f4f6f8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/logo-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        skipWaiting: false,
        clientsClaim: true,
        importScripts: ['/notification-events.js'],
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        manifestTransforms: [
          async (manifestEntries) => ({
            manifest: manifestEntries.map((entry) =>
              entry.url === 'assets/logo.png'
                ? {
                    ...entry,
                    revision: createHash('sha256')
                      .update(readFileSync(new URL('./src/assets/logo.png', import.meta.url)))
                      .digest('hex'),
                  }
                : entry,
            ),
          }),
        ],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        assetFileNames: (asset) =>
          asset.name === 'logo.png' ? 'assets/logo.png' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    watch: {
      ignored: [
        '**/android-reference/**',
        '**/dist/**',
        '**/storybook-static/**',
        '**/.wrangler/**',
        '**/public/logo-*.png',
      ],
    },
    proxy: {
      '/api/ota-files': { target: 'http://127.0.0.1:8787' },
      '/f/': { target: 'http://127.0.0.1:8787' },
      '/api/latest-version': {
        target: 'https://ota.pockethernet.com',
        changeOrigin: true,
        rewrite: () => '/latest_version',
      },
    },
  },
});
