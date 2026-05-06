import { create } from 'zustand'
import type { Bible, Character, WorldSetting, PlotSetting, TodoItem } from '../types/api'
import api from '../utils/api'

const defaultBible: Bible = {
  version: 1,
  characters: [],
  world: {},
  plot: {},
  todos: [],
}

interface BibleState {
  bible: Bible
  isLoading: boolean
  error: string | null

  // 角色操作
  addCharacter: (char: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateCharacter: (id: string, updates: Partial<Character>) => void
  deleteCharacter: (id: string) => void

  // 待办操作
  addTodo: (todo: Omit<TodoItem, 'id' | 'createdAt'>) => void
  updateTodo: (id: string, updates: Partial<TodoItem>) => void
  deleteTodo: (id: string) => void

  // 世界观/情节操作
  updateWorldSetting: (updates: Partial<WorldSetting>) => void
  updatePlotSetting: (updates: Partial<PlotSetting>) => void

  // 持久化
  saveToProject: (projectId: number) => Promise<void>
  loadFromProject: (projectId: number) => Promise<void>

  // 重置
  reset: () => void
}

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export const useBibleStore = create<BibleState>((set, get) => ({
  bible: defaultBible,
  isLoading: false,
  error: null,

  addCharacter: (char) => set((state) => ({
    bible: {
      ...state.bible,
      characters: [
        ...state.bible.characters,
        {
          ...char,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  })),

  updateCharacter: (id, updates) => set((state) => ({
    bible: {
      ...state.bible,
      characters: state.bible.characters.map((c) =>
        c.id === id
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      ),
    },
  })),

  deleteCharacter: (id) => set((state) => ({
    bible: {
      ...state.bible,
      characters: state.bible.characters.filter((c) => c.id !== id),
    },
  })),

  addTodo: (todo) => set((state) => ({
    bible: {
      ...state.bible,
      todos: [
        ...state.bible.todos,
        {
          ...todo,
          id: generateId(),
          createdAt: new Date().toISOString(),
        },
      ],
    },
  })),

  updateTodo: (id, updates) => set((state) => ({
    bible: {
      ...state.bible,
      todos: state.bible.todos.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    },
  })),

  deleteTodo: (id) => set((state) => ({
    bible: {
      ...state.bible,
      todos: state.bible.todos.filter((t) => t.id !== id),
    },
  })),

  updateWorldSetting: (updates) => set((state) => ({
    bible: {
      ...state.bible,
      world: {
        ...state.bible.world,
        ...updates,
      },
    },
  })),

  updatePlotSetting: (updates) => set((state) => ({
    bible: {
      ...state.bible,
      plot: {
        ...state.bible.plot,
        ...updates,
      },
    },
  })),

  saveToProject: async (projectId: number) => {
    set({ isLoading: true, error: null })
    try {
      const { bible } = get()
      await api.put(`/projects/${projectId}`, { bible })
      set({ isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: '保存失败' })
      throw err
    }
  },

  loadFromProject: async (projectId: number) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.get(`/projects/${projectId}`)
      const projectBible = response.data.bible

      if (projectBible) {
        set({
          bible: {
            ...defaultBible,
            ...projectBible,
          },
          isLoading: false,
        })
      } else {
        set({ bible: defaultBible, isLoading: false })
      }
    } catch (err) {
      set({ bible: defaultBible, isLoading: false, error: '加载失败' })
      throw err
    }
  },

  reset: () => set({ bible: defaultBible, isLoading: false, error: null }),
}))
