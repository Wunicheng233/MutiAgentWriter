import { TextMeasurer } from './textMeasure';
import type { PaginationRequest, PaginationResponse } from '../types';

const measurer = new TextMeasurer();

// 中文段落首行缩进两个字符（用两个空格占位，实际宽度由字体和字号决定）
const FIRST_LINE_INDENT = '  ';

function clampFitLengthByVisualWidth(fitLength: number, maxWidth: number, fontSize: number): number {
  // Canvas 在不同中文字体下可能低估宽度；用 em 宽度再做一道保守上限，避免渲染时自动换行。
  const maxCjkChars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.95)));
  return Math.max(1, Math.min(fitLength, maxCjkChars));
}

self.onmessage = (e: MessageEvent<PaginationRequest>) => {
  const { content, containerWidth, containerHeight, fontSize, lineHeight, fontFamily } = e.data;

  const lineHeightPx = fontSize * lineHeight;
  const linesPerPage = Math.max(1, Math.floor(containerHeight / lineHeightPx));

  // 按原始段落分割，过滤空行
  const paragraphs = content.split('\n').filter(p => p.trim());
  const pages: PaginationResponse['pages'] = [];
  const currentLines: string[] = [];
  let currentLineCount = 0;
  let currentStartOffset = 0;

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    let remainingText = FIRST_LINE_INDENT + trimmedPara;

    while (remainingText.length > 0) {
      const measuredFitLength = measurer.fitTextToWidth(
        remainingText,
        containerWidth,
        fontSize,
        fontFamily
      );
      const fitLength = clampFitLengthByVisualWidth(measuredFitLength, containerWidth, fontSize);

      const line = remainingText.slice(0, fitLength);
      remainingText = remainingText.slice(fitLength);

      // 检查是否超出当前页
      if (currentLineCount >= linesPerPage) {
        // 保存当前页
        const pageContent = currentLines.join('\n');
        const endOffset = currentStartOffset + pageContent.length;
        pages.push({
          content: pageContent,
          startOffset: currentStartOffset,
          endOffset,
        });
        // 开始新页
        currentLines.length = 0;
        currentLineCount = 0;
        currentStartOffset = endOffset;
      }

      currentLines.push(line);
      currentLineCount++;
    }

    // 段落结束，添加一个空行分隔（如果还有空间）
    if (remainingText.length === 0 && currentLineCount + 1 <= linesPerPage) {
      currentLines.push('');
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

  const response: PaginationResponse = {
    pages,
    totalPages: pages.length,
  };

  self.postMessage(response);
};
