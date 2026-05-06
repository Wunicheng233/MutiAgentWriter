import { useScrollReveal } from '../../hooks/useScrollReveal'

const audiences = [
  {
    title: '网络文学作家',
    desc: '日更万字，保持质量稳定。不再为卡文和前后矛盾烦恼。',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 4L8 12v16l12 8 12-8V12L20 4z"/>
      </svg>
    ),
  },
  {
    title: '出版作者',
    desc: '长篇架构，连贯叙事。让 AI 处理伏笔回收和时间线管理。',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8h16"/><path d="M12 16h16"/><path d="M12 24h10"/>
      </svg>
    ),
  },
  {
    title: '写作爱好者',
    desc: '把脑海中盘旋的故事变成完整的作品，体验创作的成就感。',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="20" r="8"/><path d="M20 12v8l4 4"/>
      </svg>
    ),
  },
  {
    title: '内容创作者',
    desc: '剧本、同人、世界观设定——结构化工具帮你快速落地创意。',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 30L30 10"/><circle cx="12" cy="28" r="3"/><circle cx="28" cy="12" r="3"/>
      </svg>
    ),
  },
]

export default function TargetAudience() {
  const labelRef = useScrollReveal()

  return (
    <section className="section-content">
      <div ref={labelRef} className="reveal">
        <p className="section-label">适合这样的你</p>
        <h2 className="section-title">无论你是哪种创作者</h2>
        <p className="section-subtitle">StoryForge AI 为不同写作场景提供专业支持。</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        {audiences.map((a, i) => (
          <AudienceCard key={a.title} {...a} delay={i} />
        ))}
      </div>
    </section>
  )
}

function AudienceCard({ title, desc, icon, delay }: { title: string; desc: string; icon: React.ReactNode; delay: number }) {
  const ref = useScrollReveal()
  return (
    <div
      ref={ref}
      className="reveal"
      style={{
        textAlign: 'center',
        padding: '32px 20px',
        borderRadius: 16,
        border: '1px solid var(--border-default, rgba(58,44,31,0.08))',
        background: 'rgba(255,255,255,0.6)',
        transitionDelay: `${delay * 0.1}s`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.borderColor = 'var(--accent-gold, #a38b5a)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.borderColor = ''
      }}
    >
      <div style={{ width: 40, height: 40, margin: '0 auto 20px' }}>{icon}</div>
      <h3 style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 17, fontWeight: 500, marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary, #6b5a48)', lineHeight: 1.7 }}>{desc}</p>
    </div>
  )
}
