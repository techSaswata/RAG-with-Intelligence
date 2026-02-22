'use client'

import { useState } from 'react'
import ImageResultGrid, { type ImageResult } from './ImageResultGrid'
import ImageViewerModal from './ImageViewerModal'
import { withNgrokBypass, withNgrokHeaders, withNgrokMediaProxy } from '@/lib/ngrok'

interface ImageSearchTabProps {
  apiBaseUrl: string
  apiKey?: string
}

export default function ImageSearchTab({ apiBaseUrl, apiKey }: ImageSearchTabProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ImageResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ imageUrl: string } | null>(null)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['X-Api-Key'] = apiKey
    const requestHeaders = withNgrokHeaders(headers, apiBaseUrl)
    try {
      const res = await fetch(
        withNgrokBypass(`${apiBaseUrl.replace(/\/$/, '')}/images/search`, apiBaseUrl),
        {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({ query: query.trim(), top_k: 12 }),
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

  const openViewer = (r: ImageResult) => {
    let imageUrl = r.image_url.startsWith('http')
      ? r.image_url
      : `${apiBaseUrl.replace(/\/$/, '')}${r.image_url}`
    if (apiKey) {
      const joiner = imageUrl.includes('?') ? '&' : '?'
      imageUrl = `${imageUrl}${joiner}api_key=${encodeURIComponent(apiKey)}`
    }
    imageUrl = withNgrokMediaProxy(imageUrl, apiBaseUrl)
    setViewer({ imageUrl })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="e.g. sunset beach with palm trees"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-200 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search images'}
        </button>
      </div>
      {error && (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-3 text-sm text-rose-300">
          {error}
        </div>
      )}
      <ImageResultGrid
        results={results}
        onImageClick={openViewer}
        apiBaseUrl={apiBaseUrl}
        apiKey={apiKey}
      />
      {viewer && (
        <ImageViewerModal
          imageUrl={viewer.imageUrl}
          isOpen
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  )
}
