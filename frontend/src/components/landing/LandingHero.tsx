import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export default function LandingHero() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const heroRef = useScrollReveal<HTMLDivElement>()

  const handleCTA = () => {
    navigate(isAuthenticated() ? '/dashboard' : '/login')
  }

  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center px-12 py-28 text-center overflow-hidden bg-[linear-gradient(145deg,#faf7f2_0%,#f0e8dc_25%,#e8ddd0_50%,#d8e8e0_75%,#c8d8d0_100%)]">
      {/* Glow orbs */}
      <div className="absolute rounded-full pointer-events-none blur-[120px] opacity-[0.08] top-[-180px] right-[-100px] w-[500px] h-[500px] bg-[var(--accent-warm)]" />
      <div className="absolute rounded-full pointer-events-none blur-[120px] opacity-[0.1] bottom-[-150px] left-[-150px] w-[450px] h-[450px] bg-[var(--accent-primary)]" />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { w: 4, left: '10%', dur: '22s', del: '0s', color: 'var(--accent-warm)' },
          { w: 3, left: '30%', dur: '26s', del: '3s', color: 'var(--accent-primary)' },
          { w: 5, left: '55%', dur: '18s', del: '1s', color: 'var(--accent-warm)' },
          { w: 3, left: '75%', dur: '24s', del: '5s', color: 'var(--accent-primary)' },
          { w: 4, left: '90%', dur: '20s', del: '2s', color: 'var(--accent-warm)' },
        ].map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: p.w,
              height: p.w,
              left: p.left,
              background: p.color,
              animation: `floatUp ${p.dur} linear infinite`,
              animationDelay: p.del,
            }}
          />
        ))}
      </div>

      <div ref={heroRef} className="reveal">
        <div className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.12em] mb-12 px-5 py-2.5 rounded-full bg-white/50 border border-[var(--border-default)] text-[var(--accent-primary)]">
          多智能体协作 · 人机共创
        </div>

        <h1 className="font-serif text-[clamp(40px,6vw,72px)] font-normal leading-[1.2] text-[var(--text-primary)] max-w-[800px] mb-7">
          故事创作的<br />
          <em className="not-italic text-[var(--accent-primary)]">静谧之所</em>
        </h1>

        <p className="text-[clamp(16px,1.4vw,19px)] text-[var(--text-secondary)] leading-relaxed max-w-[520px] mb-12">
          策划、写作、评审、修订，各司其职。<br />
          像专业创作工作室那样工作。
        </p>

        <div className="flex items-center justify-center gap-4">
          <button onClick={handleCTA} className="btn-pri">
            开始创作
          </button>
          <a
            href="#philosophy"
            className="text-sm font-medium text-[var(--text-secondary)] no-underline px-6 py-4 hover:text-[var(--text-primary)] transition-colors"
          >
            了解理念 →
          </a>
        </div>
      </div>

      <div className="absolute bottom-10 flex flex-col items-center gap-2 text-[10px] tracking-[0.2em] text-[var(--text-muted)]">
        <span>向下探索</span>
        <div className="w-px h-10" style={{
          background: 'linear-gradient(to bottom, var(--text-muted), transparent)',
          animation: 'scrollBreathe 2.5s ease-in-out infinite',
        }} />
      </div>
    </section>
  )
}
