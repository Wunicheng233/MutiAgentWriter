import { computeDiff, renderDiffHtml } from '../utils/textDiff'

describe('textDiff', () => {
  describe('computeDiff', () => {
    it('should detect inserted text', () => {
      const oldText = 'Hello world'
      const newText = 'Hello beautiful world'

      const result = computeDiff(oldText, newText)

      expect(result).toContainEqual(expect.objectContaining({
        value: 'beautiful ',
        added: true,
      }))
    })

    it('should detect deleted text', () => {
      const oldText = 'Hello beautiful world'
      const newText = 'Hello world'

      const result = computeDiff(oldText, newText)

      expect(result).toContainEqual(expect.objectContaining({
        value: 'beautiful ',
        removed: true,
      }))
    })

    it('should return unchanged text for identical inputs', () => {
      const text = 'Hello world'
      const result = computeDiff(text, text)

      expect(result).toHaveLength(1)
      expect(result[0].added).toBeUndefined()
      expect(result[0].removed).toBeUndefined()
    })
  })

  describe('renderDiffHtml', () => {
    it('should render diff with green inserts and red deletes', () => {
      const oldText = 'Hello world'
      const newText = 'Hello beautiful world'

      const html = renderDiffHtml(oldText, newText)

      expect(html).toContain('background-color: rgba(0, 180, 0')
      expect(html).toContain('beautiful')
    })
  })
})
