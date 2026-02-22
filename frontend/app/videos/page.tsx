'use client'

import { useState } from 'react'
import Link from 'next/link'
import VideoUpload from '@/components/video/VideoUpload'
import VideoSearchTab from '@/components/video/VideoSearchTab'
import VideoImageSearchTab from '@/components/video/VideoImageSearchTab'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const VIDEO_API_KEY = process.env.NEXT_PUBLIC_VIDEO_API_KEY || ''

export default function VideosPage() {
  const [tab, setTab] = useState<'upload' | 'search' | 'image'>('upload')

  return (
    <main className="relative min-h-screen bg-black text-slate-100 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-violet-500/[0.04] blur-[180px]" />
        <div className="absolute bottom-0 right-[-10%] h-[400px] w-[400px] rounded-full bg-fuchsia-500/[0.03] blur-[160px]" />
      </div>

      <div className="relative z-10">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link
            href="/"
            className="flex items-center gap-3 text-slate-400 transition-colors hover:text-slate-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex gap-3">
            <Link
              href="/ask"
              className="rounded-xl border border-slate-800/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            >
              Ask
            </Link>
            <Link
              href="/upload"
              className="rounded-xl border border-slate-800/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            >
              Documents
            </Link>
            <Link
              href="/images"
              className="rounded-xl border border-slate-800/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            >
              Images
            </Link>
          </div>
        </nav>

        <section className="mx-auto max-w-5xl px-6 pt-8 pb-6">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Video Semantic Search</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Upload & <span className="bg-gradient-to-r from-violet-300 via-fuchsia-400 to-pink-500 bg-clip-text text-transparent">Search</span> by scene
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            Add videos, then search in natural language. Results show exact frames; click to open the video at that timestamp.
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-12">
          <div className="mb-6 flex gap-2 rounded-xl border border-slate-800/60 bg-slate-900/30 p-1">
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === 'upload'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => setTab('search')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === 'search'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setTab('image')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === 'image'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Image Search
            </button>
          </div>

          {tab === 'upload' && (
            <VideoUpload apiBaseUrl={API_URL} apiKey={VIDEO_API_KEY || undefined} />
          )}
          {tab === 'search' && (
            <VideoSearchTab apiBaseUrl={API_URL} apiKey={VIDEO_API_KEY || undefined} />
          )}
          {tab === 'image' && (
            <VideoImageSearchTab apiBaseUrl={API_URL} apiKey={VIDEO_API_KEY || undefined} />
          )}
        </section>
      </div>
    </main>
  )
}
