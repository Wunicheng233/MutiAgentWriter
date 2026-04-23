import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useReaderStore } from './stores/readerStore';
import { useReaderSettings } from './hooks/useReaderSettings';
import { usePagination } from './hooks/usePagination';
import { useReadingProgress } from './hooks/useReadingProgress';
import { PaginationControls } from './components/PaginationControls';

// 去除 HTML 标签，将 HTML 转换回纯文本
function stripHtml(html: string): string {
  return html
    .replace(/<\/?p>/g, '')        // 移除 p 标签
    .replace(/<\/?[^>]+(>|$)/g, '') // 移除所有其他 HTML 标签
    .replace(/^\s+|\s+$/g, '')     // 修剪首尾空白
    .replace(/\n\s*\n/g, '\n');    // 压缩空行
}

import type { PaginationResponse } from './types';

interface ReaderCoreProps {
  content: string;
  projectId: number;
  chapterIndex: number;
  isShare?: boolean;
  onPagesChange?: (pages: PaginationResponse['pages']) => void;
}

export const ReaderCore: React.FC<ReaderCoreProps> = ({
  content,
  projectId,
  chapterIndex,
  isShare = false,
  onPagesChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const { settings, actualFontSize, actualLineHeight, actualMargin, actualFontFamily, themeClass } = useReaderSettings();
  const currentPage = useReaderStore(state => state.currentPage);
  const setCurrentPage = useReaderStore(state => state.setCurrentPage);
  const toggleMenu = useReaderStore(state => state.toggleMenu);

  // 去除 HTML 标签，保证显示纯文本
  const cleanContent = useMemo(() => {
    return stripHtml(content);
  }, [content]);

  // 防抖处理窗口 resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // 计算可用内容尺寸（减去边距）
        const marginPercent = parseFloat(actualMargin);
        const marginPx = rect.width * (marginPercent / 100);
        const width = rect.width - marginPx;
        // 减去：提示文字(约50px) + 分页控件(约50px) + 一些边距
        const height = rect.height - 120;
        setContainerSize({ width, height });
      }
    };

    updateSize();

    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(updateSize, 200);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [actualMargin]);

  // 分页计算
  const { pages, totalPages, loading } = usePagination(
    cleanContent,
    containerSize.width,
    containerSize.height,
    actualFontSize,
    actualLineHeight,
    actualFontFamily
  );

  // 更新父组件的 pages 引用用于搜索跳转
  useEffect(() => {
    onPagesChange?.(pages);
  }, [pages, onPagesChange]);

  // 自动保存阅读进度
  useReadingProgress(projectId, chapterIndex, totalPages, isShare);

  // 当总页数变化时，如果当前页超出范围，调整到最后一页
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  // 处理点击区域：点击左侧翻上一页，点击右侧翻下一页，右键呼出菜单
  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (settings.displayMode !== 'pagination') {
      return;
    }

    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const thirdWidth = rect.width / 3;

    if (x < thirdWidth && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    } else if (x > rect.width - thirdWidth && currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages, settings.displayMode, setCurrentPage]);

  // 右键呼出菜单
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    toggleMenu();
  }, [toggleMenu]);

  // 键盘翻页
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settings.displayMode !== 'pagination' || !pages.length) return;

      if (e.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, settings.displayMode, pages.length, setCurrentPage]);

  // 滚动模式处理 - 保存滚动位置
  // handleScroll is reserved for future use
  // const handleScroll = useCallback(() => {
  //   // 这里由 useReadingProgress hook 处理保存
  // }, []);

  // 渲染当前页内容（分页模式）
  const renderPaginationContent = () => {
    if (loading) {
      return <div className="text-center text-secondary py-12">排版中...</div>;
    }

    if (!pages.length) {
      return <div className="text-center text-secondary py-12">暂无内容</div>;
    }

    const currentPageData = pages[currentPage - 1];
    if (!currentPageData) return null;

    // 分页模式下，按段落分组（空行分隔），每个段落添加首行缩进
    const paragraphs = currentPageData.content.split('\n').filter(p => p.trim());
    return (
      <div className="h-full space-y-[calc(var(--reader-font-size)*0.5)]">
        {paragraphs.map((para, idx) => (
          <p key={idx} className="text-[var(--reader-text)] leading-[var(--reader-line-height)] text-[calc(var(--reader-font-size))]">
            &emsp;&emsp;{para.trim()}
          </p>
        ))}
      </div>
    );
  };

  // 渲染滚动模式内容（整章连续滚动）
  const renderScrollContent = () => {
    // 滚动模式下，按段落分割，每个段落首行缩进
    const paragraphs = cleanContent.split('\n').filter(p => p.trim());
    return (
      <div className="space-y-[calc(var(--reader-font-size)*0.5)]">
        {paragraphs.map((para, idx) => (
          <p key={idx} className="text-[var(--reader-text)] leading-[var(--reader-line-height)] text-[calc(var(--reader-font-size))]">
            &emsp;&emsp;{para.trim()}
          </p>
        ))}
      </div>
    );
  };

  const isPagination = settings.displayMode === 'pagination';

  return (
    <div
      className={`min-h-screen ${themeClass} bg-[var(--reader-bg)] transition-colors duration-300`}
      style={{
        '--reader-font-size': `${actualFontSize}px`,
        '--reader-line-height': actualLineHeight,
      } as React.CSSProperties}
    >
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        onContextMenu={handleContextMenu}
        className={`
          py-8 mx-auto
          font-serif text-[var(--reader-text)]
          ${isPagination ? 'h-[calc(100vh-160px)] overflow-hidden' : 'min-h-[calc(100vh-160px)]'}
        `}
        style={{
          paddingLeft: actualMargin,
          paddingRight: actualMargin,
          maxWidth: actualFontSize > 20 ? 900 : 720,
        }}
      >
        {/* 提示文字 */}
        <div className="text-center mb-6">
          <p className="text-xs text-[var(--reader-secondary)] opacity-70">
            右键唤醒阅读菜单
          </p>
        </div>

        {isPagination ? renderPaginationContent() : renderScrollContent()}

        {isPagination && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevPage={() => setCurrentPage(currentPage - 1)}
            onNextPage={() => setCurrentPage(currentPage + 1)}
            onGoToPage={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
};

export default ReaderCore;
