import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    build: { target: 'es2022' },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: env.DEV_API_TARGET || 'http://localhost:8080', changeOrigin: true },
      },
    },
  }
})
