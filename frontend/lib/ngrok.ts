const NGROK_HOST_RE = /(^|\/\/)[^/]*ngrok(-free)?\.app|(^|\/\/)[^/]*ngrok\.io/i

export const isNgrokUrl = (url: string) => NGROK_HOST_RE.test(url)

export const withNgrokBypass = (url: string, baseUrl?: string) => {
  if (!url) return url
  const target = baseUrl || url
  if (!target || !isNgrokUrl(target)) return url
  return url
}

export const withNgrokMediaProxy = (url: string, baseUrl?: string) => {
  if (!url) return url
  const target = baseUrl || url
  if (!target || !isNgrokUrl(target)) return url
  try {
    const parsed = baseUrl ? new URL(url, baseUrl) : new URL(url)
    const path = parsed.pathname.replace(/^\/+/, '')
    return `/api/ngrok-proxy/${path}${parsed.search}`
  } catch {
    return url
  }
}

export const withNgrokHeaders = (headers: Record<string, string>, baseUrl?: string) => {
  if (!baseUrl || !isNgrokUrl(baseUrl)) return headers
  return { ...headers, 'ngrok-skip-browser-warning': 'true' }
}
