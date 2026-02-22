'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import ApiMissingNotice from '@/components/ApiMissingNotice'

// ── Reuse scroll reveal from landing page ──
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

// ── File item in the list ──
interface UploadedFile {
  file: File
  id: string
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: number
  chunks?: number
  pages?: number
}

function FileRow({ item, onRemove }: { item: UploadedFile; onRemove: () => void }) {
  const sizeKB = (item.file.size / 1024).toFixed(0)
  const sizeMB = (item.file.size / (1024 * 1024)).toFixed(1)
  const size = item.file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-slate-800/60 bg-neutral-950/80 px-5 py-4 transition-all duration-300 hover:border-slate-700/60">
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-950/40 border border-rose-500/20">
        <svg className="h-4.5 w-4.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-200">{item.file.name}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
          <span>{size}</span>
          <span className="uppercase">PDF</span>
          {item.pages && <span>{item.pages} pages</span>}
          {item.chunks && <span>{item.chunks} chunks</span>}
        </div>

        {/* Progress bar */}
        {item.status === 'processing' && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex shrink-0 items-center gap-3">
        {item.status === 'pending' && (
          <span className="rounded-full border border-slate-700/50 bg-slate-800/40 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-slate-400">
            Ready
          </span>
        )}
        {item.status === 'processing' && (
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-cyan-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            Processing
          </span>
        )}
        {item.status === 'done' && (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-emerald-300">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Ingested
          </span>
        )}
        {item.status === 'error' && (
          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-rose-300">
            Failed
          </span>
        )}

        <button
          onClick={onRemove}
          className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-300"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
//  UPLOAD PAGE
// ══════════════════════════════════════════════
// ── Pipeline steps for the processing overlay ──
const PIPELINE_STEPS = [
  { id: 'upload', label: 'Uploading PDF to server', detail: 'Streaming file bytes via multipart/form-data', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5', color: 'cyan' },
  { id: 'extract', label: 'Extracting text from pages', detail: 'PyMuPDF fitz.open() → page.get_text() per page', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', color: 'rose' },
  { id: 'headers', label: 'Injecting contextual headers', detail: 'Font-size analysis → H1 > 18pt, H2 > 14pt, H3 > 12pt', icon: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12', color: 'amber' },
  { id: 'chunk', label: 'Chunking into 300t segments', detail: 'Recursive split (¶ → sentence → word) with 50t overlap', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z', color: 'violet' },
  { id: 'embed', label: 'Generating 768-d embeddings', detail: 'HuggingFace Inference API → all-mpnet-base-v2 batched', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', color: 'cyan' },
  { id: 'store', label: 'Upserting into pgvector', detail: 'Supabase PostgreSQL → L2 distance index, batch of 10', icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375', color: 'blue' },
]

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  cyan:   { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30',   text: 'text-cyan-400',   glow: 'shadow-cyan-500/20' },
  rose:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   text: 'text-rose-400',   glow: 'shadow-rose-500/20' },
  amber:  { bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',  glow: 'shadow-amber-500/20' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400', glow: 'shadow-violet-500/20' },
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   glow: 'shadow-blue-500/20' },
}

function ProcessingOverlay({ activeStep, fileCount }: { activeStep: number; fileCount: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center processing-overlay-enter">
      {/* Heavy backdrop — multiple layers for density */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />

      {/* Ambient glow orbs behind the card */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-cyan-500/[0.06] blur-[200px]" />
        <div className="absolute bottom-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-blue-500/[0.05] blur-[150px]" />
        <div className="absolute top-1/2 right-1/4 h-[250px] w-[250px] rounded-full bg-violet-500/[0.04] blur-[140px]" />
      </div>

      {/* Animated scan line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="processing-scan-line absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent shadow-[0_0_20px_4px_rgba(6,182,212,0.15)]" />
      </div>

      {/* Grid overlay for depth */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="processing-particle absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              left: `${5 + Math.random() * 90}%`,
              top: `${5 + Math.random() * 90}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 5}s`,
              background: i % 3 === 0 ? 'rgba(6,182,212,0.3)' : i % 3 === 1 ? 'rgba(139,92,246,0.25)' : 'rgba(59,130,246,0.25)',
              boxShadow: `0 0 ${4 + Math.random() * 6}px currentColor`,
            }}
          />
        ))}
      </div>

      {/* Content card */}
      <div className="relative z-10 mx-auto w-full max-w-lg px-6">
        <div className="rounded-3xl border border-slate-700/50 bg-neutral-950/80 p-8 shadow-2xl shadow-black/50 backdrop-blur-sm">
          {/* Subtle top border glow */}
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

          {/* Header */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 shadow-lg shadow-cyan-500/20">
              <svg className="h-6 w-6 text-cyan-400 processing-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
              </svg>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-100">Processing Pipeline</h2>
            <p className="mt-1.5 text-xs text-slate-500">
              Ingesting {fileCount} {fileCount === 1 ? 'document' : 'documents'} into vector store
            </p>
          </div>

          {/* Pipeline steps */}
          <div className="space-y-1.5">
            {PIPELINE_STEPS.map((step, i) => {
              const isActive = i === activeStep
              const isDone = i < activeStep
              const isPending = i > activeStep
              const c = COLOR_MAP[step.color] || COLOR_MAP.cyan

              return (
                <div
                  key={step.id}
                  className={`relative flex items-start gap-3.5 rounded-xl border px-4 py-3 transition-all duration-500 ${
                    isActive
                      ? `${c.border} ${c.bg} shadow-lg ${c.glow}`
                      : isDone
                      ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                      : 'border-slate-800/30 bg-neutral-900/40'
                  } ${isPending ? 'opacity-35' : 'opacity-100'}`}
                  style={{ transitionDelay: `${i * 50}ms` }}
                >
                  {/* Step indicator */}
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                    {isDone ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 processing-step-done">
                        <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : isActive ? (
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full ${c.bg} border ${c.border}`}>
                        <div className={`h-2 w-2 rounded-full ${c.text} processing-active-dot`} style={{ backgroundColor: 'currentColor' }} />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-800/50">
                        <span className="font-mono text-[9px] text-slate-700">{String(i + 1).padStart(2, '0')}</span>
                      </div>
                    )}
                  </div>

                  {/* Icon */}
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
                    isActive ? `${c.bg} ${c.text}` : isDone ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-700'
                  }`}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                    </svg>
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium transition-colors duration-300 ${
                      isActive ? 'text-slate-100' : isDone ? 'text-emerald-300/80' : 'text-slate-600'
                    }`}>
                      {step.label}
                    </p>
                    {(isActive || isDone) && (
                      <p className={`mt-0.5 text-[11px] font-mono transition-colors duration-300 ${
                        isActive ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {step.detail}
                      </p>
                    )}
                  </div>

                  {/* Active indicator line */}
                  {isActive && (
                    <div className="absolute bottom-0 left-4 right-4 h-px overflow-hidden">
                      <div className="h-full processing-progress-line" style={{ background: `linear-gradient(90deg, transparent, var(--tw-shadow-color, rgba(6,182,212,0.5)), transparent)` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom elapsed timer */}
          <div className="mt-5 text-center">
            <ElapsedTimer />
          </div>
        </div>
      </div>
    </div>
  )
}

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return (
    <p className="font-mono text-xs text-slate-600">
      {mins > 0 ? `${mins}m ` : ''}{secs}s elapsed
    </p>
  )
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [pipelineStep, setPipelineStep] = useState(-1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    const items: UploadedFile[] = pdfFiles.map(f => ({
      file: f,
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      status: 'pending',
      progress: 0,
    }))
    setFiles(prev => [...prev, ...items])
  }, [])

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearAll = () => setFiles([])

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

  const startIngestion = async () => {
    if (!API_URL) {
      return
    }

    setIsIngesting(true)

    const pendingFiles = files.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) {
      setIsIngesting(false)
      return
    }

    // Mark all pending as processing
    setFiles(prev => prev.map(f =>
      f.status === 'pending' ? { ...f, status: 'processing' as const, progress: 20 } : f
    ))

    // Start pipeline step animation
    setPipelineStep(0)

    // Step progression — the backend processes all steps at once;
    // we simulate the visual progression with timed advances
    const stepTimings = [1200, 2500, 2000, 2500, 3500, 3000] // ms per step
    let currentStep = 0
    let stepTimer: ReturnType<typeof setTimeout>
    const advanceStep = () => {
      currentStep++
      if (currentStep < PIPELINE_STEPS.length) {
        setPipelineStep(currentStep)
        stepTimer = setTimeout(advanceStep, stepTimings[currentStep] || 2500)
      }
    }
    stepTimer = setTimeout(advanceStep, stepTimings[0])

    try {
      const formData = new FormData()
      for (const item of pendingFiles) {
        formData.append('files', item.file)
      }

      // Animate progress while waiting
      const progressInterval = setInterval(() => {
        setFiles(prev => prev.map(f =>
          f.status === 'processing' ? { ...f, progress: Math.min(f.progress + 5, 85) } : f
        ))
      }, 800)

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      clearTimeout(stepTimer)

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const data = await response.json()

      // Flash through remaining steps to completion
      setPipelineStep(PIPELINE_STEPS.length)
      await new Promise(r => setTimeout(r, 600))

      // Map results back to files
      setFiles(prev => prev.map(f => {
        if (f.status !== 'processing') return f

        const result = data.files?.find((r: { filename: string }) => r.filename === f.file.name)
        if (result && result.status === 'success') {
          return { ...f, status: 'done' as const, progress: 100, pages: result.pages, chunks: result.chunks }
        } else {
          return { ...f, status: 'error' as const, progress: 0 }
        }
      }))
    } catch (error) {
      console.error('Upload error:', error)
      clearTimeout(stepTimer)
      setFiles(prev => prev.map(f =>
        f.status === 'processing' ? { ...f, status: 'error' as const, progress: 0 } : f
      ))
    } finally {
      // Small delay before closing overlay for visual polish
      await new Promise(r => setTimeout(r, 400))
      setPipelineStep(-1)
      setIsIngesting(false)
    }
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }, [addFiles])

  const pendingCount = files.filter(f => f.status === 'pending').length
  const doneCount = files.filter(f => f.status === 'done').length

  if (!API_URL) {
    return <ApiMissingNotice />
  }

  return (
    <main className="relative min-h-screen bg-black text-slate-100 overflow-x-hidden">
      {/* Processing overlay */}
      {pipelineStep >= 0 && (
        <ProcessingOverlay
          activeStep={Math.min(pipelineStep, PIPELINE_STEPS.length - 1)}
          fileCount={files.filter(f => f.status === 'processing' || f.status === 'done').length}
        />
      )}

      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-500/[0.03] blur-[180px]" />
        <div className="absolute bottom-0 right-[-10%] h-[400px] w-[400px] rounded-full bg-blue-500/[0.03] blur-[160px]" />
      </div>

      <div className="relative z-10">
        {/* ── Nav ── */}
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-3 text-slate-400 transition-colors hover:text-slate-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex gap-3">
            <Link
              href="/videos"
              className="rounded-xl border border-slate-800/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            >
              Videos
            </Link>
            <Link
              href="/ask"
              className="rounded-xl border border-slate-800/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            >
              Ask Vault
            </Link>
          </div>
        </nav>

        {/* ── Header ── */}
        <section className="mx-auto max-w-5xl px-6 pt-8 pb-12">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Document Ingestion</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              Upload &
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-500 bg-clip-text text-transparent"> Vectorize</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
              Drop your PDFs below. Each document is parsed page-by-page, chunked with contextual
              headers, embedded into 768-d vectors via all-mpnet-base-v2, and stored in Supabase pgvector.
            </p>
          </RevealSection>
        </section>

        {/* ── Upload Zone ── */}
        <section className="mx-auto max-w-5xl px-6">
          <RevealSection delay={100}>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group relative cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
                isDragging
                  ? 'border-cyan-500/60 bg-cyan-500/[0.04] shadow-lg shadow-cyan-500/5'
                  : 'border-slate-800/60 bg-neutral-950/60 hover:border-slate-700/80 hover:bg-neutral-950/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />

              {/* Upload icon */}
              <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 ${
                isDragging
                  ? 'border-cyan-500/40 bg-cyan-500/10'
                  : 'border-slate-800/60 bg-neutral-900/80 group-hover:border-slate-700'
              }`}>
                <svg className={`h-7 w-7 transition-colors duration-300 ${isDragging ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>

              <p className="text-base font-semibold text-slate-200">
                {isDragging ? 'Release to add files' : 'Drop PDFs here or click to browse'}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Supports multiple PDF files. Each will be processed through the full ingestion pipeline.
              </p>

              {/* Accepted format tags */}
              <div className="mt-5 flex items-center justify-center gap-2">
                <span className="rounded-full border border-slate-800/60 bg-neutral-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">.pdf</span>
                <span className="rounded-full border border-slate-800/60 bg-neutral-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">Multi-file</span>
                <span className="rounded-full border border-slate-800/60 bg-neutral-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">Max 50MB each</span>
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ── File List ── */}
        {files.length > 0 && (
          <section className="mx-auto max-w-5xl px-6 pt-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-slate-200">
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </h2>
                {doneCount > 0 && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-emerald-300">
                    {doneCount} ingested
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAll}
                  className="rounded-xl border border-slate-800/60 px-3 py-1.5 text-xs text-slate-500 transition hover:border-slate-700 hover:text-slate-300"
                >
                  Clear all
                </button>
                {pendingCount > 0 && (
                  <button
                    onClick={startIngestion}
                    disabled={isIngesting}
                    className="rounded-xl bg-slate-100 px-5 py-1.5 text-xs font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isIngesting ? 'Ingesting...' : `Ingest ${pendingCount} ${pendingCount === 1 ? 'file' : 'files'}`}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {files.map(f => (
                <FileRow key={f.id} item={f} onRemove={() => removeFile(f.id)} />
              ))}
            </div>
          </section>
        )}

        {/* ── Pipeline Steps ── */}
        <section className="mx-auto max-w-5xl px-6 py-20">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">What happens to your files</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Ingestion Pipeline</h2>
          </RevealSection>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                step: '01',
                title: 'PDF Extraction',
                desc: 'PyMuPDF parses each page, extracting raw text with word counts and page metadata.',
                color: 'border-rose-500/20 from-rose-950/20',
                iconColor: 'bg-rose-900/40 text-rose-400',
                icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
                tags: ['PyMuPDF', 'Page-level'],
              },
              {
                step: '02',
                title: 'Header Injection',
                desc: 'Font-size analysis (H1>18pt, H2>14pt, H3>12pt) builds hierarchical context prefixes.',
                color: 'border-amber-500/20 from-amber-950/20',
                iconColor: 'bg-amber-900/40 text-amber-400',
                icon: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12',
                tags: ['Font meta', 'Hierarchy'],
              },
              {
                step: '03',
                title: 'Token Chunking',
                desc: '300-token chunks with 50-token overlap. Recursive splitting by paragraphs, sentences, words.',
                color: 'border-violet-500/20 from-violet-950/20',
                iconColor: 'bg-violet-900/40 text-violet-400',
                icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
                tags: ['300t', '50 overlap'],
              },
              {
                step: '04',
                title: 'Embedding',
                desc: 'HuggingFace all-mpnet-base-v2 encodes each chunk into a 768-dimensional dense vector.',
                color: 'border-cyan-500/20 from-cyan-950/20',
                iconColor: 'bg-cyan-900/40 text-cyan-400',
                icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
                tags: ['768-d', 'Batch'],
              },
              {
                step: '05',
                title: 'Vector Storage',
                desc: 'Vectors upserted into Supabase PostgreSQL with pgvector extension. L2 distance indexing.',
                color: 'border-blue-500/20 from-blue-950/20',
                iconColor: 'bg-blue-900/40 text-blue-400',
                icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
                tags: ['pgvector', 'Supabase'],
              },
              {
                step: '06',
                title: 'Ready to Query',
                desc: 'Documents are searchable instantly. Ask questions and retrieve context from your knowledge base.',
                color: 'border-emerald-500/20 from-emerald-950/20',
                iconColor: 'bg-emerald-900/40 text-emerald-400',
                icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                tags: ['Live', 'Queryable'],
              },
            ].map((s, i) => (
              <RevealSection key={s.step} delay={i * 80}>
                <div className={`arch-node h-full rounded-2xl border ${s.color} bg-gradient-to-b to-neutral-950 p-5`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.iconColor}`}>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                        </svg>
                      </div>
                      <span className="font-mono text-xs text-slate-600">{s.step}</span>
                    </div>
                    <div className="flex gap-1">
                      {s.tags.map(t => (
                        <span key={t} className="rounded-full border border-slate-800/50 bg-neutral-900/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-slate-500">{t}</span>
                      ))}
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">{s.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* ── Config Summary ── */}
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <RevealSection>
            <div className="rounded-3xl border border-slate-800/60 bg-neutral-950/80 p-6 backdrop-blur">
              <p className="mb-4 text-xs uppercase tracking-[0.3em] text-slate-500">Ingestion Config</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Chunk Size', value: '300t' },
                  { label: 'Overlap', value: '50t' },
                  { label: 'Embedding', value: '768-d' },
                  { label: 'Model', value: 'mpnet-v2' },
                ].map(c => (
                  <div key={c.label} className="rounded-xl border border-slate-800/40 bg-neutral-900/60 px-3 py-3 text-center">
                    <p className="font-mono text-lg font-bold text-slate-200">{c.value}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-slate-500">{c.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </RevealSection>
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
