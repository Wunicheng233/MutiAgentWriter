import { useState, useRef, useCallback, useEffect } from 'react'
import { useScrollReveal } from '../../hooks/useScrollReveal'

interface FeatureDetail {
  title: string
  desc: string
  icon: React.ReactNode
  expandedDesc: string
  diagram: React.ReactNode
  highlights: string[]
}

const features: FeatureDetail[] = [
  {
    title: '连贯创作记忆',
    desc: 'NovelState 动态状态追踪系统，自动记录角色、时间线、伏笔和文风变化。向量语义检索，智能关联前文内容。',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="16" r="12"/><path d="M16 10v6l4 4"/>
      </svg>
    ),
    expandedDesc: '传统 AI 写作每次生成都是独立会话，不记得前文写过什么。NovelState 持续追踪每一个叙事要素的变化，让 Writer 每一章都在完整的上下文中创作。',
    highlights: ['章节写前/写后快照', '向量语义检索前文', '零 Token 状态验证', '跨章伏笔自动追踪'],
    diagram: (
      <svg viewBox="0 0 340 100" style={{ width: '100%', height: 'auto' }}>
        <rect x="10" y="30" width="60" height="40" rx="8" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="40" y="55" textAnchor="middle" fontSize="11" fill="#5b7f6e" fontWeight="500">章节</text>
        <path d="M70,50 L90,50" stroke="#5b7f6e" strokeWidth="1.2" markerEnd="url(#f1a)"/>
        <rect x="90" y="30" width="70" height="40" rx="8" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="125" y="55" textAnchor="middle" fontSize="11" fill="#6b5a48" fontWeight="500">NovelState</text>
        <path d="M160,50 L180,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="180" y="30" width="70" height="40" rx="8" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="215" y="55" textAnchor="middle" fontSize="11" fill="#5b7f6e" fontWeight="500">向量库</text>
        <path d="M250,50 L270,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="270" y="30" width="60" height="40" rx="8" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="300" y="55" textAnchor="middle" fontSize="11" fill="#6b5a48" fontWeight="500">Writer</text>
        <path d="M125,70 L125,85 L40,85 L40,70" stroke="#c8b8a8" strokeWidth="1" strokeDasharray="3,3" fill="none"/>
        <defs><marker id="f1a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#5b7f6e"/></marker></defs>
      </svg>
    ),
  },
  {
    title: '人机共创模式',
    desc: '支持策划方案和章节级确认机制。你掌控创作方向，AI 负责执行。按反馈定向优化，而非推倒重来。',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4v24"/><path d="M8 12l8-4 8 4"/><path d="M8 20l8 4 8-4"/>
      </svg>
    ),
    expandedDesc: '你不是在让 AI 替你写作，而是在和一支 AI 创作团队协作。你把握方向——审批策划、确认章节——AI 负责执行。不满意就提意见，按反馈定向优化。',
    highlights: ['策划方案审批机制', '章节级确认/驳回', '定向反馈优化', '人机分工明确'],
    diagram: (
      <svg viewBox="0 0 340 100" style={{ width: '100%', height: 'auto' }}>
        <rect x="20" y="30" width="60" height="40" rx="20" fill="#f5e6e0" stroke="#c06b4e" strokeWidth="1.2"/>
        <text x="50" y="55" textAnchor="middle" fontSize="11" fill="#c06b4e" fontWeight="500">你</text>
        <path d="M80,50 L100,50" stroke="#c06b4e" strokeWidth="1.2"/>
        <rect x="100" y="20" width="60" height="60" rx="8" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="130" y="48" textAnchor="middle" fontSize="10" fill="#6b5a48">确认</text>
        <text x="130" y="62" textAnchor="middle" fontSize="10" fill="#6b5a48">/ 驳回</text>
        <path d="M160,50 L180,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="180" y="30" width="60" height="40" rx="8" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="210" y="55" textAnchor="middle" fontSize="11" fill="#5b7f6e" fontWeight="500">AI 团队</text>
        <path d="M210,70 L210,92 L130,92 L130,80" stroke="#5b7f6e" strokeWidth="1" strokeDasharray="3,3" fill="none"/>
        <text x="170" y="90" textAnchor="middle" fontSize="10" fill="#a69a8d">反馈优化</text>
      </svg>
    ),
  },
  {
    title: '结构化质量闭环',
    desc: 'Critic 多维度评审，问题定位到 scene/span 粒度。局部修复只替换目标片段，Stitching Pass 保证连贯性。',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="16" r="12"/><path d="M12 16l3 3 5-6"/>
      </svg>
    ),
    expandedDesc: 'Critic 从人物、情节、情感、逻辑六个维度结构化评审，精准定位到具体段落。Revise 只替换问题区域，Stitching Pass 保证修改处与上下文无缝衔接。',
    highlights: ['六维评分体系', 'scene/span 粒度定位', '局部替换非重写', 'Stitching 接缝检查'],
    diagram: (
      <svg viewBox="0 0 340 100" style={{ width: '100%', height: 'auto' }}>
        <defs><marker id="f3a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#5b7f6e"/></marker></defs>
        <rect x="10" y="30" width="70" height="40" rx="8" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="45" y="55" textAnchor="middle" fontSize="11" fill="#6b5a48" fontWeight="500">Writer</text>
        <path d="M80,50 L100,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="100" y="15" width="60" height="70" rx="8" fill="#f5e6e0" stroke="#c06b4e" strokeWidth="1.2"/>
        <text x="130" y="38" textAnchor="middle" fontSize="11" fill="#c06b4e" fontWeight="500">Critic</text>
        <text x="130" y="55" textAnchor="middle" fontSize="9" fill="#c06b4e">六维评审</text>
        <text x="130" y="70" textAnchor="middle" fontSize="9" fill="#c06b4e">定位问题</text>
        <path d="M160,50 L180,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="180" y="30" width="60" height="40" rx="8" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="210" y="48" textAnchor="middle" fontSize="11" fill="#5b7f6e" fontWeight="500">Revise</text>
        <text x="210" y="62" textAnchor="middle" fontSize="9" fill="#5b7f6e">局部修复</text>
        <path d="M240,50 L260,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="260" y="30" width="70" height="40" rx="8" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="295" y="48" textAnchor="middle" fontSize="10" fill="#6b5a48">Stitching</text>
        <text x="295" y="62" textAnchor="middle" fontSize="10" fill="#6b5a48">接缝检查</text>
        <path d="M130,85 L130,100 L295,100 L295,70" stroke="#c8b8a8" strokeWidth="1" strokeDasharray="3,3" fill="none"/>
        <text x="200" y="97" textAnchor="middle" fontSize="10" fill="#a69a8d">未达标则循环</text>
      </svg>
    ),
  },
  {
    title: 'Hermes 自我进化',
    desc: '每次生成后自动从 Critic 低分、用户反馈中提炼经验→蒸馏技能→注册到技能库。系统越用越懂你的风格。',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 28L16 4l12 24"/><circle cx="16" cy="20" r="2" fill="#5b7f6e"/>
      </svg>
    ),
    expandedDesc: '每次章节生成后，系统自动审查 Critic 低分项和用户修改，提炼为可复用的写作技能，索引到向量库中。下次写作时自动注入最相关的技能，越用越懂你。',
    highlights: ['自动提炼写作经验', '结构化技能蒸馏', '向量库动态检索', '置信度分级注册'],
    diagram: (
      <svg viewBox="0 0 340 100" style={{ width: '100%', height: 'auto' }}>
        <defs><marker id="f4a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#5b7f6e"/></marker></defs>
        <rect x="5" y="30" width="55" height="40" rx="8" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="32" y="55" textAnchor="middle" fontSize="10" fill="#6b5a48" fontWeight="500">生成</text>
        <path d="M60,50 L75,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="75" y="30" width="55" height="40" rx="8" fill="#f5e6e0" stroke="#c06b4e" strokeWidth="1.2"/>
        <text x="102" y="48" textAnchor="middle" fontSize="10" fill="#c06b4e">提取经验</text>
        <text x="102" y="62" textAnchor="middle" fontSize="10" fill="#c06b4e">+ 反馈</text>
        <path d="M130,50 L145,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="145" y="30" width="55" height="40" rx="8" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="172" y="48" textAnchor="middle" fontSize="10" fill="#5b7f6e">技能蒸馏</text>
        <text x="172" y="62" textAnchor="middle" fontSize="10" fill="#5b7f6e">→ 注册</text>
        <path d="M200,50 L215,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="215" y="30" width="55" height="40" rx="8" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="242" y="48" textAnchor="middle" fontSize="10" fill="#6b5a48">技能库</text>
        <text x="242" y="62" textAnchor="middle" fontSize="10" fill="#6b5a48">(向量)</text>
        <path d="M270,50 L285,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="285" y="30" width="50" height="40" rx="8" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="310" y="55" textAnchor="middle" fontSize="10" fill="#5b7f6e" fontWeight="500">注入</text>
        <path d="M102,70 L102,85 L310,85 L310,70" stroke="#c8b8a8" strokeWidth="1" strokeDasharray="3,3" fill="none"/>
      </svg>
    ),
  },
  {
    title: '多智能体编排',
    desc: '四个专职 Agent（Planner → Writer → Critic → Revise）按流程协作，各自使用独立优化的提示词和模型参数。',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 24a8 8 0 100-16 8 8 0 000 16z"/><path d="M22 20l6 6"/>
      </svg>
    ),
    expandedDesc: '四个 Agent 各自使用独立优化的提示词和模型参数，按 PDCA 循环协作。Planner 策划 → Writer 执行 → Critic 检查 → Revise 改进，每轮都是一次完整的质量循环。',
    highlights: ['Agent 独立提示词优化', 'PDCA 协作循环', 'Failure Router 智能路由', '多模型混合编排'],
    diagram: (
      <svg viewBox="0 0 340 100" style={{ width: '100%', height: 'auto' }}>
        <rect x="5" y="30" width="60" height="40" rx="20" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="35" y="55" textAnchor="middle" fontSize="11" fill="#5b7f6e" fontWeight="500">计划 P</text>
        <path d="M65,50 L85,50" stroke="#5b7f6e" strokeWidth="1.5"/>
        <rect x="85" y="30" width="60" height="40" rx="20" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="115" y="55" textAnchor="middle" fontSize="11" fill="#6b5a48" fontWeight="500">执行 D</text>
        <path d="M145,50 L165,50" stroke="#5b7f6e" strokeWidth="1.5"/>
        <rect x="165" y="30" width="60" height="40" rx="20" fill="#f5e6e0" stroke="#c06b4e" strokeWidth="1.2"/>
        <text x="195" y="55" textAnchor="middle" fontSize="11" fill="#c06b4e" fontWeight="500">检查 C</text>
        <path d="M225,50 L245,50" stroke="#5b7f6e" strokeWidth="1.5"/>
        <rect x="245" y="30" width="60" height="40" rx="20" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="275" y="55" textAnchor="middle" fontSize="11" fill="#5b7f6e" fontWeight="500">改进 A</text>
        <path d="M275,70 L275,85 L35,85 L35,70" stroke="#c8b8a8" strokeWidth="1" strokeDasharray="3,3" fill="none"/>
      </svg>
    ),
  },
  {
    title: '动态叙事管理',
    desc: 'NovelState 持续追踪角色、时间线、伏笔、世界观变迁。State Validator 在零 token 消耗下拦截硬错误。',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="#5b7f6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8h24"/><path d="M4 16h24"/><path d="M4 24h24"/>
      </svg>
    ),
    expandedDesc: '每章生成前，Pre-write Context 为 Writer 提供完整的状态快照。生成后 State Validator 以零 token 成本拦截硬错误——角色名字写错、时间线矛盾、设定偏离——保证不偏离叙事逻辑。',
    highlights: ['写前状态快照', '零 Token 硬错误拦截', '角色/时间线/伏笔追踪', '世界观变迁记录'],
    diagram: (
      <svg viewBox="0 0 340 100" style={{ width: '100%', height: 'auto' }}>
        <rect x="10" y="30" width="70" height="40" rx="8" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="45" y="48" textAnchor="middle" fontSize="10" fill="#5b7f6e">Pre-write</text>
        <text x="45" y="62" textAnchor="middle" fontSize="10" fill="#5b7f6e">快照</text>
        <path d="M80,50 L100,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="100" y="30" width="70" height="40" rx="8" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="135" y="55" textAnchor="middle" fontSize="11" fill="#6b5a48" fontWeight="500">Writer</text>
        <path d="M170,50 L190,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="190" y="15" width="70" height="70" rx="8" fill="#e8f0ec" stroke="#5b7f6e" strokeWidth="1.2"/>
        <text x="225" y="38" textAnchor="middle" fontSize="10" fill="#5b7f6e" fontWeight="500">Validator</text>
        <text x="225" y="55" textAnchor="middle" fontSize="9" fill="#5b7f6e">0 Token</text>
        <text x="225" y="70" textAnchor="middle" fontSize="9" fill="#5b7f6e">硬错误拦截</text>
        <path d="M260,50 L280,50" stroke="#5b7f6e" strokeWidth="1.2"/>
        <rect x="280" y="30" width="55" height="40" rx="8" fill="rgba(255,255,255,0.6)" stroke="#c8b8a8" strokeWidth="1.2"/>
        <text x="307" y="55" textAnchor="middle" fontSize="11" fill="#6b5a48" fontWeight="500">通过</text>
        <path d="M225,85 L225,100 L135,100 L135,70" stroke="#c8b8a8" strokeWidth="1" strokeDasharray="3,3" fill="none"/>
        <text x="180" y="97" textAnchor="middle" fontSize="10" fill="#a69a8d">未通过则修正</text>
      </svg>
    ),
  },
]

/* ------------------ Overlay ------------------ */
function FeatureOverlay({ feature, gridRect, originRect, onClose }: {
  feature: FeatureDetail
  gridRect: DOMRect
  originRect: DOMRect
  onClose: () => void
}) {
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
      }}
      onClick={onClose}
    >
      {/* backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(250,247,242,0.85)',
        backdropFilter: 'blur(8px)',
        animation: 'overlayFade 0.3s ease-out forwards',
      }} />

      {/* expanded card — animates from card origin to grid rect */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: gridRect.left,
          top: gridRect.top,
          width: gridRect.width,
          height: gridRect.height,
          background: 'white',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(60,40,20,0.12)',
          padding: '40px 44px',
          display: 'flex',
          flexDirection: 'column',
          animation: 'expandCard 0.9s cubic-bezier(0.16,1,0.3,1) forwards',
          transformOrigin: `${originRect.left - gridRect.left + originRect.width/2}px ${originRect.top - gridRect.top + originRect.height/2}px`,
          overflow: 'hidden',
        }}
      >
        {/* close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 6, color: 'var(--text-muted, #a69a8d)', zIndex: 2,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
          </svg>
        </button>

        {/* content - appears with delay */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 20,
          flex: 1, opacity: 0, animation: 'contentFade 0.4s ease-out 0.5s forwards',
        }}>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--sage-light, #e8f0ec)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 24, height: 24 }}>{feature.icon}</div>
            </div>
            <h3 style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 22, fontWeight: 500, margin: 0 }}>{feature.title}</h3>
          </div>

          {/* body: text + diagram side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 32, flex: 1, alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary, #6b5a48)', lineHeight: 1.8, margin: '0 0 20px 0' }}>
                {feature.expandedDesc}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {feature.highlights.map((h) => (
                  <div key={h} style={{
                    fontSize: 13, color: 'var(--text-primary, #3a2c1f)',
                    padding: '8px 12px', borderRadius: 8,
                    background: 'var(--parchment, #faf7f2)',
                    lineHeight: 1.4,
                  }}>
                    {h}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: 12, padding: 20, background: 'rgba(250,247,242,0.5)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>工作流程</div>
              {feature.diagram}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes overlayFade { from { opacity:0 } to { opacity:1 } }
        @keyframes expandCard {
          from { transform: scale(0.3); opacity: 0; border-radius: 60px; }
          to   { transform: scale(1); opacity: 1; border-radius: 20px; }
        }
        @keyframes contentFade { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  )
}

export default function FeatureCards() {
  const labelRef = useScrollReveal()
  const gridRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<{ feature: FeatureDetail; originRect: DOMRect } | null>(null)

  const handleClose = useCallback(() => setExpanded(null), [])

  const handleCardClick = (feature: FeatureDetail, cardEl: HTMLElement) => {
    const grid = gridRef.current
    if (!grid) return
    const originRect = cardEl.getBoundingClientRect()
    setExpanded({ feature, originRect })
  }

  return (
    <section className="section-content">
      <div ref={labelRef} className="reveal">
        <p className="section-label">核心能力</p>
        <h2 className="section-title">为长篇叙事而生</h2>
        <p className="section-subtitle">专为十万字以上作品设计的记忆、评审和状态管理系统。<br />点击卡片查看详情。</p>
      </div>

      <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, position: 'relative' }}>
        {features.map((f, i) => (
          <FeatureCard
            key={f.title}
            feature={f}
            delay={i}
            onClick={handleCardClick}
          />
        ))}
      </div>

      {expanded && gridRef.current && (
        <FeatureOverlay
          feature={expanded.feature}
          gridRect={gridRef.current.getBoundingClientRect()}
          originRect={expanded.originRect}
          onClose={handleClose}
        />
      )}
    </section>
  )
}

function FeatureCard({ feature, delay, onClick }: {
  feature: FeatureDetail
  delay: number
  onClick: (feature: FeatureDetail, el: HTMLElement) => void
}) {
  const ref = useScrollReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className="reveal"
      role="button"
      tabIndex={0}
      onClick={() => { if (ref.current) onClick(feature, ref.current) }}
      onKeyDown={(e) => { if (e.key === 'Enter' && ref.current) onClick(feature, ref.current) }}
      style={{
        padding: '40px 32px', textAlign: 'center', borderRadius: 16,
        background: 'rgba(255,255,255,0.6)',
        border: '1px solid var(--border-default, rgba(58,44,31,0.08))',
        transitionDelay: `${delay * 0.1}s`,
        cursor: 'pointer',
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(60,40,20,0.07)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <div style={{ width: 36, height: 36, margin: '0 auto 24px' }}>{feature.icon}</div>
      <h3 style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 20, fontWeight: 500, marginBottom: 16 }}>{feature.title}</h3>
      <p style={{ fontSize: 14, color: 'var(--text-secondary, #6b5a48)', lineHeight: 1.8 }}>{feature.desc}</p>
    </div>
  )
}
