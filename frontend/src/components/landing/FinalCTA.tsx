import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export default function FinalCTA() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const ref = useScrollReveal()
  const ref1 = useScrollReveal()
  const ref2 = useScrollReveal()

  const handleCTA = () => {
    navigate(isAuthenticated() ? '/dashboard' : '/login')
  }

  return (
    <section style={{ textAlign: 'center', padding: '140px 48px', position: 'relative', zIndex: 1 }}>
      <div ref={ref} className="reveal">
        <h2 style={{ fontFamily: 'var(--font-display, "Crimson Pro", serif)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 500, color: 'var(--text-primary, #3a2c1f)', maxWidth: 600, margin: '0 auto 16px', lineHeight: 1.4 }}>
          准备好开始你的第一个故事了吗？
        </h2>
      </div>
      <div ref={ref1} className="reveal reveal-d1">
        <p style={{ fontSize: 16, color: 'var(--text-secondary, #6b5a48)', maxWidth: 480, margin: '0 auto 44px', lineHeight: 1.8 }}>
          无需复杂配置，注册即可开始创作。
        </p>
      </div>
      <div ref={ref2} className="reveal reveal-d2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button onClick={handleCTA} className="btn-pri" style={{ fontSize: 16, padding: '18px 56px' }}>
          开始创作
        </button>
        <a
          href="https://github.com/Wunicheng233/MultiAgentWriter/blob/main/docs/product-documentation.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[var(--text-secondary)] no-underline px-6 py-4 hover:text-[var(--text-primary)] transition-colors"
        >
          了解更多 →
        </a>
      </div>
    </section>
  )
}
