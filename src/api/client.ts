import { requireAuth, getBearerAuthHeader } from "../auth/key-store.ts";
import { waitForRateLimit, handleRateLimit } from "./rate-limiter.ts";
import { ApiError, AuthError } from "../utils/errors.ts";
import { verbose } from "../utils/logger.ts";

/** Stripe API base URL */
const BASE_URL = "https://api.stripe.com/v1";

/**
 * Options for an API request.
 */
export interface ApiRequestOptions {
  /** HTTP method (default: GET) */
  method?: "GET" | "POST";
  /** Query parameters (appended to URL) */
  params?: Record<string, string>;
  /** Request body (for POST — form-encoded as Stripe expects) */
  body?: Record<string, unknown>;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * Stripe error response shape.
 */
export interface StripeErrorResponse {
  error: {
    type: string;
    code?: string;
    message: string;
    param?: string;
    doc_url?: string;
  };
}

/**
 * Stripe list response shape.
 */
export interface StripeListResponse<T = Record<string, unknown>> {
  object: "list";
  url: string;
  has_more: boolean;
  data: T[];
}

/**
 * Stripe search response shape.
 */
export interface StripeSearchResponse<T = Record<string, unknown>> {
  object: "search_result";
  url: string;
  has_more: boolean;
  next_page?: string;
  data: T[];
}

/**
 * Encode parameters for Stripe's form-encoded format.
 * Handles nested objects like created[gte]=123.
 */
function encodeParams(
  params: Record<string, string>,
): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(key, value);
  }
  return searchParams;
}

/**
 * Make an authenticated API request to Stripe.
 *
 * Handles:
 *   - Bearer Auth header
 *   - Rate limiting
 *   - 429 backoff with retry
 *   - Error mapping (Stripe error format)
 *
 * @param path - API path (e.g., "/customers", "/charges/ch_123")
 * @param options - Request options
 * @param profile - Profile name for auth resolution
 * @returns Parsed JSON response
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
  profile: string = "default",
): Promise<T> {
  const {
    method = "GET",
    params = {},
    body,
    headers: extraHeaders = {},
  } = options;

  // Build URL
  const url = new URL(`${BASE_URL}${path}`);

  // Encode params properly (supports Stripe nested params like created[gte])
  const encoded = encodeParams(params);
  for (const [key, value] of encoded.entries()) {
    url.searchParams.append(key, value);
  }

  // Get auth
  const auth = await requireAuth(profile);
  const authHeader = getBearerAuthHeader(auth);

  // Retry loop for rate limiting
  for (let attempt = 0; attempt <= 3; attempt++) {
    await waitForRateLimit();

    const headers: Record<string, string> = {
      ...extraHeaders,
      Authorization: authHeader,
    };

    if (body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    verbose(`${method} ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? new URLSearchParams(body as Record<string, string>).toString() : undefined,
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const shouldRetry = await handleRateLimit(attempt, retryAfter);
      if (shouldRetry) continue;

      throw new ApiError(
        "Rate limit exceeded. Max retries reached.",
        429,
        "rate_limit",
        "api_error",
        undefined,
        undefined,
        "Wait a moment and try again, or reduce request frequency.",
      );
    }

    // Handle auth errors (401)
    if (response.status === 401) {
      throw new AuthError(
        "Authentication failed (401 Unauthorized).",
        "Check your API Secret Key. Run 'xstripe auth setup' to re-configure.",
      );
    }

    // Parse response
    const data = (await response.json()) as T & {
      error?: StripeErrorResponse["error"];
    };

    // Handle Stripe-level errors
    if (data.error) {
      const e = data.error;
      throw new ApiError(
        e.message ?? `API error: ${e.type}`,
        response.status,
        e.code,
        e.type,
        e.param,
        e.doc_url,
      );
    }

    // Handle non-2xx without error body
    if (!response.ok) {
      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
      );
    }

    return data;
  }

  // Should not reach here
  throw new ApiError("Unexpected error in API request loop.");
}

/**
 * Convenience: GET request.
 */
export async function apiGet<T = unknown>(
  path: string,
  params?: Record<string, string>,
  profile?: string,
): Promise<T> {
  return apiRequest<T>(path, { method: "GET", params }, profile);
}
