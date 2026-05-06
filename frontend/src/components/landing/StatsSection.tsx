import { useEffect, useRef, useState } from 'react'
import { useScrollReveal } from '../../hooks/useScrollReveal'

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
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

const stats = [
  { target: 50000, suffix: '+', label: '已生成字数' },
  { target: 128, suffix: '', label: '已完成章节' },
  { target: 97, suffix: '%', label: '用户满意度' },
]

export default function StatsSection() {
  return (
    <div style={{ padding: '72px 48px', textAlign: 'center', position: 'relative', zIndex: 1, background: 'linear-gradient(180deg, #faf7f2 0%, rgba(192,107,78,0.03) 50%, #faf7f2 100%)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48, maxWidth: 800, margin: '0 auto' }}>
        {stats.map((s, i) => (
          <div key={s.label} className="reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
            <div style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 500, color: 'var(--accent-primary, #5b7f6e)', lineHeight: 1 }}>
              <CountUp target={s.target} suffix={s.suffix} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted, #a69a8d)', marginTop: 12, letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
