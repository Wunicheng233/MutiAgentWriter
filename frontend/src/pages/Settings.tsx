import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Button, Input, Checkbox } from '../components/v2'
import { ThemeSelector } from '../components/ThemeSelector'
import { CanvasContainer } from '../components/layout/CanvasContainer'
import { useAuthStore } from '../store/useAuthStore'
import { useLayoutStore } from '../store/useLayoutStore'
import { clearApiKey, getUserMonthlyTokenStats, updateApiKey } from '../utils/endpoints'
import { useToast } from '../components/toastContext'

export const Settings: React.FC = () => {
  const { user, setUser } = useAuthStore()
  const { autoExpandHeaderInProject, setAutoExpandHeaderInProject } = useLayoutStore()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')

  const { data: monthlyStats } = useQuery({
    queryKey: ['user-monthly-token-stats'],
    queryFn: getUserMonthlyTokenStats,
  })

  const clearMutation = useMutation({
    mutationFn: clearApiKey,
    onSuccess: (data) => {
      setUser(data)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      showToast('已切换为系统默认 API Key', 'success')
      setLoading(false)
    },
    onError: () => {
      showToast('清除失败', 'error')
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

  const handleClear = () => {
    setLoading(true)
    clearMutation.mutate()
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
    <CanvasContainer maxWidth={600}>
      <h1 className="text-3xl font-medium text-[var(--text-primary)] mb-8">设置</h1>

      <div className="grid gap-6">
        <Card>
          <ThemeSelector />
        </Card>

        <Card>
          <h2 className="text-lg font-medium mb-4 text-[var(--text-primary)]">布局偏好</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={autoExpandHeaderInProject}
                onChange={setAutoExpandHeaderInProject}
              />
              <span className="text-[var(--text-body)]">进入项目时自动展开顶栏</span>
            </label>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-medium mb-4 text-[var(--text-primary)]">账户信息</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-[var(--text-secondary)]">用户名</span>
              <span className="text-[var(--text-body)] font-medium">{user?.username}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-[var(--text-secondary)]">邮箱</span>
              <span className="text-[var(--text-body)] font-medium">{user?.email}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-medium mb-4 text-[var(--text-primary)]">API Key</h2>

          <div className="flex justify-between items-center py-2 mb-4">
            <span className="text-[var(--text-secondary)]">当前 Key</span>
            <code className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-[var(--text-body)] text-sm">{displayApiKey()}</code>
          </div>

          <div className="space-y-4">
            <Input
              label="火山引擎 API Key"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
            />
            <Button
              variant="primary"
              onClick={handleUpdate}
              disabled={loading}
            >
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--border-default)]">
            <Button
              variant="secondary"
              onClick={handleClear}
              disabled={loading}
            >
              {loading ? '清除中...' : '使用系统默认 Key'}
            </Button>
          </div>
        </Card>

        {monthlyStats && monthlyStats.total_tokens > 0 && (
          <Card>
            <h2 className="text-lg font-medium mb-4 text-[var(--text-primary)]">本月使用统计 ({monthlyStats.month})</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-[var(--text-secondary)]">总 Token</span>
                <span className="text-[var(--text-body)] font-medium">{monthlyStats.total_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[var(--text-secondary)]">Prompt</span>
                <span className="text-[var(--text-body)] font-medium">{monthlyStats.total_prompt_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[var(--text-secondary)]">Completion</span>
                <span className="text-[var(--text-body)] font-medium">{monthlyStats.total_completion_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[var(--text-secondary)]">估算费用</span>
                <span className="text-[var(--text-body)] font-medium">${monthlyStats.estimated_cost_usd.toFixed(4)}</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </CanvasContainer>
  )
}

export default Settings
