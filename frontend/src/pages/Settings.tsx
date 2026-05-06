import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Divider, Alert, Switch, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/v2'
import { ThemeSelector } from '../components/ThemeSelector'
import SettingsSidebar from '../components/settings/SettingsSidebar'
import type { SettingsTab } from '../components/settings/SettingsSidebar'
import ShortcutList from '../components/settings/ShortcutList'
import { useAuthStore } from '../store/useAuthStore'
import { useLayoutStore } from '../store/useLayoutStore'
import { clearApiKey, getUserMonthlyTokenStats, updateApiKey } from '../utils/endpoints'
import { useToast } from '../components/toastContext'
import { RewriteMode } from '../utils/selectionAI'

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
    focusMode,
    defaultAIPanelOpen,
    autoExpandHeaderInProject,
    defaultRewriteMode,
    toggleTypewriterMode,
    toggleFadeMode,
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

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  React.useEffect(() => {
    setSearchParams({ tab: activeTab })
  }, [activeTab, setSearchParams])

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

  const SettingItem = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 pr-8">
        <p className="text-sm text-[var(--text-primary)]">{label}</p>
        {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0 w-[120px] flex justify-end">{children}</div>
    </div>
  )

  const SettingSection = ({ title, children }: { title?: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      {title && <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">{title}</h3>}
      {children}
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'theme':
        return (
          <SettingSection>
            <ThemeSelector />
          </SettingSection>
        )

      case 'editor':
        return (
          <SettingSection title="编辑器模式">
            <SettingItem label="Typewriter 模式" description="光标保持在视口 1/3 处，平滑滚动">
              <Switch checked={typewriterMode} onChange={toggleTypewriterMode} />
            </SettingItem>
            <SettingItem label="Fade 模式" description="淡化非当前段落，聚焦当前编辑内容">
              <Switch checked={fadeMode} onChange={toggleFadeMode} />
            </SettingItem>
          </SettingSection>
        )

      case 'shortcuts':
        return <ShortcutList />

      case 'ai':
        return (
          <div className="space-y-8">
            <SettingSection title="AI 偏好">
              <SettingItem label="选区 AI 默认重写模式">
                <div className="w-48">
                  <Select
                    value={defaultRewriteMode}
                    onValueChange={(value) => setDefaultRewriteMode(value as RewriteMode)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模式" />
                    </SelectTrigger>
                    <SelectContent>
                      {rewriteModeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </SettingItem>
            </SettingSection>

            <Divider className="border-[var(--border-subtle)]" />

            <SettingSection title="API Key">
              <div className="flex items-center py-3">
                <span className="text-sm text-[var(--text-secondary)] flex-1">当前 Key</span>
                <code className="text-sm font-mono text-[var(--text-body)] w-[120px] text-right">{displayApiKey()}</code>
              </div>
              <div className="space-y-3 pt-2">
                <Input
                  label="更新火山引擎 API Key"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                />
                <Button variant="primary" size="sm" onClick={handleUpdate} disabled={loading}>
                  {loading ? '保存中...' : '保存'}
                </Button>
              </div>
              <div className="pt-4">
                <Button variant="secondary" size="sm" onClick={handleClear} disabled={loading}>
                  {loading ? '清除中...' : '使用系统默认 Key'}
                </Button>
              </div>
            </SettingSection>
          </div>
        )

      case 'layout':
        return (
          <SettingSection title="布局设置">
            <SettingItem label="Focus 模式" description="隐藏非必要 UI 元素，聚焦写作">
              <Switch checked={focusMode} onChange={toggleFocusMode} />
            </SettingItem>
            <SettingItem label="右侧面板默认打开" description="进入项目时自动打开 AI 面板">
              <Switch checked={defaultAIPanelOpen} onChange={setDefaultAIPanelOpen} />
            </SettingItem>
            <SettingItem label="顶栏自动展开" description="进入项目时自动展开顶部导航栏">
              <Switch checked={autoExpandHeaderInProject} onChange={setAutoExpandHeaderInProject} />
            </SettingItem>
          </SettingSection>
        )

      case 'account':
        return (
          <div className="space-y-8">
            <SettingSection title="账户信息">
              <div className="flex items-center py-3">
                <span className="text-sm text-[var(--text-secondary)] flex-1">用户名</span>
                <span className="text-sm text-[var(--text-body)] w-[120px] text-right">{user?.username}</span>
              </div>
              <div className="flex items-center py-3">
                <span className="text-sm text-[var(--text-secondary)] flex-1">邮箱</span>
                <span className="text-sm text-[var(--text-body)] w-[120px] text-right">{user?.email}</span>
              </div>
            </SettingSection>

            {monthlyStats && monthlyStats.total_tokens > 0 && (
              <>
                <Divider className="border-[var(--border-subtle)]" />
                <SettingSection title={`本月使用统计 (${monthlyStats.month})`}>
                  <div className="flex items-center py-3">
                    <span className="text-sm text-[var(--text-secondary)] flex-1">总 Token</span>
                    <span className="text-sm text-[var(--text-body)] font-mono w-[120px] text-right">{monthlyStats.total_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center py-3">
                    <span className="text-sm text-[var(--text-secondary)] flex-1">Prompt</span>
                    <span className="text-sm text-[var(--text-body)] font-mono w-[120px] text-right">{monthlyStats.total_prompt_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center py-3">
                    <span className="text-sm text-[var(--text-secondary)] flex-1">Completion</span>
                    <span className="text-sm text-[var(--text-body)] font-mono w-[120px] text-right">{monthlyStats.total_completion_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center py-3">
                    <span className="text-sm text-[var(--text-secondary)] flex-1">估算费用</span>
                    <span className="text-sm text-[var(--text-body)] font-mono w-[120px] text-right">${monthlyStats.estimated_cost_usd.toFixed(4)}</span>
                  </div>
                </SettingSection>
              </>
            )}

            <Divider className="border-[var(--border-subtle)]" />

            <SettingSection title="数据管理">
              <div className="space-y-3">
                <Button variant="secondary" size="sm" onClick={() => setShowClearConfirm(true)}>
                  清除本地缓存
                </Button>
                <p className="text-xs text-[var(--text-muted)]">
                  清除所有本地保存的设置和状态，恢复为默认值
                </p>
              </div>
            </SettingSection>

            {showClearConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-[var(--bg-primary)] rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                  <h3 className="text-base font-medium text-[var(--text-primary)] mb-2">确认清除本地缓存</h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-6">
                    此操作将清除所有本地保存的设置和状态，包括主题偏好、模式设置等。操作不可撤销。
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => setShowClearConfirm(false)}>
                      取消
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleClearLocalState} className="bg-red-500 hover:bg-red-600">
                      确认清除
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="w-[700px] mx-auto">
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-medium text-[var(--text-primary)] mb-8">设置</h1>

        {alert && (
          <Alert variant={alert.variant} className="mb-6">
            {alert.message}
          </Alert>
        )}

        <div className="flex">
          <div className="w-40 flex-shrink-0 mr-16">
            <SettingsSidebar activeTab={activeTab} onTabChange={handleTabChange} />
          </div>

          <div className="w-[488px] flex-shrink-0 h-[550px] overflow-y-auto overflow-x-hidden">
            {renderTabContent()}
          </div>
        </div>
    </div>
  )
}

export default Settings
