'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { withNgrokBypass, withNgrokHeaders } from '@/lib/ngrok'

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.mkv']
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-matroska']

interface UploadItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'processed' | 'error'
  progress: number
  videoId?: string
  error?: string
}

interface VideoUploadProps {
  apiBaseUrl: string
  apiKey?: string
}

// ── Video pipeline steps for the processing overlay ──
const VIDEO_PIPELINE_STEPS = [
  { id: 'upload', label: 'Uploading video to server', detail: 'Streaming file bytes via multipart/form-data', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5', color: 'cyan' },
  { id: 'validate', label: 'Validating & sanitizing file', detail: 'Extension check, size limit (500 MB), path traversal protection', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'emerald' },
  { id: 'frames', label: 'Extracting frames at 1 fps', detail: 'OpenCV VideoCapture → JPEG frames in {video_id}/frames/', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', color: 'rose' },
  { id: 'embed', label: 'CLIP-embedding frames (512-d)', detail: 'clip-ViT-B-32 encodes each frame into a 512-d dense vector', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', color: 'violet' },
  { id: 'store', label: 'Storing vectors in pgvector', detail: 'Supabase video_frame_embeddings table with HNSW index', icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375', color: 'blue' },
]

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    glow: 'shadow-cyan-500/20' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    glow: 'shadow-rose-500/20' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400',  glow: 'shadow-violet-500/20' },
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    glow: 'shadow-blue-500/20' },
}

function VideoProcessingOverlay({ activeStep, fileCount }: { activeStep: number; fileCount: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center processing-overlay-enter">
      {/* Heavy backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />

      {/* Ambient glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-violet-500/[0.06] blur-[200px]" />
        <div className="absolute bottom-1/4 left-1/3 h-[300px] w-[300px] rounded-full bg-rose-500/[0.05] blur-[150px]" />
        <div className="absolute top-1/2 right-1/4 h-[250px] w-[250px] rounded-full bg-blue-500/[0.04] blur-[140px]" />
      </div>

      {/* Animated scan line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="processing-scan-line absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent shadow-[0_0_20px_4px_rgba(139,92,246,0.15)]" />
      </div>

      {/* Grid overlay */}
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
              background: i % 3 === 0 ? 'rgba(139,92,246,0.3)' : i % 3 === 1 ? 'rgba(244,63,94,0.25)' : 'rgba(59,130,246,0.25)',
              boxShadow: `0 0 ${4 + Math.random() * 6}px currentColor`,
            }}
          />
        ))}
      </div>

      {/* Content card */}
      <div className="relative z-10 mx-auto w-full max-w-lg px-6">
        <div className="rounded-3xl border border-slate-700/50 bg-neutral-950/80 p-8 shadow-2xl shadow-black/50 backdrop-blur-sm">
          {/* Top border glow */}
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

          {/* Header */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10 shadow-lg shadow-violet-500/20">
              <svg className="h-6 w-6 text-violet-400 processing-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
              </svg>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-100">Video Processing Pipeline</h2>
            <p className="mt-1.5 text-xs text-slate-500">
              Extracting & embedding {fileCount} {fileCount === 1 ? 'video' : 'videos'} into vector store
            </p>
          </div>

          {/* Pipeline steps */}
          <div className="space-y-1.5">
            {VIDEO_PIPELINE_STEPS.map((step, i) => {
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

                  {/* Active shimmer line */}
                  {isActive && (
                    <div className="absolute bottom-0 left-4 right-4 h-px overflow-hidden">
                      <div className="h-full processing-progress-line" style={{ background: `linear-gradient(90deg, transparent, var(--tw-shadow-color, rgba(139,92,246,0.5)), transparent)` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Elapsed timer */}
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

export default function VideoUpload({ apiBaseUrl, apiKey }: VideoUploadProps) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [pipelineStep, setPipelineStep] = useState(-1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const list = Array.from(newFiles)
    const videoFiles = list.filter(
      (f) =>
        ALLOWED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)) ||
        ALLOWED_TYPES.includes(f.type)
    )
    const newItems: UploadItem[] = videoFiles.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      status: 'pending',
      progress: 0,
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))
  const clearAll = () => setItems([])

  const uploadOne = async (item: UploadItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading' as const, progress: 30 } : i))
    )
    const form = new FormData()
    form.append('file', item.file)
    const headers: Record<string, string> = {}
    if (apiKey) headers['X-Api-Key'] = apiKey
    const requestHeaders = withNgrokHeaders(headers, apiBaseUrl)

    try {
      const res = await fetch(withNgrokBypass(`${apiBaseUrl.replace(/\/$/, '')}/videos/upload`, apiBaseUrl), {
        method: 'POST',
        body: form,
        headers: requestHeaders,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || res.statusText)
      }
      const data = await res.json()
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'processing' as const, progress: 70, videoId: data.video_id }
            : i
        )
      )
      pollStatus(data.video_id, item.id)
    } catch (e) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'error' as const, progress: 0, error: (e as Error).message }
            : i
        )
      )
    }
  }

  const pollStatus = (videoId: string, itemId: string) => {
    const headers: Record<string, string> = {}
    if (apiKey) headers['X-Api-Key'] = apiKey
    const requestHeaders = withNgrokHeaders(headers, apiBaseUrl)
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          withNgrokBypass(`${apiBaseUrl.replace(/\/$/, '')}/videos/${videoId}/status`, apiBaseUrl),
          { headers: requestHeaders }
        )
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'processed') {
          clearInterval(interval)
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId ? { ...i, status: 'processed' as const, progress: 100 } : i
            )
          )
        } else if (data.status === 'failed') {
          clearInterval(interval)
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId ? { ...i, status: 'error' as const, error: data.error || 'Processing failed' } : i
            )
          )
        }
      } catch {
        // ignore
      }
    }, 2000)
  }

  const startUploads = async () => {
    const pending = items.filter((i) => i.status === 'pending')
    if (pending.length === 0) return

    // Show overlay
    setPipelineStep(0)

    // Animate pipeline steps while uploading
    const stepTimings = [1500, 1200, 4000, 5000, 3000]
    let currentStep = 0
    let stepTimer: ReturnType<typeof setTimeout>
    const advanceStep = () => {
      currentStep++
      if (currentStep < VIDEO_PIPELINE_STEPS.length) {
        setPipelineStep(currentStep)
        stepTimer = setTimeout(advanceStep, stepTimings[currentStep] || 3000)
      }
    }
    stepTimer = setTimeout(advanceStep, stepTimings[0])

    // Start actual uploads
    const uploadPromises = pending.map((item) => uploadOne(item))

    try {
      await Promise.allSettled(uploadPromises)
    } finally {
      clearTimeout(stepTimer)
      // Flash to completion
      setPipelineStep(VIDEO_PIPELINE_STEPS.length)
      await new Promise(r => setTimeout(r, 600))
      setPipelineStep(-1)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const pendingCount = items.filter((i) => i.status === 'pending').length
  const processedCount = items.filter((i) => i.status === 'processed').length
  const activeCount = items.filter((i) => i.status === 'uploading' || i.status === 'processing').length

  return (
    <div className="space-y-6">
      {/* Processing overlay */}
      {pipelineStep >= 0 && (
        <VideoProcessingOverlay
          activeStep={Math.min(pipelineStep, VIDEO_PIPELINE_STEPS.length - 1)}
          fileCount={pendingCount + activeCount + processedCount}
        />
      )}

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
          isDragging
            ? 'border-violet-500/60 bg-violet-500/[0.04] shadow-lg shadow-violet-500/5'
            : 'border-slate-800/60 bg-neutral-950/60 hover:border-slate-700/80 hover:bg-neutral-950/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />

        {/* Upload icon */}
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 ${
          isDragging
            ? 'border-violet-500/40 bg-violet-500/10'
            : 'border-slate-800/60 bg-neutral-900/80 group-hover:border-slate-700'
        }`}>
          <svg className={`h-7 w-7 transition-colors duration-300 ${isDragging ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>

        <p className="text-base font-semibold text-slate-200">
          {isDragging ? 'Release to add videos' : 'Drop videos here or click to browse'}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Each video is frame-extracted, CLIP-embedded, and stored in pgvector for semantic search.
        </p>

        {/* Accepted format tags */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="rounded-full border border-slate-800/60 bg-neutral-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">.mp4</span>
          <span className="rounded-full border border-slate-800/60 bg-neutral-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">.mov</span>
          <span className="rounded-full border border-slate-800/60 bg-neutral-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">.mkv</span>
          <span className="rounded-full border border-slate-800/60 bg-neutral-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">Max 500MB</span>
        </div>
      </div>

      {/* File list */}
      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-200">
                {items.length} {items.length === 1 ? 'video' : 'videos'}
              </h2>
              {processedCount > 0 && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-emerald-300">
                  {processedCount} processed
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearAll}
                className="rounded-xl border border-slate-800/60 px-3 py-1.5 text-xs text-slate-500 transition hover:border-slate-700 hover:text-slate-300"
              >
                Clear all
              </button>
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={startUploads}
                  disabled={pipelineStep >= 0}
                  className="rounded-xl bg-slate-100 px-5 py-1.5 text-xs font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pipelineStep >= 0 ? 'Processing...' : `Upload ${pendingCount} ${pendingCount === 1 ? 'video' : 'videos'}`}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-4 rounded-2xl border border-slate-800/60 bg-neutral-950/80 px-5 py-4 transition-all duration-300 hover:border-slate-700/60"
              >
                {/* Video icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-950/40 border border-violet-500/20">
                  <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{item.file.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <span className="uppercase">{item.file.name.split('.').pop()}</span>
                    {item.status === 'processing' && <span>Extracting frames & embedding...</span>}
                  </div>
                  {item.error && <p className="mt-1 text-xs text-rose-400">{item.error}</p>}

                  {/* Progress bar */}
                  {(item.status === 'uploading' || item.status === 'processing') && (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
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
                  {(item.status === 'uploading' || item.status === 'processing') && (
                    <span className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-violet-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
                      {item.status === 'uploading' ? 'Uploading' : 'Processing'}
                    </span>
                  )}
                  {item.status === 'processed' && (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-emerald-300">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Indexed
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-rose-300">
                      Failed
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-300"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
