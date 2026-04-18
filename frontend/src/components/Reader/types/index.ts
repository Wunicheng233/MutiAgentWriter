// 主题类型
export type ReaderTheme = 'parchment' | 'white' | 'dark' | 'green';

// 字体类型
export type ReaderFont = 'system' | 'song' | 'yahei';

// 阅读显示模式
export type ReaderDisplayMode = 'pagination' | 'scroll';

// 书签结构
export interface Bookmark {
  id: string;
  chapterIndex: number;
  position: number;
  label?: string;
  createdAt: string;
}

// 阅读进度
export interface ReadingProgress {
  projectId: number;
  chapterIndex: number;
  position: number;
  percentage: number;
  lastReadAt: string;
}

// 阅读设置
export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  fontSize: number;      // 1-6，对应 14-24px
  lineHeight: number;    // 1-4，对应 1.4-2.0
  margin: number;        // 1-4，对应不同水平边距
  displayMode: ReaderDisplayMode;
}

// 分页计算消息（Worker 通信）
export interface PaginationRequest {
  content: string;
  containerWidth: number;
  containerHeight: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
}

export interface PaginationResponse {
  pages: Array<{
    content: string;
    startOffset: number;
    endOffset: number;
  }>;
  totalPages: number;
}

// 搜索匹配结果
export interface SearchMatch {
  index: number;
  text: string;
  position: number;
  context: string;
}

// Reader 组件 Props
export interface ReaderProps {
  projectId: number;
  chapterIndex: number;
  isShare?: boolean;
}

// 目录项
export interface TocItem {
  chapterIndex: number;
  title: string;
  wordCount: number;
}
