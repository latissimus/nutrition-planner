import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

const commit = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch (e) { return 'lokal'; }
})();
const gebaut = new Date().toISOString().slice(0, 16).replace('T', ' ');

const devServiceWorkerCleanup = {
  name: 'dev-service-worker-cleanup',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (!request.url?.split('?')[0].endsWith('/sw.js')) return next();
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(`
        self.addEventListener('install', () => self.skipWaiting());
        self.addEventListener('activate', (event) => event.waitUntil((async () => {
          const names = await caches.keys();
          await Promise.all(names.filter((name) => name.startsWith('workbox-precache')).map((name) => caches.delete(name)));
          await self.clients.claim();
          const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          await self.registration.unregister();
          await Promise.all(windows.map((client) => client.navigate(client.url)));
        })()));
      `);
    });
  },
};

export default defineConfig({
  base: './',
  server: { port: 5174 },
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(gebaut),
  },
  plugins: [
    devServiceWorkerCleanup,
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        // Private Supabase-Antworten werden nie vom Worker gecacht.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,woff,woff2}'],
      },
      // Ein Service Worker im Entwicklungsmodus hält auf iOS alte CSS-Dateien
      // fest, während lazy geladene Dex-Module bereits aus dem neuen Build
      // kommen. Das erzeugt nicht reproduzierbare Mischstände im Layout.
      devOptions: { enabled: false },
    }),
  ],
});
