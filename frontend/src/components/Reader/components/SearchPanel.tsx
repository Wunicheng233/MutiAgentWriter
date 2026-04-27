import React, { useState, useMemo } from 'react';
import { useReaderStore } from '../stores/readerStore';
import { Button, Card } from '../../../components/v2';
import type { SearchMatch } from '../types';

interface SearchPanelProps {
  content: string;
  onJump: (position: number) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ content, onJump }) => {
  const isVisible = useReaderStore((state) => state.isSearchVisible);
  const setSearchVisible = useReaderStore((state) => state.setSearchVisible);
  const [query, setQuery] = useState('');

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSearchVisible(false);
    }
  };

  const matches: SearchMatch[] = useMemo(() => {
    if (!isVisible || !query || query.trim().length < 2) return [];

    const results: SearchMatch[] = [];
    const trimmedQuery = query.trim().toLowerCase();
    let pos = 0;

    while (pos < content.length) {
      const index = content.toLowerCase().indexOf(trimmedQuery, pos);
      if (index === -1) break;

      // 获取上下文（前后各20个字符）
      const start = Math.max(0, index - 20);
      const end = Math.min(content.length, index + query.length + 20);
      const context = content.slice(start, end);

      results.push({
        index: results.length,
        text: query,
        position: index,
        context: `...${context}...`,
      });

      pos = index + query.length;
    }

    return results;
  }, [content, query, isVisible]);

  const handleJump = (position: number) => {
    onJump(position);
    setSearchVisible(false);
  };

  const isMobile = window.innerWidth < 768;

  if (!isVisible) return null;

  const renderContent = () => (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-inter font-medium text-[var(--reader-text)]">全文搜索</h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSearchVisible(false)}
        >
          关闭
        </Button>
      </div>
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入关键词搜索..."
          className="w-full px-3 py-2 border border-[var(--reader-border)] rounded-standard bg-[var(--reader-bg)] text-[var(--reader-text)] focus:outline-none focus:ring-2 focus:ring-sage/50"
          autoFocus
        />
      </div>
      <div className="max-h-[50vh] overflow-y-auto">
        {query.trim().length < 2 ? (
          <p className="text-center text-[var(--reader-secondary)] py-8">
            请输入至少2个字符
          </p>
        ) : matches.length === 0 ? (
          <p className="text-center text-[var(--reader-secondary)] py-8">
            未找到匹配结果
          </p>
        ) : (
          <div className="space-y-2">
            {matches.map(match => (
              <button
                key={match.index}
                onClick={() => handleJump(match.position)}
                className="w-full text-left p-3 border border-[var(--reader-border)] rounded-standard hover:bg-sage/5 transition-colors"
              >
                <p className="text-[var(--reader-text)]">
                  {highlightMatch(match.context, match.text)}
                </p>
              </button>
            ))}
            <p className="text-sm text-[var(--reader-secondary)] text-center py-2">
              共找到 {matches.length} 个结果
            </p>
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-end"
        onClick={handleBackdropClick}
      >
        <Card className="w-full max-h-[80vh] rounded-t-[24px] rounded-b-none p-4 bg-[var(--reader-bg)]">
          {renderContent()}
        </Card>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-lg max-h-[80vh] bg-[var(--reader-bg)]">
        {renderContent()}
      </Card>
    </div>
  );
};

// 简单高亮匹配关键词
function highlightMatch(context: string, query: string): React.ReactNode {
  const lowerContext = context.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContext.indexOf(lowerQuery);
  if (index === -1) return context;

  return (
    <>
      {context.slice(0, index)}
      <mark className="bg-yellow-200 dark:bg-yellow-800">{context.slice(index, index + query.length)}</mark>
      {context.slice(index + query.length)}
    </>
  );
}

export default SearchPanel;
