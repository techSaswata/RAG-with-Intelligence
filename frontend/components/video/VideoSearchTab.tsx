'use client'

import { useState } from 'react'
import FrameResultGrid, { type FrameResult } from './FrameResultGrid'
import VideoPlayerWithSeek from './VideoPlayerWithSeek'

interface VideoSearchTabProps {
  apiBaseUrl: string
  apiKey?: string
}

export default function VideoSearchTab({ apiBaseUrl, apiKey }: VideoSearchTabProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FrameResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [player, setPlayer] = useState<{ videoUrl: string; timestampSec: number } | null>(null)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['X-Api-Key'] = apiKey
    try {
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/videos/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: query.trim(), top_k: 12 }),
      })
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
    setPlayer({ videoUrl, timestampSec: r.timestamp_sec })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="e.g. Show the moment when the rocket launches"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="rounded-xl bg-cyan-600 px-6 py-3 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search videos'}
        </button>
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
