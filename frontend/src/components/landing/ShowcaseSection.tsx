import { useScrollReveal } from '../../hooks/useScrollReveal'

export default function ShowcaseSection() {
  const labelRef = useScrollReveal()

  return (
    <section className="section-content">
      <div ref={labelRef} className="reveal">
        <p className="section-label">创作体验</p>
        <h2 className="section-title">从生成到成品，全程掌控</h2>
        <p className="section-subtitle">AI 生成不是终点——你审阅、修改、润色，每一步都在掌控之中。</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Novel excerpt */}
        <NovelCard />
        {/* Editor + AI Panel mockup */}
        <EditorMockCard />
      </div>
    </section>
  )
}

function NovelCard() {
  const ref = useScrollReveal()
  return (
    <div
      ref={ref}
      className="reveal reveal-d1"
      style={{ borderRadius: 20, overflow: 'hidden', background: 'rgba(255,255,255,0.6)', border: '1px solid var(--border-default, rgba(58,44,31,0.08))' }}
    >
      <div style={{ padding: '40px 36px' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'var(--text-muted, #a69a8d)', marginBottom: 16 }}>
          第三章 · 生成示例
        </div>
        <h3 style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 22, fontWeight: 500, marginBottom: 20 }}>
          迷雾中的灯火
        </h3>
        <div style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 15, lineHeight: 2, color: 'var(--text-secondary, #6b5a48)', textIndent: '2em' }}>
          <p>林远推开那扇锈蚀的铁门时，并不知道自己即将面对什么。</p>
          <br />
          <p>雨已经下了三天三夜，整座城市浸泡在灰蒙蒙的水汽里，像一块拧不干的旧毛巾。路灯的光晕在雨幕中<span style={{ background: 'linear-gradient(to top, rgba(192,107,78,0.15) 40%, transparent 40%)' }}>晕染成模糊的橘黄色圆点</span>，照在湿漉漉的柏油路上，反射出破碎的光斑。</p>
          <br />
          <p>他回头看了一眼——来时的脚印已经被雨水填满，变成一串深浅不一的水洼。</p>
          <br />
          <p style={{ fontSize: 12, color: 'var(--text-muted, #a69a8d)', textIndent: 0 }}>——《迷雾之城》节选 · Writer 生成 · Critic 评分 8.7/10</p>
        </div>
      </div>
    </div>
  )
}

function EditorMockCard() {
  const ref = useScrollReveal()
  return (
    <div
      ref={ref}
      className="reveal reveal-d2"
      style={{ borderRadius: 20, overflow: 'hidden', background: 'rgba(255,255,255,0.6)', border: '1px solid var(--border-default, rgba(58,44,31,0.08))' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%' }}>
        {/* Editor side */}
        <div style={{ padding: 28, background: 'linear-gradient(135deg, #e8f0ec, #d8e8e0)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {[1,2,3].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(0,0,0,0.1)' }} />)}
          </div>
          <div style={{ flex: 1 }}>
            {[100, 88, 72, 94, 55, 100, 80].map((w, i) => (
              <div key={i} style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.7)', marginBottom: 14, width: `${w}%` }} />
            ))}
          </div>
          <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--text-muted, #a69a8d)', letterSpacing: '0.1em' }}>
            Tiptap 编辑器 · 富文本写作
          </div>
        </div>
        {/* AI Panel side */}
        <div style={{ padding: 28, background: 'var(--bg-tertiary, rgba(255,255,255,0.6))', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, lineHeight: 1.7, padding: 16, borderRadius: 14, marginBottom: 12, background: 'var(--accent-primary, #5b7f6e)', color: 'white' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 6 }}>Critic 评审</div>
            人物一致性: 8/10<br />
            情节逻辑: 7/10<br />
            建议: 第三章林远的动机铺垫偏弱
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7, padding: 16, borderRadius: 14, background: 'white', border: '1px solid var(--border-default, rgba(58,44,31,0.08))', color: 'var(--text-secondary, #6b5a48)' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 6 }}>Revise 已修复</div>
            修改范围: 第12-15段<br />
            接缝平滑检查: 通过
          </div>
          <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--text-muted, #a69a8d)', letterSpacing: '0.1em' }}>
            AI 评审面板 · 实时反馈
          </div>
        </div>
      </div>
    </div>
  )
}
