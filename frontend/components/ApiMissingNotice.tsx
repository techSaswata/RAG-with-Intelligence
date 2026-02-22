'use client'

export default function ApiMissingNotice() {
  return (
    <div className="mx-auto mt-20 max-w-2xl rounded-2xl border border-rose-800/60 bg-rose-950/30 p-6 text-center text-sm text-rose-200">
      Backend API URL is missing. Set <span className="font-mono">NEXT_PUBLIC_API_URL</span> in your environment
      (e.g. Vercel project settings) to your backend base URL.
    </div>
  )
}
