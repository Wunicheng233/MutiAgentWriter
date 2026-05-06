import { useScrollReveal } from '../../hooks/useScrollReveal'

export default function PhilosophySection() {
  const ref = useScrollReveal()

  return (
    <section className="py-[72px] px-12 text-center relative z-[1]" id="philosophy">
      <div ref={ref} className="reveal">
        <div className="w-10 h-px bg-[var(--accent-primary)] mx-auto mb-10 opacity-30" />
        <blockquote className="font-serif text-[clamp(22px,2.8vw,30px)] font-normal leading-[1.7] text-[var(--text-primary)] max-w-[700px] mx-auto">
          你不是在让 AI 替你写作——<br />
          而是在和一支 <span className="text-[var(--accent-primary)]">AI 创作团队</span> 协作。
        </blockquote>
      </div>
    </section>
  )
}
