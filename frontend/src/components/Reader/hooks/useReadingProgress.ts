import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReaderStore } from '../stores/readerStore';
import { getReadingProgress, saveReadingProgress } from '../../../utils/endpoints';

export function useReadingProgress(projectId: number, chapterIndex: number, totalPages: number, isShare: boolean = false) {
  const currentPage = useReaderStore(state => state.currentPage);
  const setCurrentPage = useReaderStore(state => state.setCurrentPage);
  const saveTimeoutRef = useRef<number | null>(null);

  // 获取阅读进度
  const { data: progress } = useQuery({
    queryKey: ['reading-progress', projectId],
    queryFn: () => getReadingProgress(projectId),
    enabled: !isShare,
    staleTime: 1000 * 60 * 5, // 5分钟
  });

  // 初始化时恢复进度
  useEffect(() => {
    if (isShare || !progress) return;

    // 如果是当前打开的章节，恢复位置
    if (progress.chapter_index === chapterIndex) {
      setCurrentPage(progress.position);
    }
  }, [progress, chapterIndex, setCurrentPage, isShare]);

  // 防抖保存进度
  const saveProgress = useCallback(() => {
    if (isShare) return;

    const percentage = totalPages > 0 ? currentPage / totalPages : 0;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveReadingProgress(projectId, {
        chapter_index: chapterIndex,
        position: currentPage,
        percentage,
      });
    }, 2000); // 2秒防抖
  }, [projectId, chapterIndex, currentPage, totalPages, isShare]);

  // 当前页变化时保存
  useEffect(() => {
    saveProgress();
  }, [currentPage, saveProgress]);

  // 清理
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    savedProgress: progress,
  };
}
