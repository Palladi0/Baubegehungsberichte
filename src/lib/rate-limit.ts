// In-memory sliding-window rate limiter (single-process; resets on server restart)
const windows = new Map<string, number[]>()

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const cutoff = now - windowMs
  const hits = (windows.get(key) ?? []).filter((t) => t > cutoff)

  if (hits.length >= maxRequests) {
    const retryAfterMs = hits[0] + windowMs - now
    return { allowed: false, retryAfterMs }
  }

  hits.push(now)
  windows.set(key, hits)
  return { allowed: true, retryAfterMs: 0 }
}
