import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('@tiptap')) {
            return 'editor-vendor'
          }

          if (id.includes('zrender')) {
            return 'charts-runtime'
          }

          if (id.includes('echarts')) {
            return 'charts-vendor'
          }

          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor'
          }

          if (
            id.includes('react') ||
            id.includes('react-dom') ||
            id.includes('react-router-dom') ||
            id.includes('scheduler')
          ) {
            return 'react-vendor'
          }

          return undefined
        },
      },
    },
  },
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
