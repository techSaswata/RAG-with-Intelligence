'use client'

import { useRef, useEffect } from 'react'

interface VideoPlayerWithSeekProps {
  videoUrl: string | null
  timestampSec: number
  isOpen: boolean
  onClose: () => void
}

export default function VideoPlayerWithSeek({
  videoUrl,
  timestampSec,
  isOpen,
  onClose,
}: VideoPlayerWithSeekProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl || !isOpen) return
    video.src = videoUrl
    video.currentTime = timestampSec
    video.play().catch(() => {})
  }, [videoUrl, timestampSec, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-4xl rounded-2xl border border-slate-700/60 bg-neutral-950 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 rounded-full border border-slate-600 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <video
          ref={videoRef}
          controls
          className="w-full rounded-2xl"
          onEnded={() => {}}
        />
        <p className="p-3 text-center text-xs text-slate-500">
          Started at {timestampSec.toFixed(1)}s — click outside to close
        </p>
      </div>
    </div>
  )
}
