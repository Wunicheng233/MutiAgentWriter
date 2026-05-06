import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Button, Input, Divider, Alert, Switch, Select } from '../components/v2'
import { ThemeSelector } from '../components/ThemeSelector'
import { CanvasContainer } from '../components/layout/CanvasContainer'
import SettingsSidebar, { SettingsTab } from '../components/settings/SettingsSidebar'
import ShortcutList from '../components/settings/ShortcutList'
import { useAuthStore } from '../store/useAuthStore'
import { useLayoutStore } from '../store/useLayoutStore'
import { clearApiKey, getUserMonthlyTokenStats, updateApiKey } from '../utils/endpoints'
import { useToast } from '../components/toastContext'
import { RewriteMode } from '../utils/selectionAI'

const tabTitles: Record<SettingsTab, string> = {
  theme: '外观主题',
  editor: '编辑器模式',
  shortcuts: '键盘快捷键',
  ai: 'AI 助手偏好',
  layout: '布局设置',
  account: '账户与数据',
}

const rewriteModeOptions = [
  { value: RewriteMode.POLISH, label: '润色' },
  { value: RewriteMode.EXPAND, label: '扩写' },
  { value: RewriteMode.SHORTEN, label: '缩写' },
  { value: RewriteMode.MORE_DRAMATIC, label: '增强戏剧张力' },
]

export const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = (searchParams.get('tab') as SettingsTab) || 'theme'

  const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromUrl)

  const { user, setUser } = useAuthStore()
  const {
    typewriterMode,
    fadeMode,
    vimMode,
    focusMode,
    defaultAIPanelOpen,
    autoExpandHeaderInProject,
    defaultRewriteMode,
    toggleTypewriterMode,
    toggleFadeMode,
    toggleVimMode,
    toggleFocusMode,
    setDefaultAIPanelOpen,
    setAutoExpandHeaderInProject,
    setDefaultRewriteMode,
    clearAllLocalState,
  } = useLayoutStore()

  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [alert, setAlert] = useState<{ variant: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const { data: monthlyStats } = useQuery({
    queryKey: ['user-monthly-token-stats'],
    queryFn: getUserMonthlyTokenStats,
  })

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab })
  }, [activeTab, setSearchParams])

  // Handle tab from URL changes
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  const clearMutation = useMutation({
    mutationFn: clearApiKey,
    onSuccess: (data) => {
      setUser(data)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setAlert({ variant: 'success', message: '已切换为系统默认 API Key' })
      setLoading(false)
      setTimeout(() => setAlert(null), 3000)
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
      setAlert({ variant: 'success', message: 'API Key 已更新' })
      setNewApiKey('')
      setLoading(false)
      setTimeout(() => setAlert(null), 3000)
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

  const handleClearLocalState = () => {
    clearAllLocalState()
    setShowClearConfirm(false)
    showToast('本地缓存已清除，请刷新页面', 'success')
  }

  const displayApiKey = () => {
    if (!user?.api_key) return '(未设置)'
    if (user.api_key.length <= 8) return user.api_key
    return `${user.api_key.slice(0, 4)}...${user.api_key.slice(-4)}`
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'theme':
        return <ThemeSelector />

      case 'editor':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">Typewriter 模式</p>
                <p className="text-sm text-[var(--text-muted)]">光标保持在视口 1/3 处，平滑滚动</p>
              </div>
              <Switch checked={typewriterMode} onChange={toggleTypewriterMode} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">Fade 模式</p>
                <p className="text-sm text-[var(--text-muted)]">淡化非当前段落，聚焦当前编辑内容</p>
              </div>
              <Switch checked={fadeMode} onChange={toggleFadeMode} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">Vim 模式</p>
                <p className="text-sm text-[var(--text-muted)]">启用 Vim 键绑定，需刷新页面生效</p>
              </div>
              <Switch checked={vimMode} onChange={toggleVimMode} />
            </div>
          </div>
        )

      case 'shortcuts':
        return <ShortcutList />

      case 'ai':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-[var(--text-primary)] font-medium mb-2">
                选区 AI 默认重写模式
              </label>
              <Select
                value={defaultRewriteMode}
                onChange={(e) => setDefaultRewriteMode(e.target.value as RewriteMode)}
                options={rewriteModeOptions}
                className="w-full"
              />
            </div>

            <Divider />

            <div>
              <h3 className="text-lg font-medium mb-4 text-[var(--text-primary)]">API Key 设置</h3>

              <div className="flex justify-between items-center py-2 mb-4">
                <span className="text-[var(--text-secondary)]">当前 Key</span>
                <code className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-[var(--text-body)] text-sm">
                  {displayApiKey()}
                </code>
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

              <Divider className="my-6" />
              <div>
                <Button
                  variant="secondary"
                  onClick={handleClear}
                  disabled={loading}
                >
                  {loading ? '清除中...' : '使用系统默认 Key'}
                </Button>
              </div>
            </div>
          </div>
        )

      case 'layout':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">Focus 模式</p>
                <p className="text-sm text-[var(--text-muted)]">隐藏非必要 UI 元素，聚焦写作</p>
              </div>
              <Switch checked={focusMode} onChange={toggleFocusMode} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">右侧面板默认打开</p>
                <p className="text-sm text-[var(--text-muted)]">进入项目时自动打开 AI 面板</p>
              </div>
              <Switch checked={defaultAIPanelOpen} onChange={setDefaultAIPanelOpen} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-[var(--text-primary)] font-medium">顶栏自动展开</p>
                <p className="text-sm text-[var(--text-muted)]">进入项目时自动展开顶部导航栏</p>
              </div>
              <Switch checked={autoExpandHeaderInProject} onChange={setAutoExpandHeaderInProject} />
            </div>
          </div>
        )

      case 'account':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-[var(--text-primary)]">账户信息</h3>
              <div className="flex justify-between items-center py-2">
                <span className="text-[var(--text-secondary)]">用户名</span>
                <span className="text-[var(--text-body)] font-medium">{user?.username}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[var(--text-secondary)]">邮箱</span>
                <span className="text-[var(--text-body)] font-medium">{user?.email}</span>
              </div>
            </div>

            {monthlyStats && monthlyStats.total_tokens > 0 && (
              <>
                <Divider />
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">
                    本月使用统计 ({monthlyStats.month})
                  </h3>
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
              </>
            )}

            <Divider />

            <div className="space-y-3">
              <h3 className="text-lg font-medium text-[var(--text-primary)]">数据管理</h3>
              <Button
                variant="secondary"
                onClick={() => setShowClearConfirm(true)}
              >
                清除本地缓存
              </Button>
              <p className="text-sm text-[var(--text-muted)]">
                清除所有本地保存的设置和状态，恢复为默认值
              </p>
            </div>

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="max-w-md w-full mx-4">
                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">
                    确认清除本地缓存
                  </h3>
                  <p className="text-[var(--text-secondary)] mb-6">
                    此操作将清除所有本地保存的设置和状态，包括主题偏好、模式设置等。操作不可撤销。
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setShowClearConfirm(false)}
                    >
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleClearLocalState}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      确认清除
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <CanvasContainer maxWidth={900}>
      <h1 className="text-3xl font-medium text-[var(--text-primary)] mb-8">设置</h1>

      {alert && (
        <Alert variant={alert.variant} className="mb-6">
          {alert.message}
        </Alert>
      )}

      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-medium text-[var(--text-primary)] mb-6">
            {tabTitles[activeTab]}
          </h2>
          <Card>
            {renderTabContent()}
          </Card>
        </div>
      </div>
    </CanvasContainer>
  )
}

export default Settings
