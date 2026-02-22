import { isNgrokUrl } from '@/lib/ngrok'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { path?: string[] } }

export async function GET(req: NextRequest, context: RouteContext) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
  if (!apiBase) {
    return new Response('Missing NEXT_PUBLIC_API_URL', { status: 500 })
  }

  const path = context.params.path?.join('/') ?? ''
  const incomingUrl = new URL(req.url)
  const targetUrl = new URL(`${apiBase.replace(/\/$/, '')}/${path}`)
  incomingUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value)
  })

  const headers = new Headers()
  const range = req.headers.get('range')
  if (range) headers.set('range', range)
  if (isNgrokUrl(apiBase)) {
    headers.set('ngrok-skip-browser-warning', 'true')
  }

  try {
    const response = await fetch(targetUrl.toString(), { headers })

    if (!response.ok) {
      return new Response(response.statusText, { status: response.status })
    }

    const data = await response.arrayBuffer()

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentDisposition = response.headers.get('content-disposition')

    const resHeaders = new Headers()
    resHeaders.set('content-type', contentType)
    resHeaders.set('content-length', data.byteLength.toString())
    resHeaders.set('cache-control', 'public, max-age=3600, immutable')
    if (contentDisposition) {
      resHeaders.set('content-disposition', contentDisposition)
    }
    const acceptRanges = response.headers.get('accept-ranges')
    if (acceptRanges) resHeaders.set('accept-ranges', acceptRanges)
    const contentRange = response.headers.get('content-range')
    if (contentRange) resHeaders.set('content-range', contentRange)

    return new Response(data, {
      status: response.status,
      headers: resHeaders,
    })
  } catch (err) {
    console.error('ngrok-proxy error:', err)
    return new Response('Proxy error', { status: 502 })
  }
}
