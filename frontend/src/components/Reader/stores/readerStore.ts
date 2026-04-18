import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReaderSettings, ReaderTheme, ReaderFont, ReaderDisplayMode, Bookmark } from '../types';

interface ReaderState {
  // 设置（持久化）
  settings: ReaderSettings;

  // 当前阅读状态
  currentChapterIndex: number;
  currentPage: number;
  scrollPosition: number;

  // UI 状态
  isMenuVisible: boolean;
  isTocVisible: boolean;
  isSettingsVisible: boolean;
  isBookmarkVisible: boolean;
  isSearchVisible: boolean;

  // 模式
  mode: 'read' | 'edit';

  // 书签（持久化）
  bookmarks: Record<string, Bookmark[]>;  // key: `${projectId}-${chapterIndex}`

  // Actions - 设置
  setTheme: (theme: ReaderTheme) => void;
  setFont: (font: ReaderFont) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setMargin: (margin: number) => void;
  setDisplayMode: (mode: ReaderDisplayMode) => void;

  // Actions - 阅读进度
  setCurrentPage: (page: number) => void;
  setScrollPosition: (pos: number) => void;
  setCurrentChapter: (index: number) => void;

  // Actions - UI
  toggleMenu: () => void;
  setMenuVisible: (visible: boolean) => void;
  setTocVisible: (visible: boolean) => void;
  setSettingsVisible: (visible: boolean) => void;
  setBookmarkVisible: (visible: boolean) => void;
  setSearchVisible: (visible: boolean) => void;

  // Actions - 模式切换
  setMode: (mode: 'read' | 'edit') => void;

  // Actions - 书签
  addBookmark: (projectId: number, chapterIndex: number, position: number, label?: string) => void;
  removeBookmark: (projectId: number, chapterIndex: number, bookmarkId: string) => void;
  getBookmarks: (projectId: number, chapterIndex: number) => Bookmark[];

  // 重置所有状态
  reset: () => void;
}

const defaultSettings: ReaderSettings = {
  theme: 'parchment',
  font: 'system',
  fontSize: 3,      // 18px 默认
  lineHeight: 2,    // 1.6 默认
  margin: 2,        // 5% 默认
  displayMode: 'pagination',
};

const initialState: {
  currentChapterIndex: number;
  currentPage: number;
  scrollPosition: number;
  isMenuVisible: boolean;
  isTocVisible: boolean;
  isSettingsVisible: boolean;
  isBookmarkVisible: boolean;
  isSearchVisible: boolean;
  mode: 'read' | 'edit';
  bookmarks: Record<string, Bookmark[]>;
} = {
  currentChapterIndex: 1,
  currentPage: 1,
  scrollPosition: 0,
  isMenuVisible: false,
  isTocVisible: false,
  isSettingsVisible: false,
  isBookmarkVisible: false,
  isSearchVisible: false,
  mode: 'read',
  bookmarks: {},
};

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      settings: { ...defaultSettings },
      ...initialState,

      setTheme: (theme) => set(state => ({
        settings: { ...state.settings, theme }
      })),

      setFont: (font) => set(state => ({
        settings: { ...state.settings, font }
      })),

      setFontSize: (size) => set(state => ({
        settings: { ...state.settings, fontSize: size }
      })),

      setLineHeight: (height) => set(state => ({
        settings: { ...state.settings, lineHeight: height }
      })),

      setMargin: (margin) => set(state => ({
        settings: { ...state.settings, margin }
      })),

      setDisplayMode: (displayMode) => set(state => ({
        settings: { ...state.settings, displayMode }
      })),

      setCurrentPage: (page) => set({ currentPage: page }),

      setScrollPosition: (pos) => set({ scrollPosition: pos }),

      setCurrentChapter: (index) => set({
        currentChapterIndex: index,
        currentPage: 1,
        scrollPosition: 0,
      }),

      toggleMenu: () => set(state => ({
        isMenuVisible: !state.isMenuVisible
      })),

      setMenuVisible: (visible) => set({ isMenuVisible: visible }),

      setTocVisible: (visible) => set({ isTocVisible: visible }),

      setSettingsVisible: (visible) => set({ isSettingsVisible: visible }),

      setBookmarkVisible: (visible) => set({ isBookmarkVisible: visible }),

      setSearchVisible: (visible) => set({ isSearchVisible: visible }),

      setMode: (mode) => set({ mode }),

      addBookmark: (projectId, chapterIndex, position, label) => set(state => {
        const key = `${projectId}-${chapterIndex}`;
        const newBookmark: Bookmark = {
          id: `${Date.now()}`,
          chapterIndex,
          position,
          label: label || `书签 ${new Date().toLocaleString()}`,
          createdAt: new Date().toISOString(),
        };
        const existing = state.bookmarks[key] || [];
        return {
          bookmarks: {
            ...state.bookmarks,
            [key]: [...existing, newBookmark],
          },
        };
      }),

      removeBookmark: (projectId, chapterIndex, bookmarkId) => set(state => {
        const key = `${projectId}-${chapterIndex}`;
        const existing = state.bookmarks[key] || [];
        return {
          bookmarks: {
            ...state.bookmarks,
            [key]: existing.filter(b => b.id !== bookmarkId),
          },
        };
      }),

      getBookmarks: (projectId, chapterIndex) => {
        const key = `${projectId}-${chapterIndex}`;
        return get().bookmarks[key] || [];
      },

      reset: () => set({
        ...initialState,
        settings: { ...defaultSettings },
      }),
    }),
    {
      name: 'reader-settings',
      partialize: (state) => ({
        settings: state.settings,
        bookmarks: state.bookmarks,
      }),
    }
  )
);
