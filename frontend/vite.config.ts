import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 所有 /api 开头的请求都代理到后端
      '^/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
