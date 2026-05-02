import { describe, expect, test } from 'vitest'
import {
  chapterContentToEditorHtml,
  plainTextToSafeHtml,
} from './safeContent'

describe('safeContent editor normalization', () => {
  test('把单个 HTML 段落里的换行恢复为编辑器段落', () => {
    const html = chapterContentToEditorHtml('<p>第一段。\n第二段。</p>')

    expect(html).toBe('<p>第一段。</p><p>第二段。</p>')
  })

  test('把没有换行的长小说正文按句群拆成多个段落', () => {
    const longText = [
      '消毒水的味道钻进鼻腔时，许知远正在做一个关于实验室的梦。',
      '梦里是没有窗户的白色走廊，蓝光扫过皮肤的凉意，还有一串模糊的数字在眼前反复跳动。',
      '他猛地睁开眼，白色的天花板、白色的墙面、白色的窗帘，一切都是熟悉的诊疗室布置。',
      '诊桌边缘有他常年握鼠标磨出的浅痕，左手边的半杯大麦茶凉透了，杯壁的水渍圈和他上次醒来时的位置分毫不差。',
      '他撑着桌面起身，指节因为用力泛出青白。',
    ].join('').repeat(2)

    const html = plainTextToSafeHtml(longText)
    const paragraphCount = html.match(/<p>/g)?.length ?? 0

    expect(paragraphCount).toBeGreaterThan(1)
    expect(html).toContain('消毒水的味道钻进鼻腔')
    expect(html).toContain('指节因为用力泛出青白')
  })

  test('保留已经分好的多个 HTML 段落', () => {
    const html = chapterContentToEditorHtml('<p>第一段。</p><p>第二段。</p>')

    expect(html).toBe('<p>第一段。</p><p>第二段。</p>')
  })
})
