import React from 'react'

export type SettingsTab = 'theme' | 'editor' | 'shortcuts' | 'ai' | 'layout' | 'account'

interface SettingsSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

interface TabConfig {
  id: SettingsTab
  label: string
}

const tabs: TabConfig[] = [
  { id: 'theme', label: '外观主题' },
  { id: 'editor', label: '编辑器模式' },
  { id: 'shortcuts', label: '键盘快捷键' },
  { id: 'ai', label: 'AI 偏好' },
  { id: 'layout', label: '布局设置' },
  { id: 'account', label: '账户数据' },
]

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="flex flex-col gap-0.5" data-testid="settings-sidebar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-2 rounded-md text-sm text-left transition-colors ${
            activeTab === tab.id
              ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
          }`}
          data-testid={`settings-tab-${tab.id}`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

export type { SettingsTab }
export default SettingsSidebar
