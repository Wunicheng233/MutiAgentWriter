// API 客户端封装
import axios, { AxiosError } from 'axios'
import type { AxiosInstance } from 'axios'

// 开发环境直接请求后端完整地址
// 后端已配置 CORS，允许前端跨域访问
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
})

// 请求拦截器：自动添加 JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    // 创建新的headers对象，确保不会有引用问题
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
  }
  return config
})

// 响应拦截器：统一处理 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // 清除 token 跳转到登录
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
export * from './endpoints'
