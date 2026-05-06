import { useScrollReveal } from '../../hooks/useScrollReveal'

const steps = [
  { num: '01', title: '设定方向', desc: '告诉 Planner 你的故事构思，生成完整的世界观设定、人物小传和分章大纲。' },
  { num: '02', title: 'AI 创作', desc: 'Writer 生成完整章节 → Critic 多维评审 → Revise 精准修复，循环直至达标。' },
  { num: '03', title: '你审阅确认', desc: '满意就继续推进；不满意就提出修改意见，系统按反馈定向优化。' },
  { num: '04', title: '持续进化', desc: 'Hermes 自动提炼经验、注册技能，下次写作时动态注入最相关的技能。' },
]

export default function WorkflowSection() {
  const labelRef = useScrollReveal()

  return (
    <section className="section-content" id="workflow">
      <div ref={labelRef} className="reveal">
        <p className="section-label">创作流程</p>
        <h2 className="section-title">从灵感到成稿，四步之遥</h2>
        <p className="section-subtitle">每章都是一个完整的 PDCA 循环。</p>
      </div>

      <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
        {steps.map((s, i) => (
          <StepCard key={s.num} {...s} index={i} />
        ))}
      </div>
    </section>
  )
}

function StepCard({ num, title, desc, index }: { num: string; title: string; desc: string; index: number }) {
  const ref = useScrollReveal()
  return (
    <div
      ref={ref}
      className="reveal"
      style={{
        flex: 1,
        textAlign: 'center',
        padding: '0 24px',
        position: 'relative',
        transitionDelay: `${index * 0.1}s`,
      }}
    >
      {index < 3 && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 28,
          width: 'calc(100% - 80px)',
          height: 1,
          background: 'var(--border-strong, rgba(58,44,31,0.15))',
          pointerEvents: 'none',
        }} />
      )}
      <div className="step-num">{num}</div>
      <h3 className="step-title">{title}</h3>
      <p className="step-desc">{desc}</p>
    </div>
  )
}
