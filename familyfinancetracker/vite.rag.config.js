import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  envDir: false, // Never load family environment files.
  publicDir: false,
  plugins: [react()], // No PWA/service worker in this separate demo.
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 5174, strictPort: true },
  build: { outDir: 'rag-demo-dist', emptyOutDir: false,
    rollupOptions: { input: fileURLToPath(new URL('./rag-demo.html', import.meta.url)) } },
})
