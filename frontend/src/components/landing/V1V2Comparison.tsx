import { useEffect, useRef, useState } from 'react'
import { useScrollReveal } from '../../hooks/useScrollReveal'

function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [val, setVal] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    let current = 0
    const step = Math.max(1, Math.floor(target / 60))
    const timer = setInterval(() => {
      current += step
      if (current >= target) {
        current = target
        clearInterval(timer)
      }
      setVal(current)
    }, 25)
    return () => clearInterval(timer)
  }, [started, target])

  return <div ref={ref}>{val}{suffix}</div>
}

export default function V1V2Comparison() {
  const labelRef = useScrollReveal()
  const contentRef = useScrollReveal()
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.querySelectorAll('.chart-line').forEach((l) => l.classList.add('animate'))
          el.querySelectorAll('.chart-area').forEach((l) => l.classList.add('animate'))
          observer.unobserve(el)
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="section-content" id="features" style={{ maxWidth: '100%' }}>
      <div ref={labelRef} className="reveal">
        <p className="section-label">质量进化</p>
        <h2 className="section-title">从 V1 到 V3：质的飞跃</h2>
        <p className="section-subtitle" style={{ marginBottom: 40 }}>结构化质量闭环让 Critic v3 在持续迭代中不断提升，而非原地踏步。</p>
      </div>

      <div ref={contentRef} className="reveal reveal-d1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
        {/* Text */}
        <div style={{ paddingLeft: 72 }}>
          <h3 style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 24, fontWeight: 500, marginBottom: 16 }}>
            Critic v3 的持续进化
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #6b5a48)', lineHeight: 1.8, marginBottom: 28 }}>
            V1 版本在各轮生成中质量评分停滞——修复没有积累，每次都是独立判断。
            <br /><br />
            V3 引入结构化修复轨迹 + Hermes 自我进化系统。Critic 问题定位精确到段落，Revise 执行局部替换而非整体重写，每轮修复都是 PDCA 循环中的一环。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { target: 47, suffix: '%', label: 'V3 质量评分提升幅度' },
              { target: 32, suffix: 'x', label: '问题定位精确度' },
              { target: 8, suffix: '', label: 'V1 平均修复轮次' },
              { target: 2, suffix: '', label: 'V3 平均修复轮次' },
            ].map((s) => (
              <div key={s.label} style={{ padding: 18, borderRadius: 12, background: 'rgba(255,255,255,0.6)', border: '1px solid var(--border-default, rgba(58,44,31,0.08))' }}>
                <div style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 28, fontWeight: 500, color: 'var(--accent-primary, #5b7f6e)' }}>
                  <AnimatedNumber target={s.target} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #a69a8d)', marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Chart */}
        <div ref={chartRef} className="chart-container" style={{ width: '100%', marginLeft: -80, marginTop: 80 }}>
          <svg viewBox="0 0 420 340" style={{ width: '100%', height: 'auto', maxHeight: 470 }}>
            <defs>
              <linearGradient id="v3g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5b7f6e" stopOpacity="0.12"/>
                <stop offset="100%" stopColor="#5b7f6e" stopOpacity="0"/>
              </linearGradient>
              <linearGradient id="v1g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d0c8bc" stopOpacity="0.08"/>
                <stop offset="100%" stopColor="#d0c8bc" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <line x1="60" y1="60" x2="60" y2="270" stroke="#e8ddd0" strokeWidth="1"/>
            <line x1="60" y1="270" x2="390" y2="270" stroke="#e8ddd0" strokeWidth="1"/>
            <line x1="60" y1="102" x2="390" y2="102" stroke="#e8ddd0" strokeWidth="0.5" strokeDasharray="4,4"/>
            <line x1="60" y1="144" x2="390" y2="144" stroke="#e8ddd0" strokeWidth="0.5" strokeDasharray="4,4"/>
            <line x1="60" y1="186" x2="390" y2="186" stroke="#e8ddd0" strokeWidth="0.5" strokeDasharray="4,4"/>
            <line x1="60" y1="228" x2="390" y2="228" stroke="#e8ddd0" strokeWidth="0.5" strokeDasharray="4,4"/>
            {/* Y labels 0–10 */}
            <text x="55" y="274" textAnchor="end" fontSize="11" fill="#a69a8d">0</text>
            <text x="55" y="232" textAnchor="end" fontSize="11" fill="#a69a8d">2</text>
            <text x="55" y="190" textAnchor="end" fontSize="11" fill="#a69a8d">4</text>
            <text x="55" y="148" textAnchor="end" fontSize="11" fill="#a69a8d">6</text>
            <text x="55" y="106" textAnchor="end" fontSize="11" fill="#a69a8d">8</text>
            <text x="55" y="64" textAnchor="end" fontSize="11" fill="#a69a8d">10</text>
            {/* X labels */}
            <text x="60" y="290" textAnchor="middle" fontSize="10" fill="#a69a8d">R1</text>
            <text x="126" y="290" textAnchor="middle" fontSize="10" fill="#a69a8d">R2</text>
            <text x="192" y="290" textAnchor="middle" fontSize="10" fill="#a69a8d">R3</text>
            <text x="258" y="290" textAnchor="middle" fontSize="10" fill="#a69a8d">R4</text>
            <text x="324" y="290" textAnchor="middle" fontSize="10" fill="#a69a8d">R5</text>
            <text x="390" y="290" textAnchor="middle" fontSize="10" fill="#a69a8d">R6</text>

            {/* V1 area + line — separate classes so line draws solid and remains dashed */}
            <path className="chart-area" d="M60,137 L126,130 L192,139 L258,126 L324,135 L390,128 L390,270 L60,270 Z" fill="url(#v1g)"/>
            <polyline points="60,137 126,130 192,139 258,126 324,135 390,128" fill="none" stroke="#c8b8a8" strokeWidth="2.5"/>
            {[[60,137],[126,130],[192,139],[258,126],[324,135],[390,128]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="4.5" fill="#c8b8a8"/>)}
            {/* V3 area + line — starts close to V1, rises gradually, flattens at ~9 */}
            <path className="chart-area" d="M60,148 L126,128 L192,110 L258,97 L324,89 L390,82 L390,270 L60,270 Z" fill="url(#v3g)"/>
            <polyline points="60,148 126,128 192,110 258,97 324,89 390,82" fill="none" stroke="#5b7f6e" strokeWidth="3" strokeLinejoin="round"/>
            {[[60,148],[126,128],[192,110],[258,97],[324,89],[390,82]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="5" fill="#5b7f6e"/>)}
            {/* Labels */}
            <text x="235" y="170" textAnchor="middle" fontSize="12" fill="#a69a8d" fontWeight="500">V1 原地徘徊</text>
            <text x="320" y="70" textAnchor="middle" fontSize="12" fill="#5b7f6e" fontWeight="500">V3 稳步突破 ↗</text>
            {/* Legend */}
            <rect x="80" y="12" width="16" height="2" rx="1" fill="#c8b8a8"/>
            <text x="100" y="17" fontSize="11" fill="#a69a8d">V1</text>
            <rect x="145" y="12" width="16" height="2" rx="1" fill="#5b7f6e"/>
            <text x="165" y="17" fontSize="11" fill="#5b7f6e">V3</text>
          </svg>
        </div>
      </div>
    </section>
  )
}
