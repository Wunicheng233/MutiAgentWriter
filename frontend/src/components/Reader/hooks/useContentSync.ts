import { useState, useEffect, useRef } from 'react';
import { useReaderStore } from '../stores/readerStore';

// 保存阅读位置，用于切换到编辑模式后恢复
interface ReadingPosition {
  chapterIndex: number;
  currentPage: number;
  scrollPosition: number;
}

export function useContentSync(initialContent: string) {
  const [content, setContent] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const mode = useReaderStore((state) => state.mode);
  const savedPositionRef = useRef<ReadingPosition | null>(null);

  // 当外部内容变化时更新
  useEffect(() => {
    if (!isDirty) {
      queueMicrotask(() => setContent(initialContent));
    }
  }, [initialContent, isDirty]);

  // 保存当前阅读位置
  const saveReadingPosition = () => {
    savedPositionRef.current = {
      chapterIndex: useReaderStore.getState().currentChapterIndex,
      currentPage: useReaderStore.getState().currentPage,
      scrollPosition: useReaderStore.getState().scrollPosition,
    };
  };

  // 恢复阅读位置
  const restoreReadingPosition = () => {
    if (!savedPositionRef.current) return;
    const pos = savedPositionRef.current;
    useReaderStore.getState().setCurrentPage(pos.currentPage);
    useReaderStore.getState().setScrollPosition(pos.scrollPosition);
  };

  // 处理内容变更
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
  };

  return {
    content,
    setContent: handleContentChange,
    isDirty,
    setIsDirty,
    mode,
    saveReadingPosition,
    restoreReadingPosition,
  };
}
