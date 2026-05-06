import { act, renderHook } from '@testing-library/react'
import { useBibleStore } from '../store/useBibleStore'
import type { ArcStatus } from '../types/api'

describe('useBibleStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useBibleStore.getState().reset()
    })
  })

  it('should initialize with empty default bible', () => {
    const { result } = renderHook(() => useBibleStore())
    expect(result.current.bible).toEqual({
      version: 1,
      characters: [],
      world: {},
      plot: {},
      todos: [],
    })
  })

  it('should add a character', () => {
    const { result } = renderHook(() => useBibleStore())

    act(() => {
      result.current.addCharacter({
        name: '李逍遥',
        role: 'protagonist',
        personality: '乐观开朗',
      })
    })

    expect(result.current.bible.characters).toHaveLength(1)
    expect(result.current.bible.characters[0].name).toBe('李逍遥')
    expect(result.current.bible.characters[0].id).toBeDefined()
    expect(result.current.bible.characters[0].createdAt).toBeDefined()
  })

  it('should update a character', () => {
    const { result } = renderHook(() => useBibleStore())

    act(() => {
      result.current.addCharacter({
        name: '李逍遥',
        role: 'protagonist',
      })
    })

    const charId = useBibleStore.getState().bible.characters[0].id

    act(() => {
      result.current.updateCharacter(charId, {
        personality: '乐观开朗，仗义疏财',
        catchphrase: '吃到老，玩到老！',
      })
    })

    expect(useBibleStore.getState().bible.characters[0].personality).toBe('乐观开朗，仗义疏财')
    expect(useBibleStore.getState().bible.characters[0].catchphrase).toBe('吃到老，玩到老！')
  })

  it('should delete a character', () => {
    const { result } = renderHook(() => useBibleStore())

    act(() => {
      result.current.addCharacter({
        name: '李逍遥',
        role: 'protagonist',
      })
    })

    const charId = useBibleStore.getState().bible.characters[0].id

    act(() => {
      result.current.deleteCharacter(charId)
    })

    expect(useBibleStore.getState().bible.characters).toHaveLength(0)
  })

  it('should add a todo item', () => {
    const { result } = renderHook(() => useBibleStore())

    act(() => {
      result.current.addTodo({
        content: '检查李逍遥的性格一致性',
        type: 'consistency',
        completed: false,
      })
    })

    expect(result.current.bible.todos).toHaveLength(1)
    expect(result.current.bible.todos[0].content).toContain('李逍遥')
  })

  it('should update world setting', () => {
    const { result } = renderHook(() => useBibleStore())

    act(() => {
      result.current.updateWorldSetting({
        powerSystem: '练气 → 筑基 → 金丹 → 元婴',
      })
    })

    expect(result.current.bible.world.powerSystem).toBe('练气 → 筑基 → 金丹 → 元婴')
  })

  it('should update plot setting', () => {
    const { result } = renderHook(() => useBibleStore())

    act(() => {
      result.current.updatePlotSetting({
        arcs: [{
          id: 'arc-1',
          name: '主线',
          description: '李逍遥的修仙之路',
          status: 'in-progress' as ArcStatus,
        }],
      })
    })

    expect(result.current.bible.plot.arcs).toHaveLength(1)
  })
})
