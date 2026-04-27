import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useReaderStore } from '../stores/readerStore';
import { Button } from '../../../components/v2';
import type { Chapter } from '../../../types/api';

interface TableOfContentsProps {
  projectId: number;
  chapters: Chapter[];
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ projectId, chapters }) => {
  const navigate = useNavigate();
  const isVisible = useReaderStore(state => state.isTocVisible);
  const setTocVisible = useReaderStore(state => state.setTocVisible);
  const setCurrentChapter = useReaderStore(state => state.setCurrentChapter);

  if (!isVisible) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setTocVisible(false);
    }
  };

  const handleChapterClick = (chapterIndex: number) => {
    setCurrentChapter(chapterIndex);
    navigate(`/projects/${projectId}/read/${chapterIndex}`);
    setTocVisible(false);
  };

  const currentChapterIndex = parseInt(
    window.location.pathname.split('/').pop() || '1'
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="fixed left-0 top-0 bottom-0 w-[280px] backdrop-blur-md shadow-xl overflow-y-auto"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--reader-bg) 95%, transparent)',
        }}
      >
        <div className="p-4 border-b border-[var(--reader-border)]">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-medium text-[var(--reader-text)]">目录</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTocVisible(false)}
            >
              关闭
            </Button>
          </div>
          <p className="text-sm text-[var(--reader-secondary)] mt-2">
            {chapters.length} 章
          </p>
        </div>
        <div className="p-3 space-y-2">
          {chapters.map(chap => (
            <button
              key={chap.chapter_index}
              onClick={() => handleChapterClick(chap.chapter_index)}
              className={`
                w-full text-left px-4 py-3 rounded-lg transition-colors border
                ${currentChapterIndex === chap.chapter_index
                  ? 'bg-sage/10 border-sage text-[var(--reader-text)]'
                  : 'border-transparent text-[var(--reader-text)] hover:bg-sage/5 hover:border-sage/30'
                }
              `}
            >
              <div className="font-medium">{chap.title || `第${chap.chapter_index}章`}</div>
              <div className="text-xs text-[var(--reader-secondary)]">
                {chap.word_count} 字
              </div>
            </button>
          ))}
          {chapters.length === 0 && (
            <p className="text-center text-[var(--reader-secondary)] py-8">
              暂无章节
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableOfContents;
