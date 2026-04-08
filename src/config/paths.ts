import { homedir } from "node:os";
import { join } from "node:path";

/** Root directory for all xstripe data */
export const XSTRIPE_DIR = join(homedir(), ".xstripe");

/** Global configuration file (stores defaultProfile) */
export const GLOBAL_CONFIG_PATH = join(XSTRIPE_DIR, "config.json");

/** Profiles directory */
export const PROFILES_DIR = join(XSTRIPE_DIR, "profiles");

/** Cache directory root */
export const CACHE_DIR = join(XSTRIPE_DIR, "cache");

/**
 * Get the directory for a specific profile.
 */
export function profileDir(name: string): string {
  return join(PROFILES_DIR, name);
}

/**
 * Get the auth file path for a specific profile.
 */
export function profileAuthPath(name: string): string {
  return join(PROFILES_DIR, name, "auth.json");
}

/**
 * Get the config file path for a specific profile.
 */
export function profileConfigPath(name: string): string {
  return join(PROFILES_DIR, name, "config.json");
}

/**
 * Get the cache directory for a specific profile and module.
 */
export function profileCacheDir(profileName: string, module: string): string {
  return join(CACHE_DIR, profileName, module);
}

/**
 * Ensure the xstripe root directory exists.
 */
export async function ensureXstripeDir(): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(XSTRIPE_DIR, { recursive: true });
}

/**
 * Ensure the profile directory exists.
 */
export async function ensureProfileDir(name: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(profileDir(name), { recursive: true });
}

/**
 * Ensure the cache directory for a profile/module exists.
 */
export async function ensureCacheDir(
  profileName: string,
  module: string,
): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(profileCacheDir(profileName, module), { recursive: true });
}
