import React from 'react'

export type SettingsTab = 'theme' | 'editor' | 'shortcuts' | 'ai' | 'layout' | 'account'

interface SettingsSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

interface TabConfig {
  id: SettingsTab
  label: string
  icon: string
}

const tabs: TabConfig[] = [
  { id: 'theme', label: '外观主题', icon: '🎨' },
  { id: 'editor', label: '编辑器模式', icon: '⌨️' },
  { id: 'shortcuts', label: '键盘快捷键', icon: '🎯' },
  { id: 'ai', label: 'AI 偏好', icon: '🤖' },
  { id: 'layout', label: '布局设置', icon: '🖼️' },
  { id: 'account', label: '账户数据', icon: '👤' },
]

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex flex-col gap-1" data-testid="settings-sidebar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
            activeTab === tab.id
              ? 'bg-[var(--accent-primary)] text-white'
              : 'text-[var(--text-body)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
          }`}
          data-testid={`settings-tab-${tab.id}`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span className="font-medium">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

export type { SettingsTab }
export default SettingsSidebar
