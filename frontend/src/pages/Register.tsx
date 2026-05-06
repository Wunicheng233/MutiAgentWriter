import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { PublicLayout } from '../components/layout/PublicLayout'
import { Card, Input, Button } from '../components/v2'
import { register } from '../utils/endpoints'
import { useToast } from '../components/toastContext'
import { getErrorMessage } from '../utils/errorMessage'

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
    onError: (error: unknown) => {
      showToast(getErrorMessage(error, '注册失败'), 'error')
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
    <PublicLayout>
      <div className="max-w-lg w-full mx-auto mt-12 px-4">
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
              fullWidth
              className="mt-6"
              loading={isPending}
            >
              注册
            </Button>
          </form>
          <div className="mt-6 text-center text-[var(--text-secondary)]">
            已有账号？ <Link to="/login" className="text-[var(--accent-primary)] hover:underline">去登录</Link>
          </div>
        </Card>
      </div>
    </PublicLayout>
  )
}

export default Register
