/**
 * Fixed-window rate limiter. Uses Upstash Redis REST when configured; otherwise
 * an in-memory window (fine for single-instance dev, same fallback philosophy as
 * lib/email/send.ts). Every public endpoint should pass through this.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

const memory = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return upstashFixedWindow(url, token, key, limit, windowSeconds);
  }
  return memoryFixedWindow(key, limit, windowSeconds);
}

function memoryFixedWindow(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1 };
  }
  entry.count += 1;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}

async function upstashFixedWindow(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  try {
    // Pipeline: INCR then (set TTL only on first hit via NX-ish EXPIRE).
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSeconds), "NX"],
      ]),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const data = (await res.json()) as Array<{ result: number }>;
    const count = data[0]?.result ?? 1;
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (err) {
    // Fail open on limiter outage, never break a customer's banner over rate limiting.
    console.error("[rate-limit] upstash error, allowing request", err);
    return { ok: true, remaining: limit };
  }
}
