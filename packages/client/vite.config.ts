import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA as pwa } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    pwa({
      manifest: {
        background_color: '#ffffff',
        display: 'standalone',
        name: 'kupi',
        short_name: 'kupi',
        start_url: '/',
        theme_color: '#ffffff',
      },
      registerType: 'autoUpdate',
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    allowedHosts: ['gummier-hypervigilantly-evelin.ngrok-free.dev'],
    proxy: {
      '^/api': {
        changeOrigin: true,
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
      },
    },
  },
});
