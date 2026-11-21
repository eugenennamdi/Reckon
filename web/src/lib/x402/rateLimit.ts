export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ponytail: per-instance sliding-window Map limiter; upgrade to Upstash Redis for distributed multi-region enforcement.
const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): RateLimitResult {
  const cutoff = nowMs - windowMs;
  const existing = (buckets.get(key) ?? []).filter((ts) => ts > cutoff);

  if (existing.length >= limit) {
    const resetAt = existing[0] + windowMs;
    buckets.set(key, existing);
    return { allowed: false, remaining: 0, resetAt };
  }

  existing.push(nowMs);
  if (buckets.size >= 5_000 && !buckets.has(key)) {
    // Evict expired/oldest entries rather than wiping active rate-limit windows.
    for (const [k, timestamps] of buckets) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
        buckets.delete(k);
      }
      if (buckets.size < 4_000) break;
    }
    if (buckets.size >= 5_000) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }
  }
  buckets.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.length),
    resetAt: nowMs + windowMs,
  };
}

export function extractClientIp(headers: Headers): string {
  // Prefer proxy-stamped single-IP headers before client-appendable x-forwarded-for.
  for (const h of ["cf-connecting-ip", "x-vercel-forwarded-for", "x-real-ip"]) {
    const val = headers.get(h)?.split(",")[0]?.trim();
    if (val) return val;
  }
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "127.0.0.1";
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
