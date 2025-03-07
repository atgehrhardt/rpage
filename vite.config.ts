import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';

export default defineConfig({
  plugins: [
    svelte({
      // Enable TypeScript preprocessing
      preprocess: sveltePreprocess({
        typescript: true
      })
    })
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    exclude: ['playwright', 'playwright-core']
  },
  build: {
    rollupOptions: {
      external: ['playwright', 'playwright-core', 'chromium-bidi', 'fs']
    }
  },
  resolve: {
    alias: {
      fs: 'browserify-fs'
    }
  },
  // Configure static file handling
  publicDir: 'public'
});