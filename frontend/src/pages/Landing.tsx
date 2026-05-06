import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { initScrollReveal } from '../hooks/useScrollReveal'

import LandingHero from '../components/landing/LandingHero'
import PhilosophySection from '../components/landing/PhilosophySection'
import AgentTeamSection from '../components/landing/AgentTeamSection'
import V1V2Comparison from '../components/landing/V1V2Comparison'
import FeatureCards from '../components/landing/FeatureCards'
import WorkflowSection from '../components/landing/WorkflowSection'
import ShowcaseSection from '../components/landing/ShowcaseSection'
import StatsSection from '../components/landing/StatsSection'
import TargetAudience from '../components/landing/TargetAudience'
import FinalCTA from '../components/landing/FinalCTA'
import '../components/landing/LandingPage.css'

/* ------------------ high-quality smooth scroll ------------------ */
function smoothScrollTo(container: HTMLElement, targetY: number, duration = 900) {
  const startY = container.scrollTop
  const distance = targetY - startY
  const startTime = performance.now()

  function step(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    // easeInOutCubic: slow start, smooth middle, slow end
    const eased =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2

    container.scrollTop = startY + distance * eased

    if (progress < 1) {
      requestAnimationFrame(step)
    }
  }

  requestAnimationFrame(step)
}

/* ------------------ PageArrow ------------------ */
function PageArrow({ scrollContainerRef }: { scrollContainerRef: React.RefObject<HTMLDivElement | null> }) {
  const handleClick = () => {
    const container = scrollContainerRef.current
    if (!container) return
    const pages = container.querySelectorAll('.lp-page')
    const scrollCenter = container.scrollTop + container.clientHeight / 2
    let currentIdx = 0
    pages.forEach((_, i) => {
      const el = pages[i] as HTMLElement
      if (el.offsetTop < scrollCenter) currentIdx = i
    })
    const next = pages[currentIdx + 1] as HTMLElement | undefined
    if (next) {
      smoothScrollTo(container, next.offsetTop, 900)
    }
  }

  return (
    <button
      className="page-arrow visible"
      onClick={handleClick}
      aria-label="下一页"
      style={{
        position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, background: 'none', border: 'none', cursor: 'pointer',
        padding: 12, color: 'var(--text-muted, #a69a8d)',
        animation: 'arrowBounce 2.2s ease-in-out infinite',
        transition: 'opacity 0.4s, color 0.3s',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  )
}

/* --------------- Snap-page wrapper --------------- */
function Page({
  children,
  bg,
  showArrow = true,
  scrollContainerRef,
}: {
  children: React.ReactNode
  bg: string
  showArrow?: boolean
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <section className={`lp-page ${bg}`}>
      {children}
      {showArrow && <PageArrow scrollContainerRef={scrollContainerRef} />}
    </section>
  )
}

export default function Landing() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Use higher threshold (0.35) so content only pops in when mostly on screen
    const cleanup = initScrollReveal('.lp-page .reveal, .lp-page .reveal-scale', { threshold: 0.35, rootMargin: '0px' })
    // Mark elements already visible after mount
    const timer = setTimeout(() => {
      document.querySelectorAll('.lp-page .reveal, .lp-page .reveal-scale').forEach((el) => {
        const rect = el.getBoundingClientRect()
        const vh = window.innerHeight
        if (rect.top < vh * 0.65 && rect.bottom > rect.height * 0.3) {
          el.classList.add('visible')
        }
      })
    }, 200)
    return () => {
      cleanup()
      clearTimeout(timer)
    }
  }, [])

  const header = (
    <header
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 48px', height: 72, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(250,247,242,0.88)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-default, rgba(58,44,31,0.08))',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-ui, Inter, sans-serif)',
        fontSize: 13, fontWeight: 500,
        letterSpacing: '0.24em', textTransform: 'uppercase',
        color: 'var(--text-secondary, #7a6f62)',
      }}>
        StoryForge AI
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        {['agents', 'features', 'workflow'].map((href) => (
          <a key={href} href={`#${href}`}
            style={{ fontSize: 14, color: 'var(--text-secondary, #7a6f62)', textDecoration: 'none' }}>
            {{ agents: '团队', features: '特性', workflow: '流程' }[href]}
          </a>
        ))}
        <button
          onClick={() => navigate(isAuthenticated() ? '/dashboard' : '/login')}
          style={{
            fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
            color: 'var(--accent-primary, #5b7f6e)', background: 'transparent',
            border: '1px solid var(--accent-primary, #5b7f6e)', borderRadius: 100,
            padding: '10px 28px', cursor: 'pointer', transition: 'all 0.25s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#5b7f6e'; e.currentTarget.style.color = 'white' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5b7f6e' }}
        >
          {isAuthenticated() ? '进入控制台' : '登录'}
        </button>
      </div>
    </header>
  )

  const footer = (
    <footer style={{ padding: '48px 48px 40px', textAlign: 'center', borderTop: '1px solid var(--border-default, rgba(58,44,31,0.08))' }}>
      <div style={{
        fontFamily: 'var(--font-ui, Inter, sans-serif)',
        fontSize: 12, fontWeight: 500, letterSpacing: '0.24em',
        textTransform: 'uppercase', color: 'var(--text-muted, #a69a8d)', marginBottom: 24,
      }}>
        StoryForge AI
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: '产品文档', href: 'https://github.com/Wunicheng233/MultiAgentWriter/blob/main/docs/product-documentation.md' },
          { label: '关于我们', href: 'https://github.com/Wunicheng233/MultiAgentWriter/blob/main/docs/about.md' },
          { label: 'GitHub', href: 'https://github.com/Wunicheng233/MultiAgentWriter' },
          { label: '隐私政策', href: 'https://github.com/Wunicheng233/MultiAgentWriter/blob/main/docs/privacy.md' },
        ].map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--text-secondary, #7a6f62)', textDecoration: 'none' }}>{link.label}</a>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted, #a69a8d)' }}>
        基于多智能体协作架构 · 人机共创 · 持续进化
      </div>
    </footer>
  )

  return (
    <div className="landing" style={{ background: '#faf7f2' }}>
      {header}
      <div className="landing-scroll" ref={scrollRef}>
        <Page bg="bg-hero" scrollContainerRef={scrollRef}>
          <LandingHero />
        </Page>

        <Page bg="bg-cream" scrollContainerRef={scrollRef}>
          <PhilosophySection />
        </Page>

        <Page bg="bg-warm" scrollContainerRef={scrollRef}>
          <AgentTeamSection />
        </Page>

        <Page bg="bg-sage-tint" scrollContainerRef={scrollRef}>
          <V1V2Comparison />
        </Page>

        <Page bg="bg-cream" scrollContainerRef={scrollRef}>
          <FeatureCards />
        </Page>

        <Page bg="bg-deep-warm" scrollContainerRef={scrollRef}>
          <WorkflowSection />
        </Page>

        <Page bg="bg-gold-tint" scrollContainerRef={scrollRef}>
          <ShowcaseSection />
        </Page>

        <Page bg="bg-terra-tint" scrollContainerRef={scrollRef}>
          <StatsSection />
        </Page>

        <Page bg="bg-radial-warm" scrollContainerRef={scrollRef}>
          <TargetAudience />
        </Page>

        <Page bg="bg-cream" showArrow={false} scrollContainerRef={scrollRef}>
          <FinalCTA />
        </Page>

        {footer}
      </div>
    </div>
  )
}
