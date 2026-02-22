const NGROK_HOST_RE = /(^|\/\/)[^/]*ngrok(-free)?\.app|(^|\/\/)[^/]*ngrok\.io/i

export const isNgrokUrl = (url: string) => NGROK_HOST_RE.test(url)

export const withNgrokBypass = (url: string, baseUrl?: string) => {
  if (!url) return url
  const target = baseUrl || url
  if (!target || !isNgrokUrl(target)) return url
  if (url.includes('ngrok-skip-browser-warning=')) return url
  const joiner = url.includes('?') ? '&' : '?'
  return `${url}${joiner}ngrok-skip-browser-warning=true`
}

export const withNgrokHeaders = (headers: Record<string, string>, baseUrl?: string) => {
  if (!baseUrl || !isNgrokUrl(baseUrl)) return headers
  return { ...headers, 'ngrok-skip-browser-warning': 'true' }
}
