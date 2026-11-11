// A tiny in-memory rate limiter: at most `limit` requests per `windowMs` per key (IP).
// On serverless hosts each running instance keeps its own memory, so this is a
// "good enough" guard against abuse, not a hard global limit.

const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
  now = Date.now(),
): { ok: boolean; retryAfterSeconds: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    const retryAfterSeconds = Math.ceil((windowMs - (now - recent[0])) / 1000);
    return { ok: false, retryAfterSeconds };
  }
  recent.push(now);
  hits.set(key, recent);

  // Keep memory small: forget idle IPs now and then.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Best guess at the caller's IP address from proxy headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
