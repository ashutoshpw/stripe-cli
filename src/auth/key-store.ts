import { profileAuthPath, ensureProfileDir } from "../config/paths.ts";
import { AuthError } from "../utils/errors.ts";
import { verbose } from "../utils/logger.ts";
import { chmod } from "node:fs/promises";

/**
 * API key data stored in ~/.xstripe/profiles/<name>/auth.json
 *
 * Stripe uses Bearer auth with a single secret key.
 * Mode (test/live) is auto-detected from the key prefix.
 */
export interface AuthData {
  /** Stripe API Secret Key (sk_test_... or sk_live_...) */
  secretKey: string;
  /** Auto-detected mode from key prefix */
  mode: "test" | "live";
}

/**
 * Detect mode from a Stripe secret key prefix.
 */
export function detectMode(key: string): "test" | "live" {
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("rk_test_")) return "test";
  if (key.startsWith("rk_live_")) return "live";
  throw new AuthError(
    "Invalid key format. Key must start with sk_test_, sk_live_, rk_test_, or rk_live_.",
    "Get your secret key from https://dashboard.stripe.com/apikeys",
  );
}

/**
 * Load auth data for a profile.
 * Returns null if auth file doesn't exist.
 */
export async function loadAuth(profile: string): Promise<AuthData | null> {
  const path = profileAuthPath(profile);
  const file = Bun.file(path);

  if (!(await file.exists())) {
    verbose(`Auth file not found at ${path}`);
    return null;
  }

  try {
    const text = await file.text();
    const auth = JSON.parse(text) as AuthData;
    verbose(`Loaded auth from ${path}`);
    return auth;
  } catch {
    throw new AuthError(
      `Failed to parse auth file: ${path}`,
      "Run 'xstripe auth setup' to re-configure.",
    );
  }
}

/**
 * Save auth data for a profile with restrictive permissions (0600).
 */
export async function saveAuth(
  profile: string,
  auth: AuthData,
): Promise<void> {
  await ensureProfileDir(profile);
  const path = profileAuthPath(profile);
  const json = JSON.stringify(auth, null, 2) + "\n";
  await Bun.write(path, json);

  // Set restrictive permissions — only owner can read/write
  await chmod(path, 0o600);
  verbose(`Saved auth to ${path} (permissions: 0600)`);
}

/**
 * Load auth data, throwing if it doesn't exist.
 * Use this when a command requires authentication.
 */
export async function requireAuth(profile: string): Promise<AuthData> {
  const auth = await loadAuth(profile);
  if (!auth) {
    throw new AuthError(
      `Not authenticated. No auth file found for profile '${profile}'.`,
      `Run 'xstripe auth setup --profile ${profile}' to configure API keys.`,
    );
  }
  return auth;
}

/**
 * Get the Bearer authorization header value.
 */
export function getBearerAuthHeader(auth: AuthData): string {
  return `Bearer ${auth.secretKey}`;
}

/**
 * Delete auth data for a profile.
 */
export async function clearAuth(profile: string): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  const path = profileAuthPath(profile);
  try {
    await unlink(path);
    verbose(`Removed auth file: ${path}`);
  } catch {
    // File might not exist, that's fine
  }
}
