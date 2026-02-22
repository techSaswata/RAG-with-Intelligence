'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ImageUpload from '@/components/image/ImageUpload'
import ImageSearchTab from '@/components/image/ImageSearchTab'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const IMAGE_API_KEY = process.env.NEXT_PUBLIC_IMAGE_API_KEY || ''

interface ImageInfo {
  image_id: string
  original_filename: string
  status: string
  file_size_bytes: number | null
}

function DeleteModal({
  item,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  item: ImageInfo
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center processing-overlay-enter">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-2xl" onClick={onCancel} />
      <div className="relative z-10 mx-auto w-full max-w-md px-6">
        <div className="rounded-2xl border border-slate-700/50 bg-neutral-950/90 p-6 shadow-2xl shadow-black/50">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
            <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-center text-base font-bold text-slate-100">Delete Image</h3>
          <p className="mt-2 text-center text-sm text-slate-400">
            This will permanently remove <span className="font-semibold text-slate-200">{item.original_filename}</span> and
            its embedding from the vector store.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 rounded-xl border border-slate-800/60 px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:border-slate-700 hover:text-slate-200 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Deleting...
                </span>
              ) : (
                'Delete permanently'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageRow({
  item,
  onDelete,
}: {
  item: ImageInfo
  onDelete: () => void
}) {
  const statusBadge = () => {
    switch (item.status) {
      case 'processed':
        return (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-emerald-400">
            Indexed
          </span>
        )
      case 'processing':
        return (
          <span className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-amber-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Processing
          </span>
        )
      case 'failed':
        return (
          <span className="rounded-full border border-rose-500/20 bg-rose-500/[0.06] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-rose-400">
            Failed
          </span>
        )
      default:
        return (
          <span className="rounded-full border border-slate-700/40 bg-slate-800/40 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Pending
          </span>
        )
    }
  }

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-slate-800/60 bg-neutral-950/80 px-5 py-4 transition-all duration-300 hover:border-slate-700/60">
      {/* Image icon */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-950/40">
        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
        </svg>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-200">{item.original_filename}</p>
        <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
          <span className="font-mono">{item.image_id.slice(0, 8)}…</span>
          {item.file_size_bytes && (
            <span>{(item.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        {statusBadge()}
        <span className="rounded-full border border-slate-800/50 bg-neutral-900/60 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-500">
          CLIP
        </span>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="shrink-0 rounded-xl border border-transparent p-2 text-slate-600 transition-all duration-200 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
        title="Delete image"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  )
}

function ManageImagesTab() {
  const [images, setImages] = useState<ImageInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ImageInfo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const headers: Record<string, string> = {}
  if (IMAGE_API_KEY) headers['X-Api-Key'] = IMAGE_API_KEY

  const fetchImages = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/images/`, { headers })
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`)
      const data = await res.json()
      setImages(data.images || [])
    } catch (err) {
      console.error('Failed to fetch images:', err)
      setError('Failed to load images. Is the backend running?')
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const res = await fetch(`${API_URL}/images/${deleteTarget.image_id}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`)
      setImages((prev) => prev.filter((i) => i.image_id !== deleteTarget.image_id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Delete error:', err)
      setError(`Failed to delete ${deleteTarget.original_filename}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const processedCount = images.filter((i) => i.status === 'processed').length

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          item={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Stats bar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-6 rounded-2xl border border-slate-800/60 bg-neutral-950/80 px-6 py-3">
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-slate-100">{images.length}</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Images</p>
          </div>
          <div className="h-8 w-px bg-slate-800/60" />
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-slate-100">{processedCount}</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Indexed</p>
          </div>
          <div className="h-8 w-px bg-slate-800/60" />
          <div className="text-center">
            <p className="font-mono text-xl font-bold text-slate-100">512-d</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Vectors</p>
          </div>
        </div>
        <button
          onClick={() => { setIsLoading(true); fetchImages() }}
          className="rounded-xl border border-slate-800/60 p-3 text-slate-500 transition hover:border-slate-700 hover:text-slate-300"
          title="Refresh"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
          </svg>
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <svg className="mb-4 h-8 w-8 animate-spin text-slate-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-slate-500">Loading images...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-6 py-8 text-center">
          <svg className="mx-auto mb-3 h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-rose-300">{error}</p>
          <button
            onClick={() => { setIsLoading(true); setError(null); fetchImages() }}
            className="mt-4 rounded-xl border border-rose-500/30 px-4 py-2 text-xs text-rose-300 transition hover:bg-rose-500/10"
          >
            Retry
          </button>
        </div>
      ) : images.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-800/60 px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800/60 bg-neutral-900/80">
            <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-300">No images uploaded</h3>
          <p className="mt-2 text-sm text-slate-500">
            Upload images to start building your visual search index.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {images.map((img) => (
            <ImageRow
              key={img.image_id}
              item={img}
              onDelete={() => setDeleteTarget(img)}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default function ImagesPage() {
  const [tab, setTab] = useState<'upload' | 'search' | 'manage'>('upload')

  return (
    <main className="relative min-h-screen bg-black text-slate-100 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/[0.04] blur-[180px]" />
        <div className="absolute bottom-0 right-[-10%] h-[400px] w-[400px] rounded-full bg-teal-500/[0.03] blur-[160px]" />
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
              href="/videos"
              className="rounded-xl border border-slate-800/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            >
              Videos
            </Link>
          </div>
        </nav>

        <section className="mx-auto max-w-5xl px-6 pt-8 pb-6">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Image Semantic Search</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            Upload & <span className="bg-gradient-to-r from-emerald-300 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Search</span> images
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            Add images, then search them with natural language. Results return the most similar visuals.
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
              onClick={() => setTab('manage')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === 'manage'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              View Uploaded
            </button>
          </div>

          {tab === 'upload' && (
            <ImageUpload apiBaseUrl={API_URL} apiKey={IMAGE_API_KEY || undefined} />
          )}
          {tab === 'search' && (
            <ImageSearchTab apiBaseUrl={API_URL} apiKey={IMAGE_API_KEY || undefined} />
          )}
          {tab === 'manage' && <ManageImagesTab />}
        </section>
      </div>
    </main>
  )
}
