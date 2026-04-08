/**
 * Base error class for xstripe CLI.
 * All custom errors extend this for consistent handling.
 */
export class StripeCliError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "StripeCliError";
  }
}

/**
 * Configuration errors (missing config, invalid values, etc.)
 */
export class ConfigError extends StripeCliError {
  constructor(message: string, hint?: string) {
    super(message, "CONFIG_ERROR", hint);
    this.name = "ConfigError";
  }
}

/**
 * Authentication errors (invalid API key, 401, etc.)
 */
export class AuthError extends StripeCliError {
  constructor(message: string, hint?: string) {
    super(message, "AUTH_ERROR", hint);
    this.name = "AuthError";
  }
}

/**
 * API errors from Stripe.
 *
 * Stripe errors have the shape:
 * {
 *   "error": {
 *     "type": "invalid_request_error",
 *     "code": "resource_missing",
 *     "message": "No such customer: 'cus_...'",
 *     "param": "id",
 *     "doc_url": "https://stripe.com/docs/error-codes/..."
 *   }
 * }
 */
export class ApiError extends StripeCliError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly stripeCode?: string,
    public readonly stripeType?: string,
    public readonly param?: string,
    public readonly docUrl?: string,
    hint?: string,
  ) {
    super(message, "API_ERROR", hint);
    this.name = "ApiError";
  }
}

/**
 * Cache errors (corrupt cache, I/O failures, etc.)
 */
export class CacheError extends StripeCliError {
  constructor(message: string, hint?: string) {
    super(message, "CACHE_ERROR", hint);
    this.name = "CacheError";
  }
}

/**
 * Format an error for CLI display.
 * Shows the error message and optional hint.
 */
export function formatError(err: unknown): string {
  if (err instanceof StripeCliError) {
    let msg = `Error: ${err.message}`;
    if (err instanceof ApiError) {
      if (err.stripeCode) msg += ` [${err.stripeCode}]`;
      if (err.param) msg += ` (param: ${err.param})`;
      if (err.docUrl) msg += `\nDocs: ${err.docUrl}`;
    }
    if (err.hint) {
      msg += `\nHint: ${err.hint}`;
    }
    return msg;
  }
  if (err instanceof Error) {
    return `Error: ${err.message}`;
  }
  return `Error: ${String(err)}`;
}
