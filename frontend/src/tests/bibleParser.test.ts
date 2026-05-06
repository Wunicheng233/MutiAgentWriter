import { parseCharactersFromPlan, parseWorldFromPlan } from '../utils/bibleParser'

describe('bibleParser', () => {
  describe('parseCharactersFromPlan', () => {
    it('should extract character names from character list', () => {
      const planText = `
## 角色设定

### 李逍遥
- 身份：蜀山弟子
- 性格：乐观开朗
- 口头禅：吃到老，玩到老

### 赵灵儿
- 身份：女娲后人
- 性格：温柔善良
`
      const result = parseCharactersFromPlan(planText)

      expect(result.some((c) => c.name === '李逍遥')).toBe(true)
      expect(result.some((c) => c.name === '赵灵儿')).toBe(true)
    })

    it('should extract personality descriptions', () => {
      const planText = `
## 角色设定

### 李逍遥
- 性格：乐观开朗，仗义疏财，爱打抱不平
- 身份：蜀山掌门
`
      const result = parseCharactersFromPlan(planText)
      const li = result.find((c) => c.name === '李逍遥')

      expect(li?.personality).toContain('乐观开朗')
    })

    it('should mark protagonist correctly', () => {
      const planText = `
## 主角

### 李逍遥
- 身份：蜀山弟子，故事的主角。
`
      const result = parseCharactersFromPlan(planText)
      const li = result.find((c) => c.name === '李逍遥')

      expect(li?.isMainCharacter).toBe(true)
      expect(li?.role).toBe('protagonist')
    })

    it('should return empty array when no characters found', () => {
      const planText = '这是一段没有角色的文本'
      const result = parseCharactersFromPlan(planText)

      expect(result).toEqual([])
    })
  })

  describe('parseWorldFromPlan', () => {
    it('should extract power system description', () => {
      const planText = `
## 世界观设定

### 力量体系
练气 → 筑基 → 金丹 → 元婴 → 化神
每个大境界分为初、中、后、圆满四个小阶段。
`
      const result = parseWorldFromPlan(planText)

      expect(result.powerSystem).toContain('练气')
      expect(result.powerSystem).toContain('化神')
    })
  })
})
