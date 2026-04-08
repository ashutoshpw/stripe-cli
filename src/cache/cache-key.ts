/**
 * Generate deterministic cache keys from API request parameters.
 * Uses SHA-256 to create short, filesystem-safe keys.
 */

/**
 * Generate a cache key from query parameters.
 *
 * The key is the first 12 characters of the SHA-256 hash of the
 * sorted, JSON-stringified query parameters. This ensures:
 *   - Same params always produce the same key
 *   - Parameter order doesn't matter
 *   - Keys are short and filesystem-safe
 */
export async function generateCacheKey(
  params: Record<string, string>,
): Promise<string> {
  // Sort keys for deterministic output
  const sorted = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key]!;
        return acc;
      },
      {} as Record<string, string>,
    );

  const input = JSON.stringify(sorted);
  const hash = new Bun.CryptoHasher("sha256");
  hash.update(input);
  const hex = hash.digest("hex");

  return hex.slice(0, 12);
}

/**
 * Build a cache filename for a list request.
 * Format: list_<hash>.json
 */
export async function listCacheFilename(
  params: Record<string, string>,
): Promise<string> {
  const key = await generateCacheKey(params);
  return `list_${key}.json`;
}

/**
 * Build a cache filename for a single-record GET request.
 * Format: get_<id>.json
 */
export function getCacheFilename(id: string): string {
  return `get_${id}.json`;
}
