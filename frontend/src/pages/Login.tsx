import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { useAuthStore } from '../store/useAuthStore'
import { login } from '../utils/endpoints'
import { useToast } from '../components/toastContext'
import { getErrorMessage } from '../utils/errorMessage'

export const Login: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { setUser } = useAuthStore()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { mutate, isPending } = useMutation({
    mutationFn: () => login({ username, password }),
    onSuccess: (data) => {
      setUser(data.user)
      showToast('登录成功', 'success')
      navigate('/')
    },
    onError: (error: unknown) => {
      showToast(getErrorMessage(error, '登录失败'), 'error')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    mutate()
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <h1 className="text-center text-3xl mb-6">用户登录</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="用户名"
              type="text"
              placeholder="输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              label="密码"
              type="password"
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full mt-6"
              disabled={isPending}
            >
              {isPending ? '登录中...' : '登录'}
            </Button>
          </form>
          <div className="mt-6 text-center text-secondary">
            还没有账号？ <Link to="/register" className="text-sage hover:underline">去注册</Link>
          </div>
        </Card>
      </div>
    </Layout>
  )
}

export default Login
