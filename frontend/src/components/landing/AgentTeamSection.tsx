import { useState, useCallback, useEffect } from 'react'
import { useScrollReveal } from '../../hooks/useScrollReveal'

interface AgentDetail {
  name: string
  role: string
  desc: string
  icon: React.ReactNode
  iconBg: string
  details: {
    capabilities: string[]
    improvements: string[]
    highlight: string
  }
}

const agents: AgentDetail[] = [
  {
    name: 'Planner',
    role: '策划编辑',
    desc: '设定世界观、人物弧光、分章大纲与剧情路标。确保整体结构稳固且有戏剧张力。',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
    iconBg: '#e8f0ec',
    details: {
      highlight: '结构先行，故事自现',
      capabilities: [
        '世界观规则体系构建',
        '人物弧光与动机设计',
        '分章剧情路标规划',
        '伏笔与高潮布局',
        '多版本大纲对比生成',
      ],
      improvements: [
        'Scene Anchor 精度提升 60%',
        '支持迭代式大纲打磨',
        '与 NovelState 深度集成，设定自动同步',
      ],
    },
  },
  {
    name: 'Writer',
    role: '专职作家',
    desc: '流畅生成完整章节内容。按场景推进，保持视角、语气和节奏的一致性。',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a38b5a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
      </svg>
    ),
    iconBg: '#f0eadc',
    details: {
      highlight: '整章一气呵成，而非片段拼接',
      capabilities: [
        '完整章节连续生成',
        '多视角叙事控制',
        '场景节奏与密度管理',
        '人物语气一致性保持',
        '剧情路标精准抵达',
      ],
      improvements: [
        '上下文窗口拓展 2x',
        '长文本风格漂移降低 54%',
        '段落衔接自然度大幅提升',
      ],
    },
  },
  {
    name: 'Critic',
    role: '质量评审',
    desc: '多维度结构化诊断与打分。问题定位到 scene/span 粒度，给出可执行的修改建议。',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c06b4e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    iconBg: '#f5e6e0',
    details: {
      highlight: '定位到段落的问题，而非模糊的"感觉不对"',
      capabilities: [
        '人物一致性评审',
        '情节逻辑因果链检查',
        '情感曲线与张力评估',
        '语气与风格统一性诊断',
        '定位到 scene/span 粒度',
      ],
      improvements: [
        '结构化评分体系（0-10 六维）',
        '问题定位精确度提升 3.2x',
        '附带可执行修复指令',
      ],
    },
  },
  {
    name: 'Revise',
    role: '修订专家',
    desc: '精准定位问题区域，局部智能修复。配合 Stitching Pass 保证上下文连贯性。',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56"/><path d="M21 3v6h-6"/>
      </svg>
    ),
    iconBg: '#e8f0ec',
    details: {
      highlight: '最小修改代价，最大质量收益',
      capabilities: [
        '局部片段精准替换',
        'Stitching Pass 接缝平滑',
        '多轮迭代修复控制',
        '失败自动升级机制',
        '修复收益量化追踪',
      ],
      improvements: [
        '平均修复轮次 8→2 轮',
        '不再一刀切整章重写',
        '修复成功率提升至 89%',
      ],
    },
  },
]

function AgentOverlay({ agent, onClose }: { agent: AgentDetail; onClose: () => void }) {
  // close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 48,
        animation: 'overlayFadeIn 0.3s ease-out forwards',
      }}
      onClick={onClose}
    >
      {/* backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(250,247,242,0.92)',
        backdropFilter: 'blur(12px)',
      }} />

      {/* card */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: 640, width: '100%',
          background: 'white',
          borderRadius: 24,
          padding: '48px 44px 40px',
          boxShadow: '0 24px 64px rgba(60,40,20,0.12)',
          animation: 'cardSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
      >
        {/* close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 8, color: 'var(--text-muted, #a69a8d)',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary, #3a2c1f)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted, #a69a8d)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
          </svg>
        </button>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: agent.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {agent.icon}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 26, fontWeight: 500 }}>{agent.name}</div>
            <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-primary, #5b7f6e)', marginTop: 2 }}>{agent.role}</div>
          </div>
        </div>

        {/* highlight */}
        <div style={{
          padding: '14px 20px', borderRadius: 12,
          background: 'rgba(91,127,110,0.06)',
          border: '1px solid rgba(91,127,110,0.12)',
          fontSize: 14, color: 'var(--accent-primary, #5b7f6e)',
          fontStyle: 'italic', marginBottom: 28,
        }}>
          "{agent.details.highlight}"
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* capabilities */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted, #a69a8d)', marginBottom: 14 }}>核心能力</div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {agent.details.capabilities.map((c) => (
                <li key={c} style={{
                  fontSize: 14, color: 'var(--text-secondary, #6b5a48)',
                  padding: '5px 0 5px 18px', position: 'relative',
                  lineHeight: 1.6,
                }}>
                  <span style={{
                    position: 'absolute', left: 0, top: 10,
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--accent-primary, #5b7f6e)',
                    opacity: 0.4,
                  }} />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* improvements */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted, #a69a8d)', marginBottom: 14 }}>V3 改进</div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {agent.details.improvements.map((c) => (
                <li key={c} style={{
                  fontSize: 14, color: 'var(--text-primary, #3a2c1f)',
                  padding: '6px 0 6px 18px', position: 'relative',
                  lineHeight: 1.6, fontWeight: 450,
                }}>
                  <span style={{
                    position: 'absolute', left: 0, top: 12,
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--accent-primary, #5b7f6e)',
                  }} />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes overlayFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes cardSlideUp { from { opacity:0; transform:translateY(30px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
      `}</style>
    </div>
  )
}

export default function AgentTeamSection() {
  const labelRef = useScrollReveal()
  const gridRef = useScrollReveal()
  const [expanded, setExpanded] = useState<AgentDetail | null>(null)

  return (
    <section className="section-content" id="agents">
      <div ref={labelRef} className="reveal">
        <p className="section-label">创作团队</p>
        <h2 className="section-title">四位智能体，一个协作流程</h2>
        <p className="section-subtitle">从世界观构建到最终润色，每个环节由专精于此的智能体负责。<br />点击卡片查看详情。</p>
      </div>

      <div ref={gridRef} className="reveal reveal-d1" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {agents.map((a, i) => (
          <div
            key={a.name}
            className="agent-card"
            style={{ animationDelay: `${0.1 + i * 0.1}s`, cursor: 'pointer' }}
            onClick={() => setExpanded(a)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') setExpanded(a) }}
          >
            <div className="agent-icon" style={{ background: a.iconBg }}>{a.icon}</div>
            <div className="agent-name">{a.name}</div>
            <div className="agent-role">{a.role}</div>
            <div className="agent-desc">{a.desc}</div>
          </div>
        ))}
      </div>

      {/* overlay */}
      {expanded && <AgentOverlay agent={expanded} onClose={() => setExpanded(null)} />}
    </section>
  )
}
