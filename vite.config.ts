import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // Served from https://<user>.github.io/attendly/ on GitHub Pages, but from
  // the web root inside the Capacitor/Android bundle. The workflow sets
  // GITHUB_PAGES=true so the native build keeps '/'.
  base: process.env.GITHUB_PAGES === 'true' ? '/attendly/' : '/',
  plugins: [react()],
});
