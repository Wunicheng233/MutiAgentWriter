// API 客户端封装
import axios, { AxiosError } from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

// 开发环境通过Vite代理转发到后端，避免跨域问题
// 生产环境通过环境变量设置完整URL
const baseURL = import.meta.env.VITE_API_URL || '/api'

const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 120000, // 2分钟，LLM生成需要足够时间
})

// 请求拦截器：自动添加 JWT
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    const authValue = `Bearer ${token}`

    // Check if headers is AxiosHeaders instance (has set method)
    if (typeof config.headers.set === 'function') {
      // Use Axios v1 proper API to set header
      config.headers.set('Authorization', authValue)
    } else {
      // Handle plain object headers
      (config.headers as Record<string, string>).Authorization = authValue
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
