import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

const commit = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch (e) { return 'lokal'; }
})();
const gebaut = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  base: './',
  server: { port: 5174 },
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(gebaut),
  },
  plugins: [
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
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
});
