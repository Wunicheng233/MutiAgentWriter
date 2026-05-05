import { buildRewritePrompt, RewriteMode } from '../utils/selectionAI'

describe('selectionAI', () => {
  describe('buildRewritePrompt', () => {
    const context = {
      projectName: '测试项目',
      chapterTitle: '第一章',
      precedingText: '这是前面的内容',
      selectedText: '这是选中的文本',
      characters: [
        { name: '李逍遥', personality: '乐观开朗' },
      ],
    }

    it('should build polish prompt correctly', () => {
      const prompt = buildRewritePrompt({
        ...context,
        mode: RewriteMode.POLISH,
      })

      expect(prompt).toContain('润色')
      expect(prompt).toContain('这是选中的文本')
      expect(prompt).toContain('李逍遥')
    })

    it('should build expand prompt correctly', () => {
      const prompt = buildRewritePrompt({
        ...context,
        mode: RewriteMode.EXPAND,
      })

      expect(prompt).toContain('扩写')
      expect(prompt).toContain('增加细节')
    })

    it('should build shorten prompt correctly', () => {
      const prompt = buildRewritePrompt({
        ...context,
        mode: RewriteMode.SHORTEN,
      })

      expect(prompt).toContain('缩写')
      expect(prompt).toContain('保持核心意思')
    })

    it('should build character voice prompt with character name', () => {
      const prompt = buildRewritePrompt({
        ...context,
        mode: RewriteMode.CHARACTER_VOICE,
        characterName: '李逍遥',
      })

      expect(prompt).toContain('李逍遥')
      expect(prompt).toContain('乐观开朗')
    })
  })
})
