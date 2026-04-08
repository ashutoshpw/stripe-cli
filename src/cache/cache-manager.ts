import { profileCacheDir, ensureCacheDir, CACHE_DIR } from "../config/paths.ts";
import { verbose } from "../utils/logger.ts";
import { join } from "node:path";
import { readdir, unlink, stat, rm } from "node:fs/promises";

/**
 * Cached API response wrapper.
 */
export interface CachedResponse<T = unknown> {
  /** When this entry was cached (ms since epoch) */
  cachedAt: number;
  /** TTL in seconds that was active when cached */
  ttl: number;
  /** The cached API response data */
  data: T;
  /** Total number of records (for paginated list responses) */
  totalCount?: number;
}

/**
 * Read a cached response from disk.
 * Returns the cached data if found and not expired, null otherwise.
 */
export async function readCache<T = unknown>(
  profile: string,
  module: string,
  filename: string,
  ttlSeconds: number,
): Promise<CachedResponse<T> | null> {
  const filePath = join(profileCacheDir(profile, module), filename);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    verbose(`Cache miss: ${filePath} (not found)`);
    return null;
  }

  try {
    const text = await file.text();
    const cached = JSON.parse(text) as CachedResponse<T>;

    // Check expiry
    const age = Date.now() - cached.cachedAt;
    const maxAge = ttlSeconds * 1000;

    if (age > maxAge) {
      verbose(
        `Cache miss: ${filePath} (expired, age: ${Math.round(age / 1000)}s, ttl: ${ttlSeconds}s)`,
      );
      return null;
    }

    verbose(`Cache hit: ${filePath} (age: ${Math.round(age / 1000)}s)`);
    return cached;
  } catch (err) {
    verbose(`Cache read error: ${filePath}: ${err}`);
    // Corrupt cache file — delete it
    try {
      await unlink(filePath);
    } catch {
      // ignore
    }
    return null;
  }
}

/**
 * Write a response to the cache.
 */
export async function writeCache<T = unknown>(
  profile: string,
  module: string,
  filename: string,
  data: T,
  ttlSeconds: number,
  meta?: { totalCount?: number },
): Promise<void> {
  await ensureCacheDir(profile, module);

  const entry: CachedResponse<T> = {
    cachedAt: Date.now(),
    ttl: ttlSeconds,
    data,
    ...meta,
  };

  const filePath = join(profileCacheDir(profile, module), filename);
  const json = JSON.stringify(entry, null, 2) + "\n";
  await Bun.write(filePath, json);
  verbose(`Cache write: ${filePath}`);
}

/**
 * Clear cache for a specific module within a profile.
 */
export async function clearModuleCache(
  profile: string,
  module: string,
): Promise<number> {
  const dir = profileCacheDir(profile, module);
  try {
    const files = await readdir(dir);
    let count = 0;
    for (const file of files) {
      if (file.endsWith(".json")) {
        await unlink(join(dir, file));
        count++;
      }
    }
    verbose(`Cleared ${count} cache files from ${dir}`);
    return count;
  } catch {
    return 0;
  }
}

/**
 * Clear ALL cache for a specific profile.
 */
export async function clearProfileCache(profile: string): Promise<void> {
  const dir = join(CACHE_DIR, profile);
  try {
    await rm(dir, { recursive: true, force: true });
    verbose(`Cleared all cache for profile ${profile} at ${dir}`);
  } catch {
    // ignore
  }
}

/**
 * Clear ALL cache across all profiles.
 */
export async function clearAllCache(): Promise<void> {
  try {
    await rm(CACHE_DIR, { recursive: true, force: true });
    verbose(`Cleared all cache at ${CACHE_DIR}`);
  } catch {
    // ignore
  }
}

/**
 * Get cache statistics for a profile.
 */
export async function getCacheStats(
  profile: string,
): Promise<{
  modules: Record<string, number>;
  totalFiles: number;
  totalBytes: number;
}> {
  const profileDir = join(CACHE_DIR, profile);
  const modules: Record<string, number> = {};
  let totalFiles = 0;
  let totalBytes = 0;

  try {
    const moduleDirs = await readdir(profileDir);
    for (const mod of moduleDirs) {
      const modDir = join(profileDir, mod);
      try {
        const files = await readdir(modDir);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));
        modules[mod] = jsonFiles.length;
        totalFiles += jsonFiles.length;

        for (const file of jsonFiles) {
          try {
            const s = await stat(join(modDir, file));
            totalBytes += s.size;
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // No cache dir yet
  }

  return { modules, totalFiles, totalBytes };
}
