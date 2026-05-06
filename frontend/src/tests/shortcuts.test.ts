import { SHORTCUTS, getAllShortcuts, filterShortcuts } from '../utils/shortcuts'

describe('SHORTCUTS', () => {
  it('should define shortcut groups', () => {
    expect(SHORTCUTS).toHaveProperty('editor')
    expect(SHORTCUTS).toHaveProperty('modes')
    expect(SHORTCUTS).toHaveProperty('panels')
    expect(SHORTCUTS).toHaveProperty('navigation')
  })

  it('should have non-empty shortcut arrays', () => {
    expect(SHORTCUTS.editor.length).toBeGreaterThan(0)
    expect(SHORTCUTS.modes.length).toBeGreaterThan(0)
    expect(SHORTCUTS.panels.length).toBeGreaterThan(0)
    expect(SHORTCUTS.navigation.length).toBeGreaterThan(0)
  })

  it('each shortcut should have label and keys', () => {
    SHORTCUTS.editor.forEach(shortcut => {
      expect(shortcut).toHaveProperty('label')
      expect(shortcut).toHaveProperty('keys')
      expect(typeof shortcut.label).toBe('string')
      expect(typeof shortcut.keys).toBe('string')
    })
  })

  it('getAllShortcuts should return flattened list', () => {
    const all = getAllShortcuts()
    expect(Array.isArray(all)).toBe(true)
    expect(all.length).toBeGreaterThan(SHORTCUTS.editor.length)
    all.forEach(shortcut => {
      expect(shortcut).toHaveProperty('label')
      expect(shortcut).toHaveProperty('keys')
      expect(shortcut).toHaveProperty('group')
    })
  })

  it('filterShortcuts should filter by label', () => {
    const result = filterShortcuts('Typewriter')
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].label.toLowerCase()).toContain('typewriter')
  })

  it('filterShortcuts should be case-insensitive', () => {
    const result1 = filterShortcuts('typewriter')
    const result2 = filterShortcuts('TYPEWRITER')
    expect(result1.length).toBe(result2.length)
  })

  it('filterShortcuts returns empty array for no match', () => {
    const result = filterShortcuts('xyz-nonexistent')
    expect(result).toEqual([])
  })

  it('filterShortcuts returns all shortcuts for empty query', () => {
    const result = filterShortcuts('')
    expect(result.length).toBe(getAllShortcuts().length)
  })
})
