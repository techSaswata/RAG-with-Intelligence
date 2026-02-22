'use client'

import { useCallback, useRef, useState } from 'react'

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface UploadItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'processed' | 'error'
  progress: number
  imageId?: string
  error?: string
}

interface ImageUploadProps {
  apiBaseUrl: string
  apiKey?: string
}

export default function ImageUpload({ apiBaseUrl, apiKey }: ImageUploadProps) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const list = Array.from(newFiles)
    const imageFiles = list.filter(
      (f) =>
        ALLOWED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)) ||
        ALLOWED_TYPES.includes(f.type)
    )
    const newItems: UploadItem[] = imageFiles.map((f) => ({
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

    try {
      const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/images/upload`, {
        method: 'POST',
        body: form,
        headers,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || res.statusText)
      }
      const data = await res.json()
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'processing' as const, progress: 70, imageId: data.image_id }
            : i
        )
      )
      pollStatus(data.image_id, item.id)
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

  const pollStatus = (imageId: string, itemId: string) => {
    const headers: Record<string, string> = {}
    if (apiKey) headers['X-Api-Key'] = apiKey
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/$/, '')}/images/${imageId}/status`,
          { headers }
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
              i.id === itemId
                ? { ...i, status: 'error' as const, error: data.error || 'Processing failed' }
                : i
            )
          )
        }
      } catch {
        // ignore
      }
    }, 2000)
  }

  const startUploads = () => {
    const pending = items.filter((i) => i.status === 'pending')
    pending.forEach((item) => uploadOne(item))
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

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
          isDragging
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-slate-700/60 bg-slate-900/30 hover:border-slate-600'
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
        <p className="text-sm text-slate-400">Drag & drop images here or click to browse</p>
        <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP — max 50 MB</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/50"
        >
          Choose files
        </button>
      </div>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startUploads}
              disabled={pendingCount === 0}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Upload {pendingCount > 0 ? `(${pendingCount})` : ''}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800"
            >
              Clear all
            </button>
            {processedCount > 0 && (
              <span className="text-xs text-slate-500">{processedCount} processed</span>
            )}
          </div>
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-slate-800/60 bg-slate-900/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{item.file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    {item.status === 'processing' && ' — embedding…'}
                  </p>
                  {item.error && <p className="mt-1 text-xs text-rose-400">{item.error}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {item.status === 'pending' && (
                    <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] uppercase text-slate-400">
                      Ready
                    </span>
                  )}
                  {(item.status === 'uploading' || item.status === 'processing') && (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      {item.status === 'uploading' ? 'Uploading' : 'Processing'}
                    </span>
                  )}
                  {item.status === 'processed' && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase text-emerald-300">
                      Done
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase text-rose-300">
                      Error
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
