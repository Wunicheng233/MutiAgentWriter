import { TextMeasurer } from './textMeasure';
import type { PaginationRequest, PaginationResponse } from '../types';

const measurer = new TextMeasurer();

// 中文段落首行缩进两个字符（用两个空格占位，实际宽度由字体和字号决定）
const FIRST_LINE_INDENT = '  ';

self.onmessage = (e: MessageEvent<PaginationRequest>) => {
  const { content, containerWidth, containerHeight, fontSize, lineHeight, fontFamily } = e.data;

  // 计算可用内容区域，底部留出更多空间避免最后一行被截断
  // 前端已经减去了 40px，这里再减去一行保证完整显示
  const lineHeightPx = fontSize * lineHeight;
  const linesPerPage = Math.floor((containerHeight - fontSize * 2) / lineHeightPx);

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
      const fitLength = measurer.fitTextToWidth(
        remainingText,
        containerWidth,
        fontSize,
        fontFamily
      );

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
