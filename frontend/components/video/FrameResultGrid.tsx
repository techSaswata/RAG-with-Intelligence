'use client'

export interface FrameResult {
  frame_id: string
  video_id: string
  timestamp_sec: number
  frame_path: string
  thumbnail_url: string
  video_url: string
  similarity: number
}

interface FrameResultGridProps {
  results: FrameResult[]
  onFrameClick: (result: FrameResult) => void
  /** Base URL for API (e.g. http://localhost:8000) so thumbnail_url paths resolve */
  apiBaseUrl: string
  apiKey?: string
}

export default function FrameResultGrid({
  results,
  onFrameClick,
  apiBaseUrl,
  apiKey,
}: FrameResultGridProps) {
  const thumbSrc = (r: FrameResult) =>
    r.thumbnail_url.startsWith('http') ? r.thumbnail_url : `${apiBaseUrl.replace(/\/$/, '')}${r.thumbnail_url}`

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-neutral-950/50 p-12 text-center text-slate-500">
        No frames found. Try a different query or upload more videos.
      </div>
    )
  }

  const headers: Record<string, string> = {}
  if (apiKey) headers['X-Api-Key'] = apiKey

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {results.map((r) => (
        <button
          key={r.frame_id}
          type="button"
          onClick={() => onFrameClick(r)}
          className="group flex flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-neutral-950/80 transition-all hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/50"
        >
          <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
            <img
              src={thumbSrc(r)}
              alt={`Frame at ${r.timestamp_sec}s`}
              className="h-full w-full object-cover transition group-hover:scale-105"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" fill="%23334155"><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2374818e" font-size="12">No preview</text></svg>'
              }
            }
            />
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              {r.timestamp_sec.toFixed(1)}s
            </span>
          </div>
          <div className="p-2 text-left">
            <p className="truncate text-xs text-slate-400">Score: {(r.similarity * 100).toFixed(0)}%</p>
          </div>
        </button>
      ))}
    </div>
  )
}
