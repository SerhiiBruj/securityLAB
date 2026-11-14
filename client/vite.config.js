import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// У dev-режимі /api проксується на Express, тож браузер працює з одним origin (cookie без CORS)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
