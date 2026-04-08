import { verbose } from "../utils/logger.ts";

/**
 * Simple sliding-window rate limiter.
 *
 * Stripe enforces rate limits (100 read requests/second in live mode,
 * 25/second in test mode). This limiter tracks request timestamps
 * and delays when approaching the limit.
 */

/** Maximum requests per second (conservative for test mode) */
const MAX_REQUESTS_PER_WINDOW = 25;

/** Window size in milliseconds */
const WINDOW_MS = 1_000;

/** Base delay for 429 backoff (ms) */
const BACKOFF_BASE_MS = 1_000;

/** Maximum backoff delay (ms) */
const BACKOFF_MAX_MS = 60_000;

/** Timestamps of recent requests (sliding window) */
const requestTimestamps: number[] = [];

/**
 * Wait if necessary to stay within rate limits.
 * Call this BEFORE making each API request.
 */
export async function waitForRateLimit(): Promise<void> {
  const now = Date.now();

  // Remove timestamps outside the window
  while (
    requestTimestamps.length > 0 &&
    requestTimestamps[0]! < now - WINDOW_MS
  ) {
    requestTimestamps.shift();
  }

  // If we're at the limit, wait until the oldest request exits the window
  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = requestTimestamps[0]!;
    const waitMs = oldestInWindow + WINDOW_MS - now + 50; // +50ms buffer
    if (waitMs > 0) {
      verbose(
        `Rate limit: waiting ${waitMs}ms (${requestTimestamps.length} requests in window)`,
      );
      await sleep(waitMs);
    }
  }

  // Record this request
  requestTimestamps.push(Date.now());
}

/**
 * Handle a 429 (Too Many Requests) response with exponential backoff.
 *
 * @param attempt - Current retry attempt (0-based)
 * @param retryAfterHeader - Value of Retry-After header if present
 * @returns true if should retry, false if max retries exceeded
 */
export async function handleRateLimit(
  attempt: number,
  retryAfterHeader?: string | null,
): Promise<boolean> {
  const maxRetries = 3;

  if (attempt >= maxRetries) {
    return false;
  }

  let delayMs: number;

  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(seconds)) {
      delayMs = seconds * 1000;
    } else {
      delayMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
    }
  } else {
    // Exponential backoff: 1s, 2s, 4s
    delayMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
  }

  // Add jitter to avoid thundering herd
  delayMs += Math.random() * 1000;

  // Cap at max
  delayMs = Math.min(delayMs, BACKOFF_MAX_MS);

  verbose(
    `Rate limited (429). Retry ${attempt + 1}/${maxRetries} after ${Math.round(delayMs)}ms`,
  );
  await sleep(delayMs);

  return true;
}

/**
 * Sleep for the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
