import React, { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
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
import { getUserMonthlyTokenStats, resetLLMSettings, testLLMSettings, updateLLMSettings } from '../utils/endpoints'
import { useToast } from '../components/toastContext'
import { RewriteMode } from '../utils/selectionAI'
import { getErrorMessage } from '../utils/errorMessage'
import type { User } from '../types/api'

const llmProviderOptions = [
  {
    value: 'system',
    label: '系统默认',
    description: '使用部署环境配置的模型路由',
    baseUrl: '',
  },
  {
    value: 'volcengine',
    label: '火山引擎',
    description: 'OpenAI-compatible 火山方舟接口，模型 ID 填控制台调用示例里的 model 值',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    allowedBaseUrls: [
      'https://ark.cn-beijing.volces.com/api/v3',
      'https://ark.cn-beijing.volces.com/api/coding/v3',
    ],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'OpenAI 官方兼容接口',
    baseUrl: 'https://api.openai.com/v1',
    allowedBaseUrls: ['https://api.openai.com/v1'],
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    description: 'DeepSeek 官方兼容接口',
    baseUrl: 'https://api.deepseek.com',
    allowedBaseUrls: ['https://api.deepseek.com'],
  },
  {
    value: 'qwen',
    label: '通义千问',
    description: 'DashScope 兼容模式接口',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    allowedBaseUrls: ['https://dashscope.aliyuncs.com/compatible-mode/v1'],
  },
  {
    value: 'moonshot',
    label: 'Moonshot',
    description: 'Moonshot AI 兼容接口',
    baseUrl: 'https://api.moonshot.cn/v1',
    allowedBaseUrls: ['https://api.moonshot.cn/v1'],
  },
  {
    value: 'custom',
    label: '自定义兼容接口',
    description: '任意 OpenAI-compatible API',
    baseUrl: '',
  },
]

const rewriteModeOptions = [
  { value: RewriteMode.POLISH, label: '润色' },
  { value: RewriteMode.EXPAND, label: '扩写' },
  { value: RewriteMode.SHORTEN, label: '缩写' },
  { value: RewriteMode.MORE_DRAMATIC, label: '增强戏剧张力' },
]

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

function ModelProviderSettings({
  user,
  setUser,
}: {
  user: User | null
  setUser: (user: User | null) => void
}) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [llmProvider, setLlmProvider] = useState(user?.llm_provider || 'system')
  const [llmBaseUrl, setLlmBaseUrl] = useState(user?.llm_base_url || '')
  const [llmModel, setLlmModel] = useState(user?.llm_model || '')
  const [alert, setAlert] = useState<{ variant: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)

  const clearMutation = useMutation({
    mutationFn: resetLLMSettings,
    onSuccess: (data) => {
      setUser(data)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setNewApiKey('')
      setAlert({ variant: 'success', message: '已恢复系统默认模型配置' })
      setLoading(false)
      setTimeout(() => setAlert(null), 3000)
    },
    onError: () => {
      showToast('清除失败', 'error')
      setLoading(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateLLMSettings,
    onSuccess: (data) => {
      setUser(data)
      queryClient.invalidateQueries({ queryKey: ['me'] })
      setAlert({ variant: 'success', message: '模型供应商设置已更新' })
      setNewApiKey('')
      setLoading(false)
      setTimeout(() => setAlert(null), 3000)
    },
    onError: () => {
      showToast('更新失败', 'error')
      setLoading(false)
    },
  })

  const selectedProvider = llmProviderOptions.find((option) => option.value === llmProvider) || llmProviderOptions[0]
  const showModelRequired = llmProvider !== 'system'
  const normalizedBaseUrl = llmBaseUrl.trim().replace(/\/+$/, '')
  const baseUrlPlaceholder = selectedProvider.baseUrl || 'https://api.example.com/v1'
  const modelPlaceholder = llmProvider === 'system'
    ? '使用系统按 Agent 配置的模型'
    : llmProvider === 'volcengine'
      ? '例如 ep-xxxx 或 doubao-seed-1-6-251015'
      : '例如 deepseek-chat'
  const baseUrlLooksPlaceholder = /(^|\/\/)(api\.)?example\.(com|test)(\/|$)/i.test(normalizedBaseUrl)
  const baseUrlMatchesProvider = selectedProvider.value === 'custom' || !normalizedBaseUrl || !('allowedBaseUrls' in selectedProvider)
    ? true
    : (selectedProvider.allowedBaseUrls || []).some((prefix) => normalizedBaseUrl === prefix || normalizedBaseUrl.startsWith(`${prefix}/`))

  const displayApiKey = () => {
    if (!user?.api_key) return '(未设置)'
    if (user.api_key.length <= 8) return user.api_key
    return `${user.api_key.slice(0, 4)}...${user.api_key.slice(-4)}`
  }

  const handleProviderChange = (provider: string) => {
    const option = llmProviderOptions.find((item) => item.value === provider) || llmProviderOptions[0]
    setLlmProvider(option.value)
    setLlmBaseUrl(option.baseUrl)
    if (option.value === 'system') {
      setLlmModel('')
    }
  }

  const handleClear = () => {
    setLoading(true)
    clearMutation.mutate()
  }

  const validateProviderForm = () => {
    if (llmProvider === 'custom' && !normalizedBaseUrl) {
      showToast('自定义兼容接口必须填写 API Base URL', 'error')
      return false
    }
    if (llmProvider !== 'system' && !llmModel.trim()) {
      showToast('请输入模型 ID', 'error')
      return false
    }
    if (llmProvider !== 'system' && !user?.api_key && !newApiKey.trim()) {
      showToast('请输入该供应商的 API Key', 'error')
      return false
    }
    if (normalizedBaseUrl && baseUrlLooksPlaceholder) {
      showToast('API Base URL 不能使用示例占位符', 'error')
      return false
    }
    if (normalizedBaseUrl && !/^https?:\/\//i.test(normalizedBaseUrl)) {
      showToast('API Base URL 必须以 http:// 或 https:// 开头', 'error')
      return false
    }
    if (!baseUrlMatchesProvider) {
      showToast('API Base URL 与当前供应商不匹配，如需其他地址请选择自定义兼容接口', 'error')
      return false
    }
    return true
  }

  const buildLLMSettingsPayload = () => ({
    provider: llmProvider,
    base_url: normalizedBaseUrl || null,
    model: llmModel.trim() || null,
    ...(newApiKey.trim() ? { api_key: newApiKey.trim() } : {}),
  })

  const handleUpdate = () => {
    if (!validateProviderForm()) return
    setLoading(true)
    updateMutation.mutate(buildLLMSettingsPayload())
  }

  const handleTestConnection = async () => {
    if (!validateProviderForm()) return
    setTestingConnection(true)
    setAlert({ variant: 'info', message: '正在测试模型连接...' })
    try {
      const result = await testLLMSettings(buildLLMSettingsPayload())
      setAlert({
        variant: result.success ? 'success' : 'error',
        message: result.success
          ? `模型连接成功${result.latency_ms ? `，耗时 ${result.latency_ms}ms` : ''}`
          : result.message,
      })
    } catch (error: unknown) {
      setAlert({ variant: 'error', message: getErrorMessage(error, '模型连接测试失败，请检查配置') })
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <div data-tour="settings-api">
      <SettingSection title="模型供应商">
        <div className="space-y-4">
          {alert && <Alert variant={alert.variant}>{alert.message}</Alert>}
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">模型供应商</label>
            <p className="text-xs text-[var(--text-muted)] mt-1 mb-2">
              支持火山、OpenAI、DeepSeek、通义、Moonshot，以及任意 OpenAI-compatible 接口。
            </p>
            <Select value={llmProvider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue>{selectedProvider.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {llmProviderOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-[var(--text-muted)]">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input
            label={llmProvider === 'custom' ? 'API Base URL（必填）' : 'API Base URL（可选）'}
            placeholder={baseUrlPlaceholder}
            value={llmBaseUrl}
            onChange={(e) => setLlmBaseUrl(e.target.value)}
            disabled={llmProvider === 'system'}
            fullWidth
          />
          {llmProvider !== 'system' && (
            <p className="text-xs text-[var(--text-muted)] -mt-2">
              {llmProvider === 'custom'
                ? '自定义兼容接口需要填写完整 Base URL。'
                : `留空使用默认地址：${selectedProvider.baseUrl}`}
            </p>
          )}

          <Input
            label={showModelRequired ? '模型 ID（必填）' : '模型 ID（可选）'}
            placeholder={modelPlaceholder}
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            disabled={llmProvider === 'system'}
            fullWidth
          />
          {llmProvider === 'volcengine' && (
            <p className="text-xs text-[var(--text-muted)] -mt-2">
              火山方舟请打开控制台的调用示例，复制代码里传给 model 的值；自定义推理接入点通常是 Endpoint ID。
            </p>
          )}

          <div className="flex items-center py-3">
            <span className="text-sm text-[var(--text-secondary)] flex-1">当前 Key</span>
            <code className="text-sm font-mono text-[var(--text-body)] w-[120px] text-right">{displayApiKey()}</code>
          </div>
          <Input
            label="API Key"
            placeholder={user?.api_key ? '留空则保留当前 Key' : '请输入该供应商的 API Key'}
            value={newApiKey}
            onChange={(e) => setNewApiKey(e.target.value)}
            disabled={llmProvider === 'system'}
            fullWidth
          />
          <div className="flex gap-3 pt-1">
            <Button variant="primary" size="sm" onClick={handleUpdate} disabled={loading}>
              {loading ? '保存中...' : '保存模型设置'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleTestConnection} disabled={loading || testingConnection}>
              {testingConnection ? '测试中...' : '测试连接'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClear} disabled={loading}>
              {loading ? '恢复中...' : '恢复系统默认'}
            </Button>
          </div>
        </div>
      </SettingSection>
    </div>
  )
}

export const Settings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = (searchParams.get('tab') as SettingsTab) || 'theme'

  const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromUrl)

  const { user, setUser } = useAuthStore(useShallow(state => ({
    user: state.user,
    setUser: state.setUser,
  })))
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
  } = useLayoutStore(useShallow(state => ({
    typewriterMode: state.typewriterMode,
    fadeMode: state.fadeMode,
    focusMode: state.focusMode,
    defaultAIPanelOpen: state.defaultAIPanelOpen,
    autoExpandHeaderInProject: state.autoExpandHeaderInProject,
    defaultRewriteMode: state.defaultRewriteMode,
    toggleTypewriterMode: state.toggleTypewriterMode,
    toggleFadeMode: state.toggleFadeMode,
    toggleFocusMode: state.toggleFocusMode,
    setDefaultAIPanelOpen: state.setDefaultAIPanelOpen,
    setAutoExpandHeaderInProject: state.setAutoExpandHeaderInProject,
    setDefaultRewriteMode: state.setDefaultRewriteMode,
    clearAllLocalState: state.clearAllLocalState,
  })))

  const { showToast } = useToast()
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

  const handleClearLocalState = () => {
    clearAllLocalState()
    setShowClearConfirm(false)
    showToast('本地缓存已清除，请刷新页面', 'success')
  }

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

            <ModelProviderSettings
              key={`${user?.id ?? 'guest'}-${user?.llm_provider ?? 'system'}-${user?.llm_base_url ?? ''}-${user?.llm_model ?? ''}-${user?.api_key ?? ''}`}
              user={user}
              setUser={setUser}
            />
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
