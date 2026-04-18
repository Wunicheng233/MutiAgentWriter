import { useCallback } from 'react';
import { useReaderStore } from '../stores/readerStore';
import type { ReaderTheme, ReaderFont } from '../types';

// 设置值映射到实际像素/比例
export const fontSizeMap: Record<number, number> = {
  1: 14,
  2: 16,
  3: 18,
  4: 20,
  5: 22,
  6: 24,
};

export const lineHeightMap: Record<number, number> = {
  1: 1.4,
  2: 1.6,
  3: 1.8,
  4: 2.0,
};

export const marginMap: Record<number, string> = {
  1: '2%',
  2: '5%',
  3: '8%',
  4: '12%',
};

export const fontMap: Record<ReaderFont, string> = {
  system: 'var(--reader-font-family)',
  song: 'SimSun, "Songti SC", serif',
  yahei: 'Microsoft YaHei, "PingFang SC", sans-serif',
};

export const themeClasses: Record<ReaderTheme, string> = {
  parchment: 'theme-parchment',
  white: 'theme-white',
  dark: 'theme-dark',
  green: 'theme-green',
};

export function useReaderSettings() {
  const settings = useReaderStore((state) => state.settings);
  const setTheme = useReaderStore((state) => state.setTheme);
  const setFont = useReaderStore((state) => state.setFont);
  const setFontSize = useReaderStore((state) => state.setFontSize);
  const setLineHeight = useReaderStore((state) => state.setLineHeight);
  const setMargin = useReaderStore((state) => state.setMargin);
  const setDisplayMode = useReaderStore((state) => state.setDisplayMode);

  // 获取实际的 CSS 值
  const actualFontSize = fontSizeMap[settings.fontSize] || 18;
  const actualLineHeight = lineHeightMap[settings.lineHeight] || 1.6;
  const actualMargin = marginMap[settings.margin] || '5%';
  const actualFontFamily = fontMap[settings.font];
  const themeClass = themeClasses[settings.theme];

  // 应用 CSS 变量到 document
  const applySettings = useCallback(() => {
    document.documentElement.style.setProperty('--reader-bg', 'var(--reader-bg)');
    document.documentElement.style.setProperty('--reader-text', 'var(--reader-text)');
    document.documentElement.style.setProperty('--reader-border', 'var(--reader-border)');
    document.documentElement.style.setProperty('--reader-secondary', 'var(--reader-secondary)');
    document.documentElement.style.setProperty('--reader-font-family', actualFontFamily);
  }, [actualFontFamily]);

  return {
    settings,
    actualFontSize,
    actualLineHeight,
    actualMargin,
    actualFontFamily,
    themeClass,
    setTheme,
    setFont,
    setFontSize,
    setLineHeight,
    setMargin,
    setDisplayMode,
    applySettings,
  };
}
