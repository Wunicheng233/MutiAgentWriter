import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { Button } from '../components/Button'
import { register } from '../utils/endpoints'
import { useToast } from '../components/Toast'

export const Register: React.FC = () => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { mutate, isPending } = useMutation({
    mutationFn: () => register({ username, email, password }),
    onSuccess: () => {
      showToast('注册成功，请登录', 'success')
      navigate('/login')
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || '注册失败'
      showToast(message, 'error')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      showToast('两次密码不一致', 'error')
      return
    }
    mutate()
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <h1 className="text-center text-3xl mb-6">用户注册</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="用户名"
              type="text"
              placeholder="选择一个用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              label="邮箱"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="密码"
              type="password"
              placeholder="设置密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="确认密码"
              type="password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full mt-6"
              disabled={isPending}
            >
              {isPending ? '注册中...' : '注册'}
            </Button>
          </form>
          <div className="mt-6 text-center text-secondary">
            已有账号？ <Link to="/login" className="text-sage hover:underline">去登录</Link>
          </div>
        </Card>
      </div>
    </Layout>
  )
}

export default Register
