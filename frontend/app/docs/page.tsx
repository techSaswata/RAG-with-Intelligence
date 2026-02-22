'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import ApiMissingNotice from '@/components/ApiMissingNotice'

// ── Reuse scroll reveal from landing page ──
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed')
          observer.unobserve(el)
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}

function RevealSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useScrollReveal()
  return (
    <div
      ref={ref}
      className={`reveal-on-scroll ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// ── Types ──
interface DocumentInfo {
  document_name: string
  chunk_count: number
  page_count: number
}

// ── Delete confirmation modal ──
function DeleteModal({
  doc,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  doc: DocumentInfo
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center processing-overlay-enter">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-2xl" onClick={onCancel} />

      <div className="relative z-10 mx-auto w-full max-w-md px-6">
        <div className="rounded-2xl border border-slate-700/50 bg-neutral-950/90 p-6 shadow-2xl shadow-black/50">
          {/* Warning icon */}
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
            <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>

          <h3 className="text-center text-base font-bold text-slate-100">Delete Document</h3>
          <p className="mt-2 text-center text-sm text-slate-400">
            This will permanently remove <span className="font-semibold text-slate-200">{doc.document_name}</span> and
            all <span className="font-mono text-rose-400">{doc.chunk_count}</span> associated chunks from the vector store.
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

// ── Document row ──
function DocRow({
  doc,
  index,
  onDelete,
}: {
  doc: DocumentInfo
  index: number
  onDelete: () => void
}) {
  return (
    <RevealSection delay={index * 60}>
      <div className="group flex items-center gap-4 rounded-2xl border border-slate-800/60 bg-neutral-950/80 px-5 py-4 transition-all duration-300 hover:border-slate-700/60">
        {/* PDF icon */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-950/40">
          <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>

        {/* Document info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-200">{doc.document_name}</p>
          <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
              </svg>
              {doc.chunk_count} chunks
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] text-emerald-400">
            Indexed
          </span>
          <span className="rounded-full border border-slate-800/50 bg-neutral-900/60 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-slate-500">
            pgvector
          </span>
        </div>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="shrink-0 rounded-xl border border-transparent p-2 text-slate-600 transition-all duration-200 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
          title="Delete document"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
    </RevealSection>
  )
}

// ══════════════════════════════════════════════
//  DOCS PAGE
// ══════════════════════════════════════════════
export default function DocsPage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [totalChunks, setTotalChunks] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentInfo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

  const fetchDocuments = useCallback(async () => {
    if (!API_URL) {
      setError('Missing API URL. Configure NEXT_PUBLIC_API_URL.')
      setIsLoading(false)
      return
    }

    try {
      setError(null)
      const response = await fetch(`${API_URL}/documents`)
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`)
      const data = await response.json()
      setDocuments(data.documents || [])
      setTotalChunks(data.total_chunks || 0)
    } catch (err) {
      console.error('Failed to fetch documents:', err)
      setError('Failed to load documents. Is the backend running?')
    } finally {
      setIsLoading(false)
    }
  }, [API_URL])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  if (!API_URL) {
    return <ApiMissingNotice />
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    try {
      const response = await fetch(
        `${API_URL}/documents/${encodeURIComponent(deleteTarget.document_name)}`,
        { method: 'DELETE' }
      )

      if (!response.ok) throw new Error(`Delete failed: ${response.statusText}`)

      // Remove from local state
      setDocuments(prev => prev.filter(d => d.document_name !== deleteTarget.document_name))
      setTotalChunks(prev => prev - deleteTarget.chunk_count)
      setDeleteTarget(null)
    } catch (err) {
      console.error('Delete error:', err)
      setError(`Failed to delete ${deleteTarget.document_name}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="relative min-h-screen bg-black text-slate-100 overflow-x-hidden">
      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteModal
          doc={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-500/[0.03] blur-[180px]" />
        <div className="absolute bottom-0 right-[-10%] h-[400px] w-[400px] rounded-full bg-blue-500/[0.03] blur-[160px]" />
      </div>

      <div className="relative z-10">
        {/* ── Nav ── */}
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-3 text-slate-400 transition-colors hover:text-slate-200">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/upload"
              className="rounded-xl border border-slate-800/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            >
              Upload
            </Link>
            <Link
              href="/ask"
              className="rounded-xl border border-slate-800/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            >
              Ask Vault
            </Link>
          </div>
        </nav>

        {/* ── Header ── */}
        <section className="mx-auto max-w-5xl px-6 pt-8 pb-10">
          <RevealSection>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Knowledge Base</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              Indexed
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-500 bg-clip-text text-transparent"> Documents</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
              All documents that have been uploaded, chunked, embedded, and stored in your
              pgvector knowledge base. Delete any document to remove all its associated chunks.
            </p>
          </RevealSection>
        </section>

        {/* ── Stats bar ── */}
        <section className="mx-auto max-w-5xl px-6 pb-8">
          <RevealSection delay={80}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-6 rounded-2xl border border-slate-800/60 bg-neutral-950/80 px-6 py-3">
                <div className="text-center">
                  <p className="font-mono text-xl font-bold text-slate-100">{documents.length}</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Documents</p>
                </div>
                <div className="h-8 w-px bg-slate-800/60" />
                <div className="text-center">
                  <p className="font-mono text-xl font-bold text-slate-100">{totalChunks}</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Total Chunks</p>
                </div>
                <div className="h-8 w-px bg-slate-800/60" />
                <div className="text-center">
                  <p className="font-mono text-xl font-bold text-slate-100">768-d</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Vectors</p>
                </div>
              </div>
              <button
                onClick={fetchDocuments}
                className="rounded-xl border border-slate-800/60 p-3 text-slate-500 transition hover:border-slate-700 hover:text-slate-300"
                title="Refresh"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                </svg>
              </button>
            </div>
          </RevealSection>
        </section>

        {/* ── Document List ── */}
        <section className="mx-auto max-w-5xl px-6 pb-20">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <svg className="h-8 w-8 text-slate-600 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-slate-500">Loading documents...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] px-6 py-8 text-center">
              <svg className="mx-auto mb-3 h-6 w-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-rose-300">{error}</p>
              <button
                onClick={() => { setIsLoading(true); setError(null); fetchDocuments() }}
                className="mt-4 rounded-xl border border-rose-500/30 px-4 py-2 text-xs text-rose-300 transition hover:bg-rose-500/10"
              >
                Retry
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-800/60 px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800/60 bg-neutral-900/80">
                <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-300">No documents indexed</h3>
              <p className="mt-2 text-sm text-slate-500">
                Upload PDFs to start building your knowledge base.
              </p>
              <Link
                href="/upload"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-white"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload Documents
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc, i) => (
                <DocRow
                  key={doc.document_name}
                  doc={doc}
                  index={i}
                  onDelete={() => setDeleteTarget(doc)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-slate-800/40 px-6 py-8 text-center">
          <p className="text-xs text-slate-600">
            Intelligent RAG Pipeline &middot; Built with FastAPI, Supabase pgvector, Groq, and Next.js
          </p>
        </footer>
      </div>
    </main>
  )
}
