import { useState, useEffect, useRef } from 'react';
import type { PaginationRequest, PaginationResponse } from '../types';
import { TextMeasurer } from '../utils/textMeasure';

// 简单的哈希函数生成缓存键
function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// 分页缓存
const paginationCache = new Map<string, PaginationResponse['pages']>();

// 中文段落首行缩进两个字符
const FIRST_LINE_INDENT = '  ';

// 直接在主线程计算分页（fallback）
function calculatePagination(
  content: string,
  containerWidth: number,
  containerHeight: number,
  fontSize: number,
  lineHeight: number,
  fontFamily: string
): PaginationResponse {
  const measurer = new TextMeasurer();
  const lineHeightPx = fontSize * lineHeight;
  // 底部留出更多空间避免最后一行被截断
  // 前端已经减去了 40px，这里再减去两行保证完整显示
  const linesPerPage = Math.floor((containerHeight - fontSize * 2) / lineHeightPx);

  const paragraphs = content.split('\n').filter(p => p.trim());
  const pages: PaginationResponse['pages'] = [];
  const currentLines: string[] = [];
  let currentLineCount = 0;
  let currentStartOffset = 0;

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    let remainingText = FIRST_LINE_INDENT + trimmedPara;

    while (remainingText.length > 0) {
      const fitLength = measurer.fitTextToWidth(
        remainingText,
        containerWidth,
        fontSize,
        fontFamily
      );

      const line = remainingText.slice(0, fitLength);
      remainingText = remainingText.slice(fitLength);

      if (currentLineCount >= linesPerPage) {
        const pageContent = currentLines.join('\n');
        const endOffset = currentStartOffset + pageContent.length;
        pages.push({
          content: pageContent,
          startOffset: currentStartOffset,
          endOffset,
        });
        currentLines.length = 0;
        currentLineCount = 0;
        currentStartOffset = endOffset;
      }

      currentLines.push(line);
      currentLineCount++;
    }

    // 段落结束，添加空行分隔（如果还有空间）
    if (remainingText.length === 0 && currentLineCount + 1 <= linesPerPage) {
      currentLineCount++;
    }
  }

  // 添加最后一页
  if (currentLines.length > 0) {
    const pageContent = currentLines.join('\n');
    const endOffset = currentStartOffset + pageContent.length;
    pages.push({
      content: pageContent,
      startOffset: currentStartOffset,
      endOffset,
    });
  }

  return {
    pages,
    totalPages: pages.length,
  };
}

export function usePagination(
  content: string,
  containerWidth: number,
  containerHeight: number,
  fontSize: number,
  lineHeight: number,
  fontFamily: string
): {
  pages: PaginationResponse['pages'];
  totalPages: number;
  loading: boolean;
} {
  const [pages, setPages] = useState<PaginationResponse['pages']>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  // 生成缓存键
  const cacheKey = `${hashContent(content)}-${containerWidth}-${containerHeight}-${fontSize}-${lineHeight}-${fontFamily}`;

  // 检查缓存，如果有直接使用
  useEffect(() => {
    // 检查容器尺寸，如果为 0 不计算
    if (containerWidth <= 0 || containerHeight <= 0) {
      queueMicrotask(() => {
        setPages([]);
        setTotalPages(0);
      });
      return;
    }

    if (!content || content.trim().length === 0) {
      queueMicrotask(() => {
        setPages([]);
        setTotalPages(0);
      });
      return;
    }

    if (paginationCache.has(cacheKey)) {
      const cachedPages = paginationCache.get(cacheKey)!;
      queueMicrotask(() => {
        setPages(cachedPages);
        setTotalPages(cachedPages.length);
      });
      return;
    }

    // 没有缓存，需要计算
    queueMicrotask(() => setLoading(true));

    // 尝试使用 Web Worker，如果失败回退到主线程
    try {
      // 动态导入 Worker
      const PaginationWorker = new Worker(
        new URL('../utils/pagination.worker.ts', import.meta.url)
      );
      workerRef.current = PaginationWorker;

      const request: PaginationRequest = {
        content,
        containerWidth,
        containerHeight,
        fontSize,
        lineHeight,
        fontFamily,
      };

      PaginationWorker.postMessage(request);

      const handleMessage = (e: MessageEvent<PaginationResponse>) => {
        const result = e.data;
        paginationCache.set(cacheKey, result.pages);
        setPages(result.pages);
        setTotalPages(result.totalPages);
        setLoading(false);
      };

      const handleError = () => {
        // Worker 失败，回退到主线程
        const result = calculatePagination(content, containerWidth, containerHeight, fontSize, lineHeight, fontFamily);
        paginationCache.set(cacheKey, result.pages);
        setPages(result.pages);
        setTotalPages(result.totalPages);
        setLoading(false);
        PaginationWorker.terminate();
      };

      PaginationWorker.addEventListener('message', handleMessage);
      PaginationWorker.addEventListener('error', handleError);

      return () => {
        PaginationWorker.removeEventListener('message', handleMessage);
        PaginationWorker.removeEventListener('error', handleError);
        PaginationWorker.terminate();
      };
    } catch {
      // Worker 创建失败，直接在主线程计算
      const result = calculatePagination(content, containerWidth, containerHeight, fontSize, lineHeight, fontFamily);
      paginationCache.set(cacheKey, result.pages);
      queueMicrotask(() => {
        setPages(result.pages);
        setTotalPages(result.totalPages);
        setLoading(false);
      });
    }
  }, [content, containerWidth, containerHeight, fontSize, lineHeight, fontFamily, cacheKey]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  return { pages, totalPages, loading };
}
