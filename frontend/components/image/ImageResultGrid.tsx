'use client'

import { withNgrokMediaProxy } from '@/lib/ngrok'

export interface ImageResult {
  image_id: string
  image_path: string
  thumbnail_url: string
  image_url: string
  similarity: number
}

interface ImageResultGridProps {
  results: ImageResult[]
  onImageClick: (result: ImageResult) => void
  apiBaseUrl: string
  apiKey?: string
}

export default function ImageResultGrid({
  results,
  onImageClick,
  apiBaseUrl,
  apiKey,
}: ImageResultGridProps) {
  const withApiKey = (url: string) => {
    if (!apiKey) return url
    const joiner = url.includes('?') ? '&' : '?'
    return `${url}${joiner}api_key=${encodeURIComponent(apiKey)}`
  }

  const thumbSrc = (r: ImageResult) => {
    const url = r.thumbnail_url.startsWith('http')
      ? r.thumbnail_url
      : `${apiBaseUrl.replace(/\/$/, '')}${r.thumbnail_url}`
    return withApiKey(withNgrokMediaProxy(url, apiBaseUrl))
  }

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-neutral-950/50 p-12 text-center text-slate-500">
        No images found. Try a different query or upload more images.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {results.map((r) => (
        <button
          key={r.image_id}
          type="button"
          onClick={() => onImageClick(r)}
          className="group flex flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-neutral-950/80 transition-all hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/50"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-slate-900">
            <img
              src={thumbSrc(r)}
              alt="Search result"
              className="h-full w-full object-cover transition group-hover:scale-105"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="%23334155"><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2374818e" font-size="12">No preview</text></svg>'
              }}
            />
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              {(r.similarity * 100).toFixed(0)}%
            </span>
          </div>
          <div className="p-2 text-left">
            <p className="truncate text-xs text-slate-400">Image ID: {r.image_id}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
