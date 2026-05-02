import React from 'react';
import { useReaderStore } from '../stores/readerStore';
import { useReaderSettings, fontSizeMap, lineHeightMap, marginMap } from '../hooks/useReaderSettings';
import type { ReaderTheme, ReaderFont, ReaderDisplayMode } from '../types';
import { Button, Card } from '../../../components/v2';

const themeOptions: { value: ReaderTheme; label: string; bg: string; text: string }[] = [
  { value: 'parchment', label: '羊皮纸', bg: '#faf7f2', text: '#3a2c1f' },
  { value: 'white', label: '纯白', bg: '#ffffff', text: '#333333' },
  { value: 'dark', label: '深色', bg: '#1a1a1a', text: '#e0e0e0' },
  { value: 'green', label: '灰绿护眼', bg: '#e8ede0', text: '#3a4a3a' },
];

const fontOptions: { value: ReaderFont; label: string }[] = [
  { value: 'system', label: '默认衬线' },
  { value: 'song', label: '宋体' },
  { value: 'yahei', label: '微软雅黑' },
];

const displayModeOptions: { value: ReaderDisplayMode; label: string }[] = [
  { value: 'pagination', label: '分页翻页' },
  { value: 'scroll', label: '连续滚动' },
];

export const ReaderSettings: React.FC = () => {
  const isVisible = useReaderStore((state) => state.isSettingsVisible);
  const setSettingsVisible = useReaderStore((state) => state.setSettingsVisible);
  const { settings, setTheme, setFont, setFontSize, setLineHeight, setMargin, setDisplayMode } = useReaderSettings();

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-medium">阅读设置</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSettingsVisible(false)}
          >
            关闭
          </Button>
        </div>

        {/* 主题 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3 text-secondary">主题</label>
          <div className="grid grid-cols-2 gap-3">
            {themeOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border-2 transition-all
                  ${settings.theme === option.value
                    ? 'border-[var(--reader-accent)] ring-2 ring-[rgba(var(--reader-accent-rgb),0.24)]'
                    : 'border-[var(--reader-border)]'
                  }
                `}
                style={{
                  backgroundColor: option.bg,
                  color: option.text,
                }}
              >
                <div className="w-4 h-4 rounded-full border border-current" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 字体 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3 text-secondary">字体</label>
          <div className="grid grid-cols-3 gap-2">
            {fontOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setFont(option.value)}
                className={`
                  px-3 py-2 rounded border text-center transition-colors
                  ${settings.font === option.value
                    ? 'bg-[rgba(var(--reader-accent-rgb),0.12)] border-[var(--reader-accent)] text-[var(--reader-text)]'
                    : 'border-[var(--reader-border)] text-[var(--reader-secondary)] hover:border-[rgba(var(--reader-accent-rgb),0.38)]'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 字号 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3 text-secondary">
            字号：{fontSizeMap[settings.fontSize]}px
          </label>
          <div className="grid grid-cols-6 gap-1">
            {Object.keys(fontSizeMap).map(size => {
              const num = parseInt(size);
              return (
                <button
                  key={num}
                  onClick={() => setFontSize(num)}
                  className={`
                    px-2 py-2 rounded border text-center text-sm transition-colors
                    ${settings.fontSize === num
                      ? 'bg-[rgba(var(--reader-accent-rgb),0.12)] border-[var(--reader-accent)] text-[var(--reader-text)]'
                      : 'border-[var(--reader-border)] text-[var(--reader-secondary)] hover:border-[rgba(var(--reader-accent-rgb),0.38)]'
                    }
                  `}
                >
                  {fontSizeMap[num]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 行距 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3 text-secondary">
            行距：{lineHeightMap[settings.lineHeight]}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(lineHeightMap).map(lh => {
              const num = parseInt(lh);
              return (
                <button
                  key={num}
                  onClick={() => setLineHeight(num)}
                  className={`
                    px-2 py-2 rounded border text-center text-sm transition-colors
                    ${settings.lineHeight === num
                      ? 'bg-[rgba(var(--reader-accent-rgb),0.12)] border-[var(--reader-accent)] text-[var(--reader-text)]'
                      : 'border-[var(--reader-border)] text-[var(--reader-secondary)] hover:border-[rgba(var(--reader-accent-rgb),0.38)]'
                    }
                  `}
                >
                  {lineHeightMap[num]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 边距 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3 text-secondary">
            左右边距：{marginMap[settings.margin]}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(marginMap).map(mg => {
              const num = parseInt(mg);
              return (
                <button
                  key={num}
                  onClick={() => setMargin(num)}
                  className={`
                    px-2 py-2 rounded border text-center text-sm transition-colors
                    ${settings.margin === num
                      ? 'bg-[rgba(var(--reader-accent-rgb),0.12)] border-[var(--reader-accent)] text-[var(--reader-text)]'
                      : 'border-[var(--reader-border)] text-[var(--reader-secondary)] hover:border-[rgba(var(--reader-accent-rgb),0.38)]'
                    }
                  `}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* 显示模式 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3 text-secondary">阅读模式</label>
          <div className="grid grid-cols-2 gap-2">
            {displayModeOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setDisplayMode(option.value)}
                className={`
                  px-3 py-2 rounded border text-center transition-colors
                  ${settings.displayMode === option.value
                    ? 'bg-[rgba(var(--reader-accent-rgb),0.12)] border-[var(--reader-accent)] text-[var(--reader-text)]'
                    : 'border-[var(--reader-border)] text-[var(--reader-secondary)] hover:border-[rgba(var(--reader-accent-rgb),0.38)]'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-[var(--reader-border)]">
          <Button variant="primary" onClick={() => setSettingsVisible(false)}>
            确定
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ReaderSettings;
