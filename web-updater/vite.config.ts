import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  build: { license: { fileName: 'third-party-licenses.md' } },
  server: {
    port: 5174,
    fs: {
      allow: [
        root,
        fileURLToPath(new URL('../src/protocol', import.meta.url)),
        fileURLToPath(new URL('../node_modules', import.meta.url)),
      ],
    },
    proxy: {
      '^/firmware/(manifest\\.json|images/[A-Za-z0-9][A-Za-z0-9_.-]*\\.bin)(\\?.*)?$': {
        target: 'https://pockethernet.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/firmware\//, '/update/'),
      },
    },
  },
  preview: { port: 4174 },
});
