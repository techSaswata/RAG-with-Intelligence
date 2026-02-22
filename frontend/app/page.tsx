'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

// ── Intersection Observer hook for scroll animations ──
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed')
          observer.unobserve(el)
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

function RevealSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useScrollReveal()
  return (
    <div
      ref={ref}
      className={`reveal-on-scroll ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function ZoomSection({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useScrollReveal()
  return (
    <div ref={ref} className={`zoom-on-scroll ${className}`}>
      {children}
    </div>
  )
}

// ── Pipeline stage card ──
function StageCard({
  number,
  title,
  subtitle,
  details,
  tags,
  delay = 0,
}: {
  number: string
  title: string
  subtitle: string
  details: string[]
  tags: string[]
  delay?: number
}) {
  return (
    <RevealSection delay={delay}>
      <div className="group relative rounded-3xl border border-slate-800/60 bg-neutral-950/80 p-6 backdrop-blur transition-all duration-500 hover:border-slate-700/80 hover:bg-neutral-950/90 hover:shadow-2xl hover:shadow-white/[0.03]">
        <div className="mb-4 flex items-start justify-between">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800/60 bg-neutral-900 font-mono text-sm font-bold text-slate-300">
            {number}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-800/60 bg-neutral-900/80 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-100">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        <ul className="mt-4 space-y-2">
          {details.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </RevealSection>
  )
}

// ── Metric pill ──
function Metric({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
  return (
    <RevealSection delay={delay}>
      <div className="rounded-2xl border border-slate-800/60 bg-neutral-950/80 px-5 py-4 text-center backdrop-blur">
        <p className="font-mono text-2xl font-bold tracking-tight text-slate-100">{value}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      </div>
    </RevealSection>
  )
}

// ── Flow connector ──
function FlowArrow() {
  return (
    <RevealSection className="flex justify-center py-2">
      <div className="flex flex-col items-center gap-1">
        <div className="h-8 w-px bg-gradient-to-b from-slate-800 to-slate-600" />
        <div className="h-2 w-2 rotate-45 border-b border-r border-slate-600" />
      </div>
    </RevealSection>
  )
}

// ══════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════
export default function Home() {
  // Parallax effect on hero
  useEffect(() => {
    const handleScroll = () => {
      const hero = document.getElementById('hero-glow')
      if (hero) {
        const y = window.scrollY
        hero.style.transform = `translateY(${y * 0.3}px) scale(${1 + y * 0.0003})`
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <main className="relative min-h-screen bg-black text-slate-100 overflow-x-hidden">
      {/* ── Global background glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          id="hero-glow"
          className="absolute -top-32 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-white/[0.04] blur-[180px] will-change-transform"
        />
        <div className="absolute bottom-0 right-[-15%] h-[500px] w-[500px] rounded-full bg-slate-200/[0.03] blur-[180px]" />
      </div>

      <div className="relative z-10">
        {/* ════════════════════════════════════════
            HERO
        ════════════════════════════════════════ */}
        <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <RevealSection>
            <p className="mb-4 text-xs uppercase tracking-[0.4em] text-slate-500">
              Retrieval-Augmented Generation
            </p>
          </RevealSection>

          <RevealSection delay={100}>
            <h1 className="max-w-3xl text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
              Intelligent
              <br />
              <span className="bg-gradient-to-r from-slate-200 via-slate-400 to-slate-600 bg-clip-text text-transparent">
                RAG Pipeline
              </span>
            </h1>
          </RevealSection>

          <RevealSection delay={200}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              A production-grade retrieval system that ingests PDFs, chunks with
              contextual headers, embeds into pgvector, routes queries through a
              deterministic classifier, and generates answers with real-time
              quality evaluation.
            </p>
          </RevealSection>

          <RevealSection delay={300}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/ask"
                className="rounded-2xl bg-slate-100 px-8 py-3 text-sm font-semibold text-black transition hover:bg-white hover:shadow-lg hover:shadow-white/10"
              >
                Try it out
              </Link>
            </div>
          </RevealSection>

          {/* Scroll to architecture */}
          <a href="#architecture" className="absolute bottom-10 flex flex-col items-center gap-2 group cursor-pointer">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-600 transition-colors group-hover:text-slate-400">Scrolldown to Architecture</span>
            <div className="scroll-arrow flex flex-col items-center">
              <svg className="h-5 w-5 text-slate-600 transition-colors group-hover:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <svg className="h-5 w-5 -mt-2.5 text-slate-700 transition-colors group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </a>
        </section>

        {/* ════════════════════════════════════════
            METRICS BAR
        ════════════════════════════════════════ */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Embedding Dim" value="768" delay={0} />
            <Metric label="Chunk Size" value="300t" delay={80} />
            <Metric label="Vector Store" value="pgvec" delay={160} />
            <Metric label="Avg Latency" value="~2.7s" delay={240} />
          </div>
        </section>

        {/* ════════════════════════════════════════
            HIGH-LEVEL ARCHITECTURE
        ════════════════════════════════════════ */}
        <section id="architecture" className="mx-auto max-w-6xl px-6 py-20">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">System Overview</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              End-to-End Architecture
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              A query travels through 10 orchestrated stages — from embedding and vector
              retrieval to deterministic routing, LLM generation, and real-time quality
              evaluation — all within a single async request cycle.
            </p>
          </RevealSection>

          {/* ── Visual architecture diagram ── */}
          <div className="mt-14 space-y-6">

            {/* Row 1: User Input */}
            <RevealSection className="flex justify-center">
              <div className="arch-node group relative flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-gradient-to-b from-slate-900 to-neutral-950 px-6 py-4 shadow-lg shadow-black/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-sm">
                  <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">User Query</p>
                  <p className="text-xs text-slate-500">Natural language question via Web UI</p>
                </div>
              </div>
            </RevealSection>

            {/* Connector */}
            <div className="flex justify-center"><div className="arch-connector h-10 w-px bg-gradient-to-b from-slate-700 to-slate-800"><div className="arch-pulse" /></div></div>

            {/* Row 2: API Gateway */}
            <RevealSection delay={60} className="flex justify-center">
              <div className="arch-node group relative flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 to-neutral-950 px-6 py-4 shadow-lg shadow-emerald-900/10">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900/40 text-sm">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">FastAPI Gateway</p>
                  <p className="text-xs text-slate-500">Async ASGI · Pydantic validation · CORS</p>
                </div>
                <span className="ml-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">POST /query</span>
              </div>
            </RevealSection>

            {/* Connector splits into 2 */}
            <div className="flex justify-center"><div className="arch-connector h-10 w-px bg-gradient-to-b from-slate-700 to-slate-800"><div className="arch-pulse" /></div></div>

            {/* Row 3: Parallel — Conversation + Router + Embedding */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <RevealSection delay={0}>
                <div className="arch-node rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/30 to-neutral-950 p-5 shadow-lg shadow-violet-900/10">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-900/40">
                      <svg className="h-3.5 w-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">Conversation Manager</p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">Load last 3 turns from Supabase. UUID-based session isolation. Persists Q&A pairs for multi-turn context.</p>
                  <div className="mt-3 flex gap-1.5">
                    <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">3-Turn Window</span>
                    <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">PostgreSQL</span>
                  </div>
                </div>
              </RevealSection>

              <RevealSection delay={80}>
                <div className="arch-node rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-950/30 to-neutral-950 p-5 shadow-lg shadow-amber-900/10">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/40">
                      <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">Model Router</p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">Deterministic rule engine with 5 rules + OOD filter. Keyword regex, word count, question marks, comparison detection.</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">8B Simple</span>
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">70B Complex</span>
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">OOD Skip</span>
                  </div>
                </div>
              </RevealSection>

              <RevealSection delay={160}>
                <div className="arch-node rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/30 to-neutral-950 p-5 shadow-lg shadow-cyan-900/10">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-900/40">
                      <svg className="h-3.5 w-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">Query Embedding</p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">HuggingFace Inference API encodes query into 768-d dense vector. Same model as ingestion for alignment. Batch + retry.</p>
                  <div className="mt-3 flex gap-1.5">
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">mpnet-v2</span>
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">768-d</span>
                  </div>
                </div>
              </RevealSection>
            </div>

            {/* Connector lines merging */}
            <div className="flex items-start justify-center gap-[calc(33%-2rem)]">
              <div className="arch-connector h-10 w-px bg-gradient-to-b from-violet-800/40 to-slate-800"><div className="arch-pulse" /></div>
              <div className="arch-connector h-10 w-px bg-gradient-to-b from-amber-800/40 to-slate-800"><div className="arch-pulse" /></div>
              <div className="arch-connector h-10 w-px bg-gradient-to-b from-cyan-800/40 to-slate-800"><div className="arch-pulse" /></div>
            </div>

            {/* Row 4: Vector Search + Dynamic K */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <RevealSection delay={0}>
                <div className="arch-node rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-950/30 to-neutral-950 p-5 shadow-lg shadow-blue-900/10">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/40">
                      <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">Vector Similarity Search</p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">Supabase pgvector RPC: match_chunks(). L2 distance → similarity score. Returns top-5 chunks sorted by relevance.</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300">top_k=5</span>
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300">pgvector</span>
                    </div>
                    <span className="text-[10px] text-slate-600">~50ms</span>
                  </div>
                </div>
              </RevealSection>

              <RevealSection delay={80}>
                <div className="arch-node rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/30 to-neutral-950 p-5 shadow-lg shadow-indigo-900/10">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-900/40">
                      <svg className="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">Dynamic K-Cutoff</p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">Hard threshold &gt; 0.2 removes noise. Then adaptive filter: keep only chunks scoring &ge; 80% of the top result. Prevents &quot;lost in the middle&quot; degradation.</p>
                  <div className="mt-3 flex gap-1.5">
                    <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-300">&gt;0.2 threshold</span>
                    <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-300">0.8&times; cutoff</span>
                    <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-300">k=2&ndash;5</span>
                  </div>
                </div>
              </RevealSection>
            </div>

            {/* Connector */}
            <div className="flex justify-center"><div className="arch-connector h-10 w-px bg-gradient-to-b from-slate-700 to-slate-800"><div className="arch-pulse" /></div></div>

            {/* Row 5: Prompt Build */}
            <RevealSection delay={60} className="flex justify-center">
              <div className="arch-node w-full max-w-2xl rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900/80 to-neutral-950 p-5 shadow-lg shadow-black/40">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
                    <svg className="h-3.5 w-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-100">Prompt Assembly</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {['System Persona', 'Context Chunks', 'Conv. History', 'User Query'].map((layer, i) => (
                    <div key={layer} className="rounded-xl border border-slate-800/60 bg-neutral-900/60 px-3 py-2.5 text-center">
                      <p className="font-mono text-[10px] text-slate-500">Layer {i + 1}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-300">{layer}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">Assembled prompt counted via tiktoken (o200k_base) before dispatch. Avg 200–350 input tokens.</p>
              </div>
            </RevealSection>

            {/* Connector */}
            <div className="flex justify-center"><div className="arch-connector h-10 w-px bg-gradient-to-b from-slate-700 to-slate-800"><div className="arch-pulse" /></div></div>

            {/* Row 6: LLM Generation */}
            <RevealSection delay={80} className="flex justify-center">
              <div className="arch-node w-full max-w-2xl rounded-2xl border border-orange-500/20 bg-gradient-to-b from-orange-950/30 to-neutral-950 p-5 shadow-lg shadow-orange-900/10">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-900/40">
                      <svg className="h-3.5 w-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">LLM Generation</p>
                  </div>
                  <span className="text-[10px] text-slate-600">~1800ms</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800/60 bg-neutral-900/60 p-3">
                    <p className="font-mono text-xs text-orange-300">Simple Path</p>
                    <p className="mt-1 text-sm font-semibold text-slate-200">Llama 3.1 8B</p>
                    <p className="text-[11px] text-slate-500">Instant inference · Low latency</p>
                  </div>
                  <div className="rounded-xl border border-slate-800/60 bg-neutral-900/60 p-3">
                    <p className="font-mono text-xs text-orange-300">Complex Path</p>
                    <p className="mt-1 text-sm font-semibold text-slate-200">Llama 3.3 70B</p>
                    <p className="text-[11px] text-slate-500">Versatile · Deep reasoning</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">Groq API</span>
                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">Temp 0.7</span>
                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">Max 500 tokens</span>
                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">SSE Streaming</span>
                </div>
              </div>
            </RevealSection>

            {/* Connector */}
            <div className="flex justify-center"><div className="arch-connector h-10 w-px bg-gradient-to-b from-slate-700 to-slate-800"><div className="arch-pulse" /></div></div>

            {/* Row 7: Output Evaluator */}
            <RevealSection delay={100} className="flex justify-center">
              <div className="arch-node w-full max-w-2xl rounded-2xl border border-rose-500/20 bg-gradient-to-b from-rose-950/20 to-neutral-950 p-5 shadow-lg shadow-rose-900/10">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-900/40">
                    <svg className="h-3.5 w-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-100">Output Evaluator</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { flag: 'no_context', color: 'text-rose-300 border-rose-500/30' },
                    { flag: 'refusal', color: 'text-amber-300 border-amber-500/30' },
                    { flag: 'unverified', color: 'text-orange-300 border-orange-500/30' },
                    { flag: 'pricing', color: 'text-yellow-300 border-yellow-500/30' },
                  ].map((f) => (
                    <div key={f.flag} className={`rounded-lg border ${f.color} bg-neutral-900/60 px-2.5 py-2 text-center`}>
                      <p className="font-mono text-[10px]">{f.flag}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">Checks for hallucination, refusal with partial-answer detection, unverified entities via proper noun extraction, and pricing hedging language.</p>
              </div>
            </RevealSection>

            {/* Connector splits into 2 */}
            <div className="flex items-start justify-center gap-48">
              <div className="arch-connector h-10 w-px bg-gradient-to-b from-slate-700 to-slate-800"><div className="arch-pulse" /></div>
              <div className="arch-connector h-10 w-px bg-gradient-to-b from-slate-700 to-slate-800"><div className="arch-pulse" /></div>
            </div>

            {/* Row 8: Final — Response + Logger */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <RevealSection delay={0}>
                <div className="arch-node rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/30 to-neutral-950 p-5 shadow-lg shadow-emerald-900/10">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-900/40">
                      <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">JSON Response</p>
                  </div>
                  <div className="rounded-xl border border-slate-800/60 bg-neutral-900/80 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
                    <span className="text-slate-600">{'{'}</span><br />
                    &nbsp;&nbsp;<span className="text-emerald-300">&quot;answer&quot;</span>: <span className="text-slate-300">&quot;...&quot;</span>,<br />
                    &nbsp;&nbsp;<span className="text-emerald-300">&quot;metadata&quot;</span>: <span className="text-slate-600">{'{'}</span> model, tokens, latency, flags <span className="text-slate-600">{'}'}</span>,<br />
                    &nbsp;&nbsp;<span className="text-emerald-300">&quot;sources&quot;</span>: <span className="text-slate-600">[</span> doc, page, score <span className="text-slate-600">]</span>,<br />
                    &nbsp;&nbsp;<span className="text-emerald-300">&quot;conversation_id&quot;</span>: <span className="text-slate-300">&quot;conv_...&quot;</span><br />
                    <span className="text-slate-600">{'}'}</span>
                  </div>
                </div>
              </RevealSection>

              <RevealSection delay={80}>
                <div className="arch-node rounded-2xl border border-slate-700/40 bg-gradient-to-b from-slate-900/60 to-neutral-950 p-5 shadow-lg shadow-black/30">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-100">Routing Logger</p>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">JSONL format with daily rotation &amp; 30-day retention. Logs classification, rule triggered, complexity score, token counts, latency, and evaluator flags for every query.</p>
                  <div className="mt-3 flex gap-1.5">
                    <span className="rounded-full border border-slate-700/40 bg-slate-800/40 px-2 py-0.5 text-[10px] text-slate-400">JSONL</span>
                    <span className="rounded-full border border-slate-700/40 bg-slate-800/40 px-2 py-0.5 text-[10px] text-slate-400">30-Day Rotation</span>
                    <span className="rounded-full border border-slate-700/40 bg-slate-800/40 px-2 py-0.5 text-[10px] text-slate-400">Full Audit</span>
                  </div>
                </div>
              </RevealSection>
            </div>

          </div>
        </section>

        {/* ════════════════════════════════════════
            INGESTION PIPELINE
        ════════════════════════════════════════ */}
        <section className="mx-auto max-w-5xl px-6 py-20">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Phase 1</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Document Ingestion
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              PDFs are loaded, parsed page-by-page, chunked with token-aware splitting,
              injected with contextual headers extracted from font metadata, embedded
              into 768-d vectors, and stored in Supabase pgvector.
            </p>
          </RevealSection>

          <div className="mt-12 space-y-0">
            <StageCard
              number="01"
              title="PDF Extraction"
              subtitle="PyMuPDF (fitz) parses documents page-by-page"
              details={[
                'Extracts raw text with page.get_text() from each page',
                'Tracks filename, page numbers (1-indexed), word counts',
                'Handles corrupted PDFs with graceful error recovery',
              ]}
              tags={['PyMuPDF', 'Page-Level']}
            />
            <FlowArrow />
            <StageCard
              number="02"
              title="Contextual Header Extraction"
              subtitle="Font-size analysis injects hierarchical document structure"
              details={[
                'Uses get_text("dict") to access font metadata per text block',
                'H1 > 18pt · H2 > 14pt · H3 > 12pt — builds a header stack',
                'Prefixes each chunk: [Context: Section > Subsection > ...]',
                'Maintains header hierarchy across page boundaries',
              ]}
              tags={['Font Analysis', 'Hierarchy']}
              delay={80}
            />
            <FlowArrow />
            <StageCard
              number="03"
              title="Token-Aware Chunking"
              subtitle="300-token chunks with 50-token overlap via recursive splitting"
              details={[
                'Tokenizer: all-mpnet-base-v2 AutoTokenizer for exact counts',
                'Recursive separators: \\n\\n → \\n → ". " → " " → char-level',
                'Overlap decoded from last 50 tokens of previous chunk',
                'Chunk IDs: {filename}_{page}_{index} for deterministic dedup',
              ]}
              tags={['300 tokens', '50 overlap', 'Recursive']}
              delay={160}
            />
            <FlowArrow />
            <StageCard
              number="04"
              title="Embedding Generation"
              subtitle="sentence-transformers/all-mpnet-base-v2 via HuggingFace Inference"
              details={[
                'Output: 768-dimensional dense vectors per chunk',
                'Batch processing for efficient API utilization',
                'Exponential backoff: 5 retries, 5s → 60s max delay',
                'Model warmup on startup to avoid cold-start latency',
              ]}
              tags={['768-d', 'HuggingFace', 'Batch']}
              delay={240}
            />
            <FlowArrow />
            <StageCard
              number="05"
              title="Vector Storage"
              subtitle="Supabase PostgreSQL with pgvector extension"
              details={[
                'L2 distance converted to similarity: 1 − distance',
                'RPC function: match_chunks(embedding, threshold, count)',
                'Upsert strategy prevents duplicate chunks on re-ingestion',
                'Stores text, metadata, page numbers alongside vectors',
              ]}
              tags={['pgvector', 'Supabase', 'L2']}
              delay={320}
            />
          </div>
        </section>

        {/* ════════════════════════════════════════
            QUERY PIPELINE
        ════════════════════════════════════════ */}
        <section id="pipeline" className="mx-auto max-w-5xl px-6 py-20">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Phase 2</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Query Pipeline
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              When a user asks a question, the system classifies complexity, retrieves
              relevant chunks with adaptive filtering, builds a context-rich prompt,
              generates via Groq, evaluates output quality, and logs everything.
            </p>
          </RevealSection>

          <div className="mt-12 space-y-0">
            <StageCard
              number="06"
              title="Query Classification & Model Routing"
              subtitle="Deterministic rule-based decision tree — not ML"
              details={[
                'OOD filter: greetings & meta-questions skip retrieval entirely',
                'Complex triggers: keywords (explain, compare, analyze), length >15 words, multiple "?", comparison words (vs, better, worse)',
                'Simple → Llama 3.1 8B Instant · Complex → Llama 3.3 70B Versatile',
                'Word-boundary regex prevents false positives (e.g., "CSV" ≠ "vs")',
              ]}
              tags={['Rule Engine', '8B / 70B', 'Deterministic']}
            />
            <FlowArrow />
            <StageCard
              number="07"
              title="Retrieval with Dynamic K-Cutoff"
              subtitle="Vector search + adaptive filtering prevents 'lost in the middle'"
              details={[
                'Query embedded with same mpnet-v2 model → 768-d vector',
                'Top-5 chunks fetched from Supabase pgvector via RPC',
                'Hard threshold filter: score > 0.2 removes noise',
                'Dynamic cutoff: only keep chunks ≥ 80% of top score — adaptive k (2–5)',
              ]}
              tags={['top-k=5', 'Threshold 0.2', '80% Cutoff']}
              delay={80}
            />
            <FlowArrow />
            <StageCard
              number="08"
              title="Prompt Construction"
              subtitle="Multi-layer prompt with system instructions, context, and history"
              details={[
                '1. System: ClearPath support assistant persona',
                '2. Context: retrieved chunk texts (2–5 chunks)',
                '3. History: last 3 conversation turns (multi-turn memory)',
                '4. Current question + instruction suffix for grounded answers',
              ]}
              tags={['Multi-Turn', '3-Turn History']}
              delay={160}
            />
            <FlowArrow />
            <StageCard
              number="09"
              title="LLM Generation"
              subtitle="Groq API with streaming SSE and token counting via tiktoken"
              details={[
                'Temperature: 0.7 · Max tokens: 500 per response',
                'Token counting: tiktoken o200k_base encoding pre & post generation',
                'Streaming: Server-Sent Events yield tokens in real-time',
                'Error handling: structured retries with exponential backoff',
              ]}
              tags={['Groq', 'SSE', 'tiktoken']}
              delay={240}
            />
            <FlowArrow />
            <StageCard
              number="10"
              title="Output Quality Evaluation"
              subtitle="4-flag system catches hallucinations, refusals, and uncertainty"
              details={[
                'no_context — answered without any retrieved documentation',
                'refusal — declined to answer (with partial-answer detection to avoid false positives)',
                'unverified_feature — mentions entities not found in source chunks',
                'pricing_uncertainty — hedging language or conflicting price info',
              ]}
              tags={['4 Flags', 'Anti-Hallucination']}
              delay={320}
            />
          </div>
        </section>

        {/* ════════════════════════════════════════
            TECH STACK
        ════════════════════════════════════════ */}
        <section className="mx-auto max-w-5xl px-6 py-20">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Infrastructure</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Technology Stack
            </h2>
          </RevealSection>

          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'FastAPI', role: 'API Gateway', detail: 'Async ASGI with Uvicorn' },
              { name: 'PyMuPDF', role: 'PDF Processing', detail: 'Page extraction + font metadata' },
              { name: 'HuggingFace', role: 'Embeddings', detail: 'all-mpnet-base-v2 (768-d)' },
              { name: 'Supabase', role: 'Vector Store', detail: 'PostgreSQL + pgvector extension' },
              { name: 'Groq', role: 'LLM Inference', detail: 'Llama 3.1 8B & 3.3 70B' },
              { name: 'tiktoken', role: 'Token Counting', detail: 'o200k_base encoding' },
              { name: 'Next.js', role: 'Frontend', detail: 'React with Tailwind CSS' },
              { name: 'Pydantic', role: 'Validation', detail: 'Request/response schemas' },
              { name: 'httpx', role: 'HTTP Client', detail: 'Async requests with retry' },
            ].map((tech, i) => (
              <RevealSection key={tech.name} delay={i * 60}>
                <div className="rounded-2xl border border-slate-800/60 bg-neutral-950/80 p-5 backdrop-blur transition-all duration-300 hover:border-slate-700/80">
                  <p className="text-sm font-semibold text-slate-100">{tech.name}</p>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{tech.role}</p>
                  <p className="mt-2 text-sm text-slate-400">{tech.detail}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════
            CONFIG TABLE
        ════════════════════════════════════════ */}
        <section className="mx-auto max-w-4xl px-6 py-20">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Configuration</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Pipeline Parameters
            </h2>
          </RevealSection>

          <ZoomSection className="mt-12">
            <div className="overflow-hidden rounded-3xl border border-slate-800/60 bg-neutral-950/80 backdrop-blur">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800/60">
                      <th className="px-6 py-4 text-xs uppercase tracking-[0.2em] text-slate-500">Parameter</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-[0.2em] text-slate-500">Value</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-[0.2em] text-slate-500">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {[
                      ['Chunk Size', '300 tokens', 'Context granularity per chunk'],
                      ['Chunk Overlap', '50 tokens', 'Continuity between adjacent chunks'],
                      ['Embedding Dim', '768', 'all-mpnet-base-v2 vector output'],
                      ['Retrieval top_k', '5', 'Max chunks from vector search'],
                      ['Relevance Threshold', '0.2', 'Min similarity score to keep'],
                      ['Dynamic K-Cutoff', '0.8×', 'Adaptive filtering multiplier'],
                      ['LLM Temperature', '0.7', 'Generation randomness control'],
                      ['Max Tokens', '500', 'Response length hard limit'],
                      ['History Turns', '3', 'Multi-turn conversation window'],
                      ['Header Font H1/H2/H3', '18/14/12pt', 'Font-size thresholds for hierarchy'],
                    ].map(([param, value, purpose]) => (
                      <tr key={param} className="transition-colors hover:bg-slate-900/40">
                        <td className="whitespace-nowrap px-6 py-3 font-mono text-slate-200">{param}</td>
                        <td className="whitespace-nowrap px-6 py-3 font-mono text-slate-400">{value}</td>
                        <td className="px-6 py-3 text-slate-500">{purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ZoomSection>
        </section>

        {/* ════════════════════════════════════════
            LATENCY BREAKDOWN
        ════════════════════════════════════════ */}
        <section className="mx-auto max-w-4xl px-6 py-20">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Performance</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Latency Breakdown
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Typical end-to-end latency for a single query across all pipeline stages.
            </p>
          </RevealSection>

          <div className="mt-12 space-y-3">
            {[
              { stage: 'Conversation Check', ms: 5, pct: 0.2 },
              { stage: 'Query Embedding (HF API)', ms: 800, pct: 29.5 },
              { stage: 'Vector Search (pgvector)', ms: 50, pct: 1.8 },
              { stage: 'Dynamic K-Cutoff', ms: 5, pct: 0.2 },
              { stage: 'Prompt Construction', ms: 10, pct: 0.4 },
              { stage: 'Token Counting', ms: 5, pct: 0.2 },
              { stage: 'LLM Generation (Groq)', ms: 1800, pct: 66.4 },
              { stage: 'Output Evaluation', ms: 20, pct: 0.7 },
              { stage: 'Logging + Response', ms: 15, pct: 0.6 },
            ].map((item, i) => (
              <RevealSection key={item.stage} delay={i * 40}>
                <div className="flex items-center gap-4 rounded-2xl border border-slate-800/40 bg-neutral-950/60 px-5 py-3">
                  <span className="w-48 shrink-0 text-sm text-slate-300">{item.stage}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="latency-bar absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-slate-600 to-slate-400"
                      style={{ width: `${Math.max(item.pct, 1)}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-sm text-slate-500">
                    {item.ms}ms
                  </span>
                </div>
              </RevealSection>
            ))}

            <RevealSection delay={400}>
              <div className="mt-4 flex items-center gap-4 rounded-2xl border border-slate-700/60 bg-neutral-900/80 px-5 py-3">
                <span className="w-48 shrink-0 text-sm font-semibold text-slate-100">Total</span>
                <div className="flex-1" />
                <span className="w-16 shrink-0 text-right font-mono text-sm font-bold text-slate-200">
                  ~2710ms
                </span>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ════════════════════════════════════════
            EVALUATION FLAGS
        ════════════════════════════════════════ */}
        <section className="mx-auto max-w-5xl px-6 py-20">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Quality Assurance</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Output Evaluator Flags
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Every response passes through a 4-flag evaluation system that catches
              hallucinations, refusals, unverified claims, and pricing uncertainty
              before reaching the user.
            </p>
          </RevealSection>

          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                flag: 'no_context',
                color: 'border-rose-500/30 bg-rose-500/5',
                dot: 'bg-rose-400',
                desc: 'LLM answered without any retrieved documentation — potential hallucination risk',
              },
              {
                flag: 'refusal',
                color: 'border-amber-500/30 bg-amber-500/5',
                dot: 'bg-amber-400',
                desc: 'System declined to answer, with partial-answer detection to avoid false positives',
              },
              {
                flag: 'unverified_feature',
                color: 'border-orange-500/30 bg-orange-500/5',
                dot: 'bg-orange-400',
                desc: 'Response mentions entities or integrations not found in source chunks',
              },
              {
                flag: 'pricing_uncertainty',
                color: 'border-yellow-500/30 bg-yellow-500/5',
                dot: 'bg-yellow-400',
                desc: 'Hedging language or conflicting price information detected in response',
              },
            ].map((item, i) => (
              <RevealSection key={item.flag} delay={i * 80}>
                <div className={`rounded-2xl border ${item.color} p-5`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                    <span className="font-mono text-sm font-semibold text-slate-200">{item.flag}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════
            CTA
        ════════════════════════════════════════ */}
        <section className="flex flex-col items-center px-6 py-32 text-center">
          <ZoomSection>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              See it in action
            </h2>
            <p className="mt-4 max-w-md text-sm text-slate-400">
              Ask a question and watch the full pipeline execute — from embedding to
              generation — with live telemetry on every response.
            </p>
            <Link
              href="/ask"
              className="mt-8 inline-block rounded-2xl bg-slate-100 px-10 py-3.5 text-sm font-semibold text-black transition hover:bg-white hover:shadow-lg hover:shadow-white/10"
            >
              Launch Vault
            </Link>
          </ZoomSection>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-slate-800/40 px-6 py-8 text-center">
          <p className="text-xs text-slate-600">
            Intelligent RAG Pipeline &middot; Built with FastAPI, Supabase pgvector, Groq, and Next.js
          </p>
        </footer>
      </div>
    </main>
  )
}
