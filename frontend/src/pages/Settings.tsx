import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { useAuthStore } from '../store/useAuthStore'
import { refreshApiKey, getUserMonthlyTokenStats, updateApiKey } from '../utils/endpoints'
import { useToast } from '../components/Toast'

export const Settings: React.FC = () => {
  const { user, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')

  const { data: monthlyStats } = useQuery({
    queryKey: ['user-monthly-token-stats'],
    queryFn: getUserMonthlyTokenStats,
  })

  const refreshMutation = useMutation({
    mutationFn: refreshApiKey,
    onSuccess: (data) => {
      setUser(data)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      showToast('API Key 已刷新', 'success')
      setLoading(false)
    },
    onError: () => {
      showToast('刷新失败', 'error')
      setLoading(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateApiKey,
    onSuccess: (data) => {
      setUser(data)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      showToast('API Key 已更新', 'success')
      setNewApiKey('')
      setLoading(false)
    },
    onError: () => {
      showToast('更新失败', 'error')
      setLoading(false)
    },
  })

  const handleRefresh = () => {
    setLoading(true)
    refreshMutation.mutate()
  }

  const handleUpdate = () => {
    if (!newApiKey.trim()) {
      showToast('请输入 API Key', 'error')
      return
    }
    setLoading(true)
    updateMutation.mutate(newApiKey.trim())
  }

  const displayApiKey = () => {
    if (!user?.api_key) return '(未设置)'
    if (user.api_key.length <= 8) return user.api_key
    return `${user.api_key.slice(0, 4)}...${user.api_key.slice(-4)}`
  }

  return (
    <Layout>
      <h1 className="text-3xl mb-8 mx-auto max-w-2xl">用户设置</h1>
      <div className="grid gap-6 max-w-2xl mx-auto">
        <Card>
          <h2 className="text-xl mb-4">账户信息</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-secondary">用户名</span>
              <span className="text-body font-medium">{user?.username}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary">邮箱</span>
              <span className="text-body font-medium">{user?.email}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl mb-4">API Key</h2>
          <p className="text-secondary mb-4">
            当前 API Key: <code className="px-2 py-1 bg-white rounded text-body">{displayApiKey()}</code>
          </p>
          <div className="space-y-4">
            <Input
              label="输入你的火山引擎 API Key"
              placeholder="eg. d8b301d3-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
            />
            <Button
              variant="primary"
              onClick={handleUpdate}
              disabled={loading}
            >
              {loading ? '保存中...' : '保存 API Key'}
            </Button>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-secondary mb-4">或者，生成一个随机 API Key：</p>
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? '刷新中...' : '生成新的 API Key'}
            </Button>
          </div>
          <p className="text-muted text-sm mt-3">
            你的 API Key 会保存在数据库中，用于调用 AI 服务生成小说。<br />
            <strong>当前支持</strong>：火山引擎 ARK (https://www.volcengine.com/product/ark)，
            API Key 格式类似 <code>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>
          </p>
        </Card>

        {monthlyStats && monthlyStats.total_tokens > 0 && (
          <Card>
            <h2 className="text-xl mb-4">本月 Token 使用统计 ({monthlyStats.month})</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-secondary">总 Token</span>
                  <span className="text-body font-medium">{monthlyStats.total_tokens.toLocaleString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-secondary">Prompt Tokens</span>
                  <p className="font-medium text-body mt-1">{monthlyStats.total_prompt_tokens.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-secondary">Completion Tokens</span>
                  <p className="font-medium text-body mt-1">{monthlyStats.total_completion_tokens.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-secondary">估算费用</span>
                  <span className="text-body font-medium">${monthlyStats.estimated_cost_usd.toFixed(4)} USD</span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  )
}

export default Settings
