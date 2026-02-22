'use client'

import { useState } from 'react'
import FrameResultGrid, { type FrameResult } from './FrameResultGrid'
import VideoPlayerWithSeek from './VideoPlayerWithSeek'
import { withNgrokBypass, withNgrokHeaders, withNgrokMediaProxy } from '@/lib/ngrok'

interface VideoImageSearchTabProps {
  apiBaseUrl: string
  apiKey?: string
}

export default function VideoImageSearchTab({ apiBaseUrl, apiKey }: VideoImageSearchTabProps) {
  const [file, setFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [results, setResults] = useState<FrameResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [player, setPlayer] = useState<{ videoUrl: string; timestampSec: number } | null>(null)

  const search = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    const headers: Record<string, string> = {}
    if (apiKey) headers['X-Api-Key'] = apiKey
    const requestHeaders = withNgrokHeaders(headers, apiBaseUrl)
    const form = new FormData()
    form.append('file', file)
    if (prompt.trim()) {
      form.append('prompt', prompt.trim())
    }
    try {
      const res = await fetch(
        withNgrokBypass(`${apiBaseUrl.replace(/\/$/, '')}/videos/search-by-image?top_k=12`, apiBaseUrl),
        {
          method: 'POST',
          headers: requestHeaders,
          body: form,
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || res.statusText)
      }
      const data = await res.json()
      setResults(data.results || [])
    } catch (e) {
      setError((e as Error).message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const openPlayer = (r: FrameResult) => {
    let videoUrl = r.video_url.startsWith('http')
      ? r.video_url
      : `${apiBaseUrl.replace(/\/$/, '')}${r.video_url}`
    if (apiKey) {
      const joiner = videoUrl.includes('?') ? '&' : '?'
      videoUrl = `${videoUrl}${joiner}api_key=${encodeURIComponent(apiKey)}`
    }
    videoUrl = withNgrokMediaProxy(videoUrl, apiBaseUrl)
    setPlayer({ videoUrl, timestampSec: r.timestamp_sec })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/60 bg-neutral-950/50 p-6">
        <p className="text-sm text-slate-400">
          Upload a reference photo. The system will look for visually similar frames
          using a strict similarity threshold.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional prompt, e.g. red tee, beside a mountain"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-200 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="flex-1 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border file:border-slate-700/60 file:bg-slate-900/80 file:px-4 file:py-2 file:text-sm file:text-slate-200 hover:file:bg-slate-800"
          />
          <button
            type="button"
            onClick={search}
            disabled={!file || loading}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Find matching clips'}
          </button>
          </div>
        </div>
        {file && (
          <p className="mt-2 text-xs text-slate-500">Selected: {file.name}</p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <FrameResultGrid
        results={results}
        onFrameClick={openPlayer}
        apiBaseUrl={apiBaseUrl}
        apiKey={apiKey}
      />

      {player && (
        <VideoPlayerWithSeek
          videoUrl={player.videoUrl}
          timestampSec={player.timestampSec}
          isOpen
          onClose={() => setPlayer(null)}
        />
      )}
    </div>
  )
}
