import {
  GLOBAL_CONFIG_PATH,
  profileConfigPath,
  ensureXstripeDir,
  ensureProfileDir,
} from "./paths.ts";
import { ConfigError } from "../utils/errors.ts";
import { verbose } from "../utils/logger.ts";

/**
 * Global configuration stored in ~/.xstripe/config.json
 */
export interface GlobalConfig {
  /** The default profile name (fallback: "default") */
  defaultProfile?: string;
}

/**
 * Per-profile configuration stored in ~/.xstripe/profiles/<name>/config.json
 */
export interface ProfileConfig {
  /** Default output format */
  outputFormat?: "json" | "table" | "csv";
  /** Cache TTL in seconds (default: 3600 = 1 hour) */
  cacheTtl?: number;
}

/**
 * Resolve which profile to use.
 *
 * Priority:
 *   1. --profile flag value (explicit)
 *   2. XSTRIPE_PROFILE environment variable
 *   3. defaultProfile from global config
 *   4. "default"
 */
export async function resolveProfile(flagValue?: string): Promise<string> {
  if (flagValue) {
    verbose(`Using profile from --profile flag: ${flagValue}`);
    return flagValue;
  }

  const envProfile = process.env.XSTRIPE_PROFILE;
  if (envProfile) {
    verbose(`Using profile from XSTRIPE_PROFILE env: ${envProfile}`);
    return envProfile;
  }

  const globalConfig = await loadGlobalConfig();
  if (globalConfig?.defaultProfile) {
    verbose(`Using default profile: ${globalConfig.defaultProfile}`);
    return globalConfig.defaultProfile;
  }

  return "default";
}

// ─── Global Config ────────────────────────────────────────────

/**
 * Load global configuration from disk.
 * Returns null if the file doesn't exist.
 */
export async function loadGlobalConfig(): Promise<GlobalConfig | null> {
  const file = Bun.file(GLOBAL_CONFIG_PATH);
  if (!(await file.exists())) {
    verbose(`Global config not found at ${GLOBAL_CONFIG_PATH}`);
    return null;
  }

  try {
    const text = await file.text();
    return JSON.parse(text) as GlobalConfig;
  } catch {
    throw new ConfigError(
      `Failed to parse global config: ${GLOBAL_CONFIG_PATH}`,
      "Delete the file and run 'xstripe auth setup' to re-create.",
    );
  }
}

/**
 * Save global configuration to disk.
 */
export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  await ensureXstripeDir();
  const json = JSON.stringify(config, null, 2) + "\n";
  await Bun.write(GLOBAL_CONFIG_PATH, json);
  verbose(`Saved global config to ${GLOBAL_CONFIG_PATH}`);
}

/**
 * Update global config (merge with existing).
 */
export async function updateGlobalConfig(
  update: Partial<GlobalConfig>,
): Promise<GlobalConfig> {
  const existing = (await loadGlobalConfig()) ?? {};
  const merged = { ...existing, ...update };
  await saveGlobalConfig(merged);
  return merged;
}

// ─── Profile Config ───────────────────────────────────────────

/**
 * Load profile-specific configuration.
 * Returns null if the file doesn't exist.
 */
export async function loadProfileConfig(
  profile: string,
): Promise<ProfileConfig | null> {
  const path = profileConfigPath(profile);
  const file = Bun.file(path);

  if (!(await file.exists())) {
    verbose(`Profile config not found at ${path}`);
    return null;
  }

  try {
    const text = await file.text();
    return JSON.parse(text) as ProfileConfig;
  } catch {
    throw new ConfigError(
      `Failed to parse profile config: ${path}`,
      "Run 'xstripe auth setup' to re-configure.",
    );
  }
}

/**
 * Save profile-specific configuration.
 */
export async function saveProfileConfig(
  profile: string,
  config: ProfileConfig,
): Promise<void> {
  await ensureProfileDir(profile);
  const path = profileConfigPath(profile);
  const json = JSON.stringify(config, null, 2) + "\n";
  await Bun.write(path, json);
  verbose(`Saved profile config to ${path}`);
}

/**
 * Update profile config (merge with existing).
 */
export async function updateProfileConfig(
  profile: string,
  update: Partial<ProfileConfig>,
): Promise<ProfileConfig> {
  const existing = (await loadProfileConfig(profile)) ?? {};
  const merged = { ...existing, ...update };
  await saveProfileConfig(profile, merged);
  return merged;
}
